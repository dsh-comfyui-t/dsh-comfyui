# CHANGELOG · dsh-comfyui-console

版本号语义：`MAJOR.MINOR.PATCH`。
`package.json` 里的 `dsh.configVersion` 是**配置结构版本**，与插件版本独立——插件小版本升级通常不涨它。

## 0.6.1 · 2026-10-21

**本机适配版。** 0.6.0 合进来之后又修了四处才真正能跑，这一版把它们与代码收敛一起发。

### 修

1. **侧车在 ComfyUI 嵌入式 Python 下起不来（致命）**
   host 用 `ComfyUI_windows_portable\python_embeded\pythonw.exe` 启动侧车，而
   `python_embeded` 带 `python313._pth`，解释器处于**隔离模式** —— `sys.path` 完全由
   `._pth` 决定，**不会**把脚本所在目录放进 `sys.path[0]`（普通 Python 会）。
   实测：`sys.path[0] = ...\ComfyUI`，插件目录不在 `sys.path` 里。
   0.1.0 的 `expander.py` 是单文件，不 import 兄弟模块，所以任何解释器都能跑；
   拆成 9 个 `sidecar_*.py` 之后就变成
   `ModuleNotFoundError: No module named 'sidecar_util'`，进程 `code=1` 秒退，
   host 保活每 15s 重试、**永远起不来**。
   → `expander.py` 自己在 import 兄弟模块之前把脚本目录塞进 `sys.path`。

2. **侧车 Origin 白名单不认 DSH 桌面版**
   `_LOCAL_ORIGIN_RE` 只认 `http(s)://127.0.0.1|localhost|[::1]`，
   而桌面版渲染进程的 origin 是 **`dsh-app://app`**。结果是每个请求
   `403 forbidden origin` + `ACAO: null` → 浏览器判 CORS 失败 → 面板显示
   「连不上本地 sidecar」。**跟 `requireToken` 无关**，那是第二道闸。
   → 让正则同时接受 `dsh-app://<name>`（这个 scheme 只由本应用注册）。

3. **底模选不了：Anima 分支在本机是空的**
   `MODEL_DEFAULTS.clipType = "qwen_image"`，而本机 `UNETLoader.unet_name` **0 条**
   （`diffusion_models` 为空，5 个底模全在 `checkpoints`）。面板停在 Anima 分支，
   底模下拉一个选项都没有。
   → 新增 effect：`qwen_image` 分支没有底模、而 checkpoints 有 → 自动切到非 Anima 的
   编码器类型，并提示原因。将来真往 `diffusion_models` 放了模型就不再触发。

4. **`theme` 的 TDZ 让整个面板崩掉**
   主题那次把 `theme` 加进了 `saveLast` 的 `useEffect` 依赖数组，而那个 effect 在
   `const [theme, setTheme]` **上面** —— 依赖数组渲染时立即求值，
   `ReferenceError: Cannot access 'theme' before initialization`，一点开面板就崩。
   `node --check` 语法完全合法，查不出来。
   → 把 state 声明移到 effect 之前；并新增 `tools/check_tdz.py` 专门查这一类。

### 改

5. **面板配色变量化**（原来硬编码浅色，在深色 DSH 里是白底黑字混着来）
   21 个语义变量 `--c-*`，两套调色板；`167` 处 hex 与 `39` 处 `rgba(17,24,39,α)`
   全部替换成变量。主题设置：**跟随系统 / 浅色 / 深色 / 自定义（背景色 + 文字色）**。

### 优化（不改行为）

6. 两处重复的「底模分支守卫」抽成模块级 `effectiveClipType(modelName, clipType, unetNames)`。
7. 删掉 `comboOptions` 改造后遗留的死变量 `req`。
8. `themeTick`（只写不读）换成 `systemDark`（真正被 `resolveTheme` 消费）；
   `resolveTheme(th, systemDark)` 支持注入，单测因此不再依赖 `matchMedia`。
9. 清掉构建目录里的 `.bak-*` / `__pycache__` / `.build-backup`。

### 加回 1.0 的功能（含按钮布局重排）

