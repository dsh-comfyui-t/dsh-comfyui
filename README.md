# DSH ComfyUI 绘图台

把 ComfyUI 变成 DSH 里的一个绘图面板：底模 / LoRA 多选、提示词词库与中文转标签、预设、角色卡与风格卡、出图后放大、视角三档、种子控制，全部在使用 DSH 的同一个窗口里完成。

插件 `dsh-comfyui-console` + 技能 `comfyui-cards`，由 [@dsh-comfyui-t](https://github.com/dsh-comfyui-t) 组织维护。

> **English summary** — A ComfyUI console plugin for DSH (a local coding-agent harness): model/LoRA selection, prompt dictionary with Chinese-to-tag translation, presets, character/style cards, upscaling and seed control, all inside the DSH web UI. Ships a Python sidecar on port 8199 and a skill package. Install is scripted and verified; the development rules are machine-checkable (`tools/check_all.py`). Maintained by three people via `CODEOWNERS`.

---

## 装完得到什么

1. **绘图台插件** —— DSH 顶栏多一个 `ComfyUI 绘图台`，含 8199 侧车与 Web 面板
2. **双卡机制与技能** —— 角色卡 / 风格卡 + 自训流程（`skills/comfyui-cards`）
3. **现成卡位** —— 可直接出图的预设组合

## 快速开始

```powershell
cd <解压后的目录>
powershell -ExecutionPolicy Bypass -File install\install-ai.ps1 -ComfyRoot "D:\ComfyUI\ComfyUI_windows_portable" -CardsDir "D:\cards" -LinkJunction -Profile <profile 名>
powershell -ExecutionPolicy Bypass -File install\verify.ps1
```

然后**重启 `dsh web`**，打开 `http://127.0.0.1:10722`，顶栏出现 `ComfyUI 绘图台` 即成功。

> 重启是必需的：插件是 ESM 模块，模块缓存按进程，刷新页面不生效。

三个参数的取值、自动探测路径、`-ApplyProfile` 与 `-LinkJunction` 的区别，见 [安装说明-给人看.md](安装说明-给人看.md)。

## 验证

```powershell
Invoke-RestMethod http://127.0.0.1:8199/version
# loaded / disk / stale / configVersion 四项对齐
```

`install\verify.ps1` 一次性检查：文件完整性、`config.json` 可解析、侧车健康、版本对齐、卡数、8188 / 8199 / 10722 端口、profile 挂载。有 FAIL 就退出码 1。

## 环境要求

| 项 | 要求 |
|---|---|
| DSH | `>= 0.2.0-rc.2` |
| Node | `>= 18` |
| Python | `>= 3.10` |
| ComfyUI | 任意版本，需带 `UNETLoader` / `LoraLoader` / `VAELoader` / `CLIPLoader` |
| 端口 | ComfyUI `8188`、侧车 `8199`、dsh web `10722` |

以 [VERSION.json](VERSION.json) 为准 —— 这份表是它的副本，改版本只改那一个文件。

## 装了什么，放哪

```
$DSH_HOME\plugins\dsh-comfyui-console\plugin\              插件代码 + config.json
$DSH_HOME\skills\comfyui-cards\SKILL.md                    双卡技能
$DSH_HOME\profiles\<profile>\node_modules\dsh-comfyui-console   → junction 指向上面的插件目录
```

**用户数据不在插件目录里**：`cardsDir`（卡）、`outputDir`（出图）、`workDir`（日志）都在你自己的路径下。升级插件不会动你的卡和数据。

## 仓库不含什么

角色卡 / 风格卡 JSON、LoRA 权重（`.safetensors` / `.ckpt` / `.pt`）、本机 `config.json`（含私人路径）、`lora来源.json` 真件（只发 `lora来源.example.json` 占位版）都不入库。原因见 `VERSION.json` 的 `notIncluded`。

## 开发规则

[SPEC.md](SPEC.md) 是开发规范，全部条款都带编号且**必须能被 `tools/check_all.py` 判定** —— 判定不了的约束不写进规范。三条不变量：

- **I1** 身份只由 `package.json.name` 表达，版本号不承担身份语义
- **I2** 一份源码，多处产出；变体差异只落在表现层
- **I3** 规范必须可判定

`tools/check_all.py` 跑语法、TDZ、client 与源一致性、单测，5 秒内完成，CI（`.github/workflows/check.yml`）每次 push / PR 都跑。

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。让 AI 帮你装 → [START-HERE-AI.md](START-HERE-AI.md)。

## 维护者

见 [.github/CODEOWNERS](.github/CODEOWNERS)。所有改动至少一个维护者 review；身份层、CI、版本号改动必须由 owner 批。

## 许可

[MIT](LICENSE)
