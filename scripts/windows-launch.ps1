$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Show-Message([string]$message, [string]$title = "GENEVIEVE Super Response") {
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    [System.Windows.MessageBox]::Show($message, $title) | Out-Null
  } catch {
    Write-Host $message
  }
}

function Test-GenevieveHealth([int]$port) {
  try {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -Method Get -TimeoutSec 2
    return ($result.ok -eq $true -and $result.service -eq "GENEVIEVE Super Response")
  } catch {
    return $false
  }
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Show-Message "Node.js is not installed. Install the current Node.js LTS version, then double-click START-GENEVIEVE.bat again."
  Start-Process "https://nodejs.org/en/download"
  exit 1
}

if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
}

# Reuse an existing GENEVIEVE server if one is already running.
foreach ($candidate in 3000..3015) {
  if (Test-GenevieveHealth $candidate) {
    Start-Process "http://127.0.0.1:$candidate/#api-setup"
    exit 0
  }
}

# Select the first unused port. Using 127.0.0.1 and opening it automatically avoids browser search mistakes.
$port = $null
foreach ($candidate in 3000..3015) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
    $listener.Start()
    $listener.Stop()
    $port = $candidate
    break
  } catch {
    if ($listener) { try { $listener.Stop() } catch {} }
  }
}

if (-not $port) {
  Show-Message "GENEVIEVE could not find a free local port between 3000 and 3015. Close another local server and try again."
  exit 1
}

$logDirectory = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$logPath = Join-Path $logDirectory "server.log"
$escapedRoot = $root.Replace('"','\"')
$escapedNode = $nodeCommand.Source.Replace('"','\"')
$escapedLog = $logPath.Replace('"','\"')
$command = "set PORT=$port&& cd /d `"$escapedRoot`" && `"$escapedNode`" server.mjs >> `"$escapedLog`" 2>&1"
$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/c", $command -WindowStyle Hidden -PassThru

$state = @{ pid = $process.Id; port = $port; started = (Get-Date).ToString("o") }
$state | ConvertTo-Json | Set-Content -Path ".genevieve-server.json" -Encoding UTF8

$deadline = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $deadline) {
  if ($process.HasExited) { break }
  if (Test-GenevieveHealth $port) {
    Start-Process "http://127.0.0.1:$port/#api-setup"
    exit 0
  }
  Start-Sleep -Milliseconds 250
}

$tail = ""
if (Test-Path $logPath) {
  $tail = (Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
}
Show-Message "GENEVIEVE did not start correctly.`n`n$tail`n`nRun TEST-BEFORE-DEPLOY.bat and send the displayed error if it continues."
exit 1
