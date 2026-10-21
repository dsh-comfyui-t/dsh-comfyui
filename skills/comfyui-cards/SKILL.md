---
name: "comfyui-cards"
description: "dsh-comfyui-console 插件里角色卡与风格卡的完整机制与自训流程：两种卡存哪、字段（含 conditioning 身份控制）、特征锁与 scope、完整/换装插入、全量卡包导出与三档 API 语义、导入与 dest 路由、缺件下载、分发口径；以及从零训练角色 LoRA / 画风 LoRA / LLLite 身份控制的数据配比、打标口径、超参、评测取件、坑表与画风剥离。用户提到角色卡、风格卡、特征锁、插入、导出卡、导入卡、.dslcard、.dslrecipe、卡包、LoRA 内嵌、LLLite 身份控制、训练 LoRA、数据集打标、caption、重训、画风剥离、facetraining 时才加载。"
whenToUse: "要新建/修改/导入/导出/分发角色卡或风格卡；要调特征锁与 scope；要配或排查 LLLite 身份控制；要从零训练或重训角色 LoRA、画风 LoRA、LLLite，要准备数据集与打标、定超参、评测挑选存档、做画风剥离；要判断某次改动是否需要重建 client.js 或重启侧车；要核对卡包往返与验收命令时。"
---

## 0. 路径约定（换机器只改这一节）

技能正文里的绝对路径是本机（作者机器）的实测路径，换机器时按下表替换，其余内容不用改。

