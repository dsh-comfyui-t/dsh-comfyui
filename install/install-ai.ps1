# dsh-comfyui-console + comfyui-cards :: bundle installer (ASCII only, PowerShell 5.1)
#
# What it does, in order:
#   1. copies plugin\       -> <DshHome>\plugins\dsh-comfyui-console\plugin   (keeps config.json)
#   2. copies skills\       -> <DshHome>\skills\comfyui-cards\SKILL.md        (keeps a .bak copy)
#   3. writes config.json   from config.example.json + your parameters (only if missing)
#   4. optionally mounts the plugin into a profile (official channel or junction)
#   5. runs light checks and prints a machine-readable result with -Json
#
# Modes
#   -ApplyProfile            official channel: runs  dsh plugin --profile <p> add "<pluginDir>"
#   -LinkJunction            no dsh CLI needed: makes  <DshHome>\profiles\<p>\node_modules\<name>
#                            a junction to the installed plugin dir
#   (neither)                files + config only; the script prints the two commands to run yourself
#
# Examples
#   powershell -ExecutionPolicy Bypass -File install-ai.ps1 -ComfyRoot D:\ComfyUI -CardsDir D:\cards
#   powershell -ExecutionPolicy Bypass -File install-ai.ps1 -ApplyProfile -Profile 0.2.0-rc.2
#   powershell -ExecutionPolicy Bypass -File install-ai.ps1 -LinkJunction -Profile 0.2.0-rc.2 -Json
#   powershell -ExecutionPolicy Bypass -File install-ai.ps1 -ConfigFile .\my-config.json   # non-ASCII paths safe

