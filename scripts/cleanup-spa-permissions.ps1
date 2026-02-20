[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory)]
    [string]$TargetWebsiteName,

    [switch]$DryRun
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
        Authorization      = "Bearer $Token"
        Accept             = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }
}

function Get-JsonHeaders {
    param([string]$Token)
    return @{
        Authorization      = "Bearer $Token"
        Accept             = 'application/json'
        'Content-Type'     = 'application/json'
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
    }
}

function Invoke-DvGet {
    param([string]$ApiBase, [hashtable]$Headers, [string]$Path)
    return Invoke-RestMethod -Uri "$ApiBase/$Path" -Headers $Headers -Method Get
}

$apiBase = Get-ApiBase -Url $EnvironmentUrl
$token = Get-Token -Url $EnvironmentUrl
$getHeaders = Get-Headers -Token $token
$jsonHeaders = Get-JsonHeaders -Token $token

$targetSites = Invoke-DvGet -ApiBase $apiBase -Headers $getHeaders -Path "mspp_websites?`$select=mspp_websiteid,mspp_name"
$target = @($targetSites.value | Where-Object { $_.mspp_name -eq $TargetWebsiteName })
if ($target.Count -ne 1) {
    throw "Expected exactly one target website named '$TargetWebsiteName', found $($target.Count)."
}
$targetWebsiteId = $target[0].mspp_websiteid
Write-Host "Target website ID: $targetWebsiteId" -ForegroundColor Cyan

$canonicalByTable = @{
    'incident'       = 'SPA - Case Read/Create (Contact)'
    'annotation'     = 'SPA - Annotation Read/Create (Parent: Case)'
    'activitypointer'= 'SPA - Activity Read (Parent: Case)'
    'contact'        = 'SPA - Contact Read/AppendTo (Self)'
}

$tableList = $canonicalByTable.Keys
$perms = Invoke-DvGet -ApiBase $apiBase -Headers $getHeaders -Path "mspp_entitypermissions?`$filter=_mspp_websiteid_value eq $targetWebsiteId&`$select=mspp_entitypermissionid,mspp_entityname,mspp_entitylogicalname"

$spaPerms = @(
    $perms.value |
        Where-Object {
            $_.mspp_entitylogicalname -in $tableList -and
            $_.mspp_entityname -like 'SPA*'
        }
)

$toDelete = [System.Collections.Generic.List[object]]::new()
$kept = [System.Collections.Generic.List[object]]::new()

foreach ($table in $tableList) {
    $group = @($spaPerms | Where-Object { $_.mspp_entitylogicalname -eq $table })
    if ($group.Count -eq 0) {
        Write-Host "No SPA permission found for table '$table'" -ForegroundColor Yellow
        continue
    }

    $canonicalName = $canonicalByTable[$table]
    $keep = @($group | Where-Object { $_.mspp_entityname -eq $canonicalName } | Select-Object -First 1)

    if ($keep.Count -eq 0) {
        $keep = @($group | Select-Object -First 1)
        Write-Host "Canonical '$canonicalName' not found for '$table'; keeping '$($keep[0].mspp_entityname)'" -ForegroundColor Yellow
    }

    [void]$kept.Add($keep[0])

    foreach ($perm in $group) {
        if ($perm.mspp_entitypermissionid -ne $keep[0].mspp_entitypermissionid) {
            [void]$toDelete.Add($perm)
        }
    }
}

Write-Host "SPA permissions found: $($spaPerms.Count)" -ForegroundColor Gray
Write-Host "SPA permissions kept:  $($kept.Count)" -ForegroundColor Gray
Write-Host "SPA permissions delete: $($toDelete.Count)" -ForegroundColor Gray

if ($toDelete.Count -eq 0) {
    Write-Host 'Nothing to delete.' -ForegroundColor Green
    return
}

foreach ($perm in $toDelete) {
    Write-Host "Removing duplicate SPA permission: $($perm.mspp_entityname) [$($perm.mspp_entitypermissionid)]" -ForegroundColor DarkYellow

    $links = Invoke-DvGet -ApiBase $apiBase -Headers $getHeaders -Path "mspp_entitypermission_webroleset?`$filter=mspp_entitypermissionid eq $($perm.mspp_entitypermissionid)&`$select=mspp_webroleid"
    foreach ($link in $links.value) {
        $roleId = $link.mspp_webroleid
        if ([string]::IsNullOrWhiteSpace($roleId)) {
            continue
        }

        $deleteAssocUri = "$apiBase/mspp_webroles($roleId)/mspp_entitypermission_webrole($($perm.mspp_entitypermissionid))/`$ref"
        if ($DryRun) {
            Write-Host "  [DRYRUN] DELETE association $roleId -> $($perm.mspp_entitypermissionid)" -ForegroundColor Yellow
        }
        else {
            try {
                Invoke-RestMethod -Uri $deleteAssocUri -Headers $jsonHeaders -Method Delete | Out-Null
            }
            catch {
                # Fallback endpoint from permission side
                $fallbackUri = "$apiBase/mspp_entitypermissions($($perm.mspp_entitypermissionid))/mspp_entitypermission_webrole($roleId)/`$ref"
                Invoke-RestMethod -Uri $fallbackUri -Headers $jsonHeaders -Method Delete | Out-Null
            }
        }
    }

    $deletePermUri = "$apiBase/mspp_entitypermissions($($perm.mspp_entitypermissionid))"
    if ($DryRun) {
        Write-Host "  [DRYRUN] DELETE permission $($perm.mspp_entitypermissionid)" -ForegroundColor Yellow
    }
    else {
        Invoke-RestMethod -Uri $deletePermUri -Headers $jsonHeaders -Method Delete | Out-Null
        Write-Host '  [DELETED]' -ForegroundColor Green
    }
}

Write-Host 'Cleanup complete.' -ForegroundColor Green
