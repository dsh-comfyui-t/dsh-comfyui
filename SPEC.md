# dsh-comfyui-console 开发规范

> 这份文档管的不是"功能怎么实现"，而是**"为什么装了哪一份都能用"**。
>
> 每一条都有编号（S1、S2…），**每一条都必须能被 `tools/check_spec.py` 判定**。
> 判定不了的条款不写进来 —— 散文不叫规范。

版本：适用 1.0.0 及以后。2026-10-21 立。

---

## 0. 三个不变量

其余所有条款都是从这三条推出来的。**这三条永不变，变了就不是这个插件了。**

**I1 · 身份只由 `package.json.name` 表达。**
版本号只表达"代码新不新"，**永不用来表达"这是谁的构建"或"这是哪个变体"**。
理由：`dsh` 的 `update` 机制比较版本号决定是否升级。用 patch 号当身份 →
三个人会互相静默覆盖（`1.0.2 > 1.0.0`，装 1.0.0 的人被升成别人的构建且不自知）。

**I2 · 一份源码，多处产出。**
三个变体不是三份代码，是**同一份 `plugin/` 按 `variants/*.json` 生成三份产物**。
差异只能落在 `lib/designs/`（表现层与默认值），不能落在身份层。

**I3 · 规范必须可判定。**
任何约束如果不能被脚本判定，就等于没有。`check_spec.py` 是这份文档的执行体。

---

## 1. 身份与版本

| 编号 | 条款 | 判定方式 |
|---|---|---|
| **S1** | `package.json.name` 是插件唯一身份 | 存在、非空、形如 `@scope/name` 或 `name` |
| **S2** | 版本号不含任何变体/作者信息 | `version` 匹配 `^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$`，且 `variants/*.json` 里无 `version` 差异化字段承担身份语义 |
| **S3** | `version` == `VERSION.json.bundleVersion` | 两文件比对 |
| **S4** | 所有变体的 `version` 相同 | 遍历 `variants/*.json` 比对 |

**四处一致（S5）—— 这一条踩过两次，各自都是整插件不激活：**

| # | 位置 | 漏改的症状 |
|---|---|---|
| 1 | `package.json` → `name` | 基准 |
| 2 | `lib/index.js` → `export const name` | 按标准方式装不上，只有 profile patch 硬指才work |
| 3 | `lib/client.js` → `__ModuleLoader__.load({ id })` | `loaded without registering "<name>"`，整个 web boot 失败 |
| 4 | `cordis.patch.yml` → `insert: name` | patch 里指向不存在的包 |

| 编号 | 条款 | 判定方式 |
|---|---|---|
| **S5** | 上述四处全等于 `package.json.name` | 四处解析比对 |
| **S5a** | `build_client.py` 必须保留包装头（不重写 id），改名后必须重建 | `build_client.py --check` 与源一致 |

> ⚠️ `build_client.py` 拼接时**原样保留**已有头部，它**不会**帮你同步 id。
> 所以 S5 的第 3 处必须在构建脚本里显式改写，否则永远不同步。

---

## 2. 官方插件契约

| 编号 | 条款 | 判定方式 |
|---|---|---|
| **S6** | `package.json.type == "module"` | 直接读 |
| **S7** | `exports["."]` 指向存在的 `.js`，`exports["./client"]` 指向存在的 `client.js` | 解析 + `existsSync` |
| **S8** | `dsh.client.platform == "web"` | 直接读 |
| **S9** | `dsh.minHost` 存在，且为**已知最低可用**版本字符串 | 存在 + 在允许列表内 |
| **S10** | `dsh.configVersion` 存在且与代码内 `CONFIG_VERSION` 常量一致 | 正则取常量比对 |
| **S11** | `lib/index.js` 导出 `name` / `version` / `configVersion` / `apply` | 源码正则 |
| **S12** | `lib/client.js` 的 `load({ id })` == `name`（同 S5 第 3 处） | 与 S5 合并判定 |
| **S13** | 声明了 `dsh.bundle` → `dsh.bundle.patch` 指向的文件必须存在；**未声明** → README 必须包含手动注册步骤 | 二选一必须成立 |
| **S14** | 包内不得含 `config.json` / `*.bak-*` / `*.pyc` / `__pycache__` / `.build-backup` | 遍历 |
| **S15** | `MANIFEST.sha256` 覆盖包内全部文件，且逐条重算一致 | 重算比对 |

**S13 的现实含义：**
- **有 `dsh.bundle`** → `dsh plugin add` 自动应用 patch，**真正的即装即用**
- **没有** → 用户必须手改 `cordis.patch.yml`，README 里必须写明这三行，否则装完面板不出现

---

## 3. 变体声明

`variants/<id>.json`，一文件一个变体。