10. **视角三档（俯视 / 平视 / 仰视）**
    VIEWS + pplyView + detectView 从 0.1.0 移植。
    只改**最后一个 SUBJECT:（姿势段）** 和 COMPOSITION: 段，并把前置相机词挂到整条最前面；
    第一个 SUBJECT:（角色外貌）、CLOTHINGS:、ENVIRONMENT: 逐字不动。
    重复应用幂等（前置词不叠加、负向压制句不重复）。
    **布局**：分段控件 —— 三段连体、只有两端圆角、选中的填主色。放在参数卡的超分行下面。

11. **种子控制**
    0.6.1 之前每次出图都是 Math.floor(Math.random()*1e15)，界面上看不到也复现不了。
    现在有输入框 + 「随机」按钮 + 「固定」勾选：
    勾了固定且填了非 0 → 复用；否则每次随机，出完把实际用的 seed 写回输入框。
    **布局**：视角 [俯视│平视│仰视] ┆ 种子 [________] [随机] ☑固定，
    一条横带，用竖线分隔两组；固定且非 0 时右侧补一句「同参数下可复现」。

### 顺带

- `cardsDir` 指向 `E:\aqca\work\comfyui\cards`，角色卡 / 风格卡标签页可用。
- `outputDir` 指向 `E:\ComfyUI\ComfyUI_windows_portable\ComfyUI\output`（ComfyUI 默认目录，
  不需要 `--output-directory` 也一致）。
- **已知未解决**：`E:\aqca\work\sd\models\anima\diffusion\anima-aesthetic-v1.1-Q8_0.gguf`
  是 `.gguf`，需要 ComfyUI-GGUF 自定义节点才能在 `UNETLoader` 里用；
  且 `extra_model_paths.yaml` 尚未映射 `diffusion_models`。两者都没做，所以现在只能走
  checkpoint 链。
- **已知未解决**：`anima\loras\4x-UltraSharpV2.safetensors` 是放大模型，误放在 LoRA 目录里，
  会出现在 LoRA 候选的第一条。选中它出图必失败。

## 0.6.0 · 2026-10-21

**把本地 0.1.0 的稳健性修合并进 0.5.7。** 0.5.7 之后本机一直在用自己那份 0.1.0，
因为 0.1.0 上有四处 0.5.x 没覆盖到的修；0.6.0 是把两边合起来。

### 移植自 0.1.0

1. **`comboOptions()`：COMBO 三种形态全覆盖。**
   0.5.x 的 `pick()` 直接取 `input.required[key][0]`，对
   `[[名字...], {配置}]` 和 `[[名字...]]` 两种形态恰好正确，但遇到较新 ComfyUI 的
   统一写法 `["COMBO", {options}]` 会返回字符串 `"COMBO"` —— 下拉里只有一个叫
   COMBO 的选项，发出去必然 400。原先形态 2 漏掉过一次，就是
   `vae_name: '' not in list` 那个 HTTP 400。
   现在统一走 `comboOptions()`，`UNETLoader / KSampler / CLIPLoader.type /
   LoraLoader / VAELoader / CLIPLoader / UpscaleModelLoader` 全部改用它。

2. **`jpost` / `jget` 解析 `node_errors`。**
   原来只抛 `HTTP 400`，用户看不到任何原因。现在把响应体里的
   `node_errors` 逐条摊平，直接报"节点 3（VAELoader）：vae_name: '' not in [...]"。

3. **出图后放大（超分链）。**
   `UpscaleModelLoader` + `ImageUpscaleWithModel` + 可选 `ImageScaleBy`（2x/3x）。
   参数区新增「出图后放大」勾选、模型下拉、倍率下拉，选择记进 `localStorage`。

   ⚠️ **节点号用 30/31/32**，不是 20/21/22 —— 后者在本版已被 LLLite
   （`LoadImage` / `ModelPatchLoader` / `AnimaLLLiteApply`）占用，撞号会让工作流直接坏。

   ⚠️ 放大模型列表过一遍 `looksLikeUpscaler()`：`extra_model_paths.yaml` 里若把
   `upscale_models` 指到模型树根，ComfyUI 会递归列举，底模/LoRA/VAE 全塞进来
   （实测 24 个条目里 23 个是底模），选中就 `spandrel UnsupportedModelError`。

   为什么不在高分辨率直出：模型在约 1 MP 上训练，直接出 4K 属分布外崩坏。
   实测 3840×2160 花 19 分 34 秒、出 4 个脑袋；960×544 + 4x 放大只要 39~54 秒。

