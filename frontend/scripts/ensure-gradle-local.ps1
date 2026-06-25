# Downloads Gradle into the project so the wrapper does not need HTTPS at build time.
param(
  [string]$Version = "8.14.3"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$cacheDir = Join-Path $Root ".gradle-local"
$zipName = "gradle-$Version-bin.zip"
$zipPath = Join-Path $cacheDir $zipName
$url = "https://services.gradle.org/distributions/$zipName"

if (Test-Path $zipPath) {
  Write-Host "Using cached Gradle: $zipPath" -ForegroundColor DarkGray
  return $zipPath
}

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
Write-Host "Downloading Gradle $Version to local cache..." -ForegroundColor Cyan
Write-Host "(Your network SSL inspection blocks the Gradle wrapper; this is a one-time download.)" -ForegroundColor Yellow

$downloaded = $false
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
  & curl.exe -L -k --retry 3 -o $zipPath $url
  if ($LASTEXITCODE -eq 0 -and (Test-Path $zipPath) -and ((Get-Item $zipPath).Length -gt 1MB)) {
    $downloaded = $true
  }
}

if (-not $downloaded) {
  try {
    Invoke-WebRequest -Uri $url -OutFile $zipPath -SkipCertificateCheck
    $downloaded = $true
  } catch {
    # PowerShell 5.x fallback
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    $downloaded = $true
  }
}

if (-not (Test-Path $zipPath) -or (Get-Item $zipPath).Length -lt 1MB) {
  throw @"
Could not download Gradle.

Try manually:
  1. Download $url in a browser
  2. Save as: $zipPath
  3. Re-run: npm run build:apk:local

Or use cloud build instead: npm run build:apk:cloud
"@
}

Write-Host "Gradle cached at $zipPath" -ForegroundColor Green
return $zipPath