| 本机路径 | 含义 | 换机器时替换成 |
|---|---|---|
| `D:\dshl\.dsh\` | **DSH_HOME**：插件、技能、profile 都在这 | 你的 `$DSH_HOME` |
| `D:\dsh\` | 会话工作区（卡、数据集、脚本、日志、交付区） | 你的工作区根 |
| `D:\dsh\本地绘画\角色卡` | 角色卡 / 风格卡的默认 `cardsDir` | 任意目录，写进 `config.json` 的 `cardsDir` |
| `D:\paint\` | ComfyUI 便捷根（junction），模型在 `models\` | 你的 ComfyUI 根 |
| `D:\paint\venv312\Scripts\python.exe` | 装了依赖的 Python（渲染 / 合成脚本用） | 你的 Python 3.10+ |
| `D:\paint\runtime\python312\pythonw.exe` | 侧车用（无控制台）Python | 你的 `pythonw.exe` |

约定：卡与数据集永远是**用户数据**，不放在插件目录里；插件升级不碰它们。

# 角色卡 / 风格卡 机制与用法（dsh-comfyui-console）

插件目录 `D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin\`：
`lib\app.js`（源码，界面主体）、`lib\dict.js`、`lib\presets.js`、`lib\workflow.js`、
`lib\client.js`（**浏览器只加载这个，由上面四份拼接生成**）、`expander.py`（侧车 :8199）、`config.json`、`lora来源.json`。

## 0.0 机制变动（0.5.7 · 2026-10-21 晚）

- **侧车鉴权两道闸**：面板请求必须带 `X-Console-Client: 1`（自定义头 → 强制跨源预检，别的站点预检会被 ACAO 拒）；
  无 `Origin` 的脚本调用必须带 `X-Console-Token`（取自 `workDir\sidecar-token.txt` 或 `config.json` 的 `sidecarToken`）。
  `ACAO` 不再回 `*`，只回显白名单 Origin。`"requireToken": false` 仅调试用。
- **生成经验集中在 `plugin/docs/生成经验.md`（9 条）**：pinned-memory、`832×1216` 会画成两个人、决定视角的是姿势不是相机段、
  `/free` 空 body、端口守卫判据、编码补丁顺序、PNG `tEXt` 让文件 sha 与像素不一致、Origin 可伪造、打包白名单。
  **改生成参数或侧车前先读它**，代码里有 9 处注释指回编号。
- **打包用白名单**：`plugin/tools/build_suite.py` 只打 `package.json.files` + 套件根文档 + `LICENSE` + `skills/`，
  打后断言包内不得含 `sidecar-token.txt` / `config.json` / `lora来源.json`（真件）/ `*.pyc` / `*.bak*`。
  不要再 `Compress-Archive *`——0.5.3 曾因此把 43 字节真 token 打进包。
- **`LICENSE`（MIT 正文）随包分发**：`package.json` 写 MIT 之外，包根必须有正文。

## 0. 机制变动（2026-10-20 这轮）

- **导出入口统一**：两个编辑器各只剩一个按钮「导出全量卡包」，不再弹档位选择、不再问内嵌哪几支。角色卡固定全量（LoRA + 两支 LLLite 权重 + 5 张控制图，约 235 MB），风格卡固定 `baked`。
- **卡包容器升级**：header 增加 `version`（2 | 3），内嵌文件条目增加 `dest`（`lora` / `patch` / `asset`），asset 条目还带原 `asset` id；解包按 `dest` 分流到 `models/loras`、`models/model_patches`、`_cond/` + `assets.json`。
- **角色卡新增 `conditioning`（LLLite 身份控制）**：见第 5 节。
- **`/cards/write` 语义修正**：先按 `id` 匹配、再按 `name`，都没命中才追加；新卡落盘自动补 slug id；写入改成 tmp + `os.replace`；**只允许写 `cardsDir` 内的路径**。
- **侧车加固**：Origin 非本机一律 403；打包不再把权重读进内存；解包截断直接报错；`assets.json` 损坏时拒绝覆盖；sha 比较统一 lower；`COMFY_ROOT` 以 `config.json` 为准。
- **卡面精简**：角色卡与风格卡卡片上都不再显示「N 条 · 特征锁N · 负N · LoRA · LLLite」这类统计行，只留封面 / 卡名 / 提示词预览。统计仍在编辑器里看。
- **生成页**：新增「常用尺寸」预设行（9 组，点一下同时改宽高）。

## 1. 两种卡不是一回事

| | 角色卡 | 风格卡 |
|---|---|---|
| 存放 | **磁盘**：`config.json` 的 `cardsDir`（当前 `D:\dsh\本地绘画\角色卡`），侧车 `/cards` 扫描 | **浏览器 localStorage**，换机器/换浏览器不带，只能靠导出导入搬家 |
| 扫描规则 | 只扫该目录**根层、不递归、只认 `.json`、按 mtime 升序**，面板按 `name` upsert ⇒ **后读到的盖前读到的** | 面板内状态，按 `name` + 分类去重覆盖 |
| 回写 | 面板保存/改锁 → `/cards/write` 写回它来自的 `__file`（按 id 匹配那张） | 只落 localStorage |
| 归集目录 | `D:\dsh\本地绘画\角色卡\` | `D:\dsh\本地绘画\画风\` |

**同一目录里绝不要留两张同名卡**：会互相盖，表现为「锁丢了」「标签变少」。历史版挪进子目录（扫描不进子目录）。

## 2. 角色卡字段

```jsonc
{
  "id": "julin-lllite-v3", "name": "示例角色", "schemaVersion": 3,
  "tags": "julin, 1girl, solo, long black hair, …, small breasts, slim",
  "parts": { "trigger":[], "base":[], "hair":[], "eyes":[], "glasses":[], "outfit":[], "extra":[] },
  "neg": [ { "t": "adult, tall, dark skin" } ],       // 对象数组，n 是手写中文备注
  "lora": "char_lora.safetensors", "loraW": 0.9, "loraAlt": "",
  "cover": "", "note": "",
  "locks": [ { "name": "服饰特征锁", "tags": ["…"], "scope": "full" } ],
  "conditioning": { /* 见第 5 节 */ },
  "packMode": "baked", "embeddedLoras": ["char_lora"]
}
```

`parts` 决定「分解插入」按模块拼词；`tags` 是整卡插入的正向基准；`lora`/`loraW` 是角色 LoRA 与权重；`cover` 空串 = 无封面。落盘时 `_cards_write` 会跳过 `__` 开头字段与 `builtin`，`id` 以请求里的为准。

**v4 起新增三个可迁移字段**（都可选；`_cards_write` 是自由合并，后端不需要白名单）：

| 字段 | 形状 | 用途 |
|---|---|---|
| `baseModels` | `["anima-aesthetic-v1.1.safetensors"]` | 这张卡在哪个底模上调出来的。换机 / 换底模后据此判断"还能不能用" |
| `training` | `{"steps":3000,"rank":64,"datasetHash":"…","config":"…"}` | 训练记录。换机器后能照着重训，而不是只有一张成品卡 |
| `regression` | `{"seeds":[20261014,20261018],"framing":"portrait","samples":[]}` | 回归锚：固定 seed + 固定取景的样张。底模升级后跑一遍就知道有没有坏 |

校验端点：`POST /cards/validate`，body `{"card": {...}}` → `{ok, checked, presentBaseModels, missingBaseModels, notes[]}`。
`checked=false` 表示 ComfyUI 没起或没模型，**本次没有校底模**（`notes` 里会明说）。面板卡编辑页的「资产与迁移」区块就是这个端点的前端，改完点「校验底模与迁移信息」。

**为什么要有这三个字段**：卡原本只有"词 + LoRA + 特征锁"，能力全绑在当前这台机器上。换机器、换底模、底模出 v2，卡就变成不可判定的黑盒——不知道还能不能用、不知道怎么重建、不知道坏了没有。三个字段分别对应**依赖、来源、验收**。

**跑回归锚（0.5.1 起）**：同一个区块里的「跑回归锚」按钮，对 `regression.seeds` 逐个出图。

- 参数来源：**当前面板**（底模 / CLIP / VAE / LoRA / 尺寸 / 步数 / CFG / 采样器 / 调度器），只有 seed 取卡上的值
- 正向词：优先用面板当前正向词；面板为空才退回卡自己的 `tags`，并在消息里说明来源
- 执行：串行，一张出完再下一张，显示「回归中 2/3」，可点「停止」
- 结果：缩略图 + `seed ✓/✗` 直接列在区块下方；文件名 `<prefix>_reg_<卡id>_<seed>`
- 用法：判断"底模换了以后角色还成不成立"，就固定参数跑这批 seed，与原样张并排比
- 它只认自己提交的 `prompt_id`，中途你手动点生成也不会污染结果
- **风格卡同样适用**（0.5.2 起）：字段与角色卡同名，正向词回退走 `joinStyleParts`，文件名前缀 `_sreg_`；老风格卡只有 `ckpt` 时自动把 `ckpt` 当底模（`_styleBm`）

## 3. 特征锁 = 禁词锁

- **语义是「禁词」不是「必写词」**：锁里的词一旦出现在正向就剔掉并塞进负向（`applyTagLocks`）。锁里放「不许出现的词」，卡的正向基准**不能进锁**，否则自锁。
- **`scope` 三档**（`withOutfit ? ["full","both"] : ["swap","both"]`）：
  - `full`：只在**完整插入**时生效；
  - `swap`：只在**换装插入**那一刻生效；
  - `both`：两者都生效。
- **现役三锁**：示例角色特征锁（23 词，both）、服饰特征锁（97 词，full）、体型特征锁（18 词，both）。
- **裙长闸**（在服饰锁内，7 词）：`knee-length skirt, midi skirt, ankle length skirt, floor-length skirt, low hem, microskirt, micro mini skirt`。基准 = 短黑百褶裙、裙摆大腿中段；正向只写 `black skirt`；验收与基准图 `捏Ta-成稿-示例角色-站姿全身-1024x1496.png` 并排比。
- 113 词表是盯着用的既有资产：**只追加、不重写、不删原词**。

## 4. 两种插入

- **完整插入**：卡的正向 `tags` + `parts` 全上，服装按卡来，`full`/`both` 锁生效 → 标准示例角色。
- **换装插入**：只上角色部分，服装词自己写，`swap`/`both` 锁生效 → 换装不被服饰锁抢词（裙长闸此时不拦）。
- 两张卡的统计信息（条数/锁数/负向数/LoRA/LLLite）在**编辑器**里看，卡面不再显示。

## 5. 身份控制 conditioning（LLLite）

角色卡的 `conditioning` 与 `lora` 同构：选中卡即自动解析出「控制图 + 权重档 + 强度」，由图上的三个原生节点消费：

```
UNETLoader(anima-aesthetic-v1.1) → LoraLoader(角色 LoRA) → ModelPatchLoader(julin-lllite-v2/v3-400)
   → AnimaLLLiteApply(LoadImage 控制图) → LoraLoader(风格 LoRA) → KSampler
