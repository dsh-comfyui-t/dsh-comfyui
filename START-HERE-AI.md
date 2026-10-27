# START HERE · 给 AI 的安装说明

> 你是执行方。本文件是**可执行规格**，不是介绍。按第 3 节选一条路径走完，用第 6 节自证，别跳步。
> 遇到与本文件冲突的现场状态：以现场为准，但把差异写进最终汇报。

## 0. 一句话

把这套东西装进一台已有 DSH 的 Windows 机器：**ComfyUI 绘图台插件（Host + 侧车 + Web 面板）+ 双卡技能（角色卡 / 风格卡 / LoRA 训练）**，然后用 `dsh web` 重启生效。


## 0. 套件里有什么、没有什么

**包含**：插件代码（`plugin/`，17 文件，app.js / client.js / expander.py / 路由表 / 更新脚本 / 构建脚本）、技能（`skills/comfyui-cards/SKILL.md`，机制与自训流程）、安装与自检脚本（`install/`）、给 AI 的规格（本文件）与人看说明、`VERSION.json`、`MANIFEST.sha256`。

**不包含**：角色卡 / 风格卡的任何 JSON（`.dslcard` 等）、任何 LoRA 权重（`.safetensors`）、你本机 `config.json` 里的私人路径、以及 `lora来源.json` 真件——里面是本机自训 LoRA 的名字与备注，只随包发占位版：

```jsonc
// plugin/lora来源.example.json  ->  复制成 plugin/lora来源.json 再填
{ "<lora-name-without-extension>": { "kind": "local-derived", "note": "..." } }
```

`lora来源.json` 是**可选文件**：缺它插件照常工作（`_pack_sources()` 返回空字典），只是面板里自训 LoRA 没有「本地衍生」角标。角色卡要自己放进 `cardsDir`，套件不带卡。

## 1. 组件与版本

| 组件 | 标识 | 版本 | 说明 |
|---|---|---|---|
| 绘图台插件 | 包名 `dsh-comfyui-console` | **0.7.151**（`dsh.configVersion` 2） | Host 插件 `lib/index.js` + 侧车 `expander.py`（127.0.0.1:8199）+ 面板 `lib/client.js` |
| 双卡技能 | 技能名 `comfyui-cards` | 随套件 | `skills/comfyui-cards/SKILL.md`，讲卡结构与 LoRA/LLLite 自训流程 |
| 安装脚本 | `install/install-ai.ps1` | — | 装文件 + 写 `config.json` + 可选挂载 profile，支持 `-Json` |
| 验证脚本 | `install/verify.ps1` | — | 只读体检，支持 `-Json`，有 FAIL 就退出码 1 |

`VERSION.json` 是机器可读元数据；`MANIFEST.sha256` 是逐文件校验（`sha256sum -c` / PowerShell 都可校验）。

## 2. 前置条件

| 条件 | 如何判定 | 不满足怎么办 |
|---|---|---|
| DSH 已装且能起 Web | `$env:DSH_HOME` 有值；`dsh --help` 可用 | 先装 DSH，本套件不代装 |
| DSH ≥ 0.2.0-rc.2 | `dsh --version` | 升级 DSH；插件写的是 `minHost` |
| **`$DSH_HOME` 可写** | `Test-Path $env:DSH_HOME` | 需要提权（写 profile / 插件目录都在这里） |
| Node ≥ 18 | `node --version` | 装 Node；只用于语法校验与 Host 插件 |
| Python ≥ 3.10（侧车用） | `python --version` | 侧车 `expander.py` 只用标准库，任意 3.10+ 即可 |
| ComfyUI 目录 | 目录内有 `main.py` 或 `python_embeded\python.exe` | 装 ComfyUI；本套件不含模型权重 |
| 端口空闲 | 8188（ComfyUI）、8199（侧车）、10722（DSH Web） | 改 `config.json` 的 `comfyPort` / `sidecarPort` |
| 执行策略 | `Get-ExecutionPolicy` | 用 `powershell -ExecutionPolicy Bypass -File <script>` 绕过（不改系统策略） |

