# DSH 绘图台（dsh-comfyui-console）

DSH 里的 ComfyUI 前端：底模切换、LoRA 多选、提示词扩展、**角色卡 / 风格卡**、LLLite 身份控制、卡包导入导出。

插件只负责"界面 + 编排 + 侧车"，**不含模型**。模型与卡走另外两条分发线（见第 6 节）。

## 1. 环境要求

| 项 | 要求 |
|---|---|
| DSH | 宿主版本能加载 Cordis 插件（`@deepseek-ai/cordis ^0.5.3`） |
| Node | 随 DSH 自带的版本即可 |
| Python | 3.10+，**只用标准库**（侧车不依赖 torch / 不装任何包）。侧车按职责拆成 9 个模块：`expander.py` 只剩 HTTP 分发，其余见 `sidecar_*.py`（state / util / routes / llm / comfy / config / cards / pack / auth） |
| ComfyUI | 便携版（带 `python_embeded\python.exe`）或普通 clone（带 `main.py`），需有 Anima 节点族 |
| 模型 | 底模 `anima-aesthetic-v1.1`（角色）/ `anima-base-v1.0`（画风）+ `qwen_3_06b_base.safetensors` + `qwen_image_vae.safetensors` |

## 2. 安装

```powershell
# 1) 放进 DSH 主目录
Copy-Item -Recurse . "$env:USERPROFILE\.dsh\plugins\dsh-comfyui-console"

# 2) 生成 config.json（自动探测 ComfyUI 与 Python）
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\plugins\dsh-comfyui-console\plugin\install.ps1"

# 3) 在 profile 的 composition 里加一行
#    - insert:
#        - id: comfyui-console
#          name: 'dsh-comfyui-console'
#    或：dsh plugin --profile <profile> add "dsh-comfyui-console"

# 4) 重启 dsh web 进程（插件代码按进程缓存，刷新页面不够）
# 5) 验证侧车
Invoke-RestMethod http://127.0.0.1:8199/health
```

`install.ps1` 参数：`-ComfyRoot`、`-PythonExe`、`-CardsDir`、`-WorkDir`、`-OutputDir`、`-ComfyPort 8188`、`-SidecarPort 8199`、`-AllowLan`、`-Force`。
没传的项会去常见位置探测；`config.json` 已存在时加 `-Force` 才覆盖。
**首次装载时若没有 `config.json`，插件会按 `config.example.json` 自动生成一份**（填探测到的 comfyRoot/pythonExe/workDir，`cardsDir`/`outputDir` 留给你确认）。

## 3. config.json 字段

| 键 | 含义 | 备注 |
|---|---|---|
| `comfyRoot` | ComfyUI 根目录（`main.py` 或 `python_embeded` 所在） | 可以用 junction 指过去 |
| `pythonExe` | 跑 `expander.py` 的解释器 | 会自动换成同目录的 `pythonw.exe`（不弹黑框）；找不到退回 `python.exe` |
| `workDir` | 日志与缓存（`host-plugin.log`、`sidecar.out/err.log`） | 缺省 = 插件目录 |
| `cardsDir` | 角色卡 JSON 目录，侧车 `/cards` 扫它 | **只在根层扫 `.json`，不递归** |
| `outputDir` | 出图目录 | ComfyUI 的输出目录 |
| `comfyPort` / `sidecarPort` | 端口 | 默认 8188 / 8199 |
| `extraComfyArgs` | 拉起 ComfyUI 时附加的参数 | 8 GB 卡用的那组默认值 |
| `allowLan` | 是否允许**私网段**页面访问侧车 | 默认 `false`；仅放行 10./192.168./172.16-31. |

`credsFile` 只在需要代理下载时才填，留空即可。

## 4. 端口与进程

- **ComfyUI 8188**：按需启动（页面按钮 → `POST /comfy/start`）。
- **侧车 8199**：常驻，插件装载后 4 秒自动拉起；已在跑就跳过。
- 侧车只有标准库依赖，`/health` 能立刻验证。
- 起不来先看 `workDir\host-plugin.log`，再看 `sidecar.err.log`。

## 5. 局域网使用

默认侧车只接受本机页面（`127.0.0.1 / localhost / [::1]`）。从别的机器访问 DSH 页面（`http://192.168.x.x:10722`）时，
浏览器会把该地址作为 `Origin` 发过来，**默认会被 403 拒绝**。要开就给 `config.json` 加 `"allowLan": true` 并重启 dsh web
（或在 `install.ps1` 时加 `-AllowLan`）。只放行私网段，公网地址始终拒绝；服务端脚本/curl 不带 Origin，不受影响。

