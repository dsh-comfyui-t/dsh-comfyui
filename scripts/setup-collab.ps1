# -*- coding: utf-8 -*-
<#
.SYNOPSIS
    一次性配好 dsh-comfyui-console 的多人协作设置。

.DESCRIPTION
    做四件事：
      1. 把两个协作者加进仓库（write 权限，不能自己合 PR）
      2. 把 .github/CODEOWNERS 里的 @REPLACE_* 换成真实用户名
      3. 开 main 分支保护：禁直推、必须 1 个 review、必须 CI 全绿、禁强推
      4. 建几个标签

    需要 gh CLI 并已 gh auth login。跑之前确认仓库已经推到 GitHub。

.PARAMETER Owner
    仓库属主（你的 GitHub 用户名）

.PARAMETER Repo
    仓库名

.PARAMETER MemberA
    协作者 A 的用户名（不带 @）

.PARAMETER MemberB
    协作者 B 的用户名（不带 @）

.PARAMETER Maintainer
    维护者，默认等于 Owner

.PARAMETER DryRun
    只打印要执行的命令，不真跑

.EXAMPLE
    .\scripts\setup-collab.ps1 -Owner lqh -Repo dsh-comfyui-console -MemberA alice -MemberB bob

.EXAMPLE
    .\scripts\setup-collab.ps1 -Owner lqh -Repo dsh-comfyui-console -MemberA alice -MemberB bob -DryRun
#>
param(
    [Parameter(Mandatory = $true)][string]$Owner,
    [Parameter(Mandatory = $true)][string]$Repo,
    [Parameter(Mandatory = $true)][string]$MemberA,
    [Parameter(Mandatory = $true)][string]$MemberB,
    [string]$Maintainer = '',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $Maintainer) { $Maintainer = $Owner }

function Say($m) { Write-Host $m }
function Ok($m) { Write-Host "  ✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }
function Bad($m) { Write-Host "  ✗ $m" -ForegroundColor Red }
function Run($desc, [scriptblock]$action) {
    Say "  > $desc"
    if ($DryRun) { Say "    （DryRun，跳过）"; return $null }
    try { return & $action }
    catch { Bad "失败：$desc"; throw }
}

Say ''
Say '========================================'
Say ' dsh-comfyui-console 多人协作设置'
Say '========================================'
Say "  仓库    : $Owner/$Repo"
Say "  维护者  : $Maintainer"
Say "  协作者  : $MemberA , $MemberB"
if ($DryRun) { Say '  模式    : DryRun（只看不做）' }
Say ''

# ---------- 0. 前置检查 ----------
Say '--- 0. 前置检查 ---'
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Bad 'gh CLI 没装。先跑：winget install --id GitHub.cli -e'
    Say '    装完：gh auth login'
    exit 1
}
Ok "gh 已装：$($gh.Source)"

if (-not $DryRun) {
    $authOk = $false
    try { gh auth status 2>&1 | Out-Null; $authOk = ($LASTEXITCODE -eq 0) } catch { $authOk = $false }
    if (-not $authOk) {
        Bad 'gh 未登录。先跑：gh auth login'
        exit 1
    }
    Ok 'gh 已登录'
}

$repoExists = $false
if (-not $DryRun) {
    try { gh repo view "$Owner/$Repo" 2>&1 | Out-Null; $repoExists = ($LASTEXITCODE -eq 0) } catch { $repoExists = $false }
    if (-not $repoExists) {
        Bad "仓库 $Owner/$Repo 不存在，或 gh 看不到它。先在网页上建好并 push 一次。"
        exit 1
    }
    Ok "仓库存在：$Owner/$Repo"
}

# ---------- 1. 加协作者 ----------
Say ''
Say '--- 1. 加协作者（write 权限）---'
foreach ($u in @($MemberA, $MemberB)) {
    Run "加 $u" {
        gh api -X PUT "repos/$Owner/$Repo/collaborators/$u" -f permission=push
    } | Out-Null
    if (-not $DryRun) { Ok "$u 已邀请（对方要接受邀请才会生效）" }
}