**不需要**：不要预先建 profile 依赖，不要手改 `profiles/*/package.json`（见第 5 节）。

## 3. 安装（三选一）

### 3.1 一条命令（推荐）

```powershell
cd <解压后的套件目录>
powershell -ExecutionPolicy Bypass -File install\install-ai.ps1 `
  -ComfyRoot "D:\ComfyUI\ComfyUI_windows_portable" `
  -CardsDir  "D:\cards" `
  -LinkJunction -Profile 0.2.0-rc.2
```

参数取值：

| 参数 | 何时给 | 不给的后果 |
|---|---|---|
| `-ComfyRoot` | 总是建议给 | 脚本会自动探测常见路径；探测不到则 `comfyRoot` 为空，画不了图 |
| `-CardsDir` | 总是建议给 | 空 = 面板里看不到任何卡 |
| `-PythonExe` | ComfyUI 是便携版时可省 | 省略则用 `comfyRoot\python_embeded\python.exe` |
| `-LinkJunction -Profile <p>` | 想立刻挂进 profile | 只装文件，脚本会打印需要你自己执行的那条 `dsh plugin add` |
| `-ApplyProfile -Profile <p>` | 机器上有 `dsh` CLI 且要官方通道 | 同上（推荐优先用这个） |
| `-Json` | 你要解析结果 | 人读输出 |
| `-ConfigFile <json>` | **路径含中文 / 空格 / 非常规盘符时必用** | 控制台可能把参数解码错（GBK），中文目录会被写成乱码；`-ConfigFile` 走 UTF-8 文件，绕开这条路。模板见 `plugin/config.example.json`，可只写要覆盖的键 |

非 ASCII 路径的标准做法：

```powershell
# 1) 先写一份 UTF-8 无 BOM 的 seed.json（只写你要改的键）
$seed = 'seed.json'
$body = '{"comfyRoot":"D:\\paint","cardsDir":"D:\\dsh\\本地绘画\\角色卡","outputDir":"D:\\paint\\out"}'
[IO.File]::WriteAllText($seed, $body, (New-Object System.Text.UTF8Encoding($false)))
# 2) 安装时指过去
powershell -ExecutionPolicy Bypass -File install\install-ai.ps1 -ConfigFile $seed -LinkJunction -Profile 0.2.0-rc.2
```

安装脚本写完 `config.json` 会**立刻回读校验**：解析失败或 `cardsDir` 出现 `?` → 直接报 `[failed]`/`[warn]` 提示改用 `-ConfigFile`。

**期望**：逐行 `[ok] …`，最后 `RESULT: installed`，并提示重启。任一行 `[failed]` → 按 detail 处理，别继续。

### 3.2 手工（脚本跑不了时）

```powershell
$h  = $env:DSH_HOME                       # 例 D:\dshl\.dsh
$pd = Join-Path $h 'plugins\dsh-comfyui-console\plugin'