param(
    [string]$DshHome   = '',
    [string]$Profile   = '',
    [string]$ComfyRoot = '',
    [string]$PythonExe = '',
    [string]$CardsDir  = '',
    [string]$WorkDir   = '',
    [string]$ConfigFile = '',
    [int]$ComfyPort    = 8188,
    [int]$SidecarPort  = 8199,
    [switch]$AllowLan,
    [switch]$ApplyProfile,
    [switch]$LinkJunction,
    [switch]$SkipSkill,
    [switch]$SkipChecks,
    [switch]$Force,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$steps = New-Object System.Collections.ArrayList
function Step([string]$name, [string]$status, [string]$detail) {
    [void]$steps.Add([ordered]@{ name = $name; status = $status; detail = $detail })
    if (-not $Json) { Write-Host ('[{0,-7}] {1,-22} {2}' -f $status, $name, $detail) }
}
function Done([string]$verdict, [string]$extra) {
    if ($Json) {
        $out = [ordered]@{ ok = ($verdict -ne 'failed'); verdict = $verdict; dshHome = $DshHome;
                           pluginDir = $pluginDst; steps = $steps; note = $extra }
        $out | ConvertTo-Json -Depth 6
    } else {
        Write-Host ''
        Write-Host ('RESULT: ' + $verdict)
        if ($extra) { Write-Host $extra }
    }
    if ($verdict -eq 'failed') { exit 1 }
    exit 0
}

$here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcPlug = Join-Path $here 'plugin'
if (-not (Test-Path $srcPlug)) { Step 'locate' 'failed' ('plugin\ not found next to install\ : ' + $here); Done 'failed' '' }

# ---------- 1. DSH_HOME ----------
if (-not $DshHome) {
    if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
    elseif ($env:DSH_PROFILE_DIR) { $DshHome = Split-Path -Parent (Split-Path -Parent $env:DSH_PROFILE_DIR) }
    else { $DshHome = 'D:\dshl\.dsh' }
}
Step 'dshHome' 'ok' $DshHome

# ---------- 2. plugin files ----------
$pluginDst = Join-Path $DshHome 'plugins\dsh-comfyui-console\plugin'
$cfgDst = Join-Path $pluginDst 'config.json'
$cfgKeep = $null
if (Test-Path $cfgDst) { $cfgKeep = [IO.File]::ReadAllText($cfgDst) }

if (Test-Path $pluginDst) {
    $bak = Join-Path (Split-Path -Parent $pluginDst) ('.bak-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $bak -Force | Out-Null
    foreach ($it in @('lib', 'sidecar_auth.py', 'sidecar_cards.py', 'sidecar_comfy.py', 'sidecar_config.py', 'sidecar_llm.py', 'sidecar_pack.py', 'sidecar_routes.py', 'sidecar_state.py', 'sidecar_util.py', 'expander.py', 'package.json')) {
        $p = Join-Path $pluginDst $it
        if (Test-Path $p) { Copy-Item $p (Join-Path $bak $it) -Recurse -Force }
    }
    Step 'backup' 'ok' $bak
}
New-Item -ItemType Directory -Path $pluginDst -Force | Out-Null
Get-ChildItem $srcPlug -Force | ForEach-Object {
    $to = Join-Path $pluginDst $_.Name
    if (Test-Path $to -PathType Container) { Remove-Item $to -Recurse -Force }
    Copy-Item $_.FullName $to -Recurse -Force
}
if ($cfgKeep) { [IO.File]::WriteAllText($cfgDst, $cfgKeep, (New-Object System.Text.UTF8Encoding($false))) }
Step 'plugin' 'ok' $pluginDst

# ---------- 3. config.json ----------
$exPath = Join-Path $pluginDst 'config.example.json'
if (Test-Path $cfgDst) {
    Step 'config' 'kept' 'existing config.json left untouched (delete it to re-seed)'
} else {
    $seedSrc = $exPath
    if ($ConfigFile) {
        if (-not (Test-Path $ConfigFile)) { Step 'config' 'failed' ('-ConfigFile not found: ' + $ConfigFile); Done 'failed' '' }
        $seedSrc = (Resolve-Path $ConfigFile).Path
    }
    # hashtable + explicit default keys: a PSCustomObject cannot gain new properties, a dictionary can
    $cfgSeed = [IO.File]::ReadAllText($seedSrc) | ConvertFrom-Json
    $cfg = [ordered]@{}
    foreach ($pr in $cfgSeed.PSObject.Properties) { $cfg[$pr.Name] = $pr.Value }
    foreach ($k in @('configVersion', 'comfyRoot', 'pythonExe', 'workDir', 'credsFile', 'comfyPort',
                     'sidecarPort', 'extraComfyArgs', 'outputDir', 'saveDir', 'cardsDir', 'allowLan')) {
        if (-not $cfg.Contains($k)) {
            if ($k -eq 'extraComfyArgs') { $cfg[$k] = @('--disable-pinned-memory', '--disable-async-offload', '--disable-dynamic-vram', '--cache-none') }
            elseif ($k -in @('comfyPort', 'sidecarPort', 'configVersion')) { $cfg[$k] = 0 }
            elseif ($k -eq 'allowLan') { $cfg[$k] = $false }
            else { $cfg[$k] = '' }
        }
    }
    # stamp the config schema version from the plugin manifest, so first load has nothing to migrate
    try {
        $plugPkg = [IO.File]::ReadAllText((Join-Path $pluginDst 'package.json')) | ConvertFrom-Json
        $wantVer = [int]$plugPkg.dsh.configVersion
        if (-not $cfg['configVersion'] -or [int]$cfg['configVersion'] -lt $wantVer) { $cfg['configVersion'] = $wantVer }
    } catch { }
    if ($ComfyRoot)   { $cfg['comfyRoot'] = $ComfyRoot }
    if ($PythonExe)   { $cfg['pythonExe'] = $PythonExe }
    if ($CardsDir)    { $cfg['cardsDir'] = $CardsDir }
    if ($WorkDir)     { $cfg['workDir'] = $WorkDir } else { $cfg['workDir'] = (Join-Path $pluginDst 'work') }
    if ($ComfyPort)   { $cfg['comfyPort'] = $ComfyPort }
    if ($SidecarPort) { $cfg['sidecarPort'] = $SidecarPort }
    if ($AllowLan)    { $cfg['allowLan'] = $true }
    $cfgJson = $cfg | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($cfgDst, ($cfgJson + "`n"), (New-Object System.Text.UTF8Encoding($false)))
    # write-then-reparse: catches mangled non-ASCII paths and console-encoding damage
    $roundTrip = $null
    try { $roundTrip = [IO.File]::ReadAllText($cfgDst) | ConvertFrom-Json } catch { $roundTrip = $null }
    if (-not $roundTrip) {
        Step 'config' 'failed' 'config.json written but not parseable (non-ASCII path mangled? pass -ConfigFile with UTF-8 json)'
    } elseif (($roundTrip.cardsDir + '') -match '\?') {
        Step 'config' 'warn' ('cardsDir may be mangled by console encoding: ' + $roundTrip.cardsDir + '  -> re-run with -ConfigFile')
    } else {
        Step 'config' 'ok' ('seeded from ' + (Split-Path -Leaf $seedSrc) + '; comfyRoot=' + $cfg['comfyRoot'] + ' cardsDir=' + $cfg['cardsDir'])
    }
}

# ---------- 4. skill ----------
if (-not $SkipSkill) {
    $skSrc = Join-Path $here 'skills\comfyui-cards\SKILL.md'
    if (Test-Path $skSrc) {
        $skDst = Join-Path $DshHome 'skills\comfyui-cards'
        New-Item -ItemType Directory -Path $skDst -Force | Out-Null
        $skFile = Join-Path $skDst 'SKILL.md'
        if (Test-Path $skFile) { Copy-Item $skFile ($skFile + '.bak-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) -Force }
        Copy-Item $skSrc $skFile -Force
        Step 'skill' 'ok' $skFile
    } else { Step 'skill' 'skipped' 'skills\comfyui-cards\SKILL.md not in bundle' }
} else { Step 'skill' 'skipped' 'by -SkipSkill' }

# ---------- 5. profile mount ----------
$name = 'dsh-comfyui-console'
if (-not $Profile) { $Profile = $env:DSH_PROFILE }
if ($ApplyProfile) {
    $dsh = Get-Command dsh -ErrorAction SilentlyContinue
    if (-not $dsh) { Step 'profile' 'skipped' 'dsh CLI not on PATH; use -LinkJunction instead' }
    elseif (-not $Profile) { Step 'profile' 'skipped' 'no -Profile and no $env:DSH_PROFILE' }
    else {
        & $dsh.Source plugin --profile $Profile add $pluginDst 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Step 'profile' 'ok' ('dsh plugin add -> ' + $Profile) }
        else { Step 'profile' 'failed' 'dsh plugin add returned non-zero; fall back to -LinkJunction' }
    }
} elseif ($LinkJunction) {
    if (-not $Profile) { Step 'profile' 'skipped' 'no -Profile' }
    else {
        $nm = Join-Path $DshHome ('profiles\' + $Profile + '\node_modules')
        New-Item -ItemType Directory -Path $nm -Force | Out-Null
        $link = Join-Path $nm $name
        if (Test-Path $link) {
            if ($Force) {
                cmd /c rmdir "$link" | Out-Null
                cmd /c mklink /J "$link" "$pluginDst" | Out-Null
                Step 'profile' 'ok' ('junction remade -> ' + $pluginDst)
            } else { Step 'profile' 'kept' ($link + ' already exists (pass -Force to re-point)') }
        } else {
            cmd /c mklink /J "$link" "$pluginDst" | Out-Null
            if (Test-Path $link) { Step 'profile' 'ok' ('junction -> ' + $pluginDst) }
            else { Step 'profile' 'failed' 'mklink /J failed' }
        }
    }
} else {
    Step 'profile' 'manual' ('run:  dsh plugin --profile ' + $Profile + ' add "' + $pluginDst + '"')
}

# ---------- 6. checks ----------
if (-not $SkipChecks) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        & $node.Source --check (Join-Path $pluginDst 'lib\index.js')
        if ($LASTEXITCODE -eq 0) { Step 'check-js' 'ok' 'lib/index.js parses' } else { Step 'check-js' 'failed' 'node --check lib/index.js' }
        & $node.Source --check (Join-Path $pluginDst 'lib\client.js')
        if ($LASTEXITCODE -eq 0) { Step 'check-js' 'ok' 'lib/client.js parses' } else { Step 'check-js' 'failed' 'node --check lib/client.js' }
    } else { Step 'check-js' 'skipped' 'node not on PATH' }
    $cands = @()
    if ($PythonExe) { $cands += @{ exe = $PythonExe; arg = @('-m', 'py_compile') } }
    $c1 = Get-Command python -ErrorAction SilentlyContinue
    if ($c1) { $cands += @{ exe = $c1.Source; arg = @('-m', 'py_compile') } }
    $c2 = Get-Command py -ErrorAction SilentlyContinue
    if ($c2) { $cands += @{ exe = $c2.Source; arg = @('-3', '-m', 'py_compile') } }
    $pyOk = $false
    $pyTried = @()
    foreach ($c in $cands) {
        $pyTried += $c.exe
        $args = $c.arg + @(Get-ChildItem (Join-Path $pluginDst '*.py') | ForEach-Object { $_.FullName })
        & $c.exe @args 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $pyOk = $true; Step 'check-py' 'ok' ('expander.py compiles with ' + $c.exe); break }
    }
    if (-not $pyOk) {
        if ($cands.Count -eq 0) { Step 'check-py' 'skipped' 'no python on PATH' }
        else { Step 'check-py' 'warn' ('py_compile did not pass with: ' + ($pyTried -join ', ') + ' (sidecar may still run)') }
    }
    $pyc = Join-Path $pluginDst '__pycache__'
    if (Test-Path $pyc) { Remove-Item $pyc -Recurse -Force }
}

Done 'installed' ('NEXT: restart the DSH web process (ESM cache is per process), then open the page and check GET http://127.0.0.1:' + $SidecarPort + '/version')