### 改

4. **「官方预设 · 正面证件照站姿」前置 `(from below:1.2)`。**
   实测不加这句，即使姿势段写 upright、COMPOSITION 写 eye-level，
   出图仍会翻回俯视。这是抵掉模型下压倾向的必要项，不是想拍仰视。
   （另外两个预设是明确的俯视/低角度意图，没动。）

### 未移植（说明）

- `VIEWS` 视角按钮（0.1.0 的三档切换）**不移植**：0.5.x 已用三个独立预置覆盖
  同样三种视角，再做一套按钮是重复功能。
- 0.1.0 里 896×1216 的稳定性告警一并去掉：本版默认尺寸是 896×1216，
  但 0.5.x 的尺寸预设表已覆盖常用档位。

## 0.5.7 · 2026-10-21

**鉴权真修 + 经验回迁 + 授权补齐。**

### 修：Origin 免 token 是伪防护

0.5.0 的分层鉴权把 `Origin` 当身份依据，但 `Origin` 是客户端可控头——本机任意进程加一行
`Origin: http://127.0.0.1` 即可免 token；叠加 `Access-Control-Allow-Origin: *`，任何网站的预检也能通过，
恶意页面同样能打侧车。改为两道叠闸：

1. `ACAO` 改为**只回显白名单 Origin**（+ `Vary: Origin`），不再回 `*`；
2. 面板请求统一带 `X-Console-Client: 1`（自定义头 → 强制跨源预检 → 别站预检被拒 → 浏览器发不出请求）；
3. 无 Origin 的脚本调用者仍必须带 `X-Console-Token`。

残余风险已在 README 5.1 与 `docs/生成经验.md #8` 写明：本机进程可同时伪造两个头，进程隔离不在插件能力内。

### 新增 `plugin/docs/生成经验.md`（9 条）

现象 → 真因 → 修法 → 代码锚点。v1.0 那六条（pinned-memory、`832×1216` 双人、姿势决定视角、`/free` 空 body、
端口守卫判据、venv 进程数）+ 本版新增三条（编码补丁顺序、PNG `tEXt` 让文件 sha 与像素不一致、打包白名单）。
代码侧共 9 处注释指回文档编号。

### 新增 `LICENSE`（MIT 正文）

`package.json` 一直写 MIT 但包内没有正文，分发时接收方无法确认授权。已补进套件根并纳入 MANIFEST。

### 打包改白名单

`tools/build_suite.py`：只打 `package.json.files` 列出的文件 + 套件根文档 + `LICENSE` + `skills/`，
并在打包后断言包内不得含 `sidecar-token.txt` / `config.json` / `*.pyc` / `*.bak*`。
（0.5.3 曾把 43 字节真 token 打进包，根因是"先全打再排除"的黑名单思路。）

### 前端

`lib/client.js` 由 `tools/build_client.py` 重构建，`--check` 一致。

## 0.5.6 · 2026-10-21

**侧车挂了不用再重启 dsh web。**

### 问题

`apply()` 里是**一次性** `setTimeout(ensureServices, 4000)`。侧车中途挂掉（崩溃、被任务管理器结束、端口被抢）之后，host 再也不会拉起来——只能重启 dsh web。

实测：杀掉侧车等 150 秒，`host-plugin.log` 毫无动静，`/version` 一直不可达。

### 改法

改成保活循环：

- 启动后 4 秒首检（原行为不变）
- 在线时每 60 秒**静默**确认一次，代价只有一次 TCP connect
- 不在线则拉起；连续失败按 15s / 30s / … 退避，封顶 5 分钟
- 恢复时打一行"侧车已恢复"
- `ctx.effect` 卸载插件时停表（拿不到 effect 也不影响功能）