# 1) 插件代码
New-Item -ItemType Directory -Path $pd -Force | Out-Null
Copy-Item .\plugin\* $pd -Recurse -Force          # 已存在就覆盖；config.json 不会被覆盖（套件里没有它）
# 2) 技能
New-Item -ItemType Directory -Path (Join-Path $h 'skills\comfyui-cards') -Force | Out-Null
Copy-Item .\skills\comfyui-cards\SKILL.md (Join-Path $h 'skills\comfyui-cards\SKILL.md') -Force
# 3) 配置：从模板复制后改这四个键
Copy-Item (Join-Path $pd 'config.example.json') (Join-Path $pd 'config.json')
#    必填：comfyRoot / cardsDir（workDir 可留空 = 插件目录下 work\）
# 4) 挂 profile（二选一，见第 5 节）
```

写 `config.json` **必须无 BOM**：

```powershell
[IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false)))
```

### 3.3 已经装过旧版（升级，不要重装）

```powershell
powershell -ExecutionPolicy Bypass -File "<$pd>\tools\update.ps1" -Source <新套件的 plugin 目录>
```

`update.ps1` 只换代码：备份 → 替换 `lib/ tools/ expander.py routes.json …` → `node --check` + `py_compile` + `dsh --dump-config`。`config.json` 不动，`dsh.configVersion` 会在下次启动时**就地迁移**（只补缺失键，用户键与未知键全保留）。**不要**删插件目录重装。


## 3.5 升级 dsh 本机之后（换版本号 = 换 profile 目录）

升级 dsh 之后「绘图台不见了」有两种完全不同的原因，先分清再动手：

| 症状 | 原因 | 处置 |
|---|---|---|
| `dsh --profile <新profile> --dump-config` 里**有** `comfyui-console` 行，但页面没面板 | 浏览器还是旧页面缓存，或 client 侧报错 | 硬刷新（Ctrl+F5）；仍无 → F12 Console 看第一条红字 |
| dump-config 里**没有**这一行 | 新版本 = 新 profile 目录（`profiles/<新版本>/`），插件没装进去 | 对新 profile 跑 `dsh plugin add`，或建 junction（见 §5） |
| dump-config 里出现 `skipping profile bundle ... declares no dsh.bundle` | `package.json` 的 `dsh` 段缺 `bundle.patch` / `client.platform` | 把这两个键补回去（只补键，不许整段替换） |

升级后 30 秒自检（三条命令，逐条看输出）：

```powershell
dsh --version                                      # 期望：新版本号
dsh --profile <新profile> --dump-config | Select-String 'comfyui'
                                                   # 期望：出现 comfyui-console 行，且没有 skipping
powershell -ExecutionPolicy Bypass -File install\verify.ps1 -DshHome <DSH_HOME> -Profile <新profile>
                                                   # 期望：SUMMARY: 0 FAIL；host:version / host:minHost /
                                                   #       host:manifest / host:composition 四项全 ok
```

插件对主机的依赖只有四处，任何一处变了都要按上表处置：

1. `package.json` 的 `type/main/exports` 与 `dsh.bundle.patch`、`dsh.client.platform`
2. 入口导出 `name` / `apply(ctx)`（**插件不调用任何 `ctx.*` API**，只起定时器拉侧车）
3. 客户端 `window.__ModuleLoader__.load({ id, factory })` → `exports.apply` / `exports.inject`
4. profile 挂载 + `cordis.patch.yml` 的 `id: comfyui-console` 插入行

侧车（8199）是独立 python 进程，与 dsh 版本无关；插件自带的 `config.json` 有 `configVersion`，新版本首次装载会**就地迁移**，不会丢你填的路径。

## 4. `config.json` 字段

| 键 | 必填 | 示例 | 说明 |
|---|---|---|---|
| `configVersion` | 自动 | `2` | 由插件维护；手写更小值会触发一次迁移 |
| `comfyRoot` | ✅ | `D:\ComfyUI\ComfyUI_windows_portable` | 含 `main.py` 或 `python_embeded\` |
| `pythonExe` | 便携版可省 | `D:\...\python_embeded\python.exe` | 启动 ComfyUI 用 |
| `workDir` | 可省 | `...\plugin\work` | 日志与临时件 |
| `cardsDir` | ✅ | `D:\cards` | 角色卡 / 风格卡所在目录 |
| `outputDir` | 可省 | `D:\ComfyUI\output` | 出图落地目录 |
| `comfyPort` / `sidecarPort` | 可省 | `8188` / `8199` | 端口占用时改这里 |
| `allowLan` | 可省 | `false` | `true` 才放行局域网；公网始终 403 |
| `extraComfyArgs` | 可省 | 见模板 | 启动参数（低显存机器保留默认） |
| 自定义键 | — | 任意 | 迁移与写回都会保留，`/version` 的 `unknownConfigKeys` 会列出 |

## 5. profile 挂载（两条路，别手改文件）

**A. 官方通道（首选）**

```powershell
dsh plugin --profile 0.2.0-rc.2 add "$pd"
```

**B. junction（没有 CLI 时）** — profile 依赖写成 `link:`，指向插件目录：

```powershell
$nm = Join-Path $h 'profiles\0.2.0-rc.2\node_modules'
New-Item -ItemType Directory -Path $nm -Force | Out-Null
cmd /c mklink /J "$nm\dsh-comfyui-console" "$pd"
```

两种方式都还需要 composition 里有这一行（插件包自带 `cordis.patch.yml`，`add` 会自动带入；junction 方式手动加到 `profiles/<p>/cordis.patch.yml`）：

```yaml
- insert:
    - id: comfyui-console
      name: 'dsh-comfyui-console'
