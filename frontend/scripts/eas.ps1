# Run EAS CLI with Node using the Windows certificate store (fixes SSL inspection on many networks).
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$EasArgs
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not $EasArgs -or $EasArgs.Count -eq 0) {
  throw "No EAS command provided. Examples: login, init, build --platform android --profile preview"
}

$env:NODE_OPTIONS = "--use-system-ca"

$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) {
  & $eas.Source @EasArgs
  exit $LASTEXITCODE
}

& npx @("--yes", "--package", "eas-cli@16.17.4", "eas") @EasArgs
exit $LASTEXITCODE