顺带三处：

1. `ensureServices()` 现在**返回**最终是否在线（原来只 log 不返回）
2. 已在线时**不再空等 3 秒**——原来无论在线与否都 `sleep 3000` 再检测；保活每分钟调一次的话那是纯浪费
3. 新增 `{ quiet: true }`：在线时完全静默。否则一天多 4000 行日志

### 真机验证

`host-plugin.log` 实录（0.5.6 实例，手动 `Stop-Process` 杀掉侧车）：

```
09:41:11.463  plugin 0.5.6 装载
09:41:11.606  apply() 被调用
09:41:29.833  子进程退出 sidecar pid=12808 code=4294967295
09:42:15.623  保活：侧车不在线 (:8199)，第 1 次尝试拉起
09:42:15.635  sidecar 未运行，准备拉起
09:42:15.649  已 spawn sidecar pid=5648
```

`/version` 在 51 秒后恢复（`loaded=0.5.6  disk=0.5.6  stale=false`）。51 秒是"杀在两次心跳之间"的正常延迟，不是重试慢。

对照很干净：**同时运行的 0.5.5 实例在同一次杀进程后没有任何动作**——它就是被这个补丁修掉的那份代码。

## 0.5.5 · 2026-10-21

**修一个我自己引入的回归：没有 `config.json` 时侧车启动即崩。**

### 症状

首次安装、还没配 `config.json` 时，侧车进程 `code=1` 立刻退出，`sidecar.err.log` 只有：

```
UnicodeEncodeError: 'gbk' codec can't encode character '\u2717' in position 0
```

`✗ 找不到 ComfyUI。请改本目录的 config.json：` 这行提示本身把进程打死了。

### 根因

中文 Windows 下，stdout 被重定向到**文件**（插件 spawn 时就是 `stdio: ['ignore', outFd, errFd]`）时，Python 按 locale 取 cp936 —— 打印 `✗` / `✓` 直接抛 `UnicodeEncodeError`，而且发生在导入期，没人接。

原版（1.1.2）在 `expander.py` 顶部有一道补丁：

```python
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
```

**我在 1.1.3 拆 `sidecar_util.py` 时，把这段模块级代码挪到了文件末尾（所有 import 之后）**——注释留在原位，代码掉到第 204 行。而 `_load_cfg()` 在 `from sidecar_state import (...)` 那一刻就执行了，补丁永远晚一步。

1.1.3 / 1.1.4 都带这个回归。它只在"没有 config.json"时触发，也就是**每个新用户第一次安装的时候**；已有配置的机器完全看不出来。

### 修复

1. 补丁移回 `import sys` 之后、`from sidecar_state import` 之前
2. `sidecar_state.py` 自己再加一道（它导入期就会 `print`，不能指望调用方先设好）

### 验证

不设任何编码环境变量、stdout 重定向到文件，从零启动：

```
✓ /health -> 200 {"ok": true, "routes": ["local-llama"]}
```

### 同时完成：端到端出图验证（ComfyUI 8188）

之前 A（回归锚）和 B（风格卡）只在状态机与差分测试里验过，没跑过真出图。这次全部跑通：

| 场景 | 结果 |
|---|---|
| 无 LLLite 基线出图（512×768 / 8 步 / euler / cfg 4.5） | 6 s 出图，画面正常 |
| 同 seed 两次（换 prefix 强制真重算） | **像素差 0** —— 本机出图是确定性的 |
| 带 LLLite（`julin-lllite-v2-400` + 控制图） | 平均差 21.7/255、99.985% 像素变化，角色明显向控制图靠拢 |
| 带 LLLite 重复一次 | 像素差 0 |

**结论**：`buildGraph` 的 UNETLoader + CLIPLoader(qwen_image) + AnimaLLLiteApply 20/21/22 链在真机上完全正确。

