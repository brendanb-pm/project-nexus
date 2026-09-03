[CmdletBinding()]
param(
  [string]$RepoPath = "C:\Projects\project-nexus",
  [string]$DevServerUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"
$failures = 0
function Check([string]$Name, [scriptblock]$Test) {
  try {
    $result = & $Test
    if ($result -eq $false) { throw "check returned false" }
    Write-Host "PASS  $Name" -ForegroundColor Green
  } catch {
    $script:failures++
    Write-Host "FAIL  $Name - $($_.Exception.Message)" -ForegroundColor Red
  }
}
function In-Repository([scriptblock]$Command) {
  Push-Location $RepoPath
  try { & $Command } finally { Pop-Location }
}
$ubuntu = wsl.exe --list --quiet 2>$null | Where-Object { $_ -match "Ubuntu" } | Select-Object -First 1

Check "Windows" { [Environment]::OSVersion.Platform -eq "Win32NT" }
Check "WSL2 default" { ((wsl.exe --status 2>&1 | Out-String) -replace [char]0, "") -match "Default Version:\s+2" }
Check "Ubuntu operational" { if (-not $ubuntu) { return $false }; wsl.exe --distribution $ubuntu -- sh -lc "test -f /etc/os-release"; $LASTEXITCODE -eq 0 }
Check "Git" { (git --version) -match "git version" }
Check "GitHub repository read access" { git -C $RepoPath ls-remote --exit-code origin HEAD; $LASTEXITCODE -eq 0 }
Check "Node.js 22+" { [int]((node --version).TrimStart("v").Split(".")[0]) -ge 22 }
Check "npm" { [version](npm.cmd --version) -ge [version]"10.0" }
Check "Nexus workspace" { Test-Path (Join-Path $RepoPath "package.json") }
Check "Environment file" { Test-Path (Join-Path $RepoPath ".env.local") }
Check "Docker daemon" { docker version --format "{{.Server.Version}}" | Out-Null; $LASTEXITCODE -eq 0 }
Check "Linux containers" { docker run --rm hello-world | Out-Null; $LASTEXITCODE -eq 0 }
Check "Docker Compose" { In-Repository { docker compose ps | Out-Null; $LASTEXITCODE -eq 0 } }
Check "Nexus PostgreSQL" { In-Repository { docker compose exec -T nexus-postgres pg_isready -U nexus_app -d nexus_demo | Out-Null; $LASTEXITCODE -eq 0 } }
Check "Migration consistency" { In-Repository { npm.cmd run db:check | Out-Null; $LASTEXITCODE -eq 0 } }
Check "Seed contract" { In-Repository { npm.cmd run db:seed:validate | Out-Null; $LASTEXITCODE -eq 0 } }
Check "Development server" { (Invoke-WebRequest -UseBasicParsing -Uri $DevServerUrl -TimeoutSec 5).StatusCode -eq 200 }

if ($failures) { exit 1 }
