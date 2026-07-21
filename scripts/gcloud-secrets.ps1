[CmdletBinding(SupportsShouldProcess = $true)]
param(
	[ValidateSet('all', 'test', 'prod')]
	[string]$Environment = 'all',
	[string]$EnvFilePath = (Join-Path $PSScriptRoot '..\.env')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedEnvFilePath = [System.IO.Path]::GetFullPath($EnvFilePath)

$firebaseEnvKeys = @(
	'FIREBASE_API_KEY',
	'FIREBASE_AUTH_DOMAIN',
	'FIREBASE_DATABASE_URL',
	'FIREBASE_PROJECT_ID',
	'FIREBASE_STORAGE_BUCKET',
	'FIREBASE_MESSAGING_SENDER_ID',
	'FIREBASE_APP_ID',
	'FIREBASE_MEASUREMENT_ID'
)

$requiredFunctionsEnvKeys = @(
	'AWS_ACCESS_KEY_ID',
	'AWS_SECRET_ACCESS_KEY',
	'ADMIN_BOOTSTRAP_PASSWORD',
	'SANTASHOP_PROGRAM_YEAR',
	'SANTASHOP_TIME_ZONE',
	'SANTASHOP_TIME_OFFSET',
	'SANTASHOP_DEFAULT_MAX_SLOTS',
	'FIRESTORE_BACKUP_BUCKET',
	'SES_REGION',
	'REGISTRATION_EMAIL_TEMPLATE',
	'REMINDER_EMAIL_TEMPLATE',
	'SANTASHOP_EVENT_DISPLAY_NAME',
	'REGISTRATION_EMAIL_SOURCE',
	'REGISTRATION_EMAIL_RETURN_PATH',
	'SCHEDULED_FIRESTORE_BACKUP',
	'SCHEDULED_DATETIME_SLOT_COUNTERS',
	'SCHEDULED_REGISTRATION_STATS',
	'SCHEDULED_USER_STATS',
	'SCHEDULED_CHECKIN_STATS'
)

$optionalFunctionsEnvKeys = @(
	'ADMIN_UIDS',
	'SANTASHOP_SHOP_DAYS',
	'REMINDER_EMAIL_SENDING_STALE_MINUTES',
	'AWS_REGION'
)

$allFunctionsEnvKeys = $requiredFunctionsEnvKeys + $optionalFunctionsEnvKeys

$projectModes = @{
	'test' = [ordered]@{
		Prefix = 'TEST'
		DefaultProjectId = 'santas-workshop-test'
	}
	'prod' = [ordered]@{
		Prefix = 'PROD'
		DefaultProjectId = 'santas-workshop-193b5'
	}
}

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

function Get-SecretValue {
	param(
		[Parameter(Mandatory = $true)][hashtable]$EnvValues,
		[Parameter(Mandatory = $true)][ValidateSet('test', 'prod')][string]$Mode,
		[Parameter(Mandatory = $true)][string]$Key,
		[switch]$Required
	)

	$prefix = $projectModes[$Mode].Prefix
	$prefixedKey = '{0}_{1}' -f $prefix, $Key
	if ($EnvValues.ContainsKey($prefixedKey) -and -not [string]::IsNullOrWhiteSpace($EnvValues[$prefixedKey])) {
		return [string]$EnvValues[$prefixedKey]
	}

	if ($EnvValues.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($EnvValues[$Key])) {
		return [string]$EnvValues[$Key]
	}

	if ($Required.IsPresent) {
		throw "Missing required value for $prefixedKey (or fallback $Key) in $resolvedEnvFilePath"
	}

	return $null
}

function Get-ProjectId {
	param(
		[Parameter(Mandatory = $true)][hashtable]$EnvValues,
		[Parameter(Mandatory = $true)][ValidateSet('test', 'prod')][string]$Mode
	)

	$projectId = Get-SecretValue -EnvValues $EnvValues -Mode $Mode -Key 'FIREBASE_PROJECT_ID'
	if ([string]::IsNullOrWhiteSpace($projectId)) {
		return $projectModes[$Mode].DefaultProjectId
	}

	return $projectId
}

function Get-SecretsForMode {
	param(
		[Parameter(Mandatory = $true)][hashtable]$EnvValues,
		[Parameter(Mandatory = $true)][ValidateSet('test', 'prod')][string]$Mode
	)

	$secrets = [ordered]@{}

	foreach ($key in $firebaseEnvKeys) {
		$secrets[$key] = Get-SecretValue -EnvValues $EnvValues -Mode $Mode -Key $key -Required
	}

	foreach ($key in $requiredFunctionsEnvKeys) {
		$secrets[$key] = Get-SecretValue -EnvValues $EnvValues -Mode $Mode -Key $key -Required
	}

	foreach ($key in $optionalFunctionsEnvKeys) {
		$value = Get-SecretValue -EnvValues $EnvValues -Mode $Mode -Key $key
		if (-not [string]::IsNullOrWhiteSpace($value)) {
			$secrets[$key] = $value
		}
	}

	return $secrets
}

function Invoke-GCloud {
	param(
		[Parameter(Mandatory = $true)][string[]]$Arguments,
		[switch]$CaptureOutput
	)

	$command = Get-Command gcloud -ErrorAction SilentlyContinue
	if (-not $command) {
		$defaultCloudSdkPath = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
		if (Test-Path -LiteralPath $defaultCloudSdkPath) {
			$commandName = $defaultCloudSdkPath
		} else {
			throw 'gcloud CLI is not installed or not on PATH.'
		}
	} else {
		$commandName = $command.Source
	}

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

function Assert-GCloudReady {
	$activeAccount = Invoke-GCloud -Arguments @('auth', 'list', '--filter=status:ACTIVE', '--format=value(account)') -CaptureOutput
	if ([string]::IsNullOrWhiteSpace($activeAccount)) {
		throw 'No active gcloud account found. Run `gcloud auth login` first.'
	}

	Write-Host ("Using gcloud account: {0}" -f $activeAccount)
}

function Test-SecretExists {
	param(
		[Parameter(Mandatory = $true)][string]$ProjectId,
		[Parameter(Mandatory = $true)][string]$SecretName
	)

	$previousPreference = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		Invoke-GCloud -Arguments @('secrets', 'describe', $SecretName, '--project', $ProjectId) *> $null
		return $true
	} catch {
		return $false
	} finally {
		$ErrorActionPreference = $previousPreference
	}
}

function Get-LatestSecretValue {
	param(
		[Parameter(Mandatory = $true)][string]$ProjectId,
		[Parameter(Mandatory = $true)][string]$SecretName
	)

	if (-not (Test-SecretExists -ProjectId $ProjectId -SecretName $SecretName)) {
		return $null
	}

	return Invoke-GCloud -Arguments @(
		'secrets',
		'versions',
		'access',
		'latest',
		'--secret',
		$SecretName,
		'--project',
		$ProjectId
	) -CaptureOutput
}

function Ensure-Secret {
	param(
		[Parameter(Mandatory = $true)][string]$ProjectId,
		[Parameter(Mandatory = $true)][string]$SecretName,
		[Parameter(Mandatory = $true)][string]$SecretValue,
		[Parameter(Mandatory = $true)][string]$Mode
	)

	$targetDescription = '{0} in {1}' -f $SecretName, $ProjectId
	$existingValue = Get-LatestSecretValue -ProjectId $ProjectId -SecretName $SecretName
	if ($null -ne $existingValue -and $existingValue -ceq $SecretValue) {
		Write-Host ("Unchanged [{0}] {1}" -f $Mode.ToUpperInvariant(), $targetDescription)
		return
	}

	if (-not (Test-SecretExists -ProjectId $ProjectId -SecretName $SecretName)) {
		if ($PSCmdlet.ShouldProcess($targetDescription, 'Create Secret Manager secret')) {
			Invoke-GCloud -Arguments @(
				'secrets',
				'create',
				$SecretName,
				'--project',
				$ProjectId,
				'--replication-policy',
				'automatic',
				'--labels',
				('managed-by=scripts-secrets,environment={0}' -f $Mode)
			)
			Write-Host ("Created   [{0}] {1}" -f $Mode.ToUpperInvariant(), $targetDescription)
		}
	}

	$tempFile = [System.IO.Path]::GetTempFileName()
	try {
		[System.IO.File]::WriteAllText($tempFile, $SecretValue, [System.Text.UTF8Encoding]::new($false))
		if ($PSCmdlet.ShouldProcess($targetDescription, 'Add Secret Manager version')) {
			Invoke-GCloud -Arguments @(
				'secrets',
				'versions',
				'add',
				$SecretName,
				'--project',
				$ProjectId,
				'--data-file',
				$tempFile
			)
			Write-Host ("Updated   [{0}] {1}" -f $Mode.ToUpperInvariant(), $targetDescription)
		}
	} finally {
		Remove-Item -LiteralPath $tempFile -ErrorAction SilentlyContinue
	}
}

Assert-GCloudReady
$envValues = Read-EnvFile -FilePath $resolvedEnvFilePath

$modes = if ($Environment -eq 'all') { @('test', 'prod') } else { @($Environment) }

foreach ($mode in $modes) {
	$projectId = Get-ProjectId -EnvValues $envValues -Mode $mode
	$secrets = Get-SecretsForMode -EnvValues $envValues -Mode $mode

	Write-Host ''
	Write-Host ("Syncing {0} secrets to project {1}" -f $mode.ToUpperInvariant(), $projectId)

	foreach ($secretName in $secrets.Keys) {
		Ensure-Secret -ProjectId $projectId -SecretName $secretName -SecretValue $secrets[$secretName] -Mode $mode
	}
}