CLIPLoader(qwen_3_06b_base, type=qwen_image) + VAELoader(qwen_image_vae)
```

```jsonc
"conditioning": {
  "enabled": true,
  "default": "closeup",
  "presets": {
    "closeup": { "asset": "cond/face", "weights": "v2-400", "strength": 0.8,
                 "framing": "closeup", "preprocess": "none",
                 "promptAdd": "close-up, upper body", "negAdd": "",
                 "image": { "name": "face.png", "b64": "…", "sha256": "…", "w": 1024, "h": 1408 } }
  },
  "weights": { "v2-400": { "name": "julin-lllite-v2-400.safetensors", "sha256": "b2eb…", "bytes": 31457280 } }
}
```

- **磁盘侧**：控制图在 `cardsDir\_cond\*.png`，登记表 `_cond\assets.json`（key 形如 `cond/face`，含 `file`/`sha256`/`w`/`h`/`framing`）；权重在 `ComfyUI\models\model_patches\`，索引 `lllite-index.json`。
- **解析结果四态**：`resolved` 生效 / `degraded` 缺件（原因逐条写在 `reason`）/ `blocked` 校验失败（sha 不符）/ `off` 未启用。卡面与生成页显示的就是这些状态。
- **staging**：解析通过后侧车把控制图复制到 `ComfyUI\input\dsh_lllite\`、权重确认在 `model_patches`，返回给图的相对路径。（2026-10-20 修掉了 `shutil` 未导入导致 staging 恒失败的老 bug。）
- **比例自动纠偏**：画布比例与所选档控制图比例差超过 ±25% 时，自动挑最接近的一档并在提示里说明。
- 自包含 JSON 里带 `image.b64` 时，`POST /cards/import` 会把图落回 `_cond/` 并重建 `assets.json`（UI 上没有按钮，接口保留）。

## 6. 导出（现在只有一个按钮）

| 卡型 | 按钮 | 实际调用 | 内容 |
|---|---|---|---|
| 角色卡 | 导出全量卡包 | `exportCardPack([d], "role", "all")` | 角色 LoRA + 两支 LLLite 权重 + 5 张控制图全内嵌，约 235 MB，8 个内嵌条目、0 引用 |
| 风格卡 | 导出全量卡包 | `exportCardPack([d], "style", "baked")` | 风格 LoRA 及相关权重全内嵌 |

- 容器：`b"DSLCARD2\n"` + uint32 LE headerLen + header JSON + 顺序拼接的 blob；`format: dsh-stylecard/2`，`version` = 3（含 patch/asset 内嵌）或 2。
- header `files[]` 每项：`name` / `size` / `sha256` / `role`(`embed`|`ref`) / `dest`(`lora`|`patch`|`asset`) / `offset`（相对 header 之后第一字节）/（asset 还带 `asset` id 与 `preset`）。
- **三档只剩 API 语义**（`PACK_MODE_CN` 仍用于提示文案）：`baked` 全嵌、`hybrid` 只嵌 `local-derived`、`recipe` 纯名字+sha。要用这三档只能直接打 `/stylecards/pack`（`{card, cardType, mode, embed}`），元数据在响应头 `X-Card-Meta`。
- 导出件**不带 `__file`**（不外泄本机绝对路径）；内嵌键按「文件名去扩展名」规范化，带路径或 `.safetensors` 也能命中。
- `lora来源.json` 决定谁是 `local-derived`：`char_lora`、`style_lora_e10`、`artphoto_crossattn_only` 是本地派生；`nieta*`/`wclio*` 多为 `unknown`。

## 7. 导入

- 认 **`.json` / `.dslcard` / `.dslrecipe`**：先嗅前 9 字节 `DSLCARD2\n`，嗅不到再当 JSON 解析。
- 流程：`POST /stylecards/unpack`（或 `/cards/pack` 的对侧）→ 权重按 `sha256`/名字落 `models/loras`（同名同 sha 走 dedup）→ 卡按 `name` upsert（保留 `id` 与非空 `cover`）。
- **dest 路由**：`lora` → `models/loras`；`patch` → `models/model_patches`；`asset` → `_cond/` 且登记 `assets.json`（key 用包里的 `asset` id，缺失才退回文件名）。
- **失败会明说**：容器被截断 → `容器被截断：<name> 还缺 N 字节` 并删残件；`assets.json` 损坏 → 拒绝覆盖并报错；登记失败 → 进 `assetErrors`，不会假成功。
- **导入报告**（右下角）逐项列：写入、去重复用、按 sha 解析成功、缺件（带 `source.kind` 与有无下载地址）、sha 冲突、`baseMismatch`、被遮蔽的旧卡、落盘目录；带「自动下载缺件并重试（N 支有地址）」按钮。

## 8. 分发口径

1. **发 `.dslcard` 全量卡包**，不要发 `.json` 单卡、也不要发 `.dslrecipe`：自训 LoRA 在对方机器上无处可取。
2. 对方还需要：
   - **底模三件套**：`anima-aesthetic-v1.1.safetensors`（UNETLoader）、`qwen_3_06b_base.safetensors`（CLIPLoader, type=`qwen_image`）、`qwen_image_vae.safetensors`。容器只写 `baseModel` 元数据。
   - **同版本或更新的插件**：锁解释器、词典、`conditioning` 支持、面板 UI 全在 `client.js`；老版本能导入卡但**静默忽略 locks 与 conditioning**。
3. 风格卡只在 localStorage —— 让对方拿到的唯一途径就是导出卡包。

## 9. 坑表

| 现象 | 真因 | 处理 |
|---|---|---|
| 面板上锁变少/标签变少 | 同目录两张同名卡，后读的盖前读的 | 只留一张，历史版挪子目录 |
| 改名保存后盘上多出一张 | 老版 `_cards_write` 只按 name 匹配 | 已修：先按 id 匹配；确认卡里有 `id` |
| `/cards/write` 报 `path 不在角色卡目录内` | 侧车只允许写 `cardsDir` | 用面板保存，别手改 `path` |
| 从别的网页调 8199 返回 403 | Origin 白名单只放行本机（127.0.0.1 / localhost / [::1]） | 正常现象；本机页面与 curl（不带 Origin）不受影响 |
| 卡面统计行不见了 | 2026-10-20 按要求删除（角色卡与风格卡都删） | 统计在编辑器里看 |
| 卡导入成功但角色不像 | 自训 LoRA 没内嵌（发了 `.json`/`recipe`） | 重发全量卡包 |
| 锁写了却不生效 | ①老版插件不认 `locks`；②`scope` 选错 | 升级插件 / 改 scope |
| 强度档显示 degraded：权重文件不存在 | 权重没 staging 到 `models/model_patches` | 重新插入卡触发 resolve；检查 `COMFY_ROOT` 与 `lllite-index.json` |
| 档位显示 blocked：sha256 不匹配 | 控制图被换过或拿错文件 | 恢复原图或在编辑器重设该档 |
| 裙子越出越长 | 正向写了长度修饰词，或长度闸被挪出服饰锁 | 正向只写 `black skirt`，闸词留在服饰锁 |
| 改了 `app.js` 界面没变 | 浏览器只加载 `lib\client.js` | `python plugin\tools\build_client.py` 重建，刷新；仍不变就重启 `dsh web`（模块按进程缓存） |
| 侧车改动不生效 | `expander.py` 由 8199 那个 pythonw 进程加载 | 停 8199 的 PID 后重新拉起（见第 10 节） |

## 10. 验收与命令

```powershell
# 侧车实扫角色卡
Invoke-RestMethod http://127.0.0.1:8199/cards | ConvertTo-Json -Depth 4 -Compress

