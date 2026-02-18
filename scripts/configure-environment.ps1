<#
.SYNOPSIS
    Configures Power Pages site settings, table permissions, and web roles
    for the Customer Self-Service SPA using PAC CLI and Dataverse Web API.

.DESCRIPTION
    Creates or updates all required Dataverse records:
    - adx_sitesetting / mspp_sitesetting  (Web API + bearer auth settings)
    - adx_entitypermission / mspp_entitypermission (table permissions)
    - N:N association between entity permissions and the "Authenticated Users" web role
    Supports dev, staging, and prod profiles.
    Automatically detects standard vs enhanced data model.

.PARAMETER EnvironmentUrl
    The Dataverse environment URL (e.g. https://contoso.crm.dynamics.com).

.PARAMETER Profile
    Target profile: dev, staging, or prod.
    - dev: includes bearer authentication settings for local development.
    - staging/prod: Web API settings only (no bearer auth).

.PARAMETER WebsiteId
    The Power Pages website record GUID. Run 'pac pages list' to find it.

.PARAMETER SkipAuth
    Skip PAC CLI authentication (use if already authenticated).

.PARAMETER DryRun
    Print what would be created/updated without making changes.

.EXAMPLE
    .\configure-environment.ps1 -EnvironmentUrl "https://contoso.crm.dynamics.com" -WebsiteId "d44574f9-acc3-4ccc-8d8d-85cf5b7ad141" -Profile dev -SkipAuth

.EXAMPLE
    .\configure-environment.ps1 -EnvironmentUrl "https://contoso.crm.dynamics.com" -WebsiteId "d44574f9-acc3-4ccc-8d8d-85cf5b7ad141" -Profile prod -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Profile,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')]
    [string]$WebsiteId,

    [switch]$SkipAuth,

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Constants — Dataverse scope option set values
# ---------------------------------------------------------------------------
$SCOPE_GLOBAL  = 756150000
$SCOPE_CONTACT = 756150001
$SCOPE_ACCOUNT = 756150002
$SCOPE_PARENT  = 756150003
$SCOPE_SELF    = 756150004

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step {
    param([string]$Message)
    Write-Host "`n>> $Message" -ForegroundColor Cyan
}

function Write-Setting {
    param([string]$Name, [string]$Value)
    $truncated = if ($Value.Length -gt 80) { $Value.Substring(0, 77) + '...' } else { $Value }
    Write-Host "   $Name = $truncated" -ForegroundColor Gray
}

function Test-PacCli {
    $cmd = Get-Command pac -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Error "PAC CLI not found. Install it: https://learn.microsoft.com/power-platform/developer/cli/introduction"
    }
}

function Invoke-PacCommand {
    param([string[]]$Arguments)
    $output = & pac @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        $msg = ($output | Out-String).Trim()
        Write-Error "PAC command failed (exit $LASTEXITCODE): pac $($Arguments -join ' ')`n$msg"
    }
    return $output
}

# ---------------------------------------------------------------------------
# Dataverse Web API helpers
# ---------------------------------------------------------------------------

function Get-DataverseToken {
    <#
    .SYNOPSIS
        Acquires a Dataverse access token using available auth methods.
        Tries: Azure CLI > Azure PowerShell > fallback to $null.
    #>
    param([string]$EnvironmentUrl)

    $resource = $EnvironmentUrl.TrimEnd('/')

    # --- Try Azure CLI ---
    $azCmd = Get-Command az -ErrorAction SilentlyContinue
    if ($azCmd) {
        try {
            Write-Host "   Acquiring token via Azure CLI..." -ForegroundColor Gray
            $tokenJson = & az account get-access-token --resource $resource 2>&1
            if ($LASTEXITCODE -eq 0) {
                $tokenObj = $tokenJson | ConvertFrom-Json
                return $tokenObj.accessToken
            }
        }
        catch { }
    }

    # --- Try Azure PowerShell ---
    try {
        if (Get-Module -ListAvailable -Name Az.Accounts -ErrorAction SilentlyContinue) {
            Write-Host "   Acquiring token via Azure PowerShell..." -ForegroundColor Gray
            $token = Get-AzAccessToken -ResourceUrl $resource -ErrorAction Stop
            return $token.Token
        }
    }
    catch { }

    return $null
}

