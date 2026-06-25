$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$env:EXPO_PUBLIC_NATIVE_ADS_BUILD = "true"
npx expo prebuild --platform android --clean @args
