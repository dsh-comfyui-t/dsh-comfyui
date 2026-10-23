---
name: "comfyui-cards"
description: "dsh-comfyui-console 插件里角色卡与风格卡的完整机制与自训流程：两种卡存哪、字段（含 conditioning 身份控制）、特征锁与 scope、完整/换装插入、全量卡包导出与三档 API 语义、导入与 dest 路由、缺件下载、分发口径；以及从零训练角色 LoRA / 画风 LoRA / LLLite 身份控制的数据配比、打标口径、超参、评测取件、坑表与画风剥离。另有词库小卡片（胶囊词条）：卡片网格、分类与「全部」、胶囊中文备注、胶囊词性（正/负/自）与按词性插入、拖拽排序与换分类、`dsh-dict-cards` JSON 导入导出。用户提到角色卡、风格卡、特征锁、插入、导出卡、导入卡、.dslcard、.dslrecipe、卡包、LoRA 内嵌、LLLite 身份控制、训练 LoRA、数据集打标、caption、重训、画风剥离、facetraining、词库、词条、小卡片、胶囊、正负词性、拖拽排序、词库导出时才加载。"
whenToUse: "要新建/修改/导入/导出/分发角色卡或风格卡；要调特征锁与 scope；要配或排查 LLLite 身份控制；要从零训练或重训角色 LoRA、画风 LoRA、LLLite，要准备数据集与打标、定超参、评测挑选存档、做画风剥离；要判断某次改动是否需要重建 client.js 或重启侧车；要核对卡包往返与验收命令时；要改词库小卡片（胶囊词性、拖拽、导入导出）或排查 `xxx is not defined` 时。"
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

**正文命令块里的写法约定**（2026-10-22 按使用报告补）：为了不把占位符塞进每个代码块，命令块里保留作者机器的真实路径，读的时候按下表替换——
**但叙述与判断一律用占位符**，两者不要混：

| 占位符 | 指什么 | 作者机器实测值 |
|---|---|---|
| `$DSH_HOME` | DSH 主目录（插件、技能、profile） | `D:\dshl\.dsh` |
| `$WORKSPACE` | 会话工作区（卡、数据集、脚本、日志、交付区） | `D:\dsh` |
| `$COMFY_ROOT` | ComfyUI 根（`main.py` 所在层） | `D:\paint` |
| `$PYTHON` | 装了 sd-scripts 依赖的 Python | `D:\paint\venv312\Scripts\python.exe` |
| `$PYTHONW` | 侧车用的无控制台 Python | `D:\paint\runtime\python312\pythonw.exe` |

**注意 `D:\dsh` 与 `D:\dshl\.dsh` 只差一个字母**，含义完全不同（工作区 vs DSH 主目录）。照文档排查时先确认自己在哪个根下。

**探路命令：动手前先跑这个，五个关键路径全 True 才继续**

```powershell
$DSH_HOME  = 'D:\dshl\.dsh'
$WORKSPACE = 'D:\dsh'
$COMFY_ROOT= 'D:\paint'
$PYTHON    = 'D:\paint\venv312\Scripts\python.exe'
$PYTHONW   = 'D:\paint\runtime\python312\pythonw.exe'
@(
  @{p = "$COMFY_ROOT\ComfyUI\main.py";                                  what = 'ComfyUI 主程序' },
  @{p = "$COMFY_ROOT\ComfyUI\custom_nodes";                             what = '自定义节点目录' },
  @{p = "$COMFY_ROOT\ComfyUI\comfy_extras\nodes_model_patch.py";       what = 'AnimaLLLiteApply 节点（ComfyUI 核心，0.39.0 起）' },
  @{p = "$COMFY_ROOT\sd-scripts\anima_train_network.py";                what = '角色/画风 LoRA 训练器（sd-scripts）' },
  @{p = "$PYTHON";                                                        what = '训练用 Python' },
  @{p = "$PYTHONW";                                                       what = '侧车 Python' },
  @{p = "$DSH_HOME\plugins\dsh-comfyui-console\plugin\expander.py";   what = '插件侧车' }
) | ForEach-Object { "{0,-58} {1,-8} {2}" -f $_.p, (Test-Path $_.p), $_.what }
```

约定：卡与数据集永远是**用户数据**，不放在插件目录里；插件升级不碰它们。

# 角色卡 / 风格卡 机制与用法（dsh-comfyui-console）

