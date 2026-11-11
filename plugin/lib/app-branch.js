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
	/** force=true：忽略卡里的 conditioning.enabled，供生成页的「身份控制」开关临时启用。
	 *  卡文件保持 enabled=false（场景出图默认不挂 LLLite），开关只影响本次会话的出图。 */
	async resolve(card, canvas, force) {
		const cond = (card && card.conditioning) || {};
		if (!cond || (!cond.enabled && !force)) { this.set({ status: "off", reason: "未启用条件图" }, card && card.name); return null; }
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
        // 0.7.165：历史页批量删除模式的勾选标记
        check: [h("path", {key:1,d:"M4 12.5l5 5L20 6.5"})],
        square: [h("rect", {key:1,x:4,y:4,width:16,height:16,rx:3})],
        checkSquare: [h("rect", {key:1,x:4,y:4,width:16,height:16,rx:3}),h("path", {key:2,d:"M8.5 12.2l2.6 2.6 4.6-5"})],
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

function savedOutputUrl(path, version) {
    /* 0.7.131：加 version 参数（通常是 mtime）当缓存版本号，避免原图被覆盖后仍显示旧图。 */
    const base = EXPANDER + "/outputs/view?path=" + encodeURIComponent(path);
    return version ? base + "&v=" + encodeURIComponent(String(version)) : base;
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
 // MOSS-Image：5B single-stream DiT（放 diffusion_models）+ Qwen3.5-9B 文本编码器 + FLUX.2 VAE，
 // 三者都不复用 Anima 那套。以下字段照抄本仓 presets.js 的 moss-sft 条目（那边是 A 线工作台口径）：
 // latent = EmptyFlux2LatentImage、sizeStep 16、25 步 / cfg 2.5 / er_sde + simple。
 // 官方文档另给 50 步 / CFG 3 / euler 一组，SFT 上 25 步已经够用。
 "moss-image":{label:"MOSS-Image SFT",family:"moss",negative:true,style:"natural",latent:"EmptyFlux2LatentImage",modes:["diffusion"],clipType:"moss_image",modelOnlyLora:true,sizeStep:16,slgNode:"SkipLayerGuidanceDiTSimple",recommended:{steps:25,cfg:2.5,sampler:"er_sde",scheduler:"simple",w:1024,h:1024}},
};
/** 由底模元数据里的 base_type 文本推出 MODEL_PROFILES 的 key。
 *  生成页要让"选底模 → 文本编码器自动适配"，而 A 线原本是让用户手动选模型类型（profile）。
 *  base_type 来自 /models/detail（safetensors 头里的 base model 字段），实测 animagine 返回 "SDXL"。
 *  认不出来就返回空串，调用方保持现状不动——宁可不动，也不要猜错把编码器塞成别的类型。 */
function profileKeyFromModelBase(baseType){
 const t=String(baseType||"").toLowerCase().replace(/[\s._\-/]+/g,"");
 if(!t)return "";
 if(/moss/.test(t))return "moss-image";
 if(/krea/.test(t))return "flux-krea";
 if(/chroma/.test(t))return "flux-dev";          // Chroma 是 Flux Schnell 的蒸馏分支，走 flux 链
 if(/flux/.test(t))return /schnell|flux1s$|fluxs$/.test(t)?"flux-schnell":"flux-dev";
 if(/sd3\.?5|sd35/.test(t))return /turbo/.test(t)?"sd35-turbo":/medium/.test(t)?"sd35-medium":"sd35-large";
 if(/sd3/.test(t))return "sd3-medium";
 // anima-* 在这里故意不推断：A 线的 Anima profile 用 stable_diffusion 编码器，
 // 而本地面板的 Anima 走 qwen_image（底模取自 diffusion_models），两者不是一回事。
 // 自动套过去会把 Anima 底模当 checkpoint 送进构建流程，ComfyUI 直接退 400。
 // ⚠️ 2026-11：原来是 /anima/ —— 「animagine」的前缀就是 anima，
 //    于是 Animagine XL（正经的 SDXL 底模）被判成 Anima 直接放弃适配。
 //    排除 animagine 才是本意。
 if(/anima(?!gine)/.test(t))return "";
 // —— SDXL 家族：先认子族，再落 sdxl ——
 // 这三家架构同 SDXL，但提示词体系各自独立（Pony 的 score_9 前缀、NoobAI 的质量词），
 // 混进 sdxl 会让 quality 前缀对不上。子族认出来，采样参数仍是 SDXL 那一套。
 if(/noob/.test(t))return "noobai";
 if(/illustrious|ilxl/.test(t))return "illustrious";
 if(/pony/.test(t))return "pony";
 // diffusionxl：base_type 写成 "Stable Diffusion XL" 时，去掉空格是 stablediffusionxl，
 // 里面并不含 "sdxl" 这三个字母连写。
 if(/animagine|juggernaut|dreamshaper/.test(t))return "sdxl";
 if(/sdxl|diffusionxl/.test(t))return "sdxl";
 if(/sd2|v2\.?1/.test(t))return "sd2";
 if(/sd1\.?5|sd15|v1-?5/.test(t))return "sd15";
 return "";
}
/** base_type 缺失时的第二道：按文件名猜。
 *  本机实测 4 个底模里 sd_xl_base_1.0 / animagine-xl-3.1 的元数据写了 base_type=SDXL，
 *  而 v1-5-pruned-emaonly / meinamix-v11 是「未知」——前者文件名里明确写着 v1-5，能救回来；
 *  后者名字不含任何家族信息，就不猜（猜成 SDXL 也可能对，但猜错就是 400，不值）。 */
function profileKeyFromModelName(name){
 const t=String(name||"").toLowerCase().replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/,"");
 if(!t||/anima(?!gine)/.test(t))return "";
 if(/moss/.test(t))return "moss-image";
 if(/krea/.test(t))return "flux-krea";
 if(/chroma/.test(t))return "flux-dev";
 if(/flux/.test(t))return /schnell/.test(t)?"flux-schnell":"flux-dev";
 if(/sd_?3[._]?5|sd35/.test(t))return /turbo/.test(t)?"sd35-turbo":/medium/.test(t)?"sd35-medium":"sd35-large";
 if(/sd3|sd_?3/.test(t))return "sd3-medium";
 // SDXL 子族先行：文件名里同时含 xl 和子族名时，子族优先，否则会被 /xl/ 吞掉。
 if(/noob|noobai/.test(t))return "noobai";
 if(/illustrious|ilxl/.test(t))return "illustrious";
 if(/pony/.test(t))return "pony";
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
	// Anima 的 TE 是 Qwen3 0.6B（qwen_3_06b_base）。原来写 /qwen/i 太宽 ——
	// 2026-10-31 装进 MOSS 的 qwen3.5_9b 之后，切到 Anima 会先命中 9B 那个，编码器直接选错。
	anima: [/qwen_?3?[._\-]?0?6b/i, /_06b/i],
	// MOSS 的 TE 是 Qwen3.5-9B（float/int8/w4a8 三种量化版），文件名以 qwen3.5 打头
	moss: [/qwen_?3[._\-]?5/i, /9b/i],
	sd3: [/t5xxl/i, /t5/i, /clip_l/i],
	flux: [/t5xxl/i, /t5/i, /clip_l/i],
};
const PROFILE_VAE_HINT = {
	anima: [/qwen[_-]?image[_-]?vae/i, /qwen.*vae/i],
	// FLUX.2 VAE；小体积版 flux2-vae_small 同源，优先大的
	moss: [/flux2?[_-]?vae\.safetensors$/i, /flux2?[_-]?vae/i],
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
