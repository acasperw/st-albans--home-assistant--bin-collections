# Build production artifacts for Raspberry Pi deployment
# Usage: ./deploy/build-prod.ps1 [-Version 20250904]
param(
  [string]$Version = (Get-Date -Format 'yyyyMMddHHmmss')
)

$ErrorActionPreference = 'Stop'

Write-Host "== Cleaning previous dist =="
Push-Location client
npm install --no-audit --no-fund | Out-Null
npm run build --silent | Out-Null
Pop-Location

Push-Location server
npm install --no-audit --no-fund | Out-Null
npm run clean --silent 2>$null | Out-Null
npm run build --silent | Out-Null
Pop-Location

# Layout: release/st-albans-$Version/{server,client}
$releaseRoot = Join-Path -Path (Resolve-Path .) -ChildPath "release"
if (!(Test-Path $releaseRoot)) { New-Item -ItemType Directory -Path $releaseRoot | Out-Null }
$packageDir = Join-Path $releaseRoot "st-albans-$Version"
if (Test-Path $packageDir) { Remove-Item -Recurse -Force $packageDir }
New-Item -ItemType Directory -Path $packageDir | Out-Null

# Copy server dist & package.json (prod only)
Write-Host "== Copy server =="
New-Item -ItemType Directory -Path (Join-Path $packageDir 'server') | Out-Null
Copy-Item server\dist -Destination (Join-Path $packageDir 'server') -Recurse
Copy-Item server\package.json (Join-Path $packageDir 'server')

# Copy client dist (Angular outputs to client/dist/bin-collection-app)
Write-Host "== Copy client =="
$clientOut = "client/dist/bin-collection-app"
if (!(Test-Path $clientOut)) { throw "Client build output not found at $clientOut" }
New-Item -ItemType Directory -Path (Join-Path $packageDir 'server' 'client') | Out-Null
Copy-Item $clientOut/* (Join-Path $packageDir 'server' 'client') -Recurse

# Create environment sample
@(
  "# .env file placed alongside dist on Pi",
  "PORT=3000",
  "UPRN=REPLACE_WITH_UPRN",
  "# TEST_MODE=true"
) | Set-Content (Join-Path $packageDir 'server' '.env.sample')

# Create tar.gz
Push-Location $releaseRoot
$tarName = "st-albans-$Version.tar.gz"
Write-Host "== Creating archive $tarName =="
# Use built-in tar (available on recent Windows / Git Bash environment). If not, instruct user.
try {
  tar -czf $tarName "st-albans-$Version"
} catch {
  Write-Warning "Tar command failed. Install tar or compress manually.";
}
Pop-Location

Write-Host "\nCreated release at: $packageDir"
Write-Host "Archive: $releaseRoot\$tarName"
Write-Host "Next: copy archive to Pi and deploy (see README)."
