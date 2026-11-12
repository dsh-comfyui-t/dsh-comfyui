# DSH × ComfyUI 绘图台

把 [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 接进 DeepSeek Harness 侧栏的本地绘图插件：提示词、模型、工作流、输出、词库和 3D 参考，全在一处。

- 当前版本：**0.7.0**（A-alpha 线）
- 运行环境：DSH 0.2.1+，Python 3.10+
- 支持平台：Windows、WSL、Linux（macOS 未验证）

## 功能

- **工作台**：提示词（正/负向）、模型配置、三态预览、撤回/重做、AI 扩写、权重转语言
- **提示词标签**：中英文自动补全，词库优先中文；按住左键 + 滚轮调权重
- **词库**：SQLite 多语言多义项，搜索/分类/CRUD、导入导出、备份、中文转标签
- **预设**：保存/套用，支持导入 ComfyUI 工作流 JSON
- **在线模型库**：Civitai / Hugging Face / ModelScope / HF-Mirror，搜索、筛选、下载、校验
- **模型库**：浏览本地 models 目录、多选移动、示例图下载、瀑布流看图
- **输出**：渐进加载、分页、WebP 缩略图、多档画质、筛选/搜索/排序
- **全屏 Inspector**：缩放切图、解析 PNG 内嵌工作流、只显示当前链路实际使用的模型
- **图片参数**：比例预设、尺寸/步数/CFG/采样器、保存开关、放大
- **连接与启动**：连接检测、浏览器/后台启动、释放显存、进程树管理
- **Anima 控制**：3D 姿态拍摄、区域色块控制图、ControlNet/LLLite 模型选择
- **离线翻译**：词库优先，未命中走本地翻译模型

## 环境要求

| 依赖 | 说明 |
|---|---|
| DeepSeek Harness | 0.2.1 或更高 |
| ComfyUI | 本机已有（便携版或常规安装均可） |
| Python | 3.10+（插件 Sidecar 用） |
| Node.js | 仅从源码重建前端时需要 |

3D 模型、字体、词库已随仓库分发，安装后即可使用，**不需要**额外下载资源包。

## 安装

### Linux / WSL

```bash
git clone -b A-alpha https://github.com/dsh-comfyui-t/dsh-comfyui.git
cd dsh-comfyui
bash install.sh                 # 安装到当前 DSH profile
# 或指定 profile：
bash install.sh --profile 0.2.1-rc.2
```

`install.sh` 会备份旧插件、复制到 `<DSH_HOME>/profiles/<profile>/node_modules/@local/dsh-comfyui-console`、保留旧 `config.json`、注册 `cordis.patch.yml`，并同步 Sidecar 端口。

### Windows

```powershell
git clone -b A-alpha https://github.com/dsh-comfyui-t/dsh-comfyui.git
cd dsh-comfyui
powershell -ExecutionPolicy Bypass -File install.ps1
```

### 安装后

1. 完整退出并重启 DSH
2. 打开侧栏的「绘图台」
3. 在设置里填写 ComfyUI 路径（见下节），或直接连接已在运行的 ComfyUI

### 卸载

```bash
bash uninstall.sh --profile <profile>
# 或
powershell -ExecutionPolicy Bypass -File uninstall.ps1
```

## 配置

`plugin/config.json` 关键字段（安装时自动生成，也可手动编辑）：

| 字段 | 说明 |
|---|---|
| `comfyRoot` | ComfyUI 安装根目录 |
| `pythonExe` | ComfyUI 使用的 Python |
| `startScript` | Windows 启动脚本（可选） |
| `comfyPort` | ComfyUI 端口，默认 `8188` |
| `sidecarPort` | 插件 Sidecar 端口，默认 `8199` |
| `dataDir` / `dbPath` | 词库 SQLite 位置（留空用用户目录） |
| `credsFile` | DSH 凭证文件（离线扩写读取 API key） |

WSL 用户注意：`comfyRoot` 填 Windows 路径（如 `D:\ComfyUI\ComfyUI_Windows_portable`），插件会自动做路径转换；不要填 `\\wsl$\...` UNC 路径。

## 目录结构

```
plugin/                 运行时插件（安装进 DSH profile 的就是这个目录）
  lib/                  前端：app.js 源码、client.js 构建产物
  scene3d/              3D 编辑器（代码、5 个模型、字体）
  vocabulary/           词库（danbooru / translation sqlite）
  docs/                 插件内文档与教程配图
  *.py                  Sidecar、路径解析、兼容性检查
tools/                  构建、安装、诊断脚本
docs/                   仓库级文档（发布说明、维护手册）
install.sh / install-local.sh / install.ps1     安装脚本
uninstall.sh / uninstall.ps1                    卸载脚本
assets.json             资源清单（当前为空：资源随仓库分发）
```

## 从源码构建前端

前端由多个模块拼接成单个 `plugin/lib/client.js`：

```bash
python3 tools/build_client.py           # 重建
python3 tools/build_client.py --check   # 校验构建产物与源码一致
node --check plugin/lib/client.js
```

## 版本说明

- **0.7.0** 是 A-alpha 线的起点，与旧的 0.6.x 版本线**互不覆盖**。
- 变更记录见 [CHANGELOG.md](CHANGELOG.md)，发布与打包细节见 [docs/RELEASE.md](docs/RELEASE.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。

## 致谢

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [DeepSeek Harness](https://github.com/deepseek-ai)
- 上游项目 `dsh-comfyui-t/dsh-comfyui` 的维护者与贡献者
- Anima ControlNet-LLLite 模型作者 toyxyz
