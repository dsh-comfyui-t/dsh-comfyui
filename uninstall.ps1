# ============================================================
#  DSH x ComfyUI 绘图台 —— 卸载
#
#  撤销 install.ps1 做的四件事：
#    1. 删插件目录
#    2. 从 cordis.patch.yml 移除注册条目（用备份还原最稳）
#    3. 删启动文件夹里的自启脚本
#
#  用法：powershell -ExecutionPolicy Bypass -File uninstall.ps1
# ============================================================
param(
    [string]$DshHome = $env:DSH_HOME,
    [Alias('Profile')][string]$ProfileName = '',
    [switch]$KeepConfig
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Say($m, $c) { if ($c) { Write-Host $m -ForegroundColor $c } else { Write-Host $m } }

if (-not $DshHome -or -not (Test-Path (Join-Path $DshHome 'profiles'))) {
    foreach ($c in @("$env:USERPROFILE\.dsh")) {
        if (Test-Path (Join-Path $c 'profiles')) { $DshHome = $c; break }
    }
}
if (-not (Test-Path (Join-Path $DshHome 'profiles'))) { Say '找不到 DSH_HOME，请用 -DshHome 指定' 'Red'; exit 1 }

$profileBase = Join-Path $DshHome 'profiles'
$profiles = @(Get-ChildItem -LiteralPath $profileBase -Directory | Where-Object { $_.Name -notmatch '\.bak[-.]|\.uninstalled-' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'cordis.patch.yml')) })
if ($ProfileName) {
    if ($ProfileName -in @('.', '..') -or $ProfileName -match '[/\\]') { throw 'Profile 名称无效' }
    $selected = @($profiles | Where-Object Name -eq $ProfileName)
    if ($selected.Count -ne 1) { throw 'Profile 不存在' }
} elseif ($profiles.Count -eq 1 -or ($profiles.Count -gt 0 -and @($profiles | Where-Object { $_.Name -notin @('desktop','web') }).Count -eq 0)) { $selected = $profiles }
else { throw '多个 Profile，请使用 -Profile 指定' }
$destinations = @($selected | ForEach-Object { Join-Path $_.FullName 'node_modules\@local\dsh-comfyui-console' })
Say ''
Say 'DSH x ComfyUI 绘图台 - 卸载'
Say "  DSH_HOME = $DshHome"
Say ''

# 1) 移除 patch 条目
foreach ($item in $selected) {
    $prof = $item.Name
    $pf = Join-Path $item.FullName 'cordis.patch.yml'
    $pkgPath = Join-Path $item.FullName 'package.json'
    if (Test-Path -LiteralPath $pkgPath) {
        $pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($pkg.dependencies -and $pkg.dependencies.PSObject.Properties['@local/dsh-comfyui-console']) {
            Copy-Item -LiteralPath $pkgPath -Destination ($pkgPath + '.bak-uninstall-' + (Get-Date -Format yyyyMMdd-HHmmss))
            $pkg.dependencies.PSObject.Properties.Remove('@local/dsh-comfyui-console')
            [IO.File]::WriteAllText($pkgPath, ($pkg | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding($false)))
        }
    }
    if (-not (Test-Path $pf)) { continue }
    $txt = [System.IO.File]::ReadAllText($pf, [System.Text.Encoding]::UTF8)
    if ($txt -notmatch 'dsh-comfyui-console') { Say "  $prof：没有注册条目，跳过"; continue }
    Copy-Item $pf "$pf.bak-uninstall-$(Get-Date -Format yyyyMMdd-HHmmss)"
    # 删掉我们加的那一段（从注释行到 name 行）
    $new = [regex]::Replace($txt, "(?m)^# DSH x ComfyUI 绘图台(?:（本地插件）)?\r?\n- insert:\r?\n    - id: comfyui-console\r?\n      name: `"@local/dsh-comfyui-console`"\r?\n?", '')
    if ($new -ne $txt) {
        [System.IO.File]::WriteAllText($pf, $new, (New-Object System.Text.UTF8Encoding($false)))
        Say "  $prof：已移除本插件安装的注册条目" 'Green'
    } else { Say "  $prof：未找到自动安装的注册标记，请手动核查" 'Yellow' }
}

# 2) Move only unregistered plugin copies to a backup; preserve user config.
$remaining = @($profiles | Where-Object { (Get-Content -LiteralPath (Join-Path $_.FullName 'cordis.patch.yml') -Raw -Encoding UTF8) -match 'name:\s*["'']?@local/dsh-comfyui-console' })
if ($remaining.Count -eq 0) { $destinations += Join-Path $profileBase 'node_modules\@local\dsh-comfyui-console' }
foreach ($dest in ($destinations | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $dest) {
        Move-Item -LiteralPath $dest -Destination ($dest + '.uninstalled-' + (Get-Date -Format yyyyMMdd-HHmmss))
        Say "  插件与配置已备份：$dest" 'Green'
    }
}

# 3) 删自启
$cmd = Join-Path ([Environment]::GetFolderPath('Startup')) 'ComfyUI-Stack.cmd'
if ($remaining.Count -eq 0 -and (Test-Path $cmd)) {
    $contents = [System.IO.File]::ReadAllText($cmd)
    if ($contents -match 'dsh-comfyui-console') {
        Remove-Item $cmd -Force
        Say '  本插件开机自启已删除' 'Green'
    } else { Say '  自启脚本名称相同但内容不属于本插件，已保留' 'Yellow' }
} else { Say '  开机自启不存在' }

Say ''
Say '完成。重启 DSH 后插件不再加载。'
Say '（ComfyUI 本体与你的模型都没动，仍可单独使用）'
Say ''