**一个容易误判的点**：两次出图**文件 sha 不同、字节数相同**，因为 ComfyUI 把含 `prompt_id` 的 workflow JSON 写进了 PNG 的 tEXt 元数据，像素完全一致。所以任何"用文件 sha 判断是否漂移"的设计都会 100% 误报 —— 回归锚目前是"出图给人眼看"，没走自动比对，这点没问题；将来要加自动比对，必须比解码后的像素，不能比文件字节。

## 0.5.4 · 2026-10-21

**侧车拆完了：`expander.py` 从 2876 行降到 550 行。**

九个模块，按职责分：

| 模块 | 行数 | 管什么 |
|---|---|---|
| `expander.py` | 550 | HTTP 路由分发（`class H`）+ `main` |
| `sidecar_state.py` | 181 | 配置加载与派生量（唯一真相） |
| `sidecar_util.py` | 251 | 无状态工具（0.5.3 拆出） |
| `sidecar_routes.py` | 194 | 大模型路线探查与缓存 |
| `sidecar_llm.py` | 443 | 提示词扩写 + 本机 llama.cpp 起停 |
| `sidecar_comfy.py` | 385 | ComfyUI 进程生命周期 |
| `sidecar_config.py` | 199 | 配置读写、出图目录、验证 |
| `sidecar_cards.py` | 484 | 卡与 LLLite 资产读写 |
| `sidecar_pack.py` | 495 | 卡包打 / 拆包 |
| `sidecar_auth.py` | 115 | Origin 白名单 + token |

**怎么切的**：不是按文件位置拍脑袋，是先用 AST 算依赖（`日志/dep_of.py`），把每个函数"引用了哪些模块级名字"显式列出来，再定边界。`sidecar_state` 只被读、不被写回；`expander.py` 顶层 `from sidecar_X import (...)` 把名字导回来，**调用点一个字没改**。

**拆的过程里挖出三个真 bug**（都是原代码就有的，不是拆坏的）：

1. **`COMFY_ROOT` 被赋值两次**：原文件 L188 定义一次，L1037 又定义一次（带回退 `or r'D:\paint\ComfyUI'`）。于是 L1037 之前的函数看到空字符串、之后的看到真实路径 —— `/stylecards/packed` 之所以返回绝对 root，靠的正是这个"后半段才生效"的副作用。统一进 `sidecar_state` 后全模块一致。
2. **`asset_errs` 从未初始化**：`_stylecards_unpack` 里只有 `asset_errs.append(...)`、没有定义，asset 写入失败时抛 NameError，把真实错误盖掉。已补初始化并让它进返回值（`assetErrors`）。
3. **`global _PROBE_DIAG` 重新绑定**：拆开后 `expander.py` 导入的是旧 list 快照，`/routes` 的 `probed` 直接变空。改成原地 `[:] = diag`。

**验证**：

- 12 个 GET 端点 + 1 个 POST 与 1.1.3 逐字对比：11 个完全一致，2 个只差 `pid` / `idle_seconds`
- 函数差分：跨模块 23 项 + 工具函数 36 项，全部一致
- 十个文件全过 `check_all_names.py`（模块级 + 函数级自由名检查，专抓运行时才会炸的 NameError）
- 契约 15 项 PASS、MANIFEST 全对

## 0.5.3 · 2026-10-21

**侧车拆出无状态工具模块（第一步）**

`expander.py` 从 2876 行降到 2689 行；19 个纯函数 + `_NO_WINDOW` 常量搬到 `sidecar_util.py`（252 行）。

搬的是：`_rid` `_port_open` `_port_already_serving` `_dedupe` `_nl_unknown_ok` `_sha256_file` `_png_size` `_slug` `_tags` `_is_cjk` `_http_json` `_http_post_nojson` `_norm_dir` `_scan_loras` `_dl_to` `_reveal_in_explorer` `_hide_kwargs` `_models_list` `pick_model`。

**判据不是"看起来像工具"**，是 AST 分析：这些函数不引用任何模块级可变状态（`CFG` / `CONFIG` / `COMFY_*` / `CREDS` 等 48 个 state 名）。依赖可变状态的 37 个函数一个没动。`expander.py` 顶部 `from sidecar_util import (...)`，所有调用点一字未改。