## 5.1 鉴权与请求体上限（0.5.7 起重写）

侧车（127.0.0.1:8199）能花 API key（`/expand`）、写卡（`/cards/write`）、停服务（`/comfy/stop`），所以设两道**叠闸**：

| 调用者 | 判据 | 结果 |
|---|---|---|
| 面板（浏览器） | `Origin` 在白名单内 **且** 带 `X-Console-Client: 1` | 放行 |
| 其它网站的页面 | 预检被 ACAO 拒（ACAO 只回显白名单 Origin，不是 `*`） | **请求发不出去** |
| 本机脚本 / curl / 其它软件 | 必须带 `X-Console-Token` | 缺或错 → `401` |
| `OPTIONS`、`/health`、`/version` | 白名单 | 放行 |

为什么两道都要：

- `Origin` 是**客户端可控的请求头**，单看它挡不住任何本机进程（加一行 `Origin: http://127.0.0.1` 就过）。
- 但浏览器**不能**随意设自定义头：带 `X-Console-Client` 的请求必须先过 CORS 预检，而预检的放行权在服务端的 ACAO——
  只回显白名单 Origin 时，`evil.com` 的预检必然失败，浏览器于是根本不会发真实请求。
- 脚本侧没这层保护，所以用 token 抬门槛：**要读盘才能拿到 token**。

**残余风险（如实）**：本机任意进程可以同时伪造 `Origin` 与 `X-Console-Client`。本地进程隔离只能靠 OS 账户权限，
不在本插件能力范围；token 的真实作用是"挡住不读盘的顺手调用"，不是防有权限的本机程序。

token 三级来源：`config.json` 的 `sidecarToken` → `<workDir>\sidecar-token.txt` → 都没有则生成 32 字节 `token_urlsafe` 并落盘。

```powershell
# 脚本调用示例
curl.exe -H "X-Console-Token: <token>" -X POST http://127.0.0.1:8199/expand -d '{}'
```

临时关掉鉴权：`config.json` 里 `"requireToken": false`（仅调试用）。`GET /version` 返回 `tokenRequired` 与 `limits` 便于自查。

请求体上限分档：`MAX_BODY` 8 MB（普通 JSON）、`MAX_BODY_UPLOAD` 256 MB（`/stylecards/unpack`、`/cards/import`、`/cards/selfcontained`）。
超限直接 `413`，**不读请求体**。

> 生成侧的坑与真因见 [`docs/生成经验.md`](docs/生成经验.md)——改 `app.js` / 侧车之前先读它。


## 6. 模型与卡不在这里

