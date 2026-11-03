<#
.SYNOPSIS
    Comfy Cards Next（dsh-comfy-cards-next）卸载清理：把插件在包外留下的一切带走。

.DESCRIPTION
    本脚本不依赖插件代码、不依赖 Python，插件目录被删掉之后也能单独重新执行，
    因此既是 npm preuninstall 的钩子，也是手动兜底。

    执行顺序（每步都先判断存在，不存在就跳过）：
      1. 停掉跑 expander.py 的 pythonw 侧车进程
      2. 删除计划任务 dsh-comfy-cards-next-cleanup（以及旧名 dsh-comfyui-console-cleanup）
      3. 删除装进 ComfyUI 的桥接节点 custom_nodes\dsh_post_controls
      4. 备份词库 tags.sqlite3 → <BackupDir>\comfyui-词库备份-<时间戳>\，校验大小后再删数据目录
      5. 删除旧数据目录 <comfyRoot>\comfyui-console-data
      6. 清 profile 里的依赖条目与 node_modules 链接（否则卸载后成悬空 link）
      7. 删除包内 work\（令牌、日志）

    绝不触碰：角色卡、LoRA、出图目录、ComfyUI 本体与它的工作流、custom_nodes 里别人的节点。

.PARAMETER Auto
    非交互模式，给 npm preuninstall 用（本脚本本来就不提问，这个开关只影响日志措辞）。

.PARAMETER KeepData
    保留词库与旧数据目录，只清代码侧残留（不备份、不删除）。

.PARAMETER DryRun
    只打印将要做什么，一个字节都不删。

.PARAMETER BackupDir
    词库备份的落点，默认 <工作区>\日志。

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\uninstall.ps1 -DryRun

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\uninstall.ps1 -KeepData
#>
[CmdletBinding()]
param(
    [switch]$Auto,
    [switch]$KeepData,
    [switch]$DryRun,
    [string]$BackupDir = '<工作区>\日志',
    [string]$TestRoot = '',
    [switch]$FailOnError
)

$ErrorActionPreference = 'Continue'
$script:removed = New-Object System.Collections.Generic.List[string]
$script:kept = New-Object System.Collections.Generic.List[string]
$script:failed = New-Object System.Collections.Generic.List[string]

function Say([string]$text) { Write-Host $text }

function Remove-Target([string]$path, [string]$what) {
    if (-not $path) { return }
    if (-not (Test-Path -LiteralPath $path)) {
        Say ("  跳过（不存在）  {0}" -f $path)
        return
    }
    if ($DryRun) {
        Say ("  [预演] 将删除   {0}    <- {1}" -f $path, $what)
        return
    }
    try {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
        Say ("  已删除          {0}" -f $path)
        $script:removed.Add($path)
    }
    catch {
        # .pyc 常被刚退出的进程短暂占用，等一下重试一次
        Start-Sleep -Milliseconds 500
        try {
            Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
            Say ("  已删除（重试）  {0}" -f $path)
            $script:removed.Add($path)
        }
        catch {
            Say ("  删除失败        {0}    {1}" -f $path, $_.Exception.Message)
            $script:failed.Add($path)
        }
    }
}

function Read-Cfg([string]$key) {
    $cfgPath = Join-Path $PkgDir 'config.json'
    if (-not (Test-Path -LiteralPath $cfgPath)) { return '' }
    try {
        $cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
        return [string]$cfg.$key
    }
    catch { return '' }
}

$PkgDir = Split-Path -Parent $PSScriptRoot          # plugin\
$PkgName = 'dsh-comfy-cards-next'
$LegacyPkgName = 'dsh-comfyui-console'
$ComfyRoot = Read-Cfg 'comfyRoot'
if (-not $ComfyRoot) { $ComfyRoot = '<ComfyUI父目录>' }
$ComfyMain = Read-Cfg 'comfyMainDir'
if (-not $ComfyMain) { $ComfyMain = Join-Path $ComfyRoot 'ComfyUI' }

# 演练模式：把 custom_nodes / 旧数据目录 / work 全部重定向到演练根下
if ($TestRoot) {
    $PkgDir = $TestRoot
    $ComfyMain = $TestRoot
    $ComfyRoot = $TestRoot
}

Say ''
Say '=== Comfy Cards Next 卸载清理 ==='
if ($TestRoot) { Say ("模式：演练（全部目标重定向到 {0}）" -f $TestRoot) }
elseif ($DryRun) { Say '模式：预演（不删除任何东西）' }
elseif ($KeepData) { Say '模式：保留数据（只清代码侧残留）' }
else { Say '模式：备份词库后全量清理' }
Say ("包目录：{0}" -f $PkgDir)
Say ''