# ---------- 2. 填 CODEOWNERS ----------
Say ''
Say '--- 2. 填 CODEOWNERS ---'
$co = Join-Path $PSScriptRoot '..\.github\CODEOWNERS'
if (-not (Test-Path $co)) {
    Warn "找不到 $co，跳过"
} else {
    $text = Get-Content $co -Raw -Encoding UTF8
    $text = $text.Replace('@REPLACE_OWNER', "@$Maintainer")
    $text = $text.Replace('@REPLACE_A', "@$MemberA")
    $text = $text.Replace('@REPLACE_B', "@$MemberB")
    if ($DryRun) {
        Say '  （DryRun，不写文件）'
    } else {
        [System.IO.File]::WriteAllText($co, $text, (New-Object System.Text.UTF8Encoding($false)))
        Ok "已替换为 @$Maintainer / @$MemberA / @$MemberB"
        Warn '记得把 CODEOWNERS 的改动也提交上去（它不生效于已存在的提交）'
    }
}

# ---------- 3. 分支保护 ----------
Say ''
Say '--- 3. main 分支保护 ---'
$payload = @{
    required_status_checks           = @{ strict = $true; contexts = @('check') }
    enforce_admins                   = $false
    required_pull_request_reviews    = @{
        required_approving_review_count = 1
        dismiss_stale_reviews           = $true
    }
    restrictions                     = $null
    allow_force_pushes               = $false
    allow_deletions                  = $false
} | ConvertTo-Json -Depth 6 -Compress

Say "  > PUT repos/$Owner/$Repo/branches/main/protection"
Say "    必须 CI 全绿（context = check）+ 1 个 review + 禁强推 + 禁删分支"
if (-not $DryRun) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("bp-" + [guid]::NewGuid().ToString('N') + '.json')
    [System.IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding($false)))
    try {
        gh api -X PUT "repos/$Owner/$Repo/branches/main/protection" --input $tmp | Out-Null
        Ok '分支保护已开'
    } catch {
        Bad '分支保护设置失败'
        Warn '私有仓库需要 GitHub Pro 才能开分支保护；公开仓库免费可用。'
        Warn '报 403 的话改用仓库 Settings -> Branches 手工配，规则同上。'
        throw
    } finally {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
}

# ---------- 4. 标签 ----------
Say ''
Say '--- 4. 建标签 ---'
$labels = @(
    @{ name = 'bug';           color = 'd73a4a'; desc = '功能不对' },
    @{ name = 'enhancement';   color = 'a2eeef'; desc = '新功能 / 改进' },
    @{ name = 'sidecar';       color = '5319e7'; desc = '侧车 / 鉴权 / ComfyUI 生命周期' },
    @{ name = 'ui';            color = 'fbca04'; desc = '面板界面' },
    @{ name = 'needs-verify';  color = 'e4e669'; desc = '改了但没在真机上验证' },
    @{ name = 'generated';     color = 'cccccc'; desc = '生成物，别手改（如 client.js）' }
)
foreach ($l in $labels) {
    Say "  > 标签 $($l.name)"
    if (-not $DryRun) {
        try {
            gh label create $l.name --color $l.color --description $l.desc --force 2>&1 | Out-Null
            Ok "  $($l.name)"
        } catch {
            Warn "  $($l.name) 创建失败（可能已存在）"
        }
    }
}

# ---------- 收尾 ----------
Say ''
Say '========================================'
if ($DryRun) {
    Say ' DryRun 完成，什么都没改'
} else {
    Say ' 完成'
    Say ''
    Say ' 接下来：'
    Say '   1. 把 CODEOWNERS 的改动提交推上去'
    Say '   2. 让两个人去邮箱里点「接受邀请」'
    Say "   3. 开一个测试 PR 验证分支保护生效（应该要求 review + CI）"
}
Say '========================================'
Say ''
