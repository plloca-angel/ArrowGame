# Dev server - LAN or tunnel
param(
  [switch]$Tunnel
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:NODE_OPTIONS = "--use-system-ca"
Remove-Item Env:CI -ErrorAction SilentlyContinue

if (-not $Tunnel) {
  $env:EXPO_OFFLINE = "1"
}

function Stop-PortListener {
  param([int]$Port)
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      if ($procId -and $procId -ne $PID) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

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
  $eth = $candidates | Select-Object -First 1 -ExpandProperty IPAddress
  if ($eth) { return $eth }
  return "192.168.1.33"
}

function Test-NgrokSslBlocked {
  $ngrok = Join-Path $PSScriptRoot "..\node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"
  if (-not (Test-Path $ngrok)) { return $false }
  $out = Join-Path $env:TEMP "expo-ngrok-preflight.txt"
  Remove-Item $out -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath $ngrok -ArgumentList "start","--none","--log=stdout" `
    -RedirectStandardOutput $out -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 6
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  $log = Get-Content $out -ErrorAction SilentlyContinue -Raw
  return ($log -match "x509|unknown authority|lennut|korgn")
}

foreach ($p in 8081, 8085, 8086, 8087, 8088, 8089, 8090) {
  Stop-PortListener -Port $p
}
Start-Sleep -Seconds 1

$port = 8081
$lanIp = Get-LanIp

if (-not $Tunnel) {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
}

$apiUrl = "not set"
if (Test-Path ".env") {
  $line = Get-Content ".env" | Where-Object { $_ -match "^EXPO_PUBLIC_BACKEND_URL=" } | Select-Object -First 1
  if ($line) { $apiUrl = $line -replace "^EXPO_PUBLIC_BACKEND_URL=", "" }
}

Write-Host ""
Write-Host "Arrow Escape dev server" -ForegroundColor Cyan

if ($Tunnel) {
  if (Test-NgrokSslBlocked) {
    Write-Host ""
    Write-Host "TUNNEL BLOCKED on this PC" -ForegroundColor Red
    Write-Host "Antivirus or a proxy is intercepting ngrok SSL (x509 errors)."
    Write-Host "Tunnel mode cannot work until HTTPS scanning is disabled for ngrok,"
    Write-Host "or you use LAN mode instead."
    Write-Host ""
    Write-Host "Use LAN (recommended):" -ForegroundColor Green
    Write-Host "  1. Admin PowerShell: npm run firewall"
    Write-Host "  2. npm run start:dev"
    Write-Host "  3. Phone same Wi-Fi, mobile data OFF"
    Write-Host "  4. Expo Go manual URL: exp://${lanIp}:${port}"
    Write-Host ""
    Write-Host "Or run: npm run diagnose"
    Write-Host ""
    exit 1
  }
  Write-Host "  Mode: TUNNEL - wait up to 2 min for exp.direct QR"
} else {
  Write-Host "  Mode: LAN (recommended)"
  Write-Host "  Phone: same Wi-Fi, mobile data OFF"
  Write-Host "  First time: Admin PowerShell -> npm run firewall"
}

Write-Host "  Metro port: $port"
Write-Host "  PC IP: $lanIp"
Write-Host "  Manual URL: exp://${lanIp}:${port}" -ForegroundColor Green
Write-Host "  API URL: $apiUrl"
Write-Host ""

Remove-Item -Recurse -Force .metro-cache -ErrorAction SilentlyContinue

if ($Tunnel) {
  npx expo start --clear --port $port --tunnel
} else {
  npx expo start --clear --port $port --lan
}
