# Changelog

按时间倒序。这个仓库之前的历史在 [plugin/CHANGELOG.md](plugin/CHANGELOG.md) —— 那是逐版记录，含每版改动和踩过的坑，比这张表细。

## 0.7.151 · 2026-10-27

基线 v0.7.92。

### 更新内容

**plugin 0.7.92 → 0.7.151**

- 前端 6 份源码（`dict` / `presets` / `workflow` / `dictcard` / `online_models` / `app`）经 `tools/build_client.mjs` 拼成 `lib/client.js`
- 侧车拆成 14 个模块，`expander.py` 只保留 HTTP 分发；新增 `sidecar_dirs.py` / `sidecar_loras.py` / `sidecar_aline.py` / `aline_mods/`
- 在线模型库、词库小卡片、角色卡与风格卡、LLLite 身份控制、出图后处理
- 二级页（历史 / 模型库）顶到面板底边，清掉 `S.wrap` 的 48px 底部内边距
- 新增 `requirements.txt`，按「强烈建议 / 可选」分档声明 Python 依赖

**skills/comfyui-cards**

- `SKILL.md` 33,259 → 81,451 B：
  - §11A 风格卡制作流水线（画风 LoRA 纳入工序，两档完整度）
  - §12A 硬规定：角色卡不得混入画风（四条禁止 / 互斥表 / E1–E3 验收 / 配套超参 16-8 + 1e-5）
  - §20 生成参数与采样、§21 工作流与节点、§22 侧车接口（74 条路由分组）

### 修复

- **视角功能整体失效** — `plugin/lib/presets.js` 在 0.7.92 之后丢了 `export function applyView` 与 `export function detectView`，`app.js` 只剩 `typeof applyView === 'function'` 的防御调用，点视角按钮没有反应。从 v0.7.92 恢复（+1,468 字符），`client.js` 重建 929,350 → 930,885 字符
- **`tools/check_tdz.py` 硬编码他人机器路径** — 默认目标是 `E:\aqca\profiles\...` 与 `E:\aqca\work\...`，换了机器必然 `FileNotFoundError`。改成仓库相对 `plugin/lib/app.js`
- **`tools/check_tdz.py` 大面积误报** — 四类声明识别缺陷，逐条修正：
  1. 形参解构 `function X({guide, stepIndex, ...})` 完全没识别
  2. 一行多变量 `const keyOf = ..., modelKey = ...` 只认第一个
  3. 行中间的第二个解构 `..., [retry, setRetry] = ...`（原正则带 `^` 锚定，一行只能匹配一次）
  4. 排除集漏 `-` 与 `:`，导致 HTML 属性 `data-cc-guide=` 里的 `guide` 被当成变量声明
  修正后 `check_all` 由 11/13 升到 13/13

### 分发口径

`VERSION.json.notIncluded` 排除：角色卡 / 风格卡 JSON、LoRA 权重、本机 `config.json`、`lora来源.json` 真件（只发 `.example`）、构建备份 `*.bak-*` / `.build-backup` / `.bak-old` / `__pycache__`。

## 2026-10-23

- chore(release): 版本号收敛为单一来源（插件版本 = 套件版本 = 包名 = tag），文档与产物名随版本自动同步
- fix(update): `dsh.update.inPlace` 13 → 16 项，补 `sidecar_dirs.py` / `sidecar_loras.py` / `tools/build_client.py`——就地升级此前会漏掉两个侧车模块
- feat(plugin): 卡包全量导出/导入、封面随包分发、LLLite 身份控制按卡绑定、词库卡（dictcard）
- fix(cards): 卡目录扫描显式区分非卡 JSON（`lllite-index.json` 等进 `skipped`，不再被静默丢弃）
- chore(manifest): `MANIFEST.sha256` 覆盖仓库全文件（此前 35/58）
- chore(changelog): `plugin/CHANGELOG.md` 补齐 0.7.53–0.7.92 合并记账

## 未发布

- 根目录补 README / SECURITY / issue 模板 / 本文件

## 2026-10

- feat: 去依赖化 0.7.0
- chore: CODEOWNERS 填入真实用户名
- chore: 加多人协作的仓库配置
- chore: 初始化仓库（dsh-comfyui-console 0.6.1）
