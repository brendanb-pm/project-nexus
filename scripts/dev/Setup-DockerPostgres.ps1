#requires -Version 7.0
[CmdletBinding()]
param(
  [ValidateSet('Preflight', 'Download', 'Install', 'Provision', 'All')]
  [string]$Phase = 'Preflight',
  [string]$NexusRepoPath = (Join-Path $PSScriptRoot '..\..'),
  [string]$AtlasRuntimePath = (Join-Path $PSScriptRoot '..\..\..\..\Project-Atlas\Project Atlas\runtime\secure-session-edge'),
  [ValidateRange(1024, 65535)]
  [int]$NexusPort = 5434,
  [ValidateRange(1024, 65535)]
  [int]$AtlasPort = 5435,
  [switch]$AllowAllUsersInstall
)

$ErrorActionPreference = 'Stop'
$script:Blocked = $false
$DockerDesktopVersion = '4.91.0'
$DockerDesktopBuild = '239619'
$DockerInstallerUri = "https://desktop.docker.com/win/main/amd64/$DockerDesktopBuild/Docker%20Desktop%20Installer.exe"
$DockerInstallerSha256 = 'ac405b09942701770d581b173747fc1024cf0e6047cbe60f13d1df85437311ac'
$LocalStateRoot = Join-Path $env:LOCALAPPDATA 'NexusAtlasDocker'
$DownloadRoot = Join-Path $LocalStateRoot 'downloads'
$InstallerPath = Join-Path $DownloadRoot "Docker-Desktop-$DockerDesktopVersion-$DockerDesktopBuild.exe"
$SecretStorePath = Join-Path $LocalStateRoot 'secrets.dpapi.json'
$NexusRepoPath = [IO.Path]::GetFullPath($NexusRepoPath)
$AtlasRuntimePath = [IO.Path]::GetFullPath($AtlasRuntimePath)

function Write-Check([string]$State, [string]$Name, [string]$Evidence) {
  if ($State -eq 'BLOCKED') { $script:Blocked = $true }
  $color = if ($State -eq 'PASS') { 'Green' } elseif ($State -eq 'BLOCKED') { 'Red' } else { 'Yellow' }
  Write-Host ("{0,-7} {1} - {2}" -f $State, $Name, $Evidence) -ForegroundColor $color
}

function Test-Administrator {
  return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
}

function Get-CleanWslText([string[]]$Arguments) {
  return ((& wsl.exe @Arguments 2>&1 | Out-String) -replace [char]0, '').Trim()
}

function Get-DockerDesktopExecutable {
  $perUser = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
  $allUsers = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (Test-Path -LiteralPath $perUser) { return $perUser }
  if (Test-Path -LiteralPath $allUsers) { return $allUsers }
  return $null
}

function Add-DockerCliToProcessPath {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'),
    'C:\Program Files\Docker\Docker\resources\bin'
  )
  foreach ($candidate in $candidates) {
    if ((Test-Path -LiteralPath (Join-Path $candidate 'docker.exe')) -and (($env:PATH -split ';') -notcontains $candidate)) {
      $env:PATH = "$candidate;$env:PATH"
    }
  }
}

function Test-PortOwnedByComposeProject([int]$Port, [string]$Project) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  try {
    $ids = docker ps --filter "label=com.docker.compose.project=$Project" --quiet 2>$null
    foreach ($id in $ids) {
      $bindings = docker inspect --format '{{range $port, $items := .NetworkSettings.Ports}}{{range $items}}{{println .HostIp .HostPort}}{{end}}{{end}}' $id 2>$null
      if ($bindings -match "(?:^|\s)127\.0\.0\.1\s+$Port(?:\s|$)") { return $true }
    }
  } catch { return $false }
  return $false
}

function Test-DevelopmentPort([int]$Port, [string]$Project) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) {
    Write-Check PASS "Loopback port $Port" 'not currently listening'
    return
  }
  if (Test-PortOwnedByComposeProject $Port $Project) {
    Write-Check PASS "Loopback port $Port" "already owned by expected Compose project $Project"
    return
  }
  $owners = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ','
  Write-Check BLOCKED "Loopback port $Port" "already listening; owning PID(s): $owners"
}

