## 0.7.151 · 2026-10-27 · 二级页顶到面板底边：清掉 S.wrap 的 48px 底部内边距

### 那 48px 是什么

`PreviewConsole`（A 线）根节点复用了 `S.wrap`：

```js
style: Object.assign({}, S.wrap, theme)
```

`S.wrap` 里带着：

```js
padding: "14px 18px 48px"
```

`48px` 是独立界面用的 —— 内容滚到底之后留一段呼吸空间，不至于贴着边框。但 A 线在**二级页**（历史 / 模型库）是嵌在 DSH 面板里的，面板自己已经有外边距，这 48px 就变成「区域永远差一截才到面板底」的那一截。

### 改法

`props.page` 有值（= 嵌入模式）时把底部内边距清零：

```js
style: Object.assign({}, S.wrap, theme, (props && props.page) ? { paddingBottom: 0 } : null)
```

放在 `Object.assign` 最后，优先级最高，`theme` 覆盖不掉。独立界面（`props.page` 为空）仍保留原 48px，不受影响。

`.cc-online-page` 本身是 `flex:1 1 0`，去掉这层内边距后，结果区就直接抵到面板底边。

### 验证

- `client.js` 实测：`(props && props.page) ? { paddingBottom: 0 } : null` 有；`S.wrap` 原 `padding: "14px 18px 48px"` 仍在（只被条件覆盖，没被改掉）。
- 卡片尺寸、网格、媒体区**一个字节都没动** —— `online_models.js` 仍是 0.7.150 回滚后的 `.bak-media` 原样。
- 7 页渲染、警告 0、组件 37/37/0。
- `client.js` 929,191 → **929,350 字符**。
- 备份：`app.js.bak-pad`、`client.js.bak-20261027-095413`。

## 0.7.150 · 2026-10-27 · 撤回模型库卡片尺寸的全部改动

卡片尺寸不动。`online_models.js` 回到 `.bak-media`（0.7.143 那份），下面这些全部撤掉：

| 版本 | 撤掉的东西 |
|---|---|
| 0.7.144 | `.cc-online-card-media:has(> .cc-online-no-image){aspect-ratio:16/10;max-height:190px}` |
| 0.7.145 | 六处 `repeat(auto-fit,…)`、`max-height:min(52vh,560px)` |
| 0.7.147 | `align-content:stretch`、`grid-auto-rows:minmax(240px,1fr)`、`cc-online-card{display:flex;…}`、`card-media{flex:1 1 auto;aspect-ratio:auto}` |
| 0.7.148 | `results-scroll{display:flex;flex-direction:column}`、`grid{flex:1 0 auto}` |
| 0.7.149 | `cc-online-layout{grid-template-rows:minmax(0,1fr)}` |

回滚后实测：

```
auto-fit            0
:has(> …no-image)   0
grid-auto-rows      0
flex:1 0 auto       0
repeat(4,minmax(0,1fr))  2
card-media aspect-ratio:3/4   true
card-media max-height:310px   true
.cc-online-card 独立规则       0
results-scroll display:flex  false
```

卡片又回到 4 列、`3:4`、上限 310px 的原样。

### 剩下那块空白说明白

那块空白**不是卡片或网格的问题**，是面板比内容高。`dcomfy-panel` 的高度由外层分配（`S.wrap` 的 `height:100%` + DSH slot 给的高度），结果区 `.cc-online-results-scroll` 用 `flex:1 1 0` 把剩余高度整个接住。三条结果只占一行，剩下就是空的 —— **只要卡片尺寸不变、面板高度不变，这块空白必然存在**。

能真正消掉它的只有三条路，都要先定方向再动：

1. **面板高度跟着内容收缩** —— 结果少时面板变矮，底部露出宿主背景；
2. **结果区加内容**（推荐模型、最近下载、分类入口之类）把空间用掉；
3. **卡片随空间拉伸** —— 就是刚才被否掉的那条。

`client.js` 930,383 → **929,191 字符**。
备份：`client.js.bak-20261027-095213`。

## 0.7.149 · 2026-10-27 · 模型库底部空白：断点在 `.cc-online-layout` 的 grid 行上

### 前几版为什么都没用

0.7.147 改 `align-content:stretch` + `grid-auto-rows`，0.7.148 把滚动容器改成 flex 列、网格 `flex:1 0 auto`。两版都只盯着「最里面那层网格」，但高度链在更外层就断了：

```
.cc-online-page      flex:1 1 0   ✓ 拿到高度
  .cc-online-layout  display:grid ✗ 没写 grid-template-rows
    .cc-online-results  height:100%  ← 相对「还没算出来的行高」
```

`.cc-online-layout` 是 grid，只声明了 `grid-template-columns:218px minmax(0,1fr)`。**行没有声明，默认就是 `auto`** —— 单行 `auto` 的行高由内容决定。

于是 `.cc-online-results{height:100%}` 变成「相对一个由它自己撑出来、还没算出来的高度」，浏览器只能按 `auto` 处理。results 高度 = 内容高度，往里传的 `flex:1 1 0` 滚动容器、`flex:1 0 auto` 网格、`minmax(240px,1fr)` 行 —— 全是「没有剩余空间可分」的摆设。

这就是为什么反复改最内层网格没有任何视觉变化。

### 改法

```css
.dsh-comfy-ui .cc-online-layout{grid-template-rows:minmax(0,1fr)}
```

只加这一条。行高成为确定值 = 容器高度，`minmax(0,1fr)` 里的 `0` 下限保证行不会被内容顶大。之后整条链一次性接通：

```
page(flex:1 1 0) → layout(row:1fr) → results(height:100%) → scroll(flex:1 1 0) → grid(flex:1 0 auto) → card(row 1fr)
```

### 学到的

**grid 容器里子项的 `height:100%` 依赖行高确定**。给 grid 写 `grid-template-columns` 而忘了 `grid-template-rows`，等于把「行高」这件事交给了内容 —— 任何往下的 `height:100%` / `flex:1` 都会静默失效，且不会报错。

排查顺序应该**从外往内**：先确认最外层容器有确定高度，再逐层看 `height:100%` / `flex` 的父级是不是真的给了确定尺寸，最后才动最内层的排布规则。这次反了四次顺序。

### 验证

- `client.js` 实测：`cc-online-layout{grid-template-rows:minmax(0,1fr)` 有；原 `cc-online-layout{display:grid;grid-template-columns:218px` 仍在（未被覆盖）；`cc-online-results{...height:100%}` 仍在。
- 0.7.145 之后加的所有层级规则全部保留，只补了缺的这一条。
- 7 页渲染、警告 0、组件 37/37/0。
- `client.js` 930,079 → **930,383 字符**。
- 备份：`online_models.js.bak-gridrows`、`client.js.bak-20261027-094953`。

## 0.7.148 · 2026-10-27 · 在线模型库：底部空白，这次真吃掉了

### 0.7.147 为什么没效果

上一版加的是：

```css
.cc-online-grid{align-content:stretch;grid-auto-rows:minmax(240px,1fr)}
```

按 flex/grid 的常识，`stretch` + `1fr` 应该让行把剩余高度吃掉。但它的父级是：

```css
.cc-online-results-scroll{flex:1 1 0;min-height:0;overflow-y:auto;...}
```

**普通 block 滚动容器**。里面的 grid 高度由内容决定 —— 容器里"剩余空间"这个东西根本不存在，`stretch` 没有可分配的高度。`grid-auto-rows` 的 `1fr` 也只是「行之间按比例分配」，总高还是内容高。所以规则写了等于没写。

这是 grid 拉伸失效最典型的一种：**它只能拉伸到父级给它的高度，而不是父级的可视高度。**

### 这次怎么改

把滚动容器变成 flex 列，网格作为 flex 子项去占高度：

```css
.cc-online-results-scroll{display:flex;flex-direction:column;flex:1 1 0;...}
.cc-online-grid{...;flex:1 0 auto}
```

- `flex-direction:column` → 主轴是垂直，网格可以沿主轴伸缩；
- `flex: 1 0 auto` → `grow:1` 吃剩余高度（内容少时撑满）、`shrink:0` 不被压缩（内容多时保持自然高度，交给 `overflow-y:auto` 滚动）、`basis:auto` 由内容起步；
- 网格拿到真实高度后，`align-content:stretch` + `grid-auto-rows:minmax(240px,1fr)` 才真正生效 —— 一行时这一行就是整个高度。

**同时钉住同级的提示条**：

```css
.cc-online-results-scroll>.cc-online-empty,
.cc-online-results-scroll>.cc-online-loading,
.cc-online-results-scroll>.cc-online-more-status{flex:0 0 auto}
```

滚动容器改成 flex 之后，「没有匹配模型」「加载中」「没有更多模型了」这些兄弟节点也变成了 flex 子项，默认 `shrink:1` 会被压扁。钉成 `0 0 auto` 保持原高。

### 验证

- `client.js` 实测：`cc-online-results-scroll{display:flex;flex-direction:column` 有、`align-content:stretch;grid-auto-rows:minmax(240px,1fr);flex:1 0 auto` 有、`cc-online-results-scroll>.cc-online-empty` 有。
- 列数、卡片宽度、媒体区全部沿用 0.7.147，没再动。
- 7 页渲染、警告 0、组件 37/37/0。
- `client.js` 929,775 → **930,079 字符**。
- 备份：`online_models.js.bak-fill3`、`client.js.bak-20261027-094616`。

## 0.7.147 · 2026-10-27 · 在线模型库：结果不满一屏时把底部空白吃掉

### 这次改的是哪块

卡片下面一直到面板底边那条白。0.7.145 把整页布局翻了一遍（列数改 `auto-fit`、媒体区上限抬到 52vh），方向不对已撤回；0.7.146 恢复成 4 列 / 310px 之后，那条白还在。

### 为什么会有那条白

`.cc-online-grid` 是 `align-content:start`：

```css
.cc-online-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-content:start}
```

`start` 意思是「行高按内容算，多出来的空间全堆在最后」。三条结果 = 一行 = 一张卡高度（约 430px），滚动容器有 600px，剩下 170px 就那样空着。窗口越高、结果越少，白得越多。

### 改法

**行高交给容器分配**：

```css
.cc-online-grid{align-content:stretch;grid-auto-rows:minmax(240px,1fr)}
```

- `stretch` + `1fr`：一行时这一行就是整个容器高度，卡片顶天立地，底部不留白。
- `minmax(240px,1fr)`：多行时每行仍有 240px 保底，总高超出容器就正常滚动，不会把卡片压成条。
- **列数没动**，仍是 `repeat(4,minmax(0,1fr))` —— 卡片宽度和 0.7.146 完全一样。

**卡片要能跟着涨**，所以让媒体区让位给 flex：

```css
.cc-online-card{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.cc-online-card-media{flex:1 1 auto;aspect-ratio:auto;max-height:none;min-height:110px}
.cc-online-card-info{flex:0 0 auto}
```

媒体区原来是 `aspect-ratio:3/4` + `max-height:310px`，高度由宽度算死，卡片被拉高时多出来的空间没地方去，会挤在信息区上方。改成 `flex:1 1 auto` + `min-height:110px` 之后，多高的空间都由媒体区吸收，信息区牢牢贴底。

**顺手撤掉 0.7.144 那条** `:has(> .cc-online-no-image){aspect-ratio:16/10;max-height:190px}` —— 它靠 `aspect-ratio` 压高度，跟现在的 flex 拉伸直接冲突（会让无图卡片在拉伸后反而缩回去）。现在无图态由 `min-height:110px` + flex 自然处理，那条规则没有存在意义了。

### 验证

- `client.js` 实测：`grid-auto-rows:minmax(240px,1fr)` 有、`align-content:stretch` 有、`cc-online-card{display:flex;flex-direction:column` 有、`aspect-ratio:auto;max-height:none` 有、`:has(> .cc-online-no-image)` 已无。
- 列数规则未改，仍是 `repeat(4,minmax(0,1fr))` 两处。
- 7 页渲染、警告 0、组件 37/37/0。
- `client.js` 929,483 → **929,775 字符**。
- 备份：`online_models.js.bak-fill2`、`client.js.bak-20261027-094154`。

## 0.7.146 · 2026-10-27 · 回滚 0.7.145 的模型库布局

0.7.145 把在线模型库的网格改成 `auto-fit`、媒体区上限抬到 `min(52vh,560px)`。方向不对，整体撤回。

`online_models.js` 直接回到 `.bak-fill`（就是 0.7.144 那份），当前状态：

- `auto-fit` 0 处，`repeat(4,minmax(0,1fr))` 2 处 —— 列数仍按 4 列算；
- 媒体区 `max-height:310px`；
- 无图态仍是 0.7.144 的 `:has() > .cc-online-no-image` → `16:10 / 190px`，这条**保留**（它只处理「没有预览图」的灰块，跟这次回滚的布局改动不是一回事）。

`client.js` 929,568 → **929,483 字符**，`pv-online` 渲染长度回到 136,636。

备份：`client.js.bak-20261027-094046`。0.7.145 的 `online_models.js.bak-fill` 仍留在原地，需要重做时可以直接取。

## 0.7.145 · 2026-10-27 · 在线模型库：结果少时不要空一大片

### 现象

搜出三条，卡片只占左上角一块，右边空一列、下面空半屏。窗口多大都这样，因为列数写死了。

### 根因有两层

**横向**：网格是固定 4 列 ——

```css
.cc-online-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
```

三条结果就只填三格，第四格空着，卡片宽度也按四等分算，跟窗口宽度无关。`@container` 里的 `repeat(6)` / `repeat(3)` / `repeat(2)` 同样是写死的档位。

**纵向**：媒体区上限 `max-height:310px` 把卡片钉死在一个高度，`align-content:start` 又不让行拉伸 —— 一屏高度 800px，一行卡片 400px，剩下 400px 就是页面背景。

### 改法

**列数交给 `auto-fit`**，窗口变宽自动多列、结果少时自动铺满：

```css
.cc-online-grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
```

六个档位（基础、紧凑变体、1480/1120/900/620 四个容器断点）全部换成 `auto-fit`，最小宽度分别 250 / 250 / 210 / 240 / 220 / 220 —— 宽屏密一点、窄屏稀一点，但都不再有「空一格」。实测 `cc-online-grid` 上固定列数残留为 0。

**媒体区上限跟着视口走**：

```css
.cc-online-card-media{aspect-ratio:3/4;max-height:min(52vh,560px)}
```

原来固定 310px；现在 800px 高的窗口给到 416px，卡片整体约 520px，一行就把纵向占住了。窗口再高也只到 560px，不会变成一张图占满全屏。

无图态从 `16:10 / 190px` 调到 `16:9 / min(30vh,300px)` —— 上一版为了压掉大灰块把它压得太矮，媒体区抬高后如果不跟着放，矮卡片会变成一行小方块；`16:9` 比 `16:10` 更扁，同样是「只有图标」的画面，扁一点更不显空。

### 验证

- `cc-online-grid` 六条规则全部 `repeat(auto-fit,minmax(…))`，固定列数残留 0。
- 媒体区 `min(52vh,560px)`、无图态 `16:9 / min(30vh,300px)` 均已进 `client.js`。
- 7 页渲染、警告 0、组件 37/37/0。
- `client.js` 929,483 → **929,568 字符**。
- 备份：`online_models.js.bak-fill`、`client.js.bak-20261027-093831`。

## 0.7.144 · 2026-10-27 · 在线模型库：没有预览图时不再留一大块灰

### 现象

在线模型库搜出来三条，卡片里写着「暂无预览」，然后下面整块灰的，一直空到卡片中段。三张卡一屏就占满了，往下拉也没内容 —— 看着像布局塌了一块。

### 原因

媒体区是固定比例：

```css
.cc-online-card-media{position:relative;aspect-ratio:3/4;max-height:310px;width:100%;background:var(--cc-control);overflow:hidden}
```

`3:4` 是给模型封面图（Civitai 那种竖版预览）准备的。卡片宽 400px 时高度按 400×4/3 ≈ 533 算，再被 `max-height:310px` 截到 310 —— 这 310px 里如果只有 `.cc-online-no-image` 那个居中的 32px 图标加一行「暂无预览」，剩下的两百多像素就全是 `var(--cc-control)` 的灰底。

占位符本身还有 `min-height:140px`，所以哪怕把媒体区压到很小它也撑得住。

### 改法

只在**没有图**的时候换比例，有图的卡片一点不动：

```css
.dsh-comfy-ui .cc-online-card-media:has(> .cc-online-no-image),
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-card-media:has(> .cc-online-no-image){aspect-ratio:16/10;max-height:190px}
```

- `:has(> .cc-online-no-image)` 精确命中「这个媒体区里装的是占位符」的情况 —— `OnlineModelImage` 在 `src` 为空或 `onError` 时会渲染 `div.cc-online-no-image`，正好是直接子元素。
- `16:10` + `max-height:190px`：400px 宽的卡变成 250 高再截到 190，图标仍居中，上下留白从两百多像素收到几十像素。
- 有 `src` 且加载成功的卡片走原来的 `3:4 / 310px`，封面构图不受影响。
- `:has()` 不支持的环境下这条规则整条失效，退回原样，不会把布局搞坏。

### 验证

- 构建后 `client.js` 里实测含 `cc-online-card-media:has(> .cc-online-no-image)` 与 `aspect-ratio:16/10;max-height:190px`。
- 7 页渲染长度不变、警告 0、组件 37/37/0。
- `client.js` 929,191 → **929,483 字符**。
- 备份：`online_models.js.bak-media`、`client.js.bak-20261027-093416`。

## 0.7.143 · 2026-10-27 · 修 instanceHeaders is not defined

### 报错

```
instanceHeaders is not defined
```

### 根因

`dictionaryRequest()` 每次请求都展开一份请求头：

```js
headers:{...instanceHeaders(), ...(body===undefined?{}:{"Content-Type":"application/json"})}
```

但 `function instanceHeaders()` 在 app.js 里**一次都没有定义**（`grep instanceHeaders` 只有这一处调用）。展开一个未定义的标识符不是"返回空对象"，是立刻 `ReferenceError`。

于是这三个入口一调就死：

| 调用点 | 挂掉的功能 |
|---|---|
| `migrateLegacyDictionary()` | 旧 localStorage 词库迁移 |
| `dictionaryRequest("search?q=…")` | 词库搜索 / 输入框补全 |
| `dictionaryRequest("status")` | 词库状态（条数、schema 版本） |

`CONSOLE_HEADERS` 定义得好好的（`{ "X-Console-Client": "1" }`），20 处请求都在用它，只有这一条走了一条不存在的路。判断是某次合并/清理时把函数定义带走了，调用点留在原地。

### 修法

补回唯一定义，放在 `CONSOLE_HEADERS` 下面，让两者共用同一份真相：

```js
function instanceHeaders() { return CONSOLE_HEADERS; }
```

**不发 token 是对的**。侧车 `_auth_ok()` 的第一道闸是「`X-Console-Client` 头 + 本机 Origin」，浏览器端根本不带 token，代码里 L2294 那条注释就写着这件事。实测无 token 请求 `GET /dictionary/status` 直接返回：

```json
{"ok": true, "schema_version": 1, "counts": {"entries": 335, ...}}
```

所以补的是「返回 CONSOLE_HEADERS」，不是「去补 token 逻辑」。

### 顺带扫了一遍同类风险

写了个启发式扫描：把 app.js 里所有顶层的 `function` / `const` / `let` / `var` 声明收成一个集合，再抓所有 `[a-z][A-Za-z0-9_$]{4,}(` 形式的调用，取差集。剩下的命中全是浏览器内建（`getItem` / `slice` / `assign` / `parse` / `render` / `componentDidCatch` 这些），没有第二个孤儿函数。