# 身份控制解析（把卡的 conditioning 与画布尺寸丢进去，看 resolved/degraded/blocked）
#   POST /lllite/resolve  {dir, card, framing, canvas:[1024,1408]}

# 重建浏览器包（四份源码 → client.js；改完 app.js 必做）
& D:\paint\venv312\Scripts\python.exe D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin\tools\build_client.py
& D:\paint\venv312\Scripts\python.exe D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin\tools\build_client.py --check   # 只比对

# 重启侧车
Get-NetTCPConnection -LocalPort 8199 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Process D:\paint\runtime\python312\pythonw.exe -ArgumentList 'expander.py','--port','8199' `
  -WorkingDirectory D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin -WindowStyle Hidden
```

- 硬验收 = 打包/解包往返：`POST /stylecards/pack`（元数据在 `X-Card-Meta`）→ `POST /stylecards/unpack`（二进制 body）→ 比对 `tags`/`parts`/`neg`/`note`/`locks`/`conditioning` 逐项相等，且 `_cond/assets.json` 的 key 与卡里 `presets[*].asset` 对得上。
- 改卡 JSON 一律 UTF-8 **无 BOM**，写完 `json.loads` 过一次。
- ComfyUI 8188、侧车 8199、DSH web 10722（根路径 401，不能直接取在线 bundle，只能读磁盘文件）。

