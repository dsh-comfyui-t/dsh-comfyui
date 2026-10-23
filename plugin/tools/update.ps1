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
    [string]$PluginDir = '',
    [string]$Profile = '0.2.0-rc.2',
    [string]$NodeExe = 'node',
    [string]$PythonExe = '',
    [switch]$DryRun,
    [switch]$SkipVerify,
    [switch]$Force
)

if (-not $PluginDir) { $PluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }

$ErrorActionPreference = 'Stop'
function Info([string]$m) { Write-Host "[update] $m" }
function Fail([string]$m) { Write-Host "[update][FAIL] $m" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $PluginDir)) { Fail "plugin dir not found: $PluginDir" }
$PluginDir = (Resolve-Path $PluginDir).Path
Info ("target: " + $PluginDir)
# Same-directory trap: running the updater that ships INSIDE a freshly extracted
# package makes the default target that same package ("same version" failure that
# looks like a version bug). Run the copy from your INSTALLED plugin dir instead.
if (Test-Path $Source) {
    $srcFull = (Resolve-Path $Source).Path
    if ($srcFull.TrimEnd('\') -ieq $PluginDir.TrimEnd('\')) {
        Fail ("source and target are the same directory: " + $srcFull + " -- run tools/update.ps1 from the INSTALLED plugin dir, or pass -PluginDir <installed plugin dir>")
    }
}
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

# ---------- 2. plan: sync the whole source payload, never touch user data ----------
# 0.7.83: this list used to be HARD-CODED. Every new sidecar_*.py then stayed behind on
# update: the version bumped, the module did not arrive, and the sidecar died with
# ModuleNotFoundError while /version cheerfully reported the new version
# (2026-10-22 report: sidecar_dirs.py / sidecar_loras.py). The plan is now derived
# from the source tree, with an explicit deny list for user data.
$keepNames = @('package.json', 'config.json', 'routes.json', 'sidecar-token.txt')
$keepDirs  = @('work', '__pycache__', 'node_modules', '.git', '.pytest_cache')
function Test-Keep([string]$rel) {
    foreach ($p in ($rel -split '\\')) { if ($keepDirs -contains $p) { return $true } }
    $leaf = ($rel -split '\\')[-1]
    if ($keepNames -contains $leaf) { return $true }
    if ($leaf -match '\.(pyc|bak|orig|rej)$' -or $leaf -like '*.bak-*') { return $true }
    return $false
}

$plan = New-Object System.Collections.ArrayList
Get-ChildItem $srcRoot -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($srcRoot.Length + 1)
    if (-not (Test-Keep $rel)) { [void]$plan.Add($rel) }
}
if ($plan.Count -eq 0) { Fail 'source contains no files to install' }
Info ("will replace: " + $plan.Count + " files")
$plan | Select-Object -First 12 | ForEach-Object { Info ("  + " + $_) }
if ($plan.Count -gt 12) { Info ("  ... +" + ($plan.Count - 12) + " more") }
Info 'will keep   : package.json (replaced last), config.json, routes.json, sidecar-token.txt, work/, *.bak-*'

if ($DryRun) {
    Info 'dry run - nothing written'
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    exit 0
}

# ---------- 3. backup (mirrors exactly what is about to be replaced) ----------
$bakRoot = Join-Path $PluginDir ('.bak-update-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $bakRoot -Force | Out-Null
$bakCount = 0
foreach ($rel in $plan) {
    $p = Join-Path $PluginDir $rel
    if (Test-Path $p -PathType Leaf) {
        $dst = Join-Path $bakRoot $rel
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        Copy-Item $p $dst -Force
        $bakCount++
    }
}
Copy-Item $pkgPath (Join-Path $bakRoot 'package.json') -Force
Info ("backup: " + $bakRoot + " (" + $bakCount + " files)")

# ---------- 4. copy code ----------
$copied = 0
foreach ($rel in $plan) {
    $from = Join-Path $srcRoot $rel
    $to = Join-Path $PluginDir $rel
    $toDir = Split-Path $to -Parent
    if (-not (Test-Path $toDir)) { New-Item -ItemType Directory -Path $toDir -Force | Out-Null }
    Copy-Item $from $to -Force
    $copied++
}
Info ("  replaced " + $copied + " files")
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
    # import coverage: every sidecar_*.py the code imports must exist after the copy.
    # "version is right, file is missing" is the worst failure mode there is (0.7.82 report).
    $missing = @()
    Get-ChildItem $PluginDir -Filter '*.py' -File | ForEach-Object {
        $fn = $_.Name
        $txt = Get-Content $_.FullName -Raw
        foreach ($m in [regex]::Matches($txt, '(?m)^\s*(?:from|import)\s+(sidecar_[a-z_0-9]+)')) {
            $mod = $m.Groups[1].Value
            if (-not (Test-Path (Join-Path $PluginDir ($mod + '.py')))) { $missing += ($fn + ' -> ' + $mod + '.py') }
        }
    }
    if ($missing.Count -gt 0) {
        Fail ('missing local modules after update: ' + (($missing | Select-Object -Unique) -join ', '))
    }
    $nSrcPy = (Get-ChildItem $srcRoot -Filter '*.py' -File).Count
    $nDstPy = (Get-ChildItem $PluginDir -Filter '*.py' -File).Count
    if ($nDstPy -lt $nSrcPy) { Fail ("py count after update: " + $nDstPy + " < source " + $nSrcPy) }
    Info ('import coverage OK (' + $nDstPy + ' py files, all sidecar imports resolved)')
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
