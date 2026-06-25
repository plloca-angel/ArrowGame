# Writes android/local.properties when ANDROID_HOME is set or SDK is in a default location.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$localProps = Join-Path $Root "android\local.properties"

function Find-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
    (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
    "C:\Android\Sdk"
  ) | Where-Object { $_ -and (Test-Path $_) }

  return $candidates | Select-Object -First 1
}

$sdk = Find-AndroidSdk
if (-not $sdk) {
  throw @"
Android SDK not found.

Install Android Studio (recommended):
  https://developer.android.com/studio

Then either:
  1. Open Android Studio once and complete SDK setup, or
  2. Set ANDROID_HOME to your SDK folder, e.g.:
     `$env:ANDROID_HOME = `"$env:LOCALAPPDATA\Android\Sdk`"

After that, re-run: npm run build:apk:local

Cloud build (no local SDK): npm run build:apk:cloud
"@
}

$sdkUnix = ($sdk -replace '\\', '/')
$content = "sdk.dir=$sdkUnix`n"
Set-Content -Path $localProps -Value $content -NoNewline
Write-Host "Using Android SDK: $sdk" -ForegroundColor DarkGray
return $sdk
