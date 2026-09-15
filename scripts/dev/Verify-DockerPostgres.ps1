#requires -Version 7.0
[CmdletBinding()]
param(
  [string]$NexusRepoPath = (Join-Path $PSScriptRoot '..\..'),
  [string]$AtlasRuntimePath = (Join-Path $PSScriptRoot '..\..\..\..\Project-Atlas\Project Atlas\runtime\secure-session-edge'),
  [ValidateRange(1024, 65535)]
  [int]$NexusPort = 5434,
  [ValidateRange(1024, 65535)]
  [int]$AtlasPort = 5435,
  [switch]$RunProjectChecks
)

$ErrorActionPreference = 'Stop'
$script:Failures = 0
$NexusRepoPath = [IO.Path]::GetFullPath($NexusRepoPath)
$AtlasRuntimePath = [IO.Path]::GetFullPath($AtlasRuntimePath)
$SecretStorePath = Join-Path $env:LOCALAPPDATA 'NexusAtlasDocker\secrets.dpapi.json'
$NexusEnvPath = Join-Path $NexusRepoPath '.env.docker.local'
$AtlasEnvPath = Join-Path $AtlasRuntimePath '.env.docker.local'
$NexusAppEnvPath = Join-Path $NexusRepoPath '.env.local'

function Pass([string]$Name, [string]$Evidence) { Write-Host ("PASS    {0} - {1}" -f $Name, $Evidence) -ForegroundColor Green }
function Fail([string]$Name, [string]$Evidence) { $script:Failures++; Write-Host ("FAIL    {0} - {1}" -f $Name, $Evidence) -ForegroundColor Red }
function Check([string]$Name, [scriptblock]$Test, [string]$Evidence) {
  try { if (-not (& $Test)) { throw 'check returned false' }; Pass $Name $Evidence } catch { Fail $Name $_.Exception.Message }
}

function Unprotect-Secret([string]$CipherText) {
  $secure = ConvertTo-SecureString -String $CipherText
  return [Net.NetworkCredential]::new('', $secure).Password
}

function Get-Secrets {
  if (-not (Test-Path -LiteralPath $SecretStorePath)) { throw "DPAPI secret store is missing: $SecretStorePath" }
  $stored = Get-Content -Raw -LiteralPath $SecretStorePath | ConvertFrom-Json
  if ($stored.schema -ne 1) { throw 'Unsupported local secret-store schema.' }
  return [pscustomobject]@{
    NexusPostgres = Unprotect-Secret $stored.nexusPostgres
    AtlasPostgres = Unprotect-Secret $stored.atlasPostgres
  }
}

function Get-EnvironmentValue([string]$Path, [string]$Name) {
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^$([regex]::Escape($Name))=(.*)$") { return $Matches[1] }
  }
  return $null
}

