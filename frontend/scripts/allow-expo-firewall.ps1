# Run ONCE as Administrator:
#   cd E:\ArrowEscape\ArrowGame\frontend
#   npm run firewall
#
# Allows Expo Go on your phone to reach Metro on this PC.

$ports = 8081, 19000, 19001, 19002

foreach ($port in $ports) {
  $name = "Expo Metro TCP $port"
  netsh advfirewall firewall delete rule name="$name" 2>$null | Out-Null
  netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port | Out-Null
  Write-Host "Added inbound rule: $name"
}

$ngrok = Join-Path $PSScriptRoot "..\node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"
if (Test-Path $ngrok) {
  $ngrokPath = (Resolve-Path $ngrok).Path
  $ruleName = "Expo ngrok outbound"
  netsh advfirewall firewall delete rule name="$ruleName" 2>$null | Out-Null
  netsh advfirewall firewall add rule name="$ruleName" dir=out action=allow program="$ngrokPath" enable=yes | Out-Null
  Write-Host "Added outbound rule for ngrok.exe"
}

Write-Host ""
Write-Host "Done. Use LAN mode: npm run start:dev" -ForegroundColor Green
Write-Host "If tunnel still fails, SSL scanning in antivirus may be blocking ngrok." -ForegroundColor Yellow
Write-Host "Run: npm run diagnose" -ForegroundColor Yellow
