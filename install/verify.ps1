# bundle verify (ASCII only, PowerShell 5.1). Read-only: never writes or starts anything.
#
#   powershell -ExecutionPolicy Bypass -File verify.ps1
#   powershell -ExecutionPolicy Bypass -File verify.ps1 -DshHome D:\dshl\.dsh -Json
#
# Exit code 0 = all required checks passed; 1 = something is wrong (see rows with FAIL).

param(
    [string]$DshHome  = '',
    [string]$Profile  = '',
    [int]$SidecarPort = 8199,
    [int]$ComfyPort   = 8188,
    [int]$WebPort     = 10722,
    [string]$Python   = '',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$rows = New-Object System.Collections.ArrayList
function Add-Check([string]$name, [string]$status, [string]$detail) {
    [void]$rows.Add([ordered]@{ check = $name; status = $status; detail = $detail })
}

if (-not $DshHome) {
    if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
    elseif ($env:DSH_PROFILE_DIR) { $DshHome = Split-Path -Parent (Split-Path -Parent $env:DSH_PROFILE_DIR) }
    else { $DshHome = 'D:\dshl\.dsh' }
}
if (-not $Profile) { $Profile = $env:DSH_PROFILE }

$plugin = Join-Path $DshHome 'plugins\dsh-comfyui-console\plugin'

# ---- files ----
foreach ($f in @('package.json', 'lib\index.js', 'lib\client.js', 'lib\app.js', 'sidecar_auth.py', 'sidecar_cards.py', 'sidecar_comfy.py', 'sidecar_config.py', 'sidecar_llm.py', 'sidecar_pack.py', 'sidecar_routes.py', 'sidecar_state.py', 'sidecar_util.py', 'expander.py')) {
    $p = Join-Path $plugin $f
    if (Test-Path $p) { Add-Check ('file:' + $f) 'ok' ((Get-Item $p).Length.ToString() + ' bytes') }
    else { Add-Check ('file:' + $f) 'FAIL' 'missing' }
}
$pkgPath = Join-Path $plugin 'package.json'
if (Test-Path $pkgPath) {
    try {
        $pkg = [IO.File]::ReadAllText($pkgPath) | ConvertFrom-Json
        Add-Check 'plugin-version' 'ok' ($pkg.name + ' ' + $pkg.version + ' configVersion ' + $pkg.dsh.configVersion)
    } catch { Add-Check 'plugin-version' 'FAIL' ('package.json not parseable: ' + $_.Exception.Message) }
}

# ---- config ----
$cfgPath = Join-Path $plugin 'config.json'
if (-not (Test-Path $cfgPath)) { Add-Check 'config.json' 'FAIL' 'missing (run install-ai.ps1)' }
else {
    try {
        $cfg = [IO.File]::ReadAllText($cfgPath) | ConvertFrom-Json
        Add-Check 'config.json' 'ok' $cfgPath
        foreach ($k in @('comfyRoot', 'cardsDir')) {
            if ($cfg.$k) { Add-Check ('cfg:' + $k) 'ok' $cfg.$k } else { Add-Check ('cfg:' + $k) 'WARN' 'empty' }
        }
        if ($cfg.comfyRoot) {
            $okMain = (Test-Path (Join-Path $cfg.comfyRoot 'main.py')) -or
                      (Test-Path (Join-Path $cfg.comfyRoot 'ComfyUI\main.py')) -or
                      (Test-Path (Join-Path $cfg.comfyRoot 'python_embeded\python.exe'))
            if ($okMain) { Add-Check 'comfyRoot:main.py' 'ok' 'ComfyUI entry found' }
            else { Add-Check 'comfyRoot:main.py' 'WARN' 'no main.py / python_embeded under comfyRoot' }
        }
        if ($cfg.cardsDir -and (Test-Path $cfg.cardsDir)) {
            $n = (Get-ChildItem $cfg.cardsDir -Recurse -File -Include *.json,*.dslcard -ErrorAction SilentlyContinue | Measure-Object).Count
            Add-Check 'cardsDir:cards' 'ok' ($n.ToString() + ' card file(s)')
        } elseif ($cfg.cardsDir) { Add-Check 'cardsDir:cards' 'WARN' 'directory does not exist yet' }
        Add-Check 'configVersion' $(if ($cfg.configVersion) { 'ok' } else { 'WARN' }) ('in file: ' + $cfg.configVersion)
    } catch { Add-Check 'config.json' 'FAIL' ('not parseable: ' + $_.Exception.Message) }
}

# ---- skill ----
$sk = Join-Path $DshHome 'skills\comfyui-cards\SKILL.md'
if (Test-Path $sk) { Add-Check 'skill:comfyui-cards' 'ok' ((Get-Item $sk).Length.ToString() + ' bytes') }
else { Add-Check 'skill:comfyui-cards' 'FAIL' 'missing' }

# ---- profile mount ----
if ($Profile) {
    $link = Join-Path $DshHome ('profiles\' + $Profile + '\node_modules\dsh-comfyui-console')
    if (Test-Path $link) {
        $i = Get-Item $link -Force
        $tgt = if ($i.Target) { ($i.Target -join '') } else { '' }
        if ($tgt) { Add-Check 'profile:mount' 'ok' ('junction -> ' + $tgt) }
        else { Add-Check 'profile:mount' 'ok' 'installed as a real directory (copy install)' }
    } else { Add-Check 'profile:mount' 'FAIL' ($link + ' missing') }
} else { Add-Check 'profile:mount' 'skipped' 'no profile (set -Profile)' }

# ---- ports + endpoints ----
function Port-Open([int]$port) {
    $c = New-Object System.Net.Sockets.TcpClient
    try { $c.Connect('127.0.0.1', $port); $c.Close(); return $true } catch { return $false }
}
Add-Check 'port:comfyui' $(if (Port-Open $ComfyPort) { 'ok' } else { 'WARN' }) (':' + $ComfyPort + ' (off means drawing will not run until started from the panel)')
if (Port-Open $SidecarPort) {
    Add-Check 'port:sidecar' 'ok' (':' + $SidecarPort)
    try {
        $v = Invoke-RestMethod ('http://127.0.0.1:' + $SidecarPort + '/version') -TimeoutSec 8
        Add-Check 'sidecar:version' $(if ($v.stale) { 'WARN' } else { 'ok' }) ('loaded ' + $v.loaded + ' / disk ' + $v.disk + ' / configVersion ' + $v.configVersion)
        if ($v.stale) { Add-Check 'sidecar:stale' 'WARN' 'disk is newer than the running process: restart dsh web' }
        $h = Invoke-RestMethod ('http://127.0.0.1:' + $SidecarPort + '/health') -TimeoutSec 8
        Add-Check 'sidecar:health' $(if ($h.ok) { 'ok' } else { 'FAIL' }) (($h.routes -join ', '))
    } catch { Add-Check 'sidecar:http' 'FAIL' ('/version or /health failed: ' + $_.Exception.Message) }
} else { Add-Check 'port:sidecar' 'FAIL' (':' + $SidecarPort + ' not listening (start dsh web once)') }
Add-Check 'port:dshWeb' $(if (Port-Open $WebPort) { 'ok' } else { 'WARN' }) (':' + $WebPort)

# ---- host compatibility (after a dsh upgrade this is the part that breaks) ----
try {
    $hostVer = ''
    try { $hostVer = (& dsh --version 2>$null | Select-Object -First 1) } catch { $hostVer = '' }
    if (-not $hostVer) { $hostVer = '' } else { $hostVer = ("$hostVer").Trim() }
    if ($hostVer) { Add-Check 'host:version' 'ok' ("dsh " + $hostVer) }
    else { Add-Check 'host:version' 'warn' 'dsh not on PATH; cannot read host version' }

    $minHost = ''
    try { $minHost = ("$(([IO.File]::ReadAllText((Join-Path $plugin 'package.json')) | ConvertFrom-Json).dsh.minHost)") } catch { }
    if ($hostVer -and $minHost) {
        $vb = ($hostVer -split '-')[0]
        $mb = ($minHost -split '-')[0]
        $cmp = 0
        try {
            $a = @($vb -split '\.' | ForEach-Object { [int]$_ })
            $b = @($mb -split '\.' | ForEach-Object { [int]$_ })
            for ($i = 0; $i -lt 3; $i++) {
                $x = if ($i -lt $a.Count) { $a[$i] } else { 0 }
                $y = if ($i -lt $b.Count) { $b[$i] } else { 0 }
                if ($x -ne $y) { $cmp = if ($x -gt $y) { 1 } else { -1 }; break }
            }
        } catch { $cmp = 0 }
        if ($cmp -lt 0) { Add-Check 'host:minHost' 'FAIL' ("host " + $hostVer + " < plugin minHost " + $minHost) }
        elseif ($cmp -eq 0 -and $hostVer -ne $minHost) { Add-Check 'host:minHost' 'ok' ("host " + $hostVer + " vs minHost " + $minHost + " (same base version)") }
        else { Add-Check 'host:minHost' 'ok' ("host " + $hostVer + " >= minHost " + $minHost) }
    }

    # the exact manifest keys the host requires; losing dsh.bundle silently drops the whole plugin
    $man = $null
    try { $man = [IO.File]::ReadAllText((Join-Path $plugin 'package.json')) | ConvertFrom-Json } catch { }
    if ($man) {
        $bp = ''
        $cp = ''
        try { $bp = "$($man.dsh.bundle.patch)" } catch { }
        try { $cp = "$($man.dsh.client.platform)" } catch { }
        if ($bp -and $cp) { Add-Check 'host:manifest' 'ok' ("dsh.bundle.patch=" + $bp + " client.platform=" + $cp) }
        else { Add-Check 'host:manifest' 'FAIL' 'package.json lost dsh.bundle.patch or dsh.client.platform -> host will skip the plugin' }
    }

    # does the running composition actually contain us?
    # NOTE: dsh writes its warnings to stderr, and PS 5.1 turns native stderr into ErrorRecords
    # under $ErrorActionPreference='Stop'. Redirect to temp files via Start-Process, then read both.
    if ($Profile) {
        $so = [IO.Path]::GetTempFileName()
        $se = [IO.Path]::GetTempFileName()
        $dump = ''
        $exit = -1
        try {
            $exe = (Get-Command dsh -ErrorAction SilentlyContinue)
            if ($exe) {
                $pr = Start-Process -FilePath $exe.Source -ArgumentList @('--profile', $Profile, '--dump-config') `
                    -NoNewWindow -Wait -PassThru -RedirectStandardOutput $so -RedirectStandardError $se
                $exit = $pr.ExitCode
                $dump = ([IO.File]::ReadAllText($so) + "`n" + [IO.File]::ReadAllText($se))
            }
        } catch { $dump = '' }
        finally {
            Remove-Item $so, $se -Force -ErrorAction SilentlyContinue
        }
        if (-not $dump.Trim()) {
            Add-Check 'host:composition' 'warn' 'dump-config produced no output (dsh not on PATH?)'
        } elseif ($dump -match 'skipping profile bundle "dsh-comfyui-console"') {
            Add-Check 'host:composition' 'FAIL' 'host skipped the plugin bundle -> fix host:manifest keys'
        } elseif ($dump -match 'comfyui-console') {
            Add-Check 'host:composition' 'ok' ('plugin row present in composition (dump exit ' + $exit + ')')
        } else {
            Add-Check 'host:composition' 'FAIL' ('plugin row not in composition for profile ' + $Profile)
        }
    }
} catch {
    Add-Check 'host:probe' 'warn' ('host probe failed: ' + $_.Exception.Message)
}

# ---- manifest contract + version consistency (read-only, python helpers) ----
$pluginRoot = Split-Path -Parent $plugin
$suiteRoot = Split-Path -Parent $PSScriptRoot

$pyExe = $Python
if (-not $pyExe) {
    try {
        $cfgPy = [IO.File]::ReadAllText((Join-Path $plugin 'config.json')) | ConvertFrom-Json
        if ($cfgPy.pythonExe) { $pyExe = $cfgPy.pythonExe }
    } catch { }
}
if (-not $pyExe) { $pyExe = 'python' }

function Invoke-PyJson([string]$script, [string[]]$extra) {
    $so = [IO.Path]::GetTempFileName()
    $se = [IO.Path]::GetTempFileName()
    $text = ''
    $code = -1
    try {
        $all = @(('"' + $script + '"')) + $extra
        $p2 = Start-Process -FilePath $pyExe -ArgumentList $all -NoNewWindow -Wait -PassThru -RedirectStandardOutput $so -RedirectStandardError $se
        $code = $p2.ExitCode
        $text = [IO.File]::ReadAllText($so)
        $errT = [IO.File]::ReadAllText($se)
        if (-not $text.Trim() -and $errT.Trim()) { $text = $errT }
    } catch { $text = ''; $code = -1 }
    finally { Remove-Item $so, $se -Force -ErrorAction SilentlyContinue }
    return @{ code = $code; text = $text }
}

$contractScript = ''
foreach ($cand in @((Join-Path $pluginRoot 'tools\check_contract.py'), (Join-Path $suiteRoot 'tools\check_contract.py'))) {
    if (Test-Path $cand) { $contractScript = $cand; break }
}
if (-not $contractScript) {
    Add-Check 'contract' 'skipped' 'check_contract.py not shipped with this copy'
} else {
    $r = Invoke-PyJson $contractScript @('--root', ('"' + $pluginRoot + '"'), '--json')
    $j = $null
    try { $j = $r.text | ConvertFrom-Json } catch { $j = $null }
    if (-not $j) {
        Add-Check 'contract' 'warn' ('check_contract.py gave no JSON (exit ' + $r.code + ')')
    } else {
        $checks = @($j.checks)
        $okN = @($checks | Where-Object { $_.status -eq 'ok' }).Count
        $badN = @($checks | Where-Object { $_.status -eq 'FAIL' }).Count
        Add-Check 'contract' $(if ($j.ok) { 'ok' } else { 'FAIL' }) ('' + $okN + ' ok / ' + $badN + ' FAIL')
        foreach ($c in $checks) {
            if ($c.status -eq 'FAIL') { Add-Check ('contract:' + $c.check) 'FAIL' ([string]$c.detail) }
        }
    }
}

$syncScript = Join-Path $suiteRoot 'tools\sync_version.py'
if ((Test-Path $syncScript) -and (Test-Path (Join-Path $suiteRoot 'VERSION.json'))) {
    $r2 = Invoke-PyJson $syncScript @('--root', ('"' + $suiteRoot + '"'), '--check', '--json')
    $first = (($r2.text -split "`n") | Select-Object -First 3) -join ' '
    Add-Check 'version:consistent' $(if ($r2.code -eq 0) { 'ok' } else { 'FAIL' }) ('exit ' + $r2.code + ' | ' + $first)
} else {
    Add-Check 'version:consistent' 'skipped' 'no VERSION.json beside install\ (installed copy)'
}

# ---- report ----
$fails = @($rows | Where-Object { $_.status -eq 'FAIL' }).Count
$warns = @($rows | Where-Object { $_.status -eq 'WARN' }).Count
if ($Json) {
    [ordered]@{ ok = ($fails -eq 0); fails = $fails; warns = $warns; dshHome = $DshHome; checks = $rows } | ConvertTo-Json -Depth 5
} else {
    foreach ($r in $rows) { Write-Host ('[{0,-7}] {1,-22} {2}' -f $r.status, $r.check, $r.detail) }
    Write-Host ''
    Write-Host ('SUMMARY: ' + $fails + ' FAIL, ' + $warns + ' WARN')
}
if ($fails -gt 0) { exit 1 }
exit 0
