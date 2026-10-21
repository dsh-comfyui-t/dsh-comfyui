# 参与开发 / 多人协作

这个仓库是 **DSH 的 ComfyUI 绘图台插件**。下面是几个人同时改它时唯一需要遵守的规矩。
每条都对应一次真实踩过的坑，不是流程图。

---

## 一、仓库结构

```
dsh-comfyui-console/
  VERSION.json                 ← 版本的**单一真源**，只改这里
  LICENSE
  README.md                    ← 面向使用者
  安装说明-给人看.md
  START-HERE-AI.md
  CONTRIBUTING.md              ← 本文件
  .github/workflows/check.yml  ← 每次 push 自动跑工具检查
  install/                     ← 一键安装 / 校验脚本
  plugin/                      ← 插件本体
    package.json               ← 版本号由 sync_version.py 从 VERSION.json 同步
    expander.py                ← 侧车入口（HTTP 路由分发）
    sidecar_*.py  ×9           ← 侧车模块，按职责拆开
    lib/
      app.js                   ← 界面源码（**主要改这里**）
      presets.js               ← 预置预设 + 视角定义
      dict.js                  ← 中英词库
      workflow.js              ← ComfyUI 工作流解析
      index.js                 ← host 侧（拉侧车、配置迁移）
      client.js                ← **生成物**，由 build_client.py 拼出来，别手改
    docs/生成经验.md            ← 踩过的坑
    tools/                     ← 上游的构建工具（build_client / build_suite / update）
  skills/comfyui-cards/        ← 配套 skill
  tools/                       ← 本仓库的检查工具（CI 用）
    check_all.py
    sync_version.py
    check_tdz.py
    test_theme.mjs
    test_views.mjs
```

---

## 二、三条硬规矩

### 1. `plugin/lib/client.js` 是生成物

它由 `plugin/tools/build_client.py` 把 `dict.js` + `presets.js` + `workflow.js` + `app.js`
拼成一个单文件（DSH 客户端插件只认一个 `./client` 导出，浏览器里没有文件系统）。

**改了 `app.js` / `presets.js` / `dict.js` / `workflow.js` 之后必须重建：**

```bash
cd plugin
python tools/build_client.py          # 重建（自动备份旧文件到 .build-backup/）
python tools/build_client.py --check  # 只比对，不一致退 1
```

**`client.js` 冲突了，不许手合并。** 做法固定：

```bash
git checkout --ours   plugin/lib/client.js     # 或者 theirs，随便
cd plugin && python tools/build_client.py      # 用当前 app.js 等重新生成
git add plugin/lib/client.js
git rebase --continue                          # 或 git commit
```

因为它是确定性拼接，**重新生成的结果永远正确**，手合并只会引入半截代码。

### 2. `plugin/config.json` 绝不入库

里面是**各人自己机器的路径**（ComfyUI 装在哪、日志写在哪）。仓库里只有
`config.example.json`，插件首次加载会照着它自动生成 `config.json`。

`.gitignore` 已经挡了。**如果你看到 `git status` 里有 `plugin/config.json`，说明 .gitignore 被改坏了，立刻查。**

### 3. 提交前必须跑 `tools/check_all.py`

```bash
python tools/check_all.py
```

它会跑：JS/Python 语法 → `client.js` 与源一致 → TDZ → 主题单测 → 视角单测。
**全绿再提交。** CI 跑的是同一条命令，本地漏了也会被打回。

---

## 三、本地怎么把它跑起来

这个仓库**不是** npm 包，是「拷进 DSH profile 的插件目录」这种形态。

```powershell
# 1. clone 到任意位置
git clone <仓库地址> dsh-comfyui-console
cd dsh-comfyui-console

# 2. 建软链（Windows 需要管理员或开发者模式）
New-Item -ItemType Junction `
  -Path  "$env:DSH_HOME\profiles\node_modules\@local\dsh-comfyui-console" `
  -Target "$PWD\plugin"

# 3. 在 profile 的 patch 层注册（一次即可）
#    $env:DSH_HOME\profiles\desktop\cordis.patch.yml 追加：
#      - insert:
#          - id: comfyui-console
#            name: "@local/dsh-comfyui-console"

# 4. 复制一份配置模板，改成你自己的路径
Copy-Item plugin\config.example.json plugin\config.json
notepad plugin\config.json

# 5. 重启 DSH
```

**用软链而不是拷贝**，这样 `git pull` 之后重启 DSH 就是新代码，不用每次手动同步。

改完 `lib/*.js` 后：

```bash
cd plugin && python tools/build_client.py    # 重建 client.js
```

然后重启 DSH（或刷新页面，看 DSH 有没有开 client HMR）。

---

## 四、分支与 PR

小团队（2~5 人）用这个就够，不要上 GitFlow：

| 分支 | 用途 |
|---|---|
| `main` | 永远可运行。**只通过 PR 合入**，不许直接推 |
| `feat/<简短名>` | 一个功能一支，比如 `feat/seed-lock` |
| `fix/<简短名>` | 一个 bug 一支，比如 `fix/sidecar-syspath` |

流程：