### 验证

- `instanceHeaders` 定义 1 处、调用 1 处（`dictionaryRequest` 里）。
- 侧车 `/dictionary/status` 无 token 直连通过，`entries: 335`。
- 7 页渲染长度不变、警告 0、组件 37/37/0。
- `client.js` 928,914 → **929,191 字符**。
- 备份：`app.js.bak-ih`、`client.js.bak-20261027-093159`。

## 0.7.142 · 2026-10-27 · 历史页移到预设前面

一级 tab 顺序从 `生成 / 风格卡 / 角色卡 / 词库 / 预设 / 历史` 调成：

```
生成 · 风格卡 · 角色卡 · 词库 · 历史 · 预设
```

理由是使用频率：出图之后看历史是连着的一步，预设是偶尔调一次的东西，压在最后更顺手。

只改了 tab 数组的排列：

```js
[["gen","生成"],["style","风格卡"],["card","角色卡"],["lib","词库"],["pv-output","历史"],["preset","预设"]]
```

渲染分派那段（`tab === "pv-output" ? h(...)`）本来就是按 key 逐条判断，跟数组顺序无关，所以没有连带改动。`client.js` 字符数 928,914 前后一致 —— 纯换位。

### 验证

- 渲染出的 tab 条实测：`生成 | 风格卡 | 角色卡 | 词库 | 历史 | 预设`。
- 7 页渲染长度全不变（133,366 / 120,547 / 116,470 / 156,528 / 117,556 / 109,929 / 136,338），警告 0；组件 37/37/0。
- 备份：`app.js.bak-taborder`、`client.js.bak-20261027-092959`。

## 0.7.141 · 2026-10-27 · LoRA 卡片支持右键改名

### 加这个的理由

上一版只有双击改名。双击在两种情况下不好使：

- 卡片是 `draggable`，按下时手稍微一动就被判定成拖拽，`dblclick` 直接丢了；
- 触控板上双击的点按节奏本来就不稳。

右键没这问题，而且和词库卡片的习惯一致（那边双击 / 右键同效）。

### 改动

卡片上加 `onContextMenu`：

```js
onContextMenu: (e) => {
  e.preventDefault();          // 压掉浏览器菜单
  e.stopPropagation();
  if (!editing) { setLoraEditText(shortNm); setLoraEditing(Ln); }
}
```

双击和右键走同一段逻辑，都只是「把这张卡切进编辑态」，提交路径仍然是 `loraRenameSave`。

编辑态的输入框自己也加了一条 `onContextMenu: (e) => e.stopPropagation()` —— 否则在输入框里右键会冒泡到卡片上，虽然 `editing` 已经是 true 不会重复触发，但会白白压掉输入框的粘贴菜单，改名时想粘个词都不行。

title 提示同步改成「单击选中 · 双击或右键改名 · 拖到上面的分类条换分类」。

### 验证

- `onContextMenu` 在 app.js 里共 4 处（词库卡片、词库分类 chip 原有两处，加 LoRA 卡片、LoRA 编辑框各一）。
- 注入 `loraEditing` 的渲染验证仍通过：编辑态输入框 `value=keqing_v3`、`draggable=false`、title「回车确认 / Esc 取消」。
- 7 页警告 0、组件 37/37/0。
- `client.js` 928,492 → **928,914 字符**。
- 备份：`app.js.bak-ctx-rename`、`client.js.bak-20261027-092820`。

## 0.7.140 · 2026-10-27 · LoRA 改名改成卡片内联输入

### 为什么换

0.7.137 的改名是双击 → `window.prompt`。这条路有两个问题：

1. **`window.prompt` 在 Electron 和很多嵌入 webview 里被直接屏蔽**，调用返回 `null` 且不报错 —— 表现就是「双击没反应」，用户根本不知道有这个功能。
2. 双击时浏览器会先派发两次 `click`，`toggleLora` 来回切了两遍，卡片先闪一下选中再弹框。虽然最后状态是对的，但观感很糙。

### 现在

双击卡片 → **文件名原地变成输入框**：

- `autoFocus`，`onFocus` 里 `select()` 全选，直接打字覆盖；
- **Enter** 提交，**Esc** 取消，**失焦**也提交；
- 编辑期间 `draggable={false}`，不会一边改字一边被拖走；
- 编辑期间 `onClick` 不再切选中（`if (!editing) toggleLora(Ln)`）；
- title 换成「回车确认 / Esc 取消」；
- Enter/Esc 用一个 `loraEditDone` ref 标记，避免提交后触发的 blur 再提交一次（第二次会拿旧名字去请求，后端回 404）。

输入框样式跟卡片对齐：22px 高、5px 圆角、`1px solid var(--c-accent)` 描边、`var(--c-panel)` 底，`flex:1` 占住文件名那一格，底模和两个操作符原地不动。

`loraRename` 整体改名为 `loraRenameSave(name)`，入参只剩文件相对路径，新名字从 `loraEditText` 取 —— 少传一个参数，也少一处可能对不上的地方。后端 `/loras/rename` 没动。

### 验证

- 静态：`loraRename(` 残留引用 0；`loraRenameSave` 定义 1、调用 2（Enter + blur）；`window.prompt("改个名字` 残留 0。
- DOM（注入 `loraEditing` 到第一张卡）：卡片内出现 `input`、`value=keqing_v3`、`draggable="false"`、`title="回车确认 / Esc 取消"`；同一张卡的文字只剩「Anima ↓ ×」（文件名被输入框替代），第二张卡仍是正常的「hutao_v2 Anima ↓ ×」。
- 7 页警告 0、组件 37/37/0。
- `client.js` 926,304 → **928,492 字符**。
- 备份：`app.js.bak-inline-rename`、`client.js.bak-20261027-092432`。

## 0.7.139 · 2026-10-27 · 修 LoRA 卡片挤成一列

### 现象

横条卡片上线后，实际打开是这个样子：一行只有一张卡，右边大片空白。窗口宽 1500px 的时候一屏只放得下两张。

### 原因

网格自己是 `display: grid` + `repeat(auto-fill, minmax(242px, 1fr))`，但它挂在 `S.scrollBox` 里：

```js
scrollBox: { display: "flex", flexWrap: "wrap", gap: "5px", maxHeight: "130px", overflowY: "auto" }
```

`S.scrollBox` 是 **flex**。网格作为 flex 子项，宽度按 `flex-basis: auto` 从**内容**算 —— 内容是"最少需要多宽"，于是网格先被挤到一张卡的宽度，`auto-fill` 拿这个宽度去算列数，结果永远是 1 列。窗口再宽也不会变，因为宽度根本不来自父容器。

### 修法

给网格补 `width: 100%` 和 `minWidth: 0`：

```js
{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(242px, 1fr))",
  gap: "6px", width: "100%", minWidth: 0 }
```

`width: 100%` 让它先撑满外层 flex 的宽度，`auto-fill` 才是按真实可用宽度算列数；`minWidth: 0` 防止 grid item 的 `min-content` 反过来把容器顶大。

按 1500px 宽的模态框算：`(1500 - 2×16 padding) / (242 + 6)` ≈ 5 列，一行五张。窗口窄到 700px 时落到 2 列，再窄 1 列。

### 顺带确认

- 词库网格没套 `S.scrollBox`（它是 `display: grid` 直接挂在普通容器上），不存在同一问题，未改。
- 截图里「未知 (1)」那个分类是拖进去的新文件 —— `_infer_model_base` 读不到 safetensors header 里的架构标记时如实返回「未知」，不是分类坏了。拖进 `角色/` 之类文件夹后它会跟着文件夹走，跟底模认不认识无关。

### 验证

- 构建后 `client.js` 里网格 style 实测含 `width: "100%"`。
- 7 页渲染无变化、警告 0、组件 37/37/0、LoRA 模态框注入渲染正常（分类条 4 组、搜索框、2 张横条卡）。
- `client.js` 926,196 → **926,304 字符**。
- 备份：`client.js.bak-20261027-091742`。

## 0.7.138 · 2026-10-27 · 绘图台的导入全部支持拖拽

### 起点

原来只有角色卡 / 风格卡那个导入区能接拖入（`.json` / `.dslcard` / `.dslrecipe`），其余导入都是一个 `<input type="file">` 挂在按钮后面，非得点开文件对话框。桌面版里文件对话框不一定弹得出来，这条路径本来就更脆。

这一版把拖入补齐，并且和按钮走**同一条处理通道**，没有第二套解析逻辑。

### 通用拖入 props

新增模块级 `dropFileProps(accept, onFiles, opts)`，返回 `{ onDragOver, onDragLeave, onDrop }` 三个事件：

- **只在 `dataTransfer.types` 里有 `Files` 时才接管**。这一条是必须的 —— 面板里已经有卡片拖拽排序、LoRA 拖分类、模型树拖移动这些内部拖拽，它们同样是 `dragstart/dragover`，不区分就会互相抢事件。
- 拖动经过时给宿主元素描 `2px dashed var(--c-accent)`，`outlineOffset: -2px`，离开或松手就还原。
- 取文件先走 `dataTransfer.files`，空的话退回 `dataTransfer.items[i].getAsFile()` —— 桌面版 Electron 偶尔只给 items。
- `accept` 是扩展名数组（不带点、小写），过滤后的 `good` 交给 `onFiles`，被拒的和「一个文件都没拿到」分别走 `onReject` / `onEmpty`，提示文案由调用点给。

### 接入的六处

| 位置 | 收什么 | 走哪条通道 |
|---|---|---|
| LoRA 菜单的卡片网格 | `.safetensors` `.pt` `.ckpt` `.sft` `.bin` `.zip` | `loraImportBuf(file)` → `POST /loras/import` |
| 词库的卡片网格 | `.json` | `importCards(file)` → `applyDictPack` |
| 工作流那个 textarea | `.json` `.png` `.webp` | `FileReader.readAsText` → `setWfText` |
| 「导入控制图」按钮 | `.png` | base64 → `POST /lllite/assets/add` |
| 角色卡「选择图片…」 | `png jpg jpeg webp gif` | `dropCoverFile` → 伪事件复用 `pickCoverFile` |
| 风格卡「选择图片…」 | 同上 | `dropStyleCoverFile` → 复用 `pickStyleCoverFile` |

封面两处都是包一个 `{ target: { files: [f] } }` 的伪事件去调原来的选择器，压缩到 360px、JPEG 0.82、180KB 上限这些检查全都不用重写一遍。

工作流那个也顺带把 placeholder 改了：「把 ComfyUI 的工作流 JSON 粘到这里，或直接把 .json / .png 拖进来」——`.png` 里常带 `workflow` 段，交给后面的解析器自己判断。

### 验证

- 静态接线检查：`dropFileProps` 定义 1 处、调用 6 处；`dropCoverFile`、`dropStyleCoverFile` 各 1 定义 1 调用；六个导入点按锚点就近搜索全部命中；卡片导入原有的 drop 注释仍在。
- 7 页渲染无变化（gen 133,366 / style 120,547 / card 116,470 / lib 156,528 / preset 117,556 / pv-output 109,929 / pv-online 136,338），警告 0；组件 37/37/0。
- LoRA 模态框注入渲染仍正常：分类条 4 组、搜索框、2 张横条卡。
- `client.js` 920,980 → **926,196 字符**。
- 备份：`app.js.bak-drop`、`client.js.bak-20261027-091453`。

### 括号上踩了两次

`Object.assign({ style: … }, dropFileProps(…))` 是**两个**闭合括号，第一次把 `}))` 写成 `})`（词库）、第二次把 `})))` 写成 `}))`（工作流 textarea），都是 `node --check` 立刻抓出来的。这类嵌套改动用 `--check` 兜着比肉眼数括号可靠。

## 0.7.137 · 2026-10-27 · LoRA 卡片改横条，支持双击改名与拖拽换分类

### 需求

上一版做成 96px 的 1:1 方格，竖排看得下但每个只放得下三行文件名。改成：

- 卡片横排（一条一行放完）；
- 双击改名；
- 拖到分类条上换分类；
- 删除沿用原来的 `×`。

### 卡片横排

网格 `repeat(auto-fill, minmax(242px, 1fr))`、`gap 6px`，单个卡片：

```js
{ height: "32px", borderRadius: "8px", padding: "0 6px 0 9px",
  display: "flex", flexDirection: "row", alignItems: "center", gap: "7px",
  background: on ? "var(--c-accent-bg)" : "var(--c-panel2)",
  border: "1.5px solid " + (on ? "var(--c-accent)" : "var(--c-line)"),
  cursor: "grab" }
```

一行从左到右：文件名（`flex:1`，单行省略）、底模（`9.5px`、`--c-fg5`、最多 74px）、`↓` 导出、`×` 删除。底色与描边仍跟词库一致，选中就直接换色。

### 双击改名：`/loras/rename`

`sidecar_loras._loras_rename(name, new_name)`：

- `new_name` 只取 basename，带路径会被砍掉；
- 不带扩展名时沿用原文件扩展名，防止把 `.safetensors` 改成 `.txt` 之后 ComfyUI 认不出；
- 拒绝 `/\:*?"<>|`；
- 同目录同名直接拒绝，不覆盖；
- 返回新的相对路径（`name`），前端据此把 `selLoras` 里的旧名字换掉，选中状态不丢。

浏览器侧 `window.prompt` 预填当前主名，确认后 POST。`fetch` 的 body 是 `JSON.stringify`，走 UTF-8，中文文件名没问题。

### 拖拽换分类：`/loras/move`

**分类本来就是文件夹位置决定的**，所以「拖到分类上」不需要另存一张映射表，直接挪文件：

- 拖到文件夹组 → `folder = 该文件夹名`，`_loras_move` 里 `os.makedirs` 现建目录再 `shutil.move`；
- 拖到根目录散文件的底模组（如 `Anima`）→ `folder = ""`，挪回 `models/loras` 根；
- `..`、`.` 段被过滤掉，`_trash*` / `_dshcards` 前缀拒绝写入；
- 目标已有同名文件则拒绝，不覆盖。

前端：卡片 `draggable`，`onDragStart` 记名字、`onDragEnd` 清空；分类 tab 上 `onDragOver` 高亮（绿底 + 绿下划线），`onDrop` 调移动。拖起时卡片 opacity 降到 0.4。

### 验证

- 后端往返实测（真实 `models/loras`，测完复原）：`move → rename（ASCII）→ rename（中文）→ 改回原名 → 挪进「角色」→ 挪回根目录`，全部 `ok=True`；重名返回「同目录已经有…」；`folder='../..'` 被过滤成挪到根目录，无穿越。
- DOM 验证：网格 2 张卡、`flex-direction:row` 与 `height:32px` 均命中、`draggable="true"`、title 末行为「单击选中 / 双击改名 / 拖到上面的分类条换分类」。
- 7 页渲染长度不变、警告 0、组件 37/37/0、构建 `+0 字符`、后端 16 个 py 全过。
- `client.js` 917,557 → **920,980 字符**。
- 备份：`app.js.bak-lorah`、`client.js.bak-20261027-091207`、`sidecar_loras.py.bak-rename`、`expander.py.bak-rename`。

### 注意（PowerShell 侧的坑）

用 `Invoke-WebRequest -Body` 传字符串时，PS 5.1 按 ISO-8859-1 编码，中文会变成 `?`，测出来像是后端不肯收中文名。改用 `[Text.Encoding]::UTF8.GetBytes()` 传字节就正常。浏览器 `fetch` 不受影响。

## 0.7.136 · 2026-10-27 · LoRA 菜单按文件夹 / 底模分类，改成卡片网格

### 需求

LoRA 二级菜单原来是一排平铺 chip。改成：

- 顶部分类条，样式跟主面板那排一级 tab 一致；
- 分类依据优先取 `models/loras` 下的文件夹，根目录散文件按底模归类；
- 列表改成风格卡那种卡片网格；
- 带搜索框。

### 侧车：`/loras` 补底模字段

`expander.py` 的 `/loras` 路由不再直接吐 `_loras_list()`，而是给每项补一个 `base`：

```python
fp = os.path.join(root, str(it.get('name') or '').replace('/', os.sep))
it['base'] = ALINE._infer_model_base(ALINE._read_safetensors_metadata(fp))
```

底层 `_model_header_info_cached` 按 realpath+size+mtime 缓存。实测 20 个 LoRA：首次 120 ms，二次 36 ms。`?base=0` 可跳过这一步。

顺手补了 `_infer_model_base` 的 Anima 分支。之前它不认识 Anima，落到「返回原始值」兜底，20 个 LoRA 出来是 `anima-preview/lora` 和 `Anima/lora` 两种写法——大小写不同，会被拆成两个分类。加一行归一：

```python
if 'anima' in joined:
    return 'Anima'
```

归一后 20/20 全部是 `Anima`。

### 前端：文件夹即分类

新增 `loraGroupsOf(names, meta, cards)`：

- `meta[nm].folder` 有值 → **文件夹第一级就是分类名**。在 `models/loras` 里建 `角色`、`画风` 之类的文件夹就等于自定义分类，**移动文件即改分类**，不用额外维护映射表。
- 文件夹名命中 `角色|人物|character|char|chars` → 统一归「角色」组。
- 根目录散文件 → 按 `meta[nm].base` 分组；被角色卡 `loras` 引用的也算角色。
- 组顺序：角色最前，其余按条目数降序、同数按名字。

### 前端：模态框

- 宽度 720 → `min(1120px, 95vw)`，容得下网格。
- 搜索框在顶部，跨分类过滤，命中数写进 placeholder；有词时右侧出「清空」。
- 分类条复用一级 tab 的样式 token（`S.tab` / `S.tabOn` / `S.tabOff`），标签写成 `角色 (2)` 这种带计数的形式。
- 网格与卡片跟**词库小卡片**同一套：`repeat(auto-fill, minmax(96px, 1fr))`、`gap 8px`、`aspectRatio 1/1`、`borderRadius 10px`、`padding 7px 7px 6px`、`--c-panel2` 底 + `1.5px` `--c-line` 描边，选中换成 `--c-accent-bg` 底 + `--c-accent` 描边。**不铺封面图**，纯文字。
- 卡片上半是文件名（12px / 600 / `wordBreak: break-all`，三行截断），下半是底模（9.5px / `--c-fg5`，单行省略）+ 两枚小操作符 `↓`、`×`（`stopPropagation`，不触发选中）。
- 点卡片任意位置 = 切换选中，`userSelect: none`。

元数据在拉 `loras` 的同一处补一次 `jget(EXPANDER + "/loras")`，解析成 `{ name: { base, folder } }` 存进 `loraMeta`。`loras` 本身仍是 `string[]`，`selLoras` / `toggleLora` / 导入导出删除全部没动。

### 验证

- `loraGroupsOf` 单测：6 个 LoRA 分 4 组，角色在最前（`角色 (2) | SDXL (2) | Anima (1) | Pony / SDXL (1)`）。
- 模态框 DOM 验证：搜索框 placeholder 为 `搜索 LoRA 名字（6 个）`；分类条 4 个 tab；当前组网格 2 张卡，卡内含首字、底模角标、短名、导出与删除按钮。
- 7 页渲染无变化（gen 133,366 / style 120,547 / card 116,470 / lib 156,528 / preset 117,554 / pv-output 109,929 / pv-online 136,338），警告 0；组件 37/37/0；构建 `+0 字符`；后端 16 个 py 全过。
- `client.js` 912,052 → **918,272 字符**。

### 测试自身踩的坑（记一下）