# ---- 1. 侧车进程 ----
Say '[1/7] 停止侧车'
if ($TestRoot) {
    Say '  演练模式：跳过'
}
elseif ($DryRun) {
    Say '  [预演] 将结束跑 expander.py 的 pythonw 进程'
}
else {
    $stopped = 0
    try {
        Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -like '*expander.py*' } |
            ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                $stopped++
            }
    }
    catch { Say ("  枚举进程失败：{0}" -f $_.Exception.Message) }
    Say ("  结束进程 {0} 个" -f $stopped)
}

# ---- 2. 计划任务 ----
Say '[2/7] 删除计划任务'
$taskName = 'dsh-comfy-cards-next-cleanup'
$legacyTaskName = 'dsh-comfyui-console-cleanup'
foreach ($tn in @($taskName, $legacyTaskName)) {
    $taskOut = & schtasks /Query /TN $tn 2>&1
    if ($TestRoot) { Say '  演练模式：跳过'; break }
    elseif ($LASTEXITCODE -ne 0 -or "$taskOut" -match 'cannot find|找不到') { Say ("  跳过（{0} 不存在）" -f $tn); continue }
    elseif ($DryRun) { Say ("  [预演] 将删除计划任务 {0}" -f $tn); continue }
    else {
        $delOut = & schtasks /Delete /TN $tn /F 2>&1
        if ($LASTEXITCODE -eq 0) { Say ("  已删除计划任务 {0}" -f $tn); $script:removed.Add("task:$tn") }
        else { Say ("  删除失败 {0}  {1}" -f $tn, "$delOut"); $script:failed.Add("task:$tn") }
    }
}

# ---- 3. ComfyUI 桥接节点 ----
Say '[3/7] 删除 ComfyUI 桥接节点'
$bridge = Join-Path $ComfyMain 'custom_nodes\dsh_post_controls'
Say ("  目标：{0}" -f $bridge)
Remove-Target $bridge '装进 ComfyUI 的后处理桥接节点'

# ---- 4. 词库 ----
Say '[4/7] 词库数据'
if ($TestRoot) { $dataDir = Join-Path $TestRoot 'data' }
else { $dataDir = Join-Path $env:LOCALAPPDATA 'DSH\ComfyUIConsole' }
if ($KeepData) {
    Say ("  保留：{0}" -f $dataDir)
    $script:kept.Add($dataDir)
}
elseif (-not (Test-Path -LiteralPath $dataDir)) {
    Say '  跳过（不存在）'
}
elseif ($DryRun) {
    Say ("  [预演] 将先备份 tags.sqlite3 到 {0}，再删除 {1}" -f $BackupDir, $dataDir)
}
else {
    $db = Join-Path $dataDir 'tags.sqlite3'
    $okToDelete = $true
    if (Test-Path -LiteralPath $db) {
        $bkDir = Join-Path $BackupDir ("comfyui-词库备份-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        try {
            New-Item -ItemType Directory -Path $bkDir -Force | Out-Null
            Copy-Item -LiteralPath $db -Destination $bkDir -Force -ErrorAction Stop
            $srcLen = (Get-Item -LiteralPath $db).Length
            $dstLen = (Get-Item -LiteralPath (Join-Path $bkDir 'tags.sqlite3')).Length
            if ($srcLen -ne $dstLen) {
                Say ("  备份大小不一致（{0} vs {1}），放弃删除" -f $srcLen, $dstLen)
                $okToDelete = $false
                $script:failed.Add($db)
            }
            else {
                Say ("  已备份词库 {0:N0} KB → {1}" -f ($srcLen / 1KB), $bkDir)
                $script:kept.Add($bkDir)
            }
            $cache = Join-Path $dataDir 'online_models.json'
            if (Test-Path -LiteralPath $cache) { Copy-Item -LiteralPath $cache -Destination $bkDir -Force -ErrorAction SilentlyContinue }
        }
        catch {
            Say ("  备份失败：{0}，放弃删除" -f $_.Exception.Message)
            $okToDelete = $false
            $script:failed.Add($db)
        }
    }
    if ($okToDelete) { Remove-Target $dataDir '词库数据库与在线模型缓存' }
    else { Say ("  保留：{0}" -f $dataDir); $script:kept.Add($dataDir) }
}

