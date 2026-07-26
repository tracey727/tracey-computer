$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Parse every PowerShell file with the native Windows PowerShell parser.
Get-ChildItem -Path $PSScriptRoot -Filter "*.ps1" | ForEach-Object {
  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count -gt 0) {
    throw "PowerShell parse error in $($_.Name): $($errors | Out-String)"
  }
}

$port = 45123
$env:PORT = "$port"
$env:APP_ACCESS_CODE = "windows-ci-access-code"
$env:OPENAI_API_KEY = ""
$env:ANTHROPIC_API_KEY = ""
$env:GEMINI_API_KEY = ""

$stdout = Join-Path $env:RUNNER_TEMP "genevieve-windows-stdout.log"
$stderr = Join-Path $env:RUNNER_TEMP "genevieve-windows-stderr.log"
$process = Start-Process -FilePath "node.exe" -ArgumentList "server.mjs" -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr

try {
  $deadline = (Get-Date).AddSeconds(25)
  $health = $null
  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) { break }
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
      if ($health.ok) { break }
    } catch {}
    Start-Sleep -Milliseconds 250
  }

  if (-not $health.ok -or $health.service -ne "GENEVIEVE Super Response") {
    $details = ""
    if (Test-Path $stdout) { $details += (Get-Content $stdout -Raw) }
    if (Test-Path $stderr) { $details += (Get-Content $stderr -Raw) }
    throw "Windows server failed to become healthy. $details"
  }

  $home = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 5
  if ($home.StatusCode -ne 200 -or $home.Content -notmatch "GENEVIEVE Super Response") {
    throw "Windows homepage smoke test failed."
  }

  $settings = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/settings" -TimeoutSec 5
  if (-not $settings.writable) { throw "Windows local API settings route was not writable." }

  Write-Host "Windows PowerShell parsing and live Node server smoke test passed."
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
