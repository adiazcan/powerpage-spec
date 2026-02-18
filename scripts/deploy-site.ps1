<#
.SYNOPSIS
    Builds and deploys the Customer Self-Service SPA to a Power Pages site.

.DESCRIPTION
    Runs the following steps:
    1. npm run build  — TypeScript compile + Vite bundle → dist/
    2. pac pages upload-code-site — uploads dist/ to the target Power Pages site
    3. (Optional) pac pages list — confirms the site URL

.PARAMETER EnvironmentUrl
    The Dataverse environment URL (e.g. https://iabp.crm4.dynamics.com/).
    If omitted, uses the currently active PAC CLI environment.

.PARAMETER WebsiteId
    The Power Pages website record GUID. Run 'pac pages list' to find it.
    If omitted, PAC CLI will infer it from powerpages.config.json if there is only one site.

.PARAMETER SkipBuild
    Skip the npm build step (deploy the existing dist/ folder as-is).

.PARAMETER SkipAuth
    Skip PAC CLI authentication (use if already authenticated).

.EXAMPLE
    .\deploy-site.ps1

.EXAMPLE
    .\deploy-site.ps1 -EnvironmentUrl "https://iabp.crm4.dynamics.com/" -WebsiteId "bbd7c2be-713a-4242-a561-4f8c3df8acce"

.EXAMPLE
    .\deploy-site.ps1 -SkipBuild
#>

[CmdletBinding()]
param(
    [string]$EnvironmentUrl,

    [ValidatePattern('^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')]
    [string]$WebsiteId,

    [string]$SiteName,

    [switch]$SkipBuild,

    [switch]$SkipAuth
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootPath = Split-Path $PSScriptRoot -Parent
$DistPath = Join-Path $RootPath 'dist'

function Write-Step {
    param([string]$Message)
    Write-Host "`n>> $Message" -ForegroundColor Cyan
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

Write-Host "============================================================" -ForegroundColor White
Write-Host "  Power Pages SPA Deploy" -ForegroundColor White
if ($EnvironmentUrl) {
    Write-Host "  Environment: $EnvironmentUrl" -ForegroundColor White
}
if ($WebsiteId) {
    Write-Host "  Website ID:  $WebsiteId" -ForegroundColor White
}
Write-Host "  Root path:   $RootPath" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White

# --- Verify PAC CLI ---
$pacCmd = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pacCmd) {
    Write-Error "PAC CLI not found. Install it: https://learn.microsoft.com/power-platform/developer/cli/introduction"
}

# --- Authenticate ---
if (-not $SkipAuth -and $EnvironmentUrl) {
    Write-Step "Authenticating to $EnvironmentUrl..."
    Invoke-PacCommand @('auth', 'create', '-u', $EnvironmentUrl) | Out-Null
}
elseif ($EnvironmentUrl) {
    Write-Step "Selecting environment $EnvironmentUrl..."
    Invoke-PacCommand @('org', 'select', '--environment', $EnvironmentUrl) | Out-Null
}

# --- Build ---
if (-not $SkipBuild) {
    Write-Step "Building SPA (npm run build)..."
    Push-Location $RootPath
    try {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "npm not found. Make sure Node.js is installed and on PATH."
    }
    npm install --prefer-offline --no-audit --no-fund 2>&1 | Out-Null
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm run build failed (exit $LASTEXITCODE)"
    }
    }
    finally {
        Pop-Location
    }
    Write-Host "   Build complete." -ForegroundColor Green
}
else {
    Write-Host "`n>> Skipping build (--SkipBuild)" -ForegroundColor Yellow
}

# --- Verify dist exists ---
if (-not (Test-Path $DistPath)) {
    Write-Error "dist/ folder not found at '$DistPath'. Run without -SkipBuild or run 'npm run build' first."
}

# --- Upload ---
Write-Step "Uploading to Power Pages..."
$uploadArgs = @('pages', 'upload-code-site', '--rootPath', $RootPath)
if ($SiteName) {
    $uploadArgs += @('--siteName', $SiteName)
}
Invoke-PacCommand $uploadArgs | ForEach-Object { Write-Host "   $_" }
Write-Host "   Upload complete." -ForegroundColor Green

# --- Report ---
Write-Step "Listing site..."
$listOutput = & pac pages list 2>&1
$listOutput | ForEach-Object { Write-Host "   $_" }

Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor White
