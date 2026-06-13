# Diagnose why Expo Go / ngrok tunnel fails on this PC.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..

function Get-LanIp {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.IPAddress -notlike "192.168.56.*" -and
      $_.PrefixOrigin -ne "WellKnown" -and
      $_.InterfaceAlias -notmatch "VirtualBox|VMware|WSL|Hyper-V|vEthernet|Loopback"
    } |
    Sort-Object InterfaceMetric
  $wifi = $candidates |
    Where-Object { $_.InterfaceAlias -match "Wi-Fi|WiFi|Wireless|WLAN" } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($wifi) { return $wifi }
  return ($candidates | Select-Object -First 1 -ExpandProperty IPAddress)
}

Write-Host ""
Write-Host "Expo network diagnosis" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

$lanIp = Get-LanIp
Write-Host ""
Write-Host "1) LAN IP for Expo Go: $lanIp"
Write-Host "   Manual URL: exp://${lanIp}:8081"

Write-Host ""
Write-Host "2) Firewall rules for Metro (8081):"
$rules = netsh advfirewall firewall show rule name="Expo Metro TCP 8081" 2>$null
if ($rules -match "No rules") {
  Write-Host "   MISSING - run as Admin: npm run firewall" -ForegroundColor Red
} else {
  Write-Host "   OK - rule exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "3) ngrok SSL test (tunnel mode):"
$ngrok = Join-Path $PSScriptRoot "..\node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"
if (-not (Test-Path $ngrok)) {
  Write-Host "   ngrok binary not found - run npm install" -ForegroundColor Yellow
} else {
  $out = Join-Path $env:TEMP "expo-ngrok-test.txt"
  Remove-Item $out -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath $ngrok -ArgumentList "start","--none","--log=stdout" `
    -RedirectStandardOutput $out -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 8
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  $log = Get-Content $out -ErrorAction SilentlyContinue
  $sslIssue = $log | Where-Object { $_ -match "x509|unknown authority|lennut|korgn" }
  if ($sslIssue) {
    Write-Host "   FAILED - SSL is being intercepted (antivirus / proxy)" -ForegroundColor Red
    Write-Host "   Tunnel mode will NOT work until you fix this." -ForegroundColor Red
    Write-Host ""
    Write-Host "   Fix options:" -ForegroundColor Yellow
    Write-Host "   a) Use LAN instead: npm run start:dev (same Wi-Fi + npm run firewall)"
    Write-Host "   b) Turn off HTTPS/SSL scanning in your antivirus for ngrok.exe"
    Write-Host "   c) Use Windows Mobile Hotspot: PC shares internet, phone connects to PC"
    Write-Host ""
    Write-Host "   Sample ngrok log:"
    $sslIssue | Select-Object -First 3 | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
  } elseif ($log -match "starting web service") {
    Write-Host "   OK - ngrok agent started locally" -ForegroundColor Green
    Write-Host "   If tunnel still times out, retry or check https://status.ngrok.com/"
  } else {
    Write-Host "   UNKNOWN - could not read ngrok output" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "4) Recommended path when tunnel fails:"
Write-Host "   - Admin PowerShell: npm run firewall"
Write-Host "   - Phone: same Wi-Fi, mobile data OFF"
Write-Host "   - Start: npm run start:dev"
Write-Host "   - Expo Go: enter exp://${lanIp}:8081"
Write-Host ""