插件目录 `D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin\`：
`lib\app.js`（源码，界面主体）、`lib\dict.js`、`lib\presets.js`、`lib\workflow.js`、
`lib\client.js`（**浏览器只加载这个，由上面四份拼接生成**）、`expander.py`（侧车 :8199）、`config.json`、`lora来源.json`。

## 0. 机制变动（2026-10-20 这轮）

- **导出入口统一**：两个编辑器各只剩一个按钮「导出全量卡包」，不再弹档位选择、不再问内嵌哪几支。角色卡固定全量（LoRA + 两支 LLLite 权重 + 5 张控制图，约 235 MB），风格卡固定 `baked`。
- **卡包容器升级**：header 增加 `version`（2 | 3），内嵌文件条目增加 `dest`（`lora` / `patch` / `asset`），asset 条目还带原 `asset` id；解包按 `dest` 分流到 `models/loras`、`models/model_patches`、`_cond/` + `assets.json`。
- **角色卡新增 `conditioning`（LLLite 身份控制）**：见第 5 节。
- **`/cards/write` 语义修正**：先按 `id` 匹配、再按 `name`，都没命中才追加；新卡落盘自动补 slug id；写入改成 tmp + `os.replace`；**只允许写 `cardsDir` 内的路径**。
- **侧车加固**：Origin 非本机一律 403；打包不再把权重读进内存；解包截断直接报错；`assets.json` 损坏时拒绝覆盖；sha 比较统一 lower；`COMFY_ROOT` 以 `config.json` 为准。
- **卡面精简**：角色卡与风格卡卡片上都不再显示「N 条 · 特征锁N · 负N · LoRA · LLLite」这类统计行，只留封面 / 卡名 / 提示词预览。统计仍在编辑器里看。
- **生成页**：新增「常用尺寸」预设行（9 组，点一下同时改宽高）。

## 0.1 机制变动（2026-10-21 / 22 这轮：词库小卡片）

- **词条改叫「小卡片」**，固定在「词库」页，一个网格铺开；新增固定分类 `全部`（跨分类汇总，不能改名/删除/隐藏）。
- **词性从卡片搬到胶囊上**：`USER.pol`（卡片级）已废弃、代码不再读；新键 `USER.capPol[小写英文标签] = "pos" | "neg"`，没记＝未标（按正向）。插入时按每颗胶囊的词性分流。
- **拖拽**：同分类拖动改顺序（`USER.order[分类]`），拖到分类 chip 换分类（自建卡真搬，内置卡转自建 + 原分类 `hidden`）。
- **胶囊备注**：`USER.capNote[标签]`，卡片上显示中文备注，没有才退回词库中文名。
- **导入导出**：`dsh-dict-cards` v1 JSON，顶层 `notes` + `tagPol`；老包的 `cards[].polarity` 导入时摊到该卡每颗胶囊。
- **组件拆文件**：编辑弹层与输入行搬到 `lib/dictcard.js`（第五个拼接段），构建脚本 `SOURCES` 变成 `('dict','presets','workflow','dictcard','app')`。
- 词库改动的**唯一**生效路径：改源码 → `build_client.py` → 刷新页面（`lib/dict.js` 一行没动，用户增量只进 `USER.frags`）。

## 1. 两种卡不是一回事

| | 角色卡 | 风格卡 |
|---|---|---|
| 存放 | **磁盘为底稿**：`config.json` 的 `cardsDir`（当前 `D:\dsh\本地绘画\角色卡`），侧车 `/cards` 扫描；**0.7.47 起前端启动会拉一次并打 `fromDisk` 标记**（旧版只读 localStorage，见下） | **浏览器 localStorage**，换机器/换浏览器不带，只能靠导出导入搬家 |
| 扫描规则 | 只扫该目录**根层、不递归、只认 `.json`、按 mtime 升序**，面板按 `name` upsert ⇒ **后读到的盖前读到的** | 面板内状态，按 `name` + 分类去重覆盖 |
| 回写 | 面板保存/改锁 → `/cards/write` 写回它来自的 `__file`（按 id 匹配那张） | 只落 localStorage |
| 归集目录 | `D:\dsh\本地绘画\角色卡\` | `D:\dsh\本地绘画\画风\` |

**同一目录里绝不要留两张同名卡**：会互相盖，表现为「锁丢了」「标签变少」。历史版挪进子目录（扫描不进子目录）。

### 1.1 角色卡的存储：版本行为差（0.7.46 → 0.7.47 变了，2026-10-22）

| 版本 | 前端从 `/cards` 读磁盘吗 | 磁盘上放卡的效果 | 导入入口 |
|---|---|---|---|
| **0.7.46 及更早** | **不读**（`allCards()` 只遍历 `USER.cards`，全文件对 `/cards` 只有 write / validate / import 三处调用） | **没有效果**：卡不会出现在面板里 | 只能靠界面「导入」；桌面版（Electron）里文件对话框与拖拽实测都不生效 → **等于死路** |
| **0.7.47 起** | 面板挂载后自动拉一次 `/cards`，失败或为空重试 6 次（间隔 2.5 s） | 卡片自动进面板，提示「磁盘同步（目录）：N 张 · 新增 a · 更新 b · 保护跳过 c · 移除 d」 | 三条：文件对话框（overlay 修好）、**粘贴 JSON**（不依赖任何文件 API）、**重扫磁盘**按钮 |

**合并口径（0.7.47）**：磁盘卡带 `fromDisk: true` + `file`，同一张以磁盘为准；**界面手工建/手工导入的卡（无 `fromDisk`）同名时不覆盖**，只计入「保护跳过」；磁盘文件删掉 → 对应的 `fromDisk` 卡从面板移除。手动入口在角色卡工具栏「重扫磁盘」。

排查口诀：**卡不出现 → 先看 `GET /cards` 的 count，再看提示条的「磁盘同步」那行**，不要先怀疑缓存。

## 2. 角色卡字段

```jsonc
{
  "id": "julin-lllite-v3", "name": "絉林", "schemaVersion": 3,
  "tags": "julin, 1girl, solo, long black hair, …, small breasts, slim",
  "parts": { "trigger":[], "base":[], "hair":[], "eyes":[], "glasses":[], "outfit":[], "extra":[] },
  "neg": [ { "t": "adult, tall, dark skin" } ],       // 对象数组，n 是手写中文备注
  "lora": "julin_comfyui.safetensors", "loraW": 0.9, "loraAlt": "",
  "cover": "", "note": "",
  "locks": [ { "name": "服饰特征锁", "tags": ["…"], "scope": "full" } ],
  "conditioning": { /* 见第 5 节 */ },
  "packMode": "baked", "embeddedLoras": ["julin_comfyui"]
}
```

`parts` 决定「分解插入」按模块拼词；`tags` 是整卡插入的正向基准；`lora`/`loraW` 是角色 LoRA 与权重；`cover` 空串 = 无封面。落盘时 `_cards_write` 会跳过 `__` 开头字段与 `builtin`，`id` 以请求里的为准。

## 3. 特征锁 = 禁词锁

- **语义是「禁词」不是「必写词」**：锁里的词一旦出现在正向就剔掉并塞进负向（`applyTagLocks`）。锁里放「不许出现的词」，卡的正向基准**不能进锁**，否则自锁。
- **`scope` 三档**（`withOutfit ? ["full","both"] : ["swap","both"]`）：
  - `full`：只在**完整插入**时生效；
  - `swap`：只在**换装插入**那一刻生效；
  - `both`：两者都生效。
- **现役三锁**：絉林特征锁（23 词，both）、服饰特征锁（97 词，full）、体型特征锁（18 词，both）。
- **裙长闸**（在服饰锁内，7 词）：`knee-length skirt, midi skirt, ankle length skirt, floor-length skirt, low hem, microskirt, micro mini skirt`。基准 = 短黑百褶裙、裙摆大腿中段；正向只写 `black skirt`；验收与基准图 `捏Ta-成稿-絉林-站姿全身-1024x1496.png` 并排比。
- 113 词表是盯着用的既有资产：**只追加、不重写、不删原词**。

## 4. 两种插入

- **完整插入**：卡的正向 `tags` + `parts` 全上，服装按卡来，`full`/`both` 锁生效 → 标准絉林。
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
- `lora来源.json` 决定谁是 `local-derived`：`julin_comfyui`、`julinst-e10`、`artphoto_crossattn_only` 是本地派生；`nieta*`/`wclio*` 多为 `unknown`。

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
| 装完插件起不来，日志里只有 `ModuleNotFoundError: No module named 'sidecar_xxx'`，界面只显示「离线」 | `package.json` 的 `files` 白名单是手写的，新增 `.py` 没列进去 → 打包静默丢掉；`update.ps1` 的替换清单同样手写 → 还会出现「版本号刷了、文件是旧的」这种最难查的状态 | 0.7.82 起 `build_suite.py` 打包前扫 `plugin/*.py` 的本地 import（`sidecar_*` 一律算本地依赖），缺一个就 `[FAIL] 本地模块被 import 但没进白名单`；`check_contract.py` 同款两项 `files:local-module-exists` / `files:local-imports`；0.7.83 起 `update.ps1` 改成**按源目录全量同步**（只保护 `config.json` / `routes.json` / `sidecar-token.txt` / `work/`），复制完再跑 import 覆盖检查，缺模块直接 `[FAIL] missing local modules after update` |
| 补完文件重启后 `work/sidecar.err.log` 里还留着老 traceback，看着像没修好 | 该日志是追加写（`openSync(..., 'a')`），历史错误从不清 | 0.7.83 起：`index.js` 拉起前把超过 2 MB 的 `sidecar.err.log` 滚成 `.1` 并写一行 `---------- sidecar start <ISO> ----------`；`expander.py` 起来后补一行 `---------- started OK <时间> pid=<pid> port=<端口> v<版本> ----------`，看最后一段即为本次运行 |
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
| 词库卡片一渲染就 `capNoteOf is not defined` | 助手写在 `app.js` 顶格，但实际落在 `genTab` 的嵌套作用域（该文件从 `condForSave` 起有一层历史错层），模块级的 `dictcard.js` 看不见 | 把用到的符号提到模块级（`allLib()` 之后）；跑 `日志\probe-client-scope.js` 验证 |
| 新建卡报 `dictCardTargetCat is not defined` | 同上，`PR_HOME_CAT` + `dictCardTargetCat` 一起在嵌套作用域 | 两个一起提到模块级 |
| 拖拽调好的顺序换机器就没了 | 顺序只在 `USER.order[分类]`（localStorage），导出 JSON 不含它 | 关键顺序靠分类拆分；要带走就重排一次 |
| 导入别人的词库包后词性没了 | 老包只有 `cards[].polarity`；`tagPol` 是 0.7.44+ 才有的字段 | 用新版导出的包（导入仍兼容老包） |
| 磁盘上放了角色卡，界面里没有 | **0.7.46 及更早前端根本不读 `/cards`**（只有 write/validate/import 三处调用） | 升 0.7.47+，或点「重扫磁盘」；不要按「缓存问题」去重启 |
| 点「导入」没反应、拖 .json 也没反应（Electron / 桌面版） | `display:none` 的 `<input type=file>` 走 label 代理失效；拖拽拿不到 `dataTransfer.files`（主进程没转发） | 0.7.47 起 input 改成透明 overlay 覆盖按钮，并加了「粘贴 JSON」兜底；导入失败会有「收到文件：…」提示 |
| 按技能 §11 找不到 `anima_train_network.py` 等训练脚本 | 技能旧版没写脚本出处（只写了作者机器路径） | 见 §11「获取方式」：全部来自 kohya-ss/sd-scripts 上游，`git clone` 后即得 |
| 按技能找 `train.ps1` / `style_check.py` / `make-lora-sheet*.py` 找不到 | 这些是作者本地脚本，旧版没随技能分发（2026-10-22 报告问题 1 的同类） | 0.7.47 起随技能放在 `$DSH_HOME\skills\comfyui-cards\scripts\`（`scripts\README.md` 给换机命令） |
| `train.ps1` 一跑就 `required file missing: D:\paint\...` | 参数默认值指向作者机器 | 显式传 `-Ckpt -Vae -Qwen3 -VPy -Trainer`（README 有整段示例） |

## 10. 验收与命令

```powershell
# ⚠ 本块路径是作者机器示例：按 §0 的表换成你的 $PYTHON / $PYTHONW / $DSH_HOME / $COMFY_ROOT
# 侧车实扫角色卡
Invoke-RestMethod http://127.0.0.1:8199/cards | ConvertTo-Json -Depth 4 -Compress

# 身份控制解析（把卡的 conditioning 与画布尺寸丢进去，看 resolved/degraded/blocked）
#   POST /lllite/resolve  {dir, card, framing, canvas:[1024,1408]}

# 重建浏览器包（五份源码 dict/presets/workflow/dictcard/app → client.js；改完任一源码必做）
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
| 角色 LoRA | 身份（脸/发/饰物）+ **比例** | `julst2-v2.safetensors`（比例版 v2） | 87.6 MB | 0.7–0.8 |
| 画风 LoRA | 笔触/媒介/上色 | `julinst-e10.safetensors` | 175.1 MB | 0.45–0.55 |
| LLLite | 构图/姿态/角度硬约束 | `julin-lllite-v2-400` / `v3-400.safetensors` | 29.6 MB | 条件乘数 1.0 |

旧件保留可回滚：`julin_comfyui`（角色 v1，dim32）/ `julinst-e10`（画风）/ `julst2-v2`（角色 v2）。

**工具链**

```
训练器   D:\paint\sd-scripts\
           anima_train_network.py              角色/画风 LoRA
           anima_train_control_net_lllite.py   LLLite（28 模块 / 7,758,752 参数）
           networks\convert_anima_lora_to_comfy.py   ANIMA → ComfyUI 格式
解释器   D:\paint\venv312\Scripts\python.exe
启动器   $DSH_HOME\skills\comfyui-cards\scripts\train.ps1   （随技能分发，参数化，见下）
底模     anima-base-v1.0（画风） / anima-aesthetic-v1.1（角色）
         + qwen_3_06b_base.safetensors（TE） + qwen_image_vae.safetensors
```

**获取方式（2026-10-22 实测核对，别再猜脚本从哪来）**

| 件 | 从哪来 | 实测核对 |
|---|---|---|
| sd-scripts 整仓 | `git clone https://github.com/kohya-ss/sd-scripts`（默认分支 **`main`**；2026-10-20 头 `11d8cedd0c`） | 作者机器上**没有 `.git`**（是拷贝），所以无法 `git pull`，只能重新下 |
| `anima_train_network.py` | 上游根目录 | 本机 20,957 B / sha `1a238aa1…`；上游 `main` 21,422 B / sha `1c525f70…` → **本机是较早的上游快照**，差的 465 B 是上游后加的 `BlockSwapConfig` 重构（`model.enable_block_swap(args.blocks_to_swap, accelerator.device)` → `model.enable_block_swap(args.blocks_to_swap, swap_config)`）。用哪版都能训；要 `blocks_to_swap` 的新选项就换上游新版 |
| `anima_train_control_net_lllite.py` | 上游根目录 | **与上游 `main` 逐字节一致**（42,514 B / sha `87787221…`） |
| `networks\convert_anima_lora_to_comfy.py` | 上游 `networks/` | **与上游 `main` 逐字节一致**（7,638 B / sha `a8d06edf…`） |
| 依赖库 `library\anima_models.py`、`anima_utils.py`、`anima_train_utils.py`、`strategy_anima.py`、`networks\lora_anima.py`、`networks\control_net_lllite_anima.py` | 全在上游同一个仓里 | 缺任何一个都会 `ImportError`，别只拷三个脚本 |
| 训练用 Python | 自建 venv + `pip install -r requirements.txt`（sd-scripts 仓内），再装与本机 CUDA/ROCm 匹配的 torch | 作者机器 `$PYTHON`（3.12）；AMD 卡见下 |
| `AnimaLLLiteApply` 节点 | **ComfyUI 核心自带**，不是第三方插件：`comfy_extras/nodes_model_patch.py` + `comfy/ldm/anima/lllite.py` | 本机 ComfyUI **0.39.0**；上游 `main` 同文件里也有（55,040 B）。ComfyUI 太旧就换新版，找不到这个节点时先查版本 |

- **Anima 支持的出处**：kohya-ss/sd-scripts 的 Anima 分支由社区 PR [#2260](https://github.com/kohya-ss/sd-scripts/pull/2260) 合入，模型方 [circlestone-labs/Anima](https://huggingface.co/circlestone-labs/Anima) 的讨论区也确认「训练脚本已在 sd-scripts 实现」，官方文档 `docs/anima_train_network.md`。**不存在私有魔改版**，不需要向作者要脚本。
- **AMD / ROCm 机器**：sd-scripts 与 Anima 反量化路径都假设 CUDA；ROCm 上要先 `pip install --index-url https://download.pytorch.org/whl/rocm6.x torch`，并把 `tools/` 里的 `bitsandbytes`（Anima 量化用）换成 ROCm 可用的分支，否则会在 `init_ipex()` 或反量化处报错。这条没在 AMD 卡上实测过——按上游 issue 的说法走，别把 CUDA 的坑表照抄。
- **自检一行**：`& $PYTHON -c "import sys; print(sys.version)"` 能过、`& $PYTHON anima_train_network.py --help` 能打出参数，就说明脚本与依赖都到位了。

**随技能分发的脚本（不用再找作者要）**

`$DSH_HOME\skills\comfyui-cards\scripts\` 下已经放好技能正文引用的全部工具，`scripts\README.md` 有换机第一次的完整命令：

| 文件 | 字节 | sha256 前 12 | 说明 |
|---|---|---|---|
| `train.ps1` | 6,833 | `487bda616421` | 参数化启动器；纯 ASCII 无 BOM；默认值指向作者机器，换机必显式传 `-Ckpt -Vae -Qwen3 -VPy -Trainer`，缺一个就在开跑前 `Fail` 报 `required file missing` |
| `dataset-character.toml` | 334 | — | 角色 / 画风数据集模板（改 `image_dir` 即用） |
| `dataset-lllite.toml` | 378 | — | LLLite 模板（`image_dir` + `conditioning_data_dir` 成对） |
| `make-lora-sheet.py` | 656 | `f45da6f5cff7` | 对比带拼图（裁切版） |
| `make-lora-sheet-full.py` | 669 | `40281c503d71` | 对比带拼图（整幅，看取景漂移） |
| `style_check.py` | 7,243 | `25a30865c9a4` | 画风尺子（素材自身当基准量 z） |

**模型文件核对（换机器靠大小 / sha 确认下载对不对）**

| 用途 | 放在 ComfyUI 的哪个目录 | 文件名 | 大小 | sha256 前 16 |
|---|---|---|---|---|
| 角色底模（也用于训练 ckpt） | `models\diffusion_models` | `anima-aesthetic-v1.1.safetensors` | 4,182,230,656 B | `3C1868387A3A1FF5` |
| 文本编码器 | `models\text_encoders` | `qwen_3_06b_base.safetensors` | 1,192,135,096 B | `CD2A512003E2F9F3` |
| VAE | `models\vae` | `qwen_image_vae.safetensors` | 253,806,246 B | `A70580F0213E6796` |

模型本体按模型方仓的说明取（Anima：`circlestone-labs/Anima`；Qwen-Image 系：`Comfy-Org/Qwen-Image_ComfyUI` 的 `split_files`）。**这两个链接 2026-10-22 没能联网核对**（本机访问 HF 超时），所以以上表的大小 / sha 为准——下完先对一遍再训。

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
  image_dir = "D:/dsh/素材区/角色-絉林-比例版-2026-10-19"
  num_repeats = 4
  caption_dropout_rate = 0.05
```

LLLite 的子集多一行 `conditioning_data_dir = "<控制图目录>"`。`image_dir` 是**绝对路径**：目录被归档搬走后
toml 会静默指向空目录，所以开训前先 `Test-Path` 一下（`训练区\素材\` 现在就是空的，数据集实际在 `素材区\`）。

## 12. 从零训练角色 LoRA（照这个顺序做）

> 前置：训练脚本与依赖按 §11「获取方式」备好（全部来自 kohya-ss/sd-scripts 上游，无需私有件）；下面命令里的路径按 §0 换成你的。

**1) 定一个比例基准图**。只能有一张，manual 的（`捏Ta-成稿-絉林-站姿全身-1024x1496.png`：八头身、长腿、小头、细五官）。所有"比例对不对"的争论都回到它与它的并排图。

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
    <out>\julin-proportion-v2-000006.safetensors D:\paint\ComfyUI\models\loras\julst2-v2.safetensors
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
| julinst-e10（现役） | 12×3 | 360（34 min，峰值 7.75 GB，avr_loss 0.131） | ✓ 挂 0.5 |

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
- **拼图看完整画幅**（`$DSH_HOME\skills\comfyui-cards\scripts\make-lora-sheet-full.py`；裁切版是同一个目录下的 `make-lora-sheet.py`），不要裁切后再比——裁切会掩盖取景漂移。
  用法：`python make-lora-sheet-full.py out.png "e2=a.png" "e10=b.png"`
- **尺子只做必要条件的筛**：`$DSH_HOME\skills\comfyui-cards\scripts\style_check.py` 量 RMS 与六轴 z（高光占比/暗部色温/主色相集中/线条锐度/明度基调/深色占比），
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

## 18. 词库小卡片（胶囊词条 · 词性 · 拖拽 · 目录绑定 · 导入导出）

词库的面板状态仍在 localStorage 的键 `dsh-comfyui-console/v1` → `USER`（`frags / capPol / capNote / order`），但 **0.7.60 起词库镜像到磁盘目录 `本地绘画\词库\`，以目录为准**（跟角色卡、风格卡同一套规则）。要给用户「一批词」，导出 JSON 让她点「导入」仍是最省事的路；也可以直接往 `词库\` 丢 `{分类}.json`。

### 18.0 目录即真相（0.7.60 起，2026-10-22）

三类卡全部绑目录，**一张卡 = 一个文件**：

| 类 | 目录 | 文件命名 |
|---|---|---|
| 角色卡 | `config.json` 的 `cardsDir`（默认 `$WORKSPACE\本地绘画\角色卡`） | `<卡名>.json` |
| 风格卡 | `dirname(cardsDir)\画风` | `<卡名>.json` |
| 词库 | `dirname(cardsDir)\词库` | `<分类>.json`（一张卡一个文件，卡片里的 `cat` 与文件名一致最省心） |

侧车 `sidecar_dirs.py` 的路由（8199；浏览器调用要带 `X-Console-Client: 1`）：

| 路由 | 作用 | 关键返回 |
|---|---|---|
| `GET /dir/list?kind=cards/style/dict` | 扫目录、摊平所有卡片 | `{ok,kind,dir,count,cards[]}`；每张卡带 `__file`，多卡文件里的卡带 `__multi` |
| `POST /dir/write {kind,card,path?}` | 写**单卡**文件 | `{ok,path,mode:"single",id,name}` |
| `POST /dir/del {kind,path,name,id}` | 从文件里删一张；文件空了连文件删 | `{ok,removed,deletedFile}` |
| `POST /dir/split {kind}` | 历史多卡文件拆成一卡一文件，原件留 `.multi.bak` | `{splitFiles,cardsWritten,errors}` |
| `POST /dir/clear {kind}` | 整目录搬进 `本地绘画\_清空备份-<时间戳>\<kind>\`（**只搬不删**） | `{count,moved,backup,failed}` |

`_dir_write` 的硬规则（**一张卡一个文件**）：

- 文件名 = `<卡名>.json`；同名但 **id 不同** → `<卡名>-2.json`。同一张卡的判定 `_same_card` 是 **id 优先**（双方都有 id 就只认 id，名字不算），否则同名两张会塌成一张。
- 卡改名 → 文件名跟着改，旧文件删掉。
- 传进来的 `path` 只在「那个文件里正好就是这一张卡」时复用；**多卡文件不会被就地改写**。
- 扫描跳过文件名带 `.bak` / `.multi.bak` / `.tmp` 的 json —— 备份留在目录里，但不会当卡片进面板。

浏览器侧同步（`app.js` 模块级 `DIR_SYNC` 那段）：

- 挂载后 1.2 秒跑 `syncAllDirs({quiet:true})`；`mergeDiskStyle / mergeDiskDict` 以磁盘为准：**目录里删了文件 → 面板消失；目录为空 → 整类清空面板**（角色卡由 `mergeDiskCards` 同理）。
- 面板写回：角色卡保存 → `/dir/write kind=cards`；风格卡保存 → `/dir/write kind=style`；词库 `dictFlush`（1.2 秒防抖）→ 每个分类写 `词库\<分类>.json`。
- 防丢引导：目录还空、面板里已有内容时（风格卡 `bootstrapDir`、词库 `dictFlush` + 900ms 重读），**先落盘再按磁盘重建**，第一次同步不会清掉本地卡/词。
- 词库非破坏合并：盘上有的分类用盘上的；`USER.dictFiles` 记着「上次在盘上」的分类，只有这些分类从目录消失时才从面板移除；只在面板里的新分类一律保留并立刻落盘。
- 按钮：风格卡网格「同步目录」、词库工具栏「同步目录」、角色卡「重扫磁盘」；三类各有一个「清空」，词库另有 **「清空含内置」**（置 `USER.hideBuiltinDict = true`，`allLib()` 直接短路，内置几千条一起不进面板；分类行尾会出现「恢复内置词库」）。

**坑（都踩过）**：

| 现象 | 真因 | 处理 |
|---|---|---|
| 清了目录，面板里还留一张卡 | 只删了 `fromDisk` 卡，手工卡被「保护」 | 0.7.65 起目录为空即整类清空面板；兜底点「清空」 |
| 清空词库目录后 6 个文件又回来 | 浏览器 `USER.frags` 没清，1.2s 防抖的 `dictFlush` 把分类原样写回 | 从面板发起清空（按钮先清 `frags` 再搬文件），或刷新让同步按 `dictFiles` 移除 |
| 同名两张卡只剩一张 | 旧 `_same_card` 按名字认 | 0.7.62 起 id 优先；同名不同 id 写成 `-2` 文件 |
| 导入的多卡 JSON 里改一张，别的张也被改 | 旧 `_dir_write` 就地改写整个文件 | 0.7.62 起一律写单卡文件；历史包跑 `/dir/split` 拆开 |
| `.bak` 备份也出现在面板 | 扫描不过滤 | 0.7.63 起跳过 `.bak` / `.multi.bak` / `.tmp` |
| 词库选了分类，插入后又跳回「全部」 | `cardCat` 只是组件内 state，切页重挂载就丢 | 0.7.67 起持久化到 `USER.dictCat` |

### 18.1 存档字段

| 键 | 结构 | 用途 |
|---|---|---|
| `USER.frags` | `{分类: [[中文, 英文], …]}` | 自建词条（用户加的都在这里；`lib/dict.js` 永不改） |
| `USER.cats` | `[分类名, …]` | 自建分类 |
| `USER.order` | `{分类: [中文名, …]}` | **拖拽出来的顺序**；没列到的按原顺序排后面 |
| `USER.hidden` | `{内置分类key: [原名, …]}` | 内置词条「删掉」= 只隐藏，可恢复 |
| `USER.ov` | `{原名: [新中文, 新英文]}` | 改名（内置也能改，原名留底） |
| `USER.capNote` | `{小写英文标签: 中文备注}` | 胶囊中文备注，卡片显示它，没有才退回词库中文名 |
| `USER.capPol` | `{小写英文标签: "pos"｜"neg"}` | **胶囊词性**；缺省＝未标，插入时按正向 |
| `USER.groupHide` / `USER.groupRename` | `{key: …}` | 内置大分类的隐藏 / 改名 |
| `USER.pol` | `{分类\0中文: "pos"｜"neg"｜"auto"}` | **已废弃**（卡片级词性），代码不再读写，老档残留可不管 |
| `USER.dictFiles` | `{分类: 文件绝对路径}` | **上次同步时盘上有哪些分类**；只对这些分类做「文件没了 → 面板移除」，防止首次同步误清 |
| `USER.dictCat` | 组 key（如 `cat:姿势·极限`） | 上次选中的词库分类（0.7.67 起持久化，插入后不再跳回「全部」） |
| `USER.hideBuiltinDict` | `true` | 「清空含内置」的总开关，`allLib()` 短路、内置词库整体隐藏；点「恢复内置词库」清掉 |

### 18.2 分类与卡片操作

- 分类 = 固定 `全部`（`all: true`，改不了名/删不掉/不能当拖拽目标）+ 内置组（姿势 / 表情 / 服饰 / 构图 / 场景 …）+ 自建组。
- 新卡落盘分类由 `dictCardTargetCat(grp)` 定：`全部 → 自加词`；自建 → 它自己；内置 → 该组最后一个源分类。
- 网格里：**单击选中**（200ms 防抖，双击不误触）、**双击 / 右键 = 编辑**、**拖动 = 排序或换分类**、`×` 只在胶囊上（删胶囊）。
- 编辑器：`Ctrl+回车` 保存（`Enter` 在胶囊输入框里是「加胶囊」，不保存）、`Esc` 取消；新建卡保存后弹层不关，可以接着加胶囊。
- 顶部筛选：`全部 / 纯正向 / 含负面`（按**胶囊**判：纯正向＝这张卡一颗负面胶囊都没有）。
- 工具栏：`同步目录`（重读 `词库\`，磁盘为准）· `清空`（目录搬进 `_清空备份` 并清 `frags`）· `清空含内置`（连内置词库一起隐藏）· `导出` / `导入`。

### 18.3 胶囊词性（核心口径）

- 词性属于**胶囊**（英文标签），不属于卡片：`USER.capPol["wt hair"] = "neg"` 全局生效，这张标签出现在哪张卡、哪个分类都一样。
- 三态：`pos` 永远进正向 / `neg` 永远进负面 / 未标＝按正向。
- 编辑界面直接可选：芯片最前面一枚 `正/负/自` 小标，**点它 自 → 正 → 负 → 自**，立即落盘；底部「加胶囊」那行自带三键，先选词性再加；**新建卡片同样**（同一个组件）。负向芯片边框变红。
- 插入：选中池是**单一列表**（不再分正向/负面两栏），一个按钮「插入提示词（按胶囊词性）」→ 选中卡片的所有标签摊平去重后分流：`neg` 进负面栏、其余（pos/未标）进正向栏；**两栏原有内容都不动**。
- 极性默认按标签走，所以同一个标签不要既想正向又想负面——需要两种语义就换成两个不同标签。

### 18.4 拖拽

| 拖到 | 结果 |
|---|---|
| 同分类另一张卡的**上半 / 下半** | 插到它**前 / 后**，顺序写 `USER.order[分类]` |
| **分类 chip** | 换分类：自建卡从 `frags[源]` 搬出再进 `frags[目标]`；内置卡在目标分类建一张自建卡，源分类写 `hidden`（等于搬走，不会两张） |
| 跨分类的**卡片** | 一次动作两步：先搬分类，再排到那一位 |
| `全部` chip | 只提示「集合视图，不能当目标」，不搬 |

顺序只影响词库视图；插入提示词的顺序仍由选中顺序决定。

### 18.5 导出 / 导入（分发通道）

```jsonc
{
  "kind": "dsh-dict-cards", "v": 1, "at": "2026-10-22T…Z",
  "cards": [ { "cat": "姿势·极限", "cn": "站立军姿", "en": "standing at attention, arms behind back" } ],
  "notes": { "standing at attention, arms behind back": "站立军姿" },     // 胶囊中文备注
  "tagPol": { "censored": "neg", "text, watermark": "neg" }               // 胶囊词性（0.7.44+）
}
```

- 入口：词库工具栏「导出」（导当前分类全部）/ 编辑器「导出这张」；导入：「导入」→ 选 `.json` → 合并进 `frags`（同分类同中文名覆盖，不重名）。
- 兼容：老包的 `cards[].polarity`（卡片级）导入时摊到该卡每颗胶囊；新包没有这个字段。
- 包**不含** `order`：拖出来的顺序要自己重排。

### 18.6 代码位置与硬规则

| 位置 | 内容 |
|---|---|
| `lib/app.js` | `dictGroups / dictGroupItems / dictOrdered / dictMoveEntry / dictRenameEntry / dictHideEntry / dictCardTargetCat / PR_HOME_CAT / capNoteOf / setCapNote / capPolOf / setCapPol / tagIndex`；`libTab()` 里的网格、拖拽、选中池、插入分流 |
| `lib/dictcard.js` | `CapPairInput`（备注 + 标签 + 词性三键）、`PolKeys`、`DictCardEditor`（弹层） |
| `sidecar_dirs.py` | `_kind_dir / _env_of / _dir_scan / _dir_write / _dir_del / _dir_split / _dir_clear`；`KIND_SUB = {'style':'画风','dict':'词库'}`、`ENV_KEYS`（每类卡片数组的键名） |
| `tools/build_client.py` | `SOURCES = ('dict','presets','workflow','dictcard','app')`，段标记必须与顺序一致 |
| `expander.py` | 路由注册：`GET /dir/list`，`POST /dir/write` `/dir/del` `/dir/split` `/dir/clear`（**必须挂在 `do_POST` 链、`elif p == '/save':` 之前**；挂进 `do_GET` 就是静默 404） |

**硬规则（踩过两次）**：`app.js` 从 `condForSave` 起有一层历史错层——大段顶格代码其实在 `genTab` 的作用域里。`dictcard.js` 在**模块级**，它引用的每个符号都必须在模块级，否则就是 `xxx is not defined`（已修：`capNoteOf/setCapNote/capPolOf/setCapPol/tagIndex` 与 `PR_HOME_CAT/dictCardTargetCat`）。加新助手时先问一句「dictcard 会不会直接用到它」。

### 18.7 验收

```powershell
# 模块级可见性（假 loader 跑真 bundle，打印 typeof；全 function/object 才算过）
node D:\dsh\日志\probe-client-scope.js D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin\lib\client.js

# 目录绑定：三个 kind 都要 200，并返回各自目录
Invoke-RestMethod 'http://127.0.0.1:8199/dir/list?kind=dict' -Headers @{ 'X-Console-Client' = '1' } | Select-Object ok, count, dir

# 一卡一文件自检：每个 json 里只有一张卡
(Get-ChildItem 'D:\dsh\本地绘画\词库' -Filter *.json | ForEach-Object { (Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json).dictCards.Count }) -join ','

# 组件渲染冒烟（编辑已有卡 / 新建卡 / 带词性输入行 / 三键）
node D:\dsh\日志\smoke-dictcard.js  D:\dshl\.dsh\plugins\dsh-comfyui-console\plugin\lib\client.js
```

两条都过 + `check_contract.py` 15 项 PASS，再往生产目录同步。

## 19. 换机器检查清单（路径依赖审计，2026-10-22）

`sidecar_dirs.py` / `sidecar_cards.py` / `sidecar_pack.py` 里**没有任何写死的卡目录**：角色卡取 `config.json` 的 `cardsDir`，风格卡与词库由 `dirname(cardsDir)` 派生，LoRA 目录由 `comfyRoot` 派生。换机器真正要动的是 `config.json`。

### 19.1 配置项（唯一必须手改的地方）

| 键 | 换机器怎么办 |
|---|---|
| `comfyRoot` | 填 ComfyUI 根（含 `python_embeded\python.exe` 或 `ComfyUI\main.py`）。空着会在 `E:/C:/D:/F:/Users` 的 `ComfyUI_windows_portable` 里探一遍，仍找不到就打印错误并置空 |
| `comfyUrl` + `backendMode` | 用远程/局域网 ComfyUI：`comfyUrl=http://192.168.x.x:8188`、`backendMode=remote`（此时不碰进程、不推 output 目录） |
| `cardsDir` | **空着会自动兜底**成 `<用户文档>\dsh-comfyui\角色卡`（0.7.68 起，`_default_cards_dir()` 自动创建）；想放别处就显式填 |
| `pythonExe` | 侧车解释器；空则用 `<comfyRoot>\python_embeded\python.exe`，再不行用 `python.exe` |
| `outputDir` / `saveDir` / `workDir` | 出图目录 / 保存目录 / 日志与 `client-err.log` 目录；`workDir` 空 = 插件目录下的 `work` |
| `comfyPort` / `sidecarPort` | 默认 8188 / 8199。**改端口后前端也要跟着改**，见 19.3 |
| `credsFile` | 空 = `~/.dsh/.credentials.yaml` |

`install.ps1 -ComfyRoot <dir> [-PythonExe <python.exe>] [-CardsDir <dir>]` 会探测并写出一份 `config.json`（无 BOM）。**`cardsDir` 默认已改到「文档」下**（0.7.68 起）：旧版默认放插件目录 `work\cards`，插件升级会整目录覆盖，卡会跟着没。

### 19.2 代码里的写死路径：只有探针与文档，不是硬依赖

| 位置 | 内容 | 性质 |
|---|---|---|
| `install.ps1` / `sidecar_state.py` / `lib/index.js` | `E:/D:/C:/F:\ComfyUI_windows_portable`、`~/Desktop/…`、`D:\paint\venv312` | **探测候选**，命中才用；都不命中就报错要求填 `config.json` |
| `sidecar_routes.py` | `127.0.0.1:8083/11434/1234/8080/8000/5001/5000/8001/8081/8090` | 本地 LLM 端口探测清单 |
| `sidecar_comfy.py` / `sidecar_config.py` / `sidecar_state.py` 的 docstring | `D:\paint\…` | 注释里讲历史原因，不参与逻辑 |
| `CHANGELOG.md` / `README.md` | 大量本机路径 | 文档 |
| `skills/comfyui-cards/scripts/train.ps1` | `-Ckpt -Vae -Qwen3 -VPy -Trainer` 的默认值指向作者机器 | **必传参**：缺一个就在开跑前 `Fail` |
| `skills/comfyui-cards/scripts/style_check.py` | 默认数据集 `D:\dsh\训练区\素材\…` | 第一个参数覆盖即可 |
| `tools/update.ps1` | 原来默认 `D:\dshl\.dsh\plugins\…` | 0.7.68 起改按 `$PSScriptRoot\..` 推 |

### 19.3 前端端口（0.7.68 起可覆盖）

`lib/app.js` 顶部 `CUI_CFG`：

```js
// 优先级：window.__DSH_CUI__ → localStorage → 本机默认
window.__DSH_CUI__ = { comfyUrl: "http://127.0.0.1:8188", sidecarUrl: "http://127.0.0.1:8199" };
// 或者控制台里：
localStorage.setItem("dsh-comfyui-console/ports", JSON.stringify({ comfy: "http://10.0.0.5:8188", sidecar: "http://127.0.0.1:8299" }));
```

改完刷新页面（Ctrl+F5）。都没设就是 `127.0.0.1:8188` / `127.0.0.1:8199`。

### 19.4 换机器落地顺序

1. 装 ComfyUI + 底模三件套（`anima-aesthetic-v1.1`、`qwen_3_06b_base`、`qwen_image_vae`）+ 你的 LoRA 到 `models\loras`，重启 ComfyUI（启动时扫 loras）
2. `install.ps1 -ComfyRoot <dir> -PythonExe <python.exe>`（Python 3.10+，只要标准库）
3. 起 `dsh web`，插件挂载后自动拉起侧车；`GET http://127.0.0.1:<sidecarPort>/cards` 应返回 `{ok:true,...}`
4. 验目录绑定：`GET /dir/list?kind=cards|style|dict` 三个都 200，`dir` 各自指向真实目录
5. 卡搬家用 `.dslcard` 全量卡包（**别用 `.json`**，自训 LoRA 不会跟过去）；词库用词库「导出」JSON
6. 客户端打不开就先 `CUI_CFG` 覆盖端口，再 `Ctrl+F5`

### 19.5 一条命令自检（换机器后先跑这个）

```powershell
$cfg = Get-Content '<插件目录>\config.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$cfg | Select-Object comfyRoot, comfyUrl, backendMode, cardsDir, comfyPort, sidecarPort, pythonExe | Format-List
Test-Path (Join-Path $cfg.cardsDir '')            # 角色卡目录
Test-Path (Join-Path $cfg.comfyRoot 'ComfyUI\main.py')
Invoke-RestMethod ('http://127.0.0.1:' + $cfg.sidecarPort + '/dir/list?kind=dict') -Headers @{ 'X-Console-Client' = '1' } | Select-Object ok, dir, count
```

### 18.8 LoRA 目录管理（0.7.70 起）

侧车 `sidecar_loras.py`，目录由 `sidecar_pack._loras_dir()` 从 `comfyRoot` 派生（`<comfyRoot>/ComfyUI/models/loras` 或便携版同级）。

| 路由 | 入参 | 行为 |
|---|---|---|
| `GET /loras` | `?sha=1` 可带 sha | 递归扫 `.safetensors/.pt/.ckpt/.sft/.bin`，跳过 `_trash*` 与 `_dshcards`；返回 `{dir,count,totalBytes,loras:[{name,bytes,mtime}]}` |
| `POST /loras/import` | JSON `{path}` | **本机文件复制进来**（大文件不读进内存，走 `.import-*.tmp` 再 move） |
| `POST /loras/import` | 二进制 body + 头 `X-Filename`（URL 编码） | **浏览器上传**（流式落 `.upload-*.tmp`，`Content-Length` 不够直接报「上传不完整，还缺 N 字节」） |
| `POST /loras/import` | JSON `{url, token?, filename?}` | **从网站直链下载**（0.7.71 起）：UA 伪装浏览器，`token` 走 `Authorization: Bearer`（Civitai 的 `/api/download/models/<id>` 要登录时用）；文件名取 `Content-Disposition` 再退 URL 末段；流式落 `.download-*.tmp`，超过 `DSH_LORA_MAX_MB`（默认 8192）中止 |
| `POST /loras/import` | `path` 或 `url` 指向 `.zip` | **自动解压挑权重**：zip 里所有 `.safetensors/.pt/.ckpt/.sft/.bin` 逐支导入，`__MACOSX`/图片/说明忽略；返回 `{items:[…]}` |
| `POST /loras/scan` | `{dir}` | **扫下载文件夹**：列出该目录里的权重本体与 `.zip`（按 mtime 倒序），供前端挑序号导入 |
| `POST /loras/del` | `{name}`（相对 loras 的路径） | 搬进 `<loras>/_trash-<时间戳>/`，**不硬删**；返回 `{name,trash,left}` |

口径：

- **同名同 sha 不重复落盘**（返回 `dedup:true`）；同名但内容不同 → 另存 `<名>-2.safetensors`，绝不覆盖已有权重。
- 名字只取 basename，非法字符换 `_`，缺扩展名补 `.safetensors`。
- `name` 必须落在 loras 目录内（`commonpath` 校验，`../` 直接拒）。
- 删除后 **ComfyUI 的 `/object_info` 列表要重启 ComfyUI 才会少那一支**（启动时扫 loras 并缓存）；面板自己的列表走 `/loras`，立刻变。
- UI：角色卡编辑器的「角色 LoRA」行、风格卡编辑器的「画风 LoRA」行各有 **导入** / **删除** 两枚按钮。点导入：先弹文件选择，再弹一栏输入框，**四态**任选 —— ① `https://…` 网站直链（要登录就在链接后空一格粘 token）② 本机文件路径 ③ `.zip` 压缩包路径 ④ 文件夹路径（列出候选让你填序号，可 `1,3` 多选）；输入框留空则上传刚才选中的文件（`.zip` 只能走路径那条，浏览器上传不解压）。删除后列表立刻刷新，但 ComfyUI 要重启才少那一支。

### 18.9 导入卡包卡在「正在解析」怎么办（0.7.72 起自带诊断）

旧版 `uploadCardPack` 用 `fetch`、只在 promise 链上挂 catch：请求一旦悬着（侧车重启、`body` 太大、连接被中间层掐掉），界面就永远停在「正在解析…」，看不出是传文件慢还是侧车没回。0.7.72 起改成 **XHR**：

- **有进度**：每秒刷 `正在解析 <文件> · 12s · 已传 43% · 侧车处理中（v0.7.73）`，卡住时一眼看出卡在「传」还是「解析」
- **有超时**：`max(180s, 包MB × 8s)`，175MB 包 ≈ 23 分钟上限；超时直接报「超时 Ns 没返回」
- **错误显式**：HTTP 非 200、返回不是 JSON、`onerror`（连不上 8199）、`onabort` 都落成 `导入失败：<原因>（v…）`，并写 `client-err.log`
- **上传上限**：`.dslcard` 二进制上传上限从 256MB 抬到 **1GB**（`expander.py` 的 `MAX_BODY_UPLOAD`）；超限现在直接回 `{"ok":false,"error":"body 过大: N 字节（该接口上限 1073741824）"}`

侧车每次解包都往 `plugin/work/unpack.log` 追加一行（同时打 stdout）：

```
[unpack 2026-10-22 21:20:11] 87.6 MB 0.16s auto=0 ok=True card=絉彩绘 v2 · 纯新件 err=
```

排查顺序：① 看这行有没有出现 —— 没出现＝请求没到侧车（前端/端口/侧车没起）；出现了且 `ok=False`，看 `err=`；② `127.0.0.1:8199` 是否在听；③ 面板消息里的 `已传 x%` 卡在一位数＝上传通道问题（防火墙/代理拦了 localhost POST）；④ `ok=True` 但面板不回＝前端异常，看 DevTools Console 与 `client-err.log`。

读这个日志别用 `Get-Content` 默认编码（PS 5.1 会按 GBK 读成乱码）：`Get-Content <path> -Tail 5 -Encoding UTF8`。
