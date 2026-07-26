$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Start-Process "https://git-scm.com/download/win"
  throw "Git is not installed. The Git for Windows download page has been opened."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Start-Process "https://cli.github.com/"
  throw "GitHub CLI is not installed. Install it, then run this file again."
}

& npm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw "Verification failed, so GitHub publishing was stopped." }

& gh.exe auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  & gh.exe auth login
  if ($LASTEXITCODE -ne 0) { throw "GitHub login failed or was cancelled." }
}

$login = (& gh.exe api user --jq .login).Trim()
if ($login) {
  & git.exe config user.name $login
  & git.exe config user.email "$login@users.noreply.github.com"
}

$repoName = Read-Host "Private GitHub repository name [genevieve-super-response]"
if (-not $repoName) { $repoName = "genevieve-super-response" }

if (-not (Test-Path ".git")) {
  & git.exe init
  & git.exe branch -M main
}
& git.exe add -A
& git.exe commit -m "GENEVIEVE Super Response v1.6 deployment-fixed build"
if ($LASTEXITCODE -ne 0) {
  Write-Host "No new files needed committing, or Git requires your user name/email. Continuing to repository check."
}

$remote = (& git.exe remote get-url origin 2>$null)
if (-not $remote) {
  & gh.exe repo create $repoName --private --source . --remote origin --push
  if ($LASTEXITCODE -ne 0) { throw "GitHub repository creation or push failed." }
} else {
  & git.exe push -u origin main
  if ($LASTEXITCODE -ne 0) { throw "GitHub push failed." }
}

Write-Host "GitHub publishing completed. The included GitHub Action will run all tests on every push." -ForegroundColor Green
& gh.exe repo view --web