function Invoke-Preflight {
  $script:Blocked = $false
  Write-Host 'Docker Desktop / isolated PostgreSQL preflight' -ForegroundColor Cyan
  $os = Get-CimInstance Win32_OperatingSystem
  $computer = Get-CimInstance Win32_ComputerSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1

  if ($os.Caption -match 'Windows 11' -and [int]$os.BuildNumber -ge 22631) {
    Write-Check PASS 'Windows' "$($os.Caption), build $($os.BuildNumber), $($os.OSArchitecture)"
  } else {
    Write-Check BLOCKED 'Windows' "$($os.Caption), build $($os.BuildNumber); Docker requires supported Windows 11 build 22631+"
  }
  if ($computer.SystemType -match 'x64' -and $cpu.AddressWidth -eq 64) {
    Write-Check PASS 'CPU architecture' "$($computer.SystemType), $($cpu.Name)"
  } else {
    Write-Check BLOCKED 'CPU architecture' "$($computer.SystemType), address width $($cpu.AddressWidth)"
  }
  $ramGb = [math]::Round($computer.TotalPhysicalMemory / 1GB, 2)
  if ($ramGb -ge 8) { Write-Check PASS 'Memory' "$ramGb GB installed" } else { Write-Check BLOCKED 'Memory' "$ramGb GB; Docker requires at least 8 GB" }

  if ($computer.HypervisorPresent -or ($cpu.VirtualizationFirmwareEnabled -and $cpu.SecondLevelAddressTranslationExtensions)) {
    $virtEvidence = if ($computer.HypervisorPresent) { 'Windows reports an active hypervisor' } else { 'firmware virtualization and SLAT are enabled' }
    Write-Check PASS 'Virtualization' $virtEvidence
  } else {
    Write-Check BLOCKED 'Virtualization' 'no active hypervisor and firmware virtualization/SLAT were not reported; enable virtualization or nested virtualization'
  }

  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Check BLOCKED 'WSL' 'wsl.exe is unavailable; enable WSL from an elevated PowerShell and reboot'
  } else {
    $wslVersion = Get-CleanWslText @('--version')
    $wslStatus = Get-CleanWslText @('--status')
    $versionMatch = [regex]::Match($wslVersion, 'WSL version:\s*([0-9.]+)', 'IgnoreCase')
    if ($versionMatch.Success -and [version]$versionMatch.Groups[1].Value -ge [version]'2.1.5') {
      Write-Check PASS 'WSL version' $versionMatch.Groups[1].Value
    } else {
      Write-Check BLOCKED 'WSL version' 'WSL 2.1.5 or later is required; run wsl --update from an elevated PowerShell'
    }
    if ($wslStatus -match 'Default Version:\s*2') { Write-Check PASS 'WSL default' 'version 2' } else { Write-Check BLOCKED 'WSL default' 'default version is not 2' }
    $distros = Get-CleanWslText @('--list', '--quiet')
    if ([string]::IsNullOrWhiteSpace($distros)) {
      Write-Check WARN 'WSL distributions' 'none registered; Docker Desktop does not require a user distribution'
    } else {
      Write-Check PASS 'WSL distributions' 'at least one distribution is registered'
    }
  }

  $serverService = Get-Service LanmanServer -ErrorAction SilentlyContinue
  if ($serverService -and $serverService.Status -eq 'Running' -and $serverService.StartType -eq 'Automatic') {
    Write-Check PASS 'Windows Server service' 'LanmanServer is running and Automatic'
  } else {
    Write-Check BLOCKED 'Windows Server service' 'LanmanServer must be enabled, running, and Automatic'
  }

  $drive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  $freeGb = [math]::Round($drive.FreeSpace / 1GB, 2)
  if ($freeGb -ge 20) { Write-Check PASS 'Disk space' "$freeGb GB free on C:" } else { Write-Check BLOCKED 'Disk space' "$freeGb GB free on C:; local policy requires at least 20 GB" }

  if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = [version]((node --version).TrimStart('v'))
    if ($nodeVersion.Major -ge 22 -and $nodeVersion.Major -lt 25) {
      Write-Check PASS 'Node.js' "$nodeVersion satisfies Nexus 22+ and Atlas >=20 <25"
    } else {
      Write-Check BLOCKED 'Node.js' "$nodeVersion does not satisfy the combined Nexus/Atlas runtime range (22 through 24)"
    }
  } else {
    Write-Check BLOCKED 'Node.js' 'node is unavailable; install a supported Node.js release (22 through 24)'
  }

  $pendingCbs = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
  $pendingWu = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
  $installLog = 'C:\ProgramData\DockerDesktop\install-log-admin.txt'
  $dockerFeatureReboot = $false
  if (Test-Path -LiteralPath $installLog) {
    $logRequiresReboot = Select-String -LiteralPath $installLog -SimpleMatch 'Enabled Windows features that require computer restart' -Quiet
    $dockerFeatureReboot = $logRequiresReboot -and $os.LastBootUpTime -lt (Get-Item -LiteralPath $installLog).LastWriteTime
  }
  if ($pendingCbs -or $pendingWu -or $dockerFeatureReboot) {
    Write-Check BLOCKED 'Pending reboot' "CBS=$pendingCbs; WindowsUpdate=$pendingWu; DockerFeature=$dockerFeatureReboot. Reboot, then rerun this script with -Phase Preflight"
  } else {
    Write-Check PASS 'Pending reboot' 'no servicing or Windows Update reboot marker'
  }

  $dockerExe = Get-DockerDesktopExecutable
  if ($dockerExe) {
    if ($dockerExe -like 'C:\Program Files\*' -and -not $AllowAllUsersInstall) {
      Write-Check BLOCKED 'Docker installation mode' 'all-users installation detected. If this was an intentional Dell policy choice, rerun with -AllowAllUsersInstall; otherwise use Docker installer maintenance to reinstall per-user.'
    } elseif ($dockerExe -like 'C:\Program Files\*') {
      Write-Check WARN 'Docker installation mode' 'all-users installation explicitly acknowledged for this run'
    } else {
      Write-Check PASS 'Docker installation mode' 'per-user installation'
    }
    Write-Check PASS 'Docker Desktop files' $dockerExe
  } else { Write-Check WARN 'Docker Desktop files' 'not installed' }
  Add-DockerCliToProcessPath
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    $clientVersion = (docker version --format '{{.Client.Version}}' 2>$null | Out-String).Trim()
    if ($clientVersion) { Write-Check PASS 'Docker CLI' $clientVersion } else { Write-Check WARN 'Docker CLI' 'present but version unavailable' }
    $serverVersion = (docker version --format '{{.Server.Version}}' 2>$null | Out-String).Trim()
    if ($serverVersion) { Write-Check PASS 'Docker engine' $serverVersion } else { Write-Check WARN 'Docker engine' 'not running or not reachable' }
    $composeVersion = (docker compose version --short 2>$null | Out-String).Trim()
    if ($composeVersion) { Write-Check PASS 'Docker Compose' $composeVersion } else { Write-Check WARN 'Docker Compose' 'not currently available' }
  } else {
    Write-Check WARN 'Docker CLI' 'not installed'
  }

  $postgresServices = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -match 'postgres|pgsql' -or $_.DisplayName -match 'postgres|pgsql' })
  if ($postgresServices.Count) {
    $summary = ($postgresServices | ForEach-Object { "$($_.Name)=$($_.State)" }) -join '; '
    Write-Check PASS 'Host PostgreSQL inventory' "$summary; inventory only, no database connection attempted"
  } else {
    Write-Check WARN 'Host PostgreSQL inventory' 'no Windows PostgreSQL service found'
  }
  $hostListeners = @(Get-NetTCPConnection -State Listen -LocalPort 5432 -ErrorAction SilentlyContinue)
  if ($hostListeners.Count) {
    $pids = ($hostListeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ','
    Write-Check PASS 'Host PostgreSQL listener' "port 5432 remains owned by PID(s) $pids and is excluded from project configuration"
  } else {
    Write-Check WARN 'Host PostgreSQL listener' 'no listener observed on port 5432'
  }

  Test-DevelopmentPort $NexusPort 'nexus-local'
  Test-DevelopmentPort $AtlasPort 'atlas-local'
  if ($NexusPort -eq $AtlasPort) { Write-Check BLOCKED 'Project ports' 'Nexus and Atlas ports must be distinct' } else { Write-Check PASS 'Project ports' "Nexus=$NexusPort; Atlas=$AtlasPort" }

  foreach ($repo in @(@{ Name = 'Nexus'; Path = $NexusRepoPath; Marker = 'package.json' }, @{ Name = 'Atlas'; Path = $AtlasRuntimePath; Marker = 'package.json' })) {
    if ((Test-Path -LiteralPath $repo.Path) -and (Test-Path -LiteralPath (Join-Path $repo.Path $repo.Marker))) {
      Write-Check PASS "$($repo.Name) repository" $repo.Path
    } else {
      Write-Check BLOCKED "$($repo.Name) repository" "expected runtime not found at $($repo.Path)"
    }
  }

  $recentDockerBlocks = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-CodeIntegrity/Operational'; Id = 3033, 3077; StartTime = (Get-Date).AddDays(-30) } -ErrorAction SilentlyContinue | Where-Object { $_.Message -match 'Docker' })
  if ($recentDockerBlocks.Count) {
    Write-Check BLOCKED 'Application Control' "$($recentDockerBlocks.Count) recent Docker-specific Code Integrity block event(s); contact endpoint administration"
  } else {
    Write-Check PASS 'Application Control' 'no Docker-specific Code Integrity block event found in the last 30 days'
  }
  $otherBlocks = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-CodeIntegrity/Operational'; Id = 3033, 3077; StartTime = (Get-Date).AddDays(-2) } -ErrorAction SilentlyContinue)
  if ($otherBlocks.Count) { Write-Check WARN 'Endpoint policy context' "$($otherBlocks.Count) other recent Code Integrity event(s); installer signature is checked before execution" }

  Write-Check PASS 'Administrative context' ($(if (Test-Administrator) { 'elevated' } else { 'standard user; any installer elevation remained user-visible' }))
  if ($script:Blocked) { throw 'PREFLIGHT BLOCKED. Resolve the BLOCKED entries and rerun with -Phase Preflight.' }
}

