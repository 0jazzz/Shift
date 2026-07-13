# Run this script as Administrator to add Windows Defender exclusions
# This will significantly speed up npm/node/vite operations

$projectPath = Split-Path -Parent $PSScriptRoot

# Add exclusions for the project folder and node binaries
Add-MpPreference -ExclusionPath $projectPath
Add-MpPreference -ExclusionPath "$env:APPDATA\npm"
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\npm-cache"
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "esbuild.exe"

Write-Host "Added Windows Defender exclusions for:"
Write-Host "  - $projectPath"
Write-Host "  - $env:APPDATA\npm"
Write-Host "  - $env:LOCALAPPDATA\npm-cache"
Write-Host "  - node.exe process"
Write-Host "  - esbuild.exe process"
Write-Host ""
Write-Host "Please restart your terminal and run 'npm run dev' again."
