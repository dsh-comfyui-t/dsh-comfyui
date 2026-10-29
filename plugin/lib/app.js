/**
 * DSH × ComfyUI 绘图台 —— 界面主体
 *
 * 本文件**不能直接运行**，由 tools/build_client.py 与 dict.js 一起
 * 拼成 lib/client.js（客户端 bundle 必须单文件）。
 * 编辑本文件后要跑一次构建：
 *     python E:\aqca\work\comfyui\tools\build_client.py
 *
 * 依赖（构建后同在作用域内，来自 dict.js）：
 *     LIB / EXTRA / buildCn2En / translateCn
 */

const React = require("react");
const h = React.createElement;
/* ================= 自检与崩溃取证（模块级） ================= */
let LAST_TAB_INFO = "";
let LAST_ERR = "";
let LAST_CRASH = "";
let RENDER_N = 0;
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
				"绘图台整体崩了：" + m + " —— 这行字请发给我（上次崩溃：" + LAST_CRASH + "）");
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
let MODEL_PICKED_SINK = null;
function MSG(text) { try { if (MSG_SINK) MSG_SINK(String(text)); } catch (e) { /* ignore */ } }
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
	unet: "<底模>.safetensors",
	loras: [],
};

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
const CF_ORDER = ["trigger", "base", "hair", "eyes", "glasses", "outfit", "extra"];
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
const SEEDS_ADDED = ensureSeeds();

/** 官方那条负面提示词（预置里第一条的 neg），供"填充官方负面"用 */

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
function dictSplit(p) { return String(p || "").split("/").map((x) => x.trim()).filter(Boolean); }
function dictJoin(a) { return a.join("/"); }
function dictParent(p) { const a = dictSplit(p); a.pop(); return dictJoin(a); }
/** 全部分类路径：内置 + 自定义 + 显式空分类，并补齐所有上级 */
function dictAllPaths() {
	const set = new Set();
	for (const k of Object.keys(allLib())) set.add(k);
	for (const k of Object.keys(USER.frags || {})) set.add(k);
	for (const k of (USER.cats || [])) set.add(k);
	for (const k of Array.from(set)) {
		const a = dictSplit(k);
		for (let i = 1; i < a.length; i++) set.add(dictJoin(a.slice(0, i)));
	}
	return Array.from(set);
}
/** 建树：根节点 {name,path,children,count} */

/** 拖拽中的分类（模块级：重渲染不丢） */
const DRAG = { from: null };

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

let CN_PAIRS = buildCn2En();
function rebuildDict() {
	// 把用户自定义词条也并进转换表
	const hset = new Set(); for (const c of Object.keys(USER.hidden || {})) for (const x of USER.hidden[c] || []) hset.add(String(x).trim()); const pairs = CN_PAIRS.filter((p) => !hset.has(String(p[0]).trim()));
	for (const cat of Object.keys(USER.frags || {})) {
		for (const p of USER.frags[cat] || []) {
			if (p[0] && p[1]) pairs.push(p);
		}
	}
	pairs.sort((a, b) => b[0].length - a[0].length);
	return pairs;
}

// ==================== 生成任务（模块级，跨面板存活）====================
/**
 * 关键点：任务状态与轮询都放在**模块级**，不放在 React 里。
 * DSH 的 main slot 一次只渲染一个面板，切到对话框时本页面会被卸载；
 * 若把轮询放在组件里，切走就断了、回来也拿不到结果。
 */
const BG = {
	job: null,          // {pid, startedAt, status, message, image, error, params}
	listeners: new Set(),
	timer: null,
	emit() {
		this.listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
	},
	set(patch) {
		this.job = Object.assign({}, this.job || {}, patch);
		this.emit();
	},
	snapshot() { return this.job ? Object.assign({}, this.job) : null; },
	subscribe(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
	clear() { this.job = null; this.emit(); },
	/** 已经收尾（出图完成 / 报错）——切走生成页时只清这种，跑着的任务不清 */
	isFinished() {
		const s = this.job && this.job.status;
		return s === "done" || s === "error";
	},

	/** 提交一个任务并开始后台轮询
	 *  extra：附加到 ComfyUI /prompt 的 extra_data（LLLite 条件解析结果放这里，引擎侧按需消费） */
	async run(graph, params, extra) {
		const cur = this.job;
		if (cur && (cur.status === "submitting" || cur.status === "running")) {
			MSG("已有任务在跑（" + (cur.message || cur.status) + "），先取消或等它完成");
			return;
		}
		this.set({
			pid: null, startedAt: Date.now(), status: "submitting",
			message: "提交中…", image: null, error: null, params: params,
		});
		let res;
		try {
			const body = { prompt: graph, client_id: "dsh-comfyui-console" };
			if (extra) body.extra_data = Object.assign({}, extra);
			res = await jpost(COMFY + "/prompt", body, 30000);
		} catch (e) {
			this.set({ status: "error", message: "提交失败：" + errText(e) });
			return;
		}
		if (!res || !res.prompt_id) {
			this.set({ status: "error", message: "提交失败：" + JSON.stringify(res).slice(0, 300) });
			return;
		}
		this.set({ pid: res.prompt_id, status: "running", message: "已提交，等待…" });
		this.watch(res.prompt_id);
	},

	/** 轮询直到出图/报错；模块级定时器，不随组件卸载而停 */
	watch(pid) {
		if (this.timer) { clearInterval(this.timer); this.timer = null; }
		let idlePolls = 0;
		const tick = async () => {
			const j = this.job;
			if (!j || j.pid !== pid) { clearInterval(this.timer); this.timer = null; return; }
			if (j.status === "done" || j.status === "error" || j.status === "cancelled") {
				clearInterval(this.timer); this.timer = null; return;
			}
			const mins = ((Date.now() - j.startedAt) / 60000).toFixed(1);
			try {
				const hist = await jget(COMFY + "/history/" + pid, 15000);
				if (!this.job || this.job.pid !== pid) return;   // 等待期间可能已经开了新任务
				const entry = hist && hist[pid];
				if (entry) {
					const st = entry.status || {};
					if (st.status_str === "error") {
						this.set({ status: "error", message: "ComfyUI 报错：" + JSON.stringify(st).slice(0, 500) });
						return;
					}
					const outs = entry.outputs || {};
					for (const k of Object.keys(outs)) {
						const imgs = outs[k].images;
						if (imgs && imgs.length) {
							this.set({ status: "done", doneAt: Date.now(), message: "完成 ✓（用时 " + mins + " 分钟）", image: viewUrl(imgs[0]) });
							return;
						}
					}
				}
				let stillQueued = true;
				try {
					const q = await jget(COMFY + "/queue", 10000);
					const ids = [].concat(q.queue_running || [], q.queue_pending || []).map((x) => x[1]);
					stillQueued = ids.indexOf(pid) >= 0;
				} catch (e) { /* 查不到就当还在跑 */ }

				if (!stillQueued && !entry) {
					idlePolls++;
					if (idlePolls >= 4) {
						this.set({ status: "error", message: "任务已从队列消失但没有产出（用时 " + mins + " 分钟）" });
						return;
					}
				} else {
					idlePolls = 0;
					this.set({ message: "仍在生成… 已 " + mins + " 分钟（内存紧张时会很慢，不是卡死）" });
				}
			} catch (e) { /* 网络抖动，继续 */ }
		};
		this.timer = setInterval(tick, 2000);
		tick();
	},

	/** 页面重新挂载时：接管 ComfyUI 里正在跑的任务 */
	async adopt() {
		if (this.job && this.job.status === "running") { this.watch(this.job.pid); return true; }
		try {
			const q = await jget(COMFY + "/queue", 8000);
			const run = (q.queue_running || [])[0];
			if (run && run[1]) {
				this.set({ pid: run[1], startedAt: Date.now(), status: "running", message: "接管了一个正在跑的任务…", image: null, error: null });
				this.watch(run[1]);
				return true;
			}
		} catch (e) { /* ignore */ }
		return false;
	},

	async cancel() {
		try { await jpost(COMFY + "/interrupt", {}, 20000); } catch (e) { /* ignore */ }
		this.set({ status: "cancelled", message: "已发送中断请求" });
		if (this.timer) { clearInterval(this.timer); this.timer = null; }
	},
};

// ==================== 工具 ====================
function errText(e) { return (e && e.message) ? e.message : String(e); }

/** 文本域 -> JSON 字段：空串或解析失败都退回 fallback，不阻塞保存流程 */
function parseJsonField(text, fallback) {
	if (text == null) return fallback || null;
	const s = String(text).trim();
	if (!s) return null;
	try { return JSON.parse(s); } catch (e) { return fallback || null; }
}
/** 卡上的底模字段：编辑中的文本域优先，其次是已存的数组 */
function _cardBm(d) {
	const t = (d && d.baseModelsText != null) ? d.baseModelsText
		: (d && Array.isArray(d.baseModels) ? d.baseModels.join(", ") : "");
	return String(t).split(",").map((x) => x.trim()).filter(Boolean);
}
/** 风格卡的底模：新字段 baseModels 优先，老的 ckpt 兜底（1.0 的风格卡只有 ckpt） */
function _styleBm(d) {
	const a = _cardBm(d);
	if (a.length) return a;
	const c = String((d && d.ckpt) || "").trim();
	return c ? [c] : [];
}

/** 卡面右下角的适配底模标签：取首个底模的文件名短名，多个时补 "+N"
 *  只做展示，不参与任何逻辑；title 里给完整文件名清单 */
function bmBadge(c) {
	const short = (p) => String(p || "").replace(/\\/g, "/").split("/").pop()
		.replace(/\.(safetensors|ckpt|pt|pth|bin|gguf)$/i, "");
	const list = _styleBm(c);
	/** modelFamily 是「模型族」这种粗标（Anima / SDXL / Pony…），纯展示、
	 *  不参与底模校验 —— 内置卡用它，避免把本机具体文件名写死进内置数据 */
	const fam = String((c && (c.modelFamily || c.model)) || "").trim();
	/** 优先级：具体底模 > 模型族 > 未标注。
	 *  具体文件名是用户亲手填的，比内置的族名更准，所以压在上面 */
	if (list.length) {
		const first = short(list[0]) || String(list[0]);
		return {
			text: first + (list.length > 1 ? " +" + (list.length - 1) : ""),
			full: "适配底模：\n" + list.map((x) => short(x) || String(x)).join("\n") + (fam ? "\n（模型族：" + fam + "）" : ""),
			muted: false,
		};
	}
	if (fam) return { text: fam, full: "适配底模：" + fam, muted: false };
	return { text: "未标注底模", full: "这张卡还没填适配底模。点「编辑」→「适配底模」补上，之后右上角就会显示模型名。", muted: true };
}

/** 把「拖文件进来」统一成一条通道。
 *
 *  accept 是扩展名数组（不带点、小写），空数组 = 什么都收。只在 dataTransfer 里真有
 *  Files 时才接管，所以不会跟卡片拖拽排序、LoRA 拖分类这些内部拖拽打架。
 *  拖动经过时给宿主元素描边，松手/离开就撤。
 *
 *  onFiles(good, all)：good 是过了扩展名过滤的，all 是原始列表（调用方可以给出「拖错了」的提示）。 */
function dropFileProps(accept, onFiles, opts) {
	const o = opts || {};
	const list = (accept || []).map((x) => String(x).toLowerCase().replace(/^\./, ""));
	const okName = (n) => !list.length || list.some((e) => String(n || "").toLowerCase().endsWith("." + e));
	const onlyFiles = (e) => {
		const dt = (e && e.dataTransfer) || {};
		const ty = dt.types ? Array.prototype.slice.call(dt.types) : [];
		return ty.indexOf("Files") >= 0;
	};
	const grab = (e) => {
		const dt = (e && e.dataTransfer) || {};
		const out = [];
		try { if (dt.files && dt.files.length) for (let i = 0; i < dt.files.length; i++) out.push(dt.files[i]); } catch (x) { }
		// 桌面版有时 files 是空的，退回 items 再取一次
		if (!out.length && dt.items) {
			try { for (let i = 0; i < dt.items.length; i++) { const f = dt.items[i].getAsFile && dt.items[i].getAsFile(); if (f) out.push(f); } } catch (x) { }
		}
		return out;
	};
	const hi = (e, on) => {
		try {
			e.currentTarget.style.outline = on ? "2px dashed var(--c-accent)" : (o.outline || "");
			e.currentTarget.style.outlineOffset = on ? "-2px" : "";
		} catch (x) { }
	};
	return {
		onDragOver: (e) => {
			if (!onlyFiles(e)) return;
			e.preventDefault();
			e.stopPropagation();
			try { e.dataTransfer.dropEffect = "copy"; } catch (x) { }
			hi(e, true);
		},
		onDragLeave: (e) => { if (onlyFiles(e)) hi(e, false); },
		onDrop: (e) => {
			if (!onlyFiles(e)) return;
			e.preventDefault();
			e.stopPropagation();
			hi(e, false);
			const all = grab(e);
			if (!all.length) { if (o.onEmpty) o.onEmpty(); return; }
			const good = all.filter((f) => okName(f.name));
			if (!good.length) { if (o.onReject) o.onReject(list); return; }
			onFiles(good, all);
		},
	};
}

/** LoRA 分类：文件夹第一级优先，根目录下的按底模分。
 *  这样在 models/loras 里建 `角色`、`画风` 之类文件夹就等于自定义分类，
 *  移动文件即改分类，面板跟着变，不用额外维护一张表。 */
function loraGroupsOf(names, meta, cards) {
	const charLoras = new Set();
	for (const c of (cards || [])) {
		if (c && c.lora) charLoras.add(String(c.lora));
	}
	const map = new Map();
	for (const nm of names || []) {
		const m = (meta && meta[nm]) || {};
		const folder = String(m.folder || "").replace(/\\/g, "/").split("/").filter(Boolean)[0] || "";
		const base = String(m.base || "").trim() || "未知";
		// drop 是「拖到这一组要挪进的文件夹」：文件夹组 = 文件夹名，根目录散文件组 = 空（= 挪回根目录）
		let key, label, drop;
		if (folder) {
			// 文件夹名就是分类名；叫「角色」这类名字的归角色组
			drop = folder;
			label = /^(角色|人物|character|char|chars)$/i.test(folder) ? "角色" : folder;
			key = label === "角色" ? "\u0000char" : folder;
		} else if (charLoras.has(nm)) {
			drop = "角色"; key = "\u0000char"; label = "角色";
		} else {
			drop = ""; key = "\u0000base:" + base; label = base;
		}
		if (!map.has(key)) map.set(key, { key, label, drop, items: [] });
		map.get(key).items.push(nm);
	}
	const out = [...map.values()];
	/** 角色排最前，其余按条目多的在前、同数按名字 */
	out.sort((a, b) => {
		if (a.label === "角色" && b.label !== "角色") return -1;
		if (b.label === "角色" && a.label !== "角色") return 1;
		if (b.items.length !== a.items.length) return b.items.length - a.items.length;
		return a.label.localeCompare(b.label);
	});
	return out;
}

async function jget(url, timeoutMs) {
	const ctl = new AbortController();
	const t = setTimeout(() => ctl.abort(), timeoutMs || 8000);
	try {
		const r = await fetch(url, { signal: ctl.signal, headers: sidecarHeaders(url) });
		if (!r.ok) {
			/**
			 * ComfyUI 校验失败返回 HTTP 400，**真正的错误在响应体里**：
			 *   {"error":{"type":"prompt_outputs_failed_validation","message":"..."},
			 *    "node_errors":{"3":{"errors":[{"details":"vae_name: '' not in [...]"}]}}}
			 *
			 * 只抛 `HTTP 400` 用户看不到任何原因。这里把 node_errors 逐条摊平，
			 * 直接告诉他是哪个节点、哪个类、哪个字段。
			 */
			let detail = "";
			try {
				const txt = await r.text();
				try {
					const j = JSON.parse(txt);
					const lines = [];
					const ne = j.node_errors || {};
					for (const nid of Object.keys(ne)) {
						const node = ne[nid] || {};
						const cls = node.class_type ? node.class_type + " " : "";
						for (const e of (node.errors || [])) {
							lines.push("节点 " + nid + "（" + cls + "）：" + (e.details || e.message || ""));
						}
					}
					if (lines.length) detail = " · " + lines.join(" ｜ ");
					else if (j.error && (j.error.message || j.error.type)) {
						detail = " · " + (j.error.message || j.error.type);
					}
				} catch (e2) {
					if (txt) detail = " · " + txt.slice(0, 300);
				}
			} catch (e3) { /* 读不出就算 */ }
			throw new Error("HTTP " + r.status + detail);
		}
		return await r.json();
	} finally { clearTimeout(t); }
}
async function jpost(url, body, timeoutMs) {
	const ctl = new AbortController();
	const t = setTimeout(() => ctl.abort(), timeoutMs || 20000);
	try {
		const r = await fetch(url, {
			method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, sidecarHeaders(url)),
			body: JSON.stringify(body || {}), signal: ctl.signal,
		});
		if (!r.ok) {
			/**
			 * ComfyUI 校验失败返回 HTTP 400，**真正的错误在响应体里**：
			 *   {"error":{"type":"prompt_outputs_failed_validation","message":"..."},
			 *    "node_errors":{"3":{"errors":[{"details":"vae_name: '' not in [...]"}]}}}
			 *
			 * 只抛 `HTTP 400` 用户看不到任何原因。这里把 node_errors 逐条摊平，
			 * 直接告诉他是哪个节点、哪个类、哪个字段。
			 */
			let detail = "";
			try {
				const txt = await r.text();
				try {
					const j = JSON.parse(txt);
					const lines = [];
					const ne = j.node_errors || {};
					for (const nid of Object.keys(ne)) {
						const node = ne[nid] || {};
						const cls = node.class_type ? node.class_type + " " : "";
						for (const e of (node.errors || [])) {
							lines.push("节点 " + nid + "（" + cls + "）：" + (e.details || e.message || ""));
						}
					}
					if (lines.length) detail = " · " + lines.join(" ｜ ");
					else if (j.error && (j.error.message || j.error.type)) {
						detail = " · " + (j.error.message || j.error.type);
					}
				} catch (e2) {
					if (txt) detail = " · " + txt.slice(0, 300);
				}
			} catch (e3) { /* 读不出就算 */ }
			throw new Error("HTTP " + r.status + detail);
		}
		return await r.json();
	} finally { clearTimeout(t); }
}
function viewUrl(img) {
	return COMFY + "/view?filename=" + encodeURIComponent(img.filename) +
		"&subfolder=" + encodeURIComponent(img.subfolder || "") +
		"&type=" + encodeURIComponent(img.type || "output") + "&t=" + Date.now();
}
function touch() { try { jpost(EXPANDER + "/comfy/touch", {}, 5000).catch(() => { }); } catch (e) { } }

// ==================== 回归锚跑批（模块级，跨面板存活）====================
/**
 * 一张卡的 regression.seeds 逐个跑：同一套参数、不同 seed，看角色还稳不稳。
 * 必须在客户端做 —— 出图请求由前端直连 ComfyUI，服务端不构造 workflow。
 */
const REG = {
	running: false, cancel: false,
	cardId: "", total: 0, cur: 0,
	results: [],          // [{seed, ok(null 待跑 / true / false), image, error}]
	listeners: new Set(),
	emit() { this.listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); },
	subscribe(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
	reset(cardId, seeds) {
		this.running = true; this.cancel = false;
		this.cardId = cardId || "";
		this.total = (seeds || []).length;
		this.cur = 0;
		this.results = (seeds || []).map((s) => ({ seed: s, ok: null, image: "", error: "" }));
		this.emit();
	},
	update(i, patch) { this.results[i] = Object.assign({}, this.results[i] || {}, patch); this.emit(); },
	stop() { this.cancel = true; this.emit(); },
	done() { this.running = false; this.emit(); },
};

/** 等后台任务收尾（done / error / cancelled）；pid 限定只认本次提交，绝不无限挂住 */
function waitJob(timeoutMs, pid) {
	return new Promise((resolve) => {
		let un = null, tm = null, settled = false;
		const finish = (v) => {
			if (settled) return;
			settled = true;
			if (un) un();
			if (tm) clearTimeout(tm);
			resolve(v);
		};
		const check = () => {
			const j = BG.snapshot();
			if (!j) return;
			if (pid && j.pid !== pid) return;      // 别的任务（比如用户手点生成）不算
			if (j.status === "done") finish({ ok: true, image: j.image || "" });
			else if (j.status === "error" || j.status === "cancelled") finish({ ok: false, error: j.message || j.status });
		};
		un = BG.subscribe(check);
		check();   // BG.run 可能已经失败落到 error，订阅不会补发，先查一次
		if (!settled) tm = setTimeout(() => finish({ ok: false, error: "超时（" + Math.round((timeoutMs || 600000) / 1000) + " 秒未出图）" }), timeoutMs || 600000);
	});
}

/**
 * 从 /object_info 里取 COMBO 的候选列表。
 *
 * ⚠️ ComfyUI 的 COMBO 有**三种**形态，只取 `spec[0]` 会踩坑：
 *      形态1 `[[名字...], {配置}]`   CheckpointLoaderSimple / LoraLoader / KSampler
 *      形态2 `[[名字...]]`            VAELoader.vae_name / CLIPLoader.clip_name / CLIPLoader.type
 *      形态3 `["COMBO", {options}]`   UpscaleModelLoader（较新版本的统一写法）
 *
 *    只写 `spec[0]` 时：形态1、2 恰好对；**形态3 会返回字符串 "COMBO"**，
 *    下拉里就一个叫 COMBO 的选项，发出去必然 400。
 *    历史事故：形态2 曾整段漏掉 -> `vae_name: '' not in list` 的 HTTP 400。
 */
function comboOptions(oi, node, key) {
	const v = oi && oi[node] && oi[node].input && oi[node].input.required
		&& oi[node].input.required[key];
	if (!Array.isArray(v) || !v.length) return [];
	// 形态3：["COMBO", {options:[...]}]
	if (v[0] === "COMBO") {
		const opt = (v.length > 1 && v[1] && v[1].options) || [];
		return Array.isArray(opt) ? opt.slice() : [];
	}
	// 形态1 / 2：第一项就是名字数组（第二项可有可无）
	if (Array.isArray(v[0])) return v[0].slice();
	// 兜底：直接是字符串数组
	if (typeof v[0] === "string") return v.slice();
	return [];
}

/**
 * 粗筛：这个文件名像不像"放大模型"。
 *
 * ⚠️ `extra_model_paths.yaml` 里如果把 `upscale_models` 指到了模型树根
 *    （而不是专用子目录），ComfyUI 会**递归列举**，底模 / LoRA / VAE 全被
 *    塞进 `UpscaleModelLoader` 的候选列表。实测出现过 24 个条目里 23 个是底模，
 *    用户很自然地把底模当放大模型选中 -> `spandrel UnsupportedModelError`。
 *    根因在 yaml，这里是保险。
 */
function looksLikeUpscaler(name) {
	const s = String(name || "");
	if (!s) return false;
	const bad = /(^|[\\/])(checkpoints|loras|vae|text_encoders|clip|clip_vision|embeddings|controlnet|unet|diffusion_models|style_models|photomaker|model_patches)([\\/]|$)/i;
	return !bad.test(s);
}

/** 拼 ComfyUI API 格式的工作流 */
function buildGraph(o) {
	const g = {};
	// Anima 链：底模是 UNET（不是 checkpoint），文本编码器必须用 qwen_image。
	// 面板「CLIP 类型」选到 qwen_image 时走这一支；其余情况维持原行为。
	const animaUNet = String(o.clipType || "") === "qwen_image";
	if (animaUNet) {
		g["1"] = { class_type: "UNETLoader", inputs: { unet_name: o.unet || o.ckpt || MODEL_DEFAULTS.unet, weight_dtype: "default" } };
		g["2"] = { class_type: "CLIPLoader", inputs: { clip_name: o.clip, type: "qwen_image" } };
	} else {
		g["1"] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: o.ckpt } };
		// checkpoint 自带 CLIP，直接取 ["1",1]。原来这里无条件另建 CLIPLoader，
		// 等于要求 SDXL/SD1.5 也必须外挂一个独立编码器文件——本机 text_encoders 里只有 qwen 编码器，
		// 于是选任何 SDXL 底模都凑不出可用的 clip。只有用户显式给了 clip 文件时才另建。
		if (o.clip) g["2"] = { class_type: "CLIPLoader", inputs: { clip_name: o.clip, type: o.clipType || "stable_diffusion" } };
	}
	// VAE 同理：没指定外部 VAE 就用 checkpoint 内置的 ["1",2]。
	// Anima 分支底模是 UNETLoader（只有一个 MODEL 输出），没有内置 CLIP/VAE 可取，
	// 所以这两样必须显式给出——缺了就直接报清楚，别让 ComfyUI 回一个看不懂的 400。
	let vaeSrc = animaUNet ? null : ["1", 2];
	if (o.vae) { g["3"] = { class_type: "VAELoader", inputs: { vae_name: o.vae } }; vaeSrc = ["3", 0]; }
	if (!vaeSrc) throw new Error("当前底模需要外部 VAE，请在「VAE」里选一个");
	if (animaUNet && !o.clip) throw new Error("当前底模需要外部文本编码器（qwen），请在「文本编码器」里选一个");
	let modelSrc = ["1", 0], clipSrc = g["2"] ? ["2", 0] : ["1", 1];
	(o.loras || []).forEach((L, i) => {
		const id = String(10 + i);
		g[id] = {
			class_type: "LoraLoader",
			inputs: { model: modelSrc, clip: clipSrc, lora_name: L.name, strength_model: L.model, strength_clip: L.clip },
		};
		modelSrc = [id, 0]; clipSrc = [id, 1];
	});
	g["4"] = { class_type: "CLIPTextEncode", inputs: { text: o.pos, clip: clipSrc } };
	g["5"] = { class_type: "CLIPTextEncode", inputs: { text: o.neg, clip: clipSrc } };
	g["6"] = { class_type: "EmptyLatentImage", inputs: { width: o.w, height: o.h, batch_size: 1 } };
	// 身份控制：ComfyUI 原生 ModelPatchLoader + AnimaLLLiteApply（控制图与权重已由 sidecar staging 到它能读的目录）
	let modelForSampler = modelSrc;
	if (o.lllite && o.lllite.image && o.lllite.patch) {
		g["20"] = { class_type: "LoadImage", inputs: { image: o.lllite.image } };
		g["21"] = { class_type: "ModelPatchLoader", inputs: { name: o.lllite.patch } };
		g["22"] = {
			class_type: "AnimaLLLiteApply",
			inputs: {
				model: modelSrc, model_patch: ["21", 0], image: ["20", 0],
				strength: Number(o.lllite.strength) || 1.0, start_percent: 0.0, end_percent: 1.0,
			},
		};
		modelForSampler = ["22", 0];
	}
	g["7"] = {
		class_type: "KSampler",
		inputs: {
			model: modelForSampler, positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0],
			seed: o.seed, steps: o.steps, cfg: o.cfg,
			sampler_name: o.sampler, scheduler: o.scheduler, denoise: 1.0,
		},
	};
	g["8"] = { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: vaeSrc } };

	/**
	 * 生成后放大。
	 *
	 * ⚠️ 为什么不直接生成高分辨率：模型在约 1 MP 上训练，直接出 8.29 MP（4K）
	 *    属分布外崩坏。实测 3840x2160 花 19 分 34 秒、出 4 个脑袋；
	 *    而 960x544 出图 + 4x 放大只要 39~54 秒，解剖正确。
	 *
	 * ⚠️ 节点号用 30/31/32 —— 20/21/22 已被 LLLite 占用（LoadImage /
	 *    ModelPatchLoader / AnimaLLLiteApply），撞号会让工作流直接坏。
	 *
	 * 放大后**只保存最终图**（SaveImage 接在放大之后），
	 * 这样任务轮询拿到的是成品，不会误拿底图。
	 */
	let finalSrc = ["8", 0];
	if (o.upscale && o.upscaleModel) {
		g["30"] = { class_type: "UpscaleModelLoader", inputs: { model_name: o.upscaleModel } };
		g["31"] = { class_type: "ImageUpscaleWithModel", inputs: { upscale_model: ["30", 0], image: ["8", 0] } };
		finalSrc = ["31", 0];
		// 放大模型是固定的 4x；要 2x/3x 就再等比缩回去
		const f = Number(o.upscaleFactor) || 4;
		if (f !== 4) {
			g["32"] = {
				class_type: "ImageScaleBy",
				inputs: { image: ["31", 0], upscale_method: "lanczos", scale_by: f / 4 },
			};
			finalSrc = ["32", 0];
		}
	}
	g["9"] = { class_type: "SaveImage", inputs: { images: finalSrc, filename_prefix: o.prefix || "dsh_comfy" } };
	return g;
}


// ==================== 主题 ====================
/**
 * 面板配色。
 *   auto   跟随系统（prefers-color-scheme）
 *   light  浅色
 *   dark   深色
 *   white  纯白（白底黑字，单色）
 *   black  纯黑（黑底白字，单色）
 *   custom 自定义背景色 / 文字色
 *
 * 只有根节点 S.wrap 带硬编码颜色，其余控件都是 rgba(127,127,127,…) + inherit，
 * 会自动跟着变，所以这里只需要返回根节点的覆盖样式。
 */
const THEME_DEFAULTS = { mode: 'auto', bg: '#ffffff', fg: '#111827' };
const THEME_MODES = [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色'], ['white', '纯白'], ['black', '纯黑'], ['custom', '自定义']];

/** 系统是不是深色；拿不到就当浅色 */
function systemPrefersDark() {
	try {
		return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
	} catch (e) { return false; }
}

/** #rgb / #rrggbb -> 是不是深色 */
function isDarkColor(hex) {
	const s = String(hex || '').replace('#', '');
	const n = s.length === 3 ? s.split('').map(function (c) { return c + c; }).join('') : s;
	if (!/^[0-9a-fA-F]{6}$/.test(n)) return false;
	const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
}

/** 面板内原生控件（<select> 弹层、颜色选择器）跟着主题走。
 *  <option> 弹层由系统画，只认 select 自身的实色与 color-scheme，继承不了半透明背景。 */
const PANEL_CSS = [
	'.dcomfy-panel select, .dcomfy-panel input, .dcomfy-panel textarea { color-scheme: var(--c-scheme, normal); }',
	'.dcomfy-panel select { background: var(--c-panel2); color: var(--c-fg); border-color: var(--c-line); }',
	'.dcomfy-panel select option, .dcomfy-panel select optgroup { background: var(--c-panel2); color: var(--c-fg); }',
	'.dcomfy-panel select option:checked { background: var(--c-accent); color: var(--c-accent-on); }',
	'.dcomfy-panel select:disabled, .dcomfy-panel option:disabled { color: var(--c-fg5); }',
].join('\n');

/** 主题调色板 */
const THEME_LIGHT = {"--c-fg": "#111827", "--c-fg2": "#374151", "--c-fg3": "#4b5563", "--c-fg4": "#6b7280", "--c-fg5": "#9ca3af", "--c-card": "#ffffff", "--c-panel": "#f8fafc", "--c-panel2": "#f3f4f6", "--c-line": "#e5e7eb", "--c-ink-rgb": "17,24,39", "--c-accent": "#1d4ed8", "--c-accent-bg": "#dbeafe", "--c-accent-bg2": "#eff6ff", "--c-accent-fg": "#1e3a8a", "--c-bad": "#b91c1c", "--c-bad2": "#fca5a5", "--c-bad-bg": "#fee2e2", "--c-warn": "#b45309", "--c-warn2": "#92400e", "--c-warn-bg": "#fffbeb", "--c-ok": "#047857", "--c-accent-on": "#ffffff", "--c-scheme": "light"};
const THEME_DARK = {"--c-fg": "#e8e8ee", "--c-fg2": "#cfd0d8", "--c-fg3": "#b6b7c1", "--c-fg4": "#9a9ba6", "--c-fg5": "#7c7d88", "--c-card": "#24242a", "--c-panel": "#1b1b20", "--c-panel2": "#2d2d34", "--c-line": "#3b3b44", "--c-ink-rgb": "232,232,238", "--c-accent": "#7fb2ff", "--c-accent-bg": "#1d3a5c", "--c-accent-bg2": "#182a3d", "--c-accent-fg": "#aecfff", "--c-bad": "#ff9a9a", "--c-bad2": "#ffb3b3", "--c-bad-bg": "#3d2020", "--c-warn": "#f0b463", "--c-warn2": "#ffc97e", "--c-warn-bg": "#3b2d15", "--c-ok": "#5fd39a", "--c-accent-on": "#10233a", "--c-scheme": "dark"};
/** 纯白：白底黑字，强调色也是黑（单色，不带蓝） */
const THEME_WHITE = {"--c-fg": "#000000", "--c-fg2": "#1a1a1a", "--c-fg3": "#333333", "--c-fg4": "#555555", "--c-fg5": "#808080", "--c-card": "#ffffff", "--c-panel": "#f7f7f7", "--c-panel2": "#efefef", "--c-line": "#e2e2e2", "--c-ink-rgb": "0,0,0", "--c-accent": "#000000", "--c-accent-bg": "#ececec", "--c-accent-bg2": "#f5f5f5", "--c-accent-fg": "#111111", "--c-bad": "#8a1f1f", "--c-bad2": "#c96a6a", "--c-bad-bg": "#f7e8e8", "--c-warn": "#7a5200", "--c-warn2": "#5c3d00", "--c-warn-bg": "#fbf3e0", "--c-ok": "#12653c", "--c-accent-on": "#ffffff", "--c-scheme": "light"};
/** 纯黑：黑底白字，强调色也是白（单色，不带蓝） */
const THEME_BLACK = {"--c-fg": "#ffffff", "--c-fg2": "#e6e6e6", "--c-fg3": "#c8c8c8", "--c-fg4": "#a0a0a0", "--c-fg5": "#7a7a7a", "--c-card": "#000000", "--c-panel": "#0a0a0a", "--c-panel2": "#161616", "--c-line": "#2a2a2a", "--c-ink-rgb": "255,255,255", "--c-accent": "#ffffff", "--c-accent-bg": "#2a2a2a", "--c-accent-bg2": "#1c1c1c", "--c-accent-fg": "#ffffff", "--c-bad": "#ff8f8f", "--c-bad2": "#ffb3b3", "--c-bad-bg": "#2a1414", "--c-warn": "#e3b062", "--c-warn2": "#f2c887", "--c-warn-bg": "#2a2210", "--c-ok": "#6ddc9e", "--c-accent-on": "#000000", "--c-scheme": "dark"};


/** #rrggbb -> "r,g,b" */
function hexToRgbTriplet(hex) {
	const s = String(hex || '').replace('#', '');
	const n = s.length === 3 ? s.split('').map(function (c) { return c + c; }).join('') : s;
	if (!/^[0-9a-fA-F]{6}$/.test(n)) return '127,127,127';
	return parseInt(n.slice(0, 2), 16) + ',' + parseInt(n.slice(2, 4), 16) + ',' + parseInt(n.slice(4, 6), 16);
}

/**
 * 返回要挂到根节点的 inline style（含 CSS 变量）。
 *   auto   跟随系统（prefers-color-scheme）
 *   light  浅色
 *   dark   深色
 *   white / black 单色两套（强烈对比）
 *   custom 自定义背景 / 文字；其余语义色按背景明暗就近取一套
 */
function resolveTheme(th, systemDark) {
	const t = Object.assign({}, THEME_DEFAULTS, th || {});
	const mode = t.mode || 'auto';
	let dark = mode === 'dark' || mode === 'black';
	if (mode === 'auto') {
		dark = (typeof systemDark === 'boolean') ? systemDark : systemPrefersDark();
	}
	const base = mode === 'white' ? THEME_WHITE
		: mode === 'black' ? THEME_BLACK
			: (dark ? THEME_DARK : THEME_LIGHT);
	const out = Object.assign({}, base);
	if (mode === 'custom') {
		const bg = t.bg || THEME_DEFAULTS.bg;
		const fg = t.fg || THEME_DEFAULTS.fg;
		out['--c-card'] = bg;
		out['--c-fg'] = fg;
		out['--c-ink-rgb'] = hexToRgbTriplet(fg);
		out['--c-scheme'] = isDarkColor(bg) ? 'dark' : 'light';
		return Object.assign({}, out, {
			background: bg, color: fg, colorScheme: isDarkColor(bg) ? 'dark' : 'light',
		});
	}
	return Object.assign({}, out, {
		background: base['--c-card'], color: base['--c-fg'], colorScheme: dark ? 'dark' : 'light',
	});
}


/**
 * 决定底模该走哪条链。
 *
 * 按「选中的底模**实际出现在哪边的列表里**」判断，不看 `clipType` 的名义值。
 * 原因：diffusion_models 为空时，qwen_image 分支会把 checkpoint 名塞给
 * UNETLoader，ComfyUI 直接 400（`unet_name: '...' not in []`）。
 * 将来真往 diffusion_models 放了模型，会自动走回 UNet 链。
 *
 * @param {string} modelName 当前选中的底模
 * @param {string} clipType  面板上的编码器类型
 * @param {string[]} unetNames ComfyUI 列出的 diffusion_models
 */
function effectiveClipType(modelName, clipType, unetNames) {
	if (String(clipType) !== "qwen_image") return clipType;
	return (unetNames || []).indexOf(String(modelName)) >= 0 ? clipType : "stable_diffusion";
}

// ==================== 样式 ====================
const S = {
	wrap: { padding: "14px 18px 48px", display: "flex", flexDirection: "column", gap: "11px", minHeight: 0, height: "100%", overflowY: "auto", boxSizing: "border-box", background: "var(--c-card)", color: "var(--c-fg)", colorScheme: "light", borderRadius: "10px" },
	row: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" },
	field: { display: "flex", flexDirection: "column", gap: "4px" },
	label: { fontSize: "12px", opacity: 0.72 },
	sel: { background: "var(--c-panel2)", color: "var(--c-fg)", border: "1px solid var(--c-line)", borderRadius: "6px", padding: "5px 8px", fontSize: "13px", minWidth: "140px", colorScheme: "var(--c-scheme, normal)" },
	inp: { background: "rgba(127,127,127,.14)", color: "inherit", border: "1px solid rgba(127,127,127,.3)", borderRadius: "6px", padding: "5px 8px", fontSize: "13px", width: "88px" },
	ta: { background: "rgba(127,127,127,.12)", color: "inherit", border: "1px solid rgba(127,127,127,.3)", borderRadius: "6px", padding: "8px", fontSize: "12.5px", fontFamily: "ui-monospace,Consolas,monospace", lineHeight: 1.5, resize: "vertical", width: "100%", boxSizing: "border-box" },
	btn: { background: "rgba(90,160,235,.22)", color: "inherit", border: "1px solid rgba(90,160,235,.5)", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" },
	btn2: { background: "rgba(127,127,127,.14)", color: "inherit", border: "1px solid rgba(127,127,127,.35)", borderRadius: "6px", padding: "4px 9px", fontSize: "12px", cursor: "pointer" },
	// 分段控件（视角三档）：三段连体，只有两端圆角，选中填主色
	seg: { display: "inline-flex", border: "1px solid var(--c-line)", borderRadius: "7px", overflow: "hidden", flexShrink: 0 },
	segItem: { padding: "4px 13px", fontSize: "12.5px", cursor: "pointer", border: "none",
	           borderRight: "1px solid var(--c-line)", background: "var(--c-panel2)", color: "var(--c-fg2)" },
	segOn: { background: "var(--c-accent)", color: "var(--c-accent-on)", fontWeight: 600 },
	chip: { background: "rgba(127,127,127,.14)", border: "1px solid rgba(127,127,127,.28)", borderRadius: "999px", padding: "2px 9px", fontSize: "12px", cursor: "pointer" },
	card: { border: "1px solid rgba(127,127,127,.25)", borderRadius: "8px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" },
	ok: { color: "var(--c-ok)" }, bad: { color: "var(--c-bad)" }, warn: { color: "var(--c-warn)" },
	dim: { opacity: 0.65, fontSize: "12px" },
	scrollBox: { display: "flex", flexWrap: "wrap", gap: "5px", maxHeight: "130px", overflowY: "auto" },
	tab: { padding: "5px 14px", fontSize: "13px", cursor: "pointer", borderBottom: "2px solid transparent" },
	tabOn: { borderBottomColor: "rgba(90,160,235,.9)", opacity: 1 },
	tabOff: { opacity: 0.55 },
};

// ==================== 侧栏图标 ====================
function PanelIcon(props) {
	const size = (props && props.size) || 20;
	const active = !!(props && props.active);
	return h("svg", {
		width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
		style: { display: "block", opacity: active ? 1 : 0.72 },
	},
		h("rect", { x: 3, y: 5, width: 18, height: 14, rx: 2.2, strokeWidth: 1.7 }),
		h("path", { d: "M5 16.4l4.2-4.2 3 3 2.4-2.4 4.4 4.2", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }),
		h("path", { d: "M17.2 3.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z", strokeWidth: 1.3, strokeLinejoin: "round" }));
}

// ==================== 主组件 ====================
/** LLLite 卡级条件（与 lora/loraW 同构）：卡里 conditioning 一旦启用，选中卡就自动解析出
 *  「控制图 + 权重档 + 强度」。路径与哈希一律由 sidecar（/lllite/resolve）判定，
 *  面板不自己拼、不自己算。四态：resolved / degraded（缺件带 reason）/ blocked（校验失败）/ off。 */
const COND = {
	plan: null, cardName: "", picks: {}, listeners: new Set(),
	emit() { this.listeners.forEach((f) => { try { f(this.plan, this.cardName); } catch (e) {} }); },
	subscribe(f) { this.listeners.add(f); try { f(this.plan, this.cardName); } catch (e) {} return () => this.listeners.delete(f); },
	set(plan, cardName) { this.plan = plan || null; this.cardName = cardName || ""; this.emit(); },
	clear() { this.set(null, ""); },
	/** 编辑界面用：校验一份草稿，结果放 checkOf，不覆盖已插入卡的 plan */
	checkOf: null,
	async check(card, canvas) {
		const cond = (card && card.conditioning) || {};
		const name = (card && card.name) || "";
		if (!cond || !cond.enabled) { this.checkOf = { name: name, plan: { status: "off", reason: "未绑定条件图" } }; this.emit(); return this.checkOf.plan; }
		const presets = Object.keys(cond.presets || {});
		const framing = COND.pickOf(card, presets);
		try {
			const r = await jpost(EXPANDER + "/lllite/resolve", { card: card, canvas: canvas || [1024, 1504], framing: framing }, 20000);
			this.checkOf = { name: name, plan: r };
			this.emit();
			return r;
		} catch (e) {
			const r = { status: "degraded", reason: "sidecar 不可用：" + errText(e) };
			this.checkOf = { name: name, plan: r };
			this.emit();
			return r;
		}
	},
	pickOf(card, presets) {
		const key = (card && (card.id || card.name)) || "";
		const pick = COND.picks[key];
		if (pick && presets.indexOf(pick) >= 0) return pick;
		const d = (card && card.conditioning && card.conditioning.default) || "";
		return (d && presets.indexOf(d) >= 0) ? d : (presets[0] || "");
	},
	async resolve(card, canvas) {
		const cond = (card && card.conditioning) || {};
		if (!cond || !cond.enabled) { this.set({ status: "off", reason: "未启用条件图" }, card && card.name); return null; }
		const presets = Object.keys(cond.presets || {});
		const framing = COND.pickOf(card, presets);
		try {
			const r = await jpost(EXPANDER + "/lllite/resolve",
				{ card: card, canvas: canvas || [1024, 1504], framing: framing }, 20000);
			this.set(r, card && card.name);
			return r;
		} catch (e) {
			const r = { status: "degraded", reason: "sidecar 不可用：" + errText(e) };
			this.set(r, card && card.name);
			return r;
		}
	},
};

/* ── 插入登记（2026-10-24）────────────────────────────────────────────
 * 卡插入后写一条记录（只记「差集」：本次真正加进去的词），卡片因此能显蓝框、
 * 能把 LoRA / 特征锁 / LLLite 条件图一起撤干净。软锁语义：词被删掉不回填，
 * 只把该卡标成「部分移除」——不跟用户抢键盘。
 * 多角色：角色卡不互斥，可以同时挂多张。 */
const INSERTED = {
	map: {}, subs: new Set(),
	load() {
		try {
			const raw = localStorage.getItem("dsh.inserted");
			this.map = raw ? (JSON.parse(raw) || {}) : {};
		} catch (e) { this.map = {}; }
	},
	save() { try { localStorage.setItem("dsh.inserted", JSON.stringify(this.map)); } catch (e) { } },
	emit() { this.subs.forEach((f) => { try { f(); } catch (e) { } }); },
	sub(f) { this.subs.add(f); return () => this.subs.delete(f); },
	get(id) { return this.map[String(id || "")] || null; },
	set(id, rec) { this.map[String(id || "")] = rec; this.save(); this.emit(); },
	del(id) { const k = String(id || ""); if (this.map[k]) { delete this.map[k]; this.save(); this.emit(); } },
	all() { return Object.keys(this.map).map((k) => this.map[k]).filter(Boolean); },
	chars() { return this.all().filter((r) => r.kind === "char"); },
};
INSERTED.load();
const tokList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const tokSet = (s) => new Set(tokList(s).map((x) => x.toLowerCase()));
/** 插进去的那几条（差集）：解除时只撤这些，不碰你本来就写着的同名词 */
const diffTokens = (before, after) => { const b = tokSet(before); return tokList(after).filter((t) => !b.has(t.toLowerCase())); };
const PERSON_COUNT_RE = /^(1girl|2girls|3girls|4girls|5girls|solo|2boys|2people|3people|many people|multiple people|multiple characters|multiple girls|duplicate person|extra person|crowd)$/i;
/** 多角色：挂了 ≥2 张角色卡时，放行人物类数量词并改写人数标签；尾巴类（two tails）不动 */
function multiCharAdjust(pos, neg) {
	const n = INSERTED.chars().length;
	if (n < 2) return { pos: pos, neg: neg, n: n };
	const p = tokList(pos).filter((t) => !/^(solo|1girl)$/i.test(t.trim()));
	if (!p.some((t) => new RegExp("^" + n + "girls$", "i").test(t.trim()))) p.unshift(n + "girls");
	if (!p.some((t) => /^multiple characters$/i.test(t.trim()))) p.splice(1, 0, "multiple characters");
	const ng = tokList(neg).filter((t) => !PERSON_COUNT_RE.test(String(t).trim()));
	return { pos: p.join(", "), neg: ng.join(", "), n: n };
}
/** 某条词现在挂在几张卡上（软锁用：最后一张解除时才真删） */
function tokOwner(tk, box) {
	const t = String(tk || "").toLowerCase();
	return INSERTED.all().filter((r) => ((box === "neg" ? r.negTokens : r.posTokens) || []).some((x) => String(x).toLowerCase() === t)).length;
}

/* ===== 以下为 A-alpha 分支移植块（v0.7.94）===== */
/* 来源：dsh-comfyui-console-A-alpha-preview 0.6.59；仅移植本地缺失的 167 个声明
   与整块 Console（改名为 PreviewConsole），本地同名声明一律不覆盖。 */
const OUTPUT_TIME_FILTERS=[
    {value:"all",label:"不限"},{value:"hour",label:"最近 1 小时"},
    {value:"today",label:"今日"},{value:"3d",label:"最近 3 天"},
    {value:"7d",label:"最近 7 天"},{value:"30d",label:"最近 30 天"},
    {value:"custom",label:"自定义日期"}
];

const OUTPUT_SIZE_FILTERS=[
    {value:"all",label:"不限"},
    {value:"small",label:"小图 · ≤768",title:"最长边不超过 768px"},
    {value:"1k",label:"约 1K",title:"最长边 769–1280px"},
    {value:"2k",label:"约 2K",title:"最长边 1281–2048px"},
    {value:"4k",label:"约 4K",title:"最长边 2049–4096px"},
    {value:"huge",label:"超大 · 4K+",title:"最长边超过 4096px"},
    {value:"custom",label:"自定义像素"}
];

const OUTPUT_SHAPE_FILTERS=[
    {value:"all",label:"全部"},
    {value:"square",label:"方形"},{value:"portrait",label:"竖图"},{value:"landscape",label:"横图"}
];

const OUTPUT_SQUARE_MIN_RATIO=0.95;

const OUTPUT_SQUARE_MAX_RATIO=1.05;

function emptyOutputFilter(){return {saved:"all",path:"",name:"",time:"all",dateFrom:"",dateTo:"",size:"all",shape:"all",minEdge:"",maxEdge:""};}

function outputFilterCount(f){return [f.saved!=="all",!!f.path,!!f.name,f.time!=="all",f.size!=="all",f.shape!=="all"].filter(Boolean).length;}

function outputTimeBounds(f,nowMs){
    if(f.time==="all")return [null,null];
    if(f.time==="custom"){
        if(f.dateFrom&&f.dateTo&&f.dateFrom>f.dateTo)return [NaN,NaN];
        const start=f.dateFrom?new Date(f.dateFrom+"T00:00:00").getTime():null;
        // Exclusive next midnight includes all of the selected end date, including DST days.
        const end=f.dateTo?(()=>{const d=new Date(f.dateTo+"T00:00:00");d.setDate(d.getDate()+1);return d.getTime();})():null;
        return [start,end];
    }
    if(f.time==="today"){
        const d=new Date(nowMs);return [new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),null];
    }
    const ms={hour:3600000,"3d":3*86400000,"7d":7*86400000,"30d":30*86400000}[f.time];
    return ms?[nowMs-ms,null]:[null,null];
}

const OUTPUT_EDGE_BANDS={small:[0,768],"1k":[769,1280],"2k":[1281,2048],"4k":[2049,4096],huge:[4097,Infinity]};

function outputMatchesFilters(item,f,nowMs,bounds=outputTimeBounds(f,nowMs)){
    if(f.saved==="saved"&&!item.saved||f.saved==="temp"&&item.saved)return false;
    if(f.name&&!String(item.filename||"").toLowerCase().includes(f.name.trim().toLowerCase()))return false;
    if(f.path&&!String(item.path||item.folder||"Temp").toLowerCase().includes(f.path.trim().toLowerCase()))return false;
    const [from,to]=bounds;
    if(Number.isNaN(from)||Number.isNaN(to))return false;
    if(from!==null||to!==null){
        const ts=Number(item.mtime?item.mtime*1000:item.createdAt)||0;
        if(!ts||from!==null&&ts<from||to!==null&&ts>=to)return false;
    }
    if(f.size!=="all"||f.shape!=="all"){
        const w=Number(item.width),h=Number(item.height);
        if(!(w>0&&h>0))return false;
        const edge=Math.max(w,h),ratio=w/h;
        if(f.size==="custom"){
            const min=f.minEdge===""?null:Number(f.minEdge),max=f.maxEdge===""?null:Number(f.maxEdge);
            if(min!==null&&max!==null&&min>max)return false;
            if(min!==null&&(!Number.isFinite(min)||edge<min))return false;
            if(max!==null&&(!Number.isFinite(max)||edge>max))return false;
        }else if(OUTPUT_EDGE_BANDS[f.size]&&(edge<OUTPUT_EDGE_BANDS[f.size][0]||edge>OUTPUT_EDGE_BANDS[f.size][1]))return false;
        if(f.shape==="square"&&(ratio<OUTPUT_SQUARE_MIN_RATIO||ratio>OUTPUT_SQUARE_MAX_RATIO))return false;
        if(f.shape==="portrait"&&ratio>=OUTPUT_SQUARE_MIN_RATIO)return false;
        if(f.shape==="landscape"&&ratio<=OUTPUT_SQUARE_MAX_RATIO)return false;
    }
    return true;
}


const PORTS_KEY = "dsh-comfyui-console/ports";

function validPort(v, fallback) {
	const n = Number(v);
	return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : fallback;
}

function readPorts() {
	try { return JSON.parse(window.localStorage.getItem(PORTS_KEY) || "{}"); }
	catch (e) { return {}; }
}
// Replaced from config.json by each installer, after merging the previous settings.
// An old browser override is discarded when its installation identity differs.

const INSTALLED_PORTS = { comfyPort: 8188, sidecarPort: 8199 };

const INSTALLED_INSTANCE_ID = "";

const PORTS = readPorts();

const PORTS_MATCH_INSTALL = (!INSTALLED_INSTANCE_ID || PORTS.installedInstanceId === INSTALLED_INSTANCE_ID) && PORTS.installedSidecarPort === INSTALLED_PORTS.sidecarPort &&
    PORTS.installedComfyPort === INSTALLED_PORTS.comfyPort;

const COMFY_PORT = PORTS_MATCH_INSTALL ? validPort(PORTS.comfyPort, INSTALLED_PORTS.comfyPort) : INSTALLED_PORTS.comfyPort;

const EXPANDER_PORT = PORTS_MATCH_INSTALL ? validPort(PORTS.sidecarPort, INSTALLED_PORTS.sidecarPort) : INSTALLED_PORTS.sidecarPort;

const REQUIRED_SIDECAR_API = 15;

let SIDECAR_PLATFORM = "";

function verifySidecarHealth(health) {
    if (!health || health.ok !== true || health.service !== "dsh-comfyui-console" || health.apiVersion !== REQUIRED_SIDECAR_API)
        throw new Error("Sidecar API 不兼容：需要 v" + REQUIRED_SIDECAR_API + "，当前 " + (health?.apiVersion ?? "未知") + "。请更新并重启 Sidecar。 ");
    if (INSTALLED_INSTANCE_ID && health.instanceId !== INSTALLED_INSTANCE_ID)
        throw new Error("Sidecar 安装身份不匹配：可能属于其他 Profile。请关闭旧实例，或为当前 Profile 设置独立端口。");
    if (health.sidecarPort && validPort(health.sidecarPort, 0) !== EXPANDER_PORT)
        throw new Error("Sidecar 监听端口与浏览器连接端口不一致：" + health.sidecarPort + " / " + EXPANDER_PORT);
    SIDECAR_PLATFORM = health.platform || "";
    return health;
}

const MODEL_PINS_KEY = "dsh-comfyui-console/model-pins/v1";

function compactModelPins(values){
    const pins=[...new Set(Array.isArray(values)?values.filter(x=>typeof x==="string"&&x.length>0&&x.length<4096):[])].slice(0,1024);
    return {pins,ranks:Object.fromEntries(pins.map((key,i)=>[key,i+1]))};
}

function toggleModelPin(state,key){
    if(state.pins.includes(key)){
        const ranks={...state.ranks};delete ranks[key];
        return {...state,pins:state.pins.filter(x=>x!==key),ranks};
    }
    const used=new Set(state.pins.map(pin=>state.ranks[pin]));
    let rank=1;while(used.has(rank))rank++;
    const ranks={...state.ranks,[key]:rank};
    return {pins:state.pins.concat(key).sort((a,b)=>ranks[a]-ranks[b]),ranks};
}

function readModelPins(){try{return compactModelPins(JSON.parse(window.localStorage.getItem(MODEL_PINS_KEY)||"[]"));}catch{return compactModelPins([]);}}

function modelFolderPinKey(folder){return folder.pin_key||folder.path||folder.kind+":"+folder.root_id;}

function orderModelFolders(folders,pins){
    const rank=new Map(pins.map((key,i)=>[key,i]));
    return folders.slice().sort((a,b)=>(rank.get(modelFolderPinKey(a))??Infinity)-(rank.get(modelFolderPinKey(b))??Infinity)||a.name.localeCompare(b.name)||String(a.path).localeCompare(String(b.path)));
}

// ==================== 持久化 ====================

function persistPresetList(list){const previous=USER.presets;USER.presets=list;if(saveUser())return true;if(previous===undefined)delete USER.presets;else USER.presets=previous;return false;}

function ensureModelSettingsBackup(){try{const raw=window.localStorage.getItem(LS_KEY)||"{}";for(const version of ["v0653","v0652","v0651","v0650","v0649","v0648","v0647","v0646","v0645","v0644","v0643","v0640","v0639","v0638","v0637"]){const key="dsh-comfyui-console/model-settings-backup/"+version;if(window.localStorage.getItem(key)!==null)continue;window.localStorage.setItem(key,raw);if(window.localStorage.getItem(key)!==raw)return false;}return true;}catch{return false;}}

/** 记录用户首次真正尝试启动（服务离线、已成功读取启动配置），只消耗一次。 */

function consumeFirstStartAttempt() {
	const seen = USER.tutorialsSeen && typeof USER.tutorialsSeen === "object" && !Array.isArray(USER.tutorialsSeen)
		? USER.tutorialsSeen : {};
	if (seen.startAttempted) return false;
	USER.tutorialsSeen = Object.assign({}, seen, { startAttempted: true });
	saveUser();
	return true;
}
/** 记录某个功能区第一次真实交互；手动从「教程」重播不会调用这里。 */

function consumeFirstTutorialUse(key) {
    const seen = USER.tutorialsSeen && typeof USER.tutorialsSeen === "object" && !Array.isArray(USER.tutorialsSeen)
        ? USER.tutorialsSeen : {};
    if (seen[key]) return false;
    USER.tutorialsSeen = Object.assign({}, seen, {[key]: true});
    saveUser();
    return true;
}
// Active queue snapshots are local to this DSH installation, never sent to a third party.
// Keep the old single-job key readable for upgrades from v0.6.4.

function cacheJobs(jobs) {
    try {
        const active = (jobs||[]).filter(j=>j?.pid&&['running','queued'].includes(j.status))
            .slice(0,40).map(j=>({pid:j.pid,submittedAt:j.submittedAt,startedAt:j.startedAt,
                params:j.params||{},status:j.status}));
        if(active.length)window.localStorage.setItem('dsh-comfyui-console/active-jobs',JSON.stringify(active));
        else window.localStorage.removeItem('dsh-comfyui-console/active-jobs');
        window.localStorage.removeItem('dsh-comfyui-console/active-job');
    } catch(e) { /* quota exceeded or storage disabled; live queue still works */ }
}

function readCachedJobs() {
    try {
        const data=JSON.parse(window.localStorage.getItem('dsh-comfyui-console/active-jobs')||'null');
        if(Array.isArray(data))return data.filter(j=>j&&typeof j.pid==='string').slice(0,40);
        const old=JSON.parse(window.localStorage.getItem('dsh-comfyui-console/active-job')||'null');
        return old?.pid?[{...old,status:'queued',submittedAt:old.startedAt,params:{}}]:[];
    } catch(e) { return []; }
}

/**
 * 把预置预设（SEED_PRESETS，来自官方预设的派生）补进去。
 *
 * ⚠️ 2026-10-15 修：原来**只补不更新** —— 改了 presets.js 也刷不到浏览器里
 *    已经存下的那份（localStorage），于是旧版（俯视构图）会永远用下去。
 *    这正是"生成几张之后又开始变俯视"的来源之一：套用旧预设 = 把旧构图塞回来。
 *
 * 现在：
 *   - 写进 localStorage 的内置预设带 `builtin: true` 标记
 *   - `SEED_PRESETS_VERSION` 一变，就**先删掉所有带标记的、再重新写入**
 *   - **用户自建的预设不受影响**（没有标记）
 *
 * neg 为 null 的条目：用官方那条负面提示词填；若该预设正向里含 `from below`
 * （即平视/仰视），再补上压制俯视的那半句。
 */

const NO_HIGH_NEG = " from above, high angle shot, looking down, bird's-eye view,";


const CHAT_SESSION = { log: [] };

// 提示词历史只记录正/负提示词。连续输入合并，其他动作作为一个原子快照。

function createPromptHistory(initial, limit = 120) {
    let entries = [{pos:String(initial.pos || ""), neg:String(initial.neg || "")}];
    let index = 0, typing = null;
    return {
        current: () => ({...entries[index]}),
        canUndo: () => index > 0,
        canRedo: () => index < entries.length - 1,
        commit(next, source = "action", field = "", now = Date.now()) {
            const value = {pos:String(next.pos ?? ""), neg:String(next.neg ?? "")};
            const old = entries[index];
            if (value.pos === old.pos && value.neg === old.neg) return false;
            const coalesce = (source === "typing" || source === "gesture") && typing && typing.source === source && typing.field === field &&
                (field.includes(":drag-") || field.includes(":ime-") || now - typing.at < (source === "gesture" ? 1500 : 800)) && index === entries.length - 1;
            if (coalesce) entries[index] = value;
            else {
                entries = entries.slice(0, index + 1);
                entries.push(value);
                if (entries.length > limit) entries.shift();
                index = entries.length - 1;
            }
            typing = (source === "typing" || source === "gesture") ? {field, at:now,source} : null;
            return true;
        },
        undo() { if (index <= 0) return null; index--; typing = null; return {...entries[index]}; },
        redo() { if (index >= entries.length - 1) return null; index++; typing = null; return {...entries[index]}; },
    };
}

// Preview never becomes the source of truth: all edits use original text ranges.

function splitPromptPreview(value) {
    const parts = []; let start = 0, stack = [], escaped = false, quoted = false, fenced = false;
    const pairs = {"(":")","[":"]","<":">","{":"}"};
    const push = end => {
        const raw = value.slice(start,end), lead = raw.length-raw.trimStart().length;
        if (raw.trim()) {
            const text = raw.trim(), parsed = previewWeight(text);
            parts.push({start:start+lead,end:start+raw.trimEnd().length,raw:text,...parsed});
        }
    };
    for (let i=0;i<value.length;i++) {
        const c=value[i];
        if(!quoted&&!escaped&&value.slice(i,i+3)==='```'){fenced=!fenced;i+=2;continue;}
        if(fenced)continue;
        if (escaped) {escaped=false;continue;}
        if (c==='\\') {escaped=true;continue;}
        if(quoted){if(c===quoted)quoted=false;continue;}
        if(c==='"'||c==='“'||c==='‘'||c==="'"&&(i===0||/\s/.test(value[i-1]))){quoted=({'“':'”','‘':'’'})[c]||c;continue;}
        if (pairs[c]) {stack.push(pairs[c]);continue;}
        if (stack.length && c===stack[stack.length-1]) {stack.pop();continue;}
        const decimal = c==='.' && /\d/.test(value[i-1]||'') && /\d/.test(value[i+1]||'');
        // Embedded dots (names, URLs, filenames) and decimals are not sentence ends.
        const dot = c==='.' && !decimal && (i===value.length-1 || /\s/.test(value[i+1]));
        if (!stack.length && (c===',' || c==='，' || c==='。' || dot || c==='\n')) {push(i);start=i+1;}
    }
    push(value.length);return parts;
}


function previewWeight(raw) {
    let text=raw, weight=1;
    // Only unwrap parentheses that enclose the entire expression.
    while (text.startsWith('(') && text.endsWith(')')) {
        let depth=0, full=true, escaped=false;
        for(let i=0;i<text.length;i++) {
            if(escaped){escaped=false;continue;} if(text[i]==='\\'){escaped=true;continue;}
            if(text[i]==='(')depth++;if(text[i]===')')depth--;
            if(depth===0 && i<text.length-1){full=false;break;}
        }
        if(!full || depth!==0)break;
        const inner=text.slice(1,-1), explicit=inner.match(/^([\s\S]*):((?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+))$/);
        weight*=explicit?Number(explicit[2]):1.1;text=(explicit?explicit[1]:inner).trim();
    }
    const adjustable=!!text && !text.includes("```") && !/[<>\[\]{}]/.test(text) && !/^(?:BREAK|AND)$/.test(text) && !/^[\w-]+:/.test(text);
    return {text,weight:Math.round(weight*10000)/10000,adjustable};
}


function PromptChinesePreview({texts,children}) {
    const [state,setState]=React.useState({items:[],busy:true,error:'',engine:null,key:''});
    const [install,setInstall]=React.useState(null), [refresh,setRefresh]=React.useState(0);
    const key=JSON.stringify(texts);
    React.useEffect(()=>{
        const controller=new AbortController();let active=true;
        setState({items:[],busy:true,error:'',engine:null,key});
        jpost(EXPANDER+'/preview/translate',{texts:JSON.parse(key)},195000,controller.signal)
            .then(r=>{if(active){setState({items:r.items,busy:false,error:r.warning||'',engine:r.engine,key});
                if(r.engine?.status==='running')setInstall(r.engine);}})
            .catch(e=>{if(active && !controller.signal.aborted)setState({items:[],busy:false,error:errText(e),engine:null,key});});
        return()=>{active=false;controller.abort();};
    },[key,refresh]);
    React.useEffect(()=>{
        if(!install || !['running','starting'].includes(install.status))return;
        const controller=new AbortController();let timer,active=true;
        const poll=async()=>{try{
            const r=await jget(EXPANDER+'/translation/status',10000,controller.signal);
            if(!active)return;setInstall(r);
            if(r.ready){setRefresh(v=>v+1);return;}
            if(r.status==='running')timer=setTimeout(poll,2000);
        }catch(e){if(active)setInstall({status:'error',message:errText(e)});}};
        timer=setTimeout(poll,1200);return()=>{active=false;clearTimeout(timer);controller.abort();};
    },[install?.status]);
    const installEngine=async()=>{setInstall({status:'starting',message:'准备安装…'});
        try{setInstall(await jpost(EXPANDER+'/translation/install',{},15000));}
        catch(e){setInstall({status:'error',message:errText(e)});}};
    return h(React.Fragment,null,
        state.busy?h('span',{style:S.dim,role:'status'},'正在准备中文预览…'):null,
        state.error?h('div',{style:S.dim,role:'status'},state.error,
            state.engine && !state.engine.ready?h('button',{type:'button',style:S.btn2,
                disabled:['running','starting'].includes(install?.status),onClick:installEngine},'安装离线翻译（首次需联网）'):null):null,
        install?h('div',{style:S.dim,role:'status'},install.message || (install.ready?'离线翻译已就绪':'正在安装…')):null,
        children(state.key===key?state.items:[]));
}


function PromptIcon({name, size = 16}) {
    const shapes = {
        preview: [h("path", {key:1,d:"M4 7h16l-4-4 M20 17H4l4 4 M20 7l-4 4 M4 17l4-4"})],
        language: [h("path", {key:1,d:"m4 20 8-16 8 16 M7 14h10"})],
        pencil: [h("path", {key:1,d:"m15 5 4 4 M4 20l4.5-1 11-11a2.83 2.83 0 0 0-4-4l-11 11L4 20z"})],
        chat: [h("path", {key:1,d:"M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.48 8.48 0 0 1 8 8v.5z"})],
        x: [h("path", {key:1,d:"M18 6 6 18 M6 6l12 12"})],
        trash: [h("path",{key:1,d:"M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"})],
        undo: [h("path", {key:1,d:"M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-2"})],
        redo: [h("path", {key:1,d:"m15 14 5-5-5-5 M20 9H10a6 6 0 0 0 0 12h2"})],
        pin: [h("path", {key:1,d:"m16 3 5 5-4 1-3 5-4-4 5-3z M10 10l-4 4 M8 16l-5 5 M6 12l6 6"})],
        spinner: [h("path", {key:1,d:"M21 12a9 9 0 1 1-6.22-8.56"})],
        stop: [h("rect", {key:1,x:5,y:5,width:14,height:14,rx:1.5})],
        grip: [h("path", {key:1,d:"M7 8h10 M7 12h10 M7 16h10"})],
        resizeVertical: [h("path", {key:1,d:"M12 3v18 M8 7l4-4 4 4 M8 17l4 4 4-4"})],
        layout: [h("rect", {key:1,x:3,y:3,width:7,height:7,rx:1}),h("rect", {key:2,x:14,y:3,width:7,height:7,rx:1}),h("rect", {key:3,x:3,y:14,width:7,height:7,rx:1}),h("rect", {key:4,x:14,y:14,width:7,height:7,rx:1})],
        folder: [h("path", {key:1,d:"M3 7h7l2 2h9v10H3z M3 7V5h7l2 2"})],
        external: [h("path", {key:1,d:"M14 3h7v7 M21 3l-9 9 M18 13v7H4V6h7"})],
        search: [h("circle", {key:1,cx:11,cy:11,r:7}),h("path", {key:2,d:"m20 20-4-4"})],
        chevronRight: [h("path", {key:1,d:"m9 18 6-6-6-6"})],
        chevronLeft: [h("path", {key:1,d:"m15 18-6-6 6-6"})],
        chevronDown: [h("path", {key:1,d:"m6 9 6 6 6-6"})],
        plus: [h("path", {key:1,d:"M12 5v14 M5 12h14"})],
        sliders: [h("path", {key:1,d:"M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3"}),h("path", {key:2,d:"M1 14h6 M9 8h6 M17 16h6"})],
        image: [h("rect", {key:1,x:3,y:3,width:18,height:18,rx:2}),h("circle", {key:2,cx:8.5,cy:8.5,r:1.5}),h("path", {key:3,d:"m21 15-5-5L5 21"})],
        link: [h("path", {key:1,d:"M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1 M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"})],
        file: [h("path", {key:1,d:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"}),h("path", {key:2,d:"M14 2v6h6"})],
        refresh: [h("path",{key:1,d:"M20 11a8 8 0 1 0-2.3 6 M20 4v7h-7 M4 13a8 8 0 1 0 2.3-6 M4 20v-7h7"})],
        sort: [h("path",{key:1,d:"M4 7h16 M7 12h10 M10 17h4"})],
        swapSize: [h("path", {key:1,d:"M8 3 4 7l4 4 M4 7h15 M16 21l4-4-4-4 M20 17H5"})],
    };
    return h("svg", {width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",
        strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round", "aria-hidden":"true",focusable:"false"},
        ...(shapes[name] || shapes.x));
}

// ==================== 生成任务（模块级，跨面板存活）====================
/**
 * 关键点：任务状态与轮询都放在**模块级**，不放在 React 里。
 * DSH 的 main slot 一次只渲染一个面板，切到对话框时本页面会被卸载；
 * 若把轮询放在组件里，切走就断了、回来也拿不到结果。
 */

function normalizedHistoryTimestamp(value){
    const n=Number(value);if(!Number.isFinite(n)||n<=0)return 0;return n<100000000000?n*1000:n;
}

function generationDurationFromHistory(entry,job,completedAt=Date.now()){
    let started=0,finished=0;
    for(const msg of (entry?.status?.messages||[])){
        if(!Array.isArray(msg)||msg.length<2)continue;
        const kind=String(msg[0]||''),stamp=normalizedHistoryTimestamp(msg[1]?.timestamp);
        if(kind==='execution_start'&&stamp)started=stamp;
        if((kind==='execution_success'||kind==='execution_error')&&stamp)finished=stamp;
    }
    if(started&&finished>=started)return Math.max(0,finished-started);
    const fallback=Number(job?.startedAt)||Number(job?.submittedAt)||0;
    return fallback?Math.max(0,completedAt-fallback):0;
}

function outputGenerationMs(item){
    const n=Number(item?.generationMs ?? item?.params?.generationMs);return Number.isFinite(n)&&n>0?n:0;
}

function formatGenerationDuration(item){
    const ms=outputGenerationMs(item);if(!ms)return '用时未知';
    if(ms<1000)return Math.max(1,Math.round(ms))+'ms';
    const sec=ms/1000;if(sec<60)return (sec<10?sec.toFixed(1):Math.round(sec))+'s';
    const min=Math.floor(sec/60),rest=Math.round(sec-min*60);return min+'m '+rest+'s';
}


const SESSION_OUTPUTS = {
    items: [], listeners: new Set(),
    emit(){this.listeners.forEach(f=>{try{f();}catch{}})},
    subscribe(f){this.listeners.add(f);return()=>this.listeners.delete(f)},
    add(item){
        const x={session:true,createdAt:Date.now(),...item};
        this.items=[x,...this.items.filter(v=>!(x.path&&v.path===x.path)&&!(x.url&&v.url===x.url))].slice(0,300);
        this.emit(); return x;
    },
    snapshot(){return this.items.map(x=>({...x}));},
    remove(match){this.items=this.items.filter(x=>x!==match&&x.id!==match&&x.promptId!==match&&x.path!==match&&x.url!==match);this.emit();},
};


const ERROR_LOG_KEY='dsh-comfyui-console/error-log/v1';

const ERROR_LOG_DEVICE_KEY='dsh-comfyui-console/device-id/v1';

const ERROR_LOG_MAX=200;

function errorLogDeviceId(){
    try{
        let id=window.localStorage.getItem(ERROR_LOG_DEVICE_KEY);
        if(!id){id='dev-'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);window.localStorage.setItem(ERROR_LOG_DEVICE_KEY,id);}
        return id;
    }catch{return 'unknown';}
}

function redactLogText(value){
    let text=String(value??'');
    text=text.replace(/(authorization|api[_-]?key|token|password|secret)(\s*[:=]\s*)[^\s,;]+/gi,'$1$2[redacted]');
    text=text.replace(/([?&](?:token|api_key|key|password|secret)=)[^&\s]+/gi,'$1[redacted]');
    return text.slice(0,4000);
}

function logClientError(context,error,extra){
    try{
        const e=error||{};
        const entry={
            ts:new Date().toISOString(),
            device:errorLogDeviceId(),
            context:redactLogText(context||'unknown'),
            message:redactLogText(e.message||e||'unknown error'),
            stack:redactLogText(e.stack||''),
            extra:extra?redactLogText(JSON.stringify(extra)):undefined,
            ua:redactLogText(typeof navigator!=='undefined'?navigator.userAgent:''),
            viewport:typeof window!=='undefined'?(window.innerWidth+'x'+window.innerHeight):'',
        };
        const list=readClientErrors();
        list.push(entry);
        while(list.length>ERROR_LOG_MAX)list.shift();
        window.localStorage.setItem(ERROR_LOG_KEY,JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('dsh-comfy-error-log'));
    }catch{}
}

function readClientErrors(){
    try{
        const raw=window.localStorage.getItem(ERROR_LOG_KEY);
        const list=raw?JSON.parse(raw):[];
        return Array.isArray(list)?list:[];
    }catch{return [];}
}

function clearClientErrors(){
    try{window.localStorage.removeItem(ERROR_LOG_KEY);window.dispatchEvent(new CustomEvent('dsh-comfy-error-log'));}catch{}
}

// Every Sidecar request (including the ComfyUI proxy) must verify the service
// contract once per page load. An old service on the expected port cannot be
// silently reused for generation, model downloads or settings writes.

let sidecarHealthPromise = null;

let sidecarHealthCheckedAt = 0;

async function requireCompatibleSidecar(url) {
    if (!url.startsWith(EXPANDER + "/") || url === EXPANDER + "/health") return;
    if (!sidecarHealthPromise || Date.now() - sidecarHealthCheckedAt > 30000) {
        sidecarHealthPromise = jget(EXPANDER + "/health", 1500)
            .then(health => { const checked = verifySidecarHealth(health); sidecarHealthCheckedAt = Date.now(); return checked; })
            .catch(error => { sidecarHealthPromise = null; throw error; });
    }
    await sidecarHealthPromise;
}

// 必须始终带 X-Console-Client：本地侧车的 _auth_ok() 第一道闸就是「client 头 + 本机 Origin」，
// 不然后续落到 token 分支——而浏览器端根本不发 token，于是 401 "missing or bad X-Console-Token"。
// 原来这里在 INSTALLED_INSTANCE_ID 为空时返回 {}，dictionaryRequest 等调用点就成了裸请求。

async function fetchAllSavedOutputs(request, endpoint, pageSize=5000, signal=null) {
    const items = [];
    for (let page = 0; page < 200; page++) {
        if (signal?.aborted) throw new DOMException("已取消读取", "AbortError");
        const data = await request(endpoint + (endpoint.includes("?")?"&":"?") + "limit=" + pageSize + "&offset=" + items.length, 30000, signal);
        if (!data || !Array.isArray(data.items)) throw new Error("输出列表接口返回了无效数据");
        if (data.hasMore && data.items.length === 0) throw new Error("输出列表分页未能继续，已停止以防止无限循环");
        items.push(...data.items);
        if (!data.hasMore) return items;
    }
    throw new Error("输出图片数量超过本次扫描支持的分页上限");
}

function savedOutputUrl(path) {
    return EXPANDER + "/outputs/view?path=" + encodeURIComponent(path);
}

const MODEL_PROFILES={
 legacy:{label:"旧版 Checkpoint · 类型待确认",family:"legacy",negative:true,style:"mixed",latent:"EmptyLatentImage",modes:["checkpoint"]},
 unknown:{label:"待确认模型类型",family:"unknown",negative:true,style:"mixed",latent:"EmptyLatentImage",modes:[]},
 sd15:{label:"SD1.5",family:"sd15",negative:true,style:"mixed",latent:"EmptyLatentImage",modes:["checkpoint","diffusion"],clipType:"stable_diffusion",recommended:{steps:24,cfg:6,sampler:"euler",scheduler:"normal",w:512,h:512}},
 sdxl:{label:"SDXL",family:"sdxl",negative:true,style:"mixed",latent:"EmptyLatentImage",modes:["checkpoint"],recommended:{steps:24,cfg:6,sampler:"euler",scheduler:"normal",w:1024,h:1024}},
 "sd3-medium":{label:"SD3 Medium",family:"sd3",negative:true,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"sd3",encoders:3,modelOnlyLora:true,samplingShift:true,sizeStep:16,recommended:{steps:30,cfg:5.45,sampler:"euler",scheduler:"sgm_uniform",w:1024,h:1024}},
 "sd35-large":{label:"SD3.5 Large",family:"sd3",negative:true,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"sd3",encoders:3,modelOnlyLora:true,samplingShift:true,sizeStep:16,recommended:{steps:20,cfg:5.45,sampler:"euler",scheduler:"sgm_uniform",w:1024,h:1024}},
 "sd35-medium":{label:"SD3.5 Medium",family:"sd3",negative:true,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"sd3",encoders:3,modelOnlyLora:true,samplingShift:true,sizeStep:16,recommended:{steps:20,cfg:5.45,sampler:"euler",scheduler:"sgm_uniform",w:1024,h:1024}},
 "sd35-turbo":{label:"SD3.5 Large Turbo",family:"sd3",negative:true,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"sd3",encoders:3,modelOnlyLora:true,samplingShift:true,sizeStep:16,recommended:{steps:4,cfg:1.2,sampler:"euler",scheduler:"sgm_uniform",w:1024,h:1024}},
 "anima-base":{label:"Anima Base",family:"anima",negative:true,style:"mixed",latent:"EmptyLatentImage",modes:["diffusion"],clipType:"stable_diffusion",modelOnlyLora:true,recommended:{steps:30,cfg:4,sampler:"euler",scheduler:"simple",w:1024,h:1024}},
 "anima-aesthetic":{label:"Anima Aesthetic",family:"anima",negative:true,style:"mixed",latent:"EmptyLatentImage",modes:["diffusion"],clipType:"stable_diffusion",modelOnlyLora:true,recommended:{steps:30,cfg:4,sampler:"euler",scheduler:"simple",w:1024,h:1024}},
 "anima-turbo":{label:"Anima Turbo",family:"anima",negative:false,style:"mixed",latent:"EmptyLatentImage",modes:["diffusion"],clipType:"stable_diffusion",modelOnlyLora:true,recommended:{steps:8,cfg:1,sampler:"euler",scheduler:"simple",w:1024,h:1024}},
 "flux-dev":{label:"FLUX.1 Dev",family:"flux",negative:false,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"flux",encoders:2,guidance:true,modelOnlyLora:true,recommended:{steps:20,cfg:1,guidance:3.5,sampler:"euler",scheduler:"simple",w:1024,h:1024}},
 "flux-schnell":{label:"FLUX.1 Schnell",family:"flux",negative:false,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"flux",encoders:2,modelOnlyLora:true,recommended:{steps:4,cfg:1,sampler:"euler",scheduler:"simple",w:1024,h:1024}},
 "flux-krea":{label:"FLUX.1 Krea Dev",family:"flux",negative:false,style:"natural",latent:"EmptySD3LatentImage",modes:["checkpoint","diffusion"],clipType:"flux",encoders:2,guidance:true,modelOnlyLora:true,recommended:{steps:20,cfg:1,guidance:4.5,sampler:"euler",scheduler:"simple",w:1024,h:1024}},
};
/** 由底模元数据里的 base_type 文本推出 MODEL_PROFILES 的 key。
 *  生成页要让"选底模 → 文本编码器自动适配"，而 A 线原本是让用户手动选模型类型（profile）。
 *  base_type 来自 /models/detail（safetensors 头里的 base model 字段），实测 animagine 返回 "SDXL"。
 *  认不出来就返回空串，调用方保持现状不动——宁可不动，也不要猜错把编码器塞成别的类型。 */
function profileKeyFromModelBase(baseType){
 const t=String(baseType||"").toLowerCase().replace(/[\s._\-/]+/g,"");
 if(!t)return "";
 if(/krea/.test(t))return "flux-krea";
 if(/flux/.test(t))return /schnell|flux1s$|fluxs$/.test(t)?"flux-schnell":"flux-dev";
 if(/sd3\.?5|sd35/.test(t))return /turbo/.test(t)?"sd35-turbo":/medium/.test(t)?"sd35-medium":"sd35-large";
 if(/sd3/.test(t))return "sd3-medium";
 // anima-* 在这里故意不推断：A 线的 Anima profile 用 stable_diffusion 编码器，
 // 而本地面板的 Anima 走 qwen_image（底模取自 diffusion_models），两者不是一回事。
 // 自动套过去会把 Anima 底模当 checkpoint 送进构建流程，ComfyUI 直接退 400。
 if(/anima/.test(t))return "";
 if(/pony|illustrious|noobai|sdxl/.test(t))return "sdxl";
 if(/sd2/.test(t))return "sd2";
 if(/sd1\.?5|sd15/.test(t))return "sd15";
 return "";
}
/** base_type 缺失时的第二道：按文件名猜。
 *  本机实测 4 个底模里 sd_xl_base_1.0 / animagine-xl-3.1 的元数据写了 base_type=SDXL，
 *  而 v1-5-pruned-emaonly / meinamix-v11 是「未知」——前者文件名里明确写着 v1-5，能救回来；
 *  后者名字不含任何家族信息，就不猜（猜成 SDXL 也可能对，但猜错就是 400，不值）。 */
function profileKeyFromModelName(name){
 const t=String(name||"").toLowerCase().replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/,"");
 if(!t||/anima/.test(t))return "";
 if(/flux/.test(t))return /schnell/.test(t)?"flux-schnell":"flux-dev";
 if(/sd3|sd_?3/.test(t))return "sd3-medium";
 if(/xl/.test(t))return "sdxl";
 if(/v1-?5|sd_?1[._]?5|sd15|(^|[^0-9])1[._]5([^0-9]|$)/.test(t))return "sd15";
 if(/v2-?1|sd_?2/.test(t))return "sd2";
 return "";
}
/** 家族 → 该家族常用编码器 / VAE 的文件名线索，按顺序试，命中第一个就用。
 *  checkpoint 系（sd15/sdxl/sd2）留空数组：它们的 CLIP / VAE 都在 checkpoint 里，
 *  buildGraph 已经改成取 ["1",1] / ["1",2]，不需要外挂文件。
 *  只有拿不到内置件的家族（anima 必须外挂 qwen 编码器）才在这里给出文件名线索。 */
const PROFILE_CLIP_HINT = {
	anima: [/qwen/i],
	sd3: [/t5xxl/i, /t5/i, /clip_l/i],
	flux: [/t5xxl/i, /t5/i, /clip_l/i],
};
const PROFILE_VAE_HINT = {
	anima: [/qwen[_-]?image[_-]?vae/i, /qwen.*vae/i],
	sdxl: [/sdxl[._-]?vae/i],
	sd15: [/vae-ft-mse/i, /840000/i],
	"sd2": [/840000/i, /vae/i],
	sd3: [/sdxl[._-]?vae/i, /vae/i],
	flux: [/^ae\.safetensors$/i, /flux.*vae/i],
};
function pickByHints(list, hints){
	const arr = Array.isArray(list) ? list : [];
	for (const re of (hints || [])) {
		const hit = arr.find((x) => re.test(String(x || "")));
		if (hit) return hit;
	}
	return "";
}
// Registry entries encode distinct text-to-image pipelines; optional tasks are never inferred.
Object.assign(MODEL_PROFILES,{
 "sd2": {
  "label": "SD2.x",
  "family": "sd2",
  "clipType": "stable_diffusion",
  "encoderRoles": [
   "Text Encoder"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 24,
   "cfg": 7,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "illustrious": {
  "label": "Illustrious XL",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 24,
   "cfg": 6,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "pony": {
  "label": "Pony XL",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 24,
   "cfg": 6,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "sdxl-turbo": {
  "label": "SDXL Turbo",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 1,
   "cfg": 1,
   "sampler": "euler_ancestral",
   "scheduler": "simple",
   "w": 512,
   "h": 512
  },
  "advanced": "SDTurboScheduler"
 },
 "sdxl-lightning-1": {
  "label": "SDXL Lightning 1-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 1,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 1,
  "x0": true
 },
 "sdxl-lightning-2": {
  "label": "SDXL Lightning 2-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 2,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 2,
  "x0": false
 },
 "sdxl-lightning-4": {
  "label": "SDXL Lightning 4-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 4,
  "x0": false
 },
 "sdxl-lightning-8": {
  "label": "SDXL Lightning 8-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 8,
  "x0": false
 },
 "qwen-image": {
  "label": "Qwen-Image",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 4,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true
 },
 "qwen-lightning8": {
  "label": "Qwen-Image · Lightning 8-step",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true,
  "acceleration": "Qwen-Image-Lightning-8steps-V1.0"
 },
 "qwen-distill": {
  "label": "Qwen-Image · Distill",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true
 },
 "qwen-2512": {
  "label": "Qwen-Image 2512",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 50,
   "cfg": 4,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true
 },
 "qwen-2512-lightning4": {
  "label": "Qwen-Image 2512 · Lightning 4-step",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true,
  "acceleration": "Qwen-Image-2512-Lightning-4steps"
 },
 "qwen21": {
  "label": "Qwen-Image 2.1",
  "family": "qwen21",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen3-VL 8B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "textNode": "TextEncodeQwenImage21",
  "cacheNode": "QwenImage21Cache"
 },
 "qwen21-turbo": {
  "label": "Qwen-Image 2.1 Turbo",
  "family": "qwen21",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen3-VL 8B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "textNode": "TextEncodeQwenImage21",
  "cacheNode": "QwenImage21Cache",
  "advanced": "ManualSigmas",
  "fixedSteps": 8,
  "sigmas": "1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0"
 },
 "z-image": {
  "label": "Z-Image Base",
  "family": "z-image",
  "clipType": "lumina2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 4,
   "sampler": "res_multistep",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3,
  "samplingShift": true
 },
 "z-image-turbo": {
  "label": "Z-Image Turbo",
  "family": "z-image",
  "clipType": "lumina2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "res_multistep",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3,
  "samplingShift": true
 },
 "flux2-dev": {
  "label": "FLUX.2 Dev",
  "family": "flux2-dev",
  "clipType": "flux2",
  "encoderRoles": [
   "Mistral 3 Small"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024,
   "guidance": 4
  },
  "advanced": "Flux2Scheduler",
  "basicGuider": true,
  "guidance": true
 },
 "flux2-turbo": {
  "label": "FLUX.2 Dev · Turbo LoRA",
  "family": "flux2-dev",
  "clipType": "flux2",
  "encoderRoles": [
   "Mistral 3 Small"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024,
   "guidance": 4
  },
  "advanced": "Flux2Scheduler",
  "basicGuider": true,
  "guidance": true,
  "acceleration": "FLUX.2 Turbo"
 },
 "flux2-klein4-base": {
  "label": "FLUX.2 Klein 4B Base",
  "family": "flux2-klein4",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "flux2-klein4-distilled": {
  "label": "FLUX.2 Klein 4B Distilled",
  "family": "flux2-klein4",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "flux2-klein9-base": {
  "label": "FLUX.2 Klein 9B Base",
  "family": "flux2-klein9",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 8B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "flux2-klein9-distilled": {
  "label": "FLUX.2 Klein 9B Distilled",
  "family": "flux2-klein9",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 8B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "hidream-full": {
  "label": "HiDream I1 Full",
  "family": "hidream",
  "clipType": "hidream",
  "encoderRoles": [
   "CLIP-L HiDream",
   "CLIP-G HiDream",
   "T5XXL",
   "Llama3.1 8B"
  ],
  "encoders": 4,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 50,
   "cfg": 5,
   "sampler": "uni_pc",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingSD3",
  "patchShift": 3,
  "samplingShift": true
 },
 "hidream-dev": {
  "label": "HiDream I1 Dev",
  "family": "hidream",
  "clipType": "hidream",
  "encoderRoles": [
   "CLIP-L HiDream",
   "CLIP-G HiDream",
   "T5XXL",
   "Llama3.1 8B"
  ],
  "encoders": 4,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 28,
   "cfg": 1,
   "sampler": "lcm",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingSD3",
  "patchShift": 6,
  "samplingShift": true
 },
 "hidream-fast": {
  "label": "HiDream I1 Fast",
  "family": "hidream",
  "clipType": "hidream",
  "encoderRoles": [
   "CLIP-L HiDream",
   "CLIP-G HiDream",
   "T5XXL",
   "Llama3.1 8B"
  ],
  "encoders": 4,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 16,
   "cfg": 1,
   "sampler": "lcm",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingSD3",
  "patchShift": 3,
  "samplingShift": true
 },
 "moss-sft": {
  "label": "MOSS-Image SFT",
  "family": "moss",
  "clipType": "moss_image",
  "encoderRoles": [
   "Qwen3.5 9B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 2.5,
   "sampler": "er_sde",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "slgNode": "SkipLayerGuidanceDiTSimple"
 },
 "moss-base": {
  "label": "MOSS-Image Base",
  "family": "moss",
  "clipType": "moss_image",
  "encoderRoles": [
   "Qwen3.5 9B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 2.5,
   "sampler": "er_sde",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "slgNode": "SkipLayerGuidanceDiTSimple"
 },
 "krea2-turbo": {
  "label": "Krea 2 Turbo",
  "family": "krea2",
  "clipType": "krea2",
  "encoderRoles": [
   "Qwen3-VL 4B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  }
 },
 "krea2-raw": {
  "label": "Krea 2 RAW",
  "family": "krea2",
  "clipType": "krea2",
  "encoderRoles": [
   "Qwen3-VL 4B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 52,
   "cfg": 4.5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  }
 },
 "chroma": {
  "label": "Chroma / Chroma1-HD",
  "family": "chroma",
  "clipType": "chroma",
  "encoderRoles": [
   "T5XXL"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 26,
   "cfg": 3.5,
   "sampler": "euler",
   "scheduler": "beta",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 1,
  "samplingShift": true,
  "tokenizer": true
 },
 "lumina2": {
  "label": "Lumina Image 2.0",
  "family": "lumina2",
  "clipType": "lumina2",
  "encoderRoles": [
   "Gemma2 2B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 4,
   "sampler": "res_multistep",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 6,
  "samplingShift": true
 },
 "hunyuan21": {
  "label": "Hunyuan Image 2.1",
  "family": "hunyuan",
  "clipType": "hunyuan_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B",
   "ByT5 Small Glyph"
  ],
  "encoders": 2,
  "latent": "EmptyHunyuanImageLatent",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 32,
  "recommended": {
   "steps": 20,
   "cfg": 3.5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 2048,
   "h": 2048
  }
 }
});
Object.assign(MODEL_PROFILES.sdxl,{modes:["checkpoint","diffusion"],encoders:2,clipType:"sdxl",encoderRoles:["CLIP-L","CLIP-G"]});
MODEL_PROFILES["sdxl-lightning-1"].recommended.scheduler="simple";
MODEL_PROFILES["anima-turbo-lora"]={...MODEL_PROFILES["anima-turbo"],label:"Anima Base · Turbo LoRA",acceleration:"Anima Turbo",encoderRoles:["Text Encoder"]};


function normalizeModelConfig(value){
 const v=value&&typeof value==="object"?value:{};
 return {version:1,contentMode:['checkpoint','diffusion'].includes(v.contentMode)?v.contentMode:'unknown',embeddedClip:typeof v.embeddedClip==='boolean'?v.embeddedClip:null,embeddedVae:typeof v.embeddedVae==='boolean'?v.embeddedVae:null,componentOrder:normalizeComponentOrder(v.componentOrder),encoderOverride:v.encoderOverride===true,vaeOverride:v.vaeOverride===true,mode:v.mode==="diffusion"?"diffusion":"checkpoint",profile:v.profile===undefined?"legacy":(Object.prototype.hasOwnProperty.call(MODEL_PROFILES,v.profile)?v.profile:"unknown"),main:String(v.main||""),clip2:String(v.clip2||""),clip3:String(v.clip3||""),clip4:String(v.clip4||""),accelerationLora:String(v.accelerationLora||""),slg:v.slg!==false,encoderMode:v.encoderMode===undefined?"triple":String(v.encoderMode),shift:v.shift??null,dtype:String(v.dtype||"default"),guidance:v.guidance??3.5,clipSkip:v.clipSkip??0,identity:String(v.identity||"")};
}

function normalizeComponentOrder(order){return [...new Set((Array.isArray(order)?order:[]).filter(k=>typeof k==='string'&&(k==='clip'||k==='vae'||k==='acceleration'||k.startsWith('encoder:')&&k.length>8||k.startsWith('lora:')&&k.length>5)&&k.length<4096))].slice(0,256);}


function modelNeedsExternal(config){const c=normalizeModelConfig(config),p=MODEL_PROFILES[c.profile];return c.mode==='diffusion'||c.contentMode==='diffusion'||p.modes.length===1&&p.modes[0]==='diffusion';}

function modelNeedsVae(config){const c=normalizeModelConfig(config);return modelNeedsExternal(c)||c.embeddedVae===false||c.vaeOverride;}

function withModelFileInfo(value,info){const c=normalizeModelConfig({...value,contentMode:info.contentMode,embeddedClip:info.embeddedClip,embeddedVae:info.embeddedVae});if(MODEL_PROFILES[c.profile].family==='sd3'&&c.encoderMode==='embedded'&&(modelNeedsExternal(c)||c.embeddedClip===false))c.encoderMode='triple';return c;}

function modelProfile(config){return MODEL_PROFILES[normalizeModelConfig(config).profile];}


function modelConfigKey(config,ckpt){const c=normalizeModelConfig(config);return JSON.stringify([c.mode,c.mode==="diffusion"?c.main:ckpt,c.identity]);}

function rememberedModelSetup(cache,config,ckpt){
 const c=normalizeModelConfig(config),exact=cache?.[modelConfigKey(c,ckpt)];
 // A legacy unbound configuration may be adopted by the default root, never a different explicit root.
 return exact||(c.identity==='0'?cache?.[modelConfigKey({...c,identity:''},ckpt)]:undefined);
}
// Rewrite only model paths after a successful in-library move. Prompt text and backups stay immutable.

function modelPathChange(oldName,newName,folder=false,options=[],ignoreCase=SIDECAR_PLATFORM==='nt'){
 const slash=value=>String(value||'').replace(/\\/g,'/').replace(/^\.\//,'');
 const compare=value=>ignoreCase?value.toLowerCase():value;
 const old=slash(oldName),next=slash(newName),prefix=old+'/';
 return value=>{if(typeof value!=='string'||!value)return value;const path=slash(value);
  const result=folder?(compare(path).startsWith(compare(prefix))?next+'/'+path.slice(prefix.length):value):
   (compare(path)===compare(old)?next:value);
  return result===value?value:options.find(name=>compare(slash(name))===compare(slash(result)))||result;};
}

function remapModelSetupPaths(item,kind,change,rootId){
 if(!item||typeof item!=='object'||Array.isArray(item))return item;
 const out={...item},c=item.modelConfig&&{...item.modelConfig};
 const mainRootMatches=rootId===undefined||!c?.identity||String(c.identity)===String(rootId);
 if(kind==='checkpoint'&&mainRootMatches&&'ckpt' in out)out.ckpt=change(out.ckpt);
 if(kind==='clip'&&'clip' in out)out.clip=change(out.clip);
 if(kind==='vae'&&'vae' in out)out.vae=change(out.vae);
 if(kind==='upscale'&&'upscaleModel' in out)out.upscaleModel=change(out.upscaleModel);
 if(out.postControls?.cells)out.postControls={...out.postControls,cells:out.postControls.cells.map(cell=>cell.kind==='upscale'&&kind==='upscale'?{...cell,model:change(cell.model)}:cell)};
 if(c){if(kind==='diffusion'&&mainRootMatches)c.main=change(c.main);
  if(kind==='clip')for(const field of ['clip2','clip3','clip4'])if(field in c)c[field]=change(c[field]);
  if(kind==='lora'){if('accelerationLora' in c)c.accelerationLora=change(c.accelerationLora);if(Array.isArray(c.componentOrder))c.componentOrder=normalizeComponentOrder(c.componentOrder).map(k=>k.startsWith('lora:')?'lora:'+change(k.slice(5)):k);}out.modelConfig=c;}
 if(kind==='lora'&&Array.isArray(out.loras))out.loras=out.loras.map(l=>l&&typeof l==='object'?{...l,name:change(l.name)}:l);
 return out;
}

function remapSavedModelPaths(user,kind,change,rootId){
 const keyChange=key=>{try{const parts=JSON.parse(key);if(!Array.isArray(parts)||parts.length!==3)return key;
  if(parts[0]===kind&&(rootId===undefined||!parts[2]||String(parts[2])===String(rootId)))parts[1]=change(parts[1]);
  return JSON.stringify(parts);}catch{return key;}};
 const rewrite=(cache,profile=false)=>{
  if(!cache||typeof cache!=='object'||Array.isArray(cache))return cache;
  const rows=Object.entries(cache).map(([key,value])=>{let next=key;
   if(profile){try{const parts=JSON.parse(key);if(Array.isArray(parts)&&parts.length===2){parts[0]=keyChange(parts[0]);next=JSON.stringify(parts);}}catch{}}
   else next=keyChange(key);
   return [next,remapModelSetupPaths(value,kind,change,rootId),key!==next];});
  // The file that was actually moved wins over an obsolete cache for its destination.
  return Object.fromEntries(rows.sort((a,b)=>Number(a[2])-Number(b[2])).map(([key,value])=>[key,value]));};
 if(user.last)user.last=remapModelSetupPaths(user.last,kind,change,rootId);
 if(Array.isArray(user.presets))user.presets=user.presets.map(p=>remapModelSetupPaths(p,kind,change,rootId));
 if(user.modelConfigs)user.modelConfigs=rewrite(user.modelConfigs);
 if(user.modelProfileConfigs)user.modelProfileConfigs=rewrite(user.modelProfileConfigs,true);
}

function activeModelLoras(loras){return (Array.isArray(loras)?loras:[]).filter(x=>x.enabled!==false&&!(x.id&&!String(x.name||'').trim()));}

function modelEncoderCount(o){
 const c=normalizeModelConfig(o.modelConfig),p=modelProfile(c);
 if(p.family==='sd3')return ({embedded:0,t5:1,dual:2,triple:3})[c.encoderMode]??0;
 if(!modelNeedsExternal(c)&&c.embeddedClip!==false&&!c.encoderOverride&&![o.clip,c.clip2,c.clip3,c.clip4].some(Boolean))return 0;
 return p.encoders||1;
}

function modelEncoderRoles(c){const p=modelProfile(c);return p.family==='sd3'?(c.encoderMode==='t5'?['T5XXL']:c.encoderMode==='dual'?['CLIP-L','CLIP-G']:c.encoderMode==='embedded'?[]:['CLIP-L','CLIP-G','T5XXL']):p.encoderRoles||(p.encoders===2?['CLIP-L','T5XXL']:['Text Encoder']);}

function controlEncoderRoles(config){const c=normalizeModelConfig(config);return modelEncoderRoles(modelProfile(c).family==='sd3'&&c.encoderMode==='embedded'?{...c,encoderMode:'triple'}:c);}

function controlLoraKey(l){return 'lora:'+(l.id||l.name);}

function generationControlEntries(setup){
 const c=normalizeModelConfig(setup.modelConfig),roles=controlEncoderRoles(c),files=[setup.clip,c.clip2,c.clip3,c.clip4],entries=new Map(),order=[];
 const add=key=>{if(!order.includes(key))order.push(key);};
 for(const key of c.componentOrder){if(key==='clip')roles.forEach(role=>add('encoder:'+role));else add(key);}
 roles.forEach((role,index)=>{const key='encoder:'+role;if(order.includes(key)||files[index]||c.encoderOverride&&!c.componentOrder.some(k=>k.startsWith('encoder:')))entries.set(key,{key,kind:'clip',role,index,name:files[index]||'',label:'文本编码器 · '+role});});
 if(order.includes('vae')||setup.vae||c.vaeOverride)entries.set('vae',{key:'vae',kind:'vae',name:setup.vae||'',label:'VAE'});
 if(modelProfile(c).acceleration&&(order.includes('acceleration')||c.accelerationLora))entries.set('acceleration',{key:'acceleration',kind:'lora',name:c.accelerationLora||'',label:'加速 LoRA · '+modelProfile(c).acceleration,acceleration:true});
 for(const lora of setup.loras||[]){const key=controlLoraKey(lora);entries.set(key,{key,kind:'lora',name:lora.name||'',label:'LoRA',lora});}
 return [...order.filter(key=>entries.has(key)),...Array.from(entries.keys()).filter(key=>!order.includes(key))].map(key=>entries.get(key));
}

function generationControlSummary(entries){if(!entries.length)return '0 个控制';const n=kind=>entries.filter(e=>e.kind===kind).length;return [['vae','VAE'],['clip','文本编码器'],['lora','LoRA']].filter(([kind])=>n(kind)).map(([kind,label])=>n(kind)+' '+label).join(' · ');}

/** 拼 ComfyUI API 格式的工作流 */

const IMAGE_SIZE_PRESETS = [
    // 只保留每种比例的一个方向；宽高对调按钮负责横竖切换。
    {value:'1024x1024',label:'1:1 · 1024×1024',w:1024,h:1024},
    {value:'1024x768',label:'4:3 · 老电视 · 1024×768',w:1024,h:768},
    {value:'832x1216',label:'2:3 · 人像 / 插画 · 832×1216',w:832,h:1216},
    {value:'864x1224',label:'1:√2 · A4 · 864×1224',w:864,h:1224},
    {value:'1344x768',label:'16:9 · 1344×768',w:1344,h:768},
    {value:'1536x640',label:'21:9 · 1536×640',w:1536,h:640},
    {value:'1536x512',label:'3:1 · Banner · 1536×512',w:1536,h:512},
    {value:'1792x448',label:'4:1 · Ultra Banner · 1792×448',w:1792,h:448},
];

function imageSizeScaled(w,h,multiplier,alignment=8){
    const m=Math.max(.25,Math.min(4,Number(multiplier)||1));
    const step=m===1?8:Math.max(8,Number(alignment)||8);
    const snap=v=>Math.max(64,Math.min(8192,Math.round(Number(v)/step)*step));
    return {w:snap(Number(w)*m),h:snap(Number(h)*m)};
}

function preciseSizeMultiplier(value,fallback=1){
    const n=String(value??'').trim()===''?NaN:Number(value),backup=Number(fallback);
    return Math.round(Math.max(.25,Math.min(4,Number.isFinite(n)?n:Number.isFinite(backup)?backup:1))*100)/100;
}

function DraggableNumberInput({
    value,onChange,min,max,step=.01,precision=2,dragPerPixel=1/300,
    label='数值',decreaseLabel='减小',increaseLabel='增大',className='',
}){
    const factor=10**precision,clamp=n=>Math.round(Math.max(min,Math.min(max,n))*factor)/factor;
    const fallback=min<=1&&max>=1?1:min;
    const normalize=(v,fb=fallback)=>{const n=String(v??'').trim()===''?NaN:Number(v);return clamp(Number.isFinite(n)?n:Number.isFinite(Number(fb))?Number(fb):fallback);};
    const [draft,setDraft]=React.useState(()=>normalize(value).toFixed(precision)),[dragging,setDragging]=React.useState(false);
    const editing=React.useRef(false),drag=React.useRef(null),input=React.useRef(null),latest=React.useRef(value),text=React.useRef(draft),emitted=React.useRef(null),suppressClick=React.useRef(false);
    latest.current=value;
    function writeDraft(v){text.current=v;setDraft(v);}
    function publish(n){emitted.current=n;latest.current=n;onChange(n);}
    function stop(e){const d=drag.current;if(d&&e?.pointerId!==undefined&&e.pointerId!==d.id)return;drag.current=null;setDragging(false);if(d){if(d.active)suppressClick.current=true;try{d.target.releasePointerCapture(d.id);}catch{}}}
    React.useEffect(()=>{
        const n=normalize(value),local=emitted.current!==null&&Number(value)===emitted.current;emitted.current=null;
        if(!local){stop();writeDraft(n.toFixed(precision));}
        else if(!editing.current&&!drag.current)writeDraft(n.toFixed(precision));
        if(Number(value)!==n)publish(n);
    },[value]);
    function commit(){const n=normalize(text.current,latest.current);editing.current=false;writeDraft(n.toFixed(precision));publish(n);return n;}
    function stepBy(delta){stop();const n=normalize(normalize(text.current,latest.current)+delta);writeDraft(n.toFixed(precision));publish(n);}
    React.useEffect(()=>{const blur=()=>stop(),release=e=>stop(e);window.addEventListener('blur',blur);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);return()=>{window.removeEventListener('blur',blur);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);const d=drag.current;drag.current=null;if(d)try{d.target.releasePointerCapture(d.id);}catch{}};},[]);
    function begin(e){
        if(e.button!==0||drag.current)return;suppressClick.current=false;
        const d={x:e.clientX,base:normalize(text.current,latest.current),id:e.pointerId,target:e.currentTarget,active:false};drag.current=d;
    }
    function move(e){
        const d=drag.current;if(!d||e.pointerId!==d.id)return;
        if(e.buttons!==undefined&&!(e.buttons&1)){stop();return;}
        const dx=e.clientX-d.x;if(!d.active&&Math.abs(dx)<4)return;
        if(!d.active){d.active=true;try{d.target.setPointerCapture(d.id);}catch{stop();return;}editing.current=false;input.current?.blur();setDragging(true);}
        const n=normalize(d.base+dx*dragPerPixel);writeDraft(n.toFixed(precision));publish(n);
    }
    function finish(e){const d=drag.current;if(!d||e.pointerId!==d.id)return;stop(e);if(!d.active)suppressClick.current=false;}
    const arrow=(direction,text)=>h('button',{type:'button','aria-label':direction<0?decreaseLabel:increaseLabel,'data-cc-tooltip':direction<0?'减小 '+step:'增大 '+step,
        disabled:direction<0?normalize(value)<=min:normalize(value)>=max,
        onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>stepBy(direction*step)},h(PromptIcon,{name:direction<0?'chevronLeft':'chevronRight',size:12}));
    return h('div',{className:'cc-drag-number'+(className?' '+className:''),'data-dragging':dragging},
        arrow(-1,decreaseLabel),
        h('input',{ref:input,type:'number',step,min,max,'aria-label':label,value:draft,title:'左右拖动调整；点击输入数值',
            onPointerDown:begin,onPointerMove:move,onPointerUp:finish,onPointerCancel:stop,onLostPointerCapture:stop,
            onClick:e=>{if(suppressClick.current){e.preventDefault();suppressClick.current=false;}},
            onFocus:()=>{editing.current=true;},onChange:e=>{writeDraft(e.target.value);const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)&&n>=min&&n<=max)publish(normalize(n));},onBlur:commit,
            onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();commit();e.currentTarget.blur();}else if(e.key==='Escape'){e.preventDefault();stop();writeDraft(normalize(latest.current).toFixed(precision));editing.current=false;e.currentTarget.blur();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepBy(e.key==='ArrowUp'?step:-step);}}}),
        arrow(1,increaseLabel));
}


// ==================== 统一视觉令牌（详见根目录 design.md）====================
// 不能假定 DSH 和操作系统采用同一主题：读取宿主实际的文字/背景颜色，
// 把配色显式传递给 portaled 浮层。所有控件都使用同一套 --cc-* 令牌。

function rgbOf(value) {
    const m = String(value || "").match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+))?/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
}

function luminance(c) {
    if (!c) return 0;
    const linear = (v) => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
    return .2126 * linear(c.r) + .7152 * linear(c.g) + .0722 * linear(c.b);
}

function contrastRatio(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function mixHex(a, b, ratio) {
    const n = (x, y) => Math.round(x * (1 - ratio) + y * ratio).toString(16).padStart(2, "0");
    return "#" + n(a.r, b.r) + n(a.g, b.g) + n(a.b, b.b);
}

function hostPalette(root) {
    if (!root || typeof window === "undefined" || !window.getComputedStyle) return {};
    const fg = rgbOf(window.getComputedStyle(root.parentElement || root).color);
    let bg = null;
    for (let n = root; n && n.nodeType === 1; n = n.parentElement) {
        const c = rgbOf(window.getComputedStyle(n).backgroundColor);
        if (c && c.a >= .95) { bg = c; break; }
    }
    const dark = bg ? luminance(bg) < .18 : fg ? luminance(fg) > .45
        : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (!bg) bg = dark ? {r: 24, g: 27, b: 33} : {r: 248, g: 249, b: 251};
    const ink = (fg && contrastRatio(fg, bg) >= 4.5) ? fg
        : dark ? {r: 236, g: 239, b: 244} : {r: 32, g: 38, b: 48};
    const white = {r:255,g:255,b:255}, black = {r:0,g:0,b:0};
    const lift = dark ? white : black;
    return {
        "--cc-bg": mixHex(bg, bg, 0),
        "--cc-text": mixHex(ink, ink, 0),
        "--cc-muted": mixHex(ink, bg, .37),
        "--cc-surface": mixHex(bg, lift, dark ? .075 : .025),
        "--cc-control": mixHex(bg, lift, dark ? .12 : .035),
        "--cc-hover": mixHex(bg, lift, dark ? .18 : .075),
        "--cc-border": mixHex(bg, ink, dark ? .24 : .19),
        "--cc-accent": dark ? "#8ab7ff" : "#2568bd",
        "--cc-accent-bg": dark ? "#243a56" : "#e2edfc",
        "--cc-accent-text": dark ? "#e7f0ff" : "#174b8b",
        "--cc-ok": dark ? "#75d7a5" : "#15754b",
        "--cc-bad": dark ? "#ff9298" : "#b52f3c",
        "--cc-warn": dark ? "#f2c477" : "#895800",
        "--cc-preview-outline": dark ? "#ffffff" : "#111111",
        "--cc-scheme": dark ? "dark" : "light",
        colorScheme: dark ? "dark" : "light",
    };
}


const UI_CSS = `
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number{display:flex;align-items:stretch;width:100%;min-width:0;height:34px;overflow:hidden;background:transparent}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-size-multiplier{border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>button{display:flex;align-items:center;justify-content:center;flex:0 0 24px;min-width:0;border:0;border-radius:0!important;background:transparent;color:var(--cc-muted);cursor:pointer;padding:0;user-select:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>button:hover:enabled{color:var(--cc-text);background:var(--cc-hover)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>button:disabled{opacity:.3;cursor:default}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>input{height:100%!important;min-height:0!important;width:0!important;flex:1;min-width:0;border:0!important;border-radius:0!important;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;padding:5px 1px;text-align:center;appearance:textfield;cursor:text;touch-action:none;outline:0!important;box-shadow:none!important}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>input::-webkit-inner-spin-button,:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>input::-webkit-outer-spin-button{appearance:none;margin:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-size-multiplier:focus-within{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-field-capsule:focus-within{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-field-capsule>.cc-drag-number{flex:1;border:0;border-radius:0;background:transparent}
.dsh-comfy-ui .cc-shift-controls{display:flex;align-items:center;gap:6px;min-width:0}.dsh-comfy-ui .cc-shift-controls>div{flex:1;min-width:0}.dsh-comfy-ui .cc-shift-controls>.cc-select-trigger,.dsh-comfy-ui .cc-shift-controls>div>.cc-select-trigger{width:100%;min-width:0!important}.dsh-comfy-ui .cc-shift-controls>input{flex:0 0 68px;width:68px!important}
.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]{grid-template-columns:repeat(6,minmax(0,1fr))}
.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>*{grid-column:span 2}
.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>.cc-field-select{grid-column:span 3}
@container(max-width:640px){.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>*{grid-column:auto}.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>:nth-child(3){grid-column:1/-1}}
.cc-model-profile-row{display:flex;align-items:end;gap:8px;flex-wrap:wrap}.cc-model-profile-row .cc-model-aux-field{flex:1 1 150px;min-width:0}.cc-model-lora-chip[data-paused="true"]{opacity:.65}.cc-model-negative-saved{font-size:11px;color:var(--cc-muted)}

.dsh-comfy-ui .cc-image-settings-host{width:100%;min-width:0;flex:0 0 auto;container-type:inline-size}
.dsh-comfy-ui .cc-image-settings{border:1px solid var(--cc-border);border-radius:10px;padding:10px 11px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);grid-template-rows:minmax(0,1fr) auto;gap:12px;width:100%;min-width:0;min-height:600px;height:660px;flex:0 0 auto;align-self:stretch;overflow:hidden}
.dsh-comfy-ui .cc-image-controls{display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;min-width:0;min-height:0;overflow:visible}
.dsh-comfy-ui .cc-image-basic{display:flex;flex-direction:column;gap:10px;min-width:0}
.dsh-comfy-ui .cc-image-advanced{min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:auto;scrollbar-gutter:stable;border-top:1px solid var(--cc-border);padding:10px 7px 4px 0}
.dsh-comfy-ui .cc-image-advanced>.cc-details{border:0;padding:0}
.dsh-comfy-ui .cc-image-controls-head,.dsh-comfy-ui .cc-image-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-comfy-ui .cc-image-controls-head strong,.dsh-comfy-ui .cc-image-preview-head strong{font-size:13px}
.dsh-comfy-ui .cc-image-controls :is(input[type=number],input[type=text],.cc-select-trigger){height:34px;min-height:34px;max-width:100%}
.dsh-comfy-ui .cc-image-upscale-options{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:8px;padding-top:10px;align-items:end}
.dsh-comfy-ui .cc-image-upscale-options>label{grid-column:1/-1}
.dsh-comfy-ui .cc-image-preview-hint{color:var(--cc-muted);font-size:11px;line-height:1.5;overflow-wrap:anywhere}
/* Keep image controls rounded even when the host resets native control radii. */
.dsh-comfy-ui .cc-image-settings :is(input[type=number],input[type=text],.cc-select-trigger,.cc-icon-button,.cc-save-row>button,.cc-image-actions>button,.cc-summary){border-radius:6px!important}
.dsh-comfy-ui .cc-image-settings{border-radius:10px!important}
.dsh-comfy-ui .cc-image-settings .cc-save-toggle{border-radius:7px!important}
.dsh-comfy-ui .cc-param-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start}
.dsh-comfy-ui .cc-param-wide{grid-column:1/-1;min-width:0}
.dsh-comfy-ui .cc-size-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px minmax(76px,.85fr);gap:7px;align-items:end}
.dsh-comfy-ui .cc-size-row input[type=number]{width:100%;min-width:0}
.dsh-comfy-ui .cc-size-row .cc-icon-button{height:34px;min-height:34px;width:32px;margin:0}
.dsh-comfy-ui .cc-compact-sampling{display:grid;grid-template-columns:minmax(55px,.62fr) minmax(55px,.62fr) minmax(0,1.45fr) minmax(0,1.45fr);gap:7px;align-items:end}
.dsh-comfy-ui .cc-compact-sampling input[type=number]{width:100%;min-width:0}
.dsh-comfy-ui .cc-compact-sampling .cc-field-select{min-width:0}
.dsh-comfy-ui .cc-save-row{display:flex;align-items:center;gap:8px;min-width:0}
.dsh-comfy-ui .cc-save-row input[type=text]{flex:1;min-width:0;width:auto}
.dsh-comfy-ui .cc-save-note{margin:0;padding:0;border:0;border-radius:0;background:transparent;font-size:10.5px;color:var(--cc-muted);line-height:1.5}
.dsh-comfy-ui .cc-save-toggle{width:100%;min-height:36px;display:flex;align-items:center;justify-content:flex-start;gap:8px;min-width:0;padding:8px 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);font-size:12px;cursor:pointer}
.dsh-comfy-ui .cc-save-toggle .cc-switch-track{position:relative;display:inline-block;width:33px;height:19px;border-radius:99px;background:var(--cc-border);flex:none;transition:background .15s}
.dsh-comfy-ui .cc-save-toggle .cc-switch-track:after{content:"";position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:var(--cc-text);transition:transform .15s}
.dsh-comfy-ui .cc-save-toggle[aria-checked=true] .cc-switch-track{background:var(--cc-accent)}
.dsh-comfy-ui .cc-save-toggle[aria-checked=true] .cc-switch-track:after{transform:translateX(14px);background:var(--cc-surface)}
.dsh-comfy-ui .cc-image-actions{grid-column:1/-1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 -11px -10px;padding:10px 11px;border-top:1px solid var(--cc-border);border-radius:0 0 9px 9px!important;background:var(--cc-surface);min-width:0}
.dsh-comfy-ui .cc-image-preview-panel{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;min-width:0;min-height:0;overflow:hidden}
.dsh-comfy-ui .cc-image-preview-stage{min-width:0;min-height:0;width:100%;height:100%;container-type:size;display:flex;align-items:center;justify-content:center}
.dsh-comfy-ui .cc-main-preview{position:relative;width:min(100%,100cqh,900px);aspect-ratio:1/1;flex:none;border:0;border-radius:0;background:transparent;overflow:visible}
.dsh-comfy-ui .cc-preview-image-rect,.dsh-comfy-ui .cc-latent-frame{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);transition:width .16s ease,height .16s ease}.dsh-comfy-ui .cc-preview-image-rect{overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.12)}.dsh-comfy-ui .cc-preview-image-rect img{width:100%;height:100%;object-fit:contain;display:block}.dsh-comfy-ui .cc-latent-frame{border:2px solid var(--cc-preview-outline,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.18),0 0 6px rgba(255,255,255,.2);pointer-events:none}.dsh-comfy-ui .cc-preview-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--cc-muted);font-size:11px}

@media(max-width:760px){.dsh-comfy-ui .cc-image-settings{height:auto;min-height:0;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;overflow:visible}.dsh-comfy-ui .cc-image-controls{grid-template-rows:auto 200px}.dsh-comfy-ui .cc-image-preview-panel{min-height:0;grid-template-rows:auto minmax(0,1fr)}.dsh-comfy-ui .cc-image-preview-stage{width:min(100%,900px);height:auto;aspect-ratio:1;place-self:center}.dsh-comfy-ui .cc-image-actions{grid-column:1}}
@container (max-width:800px){.dsh-comfy-ui .cc-image-settings{height:auto;min-height:0;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;overflow:visible}.dsh-comfy-ui .cc-image-controls{grid-template-rows:auto 200px}.dsh-comfy-ui .cc-image-preview-panel{min-height:0;grid-template-rows:auto minmax(0,1fr)}.dsh-comfy-ui .cc-image-preview-stage{width:min(100%,900px);height:auto;aspect-ratio:1;place-self:center}.dsh-comfy-ui .cc-image-actions{grid-column:1}}
@container (max-width:640px){.dsh-comfy-ui .cc-compact-sampling{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:360px){.dsh-comfy-ui .cc-size-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px minmax(60px,.85fr);gap:5px}.dsh-comfy-ui .cc-image-advanced{padding-right:2px;scrollbar-gutter:auto}.dsh-comfy-ui .cc-image-upscale-options{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-ui .cc-task-summary{position:relative;display:flex;align-items:center;gap:7px;padding:4px 7px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font-size:11px;cursor:default}.dsh-comfy-ui .cc-task-dot{width:7px;height:7px;border-radius:50%;background:var(--cc-muted)}.dsh-comfy-ui .cc-task-summary[data-active=true] .cc-task-dot{background:var(--cc-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--cc-accent) 18%,transparent)}.dsh-comfy-ui .cc-task-popover{display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:2147470000;width:min(460px,calc(100vw - 28px));max-height:430px;overflow:auto;padding:8px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-surface);box-shadow:0 14px 38px rgba(0,0,0,.36)}.dsh-comfy-ui .cc-task-summary:hover .cc-task-popover,.dsh-comfy-ui .cc-task-summary:focus-within .cc-task-popover{display:flex;flex-direction:column;gap:5px}.dsh-comfy-ui .cc-task-row{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:7px;align-items:center;width:100%;padding:7px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--cc-text);font:inherit;text-align:left;cursor:pointer}.dsh-comfy-ui .cc-task-row:hover{background:var(--cc-hover)!important}.dsh-comfy-ui .cc-task-row small{color:var(--cc-muted);font-size:9px}.dsh-comfy-ui .cc-progress-indeterminate{height:3px;border-radius:99px;background:var(--cc-border);overflow:hidden;margin-top:4px}.dsh-comfy-ui .cc-progress-indeterminate:after{content:"";display:block;width:35%;height:100%;background:var(--cc-accent);animation:cc-task-slide 1.1s ease-in-out infinite}@keyframes cc-task-slide{0%{transform:translateX(-120%)}100%{transform:translateX(330%)}}
/* Output browser styles are defined in the v0.6.11 block below. */
.dsh-comfy-ui,.dsh-comfy-floating{color:var(--cc-text);font-family:inherit;color-scheme:var(--cc-scheme)}
.dsh-comfy-ui *, .dsh-comfy-floating *{box-sizing:border-box}
.dsh-comfy-ui button,.dsh-comfy-floating button,.dsh-comfy-ui input,.dsh-comfy-floating input,
.dsh-comfy-ui textarea,.dsh-comfy-floating textarea{font-family:inherit}
.dsh-comfy-ui button,.dsh-comfy-floating button{transition:background-color .12s ease,border-color .12s ease;}
.dsh-comfy-ui button:hover:not(:disabled),.dsh-comfy-floating button:hover:not(:disabled){background:var(--cc-hover)!important}
/* Scope pointer/keyboard focus explicitly; host/UA focus must not paint a white ring. */
.dsh-comfy-ui button:is(:hover,:focus,:active),
.dsh-comfy-floating button:is(:hover,:focus,:active){border-color:var(--cc-button-border,var(--cc-border))!important;box-shadow:none!important}
.dsh-comfy-ui :is(button,input,textarea,summary):focus:not(:focus-visible),
.dsh-comfy-floating :is(button,input,textarea,summary):focus:not(:focus-visible){outline:none!important;box-shadow:none!important}
.dsh-comfy-ui :is(button,input,textarea,summary):focus,
.dsh-comfy-floating :is(button,input,textarea,summary):focus{outline-color:var(--cc-accent)!important;box-shadow:none!important}

.dsh-comfy-ui button:disabled,.dsh-comfy-floating button:disabled{opacity:.42;cursor:not-allowed!important}
.dsh-comfy-ui :is(button,input,textarea,summary):focus-visible,
.dsh-comfy-floating :is(button,input,textarea,summary):focus-visible,
.dsh-comfy-floating [role="option"]:focus-visible{outline:2px solid var(--cc-accent)!important;outline-offset:2px}
.dsh-comfy-ui input::placeholder,.dsh-comfy-floating input::placeholder,
.dsh-comfy-ui textarea::placeholder,.dsh-comfy-floating textarea::placeholder{color:var(--cc-muted);opacity:1}
.dsh-comfy-ui input[type="checkbox"],.dsh-comfy-floating input[type="checkbox"]{accent-color:var(--cc-accent);cursor:pointer}
.dsh-comfy-ui input[type="number"],.dsh-comfy-floating input[type="number"]{min-width:0}
.dsh-comfy-ui :is(input,textarea):hover:not(:disabled),.dsh-comfy-floating :is(input,textarea):hover:not(:disabled){border-color:var(--cc-muted)!important}
.dsh-comfy-ui :is(input,textarea):focus,.dsh-comfy-floating :is(input,textarea):focus{border-color:var(--cc-accent)!important}
.dsh-comfy-ui .cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;
 width:100%;min-height:34px;min-width:0;max-width:100%;text-align:left;white-space:nowrap;}
.dsh-comfy-ui .cc-select-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.dsh-comfy-ui .cc-select-caret{flex:none;opacity:.75;font-size:11px;transition:transform .12s ease}
.dsh-comfy-ui .cc-select-trigger[aria-expanded="true"] .cc-select-caret{transform:rotate(180deg)}
.dsh-comfy-floating.cc-select-popup{display:flex;flex-direction:column;overflow:hidden;
 background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px!important;
 box-shadow:0 14px 42px rgba(0,0,0,.32);padding:5px;}
.dsh-comfy-floating .cc-option-list{min-height:0;overflow:auto;overscroll-behavior:contain;padding:2px;}
.dsh-comfy-floating .cc-option{display:block;width:100%;padding:8px 10px;border:0;border-radius:5px!important;
 background:transparent;color:var(--cc-text);font-size:12.5px;text-align:left;cursor:pointer;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:32px;}
.dsh-comfy-floating .cc-option[aria-selected="true"]{background:var(--cc-accent-bg);color:var(--cc-accent-text);}
.dsh-comfy-floating .cc-option[data-active="true"]{outline:1px solid var(--cc-accent);outline-offset:-1px}
.dsh-comfy-floating .cc-option:hover{background:var(--cc-hover)!important}
.dsh-comfy-floating .cc-select-search{flex:none;width:100%;min-width:0;padding:8px 9px;margin-bottom:4px;
 background:var(--cc-control);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:6px!important;font-size:12.5px;}
.dsh-comfy-ui .cc-details,.dsh-comfy-floating .cc-details{border-top:1px solid var(--cc-border);padding-top:10px;min-width:0}
.dsh-comfy-ui .cc-summary,.dsh-comfy-floating .cc-summary{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;
 cursor:pointer;list-style:none;color:var(--cc-text);background:var(--cc-control)}
.dsh-comfy-ui .cc-summary::-webkit-details-marker,.dsh-comfy-floating .cc-summary::-webkit-details-marker{display:none}
.dsh-comfy-ui .cc-summary::before,.dsh-comfy-floating .cc-summary::before{content:"›";display:inline-block;font-size:17px;line-height:1;
 transform:rotate(0);transition:transform .12s ease;color:var(--cc-muted)}
.dsh-comfy-ui details[open]>.cc-summary::before,.dsh-comfy-floating details[open]>.cc-summary::before{transform:rotate(90deg)}
.dsh-comfy-ui .cc-summary:hover,.dsh-comfy-floating .cc-summary:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-tab{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--cc-muted)}
.dsh-comfy-ui .cc-tab[aria-selected="true"]{border-bottom-color:var(--cc-accent);color:var(--cc-text)}
.dsh-comfy-ui .cc-tab{border:0;border-radius:0;font-family:inherit;background:transparent}
.dsh-comfy-ui .cc-tab:hover{color:var(--cc-text);background:var(--cc-hover)!important}
.dsh-comfy-ui,.dsh-comfy-ui *, .dsh-comfy-floating,.dsh-comfy-floating *{scrollbar-width:thin;scrollbar-color:var(--cc-border) transparent}
.dsh-comfy-ui ::-webkit-scrollbar,.dsh-comfy-floating ::-webkit-scrollbar{width:8px;height:8px}
.dsh-comfy-ui ::-webkit-scrollbar-thumb,.dsh-comfy-floating ::-webkit-scrollbar-thumb{background:var(--cc-border);border-radius:10px}
.dsh-comfy-ui ::-webkit-scrollbar-track,.dsh-comfy-floating ::-webkit-scrollbar-track{background:transparent}
/* 工具提示跟随 DSH 主题变量；禁用系统原生 title 浮窗。 */
.dsh-comfy-ui .cc-icon-button{position:relative;display:inline-flex;align-items:center;justify-content:center;
 width:32px;height:32px;padding:0;border-radius:7px;flex:none;}
.dsh-comfy-ui .cc-icon-button[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;
 bottom:calc(100% + 9px);left:50%;transform:translate(-50%,3px);opacity:0;pointer-events:none;
 z-index:60;white-space:nowrap;padding:6px 9px;border:1px solid var(--cc-border);
 background:var(--cc-surface);color:var(--cc-text);box-shadow:0 6px 18px rgba(0,0,0,.3);
 font-size:12px;line-height:1.35;border-radius:6px;transition:opacity .12s ease,transform .12s ease;}
.dsh-comfy-ui .cc-icon-button[data-cc-tooltip]:is(:hover,:focus-visible)::after{opacity:1;transform:translate(-50%,0)}
.dsh-comfy-ui .cc-icon-button:disabled::after{display:none}
.dsh-comfy-ui .cc-icon-button[aria-disabled="true"]{opacity:.42;cursor:default}
.dsh-comfy-ui .cc-icon-button.cc-tooltip-right::after{left:auto;right:0;transform:translateY(3px)}
.dsh-comfy-ui .cc-icon-button.cc-tooltip-right:is(:hover,:focus-visible)::after{transform:translateY(0)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-expand-btn,.cc-task-cancel-icon) .cc-icon-stop{display:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-expand-btn,.cc-task-cancel-icon):not(:disabled):is(:hover,:focus-visible) .cc-icon-spinner{display:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-expand-btn,.cc-task-cancel-icon):not(:disabled):is(:hover,:focus-visible) .cc-icon-stop{display:inline-flex}
/* Portal dialogs are siblings of the console, so shared task styles cover both roots. */
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-icon-spinner,.cc-icon-stop){align-items:center;justify-content:center;flex:none;line-height:1;vertical-align:middle}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-icon-spinner{display:inline-flex;transform-origin:center;animation:cc-spin 1s linear infinite}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-icon-spinner>svg{display:block;flex:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-action{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;max-width:100%;vertical-align:middle}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-action>button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;min-width:0;max-width:100%;width:auto;margin:0;line-height:1.4}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-primary{flex:0 1 auto;text-align:left}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-label{min-width:0;overflow-wrap:anywhere}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-primary:disabled[aria-busy="true"]{opacity:1;cursor:progress!important;color:var(--cc-muted)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-stop{flex:none;white-space:nowrap}

@keyframes cc-spin{to{transform:rotate(360deg)}}
.dsh-comfy-ui .cc-prompt-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:stretch}
.dsh-comfy-ui .cc-prompt-layout--chat{grid-template-columns:minmax(0,7fr) minmax(235px,3fr)}
.dsh-comfy-ui .cc-prompt-card{min-width:0}
.dsh-comfy-ui .cc-preview-tags{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;min-height:100px;padding:9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control)}
.dsh-comfy-ui .cc-prompt-preview-surface{overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;white-space:normal}
.dsh-comfy-ui .cc-prompt-preview-surface .cc-preview-tags{min-height:0;padding:0;border:0;border-radius:0;background:transparent}
.dsh-comfy-ui .cc-preview-chip{display:inline-flex;align-items:center;max-width:100%;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:6px;color:var(--cc-text);font-size:13px}
.dsh-comfy-ui .cc-preview-chip-text{padding:5px 7px;overflow-wrap:anywhere;white-space:pre-wrap;cursor:ew-resize;user-select:none;touch-action:pan-y;min-width:0}
.dsh-comfy-ui .cc-preview-chip-text[aria-disabled="true"]{cursor:default}
.dsh-comfy-ui .cc-preview-chip-text:focus-visible{outline:2px solid var(--cc-accent);outline-offset:1px}
.dsh-comfy-ui .cc-preview-chip small{color:var(--cc-muted);font-variant-numeric:tabular-nums}
.dsh-comfy-ui .cc-chip-remove{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:4px;margin:0 3px 0 0;width:22px;height:24px;border:0;border-radius:4px;background:transparent;color:var(--cc-muted);cursor:pointer}
.dsh-comfy-ui .cc-chip-remove:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-prompt-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-comfy-ui .cc-prompt-input-shell{display:flex;flex-direction:column;min-width:0}
.dsh-comfy-ui .cc-prompt-textarea{min-height:90px;max-width:100%;resize:none!important;border-radius:6px 6px 0 0!important;margin:0;display:block}
.dsh-comfy-ui .cc-prompt-resize-handle{height:19px;min-height:19px;margin-top:-1px;border:1px solid var(--cc-border);
 border-radius:0 0 6px 6px;background:var(--cc-control);color:var(--cc-muted);display:flex;align-items:center;justify-content:center;
 cursor:ns-resize;touch-action:none;user-select:none;outline:none;transition:background .12s ease,color .12s ease,border-color .12s ease}
.dsh-comfy-ui .cc-prompt-resize-handle:hover,.dsh-comfy-ui .cc-prompt-resize-handle:focus-visible,
.dsh-comfy-ui .cc-prompt-resize-handle[data-dragging="true"]{background:var(--cc-hover);color:var(--cc-text);border-color:var(--cc-accent)}
.dsh-comfy-ui .cc-prompt-resize-handle .cc-resize-arrows{display:none}
.dsh-comfy-ui .cc-prompt-resize-handle:is(:hover,:focus-visible)[data-dragging="false"] .cc-resize-grip{display:none}
.dsh-comfy-ui .cc-prompt-resize-handle:is(:hover,:focus-visible)[data-dragging="false"] .cc-resize-arrows{display:inline-flex}
.dsh-comfy-ui .cc-prompt-resize-handle[data-dragging="true"] .cc-resize-grip{display:none}
.dsh-comfy-ui .cc-prompt-resize-handle[data-dragging="true"] .cc-resize-arrows{display:inline-flex}
.dsh-comfy-ui .cc-resize-grip,.dsh-comfy-ui .cc-resize-arrows{align-items:center;justify-content:center;pointer-events:none}
.dsh-comfy-ui .cc-prompt-layout--chat{align-items:stretch}
.dsh-comfy-ui .cc-chat-panel{min-width:0;min-height:0;height:100%;max-height:none;overflow:hidden}
.dsh-comfy-ui .cc-chat-history{flex:1 1 auto;min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain}
@media(max-width:850px){.dsh-comfy-ui .cc-prompt-layout--chat{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.dsh-comfy-ui *, .dsh-comfy-floating *{transition:none!important;animation:none!important}}
@media(max-width:640px){.dsh-comfy-ui .cc-field-select{flex:1 1 140px;min-width:0}}

.dsh-comfy-floating.cc-tag-completion {overflow-y:auto;overscroll-behavior:contain;background:var(--cc-surface);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:6px;box-shadow:0 6px 22px rgba(0,0,0,.22);padding:4px;box-sizing:border-box}
.dsh-comfy-floating .cc-tag-option {display:flex;flex-direction:column;gap:3px;width:100%;padding:7px 9px;text-align:left;border:0;border-radius:4px;background:transparent;color:var(--cc-text);font:inherit;cursor:pointer;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-tag-option[data-active="true"] {background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-tag-option small {font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-tag-heading,.dsh-comfy-ui .cc-dict-name {display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.dsh-comfy-floating .cc-tag-output,.dsh-comfy-ui .cc-tag-output {font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap}
.dsh-comfy-ui .cc-dictionary{display:flex;flex-direction:column;gap:10px;min-width:0;container-type:inline-size}
.dsh-comfy-ui .cc-dict-toolbar,.dsh-comfy-floating .cc-dict-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:7px;min-width:0}
.dsh-comfy-ui .cc-dict-toolbar>button,.dsh-comfy-floating .cc-dict-toolbar>button,.dsh-comfy-ui .cc-dict-actions>button{width:auto;flex:0 0 auto;white-space:nowrap}
.dsh-comfy-ui .cc-dict-toolbar>.cc-select-trigger,.dsh-comfy-floating .cc-dict-toolbar>.cc-select-trigger{width:auto;flex:0 1 200px;min-width:0!important}
.dsh-comfy-ui .cc-dict-header-main,.dsh-comfy-ui .cc-dict-header-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
.dsh-comfy-ui .cc-dict-header-actions{margin-left:auto}
.dsh-comfy-ui .cc-dict-header-actions>button{width:auto;flex:none;white-space:nowrap}
.dsh-comfy-ui .cc-dict-target{display:inline-flex;gap:3px;margin-left:7px}
.dsh-comfy-ui .cc-dict-target button{width:auto;white-space:nowrap}
.dsh-comfy-ui .cc-dict-target [aria-pressed="true"]{--cc-button-border:var(--cc-accent);background:var(--cc-accent-bg)!important;border-color:var(--cc-accent)!important}
.dsh-comfy-ui .cc-dict-convert{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px 12px;padding:10px 0;border-top:1px solid var(--cc-border);border-bottom:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-convert .cc-dict-toolbar>input{width:100%;min-width:100px;flex:1 1 160px!important}
.dsh-comfy-ui .cc-dict-translation{grid-column:1/-1;display:flex;flex-direction:column;gap:6px;font-size:13px}
.dsh-comfy-ui .cc-dict-filterbar{display:grid;grid-template-columns:minmax(140px,1fr) minmax(130px,200px) auto;gap:8px;align-items:center;min-width:0}
.dsh-comfy-ui .cc-dict-filterbar>input,.dsh-comfy-ui .cc-dict-filterbar>.cc-select-trigger{width:100%;min-width:0!important}
.dsh-comfy-ui .cc-dict-check,.dsh-comfy-floating .cc-dict-check{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-size:12px;color:var(--cc-muted);width:auto}
.dsh-comfy-ui .cc-dict-results{display:grid;grid-template-columns:minmax(0,1fr);gap:0 18px;align-content:start;max-height:500px;overflow-y:auto;min-width:0;scrollbar-gutter:stable}
.dsh-comfy-ui .cc-dict-row{display:flex;gap:8px;align-items:center;min-width:0;padding:6px 0;border-bottom:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-insert{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;text-align:left;background:transparent;color:var(--cc-text);border:0;border-radius:6px!important;cursor:pointer;padding:4px 6px;font:inherit}
.dsh-comfy-ui .cc-dict-insert:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-dict-primary,.dsh-comfy-ui .cc-dict-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;overflow-wrap:anywhere}
.dsh-comfy-ui .cc-dict-primary .cc-dict-name{display:inline-flex;gap:6px;justify-content:flex-start;font-size:13px}
.dsh-comfy-ui .cc-dict-primary>.cc-tag-output{color:var(--cc-muted)}
.dsh-comfy-ui .cc-dict-meta small{font-size:11px!important;line-height:1.4}
.dsh-comfy-ui .cc-dict-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;flex:0 0 auto;max-width:176px}
.dsh-comfy-ui .cc-dict-actions>button{padding:4px 7px!important;font-size:11px!important}
.dsh-comfy-floating .cc-dict-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}
.dsh-comfy-floating .cc-dict-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-comfy-floating .cc-dict-field>input{width:100%!important;min-width:0;max-width:100%}
.dsh-comfy-floating .cc-dict-options{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px}
.dsh-comfy-floating .cc-dict-options>.cc-select-trigger{width:auto;flex:1 1 160px;min-width:0!important}
.dsh-comfy-floating .cc-dict-json-import{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;font-size:12px}
.dsh-comfy-floating .cc-dict-json-import input{width:190px;max-width:100%;min-width:0}
.dsh-comfy-ui .cc-dictionary :is(input:not([type=checkbox]),.cc-select-trigger),.dsh-comfy-floating .cc-dict-field>input:not([type=file]){border-radius:6px!important}
.dsh-comfy-floating .cc-dict-db-path{display:block;overflow-wrap:anywhere;font-size:11px;color:var(--cc-muted);margin-top:4px}
@container (min-width:960px){.dsh-comfy-ui .cc-dict-results{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:600px){.dsh-comfy-ui .cc-dict-convert{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-filterbar{grid-template-columns:minmax(0,1fr) auto}.dsh-comfy-ui .cc-dict-filterbar>input{grid-column:1/-1}.dsh-comfy-ui .cc-dict-header-actions{margin-left:0}}
@container (max-width:400px){.dsh-comfy-ui .cc-dict-row{align-items:stretch;flex-direction:column}.dsh-comfy-ui .cc-dict-actions{max-width:none;justify-content:flex-start}}
@media(max-width:520px){.dsh-comfy-floating .cc-dict-form{grid-template-columns:minmax(0,1fr)}}

.dsh-comfy-ui .cc-dict-maintenance{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,1fr);gap:18px;align-items:start;min-width:0}
.dsh-comfy-ui .cc-dict-list-pane,.dsh-comfy-ui .cc-dict-edit-pane{display:flex;flex-direction:column;gap:12px;min-width:0}
.dsh-comfy-ui .cc-dict-edit-pane{padding-left:18px;border-left:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-filterbar{grid-template-columns:minmax(100px,1fr) minmax(100px,150px)}
.dsh-comfy-ui .cc-dict-results{display:flex;flex-direction:column;max-height:none;overflow:visible}
.dsh-comfy-ui .cc-dict-table-head,.dsh-comfy-ui .cc-dict-tag-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(50px,.6fr);gap:10px;padding:10px 8px;align-items:center;text-align:left;overflow-wrap:anywhere}
.dsh-comfy-ui .cc-dict-table-head{font-size:12px;color:var(--cc-muted);border-bottom:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-tag-row{font:inherit;color:var(--cc-text);background:transparent;border:0;border-bottom:1px solid var(--cc-border);border-radius:5px;cursor:pointer;width:100%}
.dsh-comfy-ui .cc-dict-tag-row:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-dict-tag-row[aria-pressed=true]{background:var(--cc-accent-bg)}
.dsh-comfy-ui .cc-dict-tag-row small{color:var(--cc-muted)}
.dsh-comfy-ui .cc-dict-pagination>small{margin-right:auto}
.dsh-comfy-ui .cc-dict-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.dsh-comfy-ui .cc-dict-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-comfy-ui .cc-dict-field input{width:100%;min-width:0}
.dsh-comfy-ui .cc-dict-empty{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:18px 0}
.dsh-comfy-ui .cc-dict-edit-actions,.dsh-comfy-floating .cc-dict-edit-actions{justify-content:flex-end;padding-top:12px;border-top:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-duplicates,.dsh-comfy-floating .cc-dict-duplicates{display:flex;flex-direction:column;gap:10px;padding:12px 0;overflow-wrap:anywhere}
@container(max-width:760px){.dsh-comfy-ui .cc-dict-maintenance{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-edit-pane{padding:14px 0 0;border-left:0;border-top:1px solid var(--cc-border)}}
@container(max-width:400px){.dsh-comfy-ui .cc-dict-form{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-filterbar{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-table-head,.dsh-comfy-ui .cc-dict-tag-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dsh-comfy-ui .cc-dict-table-head>span:last-child,.dsh-comfy-ui .cc-dict-tag-row>small{display:none}}
.dsh-comfy-ui .cc-model-dock{border:1px solid var(--cc-border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:10px;min-width:0;container-type:inline-size;background:var(--cc-surface)}
.dsh-comfy-ui .cc-model-dock-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px;min-width:0}
.dsh-comfy-ui .cc-model-base-button{display:flex;align-items:flex-start;gap:9px;min-width:0;padding:7px 9px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);cursor:pointer;text-align:left;font:inherit}
.dsh-comfy-ui .cc-model-base-button:hover{border-color:var(--cc-accent);background:var(--cc-hover)}
.dsh-comfy-ui .cc-model-base-text{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;align-self:flex-start}.dsh-comfy-ui .cc-model-base-text strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-comfy-ui .cc-model-base-text small{font-size:10px;color:var(--cc-muted);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-ui .cc-model-main-art{display:flex;flex-direction:column;gap:5px;flex:0 0 76px;min-width:0}
.dsh-comfy-ui .cc-model-dock-art{display:flex;align-items:center;justify-content:center;background:var(--cc-surface);color:var(--cc-muted);border-radius:5px;overflow:hidden;flex:none}
.dsh-comfy-ui .cc-model-dock-art--main{width:76px;height:100px}.dsh-comfy-ui .cc-model-dock-art--lora{width:126px;height:84px;aspect-ratio:3/2}
.dsh-comfy-ui .cc-model-dock-art>img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.dsh-comfy-ui .cc-model-profile-panel{display:flex;flex-direction:column;gap:4px;border:1px solid var(--cc-border);border-radius:7px;padding:7px 9px;min-width:0}
.dsh-comfy-ui .cc-model-profile-panel p{margin:0;font-size:10px;line-height:1.4;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-ui .cc-model-recommendation{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap;font-size:11px;line-height:1.5;color:var(--cc-muted)}
.dsh-comfy-ui .cc-model-recommendation>button{font-size:10px;padding:4px 7px;min-height:26px;flex:none}
.dsh-comfy-ui .cc-model-recommendation>div{display:flex;flex-direction:column;gap:2px;font-size:10px;min-width:0}
.dsh-comfy-ui .cc-model-components{display:flex;flex-wrap:wrap;align-items:flex-start;gap:9px;min-width:0;padding:9px;border:1px solid var(--cc-border);border-radius:8px;overflow:visible}
.dsh-comfy-ui .cc-model-add-component{display:flex;align-items:center;justify-content:center;width:62px;flex:0 0 62px;height:104px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);cursor:pointer}
.dsh-comfy-ui .cc-model-add-component:hover{border-color:var(--cc-accent);background:var(--cc-hover)}
.dsh-comfy-ui .cc-model-component{position:relative;display:flex;flex-direction:column;justify-content:center;gap:6px;flex:0 1 300px;width:300px;padding:9px;max-width:100%;min-height:104px;border:1px solid var(--cc-border);border-radius:7px;min-width:165px;background:var(--cc-control)}
.dsh-comfy-ui .cc-model-component>strong{font-size:10px;color:var(--cc-muted)}.dsh-comfy-ui .cc-model-encoder-fields{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}.dsh-comfy-ui .cc-model-encoder-fields>div{width:164px;max-width:100%;flex:1 1 150px}
.dsh-comfy-ui .cc-model-component-remove{position:absolute;top:3px;right:3px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:var(--cc-surface);color:var(--cc-muted);cursor:pointer;padding:0!important}
.dsh-comfy-ui .cc-model-component-remove:hover{background:var(--cc-hover);color:var(--cc-text)}

.dsh-comfy-ui .cc-model-component-hint{align-self:center;color:var(--cc-muted);font-size:11px;line-height:1.5;min-width:160px}
.dsh-comfy-ui .cc-model-lora-chip{position:relative;display:grid;grid-template-columns:126px minmax(0,1fr);align-items:center;gap:10px;flex:0 1 300px;max-width:100%;min-width:0;padding:9px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font-size:11px}
.dsh-comfy-ui .cc-model-lora-open{border:0;background:transparent;color:var(--cc-text);padding:0;text-align:left;cursor:pointer;min-width:0}
.dsh-comfy-ui .cc-model-lora-controls{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;padding-right:9px}
.dsh-comfy-ui .cc-model-lora-controls>strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-ui .cc-model-lora-controls>.cc-select-trigger{min-width:0!important;width:100%;min-height:25px;height:25px;padding:2px 6px;font-size:10px}
.dsh-comfy-ui .cc-model-lora-controls>label{display:flex;gap:5px;align-items:center;color:var(--cc-muted);font-size:10px}
.dsh-comfy-ui .cc-model-lora-controls input{width:0;flex:1;min-width:0;border:1px solid var(--cc-border);border-radius:4px;background:var(--cc-surface);color:var(--cc-text);font:inherit;padding:3px 4px;height:25px}
.dsh-comfy-ui .cc-model-aux{display:flex;align-items:end;flex-wrap:wrap;gap:8px;min-width:0}.dsh-comfy-ui .cc-model-aux>.cc-model-aux-field{flex:0 1 170px}
.dsh-comfy-ui .cc-model-aux-field{display:flex;flex-direction:column;gap:4px;min-width:0}.dsh-comfy-ui .cc-model-aux-field>span{font-size:10px;color:var(--cc-muted)}.dsh-comfy-ui .cc-model-aux-field>.cc-select-trigger{min-width:0!important;max-width:100%;width:100%}

.dsh-comfy-ui .cc-generation-controls-summary{display:flex;align-items:center;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-generation-controls-dialog>div:nth-child(2),.dsh-comfy-floating .cc-post-dialog>div:nth-child(2){gap:10px!important;padding-top:14px!important}
.dsh-comfy-floating .cc-field-capsule{display:flex;align-items:stretch;gap:0;height:34px;min-width:0;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);font-size:11px}
.dsh-comfy-floating .cc-field-capsule>span:first-child{display:flex;align-items:center;padding:0 12px;border-right:1px solid var(--cc-border);color:var(--cc-muted);white-space:nowrap;flex:none}
.dsh-comfy-floating .cc-field-capsule>.cc-select-trigger{display:flex;align-items:center;justify-content:space-between;flex:1;min-width:0!important;height:32px;border:0!important;border-radius:0!important;background:transparent!important;padding:0 9px!important;font-size:12px!important}
.dsh-comfy-floating .cc-generation-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0;min-width:0}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux{display:flex;align-items:center;flex-wrap:wrap;gap:8px;flex:1;min-width:0;padding:0;border:0}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux-field{flex:0 0 auto;font-size:11px}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux-field>.cc-select-trigger{min-width:130px!important}
.dsh-comfy-floating .cc-generation-controls{height:min(736px,calc(100dvh - 168px));display:grid;grid-template-columns:minmax(230px,29fr) minmax(0,71fr);gap:0;min-height:0}
.dsh-comfy-floating .cc-control-catalog,.dsh-comfy-floating .cc-control-workspace{border:0;border-radius:0;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;background:transparent}
.dsh-comfy-floating .cc-control-catalog{display:flex;flex-direction:column;gap:2px;padding:6px 12px 6px 0;border-right:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-control-workspace{padding:10px 10px 0 14px}
.dsh-comfy-floating .cc-control-catalog>strong{font-size:12px;padding:8px 7px 6px;margin:0}
.dsh-comfy-floating .cc-control-category{font-size:11px;color:var(--cc-muted);padding:10px 7px 4px}
.dsh-comfy-floating .cc-control-add-row{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:8px;width:100%;min-height:36px;padding:7px;border:0;border-radius:5px;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;cursor:pointer;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-control-add-row small{font-size:10px;flex:none;color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-add-row:hover:enabled{background:var(--cc-hover)}
.dsh-comfy-floating .cc-control-add-row:disabled{opacity:.5;cursor:default}
.dsh-comfy-floating .cc-control-add-row.is-primary{color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-control-heading{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;padding-bottom:12px}
.dsh-comfy-floating .cc-control-heading>span{font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-grid{display:flex;flex-wrap:wrap;align-items:flex-start;align-content:flex-start;gap:8px;padding:0;min-width:0}
.dsh-comfy-floating .cc-control-tile{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:8px;flex:0 0 176px;max-width:190px;min-width:0;height:144px;min-height:144px;max-height:144px;padding:11px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);box-shadow:none;box-sizing:border-box}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"]{display:grid;grid-template-columns:92px minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:"art info" "art settings";gap:7px 8px;flex:0 0 276px;max-width:276px;height:144px;min-height:144px;max-height:144px}
.dsh-comfy-floating .cc-control-file{display:grid;grid-template-columns:84px minmax(0,1fr);align-items:start;gap:10px;min-width:0;background:transparent;border:0;color:var(--cc-text);padding:0;text-align:left;cursor:pointer;font:inherit}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-control-file,.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-control-file{display:contents}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-model-dock-art,.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-model-dock-art{grid-area:art;align-self:stretch;width:92px;height:100%;min-height:96px}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-control-file>span:not(.cc-model-dock-art),.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-control-file>span:not(.cc-model-dock-art){grid-area:info;align-self:start}
.dsh-comfy-floating .cc-control-direct{display:flex;flex-direction:column;gap:8px;min-width:0;height:100%;justify-content:flex-start}
.dsh-comfy-floating .cc-control-direct>strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-control-direct>.cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0!important;height:56px!important;min-height:56px;border:1px solid var(--cc-border)!important;border-radius:6px!important;background:var(--cc-surface)!important;padding:6px 9px!important;white-space:normal;overflow:hidden}
.dsh-comfy-floating .cc-control-direct .cc-select-label{display:-webkit-box;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:normal;overflow-wrap:anywhere;line-height:1.35;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.dsh-comfy-floating .cc-control-direct .cc-select-caret{flex:none;align-self:center}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-control-file,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-control-file{display:flex;flex-direction:column;align-items:stretch;gap:6px;min-height:0;padding:0;border:0;background:transparent}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-model-dock-art,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-model-dock-art{display:none}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-control-file>span,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-control-file>span{gap:5px}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-control-file span>span,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-control-file span>span{border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-surface);padding:6px 7px;min-height:30px;display:flex;align-items:center}
.dsh-comfy-floating .cc-control-file>span{display:flex;flex-direction:column;gap:4px;min-width:0}
.dsh-comfy-floating .cc-control-file strong{font-size:12px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-control-file span>span{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-control-file small{font-size:10px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-file .cc-model-dock-art{width:84px;height:84px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:5px;overflow:hidden;background:var(--cc-surface);color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-file .cc-model-dock-art img{width:100%;height:100%;object-fit:cover;object-position:center}
.dsh-comfy-floating .cc-control-lora-settings .cc-field-capsule>span:first-child{padding:0 8px;font-size:10px}
.dsh-comfy-floating .cc-control-lora-settings .cc-drag-number>button{flex-basis:22px}
.dsh-comfy-floating .cc-control-lora-settings{display:flex;flex-direction:column;grid-area:settings;align-self:end;gap:6px;width:100%;min-width:0}
.dsh-comfy-floating .cc-control-pill{width:100%;overflow:hidden}
.dsh-comfy-floating .cc-control-pill-label{color:var(--cc-text)}
.dsh-comfy-floating .cc-control-remove{position:absolute!important;right:-8px!important;top:-8px!important;width:20px!important;height:20px!important;border:1px solid var(--cc-border)!important;border-radius:50%!important;background:var(--cc-surface)!important;color:var(--cc-muted);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;z-index:3}
.dsh-comfy-floating .cc-control-remove:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-floating .cc-control-empty{display:flex;align-items:center;justify-content:center;min-height:180px;width:100%;font-size:12px;color:var(--cc-muted);line-height:1.8;text-align:center;padding:12px}
.dsh-comfy-floating .cc-control-workspace .cc-model-aux{display:flex;flex-wrap:wrap;gap:10px;padding-top:12px;border-top:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-control-workspace .cc-model-aux-field{display:flex;flex-direction:column;gap:5px;max-width:100%;min-width:0;flex:0 1 210px;font-size:11px}
.dsh-comfy-floating .cc-control-workspace .cc-model-aux-field>.cc-select-trigger{min-width:0!important;width:100%}
@media(max-width:700px){.dsh-comfy-floating .cc-generation-controls{grid-template-columns:145px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-control-catalog,.dsh-comfy-floating .cc-control-workspace{padding:8px}.dsh-comfy-floating .cc-control-tile{flex-basis:100%;max-width:none}.dsh-comfy-floating .cc-control-file .cc-model-dock-art{width:72px;height:48px}}
@media(max-width:460px){.dsh-comfy-floating .cc-generation-controls{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(90px,30%) minmax(0,1fr)}.dsh-comfy-floating .cc-control-catalog{display:flex;flex-flow:row wrap;align-content:flex-start}.dsh-comfy-floating .cc-control-catalog>strong,.dsh-comfy-floating .cc-control-category{width:100%;padding:0;margin:0}.dsh-comfy-floating .cc-control-add-row{width:auto;flex:1 1 95px;padding:7px}.dsh-comfy-floating .cc-control-lora-settings{width:65px}.dsh-comfy-floating .cc-control-tile{padding:10px 20px 10px 8px;gap:7px}}

@media(max-width:700px){.dsh-comfy-floating .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"]{flex-shrink:1;max-width:100%}.dsh-comfy-floating .cc-control-lora-settings{width:100%}}
@media(max-width:460px){.dsh-comfy-floating .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"]{grid-template-columns:64px minmax(0,1fr);padding:10px 8px}.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-model-dock-art,.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-model-dock-art{width:64px}}

.dsh-comfy-floating .cc-model-add-options{display:flex;flex-direction:column;gap:8px}
@container(max-width:540px){.dsh-comfy-ui .cc-model-dock-main{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-floating .cc-model-library-dialog{max-height:calc(100dvh - 28px)!important}
.dsh-comfy-floating .cc-model-library{height:min(780px,calc(100dvh - 124px));min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.dsh-comfy-floating .cc-model-library-toolbar{display:grid;grid-template-columns:minmax(0,1.6fr) 34px minmax(140px,1fr) 78px;align-items:center;gap:8px;flex:none}
.dsh-comfy-floating .cc-model-path{width:100%;min-width:0;height:34px;padding:7px 10px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-text);font:12px ui-monospace,Consolas,monospace;text-overflow:ellipsis}
.dsh-comfy-floating .cc-model-library-search{display:flex;align-items:center;gap:7px;min-width:0;height:34px;padding:0 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-muted)}
.dsh-comfy-floating .cc-model-library-search input{width:100%;min-width:0;height:30px;border:0;outline:0;background:transparent;color:var(--cc-text);font:inherit;font-size:12px}
.dsh-comfy-floating .cc-library-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0!important;flex:none;border-radius:6px}
.dsh-comfy-floating .cc-model-refresh{width:78px;gap:6px}
.dsh-comfy-floating .cc-library-icon[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 7px);right:0;z-index:60;white-space:nowrap;padding:6px 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-surface);color:var(--cc-text);font-size:12px;line-height:1.35;box-shadow:0 6px 18px rgba(0,0,0,.25);opacity:0;pointer-events:none}
.dsh-comfy-floating .cc-library-icon[data-cc-tooltip]:not(:disabled):is(:hover,:focus-visible)::after{opacity:1}
.dsh-comfy-floating .cc-model-library-body{display:grid;grid-template-columns:minmax(230px,29fr) minmax(0,71fr);gap:12px;min-height:0;flex:1}
.dsh-comfy-floating .cc-model-tree,.dsh-comfy-floating .cc-model-inspector{min-width:0;min-height:0;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-surface);overflow:hidden}
.dsh-comfy-floating .cc-model-tree{display:flex;flex-direction:column}
.dsh-comfy-floating .cc-model-tree-nav{position:relative;display:flex;align-items:center;gap:7px;flex:none;padding:7px;border-bottom:1px solid var(--cc-border);z-index:2}
.dsh-comfy-floating .cc-model-tree-nav strong{font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-model-tree-nav .cc-library-icon:first-child::after{right:auto;left:0}
.dsh-comfy-floating .cc-model-tree-scroll{overflow:auto;min-height:0;flex:1;padding:6px;overscroll-behavior:contain}
.dsh-comfy-floating .cc-model-tree-row{min-height:36px;display:flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:5px;padding:7px;color:var(--cc-text);background:transparent;font:inherit;font-size:12px;min-width:0;user-select:none}
.dsh-comfy-floating button.cc-model-tree-row{width:100%;cursor:pointer;text-align:left}
.dsh-comfy-floating .cc-model-tree-row:hover{background:var(--cc-hover)}
.dsh-comfy-floating .cc-model-tree-row.is-selected{background:var(--cc-accent-bg);border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-model-tree-row.is-drop{outline:1px solid var(--cc-accent);background:var(--cc-accent-bg)}
.dsh-comfy-floating .cc-model-tree-name{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.dsh-comfy-floating .cc-model-tree-name>span,.dsh-comfy-floating .cc-model-tree-name>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-model-tree-name>small{color:var(--cc-muted);font-size:10px}
.dsh-comfy-floating .cc-model-tree-meta{color:var(--cc-muted);font-size:10px;flex:none}
.dsh-comfy-floating .cc-model-tree-icon{width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--cc-muted);flex:none}
.dsh-comfy-floating .cc-model-folder-row>.cc-model-tree-icon{color:var(--cc-accent)}
.dsh-comfy-floating .cc-model-library-loading,.dsh-comfy-floating .cc-model-library-empty{display:flex;align-items:center;justify-content:center;gap:8px;color:var(--cc-muted);font-size:12px;padding:24px 10px}
.dsh-comfy-floating .cc-model-library-message{font-size:12px;overflow-wrap:anywhere;max-height:70px;overflow:auto;flex:none}
.dsh-comfy-floating .cc-model-new-folder{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--cc-border);flex:none;min-width:0}
.dsh-comfy-floating .cc-model-new-folder input{width:0;flex:1;min-width:0;height:32px;background:var(--cc-control);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:6px;padding:6px 8px;font:inherit;font-size:12px}
.dsh-comfy-floating .cc-model-new-folder button{white-space:nowrap}
.dsh-comfy-floating .cc-model-inspector{display:flex;flex-direction:column;overflow:auto;padding:14px;gap:12px;overscroll-behavior:contain}
.dsh-comfy-floating .cc-model-preview-gallery{display:flex;flex-direction:column;gap:8px;flex:none;min-width:0}
.dsh-comfy-floating .cc-model-preview-controls{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.dsh-comfy-floating .cc-model-local-preview,.dsh-comfy-floating .cc-model-preview-placeholder{height:clamp(280px,46dvh,460px);min-height:280px;flex:none;border-radius:8px;overflow:hidden;background:var(--cc-control)}
.dsh-comfy-floating .cc-model-local-preview img{width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-model-preview-placeholder{border:1px dashed var(--cc-border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--cc-muted);font-size:12px}
.dsh-comfy-floating .cc-model-preview-thumbnails{display:flex;gap:7px;overflow-x:auto;padding:2px;min-width:0}
.dsh-comfy-floating .cc-model-preview-thumbnails>button{flex:none;width:52px;height:60px;padding:0;border:1px solid var(--cc-border);border-radius:6px;overflow:hidden;background:var(--cc-control);cursor:pointer}
.dsh-comfy-floating .cc-model-preview-thumbnails>button[aria-pressed=true]{border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-model-preview-thumbnails img{width:100%;height:100%;object-fit:cover;display:block}
.dsh-comfy-floating .cc-model-inspector-title{display:flex;flex-direction:column;gap:4px;min-width:0}
.dsh-comfy-floating .cc-model-inspector-title strong{font-size:16px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-inspector-title small{color:var(--cc-muted);font-size:11px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-info-grid{display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px 12px;font-size:12px;margin:0}
.dsh-comfy-floating .cc-model-info-grid dt{color:var(--cc-muted)}
.dsh-comfy-floating .cc-model-info-grid dd{margin:0;overflow-wrap:anywhere;min-width:0}
.dsh-comfy-floating .cc-model-trigger-words{display:flex;gap:4px;flex-wrap:wrap;min-width:0}
.dsh-comfy-floating .cc-model-trigger-words span{padding:3px 6px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-control);font-size:11px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-source-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.dsh-comfy-floating .cc-model-source-line a{color:var(--cc-accent);text-decoration:none}
.dsh-comfy-floating .cc-model-source-line a:hover{text-decoration:underline}
.dsh-comfy-floating .cc-model-inspector-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px}
.dsh-comfy-floating .cc-model-library-hint{font-size:10px;color:var(--cc-muted);flex:none}
@media(max-width:820px){.dsh-comfy-ui .cc-model-dock-main{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-model-aux{grid-template-columns:minmax(0,1fr)}.dsh-comfy-floating .cc-model-library-body{grid-template-columns:minmax(180px,36fr) minmax(0,64fr)}}
@media(max-width:600px){.dsh-comfy-floating .cc-model-library-toolbar{grid-template-columns:minmax(0,1fr) 78px}.dsh-comfy-floating .cc-model-library-body{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(160px,32fr) minmax(0,68fr)}.dsh-comfy-floating .cc-model-local-preview,.dsh-comfy-floating .cc-model-preview-placeholder{height:300px;min-height:300px}.dsh-comfy-floating .cc-model-inspector{padding:10px}.dsh-comfy-floating .cc-model-info-grid{grid-template-columns:70px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-model-library-hint{display:none}}

/* v0.6.33: category pins, indented tree and masonry model gallery. */
.dsh-comfy-floating .cc-model-tree-root{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;font-weight:600;padding:5px;cursor:pointer}
.dsh-comfy-floating .cc-model-catalog-row{display:flex;align-items:center;gap:5px;min-width:0}
.dsh-comfy-floating .cc-model-catalog-row>.cc-model-tree-row{min-width:0;flex:1}
.dsh-comfy-floating .cc-model-pin{width:auto;flex:none;min-width:40px;height:32px;padding:4px 6px;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--cc-muted);font:inherit;font-size:11px;font-variant-numeric:tabular-nums;cursor:pointer}
.dsh-comfy-floating .cc-model-catalog-open{width:32px;height:32px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--cc-muted);cursor:pointer}
.dsh-comfy-floating .cc-model-pin:hover,.dsh-comfy-floating .cc-model-catalog-open:hover{background:var(--cc-hover)}
.dsh-comfy-floating .cc-model-pin[aria-pressed=true]{color:var(--cc-accent-text);background:var(--cc-accent-bg);border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-model-folder-empty{display:block;padding-block:7px;color:var(--cc-muted);font-size:11px}
.dsh-comfy-floating .cc-model-tree-indent{min-width:0}
.dsh-comfy-floating .cc-model-preview-gallery{height:clamp(220px,38dvh,360px);min-height:0;overflow:hidden;flex:none}
.dsh-comfy-floating .cc-model-preview-viewport{height:100%;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:2px;box-sizing:border-box;outline:none}
.dsh-comfy-floating .cc-model-preview-viewport:focus-visible{outline:1px solid var(--cc-accent);outline-offset:-1px;border-radius:6px}
.dsh-comfy-floating .cc-model-preview-masonry{position:relative;min-width:0;width:100%}
.dsh-comfy-floating .cc-model-preview-masonry .cc-masonry-cell{position:absolute;box-sizing:border-box;min-width:0}
.dsh-comfy-floating .cc-model-preview-tile{display:block;width:100%;box-sizing:border-box;padding:0;margin:0;overflow:hidden;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);cursor:zoom-in;line-height:0}
.dsh-comfy-floating .cc-model-preview-tile img{display:block;width:100%;height:100%;object-fit:contain}
.dsh-comfy-floating .cc-model-preview-tile:disabled{opacity:1;cursor:default!important}
.dsh-comfy-floating .cc-model-preview-failed{height:100%;display:flex;align-items:center;justify-content:center;padding:12px;font-size:12px;line-height:1.5;color:var(--cc-muted);box-sizing:border-box}
.dsh-comfy-floating .cc-model-preview-viewport>.cc-model-preview-placeholder{height:100%;min-height:0}
@media(max-width:600px){.dsh-comfy-floating .cc-model-preview-gallery{height:clamp(180px,30dvh,280px)}}

/* v0.6.11: polished pinned navigation + output browser */
.dsh-comfy-ui .cc-sticky-shell{position:sticky;top:-14px;z-index:120;display:flex;flex-direction:column;gap:9px;background:color-mix(in srgb,var(--cc-surface) 96%,transparent);margin:-14px -18px 0;padding:14px 18px 0;border-bottom:1px solid var(--cc-border);box-shadow:0 7px 18px rgba(0,0,0,.13);flex-shrink:0}
.dsh-comfy-ui .cc-output-page{position:relative;gap:10px;min-width:0}
.dsh-comfy-ui .cc-output-sticky{position:sticky;z-index:110;display:flex;flex-direction:column;gap:8px;padding:9px;border:1px solid var(--cc-border);border-radius:10px;background:color-mix(in srgb,var(--cc-surface) 97%,transparent);box-shadow:0 7px 22px rgba(0,0,0,.16)}
.dsh-comfy-ui .cc-output-toolbar{display:flex;align-items:center;flex-wrap:nowrap;gap:7px;min-height:34px;min-width:0;overflow-x:auto;scrollbar-width:none}
.dsh-comfy-ui .cc-output-toolbar::-webkit-scrollbar{display:none}
.dsh-comfy-ui .cc-output-view-group{display:inline-flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-control)}
.dsh-comfy-ui .cc-output-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:31px;height:31px;flex:none;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--cc-muted);cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.dsh-comfy-ui .cc-output-icon-btn:hover{color:var(--cc-text);background:var(--cc-hover)}
.dsh-comfy-ui .cc-output-icon-btn[aria-pressed=true]{color:var(--cc-accent-text);border-color:var(--cc-accent);background:var(--cc-accent-bg)}
.dsh-comfy-ui .cc-output-icon-btn:disabled{opacity:.48;cursor:wait}
.dsh-comfy-ui .cc-output-icon-btn[data-cc-tooltip]::after{top:calc(100% + 7px);bottom:auto;z-index:190}
.dsh-comfy-ui .cc-output-icon-btn:is(:hover,:focus-visible){z-index:5}
.dsh-comfy-ui .cc-output-refresh{margin-left:2px;border:1px solid var(--cc-border);background:var(--cc-control)}
.dsh-comfy-ui .cc-output-counter{margin-left:auto;flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:var(--cc-control);font-size:10px;color:var(--cc-muted);white-space:nowrap}
.dsh-comfy-ui .cc-output-quality{flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;margin-left:2px;min-width:0;padding:3px 4px 3px 7px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);font-size:10px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-quality-label{white-space:nowrap;margin-right:1px}
.dsh-comfy-ui .cc-output-quality-btn{height:25px;padding:0 7px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--cc-muted);font:inherit;font-size:10px;cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-output-quality-btn:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-output-quality-btn[aria-pressed=true]{border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-ui .cc-output-control-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch;min-width:0}
.dsh-comfy-ui .cc-output-search-field,.dsh-comfy-ui .cc-output-sort-field,.dsh-comfy-ui .cc-output-control-button{box-sizing:border-box;display:flex;align-items:center;gap:7px;min-width:0;width:100%;height:40px;padding:0 10px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);color:var(--cc-text);font:inherit;font-size:12px;transition:border-color .12s ease,background .12s ease}
.dsh-comfy-ui .cc-output-search-field:focus-within,.dsh-comfy-ui .cc-output-sort-field:focus-within{border-color:var(--cc-accent)}
.dsh-comfy-ui .cc-output-search-field input,.dsh-comfy-ui .cc-output-sort-field select{flex:1;min-width:0;width:100%;height:100%;border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;color:inherit;font:inherit;font-size:12px}
.dsh-comfy-ui .cc-output-search-field input[type=search]{appearance:none!important;-webkit-appearance:none!important;border-radius:0!important;padding:0!important}
.dsh-comfy-ui .cc-output-search-field input[type=search]:focus,.dsh-comfy-ui .cc-output-search-field input[type=search]:focus-visible{outline:none!important;box-shadow:none!important;border:0!important}
.dsh-comfy-ui .cc-output-search-field input[type=search]::-webkit-search-decoration,.dsh-comfy-ui .cc-output-search-field input[type=search]::-webkit-search-cancel-button,.dsh-comfy-ui .cc-output-filter-input[type=search]::-webkit-search-decoration,.dsh-comfy-ui .cc-output-filter-input[type=search]::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
.dsh-comfy-ui .cc-output-search-field:focus-within{border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc-accent) 34%,transparent)}
.dsh-comfy-ui .cc-output-search-clear{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:none;border:0;border-radius:5px;background:transparent;color:var(--cc-muted);cursor:pointer;padding:0}
.dsh-comfy-ui .cc-output-search-clear:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-output-sort-field .cc-select-trigger{flex:1;min-width:0;width:100%;max-width:100%;height:36px;padding:5px 2px;border:0;background:transparent}
.dsh-comfy-ui .cc-output-sort-field button{max-width:100%;min-width:0}
.dsh-comfy-ui .cc-output-control-button{justify-content:center;cursor:pointer}
.dsh-comfy-ui .cc-output-control-button:hover,.dsh-comfy-ui .cc-output-control-button[aria-expanded=true]{border-color:var(--cc-accent);background:color-mix(in srgb,var(--cc-accent-bg) 60%,var(--cc-control))}
.dsh-comfy-ui .cc-output-count-bubble{border-radius:99px;padding:2px 6px;background:var(--cc-accent-bg);color:var(--cc-accent-text);font-size:10px}
.dsh-comfy-ui .cc-output-filter-anchor{position:relative;min-width:0}
.dsh-comfy-ui .cc-output-filter-flyout{position:absolute;top:100%;left:50%;transform:translateX(-50%);width:min(760px,calc(100vw - 48px));padding-top:7px;z-index:180;background:transparent}
.dsh-comfy-ui .cc-output-filter-panel{max-height:min(70dvh,700px);overflow-y:auto;overscroll-behavior:contain;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.5);min-width:0}
.dsh-comfy-ui .cc-output-filter-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-bottom:1px solid var(--cc-border);background:color-mix(in srgb,var(--cc-surface) 96%,transparent);min-width:0}
.dsh-comfy-ui .cc-output-filter-heading,.dsh-comfy-ui .cc-output-filter-head-actions{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.dsh-comfy-ui .cc-output-filter-heading strong{font-size:13px;font-weight:650}
.dsh-comfy-ui .cc-output-filter-count{padding:2px 7px;border:1px solid color-mix(in srgb,var(--cc-accent) 65%,var(--cc-border));border-radius:99px;font-size:9px;color:var(--cc-accent-text);background:var(--cc-accent-bg)}
.dsh-comfy-ui .cc-output-filter-link{border:0;background:transparent;color:var(--cc-muted);font-size:10px;padding:5px 7px;border-radius:5px;cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-output-filter-link:hover{color:var(--cc-text);background:var(--cc-hover)}
.dsh-comfy-ui .cc-output-filter-body{padding:11px 13px;display:grid;gap:11px;min-width:0}
.dsh-comfy-ui .cc-output-filter-search{display:flex;flex-direction:column;gap:5px;min-width:0;font-size:10px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-input{display:block;width:100%;min-width:0;height:36px;padding:0 10px;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:7px;color:var(--cc-text);font-size:11px;outline:none;box-shadow:none;box-sizing:border-box;appearance:none;-webkit-appearance:none}
.dsh-comfy-ui .cc-output-filter-input:focus-visible{outline:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc-accent) 34%,transparent)}
.dsh-comfy-ui .cc-output-filter-input:focus{border-color:var(--cc-accent)}
.dsh-comfy-ui .cc-output-filter-group{display:grid;grid-template-columns:104px minmax(0,1fr);align-items:start;gap:10px;border-top:1px solid var(--cc-border);padding-top:10px;min-width:0}
.dsh-comfy-ui .cc-output-filter-group-title{display:flex;flex-direction:column;gap:3px;padding-top:5px}
.dsh-comfy-ui .cc-output-filter-group-title strong{font-size:11px;font-weight:650;color:var(--cc-text)}
.dsh-comfy-ui .cc-output-filter-group-title small{font-size:9px;line-height:1.45;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-stack{display:flex;flex-direction:column;gap:8px;min-width:0}
.dsh-comfy-ui .cc-output-filter-chips{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0}
.dsh-comfy-ui .cc-output-filter-chip{min-height:30px;border:1px solid var(--cc-border);background:var(--cc-control);color:var(--cc-muted);border-radius:7px;padding:5px 9px;font-size:10px;line-height:1.25;cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-output-filter-chip:hover{border-color:color-mix(in srgb,var(--cc-accent) 48%,var(--cc-border));color:var(--cc-text)}
.dsh-comfy-ui .cc-output-filter-chip[aria-pressed=true]{border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text);font-weight:650}
.dsh-comfy-ui .cc-output-filter-chip:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-ui .cc-output-filter-custom{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(120px,1fr);align-items:end;gap:8px;padding:9px;background:color-mix(in srgb,var(--cc-control) 75%,transparent);border:1px solid var(--cc-border);border-radius:8px;min-width:0}
.dsh-comfy-ui .cc-output-filter-custom label{display:flex;flex-direction:column;gap:5px;color:var(--cc-muted);font-size:9px;min-width:0}
.dsh-comfy-ui .cc-output-filter-custom input{width:100%;min-width:0;height:33px;padding:0 8px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:6px;color:var(--cc-text);font-size:10px;color-scheme:var(--cc-scheme);box-sizing:border-box}
.dsh-comfy-ui .cc-output-filter-range-sep{padding-bottom:9px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-hint{grid-column:1/-1;font-size:9px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-error{font-size:10px;color:var(--cc-error,#e57b7b)}
.dsh-comfy-ui .cc-output-filter-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:9px;color:var(--cc-muted);padding-top:2px}
.dsh-comfy-ui .cc-output-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:9px;min-width:0}
.dsh-comfy-ui .cc-output-masonry{position:relative;min-width:0;width:100%}
.dsh-comfy-ui .cc-masonry-cell{position:absolute;box-sizing:border-box;min-width:0}
.dsh-comfy-ui .cc-output-card{position:relative;break-inside:avoid;margin:0;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-control);overflow:hidden;cursor:pointer;isolation:isolate;transition:border-color .12s ease,box-shadow .12s ease,background .12s ease}
.dsh-comfy-ui .cc-output-card:hover,.dsh-comfy-ui .cc-output-card:focus-visible{border-color:var(--cc-accent);box-shadow:0 7px 20px rgba(0,0,0,.25);outline:none}
.dsh-comfy-ui .cc-output-card img{display:block;width:100%;height:auto;background:var(--cc-control)}
.dsh-comfy-ui .cc-output-grid .cc-output-card img{aspect-ratio:1/1;object-fit:cover}
.dsh-comfy-ui .cc-output-card-meta{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:2px;min-width:0;padding:24px 8px 7px;color:#fff;background:linear-gradient(180deg,transparent,rgba(0,0,0,.78));pointer-events:none}
.dsh-comfy-ui .cc-output-card-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.dsh-comfy-ui .cc-output-card-sub{display:flex;justify-content:space-between;align-items:center;gap:7px;min-width:0;font-size:9px;color:rgba(255,255,255,.78)}
.dsh-comfy-ui .cc-output-card-state{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.dsh-comfy-ui .cc-output-card-state::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.9}
.dsh-comfy-ui .cc-output-empty{display:flex;min-height:190px;align-items:center;justify-content:center;flex-direction:column;gap:8px;border:1px dashed var(--cc-border);border-radius:10px;color:var(--cc-muted);text-align:center;padding:20px}
.dsh-comfy-ui .cc-output-empty strong{font-size:12px;color:var(--cc-text)}
.dsh-comfy-ui .cc-output-load-sentinel{display:flex;justify-content:center;align-items:center;gap:8px;min-height:34px;padding:10px;color:var(--cc-muted);font-size:10px}
.dsh-comfy-ui .cc-output-load-sentinel::before{content:"";width:12px;height:12px;border:2px solid var(--cc-border);border-top-color:var(--cc-accent);border-radius:50%;animation:cc-spin .75s linear infinite}

.dsh-comfy-ui .cc-preview-plane{position:absolute;inset:8px}
.dsh-comfy-ui button.cc-main-preview{padding:0;display:block;color:inherit;cursor:zoom-in}
.dsh-comfy-ui .cc-latent-frame{border-style:dashed}
.dsh-comfy-ui .cc-latent-frame>span{position:absolute;white-space:nowrap;color:var(--cc-text);background:var(--cc-control);font-size:11px;line-height:16px;padding:0 3px;border-radius:3px}
.dsh-comfy-ui .cc-latent-width{left:50%;top:-21px;transform:translateX(-50%)}
.dsh-comfy-ui .cc-latent-height{left:-14px;top:50%;transform:translate(-50%,-50%) rotate(-90deg)}
.dsh-comfy-ui .cc-image-advanced>.cc-generate-open{border-radius:6px!important}
.dsh-comfy-floating .cc-post-bridge-prompt{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:12px;border:1px solid rgba(210,140,40,.5);border-radius:8px;background:rgba(210,140,40,.1);margin-bottom:12px}
.dsh-comfy-floating .cc-post-bridge-prompt>div:first-child{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1 1 420px;font-size:12px;line-height:1.55}
.dsh-comfy-floating .cc-post-bridge-prompt>div:first-child>strong{color:#e0a04a;font-size:13px}
.dsh-comfy-floating .cc-post-bridge-actions{display:flex;gap:7px;flex-wrap:wrap;flex:none}
.dsh-comfy-floating .cc-post-bridge-actions>button{width:auto;white-space:nowrap;min-height:32px}
.dsh-comfy-floating .cc-post-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:0;min-width:0}
.dsh-comfy-floating .cc-post-toolbar>small{flex:1 1 260px;font-size:11px}
.dsh-comfy-floating .cc-post-toolbar .cc-task-action{flex:none;display:flex;align-items:center;gap:6px}
.dsh-comfy-floating .cc-post-toolbar .cc-task-action button{min-height:34px}
.dsh-comfy-floating .cc-post-save-field{flex:0 0 auto;width:auto;max-width:100%}
.dsh-comfy-floating .cc-post-save-field>.cc-select-trigger{flex:0 1 auto!important;width:auto!important;min-width:0!important;max-width:240px}

.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]{position:relative}
.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 6px);left:0;width:260px;padding:7px 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-surface);color:var(--cc-text);font-size:11px;line-height:1.45;white-space:normal;box-shadow:0 6px 18px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s;z-index:40}
.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]:hover::after,.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]:focus-within::after{opacity:1;visibility:visible}.dsh-comfy-floating .cc-post-notebook{display:grid;grid-template-columns:minmax(230px,29fr) minmax(0,71fr);height:min(736px,calc(100dvh - 212px));gap:0;min-height:0}
.dsh-comfy-floating .cc-post-add{display:flex;flex-direction:column;gap:0;overflow:auto;border:0;border-right:1px solid var(--cc-border);border-radius:0;background:transparent;padding:0 12px 0 0;min-width:0;min-height:0}
.dsh-comfy-floating .cc-post-side-section{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:0;overflow:auto;padding:6px}
.dsh-comfy-floating .cc-post-side-section>strong{font-size:12px;padding:8px 7px 5px;color:var(--cc-text);flex:none}
.dsh-comfy-floating .cc-post-cells{display:flex;flex-direction:column;gap:10px;border:0;border-radius:0;background:transparent;overflow:auto;min-width:0;min-height:0;padding:10px 10px 10px 14px}
.dsh-comfy-floating .cc-post-cell{flex:none;border:1px solid var(--cc-border)!important;border-left:3px solid var(--cc-accent-bg)!important;border-radius:8px!important;padding:0;margin:0;min-width:0;background:var(--cc-surface)!important;box-shadow:none;overflow:hidden}
.dsh-comfy-floating .cc-post-cell[data-disabled="true"] .cc-post-cell-fields{opacity:.55}
.dsh-comfy-floating .cc-post-cell-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 9px;border-bottom:1px solid var(--cc-border);background:var(--cc-control)}
.dsh-comfy-floating .cc-post-cell-index{font:600 10px ui-monospace,Consolas,monospace;color:var(--cc-accent-text);background:var(--cc-accent-bg);border-radius:4px;padding:2px 6px;min-width:26px;text-align:center;flex:none}
.dsh-comfy-floating .cc-post-cell[data-disabled="true"] .cc-post-cell-index{color:var(--cc-muted);background:var(--cc-border)}
.dsh-comfy-floating .cc-post-cell-drag{flex:none;color:var(--cc-muted);cursor:grab;user-select:none;font-size:14px;line-height:1;padding:0 2px}
.dsh-comfy-floating .cc-post-cell-drag:active{cursor:grabbing}
.dsh-comfy-floating .cc-post-cell-title{flex:1;min-width:100px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-post-cell-actions{display:flex;gap:3px;flex:none;margin-left:auto}
.dsh-comfy-floating .cc-post-cell-actions button{position:relative;width:26px;min-width:26px;height:26px;min-height:26px;padding:0!important;display:flex;align-items:center;justify-content:center;font-size:11px}

.dsh-comfy-floating .cc-post-cell-actions button[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 6px);right:0;z-index:50;white-space:nowrap;padding:5px 8px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-surface);color:var(--cc-text);font-size:10px;line-height:1.3;box-shadow:0 6px 18px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .12s}
.dsh-comfy-floating .cc-post-cell-actions button[data-cc-tooltip]:not(:disabled):is(:hover,:focus-visible)::after{opacity:1}
.dsh-comfy-floating .cc-post-cell-enable{flex:none;height:30px;font-size:11px}
.dsh-comfy-floating .cc-post-cell-enable>span:first-child{padding:0 8px;font-size:10px}
.dsh-comfy-floating .cc-post-cell-enable>.cc-select-trigger{height:28px;min-width:64px!important;padding:0 8px!important;font-size:11px!important}
.dsh-comfy-floating .cc-post-cell-fields{display:flex;flex-direction:column;gap:16px;padding:16px;min-width:0;container-type:inline-size}
.dsh-comfy-floating .cc-post-param-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}
.dsh-comfy-floating .cc-post-param-group+.cc-post-param-group{padding-top:14px;border-top:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-post-param-group[data-layout="upscale"]{grid-template-columns:minmax(0,1fr) 140px}
.dsh-comfy-floating .cc-post-param-group[data-layout="sampling"]{grid-template-columns:repeat(4,minmax(0,1fr))}
.dsh-comfy-floating .cc-post-param-wide{grid-column:1/-1;min-width:0}
.dsh-comfy-floating .cc-post-cell-fields label{min-width:0;gap:6px}
.dsh-comfy-floating .cc-post-cell-fields :is(input[type=number],.cc-select-trigger){width:100%;height:34px;min-height:34px;box-sizing:border-box;min-width:0}
.dsh-comfy-floating .cc-post-cell-fields .cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;max-width:100%;overflow:hidden}
.dsh-comfy-floating .cc-post-cell-fields .cc-select-label{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.dsh-comfy-floating .cc-post-cell-fields .cc-select-caret{flex:none}
.dsh-comfy-floating .cc-post-param-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;grid-column:1/-1;min-width:0}
.dsh-comfy-floating .cc-post-param-actions>button{width:auto;min-height:34px}
.dsh-comfy-floating .cc-post-param-actions :is(button,.cc-task-action){max-width:100%;min-width:0}
.dsh-comfy-floating .cc-post-param-actions .cc-task-action{flex-wrap:wrap}
.dsh-comfy-floating .cc-post-param-actions button{white-space:normal;overflow-wrap:anywhere}
@container(max-width:560px){.dsh-comfy-floating .cc-post-param-group[data-layout="sampling"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container(max-width:310px){.dsh-comfy-floating .cc-post-param-group,.dsh-comfy-floating .cc-post-param-group[data-layout]{grid-template-columns:minmax(0,1fr)}.dsh-comfy-floating .cc-post-param-actions{justify-content:flex-start}}

.dsh-comfy-floating .cc-post-check{display:flex;align-items:center;gap:7px;font-size:12px}
.dsh-comfy-floating .cc-post-check input{width:auto}
.dsh-comfy-floating .cc-post-log{white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;font-size:11px}
.dsh-comfy-floating .cc-flow-top{display:flex;gap:10px}.dsh-comfy-floating .cc-flow-top>input{flex:1;min-width:0}
.dsh-comfy-floating .cc-flow-editor{display:grid;grid-template-columns:210px minmax(0,1fr);height:65vh;min-height:280px;gap:10px}
.dsh-comfy-floating .cc-flow-sidebar{overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:5px}
.dsh-comfy-floating .cc-flow-sidebar>button{text-align:left;overflow-wrap:anywhere;flex:none}
.dsh-comfy-floating .cc-flow-scroll{overflow:auto;position:relative;background:var(--cc-bg);border:1px solid var(--cc-border);border-radius:8px}
.dsh-comfy-floating .cc-flow-canvas{position:relative;background-image:radial-gradient(var(--cc-border) 1px,transparent 1px);background-size:20px 20px}
.dsh-comfy-floating .cc-flow-links{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.dsh-comfy-floating .cc-flow-node{position:absolute;width:260px;box-sizing:border-box;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:8px;padding:9px}
.dsh-comfy-floating .cc-flow-node header{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;touch-action:none;overflow-wrap:anywhere;font-size:12px;font-weight:600;padding-bottom:8px;border-bottom:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-flow-node input,.dsh-comfy-floating .cc-flow-node select,.dsh-comfy-floating .cc-flow-sidebar input,.dsh-comfy-floating .cc-post-cell-fields select,.dsh-comfy-floating .cc-stage-toolbar select{background:var(--cc-control);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:5px;padding:4px;box-sizing:border-box;max-width:100%;min-width:0;font:inherit}
.dsh-comfy-floating .cc-flow-output-row{display:flex;gap:6px;justify-content:flex-end}.dsh-comfy-floating .cc-flow-outputs button[aria-pressed=true]{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-flow-outputs{display:flex;flex-direction:column;align-items:end;margin:8px 0;gap:4px}
.dsh-comfy-floating .cc-flow-node button{color:inherit;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:4px;cursor:pointer}
.dsh-comfy-floating .cc-flow-outputs button{font-size:11px}.dsh-comfy-floating .cc-flow-outputs span{margin-left:8px;color:var(--cc-accent)}
.dsh-comfy-floating .cc-flow-input{display:grid;grid-template-columns:16px minmax(0,1fr);gap:4px;margin-top:8px;font-size:11px}
.dsh-comfy-floating .cc-flow-input label{display:flex;flex-direction:column;gap:3px}.dsh-comfy-floating .cc-flow-input>input,.dsh-comfy-floating .cc-flow-input>select{grid-column:2;min-width:0;width:100%}
.dsh-comfy-floating .cc-port{border:0!important;background:transparent!important;padding:0;color:var(--cc-accent)!important;align-self:start}
.dsh-comfy-floating .cc-stage-toolbar{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:12px;padding:7px;background:var(--cc-surface);border-radius:7px;max-width:calc(100% - 110px);flex-wrap:wrap}
.dsh-comfy-floating .cc-stage-toolbar label{display:flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-comfy-floating .cc-comparison-host{position:absolute;inset:65px 36px 40px;z-index:2}
.dsh-comfy-floating .cc-stage-comparison{height:100%;display:flex;flex-direction:column;gap:10px}
.dsh-comfy-floating .cc-comparison-tools{display:flex;gap:12px;align-items:center;font-size:12px}
.dsh-comfy-floating .cc-comparison-viewport{flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none}
.dsh-comfy-floating .cc-comparison-pair{position:relative;max-width:100%;max-height:100%;width:auto;height:100%;transform-origin:center}
.dsh-comfy-floating .cc-comparison-pair>img{width:100%;height:100%;object-fit:fill;display:block;pointer-events:none;user-select:none}
.dsh-comfy-floating .cc-comparison-pair>img.cc-comparison-before{position:absolute;inset:0}
.dsh-comfy-floating .cc-comparison-divider{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 2px #000;pointer-events:none}
.dsh-comfy-floating .cc-comparison-pair.is-side-by-side{display:flex;width:100%;aspect-ratio:auto!important;height:auto}
.dsh-comfy-floating .cc-comparison-pair.is-side-by-side>img{position:static;width:50%;height:auto;object-fit:contain}
.dsh-comfy-floating .cc-stage-comparison>input[type=range]{width:100%;accent-color:var(--cc-accent)}
@media(max-width:650px){.dsh-comfy-floating .cc-post-notebook,.dsh-comfy-floating .cc-flow-editor{grid-template-columns:135px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-post-cell{padding:0}.dsh-comfy-floating .cc-post-add{padding-right:6px}.dsh-comfy-floating .cc-post-add button{padding:6px!important}.dsh-comfy-floating .cc-post-cell-head{gap:7px}.dsh-comfy-floating .cc-post-cell-actions{width:100%}.dsh-comfy-floating .cc-stage-toolbar{max-width:calc(100% - 65px);left:44%}.dsh-comfy-floating .cc-comparison-host{inset:110px 15px 45px}}

.dsh-comfy-floating .cc-output-preview-targets{display:flex;flex-direction:column;gap:8px}
.dsh-comfy-floating .cc-output-preview-target{display:flex;gap:9px;align-items:center;padding:10px 0;border-bottom:1px solid var(--cc-border);min-width:0}
.dsh-comfy-floating .cc-output-preview-target>span{display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-preview-target small{color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-dialog>div:last-child{flex:1;overflow:hidden!important}
.dsh-comfy-floating .cc-preview-editor{display:flex;flex:1;flex-direction:column;gap:10px;height:min(680px,calc(100dvh - 150px));min-height:0}
.dsh-comfy-floating .cc-preview-editor-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--cc-muted);flex:none}
.dsh-comfy-floating .cc-preview-editor-scroll{flex:1;min-height:0;overflow:auto;padding:2px;min-width:0}
.dsh-comfy-floating .cc-preview-editor-masonry{position:relative;width:100%;min-width:0}
.dsh-comfy-floating .cc-preview-editor-masonry .cc-masonry-cell{position:absolute;box-sizing:border-box;min-width:0}
.dsh-comfy-floating .cc-preview-editor-image{position:relative;display:block;width:100%;box-sizing:border-box;border:1px solid var(--cc-border);border-radius:8px;padding:0;overflow:hidden;background:var(--cc-control);cursor:pointer;transition:border-color .12s,box-shadow .12s}
.dsh-comfy-floating .cc-preview-editor-image:hover:enabled{border-color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-image.is-selected{border-color:var(--cc-accent)!important;box-shadow:inset 0 0 0 2px var(--cc-accent-bg),0 0 0 2px var(--cc-accent)}
.dsh-comfy-floating .cc-preview-editor-image:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-preview-editor-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-preview-editor-failed{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;color:var(--cc-muted);font-size:11px}
.dsh-comfy-floating .cc-preview-editor-image.is-selected::after{content:'✓';position:absolute;right:7px;top:7px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--cc-accent);color:var(--cc-accent-text);font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.dsh-comfy-floating .cc-preview-editor-badge{position:absolute;left:7px;top:7px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.62);color:#fff;font-size:10px;line-height:1.4}
.dsh-comfy-floating .cc-preview-editor-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--cc-border);padding-top:12px;flex:none}
.dsh-comfy-floating .cc-preview-editor-selection{flex:1;min-width:120px;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-confirm{display:flex;flex:none;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--cc-accent);border-radius:7px;background:var(--cc-accent-bg);font-size:11px}
.dsh-comfy-floating .cc-preview-editor-confirm>span{flex:1;min-width:120px}
.dsh-comfy-floating.cc-output-inspector{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-columns:minmax(0,70fr) minmax(300px,30fr);background:rgba(5,7,10,.68);backdrop-filter:brightness(.62) blur(2px);-webkit-backdrop-filter:brightness(.62) blur(2px);color:var(--cc-text);overflow:hidden;overscroll-behavior:none;touch-action:none}
.dsh-comfy-floating .cc-output-inspector-stage{position:relative;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,.08);user-select:none;touch-action:none;cursor:default}
.dsh-comfy-floating .cc-output-inspector-stage:active{cursor:grabbing}
.dsh-comfy-floating .cc-output-inspector-image{display:block;max-width:calc(100% - 36px);max-height:calc(100% - 36px);width:auto;height:auto;object-fit:contain;transform-origin:center center;will-change:transform;user-select:none;pointer-events:none}
.dsh-comfy-floating .cc-output-inspector-close{position:fixed;left:16px;top:14px;z-index:4;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(12,12,12,.72);color:#fff;cursor:pointer;backdrop-filter:blur(10px)}
.dsh-comfy-floating .cc-output-inspector-close:hover{background:rgba(36,36,36,.9);border-color:rgba(255,255,255,.34)}
.dsh-comfy-floating .cc-output-inspector-nav{position:absolute;z-index:3;top:50%;transform:translateY(-50%);width:42px;height:58px;display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:rgba(0,0,0,.3);color:#fff;cursor:pointer;opacity:.55;transition:opacity .12s ease,background .12s ease}
.dsh-comfy-floating .cc-output-inspector-nav:hover{opacity:1;background:rgba(0,0,0,.58)}
.dsh-comfy-floating .cc-output-inspector-nav.is-prev{left:14px}.dsh-comfy-floating .cc-output-inspector-nav.is-next{right:14px}
.dsh-comfy-floating .cc-output-inspector-zoom{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:2;padding:5px 9px;border-radius:99px;background:rgba(0,0,0,.56);color:rgba(255,255,255,.75);font-size:10px;pointer-events:none;white-space:nowrap}
.dsh-comfy-floating .cc-output-inspector-info{min-width:0;min-height:0;height:100dvh;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;padding:22px 20px 28px;background:color-mix(in srgb,var(--cc-surface) 90%,transparent);backdrop-filter:blur(18px) saturate(115%);-webkit-backdrop-filter:blur(18px) saturate(115%);border-left:1px solid color-mix(in srgb,var(--cc-border) 80%,transparent);display:flex;flex-direction:column;gap:15px}
.dsh-comfy-floating .cc-output-info-title{display:flex;flex-direction:column;gap:4px;min-width:0;padding-right:6px}.dsh-comfy-floating .cc-output-info-title strong{font-size:15px;overflow-wrap:anywhere}.dsh-comfy-floating .cc-output-info-title small{font-size:10px;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-info-section{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--cc-border);min-width:0}.dsh-comfy-floating .cc-output-info-section>strong{font-size:11px;letter-spacing:.02em}.dsh-comfy-floating .cc-output-info-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.dsh-comfy-floating .cc-output-info-section-head>strong{font-size:11px;letter-spacing:.02em}.dsh-comfy-floating .cc-output-info-grid{display:grid;grid-template-columns:92px minmax(0,1fr);gap:7px 9px;font-size:11px}.dsh-comfy-floating .cc-output-info-grid dt{color:var(--cc-muted)}.dsh-comfy-floating .cc-output-info-grid dd{margin:0;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-model-list{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto;padding-right:2px;overscroll-behavior:contain}.dsh-comfy-floating .cc-output-model-group{display:grid;grid-template-columns:78px minmax(0,1fr);gap:7px;align-items:start;padding:6px 7px;border:1px solid var(--cc-border);border-radius:7px;background:color-mix(in srgb,var(--cc-control) 86%,transparent);font-size:10px}.dsh-comfy-floating .cc-output-model-group-label{display:flex;align-items:center;gap:5px;color:var(--cc-muted);min-height:24px}.dsh-comfy-floating .cc-output-model-count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--cc-hover);color:var(--cc-text);font-size:9px}.dsh-comfy-floating .cc-output-model-chips{display:flex;flex-wrap:wrap;gap:4px;min-width:0}.dsh-comfy-floating .cc-output-model-chip{display:inline-flex;align-items:center;max-width:100%;min-height:24px;padding:3px 7px;border-radius:6px;background:var(--cc-surface);border:1px solid color-mix(in srgb,var(--cc-border) 75%,transparent);color:var(--cc-text);font-size:9px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-comfy-floating .cc-output-model-chip.is-primary{border-color:color-mix(in srgb,var(--cc-accent) 42%,var(--cc-border));background:color-mix(in srgb,var(--cc-accent-bg) 58%,var(--cc-surface))}
.dsh-comfy-floating .cc-output-prompt-box{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;padding:9px 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--cc-text)}.dsh-comfy-floating .cc-output-prompt-toolbar{display:flex;align-items:center;gap:5px}.dsh-comfy-floating .cc-output-prompt-translate{height:26px;padding:0 8px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-muted);font:inherit;font-size:9px;cursor:pointer}.dsh-comfy-floating .cc-output-prompt-translate:hover,.dsh-comfy-floating .cc-output-prompt-translate[aria-pressed=true]{border-color:var(--cc-accent);color:var(--cc-text);background:var(--cc-accent-bg)}.dsh-comfy-floating .cc-output-prompt-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:9px;color:var(--cc-muted)}.dsh-comfy-floating .cc-output-prompt-source{display:inline-flex;align-items:center;padding:2px 5px;border-radius:99px;background:var(--cc-hover)}
.dsh-comfy-floating .cc-output-inspector-actions{display:flex;gap:7px;flex-wrap:wrap;padding-top:4px;margin-top:auto}
@media(max-width:760px){.dsh-comfy-floating.cc-output-inspector{grid-template-columns:minmax(0,1fr) minmax(260px,38vw)}.dsh-comfy-floating .cc-output-inspector-info{padding:18px 14px 22px}}
.dsh-comfy-floating.cc-output-inspector.is-image-only{grid-template-columns:minmax(0,1fr)}
.dsh-comfy-floating.cc-output-inspector.is-image-only .cc-output-inspector-image{width:calc(100% - 36px);height:calc(100% - 36px)}
.dsh-comfy-floating .cc-output-inspector-error{position:absolute;padding:12px 18px;border-radius:7px;background:rgba(0,0,0,.55);color:#fff;font-size:13px}

@media(max-width:700px){.dsh-comfy-ui .cc-output-filter-group{grid-template-columns:minmax(0,1fr);gap:5px}.dsh-comfy-ui .cc-output-filter-group-title{padding-top:0}.dsh-comfy-ui .cc-output-filter-flyout{width:min(640px,calc(100vw - 28px))}}
@media(max-width:560px){.dsh-comfy-ui .cc-output-toolbar{gap:4px}.dsh-comfy-ui .cc-output-quality{margin-left:0}.dsh-comfy-ui .cc-output-quality-label{display:none}.dsh-comfy-ui .cc-output-quality-btn{padding:0 5px}.dsh-comfy-ui .cc-output-control-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.dsh-comfy-ui .cc-output-search-field,.dsh-comfy-ui .cc-output-sort-field,.dsh-comfy-ui .cc-output-control-button{height:37px;padding:0 6px;font-size:10px;gap:4px}.dsh-comfy-ui .cc-output-filter-flyout{width:min(440px,calc(100vw - 20px))}.dsh-comfy-ui .cc-output-filter-custom{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-output-filter-range-sep{display:none}.dsh-comfy-ui .cc-output-filter-hint{grid-column:auto}.dsh-comfy-ui .cc-output-search-field svg,.dsh-comfy-ui .cc-output-sort-field>svg{display:none}.dsh-comfy-ui .cc-output-count-bubble{padding:1px 4px}}

.dsh-comfy-floating .cc-model-guide{display:flex;flex-direction:column;gap:14px;min-height:0;overflow:auto;padding:2px 2px 12px}
.dsh-comfy-floating .cc-model-guide-lead{margin:0;font-size:13px;line-height:1.7;color:var(--cc-text)}
.dsh-comfy-floating .cc-model-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dsh-comfy-floating .cc-model-guide-card{border:1px solid var(--cc-border);border-radius:8px;padding:11px 12px;background:var(--cc-control);min-width:0}
.dsh-comfy-floating .cc-model-guide-card-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.dsh-comfy-floating .cc-model-guide-card-head strong{font-size:13px}.dsh-comfy-floating .cc-model-guide-card-head span{font-size:10px;color:var(--cc-accent);flex:none}
.dsh-comfy-floating .cc-model-guide-card p,.dsh-comfy-floating .cc-model-guide-section p{margin:0;font-size:12px;line-height:1.7;color:var(--cc-muted)}
.dsh-comfy-floating .cc-model-guide-section{border-top:1px solid var(--cc-border);padding-top:10px}
.dsh-comfy-floating .cc-model-guide-section>strong{display:block;font-size:12px;margin-bottom:4px}
.dsh-comfy-floating .cc-model-guide-section ul{margin:0;padding-left:18px;font-size:12px;line-height:1.7;color:var(--cc-muted)}
@media(max-width:700px){.dsh-comfy-floating .cc-model-guide-grid{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-ui .cc-update-btn{background:var(--cc-accent)!important;color:#fff!important;border-color:var(--cc-accent)!important;font-weight:700}
.dsh-comfy-ui .cc-update-btn:hover{filter:brightness(1.08)}

`;


function SelectMenu({ options, value, onChange, label, theme, minWidth = 140, forceSearch = false, forceOpen = false }) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [active, setActive] = React.useState(0);
    const [placement, setPlacement] = React.useState(null);
    const anchor = React.useRef(null);
    const popup = React.useRef(null);
    const search = React.useRef(null);
    const composing = React.useRef(false);
    const items = (options || []).map((o) => typeof o === "object" && o !== null
        ? {value: String(o.value), label: String(o.label)} : {value: String(o), label: String(o)});
    const filtered = query ? items.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : items;
    const chosen = items.find((o) => o.value === String(value));
    const searchable = forceSearch || items.length > 12;
    const selectedLabel = chosen ? chosen.label : items.length ? "请选择…" : "暂无可用选项";
    const close = () => { setOpen(false); setQuery(""); composing.current = false; };
    function position() {
        if (!anchor.current || typeof window === "undefined") return;
        const r = anchor.current.getBoundingClientRect();
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        const width = Math.max(120, Math.min(Math.max(minWidth, r.width), vw - 24));
        const left = Math.max(12, Math.min(r.left, vw - width - 12));
        const desired = Math.min(320, Math.max(62, items.length * 34 + (searchable ? 52 : 0) + 14));
        const below = Math.max(0, vh - r.bottom - 14), above = Math.max(0, r.top - 14);
        const flip = below < desired && above > below;
        const height = Math.max(48, Math.min(desired, flip ? above : below));
        const top = flip ? Math.max(8, r.top - height - 6) : Math.min(vh - 48, r.bottom + 6);
        setPlacement({ top, left, width, maxHeight: height });
    }
    function choose(item) {
        onChange(item.value);
        close();
        if (anchor.current && anchor.current.focus) anchor.current.focus();
    }
    function openList() {
        if (!items.length) return;
        setQuery("");
        setActive(Math.max(0, items.findIndex((o) => o.value === String(value))));
        position();
        setOpen(true);
    }
    React.useEffect(() => {
        if (forceOpen && !open && items.length) openList();
        else if (!forceOpen && open) close();
    }, [forceOpen]);
    React.useEffect(() => {
        if (!open || typeof document === "undefined") return;
        position();
        const outside = (e) => {
            if ((anchor.current && anchor.current.contains(e.target)) ||
                (popup.current && popup.current.contains(e.target))) return;
            close();
        };
        const keys = (e) => {
            if (composing.current || e.isComposing || e.keyCode === 229) return;
            if (e.key === "Escape") { e.preventDefault(); close(); if (anchor.current) anchor.current.focus(); return; }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                setActive((i) => e.key === "Home" ? 0 : e.key === "End" ? Math.max(0, filtered.length - 1)
                    : Math.max(0, Math.min(filtered.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
            } else if (e.key === "Enter" || (e.key === " " && e.target !== search.current)) {
                e.preventDefault();
                const item = filtered[Math.min(active, filtered.length - 1)];
                if (item) choose(item);
            }
        };
        const reposition = () => position();
        document.addEventListener("pointerdown", outside, true);
        document.addEventListener("keydown", keys, true);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        if (searchable && search.current) search.current.focus();
        return () => {
            document.removeEventListener("pointerdown", outside, true);
            document.removeEventListener("keydown", keys, true);
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [open, active, query, items.length, value]);
    React.useEffect(() => { if (!open || !popup.current) return;
        const el = popup.current.querySelector('[data-active="true"]');
        if (el && el.scrollIntoView) el.scrollIntoView({block: "nearest"});
    }, [open, active, query]);
    return h(React.Fragment, null,
        h("button", { type: "button", ref: anchor, className: "cc-select-trigger", style: Object.assign({}, S.sel, { minWidth }),
            title: selectedLabel, "aria-label": label, "aria-haspopup": "listbox", "aria-expanded": open,
            disabled: !items.length,
            onClick: () => open ? close() : openList(),
            onKeyDown: (e) => { if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); } } },
            h("span", {className: "cc-select-label"}, selectedLabel),
            h("span", {className: "cc-select-caret", "aria-hidden": "true"}, "▾")),
        open && placement ? floating(h("div", { ref: popup, className: "dsh-comfy-floating cc-select-popup",
            style: Object.assign({}, theme || {}, { position: "fixed", zIndex: forceOpen ? 2147482600 : 2147480500, pointerEvents: forceOpen ? "none" : undefined, ...placement }),
            onMouseDown: (e) => e.stopPropagation() },
            searchable ? h("input", { ref: search, type: "search", className: "cc-select-search", value: query,
                placeholder: "搜索选项…", "aria-label": "搜索" + label,
                onCompositionStart: () => { composing.current = true; },
                onCompositionEnd: () => { composing.current = false; },
                onChange: (e) => { setQuery(e.target.value); setActive(0); },
                onKeyDown: (e) => { if (e.key === " ") e.stopPropagation(); } }) : null,
            h("div", { className: "cc-option-list", role: "listbox", "aria-label": label },
                filtered.length ? filtered.map((o, i) => h("button", { type: "button", role: "option", key: o.value,
                    className: "cc-option", title: o.label, "aria-selected": o.value === String(value),
                    "data-active": i === active ? "true" : "false",
                    onMouseEnter: () => setActive(i), onClick: () => choose(o) }, o.label))
                : h("div", {style: {padding: "12px", fontSize: "12px", color: "var(--cc-muted)"}}, "没有匹配的选项")))) : null);
}

// ==================== 内置 ComfyUI 单色图标 ====================
// 使用 v0.3.1 已有的离线轮廓；不下载任何远程图标，也不依赖网络。
// fill=currentColor 自动跟随 DSH 侧栏主题，亮色/暗色主题都可见。

const COMFY_ICON_PATH =
    "M270 6 H449 C471 6 484 18 480 40 L459 121 C450 156 435 173 398 173 H247 " +
    "C233 173 230 180 225 196 L190 321 C186 335 192 340 206 340 H348 " +
    "C372 340 389 356 382 380 L358 463 C349 494 338 505 304 505 H115 " +
    "C92 505 77 489 83 465 L98 414 C102 401 98 395 85 395 H40 " +
    "C17 395 5 382 11 358 L63 165 C72 131 84 116 119 116 H171 " +
    "C184 116 188 111 193 96 L208 46 C217 18 233 6 270 6 Z";

function OfflineComfyMark({ size }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 512 512", fill: "currentColor",
        focusable: "false", "aria-hidden": "true", style: { display: "block", flexShrink: 0 } },
        h("path", { d: COMFY_ICON_PATH }));
}

let _createPortal = null;
try { _createPortal = require("react-dom").createPortal; } catch (e) { /* 老宿主可不提供 */ }

function floating(node) {
    if (_createPortal && typeof document !== "undefined" && document.body) {
        return _createPortal(node, document.body);
    }
    return node;
}

function CompatibilityCheck({S}) {
    const [report,setReport]=React.useState(null);
    const [busy,setBusy]=React.useState(false);
    const [error,setError]=React.useState("");
    const task=React.useRef({seq:0,ctl:null});
    function stop(){task.current.seq++;task.current.ctl?.abort();task.current.ctl=null;setBusy(false);}
    React.useEffect(()=>()=>{task.current.seq++;task.current.ctl?.abort();},[]);
    async function run(){
        stop();const seq=++task.current.seq,ctl=new AbortController();task.current.ctl=ctl;
        setBusy(true);setError("");setReport(null);
        try {
            const data=await jget(EXPANDER+"/diagnostics/compatibility",6000,ctl.signal);
            if(!Array.isArray(data.items))throw new Error("检查结果格式无效");
            if(task.current.seq===seq)setReport(data);
        }catch(e){if(task.current.seq===seq&&!ctl.signal.aborted)setError(errText(e));}
        finally{if(task.current.seq===seq){task.current.ctl=null;setBusy(false);}}
    }
    return h("details",{className:"cc-details",style:{fontSize:12}},
        h("summary",{className:"cc-summary"},"兼容性检查"),
        h("div",{style:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",paddingTop:10}},
            h(TaskAction,{busy,label:"检查当前环境",busyLabel:"正在检查当前环境…",onStart:run,onStop:stop}),
            h("span",{style:S.dim},"检查已保存设置；不启动服务、不安装依赖。")),
        error?h("p",{role:"status",style:S.bad},"检查失败："+error):null,
        report?h("div",{"aria-label":"兼容性检查结果",style:{maxHeight:240,overflowY:"auto",overflowWrap:"anywhere",marginTop:8}},
            ...report.items.map(item=>h("div",{key:item.key,style:{padding:"6px 0",borderBottom:"1px solid var(--cc-border)"}},
                h("strong",{style:item.status==="error"?S.bad:{}},item.label+" · "+({ok:"正常",warning:"提示",error:"错误",unverified:"未验证"}[item.status]||item.status)),
                h("div",{style:{...S.dim,marginTop:3}},item.detail)))):null);
}


function OverlayModal({ title, onClose, children, width = 560, theme, className, zIndex = 2147480000, guideTarget }) {
    const dialogRef = React.useRef(null);
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const old = document.activeElement;
        const dialog = dialogRef.current;
        if (dialog && dialog.focus) dialog.focus();
        const onKey = (e) => {
            const active=document.activeElement?.closest('[role="dialog"]');
            if(e.defaultPrevented||(active&&active!==dialog&&!dialog?.contains(active)))return;
            if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); return; }
            if (e.key !== "Tab" || !dialog) return;
            const selectors = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
            const focusable = [...dialog.querySelectorAll(selectors)].filter((el) => el.getClientRects().length > 0);
            if (!focusable.length) { e.preventDefault(); dialog.focus(); return; }
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("keydown", onKey);
            if (old && old.focus && old.isConnected) old.focus(); };
    }, []);
    return floating(h("div", { className: "dsh-comfy-floating cc-backdrop",
        style: Object.assign({}, theme || {}, { position: "fixed", inset: 0, zIndex,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "14px", boxSizing: "border-box", background: "rgba(0,0,0,.55)" }),
        onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); },
    },
        h("section", { ref: dialogRef, className, "data-cc-guide": guideTarget || undefined, role: "dialog", "aria-modal": "true", "aria-label": title,
            tabIndex: -1, style: {
                width: "100%", maxWidth: width, maxHeight: "min(760px, calc(100dvh - 28px))",
                minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column",
                overflow: "hidden", borderRadius: "12px", outline: "none",
                background: "var(--cc-surface)", color: "var(--cc-text)",
                border: "1px solid var(--cc-border)", boxShadow: "0 18px 65px rgba(0,0,0,.48)",
            } },
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "12px", flexShrink: 0, padding: "14px 16px",
                borderBottom: "1px solid var(--cc-border)" } },
                h("strong", { style: { fontSize: "15px" } }, title),
                h("button", { type: "button", style: S.btn2, onClick: onClose,
                    "aria-label": "关闭弹窗", title: "关闭 (Esc)" }, "✕")),
            h("div", { style: { display: "flex", flexDirection: "column", gap: "12px",
                padding: "16px", overflowY: "auto", minHeight: 0, overscrollBehavior: "contain" } }, children))));
}

// ==================== 聚光灯式教程（详见 tutorial-design.md） ====================

const TUTORIALS = {
    basic: { name: "基础教程", steps: [
        {target: "model-dock", title: "生成一张图", text: "生成一张图，先选模型，再写提示词、定尺寸，最后点生成。这个教程只走最基本的一条路。"},
        {target: "model-base", title: "先选底模", text: "这里是当前底模。点开模型库可以换模型；新手建议先用 Anima，下一步会说明不同模型怎么选。"},
        {target: "model-guide", openModelGuide: true, title: "模型怎么选", text: "这里介绍常见模型类型、适合新手的模型和提示词写法。看完点下一步，回到工作台继续。"},
        {target: "prompt-positive", title: "写正向提示词", text: "在正向提示词框里写清主体、动作、场景和风格。先用一两句能看懂的描述，不必一开始堆很多词。"},
        {target: "image-size", title: "定尺寸", text: "比例预设和宽高都能改。先从 1:1、4:3、3:4 这类常见比例开始，尺寸也可以自己调；新手先别用 21:9 或很宽的 banner 比例。倍率先保持 1。"},
        {target: "generate", title: "生成", text: "点「生成」提交当前模型、提示词和尺寸。进度和排队状态显示在右上角。"},
        {target: "image-preview", title: "看结果", text: "生成完成后，最新结果会出现在这里。点图片可以打开大图查看细节。"},
    ]},
    model: { name: "模型与组件", steps: [
        {target: "model-dock", title: "模型配置模块", text: "这里是模型设置：选主模型、确认适配类型、添加生成时需要的组件。"},
        {target: "model-base", title: "底模选择", text: "这里显示当前主模型和预览图。点它可以打开模型库，换底模或其他模型。"},
        {target: "model-library", openModelLibrary: true, title: "打开模型库", text: "模型库用来浏览本地模型目录。选中模型后，在右侧确认预览和文件信息，再点「使用」替换当前底模。"},
        {target: "model-library-left", openModelLibrary: true, title: "左侧目录", text: "左边是模型文件夹和文件列表。上方路径显示当前位置，搜索框按文件名过滤，文件夹可以逐层展开。"},
        {target: "model-library-right", openModelLibrary: true, title: "右侧信息", text: "右边显示选中模型的预览图、大小、来源和「使用」按钮。确认是需要的模型后，再替换当前底模。"},
        {target: "model-profile", title: "适配类型", text: "这里显示当前模型的适配类型。它会影响提示词、采样参数和可用组件；换模型后要重新确认。"},
        {target: "model-profile-select", forceOpenAdapter: true, tooltipSide: "left", title: "选择适配类型", text: "展开后选择模型的适配类型。按模型实际训练方式选；不确定就保留推荐值。"},
        {target: "generation-controls", title: "生成时控制", text: "需要补充 VAE、文本编码器或 LoRA 时，从这里打开生成时控制。"},
        {target: "generation-panel", openGenerationControls: true, title: "生成时控制面板", text: "左边添加组件，右边管理已经添加的组件。"},
        {target: "generation-components", openGenerationControls: true, title: "可添加的组件", text: "左边列出 VAE、文本编码器和 LoRA。点选后从本地模型库选择文件；不需要的组件不用添加。"},
        {target: "generation-added", openGenerationControls: true, title: "已添加的组件", text: "右边显示已添加的组件。LoRA 可以单独开关、调强度或移除；VAE 和文本编码器会替换主模型自带的部分。"},
    ]},
    image: { name: "图片参数与生成", steps: [
        {target: "image-settings", title: "图片参数", text: "这里设置图片尺寸、采样方式、Seed 和保存位置。改这里只影响下一次生成；底部「生成后控制」可以在出图后继续放大、重绘细节或修复人脸。"},
        {target: "image-size", title: "尺寸与倍率", text: "比例和宽高决定基础尺寸；倍率把宽高按倍数放大或缩小，右侧预览会显示最终像素。"},
        {target: "image-sampling", title: "采样参数", text: "步数、CFG、采样器和调度器控制生成过程。没有把握就保留默认值；不同模型适用的范围不同。"},
        {target: "image-save", title: "保存位置", text: "打开「保存输出到本地」后，结果会保存到指定目录。目录留空时使用 ComfyUI 默认输出目录；文件名前缀用于区分本次任务。"},
        {target: "image-preview", title: "结果预览", text: "这里预览最近一次生成的结果，并显示最终尺寸。点击图片可以打开查看器，方便放大检查细节。"},
        {target: "generate", title: "开始生成", text: "确认模型、提示词和参数后点「生成」。进度和排队状态显示在右上角。"},
    ]},
    post: { name: "生成后处理", steps: [
        {target: "post-controls", title: "生成后处理设置", text: "这里是生成时自动执行的后处理设置。点生成后，插件先出图，再按这里的顺序继续处理；按钮后面是已经启用的处理。"},
        {target: "post-panel", openPostControls: true, title: "处理面板", text: "左边选要加的处理，右边排先后顺序，顶部决定最后留下哪些图。"},
        {target: "post-defaults", openPostControls: true, title: "添加处理", text: "左边可以加放大、重绘细节、人脸修复。点一下就加到右边；不需要就不用加。"},
        {target: "post-cells", openPostControls: true, title: "排顺序和改参数", text: "右边从上往下执行。每一步都能单独开关、改参数、上移、下移或删除；排好后再点生成。"},
        {target: "post-save", openPostControls: true, title: "保存哪些图", text: "可以只留最终图，也可以连处理前的原图一起留，或者每一步都留。一般只留最终图；想对比处理前后，就加上原图。"},
    ]},
    output: { name: "输出与查看", steps: [
        {target: "output-toolbar", title: "输出页工具栏", text: "这里切换填充或网格展示，调整预览画质，也可以刷新图库。右上角显示当前筛出的图片数量。"},
        {target: "output-controls", title: "搜索与筛选", text: "按文件名搜索，或按日期、尺寸、保存状态筛选；排序决定先看到哪一批图。"},
        {target: "output-results", title: "查看图片", text: "点图片打开大图查看器；滚动到底部会继续加载更多结果。"},
    ]},
    online: { name: "在线模型库", steps: [
        {target: "online-toolbar", title: "在线模型库", text: "这里选择模型来源、搜索模型，也可以筛选、查看下载任务和设置来源连接。"},
        {target: "online-filters", title: "筛选模型", text: "左边按排序、基底模型、模型类型和时间筛选；设置后结果会按条件更新。"},
        {target: "online-results", title: "查看和下载", text: "点模型卡片查看详情、预览图和下载选项；已经开始的下载任务在「查看下载」里。"},
    ]},
    connect: { name: "自动连接与关闭", steps: [
        {target: "connection-status", title: "自动检测连接", text: "插件会定期检测本机 ComfyUI：已运行就自动连接，停止后自动显示离线。自动检测不会启动或关闭 ComfyUI。"},
        {target: "connection-action", title: "离线时：连接 ComfyUI", text: "离线时点「连接 ComfyUI」，可以选择在浏览器打开或在后台运行。插件会复用已运行的服务；没有运行时才用配置的启动文件启动。"},
        {target: "connection-action", title: "在线时：完全关闭", text: "在线时按钮变为「关闭 ComfyUI」。点击后会立即终止正在生成的图片和全部排队任务，强制结束 ComfyUI 主进程及子进程，不会等待生成完成。"},
        {target: "connection-action", title: "关闭后的影响", text: "未保存的生成结果可能丢失，其他连接该服务的客户端也会断开。已加载模型占用的显存由系统在进程退出后回收；这与只卸载模型、不关闭服务的「释放显存」不同。无法确认进程身份时会安全拒绝关闭。"},
        {target: "connection-settings", title: "配置启动文件", text: "如果 ComfyUI 没有运行，启动前需要先配置本地启动文件。下一步会自动打开「连接设置」。"},
        {target: "start-script", title: "填写启动路径", openSettings: true, text: "这里填写你已经安装的 ComfyUI 启动文件完整路径，例如 D:\\ComfyUI\\ComfyUI_Windows_portable\\run_nvidia_gpu.bat。教程结束后才可以编辑输入框。"},
        {target: "save-connection-settings", title: "保存设置", openSettings: true, text: "填写完成后点击「保存启动设置」。之后无需重复填写；如果 ComfyUI 已经在运行，插件仍会自动连接。"},
    ]},
    startPath: { name: "设置 ComfyUI 启动路径", steps: [
        {target: "connection-action", title: "需要先配置启动路径", text: "没有检测到可用的 ComfyUI 启动文件。插件不会替你安装 ComfyUI，也不会猜测并执行不确定的文件。"},
        {target: "connection-settings", title: "找到连接设置", text: "启动路径在右上角「连接设置」里。点「下一步」会自动打开设置窗口。"},
        {target: "start-script", title: "填写本机启动文件", openSettings: true, text: "这里需要填写启动文件的绝对路径，例如 Windows 便携版的 run_nvidia_gpu.bat，或 Linux 版的启动 .sh 文件。请先记住位置，完成教程后再填写。"},
        {target: "save-connection-settings", title: "保存后连接", openSettings: true, text: "教程结束后输入路径，点击「保存启动设置」，再点击「连接 ComfyUI」。插件会启动服务并自动等待连接成功。"},
    ]},
    prompt: { name: "提示词编辑器", steps: [
        {target: "prompt-module", title: "提示词编辑器", text: "这里编辑正向、负向提示词，支持本地 Tag 补全、预览、撤回重做和 AI 辅助。"},
        {target: "prompt-positive", title: "正向提示词", text: "输入希望画面出现的内容。输入中文或英文 Tag 时会根据本地词库列出匹配项、译名和相关候选；选择候选只替换当前正在输入的 Tag。输入框底部连接着三横线拖拽区，鼠标移上会变成上下双向箭头；按住上下拖动可调整高度，大小会自动记住。"},
        {target: "prompt-negative", title: "负向提示词", text: "这里填写希望模型避免的内容。它与正向提示词一样支持中英文补全、标点规范化和独立高度记忆；底部三横线拖拽区也可独立调整高度。提示词修改都会进入同一套撤回历史。"},
        {target: "prompt-history", title: "撤回与重做", text: "这两个按钮恢复或重做提示词修改。除手动输入外，AI 扩写、对话采用结果、清空、候选补全和已保存提示词等操作也会进入历史；连续输入会适当合并，避免一次只撤回一个字符。"},
        {target: "prompt-preview", title: "切换预览", text: "按「原文 → 标签 → 中文标签 → 原文」循环查看。切换只改变输入框中的内容表现，不改变输入框尺寸、滚动区域或底部拖拽把手；标签预览可以删除单项并调整权重，中文标签只用于查看，不会把中文写回真正发送给 ComfyUI 的提示词。"},
        {target: "prompt-weight-language", title: "权重转语言", text: "把 (tag:1.3) 这类数值权重交给 DSH AI 改成自然语言强调，正负提示词一起处理，不额外扩写。运行时会锁定编辑；悬停加载按钮可停止。结果可撤回。"},
        {target: "prompt-expand", title: "AI 扩写", text: "让 DSH AI 基于当前正向和负向提示词进行扩写。扩写期间提示词暂时锁定，按钮显示加载动画；鼠标移到按钮上会变成停止图标，可以中止本次扩写。成功后整次修改可撤回。"},
        {target: "prompt-chat", title: "对话编辑", text: "点这里会在提示词右侧展开对话编辑区，可以用自然语言提出局部修改要求。下一步会自动展开聊天区供你查看。"},
        {target: "prompt-chat-panel", title: "对话编辑区", openPromptChat: true, text: "在这里描述要怎样改提示词。AI 返回后先看完整正/负提示词，再决定是否采用；点「采用」才会写回提示词，并进入撤回历史。聊天记录只保留到本次 DSH 运行结束。"},
        {target: "prompt-clear", title: "清空提示词", text: "叉号会同时清空正向和负向提示词。清空也可以撤回，误点后用上方撤回恢复。"},
    ]},
};

const TUTORIAL_GROUPS = [
    {key:'workbench', label:'工作台', items:['basic','prompt','model','image','post']},
    {key:'output', label:'输出页面', items:['output']},
    {key:'online', label:'在线图库', items:['online']},
    {key:'connection', label:'连接与启动', items:['connect','startPath']},
];

function ErrorLogModal({logs,theme,onClose}) {
    const text=JSON.stringify(logs,null,2);
    const copy=async()=>{
        try{await navigator.clipboard.writeText(text);}catch{
            const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
        }
    };
    const download=()=>{
        const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='dsh-comfy-error-log-'+new Date().toISOString().slice(0,10)+'.json';a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    return h(OverlayModal,{title:'错误日志',width:760,theme,onClose},
        h('div',{style:{display:'flex',flexDirection:'column',gap:10,minHeight:0}},
            h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',fontSize:12}},
                h('span',{style:S.dim},'本设备：'+errorLogDeviceId()+' · 已记录 '+logs.length+' / '+ERROR_LOG_MAX+' 条'),
                h('button',{type:'button',style:S.btn2,onClick:copy,disabled:!logs.length},'复制给开发者'),
                h('button',{type:'button',style:S.btn2,onClick:download,disabled:!logs.length},'下载 JSON'),
                h('button',{type:'button',style:S.btn2,onClick:()=>{if(window.confirm('清空本设备错误日志？')){clearClientErrors();onClose();}}},'清空')),
            h('p',{style:{...S.dim,margin:0,lineHeight:1.6}},'日志只保存在当前设备浏览器，不会自动上传。复制或下载后发给开发者；已对 token、API key、密码等字段做脱敏。'),
            !logs.length
                ? h('div',{style:{...S.card,color:'var(--cc-muted)'}},'当前设备还没有记录到错误。')
                : h('div',{style:{display:'flex',flexDirection:'column',gap:8,maxHeight:'52vh',overflow:'auto'}},
                    logs.slice().reverse().slice(0,100).map((entry,index)=>
                        h('details',{key:entry.ts+index,className:'cc-error-log-row'},
                            h('summary',{style:{cursor:'pointer',fontSize:12,lineHeight:1.5}},
                                h('strong',null,entry.message||'未知错误'),
                                h('span',{style:{color:'var(--cc-muted)'}},' · '+(entry.context||'')),
                                h('small',{style:{display:'block',color:'var(--cc-muted)'}},entry.ts+(entry.extra?' · '+entry.extra:''))),
                            entry.stack?h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,color:'var(--cc-muted)',margin:'6px 0 0'}},entry.stack):null)))
        ));
}

function ComfyUpdateModal({info,busy,error,theme,onClose,onUpdate}) {
    const current=info?.current||'未知',latest=info?.latest||'未知',blocked=!!info?.busy;
    return h(OverlayModal,{title:'更新 ComfyUI',width:560,theme,onClose},
        h('div',{style:{display:'flex',flexDirection:'column',gap:11,fontSize:13,lineHeight:1.65}},
            h('div',{style:{fontWeight:700,fontSize:14}},'ComfyUI 有新版本可用'),
            h('div',null,'当前版本：',h('strong',null,'v'+current),'  →  最新版本：',h('strong',null,'v'+latest)),
            h('p',{style:{margin:0,color:'var(--cc-muted)'}},'更新会先停止 ComfyUI，切换到最新版本、安装依赖并重新启动。models、output 和 custom_nodes 不会被删除；对 ComfyUI 源码做过的本地修改会被覆盖。'),
            blocked?h('div',{style:{color:'var(--cc-warn)'}},'还有任务在队列中，请等待生成完成后再更新。'):null,
            info?.error?h('div',{style:{color:'var(--cc-bad)'}},'检查更新失败：'+info.error):null,
            error?h('div',{style:{color:'var(--cc-bad)'}},error):null,
            h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}},
                h('button',{type:'button',style:S.btn2,disabled:busy,onClick:onClose},'取消'),
                h('button',{type:'button',style:S.btn,disabled:busy||blocked,onClick:onUpdate},busy?'正在更新…':'更新')))
    );
}

function ModelTypeGuide({theme,onClose}) {
    const cards=[
        {name:'Anima',tag:'推荐新手',body:'动漫、插画风格，参数简单。自然语言和标签都支持。常用 1024×1024、20–30 步、CFG 4；Turbo 版用 8 步、CFG 1。提示词可以先写主体和场景，再加风格、光线标签，不需要堆很多质量词。'},
        {name:'SDXL / Illustrious / Pony',tag:'动漫与 2D',body:'生态成熟、LoRA 多。多用 1024 左右尺寸，提示词以逗号分隔的标签为主：主体、外观、动作、场景、风格；负向提示词写不想出现的内容。'},
        {name:'FLUX.1 / FLUX.2',tag:'写实与文字',body:'写实、文字和复杂场景表现好，显存占用也更高。提示词用完整自然语言句子；FLUX 通常不需要负向提示词，参数按模型推荐值来。'},
        {name:'SD3.5 / Qwen-Image / Z-Image',tag:'通用与中文',body:'通用写实、插画和中文文字都能做。用自然语言描述主体、场景、构图和风格；不同模型的步数、CFG 和分辨率要求不同，先看推荐值。'},
    ];
    return h(OverlayModal,{title:'模型怎么选',width:980,theme,guideTarget:'model-guide',onClose},
        h('div',{className:'cc-model-guide'},
            h('p',{className:'cc-model-guide-lead'},'先选风格方向，再看模型。新手建议从 ',h('strong',null,'Anima'),' 开始：动漫插画、参数简单，出问题也容易判断。'),
            h('div',{className:'cc-model-guide-grid'},...cards.map(card=>h('section',{key:card.name,className:'cc-model-guide-card'},
                h('div',{className:'cc-model-guide-card-head'},h('strong',null,card.name),h('span',null,card.tag)),
                h('p',null,card.body)))),
            h('section',{className:'cc-model-guide-section'},h('strong',null,'其他常见类型'),
                h('ul',null,
                    h('li',null,'SD1.5 / SD2.x：512–768 左右，标签式提示词，模型小、LoRA 多，适合轻量或旧模型。'),
                    h('li',null,'HiDream / Chroma / Lumina：偏插画或艺术风格，用自然语言描述，参数按各自模型推荐。'),
                    h('li',null,'Hunyuan Image / MOSS / Krea 2：较新的通用模型，写实或设计场景；显存和参数要求更高，先看推荐值。'))),
            h('section',{className:'cc-model-guide-section'},h('strong',null,'提示词怎么写'),
                h('ul',null,
                    h('li',null,'标签式（SD1.5、SDXL、Illustrious、Pony）：主体、外观、动作、场景、风格用逗号分开；负向写不想出现的内容。'),
                    h('li',null,'自然语言（FLUX、SD3.5、Qwen-Image、Z-Image）：用完整句子说清主体、环境、光线和构图，不需要堆标签。'),
                    h('li',null,'Anima：自然语言和标签可以混用；先用一句主体和场景，再加风格、光线标签，写清楚后再逐步加细节。'))),
            h('section',{className:'cc-model-guide-section'},h('strong',null,'新手先这样用'),
                h('p',null,'选 Anima Base，尺寸从 1024 左右或常见比例开始，步数 20–30、CFG 先用推荐值。第一张只写“主体 + 场景 + 风格”三句话，满意后再加细节或 LoRA。'))));
}

function spotlightGeometry(rect, vw, vh) {
    if (!rect || rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) return null;
    const pad = 5;
    const left = Math.max(3, rect.left - pad), top = Math.max(3, rect.top - pad);
    return {left, top, width: Math.max(1, Math.min(vw - left - 3, rect.right - rect.left + pad * 2)),
        height: Math.max(1, Math.min(vh - top - 3, rect.bottom - rect.top + pad * 2))};
}

function tooltipGeometry(box, vw, vh, side = "auto") {
    const margin = 12, width = Math.min(380, Math.max(1, vw - margin * 2));
    if (!box) return {position: "fixed", width: "calc(100vw - 24px)", maxWidth: 380,
        maxHeight:"calc(100dvh - 24px)", left: "50%", top: "50%", transform: "translate(-50%, -50%)"};
    const sideLeft = box.left - width - margin, sideRight = box.left + box.width + margin;
    if (side === "left" && sideLeft >= margin) {
        const top = Math.max(margin, Math.min(box.top, vh - 220));
        return {position: "fixed", left: sideLeft, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.max(120, Math.min(420, vh - top - margin))};
    }
    if (side === "right" && sideRight + width <= vw - margin) {
        const top = Math.max(margin, Math.min(box.top, vh - 220));
        return {position: "fixed", left: sideRight, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.max(120, Math.min(420, vh - top - margin))};
    }
    const left = Math.max(margin, Math.min(vw - width - margin, box.left + box.width / 2 - width / 2));
    const placeAbove = box.top > vh * .55;
    const below = box.top + box.height + 14, above = box.top - 300;
    const top = placeAbove ? Math.max(margin, above) : Math.max(margin, Math.min(below, Math.max(margin, vh - 220)));
    const maxHeight = Math.max(120, Math.min(420, vh - top - margin));
    return {position: "fixed", left, top, width, maxWidth: "calc(100vw - 24px)", maxHeight};
}
/** 教程浮层不允许用户直接点击高亮目标；仅底部三个导航按钮可操作。 */

function SpotlightTutorial({guide, stepIndex, onBack, onNext, onSkip, theme, rootRef}) {
    const step = TUTORIALS[guide]?.steps[stepIndex];
    const [focusBox, setFocusBox] = React.useState(null);
    const tipRef = React.useRef(null);
    React.useEffect(() => {
        if (!step || typeof document === "undefined") return;
        let timer = null, frame = null;
        const measure = () => {
            const target = document.querySelector('[data-cc-guide="' + step.target + '"]');
            const rect = target && target.getBoundingClientRect();
            setFocusBox(spotlightGeometry(rect, window.innerWidth, window.innerHeight));
        };
        const update = () => {
            const target = document.querySelector('[data-cc-guide="' + step.target + '"]');
            if (!target) { setFocusBox(null); return; }
            const rect = target.getBoundingClientRect();
            const vh = window.innerHeight, top = 64, bottom = 24;
            if (rect.top < top || rect.bottom > vh - bottom) {
                if (target.scrollIntoView) {
                    const block = rect.height > vh - top - bottom ? "start" : "center";
                    target.scrollIntoView({block, inline: "nearest", behavior: "auto"});
                }
                if (frame) cancelAnimationFrame(frame);
                frame = requestAnimationFrame(measure);
            } else measure();
        };
        update();
        timer = setTimeout(update, 90); // Portal 中的主弹窗可能晚一帧完成挂载。
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => { clearTimeout(timer); if (frame) cancelAnimationFrame(frame);
            window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
    }, [guide, stepIndex, step?.target, step?.openSettings]);
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const before = document.activeElement;
        const tip = tipRef.current;
        const buttons = () => tip ? [...tip.querySelectorAll("button:not([disabled])")] : [];
        const focus = () => { const b = buttons(); if (b.length) (b.find(x => x.dataset.guideNext === "true") || b[0]).focus(); };
        focus();
        const focusTimer = setTimeout(focus, 0); // 设置弹窗可能在同一帧挂载并尝试抢焦点。
        const enforceFocus = (e) => {
            if (tip && !tip.contains(e.target)) {
                e.stopPropagation();
                const b = buttons();
                if (b.length && document.activeElement !== b[0]) b[0].focus();
            }
        };
        document.addEventListener("focusin", enforceFocus, true);
        const trap = (e) => {
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); return; }
            if (e.key !== "Tab") {
                if (!tip?.contains(e.target) || !["Enter", " "].includes(e.key)) {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
                }
                return;
            }
            e.stopPropagation(); e.stopImmediatePropagation?.();
            const b = buttons(); if (!b.length) { e.preventDefault(); return; }
            const i = b.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); b[b.length - 1].focus(); }
            else if (!e.shiftKey && (i === b.length - 1 || i < 0)) { e.preventDefault(); b[0].focus(); }
        };
        const blockScroll = (e) => { if (!tip?.contains(e.target)) e.preventDefault(); };
        document.addEventListener("keydown", trap, true);
        document.addEventListener("wheel", blockScroll, {capture:true, passive:false});
        document.addEventListener("touchmove", blockScroll, {capture:true, passive:false});
        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener("focusin", enforceFocus, true);
            document.removeEventListener("keydown", trap, true);
            document.removeEventListener("wheel", blockScroll, true);
            document.removeEventListener("touchmove", blockScroll, true);
            if (before?.isConnected && before.focus) before.focus();
        };
    }, [guide, stepIndex]);
    if (!step) return null;
    const count = TUTORIALS[guide].steps.length;
    return floating(h("div", {className:"dsh-comfy-floating cc-tutorial-overlay", role:"presentation",
        style:Object.assign({}, theme || {}, {position:"fixed", inset:0, zIndex:2147482500,
            background:focusBox ? "transparent" : "rgba(0,0,0,.76)", pointerEvents:"auto", touchAction:"auto"}),
        onPointerDown:(e)=>{e.stopPropagation();e.preventDefault();},
        onClick:(e)=>{if (!tipRef.current?.contains(e.target)) {e.stopPropagation();e.preventDefault();}}},
        focusBox ? h("div", {"data-cc-spotlight":step.target, "aria-hidden":"true", style:{
            position:"fixed", ...focusBox, borderRadius:10, border:"2px solid var(--cc-accent)",
            boxShadow:"0 0 0 200vmax rgba(0,0,0,.76), 0 0 0 4px rgba(255,255,255,.18)",
            pointerEvents:"none"}}) : null,
        h("section", {ref:tipRef, role:"dialog", "aria-modal":"true", "aria-label":TUTORIALS[guide].name,
            className:"cc-tutorial-tooltip", style:Object.assign({}, tooltipGeometry(focusBox, window.innerWidth, window.innerHeight, step.tooltipSide), {
                zIndex:1, overflowY:"auto", overscrollBehavior:"contain",
                padding:"16px", borderRadius:12, background:"var(--cc-surface)", color:"var(--cc-text)",
                border:"1px solid var(--cc-border)", boxShadow:"0 16px 48px rgba(0,0,0,.55)",
                display:"flex", flexDirection:"column", gap:10, touchAction:"auto"}),
            onPointerDown:(e)=>e.stopPropagation(), onClick:(e)=>e.stopPropagation()},
            h("div", {style:{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}},
                h("strong", {style:{fontSize:14}}, step.title),
                h("span", {style:S.dim}, (stepIndex+1)+" / "+count)),
            h("p", {style:{margin:0,fontSize:13,lineHeight:1.7,overflowWrap:"anywhere"}}, step.text),
            h("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:4}},
                h("button", {type:"button",style:S.btn2,onClick:onSkip}, "跳过"),
                h("div", {style:{display:"flex",gap:7}},
                    h("button", {type:"button",style:S.btn2,disabled:stepIndex===0,onClick:onBack,
                        "aria-label":"上一步"}, "←"),
                    h("button", {type:"button",style:S.btn,onClick:onNext,"data-guide-next":"true"},
                        stepIndex+1===count ? "完成 →" : "下一步 →"))))));
}

// Current-tag parsing keeps existing separators, escapes and weight wrappers intact.

function promptTagRange(value, start, end = start) {
    value = String(value || "");
    if (!Number.isInteger(start) || start !== end || start < 0 || start > value.length) return null;
    const escaped = i => {let n=0;while(i>0 && value[--i]==="\\")n++;return n%2===1;};
    let left=start, right=start;
    const sep=(c,i)=>[",","，","\n","\r"].includes(c) && !escaped(i);
    while(left>0 && !sep(value[left-1],left-1))left--;
    while(right<value.length && !sep(value[right],right))right++;
    while(left<right && /\s/.test(value[left]))left++;
    while(right>left && /\s/.test(value[right-1]))right--;
    // Weight groups may span several comma-separated tags; only strip syntax at edges.
    while(left<right && /[([]/.test(value[left]) && !escaped(left))left++;
    while(right>left && /[)\]]/.test(value[right-1]) && !escaped(right-1))right--;
    const segment=value.slice(left,right), weight=segment.match(/(?<!\\):\s*[-+]?\d*(?:\.\d*)?\s*$/);
    if(weight)right=left+weight.index;
    while(right>left && /\s/.test(value[right-1]))right--;
    if(start<left || start>right || right<=left)return null;
    const query=value.slice(left,Math.min(start,right)).trim();
    // Do not treat LoRA syntax, scheduled prompts, BREAK or other control syntax as tags.
    if(!query || /[<>:|\[\]]/.test(query) || /^BREAK$/i.test(query))return null;
    return {start:left,end:right,query};
}

function replacePromptTag(value, range, item, underscores = false) {
    let output=String(item.output || "");
    if(item.kind === "tag") {
        if(!underscores)output=output.replace(/_/g," ");
        // Raw Danbooru names may contain literal parentheses. Prompt grammar needs escapes.
        output=output.replace(/(?<!\\)([()[\]])/g,"\\$1");
    }
    return {value:value.slice(0,range.start)+output+value.slice(range.end),caret:range.start+output.length};
}

function completionGeometry(point, vw, vh) {
    const width=Math.max(1,Math.min(430,vw-16));
    const below=vh-point.bottom-8, above=point.top-8;
    const height=Math.max(1,Math.min(280,Math.max(below,above)));
    return {left:Math.max(8,Math.min(vw-width-8,point.left)),width,
        top:below>=height?Math.max(8,point.bottom):Math.max(8,point.top-height),maxHeight:height};
}

function promptCaretPoint(node) {
    const rect=node.getBoundingClientRect();
    if(typeof document==="undefined" || !window.getComputedStyle)return rect;
    const style=window.getComputedStyle(node),mirror=document.createElement("div");
    for(const k of ["fontFamily","fontSize","fontWeight","fontStyle","lineHeight","letterSpacing","wordSpacing",
        "paddingTop","paddingRight","paddingBottom","paddingLeft","borderTopWidth","borderLeftWidth","boxSizing","tabSize"])
        mirror.style[k]=style[k];
    Object.assign(mirror.style,{position:"fixed",visibility:"hidden",whiteSpace:"pre-wrap",overflowWrap:"break-word",
        left:rect.left+"px",top:rect.top+"px",width:node.clientWidth+"px",height:"auto"});
    mirror.textContent=node.value.slice(0,node.selectionStart);
    const marker=document.createElement("span");marker.textContent="\u200b";mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const at=marker.getBoundingClientRect();mirror.remove();
    const top=Math.max(rect.top,Math.min(rect.bottom-20,at.top-node.scrollTop));
    return {left:Math.max(rect.left,Math.min(rect.right,at.left-node.scrollLeft)),top,bottom:top+(parseFloat(style.lineHeight)||20)};
}

const COMPLETION_RELATIONS={exact:"精确",prefix:"前缀",alias:"别名",same_concept:"同义项",equivalent:"等价",
    similar:"相近",broader:"上位",narrower:"更具体",related:"相关",opposite:"相反",implies:"蕴含 →",more_specific:"更具体 ←",entry:"词条"};

async function dictionaryRequest(path, body, method = body === undefined ? "GET" : "POST", signal) {
    await requireCompatibleSidecar(EXPANDER + "/dictionary/" + path);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    const abort=()=>controller.abort();
    if(signal?.aborted)controller.abort();
    signal?.addEventListener("abort",abort,{once:true});
    try {
        const r=await fetch(EXPANDER+"/dictionary/"+path,{method,signal:controller.signal,
            headers:{...instanceHeaders(),...(body===undefined?{}:{"Content-Type":"application/json"})},
            ...(body===undefined?{}:{body:JSON.stringify(body)})});
        const data=await r.json();
        if(!r.ok)throw new Error(data.error || "词库请求失败");
        return data;
    } finally {clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}

async function migrateLegacyDictionary() {
    const stored=window.localStorage.getItem(LS_KEY);
    let legacy;
    try {legacy=stored?JSON.parse(stored):{};} catch(e) {throw new Error("旧设置无法解析；请先导出浏览器数据");}
    const backupKey="dsh-comfyui-console/legacy-backup/v1";
    // A failed backup stops migration. Never mark success before server commit.
    if(!window.localStorage.getItem(backupKey)) {
        window.localStorage.setItem(backupKey,stored || "{}");
        if(window.localStorage.getItem(backupKey)!==(stored || "{}"))throw new Error("无法保留旧词库备份");
    }
    const result=await dictionaryRequest("migrate/legacy",{frags:legacy.frags || {}});
    USER.dictionaryMigration={digest:result.digest,version:1};
    lsWrite({dictionaryMigration:USER.dictionaryMigration});
    // Keep frags, presets, last, tutorial state and the full backup unchanged.
    return result;
}

function useTagCompletion({updatePrompt,promptRef,expandPhaseRef,theme,enabled=true,underscores=false,category=""}) {
    const [popup,setPopup]=React.useState(null),[active,setActive]=React.useState(0);
    const request=React.useRef({seq:0,timer:null,controller:null});
    const composing=React.useRef(false),latest=React.useRef(null),menuRef=React.useRef(null);
    function close() {
        request.current.seq++;clearTimeout(request.current.timer);request.current.controller?.abort();
        latest.current=null;setPopup(null);
    }
    function inspect(kind,node) {
        if(!enabled || composing.current || expandPhaseRef.current!=="idle" || !node || node.disabled){close();return;}
        const range=promptTagRange(node.value,node.selectionStart,node.selectionEnd);
        if(!range){close();return;}
        const value=node.value, caret=node.selectionStart, seq=++request.current.seq;
        clearTimeout(request.current.timer);request.current.controller?.abort();setPopup(null);
        latest.current={kind,node,value,range,caret};
        request.current.timer=setTimeout(async()=>{
            const controller=new AbortController();request.current.controller=controller;
            try {
                const data=await dictionaryRequest("search?q="+encodeURIComponent(range.query)+"&limit=30&completion=1&category="+encodeURIComponent(category),undefined,"GET",controller.signal);
                if(seq!==request.current.seq || controller.signal.aborted || expandPhaseRef.current!=="idle" ||
                    composing.current || node.value!==value || node.selectionStart!==caret || node.selectionStart!==node.selectionEnd ||
                    promptTagRange(node.value,node.selectionStart,node.selectionEnd)?.start!==range.start)return;
                if(!data.items?.length)return;
                setActive(0);setPopup({...latest.current,items:data.items,
                    geometry:completionGeometry(promptCaretPoint(node),window.innerWidth,window.innerHeight)});
            } catch(e) {/* Offline dictionary leaves the ordinary editor fully usable. */}
        },130);
    }
    function choose(item) {
        const cur=latest.current;
        if(!cur || composing.current || expandPhaseRef.current!=="idle")return;
        const {node,kind,range,value}=cur;
        if(node.value!==value || node.selectionStart!==cur.caret || node.selectionEnd!==cur.caret || promptRef.current[kind]!==value){close();return;}
        const next=replacePromptTag(value,range,item,underscores);
        close();updatePrompt({[kind]:next.value},"action");
        setTimeout(()=>{if(node.isConnected){node.focus();node.setSelectionRange(next.caret,next.caret);}},0);
    }
    function keys(e) {
        if(composing.current || e.isComposing || e.nativeEvent?.isComposing || e.keyCode===229)return;
        if(!popup || expandPhaseRef.current!=="idle")return;
        if(["ArrowDown","ArrowUp","Enter","Tab","Escape"].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();e.stopPropagation();
            if(e.key==="Escape")close();
            else if(e.key==="ArrowDown" || e.key==="ArrowUp")setActive(i=>(i+(e.key==="ArrowDown"?1:-1)+popup.items.length)%popup.items.length);
            else choose(popup.items[active]);
        }
    }
    React.useEffect(()=>{
        if(typeof document==="undefined")return;
        const outside=e=>{if(latest.current?.node===e.target || menuRef.current?.contains(e.target))return;close();};
        const reposition=()=>{if(latest.current?.node && popup)setPopup(p=>p?{...p,geometry:completionGeometry(promptCaretPoint(latest.current.node),window.innerWidth,window.innerHeight)}:null);};
        document.addEventListener("pointerdown",outside,true);
        window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);
        return ()=>{document.removeEventListener("pointerdown",outside,true);window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true);};
    },[!!popup]);
    React.useEffect(()=>{menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"});},[active]);
    React.useEffect(()=>()=>{request.current.seq++;clearTimeout(request.current.timer);request.current.controller?.abort();},[]);
    return {
        close,
        props(kind) {return {
            role:"combobox","aria-autocomplete":"list","aria-controls":"cc-tag-completion",
            "aria-expanded":!!popup && popup.kind===kind,
            "aria-activedescendant":popup?.kind===kind?"cc-tag-option-"+active:undefined,
            onKeyDown:keys,onKeyUp:e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key))inspect(kind,e.currentTarget);},
            onClick:e=>inspect(kind,e.currentTarget),onScroll:()=>close(),
            onBlur:()=>close(),
            onCompositionStart:()=>{composing.current=true;close();},
            onCompositionEnd:e=>{composing.current=false;inspect(kind,e.currentTarget);},
            onSelect:e=>{if(latest.current && (e.currentTarget.selectionStart!==latest.current.caret || e.currentTarget.selectionEnd!==latest.current.caret))inspect(kind,e.currentTarget);},
        };},
        changed:inspect,
        render() {return popup && expandPhaseRef.current==="idle" && enabled ? floating(h("div",{
            id:"cc-tag-completion",ref:menuRef,role:"listbox","aria-label":"Tag 候选",
            className:"dsh-comfy-floating cc-tag-completion",style:{...theme,position:"fixed",zIndex:2147480600,...popup.geometry},
            onMouseDown:e=>e.preventDefault()},
            popup.items.map((item,i)=>h("button",{key:item.id,id:"cc-tag-option-"+i,role:"option",type:"button",tabIndex:-1,
                "aria-selected":i===active,"data-active":i===active?"true":"false",className:"cc-tag-option",
                onMouseEnter:()=>setActive(i),onClick:()=>choose(item)},
                h("span",{className:"cc-tag-heading"},h("strong",null,item.label),h("small",null,item.kind==="snippet"?"片段":COMPLETION_RELATIONS[item.relation] || item.relation)),
                h("span",{className:"cc-tag-output"},item.output),
                item.sense && item.sense!==item.label?h("small",{className:"cc-tag-sense"},"义项："+item.sense):null,
                item.translations?.some(t=>t!==item.label)?h("small",{className:"cc-tag-sense"},"其他译名："+item.translations.filter(t=>t!==item.label).join(" / ")):null,
                h("small",null,item.category+" · "+item.source+(item.confidence<.6?" · 候选译名":"")))))) : null;},
    };
}



// ==================== 主组件 ====================
/** Reuse the existing spinner icon and button theme for cancellable tasks. */

function TaskAction({busy=false,stopping=false,label,busyLabel,onStart,onStop,disabled=false,style=S.btn2}) {
    return h("span",{className:"cc-task-action"},
        h("button",{type:"button",className:"cc-task-primary",style,disabled:disabled||busy||stopping,onClick:onStart,"aria-busy":busy||stopping},
            busy||stopping?h("span",{className:"cc-icon-spinner","aria-hidden":"true"},h(PromptIcon,{name:"spinner",size:13})):null,
            h("span",{className:"cc-task-label"},stopping?"正在停止…":busy?(busyLabel||label):label)),
        busy||stopping?h("button",{type:"button",className:"cc-task-stop",style:S.btn2,disabled:stopping||!onStop,onClick:onStop,"aria-label":"停止"+label},
            h(PromptIcon,{name:"stop",size:13}),h("span",null,"停止")):null);
}


function OutputPreviewPicker({item,theme,onClose,onSaved}){
    const [data,setData]=React.useState(null),[error,setError]=React.useState(''),[selected,setSelected]=React.useState(''),[busy,setBusy]=React.useState(false);
    const alive=React.useRef(true),posting=React.useRef(false);
    const source={path:item.path||'',image:item.imageInfo,prompt_id:item.promptId};
    const key=row=>JSON.stringify([row.kind,row.name,row.root_id]);
    React.useEffect(()=>{alive.current=true;const ctl=new AbortController();
        jpost(EXPANDER+'/outputs/preview-targets',source,30000,ctl.signal).then(r=>{if(!alive.current)return;setData(r);if(r.items.length===1)setSelected(key(r.items[0]));}).catch(e=>{if(alive.current&&!ctl.signal.aborted)setError(errText(e));});
        return()=>{alive.current=false;ctl.abort();};
    },[outputKey(item)]);
    async function save(){if(posting.current)return;const target=data?.items.find(r=>key(r)===selected);if(!target)return;posting.current=true;setBusy(true);setError('');
        try{const saved=await jpost(EXPANDER+'/outputs/add-preview',{...source,target},60000);if(alive.current){onSaved(target,saved);onClose();}}
        catch(e){if(alive.current)setError(errText(e));}finally{posting.current=false;if(alive.current)setBusy(false);}}
    return h(OverlayModal,{title:'加入模型预览图',theme,width:620,zIndex:2147483500,onClose:()=>{if(!posting.current)onClose();}},
        error?h('div',{role:'alert',style:S.bad},error):null,
        !data&&!error?h('div',{role:'status'},h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner',size:15})),' 正在核验这张图片使用的模型…'):null,
        data?h(React.Fragment,null,h('span',{style:S.dim},'选择这张图片实际使用的模型'),
            data.items.length?h('div',{className:'cc-output-preview-targets'},data.items.map(row=>h('label',{key:key(row),className:'cc-output-preview-target'},
                h('input',{type:'radio',name:'preview-target',checked:selected===key(row),disabled:busy,onChange:()=>setSelected(key(row))}),h('span',null,h('strong',null,row.name),h('small',null,(row.label||row.kind)+' · '+row.path))))):h('div',{role:'status',style:S.dim},'没有可确认的本地模型。'),
            data.warnings?.length?h('details',null,h('summary',{className:'cc-summary'},'部分模型不可选'),data.warnings.map((w,i)=>h('div',{key:i,style:S.dim},w))):null):null,
        h('div',{className:'cc-dict-toolbar',style:{justifyContent:'flex-end'}},h('button',{type:'button',style:S.btn2,onClick:onClose,disabled:busy},'取消'),h('button',{type:'button',style:S.btn,onClick:save,disabled:busy||!selected},busy?'正在保存…':'保存预览图')));
}


function ModelPreviewEditor({model,theme,onClose,onChanged}){
    const [previews,setPreviews]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[selectedKey,setSelectedKey]=React.useState(''),[confirmDelete,setConfirmDelete]=React.useState(false),[dimensions,setDimensions]=React.useState({}),[failed,setFailed]=React.useState({}),[retry,setRetry]=React.useState(0);
    const task=React.useRef({seq:0,ctl:null,posting:false}),editorRef=React.useRef(null),confirmRef=React.useRef(null),deleteRef=React.useRef(null),restoreFocus=React.useRef(false);
    const keyOf=p=>p?String(p.id||p.url):'',modelKey=JSON.stringify([model.kind,model.name,model.root_id]);
    React.useEffect(()=>{
        const seq=++task.current.seq,ctl=new AbortController();task.current.ctl?.abort();task.current.ctl=ctl;task.current.posting=false;
        setPreviews(null);setError('');setBusy(false);setConfirmDelete(false);setSelectedKey('');setDimensions({});setFailed({});restoreFocus.current=false;
        jget(EXPANDER+'/models/detail?kind='+encodeURIComponent(model.kind)+'&name='+encodeURIComponent(model.name)+'&root_id='+encodeURIComponent(model.root_id),20000,ctl.signal)
            .then(r=>{if(task.current.seq!==seq||ctl.signal.aborted)return;const rows=r.previews||[];setPreviews(rows);setSelectedKey(keyOf(rows[0]));})
            .catch(e=>{if(task.current.seq===seq&&!ctl.signal.aborted)setError(errText(e));});
        return()=>{if(task.current.seq===seq){task.current.seq++;task.current.ctl?.abort();task.current.ctl=null;task.current.posting=false;}};
    },[modelKey,retry]);
    React.useEffect(()=>{if(confirmDelete)confirmRef.current?.focus();},[confirmDelete]);
    React.useEffect(()=>{if(!restoreFocus.current)return;restoreFocus.current=false;
        const editor=editorRef.current,target=editor?.querySelector('button[aria-pressed="true"]')||editor?.closest('[role="dialog"]')?.querySelector('[aria-label="关闭弹窗"]');target?.focus({preventScroll:true});
    },[previews]);
    async function manage(action,id){
        if(task.current.posting||!id||!previews?.some(p=>p.id===id))return;
        const seq=task.current.seq,ctl=new AbortController();task.current.ctl?.abort();task.current.ctl=ctl;task.current.posting=true;
        setBusy(true);setError('');setConfirmDelete(false);
        try{const r=await jpost(EXPANDER+'/models/previews/manage',{...model,action,id},20000,ctl.signal);
            if(task.current.seq!==seq||ctl.signal.aborted)return;
            const rows=r.previews||[];restoreFocus.current=true;setPreviews(rows);setSelectedKey(prev=>rows.some(p=>keyOf(p)===prev)?prev:keyOf(rows[0]));onChanged?.(r);
        }catch(e){if(task.current.seq===seq&&!ctl.signal.aborted){setError(errText(e));deleteRef.current?.focus();}}
        finally{if(task.current.seq===seq){task.current.posting=false;task.current.ctl=null;setBusy(false);}}
    }
    const rows=previews||[],selected=rows.find(p=>keyOf(p)===selectedKey)||null,selectedIndex=rows.indexOf(selected),isPrimary=selectedIndex===0;
    const status=text=>h('div',{role:'status',style:S.dim},h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner',size:15})),' '+text);
    return h(OverlayModal,{title:'编辑预览图 · '+String(model.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|onnx|sft)$/i,''),className:'cc-preview-editor-dialog',theme,width:1100,zIndex:2147481000,onClose:()=>{if(!task.current.posting)onClose();}},
        h('div',{ref:editorRef,className:'cc-preview-editor','aria-busy':busy||previews===null&&!error},
            error?h('div',{role:'alert',style:S.bad},error,previews===null?h('button',{type:'button',style:S.btn2,onClick:()=>setRetry(v=>v+1)},'重新读取'):null):null,
            previews===null&&!error?status('正在读取预览图…'):null,
            previews!==null?h('div',{className:'cc-preview-editor-summary'},h('span',null,rows.length?`共 ${rows.length} 张预览图 · 点击选择`:'暂无预览图')):null,
            rows.length?h('div',{className:'cc-preview-editor-scroll'},h(OutputMasonry,{
                items:rows.map(p=>({...p,width:dimensions[p.url]?.width||p.width||3,height:dimensions[p.url]?.height||p.height||4})),
                minColumnWidth:220,maxColumns:4,className:'cc-preview-editor-masonry',
                renderCard:(p,i)=>{
                    const k=keyOf(p),ratio=Math.min(6,Math.max(.12,(p.height||4)/(p.width||3)));
                    return h('button',{key:k,type:'button',className:'cc-preview-editor-image'+(k===selectedKey?' is-selected':''),'aria-pressed':k===selectedKey,'aria-label':'选择预览图 '+(i+1),disabled:busy,style:{aspectRatio:'1 / '+ratio},onClick:()=>{setSelectedKey(k);setConfirmDelete(false);}},
                        failed[p.url]?h('span',{className:'cc-preview-editor-failed'},'预览图加载失败'):h('img',{src:EXPANDER+p.url,alt:'模型预览图 '+(i+1),loading:'lazy',onError:()=>setFailed(v=>({...v,[p.url]:true})),onLoad:e=>{const {naturalWidth:width,naturalHeight:height}=e.currentTarget;if(width&&height)setDimensions(v=>v[p.url]?.width===width&&v[p.url]?.height===height?v:{...v,[p.url]:{width,height}});}}),
                        i===0?h('span',{className:'cc-preview-editor-badge'},'首预览'):null);
                }
            })):previews?h('div',{className:'cc-model-library-empty'},'暂无预览图'):null,
            rows.length?h('div',{className:'cc-preview-editor-actions'},
                h('span',{className:'cc-preview-editor-selection'},selected?`已选第 ${selectedIndex+1} 张`:'未选择图片'),
                h('button',{type:'button',style:S.btn2,disabled:busy||!selected?.id||isPrimary,onClick:()=>manage('primary',selected.id)},isPrimary?'当前首预览':'设为首预览'),
                h('button',{ref:deleteRef,type:'button',style:S.btn2,disabled:busy||!selected?.id,onClick:()=>setConfirmDelete(true)},'删除选中图片')):null,
            confirmDelete&&selected?h('div',{className:'cc-preview-editor-confirm',role:'alert'},h('span',null,'删除选中的预览图？'),h('button',{type:'button',style:S.btn2,disabled:busy,onClick:()=>{setConfirmDelete(false);deleteRef.current?.focus();}},'取消'),h('button',{ref:confirmRef,type:'button',style:S.btn2,disabled:busy,onClick:()=>manage('delete',selected.id)},'确认删除')):null,
            busy?status('正在更新预览图…'):null));
}


function ModelImageViewer({items,index,onIndex,name,theme,onClose}){
    return h(OutputInspector,{item:{id:items[index].url,url:EXPANDER+items[index].url,filename:name+" 大图 "+(index+1)},
        theme,onClose,onPrev:()=>onIndex((index-1+items.length)%items.length),onNext:()=>onIndex((index+1)%items.length),
        canPrev:items.length>1,canNext:items.length>1,imageOnly:true,label:"模型预览大图",counter:(index+1)+" / "+items.length});
}
// Workbench artwork reads the existing local attachment API; it never hashes or fetches a source.

const MODEL_DOCK_ASSETS=new Map();

function ModelDockAsset({kind,name,rootId,revision=0,variant,onMeta}) {
    const identity=/^\d+$/.test(String(rootId??''))?String(rootId):'',key=JSON.stringify([kind,name,identity,revision]);
    const [record,setRecord]=React.useState(null),[failed,setFailed]=React.useState('');
    const data=record?.key===key?record.data:null;
    React.useEffect(()=>{
        setFailed('');
        if(!name){setRecord(null);return;}
        const ctl=new AbortController(),cached=MODEL_DOCK_ASSETS.get(key);
        if(cached&&Date.now()-cached.time<60000){setRecord({key,data:cached.data});return;}
        jget(EXPANDER+'/models/detail?kind='+encodeURIComponent(kind)+'&name='+encodeURIComponent(name)+(identity!==''?'&root_id='+identity:''),20000,ctl.signal)
            .then(data=>{if(ctl.signal.aborted)return;MODEL_DOCK_ASSETS.set(key,{time:Date.now(),data});if(MODEL_DOCK_ASSETS.size>80)MODEL_DOCK_ASSETS.delete(MODEL_DOCK_ASSETS.keys().next().value);setRecord({key,data});})
            .catch(()=>{if(!ctl.signal.aborted)setRecord({key,data:null});});
        return()=>ctl.abort();
    },[key]);
    React.useEffect(()=>{if(typeof onMeta==='function')onMeta(data||null);},[data,onMeta]);
    const local=data?.preview?.url||data?.previews?.[0]?.url;
    const url=typeof local==='string'&&local.startsWith('/models/preview?')?EXPANDER+local:'';
    const art=h('span',{className:'cc-model-dock-art cc-model-dock-art--'+variant},url&&failed!==url?h('img',{src:url,alt:(variant==='main'?'主模型':kind==='clip'?'文本编码器':kind==='vae'?'VAE':'LoRA')+' 本地预览图',decoding:'async',onError:()=>setFailed(url)}):h(PromptIcon,{name:'image',size:variant==='main'?26:20}));
    if(variant!=='main')return art;
    return h('span',{className:'cc-model-main-art'},art);
}


/** 本地生成页的底模缩略图。
 *  与 A 线 ModelDockAsset 共用 /models/detail 接口和 MODEL_DOCK_ASSETS 缓存，
 *  但**尺寸由行内样式决定**：A 线的 .cc-model-dock-art--main 被 CSS 钉死成 76×100，
 *  塞不进生成页那个窄栏，而它的宽度又写在 UI_CSS 里、变量定义不在本文件，改 CSS 代价大于收益。 */
function LocalCkptThumb({name,kind="checkpoint",width=40,height=52}) {
    const key=JSON.stringify([kind,name,"",0]);
    const [record,setRecord]=React.useState(null),[failed,setFailed]=React.useState('');
    React.useEffect(()=>{
        if(!name){setRecord(null);return;}
        const ctl=new AbortController(),cached=MODEL_DOCK_ASSETS.get(key);
        if(cached&&Date.now()-cached.time<60000){setRecord({key,data:cached.data});return;}
        jget(EXPANDER+'/models/detail?kind='+encodeURIComponent(kind)+'&name='+encodeURIComponent(name),20000,ctl.signal)
            .then(data=>{if(ctl.signal.aborted)return;MODEL_DOCK_ASSETS.set(key,{time:Date.now(),data});setRecord({key,data});})
            .catch(()=>{if(!ctl.signal.aborted)setRecord({key,data:null});});
        return()=>ctl.abort();
    },[key]);
    const data=record?.key===key?record.data:null;
    const local=data?.preview?.url||data?.previews?.[0]?.url;
    const url=typeof local==='string'&&local.startsWith('/models/preview?')?EXPANDER+local:'';
    return h("span",{style:{flex:"0 0 auto",width:width+"px",height:height+"px",borderRadius:"6px",overflow:"hidden",
            display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(127,127,127,.14)",color:"rgba(127,127,127,.72)"}},
        url&&failed!==url
            ?h("img",{src:url,alt:"底模预览图",decoding:"async",loading:"lazy",
                style:{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"},
                onError:()=>setFailed(url)})
            :h(PromptIcon,{name:"image",size:18}));
}


function LocalModelPreview({previews,preview,name,loading=false,theme}) {
    const list=previews?.length?previews:preview?[preview]:[],viewport=React.useRef(null);
    const key=list.map(p=>p.url).join("|"),[opened,setOpened]=React.useState(null),[failed,setFailed]=React.useState({}),[dimensions,setDimensions]=React.useState({});
    React.useEffect(()=>{setOpened(null);setFailed({});if(viewport.current)viewport.current.scrollTop=0;},[key]);
    const items=list.map(item=>({...item,width:dimensions[item.url]?.width||3,height:dimensions[item.url]?.height||4}));
    return h("div",{className:"cc-model-preview-gallery"},
        h("div",{className:"cc-model-preview-viewport",ref:viewport,tabIndex:0,role:"region","aria-label":"模型预览图片区"},
            list.length?h(OutputMasonry,{items,minColumnWidth:140,maxColumns:3,className:"cc-model-preview-masonry",renderCard:(item,i)=>h("button",{key:item.url,type:"button",className:"cc-model-preview-tile","aria-label":"查看大图 "+(i+1),disabled:!!failed[item.url],style:{aspectRatio:1/Math.min(6,Math.max(.12,item.height/item.width))},onClick:()=>setOpened(i)},
                failed[item.url]?h("span",{className:"cc-model-preview-failed"},"预览图无法显示"):h("img",{src:EXPANDER+item.url,alt:name+" 模型预览图"+(i?" "+(i+1):""),loading:i===0?"eager":"lazy",decoding:"async",
                    onLoad:e=>{const {naturalWidth:width,naturalHeight:height}=e.currentTarget;if(width&&height)setDimensions(v=>v[item.url]?.width===width&&v[item.url]?.height===height?v:{...v,[item.url]:{width,height}});},
                    onError:()=>setFailed(v=>({...v,[item.url]:true}))}))}):
                h("div",{className:"cc-model-preview-placeholder"},h(PromptIcon,{name:"image",size:30}),h("span",null,loading?"正在读取预览图…":"暂无本地预览图"))),
        opened!==null&&list[opened]?h(ModelImageViewer,{items:list,index:opened,onIndex:setOpened,name,theme,onClose:()=>setOpened(null)}):null);
}

/** Stable identity shared by the output preview, library and masonry renderer.
 * Keep this outside Console: OutputMasonry is a separate React component. */

function outputKey(x){return x?.id||x?.path||x?.promptId||x?.url||x?.filename||"unknown-output";}

function mergeOutputCollections(sessionItems,savedItems){
    const keys=new Set(),merged=[];
    for(const x of [...(sessionItems||[]),...(savedItems||[])]){
        const key=x?.path||x?.url||x?.id||x?.promptId;
        if(!key||keys.has(key))continue;
        keys.add(key);merged.push(x);
    }
    merged.sort((a,b)=>(Number(b?.createdAt)||Number(b?.mtime)*1000||0)-(Number(a?.createdAt)||Number(a?.mtime)*1000||0));
    return merged;
}

/** Row-first masonry: next image enters the shortest available column, rather than filling one entire column before the next. */

function outputMasonryLayout(items,availableWidth,gap=8,minColumnWidth=220,maxColumns=Infinity){
    const width=Math.max(180,availableWidth||900),cols=Math.max(1,Math.min(maxColumns,Math.floor((width+gap)/(minColumnWidth+gap))));
    const cellWidth=(width-gap*(cols-1))/cols,heights=Array(cols).fill(0),positions=[];
    for(const item of items){
        let col=0;for(let j=1;j<cols;j++)if(heights[j]<heights[col])col=j;
        const w=Number(item.width)>0?Number(item.width):1,h=Number(item.height)>0?Number(item.height):1;
        const imageHeight=cellWidth*Math.min(6,Math.max(.12,h/w));
        positions.push({left:col*(cellWidth+gap),top:heights[col],width:cellWidth});
        heights[col]+=imageHeight+gap;
    }
    return {positions,height:Math.max(0,...heights)- (items.length?gap:0),columns:cols};
}

function OutputMasonry({items,renderCard,minColumnWidth=220,maxColumns=Infinity,className=""}){
    const ref=React.useRef(null),[width,setWidth]=React.useState(0);
    React.useEffect(()=>{
        const el=ref.current;if(!el)return;
        const update=()=>setWidth(el.clientWidth||0);update();
        if(typeof ResizeObserver==='undefined')return;
        const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
    },[]);
    const layout=outputMasonryLayout(items,width,8,minColumnWidth,maxColumns);
    return h("div",{ref,className:"cc-output-masonry"+(className?" "+className:""),style:{height:layout.height+"px"}},
        ...items.map((x,i)=>h("div",{key:outputKey(x),className:"cc-masonry-cell",style:{left:layout.positions[i].left,top:layout.positions[i].top,width:layout.positions[i].width}},renderCard(x,i))));
}



function OutputPromptSection({title,text}){
    const [chinese,setChinese]=React.useState(false);
    const available=text!==undefined&&text!==null,value=available?String(text||''):'';
    const parts=available?splitPromptPreview(value):[];
    const renderTranslated=items=>{
        let end=0,translated='',dictionaryCount=0,machineCount=0,originalCount=0;
        for(let i=0;i<parts.length;i++){
            const part=parts[i],entry=items[i]||null,label=entry?.text||part.text;
            if(entry?.source==='dictionary')dictionaryCount++;
            else if(entry?.source==='machine')machineCount++;
            else originalCount++;
            translated+=value.slice(end,part.start)+(part.weight===1?label:'('+label+':'+part.weight+')');end=part.end;
        }
        translated+=value.slice(end);
        return h(React.Fragment,null,
            chinese&&items.length?h('div',{className:'cc-output-prompt-meta'},
                dictionaryCount?h('span',{className:'cc-output-prompt-source'},'词库中文 '+dictionaryCount):null,
                machineCount?h('span',{className:'cc-output-prompt-source'},'内置翻译 '+machineCount):null,
                originalCount?h('span',{className:'cc-output-prompt-source'},'保留原文 '+originalCount):null):null,
            h('div',{className:'cc-output-prompt-box'},available?(chinese?(translated||'（空）'):(value||'（空）')):'无法从图片元数据恢复'));
    };
    return h('section',{className:'cc-output-info-section'},
        h('div',{className:'cc-output-info-section-head'},h('strong',null,title),available?h('div',{className:'cc-output-prompt-toolbar'},
            h('button',{type:'button',className:'cc-output-prompt-translate','aria-pressed':chinese,
                title:'中文查看：优先使用本地词库中的 Tag 中文；未命中的短语和自然语言交给内置离线翻译引擎。',
                onClick:()=>setChinese(v=>!v)},chinese?'原文':'中文')):null),
        chinese&&available?h(PromptChinesePreview,{texts:parts.map(p=>p.text)},renderTranslated):renderTranslated([]));
}


function OutputInspector({item,theme,onStage,onClose,onPrev,onNext,canPrev,canNext,children,imageOnly=false,label="输出图片查看器",counter=""}){
    const viewerRef=React.useRef(null),stageRef=React.useRef(null),dragRef=React.useRef(null),actions=React.useRef({}),[scale,setScale]=React.useState(1),[pan,setPan]=React.useState({x:0,y:0}),[failed,setFailed]=React.useState(false);
    const [comparing,setComparing]=React.useState(false),[beforeStage,setBeforeStage]=React.useState(0);
    const stages=item?.stages||[],activeStage=item?.activeStage??stages[stages.length-1]?.index;
    actions.current={onClose,onPrev,onNext,canPrev,canNext};
    const reset=()=>{setScale(1);setPan({x:0,y:0});dragRef.current=null;};
    React.useEffect(()=>{reset();setFailed(false);},[outputKey(item),item?.url]);
    React.useEffect(()=>{if(scale===1)setPan({x:0,y:0});},[scale]);
    React.useEffect(()=>{
        if(typeof document==='undefined')return;
        const oldOverflow=document.body?.style?.overflow||'',oldActive=document.activeElement,viewer=viewerRef.current;
        if(document.body)document.body.style.overflow='hidden';viewer?.focus();
        const key=e=>{
            const current=actions.current;
            if(e.defaultPrevented || document.activeElement?.closest('[role="dialog"]')&&!viewer?.contains(document.activeElement))return;
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();current.onClose();return;}
            if(e.key==='Tab'){
                const controls=[...viewer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0);
                const first=controls[0],last=controls[controls.length-1];
                if(!first){e.preventDefault();viewer.focus();}else if(e.shiftKey&&(!viewer.contains(document.activeElement)||document.activeElement===first||document.activeElement===viewer)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(!viewer.contains(document.activeElement)||document.activeElement===last||document.activeElement===viewer)){e.preventDefault();first.focus();}
                return;
            }
            const tag=String(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag))return;
            if(e.key==='ArrowLeft'&&current.canPrev){e.preventDefault();e.stopPropagation();current.onPrev();}
            else if(e.key==='ArrowRight'&&current.canNext){e.preventDefault();e.stopPropagation();current.onNext();}
            else if((e.key==='0'||e.key==='Home')&&(e.ctrlKey||e.metaKey)){e.preventDefault();reset();}
        };
        const blur=()=>{dragRef.current=null;};
        document.addEventListener('keydown',key,true);window.addEventListener('blur',blur);
        return()=>{document.removeEventListener('keydown',key,true);window.removeEventListener('blur',blur);if(document.body)document.body.style.overflow=oldOverflow;if(oldActive?.focus&&oldActive.isConnected)oldActive.focus({preventScroll:true});};
    },[]);
    React.useEffect(()=>{
        const node=stageRef.current;if(!node)return;
        const wheel=e=>{e.preventDefault();e.stopPropagation();if(e.deltaY)setScale(value=>Math.max(1,Math.min(16,value*(e.deltaY<0?1.14:1/1.14))));};
        node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);
    },[]);
    const pointerDown=e=>{if(scale<=1||e.button!==0)return;dragRef.current={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture?.(e.pointerId);};
    const pointerMove=e=>{const d=dragRef.current;if(!d||d.id!==e.pointerId)return;setPan({x:d.px+(e.clientX-d.x),y:d.py+(e.clientY-d.y)});};
    const pointerUp=e=>{if(dragRef.current?.id===e.pointerId)dragRef.current=null;if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
    return floating(h("div",{ref:viewerRef,tabIndex:-1,className:"dsh-comfy-floating cc-output-inspector"+(imageOnly?" is-image-only":""),style:{...(theme||{})},role:"dialog","aria-modal":"true","aria-label":label},
        h("button",{type:"button",className:"cc-output-inspector-close","aria-label":"关闭图片查看器","data-cc-tooltip":"关闭",onClick:onClose},h(PromptIcon,{name:"x",size:20})),
        h("section",{className:"cc-output-inspector-stage",ref:stageRef,onDoubleClick:reset,onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:pointerUp,onLostPointerCapture:()=>{dragRef.current=null;}},
            canPrev?h("button",{type:"button",className:"cc-output-inspector-nav is-prev","aria-label":"上一张",onPointerDown:e=>e.stopPropagation(),onClick:e=>{e.stopPropagation();onPrev();}},h(PromptIcon,{name:"chevronLeft",size:23})):null,
            item?.note&&stages.length<2?h('div',{className:'cc-stage-toolbar'},item.note):null,
            stages.length>1?h('div',{className:'cc-stage-toolbar',onPointerDown:e=>e.stopPropagation()},h('select',{'aria-label':'查看处理阶段',value:activeStage,onChange:e=>{const stage=stages.find(s=>s.index===Number(e.target.value));if(stage)onStage?.(stageOutput(item,stage));}},stages.map(s=>h('option',{key:s.node||s.index,value:s.index},s.label))),h('label',null,h('input',{type:'checkbox',checked:comparing,onChange:e=>setComparing(e.target.checked)}),'对比'),comparing?h('select',{'aria-label':'对比基准阶段',value:beforeStage,onChange:e=>setBeforeStage(Number(e.target.value))},stages.map(s=>h('option',{key:s.node||s.index,value:s.index},s.label))):null,item?.note?h('small',null,item.note):null):null,
            comparing&&stages.length>1?h('div',{className:'cc-comparison-host',onPointerDown:e=>e.stopPropagation(),onWheel:e=>e.stopPropagation()},h(PostCompare,{before:stageOutput(item,stages.find(s=>s.index===beforeStage)||stages[0]),after:{...item,label:stages.find(s=>s.index===activeStage)?.label||'当前阶段'}})):h("img",{className:"cc-output-inspector-image",src:item?.url,alt:item?.filename||"输出图片",draggable:false,onError:()=>setFailed(true),style:{transform:`translate3d(${pan.x}px,${pan.y}px,0) scale(${scale})`}}), 
            failed?h("span",{role:"status",className:"cc-output-inspector-error"},"图片无法显示"):null,
            canNext?h("button",{type:"button",className:"cc-output-inspector-nav is-next","aria-label":"下一张",onPointerDown:e=>e.stopPropagation(),onClick:e=>{e.stopPropagation();onNext();}},h(PromptIcon,{name:"chevronRight",size:23})):null,
            h("div",{className:"cc-output-inspector-zoom"},counter?counter+" · ":"",scale===1?"适应窗口":Math.round(scale*100)+"%"," · 滚轮缩放",scale>1?" · 拖拽移动":""," · 双击复位")),
        !imageOnly?h("aside",{className:"cc-output-inspector-info"},children):null));
}


/**
 * 隐藏「整页」滚动条，但不改动任何模块/列表内部的滚动条，也不禁用滚轮。
 * 插件根、它的宿主滚动祖先和 document.scrollingElement 才属于页面级容器。
 * 宿主容器跨页面复用，因此标记与样式保留到 DSH 本次运行结束。
 */

const PAGE_SCROLL_ATTR = "data-cc-page-scrollbar";

function installPageScrollbarHiding(root) {
    if (typeof document === "undefined" || !root) return () => {};
    const styleId = "cc-page-scrollbar-hide-style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent =
            "[" + PAGE_SCROLL_ATTR + "]{scrollbar-width:none!important;-ms-overflow-style:none!important}" +
            "[" + PAGE_SCROLL_ATTR + "]::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}" +
            "[" + PAGE_SCROLL_ATTR + "]::-webkit-scrollbar-track,[" + PAGE_SCROLL_ATTR + "]::-webkit-scrollbar-thumb{background:transparent!important;border:0!important}";
        document.head.appendChild(style);
    }
    const mark = (el) => {
        if (!el || el.nodeType !== 1) return;
        try { el.setAttribute(PAGE_SCROLL_ATTR, "1"); } catch { /* ignore */ }
    };
    mark(root);
    for (let el = root.parentElement; el; el = el.parentElement) mark(el);
    const scrolling = document.scrollingElement || document.documentElement;
    if (scrolling) mark(scrolling);
    return () => {
        // 插件根会随面板卸载，清掉它的标记；宿主页面容器保留隐藏状态。
        try { root.removeAttribute(PAGE_SCROLL_ATTR); } catch { /* ignore */ }
    };
}


const CONSOLE_TAB_KEY="dsh-comfyui-console/last-tab";

const CONSOLE_PAGES=[["output", "历史"], ["online", "在线模型库"]];

const CONSOLE_TABS=CONSOLE_PAGES.map(([key])=>key);

function readLastConsoleTab(){
    try{const value=window.localStorage.getItem(CONSOLE_TAB_KEY);return CONSOLE_TABS.includes(value)?value:"output";}catch(e){return "gen";}
}


const POST_KINDS={upscale:'超分放大',resample:'二次采样',face:'FaceDetailer 面部细化',workflow:'自定义工作流'};

const POST_SAVE_OPTIONS=[{value:'final',label:'只保存最终输出'},{value:'original',label:'保存最终输出和原图'},{value:'all',label:'保存每个阶段'}];

const POST_INTERFACES=[['image','当前步骤图片','IMAGE'],['original','最初原图','IMAGE'],['model','模型','MODEL'],['clip','CLIP','CLIP'],['vae','VAE','VAE'],['positive','正面条件','CONDITIONING'],['negative','负面条件','CONDITIONING'],['pos','正面提示词','STRING'],['neg','负面提示词','STRING'],['latent','当前图片 Latent','LATENT'],['seed','Seed','INT'],['steps','步数','INT'],['cfg','CFG','FLOAT'],['sampler','采样器','STRING'],['scheduler','调度器','STRING'],['width','当前宽度','INT'],['height','当前高度','INT']];

const postClone=x=>JSON.parse(JSON.stringify(x));

function normalizePost(last={}){
 if(last.postControls?.version===1&&Array.isArray(last.postControls.cells))return postClone(last.postControls);
 return {version:1,save:'final',cells:last.upscale?[{id:'legacy-upscale',kind:'upscale',enabled:true,model:last.upscaleModel||'',factor:Number(last.upscaleFactor)||4}]:[]};
}

function newPostCell(kind){return {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),kind,enabled:true,...({upscale:{model:'',factor:2},resample:{denoise:.3,inherit:true,steps:20,cfg:7,sampler:'euler',scheduler:'normal'},face:{detector:'bbox/face_yolov8m.pt',samModel:'',samDevice:'AUTO',segmDetector:'',sam_threshold:.93,sam_dilation:0,denoise:.4,guide_size:512,max_size:1024,bbox_threshold:.5,feather:5,inherit:true,steps:20,cfg:7},workflow:{workflow:{name:'新工作流',nodes:[],output:null}}}[kind]||{})};}

const FACE_RECOMMENDED={bbox:'bbox/face_yolov8m.pt',sam:'sam_vit_b_01ec64.pth',segm:'segm/person_yolov8n-seg.pt'};

function postFaceNames(info,role){const names=comboOptions(info,role==='sam'?'SAMLoader':'UltralyticsDetectorProvider','model_name');return names.filter(n=>typeof n==='string'&&!/^put_/i.test(n.split('/').pop())&&(role==='bbox'?/^(bbox|segm)\//.test(n):role==='segm'?n.startsWith('segm/'):true));}

function postFaceOptions(info,role,current){const names=postFaceNames(info,role),all=[...new Set([...names,FACE_RECOMMENDED[role],...(current?[current]:[])])];return [...(role!=='bbox'?[{value:'',label:'不使用'}]:[]),...all.map(name=>({value:name,label:names.includes(name)?name:(name===FACE_RECOMMENDED[role]?'未加载 · ':'未找到 · ')+name}))];}

function postFaceInstallation(cells){const models={bbox:[],sam:[],segm:[]};for(const c of cells.filter(c=>c.kind==='face'&&c.enabled!==false)){for(const [role,name] of [['bbox',c.detector],['sam',c.samModel],['segm',c.segmDetector]])if(name&&!models[role].includes(name))models[role].push(name);}if(!models.bbox.length)models.bbox.push(FACE_RECOMMENDED.bbox);return models;}

function movePostCell(cells,index,delta){const to=index+delta;if(to<0||to>=cells.length)return cells;const out=[...cells];[out[index],out[to]]=[out[to],out[index]];return out;}

function postDims(o){let w=Number(o.w),h=Number(o.h);for(const c of normalizePost(o).cells.filter(c=>c.enabled!==false))if(c.kind==='upscale'){w=Math.round(w*Number(c.factor));h=Math.round(h*Number(c.factor));}return {w,h};}

function postPortType(spec,field){const d=spec?.input?.required?.[field]||spec?.input?.optional?.[field];return Array.isArray(d?.[0])||d?.[0]==='COMBO'?'STRING':d?.[0];}

function postDefaults(spec){const out={};for(const [key,desc] of Object.entries(spec?.input?.required||{})){if(desc[1]?.default!==undefined)out[key]=desc[1].default;else if(Array.isArray(desc[0]))out[key]=desc[0][0];else if(desc[0]==='COMBO')out[key]=desc[1]?.options?.[0];else if(desc[0]==='BOOLEAN')out[key]=false;else if(desc[0]==='STRING')out[key]='';}return out;}

function postWorkflowErrors(wf,info){
 const errors=[],nodes=wf?.nodes||[],map=new Map(nodes.map(n=>[n.id,n]));if(!String(wf?.name||'').trim())errors.push('请命名工作流');if(!nodes.length)errors.push('请添加节点');if(nodes.length>100)errors.push('工作流最多 100 个节点');if(map.size!==nodes.length)errors.push('节点 ID 重复');
 const sourceType=v=>v.interface?POST_INTERFACES.find(x=>x[0]===v.interface)?.[2]:info[map.get(v.node)?.type]?.output?.[v.slot];
 for(const n of nodes){const spec=info[n.type];if(!spec){errors.push('缺少节点 '+n.type);continue;}if(spec.output_node||/^(Save|Preview)/i.test(n.type)){errors.push('保存及预览由插件管理，请选择处理节点');continue;}
  for(const [key,d] of Object.entries(spec.input?.required||{}))if(!(key in n.inputs))errors.push(n.type+' 缺少 '+key);
  for(const [key,v] of Object.entries(n.inputs||{})){const typ=postPortType(spec,key);if(!typ){errors.push(n.type+' 未知输入 '+key);continue;}if(v&&typeof v==='object'){if(!v.interface&&!map.has(v.node))errors.push('连接的节点已不存在');const from=sourceType(v);if(!from||!(typ==='*'||from==='*'||typ===from||typ==='FLOAT'&&from==='INT'))errors.push(n.type+' · '+key+' 连接类型不匹配');}else{const d=spec.input?.required?.[key]||spec.input?.optional?.[key];const options=Array.isArray(d[0])?d[0]:d[0]==='COMBO'?d[1]?.options:null;if(options&&!options.includes(v))errors.push(n.type+' · '+key+' 选项无效');if(['INT','FLOAT'].includes(typ)&&(v===''||v===null||!Number.isFinite(Number(v))||typ==='INT'&&!Number.isInteger(Number(v))||d[1]?.min!==undefined&&Number(v)<d[1].min||d[1]?.max!==undefined&&Number(v)>d[1].max))errors.push(n.type+' · '+key+' 数值无效');}}
 }
 const seen=new Set(),visiting=new Set();function walk(id){if(visiting.has(id)){errors.push('工作流不能循环连接');return;}if(seen.has(id))return;visiting.add(id);for(const v of Object.values(map.get(id)?.inputs||{}))if(v&&typeof v==='object'&&v.node)walk(v.node);visiting.delete(id);seen.add(id);}nodes.forEach(n=>walk(n.id));
 if(!wf?.output||!map.has(wf.output.node)||info[map.get(wf.output.node)?.type]?.output?.[wf.output.slot]!=='IMAGE')errors.push('请指定 IMAGE 处理结果');return [...new Set(errors)];
}

function postContext(g,o){
 const sampler=g['7'],guider=g[sampler?.inputs?.guider?.[0]],input=sampler?.inputs||{},guide=guider?.inputs||{};
 const model=input.model||guide.model,positive=input.positive||guide.positive||guide.conditioning,negative=input.negative||guide.negative;
 return {model,positive,negative,clip:g['4']?.inputs?.clip,vae:g['8']?.inputs?.vae};
}


function stageOutput(item,s){return {...item,...s,url:s.path?savedOutputUrl(s.path):s.url||viewUrl(s.imageInfo),params:s.params||item.params,stages:item.stages,activeStage:s.index};}

function PostCompare({before,after}){
 const [split,setSplit]=React.useState(50),[zoom,setZoom]=React.useState(1),[pan,setPan]=React.useState({x:0,y:0}),[size,setSize]=React.useState({w:0,h:0}),[beforeSize,setBeforeSize]=React.useState(null),[error,setError]=React.useState('');const drag=React.useRef(null),viewport=React.useRef(null);
 React.useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=e=>{e.preventDefault();e.stopPropagation();setZoom(v=>Math.max(1,Math.min(8,v*(e.deltaY<0?1.1:1/1.1))));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 React.useEffect(()=>{setZoom(1);setPan({x:0,y:0});setError('');setBeforeSize(null);setSize({w:0,h:0});drag.current=null;},[before.url,after.url]);
 const same=!beforeSize||!size.w||Math.abs(beforeSize.w/beforeSize.h-size.w/size.h)<.01;
 return h('div',{className:'cc-stage-comparison',onWheel:e=>{if(e.target.tagName==='INPUT')return;e.stopPropagation();setZoom(v=>Math.max(1,Math.min(8,v*(e.deltaY<0?1.1:1/1.1))));}},
 h('div',{className:'cc-comparison-tools'},h('span',null,before.label+' ↔ '+after.label),h('button',{type:'button',style:S.btn2,onClick:()=>{setZoom(1);setPan({x:0,y:0});}},'复位'),h('span',null,Math.round(zoom*100)+'%')),
 h('div',{className:'cc-comparison-viewport',ref:viewport,onPointerDown:e=>{if(zoom<=1||e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:e=>{const d=drag.current;if(d&&d.id===e.pointerId)setPan({x:d.px+e.clientX-d.x,y:d.py+e.clientY-d.y});},onPointerUp:()=>{drag.current=null;},onPointerCancel:()=>{drag.current=null;},onLostPointerCapture:()=>{drag.current=null;}},
 h('div',{className:'cc-comparison-pair'+(!same?' is-side-by-side':''),style:{aspectRatio:size.w?size.w/size.h:'1',transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}},
 h('img',{src:after.url,alt:after.label,draggable:false,onLoad:e=>setSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight}),onError:()=>setError('处理结果图片无法读取')}),
 h('img',{className:'cc-comparison-before',src:before.url,alt:before.label,draggable:false,style:same?{clipPath:`inset(0 ${100-split}% 0 0)`}:{},onLoad:e=>setBeforeSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight}),onError:()=>setError('处理前图片无法读取')}),same?h('span',{className:'cc-comparison-divider',style:{left:split+'%'}}):null)),
 same?h('input',{type:'range',min:0,max:100,value:split,'aria-label':'图片对比分隔线',onChange:e=>setSplit(Number(e.target.value))}):h('small',null,'图片比例不同，使用并排对比'),error?h('span',{role:'alert'},error):null);
}

function WorkflowEditor({workflow,info,theme,onSave,onClose}){
 const [draft,setDraft]=React.useState(()=>postClone(workflow)),[query,setQuery]=React.useState(''),[source,setSource]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);const start=React.useRef(JSON.stringify(workflow)),drag=React.useRef(null),area=React.useRef(null),ports=React.useRef(new Map());const [anchors,setAnchors]=React.useState({});
 React.useEffect(()=>{const box=area.current?.querySelector('.cc-flow-canvas')?.getBoundingClientRect();if(!box)return;const next={};for(const [key,el] of ports.current){if(!el?.isConnected)continue;const b=el.getBoundingClientRect();next[key]={x:b.left+b.width/2-box.left,y:b.top+b.height/2-box.top};}setAnchors(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);},[draft]);
 const update=(id,patch)=>{if(!busy)setDraft(d=>({...d,nodes:d.nodes.map(n=>n.id===id?{...n,...patch}:n)}));};
 const changeInput=(node,key,value)=>update(node.id,{inputs:{...node.inputs,[key]:value}});
 const close=()=>{if(busy)return;if(JSON.stringify(draft)!==start.current&&!window.confirm('工作流尚未保存，放弃修改？'))return;onClose();};
 const types=Object.keys(info).filter(t=>!info[t]?.output_node&&!Object.values(info[t]?.input?.required||{}).some(d=>d[0]==='COMFY_AUTOGROW_V3')&&!/^(Save|Preview)/i.test(t)&&(info[t].display_name||t).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.localeCompare(b,'en')).slice(0,100);
 const add=type=>{const id='n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),inputs=postDefaults(info[type]);for(const [k,d] of Object.entries(info[type].input?.required||{}))if(d[0]==='IMAGE')inputs[k]={interface:'image'};setDraft(d=>({...d,nodes:[...d.nodes,{id,type,inputs,x:100+d.nodes.length*300,y:35}]}));};
 function connectionOptions(type){return [{value:'',label:'未连接'},...POST_INTERFACES.filter(x=>type===x[2]||type==='*'||type==='FLOAT'&&x[2]==='INT').map(x=>({value:'@'+x[0],label:'插件 · '+x[1]})),...draft.nodes.flatMap(n=>(info[n.type]?.output||[]).map((t,i)=>({n,t,i})).filter(x=>x.t===type||type==='*'||x.t==='*'||type==='FLOAT'&&x.t==='INT').map(x=>({value:n.id+':'+x.i,label:(info[n.type]?.display_name||n.type)+' · '+(info[n.type]?.output_name?.[x.i]||x.t)+' ['+n.id.slice(-4)+']'})))];}
 function connect(n,key){if(!source)return;const target=postPortType(info[n.type],key),from=source.interface?POST_INTERFACES.find(x=>x[0]===source.interface)?.[2]:info[draft.nodes.find(x=>x.id===source.node)?.type]?.output?.[source.slot];if(from!==target&&from!=='*'&&target!=='*'&&!(target==='FLOAT'&&from==='INT')){setError('接口类型不匹配：'+from+' → '+target);return;}changeInput(n,key,source);setSource(null);setError('');}
 const lines=draft.nodes.flatMap(n=>Object.entries(n.inputs).filter(([k,v])=>v?.node||v?.interface).map(([k,v])=>{const to=anchors[n.id+':in:'+k];if(!to)return null;const from=v.interface?{x:14,y:to.y}:anchors[v.node+':out:'+v.slot];if(!from)return null;return h('g',{key:n.id+k},h('path',{d:`M ${from.x} ${from.y} C ${from.x+65} ${from.y},${to.x-65} ${to.y},${to.x} ${to.y}`,fill:'none',stroke:'var(--cc-accent)',strokeWidth:2}),v.interface?h('text',{x:from.x+4,y:from.y-7,fill:'var(--cc-text)',fontSize:10},POST_INTERFACES.find(x=>x[0]===v.interface)?.[1]||v.interface):null);}));
 const field=(n,key,d)=>{const val=n.inputs[key],type=postPortType(info[n.type],key),linked=val&&typeof val==='object',opts=connectionOptions(type),selected=linked?(val.interface?'@'+val.interface:val.node+':'+val.slot):'';const choose=value=>{if(!value){const next={...n.inputs};delete next[key];update(n.id,{inputs:next});return;}changeInput(n,key,value.startsWith('@')?{interface:value.slice(1)}:{node:value.slice(0,value.lastIndexOf(':')),slot:Number(value.slice(value.lastIndexOf(':')+1))});};const values=Array.isArray(d[0])?d[0]:d[0]==='COMBO'?d[1]?.options:null;
 return h('div',{key,className:'cc-flow-input'},h('button',{type:'button',className:'cc-port',ref:el=>ports.current.set(n.id+':in:'+key,el),'aria-label':'连接 '+n.id+' '+key,onClick:()=>connect(n,key)},'●'),h('label',null,key+' · '+type,h('select',{'aria-label':n.id+' '+key+' 接口',value:selected,onChange:e=>choose(e.target.value)},opts.map(o=>h('option',{key:o.value,value:o.value},o.label)))),!linked?(values?h('select',{'aria-label':n.id+' '+key,value:val??'',onChange:e=>changeInput(n,key,e.target.value)},h('option',{value:''},'选择'),values.map(v=>h('option',{key:v,value:v},v))):['INT','FLOAT','STRING','BOOLEAN'].includes(type)?type==='BOOLEAN'?h('input',{type:'checkbox','aria-label':n.id+' '+key,checked:!!val,onChange:e=>changeInput(n,key,e.target.checked)}):h('input',{type:['INT','FLOAT'].includes(type)?'number':'text',step:type==='INT'?1:d[1]?.step||.01,value:val??'','aria-label':n.id+' '+key,onChange:e=>changeInput(n,key,['INT','FLOAT'].includes(type)?Number(e.target.value):e.target.value)}):null):null);
 };
 async function save(){const errs=postWorkflowErrors(draft,info);if(errs.length){setError(errs.join('；'));return;}setBusy(true);try{const r=await jpost(EXPANDER+'/post/workflows',{workflow:draft},20000);onSave(r.workflow);onClose();}catch(e){setError(errText(e));}finally{setBusy(false);}}
 return h(OverlayModal,{title:'自定义工作流编辑器',theme,width:1400,zIndex:2147481500,onClose:close},
 h('div',{className:'cc-flow-top'},h('input',{'aria-label':'工作流名称',style:S.inp,disabled:busy,value:draft.name,onChange:e=>setDraft(d=>({...d,name:e.target.value}))}),h('button',{type:'button',style:S.btn,disabled:busy,onClick:save},busy?'正在保存…':'保存并关闭')),
 error?h('div',{role:'alert',style:S.bad},error):null,
 h('fieldset',{className:'cc-flow-editor',disabled:busy,style:{border:0,padding:0,margin:0,minWidth:0}},h('aside',{className:'cc-flow-sidebar'},h('strong',null,'插件接口'),h('small',null,source?'已选接口，点击节点输入端口连接':'点击接口或输出端口，再点击输入端口连接'),POST_INTERFACES.map(x=>h('button',{key:x[0],type:'button',style:S.btn2,'aria-pressed':source?.interface===x[0],onClick:()=>setSource({interface:x[0]})},x[1]+' · '+x[2])),h('input',{type:'search','aria-label':'搜索工作流节点',placeholder:'搜索节点',value:query,onChange:e=>setQuery(e.target.value)}),types.map(t=>h('button',{type:'button',key:t,style:S.btn2,onClick:()=>add(t)},'+ '+(info[t].display_name||t)))),
 h('div',{className:'cc-flow-scroll',ref:area},h('div',{className:'cc-flow-canvas',style:{width:Math.max(1200,...draft.nodes.map(n=>n.x+300)),height:Math.max(750,...draft.nodes.map(n=>n.y+180+Object.keys({...info[n.type]?.input?.required,...info[n.type]?.input?.optional}).length*80))}},
 h('svg',{className:'cc-flow-links'},...lines),
 draft.nodes.map(n=>h('section',{key:n.id,className:'cc-flow-node',style:{left:n.x,top:n.y}},h('header',{onPointerDown:e=>{if(busy||e.button!==0||e.target.closest('button'))return;drag.current={id:n.id,x:e.clientX,y:e.clientY,px:n.x,py:n.y};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:e=>{const d=drag.current;if(d?.id===n.id)update(n.id,{x:Math.max(0,d.px+e.clientX-d.x),y:Math.max(0,d.py+e.clientY-d.y)});},onPointerUp:()=>{drag.current=null;},onPointerCancel:()=>{drag.current=null;}},info[n.type]?.display_name||n.type,h('button',{type:'button','aria-label':'删除工作流节点 '+n.id,onClick:()=>setDraft(d=>({...d,nodes:d.nodes.filter(x=>x.id!==n.id).map(x=>({...x,inputs:Object.fromEntries(Object.entries(x.inputs).filter(([k,v])=>v?.node!==n.id))})),output:d.output?.node===n.id?null:d.output}))},'×')),
 h('div',{className:'cc-flow-outputs'},(info[n.type]?.output||[]).map((t,i)=>h('div',{key:i,className:'cc-flow-output-row'},h('button',{type:'button',ref:el=>ports.current.set(n.id+':out:'+i,el),'aria-pressed':source?.node===n.id&&source?.slot===i,'aria-label':n.id+' 输出 '+i,onClick:()=>setSource({node:n.id,slot:i})},(info[n.type]?.output_name?.[i]||t)+' ●'),t==='IMAGE'?h('button',{type:'button','aria-label':'设为处理结果 '+n.id+' '+i,'aria-pressed':draft.output?.node===n.id&&draft.output?.slot===i,onClick:()=>setDraft(d=>({...d,output:{node:n.id,slot:i}}))},draft.output?.node===n.id&&draft.output?.slot===i?'✓ 处理结果':'→ 结果'):null))),
 Object.entries(info[n.type]?.input?.required||{}).map(([k,d])=>field(n,k,d)),h('details',null,h('summary',null,'可选输入'),Object.entries(info[n.type]?.input?.optional||{}).map(([k,d])=>field(n,k,d)))))))),
 h('small',null,'连接当前图片或插件参数，并指定一个 IMAGE 输出为处理结果。关闭未保存的窗口会提示放弃修改。'));
}

let postBridgePromptSkipped=false;

function PostControlsModal({value,onChange,theme,onClose,upscalers,samplers,schedulers,onInstalled}){
 const [info,setInfo]=React.useState({}),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(true),[install,setInstall]=React.useState(null),[editing,setEditing]=React.useState(null),[library,setLibrary]=React.useState([]),[bridgeSkipped,setBridgeSkipped]=React.useState(postBridgePromptSkipped),[bridgeBusy,setBridgeBusy]=React.useState(false),[bridgeCopied,setBridgeCopied]=React.useState(false);const bridgeCopyRef=React.useRef(false),bridgeActionRef=React.useRef(false);const alive=React.useRef(true),busy=React.useRef(false),drag=React.useRef(null);
 React.useEffect(()=>{const ctl=new AbortController();alive.current=true;Promise.allSettled([jget(COMFY+'/object_info',30000,ctl.signal),jget(EXPANDER+'/post/dependencies',10000,ctl.signal),jget(EXPANDER+'/post/workflows',10000,ctl.signal)]).then(results=>{if(ctl.signal.aborted)return;const [a,b,c]=results;if(a.status==='fulfilled')setInfo(a.value);else setError('节点列表读取失败：'+errText(a.reason));if(b.status==='fulfilled')setInstall(b.value);else{setInstall({message:'安装状态无法读取'});setError('安装状态读取失败：'+errText(b.reason));}if(c.status==='fulfilled')setLibrary(c.value.items||[]);else setError('工作流列表读取失败：'+errText(c.reason));setLoading(false);});return()=>{alive.current=false;ctl.abort();};},[]);
 React.useEffect(()=>{if(!install?.running)return;let stopped=false,querying=false;const ctl=new AbortController();const timer=setInterval(async()=>{if(querying)return;querying=true;try{const r=await jget(EXPANDER+'/post/dependencies',10000,ctl.signal);if(!stopped&&alive.current)setInstall(r);}catch(e){if(!stopped&&alive.current)setError('安装状态读取失败：'+errText(e));}finally{querying=false;}},1500);return()=>{stopped=true;clearInterval(timer);ctl.abort();};},[install?.running]);
 const cells=value.cells,patch=(id,data)=>onChange({...value,cells:cells.map(c=>c.id===id?{...c,...data}:c)}),remove=id=>onChange({...value,cells:cells.filter(c=>c.id!==id)});
 const addCell=(kind,wf)=>{if(cells.length>=24)return;const c=newPostCell(kind);if(kind==='upscale')c.model=upscalers[0]||'';if(wf)c.workflow=postClone(wf);onChange({...value,cells:[...cells,c]});};
 async function setup(modelsOnly=false,selectedCells=value.cells){if(busy.current||bridgeActionRef.current)return;busy.current=true;setError('');try{if(install?.faceModelsVersion!==1)throw Error('请更新并重启 Sidecar，以支持 BBOX / SAM / SEGM 模型安装');const r=await jpost(EXPANDER+'/post/dependencies/install',{models:postFaceInstallation(selectedCells),modelsOnly:modelsOnly===true},15000);if(alive.current){setInstall(r);onInstalled?.();}}catch(e){if(alive.current)setError(errText(e));}finally{busy.current=false;}}
 async function copyBridgeOnly(){
  if(bridgeCopyRef.current)return;bridgeCopyRef.current=true;
  try{const r=await jpost(EXPANDER+'/post/bridge/install',{},15000);if(alive.current){setInstall(r);setBridgeCopied(true);}}
  catch(e){if(alive.current)setError(errText(e));}
 }
 React.useEffect(()=>{
  if(loading||!install||install.online!==false||install.bridge)return;
  if(install.bridgeCurrent){setBridgeCopied(true);return;}
  copyBridgeOnly();
 },[loading,install]);
 async function installBridge(){
  if(bridgeActionRef.current||busy.current||install?.running)return;bridgeActionRef.current=true;setBridgeBusy(true);setError('');
  try{
   const copied=await jpost(EXPANDER+'/post/bridge/install',{},15000);
   if(alive.current)setInstall(copied);
   if(!alive.current)return;
   const stopped=await jpost(EXPANDER+'/comfy/stop',{},60000);
   if(!stopped?.ok)throw new Error(stopped?.message||'ComfyUI 关闭失败，未继续启动');
   BG.shutdown();
   if(!alive.current)return;
   const started=await jpost(EXPANDER+'/comfy/start',{mode:'background'},160000);
   if(!started?.ok)throw new Error(started?.message||'ComfyUI 启动失败，请在连接设置中重试');
   let ok=false;
   for(let i=0;i<75;i++){
    await new Promise(r=>setTimeout(r,2000));
    if(!alive.current)return;
    try{const state=await jget(EXPANDER+'/post/dependencies',10000);setInstall(state);if(state.bridge){ok=true;break;}}catch(e){}
   }
   if(ok){
    try{const latest=await jget(COMFY+'/object_info',30000);setInfo(latest);}catch(e){}
    postBridgePromptSkipped=false;setBridgeSkipped(false);onInstalled?.();
   }else setError('桥接节点已复制，但 ComfyUI 尚未加载；请查看安装记录或稍后重启。');
  }catch(e){if(alive.current)setError(errText(e));}
  finally{bridgeActionRef.current=false;if(alive.current)setBridgeBusy(false);}
 }
 const num=(c,key,label,min,max,step=.01)=>h('label',{style:S.field},h('span',{style:S.label},label),h('input',{style:{...S.inp,width:'100%'},type:'number',min,max,step,value:c[key]??(key==='sam_threshold'?.93:key==='sam_dilation'?0:''),'aria-label':label+' '+c.id,onChange:e=>patch(c.id,{[key]:e.target.value===''?'':Number(e.target.value)})}));
 const select=(c,key,label,options)=>h('label',{style:S.field},h('span',{style:S.label},label),h(SelectMenu,{theme,label:label+' '+c.id,value:c[key]??(key==='samDevice'?'AUTO':''),options,onChange:v=>patch(c.id,{[key]:v}),minWidth:0,forceSearch:true}));
 const inherited=c=>h('label',{style:S.field},h('span',{style:S.label},'采样参数'),h(SelectMenu,{theme,label:'采样参数 '+c.id,minWidth:0,value:c.inherit===false?'custom':'inherit',options:[{value:'inherit',label:'继承当前参数'},{value:'custom',label:'自定义参数'}],onChange:v=>patch(c.id,{inherit:v==='inherit'})}));
 async function refreshFaceModels(){setError('');try{const latest=await jget(COMFY+'/object_info',30000);if(alive.current)setInfo(latest);const state=await jget(EXPANDER+'/post/dependencies',10000);if(alive.current)setInstall(state);}catch(e){if(alive.current)setError('模型列表刷新失败：'+errText(e));}}
 React.useEffect(()=>{if(install?.running===false&&!loading)refreshFaceModels();},[install?.running]);
 const faceStatus=c=>[['BBOX','bbox',c.detector],['SAM','sam',c.samModel],['SEGM','segm',c.segmDetector]].map(([label,role,name])=>{const item=install?.models?.[role];return label+'：'+(!name?'未启用':postFaceNames(info,role).includes(name)?'已识别':item?.default===name&&item.fileExists?'文件已安装，待加载':item?.default===name&&item.fileExists===false?'未安装':'待确认');}).join(' · ');
 const faceSelect=(c,key,label,role)=>select(c,key,label,postFaceOptions(info,role,c[key]));
 return h(OverlayModal,{title:'生成后控制',className:'cc-post-dialog cc-model-library-dialog',theme,width:1280,guideTarget:'post-panel',onClose},
 error?h('div',{role:'alert',style:S.bad},error):null,
 !loading&&install&&install.online===true&&!install.bridge&&!bridgeSkipped?h('div',{className:'cc-post-bridge-prompt',role:'status'},
  h('div',null,h('strong',null,'缺少 DSH 图像桥接节点'),h('span',null,'AI 阶段顺序、动态尺寸/倍率需要 DSHPostScale、DSHPostStage、DSHPostImageSize。安装后必须重启 ComfyUI 才会加载，正在生成的任务会被中断。')),
  h('div',{className:'cc-post-bridge-actions'},
   h('button',{type:'button',style:S.btn,disabled:bridgeBusy,onClick:installBridge},bridgeBusy?'正在安装并重启 ComfyUI…':'重启 ComfyUI 并安装'),
   h('button',{type:'button',style:S.btn2,disabled:bridgeBusy,onClick:()=>{postBridgePromptSkipped=true;setBridgeSkipped(true);}},'暂时跳过'))):null,
 h('div',{className:'cc-post-toolbar'},h('div',{className:'cc-post-save-field cc-field-capsule','data-cc-guide':'post-save','data-cc-tooltip':'关闭“保存输出到本地”时仅生成 Temp 预览。',title:'关闭“保存输出到本地”时仅生成 Temp 预览。'},h('span',null,'最终保存'),h(SelectMenu,{theme,label:'最终保存选项',value:value.save,options:POST_SAVE_OPTIONS,onChange:save=>onChange({...value,save}),minWidth:0})),h(TaskAction,{busy:!!install?.running,label:'检查并安装缺失组件',busyLabel:'安装中…',onStart:()=>setup(false),onStop:async()=>{try{setInstall(await jpost(EXPANDER+'/post/dependencies/cancel',{},10000));}catch(e){setError(errText(e));}}})),
 h('div',{role:'status',style:S.dim},bridgeBusy?'正在安装并重启 ComfyUI…':bridgeCopied&&!install?.online?'桥接节点已复制，启动 ComfyUI 后生效':install?.message||'正在检查本地安装'),
 install?.log?h('details',null,h('summary',null,'安装记录'),h('pre',{className:'cc-post-log'},install.log)):null,
 bridgeSkipped&&install?.online&&!install.bridge?h('button',{type:'button',style:S.btn2,disabled:bridgeBusy||install?.running,onClick:()=>{postBridgePromptSkipped=false;setBridgeSkipped(false);}},'安装桥接节点'):null,
 h('div',{className:'cc-post-notebook'},h('aside',{className:'cc-post-add','aria-label':'生成后控制列表'},
 h('section',{className:'cc-post-side-section cc-post-section-defaults','data-cc-guide':'post-defaults'},h('strong',null,'默认生成后控制'),
  ...Object.entries(POST_KINDS).filter(([kind])=>kind!=='workflow').map(([kind,label])=>h('button',{key:kind,type:'button',className:'cc-control-add-row',disabled:cells.length>=24,onClick:()=>addCell(kind)},h('span',null,label),h('small',null,'添加'))))),
 h('div',{className:'cc-post-cells','data-cc-guide':'post-cells'},!cells.length?h('div',{className:'cc-model-library-empty'},'从左侧添加生成后控制'):null,
 cells.map((c,i)=>h('section',{key:c.id,className:'cc-post-cell','data-kind':c.kind,'data-disabled':c.enabled===false,onDragOver:e=>e.preventDefault(),onDrop:e=>{e.preventDefault();const from=drag.current;drag.current=null;if(from==null||from===i)return;const next=[...cells],cell=next.splice(from,1)[0];next.splice(i,0,cell);onChange({...value,cells:next});}},
 h('header',{className:'cc-post-cell-head'},
  h('span',{className:'cc-post-cell-index','aria-hidden':'true'},String(i+1).padStart(2,'0')),
  h('span',{className:'cc-post-cell-drag',draggable:true,title:'拖动排序',role:'button',tabIndex:0,'aria-label':'拖动排序 '+(i+1),onDragStart:e=>{drag.current=i;e.dataTransfer.setData('text/plain',c.id);},onDragEnd:()=>{drag.current=null;}},'⠿'),
  h('strong',{className:'cc-post-cell-title'},c.kind==='workflow'?c.workflow?.name||POST_KINDS.workflow:POST_KINDS[c.kind]),
  h('div',{className:'cc-post-cell-enable cc-field-capsule'},h('span',{className:'cc-control-pill-label'},'启用'),h(SelectMenu,{theme,label:'启用控制 '+(i+1),minWidth:0,value:c.enabled!==false?'on':'off',options:[{value:'on',label:'ON'},{value:'off',label:'OFF'}],onChange:v=>patch(c.id,{enabled:v==='on'})})),
  h('div',{className:'cc-post-cell-actions'},[['↑','上移',-1],['↓','下移',1]].map(([icon,label,delta])=>h('button',{key:label,type:'button',style:S.btn2,'aria-label':label+'控制 '+(i+1),'data-cc-tooltip':label,disabled:delta<0?i===0:i===cells.length-1,onClick:()=>onChange({...value,cells:movePostCell(cells,i,delta)})},icon)),h('button',{type:'button',style:S.btn2,'aria-label':'删除控制 '+(i+1),'data-cc-tooltip':'删除',onClick:()=>remove(c.id)},h(PromptIcon,{name:'trash',size:15})))),
 h('div',{className:'cc-post-cell-fields'},
 c.kind==='upscale'?h('div',{className:'cc-post-param-group','data-layout':'upscale'},select(c,'model','放大模型',upscalers),num(c,'factor','倍率',.1,8,.01)):null,
 c.kind==='resample'||c.kind==='face'?h(React.Fragment,null,
  h('div',{className:'cc-post-param-group'},num(c,'denoise','降噪强度',c.kind==='face'?.0001:0,1),inherited(c)),
  c.inherit===false?h('div',{className:'cc-post-param-group','data-layout':c.kind==='resample'?'sampling':'pair'},num(c,'steps','步数',1,10000,1),num(c,'cfg','CFG',0,100),c.kind==='resample'?select(c,'sampler','采样器',samplers):null,c.kind==='resample'?select(c,'scheduler','调度器',schedulers):null):null):null,
 c.kind==='face'?h('div',{className:'cc-post-param-group'},
  h('span',{className:'cc-post-param-wide',style:S.label},'检测与细化'),
  h('div',{className:'cc-post-param-wide'},faceSelect(c,'detector','BBOX · 面部定位','bbox')),
  faceSelect(c,'samModel','SAM · 精细轮廓（可选）','sam'),faceSelect(c,'segmDetector','SEGM · 分割遮罩（可选）','segm'),
  c.samModel&&c.segmDetector?h('span',{className:'cc-post-param-wide',style:S.dim},'已启用 SAM，按官方逻辑优先使用 SAM；SEGM 选择保留。'):null,
  c.samModel?h(React.Fragment,null,h('div',{className:'cc-post-param-wide'},select(c,'samDevice','SAM 运行设备',comboOptions(info,'SAMLoader','device_mode').length?comboOptions(info,'SAMLoader','device_mode'):['AUTO','Prefer GPU','CPU'])),num(c,'sam_threshold','SAM 阈值',0,1),num(c,'sam_dilation','SAM 遮罩扩张',-512,512,1)):null,
  h('span',{className:'cc-post-param-wide',style:S.dim,role:'status'},faceStatus(c)),
  h('div',{className:'cc-post-param-actions'},h(TaskAction,{busy:!!install?.running,label:'安装所选检测模型',busyLabel:'安装中…',onStart:()=>setup(true,[{...c,enabled:true}]),onStop:async()=>{try{setInstall(await jpost(EXPANDER+'/post/dependencies/cancel',{},10000));}catch(e){setError(errText(e));}}}),h('button',{type:'button',style:S.btn2,onClick:refreshFaceModels},'刷新模型列表')),
  num(c,'guide_size','细化尺寸',64,16384,8),num(c,'max_size','最大尺寸',64,16384,8),num(c,'bbox_threshold','检测阈值',0,1),num(c,'feather','羽化',0,100,1),
  !info.FaceDetailer?h('span',{className:'cc-post-param-wide',style:S.warn},'当前服务未加载 FaceDetailer，请安装后重启 ComfyUI。'):null):null,
 c.kind==='workflow'?h('div',{className:'cc-post-param-group'},
  library.length?h('div',{className:'cc-post-param-wide'},h('label',{style:S.field},h('span',{style:S.label},'使用已保存工作流'),h(SelectMenu,{theme,label:'已保存工作流 '+c.id,minWidth:0,forceSearch:true,value:library.some(w=>w.id===c.workflow?.id)?c.workflow.id:'',options:[{value:'',label:'选择已保存工作流'},...library.map(w=>({value:w.id,label:w.name}))],onChange:id=>{const wf=library.find(w=>w.id===id);if(wf)patch(c.id,{workflow:postClone(wf)});}}))):null,
  h('div',{className:'cc-post-param-actions'},
   h('button',{type:'button',style:S.btn2,disabled:loading||!Object.keys(info).length,onClick:()=>setEditing(c.id)},'编辑工作流'),
   c.workflow?.id?h('button',{type:'button',style:S.btn2,onClick:async()=>{if(!window.confirm('从已保存工作流中删除？当前单元格副本会保留。'))return;try{await jpost(EXPANDER+'/post/workflows/delete',{id:c.workflow.id},10000);setLibrary(rows=>rows.filter(w=>w.id!==c.workflow.id));patch(c.id,{workflow:{...c.workflow,id:undefined}});}catch(e){setError(errText(e));}}},'删除已保存工作流'):null)):null))))),
 editing?(()=>{const cell=cells.find(c=>c.id===editing);return cell?h(WorkflowEditor,{workflow:cell.workflow,info,theme,onClose:()=>setEditing(null),onSave:w=>{patch(cell.id,{workflow:w});setLibrary(rows=>[w,...rows.filter(r=>r.id!==w.id)]);}}):null;})():null);
}



/* ==================== 原 A 线组件（已并入原线，0.7.129）====================
 * PreviewConsole（历史页 / 在线模型库）与 PBG（后台任务管理器）原先在
 * lib/preview_console.js 里，但那只是物理拆文件：它依赖本文件 98 个顶层符号
 * （h / React / S / USER / COMFY / jget / jpost / errText / PromptIcon ……），
 * 逻辑上从未独立。为去依赖化与分发，整体并回原线，不再有中间层模块。
 * 备份见 lib/preview_console.js.bak-0.7.129。
 */
function PreviewConsole(props) {
	const rootRef = React.useRef(null);
    // 隐藏 DSH 外层整页滚动条（含全屏看图时的页面滚动条），保留滚轮滚动。
    React.useEffect(() => {
        // 常挂载（v0.7.95）：只有真的在显示 A 线页时才隐藏整页滚动条，避免影响本地页
        if (!(props && props.page)) return undefined;
        return installPageScrollbarHiding(rootRef.current);
    }, [props && props.page]);
    const [theme, setTheme] = React.useState({});
    // Portal 不继承绘图台 DOM 的 CSS 变量，所以显式同步给浮层。
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const refresh = () => {
            const next = hostPalette(rootRef.current);
            setTheme((prev) => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
        };
        refresh();
        if (typeof MutationObserver === "undefined") return;
        const observer = new MutationObserver(refresh);
        const targets = new Set([document.documentElement, document.body]);
        for (let el = rootRef.current?.parentElement; el; el = el.parentElement) targets.add(el);
        for (const el of targets) if (el) observer.observe(el, {attributes:true,attributeFilter:["class", "style", "data-theme"]});
        return () => observer.disconnect();
    }, []);
    const [tabInternal, setTab] = React.useState(readLastConsoleTab);
    const tab = (props && props.page) || tabInternal;
	const [online, setOnline] = React.useState(null);
    const [comfyUpdate,setComfyUpdate]=React.useState(null);
    const [updateOpen,setUpdateOpen]=React.useState(false);
    const [updateBusy,setUpdateBusy]=React.useState(false);
    const [updateError,setUpdateError]=React.useState('');
    const [errorLogOpen,setErrorLogOpen]=React.useState(false);
    const [errorLogs,setErrorLogs]=React.useState(()=>readClientErrors());
	const [conn, setConn] = React.useState(0);
	const [showConn, setShowConn] = React.useState(false);
	OPEN_CONN_SINK = () => setShowConn(true);   // 生成页按钮经模块级钩子调这里
	// 生成页的底模卡经同一个模式打开模型库；openModelLibrary 是函数声明，提升可见。
	OPEN_MODEL_PICKER_SINK = (kind, name) => openModelLibrary(kind || null, name || "");
    const connectionDraft=React.useRef({revision:0,fields:new Set()});
    function editConnectionDraft(...keys){connectionDraft.current.revision++;for(const key of keys)connectionDraft.current.fields.add(key);}
    function applyConnectionSettings(settings){
        setSettingsInfo(settings);
        const dirty=new Set(connectionDraft.current.fields);
        setInstallConfig(cur=>Object.fromEntries(["comfyRoot","comfyPythonExe"].map(key=>[key,dirty.has(key)?cur[key]:settings[key] || ""])));
        setPathConfig(cur=>Object.fromEntries(["outputDirectory","tempDirectory","extraModelPathsConfig"].map(key=>[key,dirty.has(key)?cur[key]:settings.pathConfig?.[key] || (key==="extraModelPathsConfig"?[]:"")])));
        if(!dirty.has("startScript"))setStartScript(settings.startScript || "");
        if(!dirty.has("comfyPort"))setComfyPortInput(String(settings.comfyPort || COMFY_PORT));
    }

	const [startScript, setStartScript] = React.useState("");
	const [settingsInfo, setSettingsInfo] = React.useState(null);
    const [installConfig, setInstallConfig] = React.useState({comfyRoot:"",comfyPythonExe:""});
    const [pathConfig, setPathConfig] = React.useState({outputDirectory:"",tempDirectory:"",extraModelPathsConfig:[]});
	const [connNotice, setConnNotice] = React.useState("");
	const [starting, setStarting] = React.useState(false);
	const operationRef = React.useRef(false);
	const onlineRef = React.useRef(null);
	onlineRef.current = online;
	const [saving, setSaving] = React.useState(false);
	const [guideMenu, setGuideMenu] = React.useState(false);
	const [guideMenuPos, setGuideMenuPos] = React.useState({ top: 60, right: 20 });
	const [guide, setGuide] = React.useState(null);
	const [guideStep, setGuideStep] = React.useState(0);
	const [comfyPortInput, setComfyPortInput] = React.useState(String(COMFY_PORT));
	const [sidecarPortInput, setSidecarPortInput] = React.useState(String(EXPANDER_PORT));
    React.useEffect(() => {
        if (!guideMenu || typeof document === "undefined") return;
        const onEscape = (e) => { if (e.key === "Escape") { e.preventDefault(); setGuideMenu(false); } };
        document.addEventListener("keydown", onEscape);
        return () => document.removeEventListener("keydown", onEscape);
    }, [guideMenu]);

	// 元数据
	const [ckpts, setCkpts] = React.useState([]);
    const [diffusions,setDiffusions]=React.useState([]);
    const [weightTypes,setWeightTypes]=React.useState(["default"]);
	const [loras, setLoras] = React.useState([]);
	const [vaes, setVaes] = React.useState([]);
	const [clips, setClips] = React.useState([]);
	const [samplers, setSamplers] = React.useState([]);
	const [schedulers, setSchedulers] = React.useState([]);
	const [clipTypes, setClipTypes] = React.useState([]);
    React.useEffect(()=>{
        let active=true;
        const check=()=>jget(EXPANDER+"/comfy/update",30000).then(info=>{if(active)setComfyUpdate(info);}).catch(()=>{});
        check();
        const timer=setInterval(check,1800000);
        return ()=>{active=false;clearInterval(timer);};
    },[]);
    React.useEffect(()=>{
        const refresh=()=>setErrorLogs(readClientErrors());
        refresh(); window.addEventListener('dsh-comfy-error-log',refresh);
        const onError=e=>logClientError('window.error',e.error||e.message,{filename:e.filename||'',line:e.lineno||0,column:e.colno||0});
        const onRejection=e=>logClientError('unhandledrejection',e.reason);
        window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
        return ()=>{window.removeEventListener('dsh-comfy-error-log',refresh);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);};
    },[]);
    const [modelControlsOpen,setModelControlsOpen]=React.useState(false);
    const [componentPicker,setComponentPicker]=React.useState(null);
    const componentSequence=React.useRef(0);
    const [modelDockRevision,setModelDockRevision]=React.useState(0);
    const [mainModelMeta,setMainModelMeta]=React.useState(null);
    const [showModelLibrary,setShowModelLibrary]=React.useState(false);
    const [modelLibraryKind,setModelLibraryKind]=React.useState(null);
    const [modelLibraryData,setModelLibraryData]=React.useState({roots:[],folders:[],models:[]});
    const [modelLibraryLoading,setModelLibraryLoading]=React.useState(false);
    const modelLibraryLoadRef=React.useRef(null);
    const modelNavigationRef=React.useRef(0);
    const [modelLibraryQuery,setModelLibraryQuery]=React.useState("");
    const [modelLibrarySelection,setModelLibrarySelection]=React.useState([]);
    const [modelLibraryFocus,setModelLibraryFocus]=React.useState(null);
    const [modelLibraryDetail,setModelLibraryDetail]=React.useState(null);
    const [modelLibraryDetailBusy,setModelLibraryDetailBusy]=React.useState(false);
    const modelDetailRequestRef=React.useRef(0);
    const [modelPreviewBusy,setModelPreviewBusy]=React.useState(false);
    const [modelAssetMessage,setModelAssetMessage]=React.useState("");
    const [modelSourceBusy,setModelSourceBusy]=React.useState(false);
    const [modelTaskStopping,setModelTaskStopping]=React.useState(false);
    const modelTaskRef=React.useRef(null);

    const [modelLibraryError,setModelLibraryError]=React.useState("");
    const [modelFolderBusy,setModelFolderBusy]=React.useState(false);
    const [modelActiveFolder,setModelActiveFolder]=React.useState({root_id:0,path:""});
    const [modelDropTarget,setModelDropTarget]=React.useState("");
    const [modelTreeOpen,setModelTreeOpen]=React.useState({});
    const [modelCreateFolder,setModelCreateFolder]=React.useState("");
    const [modelPins,setModelPins]=React.useState(readModelPins);
    React.useEffect(()=>{try{window.localStorage.setItem(MODEL_PINS_KEY,JSON.stringify(modelPins.pins));}catch{setMsg("置顶设置未能保存，本次窗口内仍可使用");}},[modelPins.pins]);
    const [creatingModelFolder,setCreatingModelFolder]=React.useState(false);
    const [newModelFolderName,setNewModelFolderName]=React.useState("");
    const modelLibraryAnchorRef=React.useRef("");
    const modelLibraryPreferredRef=React.useRef("");
    const modelDragRef=React.useRef(null);

	// 参数
	const L = USER.last || {};
	const [ckpt, setCkpt] = React.useState(L.ckpt || "");
    const [modelConfig,setModelConfig]=React.useState(()=>normalizeModelConfig(L.modelConfig));
    const profile=modelProfile(modelConfig);
    const [modelCheck,setModelCheck]=React.useState(false);
    const [modelFileChecking,setModelFileChecking]=React.useState(false);
    const modelCheckRef=React.useRef(null);
	const [clip, setClip] = React.useState(L.clip || "");
	const [clipType, setClipType] = React.useState(L.clipType || "stable_diffusion");
	const [vae, setVae] = React.useState(L.vae || "");
	const [selLoras, setSelLoras] = React.useState(L.loras || []);
	const [pos, rawSetPos] = React.useState(L.pos || "");
	const [neg, rawSetNeg] = React.useState(L.neg || "");
    const promptRef = React.useRef({pos:L.pos || "", neg:L.neg || ""});
    const historyRef = React.useRef(null);
    if (!historyRef.current) historyRef.current = createPromptHistory(promptRef.current);
    const [historyTick, setHistoryTick] = React.useState(0);
    const [expandPhase, setExpandPhase] = React.useState("idle"); // idle / running / stopping
    const expandPhaseRef = React.useRef("idle");
    const expandRequestRef = React.useRef(null);
    const [aiAction,setAiAction] = React.useState("expand");
    const [previewMode,setPreviewMode] = React.useState("raw");
    const promptGuidePreviewRestoreRef = React.useRef("raw");
    const [viewMessage,setViewMessage] = React.useState(null);
    const composingPrompt = React.useRef({pos:false,neg:false});
    const compositionGroup = React.useRef({});
    const pasteRef = React.useRef(false);
    const posAreaRef = React.useRef(null), negAreaRef = React.useRef(null);
    const savedHeights = USER.promptHeights || {};
    const [areaHeights,setAreaHeights] = React.useState(() => ({
        pos:Math.max(145, Number(savedHeights.pos) || 165),
        neg:Math.max(100, Number(savedHeights.neg) || 115),
    }));
    const resizeDragRef = React.useRef(null);
    const [resizingKind,setResizingKind] = React.useState("");
    function updatePrompt(patch, source = "action", field = "", allowLocked = false) {
        if (!allowLocked && expandPhaseRef.current !== "idle") return false;
        if (source !== "typing" && typeof autocomplete !== "undefined") autocomplete.close();
        const old = promptRef.current;
        const next = {pos:patch.pos === undefined ? old.pos : String(patch.pos),
                      neg:patch.neg === undefined ? old.neg : String(patch.neg)};
        if (!historyRef.current.commit(next, source, field)) return false;
        promptRef.current = next;
        rawSetPos(next.pos); rawSetNeg(next.neg);
        setHistoryTick(v => v + 1);
        return true;
    }


    


    
    React.useEffect(() => () => {
        // 切离面板时也取消扩写，避免失去编辑锁后旧回复覆盖提示词。
        const request = expandRequestRef.current;
        if (request) {
            request.controller.abort();
            jpost(EXPANDER + "/expand/cancel", {request_id:request.id}, 5000).catch(() => {});
            expandRequestRef.current = null;
        }
    }, []);
	const [w, setW] = React.useState(L.w || 896);
	// 896×1152 是当前模型的经验默认值，不覆盖用户存过的高度。
	const [hh, setHh] = React.useState(L.h || 1152);
	const [steps, setSteps] = React.useState(L.steps || 24);
	const [cfg, setCfg] = React.useState(L.cfg ?? 6.0);
	const [sampler, setSampler] = React.useState(L.sampler || "euler");
	const [scheduler, setScheduler] = React.useState(L.scheduler || "normal");
	const [prefix, setPrefix] = React.useState(L.prefix || "dsh_comfy");
    const [saveOutput,setSaveOutput]=React.useState(!!L.saveOutput);
    const [savePath,setSavePath]=React.useState(L.savePath || "");
    const [sizeMultiplier,setSizeMultiplier]=React.useState(Number(L.sizeMultiplier) || 1);
    const [customSizeSelected,setCustomSizeSelected]=React.useState(false);
	/** Seed 在提交后按模式推进；用户手动改值不会改变模式。 */
	const [seed, setSeed] = React.useState(L.seed || 0);
    const [seedMode,setSeedMode]=React.useState(L.seedMode || (L.lockSeed ? "lock" : "random"));
	const [lastSeed, setLastSeed] = React.useState(0);
	/** 当前视角（俯视/平视/仰视），仅作按钮高亮显示 */
	const [viewKey, setViewKey] = React.useState(L.viewKey || "high");

	/** 输出放大：使用 ImageScale 精确匹配用户选择的 2× 或 4× 尺寸。 */
	const [upscalers, setUpscalers] = React.useState([]);
	/** 被 looksLikeUpscaler 过滤掉的条目数（用于提示路径映射可能有问题） */
	const [upscaleFiltered, setUpscaleFiltered] = React.useState(0);
	const [upscaleModel, setUpscaleModel] = React.useState(L.upscaleModel || "");
	const [upscale, setUpscale] = React.useState(!!L.upscale);
	const [upscaleFactor, setUpscaleFactor] = React.useState(L.upscaleFactor || 4);
    const [postControls,setPostControls]=React.useState(()=>normalizePost(L));
    const [postOpen,setPostOpen]=React.useState(false);
    const [showModelGuide,setShowModelGuide]=React.useState(false);
    const generationKey=JSON.stringify({postControls,modelConfig,ckpt,clip,clipType,vae,selLoras,pos,neg,w,hh,steps,cfg,sampler,scheduler,seed,seedMode,saveOutput,savePath,sizeMultiplier,upscale,upscaleModel,upscaleFactor,prefix});
    const generationKeyRef=React.useRef(generationKey);generationKeyRef.current=generationKey;
    const modelIdentityRef=React.useRef(modelConfig.identity);modelIdentityRef.current=modelConfig.identity;
    React.useEffect(()=>{if(modelCheckRef.current)cancelModelCheck();},[generationKey]);

	const [msg, setMsg] = React.useState("");
	// 对话默认收起；聊天记录只在当前 DSH 进程中保留。
	const [exOpen, setExOpen] = React.useState(false);
    const promptGuideChatRestoreRef = React.useRef(false);
    const postGuideRestoreRef = React.useRef(false);
	const [exLog, rawSetExLog] = React.useState(() => CHAT_SESSION.log.slice());
    
	const [exIn, setExIn] = React.useState("");
	const [exBusy, setExBusy] = React.useState(false);
	const [presetName, setPresetName] = React.useState("");
	const [presetCat, setPresetCat] = React.useState("默认");
	/** ComfyUI 工作流导入 */
	const [wfText, setWfText] = React.useState("");
	const [wfResult, setWfResult] = React.useState(null);

    const [showLaunch,setShowLaunch]=React.useState(false);
    const [launchInfo,setLaunchInfo]=React.useState(null);
    const [launchError,setLaunchError]=React.useState("");
    const [browserFallback,setBrowserFallback]=React.useState("");
    React.useEffect(()=>{
        if(!showLaunch)return;
        let dead=false;setLaunchInfo(null);setLaunchError("");
        Promise.all([jget(EXPANDER+"/comfy/online",6000),jget(EXPANDER+"/settings",5000)])
            .then(([state,settings])=>{if(!settings.launchModes)throw new Error("sidecar 版本过旧，请完整重启 DSH 后刷新页面");if(!dead)setLaunchInfo({running:!!state.running,settings});})
            .catch(e=>{if(!dead)setLaunchError("无法读取启动设置："+errText(e));});
        return()=>{dead=true;};
    },[showLaunch]);

    const [dictionaryReady,setDictionaryReady]=React.useState(false);
    const [dictionaryRetry,setDictionaryRetry]=React.useState(0);
    const [dictionaryOptions,setDictionaryOptions]=React.useState(USER.autocompleteOptions || {});
    const [showCompletionSettings,setShowCompletionSettings]=React.useState(false);
    const autocomplete=useTagCompletion({updatePrompt,promptRef,expandPhaseRef,theme,
        enabled:dictionaryReady && dictionaryOptions.enabled!==false,
        underscores:!!dictionaryOptions.underscores,category:dictionaryOptions.category || ""});
    React.useEffect(()=>{
        let dead=false,timer;
        let attempt=0;
        async function init(){
            try {
                await dictionaryRequest("status");
                await migrateLegacyDictionary();
                if(!dead)setDictionaryReady(true);
            }catch(e){
                if(dead)return;
                if(++attempt<8)timer=setTimeout(init,2000);
                else setMsg("词库初始化失败："+errText(e)+"；请刷新页面重试");
            }
        }
        init();return()=>{dead=true;clearTimeout(timer);};
    },[dictionaryRetry]);
    React.useEffect(()=>{autocomplete.close();},[tab,expandPhase,dictionaryOptions]);

	// 生成任务与本次 DSH 会话输出订阅。
    const [tasks,setTasks]=React.useState(PBG.tasksSnapshot());
    const [sessionOutputs,setSessionOutputs]=React.useState(SESSION_OUTPUTS.snapshot());
	React.useEffect(() => PBG.subscribe(() => setTasks(PBG.tasksSnapshot())), []);
    React.useEffect(() => SESSION_OUTPUTS.subscribe(()=>setSessionOutputs(SESSION_OUTPUTS.snapshot())),[]);
    const [taskDetail,setTaskDetail]=React.useState(null);
    const [savedOutputItems,setSavedOutputItems]=React.useState([]);
    const outputMergeCacheRef=React.useRef({session:null,saved:null,value:[]});
    if(outputMergeCacheRef.current.session!==sessionOutputs||outputMergeCacheRef.current.saved!==savedOutputItems){
        outputMergeCacheRef.current={session:sessionOutputs,saved:savedOutputItems,value:mergeOutputCollections(sessionOutputs,savedOutputItems)};
    }
    const outputItems=outputMergeCacheRef.current.value;
    const [outputLoading,setOutputLoading]=React.useState(false);
    const outputRequestRef=React.useRef(null);
    const outputLoadingRef=React.useRef(false);
    const outputLoadedRef=React.useRef(false);
    const outputLoadedAtRef=React.useRef(0);
    const [outputVisible,setOutputVisible]=React.useState(80);
    const outputLoadMoreRef=React.useRef(null);
    const [outputView,setOutputView]=React.useState("masonry");
    const [outputSort,setOutputSort]=React.useState("newest");
    const [outputPreviewQuality,setOutputPreviewQuality]=React.useState(["medium","large","original"].includes(USER.outputPreviewQuality)?USER.outputPreviewQuality:"medium");
    const [outputDetail,setOutputDetail]=React.useState(null);
    const [previewOutput,setPreviewOutput]=React.useState(null),[previewEditor,setPreviewEditor]=React.useState(null);
    const [outputDetailScope,setOutputDetailScope]=React.useState("output");
    const [outputFilter,setOutputFilter]=React.useState({saved:"all",path:"",name:"",time:"all",dateFrom:"",dateTo:"",size:"all",shape:"all",minEdge:"",maxEdge:""});
    const [outputFilterPinned,setOutputFilterPinned]=React.useState(false);
    const [outputFilterHovered,setOutputFilterHovered]=React.useState(false);
    const [outputFilterFocused,setOutputFilterFocused]=React.useState(false);
    const [outputFilterSuppressed,setOutputFilterSuppressed]=React.useState(false);
    const outputFiltersOpen=!outputFilterSuppressed&&(outputFilterPinned||outputFilterHovered||outputFilterFocused);
    const tabScrollRef=React.useRef({});
    const stickyShellRef=React.useRef(null);
    const [stickyShellHeight,setStickyShellHeight]=React.useState(96);
    React.useEffect(()=>{
        const el=stickyShellRef.current;if(!el)return;
        const sync=()=>setStickyShellHeight(Math.ceil(el.getBoundingClientRect().height));sync();
        if(typeof ResizeObserver==="undefined")return;
        const observer=new ResizeObserver(sync);observer.observe(el);return()=>observer.disconnect();
    },[]);
    function switchTab(next){
        if(!CONSOLE_TABS.includes(next))next="output";
        if(next===tab)return;
        const el=rootRef.current;if(el)tabScrollRef.current[tab]=el.scrollTop||0;
        try{window.localStorage.setItem(CONSOLE_TAB_KEY,next);}catch(e){}
        setTab(next);
    }
    React.useEffect(()=>{
        const el=rootRef.current;if(!el)return;
        let raf2=0;
        const raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(()=>{
            const target=Math.max(0,Number(tabScrollRef.current[tab])||0);
            if(rootRef.current)rootRef.current.scrollTop=target;
        });});
        return()=>{cancelAnimationFrame(raf1);if(raf2)cancelAnimationFrame(raf2);};
    },[tab]);

	// 挂载：连 ComfyUI + 接管在跑的任务
	React.useEffect(() => {
		let dead = false;
		(async () => {
			try {
				// DSH 启动时宿主 sidecar 可能略晚于前端页面，给它短暂的就绪窗口。
				for (let i = 0; i < 8; i++) {
					try { verifySidecarHealth(await jget(EXPANDER + "/health", 1500)); break; }
					catch (e) { if (i === 7 || /Sidecar API 不兼容|Sidecar 监听端口|Sidecar 安装身份/.test(String(e?.message || e))) throw e; await new Promise((r) => setTimeout(r, 700)); }
				}
				const cfg = await jget(EXPANDER + "/settings", 5000);
				if (!dead) { applyConnectionSettings(cfg); setSavePath(cur=>cur || cfg.outputRoot || ""); }
			} catch (ex) { if (!dead) setConnNotice(String(ex?.message || ex)); }
			const loadMeta = async () => {
				const pick = async (node, key) => {
					const oi = await jget(COMFY + "/object_info/" + node);
					return comboOptions(oi, node, key);
				};
				const c = await pick("CheckpointLoaderSimple", "ckpt_name");
				const l = await pick("LoraLoader", "lora_name");
				const v = await pick("VAELoader", "vae_name");
				const t = await clipModelOptions();
				const k = await jget(COMFY + "/object_info/KSampler");
				// 放大模型（UpscaleModelLoader 走新格式，必须用 comboOptions）
				let up = [], upFiltered = 0;
				try {
					const raw = await pick("UpscaleModelLoader", "model_name");
					up = raw.filter(looksLikeUpscaler);
					upFiltered = raw.length - up.length;
				} catch (e) { up = []; }
				if (dead) return;
				setCkpts(c); setLoras(l);
				setVaes(v);
				setClips(t);
				setUpscalers(up);
				setUpscaleFiltered(upFiltered);
				setUpscaleModel((cur) => (up.indexOf(cur) >= 0 ? cur : (up[0] || "")));
				// 保留暂不可用的已存组件，提交前诊断。
				const req = k.KSampler.input.required;
				setSamplers(comboOptions(k, "KSampler", "sampler_name"));
				setSchedulers(comboOptions(k, "KSampler", "scheduler"));
				const types = comboOptions(await jget(COMFY + "/object_info/CLIPLoader"), "CLIPLoader", "type");
				if(dead)return;setClipTypes(types);
                try{const unet=await jget(COMFY+"/object_info/UNETLoader",10000);if(dead)return;setDiffusions(comboOptions(unet,"UNETLoader","unet_name"));setWeightTypes(comboOptions(unet,"UNETLoader","weight_dtype"));}catch{if(!dead)setDiffusions([]);}
				setCkpt((cur) => cur || (c[0] || ""));
			};
            try {
                // 自动连接只检测真实 API，不主动启动 ComfyUI。
                await jget(COMFY + "/system_stats", 6000);
            } catch (e) {
                if (!dead) { onlineRef.current = false; setOnline(false);
                    setMsg("ComfyUI 离线：" + errText(e) + "。可点击「连接 ComfyUI」。"); }
                return;
            }
            if (dead) return;
            onlineRef.current = true;
            setOnline(true);
            try {
                await loadMeta();
                await PBG.adopt();
                if (!dead && !PBG.snapshot()) setMsg("就绪");
            } catch (e) {
                if (!dead) setMsg("ComfyUI 已连接，但模型列表加载失败：" + errText(e));
            }

		})();
		return () => { dead = true; };
	}, [conn]);


    // Sidecar 负责探测真实 ComfyUI API；前端只读取 sidecar 状态，不直连 Windows 端口。
    // 外部手动启动 / 关闭 ComfyUI 时，5 秒内同步按钮与模型列表。
    React.useEffect(() => {
        // 单次抖动（sidecar 重启、瞬时超时、机器卡顿）不该把界面判死：
        // 连续 FAIL_STREAK_LIMIT 次都拿不到状态才报错，成功一次立刻清零。
        const FAIL_STREAK_LIMIT = 2;
        let disposed = false, polling = false, failStreak = 0;
        const tick = async () => {
            if (disposed || polling || operationRef.current) return;
            polling = true;
            try {
                const st = await jget(EXPANDER + "/comfy/online", 4500);
                if (disposed || operationRef.current) return;
                failStreak = 0;
                const running = !!st.running;
                if (running && onlineRef.current !== true) {
                    onlineRef.current = true;
                    setOnline(true);
                    setMsg("检测到 ComfyUI 已运行，正在加载模型…");
                    setConn((v) => v + 1);
                } else if (!running && onlineRef.current !== false) {
                    onlineRef.current = false;
                    setOnline(false);
                    PBG.shutdown();
                    setMsg("ComfyUI 离线；配置启动文件后可点击「连接 ComfyUI」");
                }
            } catch (e) {
                failStreak += 1;
                if (failStreak < FAIL_STREAK_LIMIT) return;
                if (!disposed && !operationRef.current && onlineRef.current !== false) {
                    onlineRef.current = false;
                    setOnline(false);
                    setMsg("无法访问插件服务，请检查 sidecar：" + errText(e));
                }
            } finally { polling = false; }
        };
        const timer = setInterval(tick, 5000);
        return () => { disposed = true; clearInterval(timer); };
    }, []);

    // ComfyUI 的逐步采样进度只通过 WebSocket 推送；连接失败时任务区自动退回不定进度动画。
    React.useEffect(()=>{
        if(!online || typeof WebSocket==="undefined")return;
        const port=validPort(settingsInfo?.comfyPort,COMFY_PORT);let ws,closed=false,retry;
        const connect=()=>{
            if(closed)return;
            try{ws=new WebSocket("ws://127.0.0.1:"+port+"/ws?clientId=dsh-comfyui-console");
                ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m?.type==="progress"){const d=m.data||{};PBG.progress(d.prompt_id,d.value,d.max);}}catch{}};
                ws.onclose=()=>{if(!closed)retry=setTimeout(connect,3500);};
                ws.onerror=()=>{try{ws.close();}catch{}};
            }catch{retry=setTimeout(connect,3500);}
        };
        connect();return()=>{closed=true;clearTimeout(retry);try{ws?.close();}catch{}};
    },[online,settingsInfo?.comfyPort]);

	// 参数变了就记住（下次进来还在）
	React.useEffect(() => {
		if(!ensureModelSettingsBackup()){setMsg("配置备份失败，本次设置尚未保存；请检查浏览器存储空间");return;}
        USER.modelConfigs={...USER.modelConfigs,[modelConfigKey(modelConfig,ckpt)]:currentModelSetup()};
        // 必须合并写入：两个 effect 的依赖集不重合（这个带 modelConfig/postControls/sizeMultiplier/
        // seedMode/saveOutput/savePath，下面那个带 theme/lockSeed/byType），整对象替换会互相抹字段
        // ——主题每次重开都变回「跟随系统」就是这么来的。
        USER.last = Object.assign({}, USER.last || {}, {modelConfig:{...modelConfig}, ckpt, clip, clipType, vae, loras: selLoras, pos, neg, w, h: hh, steps, cfg, sampler, scheduler, prefix, seed, seedMode, saveOutput, savePath, sizeMultiplier, viewKey, postControls, upscale, upscaleModel, upscaleFactor });
		if(!saveUser())setMsg("当前设置未保存，请检查浏览器存储空间");
	}, [modelConfig,ckpt, clip, clipType, vae, selLoras, pos, neg, w, hh, steps, cfg, sampler, scheduler, prefix, seed, seedMode, saveOutput, savePath, sizeMultiplier, viewKey, postControls, upscale, upscaleModel, upscaleFactor]);

	// ---- 连接与教程 ----
    function openGuide(key) {
        if (!TUTORIALS[key]) return;
        if (key === "post") { postGuideRestoreRef.current = postOpen; setPostOpen(false); }
        if (key === "model") { closeModelLibrary(); setModelControlsOpen(false); }
        if (key === "basic") { setShowModelGuide(false); closeModelLibrary(); setModelControlsOpen(false); }
        if (key === "output") switchTab("output");
        else if (key === "online") switchTab("online");
        else if (key === "basic" || key === "model" || key === "image" || key === "prompt") switchTab("gen");
        if (key === "prompt") {
            promptGuideChatRestoreRef.current = exOpen;
            promptGuidePreviewRestoreRef.current = previewMode;
            setExOpen(false);
            setPreviewMode("raw");
            switchTab("gen");
        }
        setGuide(key); setGuideStep(0); setGuideMenu(false); setShowConn(false); setShowLaunch(false);
    }
    function moveGuide(next) {
        if (!guide) return;
        const steps = TUTORIALS[guide].steps;
        const target = Math.max(0, Math.min(steps.length - 1, next));
        const step = steps[target];
        setGuideStep(target);
        setShowConn(!!step.openSettings);
        if (guide === "basic") setShowModelGuide(!!step.openModelGuide);
        if (guide === "model") {
            const kind=modelConfig.mode==='diffusion'?'diffusion':'checkpoint',main=modelConfig.mode==='diffusion'?modelConfig.main:ckpt;
            if (step.openModelLibrary) { setModelControlsOpen(false); if (!showModelLibrary) openModelLibrary(kind,main); }
            else if (step.openGenerationControls) { closeModelLibrary(); setModelControlsOpen(true); }
            else { closeModelLibrary(); setModelControlsOpen(false); }
        }
        if (guide === "post") setPostOpen(!!step.openPostControls);
        if (guide === "prompt") setExOpen(!!step.openPromptChat);
    }
    function finishGuide() {
        const key = guide;
        setGuide(null); setGuideMenu(false);
        if (key === "prompt") {
            setExOpen(promptGuideChatRestoreRef.current);
            setPreviewMode(promptGuidePreviewRestoreRef.current || "raw");
        }
        if (key === "post") setPostOpen(postGuideRestoreRef.current);
        if (key === "basic") setShowModelGuide(false);
        if (key === "model") { closeModelLibrary(); setModelControlsOpen(false); }
        // 设置路径教程结束后保持弹窗打开，允许用户真正输入并保存。
        setShowConn(key === "startPath" || key === "connect");
        if (key === "startPath") setConnNotice("请填写本机 ComfyUI 启动文件路径，然后保存设置。");
        if (key === "startPath" || key === "connect") {
            setTimeout(() => {
                try { document.querySelector('[data-cc-guide="start-script"]')?.focus(); } catch {}
            }, 30);
        }
    }
    
    async function connectionAction(mode) {
        if (operationRef.current) return;
        // React supplies a click event to the top-level button, not a mode.
        if (typeof mode!=="string") mode=null;
        if (!mode && onlineRef.current!==true) {
            setLaunchInfo(null);setLaunchError("");setShowLaunch(true);
            return;
        }
        operationRef.current = true;
        setStarting(true);setShowLaunch(false);setBrowserFallback("");
        let browserUrl="http://127.0.0.1:"+validPort(launchInfo?.settings?.comfyPort,COMFY_PORT)+"/";
        // 浏览器模式由 Windows 侧 sidecar 调用默认浏览器，避免 window.open 被弹窗拦截。
        async function openBrowser() {
            if(mode!=="browser")return false;
            try {
                const r=await jpost(EXPANDER+"/comfy/open-browser",{},8000);
                if(r?.ok){setBrowserFallback("");return true;}
            }catch(e){/* fall through to the visible link */}
            setBrowserFallback(browserUrl);
            return false;
        }
        try {
            // A service becoming online while the chooser was open must be
            // connected to, never mistaken for a request to stop it.
            if (onlineRef.current === true && !mode) {
                setMsg("正在完全关闭 ComfyUI（将终止正在生成的任务）…");
                const r = await jpost(EXPANDER + "/comfy/stop", {}, 40000);
                if (!r?.ok) throw new Error(r?.message || "关闭失败");
                PBG.shutdown();
                onlineRef.current = false; setOnline(false); setMsg(r.message || "ComfyUI 已完全关闭");
                return;
            }
            setMsg("正在检测本机 ComfyUI…");
            // 先探测，避免状态轮询尚未更新时重复启动已经运行的 ComfyUI。
            const st = await jget(EXPANDER + "/comfy/online", 6000);
            if (st.running) {
                onlineRef.current = true; setOnline(true); setMsg("已检测到 ComfyUI，复用现有服务，正在读取模型…");
                if(mode==="browser") await openBrowser();
                setConn((v) => v + 1);
                return;
            }
            const settings = await jget(EXPANDER + "/settings", 5000);
            browserUrl="http://127.0.0.1:"+validPort(settings.comfyPort,COMFY_PORT)+"/";
            applyConnectionSettings(settings);
            // 即使首次启动已有有效路径，也记录本次尝试：以后路径被清空时不再强制教程。
            const firstStartAttempt = consumeFirstStartAttempt();
            if (!settings.configured) {
                setMsg("尚未设置有效的 ComfyUI 启动路径");
                if (firstStartAttempt) {
                    openGuide("startPath");
                } else {
                    // 后续点击只打开设置弹窗；教程仍可从右上角手动重播。
                    setGuide(null);
                    setGuideMenu(false);
                    setConnNotice("请先填写有效的 ComfyUI 启动文件路径，然后保存设置。");
                    setShowConn(true);
                }
                return;
            }
            setMsg("正在通过本机启动脚本启动 ComfyUI…");
            const r = await jpost(EXPANDER + "/comfy/start", {mode}, 125000);
            if (!r?.ok) throw new Error(r?.message || "启动失败");
            if(mode==="browser"){
                // 原脚本直启时由脚本/ComfyUI 自己开网页；只有 sidecar 明确报告失败才兜底。
                if(r.browserOpened===false){ await openBrowser(); }
                else setBrowserFallback("");
            }
            setMsg((r.message || "已启动") + "，正在读取模型列表…"+(r.launch?.warning?" · "+r.launch.warning:""));
            setConn((v) => v + 1);
        } catch (e) {
            const detail = errText(e);
            setMsg("ComfyUI 操作失败：" + detail);
            // 不假定停止/启动失败一定离线：让状态轮询下一轮核实。
            if (onlineRef.current !== true) setOnline(false);
        } finally {
            operationRef.current = false; setStarting(false);
        }
    }
    function changeStartScript(value) {
        editConnectionDraft("startScript","comfyRoot");
        setStartScript(value);
        setInstallConfig(cur => cur.comfyRoot === settingsInfo?.comfyRoot ? {...cur,comfyRoot:""} : cur);
    }
    async function saveConnectionSettings() {
        if (saving) return;
        const cp = validPort(comfyPortInput, 0);
        if (!cp || cp === EXPANDER_PORT) {
            setConnNotice("端口必须在 1–65535 范围，且不能与 sidecar 端口相同"); return;
        }
        const submittedRevision=connectionDraft.current.revision;
        setSaving(true);
        try {
            const r = await jpost(EXPANDER + "/settings", {startScript:startScript.trim(), comfyPort:cp, ...pathConfig, ...installConfig}, 12000);
            const unchanged=connectionDraft.current.revision===submittedRevision;
            if(unchanged)connectionDraft.current.fields.clear();
            applyConnectionSettings(r.settings);
            setSavePath(cur => !cur || cur === settingsInfo?.outputRoot ? r.settings.outputRoot || "" : cur);
            setConnNotice(unchanged?"启动设置已保存。目录变更需重启 ComfyUI 后生效；已有运行服务不会被自动重启。":"本次提交已保存；后续编辑尚未保存。");
            setMsg("启动设置已保存");
            setConn((v) => v + 1);
        } catch (e) { setConnNotice("保存启动设置失败：" + errText(e)); setMsg("保存启动设置失败：" + errText(e)); }
        finally { setSaving(false); }
    }




	/**
	 * 一键切视角：只改**姿势段 + 构图段 + 前置相机词**，其余逐字不动。
	 *
	 * 为什么不靠"预设"：预设是快照，套用旧预设会把旧构图塞回来，
	 * 而且用户很难察觉。切视角是一条**显式动作**，改了立刻能看见。
	 */
	

	/**
	 * 把当前提示词按视角设定**校正一遍**（不改视角选择，只保证一致）。
	 * 用在"套用预设之后"：预设里的旧构图会被这一步纠正。
	 */



    // ---- 模型 Dock 与 Model Library ----
    function modelOptions(kind){return kind==="diffusion"?diffusions:kind==="checkpoint"?ckpts:kind==="clip"?clips:kind==="clipType"?clipTypes:kind==="vae"?vaes:kind==="lora"?loras:[];}
    function shortModel(name){const p=String(name||"").split(/[\\/]/);return (p.pop()||"").replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|onnx|sft)$/i,"");}
    function normModelName(name){return String(name||"").replace(/\\/g,"/").replace(/^\.\//,"").toLowerCase();}
    function comfyModelName(kind,name){const target=normModelName(name);return modelOptions(kind).find(x=>normModelName(x)===target)||name;}
    function libraryItemKey(item){return item?String(item.kind||modelLibraryKind||"models")+":"+String(item.root_id)+":"+String(item.name):"";}
    function findLibraryItem(key){return (modelLibraryData.models||[]).find(x=>libraryItemKey(x)===key)||null;}
    function applyModelPathChange(kind,change,rootId){
        cancelModelCheck();
        remapSavedModelPaths(USER,kind,change,rootId);
        setModelConfig(c=>remapModelSetupPaths({modelConfig:c},kind,change,rootId).modelConfig);
        if(kind==='checkpoint'&&(rootId===undefined||!modelIdentityRef.current||String(modelIdentityRef.current)===String(rootId)))setCkpt(change);
        if(kind==='clip')setClip(change);if(kind==='vae')setVae(change);if(kind==='upscale'){setUpscaleModel(change);setPostControls(cur=>remapModelSetupPaths({postControls:cur},kind,change).postControls);}
        if(kind==='lora')setSelLoras(items=>items.map(item=>({...item,name:change(item.name)})));
        return saveUser();
    }
    function applyMovedModel(kind,oldName,newName,rootId,options){return applyModelPathChange(kind,modelPathChange(oldName,newName,false,options),rootId);}
    function applyMovedModelFolder(kind,oldFolder,newFolder,rootId,options){
        const saved=applyModelPathChange(kind,modelPathChange(oldFolder,newFolder,true,options),rootId),prefix=oldFolder.replace(/\\/g,'/')+'/';
        setModelTreeOpen(current=>Object.fromEntries(Object.entries(current).map(([key,value])=>[key===oldFolder?newFolder:key.startsWith(prefix)?newFolder+'/'+key.slice(prefix.length):key,value])));
        setModelCreateFolder(current=>current===oldFolder?newFolder:current.startsWith(prefix)?newFolder+'/'+current.slice(prefix.length):current);
        return saved;
    }
    async function clipModelOptions(){
        const [base,gguf]=await Promise.all([
            jget(COMFY+"/object_info/CLIPLoader",10000).then(oi=>comboOptions(oi,"CLIPLoader","clip_name")).catch(()=>[]),
            jget(COMFY+"/object_info/CLIPLoaderGGUF",10000).then(oi=>comboOptions(oi,"CLIPLoaderGGUF","clip_name")).catch(()=>[]),
        ]);
        return [...new Set([...base,...gguf])];
    }
    async function refreshModelKind(kind){const m={checkpoint:["CheckpointLoaderSimple","ckpt_name",setCkpts],diffusion:["UNETLoader","unet_name",setDiffusions],clip:["CLIPLoader","clip_name",setClips],vae:["VAELoader","vae_name",setVaes],lora:["LoraLoader","lora_name",setLoras],upscale:["UpscaleModelLoader","model_name",setUpscalers]}[kind];if(!m)return [];try{const options=kind==="clip"?await clipModelOptions():comboOptions(await jget(COMFY+"/object_info/"+m[0],10000),m[0],m[1]);m[2](options);return options;}catch(e){setMsg("刷新模型列表失败："+errText(e));return [];}}
    function navigateModelFolder(kind=null,rootId=0,path="",preferred=""){
        modelNavigationRef.current++;
        modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;
        modelDetailRequestRef.current++;
        if(modelTaskRef.current)stopFocusedModelTask(true);
        modelLibraryPreferredRef.current=preferred;
        setModelLibraryKind(kind);setModelActiveFolder({root_id:rootId,path});
        setModelLibraryQuery("");setModelLibrarySelection([]);setModelLibraryFocus(null);setModelLibraryDetail(null);
        setModelLibraryData({roots:[],folders:[],models:[]});setModelLibraryError("");
        setCreatingModelFolder(false);setNewModelFolderName("");setModelDropTarget("");setModelTreeOpen({});setModelCreateFolder("");
    }
    function openModelLibrary(kind=null,preferred=""){
        setComponentPicker(null);setModelPins(readModelPins());navigateModelFolder(kind,0,"",preferred||"");setShowModelLibrary(true);
    }
    async function loadModelLibrary(kind=modelLibraryKind){
        modelLibraryLoadRef.current?.abort();
        const ctl=new AbortController();modelLibraryLoadRef.current=ctl;
        const preferred=modelLibraryPreferredRef.current;
        setModelLibraryLoading(true);setModelLibraryError("");
        try{
            const query=new URLSearchParams({kind:kind||"models",root_id:String(modelActiveFolder.root_id),folder:"",tree:"1",q:modelLibraryQuery,...(preferred?{preferred}:{})});
            const data=await jget(EXPANDER+(kind?"/models/browser?"+query:"/models/catalog?q="+encodeURIComponent(modelLibraryQuery)),20000,ctl.signal);
            if(ctl.signal.aborted||modelLibraryLoadRef.current!==ctl)return;
            if(!Array.isArray(data.folders)||!Array.isArray(data.models))throw new Error("目录接口不可用，请同时更新并重启 Sidecar");
            setModelLibraryData({...data,roots:data.roots||[]});
            let focus=preferred?data.models.find(x=>normModelName(x.name)===normModelName(preferred)):data.models.find(x=>libraryItemKey(x)===libraryItemKey(modelLibraryFocus));
            if(!focus&&kind&&data.models.length)focus=data.models.find(x=>(modelLibraryQuery||!x.folder)&&x.is_model!==false)||data.models.find(x=>modelLibraryQuery||!x.folder)||null;
            setModelLibraryFocus(focus||null);setModelLibrarySelection(focus?[libraryItemKey(focus)]:[]);
            if(data.root_id!=null&&data.root_id!==modelActiveFolder.root_id)setModelActiveFolder({root_id:data.root_id,path:""});
            if(focus?.folder){
                const parts=focus.folder.split('/'),parents=Object.fromEntries(parts.map((_,i)=>[parts.slice(0,i+1).join('/'),true]));
                setModelTreeOpen(old=>({...old,...parents}));
            }
            modelLibraryPreferredRef.current="";
        }catch(e){if(!ctl.signal.aborted&&modelLibraryLoadRef.current===ctl)setModelLibraryError("读取模型库失败："+errText(e));}
        finally{if(modelLibraryLoadRef.current===ctl){modelLibraryLoadRef.current=null;setModelLibraryLoading(false);}}
    }
    function stopModelLibraryLoad(){modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;setModelLibraryLoading(false);setModelLibraryError("已停止读取目录");}
    async function loadModelDetail(item,kind=modelLibraryKind){
        const request=++modelDetailRequestRef.current;
        setModelAssetMessage("");setModelLibraryDetail(null);
        if(!item){setModelLibraryDetailBusy(false);return;}
        kind=item.kind||kind;
        setModelLibraryDetailBusy(true);
        try{
            const d=await jget(EXPANDER+"/models/detail?kind="+encodeURIComponent(kind)+"&root_id="+encodeURIComponent(item.root_id)+"&name="+encodeURIComponent(item.name),20000);
            if(request===modelDetailRequestRef.current)setModelLibraryDetail(d);
        }catch(e){if(request===modelDetailRequestRef.current)setModelLibraryDetail({kind,name:item.name,root_id:item.root_id,size_text:item.size_text||"?",base_type:"未知",source:null,error:errText(e)});}
        finally{if(request===modelDetailRequestRef.current)setModelLibraryDetailBusy(false);}
    }

    React.useEffect(()=>{
        if(!showModelLibrary)return;
        const timer=setTimeout(()=>loadModelLibrary(modelLibraryKind),modelLibraryQuery?180:0);
        return()=>{clearTimeout(timer);modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;};
    },[showModelLibrary,modelLibraryKind,modelActiveFolder.root_id,modelActiveFolder.path,modelLibraryQuery]);
    React.useEffect(()=>{if(showModelLibrary)loadModelDetail(modelLibraryFocus);},[showModelLibrary,modelLibraryKind,modelLibraryFocus]);
    function visibleLibraryModels(){const q=modelLibraryQuery.trim().toLowerCase();return (modelLibraryData.models||[]).filter(x=>{
        if(q)return String(x.name).toLowerCase().includes(q);
        const parts=(x.folder||'').split('/').filter(Boolean);return parts.every((_,i)=>modelTreeOpen[parts.slice(0,i+1).join('/')]);
    });}
    function selectLibraryModel(item,e={}){const key=libraryItemKey(item),all=visibleLibraryModels(),keys=all.map(libraryItemKey);let next;if(e.shiftKey&&modelLibraryAnchorRef.current){const a=keys.indexOf(modelLibraryAnchorRef.current),b=keys.indexOf(key);if(a>=0&&b>=0)next=keys.slice(Math.min(a,b),Math.max(a,b)+1);else next=[key];}else if(e.ctrlKey||e.metaKey){next=modelLibrarySelection.includes(key)?modelLibrarySelection.filter(x=>x!==key):modelLibrarySelection.concat(key);modelLibraryAnchorRef.current=key;}else{next=[key];modelLibraryAnchorRef.current=key;}setModelLibrarySelection(next);setModelLibraryFocus(item);setModelCreateFolder(item.folder||"");}
    function selectedLibraryItems(){return modelLibrarySelection.map(findLibraryItem).filter(Boolean);}
    function startModelDrag(item,e){const key=libraryItemKey(item);const items=modelLibrarySelection.includes(key)?selectedLibraryItems():[item];if(!modelLibrarySelection.includes(key))setModelLibrarySelection([key]);setModelLibraryFocus(item);modelDragRef.current={type:"models",items};try{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",items.map(x=>x.name).join("\n"));}catch(_){}}
    function startFolderDrag(folder,e){modelDragRef.current={type:"folder",folder};try{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",folder.path);}catch(_){}}
    async function dropModelItems(rootId,folder,e){
        e?.preventDefault();setModelDropTarget("");
        const drag=modelDragRef.current,navigation=modelNavigationRef.current,kind=modelLibraryKind;
        if(!drag||!kind)return;
        try{
            if(!ensureModelSettingsBackup())throw new Error("配置备份失败，请释放浏览器存储空间后重试；文件尚未移动");
            let pathsSaved=true;
            if(drag.type==="models"){
                if(drag.items.some(x=>Number(x.root_id)!==Number(rootId)))throw new Error("暂不支持跨模型根目录移动");
                const r=await jpost(EXPANDER+"/models/manage",{action:"move_many",kind,names:drag.items.map(x=>({name:x.name,root_id:x.root_id})),folder},30000);
                const options=await refreshModelKind(kind);
                for(const m of r.moved||[])pathsSaved=applyMovedModel(kind,m.old_name,m.new_name,rootId,options)&&pathsSaved;
                setMsg("已移动 "+(r.moved||[]).length+" 个模型"+(pathsSaved?"":"；路径配置保存失败，请勿关闭页面并检查浏览器存储空间"));
            }else if(drag.type==="folder"){
                if(Number(drag.folder.root_id)!==Number(rootId))throw new Error("暂不支持跨模型根目录移动文件夹");
                const moved=await jpost(EXPANDER+"/models/manage",{action:"move_folder",kind,source_folder:drag.folder.path,root_id:drag.folder.root_id,folder},30000);
                const options=await refreshModelKind(kind);
                pathsSaved=applyMovedModelFolder(kind,moved.old_folder||drag.folder.path,moved.folder,rootId,options);
                setMsg("文件夹已移动"+(pathsSaved?"":"；路径配置保存失败，请勿关闭页面并检查浏览器存储空间"));
            }
            if(navigation===modelNavigationRef.current)await loadModelLibrary(kind);
        }catch(ex){setMsg("移动失败："+errText(ex));}
        finally{if(modelDragRef.current===drag)modelDragRef.current=null;}
    }
    async function createModelFolder(){
        const name=newModelFolderName.trim();
        if(!modelLibraryKind||modelLibraryKind==="models"||!name||modelFolderBusy)return;
        if(/[\\/:]/.test(name)||name==="."||name===".."){setModelLibraryError("请输入单个文件夹名称");return;}
        const folder=[modelCreateFolder,name].filter(Boolean).join("/"),navigation=modelNavigationRef.current;
        setModelFolderBusy(true);setModelLibraryError("");
        try{
            await jpost(EXPANDER+"/models/manage",{action:"mkdir",kind:modelLibraryKind,root_id:modelActiveFolder.root_id,folder},15000);
            if(navigation!==modelNavigationRef.current)return;
            setCreatingModelFolder(false);setNewModelFolderName("");if(modelCreateFolder)setModelTreeOpen(old=>({...old,[modelCreateFolder]:true}));await loadModelLibrary();
        }catch(e){if(navigation===modelNavigationRef.current)setModelLibraryError("创建文件夹失败："+errText(e));}
        finally{setModelFolderBusy(false);}
    }
    async function openFocusedModelFile(){
        const item=modelLibraryFocus;
        try{await jpost(EXPANDER+"/models/manage",{action:item?"open_file":"open_directory",kind:item?.kind||modelLibraryKind||"models",root_id:item?.root_id??modelActiveFolder.root_id,folder:item?.name||modelCreateFolder},12000);}
        catch(e){setModelLibraryError("打开文件位置失败："+errText(e));}
    }
    function stopFocusedModelTask(silent=false) {
        const task=modelTaskRef.current;
        if(!task||task.stopping)return;
        task.stopping=true;
        setModelTaskStopping(true);
        // A separate request reaches the sidecar worker even when the original
        // request is waiting on hashing or the provider. The server checks the
        // event between chunks / images and before publishing cached results.
        jpost(EXPANDER+"/models/tasks/cancel",{request_id:task.id},10000)
            .then(r=>{if(!silent&&modelTaskRef.current===task)setModelAssetMessage(r.cancelled?
                "已发送终止请求；正在进行的网络读取可能需要等待超时":"任务已结束，无需终止");})
            .catch(e=>{if(!silent&&modelTaskRef.current===task)setModelAssetMessage("终止请求失败："+errText(e));})
            .finally(()=>{task.controller.abort();if(modelTaskRef.current===task){modelTaskRef.current=null;setModelSourceBusy(false);setModelPreviewBusy(false);setModelTaskStopping(false);}});
    }
    async function runFocusedModelTask(action){
        const item=modelLibraryFocus;
        if(!item||modelTaskRef.current)return;
        const request=modelDetailRequestRef.current;
        const controller=new AbortController();
        const id="model-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
        const task={id,controller,request,stopping:false};
        modelTaskRef.current=task;
        setModelTaskStopping(false);
        if(action==="source")setModelSourceBusy(true);else setModelPreviewBusy(true);
        setModelAssetMessage("");
        try{
            const r=await jpost(EXPANDER+"/models/"+action,
                {kind:item.kind||modelLibraryKind,name:item.name,root_id:item.root_id,request_id:id},180000,controller.signal);
            if(modelTaskRef.current!==task||request!==modelDetailRequestRef.current||task.stopping)return;
            setModelLibraryDetail(cur=>cur?{...cur,...(action==="source"?{source:r.source||cur.source}:{}),
                preview:r.preview||cur.preview,previews:r.previews||[r.preview||cur.preview].filter(Boolean)}:cur);
            refreshModelDockAssets();
            setModelAssetMessage(action==="source"?[r.warning,r.preview_message].filter(Boolean).join("；"):(r.message||""));
            if(action==="source")setMsg(r.source?.url?"已记录模型来源"+(r.previews?.length?"，当前有 "+r.previews.length+" 张本地预览/示例图":""):"没有找到模型来源");
        }catch(e){
            if(modelTaskRef.current===task&&!task.stopping&&!controller.signal.aborted&&request===modelDetailRequestRef.current)
                setModelAssetMessage((action==="source"?"获取模型来源失败：":"获取预览图失败：")+errText(e));
        }finally{
            if(modelTaskRef.current===task&&!task.stopping){
                modelTaskRef.current=null;setModelSourceBusy(false);setModelPreviewBusy(false);setModelTaskStopping(false);
            }
        }
    }
    function fetchFocusedModelSource(){return runFocusedModelTask("source");}
    function fetchFocusedModelPreview(){return runFocusedModelTask("preview");}
    // Switching model/kind or closing the library must stop the old lookup;
    // its late response must never update the newly selected model.
    React.useEffect(()=>{
        if(modelTaskRef.current)stopFocusedModelTask(true);
    },[modelLibraryFocus,modelLibraryKind,showModelLibrary]);
    React.useEffect(()=>()=>{if(modelTaskRef.current)stopFocusedModelTask(true);},[]);

    const mainInspectionKey=JSON.stringify([modelConfig.mode,modelConfig.mode==='diffusion'?modelConfig.main:ckpt,modelConfig.identity]);
    React.useEffect(()=>{
        const kind=modelConfig.mode,name=kind==='diffusion'?modelConfig.main:ckpt;if(!name){setModelFileChecking(false);return;}setModelFileChecking(true);
        const ctl=new AbortController();let active=true;
        jget(EXPANDER+'/models/detail?kind='+kind+'&name='+encodeURIComponent(name)+(modelConfig.identity!==''?'&root_id='+encodeURIComponent(modelConfig.identity):''),12000,ctl.signal).then(data=>{
            if(!active||!data.loading)return;
            const info=data.loading;
            setModelConfig(c=>{const next={contentMode:['diffusion','checkpoint'].includes(info.mode)?info.mode:'unknown',embeddedClip:typeof info.embedded_clip==='boolean'?info.embedded_clip:null,embeddedVae:typeof info.embedded_vae==='boolean'?info.embedded_vae:null};
                const out=withModelFileInfo(c,next);if(c.contentMode===out.contentMode&&c.embeddedClip===out.embeddedClip&&c.embeddedVae===out.embeddedVae&&c.encoderMode===out.encoderMode)return c;return out;});
        }).catch(()=>{}).finally(()=>{if(active)setModelFileChecking(false);});
        return()=>{active=false;ctl.abort();};
    },[mainInspectionKey,modelDockRevision]);
    function cancelModelCheck(){const ctl=modelCheckRef.current;if(ctl){ctl.abort();modelCheckRef.current=null;setModelCheck(false);setMsg("组件检查已取消，未提交任务");}}
    React.useEffect(()=>()=>{modelCheckRef.current?.abort();modelCheckRef.current=null;},[]);
    function currentModelSetup(){return {modelConfig:{...modelConfig},ckpt,clip,clipType,vae,loras:selLoras.map(x=>({...x})),steps,cfg,sampler,scheduler,w,h:hh,sizeMultiplier:preciseSizeMultiplier(sizeMultiplier)};}
    function restoreModelSetup(item){cancelModelCheck();setModelDockRevision(n=>n+1);setModelConfig(normalizeModelConfig(item.modelConfig));if(item.ckpt!==undefined)setCkpt(item.ckpt);setClip(item.clip||"");setClipType(item.clipType||"stable_diffusion");setVae(item.vae||"");}
    function chooseMainModel(mode,name,identity=""){
        if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}
        cancelModelCheck();
        if(mode===modelConfig.mode&&name===(mode==="diffusion"?modelConfig.main:ckpt)&&(!modelConfig.identity||identity===modelConfig.identity)){setModelConfig(c=>({...c,identity:identity||c.identity}));return true;}
        const target=normalizeModelConfig({mode,main:mode==="diffusion"?name:"",identity,profile:mode==="diffusion"?"unknown":"legacy"});
        USER.modelConfigs=Object.assign({},USER.modelConfigs,{[modelConfigKey(modelConfig,ckpt)]:currentModelSetup()});
        const saved=rememberedModelSetup(USER.modelConfigs,target,mode==="checkpoint"?name:ckpt);setModelConfig(saved?{...normalizeModelConfig(saved.modelConfig),identity:identity||normalizeModelConfig(saved.modelConfig).identity}:target);if(mode==="checkpoint")setCkpt(name);
        if(saved){setClip(saved.clip||"");setClipType(saved.clipType||"stable_diffusion");setVae(saved.vae||"");setSelLoras((saved.loras||[]).map(x=>({...x})));setSteps(saved.steps??steps);setCfg(saved.cfg??cfg);setSampler(saved.sampler||sampler);setScheduler(saved.scheduler||scheduler);setW(saved.w||w);setHh(saved.h||hh);setSizeMultiplier(preciseSizeMultiplier(saved.sizeMultiplier));}
        else{setClip("");setVae("");setSelLoras(cur=>cur.map(x=>({...x,enabled:false})));}
        setMsg(saved?"已恢复该主模型的配置":"已选择主模型；请确认类型和组件，原 LoRA 已保留为暂停状态");
        // 在模型库点「使用」选中 checkpoint 时，把名字回传给生成页那份 ckpt（两套 state）。
        if(mode==="checkpoint"&&typeof MODEL_PICKED_SINK==="function"){try{MODEL_PICKED_SINK(name);}catch(e){/* 生成页未挂载时忽略 */}}
        return true;
    }

    function modelField(label,value,options,onChange,combo,forceOpen,guideTarget){return h("div",{className:"cc-model-aux-field"+(combo?' cc-field-capsule':''),key:label,'data-cc-guide':guideTarget||undefined},h("span",null,label),h(SelectMenu,{label,value,options,onChange,theme,minWidth:combo?0:150,forceSearch:true,forceOpen:!!forceOpen}));}
    function refreshModelDockAssets(){MODEL_DOCK_ASSETS.clear();setModelDockRevision(n=>n+1);}
    function closeModelLibrary(){modelNavigationRef.current++;modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;modelDetailRequestRef.current++;setShowModelLibrary(false);setComponentPicker(null);}
    
    function changeEncoderMode(mode){
        cancelModelCheck();const oldRoles=modelEncoderRoles(modelConfig),oldFiles=[clip,modelConfig.clip2,modelConfig.clip3,modelConfig.clip4],byRole=Object.fromEntries(oldRoles.map((role,i)=>[role,oldFiles[i]||'']));
        const nextRoles=modelEncoderRoles({...modelConfig,encoderMode:mode}),values=nextRoles.map(role=>byRole[role]||'');setClip(values[0]||'');
        setModelConfig(c=>({...c,encoderMode:mode,encoderOverride:mode!=='embedded',clip2:values[1]||'',clip3:values[2]||'',clip4:values[3]||'',componentOrder:controlEntries().map(e=>e.key).filter(key=>!key.startsWith('encoder:')||nextRoles.includes(key.slice(8)))}));
    }
    function controlEntries(){return generationControlEntries({modelConfig,clip,vae,loras:selLoras});}
    function currentComponentKeys(){return controlEntries().map(e=>e.key);}
    function appendComponentOrder(key){const order=currentComponentKeys();setModelConfig(c=>({...c,componentOrder:[...order.filter(k=>k!==key),key]}));}
    function addModelComponent(kind,role=''){
        if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}
        cancelModelCheck();
        if(kind==='lora'){const id='slot-'+Date.now().toString(36)+'-'+(++componentSequence.current);appendComponentOrder('lora:'+id);setSelLoras(cur=>cur.concat([{id,name:'',model:1,clip:1,enabled:true}]));return;}
        const key=kind==='clip'?'encoder:'+role:kind;
        if(currentComponentKeys().includes(key))return;
        appendComponentOrder(key);
        if(kind==='clip')setModelConfig(c=>({...c,encoderOverride:true,encoderMode:profile.family==='sd3'&&c.encoderMode==='embedded'?'triple':c.encoderMode}));
        if(kind==='vae')setModelConfig(c=>({...c,vaeOverride:true}));
    }
    function removeControl(entry){
        cancelModelCheck();const remaining=controlEntries().filter(e=>e.key!==entry.key),order=remaining.map(e=>e.key);
        if(entry.lora)setSelLoras(cur=>cur.filter(l=>controlLoraKey(l)!==entry.key));
        if(entry.kind==='clip'&&entry.index===0)setClip('');
        if(entry.kind==='vae')setVae('');
        setModelConfig(c=>({...c,componentOrder:order,
            ...(entry.kind==='clip'?{...(entry.index>0?{['clip'+(entry.index+1)]:''}:{}),encoderOverride:remaining.some(e=>e.kind==='clip'),encoderMode:profile.family==='sd3'&&!remaining.some(e=>e.kind==='clip')&&!modelNeedsExternal(c)&&c.embeddedClip!==false?'embedded':c.encoderMode}:{}),
            ...(entry.kind==='vae'?{vaeOverride:false}:{}),...(entry.acceleration?{accelerationLora:''}:{})}));
    }
    function openControlPicker(entry){
        cancelModelCheck();setModelPins(readModelPins());navigateModelFolder(entry.kind,0,'',entry.name);
        setComponentPicker({key:entry.key,kind:entry.kind,label:entry.label,profile:modelConfig.profile,mainKey:modelConfigKey(modelConfig,ckpt)});setShowModelLibrary(true);
    }
    function applyControlFile(item){
        const target=componentPicker,entry=controlEntries().find(e=>e.key===target?.key);
        if(!target||!entry||target.profile!==modelConfig.profile||target.mainKey!==modelConfigKey(modelConfig,ckpt)||item.kind!==target.kind){setModelAssetMessage('组件已发生变化，请关闭后重新选择');return;}
        cancelModelCheck();const actual=comfyModelName(target.kind,item.name);
        if(entry.kind==='clip'){if(entry.index===0)setClip(actual);else setModelConfig(c=>({...c,['clip'+(entry.index+1)]:actual}));}
        else if(entry.kind==='vae')setVae(actual);
        else if(entry.acceleration)setModelConfig(c=>({...c,accelerationLora:actual}));
        else {
            if(selLoras.some(l=>controlLoraKey(l)!==entry.key&&normModelName(l.name)===normModelName(actual))){setModelAssetMessage('该 LoRA 已在其他容器中，请选择其他文件');return;}
            const id=entry.lora.id||'slot-'+Date.now().toString(36)+'-'+(++componentSequence.current);
            setModelConfig(c=>({...c,componentOrder:controlEntries().map(e=>e.key===entry.key?'lora:'+id:e.key)}));
            setSelLoras(cur=>cur.map(l=>controlLoraKey(l)===entry.key?{...l,id,name:actual}:l));
        }
        setMsg('已选择 '+entry.label+'：'+shortModel(actual));closeModelLibrary();
    }
    function updateControlLora(entry,change){cancelModelCheck();setSelLoras(cur=>cur.map(l=>controlLoraKey(l)===entry.key?{...l,...change}:l));}
    function renderModelAux(){
        const c=modelConfig,p=profile,sd3=p.family==='sd3',options=[];
        if(sd3)options.push(modelField('文本编码方式',c.encoderMode,[...(!modelNeedsExternal(c)&&c.embeddedClip!==false?[{value:'embedded',label:'Checkpoint 内置'}]:[]),{value:'triple',label:'CLIP-L + CLIP-G + T5XXL'},{value:'dual',label:'CLIP-L + CLIP-G'},{value:'t5',label:'T5XXL'}],changeEncoderMode,true));
        if(!p.clipType)options.push(modelField('Encoder Type',clipType,clipTypes,setClipType,true));
        if(c.mode==='diffusion')options.push(modelField('模型精度',c.dtype,weightTypes,v=>setModelConfig(x=>({...x,dtype:v})),true));
        if(['sd15','sdxl','legacy'].includes(p.family))options.push(modelField('Clip Skip',String(c.clipSkip),[{value:'0',label:'默认'},...Array.from({length:12},(_,i)=>({value:String(i+1),label:String(i+1)}))],v=>setModelConfig(x=>({...x,clipSkip:Number(v)})),true));
        if(p.slgNode)options.push(h('button',{key:'slg',type:'button',style:S.btn2,'aria-pressed':c.slg,onClick:()=>setModelConfig(x=>({...x,slg:!x.slg}))},c.slg?'SLG · 开启':'SLG · 关闭'));
        return options.length?h('div',{className:'cc-model-aux'},...options):null;
    }
    function applyFocusedModel(){
        const item=modelLibraryFocus,kind=item?.kind||modelLibraryKind;if(!item||item.is_model===false||!["checkpoint","diffusion","lora","clip","vae"].includes(kind))return;
        if(expandPhaseRef.current!=="idle"){setModelAssetMessage("请先完成或停止 AI 操作");return;}
        if(componentPicker){applyControlFile(item);return;}
        const actual=comfyModelName(kind,item.name);
        if(["checkpoint","diffusion"].includes(kind)){
            if(!chooseMainModel(kind==="diffusion"?"diffusion":"checkpoint",actual,String(item.root_id??"")))return;
            refreshModelDockAssets();closeModelLibrary();
        }else if(kind==="clip"){if(!currentComponentKeys().includes('clip'))appendComponentOrder('clip');setClip(actual);setModelConfig(c=>({...c,encoderOverride:true,encoderMode:profile.family==='sd3'&&c.encoderMode==='embedded'?'triple':c.encoderMode}));setMsg("已选择 Text Encoder："+shortModel(actual));}
        else if(kind==="vae"){if(!currentComponentKeys().includes('vae'))appendComponentOrder('vae');setVae(actual);setModelConfig(c=>({...c,vaeOverride:true}));setMsg("已选择 VAE："+shortModel(actual));}
        else{if(!selLoras.some(x=>normModelName(x.name)===normModelName(actual))){appendComponentOrder('lora:'+actual);setSelLoras(cur=>cur.concat([{name:actual,model:1,clip:1}]));}setMsg("已添加 LoRA；请确认适用的模型系列");}
    }
    function removeLora(name){setSelLoras(cur=>cur.filter(x=>x.name!==name));setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='lora:'+name)}));}
    function renderControlTile(entry){
        const l=entry.lora,name=entry.name,label=entry.role||entry.label,directKind=entry.kind==='vae'||entry.kind==='clip';
        const source=directKind?(entry.kind==='vae'?vaes:clips):[];
        const values=[...new Set(source.map(x=>String(x)).filter(x=>x&&!/^put_/i.test(x.split(/[\\/]/).pop()||'')))];
        if(name&&!values.includes(name))values.unshift(name);
        const directOptions=[{value:'',label:values.length?'未选择':'未找到模型文件'},...values.map(x=>({value:x,label:x}))];
        const chooseDirect=value=>{
            if(!value)return;
            const actual=comfyModelName(entry.kind,value);cancelModelCheck();
            if(entry.kind==='vae')setVae(actual);
            else if(entry.index===0)setClip(actual);
            else setModelConfig(c=>({...c,['clip'+((entry.index||0)+1)]:actual}));
            setMsg('已选择 '+label+'：'+shortModel(actual));
        };
        return h('div',{key:entry.key,'data-component-key':entry.key,'data-kind':entry.kind,'data-empty':!name,'data-paused':l?.enabled===false,className:'cc-control-tile'},
            directKind?h('div',{className:'cc-control-direct'},h('strong',null,label),
                h(SelectMenu,{theme,label:entry.key,value:name||'',options:directOptions,onChange:chooseDirect,minWidth:0,forceSearch:values.length>12}))
            :h('button',{type:'button',className:'cc-control-file','aria-label':'选择 '+entry.label+(l?' '+(selLoras.indexOf(l)+1):''),onClick:()=>openControlPicker(entry)},
                h(ModelDockAsset,{kind:entry.kind,name,revision:modelDockRevision,variant:'lora'}),
                h('span',null,h('strong',null,label),h('span',{title:name},shortModel(name)||'点击选择文件'))),
            l?h('div',{className:'cc-control-lora-settings'},
                h('div',{className:'cc-control-pill cc-field-capsule'},h('span',{className:'cc-control-pill-label'},'适用'),h(SelectMenu,{theme,label:entry.key+' 开关',minWidth:0,value:l.enabled===false?'off':'on',options:[{value:'on',label:'ON'},{value:'off',label:'OFF'}],onChange:value=>updateControlLora(entry,{enabled:value==='on'})})),
                h('div',{className:'cc-control-pill cc-control-weight cc-field-capsule'},
                    h('span',{className:'cc-control-pill-label'},'LoRA 强度'),
                    h(DraggableNumberInput,{value:l.model,onChange:v=>updateControlLora(entry,{model:v,clip:v}),min:-10,max:10,step:.05,precision:2,dragPerPixel:1/100,label:'LoRA 强度',decreaseLabel:'降低 LoRA 强度',increaseLabel:'提高 LoRA 强度'}))):null,
            h('button',{type:'button',className:'cc-control-remove','aria-label':'移除 '+entry.label+(l?' '+(selLoras.indexOf(l)+1):''),onClick:()=>removeControl(entry)},h(PromptIcon,{name:'x',size:13})));
    }
    function renderGenerationControls(){
        if(!modelControlsOpen)return null;
        const entries=controlEntries(),keys=entries.map(e=>e.key),roles=controlEncoderRoles(modelConfig);
        const addButton=(key,label,kind,role)=>h('button',{type:'button',key,className:'cc-control-add-row',disabled:keys.includes(key),onClick:()=>addModelComponent(kind,role)},h('span',null,label),h('small',null,keys.includes(key)?'已添加':'添加'));
        const aux=renderModelAux();
        return h(OverlayModal,{title:'生成时控制',className:'cc-generation-controls-dialog cc-model-library-dialog',width:1280,theme,guideTarget:'generation-panel',onClose:()=>setModelControlsOpen(false)},
            aux?h('div',{className:'cc-generation-toolbar'},aux):null,
            h('div',{className:'cc-generation-controls'},
                h('aside',{className:'cc-control-catalog','data-cc-guide':'generation-components','aria-label':'可添加的组件'},h('strong',null,'组件列表'),
                    addButton('vae','VAE','vae'),
                    ...roles.map(role=>addButton('encoder:'+role,role,'clip',role)),
                    addButton('lora-new','LoRA','lora'),
                    profile.acceleration?addButton('acceleration','加速 LoRA · '+profile.acceleration,'acceleration'):null),
                h('div',{className:'cc-control-workspace','data-cc-guide':'generation-added'},h('div',{className:'cc-control-heading'},h('strong',null,'已添加的组件'),h('span',null,generationControlSummary(entries))),
                    h('div',{className:'cc-control-grid'},...(entries.length?entries.map(renderControlTile):[h('div',{key:'empty',className:'cc-control-empty'},'从左侧选择组件类型，添加后点击容器选择文件。')])))));

    }
    
    function modelTreeRow(item){
        const key=libraryItemKey(item),selected=modelLibrarySelection.includes(key);
        return h("button",{type:"button",key:"m:"+key,className:"cc-model-tree-row"+(selected?" is-selected":""),"aria-pressed":selected,
            draggable:!!modelLibraryKind&&item.is_model!==false,onClick:e=>selectLibraryModel(item,e),onDragStart:e=>startModelDrag(item,e),title:item.name},
            h("span",{className:"cc-model-tree-icon"},h(PromptIcon,{name:"file",size:14})),
            h("span",{className:"cc-model-tree-name"},h("span",null,item.file||item.name),modelLibraryQuery&&(item.folder||item.category)?h("small",null,[item.category,item.folder].filter(Boolean).join("/")):null),
            h("span",{className:"cc-model-tree-meta"},item.size_text||""));
    }
    function backModelFolder(){if(!componentPicker)navigateModelFolder();}
    function renderModelTree(){
        const q=modelLibraryQuery.trim().toLowerCase(),catalog=!modelLibraryKind;
        const folders=(modelLibraryData.folders||[]).filter(x=>!catalog||!q||x.name.toLowerCase().includes(q));
        const files=(modelLibraryData.models||[]).filter(x=>!catalog||!q||(x.file||x.name).toLowerCase().includes(q));
        const iconButton=(icon,label,action,disabled)=>h("button",{type:"button",className:"cc-library-icon",style:S.btn2,"aria-label":label,"data-cc-tooltip":label,disabled,onClick:action},h(PromptIcon,{name:icon,size:16}));
        const drop=(path,e)=>{e.preventDefault();e.stopPropagation();dropModelItems(modelActiveFolder.root_id,path,e);};
        function folderNode(folder,depth=0){
            const expanded=!!modelTreeOpen[folder.path],children=folders.filter(x=>x.parent===folder.path),models=files.filter(x=>(x.folder||"")===folder.path);
            return h(React.Fragment,{key:"folder:"+folder.path},
                h("button",{type:"button",className:"cc-model-tree-row cc-model-folder-row"+(modelDropTarget===folder.path?" is-drop":""),style:{paddingLeft:7+depth*16},draggable:true,title:folder.path,"aria-label":(expanded?"收起文件夹 ":"展开文件夹 ")+folder.name,"aria-expanded":expanded,
                    onClick:()=>{setModelTreeOpen(old=>({...old,[folder.path]:!expanded}));setModelCreateFolder(expanded?(folder.parent||""):folder.path);setModelLibraryFocus(null);setModelLibrarySelection([]);},
                    onDragStart:e=>startFolderDrag(folder,e),onDragOver:e=>{e.preventDefault();e.stopPropagation();setModelDropTarget(folder.path);},onDrop:e=>drop(folder.path,e)},
                    h(PromptIcon,{name:expanded?"chevronDown":"chevronRight",size:12}),h("span",{className:"cc-model-tree-icon"},h(PromptIcon,{name:"folder",size:15})),h("span",{className:"cc-model-tree-name"},h("span",null,folder.name))),
                expanded?[...children.map(x=>folderNode(x,depth+1)),...models.map(item=>h("div",{key:libraryItemKey(item),className:"cc-model-tree-indent",style:{paddingLeft:(depth+1)*16}},modelTreeRow(item))),!children.length&&!models.length?h("small",{key:"empty",className:"cc-model-folder-empty",style:{paddingLeft:24+(depth+1)*16}},"此目录为空"):null]:null);
        }
        const catalogRows=()=>orderModelFolders(folders,modelPins.pins).map(folder=>{
            const key=modelFolderPinKey(folder),pinned=modelPins.pins.includes(key),label=(pinned?"取消置顶 ":"置顶 ")+folder.name;
            return h("div",{key,className:"cc-model-catalog-row"},
                h("button",{type:"button",className:"cc-model-tree-row cc-model-folder-row",title:folder.path,"aria-label":"打开文件夹 "+folder.name,onClick:()=>navigateModelFolder(folder.kind,folder.root_id)},
                    h("span",{className:"cc-model-tree-icon"},h(PromptIcon,{name:"folder",size:15})),h("span",{className:"cc-model-tree-name"},h("span",null,folder.name),folder.external?h("small",null,folder.path):null)),
                h("button",{type:"button",className:"cc-model-pin cc-library-icon","aria-label":label,"aria-pressed":pinned,"data-cc-tooltip":label,onClick:()=>setModelPins(old=>toggleModelPin(old,key))},h(PromptIcon,{name:"pin",size:14}),pinned?h("span",null,modelPins.ranks[key]):null),
                h("button",{type:"button",className:"cc-model-catalog-open cc-library-icon","aria-label":"进入文件夹 "+folder.name,onClick:()=>navigateModelFolder(folder.kind,folder.root_id)},h(PromptIcon,{name:"chevronRight",size:12})));
        });
        return h("div",{className:"cc-model-tree","data-cc-guide":"model-library-left"},
            !catalog?h("div",{className:"cc-model-tree-nav"},
                !componentPicker?iconButton("chevronLeft","返回 models 目录",backModelFolder,modelFolderBusy):null,
                h("button",{type:"button",className:"cc-model-tree-root","aria-label":"选择模型目录根层",onClick:()=>{setModelCreateFolder("");setModelLibraryFocus(null);setModelLibrarySelection([]);},onDragOver:e=>e.preventDefault(),onDrop:e=>drop("",e)},modelLibraryData.roots?.[0]?.name||"…"),
                iconButton("plus","新建文件夹",()=>setCreatingModelFolder(v=>!v),modelFolderBusy)):null,
            creatingModelFolder&&!catalog?h("form",{className:"cc-model-new-folder",onSubmit:e=>{e.preventDefault();createModelFolder();}},
                h("input",{autoFocus:true,"aria-label":"文件夹名称",value:newModelFolderName,placeholder:(modelCreateFolder?modelCreateFolder+"/":"")+"Folder name",disabled:modelFolderBusy,onChange:e=>setNewModelFolderName(e.target.value),onKeyDown:e=>{if(e.key==="Escape"){e.stopPropagation();setCreatingModelFolder(false);}}}),
                h("button",{type:"submit",style:S.btn2,disabled:modelFolderBusy||!newModelFolderName.trim()},modelFolderBusy?"创建中…":"创建"),iconButton("x","取消新建文件夹",()=>setCreatingModelFolder(false),modelFolderBusy)):null,
            h("div",{className:"cc-model-tree-scroll",onDragOver:e=>{if(!catalog)e.preventDefault();},onDrop:e=>{if(!catalog)drop("",e);}},
                modelLibraryLoading?h("div",{className:"cc-model-library-loading",role:"status"},h("span",{className:"cc-icon-spinner"},h(PromptIcon,{name:"spinner",size:14})),"正在读取目录…"):
                    h(React.Fragment,null,...(catalog?catalogRows():q?[]:folders.filter(x=>!x.parent).map(x=>folderNode(x))),
                        ...(catalog||q?files:files.filter(x=>!x.folder)).map(modelTreeRow),
                        !folders.length&&!files.length?h("div",{className:"cc-model-library-empty"},q?"没有匹配的文件":"此目录为空"):null)));
    }
    function renderModelInspector(){
        const item=modelLibraryFocus;
        if(!item)return h("div",{className:"cc-model-inspector","data-cc-guide":"model-library-right"},h("div",{className:"cc-model-preview-placeholder"},h(PromptIcon,{name:"image",size:30}),h("span",null,"选择左侧文件查看预览")));
        const record=modelLibraryDetail;
        const d=record && record.name===item.name && (record.root_id==null||Number(record.root_id)===Number(item.root_id)) && (!record.kind||record.kind===(item.kind||modelLibraryKind))?record:null;
        const source=d?.source,isModel=item.is_model!==false,kind=item.kind||modelLibraryKind;
        const baseModel=source?.base_model||(d?.base_type&&d.base_type!=="未知"?d.base_type:"")||"未知";
        const triggerRaw=source?.trained_words??d?.metadata?.["modelspec.trigger_phrase"]??"";
        const triggerWords=[...new Set((Array.isArray(triggerRaw)?triggerRaw:String(triggerRaw).split(/[,，\n]/)).map(x=>String(x).trim()).filter(Boolean))];
        const selectedLora=kind==="lora"&&selLoras.some(x=>normModelName(x.name)===normModelName(item.name));
        return h("div",{className:"cc-model-inspector","data-cc-guide":"model-library-right"},
            h(LocalModelPreview,{preview:d?.preview,previews:d?.previews,name:shortModel(item.name),loading:modelLibraryDetailBusy,theme}),
            (d?.previews?.length||d?.preview)&&isModel?h('button',{type:'button',style:S.btn2,disabled:modelLibraryDetailBusy||modelPreviewBusy||modelSourceBusy,onClick:()=>setPreviewEditor({kind,name:item.name,root_id:item.root_id,request:modelDetailRequestRef.current})},'编辑预览图'):null,
            isModel&&source?.url?h(TaskAction,{busy:modelPreviewBusy,stopping:modelTaskStopping,label:d?.previews?.length||d?.preview?"补齐预览图":"获取预览图",busyLabel:"正在获取示例图…",onStart:fetchFocusedModelPreview,onStop:()=>stopFocusedModelTask(),disabled:modelSourceBusy||modelLibraryDetailBusy}):null,
            h("div",{className:"cc-model-inspector-title"},h("strong",null,shortModel(item.name)),h("small",null,item.name)),
            modelLibraryDetailBusy?h("span",{style:S.dim,role:"status"},h("span",{className:"cc-icon-spinner"},h(PromptIcon,{name:"spinner",size:13}))," 读取模型信息…"):h("dl",{className:"cc-model-info-grid"},
                h("dt",null,"模型基底"),h("dd",null,baseModel),
                h("dt",null,"触发词"),h("dd",null,triggerWords.length?h("div",{className:"cc-model-trigger-words"},...triggerWords.map((w,i)=>h("span",{key:i},w))):"未提供"),
                h("dt",null,"大小"),h("dd",null,d?.size_text||item.size_text||"未知"),
                h("dt",null,"模型来源"),h("dd",null,!isModel?"—":h("div",{className:"cc-model-source-line"},
                    source?.url?h("a",{href:source.url,target:"_blank",rel:"noopener noreferrer"},(source.provider||"来源")+(source.title?" · "+source.title:"")):
                        h(TaskAction,{busy:modelSourceBusy,stopping:modelTaskStopping,label:"获取模型来源及示例图",busyLabel:"正在查询来源与示例图…",onStart:fetchFocusedModelSource,onStop:()=>stopFocusedModelTask(),disabled:modelPreviewBusy||modelLibraryDetailBusy}))),
                h("dt",null,"所在文件夹"),h("dd",null,item.folder||modelLibraryData.roots?.[0]?.name||"models")),
            modelAssetMessage?h("span",{role:"status",style:S.dim},modelAssetMessage):null,
            h("div",{className:"cc-model-inspector-actions"},isModel&&["checkpoint","diffusion","lora","clip","vae"].includes(kind)?h("button",{type:"button",style:S.btn,onClick:applyFocusedModel},componentPicker?"使用":["checkpoint","diffusion"].includes(kind)?"使用":kind==="clip"?"使用 Text Encoder":kind==="vae"?"使用 VAE":selectedLora?"已添加":"添加 LoRA"):null,
                !componentPicker&&kind==="lora"&&selectedLora?h("button",{type:"button",style:S.btn2,onClick:()=>removeLora(comfyModelName("lora",item.name))},"移除 LoRA"):null,
                h("button",{type:"button",style:S.btn2,onClick:openFocusedModelFile},h(PromptIcon,{name:"external",size:13})," 打开所在位置")));
    }

    function renderModelLibrary(){
        if(!showModelLibrary)return null;
        const rootPath=modelLibraryData.roots?.[0]?.path||modelLibraryData.path||"";
        const currentPath=modelLibraryFocus?.path||(modelLibraryKind&&modelCreateFolder?rootPath+(/[\\]/.test(rootPath)?"\\":"/")+modelCreateFolder.replace(/\//g,/[\\]/.test(rootPath)?"\\":"/"):modelLibraryData.path)||"";
        return h(OverlayModal,{title:componentPicker?"选择 "+componentPicker.label:"Model Library · 模型库",className:"cc-model-library-dialog",width:1280,theme,guideTarget:"model-library",onClose:closeModelLibrary},
            h("div",{className:"cc-model-library"},
                h("div",{className:"cc-model-library-toolbar"},
                    h("input",{className:"cc-model-path","aria-label":"文件路径",readOnly:true,value:currentPath,placeholder:"models",title:currentPath,onFocus:e=>e.target.select()}),
                    h("button",{type:"button",className:"cc-library-icon",style:S.btn2,"aria-label":"打开文件位置","data-cc-tooltip":"打开文件位置",disabled:!modelLibraryData.path,onClick:openFocusedModelFile},h(PromptIcon,{name:"folder",size:16})),
                    h("div",{className:"cc-model-library-search"},h(PromptIcon,{name:"search",size:14}),h("input",{type:"search","aria-label":"搜索文件名",value:modelLibraryQuery,placeholder:"搜索文件名…",onChange:e=>{modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;setModelLibraryQuery(e.target.value);}})),
                    h("button",{type:"button",className:"cc-library-icon cc-task-cancel-icon cc-model-refresh",style:S.btn2,"aria-busy":modelLibraryLoading,"aria-label":modelLibraryLoading?"停止读取模型目录":"刷新模型目录","data-cc-tooltip":modelLibraryLoading?"停止读取模型目录":"刷新",onClick:modelLibraryLoading?stopModelLibraryLoad:()=>{setModelPins(v=>compactModelPins(v.pins));loadModelLibrary();}},
                        modelLibraryLoading?h(React.Fragment,null,h("span",{className:"cc-icon-spinner"},h(PromptIcon,{name:"spinner",size:16})),h("span",{className:"cc-icon-stop"},h(PromptIcon,{name:"stop",size:16}))):h(PromptIcon,{name:"refresh",size:16}),h("span",null,modelLibraryLoading?"停止":"刷新"))),
                modelLibraryError?h("div",{role:"status",style:modelLibraryError==="已停止读取目录"?S.dim:S.bad,className:"cc-model-library-message"},modelLibraryError):null,
                modelLibraryData.warnings?.length?h("div",{role:"status",style:S.warn,className:"cc-model-library-message"},modelLibraryData.warnings.join("；")):null,
                h("div",{className:"cc-model-library-body"},renderModelTree(),renderModelInspector()),
                h("div",{className:"cc-model-library-hint"},"目录内单击展开 · Ctrl/⌘ 多选 · Shift 连选 · 拖动模型或文件夹移动")));
    }


	const status = online === null
        ? h("span", {"data-cc-guide":"connection-status",style:S.dim}, "● 检测中…")
        : online ? h("span", {"data-cc-guide":"connection-status",style:S.ok}, "● 在线")
        : h("span", {"data-cc-guide":"connection-status",style:S.bad}, "● 离线");


    function taskStatusLabel(t){return t.status==='running'?'正在生成':t.status==='queued'?'排队中':t.status==='submitting'?'提交中':t.status==='done'?'已完成':t.status==='cancelled'?'已取消':t.status==='save-error'?'保存失败':t.status==='saving'?'保存中':'错误';}
    function taskOrder(){const rank={running:0,submitting:1,queued:2};return tasks.filter(t=>['running','queued','submitting'].includes(t.status)).slice().sort((a,b)=>(rank[a.status]??9)-(rank[b.status]??9)||(a.queuePosition||999)-(b.queuePosition||999)||(a.submittedAt||0)-(b.submittedAt||0));}
    function renderTaskSummary(){
        const active=taskOrder(),running=active.find(t=>t.status==='running'),queued=active.filter(t=>t.status==='queued').length,current=running||active[0],popoverTasks=[...active,...tasks.filter(t=>t.status==='save-error').slice(0,3)];
        return h("div",{className:"cc-task-summary",tabIndex:0,"data-active":!!current},h("span",{className:"cc-task-dot"}),
            h("span",null,current?(taskStatusLabel(current)+(current.progressMax?" · "+current.progressValue+"/"+current.progressMax:(running&&current.params?.steps?" · "+current.params.steps+" 步":""))) : "无生图任务"),
            queued?h("span",{style:S.dim},queued+" 排队"):null,
            tasks.some(t=>t.status==='save-error')?h("span",{style:S.bad},"保存失败 · 可重试"):null,
            current&&current.status==='running'?h("span",{style:S.dim},Math.max(0,Math.floor((Date.now()-(current.startedAt||current.submittedAt||Date.now()))/1000))+"s"):null,
            h("div",{className:"cc-task-popover",role:"list",onClick:e=>e.stopPropagation()},
                popoverTasks.length?popoverTasks.map((t,i)=>h("button",{type:"button",key:t.localId||t.pid,className:"cc-task-row",onClick:()=>setTaskDetail(t)},
                    h("span",{className:"cc-task-dot",style:{background:t.status==='running'?"var(--cc-accent)":"var(--cc-muted)"}}),
                    h("span",{style:{minWidth:0,display:"flex",flexDirection:"column",gap:2}},h("strong",{style:{fontSize:11}},(i===0&&t.status==='running'?"当前 · ":"")+taskStatusLabel(t)),
                        h("small",null,(t.params?.w? t.params.w+"×"+t.params.h+" · ":"")+(t.params?.steps?t.params.steps+" 步 · ":"")+(t.params?.prefix||"未命名")),
                        t.status==='running'?(t.progressMax?h("span",{style:{height:3,borderRadius:99,background:"var(--cc-border)",overflow:"hidden",marginTop:4}},h("span",{style:{display:"block",height:"100%",width:Math.max(0,Math.min(100,t.progressValue/t.progressMax*100))+"%",background:"var(--cc-accent)"}})):h("span",{className:"cc-progress-indeterminate"})):null),
                    h("small",null,t.status==='queued'&&t.queuePosition?"#"+t.queuePosition:"查看"))):h("span",{style:{...S.dim,padding:6}},"当前没有正在进行或排队的任务")));
    }

    
    
    function stopOutputLoad(){
        const ctl=outputRequestRef.current;
        if(!ctl)return;
        // Cancel the active filesystem scan on the sidecar as well as fetch.
        if(ctl.requestId)jpost(EXPANDER+"/outputs/tasks/cancel",{request_id:ctl.requestId},10000).catch(()=>{});
        ctl.abort();outputRequestRef.current=null;
        outputLoadingRef.current=false;setOutputLoading(false);setMsg("已请求终止图库扫描");
    }
    async function loadOutputs(options={}){
        const force=options.force!==false,silent=!!options.silent;
        const fresh=outputLoadedRef.current&&(Date.now()-outputLoadedAtRef.current)<60000;
        if(outputLoadingRef.current||(!force&&fresh))return;
        const ctl=new AbortController();
        ctl.requestId="outputs-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
        outputRequestRef.current=ctl;
        outputLoadingRef.current=true;setOutputLoading(true);
        try{
            const items=await fetchAllSavedOutputs(jget, EXPANDER+"/outputs?request_id="+encodeURIComponent(ctl.requestId),5000,ctl.signal);
            if(ctl.signal.aborted||outputRequestRef.current!==ctl)return;
            const saved=items.map(x=>({...x,saved:true,source:"output",url:savedOutputUrl(x.path)}));
            setSavedOutputItems(saved);outputLoadedRef.current=true;outputLoadedAtRef.current=Date.now();
        }catch(e){if(!ctl.signal.aborted&&outputRequestRef.current===ctl)setMsg("读取输出失败："+errText(e));}
        finally{if(outputRequestRef.current===ctl){outputRequestRef.current=null;outputLoadingRef.current=false;setOutputLoading(false);}}
    }
    React.useEffect(()=>{if(tab==="output")loadOutputs({force:false,silent:outputLoadedRef.current});},[tab]);
    React.useEffect(()=>setOutputVisible(80),[outputFilter,outputSort,outputView]);
    function filteredOutputs(){
        const now=Date.now(),bounds=outputTimeBounds(outputFilter,now);
        const rows=outputItems.filter(x=>outputMatchesFilters(x,outputFilter,now,bounds));
        const time=x=>Number(x.mtime?x.mtime*1000:x.createdAt)||0;
        const area=x=>(Number(x.width)||0)*(Number(x.height)||0);
        rows.sort(outputSort==='oldest'?(a,b)=>time(a)-time(b):outputSort==='name'?(a,b)=>String(a.filename||'').localeCompare(String(b.filename||''),undefined,{numeric:true,sensitivity:'base'}):outputSort==='size'?(a,b)=>area(b)-area(a):(a,b)=>time(b)-time(a));
        return rows;
    }
    function changeOutputPreviewQuality(value){
        if(!["medium","large","original"].includes(value))return;
        setOutputPreviewQuality(value);USER.outputPreviewQuality=value;saveUser();
    }
    function outputPreviewSrc(item){
        if(!item?.path||outputPreviewQuality==="original")return item?.url||"";
        return EXPANDER+"/outputs/thumb?path="+encodeURIComponent(item.path)+"&quality="+encodeURIComponent(outputPreviewQuality);
    }
    React.useEffect(()=>{
        if(tab!=="output"||typeof IntersectionObserver==="undefined")return;
        const marker=outputLoadMoreRef.current,root=rootRef.current;if(!marker||!root)return;
        const observer=new IntersectionObserver(entries=>{
            if(!entries.some(e=>e.isIntersecting))return;
            const total=filteredOutputs().length;
            setOutputVisible(v=>Math.min(total,v+80));
        },{root,rootMargin:"700px 0px 700px 0px",threshold:0});
        observer.observe(marker);return()=>observer.disconnect();
    },[tab,outputVisible,outputItems.length,outputFilter,outputSort,outputView]);
    function updateOutputFilter(key,value){setOutputFilter(prev=>({...prev,[key]:value}));}
    function outputChip(label,selected,onClick,extra={}){
        return h("button",{type:"button",className:"cc-output-filter-chip"+(extra.className?" "+extra.className:""),"aria-pressed":!!selected,onClick,title:extra.title||label},label);
    }
    function renderOutputFilters(){
        const f=outputFilter;
        const active=outputFilterCount(f);
        const dateInvalid=f.time==='custom'&&!!f.dateFrom&&!!f.dateTo&&f.dateFrom>f.dateTo;
        const edgeInvalid=f.size==='custom'&&f.minEdge!==''&&f.maxEdge!==''&&Number(f.minEdge)>Number(f.maxEdge);
        const group=(title,body,subtitle)=>h("section",{className:"cc-output-filter-group"},
            h("div",{className:"cc-output-filter-group-title"},h("strong",null,title),subtitle?h("small",null,subtitle):null),body);
        const input=(key,placeholder,ariaLabel)=>h("input",{type:"search",className:"cc-output-filter-input",placeholder,"aria-label":ariaLabel,value:f[key],autoComplete:"off",spellCheck:false,onCompositionStart:()=>setOutputFilterFocused(true),onChange:e=>updateOutputFilter(key,e.target.value)});
        return h("section",{className:"cc-output-filter-panel"},
            h("div",{className:"cc-output-filter-head"},
                h("div",{className:"cc-output-filter-heading"},h(PromptIcon,{name:"sliders",size:15}),h("strong",null,"筛选输出"),active?h("span",{className:"cc-output-filter-count"},active+" 项"):null),
                active?h("button",{type:"button",className:"cc-output-filter-link",onClick:()=>setOutputFilter(emptyOutputFilter())},"清除全部"):null),
            h("div",{className:"cc-output-filter-body"},
                h("label",{className:"cc-output-filter-search"},h("span",null,"保存位置"),input("path","目录或路径关键词…","按保存路径筛选输出")),
                group("保存状态",h("div",{className:"cc-output-filter-chips"},
                    ...[{value:"all",label:"全部"},{value:"saved",label:"已保存"},{value:"temp",label:"仅 Temp"}].map(o=>outputChip(o.label,f.saved===o.value,()=>updateOutputFilter("saved",o.value))))),
                group("生成时间",h("div",{className:"cc-output-filter-stack"},
                    h("div",{className:"cc-output-filter-chips"},...OUTPUT_TIME_FILTERS.map(o=>outputChip(o.label,f.time===o.value,()=>updateOutputFilter("time",o.value)))),
                    f.time==='custom'?h("div",{className:"cc-output-filter-custom"},
                        h("label",null,"开始日期",h("input",{type:"date",value:f.dateFrom,"aria-label":"开始日期",onChange:e=>updateOutputFilter("dateFrom",e.target.value)})),
                        h("span",{className:"cc-output-filter-range-sep","aria-hidden":true},"→"),
                        h("label",null,"结束日期",h("input",{type:"date",value:f.dateTo,"aria-label":"结束日期",onChange:e=>updateOutputFilter("dateTo",e.target.value)})),
                        h("span",{className:"cc-output-filter-hint"},"日期包含当天；可只填一端")):null,
                    dateInvalid?h("div",{className:"cc-output-filter-error",role:"alert"},"结束日期不能早于开始日期"):null)),
                group("尺寸范围",h("div",{className:"cc-output-filter-stack"},
                    h("div",{className:"cc-output-filter-chips"},...OUTPUT_SIZE_FILTERS.map(o=>outputChip(o.label,f.size===o.value,()=>updateOutputFilter("size",o.value),{title:o.title||o.label}))),
                    f.size==='custom'?h("div",{className:"cc-output-filter-custom"},
                        h("label",null,"最长边至少",h("input",{type:"number",min:1,step:1,placeholder:"不限","aria-label":"最长边最小像素",value:f.minEdge,onChange:e=>updateOutputFilter("minEdge",e.target.value)})),
                        h("span",{className:"cc-output-filter-range-sep","aria-hidden":true},"—"),
                        h("label",null,"最长边至多",h("input",{type:"number",min:1,step:1,placeholder:"不限","aria-label":"最长边最大像素",value:f.maxEdge,onChange:e=>updateOutputFilter("maxEdge",e.target.value)})),
                        h("span",{className:"cc-output-filter-hint"},"px · 只需输入一项也能筛选")):null,
                    edgeInvalid?h("div",{className:"cc-output-filter-error",role:"alert"},"最大像素不能小于最小像素"):null),"按图片最长边自动分档，无需分别填写宽高"),
                group("画面方向",h("div",{className:"cc-output-filter-chips"},...OUTPUT_SHAPE_FILTERS.map(o=>outputChip(o.label,f.shape===o.value,()=>updateOutputFilter("shape",o.value)))),"方形单独归类；接近 1:1（0.95–1.05）视为方形"),
                h("div",{className:"cc-output-filter-foot"},h("span",null,"多个条件同时生效 · 筛选不会删除图片"),h("span",null,"共 "+outputItems.length+" 张"))
            ));
    }
    async function manageOutput(item,action){
        if(action==='delete' && !window.confirm(item.path?'确定永久删除此图片文件？此操作无法撤销。':'确定从本次会话移除此 Temp 记录？'))return;
        try{if(!item.path){if(action==='delete'){SESSION_OUTPUTS.remove(item.promptId||outputKey(item));setOutputDetail(null);setMsg("已从本次会话列表移除 Temp 输出");}else setMsg("Temp 输出没有持久文件位置");return;}await jpost(EXPANDER+"/outputs/manage",{action,path:item.path},15000);if(action==='delete'){SESSION_OUTPUTS.remove(item.promptId||item.id||item.path||item.url);setOutputDetail(null);await loadOutputs();setMsg("输出图片已删除");}}catch(e){setMsg("输出管理失败："+errText(e));}}
    async function copyOutputPath(item){if(!item?.path){setMsg("Temp 输出没有持久文件路径");return;}try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(item.path);else{const ta=document.createElement('textarea');ta.value=item.path;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}setMsg("已复制图片路径");}catch(e){setMsg("复制路径失败："+errText(e));}}
    async function openOutputDetail(item,scope="output"){
        setOutputDetailScope(scope);setOutputDetail(item);
        if(!item.path)return;
        try{
            const data=await jget(EXPANDER+"/outputs/detail?path="+encodeURIComponent(item.path),20000);
            setOutputDetail(cur=>{
                if(!cur || outputKey(cur)!==outputKey(item)||cur.path!==item.path)return cur;
                const parsed=data.params||null,current=cur.params||null;
                return {...cur,...data,stages:(data.stages||cur.stages||[]).map(stage=>({...stage,url:stage.path?savedOutputUrl(stage.path):stage.url||viewUrl(stage.imageInfo)})),url:cur.url||data.url,generationMs:cur.generationMs||data.generationMs||0,
                    params:parsed||current?{...(parsed||{}),...(current||{}),models:parsed?.models||current?.models||[]}:null};
            });
        }catch(e){setMsg("图片信息读取失败："+errText(e));}
    }
    function applyOutputParams(item){if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}const p=item?.params?{...item.params,...(item.params.generationInputs||{})}:null;if(!p){setMsg("这张图片缺少可读取的 ComfyUI 生成参数，当前设置未改变");return;}if(p.pos!==undefined)updatePrompt({pos:p.pos||"",neg:p.negativeApplied===false?promptRef.current.neg:p.neg||""});if(p.ckpt||p.modelConfig){restoreModelSetup(p);}else{if(p.clip)setClip(p.clip);if(p.vae)setVae(p.vae);}if(p.clipType)setClipType(p.clipType);if(Array.isArray(p.loras))setSelLoras(p.loras);setW(p.baseW||p.w||w);setHh(p.baseH||p.h||hh);setSizeMultiplier(preciseSizeMultiplier(p.sizeMultiplier));if(p.steps)setSteps(p.steps);if(p.cfg!==undefined)setCfg(p.cfg);if(p.sampler)setSampler(p.sampler);if(p.scheduler)setScheduler(p.scheduler);if(p.usedSeed!==undefined||p.seed!==undefined)setSeed(p.usedSeed??p.seed);setSeedMode(p.seedMode||"lock");if(p.postControls||p.upscale!==undefined)setPostControls(normalizePost(p));if(p.upscale!==undefined)setUpscale(!!p.upscale);if(p.upscaleModel)setUpscaleModel(p.upscaleModel);if(p.upscaleFactor)setUpscaleFactor(p.upscaleFactor);setOutputDetail(null);switchTab("gen");setMsg("已用该图片的生成参数替换当前设置");}
    function outputModelsFor(item){
        const p=item?.params||{},rows=Array.isArray(p.models)?p.models.map(x=>({...x})):[],seen=new Set(rows.map(x=>(x.kind||'')+'|'+(x.name||'')));
        const add=(kind,name,detail='')=>{name=String(name||'').trim();if(!name)return;const key=kind+'|'+name;if(seen.has(key))return;seen.add(key);rows.push({kind,name,detail});};
        if(p.modelConfig?.mode==='diffusion')add('diffusion',p.modelConfig.main);else add('checkpoint',p.ckpt);
        if(p.modelConfig?.clip2)add('text encoder',p.modelConfig.clip2,'第二编码器');
        if(p.modelConfig?.clip3)add('text encoder',p.modelConfig.clip3,'第三编码器');if(p.modelConfig?.clip4)add('text encoder',p.modelConfig.clip4,'第四编码器');if(p.modelConfig?.accelerationLora&&modelProfile(p.modelConfig).acceleration)add('lora',p.modelConfig.accelerationLora,'加速 LoRA · 模型 1');
        for(const l of activeModelLoras(p.loras))add('lora',l?.name,l?.modelOnly?`仅模型 ${l?.model??1}`:`模型 ${l?.model??1} · CLIP ${l?.clip??l?.model??1}`);
        if(p.modelConfig||!rows.some(x=>x.kind==='text encoder'))add('text encoder',p.clip,p.clipType?('类型 '+p.clipType):'');
        add('vae',p.vae);
        if(p.upscaleModel)add('upscaler',p.upscaleModel,p.upscaleFactor?('×'+p.upscaleFactor):'');
        return rows;
    }
    function outputModelKindLabel(kind){
        return ({checkpoint:'底模',diffusion:'Diffusion',lora:'LoRA',vae:'VAE','text encoder':'Text Encoder',controlnet:'ControlNet',upscaler:'Upscaler','clip vision':'CLIP Vision','style model':'Style Model','ip-adapter':'IP-Adapter',gligen:'GLIGEN'})[kind]||kind||'模型';
    }
    function outputSettingRows(item){
        const p=item?.params||{},rows=[];
        const add=(label,value)=>{if(value===undefined||value===null||value==='')return;rows.push([label,String(value)]);};
        add('输出尺寸',(item?.width||p.outputW||p.w||'?')+' × '+(item?.height||p.outputH||p.h||'?'));
        if(p.baseW&&p.baseH&&(Number(p.baseW)!==Number(item?.width)||Number(p.baseH)!==Number(item?.height)))add('基础尺寸',p.baseW+' × '+p.baseH);
        if(p.w&&p.h&&(Number(p.w)!==Number(item?.width)||Number(p.h)!==Number(item?.height)))add('Latent 尺寸',p.w+' × '+p.h);
        add('适配类型',p.modelConfig?modelProfile(p.modelConfig).label:undefined);if(p.modelConfig&&modelProfile(p.modelConfig).family==='sd3'){add('文本编码方式',({embedded:'Checkpoint 内置',triple:'CLIP-L + CLIP-G + T5XXL',dual:'CLIP-L + CLIP-G',t5:'T5XXL'})[p.modelConfig.encoderMode]);add('采样 Shift',p.modelConfig.shift??'模型默认');}if(p.modelConfig&&modelProfile(p.modelConfig).family!=='sd3'&&modelProfile(p.modelConfig).samplingShift)add('采样 Shift',p.modelConfig.shift??modelProfile(p.modelConfig).patchShift??'模型默认');if(p.modelConfig&&modelProfile(p.modelConfig).slgNode)add('SLG',p.modelConfig.slg?'开启':'关闭');add('Guidance',p.modelConfig&&modelProfile(p.modelConfig).guidance?p.modelConfig.guidance:undefined);add('负面提示词',p.negativeApplied===false?'本次未使用':undefined);
        add('步数',p.steps);add('CFG',p.effectiveCfg??p.cfg);add('采样器',p.sampler);add('调度器',p.scheduler);add('种子',p.usedSeed??p.seed);add('Denoise',p.denoise);
        if(p.sizeMultiplier && Number(p.sizeMultiplier)!==1)add('尺寸倍率','×'+p.sizeMultiplier);
        if(p.upscale!==undefined)add('后处理放大',p.upscale?(p.upscaleFactor?('启用 · ×'+p.upscaleFactor):'启用'):'关闭');
        const known=new Set(['steps','cfg','sampler_name','sampler','scheduler','seed','noise_seed','denoise','model','positive','negative','latent_image']);
        for(const [key,value] of Object.entries(p.samplerSettings||{})){if(known.has(key)||Array.isArray(value)||value===undefined||value===null||value==='')continue;add(key,value);}
        return rows;
    }
    function renderOutputDetailInfo(item){
        const p=item?.params||null,models=outputModelsFor(item),settings=outputSettingRows(item),created=item?.createdAt||((item?.mtime||0)*1000)||0;
        const groups=[];
        for(const m of models){let g=groups.find(x=>x.kind===(m.kind||'model'));if(!g){g={kind:m.kind||'model',items:[]};groups.push(g);}g.items.push(m);}
        const modelRows=models.length?groups.map((g,gi)=>h("div",{key:'group-'+g.kind+'-'+gi,className:"cc-output-model-group"},
            h("span",{className:"cc-output-model-group-label"},outputModelKindLabel(g.kind),g.items.length>1?h("span",{className:"cc-output-model-count"},g.items.length):null),
            h("div",{className:"cc-output-model-chips"},...g.items.map((m,i)=>{const detail=m.detail||(m.kind==='lora'&&m.strengthModel!==undefined?(m.modelOnly?`仅模型 ${m.strengthModel??1}`:`模型 ${m.strengthModel??1} · CLIP ${m.strengthClip??m.strengthModel??1}`):'');const name=shortModel(m.name||'未知');return h("span",{key:(m.name||i)+'-'+i,className:"cc-output-model-chip"+(['checkpoint','diffusion'].includes(m.kind)?' is-primary':''),title:(m.name||'未知')+(detail?'\n'+detail:'')},name+(m.kind==='lora'&&m.strengthModel!==undefined?(' · '+m.strengthModel):''));})) )):
            h("div",{style:S.dim},p?"工作流中没有识别到模型加载节点":"该图片没有可读取的 ComfyUI 工作流元数据");
        return h(React.Fragment,null,
            h("div",{className:"cc-output-info-title"},h("strong",null,item?.filename||"Temp 输出"),h("small",null,item?.path||"ComfyUI temp · 本次会话")),
            h("section",{className:"cc-output-info-section"},h("div",{className:"cc-output-info-section-head"},h("strong",null,"使用的模型"),models.length?h("span",{style:S.dim,title:"仅统计连接到当前输出且未被跳过 / 禁用的模型"},"当前输出链路 · "+models.length+" 个"):null),h("div",{className:"cc-output-model-list"},...(Array.isArray(modelRows)?modelRows:[modelRows]))),
            h(OutputPromptSection,{title:"正面提示词",text:p?.pos}),
            h(OutputPromptSection,{title:"负面提示词",text:p?.neg}),
            h("section",{className:"cc-output-info-section"},h("strong",null,"生图设置"),settings.length?h("dl",{className:"cc-output-info-grid"},...settings.flatMap(([a,b],i)=>[h("dt",{key:'dt'+i},a),h("dd",{key:'dd'+i},b)])):h("div",{style:S.dim},"该图片没有可读取的生图参数")),
            h("section",{className:"cc-output-info-section"},h("strong",null,"输出信息"),h("dl",{className:"cc-output-info-grid"},
                h("dt",null,"生成用时"),h("dd",null,formatGenerationDuration(item)),
                h("dt",null,"生成时间"),h("dd",null,created?new Date(created).toLocaleString():"未知"),
                h("dt",null,"保存状态"),h("dd",null,item?.saved?"已保存":"Temp / 未保存"),
                h("dt",null,"保存路径"),h("dd",null,item?.path||"ComfyUI temp（本次会话）"))),
            h("div",{className:"cc-output-inspector-actions"},
                h("button",{type:"button",style:S.btn,onClick:()=>applyOutputParams(item),disabled:!item?.params},"套用此图生成设置"),
                h('button',{type:'button',style:S.btn2,onClick:()=>setPreviewOutput(item)},'加入模型预览图'),
                item?.saveFailed?h("button",{type:"button",style:S.btn,onClick:async()=>{const ok=await PBG.retrySave(item.promptId);if(ok){setOutputDetail(null);await loadOutputs();setMsg("已重新保存，无需重新生成");}else setMsg("保存重试失败：请确认 Temp 文件仍在、目标目录可写");}},"重试保存"):null,
                item?.path?h("button",{type:"button",style:S.btn2,onClick:()=>manageOutput(item,'open')},"打开所在位置"):null,
                item?.path?h("button",{type:"button",style:S.btn2,onClick:()=>copyOutputPath(item)},"复制路径"):null,
                h("button",{type:"button",style:S.btn2,onClick:()=>manageOutput(item,'delete')},item?.path?"删除图片":"移除 Temp 记录")));
    }
    function outputDetailNavigation(){
        if(!outputDetail)return {prev:null,next:null};
        const rows=outputDetailScope==="recent"?sessionOutputs.slice(0,6):filteredOutputs(),index=rows.findIndex(x=>outputKey(x)===outputKey(outputDetail));
        return {prev:index>0?rows[index-1]:null,next:index>=0&&index<rows.length-1?rows[index+1]:null};
    }
    function renderOutputPage(){
        const rows=filteredOutputs(),visible=rows.slice(0,outputVisible),active=outputFilterCount(outputFilter);
        const card=(x,index=0)=>h("article",{key:outputKey(x),className:"cc-output-card",tabIndex:0,onClick:()=>openOutputDetail(x),onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openOutputDetail(x);}}},
            h("img",{src:outputPreviewSrc(x),
                onError:e=>{if(!e.currentTarget.dataset.fallback&&x.url&&e.currentTarget.src!==x.url){e.currentTarget.dataset.fallback="1";e.currentTarget.src=x.url;}},
                loading:index<8?"eager":"lazy",decoding:"async",fetchPriority:index<4?"high":"low",alt:x.filename||"输出图片"}),
            h("div",{className:"cc-output-card-meta"},
                h("span",{className:"cc-output-card-name"},x.filename||"Temp 输出"),
                h("div",{className:"cc-output-card-sub"},h("span",null,(x.width||"?")+" × "+(x.height||"?")+" · "+formatGenerationDuration(x)),h("span",{className:"cc-output-card-state"},x.saved?"已保存":"Temp"))));
        const iconBtn=(icon,label,onClick,pressed=false,disabled=false)=>h("button",{type:"button",className:"cc-icon-button cc-output-icon-btn","aria-label":label,"data-cc-tooltip":label,"aria-pressed":pressed,disabled,onClick},h(PromptIcon,{name:icon,size:17}));
        const qualityOptions=[
            {value:"medium",label:"中等",title:"中等预览：最长边约 512px，加载最快"},
            {value:"large",label:"大图",title:"大图预览：最长边约 1280px，适合查看细节"},
            {value:"original",label:"原图",title:"直接加载原始图片；大图库和高分辨率图片会明显增加内存与网络占用"},
        ];
        const closeFilterByClick=e=>{
            setOutputFilterPinned(false);setOutputFilterSuppressed(true);setOutputFilterFocused(false);
            requestAnimationFrame(()=>e.currentTarget?.blur?.());
        };
        return h("div",{className:"cc-output-page"},
            h("div",{className:"cc-output-sticky",style:{top:Math.max(0,stickyShellHeight-14)+"px"}},
                h("div",{"data-cc-guide":"output-toolbar",className:"cc-output-toolbar"},
                    h("div",{className:"cc-output-view-group","aria-label":"图库展示方式"},
                        iconBtn("image","填充展示",()=>setOutputView('masonry'),outputView==='masonry'),
                        iconBtn("layout","网格展示",()=>setOutputView('grid'),outputView==='grid')),
                    h("button",{type:"button",className:"cc-icon-button cc-output-icon-btn cc-output-refresh cc-task-cancel-icon","aria-busy":outputLoading,"aria-label":outputLoading?"停止加载图库":"刷新图库","data-cc-tooltip":outputLoading?"停止加载图库":"刷新图库",onClick:outputLoading?stopOutputLoad:()=>loadOutputs({force:true,silent:false})},
                        outputLoading?h(React.Fragment,null,h("span",{className:"cc-icon-spinner","aria-hidden":"true"},h(PromptIcon,{name:"spinner",size:16})),h("span",{className:"cc-icon-stop","aria-hidden":"true"},h(PromptIcon,{name:"stop",size:16}))):h(PromptIcon,{name:"refresh",size:16})),
                    h("div",{className:"cc-output-quality",role:"group","aria-label":"预览画质"},
                        h("span",{className:"cc-output-quality-label"},"预览画质"),
                        ...qualityOptions.map(o=>h("button",{key:o.value,type:"button",className:"cc-output-quality-btn","aria-pressed":outputPreviewQuality===o.value,title:o.title,onClick:()=>changeOutputPreviewQuality(o.value)},o.label))),
                    h("span",{className:"cc-output-counter"},rows.length===outputItems.length?(rows.length+" 张"):(rows.length+" / "+outputItems.length+" 张"))),
                h("div",{className:"cc-output-control-row","data-cc-guide":"output-controls"},
                    h("div",{className:"cc-output-search-field"},h(PromptIcon,{name:"search",size:15}),h("input",{type:"search",value:outputFilter.name,placeholder:"搜索文件名…","aria-label":"搜索文件名",autoComplete:"off",spellCheck:false,onChange:e=>updateOutputFilter("name",e.target.value)}),outputFilter.name?h("button",{type:"button",className:"cc-output-search-clear","aria-label":"清除文件名搜索",onClick:()=>updateOutputFilter("name","")},h(PromptIcon,{name:"x",size:14})):null),
                    h("div",{className:"cc-output-filter-anchor",
                        onMouseEnter:()=>{setOutputFilterHovered(true);if(outputFilterSuppressed)setOutputFilterSuppressed(false);},
                        onMouseLeave:()=>{setOutputFilterHovered(false);setOutputFilterSuppressed(false);},
                        onFocusCapture:()=>{if(!outputFilterSuppressed)setOutputFilterFocused(true);},
                        onBlurCapture:e=>{if(!e.currentTarget.contains(e.relatedTarget))setOutputFilterFocused(false);},
                        onKeyDown:e=>{if(e.key==='Escape'){e.preventDefault();setOutputFilterPinned(false);setOutputFilterFocused(false);setOutputFilterSuppressed(true);e.currentTarget.querySelector('button')?.blur();}}},
                        h("button",{type:"button",className:"cc-output-control-button","aria-haspopup":"dialog","aria-expanded":outputFiltersOpen,
                            onClick:e=>{if(outputFilterPinned)closeFilterByClick(e);else{setOutputFilterPinned(true);setOutputFilterSuppressed(false);}}},
                            h(PromptIcon,{name:"sliders",size:15}),h("span",null,"筛选"),active?h("span",{className:"cc-output-count-bubble"},active):null,h(PromptIcon,{name:"chevronDown",size:13})),
                        outputFiltersOpen?h("div",{className:"cc-output-filter-flyout",role:"dialog","aria-label":"输出筛选"},renderOutputFilters()):null),
                    h("div",{className:"cc-output-sort-field"},h(PromptIcon,{name:"sort",size:15}),h(SelectMenu,{theme,label:"输出排序",value:outputSort,onChange:setOutputSort,minWidth:0,options:[{value:"newest",label:"最新优先"},{value:"oldest",label:"最早优先"},{value:"name",label:"文件名"},{value:"size",label:"尺寸大优先"}]})))),
            h("div",{className:"cc-output-results","data-cc-guide":"output-results"},
                rows.length?(outputView==='masonry'?h(OutputMasonry,{items:visible,renderCard:card}):h("div",{className:"cc-output-grid"},...visible.map(card))):h("div",{className:"cc-output-empty"},h(PromptIcon,{name:"image",size:28}),h("strong",null,outputLoading?"正在读取输出…":"没有符合条件的图片"),!outputLoading&&active?h("button",{type:"button",style:S.btn2,onClick:()=>setOutputFilter(emptyOutputFilter())},"清除筛选"):null)),
            rows.length>outputVisible?h("div",{ref:outputLoadMoreRef,className:"cc-output-load-sentinel",role:"status","aria-live":"polite"},"继续向下滚动将自动加载更多 · "+visible.length+" / "+rows.length):null);
    }

    




	// ==================== 组装 ====================
	return h("div", { ref: rootRef, className: "dsh-comfy-ui",
        // A 线二级页（历史 / 模型库）：S.wrap 的 padding 底部留了 48px，
        // 那是给独立界面「内容到面板底之间留呼吸」用的；二级页要顶到底，清零。
        style: Object.assign({}, S.wrap, theme, (props && props.page) ? { paddingBottom: 0 } : null) },
        h("style", null, UI_CSS),
        // 固定的全局工具栏与页面导航，同属一个 sticky 容器。
        h("div",{ref:stickyShellRef,className:"cc-sticky-shell"},
		// 嵌入模式（props.page 有值）下这排整个隐藏：外层已经有 tab 条和二级页返回条，
		// 再叠一条 A 线自己的标题栏 + 关闭/模型库/释放显存/原界面/连接设置/教程 是重复的。
		// 连接设置在外层生成页有入口；其余动作在 A 线独立界面里仍然存在。
		(props && props.page) ? null : h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
			h("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", minWidth: 0 } },
				h("strong", { style: { fontSize: "15px" } }, "ComfyUI 绘图台"),
				status, renderTaskSummary()),
			h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 } },
				comfyUpdate?.available?h("button",{type:"button",className:"cc-update-btn",title:"ComfyUI 有新版本可用",onClick:()=>{setUpdateError("");setUpdateOpen(true);}},"可更新"):null,
				h("button", {type:"button", "data-cc-guide":"connection-action",
                    style:Object.assign({}, S.btn2, {display:"inline-flex",alignItems:"center",gap:7,fontWeight:700}),
                    disabled:starting || online === null, onClick:connectionAction,
                    title:online ? "完全关闭 ComfyUI：终止生成与排队任务、结束进程并释放模型显存" : "尝试启动并连接本机 ComfyUI"},
                    h(OfflineComfyMark, {size:15}),
                    starting ? "处理中…" : online ? "关闭 ComfyUI" : "连接 ComfyUI"),
                h("button", {type:"button",style:Object.assign({},S.btn2,{display:"inline-flex",alignItems:"center",gap:6}),
                    onClick:()=>openModelLibrary(),"aria-label":"打开模型库","data-cc-tooltip":"打开模型库"},
                    h(PromptIcon,{name:"folder",size:14})," 模型库"),
				online ? h("button", {
					style: S.btn2, title: "让 ComfyUI 卸载模型释放显存，进程保留",
					onClick: async () => {
						setMsg("释放显存中…");
						try {
							const r = await jpost(EXPANDER + "/comfy/unload", {}, 40000);
							setMsg(r && r.ok ? "已释放显存" : "失败：" + ((r && r.message) || "?"));
						} catch (e) { setMsg("失败：" + errText(e)); }
					},
				}, "释放显存") : null,
				browserFallback ? h("a", { href: browserFallback, target: "_blank", rel: "noopener noreferrer", style: { ...S.btn2, border: "1px solid var(--cc-accent)", background: "var(--cc-accent-bg)", color: "var(--cc-accent-text)", textDecoration: "none" }, title: "浏览器未能自动打开，点击这里打开 ComfyUI 网页", onClick: () => setBrowserFallback("") }, "打开 ComfyUI 网页") : null,
				h("button", { style: S.btn2,
					onClick: () => window.open("http://127.0.0.1:" + (settingsInfo?.comfyPort || COMFY_PORT), "_blank") }, "原界面"),
				h("button", { style: S.btn2, "data-cc-guide":"connection-settings", "aria-haspopup": "dialog", onClick: () => {
                    setShowConn(true); setGuide(null); setGuideMenu(false); setConnNotice("");
                } }, "连接设置"),
				h("button", { style: S.btn2, "aria-expanded": guideMenu,
                    "aria-haspopup": "menu", onClick: (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setGuideMenuPos({ top: Math.max(12, Math.min(rect.bottom + 6,
                            (typeof window !== "undefined" ? window.innerHeight : 900) - 170)),
                            right: Math.max(12, (typeof window !== "undefined" ? window.innerWidth : 1200) - rect.right) });
                        setGuideMenu((v) => !v); setShowConn(false); setGuide(null);
                    } }, "教程 ▾"))),
		// 标签页
		(props && props.page) ? null : h("div", {"data-cc-guide":"workbench-tabs", role:"tablist", "aria-label":"绘图页面", style: { display: "flex", gap: "2px", borderBottom: "1px solid var(--cc-border)",flexWrap:"wrap" } },
			CONSOLE_PAGES.map(([k, label]) =>
				h("button", {type:"button", className:"cc-tab",role:"tab", "aria-selected":tab===k,
					key: k, onClick: () => switchTab(k),
					style: Object.assign({}, S.tab, tab === k ? S.tabOn : S.tabOff),
				}, label))),

        ),

        // 独立的浮动菜单，不插入绘图台的布局流。
        showLaunch ? h(OverlayModal,{title:"连接 ComfyUI",theme,width:520,onClose:()=>setShowLaunch(false)},
            launchError?h("div",{role:"alert",style:S.bad},launchError):null,
            !launchInfo && !launchError?h("span",{role:"status",style:S.dim},"正在检查启动设置…"):null,
            (launchInfo?.running || online===true)?h("span",{style:S.dim},"ComfyUI 已运行，将复用现有服务，不改变已有终端或网页。"):
                launchInfo?.settings?.configured && launchInfo.settings.launchModes?.background===false?
                    h("div",{style:S.warn},"此启动文件无法可靠适配后台模式。浏览器模式保留原脚本行为，可能额外打开终端或网页。",h("br"),launchInfo.settings.launchModes.reason):null,
            h("button",{type:"button",style:S.btn,disabled:!launchInfo || starting,
                onClick:()=>connectionAction("browser")},"启动 ComfyUI 并在浏览器打开"),
            h("button",{type:"button",style:S.btn2,
                disabled:!launchInfo || starting || (!launchInfo.running && online!==true && launchInfo.settings?.configured && launchInfo.settings.launchModes?.background===false),
                onClick:()=>connectionAction("background")},"在后台运行 ComfyUI"),
            h("small",{style:S.dim},"浏览器模式直接运行原启动文件（会打开终端，可能由脚本自行打开网页）；后台模式隐藏终端、不打开网页。"),
            launchError?h("button",{type:"button",style:S.btn2,onClick:()=>{setShowLaunch(false);setShowConn(true);}},"连接设置"):null) : null,
        autocomplete.render(),
        guideMenu ? floating(h("div", { className: "dsh-comfy-floating", style: Object.assign({}, theme, { position: "fixed", inset: 0,
            zIndex: 2147480000, background: "transparent" }),
            onMouseDown: () => setGuideMenu(false) },
            h("div", { role: "menu", "aria-label": "教程列表",
                onMouseDown: (e) => e.stopPropagation(),
                style: { position: "absolute", top: guideMenuPos.top, right: guideMenuPos.right,
                    maxHeight: "calc(100dvh - 24px)", overflowY: "auto",
                    width: "min(340px, calc(100vw - 24px))", padding: "12px",
                    boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "8px",
                    background: "var(--cc-surface)", color: "var(--cc-text)",
                    border: "1px solid var(--cc-border)", borderRadius: "10px",
                    boxShadow: "0 12px 36px rgba(0,0,0,.4)" } },
                h("strong", { style: { fontSize: "13px", marginBottom: 3 } }, "教程 · 可重复观看"),
                ...TUTORIAL_GROUPS.map(group => h("section", {key:group.key,"data-tutorial-group":group.key,style:{display:"flex",flexDirection:"column",gap:"4px",paddingTop:"4px"}},
                    h("strong", {style:{fontSize:"11px",color:"var(--cc-muted)",padding:"3px 4px"}}, group.label),
                    group.items.length?group.items.map(key=>h("button",{role:"menuitem",key,style:Object.assign({},S.btn2,{textAlign:"left",padding:"8px 10px"}),onClick:()=>openGuide(key)},TUTORIALS[key].name))
                        :h("span",{style:{fontSize:"11px",color:"var(--cc-muted)",padding:"3px 4px 6px"}},group.empty||"教程稍后提供")))))) : null,

        guide ? h(SpotlightTutorial, {guide, stepIndex:guideStep, theme, rootRef,
            onBack:() => moveGuide(guideStep - 1),
            onNext:() => guideStep + 1 >= TUTORIALS[guide].steps.length ? finishGuide() : moveGuide(guideStep + 1),
            onSkip:finishGuide}) : null,

        errorLogOpen?h(ErrorLogModal,{logs:errorLogs,theme,onClose:()=>{setErrorLogOpen(false);setErrorLogs(readClientErrors());}}):null,
        updateOpen?h(ComfyUpdateModal,{info:comfyUpdate,busy:updateBusy,error:updateError,theme,
            onClose:()=>{if(!updateBusy)setUpdateOpen(false);},
            onUpdate:async()=>{
                if(taskOrder().length){setUpdateError("还有任务在队列中，请等待生成完成后再更新。");return;}
                setUpdateBusy(true);setUpdateError("");
                try{
                    const r=await jpost(EXPANDER+"/comfy/update",{},900000);
                    setComfyUpdate(cur=>({...cur,current:r.current||cur?.current,latest:r.latest||cur?.latest,available:false,busy:false}));
                    setUpdateOpen(false);setMsg(r.message||"ComfyUI 已更新");
                }catch(e){setUpdateError(errText(e));}
                finally{setUpdateBusy(false);}
            }}):null,
        showModelGuide?h(ModelTypeGuide,{theme,onClose:()=>setShowModelGuide(false)}):null,
        postOpen?h(PostControlsModal,{value:postControls,onChange:setPostControls,theme,onClose:()=>setPostOpen(false),upscalers,samplers,schedulers}):null,
        renderGenerationControls(),
        renderModelLibrary(),
        previewOutput?h(OutputPreviewPicker,{item:previewOutput,theme,onClose:()=>setPreviewOutput(null),onSaved:(target,saved)=>{
            refreshModelDockAssets();
            // Do not leave the selected model's cover/preview editor button stale.
            if(target?.kind===modelLibraryKind && target?.name===modelLibraryFocus?.name &&
               Number(target?.root_id)===Number(modelLibraryFocus?.root_id)){
                setModelLibraryDetail(cur=>cur?{...cur,previews:saved.previews||[],preview:saved.previews?.[0]||null}:cur);
            }
            setMsg('已加入模型预览图');}}):null,
        previewEditor?h(ModelPreviewEditor,{key:JSON.stringify([previewEditor.kind,previewEditor.name,previewEditor.root_id]),model:previewEditor,theme,onClose:()=>setPreviewEditor(null),onChanged:r=>{refreshModelDockAssets();if(previewEditor.request===modelDetailRequestRef.current)setModelLibraryDetail(cur=>cur?{...cur,preview:r.preview,previews:r.previews}:cur);}}):null,
        outputDetail ? (()=>{const nav=outputDetailNavigation();return h(OutputInspector,{item:outputDetail,theme,onStage:setOutputDetail,onClose:()=>setOutputDetail(null),
            canPrev:!!nav.prev,canNext:!!nav.next,onPrev:()=>nav.prev&&openOutputDetail(nav.prev,outputDetailScope),onNext:()=>nav.next&&openOutputDetail(nav.next,outputDetailScope)},
            renderOutputDetailInfo(outputDetail));})() : null,

        taskDetail ? h(OverlayModal,{title:"生成任务 · "+taskStatusLabel(taskDetail),theme,width:760,onClose:()=>setTaskDetail(null)},
            h("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},h("span",{style:S.dim},"Prompt ID："+(taskDetail.pid||"提交中")),taskDetail.queuePosition?h("span",{style:S.dim},"队列位置："+taskDetail.queuePosition):null,taskDetail.params?.w?h("span",{style:S.dim},taskDetail.params.w+"×"+taskDetail.params.h+" · "+taskDetail.params.steps+" 步 · CFG "+taskDetail.params.cfg):null),
            taskDetail.status==='running'?(taskDetail.progressMax?h("div",{style:{display:"flex",alignItems:"center",gap:8}},h("div",{style:{height:5,flex:1,borderRadius:99,background:"var(--cc-border)",overflow:"hidden"}},h("div",{style:{height:"100%",width:Math.max(0,Math.min(100,taskDetail.progressValue/taskDetail.progressMax*100))+"%",background:"var(--cc-accent)"}})),h("span",{style:S.dim},taskDetail.progressValue+" / "+taskDetail.progressMax)):h("div",{className:"cc-progress-indeterminate"})):null,
            taskDetail.params?.pos!==undefined?h("label",{style:S.field},h("span",{style:S.label},"正向提示词"),h("textarea",{readOnly:true,style:{...S.ta,minHeight:100},value:taskDetail.params.pos||""})):null,
            taskDetail.params?.neg!==undefined?h("label",{style:S.field},h("span",{style:S.label},"负向提示词"),h("textarea",{readOnly:true,style:{...S.ta,minHeight:75},value:taskDetail.params.neg||""})):null,
            taskDetail.params?h("div",{style:S.dim},"底模："+(taskDetail.params.ckpt||"?")+" · Seed："+(taskDetail.params.usedSeed??"?")+" · "+(taskDetail.params.saveOutput?("保存到 "+taskDetail.params.savePath):"仅 Temp 预览")):null,
            taskDetail.status==='save-error'?h("button",{type:"button",style:S.btn,onClick:async()=>{const ok=await PBG.retrySave(taskDetail.pid);setTaskDetail(null);setMsg(ok?"图片已重新保存":"重试保存失败；请检查 Temp 文件和保存目录");}},"重试保存（无需重新生成）"):null,
            ['running','queued','submitting'].includes(taskDetail.status)?h("div",{style:{display:"flex",justifyContent:"flex-end"}},h("button",{type:"button",style:S.btn2,onClick:async()=>{await PBG.cancel(taskDetail.pid||taskDetail.localId);setTaskDetail(null);}},"取消任务")):null) : null,



        showConn ? h(OverlayModal, { title: "ComfyUI 连接与启动设置",
            onClose: () => setShowConn(false), width: 620, theme },
            h("span", { style: S.dim }, "请先在本地安装 ComfyUI。设置只影响本机连接，不会下载或安装 ComfyUI。"),
            h("label", { style: Object.assign({}, S.field, { minWidth: 0 }) },
                h("span", { style: S.label }, "ComfyUI 启动文件路径（可留空直接启动）"),
                h("input", { type: "text", "data-cc-guide":"start-script", style: Object.assign({}, S.inp, {
                        width: "100%", maxWidth: "100%", boxSizing: "border-box", minWidth: 0,
                        padding: "8px 10px" }),
                    value: startScript, onChange: (e) => changeStartScript(e.target.value),
                    placeholder: "D:\\ComfyUI\\ComfyUI_Windows_portable\\run_nvidia_gpu.bat" })),
            h("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" } },
                h("label", { style: S.field }, h("span", { style: S.label }, "ComfyUI 端口"),
                    h("input", { type: "number", min: 1, max: 65535, style: S.inp,
                        value: comfyPortInput, onChange: (e) => {editConnectionDraft("comfyPort");setComfyPortInput(e.target.value);} })),
                h("span", { style: S.dim }, "sidecar：127.0.0.1:" + EXPANDER_PORT + " · " +
                    (settingsInfo?.sidecarOS === "nt" ? "Windows" : "Linux / WSL"))),
            settingsInfo?.launchers?.length ? h("label",{style:{...S.field,minWidth:0}},
                h("span",{style:S.label},"已发现的启动文件"),
                h(SelectMenu,{theme,label:"已发现的启动文件",value:startScript,minWidth:230,
                    options:settingsInfo.launchers.filter(item=>item.compatible).map(item=>({value:item.path,label:item.backend+" · "+item.name})),
                    onChange:changeStartScript})) : null,
            h("details",{className:"cc-details",style:{fontSize:"12px"},open:!!settingsInfo?.launcherSelectionRequired},
                h("summary",{className:"cc-summary"},"安装位置与 Python"),
                h("div",{style:{display:"flex",flexWrap:"wrap",gap:"10px",paddingTop:"10px"}},
                    ...[["comfyRoot","ComfyUI 安装目录"],["comfyPythonExe","ComfyUI Python（可留空自动发现）"]].map(([key,label])=>
                        h("label",{key,style:{...S.field,flex:"1 1 230px",minWidth:0}},h("span",{style:S.label},label),
                            h("input",{type:"text",style:{...S.inp,width:"100%",boxSizing:"border-box"},value:installConfig[key],onChange:e=>{editConnectionDraft(key);setInstallConfig(cur=>({...cur,[key]:e.target.value}));}})))),
                h("p",{style:S.dim},"支持便携版和源码目录中的 .venv / venv / env。直接启动使用所选 Python；脚本启动保留脚本指定的解释器及硬件参数。"),
                h("div",{style:{...S.dim,overflowWrap:"anywhere"}},"布局："+(settingsInfo?.comfyLayout || "未发现")+" · ComfyUI Python："+(settingsInfo?.comfyPython || "未发现")+" · "+(settingsInfo?.comfyPythonSource || "")),
                h("div",{style:{...S.dim,overflowWrap:"anywhere"}},"Sidecar Python："+(settingsInfo?.sidecarPython || "未知"))),
            h("details", { className: "cc-details", style: {fontSize:"12px"}, open: !!settingsInfo?.pathErrors?.length },
                h("summary", { className:"cc-summary" }, "输出、临时目录与额外模型路径"),
                h("div", {style:{display:"flex",flexWrap:"wrap",gap:"10px",paddingTop:"10px"}},
                    ...[["outputDirectory","输出目录"],["tempDirectory","临时目录的父目录"]].map(([key,label]) =>
                        h("label",{key,style:{...S.field,flex:"1 1 230px",minWidth:0}},
                            h("span",{style:S.label},label),
                            h("input",{type:"text",style:{...S.inp,width:"100%",boxSizing:"border-box"},
                                value:pathConfig[key] || "",placeholder:"留空：读取启动参数或默认目录",
                                onChange:e=>{editConnectionDraft(key);setPathConfig(cur=>({...cur,[key]:e.target.value}));}})))),
                h("label",{style:{...S.field,minWidth:0,marginTop:"8px"}},
                    h("span",{style:S.label},"额外模型 YAML 配置（绝对路径，每行一个）"),
                    h("textarea",{rows:2,style:{...S.inp,width:"100%",height:"auto",boxSizing:"border-box",resize:"vertical"},
                        value:(pathConfig.extraModelPathsConfig || []).join("\n"),
                        onChange:e=>{editConnectionDraft("extraModelPathsConfig");setPathConfig(cur=>({...cur,extraModelPathsConfig:e.target.value.split("\n")}));}})),
                h("p",{style:S.dim},"目录需已存在。临时图片使用父目录下的 temp 子目录。留空遵循启动参数；额外 YAML 与启动脚本中的配置共同加载。")),
            h("details",{className:"cc-details",style:{fontSize:"12px"},open:!!settingsInfo?.pathErrors?.length},
                h("summary",{className:"cc-summary"},"已保存路径与诊断"),
                h("div",{style:{display:"grid",gridTemplateColumns:"70px minmax(0,1fr)",gap:"6px 8px",paddingTop:"10px",overflowWrap:"anywhere"}},
                    h("span",{style:S.label},"根目录"),h("span",null,(settingsInfo?.comfyRoot || "未发现")+" · "+(settingsInfo?.comfyRootSource || "")),
                    ...Object.entries(settingsInfo?.resolvedPaths || {}).flatMap(([name,item])=>[
                        h("span",{key:name+"-label",style:S.label},name === "output" ? "输出" : "临时"),
                        h("span",{key:name,style:item.error?S.bad:{}},(item.path || "未解析")+" · "+item.source+(item.error?" · "+item.error:""))]),
                    ...(settingsInfo?.modelConfigs || []).flatMap((item,index)=>[
                        h("span",{key:"yaml-label"+index,style:S.label},"模型 YAML"),
                        h("span",{key:"yaml"+index,style:item.error?S.bad:{}},item.path+" · "+item.source+(item.error?" · "+item.error:""))])),
                settingsInfo?.modelPaths?.length ? h("div",{style:{maxHeight:"160px",overflowY:"auto",paddingTop:"8px"}},
                    ...settingsInfo.modelPaths.map((item,index)=>h("div",{key:index,style:{overflowWrap:"anywhere",padding:"3px 0"}},
                        item.kind+" · "+item.path+(item.isDefault?" · 优先":"")+(item.exists?"":" · 不存在")))) : null,
                ...(settingsInfo?.pathErrors || []).map((text,index)=>h("p",{key:"error"+index,style:{...S.dim,...S.bad}},text)),
                ...(settingsInfo?.pathWarnings || []).map((text,index)=>h("p",{key:"warning"+index,style:S.dim},text)),
                h("p",{style:S.dim},"以上是已保存配置的解析结果，未探测外部已运行进程的启动参数。保存后更新。")),
            h(CompatibilityCheck,{S}),
            h("details", { className: "cc-details", style: {fontSize: "12px"} },
                h("summary", { className: "cc-summary" }, "高级：sidecar 端口"),
                h("div", { style: { display: "flex", gap: "8px", alignItems: "flex-end",
                    flexWrap: "wrap", paddingTop: "10px" } },
                    h("label", { style: S.field }, h("span", { style: S.label }, "sidecar 端口"),
                        h("input", { type: "number", min: 1, max: 65535, style: S.inp,
                            value: sidecarPortInput, onChange: (e) => setSidecarPortInput(e.target.value) })),
                    h("button", { style: S.btn2, onClick: () => {
                        const port = validPort(sidecarPortInput, 0);
                        if (!port || port === validPort(comfyPortInput, 0)) {
                            setConnNotice("sidecar 端口无效或与 ComfyUI 冲突"); return;
                        }
                        window.localStorage.setItem(PORTS_KEY, JSON.stringify({ sidecarPort: port, installedSidecarPort: INSTALLED_PORTS.sidecarPort, installedComfyPort: INSTALLED_PORTS.comfyPort, installedInstanceId: INSTALLED_INSTANCE_ID }));
                        window.location.reload();
                    } }, "应用端口并刷新")),
                h("p", { style: S.dim }, "此处只修改浏览器连接端口。须先同步修改 config.json 并重启 Sidecar；重新安装且端口变更后，旧浏览器端口记录会自动失效。")),
            h("span", { style: S.dim }, "启动脚本决定硬件参数；插件不会自动安装或更换 PyTorch / IPEX / ROCm。WSL 跨环境验证仍按兼容性计划进行。"),
            connNotice ? h("div", { role: "status", style: Object.assign({}, S.dim,
                /失败|无效|冲突|必须/.test(connNotice) ? S.bad : S.ok) }, connNotice) : null,
            h("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px",
                flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid rgba(127,127,127,.2)" } },
                h("button", { style: S.btn2, onClick: () => { setErrorLogOpen(true); setErrorLogs(readClientErrors()); setShowConn(false); } }, "错误日志"),
                h("button", { style: S.btn2, onClick: () => setShowConn(false) }, "取消"),
                h("button", { style: S.btn, "data-cc-guide":"save-connection-settings", disabled: saving || !settingsInfo, onClick: saveConnectionSettings },
                    saving ? "保存中…" : "保存启动设置"))) : null,


        showCompletionSettings?h(OverlayModal,{title:'提示词自动补全',theme,width:460,onClose:()=>setShowCompletionSettings(false)},
            ...[['enabled','启用中文 / 英文候选',dictionaryOptions.enabled!==false],['underscores','保留下划线',!!dictionaryOptions.underscores]].map(([key,label,value])=>h('label',{key,className:'cc-dict-check'},h('input',{type:'checkbox',checked:value,onChange:e=>{
                const previous=USER.autocompleteOptions;USER.autocompleteOptions={...dictionaryOptions,[key]:e.target.checked};
                if(saveUser())setDictionaryOptions({...USER.autocompleteOptions});else{USER.autocompleteOptions=previous;setMsg('补全设置保存失败');}
            }}),label)),
            dictionaryOptions.category?h('button',{type:'button',style:S.btn2,onClick:()=>{const previous=USER.autocompleteOptions;USER.autocompleteOptions={...dictionaryOptions,category:''};if(saveUser())setDictionaryOptions({...USER.autocompleteOptions});else USER.autocompleteOptions=previous;}},'清除旧分类限制：'+dictionaryOptions.category):null):null,
        tab === "output" ? renderOutputPage() : null,
        tab === "online" ? h(OnlineModelsPanel,{theme,onMessage:setMsg,onDownloaded:job=>{
            setMsg("模型下载完成："+job.filename);refreshModelDockAssets();
            if(online===true && ['checkpoint','diffusion','lora','clip','vae'].includes(job.kind))refreshModelKind(job.kind);
        }}) : null,

		msg ? h("div", { style: Object.assign({}, S.dim, /失败|连不上|离线|没认出来/.test(msg) ? S.bad : {}) }, msg) : null);
}
/* ===== BG / PBG 说明（0.7.127 修正）=====
A 线组件（PreviewConsole）直接用 PBG 的后台任务管理器；
早期在模块顶层把 PBG 成员挂到 app.js 的 const BG 上，但 preview_console 排在 app 之前，
BG 处于 TDZ，整段被 catch 吞掉 —— 已改为直接引用 PBG。 */
const PBG = {
    jobs: [], listeners: new Set(), timer: null, polling: false, generation: 0,
    emit(){this.listeners.forEach(f=>{try{f();}catch{}})},
    subscribe(f){this.listeners.add(f);return()=>this.listeners.delete(f)},
    tasksSnapshot(){return this.jobs.map(j=>({...j,params:j.params?{...j.params}:j.params}));},
    progress(pid,value,max){if(!pid)return;const v=Number(value),m=Number(max);if(Number.isFinite(v)&&Number.isFinite(m)&&m>0)this.setJob(pid,{progressValue:v,progressMax:m});},
    snapshot(){
        const active=this.jobs.find(j=>j.status==='running') || this.jobs.find(j=>['queued','submitting'].includes(j.status));
        const latest=active || this.jobs[0]; return latest?{...latest}:null;
    },
    setJob(key,patch){const i=this.jobs.findIndex(j=>j.localId===key||j.pid===key);if(i<0)return;
        this.jobs[i]={...this.jobs[i],...patch};this.jobs.sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));cacheJobs(this.jobs);this.emit();},
    clear(){
        this.jobs=this.jobs.filter(j=>['running','queued','submitting'].includes(j.status));
        if(!this.jobs.length){cacheJobs([]);this.stopWatch();}
        this.emit();return true;
    },
    shutdown(){
        this.stopWatch();cacheJobs([]);
        this.jobs=this.jobs.map(j=>['running','queued','submitting'].includes(j.status)
            ? {...j,status:'cancelled',message:'ComfyUI 已关闭，任务已终止'}:j);
        this.emit();
    },
    stopWatch(){if(this.timer)clearInterval(this.timer);this.timer=null;this.polling=false;},
    async run(graph,params){
        const localId='local-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
        const job={localId,pid:null,submittedAt:Date.now(),startedAt:null,status:'submitting',message:'提交中…',
            queuePosition:null,image:null,imageInfo:null,error:null,params:{...params}};
        this.jobs.unshift(job);this.emit();
        try{
            const res=await jpost(COMFY+'/prompt',{prompt:graph,client_id:'dsh-comfyui-console'},30000);
            if(!res?.prompt_id)throw new Error('ComfyUI 未返回 prompt_id');
            this.setJob(localId,{pid:res.prompt_id,status:'queued',message:'已加入队列'});
            cacheJobs(this.jobs);
            this.startWatch();return true;
        }catch(e){this.setJob(localId,{status:'error',message:'提交失败：'+errText(e),error:errText(e)});return false;}
    },
    startWatch(){
        if(this.timer)return;this.timer=setInterval(()=>this.tick(),1200);this.tick();
    },
    async _complete(job,entry){
        if(job.params?.postEnabled)return this._completePost(job,entry);
        const completedAt=Date.now(),generationMs=generationDurationFromHistory(entry,job,completedAt);
        const outs=entry?.outputs||{};let img=null;
        for(const k of ['9',...Object.keys(outs).filter(k=>k!=='9')]){const imgs=outs[k]?.images;if(imgs?.length){img=imgs[0];break;}}
        if(!img){this.setJob(job.pid,{status:'error',message:'任务完成，但未找到输出图片'});return;}
        let url=viewUrl(img), saved=null;
        if(job.params?.saveOutput && job.params?.savePath){
            try{const r=await jpost(EXPANDER+'/outputs/save-temp',{image:img,folder:job.params.savePath,prefix:job.params.prefix||'dsh_comfy'},120000);saved=r.item||null;}
            catch(e){
                const failed={url,source:'temp',path:'',filename:img.filename,subfolder:img.subfolder||'',
                    width:Number(job.params?.outputW||job.params?.w)||0,height:Number(job.params?.outputH||job.params?.h)||0,
                    params:{...job.params,seed:job.params?.usedSeed??job.params?.seed},saved:false,promptId:job.pid,
                    saveFailed:true,imageInfo:img,generationMs};
                SESSION_OUTPUTS.add(failed);
                this.setJob(job.pid,{status:'save-error',message:'已生成，保存失败（可重试）：'+errText(e),
                    image:url,imageInfo:img,output:failed,error:errText(e)});return;
            }
        }
        if(saved?.path)url=savedOutputUrl(saved.path);
        const output={url,source:saved?.source||(img.type==='output'?'output':'temp'),path:saved?.path||'',
            filename:saved?.filename||img.filename,subfolder:img.subfolder||'',width:Number(job.params?.outputW||job.params?.w)||0,
            height:Number(job.params?.outputH||job.params?.h)||0,params:{...job.params,seed:job.params?.usedSeed??job.params?.seed},
            saved:!!(saved||img.type==='output'),savePath:saved?.path||'',promptId:job.pid,imageInfo:img,generationMs};
        SESSION_OUTPUTS.add(output);
        this.setJob(job.pid,{status:'done',message:'完成 ✓',completedAt,generationMs,image:url,imageInfo:img,output});
    },
    async _completePost(job,entry){
        if(this.jobs.find(j=>j.pid===job.pid)?.status==='cancelled')return;
        this.setJob(job.pid,{status:'saving',message:'正在整理生成后阶段图片…'});
        try{
            const r=await jpost(EXPANDER+'/post/complete',{prompt_id:job.pid,save:!!job.params.saveOutput,folder:job.params.savePath,prefix:job.params.prefix,mode:job.params.postControls?.save||'final'},120000);
            const convert=s=>({...s,url:s.path?savedOutputUrl(s.path):viewUrl(s.imageInfo),promptId:job.pid});
            const selected=convert(r.item),stages=(r.stages||[]).map(convert),generationMs=generationDurationFromHistory(entry,job,Date.now());
            const output={...selected,source:selected.path?'custom':'temp',saved:!!selected.path,session:true,groupId:r.groupId,stages,activeStage:selected.index,
                params:{...job.params,...selected.params,usedSeed:job.params.usedSeed},generationMs};
            SESSION_OUTPUTS.remove(job.pid);SESSION_OUTPUTS.add(output);
            this.setJob(job.pid,{status:r.failed?'error':'done',message:r.failed?'后处理失败，已保留完成阶段':'完成 ✓'+(selected.note?' · '+selected.note:''),image:output.url,imageInfo:output.imageInfo,output,generationMs,completedAt:Date.now()});
        }catch(e){this.setJob(job.pid,{status:job.params.saveOutput?'save-error':'error',message:'生成后结果读取 / 保存失败：'+errText(e),error:errText(e)});}
    },
    async retrySave(pid){
        const job=this.jobs.find(j=>j.pid===pid);
        if(job?.params?.postEnabled){this.setJob(pid,{status:'saving',message:'重新保存阶段图片…'});await this._completePost(job,null);return this.jobs.find(j=>j.pid===pid)?.status==='done';}
        if(!job?.imageInfo||!job.params?.saveOutput)return false;
        this.setJob(pid,{status:'saving',message:'正在重新保存已生成图片…'});
        try{
            const r=await jpost(EXPANDER+'/outputs/save-temp',{
                image:job.imageInfo,folder:job.params.savePath,prefix:job.params.prefix||'dsh_comfy'},120000);
            const saved=r.item;
            if(!saved?.path)throw new Error('没有返回保存路径');
            const output={...(job.output||{}),url:savedOutputUrl(saved.path),source:saved.source,
                path:saved.path,filename:saved.filename,saved:true,saveFailed:false,savePath:saved.path};
            SESSION_OUTPUTS.remove(pid);SESSION_OUTPUTS.add(output);
            this.setJob(pid,{status:'done',message:'重新保存成功 ✓',output,image:output.url,error:null});
            return true;
        }catch(e){this.setJob(pid,{status:'save-error',message:'重试保存失败：'+errText(e),error:errText(e)});return false;}
    },
    async tick(){
        if(this.polling)return;const active=this.jobs.filter(j=>['queued','running'].includes(j.status)&&j.pid);
        if(!active.length){this.stopWatch();cacheJobs([]);return;}
        this.polling=true;
        try{
            const q=await jget(COMFY+'/queue',10000);
            const running=(q.queue_running||[]).map(x=>x[1]);const pending=(q.queue_pending||[]).map(x=>x[1]);
            for(const job of active){
                if(running.includes(job.pid)){
                    const start=job.startedAt||Date.now();this.setJob(job.pid,{status:'running',startedAt:start,queuePosition:0,message:'正在生成…'});continue;
                }
                const qi=pending.indexOf(job.pid);
                if(qi>=0){this.setJob(job.pid,{status:'queued',queuePosition:qi+1,message:'排队中 · '+(qi+1)});continue;}
                try{
                    const hist=await jget(COMFY+'/history/'+encodeURIComponent(job.pid),10000);const entry=hist?.[job.pid];
                    if(entry){
                        const st=entry.status||{};
                        if(st.status_str==='error'){
                            let msg='ComfyUI 生成错误';for(const m of (st.messages||[])){if(m[0]==='execution_error'){const d=m[1]||{};msg=(d.exception_type||'错误')+(d.exception_message?'：'+d.exception_message:'');break;}}
                            if(job.params?.postEnabled){await this._completePost(job,entry);this.setJob(job.pid,{status:'error',message:msg,error:msg});}else this.setJob(job.pid,{status:'error',message:msg,error:msg});
                        }else await this._complete(job,entry);
                    }
                }catch(e){/* transient history failure */}
            }
            const remaining=this.jobs.filter(j=>['queued','running'].includes(j.status)&&j.pid);
            cacheJobs(remaining);
        }catch(e){/* keep tasks and retry */}
        finally{this.polling=false;this.emit();}
    },
    async adopt(){
        const cached=readCachedJobs();if(!cached.length)return false;
        try{
            const q=await jget(COMFY+'/queue',10000);
            const running=new Set((q.queue_running||[]).map(x=>x[1]));
            const pending=new Set((q.queue_pending||[]).map(x=>x[1]));
            let restored=0;
            for(const item of cached){
                if(this.jobs.some(j=>j.pid===item.pid))continue;
                let entry=null;
                if(!running.has(item.pid)&&!pending.has(item.pid)){
                    try{const history=await jget(COMFY+'/history/'+encodeURIComponent(item.pid),8000);entry=history?.[item.pid];}
                    catch{continue;} // network issue: retain snapshot for a later attempt
                    if(!entry)continue; // prompt was deleted/expired
                }
                const job={localId:'adopt-'+item.pid,pid:item.pid,submittedAt:item.submittedAt||Date.now(),
                    startedAt:item.startedAt||null,status:running.has(item.pid)?'running':'queued',
                    message:'已恢复任务及参数',params:item.params||{}};
                this.jobs.unshift(job);restored++;
                if(entry){
                    if(entry.status?.status_str==='error')this.setJob(job.pid,{status:'error',message:'恢复的任务已失败'});
                    else await this._complete(job,entry);
                }
            }
            cacheJobs(this.jobs);
            if(this.jobs.some(j=>['queued','running'].includes(j.status)))this.startWatch();
            this.emit();return restored>0;
        }catch{return false;}
    },
    async cancel(pid){
        const job=pid?this.jobs.find(j=>j.pid===pid||j.localId===pid):this.snapshot();
        if(!job||!['queued','running','submitting'].includes(job.status))return;
        if(!job.pid){this.setJob(job.localId,{status:'cancelled',message:'已取消'});return;}
        try{
            const q=await jget(COMFY+'/queue',10000);const running=(q.queue_running||[]).some(x=>x[1]===job.pid);const pending=(q.queue_pending||[]).some(x=>x[1]===job.pid);
            if(pending)await jpost(COMFY+'/queue',{delete:[job.pid]},10000);else if(running)await jpost(COMFY+'/interrupt',{},10000);
            this.setJob(job.pid,{status:'cancelled',message:'已取消'});this.emit();
        }catch(e){this.setJob(job.pid,{message:'取消失败：'+errText(e)});}
    },
};


/* ===== 移植块结束 ===== */

function Console() {
			const [tab, setTabRaw] = React.useState("gen");
	const rootRef = React.useRef(null);
	const [availH, setAvailH] = React.useState(0);
	/* GEN_TAB_HOOKS_FIXED：这三个 hook 原先写在 genTab() 内，只有停在生成页才执行；切到其它页 hook 数变少，React 抛 #300 → 整页白。已上移到 Console 作用域。 */
	const pRef = React.useRef(null);
	const [pW, setPW] = React.useState(0);   // 参数卡内网格宽度（决定参数几列）
			const [rW, setRW] = React.useState(0);   // 整个面板宽度（决定单列/两栏）
	React.useEffect(() => {
	const el = pRef.current;
	if (!el) return;
	const read = () => { try { setPW(el.clientWidth || 0); } catch (e) {} };
	read();
	try {
	if (typeof ResizeObserver === "function") {
	const ro = new ResizeObserver(read);
	ro.observe(el);
	return () => { try { ro.disconnect(); } catch (e) {} };
	}
	window.addEventListener("resize", read);
	return () => { try { window.removeEventListener("resize", read); } catch (e) {} };
	} catch (e) { return; }
	}, []);
	React.useEffect(() => {
	  const measure = () => {
	    try {
	      const el = rootRef.current;
	      if (!el || !el.getBoundingClientRect) return;
	      const r = el.getBoundingClientRect();
	      const vh = (typeof window !== "undefined" && window.innerHeight) ? window.innerHeight : 0;
	      if (!vh || !r) return;
	      const h = Math.max(360, Math.round(vh - (r.top || 0) - 18));
	      setAvailH(h);
			      setRW(Math.round(r.width || 0));
	    } catch (e) {}
	  };
	  measure();
	  try {
	    window.addEventListener("resize", measure);
	    const t = setTimeout(measure, 300);
	    return () => { try { window.removeEventListener("resize", measure); clearTimeout(t); } catch (e) {} };
	  } catch (e) { return; }
	}, []);
	// 切走生成页时清掉「已收尾」的出图（跑着的任务不清）。包一层，所有入口自动生效。
	const setTab = (k) => {
		if (tab === "gen" && k !== "gen" && BG.isFinished()) BG.clear();
		setTabRaw(k);
	};
	const [online, setOnline] = React.useState(null);
	const [conn, setConn] = React.useState(0);

	// 元数据
	const [ckpts, setCkpts] = React.useState([]);
	const [unets, setUnets] = React.useState([]);        // diffusion_models（Anima 分支的底模）
	const [loras, setLoras] = React.useState([]);
	const [vaes, setVaes] = React.useState([]);
	const [clips, setClips] = React.useState([]);
	const [samplers, setSamplers] = React.useState([]);
	const [schedulers, setSchedulers] = React.useState([]);
	const [clipTypes, setClipTypes] = React.useState([]);

	// 参数
	const L = USER.last || {};
	const [ckpt, setCkpt] = React.useState(L.ckpt || "");
	// 模型库（A 线弹窗）里点「使用」选中底模后，名字经模块级钩子回到这里。
	React.useEffect(() => {
		MODEL_PICKED_SINK = (name) => { if (name) setCkpt((cur) => (cur === name ? cur : name)); };
		return () => { MODEL_PICKED_SINK = null; };
	}, []);
	const [clip, setClip] = React.useState(L.clip || MODEL_DEFAULTS.clip);
	const [clipType, setClipType] = React.useState(L.clipType || MODEL_DEFAULTS.clipType);
	const [vae, setVae] = React.useState(L.vae || MODEL_DEFAULTS.vae);
	// 底模变了就按它的 base_type 自动适配文本编码器类型（照工作台那套 MODEL_PROFILES 走）。
	// 注意 MODEL_PROFILES.sdxl / sd2 这类条目本身没写 clipType，只有 family，所以再补一层家族映射。
	// 不自动切到 qwen_image：那一路会把底模来源切到 diffusion_models，而本机该目录常为空，
	// 自动切过去只会让底模下拉变空，得不偿失——Anima 仍由用户显式选。
	// 记录已按哪个底模适配过，避免 vaes/clips 列表变化时反复覆盖用户手改的选择。
	const adaptedCkptRef = React.useRef("");
	React.useEffect(() => {
		if (!ckpt) return;
		let dead = false;
		const FAMILY_CLIP_TYPE = {
			sdxl: "stable_diffusion", sd15: "stable_diffusion", sd2: "stable_diffusion", legacy: "stable_diffusion",
			flux: "flux", sd3: "sd3", anima: "qwen_image",
		};
		(async () => {
			try {
				const d = await jget(EXPANDER + "/models/detail?kind=checkpoint&name=" + encodeURIComponent(ckpt), 15000);
				if (dead) return;
				const key = profileKeyFromModelBase(d && d.base_type) || profileKeyFromModelName(ckpt);
				const p = key ? MODEL_PROFILES[key] : null;
				if (!p) return;
				const fam = p.family;
				// 同一个底模只适配一次：之后用户手改编码器/VAE 不被反复覆盖。
				if (adaptedCkptRef.current === ckpt) return;
				adaptedCkptRef.current = ckpt;
				const notes = [];
				const next = p.clipType || FAMILY_CLIP_TYPE[fam] || "";
				if (next && next !== "qwen_image") {
					setClipType((cur) => (cur === next ? cur : next));
					notes.push("类型 " + next);
				}
				// VAE：按家族线索从 vaes 里挑；checkpoint 系没有线索就走内置（清空）。
				const v = pickByHints(vaes, PROFILE_VAE_HINT[fam]);
				setVae((cur) => {
					if (v) return cur === v ? cur : v;
					return fam === "anima" ? cur : "";   // checkpoint 系用内置 VAE
				});
				if (v) notes.push("VAE " + v);
				// 编码器：anima 必须外挂 qwen 编码器；checkpoint 系清空走内置 CLIP。
				if (fam === "anima") {
					const c = pickByHints(clips, PROFILE_CLIP_HINT.anima);
					if (c) { setClip((cur) => (cur === c ? cur : c)); notes.push("编码器 " + c); }
				} else {
					setClip((cur) => (cur === "" ? cur : ""));
				}
				if (notes.length) {
					try { MSG("已按底模自动适配：" + (p.label || key) + " → " + notes.join("、") +
						(fam === "anima" ? "" : "（编码器与 VAE 走 checkpoint 内置）")); } catch (e) { /* ignore */ }
				}
			} catch (e) { /* 读不到元数据就保持现状，不猜 */ }
		})();
		return () => { dead = true; };
	}, [ckpt, vaes, clips]);
	const [selLoras, setSelLoras] = React.useState((L.loras && L.loras.length) ? L.loras : MODEL_DEFAULTS.loras);
	const [pos, setPos] = React.useState(L.pos || "");
	const [neg, setNeg] = React.useState(L.neg || "");
	/* 插入登记的订阅：卡片的蓝框靠它重渲染 */
	const [insVer, setInsVer] = React.useState(0);
	React.useEffect(() => INSERTED.sub(() => setInsVer((v) => v + 1)), []);
	/* 软锁巡检：受保护词被删掉不回填，只把卡标成「部分移除」——不跟用户抢键盘 */
	React.useEffect(() => {
		let dirty = false;
		const ps = tokSet(pos), ns = tokSet(neg);
		INSERTED.all().forEach((r) => {
			const miss = (r.posTokens || []).filter((t) => !ps.has(String(t).toLowerCase())).length
				+ (r.negTokens || []).filter((t) => !ns.has(String(t).toLowerCase())).length;
			const partial = miss > 0;
			if (!!r.partial !== partial) { r.partial = partial; dirty = true; }
		});
		if (dirty) { INSERTED.save(); INSERTED.emit(); }
	}, [pos, neg]);
	/** 解除一次插入：按记录撤词（共用的词留给别的卡）、撤 LoRA、撤锁、撤条件图 */
	function removeInserted(rec) {
		if (!rec) return;
		const ownerExcl = (t, box) => INSERTED.all().filter((r) => r !== rec && ((box === "neg" ? r.negTokens : r.posTokens) || []).some((x) => String(x).toLowerCase() === String(t).toLowerCase())).length;
		const cut = (text, tokens, box) => {
			const kill = new Set((tokens || []).map((x) => String(x).toLowerCase()).filter((t) => ownerExcl(t, box) === 0));
			if (!kill.size) return { text: text, n: 0 };
			const keep = tokList(text).filter((t) => !kill.has(t.toLowerCase()));
			return { text: keep.join(", "), n: kill.size };
		};
		const _p = cut(pos, rec.posTokens, "pos");
		const _n = cut(neg, rec.negTokens, "neg");
		setPos(_p.text);
		setNeg(_n.text);
		let loraN = 0;
		if (rec.loras && rec.loras.length) {
			const still = new Set();
			INSERTED.all().forEach((r) => { if (r !== rec) (r.loras || []).forEach((l) => still.add(String(l.name).toLowerCase())); });
			const drop = new Set(rec.loras.map((l) => String(l.name).toLowerCase()).filter((x) => !still.has(x)));
			if (drop.size) { loraN = drop.size; setSelLoras((cur) => (cur || []).filter((x) => !drop.has(String(x.name).toLowerCase()))); }
		}
		if (rec.kind === "char") lockCards = lockCards.filter((x) => String(x.id) !== String(rec.id));
		const hadCond = !!(rec.cond && COND.cardName === rec.name);
		if (hadCond) COND.clear();
		INSERTED.del(rec.id);
		setMsg("已解除「" + rec.name + "」· 撤回 " + (_p.n + _n.n) + " 条词" + (loraN ? " · 摘下 " + loraN + " 支 LoRA" : "") + (hadCond ? " · 条件图已解绑" : ""));
	}
	/** 全部清空：确认一次，解除所有插入 + 清干净所有会污染下一次出图的东西 */
	function doClearAll() {
		const n = INSERTED.all().length;
		if (n && typeof window !== "undefined" && !window.confirm("这会解除 " + n + " 张卡的插入，并清空提示词 / LoRA / 身份控制 / LLLite 条件图。继续？")) return;
		INSERTED.all().slice().forEach((r) => { delete INSERTED.map[String(r.id)]; });
		INSERTED.save();
		INSERTED.emit();
		setPos(""); setNeg(""); setSelLoras([]); lockCards = [];
		COND.clear(); COND.picks = {};
		setCardSel(""); setStyleSel(""); setInsMenu(""); setStyleMenu(""); setStyleSub("");
		try { BG.clear(); } catch (e) { }
		setMsg("已全部清空：提示词 / LoRA / 身份控制 / LLLite 条件图" + (n ? " · 解除 " + n + " 张卡" : ""));
	}
	const [w, setW] = React.useState(L.w || 896);
	const [hh, setHh] = React.useState(L.h || 1216);
	const [steps, setSteps] = React.useState(L.steps || 24);
	const [cfg, setCfg] = React.useState(L.cfg || 6.0);
	const [sampler, setSampler] = React.useState(L.sampler || "euler");
	const [scheduler, setScheduler] = React.useState(L.scheduler || "normal");
	const [prefix, setPrefix] = React.useState(L.prefix || "dsh_comfy");
	// 视角三档 + 种子（1.0 功能）
	const [viewKey, setViewKey] = React.useState("");   // 默认不高亮；只有显式点过某一档才亮
	const [seed, setSeed] = React.useState(L.seed || 0);
	const [lockSeed, setLockSeed] = React.useState(!!L.lockSeed);
	// Seed 变化（工作台那套）：lock / increment / decrement / random。
	// lockSeed 只留着兼容旧 USER.last，新逻辑一律看 seedMode。
	const [seedMode, setSeedMode] = React.useState(L.seedMode || (L.lockSeed ? "lock" : "random"));
	// 尺寸倍率（工作台那套 cc-size-row 的滑块）：只乘最终出图宽高，不改 base 宽高本身。
	// imageSizeScaled 会按 8 对齐并夹到 64~8192，所以 896×1152 配 1.5 得 1344×1728。
	// 必须声明在 saveLast / doGen 之前：那两处都在下面引用它，放后面就是 TDZ。
	const [sizeMultiplier, setSizeMultiplier] = React.useState(Number(L.sizeMultiplier) > 0 ? Number(L.sizeMultiplier) : 1);
	// 出图后放大（0.6.0 从 0.1.0 移植）
	const [upscale, setUpscale] = React.useState(!!L.upscale);
	const [upscaleModel, setUpscaleModel] = React.useState(L.upscaleModel || "");
	const [upscaleFactor, setUpscaleFactor] = React.useState(Number(L.upscaleFactor) || 4);
	const [upscalers, setUpscalers] = React.useState([]);
	// 主题：跟随系统 / 浅色 / 深色 / 纯白 / 纯黑 / 自定义（存进 USER.last，下次打开还是这个）
	const [theme, setTheme] = React.useState(Object.assign({}, THEME_DEFAULTS, L.theme || {}));
	// auto 模式下系统换主题要能跟着变，用一个 tick 触发重渲染
	// 系统是不是深色。resolveTheme 在 auto 模式下直接吃这个值，
	// 系统换主题时它一变，组件就重渲染（原来是只写不读的 themeTick）。
	const [systemDark, setSystemDark] = React.useState(systemPrefersDark);
	React.useEffect(() => {
		let mq = null;
		try { mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch (e) { mq = null; }
		if (!mq) return undefined;
		const on = (ev) => setSystemDark(!!(ev && ev.matches));
		try { setSystemDark(!!mq.matches); } catch (e) { /* ignore */ }
		try { mq.addEventListener('change', on); } catch (e) { try { mq.addListener(on); } catch (e2) { /* ignore */ } }
		return () => {
			try { mq.removeEventListener('change', on); } catch (e) { try { mq.removeListener(on); } catch (e2) { /* ignore */ } }
		};
	}, []);
	// 每次改动都把这一套选择写回 localStorage，下次打开就是上次用的（2026-10-18 用户要求）
	React.useEffect(() => {
	  saveLast({ ckpt, clip, clipType, vae, loras: selLoras, w, h: hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, sizeMultiplier, seedMode });
	}, [ckpt, clip, clipType, vae, selLoras, w, hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, sizeMultiplier, seedMode]);

	const [msg, setMsg] = React.useState("");
	// 插件版本探针：loaded = 本进程装载的版本，disk = 磁盘版本；不一致=包换了但没重启
	const [ver, setVer] = React.useState(null);
	MSG_SINK = setMsg;   // 让模块级 MSG() 走同一个提示位
	REPAINT_SINK = () => setRegTick((t) => t + 1);   // 模块级同步完让面板重画
	// 面板挂载后自动拉一次磁盘卡（0.7.47）；失败/空由 syncCardsFromDisk 自己重试
	React.useEffect(() => { const tm = setTimeout(() => { try { syncAllDirs({ quiet: true }); } catch (e) { } }, 1200); return () => clearTimeout(tm); }, []);
	const [cnIn, setCnIn] = React.useState("");
	const [cnResult, setCnResult] = React.useState(null);
	const [activeCat, setActiveCat] = React.useState(Object.keys(LIB)[0]);
	const [foldedCats, setFoldedCats] = React.useState({});
	const [dragOver, setDragOver] = React.useState("");
	const [dragFrom, setDragFrom] = React.useState("");
	const [cardEdit, setCardEdit] = React.useState(null);
	const [cardChk, setCardChk] = React.useState(null);
	/** 0.7.47：粘贴 JSON 兜底（Electron 里文件对话框 / 拖拽都可能不给文件） */
	const [pasteOpen, setPasteOpen] = React.useState(false);
	const [pasteText, setPasteText] = React.useState("");
	const [regTick, setRegTick] = React.useState(0);
	const [styChk, setStyChk] = React.useState(null);
	React.useEffect(() => REG.subscribe(() => setRegTick((t) => t + 1)), []);
	const [cardSel, setCardSel] = React.useState("");
	const [condVer, setCondVer] = React.useState(0);
	const [llliteT, setLllliteT] = React.useState({ assets: {}, weights: {} });
	React.useEffect(() => COND.subscribe(() => setCondVer((v) => v + 1)), []);
	/** 角色卡「插入」的二级菜单：存当前打开菜单的卡 id */
	const [insMenu, setInsMenu] = React.useState("");
	/** 风格卡：选中 / 编辑中的草稿 / 插入二级菜单 */
	const [styleSel, setStyleSel] = React.useState("");
	const [styleEdit, setStyleEdit] = React.useState(null);
		/** 风格卡插入菜单的第二级："" | "direct"（直插） | "stack"（叠插） */
	const [styleSub, setStyleSub] = React.useState("");
	const [styleMenu, setStyleMenu] = React.useState("");
	/** 编辑界面「导出 ▾」二级菜单：存 cardType:id，空 = 关闭 */
	/** 导入报告面板：{ f: 原始文件, d: 侧车返回 } —— 面板展示明细，缺件重试要重传同一个 File */
	const [impRep, setImpRep] = React.useState(null);
	
	const [tagAt, setTagAt] = React.useState("");
	const [tagDraft, setTagDraft] = React.useState("");
	const [tagNote, setTagNote] = React.useState("");
	const [dictQ, setDictQ] = React.useState("");
	/** 词库插入目标：正向 or 负面 */
	const [target, setTarget] = React.useState("pos");
	const [presetName, setPresetName] = React.useState("");
	const [presetCat, setPresetCat] = React.useState("默认");
	/** ComfyUI 工作流导入 */
	const [wfText, setWfText] = React.useState("");
	const [wfResult, setWfResult] = React.useState(null);

	// 后台任务订阅
	const [job, setJob] = React.useState(BG.snapshot());
		React.useEffect(() => BG.subscribe(() => setJob(BG.snapshot())), []);

	// ---- 出图保存位置 ----
	const [saveDir, setSaveDir] = React.useState("");
	const [saveDraft, setSaveDraft] = React.useState("");
	React.useEffect(() => {
		fetch(EXPANDER + "/config/save", { headers: Object.assign({}, CONSOLE_HEADERS) }).then((r) => r.json()).then((d) => {
			if (d && d.ok) { setSaveDir(d.dir || ""); setSaveDraft(d.dir || ""); }
		}).catch(() => { /* sidecar 没起来就算了 */ });
	}, []);
	const applySaveDir = () => {
		jpost(EXPANDER + "/config/save", { dir: saveDraft }, 15000).then((r) => {
			if (r && r.ok) { setSaveDir(r.dir || ""); setSaveDraft(r.dir || ""); setMsg("保存位置已设为：" + r.dir); }
			else setMsg("设置失败：" + ((r && r.message) || "sidecar 没响应"));
		}).catch(() => setMsg("连不上本地 sidecar（8199）"));
	};
	const saveCurrent = (silent) => {
		const u = job && job.image;
		if (!u) { if (!silent) setMsg("还没有出图"); return; }
		const mm = u.match(/[?&]filename=([^&]*)/);
		const fn = mm ? decodeURIComponent(mm[1]) : "";
		if (!fn) { if (!silent) setMsg("拿不到文件名"); return; }
		jpost(EXPANDER + "/save", { filename: fn }, 20000).then((r) => {
			if (r && r.ok) { if (!silent) setMsg(r.message || "已保存"); }
			else if (!silent) setMsg("保存失败：" + ((r && r.message) || "未知"));
		}).catch(() => { if (!silent) setMsg("连不上本地 sidecar（8199）"); });
	};
	// 出图完成且设了保存位置 ⇒ 自动复制一份（同一张只存一次）
	React.useEffect(() => {
		if (job && job.status === "done" && job.image && saveDir && job.image !== BG.lastSaved) {
			BG.lastSaved = job.image;
			saveCurrent(true);
		}
	}, [job && job.image, job && job.status, saveDir]);

	// ---- 出图落地位置（ComfyUI 的实际输出目录，靠 --output-directory）----
	const [outDir, setOutDir] = React.useState("");
	const [loraOpen, setLoraOpen] = React.useState(false);
	const [loraMeta, setLoraMeta] = React.useState({});   // name -> { base, folder }，来自侧车 /loras
	const [loraCat, setLoraCat] = React.useState("");     // 当前分类（"" = 全部）
	const [loraQ, setLoraQ] = React.useState("");         // 搜索词
	const [loraDrag, setLoraDrag] = React.useState("");       // 正在拖的 LoRA
	const [loraDropAt, setLoraDropAt] = React.useState("");   // 悬停中的分类 key
	const [loraEditing, setLoraEditing] = React.useState("");   // 正在内联改名的 LoRA
	const [loraEditText, setLoraEditText] = React.useState("");  // 改名输入框内容
	const loraEditDone = React.useRef(false);                    // Enter/Esc 已处理过，别再走 blur 提交
	// LoRA 二级菜单的导入/导出/删除
	const [loraBusy, setLoraBusy] = React.useState("");
	const [loraUrl, setLoraUrl] = React.useState("");
	const [loraUrlOpen, setLoraUrlOpen] = React.useState(false);
	const loraFileRef = React.useRef(null);
	const [promptOpen, setPromptOpen] = React.useState("");
	// "prompt"=白话+正负两块 / "custom"=新面板（功能待定）；选择记在 localStorage，刷新后保持
	const [zoneModeRaw, setZoneModeRaw] = React.useState(() => {
		try { return localStorage.getItem("comfyui.zoneMode") === "custom" ? "custom" : "prompt"; } catch (e) { return "prompt"; }
	});
	const [tagEdit, setTagEdit] = React.useState(null);
	const [capOpen, setCapOpen] = React.useState(false);   // 胶囊二级菜单（展开）
	const viewPrev = React.useRef(null);   // 切视角前的 pos/neg，用于「再点一次取消」
	const sizePrev = React.useRef(null);   // 套用常用尺寸前的宽高，用于「再点一次取消」
	const [sizeMenuOpen, setSizeMenuOpen] = React.useState(false);   // 常用尺寸二级菜单（0.7.119 收成一个按钮）
	const [sizePick, setSizePick] = React.useState("");   // 显式点过的尺寸档；空 = 不高亮任何一档
	const [prTarget, setPrTarget] = React.useState("pos");   // 顶部加词条落到哪一栏
	const [prCat, setPrCat] = React.useState("");   // 加词时存进词库哪个分类（空＝自动用「自加词」）
	const [prSaveDict, setPrSaveDict] = React.useState(false);   // 加词时是否写进词库（默认关，不自动存）   // 胶囊右键编辑：{side, tag, cat, cn0, cn, en}
	const zoneMode = zoneModeRaw;
	const setZoneMode = (v) => { setZoneModeRaw(v); try { localStorage.setItem("comfyui.zoneMode", v); } catch (e) { } };
/** 白话 → 提示词（2026-10-18）：输入、模型选择、状态 */
const [nlText, setNlText] = React.useState("");
const [nlBusy, setNlBusy] = React.useState(false);
const [nlMsg, setNlMsg] = React.useState("");
const [nlInfo, setNlInfo] = React.useState("");
const [nlModels, setNlModels] = React.useState([]);
const [nlAppend, setNlAppend] = React.useState(() => { try { return localStorage.getItem("nlAppend") !== "0"; } catch (e) { return true; } });
const [expandOpen, setExpandOpen] = React.useState(false);
const [expandBusy, setExpandBusy] = React.useState(false);
const [expandErr, setExpandErr] = React.useState("");
const [expandMeta, setExpandMeta] = React.useState("");
const [expandPos, setExpandPos] = React.useState("");
const [expandNeg, setExpandNeg] = React.useState("");
const [expandRan, setExpandRan] = React.useState(false);
const [expandSrcPos, setExpandSrcPos] = React.useState("");
const [expandSrcNeg, setExpandSrcNeg] = React.useState("");
const [expRoutes, setExpRoutes] = React.useState([]);
const [expRoute, setExpRoute] = React.useState(() => { try { return localStorage.getItem("expRoute") || ""; } catch (e) { return ""; } });
/** 扩写 / 白话转提示词 共用的具体模型（路线在 expRoute 里） */
const [expModel, setExpModel] = React.useState(() => { try { return localStorage.getItem("expModel") || ""; } catch (e) { return ""; } });
const [expRouteErr, setExpRouteErr] = React.useState("");
const [expProbe, setExpProbe] = React.useState([]);
const [localSt, setLocalSt] = React.useState(null);
const [localBusy, setLocalBusy] = React.useState(false);
const [apiOpen, setApiOpen] = React.useState(false);
const [apiForm, setApiForm] = React.useState({ name: "", base: "", key: "", model: "" });
const [apiErr, setApiErr] = React.useState("");
const [apiBusy, setApiBusy] = React.useState(false);
// 白话块：首次出现时就探测一次可用路线（模型选择要用）
React.useEffect(() => { if (!expRoutes.length) { loadRoutes().then(() => loadModels(expRoute)); } }, []);
React.useEffect(() => { if (expandOpen) { loadRoutes(); loadLocalStatus(); } }, [expandOpen]);
      // Esc = 返回：先关最上层弹层，都没有弹层就回「生成」页（2026-10-18 用户要求）
      React.useEffect(() => {
        const onKey = (e) => {
          if (!e || (e.key !== "Escape" && e.keyCode !== 27)) return;
          if (tagAt) { setTagAt(""); setTagDraft(""); setTagNote(""); return; }  // 先收最里层：词库标签自动补全
          if (impRep) { setImpRep(null); return; }
          if (insMenu) { setInsMenu(""); return; }
          if (styleSub) { setStyleSub(""); return; }
          if (styleMenu) { setStyleMenu(""); return; }
          if (styleEdit) { setStyleEdit(null); return; }
          if (expandOpen) { setExpandOpen(false); return; }
          if (apiOpen) { setApiOpen(false); return; }
          if (loraOpen) { setLoraOpen(false); return; }
          if (promptOpen) { setPromptOpen(""); return; }
          if (cardEdit) { setCardEdit(null); return; }
          // 顶层页面（生成/角色卡/词库/预设）不响应 Esc：这里不能再切 Tab，否则「在角色卡按 Esc 被弹回生成」
        };
        try { window.addEventListener("keydown", onKey, true); } catch (e1) { return; }
        return () => { try { window.removeEventListener("keydown", onKey, true); } catch (e2) {} };
      }, [expandOpen, apiOpen, loraOpen, promptOpen, cardEdit, insMenu, tagAt, styleEdit, styleMenu, styleSub, impRep]);
   // 依赖必须列全，否则 Esc 拿到的是旧闭包（风格卡的 styleEdit 曾因此按 Esc 无效）

const [outDraft, setOutDraft] = React.useState("");
	React.useEffect(() => {
		fetch(EXPANDER + "/config/outdir", { headers: Object.assign({}, CONSOLE_HEADERS) }).then((r) => r.json()).then((d) => {
			if (d && d.ok) { setOutDir(d.dir || ""); setOutDraft(d.dir || ""); }
		}).catch(() => { /* sidecar 没起来就算了 */ });
	}, []);
	const applyOutDir = () => {
		jpost(EXPANDER + "/config/outdir", { dir: outDraft }, 15000).then((r) => {
			if (r && r.ok) { setOutDir(r.dir || ""); setOutDraft(r.dir || ""); setMsg("落地位置已设为：" + r.dir + "（重启 ComfyUI 后生效）"); }
			else setMsg("设置失败：" + ((r && r.message) || "sidecar 没响应"));
		}).catch(() => setMsg("连不上本地 sidecar（8199）"));
	};
	const restartComfy = () => {
		setMsg("正在重启 ComfyUI，等 20~60 秒…");
		jpost(EXPANDER + "/comfy/restart", {}, 180000).then((r) => {
			if (r && r.ok) { setMsg("ComfyUI 已重启，新图会写进：" + (outDir || "当前落地位置")); setOnline(null); setConn((c) => c + 1); }
			else setMsg("重启失败：" + ((r && r.message) || "未知"));
		}).catch(() => setMsg("重启超时或连不上 sidecar"));
	};

	// 挂载：连 ComfyUI + 接管在跑的任务
	React.useEffect(() => {
		let dead = false;
		(async () => {
			const loadMeta = async () => {
				const pick = async (node, key) => {
					const oi = await jget(COMFY + "/object_info/" + node);
					return comboOptions(oi, node, key);
				};
				const c = await pick("CheckpointLoaderSimple", "ckpt_name");
				let u = [];
				try {
					const ui = await jget(COMFY + "/object_info/UNETLoader");
					u = comboOptions(ui, "UNETLoader", "unet_name").filter((x) => !/^put_/.test(x));
				} catch (e) { u = []; }
				const l = await pick("LoraLoader", "lora_name");
				const v = await pick("VAELoader", "vae_name");
				const t = await pick("CLIPLoader", "clip_name");
				const k = await jget(COMFY + "/object_info/KSampler");
				if (dead) return;
				setCkpts(c); setUnets(u); setLoras(l); try { window.__dshSetLoras = setLoras; } catch (e) {}
				// 0.7.136：LoRA 的底模/文件夹分类来自侧车 /loras（ComfyUI 的 object_info 不带这些）
				try {
					const _lr = await jget(EXPANDER + "/loras", 90000);
					const _mm = {};
					for (const _it of ((_lr && _lr.loras) || [])) {
						const _nm = String(_it.name || "");
						const _seg = _nm.split("/");
						_mm[_nm] = { base: String(_it.base || ""), folder: _seg.slice(0, -1).join("/") };
					}
					if (!dead) setLoraMeta(_mm);
				} catch (e) { /* 侧车没起来就先不分类 */ }
				try { const vv = await jget(EXPANDER + "/version"); if (!dead && vv && vv.loaded) setVer(vv); } catch (e) { /* 老版本侧车没有 /version */ }
				const vf = v.filter((x) => x.indexOf("qwen") >= 0 || x.indexOf("vae") >= 0);
				if (vae && vf.indexOf(vae) < 0) vf.unshift(vae);   // 上次用的 VAE 不在过滤结果里也要能选中
				setVaes(vf);
				setClips(t);
				// 放大模型：只留看着像放大模型的（见 looksLikeUpscaler 的注释）
				try {
					const up = await jget(COMFY + "/object_info/UpscaleModelLoader");
					const _us = comboOptions(up, "UpscaleModelLoader", "model_name").filter(looksLikeUpscaler);
					if (!dead) {
						setUpscalers(_us);
						setUpscaleModel((cur) => (_us.indexOf(cur) >= 0 ? cur : (_us[0] || "")));
					}
				} catch (e) { /* 老 ComfyUI 或没装放大模型 */ }
				setVae((cur) => (v.indexOf(cur) >= 0 ? cur : (v.indexOf("qwen_image_vae.safetensors") >= 0 ? "qwen_image_vae.safetensors" : (v[0] || ""))));
				setClip((cur) => (t.indexOf(cur) >= 0 ? cur : (t[0] || "")));
				const _smps = comboOptions(k, "KSampler", "sampler_name");
				const _schs = comboOptions(k, "KSampler", "scheduler");
				setSamplers(_smps); setSchedulers(_schs);
				setSampler((cur) => (_smps.indexOf(cur) >= 0 ? cur : (_smps[0] || "euler")));
				setScheduler((cur) => (_schs.indexOf(cur) >= 0 ? cur : (_schs[0] || "normal")));
				const ct = await jget(COMFY + "/object_info/CLIPLoader");
				const _ctys = comboOptions(ct, "CLIPLoader", "type");
				setClipTypes(_ctys);
				setClipType((cur) => (_ctys.indexOf(cur) >= 0 ? cur : (_ctys[0] || "qwen_image")));
			};
			try {
				try { await jget(COMFY + "/system_stats", 4000); }
				catch (e) {
					if (dead) return;
          setOnline(false);
          setMsg("ComfyUI 未运行：点右上「启动 ComfyUI」手动启动（或双击 <ComfyUI父目录>\\start-comfy.ps1）");
          return;
				}
				if (dead) return;
				setOnline(true);
				await loadMeta();
				await BG.adopt();     // 有在跑的任务就接管
				if (!dead && !BG.snapshot()) setMsg("就绪");
			} catch (e) {
				if (!dead) { setOnline(false); setMsg("连不上 ComfyUI（" + COMFY + "）：" + errText(e)); }
			}
		})();
		return () => { dead = true; };
	}, [conn]);
  // 打开面板时从磁盘角色卡目录同步一次（文件是活的，面板自动跟上）
  /* 2026-10-20 去掉「从磁盘同步」：不再自动把磁盘卡并回浏览器存档 */


	// 底模分两条链：Anima（编码器类型 qwen_image）走 UNETLoader 读 diffusion_models，
	// 其余走 CheckpointLoaderSimple 读 checkpoints。两边的名字不能互相投递——
	// 混投会被 ComfyUI 校验拦成 HTTP 400（2026-10-20 实测：animagine-xl-3.1 被塞进 UNETLoader）。
	const isAnima = String(clipType || "") === "qwen_image";
	const modelList = isAnima ? unets : ckpts;
	const modelBad = !!ckpt && modelList.length > 0 && modelList.indexOf(ckpt) < 0;
	/** 某分支上次用的底模（USER.last.byType 里按 qwen_image / ckpt 各存一份） */
	const savedModelFor = (anima) => {
		const bt = (USER.last && USER.last.byType) || {};
		return bt[anima ? "qwen_image" : "ckpt"] || "";
	};
	/** 切分支时挑底模：本分支上次用的 > 当前值（若在新列表里）> anima 默认 > 列表第一个 */
	const pickModelFor = (type) => {
		const anima = String(type) === "qwen_image";
		const list = anima ? unets : ckpts;
		if (ckpt && list.indexOf(ckpt) >= 0) return ckpt;          // 眼下这个在新分支里有效 -> 优先保住
		const saved = savedModelFor(anima);
		if (saved && list.indexOf(saved) >= 0) return saved;       // 否则回到该分支上次用的
		if (anima && list.indexOf("<底模>.safetensors") >= 0) return "<底模>.safetensors";
		return list[0] || "";
	};
	/**
	 * ⚠️ 2026-10-21：本机 diffusion_models 是空的（UNETLoader.unet_name 0 条），
	 *    但 0.6.0 的 MODEL_DEFAULTS.clipType 就是 qwen_image，于是面板一上来停在
	 *    Anima 分支、底模下拉空空如也，看起来像"模型没法选"。
	 *    这里在「qwen_image 分支没有底模、而 checkpoints 有」时自动切到别的编码器类型。
	 *    将来真往 diffusion_models 放了模型（unets 不为空），这条就不再触发。
	 */
	React.useEffect(() => {
		if (String(clipType || '') !== 'qwen_image') return;
		if (unets.length > 0 || ckpts.length === 0) return;
		const alt = (clipTypes || []).filter((x) => x !== 'qwen_image')[0];
		if (alt && alt !== clipType) {
			setClipType(alt);
			MSG('没有 diffusion_models 底模，编码器类型已自动切到 ' + alt + '（走 checkpoints）');
		}
	}, [clipType, unets.length, ckpts.length, (clipTypes || []).length]);

	React.useEffect(() => {
		if (!modelList.length) return;
		if (ckpt && modelList.indexOf(ckpt) >= 0) return;      // 当前值在本分支有效 → 不动（= 上次用的）
		const saved = savedModelFor(isAnima);
		if (saved && modelList.indexOf(saved) >= 0) { setCkpt(saved); return; }   // 恢复该分支上次用的
		const prefer = (isAnima && unets.indexOf("<底模>.safetensors") >= 0)
			? "<底模>.safetensors" : modelList[0];
		setCkpt(prefer);
	}, [clipType, unets.length, ckpts.length]);

	// 参数变了就记住（下次进来还在）
	React.useEffect(() => {
		const byType = Object.assign({}, (USER.last && USER.last.byType) || {});
		if (ckpt) byType[isAnima ? "qwen_image" : "ckpt"] = ckpt;
		USER.last = Object.assign({}, USER.last || {}, { ckpt, clip, clipType, vae, loras: selLoras, pos, neg, w, h: hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, byType, sizeMultiplier, seedMode });
		saveUser();
	}, [ckpt, vae, clip, clipType, selLoras, pos, neg, w, hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, sizeMultiplier, seedMode]);

	// ---- 动作 ----
	/** 插到正向还是负面 —— 由词库页的「插入到」开关决定 */
	function insert(text, forceTarget) {
		const t = forceTarget || target;
		const add = (cur) => (cur ? cur.replace(/[,\s]+$/, "") + ", " + text : text);
		if (t === "neg") setNeg(add);
		else setPos(add);
	}
	function toggleLora(name) {
		setSelLoras((cur) => {
			const i = cur.findIndex((x) => x.name === name);
			if (i >= 0) { const n = cur.slice(); n.splice(i, 1); return n; }
			return cur.concat([{ name: name, model: 1, clip: 1 }]);
		});
	}
	function setLoraW(name, v) {
		setSelLoras((cur) => cur.map((x) => (x.name === name ? Object.assign({}, x, { model: v }) : x)));
	}

	async function doGen() {
		if (!ckpt) { setMsg("先选一个底模"); return; }
		if (modelBad) {
			setMsg(isAnima
				? "底模「" + ckpt + "」是 checkpoint，qwen_image（Anima）分支要用 diffusion_models 里的模型（当前可用的：" + (unets.join(" / ") || "无") + "）"
				: "底模「" + ckpt + "」不在 checkpoints 里，换一个或把编码器类型改成 qwen_image");
			return;
		}
		touch();
		setTab("gen");
		const _mc = multiCharAdjust(pos, neg);
		const _stab = stabilizePrompt(_mc.pos, _mc.neg, lockCards);
		if (_stab.moved) setMsg("特征锁：把 " + _stab.moved + " 个词从正向移到了负向（稳定角色特征）");
		if (_mc.n >= 2) setMsg("多角色模式：已挂 " + _mc.n + " 张角色卡 · 人数标签 " + _mc.n + "girls · 人物类数量负向已放行");
		// 身份控制：resolved 先把控制图/权重摆进 ComfyUI 目录，再接线；其余状态明说不静默
		const _cp = COND.plan;
		let _extra = null, _wire = null;
		if (_cp && _cp.status === "resolved") {
			let st = null;
			try { st = await jpost(EXPANDER + "/lllite/stage", { asset: _cp.asset, weights_key: _cp.weights_key }, 60000); } catch (e) { st = { ok: false, error: errText(e) }; }
			if (st && st.ok) {
				_wire = { image: st.image, patch: st.patch, strength: _cp.strength };
				_extra = { dsh_lllite: _cp };
				if (_cp.note) setMsg("条件图：" + _cp.note);
			} else {
				setMsg("条件图未接线（" + ((st && st.error) || "staging 失败") + "），本次不带身份控制");
			}
		} else if (_cp && _cp.status !== "off") {
			setMsg("条件图未生效（" + _cp.status + "）：" + (_cp.reason || ""));
		}
		// 档位自带补词：只在本次出图生效，换档就换一套（不写进卡 tags，避免污染其它档）
		let _pos = _stab.pos, _neg = _stab.neg, _addPos = 0, _addNeg = 0;
		const _appendWords = (cur, extra) => {
			const have = new Set(String(cur || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean));
			const add = String(extra || "").split(",").map((x) => x.trim()).filter(Boolean).filter((t) => !have.has(t.toLowerCase()));
			if (!add.length) return { text: cur, n: 0 };
			const base = String(cur || "").replace(/[\s,]+$/, "");
			return { text: base ? base + ", " + add.join(", ") : add.join(", "), n: add.length };
		};
		if (_cp && _cp.prompt_add) { const r = _appendWords(_pos, _cp.prompt_add); _pos = r.text; _addPos = r.n; }
		if (_cp && _cp.neg_add) { const r2 = _appendWords(_neg, _cp.neg_add); _neg = r2.text; _addNeg = r2.n; }
		if (_addPos || _addNeg) setMsg("档位「" + _cp.preset + "」补词：正向 +" + _addPos + "，负向 +" + _addNeg);
		// 种子：按 seedMode 分派（工作台那套）。lock=复用输入框的值（填 0 则随机）；
		// increment / decrement = 在输入值上 ±1；random = 每次换。出完把实际用到的值写回输入框。
		const _sm = seedMode || "lock";
		const _baseSeed = Math.max(0, Math.floor(Number(seed) || 0));
		const _usedSeed = _sm === "lock"
			? (_baseSeed > 0 ? _baseSeed : Math.floor(Math.random() * 1e15))
			: _sm === "increment"
				? (_baseSeed + 1)
				: _sm === "decrement"
					? Math.max(0, _baseSeed - 1)
					: Math.floor(Math.random() * 1e15);
		const _sz = imageSizeScaled(w, hh, sizeMultiplier, 8);
		const graph = buildGraph({
			ckpt, unet: ckpt, clip, clipType: effectiveClipType(ckpt, clipType, unets), vae, loras: selLoras, pos: _pos, neg: _neg,
			w: _sz.w, h: _sz.h, steps: Number(steps), cfg: Number(cfg),
			sampler, scheduler, seed: _usedSeed, prefix,
			lllite: _wire,
			upscale, upscaleModel, upscaleFactor,
		});
		await BG.run(graph, { w: _sz.w, h: _sz.h, steps, cfg, seed: _usedSeed, prefix, lllite: _extra ? _cp.weights_key + "/" + _cp.preset : "" }, _extra);
		if (_sm !== "lock") setSeed(_usedSeed);
	}
      // 取消：中断当前任务 + 清空队列（2026-10-18 用户要求「生成后面加取消」）
      async function doCancel() {
        try { BG.cancel(); } catch (e) {}
        try { await jpost(COMFY + "/queue", { clear: true }, 15000); } catch (e) {}
        setMsg("已请求取消：中断当前任务并清空队列");
      }

	/** 白话 → 提示词的通用补词表（词库之外的高频场景/光线/镜头词，公开版自带） */
	const NL_EXTRA = [
		["夜晚", "night"], ["白天", "day"], ["清晨", "early morning"], ["黄昏", "dusk, sunset"], ["傍晚", "evening"], ["深夜", "late night"],
		["雨天", "rain, rainy"], ["下雨", "rain"], ["雪", "snow"], ["雾", "fog"], ["风", "wind"], ["阴天", "overcast"],
		["阳光", "sunlight"], ["逆光", "backlighting"], ["侧光", "side lighting"], ["顶光", "top lighting"], ["暖光", "warm light"], ["冷光", "cool light"],
		["夕阳", "sunset, golden hour"], ["光斑", "light particles, lens flare"], ["阴影", "shadow"], ["反光", "reflection, reflections"],
		["教室", "classroom"], ["走廊", "hallway"], ["天台", "rooftop"], ["操场", "sports field"], ["图书馆", "library"], ["便利店", "convenience store"],
		["咖啡馆", "cafe"], ["街道", "street"], ["公园", "park"], ["车站", "train station"], ["海边", "beach, ocean"], ["房间", "indoors, room"],
		["窗边", "window"], ["床边", "bed"], ["森林", "forest"], ["花田", "flower field"], ["庭院", "garden"], ["神社", "shrine"],
		["近景", "close-up"], ["半身", "upper body"], ["中景", "medium shot"], ["全身", "full body"], ["背影", "from behind"], ["侧面", "from side"],
		// ⚠️ 决定视角的是"姿势"不是相机段，见 docs/生成经验.md #3
				["俯视", "from above"], ["仰视", "from below"], ["正面", "facing viewer"], ["回眸", "looking back, over shoulder"], ["看向别处", "looking away"],
		["坐在", "sitting"], ["站在", "standing"], ["躺着", "lying"], ["蹲着", "squatting"], ["靠着", "leaning"], ["走路", "walking"], ["跑步", "running"],
		["微笑", "smile"], ["大笑", "open mouth, laugh"], ["面无表情", "expressionless"], ["害羞", "blush, embarrassed"], ["生气", "angry"], ["惊讶", "surprised"],
		["书", "book"], ["伞", "umbrella"], ["咖啡", "coffee"], ["手机", "phone"], ["耳机", "headphones"], ["书包", "school bag"], ["猫", "cat"], ["狗", "dog"],
		["水彩", "watercolor"], ["油画", "oil painting"], ["厚涂", "painterly illustration"], ["线稿", "lineart"], ["赛璐璐", "cel shading"], ["电影感", "cinematic"],
	];

	/** 词库 + 补词表 反查表（中文 → 英文标签） */
	function nlDict() {
		const map = {};
		const lib = allLib();
		for (const k of Object.keys(lib)) for (const p of (lib[k] || [])) {
			const zh = String((p && p[0]) || "").trim();
			const en = String((p && p[1]) || "").trim();
			if (zh && en) map[zh] = map[zh] ? (map[zh] + ", " + en) : en;
		}
		for (const p of NL_EXTRA) if (p[0] && p[1]) map[p[0]] = map[p[0]] ? (map[p[0]] + ", " + p[1]) : p[1];
		return map;
	}

	/** 标签合并：逗号切分、小写、去重（不区分大小写），保留原有顺序 */
	function mergeTags(cur, add) {
		const out = [];
		const seen = {};
		for (const t of String(cur || "").split(",")) {
			const v = String(t || "").trim();
			if (!v) continue;
			const k = v.toLowerCase();
			if (seen[k]) continue;
			seen[k] = 1;
			out.push(v);
		}
		for (const t of String(add || "").split(",")) {
			const v = String(t || "").trim().toLowerCase().replace(/_/g, " ");
			if (!v) continue;
			if (seen[v]) continue;
			seen[v] = 1;
			out.push(v);
		}
		return out.join(", ");
	}

	/** conditioning 归一：与 lora/loraW 同级的卡字段，缺省即「不绑定条件图」
	 *  presets：档位 → {asset, weights, strength, framing}；default 指向当前档 */
function condForSave(cond) {
  const c = normCond(cond);
  return Object.keys(c.presets).length ? c : undefined;
}

function normCond(x) {
  const c = (x && typeof x === "object") ? x : {};
  const src = (c.presets && typeof c.presets === "object") ? c.presets : {};
  const presets = {};
  for (const k of Object.keys(src)) {
    const p = src[k] || {};
    presets[k] = {
      asset: String(p.asset || ""),
      weights: String(p.weights || ""),
      strength: Number(p.strength) > 0 ? Number(p.strength) : 1,
      framing: String(p.framing || k),
      preprocess: p.preprocess || undefined,
      promptAdd: String(p.promptAdd || ""),
      negAdd: String(p.negAdd || ""),
      image: (p.image && typeof p.image === "object") ? { name: String(p.image.name || ""), b64: String(p.image.b64 || ""), sha256: String(p.image.sha256 || ""), w: p.image.w, h: p.image.h } : undefined,
    };
  }
  const keys = Object.keys(presets);
  const def = (c.default && presets[c.default]) ? c.default : (keys[0] || "");
  return {
    enabled: !!c.enabled,
    default: def,
    presets: presets,
    weights: (c.weights && typeof c.weights === "object") ? c.weights : undefined,
    conflictPolicy: String(c.conflictPolicy || "card-wins"),
    note: String(c.note || ""),
  };
}

	/** 锁表归一：补齐字段（每张卡的锁表就是全部自定义规则，没有内置特例）
 *  allow：白名单短语——卡自己声明的关键短语，即使落在禁用词里也放行（LLLite 卡风衣长度用） */
function normLocks(list) {
  return (Array.isArray(list) ? list : []).filter(Boolean).map((x) => ({
    name: String(x.name || ""),
    tags: (Array.isArray(x.tags) ? x.tags : []).map(String).filter(Boolean),
    scope: (x.scope === "swap" || x.scope === "both") ? x.scope : "full",
    allow: (Array.isArray(x.allow) ? x.allow : []).map(String).filter(Boolean),
  }));
}

/** 已插入的角色卡（生图时用它们的锁稳定特征） */
let lockCards = [];


	/** 离线规则引擎：不联网，词库反查 + 英文原样保留 */
	function nlRules(text) {
		const src = String(text || "");
		const map = nlDict();
		const keys = Object.keys(map).sort((a, b) => b.length - a.length);
		let rest = src;
		const parts = [];
		for (const k of keys) {
			if (k.length < 2) continue;
			if (rest.indexOf(k) < 0) continue;
			parts.push(map[k]);
			rest = rest.split(k).join(" ");
		}
		const eng = (src.match(/[a-zA-Z0-9][a-zA-Z0-9 _-]{1,40}/g) || []).filter((x) => /[a-zA-Z]/.test(x)).map((x) => x.toLowerCase());
		const merged = mergeTags(eng.join(", "), parts.join(", ")).split(", ").filter(Boolean);
		const kept = merged;   // 特征锁不全局拦截：只在角色卡「完整插入」时生效（换装要能自由写）
		let positive = kept.join(", ");
		const unknown = rest.replace(/[a-zA-Z0-9 _,.-]+/g, " ").replace(/\s+/g, " ").trim();
		return { positive: positive, negative: "", unknown: unknown.slice(0, 80), via: "离线规则" };
	}

	/** 把结果写进正负提示词（追加或替换） */
	function nlApply(res, via) {
		const posAdd = String((res && res.positive) || "").trim();
		const negAdd = String((res && res.negative) || "").trim();
		if (!posAdd && !negAdd) { setNlMsg("没转出内容，换个说法试试"); return; }
		if (nlAppend) {
			setPos((cur) => mergeTags(cur, posAdd));
			if (negAdd) setNeg((cur) => mergeTags(cur, negAdd));
		} else {
			setPos(posAdd);
			if (negAdd) setNeg(negAdd);
		}
		const un = (res && res.unknown) ? String(res.unknown) : "";
		setNlMsg(un ? ("未识别：" + un) : "");
		setNlInfo(via + " · " + posAdd.split(",").length + " 条标签" + (nlAppend ? " · 已追加" : " · 已替换"));
	}

	/** 离线规则：不碰网络 */
	function nlRuleOnly() {
		if (!String(nlText || "").trim()) { setNlMsg("先在框里用中文说一句"); return; }
		nlApply(nlRules(nlText), "离线规则");
	}

	/** 加载某条路线下的模型列表 */
	async function loadModels(routeId) {
		try {
			const j = await jget(EXPANDER + "/models" + (routeId ? ("?route=" + encodeURIComponent(routeId)) : ""), 20000);
			const list = (j && j.models) || [];
			setNlModels(list.map((m) => (typeof m === "string" ? { id: m, name: m } : m)));
		} catch (e) { setNlModels([]); }
	}

	/** AI 转换：走扩写同一套 sidecar /expand，只是 kind=nl2prompt */
	async function nlConvert() {
		const src = String(nlText || "").trim();
		if (!src) { setNlMsg("先在框里用中文说一句"); return; }
		if (nlBusy) return;
		setNlBusy(true); setNlMsg(""); setNlInfo("调用中…");
		const t0 = Date.now();
		try {
			const r = await jpost(EXPANDER + "/expand", { text: src, negative: neg, kind: "nl2prompt", route: expRoute, model: expModel }, 120000);
			if (r && r.error) throw new Error(String(r.error));
			const via = (r && r.model) ? String(r.model) : "AI";
			nlApply(r, via + " · " + Math.round((Date.now() - t0) / 1000) + "s");
		} catch (e) {
			setNlInfo("");
			setNlMsg("模型不可用（" + String((e && e.message) || e).slice(0, 60) + "），可点「离线规则」");
		}
		setNlBusy(false);
	}
async function doExpand() {
		setExpandPos(pos);
		setExpandNeg(neg);
		setExpandRan(false);
		setExpandErr("");
		setExpandMeta("");
		setExpandOpen(true);
				setExpandSrcPos(pos);
				setExpandSrcNeg(neg);
				loadRoutes();
	}

	async function runExpand() {
		setExpandBusy(true); setExpandErr(""); setExpandMeta("");
		const t0 = Date.now();
		try {
			const r = await jpost(EXPANDER + "/expand", { text: expandSrcPos, negative: expandSrcNeg, route: expRoute }, 90000);
			if (r && r.positive) {
				setExpandPos(r.positive);
				setExpandNeg(r.negative || "");
				setExpandMeta((r.model || "") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " 秒");
				setExpandRan(true);
			} else { throw new Error("没返回内容"); }
		} catch (e) { setExpandErr(errText(e)); }
		finally { setExpandBusy(false); }
	}

	async function loadRoutes(force) {
		setExpRouteErr("");
		try {
			const j = await jget(EXPANDER + "/routes" + (force ? "?refresh=1" : ""), 30000);
			const rs = (j && j.routes) || [];
			setExpRoutes(rs);
			setExpProbe((j && j.probed) || []);
			setExpRoute((cur) => {
				const ok = rs.some((r) => r.id === cur);
				if (ok) return cur;
				const cloud = rs.find((r) => r.kind === "cloud");
				return (cloud || rs[0] || {}).id || "";
			});
		} catch (e) { setExpRouteErr("取模型列表失败：" + errText(e)); }
	}

	function startExpand() {
		setExpandSrcPos(expandPos);
		setExpandSrcNeg(expandNeg);
		runExpand();
	}

	function pickRoute(id) {
		setExpRoute(id);
		try { localStorage.setItem("expRoute", id); } catch (e) { /* 忽略 */ }
	}

	async function loadLocalStatus() {
	try { const j = await jget(EXPANDER + "/local/status", 15000); setLocalSt(j || null); }
	catch (e) { setLocalSt({ error: String((e && e.message) || e) }); }
}

async function startLocalLLM() {
	setLocalBusy(true); setExpandErr("");
	try {
		const j = await jpost(EXPANDER + "/local/start", {}, 120000);
		if (!j || !j.ok) throw new Error((j && j.error) || "启动失败");
		setLocalSt(j);
		await loadRoutes(true);
		if (!((j.models || []).length)) setExpandErr("服务起来了，但没读到模型列表；看 " + ((j.dir || "") + "\\logs\\server.err.log"));
	} catch (e) { setExpandErr("启动本机模型失败：" + ((e && e.message) || e)); }
	finally { setLocalBusy(false); }
}

async function addApiRoute() {
		const base = (apiForm.base || "").trim();
		if (!base) { setApiErr("Base URL 不能为空"); return; }
		setApiBusy(true); setApiErr("");
		try {
			const j = await jpost(EXPANDER + "/routes", { action: "add", name: apiForm.name || base, base: base, key: apiForm.key || "", model: apiForm.model || "" }, 20000);
			const rs = (j && j.routes) || [];
			setExpRoutes(rs);
			const hit = rs.find((r) => r.base === base.replace(/\/+$/, ""));
			if (hit) pickRoute(hit.id);
			setApiOpen(false);
			setApiForm({ name: "", base: "", key: "", model: "" });
			setMsg("已添加 API 路线");
		} catch (e) { setApiErr(errText(e)); }
		finally { setApiBusy(false); }
	}

	const expRouteOptions = expRoutes.map((r) => h("option", { key: r.id, value: r.id }, (r.kind === "cloud" ? "云 · " : (r.kind === "local" ? "本地 · " : "API · ")) + (r.name || r.base) + (r.model ? " / " + r.model : "")));

function applyExpand(which) {
		if (which === "pos" || which === "both") setPos(expandPos);
		if (which === "neg" || which === "both") setNeg(expandNeg);
		setMsg(which === "pos" ? "已套用扩写：正向" : (which === "neg" ? "已套用扩写：负向" : "已套用扩写：正负都换了"));
		setExpandOpen(false);
	}



	function savePreset() {
		const name = (presetName || "").trim();
		if (!name) { setMsg("先给预设起个名字"); return; }
		const cat = (presetCat || "默认").trim() || "默认";
		const item = { name, cat, pos, neg, w, h: hh, steps, cfg, sampler, scheduler, ckpt, loras: selLoras };
		const list = (USER.presets || []).filter((p) => !(p.name === name && p.cat === cat));
		list.push(item);
		USER.presets = list;
		saveUser();
		setMsg("已保存预设「" + cat + " / " + name + "」");
		setPresetName("");
	}
	/**
	 * 一键切视角：只改**姿势段 + 构图段 + 前置相机词**，其余逐字不动。
	 *
	 * 为什么不靠"预设"：预设是快照，套用旧预设会把旧构图塞回来，用户很难察觉。
	 * 切视角是一条**显式动作**，改了立刻能看见。
	 */
	function switchView(key) {
		const v = (typeof VIEWS !== 'undefined' ? VIEWS : []).filter((x) => x.key === key)[0];
		const label = v ? v.label : key;
		// 再点一次同一档 = 取消：还原切换前的提示词并清掉高亮
		const prev = viewPrev.current;
		if (prev && prev.key === key && prev.afterPos === pos && prev.afterNeg === neg) {
			setPos(prev.pos);
			setNeg(prev.neg);
			setViewKey("");
			viewPrev.current = null;
			setMsg("已取消视角「" + label + "」—— 提示词还原为切换前");
			return;
		}
		const r = (typeof applyView === 'function') ? applyView(pos, neg, key) : null;
		if (!r || !r.changed) { setMsg("切视角失败：找不到视角定义"); return; }
		viewPrev.current = { key: key, pos: pos, neg: neg, afterPos: r.pos, afterNeg: r.neg };
		setPos(r.pos);
		setNeg(r.neg);
		setViewKey(key);
		setMsg("已切到「" + label + "」—— 姿势与构图都已替换（改了 " + r.moved + " 段）；再点同一档可取消");
	}

	function loadPreset(p) {
		setPos(p.pos || ""); setNeg(p.neg || "");
		if (p.w) setW(p.w);
		if (p.h) setHh(p.h);
		if (p.steps) setSteps(p.steps);
		if (p.cfg) setCfg(p.cfg);
		if (p.sampler) setSampler(p.sampler);
		if (p.scheduler) setScheduler(p.scheduler);
		if (p.ckpt) setCkpt(p.ckpt);
		if (p.loras) setSelLoras(p.loras);
		// 默认不自动高亮视角：只有用户显式点过才亮，避免一开页面就「看起来已选中」
		setViewKey("");
		setMsg("已套用预设「" + p.cat + " / " + p.name + "」");
		setTab("gen");
	}
	function delPreset(p) {
		USER.presets = (USER.presets || []).filter((x) => !(x.name === p.name && x.cat === p.cat));
		saveUser();
		setMsg("已删除「" + p.cat + " / " + p.name + "」");
	}

	/** 删除词条：自定义的从 frags 真删；内置的记进 hidden（可恢复） */



	// ---- ComfyUI 工作流导入 ----
	function doParseWf() {
		const r = parseWorkflow(wfText);
		setWfResult(r);
		if (!r.ok) setMsg("工作流解析失败：" + r.error);
		else setMsg("解析成功：底模 " + (r.ckpt || "?") + " · " + r.loras.length + " 个 LoRA · "
			+ r.w + "×" + r.h + " · " + r.steps + " 步 · " + (r.ignored.length ? r.ignored.length + " 类节点未带入" : "无未识别节点"));
	}
	function saveWfAsPreset() {
		const r = wfResult;
		if (!r || !r.ok) { setMsg("先解析一个工作流"); return; }
		const name = (presetName || "").trim() || ("工作流导入 " + new Date().toLocaleString());
		const cat = (presetCat || "默认").trim() || "默认";
		const item = {
			name: name, cat: cat,
			pos: r.pos || "", neg: r.neg || "",
			w: r.w || 896, h: r.h || 1216,
			steps: r.steps || 24, cfg: r.cfg === undefined ? 6 : r.cfg,
			sampler: r.sampler || "euler", scheduler: r.scheduler || "normal",
			ckpt: r.ckpt || "", clip: r.clip || "",
			loras: (r.loras || []).map((l) => ({ name: l.name, model: l.model, clip: l.clip })),
			fromWorkflow: true,
		};
		const list = (USER.presets || []).filter((p) => !(p.name === name && p.cat === cat));
		list.push(item);
		USER.presets = list;
		saveUser();
		setMsg("已把工作流存成预设「" + cat + " / " + name + "」");
		// 顺手套用
		setPos(item.pos); setNeg(item.neg); setW(item.w); setHh(item.h);
		setSteps(item.steps); setCfg(item.cfg); setSampler(item.sampler); setScheduler(item.scheduler);
		if (item.ckpt) setCkpt(item.ckpt);
		if (item.clip) setClip(item.clip);
		if (item.loras) setSelLoras(item.loras);
		setTab("gen");
	}
	/** 用文件选择器读一个 workflow json */
	function pickWfFile() {
		try {
			const el = document.createElement("input");
			el.type = "file";
			el.accept = ".json,application/json";
			el.onchange = () => {
				const f = el.files && el.files[0];
				if (!f) return;
				const rd = new FileReader();
				rd.onload = () => { setWfText(String(rd.result || "")); setMsg("已读入 " + f.name + "（" + Math.round(f.size / 1024) + " KB），点「解析」"); };
				rd.onerror = () => setMsg("读文件失败");
				rd.readAsText(f, "utf-8");
			};
			el.click();
		} catch (e) { setMsg("打不开文件选择器：" + errText(e)); }
	}

	// ---- 渲染辅助 ----
	function opt(list, val) { return list.map((x) => h("option", { key: x, value: x }, x)); }
	function num(label, v, set, step) {
		return h("label", { style: Object.assign({}, S.field, { minWidth: 0, flex: "1 1 0", flexShrink: 0, alignItems: "flex-start" }), key: label },
			h("span", { style: S.label }, label),
			h("input", { type: "number", value: v, step: step || 1, style: Object.assign({}, S.inp, { width: "100%", maxWidth: "110px", minWidth: 0 }), onChange: (e) => set(e.target.value === "" ? "" : Number(e.target.value)) }));
	}

	const status = online === null
		? h("span", { style: S.dim }, "检测中…")
		: online ? h("span", { style: S.ok }, "● 在线") : h("span", { style: S.bad }, "● 离线");

	// ==================== 生成页 ====================
	function genTab() {
	  const cFr = (availH && availH < 700) ? 1.4 : ((availH && availH < 820) ? 2.0 : 3.0);
  const cMin = availH ? Math.min(470, Math.max(200, Math.round(availH * 0.38))) : 360;  // 画布行下限：占可用高度约 38%（2026-10-18 用户反馈「竖向过长」后从 62% 调低）
		const box = { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, overflow: "visible", border: "1px solid rgba(127,127,127,.28)", borderRadius: "10px", padding: "8px 10px" };
		// 画布占 ~73%（2.7fr:1fr）；行用 minmax 下限，窗口再矮也不会把内容挤扁 ⇒ 整页可滚动
	const narrow = rW > 0 ? rW < 640 : false;   // 用面板宽度（pW 是参数卡内网格宽度，别混用）  // 窄屏：单列堆叠（手机/平板竖屏，2026-10-18）
				const tiny = rW > 0 ? rW < 460 : false;    // 手机竖屏：再压一档
				const mid = rW > 0 && rW < 980;             // 中等宽：右栏收窄，别把左栏挤扁
				const gpos = () => ({});   // 布局改成左右两列 flex 后不再需要行列定位（保留调用点）
				const grid = { display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) clamp(210px, 32%, 420px)", alignItems: "stretch", gridAutoRows: "max-content", gap: "10px", width: "100%", minWidth: 0, boxSizing: "border-box", flex: "0 0 auto", minHeight: 0 };
				/** 提示词框行数：按内容自适应，2~5 行（2026-10-18 用户要求「竖向长度按需缩短」） */
		const taRows = (t) => Math.min(5, Math.max(2, Math.ceil(String(t || "").length / (tiny ? 34 : (narrow ? 44 : 52)))));
const hd = { fontWeight: 700, fontSize: "13px", color: "var(--c-fg)" };
		const pCols = pW > 0 ? (pW < 200 ? 1 : (pW < 470 ? 2 : 4)) : 4;  // 参数卡每行几个：窄了先降到 2
		const pCols2 = pW > 0 && pW < 520 ? 1 : 2;
		// ===== 胶囊提示词（新面板用）：把 pos / neg 按逗号切成小胶囊 =====
			const TAG_IDX = tagIndex();   // 英文标签 → {cat, cn, en}，右键编辑用

		/** 把某一栏里的旧标签换成新标签（newTag 为空＝删掉）。
		 *  oldTags 可以是数组：同一张词库卡的多段标签一次全换，不会留下半截残词。 */
		const prRewrite = (key, oldTags, newTag) => {
			const setter = key === "pos" ? setPos : setNeg;
			const olds = (Array.isArray(oldTags) ? oldTags : [oldTags])
				.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
			const add = newTag ? String(newTag).split(",").map((s) => s.trim()).filter(Boolean) : [];
			setter((cur) => {
				const out = [];
				let placed = false;
				String(cur || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((tk) => {
					if (olds.indexOf(tk.toLowerCase()) >= 0) {
						if (!placed) { add.forEach((a) => out.push(a)); placed = true; }
						return;
					}
					out.push(tk);
				});
				return mergeCsvTags(out.join(", "), "");
			});
		};

		/** 右键胶囊：能对上词库卡片就连中文一起改，对不上就只改提示词本体 */
		const openTagEdit = (side, tk) => {
			const hit = TAG_IDX[String(tk || "").trim().toLowerCase()] || null;
			setTagEdit({
				side: side, tag: tk,
				cat: hit ? hit.cat : "", cn0: hit ? hit.cn : "",
				cn: hit ? hit.cn : "", en: tk,
				// 同一张卡在提示词里可能占好几段（en = "sitting, seated"）：一起换
				sibs: hit ? String(hit.en || "").split(",").map((x) => x.trim()).filter(Boolean) : [tk],
			});
		};
		const saveTagEdit = () => {
			const e0 = tagEdit;
			if (!e0) return;
			const en = String(e0.en || "").trim();
			if (!en) { setMsg("提示词本体不能为空；要删就点「删除这个胶囊」"); return; }
			const cn = String(e0.cn || "").trim();
			const notes = [];
			if (e0.cat) {
				if (!dictRenameEntry(e0.cat, e0.cn0, cn || e0.cn0, en)) notes.push("词库里没找到「" + e0.cn0 + "」，只改了提示词");
			}
			const olds = (e0.sibs && e0.sibs.length ? e0.sibs : [e0.tag]);
			if (en !== e0.tag || olds.length > 1) prRewrite(e0.side, olds, en);
			setTagEdit(null);
			setMsg("已改：" + (cn || e0.cn0 || e0.tag) + " → " + en + (notes.length ? "（" + notes.join("；") + "）" : ""));
		};
		const dropTagEdit = () => {
			const e0 = tagEdit;
			if (!e0) return;
			prRewrite(e0.side, (e0.sibs && e0.sibs.length ? e0.sibs : [e0.tag]), "");
			setTagEdit(null);
			setMsg("已删掉「" + (e0.cn || e0.tag) + "」");
		};
		const prTokens = (key) => {
			const seen = {};
			return String((key === "pos" ? pos : neg) || "").split(",").map((s) => s.trim()).filter(Boolean)
				.filter((s) => { const k = s.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
		};
		const prWrite = (key, arr) => (key === "pos" ? setPos(arr.join(", ")) : setNeg(arr.join(", ")));
		const prDel = (key, tk) => prWrite(key, prTokens(key).filter((s) => s !== tk));
		const prMove = (key, tk) => {
			const other = key === "pos" ? "neg" : "pos";
			prWrite(key, prTokens(key).filter((s) => s !== tk));
			prWrite(other, prTokens(other).concat([tk]));
		};
		/** 加一颗胶囊：中文备注 + 提示词本体。
		 *  带中文 → 先落词库「自加词」分类（已存在同 en 的卡片就改它的中文），再进提示词；
		 *  不带中文 → 只写提示词。这样胶囊显示中文、右键改名的口径和词库完全一致。 */
		const prAddPair = (cnRaw, enRaw, catRaw, side, saveDict) => {
			const cnT = String(cnRaw || "").trim();
			const enT = String(enRaw || "").trim();
			const sideK = side === "neg" ? "neg" : "pos";
			const writeDict = !!saveDict;   // 开关没开就一律不碰词库
			if (!enT) { setMsg("提示词本体不能空（中文备注可以空）"); return false; }
			const catPick = String(catRaw || "").trim() || PR_HOME_CAT;
			let existed = null;
			if (cnT && writeDict) {
				const lib = allLib();
				Object.keys(lib).forEach((cat) => {
					(lib[cat] || []).forEach((p) => {
						if (String((p && p[1]) || "").trim().toLowerCase() === enT.toLowerCase()) existed = { cat: cat, cn: String((p && p[0]) || "") };
					});
				});
				if (existed) {
					if (existed.cn !== cnT) dictRenameEntry(existed.cat, existed.cn, cnT, enT);
				} else {
					USER.cats = USER.cats || [];
					if (!allLib()[catPick] && USER.cats.indexOf(catPick) < 0) USER.cats.push(catPick);
					USER.frags = USER.frags || {};
					USER.frags[catPick] = USER.frags[catPick] || [];
					USER.frags[catPick].push([cnT, enT]);
					saveUser();
				}
			}
			const setter2 = sideK === "pos" ? setPos : setNeg;
			setter2((cur) => mergeCsvTags(cur, enT));
			setPrTarget(sideK);
			const dictNote = !cnT ? "" : (writeDict ? "（存进词库「" + (existed ? existed.cat : catPick) + "」）" : "（没存词库，胶囊按本体显示）");
			setMsg("已写进" + (sideK === "pos" ? "正向" : "负面") + "提示词框：" + (cnT ? cnT + " / " : "") + enT + dictNote);
			return true;
		};

		/** 顶部加词行：单独一条，回车写进 prTarget 指定的那一栏 */
		/** 提交加词：读同一行里的两格输入，直接写进 side 指定的那一栏 */
		const prSubmit = (side, el) => {
			const box = el && el.closest ? el.closest("[data-pradder]") : null;
			const ins = box ? box.querySelectorAll("input") : [];
			const cnV = ins[0] ? ins[0].value : "";
			const enV = ins[1] ? ins[1].value : "";
			if (!prAddPair(cnV, enV, prCat, side, prSaveDict)) return;
			if (ins[0]) ins[0].value = "";
			if (ins[1]) { ins[1].value = ""; ins[1].focus(); }
		};

		const prCatOptions = [{ k: "", n: "自动（自加词）" }].concat(dictGroups().map((g) => ({ k: g.name, n: g.name })));

		const prAdderRow = h("div", {
			"data-pradder": "1",
			style: { display: "flex", flexDirection: narrow ? "column" : "row", alignItems: narrow ? "stretch" : "center", gap: narrow ? "5px" : "6px", flexWrap: "wrap" },
		},
			h("span", { style: { fontSize: "12px", color: "var(--c-fg3)", fontWeight: 600 } }, "新胶囊"),
			h("input", {
				title: "显示在胶囊上的中文名；留空则按提示词本体显示",
				placeholder: "中文备注（可空）",
				style: Object.assign({}, S.inp, { fontSize: "12px", padding: "3px 8px", width: narrow ? "100%" : "126px", minWidth: "0", boxSizing: "border-box" }),
				onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); prSubmit(prTarget, e.target); } },
			}),
			h("input", {
				title: "写进提示词的英文本体；逗号分隔可一次加多段",
				placeholder: "提示词本体，逗号分隔",
				style: Object.assign({}, S.inp, { fontSize: "12px", padding: "3px 8px", width: narrow ? "100%" : "220px", maxWidth: narrow ? "100%" : "44vw", minWidth: "0", boxSizing: "border-box" }),
				onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); prSubmit(prTarget, e.target); } },
			}),
			h("label", {
				title: "勾上才把这条词写进词库；不勾就只加进提示词，词库一点不动",
				style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: prSaveDict ? "var(--c-fg2)" : "var(--c-fg4)", cursor: "pointer", flex: narrow ? "1 1 auto" : "0 0 auto" },
			},
				h("input", {
					type: "checkbox", checked: prSaveDict,
					onChange: (e) => setPrSaveDict(e.target.checked),
				}), "存到词库"),
			h("select", {
				style: Object.assign({}, S.inp, { fontSize: "12px", padding: "2px 6px", width: "auto", minWidth: narrow ? "0" : "96px", maxWidth: narrow ? "none" : "150px", flex: narrow ? "1 1 auto" : "0 0 auto", opacity: prSaveDict ? 1 : 0.5 }),
				value: prCat,
				disabled: !prSaveDict,
				title: prSaveDict ? "存进这个分类（选了不存在的名字会自动新建自建分类）" : "先勾上「存到词库」才能选分类",
				onChange: (e) => setPrCat(e.target.value),
			}, prCatOptions.map((o) => h("option", { key: o.k || "auto", value: o.k }, o.n))),
			h("button", {
				style: Object.assign({}, S.btn, { fontSize: tiny ? "11.5px" : "12px", padding: "3px 10px", flex: tiny ? "1 1 100%" : (narrow ? "1 1 46%" : "0 0 auto") }),
				title: "写进生成页的「正向提示词」框（追加到末尾，重复的自动跳过）",
				onClick: (e) => prSubmit("pos", e.currentTarget),
			}, "加到正向"),
			h("button", {
				style: Object.assign({}, S.btn2, { fontSize: tiny ? "11.5px" : "12px", padding: "3px 10px", borderColor: "var(--c-bad)", color: "var(--c-bad)", flex: tiny ? "1 1 100%" : (narrow ? "1 1 46%" : "0 0 auto") }),
				title: "写进生成页的「负面提示词」框（追加到末尾，重复的自动跳过）",
				onClick: (e) => prSubmit("neg", e.currentTarget),
			}, "加到负面"));

		/** 胶囊右键编辑器：中文名（能对上词库卡片才可改）+ 提示词本体 */
		const tagEditPanel = tagEdit
			? h("div", {
				style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
				onMouseDown: (e) => { if (e.target === e.currentTarget) setTagEdit(null); },
			},
				h("div", {
					style: {
						display: "flex", flexDirection: "column", gap: "10px", width: "min(460px,92vw)",
						background: "var(--c-panel)", border: "1px solid var(--c-line)", borderRadius: "10px", padding: "14px 16px",
						boxShadow: "0 12px 40px rgba(0,0,0,.28)", color: "var(--c-fg)",
					},
				},
					h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" } },
						h("span", { style: hd }, "改这条词条"),
						h("span", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, tagEdit.side === "pos" ? "来自正向" : "来自负面")),
					h("label", { style: { display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px", color: "var(--c-fg3)" } },
						"中文名",
						h("input", {
							style: Object.assign({}, S.inp, tagEdit.cat ? {} : { opacity: 0.6 }),
							value: tagEdit.cn,
							disabled: !tagEdit.cat,
							placeholder: tagEdit.cat ? "显示在胶囊上的中文" : "不在词库里，改不了中文",
							onChange: (e) => setTagEdit(Object.assign({}, tagEdit, { cn: e.target.value })),
						})),
					h("label", { style: { display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px", color: "var(--c-fg3)" } },
						"提示词本体（英文，逗号分隔可加多段）",
						h("input", {
							style: S.inp,
							value: tagEdit.en,
							onChange: (e) => setTagEdit(Object.assign({}, tagEdit, { en: e.target.value })),
							onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); saveTagEdit(); } if (e.key === "Escape") setTagEdit(null); },
						})),
					h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)", lineHeight: 1.6 } },
						tagEdit.cat
							? "改中文会写回词库「" + tagEdit.cat + "」那张卡片；改英文只换这一栏提示词里的写法。"
							: "这个词条不在词库里（比如手写的 1girl）：只能改提示词本体，中文名没地方存。"),
					h("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
						h("button", { style: Object.assign({}, S.btn2, { borderColor: "var(--c-bad)", color: "var(--c-bad)" }), onClick: dropTagEdit }, "删除这个胶囊"),
						h("span", { style: { display: "flex", gap: "8px" } },
							h("button", { style: S.btn2, onClick: () => setTagEdit(null) }, "取消"),
							h("button", { style: S.btn, onClick: saveTagEdit }, "保存")))))
			: null;

		const prCopy = (key) => {
			const txt = prTokens(key).join(", ");
			try {
				window.navigator.clipboard.writeText(txt).then(
					() => setMsg("已复制" + (key === "pos" ? "正向" : "负面") + "：" + txt.slice(0, 60)),
					() => setMsg("复制失败：浏览器拦了剪贴板"));
			} catch (e) { setMsg("复制失败：" + e); }
		};
		/** 往某一栏直接加词（逗号可一次加多个）；和文本框写的是同一个 state */
		const prAdd = (key, raw) => {
			const add = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
			if (!add.length) return;
			const setter = key === "pos" ? setPos : setNeg;
			setter((cur) => mergeCsvTags(cur, add.join(", ")));
			setMsg("已加入" + (key === "pos" ? "正向" : "负面") + "：" + add.join(", "));
		};

		/** 一栏胶囊（label + 计数 + 复制/清空 + 胶囊列表） */
		const prRow = (key, label, tint) => {
			const list = prTokens(key);
			const chips = list.length ? list.map((tk) => {
				const x = h("span", {
					title: "删掉这个胶囊",
					style: { opacity: 0.7, fontSize: "12px", lineHeight: 1, padding: "0 1px", borderRadius: "50%" },
					onClick: (e) => { e.stopPropagation(); const _own = tokOwner(tk, key); prDel(key, tk); setMsg(_own ? ("已删掉「" + (capNoteOf(tk) || tk) + "」· 这张卡转为部分移除（LoRA/条件图仍挂着，点卡片可整体解除）") : ("已删掉「" + (capNoteOf(tk) || tk) + "」")); },
					onMouseEnter: (e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "rgba(var(--c-ink-rgb),.12)"; },
					onMouseLeave: (e) => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.background = "transparent"; },
				}, "\u00D7");
				const zh = capNoteOf(tk) || "";
				return h("span", {
					key: key + "-" + tk,
					title: (zh ? zh + "\u000A" : "") + tk + "\u000A左键：搬到" + (key === "pos" ? "负面" : "正向") + " · 右键：改中文 / 提示词本体 · ×：删掉",
					style: Object.assign({}, S.chip, {
						fontSize: narrow ? "11.5px" : "12px", padding: narrow ? "2px 5px 2px 8px" : "2px 6px 2px 9px", display: "inline-flex", alignItems: "center", gap: "4px",
						background: tint, borderColor: "var(--c-line)", cursor: "pointer", borderRadius: "999px",
						maxWidth: tiny ? "80vw" : (narrow ? "62vw" : "240px"), minWidth: "0",
					}),
					onClick: () => prMove(key, tk),
					onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); openTagEdit(key, tk); },
				}, h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "0" } }, (tokOwner(tk, key) ? "\uD83D\uDD12 " : "") + (zh || tk)), x);
			}) : [h("span", { key: "empty", style: { fontSize: "11.5px", color: "var(--c-fg5)", paddingTop: "3px" } }, "（空）")];
			const head = h("div", { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
				h("span", { style: { fontSize: "12px", fontWeight: 600, color: "var(--c-fg3)" } }, label + " " + list.length),
				h("button", { style: Object.assign({}, S.btn2, { padding: "1px 8px", fontSize: "11.5px" }), onClick: () => prCopy(key) }, "复制"),
				list.length ? h("button", {
					style: Object.assign({}, S.btn2, { padding: "1px 8px", fontSize: "11.5px" }),
					title: "清空这一栏",
					onClick: () => { prWrite(key, []); setMsg("已清空" + label); },
				}, "清空") : null);
			return h("div", { style: { display: "flex", flexDirection: "column", gap: "5px" } },
				head,
				h("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px", minHeight: "24px", alignItems: "flex-start" } }, chips));
		};

		// 胶囊二级菜单（展开）：和面板同一份 pos/neg，增删改立刻同步
		const capExpand = capOpen
			? h("div", {
				style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 99998 },
				onMouseDown: (e) => { if (e.target === e.currentTarget) setCapOpen(false); },
			},
				h("div", {
					style: { display: "flex", flexDirection: "column", gap: "8px", width: "min(980px,94vw)", height: "min(78vh,720px)", background: "var(--c-card)", border: "1px solid var(--c-line)", borderRadius: "12px", padding: "12px 14px", overflow: "hidden" },
				},
					h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
						h("span", { style: { fontWeight: 700, fontSize: "14px", color: "var(--c-fg)" } }, "胶囊提示词 · 展开"),
						h("span", { style: { display: "flex", alignItems: "center", gap: "8px" } },
							h("span", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "正向 " + prTokens("pos").length + " · 负面 " + prTokens("neg").length),
							h("button", { style: Object.assign({}, S.btn2, { padding: "2px 10px" }), onClick: () => setCapOpen(false) }, "关闭"))),
					prAdderRow,
					h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 auto", minHeight: "0", overflowY: "auto", overflowX: "hidden" } },
						prRow("pos", "正向", "var(--c-accent-bg2)"),
						prRow("neg", "负面", "var(--c-bad-bg)")),
					h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "同一份数据：这里删掉的胶囊，生成页提示词框里同步消失；右键胶囊改中文 / 本体。")))
			: null;

		// LoRA 二级菜单里的导入 / 导出 / 删除。后端三个接口早就有了：
		//   POST /loras/import（本机路径 / 浏览器上传 / 网址 / zip）
		//   POST /loras/del    （搬进 _trash-<时间戳>，不硬删）
		//   GET  /loras/file   （本次新加，给 <a download> 用）
		const loraImportBuf = async (file) => {
			if (!file) return;
			setLoraBusy("正在导入 " + file.name + "…");
			try {
				const buf = await file.arrayBuffer();
				const r = await fetch(EXPANDER + "/loras/import", {
					method: "POST",
					headers: Object.assign({}, CONSOLE_HEADERS, { "X-Filename": encodeURIComponent(file.name) }),
					body: buf,
				});
				const j = await r.json();
				if (j && j.ok) { setMsg("已导入 " + (j.name || file.name)); setConn((c) => c + 1); }
				else setMsg("导入失败：" + ((j && j.error) || ("HTTP " + r.status)));
			} catch (e) { setMsg("导入失败：" + errText(e)); }
			setLoraBusy("");
		};
		const loraImportUrl = async () => {
			const u = String(loraUrl || "").trim();
			if (!u) return;
			setLoraBusy("正在下载…");
			try {
				const r = await fetch(EXPANDER + "/loras/import", {
					method: "POST",
					headers: Object.assign({}, CONSOLE_HEADERS, { "Content-Type": "application/json" }),
					body: JSON.stringify({ url: u }),
				});
				const j = await r.json();
				if (j && j.ok) { setMsg("已导入 " + (j.name || u)); setLoraUrl(""); setLoraUrlOpen(false); setConn((c) => c + 1); }
				else setMsg("导入失败：" + ((j && j.error) || ("HTTP " + r.status)));
			} catch (e) { setMsg("导入失败：" + errText(e)); }
			setLoraBusy("");
		};
		const loraExportOne = (name) => {
			try {
				const a = document.createElement("a");
				a.href = EXPANDER + "/loras/file?name=" + encodeURIComponent(name);
				a.download = String(name).split("/").pop();
				document.body.appendChild(a);
				a.click();
				a.remove();
			} catch (e) { setMsg("导出失败：" + errText(e)); }
		};
		const loraDeleteOne = async (name) => {
			if (!window.confirm("把「" + name + "」移出 LoRA 目录？\n\n会搬进 _trash-<时间戳>，不是硬删；想恢复搬回来就行。")) return;
			setLoraBusy("正在移除 " + name + "…");
			try {
				const r = await fetch(EXPANDER + "/loras/del", {
					method: "POST",
					headers: Object.assign({}, CONSOLE_HEADERS, { "Content-Type": "application/json" }),
					body: JSON.stringify({ name }),
				});
				const j = await r.json();
				if (j && j.ok) {
					setMsg("已移除 " + name + "（在 _trash 里可恢复）");
					setSelLoras((xs) => xs.filter((x) => x.name !== name));
					setConn((c) => c + 1);
				} else setMsg("移除失败：" + ((j && j.error) || ("HTTP " + r.status)));
			} catch (e) { setMsg("移除失败：" + errText(e)); }
			setLoraBusy("");
		};

		/** 双击改名：只改主名，扩展名沿用原文件（防止把 .safetensors 改成别的） */
		/** 内联改名：不用 window.prompt —— Electron / 嵌入 webview 里 prompt 会被直接屏蔽，
		 *  返回 null 就静默失效，看着像「双击没反应」。改成卡片上原地出输入框。 */
		const loraRenameSave = async (name) => {
			const v = String(loraEditText || "").trim();
			const cur = String(name).split("/").pop().replace(/\.(safetensors|pt|ckpt|sft|bin)$/i, "");
			setLoraEditing("");
			if (!v || v === cur) return;
			setLoraBusy("正在改名…");
			try {
				const r = await fetch(EXPANDER + "/loras/rename", {
					method: "POST",
					headers: Object.assign({}, CONSOLE_HEADERS, { "Content-Type": "application/json" }),
					body: JSON.stringify({ name, newName: v }),
				});
				const j = await r.json();
				if (j && j.ok) {
					setMsg(j.unchanged ? "名字没变" : ("已改名 → " + j.name));
					if (j.name && j.name !== name) setSelLoras((xs) => xs.map((x) => (x.name === name ? Object.assign({}, x, { name: j.name }) : x)));
					setConn((c) => c + 1);
				} else setMsg("改名失败：" + ((j && j.error) || ("HTTP " + r.status)));
			} catch (e) { setMsg("改名失败：" + errText(e)); }
			setLoraBusy("");
		};
		/** 拖到分类条上：分类本来就由文件夹位置决定，所以直接挪文件 */
		const loraMoveTo = async (name, grp) => {
			if (!name || !grp) return;
			const folder = String(grp.drop || "");
			setLoraBusy("正在移到「" + grp.label + "」…");
			try {
				const r = await fetch(EXPANDER + "/loras/move", {
					method: "POST",
					headers: Object.assign({}, CONSOLE_HEADERS, { "Content-Type": "application/json" }),
					body: JSON.stringify({ name, folder }),
				});
				const j = await r.json();
				if (j && j.ok) {
					setMsg(j.unchanged ? ("「" + name + "」本来就在「" + grp.label + "」里") : ("已移到「" + grp.label + "」 → " + j.name));
					if (j.name && j.name !== name) setSelLoras((xs) => xs.map((x) => (x.name === name ? Object.assign({}, x, { name: j.name }) : x)));
					setConn((c) => c + 1);
				} else setMsg("移动失败：" + ((j && j.error) || ("HTTP " + r.status)));
			} catch (e) { setMsg("移动失败：" + errText(e)); }
			setLoraBusy("");
		};

		const loraModal = loraOpen
		  ? h("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }, onClick: () => setLoraOpen(false) },
		      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px", width: "min(1120px,95vw)", maxHeight: "88vh", overflow: "auto", background: "var(--c-card)", border: "1px solid rgba(127,127,127,.45)", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 16px 48px rgba(15,23,42,.35)" }, onClick: (e) => e.stopPropagation() },
		        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
		          h("span", { style: { fontWeight: 700, fontSize: "14px" } }, "LoRA 选择"),
		          h("span", { style: { fontSize: "12.5px", color: "var(--c-fg2)" } }, "已选 " + selLoras.length + " / " + loras.length)),
		        h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
		          h("input", { ref: loraFileRef, type: "file", accept: ".safetensors,.pt,.ckpt,.sft,.bin,.zip", style: { display: "none" },
		            onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) loraImportBuf(f); e.target.value = ""; } }),
		          h("button", { style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }), disabled: !!loraBusy,
		            onClick: () => { if (loraFileRef.current) loraFileRef.current.click(); } }, "导入 LoRA"),
		          h("button", { style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }), disabled: !!loraBusy,
		            onClick: () => setLoraUrlOpen((v) => !v) }, loraUrlOpen ? "取消网址导入" : "从网址导入"),
		          h("button", { style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }),
		            title: "在资源管理器里打开 models/loras",
		            onClick: () => { fetch(EXPANDER + "/open", { method: "POST", headers: Object.assign({}, CONSOLE_HEADERS, { "Content-Type": "application/json" }), body: JSON.stringify({ path: "" }) }).catch(() => {}); } }, "打开 loras 文件夹"),
		          loraBusy ? h("span", { style: { fontSize: "12px", color: "var(--c-fg2)" } }, loraBusy) : null),
		        loraUrlOpen
		          ? h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
		              h("input", { style: Object.assign({}, S.inp, { flex: "1 1 auto", fontSize: "12.5px" }), placeholder: "https://…（.safetensors 或 .zip；Civitai 需要 token 的话先登录再复制直链）",
		                value: loraUrl, onChange: (e) => setLoraUrl(e.target.value) }),
		              h("button", { style: Object.assign({}, S.btn, { padding: "4px 12px", fontSize: "12.5px" }), disabled: !loraUrl.trim() || !!loraBusy,
		                onClick: loraImportUrl }, "下载"))
		          : null,
		        (() => {
		          // 分类 + 搜索：分类条沿用一级 tab 的样式 token，网格沿用风格卡的卡片样式
		          const _q = loraQ.trim().toLowerCase();
		          let _groups = loraGroupsOf(loras, loraMeta, USER.cards);
		          if (_q) _groups = _groups.map((g) => Object.assign({}, g, { items: g.items.filter((n) => n.toLowerCase().indexOf(_q) >= 0) })).filter((g) => g.items.length);
		          const _cur = _groups.some((g) => g.key === loraCat) ? loraCat : (_groups[0] ? _groups[0].key : "");
		          const _shown = _groups.find((g) => g.key === _cur);
		          const _total = _groups.reduce((a, g) => a + g.items.length, 0);
		          return h(React.Fragment, null,
		            h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
		              h("input", {
		                style: Object.assign({}, S.inp, { flex: "1 1 auto", fontSize: "12.5px" }),
		                placeholder: "搜索 LoRA 名字（" + _total + " 个）",
		                value: loraQ, onChange: (e) => setLoraQ(e.target.value),
		              }),
		              loraQ ? h("button", { style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }), onClick: () => setLoraQ("") }, "清空") : null),
		            _groups.length
		              ? h("div", { style: { display: "flex", gap: "2px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid rgba(127,127,127,.25)" } },
		                  _groups.map((g) => h("div", {
		                    key: g.key, onClick: () => setLoraCat(g.key),
		                    // 拖到分类上 = 挪进那一组对应的文件夹（分类由文件夹位置决定）
		                    onDragOver: (e) => {
		                      if (!loraDrag) return;
		                      e.preventDefault();
		                      try { e.dataTransfer.dropEffect = "move"; } catch (x) { }
		                      if (loraDropAt !== g.key) setLoraDropAt(g.key);
		                    },
		                    onDragLeave: () => { if (loraDropAt === g.key) setLoraDropAt(""); },
		                    onDrop: (e) => { e.preventDefault(); e.stopPropagation(); setLoraDropAt(""); loraMoveTo(loraDrag, g); },
		                    title: loraDrag ? ("把「" + loraDrag + "」放进「" + g.label + "」") : g.label,
		                    style: Object.assign({}, S.tab, g.key === _cur ? S.tabOn : S.tabOff,
		                      loraDropAt === g.key ? { borderBottomColor: "var(--c-good, #16a34a)", background: "rgba(22,163,74,.14)" } : {}),
		                  }, g.label + " (" + g.items.length + ")")))
		              : null,
		            h("div", Object.assign({ style: Object.assign({}, S.scrollBox, { maxHeight: "44vh", overflowY: "auto", padding: "2px" }) },
		              // 拖 LoRA 文件进这个列表 = 导入（和「导入 LoRA」按钮同一个通道）
		              dropFileProps(["safetensors", "pt", "ckpt", "sft", "bin", "zip"],
		                (good) => { good.forEach((f) => { try { loraImportBuf(f); } catch (e) { setMsg("导入失败：" + errText(e)); } }); },
		                { onReject: (l) => setMsg("拖错了：这里只收 " + l.map((x) => "." + x).join(" / ")),
		                  onEmpty: () => setMsg("拖拽没拿到文件（桌面版常见）：点「导入 LoRA」按钮选") })),
		              _shown
		                ? // width:100% 是关键：外层 S.scrollBox 是 flex，网格当 flex 子项会被内容挤成一列
		                h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(242px, 1fr))", gap: "6px", width: "100%", minWidth: 0 } },
		                    _shown.items.map((Ln) => {
		                      // 横条：一行放完「文件名 · 底模 · 导出 · 删除」，双击改名，拖到分类条换分类
		                      const on = selLoras.some((x) => x.name === Ln);
		                      const meta = loraMeta[Ln] || {};
		                      const baseTxt = String(meta.base || "未知");
		                      const shortNm = String(Ln).split("/").pop().replace(/\.(safetensors|pt|ckpt|sft|bin)$/i, "");
		                      const dragging = loraDrag === Ln;
		                      const editing = loraEditing === Ln;
		                      return h("div", {
		                        key: Ln,
		                        draggable: !editing,
		                        title: editing ? "回车确认 / Esc 取消" : (Ln + "\n底模：" + baseTxt + "\n单击选中 · 双击或右键改名 · 拖到上面的分类条换分类"),
		                        onClick: () => { if (!editing) toggleLora(Ln); },
		                        onDoubleClick: (e) => {
		                          e.preventDefault();
		                          e.stopPropagation();
		                          if (!editing) { setLoraEditText(shortNm); setLoraEditing(Ln); }
		                        },
		                        // 右键同样进改名（顺手压掉浏览器菜单）；右键更好按，也不怕和拖拽抢双击
		                        onContextMenu: (e) => {
		                          e.preventDefault();
		                          e.stopPropagation();
		                          if (!editing) { setLoraEditText(shortNm); setLoraEditing(Ln); }
		                        },
		                        onDragStart: (e) => {
		                          setLoraDrag(Ln);
		                          try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", Ln); } catch (x) { }
		                        },
		                        onDragEnd: () => { setLoraDrag(""); setLoraDropAt(""); },
		                        style: {
		                          height: "32px", borderRadius: "8px", padding: "0 6px 0 9px",
		                          display: "flex", flexDirection: "row", alignItems: "center", gap: "7px",
		                          background: on ? "var(--c-accent-bg)" : "var(--c-panel2)",
		                          border: "1.5px solid " + (on ? "var(--c-accent)" : "var(--c-line)"),
		                          cursor: "grab", opacity: dragging ? .4 : 1,
		                          overflow: "hidden", userSelect: "none", boxSizing: "border-box",
		                        },
		                      },
		                        editing
		                          ? h("input", {
		                            autoFocus: true,
		                            value: loraEditText,
		                            onChange: (e) => setLoraEditText(e.target.value),
		                            onFocus: (e) => { try { e.target.select(); } catch (x) { } },
		                            onClick: (e) => e.stopPropagation(),
		                            onDoubleClick: (e) => e.stopPropagation(),
		                            onContextMenu: (e) => e.stopPropagation(),
		                            onKeyDown: (e) => {
		                              if (e.key === "Enter") { e.preventDefault(); loraEditDone.current = true; loraRenameSave(Ln); }
		                              else if (e.key === "Escape") { e.preventDefault(); loraEditDone.current = true; setLoraEditing(""); }
		                              e.stopPropagation();
		                            },
		                            onBlur: () => {
		                              if (loraEditDone.current) { loraEditDone.current = false; return; }
		                              loraRenameSave(Ln);
		                            },
		                            style: { flex: 1, minWidth: 0, height: "22px", boxSizing: "border-box", padding: "0 5px", borderRadius: "5px", border: "1px solid var(--c-accent)", background: "var(--c-panel)", color: "var(--c-fg)", fontSize: "12px", fontWeight: 600, outline: "none" },
		                          })
		                          : h("span", { style: { fontSize: "12px", fontWeight: 600, lineHeight: 1.2, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: on ? "var(--c-accent-fg)" : "var(--c-fg)" } }, shortNm),
		                        h("span", { style: { fontSize: "9.5px", color: "var(--c-fg5)", flex: "none", maxWidth: "74px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, baseTxt),
		                        h("span", { style: { fontSize: "10px", opacity: .5, cursor: "pointer", flex: "none" }, title: "导出这个 LoRA", onClick: (e) => { e.stopPropagation(); loraExportOne(Ln); } }, "\u2193"),
		                        h("span", { style: { fontSize: "11px", opacity: .5, cursor: "pointer", flex: "none" }, title: "移出 LoRA 目录（搬进 _trash，可恢复）", onClick: (e) => { e.stopPropagation(); loraDeleteOne(Ln); } }, "\u00d7"),
		                      );
		                    }))
		                : h("div", { style: { padding: "28px", textAlign: "center", fontSize: "13px", color: "var(--c-fg3)" } }, loras.length ? "没有匹配的 LoRA" : "还没有 LoRA")),
		          );
		        })(),
		        selLoras.length
		          ? h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
		              selLoras.map((Ln) => h("label", { key: Ln.name, style: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12.5px" } },
		                h("span", { style: { flex: "0 0 200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "13px", color: "var(--c-fg)" } }, Ln.name.replace(/\.safetensors$/, "")),
		                h("input", { type: "number", step: 0.05, value: Ln.model, style: Object.assign({}, S.inp, { width: "76px", fontSize: "13px", color: "var(--c-fg)" }), onChange: (e) => setLoraW(Ln.name, e.target.value) }))))
		          : h("span", { style: { fontSize: "12.5px", color: "var(--c-warn)" } }, "还没选 LoRA"),
		        h("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
		          h("button", { style: S.btn2, onClick: () => { setSelLoras([]); setMsg("已清空 LoRA"); } }, "全部取消"),
		          h("button", { style: S.btn, onClick: () => setLoraOpen(false) }, "完成"))))
		  : null;
		          const promptModal = promptOpen
		            ? (() => {
		                const isPos = promptOpen === "pos";
		                const val = isPos ? pos : neg;
		                const setVal = isPos ? setPos : setNeg;
		                return h("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }, onClick: () => setPromptOpen("") },
		                  h("div", { style: { display: "flex", flexDirection: "column", gap: "10px", width: "min(760px,94vw)", maxHeight: "88vh", overflow: "auto", background: "var(--c-card)", border: "1px solid rgba(127,127,127,.45)", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 16px 48px rgba(15,23,42,.35)" }, onClick: (ev) => ev.stopPropagation() },
		                    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
		                      h("span", { style: { fontWeight: 700, fontSize: "14px" } }, isPos ? "正向提示词" : "负向提示词"),
		                      h("span", { style: S.dim }, (val || "").length + " 字符")),
		                    h("textarea", { style: Object.assign({}, S.ta, { flex: "1 1 auto", height: "48vh", minHeight: "320px", resize: "vertical", overflowY: "scroll", overflowX: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }), value: val, onChange: (ev) => setVal(ev.target.value) }),
		                    h("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } },
		                      h("button", { style: S.btn2, onClick: () => setPromptOpen("") }, "取消"),
		                      h("button", { style: S.btn, onClick: () => setPromptOpen("") }, "完成"))));
		              })()
		            : null;
		          let expandModal = null;
		          if (expandOpen) {
		          	try {
		          		expandModal = h("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 99999 }, onClick: () => { if (!expandBusy) setExpandOpen(false); } },
		          			h("div", { style: { display: "flex", flexDirection: "column", gap: "10px", width: "min(820px,94vw)", minHeight: "320px", maxHeight: "90vh", overflow: "auto", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 16px 48px rgba(0,0,0,.25)" }, onClick: (ev) => ev.stopPropagation() },
		          				h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
		          					h("span", { style: { fontWeight: 700, fontSize: "14px", color: "var(--c-fg)" } }, "AI 扩写"),
		          					h("span", { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
		          						h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "模型"),
		          						h("select", { style: Object.assign({}, { fontSize: "12px", padding: "3px 6px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.25)", background: "var(--c-card)", color: "var(--c-fg)", maxWidth: "250px" }), value: expRoute, onChange: (ev) => pickRoute(ev.target.value) }, expRouteOptions.length ? expRouteOptions : h("option", { value: "" }, "（正在获取模型列表…）")),
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12px", padding: "2px 8px" }), onClick: () => loadRoutes(true) }, "刷新"),
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12px", padding: "2px 8px" }), onClick: () => { setApiOpen(!apiOpen); setApiErr(""); } }, apiOpen ? "收起" : "+ API"))),
		          				h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" } },
		          					h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, expandBusy ? "请求中…" : (expandRan ? (expandMeta || "已生成，满意再套用") : "还没开始 · 点左下「开始扩写」")),
		          					LAST_TAB_INFO ? h("span", { style: { fontSize: "11px", color: "var(--c-fg5)", marginLeft: "auto", whiteSpace: "nowrap" } }, "诊断 " + LAST_TAB_INFO + " · ") : null,
		          					h("span", { style: { fontSize: "11px", color: "var(--c-fg5)" } }, "v1022 · 路线 " + expRoutes.length + " 条 · 本地 " + expRoutes.filter((r) => r.kind === "local").length + " 个")),
expRoutes.filter((r) => r.kind === "local").length === 0
	? h("div", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "var(--c-warn)", background: "var(--c-warn-bg)", border: "1px solid rgba(180,83,9,.25)", borderRadius: "6px", padding: "6px 8px" } },
		h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
			h("span", null, "没发现本地模型：可一键启动本机 llama.cpp 服务；或先开 Ollama(:11434) / LM Studio(:1234) 再点「刷新」；也可用「+ API」直接填地址。" + (expProbe.filter((p) => p.open).length ? " 已开端口：" + expProbe.filter((p) => p.open).map((p) => p.base.replace(/^https?:\/\//, "") + "(" + p.models + "个模型)").join("、") : " 已探测 " + expProbe.length + " 个常见端口，都没在上。")),
			h("button", { style: Object.assign({}, S.btn2, { fontSize: "12px", whiteSpace: "nowrap" }), disabled: localBusy, onClick: () => startLocalLLM() }, localBusy ? "启动中…（首次加载 2~5 秒）" : "启动本机模型")),
		localSt && localSt.dir ? h("span", { style: { fontSize: "11px", color: "var(--c-warn2)" } }, "本机服务：" + localSt.dir + (localSt.running ? "（已在运行）" : (localSt.serverExists ? "（未运行）" : "（未安装）")) + (localSt.available && localSt.available.length ? " · 磁盘上 " + localSt.available.length + " 个 gguf：" + localSt.available.map((m) => m.id).join(" / ") : " · 没找到 gguf")) : null)
	: null,
		          				apiOpen ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "6px", background: "var(--c-panel)", border: "1px solid rgba(var(--c-ink-rgb),.12)", borderRadius: "8px", padding: "8px" } },
		          					h("input", { style: Object.assign({}, { fontSize: "12px", padding: "3px 6px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.25)", background: "var(--c-card)", color: "var(--c-fg)", minWidth: 0 }), placeholder: "名称（可空）", value: apiForm.name, onChange: (ev) => setApiForm(Object.assign({}, apiForm, { name: ev.target.value })) }),
		          					h("input", { style: Object.assign({}, { fontSize: "12px", padding: "3px 6px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.25)", background: "var(--c-card)", color: "var(--c-fg)", minWidth: 0 }), placeholder: "Base URL，如 http://127.0.0.1:11434/v1", value: apiForm.base, onChange: (ev) => setApiForm(Object.assign({}, apiForm, { base: ev.target.value })) }),
		          					h("input", { style: Object.assign({}, { fontSize: "12px", padding: "3px 6px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.25)", background: "var(--c-card)", color: "var(--c-fg)", minWidth: 0 }), placeholder: "API Key（本地模型可空）", value: apiForm.key, onChange: (ev) => setApiForm(Object.assign({}, apiForm, { key: ev.target.value })) }),
		          					h("input", { style: Object.assign({}, { fontSize: "12px", padding: "3px 6px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.25)", background: "var(--c-card)", color: "var(--c-fg)", minWidth: 0 }), placeholder: "模型名，如 qwen2.5:7b / deepseek-chat", value: apiForm.model, onChange: (ev) => setApiForm(Object.assign({}, apiForm, { model: ev.target.value })) }),
		          					h("div", { style: { display: "flex", gap: "8px", alignItems: "center", gridColumn: "1 / -1", flexWrap: "wrap" } },
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12px", padding: "2px 8px" }), disabled: apiBusy, onClick: () => addApiRoute() }, apiBusy ? "保存中…" : "保存"),
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12px", padding: "2px 8px" }), onClick: () => { setApiOpen(false); setApiErr(""); } }, "取消"),
		          						apiErr ? h("span", { style: { fontSize: "12px", color: "var(--c-bad)" } }, apiErr) : null)) : null,
		          				expRouteErr ? h("div", { style: { fontSize: "12.5px", color: "var(--c-warn)" } }, expRouteErr) : null,
		          				expandErr ? h("div", { style: { fontSize: "12.5px", color: "var(--c-bad)", background: "var(--c-bad-bg)", border: "1px solid rgba(185,28,28,.25)", borderRadius: "6px", padding: "6px 8px", whiteSpace: "pre-wrap" } }, expandErr) : null,
		          				h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, expandRan ? "正向（结果：原标签保留、自造镜头词已删，可改）" : "正向（当前输入，可先改再扩写）"),
		          				h("textarea", { style: Object.assign({}, S.ta, { flex: "0 0 auto", height: "180px", minHeight: "180px", resize: "vertical", overflowY: "scroll", overflowX: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }), value: expandPos, onChange: (ev) => setExpandPos(ev.target.value) }),
		          				h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, expandRan ? "负向（结果：与你原有负向合并去重，可改）" : "负向（当前输入）"),
		          				h("textarea", { style: Object.assign({}, S.ta, { flex: "0 0 auto", height: "110px", minHeight: "110px", resize: "vertical", overflowY: "scroll", overflowX: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }), value: expandNeg, onChange: (ev) => setExpandNeg(ev.target.value) }),
		          				h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
		          					h("button", { style: Object.assign({}, S.btn, { fontSize: "13px", minWidth: "96px" }), disabled: expandBusy, onClick: () => (expandRan ? runExpand() : startExpand()) }, expandBusy ? "扩写中…" : (expandRan ? "再扩一次" : "开始扩写")),
		          					h("span", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12.5px" }), onClick: () => setExpandOpen(false) }, "取消"),
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12.5px" }), disabled: !expandRan || !expandPos, onClick: () => applyExpand("pos") }, "只套正向"),
		          						h("button", { style: Object.assign({}, S.btn2, { fontSize: "12.5px" }), disabled: !expandRan || !expandNeg, onClick: () => applyExpand("neg") }, "只套负向"),
		          						h("button", { style: S.btn, disabled: !expandRan || !expandPos, onClick: () => applyExpand("both") }, "两个都套用"))))
		          		);
		          	} catch (e) {
		          		expandModal = h("div", { style: { position: "fixed", inset: 0, zIndex: 99999, background: "var(--c-card)", color: "var(--c-bad)", padding: "18px", fontSize: "13px", whiteSpace: "pre-wrap" } }, "扩写弹窗渲染出错：" + (e && e.message ? e.message : String(e)));
		          	}
		          }
		const timeHintText = () => {
			const j = job;
			if (!j || !j.startedAt) return "画布出图展示 · 本机生成约 20~40 秒";
			const endAt = (j.status === "done" && j.doneAt) ? j.doneAt : Date.now();
			const sec = Math.max(0, Math.round((endAt - j.startedAt) / 1000));
			if (j.status === "submitting") return "提交中 · 已 " + sec + " 秒";
			if (j.status === "running") return "生成中 · 已 " + sec + " 秒";
			if (j.status === "done") {
				const d = new Date(j.doneAt || Date.now());
				const p2 = (n) => ("0" + n).slice(-2);
				return "出图 " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) + " · 耗时 " + sec + " 秒";
			}
			if (j.status === "error") return "失败 · 用时 " + sec + " 秒";
			return "画布出图展示 · 本机生成约 20~40 秒";
		};
		return h(React.Fragment, null,
		  h("div", { className: "cfy-grid", style: grid },
		  // ① 左上：画布出图展示

		  			  h("div", { className: "cfy-left", style: { display: "flex", flexDirection: "column", gap: "10px", minWidth: 0, minHeight: 0 } },
h("div", { className: "cfy-canvas", style: Object.assign({}, box, gpos("1", "1"), { position: "relative", height: tiny ? "32vh" : (narrow ? "36vh" : "42vh"), flex: "0 0 auto", alignItems: "stretch", justifyContent: "flex-start", gap: "8px", minHeight: 0, overflow: "hidden", background: "repeating-conic-gradient(rgba(127,127,127,.07) 0% 25%, rgba(0,0,0,0) 0% 50%) 50% / 24px 24px" }) },
		  	h("div", { style: { position: "relative", flex: "1 1 auto", minHeight: 0, maxHeight: "100%", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", overflow: "hidden", position: "relative" } },
			  	h("span", { style: { position: "absolute", top: "6px", left: "8px", fontSize: "11.5px", color: "var(--c-fg4)", background: "rgba(255,255,255,.86)", border: "1px solid rgba(var(--c-ink-rgb),.10)", borderRadius: "4px", padding: "1px 6px", pointerEvents: "none", zIndex: 2, whiteSpace: "nowrap" } }, timeHintText()),
		  		(job && job.image)
		  			? h("img", { src: job.image, style: { position: "absolute", inset: 0, margin: "auto", maxWidth: "calc(100% - 10px)", maxHeight: "calc(100% - 10px)", width: "auto", height: "auto", objectFit: "contain", display: "block", borderRadius: "6px" } })
		  			: h("span", { style: S.dim }, (job && job.status === "running") ? "正在出图…" : "画布出图展示 —— 点右下「生成」"),
		  		(job && job.status === "running") ? h("span", { style: S.warn }, "生成中：" + (job.message || job.progress || job.status || "")) : null,
		  		)),
		  	h("div", { style: Object.assign({}, gpos("1", "2"), { alignSelf: "stretch", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap", flexShrink: 0, minWidth: 0 }) },
		  		h("label", { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: "0 1 auto" } },
		  			h("span", { style: Object.assign({}, S.label, { whiteSpace: "nowrap" }) }, "文件名前缀"),
		  			h("input", { style: Object.assign({}, S.inp, { width: "104px", minWidth: 0, flex: "0 1 auto" }), value: prefix, onChange: (e) => setPrefix(e.target.value) })),
		  		h("button", { style: S.btn, onClick: doGen }, "生成"),
              h("button", { style: Object.assign({}, S.btn2, { borderColor: "rgba(220,120,120,.55)" }), onClick: doCancel, title: "中断当前生成并清空队列" }, "取消"),
		  		h("button", { style: S.btn2, onClick: () => setTab("pv-online"), title: "打开模型库（在线模型浏览与下载）" }, "模型库"),
		  		h("button", { style: S.btn2, onClick: () => {
		  			if (OPEN_CONN_SINK) { OPEN_CONN_SINK(); return; }
		  			// 兜底：PreviewConsole 还没挂过就先切到历史页，下一帧再开
		  			setTab("pv-output");
		  			setTimeout(() => { try { OPEN_CONN_SINK && OPEN_CONN_SINK(); } catch (e) {} }, 60);
		  		}, title: "ComfyUI 连接与启动设置（端口 / 启动文件路径）" }, "连接设置"),
		  		(job && job.image)
		  			? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0 } },
		  					h("button", { style: CARD_BTN_ACCENT, onClick: () => openInExplorer(job.image), title: "在资源管理器里选中这张图" }, "打开文件所在位置"),
		  					h("button", { style: CARD_BTN, onClick: () => saveCurrent(false), title: "复制一份到你设定的复制位置" }, "存到保存位置"),
		  					h("button", { style: CARD_BTN, onClick: () => { BG.clear(); setMsg("已清空出图结果"); }, title: "把这张图和进度一起清掉" }, "清空"))
		  			: null,
		  		h("button", { style: Object.assign({}, S.btn2, { borderColor: "rgba(220,120,120,.55)", flexShrink: 0 }), onClick: doClearAll, title: "一次性清空：提示词 / LoRA 链 / 身份控制（LLLite 条件图）/ 特征锁 / 画布旧图，并解除所有已插入的卡" }, "全部清空")),

		  // ②b 白话 → 提示词（画布与正负提示词之间；DOM 放在底模卡前，窄屏顺序更顺）
          h("div", { style: Object.assign({}, box, gpos("1", "3"), { gap: "6px", alignSelf: "stretch", width: "100%", display: zoneMode === "custom" ? "none" : undefined }) },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              h("span", { style: hd }, "白话 → 提示词"),
              h("span", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } },
                h("span", { style: S.label }, "模型"),
                h("select", {
                  style: Object.assign({}, S.inp, { width: "auto", minWidth: "118px", maxWidth: "190px", padding: "3px 6px" }),
                  value: expRoute,
                  title: "路线：云端 DeepSeek / 本地 llama / 自定义 OpenAI 兼容",
                  onChange: (e) => { const v = e.target.value; setExpRoute(v); try { localStorage.setItem("expRoute", v); } catch (x) { } loadModels(v); },
                }, (expRoutes.length ? expRoutes : [{ id: "", name: "自动" }]).map((r) => h("option", { key: r.id || r.name, value: r.id || "", disabled: !!r.error }, (r.name || r.id) + (r.error ? "（不可用）" : "")))),
                h("select", {
                  style: Object.assign({}, S.inp, { width: "auto", minWidth: "130px", maxWidth: "210px", padding: "3px 6px" }),
                  value: expModel,
                  title: "具体模型（不选 = 该路线的默认模型）",
                  onChange: (e) => { const v = e.target.value; setExpModel(v); try { localStorage.setItem("expModel", v); } catch (x) { } },
                }, [{ id: "", name: "默认模型" }].concat(nlModels).map((m) => h("option", { key: m.id || m.name, value: m.id || "" }, m.name || m.id))),
                h("button", { style: S.btn, onClick: nlConvert, disabled: nlBusy }, nlBusy ? "转换中…" : "AI 转换"),
                h("button", { style: S.btn2, onClick: nlRuleOnly, title: "不联网：只用词库 + 内置补词表匹配" }, "离线规则"))),
            h("textarea", {
              style: Object.assign({}, S.ta, { minHeight: "52px", maxHeight: "112px", height: "52px", resize: "vertical" }),
              rows: 2,
              value: nlText,
              placeholder: "用中文说人话：放学后的教室，夕阳斜照，她坐在窗边侧头看外面",
              onChange: (e) => setNlText(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); nlConvert(); } },
            }),
            h("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
              h("label", { style: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--c-fg2)" } },
                h("input", { type: "checkbox", checked: nlAppend, onChange: (e) => { setNlAppend(e.target.checked); try { localStorage.setItem("nlAppend", e.target.checked ? "1" : "0"); } catch (x) { } } }), "追加到正向（不勾 = 替换）"),
              nlInfo ? h("span", { style: S.dim }, nlInfo) : null,
              nlMsg ? h("span", { style: { fontSize: "12px", color: "var(--c-warn)", wordBreak: "break-all" } }, nlMsg) : null)),
		  // ② 右上：底模 / 编码器 / LoRA
		  		  		  // ③b 胶囊提示词面板：切换后取代「白话 → 提示词」+「正负提示词」两块
		  zoneMode === "custom"
		    ? h("div", { style: Object.assign({}, box, gpos("1", "3 / 6"), { gap: narrow ? "6px" : "8px", flex: narrow ? "0 0 auto" : "1 1 auto", alignSelf: "stretch", width: "100%", minHeight: narrow ? "0px" : "260px", overflow: "hidden" }) },
		        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
		          h("span", { style: hd, title: "面板宽 " + rW + "px · " + (tiny ? "tiny<460" : (narrow ? "narrow<640" : (mid ? "mid<980" : "wide≥980"))) }, "胶囊提示词"),
		          h("span", { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
		            h("button", {
		              style: Object.assign({}, S.btn2, { borderStyle: "dashed" }),
		              title: "回到文本框视图（内容和这里完全一致）",
		              onClick: () => setZoneMode("prompt"),
		            }, "◂ 文本框视图"),
		            h("button", {
		              style: Object.assign({}, S.btn2, { borderStyle: "dashed" }),
		              title: "在大窗口里看全部胶囊（同一份数据，增删改立刻同步）",
		              onClick: () => setCapOpen(true),
		            }, "展开 ▸"))),
		        h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)", lineHeight: 1.6 } },
		          "同一份提示词的另一种看法：这里加的词直接写进生成页的正/负提示词框，切回文本框看到的就是它。"),
		        prAdderRow,
		        h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 auto", minHeight: "0", maxHeight: narrow ? "none" : "clamp(190px, 34vh, 420px)", overflowY: "auto", overflowX: "hidden" } },
		          prRow("pos", "正向", "var(--c-accent-bg2)"),
		          prRow("neg", "负面", "var(--c-bad-bg)")),
		        h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)", marginTop: "auto" } },
		          "两栏都空的时候，先切回提示词写几个词，再切过来看胶囊。"))
		    : null,
h("div", { style: Object.assign({}, box, gpos("1", "4"), { alignSelf: "stretch", width: "100%", display: zoneMode === "custom" ? "none" : undefined }) },
				    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
				      h("span", { style: hd }, "正负提示词"),
		      h("span", { style: { display: "flex", gap: "6px", alignItems: "center" } },
		          h("button", { style: S.btn2, onClick: doExpand }, "AI 扩写"),
		          h("button", { style: S.btn2, onClick: doClearAll, title: "清空提示词 / LoRA / 身份控制 / LLLite 条件图（有插入的卡会先问一次）" }, "清空"),
		          h("button", {
		            style: Object.assign({}, S.btn2, { borderStyle: "dashed" }),
		            title: "同一份提示词，换成胶囊视图（内容实时同步，不是另一份数据）",
		            onClick: () => setZoneMode("custom"),
		          }, "胶囊视图 ▸"))),
		      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
		          h("span", { style: S.label }, "正向"),
		          h("button", { style: Object.assign({}, S.btn2, { padding: "1px 8px", fontSize: "11.5px" }), title: "单独展开正向提示词", onClick: () => setPromptOpen("pos") }, "展开")),
		      h("textarea", { rows: taRows(pos), style: Object.assign({}, S.ta, { flex: "0 0 auto", minHeight: "0", resize: "vertical", overflowY: "scroll", overflowX: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }), value: pos, onChange: (e) => setPos(e.target.value) }),
		      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
		          h("span", { style: S.label }, "负向"),
		          h("button", { style: Object.assign({}, S.btn2, { padding: "1px 8px", fontSize: "11.5px" }), title: "单独展开负向提示词", onClick: () => setPromptOpen("neg") }, "展开")),
		      h("textarea", { rows: taRows(neg), style: Object.assign({}, S.ta, { flex: "0 0 auto", minHeight: "0", resize: "vertical", overflowY: "scroll", overflowX: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }), value: neg, onChange: (e) => setNeg(e.target.value) })),



		  // ⑤ 底部横跨：出图存放（落地位置 + 可选复制）
		  h("div", { style: Object.assign({}, box, gpos("1 / -1", zoneMode === "custom" && !narrow ? "6" : "5"), { gap: "6px" }) },
		    h("div", { style: S.row },
		      h("span", { style: Object.assign({}, S.label, { alignSelf: "center", minWidth: "88px" }) }, "出图落地位置"),
		      h("input", { style: Object.assign({}, S.inp, { flex: "1 1 300px" }), value: outDraft, placeholder: "例如 D:\\出图\\我的项目", onChange: (e) => setOutDraft(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") applyOutDir(); } }),
		      h("button", { style: S.btn, onClick: applyOutDir, title: "设为 ComfyUI 的实际输出目录（--output-directory）" }, "设为落地位置"),
		      h("button", { style: S.btn2, onClick: restartComfy, title: "停掉再拉起 ComfyUI，约 20~60 秒" }, "重启 ComfyUI")),
		    h("span", { style: S.dim }, "新图直接写到：" + (outDir || "未设置") + "（改完要点「重启 ComfyUI」才生效）"),
		    h("div", { style: S.row },
		      h("span", { style: Object.assign({}, S.label, { alignSelf: "center", minWidth: "88px" }) }, "另外复制一份"),
		      h("input", { style: Object.assign({}, S.inp, { flex: "1 1 300px" }), value: saveDraft, placeholder: "可选：另存一份的文件夹", onChange: (e) => setSaveDraft(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") applySaveDir(); } }),
		      h("button", { style: S.btn, onClick: applySaveDir, title: "记住这个文件夹（写进 config.json）" }, "设为复制位置"),
		      saveDir ? h("button", { style: S.btn2, onClick: () => saveCurrent(false) }, "把当前图存过去") : null),
		    h("span", { style: S.dim }, saveDir ? ("复制到：" + saveDir + " · 每出一张图自动复制一份，原图仍留在落地位置") : "未设置。可选：每出一张图再复制一份到别处")),
	  		  ),
h("div", { style: narrow
		      ? { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }
		      : { alignSelf: "stretch", alignContent: "flex-start", position: "sticky", top: 0, zIndex: 2, display: "flex", flexDirection: "column", gap: "8px", minHeight: 0, minWidth: 0, background: "var(--c-card)" } },
		    h("div", { style: Object.assign({}, box, { minWidth: 0, flex: "1 1 auto" }) },
		    		    h("span", { style: hd }, "底模 / 编码器 / LoRA"),
		    		    h("div", { style: Object.assign({}, S.field, { gap: "6px" }) },
		    		    	h("span", { style: S.label }, isAnima ? "底模（Diffusion · Anima）" : "底模（Checkpoint）"),
		    		    	h("button", { type: "button", "aria-label": "选择底模",
		    		    		title: ckpt ? ("当前底模：" + ckpt + "；点击打开模型库更换") : "点击打开模型库选择底模",
		    		    		style: { display: "flex", alignItems: "center", gap: "8px", width: "100%", minWidth: 0, boxSizing: "border-box",
		    		    			padding: "5px 8px 5px 5px", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit",
		    		    			border: "1px solid " + (modelBad ? "var(--c-bad)" : "rgba(127,127,127,.32)"),
		    		    			borderRadius: "8px", background: "rgba(127,127,127,.06)" },
		    		    		onClick: () => {
		    		    			// 走 A 线模型库：弹窗经 portal 到 body，pvhost 收起时也看得见；
		    		    			// 在里面点「使用」选中 checkpoint，名字再由 MODEL_PICKED_SINK 回到这里。
		    		    			if (typeof OPEN_MODEL_PICKER_SINK === "function") OPEN_MODEL_PICKER_SINK("checkpoint", ckpt);
		    		    			else setTab("pv-online");
		    		    		} },
		    		    		h(LocalCkptThumb, { kind: "checkpoint", name: ckpt, width: 40, height: 52 }),
		    		    		h("span", { style: { display: "flex", flexDirection: "column", gap: "1px", minWidth: 0, flex: "1 1 auto", overflow: "hidden" } },
		    		    			h("strong", { title: ckpt, style: { fontSize: "12.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, shortLora(ckpt) || "选择底模"),
		    		    			h("small", { title: ckpt, style: { fontSize: "11px", opacity: .62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ckpt || "点击打开模型库")))),
		    		    modelBad ? h("div", { style: { fontSize: "11.5px", lineHeight: 1.45, color: "var(--c-bad)" } },
		    		    	isAnima
		    		    		? "「" + ckpt + "」在 checkpoints 里，不是 Anima 底模。编码器类型 qwen_image 要 diffusion_models 的模型，否则 ComfyUI 会退 400。"
		    		    		: "「" + ckpt + "」不在 checkpoints 里；编码器类型不是 qwen_image 时只能走 checkpoint 底模。") : null,
		    		    h("label", { style: S.field }, h("span", { style: S.label }, "文本编码器"), h("select", { style: Object.assign({}, S.sel, { width: "100%" }), value: clip, onChange: (e) => setClip(e.target.value) },
		    		    	h("option", { value: "" }, "（跟随底模内置 CLIP）"), opt(clips, clip))),
		    		    h("label", { style: S.field }, h("span", { style: S.label }, "编码器类型"), h("select", { style: Object.assign({}, S.sel, { width: "100%" }), value: clipType, onChange: (e) => {
		    		    	const v = e.target.value;
		    		    	setClipType(v);
		    		    	const next = pickModelFor(v);
		    		    	if (next) setCkpt(next);
		    		    } }, opt(clipTypes, clipType))),
		    		    h("label", { style: S.field }, h("span", { style: S.label }, "VAE"), h("select", { style: Object.assign({}, S.sel, { width: "100%" }), value: vae, onChange: (e) => setVae(e.target.value) },
		    		    	h("option", { value: "" }, "（跟随底模内置 VAE）"), opt(vaes, vae))),
		    		    h("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "auto", flexWrap: "wrap" } },
		    		    	h("span", { style: Object.assign({}, S.label, { fontSize: "12.5px" }), title: "点右边按钮弹出二级菜单" }, "LoRA"),
		    		    	selLoras.length
		    		    		? selLoras.map((x) => h("span", { key: x.name, style: { display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(90,160,235,.22)", border: "1px solid rgba(90,160,235,.55)", borderRadius: "6px", padding: "2px 7px", fontSize: "12px", color: "var(--c-fg)", whiteSpace: "nowrap" } },
		    		    				x.name.replace(/\.safetensors$/, ""),
		    		    				h("b", { style: { fontWeight: 600, color: "var(--c-accent)" } }, Number(x.model).toFixed(2))))
		    		    		: h("span", { style: { fontSize: "12.5px", color: "var(--c-warn)" } }, "未选"),
		    		    	h("button", { style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }), onClick: () => setLoraOpen(true), title: "打开 LoRA 二级菜单" }, "选择（" + selLoras.length + "/" + loras.length + "）"))),
		    h("div", { style: Object.assign({}, box, { minWidth: 0, flex: "0 0 auto" }) },
		    		    h("span", { style: Object.assign({}, hd, { flexShrink: 0 }) }, "图片的高宽 / 参数"),
		    		    h("div", { ref: pRef, style: { display: "grid", gridTemplateColumns: pCols2 === 1 ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "start", flexShrink: 0, minHeight: 0 } },
		    		      // 宽/高/对调：这套排布取自工作台（cc-size-row），但它的 CSS 挂着 .dsh-comfy-ui 祖先，
		    		      // 本地生成页没有那个类，所以栅格写死在内联 style 里，别删。
		    		      h("div", { className: "cc-size-row", style: { gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "minmax(0,118px) minmax(0,118px) 32px", gap: "7px", alignItems: "end", justifyContent: "start" } },
		    		        h("label", { style: Object.assign({}, S.field, { minWidth: 0, overflow: "hidden" }) }, h("span", { style: S.label }, "宽"), h("input", { type: "number", min: 8, step: 8, value: w, style: Object.assign({}, S.inp, { width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }), onChange: (e) => { setSizePick(""); setW(e.target.value); } })),
		    		        h("label", { style: Object.assign({}, S.field, { minWidth: 0, overflow: "hidden" }) }, h("span", { style: S.label }, "高"), h("input", { type: "number", min: 8, step: 8, value: hh, style: Object.assign({}, S.inp, { width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }), onChange: (e) => { setSizePick(""); setHh(e.target.value); } })),
		    		        h("button", { type: "button", className: "cc-icon-button", style: Object.assign({}, S.btn2, { padding: 0, height: "32px", width: "32px", minWidth: "32px" }), title: "对调宽高", "aria-label": "对调宽高", onClick: () => { const _a = w, _b = hh; setSizePick(""); setW(_b); setHh(_a); } }, h(PromptIcon, { name: "swapSize", size: 15 }))),
		    		      // 倍率单独一行，限制宽度，别和宽高抢同一排
		    		      h("div", { style: { gridColumn: "1 / -1", display: "flex", alignItems: "flex-end", justifyContent: "start" } },
		    		        h("div", { style: Object.assign({}, S.field, { width: "150px", maxWidth: "150px", minWidth: 0, overflow: "hidden", flex: "0 0 auto" }) }, h("span", { style: S.label, title: "最终出图 = 宽高 × 倍率（按 8 对齐）" }, "倍率"), h(DraggableNumberInput, { value: sizeMultiplier, onChange: setSizeMultiplier, min: .25, max: 4, step: .01, precision: 2, dragPerPixel: 1 / 300, label: "尺寸倍率", decreaseLabel: "减小尺寸倍率", increaseLabel: "增大尺寸倍率", className: "cc-size-multiplier" }))),
		    		      num("步数", steps, setSteps), num("CFG", cfg, setCfg, 0.1)),
		    		    // 常用尺寸：收成一个按钮，点开二级菜单（0.7.119；原来一排按钮太占宽）
		    		    h("div", { style: { position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "2px" } },
		    		      h("button", {
		    		        type: "button",
		    		        style: Object.assign({}, S.btn2, { padding: "3px 10px", fontSize: "12px", minWidth: "160px", display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }, sizePick ? { borderColor: "var(--c-accent)", color: "var(--c-accent-fg)" } : null),
		    		        title: "常用尺寸：点开选一档（再选同一档=取消）",
		    		        "aria-expanded": !!sizeMenuOpen,
		    		        onClick: () => setSizeMenuOpen((x) => !x),
		    		      },
		    		        h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "常用尺寸" + (sizePick ? " · " + sizePick : "")),
		    		        h("span", { style: { opacity: .6, flexShrink: 0 } }, sizeMenuOpen ? "▴" : "▾")),
		    		      sizePick
		    		        ? h("button", {
		    		            type: "button",
		    		            style: Object.assign({}, S.btn2, { padding: "2px 9px", fontSize: "11.5px" }),
		    		            title: "取消当前档，宽高还原到套用前",
		    		            onClick: () => {
		    		              const _p0 = sizePrev.current;
		    		              const _nm = sizePick;
		    		              sizePrev.current = null;
		    		              setSizePick("");
		    		              if (_p0) { setW(_p0.w); setHh(_p0.h); setMsg("已取消「" + _nm + "」，宽高还原 " + _p0.w + "×" + _p0.h); }
		    		              else setMsg("已取消「" + _nm + "」（宽高不变，只是不再高亮）");
		    		            },
		    		          }, "取消")
		    		        : null,
		    		      sizeMenuOpen
		    		        ? [h("div", { key: "size-menu-mask", style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, background: "transparent" }, onClick: () => setSizeMenuOpen(false) }),
		    		          h("div", {
		    		            key: "size-menu",
		    		            style: { position: "absolute", top: "100%", left: 0, zIndex: 60, marginTop: "4px", background: "var(--c-panel)", border: "1px solid var(--c-line)", borderRadius: "8px", padding: "6px", display: "grid", gridTemplateColumns: pCols2 === 1 ? "1fr" : "repeat(2, minmax(0,1fr))", gap: "4px", minWidth: "270px", boxShadow: "0 10px 26px rgba(0,0,0,.38)", maxHeight: "280px", overflowY: "auto" },
		    		          },
		    		          RES_PRESETS.map((r) => {
		    		            const on = (sizePick === r[0]);
		    		            return h("button", {
		    		              key: r[0],
		    		              type: "button",
		    		              style: Object.assign({}, S.btn2, { padding: "4px 8px", fontSize: "11.5px", textAlign: "left", whiteSpace: "nowrap" }, on ? { borderColor: "var(--c-accent)", background: "var(--c-accent-bg)", color: "var(--c-accent-fg)" } : null),
		    		              title: r[0] + " · " + r[1] + "×" + r[2] + (on ? "（当前，再点一次取消）" : "点一下套用"),
		    		              onClick: () => {
		    		                if (on) {
		    		                  const _p0 = sizePrev.current;
		    		                  sizePrev.current = null;
		    		                  setSizePick("");
		    		                  if (_p0) { setW(_p0.w); setHh(_p0.h); setMsg("已取消「" + r[0] + "」，宽高还原 " + _p0.w + "×" + _p0.h); }
		    		                  else setMsg("已取消「" + r[0] + "」（宽高不变，只是不再高亮）");
		    		                  return;
		    		                }
		    		                sizePrev.current = { w: w, hh: hh };
		    		                setSizePick(r[0]);
		    		                setW(r[1]); setHh(r[2]);
		    		                setSizeMenuOpen(false);
		    		                setMsg("已套用「" + r[0] + "」 " + r[1] + "×" + r[2]);
		    		              },
		    		            }, r[0] + "  " + r[1] + "×" + r[2]);
		    		          }))]
		    		        : null),
		    		    h("div", { style: { display: "grid", gridTemplateColumns: pCols2 === 1 ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "start", flexShrink: 0, minHeight: 0 } },
		    		      // 采样器/调度器换成工作台那个可搜索下拉（采样器动辄几十个，原生 select 翻起来太慢）
		    		      h("div", { style: S.field }, h("span", { style: S.label }, "采样器"), h(SelectMenu, { theme, label: "采样器", options: samplers, value: sampler, onChange: setSampler, minWidth: 0, forceSearch: true })),
		    		      h("div", { style: S.field }, h("span", { style: S.label }, "调度器"), h(SelectMenu, { theme, label: "调度器", options: schedulers, value: scheduler, onChange: setScheduler, minWidth: 0, forceSearch: true }))),
		    		    // 出图后放大：低分辨率出图 + 4x 放大，比 4K 直出快 20 倍且不出多头
		    		    h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "2px" } },
		    		      h("label", { style: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12.5px", cursor: "pointer" } },
		    		        h("input", { type: "checkbox", checked: !!upscale, onChange: (e) => setUpscale(e.target.checked) }),
		    		        "出图后放大"),
		    		      upscale
		    		        ? h("select", {
		    		            style: Object.assign({}, S.sel, { minWidth: "170px", fontSize: "12px", padding: "3px 6px" }),
		    		            value: upscaleModel, onChange: (e) => setUpscaleModel(e.target.value),
		    		          }, opt(upscalers, upscaleModel))
		    		        : null,
		    		      upscale
		    		        ? h("select", {
		    		            style: Object.assign({}, S.sel, { minWidth: "70px", fontSize: "12px", padding: "3px 6px" }),
		    		            value: String(upscaleFactor), onChange: (e) => setUpscaleFactor(Number(e.target.value)),
		    		          }, [2, 3, 4].map((f) => h("option", { key: f, value: String(f) }, f + "x")))
		    		        : null,
		    		      upscale && !upscalers.length
		    		        ? h("span", { style: S.warn }, "没找到放大模型：确认 ComfyUI 的 upscale_models 目录里有 .pth / .safetensors")
		    		        : null,
		    		      upscale && upscaleModel
		    		        ? h("span", { style: S.dim }, "成品 " + Math.round(imageSizeScaled(w, hh, sizeMultiplier, 8).w * (Number(upscaleFactor) || 4) / 4 * 4) + "×" + Math.round(imageSizeScaled(w, hh, sizeMultiplier, 8).h * (Number(upscaleFactor) || 4) / 4 * 4))
		    		        : null),
		    		    // 视角三档 + 种子：一条控制带
		    		    h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "9px", marginTop: "2px" } },
		    		      h("span", { style: Object.assign({}, S.label, { minWidth: "auto" }) }, "视角"),
		    		      h("div", { style: S.seg },
		    		        (typeof VIEWS !== 'undefined' ? VIEWS : []).map((v, i, arr) => h("button", {
		    		          key: v.key,
		    		          title: (v.hint || "") + (viewKey === v.key ? "（再点一次取消视角）" : "（点一下切换视角）"),
		    		          style: Object.assign({}, S.segItem, viewKey === v.key ? S.segOn : null,
		    		            i === arr.length - 1 ? { borderRight: "none" } : null),
		    		          onClick: () => switchView(v.key),
		    		        }, v.label)))),
		    		    // 种子：换成工作台那套 Seed + Seed 变化（0.7.123）
		    		    h("div", { style: { display: "grid", gridTemplateColumns: pCols2 === 1 ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "end", marginTop: "2px" } },
		    		      h("div", { style: S.field }, h("span", { style: S.label, title: "填 0 配「锁定」= 每次随机" }, "Seed"), h("input", { type: "number", min: 0, step: 1, value: seed, style: Object.assign({}, S.inp, { width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }), onChange: (e) => setSeed(e.target.value) })),
		    		      h("div", { style: S.field }, h("span", { style: S.label, title: "锁定=复用这个种子；递增/递减=每次生成后 ±1；随机=每次换" }, "Seed 变化"), h(SelectMenu, { theme, label: "Seed 变化", value: seedMode, onChange: setSeedMode, minWidth: 0, options: [{ value: "lock", label: "锁定" }, { value: "increment", label: "递增" }, { value: "decrement", label: "递减" }, { value: "random", label: "随机" }] }))),

		    		    (Number(steps) >= 40 || imageSizeScaled(w, hh, sizeMultiplier, 8).w * imageSizeScaled(w, hh, sizeMultiplier, 8).h >= 1024 * 1400)
		    		      ? h("div", { style: { border: "1px solid rgba(224,180,106,.5)", background: "rgba(224,180,106,.12)", borderRadius: "8px", padding: "5px 9px", fontSize: "12px", lineHeight: 1.45 } }, "⚠️ " + imageSizeScaled(w, hh, sizeMultiplier, 8).w + "×" + imageSizeScaled(w, hh, sizeMultiplier, 8).h + " / " + steps + " 步属重负载（896×1152/20 步约 45 秒）")
		    		      : null)),


		  // ③ 左下：正负提示词,
			  capExpand
		  
),
	  loraModal, promptModal, expandModal, tagEditPanel);
	}

	// ==================== 词库页 ====================
/** ===== 词库（新版）：方形小卡片 + 提示词胶囊 =====
 *  全分类实装：八大内置分类 + 自建分类都用卡片界面；旧版树状界面已于 0.7.98 移除。
 *  分类骨架（五个主分类 + 三组额外 + 自建），src 是 dict.js 里的原始分类名。
 */
/** 内置大分类骨架。key 稳定（存 USER.groupHide 用），src 是 dict.js 里的原始分类名。
 *  新卡片页只看 dictGroups() 的结果：内置组可隐藏/恢复，自建组可增删。 */
const BUILTIN_GROUPS = [
	{ key: "pose", name: "姿势", src: ["姿态-站", "姿态-坐", "姿态-其他", "动作", "姿势"] },
	{ key: "face", name: "表情", src: ["表情"] },
	{ key: "cloth", name: "服饰", src: ["衣服-军礼服", "衣服-驾驶员服", "服饰"] },
	{ key: "comp", name: "构图", src: ["镜头", "构图"] },
	{ key: "scene", name: "场景", src: ["背景", "场景"] },
	{ key: "quality", name: "质量", src: ["质量"] },
	{ key: "style", name: "风格", src: ["风格"] },
	{ key: "negative", name: "负面", src: ["负面"] },
];

/** 大分类的隐藏名单（内置组记 key，自建组记名称）。 */
function dictHiddenCats() {
	return (USER.groupHide || []).slice();
}

/** 当前应该显示的大分类：内置组（去掉被隐藏的）+ 自建组（dict 里多出来的分类名）。 */
function dictGroups() {
	const hide = dictHiddenCats();
	const rn = USER.groupRename || {};
	const out = [{ key: "all", name: "全部", src: [], custom: false, all: true }];
	const claimed = new Set();
	BUILTIN_GROUPS.forEach((g) => {
		g.src.forEach((s) => claimed.add(s));
		if (hide.indexOf(g.key) < 0) out.push(Object.assign({}, g, { custom: false, name: rn[g.key] || g.name }));
	});
	const lib = allLib();
	const userNames = [];
	Object.keys(lib).forEach((k) => { if (!claimed.has(k) && userNames.indexOf(k) < 0) userNames.push(k); });
	(USER.cats || []).forEach((k) => { if (!claimed.has(k) && userNames.indexOf(k) < 0) userNames.push(k); });
	userNames.forEach((nm) => {
		if (hide.indexOf("cat:" + nm) >= 0) return;
		out.push({ key: "cat:" + nm, name: rn["cat:" + nm] || nm, src: [nm], ready: true, custom: true });
	});
	return out;
}

/** 新建大分类：先建空分类，词条随后用「＋ 词条」往里加。返回名字，失败返回空串。 */
function dictNewGroup() {
	const nm = String(window.prompt("新分类名字（例如：手部 / 光影 / 道具）", "") || "").trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 24);
	if (!nm) return "";
	if (dictGroups().some((g) => g.name === nm)) { LAST_ERR = "已有同名分类：" + nm; return ""; }
	USER.cats = (USER.cats || []).slice();
	USER.cats.push(nm);
	USER.frags = USER.frags || {};
	USER.frags[nm] = USER.frags[nm] || [];
	// 之前若把这个名字隐藏过，取消隐藏
	USER.groupHide = dictHiddenCats().filter((k) => k !== "cat:" + nm);
	saveUser();
	return nm;
}

/** 删分类。内置组=隐藏（词条还在 dict.js，可恢复）；自建组=连词条一起删。 */
function dictDeleteGroup(g) {
	if (!g) return false;
	if (g.all) return false;   // 「全部」是固定分类，不参与删除 / 隐藏
	if (g.custom) {
		const n = (allLib()[g.name] || []).length;
		if (!window.confirm("删除自建分类「" + g.name + "」和它下面的 " + n + " 条词条？\n删掉就找不回来了。")) return false;
		if (USER.frags) delete USER.frags[g.name];
		if (USER.hidden) delete USER.hidden[g.name];
		if (USER.ov) USER.ov[g.name] = undefined;
		USER.cats = (USER.cats || []).filter((x) => x !== g.name);
		saveUser();
		return true;
	}
	if (!window.confirm("隐藏内置分类「" + g.name + "」？\n词条还在 lib/dict.js 里，点「恢复分类」能找回来。")) return false;
	USER.groupHide = dictHiddenCats().concat([g.key]);
	saveUser();
	return true;
}

/** 把隐藏掉的内置分类全部恢复。返回恢复个数。 */
function dictRestoreGroups() {
	const hidden = dictHiddenCats().filter((k) => k.indexOf("cat:") !== 0);
	if (!hidden.length) return 0;
	USER.groupHide = dictHiddenCats().filter((k) => k.indexOf("cat:") === 0);
	saveUser();
	return hidden.length;
}

/** 一组里的全部词条：{cat, cn, en}，去重、保序 */
function dictGroupItems(g) {
	const lib = allLib();
	const seen = new Set();
	const out = [];
	const cats = (g && g.all) ? Object.keys(lib) : (g.src || []);
	for (const c of cats) {
		for (const p of (lib[c] || [])) {
			const cn = String(p[0] || "").trim();
			const en = String(p[1] || "").trim();
			if (!cn || !en) continue;
			const k = cn + "\u0000" + en;
			if (seen.has(k)) continue;
			seen.add(k);
			out.push({ cat: c, cn: cn, en: en });
		}
	}
	return dictOrdered(out);
}

/** 用户拖出来的顺序：USER.order[分类] = [中文名…]，没列到的按原顺序排后面 */
function dictOrdered(items) {
	const ord = USER.order || {};
	const k = (it) => {
		const arr = ord[it.cat] || [];
		const i2 = arr.indexOf(it.cn);
		return i2 < 0 ? 1e9 : i2;
	};
	return items.map((it, i2) => ({ it: it, i2: i2, k: k(it) }))
		.sort((a, b) => (a.k - b.k) || (a.i2 - b.i2))
		.map((x) => x.it);
}

/** 搬分类：自建的真搬；内置的转成目标分类下的自建卡并在原分类隐藏（dict.js 不动） */
function dictMoveEntry(srcCat, cn, en, dstCat) {
	if (!srcCat || !dstCat || srcCat === dstCat) return false;
	USER.frags = USER.frags || {};
	const src = USER.frags[srcCat] || [];
	const i2 = src.findIndex((x) => String(x[0]).trim() === cn);
	if (i2 >= 0) {
		const ent = src.splice(i2, 1)[0];
		if (!src.length) delete USER.frags[srcCat];
		(USER.frags[dstCat] = USER.frags[dstCat] || []).push([String(ent[0]), String(ent[1])]);
	} else {
		if (!en) return false;
		(USER.frags[dstCat] = USER.frags[dstCat] || []).push([cn, en]);
		const key = builtinKey(srcCat) || srcCat;
		USER.hidden = USER.hidden || {};
		USER.hidden[key] = (USER.hidden[key] || []).concat([dictOrigCn(srcCat, cn)]);
	}
	// 旧顺序里的这个名字清掉，避免串位
	["", srcCat].forEach((c) => { if (USER.order && USER.order[c]) USER.order[c] = USER.order[c].filter((n) => n !== cn); });
	saveUser();
	return true;
}

/** 词条的原名（改名后 USER.ov 里存的是「原名 -> 现名」） */
function dictOrigCn(cat, cn) {
	const list = (USER.ov || {})[cat] || [];
	const hit = list.find((x) => x[1] === cn);
	return hit ? hit[0] : cn;
}

/** 改词条：内置的写 USER.ov，自定义的直接改 frags —— 两条路都留原名 */
function dictRenameEntry(cat, cn, newCn, newEn) {
	if (!newCn || !newEn) return false;
	if (Object.prototype.hasOwnProperty.call(LIB, cat)) {
		const orig = dictOrigCn(cat, cn);
		USER.ov = USER.ov || {};
		const list = USER.ov[cat] = (USER.ov[cat] || []);
		const hit = list.find((x) => x[0] === orig);
		if (hit) { hit[1] = newCn; hit[2] = newEn; } else list.push([orig, newCn, newEn]);
	} else {
		const arr = (USER.frags || {})[cat] || [];
		const i = arr.findIndex((x) => String(x[0]).trim() === String(cn).trim());
		if (i < 0) return false;
		arr[i] = [newCn, newEn];
	}
	saveUser();
	return true;
}

/** 删词条：内置的进 hidden（记原名，可恢复），自定义的真删 */
function dictHideEntry(cat, cn) {
	if (Object.prototype.hasOwnProperty.call(LIB, cat)) {
		const k = builtinKey(cat) || cat;
		USER.hidden = USER.hidden || {};
		USER.hidden[k] = (USER.hidden[k] || []).concat([dictOrigCn(cat, cn)]);
		saveUser();
		return true;
	}
	const arr = (USER.frags || {})[cat] || [];
	const i = arr.findIndex((x) => String(x[0]).trim() === String(cn).trim());
	if (i < 0) return false;
	arr.splice(i, 1);
	if (!arr.length && USER.frags) delete USER.frags[cat];
	saveUser();
	return true;
}

/** 逗号串合并：按逗号切、去空、大小写不敏感去重、保持先出现顺序。
 *  词库「插入提示词」和生成页「胶囊视图」共用同一份实现，两处行为不会漂。 */

function mergeCsvTags(cur, add) {
	const seen = {};
	const out = [];
	String(cur || "").split(",").concat(String(add || "").split(",")).forEach((raw) => {
		const tk = String(raw || "").trim();
		if (!tk) return;
		const k = tk.toLowerCase();
		if (seen[k]) return;
		seen[k] = 1; out.push(tk);
	});
	return out.join(", ");
}

/** 词库（新版）：方形小卡片点选 → 底部提示词胶囊 */
function libTab() {
	// 0.7.79：词库「粘贴 JSON」兜底（文件对话框在某些环境不弹，导入就等于没有）
	const [dictPasteOpen2, setDictPasteOpen2] = React.useState(false);
	const [dictPasteText2, setDictPasteText2] = React.useState("");
	// 0.7.67：选中的分类要留住 —— 插入、切页再回来都不能自动跳回默认「全部」
	const [cardCat, _setCardCat] = React.useState(() => {
		const saved = String((USER && USER.dictCat) || "");
		if (!saved) return "pose";
		try {
			const gs = dictGroups();
			if (gs.some((x) => x.key === saved)) return saved;
		} catch (e) { }
		return "pose";
	});
	const setCardCat = (k) => {
		const key = String(k || "");
		if (USER) { USER.dictCat = key; try { saveUser(); } catch (e) { } }
		_setCardCat(key);
	};
	const [cardQ, setCardQ] = React.useState("");
	const [cardSel, setCardSel] = React.useState([]);   // 单选池：卡片不带词性，插入时按胶囊词性分流
	const [, repaint] = React.useReducer((x) => x + 1, 0);   // 词库是外部可变数据，改完手动重画
	const [cardEdit, setCardEdit] = React.useState(null);   // 正在编辑的词条 {cat, cn, en, c, e2}
	const clickTimer = React.useRef(null);
	const dragRef = React.useRef(null);          // 正在拖的卡片 {cat, cn, en}
	const [dragAt, setDragAt] = React.useState("");   // 悬停目标：卡片 key 或 chip:xxx                  // 单击延时，等双击
	const [polFilter, setPolFilter] = React.useState("all");   // 显示范围：all / pos / neg

	const groups = dictGroups();
	const g = groups.find((x) => x.key === cardCat) || groups[0] || { key: "cat:空", name: "（没有分类）", src: [], custom: true };
	const items = dictGroupItems(g);
	const q = cardQ.trim().toLowerCase();
	const byQ = q ? items.filter((it) => (it.cn + " " + it.en).toLowerCase().indexOf(q) >= 0) : items;
	const shown = polFilter === "all" ? byQ : byQ.filter((it) => {
		const has = String(it.en || "").split(",").map((x) => x.trim()).filter(Boolean);
		const neg = has.some((x) => capPolOf(x) === "neg");
		return polFilter === "neg" ? neg : !neg;   // 只负＝含负面胶囊；只正＝一颗负面都没有
	});
	const sel = cardSel;
	const isOn = (it) => cardSel.some((s) => s.cn === it.cn && s.en === it.en);
	const toggle = (it) => {
		setCardSel((st) => {
			if (st.some((s) => s.cn === it.cn && s.en === it.en)) return st.filter((s) => !(s.cn === it.cn && s.en === it.en));
			return st.concat([{ cat: it.cat, cn: it.cn, en: it.en }]);
		});
	};

	/** 选中卡片里的全部英文标签（按出现顺序、大小写不敏感去重） */
	const selTags = () => {
		const out = [];
		cardSel.forEach((s) => String(s.en || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => {
			if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
		}));
		return out;
	};

	/** 与生成页胶囊视图共用同一份合并实现 */
	const mergeTags = (cur, add) => mergeCsvTags(cur, add);

	/** 插入：按每颗胶囊自己的词性分流 —— 标了「负」的进负面，其余进正向，两栏原有内容都不动 */
	const insertSel = () => {
		const tags = selTags();
		if (!tags.length) { setMsg("还没选卡片：先在卡片上点选"); return; }
		const posT = [], negT = [];
		tags.forEach((x) => (capPolOf(x) === "neg" ? negT : posT).push(x));
		if (typeof setPos !== "function" || typeof setNeg !== "function") { setMsg("这个版本没有写入接口"); return; }
		try {
			if (posT.length) setPos((cur) => mergeTags(cur, posT.join(", ")));
			if (negT.length) setNeg((cur) => mergeTags(cur, negT.join(", ")));
			setMsg("已插入：正向 " + posT.length + " 个" + (negT.length ? "、负面 " + negT.length + " 个" : "（没有标负的胶囊）"));
		} catch (e) { setMsg("插入失败：" + errText(e)); }
	};

	/** 右键词条：改名 / 删除；内置、自建都允许 */

	/** 新卡片的落盘分类：自建组用它自己的名字，内置组写回它的源分类（改过名也不跑偏） */

	/** 创建新卡片：直接开编辑器弹层（分类 / 中文 / 英文 / 极性），保存才落盘 */
	const addCard = () => {
		USER.frags = USER.frags || {};
		setCardEdit({ isNew: true, cat: dictCardTargetCat(g), cn: "", en: "", c: "", e2: "" });
	};

	/** 一组卡片 → 可分发 JSON（带中文备注与极性） */
	const packCards = (items) => {
		const notes = {};
		const tagPol = {};
		const cards = items.map((it) => {
			String(it.en || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((tk) => {
				const n = capNoteOf(tk);
				if (n) notes[tk] = n;
				const pl = capPolOf(tk);
				if (pl) tagPol[tk] = pl;
			});
			return { cat: it.cat, cn: it.cn, en: it.en };
		});
		return { kind: "dsh-dict-cards", v: 1, at: new Date().toISOString(), cards: cards, notes: notes, tagPol: tagPol };
	};
	const exportCards = (items, label) => {
		if (!items || !items.length) { setMsg("没有可导出的卡片"); return; }
		const pack = packCards(items);
		const fn = "词库卡片-" + String(label || "全部").replace(/[\\/:*?"<>|]/g, "-") + "-" + items.length + ".json";
		if (downloadText(JSON.stringify(pack, null, 2), fn)) setMsg("已导出 " + items.length + " 张卡片 → " + fn);
		else setMsg("导出失败：浏览器拦了下载");
	};
	/** 导出范围：勾选过就用勾选，否则当前分类当前筛选结果 */
	const exportPicked = () => {
		const picked = (cardSel.pos || []).concat(cardSel.neg || []);
		exportCards(picked.length ? picked : shown, picked.length ? "选中" : g.name);
	};
	/** 合并一个 dsh-dict-cards 包进词库（中文同名＝覆盖提示词，备注与极性一起带进来） */
	const applyDictPack = (obj) => {
		{
			const cards = Array.isArray(obj) ? obj : (obj && obj.cards);
			if (!Array.isArray(cards) || !cards.length) { setMsg("导入失败：文件里没有卡片"); return; }
			let added = 0, updated = 0, skipped = 0, notes = 0;
			cards.forEach((c) => {
				const cn = String((c && c.cn) || "").trim();
				const en = String((c && c.en) || "").trim();
				const cat = String((c && c.cat) || "").trim() || PR_HOME_CAT;
				if (!cn || !en) { skipped++; return; }
				USER.frags = USER.frags || {};
				const list = (USER.frags[cat] || []).slice();
				const at = list.findIndex((x) => String(x[0]).trim() === cn);
				if (at >= 0) { list[at] = [cn, en]; updated++; } else { list.push([cn, en]); added++; }
				USER.frags[cat] = list;
				// 老文件的卡片极性 → 摊到这张卡的每颗胶囊上；新文件走 tagPol
				if (c.polarity === "pos" || c.polarity === "neg") {
					en.split(",").map((s) => s.trim()).filter(Boolean).forEach((tk) => setCapPol(tk, c.polarity));
				}
			});
			const tp = (obj && obj.tagPol && typeof obj.tagPol === "object") ? obj.tagPol : null;
			if (tp) Object.keys(tp).forEach((k) => setCapPol(k, tp[k]));
			const nk = (obj && obj.notes && typeof obj.notes === "object") ? obj.notes : null;
			if (nk) Object.keys(nk).forEach((k) => {
				const v = String(nk[k] || "").trim();
				if (!v) return;
				USER.capNote = USER.capNote || {};
				USER.capNote[String(k).trim().toLowerCase()] = v;
				notes++;
			});
			// 0.7.80：新分类要同时进 USER.cats，并直接跳到第一个导入的分类 —— 否则面板停在旧分类，看着像「没变化」
			const newCats = [];
			cards.forEach((c) => {
				const cat = String((c && c.cat) || "").trim();
				if (cat && newCats.indexOf(cat) < 0) newCats.push(cat);
			});
			if (newCats.length) {
				USER.cats = Array.from(new Set((USER.cats || []).concat(newCats)));
				try { setCardQ(""); } catch (e) { }
				try { setPolFilter("all"); } catch (e) { }
				try { setCardCat("cat:" + newCats[0]); } catch (e) { }
			}
			saveUser(); repaint();
			try { dictFlush(); } catch (e) { }
			try { clientLog("dictImport", "cards=" + cards.length + " new=" + added + " upd=" + updated + " skip=" + skipped + " notes=" + notes + " cats=" + newCats.join("/")); } catch (e) { }
			setMsg("导入 " + cards.length + " 张：新建 " + added + " · 覆盖 " + updated + " · 跳过 " + skipped + " · 备注 " + notes
				+ (newCats.length ? " · 分类 " + newCats.join(" / ") + "（已跳到「" + newCats[0] + "」）" : ""));
		};
	};
	/** 0.7.79：文件导入与「粘贴 JSON」共用 applyDictPack */
	const importCards = (file) => {
		const rd = new FileReader();
		rd.onload = () => {
			let obj = null;
			try { obj = JSON.parse(String(rd.result || "")); } catch (e) { setMsg("导入失败：不是合法 JSON"); return; }
			applyDictPack(obj);
		};
		rd.onerror = () => setMsg("读取文件失败");
		rd.readAsText(file, "utf-8");
	};
	const dictPasteModal2 = () => h("div", {
		onClick: () => setDictPasteOpen2(false),
		style: { position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.38)",
			display: "flex", alignItems: "center", justifyContent: "center" },
	},
		h("div", {
			onClick: (e) => e.stopPropagation(),
			style: { width: "min(680px, 92vw)", background: "var(--c-panel)", color: "var(--c-fg)",
				border: "1px solid var(--c-line)", borderRadius: "12px", padding: "14px 16px",
				display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 18px 48px rgba(0,0,0,.38)" },
		},
			h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "粘贴词库 JSON"),
			h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "dsh-dict-cards 格式：{ \"cards\": [ { \"cat\", \"cn\", \"en\" } ], \"notes\": {…}, \"tagPol\": {…} }。不依赖文件对话框，任何环境都能用。"),
			h("textarea", {
				value: dictPasteText2, onChange: (e) => setDictPasteText2(e.target.value), spellCheck: false,
				placeholder: '{ "kind": "dsh-dict-cards", "v": 1, "cards": [ { "cat": "姿势·极限", "cn": "撑地张腿坐", "en": "sitting, spread legs" } ] }',
				style: Object.assign({}, S.input || S.inp, { width: "100%", boxSizing: "border-box", height: "240px",
					fontFamily: "ui-monospace,Consolas,monospace", fontSize: "12px" }),
			}),
			h("div", { style: { display: "flex", gap: "8px" } },
				h("button", { style: S.btn, onClick: () => {
					const raw = String(dictPasteText2 || "").trim();
					if (!raw) { setMsg("先粘贴词库 JSON"); return; }
					let obj = null;
					try { obj = JSON.parse(raw); } catch (e) { setMsg("不是合法 JSON：" + String((e && e.message) || e).slice(0, 80)); return; }
					setDictPasteOpen2(false);
					applyDictPack(obj);
				} }, "导入"),
				h("button", { style: S.btn2, onClick: () => setDictPasteOpen2(false) }, "取消"),
				h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg5)" } }, "Ctrl+V 粘贴 · Esc 取消"))));

	const chipOne = (x) => h("span", {
		key: x.key,
		title: x.name + (x.all ? "\u000A固定分类：跨所有分类显示全部词条（不可改名 / 删除）" : "\u000A左键切换 · 右键改名字/删除这个分类"),
		onClick: () => { setCardCat(x.key); },
		onContextMenu: (e) => { e.preventDefault(); groupMenu(x); },
		onDragOver: (e) => {
			if (!dragRef.current) return;
			e.preventDefault();
			try { e.dataTransfer.dropEffect = "move"; } catch (x2) { }
			if (dragAt !== "chip:" + x.key) setDragAt("chip:" + x.key);
		},
		onDragLeave: () => { if (dragAt === "chip:" + x.key) setDragAt(""); },
		onDrop: (e) => { e.preventDefault(); e.stopPropagation(); dropOnChip(x); },
		style: Object.assign({}, S.chip, {
			padding: "4px 10px 4px 12px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer",
			outline: dragAt === "chip:" + x.key ? "2px dashed var(--c-good, #16a34a)" : "none",
			background: x.key === cardCat ? "var(--c-accent)" : "var(--c-accent-bg2)",
			color: x.key === cardCat ? "var(--c-accent-on)" : "var(--c-fg2)",
			borderColor: x.key === cardCat ? "var(--c-accent)" : "var(--c-line)",
			borderStyle: "solid",
		}),
	},
		x.name,
		x.all ? null : h("span", {
			title: x.custom ? "删除这个自建分类（连同词条）" : "隐藏这个内置分类（词条还在 dict.js）",
			onClick: (e) => {
				e.stopPropagation();
				if (dictDeleteGroup(x)) { if (cardCat === x.key) setCardCat(""); setMsg(x.custom ? ("已删除分类「" + x.name + "」") : ("已隐藏「" + x.name + "」，可点「恢复分类」找回")); repaint(); }
			},
			style: { opacity: 0.5, fontSize: "12px", lineHeight: 1, padding: "0 2px", borderRadius: "4px" },
		}, "\u00D7"));

	const chipGroup = (x) => chipOne(x);

	/** 拖到分类 chip：换分类（内置卡转成目标分类的自建卡，原分类里隐藏） */
	const dropOnChip = (x) => {
		const d = dragRef.current;
		dragRef.current = null; setDragAt("");
		if (!d) return;
		if (x.all) { setMsg("「全部」是集合视图，不能当目标；拖到具体分类 chip 上"); return; }
		const dst = dictCardTargetCat(x);
		if (!dst || dst === d.cat) { setMsg("已经在这个分类里了"); return; }
		if (dictMoveEntry(d.cat, d.cn, d.en, dst)) { setMsg("「" + d.cn + "」→「" + dst + "」"); repaint(); }
		else setMsg("没搬动：「" + d.cn + "」不在词库里？");
	};

	/** 拖到另一张卡：同分类改顺序（插到它前/后），跨分类先搬再排 */
	const dropOnCard = (target, e) => {
		const d = dragRef.current;
		dragRef.current = null; setDragAt("");
		if (!d || (d.cat === target.cat && d.cn === target.cn)) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const after = (e.clientY - rect.top) > rect.height / 2;
		if (d.cat !== target.cat && !dictMoveEntry(d.cat, d.cn, d.en, target.cat)) {
			setMsg("没搬动：「" + d.cn + "」不在词库里？");
			return;
		}
		const cat = target.cat;
		const names = dictOrdered(dictGroupItems({ src: [cat] })).map((it) => it.cn).filter((n) => n !== d.cn);
		let at = names.indexOf(target.cn);
		if (at < 0) at = after ? names.length : 0;
		else at = after ? at + 1 : at;
		names.splice(at, 0, d.cn);
		USER.order = USER.order || {};
		USER.order[cat] = names;
		saveUser(); repaint();
		setMsg("「" + d.cn + "」顺序已记下（" + cat + " 第 " + (at + 1) + " 位）");
	};

	/** 右键分类：改名（自建）/ 删除 / 恢复隐藏 */
	const groupMenu = (x) => {
		if (x.all) { setMsg("「全部」是固定分类：列出所有分类的词条，不能改名也不能删除"); return; }
		const what = x.custom ? "自建分类" : "内置分类";
		const tip = "「" + x.name + "」是" + what + "。输入新名字＝改名" + (x.custom ? "" : "（只改显示，dict.js 不动）") + "；输入 - ＝删除。";
		const v = String(window.prompt(tip, x.name) || "").trim();
		if (!v || v === x.name) return;
		if (v === "-") {
			if (dictDeleteGroup(x)) { if (cardCat === x.key) setCardCat(""); setMsg("已删除「" + x.name + "」"); repaint(); }
			return;
		}
		const nm = v.replace(/[\\/:*?"<>|]/g, "-").slice(0, 24);
		if (dictGroups().some((o) => o.name === nm)) { setMsg("已有同名分类：" + nm); return; }
		USER.groupRename = USER.groupRename || {};
		USER.groupRename[x.key] = nm;
		saveUser();
		setMsg("「" + x.name + "」→「" + nm + "」");
		repaint();
	};

	const newGroup = () => {
		const nm = dictNewGroup();
		if (!nm) { setMsg(LAST_ERR || "没建分类"); return; }
		setCardCat("cat:" + nm);
		setMsg("已新建分类「" + nm + "」，接着点「＋ 词条」往里加词");
		repaint();
	};

	const restoreGroups = () => {
		if (USER.hideBuiltinDict) { USER.hideBuiltinDict = false; saveUser(); repaint(); setMsg("已恢复内置词库"); return; }
		const n = dictRestoreGroups();
		if (!n) { setMsg("没有隐藏的内置分类"); return; }
		setMsg("已恢复 " + n + " 个内置分类");
		repaint();
	};

	const cell = (it) => {
		const on = isOn(it);
		return h("div", {
			key: it.cat + "\u0000" + it.cn,
			onClick: () => {
				// 等 200ms：双击时把这次单击撤掉，别让卡片先闪一下选中再弹编辑
				if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
				clickTimer.current = setTimeout(() => { clickTimer.current = null; toggle(it); }, 200);
			},
			onDoubleClick: (e) => {
				e.preventDefault();
				if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
				openEdit(it);
			},
			onContextMenu: (e) => { e.preventDefault(); openEdit(it); },
			draggable: true,
			onDragStart: (e) => {
				dragRef.current = { cat: it.cat, cn: it.cn, en: it.en };
				try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.cn); } catch (x) { }
			},
			onDragEnd: () => { dragRef.current = null; setDragAt(""); },
			onDragOver: (e) => {
				if (!dragRef.current) return;
				e.preventDefault();
				try { e.dataTransfer.dropEffect = "move"; } catch (x) { }
				const k = it.cat + "\u0000" + it.cn;
				if (dragAt !== k) setDragAt(k);
			},
			onDragLeave: () => { if (dragAt === it.cat + "\u0000" + it.cn) setDragAt(""); },
			onDrop: (e) => { e.preventDefault(); e.stopPropagation(); dropOnCard(it, e); },
			title: it.cn + "\u000A" + it.en + "\u000A单击选中 / 双击改词条 / 右键同双击 / 拖动改顺序、拖到分类改分类（词性在胶囊上标）",
			style: {
				aspectRatio: "1 / 1", borderRadius: "10px", padding: "7px 7px 6px", cursor: "pointer",
				display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "3px",
				background: on ? "var(--c-accent-bg)" : "var(--c-panel2)",
				border: "1.5px solid " + (dragAt === it.cat + "\u0000" + it.cn ? "var(--c-good, #16a34a)"
					: (on ? "var(--c-accent)" : "var(--c-line)")),
				boxShadow: dragAt === it.cat + "\u0000" + it.cn ? "0 0 0 2px var(--c-good, #16a34a) inset" : "none",
				overflow: "hidden", userSelect: "none", boxSizing: "border-box",
			},
		},
			h("div", { style: { display: "flex", alignItems: "flex-start", gap: "4px" } },
				h("div", { style: { fontSize: "12.5px", fontWeight: 600, lineHeight: 1.25, flex: 1, wordBreak: "break-all", color: on ? "var(--c-accent-fg)" : "var(--c-fg)" } }, it.cn),
		),
			h("div", { style: { fontSize: "9.5px", lineHeight: 1.15, color: "var(--c-fg5)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-all" } }, it.en));
	};

	/** 选中池（单一列表）：每张卡下面列出它的胶囊，标了负的胶囊用红点 */
	const selRow = () => {
		const tagsOf = (s) => String(s.en || "").split(",").map((x) => x.trim()).filter(Boolean);
		return h("div", { style: { display: "flex", gap: "5px", alignItems: "flex-start", flexWrap: "wrap", minHeight: "26px" } },
			h("span", { style: { fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--c-line)", color: "var(--c-fg4)", whiteSpace: "nowrap" } },
				"选中 " + cardSel.length),
			cardSel.length ? cardSel.map((s, i) => h("span", {
				key: "sel-" + i + "-" + s.en,
				title: s.en + "\u000A点 × 取消选中；插入时按胶囊词性分流",
				style: Object.assign({}, S.chip, { fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }),
			},
				s.cn,
				h("span", {
					style: { opacity: 0.6, fontSize: "11px" },
				}, "(" + tagsOf(s).filter((x) => capPolOf(x) === "neg").length + "负/" + tagsOf(s).length + ")"),
				h("span", {
					style: { opacity: 0.55 },
					onClick: (e) => { e.stopPropagation(); setCardSel((st) => st.filter((x) => !(x.cn === s.cn && x.en === s.en))); },
				}, "\u00D7")))
				: h("span", { style: { fontSize: "11.5px", color: "var(--c-fg5)", paddingTop: "4px" } }, "点上面的卡片选中；插入时按胶囊词性分流"));
	};

	const openEdit = (it) => {
		setCardEdit({ cat: it.cat, cn: it.cn, en: it.en, c: it.cn, e2: it.en });
	};
	const closeEdit = () => setCardEdit(null);
	const saveEdit = () => {
		if (!cardEdit) return;
		const cn = String(cardEdit.c || "").trim();
		const en = String(cardEdit.e2 || "").trim();
		if (!cn || !en) { setMsg("中文名和英文标签都要填"); return; }
		if (cardEdit.isNew) {
			const cat = String(cardEdit.cat || "").trim();
			if (!cat) { setMsg("先选一个分类"); return; }
			USER.frags = USER.frags || {};
			const list = (USER.frags[cat] || []).slice();
			if (list.some((x) => String(x[0]).trim() === cn)) { setMsg("「" + cn + "」已经在「" + cat + "」里了，换个中文名"); return; }
			list.push([cn, en]);
			USER.frags[cat] = list;
			saveUser();
			repaint();
			// 不关弹层：切成「编辑这张卡」，可以直接继续往里加新胶囊
			setCardEdit({ cat: cat, cn: cn, en: en, c: cn, e2: en });
			setMsg("已新建卡片「" + cn + "」→ " + en + "，放进「" + cat + "」；弹层留着，可以继续加胶囊");
			return;
		}
		if (dictRenameEntry(cardEdit.cat, cardEdit.cn, cn, en)) {
			setMsg("已改「" + cardEdit.cn + "」→「" + cn + "」：" + en);
			closeEdit(); repaint();
		} else setMsg("没找到这条词条");
	};
	const deleteEdit = () => {
		if (!cardEdit) return;
		const builtin = Object.prototype.hasOwnProperty.call(LIB, cardEdit.cat);
		const tip = builtin
			? "隐藏词条「" + cardEdit.cn + "」？\n内置词条只是从界面隐藏，lib/dict.js 不动。"
			: "删除词条「" + cardEdit.cn + "」？\n自建词条删了就找不回来。";
		if (!window.confirm(tip)) return;
		if (dictHideEntry(cardEdit.cat, cardEdit.cn)) { setMsg("已删除「" + cardEdit.cn + "」"); closeEdit(); repaint(); }
		else setMsg("没找到这条词条");
	};


	return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
		h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
			h("input", { value: cardQ, placeholder: "搜词条 / 英文标签", onChange: (e) => setCardQ(e.target.value), style: Object.assign({}, S.input || S.inp, { width: "220px" }) }),
			["all", "pos", "neg"].map((k) => h("span", {
				key: k, onClick: () => setPolFilter(k),
				title: k === "all" ? "全部卡片" : (k === "pos" ? "只看不含负面胶囊的卡" : "只看含负面胶囊的卡"),
				style: Object.assign({}, S.chip, { fontSize: "12px", cursor: "pointer", padding: "4px 10px",
					background: polFilter === k ? "var(--c-accent)" : "transparent",
					color: polFilter === k ? "var(--c-accent-on)" : "var(--c-fg4)",
					borderColor: polFilter === k ? "var(--c-accent)" : "var(--c-line)" }),
			}, k === "all" ? "全部" : k === "pos" ? "纯正向" : "含负面")),
			h("button", { style: S.btn2, onClick: addCard, title: "在这个分类里新建一张卡片（中文名 + 提示词本体）" }, "＋ 新卡片"),
			h("button", { style: S.btn2, onClick: exportPicked, title: "把勾选过的卡片（没勾就导出当前分类）导出成 .json，可发给别人导入" }, "导出"),
			h("button", { style: S.btn2, onClick: () => revealCardFile("dict", ""), title: "打开词库 JSON 的落盘目录（本地绘画\词库）" }, "打开文件位置"),
			h("button", { style: S.btn2, onClick: () => syncKindFromDisk("dict", { force: true }), title: "重新读 本地绘画\词库：目录里删掉的文件，面板上对应的词条也消失" }, "同步目录"),
			h("button", { style: S.btn2, onClick: () => dirClear("dict", "词库"), title: "把 词库 目录整包搬到 _清空备份，并清空面板（可逆）" }, "清空"),
			h("button", { style: S.btn2, onClick: () => {
				if (!window.confirm("清空词库：\n· 自建词条全清\n· 内置词库（代码里那几千条）也一起隐藏\n\n磁盘文件搬去 _清空备份，内置词库可用「恢复分类」找回。继续？")) return;
				USER.frags = {}; USER.dictFiles = {}; USER.hideBuiltinDict = true; USER.groupHide = [];
				saveUser(); repaint();
				fetch(EXPANDER + "/dir/clear", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS), body: JSON.stringify({ kind: "dict" }) })
					.then((r) => r.json())
					.then((d) => setMsg(d && d.ok ? ("词库已清空（含内置）：搬走 " + String(d.count || 0) + " 个文件 → " + String(d.backup || "")) : ("清空失败：" + String((d && d.error) || "侧车没响应"))))
					.catch((e) => setMsg("清空失败：" + String((e && e.message) || e)));
			}, title: "自建词条清空，并且把内置词库整体隐藏（可恢复）" }, "清空含内置"),
			USER.hideBuiltinDict ? h("button", { style: S.btn2, onClick: () => {
				USER.hideBuiltinDict = false; saveUser(); repaint(); setMsg("已恢复内置词库");
			}, title: "把内置词库放回面板（之前点过「清空含内置」）" }, "恢复内置") : null,
			h("label", { style: Object.assign({}, S.btn2, { position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", cursor: "pointer" }), title: "从导出的 .json 导入小卡片（中文同名＝覆盖提示词；备注与词性一起带进来）" }, "导入",
				h("input", { type: "file", accept: ".json,application/json",
					style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: "100px" },
					onChange: (e) => { const f = e.target.files && e.target.files[0]; try { e.target.value = ""; } catch (x) { } if (f) importCards(f); else setMsg("没拿到文件：这个环境没弹文件对话框，改用右边「粘贴 JSON」"); } })),
			h("button", { style: S.btn2, onClick: () => { setDictPasteText2(""); setDictPasteOpen2(true); }, title: "不依赖文件对话框：把词库包 JSON 粘进来" }, "粘贴 JSON"),
			dictPasteOpen2 ? dictPasteModal2() : null,
			h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg4)" } }, g.name + " " + shown.length + " 条")),
		h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
			groups.map(chipGroup),
			h("span", {
				onClick: newGroup, title: "新建一个大分类",
				style: Object.assign({}, S.chip, {
					padding: "4px 12px", fontSize: "12.5px", cursor: "pointer", borderStyle: "dashed",
					background: "transparent", color: "var(--c-fg4)", borderColor: "var(--c-line)",
				}),
			}, "＋ 分类"),
			dictHiddenCats().filter((k) => k.indexOf("cat:") !== 0).length
				? h("span", {
					onClick: restoreGroups, title: "把隐藏掉的内置分类找回来",
					style: Object.assign({}, S.chip, { padding: "4px 10px", fontSize: "12px", cursor: "pointer", background: "transparent", color: "var(--c-fg4)" }),
				}, "恢复分类 " + dictHiddenCats().filter((k) => k.indexOf("cat:") !== 0).length)
				: null),
		h("div", Object.assign({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px", maxHeight: "46vh", overflowY: "auto", padding: "2px" } },
			// 拖词库 JSON 进网格 = 导入（和「导入」按钮同一条通道）
			dropFileProps(["json"], (good) => good.forEach((f) => importCards(f)),
				{ onReject: () => setMsg("拖错了：词库只收 .json（导出时也是这个格式）"),
				  onEmpty: () => setMsg("拖拽没拿到文件（桌面版常见）：点「导入」按钮选") })),
			shown.length ? shown.map(cell) : h("div", { style: { gridColumn: "1 / -1", fontSize: "12px", color: "var(--c-fg5)", padding: "12px" } }, q ? "没有匹配「" + cardQ + "」的词条" : "这个分类还没有卡片，点「＋ 新卡片」建一张")),
		h("div", { style: { borderTop: "1px solid var(--c-line)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" } },
			selRow(),
			h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "2px" } },
				h("button", { style: Object.assign({}, S.btn2, { fontWeight: 600 }), onClick: insertSel, title: "标了「负」的胶囊进负面，其余进正向；两栏原有内容都不动" }, "插入提示词（按胶囊词性）"),
				h("button", { style: S.btn2, onClick: () => { setTab("gen"); setZoneMode("prompt"); setMsg("已切到生成页；提示词区若要胶囊视图，点一下「切换 ▸」"); } }, "去生成页看"),
				h("button", { style: S.btn2, onClick: () => { setCardSel([]); setMsg("已清空选中"); } }, "清空选中"))),
		cardEdit ? h(DictCardEditor, {
			draft: cardEdit,
			groups: groups, group: g,
			patch: (kv) => setCardEdit(Object.assign({}, cardEdit, kv)),
			onChanged: repaint,          // 弹层里改胶囊词性后，卡片区跟着重画
			onClose: closeEdit,
			onSave: saveEdit,
			onDelete: deleteEdit,
			onExportThis: () => {
				const cn0 = String(cardEdit.c || "").trim();
				const en0 = String(cardEdit.e2 || "").trim();
				if (!cn0 || !en0) { setMsg("中文名和提示词本体都要有才能导出"); return; }
				exportCards([{ cat: cardEdit.cat, cn: cn0, en: en0 }], cn0);
			},
		}) : null);
}


	/** 角色卡：一张卡 = 一个角色的整套标签，点一下整组加入提示词 */
				/** 角色卡标签的模块归类（按关键词，英文标签小写匹配） */
		const CARD_GROUPS = [
			["hair", "发型", ["hair", "bangs", "ponytail", "twintails", "braid", "bun", "fringe", "ahoge", "hairband", "hairclip", "ornament"]],
			["eyes", "眼睛", ["eyes", "pupil", "eyelash", "eyebrow"]],
					["glasses", "眼镜 · 配饰", ["glasses", "eyewear", "spectacles", "earring", "necklace", "choker", "ribbon", "bow"]],
			["outfit", "服饰", ["shirt", "skirt", "dress", "coat", "jacket", "uniform", "necktie", "tie", "stocking", "sock", "shoe", "boot", "glove", "scarf", "sweater", "hoodie", "vest", "pants", "trouser", "belt", "hat", "cap", "apron", "kimono", "cape", "cloak"]],
			["base", "基础", ["1girl", "1boy", "solo", "group"]],
		];
		const CARD_ORDER = ["trigger", "base", "hair", "eyes", "glasses", "outfit", "extra"];

		/** 风格卡的模块划分：画风 / 线条 / 上色 / 光影 */
		const STYLE_GROUPS = [
		  ["proportion", "比例", ["chibi", "super deformed", "big head", "small body", "proportion", "head-to-body", "tall", "mature", "petite", "loli"]],
		  ["style", "画风", ["illustration", "anime", "art style", " style", "painterly", "realistic", "sketch", "watercolor", "cel", "brush", "stroke", "texture"]],
		  ["line", "线条", ["lineart", "line weight", "outline", "ink", "pencil", "line"]],
		  ["color", "上色", ["color", "coloring", "palette", "tone", "shading", "gradient", "flat"]],
		  ["light", "光影", ["light", "lighting", "shadow", "glow", "highlight", "rim", "cinematic"]],
		];
		const STYLE_ORDER = ["trigger", "proportion", "style", "line", "color", "light", "extra"];
		/** 风格标签的中文备注（点胶囊时显示） */
		const STYLE_ZH = {
		  "@mochizuki_kei": "画师触发", "mochizuki_kei style": "望月けい画风", "2d anime illustration": "2D 动漫插画",
		  "prominent clean lineart": "干净线稿", "expressive variable line weight": "线条粗细变化", "(lineart:1.4)": "加重线稿",
		  "flat style": "平涂", "flat color": "平涂上色", "cel shading": "赛璐璐阴影", "crisp clean outline": "干净轮廓",
		  "painterly illustration": "厚涂插画", "thick brush strokes": "厚笔触", "rich texture": "质感丰富",
		  "soft rim light": "柔和轮廓光", "cinematic lighting": "电影感打光", "subtle glow": "微光",
		  "detailed background": "精细背景", "extreme aesthetic": "极高美感", "masterpiece": "杰作",
		  "best quality": "最佳质量", "amazing quality": "惊异质量", "very aesthetic": "很美",
		  "absurdres": "超高分辨率", "HDR": "HDR", "newest": "最新",
		};
		/** 比例预设：卡的 proportion 只存 preset 名，插入时展开成词（2026-10-29） */
		const PROPORTION_PRESETS = [
		  ["chibi", "Q版 3头身", ["chibi", "super deformed"]],
		  ["half", "半身 5-6头身", ["portrait", "upper body"]],
		  ["adult", "成年 7-8头身", ["tall", "mature proportions"]],
		  ["none", "不锁比例", []],
		  ["custom", "自定义", null],
		];
		/** 把 proportion 展开成词串：兼容老卡（数组）与新卡（{preset,custom}） */
		function proportionTags(v) {
		  if (!v) return "";
		  if (Array.isArray(v)) return normPart(v).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
		  const preset = String((v || {}).preset || "");
		  if (preset === "custom") return String((v || {}).custom || "").trim();
		  const hit = PROPORTION_PRESETS.filter((x) => x[0] === preset)[0];
		  return (hit && hit[2]) ? hit[2].join(", ") : "";
		}
		/** 把一整串风格标签拆进各模块（每项 {t,n}） */
		function splitStyleTags(tags) {
		  const parts = { trigger: "", proportion: { preset: "none", custom: "" }, style: [], line: [], color: [], light: [], extra: [] };
		  const toks = String(tags || "").split(",").map((x) => x.trim()).filter(Boolean);
		  let first = true;
		  for (const t of toks) {
		    const low = t.toLowerCase();
		    let hit = "";
		    for (const g of STYLE_GROUPS) { if (g[2].some((k) => low.indexOf(k) >= 0)) { hit = g[0]; break; } }
		    if (!hit && first && low.indexOf(" ") < 0) hit = "trigger";
		    first = false;
		    if (!hit) hit = "extra";
		    if (hit === "trigger") { parts.trigger = t; continue; }
		    if (hit === "proportion") {
		      const low2 = t.toLowerCase();
		      if (low2.indexOf("chibi") >= 0 || low2.indexOf("deformed") >= 0) parts.proportion.preset = "chibi";
		      else if (low2.indexOf("tall") >= 0 || low2.indexOf("mature") >= 0) parts.proportion.preset = "adult";
		      else { parts.proportion.preset = "custom"; parts.proportion.custom = t; }
		      continue;
		    }
		    parts[hit].push({ t: t, n: STYLE_ZH[t] || "" });
		  }
		  return parts;
		}
		/** 各模块按固定顺序拼回完整风格串 */
		function joinStyleParts(p) {
		  const out = [];
		  const trg = String((p || {}).trigger || "").trim();
		  if (trg) out.push(trg);
		  for (const k of STYLE_ORDER) {
		    if (k === "trigger") continue;
		    if (k === "proportion") { const sp = proportionTags((p || {})[k]); if (sp) out.push(sp); continue; }
		    const arr = normPart((p || {})[k]);
		    const s = arr.map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
		    if (s) out.push(s);
		  }
		  return out.join(", ");
		}
		
		

				/** 把一整串标签拆进各模块（每项 {t,n}） */
		function splitCardTags(tags) {
			const parts = { trigger: "", base: [], hair: [], eyes: [], glasses: [], outfit: [], extra: [] };
			const toks = String(tags || "").split(",").map((x) => x.trim()).filter(Boolean);
			let first = true;
			for (const t of toks) {
				const low = t.toLowerCase();
				let hit = "";
				for (const g of CARD_GROUPS) { if (g[2].some((k) => low.indexOf(k) >= 0)) { hit = g[0]; break; } }
				if (!hit && first && low.indexOf(" ") < 0) hit = "trigger";
				first = false;
				if (!hit) hit = "extra";
				if (hit === "trigger") { parts.trigger = t; continue; }
		if (!parts[hit]) hit = "extra";
				parts[hit].push({ t: t, n: zhOf(t) });
			}
			return parts;
		}

				/** 各模块按固定顺序拼回完整提示词（只用提示词本体，不含中文备注） */
		function joinCardParts(p) {
			const out = [];
			const trg = String((p || {}).trigger || "").trim();
			if (trg) out.push(trg);
			for (const k of CARD_ORDER) {
				if (k === "trigger") continue;
				const arr = normPart((p || {})[k]);
				const s = arr.map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
				if (s) out.push(s);
			}
			return out.join(", ");
		}

/** 角色卡界面统一按钮样式：实心灰底 + 纯白字加粗，杜绝半透明看不清 */
const CARD_BTN = { fontSize: "12px", fontWeight: 600, padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--c-fg4)", background: "var(--c-line)", color: "var(--c-fg)", cursor: "pointer" };
const CARD_BTN_ACCENT = Object.assign({}, CARD_BTN, { border: "1px solid var(--c-accent)" });
const CARD_BTN_DANGER = Object.assign({}, CARD_BTN, { border: "1px solid var(--c-bad)", background: "var(--c-bad-bg)" });

/** 统一成 [{t:提示词, n:中文备注}]；兼容旧的纯字符串 */
function normPart(v) {
	if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? { t: x, n: zhOf(x) } : { t: String((x && x.t) || ""), n: String((x && x.n) || "") })).filter((x) => x.t || x.n);
	if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean).map((t) => ({ t: t, n: zhOf(t) }));
	return [];
}

/** 0.7.55：先让侧车落盘（Electron 里 a.download 不落地），侧车不在才退回浏览器下载 */
function downloadText(text, filename) {
	const fn = String(filename || "export.json");
	try {
		fetch(EXPANDER + "/save-json", {
			method: "POST",
			headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
			body: JSON.stringify({ filename: fn, text: String(text) }),
		})
			.then((r) => r.json())
			.then((d) => {
				if (d && d.ok && d.path) {
					MSG("已保存 " + fn + " → " + d.path);
					revealCardFile("pack", d.path);
				} else {
					MSG("落盘失败（" + String((d && (d.error || d.message)) || "侧车没响应") + "）");
				}
			})
			.catch(() => {});
		return true;
	} catch (e) { return false; }
}

/** 把一张卡（或草稿）序列化成可导入的 JSON */
/** 导出全部自建卡（含对内置卡的改封面/改标签覆盖） */
function exportAllCards() {
	const src = (USER.cards || []).filter((c) => c && String(c.name || "").trim());
	const cards = src.map((c) => ({
		name: String(c.name || "").trim(),
		tags: String(c.tags || joinCardParts(c.parts || {})).trim(), locks: normLocks(c.locks),
		note: String(c.note || ""),
		cover: String(c.cover || ""),
		parts: (c.parts && typeof c.parts === "object") ? c.parts : splitCardTags(String(c.tags || "")),
		neg: normPart(c.neg),
		lora: String(c.lora || ""),
		loraW: Number(c.loraW) > 0 ? Number(c.loraW) : 0.7,
		conditioning: condForSave(c.conditioning),
	})).filter((c) => c.tags);
	if (!cards.length) { setMsg("还没有自建角色卡可导出（内置卡写在代码里，不用导出）"); return; }
	const obj = { version: 1, exportedAt: new Date().toISOString(), cards: cards };
	const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const fn = "角色卡-全部-" + cards.length + "张-" + day + ".json";
	const ok = downloadText(JSON.stringify(obj, null, 2), fn);
	setMsg(ok ? ("已导出全部 " + cards.length + " 张角色卡 → " + fn) : "导出失败：浏览器不允许下载");
}

/** 拖拽导入：.json / .dslcard / .dslrecipe 都能拖（和「导入」按钮同一条通道） */
function dropJsonProps(onFile) {
  return {
    onDragOver: (e) => { e.preventDefault(); e.currentTarget.style.outline = "2px dashed var(--c-accent)"; e.currentTarget.style.outlineOffset = "3px"; },
    onDragLeave: (e) => { e.currentTarget.style.outline = "none"; },
    onDrop: (e) => {
      e.preventDefault();
      if (e.currentTarget) e.currentTarget.style.outline = "none";
      const dt = e.dataTransfer || (e.nativeEvent && e.nativeEvent.dataTransfer);
      const f = dt && dt.files && dt.files[0];
      if (!f) { setMsg("拖拽没拿到文件（桌面版常见）：把卡放进 cardsDir 后点「重扫磁盘」，或用「粘贴 JSON」"); return; }
      if (!/\.(json|dslcard|dslrecipe)$/i.test(String(f.name || ""))) { setMsg("拖错了：只认 .json / .dslcard / .dslrecipe（松手的是「" + String(f.name || "") + "」）"); return; }
      onFile(f);
    },
  };
}

function importCards(e) {
  const f = e && e.target && e.target.files && e.target.files[0];
  try { if (e && e.target) e.target.value = ""; } catch (err) {}
  if (!f) { setMsg("没拿到文件：这个环境没弹文件对话框（桌面版常见）—— 用右边「粘贴 JSON」或把卡放进 cardsDir 再点「重扫磁盘」"); return; }
  importCardsFromFile(f);
}

/** 导入分流：先看扩展名，再看文件头魔数 DSLCARD2 —— 改名成 .json、或没有扩展名的卡包也能进
 *  命中卡包 → 走侧车解包；否则按 JSON 卡表导入（applyJson 由调用方给） */
function openCardFile(f, applyJson) {
  if (!f) return;
  if (/\.(dslcard|dslrecipe)$/i.test(String(f.name || ""))) { importDslCard(f); return; }
  const sniff = new FileReader();
  sniff.onload = () => {
    if (String(sniff.result || "") === "DSLCARD2\n") { importDslCard(f); return; }
    const rd = new FileReader();
    rd.onload = () => {
      let raw = null;
      try { raw = JSON.parse(String(rd.result || "null")); } catch (err) { setMsg("导入失败：既不是卡包（.dslcard / .dslrecipe），也不是合法 JSON"); return; }
      applyJson(raw);
    };
    rd.onerror = () => setMsg("读取文件失败");
    rd.readAsText(f, "utf-8");
  };
  sniff.onerror = () => setMsg("读取文件失败");
  sniff.readAsText(f.slice(0, 9), "utf-8");
}

function importCardsFromFile(f) {
  if (!f) { setMsg("没拿到文件：拖拽没把 files 交过来（桌面版常见）—— 用「粘贴 JSON」"); return; }
  setMsg("收到文件：" + String(f.name || "") + "（" + Math.round(Number(f.size || 0) / 1024) + " KB），正在解析…");
  openCardFile(f, applyCardImport);
}

/** 角色卡导入核心：按卡名 upsert（同名覆盖、保留 id / 封面 / 来源文件） */
function applyCardImport(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.cards) ? raw.cards : (raw ? [raw] : []));
  clientLog("applyCardImport", "in=" + list.length + " 条 · 现有 " + ((USER.cards || []).length) + " 张");
  try { _applyCardImportBody(list); }
  catch (e) {
    clientLog("applyCardImport", "异常 " + ((e && e.message) || e) + " @ " + String((e && e.stack) || "").split("\n").slice(1, 3).join(" | "));
    setMsg("导入出错（" + ((e && e.message) || e) + "）—— 已写日志 client-err.log（v" + CLIENT_VER + "）");
  }
}
function _applyCardImportBody(list) {
  const ok = [];
  for (const c of list) {
    if (!c) continue;
    const rec = cardFromJson(c);
    if (rec) ok.push(rec);
  }
  if (!ok.length) {
    const why = list.slice(0, 3).map((c) => {
      const nm = String((c && c.name) || "").trim();
      const tg = String((c && c.tags) || "").trim();
      return "「" + (nm || "(无 name)") + "」" + (nm ? (tg ? "tags 空且 parts 拼不出词" : "缺 tags") : "缺 name");
    }).join("；");
    clientLog("applyCardImport", "0 张可用 · 收到 " + list.length + " 条 · " + why);
    setMsg("没有可导入的角色卡：" + why + "（v" + CLIENT_VER + "）");
    return;
  }
  USER.cards = USER.cards || [];
  let added = 0, updated = 0;
  for (const c of ok) {
    const nm = String(c.name || "").trim();
    const hit = USER.cards.findIndex((x) => String((x && x.name) || "").trim() === nm);
    if (hit >= 0) {
      if (!c.cover && USER.cards[hit].cover) c.cover = USER.cards[hit].cover;
      c.id = USER.cards[hit].id;
      if (!c.file && USER.cards[hit].file) c.file = USER.cards[hit].file;
      USER.cards[hit] = c; updated++;
    } else { USER.cards.push(c); added++; }
  }
  saveUser();
  setMsg("已解析 " + ok.length + " 张：新增 " + added + "，更新 " + updated + "，正在落盘…");
  persistCards(ok, "cards").then((r) => {
    if (r.ok) {
      setMsg("已导入 " + ok.length + " 张（新增 " + added + "、更新 " + updated + "）· 落盘 " + r.ok + " 张到角色卡目录");
    } else {
      setMsg("导入失败：磁盘写不进去（" + (r.errors[0] || "未知原因") + "）—— 卡没留下来。检查 config.json 的 cardsDir 是否可写");
    }
    materializeEmbedded(ok);
  });
}


/** 0.7.74：导入的卡**先落盘**再算成功。
 *  以前 applyCardImport / applyStyleImport 只写 localStorage，磁盘上什么都没有；
 *  下一次「目录即真相」同步（切页 / 重开面板 / mount 后 1.2s）看到目录为空，
 *  就把面板整类清空 —— 表现就是「导入瞬间成功，绘图台里没有」。
 *  kind: "cards" | "style" | "dict"
 */
function persistCards(list, kind) {
	const arr = (list || []).filter(Boolean);
	if (!arr.length) return Promise.resolve({ ok: 0, fail: 0, errors: [] });
	return Promise.all(arr.map((rec) => {
		rec.pendingDisk = true;
		// 0.7.92：以前这里也是白名单 —— 导入的卡落盘时丢 cover / id / embeddedDir / schemaVersion。
		// 现在以整条记录为底（剔除运行时键），白名单字段再覆盖上去，和 writeCardToDisk 0.7.85 同一套写法。
		const keep = Object.assign({}, rec || {});
		["fromDisk", "diskDir", "pendingDisk", "busy", "edit", "__file"].forEach((k) => { delete keep[k]; });
		const card = Object.assign({}, keep, {
			name: rec.name, tags: rec.tags, note: rec.note, parts: rec.parts,
			// neg 原样保留 {t,n}（中文备注不能丢），纯字符串也兼容
			neg: (rec.neg || []).map((x) => (x && typeof x === "object")
				? { t: String(x.t || ""), n: String(x.n || "") }
				: String(x || "")).filter((x) => (x && typeof x === "object") ? x.t : x),
			lora: rec.lora || "", loraW: rec.loraW, loraAlt: rec.loraAlt || "",
			locks: (rec.locks || []), conditioning: rec.conditioning || null,
		});
		if (rec.id) card.id = String(rec.id);
		if (rec.cover) card.cover = String(rec.cover);
		return jpost(EXPANDER + "/dir/write", { kind: kind, card: card, path: String(rec.file || "") }, 60000)
			.then((d) => {
				if (!d || !d.ok) throw new Error(String((d && d.error) || "写入失败"));
				rec.file = String(d.path || rec.file || "");
				rec.fromDisk = true;
				delete rec.pendingDisk;
				return { name: rec.name, ok: true, conflict: !!d.conflict, existingTags: d.existingTags || "" };
			})
			.catch((e) => ({ name: rec.name, ok: false, error: String((e && e.message) || e) }));
	})).then((rs) => {
		const ok = rs.filter((x) => x.ok).length;
		const fail = rs.length - ok;
		const errors = rs.filter((x) => !x.ok).map((x) => x.name + "：" + x.error);
		const conflicts = rs.filter((x) => x.conflict).map((x) => x.name);
		try { saveUser(); } catch (e) { }
		clientLog("persistCards", "kind=" + kind + " ok=" + ok + " fail=" + fail +
			(conflicts.length ? " conflict=" + conflicts.join(",") : "") + (errors.length ? " errors=" + errors.join(" | ") : ""));
		// 落盘成功后按磁盘重建面板：面板 = 目录，避免「内存有、界面没有」
		// 0.7.78 修：kind='cards' 以前也调 syncKindFromDisk → 走进 mergeDiskDict，
		// 会把角色卡当词库分类写进 USER.frags 和 词库 目录。角色卡必须走 syncCardsFromDisk。
		if (ok) {
			try {
				if (kind === "cards") syncCardsFromDisk({ quiet: true });
				else syncKindFromDisk(kind);
			} catch (e) { clientLog("persistCards", "sync 失败 " + e); }
		}
		return { ok: ok, fail: fail, errors: errors, conflicts: conflicts };
	});
}

/** 把磁盘上的一张卡写回它来源的文件（面板改锁 / 改词后落盘，保持文件是活的） */
function writeCardToDisk(rec) {
  try {
    /**
     * 0.7.85：落盘曾经只写上面这份白名单 —— 卡 JSON 里白名单之外的字段（`id`、`schemaVersion`、
     * `loraNote`、`cover`、`packMode` …）会被**悄悄抹掉**：面板里还在，存一次盘就没了。
     * 2026-10-22 实测 <角色卡>.json 少了 `schemaVersion: 2` 与整条 `loraNote`（只有备份里还有）。
     * 现在以「面板里那张卡」为底，白名单字段覆盖上去，其余原样保留。
     */
    const keep = Object.assign({}, rec || {});
    ["fromDisk", "diskDir", "pendingDisk", "busy", "edit", "__file"].forEach((k) => { delete keep[k]; });
    const card = {
      name: rec.name, locks: normLocks(rec.locks), tags: rec.tags, note: rec.note, parts: rec.parts,
      neg: normPart(rec.neg).map((x) => String(x.t || "")).filter(Boolean),
      lora: rec.lora, loraW: rec.loraW, loraAlt: rec.loraAlt, conditioning: condForSave(rec.conditioning),
    };
    if (rec.id) card.id = String(rec.id);
    Object.keys(keep).forEach((k) => { if (!(k in card) && keep[k] !== undefined) card[k] = keep[k]; });
    const body = { path: String((rec && rec.file) || ""), card: card };
    // 0.7.60：没有来源文件也要落盘（新建一张 <角色卡目录>/<卡名>.json），这样目录即真相才成立
    jpost(EXPANDER + "/dir/write", { kind: "cards", card: body.card, path: body.path }, 30000)
      .then((d) => {
        if (!d || !d.ok) throw new Error((d && d.error) || "unknown");
        if (!rec.file && d.path) { rec.file = d.path; rec.fromDisk = true; }
        return d;
      })
      .catch((e) => MSG("磁盘写回失败：" + ((e && e.message) || e)));
  } catch (e) { /* ignore */ }
}

function openInExplorer(url) {
	const u = String(url || "");
	const m = u.match(/[?&]filename=([^&]+)/);
	if (!m) { setMsg("这张图没有文件名信息，无法定位"); return; }
	let sub = "";
	const ms = u.match(/[?&]subfolder=([^&]*)/);
	if (ms) sub = decodeURIComponent(ms[1]);
	const payload = { filename: decodeURIComponent(m[1]), subfolder: sub };
	try {
		fetch(EXPANDER + "/open", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS), body: JSON.stringify(payload) })
			.then((r) => r.json().then((d) => ({ status: r.status, d: d })))
			.then((res) => {
				const d = res.d || {};
				if (d.ok) setMsg("已在资源管理器定位：" + (d.path || ""));
				else if (res.status === 404) setMsg("定位失败：sidecar 还是旧版本，重启一次 dsh web 后再试");
				else setMsg("定位失败：" + (d.error || d.message || "未知原因"));
			})
			.catch(() => setMsg("定位失败：连不上本地 sidecar（8199）"));
	} catch (e) { setMsg("定位失败：" + e); }
}

function cardCoverOf(c) {
		const u = (USER.cards || []).filter((x) => x && x.id === c.id)[0];
		return (u && u.cover) || c.cover || "";
	}

	/** 没有封面时按名字取色的渐变，保证每张卡都有辨识度 */
	function cardGrad(name) {
		let s = 0;
		const t = String(name || "?");
		for (let i = 0; i < t.length; i++) s = (s * 31 + t.charCodeAt(i)) % 360;
		return "linear-gradient(160deg,hsl(" + s + ",48%,45%),hsl(" + ((s + 42) % 360) + ",40%,27%))";
	}

		function cardCoverBox(c, hpx) {
		const cover = cardCoverOf(c);
		const box = { backgroundSize: "cover", backgroundPosition: "center top" };
		if (hpx) box.height = hpx + "px"; else box.aspectRatio = "3 / 4";
		if (cover) { box.backgroundImage = "url(" + cover + ")"; return h("div", { style: box }); }
		box.background = cardGrad(c.name);
		box.display = "flex"; box.alignItems = "center"; box.justifyContent = "center";
		return h("div", { style: box }, h("span", { style: { fontSize: hpx ? "30px" : "46px", fontWeight: 700, color: "rgba(var(--c-ink-rgb),.35)" } }, String(c.name || "?").slice(0, 1)));
	}

		function newCard() {
		loadLlllite();
		setCardEdit({ id: "", name: "", note: "", cover: "", neg: [], isNew: true, locks: normLocks([]), file: "", cond: normCond(null), parts: { trigger: "", base: "", hair: "", eyes: "", glasses: "", outfit: "", extra: "" } });
	}

		/** 拉一次 LLLite 资产/权重表（侧车 /lllite），编辑器与卡片角标都吃这张表 */
		async function loadLlllite() {
			try {
				const t = await jget(EXPANDER + "/lllite", 8000);
				setLllliteT(t && typeof t === "object" ? t : { assets: {}, weights: {} });
			} catch (e) {
				setLllliteT({ assets: {}, weights: {}, error: errText(e) });
			}
		}

		function editCard(c) {
		const u = (USER.cards || []).filter((x) => x && x.id === c.id)[0];
		const parts = (u && u.parts) || splitCardTags(c.tags);
		setCardEdit({ id: c.id, name: c.name || "", note: c.note || "", cover: cardCoverOf(c), parts: parts, lora: String(c.lora || ""), loraW: Number(c.loraW) > 0 ? Number(c.loraW) : 0.7, loraAlt: String(c.loraAlt || ""), cond: normCond(c.conditioning), neg: normPart((u && u.neg) || c.neg || []), isNew: false, locks: normLocks(c.locks), file: String(c.file || ""), builtin: !!c.builtin });
		loadLlllite();
		setTimeout(() => COND.check({ name: c.name || "", id: c.id || "", conditioning: normCond(c.conditioning) }, [Number(w), Number(hh)]), 0);
	}

	function delCard(c) {
		if (c.builtin) { setMsg("内置卡不能删除，可以点 ✎ 修改它的封面与标签"); return; }
		if (!window.confirm("确定删除角色卡「" + c.name + "」？\n\n会同时从磁盘文件里删掉这张卡；文件里只剩它一个时，连文件一起删。")) return;
		// 0.7.91：同 delStyleCard —— mergeDiskCards 也是「磁盘为准」，只删内存刷一次就复活。
		const nm = String(c.name || "").trim();
		const _real = (USER.cards || []).filter((x) => x && String(x.id || "") === String(c.id || ""))[0] || {};
		const _file0 = String(c.file || _real.file || "").trim();
		const dropLocal = () => {
			USER.cards = (USER.cards || []).filter((x) => x && (x.id !== c.id || String(x.name || "").trim() !== nm));
			saveUser();
		};
		const finish = (d) => {
			dropLocal();
			setMsg("已删除角色卡「" + nm + "」" + (d.deletedFile ? " · 文件已删除"
				: (d.noop ? " · 文件早已不在" : " · 从文件移除 " + String(d.removed || 0) + " 张")));
			repaintAll();
		};
		const del1 = (path) => fetch(EXPANDER + "/dir/del", {
			method: "POST",
			headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
			body: JSON.stringify({ kind: "cards", path: path, name: nm, id: String(c.id || "") }),
		}).then((r) => r.json()).then((d) => {
			if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车拒绝"));
			return d;
		});
		const byName = () => fetch(EXPANDER + "/dir/list?kind=cards", { headers: CONSOLE_HEADERS })
			.then((r) => r.json())
			.then((j) => {
				const lst = j.cards || j.items || [];
				const hit = lst.filter((x) => String((x && x.name) || "").trim() === nm)[0];
				if (!hit) throw new Error("磁盘上没有同名卡文件");
				return String(hit.__file || hit.file || "");
			});
		try { clientLog("delCard", "name=" + nm + " file=" + (_file0 || "(空)") + " 有真实记录=" + (!!_real.file)); } catch (e) {}
		Promise.resolve(_file0 || byName())
			.then((path) => { if (!path) throw new Error("找不到对应文件"); return del1(path); })
			.then(finish)
			.catch((e) => {
				dropLocal();
				setMsg("已从面板删除「" + nm + "」，但磁盘没删掉：" + String((e && e.message) || e) + " —— 同步后会回来");
				repaintAll();
			});
	}

/**
 * 0.7.87：封面「设了却没落盘」的根因修复。
 * 以前「选择图片…」「用最近一张出图」「清除封面」只改卡编辑器的内存态（setCardEdit / setStyleEdit），
 * 不按「保存」就整条丢掉 —— 表现就是「每次进控制台，卡片封面掉」。
 * 现在只要这张卡已经在磁盘上（有 d.file），设/清封面立刻写 localStorage + 卡 JSON；
 * 新卡还没落盘时才退回「先记在编辑器里，按保存一起写」。
 */
function cardRecFromEdit(d, name, id) {
  const parts = (d && d.parts) || {};
  return {
    id: id || (d.id || ("u" + String(Date.now()))), name: name, locks: normLocks(d.locks),
    tags: joinCardParts(parts), note: String(d.note || "").trim(), cover: String(d.cover || ""),
    parts: parts, neg: normPart(d.neg), lora: String(d.lora || ""),
    loraW: Number(d.loraW) > 0 ? Number(d.loraW) : 0.7, loraAlt: String(d.loraAlt || ""),
    file: String(d.file || ""), conditioning: condForSave(d.cond),
  };
}

function applyCardCover(url, note) {
  const d = cardEdit || {};
  const cover = String(url || "");
  setCardEdit((p) => Object.assign({}, p, { cover: cover }));
  const name = String(d.name || "").trim();
  const file0 = String(d.file || "").trim();
  if (!name || !file0) {
    setMsg(note || (cover ? "封面已载入（新卡要按「保存」才落盘）" : "封面已清除"));
    return;
  }
  const rec = Object.assign(cardRecFromEdit(Object.assign({}, d, { cover: cover }), name, d.id), { file: file0, cover: cover });
  USER.cards = USER.cards || [];
  let i = rec.id ? USER.cards.findIndex((x) => x && x.id && String(x.id) === String(rec.id)) : -1;
  if (i < 0) i = USER.cards.findIndex((x) => x && String(x.file || "") === file0);
  const merged = Object.assign({}, (i >= 0 ? USER.cards[i] : {}), rec);
  if (i >= 0) USER.cards[i] = merged; else USER.cards.push(merged);
  saveUser();
  writeCardToDisk(merged);
  setMsg(note || (cover ? "封面已写入卡文件" : "封面已清除并写回卡文件"));
}

function applyStyleCover(url, note) {
  const d = styleEdit || {};
  const cover = String(url || "");
  setStyleEdit((p) => Object.assign({}, p, { cover: cover }));
  const file0 = String(d.file || "").trim();
  if (!file0) { setMsg(note || (cover ? "封面已载入（新卡要按「保存」才落盘）" : "封面已清除")); return; }
  const arr = USER.styleCards || [];
  let i = arr.findIndex((x) => x && ((x.file && String(x.file) === file0) || (d.id && x.id && String(x.id) === String(d.id))));
  if (i < 0) { setMsg(note || (cover ? "封面已载入（按「保存」落盘）" : "封面已清除")); return; }
  const rec = Object.assign({}, arr[i], { cover: cover, file: file0 });
  arr[i] = rec;
  saveUser();
  dirWrite("style", rec, file0).then((r) => {
    if (r && r.ok) setMsg(note || (cover ? "封面已写入风格卡文件" : "封面已清除并写回"));
    else if (r && r.error) setMsg("封面写盘失败：" + r.error);
  }).catch(() => { });
}

/** 封面拖入：包一个伪事件复用选封面那条通道，压缩/尺寸/大小检查全都不用重写 */
/** 风格卡封面拖入：同样包伪事件复用选图通道 */
function dropStyleCoverFile(f) {
	if (!f) return;
	if (!/^image\//.test(f.type || "")) { setMsg("只能拖图片进来"); return; }
	if (typeof pickStyleCoverFile !== "function") { setMsg("这个面板没有封面入口"); return; }
	pickStyleCoverFile({ target: { files: [f] } });
}

function dropCoverFile(f) {
	if (!f) return;
	if (!/^image\//.test(f.type || "")) { setMsg("只能拖图片进来"); return; }
	pickCoverFile({ target: { files: [f] } });
}

function pickCoverFile(e) {
		const f = e && e.target && e.target.files && e.target.files[0];
		if (!f) return;
		if (!/^image\//.test(f.type || "")) { setMsg("只能选图片文件"); return; }
		const rd = new FileReader();
		rd.onload = () => {
			const img = new Image();
			img.onload = () => {
				const MAX = 360;
				const s = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
				const w = Math.max(1, Math.round((img.width || MAX) * s));
				const hh = Math.max(1, Math.round((img.height || MAX) * s));
				const cv = document.createElement("canvas");
				cv.width = w; cv.height = hh;
				cv.getContext("2d").drawImage(img, 0, 0, w, hh);
				let url = "";
				try { url = cv.toDataURL("image/jpeg", 0.82); } catch (err) { setMsg("图片转换失败：" + (err && err.message)); return; }
				if (url.length > 180000) { setMsg("压缩后仍偏大（" + Math.round(url.length / 1024) + " KB > 176 KB），换张小点的图或改用「用最近一张出图」"); return; }
				applyCardCover(url, "封面已载入（" + w + "×" + hh + "，" + Math.round(url.length / 1024) + " KB），已写入卡文件");
			};
			img.onerror = () => setMsg("这个文件读不出图片");
			img.src = String(rd.result || "");
		};
		rd.onerror = () => setMsg("读取文件失败");
		rd.readAsDataURL(f);
	}

		/** 卡资产自检：底模在不在本机 + 迁移信息齐不齐（服务端比对 ComfyUI 模型清单） */
		/** 校验任意一张卡（角色卡 / 风格卡共用）；d 缺省取当前编辑的角色卡，put 缺省写角色卡的自检状态 */
		async function validateCardAssets(d, put) {
			const c = d || cardEdit || {};
			const setter = put || setCardChk;
			try {
				const r = await jpost(EXPANDER + "/cards/validate", {
					card: { baseModels: _cardBm(c), training: parseJsonField(c.trainingText, c.training), regression: parseJsonField(c.regressionText, c.regression) },
				});
				setter(r || {});
				if (!r || !r.checked) setMsg("自检完成：ComfyUI 未启动，本次只查了迁移信息");
			} catch (e) { setMsg("自检失败：" + errText(e)); }
		}

		/** 跑回归锚：对卡上的 regression.seeds 逐个出图，参数全部取当前面板；target 缺省取当前角色卡 */
		async function runRegression(target, kind) {
			const d = target || cardEdit || {};
			const isStyle = kind === "style";
			const rg = parseJsonField(d.regressionText, d.regression) || {};
			const seeds = (rg.seeds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0);
			if (!seeds.length) { setMsg("这张卡没有 regression.seeds。先在上面「回归锚」里填，例如 {\"seeds\":[20261014,20261018]}"); return; }
			if (REG.running) { setMsg("回归锚正在跑（" + REG.cur + "/" + REG.total + "），等它结束或点「停止」"); return; }
			if (!ckpt) { setMsg("先在生成页选一个底模——回归锚用当前面板的底模与参数"); return; }
			const _cur = BG.snapshot();
			if (_cur && (_cur.status === "submitting" || _cur.status === "running")) { setMsg("生成页有任务在跑，等它结束再跑回归锚"); return; }

			let _pos = String(pos || "").trim();
			let _src = "面板当前正向词";
			if (!_pos) {
				_pos = isStyle ? (joinStyleParts(d.parts || {}) || String(d.tags || "").trim())
					: (joinCardParts(d.parts || {}) || String(d.tags || "").trim());
				_src = "卡片自带的词（面板正向为空）";
			}
			if (!_pos) { setMsg("没有可用的正向词：先在生成页插入这张卡，或给卡填标签"); return; }
			const _neg = String(neg || "").trim();

			REG.reset(d.id || d.name || "card", seeds);
			setMsg("回归锚开始：" + seeds.length + " 个 seed，参数取当前面板，正向词来自" + _src);
			let okN = 0;
			try {
				for (let i = 0; i < seeds.length; i++) {
					if (REG.cancel) { REG.update(i, { ok: false, error: "已取消" }); continue; }
					REG.cur = i + 1; REG.emit();
					// 身份控制：与 doGen 同一套 staging；失败就不带这一项，不中断整批
					let _extra = null, _wire = null;
					const _cp = COND.plan;
					if (_cp && _cp.status === "resolved") {
						try {
							const st = await jpost(EXPANDER + "/lllite/stage", { asset: _cp.asset, weights_key: _cp.weights_key }, 60000);
							if (st && st.ok) { _wire = { image: st.image, patch: st.patch, strength: _cp.strength }; _extra = { dsh_lllite: _cp }; }
						} catch (e) { /* 不带身份控制继续 */ }
					}
					const graph = buildGraph({
						ckpt, unet: ckpt, clip, clipType: effectiveClipType(ckpt, clipType, unets), vae, loras: selLoras, pos: _pos, neg: _neg,
						w: Number(w), h: Number(hh), steps: Number(steps), cfg: Number(cfg),
						sampler, scheduler, seed: seeds[i], upscale, upscaleModel, upscaleFactor,
						prefix: String(prefix || "dsh_comfy").replace(/[^\w\-]+/g, "_") + (isStyle ? "_sreg_" : "_reg_") + String(d.id || "card").replace(/[^\w\-]+/g, "_") + "_" + seeds[i],
						lllite: _wire,
					});
					await BG.run(graph, { w, h: hh, steps, cfg, seed: seeds[i], regression: d.id || d.name || "" }, _extra);
					const _pid = (BG.snapshot() || {}).pid || null;
					const r = await waitJob(900000, _pid);
					if (r.ok) okN++;
					REG.update(i, r.ok ? { ok: true, image: r.image } : { ok: false, error: r.error || "失败" });
				}
			} finally {
				REG.done();
			}
			setMsg("回归锚完成：" + okN + "/" + seeds.length + " 张成功" + (okN < seeds.length ? "，失败的 seed 见下方列表" : "，全部通过 ✓"));
		}

		function saveCard() {
		const d = cardEdit || {};
		const name = String(d.name || "").trim();
		if (!name) { setMsg("卡名不能为空"); return; }
		const parts = d.parts || {};
		const tags = joinCardParts(parts);
		if (!tags) { setMsg("至少要填一个标签（触发词或任一模块）"); return; }
		USER.cards = USER.cards || [];
		const rec = { baseModels: _cardBm(d), training: parseJsonField(d.trainingText, d.training), regression: parseJsonField(d.regressionText, d.regression), id: d.id || ("u" + String(Date.now())), name: name, locks: normLocks(d.locks), tags: tags, note: String(d.note || "").trim(), cover: String(d.cover || ""), parts: parts, neg: normPart(d.neg), lora: String(d.lora || ""), loraW: Number(d.loraW) > 0 ? Number(d.loraW) : 0.7, loraAlt: String(d.loraAlt || ""), file: String(d.file || ""), conditioning: condForSave(d.cond) };
		const i = USER.cards.findIndex((x) => x && x.id === rec.id);
		if (i >= 0) USER.cards[i] = Object.assign({}, USER.cards[i], rec); else USER.cards.push(rec);
		saveUser();
		if (rec.file) writeCardToDisk(rec);
  setCardEdit(null);
		setMsg("已保存角色卡「" + name + "」（" + tags.split(",").length + " 条标签）");
	}

		/** 另存为：复制当前草稿成一张**新卡**（不是覆盖） */
		function saveAsCard() {
			const d = cardEdit || {};
			if (!String(d.name || "").trim()) { setMsg("卡名不能为空"); return; }
			const parts = d.parts || {};
			const tags = joinCardParts(parts);
			if (!tags) { setMsg("至少要填一个标签（触发词或任一模块）"); return; }
			const name = String(window.prompt("另存为新的角色卡，名称：", String(d.name || "").trim() + " 2") || "").trim();
			if (!name) return;
			USER.cards = USER.cards || [];
			const rec = { baseModels: _cardBm(d), training: parseJsonField(d.trainingText, d.training), regression: parseJsonField(d.regressionText, d.regression), id: "u" + String(Date.now()), name: name, locks: normLocks(d.locks), tags: tags, note: String(d.note || "").trim(), cover: String(d.cover || ""), parts: JSON.parse(JSON.stringify(parts)), neg: JSON.parse(JSON.stringify(normPart(d.neg))), lora: String(d.lora || ""), loraW: Number(d.loraW) > 0 ? Number(d.loraW) : 0.7, loraAlt: String(d.loraAlt || ""), conditioning: condForSave(d.cond) };
			USER.cards.push(rec);
			saveUser();
			setCardEdit(null);
			setMsg("已另存为新卡「" + name + "」（原卡未改动）");
		}


								function cardEditor() {
									const d = cardEdit || {};
									const parts = d.parts || {};
									const set = (k, v) => setCardEdit((p) => Object.assign({}, p, { [k]: v }));
									const setPart = (k, v) => setCardEdit((p) => Object.assign({}, p, { parts: Object.assign({}, (p || {}).parts || {}, { [k]: v }) }));
									const row = { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "9px", flexWrap: "wrap", flexShrink: 0 };
									const lab = { width: "78px", fontSize: "12px", color: "var(--c-fg3)", paddingTop: "6px", flex: "none" };
									const inp = { flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.22)", background: "var(--c-card)", color: "var(--c-fg)", fontSize: "12px" };
									const chipBox = { display: "flex", flexWrap: "wrap", gap: "6px", flex: 1, alignItems: "center", minHeight: "30px" };
  const _bmText = d.baseModelsText != null ? d.baseModelsText : (Array.isArray(d.baseModels) ? d.baseModels.join(", ") : "");
  const _trText = d.trainingText != null ? d.trainingText : (d.training ? JSON.stringify(d.training) : "");
  const _rgText = d.regressionText != null ? d.regressionText : (d.regression ? JSON.stringify(d.regression) : "");
  const locksArr = Array.isArray(d.locks) ? d.locks : [];
  const setLocks = (arr) => set("locks", arr);
  const addCardLock = () => setLocks(locksArr.concat([{ name: "", tags: [], scope: "full" }]));
  const delCardLock = (i) => setLocks(locksArr.filter((_, k) => k !== i));
  const setCardLock = (i, patch) => setLocks(locksArr.map((x, k) => (k === i ? Object.assign({}, x, patch) : x)));
									const chip = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 7px", borderRadius: "4px", border: "1px solid var(--c-fg4)", background: "var(--c-panel2)", color: "var(--c-fg)", fontSize: "12px", cursor: "text" };
									const chipX = { cursor: "pointer", color: "var(--c-bad)", padding: "0 1px", fontWeight: 700 };
									const editBox = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px", borderRadius: "5px", border: "1px solid var(--c-accent)", background: "rgba(15,23,42,.30)" };
									const ciN = { width: "74px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", color: "var(--c-fg)", fontSize: "12px" };
									const ciT = { width: "150px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", color: "var(--c-fg)", fontSize: "12px" };
									const mini = Object.assign({}, CARD_BTN, { padding: "2px 8px", fontSize: "12px" });
									const addBtn = Object.assign({}, CARD_BTN, { padding: "2px 9px", fontSize: "13px" });

									const mod = (key, label, isNeg) => {
										const arr = normPart(isNeg ? d.neg : parts[key]);
										const put = (a) => { if (isNeg) set("neg", a); else setPart(key, a); setTagAt(""); setTagNote(""); setTagDraft(""); };
										const commit = (i) => {
											const t = tagDraft.trim(), n = tagNote.trim();
											const next = arr.slice();
											if (t || n) next[i] = { t: t, n: n }; else next.splice(i, 1);
											put(next);
										};
										return h("div", { style: row, key: key },
											h("span", { style: lab }, label),
											h("div", { style: chipBox },
												arr.map((x, i) => (tagAt === key + ":" + i
													? h("span", { key: "e" + i, style: editBox },
														h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
														h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
															onKeyDown: (e) => { if (e.key === "Enter") commit(i); else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
														h("button", { style: mini, onClick: () => commit(i) }, "确定"),
														h("button", { style: mini, onClick: () => { const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "删"))
													: h("span", { key: "c" + i, style: chip, title: x.t || x.n || "", onClick: () => { setTagAt(key + ":" + i); setTagNote(x.n || ""); setTagDraft(x.t || ""); } },
														(x.n || x.t || "（空）"),
														h("span", { style: chipX, title: "删掉这一条", onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "✕")))),
												tagAt === key + ":new"
													? h("span", { key: "new", style: editBox },
														h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
														h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
															onKeyDown: (e) => {
																if (e.key === "Enter") { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); else put(arr); }
																else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
														h("button", { style: mini, onClick: () => { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); else put(arr); } }, "加"),
														h("button", { style: mini, onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); } }, "取消"))
													: h("button", { key: "add", style: addBtn, title: "加一条标签", onClick: () => { setTagAt(key + ":new"); setTagNote(""); setTagDraft(""); } }, "＋")));
									};

									// ---- 身份控制（LLLite）：与「角色 LoRA」同级，插卡即自动挂条件图 ----
									const _cond = normCond(d.cond);
									const _cTable = (llliteT && llliteT.assets) || {};
									const _wTable = (llliteT && llliteT.weights) || {};
									const _cAssets = Object.keys(_cTable);
									const _cWeights = Object.keys(_wTable);
									const _cCur = _cond.presets[_cond.default] || {};
									const _cCurAsset = _cond.enabled ? String(_cCur.asset || "") : "";
									const _cCurW = String(_cCur.weights || (_cWeights[0] || ""));
									const _cCurS = Number(_cCur.strength) > 0 ? Number(_cCur.strength) : 1;
									const _cKeys = Object.keys(_cond.presets);
									const _putCond = (cond) => {
										setCardEdit((prev) => Object.assign({}, prev, { cond: cond }));
										COND.check({ name: String(d.name || ""), id: String(d.id || ""), conditioning: cond }, [Number(w), Number(hh)]);
									};
									const _chk = (COND.checkOf && COND.checkOf.name === String(d.name || "")) ? COND.checkOf.plan : null;
									const _chkColor = !_chk || _chk.status === "off" ? "var(--c-fg3)" : _chk.status === "resolved" ? "var(--c-ok)" : _chk.status === "blocked" ? "var(--c-bad)" : "var(--c-warn)";
									const _chkText = !_chk ? "未校验"
									  : _chk.status === "resolved" ? ("校验通过 · " + (_chk.preset || "") + " → " + (_chk.weights_key || "") + " · 强度 " + _chk.strength + (_chk.autoPicked ? "（已按画布比例自动换档）" : ""))
									  : _chk.status === "off" ? (_chk.reason || "未绑定")
									  : ((_chk.status === "blocked" ? "✕ " : "⚠ ") + (_chk.reason || ""));
									const _chkNote = (_chk && _chk.note) ? _chk.note : "";
									const _setLllite = (aid) => {
										const cond = normCond(d.cond);
										if (!aid) { cond.enabled = false; _putCond(cond); return; }
										const a = _cTable[aid] || {};
										const key = String(a.framing || "closeup");
										const prev = cond.presets[key] || {};
										cond.presets[key] = Object.assign({}, prev, {
											asset: aid,
											weights: prev.weights || (_cWeights[0] || ""),
											strength: prev.strength || 1,
											framing: key,
										});
										cond.enabled = true;
										cond.default = key;
										_putCond(cond);
									};
									const _patchCur = (patch) => {
										const cond = normCond(d.cond);
										const key = cond.default || (_cKeys[0] || "closeup");
										cond.presets[key] = Object.assign({}, cond.presets[key] || {}, patch, { framing: key });
										cond.enabled = !!cond.presets[key].asset;
										cond.default = key;
										_putCond(cond);
									};

									return h("div", { style: { display: "flex", flexDirection: "column", gap: "2px", maxWidth: "860px", width: "100%", minHeight: 0, paddingBottom: "6px" } },
										h("div", { style: { fontWeight: 700, fontSize: "14px", color: "var(--c-fg)", marginBottom: "10px" } }, d.isNew ? "新建角色卡" : ("编辑「" + (d.name || "") + "」" + (d.builtin ? " · 内置卡" : ""))),
										h("div", { style: row }, h("span", { style: lab }, "名称"), h("input", { style: inp, value: d.name || "", placeholder: "例如：示例角色", onChange: (e) => set("name", e.target.value) })),
										h("div", { style: row }, h("span", { style: lab }, "角色 LoRA"),
										  h("select", { style: Object.assign({}, inp, { flex: "1 1 220px" }), value: String(d.lora || ""), onChange: (e) => set("lora", e.target.value), title: "插入这张卡时自动把它切到 LoRA 列表第一项" },
										    h("option", { value: "" }, "（不用 LoRA）"),
										    (function () {
										      const cur = String(d.lora || "");
										      const list = (loras || []).slice();
										      if (cur && list.indexOf(cur) < 0) list.unshift(cur);
										      return list.map((n) => h("option", { key: n, value: n }, (list.indexOf(n) === 0 && cur && (loras || []).indexOf(cur) < 0) ? (n + "（不在 LoRA 目录）") : n));
										    })()),
										  h("input", { style: Object.assign({}, inp, { flex: "0 0 76px" }), value: String(d.loraW || 0.7), onChange: (e) => set("loraW", Number(e.target.value) || 0.7), title: "LoRA 权重" }),
										  h("button", { style: CARD_BTN, onClick: () => loraImport(), title: "把 LoRA 文件导入 ComfyUI\\models\\loras（选文件上传，或填本机绝对路径）" }, "导入"),
										  h("button", { style: CARD_BTN, onClick: () => loraDelete(d.lora), title: "把选中的这支 LoRA 搬进 models\\loras\\_trash（可恢复）" }, "删除")),
										h("div", { style: row }, h("span", { style: lab }, "LLLite"),
										  h("select", {
										    style: Object.assign({}, inp, { flex: "1 1 240px" }),
										    value: _cCurAsset,
										    title: "选中即绑定：插入这张卡时自动挂上这张控制图，与「角色 LoRA」同级，不用每次手动加",
										    onChange: (e) => _setLllite(e.target.value),
										  },
										    h("option", { value: "" }, "（不绑定条件图）"),
										    (function () {
										      const list = _cAssets.slice();
										      if (_cCurAsset && list.indexOf(_cCurAsset) < 0) list.unshift(_cCurAsset);
										      return list.map((aid) => {
										        const a = _cTable[aid] || {};
										        const missing = !_cTable[aid];
										        return h("option", { key: aid, value: aid }, aid + (missing ? "（资产表里没有）" : " · " + (a.framing || "?") + " · " + (a.w || "?") + "×" + (a.h || "?")));
										      });
										    })()),
										  h("select", {
										    style: Object.assign({}, inp, { flex: "0 0 118px" }),
										    value: _cCurW,
										    title: "权重档（LLLite safetensors）",
										    onChange: (e) => _patchCur({ weights: e.target.value }),
										  }, _cWeights.length ? _cWeights.map((k) => h("option", { key: k, value: k }, k)) : h("option", { value: "" }, "（无）")),
										  h("input", {
										    style: Object.assign({}, inp, { flex: "0 0 64px" }),
										    value: String(_cCurS),
										    title: "条件强度：1.0 为准；超过 1.3 会把线稿笔触带进画面",
										    onChange: (e) => _patchCur({ strength: Number(e.target.value) || 1 }),
										  }),
										  h("button", {
										    style: CARD_BTN,
										    title: "按当前画布尺寸校验一遍：控制图/权重是否就位、framing 与宽高比是否匹配",
										    onClick: () => COND.check({ name: String(d.name || ""), id: String(d.id || ""), conditioning: normCond(d.cond) }, [Number(w), Number(hh)]),
										  }, "校验"),
										  h("button", {
										    style: CARD_BTN,
										    title: "把本地 PNG 线条稿导入控制图库（写到 _cond/ 并登记 assets.json），导入后自动绑到当前档",
										    onClick: () => { const el = document.getElementById("dsh-cond-import"); if (el) el.click(); },
										    // 也可以把 PNG 线条稿直接拖到这个按钮上
										    ...dropFileProps(["png"], async (good) => {
										      const f = good[0];
										      try {
										        const b64 = await new Promise((res, rej) => {
										          const fr = new FileReader();
										          fr.onload = () => res(String(fr.result || "").split(",")[1] || "");
										          fr.onerror = rej;
										          fr.readAsDataURL(f);
										        });
										        const r = await jpost(EXPANDER + "/lllite/assets/add", { name: f.name, b64: b64, framing: "closeup" }, 30000);
										        if (!r || !r.ok) { setMsg("导入失败：" + ((r && r.error) || "sidecar 没响应")); return; }
										        await loadLlllite();
										        _setLlllite(r.asset);
										        setMsg("已导入 " + r.asset + "（" + r.w + "×" + r.h + "，比例 " + r.ratio + "），并绑到当前档");
										      } catch (err) { setMsg("导入失败：" + errText(err)); }
										    }, { onReject: () => setMsg("拖错了：控制图只收 .png 线条稿") }),
										  }, "导入控制图"),
										  h("input", {
										    id: "dsh-cond-import", type: "file", accept: "image/png", style: { display: "none" },
										    onChange: async (e) => {
										      const f = e.target.files && e.target.files[0];
										      e.target.value = "";
										      if (!f) return;
										      try {
										        const b64 = await new Promise((res, rej) => {
										          const fr = new FileReader();
										          fr.onload = () => res(String(fr.result || "").split(",")[1] || "");
										          fr.onerror = rej;
										          fr.readAsDataURL(f);
										        });
										        const r = await jpost(EXPANDER + "/lllite/assets/add", { name: f.name, b64: b64, framing: "closeup" }, 30000);
										        if (!r || !r.ok) { setMsg("导入失败：" + ((r && r.error) || "sidecar 没响应")); return; }
										        await loadLlllite();
										        _setLlllite(r.asset);
										        setMsg("已导入 " + r.asset + "（" + r.w + "×" + r.h + "，比例 " + r.ratio + "），并绑到当前档");
										      } catch (err) { setMsg("导入失败：" + errText(err)); }
										    },
										  }),
										  h("span", { style: { fontSize: "11.5px", color: _chkColor, fontWeight: 600, maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: _chkText }, _chkText)),
										h("div", { style: { fontSize: "11.5px", color: "var(--c-fg4)", margin: "-4px 0 10px" } },
										  _cond.enabled
										    ? ("已绑定：" + (_cCurAsset || "（未选资产）") + " · " + (_cCurW || "无权重档") + " · 档位「" + (_cond.default || "-") + "」" + (_cKeys.length > 1 ? "（卡内另有 " + (_cKeys.length - 1) + " 档保留）" : "") + " ✓ 插入卡即自动挂上；生图时按画布比例校验，不匹配会在消息里明说")
										    : "未绑定条件图：插入只加标签与 LoRA（老卡行为）。选一张控制图，这张卡就自带身份约束。导入的线条稿按自身比例参与相称判定，比例不对会自动换档或明说。"),
										_chkNote ? h("div", { style: { fontSize: "11.5px", color: "var(--c-warn)", margin: "-6px 0 10px" } }, _chkNote) : null,
										h("div", { style: row }, h("span", { style: lab }, "触发词"), h("input", { style: inp, value: parts.trigger || "", placeholder: "一个词，例如 @mychar", onChange: (e) => setPart("trigger", e.target.value) })),
										h("div", { style: { fontSize: "12px", color: "var(--c-fg4)", margin: "2px 0 10px" } }, "胶囊显示的是中文备注 ✓ 点胶囊可同时改「中文备注」和「提示词本体」✓ Enter 确定 · Esc 取消 · ✕ 删除 · ＋ 添加 ✓ 保存时只把提示词本体按顺序拼成完整串"),
										mod("base", "基础"),
										mod("hair", "发型"),
										mod("eyes", "眼睛"),
																		mod("glasses", "眼镜 · 配饰"),
										mod("outfit", "服饰"),
										mod("extra", "其它"),
		h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "8px 0 4px" } }, "负面词条（插入时自动进「负面」提示词，用来稳住角色）"),
		mod("neg", "负面", true),
										h("div", { style: { fontSize: "12px", color: "var(--c-fg3)", margin: "4px 0 10px", wordBreak: "break-word" } }, "拼出来的完整提示词：" + (joinCardParts(parts) || "（空）")),
										        h("div", { style: row }, h("span", { style: lab }, "特征锁（" + locksArr.length + " 条）"),
          h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" } },
            locksArr.map((L, i) => h("div", { key: "lk" + i, style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } },
              h("input", { style: Object.assign({}, inp, { flex: "0 0 92px" }), value: L.name || "", placeholder: "名称", title: "中文备注，仅显示用", onChange: (e) => setCardLock(i, { name: e.target.value }) }),
              h("input", { style: Object.assign({}, inp, { flex: "1 1 200px" }), value: (L.tags || []).join(", "), placeholder: "要锁住的词，逗号分隔（例：blonde hair, red eyes）", onChange: (e) => setCardLock(i, { tags: String(e.target.value).split(",").map((x) => x.trim()).filter(Boolean) }) }),
              h("select", { style: Object.assign({}, inp, { flex: "0 0 96px" }), value: L.scope || "full", title: "什么时候生效", onChange: (e) => setCardLock(i, { scope: e.target.value }) },
                h("option", { value: "full" }, "完整插入"),
                h("option", { value: "swap" }, "换装"),
                h("option", { value: "both" }, "两者")),
              h("button", { style: CARD_BTN, title: "删掉这条锁", onClick: () => delCardLock(i) }, "✕"))),
            h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
h("button", { style: CARD_BTN, onClick: addCardLock }, "＋ 新增特征锁"),
              h("span", { style: { fontSize: "11.5px", color: "var(--c-fg4)" } }, "每条锁干两件事：命中禁词就从正向剔进负向；生效时正向里有裙装就强制 black skirt。范围由「完整插入 / 换装 / 两者」决定")))),

        h("div", { style: row }, h("span", { style: lab }, "备注"), h("input", { style: inp, value: d.note || "", placeholder: "可选，例如：主角色 / 备用服装", onChange: (e) => set("note", e.target.value) })),
										h("div", { style: row }, h("span", { style: lab }, "封面"),
											h("div", { style: { width: "54px", height: "72px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(var(--c-ink-rgb),.12)", flex: "none" } }, cardCoverBox(d, 72)),
											h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 } },
												h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
													h("label", Object.assign({ style: CARD_BTN },
														// 也可以把图片直接拖到这个按钮上
														dropFileProps(["png", "jpg", "jpeg", "webp", "gif"], (good) => dropCoverFile(good[0]),
															{ onReject: () => setMsg("拖错了：封面只收图片") })), "选择图片…",
														h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: pickCoverFile })),
													(job && job.image) ? h("button", { style: CARD_BTN_ACCENT, onClick: () => applyCardCover(job.image, "已用最近一张出图当封面，并写入卡文件") }, "用最近一张出图") : null,
													h("button", { style: CARD_BTN, onClick: () => applyCardCover("") }, "清除封面")),
												h("input", { style: Object.assign({}, inp, { flex: "none" }), value: String(d.cover || "").indexOf("data:") === 0 ? "（本地图片，已压缩内嵌）" : (d.cover || ""), placeholder: "或粘贴图片地址 https://…", onChange: (e) => set("cover", e.target.value), onBlur: (e) => applyStyleCover(e.target.value) }))),
										h("div", { style: { display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" } },
											h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "12px 0 4px" } }, "资产与迁移（可选 · 让这张卡能跨机器、跨底模活下去）")),
										h("div", { style: row }, h("span", { style: lab }, "底模"),
											h("input", { style: inp, value: _bmText, placeholder: "逗号分隔，例如 <底模>.safetensors", onChange: (e) => { set("baseModelsText", e.target.value); setCardChk(null); } })),
										h("div", { style: { fontSize: "11.5px", color: "var(--c-fg4)", margin: "-4px 0 8px" } }, "写清这张卡是在哪个底模上调出来的。换机或换底模之后，点「自检」就能知道还能不能用。"),
										h("div", { style: row }, h("span", { style: lab }, "训练记录"),
											h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _trText, placeholder: '{"steps":3000,"rank":64,"datasetHash":"..."}', onChange: (e) => { set("trainingText", e.target.value); setCardChk(null); } })),
										h("div", { style: row }, h("span", { style: lab }, "回归锚"),
											h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _rgText, placeholder: '{"seeds":[20261014,20261018],"framing":"portrait"}', onChange: (e) => { set("regressionText", e.target.value); setCardChk(null); } })),
										h("div", { style: row }, h("span", { style: lab }, "自检"),
											h("div", { style: { flex: 1, minWidth: 0 } },
												h("button", { style: CARD_BTN, onClick: () => validateCardAssets(cardEdit, setCardChk) }, "校验底模与迁移信息"),
												cardChk ? h("div", { style: { fontSize: "11.5px", marginTop: "6px", whiteSpace: "pre-wrap", color: (cardChk.missingBaseModels && cardChk.missingBaseModels.length) ? "var(--c-bad)" : "var(--c-ok)" } },
													(cardChk.checked ? ((cardChk.missingBaseModels || []).length ? "缺失底模：" + cardChk.missingBaseModels.join(", ") : "底模齐全 ✓") : "ComfyUI 未启动，未校验底模") + ((cardChk.notes || []).length ? " ｜ " + (cardChk.notes || []).join(" ｜ ") : "")) : null)),
										h("div", { style: row }, h("span", { style: lab }, "跑回归"),
											h("div", { style: { flex: 1, minWidth: 0 } },
												h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
													h("button", { style: CARD_BTN, onClick: () => runRegression(cardEdit, "role"), title: "对这张卡的 regression.seeds 逐个出图；底模、尺寸、步数、CFG、采样品都取当前面板" }, REG.running ? ("回归中 " + REG.cur + "/" + REG.total + "…") : "跑回归锚"),
													REG.running ? h("button", { style: CARD_BTN, onClick: () => REG.stop() }, "停止") : null,
													h("span", { style: { fontSize: "11px", color: "var(--c-fg4)" } }, "同一套参数换 seed 逐个跑，结果留在下方（本机历史里也能查到）")),
												(REG.results && REG.results.length) ? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } },
													REG.results.map((r, i) => h("div", { key: "rgres" + i, style: { width: "86px" } },
														r.image ? h("img", { src: r.image, style: { width: "86px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.12)", display: "block" } }) : null,
														h("div", { style: { fontSize: "10.5px", marginTop: "2px", wordBreak: "break-all", color: r.ok === true ? "var(--c-ok)" : (r.ok === false ? "var(--c-bad)" : "var(--c-fg4)") } },
															"seed " + r.seed + (r.ok === true ? " ✓" : (r.ok === false ? " ✗ " + (r.error || "") : " 等待")))))) : null)),
										h("div", {
											style: {
												display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
												marginTop: "16px", padding: "10px 0 6px",
												borderTop: "1px solid rgba(var(--c-ink-rgb),.10)",
												flex: "0 0 auto", background: "var(--c-card)",
												flexShrink: 0,
											},
										},
											h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { padding: "6px 20px", flexShrink: 0 }), onClick: saveCard, title: "保存这张卡（也可以按 Ctrl+Enter）" }, "保存"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: saveAsCard, title: "复制成一张新的角色卡，原卡保持不变" }, "另存为"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => exportCardPack([d], "role", "all"), title: "全量卡包：角色 LoRA + 两支 LLLite 权重 + 5 张控制图，对方解包即用（约 235 MB）" }, "导出全量卡包"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => revealCardFile("cards", d.file || ""), title: d.file ? ("在资源管理器里选中这张卡的 JSON：" + d.file) : "这张卡还没落盘（点保存才写进 cardsDir）—— 先打开角色卡目录" }, "打开文件位置"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); setCardEdit(null); setMsg("已取消"); } }, "取消"),
											(d.isNew || d.builtin) ? null : h("button", { style: Object.assign({}, CARD_BTN_DANGER, { flexShrink: 0 }), onClick: () => { const cc = cardEdit; setCardEdit(null); delCard(cc); } }, "删除这张"),
											h("span", { style: { fontSize: "11px", color: "var(--c-fg3)", flex: "1 1 160px", minWidth: 0 } }, "封面自动压缩到 ≤560px 存本地")));
								}

		/** 插入风格卡：core=false 全量；core=true 去掉「光影 / 其它」，方便试不同氛围 */
		function applyStyleInsert(c, core, mode) {
		  const parts0 = (c.parts && typeof c.parts === "object") ? c.parts : null;
		  const full = String(c.tags || "").trim() || (parts0 ? joinStyleParts(parts0) : "");
		  let tags = full;
		  if (core) {
		    const pp = parts0 || splitStyleTags(full);
		    tags = joinStyleParts(Object.assign({}, pp, { light: [], extra: [] }));
		  }
		  const ng = normPart(c.neg).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
		  const add = (cur, extra) => {
		    const have = new Set(String(cur || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean));
		    const list = String(extra || "").split(",").map((x) => x.trim()).filter(Boolean).filter((t) => !have.has(t.toLowerCase()));
		    const base = String(cur || "").replace(/[\s,]+$/, "");
		    if (!list.length) return { t: base, n: 0 };
		    return { t: base ? base + ", " + list.join(", ") : list.join(", "), n: list.length };
		  };
		  const _rp = add(String(pos || ""), tags);
		  const _rn = add(String(neg || ""), ng);
		  const np = _rp.n, nn = _rn.n;
		  setPos(_rp.t);
		  setNeg(_rn.t);
		  const chain = normStyleLoras(c);
		  const direct = mode === "direct";
		  const mk = (l) => ({ name: l.name, model: l.w, clip: l.w, src: "style" });
		  let loraMsg = "";
		  if (direct) {
		    loraMsg = chain.length ? " · 直插：LoRA 已清空，只挂 " + chain.map((l) => shortLora(l.name) + " " + l.w).join(" + ") : " · 直插：LoRA 已清空（这张卡没挂 LoRA）";
		    setSelLoras(chain.map(mk));
		  } else if (chain.length) {
		    const list = (selLoras || []).filter(Boolean).map((x) => Object.assign({}, x));
		    const added = [];
		    for (const l of chain) {
		      const i = list.findIndex((x) => x && x.name === l.name);
		      if (i >= 0) list[i] = Object.assign({}, list[i], { model: l.w, clip: l.w, src: list[i].src || "style" });
		      else { list.push(mk(l)); added.push(shortLora(l.name) + " " + l.w); }
		    }
		    loraMsg = " · 叠插（融合）：新增 " + (added.length ? added.join(" + ") : "0 个（都已存在，只更新强度）") + "，现有共 " + list.length + " 个 LoRA";
		    setSelLoras(list);
		  } else {
		    loraMsg = " · 叠插（这张卡没挂 LoRA，现有 LoRA 不动）";
		  }
		  let metaMsg = "";
		  if (c.ckpt) {
		    if (!ckpts || !ckpts.length || ckpts.indexOf(c.ckpt) >= 0) { setCkpt(c.ckpt); metaMsg += " · 底模 " + shortLora(c.ckpt); }
		    else metaMsg += " · 底模 " + shortLora(c.ckpt) + "（本机没有，跳过）";
		  }
		  if (c.gen) {
		    const g = c.gen || {};
		    if (Number(g.w) > 0) setW(Number(g.w));
		    if (Number(g.h) > 0) setHh(Number(g.h));
		    if (Number(g.steps) > 0) setSteps(Number(g.steps));
		    if (Number(g.cfg) > 0) setCfg(Number(g.cfg));
		    if (g.sampler) setSampler(String(g.sampler));
		    if (g.scheduler) setScheduler(String(g.scheduler));
		    metaMsg += " · " + (Number(g.w) > 0 && Number(g.h) > 0 ? g.w + "×" + g.h : "") + (Number(g.steps) > 0 ? " / " + g.steps + " 步" : "") + (Number(g.cfg) > 0 ? " / CFG " + g.cfg : "") + (g.sampler ? " / " + g.sampler : "") + (g.scheduler ? " + " + g.scheduler : "");
		  }
		  /* 插入登记：只记差集，解除时按记录精确撤（不碰你原有的同名词） */
		  try {
			const _sid = String(c.id || c.name || "");
			INSERTED.set(_sid, {
			  id: _sid, kind: "style", name: String(c.name || ""), core: !!core, direct: !!direct,
			  posTokens: diffTokens(pos, _rp.text), negTokens: diffTokens(neg, _rn.text),
			  loras: (chain || []).map((l) => ({ name: String(l.name), w: Number(l.w) })),
			  locks: [], cond: null,
			});
		  } catch (e) { }
		  setMsg("已插入风格「" + c.name + "」" + (core ? "（核心画风）" : "") + " · 正向新增 " + np + " 条" + (ng ? " · 负面新增 " + nn + " 条" : "") + loraMsg + metaMsg + " · 再点这张卡可解除");
		  setStyleSel("");
		  setStyleMenu("");
		  setStyleSub("");
		}
		
		/** 风格卡封面：和角色卡同一套渐变/压缩逻辑 */
		function styleCoverOf(c) {
		  const u = (USER.styleCards || []).filter((x) => x && x.id === c.id)[0];
		  return (u && u.cover) || c.cover || "";
		}
		
		function newStyleCard() {
		  setStyleEdit({ id: "", name: "", note: "", cover: "", neg: [], isNew: true, parts: { trigger: "", style: [], line: [], color: [], light: [], extra: [] }, loras: [], ckpt: "", gen: {} });
		  setStyleSel("");
		}
		
		function editStyleCard(c) {
		  const u = (USER.styleCards || []).filter((x) => x && x.id === c.id)[0];
		  const parts = (u && u.parts) || splitStyleTags(c.tags);
		  setStyleEdit({ id: c.id, name: c.name || "", note: c.note || "", cover: styleCoverOf(c), neg: normPart(c.neg), parts: parts, loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), file: String((u && u.file) || c.file || ""), diskDir: String((u && u.diskDir) || c.diskDir || ""), isNew: false, builtin: !!c.builtin });
		}
		
		function delStyleCard(c) {
		  if (c.builtin) { setMsg("内置风格卡不能删除，可以点「编辑」改它的标签与封面"); return; }
		  if (!window.confirm("确定删除风格卡「" + c.name + "」？\n\n会同时从磁盘文件里删掉这张卡；文件里只剩它一个时，连文件一起删。")) return;
		  // 0.7.91：不再依赖记录上的 c.file —— 从 localStorage 恢复的老卡、导入未落盘的卡都没有这个字段，
		  // 那样只能删内存，而 mergeDiskStyle 是「磁盘为准」，同步一次就复活。
		  // 这里统一走「先按 name 去磁盘清单里找文件，再让侧车删」，file 有值也走同一条路，只有一处真相。
		  const nm = String(c.name || "").trim();
		  // 删除按钮传进来的是编辑器对象（editStyleCard 构造），历史版本里没有 file 字段 ——
		  // 所以先从 USER 里的真实记录取，取不到再按 name 去磁盘清单查。
		  const _real = (USER.styleCards || []).filter((x) => x && String(x.id || "") === String(c.id || ""))[0] || {};
		  const _file0 = String(c.file || _real.file || "").trim();
		  const dropLocal = () => {
		    USER.styleCards = (USER.styleCards || []).filter((x) => x && (x.id !== c.id || String(x.name || "").trim() !== nm));
		    saveUser();
		  };
		  const finish = (d) => {
		    dropLocal();
		    setMsg("已删除风格卡「" + nm + "」" + (d.deletedFile ? " · 文件已删除"
		      : (d.noop ? " · 文件早已不在" : " · 从文件移除 " + String(d.removed || 0) + " 张")));
		    repaintAll();
		  };
		  const del1 = (path) => fetch(EXPANDER + "/dir/del", {
		    method: "POST",
		    headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
		    body: JSON.stringify({ kind: "style", path: path, name: nm, id: String(c.id || "") }),
		  }).then((r) => r.json()).then((d) => {
		    if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车拒绝"));
		    return d;
		  });
		  const byName = () => fetch(EXPANDER + "/dir/list?kind=style", { headers: CONSOLE_HEADERS })
		    .then((r) => r.json())
		    .then((j) => {
		      const lst = j.cards || j.items || [];
		      const hit = lst.filter((x) => String((x && x.name) || "").trim() === nm)[0];
		      if (!hit) throw new Error("磁盘上没有同名卡文件");
		      return String(hit.__file || hit.file || "");
		    });
		  try { clientLog("delStyleCard", "name=" + nm + " file=" + (_file0 || "(空)") + " 有真实记录=" + (!!_real.file)); } catch (e) {}
		  Promise.resolve(_file0 || byName())
		    .then((path) => { if (!path) throw new Error("找不到对应文件"); return del1(path); })
		    .then(finish)
		    .catch((e) => {
		      dropLocal();
		      setMsg("已从面板删除「" + nm + "」，但磁盘没删掉：" + String((e && e.message) || e) + " —— 同步后会回来");
		      repaintAll();
		    });
		}
		
		function pickStyleCoverFile(e) {
		  const f = e && e.target && e.target.files && e.target.files[0];
		  if (!f) return;
		  if (!/^image\//.test(f.type || "")) { setMsg("只能选图片文件"); return; }
		  const rd = new FileReader();
		  rd.onload = () => {
		    const img = new Image();
		    img.onload = () => {
		      const MAX = 360;
		      const sc = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
		      const w = Math.max(1, Math.round((img.width || MAX) * sc));
		      const hgt = Math.max(1, Math.round((img.height || MAX) * sc));
		      const cv = document.createElement("canvas");
		      cv.width = w; cv.height = hgt;
		      cv.getContext("2d").drawImage(img, 0, 0, w, hgt);
		      let url = "";
		      try { url = cv.toDataURL("image/jpeg", 0.82); } catch (err) { setMsg("图片转换失败：" + (err && err.message)); return; }
		      if (url.length > 180000) { setMsg("压缩后仍偏大（" + Math.round(url.length / 1024) + " KB > 176 KB），换张小点的图"); return; }
		      applyStyleCover(url, "封面已载入（" + w + "×" + hgt + "），已写入卡文件");
		    };
		    img.onerror = () => setMsg("这个文件读不出图片");
		    img.src = String(rd.result || "");
		  };
		  rd.onerror = () => setMsg("读取文件失败");
		  rd.readAsDataURL(f);
		}
		
		function saveStyleCard(asNew) {
		  const d = styleEdit || {};
		  const name = String(d.name || "").trim();
		  if (!name) { setMsg("卡名不能为空"); return; }
		  const parts = d.parts || {};
		  const tags = joinStyleParts(parts);
		  if (!tags) { setMsg("至少要填一个标签（触发词或任一模块）"); return; }
		  let nm = name;
		  if (asNew) {
		    nm = String(window.prompt("另存为新的风格卡，名称：", name + " 2") || "").trim();
		    if (!nm) return;
		  }
		  USER.styleCards = USER.styleCards || [];
		  const rec = { id: asNew ? ("s" + String(Date.now())) : (d.id || ("s" + String(Date.now()))), name: nm, tags: tags, note: String(d.note || "").trim(), cover: String(d.cover || ""), parts: parts, neg: normPart(d.neg), loras: normStyleLoras(d), ckpt: String(d.ckpt || ""), gen: Object.assign({}, d.gen || {}), baseModels: _styleBm(d), training: parseJsonField(d.trainingText, d.training), regression: parseJsonField(d.regressionText, d.regression) };
			  if (!asNew) { const i = USER.styleCards.findIndex((x) => x && x.id === rec.id); if (i >= 0) USER.styleCards[i] = rec; else USER.styleCards.push(rec); }
	  else USER.styleCards.push(rec);
	  saveUser();
	  dirWrite("style", rec, String(d.file || rec.file || "")).then((r) => {
	    if (r && r.ok) { rec.file = r.path; rec.fromDisk = true; saveUser(); }
	    else if (r && r.error) setMsg("风格卡已存面板，但写盘失败：" + r.error);
	  }).catch(() => { });
		  setStyleEdit(null);
		  setMsg((asNew ? "已另存为新卡「" : "已保存风格卡「") + nm + "」（" + tags.split(",").length + " 条）");
		}
		
		function exportAllStyleCards() {
		  const withBuiltin = !!window.confirm("导出时是否包含内置的 3 张风格卡？\n确定 = 包含，取消 = 只导自建卡");
  const src = (withBuiltin ? allStyleCards() : (USER.styleCards || [])).filter((c) => c && String(c.name || "").trim());
		  const cards = src.map((c) => ({ name: String(c.name || "").trim(), tags: String(c.tags || joinStyleParts(c.parts || {})).trim(), note: String(c.note || ""), cover: String(c.cover || ""), neg: normPart(c.neg), loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), baseModels: _styleBm(c), training: c.training || null, regression: c.regression || null, parts: (c.parts && typeof c.parts === "object") ? c.parts : splitStyleTags(String(c.tags || joinStyleParts(c.parts || {}))) })).filter((c) => c.tags);
		  if (!cards.length) { setMsg("还没有自建风格卡可导出（内置卡写在代码里）"); return; }
		  const obj = { version: 1, exportedAt: new Date().toISOString(), styleCards: cards };
		  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		  const ok = downloadText(JSON.stringify(obj, null, 2), "风格卡-全部-" + cards.length + "张-" + day + ".json");
		  setMsg(ok ? ("已导出 " + cards.length + " 张风格卡" + (withBuiltin ? "（含内置）" : "")) : "导出失败：浏览器不允许下载");
		}
		
		function importStyleCards(e) {
  const f = e && e.target && e.target.files && e.target.files[0];
  try { if (e && e.target) e.target.value = ""; } catch (err) {}
  if (f) importStyleCardsFromFile(f);
}

function importStyleCardsFromFile(f) {
  if (!f) return;
  openCardFile(f, applyStyleImport);
}

/** 导出卡包：幂等打包当前卡（baked=完整导出 / hybrid=快速导出 / recipe=配方导出）
 *  逐支勾选通过「内嵌哪几支」文本输入完成；留空 = 默认半烘焙两支 */

/** 自包含卡导入后：把卡内嵌的控制图落到 _cond 并写 assets.json（侧车 /cards/import） */
function materializeEmbedded(list) {
  const withImg = (list || []).filter((c) => c && c.conditioning && Object.keys(c.conditioning.presets || {}).some((k) => (c.conditioning.presets[k] || {}).image && (c.conditioning.presets[k] || {}).image.b64));
  if (!withImg.length) return;
  withImg.forEach((c) => {
    jpost(EXPANDER + "/cards/import", { card: c }, 60000).then((r) => {
      if (r && r.ok) setMsg("控制图已还原 " + (r.written || []).length + " 张（跳过 " + (r.skipped || []).length + " 张已存在）" + (r.bad && r.bad.length ? " · " + r.bad.length + " 张 sha 不符" : ""));
      else setMsg("控制图还原失败：" + ((r && r.error) || "sidecar 没响应"));
    }).catch(() => setMsg("控制图还原失败：连不上 sidecar（8199）"));
  });
}

/** 导出自包含卡（单 .json）：控制图内嵌 base64、权重清单内嵌 sha256 */

function exportCardPack(cards, cardType, presetMode) {
  const list = (cards || []).filter((c) => c && c.name);
  if (!list.length) { setMsg("没有可导出的卡"); return; }
  let card = list[0];
  if (list.length > 1) {
    const pick = window.prompt("导出哪一张？\n" + list.map((c, i) => (i + 1) + ") " + c.name).join("\n"), "1");
    if (pick === null) return;
    const idx = parseInt(pick, 10);
    card = list[Number.isFinite(idx) && idx >= 1 && idx <= list.length ? idx - 1 : 0];
  }
  // 0.7.57：没有 LoRA 就没有权重可内嵌，先本地拦下（不要等侧车回 400 让人猜）
  const _ls = [].concat(
    (Array.isArray(card.loras) ? card.loras.map((l) => (l && l.name) || l) : []),
    card.lora ? [card.lora] : []
  ).map((x) => String(x || "").trim()).filter(Boolean);
  if (!_ls.length) {
    setMsg("这张卡没挂 LoRA，全量卡包没有权重可打包 —— 先挂一支 LoRA，或用「导出全部」只存 JSON（那个不内嵌权重）");
    return;
  }
  const packAll = (presetMode === "all");
  const embedLL = (presetMode === "full" || packAll);
  if (packAll) presetMode = "baked";
  else if (presetMode === "full") presetMode = "recipe";
  let mode = presetMode;
  if (!mode) {
    mode = (window.prompt("导出档位：baked=完整导出 / hybrid=快速导出 / recipe=配方导出", "hybrid") || "").trim().toLowerCase();
    if (!mode) return;
  }
  if (["baked", "hybrid", "recipe"].indexOf(mode) < 0) { setMsg("档位只能是 baked（完整导出）/ hybrid（快速导出）/ recipe（配方导出）"); return; }
  let embed = packAll ? [String(card.lora || "").replace(/^.*[\\/]/, "").replace(/\.safetensors$/i, "")].filter(Boolean) : [];
  if (mode === "hybrid" && !packAll) {
    const def = cardType === "role" ? String(card.lora || "").replace(/^.*[\\/]/, "").replace(/\.safetensors$/i, "") : "";
    const t = window.prompt("hybrid 内嵌哪几支（逗号分隔；留空 = 默认）\n默认：" + def, def);
    if (t === null) return;
    embed = t.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/^.*[\\/]/, "").replace(/\.safetensors$/i, ""));
  }
  // 0.7.89：编辑器里的卡用 `cond` 存身份控制，卡 JSON 里叫 `conditioning`。
  // 以前把编辑器记录原样丢给打包接口 → 侧车按 `conditioning` 找权重/控制图，一个都找不到，
  // 「导出全量卡包」实际只内嵌了 LoRA。这里先翻成卡形态，再顺手剔掉编辑器专用键。
  const cardForPack = (() => {
    const c = Object.assign({}, card);
    if (!c.conditioning && c.cond) {
      try { const cc = condForSave(c.cond); if (cc) c.conditioning = cc; } catch (e) { }
    }
    ["cond", "isNew", "builtin", "edit", "busy", "pendingDisk", "fromDisk", "diskDir", "__file"].forEach((k) => { delete c[k]; });
    return c;
  })();
  setMsg("正在打包「" + card.name + "」（" + (PACK_MODE_CN[mode] || mode) + "）…");
  const sendBody = { card: cardForPack, cardType: cardType || "style", mode: mode, embed: embed, embedPatches: embedLL, embedAssets: embedLL, toDisk: true };
  fetch(EXPANDER + "/stylecards/pack", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, sidecarHeaders(EXPANDER)),
    body: JSON.stringify(sendBody),
  })
    .then((r) => {
      const ctype = String(r.headers.get("Content-Type") || "");
      if (!r.ok || ctype.indexOf("application/json") >= 0) {
        return r.json().then((j) => {
          if (!r.ok || !j || j.ok === false) throw new Error((j && (j.error || j.message)) || ("HTTP " + r.status));
          return { disk: j };
        });
      }
      let meta = {};
      try { meta = JSON.parse(r.headers.get("X-Card-Meta") || "{}"); } catch (e) {}
      return r.blob().then((b) => ({ b: b, meta: meta }));
    })
    .then((o) => {
      if (o.disk) {
        const un0 = o.disk.unresolved || [];
        setMsg("已导出到 " + o.disk.path + "（" + (o.disk.bytes / 1048576).toFixed(2) + " MB" + (o.disk.cover ? " · 含封面" : "") + "） 内嵌 " +
               (o.disk.embed || []).length + " 支 / 配方 " + (o.disk.refs || []).length + " 支" +
               (un0.length ? " ▸ " + un0.length + " 支本机没有权重（sha 为空）：" + un0.join("、") : ""));
        revealCardFile("pack", o.disk.path);
        return;
      }
      const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "card";
      const name = safeName(o.meta.filename || (card.name + (mode === "recipe" ? ".dslrecipe" : ".dslcard")));
      const url = URL.createObjectURL(o.b);
      const a2 = document.createElement("a");
      a2.href = url; a2.download = name; a2.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      const un = o.meta.unresolved || [];
      setMsg("已导出 " + name + "（" + (PACK_MODE_CN[mode] || mode) + " · " + (o.b.size / 1048576).toFixed(2) + " MB） 内嵌 " +
             (o.meta.embed || []).length + " 支 / 配方 " + (o.meta.refs || []).length + " 支" +
             (un.length ? " ▸ " + un.length + " 支本机没有权重（sha 为空）：" + un.join("、") : ""));
    })
    .catch((e) => {
      const detail = (e && (e.name ? e.name + ": " : "") + (e.message || String(e))) || "未知错误";
      clientLog("exportCardPack", "card=" + String((card && card.name) || "") + " mode=" + mode + " err=" + detail);
      setMsg("导出失败（v" + CLIENT_VER + "）：" + detail + " —— 细节已写 client-err.log，另：若一直这样请确认侧车 8199 在线");
    });
}

/** 卡片容器（.dslcard / .dslrecipe）导入：三档统一走 sidecar 解析
 *  baked  全内嵌 → 全部落盘
 *  hybrid 半烘焙 → 内嵌件落盘，其余按 名字+sha256 本地解析
 *  recipe 配方 → 全部本地解析；缺件可就地一键下载（带 url 的） */
function importDslCard(f) { uploadCardPack(f, false); }

function uploadCardPack(f, auto) {
	// 0.7.72：改成 XHR —— 有上传/解析进度、有超时、侧车掉线/返回非 JSON 都会明确报错。
	// 旧版用 fetch 且只在 promise 链上挂 catch：请求一旦悬着（侧车重启、包太大卡住），
	// 界面就永远停在「正在解析…」，看不出是传文件慢还是侧车没回。
	const nm = String((f && f.name) || "卡包");
	const mb = Math.round(Number((f && f.size) || 0) / 1048576);
	const t0 = Date.now();
	let pct = 0, tick = null, done = false;
	const stop = () => { if (tick) { clearInterval(tick); tick = null; } };
	const fail = (why) => {
		if (done) return; done = true; stop();
		try { clientLog("uploadCardPack", "file=" + nm + " mb=" + mb + " err=" + why); } catch (e) { }
		setMsg("导入失败：" + why + "（v" + CLIENT_VER + "）");
	};
	const applyUnpack = (d) => {
		if (done) return; done = true; stop();
      if (!d || !d.ok) {
        clientLog("uploadCardPack", "resp ok=false err=" + ((d && d.error) || "unknown") + " type=" + ((d && d.cardType) || ""));
        setMsg("导入失败：" + ((d && d.error) || "未知错误") + "（v" + CLIENT_VER + "）");
        return;
      }
      const miss = d.missing || [], conf = d.conflicts || [], bm = d.baseMismatch || [], dd = d.dedup || [];
      const dl = miss.filter((m) => m.source && m.source.url);
      if (!auto && dl.length) {
        const lines = dl.map((m) => "  · " + m.name + "  " + m.size + " B  ← " + m.source.url).join("\n");
        if (window.confirm("缺 " + miss.length + " 支 LoRA，其中 " + dl.length + " 支有下载地址：\n" + lines + "\n\n现在自动下载并重试？")) {
          uploadCardPack(f, true); return;
        }
      }
      let finished = false;
      const finish = (list) => {
        // 0.7.78：.then(finish) 和 .catch(() => finish(null)) 都会调到这里，
        // 以前没有守卫 → 一次导入跑两遍（日志里同秒两条 applyCardImport、两次落盘）
        if (finished) return;
        finished = true;
        const healed = healCardLoras(d.card, list);
        if (d.cardType === "role") { applyCardImport(d.card); } else { applyStyleImport(d.card); }
        const modeCn = PACK_MODE_CN[d.mode] || d.mode || "未知档位";
        setImpRep({ f: f, d: d });
        const parts = ["已导入「" + d.card.name + "」（" + modeCn + "）"];
        if (d.count) parts.push("内嵌落盘 " + d.count + " 支");
        if (dd.length) parts.push("复用本机同名同内容 " + dd.length + " 支");
        if ((d.resolved || []).length) parts.push("本地解析 " + d.resolved.length + " 支");
        if (healed.length) parts.push("路径自愈 " + healed.length + " 支");
        if (miss.length) parts.push("缺 " + miss.length + " 支");
        if (conf.length) parts.push("同名不同内容 " + conf.length + " 支");
        if (bm.length) parts.push("底模不符 " + bm.length + " 支");
        parts.push("明细见右下角导入报告");
        setMsg(parts.join("；"));
        if (healed.length) console.warn("[卡片导入] 路径自愈（卡改名/目录变动）:", healed);
        if (miss.length) console.warn("[卡片导入] 缺失 LoRA:", miss);
        if (conf.length) console.warn("[卡片导入] 同名不同内容:", conf);
        if ((d.shadowed || []).length) console.warn("[卡片导入] 全局同名但内容不同，已另存一份:", d.shadowed);
      };
      fetch(COMFY + "/object_info/LoraLoader")
        .then((r) => r.json())
        .then((oi) => {
          let list = [];
          try { list = comboOptions(oi, "LoraLoader", "lora_name"); } catch (e) {}
          finish(list);
          try { if (window.__dshSetLoras) window.__dshSetLoras(list); } catch (e) {}
        })
        .catch(() => finish(null));
	};
	const xhr = new XMLHttpRequest();
	try { xhr.open("POST", EXPANDER + "/stylecards/unpack" + (auto ? "?auto=1" : ""), true); } catch (e) { fail("打不开请求：" + e); return; }
	const hdrs = Object.assign({ "Content-Type": "application/octet-stream" }, sidecarHeaders(EXPANDER));
	Object.keys(hdrs).forEach((k) => { try { xhr.setRequestHeader(k, hdrs[k]); } catch (e) { } });
	xhr.timeout = Math.max(180000, mb * 8000);          // 每秒 8MB 的余量，175MB 包 ≈ 23 分钟上限
	xhr.upload.onprogress = (e) => { if (e.lengthComputable) pct = Math.min(99, Math.round((e.loaded / e.total) * 100)); };
	xhr.onload = () => {
		if (xhr.status !== 200) { fail("侧车返回 HTTP " + xhr.status + "：" + String(xhr.responseText || "").slice(0, 160)); return; }
		let d = null;
		try { d = JSON.parse(String(xhr.responseText || "null")); } catch (e) { fail("侧车返回的不是 JSON：" + String(xhr.responseText || "").slice(0, 120)); return; }
		clientLog("uploadCardPack", "resp ok=" + (d && d.ok) + " type=" + (d && d.cardType) + " mode=" + (d && d.mode) +
			" name=" + ((d && d.card && d.card.name) || "") + " count=" + (d && d.count) + " err=" + ((d && d.error) || ""));
		applyUnpack(d);
	};
	xhr.onerror = () => fail("上传中断：连不上侧车 8199（侧车在重启？）");
	xhr.ontimeout = () => fail("超时 " + Math.round(xhr.timeout / 1000) + "s 没返回（包 " + mb + " MB）—— 先看 8199 是否在线，再点一次导入");
	xhr.onabort = () => fail("请求被取消");
	clientLog("uploadCardPack", "send file=" + nm + " mb=" + mb + " auto=" + (auto ? 1 : 0));
	setMsg("正在解析 " + nm + "（" + mb + " MB）…");
	tick = setInterval(() => {
		const sec = Math.round((Date.now() - t0) / 1000);
		setMsg("正在解析 " + nm + " · " + sec + "s" + (pct < 100 && pct > 0 ? " · 已传 " + pct + "%" : " · 侧车处理中") + "（v" + CLIENT_VER + "）");
	}, 1000);
	try { xhr.send(f); } catch (e) { fail("发不出去：" + e); }
}

/** 卡内 LoRA 路径自愈：卡被改名、或 _dshcards/<旧卡名>/ 被删之后，
 *  按文件名在本机现有 LoRA 列表里重新对上（优先全局同名，其次子目录里的）。
 *  返回 [{from, to}]；一个都对不上就保持原样，由 missing 标记兜底。 */
function healCardLoras(card, list) {
  const out = [];
  if (!card || !list || !list.length) return out;
  const baseOf = (p) => String(p || "").split(/[\\/]/).pop().toLowerCase();
  const byBase = {};
  for (const x of list) { const b = baseOf(x); (byBase[b] = byBase[b] || []).push(String(x)); }
  const resolve = (name) => {
    const n = String(name || "");
    if (!n) return "";
    if (list.some((x) => String(x) === n)) return n;
    const cands = byBase[baseOf(n)] || [];
    if (!cands.length) return "";
    const pref = cands.filter((x) => !/[\\/]_dshcards[\\/]/i.test(x));
    return pref.length ? pref[0] : cands[0];
  };
  const fix = (obj, key) => {
    const v = obj && obj[key];
    if (!v) return;
    const r = resolve(v);
    if (r && r !== v) { out.push({ from: String(v), to: r }); obj[key] = r; }
  };
  if (Array.isArray(card.loras)) for (const l of card.loras) fix(l, "name");
  if (card.lora) fix(card, "lora");
  return out;
}

/** 风格卡导入核心：按卡名覆盖（保留 id 与封面），带 parts 就不再重切模块 */
/** 导入报告：把侧车返回的 written / dedup / resolved / missing / conflicts / baseMismatch 全摊开
 *  导出侧已经把档位、sha、来源都摆出来了，导入侧不能只闪一行字 */
function importReportPanel() {
  const d = (impRep && impRep.d) || {};
  const card = d.card || {};
  const miss = d.missing || [], conf = d.conflicts || [], bm = d.baseMismatch || [];
  const dl = miss.filter((m) => m.source && m.source.url);
  const mb = (n) => (n ? (n / 1048576).toFixed(1) + " MB" : "—");
  const sh = (s) => (s ? String(s).slice(0, 12) : "—");
  const rowStyle = { display: "flex", gap: "6px", alignItems: "baseline", fontSize: "11.5px", color: "var(--c-fg2)", wordBreak: "break-all" };
  const dim = { marginLeft: "auto", flex: "none", color: "var(--c-fg4)" };
  const tag = (txt, bg) => h("span", { style: { flex: "none", fontSize: "10.5px", padding: "0 5px", borderRadius: "999px", background: bg || "rgba(var(--c-ink-rgb),.08)", color: "var(--c-fg)" } }, txt);
  const sec = (label, arr, render) => (arr && arr.length) ? h("div", { style: { marginTop: "8px" } },
    h("div", { style: { fontSize: "11.5px", fontWeight: 700, color: "var(--c-fg)", marginBottom: "3px" } }, label + " · " + arr.length + " 支"),
    h("div", { style: { display: "flex", flexDirection: "column", gap: "3px" } }, arr.map(render))) : null;
  const modeBg = d.mode === "baked" ? "rgba(29,78,216,.14)" : (d.mode === "hybrid" ? "rgba(217,119,6,.16)" : "rgba(5,150,105,.16)");
  return h("div", { style: { position: "fixed", right: "16px", bottom: "16px", width: "410px", maxHeight: "62vh", overflow: "auto", zIndex: 2147483000, background: "var(--c-card)", color: "var(--c-fg)", border: "1px solid rgba(var(--c-ink-rgb),.16)", borderRadius: "10px", boxShadow: "0 14px 40px rgba(var(--c-ink-rgb),.28)", padding: "10px 12px" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
      h("span", { style: { fontWeight: 700, fontSize: "13px" } }, "导入报告"),
      tag(PACK_MODE_CN[d.mode] || d.mode || "未知档位", modeBg),
      tag(d.cardType === "role" ? "角色卡" : "风格卡"),
      h("span", { style: { flex: 1 } }),
      h("button", { style: CARD_BTN, onClick: () => setImpRep(null) }, "关闭")),
    h("div", { style: { fontSize: "12.5px", marginTop: "5px", fontWeight: 600, wordBreak: "break-all" } }, card.name || "（无名卡）"),
    h("div", { style: { fontSize: "11px", color: "var(--c-fg3)", marginTop: "2px", wordBreak: "break-all" } }, "落盘目录：" + (d.dir || "—")),
    sec("内嵌落盘（包里带权重）", d.written, (w) => h("div", { key: "w" + w.name, style: rowStyle },
      tag(w.sha256_ok === false ? "sha 不符" : "写入", w.sha256_ok === false ? "rgba(185,28,28,.12)" : "rgba(29,78,216,.14)"), h("span", null, w.name),
      h("span", { style: dim }, mb(w.size) + " · sha " + sh(w.sha256)))),
    sec("复用本机同名同内容（零落盘）", d.dedup, (w) => h("div", { key: "d" + w.name, style: rowStyle },
      tag(w.reused === "global" ? "全局复用" : "复用", "rgba(5,150,105,.14)"), h("span", null, w.name),
      h("span", { style: dim }, mb(w.size) + " · sha " + sh(w.sha256)))),
    sec("本地解析（包里只有配方）", d.resolved, (w) => h("div", { key: "r" + w.name, style: rowStyle },
      tag(w.sha_ok ? "sha 命中" : "sha 未校验", w.sha_ok ? "rgba(5,150,105,.14)" : "rgba(217,119,6,.16)"),
      h("span", null, w.name), h("span", { style: dim }, mb(w.size)))),
    sec("缺件（本机没有，卡里已标记缺）", miss, (m) => h("div", { key: "m" + m.name, style: rowStyle },
      tag(((m.source && m.source.kind) || "未知来源"), "rgba(185,28,28,.12)"), h("span", null, m.name),
      h("span", { style: dim }, mb(m.size) + (m.source && m.source.url ? " · 有下载地址" : " · 无地址")))),
    sec("同名不同内容（已另存一份，不覆盖）", conf, (c2) => h("div", { key: "c" + c2.name, style: rowStyle },
      tag("冲突", "rgba(217,119,6,.16)"), h("span", null, c2.name),
      h("span", { style: dim }, "卡内 " + sh(c2.want_sha) + " / 本机 " + sh(c2.got_sha)))),
    sec("底模不符（卡要求的底模本机没有）", bm, (b) => h("div", { key: "b" + b.name, style: rowStyle },
      tag("底模", "rgba(185,28,28,.12)"), h("span", null, b.name))),
    sec("已另存（全局同名但内容不同）", d.shadowed, (s2) => h("div", { key: "s" + s2.name, style: rowStyle },
      tag("另存", "rgba(var(--c-ink-rgb),.08)"), h("span", null, s2.name))),
    dl.length ? h("button", {
      style: Object.assign({}, CARD_BTN_ACCENT, { marginTop: "10px", width: "100%" }),
      onClick: () => { const ff = impRep && impRep.f; setImpRep(null); if (ff) { uploadCardPack(ff, true); } },
    }, "自动下载缺件并重试（" + dl.length + " 支有地址）") : null);
}

function applyStyleImport(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.styleCards) ? raw.styleCards : (raw && Array.isArray(raw.cards) ? raw.cards : (raw ? [raw] : [])));
  clientLog("applyStyleImport", "in=" + list.length + " 条 · 现有 " + ((USER.styleCards || []).length) + " 张");
  const ok = [];
  let added = 0, updated = 0;
  USER.styleCards = USER.styleCards || [];
  for (const c of list) {
    if (!c) continue;
    const nm = String(c.name || "").trim();
    if (!nm) continue;
    const tags = String(c.tags || joinStyleParts(c.parts || {})).trim();
    if (!tags) continue;
    const rec = { id: "s" + String(Date.now()) + "_" + ok.length, name: nm, tags: tags, note: String(c.note || ""), cover: String(c.cover || ""), parts: (c.parts && typeof c.parts === "object") ? c.parts : splitStyleTags(tags), neg: normPart(c.neg), loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), baseModels: (typeof _styleBm === "function" ? _styleBm(c) : (Array.isArray(c.baseModels) ? c.baseModels : [])), training: c.training || null, regression: c.regression || null };
    const hit = USER.styleCards.findIndex((x) => x && String(x.name || "").trim() === nm);
    if (hit >= 0) { rec.id = USER.styleCards[hit].id; if (!rec.cover && USER.styleCards[hit].cover) rec.cover = USER.styleCards[hit].cover; USER.styleCards[hit] = rec; updated++; }
    else { USER.styleCards.push(rec); added++; }
    ok.push(rec);
  }
  if (!ok.length) { setMsg("没有可导入的风格卡（每条至少要有 name 与 tags）"); return; }
  saveUser();
  setMsg("已解析 " + ok.length + " 张风格卡：新增 " + added + "，覆盖 " + updated + "，正在落盘…");
  persistCards(ok, "style").then((r) => {
    if (r.ok) setMsg("已导入 " + ok.length + " 张风格卡（新增 " + added + "、覆盖 " + updated + "）· 落盘 " + r.ok + " 张到画风目录");
    else setMsg("导入失败：磁盘写不进去（" + (r.errors[0] || "未知原因") + "）—— 检查 config.json 的 cardsDir");
  });
}
		
		/** 风格卡卡片（与角色卡同款：封面 + 名称 + 条数 + 标签预览 + 插入 ▾ / 编辑） */
		function styleTile(c) {
		  const on = styleSel === c.id;
		  const ins = INSERTED.get(c.id);
		  return h("div", { key: c.id || c.name, style: { display: "flex", flexDirection: "column", gap: "6px" } },
		    h("div", {
		      style: { position: "relative", borderRadius: "10px", overflow: "hidden", border: on ? "2px solid rgba(130,190,255,.95)" : (ins ? "2px solid " + (ins.partial ? "rgba(230,170,60,.95)" : "rgba(60,120,235,.95)") : "1px solid rgba(var(--c-ink-rgb),.14)"), background: "var(--c-panel)", cursor: "pointer" },
		      title: (c.tags || "") + (c.note ? "\n备注：" + c.note : ""),
		      onClick: () => { const _r = INSERTED.get(c.id); if (_r) { removeInserted(_r); return; } setStyleSel(on ? "" : c.id); },
		    },
		    cardCoverBox(c),
		    /* 右上角一列：插入状态（条件）在上、适配底模（always）在下，共用一个纵向容器免得互相压住 */
		    h("div", {
		      style: { position: "absolute", top: "6px", right: "6px", zIndex: 6, display: "flex",
		        flexDirection: "column", alignItems: "flex-end", gap: "4px",
		        maxWidth: "calc(100% - 12px)", pointerEvents: "none" },
		    },
		      ins ? h("span", {
		        style: { fontSize: "11px", lineHeight: "16px", padding: "0 7px", borderRadius: "999px", color: "#fff",
		          background: ins.partial ? "rgba(200,140,30,.95)" : "rgba(45,105,225,.95)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" },
		      }, ins.partial ? "部分移除" : "已插入") : null,
		      (() => { const b = bmBadge(c); return h("span", {
		        style: Object.assign({ maxWidth: "100%", fontSize: "10.5px", lineHeight: "15px", padding: "0 6px", borderRadius: "5px",
		          background: "rgba(10,10,12,.66)", color: "rgba(255,255,255,.92)",
		          border: "1px solid rgba(255,255,255,.16)", whiteSpace: "nowrap",
		          overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".2px" },
		          b.muted ? { background: "rgba(10,10,12,.42)", color: "rgba(255,255,255,.62)", borderStyle: "dashed" } : null),
		        title: b.full,
		      }, b.text); })(),
		    ),
		      h("div", { style: { padding: "8px 10px 10px" } },
		        h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
		          h("span", { style: { fontWeight: 700, fontSize: "13px", color: "var(--c-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto", minWidth: 0 } }, c.name), c.packMode ? h("span", { style: { flex: "none", fontSize: "10px", padding: "0 4px", borderRadius: "999px", background: "rgba(29,78,216,.10)", color: "var(--c-accent)" }, title: "这张卡是从「" + (PACK_MODE_CN[c.packMode] || c.packMode) + "」卡包导入的" }, (PACK_MODE_CN[c.packMode] || c.packMode)) : null, 
		          null),
		        h("div", { style: { marginTop: "3px", fontSize: "12px", color: "var(--c-fg2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.tags || "（空）"))),
		    on ? h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 } },
		      h("div", { style: { position: "relative", flex: 1, display: "flex" } },
		        h("button", {
		          style: Object.assign({}, CARD_BTN_ACCENT, { flex: 1 }),
		          title: "完整 = 全部画风条目；核心 = 去掉光影/其它（去掉光影/其它）",
		          onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setStyleMenu(styleMenu === c.id ? "" : c.id); setStyleSub(""); },
		        }, "插入 ▾"),
		        		        styleMenu === c.id ? h("div", {
		          style: { position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, minWidth: "206px", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "8px", boxShadow: "0 10px 26px rgba(var(--c-ink-rgb),.18)", padding: "4px", display: "flex", flexDirection: "column", gap: "3px" },
		          onMouseLeave: () => setStyleSub(""),
		        },
		          h("div", { style: { position: "relative" }, onMouseEnter: () => setStyleSub("direct") },
		            h("button", {
		              style: Object.assign({}, CARD_BTN_ACCENT, { width: "100%", textAlign: "left", padding: "6px 10px", display: "flex", alignItems: "center", gap: "8px" }),
		              title: "直插：先把 LoRA 列整个清空，再只挂这张风格卡的链（角色 LoRA 也会被清掉）",
		              onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setStyleSub(styleSub === "direct" ? "" : "direct"); },
		            },
		              h("span", { style: { flex: 1 } }, "直插"),
		              h("span", { style: { fontSize: "11px", opacity: 0.85, whiteSpace: "nowrap" } }, "清空 LoRA ▸")),
		            styleSub === "direct" ? h("div", {
		              style: { position: "absolute", top: 0, left: "calc(100% + 4px)", zIndex: 70, minWidth: "196px", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "8px", boxShadow: "0 10px 26px rgba(var(--c-ink-rgb),.18)", padding: "4px", display: "flex", flexDirection: "column", gap: "3px" },
		            },
		              h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { textAlign: "left", padding: "6px 10px" }), title: "清空 LoRA + 插入全部画风条目", onClick: () => applyStyleInsert(c, false, "direct") }, "完整插入（全部画风）"),
		              h("button", { style: Object.assign({}, CARD_BTN, { textAlign: "left", padding: "6px 10px" }), title: "清空 LoRA + 只留画风/线条/上色（去掉光影与其它）", onClick: () => applyStyleInsert(c, true, "direct") }, "只插核心（去掉光影/其它）")) : null),
		          h("div", { style: { position: "relative" }, onMouseEnter: () => setStyleSub("stack") },
		            h("button", {
		              style: Object.assign({}, CARD_BTN, { width: "100%", textAlign: "left", padding: "6px 10px", display: "flex", alignItems: "center", gap: "8px" }),
		              title: "叠插：一个 LoRA 都不清空，把这张卡的链叠加上去（同名只更新强度）—— 用来融合多张风格卡",
		              onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setStyleSub(styleSub === "stack" ? "" : "stack"); },
		            },
		              h("span", { style: { flex: 1 } }, "叠插"),
		              h("span", { style: { fontSize: "11px", color: "var(--c-fg4)", whiteSpace: "nowrap" } }, "叠加融合 ▸")),
		            styleSub === "stack" ? h("div", {
		              style: { position: "absolute", top: 0, left: "calc(100% + 4px)", zIndex: 70, minWidth: "196px", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "8px", boxShadow: "0 10px 26px rgba(var(--c-ink-rgb),.18)", padding: "4px", display: "flex", flexDirection: "column", gap: "3px" },
		            },
		              h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { textAlign: "left", padding: "6px 10px" }), title: "叠加融合：一个 LoRA 都不删，把这张卡的链加进去，再插全部画风条目", onClick: () => applyStyleInsert(c, false, "stack") }, "完整插入（全部画风）"),
		              h("button", { style: Object.assign({}, CARD_BTN, { textAlign: "left", padding: "6px 10px" }), title: "叠加融合 + 只留画风/线条/上色", onClick: () => applyStyleInsert(c, true, "stack") }, "只插核心（去掉光影/其它）")) : null)
		        ) : null),		      h("button", { style: Object.assign({}, CARD_BTN, { flex: 1 }), onClick: () => { setStyleSel(""); editStyleCard(c); } }, "编辑")) : null);
		}
		
		/** 风格卡编辑器（与角色卡同一套：模块 → 中文备注胶囊） */
		function styleCardEditor() {
		  const d = styleEdit || {};
		  const parts = d.parts || {};
		  const _bmText = d.baseModelsText != null ? d.baseModelsText : ((Array.isArray(d.baseModels) && d.baseModels.length) ? d.baseModels.join(", ") : String(d.ckpt || ""));
		  const _trText = d.trainingText != null ? d.trainingText : (d.training ? JSON.stringify(d.training) : "");
		  const _rgText = d.regressionText != null ? d.regressionText : (d.regression ? JSON.stringify(d.regression) : "");
		  const set = (k, v) => setStyleEdit((p) => Object.assign({}, p, { [k]: v }));
		  const setPart = (k, v) => setStyleEdit((p) => Object.assign({}, p, { parts: Object.assign({}, (p || {}).parts || {}, { [k]: v }) }));
		  const row = { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "9px", flexWrap: "wrap", flexShrink: 0 };
		  const lab = { width: "78px", fontSize: "12px", color: "var(--c-fg3)", paddingTop: "6px", flex: "none" };
		  const inp = { flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.18)", background: "var(--c-card)", color: "var(--c-fg)", fontSize: "12px" };
		  const chipBox = { display: "flex", flexWrap: "wrap", gap: "6px", flex: 1, alignItems: "center", minHeight: "30px" };

		  const chip = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 7px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", background: "var(--c-panel2)", fontSize: "12px", cursor: "pointer" };
		  const chipX = { cursor: "pointer", color: "var(--c-bad)", padding: "0 1px", fontWeight: 700 };
		  const editBox = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px", borderRadius: "5px", border: "1px dashed rgba(29,78,216,.6)", background: "var(--c-accent-bg2)" };
		  const ciN = { width: "74px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", fontSize: "12px" };
		  const ciT = { width: "150px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", fontSize: "12px" };
		  const mini = Object.assign({}, CARD_BTN, { padding: "2px 8px", fontSize: "12px" });
		  const addBtn = Object.assign({}, CARD_BTN, { padding: "2px 9px", fontSize: "13px" });
		  const mod = (key, label, isNeg) => {
		    const arr = normPart(isNeg ? d.neg : parts[key]);
		    const put = (a) => { if (isNeg) set("neg", a); else setPart(key, a); setTagAt(""); setTagNote(""); setTagDraft(""); };
		    const commit = (i) => {
		      const t = tagDraft.trim(), n = tagNote.trim();
		      const next = arr.slice();
		      if (t || n) next[i] = { t: t, n: n }; else next.splice(i, 1);
		      put(next);
		    };
		    return h("div", { style: row, key: key },
		      h("span", { style: lab }, label),
		      h("div", { style: chipBox },
		        arr.map((x, i) => (tagAt === key + ":" + i
		          ? h("span", { key: "e" + i, style: editBox },
		            h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
		            h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
		              onKeyDown: (e) => { if (e.key === "Enter") commit(i); else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
		            h("button", { style: mini, onClick: () => commit(i) }, "确定"),
		            h("button", { style: mini, onClick: () => { const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "删除"))
		          : h("span", { key: "c" + i, style: chip, title: x.t || x.n || "", onClick: () => { setTagAt(key + ":" + i); setTagNote(x.n || ""); setTagDraft(x.t || ""); } },
		            (x.n || x.t || "（空）"),
		            h("span", { style: chipX, title: "删掉这一条", onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "×")))),
		        tagAt === key + ":new"
		          ? h("span", { key: "new", style: editBox },
		            h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
		            h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
		              onKeyDown: (e) => {
		                if (e.key === "Enter") { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); }
		                else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
		            h("button", { style: mini, onClick: () => { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); } }, "添加"),
		            h("button", { style: mini, onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); } }, "取消"))
		          : h("button", { key: "add", style: addBtn, title: "加一条标签", onClick: () => { setTagAt(key + ":new"); setTagNote(""); setTagDraft(""); } }, "+")));
		  };
		  		  		  		  const gen = d.gen || {};
		  		  const setGen = (k, v) => setStyleEdit((p) => Object.assign({}, p, { gen: Object.assign({}, (p || {}).gen || {}, { [k]: v }) }));
const addLora = () => {
		    const nm = String(d.loraPick || "").trim();
		    if (!nm) { setMsg("先在下拉里选一个 LoRA"); return; }
		    const w = Number(d.loraW2) > 0 ? Number(d.loraW2) : 0.6;
		    const cur = (d.loras || []).filter((x) => x && x.name !== nm);
		    set("loras", cur.concat([{ name: nm, w: w }]));
		    set("loraPick", "");
		  };
const noNeg = normPart(d.neg).length;
		  return h("div", { style: { display: "flex", flexDirection: "column", gap: "2px", maxWidth: "860px", width: "100%", minHeight: 0, paddingBottom: "6px" } },
		    h("div", { style: { fontWeight: 700, fontSize: "14px", color: "var(--c-fg)", marginBottom: "10px" } }, d.isNew ? "新建风格卡" : ("编辑风格卡 · " + (d.name || ""))),
		    h("div", { style: row }, h("span", { style: lab }, "名称"), h("input", { style: inp, value: d.name || "", placeholder: "例如：干净线稿 · 平涂", onChange: (e) => set("name", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "触发词"), h("input", { style: inp, value: parts.trigger || "", placeholder: "画师/风格触发词，一般放最前面（可空）", onChange: (e) => setPart("trigger", e.target.value) })),
		    h("div", { style: { fontSize: "12px", color: "var(--c-fg4)", margin: "2px 0 10px" } }, "胶囊显示中文备注 ✓ 点胶囊可同时改「中文备注」与「提示词 tag」✓ 点 + 加一条"),
		    		    		    		    h("div", { style: row }, h("span", { style: lab }, "底模"),
		    		      h("select", { style: Object.assign({}, inp, { flex: "1 1 300px" }), value: String(d.ckpt || ""), onChange: (e) => set("ckpt", e.target.value), title: "插入这张卡时顺带切底模（Anima 走 UNET，不是 checkpoint）" },
		    		        h("option", { value: "" }, "（不改底模）"),
		    		        (ckpts || []).map((n) => h("option", { key: n, value: n }, n))),
		    		      h("span", { style: { fontSize: "11px", color: "var(--c-fg4)" } }, "Anima 要 aesthetic / base 这类 UNET")),
		    		    h("div", { style: row }, h("span", { style: lab }, "出图参数"),
		    		      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", flex: 1, alignItems: "center" } },
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 64px" }), value: String(gen.w || ""), placeholder: "宽", title: "宽（px）", onChange: (e) => setGen("w", Number(e.target.value) || 0) }),
		    		        h("span", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "×"),
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 64px" }), value: String(gen.h || ""), placeholder: "高", title: "高（px）", onChange: (e) => setGen("h", Number(e.target.value) || 0) }),
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 56px" }), value: String(gen.steps || ""), placeholder: "步数", title: "采样步数", onChange: (e) => setGen("steps", Number(e.target.value) || 0) }),
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 56px" }), value: String(gen.cfg || ""), placeholder: "CFG", title: "CFG", onChange: (e) => setGen("cfg", Number(e.target.value) || 0) }),
		    		        h("select", { style: Object.assign({}, inp, { flex: "0 0 150px" }), value: String(gen.sampler || ""), onChange: (e) => setGen("sampler", e.target.value), title: "采样器" },
		    		          h("option", { value: "" }, "（不改采样器）"),
		    		          (samplers || []).map((n) => h("option", { key: n, value: n }, n))),
		    		        h("select", { style: Object.assign({}, inp, { flex: "0 0 150px" }), value: String(gen.scheduler || ""), onChange: (e) => setGen("scheduler", e.target.value), title: "调度器" },
		    		          h("option", { value: "" }, "（不改调度器）"),
		    		          (schedulers || []).map((n) => h("option", { key: n, value: n }, n))))),
h("div", { style: row }, h("span", { style: lab }, "画风 LoRA"),
		      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" } },
		        h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
		          h("select", { style: Object.assign({}, inp, { flex: "1 1 260px" }), value: String(d.loraPick || ""), onChange: (e) => set("loraPick", e.target.value), title: "插入这张卡时自动把这些 LoRA 换到 LoRA 列；只替换上次由风格卡挂上的，角色 LoRA 不动" },
		            h("option", { value: "" }, "选一个画风 LoRA…"),
		            (loras || []).map((n) => h("option", { key: n, value: n }, n))),
		          h("input", { style: Object.assign({}, inp, { flex: "0 0 66px" }), value: String(d.loraW2 || 0.6), onChange: (e) => set("loraW2", Number(e.target.value) || 0.6), title: "强度" }),
		          h("button", { style: CARD_BTN, onClick: addLora }, "＋ 加入"),
		          h("button", { style: CARD_BTN, onClick: () => loraImport(), title: "把 LoRA 文件导入 ComfyUI\\models\\loras（选文件上传，或填本机绝对路径）" }, "导入"),
		          h("button", { style: CARD_BTN, onClick: () => loraDelete(d.loraPick), title: "把选中的这支 LoRA 搬进 models\\loras\\_trash（可恢复）" }, "删除")),
		        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" } },
		          (d.loras || []).length
		            ? (d.loras || []).map((l, i) => h("span", { key: "lw" + i, style: Object.assign({}, chip, { cursor: "default" }), title: l.name },
		              shortLora(l.name),
		              h("input", { style: Object.assign({}, ciN, { width: "54px" }), value: String(l.w), onChange: (e) => { const a = (d.loras || []).slice(); a[i] = { name: l.name, w: Number(e.target.value) || 0.6 }; set("loras", a); } }),
		              h("span", { style: chipX, title: "移除这个 LoRA", onClick: () => set("loras", (d.loras || []).filter((x, j) => j !== i)) }, "×")))
		            : h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "还没挂 LoRA（只插文字）")),
		        h("div", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "直插 = 清空 LoRA 后只挂这张卡；叠插 = 叠加到现有 LoRA 上（融合多张画风）· 触发词写最前 · 官方 LoRA 建议 0.35~0.5，自训 0.5~0.7"))),
h("div", { style: row }, h("span", { style: lab }, "比例"),
		      h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", flex: 1, alignItems: "center" } },
		        h("select", {
		          style: Object.assign({}, inp, { flex: "0 0 170px" }),
		          value: String((parts.proportion || {}).preset || "none"),
		          title: "插入这张卡时按这个比例注入头身比词",
		          onChange: function (e) {
		            var cur = parts.proportion || {};
		            setPart("proportion", { preset: e.target.value, custom: String(cur.custom || "") });
		          },
		        }, PROPORTION_PRESETS.map(function (pv) { return h("option", { key: pv[0], value: pv[0] }, pv[1]); })),
		        String((parts.proportion || {}).preset || "none") === "custom"
		          ? h("input", {
		              style: Object.assign({}, inp, { flex: "1 1 260px" }),
		              value: String((parts.proportion || {}).custom || ""),
		              placeholder: "自定义头身比词，逗号分隔",
		              onChange: function (e) { setPart("proportion", { preset: "custom", custom: e.target.value }); },
		            })
		          : h("span", { style: { fontSize: "12px", color: "var(--c-fg4)", flex: "1 1 220px" } },
		              "插入时注入：" + (proportionTags(parts.proportion) || "（不注入）")))),
mod("style", "画风"),
		    mod("line", "线条"),
		    mod("color", "上色"),
		    mod("light", "光影"),
		    mod("extra", "其它"),
		    h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "8px 0 4px" } }, "负面词条（插入时自动进「负面」提示词）"),
		    mod("neg", "负面", true),
		    h("div", { style: { fontSize: "12px", color: "var(--c-fg3)", margin: "4px 0 10px", wordBreak: "break-word" } }, "拼出来的风格串：" + (joinStyleParts(parts) || "（空）")),
		    h("div", { style: row }, h("span", { style: lab }, "备注"), h("input", { style: inp, value: d.note || "", placeholder: "这张卡适合什么场景", onChange: (e) => set("note", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "底模"),
		      h("input", { style: inp, value: _bmText, placeholder: "这张画风依赖的底模，逗号分隔", onChange: (e) => set("baseModelsText", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "训练记录"),
		      h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _trText, placeholder: '{"dataset":"…","steps":3000,"lr":0.0001,"note":"…"}', onChange: (e) => set("trainingText", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "回归锚"),
		      h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _rgText, placeholder: '{"seeds":[20261014,20261018]}', onChange: (e) => set("regressionText", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "自检"),
		      h("div", { style: { flex: 1, minWidth: 0 } },
		        h("button", { style: CARD_BTN, onClick: () => validateCardAssets(styleEdit || {}, setStyChk) }, "校验底模与迁移信息"),
		        styChk ? h("div", { style: { fontSize: "11.5px", marginTop: "6px", whiteSpace: "pre-wrap", color: ((styChk.missingBaseModels || []).length) ? "var(--c-bad)" : "var(--c-ok)" } },
		          (styChk.checked ? ((styChk.missingBaseModels || []).length ? "缺失底模：" + styChk.missingBaseModels.join(", ") : "底模齐全 ✓") : "ComfyUI 未启动，未校验底模") + ((styChk.notes || []).length ? " ｜ " + (styChk.notes || []).join(" ｜ ") : "")) : null)),
		    h("div", { style: row }, h("span", { style: lab }, "回归锚跑批"),
		      h("div", { style: { flex: 1, minWidth: 0 } },
		        h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
		          h("button", { style: CARD_BTN, onClick: () => runRegression(styleEdit || {}, "style"), title: "对这张风格卡的 regression.seeds 逐个出图；参数取当前面板" }, REG.running ? ("回归中 " + REG.cur + "/" + REG.total + "…") : "跑回归锚"),
		          REG.running ? h("button", { style: CARD_BTN, onClick: () => REG.stop() }, "停止") : null),
		        (REG.results && REG.results.length) ? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } },
		          REG.results.map((r, i) => h("div", { key: "srg" + i, style: { width: "86px" } },
		            r.image ? h("img", { src: r.image, style: { width: "86px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.12)", display: "block" } }) : null,
		            h("div", { style: { fontSize: "10.5px", marginTop: "2px", wordBreak: "break-all", color: r.ok === true ? "var(--c-ok)" : (r.ok === false ? "var(--c-bad)" : "var(--c-fg4)") } },
		              "seed " + r.seed + (r.ok === true ? " ✓" : (r.ok === false ? " ✗ " + (r.error || "") : " 等待")))))) : null)),
		    h("div", { style: row }, h("span", { style: lab }, "封面"),
		      h("div", { style: { width: "54px", height: "72px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(var(--c-ink-rgb),.14)", flex: "none" } }, cardCoverBox(Object.assign({}, d, { name: d.name || "?" }), 72)),
		      h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 } },
		        h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
		          h("label", Object.assign({ style: CARD_BTN },
		            // 也可以把图片直接拖到这个按钮上
		            dropFileProps(["png", "jpg", "jpeg", "webp", "gif"], (good) => dropStyleCoverFile(good[0]),
		              { onReject: () => setMsg("拖错了：封面只收图片") })), "选择图片…",
		            h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: pickStyleCoverFile })),
		          (job && job.image) ? h("button", { style: CARD_BTN_ACCENT, onClick: () => applyStyleCover(job.image, "封面已用最近一张出图，并写入卡文件") }, "用最近一张出图") : null,
		          h("button", { style: CARD_BTN, onClick: () => applyStyleCover("") }, "清除封面")),
		        h("input", { style: Object.assign({}, inp, { flex: "none" }), value: String(d.cover || "").indexOf("data:") === 0 ? "（本地上传的图片）" : String(d.cover || ""), placeholder: "也可以贴图片 URL", onChange: (e) => set("cover", e.target.value), onBlur: (e) => applyCardCover(e.target.value) }))),
		    h("div", {
		      style: {
		        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
		        marginTop: "16px", padding: "10px 0 6px",
		        borderTop: "1px solid rgba(var(--c-ink-rgb),.10)",
		        flex: "0 0 auto", background: "var(--c-card)",
		        flexShrink: 0,
		      },
		    },
		      h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { padding: "6px 20px", flexShrink: 0 }), onClick: () => saveStyleCard(false) }, "保存"),
		      h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => saveStyleCard(true), title: "复制成一张新的风格卡，原卡不变" }, "另存为"),
		      h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => exportCardPack([d], "style", "baked"), title: "全量卡包：风格 LoRA 与相关权重全部内嵌，对方解包即用" }, "导出全量卡包"),
		h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => revealCardFile("style", ""), title: "风格卡存在浏览器本地；这里打开导出的 .json / .dslcard 卡包该放的目录（本地绘画\画风）" }, "打开文件位置"),
		      h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); setStyleEdit(null); } }, "取消"),
		      (d.isNew || d.builtin) ? null : h("button", { style: Object.assign({}, CARD_BTN_DANGER, { flexShrink: 0 }), onClick: () => { const cc = styleEdit; setStyleEdit(null); delStyleCard(cc); } }, "删除这张"),
		      h("span", { style: { fontSize: "11px", color: "var(--c-fg3)", flex: "1 1 160px", minWidth: 0 } }, "封面自动压缩到 ≤560px 存本地")));
		}
		
		/** 风格卡页：与角色卡同一套布局 */
		function styleCardTab() {
		  if (styleEdit) return styleCardEditor();
		  const cards = allStyleCards();
		  const nB = cards.filter((c) => c.builtin).length;
		  return h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", padding: "4px 2px", width: "100%" } },
		    h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
		      h("span", { style: { fontWeight: 700, fontSize: "15px", color: "var(--c-fg)" } }, "风格卡"),
		      h("span", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, cards.length + " 张 · 内置 " + nB + " · 自建 " + (cards.length - nB)),
		      h("span", { style: { flex: 1 } }),
		      h("button", { style: CARD_BTN, onClick: exportAllStyleCards, title: "把自建风格卡全部导出成一个 .json" }, "导出全部"),
		      h("label", { style: Object.assign({}, CARD_BTN, { display: "inline-flex", alignItems: "center" }), title: "从 .json / .dslcard / .dslrecipe 导入风格卡" }, "导入", h("input", { type: "file", accept: ".json,.dslcard,.dslrecipe,application/json,application/octet-stream", style: { display: "none" }, onChange: importStyleCards })),
		h("button", { style: CARD_BTN, onClick: () => revealCardFile("style", ""), title: "在资源管理器里打开风格卡导出目录（本地绘画\画风）" }, "打开文件夹"),
		      h("button", { style: CARD_BTN_ACCENT, onClick: () => syncKindFromDisk("style", { force: true }), title: "重新读 本地绘画\\画风：目录里删掉的文件，面板上对应的卡也消失" }, "同步目录"),
			h("button", { style: CARD_BTN, onClick: () => dirClear("style", "风格卡"), title: "把 画风 目录整包搬到 _清空备份，并清空面板（可逆）" }, "清空"),
			h("button", { style: CARD_BTN, onClick: newStyleCard }, "+ 新建")),
		    cards.length
		      ? h("div", Object.assign({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "14px" } }, dropJsonProps(importStyleCardsFromFile)), cards.map((c) => styleTile(c)))
		      : h("div", { style: { padding: "32px", textAlign: "center", fontSize: "13px", color: "var(--c-fg3)", border: "1px dashed rgba(var(--c-ink-rgb),.12)", borderRadius: "10px" } }, "还没有风格卡，点右上角「+ 新建」"),
		    h("div", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "点卡片 = 选中 · 「插入 ▾」三级菜单：直插（清空 LoRA 后只挂这张卡）/ 叠插（叠加，用于融合多张画风）→ 完整 / 核心 · 提示词都追加到末尾、自动去重 · 封面可自定义 · 可导入导出，也可直接拖 .json / .dslcard / .dslrecipe 到卡片区"));
		}
		
		
		/** 插入角色卡：**追加**到正向/负面末尾（自动去重，不清空已有内容）
		 *  withOutfit=false 时把「服饰」模块剥掉，只插角色本体，方便同一个角色换不同衣服试 */
		function applyCardInsert(c, withOutfit) {
		  const parts0 = (c.parts && typeof c.parts === "object") ? c.parts : null;
		  const full = String(c.tags || "").trim() || (parts0 ? joinCardParts(parts0) : "");
		  let tags = full;
		  if (!withOutfit) {
		    const parts = parts0 || splitCardTags(full);
		    tags = joinCardParts(Object.assign({}, parts, { outfit: [] }));
		  }
		  let ng = normPart(c.neg).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
  let lockHit = [];
  // 特征锁：卡片自定义禁词，按 scope 决定完整插入 / 换装 / 两者
  const _scope = withOutfit ? ["full", "both"] : ["swap", "both"];
  const _allLocks = normLocks(Array.isArray(c.locks) ? c.locks : []);   // 插入只认卡里现有的锁，不再擅自补三道锁
  const _locks = _allLocks.filter((L) => L && Array.isArray(L.tags) && L.tags.length && _scope.indexOf(L.scope || "full") >= 0);
  for (const L of _locks) {
    const r = applyTagLocks(tags, ng, L.tags, L.allow);
    tags = r.pos; ng = r.neg; lockHit = lockHit.concat(r.hit);
  }
		  /** 把 extra 追加到 cur 末尾：去重（不区分大小写）、不吃掉已有内容 */
		  const appendTags = (cur, extra) => {
		    const have = new Set(String(cur || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean));
		    const add = String(extra || "").split(",").map((x) => x.trim()).filter(Boolean).filter((t) => !have.has(t.toLowerCase()));
		    const base = String(cur || "").replace(/[\s,]+$/, "");
		    if (!add.length) return { text: base, added: 0 };
		    return { text: base ? base + ", " + add.join(", ") : add.join(", "), added: add.length };
		  };
		  const _rp2 = appendTags(String(pos || ""), tags);
		  const _rn2 = appendTags(String(neg || ""), ng);
		  const addedPos = _rp2.added, addedNeg = _rn2.added;
		  setPos(_rp2.text);
		  setNeg(_rn2.text);
		  if (c.lora) {
		    setSelLoras((cur) => {
		      const wgt = Number(c.loraW) > 0 ? Number(c.loraW) : 0.7;
		      return [{ name: c.lora, model: wgt, clip: wgt }].concat((cur || []).filter((x) => x && x.name !== c.lora));
		    });
		  }
		  lockCards = lockCards.filter((x) => x.id !== (c.id || c.name)).concat([{ id: c.id || c.name, lora: c.lora || "", locks: _allLocks }]);
		  // 身份控制：与 LoRA 同构——卡若声明 conditioning，插入即自动解析条件图 + 权重档
		  if (c.conditioning && c.conditioning.enabled) COND.resolve(c, [Number(w), Number(hh)]);
		  /* 插入登记：只记差集；卡片蓝框、解除、多角色计数都靠它 */
		  try {
			const _cid = String(c.id || c.name || "");
			const _cpick = (c.conditioning && c.conditioning.enabled) ? COND.pickOf(c, Object.keys(c.conditioning.presets || {})) : "";
			INSERTED.set(_cid, {
			  id: _cid, kind: "char", name: String(c.name || ""), mode: withOutfit ? "full" : "noOutfit",
			  posTokens: diffTokens(pos, _rp2.text), negTokens: diffTokens(neg, _rn2.text),
			  loras: c.lora ? [{ name: String(c.lora), w: Number(c.loraW) > 0 ? Number(c.loraW) : 0.7 }] : [],
			  locks: [{ id: _cid, lora: c.lora || "", locks: _allLocks }],
			  cond: _cpick ? { name: String(c.name || ""), preset: _cpick } : null,
			});
		  } catch (e) { }
  setMsg("已追加「" + c.name + "」" + (withOutfit ? "（完整）" : "（不含服饰）") + " · 正向新增 " + addedPos + " 条" + (ng ? " · 负面新增 " + addedNeg + " 条" : "") + (lockHit.length ? " · 三道锁剔 " + lockHit.length + " 条→负向" : "") + (c.lora ? " · LoRA 已切到 " + c.lora : "") + (c.conditioning && c.conditioning.enabled ? " · 条件图解析中…" : ""));
		  setCardSel("");
		  setInsMenu("");
		}

/** 特征锁：卡片自定义的禁词表。tag 与锁词精确相等、或以「锁词 + 空格」开头才算命中
 *  allow：同一张卡声明的放行短语，先按整短语豁免，再判锁（否则 trench coat 会吃掉 beige long trench coat）
 *  返回 { pos, neg, hit, allowed }：命中词从正向剔除并追加到负向 */
function applyTagLocks(tags, negText, words, allow) {
  const ws = (words || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  const as = (allow || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  if (!ws.length) return { pos: String(tags || ""), neg: String(negText || ""), hit: [], allowed: [] };
  const list = String(tags || "").split(",").map((x) => x.trim()).filter(Boolean);
  const isAllowed = (t) => { const s = t.toLowerCase(); return as.some((a) => s === a || s.indexOf(a + " ") === 0); };
  const isHit = (t) => { const s = t.toLowerCase(); return ws.some((w) => s === w || s.indexOf(w + " ") === 0); };
  const allowed = list.filter(isAllowed);
  const hit = list.filter((t) => !isAllowed(t) && isHit(t));
  const pos = list.filter((t) => !(!isAllowed(t) && isHit(t))).join(", ");
  let neg = String(negText || "");
  if (hit.length) neg = mergeTags(neg, hit.join(", "));
  return { pos: pos, neg: neg, hit: hit, allowed: allowed };
}

/** 生图前稳定角色特征：把「已插入的角色卡」的锁套到最终正向/负向上
 *  - scope=swap 的锁只管「换装插入」那一刻，生图时不参与
 *  - 命中词从正向剔进负向；有锁生效且出现裙装 → 补 black skirt
 *  返回 { pos, neg, moved }：moved = 被移进负向的词数 */
function stabilizePrompt(text, negText, cards) {
  let pos = String(text || "");
  let neg = String(negText || "");
  const applied = [];
  let moved = 0;
  for (const c of (cards || [])) {
    for (const L of normLocks(c && c.locks)) {
      if ((L.scope || "full") === "swap") continue;
      applied.push(L);
      const r = applyTagLocks(pos, neg, L.tags, L.allow);
      pos = r.pos; neg = r.neg; moved += r.hit.length;
    }
  }
  return { pos: pos, neg: neg, moved: moved + (pos !== String(text || "") && !moved ? 1 : 0), locks: applied.length };
}

	function cardTile(c) {
				const on = cardSel === c.id;
				const ins = INSERTED.get(c.id || c.name);
		return h("div", { key: c.id || c.name, style: { display: "flex", flexDirection: "column", gap: "6px" } },
			h("div", {
				style: { position: "relative", borderRadius: "10px", overflow: "hidden", border: on ? "2px solid rgba(130,190,255,.95)" : (ins ? "2px solid " + (ins.partial ? "rgba(230,170,60,.95)" : "rgba(60,120,235,.95)") : "1px solid rgba(var(--c-ink-rgb),.14)"), background: "rgba(var(--c-ink-rgb),.05)", cursor: "pointer" },
				title: (c.tags || "") + (c.note ? "\n备注：" + c.note : ""),
				onClick: () => { const _r = INSERTED.get(c.id || c.name); if (_r) { removeInserted(_r); return; } setCardSel(on ? "" : c.id); },
			},
			cardCoverBox(c),
			ins ? h("span", { style: { position: "absolute", top: "6px", right: "6px", zIndex: 6, fontSize: "11px", lineHeight: "16px", padding: "0 7px", borderRadius: "999px", color: "#fff", background: ins.partial ? "rgba(200,140,30,.95)" : "rgba(45,105,225,.95)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" } }, ins.partial ? "部分移除" : "已插入") : null,
				h("div", { style: { padding: "8px 10px 10px" } },
					h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
						h("span", { style: { fontWeight: 700, fontSize: "13px", color: "var(--c-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto", minWidth: 0 } }, c.name), c.packMode ? h("span", { style: { flex: "none", fontSize: "10px", padding: "0 4px", borderRadius: "999px", background: "rgba(29,78,216,.10)", color: "var(--c-accent)" }, title: "这张卡是从「" + (PACK_MODE_CN[c.packMode] || c.packMode) + "」卡包导入的" }, (PACK_MODE_CN[c.packMode] || c.packMode)) : null, 
						null),
					h("div", { style: { marginTop: "3px", fontSize: "12px", color: "var(--c-fg2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.tags || "（空）"))),
			on ? h("div", { style: { display: "flex", gap: "6px" } },
				h("div", { style: { position: "relative", flex: 1, display: "flex" } },
				  h("button", {
				    style: Object.assign({}, CARD_BTN_ACCENT, { flex: 1 }),
				    title: "完整插入 = 连服饰一起写进去（范围含完整插入的锁生效）；不插入服饰 = 只写角色本体，方便换装试衣服（只有范围含换装的锁生效）",
				    onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setInsMenu(insMenu === c.id ? "" : c.id); },
				  }, "插入 ▾"),
				  insMenu === c.id ? h("div", {
				    style: { position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, minWidth: "170px", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "8px", boxShadow: "0 10px 26px rgba(var(--c-ink-rgb),.18)", padding: "4px", display: "flex", flexDirection: "column", gap: "3px" },
				  },
				    h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { textAlign: "left", padding: "6px 10px" }), onClick: () => applyCardInsert(c, true) }, "完整插入（含服饰）"),
				    h("button", { style: Object.assign({}, CARD_BTN, { textAlign: "left", padding: "6px 10px" }), title: "去掉服饰标签，只保留角色本体", onClick: () => applyCardInsert(c, false) }, "不插入服饰（换装）"),
				  ) : null
				),
				h("button", { style: Object.assign({}, CARD_BTN, { flex: 1 }), onClick: () => { setCardSel(""); editCard(c); }, title: (c.conditioning && c.conditioning.enabled) ? "身份控制在这张卡的编辑界面里" : "编辑标签、LoRA 与身份控制" }, "编辑")) : null);
	}

		function cardTab() {
		if (cardEdit) return cardEditor();
		const importPasted = () => {
			const raw = String(pasteText || "").trim();
			if (!raw) { setMsg("先粘贴卡 JSON"); return; }
			let obj = null;
			try { obj = JSON.parse(raw); } catch (e) { setMsg("不是合法 JSON：" + String((e && e.message) || e).slice(0, 80)); return; }
			if (!obj) { setMsg("粘贴的内容是空的"); return; }
			setPasteOpen(false);
			applyCardImport(obj);
		};
		const pasteModal = () => h("div", {
			onClick: () => setPasteOpen(false),
			style: { position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.38)", display: "flex", alignItems: "center", justifyContent: "center" },
		},
			h("div", {
				onClick: (e) => e.stopPropagation(),
				style: { width: "min(640px, 92vw)", background: "var(--c-panel)", color: "var(--c-fg)", border: "1px solid var(--c-line)",
					borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 18px 48px rgba(0,0,0,.38)" },
			},
				h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "粘贴角色卡 JSON"),
				h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "整张卡、卡数组、或 { \"cards\": [ … ] } 都能进：每条至少要有 name 与 tags。不依赖文件对话框，任何环境都能用。"),
				h("textarea", {
					value: pasteText, onChange: (e) => setPasteText(e.target.value), spellCheck: false,
					placeholder: '{ "name": "角色名", "tags": "1girl, solo, …", "neg": [], "locks": [] }',
					style: Object.assign({}, S.input || S.inp, { width: "100%", boxSizing: "border-box", height: "240px", fontFamily: "ui-monospace,Consolas,monospace", fontSize: "11.5px", lineHeight: 1.45, resize: "vertical" }),
				}),
				h("div", { style: { display: "flex", gap: "8px" } },
					h("button", { style: S.btn, onClick: importPasted }, "导入"),
					h("button", { style: S.btn2, onClick: () => setPasteOpen(false) }, "取消"),
					h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg5)" } }, "Ctrl+V 粘贴 · Esc 取消"))));
		const cards = allCards();
		const nB = cards.filter((c) => c.builtin).length;
		return h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", padding: "4px 2px", width: "100%" } },
			h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
				h("span", { style: { fontWeight: 700, fontSize: "15px", color: "var(--c-fg)" } }, "角色卡"),
				h("span", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, cards.length + " 张 · 内置 " + nB + " · 自建 " + (cards.length - nB)),
				h("span", { style: { flex: 1 } }),
				
				      h("button", { style: CARD_BTN, onClick: exportAllCards, title: "把自建卡全部导出成一个 .json 备份" }, "导出全部"),
				      h("label", { style: Object.assign({}, CARD_BTN, { position: "relative", overflow: "hidden", display: "inline-block" }), title: "从 .json / .dslcard / .dslrecipe 导入角色卡（弹不出对话框就用「粘贴 JSON」）" }, "导入",
				        h("input", { type: "file", accept: ".json,.dslcard,.dslrecipe,application/json,application/octet-stream",
				          style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: "100px" },
				          onChange: importCards })),
				      h("button", { style: CARD_BTN, onClick: () => syncCardsFromDisk({ force: true }), title: "重新扫描 config.json 的 cardsDir：磁盘上的卡直接进面板" }, "重扫磁盘"),
				      h("button", { style: CARD_BTN, onClick: () => { setPasteText(""); setPasteOpen(true); }, title: "不依赖文件对话框：把卡 JSON 粘进来" }, "粘贴 JSON"),
				h("button", { style: CARD_BTN, onClick: () => revealCardFile("cards", ""), title: "在资源管理器里打开角色卡目录（config.json 的 cardsDir）" }, "打开文件夹"),
				      h("button", { style: CARD_BTN, onClick: newCard }, "＋ 新建")),
			cards.length
				? h("div", Object.assign({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "14px" } }, dropJsonProps(importCardsFromFile)), cards.map((c) => cardTile(c)))
				: h("div", { style: { padding: "32px", textAlign: "center", fontSize: "13px", color: "var(--c-fg3)", border: "1px dashed rgba(var(--c-ink-rgb),.12)", borderRadius: "10px" } }, "还没有角色卡"),
			pasteOpen ? pasteModal() : null,
			h("div", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "点卡片 = 选中 · 下方「插入 ▾」可选完整插入 / 不插入服饰（换装用），追加到正向/负面末尾（自动去重，不清空已有） · 封面可自定义 · 可导入导出，也可直接拖 .json / .dslcard / .dslrecipe 到卡片区；磁盘上的卡由「重扫磁盘」同步 · v1051"));
	}

	// ==================== 预设页 ====================
			
function presetTab() {
		const list = USER.presets || [];
		const cats = Array.from(new Set(list.map((p) => p.cat)));
		return h(React.Fragment, null,
			h("div", { style: S.card },
				h("span", { style: S.label }, "把当前参数与提示词存成预设"),
				h("div", { style: S.row },
					h("input", { style: Object.assign({}, S.inp, { width: "150px" }), placeholder: "预设名", value: presetName, onChange: (e) => setPresetName(e.target.value) }),
			h("button", { style: Object.assign({}, CARD_BTN, { color: "var(--c-bad, #d33)" }), onClick: () => dirClear("cards", "角色卡"), title: "把 角色卡 目录里的文件整包搬到 _清空备份，并清空面板（可逆）" }, "清空"),
					h("input", { style: Object.assign({}, S.inp, { width: "130px" }), placeholder: "分类(默认)", value: presetCat, onChange: (e) => setPresetCat(e.target.value) }),
					h("button", { style: S.btn, onClick: savePreset }, "保存为预设"),
					h("span", { style: S.dim }, "存的是：正/负提示词 + 底模 + LoRA + 尺寸步数 CFG 采样器")),
				h("span", { style: S.dim }, "同名同分类会覆盖。数据存在本机 localStorage，换机器不带。")),

			// ---- 从 ComfyUI 工作流导入 ----
			h("div", {
				style: Object.assign({}, S.card, {
					borderColor: "rgba(150,120,225,.55)",
					background: "rgba(150,120,225,.08)",
				}),
			},
				h("span", { style: S.label }, "从 ComfyUI 工作流导入（支持 UI 格式与 API 格式）"),
				h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
					h("button", { style: S.btn2, onClick: pickWfFile }, "选择 .json 文件"),
					h("button", { style: S.btn, onClick: doParseWf }, "解析"),
					wfResult && wfResult.ok ? h("button", { style: S.btn, onClick: saveWfAsPreset }, "存成预设并套用") : null,
					wfText ? h("button", { style: S.btn2, onClick: () => { setWfText(""); setWfResult(null); setMsg("已清空"); } }, "清空") : null),
				h("textarea", Object.assign({
					style: Object.assign({}, S.ta, { height: "90px" }),
					placeholder: "把 ComfyUI 的工作流 JSON 粘到这里，或直接把 .json / .png 拖进来",
					value: wfText, onChange: (e) => setWfText(e.target.value),
				},
					// 拖工作流进来：直接读进输入框（.png 里也常带 workflow，交给解析器判断）
					dropFileProps(["json", "png", "webp"], (good) => {
						const f = good[0];
						const rd = new FileReader();
						rd.onload = () => { setWfText(String(rd.result || "")); setMsg("已读入 " + f.name + "（" + Math.round(f.size / 1024) + " KB），点「解析」"); };
						rd.onerror = () => setMsg("读文件失败");
						rd.readAsText(f, "utf-8");
					}, { onReject: (l) => setMsg("拖错了：工作流只收 " + l.map((x) => "." + x).join(" / ")) }))),
				wfResult ? (wfResult.ok
					? h("div", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px" } },
						h("span", { style: S.ok }, "解析成功（格式：" + wfResult.format + "）"),
						h("span", null, "底模：" + (wfResult.ckpt || "（没找到）")),
						h("span", null, "CLIP：" + (wfResult.clip || "（没找到）") + (wfResult.clipType ? " / " + wfResult.clipType : "")),
						h("span", null, "VAE：" + (wfResult.vae || "（没找到）")),
						h("span", null, "LoRA：" + (wfResult.loras.length
							? wfResult.loras.map((l) => l.name.replace(/\.safetensors$/, "") + "@" + l.model).join("、")
							: "（无）")),
						h("span", null, "尺寸：" + wfResult.w + "×" + wfResult.h + "　步数：" + wfResult.steps
							+ "　CFG：" + wfResult.cfg + "　采样：" + wfResult.sampler + "/" + wfResult.scheduler),
						h("span", null, "正向 " + (wfResult.pos || "").length + " 字符　负向 " + (wfResult.neg || "").length + " 字符"),
						wfResult.dangling && wfResult.dangling.length
							? h("span", { style: S.warn }, "⚠ 悬空 LoRA（输出没接任何节点，已忽略）：" + wfResult.dangling.join("；"))
							: null,
						wfResult.ignored && wfResult.ignored.length
							? h("span", { style: S.warn }, "⚠ 这些节点没有对等字段，不会带进预设：" + wfResult.ignored.join("、"))
							: null,
						h("span", { style: S.dim }, wfResult.notes.join(" | ")),
						h("span", { style: S.dim }, "※ 导入只提取预设能表达的字段；放大 / ControlNet / 细节修复等节点不会被复现。"))
					: h("span", { style: S.bad }, "解析失败：" + wfResult.error)) : null),

			list.length === 0
				? h("div", { style: S.card }, h("span", { style: S.dim }, "还没有预设。填个名字点「保存为预设」即可。"))
				: cats.map((c) => h("div", { key: c, style: S.card },
					h("span", { style: S.label }, "分类：" + c),
					h("div", { style: { display: "flex", flexDirection: "column", gap: "5px" } },
						list.filter((p) => p.cat === c).map((p, i) => h("div", {
							key: i,
							style: { display: "flex", gap: "8px", alignItems: "center", padding: "4px 6px", borderRadius: "5px", background: "rgba(127,127,127,.08)" },
						},
							h("span", { style: { flex: 1, fontSize: "12.5px" } }, p.name),
							h("span", { style: S.dim }, (p.w || "?") + "×" + (p.h || "?") + " · " + (p.steps || "?") + "步 · cfg" + (p.cfg || "?")),
							h("button", { style: S.btn2, onClick: () => loadPreset(p) }, "套用"),
							h("button", { style: S.btn2, onClick: () => delPreset(p) }, "删除")))))));
	}


	// ==================== 组装 ====================
	return h("div", { ref: rootRef, className: "dcomfy-panel", style: Object.assign({}, S.wrap, resolveTheme(theme, systemDark), availH ? { height: availH + "px", maxHeight: availH + "px", minHeight: 0 } : null) },
		h("style", { key: "dcomfy-theme-css" }, PANEL_CSS),
		// 顶栏
		h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
			h("div", { style: { display: "flex", gap: "10px", alignItems: "baseline", flexWrap: "wrap", minWidth: 0, flex: "1 1 auto" } },
				h("strong", { style: { fontSize: "15px" } }, "ComfyUI 绘图台"),
						h("span", { style: { fontSize: "11px", color: "var(--c-fg5)", letterSpacing: ".3px" }, title: "插件版本（/version 的 loaded 字段，= 当前进程装载的代码版本）" }, (ver && ver.loaded ? "v" + ver.loaded : "v?") + " · " + (rW > 0 ? rW + "px" : "?")),
						(ver && ver.stale)
							? h("span", {
								style: { fontSize: "11px", color: "var(--c-bad2)", border: "1px solid var(--c-bad2)", borderRadius: "4px", padding: "0 4px" },
								title: "磁盘上已是 v" + ver.disk + "，本进程还跑着 v" + ver.loaded + "。ESM 缓存按进程，刷新页面无效——重启 dsh web。"
							}, "需重启 · 磁盘 " + ver.disk)
							: null,
				status,
				h("span", { style: S.dim }, ckpts.length + " 底模 · " + loras.length + " LoRA · " + (USER.presets || []).length + " 预设")),
			h("div", { style: { display: "flex", gap: "6px", marginLeft: "auto", justifyContent: "flex-end", flexWrap: "wrap", minWidth: 0 } },
				!online ? h("button", { style: S.btn2, title: "手动拉起 ComfyUI（约 20~60 秒）", onClick: async () => {
				  setOnline(null); setMsg("正在启动 ComfyUI，等 20~60 秒…");
				  try {
				    const r = await jpost(EXPANDER + "/comfy/start", {}, 120000);
				    if (!r || !r.ok) throw new Error((r && r.message) || "start 失败");
				  } catch (e) { setOnline(false); setMsg("启动失败：" + errText(e) + "。也可双击 <ComfyUI父目录>\\start-comfy.ps1"); return; }
				  for (let i = 0; i < 60; i++) {
				    try { await jget(COMFY + "/system_stats", 4000); break; }
				    catch (e3) { await new Promise((r) => setTimeout(r, 2000)); }
				  }
				  setMsg("ComfyUI 已启动");
				  setOnline(null); setConn((c) => c + 1);
				} }, "启动 ComfyUI") : null,
				!online ? h("button", { style: S.btn2, onClick: () => { setOnline(null); setMsg(""); setConn((c) => c + 1); } }, "重试连接") : null,
				online ? h("button", {
					style: S.btn2, title: "重新读一遍 ComfyUI 状态与模型清单（不重启进程）",
					onClick: () => { setOnline(null); setMsg("重新连接中…"); setConn((c) => c + 1); },
				}, "重新连接") : null,
				online ? h("button", {
					style: S.btn2, title: "让 ComfyUI 卸载模型释放显存，进程保留",
					onClick: async () => {
						setMsg("释放显存中…");
						try {
							const r = await jpost(EXPANDER + "/comfy/unload", {}, 40000);
							setMsg(r && r.ok ? "已释放显存" : "失败：" + ((r && r.message) || "?"));
						} catch (e) { setMsg("失败：" + errText(e)); }
					},
				}, "释放显存") : null,
				online ? h("button", {
					style: S.btn2, title: "彻底关闭 ComfyUI 进程",
					onClick: async () => {
						setMsg("关闭中…");
						try {
							const r = await jpost(EXPANDER + "/comfy/stop", {}, 40000);
							if (r && r.ok) { setOnline(false); setMsg("已关闭"); } else { setMsg("失败：" + ((r && r.message) || "?")); }
						} catch (e) { setMsg("失败：" + errText(e)); }
					},
				}, "完全关闭") : null,
				h("button", { style: S.btn2, onClick: () => window.open(COMFY, "_blank") }, "原界面"),
				h("select", {
					style: Object.assign({}, S.sel, { minWidth: "86px", padding: "3px 6px", fontSize: "12px" }),
					title: "面板配色：跟随系统 / 浅色 / 深色 / 纯白 / 纯黑 / 自定义",
					value: (theme && theme.mode) || "auto",
					onChange: (e) => setTheme(Object.assign({}, THEME_DEFAULTS, theme || {}, { mode: e.target.value })),
				}, THEME_MODES.map((m) => h("option", { key: m[0], value: m[0] }, m[1]))),
				(theme && theme.mode === "custom") ? h("input", {
					type: "color", title: "自定义背景色",
					value: (theme && theme.bg) || THEME_DEFAULTS.bg,
					style: { width: "34px", height: "26px", padding: "1px", border: "1px solid rgba(127,127,127,.35)", borderRadius: "6px", background: "transparent", cursor: "pointer" },
					onChange: (e) => setTheme(Object.assign({}, THEME_DEFAULTS, theme || {}, { mode: "custom", bg: e.target.value })),
				}) : null,
				(theme && theme.mode === "custom") ? h("input", {
					type: "color", title: "自定义文字色",
					value: (theme && theme.fg) || THEME_DEFAULTS.fg,
					style: { width: "34px", height: "26px", padding: "1px", border: "1px solid rgba(127,127,127,.35)", borderRadius: "6px", background: "transparent", cursor: "pointer" },
					onChange: (e) => setTheme(Object.assign({}, THEME_DEFAULTS, theme || {}, { mode: "custom", fg: e.target.value })),
				}) : null)),

		// 后台任务条（跨面板存活；即使切走再回来也在）
		job ? h("div", {
			style: {
				border: "1px solid " + (job.status === "error" ? "rgba(224,106,106,.55)" : job.status === "done" ? "rgba(74,192,122,.5)" : "rgba(90,160,235,.5)"),
				background: job.status === "error" ? "rgba(224,106,106,.10)" : job.status === "done" ? "rgba(74,192,122,.10)" : "rgba(90,160,235,.10)",
				borderRadius: "8px", padding: "8px 12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap",
			},
		},
			h("span", { style: { fontSize: "12.5px" } }, "后台任务：" + (job.message || job.status)),
			job.status === "running" || job.status === "submitting"
				? h("button", { style: S.btn2, onClick: () => BG.cancel() }, "取消")
				: null,
			h("button", { style: S.btn2, onClick: () => BG.clear() }, "清除"),
			h("span", { style: S.dim }, "切到别的面板也会继续跑")) : null,

		// 标签页
		h("div", { style: { display: "flex", gap: "2px", alignItems: "center", borderBottom: "1px solid rgba(127,127,127,.25)" } },
			  [["gen", "生成"], ["style", "风格卡"], ["card", "角色卡"], ["lib", "词库"], ["pv-output", "历史"], ["preset", "预设"]].map(([k, label]) =>
			    h("div", {
			      key: k, onClick: () => setTab(k),
			      style: Object.assign({}, S.tab, tab === k ? S.tabOn : S.tabOff),
			    }, label)),
					  msg ? h("span", { title: msg, style: Object.assign({}, S.dim, { marginLeft: "auto", padding: "0 8px", fontSize: "12px", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1 }, /失败|连不上|离线|没认出来/.test(msg) ? S.bad : {}) }, msg) : null),

		// 模型库是二级页：只在生成页那个「模型库」按钮拉起时出现，tab 条上没有它的位置，
		// 所以给它一条返回生成页的导航条，否则进来就出不去（其它 tab 都不高亮）。
		tab === "pv-online" ? h("div", { key: "pv-online-back", style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 2px", borderBottom: "1px solid rgba(127,127,127,.18)" } },
			h("button", { style: S.btn2, onClick: () => setTab("gen"), title: "回到生成页" }, "◂ 返回生成"),
			h("span", { style: S.dim }, "模型库")) : null,

		h("div", { key: "pvhost", style: { display: (tab === "pv-output" || tab === "pv-online") ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" } },
			h(PreviewConsole, { page: tab === "pv-output" ? "output" : tab === "pv-online" ? "online" : "" })),
		h(TabBoundary, { key: tab },
			tab === "gen" ? h(genTab, { key: "gen" }) : null,
			tab === "style" ? h(styleCardTab, { key: "style" }) : null,
			tab === "card" ? h(cardTab, { key: "card" }) : null,
			tab === "lib" ? h(libTab, { key: "lib" }) : null,
			tab === "preset" ? h(presetTab, { key: "preset" }) : null),
		impRep ? importReportPanel() : null,


);
}

// ==================== Cordis 注册 ====================
const inject = ["slots"];
const PANEL_ID = "comfyui";

function apply(ctx) {
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist", id: PANEL_ID, order: 100, label: "ComfyUI 绘图",
	}, PanelIcon));
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main", key: PANEL_ID,
	}, ConsoleSafe));
	ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
		name: "settings.plugins.tab", id: "comfyui-console", order: 90, label: "ComfyUI 绘图",
	}, ConsoleSafe));
}
