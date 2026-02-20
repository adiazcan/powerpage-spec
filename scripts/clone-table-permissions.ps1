[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [string]$SourceWebsiteName,

    [Parameter(Mandatory)]
    [string]$TargetWebsiteName,

    [switch]$SkipRoleAssociations
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ApiBase {
    param([string]$Url)
    return "$($Url.TrimEnd('/'))/api/data/v9.2"
}

function Get-Token {
    param([string]$Url)
    $resource = $Url.TrimEnd('/')
    $token = (az account get-access-token --resource $resource | ConvertFrom-Json).accessToken
    if (-not $token) {
        throw 'Unable to acquire token via Azure CLI. Run az login first.'
    }
    return $token
}

function Get-Headers {
    param([string]$Token)
    return @{
        Authorization    = "Bearer $Token"
        Accept           = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }
}

function Get-JsonHeaders {
    param([string]$Token)
    return @{
        Authorization    = "Bearer $Token"
        Accept           = 'application/json'
        'Content-Type'   = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        Prefer           = 'return=representation'
    }
}

function Invoke-DvGet {
    param([string]$ApiBase, [hashtable]$Headers, [string]$Path)
    return Invoke-RestMethod -Uri "$ApiBase/$Path" -Headers $Headers -Method Get
}

function Invoke-DvPost {
    param([string]$ApiBase, [hashtable]$Headers, [string]$Path, [hashtable]$Body)
    $json = $Body | ConvertTo-Json -Depth 12
    return Invoke-RestMethod -Uri "$ApiBase/$Path" -Headers $Headers -Method Post -Body $json
}

function Resolve-Websites {
    param([string]$ApiBase, [hashtable]$Headers, [string]$SourceName, [string]$TargetName)

    $source = Invoke-DvGet -ApiBase $ApiBase -Headers $Headers -Path "adx_websites?`$select=adx_websiteid,adx_name"
    $target = Invoke-DvGet -ApiBase $ApiBase -Headers $Headers -Path "mspp_websites?`$select=mspp_websiteid,mspp_name"

    $sourceMatch = @($source.value | Where-Object { $_.adx_name -eq $SourceName })
    if ($sourceMatch.Count -ne 1) {
        throw "Expected exactly one source adx website named '$SourceName', found $($sourceMatch.Count)."
    }

    $targetMatch = @($target.value | Where-Object { $_.mspp_name -eq $TargetName })
    if ($targetMatch.Count -ne 1) {
        throw "Expected exactly one target mspp website named '$TargetName', found $($targetMatch.Count)."
    }

    return @{
        SourceId = $sourceMatch[0].adx_websiteid
        TargetId = $targetMatch[0].mspp_websiteid
    }
}

$apiBase = Get-ApiBase -Url $EnvironmentUrl
$token = Get-Token -Url $EnvironmentUrl
$getHeaders = Get-Headers -Token $token
$jsonHeaders = Get-JsonHeaders -Token $token

$sites = Resolve-Websites -ApiBase $apiBase -Headers $getHeaders -SourceName $SourceWebsiteName -TargetName $TargetWebsiteName
$sourceWebsiteId = $sites.SourceId
$targetWebsiteId = $sites.TargetId

Write-Host "Source website ID: $sourceWebsiteId" -ForegroundColor Cyan
Write-Host "Target website ID: $targetWebsiteId" -ForegroundColor Cyan

$sourcePerms = Invoke-DvGet -ApiBase $apiBase -Headers $getHeaders -Path "adx_entitypermissions?`$filter=_adx_websiteid_value eq $sourceWebsiteId&`$select=adx_entitypermissionid,adx_entityname,adx_entitylogicalname,adx_scope,adx_read,adx_create,adx_write,adx_delete,adx_append,adx_appendto,adx_contactrelationship,adx_parentrelationship,_adx_parententitypermission_value&`$expand=adx_entitypermission_webrole(`$select=adx_webroleid,adx_name)"
if (-not $sourcePerms.value -or $sourcePerms.value.Count -eq 0) {
    throw 'No source table permissions found.'
}

$targetPerms = Invoke-DvGet -ApiBase $apiBase -Headers $getHeaders -Path "mspp_entitypermissions?`$filter=_mspp_websiteid_value eq $targetWebsiteId&`$select=mspp_entitypermissionid,mspp_entityname"
$targetPermByName = @{}
foreach ($perm in $targetPerms.value) {
    if (-not $targetPermByName.ContainsKey($perm.mspp_entityname)) {
        $targetPermByName[$perm.mspp_entityname] = $perm.mspp_entitypermissionid
    }
}

$sourceToTarget = @{}
$pending = [System.Collections.Generic.List[object]]::new()
$sourcePerms.value | ForEach-Object { [void]$pending.Add($_) }
$createdCount = 0
$reusedCount = 0

while ($pending.Count -gt 0) {
    $progress = $false

    foreach ($perm in @($pending)) {
        $sourceId = $perm.adx_entitypermissionid

        if ($sourceToTarget.ContainsKey($sourceId)) {
            [void]$pending.Remove($perm)
            $progress = $true
            continue
        }

        $parentSourceId = $perm._adx_parententitypermission_value
        $hasParent = -not [string]::IsNullOrWhiteSpace($parentSourceId)
        if ($hasParent -and -not $sourceToTarget.ContainsKey($parentSourceId)) {
            continue
        }

        if ($targetPermByName.ContainsKey($perm.adx_entityname)) {
            $sourceToTarget[$sourceId] = $targetPermByName[$perm.adx_entityname]
            $reusedCount++
            [void]$pending.Remove($perm)
            $progress = $true
            continue
        }

        $body = @{
            mspp_entityname               = $perm.adx_entityname
            mspp_entitylogicalname        = $perm.adx_entitylogicalname
            mspp_scope                    = $perm.adx_scope
            mspp_read                     = [bool]$perm.adx_read
            mspp_create                   = [bool]$perm.adx_create
            mspp_write                    = [bool]$perm.adx_write
            mspp_delete                   = [bool]$perm.adx_delete
            mspp_append                   = [bool]$perm.adx_append
            mspp_appendto                 = [bool]$perm.adx_appendto
            'mspp_websiteid@odata.bind' = "/mspp_websites($targetWebsiteId)"
        }

        if (-not [string]::IsNullOrWhiteSpace($perm.adx_contactrelationship)) {
            $body.mspp_contactrelationship = $perm.adx_contactrelationship
        }

        if (-not [string]::IsNullOrWhiteSpace($perm.adx_parentrelationship)) {
            $body.mspp_parentrelationship = $perm.adx_parentrelationship
        }

        if ($hasParent) {
            $targetParentId = $sourceToTarget[$parentSourceId]
            $body['mspp_parententitypermission@odata.bind'] = "/mspp_entitypermissions($targetParentId)"
        }

        $created = Invoke-DvPost -ApiBase $apiBase -Headers $jsonHeaders -Path 'mspp_entitypermissions' -Body $body
        $targetId = $created.mspp_entitypermissionid
        if ([string]::IsNullOrWhiteSpace($targetId)) {
            throw "Create returned no mspp_entitypermissionid for '$($perm.adx_entityname)'."
        }

        $sourceToTarget[$sourceId] = $targetId
        $targetPermByName[$perm.adx_entityname] = $targetId
        $createdCount++
        [void]$pending.Remove($perm)
        $progress = $true
    }

    if (-not $progress) {
        $blocked = $pending | Select-Object -ExpandProperty adx_entityname
        throw "Could not resolve parent dependencies for: $($blocked -join '; ')"
    }
}

$roleCreatedCount = 0
$assocCreatedCount = 0
$assocFailedCount = 0

if (-not $SkipRoleAssociations) {
    $targetRoles = Invoke-DvGet -ApiBase $apiBase -Headers $getHeaders -Path "mspp_webroles?`$filter=_mspp_websiteid_value eq $targetWebsiteId&`$select=mspp_webroleid,mspp_name"
    $targetRoleByName = @{}
    foreach ($role in $targetRoles.value) {
        if (-not $targetRoleByName.ContainsKey($role.mspp_name)) {
            $targetRoleByName[$role.mspp_name] = $role.mspp_webroleid
        }
    }

    foreach ($sourcePerm in $sourcePerms.value) {
        $targetPermId = $sourceToTarget[$sourcePerm.adx_entitypermissionid]
        $sourceRoles = @($sourcePerm.adx_entitypermission_webrole)

        foreach ($sourceRole in $sourceRoles) {
            $roleName = $sourceRole.adx_name
            if ([string]::IsNullOrWhiteSpace($roleName)) {
                continue
            }

            if (-not $targetRoleByName.ContainsKey($roleName)) {
                $roleBody = @{
                    mspp_name                 = $roleName
                    'mspp_websiteid@odata.bind' = "/mspp_websites($targetWebsiteId)"
                }
                if ($roleName -eq 'Authenticated Users') { $roleBody.mspp_authenticatedusersrole = $true }
                if ($roleName -eq 'Anonymous Users') { $roleBody.mspp_anonymoususersrole = $true }

                $createdRole = Invoke-DvPost -ApiBase $apiBase -Headers $jsonHeaders -Path 'mspp_webroles' -Body $roleBody
                $targetRoleByName[$roleName] = $createdRole.mspp_webroleid
                $roleCreatedCount++
            }

            $roleId = $targetRoleByName[$roleName]
            $assocPath = "mspp_entitypermissions($targetPermId)/mspp_entitypermission_webrole/`$ref"
            $assocBody = @{ '@odata.id' = "$apiBase/mspp_webroles($roleId)" }

            try {
                Invoke-DvPost -ApiBase $apiBase -Headers $jsonHeaders -Path $assocPath -Body $assocBody | Out-Null
                $assocCreatedCount++
            }
            catch {
                $err = $_.Exception.Message
                if ($err -match 'already exists|duplicate|0x80040237') {
                    continue
                }
                $assocFailedCount++
                Write-Host "Association failed: permission '$($sourcePerm.adx_entityname)' -> role '$roleName'" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host ''
Write-Host 'Clone complete.' -ForegroundColor Green
Write-Host "Source permissions:            $($sourcePerms.value.Count)" -ForegroundColor Gray
Write-Host "Created permissions:           $createdCount" -ForegroundColor Gray
Write-Host "Reused existing permissions:   $reusedCount" -ForegroundColor Gray
Write-Host "Created roles:                 $roleCreatedCount" -ForegroundColor Gray
Write-Host "Created role associations:     $assocCreatedCount" -ForegroundColor Gray
Write-Host "Failed role associations:      $assocFailedCount" -ForegroundColor Gray