function Protect-LocalFile([string]$Path) {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $rule = [Security.AccessControl.FileSystemAccessRule]::new(
    $identity.User,
    [Security.AccessControl.FileSystemRights]::FullControl,
    [Security.AccessControl.AccessControlType]::Allow
  )
  [void]$acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $Path -AclObject $acl
}

function New-LocalSecret {
  $bytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Protect-Secret([string]$PlainText) {
  $secure = ConvertTo-SecureString -String $PlainText -AsPlainText -Force
  return ConvertFrom-SecureString -SecureString $secure
}

function Unprotect-Secret([string]$CipherText) {
  $secure = ConvertTo-SecureString -String $CipherText
  return [Net.NetworkCredential]::new('', $secure).Password
}

function Get-LocalSecrets {
  New-Item -ItemType Directory -Path $LocalStateRoot -Force | Out-Null
  if (-not (Test-Path -LiteralPath $SecretStorePath)) {
    $record = [ordered]@{
      schema = 1
      nexusPostgres = Protect-Secret (New-LocalSecret)
      atlasPostgres = Protect-Secret (New-LocalSecret)
      nexusAuth = Protect-Secret (New-LocalSecret)
    }
    $record | ConvertTo-Json | Set-Content -LiteralPath $SecretStorePath -Encoding utf8 -NoNewline
    Protect-LocalFile $SecretStorePath
    Write-Check PASS 'Local secret store' 'created with Windows DPAPI and current-user-only ACL'
  } else {
    Write-Check PASS 'Local secret store' 'reusing existing Windows DPAPI-protected credentials'
  }
  $stored = Get-Content -Raw -LiteralPath $SecretStorePath | ConvertFrom-Json
  if ($stored.schema -ne 1) { throw 'Unsupported local secret-store schema.' }
  return [pscustomobject]@{
    NexusPostgres = Unprotect-Secret $stored.nexusPostgres
    AtlasPostgres = Unprotect-Secret $stored.atlasPostgres
    NexusAuth = Unprotect-Secret $stored.nexusAuth
  }
}

function Write-ProtectedEnvironmentFile([string]$Path, [string[]]$Lines) {
  $directory = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $directory)) { throw "Environment-file directory is missing: $directory" }
  Set-Content -LiteralPath $Path -Value ($Lines -join [Environment]::NewLine) -Encoding utf8 -NoNewline
  Protect-LocalFile $Path
}

