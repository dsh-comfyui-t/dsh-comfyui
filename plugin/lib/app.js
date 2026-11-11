/**
 * DSH × Comfy Cards Next —— 界面主体
 *
 * 本文件**不能直接运行**，由 tools/build_client.py 与 dict.js 一起
 * 拼成 lib/client.js（客户端 bundle 必须单文件）。
 * 编辑本文件后要跑一次构建：
 *     python tools\build_client.py      （在包根 plugin\ 下执行）
 *
 * 依赖（构建后同在作用域内，来自 dict.js）：
 *     LIB / EXTRA / SEG
 */

const React = require("react");
const h = React.createElement;
/* ================= 自检与崩溃取证（模块级） ================= */
let LAST_TAB_INFO = "";
let LAST_ERR = "";
let LAST_CRASH = "";
try { LAST_CRASH = localStorage.getItem("comfyui.lastCrash") || ""; } catch (e0) {}

function tabTextLen(n) {
	if (n === null || n === undefined || n === false) return 0;
	if (typeof n === "string" || typeof n === "number") return String(n).length;
	if (Array.isArray(n)) return n.reduce((a, x) => a + tabTextLen(x), 0);
	if (typeof n !== "object") return 0;
	return tabTextLen(n.kids) + (n.props && typeof n.props.placeholder === "string" ? n.props.placeholder.length : 0);
}

function __noteCrash(where, err) {
	var msg = String((err && err.stack) || err || "?");
	if (msg.length > 300) msg = msg.slice(0, 300);
	LAST_CRASH = where + "：" + msg;
	try { localStorage.setItem("comfyui.lastCrash", LAST_CRASH); } catch (e1) {}
}


const __BoundaryBase = (React && React.Component) ? React.Component : (class { constructor(p) { this.props = p || {}; } render() { return this.props.children; } });

/** 单页边界：某个标签页崩了只显示一行红字 */
class TabBoundary extends __BoundaryBase {
	constructor(props) { super(props); this.state = { err: null }; }
	static getDerivedStateFromError(e) { return { err: e }; }
	componentDidCatch(e) { __noteCrash("TabBoundary", e); }
	render() {
		if (this.state && this.state.err) {
			var m = String((this.state.err && this.state.err.message) || this.state.err);
			return h("div", { style: Object.assign({}, S.bad, { minHeight: "120px" }) }, "这个页面崩了：" + m + "（把这句发给我）");
		}
		return this.props.children;
	}
}

/** 根边界：连 Console 自己崩了也只留字，不整页白 */
class RootBoundary extends __BoundaryBase {
	constructor(props) { super(props); this.state = { err: null }; }
	static getDerivedStateFromError(e) { return { err: e }; }
	componentDidCatch(e) { __noteCrash("RootBoundary", e); }
	render() {
		if (this.state && this.state.err) {
			var m = String((this.state.err && this.state.err.message) || this.state.err);
			return h("div", { style: { position: "fixed", inset: 0, zIndex: 2147483001, background: "var(--c-card)", color: "var(--c-bad)", font: "13px/1.6 system-ui", padding: "16px", overflow: "auto" } },
				"Comfy Cards Next 整体崩了：" + m + " —— 这行字请发给我（上次崩溃：" + LAST_CRASH + "）");
		}
		return this.props.children;
	}
}

/** 卡包档位的中文名：导出与导入共用同一套说法 */
const PACK_MODE_CN = { baked: "完整导出", hybrid: "快速导出", recipe: "配方导出" };

const RES_PRESETS = [
  ["竖 832×1216", 832, 1216],   // ⚠️ 这个尺寸会画成两个人，见 docs/生成经验.md #2
  ["竖 896×1152", 896, 1152],
  ["竖 1024×1408", 1024, 1408],
  ["竖 768×1344", 768, 1344],
  ["方 1024×1024", 1024, 1024],
  ["竖 1152×1344", 1152, 1344],
  ["横 1216×832", 1216, 832],
  ["横 1344×768", 1344, 768],
  ["横 1152×896", 1152, 896],
];

function ConsoleSafe(props) { return h(RootBoundary, null, h(Console, props)); }


// ==================== 配置 ====================
/** 端口/地址可覆盖（换机器、改过 config.json 的 comfyPort / sidecarPort 时用）：
 *   1) window.__DSH_CUI__ = { comfyUrl, sidecarUrl }   —— 宿主注入优先
 *   2) localStorage "dsh-comfyui-console/ports" = {"comfy":"http://…","sidecar":"http://…"}
 *   3) 都没有就用本机默认 8188 / 8199
 */
const CUI_CFG = (() => {
	let w = {}, ls = {};
	try { w = (typeof window !== "undefined" && window.__DSH_CUI__) || {}; } catch (e) { }
	try { ls = JSON.parse(localStorage.getItem("dsh-comfyui-console/ports") || "{}") || {}; } catch (e) { }
	return {
		comfy: String(w.comfyUrl || ls.comfy || "").replace(/\/+$/, "") || "http://127.0.0.1:8188",
		sidecar: String(w.sidecarUrl || ls.sidecar || "").replace(/\/+$/, "") || "http://127.0.0.1:8199",
	};
})();
const COMFY = CUI_CFG.comfy;
const EXPANDER = CUI_CFG.sidecar;
/**
 * 侧车握手头（不是密钥）。作用：让侧车请求变成"非简单请求"，强制浏览器先发 CORS 预检；
 * 侧车 ACAO 只回显白名单 Origin，别的站点预检必败 → 恶意页面连请求都发不出去。
 * 详见 plugin/docs/生成经验.md #8。
 */
const CONSOLE_HEADERS = { "X-Console-Client": "1" };

/** 侧车请求头。浏览器端只要 client 头 + 本机 Origin 就过闸，不发 token
 *  （见 _auth_ok 的注释）。dictionaryRequest 历史上一路调 instanceHeaders()，
 *  但那个函数在某次合并里丢了 —— 词库搜索/补全/迁移一调就是 ReferenceError。
 *  这里补回唯一定义，跟 CONSOLE_HEADERS 保持同一份真相。 */
function instanceHeaders() { return CONSOLE_HEADERS; }
/** 只给侧车加：jpost/jget 也被 ComfyUI 复用，无差别加会改动 ComfyUI 的请求语义 */
function sidecarHeaders(url) {
	return String(url || "").indexOf(EXPANDER) === 0 ? Object.assign({}, CONSOLE_HEADERS) : {};
}

/** 模块级函数（写盘/存档/后台任务）也要能提示，Console 渲染时把 setMsg 挂进来 */
let MSG_SINK = null;
/** 生成页的「连接设置」按钮要打开 A 线那套弹窗：弹窗状态 setShowConn 在 PreviewConsole 里，
 *  跨组件拿不到，所以照 MSG_SINK 的样子开一个钩子。弹窗走 OverlayModal（portal 到 body），
 *  pvhost 被 display:none 收起来时也照样显示。 */
let OPEN_CONN_SINK = null;
/** 生成页那块底模卡要复用 A 线模型库（选模型 → 详情面板 → 「使用」），
 *  但 openModelLibrary 是 PreviewConsole 的闭包，跨组件拿不到，开一个钩子：
 *  OPEN_MODEL_PICKER_SINK(kind, currentName) 打开弹窗；选完由 A 线反向回调 MODEL_PICKED_SINK(name)
 *  把名字写回生成页自己的 ckpt（两边是两套 state，靠 USER.last 只共享初值，必须显式回传）。 */