# ---- 5. 旧数据目录 ----
Say '[5/7] 旧数据目录'
$legacy = Join-Path $ComfyRoot 'comfyui-console-data'
if ($KeepData) {
    Say ("  保留：{0}" -f $legacy)
    $script:kept.Add($legacy)
}
else {
    Remove-Target $legacy '旧版 console.db 与 work 日志'
}

# ---- 6. profile 挂载（依赖条目 + node_modules 链接）----
Say '[6/7] profile 挂载'
$PluginRoot = Split-Path -Parent $PkgDir
$PluginsDir = Split-Path -Parent $PluginRoot
$DshHome = Split-Path -Parent $PluginsDir
$profRoot = Join-Path $DshHome 'profiles'
if (-not (Test-Path -LiteralPath $profRoot)) {
    $profRoot = Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles'
}
if ($TestRoot) {
    Say '  演练模式：跳过'
}
elseif (-not (Test-Path -LiteralPath $profRoot)) {
    Say '  跳过（没找到 profiles 目录）'
}
else {
    $dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
    foreach ($prof in (Get-ChildItem -LiteralPath $profRoot -Directory -ErrorAction SilentlyContinue)) {
        foreach ($pn in @($PkgName, $LegacyPkgName)) {
            $jp = Join-Path $prof.FullName ("node_modules\" + $pn)
            if (Test-Path -LiteralPath $jp) {
                if ($DryRun) {
                    Say ("  [预演] 将删除链接  {0}" -f $jp)
                }
                else {
                    # junction 用 rmdir 删，Remove-Item 在悬空链接上会报错
                    cmd /c rmdir "$jp" 2>&1 | Out-Null
                    if (Test-Path -LiteralPath $jp) {
                        Say ("  链接删除失败    {0}" -f $jp)
                        $script:failed.Add($jp)
                    }
                    else {
                        Say ("  已删除链接      {0}" -f $jp)
                        $script:removed.Add($jp)
                    }
                }
            }
        }
        $profPkg = Join-Path $prof.FullName 'package.json'
        if (-not (Test-Path -LiteralPath $profPkg)) { continue }
        $raw = Get-Content -LiteralPath $profPkg -Raw -Encoding UTF8
        foreach ($pn in @($PkgName, $LegacyPkgName)) {
            if ($raw -notmatch [regex]::Escape($pn)) { continue }
            if ($DryRun) {
                Say ("  [预演] 将从 profile {0} 移除依赖 {1}" -f $prof.Name, $pn)
            }
            elseif ($dshCmd) {
                Say ("  从 profile {0} 移除依赖 {1} …" -f $prof.Name, $pn)
                & $dshCmd.Source plugin --profile $prof.Name remove $pn 2>&1 | ForEach-Object { Say ("    " + $_) }
                if ($LASTEXITCODE -eq 0) {
                    $script:removed.Add("profile:" + $prof.Name + "/" + $pn)
                }
                else {
                    Say ("  移除失败，请手工执行：dsh plugin --profile {0} remove {1}" -f $prof.Name, $pn)
                    $script:failed.Add("profile:" + $prof.Name + "/" + $pn)
                }
            }
            else {
                Say ("  没找到 dsh 命令，请手工执行：dsh plugin --profile {0} remove {1}" -f $prof.Name, $pn)
                $script:kept.Add("profile:" + $prof.Name + "/" + $pn)
            }
        }
    }
}

# ---- 7. 包内 work ----
Say '[7/7] 包内工作目录'
$work = Join-Path $PkgDir 'work'
Remove-Target $work '侧车令牌、日志、运行期缓存'

# ---- 汇总 ----
Say ''
Say '=== 结果 ==='
Say ("删除 {0} 项，保留 {1} 项，失败 {2} 项" -f $script:removed.Count, $script:kept.Count, $script:failed.Count)
if ($script:kept.Count) {
    Say '保留：'
    $script:kept | ForEach-Object { Say ("  {0}" -f $_) }
}
if ($script:failed.Count) {
    Say '失败（可稍后重跑本脚本）：'
    $script:failed | ForEach-Object { Say ("  {0}" -f $_) }
}
Say ''
Say '未被触碰：角色卡 / LoRA / 出图目录 / ComfyUI 本体 / custom_nodes 里其他人的节点'
Say '插件包目录本身由卸载命令（npm / dsh plugin remove）删除，本脚本不动它。'
Say ''

# preuninstall 里非 0 退出会让 npm 中止整次卸载、反而卸载不掉。
# 所以默认永远退 0（清理是尽力而为），只有显式 -FailOnError 才把失败暴露成退出码。
if ($FailOnError -and $script:failed.Count) { exit 1 }
exit 0