1. `placeholder` 不进 `textContent`，用 `textContent` 查搜索框永远是 0。
2. 标题是 `<span>`，用 `querySelectorAll('div')` 找不到。
3. `loras` 的 `useState` 在文件里有两处（L5478 属于另一个组件、L7208 属于 Console），`String.replace` 只替换第一个，注入打偏。
4. `loraMeta` 那行尾部带注释，用不含注释的整行去匹配匹配不上。

- 备份：`client.js.bak-20261027-090411`、`app.js.bak-loracat`、`expander.py.bak-lora-base`、`sidecar_aline.py.bak-anima`。

## 0.7.135 · 2026-10-27 · 内置风格卡标注 Anima

三张内置风格卡（`st-mochi` / `st-clean` / `st-paint`）本来就是给 Anima 底模写的画风描述，所以给它们标注上。

### 没有写死底模文件名

直觉做法是给内置卡补 `baseModels: ["kirazuriAnima_v30AnimaBase1.safetensors"]`。不这么做，两个原因：

1. 那是**本机**的模型文件名（`kirazuri` 是画师名 + 版本号），换台机器、换个 Anima 版本，编辑器就会报「缺失底模」。
2. `baseModels` 的语义是「这张卡依赖的具体底模文件」，参与 `missingBaseModels` 校验。用它装一个族名（`"Anima"`）会让校验永远失败。

所以新增一个**纯展示字段** `modelFamily`：

```js
{ id: "st-mochi", modelFamily: "Anima", name: "もちづけい · 官方画风", note: "...", tags: base },
```

它不进入 `_styleBm`，不参与任何校验，只被 `bmBadge` 读来做标签。

### 显示优先级：具体底模 > 模型族 > 未标注

```js
if (list.length) { /* 用户亲手填的文件名，最准 */ }
if (fam)         { /* 内置卡的族名 */ }
/* 否则 "未标注底模" 虚线 */
```

这样三种情况都合理：

| 卡 | `baseModels` | `modelFamily` | 标签 |
|---|---|---|---|
| 内置三张 | 空 | `Anima` | **Anima** |
| 内置卡被用户填了具体底模 | 有 | `Anima` | 具体文件名（族名退到 title） |
| 用户自建卡 | 空 | — | 未标注底模（虚线） |
| 用户自建卡 | 有 | — | 具体文件名 |

具体底模压过族名，因为那是用户亲手填的、比内置粗标更准。

### 编辑内置卡不会丢标注

`saveStyleCard` 的 `rec` 是对象字面量，里面没有 `modelFamily` 键；`allStyleCards` 合并走 `Object.assign({}, out[i], c)`——只复制自有可枚举属性，缺这个键就不覆盖，内置的 `Anima` 保留。

### 验证

- `bmBadge` 单测 **7/7**：内置卡族名、填了具体底模、具体优先于族名、多底模 `+1`、只 `ckpt`、全空、`model` 别名。
- 渲染：`style` 页 3 个标签文本均为 `Anima`，非虚线，父容器仍是右上 `flex-direction:column`；页长 120,700 → 120,547（`未标注底模` 与 `Anima` 同宽，差在虚线与半透明样式）。
- `node --check` 通过；重建 912,066 → **912,052 字符**；模块 id ok。

- 备份：`client.js.bak-20261027-085451`、`client.js.bak-20261027-085542`。

## 0.7.134 · 2026-10-27 · 适配底模标签改到右上角

0.7.133 把它放在右下角（`bottom: 6px, right: 6px`）。但风格卡右上角已经有「已插入 / 部分移除」角标（`top: 6px, right: 6px`），两处都在右侧，改到右上就会直接重叠。

所以不是一个 `span` 换个定位，而是把右上角改成**纵向 flex 容器**：

```js
h("div", {
  style: { position: "absolute", top: "6px", right: "6px", zIndex: 6, display: "flex",
           flexDirection: "column", alignItems: "flex-end", gap: "4px",
           maxWidth: "calc(100% - 12px)", pointerEvents: "none" },
},
  ins ? h("span", { /* 插入角标，去掉原来的 absolute */ }) : null,
  h("span", { /* 适配底模标签，去掉原来的 absolute */ }),
)
```

- 插入状态在上、适配底模在下，`gap: 4px` 不贴边。
- 两个子元素都去掉了自己的 `position: absolute`，改由容器统一摆位——否则 `absolute` 会相对最近定位祖先生效，跟容器打架。
- 容器带 `pointerEvents: "none"`：两个角标都不可点，点击穿透到卡片本身（点卡要能选中/取消选中）。
- 卡没插入时 `ins` 为假，容器里只剩底模标签，`children.length === 1`。

验证（DOM 解析渲染结果）：

- `style` 页 120,415 → **120,700 字符**。
- 3 个底模标签，父容器 style 均为 `position:absolute;top:6px;right:6px;z-index:6;display:flex;flex-direction:column;align-items:flex-end;gap:4px;max-width:calc(100% - 12px);pointer-events:none`。
- 仍带 `bottom: 6px` 的 `span`：**0 个**（旧定位已完全移除）。
- 标签自身 `max-width: 100%`（原先是 `calc(100% - 12px)`，现在由容器负责这一层），长模型名仍然 `ellipsis`。
- `node --check` 通过；重建 911,453 → **911,677 字符**；模块 id ok；7 页渲染 0 崩溃、0 雷同、0 警告。

- 备份：`client.js.bak-20261027-085324`。

## 0.7.133 · 2026-10-27 · 风格卡右下角标注适配底模

### 需求

风格卡卡片右下角加一个标签，标注这张卡适配哪个底模。

### 数据源：已有字段，不新增

风格卡早有 `baseModels`（数组，存底模文件名），角色卡编辑器与风格卡编辑器都在用，还有 `missingBaseModels` 校验链路。取值函数 `_styleBm(d)` 也已经写好：

```js
function _styleBm(d) {
	const a = _cardBm(d);            // baseModelsText 优先，其次 baseModels 数组
	if (a.length) return a;
	const c = String((d && d.ckpt) || "").trim();   // 1.0 的老卡只有 ckpt
	return c ? [c] : [];
}
```

所以不需要动数据模型，只做展示。

### 实现

新增 `bmBadge(c)`（`app.js` L1159），把底模路径压成短名：去掉目录、去掉 `.safetensors`/`.ckpt`/`.pt`/`.pth`/`.bin`/`.gguf` 后缀，多个底模时补 `+N`。返回 `{ text, full, muted }`。

在 `styleTile` 的封面容器（`position: relative`，`overflow: hidden`）里，封面之后插入标签：

```js
h("span", {
  style: { position: "absolute", bottom: "6px", right: "6px", zIndex: 6,
           fontSize: "10.5px", lineHeight: "15px", padding: "0 6px", borderRadius: "5px",
           background: "rgba(10,10,12,.66)", color: "rgba(255,255,255,.92)",
           border: "1px solid rgba(255,255,255,.16)", pointerEvents: "none", ... },
  title: b.full,
}, b.text)
```

要点：

- `pointerEvents: "none"`——标签不能拦住卡片的点击（点卡要能选中/取消选中）。
- 位置在 `bottom: 6px, right: 6px`，右侧 `top: 6px` 已有「已插入」角标，两者不冲突。
- `maxWidth: calc(100% - 12px)` + `ellipsis`，长模型名不会撑破卡片。

### 没填底模时也占位

内置的 3 张风格卡（`st-mochi` / `st-clean` / `st-paint`）都没有 `baseModels` 也没有 `ckpt`——它们是硬编码的通用画风描述，本来就不绑定具体底模。若空值时不渲染，这个功能在内置卡上完全看不见。

所以空值时标签显示 **「未标注底模」**，样式转为半透明 + 虚线边框，`title` 提示「这张卡还没填适配底模。点「编辑」→「适配底模」补上，之后右下角就会显示具体模型名」。

这里刻意**没有**给内置卡硬编码本机模型名（如 `kirazuriAnima_v30AnimaBase1.safetensors`）：那样换台机器、换个底模就变成「缺失底模」告警，是错的标注。标签只反映卡上真实存了什么。

### 验证

- `bmBadge` 单测 9/9：单底模、多底模（`+1`）、带目录、`ckpt` 兜底、`baseModelsText` 优先、空卡/空数组/空字符串项、反斜杠路径。
- 渲染验证：`style` 页 119,113 → **120,415 字符**（+1,302），3 张内置卡各出现一个「未标注底模」标签；`card` 页 0 处（角色卡本次不动）。
- `node --check` app.js 通过；重建 911,181 → **911,453 字符**；模块 id ok。

- 备份：`client.js.bak-20261027-085129`、`client.js.bak-20261027-085158`。

## 0.7.132 · 2026-10-27 · 打包前检查：修 React key，全量体检通过

### 修掉的真 bug：两处列表缺 key

`styleTile`（L10971）与 `cardTile`（L11310）返回的根 `h("div", ...)` 没有 `key`，而它们在 `cards.map(...)` 里被当作列表项：

```js
cards.map((c) => styleTile(c))   // 每个元素无 key
```

React 开发模式直接报 `Each child in a list should have a unique "key" prop`。渲染冒烟测试里 `style` 页命中，`card` 页因测试环境角色卡列表为空而没触发——**两处都缺**，一起补：

```js
h("div", { key: c.id || c.name, style: { ... } },
```

补后 7 个页面的警告数全部归零。`client.js` 910,035 → 910,077 字符（+42）。

### 检查手段的修正（上一轮的"全过"是假象）

首版冒烟测试用 `globalThis.__TEST_TAB__` 注入初始 tab，7 个页面渲染长度全一样。查下来：

```
vm.createContext(w) 之后
  vm 内 globalThis === this   → false
  vm 内 window  === globalThis → false
```

jsdom 的 `window` 被 vm contextify 后，**vm 内的 `globalThis` 不是 jsdom 的 `window`**。所以 `globalThis.__TEST_TAB__` 恒为 `undefined`，7 个页面全落在默认 tab `gen` 上，输出自然字节相同。

`client.js` 用的是 `window.__ModuleLoader__`，走的是 jsdom window，所以加载一直正常——这个差异掩盖了问题。

改成 `window.__TEST_TAB__` 后，7 个页面真实渲染长度：

| 页面 | 字符数 |
|---|---|
| 生成页 gen | 133,366 |
| 风格卡 style | 119,113 |
| 角色卡 card | 116,470 |
| 词库 lib | 156,528 |
| 预设 preset | 117,554 |
| 历史页 pv-output | 109,929 |
| 在线模型库 pv-online | 136,338 |

两两互不相同，无 `TabBoundary`/`RootBoundary` 降级文案。

### 检查结论

| 项 | 结果 |
|---|---|
| 前端 8 个 JS `node --check` | 全过 |
| 后端 35 个 py `py_compile` | 全过，0 失败 |
| `verify_client.js` 模块工厂 | 执行成功，导出 `apply` / `inject` |
| `scan_components.js` | 37 引用 / 37 定义 / **0 缺** |
| 构建一致性 `--check` | `+0 字符`，模块 id ok |
| 7 个页面真实渲染 | 全过，0 崩溃，0 雷同 |
| React 运行时警告 | 修复后 **7 个页面全 0 条** |
| 模块顶层 TDZ（AST 精确） | **0 处** |
| 后端 GET 回归 | **20/20** |

TDZ 那步踩了两次误报，值得记下：

1. 正则版报 16 条，全在嵌套函数/`useEffect` 回调里，运行时求值，不是 TDZ。
2. 改 AST 只扫顶层同步位置后报 3 条 `h`，实际是 `presets.js` 里的对象字面量 `{ w: 896, h: 1152 }`——`h` 是**键名**，不是变量。
3. 再查 6 条里剩的 4 条：2 条在 `parseWorkflow` 的 `try` 块内（`function` 声明会提升），2 条是 `let h = 0` 的**局部变量**。

结论：**零顶层 TDZ**。

### 遗留：18 个死代码，合计 4,029 B（未删）

用 acorn 做真正的引用计数（排除声明位、`Property` 键名、`MemberExpression` 属性名、参数、label），顶层 339 个声明里有 18 个引用数为 0：

```
translateCn            612B   dict.js      （原 export，构建时剥掉后在包内无人调用）
IMAGE_SIZE_PRESETS     596B   app.js
rebuildDict            457B   app.js
dictAllPaths           372B   app.js
postContext            365B   app.js
modelEncoderCount      332B   app.js
consumeFirstTutorialUse 323B  app.js
postDims               224B   app.js
persistPresetList      190B   app.js
modelNeedsVae          136B   app.js
NO_HIGH_NEG             83B   app.js
dictParent              79B   app.js
ONLINE_BASE_QUICK       90B   online_models.js
ONLINE_BASES            65B   online_models.js
SEEDS_ADDED             34B   app.js
DRAG                    28B   app.js
ONLINE_PAGE_SIZE        26B   app.js→online_models.js
RENDER_N                17B   app.js
```

顺带纠正一个正则版假阳性：`OUTPUT_TIME_FILTERS` 被判死，实际 `app.js:6525` 有 `...OUTPUT_TIME_FILTERS.map(...)`，spread 语法被 `[^\w$.]` 排除掉了。AST 版计数为 1，不是死代码。

这 4 KB 收益太小、`translateCn` 又牵扯对外 export，本轮不动，留作可选清理项。

- 验证：`node --check` app.js / client.js 通过；`node tools/build_client.mjs` 重建后 910,077 字符；7 页面渲染 + 0 警告；后端 20/20；`/version` stale=false。
- 备份：`client.js.bak-20261027-084735`。

## 0.7.131 · 2026-10-27 · 分发改用发布包

决定：后续分发使用**发布包**（只带运行时产物与 sidecar），前端源文件与开发工具留在仓库不进包。

### 包体积

| | 0.7.130 | 0.7.131 |
|---|---|---|
| 压缩包 | 2,715,670 B（2.59 MB） | **550,496 B（0.52 MB）** |
| 解包后 | — | **1,863,049 B（1.78 MB）** |
| 文件数 | 77 | **43** |

压缩后 **-80%**。

### `files` 收成运行时集（42 项）

保留：`lib/client.js`（产物）、`lib/index.js`（host 入口）、`expander.py`、13 个 `sidecar_*.py`、`sidecar_aline.py`、`aline_mods/` 的 14 个 `.py`（显式展开）、`dictionary_seed.json`、`install_post_controls.py`、`install_translation.py`、`face_models.py`、`comfy_nodes/`、`config.example.json`、`cordis.patch.yml`、`routes.json`、`lora来源.json`、`README.md`、`CHANGELOG.md`、`install.ps1`、`docs/`。

排除：`lib/app.js` `lib/online_models.js` `lib/workflow.js` `lib/dict.js` `lib/dictcard.js` `lib/presets.js`（前端源，合计 ~960 KB）、`tools/`（全部开发工具，含 `build_client.mjs` 与 `build_client.py`）。

本地开发完全不受影响：源文件与 `tools/build_client.mjs` 都在磁盘上，`node tools/build_client.mjs --check` 照报 `差异: +0 字符` / 模块 id ok。

### `inPlace` 改成精确文件，保护本地源

原来 `inPlace` 里是 `lib/` 整个目录。若宿主按目录替换，精简后的包会把本地 6 个前端源**删掉**。改成 `lib/client.js` + `lib/index.js` 两项精确路径，无论宿主是逐项复制还是目录替换，都不会碰源文件。

同时把 `tools/build_client.py` 从 `inPlace` 移除（开发工具不再随包分发）。`inPlace` 现 23 项，全部被 `files` 覆盖。

### 顺带清掉的问题

`npm pack` 首次产出里混进了 `__pycache__`：`aline_mods/__pycache__/online_models.cpython-312.pyc`（96,000 B）与 `tag_dictionary.cpython-312.pyc`（91,937 B），共 188 KB。字节码缓存不该分发——Python 版本不符会直接崩。处理：清掉本地三处 `__pycache__`（根目录、`aline_mods`、`tools`）；`aline_mods/` 在 `files` 里由目录改为 **14 个 `.py` 显式展开**；新增 `.npmignore` 兜底（`**/__pycache__/` `**/*.pyc` `.build-backup/` `**/*.bak-*` 等）。

### 包内构成（解包后 top 6）

```
lib/client.js          988,325 B
CHANGELOG.md           174,668 B
sidecar_aline.py       139,946 B
aline_mods/tag_dictionary.py   62,402 B
aline_mods/online_models.py    57,264 B
expander.py             52,189 B
```

- 验证：`npm pack --dry-run` 43 文件、无 `__pycache__`/`.pyc`/`.bak`；8 项关键文件（`lib/client.js` `lib/index.js` `expander.py` `sidecar_aline.py` `dictionary_seed.json` `comfy_nodes/dsh_post_controls/__init__.py` `aline_mods/tag_dictionary.py` `cordis.patch.yml`）全部在包内；5 项应排除项（6 个前端源与 2 个 build 脚本代表项）全部已排除；`node tools/build_client.mjs --check` 通过；`/version` stale=false。

## 0.7.130 · 2026-10-27 · 去依赖：Node 构建 + 分发清单对齐

目标：去掉对构建期 Python 的依赖，把分发白名单与运行时实际文件对齐，为插件化铺路。

### 审计结果

| 依赖项 | 状态 | 处理 |
|---|---|---|
| `scripts.build:client` → `python tools/build_client.py` | **真依赖**，装包机器未必有 Python | 改为 `node tools/build_client.mjs` |
| `files` 白名单漏 9 项 A 线文件 | **真缺陷**，`npm pack` 出来 A 线全缺 | 补齐 |
| `lib/index.js` 的 Python 解释器 | 干净：`cfg.pythonExe` → `comfyRoot/python_embeded/python.exe`，`python.exe`→`pythonw.exe` 自动替换 | 无需改 |
| `lib/index.js` 的 `import` | 只有 Node 内置：`child_process` `net` `fs` `path` `url` | 无需改 |
| ComfyUI 目录探测 | 多候选列表（`D:\ComfyUI\ComfyUI_windows_portable` 等），逐项 `existsSync` | 合理保留 |
| `cordis.patch.yml` | 3 行，`name: 'dsh-comfyui-console'` | 无需改 |
| `config.example.json` | 仅 `_note` 说明文字，无绝对路径 | 无需改 |
| `dsh.client.inject` | `[]`，无跨插件 slot 依赖 | 无需改 |
| 各 sidecar 的 `python.exe` 定位 | 全部从 `comfyRoot` 推导或多候选 `shutil.which` | 合理保留 |

### 实施

**1. 新增 `tools/build_client.mjs`**（纯 Node，ESM）：照搬 Python 版全部语义——分段标记校验、`export` 剥离、`\t\t` 缩进、`exports.apply` 尾巴锚点、包外 `.build-backup/` 备份、模块 id 与 `package.json` `name` 一致性检查、`--check` 只比对模式。

等价性验证：`node tools/build_client.mjs --check` 与 `python tools/build_client.py --check` **结果完全一致**（`client.js 与源文件一致`、`差异: +0 字符`、`[ok] 模块 id = dsh-comfyui-console`）。

**2. `scripts` 改用 Node**：
```json
"build:client":     "node tools/build_client.mjs",
"check:client":     "node tools/build_client.mjs --check",
"build:client:py":  "python tools/build_client.py"
```
Python 版保留作备选，不再是必需路径。

**3. `files` 补齐 9 项**：`sidecar_aline.py` `aline_mods/` `dictionary_seed.json` `install_post_controls.py` `install_translation.py` `face_models.py` `comfy_nodes/` `lora来源.json` `tools/build_client.mjs`。