## 11. 自训总览与工具链

三件套，各管一段，**不要混着练**：

| 件 | 训什么 | 现役产物 | 体积 | 挂载强度 |
|---|---|---|---|---|
| 角色 LoRA | 身份（脸/发/饰物）+ **比例** | `style_lora_v2.safetensors`（比例版 v2） | 87.6 MB | 0.7–0.8 |
| 画风 LoRA | 笔触/媒介/上色 | `style_lora_e10.safetensors` | 175.1 MB | 0.45–0.55 |
| LLLite | 构图/姿态/角度硬约束 | `julin-lllite-v2-400` / `v3-400.safetensors` | 29.6 MB | 条件乘数 1.0 |

旧件保留可回滚：`char_lora`（角色 v1，dim32）/ `style_lora_e10`（画风）/ `style_lora_v2`（角色 v2）。

**工具链**

```
训练器   D:\paint\sd-scripts\
           anima_train_network.py              角色/画风 LoRA
           anima_train_control_net_lllite.py   LLLite（28 模块 / 7,758,752 参数）
           networks\convert_anima_lora_to_comfy.py   ANIMA → ComfyUI 格式
解释器   D:\paint\venv312\Scripts\python.exe
启动器   D:\dsh\日志\示例画风重训\train.ps1   （参数化，见下）
底模     anima-base-v1.0（画风） / anima-aesthetic-v1.1（角色）
         + qwen_3_06b_base.safetensors（TE） + qwen_image_vae.safetensors
```

`train.ps1` 关键参数（默认值）：`-Ckpt/-Vae/-Qwen3`、`-DatasetConfig`、`-OutDir`（必填）、`-Name`、
`-Dim 32 -Alpha 16`、`-Reso 768`、`-Steps 1200 -SaveEvery 100 -SaveLast 400`、`-Lr 4e-5 -TeLr 2e-5`、
`-Seed 20261020`、`-GradAcc 2`、`-BucketMax 1024`、`-MinSnr 5 -NoiseOffset 0.03`、`-ResumeFrom`、`-Smoke`。

**四条硬规则**

1. `.ps1` 必须是**纯 ASCII**：无 BOM 的 ps1 在 PS 5.1 里按 GBK 解码，写中文必炸；中文路径一律走参数传入。
2. **clobber 断言**：输出文件已存在就拒跑，绝不覆盖旧权重（train.ps1 内建）。
3. **一台机器同时只允许一个训练器**：8 GB 卡上 3 个 CUDA 上下文会互抢（GPU 39%、日志停滞），ComfyUI 也要先停。
4. 开训前设 `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`（768 会碎片化）、`HF_HUB_OFFLINE=1`、`TRANSFORMERS_OFFLINE=1`。