function Get-EnvironmentValue([string]$Path, [string]$Name) {
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^$([regex]::Escape($Name))=(.*)$") { return $Matches[1] }
  }
  return $null
}

function Write-ProjectEnvironmentFiles($Secrets) {
  $nexusDockerEnv = Join-Path $NexusRepoPath '.env.docker.local'
  Write-ProtectedEnvironmentFile $nexusDockerEnv @(
    'NEXUS_POSTGRES_DB=nexus_dev',
    'NEXUS_POSTGRES_USER=nexus_app_local',
    "NEXUS_POSTGRES_PASSWORD=$($Secrets.NexusPostgres)",
    "NEXUS_POSTGRES_PORT=$NexusPort"
  )

  $nexusAppEnv = Join-Path $NexusRepoPath '.env.local'
  $escapedPassword = [Uri]::EscapeDataString($Secrets.NexusPostgres)
  $expectedDatabaseUrl = "postgresql://nexus_app_local:$escapedPassword@127.0.0.1:$NexusPort/nexus_demo"
  if (Test-Path -LiteralPath $nexusAppEnv) {
    $existingUrl = Get-EnvironmentValue $nexusAppEnv 'DATABASE_URL'
    if ($existingUrl -ne $expectedDatabaseUrl) {
      throw 'Existing Nexus .env.local has a different DATABASE_URL. It was not overwritten; reconcile it manually without exposing the value.'
    }
  } else {
    Write-ProtectedEnvironmentFile $nexusAppEnv @(
      'NEXT_PUBLIC_APP_URL=http://localhost:3000',
      "BETTER_AUTH_SECRET=$($Secrets.NexusAuth)",
      'OIDC_ISSUER=https://identity.example.invalid',
      'OIDC_DISCOVERY_URL=https://identity.example.invalid/.well-known/openid-configuration',
      'OIDC_CLIENT_ID=project-nexus',
      'OIDC_CLIENT_SECRET=',
      "DATABASE_URL=$expectedDatabaseUrl",
      'NEXUS_DEV_AUTH=false',
      'NEXUS_PERFORMANCE_TELEMETRY=false'
    )
  }

  $atlasDockerEnv = Join-Path $AtlasRuntimePath '.env.docker.local'
  Write-ProtectedEnvironmentFile $atlasDockerEnv @(
    'ATLAS_POSTGRES_DB=postgres',
    'ATLAS_POSTGRES_USER=atlas_bootstrap_local',
    "ATLAS_POSTGRES_PASSWORD=$($Secrets.AtlasPostgres)",
    "ATLAS_POSTGRES_PORT=$AtlasPort"
  )
  Write-Check PASS 'Project environment files' 'created/reused as ignored, current-user-only local files; values were not printed'
}

