$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$statePath = ".genevieve-server.json"
if (-not (Test-Path $statePath)) {
  Write-Host "No saved GENEVIEVE server process was found."
  exit 0
}
$state = Get-Content $statePath -Raw | ConvertFrom-Json
if ($state.pid) {
  & taskkill.exe /PID $state.pid /T /F | Out-Null
}
Remove-Item $statePath -Force
Write-Host "GENEVIEVE Super Response has stopped."