新文件已进 `package.json.files`、`dsh.update.inPlace`、`install.ps1`、`tools/update.ps1`（复制 / 备份 / py_compile）、`verify.ps1`、`install-ai.ps1` —— 漏一处，装上去就会因缺模块启动失败。

**怎么证明没拆坏**（三层）：

1. **端点对比**：拆分前的备份与新版本并行启动（8196 / 8197），逐个请求 12 个 GET 端点 —— 10 个逐字一致，`/routes`（901 字符）完全一致；两处差异只是 `pid` 与 `idle_seconds` 这类每进程必变的字段。`POST /cards/validate` 也一致
2. **函数差分**：直接加载旧模块与新 `sidecar_util`，同一组输入跑 36 个用例（空串、纯空白、中文、90 字符长串、缺文件、不存在端口），36/36 一致
3. **基线与产物**：`/version` 的 `limits` / `tokenRequired` / `configVersion` 与拆分前逐字相同

**没做的**：`CFG` / `WORK_DIR` / `COMFY_PORT` 那批有状态函数（37 个）仍在 `expander.py`。要拆它们得先引入 `state.py` 把配置变成可注入的，那是第二步。

## 0.5.2 · 2026-10-21

**风格卡也有资产与迁移信息了**

角色卡 0.5.0 就有了 `baseModels` / `training` / `regression`，风格卡一直是空的——同一套字段两种待遇。这版补齐：

- 风格卡编辑页新增 **底模 / 训练记录 / 回归锚 / 自检 / 回归锚跑批** 五行
- 字段与角色卡同名同结构，`POST /cards/validate` 直接通用，不需要新端点
- **老卡兜底**：1.0 的风格卡只有 `ckpt`（就是"该用哪个底模"），`_styleBm()` 在新字段为空时回退到它——老卡一进编辑器就能看到底模，存一次也不会丢
- 「跑回归锚」对风格卡同样可用：正向词回退走 `joinStyleParts`，文件名前缀 `_sreg_`（角色卡是 `_reg_`），两批图不会混
- 导出全部风格卡时三个字段一并带走（`exportAllStyleCards`）

**自检状态分开**：`styChk` 与角色卡的 `cardChk` 是两份 state，同一会话里来回切两个编辑器不会串台。

**测试**：`日志/test-stylebm.js`，20 项全过（含老卡兜底、清空回退、坏 JSON、未编辑保留原值）。

## 0.5.1 · 2026-10-21

**卡生命周期补上执行器：回归锚能真跑了**

之前只能"查底模在不在"，`regression.seeds` 是个没有执行器的字段，等于纸面承诺。这版补上：

- 卡编辑页「资产与迁移」区块新增 **「跑回归锚」**：对 `regression.seeds` 逐个出图
- 参数全部取**当前面板**（底模 / CLIP / VAE / LoRA / 尺寸 / 步数 / CFG / 采样器 / 调度器），只有 seed 用卡上的值
- **串行执行**，一张完成再下一张，不并发塞 ComfyUI；显示「回归中 2/3」，可点「停止」
- 结果就地显示：缩略图 + `seed ✓/✗`，失败带原因
- 文件名前缀 `<prefix>_reg_<卡id>_<seed>`，便于在输出目录里挑出来
- `waitJob()` 只认本次提交的 `prompt_id`——用户手点生成产生的完成事件**不会**被误当成回归结果
- 提交后若已是 error 立即返回，不会白等满 900 秒

**为什么这是纯前端功能**：出图请求由 `app.js` 直连 ComfyUI 的 `/prompt`，workflow 在 `workflow.js` 里拼好，服务端 `expander.py` 全程不构造 workflow，所以服务端根本没法"自己跑一张图"。硬要做到服务端，等于把 workflow 构造逻辑复制一份，两份必然漂移。

**局限**：正向词优先取面板当前值；面板为空才退回卡片自带 `tags`，并在消息里说明来源。要拿到"和卡完全一致"的结果，先在生成页插入这张卡再跑。

