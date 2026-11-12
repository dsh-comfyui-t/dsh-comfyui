# ============================================================
#  DSH x ComfyUI 绘图台 —— 一键安装
#
#  ⚠️ 本文件含中文，必须 UTF-8 **带 BOM**（PowerShell 5.1 否则按 ANSI 读会乱码）。
#
#  做五件事：
#    1. 把插件拷进 <DSH_HOME>\profiles\node_modules\@local\dsh-comfyui-console\
#    2. 生成 config.json（写进探测到的 ComfyUI 路径）
#    3. 往 profile 的 cordis.patch.yml 加一条 insert 条目（改前自动备份）
#    4. 安装 / 复用独立用户目录中的离线英中翻译组件
#    5. 可选：在启动文件夹放一个开机自启的快捷脚本
#
#  用法：
#    powershell -ExecutionPolicy Bypass -File install.ps1
#    powershell -ExecutionPolicy Bypass -File install.ps1 -ComfyRoot "D:\ComfyUI\ComfyUI_windows_portable"
#    powershell -ExecutionPolicy Bypass -File install.ps1 -NoStartup
# ============================================================
param(
    [string]$DshHome = $env:DSH_HOME,
    [string]$ComfyRoot = '',
    [string]$StartScript = '',
    [Alias('Profile')][string]$ProfileName = '',
    [string]$PythonExe = '',
    [switch]$NoStartup
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$HERE = Split-Path -Parent $MyInvocation.MyCommand.Path
$SRC  = Join-Path $HERE 'plugin'

function Say($m, $c) { if ($c) { Write-Host $m -ForegroundColor $c } else { Write-Host $m } }
function Ok($m)   { Say "  ✓ $m" 'Green' }
function Warn($m) { Say "  ! $m" 'Yellow' }
function Bad($m)  { Say "  ✗ $m" 'Red' }

Say ''
Say '============================================'
Say ' DSH x ComfyUI 绘图台 - 安装'
Say '============================================'
Say ''

# ---------- 1. DSH_HOME ----------
if (-not $DshHome -or -not (Test-Path $DshHome)) {
    foreach ($c in @("$env:USERPROFILE\.dsh")) {
        if (Test-Path (Join-Path $c 'profiles')) { $DshHome = $c; break }
    }
}
if (-not $DshHome -or -not (Test-Path (Join-Path $DshHome 'profiles'))) {
    Bad "找不到 DSH_HOME（里面应有 profiles\ 目录）。"
    $DshHome = Read-Host '请粘贴 DSH_HOME 的完整路径'
    if (-not (Test-Path (Join-Path $DshHome 'profiles'))) { Bad '路径不对，退出'; exit 1 }
}
Ok "DSH_HOME = $DshHome"
# Validate Profile selection before backups, process shutdown or writes.
$profileBase = Join-Path $DshHome 'profiles'
$available = @(Get-ChildItem -LiteralPath $profileBase -Directory | Where-Object {
    $_.Name -notmatch '\.bak[-.]|\.uninstalled-' -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and
    (Test-Path -LiteralPath (Join-Path $_.FullName 'cordis.patch.yml'))
} | Sort-Object Name)
if ($ProfileName) {
    if ($ProfileName -in @('.', '..') -or $ProfileName -match '[/\\]') { throw 'Profile 必须为 profiles 下的名称' }
    $selected = @($available | Where-Object { $_.Name -eq $ProfileName })
    if ($selected.Count -ne 1) { throw "Profile 不存在：$ProfileName" }
} elseif ($available.Count -eq 1 -or ($available.Count -gt 0 -and @($available | Where-Object { $_.Name -notin @('desktop','web') }).Count -eq 0)) {
    $selected = $available
} else { throw ('请用 -Profile 指定。发现：' + (($available | ForEach-Object Name) -join ', ')) }
foreach ($item in $selected) {
    $checkPackage = Join-Path $item.FullName 'package.json'
    if (Test-Path -LiteralPath $checkPackage) { $null = Get-Content -LiteralPath $checkPackage -Raw -Encoding UTF8 | ConvertFrom-Json }
}
$installBase = $profileBase
if ($selected.Count -eq 1 -and ($ProfileName -or $selected[0].Name -notin @('desktop','web') -or
    (Test-Path -LiteralPath (Join-Path $selected[0].FullName 'node_modules\@local\dsh-comfyui-console')))) {
    $installBase = $selected[0].FullName
}
$destRoot = Join-Path $installBase 'node_modules\@local'

$dest = Join-Path $destRoot 'dsh-comfyui-console'
$oldCfg = $null
$oldConfigPath = Join-Path $dest 'config.json'
if (-not (Test-Path -LiteralPath $oldConfigPath)) { $oldConfigPath = Join-Path $profileBase 'node_modules\@local\dsh-comfyui-console\config.json' }
if (Test-Path -LiteralPath $oldConfigPath) {
    try { $oldCfg = Get-Content -LiteralPath $oldConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json; if ($oldCfg -isnot [pscustomobject]) { throw '配置顶层必须为对象' } }
    catch { throw '旧配置 JSON 损坏，已停止升级以保留原配置。' }
}
# 显式 -ComfyRoot 优先，未指定则尽量沿用已有配置。
if (-not $PSBoundParameters.ContainsKey('ComfyRoot') -and $oldCfg -and $oldCfg.comfyRoot) {
    $ComfyRoot = [string]$oldCfg.comfyRoot
}

# ---------- 2. ComfyUI ----------
function Test-Comfy($p) {
    return ($p -and ((Test-Path (Join-Path $p 'ComfyUI\main.py')) -or ((Test-Path (Join-Path $p 'main.py')) -and ((Test-Path (Join-Path $p 'folder_paths.py')) -or (Test-Path (Join-Path $p 'comfy\cli_args.py'))))))
}
if (-not $StartScript -and $oldCfg -and $oldCfg.startScript) { $StartScript = [string]$oldCfg.startScript }
if (-not $ComfyRoot -and $StartScript -and (Test-Path -LiteralPath $StartScript -PathType Leaf)) {
    $candidateRoot = Split-Path -Parent $StartScript
    for ($depth = 0; $depth -lt 3; $depth++) {
        if (Test-Comfy $candidateRoot) { $ComfyRoot = $candidateRoot; break }
        $candidateRoot = Split-Path -Parent $candidateRoot
        if (-not $candidateRoot) { break }
    }
}
if (-not (Test-Comfy $ComfyRoot)) {
    foreach ($c in @(
        'E:\ComfyUI\ComfyUI_windows_portable', 'D:\ComfyUI\ComfyUI_windows_portable',
        'C:\ComfyUI\ComfyUI_windows_portable', 'F:\ComfyUI\ComfyUI_windows_portable',
        "$env:USERPROFILE\ComfyUI_windows_portable",
        "$env:USERPROFILE\Desktop\ComfyUI_windows_portable",
        "$env:USERPROFILE\Downloads\ComfyUI_windows_portable", "$env:USERPROFILE\ComfyUI", "$env:USERPROFILE\Desktop\ComfyUI")) {
        if (Test-Comfy $c) { $ComfyRoot = $c; break }
    }
}
if (-not (Test-Comfy $ComfyRoot)) {
    Warn '没自动找到 ComfyUI 安装目录。'
    Say  '  （支持便携版，或含 main.py 与 comfy/cli_args.py 的源码目录）'
    $ComfyRoot = Read-Host '请粘贴 ComfyUI 安装目录的完整路径（直接回车=先跳过，之后再改 config.json）'
    if ($ComfyRoot -and -not (Test-Comfy $ComfyRoot)) { Warn '这个路径看着不对，仍会写进配置，装完可手工改' }
    if (-not $ComfyRoot) { $ComfyRoot = '' }
}
if ($ComfyRoot) { Ok "ComfyUI = $ComfyRoot" } else { Warn 'ComfyUI 路径留空（之后必须改 config.json 才能出图）' }

# Prepare a sibling copy first. User config/runtime are untouched until commit.
$stage = "$dest.stage-$([guid]::NewGuid().ToString('N'))"
$pluginBackup = "$dest.bak-$(Get-Date -Format yyyyMMdd-HHmmss)-$([guid]::NewGuid().ToString('N'))"
$previousMoved = $false
$pluginCommitted = $false
$registrationOriginals = @{}
$registrationTouched = New-Object 'System.Collections.Generic.List[string]'
foreach ($item in $selected) {
    foreach ($fileName in @('package.json','cordis.patch.yml')) {
        $path = Join-Path $item.FullName $fileName
        if (Test-Path -LiteralPath $path) { $registrationOriginals[$path] = [IO.File]::ReadAllBytes($path) }
    }
}
try {
Say ''
Say '[1/5] 准备插件文件'
if (-not (Test-Path -LiteralPath $SRC)) { throw "找不到 plugin 目录：$SRC" }
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
. (Join-Path $PSScriptRoot 'tools/release_files.ps1')
Copy-ReleaseSource $SRC $stage

# ---------- 4. config.json ----------
Say ''
Say '[2/5] 生成 config.json'
$cfg = [ordered]@{
    comfyRoot      = $ComfyRoot
    startScript    = $StartScript
    pythonExe      = ''
    workDir        = $dest
    credsFile      = (Join-Path $DshHome '.credentials.yaml')
    comfyPort      = 8188
    sidecarPort    = 8199
    allowedOrigins = @()
    allowNullOrigin = $false
    extraComfyArgs = @('--disable-pinned-memory', '--disable-async-offload',
                       '--disable-dynamic-vram', '--cache-none')
}
if ($oldCfg) {
    foreach ($property in $oldCfg.PSObject.Properties) {
        if ($property.Name -notlike '_*') { $cfg[$property.Name] = $property.Value }
    }
}
# 用户在本次命令显式指定的路径永远优先于旧配置
if ($PSBoundParameters.ContainsKey('ComfyRoot')) { $cfg.comfyRoot = $ComfyRoot }
if ($PSBoundParameters.ContainsKey('StartScript')) { $cfg.startScript = $StartScript }
if ($PSBoundParameters.ContainsKey('PythonExe')) {
    if (-not (Test-Path -LiteralPath $PythonExe -PathType Leaf)) { throw 'PythonExe 不存在' }
    $cfg.pythonExe = $PythonExe
}
if (-not $cfg.comfyRoot -and $ComfyRoot) { $cfg.comfyRoot = $ComfyRoot }
if (-not $cfg.workDir) { $cfg.workDir = $dest }
if (-not $cfg.startScript -and $cfg.comfyRoot) {
    $launchers = @(Get-ChildItem -LiteralPath ([string]$cfg.comfyRoot) -File | Where-Object { $_.Name -match '^(run|start)([_ .-].*)?\.(bat|cmd|ps1)$' })
    if ($launchers.Count -gt 1) { Warn '发现多个启动文件，请在连接设置选择 Intel / AMD / CPU 等对应启动文件；不自动选择 NVIDIA。' }
}
if (-not $cfg.pythonExe -and $cfg.comfyRoot) {
    foreach ($relative in @('python_standalone\python.exe','python_embeded\python.exe','python_embedded\python.exe',
        '.venv\Scripts\python.exe','venv\Scripts\python.exe','env\Scripts\python.exe',
        'ComfyUI\.venv\Scripts\python.exe','ComfyUI\venv\Scripts\python.exe')) {
        $candidate = Join-Path ([string]$cfg.comfyRoot) $relative
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $cfg.pythonExe = $candidate; break }
    }
}


foreach ($key in @('comfyPort','sidecarPort')) {
    $value = $cfg[$key]
    if ($value -is [bool] -or [string]$value -notmatch '^[0-9]+$' -or [double]$value -lt 1 -or [double]$value -gt 65535) { throw "$key 必须为 1–65535 的整数" }
}
if ([int]$cfg.comfyPort -eq [int]$cfg.sidecarPort) { throw 'ComfyUI 和 Sidecar 端口不能相同' }
if ($cfg.startScript -match '^\\\\' -and [IO.Path]::GetExtension([string]$cfg.startScript) -in @('.bat','.cmd')) { throw 'Windows cmd 不支持 UNC 工作目录，请将启动文件放到盘符目录' }

# 将安装时选定的默认端口同步到已打包的浏览器端；前端还可通过连接设置覆写。
$clientPath = Join-Path $stage 'lib\client.js'
if (Test-Path $clientPath) {
    $clientJs = [System.IO.File]::ReadAllText($clientPath, [System.Text.Encoding]::UTF8)
    $defaultPorts = 'const INSTALLED_PORTS = { comfyPort: 8188, sidecarPort: 8199 };'
    $actualPorts = 'const INSTALLED_PORTS = { comfyPort: ' + [int]$cfg.comfyPort + ', sidecarPort: ' + [int]$cfg.sidecarPort + ' };'
    if (-not $clientJs.Contains($defaultPorts)) { throw '安装端口锚点缺失，client.js 可能与安装器版本不匹配' }
    $clientJs = $clientJs.Replace($defaultPorts, $actualPorts)
    [System.IO.File]::WriteAllText($clientPath, $clientJs, (New-Object System.Text.UTF8Encoding($false)))
}
$cfg.instanceId = [guid]::NewGuid().ToString()
$instanceAnchor = 'const INSTALLED_INSTANCE_ID = "";'
$clientJs = [IO.File]::ReadAllText($clientPath, [Text.Encoding]::UTF8)
if (-not $clientJs.Contains($instanceAnchor)) { throw '缺少客户端安装身份锚点' }
$clientJs = $clientJs.Replace($instanceAnchor, ('const INSTALLED_INSTANCE_ID = "' + $cfg.instanceId + '";'))
[IO.File]::WriteAllText($clientPath, $clientJs, (New-Object Text.UTF8Encoding($false)))
$cfgJson = $cfg | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText((Join-Path $stage 'config.json'), $cfgJson, (New-Object System.Text.UTF8Encoding($false)))
Ok "config.json 已写入"
Warn '内存紧张的机器可保留 --disable-pinned-memory；实际性能需按硬件测试'
if ($oldCfg) { Ok '已尽量保留旧配置（ComfyUI 路径、端口、模型参数等）' }

# 升级时按旧插件脚本完整路径识别 sidecar，只终止自己的旧实例。
# 不碰 ComfyUI 生成进程；其任务可以继续完成。
$oldExpander = Join-Path $dest 'expander.py'
if (Test-Path $oldExpander) {
    try {
        $procs = Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction Stop
        foreach ($proc in $procs) {
            $cmdline = [string]$proc.CommandLine
            if ($cmdline -match ('(?i)(?:^|\s)(?:"' + [regex]::Escape($oldExpander) + '"|' + [regex]::Escape($oldExpander) + ')(?=\s|$)')) {
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
                Ok "已停止旧版 sidecar（PID $($proc.ProcessId)），ComfyUI 不受影响"
            }
        }
    } catch { Warn "检查旧版 sidecar 失败：$($_.Exception.Message)。升级后若仍是旧服务，请手动重启 Python sidecar" }
}


if (Test-Path -LiteralPath $dest) {
    Copy-InstalledRuntime $dest $stage
    Move-Item -LiteralPath $dest -Destination $pluginBackup
    $previousMoved = $true
}
Move-Item -LiteralPath $stage -Destination $dest
$pluginCommitted = $true
Ok "已安装到 $dest"

# ---------- 5. cordis.patch.yml ----------
Say ''
Say '[3/5] 注册到 profile'
$patched = 0
foreach ($selectedProfile in $selected) {
    $prof = $selectedProfile.Name
    $pf = Join-Path $selectedProfile.FullName 'cordis.patch.yml'
    $pkgPath = Join-Path $selectedProfile.FullName 'package.json'
    if (Test-Path -LiteralPath $pkgPath) {
        $pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Copy-Item -LiteralPath $pkgPath -Destination ($pkgPath + '.bak-' + (Get-Date -Format yyyyMMdd-HHmmss))
        if (-not $pkg.dependencies) { $pkg | Add-Member -MemberType NoteProperty -Name dependencies -Value ([pscustomobject]@{}) -Force }
        $version = (Get-Content -LiteralPath (Join-Path $dest 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
        $pkg.dependencies | Add-Member -MemberType NoteProperty -Name '@local/dsh-comfyui-console' -Value $version -Force
        $registrationTouched.Add($pkgPath)
        [IO.File]::WriteAllText($pkgPath, ($pkg | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding($false)))
    }
    if (-not (Test-Path $pf)) { continue }
    $txt = [System.IO.File]::ReadAllText($pf, [System.Text.Encoding]::UTF8)
    if ($txt -match '(?m)^\s*name:\s*["'']?@local/dsh-comfyui-console(?:["'']|\s|$)') { Ok "$prof：已注册过，跳过"; $patched++; continue }

    $bak = "$pf.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item -LiteralPath $pf -Destination $bak
    # ⚠️ 新增插件必须用「外层无 id 的 insert 列表」。
    #    写成 `- id: xxx` + `name:` 会被当成对已有条目的覆写，目标不存在时只 warn 然后静默跳过。
    $add = "`n# DSH x ComfyUI 绘图台`n- insert:`n    - id: comfyui-console`n      name: `"@local/dsh-comfyui-console`"`n"
    $registrationTouched.Add($pf)
    [System.IO.File]::WriteAllText($pf, $txt.TrimEnd() + "`n" + $add, (New-Object System.Text.UTF8Encoding($false)))
    Ok "$prof：已注册（备份 $(Split-Path -Leaf $bak)）"
    $patched++
}
if ($patched -eq 0) { throw '没找到任何 profile 的 cordis.patch.yml，注册失败' }
} catch {
    $installError = $_
    foreach ($path in $registrationTouched) {
        try { [IO.File]::WriteAllBytes($path, $registrationOriginals[$path]) }
        catch { Warn "Profile 恢复失败，请保留备份并检查：$path" }
    }
    try {
        if ($pluginCommitted -and (Test-Path -LiteralPath $dest)) { Remove-Item -LiteralPath $dest -Recurse -Force }
        if ($previousMoved) { Move-Item -LiteralPath $pluginBackup -Destination $dest }
    } catch { Warn "插件恢复失败，旧备份位于：$pluginBackup" }
    throw $installError
} finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}

# ---------- 6. 离线翻译（失败不阻断插件主体） ----------
Say ''
Say '[4/5] 安装 / 检查离线英中翻译'
$translationBootstrap = ''
$translationArgs = @()
if ($cfg.pythonExe -and (Test-Path -LiteralPath ([string]$cfg.pythonExe))) {
    $translationBootstrap = [string]$cfg.pythonExe
}
if (-not $translationBootstrap -and $cfg.comfyRoot) {
    foreach ($folder in @('python_standalone', 'python_embeded', 'python_embedded')) {
        $candidate = Join-Path ([string]$cfg.comfyRoot) ($folder + '\python.exe')
        if (Test-Path -LiteralPath $candidate) { $translationBootstrap = $candidate; break }
    }
}
if (-not $translationBootstrap) {
    $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($pythonCommand) { $translationBootstrap = $pythonCommand.Source }
    else {
        $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
        if ($launcher) { $translationBootstrap = $launcher.Source; $translationArgs = @('-3') }
    }
}
try {
    if (-not $translationBootstrap) { throw '未找到可运行的 Python，请配置 config.json 的 pythonExe 后重试。' }
    & $translationBootstrap @translationArgs -u (Join-Path $dest 'install_translation.py')
    if ($LASTEXITCODE -eq 0) { Ok '离线翻译已就绪（首次安装或复用完成）' }
    else { Warn '离线翻译安装未完成；插件主体继续安装。可重新运行安装脚本，或在中文预览中点击安装重试。' }
} catch {
    Warn "离线翻译安装未完成：$($_.Exception.Message)。插件主体继续安装；修复后重新运行安装脚本或在中文预览中重试。"
}

# ---------- 6.5 Electron 独立编辑器运行时 ----------
if ($translationBootstrap) {
    try {
        & $translationBootstrap @translationArgs -u (Join-Path $dest 'install_electron.py')
        if ($LASTEXITCODE -eq 0) { Ok 'Electron 独立编辑器运行时已就绪' }
        else { Warn 'Electron 安装未完成，可稍后运行插件目录的 install_electron.py' }
    } catch { Warn "Electron 安装未完成：$($_.Exception.Message)" }
} else { Warn '未找到 Python；请配置后运行 install_electron.py 安装独立编辑器运行时。' }

# ---------- 7. 开机自启（可选） ----------
Say ''
if ($NoStartup) {
    Say '[5/5] 跳过开机自启（-NoStartup）'
    # 重新安装时显式 -NoStartup，应清理本插件之前创建的自启入口。
    $existingStartup = Join-Path ([Environment]::GetFolderPath('Startup')) 'ComfyUI-Stack.cmd'
    if (Test-Path $existingStartup) {
        $existingScript = [System.IO.File]::ReadAllText($existingStartup)
        if ($existingScript -match 'dsh-comfyui-console') {
            Remove-Item $existingStartup -Force
            Ok '已移除旧版自动启动入口'
        }
    }
} else {
    Say '[5/5] 开机自启'
    $startup = [Environment]::GetFolderPath('Startup')
    $py = if ($cfg.pythonExe -and (Test-Path ([string]$cfg.pythonExe))) { [string]$cfg.pythonExe } else {
        $found = ''
        foreach ($folder in @('python_standalone', 'python_embeded', 'python_embedded')) {
            if ($cfg.comfyRoot) {
                $test = Join-Path ([string]$cfg.comfyRoot) ($folder + '\python.exe')
                if (Test-Path $test) { $found = $test; break }
            }
        }
        if ($found) { $found } else { 'python.exe' }
    }
    $pyQuoted = $py.Replace("'", "''")
    $startupPort = [int]$cfg.sidecarPort
    $scr = Join-Path $dest 'startup.ps1'
    $ps = @"
# 自动生成：DSH x ComfyUI Sidecar 登录自启。只启动当前安装的 Sidecar。
`$ErrorActionPreference = 'Stop'
`$LOG = Join-Path `$PSScriptRoot 'startup.log'
function L(`$m) { try { Add-Content -LiteralPath `$LOG -Value ('{0}  {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), `$m) -Encoding UTF8 } catch {} }
try {
    `$cfg = Get-Content -LiteralPath (Join-Path `$PSScriptRoot 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if (`$cfg -isnot [pscustomobject]) { throw 'config.json 顶层必须为对象' }
    `$PY = if (`$cfg.pythonExe) { [string]`$cfg.pythonExe } else { '$pyQuoted' }
    if (Test-Path -LiteralPath `$PY -PathType Leaf) { `$pythonPath = (Get-Item -LiteralPath `$PY).FullName }
    elseif (`$PY -notmatch '[\\/:]') { `$pythonPath = (Get-Command -Name `$PY -CommandType Application -ErrorAction Stop).Source }
    else { throw '配置的 Python 不存在' }
    `$entry = Join-Path `$PSScriptRoot 'startup_sidecar.py'
    & `$pythonPath -X utf8 `$entry *>> `$LOG
    if (`$LASTEXITCODE -ne 0) { L 'Sidecar 自启检查未通过，请查看以上结果' }
} catch { L ('Sidecar 自启失败：' + `$_.Exception.Message) }

"@
    [System.IO.File]::WriteAllText($scr, $ps, (New-Object System.Text.UTF8Encoding($true)))   # .ps1 需 BOM
    $cmd = Join-Path $startup 'ComfyUI-Stack.cmd'
    $cmdScript = $scr.Replace('%', '%%')
    $body = "@echo off`r`nchcp 65001 >nul`r`nsetlocal DisableDelayedExpansion`r`nstart `"`" /min powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$cmdScript`"`r`n"
    [System.IO.File]::WriteAllText($cmd, $body, (New-Object System.Text.UTF8Encoding($false)))  # 先切 UTF-8，再读取包含中文的路径；百分号按批处理字面值转义
    Ok "已放开机自启：$cmd"
}

# ---------- 完成 ----------
Say ''
Say '============================================'
Say ' 安装完成'
Say '============================================'
Say ''
Say '接下来：'
Say '  1. 重启 DSH（新插件包要重启才会被加载）'
Say '  2. 左侧栏点「ComfyUI 绘图」'
Say '  3. 在工作台点击连接 ComfyUI 并选择启动方式；首次请确认连接设置'
Say ''
Say '实际输出目录请查看插件连接设置中的解析结果'
Say "日志在：$(Join-Path $dest 'host-plugin.log')"
Say ''
Say "卸载：powershell -ExecutionPolicy Bypass -File uninstall.ps1 -DshHome `"$DshHome`""
Say ''