function Invoke-Download {
  Invoke-Preflight
  New-Item -ItemType Directory -Path $DownloadRoot -Force | Out-Null
  if (-not (Test-Path -LiteralPath $InstallerPath)) {
    Write-Host "Downloading Docker Desktop $DockerDesktopVersion from desktop.docker.com..."
    Invoke-WebRequest -Uri $DockerInstallerUri -OutFile $InstallerPath
  }
  $hash = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $DockerInstallerSha256) { throw "Docker installer SHA-256 mismatch. Expected $DockerInstallerSha256; received $hash. Installer was not executed." }
  $signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') {
    throw "Docker installer Authenticode validation failed: status=$($signature.Status), signer=$($signature.SignerCertificate.Subject). Installer was not executed."
  }
  Write-Check PASS 'Installer provenance' "$DockerInstallerUri"
  Write-Check PASS 'Installer integrity' "official checksum and valid Docker Authenticode signature; SHA-256 $hash"
}

function Invoke-Install {
  Invoke-Download
  if (Get-DockerDesktopExecutable) {
    Write-Check PASS 'Docker Desktop installation' 'already present; installer not rerun'
    return
  }
  Write-Host 'Launching the visible Docker Desktop installer.' -ForegroundColor Cyan
  Write-Host 'Choose Per-user, retain the WSL 2 Linux-container backend, and review/accept Docker terms yourself. The script does not pass acceptance flags.' -ForegroundColor Yellow
  $process = Start-Process -FilePath $InstallerPath -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw "Docker Desktop installer exited with code $($process.ExitCode). Review the visible installer or endpoint-policy message, then rerun -Phase Install." }
  $dockerDesktop = Get-DockerDesktopExecutable
  if (-not $dockerDesktop) { throw 'Installer returned success but Docker Desktop was not found in a supported installation location.' }
  if ($dockerDesktop -like 'C:\Program Files\*' -and -not (Test-Administrator)) {
    Write-Check WARN 'Installation mode' 'all-users location detected; verify this was an explicit installer choice'
  } else {
    Write-Check PASS 'Installation mode' 'per-user Docker Desktop installation detected'
  }
  Start-Process -FilePath $dockerDesktop | Out-Null
  Write-Host 'Docker Desktop was launched visibly. Complete its first-run terms/policy prompts, wait for the engine, then rerun with -Phase Provision.' -ForegroundColor Yellow
}

