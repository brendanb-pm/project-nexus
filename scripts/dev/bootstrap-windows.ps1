[CmdletBinding()]
param(
  [ValidateSet("Prerequisites", "Nexus", "All")]
  [string]$Phase = "All",
  [string]$WorkspaceRoot = "C:\Projects",
  [switch]$ResetDemo,
  [switch]$StartServer
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/brendanb-pm/project-nexus.git"
$RepoPath = Join-Path $WorkspaceRoot "project-nexus"

function Require-Command([string]$Name, [string]$Guidance) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $Guidance"
  }
}

function Install-WingetPackage([string]$Id, [string]$Name) {
  Require-Command winget "Install App Installer from Microsoft Store, then rerun."
  if (Get-Command $Name -ErrorAction SilentlyContinue) { return }
  Write-Host "Installing $Id..."
  winget install --id $Id --exact --accept-package-agreements --accept-source-agreements
}

function Test-NodeVersion {
  Require-Command node "Install Node.js 22 LTS or later, then rerun."
  $major = [int]((node --version).TrimStart("v").Split(".")[0])
  if ($major -lt 22) { throw "Nexus requires Node.js 22 or newer; found $(node --version)." }
}

function Initialize-LocalEnvironment {
  $environmentPath = Join-Path $RepoPath ".env.local"
  if (Test-Path $environmentPath) { return }
  $examplePath = Join-Path $RepoPath ".env.example"
  if (-not (Test-Path $examplePath)) { throw ".env.example is missing from $RepoPath." }
  $secret = -join ((1..48) | ForEach-Object { "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[(Get-Random -Maximum 62)] })
  $content = Get-Content -Raw $examplePath
  $content = $content.Replace("replace-with-at-least-32-random-characters", $secret)
  $content = $content.Replace("NEXUS_DEV_AUTH=false", "NEXUS_DEV_AUTH=true")
  Set-Content -LiteralPath $environmentPath -Value $content -NoNewline
  Write-Host "Created local-only .env.local with localhost demo authentication enabled."
}

if ($Phase -in "Prerequisites", "All") {
  Require-Command wsl "Enable WSL2 from an elevated PowerShell: wsl --install --distribution Ubuntu-24.04 --web-download; reboot if prompted."
  $wslStatus = (wsl.exe --status 2>&1 | Out-String) -replace [char]0, ""
  if ($wslStatus -notmatch "Default Version:\s+2") { throw "WSL2 is not the default version. Run wsl --set-default-version 2." }
  $distros = wsl.exe --list --quiet 2>$null
  if (-not ($distros | Where-Object { $_ -match "Ubuntu" })) {
    throw "Ubuntu is not installed. Run an elevated PowerShell: wsl --install --distribution Ubuntu-24.04 --web-download; reboot if prompted, then rerun this script."
  }
  Install-WingetPackage "Git.Git" "git"
  Install-WingetPackage "OpenJS.NodeJS.LTS" "node"
  Test-NodeVersion
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker Desktop must be installed with its WSL2 backend and Ubuntu integration enabled."
    winget install --id Docker.DockerDesktop --exact --accept-package-agreements --accept-source-agreements
    throw "Start Docker Desktop, select the WSL2 backend and Ubuntu integration, then rerun this script."
  }
  docker version | Out-Host
  docker run --rm hello-world | Out-Host
}

if ($Phase -in "Nexus", "All") {
  Require-Command git "Install Git, then rerun."
  Require-Command docker "Install and start Docker Desktop, then rerun."
  Test-NodeVersion
  if (-not (Test-Path $RepoPath)) {
    New-Item -ItemType Directory -Force -Path $WorkspaceRoot | Out-Null
    git clone $RepoUrl $RepoPath
  }
  if (-not (Test-Path (Join-Path $RepoPath ".git"))) { throw "$RepoPath exists but is not the Nexus repository." }
  Push-Location $RepoPath
  try {
    git fetch origin main --prune
    git switch main
    git merge --ff-only origin/main
    Initialize-LocalEnvironment
    npm.cmd ci
    docker compose up -d
    docker compose ps
    npm.cmd run db:migrate
    npm.cmd run db:check
    npm.cmd run db:seed:validate
    if ($ResetDemo) { npm.cmd run db:demo:reset }
    if ($StartServer) { npm.cmd run dev }
  } finally {
    Pop-Location
  }
}
