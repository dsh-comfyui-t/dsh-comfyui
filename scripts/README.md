# 多人仓库初始化脚本

把仓库推上 GitHub 之后跑这个，一次性配好协作设置。

## 前置

需要 **gh CLI**（没装的话先装）：

```powershell
winget install --id GitHub.cli -e
# 或 scoop install gh
```

装完登录一次（浏览器弹窗，之后 gh 会记住）：

```powershell
gh auth login
```

> 注意：本机走 Steam++ 加速通道（hosts + MITM 证书）。
> **PowerShell / .NET 信任系统证书存储，gh 是 Go 写的、也走系统存储，所以能用。**
> 但如果你看到证书错误，先 `gh auth login --insecure-storage` 试，或临时关掉 Steam++。

## 用法

```powershell
# 1. 先建好仓库并推上去
$env:OWNER = "你的用户名"
$env:REPO  = "dsh-comfyui-console"
git remote add origin "https://github.com/$env:OWNER/$env:REPO.git"
git push -u origin main

# 2. 配协作
.\scripts\setup-collab.ps1 `
  -Owner  $env:OWNER `
  -Repo   $env:REPO `
  -MemberA "第一个人用户名" `
  -MemberB "第二个人用户名"
```

## 这个脚本做了什么

1. **加协作者**：把 A、B 加进去（他们是 `write` 权限，不能自己合 PR）
2. **改 CODEOWNERS**：把 `@REPLACE_*` 占位符换成真实用户名
3. **开分支保护**：
   - `main` 禁止直接 push
   - 必须 1 个 review
   - **必须 CI 全绿**（`check` 这个 job）
   - 禁止强推、禁止删分支
4. **建标签**：`bug` / `enhancement` / `sidecar` / `ui` / `needs-verify`

## 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `-Owner` | 是 | 仓库属主（你的 GitHub 用户名） |
| `-Repo` | 是 | 仓库名 |
| `-MemberA` | 是 | 协作者 A 的用户名（不要带 @） |
| `-MemberB` | 是 | 协作者 B 的用户名（不要带 @） |
| `-Maintainer` | 否 | 维护者，默认等于 Owner |
| `-DryRun` | 否 | 只打印要执行的命令，不真跑 |
