# ASCII-only script for PowerShell 5.1 / 7. Requires explicit target plugin directory.
# Copies release code only; never copies config.json, secrets or runtime logs.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$PluginDir,
    [string]$Source = '',
    [switch]$DryRun
)
$ErrorActionPreference='Stop'
if (-not $Source) { $Source=Split-Path -Parent $PSScriptRoot }
# The source is normally the release's plugin/ directory.
if (Test-Path (Join-Path $Source 'plugin\package.json')) { $Source=Join-Path $Source 'plugin' }
$sourcePkg=Join-Path $Source 'package.json'
if (-not (Test-Path -LiteralPath $sourcePkg)) { throw 'Source package.json missing' }
$pkg=Get-Content -LiteralPath $sourcePkg -Raw | ConvertFrom-Json
# Validate the package identity, not a frozen release number: the version moves
# with every maintenance build and a hard-coded one silently breaks this script.
if ($pkg.name -ne '@local/dsh-comfyui-console') { throw 'Unexpected source package name' }
if ([string]::IsNullOrWhiteSpace([string]$pkg.version) -or ([string]$pkg.version) -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$') { throw 'Source package.json must declare a semantic version' }
if (-not (Test-Path (Join-Path $Source 'lib\index.js')) -or -not (Test-Path (Join-Path $Source 'expander.py'))) { throw 'Incomplete plugin source' }
$PluginDir=[System.IO.Path]::GetFullPath($PluginDir)
$Source=[System.IO.Path]::GetFullPath($Source)
if ($PluginDir.TrimEnd('\','/') -eq $Source.TrimEnd('\','/')) { throw 'Source and target must differ' }
if (-not (Test-Path -LiteralPath $PluginDir)) {
    if ($DryRun) { Write-Host "[dry-run] Create $PluginDir" }
    else { New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null }
}
. (Join-Path $PSScriptRoot 'release_files.ps1')
$files=@(Get-ChildItem -LiteralPath $Source -Recurse -File -Force | Where-Object {
    $relative=$_.FullName.Substring($Source.Length).TrimStart('\','/')
    -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and (Test-ReleasePath $relative)
})
$backup=Join-Path (Split-Path -Parent $PluginDir) ('dsh-comfyui-console-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$hasBackup=$false
foreach($file in $files) {
    $relative=$file.FullName.Substring($Source.Length).TrimStart('\','/')
    $destination=Join-Path $PluginDir $relative
    if($DryRun) { Write-Host ('[dry-run] ' + $relative); continue }
    $parent=Split-Path -Parent $destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $destination) {
        $save=Join-Path $backup $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $save) -Force | Out-Null
        Copy-Item -LiteralPath $destination -Destination $save -Force
        $hasBackup=$true
    }
    Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}
$config=Join-Path $PluginDir 'config.json'
if (-not $DryRun -and -not (Test-Path -LiteralPath $config)) {
    $example=Join-Path $PluginDir 'config.example.json'
    $data=Get-Content -LiteralPath $example -Raw | ConvertFrom-Json
    $data.instanceId=[guid]::NewGuid().ToString()
    $data | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $config -Encoding UTF8
    Write-Host '[install] Created new config.json; set ComfyUI paths as needed.'
}
if ($DryRun) { Write-Host '[dry-run] No changes made.' }
else {
    if ($hasBackup) { Write-Host "[backup] $backup" }
    Write-Host ('[complete] Updated to ' + $pkg.version + '. Fully exit DSH (including background host) before restarting.')
}