## 0.5.0 · 2026-10-21

**主题：把「能跑」变成「能交付、能审计」**

- **版本单一真源**：新增 `tools/sync_version.py`，`VERSION.json` 是唯一来源，写进 `package.json`、`README.md`、`START-HERE-AI.md`、`安装说明-给人看.md`。`--check` 可直接当门禁用（不一致 exit 1）。
  此前 1.0 包存在五处版本漂移：zip 名 `1.0` / `VERSION.json` `1.2.0` / `package.json` `0.4.1` / 文档 `0.4.0`。
- **契约断言**：新增 `tools/check_contract.py`（16 项）。专治 0.4.0 那次事故——少一个 `dsh.bundle.patch` 宿主就静默跳过整个插件。顺带检查 `files` 白名单里点名的文件是否真的存在。
- **请求体上限分档**：`MAX_BODY = 8 MB`（普通 JSON 接口）/ `MAX_BODY_UPLOAD = 256 MB`（`/stylecards/unpack`、`/cards/import`、`/cards/selfcontained`）。超限 413，且**不读 body**。
  **更正**：此前文档暗示"没有上限"，实际 0.2.0 起就有单一 256 MB 上限，问题是所有接口共用一档，`/expand` 也能收 256 MB。
- **侧车 token 分层鉴权**（面板零改动）：
  - `OPTIONS` / `/health` / `/version` 一律放行
  - 浏览器来源（`Origin` 为本机，或 `allowLan` 时的私网段）**免 token**
  - 无 `Origin` 的调用者（本机脚本 / curl / 其它软件）必须带 `X-Console-Token`，缺或错 → 401
  - token 来源：`config.json` 的 `sidecarToken` → 否则 `<workDir>\sidecar-token.txt` → 否则生成 32 字节并落盘（`chmod 600`）
  - 临时关闭：`config.json` 里 `"requireToken": false`
  - `GET /version` 新增 `tokenRequired` 与 `limits`
- **卡生命周期**：
  - 卡字段新增 `baseModels`（依赖哪些底模）、`training`（训练记录）、`regression`（回归锚 seeds/framing/samples），均为可选，`_cards_write` 自由合并
  - 新增 `POST /cards/validate` → `{ok, checked, presentBaseModels, missingBaseModels, notes[]}`，用 ComfyUI 的 `CheckpointLoaderSimple` / `UNETLoader` 可选清单比对
  - 面板卡编辑页新增「资产与迁移」区块（底模输入 + 两个 JSON 文本域 + 「校验底模与迁移信息」按钮），`client.js` 已重构建
- `install/verify.ps1` 新增 `-Python` 参数与 `contract` / `version:consistent` 两节
- `package.json` 的 `files` 修正：`lora来源.json` → `lora来源.example.json`（包内只有 example，原写法会让 `npm pack` 静默缺件）
- `MANIFEST.sha256` 重算（25 条）

**升级注意**：`config.json` 新增两个键（`sidecarToken`、`requireToken`），`configVersion` 仍为 2，`migrateConfigFile()` 会自动补；升级后必须重启 `dsh web`。

## 0.4.1 · 2026-10-20

**修一个致命回归：面板整体消失**

- 0.4.0 把 `package.json` 的 `dsh` 段整个重写成更新元数据，**覆盖掉了原有的 `dsh.bundle` 与 `dsh.client`**，
  于是 harness 启动时报 `skipping profile bundle "dsh-comfyui-console": declares no dsh.bundle in its package.json`，
  整个插件包被跳过 → 页面里「ComfyUI 绘图台」不见了。
