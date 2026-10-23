# Changelog

按时间倒序。这个仓库之前的历史在 [plugin/CHANGELOG.md](plugin/CHANGELOG.md) —— 那是逐版记录，含每版改动和踩过的坑，比这张表细。

## 2026-10-23

- feat: 版本线合并为单线（插件 semver = 套件版本 = 包名 = tag），废弃内部品线 `1.2.x`
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