```

**禁止**：不要手写 `profiles/<p>/package.json` 的 `dsh.profile.bundles`；不要在 `name` 上加 `?rev=N`（会被当文件名，`ERR_MODULE_NOT_FOUND`）。

## 6. 验证（必须全绿再交付）

```powershell
powershell -ExecutionPolicy Bypass -File install\verify.ps1 -Json     # 退出码 0 = 通过
```

手工等价清单：

| 检查 | 命令 | 期望 |
|---|---|---|
| 文件齐 | `Test-Path "$pd\lib\index.js"` 等 5 个 | 全 `True` |
| 配置能解析 | `[IO.File]::ReadAllText("$pd\config.json") \| ConvertFrom-Json` | 不报错 |
| 侧车活着 | `Invoke-RestMethod http://127.0.0.1:8199/health` | `{ok:true, routes:[…]}` |
| 版本对齐 | `Invoke-RestMethod http://127.0.0.1:8199/version` | `loaded=0.7.151`、`stale=false`、`configVersion=2` |
| 卡目录可读 | 看 `cardsDir` 下 `*.json` / `*.dslcard` 数量 | ≥ 你预期的卡数 |
| ComfyUI | `Invoke-RestMethod http://127.0.0.1:8188/system_stats` | 有 `system` 字段（没起就 8188 不通，属正常） |
| 面板 | 浏览器开 `http://127.0.0.1:10722` | 出现「ComfyUI 绘图台」，顶栏有 `v0.7.151` |

`stale=true` 的含义：磁盘已换新代码、进程还是旧的 → **重启 dsh web**，刷新页面无效（ESM 缓存按进程）。

## 7. 端到端出一张图

1. 面板点「启动 ComfyUI」，等 20–60 秒，状态转绿。
2. 编码器类型选 `qwen_image`（Anima）时，底模下拉只列 `diffusion_models`；选其它类型只列 `checkpoints`。混投会在本地被拦下（红框说明原因）——这是设计行为，别当 bug。
3. 挂 LoRA：`loras` 目录里放 `.safetensors` 后**必须重启 ComfyUI**，否则面板报 `value_not_in_list`。
4. 出图后 `outputDir` 里出现 PNG；面板右侧有「打开目录」。

## 8. 卸载 / 回滚

- 卸载：`dsh plugin --profile <p> remove dsh-comfyui-console`，再删 `plugins\dsh-comfyui-console`。`config.json`、`cardsDir`、`outputDir` 都留在原地。
- 回滚：`tools/update.ps1` 的备份在 `.bak-update-<时间戳>/`；安装脚本的备份在 `plugins\dsh-comfyui-console\.bak-install-<时间戳>/`。拷回后重启。

## 9. 故障 → 处置