1. `git switch -c feat/xxx main`
2. 改代码 → 跑 `python tools/check_all.py` → 全绿
3. 提交（见第五节的信息格式）
4. `git push -u origin feat/xxx`
5. 开 PR，**CI 必须绿**，至少一个人 review
6. 合并用 **Squash merge**（历史干净，回滚是整个功能回滚）

**谁能合并**：合并权收在 1~2 个人手里。不然 `client.js` 和 `VERSION.json` 会天天撞。

---

## 五、提交信息

```
<类型>: <做了什么>

<为什么，以及怎么验证的>
```

类型只用这几个：`feat` / `fix` / `refactor` / `docs` / `chore`

**"怎么验证的"这一行不是客套。** 本仓库出过好几次「看着改对了、装上去就崩」：

- `client.js` 里注册的 factory id 和 `package.json` 的 `name` 不一致
  → 同一份 bundle 被当成两个东西执行两次 → `duplicate factory registration` → 整个 web boot 失败
- 把 `theme` 加进一个在它声明**之前**的 `useEffect` 依赖数组
  → 依赖数组渲染时立即求值 → `ReferenceError: Cannot access 'theme' before initialization`
  → 一点开面板就崩。**`node --check` 语法完全合法，查不出来。**

所以提交信息里写清「跑了什么、看到什么」，review 的人才知道该信哪部分。

例子：

```
fix: 侧车在 ComfyUI 嵌入式 Python 下起不来

python_embeded 带 python313._pth，解释器处于隔离模式，
不会把脚本目录放进 sys.path[0]（普通 Python 会）。
拆成 9 个 sidecar_*.py 之后就 ModuleNotFoundError，进程 code=1 秒退。

验证：
  用 python_embeded\python.exe 直接跑 expander.py
  修复前 -> ModuleNotFoundError: No module named 'sidecar_util'
  修复后 -> /version 返回 200，stderr 空
```

---

## 六、发新版

版本号**只改 `VERSION.json`**，然后：

```bash
# 1. 改 VERSION.json 的 bundleVersion
# 2. 同步到 package.json 等
python tools/sync_version.py

# 3. 在 plugin/CHANGELOG.md 顶部加一节
# 4. 重新生成清单 + 打包
cd plugin && python tools/build_suite.py

# 5. 检查
python tools/check_all.py

# 6. 提交、打 tag、发 Release
git tag v0.6.2 && git push origin v0.6.2
```

`tools/build_suite.py` 会重算 `MANIFEST.sha256` 并打出 zip。
**包里不允许出现 `config.json` / `*.bak-*` / `*.pyc`** —— 构建脚本会断言，别绕过。

GitHub Release 上附那个 zip，用户就不用 clone 了。

---

## 七、常见冲突怎么解

| 冲突文件 | 解法 |
|---|---|
| `plugin/lib/client.js` | **重新生成**（见第二节），永不手合并 |
| `plugin/lib/app.js` | 正常合并。合完**必须**重建 `client.js` 并且跑 `check_all.py` |
| `VERSION.json` / `package.json` | 取**较大**的版本号，然后 `python tools/sync_version.py` 对齐 |
| `MANIFEST.sha256` | 别手改。`build_suite.py` 会重算 |
| `CHANGELOG.md` | 两边都保留，新的在上；同版本的两节合并成一节 |

---

## 八、这个仓库的几个特性，改之前先知道

1. **客户端 bundle 的注册 id 必须等于 `package.json` 的 `name`。**
   `lib/client.js` 第 14 行是 `window.__ModuleLoader__.load({ id: "..." })`，
   `build_client.py` **原样保留包装头**，不会帮你同步。改了包名就得手改这一行。

2. **侧车用的是 ComfyUI 自带的 `python_embeded`**，它是隔离模式（`python313._pth`）。
   `expander.py` 顶部已经把脚本目录塞进 `sys.path` 了 —— **别删那段**，删了侧车必崩。

3. **侧车的 Origin 白名单要认 `dsh-app://app`。**
   DSH 桌面版的渲染进程 origin 不是 localhost，只认 localhost 会让面板每个请求都 403。

4. **`combobox` 类下拉有坑**：ComfyUI 的 `/object_info` 里 COMBO 有**三种**形态，
   只取 `spec[0]` 会遇到 `["COMBO", {options}]` 时返回字符串 `"COMBO"`。
   统一走 `comboOptions()`，别自己取。

5. **出图失败的真正原因在响应体的 `node_errors` 里**，`HTTP 400` 本身没有信息。
   `jpost`/`jget` 已经把 `node_errors` 摊平成可读文本，别退回只抛状态码。

---

## 九、CI 在跑什么

`.github/workflows/check.yml` → `python tools/check_all.py`：

```
1. 所有 .js 的 node --check
2. 所有 .py 的 py_compile
3. plugin/tools/build_client.py --check     client.js 与源是否一致
4. tools/check_tdz.py                       hook 依赖数组的 TDZ
5. tools/test_theme.mjs                     调色板 + resolveTheme
6. tools/test_views.mjs                     applyView / detectView
```

全绿才算过。**这几项加起来 5 秒**，但能挡住上面列的绝大多数事故。