`files` 35 项 / `inPlace` 23 项，**`inPlace` 已全部被 `files` 覆盖**（此前 8 项只在 `inPlace` 里，分发必缺）。

**4. 发布包实测**：`npm pack --dry-run` → **77 个文件 / 2,715,670 B**，12 项关键文件（`lib/client.js` `lib/app.js` `lib/index.js` `expander.py` `sidecar_aline.py` `dictionary_seed.json` `comfy_nodes/dsh_post_controls/__init__.py` `face_models.py` `install_post_controls.py` `install_translation.py` `tools/build_client.mjs` `cordis.patch.yml`）**全部在包内**。

### 仍然存在（可选，未做）

`lib/` 里同时放了 6 个源（`app.js` 828 KB、`online_models.js` 80 KB、`workflow.js` 17 KB、`dict.js` 15 KB、`dictcard.js` 12 KB、`presets.js` 9 KB，合计 ~960 KB）和产物 `client.js`（988 KB），包体积因此约翻倍。若只为分发，可只带 `client.js` + `index.js`（约 1.1 MB），源文件走仓库不进包——这需要区分「开发包」与「发布包」，眼下保持全带，源码可审计优先。

- 验证：`node tools/build_client.mjs` 跑通（`已是最新，无需重建` + 模块 id ok）；`npm pack --dry-run` 清单齐全；`/version` stale=false。
- 备份：`.build-backup/` 保留全部历史 `client.js.bak-*`。

## 0.7.129 · 2026-10-27 · A 线并入原线，取消中间层模块

需求：原线是一个分支、A 线是另一个分支，前几轮把 A 线的功能拆给了原线；现在要**整合进原线**，为去依赖化与分发做准备。

### 为什么必须并回去

0.7.126 把 `PreviewConsole` + `PBG` 拆到 `lib/preview_console.js`，但那只是**物理拆文件**，不是解耦。实测依赖方向：

| 方向 | 数量 |
|---|---|
| `preview_console.js` → `app.js` | **98 个顶层符号**（`h`(419) `React`(205) `S`(97) `EXPANDER`(32) `errText`(31) `PromptIcon`(29) `jget`(26) `jpost`(21) `USER`(19) `COMFY`(16) …） |
| `preview_console.js` → 其它源 | 1 个（`OnlineModelsPanel`） |
| `app.js` → `preview_console.js` | 1 个（`PreviewConsole`，5 处 `h()`） |
| `preview_console.js` 自身顶层声明 | 2 个（`PreviewConsole`、`PBG`） |

98 : 1 的悬殊说明它是寄生在宿主作用域上的叶子组件——能跑的唯一原因是 `build_client.py` 把 7 个源拼进同一函数体、共享作用域。这种"假独立"对分发是负担：单看那个文件毫无意义，删了主文件它立刻崩。

### 合并前置校验

用 acorn 得到 `app.js` 全部 285 个顶层声明的位置，逐一核对 `preview_console.js` 引用的 98 个符号：

- 声明在 `Console`（原 L5332）之前：**98 个**
- 声明在之后（TDZ 冲突）：**0 个**

因此把整块插到 `function Console()` 之前，零 TDZ 风险。

### 实施

1. `preview_console.js` 正文 1,752 行 / 151,408 B 整体插到 `app.js` 的 `function Console()` 之前，加一段来源说明注释。
2. 删除 `lib/preview_console.js`。
3. `build_client.py` 的 `SOURCES` 回退为 6 项：`('dict','presets','workflow','dictcard','online_models','app')`。
4. `client.js` 删掉 `来自 lib/preview_console.js` 分段标记与内容（L1803–L3559），重建自动重填。

### 结果

| | 0.7.127/128 | 0.7.129 |
|---|---|---|
| 源文件数 | 7（+`client.js`/`index.js`） | **6** |
| `app.js` | 676,259 B / 9,842 行 | **828,197 B / 11,601 行** |
| `preview_console.js` | 151,744 B | **已删除** |
| `client.js` | 910,019 字符 | **910,035 字符**（+16，来源注释） |

结构：`PreviewConsole` L5339 → `PBG` L6921 → `Console` L7091，顺序与原 A 线一致，`PreviewConsole` 在 `Console` 之前符合引用关系。

死代码清理的收益完整保留：`app.js` 828 KB 仍比 0.7.125 的 929,719 B **少 101,522 B**。

- 验证：`node --check` app.js / client.js 全过；TDZ 扫描 16 条与合并前逐条一致（均为嵌套函数或 `useEffect` 回调内引用，运行时求值，非真风险）；`verify_client.js` 工厂执行成功；`scan_components.js` 37/37/0；`/version` stale=false。
- 备份：`lib/app.js.bak-0.7.129`、`lib/preview_console.js.bak-0.7.129`、`.build-backup/client.js.bak-20261027-163437`。

## 0.7.128 · 2026-10-27 · 修崩溃：BG.tasksSnapshot 与分段标记污染

两个运行时崩溃，都出在 0.7.126 的模块拆分上。

### 崩溃 1：`BG.tasksSnapshot is not a function`

根因链条：
1. `preview_console.js` 末尾有一段「BG 兼容桥」（v0.7.94 补丁），在**模块顶层**把 `PBG` 的成员挂到 `BG` 上；
2. `BG` 是 `app.js:1009` 的 `const`，而 `SOURCES` 把 `preview_console` 排在 `app` **之前**；
3. 顶层执行桥代码时 `BG` 还在 TDZ，`(k in BG)` 抛 `ReferenceError`，被 `catch (e) { }` **静默吞掉**；
4. 桥一次也没生效 → `PreviewConsole` 里 `BG.tasksSnapshot()` 方法不存在 → 首屏渲染即崩。

修法：`PreviewConsole` 本来就该用 A 线的 `PBG`，把 `preview_console.js` 里 11 处 `BG.` 全部改为 `PBG.`，删掉顶层兼容桥（`try { [...].forEach ... } catch {}`），并把注释改成说明这段历史。`PBG` 的 `tasksSnapshot / adopt / run / retrySave / cancel / progress / shutdown / setJob / startWatch / stopWatch / jobs / emit / subscribe / snapshot / clear` 全部存在（`adopt`/`retrySave`/`cancel` 是 `async`）。`app.js` 自己的本地 `BG` 不受影响。

### 崩溃 2：`ReferenceError: Cannot access 'sizeMultiplier' before initialization`

报错栈里的 `rev=875d9bf14853` 是 0.7.126 **之前**的旧 bundle，当前代码已无此问题：`app.js` 里 `sizeMultiplier` 声明在 L5531，最小引用在 L5556，顺序正常。补了一道 **TDZ 静态扫描**（`日志\comfyui-console-对比\tdz_scan.js`），对 `Console` 与 `PreviewConsole` 的每个 `const [a, b]`、`const x` 检查「首次出现行 < 声明行」，报出的 16 条逐条核验后**全部是嵌套函数/`useEffect` 回调里的引用**（运行时求值，不触发 TDZ），无需改动。

### 顺带修掉的分段标记污染

`restore_dce.js` / `restore_pw.js` 从 `client.js.bak` 提取函数体还原时，把备份里的 `// ==== … 来自 lib/dictcard.js ====` 标记行也一起抄进了 `dictcard.js`（以及 `workflow.js:16`）。`build_client.py` 的 `MARK_RE` 匹配到第 8 个标记，`found != SOURCES` 直接 `raise SystemExit`，**拒绝重建**且不写文件——于是每次重建都失败、bundle 停在旧态。

处理：清掉 `dictcard.js` / `workflow.js` 里的标记行；`client.js` 从干净的 `.build-backup/client.js.bak-20261027-162414` 恢复，再删掉 `dictcard` 段末尾多出的那行重复标记；重建通过。

- 最终：`client.js` **910,019 字符**，`preview_console.js` 151,744 B，`workflow.js` 17,375 B（含还原的 `parseWorkflow`）。
- 验证：`node --check`（7 源 + bundle）全过；`verify_client.js` 模块定义捕获 ok、工厂执行成功；`scan_components.js` 37/37/0；bundle 内 `PBG.tasksSnapshot` 2 处、`BG.tasksSnapshot` **0 处**、兼容桥**无残留**；`/version` `loaded=0.7.128 disk=0.7.128 stale=False`。
- 备份：`.build-backup/client.js.bak-20261027-162810`。

## 0.7.127 · 2026-10-27 · AST 死代码清扫（acorn）

把 0.7.126 放弃的那两块做完：引入真实 AST 解析器，摆脱正则/括号配对在混合缩进文件上的误判。

