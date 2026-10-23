# CHANGELOG · dsh-comfyui-console

版本号语义：`MAJOR.MINOR.PATCH`。
`package.json` 里的 `dsh.configVersion` 是**配置结构版本**，与插件版本独立——插件小版本升级通常不涨它。

> **版本口径（2026-10-23 起）**：只有一条线。本文件顶部的插件号即套件版本、即发行包名、即仓库 tag（`v0.7.92`）。
> 此前并行的内部品线 `1.2.x` 已废弃；历史条目里残留的「本线」标注已在本轮清除，个别正文若还提到旧编号，仅作考据。

## 0.7.92 · 2026-10-23 · 合并记账 0.7.53–0.7.92

> 0.7.53 到 0.7.91 这 39 个号当时只改了 `package.json`，没逐条写本文件；本条一次性补账，细节以 git 历史为真源。
> 同时修掉发布前清单 P0-1：`dsh.update.inPlace` 补 `sidecar_dirs.py`、`sidecar_loras.py`、`tools/build_client.py`——前两个是运行必需，缺任一个就地升级后 `expander.py` import 兄弟模块即 `ModuleNotFoundError` 秒退（与 0.6.1 同型坑）。

- **全量卡包**：`/stylecards/pack` 支持 `toDisk` 落盘，卡包里内嵌 LoRA 权重、LLLite patch、控制图、封面；`/stylecards/unpack` 按 `dest` 还原（缺 `dest` 默认落 `lora`），并重建 `lllite-index.json`
- **封面**：封面随卡包走，导入后卡片网格不再掉封面
- **LLLite 卡级绑定**：`conditioning.presets` 按档位选权重（closeup → v2-400，full/side → v3-400）+ `conditioning.weights` 索引；卡包内缺权重时明确报错，不静默降级
- **词库卡**：`lib/dictcard.js` 并入 `client.js`，词库支持正/负/自词性、分类拖拽、JSON 导入导出
- **目录即真相**：卡片网格一卡一文件镜像磁盘；清空/删除走 `_清空备份-<时间戳>`，不硬删
- **控制台**：绘图台只修 bug，不做功能迭代（0.7.53 起约定）
- **脱敏**：干净分发件新增两处替换（画师名 `もちづきけい` → `画师A`、文档示例路径 `D:\dsh\` → `D:\你的工作区\`）

## 0.7.52 · 2026-10-22

### 三类卡片都能「打开文件位置」

- 侧车新增 `POST /reveal`（`_reveal_card_target`）：body `{kind, path}`；`path` 存在就 `explorer /select` 选中它，否则按 `kind` 打开目录（不存在则先建）：`cards` → `cardsDir`，`style` → `本地绘画\画风`，`dict` → `本地绘画\词库`。仅允许落到这几个根目录下的既有路径。
- 前端 `revealCardFile(kind, path)`（模块级）统一调用，结果走 `MSG`。
- 角色卡：编辑器底部新增「打开文件位置」（磁盘卡选中它的 JSON；还没落盘的卡打开 cardsDir），卡片区工具栏新增「打开文件夹」。
- 风格卡：编辑器底部新增「打开文件位置」（风格卡在浏览器本地，这里打开 .json/.dslcard 卡包该放的 `本地绘画\画风`）。
- 词库：卡片区工具栏新增「打开文件位置」（`本地绘画\词库`）。

## 0.7.51 · 2026-10-22

### 去掉编辑页底部操作栏的 sticky

0.7.49 把操作栏做成 `position: sticky; bottom: 0`，在 `S.wrap`（height:100% + overflowY:auto）这类定高滚动容器里会被**向上拉到 scrollport 底边**，压在词条列表中间，看起来像「保存那排插在负面词里」。改成普通流内末行（`flex: 0 0 auto`），仍是根列最后一个子元素，滚到内容末尾即可见；根底部留 6px 白。

结构不变（0.7.49 的括号修复保留）：标题行只包标题，字段行与操作栏都是根列直系子元素。

## 0.7.49 · 2026-10-22

### 真因修正：编辑页「资产与迁移」整块被塞进一条横向行里（0.7.48 只治了症状）

**实测证据**：括号配平扫描显示，`h("div", { display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" }`（原意只是「资产与迁移」这个小标题行）**没有在标题后闭合**，继续吃进了后面 40 行——「底模 / 训练记录 / 回归锚 / 自检」四个字段行，外加底部的保存·取消·删除按钮。于是：

- 一整块字段被排进一条横向 flex 行，每个子项被压到最小宽度 → 中文变成一列一列的字（截图里「资产与迁移（可选 · 让这张卡能跨机器…）」竖着排）
- 底部按钮也在这个横向行里，滚动区里根本轮不到它 → 「保存·删除那排消失」

**改法**：标题后补 `)` 让标题行自闭合（只包住标题），末尾删掉对应的多余 `)`。字段行与底部操作栏回到根列的直系子元素，竖向堆叠恢复正常；0.7.48 的 sticky 操作栏与 `row` 不压缩这次才真正生效。

## 0.7.48 · 2026-10-22

### 修：角色卡 / 风格卡编辑页最下面的「保存·删除」那排不见了、文字挤在一起

**根因**：角色卡编辑器底部那 6 个元素是**直接挂在根列容器末尾的散件**（风格卡虽是一行但缺 `flexWrap`），而外层 `S.wrap` 是 `height:100% + overflowY:auto` 的定高滚动容器；内容一多（这轮加的胶囊词性、特征锁、资产与迁移、回归锚），定高列里的 flex 子项**默认允许收缩** → 字段行被压扁（文字挤在一起），末尾按钮被压成 0 高度（那排消失）。

**改法**

1. 两个编辑器的底部按钮收进一条显式操作栏：`position: sticky; bottom: 0` + 上边框 + `var(--c-card)` 底色 → 滚动时始终贴底可见；`flexWrap: wrap` 窄窗口自动折行；每个按钮 `flexShrink: 0`，文字不再被挤。
2. 字段行样式 `row` 加 `flexWrap: "wrap"` + `flexShrink: 0`（角色卡 / 风格卡两份都改），定高容器压不扁行。
3. 编辑器根加 `width: "100%"` + `minHeight: 0`。

## 0.7.47 · 2026-10-22

### 修：磁盘上的角色卡从来进不了界面（报告 2026-10-22 第二条）

**根因**：`allCards()` 只遍历 `USER.cards`（localStorage），全文对 `/cards` 只有 `write` / `validate` / `import` 三处调用，**没有列表读取**。侧车扫好 `cardsDir`、排好 mtime，前端一次都没消费 → 磁盘上的卡等于死文件。

**改法**：

1. 新增模块级 `syncCardsFromDisk()` + `mergeDiskCards()`：面板挂载 1.2 s 后自动拉 `/cards`，空结果或失败 2.5 s 重试一次，最多 6 次。
2. **合并口径**（可预期、可解释）：磁盘卡打 `fromDisk: true` + `file`（原 `__file`），同一张以磁盘为准；界面手工建/手工导入的卡同名时**不覆盖**，计入「保护跳过」；磁盘文件删掉 → 对应 `fromDisk` 卡从面板移除。提示条固定输出「磁盘同步（目录）：N 张 · 新增 a · 更新 b · 保护跳过 c · 移除 d」。
3. 角色卡工具栏加 **「重扫磁盘」**：手动拉一次，`force` 下一定会给结果（含 `cardsDir` 未配置 / 目录不存在的原文错误）。

### 修：桌面版（Electron）里「导入」与拖拽都不动作

- `display:none` 的 `<input type=file>` 换成 **透明 overlay 覆盖按钮**（`position:absolute` + `opacity:0` + `cursor:pointer`），不再依赖 label 代理。
- 新增 **「粘贴 JSON」** 弹层：整张卡 / 卡数组 / `{cards:[…]}` 都能进，走同一条 `applyCardImport` 通道，不依赖任何文件 API。这是最后的安全网。
- **导入必须看得见反馈**：拿到文件先提示「收到文件：name（N KB），正在解析…」；没拿到文件提示「这个环境没弹文件对话框…用粘贴 JSON 或重扫磁盘」；拖拽时 `dataTransfer.files` 为空也单独提示。

### 说明

- 数据格式没变：`USER.cards` 仍是唯一存储，新增的 `fromDisk` / `file` / `diskDir` 只是标记，旧存档照常读。
- 手工改一张磁盘卡 → 保存会 `/cards/write` 写回原文件；下次磁盘同步拿到的是磁盘版本，与手改一致。

## 0.7.46 · 2026-10-22

### 加：编辑界面直接看得见、点得到每颗胶囊的词性（新建卡片同样）

1. **胶囊芯片自带词性小标**：芯片最前面一枚 `正 / 负 / 自` 小标，**点一下循环 自 → 正 → 负 → 自**，立刻写 `USER.capPol`，不用先进内联编辑。负向的芯片边框同时变红，一眼能扫。
2. **芯片正文点开编辑**（改中文备注 / 英文标签），内联编辑里仍是三键；两处改的是同一份数据。
3. **加新胶囊那行带三键**：`中文备注 | 英文标签 | 正 负 自 | [加]`，先选词性再回车／点加，新胶囊直接带上词性（`pushTag(cn, en, pol)` → `setCapPol`）。不选＝自（插入时按正向）。
4. **新建卡片同样生效**：新建弹层与编辑弹层是同一个组件，选完分类、填完中文，胶囊行一样带小标和三键，创建出来的卡片词性已就位。
5. 弹层内改词性会即时重画自己，并通过新 prop `onChanged`（= `repaint`）通知词库卡片区，底部的「选中池」计数 `(2负/5)` 同步更新。

### 修：`dictCardTargetCat is not defined`

新建卡片的分类下拉会调 `dictCardTargetCat()`，它和 `PR_HOME_CAT` 原本也落在 `genTab` 的嵌套作用域里（与上一版修掉的 `capNoteOf` 同类问题）。两个都提到模块级（`allLib()` 之后），`dictcard.js` 直接调用不再报错。

### 测试

- 新增 `D:/dsh/日志/smoke-dictcard.js`：假 loader + 假 React 真渲染三条路径——编辑已有卡 / 新建卡 / 带词性的输入行（外加 `PolKeys` 单测），全部 `渲染 OK`。
- `日志/probe-client-scope.js` 仍全绿（`capNoteOf`/`PolKeys`/`DictCardEditor`/`CapPairInput` 皆 `function`）。

## 0.7.45 · 2026-10-22

### 修：`capNoteOf is not defined`（词库卡片一渲染就炸）

**根因**：`capPolOf` / `setCapPol` / `tagIndex` / `capNoteOf` / `setCapNote` 这五个助手虽然写在 app.js 的顶格位置，但它们在文件里的位置落在 `genTab` 的**嵌套作用域**内（app.js 里 `condForSave`、`PR_HOME_CAT`、`dictCardTargetCat` 这些顶格声明的行首深度都是 1，是早期遗留的错层）。`lib/dictcard.js` 的两个组件在**模块级**，引用 `capNoteOf` 时作用域链里没有这个绑定 → 渲染即 `ReferenceError`。

**修法**：把这五个助手整段搬到 `allLib()` 之后（真正的模块级，行首深度 0）。现在模块级与 `genTab` 内部都能看到同一份实现，无重定义。
- 顺带确认 `dictcard.js` 依赖的 `h` / `S` / `capNoteOf` / `setCapNote` / `capPolOf` / `setCapPol` 全在模块级可见。
- 新增回归探针 `D:/dsh/日志/probe-client-scope.js`：用假 loader 跑一遍 `client.js`，在模块级打印这些标识符的 `typeof`，全为 `function`/`object` 才算过（这次就是靠它定位的）。

### 说明

- 没有改任何功能行为；`genTab`/`libTab` 内部原有的错层（`condForSave` 等顶格声明）**保持原样**——它们互相可见、工作正常，动它们风险大于收益。

## 0.7.44 · 2026-10-22

### 改：词性单位从「卡片」搬到「胶囊」

1. **卡片不再有正负词性**。卡片角标（正/负/·）、左侧 4px 色条、按极性上色的边框、双击面板里的「极性」一行，全部去掉；`openEdit` / `addCard` / `saveEdit` 里的 `p` 字段一并清掉。
2. **词性挂在胶囊上**：新存档键 `USER.capPol[小写英文标签] = "pos" | "neg"`，没记＝未标（插入时按正向算）。读写在 `capPolOf(tag)` / `setCapPol(tag, v)`。**按标签全局生效**，同一颗标签换到哪张卡、哪个分类都一样。
3. **编辑器里怎么标**：胶囊芯片前多一个小圆点（红＝负、蓝＝正、灰＝未标）；点胶囊进内联编辑，除了中文备注 / 英文标签，多了 `正 / 负 / 自动` 三键，点了立刻落盘。
4. **插入按胶囊词性分流**：选中池由 `{pos:[], neg:[]}` 两栏合成一维数组，原来两个插入按钮合成一个「插入提示词（按胶囊词性）」——把选中卡片的所有标签摊平去重，`capPolOf === "neg"` 的追加到**负面**，其余追加到**正向**，两栏原有内容都不动。提示报「已插入：正向 N 个、负面 M 个」。
5. **顶部筛选口径跟着变**：`全部 / 纯正向 / 含负面` —— 纯正向＝这张卡一颗负面胶囊都没有，含负面＝至少一颗；不再是按卡片极性过滤。
6. **导出 / 导入改 `tagPol`**：包结构仍是 `dsh-dict-cards v1`，`cards[]` 去掉 `polarity`，新增顶层 `tagPol: { 英文标签: "pos"|"neg" }`；老文件里的 `cards[].polarity` 在导入时摊到该卡每颗胶囊上，不会丢。

### 清理

- 删掉卡片级词性的死代码：`dictPolKey()` / `dictPolarity()` / `dictSetPolarity()`，以及 `dictMoveEntry()` 里随分类搬极性键的那段。
- 旧存档里的 `USER.pol`（卡片极性）留在 localStorage 里不主动清，代码已不再引用；想回收就在控制台 `localStorage` 里删键。

## 0.7.43 · 2026-10-22

### 加：小卡片可拖拽（改顺序 / 换分类）

1. **拖动卡片改顺序**：卡片 `draggable`，拖到同分类另一张卡的上/下半边＝插到它前/后（按 `getBoundingClientRect` 中点判前插还是后插）。顺序写进新存档键 `USER.order[分类] = [中文名…]`，`dictGroupItems()` 出口统一过 `dictOrdered()` 排序 —— 没被拖过的卡按原顺序排后面，内置分类和自建分类同一套口径，`lib/dict.js` 一行不动。
2. **拖到分类 chip 换分类**：`dictMoveEntry(srcCat, cn, en, dstCat)`
   - 自建卡：从 `USER.frags[src]` 里 `splice` 出来再 `push` 到目标分类（真搬）；
   - 内置卡：目标分类里建一张自建卡，同时在原分类写 `USER.hidden`（`builtinKey` + `dictOrigCn`）隐藏原件 —— 等于「搬走」，不会出现两张；
   - 极性键 `dictPolKey(src, cn)` 跟着搬到目标分类；`USER.order` 里旧名字清掉，防止串位。
3. **拖到另一张卡（跨分类）**：先搬分类再排到那一位，一次动作两步都落盘。
4. **视觉**：拖动时目标卡片描绿色 2px 内阴影、目标 chip 描绿色虚线；松手后 `saveUser()` + `repaint()`，并提示「顺序已记下（分类 第 N 位）」或「「卡」→「目标分类」」。
5. **「全部」不能当目标分类**：拖到 `全部` chip 上只提示「集合视图，不能当目标」，避免把卡搬进一个不存在的分类。

### 说明（口径）

- 在「全部」视图里：同分类之间拖＝排序，跨分类拖＝搬运，和具体分类里行为一致。
- 顺序只影响词库视图；提示词插入顺序仍由选中顺序决定，不受影响。

## 0.7.42 · 2026-10-22

### 封装：词库小卡片组件独立成段

1. **新文件 `lib/dictcard.js`**，独占 client.js 的一段：
   - `CapPairInput(props)`：一颗「中文备注 + 英文标签 + 按钮」的输入胶囊。草稿 `cn` / `en` 由组件自己 `useState` 管，提交后自动清空；`Enter`/`,` 提交、`Escape` 取消、空着按退格走 `onEmptyBackspace`、失焦走 `onBlur`。
   - `DictCardEditor(props)`：整张卡片的编辑弹层（中文名 / 胶囊区 / 极性 / 保存·导出这张·删除·取消 / 原→现对比）。胶囊的解析、去重、增删、内联改名全部搬进组件内部（`tags`、`pushTag`、`dropTag`、`commitCap`、`capIdx`），libTab 不再持有 `tagIn` / `noteIn` / `capIdx` / `capCn` / `capEn` 五个 state。
   - 组件只管显示与草稿，落盘仍由 libTab 的回调做：`onSave` / `onDelete` / `onExportThis` / `onPolarity` / `patch`。
2. **构建链跟着改**：`build_client.py` 的 `SOURCES` 加 `dictcard`（顺序 `dict → presets → workflow → dictcard → app`），`lib/client.js` 里补一行分段标记 `// ==== 词库小卡片组件（来自 lib/dictcard.js）====`。五个 lib 文件仍然拼成一个单文件工厂作用域，浏览器侧不需要 `require`。
3. **`cardTargetCat` 提成模块级 `dictCardTargetCat(grp)`**：组件和 libTab 都要用，原来只活在 libTab 里。
4. libTab 本段从 28,594 → 约 19k 字符；`client.js` 345,506 → 345,202（含新组件与注释，净减 304）。

### 行为变化（一处，说明）

弹层里原来「任意输入框按回车就直接保存」，会把胶囊输入框的回车也吃掉；现在统一为 **`Ctrl+回车`（或 ⌘+回车）保存**，`Esc` 取消，提示语已写明。其余交互与 0.7.41 一致。

## 0.7.41 · 2026-10-21

### 审查 + 精简（词库/胶囊这一段）

1. **删死字段 `ready`**：全分类实装后没有任何地方读它（`chipOne` 的三处三元都改回固定值了），`BUILTIN_GROUPS` 8 条 + `dictGroups()` 的 `all` 组 + libTab 的 fallback 组一共 10 处 `ready` 清掉，`grep ready` 归零。
2. **删重复映射 `TAG_CN` / `tagCnMap()`**：`capNoteOf()` 已经是「用户备注 → `tagIndex()` 中文」的更完整版本，`TAG_CN` 只剩一处「删胶囊」提示语在用，改成 `capNoteOf(tk)` 后把 `tagCnMap()` 与 `const TAG_CN` 一起删掉（-14 行）。
3. **`cardVer` → `useReducer`**：`cardVer` 这个 state 的值从来没被读过，只是靠自增触发重画。改成 `const [, repaint] = React.useReducer((x) => x + 1, 0)`，顺带删掉 `const repaint = () => setCardVer(...)` 一行，调用点全不用改。
4. **两个「中文备注 + 英文」输入组合并成 `capPair()`**：内联改胶囊（确定/删掉）和末尾「继续加」（加）原来是两份几乎一样的 JSX（各 ~40 行，键位处理重复），抽成一个 `capPair({cn, setCn, en, setEn, btn, onCommit, onCancel, onDrop, onEmptyBackspace, onBlur, grow, accent, key})`，两处各 5 行。空块体 `<span>` 里残留的游离逗号也一并清掉。
5. **渲染里少算 3 次 split**：`editorPanel()` 改成块体，开头 `const tagsNow = e2tags();` 一次算清；`e2tags()` 在 libTab 里的调用从 7 次降到 4 次（剩下的是事件回调里必须现算的）。
6. 块体化后把 editorPanel 的 102 行缩进补齐（原来是箭头表达式，少一层 tab）。

### 已知未动（说明一下，不是漏了）

- `libTab` 本体仍有 28.6k 字符，`cell()` / `capRow()` / `editorPanel()` 三块还能再拆成独立组件，但会动到 hook 顺序与 `TagBoundary` 结构，收益小于风险，先不动。
- `zhOf()`（角色卡 `CARD_ZH`）与 `capNoteOf()`（词库 `tagIndex`）是两套数据源，名字像但语义不同，没有合并。

## 0.7.40 · 2026-10-21

### 加

1. **小卡片可分发：导出**。工具栏新增「导出」：勾选过卡片就导出勾选的（文件名 `词库卡片-选中-N.json`），没勾就导出当前分类当前的搜索结果（`词库卡片-姿势-42.json`）。卡片编辑器底部新增「导出这张」，只导当前这张卡。
   - 文件是 JSON：`{ kind: "dsh-dict-cards", v: 1, at, cards: [{cat, cn, en, polarity}], notes: { 英文标签: 中文备注 } }`，复用现成的 `downloadText()`。
2. **小卡片可分发：导入**。工具栏新增「导入」（`<label>` 包 `<input type="file">`，不占工具栏布局）：读 `.json` 后合并进 `USER.frags` —— 分类内中文同名＝覆盖提示词（`updated`），没有的新建（`added`），中文或英文为空的跳过；`polarity` 一起带进来（`dictSetPolarity`）；`notes` 写 `USER.capNote`。完成后 `saveUser()` + `repaint()` 并报「导入 N 张：新建 a · 覆盖 b · 跳过 c · 备注 d」。
3. 兼容旧格式：文件本身是数组时也认（`Array.isArray(obj) ? obj : obj.cards`）。

## 0.7.39 · 2026-10-21

### 加

1. **新增固定分类「全部」**，排在分类 chip 第一个：`dictGroups()` 最前面 unshift `{ key: "all", name: "全部", all: true }`，`dictGroupItems()` 里 `all` 分支遍历 `Object.keys(allLib())`，把每个分类的词条并起来（同「中文+英文」去重）。配合顶部 `全部 / 只正 / 只负` 筛选和搜索框，等于「全库视图」。
2. **不可删除 / 不可隐藏 / 不可改名**：`dictDeleteGroup()` 开头 `if (g.all) return false;`；右键 `groupMenu()` 直接提示「固定分类」；chip 上不渲染 `×`；`USER.groupHide` 里也不会出现 `all`，所以「恢复分类」不受影响。
3. 新建卡片时若当前停在「全部」，落盘分类走 `PR_HOME_CAT`（自加词），不会造出一个叫「全部」的真实分类；编辑器里的分类下拉已把「全部」排除。

## 0.7.38 · 2026-10-21

### 改

1. **「继续加」升级成一对输入：中文备注 + 英文标签**。原来是单输入框只能填英文，备注要靠后面再点胶囊补；现在是一颗虚线胶囊里两个格子：
   - 左：`中文备注`（可不填，留空就用词库里的中文名）；右：`英文标签，回车添加`；
   - `Enter`（任一侧）或点右侧「加」→ 一次性加一颗：英文进 `e2`，中文立即写 `USER.capNote[标签]`（`saveUser()`），**创建卡片时就带上备注**；
   - 英文里粘 `a, b, c` 会拆成多颗，备注一起套用；输入框空着按退格仍删最后一颗；失焦有残留英文自动入胶囊。
2. 说明文案改「一颗胶囊 = 中文备注 + 英文标签；下面一对输入框填好回车即添加」。

## 0.7.37 · 2026-10-21

### 改

1. **词库卡片胶囊带中文备注**：胶囊显示「中文备注」，取词顺序＝用户手填（`USER.capNote[小写标签]`）→ 词库词条中文名。左键点胶囊就地展开两个小输入框（中文备注 / 英文标签）+「确定 / 删掉」，`Enter` 确定、`Esc` 收起；改英文时旧标签的备注自动清掉。`×` 删胶囊同时清备注。
2. **新建卡片后弹层不关**：点「创建卡片」落盘（`USER.frags[cat].push([中文, e2])`）后，弹层当场转成「编辑这张卡」的形态（`isNew` 去掉），可以**继续往里加新胶囊**；后续保存走 `dictRenameEntry(cat, 中文, 中文, e2串)`，只更新这张卡的提示词本体。
3. **已有卡后续加胶囊**：双击卡片 → 弹层里末尾虚线输入框回车/逗号即可追加；备注跟着 `USER.capNote` 存，重开弹层还在。
4. **生成页胶囊同步显示这些备注**：`prRow` 的中文来源由 `TAG_CN` 改为 `capNoteOf()`（手填优先、词库兜底），词库里改的备注在生成页胶囊上直接看得到。

## 0.7.36 · 2026-10-21

### 改

1. **词库卡片编辑弹层：提示词本体改小胶囊制**（参照角色卡的标签胶囊）。原来的 3 行 textarea 换成一个胶囊区：
   - 一颗胶囊 = 一个英文标签，圆角 `999px`、细边、超长自动省略号；点 `×` 删这一颗；
   - 末尾是虚线胶囊输入框：**回车 / 半角逗号 / 全角逗号** 入胶囊，一次粘贴 `a, b, c` 自动拆成三颗；输入为空时按退格删最后一颗；失焦有残留文字自动入胶囊；
   - 去重保序（`Array.from(new Set(...))`），落盘仍是逗号串 `e2`，`saveEdit` / `dictRenameEntry` 口径不变。
2. 编辑弹层说明文字改为「一颗胶囊 = 一个英文标签；回车或逗号入胶囊，点 × 删掉」；`Esc` 关闭、`Enter` 不再误触发保存（已 `stopPropagation`）。

## 0.7.35 · 2026-10-21

### 改

1. **新词库「加词」升级为「创建新卡片」**：原来「＋ 词条」是连点两个 `window.prompt`（先中文后英文），填错只能重来、也看不到分类和极性。现在点「＋ 新卡片」直接开编辑器弹层：
   - 顶部标题「新建卡片」；多一行**分类下拉**（列出当前所有大分类，选项带真实落盘分类名，内置组写回它的源分类）；
   - 中文名 + 提示词本体（英文，逗号分隔）；
   - 极性三档（正向 / 负面 / 自动）——新建时只记在弹层里，点「创建卡片」才调用 `dictSetPolarity`；
   - 底部按钮变「创建卡片 / 取消」，不出「删除」；不显示「原 → 现」预览；Esc 取消、回车/`Ctrl+回车` 保存。
2. **落盘口径不变**：保存写 `USER.frags[分类] = [...已有, [中文, 英文]]`，再 `saveUser()`；`lib/dict.js` 内置词表一个字没动。同分类同中文重复会拦下并提示。
3. 空态文案改「点「＋ 新卡片」建一张」。

## 0.7.34 · 2026-10-21

### 加

1. **词库新版全分类实装**：`BUILTIN_GROUPS` 八组（姿势 / 表情 / 服饰 / 构图 / 场景 / 质量 / 风格 / 负面）全部 `ready: true`，不再是试水版只有「姿势」。`dictGroupItems()` 本来就按 `src` 逐分类取词并去重（同中文同英文只留一条），所以其余分类直接可用。
2. **清掉试水痕迹**：分类 chip 去掉「·待开放」与虚线边框、点击不再弹「试水版…点旧版」提示；底部统计去掉「· 试水」；文件头注释改为「全分类实装」。
3. 「旧版」按钮与 `◂ 新版卡片` 入口保留，两种界面随时互切。

## 0.7.33 · 2026-10-21

### 修

1. **词库切到旧版回不来**：`libTab` 里 `if (!cardMode) return h(libTabLegacy, { onBack: ... })`，但 `libTabLegacy()` 定义没有形参、内部也不渲染返回按钮，`onBack` 白传——旧版界面里根本没有回新版的入口。
   - 改成在 `libTab` 里包一层固定头部：`◂ 新版卡片` 按钮 + 说明「当前是旧版树状词库；点左边按钮随时切回新版」，下面才是 `h(libTabLegacy, …)`。
   - 入口不依赖 legacy 组件内部，切回新版（`setCardMode(true)`）一定可用。

## 0.7.32 · 2026-10-21

### 改

1. **视角默认不高亮**：`viewKey` 初始值由 `detectView(L.pos)`（会按当前提示词反推，看起来像"已选中"）改为 `""`；套用预设时也不再反推，一律 `setViewKey("")`。只有显式点某一档才亮，再点取消。
2. **常用尺寸默认不高亮**：高亮判定从"宽高数值匹配"改成"是否点过这一档"——`sizePick === r[0]`。默认 `sizePick = ""`，任何一档都不亮；点一下亮、再点灭；手改宽或高自动清空。

## 0.7.31 · 2026-10-21

### 修

1. **常用尺寸取消后仍然高亮**：高亮是拿 `w`/`hh` 跟档位比出来的，取消时把宽高还原成原值——如果原值本来就等于该档（比如默认就是 1216×832），比完照样相等，于是继续亮。
   - 新增 `sizeOff` 状态记录「被显式取消的那一档」：`on = 数值相等 && sizeOff !== 该档`。
   - 取消时 `setSizeOff(r[0])`；点别的档或手动改宽/高时 `setSizeOff("")`，恢复正常的「数值相等就高亮」。
   - 提示语分两种：有还原记录 → 报还原后的宽高；没有 → 说明「宽高不变，只是不再高亮」。

## 0.7.30 · 2026-10-21

### 改

1. **视角三档支持「再点一次取消」**：`viewPrev` ref 记录切换前的 `pos`/`neg` 与切换后的结果。再点当前档时，若提示词仍是切换后的内容就还原并清掉高亮（`setViewKey("")`）；若中途手改过提示词（内容已变）则按新一轮切换处理，避免把用户的新内容冲掉。按钮 title 补「再点一次取消视角」。
2. **常用尺寸支持「再点一次取消」**：`sizePrev` ref 记住套用前的宽高，再点当前档还原宽高并清高亮；没有记录时只取消高亮。title 补「当前，再点一次取消」。

## 0.7.29 · 2026-10-21

### 改

1. **顶栏右侧那排按钮靠右**：`启动 ComfyUI / 重试连接 / 重新连接 / 释放显存 / 重启 ComfyUI` 所在容器加 `marginLeft: "auto"` + `justifyContent: "flex-end"` + `flexWrap: "wrap"`。左侧标题区是 `flex: 1 1 auto`，窄屏换行时按钮组也不会掉到左边贴着文字，始终贴右边缘。

## 0.7.28 · 2026-10-21

### 修

1. **文本框视图里的提示词框被压窄**：主区从 grid 改成 flex 列之后，白话块、正负提示词块、胶囊面板、按钮行上原来写的 `alignSelf: "start"`（grid 时代用来贴顶）在 flex 列里变成**宽度收缩到内容宽**，于是 `width: 100%` 的 textarea 只能按内容宽度撑开，正向/负向框明显变窄、右边一大片空。
   - 四处改为 `alignSelf: "stretch"` + `width: "100%"`：白话块（row3 位置）、正负提示词块、胶囊面板、按钮行。
   - `S.ta` 本来就是 `width: "100%"; boxSizing: "border-box"`，父块铺满后提示词框自然回到整列宽。
   - 胶囊面板、展开弹窗、加词行行为不变。

## 0.7.27 · 2026-10-21

### 加

1. **胶囊数量不再影响页面高度**：面板里的胶囊滚动区加 `maxHeight: clamp(190px, 34vh, 420px)`（窄屏不限），超出就在区内滚动；面板本身 `flex: 1 1 auto; minHeight: 260px`，高度只跟窗口走，跟胶囊数量无关，底边仍与参数卡齐平。
2. **新增「展开 ▸」按钮 + 二级菜单**：面板标题栏右侧（`◂ 文本框视图` 旁边）。点开是 `min(980px,94vw) × min(78vh,720px)` 的弹窗，内容：
   - 标题「胶囊提示词 · 展开」+ 正向/负面颗数 + `关闭`；
   - 加词行（和面板里同一套：中文备注 / 提示词本体 / 存到词库 / 分类 / 加到正向·负面）；
   - 正向、负面两栏完整胶囊列表（点=搬到对面，右键=改中文/本体，×=删）。
   - 数据与面板、与生成页提示词框是同一份 `pos`/`neg`，弹窗里改完立刻同步。
   - 点遮罩或 `关闭` 收起；`position: fixed` 挂在 `.cfy-grid` 末尾，不占栅格轨道。

## 0.7.26 · 2026-10-21

### 修

1. **胶囊面板与「出图落地位置」重叠（上一版我把 flex 用错了）**。
   - 原因：`.cfy-grid` 用 flex 且 `align-items: stretch`，两列高度被父容器高度夹住；面板 `flex: 1 1 auto; minHeight: 0` 会**被压缩到比内容还小**，而 `box` 是 `overflow: visible`，内容就溢出来压到下面的存放区。截图里「出图落地位置」「重启 ComfyUI」「另外复制一份」和加词行叠在一起就是这个。
   - 改法：容器回到 **单行两列 grid**（`gridTemplateColumns: minmax(0,1fr) clamp(210px,32%,420px)`，`gridAutoRows: max-content`）。行高 = 两列内容最大值，**不会缩**，父容器矮就由外层滚动。
   - 面板改 `flex: 1 0 auto`：只能长、不能缩；有富余高度时撑满，与参数卡底边齐平。
   - 参数卡 `alignSelf: stretch` 保留（在 grid 里同样生效），`flex` 基准去掉。
2. **参数卡内部两列字段改用 `pCols2`**（按参数卡自身实测宽度 `pW < 520` 判定），不再用整页 `narrow`：整页 700px 时参数卡只有 ~224px 宽，长宽/步数/CFG、采样器/调度器被压成两列挤成渣。

### 验证

同结构 mock 用 headless Edge 实测（1000×620）：左列底 572 / 参数卡底 572（齐平）、面板底 525 < 存放区顶 535（**无重叠**）、无横向滚动。

## 0.7.25 · 2026-10-21

### 改（结构）

1. **生成页主区从「一套 grid + 满屏行跨」改成「左右两列 flex」**，这是「拖动窗口时布局跳/错位」的根因。
   - 旧结构：`参数卡 { gridRow: "1 / span 5", minHeight: calc(100vh - 200px) }` 参与第 1 行行高计算 → 左边画布只有 42vh，第 1 行却被参数卡撑到接近满屏，画布与「白话」之间出现一段高度随窗口乱变的空白；改宽度时行高重算，整页就跳。
   - 新结构：`.cfy-grid` 是 `display: flex`（窄屏 `flex-direction: column`），左列 `.cfy-left` 装画布、按钮行、白话/胶囊面板、正负提示词、底部存放区；参数卡是第二列，`flex: 0 0 clamp(210px, 32%, 420px)`。
   - 左侧不再有行高被右侧决定的情况：左列内容自上而下自然排，画布与白话之间没有幽灵空白。
   - 底边齐平改由 `align-items: stretch` 保证：左列与参数卡同高，胶囊面板 `flex: 1 1 auto` 吃掉左列剩余高度 ⇒ 面板底边 = 左列底边 = 参数卡底边，任何窗口尺寸都成立。
   - 参数卡去掉 `minHeight: calc(100vh - 200px)`（就是它在撑高整行），保留 `position: sticky; top: 0`。
   - `gpos()` 退化为空对象（6 个调用点保留，避免大改），行列定位全部失效——布局只由 flex 决定。

## 0.7.24 · 2026-10-21

### 修

1. **底边齐平改成硬保证**：参数卡由 `alignSelf: "start"` 改为 `"stretch"`（加 `alignContent: "flex-start"` 让内部内容仍从顶部排）。原来它的高度由自身 `minHeight: calc(100vh - 200px)` 决定，和面板撑出来的高度两者各算各的，某些窗口高度下就差几像素到几十像素；现在两者都拉伸到第 5 行底，同一条线由网格保证。
2. **面板拉高后不再大片空白**：正向/负面两栏胶囊放进 `flex: 1 1 auto; minHeight: 0; overflowY: auto` 的滚动区，短的胶囊列表贴顶，长了在区内滚动，面板本身高度稳定。
3. 面板标题加 tooltip：显示当前 `面板宽 xxx px · tiny/narrow/mid/wide`，方便回报窗口档位。

## 0.7.23 · 2026-10-21

### 改

1. **窗口拉伸改成四档自适应**（宽度由已有的 `ResizeObserver`/`resize` 监听实时测量 `rW`，拉伸即生效，无需刷新）。
   - `tiny < 460` / `narrow < 640` / `mid < 980` / 其余为宽屏。
   - 主栅格列宽：单列（narrow）→ `minmax(0,1fr) clamp(200px,32%,330px)`（mid，右栏收窄，左栏不再被挤）→ 宽屏原 `clamp(260px,30%,460px)`。
   - 画布高度：`32vh / 36vh / 42vh` 三档，矮窗口不再把提示词区挤到要滚动。
   - 提示词框行数估算宽度随档位变化（每行字数 34/44/52），窄屏按内容显示的更准，不用手动拖高。
   - 胶囊限宽：`80vw`（tiny）/`62vw`（narrow）/`240px`。
   - 加词行两个方向按钮：tiny 时各占整行，narrow 时各 46%。

## 0.7.22 · 2026-10-21

### 修

1. **小窗（单列）下胶囊面板的落点**：窄屏 `gpos()` 退化成 `gridRow: auto`，位置完全由 DOM 顺序决定，而面板原来写在「正负提示词」和底部存放区之间 —— 于是单列时它跑到了**参数卡下面**。
   - 把面板整块在 DOM 里挪到「白话 → 提示词」之后、参数卡之前。宽屏有显式 `gpos("1","3 / 6")`，DOM 顺序不影响排布，行为不变。
   - 现在窄屏顺序：画布 → 文件名/按钮 → 白话（提示词视图）→ **胶囊面板** → 图片参数卡 → 底部存放区。
   - 宽屏不变：面板仍跨第 3~5 行、底边与参数卡对齐，存放区在第 6 行。

## 0.7.21 · 2026-10-21

### 改

1. **胶囊提示词面板底边与右侧「图片的高宽 / 参数」卡底边对齐**。
   - 右侧参数卡本来就 `gridColumn: "2"; gridRow: "1 / span 5"`，占满第 1~5 行；胶囊视图下面板原来只占第 3 行，底边高了一大截。
   - 现在胶囊视图：面板 `gpos("1", "3 / 6")`（跨第 3~5 行）+ `alignSelf: stretch`，撑到第 5 行底部，与参数卡底边同一条线；`minHeight` 回到 0，高度由网格决定。
   - 底部「出图落地位置 / 另外复制一份」在胶囊视图下移到第 6 行（`gpos("1 / -1", "6")`），不再和面板抢第 5 行；模板只有 5 个显式行，第 6 行由 `gridAutoRows: max-content` 自动生成。
   - 窄屏（单列）维持原样：面板 `gridRow: auto` + `alignSelf: start`，存放区仍在第 5 行。

## 0.7.20 · 2026-10-21

### 修

1. **胶囊提示词面板与「出图落地位置 / 另外复制一份」（第 5 行）重叠**。
   - 原因：面板原来用 `gpos("1", "3 / 5")` 跨第 3~4 行，而这两行原本属于「白话 → 提示词」和「正负提示词」；切到胶囊视图时那两块 `display: none`，行高塌陷，面板内容比网格区域高就从区域里溢出来，压到第 5 行的存放区上。
   - 改法：面板只占第 3 行（`gpos("1", "3")`），由该行按内容自然撑高，不再跨行、不再溢出；同时去掉固定 `minHeight: 200px`（改 `0`），高度完全跟着内容走。
   - 第 4 行空着（高度 0），只多一个 10px 行间距，不影响布局。

## 0.7.19 · 2026-10-21

### 改

1. **胶囊面板与生成页参数卡做了窄屏适配**（阈值沿用统一的 `narrow = 面板宽 < 640`）。
   - 加词行：窄屏 `flexDirection: column`、两格输入 `width: 100%`（带 `boxSizing: border-box` / `minWidth: 0`，不会被内边距撑破），开关与分类下拉各占一行且下拉吃掉剩余宽度，`加到正向/加到负面` 并排各占 46%。
   - 胶囊：`maxWidth` 窄屏 `62vw`、宽屏 `240px`，文字包一层 `span` 用省略号截断（长 tag 不再撑破面板），字号窄屏 11.5px。
   - 面板容器：窄屏 `minHeight: auto`、`gap: 6px`。
   - 参数卡里两处写死的 `repeat(2, minmax(0,1fr))`（宽/高/步数/CFG 与 采样器/调度器）改为窄屏单列。

## 0.7.18 · 2026-10-21

### 改

1. **挑明「加到正/负向」写的就是生成页那两个提示词框**（只是文案与提示，数据路径没变）。
   - 按钮 title 改为「写进生成页的『正向提示词』框（追加到末尾，重复的自动跳过）」。
   - 状态消息改为 `已写进正向提示词框：…`。
   - 面板说明改为「这里加的词直接写进生成页的正/负提示词框，切回文本框看到的就是它」。
   - 数据链路核对：正向框 `textarea value = pos`（L2545）、负向框 `value = neg`（L2549）；胶囊 `prTokens` 也从 `pos/neg` 切；写入 `prAddPair` 走 `setPos/setNeg` —— 同一条 state，无中间副本。

## 0.7.17 · 2026-10-21

### 改

1. **「存到词库」变成独立开关，默认关，不再自动存**。
   - 行内：`新胶囊 [中文备注（可空）] [提示词本体，逗号分隔] ☐ 存到词库 [分类 ▾] [加到正向] [加到负面]`；开关关着时分类下拉 `disabled` + 半透明，鼠标提示「先勾上」。
   - `prAddPair(cn, en, cat, side, saveDict)`：只有 `saveDict` 为真且填了中文才动词库；否则词库一点不碰，中文备注只用于当次显示提示，胶囊按本体显示。
   - 消息分两种：`（存进词库「X」）` / `（没存词库，胶囊按本体显示）`。
   - 冒烟：开关关 + 有中文 → frags 仍 `{}`；开关开 → 新建「光影」分类并落卡；开关开但中文空 → 只写提示词。

## 0.7.16 · 2026-10-21

### 改

1. **加词行去掉「加入」按钮，两个方向按钮直接提交**，并新增「存到词库」分类下拉。
   - 一行：`新胶囊 [中文备注（可空）] [提示词本体，逗号分隔] 存到词库[分类 ▾] [加到正向] [加到负面]`。
   - `加到正向` / `加到负面` 就是提交：读同一行的两格 → `prAddPair(cn, en, prCat, side)`；回车按上一次用的方向提交（`prTarget`）。
   - 分类下拉：`自动（自加词）` + `dictGroups()` 里现存的每个分类；选已有内置分类（如「姿势」）就把卡片加到那个组，选一个不存在的名字会自动建自建分类。
   - `prAddPair` 尾巴修了一个真 bug：`existed` 原来声明在 `if (cnT)` 块里，消息里引用会 **ReferenceError**，已提到外层。
   - 冒烟：`("夕阳","sunset","",pos)` → 存「自加词」；`("站姿别名","standing","姿势",neg)` → 走 rename 改内置卡；`("剑","sword","道具",neg)` → 新建「道具」分类；无中文不建卡。

## 0.7.15 · 2026-10-21

### 改

1. **加词拆成「中文备注 + 提示词本体」两格**（面板顶部那一行）。
   - `[中文备注（可空）] [提示词本体，逗号分隔] [加入] [加到正向][加到负面]`；两格里按回车等效于点「加入」，成功后两格清空、焦点回本体格。
   - `prAddPair(cn, en)`：本体必填；带中文时先落词库——已有同 `en` 的卡片就直接改那张卡的中文（`dictRenameEntry`），没有就写进自建分类 `自加词`（`USER.cats` + `USER.frags`，`saveUser()`），所以胶囊立刻能显示中文、右键能改名，口径与词库完全一致。
   - 不带中文就只写提示词；中文名留空时胶囊按本体显示。
   - 写入走 `mergeCsvTags` 去重，重复加同一段不会叠加；消息只发一条（不再出现 prAdd / prAddPair 双提示）。
   - 冒烟：`("夕阳","sunset, golden hour")` → pos `1girl, sunset, golden hour`、frags `{"自加词":[["夕阳","sunset, golden hour"]]}`；重复 en 改中文走 rename；空本体被拒。

## 0.7.14 · 2026-10-21

### 改

1. **加词行从每栏尾部拎到面板顶部、正向上面，单独一行**。
   - 一行搞定：`新胶囊 [＋ 加词，回车] [加到正向] [加到负面]`，目标栏用一个选中态高亮（正向＝蓝、负面＝红），状态 `prTarget` 默认 `pos`。
   - `prRow` 里那个尾部输入框删掉，两栏回到「标题 + 计数 + 复制/清空 + 胶囊」的干净结构。
   - 回车仍走 `prAdd(prTarget, …)` → `setPos/setNeg` 函数式更新，与文本框视图同一份数据；输入框不受控，回车后自清。

## 0.7.13 · 2026-10-21

### 增

1. **胶囊右键改「中文名 + 提示词本体」**，删除仍是逐颗独立。
   - `tagIndex()`：英文标签 → `{cat, cn, en}`，比 `tagCnMap()` 多带分类，右键要靠它找到词库卡片。
   - 右键胶囊弹编辑器：`中文名`（能对上词库卡片才可编辑，否则置灰说明「不在词库里」）+ `提示词本体`，按钮 `删除这个胶囊 / 取消 / 保存`；Enter 保存、Esc 关闭、点遮罩关闭。
   - 保存：改中文 → `dictRenameEntry(cat, cn0, cn, en)` 写回词库（内置走 `USER.ov`、自建走 `frags`）；改英文 → 只换当前这一栏提示词里的写法。
   - `prRewrite` 支持 `oldTags` 数组：一张卡 `en = "sitting, seated"` 在提示词里占两段，改名时**一起换掉**，不留半截残词；删除同理。
   - `×` 加大到 12px + 悬停高亮 + 单独的成功提示，删除仍只影响那一颗胶囊。

## 0.7.12 · 2026-10-21

### 改

1. **胶囊按词条拆，并对得上词库卡片就显示中文名**（和角色卡一个口径）。
   - 新增模块级 `tagCnMap()`：扫描 `allLib()`，把每个卡片 `en` 里的每段标签映射到它的 `cn`；一张卡的 `en` 有多段就每段都映射。
   - 胶囊文字 = 有中文用中文、没有就用英文原标签；`title` 里始终带「中文 / 英文」两行，悬停能看全。
   - 拆分单位仍是**逗号**：一个 `en = "sitting, seated"` 的卡片在提示词里是两段，于是出现两个胶囊（各显示中文「坐着」），因为提示词本身按标签生效。
   - 冒烟：`tagCnMap()` 实测 `standing→站姿`、`seated→坐着`、`lowres/blurry→糊`、未知词返回空；胶囊聚合显示 `站姿 / 坐着 / 1girl / 剑`。

## 0.7.11 · 2026-10-21

### 改

1. **胶囊视图与文本框视图做实「同一份内容」**（不是两份数据、不是复制）。
   - 合并逻辑提到模块级 `mergeCsvTags(cur, add)`，词库「插入提示词」与生成页胶囊视图共用同一实现，避免两处去重规则漂移。
   - 胶囊视图每栏尾部加输入框：`＋ 加词，回车` → `prAdd()` 走同一个 `setPos/setNeg` 函数式更新，回车后清空（不受控输入，不引入 hook，`genTab` 的 hook 数恒定）。
   - 文案改成视图语义：`胶囊视图 ▸` / `◂ 文本框视图`，面板说明改为「同一份提示词的另一种看法」。
   - 冒烟：`prAdd("pos","smile, Standing")` 在 `1girl, standing` 上 → `1girl, standing, smile`（大小写不敏感去重）；空输入不写入。

## 0.7.10 · 2026-10-21

### 改

1. **词库不再往剪贴板复制，改成插进提示词**。
   - 删掉 `复制正向` / `复制负面` 两个按钮与 `copyOne()`（剪贴板那条路整条移除）。
   - `写回生成页正向/负面`（原来是 `setPos(txt)` **整栏覆盖**，会把你手写的词冲掉）改成 **`插入正向提示词` / `插入负面提示词`**：
     函数式更新 `setter((cur) => mergeTags(cur, add))`，把选中词条**追加**到原有内容后面，并按大小写不敏感去重、保持先出现顺序。
   - 新增 `去生成页看`：跳到生成页并强制切回「提示词」视图，方便核对插入结果。
   - `mergeTags` 冒烟实测：`("1girl, standing", "standing, smile, School Uniform")` → `1girl, standing, smile, School Uniform`。

## 0.7.9 · 2026-10-21

### 增

1. **新面板做成「胶囊提示词」**：切成 `正向` / `负面` 两栏，每栏把提示词按逗号切开，逐条渲染成和角色卡同一套的小胶囊（`S.chip`，`borderRadius: 999px`）。
   - 胶囊：点本体＝搬到对面那一栏；点 `×` ＝从这一栏删掉；两栏标题带计数 + `复制` + `清空`。
   - 编辑就是直接写 `setPos` / `setNeg`，所以生成页那两个框实时同步，不存副本、不会两处不一致。
   - `prTokens` 去重（大小写不敏感）+ 剪掉空项；`prMove` 传数组给 `prWrite`（第一版传了字符串，`arr.join` 直接 TypeError，已修）。
   - 两边都空时显示「（空）」并提示先切回去写词。

## 0.7.8 · 2026-10-21

### 增

1. **生成页提示词区可整块切换**。正负提示词区标题栏多一个 `切换 ▸` 按钮：
   - 点了之后，「白话 → 提示词」与「正负提示词」两块一起收起，由一块**新面板**占住原来的位置（第 3~4 行，网格跨行）；
   - 新面板目前是占位（标题「新面板」+ 说明 + `◂ 切回提示词`），功能待定；
   - 收起是 `display: none`，**不卸载**：切回去时提示词内容、光标、锁定的卡片、模型选择全都还在；
   - 选择写 `localStorage["comfyui.zoneMode"]`，刷新后保持。
   - 窄屏（<640px）沿用同一套 gpos，单列下顺序是 画布 → 按钮 → 新面板 → 底部横跨。

## 0.7.7 · 2026-10-21

### 增

1. **每张小卡片可打正负标签**（词条极性）。三种状态：`正` / `负` / `自动`。
   - 卡片右上角小角标：`正` / `负` / `·`（自动）。**点角标循环切换** 自动 → 正 → 负 → 自动，卡片左边框加粗显示极性。
   - 双击弹层里也有「极性」三个按钮，和角标等价。
   - **落栏规则**：点卡片时，`正`词条一律进正向栏、`负`词条一律进负面栏、`自动`才跟「点卡片的目标栏」走。所以可以把负面词混在姿势页里，点它仍然进负面。
   - 工具栏加范围筛选：`全部 / 只正 / 只负`（`只负` 含内置「负面」分类的默认负向词）。
   - 内置「负面」分类的词条默认算 `负`（`dictPolarity` 里的特例），不用一条条打。
   - 持久化：`USER.pol`，键 `"分类\u0000中文"`，值 `pos`/`neg`；选 `自动` 时把键删掉，不留垃圾。

## 0.7.6 · 2026-10-21

### 增

1. **双击小卡片就地改词条**：中文名与提示词本体（英文标签）同屏编辑，不再两连 `window.prompt`。
   - 弹层：中文输入框 + 英文多行框 + 保存 / 删除 / 取消；回车保存、Esc 取消；改动时底部显示「原：旧中文 → 新标签」预览。
   - 右键卡片等价于双击（旧的 prompt 版 `editCard` 已删，避免两套实现）。
   - 单击改成 200ms 延时切换选中：双击时先把这次单击撤销，卡片不会先闪一下选中再弹编辑。
   - 写入两条路不变：内置词条 → `USER.ov`（`[原名, 新中文, 新英文]`，`dict.js` 不动）；自建词条 → 直接改 `USER.frags`。
   - 删除：内置词条进 `USER.hidden`（记原名，可恢复），自建词条真删，删前 `confirm` 说明后果。

## 0.7.5 · 2026-10-21

### 增

1. **大分类可增可删**（词库新版页）。分类不再是写死的 8 个常量，改成 `dictGroups()` 现算：

   - `＋ 分类`：新建空分类，立刻可点，接着用「＋ 词条」往里加词；名字里 `\\/:*?"<>|` 自动换成 `-`，限 24 字。
   - 分类胶囊右侧 `×`：内置分类＝**隐藏**（词条仍在 `lib/dict.js`，随时能找回）；自建分类＝**删库**（连词条一起删，删前确认）。
   - `恢复分类 N`：一次性把隐藏的内置分类全部找回来。
   - 右键分类胶囊＝改名：自建分类改真名（`USER.frags` 键一起认），内置分类只改显示名（`USER.groupRename`）。
   - 持久化：`USER.groupHide`（隐藏名单，内置记 key / 自建记 `cat:名字`）、`USER.groupRename`（改名表）、`USER.cats` + `USER.frags`（自建分类与词条）。

   「＋ 词条」的写入目标改成分类的**源分类**（内置组取 `src` 末尾，例如姿势 → `姿势`），这样内置分类改过名也不会把词条写到新名字下。
   已知：表情/服饰/构图/场景/质量/风格/负面六个内置分类仍是「待开放」只读状态（试水期），卡片可按需打开。

## 0.7.4 · 2026-10-21

### 修（致命）

1. **React #310：Rendered more hooks than during the previous render**
   `safeTab(fn, label)` 里是 `const node = fn()` —— 把标签页函数**当普通函数调用**，
   于是页里的 `useState` 全部追加到 `Console` 自己的 hook 链上，只有切到那一页才多出若干 hook。
   生成页 `Console` 有 119 个 hook，一切到「词库」（新卡片页 6 个 useState）→ 122 个 → React 抛 #310，整块面板变错误页。
   历史上之所以没炸，是因为其它四页各自 **0 个 useState**（119 个 hook 全在 Console 里），正好没触发。
   → 删掉 `safeTab`，五个页改成**组件渲染**：`h(genTab, { key: "gen" })` … `h(libTab, { key: "lib" })`，
   外面沿用文件里本来就有的模块级 `TabBoundary`（`key={tab}`，单页崩只显示一行红字）。
   每页的 hook 现在落在自己的 fiber 上，Console 的 hook 数恒定 = 119。
   注：本页无内部 state 的四页不受影响；`libTab` 的选中态在切页后会重置（可接受，属于试水页）。

## 0.7.3 · 2026-10-21

### 修

1. **`COMFY_INPUT` / `COMFY_PATCHES` 推导错**（去依赖时暴露出来的老 bug）。
   原来写死 `<comfyRoot>\input` 与 `<comfyRoot>\models\model_patches`，而真实位置是
   `<comfyRoot>\ComfyUI\input` 与 `<comfyRoot>\ComfyUI\models\model_patches` —— 便携版和自建目录都这样。
   后果：`os.makedirs` 把空壳目录建出来，LLLite 身份控制图与 model_patches 写进 ComfyUI 根本看不见的地方
   （本机实测：`D:\paint\input`、`D:\paint\models\model_patches` 是空壳，真货在 `D:\paint\ComfyUI\` 下）。
   → 新增 `_comfy_sub(root, *cands)`：先探 `ComfyUI/...`，再退回 `...`，都不存在才按后者建。

## 0.7.2 · 2026-10-21

### 修

1. **合并审计抓到一处漏抄**：`tools/build_client.py` 被上游 0.7.0 的版本覆盖，模块 id 守卫
   （`check_module_id()`：`client.js` 的 load id 必须等于 `package.json` 的 `name`）丢了。
   起因是覆盖脚本走两趟（`0.7.0/plugin/` 与 `0.7.0/` 根目录各一趟），第二趟用 `plugin/...` 相对路径绕过了保留名单。
   → 已从 `.merge-backup-0.6.4` 取回；`--check` 实测 `[ok] 模块 id = dsh-comfyui-console`。
   另有 `check_naming.py`（上游 0.7.0 带来的第四处一致性检查）同时兜底。

## 0.7.1 · 2026-10-21

基线 = 上游 0.7.0（去依赖化：comfyUrl / backendMode / remote 模式 + CARD_ZH TDZ 等 8 条修复）。
内部并行线的私有改动重新贴回，并加一枚词库试水。

### 新增

1. **词库（新版）：方形小卡片**
   - 分类骨架：姿势 / 表情 / 服饰 / 构图 / 场景 五个主分类 + 质量 / 风格 / 负面 三组额外分类 + 自建分类。
     内置分类映射：姿势 ← 姿态-站·坐·其他 + 动作；服饰 ← 衣服-军礼服·驾驶员服；构图 ← 镜头；场景 ← 背景。
   - **试水范围：目前只有「姿势」开放卡片**，其余分类 chip 标「待开放」，右上角「旧版」一键回老树状界面。
   - 卡片 1:1 方形（`minmax(96px,1fr)` 自适应列数），中文 12.5px + 英文 9.5px 两行截断；选中加 accent 描边与底色。
   - 点卡片 = 选中，**无插入按钮**：选中的词以提示词胶囊承载，胶囊点 `×` 删、点本体在正向/负面之间换栏。
   - 底部：复制正向 / 复制负面 / 写回生成页正向 / 写回生成页负面 / 清空选中。
   - 右键卡片：改名 / 删除。**内置词条也可改** —— 改名写 `USER.ov`（`分类 -> [[原名, 新中文, 新英文], ...]`），
     删除写 `USER.hidden`（记原名，可恢复）；`allLib()` 渲染前套用两层。

### 保留内部并行线改动

2. 配色六档（跟随系统 / 浅色 / 深色 / 纯白 / 纯黑 / 自定义）+ `--c-accent-on` / `--c-scheme`
3. 原生 `<select>` 弹层跟随主题（`PANEL_CSS` + 根节点 `class="dcomfy-panel"`）
4. 包名 `dsh-comfyui-console`（`package.json` / `lib/index.js` / `cordis.patch.yml` / `client.js` 模块 id 四处）
5. `tools/check_tdz.py`、`build_client.py` 的模块 id 守卫、`package.json.files` 白名单

## 0.7.0 · 2026-10-21

**去依赖化。** 目标：不再假设 ComfyUI 装在哪台机器的哪个盘，插件可以只当一个客户端用。

### 新增

1. **`comfyUrl`** —— ComfyUI 的完整地址，可指向局域网或远程（`http://192.168.1.10:8188`）。
   留空则用 `http://127.0.0.1:<comfyPort>`。
2. **`backendMode`** —— `auto` | `managed` | `remote`
   - `managed`：有本地 `comfyRoot`，能拉起/停止 ComfyUI、能推算 output 目录
   - `remote`：只走 HTTP，**绝不碰进程**；`/comfy/start|stop|restart` 返回 500 并说明怎么改；
     **闲置自动卸载关闭**（那可能是别人的服务器，替他清显存是越界）
   - `auto`：有可用 `comfyRoot` → managed，否则 remote
3. `tools/check_naming.py` 进 CI —— 包名四处一致性检查。

### 修

4. **`CARD_ZH` 的 TDZ（致命，只在有角色卡时触发）**
   `healUserZh()` 在模块加载时立即执行 → `zhFillParts()` → `zhOf()` → 读 `CARD_ZH`，
   而 `CARD_ZH` 是 `const`，**声明在调用点之后** →
   `ReferenceError: Cannot access 'CARD_ZH' before initialization`，插件整个不激活。
   `typeof zhFillParts === "function"` 守卫拦不住：函数声明会提升，`typeof` 恒为 `"function"`。
   → 把 `CARD_ZH` / `zhOf` / `zhFillParts` / `cardFromJson` 整体搬到 `healUserZh()` 之前。
   验证：vm 沙箱 + mock loader + 真实存档键 `dsh-comfyui-console/v1`，9/9；
   反例（把 `CARD_ZH` 挪回末尾）确实抛 `Cannot access 'CARD_ZH' before initialization`。
   ⚠️ 复现有陷阱：`zhFillParts` 对**字符串**值直接透传，只有 `parts: {k: [{t,n}]}`
   的**数组**分支才走 `zhOf` —— 随便塞数据测不出来。

5. **`comfyRoot` 默认值硬编码 `D:\paint\ComfyUI`**（上游作者的开发机路径）。
   别的机器上它永远"看起来配了但实际无效"，报错全落在下游。→ 默认置空，改为模式判定。

6. **`running()` 永远探 `127.0.0.1`**。remote 模式下 `comfyUrl` 指向别处，
   本机端口有没有人占**与远程 ComfyUI 无关**。实测：本机 8188 恰好有实例在跑 →
   误判"远程可用" → `busy()` 去连不可达的远程 `/queue` → 挂满 10 秒，面板像死了。
   → managed 探端口，remote 走 HTTP。

7. **`/comfy/status` 双倍超时**。`status()` 里 `running()` 探一次、`busy()` 又探一次。
   实测不可达远程 6.04s。→ running 只算一次、没在跑就不问 `/queue`、
   remote 探测加 5 秒 TTL 缓存。实测 **6.04s → 0.01s**。

8. **包名不一致**：`lib/index.js` 的 `export name` 与 `cordis.patch.yml` 的 `insert name`
   还是 `dsh-comfyui-console`，而 `package.json.name` 是 `@local/dsh-comfyui-console`。
   本机靠 profile patch 硬指才没炸，按标准方式装就会静默不激活。→ 四处对齐，并进 CI。

9. `install.ps1` 的安装提示不再写死 `%USERPROFILE%\.dsh\plugins\`，
   改为列出 npm / cordis / legacy 三种布局。

### 验证

```
check_all.py    JS 6 + Python 10 语法 OK
                client.js 与源一致 · 包名一致性 OK · TDZ OK
                主题单测 13/13 · 视角单测 28/28
comfyUrl 三模式  remote+不可达 status 0.01s running=False start 500
                remote+可达   status 0.01s running=True  start 500
                managed       status 0.09s running=True  start 200
CARD_ZH TDZ     vm 沙箱 9/9，反例真抛 ReferenceError
```

### 已知未解决

- `anima\loras\4x-UltraSharpV2.safetensors` 是放大模型，误放在 LoRA 目录里，
  会出现在 LoRA 候选第一条，选中出图必失败。
- `anima-aesthetic-v1.1-Q8_0.gguf` 是 `.gguf`，需要 ComfyUI-GGUF 自定义节点；
  `extra_model_paths.yaml` 也还没映射 `diffusion_models`。
- `lib/index.js` 里 `Console()` 仍是单函数约 2500 行（`healUserZh` 的 TDZ 已修，
  但拆函数这件事本身没做）。

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