```jsonc
{
  "id": "lqh",                                  // 必填，文件名一致
  "name": "@local/dsh-comfyui-console-lqh",     // 必填，互不相同，且是最终 package.json.name
  "label": "涟崎桦版",                           // 必填，面板显示
  "design": "lqh",                              // 必填，对应 lib/designs/<design>.js
  "default": true,                              // 可选，至多一份为 true
  "differs": "一句话说清和别的差在哪",             // 必填，人读
  "prereq": ["comfyui-installed", "python-embed"], // 必填，机器可校验的前置条件
  "excludeFiles": []                            // 可选，仅当功能确有取舍时使用
}
```

| 编号 | 条款 | 判定方式 |
|---|---|---|
| **S16** | 每个 json 必含 `id`/`name`/`label`/`design`/`differs`/`prereq` | 字段检查 |
| **S17** | `name` 互不相同 | 集合去重 |
| **S18** | `default: true` 至多一份 | 计数 |
| **S19** | `design` 对应的 `lib/designs/<design>.js` 存在 | 文件检查 |
| **S20** | `excludeFiles` 里的路径在 `plugin/` 中真实存在（防止写错名字静默不删） | 逐个检查 |

**允许的差异（白名单）：** 布局、配色、默认参数、提示词模板、按钮顺序、文案。
**不允许的差异：** 身份（`name`）、通信契约、数据存储键（`dsh-comfyui-console/v1` 必须一致，否则换变体丢存档）。

> **S20a · 存档键统一。** 所有变体必须用同一个 `localStorage` 键。
> 否则用户从 A 版换到 B 版，角色卡、预设、上次参数全部消失。
> 判定：`lib/app.js` 里 `LS_KEY` 的字符串值，跨变体一致。

---

## 4. 可安装性

| 编号 | 条款 | 判定方式 |
|---|---|---|
| **S21** | `config.json` 缺失时必须能自举：从 `config.example.json` 生成 + 自动探测 ComfyUI 路径 | `lib/index.js` 里存在 `bootstrapConfig` 与路径探测候选表 |
| **S22** | `prereq` 里出现的每个标识符，都必须在 `tools/check_spec.py` 的 `PREREQ_CHECKS` 里有实现 | 键集合比对 |
| **S23** | README 必须写明：最低 DSH 版本、ComfyUI 前置、`--enable-cors-header`（若变体走浏览器直连） | 关键词存在性 |
| **S24** | 打包产物文件名必须含 `version` 与 `variant id`（同版本多份时靠文件名区分） | 文件名模式 |

---

## 5. 变更纪律

**改 `name`（罕见，等于换插件）**
1. 四处一起改（S5）
2. 所有 `variants/*.json` 一起改
3. 重建 `client.js`
4. README 写迁移说明（旧名 → 新名，存档键不变所以数据不丢）
5. `python tools/build_client.py && python tools/check_spec.py`

**加/改变体**
只动 `variants/<id>.json` + `lib/designs/<id>.js`。**不许碰 `plugin/` 的身份层。**

**加功能**
只动 `plugin/lib/`。**不许碰身份层，不许碰 `LS_KEY`。**
加完必须跑 `check_all.py`（语法 + client 一致 + 四名一致 + TDZ + 单测）。

**改 DSH 相关契约**（`apply` / `inject` / slots）
只准**加**，不准**改**。要改就说明为什么旧的必须废弃。

---

## 6. Agent 安装判定

`AGENTS.md` 里写死这套流程，agent 不许多走一步：

```
1. 读 variants/*.json，列出所有变体（id / label / differs / prereq）
2. 用户明确指定了 id  →  用它
3. 用户没指定          →  用 default: true 的那份
4. 没有 default 或多份  →  停下来问用户，**不许自己挑**
5. 校验选中变体的 prereq：
      不满足 → 报告缺哪一项、怎么补，**不许硬装**
6. 校验是否已装其他变体：
      已装 → 报告并让用户选择（覆盖 / 并存），**不许静默覆盖**
7. 装完跑 check_spec.py 对这个变体自检，通过才报告成功
```

**为什么第 4 条和第 5 条是硬的：**
三份功能相同时，"选哪份"没有客观依据。没有 `default` 就让 agent 挑，
它会在三份都对的情况下随机选一份**然后编一个理由**——这是最坏的失败方式：
装错了还能自圆其说。第 5 条同理：prereq 不满足时装上去，面板会空白且不报错。

---

## 7. 判定项总表

`tools/check_spec.py` 必须实现的判定：

```
身份与版本    S1 S2 S3 S4 S5 S5a
官方契约      S6 S7 S8 S9 S10 S11 S12 S13 S14 S15
变体声明      S16 S17 S18 S19 S20 S20a
可安装性      S21 S22 S23 S24
------------------------------------------------
合计 26 条
```

任何一条不过 → 构建失败，不出包。

---

## 8. 这份文档什么时候该改

只在这三种情况下改：

- 发现一条**新的、会导致装了不能用**的坑 → 加一条 S
- 官方契约变了 → 改第 2 节，并注明 DSH 版本
- 上述三条不变量被证明不成立 → **推翻重写**，不是打补丁

**不因为"某个功能想换个写法"改这份文档。**