- **工具**：`acorn@8.19.0` 装在 `D:\dsh\日志\comfyui-console-对比\tools\`（工作区，不进插件包，`npm i -D` 也不写进插件依赖）。
- **`preview_console.js` 断链 + 迭代清扫**：先移除 `tab === "gen" ? genTab() : null`（`props.page` 只可能是 `output`/`online`），再用「嵌套函数出现次数 ≤ 1 即删、每轮只删最大的一个」迭代到不动点，45 轮删 **45 个 / 45,139 B**：`renderImageSettings`(8,401) `renderPromptSection`(7,440) `doGen`(4,069) `renderExDialog`(3,015) `chooseModelProfile` `renderModelDock` `saveWfAsPreset` `loadPreset` `doParseWf` `savePreset` `pickWfFile` `switchView` `genTab` 等。**顶层 `PreviewConsole` / `renderOutputPage` / `renderOutputFilters` / `renderOutputDetailInfo` / `PBG` 全部保留并逐一验证存在。**
- **其余源顶层死函数（边界用「下一个顶层声明行」）**：`presets.js` 删 `applyView`+`detectView`（1,437 B）、`online_models.js` 删 `onlinePageItems`+`onlineBaseOptions`（936 B）、`app.js` 删 `PromptPreviewChip`(3,115) `modelSetupErrors`(2,090) `validateModelGraph`(1,781) `PromptResultViewer` `normalizePromptPunctuation` `effectiveModelSetup` `editPreviewPart`（共 10,638 B）。这些删后逐个 grep 复核，引用数均为 **0**。
- **两处误删已恢复**：`DictCardEditor`（`scan_components` 抓到「36 引用 / 35 定义」，从 `client.js.bak` 提取并去 `\t\t` 缩进还原）；`workflow.js` 的 `parseWorkflow`/`parseUi`/`parseApi`（`app.js:6299` 的 `doParseWf` 在调用，跨文件判据漏算，从更早的 `client.js.bak-20261027-162319` 还原，并用 Node `vm` 跑通 `parseWorkflow` 返回 `ok=true`）。
- **体积**：`client.js` 969,890 → **910,532 字符**（-59,358）；`app.js` 686,904 → 676,259 B；`preview_console.js` 200,722 → **152,181 B（-24%）**；`presets.js` 10,078 → 8,639 B；`online_models.js` 80,800 → 79,862 B。
- 验证：7 个源 `node --check` 全过；`client.js` 重建后 `node --check` 通过；`verify_client.js` 模块定义捕获 ok、工厂执行成功；`scan_components.js` **37 引用 / 37 定义 / 0 缺**；`/version` stale=false；GET 回归 **17/17**。
- 备份：`lib/preview_console.js.bak-0.7.127`、`.build-backup/client.js.bak-20261027-162414` 等 39 份。
- `app.js` 的 `Console()` 内部嵌套函数迭代结果为 **0 个可删** —— 本地生成页全部存活，符合预期。

## 0.7.126 · 2026-10-27 · 代码审查：删死代码 + 拆出 preview_console.js

审查结论：没有会崩的运行时 bug（0.7.124/125 那批 `NameError`/`TypeError` 已在迁移中修完），主要问题是**死代码**与**单文件过大**。

- **删 21 个零引用定义**（42,428 B）：`DictionaryPanel`(19,460) `appendPostGraph`(9,482) `modelGraph`(4,000) `matchModelComponents`(2,779) `suggestModelProfile`(1,883) `instanceHeaders` `removeFrag` `saveFrag` `dictBuildTree` `dictSearch` `dirDelete` `sameLocalPath` `picker` `normalizeView` `applyTranslate` `modelValue` `doTranslate` `setCapNote` `modelProfileOptions` `orderedModelComponents` `OFFICIAL_NEG`。删后全文复核残留 0。
- **拆出 `lib/preview_console.js`**（2,368 行 / 200,722 B）：`PreviewConsole`（历史页 / 在线模型库）与 `PBG`（后台任务管理器）从 `app.js` 移出。边界由顶层声明行确定（`function PreviewConsole` → `function Console`），拼接后与其它源共享同一模块作用域，函数声明 hoisting 使顺序无关。
- **`app.js` 12,794 → 9,989 行，929,719 → 686,904 B（-26%）**；`client.js` 1,094,353 → 1,051,540 B（净减 42,813 B，与删除量吻合）。
- **`build_client.py`**：`SOURCES` 改为 `('dict','presets','workflow','dictcard','online_models','preview_console','app')`；`client.js` 同步插入 `来自 lib/preview_console.js` 分段标记。
- **审查中放弃的两项**：`PreviewConsole` 内 86 个静态分析判为「不可达」的子函数（114 KB）—— 复核发现 `renderOutputFilters` 的引用落在 `renderOutputPage` 体内，是活代码，说明该分析在此混合缩进文件上误判率高，**未采纳**；`genTab` 死链（12 KB）—— 括号配对在 `renderPromptSection` 上算短了区间，切坏结构后回滚。
- 验证：`node --check` app.js / preview_console.js / client.js 全过；`verify_client.js` 模块定义捕获 ok、工厂执行成功；`scan_components.js` 39 引用 / 39 定义 / 0 缺。
- 备份：`lib/app.js.bak-0.7.126`（拆分前）、`.build-backup/client.js.bak-20261027-161953`。
- 浏览器需刷新页面。

## 0.7.125 · 2026-10-27 · 剔除「工作台」页

A 线的「工作台」整页移除，`PreviewConsole` 只保留「历史」和「在线模型库」两页。

- **顶部 tab 条**：`["pv-output","历史"], ["pv-gen","工作台 A"]` → 只剩 `["pv-output","历史"]`；`pv-gen` 全文件 0 处残留。
- **CONSOLE_PAGES**：`[["gen","工作台"],["output","历史"],["online","在线模型库"]]` → 去掉 `gen`，`PreviewConsole` 内部自己的三页分页条同步变两页。
- **readLastConsoleTab**：localStorage 里残留的 `"gen"` 不再命中，fallback 从 `"gen"` 改成 `"output"`，升级后不会落到空页。
- **switchTab 兜底**（`PreviewConsole` 内）：`if(!CONSOLE_TABS.includes(next))next="gen"` → `next="output"`，两处 fallback 口径一致。
- **`Console()` 的 `useState("gen")` 保留不动** —— 那是本地「生成」页的初始 tab，与 A 线工作台无关；`PreviewConsole` 的 `tab = props.page || tabInternal` 被 `props.page` 完全约束，`tab === "gen"` 分支永远不会进入。
- **pvhost 渲染条件**与 **page 映射**：去掉 `tab === "pv-gen" ? "gen"`，`PreviewConsole` 的 `page` 只会是 `"output"` 或 `"online"`（`page` 为空时组件本身 `return undefined`）。
- **「连接设置」兜底**：原来在 `PreviewConsole` 未挂载时先 `setTab("pv-gen")` 再下一帧开模态，改为 `setTab("pv-output")` —— 该模态由 `PreviewConsole` 内部状态驱动，仍需它挂载。
- 验证：`node --check` app.js / client.js 均通过；`verify_client.js` 模块定义捕获 ok、工厂执行成功（导出 apply/inject）；`scan_components.js` 39 引用 / 39 定义 / 0 缺；client.js 1,010,497 → 1,010,417 字符（净减 80，即删掉的 tab 项）。
- 备份：`lib/client.js.bak-20261027-161219`。
- 浏览器需刷新页面以加载新 bundle。

## 0.7.124 · 2026-10-27 · A 线功能全量内联，双 sidecar 架构退役

`sidecar_preview.py`、`plugin/preview/`（43 文件 / 2.4 MB）、`config.json` 的 `preview` 节点全部移除；8200 不再启动，`try_proxy` 反向代理链路一并拆掉。A 线 32 条路由改为本地原生实现，实现在新模块 `sidecar_aline.py`（约 3,000 行）+ `plugin/aline_mods/`（14 个兄弟模块）。

- **新增 `sidecar_aline.py`**：从 `preview/expander.py` 搬入 100+ 个函数与 `class ExpansionJobs`、`class ModelTaskCancelled`，按 models / 历史 / 输出 / 设置 / 翻译 / 生成后控制 / 在线模型 分五批落地。`_load_aline_mod()` 从 `aline_mods/` 按文件名加载兄弟模块（`launch_modes` `comfy_paths` `cross_paths` `model_assets` `online_models` `tag_dictionary` `post_processing` `offline_translation` `comfy_install` `compatibility` `runtime_bridge` `face_models` `install_post_controls` `install_translation`）。
- **`aline_mods/` 兄弟模块**：A 线原本从 `HERE` 直接 import，搬到子目录后所有 `os.path.join(HERE, 'x.py')` 改写为 `os.path.join(HERE, 'aline_mods', 'x.py')`；`post_processing.py` 走的是 `api.HERE`（指向 plugin 根），故 `install_post_controls.py` / `install_translation.py` / `face_models.py` 同时保留在 plugin 根。
- **配置翻译层**：本地 `comfyRoot` 是父目录（`D:\paint`），A 线是 ComfyUI 本体（`D:\paint\ComfyUI`）；`outputDir` ↔ `outputDirectory`、`pythonExe` ↔ `comfyPythonExe`/`comfyPy`。`sidecar_aline.CFG` 做双向映射，并对 A 线读而本地无的 12 个键（`startScript` `comfyLayout` `launchers` `configErrors` …）给安全默认值。
- **本地新增路由（GET）**：`/outputs` `/outputs/detail` `/outputs/thumb` `/outputs/view` `/models/roots` `/models/catalog` `/models/browser` `/models/library` `/models/preview` `/models/detail` `/settings` `/comfy/online` `/comfy/update` `/diagnostics/compatibility` `/translation/status` `/post/workflows` `/post/dependencies` `/dictionary/*` `/online/*`。
- **本地新增路由（POST）**：`/outputs/manage` `/outputs/save-temp` `/outputs/preview-targets` `/outputs/add-preview` `/models/previews/manage` `/models/manage` `/models/tasks/cancel` `/outputs/tasks/cancel` `/models/preview` `/filesystem/pick-folder` `/settings` `/expand/cancel` `/expand` `/weight-language` `/refine` `/preview/translate` `/translation/install` `/comfy/open-browser` `/comfy/update` `/post/*` `/online/*` `/dictionary/*`。
- **新增 handler 方法**：`_dictionary_request` `_dictionary_mutation` `do_PATCH` `do_DELETE` `_online_request`。`_origin_ok()` 统一换成本地的 `_auth_ok(self, path)`。
- **验证（全部对活体 8199 实测）**：23 条路由 23/0 通过；`/outputs` 59642 B **与 A 线字节数完全一致**；`/outputs/view` 1417995 B PNG（magic 89 50 4E 47）；`/outputs/thumb` 12782 B WebP；`/models/catalog` 5599 B；`/diagnostics/compatibility` 1744 B；`/post/dependencies` 781 B；`/dictionary/search` 1420 B；`/settings` POST 1356 B；stderr 干净无 traceback。
- **补回缺失资源**：`dictionary_seed.json`（29,661 B，来自备份 zip）、`comfy_nodes/dsh_post_controls/__init__.py`（2,001 B）。
- 备份：`日志\备份\preview-A线-0.7.123-20261027-154650.zip`（0.6 MB）、`expander.py.bak-20261027-155859`、`config.json.bak-20261027-155859`。
- 前端零改动：`pv-gen` / `pv-output` / `pv-online` 三个 tab 与 `PreviewConsole` 原样保留，改由本地 8199 直接支撑。
- 未迁（A 线本就没有或本地已有等价）：比例预设 `IMAGE_SIZE_PRESETS`、保存输出开关/目录/前缀。

## 0.7.94 · 2026-10-26 · A-alpha 分支整合（双 sidecar）

把 `dsh-comfyui-console-A-alpha-preview`（0.6.59）的能力并入本线，两边功能一个不丢。版本线仍走本地 0.7.x。

- **双 sidecar 并存**：本地 8199 保持主服务（角色卡 / 风格卡 / LLLite / 扩写 / 目录 / LoRA），A 线后端整套放在 `plugin/preview/`，跑在 8200。新增 `sidecar_preview.py` 负责子进程管理与反向代理：`do_GET` 的 404 分支与 `do_POST` 读 body 之前转发，响应原样回写（含 PNG 缩略图），带 `X-Sidecar-Proxy: preview` 标记。
- **路由总数 43 + 32**：本地原有的 43 条不变；A 线 32 条（`/outputs` `/outputs/detail` `/outputs/thumb` `/models/*` `/translation/*` `/preview/translate` `/post/*` `/settings` `/refine` `/comfy/update` `/diagnostics/compatibility` …）经代理全部可达。
- **前端并入同一 bundle**：`app.js` 增加 A-alpha 移植块（167 个本地缺失的顶层声明 + 整块 Console 改名 `PreviewConsole`，共 496 KB）。新增第 6 个 tab「扩展」渲染 `PreviewConsole`；本地「生成 / 风格卡 / 角色卡 / 词库 / 预设」五页零改动。移植块与本地同名声明 0 冲突、`S` 样式字段 0 缺口。
- `config.json` 增 `preview` 段：`{enabled, port:8200, autoStart, dir, pythonExe}`。
- `package.json`：`0.7.94`，`dsh.update.inPlace` 增 `sidecar_preview.py` 与 `preview/`（18 项）。
- 验证：`node --check` 通过；模块在 Node 沙箱求值成功（`PreviewConsole` / `OutputMasonry` / `OutputInspector` / `DictionaryPanel` / `PostControlsModal` / `WorkflowEditor` / `SelectMenu` / `DraggableNumberInput` 全部 ok）；`/version` 报 0.7.94；`/stylecards/packed` 200；`/outputs` `/models/roots` `/diagnostics/compatibility` 200 且带 `X-Sidecar-Proxy`。
- 备份：`日志\comfyui-console-对比\backup-0.7.93-20261026-233125\`（42 文件 3.0 MB）、`lib\app.js.bak-0.7.94`、`lib\client.js.bak-0.7.94`。

未做（后续）：`DEFERRED_UI` 仍按 A 线原值隐藏其词库页/预设页入口（本地自己的词库页与预设页照常可用）；`ctranslate2` 未安装，离线翻译在用时会提示缺组件；生成后控制需要把 `comfy_nodes/dsh_post_controls` 装进 ComfyUI 并重启。
# CHANGELOG · dsh-comfyui-console

版本号语义：`MAJOR.MINOR.PATCH`。
`package.json` 里的 `dsh.configVersion` 是**配置结构版本**，与插件版本独立——插件小版本升级通常不涨它。

> **版本口径（2026-10-23 起）**：只有一条线。本文件顶部的插件号即套件版本、即发行包名、即仓库 tag（`v0.7.92`）。
> 此前并行的内部品线 `1.2.x` 已废弃；历史条目里残留的「本线」标注已在本轮清除，个别正文若还提到旧编号，仅作考据。

## 0.7.93 · 2026-10-24 · 插入登记 + 一键清空 + 多角色

- **插入登记 `INSERTED`**：卡插入时只记**差集**（本次真正加进去的词）+ LoRA + 特征锁 + LLLite 条件档，落 `localStorage`；卡片网格上因此出现蓝框与「已插入」角标
- **单击解除**：再点一张已插入的卡 = 精确撤回它加的东西（词按引用计数撤，别的卡还挂着的词留下；LoRA 同名有其它卡引用就留；角色卡的 `lockCards` 条目移除；条件图归它才 `COND.clear()`）
- **软锁**：受保护词被手删不回填、不弹窗抢键盘，只把该卡标成「部分移除」（角标转琥珀色）；胶囊里这些词带 🔒
- **一键清空**：生成行最右新增「全部清空」，提示词区「清空」改成同一动作——有插入卡时确认一次，然后提示词 / `selLoras` / `lockCards` / `COND`（含 picks）/ 卡片选中 / 画布旧图一起清干净，杜绝残留污染下一次出图
- **多角色**：角色卡不互斥，可同时挂 ≥2 张；出图时自动 `2girls, multiple characters`，从负向放行**人物类**数量词（`1girl/solo/2girls/3people/duplicate person`…），**尾巴类**（`two tails / multiple tails / extra tail`）继续压住
- 修：风格卡插入登记里字段名取错（`_rp.t` → `_rp.text`）会把差集记成空

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

### 0.7.94 补丁 · BG 兼容桥

首次拼装后运行时报 `BG.tasksSnapshot is not a function`。原因是**两边各有一套同名但语义不同的 BG**：本地 BG（`emit/set/snapshot/subscribe/clear/isFinished`）跟踪本地出图任务，A 线 BG（`tasksSnapshot/run/adopt/progress/shutdown/retrySave/cancel/setJob/startWatch/stopWatch`）跟踪它自己的任务；移植块排除了同名声明，A 线组件的方法调用就落到了本地 BG 上。

- 处理：把 A 线 BG 完整保留为 `PBG`（166 行，原样），在移植块尾部把本地缺的 15 个成员 `bind` 到 `BG`。本地卡系统继续用本地 BG 的任务表，两张表互不干扰。
- 验证：`BG` 21 个成员全部为 function（`tasksSnapshot` `adopt` `run` `retrySave` `cancel` `progress` `shutdown` `setJob` `startWatch` `stopWatch` `emit` `subscribe` `snapshot` `clear` `isFinished`）；`node --check` 通过；求值零错误；`client.js` 重建 1,007,510 B（`PBG`×5、`tasksSnapshot`×5）。
- 顺带核过 194 个同名全局的成员访问，只有 BG 一个真缺；`S` 样式 17 个键本地齐全（`btn2` 定义 1 处、引用 147 次）；`USER.seedVer` 是 A 线 presets 种子版本号，其代码自己处理 `undefined`，不需要补。## 0.7.95 · 2026-10-27 · 正式合并（拆掉「扩展」套娃）

0.7.94 里 A 线功能是塞在一个「扩展」tab 里的嵌套界面（里面还有一层它自己的 tab 条）。这次把它拆平。

- **顶层 tab 从 6 个变 7 个**：生成 / 风格卡 / 角色卡 / 词库 / 预设 / **输出** / **模型库** / **工作台 A**。「扩展」这个名字不再存在。
- `PreviewConsole` 改成受控组件：`function PreviewConsole(props)` + `const tab = (props && props.page) || tabInternal;`，本地 tab 直接决定它渲染哪一页；它自己的 tab 条在有 `page` 时不渲染（`(props && props.page) ? null : h("div", {...tablist...})`）。
- **常挂载单实例**：`PreviewConsole` 放在 `TabBoundary` **外面**一个固定 `key:"pvhost"` 的容器里，靠 `display: flex/none` 切换。这样切来切去不重建，输出页的列表/筛选/选中、模型库的下载进度都不丢，也不会因为多个实例重复轮询。
- 副作用收敛：`installPageScrollbarHiding` 原来是 mount 就执行，常挂载下会永久隐藏整页滚动条；改成只在真的显示 A 线页时执行，并返回 cleanup。
- 工作台改叫「工作台 A」，与本地「生成」区分；A 线的 `genTab` 是 `PreviewConsole` 内部局部函数，与本地 `genTab` 不在同一作用域，互不覆盖。
- 验证：`node --check` 通过；BG 兼容桥 15 个方法仍全为 function；`client.js` 重建 1,008,188 B（`pvhost`×1、`pv-output/pv-online/pv-gen` 各×3、「扩展」×0）；`/version` 报 `0.7.95`、`stale:false`；`/stylecards/packed`、`/outputs` 均 200。
- 备份：`lib\app.js.bak-0.7.95`、`lib\client.js.bak-20261027-000808`。
## 0.7.96 · 2026-10-27 · 补上 A 线的第四个前端源文件

**症状**：打开「模型库」tab 立刻 `ReferenceError: OnlineModelsPanel is not defined`（RootBoundary 捕获）。

**根因**：A 线的前端不是单文件，是 6 个源文件拼一个 `client.js`：

| 文件 | 内容 | 本地 |
|---|---|---|
| `dict.js` | 中英词库 | 有 |
| `presets.js` | 预置预设 | 有 |
| `workflow.js` | 工作流解析 | 有 |
| `dictcard.js` | 词库小卡片 | 有 |
| **`online_models.js` 79 KB** | **在线模型库整套（`OnlineModelsPanel` 等 15 个组件）** | **原缺** |
| `app.js` | 界面主体 | 有（含移植块） |

移植时只搬了 `app.js`，`OnlineModelsPanel` 的定义在 `online_models.js` 里，所以 `PreviewConsole` 渲染到 `tab === "online"` 就炸。

**处理**

- 拷 `online_models.js`（79,166 B）到 `plugin/lib/`。
- `tools/build_client.py` 的 `SOURCES` 加一项：`('dict','presets','workflow','dictcard','online_models','app')`。
- `client.js` 里补上对应的分段标记，脚本才肯重建（它对分段数量做严格校验）。
- `online_models.js` 无 `export`，本地构建的 `EXPORT_RE` 剥离逻辑对它无副作用。

**验证**

- `client.js` 1,088,803 B / 1,007,092 字符（+79,000 字符 ≈ online_models 体量），`OnlineModelsPanel` ×2（定义 + 引用）
- **端到端**：在 Node 沙箱里真跑 `window.__ModuleLoader__.load(...)` 捕获工厂，再执行 `factory(require)` —— 整个 1 MB bundle 求值成功，导出 `apply`（function）与 `inject: ["slots"]`
- 组件扫描：`h(Xxx` 形式引用 39 个，**缺定义 0**
- `/version` → 0.7.96

"@
## 0.7.97 · 2026-10-27 · 遗弃 A 线的 deferred 词库/预设残留

按「旧词库整个遗弃」清理 A 线那套永远显示不出来的死分支（`DEFERRED_UI` 体系）。

**删掉的**

| 位置 | 内容 | 行数 |
|---|---|---|
| 5457-5460 | `Deferred UI: see AGENTS.md…` 注释 + `const DEFERRED_UI=Object.freeze({viewPresets:false,dictionary:false,presets:false})` | 4 |
| 5462-5463 | `CONSOLE_PAGES` 的 5 项数组 + `.filter(([key])=>…)` → 收成三项 `gen / output / online` | 2→1 |
| 7674-7683 | `genTab` 里的视角预设块（`DEFERRED_UI.viewPresets ? h("div",{style:S.card}, …) : null`） | 10 |
| 7687-7690 | A 线 `libTab()`（词库页包装，3 行） | 4 |
| 7692-7759 | A 线 `presetTab()` 整个（67 行，含它的工作流导入逻辑） | 68 |
| 7992-7993 | 渲染链 `DEFERRED_UI.dictionary && tab === "lib" ? libTab() : null` 与 preset 那条 | 2 |

`DEFERRED_UI` 残留 **0** 处。

**没动的**

- 本地的 `libTab` / `presetTab`（顶层「词库」「预设」两个 tab 用的就是它们）
- `DictionaryPanel`（本地 4990 行，166 行 18,033 B——与 A 线那份原本就完全一致，是同一份代码）
- `dict.js`（`LIB` / `EXTRA` / `buildCn2En` / `translateCn`，中文提示词转英文标签要用）
- `dictcard.js`（`DictCardEditor` 等）
- `dictionaryOptions` / `useTagCompletion` / 提示词自动补全，全部保留

**验证**

- `node --check` 通过
- `app.js` 853,324 → **847,404 B**（-5,920）
- `client.js` 1,007,090 → **1,000,998 字符**
- 端到端：`window.__ModuleLoader__.load` 捕获工厂 → `factory(require)` 执行整个 bundle → 导出 `apply`(function) / `inject:["slots"]`
- 组件扫描：`h(Xxx` 引用 39 → **38** 个，缺定义 **0**
- `/version` → `0.7.97 / stale:false`；`/stylecards/packed`、`/outputs` 200

**备份**：`lib/app.js.bak-0.7.97`、`.build-backup/client.js.bak-20261027-002118`

## 0.7.98 · 2026-10-27 · 彻底移除旧版树状词库

词库里那个「旧版 ↔ 新版卡片」的切换，以及它切过去的那一整套旧界面，全部删掉。

**删掉的**

| 位置 | 内容 | 行数 |
|---|---|---|
| 10458-10714 | `function libTabLegacy()` —— 旧版树状词库整个组件（依赖 `LIB` / `S.` / `USER` / `setMsg`） | **257 行 / 13,256 B** |
| 9986-9991 | `if (!cardMode) return h("div", …h(libTabLegacy, { onBack: … }))` 旧版分支，含「◂ 新版卡片」按钮 | 6 |
| 10416 | 新词库工具栏里的「旧版」按钮（`onClick: () => setCardMode(false)`） | 1 |
| 9959 | `const [cardMode, setCardMode] = React.useState(true)` | 1 |
| 9755 | 注释「「旧版」按钮仍保留，随时可切回树状」→「旧版树状界面已于 0.7.98 移除」 | 改 1 |

残留：`libTabLegacy` **0** 处、`cardMode` **0** 处。

**现在的词库**

只剩一套界面：分类胶囊条 + 方形小卡片网格 + 底部提示词胶囊 + 导入导出/粘贴 JSON。没有任何切换入口，也不存在"切过去发现是旧界面"这种情况。

`dict.js`（`LIB` / `EXTRA` / `buildCn2En` / `translateCn`）保留——中文提示词转英文标签还在用；`dictcard.js` 保留。

**验证**

- `node --check` 通过
- `app.js` 847,404 → **833,372 B**（-14,032）；行数 12,702 → 12,437
- `client.js` 1,000,998 → **986,584 字符**
- 端到端：`__ModuleLoader__.load` → `factory(require)` 执行整包 → 导出 `apply`(function) / `inject:["slots"]`
- 组件扫描：`h(Xxx` 引用 38 个，缺定义 **0**
- `/version` → `0.7.98 / stale:false`；`/outputs` 200

**备份**：`lib/app.js.bak-0.7.98`、`.build-backup/client.js.bak-20261027-002312`

## 0.7.99 · 2026-10-27 · 修 Sidecar API 版本协商

**症状**：`Sidecar API 不兼容：需要 v15，当前 未知。请更新并重启 Sidecar。`（后面接「；请刷新页面重试」，因为抛在词库初始化里）。

**根因**：两侧 `/health` 的返回体格式不一致。

| | `service` | `apiVersion` | `sidecarPort` | `instanceId` | 各能力版本号 |
|---|---|---|---|---|---|
| A 线 `expander.py:3671` | `dsh-comfyui-console` | 15 | 绑定端口 | config 值 | dictionary/postControls/faceModels/onlineModels/modelAssets/modelBrowser |
| 本地 `expander.py:389`（修前） | — | — | — | — | — |

前端移植块里的 `verifySidecarHealth`（app.js:1824）要求：

```js
health.ok === true
health.service === "dsh-comfyui-console"
health.apiVersion === REQUIRED_SIDECAR_API   // 15
```

本地只返回 `{ok:true, routes:[…]}`，`health.apiVersion` 是 `undefined`，于是 `health?.apiVersion ?? "未知"` 输出「未知」。**这不是代理坏了，是握手字段没实现。**

**修复**：本地 `/health` 补齐 A 线声明的全部字段。

```python
self._json(200, {'ok': True, 'service': 'dsh-comfyui-console', 'apiVersion': 15,
                 'dictionaryVersion': 1, 'postControlsVersion': 1, 'faceModelsVersion': 1,
                 'onlineModelsVersion': 2, 'modelAssetsVersion': 2, 'modelBrowserVersion': 2,
                 'routes': [r['name'] for r in self.routes],
                 'comfyPort': COMFY_PORT, 'sidecarPort': _bound,
                 'platform': os.name, 'instanceId': CFG.get('instanceId', '')})
```

`_bound` 取 `self.server.server_address[1]`（真实绑定端口，这里是 8199）。声明的 15 是属实的：8199 通过 `sidecar_preview.py` 透明代理提供了 A 线 v15 的全部路由，`/dictionary/browse`、`/dictionary/categories`、`/outputs` 实测都是 200。

**另两处校验顺带过掉**

- `health.sidecarPort !== EXPANDER_PORT` → 8199 / 8199 ✓
- `INSTALLED_INSTANCE_ID` 为空 → `instanceId` 校验跳过 ✓
- `SIDECAR_PLATFORM` 取自 `health.platform`（`nt`），供 `modelPathChange()` 判断大小写不敏感 ✓

**验证**

- `py_compile` 通过
- `curl /health`（带 token 与不带 token 都测）→ 200，`apiVersion=15`、`sidecarPort=8199`、`platform=nt`
- `/version` → `0.7.99 / stale:false`



## 0.7.100 · 2026-10-27 · sidecar 状态轮询加抖动容错

`app.js` 里每 5 秒轮询 `/comfy/online` 的那条 `tick()`，原来**一次 fetch 失败就 `setOnline(false)` 并报红字**，而旁边的健康检查（`app.js:6153`）有 8 次重试。结果是 sidecar 重启那 2 秒窗口、或机器瞬时卡顿，都会在界面上闪一条「无法访问插件服务，请检查 sidecar：Failed to fetch」，5 秒后又自己恢复——纯噪音，而且把 ComfyUI 离线（8188 关闭）和 sidecar 不可达（8199 关闭）两种完全不同的故障混在一起。

**改动**

```js
const FAIL_STREAK_LIMIT = 2;
let disposed = false, polling = false, failStreak = 0;
...
try {
    const st = await jget(EXPANDER + "/comfy/online", 4500);
    failStreak = 0;                      // 成功一次立刻清零
    ...
} catch (e) {
    failStreak += 1;
    if (failStreak < FAIL_STREAK_LIMIT) return;   // 单次抖动不打断界面
    ...
}
```

- 单次失败：界面状态保持不变，不报错，等下一轮（5 秒后）
- 连续两次失败：才 `setOnline(false)` + 报「请检查 sidecar」
- 任何一次成功：`failStreak` 归零，恢复正常的离线/在线判定

`return` 在 `catch` 里不会绕过 `finally`，`polling` 锁照常释放。

**验证**

- `node --check` 通过；端到端 `factory(require)` 执行整包 → `apply` / `inject` 正常；组件 38 个缺定义 0
- `client.js` 986,584 → **986,873 字符**（+289）
- `/version` → `0.7.100 / stale:false`；`/health` apiVersion=15
- `/comfy/online` 200 `{"running": true}`（实际耗时 103 ms，远低于 4500 ms abort 线）

**两种故障现在可分辨**

| 故障 | sidecar 应答 | 前端表现 |
|---|---|---|
| 8199 不在 | 连接拒绝 | 连续 2 次（约 10 秒）后报「请检查 sidecar」 |
| 8188 不在 | 200 `{"running": false}` | 立即报「ComfyUI 离线；配置启动文件后可点击「连接 ComfyUI」」 |

## 0.7.101 · 2026-10-27 · 修代理路径丢失 CORS 头

「读取输出失败：Failed to fetch」——输出页整页打不开，但 `curl` 测 `/outputs` 明明 200。

**根因**：`/outputs`、`/outputs/view` 等路由根本不在本地 `expander.py` 里，是 `sidecar_preview.try_proxy()` 转发给 8200 的。而回写响应头时：

```python
for k in PASS_HEADERS:      # Content-Type / Content-Length / Content-Disposition / Cache-Control / ...
    if k in rh:
        handler.send_header(k, rh[k])
if 'Access-Control-Allow-Origin' not in rh:     # ← 上游【有】ACAO，所以这里不进
    handler.send_header('Access-Control-Allow-Origin', ...)
```

上游 8200 肯定会返回 `Access-Control-Allow-Origin`（本地侧车 `_cors()` 每个 JSON 都发），于是：**复制循环不认它（不在 PASS_HEADERS 里）、兜底逻辑又因为它存在而跳过**——两头落空，最终响应一个 CORS 头都没有。浏览器判为跨域失败，`fetch` 直接抛 `TypeError: Failed to fetch`。PowerShell / curl 不校验 CORS，所以命令行看什么毛病都没有。

同一机制影响所有被代理的路由，不止输出页。

**修复**：代理回写时统一以本地为准调 `handler._cors()` 发齐 CORS 头（`_cors()` 会按 `_origin_ok()` 回显白名单 Origin，不在白名单则回 `null`，安全语义不变），原来那句有缺陷的兜底删除。

**顺带记录一个探测坑**：`/outputs?request_id=p1` 会返回 `400 {"error": "无效的模型任务 ID"}`——`request_id` 是「扫描任务 ID」，必须用 `outputs-<base36时间戳>-<随机>` 格式（前端就是这么生成的），随便填个 `p1` 会被拒。这不是 bug，但排查时极易误判成接口故障。

**验证**

```
/outputs?request_id=outputs-probe-…&limit=5000&offset=0   200  ACAO=http://127.0.0.1:10722  599ms
/outputs?limit=200&offset=0                               200  ACAO=http://127.0.0.1:10722  557ms
/outputs/view?path=…                                      200  ACAO=http://127.0.0.1:10722  image/png
/comfy/online                                             200  ACAO=http://127.0.0.1:10722   36ms
/dictionary/browse?limit=1                                200  ACAO=http://127.0.0.1:10722   18ms
OPTIONS /outputs                                          204  ACAO 回显  ACAH=Content-Type, X-Console-Token, X-Console-Client
/version                                                  0.7.101 / stale=false
```

`py_compile` 通过；上游本身一直是好的（190 条、`hasMore=false`、ACAO 正常）。

## 0.7.102 · 2026-10-27 · 修主题每次重开都重置

**症状**：面板配色每次重新打开都变回「跟随系统」，本次会话里改是有效的，一关就丢。

**根因**：`USER.last` 有两处**整对象替换**，两个 effect 的依赖集又不重合，于是互相抹字段：

| 位置 | 写入字段 | 漏掉的字段 |
|---|---|---|
| `app.js:6275`（参数 effect） | modelConfig / ckpt / pos / neg / w / h / steps / cfg / … / sizeMultiplier / viewKey / postControls / … | **theme**、lockSeed、byType |
| `app.js:8564`（另一条参数 effect） | ckpt / … / theme / seed / lockSeed / viewKey / byType | **modelConfig**、postControls、sizeMultiplier、seedMode、saveOutput、savePath |

6275 的依赖里含 `modelConfig`、`postControls`、`sizeMultiplier`、`seedMode`、`saveOutput`、`savePath`，而 8261 那条保存主题的 effect **不含**这些。于是：切模型配置 / 改生成后控制 / 改尺寸倍率 / 切种子模式 / 动保存开关 → 6272 触发、把 `USER.last` 整块换成不含 `theme` 的对象并落盘，8261 不触发、不补回 → 磁盘上的 `theme` 消失。

下次打开时 `app.js:8244`：

```js
const [theme, setTheme] = React.useState(Object.assign({}, THEME_DEFAULTS, L.theme || {}));
```

`L.theme` 是 `undefined`，回落到 `THEME_DEFAULTS = { mode: 'auto', … }` —— 就是「跟随系统」。

`migrateState()` 是 `Object.assign` 透传的，不背这个锅；问题纯粹在写入侧。

**修复**：两处都改成合并写入，谁也不抹谁。

```js
USER.last = Object.assign({}, USER.last || {}, { …本次要写的字段… });
```

`saveLast()`（`app.js:325`）本来就是合并写法，现在三个写入点行为一致了。

**验证**

- `node --check` 通过
- 三处 `USER.last` 赋值全部为 `Object.assign` 合并式
- 端到端 `factory(require)` 执行整包 → `apply` / `inject` 正常；组件 38 个缺定义 0
- `client.js` 986,873 → **987,149 字符**（+276）
- `/version` → `0.7.102 / stale:false`

**用户侧需要注意**：修复前磁盘上的 `theme` 已被抹掉，所以打开后要**重新选一次配色**，之后才会保持。

## 0.7.103 · 2026-10-27 · 生成页「打开词库」按钮换成「模型库」

生成页右下工具栏（`生成` / `取消` 旁边）那个 `打开词库` 按钮，改成打开 A 线的在线模型库页。

| | 改前 | 改后 |
|---|---|---|
| 文案 | 打开词库 | **模型库** |
| 动作 | `setTab("lib")` | `setTab("pv-online")` |
| 悬停提示 | 无 | 打开模型库（在线模型浏览与下载） |

`setTab` 本身没有 key 白名单（`app.js:8149` 只做了「从生成页切走时清掉已收尾的出图」），所以传 `pv-online` 直接落到顶层的模型库 tab，和顶部 tab 条那条是同一个目的地。

词库的入口没丢：顶部 tab 条仍有 `词库`，另有一处 `打开文件位置` 按钮直接定位词库 JSON 的落盘目录。

**验证**

- `node --check` 通过；「打开词库」按钮已不存在，9529 行为 `h("button", { … setTab("pv-online") … }, "模型库")`
- 端到端 `factory(require)` 执行整包 → `apply` / `inject` 正常；组件 38 个缺定义 0
- `client.js` 987,149 → **987,181 字符**
- `/version` → `0.7.103 / stale:false`

## 0.7.104 · 2026-10-27 · 生成页「打开预设」按钮换成「连接设置」

生成页工具栏第二个按钮由「打开预设」改为「连接设置」，点击弹出 A 线那套 `ComfyUI 连接与启动设置` 弹窗（端口、启动文件路径、连接测试）。

**跨组件取不到 setter 的问题**：弹窗状态 `showConn` 定义在 `PreviewConsole`（`app.js:5748`），而按钮在本地 `Console` 的生成页里，两个组件互不相见。参照已有的 `MSG_SINK` / `REPAINT_SINK` 模式，新增模块级钩子：

```js
// app.js:120
let OPEN_CONN_SINK = null;
// PreviewConsole 内，showConn 声明之后
OPEN_CONN_SINK = () => setShowConn(true);
// 生成页按钮
onClick: () => {
    if (OPEN_CONN_SINK) { OPEN_CONN_SINK(); return; }
    setTab("pv-gen");                                  // 兜底：还没挂过就先切工作台 A
    setTimeout(() => { try { OPEN_CONN_SINK && OPEN_CONN_SINK(); } catch (e) {} }, 60);
}
```

弹窗走 `OverlayModal`，而它内部是 `createPortal(node, document.body)`（`app.js:4416-4421`），所以**不受 `pvhost` 的 `display:none` 影响**——即使当前停在生成页、工作台 A 被收起来，弹窗照常显示在 body 上。这也是选择"钩子 + portal 弹窗"而不是"切 tab 再弹"的原因。

**验证**

- `node --check` 通过；`OPEN_CONN_SINK` 三处（声明 120 / 赋值 5753 / 调用 9536、9539）齐备，「打开预设」按钮已不存在
- 端到端 `factory(require)` 执行整包 → `apply` / `inject` 正常；组件 38 个缺定义 0
- `client.js` 987,181 → **987,715 字符**（+534）
- `/version` → `0.7.104 / stale:false`

## 0.7.105 · 2026-10-27 · 模型库降为二级页

顶层 tab 条去掉 `模型库`，只留 7 个一级入口：`生成 / 风格卡 / 角色卡 / 词库 / 预设 / 输出 / 工作台 A`。模型库改为由生成页那个 `模型库` 按钮拉起，进入后顶部出现一条返回导航：

```
[◂ 返回生成]  模型库
```

**为什么必须补这条导航**：`pv-online` 从 tab 条上摘掉以后，停在模型库页时 tab 条上**没有任何一项高亮**，用户只能靠猜点回「生成」。补一条常显的返回按钮把这个出口明确下来。

内部的 tab 值 `pv-online` 不删——`pvhost` 的显示判定和 `PreviewConsole` 的 page 映射都靠它：

```js
// app.js:12434
h(PreviewConsole, { page: tab === "pv-output" ? "output" : tab === "pv-online" ? "online" : tab === "pv-gen" ? "gen" : "" })
```

所以这次只是把「入口」从 tab 条挪到按钮，底层页面切换逻辑一行没动。

**验证**

- `node --check` 通过
- tab 条 7 项（`app.js:12420`），`pv-online-back` 返回条在 `12429-12430`
- `pv-online` 仍被 `pvhost`（12433）与 `page` 映射（12434）引用，`PreviewConsole` 侧 `tab === "online"` 分支照常
- 端到端 `factory(require)` 执行整包 → `apply` / `inject` 正常；组件 38 个缺定义 0
- `client.js` 987,715 → **988,124 字符**（+409）
- `/version` → `0.7.105 / stale:false`

## 0.7.106 · 2026-10-27 · 修 "missing or bad X-Console-Token"

模型库页报 `missing or bad X-Console-Token`，图片也全裂。是两个独立原因叠加，都源于合并时 A 线与本地的**鉴权契约不一致**。

### 原因一：`online_models.js` 的请求不带 `X-Console-Client`

本地 `sidecar_auth._auth_ok()` 的两道闸：

```python
cli = handler.headers.get('X-Console-Client') or ''
o = handler.headers.get('Origin') or ''
if cli and _LOCAL_ORIGIN_RE.match(o):
    return True                       # 闸一：浏览器（自定义头强制预检，evil.com 过不去）
...
return secrets.compare_digest(got, want)   # 闸二：其余调用者必须带 token
```

本地 `app.js` 每个请求都带 `CONSOLE_HEADERS = { "X-Console-Client": "1" }`，而 `online_models.js` 只带了 `Content-Type`（POST 时），GET 时连 headers 字段都没有。A 线原版没有这道闸，所以从那边搬过来的代码天然缺这个头。

实测对照（只带 Origin）：

| 请求 | 无 client 头 | 带 client 头 |
|---|---|---|
| `/comfy/online` | **401** | 200 |
| `/online/search` | **401** | 200 |

修复：`onlineRequest` 统一加头（本文件在 `app.js` 之前拼接，`CONSOLE_HEADERS` 尚未初始化，写字面量）：

```js
headers: Object.assign({'X-Console-Client':'1'}, body===undefined?{}:{'Content-Type':'application/json'}),
```

### 原因二：`<img src>` 图片请求被拦

输出大图、输出缩略图、模型预览图、在线模型图全是浏览器直接发的 `<img src>`——**既不能加 `X-Console-Client`，也不带 Origin**，必然落进 token 分支被 401。所以修好接口以后图片仍是裂的。

`_OPEN_PATHS` 原本只有 `/health`、`/version`。新增只读图片前缀白名单：

```python
_OPEN_GET_PREFIXES = ('/outputs/view', '/outputs/thumb', '/models/preview', '/online/images/')
...
if handler.command == 'GET' and path.startswith(_OPEN_GET_PREFIXES):
    return True
```

范围限定在「GET + 这几个前缀」，只返回图片字节，不涉及写操作；上游 `/outputs/view` 自己还有 `_authorized_output_path()` 做路径授权。

### 验证

无头无 token（完全模拟浏览器图片请求）：

```
/outputs/view    200  image/png   1,417,995 B
/outputs/thumb   200  image/webp     12,782 B
/online/images/deadbeef   400 {"error":"预览图已失效，请刷新搜索"}   ← 鉴权已过，纯业务错误
```

安全边界仍在（无头无 token）：

```
/comfy/online    401  {"ok": false, "error": "missing or bad X-Console-Token"}
```

- `py_compile` 通过；端到端 `factory(require)` 通过；组件 38 个缺定义 0
- `client.js` 988,124 → **988,392 字符**
- `/version` → `0.7.106 / stale:false`

### 附带说明

`/online/search` 目前返回 502（耗时 42s 超时）——那是 8200 去访问 Civitai 外网失败，与鉴权无关，A 线原版同样如此。

## 0.7.107 · 2026-10-27 · 修词库初始化 401

现象：`missing or bad X-Console-Token；请刷新页面重试`（完整文案是 `词库初始化失败：…；请刷新页面重试`，`app.js:6087`），词库每 2 秒重试 8 次后报错，标签补全和词库页全废。

**根因**：`dictionaryRequest()`（`app.js:4874`）的请求头来自 `instanceHeaders()`：

```js
// 改前
function instanceHeaders() { return INSTALLED_INSTANCE_ID ? {"X-DSH-Instance-Id":INSTALLED_INSTANCE_ID} : {}; }
```

而 `INSTALLED_INSTANCE_ID` 默认是空串（`app.js:1809`），所以这个函数**返回空对象**。`dictionaryRequest` 的 GET 请求于是变成裸请求：

```js
headers: {...instanceHeaders(), ...(body===undefined?{}:{"Content-Type":"application/json"})}
// →  GET 时就是 {}
```

本地 `_auth_ok()` 的第一道闸要求 `X-Console-Client` + 本机 Origin 才免 token，裸请求直接落到 token 分支——浏览器端从不发 token，于是 401。A 线没有这道闸，所以这个函数搬过来才暴露。

**修复**：让 `instanceHeaders()` 无条件带 `X-Console-Client`，一次覆盖所有调用点（词库的 status / browse / search / 导入 / 迁移，以及自定义词条增删改）：

```js
function instanceHeaders() {
	return Object.assign({ "X-Console-Client": "1" },
		INSTALLED_INSTANCE_ID ? { "X-DSH-Instance-Id": INSTALLED_INSTANCE_ID } : {});
}
```

至此鉴权契约的三处缺口都补齐了：`online_models.js` 的 `onlineRequest`（0.7.106）、`<img src>` 只读图片前缀（0.7.106）、`instanceHeaders()`（本次）。全量扫描 17 个 `fetch(` 调用，其余都经 `sidecarHeaders(url)` / `CONSOLE_HEADERS` 带齐了头。

**验证**

```
/dictionary/status            200  {"ok": true, "schema_version": 1, "db_path": "D:\\paint\\com…"}
/dictionary/browse?limit=1    200  {"items": [{"id": 279, "source_key": "mandar…
/dictionary/categories?tags=1 200  {"items": [{"name": "水果", "count": 2}…
不带 client 头                401  仍需 client 头 ✓
```

- `node --check` 通过；端到端 `factory(require)` 通过；组件 38 个缺定义 0
- `client.js` 988,392 → **988,674 字符**
- `/version` → `0.7.107 / stale:false`

## 0.7.108 · 2026-10-27 · 模型库来源持久化 + 网络诊断结论

### 现象与结论

`连接模型来源失败，请检查网络后重试`（`preview/online_models.py:250`）不是代码问题，是**本机网络出不去**：

| 来源 | 直连耗时 | 结果 |
|---|---|---|
| Civitai | 30.1s | 超时 |
| Hugging Face | 24.0s | 超时 |
| HF-Mirror | 12–15s | 超时 |
| **ModelScope 魔搭** | **0.3s** | **200，正常** |

同时本机**没有代理在跑**：7890/7891/1080/10809/10808/8080/7897 全未监听，`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` 全空，系统代理 `ProxyEnable=0`（注册表里残留 `127.0.0.1:7897`，但端口没开）。

A 线的网络层本身是完整的（`online_models.py:128` 的 `CatalogProxy`）：`network.mode` 支持 `system` / `direct` / `custom`，`custom` 下填 HTTP 代理地址即可，另外还有 `domestic_direct` 让国内域名直连。所以**不需要改代码就能救**，需要的是把来源切到能通的。

经 8199 实测 ModelScope 走 sidecar 完全正常：

```
/online/search?provider=modelscope&q=stable-diffusion   200  498ms  有结果
/online/search?provider=modelscope&q=sdxl               200  671ms  items=24
/online/detail?provider=modelscope&id=AI-ModelScope/…   200  813ms
/online/targets                                          200  100ms
```

### 本次改动：记住来源选择

`ONLINE_SESSION.query.provider` 原本硬编码 `'civitai'` 且只存在内存里，**每次刷新页面都退回被墙的源**——即使用户切到魔搭，重进又白切。

```js
const ONLINE_QUERY_KEY='dsh-comfyui-console/online-query';
function readOnlineQuery(){ … }
function saveOnlineQuery(q){ … }
const ONLINE_SESSION={query:Object.assign({provider:'civitai',…},readOnlineQuery()),…};
// query 变化时
React.useEffect(()=>{ONLINE_SESSION.query={...params};saveOnlineQuery(ONLINE_SESSION.query);…})
```

只持久化筛选字段（provider/q/type/base/sort/period/nsfw），不存结果缓存。

**验证**

- `node --check` 通过（online_models.js 单独 + 整包）；端到端 `factory(require)` 通过；组件 38 个缺定义 0
- `client.js` 988,674 → **989,216 字符**
- `/version` → `0.7.108 / stale:false`

## 0.7.109 · 2026-10-27 · 默认来源改为 ModelScope，旧选择自动作废

接 0.7.108 的网络诊断，这次把设置侧一次性改到位，用户不用再手动切。

### 1. 默认来源 civitai → modelscope

```js
const ONLINE_QUERY_VERSION=2;
const ONLINE_DEFAULT_QUERY={provider:'modelscope',q:'',type:'',base:'',sort:'Most Downloaded',period:'AllTime',nsfw:false};
```

带 `ONLINE_QUERY_VERSION` 的原因：0.7.108 写进 localStorage 的旧结构是裸对象 `{provider:'civitai',…}`，如果只改默认值，老用户读到的仍是 `civitai`，升级了照样踩墙。所以读的时候校验版本：

```js
if(o.v!==ONLINE_QUERY_VERSION)return {};   // 旧结构作废，回默认 modelscope
return o.query&&typeof o.query==='object'?o.query:{};
```

存的时候写成 `{v:2, query:{…}}`。升级后第一次打开自动落到魔搭；之后用户自己改过的选择（v2 结构）照常记住。

### 2. 后端打开「国内源直连」

```
POST /online/settings
{"network":{"mode":"system","proxy":"","domestic_direct":true},"network_version":1}
→ 200
回读：network: mode=system proxy="" domestic_direct=True
```

`domestic_direct` 让 `modelscope.cn` / `hf-mirror.com` 这类域名在任何代理模式下都走直连，避免将来开了代理反而把能通的源也绕出去。

### 验证

```
重启后 network: mode=system domestic_direct=True
/online/search?provider=modelscope&q=sdxl   200  476ms  items=24
node --check（单文件 + 整包）              通过
端到端 factory(require)                    apply=function  inject=slots
组件扫描                                   38 个，缺定义 0
client.js                                  989,216 → 989,688 字符
/version                                   0.7.109 / stale:false
```

## 0.7.110 · 2026-10-27 · 去掉嵌入模式下的 A 线顶栏

模型库页（二级页）上方多出一整排重复的工具栏：

```
ComfyUI 绘图台  ● 在线  ● 无生图任务   关闭 ComfyUI | 模型库 | 释放显存 | 原界面 | 连接设置 | 教程 ▾
```

外层已经有 tab 条和「◂ 返回生成 / 模型库」二级页返回条，这排纯属重复。

来源是 `PreviewConsole` 的 sticky 顶栏（`app.js:7700-7738`）。A 线自己的 tab 条（7740）本来就有嵌入判断，这排没有，所以嵌入时照渲。补上同样的条件：

```js
(props && props.page) ? null : h("div", { style: {…} }, …)
```

`props.page` 只在三个二级页（output / online / gen）有值，而这三个页面正是 `pvhost` 可见的时候——所以效果就是「只要看得见 A 线界面，就没有这排」。

隐藏后仍需的入口：

| 动作 | 现在在哪 |
|---|---|
| 连接设置 | 生成页工具栏（0.7.104 加的） |
| 释放显存 / 关闭 ComfyUI / 原界面 / 教程 | A 线独立界面里仍在（`props.page` 为空时照常渲染） |

**验证**

- `node --check` 通过
- 7703 行为 `(props && props.page) ? null : h("div", …)`；7743 的 tab 条条件未动
- 端到端 `factory(require)` 通过；组件 38 个缺定义 0
- `client.js` 989,688 → **989,868 字符**（+180）
- `/version` → `0.7.110 / stale:false`

## 0.7.111 · 2026-10-27 · 顶层「输出」改名为「历史」

| 位置 | 改前 | 改后 |
|---|---|---|
| 本地顶层 tab 条（`app.js:12429`） | `["pv-output", "输出"]` | `["pv-output", "历史"]` |
| A 线页面表（`app.js:5468`） | `["output", "输出"]` | `["output", "历史"]` |

只改显示文案，`pv-output` / `output` 这两个 key 一个字没动——`pvhost` 的可见性判断、`PreviewConsole` 的 `page` 映射、`TabBoundary` 的分支全靠 key，改 key 会连带炸一片。

`app.js:7881` 那处 `name === "output" ? "输出" : "临时"` **没改**：那是图片预览区里区分「已保存输出 / 临时图」的标签，语义不是导航页名，改成「历史」反而不对。

字符数 989,868 → 989,868 未变，因为「输出」和「历史」都是两个汉字。

**验证**

- `node --check` 通过
- `client.js` 内 `"pv-output", "历史"` 与 `["output", "历史"]` 均在
- 端到端 `factory(require)` 通过；组件 38 个缺定义 0
- 重启后 `/version` → `0.7.111 / stale:false`，`/health` apiVersion=15

## 0.7.112 · 2026-10-27 · 生成页底模换成工作台那套模型坞卡

生成页的底模原来是一个朴素 `<select>`（`app.js:9704-9706`），现在换成工作台「模型坞」的外观：缩略图 + 模型短名 + 完整路径，整体是一个按钮。**其余布局一寸没动**，只替换这一块并调了它的尺寸和排列。

### 两套 state 的问题

底模有**两个独立的 `ckpt`**：

| 位置 | 归属 |
|---|---|
| `app.js:5895` | A 线 `PreviewConsole` |
| `app.js:8222` | 本地生成页 `genTab` |

两边只通过 `USER.last.ckpt` 共享初值，运行期互不通知。所以点卡片打开模型库、在里面选完底模，本地这份不会自己变。用两个模块级钩子打通：

```js
let OPEN_MODEL_PICKER_SINK = null;   // 生成页 → A 线：打开模型库
let MODEL_PICKED_SINK = null;        // A 线 → 生成页：回传选中的模型名
```

链路：

```
点底模卡 → OPEN_MODEL_PICKER_SINK("checkpoint", 当前名)
        → openModelLibrary(kind, preferred)       // 6827
        → 模型库弹窗（OverlayModal → portal 到 body，pvhost 收起也可见）
        → 点某行 → 右侧详情面板「使用」→ applyFocusedModel()   // 7103
        → chooseMainModel("checkpoint", name, root_id)        // 7026
        → setCkpt(name)【A 线】+ MODEL_PICKED_SINK(name) → setCkpt(name)【生成页】
```

`MODEL_PICKED_SINK` 的调用点加在 `chooseMainModel` 的 `setMsg(...)` 之后、`return true` 之前，所以只有「真的换了底模」才回传，点同一行不会重复触发。

### 缩略图为什么不直接用 ModelDockAsset

A 线的 `ModelDockAsset`（`app.js:5264`）能复用，但它在 `variant="main"` 时被 CSS 钉死：

```css
.dsh-comfy-ui .cc-model-dock-art--main{width:76px;height:100px}
```

76×100 塞不进生成页那个窄栏，而这条宽高写在 `UI_CSS` 里、`--cc-*` 变量也不在本文件定义，改 CSS 的代价大于收益。所以新增 `LocalCkptThumb`（`app.js:5287` 附近）：

- **共用** `/models/detail` 接口和 `MODEL_DOCK_ASSETS` 缓存（同一个 Map，同一份 60s 缓存，不重复请求）
- 尺寸由 props 给（这次 40×52），`<img>` 用行内 `object-fit:cover`，完全不依赖 A 线 CSS
- 取图路径与 A 线一致：`detail.preview.url` / `detail.previews[0].url` → `/models/preview?...`（这条路 0.7.106 已进 `_OPEN_GET_PREFIXES`，`<img>` 不带任何头也能取到）

### 尺寸与排列

| 项 | 值 |
|---|---|
| 缩略图 | 40 × 52 px，圆角 6px |
| 卡片内边距 | `5px 8px 5px 5px`，元素间距 8px |
| 主文案 | 12.5px / 600，单行省略 |
| 副文案 | 11px / 62% 不透明，单行省略，显示完整路径 |
| 卡片整体高 | ≈62px（原 `<select>` 约 32px，这一块高约 30px） |

原本的 `底模 / 编码器 / LoRA` 区块标题、模型不合规的红字提示（`modelBad`）、下面的文本编码器 / VAE 等都保持原位原样。

### 验证

```
node --check                 通过
端到端 factory(require)     apply=function  inject=slots
组件扫描                    38 个，缺定义 0
client.js                   989,868 → 993,966 字符（+4,098）
/models/detail?kind=checkpoint&name=animagine-xl-3.1.safetensors   200
/version                    0.7.112 / stale:false
```

本机底模目前都没有配本地预览图，所以卡片会显示占位图标——这是数据状态，不是渲染问题；在模型库里给某个底模配好示例图，卡片就会显示缩略图。

## 0.7.113 · 2026-10-27 · 文本编码器跟随底模自动适配

接 0.7.112，底模卡能开了模型库，但选完底模还得手动去挑「文本编码器 / 编码器类型」，工作台不是这么干的——它按 `MODEL_PROFILES` 由模型类型直接定编码器。这次把这条链补上。

### 做法

底模一变，读 `/models/detail` 的 `base_type`（safetensors 头里的 base model 字段，实测 `animagine-xl-3.1` 返回 `"SDXL"`），推 `MODEL_PROFILES` 的 key，取该条目的 `clipType` 写进本地 `clipType`。

新增模块级函数 `profileKeyFromModelBase(baseType)`。`MODEL_PROFILES` 里 `sdxl` / `sd2` 这些条目本身没写 `clipType`（只有 `family`），所以补一层家族映射兜底：

```js
const FAMILY_CLIP_TYPE = { sdxl:'stable_diffusion', sd15:'stable_diffusion', sd2:'stable_diffusion',
                           legacy:'stable_diffusion', flux:'flux', sd3:'sd3', anima:'qwen_image' };
```

推断结果（16 组用例已跑通）：

```
SDXL / Pony / Illustrious / NoobAI  → sdxl        → stable_diffusion
SD1.5 / SD2.x                       → sd15/sd2    → stable_diffusion
SD3 / SD3.5 Large / SD3.5 Medium    → sd3-medium  → sd3
FLUX.1 D / FLUX.1 S / Schnell       → flux-dev/schnell → flux
Flux.1 Krea                         → flux-krea   → flux
Anima Base / Anima Turbo            → 不推断
空值 / 乱数据                        → 不推断（保持现状）
```

### 两处刻意的保守

**1. Anima 一律不推断。** A 线的 `anima-*` profile 写的是 `clipType:"stable_diffusion"`，而本地面板的 Anima 走 `qwen_image`（底模取自 `diffusion_models`，`app.js:1397` 的 `animaUNet` 判断）。两者不是一回事——照 A 线套过去会把 Anima 底模当 checkpoint 送进构建流程，ComfyUI 直接退 400。所以这类直接跳过。

**2. 不自动切到 `qwen_image`。** 反过来也成立：本地 diffusion_models 目录常为空，自动把 `clipType` 切成 `qwen_image` 会让底模下拉瞬间变空。这种切换只留给用户显式操作。

推断不出来（`base_type` 缺失、读模型详情失败、命中 Anima）就**什么都不做**，宁可保持现状也不猜。

### 提示

真的改了类型才提示，写进本地消息区：

```
已按底模自动适配编码器类型：SDXL → stable_diffusion
```

同一值不重复提示。

### 布局

UI 结构没动，还是三个下拉（按上一轮「不要改动生成的布局」的要求），变的只是「选完底模它们自己填好」这件事。手动改仍然有效，并且不会被下一次自动适配以外的动作覆盖。

**验证**

```
node --check                 通过
推断用例                    16 组全部符合预期
端到端 factory(require)     apply=function  inject=slots
组件扫描                    38 个，缺定义 0
client.js                   993,966 → 996,243 字符（+2,277）
/version                    0.7.113 / stale:false
```

## 0.7.114 · 2026-10-27 · 推断补一道文件名兜底

0.7.113 靠 `/models/detail` 的 `base_type` 推断，但本机实测 4 个底模里有 2 个元数据是「未知」：

```
animagine-xl-3.1.safetensors          base_type=SDXL
sd_xl_base_1.0.safetensors            base_type=SDXL
meinamix-v11.safetensors              base_type=未知
v1-5-pruned-emaonly.safetensors       base_type=未知
```

一半失效，等于功能对半残。补 `profileKeyFromModelName(name)` 作为第二道，只在 `base_type` 推不出来时才用：

```js
const key = profileKeyFromModelBase(d && d.base_type) || profileKeyFromModelName(ckpt);
```

规则与顺序（先排除 Anima，其余按家族）：

```
anima            → 不猜
flux / schnell   → flux-dev / flux-schnell
sd3 / sd_3       → sd3-medium
xl               → sdxl
v1-5 / sd15 / 1.5 → sd15
v2-1 / sd_2      → sd2
其余             → 不猜
```

`meinamix-v11` 名字里没有任何家族信息，**故意不猜**——它确实是 SDXL 模型，但猜错就是 ComfyUI 400，宁可让用户手动点一次。

**本机 4 个底模的最终结果**

```
animagine-xl-3.1.safetensors    [SDXL]  → sdxl  → stable_diffusion   （元数据）
sd_xl_base_1.0.safetensors      [SDXL]  → sdxl  → stable_diffusion   （元数据）
v1-5-pruned-emaonly.safetensors [未知]  → sd15  → stable_diffusion   （文件名兜底）
meinamix-v11.safetensors        [未知]  → 不推断，保持现状
```

4 个里 3 个生效。

**验证**

```
node --check                 通过
端到端 factory(require)     apply=function  inject=slots
组件扫描                    38 个，缺定义 0
client.js                   996,243 → 996,981 字符（+738）
/version                    0.7.114 / stale:false
```

## 0.7.115 · 2026-10-27 · 文本编码器与 VAE 也跟随底模切换

0.7.113/114 只切「编码器类型」。这次把 `clip` 和 `vae` 也接上，同时**修掉一个一直是隐患的地方**。

### 根子上的问题：checkpoint 也被强行外挂 CLIPLoader

`buildGraph` 原来无条件建三个 loader：

```js
g["2"] = { class_type:"CLIPLoader", inputs:{ clip_name:o.clip, type:... } };
g["3"] = { class_type:"VAELoader", inputs:{ vae_name:o.vae } };
```

等于要求每个 checkpoint 也必须外挂一个独立编码器文件。而本机 `text_encoders` 里只有一个 `qwen_3_06b_base.safetensors`（Anima 用的 Qwen 编码器），**没有任何 SDXL/SD1.5 的 CLIP**——于是选任何 SDXL 底模，clip 这一栏必然是错的文件。

改成按分支取：

```js
if (animaUNet) {
    g["1"] = UNETLoader;
    g["2"] = CLIPLoader{ clip_name:o.clip, type:"qwen_image" };   // Anima 只能外挂
} else {
    g["1"] = CheckpointLoaderSimple;
    if (o.clip) g["2"] = CLIPLoader{ clip_name:o.clip, type:o.clipType };   // 只有显式指定才另建
}
let vaeSrc = animaUNet ? null : ["1", 2];          // checkpoint 自带 VAE
if (o.vae) { g["3"] = VAELoader; vaeSrc = ["3", 0]; }
let clipSrc = g["2"] ? ["2", 0] : ["1", 1];        // 否则用 checkpoint 的 CLIP 输出
```

`VAEDecode` 用 `vaeSrc`，`CLIPTextEncode` 用 `clipSrc`，LoRA 链照旧从 `clipSrc` 接下去。

### 顺带补的两道校验

Anima 分支的 `g["1"]` 是 `UNETLoader`，只有一路 MODEL 输出，**没有** `["1",1]` / `["1",2]` 可取。原来缺件时会静默生成一个指向不存在输出的图，ComfyUI 回个看不懂的 400。现在直接抛可读错误：

- 缺 VAE → `当前底模需要外部 VAE，请在「VAE」里选一个`
- 缺编码器 → `当前底模需要外部文本编码器（qwen），请在「文本编码器」里选一个`

### 自动适配扩到三项

底模变化时按家族同时处理：

| 家族 | 编码器类型 | 文本编码器 | VAE |
|---|---|---|---|
| sdxl / sd15 / sd2 | `stable_diffusion` | 清空 → 用内置 | 按线索挑，本机 `sdxl_vae.safetensors` |
| sd3 | `sd3` | 按 t5xxl / clip_l 线索挑 | 按 sdxl_vae 线索挑 |
| flux | `flux` | 按 t5xxl / clip_l 线索挑 | `ae.safetensors` 或 flux vae |
| anima | 不推断（语义冲突） | `qwen_3_06b_base.safetensors` | `qwen_image_vae.safetensors` |

线索用正则按顺序试，命中第一个就用；挑不到就不动。新增 `PROFILE_CLIP_HINT` / `PROFILE_VAE_HINT` / `pickByHints()`。

**同一个底模只适配一次**（`adaptedCkptRef`），避免 `vaes` / `clips` 列表异步到达时反复覆盖用户手改的选择。

### 两个下拉加了空选项

`clip` / `vae` 现在可以为空（表示走 checkpoint 内置），所以下拉各加一项：

```
文本编码器 → （跟随底模内置 CLIP）
VAE       → （跟随底模内置 VAE）
```

### 图结构验证（ComfyUI 未启动，用源码抽取跑了五种分支）

```
① checkpoint + 无外挂       nodes=7  loaders=[1:CheckpointLoaderSimple]
                            CLIPTextEncode.clip=["1",1]  VAEDecode.vae=["1",2]
② checkpoint + 外挂 clip/vae nodes=9  loaders=[1:Ckpt, 2:CLIPLoader, 3:VAELoader]
                            CLIPTextEncode.clip=["2",0]  VAEDecode.vae=["3",0]
③ Anima + qwen 编码器 + vae  nodes=9  loaders=[1:UNETLoader, 2:CLIPLoader, 3:VAELoader]
                            CLIPTextEncode.clip=["2",0]  VAEDecode.vae=["3",0]
④ Anima 缺 clip/vae          -> 抛错：当前底模需要外部 VAE，请在「VAE」里选一个
⑤ checkpoint + LoRA        nodes=8  loaders=[1:Ckpt, 10:LoraLoader]
                            CLIPTextEncode.clip=["10",1]  VAEDecode.vae=["1",2]
```

第⑤条确认 LoRA 链仍然正确接管 clip 源。

**其他验证**

```
node --check                 通过
端到端 factory(require)     apply=function  inject=slots
组件扫描                    38 个，缺定义 0
client.js                   996,981 → 999,598 字符（+2,617）
/version                    0.7.115 / stale:false
```

⚠️ ComfyUI（8188）当时未运行，只做了图结构的静态验证，没有真实出图。启动 ComfyUI 后建议先跑一张确认。

## 0.7.116 · 2026-10-27 · 修「绘图台不上线」——ComfyUI 启动没带 CORS

### 症状

用户点完启动、做完检测，面板依旧显示 `● 离线`。

### 排查链

```
8188 /comfy/status          running=true  managed=true     → 服务本身没事
POST /comfy/start           ok:true，返回「已在运行；复用现有服务」
8188/system_stats           不带 Origin → 200
8188/system_stats           带 Origin: http://127.0.0.1:10722 → 403   ← 这里
OPTIONS 预检                                                  → 403
```

ComfyUI 命令行里**没有** `--enable-cors-header`：

```
main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch --disable-pinned-memory …
```

而前端探活（`app.js:8673`）是**直连 8188** 的：

```js
try { await jget(COMFY + "/system_stats", 4000); }
catch (e) { setOnline(false); ... }
```

浏览器发请求必然带 `Origin`，被 ComfyUI 判 403 → `setOnline(false)` → 面板一直是离线。

### 为什么本地代码里有 cors 却没生效

`sidecar_comfy.py:259-261` 明明写着：

```python
args = [exe, '-s', COMFY_MAIN,
        '--listen', '127.0.0.1', '--port', str(COMFY_PORT),
        '--enable-cors-header', '*', '--disable-auto-launch'] + COMFY_EXTRA_ARGS
```

查进程父链才看出：

```
pid=28168  parent=3600  parentCmd=…\plugin\preview\expander.py --port 8200
```

**ComfyUI 是 A 线（8200）那套 sidecar 拉起来的**，不是本地 8199。本地 `/comfy/start` 一看 8188 已在应答就返回「复用现有服务」，本地那份 `_launch` 从来没执行过。

而 A 线 `preview/expander.py:1271-1272` 的命令确实缺 cors：

```python
command = [COMFY_PY, '-s', COMFY_MAIN, '--listen', '127.0.0.1',
           '--port', str(COMFY_PORT), '--disable-auto-launch'] + COMFY_EXTRA_ARGS + override_args
```

所以要改的是**A 线那份**。

### 改动

`plugin/preview/expander.py:1271` 补上参数：

```python
command = [COMFY_PY, '-s', COMFY_MAIN, '--listen', '127.0.0.1',
           '--port', str(COMFY_PORT), '--enable-cors-header', '*',
           '--disable-auto-launch'] + COMFY_EXTRA_ARGS + override_args
```

然后清掉两个 `__pycache__` 里的旧 pyc，按 8199 → 8200 → ComfyUI 的顺序重起。

### 验证

```
新命令行   main.py --listen 127.0.0.1 --port 8188 --enable-cors-header * --disable-auto-launch …
带 Origin  system_stats → 200   Access-Control-Allow-Origin: *
py_compile 两处通过
/version   0.7.116  stale:false
```

### 附带说明

- 诊断期在 `sidecar_comfy.py` 里临时加过一行 `launch-args.log` 落盘，已删除。
- 这个 bug 与 0.7.112~0.7.115 的底模/编码器改动无关；它是「谁先拉起 ComfyUI」的竞态结果——本地面板和 A 线工作台谁先连，决定了 ComfyUI 带不带 CORS。

## 0.7.117 · 2026-10-27 · LoRA 二级菜单加导入 / 导出 / 删除

### 界面

生成页「选择（n/m）」打开的 LoRA 二级菜单里新增一排工具：

| 控件 | 行为 |
|---|---|
| 导入 LoRA | 本机文件选择，收 `.safetensors .pt .ckpt .sft .bin .zip`，直接上传进 `models/loras` |
| 从网址导入 | 展开一个输入框，填直链（`.safetensors` 或 `.zip`），后端下载后落地 |
| 打开 loras 文件夹 | 在资源管理器里打开 `models/loras` |
| 每个 chip 的 `↓` | 导出该 LoRA（浏览器下载，保留原文件名，中文名走 RFC 5987） |
| 每个 chip 的 `×` | 移出 LoRA 目录，二次确认后搬进 `_trash-<时间戳>`（不硬删，可手动搬回） |

删除成功后同时把该 LoRA 从「已选」里剔掉并刷新模型列表，避免继续拿一个不存在的权重去出图。

### 后端

三个接口里两个是早就有的，只是前端一直没接；**导出是这次新加的**：

```python
# sidecar_loras.py
def _loras_file(name):
    root, fp = _abs_of(name)          # _abs_of 已挡掉 .. 之类
    ...
    return (fp, os.path.getsize(fp)), ''
```

```python
# expander.py do_GET
elif p == '/loras/file':
    _got, _err = _loras_file(_nm)
    ... Content-Disposition: attachment; filename*=UTF-8''<quoted>
    while True: self.wfile.write(_f.read(1 << 20))
```

`sidecar_auth.py` 的 `_OPEN_GET_PREFIXES` 加了 `/loras/file`：导出走的是浏览器 `<a download>`，加不了自定义头，只能按只读放行（它只吐 `models/loras` 里的文件）。

### 踩到的坑：本地 /loras/* 被 A 线接管

改完先测，`GET /loras/file` 正常，但 `POST /loras/del`、`POST /loras/scan` 一律 404。

`sidecar_preview.try_proxy()` 是「不在 LOCAL_ONLY 就转发给 8200」。`do_GET` 里本地分支在 `try_proxy` **之前**，所以 GET 没事；而 `do_POST` 是**先** `try_proxy`、**再**走本地 `elif` 链——A 线（0.6.59）没有 `/loras/del`、`/loras/file`，转发过去 404，`try_proxy` 写完响应就 `return True`，本地那段永远执行不到。

修法是把 loras 整组锁在本地：

```python
LOCAL_ONLY = frozenset(('/version', '/routes', '/log', '/local/status',
                        '/loras', '/loras/import', '/loras/del', '/loras/file', '/loras/scan'))
```

顺带还踩了一个：改完 `sidecar_preview.py` 重启时，旧进程没死透、端口还在监听，轮询"端口通了"立刻返回，**新进程根本没起来**，于是又测了一轮 404。正确做法是杀进程后先等端口**释放**再起。

### 验证

```
GET  /loras                  → count=20  dir=D:\paint\ComfyUI\models\loras
GET  /loras/file?name=xunlian1.safetensors → 91,853,952 B（与磁盘完全一致）
GET  /loras/file?name=软萌.safetensors      → Content-Disposition: attachment; filename*=UTF-8''%E8%BD%AF%E8%90%8C.safetensors
POST /loras/scan             → 200  count=20
POST /loras/del {不存在}      → 200  {"ok": false, "error": "文件不存在: ..."}
POST /loras/del {真实文件}     → 200  left=20  trash=_trash-20261027-152106  （源文件消失、trash 内可见、测试残留已清）
node --check lib/client.js   → 0
verify_client.js             → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js           → 组件引用 39，有定义 39，缺 0
client.js                    999,598 → 1,005,068 字符
```

## 0.7.118 · 2026-10-27 · 图片参数换成工作台那套控件（尺寸按本地压窄）

用户要求：图片参数改用工作台版本，迁过来之前改尺寸，不改动生成布局。

### 只换内部控件，外层一动不动

生成页「图片的高宽 / 参数」这张卡的**外壳没动**：标题、常用尺寸按钮组、出图后放大、视角三档、种子条、重负载警告，全部原样。改的只是里面的控件。

### 换了三处

**宽/高行 → 工作台的 `cc-size-row`**

原来是四个数字框平铺（宽/高/步数/CFG），现在宽高独占一行，右边接工作台的两个小控件：

```jsx
h("div", { className: "cc-size-row", style: { gridColumn: "1 / -1" } },
  <宽> <高>
  <button className="cc-icon-button" title="对调宽高">  ← swapSize 图标
  <DraggableNumberInput className="cc-size-multiplier">  ← 倍率
)
```

- **对调宽高**：点了直接换 `w`/`hh`，同时清掉 `sizePick` 高亮
- **倍率**：`0.25 ~ 4`，可拖动、可键入，两位小数

**采样器 / 调度器 → `SelectMenu`（可搜索）**

原生 `<select>` 翻几十个采样器太慢，换成工作台那个带搜索的下拉，`forceSearch: true`。

**倍率真的生效**

工作台那边倍率只影响预览，`doGen` 里仍是 `w: Number(w)`。这次接到出图上了：

```js
const _sz = imageSizeScaled(w, hh, sizeMultiplier, 8);
buildGraph({ ..., w: _sz.w, h: _sz.h, ... });
await BG.run(graph, { w: _sz.w, h: _sz.h, ... });
```

`imageSizeScaled` 会按 8 对齐并夹到 64~8192。**默认倍率 1，结果和原来完全一致**：

| 宽×高 | 倍率 | 结果 |
|---|---|---|
| 896×1152 | 1 | 896×1152（原值，零变化） |
| 896×1152 | 1.5 | 1344×1728 |
| 896×1152 | 0.5 | 448×576 |
| 512×768 | 2 | 1024×1536 |

顺带把「成品 W×H」（放大后尺寸）和「重负载警告」的判定也换成缩放后的尺寸，否则倍率 2 时还在按 896×1152 判轻负载。

### 尺寸适配

`cc-size-row` 的栅格是 `1fr 1fr 32px 0.85fr`，工作台面板宽，本地参数卡窄。实测本地最小宽度（`pCols2 === 1`，约 380px）下：`380 − 32 − 3×7 = 327`，两列各约 115px、倍率约 98px，够用，所以只给对调按钮把内联尺寸钉成 32×32 对齐栅格，没改任何全局 `cc-*` 规则——工作台那边该怎么显示还怎么显示。

### 持久化

`sizeMultiplier` 进了 `USER.last`（8445/8755 两处 saveLast 及其依赖数组），刷新后保持。

### 验证

```
node --check lib/app.js                 → 0
node --check lib/client.js              → 0
verify_client.js                        → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js                      → 39 引用 / 39 定义 / 缺 0
倍率算术 7 组用例                         → 全对，倍率 1 严格等于原宽高
client.js                               1,005,068 → 1,006,962 字符
```

### 还没迁的（工作台图片参数里本地没有的部分）

- **比例预设 SelectMenu**（`IMAGE_SIZE_PRESETS`）—— 本地用「常用尺寸」按钮组替代，功能等价，没替换
- **保存输出开关 + 保存目录 + 文件名前缀** —— 本地有自己的保存设置区
- **Seed 变化**（锁定/递增/递减/随机）—— 本地是「固定」勾选框 + 随机按钮，语义略有不同
### 0.7.118 补记 · TDZ 修复（15:31）

页面报 `Cannot access 'sizeMultiplier' before initialization`。

**根因**：`sizeMultiplier` 的 `const` 声明被放在 8554（`sizePick` 旁边），而 `saveLast` 在 8445 就把它放进 `USER.last` 了 —— `const` 有暂时性死区，同一渲染帧里先读后声明就是 ReferenceError。`node --check` 抓不到这类问题，它只在 React 真正渲染时才炸。

**修复**：声明挪到 state 群开头（8424，紧跟 `lockSeed` 之后、`upscale` 之前），所有引用（saveLast 8449、USER.last 8756、doGen 8824、UI 9975/10026/10062）全部在其后。顺带补回了被旧串吃掉的 `// 出图后放大（0.6.0 从 0.1.0 移植）` 注释。

**顺查**：`OnlineModelsPanel` 在 `online_models.js:522` 有定义，构建进 client.js 后在 1659 行，引用在 9889 行 —— 定义先于引用，那条 `RootBoundary` 报错已不存在。app.js 里那处引用（8037）本身没有定义，靠拼接顺序拿到的，别把 online_models.js 从构建链里去掉。

## 0.7.119 · 2026-10-27 · 常用尺寸收成一个按钮 + 二级菜单

原来是一排按钮平铺（`RES_PRESETS.map` 直接渲染成 6~8 个 `<button>`），横着占满一整行，窄屏还会折行。改成单个按钮开二级菜单。

### 交互

- 按钮文案 `常用尺寸`，选过档就变成 `常用尺寸 · 档位名`，右侧 `▾` / `▴`
- 点开弹层：两列栅格（`pCols2 === 1` 时单列），每项显示 `档位名  宽×高`，当前档高亮
- 点某一项 → 套用宽高、记下 `sizePrev`、自动收起菜单、`setMsg` 提示
- 当前档再点一次 → 取消，宽高还原到套用前
- 按钮旁边多一个 `取消` 小按钮，只在高亮时出现，作用同上
- 点弹层外面关闭：一层 `position: fixed` 的透明遮罩（`zIndex: 55`），弹层本身 `zIndex: 60`

### 实现细节

- 新增 `sizeMenuOpen` state（8554 附近）
- 弹层 `position: absolute`，挂在外层 `position: relative` 的容器里；生成页那张卡的 `overflow: visible`，所以不会被裁
- 背景用 `var(--c-panel)`、描边 `var(--c-line)`，跟本地其他面板一致
- 高度超 280px 内部滚动

### 保留的语义

`sizePick` / `sizePrev` 那两个 ref 的逻辑原样搬进菜单项，所以「套用 → 再点取消 → 恢复原宽高」这条链路没变，只是从一排按钮挪进了弹层。

### 验证

```
node --check lib/app.js    → 0
node --check lib/client.js → 0
verify_client.js           → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js         → 39 引用 / 39 定义 / 缺 0
client.js                  1,007,013 → 1,009,647 字符
```

中途踩了一次括号：把 `<div>` 换成数组 `[遮罩, 弹层]` 后，`}))` 需要补 `]` 闭合数组，第一次写成 `}))])` 多了一个 `)`，`node --check` 报 `Unexpected token ')'`，改成 `}))]` 通过。

## 0.7.120 · 2026-10-27 · 宽/高排成一行，右侧空白收掉

截图反馈：宽 1024、高 1408 各占一整行，右边一大片空，对调按钮和倍率又被挤到下面单独成行。

### 根因：CSS 选择器带祖先，本地没有那个祖先

工作台那条规则写的是：

```css
.dsh-comfy-ui .cc-size-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px minmax(76px,.85fr); gap:7px; align-items:end }
```

`.dsh-comfy-ui` 这个类只在 `PreviewConsole`（工作台页）的根节点上。本地生成页没有这个祖先，整条规则**一条都没命中** —— 于是 `.cc-size-row` 就是个普通 `div`，`display:block`，四个子元素各占一行。`.cc-size-row input[type=number]` 和 `.cc-size-row .cc-icon-button` 那两条同理，也全废了。

### 修法：内联强制

不再指望外部类，直接把栅格写在 `style` 上：

```jsx
style: {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "minmax(0,104px) minmax(0,104px) 32px minmax(76px,112px)",
  gap: "7px",
  alignItems: "end",
  justifyContent: "start",
}
```

四列：宽 104 / 高 104 / 对调 32 / 倍率 76~112，合计约 371px，最窄的生成页（约 380px）也塞得下；`justifyContent: "start"` 让整排靠左，宽屏时不再把输入框拉长填满。

### 效果

```
宽 [1024]  高 [1408]  [⇄]  倍率 [‹ 1.00 ›]
步数 [28]   CFG [4]
[ 常用尺寸 ▾ ]
```

宽高在一排，右侧空白收掉，倍率回到同一排。

### 顺带说明

`.cc-icon-button` 的样式同样挂在 `.dsh-comfy-ui` 下，对调按钮这次全靠 `S.btn2` + 内联的 32×32 撑着，圆角和边框来自 `S.btn2`，视觉上和旁边一致，不影响点击。

### 验证

```
node --check lib/app.js    → 0
node --check lib/client.js → 0
verify_client.js           → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js         → 39 引用 / 39 定义 / 缺 0
client.js                  1,009,647 → 1,009,800 字符
```

### 教训

把工作台组件搬进本地时，凡是依赖 `.dsh-comfy-ui` 祖先的 `cc-*` 规则都不会生效。要么给本地容器补上这个类，要么把关键布局改成内联。这次选了后者 —— 只影响这一处，不动全局样式。

## 0.7.121 · 2026-10-27 · 倍率从宽高那排拆出来

宽高那排只留三个：宽 118 / 高 118 / 对调 32，倍率单独一行、宽度钉在 150px。

```
宽 [1024]  高 [1408]  [⇄]
倍率 [‹ 1.00 ›]
步数 [28]   CFG [4]
[ 常用尺寸 ▾ ]
```

倍率那行用 `display:flex; justifyContent:start`，容器 `width/maxWidth` 都是 150px、`flex:0 0 auto`，`DraggableNumberInput` 的 `‹ 1.00 ›` 三段在里面不会再被压扁。宽高各自 118px，比之前的 104px 宽一点，四位数字（1024/1408）看得清。

宽高那排的栅格仍然写死在内联 `style` 里 —— `cc-size-row` 的 CSS 挂在 `.dsh-comfy-ui` 祖先下，本地生成页没有那个类，靠外部类就是各占一行。

### 验证

```
node --check lib/app.js    → 0
node --check lib/client.js → 0
verify_client.js           → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js         → 39 引用 / 39 定义 / 缺 0
client.js                  1,009,800 → 1,010,088 字符
```

## 0.7.122 · 2026-10-27 · 宽高输入框重叠修掉

截图：宽 1024 那个框一路盖到「高」下面，两个框视觉上叠在一起。

### 根因：grid item 的 min-width 默认是 auto

上一步把列宽钉成 `minmax(0,118px)`，但真正决定「压不压得住」的不是列宽，是**子项的 `min-width`**。grid item 默认 `min-width: auto`，意思是「不小于内容的固有宽度」——`<input type="number">` 的固有宽度由 `size` 属性决定（默认 20 字符，约 150px），撑破了 118px 的列，于是溢出到右边那一列，盖住「高」。

`S.field` 本身长这样：

```js
field: { display: "flex", flexDirection: "column", gap: "4px" }   // 没有 minWidth
```

`minmax(0,118px)` 只限制了轨道宽度，管不住轨道里溢出内容。

### 修法：三处一起

```jsx
h("label", { style: { ...S.field, minWidth: 0, overflow: "hidden" } },
  h("span", { style: S.label }, "宽"),
  h("input", { ..., style: { ...S.inp, width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" } }))
```

1. **label 加 `minWidth: 0`** —— 解除 `min-width: auto`，让轨道真正能压到 118px
2. **label 加 `overflow: hidden`** —— 万一还有溢出，直接裁掉，不跨列
3. **input 加 `boxSizing: "border-box"` + `maxWidth: "100%"`** —— padding 和 border 算进 100%，不再比父级宽 18px

倍率那行同源，也补了 `minWidth: 0` / `overflow: hidden`。

### 验证

```
node --check lib/app.js    → 0
node --check lib/client.js → 0
verify_client.js           → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js         → 39 引用 / 39 定义 / 缺 0
client.js                  1,010,088 → 1,010,319 字符
```

### 记一笔

这已经是同一块地方第三次栽在「CSS 规则没进到本地」上：第一次是 `.dsh-comfy-ui` 祖先缺失导致整条规则不生效，第二次是列宽对了但没管 `min-width: auto`。搬工作台组件时，布局相关的属性最好全写在内联 `style` 里，并且 grid/flex 子项一律补 `minWidth: 0`。

## 0.7.123 · 2026-10-27 · 种子换成工作台的 Seed + Seed 变化

原来是一根控制带：`视角 [俯视|平视|仰视] │ 种子 [150px] [随机] [☐ 固定] [同参数下可复现]`。现在种子拆出来单独一行，用工作台那套两列结构。

### 现在的样子

```
视角 [俯视 | 平视 | 仰视]
Seed [12345]     Seed 变化 [锁定 ▾]
```

Seed 变化四档：**锁定 / 递增 / 递减 / 随机**。

### 四档语义

| 档位 | 行为 |
|---|---|
| 锁定 | 用输入框里的值；填 0 则每次随机 |
| 递增 | 用输入框的值 +1 |
| 递减 | 用输入框的值 −1，到 0 就不再减 |
| 随机 | 每次换一个 |

生成完成后把**实际用到的值**写回输入框（`if (_sm !== "lock") setSeed(_usedSeed)`），所以选「递增」连点生成会 100 → 101 → 102，选「递减」停在 0 不会变负数。

### 实现

原来那段判断是：

```js
const _lock = !!lockSeed && Number(seed) > 0;
const _usedSeed = _lock ? Math.floor(Number(seed)) : Math.floor(Math.random() * 1e15);
```

换成按 `seedMode` 分派：

```js
const _sm = seedMode || "lock";
const _baseSeed = Math.max(0, Math.floor(Number(seed) || 0));
const _usedSeed = _sm === "lock" ? (_baseSeed > 0 ? _baseSeed : 随机)
  : _sm === "increment" ? (_baseSeed + 1)
  : _sm === "decrement" ? Math.max(0, _baseSeed - 1)
  : 随机;
```

`lockSeed` 那个 state 保留着不动 —— 它还在 `USER.last` 里，删了会让老用户的选择丢失；新逻辑一律看 `seedMode`，初始化时 `L.seedMode || (L.lockSeed ? "lock" : "random")`，所以老状态能平滑过渡。

### 两列布局

```jsx
h("div", { style: { display: "grid", gridTemplateColumns: pCols2 === 1 ? "1fr" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "end" } },
  <Seed: S.field 纵向>,
  <Seed 变化: SelectMenu>)
```

input 沿用刚修好的那套：`width:100%` + `minWidth:0` + `maxWidth:100%` + `boxSizing:border-box`，不会再溢出到隔壁列。

### 验证

```
node --check lib/app.js    → 0
node --check lib/client.js → 0
verify_client.js           → 模块 id=dsh-comfyui-console，工厂执行成功
scan_components.js         → 39 引用 / 39 定义 / 缺 0
```

分派逻辑九组用例：

```
lock      seed= 12345  ->  12345            复用
increment seed= 12345  ->  12346            ±1
decrement seed= 12345  ->  12344            ±1
random    seed= 12345  ->  550383409709935  随机
lock      seed=     0  ->  200672256879588  随机
increment seed=     0  ->  1                ±1
decrement seed=     0  ->  0                ±1（不越界）
increment 连续两次: 102（100 -> 101 -> 102）
decrement 到 0 停: 0（不变 -1）
```

client.js 1,010,319 → 1,010,497 字符。