function Wait-DockerEngine([int]$TimeoutSeconds = 180) {
  Add-DockerCliToProcessPath
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $version = (docker version --format '{{.Server.Version}}' 2>$null | Out-String).Trim()
    if ($version) {
      $osType = (docker info --format '{{.OSType}}' 2>$null | Out-String).Trim()
      if ($osType -ne 'linux') { throw "Docker engine reports OSType=$osType; switch Docker Desktop to Linux containers and rerun." }
      Write-Check PASS 'Docker engine' "$version, Linux containers"
      $compose = (docker compose version --short 2>$null | Out-String).Trim()
      if (-not $compose) { throw 'Docker Compose plugin is unavailable.' }
      Write-Check PASS 'Docker Compose' $compose
      return
    }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  throw 'Docker engine did not become reachable within 180 seconds. Open Docker Desktop for the visible WSL, virtualization, license, or endpoint-policy error, then rerun -Phase Provision.'
}

function Invoke-Provision {
  Invoke-Preflight
  Add-DockerCliToProcessPath
  $runningVersion = (docker version --format '{{.Server.Version}}' 2>$null | Out-String).Trim()
  if (-not $runningVersion) {
    $dockerDesktop = Get-DockerDesktopExecutable
    if (-not $dockerDesktop) { throw 'Docker Desktop is not installed.' }
    Start-Process -FilePath $dockerDesktop | Out-Null
    Write-Host 'Docker Desktop was launched visibly. Review any first-run terms or endpoint-policy prompt while the script waits for the engine.' -ForegroundColor Yellow
  }
  Wait-DockerEngine
  $secrets = Get-LocalSecrets
  if ($secrets.NexusPostgres -eq $secrets.AtlasPostgres) { throw 'Generated Nexus and Atlas database credentials are not distinct.' }
  Write-ProjectEnvironmentFiles $secrets
  $nexusEnv = Join-Path $NexusRepoPath '.env.docker.local'
  $atlasEnv = Join-Path $AtlasRuntimePath '.env.docker.local'
  Push-Location $NexusRepoPath
  try { docker compose --env-file $nexusEnv up -d; if ($LASTEXITCODE) { throw 'Nexus Docker Compose startup failed.' } } finally { Pop-Location }
  Push-Location $AtlasRuntimePath
  try { docker compose --env-file $atlasEnv up -d; if ($LASTEXITCODE) { throw 'Atlas Docker Compose startup failed.' } } finally { Pop-Location }
  Write-Check PASS 'Project startup' 'Nexus and Atlas Compose projects started without volume deletion or pruning'
  $verify = Join-Path $PSScriptRoot 'Verify-DockerPostgres.ps1'
  & $verify -NexusRepoPath $NexusRepoPath -AtlasRuntimePath $AtlasRuntimePath -NexusPort $NexusPort -AtlasPort $AtlasPort -RunProjectChecks
  if ($LASTEXITCODE) { throw 'Project isolation verification failed.' }
}

switch ($Phase) {
  'Preflight' { Invoke-Preflight }
  'Download' { Invoke-Download }
  'Install' { Invoke-Install }
  'Provision' { Invoke-Provision }
  'All' {
    if (Get-DockerDesktopExecutable) { Invoke-Provision } else { Invoke-Install }
  }
}
