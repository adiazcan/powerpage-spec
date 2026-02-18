<#
.SYNOPSIS
    Creates a new Power Pages website via the Power Platform Admin API.

.PARAMETER SiteName
    Display name for the new website.

.PARAMETER Subdomain
    Subdomain for the website URL (e.g., "test-adiazcan" → test-adiazcan.powerappsportals.com).

.PARAMETER TemplateName
    Website template. Known values: "CustomerPortal", "PowerPages_BlankTemplate_V2", "Default Portal Template", "Power Portals_Program Registration", "Power Portals_Book Meeting".

.PARAMETER Language
    LCID for the base language. Default: 1033 (English). Spanish (Spain): 3082.

.PARAMETER EnvironmentId
    Power Platform environment ID. If omitted, auto-detected from PAC CLI.

.PARAMETER OrgId
    Dataverse organization ID. If omitted, auto-detected from PAC CLI.

.PARAMETER PollInterval
    Seconds between status polls while waiting for provisioning. Default: 30.

.PARAMETER MaxWaitMinutes
    Maximum minutes to wait for provisioning. Default: 15.

.EXAMPLE
    .\create-site.ps1 -SiteName "test-adiazcan" -Subdomain "test-adiazcan"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteName,

    [Parameter(Mandatory = $true)]
    [string]$Subdomain,

    [string]$TemplateName = "CustomerPortal",

    [int]$Language = 1033,

    [string]$EnvironmentId,

    [string]$OrgId,

    [int]$PollInterval = 30,

    [int]$MaxWaitMinutes = 15
)

$ErrorActionPreference = "Stop"

# ── Helper: Get PAC org info ──────────────────────────────────────────────
function Get-PacOrgInfo {
    $output = pac org who 2>&1 | Out-String
    $info = @{}
    if ($output -match "Org ID:\s+(.+)") { $info.OrgId = $Matches[1].Trim() }
    if ($output -match "Environment ID:\s+(.+)") { $info.EnvironmentId = $Matches[1].Trim() }
    if ($output -match "Friendly Name:\s+(.+)") { $info.FriendlyName = $Matches[1].Trim() }
    if ($output -match "Org URL:\s+(.+)") { $info.OrgUrl = $Matches[1].Trim() }
    return $info
}

# ── Helper: Get access token for Power Platform API ───────────────────────
function Get-PowerPlatformToken {
    try {
        $token = az account get-access-token --resource "https://api.powerplatform.com" --query accessToken -o tsv 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Azure CLI failed: $token" }
        return $token
    }
    catch {
        throw "Failed to get Power Platform API token. Make sure you're logged in with: az login"
    }
}

# ── Resolve environment and org IDs ──────────────────────────────────────
Write-Host "`n=== Power Pages Site Creation ===" -ForegroundColor Cyan

$orgInfo = Get-PacOrgInfo
Write-Host "Connected to: $($orgInfo.FriendlyName) ($($orgInfo.OrgUrl))"

if (-not $EnvironmentId) {
    $EnvironmentId = $orgInfo.EnvironmentId
    if (-not $EnvironmentId) { throw "Could not detect Environment ID. Provide -EnvironmentId." }
}

if (-not $OrgId) {
    $OrgId = $orgInfo.OrgId
    if (-not $OrgId) { throw "Could not detect Org ID. Provide -OrgId." }
}

Write-Host "Environment ID : $EnvironmentId"
Write-Host "Org ID         : $OrgId"
Write-Host "Site Name      : $SiteName"
Write-Host "Subdomain      : $Subdomain"
Write-Host "Template       : $TemplateName"
Write-Host "Language       : $Language"

# ── Get token ─────────────────────────────────────────────────────────────
Write-Host "`nAcquiring Power Platform API token..." -ForegroundColor Yellow
$token = Get-PowerPlatformToken
Write-Host "Token acquired." -ForegroundColor Green

$headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
    Accept         = "application/json"
}

# ── Check if subdomain is already taken ───────────────────────────────────
Write-Host "`nChecking existing sites in environment..." -ForegroundColor Yellow
$listUri = "https://api.powerplatform.com/powerpages/environments/$EnvironmentId/websites?api-version=2022-03-01-preview"
try {
    $existing = Invoke-RestMethod -Uri $listUri -Headers $headers -Method Get
    $existingSite = $existing.value | Where-Object { $_.name -eq $SiteName -or $_.subdomain -eq $Subdomain }
    if ($existingSite) {
        Write-Host "`nSite already exists!" -ForegroundColor Yellow
        Write-Host "  Name      : $($existingSite.name)"
        Write-Host "  ID        : $($existingSite.id)"
        Write-Host "  URL       : $($existingSite.siteUrl)"
        Write-Host "  State     : $($existingSite.status)"
        Write-Host "  Website ID: $($existingSite.websiteRecordId)"
        Write-Host "`nNo action taken." -ForegroundColor Yellow
        return
    }
}
catch {
    Write-Warning "Could not list existing sites: $($_.Exception.Message). Proceeding with creation."
}