function Get-DataverseApiBase {
    param([string]$EnvironmentUrl)
    return "$($EnvironmentUrl.TrimEnd('/'))/api/data/v9.2"
}

function Invoke-DataverseGet {
    param(
        [string]$ApiBase,
        [string]$Token,
        [string]$Path
    )
    $headers = @{
        'Authorization' = "Bearer $Token"
        'Accept'        = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }
    $uri = "$ApiBase/$Path"
    return Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
}

function Invoke-DataversePost {
    param(
        [string]$ApiBase,
        [string]$Token,
        [string]$Path,
        [hashtable]$Body
    )
    $headers = @{
        'Authorization' = "Bearer $Token"
        'Content-Type'  = 'application/json'
        'Accept'        = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        'Prefer'           = 'return=representation'
    }
    $uri = "$ApiBase/$Path"
    $json = $Body | ConvertTo-Json -Depth 10
    return Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $json
}

function Invoke-DataverseAssociate {
    param(
        [string]$ApiBase,
        [string]$Token,
        [string]$EntitySet,
        [string]$EntityId,
        [string]$NavigationProperty,
        [string]$TargetEntitySet,
        [string]$TargetId
    )
    $headers = @{
        'Authorization' = "Bearer $Token"
        'Content-Type'  = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }
    $uri = "$ApiBase/${EntitySet}(${EntityId})/${NavigationProperty}/`$ref"
    $body = @{ '@odata.id' = "$ApiBase/${TargetEntitySet}(${TargetId})" } | ConvertTo-Json
    Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body
}

# ---------------------------------------------------------------------------
# Data model detection
# ---------------------------------------------------------------------------