| 症状 | 原因 | 处置 |
|---|---|---|
| 提交即 **HTTP 400**，ComfyUI 日志 `Value not in list: unet_name` | 底模给了 checkpoint，但编码器类型是 `qwen_image`（走 `UNETLoader`） | 底模换成 `diffusion_models` 里的，或把编码器类型改成非 qwen_image |
| 面板报 `value_not_in_list`（LoRA/VAE） | 新文件没被 ComfyUI 收录 | 重启 ComfyUI 进程 |
| 8199 不通、面板全灰 | 侧车没起 / `config.json` 里 `comfyRoot` 错 / python 不可用 | 看 `workDir\sidecar.err.log`、`host-plugin.log` |
| 页面 403 `forbidden origin` | 非本机地址访问且 `allowLan=false` | 本机访问，或把 `allowLan` 设 true |
| 改了 `app.js` 页面没变 | 浏览器只加载 `client.js` | 跑 `plugin/tools/build_client.py`，再刷新；仍不变就重启 dsh web |
| `ERR_MODULE_NOT_FOUND …%3Frev=` | 插件 name 上加了 `?rev=N` | 去掉查询串，重启 |
| 卡导入后没有卡 | `cardsDir` 空或指错 | 改 `config.json` 的 `cardsDir`，重启 dsh web |

## 10. 给 AI 的硬约束（红线）

1. 写 `.json` / `.yml` **一律不要 BOM**：`[IO.File]::WriteAllText($p,$t,(New-Object System.Text.UTF8Encoding($false)))`。不要用 `Set-Content -Encoding utf8`（5.1 会写 BOM），也不要用 `-Encoding utf8NoBOM`（5.1 参数绑定失败且**不中断脚本**）。
2. `.ps1` 只用纯 ASCII 字面量（5.1 按 GBK 解码无 BOM 文件）。
3. 改已挂载插件的 `.js` 后**必须重启 dsh web**；不要用 `?rev=N` 当缓存键。
4. 不要手改 profile 的 `package.json` / `dsh.profile.bundles`；用 `dsh plugin add/remove`。
5. 用户数据（`cardsDir`、`outputDir`、`workDir`）**不在插件目录里**；更新插件时不许碰。
6. `config.json` 的键只增不删；新键写默认值，迁移交给插件（`dsh.configVersion`）。
7. 报告里给**证据**：命令 + 输出关键行 + 退出码，不要只写"已装好"。
8. 路径含中文时**不要**直接当命令行参数传（控制台按 GBK 解码，`角色卡` 会变成 `瑙掕壊鍗?`）；一律走 `-ConfigFile` 的 UTF-8 文件。

## 11. 文件清单

```
绘图台双卡套件-1.0-2026-10-20\
├─ START-HERE-AI.md          ← 本文件
├─ 安装说明-给人看.md
├─ VERSION.json              机器可读元数据（版本 / 依赖 / 入口）
├─ MANIFEST.sha256           逐文件 sha256
├─ install\
│   ├─ install-ai.ps1        安装（-Json 可解析）
│   └─ verify.ps1            只读体检（有 FAIL 退出码 1）
├─ plugin\                   插件 0.7.151（可直接被 update.ps1 当作升级源）
│   ├─ lib\index.js          Host 插件：起侧车、配置迁移、版本常量
│   ├─ lib\client.js         面板（由 tools\build_client.py 从 app.js 生成）
│   ├─ lib\app.js            面板源文件
│   ├─ expander.py           侧车（8199）：ComfyUI 生命周期 / 卡 / LLLite / 扩写
│   ├─ config.example.json   配置模板（安装时复制成 config.json）
│   ├─ cordis.patch.yml      composition 行
│   ├─ tools\build_client.py 重建 client.js（--check 校验一致性）
│   ├─ tools\update.ps1      就地更新（不重装）
│   ├─ README.md             完整手册（含「9. 更新（不要重装）」）
│   └─ CHANGELOG.md          版本历史
└─ skills\comfyui-cards\SKILL.md   双卡技能（含 §0 路径约定）
```
