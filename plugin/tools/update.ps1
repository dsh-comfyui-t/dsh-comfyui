# dsh-comfyui-console :: in-place updater (PowerShell 5.1 compatible, ASCII only)
#
# Replaces plugin CODE only. Never touches config.json, workDir, cardsDir or outputDir,
# so an update never needs a reinstall and never loses user data.
#
# Examples
#   .\tools\update.ps1 -Source D:\dl\dsh-comfyui-console-0.5.0           # directory
#   .\tools\update.ps1 -Source D:\dl\dsh-comfyui-console-0.5.0.zip       # zip
#   .\tools\update.ps1 -Source D:\dl\dsh-comfyui-console-0.5.0.tgz       # npm pack tarball
#   .\tools\update.ps1 -Source D:\dl\next -DryRun                        # show plan only
#   .\tools\update.ps1 -Source D:\dl\next -Force                         # same version allowed
#
# After a successful update: restart the DSH web process (module cache is per process).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$PluginDir = 'D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin',
    [string]$Profile = '0.2.0-rc.2',
    [string]$NodeExe = 'node',
    [string]$PythonExe = '',
    [switch]$DryRun,
    [switch]$SkipVerify,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
function Info([string]$m) { Write-Host "[update] $m" }
function Fail([string]$m) { Write-Host "[update][FAIL] $m" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $PluginDir)) { Fail "plugin dir not found: $PluginDir" }
$pkgPath = Join-Path $PluginDir 'package.json'
if (-not (Test-Path $pkgPath)) { Fail "package.json not found in $PluginDir" }
$cur = Get-Content $pkgPath -Raw | ConvertFrom-Json
Info ("current: " + $cur.name + " " + $cur.version + " (configVersion " + $cur.dsh.configVersion + ")")

# ---------- 1. stage the source ----------
$stage = Join-Path $env:TEMP ('comfyui-console-stage-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null

if (Test-Path $Source -PathType Container) {
    Info "source is a directory, staging..."
    Copy-Item (Join-Path $Source '*') $stage -Recurse -Force
} elseif ($Source -match '\.zip$') {
    Info "source is a zip, expanding..."
    Expand-Archive -LiteralPath $Source -DestinationPath $stage -Force
} elseif ($Source -match '\.(tgz|tar\.gz)$') {
    Info "source is a tarball, extracting..."
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (-not (Test-Path $tar)) { Fail 'tar.exe not found (Windows 10+ required)' }
    & $tar -xzf $Source -C $stage
    if ($LASTEXITCODE -ne 0) { Fail 'tar failed' }
} else {
    Fail "unsupported source (expect dir / .zip / .tgz): $Source"
}

# package root may be nested one level (npm pack uses "package/")
$srcPkg = Get-ChildItem $stage -Recurse -Filter 'package.json' -File |
    Where-Object { $_.DirectoryName -notmatch '\\node_modules\\' } |
    Sort-Object { $_.FullName.Length } | Select-Object -First 1
if (-not $srcPkg) { Fail 'no package.json found in source' }
$srcRoot = $srcPkg.DirectoryName
$new = Get-Content $srcPkg.FullName -Raw | ConvertFrom-Json
Info ("incoming: " + $new.name + " " + $new.version + " (configVersion " + $new.dsh.configVersion + ")")

if ($new.name -ne 'dsh-comfyui-console') { Fail "package name mismatch: $($new.name)" }
if (-not $new.version) { Fail 'incoming package has no version' }
if ($new.version -eq $cur.version -and -not $Force) {
    Fail ("same version " + $new.version + " - pass -Force to overwrite anyway")
}

# ---------- 2. plan ----------
$codeItems = @('lib', 'tools', 'expander.py', 'sidecar_auth.py', 'sidecar_cards.py', 'sidecar_comfy.py', 'sidecar_config.py', 'sidecar_llm.py', 'sidecar_pack.py', 'sidecar_routes.py', 'sidecar_state.py', 'sidecar_util.py', 'routes.json',
               'cordis.patch.yml', 'install.ps1', 'README.md', 'CHANGELOG.md', 'config.example.json')
$plan = @()
foreach ($it in $codeItems) {
    $from = Join-Path $srcRoot $it
    if (Test-Path $from) { $plan += $it }
}
# extra root-level json (e.g. model/source tables) except the three that must never be overwritten blindly
Get-ChildItem $srcRoot -Filter '*.json' -File | ForEach-Object {
    if ($_.Name -notin @('package.json', 'config.json', 'config.example.json')) {
        if ($plan -notcontains $_.Name) { $plan += $_.Name }
    }
}
Info ("will replace: " + ($plan -join ', '))
Info 'will keep   : config.json, workDir, cardsDir, outputDir, user json tables, .bak-*'

if ($DryRun) {
    Info 'dry run - nothing written'
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    exit 0
}

# ---------- 3. backup ----------
$bakRoot = Join-Path $PluginDir ('.bak-update-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $bakRoot -Force | Out-Null
foreach ($it in @('lib', 'expander.py', 'sidecar_auth.py', 'sidecar_cards.py', 'sidecar_comfy.py', 'sidecar_config.py', 'sidecar_llm.py', 'sidecar_pack.py', 'sidecar_routes.py', 'sidecar_state.py', 'sidecar_util.py', 'package.json')) {
    $p = Join-Path $PluginDir $it
    if (Test-Path $p) { Copy-Item $p (Join-Path $bakRoot $it) -Recurse -Force }
}
Info ("backup: " + $bakRoot)

# ---------- 4. copy code ----------
foreach ($it in $plan) {
    $from = Join-Path $srcRoot $it
    $to = Join-Path $PluginDir $it
    if (Test-Path $to -PathType Container) { Remove-Item $to -Recurse -Force }
    elseif (Test-Path $to) { Remove-Item $to -Force }
    Copy-Item $from $to -Recurse -Force
    Info ("  replaced " + $it)
}
# package.json last (version bump is what /version compares against)
Copy-Item $srcPkg.FullName $pkgPath -Force
Info '  replaced package.json'

# ---------- 5. verify ----------
if (-not $SkipVerify) {
    $js = Join-Path $PluginDir 'lib\index.js'
    $cl = Join-Path $PluginDir 'lib\client.js'
    foreach ($f in @($js, $cl)) {
        if (Test-Path $f) {
            & $NodeExe --check $f
            if ($LASTEXITCODE -ne 0) { Fail ("node --check failed: " + $f) }
        }
    }
    $py = if ($PythonExe) { $PythonExe } else { (Get-Command python -ErrorAction SilentlyContinue).Source }
    if ($py) {
        Get-ChildItem (Join-Path $PluginDir '*.py') | ForEach-Object {
              & $py -m py_compile $_.FullName
              if ($LASTEXITCODE -ne 0) { Fail ('py_compile failed: ' + $_.Name) }
          }
        if ($LASTEXITCODE -ne 0) { Fail 'py_compile failed: expander.py' }
    } else {
        Info 'python not found - skipped py_compile'
    }
    $dsh = (Get-Command dsh -ErrorAction SilentlyContinue)
    if ($dsh) {
        & $dsh.Source --profile $Profile --dump-config | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail ("dsh --dump-config failed (profile " + $Profile + ")") }
        Info 'dsh --dump-config OK'
    } else {
        Info 'dsh CLI not found - skipped composition check'
    }
}

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Info ("done: " + $cur.version + " -> " + $new.version)
Info 'NEXT: restart the DSH web process. Page reload alone is not enough (ESM cache is per process).'
Info 'ROLLBACK: copy the files back from the backup dir printed above, then restart again.'
exit 0
