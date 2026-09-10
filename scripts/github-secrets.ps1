[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$EnvFilePath = (Join-Path $PSScriptRoot '..\.env'))

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

# Both deployed environments use SES. Never fall back to unscoped AWS values.
$secretNames = @(
    'TEST_FIREBASE_API_KEY', 'PROD_FIREBASE_API_KEY',
    'TEST_AWS_ACCESS_KEY_ID', 'TEST_AWS_SECRET_ACCESS_KEY',
    'PROD_AWS_ACCESS_KEY_ID', 'PROD_AWS_SECRET_ACCESS_KEY',
    'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST',
    'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5'
)
$values = @{}
foreach ($rawLine in Get-Content -LiteralPath $EnvFilePath) {
    if ($rawLine.Trim() -notmatch '^([A-Za-z_]\w*)=(.*)$') { continue }
    $name, $value = $Matches[1], $Matches[2].Trim()
    if ($name -notin $secretNames) { continue }
    if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
}
# Validate all input before changing even one secret. Report names, never values.
foreach ($name in $secretNames) {
    if ([string]::IsNullOrWhiteSpace($values[$name])) { throw "Missing required scoped value: $name" }
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is required.' }
& gh auth status 1>$null 2>$null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated. Run gh auth login.' }
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $repo = & gh repo view --json nameWithOwner --jq .nameWithOwner 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repo)) { throw 'Cannot resolve the repository.' }
} finally { Pop-Location }
Write-Host "Using GitHub repository: $repo"
foreach ($name in $secretNames) {
    if ($PSCmdlet.ShouldProcess("$repo / $name", 'Set GitHub Actions secret')) {
        # gh reads stdin and removes the pipeline's trailing CR/LF. Values never enter argv or diagnostics.
        $values[$name] | & gh secret set $name --repo $repo 1>$null 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Failed to set GitHub secret $name. No secret value is included in this error." }
        Write-Host "Set GitHub Actions secret: $name"
    }
}
