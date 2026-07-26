$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Read-EnvFile([string]$path) {
  $values = @{}
  if (-not (Test-Path $path)) { return $values }
  foreach ($line in Get-Content $path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) { continue }
    $parts = $trimmed.Split("=", 2)
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $values
}

function Set-EnvValue([string]$path, [string]$name, [string]$value) {
  $lines = @()
  if (Test-Path $path) { $lines = @(Get-Content $path) }
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$([regex]::Escape($name))\s*=") {
      $lines[$i] = "$name=$value"
      $found = $true
    }
  }
  if (-not $found) { $lines += "$name=$value" }
  Set-Content -Path $path -Value $lines -Encoding UTF8
}

function New-AccessCode {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_'))
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required. Install Node.js LTS first."
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "npm/npx is required. Reinstall Node.js LTS with npm enabled."
}
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
}

Write-Host "`n[1/6] Running the complete deployment verification..." -ForegroundColor Cyan
& npm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw "Project verification failed. No deployment was attempted." }

$envPath = Join-Path $root ".env.local"
$values = Read-EnvFile $envPath
$providerNames = @("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY")
$hasProvider = $false
foreach ($name in $providerNames) {
  if ($values[$name]) { $hasProvider = $true }
}
if (-not $hasProvider) {
  throw "No provider API key is saved. Start GENEVIEVE, paste at least one API key, select Save keys and test connections, then run this deployment wizard again."
}

if (-not $values["APP_ACCESS_CODE"]) {
  $values["APP_ACCESS_CODE"] = New-AccessCode
  Set-EnvValue $envPath "APP_ACCESS_CODE" $values["APP_ACCESS_CODE"]
  Write-Host "A strong private APP_ACCESS_CODE was generated and saved locally." -ForegroundColor Green
}

Write-Host "`n[2/6] Signing in and linking the Vercel project..." -ForegroundColor Cyan
& npx.cmd --yes vercel@latest link
if ($LASTEXITCODE -ne 0) { throw "Vercel login or project linking was cancelled or failed." }

Write-Host "`n[3/6] Uploading provider keys as sensitive server variables..." -ForegroundColor Cyan
$secretNames = @("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "APP_ACCESS_CODE")
foreach ($name in $secretNames) {
  $value = $values[$name]
  if (-not $value) { continue }
  foreach ($target in @("production", "preview")) {
    Write-Host "  Setting $name for $target (secret value hidden)..."
    $value | & npx.cmd --yes vercel@latest env add $name $target --force --sensitive
    if ($LASTEXITCODE -ne 0) { throw "Vercel could not save $name for $target." }
  }
}

Write-Host "`n[4/6] Creating the production deployment..." -ForegroundColor Cyan
$deployOutput = & npx.cmd --yes vercel@latest deploy --prod --yes 2>&1 | Tee-Object -Variable captured
if ($LASTEXITCODE -ne 0) { throw "Vercel deployment failed. Review the Vercel output above." }
$text = ($captured | Out-String)
$matches = [regex]::Matches($text, 'https://[^\s]+\.vercel\.app')
if ($matches.Count -eq 0) { throw "Deployment finished but the production URL could not be detected." }
$url = $matches[$matches.Count - 1].Value.TrimEnd('.')

Write-Host "`n[5/6] Verifying the live homepage and server routes..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$url/api/health" -Method Get -TimeoutSec 30
if (-not $health.ok -or $health.service -ne "GENEVIEVE Super Response") {
  throw "The live health route did not return the expected GENEVIEVE service response."
}
$headers = @{ "x-app-access-code" = $values["APP_ACCESS_CODE"] }
$diagnostics = Invoke-RestMethod -Uri "$url/api/diagnostics" -Method Post -Headers $headers -TimeoutSec 60
if (($diagnostics.summary.ready + $diagnostics.summary.modelUnavailable) -lt 1) {
  throw "The deployment is live, but no provider accepted its server API settings. Open the live app to read the provider-specific diagnostic message."
}

Write-Host "`n[6/6] DEPLOYMENT VERIFIED" -ForegroundColor Green
Write-Host "Live app: $url" -ForegroundColor Green
Write-Host "The homepage, health route, access protection and provider diagnostics all responded from Vercel." -ForegroundColor Green
try {
  Set-Clipboard -Value $values["APP_ACCESS_CODE"]
  Write-Host "Your private app access code has been copied to the clipboard. Paste it into the live app when requested." -ForegroundColor Yellow
} catch {
  Write-Host "Private app access code: $($values["APP_ACCESS_CODE"])" -ForegroundColor Yellow
}
Start-Process $url
