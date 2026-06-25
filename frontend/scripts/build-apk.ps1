# Builds a sideloadable Android APK (debug, unsigned for quick testing).
# Requires Android SDK + Java. For release APKs use: npm run build:apk:cloud
param(
  [ValidateSet("debug", "release")]
  [string]$Variant = "debug"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:EXPO_PUBLIC_NATIVE_ADS_BUILD = "true"

Write-Host "Generating native Android project..." -ForegroundColor Cyan
npx expo prebuild --platform android --clean

if (-not (Test-Path "android\gradlew.bat")) {
  throw "Android project was not created."
}

Write-Host "Building $Variant APK (this can take several minutes)..." -ForegroundColor Cyan
Push-Location android
try {
  if ($Variant -eq "debug") {
    .\gradlew.bat assembleDebug
    $apk = Get-ChildItem -Recurse -Filter "app-debug.apk" "app\build\outputs\apk\debug" | Select-Object -First 1
  } else {
    .\gradlew.bat assembleRelease
    $apk = Get-ChildItem -Recurse -Filter "app-release.apk" "app\build\outputs\apk\release" | Select-Object -First 1
  }
} finally {
  Pop-Location
}

if (-not $apk) {
  throw "APK not found after build."
}

$dest = Join-Path (Get-Location) "dist\arrow-escape-$Variant.apk"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
Copy-Item $apk.FullName $dest -Force
Write-Host ""
Write-Host "APK ready:" -ForegroundColor Green
Write-Host $dest