function Get-DataModelPrefix {
    <#
    .SYNOPSIS
        Detects whether the site uses standard (adx_) or enhanced (mspp_) data model.
    #>
    param([string]$ApiBase, [string]$Token)

    # Try enhanced model — check if mspp_webroles has actual records for this website
    try {
        $result = Invoke-DataverseGet -ApiBase $ApiBase -Token $Token `
            -Path "mspp_webroles?`$top=1&`$select=mspp_webroleid"
        if ($result.value.Count -gt 0) {
            return @{
                Prefix          = 'mspp_'
                WebRoleTable    = 'mspp_webroles'
                WebRoleId       = 'mspp_webroleid'
                WebRoleName     = 'mspp_name'
                WebRoleWebsite  = 'mspp_websiteid'
                PermTable       = 'mspp_entitypermissions'
                PermId          = 'mspp_entitypermissionid'
                PermName        = 'mspp_entityname'
                PermLogical     = 'mspp_entitylogicalname'
                PermScope       = 'mspp_scope'
                PermRead        = 'mspp_read'
                PermCreate      = 'mspp_create'
                PermWrite       = 'mspp_write'
                PermDelete      = 'mspp_delete'
                PermAppend      = 'mspp_append'
                PermAppendTo    = 'mspp_appendto'
                PermWebsite     = 'mspp_websiteid'
                PermParent      = 'mspp_parententitypermission'
                PermParentRel   = 'mspp_parentrelationship'
                PermContactRel  = 'mspp_contactrelationship'
                PermWebRoleNav  = 'mspp_entitypermission_webrole'
                WebsiteBindProp = 'mspp_websiteid@odata.bind'
                WebsiteEntitySet = 'mspp_websites'
                ParentBindProp  = 'mspp_parententitypermission@odata.bind'
            }
        }
    }
    catch { }

    # Fallback to standard model (adx_webroles)
    return @{
        Prefix          = 'adx_'
        WebRoleTable    = 'adx_webroles'
        WebRoleId       = 'adx_webroleid'
        WebRoleName     = 'adx_name'
        WebRoleWebsite  = 'adx_websiteid'
        PermTable       = 'adx_entitypermissions'
        PermId          = 'adx_entitypermissionid'
        PermName        = 'adx_entityname'
        PermLogical     = 'adx_entitylogicalname'
        PermScope       = 'adx_scope'
        PermRead        = 'adx_read'
        PermCreate      = 'adx_create'
        PermWrite       = 'adx_write'
        PermDelete      = 'adx_delete'
        PermAppend      = 'adx_append'
        PermAppendTo    = 'adx_appendto'
        PermWebsite     = 'adx_websiteid'
        PermParent      = 'adx_parententitypermission'
        PermParentRel   = 'adx_parentrelationship'
        PermContactRel  = 'adx_contactrelationship'
        PermWebRoleNav  = 'adx_entitypermission_webrole'
        WebsiteBindProp = 'adx_websiteid@odata.bind'
        WebsiteEntitySet = 'adx_websites'
        ParentBindProp  = 'adx_parententitypermission@odata.bind'
    }
}

# ---------------------------------------------------------------------------
# Site settings (PAC data)
# ---------------------------------------------------------------------------

function Get-ExistingSiteSettings {
    param([string]$WebsiteId)

    Write-Step "Querying existing site settings..."
    $filter = "adx_websiteid eq '$WebsiteId'"
    try {
        $result = Invoke-PacCommand @(
            'data', 'get',
            '--table', 'adx_sitesetting',
            '--filter', $filter,
            '--select', 'adx_sitesettingid,adx_name,adx_value'
        )
        $settings = @{}
        foreach ($line in $result) {
            $str = $line.ToString().Trim()
            if ($str -match '^\|' -and $str -notmatch '---') {
                $cols = $str.Split('|', [System.StringSplitOptions]::RemoveEmptyEntries) |
                        ForEach-Object { $_.Trim() }
                if ($cols.Count -ge 2 -and $cols[1] -ne 'adx_name') {
                    $settings[$cols[1]] = @{
                        Id    = $cols[0]
                        Value = if ($cols.Count -ge 3) { $cols[2] } else { '' }
                    }
                }
            }
        }
        return $settings
    }
    catch {
        Write-Host "   Could not query existing settings (will create all as new)" -ForegroundColor Yellow
        return @{}
    }
}

function Set-SiteSetting {
    param(
        [string]$Name,
        [string]$Value,
        [string]$WebsiteId,
        [hashtable]$Existing
    )

    Write-Setting -Name $Name -Value $Value

    if ($DryRun) {
        $action = if ($Existing.ContainsKey($Name)) { 'UPDATE' } else { 'CREATE' }
        Write-Host "   [$action] (dry run)" -ForegroundColor Yellow
        return
    }

    if ($Existing.ContainsKey($Name)) {
        $id = $Existing[$Name].Id
        Invoke-PacCommand @(
            'data', 'update',
            '--table', 'adx_sitesetting',
            '--id', $id,
            '--data', "adx_value=$Value"
        ) | Out-Null
        Write-Host "   [UPDATED]" -ForegroundColor Green
    }
    else {
        Invoke-PacCommand @(
            'data', 'create',
            '--table', 'adx_sitesetting',
            '--data', "adx_name=$Name,adx_value=$Value,adx_websiteid=$WebsiteId"
        ) | Out-Null
        Write-Host "   [CREATED]" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# Table permissions (Dataverse Web API)
# ---------------------------------------------------------------------------

function Get-AuthenticatedUsersWebRole {
    param(
        [string]$ApiBase,
        [string]$Token,
        [hashtable]$DM,
        [string]$WebsiteId
    )

    $table = $DM.WebRoleTable
    $nameCol = $DM.WebRoleName
    $idCol = $DM.WebRoleId

    # Query for "Authenticated Users" web role for this website
    $filter = "$nameCol eq 'Authenticated Users'"
    $select = "$idCol,$nameCol"
    $path = "${table}?`$filter=${filter}&`$select=${select}"

    $result = Invoke-DataverseGet -ApiBase $ApiBase -Token $Token -Path $path
    if ($result.value.Count -eq 0) {
        Write-Host "   'Authenticated Users' web role not found — creating it..." -ForegroundColor Yellow
        $body = @{
            $DM.WebRoleName                        = 'Authenticated Users'
            "$($DM.WebRoleWebsite)@odata.bind"     = "/$($DM.WebsiteEntitySet)($WebsiteId)"
        }
        # Add authenticated-users flag if enhanced model (mspp_ has this column)
        if ($DM.Prefix -eq 'mspp_') {
            $body['mspp_authenticatedusersrole'] = $true
        }
        $created = Invoke-DataversePost -ApiBase $ApiBase -Token $Token -Path $table -Body $body
        $roleId = $created.$idCol
        Write-Host "   [CREATED] Authenticated Users web role: $roleId" -ForegroundColor Green
        return $roleId
    }
    $role = $result.value[0]
    $roleId = $role.$idCol
    Write-Host "   Found 'Authenticated Users' web role: $roleId" -ForegroundColor Green
    return $roleId
}

function Get-ExistingEntityPermissions {
    param(
        [string]$ApiBase,
        [string]$Token,
        [hashtable]$DM,
        [string]$WebsiteId
    )

    $table = $DM.PermTable
    $idCol = $DM.PermId
    $nameCol = $DM.PermName
    $logicalCol = $DM.PermLogical
    $websiteCol = $DM.PermWebsite

    $filter = "_$($websiteCol)_value eq $WebsiteId"
    $select = "$idCol,$nameCol,$logicalCol"
    $path = "${table}?`$filter=${filter}&`$select=${select}"

    try {
        $result = Invoke-DataverseGet -ApiBase $ApiBase -Token $Token -Path $path
        $permissions = @{}
        foreach ($p in $result.value) {
            $key = $p.$logicalCol
            $permissions[$key] = $p.$idCol
        }
        return $permissions
    }
    catch {
        return @{}
    }
}

function New-EntityPermission {
    param(
        [string]$ApiBase,
        [string]$Token,
        [hashtable]$DM,
        [string]$WebsiteId,
        [string]$DisplayName,
        [string]$TableLogicalName,
        [int]$Scope,
        [bool]$Read = $false,
        [bool]$Create = $false,
        [bool]$Write = $false,
        [bool]$Delete = $false,
        [string]$ContactRelationship = '',
        [string]$ParentRelationship = '',
        [string]$ParentPermissionId = ''
    )

    $body = @{
        $DM.PermName        = $DisplayName
        $DM.PermLogical     = $TableLogicalName
        $DM.PermScope       = $Scope
        $DM.PermRead        = $Read
        $DM.PermCreate      = $Create
        $DM.PermWrite       = $Write
        $DM.PermDelete      = $Delete
        $DM.PermAppend      = $Create   # Append needed for create operations
        $DM.PermAppendTo    = $Create   # AppendTo needed for parent linking
        $DM.WebsiteBindProp = "/$($DM.WebsiteEntitySet)($WebsiteId)"
    }

    if ($ContactRelationship) {
        $body[$DM.PermContactRel] = $ContactRelationship
    }
    if ($ParentRelationship -and $ParentPermissionId) {
        $body[$DM.PermParentRel] = $ParentRelationship
        $body[$DM.ParentBindProp] = "/$($DM.PermTable)($ParentPermissionId)"
    }

    $result = Invoke-DataversePost -ApiBase $ApiBase -Token $Token -Path $DM.PermTable -Body $body
    return $result.$($DM.PermId)
}

function Add-WebRoleToPermission {
    param(
        [string]$ApiBase,
        [string]$Token,
        [hashtable]$DM,
        [string]$PermissionId,
        [string]$WebRoleId
    )

    try {
        Invoke-DataverseAssociate `
            -ApiBase $ApiBase -Token $Token `
            -EntitySet $DM.PermTable -EntityId $PermissionId `
            -NavigationProperty $DM.PermWebRoleNav `
            -TargetEntitySet $DM.WebRoleTable -TargetId $WebRoleId
        Write-Host "   [ASSOCIATED with Authenticated Users]" -ForegroundColor Green
    }
    catch {
        $err = $_.Exception.Message
        if ($err -match 'already exists|duplicate') {
            Write-Host "   [ALREADY ASSOCIATED]" -ForegroundColor DarkGreen
        }
        else {
            Write-Host "   [ASSOCIATION FAILED] $err" -ForegroundColor Red
        }
    }
}

# ---------------------------------------------------------------------------
# Settings definitions
# ---------------------------------------------------------------------------

$webApiSettings = @(
    # Incident (Case)
    @{ Name = 'Webapi/incident/enabled';  Value = 'true' }
    @{ Name = 'Webapi/incident/fields';   Value = 'ticketnumber,title,description,statuscode,prioritycode,createdon,modifiedon,statecode,casetypecode,customerid' }

    # Annotation (Attachments)
    @{ Name = 'Webapi/annotation/enabled'; Value = 'true' }
    @{ Name = 'Webapi/annotation/fields';  Value = 'filename,mimetype,documentbody,notetext,subject,objectid,isdocument,createdon' }

    # Activity (Timeline)
    @{ Name = 'Webapi/activitypointer/enabled'; Value = 'true' }
    @{ Name = 'Webapi/activitypointer/fields';  Value = 'subject,description,activitytypecode,createdon,regardingobjectid' }
)

$bearerAuthSettings = @(
    @{ Name = 'Authentication/BearerAuthentication/Enabled';  Value = 'true' }
    @{ Name = 'Authentication/BearerAuthentication/Protocol'; Value = 'OpenIdConnect' }
    @{ Name = 'Authentication/BearerAuthentication/Provider'; Value = 'AzureAD' }
)

# Table permission definitions with Dataverse relationship schema names
$tablePermissionDefs = @(
    @{
        DisplayName       = 'SPA - Case Read/Create (Contact)'
        Table             = 'incident'
        Scope             = $SCOPE_CONTACT
        Read              = $true
        Create            = $true
        ContactRelationship = 'incident_customer_contacts'
        ParentRelationship  = ''
    }
    @{
        DisplayName       = 'SPA - Annotation Read/Create (Parent: Case)'
        Table             = 'annotation'
        Scope             = $SCOPE_PARENT
        Read              = $true
        Create            = $true
        ContactRelationship = ''
        ParentRelationship  = 'Incident_Annotation'
        ParentTable         = 'incident'
    }
    @{
        DisplayName       = 'SPA - Activity Read (Parent: Case)'
        Table             = 'activitypointer'
        Scope             = $SCOPE_PARENT
        Read              = $true
        Create            = $false
        ContactRelationship = ''
        ParentRelationship  = 'Incident_ActivityPointers'
        ParentTable         = 'incident'
    }
)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

Write-Host "============================================================" -ForegroundColor White
Write-Host "  Power Pages Environment Configuration" -ForegroundColor White
Write-Host "  Profile:     $Profile" -ForegroundColor White
Write-Host "  Environment: $EnvironmentUrl" -ForegroundColor White
Write-Host "  Website ID:  $WebsiteId" -ForegroundColor White
if ($DryRun) {
    Write-Host "  Mode:        DRY RUN (no changes will be made)" -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor White

# --- Verify PAC CLI ---
Test-PacCli

# --- Authenticate ---
if (-not $SkipAuth) {
    Write-Step "Authenticating to $EnvironmentUrl..."
    if (-not $DryRun) {
        Invoke-PacCommand @('auth', 'create', '-u', $EnvironmentUrl) | Out-Null
    }
    else {
        Write-Host "   (dry run - skipping auth)" -ForegroundColor Yellow
    }
}

# --- Fetch existing settings for upsert logic ---
$existing = @{}
if (-not $DryRun) {
    $existing = Get-ExistingSiteSettings -WebsiteId $WebsiteId
}

# --- Web API Site Settings ---
Write-Step "Configuring Web API site settings..."
foreach ($s in $webApiSettings) {
    Set-SiteSetting -Name $s.Name -Value $s.Value -WebsiteId $WebsiteId -Existing $existing
}

# --- Bearer Auth (dev profile only) ---
if ($Profile -eq 'dev') {
    Write-Step "Configuring bearer authentication settings (dev only)..."
    foreach ($s in $bearerAuthSettings) {
        Set-SiteSetting -Name $s.Name -Value $s.Value -WebsiteId $WebsiteId -Existing $existing
    }
}
elseif ($Profile -eq 'prod') {
    Write-Step "Ensuring bearer authentication is disabled (prod)..."
    $disableSetting = @{ Name = 'Authentication/BearerAuthentication/Enabled'; Value = 'false' }
    Set-SiteSetting -Name $disableSetting.Name -Value $disableSetting.Value -WebsiteId $WebsiteId -Existing $existing
}

# ---------------------------------------------------------------------------
# Table Permissions via Dataverse Web API
# ---------------------------------------------------------------------------

Write-Step "Configuring table permissions..."
$apiBase = Get-DataverseApiBase -EnvironmentUrl $EnvironmentUrl
$token = $null

if (-not $DryRun) {
    $token = Get-DataverseToken -EnvironmentUrl $EnvironmentUrl
}

if ($DryRun) {
    Write-Host ""
    foreach ($tp in $tablePermissionDefs) {
        Write-Host "   $($tp.DisplayName)" -ForegroundColor Gray
        $scopeLabel = switch ($tp.Scope) {
            $SCOPE_CONTACT { 'Contact' }
            $SCOPE_PARENT  { 'Parent'  }
            $SCOPE_GLOBAL  { 'Global'  }
            $SCOPE_ACCOUNT { 'Account' }
            $SCOPE_SELF    { 'Self'    }
        }
        $privs = @()
        if ($tp.Read)   { $privs += 'Read' }
        if ($tp.Create) { $privs += 'Create' }
        Write-Host "     Table: $($tp.Table) | Scope: $scopeLabel | Privileges: $($privs -join ', ')" -ForegroundColor DarkGray
        Write-Host "     [CREATE + ASSOCIATE] (dry run)" -ForegroundColor Yellow
    }
}
elseif (-not $token) {
    Write-Host ""
    Write-Host "   Could not acquire a Dataverse access token." -ForegroundColor Yellow
    Write-Host "   Table permissions require the Dataverse Web API for N:N web role association." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To enable automatic table permission creation, install one of:" -ForegroundColor Yellow
    Write-Host "     - Azure CLI:  winget install Microsoft.AzureCLI" -ForegroundColor White
    Write-Host "       then run:   az login" -ForegroundColor White
    Write-Host "     - Az PowerShell: Install-Module Az.Accounts" -ForegroundColor White
    Write-Host "       then run:   Connect-AzAccount" -ForegroundColor White
    Write-Host ""
    Write-Host "   Or configure manually in Power Pages Design Studio -> Security -> Table Permissions:" -ForegroundColor Yellow
    foreach ($tp in $tablePermissionDefs) {
        Write-Host "   - $($tp.DisplayName)" -ForegroundColor Gray
    }
}
else {
    # --- Detect data model ---
    Write-Host "   Detecting data model..." -ForegroundColor Gray
    $DM = Get-DataModelPrefix -ApiBase $apiBase -Token $token
    Write-Host "   Data model prefix: $($DM.Prefix)" -ForegroundColor Green

    # --- Find web role ---
    $webRoleId = Get-AuthenticatedUsersWebRole -ApiBase $apiBase -Token $token -DM $DM -WebsiteId $WebsiteId

    # --- Check existing permissions ---
    $existingPerms = Get-ExistingEntityPermissions -ApiBase $apiBase -Token $token -DM $DM -WebsiteId $WebsiteId

    # --- Create incident permission first (others depend on it) ---
    $incidentPermId = $null
    $incidentDef = $tablePermissionDefs | Where-Object { $_.Table -eq 'incident' }

    if ($existingPerms.ContainsKey('incident')) {
        $incidentPermId = $existingPerms['incident']
        Write-Host "   $($incidentDef.DisplayName) — already exists ($incidentPermId)" -ForegroundColor DarkGreen
    }
    else {
        Write-Host "   Creating: $($incidentDef.DisplayName)..." -ForegroundColor Gray
        $incidentPermId = New-EntityPermission `
            -ApiBase $apiBase -Token $token -DM $DM -WebsiteId $WebsiteId `
            -DisplayName $incidentDef.DisplayName `
            -TableLogicalName 'incident' `
            -Scope $incidentDef.Scope `
            -Read $incidentDef.Read `
            -Create $incidentDef.Create `
            -ContactRelationship $incidentDef.ContactRelationship
        Write-Host "   [CREATED] $incidentPermId" -ForegroundColor Green
    }

    # Associate with web role
    Add-WebRoleToPermission -ApiBase $apiBase -Token $token -DM $DM `
        -PermissionId $incidentPermId -WebRoleId $webRoleId

    # --- Create child permissions (annotation, activitypointer) ---
    $childDefs = $tablePermissionDefs | Where-Object { $_.Table -ne 'incident' }
    foreach ($tp in $childDefs) {
        if ($existingPerms.ContainsKey($tp.Table)) {
            $permId = $existingPerms[$tp.Table]
            Write-Host "   $($tp.DisplayName) — already exists ($permId)" -ForegroundColor DarkGreen
        }
        else {
            Write-Host "   Creating: $($tp.DisplayName)..." -ForegroundColor Gray
            $permId = New-EntityPermission `
                -ApiBase $apiBase -Token $token -DM $DM -WebsiteId $WebsiteId `
                -DisplayName $tp.DisplayName `
                -TableLogicalName $tp.Table `
                -Scope $tp.Scope `
                -Read $tp.Read `
                -Create $tp.Create `
                -ParentRelationship $tp.ParentRelationship `
                -ParentPermissionId $incidentPermId
            Write-Host "   [CREATED] $permId" -ForegroundColor Green
        }

        # Associate with web role
        Add-WebRoleToPermission -ApiBase $apiBase -Token $token -DM $DM `
            -PermissionId $permId -WebRoleId $webRoleId
    }
}

