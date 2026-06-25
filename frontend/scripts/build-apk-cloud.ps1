$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$env:EXPO_PUBLIC_NATIVE_ADS_BUILD = "true"
Write-Host "Starting EAS cloud build (APK)..." -ForegroundColor Cyan
Write-Host "You need: npx eas-cli login (once), then this command." -ForegroundColor Yellow
npx eas-cli build --platform android --profile preview @args