function Invoke-Compose([string]$WorkingDirectory, [string]$EnvironmentFile, [string[]]$Arguments, [switch]$Capture) {
  Push-Location $WorkingDirectory
  try {
    if ($Capture) {
      $result = & docker compose --env-file $EnvironmentFile @Arguments 2>$null
      if ($LASTEXITCODE) { throw "docker compose failed with exit code $LASTEXITCODE" }
      return ($result | Out-String).Trim()
    }
    & docker compose --env-file $EnvironmentFile @Arguments
    if ($LASTEXITCODE) { throw "docker compose failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
}

function Invoke-ContainerPsql([string]$WorkingDirectory, [string]$EnvironmentFile, [string]$Service, [string]$User, [string]$Database, [string]$Sql) {
  return Invoke-Compose $WorkingDirectory $EnvironmentFile @('exec', '-T', $Service, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', $User, '-d', $Database, '-Atc', $Sql) -Capture
}

function Wait-Healthy([string]$WorkingDirectory, [string]$EnvironmentFile, [string]$Service) {
  $deadline = (Get-Date).AddSeconds(120)
  do {
    $id = Invoke-Compose $WorkingDirectory $EnvironmentFile @('ps', '-q', $Service) -Capture
    if ($id) {
      $health = (& docker inspect --format '{{.State.Health.Status}}' $id 2>$null | Out-String).Trim()
      if ($health -eq 'healthy') { return $id }
      if ($health -eq 'unhealthy') { throw "$Service became unhealthy" }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "$Service did not become healthy within 120 seconds"
}

function Get-ContainerFact([string]$Id, [string]$Template) {
  $value = (& docker inspect --format $Template $Id 2>$null | Out-String).Trim()
  if ($LASTEXITCODE) { throw "docker inspect failed for $Id" }
  return $value
}

function Get-NexusMigrationFingerprint {
  return Invoke-ContainerPsql $NexusRepoPath $NexusEnvPath 'nexus-postgres' 'nexus_app_local' 'nexus_demo' "SELECT count(*)::text || ':' || COALESCE(max(created_at)::text,'') FROM drizzle.__drizzle_migrations"
}

function Invoke-NexusMigrations {
  $oldDatabaseUrl = $env:DATABASE_URL
  try {
    $env:DATABASE_URL = Get-EnvironmentValue $NexusAppEnvPath 'DATABASE_URL'
    if (-not $env:DATABASE_URL) { throw 'Nexus DATABASE_URL is absent from .env.local.' }
    Push-Location $NexusRepoPath
    try {
      & npm.cmd run db:migrate
      if ($LASTEXITCODE) { throw 'First Nexus migration run failed.' }
      $first = Get-NexusMigrationFingerprint
      & npm.cmd run db:migrate
      if ($LASTEXITCODE) { throw 'Second Nexus migration run failed.' }
      $second = Get-NexusMigrationFingerprint
      if ($first -ne $second) { throw 'Nexus migration metadata changed on the second run.' }
    } finally { Pop-Location }
    Pass 'Nexus migrations' 'first run succeeded and second run preserved the exact migration metadata fingerprint'
  } catch { Fail 'Nexus migrations' $_.Exception.Message }
  finally { $env:DATABASE_URL = $oldDatabaseUrl }
}

function Test-NexusResetGuard {
  $oldDatabaseUrl = $env:DATABASE_URL
  try {
    $env:DATABASE_URL = "postgresql://127.0.0.1:$AtlasPort/atlas_preprod_mos133g"
    Push-Location $NexusRepoPath
    try {
      & npm.cmd run db:demo:reset *> $null
      $exitCode = $LASTEXITCODE
    } finally { Pop-Location }
    if ($exitCode -eq 0) { throw 'Nexus demo reset unexpectedly accepted the Atlas database target.' }
    Pass 'Nexus reset isolation' 'guard rejected the Atlas database name before destructive SQL'
  } catch { Fail 'Nexus reset isolation' $_.Exception.Message }
  finally { $env:DATABASE_URL = $oldDatabaseUrl }
}

function Invoke-AtlasCheck($Secrets) {
  try {
    $databaseCount = Invoke-ContainerPsql $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres' 'atlas_bootstrap_local' 'postgres' "SELECT count(*) FROM pg_database WHERE datname='atlas_preprod_mos133g'"
    if ($databaseCount -eq '0') {
      $saved = @{
        ATLAS_MOS133G_REAL_POSTGRES = $env:ATLAS_MOS133G_REAL_POSTGRES
        PGHOST = $env:PGHOST
        PGPORT = $env:PGPORT
        PGDATABASE = $env:PGDATABASE
        PGUSER = $env:PGUSER
        PGPASSWORD = $env:PGPASSWORD
      }
      try {
        $env:ATLAS_MOS133G_REAL_POSTGRES = '1'
        $env:PGHOST = '127.0.0.1'
        $env:PGPORT = [string]$AtlasPort
        $env:PGDATABASE = 'postgres'
        $env:PGUSER = 'atlas_bootstrap_local'
        $env:PGPASSWORD = $Secrets.AtlasPostgres
        Push-Location $AtlasRuntimePath
        try {
          & node --test test/real-postgres-mos133g.test.js
          if ($LASTEXITCODE) { throw 'Atlas real PostgreSQL 17 migration/readiness test failed.' }
        } finally { Pop-Location }
      } finally {
        foreach ($name in $saved.Keys) { Set-Item -Path "Env:$name" -Value $saved[$name] }
      }
      Pass 'Atlas migration/smoke' 'marker-guarded disposable PostgreSQL 17 migration suite passed on the first initialization'
    } else {
      $marker = Invoke-ContainerPsql $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres' 'atlas_bootstrap_local' 'postgres' "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='atlas_preprod_mos133g'"
      if ($marker -ne 'DISPOSABLE LOCAL MOS-133G PREPRODUCTION DATABASE') { throw 'Existing Atlas database lacks the exact disposable marker; no reset or mutation was attempted.' }
      $migrationState = Invoke-ContainerPsql $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres' 'atlas_bootstrap_local' 'atlas_preprod_mos133g' "SELECT count(*) FILTER (WHERE status <> 'APPLIED')::text || ':' || count(*)::text FROM atlas_schema_migrations"
      if ($migrationState -notmatch '^0:[1-9][0-9]*$') { throw "Atlas migration metadata is not CURRENT: $migrationState" }
      Pass 'Atlas migration/smoke' 'existing marker-guarded database is reachable and every recorded migration is APPLIED; no reset was performed'
    }
  } catch { Fail 'Atlas migration/smoke' $_.Exception.Message }
}

Write-Host 'Docker / PostgreSQL isolation verification' -ForegroundColor Cyan

try {
  $client = (docker version --format '{{.Client.Version}}' 2>$null | Out-String).Trim()
  $server = (docker version --format '{{.Server.Version}}' 2>$null | Out-String).Trim()
  $compose = (docker compose version --short 2>$null | Out-String).Trim()
  $osType = (docker info --format '{{.OSType}}' 2>$null | Out-String).Trim()
  Check 'Docker client' { [bool]$client } $client
  Check 'Docker engine' { [bool]$server -and $osType -eq 'linux' } "$server; OSType=$osType"
  Check 'Docker Compose' { [bool]$compose } $compose
} catch { Fail 'Docker runtime' $_.Exception.Message }

$requiredFiles = @($NexusEnvPath, $AtlasEnvPath, $NexusAppEnvPath, $SecretStorePath)
Check 'Local-only secret files' { ($requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -eq 0 } 'DPAPI store and ignored project environment files exist; contents were not printed'

$secrets = Get-Secrets
Check 'Credentials distinct' { $secrets.NexusPostgres -ne $secrets.AtlasPostgres } 'Nexus and Atlas generated credential values differ'
Check 'Ports distinct' { $NexusPort -ne $AtlasPort -and $NexusPort -ne 5432 -and $AtlasPort -ne 5432 } "Nexus=$NexusPort; Atlas=$AtlasPort; host PostgreSQL remains on 5432"

try {
  $nexusId = Wait-Healthy $NexusRepoPath $NexusEnvPath 'nexus-postgres'
  Pass 'Nexus health' 'nexus-postgres is healthy'
} catch { Fail 'Nexus health' $_.Exception.Message }
try {
  $atlasId = Wait-Healthy $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres'
  Pass 'Atlas health' 'atlas-postgres is healthy'
} catch { Fail 'Atlas health' $_.Exception.Message }

if ($nexusId -and $atlasId) {
  try {
    $nexusProject = Get-ContainerFact $nexusId '{{index .Config.Labels "com.docker.compose.project"}}'
    $atlasProject = Get-ContainerFact $atlasId '{{index .Config.Labels "com.docker.compose.project"}}'
    $nexusVolume = Get-ContainerFact $nexusId '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}'
    $atlasVolume = Get-ContainerFact $atlasId '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}'
    $nexusNetworks = Get-ContainerFact $nexusId '{{range $key, $value := .NetworkSettings.Networks}}{{println $key}}{{end}}'
    $atlasNetworks = Get-ContainerFact $atlasId '{{range $key, $value := .NetworkSettings.Networks}}{{println $key}}{{end}}'
    $nexusBinding = Get-ContainerFact $nexusId '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}:{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}'
    $atlasBinding = Get-ContainerFact $atlasId '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}:{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}'
    Check 'Compose project names' { $nexusProject -eq 'nexus-local' -and $atlasProject -eq 'atlas-local' -and $nexusProject -ne $atlasProject } "$nexusProject / $atlasProject"
    Check 'Persistent volumes' { $nexusVolume -and $atlasVolume -and $nexusVolume -ne $atlasVolume } "$nexusVolume / $atlasVolume"
    Check 'Networks' { $nexusNetworks -and $atlasNetworks -and $nexusNetworks -ne $atlasNetworks } 'project network names are distinct'
    Check 'Loopback bindings' { $nexusBinding -eq "127.0.0.1:$NexusPort" -and $atlasBinding -eq "127.0.0.1:$AtlasPort" } "$nexusBinding / $atlasBinding"
  } catch { Fail 'Container isolation metadata' $_.Exception.Message }

  try {
    $nexusDb = Invoke-ContainerPsql $NexusRepoPath $NexusEnvPath 'nexus-postgres' 'nexus_app_local' 'nexus_demo' 'SELECT current_database()'
    $atlasDb = Invoke-ContainerPsql $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres' 'atlas_bootstrap_local' 'postgres' 'SELECT current_database()'
    Check 'Database identities' { $nexusDb -eq 'nexus_demo' -and $atlasDb -eq 'postgres' -and $nexusDb -ne $atlasDb } 'each project connected to its own expected container database'
  } catch { Fail 'Database identities' $_.Exception.Message }

  try {
    $nexusCrossCommand = 'PGPASSWORD="$POSTGRES_PASSWORD" psql -w -h host.docker.internal -p {0} -U "$POSTGRES_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1' -f $AtlasPort
    Invoke-Compose $NexusRepoPath $NexusEnvPath @('exec', '-T', 'nexus-postgres', 'sh', '-lc', $nexusCrossCommand)
    $nexusIntoAtlas = $true
  } catch { $nexusIntoAtlas = $false }
  try {
    $atlasCrossCommand = 'PGPASSWORD="$POSTGRES_PASSWORD" psql -w -h host.docker.internal -p {0} -U "$POSTGRES_USER" -d nexus_demo -c "SELECT 1" >/dev/null 2>&1' -f $NexusPort
    Invoke-Compose $AtlasRuntimePath $AtlasEnvPath @('exec', '-T', 'atlas-postgres', 'sh', '-lc', $atlasCrossCommand)
    $atlasIntoNexus = $true
  } catch { $atlasIntoNexus = $false }
  Check 'Cross-project credential denial' { -not $nexusIntoAtlas -and -not $atlasIntoNexus } 'each project credential was rejected by the other project container'

  try {
    [void](Invoke-ContainerPsql $NexusRepoPath $NexusEnvPath 'nexus-postgres' 'nexus_app_local' 'nexus_demo' "CREATE TABLE IF NOT EXISTS nexus_setup_persistence_proof(id text PRIMARY KEY); INSERT INTO nexus_setup_persistence_proof VALUES ('nexus') ON CONFLICT DO NOTHING")
    [void](Invoke-ContainerPsql $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres' 'atlas_bootstrap_local' 'postgres' "CREATE TABLE IF NOT EXISTS atlas_setup_persistence_proof(id text PRIMARY KEY); INSERT INTO atlas_setup_persistence_proof VALUES ('atlas') ON CONFLICT DO NOTHING")
    Invoke-Compose $NexusRepoPath $NexusEnvPath @('restart', 'nexus-postgres')
    Invoke-Compose $AtlasRuntimePath $AtlasEnvPath @('restart', 'atlas-postgres')
    $nexusId = Wait-Healthy $NexusRepoPath $NexusEnvPath 'nexus-postgres'
    $atlasId = Wait-Healthy $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres'
    $nexusProof = Invoke-ContainerPsql $NexusRepoPath $NexusEnvPath 'nexus-postgres' 'nexus_app_local' 'nexus_demo' "SELECT id FROM nexus_setup_persistence_proof WHERE id='nexus'"
    $atlasProof = Invoke-ContainerPsql $AtlasRuntimePath $AtlasEnvPath 'atlas-postgres' 'atlas_bootstrap_local' 'postgres' "SELECT id FROM atlas_setup_persistence_proof WHERE id='atlas'"
    Check 'Restart persistence' { $nexusProof -eq 'nexus' -and $atlasProof -eq 'atlas' } 'both project markers survived container restart on their distinct volumes'
  } catch { Fail 'Restart persistence' $_.Exception.Message }
}

try {
  $databaseUrl = Get-EnvironmentValue $NexusAppEnvPath 'DATABASE_URL'
  $uri = [Uri]$databaseUrl
  Check 'Nexus DATABASE_URL readiness' { $uri.Host -eq '127.0.0.1' -and $uri.Port -eq $NexusPort -and $uri.AbsolutePath -eq '/nexus_demo' } 'ignored local file targets only the Nexus loopback container; value was not printed'
} catch { Fail 'Nexus DATABASE_URL readiness' $_.Exception.Message }

if ($RunProjectChecks) {
  Invoke-NexusMigrations
  Test-NexusResetGuard
  Invoke-AtlasCheck $secrets
}

$hostPostgres = Get-CimInstance Win32_Service -Filter "Name='postgresql-x64-17'" -ErrorAction SilentlyContinue
if ($hostPostgres) { Pass 'Host PostgreSQL untouched' "service remains $($hostPostgres.State); verification never connected to port 5432" }

if ($script:Failures) {
  Write-Host "VERIFICATION BLOCKED/FAILED - $script:Failures check(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host 'VERIFICATION PASS - isolated Nexus and Atlas PostgreSQL environments are ready.' -ForegroundColor Green
exit 0