- 现在 `dsh` 段是**合并**写入：保留 `bundle.patch` 与 `client.platform`，再并进 `configVersion` / `minHost` / `update`：

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "inject": [], "platform": "web" },
  "configVersion": 2,
  "minHost": "0.2.0-rc.2",
  "update": { ... }
}
```

- 面板参数改为**保存上一次使用**（2026-10-20 用户要求）：

| 项 | 之前 | 现在 |
|---|---|---|
| 底模 | 每次打开被 `loadMeta` 末尾的 `setCkpt(c.indexOf(cur)…)` 硬塞回 checkpoints 第一个 | 按分支各记一份（`USER.last.byType.qwen_image` / `.ckpt`）；当前值在本分支里有效就原样保留，存档值从盘上删掉才回落默认 |
| 编码器类型 / 文本编码器 / VAE | 存档有效则恢复，但切分支时被 `anima-aesthetic` 硬覆盖 | 切分支按「当前有效 > 该分支上次用的 > 默认」挑；VAE 选项列表补进上次用的那个，避免下拉显示空 |

- 采样的 `sampler / scheduler`、尺寸、步数、CFG、LoRA 选择本来就在 `USER.last` 里，这次不动。

- 教训写进 `START-HERE-AI.md` 与本文：**改 `package.json` 只能增键，不许整段替换**（`dsh`、`exports`、`peerDependencies` 都是 harness 的契约字段）。

## 0.4.0 · 2026-10-20

**主题：可更新性（以后换版本 = 换包，不重装）**

- `package.json` 新增 `dsh` 段：`configVersion: 2` / `minHost` / `update`（哪些目录会被替换、哪些必须保留、重启谁）
- `lib/index.js`：
  - 装载时读取自身 `package.json`，得到 `PLUGIN_VERSION` / `CONFIG_VERSION`，并以 `export const version` 暴露
  - 新增 **`migrateConfigFile()`**：`config.json` 的 `configVersion` 落后时**就地迁移**——只补缺失键、不删用户键、不认识的键原样保留，写回一次，幂等
  - 启动日志第一行打 `plugin <ver> 装载 · configVersion=x/y（已就地迁移 v…）`，从 `host-plugin.log` 就能确认跑的是哪一版
- `expander.py`：
  - 新增 **`GET /version`** → `{loaded, disk, stale, configVersion, configVersionOnDisk, pid, startedAt, unknownConfigKeys}`
    `loaded` 是本进程装载时的版本，`disk` 是磁盘当前版本，`stale=true` 表示"包已更新、进程还是旧代码 → 要重启"
  - `_load_cfg()` 记录 `configVersion` 与 `unknownKeys`，不再假设配置键集合固定
  - `_cfg_set()` 写回时自动把 `configVersion` 抬到当前值
- 新增 **`tools/update.ps1`**：就地更新脚本（目录 / zip / npm pack tgz 三种源），只替换代码，备份到 `.bak-update-<ts>`，更新后跑 `node --check` + `py_compile` + `dsh --dump-config`
- 新增 `CHANGELOG.md`（本文件）；README 增加「更新（不要重装）」一节
- 面板右上底栏显示运行中版本；`/version` 报 `stale` 时提示重启

**升级注意**：0.3.x → 0.4.0 只需替换 `lib/`、`expander.py`、`package.json`，`config.json` 会自动补 `configVersion: 2`，其余键不动。之后**必须重启 dsh web**。

## 0.3.0 · 2026-10-20

- 包名从 `@local/dsh-comfyui-console` 改为 `dsh-comfyui-console`
- 去掉 `private`，加 `files` 白名单，可 `npm pack` 分发
- 新增 `config.example.json`、`install.ps1`、`README.md`
- `lib/index.js` 缺 `config.json` 时自动按模板生成（`bootstrapConfig`）
- 新增 `allowLan` 开关（局域网访问放行，公网仍 403）
- **底模分支校验**：编码器类型 `qwen_image`（Anima）只列 `diffusion_models`，其余只列 `checkpoints`；混投在本地拦下并说明原因，不再把注定 400 的图发给 ComfyUI

## 0.2.0 · 2026-10-19

- 角色卡 / 风格卡 / `.dslcard` 卡包导入与导出
- LLLite 身份控制（控制图 + 权重，按档位切换）
- 侧车 8199：ComfyUI 启停、闲置自动卸模型、出图落地、词库扩写

## 0.1.0 · 2026-10-17

- 首个可用版本：提示词面板 + ComfyUI 出图 + 后台任务接管
