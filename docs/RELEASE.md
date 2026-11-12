# A-alpha 分支发布说明

- 仓库：https://github.com/dsh-comfyui-t/dsh-comfyui
- 分支：`A-alpha`（orphan，单提交；不携带 master 的旧历史与 backups 记录）
- 版本：0.7.0
- 目标：**装完就能用**——代码与运行所需资产在同一个分支里，安装时不需要再联网下载资源包

## 分支内容（638 文件，约 340 MB）

| 内容 | 说明 |
|---|---|
| `plugin/lib/`、`plugin/*.py` | 前端 bundle、Sidecar、安装器、路径与兼容层 |
| `plugin/scene3d/models/` 5 个 glb | `catalog.json` 实际引用的模型，共约 48.8 MB |
| `plugin/scene3d/fonts/` | 编辑器字体 427 个文件，约 194 MB |
| `plugin/vocabulary/*.sqlite3` | danbooru 与 translation 词库，约 69 MB |
| `tools/` | 构建、安装、诊断脚本（安装器依赖） |
| `docs/`、`README.md`、`CHANGELOG.md`、`安装说明.md`、`LICENSE` | 面向使用者的文档 |

## 不发布的内容

- **27 个未被 `catalog.json` 引用的模型**（旧版本、备选体形、废弃 rig、无贴图版 deepseek-chan、skeleton、doll 系列），共约 193 MB。
- **天空盒**：`plugin/scene3d/sky/` 不发布。Anima 3D 拍摄窗口使用黑色背景与隐藏的地面/网格，不读取天空贴图；旧 3D 参考功能入口保持隐藏。
- **开发过程文档**：`MAINTENANCE_*.md`、`TEST_REPORT_*.md`、`EDITOR_UI_*.md` 等过程笔记、`tests/`、`maintenance/`、`AGENTS.md` 不进入发布分支（保留在 master）。

## assets.json

A-alpha 的资产随仓库分发，`assets.json` 中 `assets` 为空数组、`tag` 为 `v0.7.0`。安装器检测到空清单后会跳过 `install_assets.py`，直接使用分支内文件。

若将来改回「代码 + Release 附件」模式：恢复 `tools/pack_assets.py` 的 GROUPS 定义、生成 zip 与清单、上传到与 `tag` 一致的 Release，并把 `plugin/scene3d/models`、`fonts`、`vocabulary/*.sqlite3` 加入 `.gitignore`。

## 发布步骤

1. 更新 `package.json`、`plugin/package.json` 的版本与 `CHANGELOG.md`（两份）
2. 若前端源码有改动：`python3 tools/build_client.py && python3 tools/build_client.py --check`
3. 重新生成校验清单：按 `git ls-files` 计算 SHA256 写入 `SHA256SUMS.txt`（排除自身）
4. `git add -A && git commit --amend`（保持单提交）
5. `git push --force-with-lease origin A-alpha`
6. 从远端 clone 复验：`git clone -b A-alpha …` → `sha256sum -c SHA256SUMS.txt` → `bash install.sh --profile <name>` → 重启 DSH

## 校验

```bash
git clone -b A-alpha https://github.com/dsh-comfyui-t/dsh-comfyui.git
cd dsh-comfyui
sha256sum -c SHA256SUMS.txt
```