**数据集 toml（sd-scripts 格式）**

```toml
[general]
enable_bucket = true
caption_extension = ".txt"
bucket_reso_steps = 64
min_bucket_reso = 512
max_bucket_reso = 1024

[[datasets]]
resolution = 1024
batch_size = 1
  [[datasets.subsets]]
  image_dir = "D:/datasets/角色-示例角色-比例版-2026-10-19"
  num_repeats = 4
  caption_dropout_rate = 0.05
```

LLLite 的子集多一行 `conditioning_data_dir = "<控制图目录>"`。`image_dir` 是**绝对路径**：目录被归档搬走后
toml 会静默指向空目录，所以开训前先 `Test-Path` 一下（`训练区\素材\` 现在就是空的，数据集实际在 `素材区\`）。

## 12. 从零训练角色 LoRA（照这个顺序做）

**1) 定一个比例基准图**。只能有一张，manual 的（`捏Ta-成稿-示例角色-站姿全身-1024x1496.png`：八头身、长腿、小头、细五官）。所有"比例对不对"的争论都回到它与它的并排图。

**2) 凑数据（23 张就够）**

| 来源 | 张数 | 作用 |
|---|---|---|
| 原角色集 | 12 | 身份基准（脸/黑长直/蓝眼/眼镜/枫叶发饰） |
| 生成的多机位全身 | 10 | 正/正开襟/三视图/侧/背/行走/叉手/侧持书/上半身 —— **纯白背景、无场景词**，只教比例与视角 |
| 人工标准图 | 1 | 比例唯一基准 |

**3) 打标只留三类词**：身份 + 服装 + 取景，全身图再追加比例锚点。**把场景与光效词全删**
（`indoors / corridor / window / night / starry sky / golden hour / soft lighting / depth of field`）——
画风就是靠场景光效偷渡进角色件的。

```
# 身份 + 服装（逐字固定）
julin, 1girl, solo, long black hair, blue eyes, glasses, maple leaf hair ornament,
beige trench coat, white shirt, blue necktie, black pleated skirt, above knee, white socks, black mary janes,
# 取景（逐图不同）
full body, feet visible
# 比例锚点（全身图必加）
correct proportions, eight heads tall, long legs, slender, long limbs, small head,
delicate facial features, elongated silhouette, detailed face
```

**4) 超参（比例版 v2 的实际值）**

| 项 | 值 |
|---|---|
| dim / alpha | **16 / 8**（上一版 32/32 太大，会把画风卷进来） |
| lr | **1e-5** constant + AdamW（上一版 5e-5 学细节过头） |
| 分辨率 / repeats | 1024 bucket（含 832×1216、1024×1496），repeats 4，dropout 0.05 |
| 正则化 | `noise_offset 0.05` + `min_snr_gamma 5`（上一版两项都没有） |
| 显存 | bf16 + gradient_checkpointing + cache_latents + TE 输出缓存 + sdpa ⇒ **6.2 s/步** |
| 步数 | 10 epoch 计划 = 920 步（23×4×10，92 步/epoch）；**实际取 epoch 6（552 步）** |

**5) 判"比例进没进权重"**：把提示词里所有比例词删干净再出图（E5），与旧权重同条件对照（E6）。E5 比例仍成立 = 成功；E6 会头大腿短。**这一步过不了，重训。**

**6) 取件 + 转格式 + 挂卡**

```powershell
$env:PYTHONPATH='D:\paint\sd-scripts'
& D:\paint\venv312\Scripts\python.exe D:\paint\sd-scripts\networks\convert_anima_lora_to_comfy.py `
    <out>\julin-proportion-v2-000006.safetensors D:\paint\ComfyUI\models\loras\style_lora_v2.safetensors
```

转完**重启 ComfyUI**（启动时扫 loras 并缓存），卡里 `lora` 字段写文件名**带 `.safetensors`**。

**7) 已知边界**（写进卡的备注，别当 bug）：白袜+玛丽珍被绑进身份（要换鞋得正向写替代或在服饰锁追加）；
领带夹、袜子褶边这类 1/23 占比的小饰物学不到；极端角度（仰拍/侧转/遮挡）脸会漂——23 张里侧脸只有 3 张。

## 13. 从零训练画风 LoRA

**1) 先接受一个事实**：训练集会决定画风件"顺带学会什么"。19 张里 15 张是近景、caption 只有 4/19 写了取景 ⇒
模型把"近景"并进了触发词，**任何强度（0.30–0.80）、任何 epoch（哪怕 95 步）都强制出特写**。
补上统一取景轴（`close-up / portrait / upper body / full body, wide shot / extreme close-up, face`）+ 512→768 后修好。
**新数据集第一件事就是查取景分布与长宽比分布。**

**2) 打标骨架**：`<触发词>, <恒定媒介轴>, <取景轴>, <内容>`

