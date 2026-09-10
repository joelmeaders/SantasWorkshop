# Self-contained fixture test: gh is shadowed; this never contacts GitHub or writes a real secret.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$previousExitCode = 0
if (Test-Path variable:LASTEXITCODE) { $previousExitCode = $LASTEXITCODE }
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
$names = @('TEST_FIREBASE_API_KEY', 'PROD_FIREBASE_API_KEY', 'TEST_AWS_ACCESS_KEY_ID',
    'TEST_AWS_SECRET_ACCESS_KEY', 'PROD_AWS_ACCESS_KEY_ID', 'PROD_AWS_SECRET_ACCESS_KEY',
    'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST', 'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5')
$global:secretWrites = @{}
$global:failSecretWrite = $false
function global:gh {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'repo') { return 'fixture/santashop' }
    if ($args[0] -eq 'secret') {
        if ($args -contains '--body') { throw 'Secret must not be passed in argv.' }
        if ($args[3] -ne '--repo' -or $args[4] -ne 'fixture/santashop') { throw 'Missing explicit repository.' }
        $global:secretWrites[$args[2]] = ($input | Out-String).TrimEnd("`r", "`n")
        if ($global:failSecretWrite) { $global:LASTEXITCODE = 1 }
    }
}
function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
try {
    $valid = $names | ForEach-Object { "$_='SENTINEL-$_'" }
    Set-Content -LiteralPath $fixture -Value $valid
    $output = (& "$PSScriptRoot/github-secrets.ps1" -EnvFilePath $fixture -WhatIf 6>&1 | Out-String)
    Assert-True ($global:secretWrites.Count -eq 0) 'WhatIf wrote a secret.'
    Assert-True (-not $output.Contains('SENTINEL')) 'WhatIf disclosed a value.'
    $output = (& "$PSScriptRoot/github-secrets.ps1" -EnvFilePath $fixture 6>&1 | Out-String)
    Assert-True ($global:secretWrites.Count -eq 8) 'Expected eight scoped secrets.'
    foreach ($name in $names) { Assert-True ($global:secretWrites[$name] -eq "SENTINEL-$name") 'Incorrect value or quoting.' }
    Assert-True (-not $output.Contains('SENTINEL')) 'Success output disclosed a value.'

    $global:secretWrites.Clear()
    Set-Content -LiteralPath $fixture -Value (($valid | Where-Object { -not $_.StartsWith('TEST_AWS_ACCESS_KEY_ID=') }) + 'AWS_ACCESS_KEY_ID=SENTINEL-unscoped')
    $errorText = ''
    try { & "$PSScriptRoot/github-secrets.ps1" -EnvFilePath $fixture } catch { $errorText = $_.ToString() }
    Assert-True ($errorText.Contains('TEST_AWS_ACCESS_KEY_ID')) 'Missing scoped key was not rejected.'
    Assert-True ($global:secretWrites.Count -eq 0) 'Validation failed after writing secrets.'
    Assert-True (-not $errorText.Contains('SENTINEL')) 'Validation error disclosed a value.'

    Set-Content -LiteralPath $fixture -Value $valid
    $global:failSecretWrite = $true
    $errorText = ''
    try { & "$PSScriptRoot/github-secrets.ps1" -EnvFilePath $fixture 6>&1 | Out-Null } catch { $errorText = $_.ToString() }
    Assert-True ($errorText.Contains('Failed to set GitHub secret')) 'Write failure was not surfaced.'
    Assert-True (-not $errorText.Contains('SENTINEL')) 'Write failure disclosed a value.'
    Write-Host 'Secret synchronization fixture checks passed (no network writes).'
} finally {
    Remove-Item -LiteralPath $fixture -ErrorAction SilentlyContinue
    Remove-Item Function:\gh
    Remove-Variable secretWrites, failSecretWrite -Scope Global
    # Expected native failures must not leak into the caller's PowerShell exit status.
    $global:LASTEXITCODE = $previousExitCode
}