let OPEN_MODEL_PICKER_SINK = null;
/** 0.7.130：清掉「当前挂着的角色卡插入状态」——lockCards（生图时按锁剔词的）+ INSERTED（卡片蓝框、
 *  再点解除）。历史页「套用此图生成设置」跨组件拿不到 Console 闭包里的 lockCards：
 *  套用了新提示词却留着上一张角色卡的禁词锁，出图时 stabilizePrompt 会拿旧锁把新词剔掉，
 *  表现就是「同样的提示词，换一张卡再出图构图就不对」。 */
let CLEAR_CARD_STATE_SINK = null;

/** 画布出图点击放大：Console 经此钩子打开 PreviewConsole 的 OutputInspector（2026-11-10） */
let OUTPUT_VIEW_SINK = null;
let MODEL_PICKED_SINK = null;
function MSG(text) { try { if (MSG_SINK) MSG_SINK(String(text)); } catch (e) { /* ignore */ } }
/** 自动适配的取证通道。
 *
 *  为什么不只用 MSG：setMsg 是 PreviewConsole 的 state，模型库弹窗关掉后它那条提示行
 *  不一定还挂在视口里，用户很容易「什么都看不到」。这里同时打控制台并留一份到
 *  localStorage，事后可以：
 *      localStorage.getItem('dsh-adapt-log')
 *  直接读出完整的判定轨迹，不用盯着界面猜。 */
function DIAG(text) {
	const line = String(text);
	try { console.warn("[适配] " + line); } catch (e) { /* ignore */ }
	try { MSG(line); } catch (e) { /* ignore */ }
	try {
		const KEY = "dsh-adapt-log";
		const old = window.localStorage.getItem(KEY);
		const arr = old ? JSON.parse(old) : [];
		arr.push(new Date().toISOString().slice(11, 19) + "  " + line);
		while (arr.length > 40) arr.shift();
		window.localStorage.setItem(KEY, JSON.stringify(arr));
	} catch (e) { /* ignore */ }
}
const LS_KEY = "dsh-comfyui-console/v1";
/** 存档结构版本：字段改名/改语义时 +1，并在 STATE_MIGRATIONS 里补一条迁移。老数据一律保留。 */
const STATE_VERSION = 2;
const STATE_MIGRATIONS = {
	// 1 -> 2：加 styleCards 数组（0.2.0 引入），老档没有就当空
	1: (u) => { if (!Array.isArray(u.styleCards)) u.styleCards = []; return u; },
};
/** 把 localStorage 老档升到 STATE_VERSION；返回 {state, from, migrated} */
function migrateState(raw) {
	const st = Object.assign({}, raw || {});
	let from = Number(st.__v || 1);
	if (!(from > 0)) from = 1;
	while (from < STATE_VERSION) {
		const fn = STATE_MIGRATIONS[from];
		if (fn) { try { fn(st); } catch (e) { /* 迁移失败不阻塞启动 */ } }
		from += 1;
	}
	const migrated = Number(st.__v || 1) < STATE_VERSION;
	st.__v = STATE_VERSION;
	return { state: st, migrated };
}