```
wcoil, watercolor painting, oil painting, traditional media, visible brush strokes,
paper texture, colored shadows, transparent glazes, luminous colors
```

风格件**不写角色身份词、不写服装词**（否则画风把裙子款式一起接管）；触发词打头，`keep_tokens=1`。
词表收敛到 25–35 个（97 词/36 图时 41% 的词只出现 1 次，等于没学）。

**3) 配方（当前 `train.ps1` 口径，画风件）**

| 项 | 值 |
|---|---|
| dim / alpha | 32 / 16（老件是 32/32） |
| lr / TE lr | 4e-5 / 2e-5，`cosine_with_restarts` 1 cycle，warmup 80 |
| 优化 | AdamW + `--network_train_unet_only`，fp16，grad accum 2 |
| 分辨率 | 768 或 1024，bucket 512–1024 / 步长 64 |
| 正则 | `noise_offset 0.03` + `min_snr_gamma 5` + `keep_tokens 1` |
| 步数 | 1200 步起，每 100 存，`save_last_n_steps 400` |
| 缓存 | `cache_latents_to_disk` + `cache_text_encoder_outputs(_to_disk)` |

历史版本对照（同一套素材，逐版只改一处）：

| 版本 | 图数×repeats | 步数 | 判定 |
|---|---|---|---|
| wcoil768 (v1) | 19×3 | 570 | ✗ 近景劫持、发丝玻璃感 |
| wcoil3 | 22×3（人眼剪枝） | 660（实际 594） | ✗ 强于 v1，但纸纹/干笔仍零 |
| wcoil4 | 22×3（裸审美底模自生成） | ~600 | ✓ 剂量 0.7 平衡 / 1.0 拉满 |
| nieta768 | 19×3 | 570 | ✓ 但底模是 base-v1.0，与现役 ckpt 不同线，≤0.3 |
| style_lora_e10（现役） | 12×3 | 360（34 min，峰值 7.75 GB，avr_loss 0.131） | ✓ 挂 0.5 |

**4) 剂量**：0.45–0.55 是甜区；0.7 开始吃掉构图与身材；1.0 过驱动（RMS 偏离单调上升）。**1.0 不是"更强"，是"失真"。**

## 14. 从零训练 LLLite 身份控制

**1) 成对数据**：`image_xxx.png`（目标图）+ `control_xxx.png`（条件图，**与目标图同尺寸、同文件名**）。
条件图做法固定：取该姿态的**基线稿**做 Canny（阈值 0.08 / 0.22），得到细线条稿。 tomben 之外不要换条件类型。

**2) toml 用 `conditioning_data_dir` 指向控制图目录**，repeats 按"哪类图更容易崩"给权重：

```toml
[[datasets.subsets]]
image_dir = ".../image_full"
conditioning_data_dir = ".../control_full"
num_repeats = 5

[[datasets.subsets]]
image_dir = ".../image_close"
conditioning_data_dir = ".../control_close"
num_repeats = 14          # 特写是崩得最厉害的一档，重复给足
```

**3) 训练**：`anima_train_control_net_lllite.py` + 上述 toml，`timestep_sampling=sigmoid`、
`discrete_flow_shift=3.1`，**400 步**、每 100 步存、末尾存 `last`；实测 **3.9 s/步 / 26 分 / avr_loss 0.078**，
产物 29.6 MB。图像次（图×repeats）：v2 37×6=222、v3 48×6=288。

**4) 出图固定档**（换权重也要守住）：条件乘数 **1.0**、身份卡 0.9、28 步、CFG 3.8、flow shift 3.1。
把乘数拉到 1.3 / 1.6 想让姿态更"听话"，结果是线稿以**浅灰描边渗进画面**，1.6 更严重 ⇒ **不要靠拉高乘数救姿态**。

**5) 补数据的正确姿势**：补的是**崩掉的场景**，不是"更多图"。闭眼/微笑特写原来会崩成**角色表（多格拼图）**，
补 14 格切片 + 400 步重训后变成干净单张；严格侧身全身反而旧 23 图权重更稳 ⇒ **两版权重并存，按场景选**。

**6) 切图法**（LoRA 自带角色表倾向时）：负向加 `character sheet, multiple views, collage` 常常压不住，
改用 `scipy.ndimage` 连通域切分 + 留白裁边 + 短边不足 768 用 LANCZOS 放大，再人工挑格。

## 15. 评测与取件（三件套共用）

- **口径固定**：同 seed（20261014 / 20261018）、同提示词、同分辨率、同步数 CFG，**带与不带触发词各一组**，
  **必须有一组"零 LoRA 底图"对照**——没有零对照的结论一律不成立（曾因此误判"julinst 自带角色身份"，后作废）。
