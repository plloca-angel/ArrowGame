# Plain Expo start with offline mode + system CA (avoids fetch failed / TLS errors)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:NODE_OPTIONS = "--use-system-ca"
$env:EXPO_OFFLINE = "1"

npx expo start --clear @args