// ==================== 持久化 ====================
function lsRead() {
	try {
		const raw = window.localStorage.getItem(LS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (e) {
		try {
			const raw = window.localStorage.getItem(LS_KEY) || "";
			if (raw) window.localStorage.setItem(LS_KEY + ".broken", raw);
		} catch (e2) { /* ignore */ }
		return {};
	}
}
function lsWrite(patch) {
	try {
		const cur = lsRead();
		const next = Object.assign({}, cur, patch);
		window.localStorage.setItem(LS_KEY, JSON.stringify(next));
		return true;
	} catch (e) { return false; }
}

/** 用户数据：自定义预设 + 自定义词条 + 上次用的参数 */
/** 默认模型链：Anima 系（公开模型）；LoRA 默认不挂，自己选 */
const MODEL_DEFAULTS = {
	clip: "qwen_3_06b_base.safetensors",
	clipType: "qwen_image",
	vae: "qwen_image_vae.safetensors",
	unet: "anima-aesthetic-v1.1.safetensors",
	loras: [],
};

/**
 * UNet 族 → 该族要求的空 latent 节点。
 *
 * ⚠️ 2026-10-31：原来 buildGraph 无条件用 EmptyLatentImage（4 通道 latent）。
 *    MOSS-Image 在 FLUX.2 latent space 里跑，要用 EmptyFlux2LatentImage —— 这个节点名
 *    取自本仓 presets.js 里现成的 `moss-sft` / `moss-base` 条目（那边的 `latent` 字段
 *    就是 EmptyFlux2LatentImage），不是猜的。用 EmptyLatentImage 会在 KSampler 接
 *    latent 时通道不匹配。qwen_image（Anima）沿用 4 通道不变。
 */
const UNET_LATENT_NODE = {
	qwen_image: "EmptyLatentImage",
	moss_image: "EmptyFlux2LatentImage",
};
function latentNodeFor(clipType, override) {
	if (override) return String(override);
	return UNET_LATENT_NODE[String(clipType || "")] || "EmptyLatentImage";
}

/**
 * 哪些「编码器类型」代表底模取自 diffusion_models（走 UNETLoader）而不是 checkpoints。
 *
 * ⚠️ 2026-10-31：原来这两条链的判据写死成 `clipType === "qwen_image"`，等于把
 *    「这个底模是不是 UNet 型（单文件 DiT + 外挂文本编码器）」错等价成「是不是 qwen_image」。
 *    MOSS-Image 正是 UNet 型（moss_image_* 放 diffusion_models，Qwen3.5-9B 作外挂 TE，
 *    FLUX.2 VAE 单独加载），选它时会掉进 CheckpointLoaderSimple 分支，表现是
 *    「底模不在 checkpoints 里」或 ComfyUI 回 400。
 *
 * 加新模型族只需往这个数组补一行。CLIPLoader 的合法 type 值本身是从
 * ComfyUI `/object_info/CLIPLoader` 动态枚举的，这里只负责「走哪条链」。
 */
const UNET_CLIP_TYPES = ["qwen_image", "moss_image"];
function isUnetClipType(t) {
	return UNET_CLIP_TYPES.indexOf(String(t || "")) >= 0;
}

const USER = migrateState(Object.assign({
	presets: [],       // [{name, cat, pos, neg, w, h, steps, cfg, sampler, scheduler, ckpt, loras}]
	frags: {},         // {'自定义分类': [[cn, en], ...]}
	last: null,
	styleCards: [],   // 自建风格卡
}, lsRead())).state;

function saveUser() {
	const ok = lsWrite(USER);
	if (!ok) MSG("本地存档写不进去（localStorage 满或被禁用），这次改动没保存");
	// 0.7.78：以前这两行写在 return 之后 —— 永远是死代码，词库改动不会即时落盘
	try { dictFlushSoon(); } catch (e) { /* ignore */ }
	return ok;
}

/** 老卡里的胶囊备注可能只剩英文（n === t）：开机补一次中文，不动用户自己写过的备注 */
function healUserZh() {
  /* zhFillParts / zhOf / CARD_ZH 已提到本函数之前，这里真的能补到中文了 */
  const fix = (c) => (c && c.parts && typeof c.parts === "object" ? Object.assign({}, c, { parts: (typeof zhFillParts === "function" ? zhFillParts(c.parts) : c.parts) }) : c);
  if (Array.isArray(USER.cards)) USER.cards = USER.cards.map(fix);
  if (Array.isArray(USER.styleCards)) USER.styleCards = USER.styleCards.map(fix);
}
// ==================== 卡片中文字段 ====================
// 2026-10-21 搬到模块顶部（原来在文件尾部）。
//
// 原因是一个**只在有角色卡时才触发**的崩：
//   healUserZh() 在模块加载时立即执行 -> zhFillParts() -> zhOf() -> 读 CARD_ZH
//   而 CARD_ZH 是 const，原来声明在调用点之后 ->
//   ReferenceError: Cannot access 'CARD_ZH' before initialization
//   typeof 守卫拦不住：zhFillParts 是函数声明，会提升，typeof 恒为 "function"。
//
// 依赖顺序：CARD_ZH -> zhOf -> zhFillParts -> cardFromJson，别打乱。
// ⚠️ CARD_ZH 是 const，有 TDZ —— 必须留在 healUserZh() 调用之前。

/** 常见标签的中文备注（没命中就显示英文本身） */
const CARD_ZH = {
	"1girl": "单人女", "1boy": "单人男", "solo": "单人", "group": "多人",
	"long hair": "长发", "blonde hair": "金发", "brown hair": "棕发", "red hair": "红发", "silver hair": "银发", "white hair": "白发", "curly hair": "卷发", "wavy hair": "波浪发", "green eyes": "绿眼睛", "purple eyes": "紫眼睛", "heterochromia": "异色瞳", "no glasses": "不戴眼镜", "black hair": "黑发", "long black hair": "黑色长发", "maple leaf hair ornament": "枫叶发饰", "straight hair": "直发", "blunt bangs": "齐刘海", "short hair": "短发",
	"ponytail": "马尾", "twintails": "双马尾", "braid": "辫子", "bun": "丸子头", "bangs": "刘海",
	"blue eyes": "蓝眼睛", "small breasts": "小胸", "medium breasts": "中等胸", "large breasts": "大胸", "huge breasts": "巨乳", "slim": "纤细身材", "pubic hair": "阴毛", "hairy": "体毛", "red eyes": "红眼睛", "detailed eyes": "眼睛细节", "sparkling eyes": "闪亮眼", "eyes": "眼睛",
	"glasses": "眼镜", "round eyewear": "圆框眼镜", "maple leaf hair ornament": "枫叶发饰", "hair ornament": "发饰",
	"beige trench coat": "米色风衣", "trench coat": "风衣", "white shirt": "白衬衫", "shirt": "衬衫",
	"blue necktie": "蓝领带", "necktie": "领带", "black skirt": "黑裙", "skirt": "裙子",
	"dress": "连衣裙", "jacket": "外套", "uniform": "制服", "stockings": "丝袜", "kneehighs": "及膝袜",
	"closed mouth": "闭嘴", "smile": "微笑", "open mouth": "张嘴", "blush": "脸红",
};

/** 取中文备注：整串优先，其次最长命中，都没有就空 */
function zhOf(t) {
	const s = String(t || "").toLowerCase().trim();
	if (!s) return "";
	if (CARD_ZH[s]) return CARD_ZH[s];
	let best = "", hit = "";
	for (const k of Object.keys(CARD_ZH)) { if (s.indexOf(k) >= 0 && k.length > best.length) { best = k; hit = CARD_ZH[k]; } }
	return hit;
}

/** 从 .json 导入角色卡（兼容单卡 / 数组 / {cards:[]}） */
/** 导入 JSON 里的一条卡 → 内部记录（纯函数：守住 name/tags 必有，其余缺省补齐）
 *  guard / locks / lora 必须原样带过来，否则「卡随分发走」就丢了特征锁和 LoRA */
/** 补齐胶囊中文备注：n 为空或等于英文本身时，用 CARD_ZH 查一次；查不到就保留原值 */
function zhFillParts(parts) {
  const out = {};
  for (const k of Object.keys(parts || {})) {
    const raw = parts[k];
    if (typeof raw === "string") { out[k] = raw; continue; }
    if (raw && !Array.isArray(raw)) { out[k] = raw; continue; }
    const arr = Array.isArray(raw) ? raw : [];
    out[k] = arr.map((x) => {
      const t = String((x && x.t) || "").trim();
      let n = String((x && x.n) || "").trim();
      if (t && (!n || n === t)) { const z = zhOf(t); if (z && z !== t) n = z; }
      return { t: t, n: n || t };
    }).filter((x) => x.t);
  }
  return out;
}

// 0.7.77：cardFromJson 在**模块顶层**，而 joinCardParts / splitCardTags / normPart / condForSave
// 都在内层作用域里 —— 以前只要 tags 为空（导出时没写 tags、只有 parts 的卡包就是这样）
// 就会抛 ReferenceError，整条导入链路静默死掉：「导入瞬间结束、绘图台里没有、消息卡在正在解析」。
// 这里给它一份自带的顶层实现，不再依赖内层函数。
const CF_ORDER = ["trigger", "base", "hair", "eyes", "glasses", "outfit", "proportion", "extra"];
function cfNormPart(v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string")
    ? { t: x, n: zhOf(x) || x }
    : { t: String((x && x.t) || ""), n: String((x && x.n) || (x && x.t) || "") }).filter((x) => x.t);
  if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean).map((x) => ({ t: x, n: zhOf(x) || x }));
  return [];
}
function cfTagsOf(parts) {
  const p = (parts && typeof parts === "object") ? parts : {};
  const out = [];
  const trg = String(p.trigger || "").trim();
  if (trg) out.push(trg);
  for (const k of CF_ORDER) {
    if (k === "trigger") continue;
    if (k === "proportion") { const sp = (typeof proportionTags === "function") ? proportionTags(p[k]) : ""; if (sp) out.push(sp); continue; }
    const s = cfNormPart(p[k]).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
    if (s) out.push(s);
  }
  if (out.length) return out.join(", ");
  // 兜底：不认识的键也把词捞出来（英文键 / 自定义分组），总比判成「没有卡」好
  const loose = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === "string") { const s = v.trim(); if (s) loose.push(s); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === "object") { if (v.t) walk(v.t); else Object.keys(v).forEach((k) => walk(v[k])); }
  };
  Object.keys(p).forEach((k) => { if (k !== "trigger") walk(p[k]); });
  return Array.from(new Set(loose)).join(", ");
}
function cfPartsFromTags(tags) {
  const parts = { trigger: "", base: [], hair: [], eyes: [], glasses: [], outfit: [], extra: [] };
  String(tags || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((tok, i) => {
    if (i === 0 && tok.indexOf(" ") < 0) { parts.trigger = tok; return; }
    parts.extra.push({ t: tok, n: zhOf(tok) || tok });
  });
  return parts;
}
function cardFromJson(c) {
  const nm = String((c && c.name) || "").trim();
  if (!nm) return null;
  const tags = String(c.tags || cfTagsOf((c && c.parts) || {})).trim();
  if (!tags) return null;
  const condRaw = (c && (c.conditioning || c.cond)) || null;
  return {
    id: "u" + String(Date.now()) + "_" + Math.random().toString(36).slice(2, 7),
    name: nm,
    tags: tags,
    note: String(c.note || ""),
    cover: String(c.cover || ""),
    file: String((c && c.__file) || (c && c.file) || ""),
    parts: zhFillParts((c && c.parts && typeof c.parts === "object") ? c.parts : cfPartsFromTags(tags)),
    neg: cfNormPart(c && c.neg),
    lora: String((c && c.lora) || ""),
    loraW: Number(c && c.loraW) > 0 ? Number(c.loraW) : 0.7,
    loraAlt: String((c && c.loraAlt) || ""),
    conditioning: (condRaw && typeof condRaw === "object" && condRaw.presets && Object.keys(condRaw.presets).length) ? condRaw : undefined,
    locks: (c && Array.isArray(c.locks)) ? c.locks : [],
  };
  // 0.7.92：卡里其它字段（cover / loraNote / schemaVersion / embeddedDir / packMode / baseModels …）
  // 以前只抄上面这份白名单 → 导入卡包时 `cover` 和 `embeddedDir` 到面板就没了，随后 persistCards 落盘自然也没有。
  Object.keys(c || {}).forEach((k) => {
    if (k in rec || k === "__file" || k === "cond") return;
    if (c[k] !== undefined) rec[k] = c[k];
  });
  return rec;
}
// ==================== 卡片中文字段 结束 ====================
healUserZh();
/** 记住「上次用的那一套」：底模/编码器/编码器类型/VAE/LoRA/宽高/步数/CFG/采样器/调度器/文件名前缀 */
function saveLast(patch) {
  USER.last = Object.assign({}, USER.last || {}, patch);
  saveUser();
}

/**
 * 把预置预设（SEED_PRESETS，来自官方预设的派生）补进去。
 * 只在**不存在**时补，不覆盖用户改过或同名的版本。
 * neg 为 null 的条目用官方那条负面提示词填上。
 */
function ensureSeeds() {
	if (typeof SEED_PRESETS === 'undefined' || !SEED_PRESETS.length) return 0;
	const baseNeg = SEED_PRESETS[0].neg || '';
	const have = new Set((USER.presets || []).map((p) => p.cat + '\u0000' + p.name));
	let added = 0;
	for (const s of SEED_PRESETS) {
		const key = s.cat + '\u0000' + s.name;
		if (have.has(key)) continue;
		const item = Object.assign({}, s);
		if (item.neg === null || item.neg === undefined) item.neg = baseNeg;
		delete item.seed;
		USER.presets = (USER.presets || []).concat([item]);
		added++;
	}
	if (added) saveUser();
	return added;
}
ensureSeeds();   // 补预置预设，返回值无人用


/** 全部图库 = 内置分类 + 用户自定义分类 */
function allLib() {
	const out = {};
	// 0.7.66：词库「清空（含内置）」后，内置词库整体不出现在面板里
	// 0.7.81：只跳过内置循环 —— 早退会把 USER.frags / USER.cats 一起砍掉，导入进来的卡也会「全部 0 条」
	const hideBuiltin = !!(USER && USER.hideBuiltinDict);
	for (const k of (hideBuiltin ? [] : Object.keys(LIB))) { if (String(k).indexOf("角色-") === 0) continue; const hid = new Set(((USER.hidden || {})[builtinKey(k) || k] || []).map((x) => String(x).trim())); const dest = (USER.moved || {})[k] || k; const ovs = (USER.ov || {})[k] || []; const arr = LIB[k].filter((p) => !hid.has(String(p[0]).trim())).map((p) => { const r = ovs.find((x) => x[0] === String(p[0]).trim()); return r ? [r[1], r[2]] : p; }); if (arr.length) out[dest] = (out[dest] || []).concat(arr); }
	for (const k of Object.keys(USER.frags || {})) { if (String(k).indexOf("角色-") === 0) continue;
		out[k] = (out[k] || []).concat(USER.frags[k]);
	}

	for (const k of (USER.cats || [])) { if (!out[k]) out[k] = []; }
	return out;
}

/** 生成页胶囊视图里「带中文备注」新加的词落到这个词库分类（自建，可改名/删除） */
const PR_HOME_CAT = "自加词";

/** 新卡片的落盘分类：全部→自加词，自建→自己，内置→最后一个源分类 */
function dictCardTargetCat(grp) {
	if (!grp) return "";
	if (grp.all) return PR_HOME_CAT;
	if (grp.custom) return grp.name;
	return (grp.src && grp.src[grp.src.length - 1]) || grp.name || "";
}



/** 胶囊词性：pos=永远进正向 / neg=永远进负面 / 没记＝按正向算（插入时进正向） */
function capPolOf(tag) {
	const k = String(tag || "").trim().toLowerCase();
	if (!k) return "";
	return (USER.capPol || {})[k] || "";
}

/** 写/清一颗胶囊的词性（不是 pos/neg 就清掉） */
function setCapPol(tag, v) {
	const k = String(tag || "").trim().toLowerCase();
	if (!k) return;
	USER.capPol = USER.capPol || {};
	if (v === "pos" || v === "neg") USER.capPol[k] = v; else delete USER.capPol[k];
	saveUser();
}

/** 英文标签 → 中文名（取词库卡片的 cn；一个卡片的 en 有多段就每段都映射）。
 *  胶囊视图用它决定显示中文还是英文，口径与角色卡一致。 */
function tagIndex() {
	const idx = {};
	try {
		const lib = allLib();
		Object.keys(lib).forEach((cat) => {
			(lib[cat] || []).forEach((p) => {
				const cn = String((p && p[0]) || "").trim();
				const en = String((p && p[1]) || "").trim();
				if (!cn) return;
				en.split(",").forEach((raw) => {
					const tk = raw.trim().toLowerCase();
					if (tk && !idx[tk]) idx[tk] = { cat: cat, cn: cn, en: en };
				});
			});
		});
	} catch (e) { /* 词库没加载好就当全部不认识，不影响功能 */ }
	return idx;
}

/** 胶囊中文备注：用户手填的优先，其次退回词库词条的中文名 */
function capNoteOf(tag) {
	const k = String(tag || "").trim().toLowerCase();
	if (!k) return "";
	const mine = (USER.capNote || {})[k];
	if (mine) return mine;
	const hit = tagIndex()[k];
	return hit ? hit.cn : "";
}

/** 写/删一颗胶囊的中文备注（空串＝清掉，回到词库中文名） */

/** ===== 词库分类：路径工具（'A/B' 层级，像文件夹） ===== */
/** 建树：根节点 {name,path,children,count} */

/** 拖拽中的分类（模块级：重渲染不丢） */

/** 返回 dict.js 里的原键（含已被移走的内置分类）；不是内置就返回空串 */
function builtinKey(p) {
	if (Object.prototype.hasOwnProperty.call(LIB, p)) return p;
	for (const k of Object.keys(USER.moved || {})) if ((USER.moved || {})[k] === p) return k;
	return "";
}
/** 全库搜索：中文名或英文标签包含关键词即命中；空查询返回 null */
/** 内置角色卡：一张演示卡（公开插件不带任何私人角色；删掉它、照它新建自己的即可） */
function builtinCards() {
  return [{
    id: "demo",
    name: "示例角色",
    note: "演示用 · 可删 · 照它新建你自己的卡",
    tags: "1girl, solo, long hair, black hair, blue eyes, white shirt, black skirt",
    neg: ["blonde hair", "short hair", "red eyes"],
  }];
}
/** 内置卡 + 本地卡；同 id 的本地卡覆盖内置（equals 可改内置卡） */
function allCards() {
	const out = builtinCards().map((c) => Object.assign({ builtin: true }, c));
	for (const c of USER.cards || []) {
		const i = out.findIndex((x) => x.id === c.id);
		if (i >= 0) out[i] = Object.assign({}, out[i], c);
		else out.push(Object.assign({ builtin: false }, c));
	}
  /** 自建的排前面（自己的最常用），内置沉底 */
  out.sort((a, b) => (a.builtin === b.builtin ? 0 : a.builtin ? 1 : -1));

	return out;
}

/** 磁盘角色卡（0.7.47）：侧车 /cards 已经扫好 cardsDir，前端启动与手动重扫时拉一次。
 *  规则（2026-10-22 用户报告定的口径）：
 *    · 磁盘来的卡打 fromDisk + file 标记，同一张以磁盘为准（磁盘是底稿）
 *    · 界面上手工建 / 手工导入的卡（没有 fromDisk）同名时保护，不覆盖，只计入「保护跳过」
 *    · 磁盘文件删了 → 对应的 fromDisk 卡从面板移除
 *  之前 0.7.46 前端一次都没调过 /cards，磁盘卡等于死文件（报告 2026-10-22）。 */
const CARD_DISK = { runs: 0, busy: false, okAt: 0, note: "" };
let REPAINT_SINK = null;
function repaintAll() { try { if (REPAINT_SINK) REPAINT_SINK(); } catch (e) { /* ignore */ } }
function cardFileKey(p) { return String(p || "").replace(/\//g, "\\").toLowerCase(); }

const CLIENT_VER = "0.7.92";

/** 0.7.58：把前端异常写到侧车 client-err.log（排障不用靠人抄屏） */
function clientLog(tag, detail) {
	try {
		fetch(EXPANDER + "/log", {
			method: "POST",
			headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
			body: JSON.stringify({ text: "v" + CLIENT_VER + " [" + tag + "] " + String(detail || "") }),
		}).catch(() => {});
	} catch (e) { /* ignore */ }
}

/** 0.7.52：在资源管理器里定位卡文件；没有落盘文件就打开那类卡片的目录 */
/** 0.7.70：LoRA 目录管理（列表 / 导入 / 删除），走侧车 /loras*，删除是搬 _trash 不是硬删 */
function loraApplyList(list) {
	try { if (window.__dshSetLoras) window.__dshSetLoras(list); } catch (e) { }
}

function loraRefresh() {
	return jget(EXPANDER + "/loras", 20000).then((d) => {
		if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车没响应"));
		const names = (d.loras || []).map((x) => x.name);
		loraApplyList(names);
		return { names: names, dir: d.dir, count: d.count, totalBytes: d.totalBytes };
	});
}

/** 导入一支 LoRA，四种来源：
 *   1) 网站直链 —— 粘 https://… （Civitai 的 /api/download/models/<id> 直链也行，要登录就在后面加空白+token）
 *   2) 本机路径 —— 单个 .safetensors / .pt / .ckpt
 *   3) 压缩包   —— .zip（里面挑出所有权重，图/说明忽略）
 *   4) 文件夹   —— 传下载文件夹，列出里面的权重与 zip 让你挑
 *   留空则上传刚才选中的文件（浏览器拿不到本机路径时用这条）。
 */
function loraShowResult(d) {
	if (!d) return null;
	if (!d.ok) { MSG("导入失败：" + String(d.error || "unknown")); return null; }
	if (d.items && d.items.length) {
		const good = d.items.filter((x) => x.ok);
		MSG("导入 " + good.length + " 支：" + good.map((x) => x.name + "（" + Math.round((x.bytes || 0) / 1048576) + " MB" + (x.dedup ? "·已有" : "") + "）").join("、"));
	} else {
		MSG("已导入 LoRA：" + d.name + "（" + Math.round((d.bytes || 0) / 1048576) + " MB）" + (d.dedup ? " · " + d.note : "") + (d.downloaded ? " · 下载 " + d.downloaded : ""));
	}
	return loraRefresh().then(() => d).catch(() => d);
}

function loraImport() {
	const pickFile = () => new Promise((res) => {
		let el = null;
		try {
			el = document.createElement("input");
			el.type = "file";
			el.accept = ".safetensors,.pt,.ckpt,.sft,.bin,.zip";
			el.style.position = "fixed";
			el.style.left = "-9999px";
			document.body.appendChild(el);
			el.onchange = () => res(el.files && el.files[0] ? el.files[0] : null);
			el.click();
			setTimeout(() => { if (!el.files || !el.files.length) res(null); }, 120000);
		} catch (e) { res(null); }
	});
	const upload = (file) => {
		if (/\.zip$/i.test(file.name)) { MSG("压缩包走本机路径那条（浏览器上传不支持解压）：把 " + file.name + " 的完整路径粘进来"); return Promise.resolve(null); }
		MSG("正在上传 " + file.name + "（" + Math.round(file.size / 1048576) + " MB）…");
		return fetch(EXPANDER + "/loras/import", {
			method: "POST",
			headers: Object.assign({ "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(file.name) }, CONSOLE_HEADERS),
			body: file,
		}).then((r) => r.json());
	};
	const byUrl = (u) => {
		// 允许「链接 + 空白 + token」，给 Civitai 这类要登录的直链用
		const m = String(u).trim().match(/^(\S+)\s+(\S+)$/);
		const url = m ? m[1] : String(u).trim();
		const token = m ? m[2] : "";
		MSG("正在从网站下载…（大模型要等，别关页面）");
		return jpost(EXPANDER + "/loras/import", { url: url, token: token }, 3600000);
	};
	const byPath = (p) => jpost(EXPANDER + "/loras/import", { path: p }, 900000);
	const scanDir = (dir) => jget(EXPANDER + "/loras/scan?dir=" + encodeURIComponent(dir), 30000).then((d) => {
		if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车没响应"));
		if (!d.files || !d.files.length) { MSG("这个文件夹里没有 .safetensors / .pt / .ckpt / .zip：" + d.dir); return null; }
		const lines = d.files.map((x, i) => (i + 1) + ". " + x.name + "  [" + Math.round(x.bytes / 1048576) + " MB" + (x.zip ? " · zip" : "") + "]");
		const pick = window.prompt("下载文件夹里找到 " + d.count + " 个候选，输入序号导入（多个用逗号，如 1,3；留空取消）：\n\n" + lines.slice(0, 20).join("\n") + (lines.length > 20 ? "\n…还有 " + (lines.length - 20) + " 个" : ""), "");
		if (!pick || !pick.trim()) return null;
		const idx = pick.split(/[,，\s]+/).map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= d.files.length);
		if (!idx.length) { MSG("序号不对，已取消"); return null; }
		MSG("开始导入 " + idx.length + " 个…");
		return idx.reduce((chain, n) => chain.then((acc) => {
			const f = d.files[n - 1];
			return byPath(f.path).then((r) => acc.concat([{ name: f.name, r: r }])).catch((e) => acc.concat([{ name: f.name, r: { ok: false, error: String(e) } }]));
		}), Promise.resolve([])).then((all) => {
			const good = all.filter((x) => x.r && x.r.ok);
			MSG("从文件夹导入 " + good.length + " / " + all.length + "：" + all.map((x) => x.name + (x.r && x.r.ok ? " ✓" : " ✗ " + String((x.r && x.r.error) || ""))).join(" · "));
			return { ok: good.length > 0 };
		});
	});
	return pickFile().then((file) => {
		const p = window.prompt(
			"导入 LoRA —— 下面四种填一个（留空 = 上传刚才选的文件）：\n" +
			"  · 网站直链：https://civitai.com/api/download/models/123456   （要登录就在链接后面空一格再粘 token）\n" +
			"  · 本机文件：D:\\下载\\xxx.safetensors\n" +
			"  · 压缩包：  D:\\下载\\xxx.zip（自动挑出里面的权重）\n" +
			"  · 文件夹：  C:\\Users\\你\\Downloads（列出候选让你挑序号）", "");
		const v = String(p || "").trim();
		if (!v) {
			if (!file) { MSG("没填来源，也没选文件 —— 已取消"); return null; }
			return upload(file);
		}
		if (/^https?:\/\//i.test(v)) return byUrl(v);
		if (/\.zip$/i.test(v)) return byPath(v);
		if (!/\.[a-z0-9]{1,6}$/i.test(v)) return scanDir(v);   // 没扩展名当文件夹
		return byPath(v);
	}).then(loraShowResult).catch((e) => { MSG("导入失败：" + String((e && e.message) || e)); return null; });
}

function loraDelete(name) {
	const nm = String(name || "").trim();
	if (!nm) { MSG("先在左边的下拉里选一支 LoRA，再点删除"); return Promise.resolve(null); }
	if (!window.confirm("删除 LoRA：「" + nm + "」？\n\n文件会搬进 models\\loras\\_trash-<时间戳>\\（不硬删，想恢复搬回来），ComfyUI 里的列表要重启后才会少这一支。")) return Promise.resolve(null);
	return jpost(EXPANDER + "/loras/del", { name: nm }, 60000).then((d) => {
		if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车没响应"));
		MSG("已删除 " + d.name + "（剩 " + String(d.left) + " 支）→ " + String(d.trash || ""));
		return loraRefresh().then(() => d).catch(() => d);
	}).catch((e) => { MSG("删除失败：" + String((e && e.message) || e)); return null; });
}

function revealCardFile(kind, path) {
	const body = { kind: String(kind || ""), path: String(path || "") };
	fetch(EXPANDER + "/reveal", {
		method: "POST",
		headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
		body: JSON.stringify(body),
	})
		.then((r) => r.json())
		.then((d) => MSG(d && d.ok ? ("已打开：" + String(d.path || "")) : ("打不开：" + String((d && (d.error || d.message)) || "侧车没响应"))))
		.catch((e) => MSG("打不开：" + ((e && e.message) || e)));
}

const COVER_RESCUE = [];   // 0.7.87：磁盘卡缺封面时，待回写的 (file, cover)
/** 把 /cards 的结果并进 USER.cards → {changed, added, updated, skipped, removed, msg} */
function mergeDiskCards(list, dir) {
	USER.cards = USER.cards || [];
	const arr = Array.isArray(list) ? list : [];
	// 0.7.65：目录为空 = 这一类就该是空的（面板 = 目录），把只在面板里的历史卡也清掉
	if (!arr.length) {
		// 正在落盘的卡先留着（写入成功后会从磁盘读回来；失败则下次同步清掉并报错）
		const pending = USER.cards.filter((x) => x && x.pendingDisk);
		const had = USER.cards.length - pending.length;
		USER.cards = pending;
		return { changed: had > 0, added: 0, updated: 0, skipped: 0, removed: had,
			msg: "磁盘同步" + (dir ? "（" + dir + "）" : "") + "：目录为空 · 清空面板 " + had + " 张" };
	}
	const onDisk = {};
	let added = 0, updated = 0, skipped = 0, removed = 0;
	arr.forEach((c) => {
		const nm = String((c && c.name) || "").trim();
		if (!nm) { skipped++; return; }
		const file = String((c && c.__file) || "");
		const rec = Object.assign({}, c);
		delete rec.__file;
		rec.file = file;
		rec.fromDisk = true;
		if (dir) rec.diskDir = String(dir);
		if (file) onDisk[cardFileKey(file)] = true;
		const byId = rec.id ? USER.cards.findIndex((x) => x && x.id && String(x.id) === String(rec.id)) : -1;
		const byName = USER.cards.findIndex((x) => String((x && x.name) || "").trim() === nm);
		const at = byId >= 0 ? byId : byName;
		if (at >= 0) {
			const cur = USER.cards[at] || {};
			// 0.7.87：磁盘卡里没封面、本地记录里有 → 保住本地封面并回写磁盘
			//（老版本「设封面不落盘」留下的存量，进一次控制台就被这里整条替换掉，封面于是每次都掉）
			if (!String(rec.cover || "") && String(cur.cover || "")) {
				rec.cover = cur.cover;
				if (rec.file) COVER_RESCUE.push({ id: rec.id, file: rec.file, cover: rec.cover });
			}
			if (cur.fromDisk || byId >= 0) { USER.cards[at] = rec; updated++; }
			else skipped++;          // 界面手工卡：同名也留着
		} else { USER.cards.push(rec); added++; }
	});
	for (let i = USER.cards.length - 1; i >= 0; i--) {
		const c = USER.cards[i];
		if (!c || !c.fromDisk) continue;
		const f = cardFileKey(c.file);
		if (!f || !onDisk[f]) { USER.cards.splice(i, 1); removed++; }
	}
	if (COVER_RESCUE.length) {
		const todo = COVER_RESCUE.splice(0, COVER_RESCUE.length);
		todo.forEach((x) => {
			const hit = (USER.cards || []).filter((c) => c && c.file && String(c.file) === String(x.file))[0];
			if (hit) { try { writeCardToDisk(hit); } catch (e) { } }
		});
	}
	const changed = (added + updated + removed) > 0;
	const msg = "磁盘同步" + (dir ? "（" + dir + "）" : "") + "：" + arr.length + " 张 · 新增 " + added
		+ " · 更新 " + updated + " · 保护跳过 " + skipped + " · 移除 " + removed;
	return { changed: changed, added: added, updated: updated, skipped: skipped, removed: removed, msg: msg };
}

/** 拉一次 /cards。force=true（手动按钮）一定提示结果；否则空结果安静重试 6 次 */
function syncCardsFromDisk(opts) {
	const o = opts || {};
	if (CARD_DISK.busy) return Promise.resolve(null);
	CARD_DISK.busy = true;
	return fetch(EXPANDER + "/cards", { headers: Object.assign({}, CONSOLE_HEADERS) })
		.then((r) => r.json())
		.then((d) => {
			CARD_DISK.busy = false; CARD_DISK.runs++;
			if (!d || d.ok === false) throw new Error(String((d && d.error) || "侧车返回 ok=false"));
			const list = Array.isArray(d.cards) ? d.cards : [];
			// 0.7.78：目录空但面板里有「只在内存」的卡 → 先落盘再重扫（风格卡早就有这条兜底，角色卡以前没有）
			if (!list.length && !o.force && !o.bootstrapped) {
				const local = (USER.cards || []).filter((c) => c && !c.fromDisk && String(c.name || "").trim());
				if (local.length) {
					CARD_DISK.busy = false;
					return persistCards(local, "cards")
						.then(() => syncCardsFromDisk({ quiet: true, bootstrapped: true }))
						.catch(() => d);
				}
			}
			if (list.length) CARD_DISK.runs = 0;
			if (!list.length && !o.force && CARD_DISK.runs < 6) {
				setTimeout(() => syncCardsFromDisk({ quiet: true }), 2500);
				if (o.quiet !== true) MSG("磁盘上没有角色卡：" + String(d.dir || "（config.json 没配 cardsDir）") + " · 放好卡后点「重扫磁盘」");
				return d;
			}
			const res = mergeDiskCards(list, d.dir);
			CARD_DISK.okAt = Date.now(); CARD_DISK.note = res.msg;
			if (res.changed) { saveUser(); repaintAll(); }
			MSG(res.msg);
			return d;
		})
		.catch((e) => {
			CARD_DISK.busy = false; CARD_DISK.runs++;
			const m = "磁盘同步失败：" + String((e && e.message) || e);
			CARD_DISK.note = m;
			if (o.force || o.quiet !== true) MSG(m);
			if (!o.force && CARD_DISK.runs < 6) setTimeout(() => syncCardsFromDisk({ quiet: true }), 2500);
			return null;
		});
}

/** 0.7.60：风格卡 / 词库也走「目录即真相」——同步以磁盘为准，目录里删了文件，面板上就消失。
 *  反方向由 dirWrite 写回，所以两边不会漂。角色卡沿用 mergeDiskCards（0.7.47 起已是这个口径）。 */
const DIR_SYNC = { style: { busy: false, runs: 0 }, dict: { busy: false, runs: 0 } };

function dirList(kind) {
	return fetch(EXPANDER + "/dir/list?kind=" + encodeURIComponent(String(kind)), { headers: Object.assign({}, CONSOLE_HEADERS) })
		.then((r) => r.json());
}
function dirWrite(kind, card, path) {
	return fetch(EXPANDER + "/dir/write", {
		method: "POST",
		headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
		body: JSON.stringify({ kind: String(kind || ""), card: card || {}, path: String(path || "") }),
	}).then((r) => r.json());
}
/** 0.7.64：清空某一类卡目录——侧车整包搬进 _清空备份-<时间戳>，可逆；随后清空面板 */
function dirClear(kind, label) {
	const tip = "确定清空「" + label + "」？\n\n会把这些文件整包搬到 本地绘画\\_清空备份-<时间戳>\\" + kind + "\\（不硬删，想恢复搬回来就行），面板里对应的卡/词也一起清掉。";
	if (!window.confirm(tip)) return Promise.resolve(null);
	return fetch(EXPANDER + "/dir/clear", {
		method: "POST",
		headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
		body: JSON.stringify({ kind: String(kind || "") }),
	})
		.then((r) => r.json())
		.then((d) => {
			if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车没响应"));
			if (kind === "cards") USER.cards = [];
			else if (kind === "style") USER.styleCards = [];
			else if (kind === "dict") { USER.frags = {}; USER.dictFiles = {}; }
			saveUser();
			repaintAll();
			MSG("已清空「" + label + "」：搬走 " + String(d.count || 0) + " 个文件 → " + String(d.backup || ""));
			if (d.failed && d.failed.length) MSG("有 " + d.failed.length + " 个没搬动：" + d.failed[0]);
			return d;
		})
		.catch((e) => { MSG("清空失败：" + String((e && e.message) || e)); return null; });
}


/** 风格卡合并：磁盘为准；内置 3 张写在代码里（builtin），不参与文件比对 */
function mergeDiskStyle(list, dir) {
	USER.styleCards = USER.styleCards || [];
	const arr = Array.isArray(list) ? list : [];
	if (!arr.length) {
		const had = USER.styleCards.length;
		USER.styleCards = USER.styleCards.filter((c) => c && c.builtin);
		return { changed: had !== USER.styleCards.length, added: 0, updated: 0, removed: had - USER.styleCards.length,
			msg: "风格卡同步" + (dir ? "（" + dir + "）" : "") + "：目录为空 · 清空自建卡 " + (had - USER.styleCards.length) + " 张" };
	}
	const onDisk = {};
	let added = 0, updated = 0, removed = 0;
	arr.forEach((c) => {
		const rec = Object.assign({}, c);
		const file = String(rec.__file || "");
		delete rec.__file; delete rec.__envkey;
		rec.file = file; rec.fromDisk = true;
		if (dir) rec.diskDir = String(dir);
		const nm = String(rec.name || "").trim();
		if (!nm) return;
		onDisk[cardFileKey(file) + "|" + nm] = true;
		const at = USER.styleCards.findIndex((x) => x && ((rec.id && String(x.id) === String(rec.id)) || String(x.name || "").trim() === nm));
		if (at >= 0) {
			const cur = USER.styleCards[at] || {};
			// 0.7.87：同 mergeDiskCards —— 磁盘没封面、本地有，就保住并回写
			if (!String(rec.cover || "") && String(cur.cover || "")) {
				rec.cover = cur.cover;
				if (rec.file) COVER_RESCUE.push({ kind: "style", file: rec.file, cover: rec.cover });
			}
			USER.styleCards[at] = rec; updated++;
		} else { USER.styleCards.push(rec); added++; }
	});
	for (let i = USER.styleCards.length - 1; i >= 0; i--) {
		const c = USER.styleCards[i];
		if (!c || !c.fromDisk) continue;
		if (!onDisk[cardFileKey(c.file) + "|" + String(c.name || "").trim()]) { USER.styleCards.splice(i, 1); removed++; }
	}
	if (COVER_RESCUE.length) {
		const todo = COVER_RESCUE.splice(0, COVER_RESCUE.length).filter((x) => x.kind === "style");
		todo.forEach((x) => {
			const hit = (USER.styleCards || []).filter((c) => c && c.file && String(c.file) === String(x.file))[0];
			if (hit) { try { dirWrite("style", hit, String(hit.file || "")).catch(() => { }); } catch (e) { } }
		});
	}
	return {
		changed: (added + updated + removed) > 0, added: added, updated: updated, removed: removed,
		msg: "风格卡同步" + (dir ? "（" + dir + "）" : "") + "：磁盘 " + arr.length + " 张 · 新增 " + added + " · 更新 " + updated + " · 移除 " + removed,
	};
}

/** 词库卡片里的词条：兼容 [[cn,en]] / [{cn,en}] / ["词"] */
function dictPairsOf(c) {
	const src = Array.isArray(c && c.pairs) ? c.pairs : (Array.isArray(c && c.cards) ? c.cards : []);
	const out = [];
	src.forEach((p) => {
		if (Array.isArray(p)) {
			const cn = String(p[0] || "").trim(), en = String(p[1] || "").trim();
			if (cn || en) out.push([cn, en]);
		} else if (p && typeof p === "object") {
			const cn = String(p.cn || p.n || "").trim(), en = String(p.en || p.t || "").trim();
			if (cn || en) out.push([cn, en]);
		} else if (typeof p === "string" && p.trim()) out.push([p.trim(), ""]);
	});
	return out;
}

/** 词库合并：磁盘为准，但只删「上次在盘上、这次被删掉」的分类——本地新词绝不会被同步清空。
 *  规则：
 *    1) 盘上有的分类 → 用盘上的内容
 *    2) 上次在盘上（USER.dictFiles 记着）、这次没了 → 真被删了，从面板去掉
 *    3) 只在面板里、盘上还没有 → 保留，并立刻写进 词库\<分类>.json
 */
function mergeDiskDict(list, dir) {
	const next = {}, files = {};
	(Array.isArray(list) ? list : []).forEach((c) => {
		const cat = String((c && (c.cat || c.category)) || (c && c.name) || "").trim();
		const pairs = dictPairsOf(c);
		if (!cat || !pairs.length) return;
		next[cat] = pairs;
		files[cat] = String((c && c.__file) || "");
	});
	const prevFiles = USER.dictFiles || {};
	const out = Object.assign({}, USER.frags || {});
	Object.keys(next).forEach((cat) => { out[cat] = next[cat]; });
	let removed = 0, toWrite = [];
	Object.keys(prevFiles).forEach((cat) => {
		if (!next[cat] && out[cat]) { delete out[cat]; removed++; }
	});
	Object.keys(out).forEach((cat) => {
		if (!next[cat] && !prevFiles[cat]) toWrite.push(cat);
	});
	const before = JSON.stringify(USER.frags || {});
	USER.frags = out;
	USER.dictFiles = files;
	toWrite.forEach((cat) => { try { dirWrite("dict", { cat: cat, name: cat, pairs: out[cat] }, "").catch(() => { }); } catch (e) { } });
	return {
		changed: before !== JSON.stringify(out), count: Object.keys(next).length,
		msg: "词库同步" + (dir ? "（" + dir + "）" : "") + "：磁盘 " + Object.keys(next).length + " 类 / "
			+ (Array.isArray(list) ? list.length : 0) + " 张卡片 · 移除 " + removed + " 类"
			+ (toWrite.length ? " · 本地 " + toWrite.length + " 类已落盘" : ""),
	};
}

/** 词库反方向：把 USER.frags 全量写回 词库/<分类>.json（防抖，避免每敲一个字写一次） */
let DICT_FLUSH_T = null;
function dictFlush() {
	const cats = USER.frags || {};
	Object.keys(cats).forEach((cat) => {
		const pairs = (cats[cat] || []).filter((p) => p && (String(p[0] || "").trim() || String(p[1] || "").trim()));
		if (!pairs.length) return;
		dirWrite("dict", { cat: cat, name: cat, pairs: pairs }, "").catch(() => { });
	});
}
function dictFlushSoon() {
	if (DICT_FLUSH_T) clearTimeout(DICT_FLUSH_T);
	DICT_FLUSH_T = setTimeout(() => { DICT_FLUSH_T = null; try { dictFlush(); } catch (e) { /* ignore */ } }, 1200);
}

/** 目录为空、面板里有卡时：先把面板的卡落盘，再同步——否则「目录即真相」会把本地卡清空 */
function bootstrapDir(kind, cards) {
	const src = (cards || []).filter((c) => c && String(c.name || c.cat || "").trim());
	if (!src.length) return Promise.resolve(0);
	return src.reduce((p, c) => p.then(() => dirWrite(kind, c, c.file || "").catch(() => null)), Promise.resolve()).then(() => src.length);
}

function syncKindFromDisk(kind, opts) {
	// 0.7.78：这个函数只处理风格卡/词库；角色卡有 mergeDiskCards + syncCardsFromDisk 那条线
	if (kind !== "style" && kind !== "dict") return Promise.resolve(null);
	const o = opts || {};
	const st = DIR_SYNC[kind] || (DIR_SYNC[kind] = { busy: false, runs: 0 });
	if (st.busy) return Promise.resolve(null);
	st.busy = true;
	return dirList(kind)
		.then((d) => {
			st.busy = false; st.runs++;
			if (!d || d.ok === false) throw new Error(String((d && d.error) || "侧车返回 ok=false"));
			const list = Array.isArray(d.cards) ? d.cards : [];
			if (!list.length && kind === "style") {
				const local = (USER.styleCards || []).filter((c) => c && !c.fromDisk && !c.builtin);
				if (local.length) return bootstrapDir("style", local).then(() => dirList(kind)).then((d2) => ({ d: d2 || d, list: (d2 && d2.cards) || [] }));
			}
			// 词库同理：目录还空、面板里已经有词 → 先把面板的写进 词库\*.json，再按磁盘重建
			if (!list.length && kind === "dict" && Object.keys(USER.frags || {}).length) {
				try { dictFlush(); } catch (e) { /* ignore */ }
				return new Promise((res) => setTimeout(res, 900)).then(() => dirList(kind)).then((d2) => ({ d: d2 || d, list: (d2 && d2.cards) || [] }));
			}
			return { d: d, list: list };
		})
		.then((r) => {
			if (!r) return null;
			const d = r.d || {};
			const res = kind === "style" ? mergeDiskStyle(r.list, d.dir) : mergeDiskDict(r.list, d.dir);
			if (res && res.changed) { saveUser(); repaintAll(); }
			if (o.force || (res && res.changed)) MSG(res.msg);
			return d;
		})
		.catch((e) => {
			st.busy = false; st.runs++;
			if (o.force) MSG("同步失败：" + String((e && e.message) || e));
			return null;
		});
}

function syncAllDirs(opts) {
	try { syncCardsFromDisk(opts || { quiet: true }); } catch (e) { /* ignore */ }
	syncKindFromDisk("style", opts || {});
	syncKindFromDisk("dict", opts || {});
}

/** 内置风格卡：把官方预设的 EMBBED 段单独做成卡片，方便一键换画风（2026-10-18） */
/** 风格卡的 LoRA 链：兼容旧字段 lora/loraW；缺省为空数组 */
function normStyleLoras(c) {
  if (c && Array.isArray(c.loras) && c.loras.length) return c.loras.filter((l) => l && l.name).map((l) => ({ name: String(l.name), w: Number(l.w) > 0 ? Number(l.w) : 0.6 }));
  if (c && c.lora) return [{ name: String(c.lora), w: Number(c.loraW) > 0 ? Number(c.loraW) : 0.6 }];
  return [];
}
/** 卡片上显示用的短名：去掉 .safetensors 与 _comfyui */
function shortLora(n) {
  return String(n || "").replace(/\.safetensors$/i, "").replace(/_comfyui$/, "");
}
/** 卡片上的 LoRA 摘要（没有就返回空串，调用方据此不渲染） */
function builtinStyleCards() {
  const base = "(@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4), flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR";
  return [
  { id: "st-mochi", modelFamily: "Anima", name: "もちづきけい · 官方画风", note: "官方预设 EMBBED 段（去掉 EMBBED: / BREAK,）", tags: base },
  { id: "st-clean", modelFamily: "Anima", name: "干净线稿 · 平涂", note: "线稿清楚 + 平涂上色，适合立绘", tags: "2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4), flat color, cel shading, crisp clean outline" },
  { id: "st-paint", modelFamily: "Anima", name: "厚涂 · 电影光影", note: "厚涂质感 + 打光，适合氛围图", tags: "painterly illustration, thick brush strokes, rich texture, soft rim light, cinematic lighting, subtle glow, detailed background" },
  ];
}
function allStyleCards() {
  const out = builtinStyleCards().map((c) => Object.assign({ builtin: true }, c));
  for (const c of USER.styleCards || []) {
    const i = out.findIndex((x) => x.id === c.id);
    if (i >= 0) out[i] = Object.assign({}, out[i], c);
    else out.push(Object.assign({ builtin: false }, c));
  }
  /** 自建的排前面（自己的最常用），内置沉底 */
  out.sort((a, b) => (a.builtin === b.builtin ? 0 : a.builtin ? 1 : -1));

  return out;
}