# ── Create the site ───────────────────────────────────────────────────────
Write-Host "`nCreating site '$SiteName'..." -ForegroundColor Yellow

$body = @{
    name                    = $SiteName
    subdomain               = $Subdomain
    templateName            = $TemplateName
    selectedBaseLanguage    = $Language
    dataverseOrganizationId = $OrgId
} | ConvertTo-Json

$createUri = "https://api.powerplatform.com/powerpages/environments/$EnvironmentId/websites?api-version=2022-03-01-preview"

try {
    $response = Invoke-WebRequest -Uri $createUri -Headers $headers -Method Post -Body $body -UseBasicParsing
}
catch {
    $errBody = $_.ErrorDetails.Message
    Write-Host "Error creating site:" -ForegroundColor Red
    Write-Host $errBody
    throw
}

if ($response.StatusCode -eq 202) {
    Write-Host "Site creation accepted (202)." -ForegroundColor Green

    # Get the Operation-Location header for polling
    $operationUrl = $response.Headers["Operation-Location"]
    if ($operationUrl -is [array]) { $operationUrl = $operationUrl[0] }

    # Ensure api-version query param is present (the header often omits it)
    if ($operationUrl -and $operationUrl -notmatch 'api-version') {
        $separator = if ($operationUrl.Contains('?')) { '&' } else { '?' }
        $operationUrl = "$operationUrl${separator}api-version=2022-03-01-preview"
    }

    if ($operationUrl) {
        Write-Host "Polling provisioning status..."
        Write-Host "Operation URL: $operationUrl"

        $deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
        $provisioned = $false

        while (-not $provisioned -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds $PollInterval
            try {
                # Refresh token in case it expires during long polling
                $token = Get-PowerPlatformToken
                $headers.Authorization = "Bearer $token"

                $pollResult = Invoke-RestMethod -Uri $operationUrl -Headers $headers -Method Get
                $opStatus = $pollResult.operationStatus
                $pkgStatus = $pollResult.packageInstallStatus
                $siteStatus = $pollResult.status
                Write-Host "  Operation: $opStatus | Package: $pkgStatus | Site: $siteStatus ($(Get-Date -Format 'HH:mm:ss'))"

                if ($pkgStatus -eq "Installed" -and ($opStatus -eq "OperationComplete" -or $siteStatus -eq "StateConfigured" -or $siteStatus -eq "OperationComplete")) {
                    $provisioned = $true
                }
            }
            catch {
                Write-Warning "Poll failed: $($_.Exception.Message). Retrying..."
            }
        }

        if ($provisioned) {
            Write-Host "`nSite provisioned and packages installed!" -ForegroundColor Green
        }
        else {
            Write-Host "`nProvisioning not yet complete after $MaxWaitMinutes minutes." -ForegroundColor Yellow
            Write-Host "Current state: Operation=$($opStatus), Package=$($pkgStatus)"
            Write-Host "Check status at: https://make.powerpages.microsoft.com/"
        }
    }
    else {
        Write-Host "No Operation-Location header. Check provisioning at: https://make.powerpages.microsoft.com/"
    }
}
else {
    Write-Host "Unexpected response: $($response.StatusCode)" -ForegroundColor Yellow
    Write-Host $response.Content
}

# ── List sites to confirm ────────────────────────────────────────────────
Write-Host "`nListing sites in environment..." -ForegroundColor Yellow
Start-Sleep -Seconds 5  # Brief pause to let the listing update

# Refresh token in case it expired during polling
$token = Get-PowerPlatformToken
$headers.Authorization = "Bearer $token"

try {
    $sites = Invoke-RestMethod -Uri $listUri -Headers $headers -Method Get
    Write-Host "`nAll Power Pages sites:" -ForegroundColor Cyan
    foreach ($site in $sites.value) {
        $marker = if ($site.name -eq $SiteName) { " ← NEW" } else { "" }
        Write-Host "  [$($site.status)] $($site.name) - $($site.siteUrl)$marker"
    }

    $newSite = $sites.value | Where-Object { $_.name -eq $SiteName }
    if ($newSite) {
        Write-Host "`n=== New Site Details ===" -ForegroundColor Green
        Write-Host "  Name        : $($newSite.name)"
        Write-Host "  Site URL    : $($newSite.siteUrl)"
        Write-Host "  Website ID  : $($newSite.websiteRecordId)"
        Write-Host "  Status      : $($newSite.status)"
        Write-Host "`nUse this Website ID with configure-environment.ps1:"
        Write-Host "  .\configure-environment.ps1 -EnvironmentUrl '$($orgInfo.OrgUrl)' -WebsiteId '$($newSite.websiteRecordId)' -SkipAuth" -ForegroundColor Yellow
    }
}
catch {
    Write-Warning "Could not list sites: $($_.Exception.Message)"
    Write-Host "Check Power Pages maker portal: https://make.powerpages.microsoft.com/"
}

Write-Host "`nDone!" -ForegroundColor Cyan