# --- Summary ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor White
$settingCount = $webApiSettings.Count
if ($Profile -eq 'dev') { $settingCount += $bearerAuthSettings.Count }
elseif ($Profile -eq 'prod') { $settingCount += 1 }

$permCount = $tablePermissionDefs.Count

if ($DryRun) {
    Write-Host "  DRY RUN complete." -ForegroundColor Yellow
    Write-Host "    $settingCount site settings would be applied." -ForegroundColor Yellow
    Write-Host "    $permCount table permissions would be created." -ForegroundColor Yellow
}
else {
    Write-Host "  Done! $settingCount site settings applied." -ForegroundColor Green
    if ($token) {
        Write-Host "  $permCount table permissions configured." -ForegroundColor Green
    }
}
Write-Host "============================================================" -ForegroundColor White
Write-Host ""

# --- Next steps ---
if (-not $DryRun) {
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Build the SPA:  npm run build" -ForegroundColor White
    Write-Host "  2. Deploy:         pac pages upload-code-site --rootPath ." -ForegroundColor White
    if ($Profile -eq 'dev') {
        Write-Host "  3. Add http://localhost:5173/ as SPA redirect URI in Entra app registration" -ForegroundColor White
        Write-Host "  4. Start dev server: npm run dev" -ForegroundColor White
    }
}
