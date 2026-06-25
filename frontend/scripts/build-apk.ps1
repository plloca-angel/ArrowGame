# Builds a sideloadable Android APK (debug, unsigned for quick testing).
# Requires Android SDK + Java. For release APKs use: npm run build:apk:cloud
param(
  [ValidateSet("debug", "release")]
  [string]$Variant = "debug",
  [switch]$SkipPrebuild
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:EXPO_PUBLIC_NATIVE_ADS_BUILD = "true"

if (-not $SkipPrebuild -or -not (Test-Path "android\gradlew.bat")) {
  Write-Host "Generating native Android project..." -ForegroundColor Cyan
  npx expo prebuild --platform android --clean
  $append = Join-Path $PSScriptRoot "gradle.properties.append"
  if (Test-Path $append) {
    Add-Content -Path "android\gradle.properties" -Value (Get-Content $append -Raw)
  }
} else {
  Write-Host "Skipping prebuild (android/ already exists). Pass without -SkipPrebuild to regenerate." -ForegroundColor DarkGray
}

if (-not (Test-Path "android\gradlew.bat")) {
  throw "Android project was not created."
}

$gradleZip = & (Join-Path $PSScriptRoot "ensure-gradle-local.ps1")
$wrapperProps = Join-Path (Get-Location) "android\gradle\wrapper\gradle-wrapper.properties"
$originalProps = Get-Content $wrapperProps -Raw
$unixPath = ($gradleZip -replace '\\', '/')
$localDistributionUrl = "distributionUrl=file\:///$unixPath"

try {
  $patchedProps = ($originalProps -replace 'distributionUrl=.*', $localDistributionUrl)
  Set-Content -Path $wrapperProps -Value $patchedProps -NoNewline

  Write-Host "Building $Variant APK (this can take several minutes)..." -ForegroundColor Cyan
  $env:GRADLE_OPTS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT"
  & (Join-Path $PSScriptRoot "ensure-android-sdk.ps1") | Out-Null
  Push-Location android
  try {
    if ($Variant -eq "debug") {
      .\gradlew.bat assembleDebug --no-daemon
    } else {
      .\gradlew.bat assembleRelease --no-daemon
    }
    $gradleExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if ($gradleExit -ne 0) {
    throw @"
Gradle build failed (exit code $gradleExit).

Common fixes:
  - Install Android Studio + Android SDK
  - Set ANDROID_HOME to your SDK path
  - Or use cloud build: npm run build:apk:cloud
"@
  }

  $apkDir = if ($Variant -eq "debug") {
    "android\app\build\outputs\apk\debug"
  } else {
    "android\app\build\outputs\apk\release"
  }

  if (-not (Test-Path $apkDir)) {
    throw "Build finished but APK folder missing: $apkDir"
  }

  $apk = Get-ChildItem -Recurse -Filter "app-$Variant.apk" $apkDir | Select-Object -First 1
  if (-not $apk) {
    throw "APK not found under $apkDir"
  }

  $dest = Join-Path (Get-Location) "dist\arrow-escape-$Variant.apk"
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item $apk.FullName $dest -Force
  Write-Host ""
  Write-Host "APK ready:" -ForegroundColor Green
  Write-Host $dest
} finally {
  Set-Content -Path $wrapperProps -Value $originalProps -NoNewline
}
