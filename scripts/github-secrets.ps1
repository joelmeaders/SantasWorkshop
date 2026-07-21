[CmdletBinding(SupportsShouldProcess = $true)]
param(
	[string]$EnvFilePath = (Join-Path $PSScriptRoot '..\.env')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedEnvFilePath = [System.IO.Path]::GetFullPath($EnvFilePath)

$requiredSecretMappings = @(
	@{ SecretName = 'TEST_FIREBASE_API_KEY'; EnvKey = 'TEST_FIREBASE_API_KEY' },
	@{ SecretName = 'PROD_FIREBASE_API_KEY'; EnvKey = 'PROD_FIREBASE_API_KEY' },
	@{ SecretName = 'TEST_AWS_ACCESS_KEY_ID'; EnvKey = 'TEST_AWS_ACCESS_KEY_ID'; FallbackKey = 'AWS_ACCESS_KEY_ID' },
	@{ SecretName = 'TEST_AWS_SECRET_ACCESS_KEY'; EnvKey = 'TEST_AWS_SECRET_ACCESS_KEY'; FallbackKey = 'AWS_SECRET_ACCESS_KEY' },
	@{ SecretName = 'TEST_ADMIN_BOOTSTRAP_PASSWORD'; EnvKey = 'TEST_ADMIN_BOOTSTRAP_PASSWORD'; FallbackKey = 'ADMIN_BOOTSTRAP_PASSWORD' },
	@{ SecretName = 'PROD_AWS_ACCESS_KEY_ID'; EnvKey = 'PROD_AWS_ACCESS_KEY_ID'; FallbackKey = 'AWS_ACCESS_KEY_ID' },
	@{ SecretName = 'PROD_AWS_SECRET_ACCESS_KEY'; EnvKey = 'PROD_AWS_SECRET_ACCESS_KEY'; FallbackKey = 'AWS_SECRET_ACCESS_KEY' },
	@{ SecretName = 'PROD_ADMIN_BOOTSTRAP_PASSWORD'; EnvKey = 'PROD_ADMIN_BOOTSTRAP_PASSWORD'; FallbackKey = 'ADMIN_BOOTSTRAP_PASSWORD' }
)

$optionalSecretMappings = @(
	@{ SecretName = 'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST'; EnvKey = 'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_TEST' },
	@{ SecretName = 'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5'; EnvKey = 'FIREBASE_SERVICE_ACCOUNT_SANTAS_WORKSHOP_193B5' }
)

function Get-UnquotedValue {
	param([Parameter(Mandatory = $true)][string]$Value)

	if ($Value.Length -ge 2) {
		$first = $Value[0]
		$last = $Value[$Value.Length - 1]
		if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
			return $Value.Substring(1, $Value.Length - 2)
		}
	}

	return $Value
}

function Read-EnvFile {
	param([Parameter(Mandatory = $true)][string]$FilePath)

	if (-not (Test-Path -LiteralPath $FilePath)) {
		throw "Environment file not found: $FilePath"
	}

	$values = @{}
	foreach ($rawLine in Get-Content -LiteralPath $FilePath) {
		$line = $rawLine.Trim()
		if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
			continue
		}

		$match = [regex]::Match($line, '^(?<key>[A-Za-z_]\w*)=(?<value>.*)$')
		if (-not $match.Success) {
			continue
		}

		$key = $match.Groups['key'].Value
		$value = Get-UnquotedValue -Value $match.Groups['value'].Value.Trim()
		$values[$key] = $value
	}

	return $values
}

function Resolve-SecretValue {
	param(
		[Parameter(Mandatory = $true)][hashtable]$EnvValues,
		[Parameter(Mandatory = $true)][hashtable]$Mapping,
		[switch]$Required
	)

	$primaryKey = [string]$Mapping.EnvKey
	if ($EnvValues.ContainsKey($primaryKey) -and -not [string]::IsNullOrWhiteSpace($EnvValues[$primaryKey])) {
		return [string]$EnvValues[$primaryKey]
	}

	if ($Mapping.ContainsKey('FallbackKey')) {
		$fallbackKey = [string]$Mapping.FallbackKey
		if ($EnvValues.ContainsKey($fallbackKey) -and -not [string]::IsNullOrWhiteSpace($EnvValues[$fallbackKey])) {
			return [string]$EnvValues[$fallbackKey]
		}
	}

	if ($Required.IsPresent) {
		throw "Missing required value for GitHub secret $($Mapping.SecretName). Checked keys: $($Mapping.EnvKey)$([string]::IsNullOrWhiteSpace($Mapping.FallbackKey) ? '' : ", $($Mapping.FallbackKey)")"
	}

	return $null
}

function Invoke-GitHubCli {
	param(
		[Parameter(Mandatory = $true)][string[]]$Arguments,
		[switch]$CaptureOutput
	)

	$command = Get-Command gh -ErrorAction SilentlyContinue
	if (-not $command) {
		throw 'GitHub CLI (`gh`) is not installed or not on PATH.'
	}

	$commandName = $command.Source
	$displayCommand = '{0} {1}' -f $commandName, ($Arguments -join ' ')

	if ($CaptureOutput.IsPresent) {
		$previousPreference = $ErrorActionPreference
		$ErrorActionPreference = 'Continue'
		try {
			$output = & $commandName @Arguments 2>&1
			$exitCode = $LASTEXITCODE
		} finally {
			$ErrorActionPreference = $previousPreference
		}

		if ($exitCode -ne 0) {
			throw "Command failed with exit code ${exitCode}: $displayCommand`n$($output -join [Environment]::NewLine)"
		}

		return ($output -join [Environment]::NewLine).TrimEnd()
	}

	& $commandName @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "Command failed with exit code ${LASTEXITCODE}: $displayCommand"
	}
}

function Assert-GitHubReady {
	$authStatus = Invoke-GitHubCli -Arguments @('auth', 'status') -CaptureOutput
	if ([string]::IsNullOrWhiteSpace($authStatus)) {
		throw 'GitHub CLI is not authenticated. Run `gh auth login` first.'
	}

	$repoName = Invoke-GitHubCli -Arguments @('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner') -CaptureOutput
	if ([string]::IsNullOrWhiteSpace($repoName)) {
		throw 'Unable to determine the current GitHub repository. Run the script from the repo root or ensure `gh` can resolve the current repo.'
	}

	Write-Host ("Using GitHub repository: {0}" -f $repoName)
}

function Set-GitHubSecret {
	param(
		[Parameter(Mandatory = $true)][string]$SecretName,
		[Parameter(Mandatory = $true)][string]$SecretValue
	)

	if ($PSCmdlet.ShouldProcess($SecretName, 'Set GitHub Actions secret')) {
		Invoke-GitHubCli -Arguments @('secret', 'set', $SecretName, '--body', $SecretValue)
		Write-Host ("Set GitHub Actions secret: {0}" -f $SecretName)
	}
}

Assert-GitHubReady
$envValues = Read-EnvFile -FilePath $resolvedEnvFilePath

foreach ($mapping in $requiredSecretMappings) {
	$value = Resolve-SecretValue -EnvValues $envValues -Mapping $mapping -Required
	Set-GitHubSecret -SecretName $mapping.SecretName -SecretValue $value
}

foreach ($mapping in $optionalSecretMappings) {
	$value = Resolve-SecretValue -EnvValues $envValues -Mapping $mapping
	if (-not [string]::IsNullOrWhiteSpace($value)) {
		Set-GitHubSecret -SecretName $mapping.SecretName -SecretValue $value
	} else {
		Write-Host ("Skipped optional GitHub Actions secret: {0}" -f $mapping.SecretName)
	}
}
