$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "GENEVIEVE Super Response.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $root "START-GENEVIEVE.bat"
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Open GENEVIEVE Super Response"
$shortcut.Save()
Write-Host "Desktop shortcut created: $shortcutPath"