- **强度扫描**：0.3 / 0.5 / 0.7 + 目标档；epoch 取 2–3 个候选（e2/e5/e10）同场比。
- **拼图看完整画幅**（`make-lora-sheet*.py`），不要裁切后再比——裁切会掩盖取景漂移。
- **尺子只做必要条件的筛**：`style_check.py` 量 RMS 与六轴 z（高光占比/暗部色温/主色相集中/线条锐度/明度基调/深色占比），
  参考集自检 RMS=0.00；**它量不出构图与媒介**——已连续三次出现"尺子全过、肉眼崩"。**结论必须看图。**
- **取件顺序**：选存档 → convert 成 ComfyUI 格式 → 放 `models\loras` → **重启 ComfyUI** → 卡里改 `lora`/`loraW` → 卡内锁一起复验（比例锚点 + 裙长闸）。

## 16. 训练坑表

| 现象 | 真因 | 处理 |
|---|---|---|
| 步速算出 57–80 s/步 | 只取了前 2 步（内核编译/优化器首次分配/建缓存） | 看第 30 步之后，稳态才是 1.4（512）/ 4.2（768）/ 3.9（LLLite） |
| GPU 只有 39%、日志停滞 | 多个训练器 + ComfyUI 抢同一张 8 GB 卡 | 一次只跑一个训练器，先停 ComfyUI |
| 脚本里"停掉 ComfyUI"没生效 | `$pid`/`$PID` 是 PS 只读自动变量，`foreach ($pid in ...)` 静默不执行 | 循环变量改名（`$owner`），停完用 `Get-NetTCPConnection` 复核 |
| 后台启动的训练进程半路没了 | `Start-Process -RedirectStandardOutput` 的子进程活不过父进程；作业结束整树回收 | 长任务放普通调用里脱离启动，或让调用本身即任务 |
| 日志几分钟不动，以为挂了 | 重定向到文件的 tqdm 分块刷盘 | 判活看三者：作业状态 + 进程资源 + 产物落盘 |
| ComfyUI 报 `value_not_in_list` | 启动后才放进 `models\loras` 的 LoRA 不被识别（启动时扫描缓存） | 重启 ComfyUI；`lora_name` 带 `.safetensors` |
| `convert_anima_lora_to_comfy.py` 报 `library` 找不到 | 脚本要在仓库根目录、`library` 在 `sys.path` | `$env:PYTHONPATH='D:\paint\sd-scripts'` 再跑 |
| exit=1 但训练其实成功了 | PS 把 tqdm 的 stderr 当 `NativeCommandError` | 看产物与 `avr_loss`，别只看退出码；用 `Tee-Object` 收日志 |
| toml 跑起来 0 张图 | `image_dir` 是绝对路径，目录被归档搬走 | 开训前 `Test-Path`；数据集现在放 `D:\dsh\素材区\` |
| 画风件一挂就变特写 | 训练集取景偏斜 + caption 没标取景 | 补统一取景轴 + 提高分辨率重训（v1→v2 的修法） |
| 画风件把裙子款式一起换掉 | 风格 caption 写了服装/身份词 | 风格件只写媒介与画风，服装词归角色件 |
| 自训学不会某种媒介（纸纹/干笔） | 底模缺该先验，不是步数不够 | 换有先验的底模或叠参考件；别加步数硬怼 |
| LLLite 姿态不听话，乘数拉高后画面有灰描边 | 条件线稿渗进输出 | 乘数守 1.0，用补数据/换权重解决 |
| `booru` 标签按名字抓回来的素材媒介不对 | 标签命中 ≠ 媒介正确（实测噪声约 51%） | 人眼过一道；确认真标签名（`watercolor_(medium)` 而非 `watercolor`） |
| 训练脚本里中文路径失效 | 无 BOM 的 `.ps1` 在 PS 5.1 按 GBK 解码 | ps1 纯 ASCII，中文路径走命令行参数 |

## 17. 进阶：画风剥离与秩拼接（把"画风"从角色件里切走）

LoRA 的 840 张量按模块可分三段，用途不同：

| 段 | 张量数 | 管什么 |
|---|---|---|
| `cross_attn` | 336（112 模块） | 身份、发型、服装绑定（文字 token ↔ 图像） |
| `self_attn` | 336 | 空间一致性、笔触、纹理 |
| `mlp` | 168 | 颜色细节 |

- **合并用秩拼接，不要权重相加**：`A = [A_style; A_char]`、`B = [B_style | λ·B_char]`、`alpha = 64`，
  效果严格等于两者叠加（`blocks.0.self_attn.q_proj` 偏差 1.75e-10）。
- 产物分档：`纯绑定 336（49 MB）` / `绑定+细节 504（119 MB）` / `self only 336（56 MB）` / `接管版 840（231 MB）`。
- **硬证据**：只用纯绑定（cross_attn）时画面平涂到底、几乎无笔触 ⇒ 画风确实被剥净；代价是布纹/金属反光一起丢。
- 231 MB 的混合 rank 在部分 loader 会报警；老环境优先用 336/504 两档。