| 资产 | 怎么来 |
|---|---|
| 底模三件套 | 自己下（Anima 模型页 / 团队内部盘），放 `ComfyUI\models\{diffusion_models,text_encoders,vae}` |
| 角色 / 画风 LoRA | 放 `ComfyUI\models\loras\`；**放入后必须重启 ComfyUI**（启动时扫描并缓存） |
| LLLite 权重 | 放 `ComfyUI\models\model_patches\`，并在 `cardsDir\lllite-index.json` 登记 |
| 角色卡 / 风格卡 | 分发走 `.dslcard` 全量卡包：拖进页面即解包，LoRA + LLLite 权重 + 控制图一起落地 |

卡包里带不走的只有底模三件套与插件本体，这两样对上表即可。

## 7. 改代码后怎么生效

```powershell
# 界面（lib/app.js 是源码，lib/client.js 是生成物；浏览器只加载后者）
python plugin\tools\build_client.py          # 四份源码拼成 client.js
python plugin\tools\build_client.py --check  # 只比对是否同步
# 侧车（expander.py）改完重启 8199
Get-NetTCPConnection -LocalPort 8199 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
# 插件本体（lib/index.js）改完重启 dsh web 进程
```

## 8. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面在，但一切接口都失败 | 侧车没起来 | 看 `host-plugin.log`；确认 `pythonExe` 能跑、8199 没被占 |
| `403 forbidden origin` | 从非本机地址访问页面且 `allowLan` 为 false | 见第 5 节 |
| 侧车起来了但 ComfyUI 相关全炸 | `comfyRoot` 指错，或 ComfyUI 没启动 | 页面点启动；确认 `main.py` / `python_embeded` 在 |
| 提交直接 **HTTP 400**，ComfyUI 日志写 `Value not in list: unet_name` | 底模分两条链：编码器类型 `qwen_image`（Anima）走 `UNETLoader` 读 **diffusion_models**，其余走 `CheckpointLoaderSimple` 读 **checkpoints**；把 checkpoint 投给 Anima 分支必被拦 | 面板已内建拦截：底模下拉按当前编码器类型只列对应目录，失配标红并拒绝提交。手改过 config 或换过 ComfyUI 时，核对两个目录各有什么 |
| LoRA 显示 `value_not_in_list` | 放进 loras 后没重启 ComfyUI | 重启 ComfyUI；`lora_name` 带 `.safetensors` |
| 改了 `app.js` 界面没变 | 浏览器只加载 `client.js` | 跑 `build_client.py`，刷新；仍不变就重启 dsh web |
| 角色卡保存后盘上多一张 | 面板按 `id` 匹配，卡里没有 `id` | 升级到这个版本后重新保存一次，会补齐 `id` |

## 9. 更新（不要重装）

更新 = **只换代码**，不需要 `dsh plugin remove/add`，不需要改 composition，不丢 `config.json`、`workDir`、`cardsDir`、`outputDir`。

### 9.1 三条更新路径

| 场景 | 做法 |
|---|---|
| 手里有新版目录 / zip / `npm pack` 的 tgz | `.\\tools\\update.ps1 -Source <路径>`（推荐） |
| 新版解到了另一个目录 | 把 profile 里的 junction 指过去：`profiles/<p>/node_modules/dsh-comfyui-console` → 新目录，再重启 |
| 发布到 registry | `dsh plugin --profile <p> add dsh-comfyui-console@<ver>`，pnpm 直接换目录，依赖名不变 |

`update.ps1` 会：校验包名与版本 → 备份旧 `lib/` `expander.py` `package.json` 到 `.bak-update-<时间戳>/` → 替换 `lib/ tools/ expander.py routes.json cordis.patch.yml install.ps1 README.md CHANGELOG.md config.example.json` 与其它根级 `*.json` → `node --check` + `py_compile` + `dsh --dump-config` → 提示重启。`-DryRun` 只看计划，`-Force` 允许同版本覆盖。

### 9.2 版本与配置版本是两件事

- `package.json` 的 `version`：插件代码版本
- `package.json` 的 `dsh.configVersion`：**配置结构**版本。插件升级时若新增/改名配置键，就把它 +1
- 启动时 `lib/index.js` 会读 `config.json` 的 `configVersion`，落后就**就地迁移**：只补缺失键、不删用户键、不认识的键原样保留，写回一次，幂等。所以配置永远不需要你手动改
- 不想被迁移的键：写在 `config.json` 里任意自定义键即可，迁移和 `_cfg_set()` 都会原样保留（`/version` 的 `unknownConfigKeys` 会列出来）

### 9.3 怎么确认"跑的是哪一版、要不要重启"

```powershell
Invoke-RestMethod http://127.0.0.1:8199/version | Select loaded,disk,stale,configVersion,pid
```

- `loaded`：本进程装载时的版本（模块缓存里那份）
- `disk`：磁盘 `package.json` 现在的版本
- `stale: true` → 包已经换过，但进程还是旧代码，**重启 dsh web** 才生效
- 面板右上底栏也会显示 `vX.Y.Z`，`stale` 时旁边会出现红色「需重启」

ESM 缓存是**按进程**的，所以页面刷新不够；也不要给插件名加 `?rev=N` 当缓存键（会把名字当文件路径、`ERR_MODULE_NOT_FOUND`）。

### 9.4 回滚

`update.ps1` 备份在 `.bak-update-<时间戳>/`（含 `lib/`、`expander.py`、`package.json`）。把它们拷回去，再重启。

## 10. 包名与改名

当前包名是 `dsh-comfyui-console`（v0.5.7，已去掉 `private`、带 `files` 白名单与 `dsh` 更新元数据，可 `npm pack` / 拷目录安装）。

再改名要**同时**动五处，漏一处就装载失败：

1. `plugin/package.json` 的 `name`
2. `plugin/lib/index.js` 的 `export const name`
3. `plugin/cordis.patch.yml` 的 `insert.name`
4. `plugin/lib/client.js` 包装头里的 `id:`（这一段由 `build_client.py` 原样保留，改前先备份）
5. profile 侧：`profiles/<p>/package.json` 的 `dependencies` 键与 `dsh.profile.bundles` 数组、
   `node_modules/<name>` 的 junction、`node_modules/.package-map.json` 的依赖键、两个 lock 文件的键

改完用 `dsh --profile <p> --dump-config` 复核组合里出现新名、退出码 0，再重启 dsh web。
