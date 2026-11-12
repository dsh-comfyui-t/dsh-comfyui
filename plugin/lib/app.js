function ComfyStartupButton({starting,online,session,stopping,onConnect,onStop,theme}){
 const [open,setOpen]=React.useState(false),[hover,setHover]=React.useState(false),[data,setData]=React.useState(null),[error,setError]=React.useState(''),[copied,setCopied]=React.useState(false);
 const anchor=React.useRef(null),panel=React.useRef(null),consoleRef=React.useRef(null),follow=React.useRef(true),closeTimer=React.useRef(null);
 const [position,setPosition]=React.useState(null);
 const active=starting&&!!session;
 const locate=()=>{const r=anchor.current?.getBoundingClientRect();if(!r)return;const gap=6,margin=8,vh=window.innerHeight,below=Math.max(0,vh-r.bottom-gap-margin),above=Math.max(0,r.top-gap-margin),useAbove=below<240&&above>below,available=useAbove?above:below;setPosition({...(useAbove?{bottom:vh-r.top+gap}:{top:Math.max(margin,Math.min(r.bottom+gap,vh-margin-96))}),right:Math.max(8,window.innerWidth-r.right),maxHeight:Math.max(96,Math.min(vh-margin*2,available))});};
 const show=()=>{clearTimeout(closeTimer.current);if(session){locate();setOpen(true);}};
 const hide=()=>{clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>setOpen(false),160);};
 React.useEffect(()=>{setData(null);setError('');setCopied(false);follow.current=true;},[session?.id]);
 React.useEffect(()=>{
  if(!session)return;let dead=false,pending=false;
  const tick=async()=>{if(dead||pending)return;pending=true;try{const value=await jget(EXPANDER+'/comfy/startup?attempt='+encodeURIComponent(session.id),4500);if(!dead){setData(value);setError('');}}catch(e){if(!dead)setError('暂时无法读取启动日志：'+errText(e));}finally{pending=false;}};
  tick();const timer=starting?setInterval(tick,1000):null;return()=>{dead=true;clearInterval(timer);};
 },[session?.id,starting]);
 React.useEffect(()=>{if(follow.current&&consoleRef.current)consoleRef.current.scrollTop=consoleRef.current.scrollHeight;},[data,open]);
 React.useEffect(()=>{if(!open)return;const dismiss=e=>{if(e.key==='Escape'){setOpen(false);anchor.current?.focus();}};const move=()=>locate();window.addEventListener('resize',move);window.addEventListener('scroll',move,true);document.addEventListener('keydown',dismiss);return()=>{window.removeEventListener('resize',move);window.removeEventListener('scroll',move,true);document.removeEventListener('keydown',dismiss);};},[open]);
 React.useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
 const elapsed=Math.max(0,Math.floor((Date.now()-(data?.startedAt?data.startedAt*1000:session?.startedAt||Date.now()))/1000));
 const text=[data?.logs?.stdout?'[stdout]\n'+data.logs.stdout:'',data?.logs?.stderr?'[stderr]\n'+data.logs.stderr:''].filter(Boolean).join('\n\n');
 const spinner=h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:15}));
 const blur=e=>{if(!anchor.current?.contains(e.relatedTarget)&&!panel.current?.contains(e.relatedTarget))hide();};
 return h(React.Fragment,null,
  h('button',{ref:anchor,type:'button','data-cc-guide':'connection-action',
   style:Object.assign({},S.btn2,{display:'inline-flex',alignItems:'center',gap:7,fontWeight:700,minWidth:132}),
   disabled:stopping||(!active&&(starting||online===null)),
   onMouseEnter:()=>{setHover(true);show();},onMouseLeave:()=>{setHover(false);hide();},onFocus:()=>{setHover(true);show();},onBlur:e=>{setHover(false);blur(e);},
   onClick:active?onStop:onConnect,'aria-label':stopping?'正在停止启动':active?'停止启动':online?'关闭 ComfyUI':'连接 ComfyUI','aria-expanded':session?open:undefined,
   title:session?undefined:online?'完全关闭 ComfyUI：终止生成与排队任务、结束进程并释放模型显存':'尝试启动并连接本机 ComfyUI'},
   stopping?spinner:active?(hover?h(PromptIcon,{name:'stop',size:15}):spinner):starting?spinner:h(OfflineComfyMark,{size:15}),
   stopping?'正在停止…':active?(hover?'停止启动':'启动中…'):starting?'正在关闭…':online?'关闭 ComfyUI':'连接 ComfyUI'),
  open&&position&&session?floating(h('div',{ref:panel,className:'dsh-comfy-floating',role:'region','aria-label':'ComfyUI 启动日志',tabIndex:0,
   onMouseEnter:show,onMouseLeave:hide,onFocus:show,onBlur:blur,
   style:Object.assign({},theme,{position:'fixed',...position,zIndex:2147482000,width:'min(560px,calc(100vw - 16px))',boxSizing:'border-box',overflowY:'auto',display:'flex',flexDirection:'column',gap:8,padding:12,background:'var(--cc-surface)',color:'var(--cc-text)',border:'1px solid var(--cc-border)',borderRadius:6,boxShadow:'0 8px 24px #0005',fontSize:12})},
   h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}},h('strong',null,'ComfyUI · 启动控制台'),h('span',null,active?elapsed+' 秒':data?.result?'已就绪':data?.cancelled?'已停止':'启动记录')),
   h('div',{role:'status',style:{color:'var(--cc-muted)'}},stopping?'正在停止本次启动进程…':data?.phase||'正在准备启动…',data?.pid?' · PID '+data.pid:''),
   error?h('div',{role:'status'},error):null,
   h('pre',{ref:consoleRef,tabIndex:0,'aria-label':'后台输出',onScroll:e=>{const el=e.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<28;},
    style:{margin:0,padding:10,minHeight:100,maxHeight:260,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'var(--cc-bg)',font:'12px/1.5 Consolas,monospace',userSelect:'text'}},text||(active?'等待进程输出日志…':'本次没有捕获到日志输出。')),
   h('div',{style:{display:'flex',justifyContent:'space-between',gap:10}},h('span',{style:{color:'var(--cc-muted)'}},'实时后台输出 · 向上滚动暂停跟随'),h('button',{type:'button',style:S.btn2,disabled:!text,onClick:async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setError('复制失败，请选择日志文本后复制。');}}},copied?'已复制':'复制日志')))):null);
}


/**
 * DSH × ComfyUI 绘图台 —— 界面主体
 *
 * 本文件**不能直接运行**，由项目内 tools/build_client.py
 * 将 dict.js / presets.js / workflow.js / online_models.js / app.js 打包为 lib/client.js。
 * 修改源码后在插件仓库根目录执行：python tools/build_client.py
 *
 * 依赖（构建后同在作用域内，来自 dict.js）：
 *     LIB / EXTRA / buildCn2En / translateCn
 */

// 输出筛选纯逻辑：时间使用用户本地时区，尺寸按最长边归档，所有筛选为交集。
let CURRENT_THEME_ACCENT = (() => { try { return window.localStorage.getItem("dsh-comfyui-console/theme-accent") || "#4D6BFE"; } catch { return "#4D6BFE"; } })();
function accentTextForScheme(scheme){return String(scheme||'').toLowerCase()==='light'?'#111111':'#ffffff';}
function applyAccentPalette(el, color) {
    if (!el || !el.style || !/^#[0-9a-fA-F]{6}$/.test(color || "")) return;
    el.style.setProperty("--cc-accent", color);
    el.style.setProperty("--cc-accent-bg", color + "22");
    el.style.setProperty("--cc-accent-text", accentTextForScheme(getComputedStyle(el).getPropertyValue("--cc-scheme").trim()));
}
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

const React = require("react");
const h = React.createElement;

// ==================== 配置 ====================
// 连接端口可从绘图台修改，重启 DSH / 重装插件不丢。
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
const EXPANDER = "http://127.0.0.1:" + EXPANDER_PORT;
// 通过本机 sidecar 转发 ComfyUI API，Windows/WSL 与 CORS 不再要求浏览器直接连接 :8188。
const COMFY = EXPANDER + "/proxy";
const LS_KEY = "dsh-comfyui-console/v1";



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

// Preview appearance is local UI state; never part of generated image parameters.
const PREVIEW_BACKGROUND_OPTIONS=Object.freeze([
    {value:'system',label:'跟随 DSH'},
    {value:'light',label:'亮色黑白网格'},
    {value:'dark',label:'深色黑白网格'},
]);
function normalizePreviewBackground(value){return PREVIEW_BACKGROUND_OPTIONS.some(option=>option.value===value)?value:'dark';}

// ==================== 持久化 ====================
function lsRead() {
	try {
		const raw = window.localStorage.getItem(LS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (e) { return {}; }
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
const USER = Object.assign({
	presets: [],       // [{name, cat, pos, neg, w, h, steps, cfg, sampler, scheduler, ckpt, loras}]
	frags: {},         // {'自定义分类': [[cn, en], ...]}
	last: null,
	// 只记录自动触发的教程；从右上角手动重播不会改变此记录。
	tutorialsSeen: {},
    outputPreviewQuality: "medium",
    outputPreviewSize: "small",
}, lsRead());

function saveUser() { try { ensureModelSettingsBackup(); } catch {} try { return lsWrite(USER); } catch { return false; } }
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

function ensureSeeds() {
    if(typeof SEED_PRESETS==='undefined'||!SEED_PRESETS.length)return 0;
    const version=typeof SEED_PRESETS_VERSION==='undefined'?1:SEED_PRESETS_VERSION;
    const previousVersion=USER.seedVer,upgrade=(USER.seedVer||1)!==version;
    let list=USER.presets||[],removed=0,added=0;
    if(upgrade){const before=list.length;list=list.filter(p=>!p.builtin);removed=before-list.length;}
    const have=new Set(list.map(p=>p.cat+'\u0000'+p.name)),baseNeg=SEED_PRESETS[0].neg||'';
    for(const preset of SEED_PRESETS){const key=preset.cat+'\u0000'+preset.name;if(have.has(key))continue;
        const item={...preset};if(item.neg===null||item.neg===undefined)item.neg=baseNeg+(/from below/.test(item.pos||'')?NO_HIGH_NEG:'');delete item.seed;item.builtin=true;list=list.concat(item);have.add(key);added++;
    }
    if(upgrade||added){USER.seedVer=version;if(!persistPresetList(list)){if(previousVersion===undefined)delete USER.seedVer;else USER.seedVer=previousVersion;return 0;}
        if(removed)setTimeout(()=>{try{console.log('[comfyui] 内置预设已升级到 v'+version+'，刷新 '+removed+' 条');}catch{}},0);
    }
    return added;
}
const SEEDS_ADDED = ensureSeeds();

/** 官方那条负面提示词（预置里第一条的 neg），供"填充官方负面"用 */
const OFFICIAL_NEG = (typeof SEED_PRESETS !== 'undefined' && SEED_PRESETS[0] && SEED_PRESETS[0].neg) || '';

// 会话级聊天：DSH 运行期间保留；不写入 localStorage，重启后自然清空。
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
function normalizePromptPunctuation(value) {
    value=String(value);
    try {if(/^[\s]*[\[{]/.test(value)){const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')return value;}}catch{}
    const map={"，":",","。":".","（":"(","）":")","：":":","；":";","【":"[","】":"]","［":"[","］":"]","｛":"{","｝":"}","！":"!","？":"?","、":",","“":'"',"”":'"',"‘":"'","’":"'"};
    let result='',quote='',escaped=false,fenced=false;
    for(let i=0;i<value.length;i++){
        const c=value[i];
        if(!quote&&!escaped&&value.slice(i,i+3)==='```'){fenced=!fenced;result+='```';i+=2;continue;}
        if(fenced){result+=c;continue;}
        if(escaped){result+=c;escaped=false;continue;}
        if(c==='\\'){result+=c;escaped=true;continue;}
        if(quote){if(c===quote){result+=map[c]||c;quote='';}else result+=c;continue;}
        if(c==='"'||c==='“'||c==='‘'||c==="'"&&(i===0||/[\s:=,(]/.test(value[i-1]))){quote=({'“':'”','‘':'’'})[c]||c;result+=map[c]||c;continue;}
        result+=map[c]||c;
    }
    return result;
}

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

function editPreviewPart(value, index, weight) {
    const parts=splitPromptPreview(value), p=parts[index];if(!p)return value;
    if(weight===null) {
        const next=parts[index+1], prev=parts[index-1];
        return next ? value.slice(0,p.start)+value.slice(next.start) :
            prev ? value.slice(0,prev.end)+value.slice(p.end) : "";
    }
    if(!p.adjustable)return value;
    const n=Math.round(Math.max(0,Math.min(5,weight))*10)/10;
    const replacement=n===1?p.text:'('+p.text+':'+n.toFixed(1)+')';
    return value.slice(0,p.start)+replacement+value.slice(p.end);
}

function PromptPreviewChip({part,label,onWeight,onRemove,disabled}) {
    const slider=React.useRef(null), drag=React.useRef(null), live=React.useRef(null);
    live.current={part,onWeight,disabled};
    const finish=()=>{const d=drag.current;drag.current=null;const node=slider.current;
        if(d&&node?.hasPointerCapture?.(d.pointerId))node.releasePointerCapture(d.pointerId);};
    React.useEffect(()=>{
        const node=slider.current;if(!node)return;
        const wheel=e=>{
            const v=live.current,d=drag.current;
            // The pointer gesture owns the left-button state; some browsers report
            // buttons=0 on wheel events even while a button is physically held.
            if(!d || v.disabled || !v.part.adjustable || !e.deltaY)return;
            e.preventDefault();e.stopPropagation();
            const weight=Math.round(Math.max(0,Math.min(5,v.part.weight+(e.deltaY<0?.1:-.1)))*10)/10;
            v.onWeight(weight,d.id);
            // Keep dragging relative to the wheel-adjusted value in the same gesture.
            d.weight=weight;d.x=d.lastX;d.moved=false;
        };
        node.addEventListener('wheel',wheel,{passive:false});
        window.addEventListener('blur',finish);
        return()=>{node.removeEventListener('wheel',wheel);window.removeEventListener('blur',finish);finish();};
    },[]);
    React.useEffect(()=>{if(disabled)finish();},[disabled]);
    return h('span',{className:'cc-preview-chip'},
        h('span',{ref:slider,role:part.adjustable?'slider':undefined,tabIndex:disabled?-1:0,
            'aria-label':part.text+' 权重','aria-valuemin':0,'aria-valuemax':5,'aria-valuenow':part.weight,
            'aria-disabled':disabled || !part.adjustable,
            title:part.raw+(label!==part.text?'\n'+label:'')+(part.adjustable?'\n按住左键左右拖动，或按住左键滚轮调整权重':'\n控制语法保持原样'),
            className:'cc-preview-chip-text',
            onPointerDown:e=>{if(disabled || !part.adjustable || e.button!==0)return;
                drag.current={x:e.clientX,lastX:e.clientX,pointerId:e.pointerId,weight:part.weight,id:'drag-'+Date.now()};e.currentTarget.setPointerCapture?.(e.pointerId);},
            onPointerMove:e=>{const d=drag.current;if(!(e.buttons&1)){finish();return;}if(!d || disabled)return;d.lastX=e.clientX;
                const delta=Math.trunc((e.clientX-d.x)/18);if(delta!==0 || d.moved){d.moved=true;onWeight(d.weight+delta*.1,d.id);}},
            onPointerUp:finish,onPointerCancel:finish,onLostPointerCapture:()=>{drag.current=null;},
            onKeyDown:e=>{if(disabled || !part.adjustable || e.ctrlKey || e.metaKey)return;
                if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){
                    e.preventDefault();onWeight(part.weight+(['ArrowUp','ArrowRight'].includes(e.key)?.1:-.1),'key');}},
        },label,part.weight!==1?h('small',null,' '+part.weight):null),
        h('button',{type:'button',className:'cc-chip-remove','aria-label':'移除 '+part.text,disabled,
            onClick:onRemove},h(PromptIcon,{name:'x',size:12})));
}

function PromptChinesePreview({texts,children,onBusyChange,active=true}) {
    const [state,setState]=React.useState({busy:false,error:'',engine:null,failedKey:''});
    const [install,setInstall]=React.useState(null), [refresh,setRefresh]=React.useState(0),[revision,setRevision]=React.useState(0);
    const cache=React.useRef(new Map()),pending=React.useRef(false),alive=React.useRef(true),request=React.useRef(null),visible=React.useRef(active);
    visible.current=active;
    const key=JSON.stringify(texts),items=texts.map(text=>cache.current.get(text)||{text,source:'original'});
    const missing=texts.some(text=>!cache.current.has(text)),busy=missing&&state.failedKey!==key;
    React.useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
    React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
    React.useEffect(()=>{if(active)setState(prev=>prev.failedKey?{...prev,failedKey:''}:prev);},[active]);
    React.useEffect(()=>{
        if(pending.current||!missing||state.failedKey===key)return;
        const timer=setTimeout(()=>{
            if(pending.current)return;
            const needed=[...new Set(JSON.parse(key).filter(text=>!cache.current.has(text)))];
            if(!needed.length)return;
            const controller=new AbortController();request.current=controller;pending.current=true;
            setState(prev=>({...prev,busy:true,error:'',failedKey:''}));
            jpost(EXPANDER+'/preview/translate',{texts:needed},195000,controller.signal)
                .then(r=>{if(!alive.current||controller.signal.aborted)return;
                    if(!Array.isArray(r.items)||r.items.length!==needed.length||r.items.some(item=>!item||typeof item.text!=='string'))throw new Error('中文预览返回内容不完整');
                    needed.forEach((text,i)=>cache.current.set(text,r.items[i]));
                    while(cache.current.size>2048)cache.current.delete(cache.current.keys().next().value);
                    setState({busy:false,error:r.warning||'',engine:r.engine,failedKey:''});
                    if(r.engine?.status==='running')setInstall(r.engine);
                })
                .catch(e=>{if(alive.current&&!controller.signal.aborted){setState({busy:false,error:errText(e),engine:null,failedKey:key});if(visible.current)notifyError(e,{title:'中文预览失败'});}})
                .finally(()=>{pending.current=false;if(request.current===controller)request.current=null;if(alive.current)setRevision(v=>v+1);});
        },350);
        return()=>clearTimeout(timer);
    },[key,refresh,revision,missing,state.failedKey]);
    React.useEffect(()=>{
        if(!install || !['running','starting'].includes(install.status))return;
        const controller=new AbortController();let timer,active=true;
        const poll=async()=>{try{
            const r=await jget(EXPANDER+'/translation/status',10000,controller.signal);
            if(!active)return;setInstall(r);
            if(r.ready){cache.current.clear();setState(prev=>({...prev,failedKey:''}));setRefresh(v=>v+1);return;}
            if(r.status==='running')timer=setTimeout(poll,2000);
        }catch(e){if(active)setInstall({status:'error',message:errText(e)});}};
        timer=setTimeout(poll,1200);return()=>{active=false;clearTimeout(timer);controller.abort();};
    },[install?.status]);
    const installEngine=async()=>{setInstall({status:'starting',message:'准备安装…'});
        try{setInstall(await jpost(EXPANDER+'/translation/install',{},15000));}
        catch(e){setInstall({status:'error',message:errText(e)});notifyError(e,{title:'翻译组件安装失败'});}};
    return h(React.Fragment,null,
        active&&busy?h('span',{style:{...S.dim,display:'inline-flex',alignItems:'center',gap:6},role:'status'},h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:16})),'正在翻译中文标签…'):null,
        active&&state.error?h('div',{style:S.dim,role:'status'},state.error,
            state.engine && !state.engine.ready?h('button',{type:'button',style:S.btn2,
                disabled:['running','starting'].includes(install?.status),onClick:installEngine},'安装离线翻译（首次需联网）'):null):null,
        active&&install?h('div',{style:S.dim,role:'status'},install.message || (install.ready?'离线翻译已就绪':'正在安装…')):null,
        children(items));
}

function PromptResultViewer({message,theme,onClose}) {
    const [chinese,setChinese]=React.useState(false);
    const values=[message.positive||'',message.negative||''];
    const parts=values.map(splitPromptPreview);
    const display=items=>{let offset=0;return h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
        ...values.map((value,i)=>{let end=0, translated='';
            for(const part of parts[i]) {
                const label=items[offset++]?.text || part.text;
                translated+=value.slice(end,part.start)+(part.weight===1?label:'('+label+':'+part.weight+')');end=part.end;
            }
            translated+=value.slice(end);
            return h('div',{key:i},h('strong',null,i?'负向提示词':'正向提示词'),
            h('div',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',userSelect:'text',marginTop:6}},
                chinese?(translated||'（空）'):(value||'（空）')));}));};
    return h(OverlayModal,{title:'查看提示词',width:720,theme,onClose},
        h('button',{type:'button',style:S.btn2,onClick:()=>setChinese(v=>!v),'aria-pressed':chinese},chinese?'查看原文':'中文查看'),
        chinese?h(PromptChinesePreview,{texts:parts.flat().map(p=>p.text)},display):display([]));
}

// Lucide 图形采用内嵌 SVG（MIT），不依赖网络、字体或外部图标库。
function PromptIcon({name, size = 16}) {
    const shapes = {
        saveAs: [h("path",{key:1,d:"M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"})],
        broom: [h("path",{key:1,d:"m14 10 7-7 M11 8l5 5 M10 10l4 4-4 7H3v-7z M6 16l-1 5 M10 17l-1 4"})],
        arrowLeft: [h("path",{key:1,d:"M19 12H5m6-6-6 6 6 6"})],
        arrowUp: [h("path",{key:1,d:"M12 19V5m-6 6 6-6 6 6"})],
        minus: [h("path", {key:1,d:"M5 12h14"})],
        reset: [h("path", {key:1,d:"M4 10a8 8 0 1 1 2 8M4 4v6h6"})],
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
        chevronUp: [h("path", {key:1,d:"m18 15-6-6-6 6"})],
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

// ---- 把内部 API 图转成 ComfyUI UI 工作流（拖入 ComfyUI 可还原节点图） ----
const WORKFLOW_CONNECT_TYPES = new Set(['MODEL','CLIP','VAE','LATENT','CONDITIONING','IMAGE','MASK','CONTROL_NET','STYLE_MODEL','CLIP_VISION','SIGMAS','SAMPLER','GUIDER','NOISE','GUIDES','UPSCALE_MODEL','CLIP_VISION_OUTPUT','AUDIO','VIDEO','TORCH']);
function workflowColumnOf(type) {
    const t = String(type || '');
    if (/^(CheckpointLoaderSimple|CheckpointLoader|UNETLoader|UnetLoaderGGUF|CLIPLoader|CLIPLoaderGGUF|DualCLIPLoader|VAELoader|LoraLoader|LoraLoaderModelOnly|UpscaleModelLoader|CLIPVisionLoader|ControlNetLoader)$/.test(t)) return 0;
    if (/(CLIPTextEncode|ConditioningZeroOut|ConditioningCombine|ConditioningConcat|ConditioningSetArea|FluxGuidance)/.test(t)) return 1;
    if (/(EmptyLatentImage|EmptySD3LatentImage|KSampler|SamplerCustom|BasicScheduler|KSamplerSelect|RandomNoise|CFGGuider|LatentUpscale|VAEEncode)$/.test(t)) return 2;
    if (/(SaveImage|PreviewImage|SaveAnimatedWEBP|SaveAnimatedPNG)$/.test(t)) return 4;
    return 3;
}
function isWorkflowWidget(type) {
    if (Array.isArray(type)) return true;
    return typeof type === 'string' && !WORKFLOW_CONNECT_TYPES.has(type);
}
function apiToWorkflow(graph, info) {
    if (!graph || typeof graph !== 'object') return null;
    const infos = info && typeof info === 'object' ? info : {};
    const entries = Object.keys(graph).filter(k => graph[k] && graph[k].class_type).map((k, i) => ({ id: String(k), order: i, ...graph[k] }));
    if (!entries.length) return null;
    const idNum = id => Number(String(id).replace(/\D/g, '')) || 0;
    entries.sort((a, b) => idNum(a.id) - idNum(b.id));
    const nodes = entries.map((e, idx) => {
        const meta = infos[e.class_type] || {};
        const defs = { ...(meta.input?.required || {}), ...(meta.input?.optional || {}) };
        const node = { id: idNum(e.id) || idx + 1, type: e.class_type, pos: [0, 0], size: [240, 110], flags: {}, order: 0, mode: 0, inputs: [], outputs: [], properties: { 'Node name for S&R': e.class_type }, widgets_values: [] };
        if (e._meta && typeof e._meta === 'object') node._meta = e._meta;
        const inputs = e.inputs || {};
        for (const [name, spec] of Object.entries(defs)) {
            const type = Array.isArray(spec) ? spec[0] : spec;
            const opts = Array.isArray(spec) && spec[1] && typeof spec[1] === 'object' ? spec[1] : {};
            const val = inputs[name];
            const isLink = Array.isArray(val) && val.length === 2 && (typeof val[0] === 'string' || typeof val[0] === 'number');
            if (isLink) node.inputs.push({ name, type: typeof type === 'string' ? type : '*', link: null, _src: [String(val[0]), Number(val[1]) || 0] });
            else if (isWorkflowWidget(type)) {
                node.widgets_values.push(val === undefined ? (opts.default === undefined ? null : opts.default) : val);
                if (opts.control_after_generate) node.widgets_values.push('fixed');
            }
        }
        const outs = Array.isArray(meta.output) ? meta.output : [];
        const outNames = Array.isArray(meta.output_name) ? meta.output_name : outs;
        node.outputs = outs.map((t, i) => ({ name: outNames[i] || t, type: t, links: [], slot_index: i }));
        return node;
    });
    const nodeById = new Map(nodes.map(n => [String(n.id), n]));
    const links = [];
    let linkId = 1;
    for (const n of nodes) {
        for (const input of n.inputs) {
            const src = input._src; delete input._src;
            const from = src ? nodeById.get(src[0]) : null;
            if (!from) { input.link = null; continue; }
            const slot = Math.max(0, Math.min(src[1], Math.max(0, from.outputs.length - 1)));
            const type = (from.outputs[slot] && from.outputs[slot].type) || input.type || '*';
            const id = linkId++;
            input.link = id;
            if (from.outputs[slot]) from.outputs[slot].links.push(id);
            links.push([id, from.id, slot, n.id, n.inputs.indexOf(input), type]);
        }
    }
    const cols = [[], [], [], [], []];
    for (const n of nodes) cols[workflowColumnOf(n.type)].push(n);
    const colX = [40, 380, 720, 1060, 1400];
    let order = 0;
    cols.forEach((list, ci) => {
        let y = 40;
        for (const n of list) {
            n.pos = [colX[ci], y];
            n.order = order++;
            const h = 110 + Math.max(0, n.widgets_values.length - 2) * 26;
            n.size = [240, h];
            y += h + 40;
        }
    });
    const maxId = nodes.reduce((m, n) => Math.max(m, n.id), 0);
    return { id: 'dsh-' + Date.now(), revision: 0, last_node_id: maxId, last_link_id: links.length, nodes, links, groups: [], config: {}, extra: { ds: { scale: 1, offset: [0, 0] } }, version: 0.4 };
}

/**
 * 把 ComfyUI execution_error 的 payload 转成可读的「哪一步、哪个参数」信息。
 */
function comfyExecutionError(detail) {
    const d = detail && typeof detail === "object" ? detail : {};
    const type = d.exception_type || "错误";
    const text = d.exception_message || "";
    const hasNode = d.node_id !== undefined || d.node_type;
    const where = hasNode ? ("节点 #" + (d.node_id ?? "?") + (d.node_type ? " · " + d.node_type : "")) : "执行阶段";
    const message = where + " 出错：" + type + (text ? "：" + text : "");
    const lines = [];
    lines.push("环节：" + where);
    lines.push("异常：" + type + (text ? "：" + text : ""));
    let inputs = [];
    if (d.current_inputs && typeof d.current_inputs === "object") {
        inputs = Object.entries(d.current_inputs)
            .filter(([, v]) => v !== null && v !== undefined && ["string", "number", "boolean"].includes(typeof v))
            .slice(0, 8)
            .map(([k, v]) => k + " = " + String(v).slice(0, 160));
    }
    if (inputs.length) lines.push("该节点输入：\n" + inputs.join("\n"));
    const tb = Array.isArray(d.traceback) ? d.traceback.filter(x => typeof x === "string").slice(-8).join("") : "";
    if (tb) lines.push("调用栈（尾部）：\n" + tb.trim());
    return { message, detail: lines.join("\n\n") };
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
    const ms=outputGenerationMs(item);if(!ms)return '';
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

const BG = {
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
        const previous=this.jobs[i];this.jobs[i]={...previous,...patch};if(["error","save-error"].includes(this.jobs[i].status)&&(previous.status!==this.jobs[i].status||previous.message!==this.jobs[i].message))notifyError(this.jobs[i].message||this.jobs[i].error,{title:"生成任务失败"});this.jobs.sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));cacheJobs(this.jobs);this.emit();},
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
    async run(graph,params,workflow){
        const localId='local-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
        const job={localId,pid:null,submittedAt:Date.now(),startedAt:null,status:'submitting',message:'提交中…',
            queuePosition:null,image:null,imageInfo:null,error:null,params:{...params}};
        this.jobs.unshift(job);this.emit();
        try{
            const res=await jpost(COMFY+'/prompt',{prompt:graph,client_id:'dsh-comfyui-console',...(workflow?{extra_data:{extra_pnginfo:{workflow}}}:{})},30000);
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
            const r=await jpost(EXPANDER+'/post/complete',{prompt_id:job.pid,save:job.params.postSaveOutput===true||!!job.params.saveOutput,saveInitial:false,folder:job.params.savePath,prefix:job.params.prefix,mode:'final'},120000);
            const convert=s=>({...s,url:s.path?savedOutputUrl(s.path):viewUrl(s.imageInfo),promptId:job.pid});
            const selected=convert(r.item),stages=(r.stages||[]).map(convert),generationMs=generationDurationFromHistory(entry,job,Date.now());
            const output={...selected,source:selected.path?'custom':'temp',saved:!!selected.path,session:true,groupId:r.groupId,stages,activeStage:selected.index,
                params:{...job.params,...selected.params,usedSeed:job.params.usedSeed},generationMs};
            SESSION_OUTPUTS.remove(job.pid);SESSION_OUTPUTS.add(output);
            this.setJob(job.pid,{status:r.failed?'error':'done',message:r.failed?'后处理失败，已保留完成阶段':'完成 ✓'+(selected.note?' · '+selected.note:''),image:output.url,imageInfo:output.imageInfo,output,generationMs,completedAt:Date.now()});
        }catch(e){this.setJob(job.pid,{status:(job.params.postSaveOutput===true||job.params.saveOutput)?'save-error':'error',message:'生成后结果读取 / 保存失败：'+errText(e),error:errText(e)});}
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
                const live=this.jobs.find(item=>item.pid===job.pid);
                if(!live||live.cancelling||!['queued','running'].includes(live.status))continue;
                if(running.includes(job.pid)){
                    const start=job.startedAt||Date.now();this.setJob(job.pid,{status:'running',startedAt:start,queuePosition:0,message:'正在生成…'});continue;
                }
                const qi=pending.indexOf(job.pid);
                if(qi>=0){this.setJob(job.pid,{status:'queued',queuePosition:qi+1,message:'排队中 · '+(qi+1)});continue;}
                try{
                    const hist=await jget(COMFY+'/history/'+encodeURIComponent(job.pid),10000);const entry=hist?.[job.pid];
                    const live=this.jobs.find(item=>item.pid===job.pid);if(!live||live.cancelling||!['queued','running'].includes(live.status))continue;
                    if(entry){
                        const st=entry.status||{};
                        if(st.status_str==='error'){
                            let info={message:'ComfyUI 生成错误',detail:''};
                            for(const m of (st.messages||[])){if(m[0]==='execution_error'){info=comfyExecutionError(m[1]||{});break;}}
                            if(job.params?.postEnabled){await this._completePost(job,entry);}
                            this.setJob(job.pid,{status:'error',message:info.message,error:info.message,errorDetail:info.detail});
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
        if(!job||job.cancelling||!['queued','running','submitting'].includes(job.status))return false;
        if(!job.pid){this.setJob(job.localId,{status:'cancelled',message:'已取消'});return true;}
        this.setJob(job.pid,{cancelling:true,message:'正在取消…'});
        try{
            let q=await jget(COMFY+'/queue',10000);
            const pending=(q.queue_pending||[]).some(x=>x[1]===job.pid);
            if(pending){await jpost(COMFY+'/queue',{delete:[job.pid]},10000);q=await jget(COMFY+'/queue',10000);}
            const running=(q.queue_running||[]).some(x=>x[1]===job.pid);
            if(running)await jpost(COMFY+'/interrupt',{prompt_id:job.pid},10000);
            if(!pending&&!running){this.setJob(job.pid,{cancelling:false});await this.tick();return false;}
            this.setJob(job.pid,{status:'cancelled',cancelling:false,queuePosition:null,message:'已取消'});return true;
        }catch(e){this.setJob(job.pid,{cancelling:false,message:'取消失败：'+errText(e)});notifyError(errText(e),{title:'取消任务失败'});return false;}
    },
    async clearQueue(){
        if(this.clearingQueue)return 0;this.clearingQueue=true;
        try{
            const before=await jget(COMFY+'/queue',10000),ids=[...new Set((before.queue_pending||[]).map(row=>row[1]).filter(Boolean))];
            if(!ids.length)return 0;
            // Delete only the snapshot of pending IDs. A promoted/running job is never interrupted.
            await jpost(COMFY+'/queue',{delete:ids},10000);
            const after=await jget(COMFY+'/queue',10000),running=new Set((after.queue_running||[]).map(row=>row[1])),pending=new Set((after.queue_pending||[]).map(row=>row[1]));
            for(const id of ids){
                const job=this.jobs.find(row=>row.pid===id);if(!job||!['queued','running'].includes(job.status))continue;
                if(running.has(id))this.setJob(id,{status:'running',queuePosition:0});
                else if(!pending.has(id))this.setJob(id,{status:'cancelled',cancelling:false,queuePosition:null,message:'已从排队列表移除'});
            }
            return ids.filter(id=>!running.has(id)&&!pending.has(id)).length;
        }catch(e){notifyError(errText(e),{title:'清除任务队列失败'});return 0;}
        finally{this.clearingQueue=false;this.emit();}
    },
};

// ==================== 工具 ====================
/** Right-side, non-blocking error notices shared by the console and native workflow window. */
const ERROR_NOTICE_CSS=`
.cc-toast-stack{position:fixed;top:20px;right:20px;z-index:2147483646;width:min(380px,calc(100vw - 32px));display:flex;flex-direction:column;gap:12px;max-height:calc(100dvh - 40px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;pointer-events:none;font:13px/1.5 system-ui,sans-serif;color:var(--cc-text,#eee);box-sizing:border-box}
.cc-toast-card{pointer-events:auto;display:flex;flex:none;align-items:flex-start;gap:10px;min-height:73px;padding:12px;box-sizing:border-box;background:var(--cc-surface,#292b30);border:1px solid var(--cc-border,#555);border-left:3px solid var(--cc-bad,#f87171);border-radius:8px;box-shadow:0 6px 20px #0003;animation:cc-toast-enter .16s ease-out}
.cc-toast-card[data-severity=warn]{border-left-color:var(--cc-warn,#fbbf24)}.cc-toast-icon{width:18px;height:18px;flex:none;margin-top:2px;color:var(--cc-bad,#f87171)}.cc-toast-card[data-severity=warn] .cc-toast-icon{color:var(--cc-warn,#fbbf24)}
.cc-toast-card[data-severity=success]{border-left-color:var(--cc-ok,#4ade80)}.cc-toast-card[data-severity=success] .cc-toast-icon{color:var(--cc-ok,#4ade80)}
.cc-toast-content{min-width:0;flex:1;overflow-wrap:anywhere}.cc-toast-content strong{display:block;font-size:14px;font-weight:600;margin-bottom:5px}.cc-toast-detail{white-space:pre-wrap;max-height:260px;overflow:auto}.cc-toast-count{font-size:11px;color:var(--cc-muted,#bbb);font-weight:400;margin-left:6px}
.cc-toast-close{border:0!important;border-radius:4px;background:transparent!important;color:inherit!important;min-width:28px;min-height:28px;flex:none;cursor:pointer;padding:4px!important;display:grid;place-items:center}.cc-toast-close:hover{background:var(--cc-hover,#444)!important}.cc-toast-close:focus-visible{outline:2px solid var(--cc-accent,#8ab4f8);outline-offset:1px}
.cc-toast-action{margin-top:8px;min-width:64px;min-height:28px;padding:4px 10px;font-size:12px;cursor:pointer}
@keyframes cc-toast-enter{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.cc-toast-card{animation:none}}@media(max-width:560px){.cc-toast-stack{top:12px;right:12px;width:calc(100vw - 24px)}}
`;
const ERROR_NOTICES={
 items:[],listeners:new Set(),recent:new Map(),sequence:0,
 emit(){for(const fn of this.listeners)fn(this.items.slice());},
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);},
 dismiss(id){this.items=this.items.filter(n=>n.id!==id);this.emit();},
 push(detail,{title='操作失败',severity='error',key,cooldown=3000,actionLabel,onAction,persistent=false}={}){
  detail=String(detail||'').trim();if(!detail)return null;
  key=key||severity+':'+title+':'+detail;const now=Date.now(),existing=this.items.find(n=>n.key===key);
  // Only identical active notices coalesce. Different failures must remain in the stack.
  if(existing){this.items=this.items.map(n=>n===existing?{...n,count:n.count+1,persistent:persistent||n.persistent,actionLabel:actionLabel||n.actionLabel,onAction:typeof onAction==='function'?onAction:n.onAction}:n);this.emit();return existing.id;}
  if(this.recent.has(key)&&now-this.recent.get(key)<cooldown)return null;
  this.recent.set(key,now);if(this.recent.size>100)this.recent.delete(this.recent.keys().next().value);
  const id=++this.sequence;
  // No slice(-4): old notices stay visible until individually dismissed or timed out.
  this.items=[...this.items,{id,key,title,detail,severity,count:1,createdAt:now,persistent,actionLabel,onAction:typeof onAction==='function'?onAction:null}];
  this.emit();return id;
 }
};
function errorNoticeText(error){
 const text=errText(error);
 if(error?.name==='AbortError'||/^(?:AbortError|The (?:user aborted a request|operation was aborted)|操作已取消)/i.test(text))return '';
 if(/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(text))return '无法连接服务。请确认 Sidecar 正在运行；需要生成或读取节点时，还需启动并连接 ComfyUI。';
 return redactLogText(text);
}
function notifyError(error,options){const text=errorNoticeText(error);return text?ERROR_NOTICES.push(text,options):null;}
function notifySuccess(detail,options={}){
 const text=redactLogText(String(detail||'').trim());
 return text?ERROR_NOTICES.push(text,{...options,title:options.title||'操作成功',severity:'success'}):null;
}
function notifyStatusError(value){
 if(typeof value!=='string'||!/(失败|错误|无效|无法|未提交|未保存|未找到|缺少|不支持|不匹配|不可用|离线|请先|请.*(?:选择|配置|填写|导入|绘制|更新|重试|检查)|尚未设置|先给|过大|超出|不能|超时|断开)/.test(value))return;
 const severity=/^(?:请|先给|尚未)/.test(value)?'warn':'error';notifyError(value,{severity,title:severity==='warn'?'需要完成设置':'操作失败',cooldown:3000});
}
function useErrorState(initial=''){
 const [value,setValue]=React.useState(initial);
 // silent: 自动加载/预检失败只更新面板内状态，不弹 toast（用户手动操作才提示）。
 const update=(next,options)=>{setValue(next);if(options&&options.silent)return null;if(typeof next==='string'&&next)return notifyError(next,options);return null;};
 return [value,React.useCallback?React.useCallback(update,[setValue]):update];
}
// Each mounted editor owns its read-error notice; callbacks never cross sessions.
function useReadErrorNotice(setError,title,onRetry){
 const scope=React.useRef({}),notice=React.useRef(null);
 const clear=()=>{if(notice.current!==null){ERROR_NOTICES.dismiss(notice.current);notice.current=null;}ERROR_NOTICES.recent.delete(scope.current);};
 React.useEffect(()=>clear,[]);
 const report=error=>{clear();notice.current=setError(errText(error),{title,actionLabel:'重试读取',key:scope.current,cooldown:0,persistent:true,onAction:onRetry});};
 return [report,clear];
}
function useStatusState(initial=''){
 const [value,setValue]=React.useState(initial);
 const update=(next,options)=>{setValue(next);if(options&&options.silent)return;notifyStatusError(next);};
 return [value,React.useCallback?React.useCallback(update,[setValue]):update];
}
function notifyComfyOffline(action='此操作'){
 notifyError(action+'需要启动并连接 ComfyUI，请点击绘图台右上方的“连接 ComfyUI”后重试。',{title:'ComfyUI 未连接',key:'comfy-offline',cooldown:0});
}
async function requireComfyOnline(action='此操作',signal){
 const state=await jget(EXPANDER+'/comfy/online',5000,signal);
 if(!state.running)throw Error(action+'需要启动并连接 ComfyUI，请点击“连接 ComfyUI”后重试。');
 return state;
}
function ErrorNoticeCard({notice}){
 const timer=React.useRef(null),remaining=React.useRef(notice.severity==='success'?5000:9000),started=React.useRef(0);
 const pause=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;remaining.current=Math.max(0,remaining.current-(Date.now()-started.current));}};
 const resume=()=>{if(notice.persistent||timer.current)return;started.current=Date.now();timer.current=setTimeout(()=>ERROR_NOTICES.dismiss(notice.id),remaining.current);};
 React.useEffect(()=>{resume();return pause;},[notice.id,notice.persistent]);
 return h('section',{className:'cc-toast-card','data-severity':notice.severity,role:notice.severity==='error'?'alert':'status','aria-atomic':'true',onMouseEnter:pause,onMouseLeave:resume,onFocusCapture:pause,onBlurCapture:e=>{if(!e.currentTarget.contains(e.relatedTarget))resume();}},
  h('svg',{className:'cc-toast-icon',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':'true'},h('circle',{cx:12,cy:12,r:9}),h('path',{d:notice.severity==='success'?'m8 12 3 3 5-6':'M12 7v6m0 3v1'})),
  h('div',{className:'cc-toast-content'},h('strong',null,notice.title,notice.count>1?h('span',{className:'cc-toast-count'},'×'+notice.count):null),h('div',{className:'cc-toast-detail'},notice.detail),notice.actionLabel&&typeof notice.onAction==='function'?h('button',{type:'button',className:'cc-toast-action',style:S.btn2,onClick:()=>{ERROR_NOTICES.dismiss(notice.id);ERROR_NOTICES.recent.delete(notice.key);notice.onAction();}},notice.actionLabel):null),
  h('button',{type:'button',className:'cc-toast-close','aria-label':notice.severity==='success'?'关闭成功通知':'关闭错误通知',onClick:()=>ERROR_NOTICES.dismiss(notice.id)},h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':'true'},h('path',{d:'M6 6l12 12M18 6L6 18'}))));
}
function ErrorNoticeViewport({theme}){
 const [items,setItems]=React.useState(()=>ERROR_NOTICES.items.slice());
 const stack=React.useRef(null),lastCount=React.useRef(0);
 React.useEffect(()=>{const unsubscribe=ERROR_NOTICES.subscribe(setItems);ERROR_NOTICES.items=ERROR_NOTICES.items.filter(n=>n.persistent||Date.now()-n.createdAt<(n.severity==='success'?5000:9000));setItems(ERROR_NOTICES.items.slice());return unsubscribe;},[]);
 // When the pile exceeds the viewport, reveal new notices without deleting older ones.
 React.useEffect(()=>{if(items.length>lastCount.current&&stack.current&&stack.current.scrollHeight>stack.current.clientHeight)stack.current.scrollTop=stack.current.scrollHeight;lastCount.current=items.length;},[items.length]);
 return floating(h('aside',{ref:stack,className:'dsh-comfy-floating cc-toast-stack',style:theme,'aria-label':'消息通知'},h('style',null,ERROR_NOTICE_CSS),...items.map(notice=>h(ErrorNoticeCard,{key:notice.id,notice}))));
}

function errText(e) { return (e && e.message) ? e.message : String(e); }

// ---- 错误日志：按设备保存在 localStorage，最多保留 MAX 条 ----
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
let sidecarHealthValue = null;
async function requireCompatibleSidecar(url) {
    if (!url.startsWith(EXPANDER + "/") || url === EXPANDER + "/health") return;
    if (sidecarHealthValue && Date.now() - sidecarHealthCheckedAt < 30000) return sidecarHealthValue;
    if (!sidecarHealthPromise) {
        sidecarHealthPromise = (async()=>{
            try {
                const health=verifySidecarHealth(await jget(EXPANDER + "/health",4000));
                sidecarHealthValue=health;sidecarHealthCheckedAt=Date.now();return health;
            } catch(error) {sidecarHealthValue=null;throw error;}
            finally {sidecarHealthPromise=null;}
        })();
    }
    return await sidecarHealthPromise;
}
async function requireSidecarFeature(key,version,label){
 const health=await requireCompatibleSidecar(EXPANDER+'/feature-check');
 if(!Number.isInteger(health?.[key])||health[key]<version)throw Error(label+'接口尚未更新，请更新完整插件并重启 DSH / Sidecar');
 return health;
}
function editorChannel(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
}
function instanceHeaders() { return INSTALLED_INSTANCE_ID ? {"X-DSH-Instance-Id":INSTALLED_INSTANCE_ID} : {}; }
// Only reads and content-addressed image/document writes may be retried.
function sidecarRetrySafe(url,options={}){
 if(typeof url!=='string'||!url.startsWith(EXPANDER+'/'))return false;
 const method=String(options.method||'GET').toUpperCase(),path=url.split('?')[0];
 return method==='GET'||(method==='POST'&&(path===EXPANDER+'/references'||path===EXPANDER+'/reference-documents'));
}
function sidecarRetryPause(ms,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason||new DOMException('操作已取消','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 });
}
async function sidecarFetch(url,options={}){
 const attempts=sidecarRetrySafe(url,options)?3:1;
 for(let attempt=0;attempt<attempts;attempt++){
  try{return await fetch(url,options);}
  catch(error){
   const network=error?.name==='TypeError'||/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(errText(error));
   if(options.signal?.aborted||error?.name==='AbortError'||!network||attempt===attempts-1)throw error;
   await sidecarRetryPause(150*(attempt+1),options.signal);
  }
 }
}

async function jget(url, timeoutMs, externalSignal) {
    await requireCompatibleSidecar(url);
    const ctl = new AbortController();
    const abort = () => ctl.abort();
    if (externalSignal) {
        if (externalSignal.aborted) ctl.abort();
        else externalSignal.addEventListener("abort", abort, {once:true});
    }
    const t = setTimeout(() => ctl.abort(), timeoutMs || 8000);
    try {
        const r = await sidecarFetch(url, {signal:ctl.signal,headers:instanceHeaders()});
        if (!r.ok) {
            let detail='';try{const data=await r.json();const error=data?.error;detail=typeof error==='string'?error:error?.message||data?.message||'';}catch{}
            throw new Error('HTTP '+r.status+(detail?' · '+detail:''));
        }
        return await r.json();
    } catch (e) {
        if (!/health(?:$|[?&])/.test(url) && !/abort|cancel/i.test(errText(e))) logClientError("GET " + url, e);
        throw e;
    } finally { clearTimeout(t); externalSignal?.removeEventListener("abort", abort); }
}
async function jpost(url, body, timeoutMs, externalSignal) {
    await requireCompatibleSidecar(url);
	const ctl = new AbortController();
    const abort = () => ctl.abort();
    if (externalSignal) {
        if (externalSignal.aborted) ctl.abort();
        else externalSignal.addEventListener("abort", abort, {once:true});
    }
	const t = setTimeout(() => ctl.abort(), timeoutMs || 20000);
	try {
		const r = await sidecarFetch(url, {
			method: "POST", headers: { "Content-Type": "application/json", ...instanceHeaders() },
			body: JSON.stringify(body || {}), signal: ctl.signal,
		});
		if (!r.ok) {
			/**
			 * ComfyUI 校验失败时返回 HTTP 400，**真正的错误在响应体里**：
			 *   {"error":{"type":"prompt_outputs_failed_validation","message":"..."},
			 *    "node_errors":{"3":{"errors":[{"details":"vae_name: '' not in [...]"}]}}}
			 *
			 * ⚠️ 2026-10-16：原来只抛 `HTTP 400`，用户看不到任何原因，
			 * 只能来问。这里把 node_errors 逐条摊平，直接告诉是哪个节点哪个字段。
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
					if (lines.length) {
						detail = " · " + lines.join(" ｜ ");
					} else if (j.error) {
						detail = " · " + (typeof j.error === "string" ? j.error : j.error.message || j.error.type || "");
					} else if (j.message) {
						detail = " · " + j.message;
					}
				} catch (e2) {
					detail = txt ? " · " + txt.slice(0, 300) : "";
				}
			} catch (e3) { /* 读不到就算了 */ }
			throw new Error("HTTP " + r.status + detail);
		}
		// Native queue/interrupt commands return HTTP 200 with an empty body.
		if(url===COMFY+'/queue'||url===COMFY+'/interrupt'){const text=await r.text();return text.trim()?JSON.parse(text):{};}
		return await r.json();
	} catch (e) {
		if (!/abort|cancel/i.test(errText(e))) logClientError("POST " + url, e);
		throw e;
	} finally { clearTimeout(t); if (externalSignal) externalSignal.removeEventListener("abort", abort); }
}
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
function viewUrl(img) {
	return COMFY + "/view?filename=" + encodeURIComponent(img.filename) +
		"&subfolder=" + encodeURIComponent(img.subfolder || "") +
		"&type=" + encodeURIComponent(img.type || "output") + "&t=" + Date.now();
}
function touch() { try { jpost(EXPANDER + "/comfy/touch", {}, 5000).catch(() => { }); } catch (e) { } }

/**
 * 从 object_info 里取 COMBO 的可选项。
 *
 * ⚠️ 2026-10-16：实测 ComfyUI 0.39.0 有**三种**形态，必须都兼容。
 *    我第一版硬要求 `Array.isArray(v) && v.length === 2`，漏掉形态 2，
 *    导致 VAELoader / CLIPLoader 返回空列表 -> vae_name / clip_name 变空串
 *    -> ComfyUI 报 HTTP 400 `Value not in list: vae_name: ''`。
 *
 *      形态 1  [[名字...], {"multiselect": false}]   底模 / LoRA / 采样器 / 调度器
 *      形态 2  [[名字...]]                            ← 第二项可以缺席！
 *                                                      VAELoader / CLIPLoader(clip_name, type)
 *      形态 3  ["COMBO", {"options": [名字...]}]      UpscaleModelLoader 等 V3 schema 节点
 *
 *    实测清单（tools/probe_combo.mjs）：
 *      CheckpointLoaderSimple.ckpt_name  长度2 形态1
 *      LoraLoader.lora_name              长度2 形态1
 *      VAELoader.vae_name                长度1 形态2   ← 曾漏
 *      CLIPLoader.clip_name              长度1 形态2   ← 曾漏
 *      CLIPLoader.type                   长度1 形态2   ← 曾漏
 *      KSampler.sampler_name/scheduler   长度2 形态1
 *      UpscaleModelLoader.model_name     长度2 形态3
 */
function comboOptions(oi, node, key) {
	const v = oi && oi[node] && oi[node].input && oi[node].input.required
		&& oi[node].input.required[key];
	if (!Array.isArray(v) || !v.length) return [];
	// 形态 3：["COMBO", {options:[...]}]
	if (v[0] === "COMBO") {
		const opt = (v.length > 1 && v[1] && v[1].options) || [];
		return Array.isArray(opt) ? opt.slice() : [];
	}
	// 形态 1 / 2：第一项就是名字数组（第二项可有可无）
	if (Array.isArray(v[0])) return v[0].slice();
	// 兜底：直接是字符串数组
	if (typeof v[0] === "string") return v.slice();
	return [];
}

/**
 * 粗筛：这个文件名像不像"放大模型"。
 *
 * ⚠️ 2026-10-16：`extra_model_paths.yaml` 里如果把握把 `upscale_models` 指到了
 *    模型树根（而不是专用子目录），ComfyUI 会**递归列举**，于是底模/LoRA/VAE
 *    全被塞进 `UpscaleModelLoader` 的候选列表。实测出现过 24 个条目里 23 个是底模，
 *    用户很自然地把底模当放大模型选中 -> `spandrel UnsupportedModelError`。
 *
 *    真正的根因已经改 yaml 修掉了，这里是**保险**：
 *    名字里带已知的"非放大模型"目录标记就过滤掉。
 */
function looksLikeUpscaler(name) {
	const s = String(name || "");
	if (!s) return false;
	const bad = /(^|[\\/])(checkpoints|loras|vae|text_encoders|clip|clip_vision|embeddings|controlnet|unet|diffusion_models|style_models|photomaker|model_patches)([\\/]|$)/i;
	return !bad.test(s);
}

// 模型适配 v1：UI、AI、校验和生成图共用能力；文件名仅提供建议。
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
function modelProfileOptions(){
 return Object.entries(MODEL_PROFILES).filter(([id])=>!['legacy','unknown'].includes(id))
  .map(([value,p])=>({value,label:p.label})).sort((a,b)=>a.label.localeCompare(b.label,'en',{sensitivity:'base',numeric:true}));
}
function normalizeModelConfig(value){
 const v=value&&typeof value==="object"?value:{};
 return {version:1,profileMode:v.profileMode==='manual'||v.profileMode===undefined&&!['legacy','unknown',undefined].includes(v.profile)?'manual':'auto',profileFingerprint:String(v.profileFingerprint||''),detection:normalizeModelDetection(v.detection),contentMode:['checkpoint','diffusion'].includes(v.contentMode)?v.contentMode:'unknown',embeddedClip:typeof v.embeddedClip==='boolean'?v.embeddedClip:null,embeddedVae:typeof v.embeddedVae==='boolean'?v.embeddedVae:null,componentOrder:normalizeComponentOrder(v.componentOrder),encoderOverride:v.encoderOverride===true,vaeOverride:v.vaeOverride===true,mode:v.mode==="diffusion"?"diffusion":"checkpoint",profile:v.profile===undefined?"legacy":(Object.prototype.hasOwnProperty.call(MODEL_PROFILES,v.profile)?v.profile:"unknown"),main:String(v.main||""),clip2:String(v.clip2||""),clip3:String(v.clip3||""),clip4:String(v.clip4||""),accelerationLora:String(v.accelerationLora||""),slg:v.slg!==false,encoderMode:v.encoderMode===undefined?"triple":String(v.encoderMode),shift:v.shift??null,dtype:String(v.dtype||"default"),guidance:v.guidance??3.5,clipSkip:v.clipSkip??0,identity:String(v.identity||"")};
}
function normalizeModelDetection(value){
 if(!value||typeof value!=='object')return null;
 const profile=Object.prototype.hasOwnProperty.call(MODEL_PROFILES,value.profile)?value.profile:'';
 return {profile,family:String(value.family||'').slice(0,64),confidence:value.confidence==='high'?'high':'unknown',candidates:(Array.isArray(value.candidates)?value.candidates:[]).filter(id=>Object.prototype.hasOwnProperty.call(MODEL_PROFILES,id)).slice(0,24),format:String(value.format||'').slice(0,24),fingerprint:String(value.fingerprint||'').slice(0,100),method:String(value.method||'').slice(0,100),message:String(value.message||'').slice(0,240),mode:['checkpoint','diffusion'].includes(value.mode)?value.mode:'unknown',embedded_clip:typeof value.embedded_clip==='boolean'?value.embedded_clip:null,embedded_vae:typeof value.embedded_vae==='boolean'?value.embedded_vae:null};
}
function applyAutoModelDetection(value,result){
 const c=normalizeModelConfig(value),d=normalizeModelDetection(result);if(!d)return c;
 let out=withModelFileInfo(c,{contentMode:d.mode,embeddedClip:d.embedded_clip,embeddedVae:d.embedded_vae});
 const changed=c.profileFingerprint&&d.fingerprint&&c.profileFingerprint!==d.fingerprint;
 const manual=c.profileMode==='manual'&&!changed;
 out={...out,detection:d,profileMode:manual?'manual':'auto',profileFingerprint:d.fingerprint};
 if(!manual){out.profile=d.confidence==='high'&&d.profile?d.profile:'unknown';
  if(modelProfile(out).family==='sd3'&&(modelNeedsExternal(out)||out.embeddedClip===false)&&out.encoderMode==='embedded')out.encoderMode='triple';
  if(!['sd15','sdxl','legacy'].includes(modelProfile(out).family))out.clipSkip=0;
 }
 return out;
}
function mainModelLoader(config,checkpoint){
 const c=normalizeModelConfig(config),name=c.mode==='diffusion'?c.main:checkpoint;
 if(/\.gguf$/i.test(String(name)))return {class_type:'UnetLoaderGGUF',inputs:{unet_name:name}};
 return c.mode==='diffusion'?{class_type:'UNETLoader',inputs:{unet_name:c.main,weight_dtype:c.dtype}}:{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:checkpoint}};
}
function normalizeComponentOrder(order){return [...new Set((Array.isArray(order)?order:[]).filter(k=>typeof k==='string'&&(k==='scene3d'||k==='anima'||k==='reference'||k==='clip'||k==='vae'||k==='acceleration'||k.startsWith('encoder:')&&k.length>8||k.startsWith('lora:')&&k.length>5)&&k.length<4096))].slice(0,256);}
function orderedModelComponents(config,keys){const active=new Set(keys),order=normalizeComponentOrder(config.componentOrder);return [...order.filter(k=>active.has(k)),...keys.filter(k=>!order.includes(k))];}
function modelNeedsExternal(config){const c=normalizeModelConfig(config),p=MODEL_PROFILES[c.profile];return /\.gguf$/i.test(c.main)||c.detection?.format==='GGUF'||c.mode==='diffusion'||c.contentMode==='diffusion'||p.modes.length===1&&p.modes[0]==='diffusion';}
function modelNeedsVae(config){const c=normalizeModelConfig(config);return modelNeedsExternal(c)||c.embeddedVae===false||c.vaeOverride;}
function withModelFileInfo(value,info){const c=normalizeModelConfig({...value,contentMode:info.contentMode,embeddedClip:info.embeddedClip,embeddedVae:info.embeddedVae});if(MODEL_PROFILES[c.profile].family==='sd3'&&c.encoderMode==='embedded'&&(modelNeedsExternal(c)||c.embeddedClip===false))c.encoderMode='triple';return c;}
function modelProfile(config){return MODEL_PROFILES[normalizeModelConfig(config).profile];}
function suggestModelProfile(name){
 const s=String(name||"").toLowerCase();
 if(/radiance|kontext|inpaint|refiner|edit|layered|fill/.test(s))return '';
 if(/flux[-._ ]?2|flux-2/.test(s)){
  if(/klein/.test(s)){const size=/9b/.test(s)?9:/4b/.test(s)?4:0;return size?'flux2-klein'+size+(/base/.test(s)?'-base':'-distilled'):'';}
  return /dev/.test(s)?'flux2-dev':'';
 }
 if(/hidream/.test(s))return /full/.test(s)?'hidream-full':/fast/.test(s)?'hidream-fast':/dev/.test(s)?'hidream-dev':'';
 if(/qwen[_ -]?image/.test(s)){if(/2[._]1/.test(s))return /turbo/.test(s)?'qwen21-turbo':'qwen21';if(/2512/.test(s))return 'qwen-2512';return /distill/.test(s)?'qwen-distill':'qwen-image';}
 if(/z[_ -]?image/.test(s))return /turbo/.test(s)?'z-image-turbo':'z-image';
 if(/moss[_ -]?image/.test(s))return /sft/.test(s)?'moss-sft':/base/.test(s)?'moss-base':'';
 if(/krea[_ -]?2/.test(s))return /turbo/.test(s)?'krea2-turbo':/raw/.test(s)?'krea2-raw':'';
 if(/hunyuan[_ -]?image.?2[._]1/.test(s))return 'hunyuan21';
 if(/lumina.?2/.test(s))return 'lumina2';if(/chroma/.test(s))return 'chroma';
 if(/illustrious/.test(s))return 'illustrious';if(/pony/.test(s)&&/xl|v6/.test(s))return 'pony';
 if(/sdxl|sd_xl/.test(s)){if(/lightning/.test(s)){const m=s.match(/([1248])[_ -]?step/);return m?'sdxl-lightning-'+m[1]:'';}if(/turbo/.test(s))return 'sdxl-turbo';}

 if(/anima/.test(s))return /turbo/.test(s)?"anima-turbo":/aesthetic/.test(s)?"anima-aesthetic":"anima-base";
 if(/flux[._ -]?1/.test(s)&&!/flux[._ -]?2/.test(s))return /schnell/.test(s)?"flux-schnell":/krea/.test(s)?"flux-krea":"flux-dev";
 if(/sd[._ -]?3[._ -]?5/.test(s))return /turbo/.test(s)?"sd35-turbo":/medium/.test(s)?"sd35-medium":/large/.test(s)?"sd35-large":"";
 if(/sd[._ -]?3/.test(s)&&/medium/.test(s))return "sd3-medium";
 if(/sdxl/.test(s))return "sdxl";
 if(/sd[._ -]?1[._ -]?5|v1-5/.test(s))return "sd15";
 return "";
}
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
function controlEncoderLabel(role,count){return count>1?'Text Encoder · '+role:'Text Encoder';}
function controlLoraKey(l){return 'lora:'+(l.id||l.name);}
function generationControlEntries(setup){
 const c=normalizeModelConfig(setup.modelConfig),roles=controlEncoderRoles(c),files=[setup.clip,c.clip2,c.clip3,c.clip4],entries=new Map(),order=[];
 const add=key=>{if(!order.includes(key))order.push(key);};
 for(const key of c.componentOrder){if(key==='clip')roles.forEach(role=>add('encoder:'+role));else add(key);}
 roles.forEach((role,index)=>{const key='encoder:'+role;if(order.includes(key)||files[index]||c.encoderOverride&&!c.componentOrder.some(k=>k.startsWith('encoder:')))entries.set(key,{key,kind:'clip',role,index,name:files[index]||'',label:controlEncoderLabel(role,roles.length)});});
 if(order.includes('vae')||setup.vae||c.vaeOverride)entries.set('vae',{key:'vae',kind:'vae',name:setup.vae||'',label:'VAE'});
 if(modelProfile(c).acceleration&&(order.includes('acceleration')||c.accelerationLora))entries.set('acceleration',{key:'acceleration',kind:'lora',name:c.accelerationLora||'',label:'加速 LoRA · '+modelProfile(c).acceleration,acceleration:true});
 if(setup.anima)entries.set('anima',{key:'anima',kind:'anima',name:setup.anima.name||'',label:'Anima control'});
 if(setup.referenceImage)entries.set('reference',{key:'reference',kind:'reference',name:setup.referenceImage.name||'',label:'图生图'});
 for(const lora of setup.loras||[]){const key=controlLoraKey(lora);entries.set(key,{key,kind:'lora',name:lora.name||'',label:'LoRA',lora});}
 return [...order.filter(key=>entries.has(key)),...Array.from(entries.keys()).filter(key=>!order.includes(key))].map(key=>entries.get(key));
}
function generationControlSummary(entries){if(!entries.length)return '0 个控制';const n=kind=>entries.filter(e=>e.kind===kind).length;return [['vae','VAE'],['clip','文本编码器'],['lora','LoRA'],['reference','图生图'],['anima','Anima control']].filter(([kind])=>n(kind)).map(([kind,label])=>n(kind)+' '+label).join(' · ');}
function effectiveModelSetup(o){
 const c=normalizeModelConfig(o.modelConfig),p=modelProfile(c);
 if(!modelNeedsExternal(c)){if(c.embeddedClip!==false&&![o.clip,c.clip2,c.clip3,c.clip4].some(Boolean)){c.encoderOverride=false;if(p.family==='sd3')c.encoderMode='embedded';}if(c.embeddedVae!==false&&!o.vae)c.vaeOverride=false;}
 const count=modelEncoderCount({...o,modelConfig:c});
 return {...o,clip:count===0?'':o.clip,clipType:p.clipType||o.clipType,modelConfig:{...c,accelerationLora:p.acceleration?c.accelerationLora:'',slg:!!p.slgNode&&c.slg,clip2:count>=2?c.clip2:'',clip3:count>=3?c.clip3:'',clip4:count>=4?c.clip4:''}};
}
function modelSetupErrors(o){
 const c=normalizeModelConfig(o.modelConfig),p=modelProfile(c),errors=[],count=modelEncoderCount(o),files=[o.clip,c.clip2,c.clip3,c.clip4];
 if(p.family==='unknown')errors.push('模型类型尚未确定，请在主模型信息中确认');
 if(!(c.mode==='diffusion'?c.main:o.ckpt))errors.push('请选择主模型');
 if(p.family==='sd3'&&(!['embedded','triple','dual','t5'].includes(c.encoderMode)))errors.push('请选择 SD3 文本编码方式');
 if(p.family==='sd3'&&(modelNeedsExternal(c)||c.embeddedClip===false)&&c.encoderMode==='embedded')errors.push('独立 Diffusion 不能使用 Checkpoint 内置编码器');
 if(count&&files.slice(0,count).some(x=>!x))errors.push('请补齐当前编码方式所需的 Text Encoder：'+modelEncoderRoles(c).slice(0,count).join(' / '));
 if(modelNeedsVae(c)&&!o.vae)errors.push('缺少 VAE');
 if(p.samplingShift&&c.shift!==null&&(String(c.shift).trim()===''||!Number.isFinite(Number(c.shift))||Number(c.shift)<0||Number(c.shift)>100))errors.push('采样 Shift 需为 0–100 的数值，或使用默认');
 if(p.guidance&&(!Number.isFinite(Number(c.guidance))||Number(c.guidance)<0||Number(c.guidance)>100))errors.push('Guidance 需在 0–100 之间');
 if(!Number.isInteger(Number(c.clipSkip))||Number(c.clipSkip)<0||Number(c.clipSkip)>24)errors.push('Clip Skip 需为 0–24 的整数');
 if(Number(c.clipSkip)&&!['sd15','sdxl','legacy'].includes(p.family))errors.push('当前适配不使用 Clip Skip');
 if(p.acceleration&&!c.accelerationLora)errors.push('请选择此加速变体要求的 LoRA：'+p.acceleration);
 if(p.acceleration&&activeModelLoras(o.loras).some(x=>x.name===c.accelerationLora))errors.push('加速 LoRA 已由专用配置按权重 1 启用，请暂停重复的风格 LoRA');
 if(p.lightningSteps&&o.steps!==undefined&&Number(o.steps)!==p.lightningSteps)errors.push('此 Lightning 权重要求 '+p.lightningSteps+' 步，请应用推荐参数');
 for(const l of activeModelLoras(o.loras))if(!l.name||![l.model,l.clip??l.model].every(v=>Number.isFinite(Number(v))))errors.push('LoRA 名称或权重无效');
 return errors;
}
/** 采样节点预设：每个预设声明可调参数与图构造方式（参数 key 与 ComfyUI 节点输入一致）。 */
const SAMPLING_PRESETS = Object.freeze([
 {id:'ksampler',name:'K采样器',desc:'单节点 KSampler，兼容性最好',params:[
  {key:'steps',label:'步数',kind:'number',min:1,max:10000,step:1,def:24},
  {key:'cfg',label:'CFG',kind:'number',min:0,max:100,step:.1,def:6},
  {key:'sampler_name',label:'采样器',kind:'combo',options:'samplers',def:'euler'},
  {key:'scheduler',label:'调度器',kind:'combo',options:'schedulers',def:'normal'},
  {key:'denoise',label:'降噪',kind:'number',min:0,max:1,step:.01,def:1},
 ]},
 {id:'ksampler-advanced',name:'K采样器（高级）',desc:'可控制起止步数与剩余噪声',params:[
  {key:'steps',label:'步数',kind:'number',min:1,max:10000,step:1,def:24},
  {key:'cfg',label:'CFG',kind:'number',min:0,max:100,step:.1,def:6},
  {key:'sampler_name',label:'采样器',kind:'combo',options:'samplers',def:'euler'},
  {key:'scheduler',label:'调度器',kind:'combo',options:'schedulers',def:'normal'},
  {key:'add_noise',label:'添加噪声',kind:'combo',options:['enable','disable'],def:'enable'},
  {key:'start_at_step',label:'起始步',kind:'number',min:0,max:10000,step:1,def:0},
  {key:'end_at_step',label:'结束步',kind:'number',min:0,max:10000,step:1,def:10000},
  {key:'return_with_leftover_noise',label:'保留剩余噪声',kind:'combo',options:['disable','enable'],def:'disable'},
 ]},
 {id:'custom-advanced',name:'自定义采样器（高级）',desc:'RandomNoise + 调度器 + 引导器 + SamplerCustomAdvanced',params:[
  {key:'steps',label:'步数',kind:'number',min:1,max:10000,step:1,def:24},
  {key:'cfg',label:'CFG',kind:'number',min:0,max:100,step:.1,def:6},
  {key:'sampler_name',label:'采样器',kind:'combo',options:'samplers',def:'euler'},
  {key:'scheduler',label:'调度器',kind:'combo',options:'schedulers',def:'normal'},
 ]},
 {id:'anima-speed',name:'Anima SPEED',desc:'Spectral Progressive Diffusion 加速采样组（BasicScheduler + RandomNoise + CFGGuider + SamplerSPEED + SamplerCustomAdvanced）',params:[
  {key:'steps',label:'步数',kind:'number',min:1,max:10000,step:1,def:13},
  {key:'cfg',label:'CFG',kind:'number',min:0,max:100,step:.1,def:4.5},
  {key:'scheduler',label:'调度器',kind:'combo',options:'schedulers',def:'beta57'},
  {key:'base_sampler',label:'基础采样器',kind:'combo',options:'samplers',def:'er_sde'},
  {key:'transform',label:'变换',kind:'combo',options:['dct','dwt','fft'],def:'dct'},
  {key:'mode',label:'模式',kind:'combo',options:['delta_optimal','manual'],def:'delta_optimal'},
  {key:'model_preset',label:'频谱预设',kind:'combo',options:['flux','wan21','custom'],def:'flux'},
  {key:'scales',label:'Scales',kind:'text',def:'0.5,1.0'},
  {key:'delta',label:'Delta',kind:'number',min:0.0001,max:0.5,step:.001,def:0.01},
  {key:'manual_sigmas',label:'Manual Sigmas',kind:'text',def:'0.85'},
  {key:'spectrum_A',label:'Spectrum A',kind:'number',min:0,max:1000000,step:.001,def:203.615},
  {key:'spectrum_beta',label:'Spectrum Beta',kind:'number',min:0,max:10,step:.001,def:1.915},
 ]},
]);
function samplingPreset(id){return SAMPLING_PRESETS.find(p=>p.id===id)||SAMPLING_PRESETS[0];}
function samplingParamValues(preset,values,o){
 const v=values||{},out={};
 for(const def of preset.params){
  if(def.key==='seed')continue;
  let value=v[def.key];
  if(value===undefined){
   if(preset.id==='ksampler'){if(def.key==='steps')value=o.steps;else if(def.key==='cfg')value=o.cfg;else if(def.key==='sampler_name')value=o.sampler;else if(def.key==='scheduler')value=o.scheduler;else if(def.key==='denoise')value=1;}
   if(value===undefined)value=def.def;
  }
  out[def.key]=value;
 }
 return out;
}
/** 把所选采样节点/组写进图，输出节点固定为 g["7"]。 */
function appendSamplingGraph(g,o,ctx){
 const {model,positive,negative,latent,p}=ctx;
 const profile=o.sampling&&o.sampling.profile?o.sampling.profile:(p.advanced?'custom-advanced':'ksampler');
 const values=(o.sampling&&o.sampling.values&&o.sampling.values[profile])||{};
 const preset=samplingPreset(profile),v=samplingParamValues(preset,values,o);
 const seed=Number(values.seed!==undefined?values.seed:o.seed)||0;
 if(profile==='anima-speed'){
  const sched=v.scheduler||'beta57';
  g["70"]={class_type:'BasicScheduler',inputs:{model,scheduler:sched,steps:Number(v.steps),denoise:1}};
  g["71"]={class_type:'RandomNoise',inputs:{noise_seed:seed}};
  g["72"]=p.basicGuider?{class_type:'BasicGuider',inputs:{model,conditioning:positive}}:{class_type:'CFGGuider',inputs:{model,positive,negative,cfg:p.negative?Number(v.cfg):1}};
  if(p.basicGuider)delete g["5"];
  const speedSeed=Math.max(0,Math.min(2147483647,Math.floor(seed)));
  g["73"]={class_type:'SamplerSPEED',inputs:{base_sampler:v.base_sampler||'er_sde',transform:v.transform||'dct',mode:v.mode||'delta_optimal',model_preset:v.model_preset||'flux',scales:v.scales||'0.5,1.0',delta:Number(v.delta),manual_sigmas:v.manual_sigmas||'0.85',spectrum_A:Number(v.spectrum_A),spectrum_beta:Number(v.spectrum_beta),seed:speedSeed}};
  g["7"]={class_type:'SamplerCustomAdvanced',inputs:{noise:["71",0],guider:["72",0],sampler:["73",0],sigmas:["70",0],latent_image:latent}};
  return;
 }
 if(profile==='ksampler-advanced'){
  g["7"]={class_type:'KSamplerAdvanced',inputs:{model,positive,negative,latent_image:latent,add_noise:v.add_noise||'enable',noise_seed:seed,steps:Number(v.steps),cfg:p.negative?Number(v.cfg):1,sampler_name:v.sampler_name,scheduler:v.scheduler,start_at_step:Number(v.start_at_step),end_at_step:Number(v.end_at_step),return_with_leftover_noise:v.return_with_leftover_noise||'disable'}};
  return;
 }
 if(p.advanced||profile==='custom-advanced'){
  const type=p.advanced;g["13"]={class_type:'RandomNoise',inputs:{noise_seed:seed}};g["14"]={class_type:'KSamplerSelect',inputs:{sampler_name:v.sampler_name||o.sampler}};
  const inputs=type==='Flux2Scheduler'?{steps:Number(v.steps),width:o.w,height:o.h}:type==='SDTurboScheduler'?{model,steps:Number(v.steps),denoise:1}:{sigmas:p.sigmas};
  g["15"]={class_type:type,inputs};g["16"]=p.basicGuider?{class_type:'BasicGuider',inputs:{model,conditioning:positive}}:{class_type:'CFGGuider',inputs:{model,positive,negative,cfg:p.negative?Number(v.cfg):1}};
  if(p.basicGuider)delete g["5"];
  g["7"]={class_type:'SamplerCustomAdvanced',inputs:{noise:["13",0],guider:["16",0],sampler:["14",0],sigmas:["15",0],latent_image:latent}};
  return;
 }
 g["7"]={class_type:'KSampler',inputs:{model,positive,negative,latent_image:latent,seed,steps:Number(v.steps),cfg:p.negative?Number(v.cfg):1,sampler_name:v.sampler_name||o.sampler,scheduler:v.scheduler||o.scheduler,denoise:Number(v.denoise)}};
}
function modelGraph(o){
 o=effectiveModelSetup(o);
 const c=normalizeModelConfig(o.modelConfig),p=modelProfile(c),errors=modelSetupErrors(o),count=modelEncoderCount(o);
 if(errors.length)throw Error(errors.join('；'));
 const g={'1':mainModelLoader(c,o.ckpt)};
 g["1"]._meta={dsh_model_config:{...c}};
 if(o.clip){
  const files=[o.clip,c.clip2,c.clip3,c.clip4];
  if(count===1)g["2"]={class_type:/\.gguf$/i.test(String(o.clip))?'CLIPLoaderGGUF':'CLIPLoader',inputs:{clip_name:o.clip,type:p.clipType||o.clipType||'stable_diffusion'}};
  else{const inputs=Object.fromEntries(files.slice(0,count).map((file,i)=>['clip_name'+(i+1),file]));if(count===2)inputs.type=p.clipType;g["2"]={class_type:(count===4?'QuadrupleCLIPLoader':count===3?'TripleCLIPLoader':'DualCLIPLoader')+(files.slice(0,count).some(file=>/\.gguf$/i.test(String(file)))?'GGUF':''),inputs};}
 }
 if(o.vae)g["3"]={class_type:'VAELoader',inputs:{vae_name:o.vae}};
 let model=["1",0],clip=o.clip?["2",0]:["1",1];
 const loras=activeModelLoras(o.loras).filter(l=>!p.acceleration||l.name!==c.accelerationLora);
 if(p.acceleration)loras.unshift({name:c.accelerationLora,model:1,clip:0});
 loras.forEach((l,i)=>{const id=String(100+i);g[id]=p.modelOnlyLora||p.acceleration&&i===0?{class_type:'LoraLoaderModelOnly',inputs:{model,lora_name:l.name,strength_model:Number(l.model)}}:{class_type:'LoraLoader',inputs:{model,clip,lora_name:l.name,strength_model:Number(l.model),strength_clip:Number(l.clip??l.model)}};model=[id,0];if(g[id].class_type==='LoraLoader')clip=[id,1];});
 if(p.samplingShift&&(c.shift!==null||p.patchNode)){g["12"]={class_type:p.patchNode||'ModelSamplingSD3',inputs:{model,shift:Number(c.shift??p.patchShift)}};model=["12",0];}
 if(p.x0){g["17"]={class_type:'ModelSamplingDiscrete',inputs:{model,sampling:'x0',zsnr:false}};model=["17",0];}
 if(p.slgNode&&c.slg){g["18"]={class_type:p.slgNode,inputs:{model,double_layers:'',single_layers:'22',start_percent:0,end_percent:.5}};model=["18",0];}
 if(p.cacheNode){g["19"]={class_type:p.cacheNode,inputs:{model,device:'auto',dtype:'default'}};model=["19",0];}
 if(Number(c.clipSkip)){g["10"]={class_type:'CLIPSetLastLayer',inputs:{clip,stop_at_clip_layer:-Number(c.clipSkip)}};clip=["10",0];}
 if(p.tokenizer){g["24"]={class_type:'T5TokenizerOptions',inputs:{clip,min_padding:0,min_length:0}};clip=["24",0];}
 let positive=["4",0],negative=["5",0];
 if(p.textNode){g["4"]={class_type:p.textNode,inputs:{clip,prompt:o.pos,negative_prompt:p.negative?o.neg:'',resolution:1024}};negative=["4",1];}
 else{g["4"]={class_type:'CLIPTextEncode',inputs:{text:o.pos,clip}};}
 if(p.guidance){g["11"]={class_type:'FluxGuidance',inputs:{conditioning:positive,guidance:Number(c.guidance)}};positive=["11",0];}
 if(!p.textNode)g["5"]=p.negative?{class_type:'CLIPTextEncode',inputs:{text:o.neg,clip}}:{class_type:'ConditioningZeroOut',inputs:{conditioning:positive}};
 g["6"]={class_type:p.latent,inputs:{width:o.w,height:o.h,batch_size:1}};
 const cnCtl=o.anima&&o.anima.enabled?normalizeScene3DControlnet(o.anima.controlnet):(o.scene3d&&o.scene3d.enabled?normalizeScene3DControlnet(o.scene3d.controlnet):null);
 const cnImage=o.scene3dImage||o.animaImage;
 if(cnCtl&&cnCtl.model&&cnImage){
  g["30"]={class_type:'LoadImage',inputs:{image:cnImage}};
  if(/anima_/i.test(String(cnCtl.model))){
   g["31"]={class_type:'AnimaLLLiteApply_sdscripts',inputs:{model,lllite_name:cnCtl.model,image:["30",0],strength:cnCtl.strength,start_percent:cnCtl.start,end_percent:cnCtl.end,preserve_wrapper:true}};
   model=["31",0];
  }else if(/lllite/i.test(String(cnCtl.model))){
   g["31"]={class_type:'ModelPatchLoader',inputs:{name:cnCtl.model}};
   g["32"]={class_type:'AnimaLLLiteApply',inputs:{model,model_patch:["31",0],image:["30",0],strength:cnCtl.strength,start_percent:cnCtl.start,end_percent:cnCtl.end}};
   model=["32",0];
  }else{
   g["31"]={class_type:'ControlNetLoader',inputs:{control_net_name:cnCtl.model}};
   g["32"]={class_type:'ControlNetApplyAdvanced',inputs:{positive:positive,negative:negative,control_net:["31",0],image:["30",0],strength:cnCtl.strength,start_percent:cnCtl.start,end_percent:cnCtl.end}};
   positive=["32",0];negative=["32",1];
  }
 }
 appendSamplingGraph(g,o,{model,positive,negative,latent:["6",0],width:o.w,height:o.h,p});
 g["8"]={class_type:'VAEDecode',inputs:{samples:["7",0],vae:o.vae?["3",0]:["1",2]}};
 return g;
}

function validateModelGraph(graph,info){
 const errors=[];
 for(const node of Object.values(graph)){
  const spec=info[node.class_type];if(!spec){errors.push("缺少节点 "+node.class_type);continue;}
  for(const [key,desc] of Object.entries(spec.input?.required||{}))if(!(key in node.inputs)&&!(desc[0]==="COMFY_AUTOGROW_V3"&&desc[1]?.template?.min===0))errors.push(node.class_type+" 缺少参数 "+key);
  for(const [key,value] of Object.entries(node.inputs)){
   const desc=spec.input?.required?.[key]||spec.input?.optional?.[key];if(!desc){errors.push(node.class_type+" 不支持参数 "+key);continue;}
   if(Array.isArray(value)&&value.length===2&&typeof value[0]==="string"){
    if(!graph[value[0]])errors.push(node.class_type+" 连接目标不存在");
    const outputs=info[graph[value[0]]?.class_type]?.output;
    if(Array.isArray(outputs)&&(!Number.isInteger(value[1])||value[1]<0||value[1]>=outputs.length))errors.push(node.class_type+" 连接的输出槽位无效");
    else if(Array.isArray(outputs)&&typeof desc[0]==="string"&&desc[0]!=="*"&&outputs[value[1]]!=="*"&&outputs[value[1]]!==desc[0])errors.push(node.class_type+" · "+key+" 连接类型不匹配");
    continue;
   }
   const options=comboOptions({[node.class_type]:spec},node.class_type,key);
   if((Array.isArray(desc[0])||desc[0]==="COMBO")&&!options.includes(value))errors.push(node.class_type+" · "+key+" 不在当前服务可选列表中："+value);
   if(["INT","FLOAT"].includes(desc[0])){const n=Number(value),limits=desc[1]||{};if(!Number.isFinite(n)||(desc[0]==="INT"&&!Number.isInteger(n))||(limits.min!==undefined&&n<limits.min)||(limits.max!==undefined&&n>limits.max))errors.push(node.class_type+" · "+key+" 超出当前服务允许范围");}
  }
 }
 return [...new Set(errors)];
}

/** Reference metadata is small and persistent; PNG bytes stay in the sidecar store. */
// Keep a bounded JSON snapshot of generation settings; image bytes stay in PNG storage.
function editorOriginalParams(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 try{
  const text=JSON.stringify(value,(key,v)=>{
   if(['__proto__','prototype','constructor','base64','dataUrl','imageBytes','sourceOutput'].includes(key))return undefined;
   if(typeof v==='string'&&/^data:image\//i.test(v))return undefined;
   return v;
  });
  if(!text||new TextEncoder().encode(text).length>256*1024)return null;
  return JSON.parse(text);
 }catch{return null;}
}

function normalizeReferenceImage(value){
 if(!value||typeof value!=='object')return null;
 const asset=x=>x&&/^[0-9a-f]{64}$/.test(String(x.id))&&Number.isInteger(x.width)&&Number.isInteger(x.height)&&x.width>0&&x.height>0&&x.width<=8192&&x.height<=8192&&x.width*x.height<=16*1024*1024?{id:x.id,width:x.width,height:x.height,url:'/references/'+x.id}:null;
 return {version:1,enabled:value.enabled!==false,mode:value.mode==='parameters'?'parameters':'reference',denoise:value.denoise===undefined?.65:value.denoise,name:String(value.name||'').slice(0,256),asset:asset(value.asset),original:asset(value.original),editorDocument:/^[0-9a-f]{64}$/.test(String(value.editorDocument||''))?value.editorDocument:null,sourceOutput:value.sourceOutput&&typeof value.sourceOutput==='object'?{path:String(value.sourceOutput.path||'').slice(0,4096),filename:String(value.sourceOutput.filename||'').slice(0,256),prompt_id:String(value.sourceOutput.prompt_id||'').slice(0,128),params:editorOriginalParams(value.sourceOutput.params),image:value.sourceOutput.image&&typeof value.sourceOutput.image==='object'?{filename:String(value.sourceOutput.image.filename||'').slice(0,256),subfolder:String(value.sourceOutput.image.subfolder||'').slice(0,1024),type:value.sourceOutput.image.type==='temp'?'temp':'output'}:null}:null};
}
function referenceSizeLocked(value){return !!(value&&value.enabled!==false&&value.asset&&value.mode==='reference');}
function referenceBaseSize(value,w,h){return referenceSizeLocked(value)?{w:value.asset.width,h:value.asset.height}:{w:Number(w),h:Number(h)};}
function generationImageSize(value,w,h,multiplier,alignment=8){
 const base=referenceBaseSize(value,w,h),size=imageSizeScaled(base.w,base.h,multiplier,alignment);
 if(value?.enabled!==false&&value?.asset){const snap=v=>Math.max(64,Math.min(Math.floor(8192/alignment)*alignment,Math.round(v/alignment)*alignment));return {w:snap(size.w),h:snap(size.h)};}return size;
}
function appendReferenceGraph(g,o){
 const ref=normalizeReferenceImage(o.referenceImage);if(!ref||ref.enabled===false)return;
 if(!ref.asset||!o.referenceInput||!/^(?:dsh_reference\/)?[0-9a-f]{64}(?: \(\d+\))?\.png$/.test(o.referenceInput))throw Error('请选择图生图，并先准备 ComfyUI 图片输入');
 const denoise=Number(ref.denoise);if(ref.denoise===''||ref.denoise===null||!Number.isFinite(denoise)||denoise<0||denoise>1)throw Error('图生图降噪强度需为 0–1');
 g['30']={class_type:'LoadImage',inputs:{image:o.referenceInput}};
 g['31']={class_type:'ImageScale',inputs:{image:['30',0],upscale_method:'lanczos',width:o.w,height:o.h,crop:'disabled'}};
 g['6']={class_type:'VAEEncode',inputs:{pixels:['31',0],vae:g['8'].inputs.vae}};
 if(g['7'].class_type==='KSampler')g['7'].inputs.denoise=denoise;
 else if(g['15']?.class_type==='SDTurboScheduler')g['15'].inputs.denoise=denoise;
 else if(denoise>0&&denoise<1){g['33']={class_type:'SplitSigmasDenoise',inputs:{sigmas:g['7'].inputs.sigmas,denoise}};g['7'].inputs.sigmas=['33',1];}
 if(denoise===0)g['8'].inputs.samples=['6',0];
 g['1']._meta={...g['1']._meta,dsh_reference_image:ref};
}

/** Ordinary base-model masked sampling, independent of specialized inpaint checkpoints. */
function normalizeInpaint(value){
 const base=normalizeReferenceImage(value);if(!base)return null;
 const mask=normalizeReferenceImage({asset:value.mask}).asset;
 return {...base,denoise:value.denoise===undefined?.8:value.denoise,mask,coverage:Number.isFinite(value.coverage)?Math.max(0,Math.min(1,value.coverage)):0,grow:value.grow===undefined?0:value.grow,feather:value.feather===undefined?8:value.feather};
}
function normalizeImageControls(last={}){
 const scene3d=normalizeScene3D(last.scene3d),anima=normalizeScene3D(last.anima),inpaint=normalizeInpaint(last.inpaint),referenceImage=normalizeReferenceImage(last.referenceImage);
 if(anima?.enabled){if(inpaint)inpaint.enabled=false;if(referenceImage)referenceImage.enabled=false;}
 else if(scene3d?.enabled){if(inpaint)inpaint.enabled=false;if(referenceImage)referenceImage.enabled=false;}
 else if(inpaint?.enabled&&referenceImage)referenceImage.enabled=false;
 return {scene3d,anima,inpaint,referenceImage};
}
function activeImageControl(reference,inpaint){return inpaint&&inpaint.enabled!==false?inpaint:reference;}
function inpaintErrors(value){
 const v=normalizeInpaint(value);if(!v||!v.enabled)return [];
 const errors=[];
 if(!v.asset)errors.push('请先选择局部重绘底图');
 if(!v.mask||!v.coverage)errors.push('请先绘制并应用重绘遮罩');
 if(v.asset&&v.mask&&(v.asset.width!==v.mask.width||v.asset.height!==v.mask.height))errors.push('遮罩尺寸与底图不一致，请重新绘制');
 for(const [key,label,min,max,int] of [['denoise','降噪强度',0,1,false],['grow','遮罩扩展',0,64,true],['feather','边缘过渡',0,31,true]]){const n=Number(v[key]);if(v[key]===''||v[key]===null||!Number.isFinite(n)||n<min||n>max||int&&!Number.isInteger(n))errors.push(label+'需为 '+min+'–'+max+(int?' 的整数':''));}
 return errors;
}
function generationOutputLink(g){return g['56']?['56',0]:['8',0];}
function appendInpaintGraph(g,o){
 const v=normalizeInpaint(o.inpaint);if(!v||!v.enabled)return;
 if(o.referenceImage?.enabled!==false&&o.referenceImage)throw Error('图生图与局部重绘不能同时开启');
 const errors=inpaintErrors(v);if(errors.length)throw Error(errors.join('；'));
 const valid=x=>/^(?:dsh_reference\/)?[0-9a-f]{64}(?: \(\d+\))?\.png$/.test(x||'');
 if(!valid(o.inpaintInput)||!valid(o.inpaintMaskInput))throw Error('请先准备局部重绘底图和遮罩输入');
 // Share the profile-specific denoise path and current VAE, without adding reference metadata.
 appendReferenceGraph(g,{...o,referenceImage:v,referenceInput:o.inpaintInput});delete g['1']._meta.dsh_reference_image;
 g['50']={class_type:'LoadImage',inputs:{image:o.inpaintMaskInput}};
 g['51']={class_type:'ImageScale',inputs:{image:['50',0],upscale_method:'bilinear',width:o.w,height:o.h,crop:'disabled'}};
 g['52']={class_type:'ImageToMask',inputs:{image:['51',0],channel:'red'}};
 let mask=['52',0];
 if(Number(v.grow)){g['53']={class_type:'GrowMask',inputs:{mask,expand:Number(v.grow),tapered_corners:true}};mask=['53',0];}
 if(Number(v.feather)){
  g['54']={class_type:'MaskToImage',inputs:{mask}};
  g['55']={class_type:'ImageBlur',inputs:{image:['54',0],blur_radius:Number(v.feather),sigma:1}};
  g['57']={class_type:'ImageToMask',inputs:{image:['55',0],channel:'red'}};mask=['57',0];
 }
 g['58']={class_type:'SetLatentNoiseMask',inputs:{samples:['6',0],mask}};
 g['7'].inputs.latent_image=['58',0];
 g['56']={class_type:'ImageCompositeMasked',inputs:{destination:['31',0],source:Number(v.denoise)===0?['31',0]:['8',0],x:0,y:0,resize_source:false,mask}};
 g['1']._meta={...g['1']._meta,dsh_inpaint:v};
 g['56']._meta={dsh_generation_inputs:Object.fromEntries(['ckpt','clip','clipType','vae','modelConfig','loras','scene3d','referenceImage','inpaint','pos','neg','w','h','baseW','baseH','sizeMultiplier','steps','cfg','sampler','scheduler','seed','prefix'].filter(k=>o[k]!==undefined&&(k!=='neg'||modelProfile(o.modelConfig).negative)).map(k=>[k,postClone(o[k])]))};
}

/** 拼 ComfyUI API 格式的工作流 */
function buildGraph(o,postInfo={}) {
    const g=modelGraph(o);
    if(o.inpaint?.enabled!==false&&o.inpaint)appendInpaintGraph(g,o);else appendReferenceGraph(g,o);
    if(o.postControls){appendPostGraph(g,o,postInfo);return g;}

	/**
	 * 生成后放大。
	 *
	 * 放大更适合某些训练分辨率较低的底模：直接高分辨率生成
	 * 在部分模型上可能导致额外肢体或明显增加耗时，具体效果需实测。
	 *
	 * 放大后**只预览最终图**（PreviewImage 接在放大之后），
	 * 这样任务轮询拿到的就是成品，不会误拿底图。
	 */
	let finalSrc = generationOutputLink(g);
	if (o.upscale && o.upscaleModel) {
		g["20"] = { class_type: "UpscaleModelLoader", inputs: { model_name: o.upscaleModel } };
		g["21"] = {
			class_type: "ImageUpscaleWithModel",
			inputs: { upscale_model: ["20", 0], image: finalSrc },
		};
		finalSrc = ["21", 0];
		// 不假定模型一定是 4x：2x、4x 放大模型最终统一调整到用户指定的尺寸。
		const f = Number(o.upscaleFactor) === 2 ? 2 : 4;
		g["22"] = {
			class_type: "ImageScale",
			inputs: {
				image: ["21", 0], upscale_method: "lanczos",
				width: Number(o.w) * f, height: Number(o.h) * f, crop: "center",
			},
		};
		finalSrc = ["22", 0];
	}
	g["9"] = { class_type: "PreviewImage", inputs: { images: finalSrc } };
	return g;
}


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
function numberInputPrecision(step=1){const value=String(Number(step)||1).toLowerCase(),parts=value.split('e'),decimals=(parts[0].split('.')[1]||'').length;return Math.max(0,Math.min(10,decimals-Number(parts[1]||0)));}
function DraggableNumberInput({
    value,onChange,min=Number.MIN_SAFE_INTEGER,max=Number.MAX_SAFE_INTEGER,step=.01,precision=2,dragPerPixel=1/300,disabled=false,allowEmpty=false,placeholder,integerString=false,
    label='数值',decreaseLabel='减小',increaseLabel='增大',className='',wrap=0,
}){
    // Circular inputs (angles, hues) loop across their ends without locking
    // the arrows or cancelling an in-progress drag. Other numbers still clamp.
    const factor=10**precision,clamp=n=>{
        const rounded=Math.round(n*factor)/factor;
        if(wrap>0&&Number.isFinite(wrap))return ((rounded%wrap)+wrap)%wrap;
        return Math.round(Math.max(min,Math.min(max,n))*factor)/factor;
    };
    const fallback=min<=1&&max>=1?1:min;
    const normalize=(v,fb=fallback)=>{if(integerString){let n;try{n=BigInt(String(v).trim());}catch{try{n=BigInt(String(fb));}catch{n=BigInt(fallback);}}return String(n<BigInt(min)?BigInt(min):n>BigInt(max)?BigInt(max):n);}const n=String(v??'').trim()===''?NaN:Number(v);return clamp(Number.isFinite(n)?n:Number.isFinite(Number(fb))?Number(fb):fallback);};
    const empty=v=>String(v??'').trim()==='',format=v=>allowEmpty&&empty(v)?'':integerString?normalize(v):normalize(v).toFixed(precision);
    const [draft,setDraft]=React.useState(()=>format(value)),[dragging,setDragging]=React.useState(false);
    const editing=React.useRef(false),drag=React.useRef(null),input=React.useRef(null),latest=React.useRef(value),text=React.useRef(draft),emitted=React.useRef(null),suppressClick=React.useRef(false);
    latest.current=value;
    function writeDraft(v){text.current=v;setDraft(v);}
    function publish(n){emitted.current=n;latest.current=n;onChange(n);}
    function stop(e){const d=drag.current;if(d&&e?.pointerId!==undefined&&e.pointerId!==d.id)return;drag.current=null;setDragging(false);if(d){if(d.active)suppressClick.current=true;try{d.target.releasePointerCapture(d.id);}catch{}}}
    React.useEffect(()=>{
        const n=allowEmpty&&empty(value)?'':normalize(value),local=emitted.current!==null&&(n===''?emitted.current==='':integerString?String(value)===emitted.current:Number(value)===emitted.current);emitted.current=null;
        if(!local){stop();writeDraft(format(n));}
        else if(!editing.current&&!drag.current)writeDraft(format(n));
        if(!disabled&&!(n===''&&empty(value))&&(integerString?String(value)!==n:Number(value)!==n))publish(n);
    },[value]);
    React.useEffect(()=>{if(disabled)stop();},[disabled]);
    function commit(){if(disabled)return;const n=allowEmpty&&empty(text.current)?'':normalize(text.current,latest.current);editing.current=false;writeDraft(format(n));publish(n);return n;}
    function stepBy(delta){if(disabled)return;stop();const n=normalize(integerString?BigInt(allowEmpty&&empty(text.current)?0:normalize(text.current,latest.current))+BigInt(Math.round(delta)):(allowEmpty&&empty(text.current)?0:normalize(text.current,latest.current))+delta);writeDraft(format(n));publish(n);}
    React.useEffect(()=>{const blur=()=>stop(),release=e=>stop(e);window.addEventListener('blur',blur);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);return()=>{window.removeEventListener('blur',blur);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);const d=drag.current;drag.current=null;if(d)try{d.target.releasePointerCapture(d.id);}catch{}};},[]);
    function begin(e){
        if(disabled||e.button!==0||drag.current)return;suppressClick.current=false;
        const d={x:e.clientX,base:normalize(text.current,latest.current),id:e.pointerId,target:e.currentTarget,active:false};drag.current=d;
    }
    function move(e){
        const d=drag.current;if(disabled||!d||e.pointerId!==d.id)return;
        if(e.buttons!==undefined&&!(e.buttons&1)){stop();return;}
        const dx=e.clientX-d.x;if(!d.active&&Math.abs(dx)<4)return;
        if(!d.active){d.active=true;try{d.target.setPointerCapture(d.id);}catch{stop();return;}editing.current=false;input.current?.blur();setDragging(true);}
        const n=normalize(integerString?BigInt(d.base)+BigInt(Math.round(dx*dragPerPixel)):d.base+dx*dragPerPixel);writeDraft(format(n));publish(n);
    }
    function finish(e){const d=drag.current;if(!d||e.pointerId!==d.id)return;stop(e);if(!d.active)suppressClick.current=false;}
    const arrow=(direction,text)=>h('button',{type:'button','aria-label':direction<0?decreaseLabel:increaseLabel,'data-cc-tooltip':direction<0?'减小 '+step:'增大 '+step,
        disabled:disabled||(!(wrap>0)&&!(allowEmpty&&empty(value))&&(direction<0?(integerString?BigInt(normalize(value))<=BigInt(min):normalize(value)<=min):(integerString?BigInt(normalize(value))>=BigInt(max):normalize(value)>=max))),
        onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>stepBy(direction*step)},h(PromptIcon,{name:direction<0?'chevronLeft':'chevronRight',size:12}));
    return h('div',{className:'cc-drag-number'+(className?' '+className:''),'data-dragging':dragging,'aria-disabled':disabled},
        arrow(-1,decreaseLabel),
        h('input',{ref:input,type:'number',step,min,max,disabled,placeholder,'aria-label':label,value:draft,title:'左右拖动调整；点击输入数值',
            onPointerDown:begin,onPointerMove:move,onPointerUp:finish,onPointerCancel:stop,onLostPointerCapture:stop,
            onClick:e=>{if(suppressClick.current){e.preventDefault();suppressClick.current=false;}},
            onFocus:()=>{editing.current=true;},onChange:e=>{if(disabled)return;writeDraft(e.target.value);if(allowEmpty&&empty(e.target.value)){publish('');return;}if(integerString){if(/^-?\d+$/.test(e.target.value))publish(normalize(e.target.value));return;}const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)&&n>=min&&n<=max)publish(normalize(n));},onBlur:commit,
            onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();commit();e.currentTarget.blur();}else if(e.key==='Escape'){e.preventDefault();stop();writeDraft(format(latest.current));editing.current=false;e.currentTarget.blur();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepBy(e.key==='ArrowUp'?step:-step);}}}),
        arrow(1,increaseLabel));
}
function sameLocalPath(a,b){
    const n=v=>String(v||'').replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
    return !!n(a)&&n(a)===n(b);
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
        "--cc-notebook-preview-bg": mixHex(bg, dark ? black : white, dark ? .40 : .12),
        "--cc-preview-outline": dark ? "#ffffff" : "#111111",
        "--cc-scheme": dark ? "dark" : "light",
        colorScheme: dark ? "dark" : "light",
    };
}

const UI_CSS = `
:is(.dsh-comfy-ui,.dsh-comfy-floating){--cc-slider-row-height:30px;--cc-slider-track-height:4px;--cc-slider-thumb-width:3px;--cc-slider-thumb-height:16px;--cc-slider-label-width:46px;--cc-slider-value-width:38px;--cc-slider-gap:8px;--cc-slider-track:var(--cc-border);--cc-slider-thumb:#fff;--cc-slider-thumb-outline:rgba(0,0,0,.55)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-parameter-slider{--cc-reset-size:var(--cc-slider-row-height);display:grid;grid-template-columns:var(--cc-slider-label-width) minmax(32px,1fr) var(--cc-slider-value-width) var(--cc-reset-size);align-items:center;gap:var(--cc-slider-gap);width:100%;min-width:0;min-height:var(--cc-slider-row-height);font-size:12px;color:var(--cc-text)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-parameter-slider[aria-disabled=true]{opacity:.45}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-parameter-slider-label{white-space:nowrap;color:var(--cc-muted)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-parameter-slider-value{text-align:right;font:inherit;font-variant-numeric:tabular-nums;white-space:nowrap}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input{appearance:none;-webkit-appearance:none;box-sizing:border-box;display:block;width:100%;min-width:0;height:var(--cc-slider-row-height);margin:0;padding:0;border:0!important;border-radius:0;box-shadow:none;background:transparent!important;cursor:pointer;touch-action:pan-y}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input::-webkit-slider-runnable-track{height:var(--cc-slider-track-height);border:0;border-radius:0;background:var(--cc-slider-track)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input::-moz-range-track{height:var(--cc-slider-track-height);border:0;border-radius:0;background:var(--cc-slider-track)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;box-sizing:border-box;width:var(--cc-slider-thumb-width);height:var(--cc-slider-thumb-height);margin-top:calc((var(--cc-slider-track-height) - var(--cc-slider-thumb-height))/2);border:0;border-radius:0;background:var(--cc-slider-thumb);box-shadow:0 0 0 1px var(--cc-slider-thumb-outline)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input::-moz-range-thumb{box-sizing:border-box;width:var(--cc-slider-thumb-width);height:var(--cc-slider-thumb-height);border:0;border-radius:0;background:var(--cc-slider-thumb);box-shadow:0 0 0 1px var(--cc-slider-thumb-outline)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input:hover::-webkit-slider-thumb{box-shadow:0 0 0 1px var(--cc-accent)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input:hover::-moz-range-thumb{box-shadow:0 0 0 1px var(--cc-accent)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) input.cc-parameter-slider-input:disabled{cursor:default}

:is(.dsh-comfy-ui,.dsh-comfy-floating){--cc-tooltip-bg:var(--cc-surface);--cc-tooltip-text:var(--cc-text);--cc-tooltip-border:var(--cc-border);--cc-tooltip-radius:var(--cc-ui-radius-control,6px);--cc-tooltip-padding:6px 9px;--cc-tooltip-font-size:12px;--cc-reset-size:var(--cc-ui-control-height,36px)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) [data-cc-tooltip-managed]::after{display:none!important}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-reset-button{display:inline-flex;align-items:center;justify-content:center;flex:none;width:var(--cc-reset-size);min-width:var(--cc-reset-size);height:var(--cc-reset-size);min-height:var(--cc-reset-size);padding:0!important;color:var(--cc-text);background:var(--cc-control);border:var(--cc-ui-border-width,1px) solid var(--cc-border);border-radius:var(--cc-ui-radius-control,6px);cursor:pointer}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-reset-button:disabled{opacity:.4;cursor:default}

:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-parameter-number{box-sizing:border-box}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-parameter-number[aria-disabled="true"]{opacity:.55;cursor:default}
.dsh-comfy-ui .cc-shift-controls>.cc-parameter-number{flex:0 0 110px;min-width:0}

/* Shared design primitives. Both notebook screens inherit the same host-derived palette. */
:is(.dsh-comfy-ui,.dsh-comfy-floating){--cc-ui-border-width:1px;--cc-ui-radius-sm:4px;--cc-ui-radius-control:6px;--cc-ui-radius-panel:8px;--cc-ui-weight-label:600;--cc-ui-space-sm:8px;--cc-ui-space-md:16px;--cc-ui-control-height:36px;--cc-control-entry-height:32px;--cc-control-entry-gap:6px;--cc-control-entry-padding:10px;--cc-notebook-cell-bg:var(--cc-control);--cc-notebook-preview-bg:color-mix(in srgb,var(--cc-bg) 60%,black);--cc-notebook-header-bg:color-mix(in srgb,var(--cc-bg) 78%,black);--cc-notebook-control-bg:var(--cc-control);--cc-notebook-hover-bg:var(--cc-hover);--cc-notebook-border:var(--cc-border);--cc-notebook-text:var(--cc-text);--cc-notebook-muted:var(--cc-muted);--cc-notebook-rail:var(--cc-accent-bg);--cc-notebook-border-width:var(--cc-ui-border-width);--cc-notebook-rail-width:3px;--cc-notebook-radius:var(--cc-ui-radius-panel);--cc-notebook-control-radius:var(--cc-ui-radius-control);--cc-notebook-title-weight:var(--cc-ui-weight-label);--cc-notebook-gap:10px;--cc-notebook-padding:var(--cc-ui-space-md);--cc-notebook-field-gap:var(--cc-ui-space-md);--cc-notebook-control-height:var(--cc-ui-control-height)}

${typeof NUMBER_INPUT_CSS==='string'?NUMBER_INPUT_CSS:''}
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
.dsh-comfy-ui .cc-image-settings :is(input[type=text],.cc-select-trigger,.cc-icon-button,.cc-save-row>button,.cc-image-actions>button,.cc-summary){border-radius:6px!important}
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

/* Explicit checker palettes are image inspection surfaces, independent of DSH theme. */
.dsh-comfy-ui .cc-preview-background-control{width:150px;max-width:100%;margin-left:12px;min-width:0}
.dsh-comfy-ui .cc-preview-background-control .cc-select-trigger{width:100%;height:26px;min-height:26px;font-size:11px;padding-top:2px;padding-bottom:2px}
.dsh-comfy-ui .cc-image-preview-stage[data-preview-background="light"]{--cc-preview-checker-a:#fff;--cc-preview-checker-b:#dedede;--cc-preview-outline:#222;--cc-preview-empty-text:#444}
.dsh-comfy-ui .cc-image-preview-stage[data-preview-background="dark"]{--cc-preview-checker-a:#242424;--cc-preview-checker-b:#363636;--cc-preview-outline:#eee;--cc-preview-empty-text:#ddd}
.dsh-comfy-ui .cc-image-preview-stage:is([data-preview-background="light"],[data-preview-background="dark"]){background-color:var(--cc-preview-checker-a);background-image:repeating-conic-gradient(var(--cc-preview-checker-b) 0% 25%,var(--cc-preview-checker-a) 0% 50%);background-size:24px 24px}
.dsh-comfy-ui .cc-image-preview-stage .cc-preview-empty{color:var(--cc-preview-empty-text,var(--cc-muted))}
.dsh-comfy-ui .cc-image-preview-stage:is([data-preview-background="light"],[data-preview-background="dark"]) .cc-preview-image-rect{background:transparent}

.dsh-comfy-ui .cc-main-preview{position:relative;width:100%;height:100%;min-width:0;min-height:0;flex:1;border:0;border-radius:0;background:transparent;overflow:visible}
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
.dsh-comfy-ui button:hover:not(:disabled),.dsh-comfy-floating button:hover:not(:disabled){background:var(--cc-button-hover,var(--cc-hover))!important}
/* Hover keeps the button's semantic colour instead of replacing it with neutral grey. */
:is(.dsh-comfy-ui,.dsh-comfy-floating) button:is([aria-pressed="true"],[aria-selected="true"]){--cc-button-hover:color-mix(in srgb,var(--cc-accent-bg) 82%,var(--cc-accent));--cc-button-border:var(--cc-accent)}
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
.dsh-comfy-ui .cc-prompt-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,0fr);column-gap:0;align-items:stretch;box-sizing:border-box;transition:grid-template-columns var(--cc-prompt-chat-motion),column-gap var(--cc-prompt-chat-motion)}
.dsh-comfy-ui .cc-prompt-layout--chat{grid-template-columns:minmax(0,7fr) minmax(0,3fr);column-gap:var(--cc-prompt-chat-gap)}
.dsh-comfy-ui .cc-prompt-layout--replacement{grid-template-columns:minmax(0,0fr) minmax(0,1fr);column-gap:0}
.dsh-comfy-ui .cc-prompt-card{grid-column:1;grid-row:1;min-width:0}
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
.dsh-comfy-ui .cc-workbench-module[data-module="prompt"]{--cc-prompt-chat-gap:6px;--cc-prompt-chat-motion:220ms cubic-bezier(.2,.7,.2,1)}
.dsh-comfy-ui .cc-chat-slot{grid-column:2;grid-row:1;position:relative;min-width:0;min-height:0;overflow:hidden;opacity:0;visibility:hidden;transform:translateX(8px);transition:opacity var(--cc-prompt-chat-motion),transform var(--cc-prompt-chat-motion),visibility var(--cc-prompt-chat-motion)}
.dsh-comfy-ui .cc-prompt-layout--chat>.cc-chat-slot{opacity:1;visibility:visible;transform:translateX(0)}
.dsh-comfy-ui .cc-chat-panel{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0;box-sizing:border-box;overflow:hidden;padding:8px;border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-control);background:var(--cc-surface)}
.dsh-comfy-ui .cc-chat-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;flex:none}
.dsh-comfy-ui .cc-chat-toolbar>button{height:28px;min-height:28px}
.dsh-comfy-ui .cc-chat-toolbar>.cc-icon-button{width:28px;min-width:28px}
.dsh-comfy-ui .cc-chat-history{display:flex;flex-direction:column;gap:8px;flex:1 1 0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:2px}
.dsh-comfy-ui .cc-chat-composer{position:relative;flex:none;min-width:0}
.dsh-comfy-ui .cc-chat-composer>.cc-chat-input{display:block;height:96px;min-height:96px;padding:10px 10px 42px!important;resize:none!important;font-family:inherit!important;margin:0}
.dsh-comfy-ui .cc-chat-send{position:absolute;right:7px;bottom:7px;width:28px;height:28px;min-width:28px;min-height:28px}
.dsh-comfy-ui .cc-chat-send[aria-busy="true"]>svg{animation:cc-spin 1s linear infinite}
.dsh-comfy-ui .cc-chat-busy{position:absolute;left:10px;bottom:12px;max-width:calc(100% - 52px);pointer-events:none}
.dsh-comfy-ui .cc-prompt-header-tools{transition:margin-right var(--cc-prompt-chat-motion);margin-right:0}
.dsh-comfy-ui .cc-prompt-header-tools--split{margin-right:calc(30% + 4px)}
.dsh-comfy-ui :is(.cc-prompt-header-tools,.cc-chat-toolbar,.cc-chat-composer) .cc-icon-button>svg{width:18px;height:18px;flex:none;display:block}
@media(prefers-reduced-motion:reduce){.dsh-comfy-ui *, .dsh-comfy-floating *{transition:none!important;animation:none!important}}
@media(max-width:640px){.dsh-comfy-ui .cc-field-select{flex:1 1 140px;min-width:0}}

/* Temporary duplicate colour belongs to the textarea, never to candidate availability. */
.dsh-comfy-ui .cc-prompt-input-shell{position:relative}
.dsh-comfy-ui .cc-prompt-duplicate-mirror{position:absolute;pointer-events:none;z-index:1;box-sizing:border-box;border-style:solid;border-color:transparent;white-space:pre-wrap;overflow-wrap:break-word;overflow:hidden}
.dsh-comfy-ui .cc-prompt-duplicate-mirror mark{background:transparent}
.dsh-comfy-ui textarea[data-cc-duplicate-highlight]::selection{color:transparent;background:var(--cc-accent-bg)}
.dsh-comfy-floating .cc-tag-related{flex:none;padding:9px 11px;border-top:var(--cc-ui-border-width,1px) solid var(--cc-border);max-height:125px;overflow:auto;scrollbar-width:none}
.dsh-comfy-floating .cc-tag-related-heading{display:flex;justify-content:space-between;gap:8px;color:var(--cc-muted);font-size:11px;margin-bottom:7px}
.dsh-comfy-floating .cc-tag-related-heading small{font-size:10px}
.dsh-comfy-floating .cc-tag-related-chips{display:flex;flex-wrap:wrap;gap:5px}
.dsh-comfy-floating .cc-tag-related-chip{font:inherit;font-size:12px;padding:4px 8px;border:var(--cc-ui-border-width,1px) solid var(--cc-border);border-radius:var(--cc-ui-radius-control,6px);color:var(--cc-text);background:var(--cc-control);cursor:pointer}
.dsh-comfy-floating .cc-tag-related-chip:hover{background:var(--cc-hover)}

/* Prompt candidates reuse the common theme, tooltip and spinner primitives. */
.dsh-comfy-floating.cc-tag-completion{display:flex;flex-direction:column;overflow:hidden;background:var(--cc-surface);color:var(--cc-text);border:var(--cc-ui-border-width,1px) solid var(--cc-border);border-radius:var(--cc-ui-radius-control,6px);box-shadow:0 6px 22px rgba(0,0,0,.22);box-sizing:border-box;--cc-completion-row-padding:9px;--cc-completion-font-size:13px}
.dsh-comfy-floating .cc-tag-list{position:relative;overflow-y:auto;overscroll-behavior:contain;min-height:0;padding:0 4px 4px;scrollbar-width:none}
.dsh-comfy-floating .cc-tag-list::-webkit-scrollbar{display:none}
.dsh-comfy-floating .cc-tag-query{display:flex;justify-content:space-between;gap:10px;padding:8px 12px 5px;color:var(--cc-muted);font-size:11px;flex:none}
.dsh-comfy-floating .cc-tag-query>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsh-comfy-floating .cc-tag-query>span:last-child{white-space:nowrap}
.dsh-comfy-floating .cc-tag-option{display:flex;flex-direction:column;gap:5px;width:100%;padding:var(--cc-completion-row-padding);text-align:left;border:0;border-radius:4px;background:transparent;color:var(--cc-text);font:inherit;cursor:pointer;min-width:0}
.dsh-comfy-floating .cc-tag-option:not(:disabled):hover{background:var(--cc-hover)}
.dsh-comfy-floating .cc-tag-option[data-active="true"],.dsh-comfy-floating .cc-tag-option[data-active="true"]:hover{background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-tag-main{display:block;min-width:0;max-width:100%;font-size:var(--cc-completion-font-size);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-comfy-floating .cc-tag-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-tag-type{color:var(--cc-text);background:var(--cc-control);border:var(--cc-ui-border-width,1px) solid var(--cc-border);border-radius:3px;padding:0 4px;white-space:nowrap}
.dsh-comfy-floating .cc-tag-result-source{color:var(--cc-accent-text);font-size:11px}
.dsh-comfy-floating .cc-tag-empty{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px;padding:18px 10px;color:var(--cc-muted);font-size:12px}
.dsh-comfy-floating .cc-tag-empty>small{flex-basis:100%;text-align:center;font-size:11px}
.dsh-comfy-floating .cc-tag-error{padding:8px 10px;color:var(--cc-bad);font-size:12px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-tag-translate-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:7px;border-top:var(--cc-ui-border-width,1px) solid var(--cc-border);flex:none}
.dsh-comfy-floating .cc-tag-translate{display:flex;align-items:center;justify-content:center;gap:7px;min-height:32px;color:var(--cc-text);background:var(--cc-control);border:var(--cc-ui-border-width,1px) solid var(--cc-border);border-radius:var(--cc-ui-radius-control,6px);font:inherit;font-size:12px;padding:5px 8px;cursor:pointer}
.dsh-comfy-floating .cc-tag-translate:not(:disabled):hover{background:var(--cc-hover)}
.dsh-comfy-floating .cc-tag-translate:disabled{opacity:.5;cursor:default}
.dsh-comfy-floating .cc-tag-translate[aria-busy="true"]{opacity:1;color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-tag-key-hint{padding:0 9px 6px;text-align:right;color:var(--cc-muted);font-size:11px;flex:none}
.dsh-comfy-floating .cc-tag-heading,.dsh-comfy-ui .cc-dict-name{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.dsh-comfy-floating .cc-tag-output,.dsh-comfy-ui .cc-tag-output{font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap}
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
.dsh-comfy-ui .cc-model-base{min-width:0;border:var(--cc-ui-border-width,1px) solid var(--cc-border);border-radius:var(--cc-ui-radius-control,7px);background:var(--cc-control);overflow:visible}
.dsh-comfy-ui .cc-model-base>.cc-model-base-button{width:100%;border:0;background:transparent;border-radius:inherit}
.dsh-comfy-ui .cc-model-auto-details{display:flex;flex-direction:column;gap:6px;padding:0 9px 9px;min-width:0;font-size:11px}
.dsh-comfy-ui .cc-model-auto-line{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.dsh-comfy-ui .cc-model-auto-line>span{font-weight:var(--cc-ui-weight-label,600)}
.dsh-comfy-ui .cc-model-auto-line>small{color:var(--cc-muted);font-size:10px}
.dsh-comfy-ui .cc-model-type-settings{margin-left:auto;width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;border:0;border-radius:var(--cc-ui-radius-sm,5px);color:var(--cc-muted);cursor:pointer}
.dsh-comfy-ui .cc-model-type-settings:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-model-type-options{display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0}
.dsh-comfy-ui .cc-model-type-options>div{flex:1;min-width:150px}
.dsh-comfy-ui .cc-model-auto-details p{margin:0;color:var(--cc-muted);line-height:1.5;font-size:11px}
.dsh-comfy-ui .cc-model-detection-message{color:var(--cc-warn);line-height:1.5}
.dsh-comfy-ui .cc-model-dock-main>.cc-generation-controls-summary{align-self:stretch;display:flex;align-items:flex-start;flex-direction:column;justify-content:center;gap:8px;padding:10px;min-width:0}
.dsh-comfy-ui .cc-model-dock-main>.cc-generation-controls-summary>span{white-space:normal;overflow-wrap:anywhere;color:var(--cc-muted);font-size:11px}
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

/* Shared entry and summary styling for generation-time and post-generation controls. */
.dsh-comfy-ui .cc-generation-controls-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;min-width:0;color:var(--cc-muted)}
.dsh-comfy-ui .cc-control-panel-entry{display:inline-flex;align-items:center;justify-content:center;gap:var(--cc-control-entry-gap);min-height:var(--cc-control-entry-height);padding:4px var(--cc-control-entry-padding);border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-control);background:var(--cc-control);color:var(--cc-text);font:inherit;font-size:12px;font-weight:var(--cc-ui-weight-label);cursor:pointer;white-space:nowrap;min-width:0}
.dsh-comfy-ui .cc-control-panel-entry:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-control-panel-entry:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-ui .cc-control-entry-count{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border-radius:var(--cc-ui-radius-sm);background:var(--cc-accent-bg);color:var(--cc-accent-text);font-size:10px;font-variant-numeric:tabular-nums}
.dsh-comfy-ui .cc-control-panel-entry>.cc-control-entry-label{flex:1;text-align:left}
.dsh-comfy-ui .cc-control-panel-summary{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0}
.dsh-comfy-ui .cc-control-summary-chip{display:inline-flex;align-items:center;gap:4px;min-height:23px;padding:2px 7px;font:inherit;font-size:11px;border:var(--cc-ui-border-width) solid var(--cc-border);border-radius:var(--cc-ui-radius-sm);background:var(--cc-control);color:var(--cc-text);cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-control-summary-chip:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-control-summary-chip small,.dsh-comfy-ui .cc-control-summary-empty{font-size:11px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-post-control-dock{flex:1;gap:8px}
.dsh-comfy-floating .cc-generation-controls-dialog{scrollbar-width:none}
.dsh-comfy-floating .cc-generation-controls-dialog::-webkit-scrollbar{display:none}
.dsh-comfy-floating .cc-generation-controls-dialog *{scrollbar-width:none}
.dsh-comfy-floating .cc-generation-controls-dialog *::-webkit-scrollbar{display:none}
.dsh-comfy-floating .cc-generation-controls-dialog>div:nth-child(2),.dsh-comfy-floating .cc-post-dialog>div:nth-child(2){gap:10px!important;padding-top:14px!important}
.dsh-comfy-floating .cc-field-capsule{display:flex;align-items:stretch;gap:0;height:34px;min-width:0;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);font-size:11px}
.dsh-comfy-floating .cc-field-capsule>span:first-child{display:flex;align-items:center;padding:0 12px;border-right:1px solid var(--cc-border);color:var(--cc-muted);white-space:nowrap;flex:none}
.dsh-comfy-floating .cc-field-capsule>.cc-select-trigger{display:flex;align-items:center;justify-content:space-between;flex:1;min-width:0!important;height:32px;border:0!important;border-radius:0!important;background:transparent!important;padding:0 9px!important;font-size:12px!important}
.dsh-comfy-floating .cc-generation-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0;min-width:0}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux{display:flex;align-items:center;flex-wrap:wrap;gap:8px;flex:1;min-width:0;padding:0;border:0}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux-field{flex:0 0 auto;font-size:11px}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux-field>.cc-select-trigger{min-width:130px!important}
.dsh-comfy-floating .cc-generation-controls{height:min(736px,calc(100dvh - 168px));display:grid;grid-template-columns:minmax(210px,2fr) minmax(0,8fr);gap:0;min-height:0}
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

${MODEL_TASK_CARD_CSS}
.dsh-comfy-floating .cc-model-source-anchor{z-index:6;justify-self:end}
.dsh-comfy-floating .cc-model-source-menu{width:min(330px,calc(100vw - 52px));max-height:min(440px,calc(100dvh - 180px));overflow:auto;scrollbar-width:none;z-index:10}
.dsh-comfy-floating .cc-model-source-menu strong,.dsh-comfy-floating .cc-model-source-menu small{padding:6px 10px}
.dsh-comfy-floating .cc-model-source-menu small{white-space:normal}
.dsh-comfy-floating .cc-model-source-menu button:disabled{opacity:.45;cursor:default}
.dsh-comfy-floating .cc-model-source-status{position:relative;flex:none;padding:7px 10px;gap:2px}
.dsh-comfy-floating .cc-model-source-status.is-complete{padding-right:92px}
.dsh-comfy-floating .cc-model-source-status-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
.dsh-comfy-floating .cc-model-source-status-head>span{display:flex;align-items:center;gap:4px}
.dsh-comfy-floating .cc-model-source-status-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:none;margin-left:auto}
.dsh-comfy-floating .cc-model-source-done{position:absolute;right:10px;top:50%;transform:translateY(-50%);height:24px;min-height:24px;padding:2px 9px!important;font-size:11px;z-index:1}
.dsh-comfy-floating .cc-model-source-status .cc-runtime-track{height:3px;margin:4px 0;border-radius:0}
.dsh-comfy-floating .cc-model-source-status-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-model-source-status small{display:block;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-source-issues{max-height:120px;overflow:auto;scrollbar-width:none}
.dsh-comfy-floating .cc-model-source-issues::-webkit-scrollbar{display:none}
.dsh-comfy-floating .cc-model-source-issues summary{cursor:pointer}
.dsh-comfy-floating .cc-model-source-issues>div{padding:5px 0;overflow-wrap:anywhere}

.dsh-comfy-floating .cc-model-library-dialog{max-height:calc(100dvh - 28px)!important}
.dsh-comfy-floating .cc-model-library{height:min(780px,calc(100dvh - 124px));min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.dsh-comfy-floating .cc-model-library-toolbar{display:grid;grid-template-columns:minmax(0,1.6fr) 34px minmax(140px,1fr) 78px 34px;align-items:center;gap:8px;flex:none}
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
@media(max-width:600px){.dsh-comfy-floating .cc-model-library-toolbar{grid-template-columns:minmax(0,1fr) 78px 34px}.dsh-comfy-floating .cc-model-path{grid-column:1 / 3}.dsh-comfy-floating .cc-model-library-search{grid-column:1}.dsh-comfy-floating .cc-model-library-body{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(160px,32fr) minmax(0,68fr)}.dsh-comfy-floating .cc-model-local-preview,.dsh-comfy-floating .cc-model-preview-placeholder{height:300px;min-height:300px}.dsh-comfy-floating .cc-model-inspector{padding:10px}.dsh-comfy-floating .cc-model-info-grid{grid-template-columns:70px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-model-library-hint{display:none}}

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
.dsh-comfy-ui .cc-output-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:5px;min-width:0}
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
.dsh-comfy-ui .cc-latent-frame{border:0;box-shadow:none;--cc-preview-line:2px dashed var(--cc-preview-outline,#fff)}
.dsh-comfy-ui .cc-latent-frame::after{content:"";position:absolute;inset:0;border-right:var(--cc-preview-line);border-bottom:var(--cc-preview-line);box-sizing:border-box}
.dsh-comfy-ui .cc-latent-edge{position:absolute;display:flex;align-items:center}
.dsh-comfy-ui .cc-latent-edge::before,.dsh-comfy-ui .cc-latent-edge::after{content:"";flex:1 1 0;min-width:0;min-height:0}
.dsh-comfy-ui .cc-latent-edge--top{left:0;right:0;top:0;transform:translateY(-50%)}
.dsh-comfy-ui .cc-latent-edge--top::before,.dsh-comfy-ui .cc-latent-edge--top::after{border-top:var(--cc-preview-line)}
.dsh-comfy-ui .cc-latent-edge--left{top:0;bottom:0;left:0;flex-direction:column;transform:translateX(-50%)}
.dsh-comfy-ui .cc-latent-edge--left::before,.dsh-comfy-ui .cc-latent-edge--left::after{border-left:var(--cc-preview-line)}
.dsh-comfy-ui .cc-latent-label{flex:none;white-space:nowrap;color:var(--cc-text);background:var(--cc-control);font-size:11px;line-height:16px;border-radius:3px;font-variant-numeric:tabular-nums}
.dsh-comfy-ui .cc-latent-width{padding:0 4px;margin:0 2px}
.dsh-comfy-ui .cc-latent-height{writing-mode:vertical-rl;text-orientation:sideways;transform:rotate(180deg);padding:4px 0;margin:2px 0}

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
.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]:hover::after,.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]:focus-within::after{opacity:1;visibility:visible}.dsh-comfy-floating .cc-post-notebook{display:grid;grid-template-columns:minmax(210px,2fr) minmax(0,8fr);height:min(736px,calc(100dvh - 212px));gap:0;min-height:0}

.dsh-comfy-floating .cc-generation-notebook .cc-generation-common-fields{display:flex;flex-direction:column;gap:18px;padding:16px;align-items:stretch}
.dsh-comfy-floating .cc-generation-common-fields>.cc-model-aux,.dsh-comfy-floating .cc-generation-common-models{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 20px;min-width:0;margin:0;padding:0;border:0}
.dsh-comfy-floating .cc-generation-common-fields .cc-model-aux-field{display:flex;flex-direction:column;align-items:stretch;gap:6px;height:auto!important;min-height:0;min-width:0;max-width:none;width:100%;border:0!important;background:transparent!important;border-radius:0;overflow:visible;padding:0;box-sizing:border-box}
.dsh-comfy-floating .cc-generation-common-fields .cc-model-aux-field>span:first-child,.dsh-comfy-floating .cc-generation-common-fields .cc-control-direct>strong{display:block;flex:none;height:18px;line-height:18px;font-size:12px;font-weight:var(--cc-notebook-title-weight);color:var(--cc-notebook-text);padding:0;border:0;background:transparent;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-generation-common-models>.cc-control-tile{width:100%;max-width:none;min-width:0;height:auto;min-height:0;max-height:none;padding:0;border:0;border-radius:0;background:transparent;box-sizing:border-box;gap:6px;flex:none}
.dsh-comfy-floating .cc-generation-common-fields .cc-control-direct{min-width:0;height:auto;gap:6px}
.dsh-comfy-floating .cc-generation-common-fields .cc-control-direct>strong{padding-right:28px}
.dsh-comfy-floating .cc-generation-common-fields .cc-control-remove{top:-1px!important;right:0!important;width:20px!important;height:20px!important}
.dsh-comfy-floating .cc-generation-common-fields :is(.cc-select-trigger,select){width:100%;height:36px!important;min-height:36px!important;border:1px solid var(--cc-notebook-border)!important;border-radius:var(--cc-notebook-control-radius)!important;background:var(--cc-notebook-control-bg)!important;padding:6px 10px!important;box-sizing:border-box}
@container(max-width:540px){.dsh-comfy-floating .cc-generation-common-fields>.cc-model-aux,.dsh-comfy-floating .cc-generation-common-models{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-floating .cc-generation-cell-body>.cc-control-tile{width:100%;max-width:none;min-width:0;height:auto;min-height:120px;max-height:none;padding:0!important;border:0;background:transparent;box-sizing:border-box;flex:none}
.dsh-comfy-floating .cc-generation-cell-body>.cc-control-tile>.cc-control-remove{display:none}
.dsh-comfy-floating .cc-generation-cell-body .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-generation-cell-body .cc-control-tile[data-kind="acceleration"]{grid-template-columns:92px minmax(0,1fr)}
.dsh-comfy-floating .cc-generation-cell-body .cc-control-lora-settings{display:flex;flex-direction:row;align-self:start;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:10px;width:100%}
.dsh-comfy-floating .cc-generation-cell-body .cc-control-file>span>strong{display:none}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-card{max-width:100%}
.dsh-comfy-floating .cc-generation-cell-body .cc-control-pill{width:auto;flex:0 1 230px}

.dsh-comfy-floating .cc-generation-cell-body{--cc-generation-preview:clamp(176px,23cqw,240px)}
.dsh-comfy-floating .cc-generation-cell-body>.cc-generation-model-editor,.dsh-comfy-floating .cc-generation-cell-body>.cc-control-tile.cc-image-control{width:100%;max-width:none;height:auto;min-height:220px;max-height:none;flex:none;padding:0;border:0;background:transparent}
.dsh-comfy-floating .cc-generation-cell-body>.cc-generation-model-editor[data-kind]{display:grid;grid-template-columns:var(--cc-generation-preview) minmax(0,1fr);grid-template-rows:auto;grid-template-areas:none;gap:22px;align-items:start}
.dsh-comfy-floating .cc-generation-model-preview{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:220px;padding:0;border:1px solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);overflow:hidden;background:var(--cc-notebook-control-bg);color:var(--cc-notebook-muted);cursor:pointer}
.dsh-comfy-floating .cc-generation-cell-body .cc-generation-model-preview .cc-model-dock-art{position:absolute;inset:0;width:100%;height:100%;min-height:0;display:flex;align-items:center;justify-content:center;background:transparent;border-radius:0;grid-area:auto}
.dsh-comfy-floating .cc-generation-cell-body .cc-generation-model-preview .cc-model-dock-art img{width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-generation-preview-caption{position:absolute;bottom:16px;left:8px;right:8px;text-align:center;font-size:12px;color:var(--cc-notebook-text)}
.dsh-comfy-floating .cc-generation-model-fields{display:flex;flex-direction:column;gap:20px;min-width:0;min-height:220px}
.dsh-comfy-floating .cc-generation-file-info,.dsh-comfy-floating .cc-generation-parameter{display:flex;flex-direction:column;gap:7px;min-width:0}
.dsh-comfy-floating .cc-generation-field-label{font-size:12px;font-weight:var(--cc-notebook-title-weight);line-height:18px;color:var(--cc-notebook-text)}
.dsh-comfy-floating .cc-generation-file-select{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;min-width:0;width:100%;height:38px;padding:7px 10px!important}
.dsh-comfy-floating .cc-generation-file-select>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-generation-model-parameters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.dsh-comfy-floating .cc-generation-parameter>.cc-drag-number,.dsh-comfy-floating .cc-generation-parameter>.cc-select-trigger{width:100%;height:36px;min-height:36px;box-sizing:border-box}
.dsh-comfy-floating .cc-generation-field-note{font-size:11px;color:var(--cc-notebook-muted);line-height:1.5;margin-top:auto}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-card{display:grid;grid-template-columns:var(--cc-generation-preview) minmax(0,1fr);gap:22px;height:auto;align-items:start}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-thumb{width:100%;height:220px;min-height:220px;border-radius:var(--cc-notebook-control-radius);font-size:13px}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-fields{display:flex;min-height:220px;gap:18px;min-width:0}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-fields>strong{padding:0;font-size:13px;line-height:20px;font-weight:var(--cc-notebook-title-weight)}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-image-control-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-image-control-row>label{display:flex;flex-direction:column;align-items:stretch;gap:7px;font-size:12px;min-width:0}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-image-control-row>label>span{height:18px;line-height:18px;font-weight:var(--cc-notebook-title-weight)}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-image-control-row :is(.cc-drag-number,button[role="switch"]){width:100%;height:36px;min-height:36px;box-sizing:border-box}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-actions>button{flex:0 1 160px;min-height:36px;font-size:12px;padding:7px 14px}
.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-status{margin-top:auto;white-space:normal;line-height:1.5;font-size:11px}
@container(max-width:560px){.dsh-comfy-floating .cc-generation-cell-body{--cc-generation-preview:150px}.dsh-comfy-floating .cc-generation-cell-body>.cc-generation-model-editor[data-kind],.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-card{gap:14px}.dsh-comfy-floating .cc-generation-model-parameters,.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-image-control-row{grid-template-columns:minmax(0,1fr);gap:12px}}
@container(max-width:380px){.dsh-comfy-floating .cc-generation-cell-body>.cc-generation-model-editor[data-kind],.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-card{grid-template-columns:minmax(0,1fr)}.dsh-comfy-floating .cc-generation-model-preview,.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-thumb{height:200px;min-height:200px}.dsh-comfy-floating .cc-generation-model-fields,.dsh-comfy-floating .cc-generation-cell-body .cc-image-control .cc-reference-fields{min-height:0}}


.dsh-comfy-floating .cc-post-notebook .cc-post-cell :is(.cc-select-trigger,.cc-field-capsule,.cc-generation-file-select,button[role="switch"],select,textarea){color:var(--cc-notebook-text)!important;background:var(--cc-notebook-control-bg)!important;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border)!important;border-radius:var(--cc-notebook-control-radius);box-sizing:border-box}
.dsh-comfy-floating .cc-post-notebook .cc-post-cell :is(.cc-select-trigger,.cc-generation-file-select,button[role="switch"],select){height:var(--cc-notebook-control-height)!important;min-height:var(--cc-notebook-control-height)!important}
.dsh-comfy-floating .cc-post-notebook .cc-post-cell :is(.cc-generation-model-preview,.cc-reference-thumb,.cc-model-dock-art){background:var(--cc-notebook-preview-bg)!important;border-color:var(--cc-notebook-border)!important;border-radius:var(--cc-notebook-control-radius)}
.dsh-comfy-floating .cc-post-notebook :is(.cc-post-cell-title,.cc-generation-field-label,.cc-control-direct>strong,.cc-reference-fields>strong){font-weight:var(--cc-notebook-title-weight);color:var(--cc-notebook-text)}
.dsh-comfy-floating .cc-post-notebook :is(.cc-generation-field-note,.cc-reference-status){color:var(--cc-notebook-muted)}
.dsh-comfy-floating .cc-post-notebook .cc-post-cell-actions button{border-width:var(--cc-notebook-border-width)!important;border-radius:var(--cc-notebook-control-radius)!important}
.dsh-comfy-floating .cc-post-notebook button{--cc-button-hover:var(--cc-notebook-hover-bg);--cc-button-hover-border:var(--cc-notebook-border)}
.dsh-comfy-floating .cc-post-notebook .cc-post-cell-enable{height:var(--cc-notebook-control-height)}
.dsh-comfy-floating .cc-post-notebook .cc-post-cell-enable>.cc-select-trigger{height:calc(var(--cc-notebook-control-height) - 2 * var(--cc-notebook-border-width))!important;min-height:0!important;border:0!important;border-radius:0!important}

/* Preview crops only affect presentation; original assets remain intact. */
.dsh-comfy-floating .cc-post-cell .cc-generation-model-preview,.dsh-comfy-floating .cc-post-cell .cc-reference-thumb{aspect-ratio:1/1;height:auto!important;min-height:0!important;max-height:none;align-self:start;overflow:hidden}
.dsh-comfy-floating .cc-post-cell :is(.cc-generation-model-preview,.cc-reference-thumb) img{object-fit:cover!important;object-position:center!important;width:100%;height:100%}
.dsh-comfy-floating .cc-generation-file-name{font-size:13px;font-weight:var(--cc-notebook-title-weight);overflow-wrap:anywhere;line-height:1.5;min-width:0}
.dsh-comfy-floating .cc-generation-model-parameters{grid-template-columns:repeat(2,minmax(0,1fr))}
.dsh-comfy-floating .cc-generation-model-parameters>.cc-generation-parameter:first-child{grid-column:1/-1;max-width:220px}
.dsh-comfy-floating .cc-strength-control{display:flex;gap:8px;min-width:0;align-items:stretch}
.dsh-comfy-floating .cc-strength-control>.cc-drag-number{flex:1;min-width:0}
.dsh-comfy-floating .cc-strength-reset{flex:0 0 var(--cc-number-height,36px);width:var(--cc-number-height,36px);height:var(--cc-number-height,36px);padding:0!important;display:flex;align-items:center;justify-content:center}
.dsh-comfy-floating .cc-post-cell.cc-generation-lora-cell{position:relative;z-index:1;overflow:visible!important}
.dsh-comfy-floating .cc-generation-lora-body{gap:8px;overflow:visible}
.dsh-comfy-floating .cc-generation-lora-add{height:26px;min-height:26px;display:inline-flex;align-items:center;gap:6px;padding:0 8px!important;font-size:11px;flex:none}
.dsh-comfy-floating .cc-generation-lora-cell .cc-post-cell-title{flex:0 0 auto;min-width:0}
.dsh-comfy-floating .cc-generation-lora-row{position:relative;z-index:1;display:grid;grid-template-columns:34px minmax(0,4fr) 1px minmax(0,3fr) 1px minmax(0,3fr) var(--cc-notebook-control-height);gap:10px;align-items:center;min-width:0;padding:4px 0;background:transparent;border:0;border-radius:0}
.dsh-comfy-floating .cc-generation-lora-row:hover{z-index:5}
.dsh-comfy-floating .cc-generation-lora-toggle{display:flex;align-items:center;justify-content:center;min-width:0;transform:translateY(10px)}
.dsh-comfy-floating .cc-generation-lora-toggle .cc-switch{width:30px;min-width:30px;justify-content:flex-start}
.dsh-comfy-floating .cc-generation-lora-toggle .cc-switch>span:first-child{display:none}
.dsh-comfy-floating .cc-generation-lora-model-wrap,.dsh-comfy-floating .cc-generation-lora-strength{display:flex;flex-direction:column;gap:6px;min-width:0}
.dsh-comfy-floating .cc-generation-lora-model-wrap{position:relative;overflow:visible}
.dsh-comfy-floating .cc-generation-lora-model-select{width:100%;height:var(--cc-notebook-control-height)!important;min-height:var(--cc-notebook-control-height)!important;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px!important;text-align:left;overflow:hidden}
.dsh-comfy-floating .cc-generation-lora-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-generation-lora-divider{width:1px;height:38px;background:var(--cc-notebook-border);justify-self:center}
.dsh-comfy-floating .cc-generation-lora-strength .cc-strength-control{width:100%;gap:5px}
.dsh-comfy-floating .cc-generation-lora-strength .cc-drag-number{flex:1 1 0;width:0;min-width:0}
.dsh-comfy-floating .cc-generation-lora-strength .cc-strength-reset{flex:0 0 var(--cc-notebook-control-height);width:var(--cc-notebook-control-height);height:var(--cc-notebook-control-height)}
.dsh-comfy-floating .cc-generation-lora-strength .cc-drag-number{height:var(--cc-notebook-control-height)}
.dsh-comfy-floating .cc-generation-lora-delete{align-self:end;width:var(--cc-notebook-control-height);height:var(--cc-notebook-control-height);min-height:var(--cc-notebook-control-height);display:grid;place-items:center;padding:0!important;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border)!important;border-radius:var(--cc-notebook-control-radius)!important;background:var(--cc-notebook-control-bg)!important;color:var(--cc-notebook-text)!important;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.dsh-comfy-floating .cc-generation-lora-delete:hover{border-color:var(--cc-danger,#e56b73)!important;background:var(--cc-hover)!important;color:var(--cc-danger,#e56b73)!important}
.dsh-comfy-floating .cc-generation-lora-preview-popover{position:fixed;left:0;top:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;min-width:150px;min-height:100px;max-width:240px;max-height:300px;padding:4px;background:var(--cc-notebook-cell-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);box-shadow:0 12px 32px rgba(0,0,0,.4);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-50%) translateX(5px);transition:opacity .08s,transform .08s}
.dsh-comfy-floating .cc-generation-lora-model-wrap:hover .cc-generation-lora-preview-popover,.dsh-comfy-floating .cc-generation-lora-model-wrap:focus-within .cc-generation-lora-preview-popover{opacity:1;visibility:visible;transform:translateY(-50%) translateX(0)}
.dsh-comfy-floating .cc-generation-lora-preview-popover .cc-model-dock-art--lora-hover{width:180px;height:120px;max-width:230px;max-height:290px;display:flex;align-items:center;justify-content:center;background:var(--cc-notebook-preview-bg);border-radius:var(--cc-notebook-control-radius)}
.dsh-comfy-floating .cc-generation-lora-preview-popover .cc-model-dock-art--lora-hover img{width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-generation-lora-preview-empty{width:180px;height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--cc-notebook-muted);font-size:11px;background:var(--cc-notebook-preview-bg)}
@container(max-width:720px){.dsh-comfy-floating .cc-generation-lora-row{grid-template-columns:30px minmax(0,1fr) var(--cc-notebook-control-height);row-gap:6px}.dsh-comfy-floating .cc-generation-lora-toggle{transform:none}.dsh-comfy-floating .cc-generation-lora-model-wrap,.dsh-comfy-floating .cc-generation-lora-strength{grid-column:2}.dsh-comfy-floating .cc-generation-lora-divider{display:none}.dsh-comfy-floating .cc-generation-lora-delete{grid-column:3;grid-row:1}}
@container(max-width:560px){.dsh-comfy-floating .cc-generation-model-parameters{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-floating .cc-post-side-resizer{height:9px;min-height:9px;margin:0 6px;border-radius:4px;cursor:row-resize;touch-action:none;background:transparent;position:relative;outline:none}
.dsh-comfy-floating .cc-post-side-resizer::before{content:'';position:absolute;left:0;right:0;top:4px;height:1px;background:var(--cc-border)}
.dsh-comfy-floating .cc-post-side-resizer:hover::before,.dsh-comfy-floating .cc-post-side-resizer:focus-visible::before{background:var(--cc-accent);top:3px;height:2px}
.dsh-comfy-floating .cc-post-side-resizer:focus-visible{box-shadow:0 0 0 2px var(--cc-accent-bg)}
.dsh-comfy-floating .cc-post-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;padding:8px 7px 5px}
.dsh-comfy-floating .cc-post-side-head>strong{font-size:12px;color:var(--cc-text)}
.dsh-comfy-floating .cc-post-new-workflow{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0!important;border-radius:6px;border:1px solid var(--cc-border)!important;background:var(--cc-control)!important;color:var(--cc-text)!important;--cc-button-hover:var(--cc-hover);--cc-button-hover-border:var(--cc-border);cursor:pointer}
.dsh-comfy-floating .cc-post-new-workflow:not(:disabled):hover{background:var(--cc-hover)!important;border-color:var(--cc-border)!important}.dsh-comfy-floating .cc-post-new-workflow.is-opening{cursor:wait;opacity:.75}.dsh-comfy-floating .cc-post-side-head>strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-post-new-workflow:hover{filter:brightness(1.08)}
.dsh-comfy-floating .cc-post-new-workflow:focus-visible{outline:2px solid var(--cc-accent);outline-offset:1px}
.dsh-comfy-floating .cc-post-add{display:flex;flex-direction:column;gap:0;overflow:hidden;border:0;border-right:1px solid var(--cc-border);border-radius:0;background:transparent;padding:0 12px 0 0;min-width:0;min-height:0}
.dsh-comfy-floating .cc-post-library-pane{display:grid;grid-template-rows:minmax(0,1fr) 9px minmax(0,1fr);gap:0;height:100%;min-height:0}
.dsh-comfy-floating .cc-post-side-section{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:0;overflow:auto;padding:6px}
.dsh-comfy-floating .cc-post-side-section>strong{font-size:12px;padding:8px 7px 5px;color:var(--cc-text);flex:none}
.dsh-comfy-floating .cc-post-cells{display:flex;flex-direction:column;gap:var(--cc-notebook-gap);border:0;border-radius:0;background:transparent;overflow:auto;min-width:0;min-height:0;padding:10px 10px 10px 14px}
.dsh-comfy-floating .cc-post-cell{flex:none;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border)!important;border-left:var(--cc-notebook-rail-width) solid var(--cc-notebook-rail)!important;border-radius:var(--cc-notebook-radius)!important;padding:0;margin:0;min-width:0;color:var(--cc-notebook-text);background:var(--cc-notebook-cell-bg)!important;box-shadow:none;overflow:hidden}
.dsh-comfy-floating .cc-post-cell[data-disabled="true"] .cc-post-cell-fields{opacity:.55}
.dsh-comfy-floating .cc-post-cell-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:34px;padding:5px 10px;border-bottom:var(--cc-notebook-border-width) solid var(--cc-notebook-border);background:var(--cc-notebook-header-bg)}
.dsh-comfy-floating .cc-post-cell-index{font:600 11px ui-monospace,Consolas,monospace;color:var(--cc-accent-text);background:var(--cc-accent-bg);border-radius:4px;padding:2px 7px;min-width:28px;text-align:center;flex:none}
.dsh-comfy-floating .cc-post-cell[data-disabled="true"] .cc-post-cell-index{color:var(--cc-muted);background:var(--cc-border)}
.dsh-comfy-floating .cc-post-cell-drag{flex:none;color:var(--cc-muted);cursor:grab;user-select:none;font-size:14px;line-height:1;padding:0 2px}
.dsh-comfy-floating .cc-post-cell-drag:active{cursor:grabbing}
.dsh-comfy-floating .cc-post-cell-title{flex:1;min-width:100px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-post-cell-actions{display:flex;gap:3px;flex:none;margin-left:auto}
.dsh-comfy-floating .cc-post-cell-actions button{position:relative;width:30px;min-width:30px;height:30px;min-height:30px;padding:0!important;display:flex;align-items:center;justify-content:center;font-size:14px!important;border:1px solid currentColor!important;border-radius:6px!important;background:transparent!important;color:var(--cc-notebook-text)!important;cursor:pointer;line-height:1}

.dsh-comfy-floating .cc-post-cell-actions button[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 6px);right:0;z-index:50;white-space:nowrap;padding:5px 8px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-surface);color:var(--cc-text);font-size:10px;line-height:1.3;box-shadow:0 6px 18px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .12s}
.dsh-comfy-floating .cc-post-cell-actions button[data-cc-tooltip]:not(:disabled):is(:hover,:focus-visible)::after{opacity:1}
.dsh-comfy-floating .cc-post-cell-enable{flex:none;display:flex;align-items:center;gap:6px;font-size:13px}
.dsh-comfy-floating .cc-post-cell-enable .cc-switch{font-size:13px}
.dsh-comfy-floating .cc-post-cell{position:relative;transition:opacity .15s,background .15s}
.dsh-comfy-floating .cc-post-cell.is-dragging{opacity:.45}
.dsh-comfy-floating .cc-post-cell.is-drop-before::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:var(--cc-accent);z-index:6;pointer-events:none}
.dsh-comfy-floating .cc-post-cell.is-drop-after::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--cc-accent);z-index:6;pointer-events:none}.dsh-comfy-floating .cc-post-cell-enable .cc-switch{width:auto;justify-content:flex-start;gap:6px}.dsh-comfy-floating .cc-post-cell-enable .cc-switch-track{width:30px;height:17px}.dsh-comfy-floating .cc-post-cell-enable .cc-switch-track:after{width:11px;height:11px}.dsh-comfy-floating .cc-post-cell-enable .cc-switch>input:checked+.cc-switch-track:after{transform:translateX(13px)}
.dsh-comfy-floating .cc-post-cell-enable>span:first-child{padding:0 8px;font-size:10px}
.dsh-comfy-floating .cc-post-cell-enable>.cc-select-trigger{height:28px;min-width:64px!important;padding:0 8px!important;font-size:11px!important}
.dsh-comfy-floating .cc-post-cell-fields{display:flex;flex-direction:column;gap:var(--cc-notebook-field-gap);padding:var(--cc-notebook-padding);background:var(--cc-notebook-cell-bg);color:var(--cc-notebook-text);min-width:0;container-type:inline-size}
.dsh-comfy-floating .cc-post-param-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}
.cc-post-param-group[data-layout="pair"]{gap:var(--cc-notebook-field-gap);padding-left:16px;padding-right:16px}
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
.dsh-comfy-floating .cc-flow-sidebar>input{width:100%!important;box-sizing:border-box;position:sticky;top:0;z-index:2;min-height:32px;flex:none}.dsh-comfy-floating .cc-flow-interfaces{display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:230px;overflow:auto;flex:none}.dsh-comfy-floating .cc-flow-interfaces button{padding:6px!important;font-size:11px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.dsh-comfy-floating .cc-flow-interfaces button[aria-pressed=true]{border-color:var(--cc-accent)!important}.dsh-comfy-floating .cc-flow-sidebar>button{text-align:left;overflow-wrap:anywhere;flex:none}
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
.dsh-comfy-floating .cc-preview-editor-image.is-selected,.dsh-comfy-floating .cc-preview-editor-image.is-selected:hover,.dsh-comfy-floating .cc-preview-editor-image.is-selected:focus,.dsh-comfy-floating .cc-preview-editor-image.is-selected:focus-visible,.dsh-comfy-floating .cc-preview-editor-image.is-selected:active{border-color:var(--cc-accent)!important;box-shadow:inset 0 0 0 2px var(--cc-accent-bg),0 0 0 3px var(--cc-accent)!important;z-index:1}
.dsh-comfy-floating .cc-preview-editor-image:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-preview-editor-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-preview-editor-failed{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;color:var(--cc-muted);font-size:11px}
.dsh-comfy-floating .cc-preview-editor-image.is-selected::after{content:'✓';position:absolute;right:7px;top:7px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--cc-accent);color:var(--cc-accent-text);font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.dsh-comfy-floating .cc-preview-editor-badge{position:absolute;left:7px;top:7px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.62);color:#fff;font-size:10px;line-height:1.4}
.dsh-comfy-floating .cc-preview-editor-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--cc-border);padding-top:12px;flex:none}
.dsh-comfy-floating .cc-preview-editor-selection{flex:1;min-width:120px;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-confirm{display:flex;flex:none;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--cc-accent);border-radius:7px;background:var(--cc-accent-bg);font-size:11px}
.dsh-comfy-floating .cc-preview-editor-confirm>span{flex:1;min-width:120px}
.dsh-comfy-floating .cc-output-stage-actions{position:absolute;top:14px;right:14px;z-index:9;max-width:calc(100% - 76px);cursor:default;user-select:none}
.dsh-comfy-floating .cc-output-action-bar{display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:6px;padding:4px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(36,36,36,.68);background:color-mix(in srgb,var(--cc-surface) 68%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.dsh-comfy-floating .cc-output-action-group{display:flex;align-items:center;gap:3px}.dsh-comfy-floating .cc-output-action-group+.cc-output-action-group{border-left:1px solid rgba(255,255,255,.16);padding-left:6px}
.dsh-comfy-floating .cc-output-action-button{display:grid;place-items:center;width:36px;height:36px;flex:none;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--cc-text);cursor:pointer}
.dsh-comfy-floating .cc-output-action-button:enabled:hover{background:var(--cc-hover);color:var(--cc-text)}.dsh-comfy-floating .cc-output-action-button:focus-visible{outline:2px solid var(--cc-accent);outline-offset:1px}.dsh-comfy-floating .cc-output-action-button:disabled{opacity:.35;cursor:default}.dsh-comfy-floating .cc-output-action-button.is-danger:enabled:hover{background:#962d3abf;color:#ffd6da}
.dsh-comfy-floating .cc-output-preview-anchor{position:relative;display:flex}.dsh-comfy-floating .cc-output-preview-menu{position:absolute;top:calc(100% + 9px);right:0;min-width:156px;padding:4px;display:flex;flex-direction:column;gap:2px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-surface);color:var(--cc-text);box-shadow:0 6px 18px #0005}
.dsh-comfy-floating .cc-output-preview-menu button{white-space:nowrap;text-align:left;padding:8px 12px;font:inherit;font-size:12px;background:transparent;border:0;border-radius:4px;color:inherit;cursor:pointer}.dsh-comfy-floating .cc-output-preview-menu button:hover,.dsh-comfy-floating .cc-output-preview-menu button:focus-visible{background:var(--cc-hover);outline:1px solid var(--cc-accent)}
.dsh-comfy-floating .cc-output-action-error{margin-top:8px;padding:8px 10px;background:var(--cc-surface);color:var(--cc-bad);border:1px solid var(--cc-border);border-radius:6px;max-width:320px;font-size:12px;overflow-wrap:anywhere}
@media(max-width:760px){.dsh-comfy-floating .cc-output-action-button{width:32px;height:32px}.dsh-comfy-floating .cc-output-action-bar{gap:3px}.dsh-comfy-floating .cc-output-action-group{gap:1px}}

.dsh-comfy-floating.cc-output-inspector{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-columns:minmax(0,70fr) minmax(300px,30fr);background:rgba(5,7,10,.68);backdrop-filter:brightness(.62) blur(2px);-webkit-backdrop-filter:brightness(.62) blur(2px);color:var(--cc-text);overflow:hidden;overscroll-behavior:none;touch-action:none}
.dsh-comfy-floating .cc-output-inspector-stage{position:relative;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,.08);user-select:none;touch-action:none;cursor:default}
.dsh-comfy-floating .cc-output-inspector-stage:active{cursor:grabbing}
.dsh-comfy-floating .cc-output-inspector-image{display:block;max-width:calc(100% - 36px);max-height:calc(100% - 36px);width:auto;height:auto;object-fit:contain;transform-origin:center center;will-change:transform;user-select:none;pointer-events:none}
.dsh-comfy-floating .cc-output-inspector-close{position:fixed;left:16px;top:14px;z-index:4;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(12,12,12,.72);color:#fff;cursor:pointer;backdrop-filter:blur(10px)}
.dsh-comfy-floating .cc-output-inspector-close:hover{background:rgba(36,36,36,.9);border-color:rgba(255,255,255,.34)}
.dsh-comfy-floating .cc-output-inspector-nav{position:absolute;z-index:3;top:50%;transform:translateY(-50%);width:42px;height:58px;display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:rgba(0,0,0,.3);color:#fff;cursor:pointer;opacity:.55;transition:opacity .12s ease,background .12s ease}
.dsh-comfy-floating .cc-output-inspector-nav:hover{opacity:1;background:rgba(0,0,0,.58)}
.dsh-comfy-floating .cc-output-inspector-nav:disabled{opacity:.16;cursor:default;background:rgba(0,0,0,.2)}
.dsh-comfy-floating .cc-output-inspector-nav.is-prev{left:14px}.dsh-comfy-floating .cc-output-inspector-nav.is-next{right:14px}
.dsh-comfy-floating .cc-output-inspector-zoom{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:2;padding:5px 9px;border-radius:99px;background:rgba(0,0,0,.56);color:rgba(255,255,255,.75);font-size:10px;pointer-events:none;white-space:nowrap}
.dsh-comfy-floating .cc-output-inspector-info{min-width:0;min-height:0;height:100dvh;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;padding:22px 20px 28px;background:color-mix(in srgb,var(--cc-surface) 90%,transparent);backdrop-filter:blur(18px) saturate(115%);-webkit-backdrop-filter:blur(18px) saturate(115%);border-left:1px solid color-mix(in srgb,var(--cc-border) 80%,transparent);display:flex;flex-direction:column;gap:15px}
.dsh-comfy-floating .cc-output-edited-warning{display:flex;flex-direction:column;gap:5px;padding:10px 12px;border-left:3px solid var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-text);font-size:12px;line-height:1.6}
.dsh-comfy-floating .cc-output-info-title{display:flex;flex-direction:column;gap:4px;min-width:0;padding-right:6px}.dsh-comfy-floating .cc-output-info-title strong{font-size:15px;overflow-wrap:anywhere}.dsh-comfy-floating .cc-output-info-title small{font-size:10px;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-info-section{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--cc-border);min-width:0}.dsh-comfy-floating .cc-output-info-section>strong{font-size:11px;letter-spacing:.02em}.dsh-comfy-floating .cc-output-info-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.dsh-comfy-floating .cc-output-info-section-head>strong{font-size:11px;letter-spacing:.02em}.dsh-comfy-floating .cc-output-info-grid{display:grid;grid-template-columns:92px minmax(0,1fr);gap:7px 9px;font-size:11px}.dsh-comfy-floating .cc-output-info-grid dt{color:var(--cc-muted)}.dsh-comfy-floating .cc-output-info-grid dd{margin:0;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-model-list{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto;padding-right:2px;overscroll-behavior:contain}.dsh-comfy-floating .cc-output-model-group{display:grid;grid-template-columns:78px minmax(0,1fr);gap:7px;align-items:start;padding:6px 7px;border:1px solid var(--cc-border);border-radius:7px;background:color-mix(in srgb,var(--cc-control) 86%,transparent);font-size:10px}.dsh-comfy-floating .cc-output-model-group-label{display:flex;align-items:center;gap:5px;color:var(--cc-muted);min-height:24px}.dsh-comfy-floating .cc-output-model-count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--cc-hover);color:var(--cc-text);font-size:9px}.dsh-comfy-floating .cc-output-model-chips{display:flex;flex-wrap:wrap;gap:4px;min-width:0}.dsh-comfy-floating .cc-output-model-chip{display:inline-flex;align-items:center;max-width:100%;min-height:24px;padding:3px 7px;border-radius:6px;background:var(--cc-surface);border:1px solid color-mix(in srgb,var(--cc-border) 75%,transparent);color:var(--cc-text);font-size:9px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-comfy-floating .cc-output-model-chip.is-primary{border-color:color-mix(in srgb,var(--cc-accent) 42%,var(--cc-border));background:color-mix(in srgb,var(--cc-accent-bg) 58%,var(--cc-surface))}
.dsh-comfy-floating .cc-output-prompt-box{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;padding:9px 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--cc-text)}.dsh-comfy-floating .cc-output-prompt-toolbar{display:flex;align-items:center;gap:5px}.dsh-comfy-floating .cc-output-prompt-translate{height:26px;padding:0 8px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-muted);font:inherit;font-size:9px;cursor:pointer}.dsh-comfy-floating .cc-output-prompt-translate:hover,.dsh-comfy-floating .cc-output-prompt-translate[aria-pressed=true]{border-color:var(--cc-accent);color:var(--cc-text);background:var(--cc-accent-bg)}.dsh-comfy-floating .cc-output-prompt-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:9px;color:var(--cc-muted)}.dsh-comfy-floating .cc-output-prompt-source{display:inline-flex;align-items:center;padding:2px 5px;border-radius:99px;background:var(--cc-hover)}
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


/* Model dock proportions follow the module share; narrow containers still wrap. */
.dsh-comfy-ui .cc-workbench-module[data-module="model"] .cc-model-dock{padding:4px 10px 6px;gap:6px;flex:1}
.dsh-comfy-ui .cc-model-dock-main{--cc-model-cover-min:128px;--cc-model-cover-size:var(--cc-model-cover-min);display:grid;grid-template-columns:minmax(0,4fr) minmax(0,3fr) minmax(0,3fr);grid-template-areas:'base recommendation controls';gap:10px;align-items:start}
.dsh-comfy-ui .cc-model-dock-main>.cc-model-base{grid-area:base;display:grid;grid-template-columns:var(--cc-model-cover-size) minmax(0,1fr);gap:10px;align-items:start;border:0;background:transparent;border-radius:0;padding:0}
.dsh-comfy-ui .cc-model-base-content{display:flex;flex-direction:column;gap:6px;min-width:0}
.dsh-comfy-ui .cc-model-base-content>.cc-model-base-button{width:100%;padding:0;border:0;background:transparent;border-radius:0}
.dsh-comfy-ui .cc-model-base-content>.cc-model-auto-details{padding:0;gap:4px}
.dsh-comfy-ui .cc-model-cover-select{display:block;width:var(--cc-model-cover-size);min-width:0;padding:0;border:0;border-radius:var(--cc-ui-radius-control);background:var(--cc-control);color:var(--cc-muted);cursor:pointer;overflow:hidden;aspect-ratio:1}
.dsh-comfy-ui .cc-model-cover-select .cc-model-main-art{width:var(--cc-model-cover-size);flex-basis:var(--cc-model-cover-size)}
.dsh-comfy-ui .cc-model-cover-select .cc-model-dock-art--main{width:var(--cc-model-cover-size);height:var(--cc-model-cover-size);aspect-ratio:1}
.dsh-comfy-ui .cc-model-dock-main>.cc-model-recommendation{grid-area:recommendation;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:6px;align-self:stretch;padding-left:10px;border-left:var(--cc-ui-border-width) solid var(--cc-border);min-width:0}
.dsh-comfy-ui .cc-model-recommendation-label{font-size:11px;color:var(--cc-muted);font-weight:var(--cc-ui-weight-label)}
.dsh-comfy-ui .cc-model-dock-main>.cc-model-recommendation>button{margin-top:1px}
.dsh-comfy-ui .cc-model-dock-main>.cc-model-control-dock{grid-area:controls;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:7px;padding:0 0 0 10px;border-left:var(--cc-ui-border-width) solid var(--cc-border);align-self:stretch;min-width:0}
.dsh-comfy-ui .cc-model-control-dock>.cc-control-panel-entry{width:100%}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="medium"] .cc-model-dock-main{grid-template-columns:minmax(0,6fr) minmax(0,4fr);grid-template-areas:'base controls' 'recommendation controls';row-gap:6px}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="medium"] .cc-model-dock-main>.cc-model-recommendation{flex-direction:row;align-items:center;flex-wrap:wrap;border-left:0;border-top:var(--cc-ui-border-width) solid var(--cc-border);padding:6px 0 0;gap:6px 10px}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="medium"] .cc-model-recommendation>div{flex:1}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="medium"] .cc-model-recommendation>button{margin-left:auto}
.dsh-comfy-ui .cc-model-dock .cc-model-dock-main[data-recommended="false"]{grid-template-columns:minmax(0,6fr) minmax(0,4fr);grid-template-areas:'base controls'}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-dock-main{grid-template-columns:minmax(0,1fr);grid-template-areas:'base' 'recommendation' 'controls';row-gap:7px}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-dock-main[data-recommended="false"]{grid-template-columns:minmax(0,1fr);grid-template-areas:'base' 'controls'}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-dock-main>.cc-model-recommendation{flex-direction:row;align-items:center;flex-wrap:wrap;border-left:0;border-top:var(--cc-ui-border-width) solid var(--cc-border);padding:6px 0 0;gap:6px 10px}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-recommendation>div{flex:1}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-recommendation>button{margin-left:auto}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-dock-main>.cc-model-control-dock{border-left:0;border-top:var(--cc-ui-border-width) solid var(--cc-border);padding:6px 0 0;flex-direction:row;align-items:center;flex-wrap:wrap}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-control-dock>.cc-control-panel-entry{width:auto}
.dsh-comfy-ui .cc-model-dock[data-dock-layout="small"] .cc-model-control-dock>.cc-control-panel-summary{flex:1}
@container(max-width:700px){
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-dock-main,.dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-dock-main[data-recommended="false"]{grid-template-columns:minmax(0,1fr);grid-template-areas:'base' 'recommendation' 'controls';row-gap:7px}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-dock-main[data-recommended="false"]{grid-template-areas:'base' 'controls'}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-dock-main>.cc-model-recommendation{flex-direction:row;align-items:center;flex-wrap:wrap;border-left:0;border-top:var(--cc-ui-border-width) solid var(--cc-border);padding:6px 0 0;gap:6px 10px}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-recommendation>div{flex:1}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-recommendation>button{margin-left:auto}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-dock-main>.cc-model-control-dock{border-left:0;border-top:var(--cc-ui-border-width) solid var(--cc-border);padding:6px 0 0;flex-direction:row;align-items:center;flex-wrap:wrap}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-control-dock>.cc-control-panel-entry{width:auto}
 .dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-control-dock>.cc-control-panel-summary{flex:1}
}
@container(max-width:420px){.dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-recommendation>div{flex-basis:100%;order:1}.dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-recommendation>button{order:0;margin-top:0}.dsh-comfy-ui .cc-model-dock[data-dock-layout] .cc-model-control-dock>.cc-control-panel-summary{flex-basis:100%}}

${typeof WORKBENCH_LAYOUT_CSS==='string'?WORKBENCH_LAYOUT_CSS:''}

${typeof RUNTIME_STATUS_CSS==='string'?RUNTIME_STATUS_CSS:''}


.cc-switch{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;cursor:pointer;font-size:12px;color:var(--cc-text);user-select:none}
.cc-switch>input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.cc-switch-track{position:relative;display:inline-block;width:33px;height:19px;border-radius:99px;background:var(--cc-border);flex:none;transition:background .15s}
.cc-switch-track:after{content:"";position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:var(--cc-text);transition:transform .15s}
.cc-switch>input:checked+.cc-switch-track{background:var(--cc-accent)}
.cc-switch>input:checked+.cc-switch-track:after{transform:translateX(14px);background:var(--cc-surface)}
.cc-switch>input:focus-visible+.cc-switch-track{outline:2px solid var(--cc-accent);outline-offset:2px}
.cc-settings-nav{display:flex;flex-direction:column;gap:4px;padding-right:14px;border-right:1px solid var(--cc-border)}
.cc-settings-nav-btn{display:block;width:100%;text-align:left;padding:8px 12px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--cc-text);cursor:pointer;font-size:13px;line-height:1.3}
.cc-settings-nav-btn:hover{background:var(--cc-hover)}
.cc-settings-nav-btn[aria-pressed="true"]{background:var(--cc-accent-bg);border-color:var(--cc-accent);color:var(--cc-accent-text)}
`;

const S = {
    wrap: { padding: "14px 18px", display: "flex", flexDirection: "column", gap: "11px", minHeight: 0, height: "100%", overflowY: "auto", boxSizing: "border-box", color: "var(--cc-text)" },
    row: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" },
    field: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 },
    label: { fontSize: "12px", color: "var(--cc-muted)" },
    sel: { background: "var(--cc-control)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: "6px", padding: "7px 9px", fontSize: "13px", minWidth: "140px", cursor: "pointer" },
    inp: { background: "var(--cc-control)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: "6px", padding: "6px 9px", fontSize: "13px", width: "88px" },
    ta: { background: "var(--cc-control)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: "6px", padding: "9px", fontSize: "12.5px", fontFamily: "ui-monospace,Consolas,monospace", lineHeight: 1.55, resize: "vertical", width: "100%", boxSizing: "border-box" },
    btn: { "--cc-button-hover":"color-mix(in srgb,var(--cc-accent-bg) 82%,var(--cc-accent))", "--cc-button-border":"var(--cc-accent)", background: "var(--cc-accent-bg)", color: "var(--cc-accent-text)", border: "1px solid var(--cc-accent)", borderRadius: "6px", padding: "7px 14px", fontSize: "13px", cursor: "pointer" },
    btn2: { background: "var(--cc-control)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" },
    chip: { background: "var(--cc-control)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: "999px", padding: "3px 10px", fontSize: "12px", cursor: "pointer" },
    card: { border: "1px solid var(--cc-border)", borderRadius: "8px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
    ok: { color: "var(--cc-ok)" }, bad: { color: "var(--cc-bad)" }, warn: { color: "var(--cc-warn)" },
    dim: { color: "var(--cc-muted)", fontSize: "12px" },
    scrollBox: { display: "flex", flexWrap: "wrap", gap: "5px", maxHeight: "130px", overflowY: "auto" },
    tab: { padding: "7px 14px", fontSize: "13px", cursor: "pointer" },
    tabOn: { borderBottom: "2px solid var(--cc-accent)", color: "var(--cc-text)" },
    tabOff: { borderBottom: "2px solid transparent", color: "var(--cc-muted)" },
};

// 自绘下拉框：浏览器/Windows/WSL 的原生 option 弹层无法可靠指定颜色。
// 弹层通过 portal/fixed 脱离页面布局；数量多时允许搜索、滚动和键盘选择。
function SelectMenu({ options, value, onChange, label, theme, minWidth = 140, forceSearch = false, forceOpen = false, disabled = false }) {
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
    React.useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
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
        if (!items.length || items.every(o=>!o.value)&&items.some(o=>/未找到|暂无/.test(o.label))) {
            notifyError((label||'此列表')+'暂无可用选项。请先连接 ComfyUI 并刷新列表；已连接时请检查所需模型或节点是否安装。',{title:'没有可用选项',severity:'warn'});return;
        }
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
            disabled: disabled,
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
function PanelIcon(props) {
    const size = (props && props.size) || 20;
    return h("span", { role: "img", "aria-label": "ComfyUI", title: "ComfyUI",
        style: { display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: size, height: size, color: "inherit", flexShrink: 0 } },
        h(OfflineComfyMark, { size }));
}

// 辅助 UI 必须脱离绘图台布局。优先使用 ReactDOM Portal（不要求必须安装），
// 在老版 DSH 不提供 react-dom 时，固定定位层依然不参与 flex 高度计算。
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
    const [error,setError]=useErrorState("");
    const task=React.useRef({seq:0,ctl:null});
    function stop(){task.current.seq++;task.current.ctl?.abort();task.current.ctl=null;setBusy(false);}
    React.useEffect(()=>()=>{task.current.seq++;task.current.ctl?.abort();},[]);
    async function run(){
        stop();const seq=++task.current.seq,ctl=new AbortController();task.current.ctl=ctl;
        setBusy(true);setError("");setReport(null);
        try {
            const data=await jget(EXPANDER+"/diagnostics/compatibility",15000,ctl.signal);
            if(!Array.isArray(data.items))throw new Error("检查结果格式无效");
            if(task.current.seq===seq){setReport(data);if(data.summary?.errors>0)notifyError("发现 "+data.summary.errors+" 项兼容性问题，请查看下方检查结果。",{title:"环境检查未通过"});}
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

function Switch({ checked, onChange, label, disabled = false }) {
    return h("label", { className: "cc-switch" },
        label ? h("span", null, label) : null,
        h("input", { type: "checkbox", checked: !!checked, disabled, onChange: e => onChange?.(e.target.checked) }),
        h("span", { className: "cc-switch-track", "aria-hidden": "true" }));
}
function PostAutoSwitch({ checked, onChange, label, disabled = false }) {
    return h("button", { type: "button", role: "switch", "aria-checked": !!checked, className: "cc-switch cc-post-auto-switch", disabled, onClick: (e) => { e?.stopPropagation?.(); onChange?.(!checked); } },
        label ? h("span", null, label) : null,
        h("span", { className: "cc-switch-track", "aria-hidden": "true" }));
}
function CellHead({ index, title, titleAddon, enabled, onToggle, dragHandlers, canUp, canDown, onUp, onDown, onRemove, showRemove = true }) {
    return h("header", { className: "cc-post-cell-head" },
        h("span", { className: "cc-post-cell-index", "aria-hidden": "true" }, String(index).padStart(2, "0")),
        dragHandlers ? h("span", Object.assign({ className: "cc-post-cell-drag", draggable: true, title: "拖动排序", role: "button", tabIndex: 0, "aria-label": "拖动排序 " + title }, dragHandlers), h(PromptIcon, { name: "grip", size: 16 })) : null,
        h("strong", { className: "cc-post-cell-title" }, title),
        titleAddon || null,
        enabled !== undefined ? h("div", { className: "cc-post-cell-enable" }, h(Switch, { checked: !!enabled, onChange: onToggle, label: "启用" })) : null,
        onUp ? h("div", { className: "cc-post-cell-actions" },
            h("button", { type: "button", style: S.btn2, "aria-label": "上移 " + title, "data-cc-tooltip": "上移", disabled: !canUp, onClick: onUp }, "↑"),
            h("button", { type: "button", style: S.btn2, "aria-label": "下移 " + title, "data-cc-tooltip": "下移", disabled: !canDown, onClick: onDown }, "↓"),
            showRemove ? h("button", { type: "button", style: S.btn2, "aria-label": "删除 " + title, "data-cc-tooltip": "删除", onClick: onRemove }, h(PromptIcon, { name: "trash", size: 18 })) : null) : null);
}
function OverlayModal({ title, titleAddon, titleActions, onClose, children, footer, width = 560, theme, className, zIndex = 2147480000, guideTarget, maxHeight, closeOnBackdrop = true, hideClose = false, headerActions }) {
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
        onMouseDown: (e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); },
    },
        h("section", { ref: dialogRef, className, "data-cc-guide": guideTarget || undefined, role: "dialog", "aria-modal": "true", "aria-label": title,
            tabIndex: -1, style: {
                width: typeof width === "number" ? width + "px" : width, maxWidth: "100%", maxHeight: maxHeight || "min(760px, calc(100dvh - 28px))",
                minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column",
                overflow: "hidden", borderRadius: "12px", outline: "none",
                background: "var(--cc-surface)", color: "var(--cc-text)",
                border: "1px solid var(--cc-border)", boxShadow: "0 18px 65px rgba(0,0,0,.48)",
            } },
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "12px", flexShrink: 0, padding: "14px 16px",
                borderBottom: "1px solid var(--cc-border)" } },
                h("strong", { style: { fontSize: "15px" } }, title,titleAddon||null),
                titleActions || null,headerActions||null,
                hideClose?null:h("button", { type: "button", style: S.btn2, onClick: onClose,
                    "aria-label": "关闭弹窗", title: "关闭 (Esc)" }, "✕")),
            h("div", { style: { display: "flex", flexDirection: "column", gap: "12px",
                padding: "16px", overflowY: "auto", minHeight: 0, overscrollBehavior: "contain" } }, children),
            footer ? h("div", { style: { flexShrink: 0, display: "flex", justifyContent: "flex-end", alignItems: "center",
                gap: 8, flexWrap: "wrap", padding: "12px 16px", minHeight: 56, boxSizing: "border-box", borderTop: "1px solid var(--cc-border)",
                background: "var(--cc-surface)" } }, footer) : null)));
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
        {target: "tutorial-menu", title: "更多教程", text: "右上角「教程 ▾」里还有提示词、模型、图片、参数和输出等分步教程，之后也可以随时重新打开。"},
    ]},
    model: { name: "模型与组件", steps: [
        {target: "model-dock", title: "模型配置模块", text: "选择主模型后会自动识别类型；右侧可以添加生成时需要的组件。"},
        {target: "model-base", title: "底模选择", text: "这里显示当前主模型和预览图。点它可以打开模型库，换底模或其他模型。"},
        {target: "model-library", openModelLibrary: true, title: "打开模型库", text: "模型库用来浏览本地模型目录。选中模型后，在右侧确认预览和文件信息，再点「使用」替换当前底模。"},
        {target: "model-library-left", openModelLibrary: true, title: "左侧目录", text: "左边是模型文件夹和文件列表。上方路径显示当前位置，搜索框按文件名过滤，文件夹可以逐层展开。"},
        {target: "model-library-right", openModelLibrary: true, title: "右侧信息", text: "右边显示选中模型的预览图、大小、来源和「使用」按钮。确认是需要的模型后，再替换当前底模。"},
        {target: "model-profile", title: "自动识别模型", text: "模型信息下方显示识别结果、提示词说明和推荐参数。推荐参数需主动点击应用。"},
        {target: "model-profile", title: "确认识别结果", text: "通常无需手动设置；识别不出来时会出现类型选择，也可以通过旁边的设置图标修正，程序会记住你的选择。"},
        {target: "generation-controls", title: "生成时控制", text: "需要补充 VAE、文本编码器或 LoRA 时，从这里打开生成时控制。"},
        {target: "generation-panel", openGenerationControls: true, title: "生成时控制面板", text: "左边添加组件，右边管理已经添加的组件。"},
        {target: "generation-components", openGenerationControls: true, title: "可添加的组件", text: "左边列出图生图、VAE、文本编码器、LoRA 和 Anima control。点选后从本地模型库选择文件；不需要的组件不用添加。Anima control 的用法见「教程 ▾ → Anima Control」。"},
        {target: "generation-added", openGenerationControls: true, title: "已添加的组件", text: "右边显示已添加的组件。LoRA 可以单独开关、调强度或移除；VAE 和文本编码器会替换主模型自带的部分。"},
    ]},
    anima: { name: "Anima Control（3D 姿态 / 区域色块）", steps: [
        {target: "generation-controls", title: "打开生成时控制", text: "Anima Control 是生成时控制里的一个组件，用来给 Anima 模型提供 3D 姿态或区域色块的额外控制。先点这里打开生成时控制。"},
        {target: "generation-components", openGenerationControls: true, autoAdd: "anima", title: "添加 Anima control", text: "在左侧组件列表里点「Anima control」的「添加」，右侧就会出现这个单元格。"},
        {target: "generation-added", openGenerationControls: true, title: "选控制模型（三种）", text: "在「ControlNet 模型」里选一种：Regional 4335 用 RGB 区域色块控制人物位置和轮廓；3D 姿态 6200 用带阴影的 3D 人体网格控制姿势和手指；3D 姿态 + 轮廓 7000 在 3D 姿态上再加互补色轮廓，多人物重叠时更清晰。"},
        {target: "generation-added", openGenerationControls: true, title: "3D 姿态：编辑并拍摄", image: EXPANDER + "/assets/anima/anima_3dpose_6200_example.png", text: "选 3D 姿态模型后，点缩略图或「编辑 3D 场景」打开专用 3D 窗口：黑底、没有地面网格，拍出来的人偶就是模型需要的控制图（左：控制图；右：生成结果）。摆好姿势后点拍摄，回到插件点应用。"},
        {target: "generation-added", openGenerationControls: true, title: "3D 姿态 + 轮廓的差别", image: EXPANDER + "/assets/anima/comparison_23.jpg", text: "轮廓模型在 3D 网格外增加互补色描边，人物互相重叠、手部交叠时边界更清楚（上图：控制输入；下图：不同描边粗细的生成结果）。粗细不是越粗越好，一般从 4px 起比较。"},
        {target: "generation-added", openGenerationControls: true, title: "区域色块：画色块图", image: EXPANDER + "/assets/anima/regional_workflow_small.jpg", text: "选 Regional 模型后会出现「画布尺寸」和「编辑区域图」。编辑器里只有画笔、橡皮擦、油漆桶和固定 8 色色卡：每种颜色代表一个区域，黑色是未分配。保存后这张色块图就会作为控制图。"},
        {target: "generation-added", openGenerationControls: true, title: "强度与作用范围", text: "强度控制控制图的影响大小，默认 1.0；作用范围控制它在采样过程的哪一段生效，默认 0%→100%。推荐：30 步、CFG 4、强度 1.0。"},
        {target: "image-settings", title: "尺寸会跟着控制图", text: "启用 Anima control 后，采样设置里的宽高和比例会被锁定，显示「使用 Anima 控制图比例」，生成尺寸等于控制图的真实尺寸（区域图画布或 3D 截图）。这样控制图和画布比例一致，不会变形。"},
    ]},
    image: { name: "图片参数与生成", steps: [
        {target: "image-settings", title: "采样设置", text: "采样设置和图片预览是独立模块，可拖动标题调整位置或并排显示。这里选择采样节点、调整其参数，并设置尺寸、Seed 和保存位置；生成后控制位于工作台底部，可按需展开。"},
        {target: "image-size", title: "尺寸与倍率", text: "比例和宽高决定基础尺寸；倍率把宽高按倍数放大或缩小，右侧预览会显示最终像素。"},
        {target: "image-sampling", title: "采样参数", text: "步数、CFG、采样器和调度器控制生成过程。没有把握就保留默认值；不同模型适用的范围不同。"},
        {target: "image-save", title: "保存位置", text: "打开「保存输出到本地」后，结果会保存到指定目录。目录留空时使用 ComfyUI 默认输出目录；文件名前缀用于区分本次任务。"},
        {target: "image-preview", title: "结果预览", text: "这里预览最近一次生成的结果，并显示最终尺寸。点击图片可以打开查看器，方便放大检查细节。"},
        {target: "generate", title: "开始生成", text: "确认模型、提示词和参数后点「生成」。进度和排队状态显示在右上角。"},
    ]},
    post: { name: "生成后处理", steps: [
        {target: "post-controls", title: "生成后处理设置", text: "这里是生成时自动执行的后处理设置。点生成后，插件先出图，再按这里的顺序继续处理；按钮后面是已经启用的处理。"},
        {target: "post-panel", openPostControls: true, title: "生成后控制", text: "面板可收起。开启自动执行后，工作台生成的图片会按右侧步骤处理；关闭后，可导入图片并手动开始处理。图片输入固定在右侧顶部，局部重绘遮罩需先在图片编辑器中保存应用。"},
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
        {target: "prompt-expand", title: "AI 扩写", text: "让 DSH AI 基于当前正向和负向提示词进行扩写。扩写期间提示词暂时锁定，按钮显示加载动画；鼠标移到按钮上会变成停止图标，可以中止本次扩写。成功后整次修改可撤回。"},
        {target: "prompt-chat", title: "对话编辑", text: "点这里可用自然语言提出提示词修改要求。模块占一半及以下时，聊天会替代提示词区；再次点击收起。下一步会展开聊天供你查看。"},
        {target: "prompt-chat-panel", title: "对话编辑区", openPromptChat: true, text: "在这里描述要怎样改提示词。AI 返回后先看完整正/负提示词，再决定是否采用；点「采用」才会写回提示词，并进入撤回历史。聊天记录只保留到本次 DSH 运行结束。"},
        {target: "prompt-clear", title: "清空提示词", text: "叉号会同时清空正向和负向提示词。清空也可以撤回，误点后用上方撤回恢复。"},
    ]},
};
const TUTORIAL_GROUPS = [
    {key:'workbench', label:'工作台', items:['basic','prompt','model','image','post','anima']},
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
                h('button',{type:'button',style:S.btn2,onClick:async()=>{if(!await showConfirm({title:'清空错误日志',message:'清空本设备错误日志？'}))return;clearClientErrors();onClose();}},'清空')),
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
    const margin = 12, width = Math.min(640, Math.max(1, vw - margin * 2));
    if (!box) return {position: "fixed", width: "calc(100vw - 24px)", maxWidth: 640,
        maxHeight:"calc(100dvh - 24px)", left: "50%", top: "50%", transform: "translate(-50%, -50%)"};
    const sideLeft = box.left - width - margin, sideRight = box.left + box.width + margin;
    if (side === "left" && sideLeft >= margin) {
        const top = Math.max(margin, Math.min(box.top, vh - 220));
        return {position: "fixed", left: sideLeft, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.max(260, Math.min(760, vh - top - margin))};
    }
    if (side === "right" && sideRight + width <= vw - margin) {
        const top = Math.max(margin, Math.min(box.top, vh - 220));
        return {position: "fixed", left: sideRight, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.max(260, Math.min(760, vh - top - margin))};
    }
    // 先上/下（更符合阅读顺序），放不下再左右；浮窗整体夹在视口内，避免被裁。
    const H = Math.min(760, Math.max(360, vh - margin * 2));
    const need = 380; // 文字 + 一张图所需的最小高度
    const belowTop = box.top + box.height + 14, belowAvail = vh - belowTop - margin;
    const aboveAvail = box.top - 14 - margin;
    const leftX = Math.max(margin, Math.min(vw - width - margin, box.left + box.width / 2 - width / 2));
    if (belowAvail >= need) {
        return {position: "fixed", left: leftX, top: belowTop, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.min(H, belowAvail)};
    }
    if (aboveAvail >= need) {
        const h = Math.min(H, aboveAvail);
        return {position: "fixed", left: leftX, top: box.top - 14 - h, width, maxWidth: "calc(100vw - 24px)", maxHeight: h};
    }
    // 上下都放不下时，放目标左/右两侧中放得下的那一侧。
    const clampTop = t => Math.max(margin, Math.min(vh - Math.min(H, vh - margin * 2) - margin, t));
    const top = clampTop(box.top);
    const sideLeftX = box.left - width - margin, sideRightX = box.left + box.width + margin;
    if (sideLeftX >= margin) {
        return {position: "fixed", left: sideLeftX, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: H};
    }
    if (sideRightX + width <= vw - margin) {
        return {position: "fixed", left: sideRightX, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: H};
    }
    return {position: "fixed", left: margin, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: H};
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
        // 引导里会顺带打开/切换面板（比如生成时控制浮窗），目标元素可能更晚才挂载。
        const retries = [300, 700].map(ms => setTimeout(update, ms));
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => { clearTimeout(timer); retries.forEach(clearTimeout); if (frame) cancelAnimationFrame(frame);
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
            step.image ? h("img", {src:step.image, alt:step.title, loading:"lazy", style:{display:"block",width:"100%",maxHeight:"min(340px, 40vh)",objectFit:"contain",borderRadius:8,border:"1px solid var(--cc-border)",marginTop:10,background:"#000"}, onError:e=>{e.currentTarget.style.display="none";}}) : null,
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
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > value.length) return null;
    if(start!==end) {
        const selected=value.slice(start,end);
        if(!selected.trim() || /[<>:|\[\]]/.test(selected))return null;
        const leading=selected.length-selected.trimStart().length,trailing=selected.length-selected.trimEnd().length;
        return {start:start+leading,end:end-trailing,query:selected.trim()};
    }
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
function completionGeometry(point, vw, vh, contentHeight=430) {
    const width=Math.max(1,Math.min(470,vw-16)),limit=Math.max(1,Math.min(430,vh-16));
    const desired=Math.max(1,Math.min(limit,contentHeight));
    const below=Math.max(0,vh-point.bottom-8),above=Math.max(0,point.top-8);
    const side=below>=desired?'below':above>=desired?'above':below>=above?'below':'above';
    const available=side==='below'?below:above,height=Math.max(1,Math.min(desired,available));
    const top=side==='below'?Math.max(8,Math.min(vh-height-8,point.bottom+8)):Math.max(8,point.top-height-8);
    return {left:Math.max(8,Math.min(vw-width-8,point.left)),width,top,maxHeight:height};
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
function completionDesiredHeight(popup={}) {
    const rows=popup.relatedOnly?0:Math.min(6,(popup.items||[]).length);
    return Math.min(430,36+(rows?Math.min(rows,4.5)*61:popup.relatedOnly?0:56)+(popup.relatedItems?.length?100:0)+(popup.relatedOnly?24:80)+(popup.translating?36:0)+(popup.translationError?36:0));
}
function duplicatePromptKey(value) {
    return String(value||"").normalize("NFKC").toLocaleLowerCase().replace(/\\([,()[\]\\])/g,"$1").replace(/_/g," ").replace(/\s+/g," ").trim();
}
function promptDuplicateRanges(value,item,range) {
    if(!item || /[,\n\r]/.test(item.output||""))return [];
    const names=new Set([item.output,item.label,...(item.translations||[])].filter(Boolean).map(duplicatePromptKey));
    const matches=[];
    // Only complete comma/newline-delimited terms match; never colour substrings
    // of a sentence, a LoRA, an embedding or other prompt control syntax.
    for(const token of String(value).matchAll(/(?:\\.|[^,，\n\r])+/g)){
        let start=token.index,end=start+token[0].length;
        while(start<end && /\s/.test(value[start]))start++;
        while(end>start && /\s/.test(value[end-1]))end--;
        while(start<end && /[([]/.test(value[start]))start++;
        while(end>start && /[)\]]/.test(value[end-1]) && value[end-2]!=="\\")end--;
        const weight=value.slice(start,end).match(/(?<!\\):\s*[-+]?\d+(?:\.\d+)?\s*$/);
        if(weight)end=start+weight.index;
        while(end>start && /\s/.test(value[end-1]))end--;
        const text=value.slice(start,end);
        if(/[<>|]|(?<!\\):/.test(text)||/^(BREAK|AND|embedding\b)/i.test(text))continue;
        if(names.has(duplicatePromptKey(text)))matches.push({start,end});
    }
    return matches.some(m=>!range || m.start<range.start || m.end>range.end)?matches:[];
}
function showPromptDuplicateHighlight(node,item,range,theme={}) {
    if(typeof document==="undefined" || !node?.parentElement || !window.getComputedStyle)return ()=>{};
    const ranges=promptDuplicateRanges(node.value,item,range);
    if(!ranges.length)return ()=>{};
    const mirror=document.createElement("div"),style=window.getComputedStyle(node);
    mirror.className="cc-prompt-duplicate-mirror";mirror.setAttribute("aria-hidden","true");
    for(const key of ["fontFamily","fontSize","fontWeight","fontStyle","lineHeight","letterSpacing","wordSpacing","textAlign","textIndent","textTransform","paddingTop","paddingRight","paddingBottom","paddingLeft","borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth","tabSize"])
        mirror.style[key]=style[key];
    const originalColor=node.style.getPropertyValue("color"),priority=node.style.getPropertyPriority("color");
    const originalCaret=node.style.getPropertyValue("caret-color"),caretPriority=node.style.getPropertyPriority("caret-color");
    mirror.style.color=style.color;
    let last=0;
    for(const part of ranges){
        mirror.appendChild(document.createTextNode(node.value.slice(last,part.start)));
        const mark=document.createElement("mark");mark.textContent=node.value.slice(part.start,part.end);
        mark.style.color=theme["--cc-accent"]||"var(--cc-accent)";mirror.appendChild(mark);last=part.end;
    }
    mirror.appendChild(document.createTextNode(node.value.slice(last)+"\n"));
    node.parentElement.appendChild(mirror);
    const sync=()=>{
        mirror.style.left=node.offsetLeft+"px";mirror.style.top=node.offsetTop+"px";
        mirror.style.width=node.offsetWidth+"px";mirror.style.height=node.offsetHeight+"px";
        const borders=parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth);
        mirror.style.paddingRight=(parseFloat(style.paddingRight)+Math.max(0,node.offsetWidth-node.clientWidth-(borders||0)))+"px";
        mirror.scrollTop=node.scrollTop;mirror.scrollLeft=node.scrollLeft;
    };
    node.style.setProperty("color","transparent","important");
    node.style.setProperty("caret-color",style.caretColor==="auto"?style.color:style.caretColor);
    node.dataset.ccDuplicateHighlight="true";sync();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(sync):null;observer?.observe(node);
    node.addEventListener("scroll",sync);window.addEventListener("resize",sync);
    return ()=>{
        observer?.disconnect();node.removeEventListener("scroll",sync);window.removeEventListener("resize",sync);mirror.remove();
        if(originalColor)node.style.setProperty("color",originalColor,priority);else node.style.removeProperty("color");
        if(originalCaret)node.style.setProperty("caret-color",originalCaret,caretPriority);else node.style.removeProperty("caret-color");
        delete node.dataset.ccDuplicateHighlight;
    };
}

function completionTypes(item) {
    if(Array.isArray(item.types))return item.types;
    if(item.kind==='tag')return ['标签'];
    return /[,\n\r]/.test(item.output||'') || String(item.output||'').split(/\s+/).length>5?['词组']:['翻译'];
}
function useTagCompletion({updatePrompt,promptRef,expandPhaseRef,theme,enabled=true,underscores=false,category=""}) {
    const [popup,setPopup]=React.useState(null),[active,setActive]=React.useState(0);
    const keyboardScrollRef=React.useRef(false);
    const request=React.useRef({seq:0,timer:null,controller:null,translation:null});
    const composing=React.useRef(false),latest=React.useRef(null),menuRef=React.useRef(null),highlightRef=React.useRef(null);
    function clearHighlight(){highlightRef.current?.();highlightRef.current=null;}
    function highlight(item){clearHighlight();const cur=latest.current;if(cur)highlightRef.current=showPromptDuplicateHighlight(cur.node,item,cur.range,theme);}
    function close() {
        clearHighlight();request.current.seq++;clearTimeout(request.current.timer);request.current.controller?.abort();request.current.translation?.abort();request.current.translation=null;
        latest.current=null;setPopup(null);
    }
    function position(next){return {...next,geometry:completionGeometry(promptCaretPoint(next.node),window.innerWidth,window.innerHeight,completionDesiredHeight(next))};}
    function valid(cur,seq) {
        if(!cur || seq!==request.current.seq || composing.current || expandPhaseRef.current!=="idle")return false;
        const {node,value,caret,end}=cur;
        return !node.disabled && node.value===value && node.selectionStart===caret && node.selectionEnd===end && promptRef.current[cur.kind]===value;
    }
    function inspect(kind,node,markInitial=true) {
        clearHighlight();
        if(!enabled || composing.current || expandPhaseRef.current!=="idle" || !node || node.disabled){close();return;}
        const range=promptTagRange(node.value,node.selectionStart,node.selectionEnd);
        if(!range){close();return;}
        const cur={kind,node,value:node.value,range,caret:node.selectionStart,end:node.selectionEnd};
        const seq=++request.current.seq;
        clearTimeout(request.current.timer);request.current.controller?.abort();request.current.translation?.abort();request.current.translation=null;
        latest.current=cur;setActive(0);
        setPopup(position({...cur,items:[],relatedItems:[],loading:true}));
        request.current.timer=setTimeout(async()=>{
            const controller=new AbortController();request.current.controller=controller;
            try {
                const data=await dictionaryRequest("search?q="+encodeURIComponent(range.query)+"&limit=30&completion=1&category="+encodeURIComponent(category),undefined,"GET",controller.signal);
                if(!valid(cur,seq)||controller.signal.aborted)return;
                const items=data.items||[];setActive(0);
                setPopup(p=>p?position({...p,items:[...items,...p.items.filter(v=>v.origin)],anchor:data.related_anchor,relatedItems:data.related_items||[],loading:false}):null);
                if(markInitial)highlight(items[0]);
            } catch(e) {
                if(valid(cur,seq)&&!controller.signal.aborted)setPopup(p=>p?position({...p,loading:false,error:'候选读取失败，可稍后重试'}):null);
            }
        },130);
    }
    function commit(next,relatedState) {
        const cur=latest.current;if(!cur)return;
        close();const seq=request.current.seq;updatePrompt({[cur.kind]:next.value},"action");
        setTimeout(()=>{
            if(seq!==request.current.seq || !cur.node.isConnected || promptRef.current[cur.kind]!==next.value || cur.node.value!==next.value)return;
            cur.node.focus();cur.node.setSelectionRange(next.caret,next.caret);
            if(relatedState?.relatedItems?.length){
                const state={...cur,value:next.value,caret:next.caret,end:next.caret,range:{start:next.caret,end:next.caret,query:""},items:[],relatedOnly:true,loading:false,...relatedState};
                latest.current=state;setPopup(position(state));
            }
        },0);
    }
    function choose(item) {
        const cur=latest.current;if(!item || !valid(cur,request.current.seq))return;
        const next=replacePromptTag(cur.value,cur.range,item,underscores);
        const same=popup?.anchor && duplicatePromptKey(popup.anchor.output)===duplicatePromptKey(item.output);
        commit(next,same?{anchor:item,relatedItems:popup.relatedItems}:null);
    }
    function chooseRelated(item) {
        const cur=latest.current;if(!valid(cur,request.current.seq))return;
        const base=popup.relatedOnly?cur.value:replacePromptTag(cur.value,cur.range,popup.anchor,underscores).value;
        const text=replacePromptTag("",{start:0,end:0},item,underscores).value;
        const trimmed=base.trimEnd(),value=trimmed+(trimmed?(trimmed.endsWith(",")?" ":", "):"")+text;
        commit({value,caret:value.length},{anchor:popup.anchor,relatedItems:popup.relatedItems});
    }
    async function translate(method) {
        const cur=latest.current,seq=request.current.seq;
        if(!valid(cur,seq)||request.current.translation)return;
        clearHighlight();const controller=new AbortController();request.current.translation=controller;
        setPopup(p=>p?position({...p,translating:method,translationError:'',items:p.items.filter(v=>!v.origin)}):null);
        try {
            const result=await jpost(EXPANDER+'/prompt/translate',{text:cur.range.query,method},195000,controller.signal);
            if(!valid(cur,seq)||controller.signal.aborted)return;
            if(!result.item || typeof result.item.output!=='string')throw Error('翻译返回内容无效');
            setPopup(p=>{if(!p)return null;const items=[result.item,...p.items.filter(v=>!v.origin)];setActive(0);return position({...p,items,translating:null});});
        } catch(e) {
            if(valid(cur,seq)&&!controller.signal.aborted){const error=errText(e);setPopup(p=>p?position({...p,translating:null,translationError:error}):null);notifyError(error,{title:method==='ai'?'AI 翻译失败':'机翻失败'});}
        } finally {if(request.current.translation===controller)request.current.translation=null;}
    }
    function keys(e) {
        clearHighlight();
        if(composing.current || e.isComposing || e.nativeEvent?.isComposing || e.keyCode===229)return;
        if(!popup || expandPhaseRef.current!=="idle")return;
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
        if(!popup.items.length)return;
        if(["ArrowDown","ArrowUp","Enter","Tab"].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();e.stopPropagation();
            if(e.key==="ArrowDown" || e.key==="ArrowUp"){const i=(active+(e.key==="ArrowDown"?1:-1)+popup.items.length)%popup.items.length;keyboardScrollRef.current=true;setActive(i);highlight(popup.items[i]);}
            else choose(popup.items[Math.min(active,popup.items.length-1)]);
        }
    }
    React.useEffect(()=>{
        if(typeof document==="undefined")return;
        const outside=e=>{clearHighlight();if(latest.current?.node===e.target || menuRef.current?.contains(e.target))return;close();};
        const reposition=e=>{if(e?.target?.classList?.contains("cc-prompt-duplicate-mirror"))return;clearHighlight();if(latest.current?.node)setPopup(p=>p?position(p):null);};
        const clear=()=>clearHighlight();
        document.addEventListener("pointerdown",outside,true);window.addEventListener("blur",clear);
        window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);
        return ()=>{document.removeEventListener("pointerdown",outside,true);window.removeEventListener("blur",clear);window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true);clearHighlight();};
    },[!!popup]);
    React.useEffect(()=>{if(!enabled||expandPhaseRef.current!=="idle")clearHighlight();});
    React.useEffect(()=>{if(!keyboardScrollRef.current)return;keyboardScrollRef.current=false;const row=menuRef.current?.querySelector('[data-active="true"]');if(row && row.parentElement){const list=row.parentElement;list.scrollTop=Math.max(0,Math.min(list.scrollTop,row.offsetTop));if(row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=row.offsetTop+row.offsetHeight-list.clientHeight;}},[active,popup?.items.length]);
    React.useEffect(()=>()=>{clearHighlight();request.current.seq++;clearTimeout(request.current.timer);request.current.controller?.abort();request.current.translation?.abort();},[]);
    const spinner=()=>h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:15}));
    return {
        close,
        props(kind) {return {
            role:"combobox","aria-autocomplete":"list","aria-controls":"cc-tag-completion",
            "aria-expanded":!!popup && popup.kind===kind,
            "aria-activedescendant":popup?.kind===kind && popup.items.length?"cc-tag-option-"+Math.min(active,popup.items.length-1):undefined,
            onKeyDown:keys,onKeyUp:e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){clearHighlight();inspect(kind,e.currentTarget,false);}},
            onClick:e=>inspect(kind,e.currentTarget,false),onScroll:()=>close(),
            onBlur:()=>{clearHighlight();setTimeout(()=>{if(typeof document==='undefined'||!menuRef.current?.contains(document.activeElement))close();},0);},
            onCompositionStart:()=>{composing.current=true;close();},
            onCompositionEnd:e=>{composing.current=false;inspect(kind,e.currentTarget);},
            onSelect:e=>{if(latest.current && (e.currentTarget.selectionStart!==latest.current.caret || e.currentTarget.selectionEnd!==latest.current.end))inspect(kind,e.currentTarget,false);},
        };},
        changed:inspect,
        render() {return popup && expandPhaseRef.current==="idle" && enabled ? floating(h("div",{
            id:"cc-tag-completion",ref:menuRef,"aria-label":"提示词候选",
            className:"dsh-comfy-floating cc-tag-completion",style:{...theme,position:"fixed",zIndex:2147480600,...popup.geometry},
            onMouseDown:e=>e.preventDefault(),onKeyDown:e=>{clearHighlight();if(e.key==='Escape'){e.preventDefault();const node=latest.current?.node;close();node?.focus();}}},
            h('div',{className:'cc-tag-query'},h('span',null,popup.relatedOnly?(popup.anchor?.label||popup.anchor?.output):'“'+popup.range.query+'”的候选'),h('span',null,popup.relatedOnly?'':popup.loading?'查询中':popup.items.filter(v=>!v.origin).length+' 项')),
            !popup.relatedOnly?h('div',{id:'cc-tag-options',className:'cc-tag-list',role:'listbox','aria-label':'补全与翻译候选'},
                popup.loading?h('div',{className:'cc-tag-empty',role:'status'},spinner(),'正在查询本地词库…'):null,
                !popup.loading&&!popup.items.filter(v=>!v.origin).length?h('div',{className:'cc-tag-empty'},popup.error||'本地词库未找到匹配项',h('small',null,'可使用下方机翻或 AI 翻译')):null,
                popup.items.map((item,i)=>h("button",{key:item.id,id:"cc-tag-option-"+i,role:"option",type:"button",tabIndex:-1,
                    "aria-selected":i===active,"data-active":i===active?"true":"false",className:"cc-tag-option",'data-cc-tooltip':[item.output,item.sense].filter(Boolean).join('\n'),
                    onMouseEnter:()=>{keyboardScrollRef.current=false;setActive(i);highlight(item);},onClick:()=>choose(item)},
                    item.origin?h('small',{className:'cc-tag-result-source'},item.origin+' · 点击插入'):null,
                    h("span",{className:"cc-tag-main"},item.kind==='tag'?item.output.replace(/_/g,' '):item.output),
                    h('span',{className:'cc-tag-meta'},completionTypes(item).map(type=>h('span',{key:type,className:'cc-tag-type'},type)),
                        h('span',null,(item.translations||[item.label]).filter(Boolean).slice(0,3).join(' / ')),
                        item.category?h('span',{className:'cc-tag-category'},'· '+item.category):null))),
                popup.translating?h('div',{className:'cc-tag-empty',role:'status'},spinner(),popup.translating==='ai'?'AI 正在翻译 · 推理已关闭':'正在本地翻译…'):null,
                popup.translationError?h('div',{className:'cc-tag-error',role:'alert'},popup.translationError):null):null,
            popup.relatedItems?.length?h('div',{className:'cc-tag-related'},
                h('div',{className:'cc-tag-related-heading'},'相关标签',h('small',{'data-cc-tooltip':'可选的描述搭配，不是同义翻译，不会自动添加'},'按需添加')),
                h('div',{className:'cc-tag-related-chips'},popup.relatedItems.map(item=>h('button',{key:item.id,type:'button',className:'cc-tag-related-chip',
                    'data-cc-tooltip':item.output.replace(/_/g,' '),onMouseEnter:()=>highlight(item),onMouseLeave:clearHighlight,onClick:()=>chooseRelated(item)},'+ ',item.label)))):null,
            !popup.relatedOnly?h('div',{className:'cc-tag-translate-actions'},['machine','ai'].map(method=>h('button',{key:method,type:'button',className:'cc-tag-translate',disabled:!!popup.translating,
                'aria-busy':popup.translating===method,'data-cc-tooltip':method==='ai'?'AI 翻译当前词语或描述，不扩写，关闭推理':'本地离线翻译当前词语或描述',onClick:()=>translate(method)},
                popup.translating===method?spinner():h(PromptIcon,{name:method==='ai'?'pencil':'language',size:15}),
                popup.translating===method?'翻译中…':method==='ai'?'AI 翻译':'机翻'))):null,
            h('div',{className:'cc-tag-key-hint'},popup.relatedOnly?'点击可连续添加　Esc 收起':'↑ ↓ 选择　Enter 插入　Esc 收起'))) : null;},
    };
}

function DictionaryPanel({theme,setMsg,ready,onRetry}) {
    const [query,setQuery]=React.useState(''),[category,setCategory]=React.useState(''),[own,setOwn]=React.useState(false),[showDisabled,setShowDisabled]=React.useState(false);
    const [items,setItems]=React.useState([]),[categories,setCategories]=React.useState([]),[total,setTotal]=React.useState(0),[offset,setOffset]=React.useState(0),[more,setMore]=React.useState(false),[revision,setRevision]=React.useState(0);
    const [loading,setLoading]=React.useState(false),[error,setError]=useErrorState(''),[status,setStatus]=React.useState(null);
    const [editor,setEditor]=React.useState(null),[editBusy,setEditBusy]=React.useState(false),[duplicates,setDuplicates]=React.useState(null),[confirm,setConfirm]=React.useState(null);
    const [showData,setShowData]=React.useState(false),[showMore,setShowMore]=React.useState(false);
    const [importKind,setImportKind]=React.useState('ffdkj'),[file,setFile]=React.useState(null),[license,setLicense]=React.useState('unconfirmed'),[version,setVersion]=React.useState('');
    const [job,setJob]=React.useState(null),[uploading,setUploading]=React.useState(false);
    const uploadRef=React.useRef(false),editorSeq=React.useRef(0),savingRef=React.useRef(false),alive=React.useRef(true);
    React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;uploadRef.current=false;editorSeq.current++;};},[]);
    React.useEffect(()=>{
        let dead=false;const controller=new AbortController();if(!ready)return;
        setLoading(true);setError('');setItems([]);setMore(false);
        const timer=setTimeout(async()=>{try{
            const rows=await dictionaryRequest('browse?q='+encodeURIComponent(query)+'&category='+encodeURIComponent(category)+'&limit=50&offset='+offset+'&own='+(own?1:0)+'&disabled='+(showDisabled?1:0),undefined,'GET',controller.signal);
            if(dead)return;
            if(offset && !rows.items.length && rows.total<=offset){setOffset(Math.max(0,Math.floor((rows.total-1)/50)*50));return;}
            setItems(rows.items);setTotal(rows.total);setMore(rows.has_more);
        }catch(e){if(!dead)setError(errText(e));}finally{if(!dead)setLoading(false);}},150);
        return()=>{dead=true;controller.abort();clearTimeout(timer);};
    },[ready,query,category,own,showDisabled,offset,revision]);
    React.useEffect(()=>{if(!ready)return;let dead=false;
        Promise.all([dictionaryRequest('categories?tags=1'),dictionaryRequest('status')]).then(([cats,info])=>{if(!dead){setCategories(cats.items);setStatus(info);}}).catch(e=>{if(!dead)setError(errText(e));});
        return()=>{dead=true;};
    },[ready,revision]);
    React.useEffect(()=>{
        if(!job?.id || !['queued','running'].includes(job.status))return;let dead=false,timer;
        const poll=async()=>{try{const next=await dictionaryRequest('imports/'+job.id);if(dead)return;setJob(next);
            if(['queued','running'].includes(next.status))timer=setTimeout(poll,700);else setRevision(v=>v+1);
        }catch(e){if(!dead){setError(errText(e));timer=setTimeout(poll,2000);}}};
        poll();return()=>{dead=true;clearTimeout(timer);};
    },[job?.id,job?.status]);
    React.useEffect(()=>{if(!status || job)return;const active=status.imports?.find(j=>['running','queued'].includes(j.status));if(active)setJob(active);},[status]);
    const refresh=()=>setRevision(v=>v+1),fail=e=>{if(alive.current)setError(errText(e));};
    const signature=v=>JSON.stringify([v.output,v.label,v.namesText,v.category,v.sense]);
    const dirty=editor && signature(editor)!==editor.initial;
    function select(item=null){
        editorSeq.current++;setDuplicates(null);setError('');
        const next=item?{...item,namesText:(item.translations||[]).filter(v=>v!==item.label).join('、')}:{kind:'tag',output:'',label:'',namesText:'',category:category||'自定义',sense:'',source:'user'};
        next.initial=signature(next);setEditor(next);
    }
    function openEditor(item=null){if(savingRef.current)return;if(dirty){setConfirm({action:'select',item});return;}select(item);}
    function closeEditor(){if(savingRef.current)return;if(dirty){setConfirm({action:'close'});return;}editorSeq.current++;setEditor(null);setDuplicates(null);}
    function change(key,value){setEditor(v=>({...v,[key]:value}));setDuplicates(null);setError('');}
    function names(v){return [...new Set((v||'').split(/[,，、;；\n]/).map(s=>s.trim()).filter(Boolean))];}
    async function saveEditor(allow=false){
        if(savingRef.current || !editor)return;
        const current={...editor},seq=editorSeq.current;
        if(!current.output.trim() || !current.label.trim()){setError('请填写英文标签和中文名称');return;}
        if(/[,，。\n\r]/.test(current.output)){setError('请一次添加一个标签，不要输入整段提示词');return;}
        savingRef.current=true;setEditBusy(true);setError('');
        try{
            const initial=JSON.parse(current.initial);
            if(!allow && (!current.id || current.output!==initial[0] || current.label!==initial[1])){
                const found=await dictionaryRequest('duplicates?english='+encodeURIComponent(current.output.trim())+'&chinese='+encodeURIComponent(current.label.trim())+'&exclude='+(current.id||0));
                if(!alive.current || seq!==editorSeq.current)return;
                if(found.items.length || found.has_more){setDuplicates(found);return;}
            }
            const body={kind:'tag',maintenance:true,allow_new_sense:allow,output:current.output.trim(),label:current.label.trim(),category:current.category.trim()||'自定义',names:names(current.namesText),sense:current.sense||current.label,model:current.model||'*'};
            const result=await dictionaryRequest('custom-entry'+(current.id?'/'+current.id:''),body,current.id?'PATCH':'POST');
            if(!alive.current || seq!==editorSeq.current)return;
            const saved={...current,...body,id:result.id,namesText:body.names.join('、')};saved.initial=signature(saved);setEditor(saved);setDuplicates(null);refresh();setMsg(current.id?'标签已保存':'标签已添加');
        }catch(e){if(seq===editorSeq.current)fail(e);}finally{savingRef.current=false;if(alive.current)setEditBusy(false);}
    }
    async function entryAction(action){
        if(!editor || savingRef.current)return;savingRef.current=true;setEditBusy(true);setError('');const seq=editorSeq.current,current=editor;
        try{const body=action==='reset'?{reset_override:true}:{disabled:!current.disabled};
            await dictionaryRequest('custom-entry/'+current.id,body,action==='delete'?'DELETE':'PATCH');
            if(!alive.current||seq!==editorSeq.current)return;setEditor(null);setDuplicates(null);setConfirm(null);refresh();setMsg(action==='delete'?'标签已删除':action==='reset'?'已撤销修改':current.disabled?'标签已恢复':'标签已隐藏');
        }catch(e){fail(e);}finally{savingRef.current=false;if(alive.current)setEditBusy(false);}
    }
    async function importFile() {
        let uploadId=null;
        if(!file || uploadRef.current)return;
        uploadRef.current=true;setUploading(true);setError("");
        try {
            if(file.size>256*1024*1024)throw new Error("文件超过 256 MiB");
            const upload=await dictionaryRequest("uploads",{size:file.size});uploadId=upload.upload_id;
            for(let offset=0;offset<file.size;offset+=512*1024) {
                if(!uploadRef.current)throw new Error("已取消上传");
                const bytes=new Uint8Array(await file.slice(offset,offset+512*1024).arrayBuffer());
                if(!uploadRef.current)throw new Error("已取消上传");
                let bin="";for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
                await dictionaryRequest("uploads/"+upload.upload_id,{offset,data:btoa(bin)});
                setJob({status:"uploading",processed:Math.min(offset+bytes.length,file.size),total:file.size,detail:"上传 SQLite…"});
            }
            if(!uploadRef.current)throw new Error("已取消上传");
            const result=await dictionaryRequest("import",{upload_id:upload.upload_id,kind:importKind,license,version});
            setJob({...result,processed:0,total:0,detail:"检查文件…"});
        }catch(e){if(uploadId)await dictionaryRequest("uploads/"+uploadId+"/cancel",{}).catch(()=>{});fail(e);setJob(null);}finally{uploadRef.current=false;setUploading(false);}
    }
    const button=(label,onClick,disabled=false,primary=false)=>h('button',{type:'button',style:primary?S.btn:S.btn2,onClick,disabled},label);
    const field=(label,node)=>h('label',{className:'cc-dict-field'},h('span',{style:S.label},label),node);
    const editInput=(key,label,placeholder='',disabled=false)=>field(label,h('input',{style:{...S.inp,width:'100%',minWidth:0},'aria-label':label,value:editor?.[key]||'',placeholder,disabled:editBusy||disabled,onChange:e=>change(key,e.target.value)}));
    const external=editor?.source!=='user';
    function duplicateView(){
        if(!duplicates)return null;
        const key=v=>String(v).normalize('NFKC').toLowerCase().replace(/_/g,' ').trim().replace(/\s+/g,' ');
        const same=duplicates.items.filter(i=>key(i.output)===key(editor.output));
        const exactRows=same.filter(i=>(i.translations||[i.label]).some(t=>key(t)===key(editor.label)));
        const exact=exactRows.length>0;
        return h('div',{className:'cc-dict-duplicates',role:'status'},h('strong',null,exact?'这个标签已经存在':same.length?'发现相同英文标签':'发现相同中文名称'),
            (exact?exactRows:duplicates.items).map(i=>h('div',{key:i.id,className:'cc-dict-toolbar'},h('span',null,i.output+' · '+i.label+(i.disabled?'（已隐藏）':'')),
                button(exact?'查看已有标签':'编辑这个标签',()=>select(i),editBusy),
                same.includes(i)&&!exact?button('补充到这个标签',()=>{const draft=editor;select(i);setEditor(v=>({...v,namesText:[...new Set([...(i.translations||[]).filter(t=>t!==i.label),draft.label,...names(draft.namesText)])].join('、')}));setDuplicates(null);},editBusy):null)),
            duplicates.has_more?h('small',null,'匹配较多，请用完整名称搜索后确认。'):null,
            !exact?button(editor.id?'仍然保存修改':same.length?'添加另一种含义':'仍然添加',()=>saveEditor(true),editBusy||duplicates.has_more,true):null);
    }
    function editorForm(){return h(React.Fragment,null,
        error?h('div',{role:'alert',style:S.bad},error):null,
        h('div',{className:'cc-dict-form'},editInput('output','英文标签','例如 long hair',!!editor.id&&external),editInput('label','中文名称','例如 长发'),editInput('namesText','其他叫法（选填）','用顿号分隔，例如 长头发、长头毛'),editInput('category','分类（选填）','例如 发型')),
        h('details',null,h('summary',{className:'cc-summary'},'更多设置'),
            editInput('sense','含义说明（选填）','说明这个标签的含义',external&&!!editor.id),
            h('small',{style:S.dim},external?'导入标签 · 修改会保留，更新词库不会覆盖。':'我添加的标签'),
            editor.id&&external?button('撤销我的修改',()=>setConfirm({action:'reset'}),editBusy):null),
        duplicateView(),
        h('div',{className:'cc-dict-toolbar cc-dict-edit-actions'},
            editor.id?button(external?(editor.disabled?'恢复此标签':'隐藏此标签'):'删除标签',()=>setConfirm({action:external?'hide':'delete'}),editBusy):null,
            button('取消',closeEditor,editBusy),button(editBusy?'保存中…':editor.id?'保存修改':'添加',()=>saveEditor(),editBusy||!editor.output.trim()||!editor.label.trim(),true)));
    }
    return h('div',{className:'cc-dictionary'},
        h('div',{className:'cc-dict-toolbar cc-dict-header'},h('strong',null,'词库'),
            h('div',{className:'cc-dict-header-actions'},button('添加标签',()=>openEditor(),!ready,true),button('更新词库',()=>setShowData('update'),!ready),
                button('更多',()=>setShowMore(true),!ready))),
        !ready?h('div',{role:'status',style:S.warn},'词库尚未就绪。',button('重试连接与迁移',onRetry)):null,
        error&&!editor?h('div',{role:'alert',style:S.bad},error):null,
        h('div',{className:'cc-dict-maintenance'},h('section',{className:'cc-dict-list-pane'},
            h('div',{className:'cc-dict-filterbar'},h('input',{type:'search',style:{...S.inp,width:'100%',minWidth:0},value:query,placeholder:'搜索英文、中文或其他叫法','aria-label':'搜索词库',onChange:e=>{setQuery(e.target.value);setOffset(0);}}),
                h(SelectMenu,{theme,label:'词库分类',options:[{value:'',label:'全部分类'},...categories.map(c=>({value:c.name,label:c.name}))],value:category,onChange:v=>{setCategory(v);setOffset(0);}})),
            h('div',{className:'cc-dict-toolbar'},...[false,true].map(v=>h('button',{type:'button',key:String(v),style:S.btn2,'aria-pressed':own===v,onClick:()=>{setOwn(v);setOffset(0);}},v?'我添加的':'全部标签')),
                h(Switch,{checked:showDisabled,onChange:v=>{setShowDisabled(v);setOffset(0);},label:'显示隐藏标签'})),
            h('div',{className:'cc-dict-table-head'},h('span',null,'英文标签 · A–Z'),h('span',null,'中文名称'),h('span',null,'分类')),
            h('div',{className:'cc-dict-results','aria-busy':loading},items.map(item=>h('button',{key:item.id,type:'button',className:'cc-dict-tag-row','aria-pressed':editor?.id===item.id,disabled:editBusy,onClick:()=>openEditor(item)},
                h('span',null,item.output),h('span',null,item.label+(item.disabled?'（已隐藏）':'')),h('small',null,item.category))),
                !items.length?h('div',{style:S.dim,role:'status'},loading?'加载中…':'没有找到标签',!loading&&ready?button('添加标签',()=>openEditor()):null):null),
            h('div',{className:'cc-dict-toolbar cc-dict-pagination'},h('small',{style:S.dim},loading?'加载中…':total?'第 '+(offset+1)+'–'+Math.min(offset+items.length,total)+' 条 / 共 '+total+' 条':'共 0 条'),
                button('上一页',()=>setOffset(v=>Math.max(0,v-50)),!offset||loading),button('下一页',()=>setOffset(v=>v+50),!more||loading))),
            h('section',{className:'cc-dict-edit-pane','aria-label':'编辑标签'},editor?.id?h(React.Fragment,null,h('strong',null,'编辑标签'),editorForm()):h('div',{className:'cc-dict-empty'},h('strong',null,'选择一个标签进行编辑'),h('span',{style:S.dim},'也可以添加新的英文标签和中文名称。'),button('添加标签',()=>openEditor(),!ready)))),
        editor&&!editor.id?h(OverlayModal,{title:'添加标签',theme,width:560,onClose:closeEditor},editorForm()):null,
        confirm?h(OverlayModal,{title:confirm.action==='delete'?'删除这个标签？':confirm.action==='reset'?'撤销对这个标签的修改？':confirm.action==='hide'?(editor?.disabled?'恢复这个标签？':'隐藏这个标签？'):'放弃未保存的修改？',theme,width:430,onClose:()=>{if(!editBusy)setConfirm(null);}},
            h('div',{className:'cc-dict-toolbar'},button('取消',()=>setConfirm(null),editBusy),button(editBusy?'处理中…':'确定',()=>{const c=confirm;if(['delete','reset','hide'].includes(c.action))entryAction(c.action);else{setConfirm(null);if(c.action==='select')select(c.item);else{editorSeq.current++;setEditor(null);setDuplicates(null);}}},editBusy,true))):null,
        showMore?h(OverlayModal,{title:'词库管理',theme,width:430,onClose:()=>setShowMore(false)},h('div',{className:'cc-dict-toolbar'},
            button('备份与恢复',()=>{setShowMore(false);setShowData('backup');}),
            h('small',{style:S.dim},'旧提示词片段单独保留在备份中，不会被标签编辑覆盖。'))):null,
        showData?h(OverlayModal,{title:showData==='backup'?"备份与恢复":"更新词库",theme,width:700,onClose:()=>setShowData(false)},
            error?h("div",{role:"alert",style:S.bad},error):null,
            showData==='backup'?h(React.Fragment,null,
            status?h("small",{style:S.dim},status.counts.entries+" 条词条 · "+status.counts.tag_aliases+" 个别名 · "+status.counts.tag_implications+" 个蕴含关系",h("span",{className:"cc-dict-db-path"},status.db_path)):null,
            h("div",{className:"cc-dict-toolbar"},
                button("创建 SQLite 备份",async()=>{try{const r=await dictionaryRequest("backup",{});setMsg("备份已保存："+r.path);}catch(e){fail(e);}}),
                button("导出用户 JSON",async()=>{try{const data=await dictionaryRequest("export");const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="dsh-tag-library-user.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){fail(e);}}),
                h("label",{className:"cc-dict-json-import"},"导入用户 JSON",h("input",{type:"file",accept:".json",onChange:async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024)throw new Error("JSON 超过 8 MiB");const r=await dictionaryRequest("restore-user",JSON.parse(await f.text()));refresh();setMsg("用户词库已导入"+(r.unresolved_source_links?"；有 "+r.unresolved_source_links+" 个来源关系未恢复，请先导入对应数据源后重试 JSON":""));}catch(ex){fail(ex);}}})))) : h(React.Fragment,null,
            h("strong",null,"导入词库更新"),
            h("small",{style:S.dim},"选择已下载的 SQLite。仅导入 active 关系；不会自动下载或随插件分发数据集。"),
            h("div",{className:"cc-dict-form"},
            field("数据集类型",h(SelectMenu,{theme,label:"数据集类型",value:importKind,onChange:setImportKind,options:[{value:"ffdkj",label:"Danbooru 中英库（ffdkj）"},{value:"grio43",label:"Danbooru Alias / Implication（grio43）"}]})),
            field("SQLite 文件",h("input",{type:"file",accept:".sqlite,.sqlite3,.db",disabled:uploading,onChange:e=>setFile(e.target.files?.[0] || null)}))
            ),
            h("details",null,h("summary",{className:"cc-summary"},"高级导入选项"),h("div",{className:"cc-dict-form"},field("来源版本（可空）",h("input",{style:S.inp,value:version,onChange:e=>setVersion(e.target.value)})),
                field("许可记录",h("input",{style:S.inp,value:license,onChange:e=>setLicense(e.target.value),placeholder:"未确认请保留 unconfirmed"})))),
            h("div",{className:"cc-dict-toolbar"},button(uploading?"上传中…":"导入 SQLite",importFile,!file || uploading || ["queued","running"].includes(job?.status)),
                uploading?button("取消上传",()=>{uploadRef.current=false;}):null,
                job?.id && ["queued","running"].includes(job.status)?button("取消导入",async()=>{try{setJob(await dictionaryRequest("imports/"+job.id+"/cancel",{}));}catch(e){fail(e);}}):null),
            job?h("div",{role:"status"},job.status+" · "+job.processed+" / "+job.total+" · "+job.detail):null,
            status?.imports?.slice(0,3).map(r=>h("small",{key:r.id,style:S.dim},r.status+" · "+r.processed+" 条 · "+r.sha256.slice(0,12))))) : null);
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

function OutputPreviewPicker({item,theme,onClose,onSaved,targetKind='base'}){
    const [data,setData]=React.useState(null),[error,setError]=useErrorState(''),[selected,setSelected]=React.useState(''),[busy,setBusy]=React.useState(false);
    const alive=React.useRef(true),posting=React.useRef(false);
    const source={path:item.path||'',image:item.imageInfo,prompt_id:item.promptId};
    const key=row=>JSON.stringify([row.kind,row.name,row.root_id]);
    const filtered=rows=>(rows||[]).filter(row=>targetKind==='lora'?row.kind==='lora':['checkpoint','diffusion'].includes(row.kind));
    React.useEffect(()=>{alive.current=true;const ctl=new AbortController();
        setData(null);setSelected('');setError('');
        jpost(EXPANDER+'/outputs/preview-targets',source,30000,ctl.signal).then(r=>{if(!alive.current)return;const next={...r,items:filtered(r.items)};setData(next);if(next.items.length===1)setSelected(key(next.items[0]));}).catch(e=>{if(alive.current&&!ctl.signal.aborted)setError(errText(e));});
        return()=>{alive.current=false;ctl.abort();};
    },[outputKey(item),targetKind]);
    async function save(){if(posting.current)return;const target=data?.items.find(r=>key(r)===selected);if(!target)return;posting.current=true;setBusy(true);setError('');
        try{const saved=await jpost(EXPANDER+'/outputs/add-preview',{...source,target},60000);if(alive.current){onSaved(target,saved);onClose();}}
        catch(e){if(alive.current)setError(errText(e));}finally{posting.current=false;if(alive.current)setBusy(false);}}
    return h(OverlayModal,{title:targetKind==='lora'?'保存为 LoRA 预览图':'保存为底模预览图',theme,width:620,zIndex:2147483500,onClose:()=>{if(!posting.current)onClose();}},
        error?h('div',{role:'alert',style:S.bad},error):null,
        !data&&!error?h('div',{role:'status'},h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner',size:15})),' 正在核验这张图片使用的模型…'):null,
        data?h(React.Fragment,null,h('span',{style:S.dim},targetKind==='lora'?'选择这张图片实际使用的 LoRA':'选择这张图片实际使用的底模'),
            data.items.length?h('div',{className:'cc-output-preview-targets'},data.items.map(row=>h('label',{key:key(row),className:'cc-output-preview-target'},
                h('input',{type:'radio',name:'preview-target',checked:selected===key(row),disabled:busy,onChange:()=>setSelected(key(row))}),h('span',null,h('strong',null,row.name),h('small',null,(row.label||row.kind)+' · '+row.path))))):h('div',{role:'status',style:S.dim},targetKind==='lora'?'没有可确认的本地 LoRA。':'没有可确认的本地底模。'),
            data.warnings?.length?h('details',null,h('summary',{className:'cc-summary'},'部分模型不可选'),data.warnings.map((w,i)=>h('div',{key:i,style:S.dim},w))):null):null,
        h('div',{className:'cc-dict-toolbar',style:{justifyContent:'flex-end'}},h('button',{type:'button',style:S.btn2,onClick:onClose,disabled:busy},'取消'),h('button',{type:'button',style:S.btn,onClick:save,disabled:busy||!selected},busy?'正在保存…':'保存预览图')));
}

function ModelPreviewEditor({model,theme,onClose,onChanged}){
    const [previews,setPreviews]=React.useState(null),[error,setError]=useErrorState(''),[busy,setBusy]=React.useState(false),[selectedKey,setSelectedKey]=React.useState(''),[confirmDelete,setConfirmDelete]=React.useState(false),[dimensions,setDimensions]=React.useState({}),[failed,setFailed]=React.useState({}),[retry,setRetry]=React.useState(0);
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
    const art=h('span',{className:'cc-model-dock-art cc-model-dock-art--'+variant},url&&failed!==url?h('img',{src:url,alt:(variant==='main'?'主模型':kind==='clip'?'文本编码器':kind==='vae'?'VAE':'LoRA')+' 本地预览图',decoding:'async',onLoad:variant==='lora-hover'?e=>{const w=e.currentTarget.naturalWidth,hh=e.currentTarget.naturalHeight;if(w&&hh){const scale=Math.min(240/w,300/hh,1),box=e.currentTarget.parentElement;box.style.width=Math.max(1,Math.round(w*scale))+'px';box.style.height=Math.max(1,Math.round(hh*scale))+'px';}}:undefined,onError:()=>setFailed(url)}):h(PromptIcon,{name:'image',size:variant==='main'?26:20}));
    if(variant!=='main')return art;
    return h('span',{className:'cc-model-main-art'},art);
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
function outputKey(x){return x?.path||x?.url||x?.promptId||x?.id||x?.filename||"unknown-output";}
/** Same picture may arrive from the session list and the saved-files list with different ids. */
function sameOutput(a,b){
    if(!a||!b)return false;
    const fields=x=>[x.path,x.url,x.promptId,x.id,x.filename].filter(v=>v!==undefined&&v!==null&&v!=="");
    const keys=fields(b);
    return fields(a).some(v=>keys.includes(v));
}
function mergeOutputCollections(sessionItems,savedItems){
    const keys=new Set(),merged=[];
    for(const x of [...(sessionItems||[]),...(savedItems||[])]){
        const key=outputKey(x);
        if(!key||keys.has(key))continue;
        keys.add(key);merged.push(x);
    }
    merged.sort((a,b)=>(Number(b?.createdAt)||Number(b?.mtime)*1000||0)-(Number(a?.createdAt)||Number(a?.mtime)*1000||0));
    return merged;
}

/** Row-first masonry: next image enters the shortest available column, rather than filling one entire column before the next. */
function outputMasonryLayout(items,availableWidth,gap=8,minColumnWidth=220,maxColumns=Infinity,large=false){
    const width=Math.max(180,availableWidth||900),cols=Math.max(1,Math.min(maxColumns,Math.floor((width+gap)/(minColumnWidth+gap))));
    const cellWidth=(width-gap*(cols-1))/cols,heights=Array(cols).fill(0),positions=[];
    for(const item of items){
        const w=Number(item.width)>0?Number(item.width):1,h=Number(item.height)>0?Number(item.height):1;
        const span=large&&cols>=2?2:1;
        if(span===2){
            let col=0,bestSum=Infinity;
            for(let j=0;j<cols-1;j++){const sum=heights[j]+heights[j+1];if(sum<bestSum){bestSum=sum;col=j;}}
            const spanWidth=2*cellWidth+gap,imageHeight=spanWidth*Math.min(6,Math.max(.12,h/w));
            positions.push({left:col*(cellWidth+gap),top:heights[col],width:spanWidth});
            heights[col]+=imageHeight+gap;heights[col+1]+=imageHeight+gap;
        }else{
            let col=0;for(let j=1;j<cols;j++)if(heights[j]<heights[col])col=j;
            const imageHeight=cellWidth*Math.min(6,Math.max(.12,h/w));
            positions.push({left:col*(cellWidth+gap),top:heights[col],width:cellWidth});
            heights[col]+=imageHeight+gap;
        }
    }
    return {positions,height:Math.max(0,...heights)- (items.length?gap:0),columns:cols};
}
function OutputMasonry({items,renderCard,gap=8,minColumnWidth=220,maxColumns=Infinity,className="",large=false}){
    const ref=React.useRef(null),[width,setWidth]=React.useState(0);
    React.useEffect(()=>{
        const el=ref.current;if(!el)return;
        const update=()=>setWidth(el.clientWidth||0);update();
        if(typeof ResizeObserver==='undefined')return;
        const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
    },[]);
    const layout=outputMasonryLayout(items,width,gap,minColumnWidth,maxColumns,large);
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

// Save original output bytes; never round-trip through canvas (PNG metadata matters).
function outputSaveFilename(item){
 const raw=String(item?.filename||item?.imageInfo?.filename||item?.path?.split(/[\\/]/).pop()||'ComfyUI.png');
 const name=raw.split(/[\\/]/).pop().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'')||'ComfyUI.png';
 return /\.(png|jpe?g|webp|bmp|gif)$/i.test(name)?name:name+'.png';
}
async function outputOriginalBlob(item,signal){
 const source=new URL(item?.path?savedOutputUrl(item.path):item?.url||viewUrl(item.imageInfo),window.location.href),comfy=new URL(COMFY);
 const url=source.origin===comfy.origin&&source.pathname==='/view'?EXPANDER+'/proxy/view'+source.search:source.href;
 await requireCompatibleSidecar(url);if(signal?.aborted)throw new DOMException('已取消','AbortError');
 const response=await fetch(url,{signal,cache:'no-store',headers:url.startsWith(EXPANDER+'/')?instanceHeaders():{}});
 if(!response.ok)throw Error('无法读取原始图片，请确认文件仍在且服务在线');
 const blob=await response.blob();if(!blob.size)throw Error('原始图片为空，无法另存为');return blob;
}
async function outputChooseSaveTarget(item){
 const name=outputSaveFilename(item),extension='.'+name.split('.').pop().toLowerCase(),mime=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.bmp':'image/bmp','.gif':'image/gif'})[extension];
 if(typeof window.showSaveFilePicker==='function')try{return await window.showSaveFilePicker({suggestedName:name,types:[{description:'图片',accept:{[mime]:[extension]}}]});}
 catch(error){if(error.name==='AbortError')throw error;if(!['SecurityError','NotAllowedError','NotSupportedError'].includes(error.name))throw error;}
 return null;
}
async function outputWriteSavedBlob(blob,name,handle,signal){
 if(signal?.aborted)throw new DOMException('已取消','AbortError');
 if(handle){const stream=await handle.createWritable();try{await stream.write(blob);if(signal?.aborted)throw new DOMException('已取消','AbortError');await stream.close();}catch(error){try{await stream.abort();}catch{}throw error;}return 'saved';}
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=outputSaveFilename({filename:name});link.style.display='none';document.body.appendChild(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}return 'download';
}
async function saveOutputAs(item,signal){const target=await outputChooseSaveTarget(item),blob=await outputOriginalBlob(item,signal);return outputWriteSavedBlob(blob,outputSaveFilename(item),target,signal);}

function OutputViewerActions({item,onEdit,onInpaint,onReference,onApply,onPreview,onOpen,onDelete,onRetry,hasLora=false,editing=false,imageError=''}){
 const [menu,setMenu]=React.useState(''),[saving,setSaving]=React.useState(false),[error,setError]=useErrorState('');
 const menuHost=React.useRef(null),trigger=React.useRef(null),alive=React.useRef(true),task=React.useRef(null);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;task.current?.abort();};},[]);
 React.useEffect(()=>{if(!menu)return;const dismiss=e=>{if(!menuHost.current?.contains(e.target))setMenu('');};const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setMenu('');trigger.current?.focus();}};document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',key,true);};},[menu]);
 async function saveAs(){if(task.current)return;const ctl=new AbortController();task.current=ctl;setSaving(true);setError('');try{const state=await saveOutputAs(item,ctl.signal);if(alive.current&&!ctl.signal.aborted)notifyError(state==='saved'?'图片已另存为':'已交给浏览器保存',{title:'另存为',severity:'success'});}catch(error){if(alive.current&&!ctl.signal.aborted&&error.name!=='AbortError')setError('另存为失败：'+errText(error));}finally{if(task.current===ctl){task.current=null;if(alive.current)setSaving(false);}}}
 const button=(label,icon,action,disabled=false,danger=false)=>h('button',{key:label,type:'button',className:'cc-output-action-button'+(danger?' is-danger':''),'aria-label':label,'data-cc-tooltip':label,disabled,onClick:e=>{setMenu('');action?.(e);}},icon==='spinner'?h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:icon,size:18})):h(PromptIcon,{name:icon,size:18}));
 const menuKey=e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const items=[...menuHost.current.querySelectorAll('[role="menuitem"]')],at=items.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();};
 const dropdown=(kind,label,icon,options,disabled=false)=>h('div',{className:'cc-output-preview-anchor',onKeyDown:menuKey},
  h('button',{type:'button',className:'cc-output-action-button','aria-label':label,'data-cc-tooltip':label,'aria-haspopup':'menu','aria-expanded':menu===kind,disabled,onClick:e=>{trigger.current=e.currentTarget;setMenu(v=>v===kind?'':kind);},onKeyDown:e=>{if(e.key==='ArrowDown'){e.preventDefault();trigger.current=e.currentTarget;setMenu(kind);requestAnimationFrame(()=>menuHost.current?.querySelector('[role="menuitem"]')?.focus());}}},h(PromptIcon,{name:icon,size:18})),
  menu===kind?h('div',{className:'cc-output-preview-menu',role:'menu','aria-label':label},...options.map(([text,action])=>h('button',{key:text,type:'button',role:'menuitem',onClick:()=>{setMenu('');action();}},text))):null);
 return h('div',{ref:menuHost,className:'cc-output-stage-actions','data-cc-output-preview-open':menu?'true':undefined,onPointerDown:e=>e.stopPropagation(),onDoubleClick:e=>e.stopPropagation(),onWheel:e=>e.stopPropagation()},
  h('div',{className:'cc-output-action-bar',role:'toolbar','aria-label':'当前图片操作'},
    h('div',{className:'cc-output-action-group'},dropdown('image','图片编辑',editing?'spinner':'pencil',[['图片编辑器',onEdit],['局部重绘',onInpaint],['图生图',onReference]],editing||!item?.url),button('套用此图工作流','sliders',onApply,!item?.params),dropdown('preview','保存为预览图','image',[['底模预览图',()=>onPreview('base')],...(hasLora?[['LoRA 预览图',()=>onPreview('lora')]]:[])],!item?.url)),
   h('div',{className:'cc-output-action-group'},onRetry?button('重试保存','reset',onRetry):null,button('打开所在位置','folder',onOpen,!item?.path),button(saving?'正在另存为…':'另存为',saving?'spinner':'saveAs',saveAs,saving||!item?.url),button(item?.path?'删除图片':'移除 Temp 记录','trash',onDelete,false,true))),
  error||imageError?h('div',{className:'cc-output-action-error',role:'alert'},error||imageError):null);
}

function OutputInspector({item,theme,onStage,onClose,onPrev,onNext,canPrev,canNext,children,imageActions,imageOnly=false,label="输出图片查看器",counter=""}){
    const viewerRef=React.useRef(null),stageRef=React.useRef(null),dragRef=React.useRef(null),actions=React.useRef({}),[scale,setScale]=React.useState(1),[pan,setPan]=React.useState({x:0,y:0}),[failed,setFailed]=React.useState(false);
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
            if(e.key==='Escape'&&viewer?.querySelector('[data-cc-output-preview-open="true"]'))return;
            if(e.key!=='Tab'&&e.key!=='Escape'&&e.target?.closest?.('.cc-output-preview-menu'))return;
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
            imageActions||null,
            h("button",{type:"button",className:"cc-output-inspector-nav is-prev","aria-label":"上一张",disabled:!canPrev,onPointerDown:e=>e.stopPropagation(),onClick:e=>{e.stopPropagation();if(canPrev)onPrev();}},h(PromptIcon,{name:"chevronLeft",size:23})),
            item?.note&&stages.length<2?h('div',{className:'cc-stage-toolbar'},item.note):null,
            stages.length>1?h('div',{className:'cc-stage-toolbar',onPointerDown:e=>e.stopPropagation()},h('select',{'aria-label':'查看处理阶段',value:activeStage,onChange:e=>{const stage=stages.find(s=>s.index===Number(e.target.value));if(stage)onStage?.(stageOutput(item,stage));}},stages.map(s=>h('option',{key:s.node||s.index,value:s.index},s.label))),item?.note?h('small',null,item.note):null):null,
            h("img",{className:"cc-output-inspector-image",src:item?.url,alt:item?.filename||"输出图片",draggable:false,onError:()=>setFailed(true),style:{transform:`translate3d(${pan.x}px,${pan.y}px,0) scale(${scale})`}}), 
            failed?h("span",{role:"status",className:"cc-output-inspector-error"},"图片无法显示"):null,
            h("button",{type:"button",className:"cc-output-inspector-nav is-next","aria-label":"下一张",disabled:!canNext,onPointerDown:e=>e.stopPropagation(),onClick:e=>{e.stopPropagation();if(canNext)onNext();}},h(PromptIcon,{name:"chevronRight",size:23})),
            h("div",{className:"cc-output-inspector-zoom"},counter?counter+" · ":"",scale===1?"适应窗口":Math.round(scale*100)+"%"," · 滚轮缩放",scale>1?" · 拖拽移动":""," · 双击复位")),
        !imageOnly?h("aside",{className:"cc-output-inspector-info"},children):null));
}


/**
 * 隐藏「整页」滚动条，但不改动任何模块/列表内部的滚动条，也不禁用滚轮。
 * 插件根、它的宿主滚动祖先和 document.scrollingElement 才属于页面级容器。
 * 宿主容器跨页面复用，因此标记与样式保留到 DSH 本次运行结束。
 */
const PAGE_SCROLL_ATTR = "data-cc-page-scrollbar";
const instantTooltipDocuments=new WeakMap();
function installInstantTooltips(root){
 const doc=root?.ownerDocument;if(!doc?.body||!doc.addEventListener)return()=>{};
 const existing=instantTooltipDocuments.get(doc);if(existing){existing.users++;return()=>existing.release();}
 const scope='.dsh-comfy-ui,.dsh-comfy-floating',tracked=new Set();let owner=null,tip=null,descriptionId=null,previousDescription=null;
 const eligible=element=>element?.nodeType===1&&!!element.closest(scope);
 function migrate(element){if(!eligible(element)||!element.hasAttribute('title'))return;const title=element.getAttribute('title');if(!title){element.removeAttribute('data-cc-native-title');tracked.delete(element);}if(title){element.setAttribute('data-cc-native-title',title);tracked.add(element);if(element.matches('button,input,select,textarea')&&!element.hasAttribute('aria-label')&&!element.textContent.trim())element.setAttribute('aria-label',title);}element.removeAttribute('title');}
 function scan(node){if(node.nodeType!==1)return;migrate(node);node.querySelectorAll('[title]').forEach(migrate);}
 function restore(element){const saved=element.getAttribute('data-cc-native-title');if(saved&&!element.hasAttribute('title'))element.setAttribute('title',saved);element.removeAttribute('data-cc-native-title');tracked.delete(element);}
 function hide(){if(owner&&descriptionId){if(previousDescription===null)owner.removeAttribute('aria-describedby');else owner.setAttribute('aria-describedby',previousDescription);}owner=null;descriptionId=null;previousDescription=null;tip?.remove();tip=null;}
 function place(){if(!owner?.isConnected){hide();return;}const view=doc.defaultView,rect=owner.getBoundingClientRect(),box=tip.getBoundingClientRect(),width=view.innerWidth,height=view.innerHeight;let x=rect.left+(rect.width-box.width)/2,y=rect.bottom+7;if(y+box.height>height-8)y=rect.top-box.height-7;tip.style.left=Math.max(8,Math.min(width-box.width-8,x))+'px';tip.style.top=Math.max(8,Math.min(height-box.height-8,y))+'px';}
 function show(element){
  if(!eligible(element))return;let node=element;while(node&&eligible(node)){migrate(node);if(node.hasAttribute('data-cc-tooltip'))node.setAttribute('data-cc-tooltip-managed','true');node=node.parentElement;}
  const text=element.getAttribute('data-cc-tooltip')||element.getAttribute('data-cc-native-title');if(!text?.trim()){if(owner===element)hide();return;}if(owner===element&&tip?.textContent===text)return;hide();owner=element;
  const colors=doc.defaultView.getComputedStyle(element),get=(key,fallback)=>colors.getPropertyValue(key).trim()||fallback;
  tip=doc.createElement('div');tip.setAttribute('role','tooltip');tip.setAttribute('data-cc-instant-tooltip','true');tip.textContent=text;tip.id='cc-tooltip-'+Math.random().toString(36).slice(2);descriptionId=tip.id;previousDescription=owner.getAttribute('aria-describedby');owner.setAttribute('aria-describedby',[previousDescription,descriptionId].filter(Boolean).join(' '));
  Object.assign(tip.style,{position:'fixed',zIndex:'2147483647',pointerEvents:'none',maxWidth:'min(360px,calc(100vw - 16px))',whiteSpace:'pre-line',overflowWrap:'anywhere',boxSizing:'border-box',padding:get('--cc-tooltip-padding','6px 9px'),border:'1px solid '+get('--cc-tooltip-border',get('--cc-border','#555')),borderRadius:get('--cc-tooltip-radius','6px'),background:get('--cc-tooltip-bg',get('--cc-surface','#252525')),color:get('--cc-tooltip-text',get('--cc-text','#eee')),fontFamily:colors.fontFamily,fontSize:get('--cc-tooltip-font-size','12px'),lineHeight:'1.4',boxShadow:'0 4px 14px #0003',transition:'none'});doc.body.append(tip);place();
 }
 function target(event){const path=event.composedPath?.()||[event.target];for(const element of path){if(!eligible(element))continue;return element.closest('[data-cc-tooltip],[title],[data-cc-native-title]');}return null;}
 const over=e=>{const element=target(e);if(element)show(element);else hide();},out=e=>{if(owner&&!owner.contains(e.relatedTarget))hide();},focus=e=>{const element=target(e);if(element)show(element);else hide();},key=e=>{if(e.key==='Escape')hide();},view=doc.defaultView;
 scan(root);doc.querySelectorAll(scope).forEach(scan);
 doc.addEventListener('pointerover',over,true);doc.addEventListener('pointerout',out,true);doc.addEventListener('focusin',focus,true);doc.addEventListener('focusout',hide,true);doc.addEventListener('pointerdown',hide,true);doc.addEventListener('keydown',key,true);doc.addEventListener('scroll',hide,true);view.addEventListener('blur',hide);view.addEventListener('resize',hide);
 const observer=new view.MutationObserver(records=>{for(const record of records){if(record.type==='attributes'){if(record.attributeName==='title')migrate(record.target);if(record.target===owner)show(owner);}else for(const node of record.addedNodes)scan(node);}for(const element of [...tracked])if(!element.isConnected)restore(element);if(owner&&!owner.isConnected)hide();});observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['title','data-cc-tooltip']});
 const manager={users:1,release(){if(--manager.users>0)return;observer.disconnect();hide();doc.removeEventListener('pointerover',over,true);doc.removeEventListener('pointerout',out,true);doc.removeEventListener('focusin',focus,true);doc.removeEventListener('focusout',hide,true);doc.removeEventListener('pointerdown',hide,true);doc.removeEventListener('keydown',key,true);doc.removeEventListener('scroll',hide,true);view.removeEventListener('blur',hide);view.removeEventListener('resize',hide);for(const element of [...tracked])restore(element);doc.querySelectorAll('[data-cc-tooltip-managed]').forEach(element=>element.removeAttribute('data-cc-tooltip-managed'));instantTooltipDocuments.delete(doc);}};instantTooltipDocuments.set(doc,manager);return()=>manager.release();
}

function renderControlPanelEntry({label,count,onClick,guideTarget,className=''}){
 return h('button',{type:'button',className:'cc-control-panel-entry '+className,'aria-haspopup':'dialog','data-cc-guide':guideTarget,onClick},
  h(PromptIcon,{name:'sliders',size:14}),h('span',{className:'cc-control-entry-label'},label),
  count>0?h('span',{className:'cc-control-entry-count','aria-label':'已添加 '+count+' 项'},String(count)):null,
  h(PromptIcon,{name:'chevronRight',size:12}));
}
function renderControlPanelSummary(items,onOpen,emptyLabel){
 return h('div',{className:'cc-control-panel-summary'},items.length?items.map(item=>h('button',{type:'button',key:item.key,className:'cc-control-summary-chip',onClick:onOpen,'aria-label':'配置 '+item.label},
  item.label,item.count>1?h('small',null,'×'+item.count):null)):h('span',{className:'cc-control-summary-empty'},emptyLabel));
}
function generationControlGroups(entries){
 const names={vae:'VAE',clip:'Text Encoder',lora:'LoRA',reference:'图生图',inpaint:'局部重绘',scene3d:'3D 参考',acceleration:'加速 LoRA'},groups=new Map();
 for(const entry of entries){const key=entry.kind;if(!groups.has(key))groups.set(key,{key,label:names[key]||entry.label||key,count:0});groups.get(key).count++;}
 return [...groups.values()];
}

// Shared continuous/color parameter control. The business owns the range,
// gradient and default; sizing, focus, keyboard input and reset stay common.
function ParameterSlider({label,value,onChange,onCommit,min=0,max=100,step=1,resetValue=0,track='',unit='',disabled=false,className=''}){
 const numeric=Number.isFinite(Number(value))?Number(value):resetValue;
 const latest=React.useRef(numeric),pending=React.useRef(false);latest.current=numeric;
 const emit=v=>{if(disabled||!Number.isFinite(v))return;latest.current=Math.max(min,Math.min(max,v));pending.current=true;onChange(latest.current);};
 const commit=()=>{if(pending.current){pending.current=false;onCommit?.(latest.current);}};
 const display=numberInputPrecision(step)?numeric.toFixed(numberInputPrecision(step)):String(Math.round(numeric));
 return h('div',{className:'cc-parameter-slider'+(className?' '+className:''),'aria-disabled':disabled,style:track?{'--cc-slider-track':track}:undefined},
  h('span',{className:'cc-parameter-slider-label'},label),
  h('input',{type:'range',className:'cc-parameter-slider-input','aria-label':label,'aria-valuetext':display+unit,min,max,step,value:numeric,disabled,onChange:e=>emit(Number(e.target.value)),onPointerUp:commit,onPointerCancel:commit,onKeyUp:commit,onBlur:commit}),
  h('output',{className:'cc-parameter-slider-value','aria-hidden':true},display+unit),
  h(ResetButton,{label:'重置'+label,tooltip:'重置'+label+'为 '+resetValue+unit,disabled:disabled||numeric===resetValue,onClick:()=>{emit(resetValue);commit();}}));
}

function ResetButton({label='重置',tooltip='重置',onClick,disabled=false,className=''}){
 return h('button',{type:'button',className:'cc-reset-button'+(className?' '+className:''),'aria-label':label,'data-cc-tooltip':tooltip,disabled,onClick},h(PromptIcon,{name:'reset',size:15}));
}
function installSpellcheckPolicy() {
    if (typeof document === "undefined") return () => {};
    if (window.__ccSpellcheckPolicy) return () => {};
    window.__ccSpellcheckPolicy = true;
    const apply = (el) => {
        if (!el || el.nodeType !== 1) return;
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
        if (el instanceof HTMLInputElement && !/^(?:text|search|email|url|tel|password)$/i.test(el.type || "text")) return;
        try {
            if (el.spellcheck !== false) el.spellcheck = false;
            el.setAttribute("autocorrect", "off");
            el.setAttribute("autocapitalize", "off");
        } catch { /* ignore */ }
    };
    const scan = (node) => {
        if (!node || node.nodeType !== 1) return;
        if (node.matches && node.matches("input,textarea")) apply(node);
        if (node.querySelectorAll) node.querySelectorAll("input,textarea").forEach(apply);
    };
    document.querySelectorAll("input,textarea").forEach(apply);
    let observer = null;
    if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) for (const node of mutation.addedNodes) scan(node);
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
    const onFocus = (event) => apply(event.target);
    document.addEventListener("focusin", onFocus, true);
    return () => {
        if (observer) observer.disconnect();
        document.removeEventListener("focusin", onFocus, true);
    };
}

/**
 * 点击「生成」/「开始处理」时，把一个任务胶囊从按钮弹起、飞入顶部「当前任务」条。
 * 纯提示动效：不参与任务状态，失败静默。
 */
function flyJobToTask(origin, label) {
    if (typeof document === "undefined" || !origin) return;
    try {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const from = origin.getBoundingClientRect();
        if (!from.width && !from.height) return;
        const accent = (getComputedStyle(origin).getPropertyValue("--cc-accent").trim()) || "#4D6BFE";
        const chip = document.createElement("div");
        chip.className = "cc-task-fly";
        chip.setAttribute("aria-hidden", "true");
        chip.style.setProperty("--cc-task-fly-accent", accent);
        Object.assign(chip.style, {
            position: "fixed", left: "0", top: "0", zIndex: "2147483000", pointerEvents: "none",
            display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 10px 5px 8px",
            borderRadius: "999px", background: accent, color: "#fff", fontSize: "12px",
            fontWeight: "600", lineHeight: "1.2", whiteSpace: "nowrap",
            boxShadow: "0 10px 26px " + accent + "55", willChange: "transform,opacity"
        });
        const dot = document.createElement("span");
        dot.className = "cc-task-fly-dot";
        dot.style.cssText = "width:6px;height:6px;border-radius:50%;background:#fff;opacity:.92;box-shadow:0 0 0 3px rgba(255,255,255,.22)";
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(label || "任务"));
        document.body.appendChild(chip);
        const r = chip.getBoundingClientRect();
        const w = r.width || 64, h = r.height || 26;
        const sx = from.left + from.width / 2 - w / 2;
        const sy = from.top + from.height / 2 - h / 2;
        let tx = window.innerWidth / 2 - w / 2;
        let ty = 48;
        const bar = document.querySelector(".cc-runtime-current");
        if (bar) {
            const t = bar.getBoundingClientRect();
            if (t.bottom > 0 && t.top < window.innerHeight) {
                tx = t.left + t.width * 0.5 - w / 2;
                ty = t.top + t.height / 2 - h / 2;
            } else {
                tx = Math.min(Math.max(t.left + t.width * 0.5 - w / 2, 12), window.innerWidth - w - 12);
                ty = 44;
            }
        }
        const mx = sx + (tx - sx) * 0.52;
        const my = Math.max(16, Math.min(sy, ty) - Math.max(24, Math.abs(sy - ty) * 0.06));
        const anim = chip.animate([
            { transform: `translate(${sx}px,${sy}px) scale(.35)`, opacity: 0 },
            { transform: `translate(${sx}px,${sy - 52}px) scale(1.16)`, opacity: 1, offset: 0.26 },
            { transform: `translate(${mx}px,${my}px) scale(.94)`, opacity: 0.96, offset: 0.64 },
            { transform: `translate(${tx}px,${ty}px) scale(.3)`, opacity: 0, offset: 1 }
        ], { duration: 1500, easing: "cubic-bezier(.18,.72,.22,1)" });
        anim.onfinish = () => chip.remove();
        anim.oncancel = () => chip.remove();
        setTimeout(() => chip.remove(), 2400);
    } catch (_) { /* 动效失败不影响任务 */ }
}

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
// Deferred UI: entries intentionally hidden in this release; see CHANGELOG.md before restoring them.
// Dictionary services, saved presets and view helpers remain available internally.
const DEFERRED_UI=Object.freeze({viewPresets:false,dictionary:false,presets:false});
const CONSOLE_PAGES=[["gen", "工作台"], ["output", "输出"], ["lib", "词库"], ["preset", "预设"], ["online", "在线模型库"]]
    .filter(([key])=>(key!=="lib"||DEFERRED_UI.dictionary)&&(key!=="preset"||DEFERRED_UI.presets));
const CONSOLE_TABS=CONSOLE_PAGES.map(([key])=>key);
function readLastConsoleTab(){
    try{const value=window.localStorage.getItem(CONSOLE_TAB_KEY);return CONSOLE_TABS.includes(value)?value:"gen";}catch(e){return "gen";}
}

function modelSourceBatchActive(job){return !!job&&['scanning','running','stopping'].includes(job.status);}
function modelSourceBatchSummary(job){return `来源：找到 ${job.found||0} · 已有 ${job.skipped||0} · 未找到 ${job.not_found||0} · 失败 ${job.failed||0}　预览：保存 ${job.preview_saved||0} · 已有 ${job.preview_existing||0} · 无图 ${job.preview_missing||0} · 失败 ${job.preview_failed||0}`;}
function useModelSourceBatch(open,onComplete){
 const [job,setJob]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=useErrorState(''),[connection,setConnection]=React.useState('');
 const alive=React.useRef(true),seen=React.useRef(null),dismissed=React.useRef(null),complete=React.useRef(onComplete),command=React.useRef(false),epoch=React.useRef(0);
 complete.current=onComplete;
 const accept=React.useCallback(result=>{
  if(!alive.current)return;
  const next=result?.job||null;setConnection('');
  if(next&&!modelSourceBatchActive(next)&&dismissed.current===next.id){setJob(null);return;}
  if(next&&dismissed.current&&dismissed.current!==next.id)dismissed.current=null;
  setJob(next);
  if(modelSourceBatchActive(next))seen.current=next.id;
  else if(next&&seen.current===next.id){
   seen.current=null;
   ERROR_NOTICES.push(modelSourceBatchSummary(next)+(next.message?'；'+next.message:''),{title:next.status==='cancelled'?'来源获取已停止':'来源获取结束',severity:next.status==='failed'?'error':next.failed||next.preview_failed?'warn':'success'});
   complete.current?.(next);
  }
 },[]);
 const running=modelSourceBatchActive(job);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 React.useEffect(()=>{
  if(!open&&!running)return;
  let dead=false,timer=null;const ctl=new AbortController();
  const poll=async()=>{
   const revision=epoch.current;
   try{
    const health=await requireCompatibleSidecar(EXPANDER+'/models/sources/batch');
    if(!health?.modelSourceBatchVersion)return;
    const result=await jget(EXPANDER+'/models/sources/batch',10000,ctl.signal);
    if(!dead&&revision===epoch.current)accept(result);
   }catch(e){if(!dead&&!ctl.signal.aborted)setConnection('暂时无法读取来源任务进度，正在重新连接；关闭弹窗不会停止后台任务。');}
   finally{if(!dead)timer=setTimeout(poll,1500);}
  };
  poll();return()=>{dead=true;clearTimeout(timer);ctl.abort();};
 },[open,running,accept]);
 async function act(scope,options={}){
  if(command.current)return;command.current=true;epoch.current++;setBusy(true);setError('');
  if(scope!=='cancel')dismissed.current=null;
  try{
   await requireSidecarFeature('modelSourceBatchVersion',2,'批量模型来源');
   const result=await jpost(EXPANDER+'/models/sources/batch'+(scope==='cancel'?'/cancel':''),
    scope==='cancel'?{job_id:job?.id}:{...options,scope,job_id:job?.id,request_id:'sources-'+editorChannel()},15000);
   accept(result);
  }catch(e){if(alive.current)setError('来源任务操作失败：'+errText(e));}
  finally{command.current=false;if(alive.current)setBusy(false);}
 }
 function dismiss(){if(!job||running)return;dismissed.current=job.id;setJob(null);setError('');setConnection('');}
 return {job,busy,error,connection,running,start:act,cancel:()=>act('cancel'),dismiss};
}
function ModelSourceBatchButton({batch,kind,rootId,folder,ready}){
 const [open,setOpen]=React.useState(false),host=React.useRef(null),trigger=React.useRef(null);
 React.useEffect(()=>{
  if(!open)return;
  const dismiss=e=>{if(!host.current?.contains(e.target))setOpen(false);};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',dismiss,true);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('keydown',key,true);};
 },[open]);
 const start=(scope,force=false)=>{setOpen(false);batch.start(scope,{kind,root_id:rootId,folder,force});};
 const libraryLabel=kind==='lora'?'全部 LoRA（所有目录）':['checkpoint','diffusion'].includes(kind)?'全部底模（所有目录）':kind?'全部同类模型（所有目录）':'整个模型库';
 const menuKey=e=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();const items=[...host.current.querySelectorAll('[role="menuitem"]:not(:disabled)')],index=items.indexOf(document.activeElement);
  items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
 };
 return h('div',{ref:host,className:'cc-output-preview-anchor cc-model-source-anchor',onKeyDown:menuKey},
  h('button',{ref:trigger,type:'button',className:'cc-library-icon',style:S.btn2,'aria-label':'一键获取模型来源','data-cc-tooltip':batch.running?'来源任务进行中；点击查看操作':'一键获取模型来源；首次读取大模型可能较久','aria-busy':batch.running||batch.busy,'aria-haspopup':'menu','aria-expanded':open,
   onClick:()=>setOpen(v=>!v),onKeyDown:e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);requestAnimationFrame(()=>host.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus());}}},
   batch.running||batch.busy?h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner',size:16})):h(PromptIcon,{name:'link',size:16})),
  open?h('div',{className:'cc-output-preview-menu cc-model-source-menu',role:'menu','aria-label':'获取模型来源范围'},
   h('strong',null,'获取模型来源'),
   h('small',{className:'cc-online-job-message'},'首次需读取文件并联网查找，大文件或模型较多时可能耗时较久。已有来源不重复查询，但会补齐缺失预览图；关闭弹窗不影响后台任务。'),
   h('button',{type:'button',role:'menuitem',disabled:batch.running||batch.busy||!ready,onClick:()=>start('folder')},'当前文件夹（含子文件夹）'),
   h('button',{type:'button',role:'menuitem',disabled:batch.running||batch.busy,onClick:()=>start('library')},libraryLabel),
   h('button',{type:'button',role:'menuitem',disabled:batch.running||batch.busy||!ready,onClick:()=>start('folder',true)},'重新获取当前文件夹的自动来源'),
   h('button',{type:'button',role:'menuitem',disabled:batch.running||batch.busy,onClick:()=>start('library',true)},'重新获取全部自动来源'),
   h('small',{className:'cc-online-job-message'},'不会下载模型文件；来源有预览图时最多保存五张（单张不超过 8 MiB），没有预览图就跳过。'),
   batch.running?h('button',{type:'button',role:'menuitem',disabled:batch.busy||batch.job?.status==='stopping',onClick:()=>{setOpen(false);batch.cancel();}},'停止后续查询'):null,
   (batch.job?.failed||batch.job?.preview_failed)&&!batch.running?h('button',{type:'button',role:'menuitem',disabled:batch.busy,onClick:()=>{setOpen(false);batch.start('retry');}},'只重试失败项'):null):null);
}
function ModelSourceBatchStatus({batch}){
 const {job,running,busy,error,connection}=batch;
 if(!job&&!error&&!connection)return null;
 const phase=job?.status==='stopping'?'正在停止来源任务':{scanning:'正在扫描模型',checking:'正在检查已有来源',hashing:'正在读取文件',querying:'正在查找来源',preview_lookup:'正在读取预览信息',preview_download:'正在下载预览图',done:'已结束'}[job?.phase]||'正在获取来源';
 const terminal={completed:'来源获取完成',cancelled:'来源获取已停止',failed:'来源任务未完成',interrupted:'来源任务已中断'}[job?.status]||phase;
 return h('section',{className:'cc-online-job cc-model-source-status'+(!running?' is-complete':''),'aria-label':'模型来源任务'},
  job?h(React.Fragment,null,
   !running?h('button',{type:'button',className:'cc-model-source-done',style:S.btn2,onClick:batch.dismiss},'完成'):null,
   h('div',{className:'cc-model-source-status-head'},
    h('span',null,running?h('span',{className:'cc-icon-spinner','aria-hidden':true},h(PromptIcon,{name:'spinner',size:13})):null,' ',running?phase:terminal,job.total?` · ${job.processed} / ${job.total}`:''),
    h('div',{className:'cc-model-source-status-actions'},running?h('button',{type:'button',className:'cc-library-icon',style:S.btn2,'aria-label':'停止来源任务','data-cc-tooltip':'停止后续查询；已完成的来源保留',disabled:busy||job.status==='stopping',onClick:batch.cancel},h(PromptIcon,{name:'stop',size:14})):job.failed||job.preview_failed?h('button',{type:'button',style:S.btn2,disabled:busy,onClick:()=>batch.start('retry')},'重试失败项'):null)),
   running&&job.total?h('div',{className:'cc-runtime-track',role:'progressbar','aria-label':'来源获取进度','aria-valuemin':0,'aria-valuemax':job.total,'aria-valuenow':job.processed},h('span',{style:{width:Math.min(100,job.processed/job.total*100)+'%'}})):null,
   h('div',{className:'cc-online-job-message cc-model-source-status-detail',role:'status'},modelSourceBatchSummary(job)),
   running&&job.current?h('div',{className:'cc-online-job-message cc-model-source-status-detail'},job.current,job.phase==='hashing'&&job.size?` · ${Math.floor((job.bytes||0)/job.size*100)}%`:job.provider?' · '+job.provider:''):null,
   job.message&&job.message!==terminal?h('small',{className:'cc-online-job-message'},job.message):null,
   job.issueCount?h('details',{className:'cc-model-source-issues'},h('summary',null,`查看未找到 / 失败项（${job.issueCount}）`),
    ...job.issues.map((item,i)=>h('div',{key:i},h('strong',null,item.preview_status==='failed'?'预览图失败：':item.status==='not_found'?'未找到：':'失败：'),item.name,h('small',{className:'cc-online-job-message'},[item.message,item.preview_message].filter(Boolean).join('；')))),job.issueCount>job.issues.length?h('small',{className:'cc-online-job-message'},`仅展示前 ${job.issues.length} 项；失败项可整体重试。`):null):null):null,
  error?h('div',{style:S.bad,role:'alert'},error):null,connection?h('div',{style:S.dim,role:'status'},connection):null);
}

function Console() {
	const rootRef = React.useRef(null);
	const [controlnets,setControlnets]=React.useState([]);
	React.useEffect(()=>{let dead=false;Promise.all([jget(COMFY+'/object_info/ControlNetLoader',10000),jget(COMFY+'/object_info/ModelPatchLoader',10000)]).then(([cn,mp])=>{if(dead)return;const a=comboOptions(cn,'ControlNetLoader','control_net_name').filter(n=>typeof n==='string'&&!/^put_/i.test(n));const b=comboOptions(mp,'ModelPatchLoader','name').filter(n=>typeof n==='string'&&!/^put_/i.test(n));setControlnets([...new Set([...a,...b])]);}).catch(()=>{});return()=>{dead=true};},[]);
    // 隐藏 DSH 外层整页滚动条（含全屏看图时的页面滚动条），保留滚轮滚动。
    React.useEffect(() => {const scroll=installPageScrollbarHiding(rootRef.current),tooltips=installInstantTooltips(rootRef.current),spellcheck=installSpellcheckPolicy();return()=>{spellcheck?.();tooltips();scroll?.();};}, []);
    const [theme, setTheme] = React.useState({});
    // Portal 不继承绘图台 DOM 的 CSS 变量，所以显式同步给浮层。
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const refresh = () => {
            const palette = hostPalette(rootRef.current);
            const next = Object.assign(palette, { "--cc-accent": CURRENT_THEME_ACCENT, "--cc-accent-bg": CURRENT_THEME_ACCENT + "22", "--cc-accent-text": accentTextForScheme(palette["--cc-scheme"]) });
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
    const [tab, setTab] = React.useState(readLastConsoleTab);
    const modelDockRef=React.useRef(null);
    const dragEntryRef=React.useRef(null);
    const [dragOverKey,setDragOverKey]=React.useState(null);
    const [dragDropPos,setDragDropPos]=React.useState('before');
    const [draggingKey,setDraggingKey]=React.useState(null);
    const autoScrollRef=React.useRef({raf:0,speed:0});
    const dragAutoScroll=(e)=>{
        const box=e.currentTarget.closest('.cc-post-cells');
        if(!box)return;
        const r=box.getBoundingClientRect(),edge=56;
        let speed=0;
        if(e.clientY<r.top+edge)speed=-Math.min(16,Math.max(4,(r.top+edge-e.clientY)/3+4));
        else if(e.clientY>r.bottom-edge)speed=Math.min(16,Math.max(4,(e.clientY-(r.bottom-edge))/3+4));
        const st=autoScrollRef.current;
        st.speed=speed;
        if(speed&&!st.raf){
            const tick=()=>{const cur=autoScrollRef.current;if(!cur.speed){cur.raf=0;return;}box.scrollTop+=cur.speed;cur.raf=requestAnimationFrame(tick);};
            st.raf=requestAnimationFrame(tick);
        }else if(!speed&&st.raf){cancelAnimationFrame(st.raf);st.raf=0;}
    };
    const stopDragAutoScroll=()=>{const st=autoScrollRef.current;st.speed=0;if(st.raf){cancelAnimationFrame(st.raf);st.raf=0;}};
    const workbenchStorageKey=LS_KEY+'/workbench-layout';
    const [workbenchLayout,setWorkbenchLayout]=React.useState(()=>{try{return readWorkbenchLayout(window.localStorage,workbenchStorageKey);}catch{return defaultWorkbenchLayout();}});
    React.useEffect(()=>{
        const dock=modelDockRef.current,base=dock?.querySelector('.cc-model-base'),body=dock?.parentElement;
        if(!dock||!base||!body||typeof ResizeObserver!=='function')return;
        let frame=0;
        const measure=()=>{
            frame=0;
            const main=dock.querySelector('.cc-model-dock-main'),style=getComputedStyle(main);
            const minimum=parseFloat(style.getPropertyValue('--cc-model-cover-min'))||128;
            const baseRect=base.getBoundingClientRect(),dockStyle=getComputedStyle(dock);
            let height=body.getBoundingClientRect().height-parseFloat(dockStyle.paddingTop)-parseFloat(dockStyle.paddingBottom);
            // Only subtract sections below the model; side columns share its height.
            for(const sibling of main.children){
                if(sibling===base)continue;
                const rect=sibling.getBoundingClientRect();
                if(rect.top>=baseRect.bottom-1)height-=rect.height+(parseFloat(style.rowGap)||0);
            }
            const warning=dock.querySelector('[role="status"]');
            if(warning)height-=warning.getBoundingClientRect().height+(parseFloat(dockStyle.gap)||0);
            const size=Math.floor(Math.max(minimum,Math.min(height,baseRect.width*.48)));
            if(main.style.getPropertyValue('--cc-model-cover-size')!==size+'px')main.style.setProperty('--cc-model-cover-size',size+'px');
        };
        const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
        const observer=new ResizeObserver(schedule);observer.observe(body);observer.observe(base);
        schedule();return()=>{observer.disconnect();cancelAnimationFrame(frame);};
    },[tab,workbenchLayout]);

    const workbenchStorageError=React.useRef(false);
    React.useEffect(()=>{try{window.localStorage.setItem(workbenchStorageKey,JSON.stringify(workbenchLayout));workbenchStorageError.current=false;}catch(e){if(!workbenchStorageError.current){workbenchStorageError.current=true;notifyError('工作台布局暂时无法保存；当前布局仍可使用');}}},[workbenchLayout]);
    const [previewBackground,setPreviewBackground]=React.useState(()=>normalizePreviewBackground(lsRead().previewBackground));
    const [uiPreferencesReady,setUiPreferencesReady]=React.useState(false);
    React.useEffect(()=>{
        let cancelled=false;
        const headers=typeof instanceHeaders==='function'?instanceHeaders():{};
        fetch(EXPANDER+'/ui-preferences',{headers,cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
            if(cancelled)return;
            const prefs=data?.preferences;
            if(prefs&&typeof prefs==='object'){
                if(prefs.workbenchLayout)setWorkbenchLayout(normalizeWorkbenchLayout(prefs.workbenchLayout));
                if(prefs.previewBackground)setPreviewBackground(normalizePreviewBackground(prefs.previewBackground));
            }
        }).catch(()=>{}).finally(()=>{if(!cancelled)setUiPreferencesReady(true);});
        return()=>{cancelled=true;};
    },[]);
    React.useEffect(()=>{
        if(!uiPreferencesReady)return;
        const timer=setTimeout(()=>{
            const headers=typeof instanceHeaders==='function'?instanceHeaders():{};
            fetch(EXPANDER+'/ui-preferences',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({workbenchLayout,previewBackground})}).catch(()=>{});
        },180);
        return()=>clearTimeout(timer);
    },[workbenchLayout,previewBackground,uiPreferencesReady]);
    function changePreviewBackground(value){
        const next=normalizePreviewBackground(value);setPreviewBackground(next);
        if(!lsWrite({previewBackground:next}))notifyError('预览背景暂时无法保存；本次选择仍可使用');
    }
    function renderPostHeader(){
        const pc=postControls||{};
        const count=(Array.isArray(pc.cells)?pc.cells.filter(c=>c.enabled!==false).length:0)+(pc.inpaint?.enabled!==false&&pc.inpaint?1:0);
        return h('div',{className:'cc-post-workbench-tools'},
            h(PostAutoSwitch,{checked:pc.autoExecute!==false,label:'自动执行',onChange:checked=>setPostControls(normalizePost({postControls:{...pc,autoExecute:checked}}))}),
            h('span',{className:'cc-post-workbench-count'},count+' 个图片处理'),
            h('button',{type:'button',className:'cc-post-collapse',title:postOpen?'收起生成后控制':'展开生成后控制','aria-label':postOpen?'收起生成后控制':'展开生成后控制','aria-expanded':postOpen,onClick:togglePostExpanded},h(PromptIcon,{name:'chevronDown',size:16})));
    }
    function togglePostExpanded(event){
        const mod=event.currentTarget.closest('.cc-workbench-module');
        const host=mod?.closest('.dsh-comfy-ui')||mod?.closest('.dsh-comfy-floating');
        const before=mod?mod.getBoundingClientRect().top:null;
        setPostOpen(v=>!v);
        if(!host||before==null)return;
        const align=()=>{if(!mod)return;const delta=mod.getBoundingClientRect().top-before;if(Math.abs(delta)>0.5)host.scrollTop+=delta;};
        requestAnimationFrame(()=>{align();requestAnimationFrame(align);});
    }
    const renderWorkbench=useWorkbenchLayout({value:workbenchLayout,onChange:setWorkbenchLayout,active:tab==='gen',onHeaderClick:(id,event)=>{if(id==='post')togglePostExpanded(event);},
        renderHeader:(id,info)=>id==='prompt'?renderPromptHeader(info):id==='preview'?h('div',{className:'cc-preview-background-control'},h(SelectMenu,{theme,label:'图片预览背景',minWidth:0,value:previewBackground,onChange:changePreviewBackground,options:PREVIEW_BACKGROUND_OPTIONS})):id==='post'?renderPostHeader(info):null});
	const [online, setOnline] = React.useState(null);
    const [comfyUpdate,setComfyUpdate]=React.useState(null);
    const [updateOpen,setUpdateOpen]=React.useState(false);
    const [updateBusy,setUpdateBusy]=React.useState(false);
    const [updateError,setUpdateError]=useErrorState('');
    const [errorLogOpen,setErrorLogOpen]=React.useState(false);
    const [errorLogs,setErrorLogs]=React.useState(()=>readClientErrors());
	const [conn, setConn] = React.useState(0);
	const [showConn, setShowConn] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [settingsSection, setSettingsSection] = React.useState("connection");
    const THEME_ACCENT_DEFAULT = "#4D6BFE";
    const readSavedThemeAccent = () => { try { return window.localStorage.getItem("dsh-comfyui-console/theme-accent") || USER.themeAccent || THEME_ACCENT_DEFAULT; } catch { return THEME_ACCENT_DEFAULT; } };
    const [themeAccentState, setThemeAccentState] = React.useState(readSavedThemeAccent);
    const [themeDraft, setThemeDraft] = React.useState(readSavedThemeAccent);
    const THEME_ACCENT_PRESETS = [["deepseek 蓝", "#4D6BFE"], ["琥珀黄", "#F59E0B"], ["深橙色", "#FF8C00"], ["珊瑚橙", "#FF7F50"], ["番茄红", "#FF6347"], ["樱桃红", "#DE3163"], ["李子紫", "#8E4585"], ["初音未来", "#39C5BB"], ["蓝绿色", "#008080"], ["翡翠绿", "#50C878"], ["海绿色", "#2E8B57"]];
    function applyThemeAccent(color, persist = true) {
        if (!/^#[0-9a-fA-F]{6}$/.test(color || "")) return;
        CURRENT_THEME_ACCENT = color;
        if (persist) { USER.themeAccent = color; try { window.localStorage.setItem("dsh-comfyui-console/theme-accent", color); } catch {} try { saveUser(); } catch {} setThemeAccentState(color); }
        setTheme((prev) => ({ ...prev, "--cc-accent": color, "--cc-accent-bg": color + "22", "--cc-accent-text": accentTextForScheme(prev["--cc-scheme"]) }));
        const targets = [rootRef.current, document.documentElement, ...document.querySelectorAll(".dsh-comfy-ui,.dsh-comfy-floating")];
        for (const el of targets) applyAccentPalette(el, color);
    }
    function themePanel() {
        const current = String(themeAccentState || THEME_ACCENT_DEFAULT).toLowerCase();
        const draft = String(themeDraft || THEME_ACCENT_DEFAULT).toLowerCase();
        return h("div", { style: { display: "flex", flexDirection: "column", gap: 12, height: "100%" } },
            h("span", { style: S.dim }, "选择主题主色，立即应用并保存；也可以自定义颜色。"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
                ...THEME_ACCENT_PRESETS.map(([name, color]) => {
                    const active = current === color.toLowerCase();
                    const picked = draft === color.toLowerCase();
                    return h("button", { key: color, type: "button", title: name, onClick: () => setThemeDraft(color),
                        style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                            background: active ? "var(--cc-accent-bg)" : "transparent",
                            border: "1px solid " + (picked ? "var(--cc-accent)" : active ? "var(--cc-accent-bg)" : "var(--cc-border)"),
                            outline: picked ? "1px solid var(--cc-accent)" : "none",
                            color: "var(--cc-text)" } },
                        h("span", { style: { width: 16, height: 16, borderRadius: "50%", background: color, flex: "none", border: "1px solid rgba(0,0,0,.15)" } }),
                        name,
                        active ? h("span", { style: { fontSize: 11, color: "var(--cc-muted)" } }, "当前") : null);
                })),
            h("label", { style: Object.assign({}, S.field, { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }) },
                h("span", { style: S.label }, "自定义颜色"),
                h("input", { type: "color", value: themeDraft || THEME_ACCENT_DEFAULT, style: { width: 48, height: 32, padding: 0, border: "1px solid var(--cc-border)", borderRadius: 6, background: "transparent" }, onChange: (e) => setThemeDraft(e.target.value) })),
            );
    }
    function connectionFooter() {
        return h(React.Fragment, null,
            h("button", { style: S.btn2, onClick: () => { setErrorLogOpen(true); setErrorLogs(readClientErrors()); setShowSettings(false); } }, "错误日志"),
            h("button", { style: S.btn2, onClick: () => setShowSettings(false) }, "取消"),
            h("button", { style: S.btn, "data-cc-guide":"save-connection-settings", disabled: saving || !settingsInfo, onClick: saveConnectionSettings },
                saving ? "保存中…" : "保存启动设置"));
    }
    function themeFooter() {
        return h(React.Fragment, null,
            h("button", { type: "button", style: S.btn2, onClick: () => { setThemeDraft(THEME_ACCENT_DEFAULT); applyThemeAccent(THEME_ACCENT_DEFAULT); } }, "恢复默认"),
            h("button", { type: "button", style: S.btn, onClick: () => applyThemeAccent(themeDraft) }, "应用"));
    }
    React.useEffect(() => { applyThemeAccent(themeAccentState, false); }, []);
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
	const [connNotice, setConnNotice] = useStatusState("");
	const [starting, setStarting] = React.useState(false);
    const [startSession,setStartSession]=React.useState(null),[stoppingStart,setStoppingStart]=React.useState(false);
    const launchAttempt=React.useRef(null);
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
        const onError=e=>{logClientError('window.error',e.error||e.message,{filename:e.filename||'',line:e.lineno||0,column:e.colno||0});if(/dsh-comfyui-console|client\.js|scene3d|workflow/.test(String(e.filename||'')+String(e.error?.stack||'')))notifyError(e.error||e.message,{title:'插件运行异常'});};
        const onRejection=e=>{logClientError('unhandledrejection',e.reason);if(/dsh-comfyui-console|client\.js|scene3d|workflow/.test(String(e.reason?.stack||'')))notifyError(e.reason,{title:'插件操作异常'});};
        window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
        return ()=>{window.removeEventListener('dsh-comfy-error-log',refresh);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);};
    },[]);
    const [modelControlsOpen,setModelControlsOpen]=React.useState(false);
    const [componentPicker,setComponentPicker]=React.useState(null);
    const componentSequence=React.useRef(0);
    const [modelDockRevision,setModelDockRevision]=React.useState(0);
    const modelPickCallback=React.useRef(null);
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
    const [modelAssetMessage,setModelAssetMessage]=useStatusState("");
    const [modelSourceBusy,setModelSourceBusy]=React.useState(false);
    const [modelTaskStopping,setModelTaskStopping]=React.useState(false);
    const modelTaskRef=React.useRef(null);

    const [modelLibraryError,setModelLibraryError]=useErrorState("");
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
    const sourceBatch=useModelSourceBatch(showModelLibrary,()=>{refreshModelDockAssets();if(showModelLibrary&&modelLibraryFocus)loadModelDetail(modelLibraryFocus);});


	// 参数
	const L = USER.last || {};
	const [ckpt, setCkpt] = React.useState(L.ckpt || "");
    const [modelConfig,setModelConfig]=React.useState(()=>normalizeModelConfig(L.modelConfig));
    const profile=modelProfile(modelConfig);
    const [modelCheck,setModelCheck]=React.useState(false);
    const [modelFileChecking,setModelFileChecking]=React.useState(false);
    const [modelTypeSettingsOpen,setModelTypeSettingsOpen]=React.useState(false);
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
    const [latentReplace, setLatentReplace] = React.useState(null);
    const [scene3dSaveConfirm, setScene3dSaveConfirm] = React.useState(null);
    const [confirmState, setConfirmState] = React.useState(null);
    const showConfirm = (opts) => new Promise(resolve => setConfirmState({ ...opts, resolve }));
    const LATENT_LABELS = { scene3d: "3D 参考", inpaint: "局部重绘", reference: "图生图" };
    const expandPhaseRef = React.useRef("idle");
    const expandRequestRef = React.useRef(null);
    const [previewMode,setPreviewMode] = React.useState("raw");
    const [previewTranslating,setPreviewTranslating]=React.useState(false);
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
    function setPos(value) { return updatePrompt({pos:typeof value === "function" ? value(promptRef.current.pos) : value}); }
    function setNeg(value) { return updatePrompt({neg:typeof value === "function" ? value(promptRef.current.neg) : value}); }
    function promptInput(kind,e,compositionEnd=false) {
        const node=e.target || e.currentTarget;
        const isComposing=!compositionEnd && (composingPrompt.current[kind] || e.nativeEvent?.isComposing);
        const value=isComposing?node.value:normalizePromptPunctuation(node.value);
        const start=node.selectionStart,end=node.selectionEnd;
        if(value!==node.value) {
            node.value=value;
            if(typeof start==='number')node.setSelectionRange?.(start,end);
        }
        const source=compositionGroup.current[kind]?"gesture":pasteRef.current?"action":"typing";pasteRef.current=false;
        updatePrompt({[kind]:value},source,compositionGroup.current[kind] || kind);
        if(!isComposing)autocomplete.changed(kind,node);
    }
    function promptComposition(kind,ending,e) {
        if(!ending)compositionGroup.current[kind]=kind+":ime-"+Date.now();
        composingPrompt.current[kind]=!ending;
        if(ending)promptInput(kind,e,true);
        if(ending)delete compositionGroup.current[kind];
        autocomplete.props(kind)[ending?'onCompositionEnd':'onCompositionStart']?.(e);
    }
    function editChip(kind,index,weight,gesture) {
        const value=editPreviewPart(promptRef.current[kind],index,weight);
        updatePrompt({[kind]:value},gesture?"gesture":"action",gesture?kind+":"+index+":"+gesture:kind);
    }
    function restorePrompt(kind) {
        if (expandPhaseRef.current !== "idle") return;
        autocomplete.close();
        const snapshot = historyRef.current[kind]();
        if (!snapshot) return;
        promptRef.current = snapshot;
        rawSetPos(snapshot.pos); rawSetNeg(snapshot.neg);
        setHistoryTick(v => v + 1);
    }
    function promptKeys(e) {
        if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode===229) return;
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const key = e.key.toLowerCase();
        if (key === "z" || key === "y") {
            e.preventDefault(); e.stopPropagation();
            if (expandPhaseRef.current !== "idle") return;
            restorePrompt(key === "y" || e.shiftKey ? "redo" : "undo");
        }
    }
    function persistAreaHeight(kind, height) {
        height = Math.round(Number(height));
        const min = kind === "pos" ? 145 : 100;
        if (!Number.isFinite(height) || height < min) return;
        const sizes = USER.promptHeights || {};
        if (sizes[kind] === height) return;
        USER.promptHeights = {...sizes, [kind]:height};
        saveUser();
    }
    function beginAreaResize(kind,e) {
        if (expandPhaseRef.current !== "idle") return;
        const node = kind === "pos" ? posAreaRef.current : negAreaRef.current;
        if (!node) return;
        e.preventDefault();
        const handle=e.currentTarget;
        const min=kind === "pos" ? 145 : 100;
        const startHeight=Math.max(min,Math.round(node.getBoundingClientRect().height || areaHeights[kind] || min));
        resizeDragRef.current={kind,pointerId:e.pointerId,startY:e.clientY,startHeight,lastHeight:startHeight,handle};
        try{handle.setPointerCapture?.(e.pointerId);}catch{}
        handle.dataset.dragging="true";
        setResizingKind(kind);
    }
    function moveAreaResize(kind,e) {
        const drag=resizeDragRef.current;
        if (!drag || drag.kind!==kind || drag.pointerId!==e.pointerId) return;
        e.preventDefault();
        const min=kind === "pos" ? 145 : 100;
        const height=Math.max(min,Math.min(1600,Math.round(drag.startHeight + e.clientY - drag.startY)));
        if (height===drag.lastHeight) return;
        drag.lastHeight=height;
        setAreaHeights(prev=>prev[kind]===height?prev:{...prev,[kind]:height});
    }
    function endAreaResize(kind,e) {
        const drag=resizeDragRef.current;
        if (!drag || drag.kind!==kind || drag.pointerId!==e.pointerId) return;
        e.preventDefault();
        try{drag.handle?.releasePointerCapture?.(e.pointerId);}catch{}
        if (drag.handle) drag.handle.dataset.dragging="false";
        resizeDragRef.current=null;
        setResizingKind("");
        persistAreaHeight(kind,drag.lastHeight);
    }
    function resizeAreaByKey(kind,e) {
        if (expandPhaseRef.current !== "idle" || !["ArrowUp","ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const min=kind === "pos" ? 145 : 100;
        const delta=(e.shiftKey?24:8)*(e.key==="ArrowDown"?1:-1);
        const height=Math.max(min,Math.min(1600,Math.round((areaHeights[kind]||min)+delta)));
        setAreaHeights(prev=>({...prev,[kind]:height}));
        persistAreaHeight(kind,height);
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
    const [saveOutput,setSaveOutput]=React.useState(L.saveOutput!==false);
    const [savePath,setSavePath]=React.useState(L.savePath || "");
    const [referenceImage,setReferenceImage]=React.useState(()=>normalizeImageControls(L).referenceImage);
    const [inpaint,setInpaint]=React.useState(()=>normalizeImageControls(L).inpaint);
    const [scene3DOpening,setScene3DOpening]=React.useState(false);
    const [anima3d,setAnima3d]=React.useState(()=>normalizeImageControls(L).anima);
    const [animaDownloads,setAnimaDownloads]=React.useState({});
    const [animaDownloading,setAnimaDownloading]=React.useState({});
    const [animaNodeInstalling,setAnimaNodeInstalling]=React.useState(false);
    function changeAnima(next){const v=normalizeScene3D(next);setAnima3d(v);try{USER.last={...(USER.last||{}),anima:v};saveUser();}catch{}if(v?.enabled){setReferenceImage(cur=>cur?{...cur,enabled:false}:cur);}}
    const openAnima=useScene3DWindow({value:anima3d,onChange:changeAnima,onApply:next=>{changeAnima(next);setSizeMultiplier(1);setMsg('Anima 3D 控制图已用于生成');},theme,width:Number(w),height:Number(hh),onError:message=>setMsg(message),onLoading:setScene3DOpening});
    const [animaNode,setAnimaNode]=React.useState(true);
    React.useEffect(()=>{jget(EXPANDER+'/anima/models',6000).then(r=>{setAnimaDownloads(Object.fromEntries(((r&&r.models)||[]).map(m=>[m.file,!!m.installed])));setAnimaNode(!!(r&&r.node&&r.node.installed));}).catch(()=>{});},[]);
    const installAnimaNode=async()=>{setAnimaNodeInstalling(true);try{await jpost(EXPANDER+'/anima/nodes/install',{},300000);setAnimaNode(true);setMsg('Anima 节点已安装，请重启 ComfyUI 后生效');}catch(e){setMsg('节点安装失败：'+errText(e));}finally{setAnimaNodeInstalling(false);}};
    const downloadAnimaModel=async file=>{if(!file)return;setAnimaDownloading(cur=>({...cur,[file]:true}));try{const r=await jpost(EXPANDER+'/anima/models/download',{file},300000);setAnimaDownloads(cur=>({...cur,[file]:true}));setMsg('模型已下载：'+file+'（'+Math.round((r?.size||0)/1048576)+' MB）');}catch(e){setMsg('模型下载失败：'+errText(e));}finally{setAnimaDownloading(cur=>({...cur,[file]:false}));}};
    const [scene3d,setScene3d]=React.useState(()=>SCENE3D_RUNTIME.value);
    React.useEffect(()=>{SCENE3D_RUNTIME.value=scene3d;},[scene3d]);
    const generationReference=(scene3d?.enabled||anima3d?.enabled)?null:referenceImage;
    const animaControlImage=anima3d?.enabled?(/regional/i.test(String(anima3d.controlnet?.model||''))?(anima3d.regionAsset||anima3d.asset||null):(anima3d.asset||null)):null;
    const activeImage=activeImageControl(generationReference,inpaint)||(animaControlImage?{enabled:true,asset:animaControlImage,mode:'reference',denoise:1}:null);
    const openScene3D=useScene3DWindow({value:scene3d,onChange:changeScene3D,onApply:next=>{changeScene3D(next);setSizeMultiplier(1);setMsg('3D 镜头截图已用于生成');},theme,width:Number(w),height:Number(hh),onError:message=>setMsg(message),onLoading:setScene3DOpening});
    const [sizeMultiplier,setSizeMultiplier]=React.useState(Number(L.sizeMultiplier) || 1);
    const [customSizeSelected,setCustomSizeSelected]=React.useState(false);
	/** Seed 在提交后按模式推进；用户手动改值不会改变模式。 */
	const [seed, setSeed] = React.useState(L.seed || 0);
    const [seedMode,setSeedMode]=React.useState(L.seedMode || (L.lockSeed ? "lock" : "random"));
	const [samplingProfile,setSamplingProfile]=React.useState(L.samplingProfile||'');
	const [samplingValues,setSamplingValues]=React.useState(()=>L.samplingValues&&typeof L.samplingValues==='object'?L.samplingValues:{});
	const activeSamplingProfile=samplingProfile||(profile.advanced?'custom-advanced':'ksampler');
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
    const [postOpen,setPostOpen]=React.useState(()=>{try{return window.localStorage.getItem('dsh-comfyui-console/post-open')==='1'}catch{return false}});
    React.useEffect(()=>{try{window.localStorage.setItem('dsh-comfyui-console/post-open',postOpen?'1':'0')}catch{}},[postOpen]);
    const [workflowLibraryRevision,setWorkflowLibraryRevision]=React.useState(0);
    const editPostWorkflow=usePostWorkflowWindow(setPostControls,theme,message=>setMsg(message),()=>setWorkflowLibraryRevision(v=>v+1));
    const [showModelGuide,setShowModelGuide]=React.useState(false);
    const generationKey=JSON.stringify({scene3d,referenceImage,inpaint,postControls,modelConfig,ckpt,clip,clipType,vae,selLoras,pos,neg,w,hh,steps,cfg,sampler,scheduler,seed,seedMode,saveOutput,savePath,sizeMultiplier,upscale,upscaleModel,upscaleFactor,prefix});
    const generationKeyRef=React.useRef(generationKey);generationKeyRef.current=generationKey;
    const modelIdentityRef=React.useRef(modelConfig.identity);modelIdentityRef.current=modelConfig.identity;
    React.useEffect(()=>{if(modelCheckRef.current)cancelModelCheck();},[generationKey]);

	const [msg, setMsg] = useStatusState("");
    const [sidecarRestarting,setSidecarRestarting]=React.useState(false);
    const sidecarRestartRef=React.useRef(false);
    const refreshSidecarAndPage=async()=>{
        if(sidecarRestartRef.current)return;
        sidecarRestartRef.current=true;setSidecarRestarting(true);
        setMsg("正在安全重启 Sidecar…");
        try{
            await jpost(EXPANDER+"/sidecar/restart",{},8000);
            setMsg("Sidecar 正在重启；服务恢复后会自动刷新页面");
            const deadline=Date.now()+45000;let disconnected=false,ready=false;
            while(Date.now()<deadline){
                try{
                    const health=await jget(EXPANDER+"/health?restart_probe="+Date.now(),1500);
                    if(disconnected&&health?.ok===true&&health.service==="dsh-comfyui-console"&&health.apiVersion===REQUIRED_SIDECAR_API){ready=true;break;}
                }catch{disconnected=true;}
                await new Promise(resolve=>setTimeout(resolve,500));
            }
            if(!ready)throw new Error("Sidecar 尚未恢复。请稍候后手动刷新页面。");
            setMsg("Sidecar 已恢复，正在刷新页面…");
            setTimeout(()=>window.location.reload(),300);
        }catch(error){
            setMsg("刷新失败："+errText(error));
            sidecarRestartRef.current=false;setSidecarRestarting(false);
        }
    };
	// 对话默认收起；聊天记录只在当前 DSH 进程中保留。
	const [exOpen, setExOpen] = React.useState(false);
    const promptGuideChatRestoreRef = React.useRef(false);
    const postGuideRestoreRef = React.useRef(false);
	const [exLog, rawSetExLog] = React.useState(() => CHAT_SESSION.log.slice());
    function setExLog(updater) {
        const next = typeof updater === "function" ? updater(CHAT_SESSION.log) : updater;
        CHAT_SESSION.log = next.slice();
        rawSetExLog(next);
    }
	const [exIn, setExIn] = React.useState("");
	const [exBusy, setExBusy] = React.useState(false);
	const [presetName, setPresetName] = React.useState("");
	const [presetCat, setPresetCat] = React.useState("默认");
	/** ComfyUI 工作流导入 */
	const [wfText, setWfText] = React.useState("");
	const [wfResult, setWfResult] = React.useState(null);

    const [showLaunch,setShowLaunch]=React.useState(false);
    const [launchInfo,setLaunchInfo]=React.useState(null);
    const [launchError,setLaunchError]=useErrorState("");
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
    const autocomplete=useTagCompletion({updatePrompt,promptRef,expandPhaseRef,theme,
        enabled:dictionaryReady,underscores:false,category:""});
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
    React.useEffect(()=>{autocomplete.close();},[tab,expandPhase]);

	// 生成任务与本次 DSH 会话输出订阅。
    const [tasks,setTasks]=React.useState(BG.tasksSnapshot());
    const [sessionOutputs,setSessionOutputs]=React.useState(SESSION_OUTPUTS.snapshot());
	React.useEffect(() => BG.subscribe(() => setTasks(BG.tasksSnapshot())), []);
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
    const [outputPreviewSize,setOutputPreviewSize]=React.useState(USER.outputPreviewSize==="large"?"large":"small");
    const [outputDetail,setOutputDetail]=React.useState(null);
    const [outputImageBusy,setOutputImageBusy]=React.useState(false),[outputImageError,setOutputImageError]=useErrorState(''),[outputImageEditor,setOutputImageEditor]=React.useState(null);
    const outputImageTask=React.useRef(null);
    React.useEffect(()=>{setOutputImageError('');setOutputImageBusy(false);return()=>{outputImageTask.current?.abort();outputImageTask.current=null;};},[outputDetail?.url]);

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
        if(!CONSOLE_TABS.includes(next))next="gen";
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
                try{const [unet,gguf]=await Promise.all([jget(COMFY+"/object_info/UNETLoader",10000),jget(COMFY+"/object_info/UnetLoaderGGUF",10000).catch(()=>({}))]);if(dead)return;setDiffusions([...new Set([...comboOptions(unet,"UNETLoader","unet_name"),...comboOptions(gguf,"UnetLoaderGGUF","unet_name")])]);setWeightTypes(comboOptions(unet,"UNETLoader","weight_dtype"));}catch{if(!dead)setDiffusions([]);}
				setCkpt((cur) => cur || (c[0] || ""));
			};
            try {
                // 自动连接只检测真实 API，不主动启动 ComfyUI。
                await jget(COMFY + "/system_stats", 6000);
            } catch (e) {
                if (!dead) { onlineRef.current = false; setOnline(false);
                    setMsg("ComfyUI 离线：" + errText(e) + "。可点击「连接 ComfyUI」。", {silent:true}); }
                return;
            }
            if (dead) return;
            onlineRef.current = true;
            setOnline(true);
            try {
                await loadMeta();
                await BG.adopt();
                if (!dead && !BG.snapshot()) setMsg("就绪");
            } catch (e) {
                if (!dead) setMsg("ComfyUI 已连接，但模型列表加载失败：" + errText(e));
            }

		})();
		return () => { dead = true; };
	}, [conn]);


    // Sidecar 负责探测真实 ComfyUI API；前端只读取 sidecar 状态，不直连 Windows 端口。
    // 外部手动启动 / 关闭 ComfyUI 时，5 秒内同步按钮与模型列表。
    React.useEffect(() => {
        let disposed = false, polling = false, misses = 0;
        const tick = async () => {
            if (disposed || polling || operationRef.current) return;
            polling = true;
            try {
                const st = await jget(EXPANDER + "/comfy/online", 4500);
                if (disposed || operationRef.current) return;
                const running = !!st.running;
                if (running) {
                    misses = 0;
                    if (onlineRef.current !== true) {
                        onlineRef.current = true;
                        setOnline(true);
                        setMsg("检测到 ComfyUI 已运行，正在加载模型…");
                        setConn((v) => v + 1);
                        if (BG.jobs.some(j => ['queued','running'].includes(j.status))) BG.startWatch();
                    }
                } else if (onlineRef.current !== false) {
                    // 生成时 /system_stats 可能短暂无响应；连续 3 次（约 15s）失败才判离线，
                    // 且不终止任务——任务轮询失败会自行重试，恢复后继续。
                    misses += 1;
                    if (misses >= 3) {
                        onlineRef.current = false;
                        setOnline(false);
                        setMsg("ComfyUI 连接中断（任务保留，恢复后继续）；可点击「连接 ComfyUI」重试", {silent:true});
                    }
                }
            } catch (e) {
                if (!disposed && !operationRef.current && onlineRef.current !== false) {
                    misses += 1;
                    if (misses >= 3) {
                        onlineRef.current = false;
                        setOnline(false);
                        setMsg("无法访问插件服务（任务保留）；请检查 sidecar：" + errText(e));
                    }
                }
            } finally { polling = false; }
        };
        const timer = setInterval(tick, 5000);
        return () => { disposed = true; clearInterval(timer); };
    }, []);

    async function releaseGpuMemory(){
        setMsg('释放显存中…');
        try{
            const result=await jpost(EXPANDER+'/comfy/unload',{},40000);
            if(result?.ok){
                setMsg('已释放显存');
                notifySuccess('显存释放成功',{key:'vram-unload-success',cooldown:0});
            }else setMsg('失败：'+(result?.message||'无法释放显存'));
        }catch(error){setMsg('失败：'+errText(error));}
    }
    // RuntimeDashboard shares the Sidecar's native ComfyUI progress feed.
    // Browser-to-ComfyUI WebSockets are blocked by the native Host/Origin check.

	// 参数变了就记住（下次进来还在）
	React.useEffect(() => {
		if(!ensureModelSettingsBackup()){setMsg("配置备份失败，本次设置尚未保存；请检查浏览器存储空间");return;}
        USER.modelConfigs={...USER.modelConfigs,[modelConfigKey(modelConfig,ckpt)]:currentModelSetup()};
        USER.last = {modelConfig:{...modelConfig}, ckpt, clip, clipType, vae, loras: selLoras, pos, neg, w, h: hh, steps, cfg, sampler, scheduler, samplingProfile, samplingValues, prefix, seed, seedMode, saveOutput, savePath, sizeMultiplier, scene3d:null, anima:normalizeScene3D(anima3d), referenceImage, inpaint, viewKey, postControls, upscale, upscaleModel, upscaleFactor };
		if(!saveUser())setMsg("当前设置未保存，请检查浏览器存储空间");
	}, [modelConfig,ckpt, clip, clipType, vae, selLoras, pos, neg, w, hh, steps, cfg, sampler, scheduler, prefix, seed, seedMode, saveOutput, savePath, sizeMultiplier, scene3d, referenceImage, inpaint, viewKey, postControls, upscale, upscaleModel, upscaleFactor]);

	// ---- 连接与教程 ----
    function openGuide(key) {
        if (!TUTORIALS[key]) return;
        if (key === "post") { postGuideRestoreRef.current = postOpen; setPostOpen(false); }
        if (key === "model") { closeModelLibrary(); setModelControlsOpen(false); }
        if (key === "basic") { promptGuideChatRestoreRef.current=exOpen;setExOpen(false);setShowModelGuide(false);closeModelLibrary();setModelControlsOpen(false); }
        if (key === "output") switchTab("output");
        else if (key === "online") switchTab("online");
        else if (key === "basic" || key === "model" || key === "image" || key === "prompt" || key === "anima") switchTab("gen");
        if (key === "prompt") {
            promptGuideChatRestoreRef.current = exOpen;
            promptGuidePreviewRestoreRef.current = previewMode;
            setExOpen(false);
            setPreviewMode("raw");
            switchTab("gen");
        }
        setGuide(key); setGuideStep(0); setGuideMenu(false); setShowSettings(false); setShowLaunch(false);
    }
    function moveGuide(next) {
        if (!guide) return;
        const steps = TUTORIALS[guide].steps;
        const target = Math.max(0, Math.min(steps.length - 1, next));
        const step = steps[target];
        setGuideStep(target);
        if (step.openSettings) { setShowSettings(true); setSettingsSection("connection"); }
        if (guide === "basic") setShowModelGuide(!!step.openModelGuide);
        if (guide === "model") {
            const kind=modelConfig.mode==='diffusion'?'diffusion':'checkpoint',main=modelConfig.mode==='diffusion'?modelConfig.main:ckpt;
            if (step.openModelLibrary) { setModelControlsOpen(false); if (!showModelLibrary) openModelLibrary(kind,main); }
            else if (step.openGenerationControls) { closeModelLibrary(); setModelControlsOpen(true); }
            else { closeModelLibrary(); setModelControlsOpen(false); }
        }
        if (guide === "post") setPostOpen(!!step.openPostControls);
        if (guide === "anima") {
            setModelControlsOpen(!!step.openGenerationControls);
            if (step.autoAdd === "anima" && !anima3d) addModelComponent("anima");
        }
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
        if (key === "basic") {setShowModelGuide(false);setExOpen(promptGuideChatRestoreRef.current);}
        if (key === "model") { closeModelLibrary(); setModelControlsOpen(false); }
        // 设置路径教程结束后保持弹窗打开，允许用户真正输入并保存。
        setShowSettings(key === "startPath" || key === "connect");
        if (key === "startPath") setConnNotice("请填写本机 ComfyUI 启动文件路径，然后保存设置。");
        if (key === "startPath" || key === "connect") {
            setTimeout(() => {
                try { document.querySelector('[data-cc-guide="start-script"]')?.focus(); } catch {}
            }, 30);
        }
    }
    function maybeStartBasicTutorial(e) {
        if (e && e.button !== undefined && e.button !== 0) return;
        if (guide || guideMenu || !consumeFirstTutorialUse("basic")) return;
        if (e?.target?.closest?.('[data-cc-guide="tutorial-menu"]')) return;
        e?.preventDefault?.();
        e?.stopPropagation?.();
        openGuide("basic");
    }
    async function stopStartup(){
        const attempt=launchAttempt.current;if(!attempt||attempt.cancelRequested)return;
        attempt.cancelRequested=true;setStoppingStart(true);
        try{
            const result=await jpost(EXPANDER+'/comfy/startup/cancel',{attempt:attempt.id},30000);
            if(!result?.ok)throw Error(result?.message||'停止启动失败');
            attempt.controller.abort();setMsg(result.message||'已停止启动');
            const state=await jget(EXPANDER+'/comfy/online',4500);
            onlineRef.current=!!state.running;setOnline(!!state.running);if(state.running)setConn(v=>v+1);
        }catch(e){attempt.cancelRequested=false;setMsg('停止启动失败：'+errText(e));}
        finally{setStoppingStart(false);}
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
        const attempt=mode?{id:crypto.randomUUID(),startedAt:Date.now(),controller:new AbortController(),cancelRequested:false}:null;
        launchAttempt.current=attempt;setStartSession(attempt?{id:attempt.id,startedAt:attempt.startedAt}:null);
        const checkCancelled=()=>{if(attempt?.cancelRequested)throw new Error('已停止启动');};
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
                BG.shutdown();
                onlineRef.current = false; setOnline(false); setMsg(r.message || "ComfyUI 已完全关闭");
                return;
            }
            setMsg("正在检测本机 ComfyUI…");
            // 先探测，避免状态轮询尚未更新时重复启动已经运行的 ComfyUI。
            const st = await jget(EXPANDER + "/comfy/online", 6000);
            checkCancelled();
            if (st.running) {
                onlineRef.current = true; setOnline(true); setMsg("已检测到 ComfyUI，复用现有服务，正在读取模型…");
                if(mode==="browser") await openBrowser();
                setConn((v) => v + 1);
                return;
            }
            const settings = await jget(EXPANDER + "/settings", 5000);
            checkCancelled();
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
                    setShowSettings(true);
                }
                return;
            }
            await requireSidecarFeature("startupProgressVersion",1,"启动控制台");
            checkCancelled();
            setMsg(mode==="background"?"正在后台启动 ComfyUI…":mode==="browser"?"正在以前台模式启动 ComfyUI…":"正在启动 ComfyUI…");
            const r = await jpost(EXPANDER + "/comfy/start", {mode,attempt:attempt?.id}, mode==="background"?135000:100000,attempt?.controller.signal);
            checkCancelled();
            if (!r?.ok) throw new Error(r?.message || "启动失败");
            if(mode==="browser"){
                // 原脚本直启时由脚本/ComfyUI 自己开网页；只有 sidecar 明确报告失败才兜底。
                if(r.browserOpened===false){ await openBrowser(); }
                else setBrowserFallback("");
            }
            onlineRef.current=true;setOnline(true);
            setMsg((r.message || "已启动") + "，正在读取模型列表…"+(r.launch?.warning?" · "+r.launch.warning:""));
            setConn((v) => v + 1);
        } catch (e) {
            if(attempt?.cancelRequested)return;
            const detail = errText(e);
            setMsg("ComfyUI 操作失败：" + detail);
            // 不假定停止/启动失败一定离线：让状态轮询下一轮核实。
            if (onlineRef.current !== true) setOnline(false);
        } finally {
            if(launchAttempt.current===attempt)launchAttempt.current=null;
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

	// ---- 动作 ----
	function toggleLora(name) {
		setSelLoras((cur) => {
			const i = cur.findIndex((x) => x.name === name);
			if (i >= 0) { const n = cur.slice(); n.splice(i, 1); return n; }
			return cur.concat([{ name: name, model: 1, clip: 1 }]);
		});
	}
	function setLoraW(name, v) {
		setSelLoras((cur) => cur.map((x) => (x.name === name ? Object.assign({}, x, { model: Number(v), clip: Number(v) }) : x)));
	}

	async function doGen() {
        if(online===false){notifyComfyOffline("生成图片");return;}
        if(modelCheckRef.current||modelFileChecking)return;
        const generationAtSubmit=generationKeyRef.current;
        const scaled=generationImageSize(activeImage,w,hh,sizeMultiplier,profile.sizeStep||8),baseSize=referenceBaseSize(activeImage,w,hh),usedSteps=profile.fixedSteps??Number(steps);
        const setup=effectiveModelSetup({ckpt,clip,clipType,vae,modelConfig:{...modelConfig},loras:selLoras.map(x=>({...x})),steps:usedSteps,sampler,scheduler});
        const setupErrors=[...modelSetupErrors(setup),...inpaintErrors(inpaint),...(scene3d?.enabled&&!scene3d.asset?['请先在3D编辑器中点击用于生成，截取镜头']:[])];
        if(setupErrors.length){setMsg(setupErrors.join("；"));return;}
		if (![scaled.w, scaled.h, usedSteps, profile.negative?cfg:1].every((v) => Number.isFinite(Number(v))) ||
			Number(scaled.w) < 64 || Number(scaled.h) < 64 || Number(scaled.w) > 8192 || Number(scaled.h) > 8192 ||
			Number(scaled.w) % (profile.sizeStep||8) || Number(scaled.h) % (profile.sizeStep||8) || usedSteps < 1 || usedSteps > 10000 || (profile.negative&&Number(cfg) < 0)) {
			setMsg("参数无效：最终宽高需是 64–8192 之间的 "+(profile.sizeStep||8)+" 的倍数，步数至少为 1，CFG 不小于 0"); return;
		}

        const autoPost=postControls.autoExecute!==false&&postControls.cells.some(c=>c.enabled!==false);
        const targetSavePath=(saveOutput||autoPost)?(savePath || settingsInfo?.outputRoot || ''):'';
        if((saveOutput||autoPost)&&!targetSavePath){setMsg("无法确定保存目录，请选择保存路径");return;}
		touch(); switchTab("gen");
        const current=Number(seed)||0;
        const usedSeed=seedMode==='random'?Math.floor(Math.random()*1e15):Math.max(0,current);
		setLastSeed(usedSeed);
        const graphOptions={...setup,sampling:{profile:activeSamplingProfile,values:samplingValues},pos,neg,scene3d:normalizeScene3D(scene3d),anima:normalizeScene3D(anima3d),referenceImage:normalizeReferenceImage(generationReference),inpaint:normalizeInpaint(inpaint),baseW:baseSize.w,baseH:baseSize.h,sizeMultiplier:Number(sizeMultiplier)||1,w:scaled.w,h:scaled.h,steps:usedSteps,cfg:Number(cfg),sampler,scheduler,seed:usedSeed,prefix,postControls:autoPost?postClone(postControls):null};
        let graph;let submitted;
        const ctl=new AbortController();modelCheckRef.current=ctl;setModelCheck(true);
        try{
            setMsg("正在检查当前 ComfyUI 节点与文件列表…");
            if(inpaint&&inpaint.enabled!==false){
                if(!inpaint.asset)throw Error('请先导入局部重绘底图');
                if(!inpaint.mask)throw Error('请先绘制并应用遮罩');
                const health=await jget(EXPANDER+'/health',6000,ctl.signal);if(health.referenceImagesVersion!==1)throw Error('请更新并重启 Sidecar，以支持局部重绘');
                setMsg('正在准备局部重绘底图与遮罩…');
                const base=await jpost(EXPANDER+'/references/prepare',{id:inpaint.asset.id},60000,ctl.signal);
                const mask=await jpost(EXPANDER+'/references/prepare',{id:inpaint.mask.id},60000,ctl.signal);
                if(ctl.signal.aborted||generationKeyRef.current!==generationAtSubmit)throw Error('设置已变化，请重新生成');
                graphOptions.inpaintInput=base.input;graphOptions.inpaintMaskInput=mask.input;
            }else if(scene3d?.enabled){
                const cn=normalizeScene3DControlnet(scene3d.controlnet);
                if(!scene3d.asset)throw Error('请先在3D编辑器中点击用于生成，截取镜头');
                if(!cn||!cn.model)throw Error('请为3D参考选择 ControlNet 模型');
                const controlImage=cn.status==='done'&&cn.asset?cn.asset:scene3d.asset;
                setMsg('正在准备 ControlNet 控制图…');
                const prepared=await jpost(EXPANDER+'/references/prepare',{id:controlImage.id},60000,ctl.signal);
                if(ctl.signal.aborted||generationKeyRef.current!==generationAtSubmit)throw Error('设置已变化，请重新生成');
                graphOptions.scene3dImage=prepared.input;
            }else if(anima3d?.enabled){
                const cn=normalizeScene3DControlnet(anima3d.controlnet);
                const animaModel=String(anima3d.controlnet?.model||'');
                const animaAsset=/regional/i.test(animaModel)?(anima3d.regionAsset||anima3d.asset):anima3d.asset;
                if(!animaAsset)throw Error(/regional/i.test(animaModel)?'请先编辑区域色块图':'请先在 Anima 3D 编辑器中截取镜头');
                if(!cn||!cn.model)throw Error('请为 Anima control 选择模型');
                if(animaDownloads[cn.model]===false)throw Error('所选 Anima 模型尚未下载，请先点【下载模型】');
                setMsg('正在准备 Anima 控制图…');
                const prepared=await jpost(EXPANDER+'/references/prepare',{id:animaAsset.id},60000,ctl.signal);
                if(ctl.signal.aborted||generationKeyRef.current!==generationAtSubmit)throw Error('设置已变化，请重新生成');
                graphOptions.animaImage=prepared.input;
            }else if(generationReference&&generationReference.enabled!==false){
                if(!generationReference.asset)throw Error('请先选择图生图，或关闭图生图控制');
                const health=await jget(EXPANDER+'/health',6000,ctl.signal);if(health.referenceImagesVersion!==1)throw Error('请更新并重启 Sidecar，以支持图生图');
                setMsg('正在准备图生图…');const prepared=await jpost(EXPANDER+'/references/prepare',{id:generationReference.asset.id},60000,ctl.signal);
                if(ctl.signal.aborted||generationKeyRef.current!==generationAtSubmit)throw Error('设置已变化，请重新生成');
                graphOptions.referenceInput=prepared.input;
            }
            if(autoPost){const health=await jget(EXPANDER+'/health',6000,ctl.signal);if(health.postControlsVersion!==1)throw Error('Sidecar 尚未更新生成后控制接口，请重启 DSH 和 Sidecar');}
            const postInfo=autoPost?await jget(COMFY+'/object_info',30000,ctl.signal):{};
            graph=buildGraph(graphOptions,postInfo);
            const dims=postDims(graphOptions);
            submitted={...setup,ckpt:modelConfig.mode==='checkpoint'?ckpt:'',loras:activeModelLoras(setup.loras).map(x=>profile.modelOnlyLora?{...x,clip:0,modelOnly:true}:x),pos,neg,negativeApplied:profile.negative,effectiveCfg:profile.negative?Number(cfg):1,
                scene3d:normalizeScene3D(scene3d),anima:normalizeScene3D(anima3d),referenceImage:normalizeReferenceImage(generationReference),inpaint:normalizeInpaint(inpaint),denoise:activeImage?.enabled!==false&&activeImage?.asset?Number(activeImage.denoise):1,baseW:baseSize.w,baseH:baseSize.h,sizeMultiplier:Number(sizeMultiplier)||1,w:scaled.w,h:scaled.h,outputW:dims.w,outputH:dims.h,
                steps:usedSteps,cfg:Number(cfg),sampler,scheduler:profile.advanced||scheduler,samplingProfile:activeSamplingProfile,samplingValues,prefix,usedSeed,seedMode,saveOutput,savePath:targetSavePath,postSaveOutput:true,postControls:postClone(postControls),postEnabled:autoPost,viewKey};
            const names=[...new Set(Object.values(graph).map(n=>n.class_type))];
            const entries=await Promise.all(names.map(async name=>{const info=await jget(COMFY+"/object_info/"+name,12000,ctl.signal);return [name,info[name]];}));
            if(ctl.signal.aborted||modelCheckRef.current!==ctl)return;
            if(generationKeyRef.current!==generationAtSubmit)throw Error("设置已变化，请重新生成");
            const errors=validateModelGraph(graph,Object.fromEntries(entries));if(errors.length)throw Error(errors.join("；"));
        }catch(e){if(!ctl.signal.aborted){setMsg("未提交："+errText(e));notifyError(e,{title:"无法生成"});}ctl.abort();return;}
        finally{if(modelCheckRef.current===ctl){modelCheckRef.current=null;setModelCheck(false);}}
        if(ctl.signal.aborted)return;
        let workflowUI=null;try{workflowUI=apiToWorkflow(graph,Object.fromEntries(entries));}catch(e){}
        const ok=await BG.run(graph,submitted,workflowUI);
        if(ok){
            if(seedMode==='increment')setSeed(usedSeed+1);
            else if(seedMode==='decrement')setSeed(Math.max(0,usedSeed-1));
            else if(seedMode==='random')setSeed(Math.floor(Math.random()*1e15));
            setMsg(saveOutput?'任务已提交到队列；首轮采样和生成后控制结果将分别保存到 '+targetSavePath:autoPost?'任务已提交到队列；生成后控制结果将保存到 '+targetSavePath:'任务已提交到队列；本次首轮采样仅 Temp 预览');
        }
	}

    async function runPostProcessing(inputValue=postControls.input){
        const post=normalizePost({...postControls,input:inputValue}),cells=post.cells.filter(c=>c.enabled!==false),localInpaint=post.inpaint?.enabled!==false&&post.inpaint;
        if(modelCheckRef.current||modelFileChecking)return;
        if(!inputValue?.asset){setMsg('请先导入要处理的图片');return;}
        if(!cells.length&&!localInpaint){setMsg('请先添加图片处理');return;}
        if(localInpaint&&(!localInpaint.mask||!localInpaint.coverage)){setMsg('局部重绘还没有遮罩，请先编辑遮罩');return;}
        const sourceParams=inputValue.sourceOutput?.params||null,modelSource=post.modelSource||'upper',parameterSource=localInpaint?.parameterSource||'upper',customParams=localInpaint?.customParameters||{},customSetup=post.customModelSetup||{},useOriginalModel=modelSource==='original'&&!!sourceParams;
        const selectedCkpt=useOriginalModel?(sourceParams.ckpt??ckpt):modelSource==='custom'?(customSetup.ckpt??ckpt):ckpt,selectedClip=useOriginalModel?(sourceParams.clip??clip):modelSource==='custom'?(customSetup.clip??clip):clip,selectedClipType=useOriginalModel?(sourceParams.clipType??clipType):modelSource==='custom'?(customSetup.clipType??clipType):clipType,selectedVae=useOriginalModel?(sourceParams.vae??vae):modelSource==='custom'?(customSetup.vae??vae):vae;
        const selectedModelConfig=useOriginalModel&&sourceParams.modelConfig?sourceParams.modelConfig:modelSource==='custom'?(customSetup.modelConfig||modelConfig):modelConfig,selectedLoras=useOriginalModel&&Array.isArray(sourceParams.loras)?sourceParams.loras:modelSource==='custom'&&Array.isArray(customSetup.loras)?customSetup.loras:selLoras;
        const globalSteps=useOriginalModel?(sourceParams.steps??steps):modelSource==='custom'?(customSetup.steps??steps):steps,globalCfg=useOriginalModel?(sourceParams.cfg??cfg):modelSource==='custom'?(customSetup.cfg??cfg):cfg,globalSampler=useOriginalModel?(sourceParams.sampler??sampler):modelSource==='custom'?(customSetup.sampler||sampler):sampler,globalScheduler=useOriginalModel?(sourceParams.scheduler??scheduler):modelSource==='custom'?(customSetup.scheduler||scheduler):scheduler;
        const useOriginalSampling=parameterSource==='original'&&!!sourceParams,selectedSteps=useOriginalSampling?(sourceParams.steps??globalSteps):parameterSource==='custom'?(customParams.steps??globalSteps):globalSteps;
        const selectedCfg=useOriginalSampling?(sourceParams.cfg??globalCfg):parameterSource==='custom'?(customParams.cfg??globalCfg):globalCfg;
        const selectedSampler=useOriginalSampling?(sourceParams.sampler??globalSampler):parameterSource==='custom'?(customParams.sampler||globalSampler):globalSampler;
        const selectedScheduler=useOriginalSampling?(sourceParams.scheduler??globalScheduler):parameterSource==='custom'?(customParams.scheduler||globalScheduler):globalScheduler;
        const selectedSeed=useOriginalSampling?(sourceParams.usedSeed??sourceParams.seed??seed):seed;
        const selectedPos=localInpaint?.prompt?.trim()||pos,selectedNeg=useOriginalSampling||useOriginalModel?(sourceParams?.neg??neg):neg;
        const setup=effectiveModelSetup({ckpt:selectedCkpt,clip:selectedClip,clipType:selectedClipType,vae:selectedVae,modelConfig:{...selectedModelConfig},loras:selectedLoras.map(x=>({...x})),steps:Number(selectedSteps),sampler:selectedSampler,scheduler:selectedScheduler});
        const setupErrors=modelSetupErrors(setup);if(setupErrors.length){setMsg(setupErrors.join('；'));return;}
        const width=Number(inputValue.asset.width)||Number(w),height=Number(inputValue.asset.height)||Number(hh),usedSeed=Math.max(0,Number(selectedSeed)||0),ctl=new AbortController();modelCheckRef.current=ctl;setModelCheck(true);
        try{
            setMsg('正在准备图片处理…');
            const health=await jget(EXPANDER+'/health',6000,ctl.signal);if(health.referenceImagesVersion!==1)throw Error('请更新并重启 Sidecar，以支持图片输入');
            const input=await jpost(EXPANDER+'/references/prepare',{id:inputValue.asset.id},60000,ctl.signal);
            const options={...setup,pos:selectedPos,neg:selectedNeg,scene3d:null,referenceImage:null,inpaint:null,baseW:width,baseH:height,sizeMultiplier:1,w:width,h:height,steps:Number(selectedSteps),cfg:Number(selectedCfg),sampler:selectedSampler,scheduler:selectedScheduler,seed:usedSeed,prefix,postControls:postClone(post)};
            if(localInpaint){
                if(localInpaint.asset?.id!==inputValue.asset.id)throw Error('局部重绘底图与图片输入不一致，请重新编辑遮罩');
                const mask=await jpost(EXPANDER+'/references/prepare',{id:localInpaint.mask.id},60000,ctl.signal);
                options.inpaint=normalizeInpaint({...localInpaint,asset:inputValue.asset,enabled:true});options.inpaintInput=input.input;options.inpaintMaskInput=mask.input;
            }else options.postInput=input.input;
            const info=await jget(COMFY+'/object_info',30000,ctl.signal),graph=buildGraph(options,info),names=[...new Set(Object.values(graph).map(n=>n.class_type))];
            const entries=await Promise.all(names.map(async name=>{const nodeInfo=await jget(COMFY+'/object_info/'+name,12000,ctl.signal);return [name,nodeInfo[name]];}));
            const errors=validateModelGraph(graph,Object.fromEntries(entries));if(errors.length)throw Error(errors.join('；'));
            const targetSavePath=savePath||settingsInfo?.outputRoot||'';if(!targetSavePath)throw Error('无法确定保存目录，请选择保存路径');
            const selectedProfile=modelProfile(setup.modelConfig),dims=postDims({...options,postControls:post});const submitted={...setup,ckpt:setup.modelConfig.mode==='checkpoint'?setup.ckpt:'',loras:activeModelLoras(setup.loras),pos:selectedPos,neg:selectedNeg,negativeApplied:selectedProfile.negative,effectiveCfg:selectedProfile.negative?Number(selectedCfg):1,scene3d:null,referenceImage:null,inpaint:options.inpaint,denoise:localInpaint?Number(localInpaint.denoise):1,w:width,h:height,outputW:dims.w,outputH:dims.h,steps:Number(selectedSteps),cfg:Number(selectedCfg),sampler:selectedSampler,scheduler:selectedProfile.advanced||selectedScheduler,prefix,usedSeed,seedMode:'lock',saveOutput,savePath:targetSavePath,postSaveOutput:true,postControls:post,postEnabled:true,manualPost:true,manualInput:inputValue.asset};
            if(ctl.signal.aborted)return;
            let workflowUI=null;try{workflowUI=apiToWorkflow(graph,info);}catch(e){}
            const ok=await BG.run(graph,submitted,workflowUI);if(ok)setMsg('图片处理任务已提交');
        }catch(e){if(!ctl.signal.aborted){setMsg('图片处理失败：'+errText(e));notifyError(e,{title:'无法处理图片'});}}
        finally{if(modelCheckRef.current===ctl){modelCheckRef.current=null;setModelCheck(false);}}
    }
    function setExpandStatus(next) {
        autocomplete.close();
        expandPhaseRef.current = next;
        setExpandPhase(next);
    }
    async function stopExpand() {
        const request = expandRequestRef.current;
        if (!request || expandPhaseRef.current !== "running") return;
        setExpandStatus("stopping");
        request.controller.abort();
        setMsg("正在停止 AI 扩写…");
        try {
            const response = await jpost(EXPANDER + "/expand/cancel", {request_id:request.id}, 12000);
            setMsg(response?.cancelled ? "AI 扩写已停止" : "已取消本次 AI 结果");
        } catch (e) {
            setMsg("已取消本次扩写结果；后端停止请求失败：" + errText(e));
        } finally {
            if (expandRequestRef.current === request) expandRequestRef.current = null;
            setExpandStatus("idle");
        }
    }
    async function doExpand() {
        if (expandPhaseRef.current !== "idle") return;
        const controller = new AbortController();
        const id = "expand-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
        const request = {id, controller};
        expandRequestRef.current = request;
        setExpandStatus("running");
        const title="AI 扩写";
        setMsg(title+"处理中…");
        try {
            const r = await jpost(EXPANDER + "/expand", {request_id:id,text:pos,negative:profile.negative?neg:"",model_profile:modelConfig.profile}, 195000, controller.signal);
            if (expandRequestRef.current !== request || controller.signal.aborted) return;
            if (!r || typeof r.positive!=="string" || !r.positive) throw new Error("没有返回有效提示词");
            // 扩写结果一次性写入历史记录，撤回一步同时恢复正/负提示词。
            updatePrompt({pos:r.positive, neg:!profile.negative?neg:(r.negative || neg)}, "action", "", true);
            setMsg(title+"完成" + (r.model ? "（" + r.model + "）" : ""));
        } catch (e) {
            if (expandRequestRef.current === request && !controller.signal.aborted) {
                // 超时、断线或后端错误也请求停止 worker，避免留下无人等待的推理任务。
                await jpost(EXPANDER + "/expand/cancel", {request_id:id}, 6000).catch(() => {});
                setMsg(title+"失败：" + errText(e));
            }
        } finally {
            // 点击停止后由 stopExpand 等待后端确认，不能在 fetch abort 时提前解锁。
            if (expandRequestRef.current === request && expandPhaseRef.current !== "stopping") {
                expandRequestRef.current = null;
                setExpandStatus("idle");
            }
        }
    }

	// ==================== 扩写对话框（多轮微调）====================
	// 与 /expand 的区别：/refine 拿"当前标签 + 一条中文指令"，只改该改的地方，
	// 所以可以像聊天一样反复调（"外套换成黑色皮衣""再加夜景霓虹反光"…）。
	async function doRefine() {
		const ins = (exIn || "").trim();
		if (!ins || exBusy || expandPhaseRef.current !== "idle") return;
		const hist = exLog.map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
		setExLog((L) => L.concat([{ role: "user", text: ins }]));
		setExIn("");
		setExBusy(true);
		try {
			const r = await jpost(EXPANDER + "/refine",
				{positive:pos,negative:profile.negative?neg:"",instruction:ins,history:hist,model_profile:modelConfig.profile}, 180000);
			if (!r || (!r.positive && !r.reply)) throw new Error("没返回内容");
			setExLog((L) => L.concat([{
				role: "ai", text: r.reply || "（已更新标签）",
				positive:r.positive,negative:r.negative,model:r.model,modelProfile:modelConfig.profile,negativeApplied:profile.negative,
			}]));
		} catch (e) {
			setExLog((L) => L.concat([{ role: "err", text: "失败：" + errText(e) }]));
		}
		setExBusy(false);
	}

	/** 把某条回复里的标签采用到当前的 正向/负向（只覆盖非空项）。 */
	function adoptRefine(m) {
		if (expandPhaseRef.current !== "idle") return;
        if(m.modelProfile&&m.modelProfile!==modelConfig.profile){setMsg("该回复来自其他模型类型，请重新生成后采用");return;}
        updatePrompt({pos:m.positive||promptRef.current.pos,neg:profile.negative?(m.negative||promptRef.current.neg):promptRef.current.neg});
		setMsg("已采用该轮提示词");
	}

	function exKeyDown(e) {
		if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !e.nativeEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); doRefine(); }
	}

	function renderExDialog(replacement=false) {
        const bubble = (m, i) => {
            const isUser = m.role === "user", isErr = m.role === "err";
            return h("div", {key:i,style:{alignSelf:isUser?"flex-end":"flex-start",maxWidth:"96%",
                background:isUser?"var(--cc-accent-bg)":"var(--cc-control)",
                border:"1px solid var(--cc-border)",borderRadius:8,padding:"8px 9px",fontSize:12,
                display:"flex",flexDirection:"column",gap:7}},
                h("span", {style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}},m.text),
                m.positive || m.negative ? h("div", {style:{display:"flex",flexDirection:"column",gap:6}},
                    h("span", {style:{...S.dim,fontFamily:"ui-monospace,Consolas,monospace",whiteSpace:"pre-wrap",
                        maxHeight:80,overflow:"auto",overflowWrap:"anywhere"}},
                        (m.positive || "").slice(0,220) + ((m.positive || "").length > 220 ? "…" : "")),
                    h("div",{style:{display:"flex",gap:6}},
                        h("button",{type:"button",style:S.btn2,onClick:()=>setViewMessage(m)},"查看提示词"),
                        h("button", {type:"button",style:S.btn2,disabled:expandPhase !== "idle",
                            onClick:()=>adoptRefine(m)}, "采用提示词"))) : null);
        };
        return h("div", {className:"cc-chat-slot","aria-hidden":!exOpen,inert:exOpen?undefined:""},
            h("div", {className:"cc-chat-panel","data-cc-guide":"prompt-chat-panel"},
                h("div", {className:"cc-chat-toolbar"},
                    promptIconButton("arrowLeft","返回提示词",()=>{
                        setExOpen(false);
                        if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>rootRef.current?.querySelector('[data-cc-guide="prompt-chat"]')?.focus({preventScroll:true}));
                    }),
                    h("button", {type:"button",style:S.btn2,disabled:exBusy,onClick:()=>setExLog([])}, "清空记录")),
                h("div", {className:"cc-chat-history",role:"log","aria-label":"对话编辑记录","aria-live":"polite"},
                    exLog.length ? exLog.map(bubble) : h("span", {style:S.dim}, "输入修改要求，AI 会返回可采用的提示词。")),
                h("div", {className:"cc-chat-composer"},
                    h("textarea", {className:"cc-chat-input",style:S.ta,"aria-label":"提示词修改要求",
                        placeholder:"输入修改要求…（Enter 发送，Shift+Enter 换行）",
                        value:exIn,disabled:exBusy || expandPhase !== "idle",
                        onChange:e=>setExIn(e.target.value),onKeyDown:exKeyDown}),
                    exBusy?h("span", {className:"cc-chat-busy",role:"status",style:S.dim}, "AI 正在生成…"):null,
                    promptIconButton(exBusy?"spinner":"arrowUp",exBusy?"正在生成回复":"发送修改要求",doRefine,
                        exBusy || expandPhase !== "idle" || !exIn.trim(),{className:"cc-chat-send",style:{...S.btn,padding:0},props:{"aria-busy":exBusy}}))));
    }

	// ================================================================


	function savePreset() {
		const name = (presetName || "").trim();
		if (!name) { setMsg("先给预设起个名字"); return; }
		const cat = (presetCat || "默认").trim() || "默认";
		const item = {modelConfig:{...modelConfig}, name, cat, pos, neg, w, h: hh, steps, cfg, sampler, scheduler,
			ckpt, clip, clipType, vae, loras: selLoras, prefix, seed, seedMode, sizeMultiplier, scene3d:null, referenceImage, inpaint, saveOutput, savePath, postControls, upscale, upscaleModel, upscaleFactor };
		const list = (USER.presets || []).filter((p) => !(p.name === name && p.cat === cat));
		list.push(item);
		if(!persistPresetList(list)){setMsg("预设保存失败，请检查浏览器存储空间；原预设保留");return;}
		setMsg("已保存预设「" + cat + " / " + name + "」");
		setPresetName("");
	}
	/**
	 * 一键切视角：只改**姿势段 + 构图段 + 前置相机词**，其余逐字不动。
	 *
	 * 为什么不靠"预设"：预设是快照，套用旧预设会把旧构图塞回来，
	 * 而且用户很难察觉。切视角是一条**显式动作**，改了立刻能看见。
	 */
	function switchView(key) {
        if (expandPhaseRef.current !== "idle") return;
		const r = (typeof applyView === 'function') ? applyView(pos, neg, key) : null;
		if (!r || !r.changed) { setMsg("切视角失败：找不到视角定义"); return; }
		updatePrompt({pos:r.pos, neg:profile.negative?r.neg:neg});
		setViewKey(key);
		const v = (typeof VIEWS !== 'undefined' ? VIEWS : []).filter((x) => x.key === key)[0];
		setMsg("已切到「" + (v ? v.label : key) + "」—— 姿势与构图都已替换（改了 " + r.moved + " 段）");
	}

	/**
	 * 把当前提示词按视角设定**校正一遍**（不改视角选择，只保证一致）。
	 * 用在"套用预设之后"：预设里的旧构图会被这一步纠正。
	 */
	function normalizeView() {
        if (expandPhaseRef.current !== "idle") return false;
		const r = (typeof applyView === 'function') ? applyView(pos, neg, viewKey) : null;
		if (r && r.changed) return updatePrompt({pos:r.pos, neg:profile.negative?r.neg:neg});
		return false;
	}

	function loadPreset(p) {
        if (expandPhaseRef.current !== "idle") return;
        updatePrompt({pos:p.pos || "", neg:p.neg || ""});
		if (p.w) setW(p.w);
		if (p.h) setHh(p.h);
		if (p.steps) setSteps(p.steps);
		if (p.cfg !== undefined) setCfg(p.cfg);
		if (p.sampler) setSampler(p.sampler);
		if (p.scheduler) setScheduler(p.scheduler);
		if(p.ckpt||p.modelConfig)restoreModelSetup(p);
		if (p.clip) setClip(p.clip);
		if (p.clipType) setClipType(p.clipType);
		if (p.vae) setVae(p.vae);
		if (p.prefix) setPrefix(p.prefix);
		if (p.seed !== undefined) setSeed(p.seed);
		if (p.seedMode) setSeedMode(p.seedMode); else if (p.lockSeed !== undefined) setSeedMode(p.lockSeed ? "lock" : "random");
        restoreImageControls(p);
        setSizeMultiplier(preciseSizeMultiplier(p.sizeMultiplier));
        if (p.saveOutput !== undefined) setSaveOutput(!!p.saveOutput);
        if (p.savePath) setSavePath(p.savePath);
		if(p.postControls || p.upscale!==undefined)setPostControls(normalizePost(p));
		if (p.upscale !== undefined) setUpscale(!!p.upscale);
		if (p.upscaleModel) setUpscaleModel(p.upscaleModel);
		if (p.upscaleFactor) setUpscaleFactor(p.upscaleFactor);
		if (p.loras) setSelLoras(p.loras);
		// 从套用的提示词反推视角，让按钮高亮跟实际一致
		// （预设是快照，很久以前存的可能还是旧的俯视构图）
		if (typeof detectView === 'function') setViewKey(detectView(p.pos || ""));
		setMsg("已套用预设「" + p.cat + " / " + p.name + "」");
		switchTab("gen");
	}
	function delPreset(p) {
		const list=(USER.presets || []).filter((x) => !(x.name === p.name && x.cat === p.cat));
		if(!persistPresetList(list)){setMsg("预设删除未保存，请检查浏览器存储空间；原预设保留");return;}
		setMsg("已删除「" + p.cat + " / " + p.name + "」");
	}


	// ---- ComfyUI 工作流导入 ----
	function doParseWf() {
		const r = parseWorkflow(wfText);
        if(r.ok&&/UNETLoader|DualCLIPLoader|TripleCLIPLoader|QuadrupleCLIPLoader|ModelSamplingSD3|ModelSamplingAuraFlow|Flux2Scheduler|TextEncodeQwenImage21|SamplerCustomAdvanced|ComfySwitchNode|"definitions"/.test(wfText)){r.modelConfig=normalizeModelConfig({mode:"diffusion",profile:"unknown"});r.ignored=(r.ignored||[]).concat(["复杂流程仅提取部分参数：请重新选择主模型并确认适配，不会执行原始工作流"]);}
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
			w: r.w || 896, h: r.h || 1152,
			steps: r.steps || 24, cfg: r.cfg === undefined ? 6 : r.cfg,
			sampler: r.sampler || "euler", scheduler: r.scheduler || "normal",
			ckpt: r.ckpt || "", clip: r.clip || "", clipType: r.clipType || "", vae: r.vae || "",
			loras: (r.loras || []).map((l) => ({ name: l.name, model: l.model, clip: l.clip })),
			fromWorkflow: true, sizeMultiplier:1,
            ...(r.modelConfig?{modelConfig:r.modelConfig}:{}),
		};
		const list = (USER.presets || []).filter((p) => !(p.name === name && p.cat === cat));
		list.push(item);
		if(!persistPresetList(list)){setMsg("预设保存失败，请检查浏览器存储空间；原预设保留");return;}
		setMsg("已把工作流存成预设「" + cat + " / " + name + "」");
		// 顺手套用
		if (expandPhaseRef.current !== "idle") return;
        updatePrompt({pos:item.pos, neg:item.neg}); setW(item.w); setHh(item.h);setSizeMultiplier(1);
		setSteps(item.steps); setCfg(item.cfg); setSampler(item.sampler); setScheduler(item.scheduler);
		if(item.ckpt||item.modelConfig)restoreModelSetup(item);
		if (item.clip) setClip(item.clip);
		if (item.clipType) setClipType(item.clipType);
		if (item.vae) setVae(item.vae);
		if (item.loras) setSelLoras(item.loras);
		switchTab("gen");
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

    // ---- 模型 Dock 与 Model Library ----
    function modelOptions(kind){return kind==="diffusion"?diffusions:kind==="checkpoint"?ckpts:kind==="clip"?clips:kind==="clipType"?clipTypes:kind==="vae"?vaes:kind==="lora"?loras:[];}
    function modelValue(kind){return kind==="diffusion"?modelConfig.main:kind==="checkpoint"?ckpt:kind==="clip"?clip:kind==="clipType"?clipType:kind==="vae"?vae:"";}
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
    async function refreshModelKind(kind){const m={checkpoint:["CheckpointLoaderSimple","ckpt_name",setCkpts],diffusion:["UNETLoader","unet_name",setDiffusions],clip:["CLIPLoader","clip_name",setClips],vae:["VAELoader","vae_name",setVaes],lora:["LoraLoader","lora_name",setLoras],upscale:["UpscaleModelLoader","model_name",setUpscalers]}[kind];if(!m)return [];try{const options=kind==="clip"?await clipModelOptions():kind==='diffusion'?[...new Set((await Promise.all(['UNETLoader','UnetLoaderGGUF'].map(async node=>{try{return comboOptions(await jget(COMFY+'/object_info/'+node,10000),node,'unet_name');}catch{return [];}}))).flat())]:comboOptions(await jget(COMFY+"/object_info/"+m[0],10000),m[0],m[1]);m[2](options);return options;}catch(e){setMsg("刷新模型列表失败："+errText(e));return [];}}
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
    function openModelPicker(kind,current,onSelect){
        setComponentPicker(null);setModelPins(readModelPins());navigateModelFolder(kind,0,"",current||"");modelPickCallback.current=onSelect;setShowModelLibrary(true);
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
        }catch(e){if(request===modelDetailRequestRef.current){setModelLibraryDetail({kind,name:item.name,root_id:item.root_id,size_text:item.size_text||"?",base_type:"未知",source:null,error:errText(e)});notifyError(e,{title:'模型详情读取失败'});}}
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
        const kind=modelConfig.mode,name=kind==='diffusion'?modelConfig.main:ckpt,identity=modelConfig.identity;
        setModelTypeSettingsOpen(false);if(!name){setModelFileChecking(false);return;}setModelFileChecking(true);
        const ctl=new AbortController();
        jget(EXPANDER+'/models/detail?kind='+kind+'&name='+encodeURIComponent(name)+(identity!==''?'&root_id='+encodeURIComponent(identity):''),40000,ctl.signal).then(data=>{
            if(ctl.signal.aborted)return;
            setModelConfig(c=>{
                if(c.mode!==kind||(kind==='diffusion'?c.main:ckpt)!==name||c.identity!==identity)return c;
                if(data.detection)return applyAutoModelDetection(c,data.detection);
                const info=data.loading||{};
                return withModelFileInfo(c,{contentMode:info.mode,embeddedClip:info.embedded_clip,embeddedVae:info.embedded_vae});
            });
        }).catch(e=>{if(!ctl.signal.aborted)setModelConfig(c=>c.profileMode==='manual'?c:{...c,profile:'unknown',detection:normalizeModelDetection({message:'模型识别失败，可重试或手动选择',format:name.split('.').pop()})});}).finally(()=>{if(!ctl.signal.aborted)setModelFileChecking(false);});
        return()=>ctl.abort();
    },[mainInspectionKey,modelDockRevision]);
    function cancelModelCheck(){const ctl=modelCheckRef.current;if(ctl){ctl.abort();modelCheckRef.current=null;setModelCheck(false);setMsg("组件检查已取消，未提交任务");}}
    React.useEffect(()=>()=>{modelCheckRef.current?.abort();modelCheckRef.current=null;},[]);
    function currentModelSetup(){return {modelConfig:{...modelConfig},ckpt,clip,clipType,vae,loras:selLoras.map(x=>({...x})),steps,cfg,sampler,scheduler,w,h:hh,sizeMultiplier:preciseSizeMultiplier(sizeMultiplier)};}
    function restoreModelSetup(item){cancelModelCheck();setModelDockRevision(n=>n+1);setModelConfig(normalizeModelConfig(item.modelConfig));if(item.ckpt!==undefined)setCkpt(item.ckpt);setClip(item.clip||"");setClipType(item.clipType||"stable_diffusion");setVae(item.vae||"");}
    function chooseMainModel(mode,name,identity=""){
        if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}
        cancelModelCheck();
        if(mode===modelConfig.mode&&name===(mode==="diffusion"?modelConfig.main:ckpt)&&(!modelConfig.identity||identity===modelConfig.identity)){setModelConfig(c=>({...c,identity:identity||c.identity}));return true;}
        const target=normalizeModelConfig({mode,main:mode==="diffusion"?name:"",identity,profile:"unknown",profileMode:"auto"});
        USER.modelConfigs=Object.assign({},USER.modelConfigs,{[modelConfigKey(modelConfig,ckpt)]:currentModelSetup()});
        const saved=rememberedModelSetup(USER.modelConfigs,target,mode==="checkpoint"?name:ckpt);setModelConfig(saved?{...normalizeModelConfig(saved.modelConfig),identity:identity||normalizeModelConfig(saved.modelConfig).identity}:target);if(mode==="checkpoint")setCkpt(name);
        if(saved){setClip(saved.clip||"");setClipType(saved.clipType||"stable_diffusion");setVae(saved.vae||"");setSelLoras((saved.loras||[]).map(x=>({...x})));setSteps(saved.steps??steps);setCfg(saved.cfg??cfg);setSampler(saved.sampler||sampler);setScheduler(saved.scheduler||scheduler);setW(saved.w||w);setHh(saved.h||hh);setSizeMultiplier(preciseSizeMultiplier(saved.sizeMultiplier));}
        else{setClip("");setVae("");setSelLoras(cur=>cur.map(x=>({...x,enabled:false})));}
        setMsg(saved?"已恢复该主模型的配置":"已选择主模型，正在自动识别；原 LoRA 已保留为暂停状态");return true;
    }
    function chooseModelProfile(id){
        if(expandPhaseRef.current!=="idle")return;cancelModelCheck();
        if(id==='auto'){setModelConfig(c=>applyAutoModelDetection({...c,profileMode:'auto',profile:'unknown'},c.detection));return;}
        const key=modelConfigKey(modelConfig,ckpt),profiles=USER.modelProfileConfigs||{};
        USER.modelProfileConfigs={...profiles,[JSON.stringify([key,modelConfig.profile])]:currentModelSetup()};
        const saved=profiles[JSON.stringify([key,id])];
        if(saved){setModelConfig({...withModelFileInfo(saved.modelConfig,modelConfig),identity:modelConfig.identity});setClip(saved.clip||"");setVae(saved.vae||"");setClipType(saved.clipType||"stable_diffusion");setSelLoras(saved.loras||[]);}
        else{if(modelProfile({profile:id}).family!==profile.family){setClip("");setVae("");setSelLoras(cur=>cur.map(x=>({...x,enabled:false})));}setModelConfig(c=>({...c,componentOrder:modelProfile({profile:id}).family===profile.family?c.componentOrder:c.componentOrder.filter(k=>k.startsWith('lora:')),encoderOverride:modelProfile({profile:id}).family===profile.family&&c.encoderOverride,vaeOverride:modelProfile({profile:id}).family===profile.family&&c.vaeOverride,clip4:modelProfile({profile:id}).family===profile.family&&MODEL_PROFILES[id]?.encoders===4?c.clip4:"",accelerationLora:"",profile:id,clip2:[2,3,4].includes(MODEL_PROFILES[id]?.encoders)&&modelProfile({profile:id}).family===profile.family?c.clip2:"",clip3:[3,4].includes(MODEL_PROFILES[id]?.encoders)&&modelProfile({profile:id}).family===profile.family?c.clip3:"",encoderMode:MODEL_PROFILES[id]?.family==="sd3"&&profile.family!=="sd3"?(c.mode==="checkpoint"&&c.contentMode!=="diffusion"&&c.embeddedClip!==false?"embedded":"triple"):c.encoderMode,shift:MODEL_PROFILES[id]?.family===profile.family?c.shift:null,clipSkip:["sd15","sdxl","legacy"].includes(id)?c.clipSkip:0}));}
        if(id!==modelConfig.profile&&!saved)setSelLoras(cur=>cur.map(x=>({...x,enabled:false})));
        setModelConfig(c=>({...c,profileMode:'manual',profileFingerprint:c.detection?.fingerprint||''}));
        setMsg('已记住此模型的类型；提示词与采样值保留');
    }
    function applyModelRecommendation(){const r=profile.recommended;if(!r)return;cancelModelCheck();setSteps(r.steps);setCfg(r.cfg);setSampler(r.sampler);setScheduler(r.scheduler);setW(r.w);setHh(r.h);setSizeMultiplier(1);if(r.guidance!==undefined)setModelConfig(c=>({...c,guidance:r.guidance}));if(profile.samplingShift)setModelConfig(c=>({...c,shift:null}));setMsg("已应用参考采样值和尺寸；仍需按具体模型及硬件验证");}
    function matchModelComponents(){
        if(expandPhaseRef.current!=='idle')return;cancelModelCheck();
        const leaf=s=>String(s).replace(/\\/g,'/').split('/').pop().toLowerCase();
        const pick=(list,names)=>{for(const name of names){const hits=list.filter(x=>leaf(x)===name.toLowerCase());if(hits.length===1)return hits[0];if(hits.length>1)return '';}return '';};
        const roles=modelEncoderRoles(modelConfig),candidates={
            'Text Encoder':profile.family==='anima'?['qwen_3_06b_base.safetensors']:['clip_l.safetensors'],
            'CLIP-L':['clip_l.safetensors'],'CLIP-G':['clip_g.safetensors'],
            'T5XXL':['t5xxl_fp16.safetensors','t5xxl_fp8_e4m3fn_scaled.safetensors','t5xxl_fp8_e4m3fn.safetensors'],
            'Qwen2.5-VL 7B':profile.family==='hunyuan'?['qwen_2.5_vl_7b.safetensors']:['qwen_2.5_vl_7b_fp8_scaled.safetensors'],
            'Qwen3 4B':['qwen_3_4b.safetensors'],'Qwen3 8B':['qwen_3_8b_fp8mixed.safetensors','qwen_3_8b.safetensors'],
            'Qwen3-VL 8B':['qwen3vl_8b_int8_convrot.safetensors'],'Qwen3-VL 4B':['qwen3vl_4b_fp8_scaled.safetensors'],
            'Qwen3.5 9B':['qwen3.5_9b_w4a8_gptq.safetensors'],'Mistral 3 Small':['mistral_3_small_flux2_fp8.safetensors','mistral_3_small_flux2_bf16.safetensors'],
            'CLIP-L HiDream':['clip_l_hidream.safetensors'],'CLIP-G HiDream':['clip_g_hidream.safetensors'],
            'Llama3.1 8B':['llama_3.1_8b_instruct_fp8_scaled.safetensors'],'Gemma2 2B':['gemma_2_2b_fp16.safetensors','gemma_2_2b.safetensors'],'ByT5 Small Glyph':['byt5_small_glyphxl_fp16.safetensors']
        };
        const count=modelEncoderCount({modelConfig,clip}),files=[clip,modelConfig.clip2,modelConfig.clip3,modelConfig.clip4],matched=roles.slice(0,count).map((role,i)=>files[i]?'':pick(clips,candidates[role]||[]));if(matched[0])setClip(cur=>cur||matched[0]);
        setModelConfig(c=>({...c,...Object.fromEntries(matched.slice(1).map((value,i)=>['clip'+(i+2),value]).filter(([key,value])=>value&&!c[key]))}));
        const vaeNames=profile.family==='moss'?['flux2-vae_small.safetensors']:profile.family==='hunyuan'?['hunyuan_image_2.1_vae_fp16.safetensors']:profile.family==='qwen21'?['qwen_image_2.1_vae_bf16.safetensors']:profile.family.startsWith('flux2')?['flux2-vae.safetensors']:['anima','qwen','krea2'].includes(profile.family)?['qwen_image_vae.safetensors']:['flux','z-image','hidream','chroma'].includes(profile.family)?['ae.safetensors']:[];
        const v=(modelNeedsVae(modelConfig)||vae)&&!vae?pick(vaes,vaeNames):'';if(v)setVae(cur=>cur||v);const filled=matched.filter(Boolean).length+(v?1:0);setMsg(filled?'已补齐 '+filled+' 个空缺组件，已选内容保留；请确认模型兼容性':'没有可唯一确定的空缺组件，已选内容保留');
    }
    function modelField(label,value,options,onChange,combo,forceOpen,guideTarget){return h("div",{className:"cc-model-aux-field"+(combo?' cc-field-capsule':''),key:label,'data-cc-guide':guideTarget||undefined},h("span",null,label),h(SelectMenu,{label,value,options,onChange,theme,minWidth:combo?0:150,forceSearch:true,forceOpen:!!forceOpen}));}
    function refreshModelDockAssets(){MODEL_DOCK_ASSETS.clear();setModelDockRevision(n=>n+1);}
    function closeModelLibrary(){modelNavigationRef.current++;modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;modelDetailRequestRef.current++;setShowModelLibrary(false);setComponentPicker(null);}
    function renderModelAutoDetails(){
        const c=modelConfig,d=c.detection,known=!['legacy','unknown'].includes(c.profile);
        const status=modelFileChecking?'正在识别模型…':known?(c.profileMode==='manual'?'手动确认：':'自动识别：')+profile.label:'需要确认模型类型';
        return h('div',{className:'cc-model-auto-details','data-cc-guide':'model-profile'},
            h('div',{className:'cc-model-auto-line'},h('span',{role:'status'},status),d?.format?h('small',null,d.format):null,
                h('button',{type:'button',className:'cc-model-type-settings','aria-label':'模型识别设置','data-cc-tooltip':'模型识别设置','aria-expanded':modelTypeSettingsOpen,onClick:()=>setModelTypeSettingsOpen(v=>!v)},h(PromptIcon,{name:'sliders',size:14}))),
            !modelFileChecking&&!known?h('span',{className:'cc-model-detection-message'},d?.message||'未能确定类型，请手动选择或重新识别。'):null,
            modelTypeSettingsOpen||(!modelFileChecking&&(!known||c.profileMode==='manual'))?h('div',{className:'cc-model-type-options','data-cc-guide':'model-profile-select'},
                h(SelectMenu,{label:'模型类型',value:c.profileMode==='auto'&&known?'auto':known?c.profile:'',options:[{value:'',label:'请选择模型类型'},{value:'auto',label:'自动识别'},...modelProfileOptions()],onChange:id=>{if(id)chooseModelProfile(id);},theme,minWidth:0,forceSearch:true}),
                h('button',{type:'button',style:S.btn2,disabled:modelFileChecking,onClick:()=>{setModelConfig(c=>({...c,profileMode:'auto',profileFingerprint:''}));setModelDockRevision(v=>v+1);}},'重新识别')):null,
            known?h('p',null,profile.style==='natural'?'提示词：用完整句子描述主体、动作与构图。':'提示词：可使用标签与句子描述。',profile.negative?' 支持负面提示词。':' 本流程不使用负面提示词。'):null);
    }
    function renderModelRecommendation(){
        const r=profile.recommended;if(!r)return null;
        return h('div',{className:'cc-model-recommendation',role:'group','aria-label':'推荐参数'},
            h('strong',{className:'cc-model-recommendation-label'},'推荐参数'),
            h('div',null,h('span',null,r.w+' × '+r.h+' · '+r.steps+' 步 · CFG '+r.cfg+(r.guidance!==undefined?' · Guidance '+r.guidance:'')),h('span',null,r.sampler+' · '+(profile.advanced||r.scheduler))),
            h('button',{type:'button',style:S.btn2,onClick:applyModelRecommendation},'应用推荐参数'));
    }
    function changeEncoderMode(mode){
        cancelModelCheck();const oldRoles=modelEncoderRoles(modelConfig),oldFiles=[clip,modelConfig.clip2,modelConfig.clip3,modelConfig.clip4],byRole=Object.fromEntries(oldRoles.map((role,i)=>[role,oldFiles[i]||'']));
        const nextRoles=modelEncoderRoles({...modelConfig,encoderMode:mode}),values=nextRoles.map(role=>byRole[role]||'');setClip(values[0]||'');
        setModelConfig(c=>({...c,encoderMode:mode,encoderOverride:mode!=='embedded',clip2:values[1]||'',clip3:values[2]||'',clip4:values[3]||'',componentOrder:controlEntries().map(e=>e.key).filter(key=>!key.startsWith('encoder:')||nextRoles.includes(key.slice(8)))}));
    }
    function controlEntries(){return generationControlEntries({modelConfig,clip,vae,loras:selLoras,referenceImage,inpaint,scene3d,anima:anima3d});}
    const sceneRemovalRef=React.useRef(false);
    function changeScene3D(next,released=false){cancelModelCheck();const previous=SCENE3D_RUNTIME.value;const value=scene3DSessionValue(next);if(!value&&previous&&!released)releaseScene3D(previous).catch(e=>setMsg('临时场景清理失败：'+errText(e)));setScene3d(value);if(value?.enabled){setReferenceImage(cur=>cur?{...cur,enabled:false}:cur);setInpaint(cur=>cur?{...cur,enabled:false}:cur);}}
    function changeReference(next){cancelModelCheck();const v=normalizeReferenceImage(next);setReferenceImage(v);if(v?.enabled)setScene3d(cur=>cur?{...cur,enabled:false}:cur);if(v?.enabled)setInpaint(cur=>cur?{...cur,enabled:false}:cur);}
    function restoreImageControls(p){cancelModelCheck();const next=normalizeImageControls(p);if(next.anima)changeAnima({...next.anima,sessionId:anima3d?.sessionId||''});else if(next.scene3d)changeAnima({...next.scene3d,sessionId:anima3d?.sessionId||''});setInpaint(null);setReferenceImage(next.referenceImage);}
    function currentComponentKeys(){return controlEntries().map(e=>e.key);}
    function appendComponentOrder(key){const order=currentComponentKeys();setModelConfig(c=>({...c,componentOrder:[...order.filter(k=>k!==key),key]}));}
    async function addModelComponent(kind,role=''){
        if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}
        cancelModelCheck();

        if(kind==='anima'){if(!anima3d){appendComponentOrder('anima');changeAnima({enabled:true,controlnet:{model:'',strength:1,start:0,end:1}});}return;}
        if(kind==='scene3d'){if(!scene3d){appendComponentOrder('scene3d');changeScene3D({enabled:false});}return;}
        if(kind==='reference'){if(!referenceImage){appendComponentOrder('reference');changeReference({});}return;}
        if(kind==='lora'){const id='slot-'+Date.now().toString(36)+'-'+(++componentSequence.current);appendComponentOrder('lora:'+id);setSelLoras(cur=>cur.concat([{id,name:'',model:1,clip:1,enabled:true}]));return;}
        const key=kind==='clip'?'encoder:'+role:kind;
        if(currentComponentKeys().includes(key))return;
        appendComponentOrder(key);
        if(kind==='clip')setModelConfig(c=>({...c,encoderOverride:true,encoderMode:profile.family==='sd3'&&c.encoderMode==='embedded'?'triple':c.encoderMode}));
        if(kind==='vae')setModelConfig(c=>({...c,vaeOverride:true}));
    }
    function performLatentReplace(kind,other){
        if(other[0]==='scene3d'&&kind==='reference'){setScene3dSaveConfirm({kind,other});return;}
        doLatentReplace(kind,other);
    }
    function doLatentReplace(kind,other){
        if(other[0]==='scene3d'){changeScene3D(null,true);setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='scene3d')}));}
        else if(other[0]==='reference'){changeReference(null);setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='reference')}));}
        if(kind==='scene3d'){appendComponentOrder('scene3d');changeScene3D({enabled:false});}
        else if(kind==='reference'){appendComponentOrder('reference');changeReference({});}
        setMsg(`已移除「${other[1]}」，替换为「${LATENT_LABELS[kind]}」`);
    }
    async function removeControl(entry){
        if(entry.kind==='anima'){changeAnima(null);setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='anima')}));return;}
        if(entry.kind==='scene3d'){if(sceneRemovalRef.current)return;sceneRemovalRef.current=true;try{if(!await confirmScene3DRemoval(scene3d))return;await releaseScene3D(scene3d);changeScene3D(null,true);setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='scene3d')}));}catch(e){setMsg('场景未移除：'+errText(e));}finally{sceneRemovalRef.current=false;}return;}
        if(entry.kind==='reference'){changeReference(null);setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='reference')}));return;}
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
        if(modelPickCallback.current){const cb=modelPickCallback.current;modelPickCallback.current=null;try{cb(item||{});}finally{closeModelLibrary();}return;}
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
    function updateControlLora(entry,change){cancelModelCheck();setSelLoras(cur=>cur.map(l=>controlLoraKey(l)===entry.key?{...l,...(l.clip==null?{clip:l.model??1}:{}),...change}:l));}
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
        if(componentPicker||modelPickCallback.current){applyControlFile(item);return;}
        const actual=comfyModelName(kind,item.name);
        if(["checkpoint","diffusion"].includes(kind)){
            if(!chooseMainModel(kind==="diffusion"?"diffusion":"checkpoint",actual,String(item.root_id??"")))return;
            refreshModelDockAssets();closeModelLibrary();
        }else if(kind==="clip"){if(!currentComponentKeys().includes('clip'))appendComponentOrder('clip');setClip(actual);setModelConfig(c=>({...c,encoderOverride:true,encoderMode:profile.family==='sd3'&&c.encoderMode==='embedded'?'triple':c.encoderMode}));setMsg("已选择 Text Encoder："+shortModel(actual));}
        else if(kind==="vae"){if(!currentComponentKeys().includes('vae'))appendComponentOrder('vae');setVae(actual);setModelConfig(c=>({...c,vaeOverride:true}));setMsg("已选择 VAE："+shortModel(actual));}
        else{if(!selLoras.some(x=>normModelName(x.name)===normModelName(actual))){appendComponentOrder('lora:'+actual);setSelLoras(cur=>cur.concat([{name:actual,model:1,clip:1}]));}setMsg("已添加 LoRA；请确认适用的模型系列");}
    }
    function removeLora(name){setSelLoras(cur=>cur.filter(x=>x.name!==name));setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(k=>k!=='lora:'+name)}));}
    function currentImageSizeSettings(){return {w:Number(w),h:Number(hh),multiplier:Number(sizeMultiplier)||1,alignment:profile.sizeStep||8};}
    function applyImageSizeSettings(settings){if(!settings)return;cancelModelCheck();setW(Number(settings.w)||Number(w));setHh(Number(settings.h)||Number(hh));setSizeMultiplier(preciseSizeMultiplier(settings.multiplier));}
    function renderControlTile(entry){
        if(entry.kind==='anima')return h(AnimaControl,{key:'anima',value:anima3d||{enabled:true,controlnet:{model:'',strength:1,start:0,end:1}},onChange:changeAnima,onRemove:()=>removeControl(entry),onOpen:()=>openAnima({anima:true}),busy:scene3DOpening,downloads:animaDownloads,onDownload:downloadAnimaModel,downloading:animaDownloading,nodeInstalled:animaNode,nodeInstalling:animaNodeInstalling,onInstallNode:installAnimaNode,theme});
        if(entry.kind==='scene3d')return h(Scene3DControl,{key:'scene3d',value:scene3d,onChange:changeScene3D,onRemove:()=>removeControl(entry),onOpen:openScene3D,busy:scene3DOpening,controlnets});
        if(entry.kind==='reference')return h(ReferenceImageControl,{key:'reference',value:referenceImage,onChange:changeReference,onEditorExit:(intent,result)=>exitImageEditor(intent,result,'reference'),onRemove:()=>removeControl(entry),theme,target:{w:Number(w),h:Number(hh)},sizeSettings:currentImageSizeSettings(),onSizeApply:applyImageSizeSettings});
        const l=entry.lora,name=entry.name,label=entry.label,directKind=entry.kind==='vae'||entry.kind==='clip';
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
        if(!directKind)return h('div',{key:entry.key,'data-component-key':entry.key,'data-kind':entry.kind,'data-empty':!name,'data-paused':l?.enabled===false,className:'cc-control-tile cc-generation-model-editor'},
            h('button',{type:'button',className:'cc-generation-model-preview','aria-label':'选择 '+entry.label+(l?' '+(selLoras.indexOf(l)+1):''),onClick:()=>openControlPicker(entry)},
                h(ModelDockAsset,{kind:entry.kind,name,revision:modelDockRevision,variant:'lora'}),!name?h('span',{className:'cc-generation-preview-caption'},'选择模型'):null),
            h('div',{className:'cc-generation-model-fields'},
                h('div',{className:'cc-generation-file-info'},h('span',{className:'cc-generation-field-label'},'模型文件'),h('strong',{className:'cc-generation-file-name',title:name},name||'点击左侧预览选择模型')),
                l?h('div',{className:'cc-generation-model-parameters'},
                    ...[['model','LoRA 强度'],['clip','CLIP 强度']].map(([key,title])=>h('div',{key,className:'cc-generation-parameter'},h('span',{className:'cc-generation-field-label'},title),h('div',{className:'cc-strength-control'},h(DraggableNumberInput,{value:key==='clip'?(l.clip??l.model??1):(l.model??1),onChange:v=>updateControlLora(entry,{[key]:v}),min:-10,max:10,step:.05,precision:2,dragPerPixel:1/100,label:title,decreaseLabel:'降低 '+title,increaseLabel:'提高 '+title}),h(ResetButton,{className:'cc-strength-reset',label:'重置 '+title+' 为 1',tooltip:'重置为 1',onClick:()=>updateControlLora(entry,{[key]:1})}))))):null,

                h('span',{className:'cc-generation-field-note'},name?'点击预览图更换模型':'选择模型后，可在这里调整启用状态和强度')));
        return h('div',{key:entry.key,'data-component-key':entry.key,'data-kind':entry.kind,'data-empty':!name,className:'cc-control-tile'},
            h('div',{className:'cc-control-direct'},h('strong',null,label),entry.kind==='clip'&&label==='Text Encoder'&&entry.role&&entry.role!=='Text Encoder'?h('small',{className:'cc-generation-field-note'},'所需编码器：'+entry.role):null,h(SelectMenu,{theme,label:entry.key,value:name||'',options:directOptions,onChange:chooseDirect,minWidth:0,forceSearch:values.length>12})),
            h('button',{type:'button',className:'cc-control-remove','aria-label':'移除 '+entry.label,onClick:()=>removeControl(entry)},h(PromptIcon,{name:'minus',size:13})));
    }
    function renderGenerationControls(){
        if(!modelControlsOpen)return null;
        const entries=controlEntries(),keys=entries.map(e=>e.key),roles=controlEncoderRoles(modelConfig);
        const common=entries.filter(e=>e.kind==='clip'||e.kind==='vae'),individual=entries.filter(e=>e.kind!=='clip'&&e.kind!=='vae');
        const loraEntries=individual.filter(e=>e.kind==='lora'&&e.lora),visibleIndividual=[];let loraGroupAdded=false;
        for(const entry of individual){if(entry.kind==='lora'&&entry.lora){if(!loraGroupAdded){visibleIndividual.push({key:'lora-group',kind:'lora-group',label:'LoRA',members:loraEntries});loraGroupAdded=true;}}else visibleIndividual.push(entry);}
        const addButton=(key,label,kind,role)=>h('button',{type:'button',key,className:'cc-control-add-row',disabled:keys.includes(key),onClick:()=>addModelComponent(kind,role)},h('span',null,label),h('small',null,keys.includes(key)?'已添加':'添加'));
        const move=(entry,delta)=>{const index=visibleIndividual.findIndex(e=>e.key===entry.key),other=visibleIndividual[index+delta];if(index<0||!other)return;const next=visibleIndividual.slice();[next[index],next[index+delta]]=[next[index+delta],next[index]];const ordered=next.flatMap(e=>e.kind==='lora-group'?e.members.map(l=>l.key):[e.key]);setModelConfig(c=>({...c,componentOrder:[...common.map(e=>e.key),...ordered]}));};
        const cellToggle=(entry)=>{
            if(!entry)return {enabled:undefined};
            if(entry.lora)return {enabled:entry.lora.enabled!==false,onToggle:v=>updateControlLora(entry,{enabled:v})};
            if(entry.kind==='reference'&&referenceImage)return {enabled:referenceImage.enabled!==false,onToggle:v=>changeReference({...referenceImage,enabled:v})};
            if(entry.kind==='scene3d'&&scene3d)return {enabled:scene3d.enabled!==false,onToggle:v=>changeScene3D({...scene3d,enabled:v})};
            if(entry.kind==='anima'&&anima3d)return {enabled:anima3d.enabled!==false,onToggle:v=>changeAnima({...anima3d,enabled:v})};
            return {enabled:undefined};
        };
        const cellHead=(title,index,entry,titleAddon)=>{const toggle=cellToggle(entry);return h(CellHead,{index,title,titleAddon,
            enabled:toggle.enabled,
            onToggle:toggle.onToggle,
            dragHandlers:entry?{onDragStart:e=>{dragEntryRef.current=entry;setDraggingKey(entry.key);e.dataTransfer.setData('text/plain',entry.key);e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setDragImage(e.currentTarget.closest('.cc-post-cell'),24,16);}catch{}},onDragEnd:()=>{dragEntryRef.current=null;setDraggingKey(null);setDragOverKey(null);stopDragAutoScroll();}}:undefined,
            canUp:index>1,canDown:index<visibleIndividual.length,
            onUp:()=>move(entry,-1),onDown:()=>move(entry,1),onRemove:()=>entry?.kind==='lora-group'?removeLoraGroup(entry):removeControl(entry)});};
        const renderLoraRow=(entry,index)=>{const l=entry.lora,name=entry.name,defaultRow=index===0;return h('div',{key:entry.key,className:'cc-generation-lora-row','data-enabled':l.enabled!==false,'data-empty':!name},
            h('div',{className:'cc-generation-lora-toggle'},h(Switch,{checked:l.enabled!==false,onChange:v=>updateControlLora(entry,{enabled:v}),label:''})),
            h('div',{className:'cc-generation-lora-model-wrap'},h('span',{className:'cc-generation-field-label'},'LoRA模型'),
                  h('button',{type:'button',className:'cc-generation-lora-model-select',style:S.btn2,'aria-label':name?'更换 LoRA 模型：'+name:'选择 LoRA 模型',onPointerEnter:e=>{const button=e.currentTarget,pop=button.closest('.cc-generation-lora-model-wrap')?.querySelector('.cc-generation-lora-preview-popover');if(!pop)return;const place=()=>{const rect=button.getBoundingClientRect();pop.style.left=Math.max(8,rect.left-pop.offsetWidth-10)+'px';pop.style.top=(rect.top+rect.height/2)+'px';};place();requestAnimationFrame(place);},onClick:()=>openControlPicker(entry)},h('span',{className:'cc-generation-lora-name',title:name},name||'选择模型'),h(PromptIcon,{name:'chevronDown',size:12})),
                h('span',{className:'cc-generation-lora-preview-popover','aria-hidden':'true'},name?h(ModelDockAsset,{kind:'lora',name,revision:modelDockRevision,variant:'lora-hover'}):h('span',{className:'cc-generation-lora-preview-empty'},h(PromptIcon,{name:'image',size:22}),h('span',null,'暂无预览图')))),
            h('span',{className:'cc-generation-lora-divider','aria-hidden':'true'}),
            h('div',{className:'cc-generation-lora-strength'},h('span',{className:'cc-generation-field-label'},'LoRA 强度'),h('div',{className:'cc-strength-control'},h(DraggableNumberInput,{value:l.model??1,onChange:v=>updateControlLora(entry,{model:v}),min:-10,max:10,step:.05,precision:2,dragPerPixel:1/100,label:'LoRA 强度',decreaseLabel:'降低 LoRA 强度',increaseLabel:'提高 LoRA 强度'}),h(ResetButton,{className:'cc-strength-reset',label:'重置 LoRA 强度为 1',tooltip:'重置为 1',onClick:()=>updateControlLora(entry,{model:1})}))),
            h('span',{className:'cc-generation-lora-divider','aria-hidden':'true'}),
            h('div',{className:'cc-generation-lora-strength'},h('span',{className:'cc-generation-field-label'},'CLIP 强度'),h('div',{className:'cc-strength-control'},h(DraggableNumberInput,{value:l.clip??l.model??1,onChange:v=>updateControlLora(entry,{clip:v}),min:-10,max:10,step:.05,precision:2,dragPerPixel:1/100,label:'CLIP 强度',decreaseLabel:'降低 CLIP 强度',increaseLabel:'提高 CLIP 强度'}),h(ResetButton,{className:'cc-strength-reset',label:'重置 CLIP 强度为 1',tooltip:'重置为 1',onClick:()=>updateControlLora(entry,{clip:1})}))),
            defaultRow?null:h('button',{type:'button',className:'cc-generation-lora-delete',style:S.btn2,'aria-label':'删除 LoRA '+(name||'未选择'),'data-cc-tooltip':'删除 LoRA',onClick:()=>removeControl(entry)},h(PromptIcon,{name:'trash',size:15})))};
        const removeLoraGroup=item=>{const keys=new Set(item.members.map(entry=>entry.key));if(!keys.size)return;cancelModelCheck();setSelLoras(cur=>cur.filter(l=>!keys.has(controlLoraKey(l))));setModelConfig(c=>({...c,componentOrder:c.componentOrder.filter(key=>!keys.has(key))}));};
        const renderLoraGroup=(item,index)=>h('section',{key:item.key,className:'cc-post-cell cc-generation-cell cc-generation-lora-cell'+(draggingKey===item.key?' is-dragging':dragOverKey===item.key?' is-drop-'+dragDropPos:''),'data-kind':'lora',onDragOver:e=>{e.preventDefault();e.dataTransfer.dropEffect='move';dragAutoScroll(e);const r=e.currentTarget.getBoundingClientRect(),pos=e.clientY<r.top+r.height/2?'before':'after';if(dragOverKey!==item.key||dragDropPos!==pos){setDragOverKey(item.key);setDragDropPos(pos);}},onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget)){setDragOverKey(cur=>cur===item.key?null:cur);stopDragAutoScroll();}},onDrop:e=>{e.preventDefault();stopDragAutoScroll();const from=dragEntryRef.current;dragEntryRef.current=null;setDraggingKey(null);setDragOverKey(null);if(!from||from.key===item.key)return;const order=visibleIndividual.map(x=>x.key),fromIdx=order.indexOf(from.key);if(fromIdx<0)return;order.splice(fromIdx,1);let insertAt=order.indexOf(item.key);if(insertAt<0)return;if(dragDropPos==='after')insertAt+=1;order.splice(insertAt,0,from.key);const ordered=order.flatMap(key=>{const x=visibleIndividual.find(v=>v.key===key);return x?.kind==='lora-group'?x.members.map(l=>l.key):x?[x.key]:[];});setModelConfig(c=>({...c,componentOrder:[...common.map(x=>x.key),...ordered]}));}},
            cellHead('LoRA',index+1,item,h('button',{type:'button',className:'cc-generation-lora-add',style:S.btn2,'data-cc-tooltip':'添加 LoRA',onClick:()=>addModelComponent('lora')},h(PromptIcon,{name:'plus',size:13}),'添加 LoRA')),
            h('div',{className:'cc-post-cell-fields cc-generation-cell-body cc-generation-lora-body'},
                ...item.members.map(renderLoraRow)));
        const renderIndividualCell=(entry,index)=>h('section',{key:entry.key,className:'cc-post-cell cc-generation-cell'+(draggingKey===entry.key?' is-dragging':dragOverKey===entry.key?' is-drop-'+dragDropPos:''),'data-kind':entry.kind,'data-disabled':entry.lora?.enabled===false,onDragOver:e=>{e.preventDefault();e.dataTransfer.dropEffect='move';dragAutoScroll(e);const r=e.currentTarget.getBoundingClientRect(),pos=e.clientY<r.top+r.height/2?'before':'after';if(dragOverKey!==entry.key||dragDropPos!==pos){setDragOverKey(entry.key);setDragDropPos(pos);}},onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget)){setDragOverKey(cur=>cur===entry.key?null:cur);stopDragAutoScroll();}},onDrop:e=>{e.preventDefault();stopDragAutoScroll();const from=dragEntryRef.current;dragEntryRef.current=null;setDraggingKey(null);setDragOverKey(null);if(!from||from.key===entry.key)return;const order=visibleIndividual.map(x=>x.key),fromIdx=order.indexOf(from.key);if(fromIdx<0)return;order.splice(fromIdx,1);let insertAt=order.indexOf(entry.key);if(insertAt<0)return;if(dragDropPos==='after')insertAt+=1;order.splice(insertAt,0,from.key);const ordered=order.flatMap(key=>{const x=visibleIndividual.find(v=>v.key===key);return x?.kind==='lora-group'?x.members.map(l=>l.key):x?[x.key]:[];});setModelConfig(c=>({...c,componentOrder:[...common.map(x=>x.key),...ordered]}));}},cellHead(entry.label,index+1,entry),h('div',{className:'cc-post-cell-fields cc-generation-cell-body'},renderControlTile(entry)));
        return h(OverlayModal,{title:'生成时控制',className:'cc-generation-controls-dialog cc-model-library-dialog',width:1280,theme,guideTarget:'generation-panel',onClose:()=>setModelControlsOpen(false)},
            h('div',{className:'cc-post-notebook cc-generation-notebook'},
                h('aside',{className:'cc-post-add','data-cc-guide':'generation-components','aria-label':'可添加的组件'},
                    h('div',{className:'cc-post-side-section'},h('strong',null,'组件列表'),
                        addButton('anima','Anima control','anima'),addButton('reference','图生图','reference'),
                        addButton('vae','VAE','vae'),...roles.map(role=>addButton('encoder:'+role,controlEncoderLabel(role,roles.length),'clip',role)),addButton('lora-new','LoRA','lora'),
                        profile.acceleration?addButton('acceleration','加速 LoRA · '+profile.acceleration,'acceleration'):null)),
                h('div',{className:'cc-post-cells','data-cc-guide':'generation-added'},
                    h('section',{className:'cc-post-cell cc-generation-common','data-kind':'common'},cellHead('通用',0),
                        h('div',{className:'cc-post-cell-fields cc-generation-common-fields'},renderModelAux(),common.length?h('div',{className:'cc-generation-common-models'},...common.map(renderControlTile)):h('p',{className:'cc-generation-empty-hint',style:{margin:'4px 0 0',fontSize:'12px',opacity:.65}},'还没有添加生成时控制组件；点左侧「组件列表」里的 VAE、文本编码器、LoRA 或 Anima control 添加。'))),
                    ...visibleIndividual.map((entry,index)=>entry.kind==='lora-group'?renderLoraGroup(entry,index):renderIndividualCell(entry,index)))));
    }
    function renderModelDock(layoutInfo={}){
        const c=modelConfig,kind=c.mode==='diffusion'?'diffusion':'checkpoint',main=c.mode==='diffusion'?c.main:ckpt;
        const setup={modelConfig:c,ckpt,clip,vae,loras:selLoras},entries=controlEntries(),openControls=()=>setModelControlsOpen(true);
        const openMain=()=>openModelLibrary(main?kind:null,main),share=Number(layoutInfo.share)||1;
        const dockLayout=!layoutInfo.paired||layoutInfo.stacked||share>=.65?'large':share>=.45?'medium':'small';
        return h('section',{ref:modelDockRef,className:'cc-model-dock','data-cc-guide':'model-dock','aria-label':'模型配置','data-dock-layout':dockLayout},
            h('div',{className:'cc-model-dock-main','data-recommended':!!main&&!!profile.recommended},
                h('div',{className:'cc-model-base'},
                    h('button',{type:'button',className:'cc-model-cover-select','aria-label':'选择主模型',onClick:openMain,'data-cc-tooltip':'打开主模型库'},
                        h(ModelDockAsset,{kind,name:main,rootId:c.identity,revision:modelDockRevision,variant:'main',onMeta:setMainModelMeta})),
                    h('div',{className:'cc-model-base-content'},h('button',{type:'button',className:'cc-model-base-button','data-cc-guide':'model-base','aria-label':'打开主模型库',onClick:openMain},
                        h('span',{className:'cc-model-base-text'},h('strong',{title:main},shortModel(main)||'选择主模型'),
                            mainModelMeta?h('small',null,[mainModelMeta.source?.base_model||mainModelMeta.base_type,mainModelMeta.size_text].filter(x=>x&&x!=='未知').join(' · ')):null,
                            h('small',{title:main},main))),main?renderModelAutoDetails():null)),
                main?renderModelRecommendation():null,
                h('div',{className:'cc-generation-controls-summary cc-model-control-dock'},
                    renderControlPanelEntry({label:'生成时控制',count:entries.length,onClick:openControls,guideTarget:'generation-controls',className:'cc-generation-controls-open'}),
                    renderControlPanelSummary(generationControlGroups(entries),openControls,'未添加控制'))),
            !modelFileChecking&&modelSetupErrors(effectiveModelSetup(setup)).length?h('span',{style:S.warn,role:'status'},modelSetupErrors(effectiveModelSetup(setup)).join('；')):null);
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
                    source?.url?h(React.Fragment,null,...[source,...(source.alternatives||[])].filter(v=>/^https:\/\//i.test(v.url||'')).map((v,i)=>h("a",{key:v.url+':'+i,href:v.url,target:"_blank",rel:"noopener noreferrer"},(v.provider||"来源")+(v.title?" · "+v.title:"")+(v.author?" · "+v.author:"")+(v.version?" · "+v.version:"")))):
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
                        modelLibraryLoading?h(React.Fragment,null,h("span",{className:"cc-icon-spinner"},h(PromptIcon,{name:"spinner",size:16})),h("span",{className:"cc-icon-stop"},h(PromptIcon,{name:"stop",size:16}))):h(PromptIcon,{name:"refresh",size:16}),h("span",null,modelLibraryLoading?"停止":"刷新")),
                    h(ModelSourceBatchButton,{batch:sourceBatch,kind:modelLibraryKind,rootId:modelActiveFolder.root_id,folder:modelCreateFolder,ready:!!modelLibraryData.path&&!modelLibraryLoading})),
                h(ModelSourceBatchStatus,{batch:sourceBatch}),
                modelLibraryError?h("div",{role:"status",style:modelLibraryError==="已停止读取目录"?S.dim:S.bad,className:"cc-model-library-message"},modelLibraryError):null,
                modelLibraryData.warnings?.length?h("div",{role:"status",style:S.warn,className:"cc-model-library-message"},modelLibraryData.warnings.join("；")):null,
                h("div",{className:"cc-model-library-body"},renderModelTree(),renderModelInspector()),
                h("div",{className:"cc-model-library-hint"},"目录内单击展开 · Ctrl/⌘ 多选 · Shift 连选 · 拖动模型或文件夹移动")));
    }

	// ---- 渲染辅助 ----
	function picker(label, options, value, setter, minWidth) {
        return h("div", {style: S.field, className: "cc-field-select"},
            h("span", {style: S.label}, label),
            h(SelectMenu, {label, options, value, onChange: setter, theme, minWidth, forceSearch:true}));
    }
	function num(label, v, set, step) {
		return h("label", { style: S.field, key: label },
			h("span", { style: S.label }, label),
			h(DraggableNumberInput,{value:v,onChange:v=> set(v),label:label,step:step || 1,precision:numberInputPrecision(step || 1),dragPerPixel:(step || 1)/10,className:'cc-parameter-number',allowEmpty:true}));
	}

	const status = starting && startSession
        ? h("span", {"data-cc-guide":"connection-status",style:S.dim}, "● 启动中…")
        : online === null
        ? h("span", {"data-cc-guide":"connection-status",style:S.dim}, "● 检测中…")
        : online ? h("span", {"data-cc-guide":"connection-status",style:S.ok}, "● 在线")
        : h("span", {"data-cc-guide":"connection-status",style:S.bad}, "● 离线");


    function taskStatusLabel(t){return t.status==='running'?'正在生成':t.status==='queued'?'排队中':t.status==='submitting'?'提交中':t.status==='done'?'已完成':t.status==='cancelled'?'已取消':t.status==='save-error'?'保存失败':t.status==='saving'?'保存中':'错误';}
    async function pickSaveFolder(){try{const r=await jpost(EXPANDER+"/filesystem/pick-folder",{initial:savePath||settingsInfo?.outputRoot||""},310000);if(r?.path)setSavePath(r.path);}catch(e){setMsg("选择保存目录失败："+errText(e));}}
    function presetValue(){if(customSizeSelected)return "custom";const hit=IMAGE_SIZE_PRESETS.find(p=>(Number(p.w)===Number(w)&&Number(p.h)===Number(hh))||(Number(p.w)===Number(hh)&&Number(p.h)===Number(w)));return hit?hit.value:"custom";}
    function selectSizePreset(value){if(value==='custom'){setCustomSizeSelected(true);return;}const p=IMAGE_SIZE_PRESETS.find(x=>x.value===value);if(p){setCustomSizeSelected(false);setW(p.w);setHh(p.h);}}
    function currentPreviewOutput(){return sessionOutputs[0]||null;}
    function previewGeometry(selected,target){
    const iw=Number(selected?.width)||0,ih=Number(selected?.height)||0;
    const tw=Number(target.w)||1,th=Number(target.h)||1,mw=Math.max(iw,tw,1),mh=Math.max(ih,th,1);
    // Fit the image/frame together to the full rectangular preview plane.
    // The stage is the size-query container; its plane retains the shared 8px inset.
    const fit=(w,h)=>({width:`min(${w/mw*100}%, calc((100cqh - 16px) * ${w/mh}))`,height:`min(calc((100cqw - 16px) * ${h/mw}), ${h/mh*100}%)`});
    return {image:iw&&ih?fit(iw,ih):null,frame:fit(tw,th)};
}
    function renderImageSettings(){
        const locked=referenceSizeLocked(activeImage),base=referenceBaseSize(activeImage,w,hh);
        const saveOn=!!saveOutput;
        const inputStyle={...S.inp,width:"100%",minWidth:0};
        const imageNum=(label,value,setter,step,min)=>h("label",{style:S.field},h("span",{style:S.label},label),h(DraggableNumberInput,{value:value,onChange:v=>setter(v),label:label,step:step,precision:numberInputPrecision(step),dragPerPixel:(step)/10,className:'cc-parameter-number',allowEmpty:true,min:min}));
        const saveToggle=()=>{const next=!saveOn;setSaveOutput(next);if(next&&!savePath&&settingsInfo?.outputRoot)setSavePath(settingsInfo.outputRoot);};
        const samplingPresetNow=samplingPreset(activeSamplingProfile);
        const samplingCurrent=samplingValues[activeSamplingProfile]||{};
        const samplingGetValue=(def)=>{
            if(activeSamplingProfile==='ksampler'){
                if(def.key==='steps')return profile.fixedSteps??steps;
                if(def.key==='cfg')return cfg;
                if(def.key==='sampler_name')return sampler;
                if(def.key==='scheduler')return scheduler;
                if(def.key==='denoise')return 1;
            }
            const v=samplingCurrent[def.key];
            return v!==undefined?v:def.def;
        };
        const samplingField=(def)=>{
            const value=samplingGetValue(def);
            const setValue=v=>{
                if(activeSamplingProfile==='ksampler'){
                    if(def.key==='steps'){setSteps(v);return;}
                    if(def.key==='cfg'){setCfg(v);return;}
                    if(def.key==='sampler_name'){setSampler(v);return;}
                    if(def.key==='scheduler'){setScheduler(v);return;}
                    if(def.key==='denoise')return;
                }
                setSamplingValues(cur=>({...cur,[activeSamplingProfile]:{...(cur[activeSamplingProfile]||{}),[def.key]:v}}));
            };
            const disabled=(activeSamplingProfile==='ksampler'&&def.key==='steps'&&!!profile.fixedSteps)||(activeSamplingProfile==='ksampler'&&def.key==='denoise');
            if(def.kind==='combo'){
                const options=Array.isArray(def.options)?def.options.map(x=>({value:x,label:x})):def.options==='samplers'?samplers:def.options==='schedulers'?schedulers:[];
                return h("div",{key:def.key,className:"cc-field-select",style:S.field},h("span",{style:S.label},def.label),h(SelectMenu,{theme,label:def.label,minWidth:0,options,value:String(value),onChange:setValue,forceSearch:def.options==='samplers'||def.options==='schedulers',disabled}));
            }
            if(def.kind==='text')return h("label",{key:def.key,style:S.field},h("span",{style:S.label},def.label),h("input",{type:"text",style:inputStyle,value:String(value??''),disabled,onChange:e=>setValue(e.target.value)}));
            return h("label",{key:def.key,style:S.field},h("span",{style:S.label},def.label),h(DraggableNumberInput,{value:value,onChange:setValue,label:def.label,step:def.step,precision:numberInputPrecision(def.step),dragPerPixel:(def.step)/10,className:'cc-parameter-number',allowEmpty:true,min:def.min,max:def.max,disabled}));
        };
        const samplingFields=samplingPresetNow.params.map(samplingField);
        return h("div",{className:"cc-image-settings-host"},h("section",{className:"cc-image-settings","data-cc-guide":"image-settings"},
            h("div",{className:"cc-image-controls"},
                h("div",{className:"cc-image-basic"},
                h("div",{className:"cc-param-grid"},
                    activeImage?.enabled!==false&&activeImage?.asset?h('div',{className:'cc-param-wide'},h('button',{type:'button',style:S.btn2,disabled:scene3d?.enabled&&scene3DOpening,onClick:()=>{if(scene3d?.enabled){openScene3D();return;}setModelControlsOpen(false);setOutputImageEditor({value:activeImage,kind:inpaint?.enabled!==false&&inpaint?'inpaint':'reference'});}},scene3d?.enabled?(scene3DOpening?'正在打开3D编辑器…':'在3D编辑器中调整镜头与尺寸'):'在图片编辑器中调整尺寸')):h(React.Fragment,null,
                    h("div",{className:"cc-param-wide",style:S.field},h("span",{style:S.label},"比例 / 基础尺寸"),h(SelectMenu,{theme,label:"比例预设",disabled:locked,value:locked?"reference":presetValue(),onChange:selectSizePreset,minWidth:0,options:[...(locked?[{value:"reference",label:anima3d?.enabled?"使用 Anima 控制图比例":(inpaint?.enabled?"使用底图比例":"使用图生图比例")}]:[]),{value:"custom",label:"自定义尺寸"},...IMAGE_SIZE_PRESETS.map(p=>({value:p.value,label:p.label}))]})),
                    h("div",{className:"cc-param-wide cc-size-row","data-cc-guide":"image-size"},
                        h("label",{style:S.field},h("span",{style:S.label},"宽"),h(DraggableNumberInput,{value:base.w,onChange:v=>{setCustomSizeSelected(true);setW(v);},label:'宽',step:profile.sizeStep||8,precision:numberInputPrecision(profile.sizeStep||8),dragPerPixel:(profile.sizeStep||8)/10,className:'cc-parameter-number',allowEmpty:true,min:8,disabled:locked})),
                        h("label",{style:S.field},h("span",{style:S.label},"高"),h(DraggableNumberInput,{value:base.h,onChange:v=>{setCustomSizeSelected(true);setHh(v);},label:'高',step:profile.sizeStep||8,precision:numberInputPrecision(profile.sizeStep||8),dragPerPixel:(profile.sizeStep||8)/10,className:'cc-parameter-number',allowEmpty:true,min:8,disabled:locked})),
                        h("button",{type:"button",className:"cc-icon-button",style:S.btn2,disabled:locked,"aria-label":"对调宽高","data-cc-tooltip":"对调宽高",title:"对调宽高",onClick:()=>{const oldW=w,oldH=hh;setW(oldH);setHh(oldW);}},h(PromptIcon,{name:"swapSize",size:16})),
                        h("div",{style:S.field},h("span",{style:S.label},"倍率"),h(DraggableNumberInput,{value:sizeMultiplier,onChange:setSizeMultiplier,min:.25,max:4,step:.01,precision:2,dragPerPixel:1/300,label:'尺寸倍率',decreaseLabel:'减小尺寸倍率',increaseLabel:'增大尺寸倍率',className:'cc-size-multiplier'})))),
                    h("div",{className:"cc-param-wide cc-compact-sampling","data-cc-guide":"image-sampling"},
                        h("div",{className:"cc-field-select",style:S.field},h("span",{style:S.label},"采样节点"),h(SelectMenu,{theme,label:"采样节点",minWidth:0,value:activeSamplingProfile,onChange:v=>setSamplingProfile(v),options:SAMPLING_PRESETS.map(x=>({value:x.id,label:x.name}))})),
                        ...samplingFields,
                        profile.samplingShift?h("div",{style:S.field},h("span",{style:S.label},"采样 Shift"),h("div",{className:"cc-shift-controls"},h("div",null,h(SelectMenu,{theme,label:"采样 Shift 模式",minWidth:0,value:modelConfig.shift===null?"default":"custom",onChange:v=>setModelConfig(c=>({...c,shift:v==="default"?null:(profile.patchShift??3)})),options:[{value:"default",label:profile.patchNode?"模板默认":"模型默认"},{value:"custom",label:"自定义"}]})),modelConfig.shift!==null?h(DraggableNumberInput,{value:modelConfig.shift,onChange:v=>setModelConfig(c=>({...c,shift:v})),label:"Shift",step:.1,precision:numberInputPrecision(.1),dragPerPixel:(.1)/10,className:'cc-parameter-number',allowEmpty:true,min:0,max:100}):null)):null,
                        profile.guidance?imageNum("Guidance",modelConfig.guidance,v=>setModelConfig(c=>({...c,guidance:v})),.1,0):null),
                    h("label",{style:S.field},h("span",{style:S.label},"Seed"),h(DraggableNumberInput,{value:seed,onChange:v=>setSeed(v),label:'Seed',step:1,precision:numberInputPrecision(1),dragPerPixel:(1)/10,className:'cc-parameter-number',allowEmpty:true,min:-1,max:'18446744073709551615',integerString:true})),
                    h("div",{style:S.field},h("span",{style:S.label},"Seed 变化"),h(SelectMenu,{theme,label:"Seed 变化",value:seedMode,onChange:setSeedMode,minWidth:0,options:[{value:"lock",label:"锁定"},{value:"increment",label:"递增"},{value:"decrement",label:"递减"},{value:"random",label:"随机"}]})),
                    h("div",{className:"cc-param-wide","data-cc-guide":"image-save"},h("button",{type:"button",role:"switch",className:"cc-save-toggle","aria-checked":saveOn,"aria-label":"保存到本地",onClick:saveToggle},h("span",{className:"cc-switch-track","aria-hidden":"true"}),h("span",null,"保存到本地"))),
                    saveOn?h("label",{className:"cc-param-wide",style:S.field},h("span",{style:S.label},"保存目录"),h("div",{className:"cc-save-row"},h("input",{type:"text",style:inputStyle,"aria-label":"保存目录",value:savePath,onChange:e=>setSavePath(e.target.value),placeholder:settingsInfo?.outputRoot||"ComfyUI output 路径"}),h("button",{type:"button",style:S.btn2,onClick:pickSaveFolder},"浏览"))):null,
                    saveOn?h("label",{className:"cc-param-wide",style:S.field},h("span",{style:S.label},"文件名 / 前缀"),h("input",{type:"text",style:inputStyle,value:prefix,onChange:e=>setPrefix(e.target.value),placeholder:"dsh_comfy"})):null,
                    h("p",{className:"cc-param-wide cc-save-note"},saveOn?"保存到本地；生成后控制的结果单独保存到同一目录。" : "首次采样仅预览 / Temp；生成后控制结果仍会单独保存。"),
                )),
                h("div",{className:"cc-image-advanced",role:"region","aria-label":"生成与高级功能",tabIndex:0},
                    h("button",{type:"button",className:"cc-generate-open",style:{...S.btn,width:"100%"},"data-cc-guide":"generate",disabled:modelCheck||modelFileChecking,"aria-busy":modelFileChecking,onClick:e=>{flyJobToTask(e?.currentTarget);doGen(e);}},modelCheck?"检查组件中…":"生成"),
                    modelCheck?h("button",{type:"button",style:S.btn2,onClick:cancelModelCheck},"停止检查"):null)
            ),
            h("div",{className:"cc-image-actions"},lastSeed?h("span",{style:S.dim},"上一任务 Seed："+lastSeed):null)));
    }
    function renderImagePreview(){
        const target=generationImageSize(activeImage,w,hh,sizeMultiplier,profile.sizeStep||8),selected=currentPreviewOutput(),geo=previewGeometry(selected,target);
        return h('div',{className:'cc-image-preview-host'},h("div",{"data-cc-guide":"image-preview",className:"cc-image-preview-panel"},
                h("div",{className:"cc-image-preview-stage","data-preview-background":previewBackground},h(selected?"button":"div",{type:selected?"button":undefined,className:"cc-main-preview","aria-label":selected?"查看最近输出大图":undefined,onClick:selected?()=>openOutputDetail(selected,"recent"):undefined},
                    h('div',{className:'cc-preview-plane'},selected?h('div',{className:'cc-preview-image-rect',style:geo.image||{width:'100%',height:'100%'}},h('img',{src:selected.url,alt:'最近输出'})):h('div',{className:'cc-preview-empty'},activeImage?.enabled!==false&&activeImage?.asset?'生成后在此查看输出':'Latent 尺寸预览'),
                        h('div',{className:"cc-latent-frame",style:geo.frame},h('div',{className:'cc-latent-edge cc-latent-edge--top'},h('span',{className:'cc-latent-width cc-latent-label','aria-label':'最终宽度'},target.w+' px')),h('div',{className:'cc-latent-edge cc-latent-edge--left'},h('span',{className:'cc-latent-height cc-latent-label','aria-label':'最终高度'},target.h+' px')))),
                    )),
            ));
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
    React.useEffect(()=>setOutputVisible(64),[outputFilter,outputSort,outputView]);
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
    function changeOutputPreviewSize(value){
        if(!["small","large"].includes(value))return;
        setOutputPreviewSize(value);USER.outputPreviewSize=value;saveUser();
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
                        h("label",null,"最长边至少",h(DraggableNumberInput,{value:f.minEdge,onChange:v=>updateOutputFilter("minEdge",v),label:"最长边最小像素",step:1,precision:numberInputPrecision(1),dragPerPixel:(1)/10,className:'cc-parameter-number',allowEmpty:true,min:1,placeholder:"不限"})),
                        h("span",{className:"cc-output-filter-range-sep","aria-hidden":true},"—"),
                        h("label",null,"最长边至多",h(DraggableNumberInput,{value:f.maxEdge,onChange:v=>updateOutputFilter("maxEdge",v),label:"最长边最大像素",step:1,precision:numberInputPrecision(1),dragPerPixel:(1)/10,className:'cc-parameter-number',allowEmpty:true,min:1,placeholder:"不限"})),
                        h("span",{className:"cc-output-filter-hint"},"px · 只需输入一项也能筛选")):null,
                    edgeInvalid?h("div",{className:"cc-output-filter-error",role:"alert"},"最大像素不能小于最小像素"):null),"按图片最长边自动分档，无需分别填写宽高"),
                group("画面方向",h("div",{className:"cc-output-filter-chips"},...OUTPUT_SHAPE_FILTERS.map(o=>outputChip(o.label,f.shape===o.value,()=>updateOutputFilter("shape",o.value)))),"方形单独归类；接近 1:1（0.95–1.05）视为方形"),
                h("div",{className:"cc-output-filter-foot"},h("span",null,"多个条件同时生效 · 筛选不会删除图片"),h("span",null,"共 "+outputItems.length+" 张"))
            ));
    }
    async function manageOutput(item,action){
        if(action==='delete' && !await showConfirm({title:'删除图片',message:item.path?'确定永久删除此图片文件？此操作无法撤销。':'确定从本次会话移除此 Temp 记录？'}))return;
        try{if(!item.path){if(action==='delete'){SESSION_OUTPUTS.remove(item.promptId||outputKey(item));setOutputDetail(null);setMsg("已从本次会话列表移除 Temp 输出");}else setMsg("Temp 输出没有持久文件位置");return;}await jpost(EXPANDER+"/outputs/manage",{action,path:item.path},15000);if(action==='delete'){SESSION_OUTPUTS.remove(item.promptId||item.id||item.path||item.url);setOutputDetail(null);await loadOutputs();setMsg("输出图片已删除");}}catch(e){setMsg("输出管理失败："+errText(e));}}
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
    function applyOutputParams(item){if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}const p=item?.params?{...item.params,...(item.params.generationInputs||{})}:null;if(!p){setMsg("这张图片缺少可读取的 ComfyUI 生成参数，当前设置未改变");return;}if(p.pos!==undefined)updatePrompt({pos:p.pos||"",neg:p.negativeApplied===false?promptRef.current.neg:p.neg||""});if(p.ckpt||p.modelConfig){restoreModelSetup(p);}else{if(p.clip)setClip(p.clip);if(p.vae)setVae(p.vae);}if(p.clipType)setClipType(p.clipType);if(Array.isArray(p.loras))setSelLoras(p.loras);restoreImageControls(p);setW(p.baseW||p.w||w);setHh(p.baseH||p.h||hh);setSizeMultiplier(preciseSizeMultiplier(p.sizeMultiplier));if(p.steps)setSteps(p.steps);if(p.cfg!==undefined)setCfg(p.cfg);if(p.sampler)setSampler(p.sampler);if(p.scheduler)setScheduler(p.scheduler);if(p.usedSeed!==undefined||p.seed!==undefined)setSeed(p.usedSeed??p.seed);setSeedMode(p.seedMode||"lock");if(p.postControls||p.upscale!==undefined)setPostControls(normalizePost(p));if(p.upscale!==undefined)setUpscale(!!p.upscale);if(p.upscaleModel)setUpscaleModel(p.upscaleModel);if(p.upscaleFactor)setUpscaleFactor(p.upscaleFactor);setOutputDetail(null);switchTab("gen");setMsg("已用该图片的生成参数替换当前设置");}
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
        const p=item?.params||{},postOutput=!!p.postControls,rows=[];
        const add=(label,value)=>{if(value===undefined||value===null||value==='')return;rows.push([label,String(value)]);};
        if(!postOutput)add('输出尺寸',(item?.width||p.outputW||p.w||'?')+' × '+(item?.height||p.outputH||p.h||'?'));
        if(p.baseW&&p.baseH&&(Number(p.baseW)!==Number(item?.width)||Number(p.baseH)!==Number(item?.height)))add('基础尺寸',p.baseW+' × '+p.baseH);
        if(p.w&&p.h&&(Number(p.w)!==Number(item?.width)||Number(p.h)!==Number(item?.height)))add('原图尺寸',p.w+' × '+p.h);
        if(!postOutput){
            if(p.sizeMultiplier && Number(p.sizeMultiplier)!==1)add('尺寸倍率','×'+p.sizeMultiplier);
            if(p.upscale!==undefined)add('后处理放大',p.upscale?(p.upscaleFactor?('启用 · ×'+p.upscaleFactor):'启用'):'关闭');
        }
        add('适配类型',p.modelConfig?modelProfile(p.modelConfig).label:undefined);if(p.modelConfig&&modelProfile(p.modelConfig).family==='sd3'){add('文本编码方式',({embedded:'Checkpoint 内置',triple:'CLIP-L + CLIP-G + T5XXL',dual:'CLIP-L + CLIP-G'})[p.modelConfig.clipType]||p.modelConfig.clipType);}
        add('步数',p.steps);add('CFG',p.effectiveCfg??p.cfg);add('采样器',p.sampler);add('调度器',p.scheduler);add('种子',p.usedSeed??p.seed);add('Denoise',p.denoise);
        const known=new Set(['steps','cfg','sampler_name','sampler','scheduler','seed','noise_seed','denoise','model','positive','negative','latent_image']);
        for(const [key,value] of Object.entries(p.samplerSettings||{})){if(known.has(key)||Array.isArray(value)||value===undefined||value===null||value==='')continue;add(key,value);}
        return rows;
    }
    function outputProcessRows(item){
        const p=item?.params||{},post=p.postControls;if(!post)return [];
        const rows=[],cells=(post.cells||[]).filter(c=>c&&c.enabled!==false);
        const sourceLabel=v=>v==='custom'?'自定义':v==='original'?'原图参数':'工作流';
        if(cells.length){
            const steps=cells.map(c=>{
                if(c.kind==='upscale')return '超分放大'+(c.model?(' · '+shortModel(c.model)):'')+(Number(c.factor)&&Number(c.factor)!==1?(' · ×'+c.factor):'');
                if(c.kind==='resample')return '二次采样'+(c.denoise!==undefined?(' · 降噪 '+c.denoise):'');
                if(c.kind==='face')return 'FaceDetailer 面部细化';
                if(c.kind==='workflow')return '自定义工作流'+(c.name?(' · '+c.name):'');
                return POST_KINDS[c.kind]||c.kind;
            });
            rows.push(['处理步骤',steps.join(' → ')]);
            cells.forEach((c,i)=>{
                const n=String(i+1).padStart(2,'0');
                if(c.kind==='upscale'){
                    rows.push([n+' 超分放大','模型 '+(c.model||'—')+' · 倍率 ×'+(Number(c.factor)||1)]);
                }else if(c.kind==='resample'){
                    const cs=c.customModelSetup||{},parts=['来源 '+sourceLabel(c.parameterSource),'降噪 '+(c.denoise??'—'),'步数 '+(cs.steps??c.steps??'—'),'CFG '+(cs.cfg??c.cfg??'—'),'采样器 '+(cs.sampler||c.sampler||'—'),'调度器 '+(cs.scheduler||c.scheduler||'—')];
                    if(cs.ckpt)parts.push('底模 '+shortModel(cs.ckpt));
                    const loras=(Array.isArray(cs.loras)?cs.loras:[]).filter(l=>l&&l.enabled!==false&&l.name);
                    if(loras.length)parts.push('LoRA '+loras.map(l=>shortModel(l.name)).join('、'));
                    rows.push([n+' 二次采样',parts.join(' · ')]);
                    if(String(c.prompt||'').trim())rows.push([n+' 二次采样 提示词',String(c.prompt).trim()]);
                    if(String(c.negative||'').trim())rows.push([n+' 二次采样 负面',String(c.negative).trim()]);
                }else if(c.kind==='face'){
                    const cs=c.customModelSetup||{},parts=['来源 '+sourceLabel(c.parameterSource),'检测 '+(c.detector||'—')];
                    if(c.samModel)parts.push('SAM '+shortModel(c.samModel));
                    if(c.segmDetector)parts.push('SEGM '+shortModel(c.segmDetector));
                    parts.push('降噪 '+(c.denoise??'—'),'细化 '+(c.guide_size??'—'),'最大 '+(c.max_size??'—'),'步数 '+(cs.steps??c.steps??'—'),'CFG '+(cs.cfg??c.cfg??'—'));
                    if(cs.ckpt)parts.push('底模 '+shortModel(cs.ckpt));
                    const loras=(Array.isArray(cs.loras)?cs.loras:[]).filter(l=>l&&l.enabled!==false&&l.name);
                    if(loras.length)parts.push('LoRA '+loras.map(l=>shortModel(l.name)).join('、'));
                    rows.push([n+' FaceDetailer',parts.join(' · ')]);
                    if(String(c.prompt||'').trim())rows.push([n+' FaceDetailer 提示词',String(c.prompt).trim()]);
                    if(String(c.negative||'').trim())rows.push([n+' FaceDetailer 负面',String(c.negative).trim()]);
                }else if(c.kind==='workflow'){
                    rows.push([n+' 自定义工作流',(c.workflow?.name||c.name||'—')]);
                }
            });
        }
        if(post.inpaint&&post.inpaint.enabled!==false){
            const ip=post.inpaint,parts=['启用'];
            if(ip.denoise!==undefined)parts.push('降噪 '+ip.denoise);
            if(Number(ip.coverage)>0)parts.push('遮罩 '+(Number(ip.coverage)*100).toFixed(1)+'%');
            if(ip.parameterSource)parts.push('来源 '+sourceLabel(ip.parameterSource));
            rows.push(['局部重绘',parts.join(' · ')]);
            if(String(ip.prompt||'').trim())rows.push(['局部重绘 提示词',String(ip.prompt).trim()]);
            if(String(ip.negative||'').trim())rows.push(['局部重绘 负面',String(ip.negative).trim()]);
        }
        const outW=item?.width||p.outputW,outH=item?.height||p.outputH;
        if(outW&&outH)rows.push(['输出尺寸',outW+' × '+outH]);
        return rows;
    }
    function outputEditorSource(item){return {path:item.path||'',image:item.imageInfo||null,prompt_id:item.promptId||'',filename:item.filename||'输出图片',params:editorOriginalParams(item.params)};}
    async function importOutputForEditor(item,signal){
        const blob=await outputOriginalBlob(item,signal),bitmap=await referenceRead(blob);
        let original,asset;try{({original,asset}=await referencePersistCanvas(referenceCanvasFromBitmap(bitmap),signal));}finally{bitmap.close();}
        // Preserve original PNG metadata in the immutable source record when supported.
        if(blob.type.includes('png'))try{original=await referenceStore(blob,signal);}catch(error){if(signal?.aborted)throw error;}
        return normalizeReferenceImage({asset,original,editorDocument:null,name:item.filename||'输出图片',enabled:true,mode:'reference',sourceOutput:outputEditorSource(item)});
    }
    async function insertOutputReference(item){
        if(outputImageTask.current)return;
        if(referenceImage?.asset&&!await showConfirm({title:'替换图生图',message:'替换当前图生图图片及其编辑历史？'}))return;
        const ctl=new AbortController();outputImageTask.current=ctl;setOutputImageBusy(true);setOutputImageError('');
        try{const next=await importOutputForEditor(item,ctl.signal);if(ctl.signal.aborted)return;referenceEditorSaveCell('referenceImage',next);appendComponentOrder('reference');changeReference(next);setOutputDetail(null);switchTab('gen');setSizeMultiplier(1);setMsg('已插入图生图');}
        catch(e){if(!ctl.signal.aborted)setOutputImageError(errText(e));}
        finally{if(outputImageTask.current===ctl){outputImageTask.current=null;setOutputImageBusy(false);}}
    }
    async function insertOutputPost(item){
        if(outputImageTask.current)return;
        if(postControls.input?.asset&&!await showConfirm({title:'替换处理图片',message:'将当前图片替换为这张输出图片？'}))return;
        const ctl=new AbortController();outputImageTask.current=ctl;setOutputImageBusy(true);setOutputImageError('');
        try{const next=await importOutputForEditor(item,ctl.signal);if(ctl.signal.aborted)return;setPostControls(cur=>normalizePost({postControls:{...cur,input:next,inpaint:cur.inpaint?{...cur.inpaint,asset:next.asset,original:next.original,mask:null,coverage:0}:null}}));setOutputDetail(null);switchTab('gen');setPostOpen(true);setMsg('已导入生成后控制');}
        catch(e){if(!ctl.signal.aborted)setOutputImageError(errText(e));}
        finally{if(outputImageTask.current===ctl){outputImageTask.current=null;setOutputImageBusy(false);}}
    }
    async function exitImageEditor(intent,result,origin=null){
        if(intent==='output'||intent==='saveas'){
            const saved=await referenceExportEdited(intent,result,{folder:savePath||settingsInfo?.outputRoot||'',prefix});
            if(intent==='output'){await loadOutputs();setMsg('编辑后的图片已保存到输出目录');}
            else setMsg('编辑后的图片已另存为');
            return true;
        }
        if(intent==='inpaint'){
            if(!result.mask||result.coverage<=0)throw Error('局部重绘需要有效遮罩');
            const existingInpaint=normalizePost(postControls).inpaint;
            if(existingInpaint?.asset&&!await showConfirm({title:'替换局部重绘',message:'替换生成后控制中现有的局部重绘底图与遮罩？'}))return false;
            const next={...result,enabled:true,mode:result.settings?.mode,name:result.name,grow:result.settings?.grow??existingInpaint?.grow??0,feather:result.settings?.feather??existingInpaint?.feather??8};delete next.settings;delete next.destination;
            const baseInput={asset:result.asset,original:result.original||result.asset,editorDocument:result.editorDocument||null,name:result.name||'',sourceOutput:result.sourceOutput||null};
            setPostControls(cur=>{const prev=normalizePost(cur);return normalizePost({postControls:{...prev,input:baseInput,inpaint:{...(prev.inpaint||{}),...next}}});});
            setPostOpen(true);setOutputDetail(null);switchTab('gen');
            requestAnimationFrame(()=>requestAnimationFrame(()=>{const el=document.querySelector('.cc-post-workbench');if(el)el.scrollIntoView({block:'start',behavior:'smooth'});}));
            setMsg('已保存到生成后控制的局部重绘');return true;
        }
        const kind='reference',existing=referenceImage;
        if(origin!==kind&&existing?.asset&&!await showConfirm({title:'替换图生图',message:'替换现有图片及其编辑历史？'}))return false;
        const next={...(origin===kind?existing:{}),...result,enabled:true,mode:result.settings.mode,name:result.name};delete next.settings;delete next.destination;
        const value=normalizeReferenceImage(next);referenceEditorSaveCell('referenceImage',value);appendComponentOrder('reference');changeReference(value);
        applyImageSizeSettings(result.settings);setOutputDetail(null);switchTab('gen');setMsg('已保存到图生图单元格');return true;
    }
    async function openOutputImageEditor(item){
        if(outputImageTask.current)return;
        if(expandPhaseRef.current!=="idle"){setOutputImageError('请先完成或停止 AI 操作');return;}
        const ctl=new AbortController();outputImageTask.current=ctl;setOutputImageBusy(true);setOutputImageError('');
        try{const value=await importOutputForEditor(item,ctl.signal);if(ctl.signal.aborted||outputImageTask.current!==ctl)return;setOutputImageEditor({value});setOutputDetail(null);}
        catch(e){if(!ctl.signal.aborted)setOutputImageError(errText(e));}
        finally{if(outputImageTask.current===ctl){outputImageTask.current=null;setOutputImageBusy(false);}}
    }
    async function openOutputInpaintEditor(item){
        if(outputImageTask.current)return;
        if(expandPhaseRef.current!=="idle"){setOutputImageError('请先完成或停止 AI 操作');return;}
        const ctl=new AbortController();outputImageTask.current=ctl;setOutputImageBusy(true);setOutputImageError('');
        try{const value=await importOutputForEditor(item,ctl.signal);if(ctl.signal.aborted||outputImageTask.current!==ctl)return;setOutputImageEditor({value,initialTool:'mask',singleSave:true});setOutputDetail(null);}
        catch(e){if(!ctl.signal.aborted)setOutputImageError(errText(e));}
        finally{if(outputImageTask.current===ctl){outputImageTask.current=null;setOutputImageBusy(false);}}
    }
    function renderOutputDetailInfo(item){
        const p=item?.params||null,models=outputModelsFor(item),settings=outputSettingRows(item),processRows=outputProcessRows(item),created=item?.createdAt||((item?.mtime||0)*1000)||0;
        const groups=[];
        for(const m of models){let g=groups.find(x=>x.kind===(m.kind||'model'));if(!g){g={kind:m.kind||'model',items:[]};groups.push(g);}g.items.push(m);}
        const modelRows=models.length?groups.map((g,gi)=>h("div",{key:'group-'+g.kind+'-'+gi,className:"cc-output-model-group"},
            h("span",{className:"cc-output-model-group-label"},outputModelKindLabel(g.kind),g.items.length>1?h("span",{className:"cc-output-model-count"},g.items.length):null),
            h("div",{className:"cc-output-model-chips"},...g.items.map((m,i)=>{const detail=m.detail||(m.kind==='lora'&&m.strengthModel!==undefined?(m.modelOnly?`仅模型 ${m.strengthModel??1}`:`模型 ${m.strengthModel??1} · CLIP ${m.strengthClip??m.strengthModel??1}`):'');const name=shortModel(m.name||'未知');return h("span",{key:(m.name||i)+'-'+i,className:"cc-output-model-chip"+(['checkpoint','diffusion'].includes(m.kind)?' is-primary':''),title:(m.name||'未知')+(detail?'\n'+detail:'')},name+(m.kind==='lora'&&m.strengthModel!==undefined?(' · '+m.strengthModel):''));})) )):
            h("div",{style:S.dim},p?"工作流中没有识别到模型加载节点":"该图片没有可读取的 ComfyUI 工作流元数据");
        return h(React.Fragment,null,
            h("div",{className:"cc-output-info-title"},h("strong",null,item?.filename||"Temp 输出"),h("small",null,item?.path||"ComfyUI temp · 本次会话")),
            item?.imageEdited?h('div',{className:'cc-output-edited-warning',role:'note'},h('strong',null,'此图片经过图像编辑'),h('span',null,'下方生成参数仅能生成编辑前的原始图片，不能还原当前编辑结果。')):null,
            processRows.length?h("section",{className:"cc-output-info-section cc-output-process-section"},h("strong",null,"图片处理"),h("dl",{className:"cc-output-info-grid"},...processRows.flatMap(([a,b],i)=>[h("dt",{key:'pdt'+i},a),h("dd",{key:'pdd'+i},b)]))):null,
            h("section",{className:"cc-output-info-section"},h("div",{className:"cc-output-info-section-head"},h("strong",null,"使用的模型"),models.length?h("span",{style:S.dim,title:"仅统计连接到当前输出且未被跳过 / 禁用的模型"},"当前输出链路 · "+models.length+" 个"):null),h("div",{className:"cc-output-model-list"},...(Array.isArray(modelRows)?modelRows:[modelRows]))),
            h(OutputPromptSection,{title:"正面提示词",text:p?.pos}),
            h(OutputPromptSection,{title:"负面提示词",text:p?.neg}),
            h("section",{className:"cc-output-info-section"},h("strong",null,"生图设置"),settings.length?h("dl",{className:"cc-output-info-grid"},...settings.flatMap(([a,b],i)=>[h("dt",{key:'dt'+i},a),h("dd",{key:'dd'+i},b)])):h("div",{style:S.dim},"该图片没有可读取的生图参数")),
            h("section",{className:"cc-output-info-section"},h("strong",null,"输出信息"),h("dl",{className:"cc-output-info-grid"},
                (()=>{const dur=formatGenerationDuration(item);return dur?h(React.Fragment,null,h("dt",null,"生成用时"),h("dd",null,dur)):null;})(),
                h("dt",null,"生成时间"),h("dd",null,created?new Date(created).toLocaleString():"未知"),
                h("dt",null,"保存状态"),h("dd",null,item?.saved?"已保存":"Temp / 未保存"),
                h("dt",null,"保存路径"),h("dd",null,item?.path||"ComfyUI temp（本次会话）"))),
            null);
    }
    function renderOutputViewerActions(item){
        const hasLora=outputModelsFor(item).some(row=>row.kind==='lora'&&!(row.strengthModel===0&&row.strengthClip===0));
        return h(OutputViewerActions,{key:outputKey(item)+'|'+item.url,item,hasLora,editing:outputImageBusy,imageError:outputImageError,
            onEdit:()=>openOutputImageEditor(item),onInpaint:()=>openOutputInpaintEditor(item),onReference:()=>insertOutputReference(item),onApply:()=>applyOutputParams(item),
            onPreview:kind=>setPreviewOutput({...item,previewKind:kind}),onOpen:()=>manageOutput(item,'open'),onDelete:()=>manageOutput(item,'delete'),
            onRetry:item.saveFailed?async()=>{const ok=await BG.retrySave(item.promptId);if(ok){setOutputDetail(null);await loadOutputs();setMsg('已重新保存，无需重新生成');}else setMsg('保存重试失败：请确认 Temp 文件仍在、目标目录可写');}:null});
    }
    function outputDetailNavigation(){
        if(!outputDetail)return {prev:null,next:null};
        let rows=outputDetailScope==="recent"?(sessionOutputs.length?sessionOutputs:outputItems):filteredOutputs();
        let index=rows.findIndex(x=>sameOutput(x,outputDetail));
        if(index<0){rows=outputItems;index=rows.findIndex(x=>sameOutput(x,outputDetail));}
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
                h("div",{className:"cc-output-card-sub"},h("span",null,(x.width||"?")+" × "+(x.height||"?")+(formatGenerationDuration(x)?" · "+formatGenerationDuration(x):"")),h("span",{className:"cc-output-card-state"},x.saved?"已保存":"Temp"))));
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
                    h("div",{className:"cc-output-quality",role:"group","aria-label":"预览尺寸"},
                        h("span",{className:"cc-output-quality-label"},"预览尺寸"),
                        ...[['small','小'],['large','大']].map(([value,label])=>h("button",{key:value,type:"button",className:"cc-output-quality-btn","aria-pressed":outputPreviewSize===value,title:value==='small'?'普通瀑布流尺寸':'放大预览，所有图片占两列',onClick:()=>changeOutputPreviewSize(value)},label))),
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
                rows.length?(outputView==='masonry'?h(OutputMasonry,{items:visible,renderCard:card,gap:5,large:outputPreviewSize==='large'}):h("div",{className:"cc-output-grid"},...visible.map(card))):h("div",{className:"cc-output-empty"},h(PromptIcon,{name:"image",size:28}),h("strong",null,outputLoading?"正在读取输出…":"没有符合条件的图片"),!outputLoading&&active?h("button",{type:"button",style:S.btn2,onClick:()=>setOutputFilter(emptyOutputFilter())},"清除筛选"):null)),
            rows.length>outputVisible?h("div",{ref:outputLoadMoreRef,className:"cc-output-load-sentinel",role:"status","aria-live":"polite"},"继续向下滚动将自动加载更多 · "+visible.length+" / "+rows.length):null);
    }

	// ==================== 生成页 ====================
    function promptIconButton(icon, tooltip, onClick, disabled = false, extra = {}) {
        return h("button", {type:"button",className:"cc-icon-button"+(extra.className?" "+extra.className:""),
            style:{...S.btn2,padding:0,...(extra.style || {})},"aria-label":tooltip,"data-cc-tooltip":tooltip,
            disabled,onClick,...(extra.props || {})},extra.iconClassName?h("span",{className:extra.iconClassName},h(PromptIcon,{name:icon,size:18})):h(PromptIcon,{name:icon,size:18}));
    }
    function renderPromptHeader(layoutInfo={}){
        if(layoutInfo.replaceChat&&exOpen)return null;
        const busy=expandPhase!=="idle";
        return h('div',{className:'cc-prompt-header-tools'+(exOpen&&!layoutInfo.replaceChat?' cc-prompt-header-tools--split':''),'data-cc-guide':'prompt-history',onKeyDown:promptKeys},
            promptIconButton('undo','撤回',()=>restorePrompt('undo'),false,{props:{'aria-disabled':busy||!historyRef.current.canUndo()}}),
            promptIconButton('redo','重做',()=>restorePrompt('redo'),false,{props:{'aria-disabled':busy||!historyRef.current.canRedo()}}));
    }
    function renderPromptSection(layoutInfo={}) {
        const replaceChat=!!layoutInfo.replaceChat&&exOpen;
        const busy = expandPhase !== "idle";
        const previewNames={raw:"原文",tags:"标签",zh:"中文标签"};
        const fields=profile.negative?[{kind:"pos",title:"正向提示词",value:pos},{kind:"neg",title:"负向提示词",value:neg}]:[{kind:"pos",title:"正向提示词",value:pos}];
        const allParts=fields.map(f=>splitPromptPreview(f.value));
        const resizeHandle=f=>h("div", {
            className:"cc-prompt-resize-handle", role:"separator", tabIndex:busy?-1:0,
            "aria-label":"调整"+f.title+"输入框高度", "aria-orientation":"horizontal",
            "aria-valuemin":f.kind==="pos"?145:100, "aria-valuenow":areaHeights[f.kind],
            "data-dragging":resizingKind===f.kind?"true":"false",
            onPointerDown:e=>beginAreaResize(f.kind,e),
            onPointerMove:e=>moveAreaResize(f.kind,e),
            onPointerUp:e=>endAreaResize(f.kind,e),
            onPointerCancel:e=>endAreaResize(f.kind,e),
            onKeyDown:e=>resizeAreaByKey(f.kind,e)
        },
            h("span", {className:"cc-resize-grip"}, h(PromptIcon,{name:"grip",size:15})),
            h("span", {className:"cc-resize-arrows"}, h(PromptIcon,{name:"resizeVertical",size:15}))
        );
        const promptField=f=>h("div", {
            key:f.kind, className:"cc-prompt-field",
            "data-cc-guide":f.kind==="pos"?"prompt-positive":"prompt-negative"
        },
            h("label", {style:S.label, htmlFor:"cc-"+(f.kind==="pos"?"positive":"negative")+"-prompt"}, f.title),
            h("div", {className:"cc-prompt-input-shell"},
                h("textarea", {
                    id:"cc-"+(f.kind==="pos"?"positive":"negative")+"-prompt",
                    ref:f.kind==="pos"?posAreaRef:negAreaRef,
                    className:"cc-prompt-textarea",
                    style:{...S.ta,height:areaHeights[f.kind],minHeight:f.kind==="pos"?145:100,overflowY:"auto"},
                    ...autocomplete.props(f.kind), value:f.value, disabled:busy, placeholder:"输入"+f.title+"…",
                    onPaste:()=>{pasteRef.current=true;}, onCut:()=>{pasteRef.current=true;},
                    onChange:e=>promptInput(f.kind,e),
                    onCompositionStart:e=>promptComposition(f.kind,false,e),
                    onCompositionEnd:e=>promptComposition(f.kind,true,e)
                }),
                resizeHandle(f)
            )
        );
        const previewField=(f,items,base,k)=>h("div", {
            key:f.kind, className:"cc-prompt-field",
            "data-cc-guide":f.kind==="pos"?"prompt-positive":"prompt-negative"
        },
            h("span", {style:S.label}, f.title),
            h("div", {className:"cc-prompt-input-shell"},
                h("div", {
                    className:"cc-prompt-textarea cc-prompt-preview-surface", role:"group",
                    "aria-label":f.title+(previewMode==="zh"?"中文标签预览":"标签预览"),
                    style:{...S.ta,height:areaHeights[f.kind],minHeight:f.kind==="pos"?145:100,resize:"none",overflowY:"auto"}
                },
                    h("div",{className:"cc-preview-tags"},
                        allParts[k].length?allParts[k].map((part,i)=>h(PromptPreviewChip,{key:i,part,
                            label:items[base+i]?.text||part.text,disabled:busy,
                            onWeight:(weight,gesture)=>editChip(f.kind,i,weight,gesture),
                            onRemove:()=>editChip(f.kind,i,null)})):h("span",{style:S.dim},"（空）")
                    )
                ),
                resizeHandle(f)
            )
        );
        const textFields=fields.map(promptField);
        const chipFields=items=>{let offset=0;return fields.map((f,k)=>{
            const base=offset;offset+=allParts[k].length;
            return previewField(f,items,base,k);
        });};
        const aiButton=(icon,label,guideTarget)=>{
            const own=busy;
            const tooltip=own?(expandPhase==="running"?"停止"+label:"正在停止"+label):label;
            return h("button",{type:"button",className:"cc-icon-button cc-expand-btn",style:S.btn2,
                "aria-label":tooltip,"data-cc-tooltip":tooltip,"data-cc-guide":guideTarget,disabled:(busy&&!own)||expandPhase==="stopping",
                onClick:own?stopExpand:doExpand},
                !own?h(PromptIcon,{name:icon}):h(React.Fragment,null,
                    h("span",{className:"cc-icon-spinner"},h(PromptIcon,{name:"spinner"})),
                    expandPhase==="running"?h("span",{className:"cc-icon-stop"},h(PromptIcon,{name:"stop"})):null));
        };
        return h("div", {className:"cc-prompt-layout"+(exOpen?" cc-prompt-layout--chat":"")+(replaceChat?" cc-prompt-layout--replacement":""),
            style:replaceChat?{minHeight:Math.max(360,areaHeights.pos+(profile.negative?areaHeights.neg:0)+165)}:undefined,"data-cc-guide":"prompt-module"},
            h("div", {className:"cc-prompt-card",hidden:replaceChat,style:S.card,onKeyDown:promptKeys},
                !profile.negative?h("details",{className:"cc-model-negative-saved"},h("summary",{className:"cc-summary"},"当前流程不使用负面提示词 · 原文已保留"),h("pre",{style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11}},neg||"（空）")):null,
                h(PromptChinesePreview,{texts:allParts.flat().map(p=>p.text),active:previewMode==="zh",onBusyChange:setPreviewTranslating},
                    items=>previewMode==="raw"?textFields:previewMode==="tags"?chipFields([]):chipFields(items)),
                h("div",{className:"cc-prompt-actions",style:{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5,flexWrap:"wrap"}},
                    busy?h("span",{role:"status",style:S.dim},expandPhase==="stopping"?"正在停止…":"AI 正在思考 / 生成中…"):null,
                    promptIconButton(previewMode==="zh"&&previewTranslating?"spinner":"preview","切换预览",()=>{
                        autocomplete.close();const next=previewMode==="raw"?"tags":previewMode==="tags"?"zh":"raw";
                        setPreviewMode(next);
                    },false,{iconClassName:previewMode==="zh"&&previewTranslating?"cc-icon-spinner":undefined,
                        props:{"aria-busy":previewMode==="zh"&&previewTranslating,"aria-description":"当前："+previewNames[previewMode],"data-cc-guide":"prompt-preview"}}),
                    aiButton("pencil","AI扩写","prompt-expand"),
                    promptIconButton("chat","对话编辑",()=>{autocomplete.close();setExOpen(v=>!v);},false,
                        {style:exOpen?{background:"var(--cc-accent-bg)",border:"1px solid var(--cc-accent)","--cc-button-border":"var(--cc-accent)","--cc-button-hover":"color-mix(in srgb,var(--cc-accent-bg) 82%,var(--cc-accent))"}:{},props:{"aria-pressed":exOpen,"data-cc-guide":"prompt-chat"}}),
                    promptIconButton("x","清空提示词",()=>updatePrompt({pos:"",neg:""}),busy,{className:"cc-tooltip-right",props:{"data-cc-guide":"prompt-clear"}}))),
            renderExDialog(replaceChat),
            viewMessage?h(PromptResultViewer,{message:viewMessage,theme,onClose:()=>setViewMessage(null)}):null);
    }

	function genTab() {
		return h(React.Fragment, null,
            h(RuntimeDashboard,{jobs:tasks,theme,onOpenTask:setTaskDetail,online,onReleaseMemory:releaseGpuMemory}),
            renderWorkbench((id,layoutInfo)=>id==='prompt'?renderPromptSection(layoutInfo):id==='model'?renderModelDock(layoutInfo):id==='parameters'?renderImageSettings():id==='post'?h(PostControlsModal,{value:postControls,onChange:next=>setPostControls(normalizePost({postControls:next})),onEditWorkflow:editPostWorkflow,onCreateWorkflow:editPostWorkflow.create,workflowLibraryRevision,theme,modelDockRevision:modelDockRevision,onPickModel:(kind,cur,cb)=>openModelPicker(kind,cur,cb),expanded:postOpen,onToggle:()=>setPostOpen(v=>!v),onProcess:runPostProcessing,processing:modelCheck||modelFileChecking,resultUrl:currentPreviewOutput()?.url||'',upscalers,samplers,schedulers,currentSetup:{ckpt,clip,clipType,vae,modelConfig:{...modelConfig},loras:selLoras.map(x=>({...x})),steps:Number(steps),cfg:Number(cfg),sampler,scheduler},ckpts,diffusions,clips,vaes,loras,embedded:true,outputItems,onLoadOutputs:loadOutputs,historyLoading:outputLoading,online}):renderImagePreview()),
            // 暂时隐藏视角预设，保留实现；重新开放前需按 DEFERRED_UI.md 更新。
            DEFERRED_UI.viewPresets ? h("div", { style: S.card },
                h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    h("span", { style: S.label }, "视角"),
                    h("span", { style: S.dim }, "同时改【姿势 + 构图 + 前置相机词】，其余提示词不动")),
                h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
                    (typeof VIEWS !== 'undefined' ? VIEWS : []).map((v) =>
                        h("button", {key:v.key,style:Object.assign({},S.btn2,viewKey===v.key?{background:"var(--cc-accent-bg)",border:"1px solid var(--cc-accent)","--cc-button-border":"var(--cc-accent)","--cc-button-hover":"color-mix(in srgb,var(--cc-accent-bg) 82%,var(--cc-accent))"}:{}),disabled:expandPhase!=="idle",onClick:()=>switchView(v.key)},v.label)),
                    h("button", {style:S.btn2,disabled:expandPhase!=="idle",onClick:()=>{const ok=normalizeView();setMsg(ok?"已按当前视角校正提示词":"校正失败：缺少视角定义");}}, "按当前视角校正")),
                h("div", { style: S.dim }, ((typeof VIEWS !== 'undefined' ? VIEWS : []).find(x=>x.key===viewKey)||{}).hint||"")) : null
        );
	}

	// ==================== 词库页 ====================
    function libTab() {
        return h(DictionaryPanel,{theme,setMsg,ready:dictionaryReady,onRetry:()=>setDictionaryRetry(v=>v+1)});
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
					h("input", { style: Object.assign({}, S.inp, { width: "130px" }), placeholder: "分类(默认)", value: presetCat, onChange: (e) => setPresetCat(e.target.value) }),
					h("button", { style: S.btn, onClick: savePreset }, "保存为预设"),
					h("span", { style: S.dim }, "存的是：正/负提示词 + 底模 + LoRA + 尺寸步数 CFG 采样器")),
				h("span", { style: S.dim }, "同名同分类会覆盖。数据存在本机 localStorage，换机器不带。")),

			// ---- 从 ComfyUI 工作流导入 ----
			h("div", {
				style: Object.assign({}, S.card, {
					border: "1px solid rgba(150,120,225,.55)",
					background: "rgba(150,120,225,.08)",
				}),
			},
				h("span", { style: S.label }, "从 ComfyUI 工作流导入（支持 UI 格式与 API 格式）"),
				h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
					h("button", { style: S.btn2, onClick: pickWfFile }, "选择 .json 文件"),
					h("button", { style: S.btn, onClick: doParseWf }, "解析"),
					wfResult && wfResult.ok ? h("button", { style: S.btn, onClick: saveWfAsPreset }, "存成预设并套用") : null,
					wfText ? h("button", { style: S.btn2, onClick: () => { setWfText(""); setWfResult(null); setMsg("已清空"); } }, "清空") : null),
				h("textarea", {
					style: Object.assign({}, S.ta, { height: "90px" }),
					placeholder: "把 ComfyUI 的工作流 JSON 粘到这里（或点上面的「选择 .json 文件」）",
					value: wfText, onChange: (e) => setWfText(e.target.value),
				}),
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

    const taskDetailLive=taskDetail?(tasks.find(job=>(taskDetail.pid&&job.pid===taskDetail.pid)||(taskDetail.localId&&job.localId===taskDetail.localId))||taskDetail):null;
	// ==================== 组装 ====================
	return h("div", { ref: rootRef, className: "dsh-comfy-ui",
        style: Object.assign({}, S.wrap, theme, { "--cc-accent": themeAccentState, "--cc-accent-bg": themeAccentState + "22", "--cc-accent-text": accentTextForScheme(theme && theme["--cc-scheme"]) }),
        onPointerDownCapture: maybeStartBasicTutorial,
        style: Object.assign({}, S.wrap, theme) },
        h("style", null, UI_CSS),
        h(ErrorNoticeViewport,{theme}),
        latentReplace ? h(OverlayModal,{title:'替换 latent 输入',width:420,theme,onClose:()=>setLatentReplace(null)},
            h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
                h('p',{style:{margin:0,lineHeight:1.6,fontSize:'13px'}},'当前已有「'+latentReplace.other[1]+'」，是否移除并替换为「'+LATENT_LABELS[latentReplace.kind]+'」？'),
                h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8}},
                    h('button',{type:'button',style:S.btn2,onClick:()=>setLatentReplace(null)},'取消'),
                    h('button',{type:'button',style:S.btn,onClick:()=>{const {kind,other}=latentReplace;setLatentReplace(null);performLatentReplace(kind,other);}},'替换')))) : null,
        confirmState ? h(OverlayModal,{title:confirmState.title||'确认',width:420,theme,zIndex:2147482300,onClose:()=>{const r=confirmState.resolve;setConfirmState(null);r&&r(false);}},
            h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
                h('p',{style:{margin:0,lineHeight:1.6,fontSize:'13px'}},confirmState.message),
                h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8}},
                    h('button',{type:'button',style:S.btn2,onClick:()=>{const r=confirmState.resolve;setConfirmState(null);r&&r(false);}},'取消'),
                    h('button',{type:'button',style:S.btn,onClick:()=>{const r=confirmState.resolve;setConfirmState(null);r&&r(true);}},'确定')))) : null,
        scene3dSaveConfirm ? h(OverlayModal,{title:'替换 3D 参考',width:440,theme,onClose:()=>setScene3dSaveConfirm(null)},
            h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
                h('p',{style:{margin:0,lineHeight:1.6,fontSize:'13px'}},'当前 3D 场景尚未保存，替换后会从组件移除。是否保存？'),
                h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8}},
                    h('button',{type:'button',style:S.btn2,onClick:()=>setScene3dSaveConfirm(null)},'取消'),
                    h('button',{type:'button',style:S.btn2,onClick:()=>{const c=scene3dSaveConfirm;setScene3dSaveConfirm(null);doLatentReplace(c.kind,c.other);}},'直接替换'),
                    h('button',{type:'button',style:S.btn,onClick:async()=>{const c=scene3dSaveConfirm;const ok=await saveScene3DPreset(scene3d,{removeLabel:'保存后替换'});if(!ok)return;setScene3dSaveConfirm(null);doLatentReplace(c.kind,c.other);}},'保存后替换')))) : null,
        // 固定的全局工具栏与页面导航，同属一个 sticky 容器。
        h("div",{ref:stickyShellRef,className:"cc-sticky-shell"},
		h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
			h("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", minWidth: 0 } },
				h("strong", { style: { fontSize: "15px" } }, "ComfyUI 绘图台"),
				status),
			h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 } },
				comfyUpdate?.available?h("button",{type:"button",className:"cc-update-btn",title:"ComfyUI 有新版本可用",onClick:()=>{setUpdateError("");setUpdateOpen(true);}},"可更新"):null,
                h(ComfyStartupButton,{starting,online,session:startSession,stopping:stoppingStart,onConnect:connectionAction,onStop:stopStartup,theme}),
                h("button", {type:"button",style:Object.assign({},S.btn2,{display:"inline-flex",alignItems:"center",gap:6}),
                    onClick:()=>openModelLibrary(),"aria-label":"打开模型库","data-cc-tooltip":"打开模型库"},
                    h(PromptIcon,{name:"folder",size:14})," 模型库"),

				browserFallback ? h("a", { href: browserFallback, target: "_blank", rel: "noopener noreferrer", style: { ...S.btn2, border: "1px solid var(--cc-accent)", background: "var(--cc-accent-bg)", color: "var(--cc-accent-text)", textDecoration: "none" }, title: "浏览器未能自动打开，点击这里打开 ComfyUI 网页", onClick: () => setBrowserFallback("") }, "打开 ComfyUI 网页") : null,
				h("button", { style: S.btn2,
					onClick: () => window.open("http://127.0.0.1:" + (settingsInfo?.comfyPort || COMFY_PORT), "_blank") }, "原界面"),
				h("button", { style: S.btn2, "data-cc-guide":"connection-settings", "aria-haspopup": "dialog", onClick: () => {
                    setShowSettings(true); setSettingsSection("connection"); setGuide(null); setGuideMenu(false); setConnNotice("");
                } }, "设置"),
				h("button", { style: S.btn2, "data-cc-guide":"tutorial-menu", "aria-expanded": guideMenu,
                    "aria-haspopup": "menu", onClick: (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setGuideMenuPos({ top: Math.max(12, Math.min(rect.bottom + 6,
                            (typeof window !== "undefined" ? window.innerHeight : 900) - 170)),
                            right: Math.max(12, (typeof window !== "undefined" ? window.innerWidth : 1200) - rect.right) });
                        setGuideMenu((v) => !v); setShowSettings(false); setGuide(null);
                    } }, "教程 ▾"),
                h("button", {type:"button",className:"cc-icon-button",style:S.btn2,disabled:sidecarRestarting,
                    "aria-label":sidecarRestarting?"正在重启 Sidecar":"刷新页面并重启 Sidecar",
                    "aria-busy":sidecarRestarting,"data-cc-tooltip":sidecarRestarting?"正在重启 Sidecar…":"刷新页面并重启 Sidecar",
                    onClick:refreshSidecarAndPage},
                    h("span",{className:sidecarRestarting?"cc-icon-spinner":""},h(PromptIcon,{name:sidecarRestarting?"spinner":"refresh",size:16}))))),
		// 标签页
		h("div", {"data-cc-guide":"workbench-tabs", role:"tablist", "aria-label":"绘图页面", style: { display: "flex", gap: "2px", borderBottom: "1px solid var(--cc-border)",flexWrap:"wrap" } },
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
            h("small",{style:S.dim},"浏览器模式直接运行原启动文件（会打开终端，可能由脚本自行打开网页）；后台模式隐藏终端、不打开网页。后台模式通过隐藏窗口方式运行，Windows 可能短暂闪一下黑窗，属正常现象。"),
            launchError?h("button",{type:"button",style:S.btn2,onClick:()=>{setShowLaunch(false);setShowSettings(true);}},"连接设置"):null) : null,
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
        renderGenerationControls(),
        renderModelLibrary(),
        previewOutput?h(OutputPreviewPicker,{item:previewOutput,targetKind:previewOutput.previewKind||'base',theme,onClose:()=>setPreviewOutput(null),onSaved:(target,saved)=>{
            refreshModelDockAssets();
            // Do not leave the selected model's cover/preview editor button stale.
            if(target?.kind===modelLibraryKind && target?.name===modelLibraryFocus?.name &&
               Number(target?.root_id)===Number(modelLibraryFocus?.root_id)){
                setModelLibraryDetail(cur=>cur?{...cur,previews:saved.previews||[],preview:saved.previews?.[0]||null}:cur);
            }
            setMsg(target?.kind==='lora'?'已保存为 LoRA 预览图':'已保存为底模预览图');}}):null,
        previewEditor?h(ModelPreviewEditor,{key:JSON.stringify([previewEditor.kind,previewEditor.name,previewEditor.root_id]),model:previewEditor,theme,onClose:()=>setPreviewEditor(null),onChanged:r=>{refreshModelDockAssets();if(previewEditor.request===modelDetailRequestRef.current)setModelLibraryDetail(cur=>cur?{...cur,preview:r.preview,previews:r.previews}:cur);}}):null,
        outputImageEditor?h(ReferenceImageEditor,{key:(outputImageEditor.value.original||outputImageEditor.value.asset).id,value:outputImageEditor.value,target:{w:Number(w),h:Number(hh)},theme,sizeSettings:currentImageSizeSettings(),initialTool:outputImageEditor.initialTool||'brush',singleSave:!!outputImageEditor.singleSave,saveIntent:'inpaint',saveLabel:'保存',onClose:()=>setOutputImageEditor(null),onExit:(intent,result)=>exitImageEditor(intent,result)}):null,
        outputDetail ? (()=>{const nav=outputDetailNavigation();return h(OutputInspector,{item:outputDetail,theme,imageActions:renderOutputViewerActions(outputDetail),onStage:setOutputDetail,onClose:()=>setOutputDetail(null),
            canPrev:!!nav.prev,canNext:!!nav.next,onPrev:()=>nav.prev&&openOutputDetail(nav.prev,outputDetailScope),onNext:()=>nav.next&&openOutputDetail(nav.next,outputDetailScope)},
            renderOutputDetailInfo(outputDetail));})() : null,

        taskDetailLive ? h(OverlayModal,{title:"生成任务 · "+taskStatusLabel(taskDetailLive),theme,width:760,onClose:()=>setTaskDetail(null)},
            h("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},h("span",{style:S.dim},"Prompt ID："+(taskDetailLive.pid||"提交中")),taskDetailLive.queuePosition?h("span",{style:S.dim},"队列位置："+taskDetailLive.queuePosition):null,taskDetailLive.params?.w?h("span",{style:S.dim},taskDetailLive.params.w+"×"+taskDetailLive.params.h+" · "+taskDetailLive.params.steps+" 步 · CFG "+taskDetailLive.params.cfg):null),
            h(RuntimeTaskProgress,{task:taskDetailLive}),
            taskDetailLive.params?.pos!==undefined?h("label",{style:S.field},h("span",{style:S.label},"正向提示词"),h("textarea",{readOnly:true,style:{...S.ta,minHeight:100},value:taskDetailLive.params.pos||""})):null,
            taskDetailLive.params?.neg!==undefined?h("label",{style:S.field},h("span",{style:S.label},"负向提示词"),h("textarea",{readOnly:true,style:{...S.ta,minHeight:75},value:taskDetailLive.params.neg||""})):null,
            taskDetailLive.errorDetail?h("label",{style:S.field},h("span",{style:S.label},"错误详情"),h("textarea",{readOnly:true,style:{...S.ta,minHeight:150,fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace",fontSize:11,lineHeight:1.5},value:taskDetailLive.errorDetail})):null,
            taskDetailLive.params?h("div",{style:S.dim},"底模："+(taskDetailLive.params.ckpt||"?")+" · Seed："+(taskDetailLive.params.usedSeed??"?")+" · "+(taskDetailLive.params.saveOutput?("保存到 "+taskDetailLive.params.savePath):"仅 Temp 预览")):null,
            taskDetailLive.status==='save-error'?h("button",{type:"button",style:S.btn,onClick:async()=>{const ok=await BG.retrySave(taskDetailLive.pid);setTaskDetail(null);setMsg(ok?"图片已重新保存":"重试保存失败；请检查 Temp 文件和保存目录");}},"重试保存（无需重新生成）"):null,
            ['running','queued','submitting'].includes(taskDetailLive.status)?h("div",{style:{display:"flex",justifyContent:"flex-end"}},h("button",{type:"button",style:S.btn2,onClick:async()=>{await BG.cancel(taskDetailLive.pid||taskDetailLive.localId);setTaskDetail(null);}},"取消任务")):null) : null,



        showSettings ? h(OverlayModal, { title: "设置",
            onClose: () => setShowSettings(false), width: 900, theme,
            footer: settingsSection === "theme" ? themeFooter() : connectionFooter() },
            h("div", { style: { display: "flex", gap: 18, height: 620, minHeight: 620, overflow: "hidden" } },
                h("div", { className: "cc-settings-nav", style: { width: 170, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" } },
                    ...[["connection", "连接"], ["theme", "主题"]].map(([key, label]) =>
                        h("button", { key, type: "button", className: "cc-settings-nav-btn", "aria-pressed": settingsSection === key, onClick: () => setSettingsSection(key) }, label))),
                h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 4 } },
                    settingsSection === "theme" ? themePanel() : h(React.Fragment, null, h("span", { style: S.dim }, "请先在本地安装 ComfyUI。设置只影响本机连接，不会下载或安装 ComfyUI。"),
            h("label", { style: Object.assign({}, S.field, { minWidth: 0 }) },
                h("span", { style: S.label }, "ComfyUI 启动文件路径（可留空直接启动）"),
                h("input", { type: "text", "data-cc-guide":"start-script", style: Object.assign({}, S.inp, {
                        width: "100%", maxWidth: "100%", boxSizing: "border-box", minWidth: 0,
                        padding: "8px 10px" }),
                    value: startScript, onChange: (e) => changeStartScript(e.target.value),
                    placeholder: "D:\\ComfyUI\\ComfyUI_Windows_portable\\run_nvidia_gpu.bat" })),
            h("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" } },
                h("label", { style: S.field }, h("span", { style: S.label }, "ComfyUI 端口"),
                    h(DraggableNumberInput,{value:comfyPortInput,onChange:v=> {editConnectionDraft("comfyPort");setComfyPortInput(v);},label:'ComfyUI 端口',step:1,precision:numberInputPrecision(1),dragPerPixel:(1)/10,className:'cc-parameter-number',allowEmpty:true,min:1,max:65535})),
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
                        h(DraggableNumberInput,{value:sidecarPortInput,onChange:v=> setSidecarPortInput(v),label:'sidecar 端口',step:1,precision:numberInputPrecision(1),dragPerPixel:(1)/10,className:'cc-parameter-number',allowEmpty:true,min:1,max:65535})),
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
null)))) : null,



		tab === "gen" ? genTab() : null,
        tab === "output" ? renderOutputPage() : null,
		DEFERRED_UI.dictionary && tab === "lib" ? libTab() : null,
		DEFERRED_UI.presets && tab === "preset" ? presetTab() : null,
        tab === "online" ? h(OnlineModelsPanel,{theme,onMessage:setMsg,onDownloaded:job=>{
            setMsg("模型下载完成："+job.filename);refreshModelDockAssets();
            if(online===true && ['checkpoint','diffusion','lora','clip','vae'].includes(job.kind))refreshModelKind(job.kind);
        }}) : null,

		msg ? h("div", { style: Object.assign({}, S.dim, /失败|连不上|离线|没认出来/.test(msg) ? S.bad : {}) }, msg) : null);
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
	}, Console));
	ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
		name: "settings.plugins.tab", id: "comfyui-console", order: 90, label: "ComfyUI 绘图",
	}, Console));
}

/** Post-generation notebook, typed workflow editor and stage comparison. */
const POST_KINDS={upscale:'超分放大',resample:'二次采样',face:'FaceDetailer 面部细化',workflow:'自定义工作流'};
const POST_INTERFACES=[['image','当前步骤图片','IMAGE'],['original','最初原图','IMAGE'],['model','模型','MODEL'],['clip','CLIP','CLIP'],['vae','VAE','VAE'],['positive','正面条件','CONDITIONING'],['negative','负面条件','CONDITIONING'],['pos','正面提示词','STRING'],['neg','负面提示词','STRING'],['latent','当前图片 Latent','LATENT'],['seed','Seed','INT'],['steps','步数','INT'],['cfg','CFG','FLOAT'],['sampler','采样器','STRING'],['scheduler','调度器','STRING'],['width','当前宽度','INT'],['height','当前高度','INT']];
const postClone=x=>JSON.parse(JSON.stringify(x));
function normalizePost(last={}){
 const postBody=last.postControls?.version===1&&Array.isArray(last.postControls.cells)?last.postControls:(last.version===1&&Array.isArray(last.cells)?last:null);
 if(postBody)return {version:1,autoExecute:postBody.autoExecute!==false,input:postBody.input||null,inpaint:postBody.inpaint||null,...postClone(postBody)};
 return {version:1,autoExecute:true,input:null,inpaint:null,save:'final',cells:last.upscale?[{id:'legacy-upscale',kind:'upscale',enabled:true,model:last.upscaleModel||'',factor:Number(last.upscaleFactor)||4}]:[]};
}
function newPostCell(kind){return {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),kind,enabled:true,...({upscale:{model:'',factor:2},resample:{denoise:.3,parameterSource:'upper',steps:20,cfg:7,sampler:'euler',scheduler:'normal',prompt:'',negative:''},face:{detector:'bbox/face_yolov8m.pt',samModel:'',samDevice:'AUTO',segmDetector:'',sam_threshold:.93,sam_dilation:0,denoise:.4,guide_size:512,max_size:1024,bbox_threshold:.5,feather:5,inherit:true,steps:20,cfg:7,prompt:'',negative:''},workflow:{workflow:{name:'新工作流',nodes:[],output:null}}}[kind]||{})};}
const FACE_RECOMMENDED={bbox:'bbox/face_yolov8m.pt',sam:'sam_vit_b_01ec64.pth',segm:'segm/person_yolov8n-seg.pt'};
function postFaceNames(info,role){const names=comboOptions(info,role==='sam'?'SAMLoader':'UltralyticsDetectorProvider','model_name');return names.filter(n=>typeof n==='string'&&!/^put_/i.test(n.split('/').pop())&&(role==='bbox'?/^(bbox|segm)\//.test(n):role==='segm'?n.startsWith('segm/'):true));}
function postFaceOptions(info,role,current){const names=postFaceNames(info,role),all=[...new Set([...names,FACE_RECOMMENDED[role],...(current?[current]:[])])];return [...(role!=='bbox'?[{value:'',label:'不使用'}]:[]),...all.map(name=>({value:name,label:names.includes(name)?name:(name===FACE_RECOMMENDED[role]?'未加载 · ':'未找到 · ')+name}))];}
function postFaceInstallation(cells){const models={bbox:[],sam:[],segm:[]};for(const c of cells.filter(c=>c.kind==='face'&&c.enabled!==false)){for(const [role,name] of [['bbox',c.detector],['sam',c.samModel],['segm',c.segmDetector]])if(name&&!models[role].includes(name))models[role].push(name);}if(!models.bbox.length)models.bbox.push(FACE_RECOMMENDED.bbox);return models;}
function movePostCell(cells,index,delta){const to=index+delta;if(to<0||to>=cells.length)return cells;const out=[...cells];[out[index],out[to]]=[out[to],out[index]];return out;}
function postDims(o){let w=Number(o.w),h=Number(o.h);for(const c of normalizePost(o).cells.filter(c=>c.enabled!==false))if(c.kind==='upscale'){w=Math.round(w*Number(c.factor));h=Math.round(h*Number(c.factor));}return {w,h};}
function postPortType(spec,field){const d=spec?.input?.required?.[field]||spec?.input?.optional?.[field];return Array.isArray(d?.[0])||d?.[0]==='COMBO'?'STRING':d?.[0];}
function postDefaults(spec){const out={};for(const [key,desc] of Object.entries(spec?.input?.required||{})){if(desc[1]?.default!==undefined)out[key]=desc[1].default;else if(Array.isArray(desc[0]))out[key]=desc[0][0];else if(desc[0]==='COMBO')out[key]=desc[1]?.options?.[0];else if(desc[0]==='INT'||desc[0]==='FLOAT')out[key]=Math.max(desc[1]?.min??0,Math.min(desc[1]?.max??0,0));else if(desc[0]==='BOOLEAN')out[key]=false;else if(desc[0]==='STRING')out[key]='';}return out;}
function postWorkflowErrors(wf,info){
 const errors=[];if(!wf||!Array.isArray(wf.nodes)||wf.nodes.some(n=>!n||typeof n.id!=='string'||!n.id||typeof n.type!=='string'||!n.inputs||typeof n.inputs!=='object'||Array.isArray(n.inputs)))return ['工作流节点格式无效'];const nodes=wf.nodes,map=new Map(nodes.map(n=>[n.id,n]));if(!String(wf?.name||'').trim())errors.push('请命名工作流');if(!nodes.length)errors.push('请添加节点');if(nodes.length>100)errors.push('工作流最多 100 个节点');if(map.size!==nodes.length)errors.push('节点 ID 重复');
 const sourceType=v=>v.interface?POST_INTERFACES.find(x=>x[0]===v.interface)?.[2]:info[map.get(v.node)?.type]?.output?.[v.slot];
 for(const n of nodes){const spec=info[n.type];if(!spec){errors.push('缺少节点 '+n.type);continue;}if(spec.output_node||/^(Save|Preview)/i.test(n.type)){errors.push('保存及预览由插件管理，请选择处理节点');continue;}
  for(const [key,d] of Object.entries(spec.input?.required||{}))if(!(key in n.inputs))errors.push(n.type+' 缺少 '+key);
  for(const [key,v] of Object.entries(n.inputs||{})){const typ=postPortType(spec,key);if(!typ){errors.push(n.type+' 未知输入 '+key);continue;}if(v&&typeof v==='object'){if(!v.interface&&(!map.has(v.node)||!Number.isInteger(v.slot)||v.slot<0))errors.push('连接的节点或输出端口无效');const from=sourceType(v);if(!from||!(typ==='*'||from==='*'||typ===from||typ==='FLOAT'&&from==='INT'))errors.push(n.type+' · '+key+' 连接类型不匹配');}else{const d=spec.input?.required?.[key]||spec.input?.optional?.[key];const options=Array.isArray(d[0])?d[0]:d[0]==='COMBO'?d[1]?.options:null;if(!options&&typ==='STRING'&&typeof v!=='string'||typ==='BOOLEAN'&&typeof v!=='boolean'||!['INT','FLOAT','STRING','BOOLEAN','*'].includes(typ))errors.push(n.type+' · '+key+' 需要有效值或接口连接');if(options&&!options.includes(v))errors.push(n.type+' · '+key+' 选项无效');if(['INT','FLOAT'].includes(typ)&&(v===''||v===null||!Number.isFinite(Number(v))||typ==='INT'&&!Number.isInteger(Number(v))||d[1]?.min!==undefined&&Number(v)<d[1].min||d[1]?.max!==undefined&&Number(v)>d[1].max))errors.push(n.type+' · '+key+' 数值无效');}}
 }
 const seen=new Set(),visiting=new Set();function walk(id){if(visiting.has(id)){errors.push('工作流不能循环连接');return;}if(seen.has(id))return;visiting.add(id);for(const v of Object.values(map.get(id)?.inputs||{}))if(v&&typeof v==='object'&&v.node)walk(v.node);visiting.delete(id);seen.add(id);}nodes.forEach(n=>walk(n.id));
 if(!wf?.output||!Number.isInteger(wf.output.slot)||wf.output.slot<0||!map.has(wf.output.node)||info[map.get(wf.output.node)?.type]?.output?.[wf.output.slot]!=='IMAGE')errors.push('请指定 IMAGE 处理结果');return [...new Set(errors)];
}
function postContext(g,o){
 const sampler=g['7'],guider=g[sampler?.inputs?.guider?.[0]],input=sampler?.inputs||{},guide=guider?.inputs||{};
 const model=input.model||guide.model,positive=input.positive||guide.positive||guide.conditioning,negative=input.negative||guide.negative;
 return {model,positive,negative,clip:g['4']?.inputs?.clip,vae:g['8']?.inputs?.vae};
}
function appendPostGraph(g,o,info={}){
 const condText=link=>{const n=link&&g[link[0]];return n&&n.class_type==='CLIPTextEncode'&&typeof n.inputs?.text==='string'?n.inputs.text:null;};
 const post=normalizePost(o),cells=post.cells.filter(c=>c.enabled!==false);g['1']._meta={...g['1']._meta,dsh_post_controls:postClone(post),dsh_generation_inputs:Object.fromEntries(['ckpt','clip','clipType','vae','modelConfig','loras','scene3d','referenceImage','inpaint','pos','neg','w','h','baseW','baseH','sizeMultiplier','steps','cfg','sampler','scheduler','seed','prefix'].filter(k=>o[k]!==undefined&&(k!=='neg'||modelProfile(o.modelConfig).negative)).map(k=>[k,postClone(o[k])]))};if(cells.length>24)throw Error('生成后控制最多 24 项');
 if(o.postInput)g['999']={class_type:'LoadImage',inputs:{image:o.postInput}};
 let next=1000,current=o.postInput?['999',0]:generationOutputLink(g),width=Number(o.w),height=Number(o.h),dynamicSize=false;const stages=[],ctx=postContext(g,o);
 const add=(type,inputs)=>{const id=String(next++);g[id]={class_type:type,inputs};return [id,0];};
 const snap=(label,index,source,w,h,cell)=>{const checkpoint=!!info.DSHPostStage;const maskSlot=info.FaceDetailer?.output?.indexOf('MASK');const stageInputs={images:source};if(checkpoint&&g[source[0]]?.class_type==='FaceDetailer'&&maskSlot>=0)stageInputs.mask=[source[0],maskSlot];const ref=add(checkpoint?'DSHPostStage':'PreviewImage',stageInputs);if(checkpoint)current=ref;const meta={version:1,index,label,width:w,height:h,cell:cell||null,save:post.save};g[ref[0]]._meta={dsh_post_stage:meta};stages.push({node:ref[0],...meta});};
 // Stage previews also preserve completed steps if a later node fails. They remain Temp unless retained.
 if(cells.length)snap('原图',0,current,width,height);
 for(const [i,c] of cells.entries()){
  if(c.kind==='upscale'){
   if(!c.model)throw Error('请选择超分放大模型');const f=Number(c.factor);if(!Number.isFinite(f)||f<.1||f>8)throw Error('放大倍率需为 0.10–8.00');width=Math.round(width*f);height=Math.round(height*f);if(!dynamicSize&&(width>16384||height>16384))throw Error('处理结果尺寸不能超过 16384');
   const m=add('UpscaleModelLoader',{model_name:c.model});const big=add('ImageUpscaleWithModel',{upscale_model:m,image:current});if(info.DSHPostScale)current=add('DSHPostScale',{image:big,reference:current,factor:f});else{if(dynamicSize)throw Error('自定义工作流后按倍率放大需要 DSH 图片桥接节点，请在生成后控制中安装组件并重启 ComfyUI');current=add('ImageScale',{image:big,upscale_method:'lanczos',width,height,crop:'disabled'});}
  }else if(c.kind==='resample'){
   const denoise=Number(c.denoise);if(c.denoise===''||c.denoise===null||!Number.isFinite(denoise)||denoise<0||denoise>1)throw Error('降噪强度需为 0–1');
   if(!denoise){snap('二次采样（降噪 0，保留输入）',i+1,current,width,height,c);continue;}
   const cellSrc=c.parameterSource||(c.inherit===false?'custom':'upper'),cs=c.customModelSetup||{},origParams=cellSrc==='original'?(o.input?.sourceOutput?.params||o.postControls?.input?.sourceOutput?.params||null):null,steps=cellSrc==='custom'?Number(cs.steps??c.steps):cellSrc==='original'&&origParams&&origParams.steps!==undefined?Number(origParams.steps):o.steps,cfg=cellSrc==='custom'?Number(cs.cfg??c.cfg):cellSrc==='original'&&origParams&&origParams.cfg!==undefined?Number(origParams.cfg):o.cfg,sampler=cellSrc==='custom'?(cs.sampler||c.sampler):cellSrc==='original'&&origParams&&origParams.sampler?origParams.sampler:o.sampler,scheduler=cellSrc==='custom'?(cs.scheduler||c.scheduler):cellSrc==='original'&&origParams&&origParams.scheduler?origParams.scheduler:o.scheduler;
   let m=ctx.model,v=ctx.vae,cl=ctx.clip,pos=ctx.positive,neg=ctx.negative;
   const wantCkpt=cellSrc==='custom'?(cs.ckpt||''):cellSrc==='original'?((origParams&&origParams.ckpt)||''):'',wantVae=cellSrc==='custom'?(cs.vae||''):cellSrc==='original'?((origParams&&origParams.vae)||''):'',cellLoras=cellSrc==='custom'?(cs.loras||[]):cellSrc==='original'?((origParams&&origParams.loras)||[]):[];
   if(wantCkpt){const ck=add('CheckpointLoaderSimple',{ckpt_name:wantCkpt});m=[ck[0],0];v=[ck[0],2];cl=[ck[0],1];const tp=condText(ctx.positive),tn=condText(ctx.negative);if(tp!==null)pos=add('CLIPTextEncode',{clip:cl,text:tp});if(tn!==null)neg=add('CLIPTextEncode',{clip:cl,text:tn});}
   const cellPos=String(c.prompt||'').trim(),cellNeg=String(c.negative||'').trim();
   if(cellPos||cellNeg){const tp=cellPos||condText(ctx.positive),tn=cellNeg||condText(ctx.negative);if(tp!==null)pos=add('CLIPTextEncode',{clip:cl,text:tp});if(tn!==null)neg=add('CLIPTextEncode',{clip:cl,text:tn});}
   if(wantVae){const vl=add('VAELoader',{vae_name:wantVae});v=[vl[0],0];}
   for(const l of (Array.isArray(cellLoras)?cellLoras:[]).filter(it=>it&&it.enabled!==false&&it.name)){const r=add('LoraLoader',{model:m,clip:cl,lora_name:l.name,strength_model:Number(l.model??1),strength_clip:Number(l.clip??l.model??1)});m=[r[0],0];cl=[r[0],1];}
   const latent=add('VAEEncode',{pixels:current,vae:v});
   if(g['7'].class_type==='SamplerCustomAdvanced'){
    const p=modelProfile(normalizeModelConfig(o.modelConfig));let sigmas;
    if(p.advanced==='ManualSigmas')throw Error('当前模型使用固定 Sigma，二次采样请通过自定义工作流设置 Sigma');
    if(p.advanced==='Flux2Scheduler'){let currentSize;if(dynamicSize){if(!info.DSHPostImageSize)throw Error('动态调度尺寸需要安装 DSH 图片桥接节点');currentSize=add('DSHPostImageSize',{image:current});}sigmas=add('Flux2Scheduler',{steps,width:currentSize||width,height:currentSize?[currentSize[0],1]:height});}
    else if(p.advanced==='SDTurboScheduler')sigmas=add('SDTurboScheduler',{model:ctx.model,steps,denoise});
    else sigmas=add('BasicScheduler',{model:ctx.model,scheduler,steps,denoise});
    if(p.advanced==='Flux2Scheduler'&&denoise!==1)throw Error('当前 Flux2 调度器的二次采样只支持降噪 1；其他强度请使用自定义工作流');
    const noise=add('RandomNoise',{noise_seed:o.seed}),select=add('KSamplerSelect',{sampler_name:sampler});const inheritedGuider=g['7'].inputs.guider,guiderNode=g[inheritedGuider[0]];const guider=guiderNode?.class_type==='CFGGuider'?add('CFGGuider',{...guiderNode.inputs,cfg:modelProfile(o.modelConfig).negative?cfg:1}):inheritedGuider;const sampled=add('SamplerCustomAdvanced',{noise,guider,sampler:select,sigmas,latent_image:latent});current=add('VAEDecode',{samples:sampled,vae:ctx.vae});
   }else{const sampled=add('KSampler',{model:m,positive:pos,negative:neg,latent_image:latent,seed:o.seed,steps,cfg:modelProfile(o.modelConfig).negative?cfg:1,sampler_name:sampler,scheduler,denoise});current=add('VAEDecode',{samples:sampled,vae:v});}
  }else if(c.kind==='face'){
   if(!info.FaceDetailer||!info.UltralyticsDetectorProvider)throw Error('缺少 FaceDetailer / UltralyticsDetectorProvider，请在生成后控制中安装并重启 ComfyUI');
   if(!ctx.negative&&ctx.positive)ctx.negative=add('ConditioningZeroOut',{conditioning:ctx.positive});
   const detector=add('UltralyticsDetectorProvider',{model_name:c.detector});
   const cellSrc=c.parameterSource||(c.inherit===false?'custom':'upper'),cs=c.customModelSetup||{},origParams=cellSrc==='original'?(o.input?.sourceOutput?.params||o.postControls?.input?.sourceOutput?.params||null):null,steps=cellSrc==='custom'?Number(cs.steps??c.steps):cellSrc==='original'&&origParams&&origParams.steps!==undefined?Number(origParams.steps):o.steps,cfg=cellSrc==='custom'?Number(cs.cfg??c.cfg):cellSrc==='original'&&origParams&&origParams.cfg!==undefined?Number(origParams.cfg):o.cfg,sampler=cellSrc==='custom'?(cs.sampler||c.sampler):cellSrc==='original'&&origParams&&origParams.sampler?origParams.sampler:o.sampler,scheduler=cellSrc==='custom'?(cs.scheduler||c.scheduler):cellSrc==='original'&&origParams&&origParams.scheduler?origParams.scheduler:o.scheduler;
   let fm=ctx.model,fv=ctx.vae,fcl=ctx.clip,fpos=ctx.positive,fneg=ctx.negative;
   const wantCkpt=cellSrc==='custom'?(cs.ckpt||''):cellSrc==='original'?((origParams&&origParams.ckpt)||''):'',wantVae=cellSrc==='custom'?(cs.vae||''):cellSrc==='original'?((origParams&&origParams.vae)||''):'',cellLoras=cellSrc==='custom'?(cs.loras||[]):cellSrc==='original'?((origParams&&origParams.loras)||[]):[];
   if(wantCkpt){const ck=add('CheckpointLoaderSimple',{ckpt_name:wantCkpt});fm=[ck[0],0];fv=[ck[0],2];fcl=[ck[0],1];const tp=condText(ctx.positive),tn=condText(ctx.negative);if(tp!==null)fpos=add('CLIPTextEncode',{clip:fcl,text:tp});if(tn!==null)fneg=add('CLIPTextEncode',{clip:fcl,text:tn});}
   const cellPos=String(c.prompt||'').trim(),cellNeg=String(c.negative||'').trim();
   if(cellPos||cellNeg){const tp=cellPos||condText(ctx.positive),tn=cellNeg||condText(ctx.negative);if(tp!==null)fpos=add('CLIPTextEncode',{clip:fcl,text:tp});if(tn!==null)fneg=add('CLIPTextEncode',{clip:fcl,text:tn});}
   if(wantVae){const vl=add('VAELoader',{vae_name:wantVae});fv=[vl[0],0];}
   for(const l of (Array.isArray(cellLoras)?cellLoras:[]).filter(it=>it&&it.enabled!==false&&it.name)){const r=add('LoraLoader',{model:fm,clip:fcl,lora_name:l.name,strength_model:Number(l.model??1),strength_clip:Number(l.clip??l.model??1)});fm=[r[0],0];fcl=[r[0],1];}
   if(!fneg&&fpos)fneg=add('ConditioningZeroOut',{conditioning:fpos});if(!fcl||!fneg)throw Error('当前模型无法直接提供 FaceDetailer 所需的 CLIP / 条件，请使用自定义工作流适配');
   const inputs={...postDefaults(info.FaceDetailer),image:current,...ctx,model:fm,positive:fpos,negative:fneg,clip:fcl,vae:fv,bbox_detector:detector,seed:o.seed,steps,cfg:modelProfile(o.modelConfig).negative?cfg:1,sampler_name:sampler,scheduler,denoise:Number(c.denoise),guide_size:Number(c.guide_size),max_size:Number(c.max_size),bbox_threshold:Number(c.bbox_threshold),feather:Number(c.feather)};
   if(!c.detector||!/^(bbox|segm)\//.test(c.detector))throw Error('请选择有效 BBOX 检测模型');
   if(info.UltralyticsDetectorProvider?.input?.required?.model_name&&!postFaceNames(info,'bbox').includes(c.detector))throw Error('BBOX 检测模型未加载：'+c.detector+'；请安装并重启 ComfyUI');
   if(c.samModel){
    if(!info.SAMLoader||!info.FaceDetailer.input?.optional?.sam_model_opt)throw Error('缺少 Impact Pack SAMLoader / SAM 接口，请更新节点并重启 ComfyUI');
    if(!postFaceNames(info,'sam').includes(c.samModel))throw Error('SAM 模型未加载：'+c.samModel+'；请安装并重启 ComfyUI');
    const devices=comboOptions(info,'SAMLoader','device_mode'),device=c.samDevice||'AUTO';if(!devices.includes(device))throw Error('SAM 设备模式不受支持：'+device);
    for(const [key,min,max] of [['sam_threshold',0,1],['sam_dilation',-512,512]])if(c[key]!==undefined){const value=Number(c[key]);if(c[key]===''||c[key]===null||!Number.isFinite(value)||value<min||value>max||key==='sam_dilation'&&!Number.isInteger(value))throw Error('SAM 参数无效：'+key);inputs[key]=value;}
    const sam=add('SAMLoader',{...postDefaults(info.SAMLoader),model_name:c.samModel,device_mode:device});inputs.sam_model_opt=sam;
   }else if(c.segmDetector){
    if(!c.segmDetector.startsWith('segm/')||!postFaceNames(info,'segm').includes(c.segmDetector))throw Error('SEGM 分割模型未加载：'+c.segmDetector+'；请安装并重启 ComfyUI');
    if(!info.FaceDetailer.input?.optional?.segm_detector_opt)throw Error('当前 FaceDetailer 不支持 SEGM 接口，请更新节点');
    const slot=info.UltralyticsDetectorProvider.output?.indexOf('SEGM_DETECTOR');if(!(slot>=0))throw Error('检测器未提供 SEGM 分割输出，请更新 Impact Subpack');
    const segm=c.segmDetector===c.detector?detector:add('UltralyticsDetectorProvider',{model_name:c.segmDetector});inputs.segm_detector_opt=[segm[0],slot];
   }
   current=add('FaceDetailer',inputs);
  }else if(c.kind==='workflow'){
   if(!ctx.negative&&ctx.positive)ctx.negative=add('ConditioningZeroOut',{conditioning:ctx.positive});
   const wf=c.workflow,errors=postWorkflowErrors(wf,info);if(errors.length)throw Error(errors.join('；'));
   const map=new Map(wf.nodes.map(n=>[n.id,String(next++)]));let encoded;let sizeRef;if(dynamicSize&&wf.nodes.some(n=>Object.values(n.inputs).some(v=>v?.interface==='width'||v?.interface==='height'))){if(!info.DSHPostImageSize)throw Error('动态图片尺寸接口需要 DSH 图片桥接节点，请安装后重启');sizeRef=add('DSHPostImageSize',{image:current});}
    const bindings={image:current,original:o.postInput?['999',0]:['8',0],...ctx,pos:o.pos,neg:modelProfile(o.modelConfig).negative?o.neg:'',seed:o.seed,steps:o.steps,cfg:modelProfile(o.modelConfig).negative?o.cfg:1,sampler:o.sampler,scheduler:o.scheduler,width:sizeRef||width,height:sizeRef?[sizeRef[0],1]:height};
   for(const n of wf.nodes){const inputs={};for(const [k,v] of Object.entries(n.inputs||{})){if(v&&typeof v==='object'){if(v.interface==='latent'){encoded=encoded||add('VAEEncode',{pixels:current,vae:ctx.vae});inputs[k]=encoded;}else if(v.interface){if(bindings[v.interface]===undefined)throw Error('当前模型没有接口 '+v.interface);inputs[k]=bindings[v.interface];}else inputs[k]=[map.get(v.node),v.slot];}else inputs[k]=v;}g[map.get(n.id)]={class_type:n.type,inputs};}
   current=[map.get(wf.output.node),wf.output.slot];dynamicSize=true;
  }else throw Error('未知生成后控制');
  snap(c.kind==='workflow'?c.workflow.name:POST_KINDS[c.kind],i+1,current,width,height,c);
 }
 g['9']={class_type:'PreviewImage',inputs:{images:current},_meta:{dsh_post_stage:{version:1,index:cells.length,label:'最终输出',final:true,save:post.save,width,height}}};
 if(stages.length)stages[stages.length-1].final=true;
 return {stages:stages.length?stages:[{node:'9',index:0,label:'原图',final:true,width,height}],finalNode:'9',width,height};
}
function stageOutput(item,s){return {...item,...s,url:s.path?savedOutputUrl(s.path):s.url||viewUrl(s.imageInfo),params:s.params||item.params,stages:item.stages,activeStage:s.index};}
function usePostWorkflowWindow(setControls,theme,onError,onLibrarySaved){
 const sessions=React.useRef(new Map()),settings=React.useRef({theme,onError,onLibrarySaved});settings.current={theme,onError,onLibrarySaved};
 function accept(id,s,r){
  if(!r.result||!Number.isInteger(r.revision)||r.revision<=s.revision)return;
  if(!Array.isArray(r.result.nodes))throw Error('编辑器返回的工作流格式无效');
  s.revision=r.revision;const expected=s.baseline,next=postClone(r.result);s.baseline=JSON.stringify(next);
  if(!s.library)setControls(current=>({...current,cells:current.cells.map(c=>c.id===id&&c.kind==='workflow'&&JSON.stringify(c.workflow)===expected?{...c,workflow:next}:c)}));
  settings.current.onLibrarySaved?.();
 }
 React.useEffect(()=>{
  let stopped=false,querying=false;const ctl=new AbortController();
  const poll=async()=>{
   if(querying)return;querying=true;
   try{for(const [id,s] of sessions.current){
    if(s.opening)continue;
    try{
     const r=await jget(EXPANDER+'/workflow/session/'+s.channel,5000,ctl.signal);if(stopped)return;
     s.failures=0;accept(id,s,r);
     if(r.error)settings.current.onError(r.error);
     if(!r.running)sessions.current.delete(id);
    }catch(e){if(stopped)return;s.failures=(s.failures||0)+1;
     // One failed fetch must not discard a still-open native editor or its next save.
     if(s.failures===3)settings.current.onError('自定义工作流同步暂时失败，将继续重试：'+errText(e));
     if(/HTTP 400|HTTP 404/.test(errText(e))){sessions.current.delete(id);settings.current.onError('工作流编辑会话已失效，请重新打开编辑器；已保存的工作流仍保留在列表中');}
    }
   }}finally{querying=false;}
  };
  const timer=setInterval(poll,1000);return()=>{stopped=true;ctl.abort();clearInterval(timer);};
 },[]);
 const edit=async(cell,reportError,library=false)=>{
  let s=sessions.current.get(cell.id);if(s?.opening)return;
  if(!s){s={channel:editorChannel(),revision:0,baseline:JSON.stringify(cell.workflow),library};sessions.current.set(cell.id,s);}
  s.opening=true;
  try{
   await requireComfyOnline('编辑自定义工作流');
   await requireSidecarFeature('workflowWindowsVersion',1,'自定义工作流原生窗口');
   let workflow=library?JSON.parse(s.baseline):cell.workflow;
   if(s.started){
    const r=await jget(EXPANDER+'/workflow/session/'+s.channel,5000);
    if(!r.running){
     if(library)workflow=cell.workflow;
     else if(r.result&&JSON.stringify(workflow)===s.baseline)workflow=r.result;
     accept(cell.id,s,r);
     s={channel:editorChannel(),revision:0,baseline:JSON.stringify(workflow),opening:true,library};sessions.current.set(cell.id,s);
    }else if(!library&&JSON.stringify(workflow)!==s.baseline)throw Error('此单元已换用其他工作流，请先关闭原编辑窗口再重新打开');
   }
   const opened=await jpost(EXPANDER+'/workflow/window',{channel:s.channel,instance:INSTALLED_INSTANCE_ID,workflow,theme:settings.current.theme||{}},20000);
   s.started=true;
   if(opened?.ready===false){
    const until=Date.now()+45000;
    while(true){
     const row=await jget(EXPANDER+'/workflow/session/'+s.channel,5000);
     if(row.error)throw Error(row.error);
     if(!row.running)throw Error('工作流窗口未能打开，请重试');
     if(row.ready===true||row.ready===undefined)break;
     if(Date.now()>until)throw Error('工作流编辑器加载较慢，请查看独立窗口中的提示后重试');
     await new Promise(resolve=>setTimeout(resolve,250));
    }
   }
  }catch(e){if(!s.started||/HTTP 400|HTTP 404/.test(errText(e)))sessions.current.delete(cell.id);(reportError||settings.current.onError)('无法打开独立工作流窗口：'+errText(e));}
  finally{s.opening=false;}
 };
 edit.create=reportError=>edit({id:'library:create',workflow:{name:'',nodes:[],output:null}},reportError,true);
 return edit;
}


function WorkflowEditor({workflow,info,theme,onSave,onClose,native=false,session}){
 const [draft,setDraft]=React.useState(()=>postClone(workflow)),[query,setQuery]=React.useState(''),[source,setSource]=React.useState(null),[error,setError]=useErrorState(''),[busy,setBusy]=React.useState(false);
 const start=React.useRef(JSON.stringify(workflow)),saveLock=React.useRef(false),drag=React.useRef(null),pan=React.useRef(null),area=React.useRef(null),ports=React.useRef(new Map());
 const [wfConfirm,setWfConfirm]=React.useState(null);
 const wfShowConfirm=(opts)=>new Promise(resolve=>setWfConfirm({...opts,resolve}));
 const [anchors,setAnchors]=React.useState({}),[layout,setLayout]=React.useState(0),[zoom,setZoom]=React.useState(1),[viewOffset,setViewOffset]=React.useState({left:0,top:0}),[popup,setPopup]=React.useState(null),view=React.useRef({zoom:1,busy:false});
 view.current.zoom=zoom;view.current.busy=busy;view.current.left=viewOffset.left;view.current.top=viewOffset.top;
 const closePopup=restore=>{setPopup(null);if(restore)area.current?.focus({preventScroll:true});};
 const pointAt=(x,y)=>{const el=area.current;if(!el)return {x:100,y:35};const rect=el.getBoundingClientRect();return workflowCanvasPoint({x,y},{left:rect.left+el.clientLeft,top:rect.top+el.clientTop},{left:view.current.left,top:view.current.top},view.current.zoom);};
 const centerPoint=()=>{const el=area.current;if(!el)return {x:100,y:35};const rect=el.getBoundingClientRect();return pointAt(rect.left+el.clientWidth/2,rect.top+el.clientHeight/2);};
 function zoomAt(next,client){
  if(view.current.busy||!area.current)return;
  const el=area.current,rect=el.getBoundingClientRect(),point=client?{x:client.x-rect.left-el.clientLeft,y:client.y-rect.top-el.clientTop}:{x:el.clientWidth/2,y:el.clientHeight/2};
  const offset={left:view.current.left,top:view.current.top};
  const nextView=workflowCanvasZoomAt({zoom:view.current.zoom,...offset},next,point);
  Object.assign(view.current,nextView);setViewOffset({left:nextView.left,top:nextView.top});setZoom(nextView.zoom);setLayout(v=>v+1);setPopup(null);
 }
 React.useEffect(()=>{
  const el=area.current;if(!el)return;
  const wheel=e=>{if(view.current.busy||e.target.closest('input,textarea,select,[role=listbox],.cc-option-list'))return;e.preventDefault();zoomAt(view.current.zoom*Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.002),{x:e.clientX,y:e.clientY});};
  const resize=()=>setLayout(v=>v+1);el.addEventListener('wheel',wheel,{passive:false});
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener('resize',resize);
  return()=>{el.removeEventListener('wheel',wheel);observer?.disconnect();window.removeEventListener('resize',resize);drag.current=null;pan.current=null;};
 },[]);
 React.useEffect(()=>{const box=area.current?.querySelector('.cc-flow-canvas')?.getBoundingClientRect();if(!box)return;const next={};for(const [key,el] of ports.current){if(!el?.isConnected)continue;const b=el.getBoundingClientRect();next[key]={x:(b.left+b.width/2-box.left)/zoom,y:(b.top+b.height/2-box.top)/zoom};}setAnchors(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);},[draft,layout,zoom]);
 React.useEffect(()=>{const dirty=JSON.stringify(draft)!==start.current;const api=window.pywebview?.api;if(api)api.set_dirty(dirty);const ready=()=>window.pywebview?.api.set_dirty(dirty);window.addEventListener('pywebviewready',ready);return()=>window.removeEventListener('pywebviewready',ready);},[draft]);
 React.useEffect(()=>{if(busy){setPopup(null);drag.current=null;pan.current=null;}},[busy]);
 const update=(id,patch)=>{if(!busy)setDraft(d=>({...d,nodes:d.nodes.map(n=>n.id===id?{...n,...patch}:n)}));};
 const changeInput=(node,key,value)=>update(node.id,{inputs:{...node.inputs,[key]:value}});
 const close=async()=>{if(busy)return;if(native){onClose();return;}if(JSON.stringify(draft)!==start.current&&!await wfShowConfirm({title:'关闭工作流',message:'工作流尚未保存，放弃修改？'}))return;onClose();};
 const types=React.useMemo(()=>workflowCanvasTypes(info,query),[info,query]);
 const add=(type,point)=>{
  if(busy||!info[type])return;if(draft.nodes.length>=100){setError('工作流最多 100 个节点');return;}
  const id='n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),inputs=postDefaults(info[type]);
  for(const [key,d] of Object.entries(info[type].input?.required||{}))if(d[0]==='IMAGE')inputs[key]={interface:'image'};
  const at=point||centerPoint();setDraft(d=>({...d,nodes:[...d.nodes,{id,type,inputs,x:at.x,y:at.y}],output:d.output||((info[type].output||[]).includes('IMAGE')?{node:id,slot:info[type].output.indexOf('IMAGE')}:null)}));
 };
 const arrange=()=>{if(busy)return;setDraft(d=>({...d,nodes:d.nodes.map((n,i)=>({...n,x:100+(i%3)*330,y:35+Math.floor(i/3)*650}))}));setViewOffset({left:0,top:0});setZoom(1);setLayout(v=>v+1);};
 const fit=()=>{
  const el=area.current;if(!el||busy)return;const heights={};el.querySelectorAll('.cc-flow-node').forEach(n=>heights[n.dataset.nodeId]=n.getBoundingClientRect().height/view.current.zoom);
  const bounds=workflowCanvasBounds(draft.nodes,info,heights),scale=workflowCanvasZoom(Math.min((el.clientWidth-48)/Math.max(1,bounds.width),(el.clientHeight-48)/Math.max(1,bounds.height)));
  setViewOffset({left:(bounds.x+bounds.width/2)*scale-el.clientWidth/2,top:(bounds.y+bounds.height/2)*scale-el.clientHeight/2});view.current.zoom=scale;setZoom(scale);setLayout(v=>v+1);setPopup(null);
 };
 const remove=id=>{if(busy)return;setDraft(d=>workflowCanvasDisconnect(d,id,info,true));if(source?.node===id)setSource(null);};
 const duplicate=id=>{if(busy)return;if(draft.nodes.length>=100){setError('工作流最多 100 个节点');return;}const node=draft.nodes.find(n=>n.id===id);if(!node)return;const copy={...postClone(node),id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),x:node.x+40,y:node.y+40};setDraft(d=>({...d,nodes:[...d.nodes,copy]}));};
 const showPopup=(kind,e,nodeId)=>{
  if(busy)return;e.preventDefault();const rect=area.current.getBoundingClientRect(),x=e.clientX||rect.left+area.current.clientWidth/2,y=e.clientY||rect.top+area.current.clientHeight/2;
  setPopup({kind,x,y,world:pointAt(x,y),nodeId});
 };
 function connectionOptions(type,target){return [{value:'',label:'未连接'},...POST_INTERFACES.filter(x=>type===x[2]||type==='*'||type==='FLOAT'&&x[2]==='INT').map(x=>({value:'@'+x[0],label:'插件 · '+x[1]})),...draft.nodes.filter(n=>n.id!==target).flatMap(n=>(info[n.type]?.output||[]).map((t,i)=>({n,t,i})).filter(x=>x.t===type||type==='*'||x.t==='*'||type==='FLOAT'&&x.t==='INT').map(x=>({value:n.id+':'+x.i,label:(info[n.type]?.display_name||n.type)+' · '+(info[n.type]?.output_name?.[x.i]||x.t)+' ['+n.id.slice(-4)+']'})))];}
 function connect(n,key,link=source){if(!link){setError('请先选择插件接口或节点输出，再点击输入端口连接');return;}const source=link;const reaches=(id,target,seen=new Set())=>{if(id===target)return true;if(seen.has(id))return false;seen.add(id);return Object.values(draft.nodes.find(x=>x.id===id)?.inputs||{}).some(v=>v?.node&&reaches(v.node,target,seen));};if(source.node&&reaches(source.node,n.id)){setError('工作流不能循环连接');return;}const target=postPortType(info[n.type],key),from=source.interface?POST_INTERFACES.find(x=>x[0]===source.interface)?.[2]:info[draft.nodes.find(x=>x.id===source.node)?.type]?.output?.[source.slot];if(from!==target&&from!=='*'&&target!=='*'&&!(target==='FLOAT'&&from==='INT')){setError('接口类型不匹配：'+from+' → '+target);return;}changeInput(n,key,source);setSource(null);setError('');}
 const lines=draft.nodes.flatMap(n=>Object.entries(n.inputs).filter(([key,value])=>value?.node||value?.interface).map(([key,value])=>{
  const to=anchors[n.id+':in:'+key];if(!to)return null;const from=value.interface?{x:14,y:to.y}:anchors[value.node+':out:'+value.slot];if(!from)return null;
  return h('g',{key:n.id+key},h('path',{d:`M ${from.x} ${from.y} C ${from.x+65} ${from.y},${to.x-65} ${to.y},${to.x} ${to.y}`,fill:'none',stroke:'var(--cc-accent)',strokeWidth:2}),value.interface?h('text',{x:from.x+4,y:from.y-7,fill:'var(--cc-text)',fontSize:10},POST_INTERFACES.find(x=>x[0]===value.interface)?.[1]||value.interface):null);
 }));
 const field=(n,key,d)=>{const val=n.inputs[key],type=postPortType(info[n.type],key),linked=val&&typeof val==='object',opts=connectionOptions(type,n.id),selected=linked?(val.interface?'@'+val.interface:val.node+':'+val.slot):'';const choose=value=>{if(!value){const next={...n.inputs};delete next[key];const defaults=postDefaults(info[n.type]);if(key in defaults)next[key]=defaults[key];update(n.id,{inputs:next});return;}connect(n,key,value.startsWith('@')?{interface:value.slice(1)}:{node:value.slice(0,value.lastIndexOf(':')),slot:Number(value.slice(value.lastIndexOf(':')+1))});};const values=Array.isArray(d[0])?d[0]:d[0]==='COMBO'?d[1]?.options:null;
 return h('div',{key,className:'cc-flow-input'},h('button',{type:'button',className:'cc-port',ref:el=>ports.current.set(n.id+':in:'+key,el),'aria-label':'连接 '+n.id+' '+key,onClick:()=>connect(n,key)},'●'),h('label',null,key+' · '+type,h(SelectMenu,{theme,label:n.id+' '+key+' 接口',value:selected,onChange:choose,options:opts,minWidth:0,forceSearch:true})),!linked?(values?h('div',{style:{gridColumn:2}},h(SelectMenu,{theme,label:n.id+' '+key,value:val??'',onChange:v=>changeInput(n,key,v),options:values.map(v=>({value:v,label:String(v)})),minWidth:0,forceSearch:true})):['INT','FLOAT','STRING','BOOLEAN'].includes(type)?type==='BOOLEAN'?h('input',{type:'checkbox','aria-label':n.id+' '+key,checked:!!val,onChange:e=>changeInput(n,key,e.target.checked)}):['INT','FLOAT'].includes(type)?h(DraggableNumberInput,{value:val??'',label:n.id+' '+key,step:type==='INT'?1:d[1]?.step||.01,precision:type==='INT'?0:numberInputPrecision(d[1]?.step||.01),min:d[1]?.min??Number.MIN_SAFE_INTEGER,max:d[1]?.max??Number.MAX_SAFE_INTEGER,allowEmpty:true,className:'cc-parameter-number',onChange:v=>changeInput(n,key,v)}):h('input',{type:'text',value:val??'','aria-label':n.id+' '+key,onChange:e=>changeInput(n,key,e.target.value)}):null):null);
 };
 async function save(closeAfter=false){if(saveLock.current)return;const errs=postWorkflowErrors(draft,info);if(errs.length){setError(errs.join('；'));return;}saveLock.current=true;setBusy(true);setError('');try{const r=await jpost(native?'/workflow/session/'+session:EXPANDER+'/post/workflows',{workflow:draft},20000);start.current=JSON.stringify(r.workflow);setDraft(r.workflow);await window.pywebview?.api.set_dirty(false);onSave(r.workflow);if(closeAfter)onClose();}catch(e){setError(errText(e));}finally{saveLock.current=false;setBusy(false);}}
 const nodeViews=draft.nodes.map(n=>h('section',{key:n.id,className:'cc-flow-node','data-node-id':n.id,style:{left:n.x,top:n.y}},
  h('header',{
   onPointerDown:e=>{if(busy||e.button!==0||e.target.closest('button'))return;e.preventDefault();setPopup(null);drag.current={id:n.id,pointer:e.pointerId,x:e.clientX,y:e.clientY,px:n.x,py:n.y};e.currentTarget.setPointerCapture(e.pointerId);},
   onPointerMove:e=>{const d=drag.current;if(d?.id===n.id&&d.pointer===e.pointerId)update(n.id,{x:d.px+(e.clientX-d.x)/view.current.zoom,y:d.py+(e.clientY-d.y)/view.current.zoom});},
   onPointerUp:e=>{if(drag.current?.pointer===e.pointerId){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}},
   onPointerCancel:()=>{drag.current=null;},onLostPointerCapture:()=>{drag.current=null;}
  },info[n.type]?.display_name||n.type,h('button',{type:'button','aria-label':'删除工作流节点 '+n.id,onClick:()=>remove(n.id)},'×')),
  h('div',{className:'cc-flow-outputs'},(info[n.type]?.output||[]).map((type,i)=>h('div',{key:i,className:'cc-flow-output-row'},
   h('button',{type:'button',ref:el=>ports.current.set(n.id+':out:'+i,el),'aria-pressed':source?.node===n.id&&source?.slot===i,'aria-label':n.id+' 输出 '+i,onClick:()=>setSource({node:n.id,slot:i})},(info[n.type]?.output_name?.[i]||type)+' ●'),
   type==='IMAGE'?h('button',{type:'button','aria-label':'设为处理结果 '+n.id+' '+i,'aria-pressed':draft.output?.node===n.id&&draft.output?.slot===i,onClick:()=>setDraft(d=>({...d,output:{node:n.id,slot:i}}))},draft.output?.node===n.id&&draft.output?.slot===i?'✓ 处理结果':'→ 结果'):null))),
  Object.entries(info[n.type]?.input?.required||{}).map(([key,d])=>field(n,key,d)),
  h('details',{onToggle:()=>setLayout(v=>v+1)},h('summary',null,'可选输入'),Object.entries(info[n.type]?.input?.optional||{}).map(([key,d])=>field(n,key,d)))));
 const width=Math.max(1200,...draft.nodes.map(n=>n.x+300)),height=Math.max(750,...draft.nodes.map(n=>n.y+180+Object.keys({...info[n.type]?.input?.required,...info[n.type]?.input?.optional}).length*80));
 const menuActions=popup?[
  {id:'add',label:'添加节点…',run:()=>{setTimeout(()=>setPopup({...popup,kind:'search'}),0);}},
  ...(popup.nodeId?[
   {id:'duplicate',label:'复制节点',run:()=>duplicate(popup.nodeId)},
   {id:'disconnect',label:'断开节点连接',run:()=>{if(!busy){setDraft(d=>workflowCanvasDisconnect(d,popup.nodeId,info));setSource(null);}}},
   {id:'remove',label:'删除节点',danger:true,run:()=>remove(popup.nodeId)}
  ]:[]),
  {id:'fit',label:'适应全部节点',run:fit},
  {id:'reset',label:'100% 显示',run:()=>zoomAt(1)},
  {id:'arrange',label:'整理节点',run:arrange},
  ...(source?[{id:'cancel',label:'取消当前连线',run:()=>setSource(null)}]:[])
 ]:[];
 const workspace=h('div',{className:'cc-flow-workspace cc-flow-native'},
  h('div',{className:'cc-flow-scroll',ref:area,tabIndex:0,role:'region','aria-label':'工作流画布',style:{backgroundSize:(20*zoom)+'px '+(20*zoom)+'px',backgroundPosition:(-viewOffset.left)+'px '+(-viewOffset.top)+'px'},
   onScroll:()=>{if(popup)setPopup(null);},
   onDoubleClick:e=>{if(!e.target.closest('.cc-flow-node'))showPopup('search',e);},
   onContextMenu:e=>{if(e.target.closest('input,textarea,select'))return;showPopup('menu',e,e.target.closest('.cc-flow-node')?.dataset.nodeId);},
   onKeyDown:e=>{if(e.target.closest('input,textarea,select,button'))return;if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')showPopup('menu',e,e.target.closest('.cc-flow-node')?.dataset.nodeId);else if(e.key==='Tab'&&!e.shiftKey)showPopup('search',e);},
   onPointerDown:e=>{if(busy||!(e.button===1||e.button===0&&!e.target.closest('.cc-flow-node,button,input,select,textarea')))return;e.preventDefault();setPopup(null);e.currentTarget.focus({preventScroll:true});pan.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,left:view.current.left,top:view.current.top};e.currentTarget.setPointerCapture(e.pointerId);},
   onPointerMove:e=>{const d=pan.current;if(d?.pointer===e.pointerId){const offset={left:d.left-(e.clientX-d.x),top:d.top-(e.clientY-d.y)};Object.assign(view.current,offset);setViewOffset(offset);}},
   onPointerUp:e=>{if(pan.current?.pointer===e.pointerId){pan.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}},onPointerCancel:()=>{pan.current=null;},onLostPointerCapture:()=>{pan.current=null;}
  },h('div',{className:'cc-flow-space',style:{width:'100%',height:'100%'}},h('div',{className:'cc-flow-canvas',style:{width,height,transform:'translate('+(-viewOffset.left)+'px,'+(-viewOffset.top)+'px) scale('+zoom+')'}},h('svg',{className:'cc-flow-links'},...lines),nodeViews))),
  h('div',{className:'cc-flow-view-tools',role:'toolbar','aria-label':'工作区缩放'},
   h('button',{type:'button',disabled:busy||zoom<=.25,'aria-label':'缩小工作区',onClick:()=>zoomAt(zoom/1.2)},'−'),
   h('button',{type:'button',disabled:busy,'aria-label':'恢复工作区100%缩放',onClick:()=>zoomAt(1)},Math.round(zoom*100)+'%'),
   h('button',{type:'button',disabled:busy||zoom>=2,'aria-label':'放大工作区',onClick:()=>zoomAt(zoom*1.2)},'+'),
   h('button',{type:'button',disabled:busy,onClick:fit},'适应全部')));
 return h(native?'main':OverlayModal,native?{className:'dsh-comfy-floating cc-native-workflow',style:theme}:{title:'自定义工作流编辑器',theme,width:1400,zIndex:2147481500,onClose:close},
  h('style',null,COMFY_WORKFLOW_CSS+WORKFLOW_CANVAS_CSS),
  h('div',{className:'cc-flow-top'},h('input',{'aria-label':'工作流名称',style:S.inp,disabled:busy,value:draft.name,onChange:e=>setDraft(d=>({...d,name:e.target.value}))}),h('button',{type:'button',style:S.btn2,disabled:busy,onClick:arrange},'整理节点'),h('button',{type:'button',style:S.btn2,disabled:busy,onClick:()=>save(false)},busy?'正在保存…':'保存'),h('button',{type:'button',style:S.btn,disabled:busy,onClick:()=>save(true)},'保存并关闭'),h('button',{type:'button',style:S.btn2,disabled:busy,onClick:close},'关闭')),
  error?h('div',{role:'alert',style:S.bad},error):null,
  h('fieldset',{className:'cc-flow-editor',disabled:busy,style:{border:0,padding:0,margin:0,minWidth:0}},
   h('aside',{className:'cc-flow-sidebar'},h('input',{type:'search',style:S.inp,'aria-label':'搜索工作流节点',placeholder:'搜索节点名称 / 分类',value:query,onChange:e=>setQuery(e.target.value)}),h('strong',null,'插件接口'),h('small',null,source?'已选接口，点击节点输入端口连接':'点击接口或输出端口，再点击输入端口连接'),h('div',{className:'cc-flow-interfaces'},POST_INTERFACES.map(x=>h('button',{key:x[0],type:'button',style:S.btn2,title:x[1]+' · '+x[2],'aria-label':x[1]+' · '+x[2],'aria-pressed':source?.interface===x[0],onClick:()=>setSource({interface:x[0]})},x[1]))),h('strong',null,'添加处理节点'),types.slice(0,100).map(type=>h('button',{type:'button',key:type,style:S.btn2,onClick:()=>add(type)},'+ '+(info[type].display_name||type))),types.length>100?h('small',null,'显示前 100 个节点，请搜索缩小范围'):null),workspace),
  h('small',{role:'status'},(JSON.stringify(draft)===start.current?(draft.id?'已保存 · ':''):'有未保存的修改 · ')+'滚轮缩放 · 拖动空白平移 · 双击空白添加节点 · 右键打开菜单'),
  popup&&!busy?h(WorkflowCanvasPopup,{key:popup.kind+':'+popup.x+':'+popup.y+':'+(popup.nodeId||''),popup,info,theme,onClose:closePopup,onAdd:add,actions:menuActions}):null,
  wfConfirm?h(OverlayModal,{title:wfConfirm.title||'确认',width:420,theme,zIndex:2147481600,onClose:()=>{const r=wfConfirm.resolve;setWfConfirm(null);r&&r(false);}},
    h('div',{style:{display:'flex',flexDirection:'column',gap:12}},
      h('p',{style:{margin:0,lineHeight:1.6,fontSize:'13px'}},wfConfirm.message),
      h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8}},
        h('button',{type:'button',style:S.btn2,onClick:()=>{const r=wfConfirm.resolve;setWfConfirm(null);r&&r(false);}},'取消'),
        h('button',{type:'button',style:S.btn,onClick:()=>{const r=wfConfirm.resolve;setWfConfirm(null);r&&r(true);}},'确定')))):null);
}

let postBridgePromptSkipped=false;
function PostLibraryPane({cells,library,onAdd,onCreate,split,setSplit,onResize,installBusy,installStart,installStop,onAddInpaint,kinds=new Set(),inpaintAdded=false}){
 const [creating,setCreating]=React.useState(false),createLock=React.useRef(false),alive=React.useRef(true);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const create=async()=>{if(createLock.current)return;createLock.current=true;setCreating(true);try{await onCreate();}catch(e){notifyError('无法打开自定义节点编辑器：'+errText(e));}finally{createLock.current=false;if(alive.current)setCreating(false);}};
 const top=h('section',{className:'cc-post-side-section cc-post-section-defaults','data-cc-guide':'post-defaults'},h('div',{className:'cc-post-side-head'},h('strong',null,'基础处理'),h(TaskAction,{busy:installBusy,label:'检查并安装缺失组件',busyLabel:'安装中…',onStart:installStart,onStop:installStop})),
  ...Object.entries(POST_KINDS).filter(([kind])=>kind!=='workflow').flatMap(([kind,label])=>[h('button',{key:kind,type:'button',className:'cc-control-add-row',disabled:cells.length>=24||kinds.has(kind),onClick:()=>onAdd(kind)},h('span',null,label),h('small',null,kinds.has(kind)?'已添加':'添加')),...(kind==='upscale'?[h('button',{key:'inpaint',type:'button',className:'cc-control-add-row',disabled:cells.length>=24||inpaintAdded,onClick:()=>onAddInpaint?.()},h('span',null,'局部重绘'),h('small',null,inpaintAdded?'已添加':'添加'))]:[])]));
 const divider=h('div',{className:'cc-post-side-resizer',role:'separator','aria-label':'调整上方组件与自定义节点高度','aria-orientation':'horizontal','aria-valuemin':20,'aria-valuemax':80,'aria-valuenow':Math.round(split),tabIndex:0,onPointerDown:onResize,onDoubleClick:()=>setSplit(50),onKeyDown:e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setSplit(v=>Math.max(20,Math.min(80,v+(e.key==='ArrowDown'?2:-2))));}}});
 const custom=h('section',{className:'cc-post-side-section cc-post-section-workflows'},h('div',{className:'cc-post-side-head'},h('strong',{role:creating?'status':undefined,'aria-live':'polite'},creating?'正在打开编辑器…':'自定义节点'),h('button',{type:'button',className:'cc-post-new-workflow'+(creating?' is-opening':''),title:creating?'正在打开编辑器…':'新建自定义节点','aria-label':'新建自定义节点','aria-busy':creating,disabled:creating,onClick:create},creating?h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner',size:15})):h(PromptIcon,{name:'plus',size:15}))),...library.map(w=>h('button',{key:w.id,type:'button',className:'cc-control-add-row',disabled:cells.length>=24,onClick:()=>onAdd('workflow',w)},w.name)));
 return h('aside',{className:'cc-post-add','aria-label':'生成后控制列表'},h('div',{className:'cc-post-library-pane',style:{gridTemplateRows:'minmax(0,'+split+'fr) 9px minmax(0,'+(100-split)+'fr)'}},top,divider,custom));
}

const POST_MODULE_CSS=`
.cc-task-fly{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 8px;border-radius:999px;background:var(--cc-task-fly-accent,#4D6BFE);color:#fff;font-size:12px;font-weight:600;line-height:1.2;white-space:nowrap;box-shadow:0 10px 26px color-mix(in srgb,var(--cc-task-fly-accent,#4D6BFE) 48%,transparent);will-change:transform,opacity}
.cc-task-fly-dot{width:6px;height:6px;border-radius:50%;background:#fff;opacity:.92;box-shadow:0 0 0 3px rgba(255,255,255,.22)}
.cc-post-workbench{margin:0;overflow:hidden;flex:none;min-height:max-content}
.cc-post-workbench-head{display:flex;align-items:center;gap:10px;cursor:pointer}
.cc-post-workbench-title{display:inline-flex;align-items:center;gap:6px;min-height:24px;font-size:12px;font-weight:var(--cc-ui-weight-label);color:var(--cc-text);cursor:default;flex:none}
.cc-post-workbench-tools{display:flex;align-items:center;gap:10px;margin-left:8px;min-width:0;flex:1}
.cc-post-workbench-tools .cc-post-auto-switch{display:inline-flex;align-items:center;gap:7px;flex:none;width:auto;justify-content:flex-start;font-size:12px;white-space:nowrap;padding:0;border:0;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;cursor:pointer;user-select:none}
.cc-post-workbench-tools .cc-post-auto-switch .cc-switch-track{width:33px;height:19px;background:var(--cc-border)}
.cc-post-workbench-tools .cc-post-auto-switch[aria-checked="true"] .cc-switch-track{background:var(--cc-accent)}
.cc-post-workbench-tools .cc-post-auto-switch .cc-switch-track:after{top:3px;left:3px;width:13px;height:13px;transform:none;background:var(--cc-text)}
.cc-post-workbench-tools .cc-post-auto-switch[aria-checked="true"] .cc-switch-track:after{transform:translateX(14px);background:var(--cc-surface)}
.cc-post-auto-switch[aria-checked="true"] .cc-switch-track{background:var(--cc-accent)}
.cc-post-auto-switch[aria-checked="true"] .cc-switch-track:after{transform:translateX(14px);background:var(--cc-surface)}
.cc-post-workbench-tools .cc-post-collapse{margin-left:auto}
.cc-post-workbench-tools .cc-post-workbench-count{margin-left:0}
.cc-post-workbench-count{color:var(--cc-muted);font-size:12px;white-space:nowrap}
.cc-post-collapse{width:28px;height:28px;display:grid;place-items:center;padding:0;border:0;border-radius:var(--cc-ui-radius-control);background:transparent;color:var(--cc-muted);cursor:pointer}
.cc-post-collapse:hover{background:transparent;color:var(--cc-text)}
.cc-post-collapse svg{transition:transform .18s ease}
.cc-post-collapse[aria-expanded="true"] svg{transform:rotate(180deg)}
.cc-post-workbench-body{padding:var(--cc-ui-space-sm);display:flex;flex:none;flex-direction:column;gap:var(--cc-notebook-gap)}
.cc-post-workbench .cc-post-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:0;border:0;background:transparent;min-width:0}
.cc-post-workbench .cc-post-toolbar .cc-task-action{display:inline-flex;align-items:center;flex:none;min-height:34px}
.cc-post-workbench .cc-post-toolbar .cc-task-action>button{min-height:34px}
.cc-post-workbench .cc-post-notebook{display:grid;flex:none;width:100%;min-width:0;align-self:stretch;grid-template-columns:minmax(155px,2fr) minmax(0,8fr);height:min(820px,calc(100vh - 180px));min-height:0;gap:0;border:0;border-radius:0;overflow:hidden}
.cc-post-workbench .cc-post-library-pane{display:grid;grid-template-rows:minmax(0,1fr) 9px minmax(0,1fr);gap:0;height:100%;min-height:0;align-self:stretch;background:transparent;border-right:var(--cc-notebook-border-width) solid var(--cc-notebook-border);color:var(--cc-notebook-text)}
.cc-post-workbench .cc-post-side-section{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;padding:var(--cc-notebook-padding)}
.cc-post-workbench .cc-post-side-section::-webkit-scrollbar{display:none}
.cc-post-workbench .cc-post-side-section>strong{font-size:12px;padding:8px 7px 5px;color:var(--cc-notebook-text);flex:none}
.cc-post-workbench .cc-post-side-section .cc-control-add-row{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:8px;width:100%;min-height:36px;padding:7px;border:0;border-radius:5px;background:transparent;color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer;overflow-wrap:anywhere}
.cc-post-workbench .cc-post-side-section .cc-control-add-row small{font-size:10px;flex:none;color:var(--cc-notebook-muted)}
.cc-post-workbench .cc-post-side-section .cc-control-add-row:hover:enabled{background:var(--cc-notebook-hover-bg)}
.cc-post-workbench .cc-post-side-section .cc-control-add-row:disabled{opacity:.5;cursor:default}
.cc-post-workbench .cc-post-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;padding:8px 7px 5px;min-width:0}
.cc-post-workbench .cc-post-side-head>strong{flex:none}
.cc-post-workbench .cc-post-side-head .cc-task-action{flex:0 1 auto;min-width:0;overflow:hidden}
.cc-post-workbench .cc-post-side-head .cc-task-action>button{min-width:0;max-width:100%;overflow:hidden}
.cc-post-workbench .cc-post-side-head .cc-task-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.cc-post-workbench .cc-post-side-head>strong{font-size:12px;color:var(--cc-notebook-text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-post-workbench .cc-post-new-workflow{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0!important;border-radius:6px;border:1px solid var(--cc-notebook-border)!important;background:var(--cc-notebook-control-bg)!important;color:var(--cc-notebook-text)!important;--cc-button-hover:var(--cc-notebook-hover-bg);--cc-button-hover-border:var(--cc-notebook-border);cursor:pointer}
.cc-post-workbench .cc-post-new-workflow:hover{background:var(--cc-notebook-hover-bg)!important;filter:brightness(1.08)}
.cc-post-workbench .cc-post-side-resizer{height:9px;min-height:9px;margin:0 6px;border-radius:4px;cursor:row-resize;touch-action:none;background:transparent;position:relative;outline:none}
.cc-post-workbench .cc-post-side-resizer::before{content:'';position:absolute;left:0;right:0;top:4px;height:1px;background:var(--cc-notebook-border)}
.cc-post-workbench .cc-post-side-resizer:hover::before,.cc-post-workbench .cc-post-side-resizer:focus-visible::before{background:var(--cc-accent);top:3px;height:2px}
.cc-post-workbench .cc-post-add{display:flex;flex-direction:column;gap:0;overflow:hidden;border:0;border-radius:0;background:transparent;padding:0 12px 0 0;min-width:0;min-height:0}
.cc-post-workbench .cc-post-cells{display:flex;flex-direction:column;gap:9px;flex:1 1 auto;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;min-width:0;min-height:0;padding:0 4px 0 8px;background:transparent;color:var(--cc-notebook-text)}
.cc-post-workbench .cc-post-cells::-webkit-scrollbar{display:none}
.cc-post-workbench .cc-post-empty-drop{padding:30px;color:var(--cc-notebook-muted);text-align:center;border:1px dashed var(--cc-notebook-border);border-radius:8px;font-size:13px;background:transparent}
.cc-post-workbench .cc-post-cell{flex:none;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-left:var(--cc-notebook-rail-width) solid var(--cc-notebook-rail);border-radius:var(--cc-notebook-radius);background:var(--cc-notebook-cell-bg);color:var(--cc-notebook-text);overflow:hidden;margin:0;padding:0;min-width:0}
.cc-post-workbench .cc-post-cell-head{display:flex;align-items:center;gap:8px;min-height:34px;padding:5px 10px;border-bottom:0;background:var(--cc-notebook-header-bg);color:var(--cc-notebook-text)}
.cc-post-workbench .cc-post-cell-index{font:600 11px ui-monospace,Consolas,monospace;color:var(--cc-accent-text);background:var(--cc-accent-bg);border-radius:4px;padding:2px 7px;min-width:28px;text-align:center;flex:none}
.cc-post-workbench .cc-post-cell[data-disabled="true"] .cc-post-cell-index{color:var(--cc-muted);background:var(--cc-border)}
.cc-post-workbench .cc-post-cell-drag{display:inline-flex;align-items:center;justify-content:center;color:var(--cc-muted);cursor:grab;flex:none;padding:0 2px}
.cc-post-workbench .cc-post-cell-drag:active{cursor:grabbing}
.cc-post-workbench .cc-post-cell-title{flex:1 1 auto;min-width:60px;font-size:13px;font-weight:var(--cc-notebook-title-weight);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-post-workbench .cc-post-cell-enable{display:inline-flex;align-items:center;flex:none;font-size:13px}
.cc-post-workbench .cc-post-cell-enable .cc-switch{font-size:13px}
.cc-post-workbench .cc-post-cell-actions{display:inline-flex;align-items:center;gap:4px;flex:none;margin-left:4px}
.cc-post-workbench .cc-post-cell-actions button{width:30px!important;height:30px!important;min-width:30px!important;display:inline-flex!important;align-items:center;justify-content:center;padding:0!important;border:1px solid currentColor!important;border-radius:6px!important;background:transparent!important;color:var(--cc-notebook-text)!important;cursor:pointer;font:inherit;font-size:14px!important;line-height:1}
.cc-post-workbench .cc-post-cell-actions button:hover:enabled{background:var(--cc-hover)}
.cc-post-workbench .cc-post-cell-actions button:disabled{opacity:.4;cursor:default}
.cc-post-workbench .cc-post-cell-fields{display:flex;flex-direction:column;gap:var(--cc-notebook-field-gap);padding:var(--cc-notebook-padding)}
.cc-post-workbench .cc-post-param-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:end}.cc-post-workbench .cc-post-param-group[data-layout=upscale]{grid-template-columns:repeat(2,minmax(0,1fr))}
.cc-post-workbench .cc-post-param-wide{grid-column:1/-1}
.cc-post-workbench .cc-post-cell :is(.cc-select-trigger,.cc-field-capsule,.cc-generation-file-select,button[role="switch"],select,textarea){color:var(--cc-notebook-text);background:var(--cc-notebook-control-bg);border-color:var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);box-sizing:border-box}
.cc-post-workbench .cc-post-cell :is(.cc-generation-model-preview,.cc-reference-thumb,.cc-model-dock-art){background:var(--cc-notebook-preview-bg);border-color:var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius)}
.cc-post-workbench .cc-post-cell-actions button{border-width:var(--cc-notebook-border-width)!important;border-radius:var(--cc-notebook-control-radius)!important}
.cc-post-workbench .cc-post-notebook button{--cc-button-hover:var(--cc-notebook-hover-bg);--cc-button-hover-border:var(--cc-notebook-border)}
.cc-post-input-cell{flex:none}
.cc-post-input-pill{padding:2px 8px;border-radius:999px;background:var(--cc-accent-bg);color:var(--cc-accent-text);font-size:10px;font-weight:600;white-space:nowrap;flex:none}
.cc-post-input-source{margin-left:auto;color:var(--cc-notebook-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-post-input-mid{display:flex;flex-direction:column;gap:8px;min-width:0}
.cc-post-input-thumb{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border-radius:calc(var(--cc-notebook-control-radius) - 2px);background:var(--cc-accent-bg);border:1px solid var(--cc-accent);pointer-events:none;transition:transform .16s ease}
.cc-post-input-tabs button{position:relative;z-index:1}
.cc-post-input-badge{position:absolute;right:6px;bottom:6px;z-index:2;padding:2px 7px;border-radius:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;pointer-events:none}
.cc-post-input-empty{color:var(--cc-notebook-muted);font-size:11px;line-height:1.4;text-align:center;padding:0 8px}
.cc-post-input-model-wrap{display:flex;flex-direction:column;border-top:1px solid var(--cc-notebook-border)}
.cc-post-input-cell .cc-post-model-settings{border:0;border-radius:0;background:transparent;margin:0}
.cc-post-input-cell .cc-post-model-settings>summary{padding:9px 16px;background:transparent;border-bottom:0}
.cc-post-input-cell .cc-post-model-settings[open]>summary{border-bottom:1px solid var(--cc-notebook-border)}
.cc-post-input-cell .cc-post-model-settings-body{padding:0 16px 14px}
.cc-post-input-body{display:grid;grid-template-columns:180px minmax(0,1fr) auto;gap:8px 16px;padding:14px;background:var(--cc-notebook-cell-bg);align-items:center}
.cc-post-input-preview-wrap{display:flex;flex-direction:column;gap:5px;min-width:0;width:100%}
.cc-post-input-preview{position:relative;width:100%;min-width:0;height:120px;min-height:0;max-height:none;display:grid;place-items:center;overflow:hidden;background:var(--cc-notebook-preview-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);color:var(--cc-notebook-muted);font-size:12px}.cc-post-input-preview.is-clickable{cursor:zoom-in}.cc-post-input-preview.is-clickable:hover{border-color:var(--cc-accent)}
.cc-post-input-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;image-rendering:auto;pointer-events:none}
.cc-post-input-preview .cc-post-preview-result{clip-path:inset(0 0 0 var(--cc-post-compare-position,50%))}
.cc-post-input-preview .cc-post-preview-mask{position:absolute;inset:0;background:var(--cc-accent);mask-image:var(--cc-post-mask-image);mask-mode:luminance;mask-size:100% 100%;mask-repeat:no-repeat;-webkit-mask-image:var(--cc-post-mask-image);-webkit-mask-mode:luminance;-webkit-mask-size:100% 100%;-webkit-mask-repeat:no-repeat;clip-path:none;opacity:.55;pointer-events:none}
.cc-post-input-preview .cc-post-preview-divider{position:absolute;z-index:2;top:0;bottom:0;left:var(--cc-post-compare-position,50%);width:2px;background:var(--cc-text);box-shadow:0 0 0 1px rgba(0,0,0,.35);pointer-events:none}
.cc-post-input-preview .cc-post-preview-divider::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:28px;transform:translate(-50%,-50%);border:1px solid var(--cc-border);border-radius:var(--cc-ui-radius-control);background:var(--cc-notebook-control-bg);box-shadow:0 1px 4px rgba(0,0,0,.35)}
.cc-post-input-preview-range{display:block;width:100%;margin:0;accent-color:var(--cc-accent)}
.cc-post-input-preview-labels{display:flex;justify-content:space-between;color:var(--cc-notebook-muted);font-size:11px;line-height:1.2}
.cc-post-input-controls{min-width:0;display:flex;flex-direction:column;gap:8px}
.cc-post-input-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cc-post-mask-edit{padding:5px 10px;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);cursor:pointer}
.cc-post-mask-edit:hover{background:var(--cc-accent-bg);border-color:var(--cc-accent);color:var(--cc-accent-text)}
.cc-post-mask-ready{color:var(--cc-accent);font-size:12px}.cc-post-mask-missing{color:var(--cc-warning,#d99b39);font-size:12px}
.cc-post-mask-edit{margin-left:auto}
.cc-post-input-picture{display:flex;flex-direction:column;gap:8px;min-width:0;width:180px;flex:none}
.cc-post-input-tabs{display:flex;position:relative;height:32px;width:100%;max-width:300px;padding:3px;background:var(--cc-notebook-control-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius)}
.cc-post-input-tabs button{flex:1;min-height:26px;padding:3px 6px;border:0;border-radius:calc(var(--cc-notebook-control-radius) - 2px);background:transparent;color:var(--cc-notebook-muted);font:inherit;font-size:11px;cursor:pointer}
.cc-post-input-tabs button.selected{background:transparent;color:var(--cc-accent-text);box-shadow:none}
.cc-post-input-tabs button:disabled{opacity:.45;cursor:default}
.cc-post-input-actions{display:flex;flex-direction:column;gap:6px;width:100%;max-width:300px}
.cc-post-input-actions .cc-post-input-import{flex:none;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:30px;padding:5px 8px;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer}
.cc-post-input-actions .cc-post-input-import[aria-expanded=true]{background:var(--cc-accent-bg);border-color:var(--cc-accent);color:var(--cc-accent-text)}
.cc-post-input-actions .cc-post-input-import .cc-post-input-import-caret{margin-left:auto;transition:transform .15s ease}
.cc-post-input-actions .cc-post-input-import[aria-expanded=true] .cc-post-input-import-caret{transform:rotate(180deg)}
.cc-post-input-menu{display:flex;flex-direction:column;gap:4px;padding:5px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px;box-shadow:0 14px 42px rgba(0,0,0,.32)}
.cc-post-input-menu button{display:inline-flex;align-items:center;justify-content:flex-start;gap:8px;width:100%;min-height:30px;padding:5px 10px;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer;text-align:left}
.cc-post-input-menu button:hover:enabled{background:var(--cc-notebook-hover-bg);border-color:var(--cc-accent)}
.cc-post-input-menu button:disabled{opacity:.45;cursor:default}
.cc-post-history-mask{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.62)}
.cc-post-history-dialog{display:flex;flex-direction:column;width:min(1240px,94vw);height:min(860px,88vh);background:var(--cc-notebook-cell-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.55);overflow:hidden}
.cc-post-history-head{display:flex;align-items:center;gap:10px;flex:none;padding:14px 16px;border-bottom:1px solid var(--cc-notebook-border)}
.cc-post-history-head>strong{font-size:14px;color:var(--cc-notebook-text)}
.cc-post-history-count{color:var(--cc-notebook-muted);font-size:12px}
.cc-post-history-close{margin-left:auto;width:30px;height:30px;display:grid;place-items:center;padding:0;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-muted);cursor:pointer}
.cc-post-history-close:hover{color:var(--cc-notebook-text);background:var(--cc-notebook-hover-bg)}
.cc-post-history-body{flex:1;min-height:0;overflow:auto;padding:14px 16px}
.cc-post-history-body .cc-output-masonry{position:relative}
.cc-post-history-card{position:relative;display:block;width:100%;padding:0;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);overflow:hidden;cursor:pointer;text-align:left}
.cc-post-history-card img{display:block;width:100%;height:auto;object-fit:contain;background:var(--cc-notebook-preview-bg)}
.cc-post-history-card:hover{border-color:var(--cc-accent)}
.cc-post-history-dialog .cc-post-history-card.is-selected,.cc-post-history-dialog .cc-post-history-card.is-selected:hover,.cc-post-history-dialog .cc-post-history-card.is-selected:focus,.cc-post-history-dialog .cc-post-history-card.is-selected:focus-visible,.cc-post-history-dialog .cc-post-history-card.is-selected:active{border-color:var(--cc-accent);box-shadow:0 0 0 3px var(--cc-accent),0 0 12px color-mix(in srgb,var(--cc-accent) 35%,transparent)!important;z-index:1}
.cc-post-history-card-meta{position:absolute;left:0;right:0;bottom:0;display:block;padding:14px 8px 6px;background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,0));color:#fff;font-size:11px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-post-history-card.is-selected .cc-post-history-card-meta{color:#fff}
.cc-post-history-sentinel{padding:10px 0 4px;text-align:center;color:var(--cc-notebook-muted);font-size:11px}
.cc-post-history-empty{display:grid;place-items:center;height:100%;color:var(--cc-notebook-muted);font-size:13px}
.cc-post-history-more{display:block;width:100%;margin-top:10px;padding:8px;border:var(--cc-notebook-border-width) dashed var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:transparent;color:var(--cc-notebook-muted);font:inherit;font-size:12px;cursor:pointer}
.cc-post-history-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;padding:12px 16px;border-top:1px solid var(--cc-notebook-border);background:var(--cc-notebook-cell-bg)}
.cc-post-history-btn{min-height:32px;padding:6px 16px;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer}
.cc-post-history-btn:hover:enabled{background:var(--cc-notebook-hover-bg)}
.cc-post-history-btn.is-primary{background:var(--cc-accent-bg);border-color:var(--cc-accent);color:var(--cc-accent-text)}
.cc-post-history-btn:disabled{opacity:.45;cursor:default}
.cc-post-input-actions .cc-post-input-import:hover{background:var(--cc-notebook-hover-bg)}
.cc-post-input-inpaint{min-width:0;display:flex;flex-direction:column;gap:8px}
.cc-post-embedded-inpaint{display:flex;flex-direction:column;gap:10px;padding:12px 14px 14px;border-top:1px solid var(--cc-notebook-border)}
.cc-post-embedded-inpaint-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;min-height:28px}
.cc-post-embedded-inpaint-head>strong{font-size:12px;color:var(--cc-notebook-text)}
.cc-post-inpaint-priority{padding:2px 8px;border-radius:999px;background:var(--cc-accent-bg);color:var(--cc-accent-text);font-size:10px;font-weight:600;white-space:nowrap}
.cc-post-inpaint-note{display:none}
.cc-post-inpaint-push{margin-left:auto}
.cc-post-embedded-inpaint-head .cc-post-auto-switch{flex:none;width:auto;display:inline-flex;align-items:center;gap:7px;padding:0;border:0;background:transparent;color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer;user-select:none}
.cc-post-embedded-inpaint-head .cc-post-auto-switch .cc-switch-track{width:34px;height:18px}
.cc-post-inpaint-remove{flex:none;width:28px;height:28px;display:grid;place-items:center;padding:0;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-muted);cursor:pointer}
.cc-post-inpaint-remove:hover{color:var(--cc-bad);background:var(--cc-notebook-hover-bg)}
.cc-post-inpaint-editor{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:18px;align-items:start}
.cc-post-inpaint-prompts{display:flex;flex-direction:column;gap:8px;min-width:0}
.cc-post-inpaint-prompts textarea{width:100%;min-height:104px;resize:vertical;padding:9px 10px;font-size:12px;line-height:1.6;box-sizing:border-box;background:var(--cc-notebook-control-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);color:var(--cc-notebook-text)}

.cc-post-workbench .cc-post-cell-prompts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:0 16px 12px}
.cc-post-workbench .cc-post-cell-prompts textarea{width:100%;min-height:58px;resize:vertical;padding:8px 10px;box-sizing:border-box;background:var(--cc-notebook-control-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);color:var(--cc-notebook-text);font-size:12px;line-height:1.5}
@media (max-width:900px){.cc-post-workbench .cc-post-cell-prompts{grid-template-columns:minmax(0,1fr)}}.cc-post-inpaint-negative textarea{width:100%;padding:8px;margin-top:6px;min-height:55px;resize:vertical;font-size:12px;box-sizing:border-box;background:var(--cc-notebook-control-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);color:var(--cc-notebook-text)}
.cc-post-inpaint-negative summary{cursor:pointer;font-size:11px;color:var(--cc-notebook-muted);padding:2px 0;user-select:none}
.cc-post-inpaint-side{display:flex;flex-direction:column;gap:8px;min-width:0;padding-top:23px}
.cc-post-mask-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cc-post-mask-actions .cc-post-mask-edit{margin-left:0}
.cc-post-inpaint-empty{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px 14px;border:var(--cc-notebook-border-width) dashed var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius)}
.cc-post-inpaint-empty p{margin:0;color:var(--cc-notebook-muted);font-size:12px;line-height:1.5}
.cc-post-inpaint-add{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer}
.cc-post-preview-view-tag{position:absolute;top:8px;left:8px;z-index:2;padding:2px 7px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:10px}
.cc-post-source-bar{display:flex;align-items:center;flex-wrap:wrap;gap:5px}
.cc-post-source-bar>span{color:var(--cc-notebook-muted);font-size:11px;margin-right:auto}
.cc-post-source-bar button{min-height:30px;padding:4px 9px;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);font:inherit;font-size:12px;cursor:pointer}
.cc-post-source-bar button[aria-pressed=true]{background:var(--cc-accent-bg);border-color:var(--cc-accent);color:var(--cc-accent-text)}
.cc-post-custom-parameters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cc-post-model-settings>summary{list-style:none;display:flex;align-items:center;gap:8px;min-height:40px;padding:7px 10px;background:var(--cc-notebook-header-bg);cursor:pointer;user-select:none}
.cc-post-model-settings>summary::-webkit-details-marker{display:none}
.cc-post-model-settings[open]>summary{border-bottom:var(--cc-notebook-border-width) solid var(--cc-notebook-border)}
.cc-post-model-settings[open] .cc-post-model-chevron{transform:rotate(180deg)}
.cc-post-resample-model .cc-post-model-summary{display:flex;align-items:center;gap:8px;padding:8px 0 4px;min-height:30px}.cc-post-model-summary-note{margin-left:auto;color:var(--cc-notebook-muted);font-size:11px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-post-model-settings-body{display:flex;flex-direction:column;gap:var(--cc-notebook-field-gap);padding:var(--cc-notebook-padding)}
.cc-post-custom-model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--cc-notebook-field-gap);align-items:end}
.cc-post-model-source-note{margin:0;color:var(--cc-notebook-muted);font-size:11px;line-height:1.45}
.cc-post-model-loras{grid-column:1/-1;display:flex;flex-direction:column;gap:8px;min-width:0}
.cc-post-model-lora-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cc-post-model-lora-head>strong{font-size:12px;color:var(--cc-notebook-text)}
.cc-post-model-lora-row{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,3fr) minmax(0,3fr) 34px;gap:var(--cc-notebook-gap);align-items:end;min-width:0}
.cc-post-model-lora-remove{width:34px;height:34px;display:grid;place-items:center;padding:0;border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);background:var(--cc-notebook-control-bg);color:var(--cc-notebook-text);cursor:pointer}
.cc-post-model-lora-remove:hover{background:var(--cc-notebook-hover-bg);color:var(--cc-bad)}
.cc-post-workbench-footer{position:static;z-index:auto;display:flex;justify-content:flex-end;padding:12px 0 0;margin-top:8px;border-top:1px solid var(--cc-notebook-border);background:transparent}
.cc-post-start{min-width:150px}
.cc-post-model-pick{position:relative;overflow:visible}
.cc-post-model-pick .cc-generation-field-label{font-size:11px;color:var(--cc-notebook-muted)}
.cc-post-model-pick .cc-generation-lora-model-select{width:100%;height:var(--cc-notebook-control-height)!important;min-height:var(--cc-notebook-control-height)!important;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px!important;text-align:left;overflow:hidden}
.cc-post-model-pick .cc-generation-lora-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-post-model-pick .cc-generation-lora-preview-popover{position:fixed;left:0;top:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;min-width:150px;min-height:100px;max-width:240px;max-height:300px;padding:4px;background:var(--cc-notebook-cell-bg);border:var(--cc-notebook-border-width) solid var(--cc-notebook-border);border-radius:var(--cc-notebook-control-radius);box-shadow:0 12px 32px rgba(0,0,0,.4);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-50%) translateX(5px);transition:opacity .08s,transform .08s}
.cc-post-model-pick:hover .cc-generation-lora-preview-popover,.cc-post-model-pick:focus-within .cc-generation-lora-preview-popover{opacity:1;visibility:visible;transform:translateY(-50%) translateX(0)}
/* 预览图尺寸限制：所有模型类型统一按 180x120 裁剪展示，避免原图尺寸撑爆弹层。 */
.cc-post-model-pick .cc-generation-lora-preview-popover{overflow:hidden}
.cc-post-model-pick .cc-generation-lora-preview-popover .cc-model-dock-art{width:180px;height:120px;max-width:230px;max-height:290px;display:flex;align-items:center;justify-content:center;background:var(--cc-notebook-preview-bg);border-radius:var(--cc-notebook-control-radius);overflow:hidden}
.cc-post-model-pick .cc-generation-lora-preview-popover .cc-model-dock-art img{width:100%;height:100%;object-fit:contain;display:block}
@media(max-width:900px){.cc-post-input-body{grid-template-columns:160px minmax(0,1fr) auto}.cc-post-input-preview{height:108px}.cc-post-input-tabs{width:min(100%,220px)}.cc-post-inpaint-editor,.cc-post-workbench .cc-post-param-group{grid-template-columns:1fr}.cc-post-model-lora-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}@media(max-width:700px){.cc-post-input-body{grid-template-columns:minmax(0,1fr)}.cc-post-input-preview{height:auto;min-height:140px;max-height:260px;width:100%}.cc-post-custom-model-grid{grid-template-columns:minmax(0,1fr)}.cc-post-input-tabs{width:100%}.cc-post-inpaint-editor{grid-template-columns:1fr}.cc-post-workbench .cc-post-notebook{height:auto;min-height:0;grid-template-columns:minmax(130px,2fr) minmax(0,8fr)}}
`;

function PostHistoryPicker({items=[],theme,selected,onSelect,onClose,onConfirm,busy=false,loading=false}){
 const [visible,setVisible]=React.useState(80);
 const bodyRef=React.useRef(null),sentinelRef=React.useRef(null);
 const rows=items.slice(0,visible);
 React.useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();onClose();}};
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[onClose]);
 React.useEffect(()=>{
  if(typeof IntersectionObserver==='undefined')return;
  const marker=sentinelRef.current,root=bodyRef.current;if(!marker||!root)return;
  const observer=new IntersectionObserver(entries=>{
   if(!entries.some(e=>e.isIntersecting))return;
   setVisible(v=>Math.min(items.length,v+80));
  },{root,rootMargin:'700px 0px 700px 0px',threshold:0});
  observer.observe(marker);return()=>observer.disconnect();
 },[items.length,visible]);
 return h('div',{className:'cc-post-history-mask',onMouseDown:e=>{if(e.target===e.currentTarget)onClose();}},
  h('div',{className:'cc-post-history-dialog',role:'dialog','aria-modal':'true','aria-label':'从历史输出选择'},
   h('div',{className:'cc-post-history-head'},h('strong',null,'从历史输出选择'),h('span',{className:'cc-post-history-count'},items.length+' 张'),h('button',{type:'button',className:'cc-post-history-close','aria-label':'关闭','data-cc-tooltip':'关闭',onClick:onClose},h(PromptIcon,{name:'x',size:16}))),
   h('div',{className:'cc-post-history-body',ref:bodyRef},
    rows.length?h(OutputMasonry,{items:rows,gap:6,minColumnWidth:180,
     renderCard:item=>h('button',{type:'button',className:'cc-post-history-card'+(selected&&outputKey(selected)===outputKey(item)?' is-selected':''),onClick:()=>onSelect(item),onDoubleClick:()=>onConfirm(item),'aria-pressed':!!(selected&&outputKey(selected)===outputKey(item))},
      h('img',{src:item.url||(item.path?outputViewUrl(item.path):''),loading:'lazy',decoding:'async',alt:item.filename||'输出图片'}),
      h('span',{className:'cc-post-history-card-meta'},item.filename||'Temp 输出'))}):h('div',{className:'cc-post-history-empty'},loading?'正在读取历史输出…':'还没有历史输出'),
    rows.length>0&&rows.length<items.length?h('div',{ref:sentinelRef,className:'cc-post-history-sentinel',role:'status','aria-live':'polite'},'继续向下滚动将自动加载更多 · '+rows.length+' / '+items.length):null),
   h('div',{className:'cc-post-history-foot'},
    h('button',{type:'button',className:'cc-post-history-btn',onClick:onClose},'取消'),
    h('button',{type:'button',className:'cc-post-history-btn is-primary',disabled:!selected||busy,onClick:()=>{if(selected)onConfirm(selected);}},busy?'正在载入…':'确认'))));
}

function PostImageInput({value,onChange,theme,resultUrl='',processing=false,samplers=[],schedulers=[],stepCount=20,cfgValue=6,samplerValue='',schedulerValue='',modelSettings=null,outputItems=[],onLoadOutputs=null,historyLoading=false,online=null}){
 const [busy,setBusy]=React.useState(false),[maskOpen,setMaskOpen]=React.useState(false),[view,setView]=React.useState('original'),[zoom,setZoom]=React.useState(false),[pickerOpen,setPickerOpen]=React.useState(false),[historyOpen,setHistoryOpen]=React.useState(false),[historyPick,setHistoryPick]=React.useState(null),[pickerPos,setPickerPos]=React.useState(null);const file=React.useRef(null),actionsRef=React.useRef(null),importMenuRef=React.useRef(null),input=value.input,local=value.inpaint;
 React.useEffect(()=>{if(!pickerOpen)return;const onDown=e=>{if((actionsRef.current&&actionsRef.current.contains(e.target))||(importMenuRef.current&&importMenuRef.current.contains(e.target)))return;setPickerOpen(false);};const onMove=()=>setPickerOpen(false);document.addEventListener('mousedown',onDown);window.addEventListener('resize',onMove);window.addEventListener('scroll',onMove,true);return()=>{document.removeEventListener('mousedown',onDown);window.removeEventListener('resize',onMove);window.removeEventListener('scroll',onMove,true);};},[pickerOpen]);
 async function importFile(selected){if(!selected)return;setBusy(true);try{if(!/\.(png|jpe?g|webp|bmp)$/i.test(selected.name))throw Error('请选择 PNG、JPEG、WebP 或 BMP 图片');const bitmap=await referenceRead(selected);let original,asset;try{({original,asset}=await referencePersistCanvas(referenceCanvasFromBitmap(bitmap)));}finally{bitmap.close();}if(/\.png$/i.test(selected.name))try{original=await referenceStore(selected);}catch{};const next={original,asset,editorDocument:null,name:selected.name,enabled:true,mode:'reference'};onChange({...value,input:next,inpaint:local?{...local,asset,original,mask:null,coverage:0}:null});}catch(error){notifyError(error,{title:'无法导入图片'});}finally{setBusy(false);}}
 const preview=input?.asset?.id?referenceCanvasUrl(input.asset.id):'';
 const showResult=view==='result'&&!!resultUrl;
 const toggleInpaint=()=>onChange({...value,inpaint:local?null:{enabled:true,asset:input?.asset||null,original:input?.original||null,mask:null,coverage:0,denoise:.65,grow:0,feather:8}});
 const openMask=()=>{if(!input?.asset){notifyError('请先导入要处理的图片',{title:'局部重绘'});return;}setMaskOpen(true);};
 const patchInpaint=(patch)=>onChange({...value,inpaint:{...local,...patch}});
 const sourceParams=input?.sourceOutput?.params||null,source=value.modelSource||local?.parameterSource||'upper',custom=local?.customParameters||{};
 async function useResult(){
  if(!resultUrl||busy)return;setBusy(true);
  try{const resp=await fetch(resultUrl);if(!resp.ok)throw Error('无法读取处理结果');const blob=await resp.blob();const bitmap=await createImageBitmap(blob);let original,asset;try{({original,asset}=await referencePersistCanvas(referenceCanvasFromBitmap(bitmap)));}finally{bitmap.close();}
   onChange({...value,input:{...input,asset,original,editorDocument:null,enabled:true,mode:'reference'},inpaint:local?{...local,asset,original,mask:null,coverage:0}:null});setView('original');}
  catch(error){notifyError(error,{title:'将结果作为输入'});}finally{setBusy(false);}
 }
 async function applyImageUrl(url,title,name){
  if(!url)return false;setBusy(true);
  try{const resp=await fetch(url);if(!resp.ok)throw Error('无法读取图片');const blob=await resp.blob();const bitmap=await createImageBitmap(blob);let original,asset;try{({original,asset}=await referencePersistCanvas(referenceCanvasFromBitmap(bitmap)));}finally{bitmap.close();}
   onChange({...value,input:{original,asset,editorDocument:null,name:name||'历史输出',enabled:true,mode:'reference'},inpaint:local?{...local,asset,original,mask:null,coverage:0}:null});setView('original');return true;}
  catch(error){notifyError(error,{title:title||'无法载入图片'});return false;}finally{setBusy(false);}
 }
 async function confirmHistory(item){
  const url=item?.url||(item?.path?outputViewUrl(item.path):'');
  const ok=await applyImageUrl(url,'从历史输出选择',item?.filename||'历史输出');
  if(ok){setHistoryOpen(false);setHistoryPick(null);}
 }
 return h(React.Fragment,null,
  h('section',{className:'cc-post-cell cc-post-input-cell'+(local?' has-inpaint':''),'data-kind':'image'},
   h('header',{className:'cc-post-cell-head'},h('span',{className:'cc-post-input-pill'},'输入'),h('strong',{className:'cc-post-cell-title'},'图片输入与预览'),h('span',{className:'cc-post-input-source'},input?.asset?input.asset.width+' × '+input.asset.height:'示例图片')),
   h('div',{className:'cc-post-input-body'},
    h('div',{className:'cc-post-input-picture'},
     h('div',{className:'cc-post-input-preview'+(preview?' is-clickable':' is-empty'),style:input?.asset?{aspectRatio:input.asset.width+'/'+input.asset.height}:undefined,onClick:preview?()=>setZoom(true):undefined,onKeyDown:preview?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setZoom(true);}}:undefined,role:preview?'button':undefined,tabIndex:preview?0:undefined,'aria-label':preview?'查看大图':undefined},
      preview?h(React.Fragment,null,
       h('img',{src:showResult?resultUrl:preview,alt:showResult?'处理结果':'原图',decoding:'async'}),
       !showResult&&local?.mask?.id?h('div',{className:'cc-post-preview-mask','aria-label':'局部重绘遮罩预览',style:{'--cc-post-mask-image':'url("'+referenceCanvasUrl(local.mask.id)+'")'}}):null,
       showResult?h('span',{className:'cc-post-preview-view-tag'},'处理结果'):null):h('span',{className:'cc-post-input-empty'},'导入图片后在此预览'),
     input?.asset?h('span',{className:'cc-post-input-badge'},input.asset.width+' × '+input.asset.height):null)),
    h('div',{className:'cc-post-input-mid'},
     h('div',{className:'cc-post-input-tabs',role:'tablist','aria-label':'切换原图与处理结果'},
      h('span',{className:'cc-post-input-thumb','aria-hidden':'true',style:{transform:showResult?'translateX(100%)':'translateX(0)'}}),
      h('button',{type:'button',role:'tab','aria-selected':!showResult,className:!showResult?'selected':'',onClick:()=>setView('original')},'原图'),
      h('button',{type:'button',role:'tab','aria-selected':showResult,className:showResult?'selected':'',disabled:!resultUrl,onClick:()=>setView('result')},'处理结果')),
     h('div',{className:'cc-post-input-actions',ref:actionsRef},
      h('input',{ref:file,type:'file',accept:'.png,.jpg,.jpeg,.webp,.bmp',hidden:true,onChange:e=>{importFile(e.target.files?.[0]);e.target.value='';}}),
      h('button',{type:'button',className:'cc-post-input-import','aria-expanded':pickerOpen,'aria-haspopup':'menu',disabled:busy||processing,onClick:()=>{if(pickerOpen){setPickerOpen(false);return;}const el=actionsRef.current&&actionsRef.current.querySelector('.cc-post-input-import');const r=el&&el.getBoundingClientRect();if(r&&typeof window!=='undefined'){const vw=window.innerWidth||1024,vh=window.innerHeight||768;const width=Math.max(180,Math.min(r.width,vw-24));const left=Math.max(12,Math.min(r.left,vw-width-12));const top=vh-r.bottom-14>=96?r.bottom+6:Math.max(8,r.top-96);setPickerPos({top,left,width});}setPickerOpen(true);}},h(PromptIcon,{name:'image',size:14}),busy?'正在处理…':'选择图片',h('span',{className:'cc-post-input-import-caret'},h(PromptIcon,{name:'chevronDown',size:12}))),
      pickerOpen&&pickerPos?floating(h('div',{ref:importMenuRef,className:'dsh-comfy-floating cc-post-input-menu',role:'menu','aria-label':'选择图片来源',style:Object.assign({},theme,{position:'fixed',top:pickerPos.top,left:pickerPos.left,width:pickerPos.width,zIndex:2147480500})},
       h('button',{type:'button',role:'menuitem',disabled:busy||processing,onClick:()=>{setPickerOpen(false);file.current?.click();}},h(PromptIcon,{name:'arrowUp',size:14}),'上传图片'),
       h('button',{type:'button',role:'menuitem',disabled:busy||processing,onClick:()=>{setPickerOpen(false);setHistoryOpen(true);onLoadOutputs?.({force:false,silent:true});}},h(PromptIcon,{name:'image',size:14}),'从历史输出选择'))):null))),
   local?h('div',{className:'cc-post-embedded-inpaint'},
    h('header',{className:'cc-post-embedded-inpaint-head'},h('strong',null,'局部重绘'),h('span',{className:'cc-post-inpaint-priority'},'优先处理'),h('span',{className:'cc-post-inpaint-note'},'在其他处理步骤之前执行'),h('span',{className:'cc-post-inpaint-push'}),h(PostAutoSwitch,{checked:local.enabled!==false,label:'启用',onChange:checked=>patchInpaint({enabled:checked})}),h('button',{type:'button',className:'cc-post-inpaint-remove','aria-label':'移除局部重绘','data-cc-tooltip':'移除局部重绘',onClick:toggleInpaint},h(PromptIcon,{name:'trash',size:14}))),
    h('div',{className:'cc-post-inpaint-editor'},
     h('div',{className:'cc-post-inpaint-prompts'},
      h('label',{style:S.field},h('span',{style:S.label},'提示词'),h('textarea',{value:local.prompt||'',onChange:e=>patchInpaint({prompt:e.target.value}),placeholder:'描述遮罩区域希望生成的内容'})),
      h('details',{className:'cc-post-inpaint-negative'},h('summary',null,'负向提示词'),h('textarea',{value:local.negative||'',onChange:e=>patchInpaint({negative:e.target.value}),placeholder:'描述不希望出现的内容（可选）'}))),
     h('div',{className:'cc-post-inpaint-side'},
      h('div',{className:'cc-post-source-bar','aria-label':'局部重绘参数来源'},h('span',null,'参数来源'),...[["upper","工作流",true],["original","原图参数",!!sourceParams],["custom","自定义",true]].map(([key,label,enabled])=>h('button',{key,type:'button','aria-pressed':source===key,disabled:!enabled,'data-cc-tooltip':!enabled?'原图没有可用的生成参数':undefined,onClick:()=>onChange({...value,modelSource:key,inpaint:{...local,parameterSource:key}})},label))),
      h('div',{className:'cc-post-mask-actions'},h('span',{className:local.mask&&local.coverage?'cc-post-mask-ready':'cc-post-mask-missing'},local.mask&&local.coverage?'遮罩已就绪':'尚未绘制遮罩'),h('button',{type:'button',className:'cc-post-mask-edit',disabled:!input?.asset,onClick:openMask},'编辑遮罩')),
      h('label',{style:S.field},h('span',{style:S.label},'降噪'),h(DraggableNumberInput,{value:local.denoise??.65,min:0,max:1,step:.01,precision:2,dragPerPixel:.005,label:'局部重绘降噪',onChange:denoise=>patchInpaint({denoise})})))),
   ):null,
   local&&modelSettings?h('div',{className:'cc-post-input-model-wrap'},modelSettings):null,
   zoom?h(OutputInspector,{item:{id:preview,url:showResult?resultUrl:preview,filename:'图片预览 大图'},theme,onClose:()=>setZoom(false),imageOnly:true,label:'图片预览大图'}):null,
   maskOpen&&input?.asset?h(ReferenceImageEditor,{value:{...local,asset:input.asset,original:input.original,enabled:true,name:input.name},target:{w:Number(input.asset.width)||1024,h:Number(input.asset.height)||1024},theme,sizeSettings:{w:Number(input.asset.width)||1024,h:Number(input.asset.height)||1024,multiplier:1,alignment:8},initialTool:'mask',singleSave:true,saveIntent:'inpaint',saveLabel:'保存',onClose:()=>setMaskOpen(false),onSave:()=>{},onExit:(intent,result)=>{if(intent!=='inpaint')return false;const nextAsset=result?.asset||input.asset;const nextOriginal=result?.original||input.original;const imageChanged=!!nextAsset&&nextAsset!==input.asset;const hasMask=!!result?.mask&&Number(result.coverage)>0;if(!hasMask&&!imageChanged)throw Error('没有需要保存的修改');const nextInput={...value.input,asset:nextAsset,original:nextOriginal,editorDocument:result?.editorDocument??value.input?.editorDocument};if(!hasMask){onChange({...value,input:nextInput});setMaskOpen(false);return true;}onChange({...value,input:nextInput,inpaint:{...local,asset:nextAsset,original:nextOriginal,enabled:true,mask:result.mask,coverage:result.coverage,grow:result.settings?.grow??local?.grow??0,feather:result.settings?.feather??local?.feather??8}});setMaskOpen(false);return true;}}):null,
   historyOpen?h(PostHistoryPicker,{items:outputItems,theme,selected:historyPick,onSelect:setHistoryPick,onClose:()=>{setHistoryOpen(false);setHistoryPick(null);},onConfirm:confirmHistory,busy,loading:historyLoading}):null));
}

function PostControlsModal({value,onChange,onEditWorkflow,onCreateWorkflow,workflowLibraryRevision=0,theme,expanded=false,onToggle,onProcess,processing=false,resultUrl='',upscalers,samplers,schedulers,onInstalled,currentSetup,ckpts=[],diffusions=[],clips=[],vaes=[],loras=[],embedded=false,onPickModel=null,modelDockRevision=0,outputItems=[],onLoadOutputs=null,historyLoading=false,online=null}){
 const headRef=React.useRef(null);
 const toggleExpanded=()=>{
  const head=headRef.current;
  const host=head?.closest('.dsh-comfy-ui')||head?.closest('.dsh-comfy-floating');
  const before=head?head.getBoundingClientRect().top:null;
  onToggle?.();
  if(!host||before==null)return;
  const align=()=>{const el=headRef.current;if(!el)return;const delta=el.getBoundingClientRect().top-before;if(Math.abs(delta)>0.5)host.scrollTop+=delta;};
  requestAnimationFrame(()=>{align();requestAnimationFrame(align);});
 };
 const [pcConfirm,setPcConfirm]=React.useState(null);
 const [dragOverKey,setDragOverKey]=React.useState(null);
 const [draggingKey,setDraggingKey]=React.useState(null);
 const [dragDropPos,setDragDropPos]=React.useState('before');
 const autoScrollRef=React.useRef({raf:0,speed:0});
 const dragAutoScroll=(e)=>{
  const box=e.currentTarget.closest('.cc-post-cells');
  if(!box)return;
  const r=box.getBoundingClientRect(),edge=56;
  let speed=0;
  if(e.clientY<r.top+edge)speed=-Math.min(16,Math.max(4,(r.top+edge-e.clientY)/3+4));
  else if(e.clientY>r.bottom-edge)speed=Math.min(16,Math.max(4,(e.clientY-(r.bottom-edge))/3+4));
  const st=autoScrollRef.current;
  st.speed=speed;
  if(speed&&!st.raf){const tick=()=>{const cur=autoScrollRef.current;if(!cur.speed){cur.raf=0;return;}box.scrollTop+=cur.speed;cur.raf=requestAnimationFrame(tick);};st.raf=requestAnimationFrame(tick);}
  else if(!speed&&st.raf){cancelAnimationFrame(st.raf);st.raf=0;}
 };
 const stopDragAutoScroll=()=>{const st=autoScrollRef.current;st.speed=0;if(st.raf){cancelAnimationFrame(st.raf);st.raf=0;}};
 const pcShowConfirm=(opts)=>new Promise(resolve=>setPcConfirm({...opts,resolve}));
  const [info,setInfo]=React.useState({}),[error,setError]=useErrorState(''),[installLoading,setInstallLoading]=React.useState(true),[install,setInstall]=React.useState(null),[library,setLibrary]=React.useState([]),[bridgeSkipped,setBridgeSkipped]=React.useState(postBridgePromptSkipped),[bridgeBusy,setBridgeBusy]=React.useState(false),[bridgeCopied,setBridgeCopied]=React.useState(false);const bridgeCopyRef=React.useRef(false),bridgeActionRef=React.useRef(false);const alive=React.useRef(true),busy=React.useRef(false),drag=React.useRef(null);const [postSplit,setPostSplit]=React.useState(50);
 // Node metadata and local installation status load independently in the background.
 // Workflow windows validate their own connection; neither request locks their entry buttons.
 React.useEffect(()=>{
  if(!expanded)return;
  const ctl=new AbortController();alive.current=true;
  // 先确认 ComfyUI 连接状态：离线时完全不发节点/依赖请求，也不弹错误（离线是正常状态）。
  (async()=>{
   let running=false;
   try{const st=await jget(EXPANDER+'/comfy/online',5000,ctl.signal);running=st?.running===true;}catch(e){running=false;}
   if(ctl.signal.aborted)return;
   if(!running){if(!ctl.signal.aborted)setInstallLoading(false);return;}
   jget(COMFY+'/object_info',30000,ctl.signal).then(r=>{if(!ctl.signal.aborted)setInfo(r);}).catch(e=>{if(!ctl.signal.aborted)setError('节点列表读取失败：'+errText(e),{silent:true});});
   jget(EXPANDER+'/post/dependencies',10000,ctl.signal).then(r=>{if(!ctl.signal.aborted)setInstall(r);}).catch(e=>{if(!ctl.signal.aborted){setInstall({message:'安装状态无法读取'});setError('安装状态读取失败：'+errText(e),{silent:true});}}).finally(()=>{if(!ctl.signal.aborted)setInstallLoading(false);});
  })();
  return()=>{alive.current=false;ctl.abort();};
 },[expanded,online]);
 React.useEffect(()=>{if(!expanded||!install?.running)return;let stopped=false,querying=false;const ctl=new AbortController();const timer=setInterval(async()=>{if(querying)return;querying=true;try{const r=await jget(EXPANDER+'/post/dependencies',10000,ctl.signal);if(!stopped&&alive.current)setInstall(r);}catch(e){if(!stopped&&alive.current)setError('安装状态读取失败：'+errText(e));}finally{querying=false;}},1500);return()=>{stopped=true;clearInterval(timer);ctl.abort();};},[expanded,install?.running]);
 React.useEffect(()=>{if(!expanded)return;const ctl=new AbortController();jget(EXPANDER+'/post/workflows',10000,ctl.signal).then(r=>{if(!ctl.signal.aborted)setLibrary(r.items||[]);}).catch(e=>{if(!ctl.signal.aborted)setError('工作流列表读取失败：'+errText(e),{silent:true});});return()=>ctl.abort();},[expanded,workflowLibraryRevision,JSON.stringify(value.cells.filter(c=>c.kind==='workflow').map(c=>c.workflow))]);
 const cells=value.cells,patch=(id,data)=>onChange({...value,cells:cells.map(c=>c.id===id?{...c,...data}:c)}),remove=id=>onChange({...value,cells:cells.filter(c=>c.id!==id)});
 const startPostResize=e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();const box=e.currentTarget.parentElement?.getBoundingClientRect();if(!box)return;const move=ev=>{const pct=(ev.clientY-box.top)/box.height*100;setPostSplit(Math.max(20,Math.min(80,pct)));};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});};
 const addCell=(kind,wf)=>{if(cells.length>=24||(kind==='workflow'&&!wf))return;const c=newPostCell(kind);if(kind==='upscale')c.model=upscalers[0]||'';if(wf)c.workflow=postClone(wf);onChange({...value,cells:[...cells,c]});};
 async function setup(modelsOnly=false,selectedCells=value.cells){if(busy.current||bridgeActionRef.current)return;busy.current=true;setError('');try{if(install?.faceModelsVersion!==1)throw Error('请更新并重启 Sidecar，以支持 BBOX / SAM / SEGM 模型安装');const r=await jpost(EXPANDER+'/post/dependencies/install',{models:postFaceInstallation(selectedCells),modelsOnly:modelsOnly===true},15000);if(alive.current){setInstall(r);onInstalled?.();}}catch(e){if(alive.current)setError(errText(e));}finally{busy.current=false;}}
 async function copyBridgeOnly(){
  if(bridgeCopyRef.current)return;bridgeCopyRef.current=true;
  try{const r=await jpost(EXPANDER+'/post/bridge/install',{},15000);if(alive.current){setInstall(r);setBridgeCopied(true);}}
  catch(e){if(alive.current)setError(errText(e));}
 }
 React.useEffect(()=>{
  if(installLoading||!install||install.online!==false||install.bridge)return;
  if(install.bridgeCurrent){setBridgeCopied(true);return;}
  copyBridgeOnly();
 },[installLoading,install]);
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
 const num=(c,key,label,min,max,step=.01,inline=false)=>h('label',{style:inline?{...S.field,flexDirection:'row',alignItems:'center',gap:8}:S.field},h('span',{style:inline?{...S.label,whiteSpace:'nowrap'}:S.label},label),h(DraggableNumberInput,{value:c[key]??(key==='sam_threshold'?.93:key==='sam_dilation'?0:''),onChange:v=>patch(c.id,{[key]:v===''?'':Number(v)}),label:label+' '+c.id,step:step,precision:numberInputPrecision(step),dragPerPixel:(step)/10,className:'cc-parameter-number',allowEmpty:true,min:min,max:max}));
 const select=(c,key,label,options)=>h('label',{style:S.field},h('span',{style:S.label},label),h(SelectMenu,{theme,label:label+' '+c.id,value:c[key]??(key==='samDevice'?'AUTO':''),options,onChange:v=>patch(c.id,{[key]:v}),minWidth:0,forceSearch:true}));
 const inherited=c=>h('label',{style:S.field},h('span',{style:S.label},'采样参数'),h(SelectMenu,{theme,label:'采样参数 '+c.id,minWidth:0,value:c.inherit===false?'custom':'inherit',options:[{value:'inherit',label:'继承当前参数'},{value:'custom',label:'自定义参数'}],onChange:v=>patch(c.id,{inherit:v==='inherit'})}));
 async function refreshFaceModels(){setError('');try{const latest=await jget(COMFY+'/object_info',30000);if(alive.current)setInfo(latest);const state=await jget(EXPANDER+'/post/dependencies',10000);if(alive.current)setInstall(state);}catch(e){if(alive.current)setError('模型列表刷新失败：'+errText(e),{silent:true});}}
 React.useEffect(()=>{if(online!==true)return;if(install?.running===false&&!installLoading)refreshFaceModels();},[install?.running,online]);
 const faceStatus=c=>[['BBOX','bbox',c.detector],['SAM','sam',c.samModel],['SEGM','segm',c.segmDetector]].map(([label,role,name])=>{const item=install?.models?.[role];return label+'：'+(!name?'未启用':postFaceNames(info,role).includes(name)?'已识别':item?.default===name&&item.fileExists?'文件已安装，待加载':item?.default===name&&item.fileExists===false?'未安装':'待确认');}).join(' · ');
 const faceSelect=(c,key,label,role)=>select(c,key,label,postFaceOptions(info,role,c[key]));
 const currentModelSetup=currentSetup||{},customModel=value.customModelSetup||{},modelSource=value.modelSource||'upper',sourceOutputParams=value.input?.sourceOutput?.params||null;
 const resampleSource=c=>c.parameterSource||(c.inherit===false?'custom':'upper');
 const resampleSourceBar=c=>h('div',{className:'cc-post-source-bar','aria-label':'二次采样参数来源'},h('span',null,'参数来源'),...[["upper","工作流",true],["original","原图参数",!!sourceOutputParams],["custom","自定义",true]].map(([key,label,enabled])=>h('button',{key,type:'button','aria-pressed':resampleSource(c)===key,disabled:!enabled,onClick:()=>patch(c.id,{parameterSource:key})},label)));
 const postBaseMode=customModel.modelConfig?.mode||currentModelSetup.modelConfig?.mode||'checkpoint',baseOptions=postBaseMode==='diffusion'?diffusions:ckpts;
 const postBaseName=postBaseMode==='diffusion'?(customModel.modelConfig?.main||currentModelSetup.modelConfig?.main||''):(customModel.ckpt||currentModelSetup.ckpt||'');
 const postClip=customModel.clip??currentModelSetup.clip??'',postVae=customModel.vae??currentModelSetup.vae??'',postLoras=Array.isArray(customModel.loras)?customModel.loras:(currentModelSetup.loras||[]);
 const postModelLabel=name=>{const parts=String(name||'').split(/[\\/]/);return (parts.pop()||'').replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|onnx|sft)$/i,'');};
 const updateCustomModel=(delta)=>onChange({...value,modelSource:'custom',customModelSetup:{...currentModelSetup,...customModel,...delta},...(value.inpaint?{inpaint:{...value.inpaint,parameterSource:'custom'}}:null)});
 const choosePostBase=name=>updateCustomModel(postBaseMode==='diffusion'?{modelConfig:{...(customModel.modelConfig||currentModelSetup.modelConfig),main:name}}:{ckpt:name});
 const optionList=(rows,current)=>{const values=[...new Set([...(rows||[]).map(v=>typeof v==='string'?v:v?.name).filter(Boolean),current].filter(Boolean))];return [{value:'',label:'不使用'},...values.map(v=>({value:v,label:v}))];};
 const modelPickRow=(kind,label,value,onSelect)=>h('div',{className:'cc-generation-lora-model-wrap cc-post-model-pick'},
  h('span',{className:'cc-generation-field-label'},label),
  h('button',{type:'button',className:'cc-generation-lora-model-select',style:S.btn2,'aria-label':(value?'更换 ':'选择 ')+label,onPointerEnter:e=>{const button=e.currentTarget,pop=button.closest('.cc-generation-lora-model-wrap')?.querySelector('.cc-generation-lora-preview-popover');if(!pop)return;const place=()=>{const rect=button.getBoundingClientRect();pop.style.left=Math.max(8,rect.left-pop.offsetWidth-10)+'px';pop.style.top=(rect.top+rect.height/2)+'px';};place();requestAnimationFrame(place);},onClick:()=>{if(onPickModel)onPickModel(kind,value||'',item=>onSelect(item.name||''))}},h('span',{className:'cc-generation-lora-name',title:value||''},value||'选择模型'),h(PromptIcon,{name:'chevronDown',size:12})),
  h('span',{className:'cc-generation-lora-preview-popover','aria-hidden':'true'},value?h(ModelDockAsset,{kind,name:value,revision:modelDockRevision,variant:'lora-hover'}):h('span',{className:'cc-generation-lora-preview-empty'},h(PromptIcon,{name:'image',size:22}),h('span',null,'暂无预览图'))));
 const resampleModelSettings=c=>{const cs=c.customModelSetup||{},src=resampleSource(c),orig=sourceOutputParams||{},base=src==='custom'?{...currentModelSetup,...cs}:src==='original'?{...currentModelSetup,...orig}:currentModelSetup,baseMode=base.modelConfig?.mode||currentModelSetup.modelConfig?.mode||'checkpoint',opts=baseMode==='diffusion'?diffusions:ckpts,baseName=baseMode==='diffusion'?(base.modelConfig?.main||''):(base.ckpt||''),upd=delta=>patch(c.id,{parameterSource:'custom',customModelSetup:{...cs,...delta}});
  const loraRows=(Array.isArray(cs.loras)?cs.loras:[]).map((l,i)=>h('div',{key:'res-lora-'+i,className:'cc-post-model-lora-row'},
   h('label',{style:S.field},modelPickRow('lora','LoRA 模型',l.name||'',name=>upd({loras:(cs.loras||[]).map((it,ix)=>ix===i?{...it,name}:it)}))),
   h('label',{style:S.field},h('span',{style:S.label},'LoRA 强度'),h(DraggableNumberInput,{value:l.model??1,min:-10,max:10,step:.05,precision:2,dragPerPixel:.01,label:'二次采样 LoRA 强度 '+c.id,onChange:v=>upd({loras:(cs.loras||[]).map((it,ix)=>ix===i?{...it,model:v}:it)})})),
   h('label',{style:S.field},h('span',{style:S.label},'CLIP 强度'),h(DraggableNumberInput,{value:l.clip??l.model??1,min:-10,max:10,step:.05,precision:2,dragPerPixel:.01,label:'二次采样 LoRA CLIP '+c.id,onChange:v=>upd({loras:(cs.loras||[]).map((it,ix)=>ix===i?{...it,clip:v}:it)})})),
   h('button',{type:'button',className:'cc-post-model-lora-remove','aria-label':'移除 LoRA',onClick:()=>upd({loras:(cs.loras||[]).filter((_,ix)=>ix!==i)})},h(PromptIcon,{name:'trash',size:14}))));
  return h('div',{className:'cc-post-model-settings cc-post-resample-model'},
   h('div',{className:'cc-post-model-summary'},h('strong',null,'模型与采样设置'),h('span',{className:'cc-post-model-summary-note'},src==='custom'?'自定义模型':src==='original'?'原图参数':'工作流 · '+postModelLabel(baseName))),
   h('div',{className:'cc-post-model-settings-body'},
    h('div',{className:'cc-post-custom-model-grid'},
     h('label',{style:S.field},modelPickRow('checkpoint','底模',baseName,name=>upd({ckpt:name}))),
     h('label',{style:S.field},h('span',{style:S.label},'Text Encoder'),h(SelectMenu,{theme,label:'二次采样 Text Encoder',value:base.clip||'',options:optionList(clips,base.clip||''),onChange:v=>upd({clip:v}),minWidth:0})),
     h('label',{style:S.field},h('span',{style:S.label},'VAE'),h(SelectMenu,{theme,label:'二次采样 VAE',value:base.vae||'',options:optionList(vaes,base.vae||''),onChange:v=>upd({vae:v}),minWidth:0})),
     h('label',{style:S.field},h('span',{style:S.label},'步数'),h(DraggableNumberInput,{value:base.steps??20,min:1,max:10000,step:1,precision:0,dragPerPixel:1,label:'二次采样步数 '+c.id,onChange:v=>upd({steps:v})})),
     h('label',{style:S.field},h('span',{style:S.label},'CFG'),h(DraggableNumberInput,{value:base.cfg??6,min:0,max:100,step:.1,precision:1,dragPerPixel:.05,label:'二次采样 CFG '+c.id,onChange:v=>upd({cfg:v})})),
     h('label',{style:S.field},h('span',{style:S.label},'采样器'),h(SelectMenu,{theme,label:'二次采样采样器 '+c.id,value:base.sampler||'',options:samplers,onChange:v=>upd({sampler:v}),minWidth:0})),
     h('label',{style:S.field},h('span',{style:S.label},'调度器'),h(SelectMenu,{theme,label:'二次采样调度器 '+c.id,value:base.scheduler||'',options:schedulers,onChange:v=>upd({scheduler:v}),minWidth:0})),
     h('div',{className:'cc-post-model-loras'},h('div',{className:'cc-post-model-lora-head'},h('strong',null,'LoRA'),h('button',{type:'button',style:S.btn2,onClick:()=>upd({loras:[...(cs.loras||[]),{name:'',model:1,clip:1,enabled:true}]})},h(PromptIcon,{name:'plus',size:13}),'添加 LoRA')),...loraRows))));
 };
 const modelSettingsCell=h('details',{className:'cc-post-cell cc-post-model-settings','data-kind':'model-settings'},
  h('summary',{className:'cc-post-model-summary'},h('span',{className:'cc-post-model-chevron'},h(PromptIcon,{name:'chevronDown',size:14})),h('strong',null,'模型与采样设置'),h('span',{className:'cc-post-model-summary-note'},modelSource==='custom'?'自定义模型':modelSource==='original'?'原图参数':'工作流 · '+postModelLabel(postBaseName||'未选择'))),
  h('div',{className:'cc-post-model-settings-body'},
   h('div',{className:'cc-post-custom-model-grid'},
    modelPickRow('checkpoint',postBaseMode==='diffusion'?'底模文件':'底模',postBaseName,choosePostBase),
    h('label',{style:S.field},h('span',{style:S.label},'Text Encoder'),h(SelectMenu,{theme,label:'生成后控制 Text Encoder',value:postClip,options:optionList(clips,postClip),onChange:v=>updateCustomModel({clip:v}),minWidth:0,forceSearch:true})),
    h('label',{style:S.field},h('span',{style:S.label},'VAE'),h(SelectMenu,{theme,label:'生成后控制 VAE',value:postVae,options:optionList(vaes,postVae),onChange:v=>updateCustomModel({vae:v}),minWidth:0,forceSearch:true})),
    h('label',{style:S.field},h('span',{style:S.label},'步数'),h(DraggableNumberInput,{value:customModel.steps??currentModelSetup.steps??20,min:1,max:10000,step:1,precision:0,dragPerPixel:1,label:'生成后控制步数',onChange:v=>updateCustomModel({steps:v})})),
    h('label',{style:S.field},h('span',{style:S.label},'CFG'),h(DraggableNumberInput,{value:customModel.cfg??currentModelSetup.cfg??6,min:0,max:100,step:.1,precision:1,dragPerPixel:.05,label:'生成后控制 CFG',onChange:v=>updateCustomModel({cfg:v})})),
    h('label',{style:S.field},h('span',{style:S.label},'采样器'),h(SelectMenu,{theme,label:'生成后控制采样器',value:customModel.sampler||currentModelSetup.sampler||'',options:samplers,onChange:v=>updateCustomModel({sampler:v}),minWidth:0})),
    h('label',{style:S.field},h('span',{style:S.label},'调度器'),h(SelectMenu,{theme,label:'生成后控制调度器',value:customModel.scheduler||currentModelSetup.scheduler||'',options:schedulers,onChange:v=>updateCustomModel({scheduler:v}),minWidth:0})),
    h('div',{className:'cc-post-model-loras'},h('div',{className:'cc-post-model-lora-head'},h('strong',null,'LoRA'),h('button',{type:'button',style:S.btn2,onClick:()=>updateCustomModel({loras:[...postLoras,{name:'',model:1,clip:1,enabled:true}]})},h(PromptIcon,{name:'plus',size:13}),'添加 LoRA')),
     ...postLoras.map((l,i)=>h('div',{key:'post-lora-'+i,className:'cc-post-model-lora-row'},modelPickRow('lora','LoRA 模型',l.name||'',name=>updateCustomModel({loras:postLoras.map((item,index)=>index===i?{...item,name}:item)})),h('label',{style:S.field},h('span',{style:S.label},'LoRA 强度'),h(DraggableNumberInput,{value:l.model??1,min:-10,max:10,step:.05,precision:2,dragPerPixel:.01,label:'生成后控制 LoRA 强度',onChange:v=>updateCustomModel({loras:postLoras.map((item,index)=>index===i?{...item,model:v}:item)})})),h('label',{style:S.field},h('span',{style:S.label},'CLIP 强度'),h(DraggableNumberInput,{value:l.clip??l.model??1,min:-10,max:10,step:.05,precision:2,dragPerPixel:.01,label:'生成后控制 LoRA CLIP 强度',onChange:v=>updateCustomModel({loras:postLoras.map((item,index)=>index===i?{...item,clip:v}:item)})})),h('button',{type:'button',className:'cc-post-model-lora-remove','aria-label':'移除 LoRA',onClick:()=>updateCustomModel({loras:postLoras.filter((_,index)=>index!==i)})},h(PromptIcon,{name:'trash',size:14}))))))));
 const __pcBody=expanded?h('div',{className:'cc-post-workbench-body'},
 error?h('div',{role:'alert',style:S.bad},error):null,
 !installLoading&&install&&install.online===true&&!install.bridge&&!bridgeSkipped?h('div',{className:'cc-post-bridge-prompt',role:'status'},
  h('div',null,h('strong',null,'缺少 DSH 图像桥接节点'),h('span',null,'AI 阶段顺序、动态尺寸/倍率需要 DSHPostScale、DSHPostStage、DSHPostImageSize。安装后必须重启 ComfyUI 才会加载，正在生成的任务会被中断。')),
  h('div',{className:'cc-post-bridge-actions'},
   h('button',{type:'button',style:S.btn,disabled:bridgeBusy,onClick:installBridge},bridgeBusy?'正在安装并重启 ComfyUI…':'重启 ComfyUI 并安装'),
   h('button',{type:'button',style:S.btn2,disabled:bridgeBusy,onClick:()=>{postBridgePromptSkipped=true;setBridgeSkipped(true);}},'暂时跳过'))):null,
 bridgeBusy||installLoading?h('div',{role:'status',style:S.dim},bridgeBusy?'正在安装并重启 ComfyUI…':'正在后台检查本地安装，可继续编辑工作流'):null,
 install?.log?h('details',null,h('summary',null,'安装记录'),h('pre',{className:'cc-post-log'},install.log)):null,
 bridgeSkipped&&install?.online&&!install.bridge?h('button',{type:'button',style:S.btn2,disabled:bridgeBusy||install?.running,onClick:()=>{postBridgePromptSkipped=false;setBridgeSkipped(false);}},'安装桥接节点'):null,
  h('div',{className:'cc-post-notebook'},h(PostLibraryPane,{cells,library,onAdd:addCell,onCreate:()=>onCreateWorkflow(setError),split:postSplit,setSplit:setPostSplit,onResize:startPostResize,installBusy:!!install?.running,installStart:()=>setup(false),installStop:async()=>{try{setInstall(await jpost(EXPANDER+'/post/dependencies/cancel',{},10000));}catch(e){setError(errText(e));}},onAddInpaint:()=>{if(value.inpaint)return;onChange({...value,inpaint:{enabled:true,asset:value.input?.asset||null,original:value.input?.original||null,mask:null,coverage:0,denoise:.65,grow:0,feather:8}})},kinds:new Set(cells.map(c=>c.kind)),inpaintAdded:!!value.inpaint}),
  h('div',{className:'cc-post-cells','data-cc-guide':'post-cells'},h(PostImageInput,{value,onChange,theme,resultUrl,processing,samplers,schedulers,stepCount:Number(currentModelSetup.steps),cfgValue:Number(currentModelSetup.cfg),samplerValue:currentModelSetup.sampler,schedulerValue:currentModelSetup.scheduler,modelSettings:modelSettingsCell,outputItems:outputItems||[],onLoadOutputs,historyLoading,online}),!cells.length?h('div',{className:'cc-post-empty-drop'},'添加一个处理步骤，开始处理图片。'):null,
 cells.map((c,i)=>h('section',{key:c.id,className:'cc-post-cell'+(draggingKey===c.id?' is-dragging':dragOverKey===c.id?' is-drop-'+dragDropPos:''),'data-kind':c.kind,'data-disabled':c.enabled===false,onDragOver:e=>{e.preventDefault();e.dataTransfer.dropEffect='move';dragAutoScroll(e);const r=e.currentTarget.getBoundingClientRect(),pos=e.clientY<r.top+r.height/2?'before':'after';if(dragOverKey!==c.id||dragDropPos!==pos){setDragOverKey(c.id);setDragDropPos(pos);}},onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget)){setDragOverKey(cur=>cur===c.id?null:cur);stopDragAutoScroll();}},onDrop:e=>{e.preventDefault();stopDragAutoScroll();const from=drag.current;drag.current=null;setDraggingKey(null);setDragOverKey(null);if(from==null||from===i)return;const next=[...cells],cell=next.splice(from,1)[0];let insertAt=next.findIndex(x=>x.id===c.id);if(insertAt<0)insertAt=next.length;if(dragDropPos==='after')insertAt+=1;next.splice(insertAt,0,cell);onChange({...value,cells:next});}},
 h(CellHead,{index:i+1,title:c.kind==='workflow'?c.workflow?.name||POST_KINDS.workflow:POST_KINDS[c.kind],
  enabled:c.enabled!==false,onToggle:v=>patch(c.id,{enabled:v}),
  dragHandlers:{onDragStart:e=>{drag.current=i;setDraggingKey(c.id);e.dataTransfer.setData('text/plain',c.id);e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setDragImage(e.currentTarget.closest('.cc-post-cell'),24,16);}catch{}},onDragEnd:()=>{drag.current=null;setDraggingKey(null);setDragOverKey(null);stopDragAutoScroll();}},
  canUp:i>0,canDown:i<cells.length-1,
  onUp:()=>onChange({...value,cells:movePostCell(cells,i,-1)}),onDown:()=>onChange({...value,cells:movePostCell(cells,i,1)}),
  onRemove:()=>onChange({...value,cells:cells.filter((x,k)=>k!==i)})}),
 h('div',{className:'cc-post-cell-fields'},
 c.kind==='upscale'?h('div',{className:'cc-post-param-group','data-layout':'upscale'},select(c,'model','放大模型',upscalers),num(c,'factor','倍率',.1,8,.01)):null,
 c.kind==='resample'?h(React.Fragment,null,
  h('div',{className:'cc-post-param-group','data-layout':'pair'},resampleSourceBar(c),num(c,'denoise','降噪强度',0,1,.01,true)),
  h('div',{className:'cc-post-cell-prompts'},
   h('label',{style:S.field},h('span',{style:S.label},'提示词'),h('textarea',{value:c.prompt||'',placeholder:'留空则跟随工作流提示词',onChange:e=>patch(c.id,{prompt:e.target.value})})),
   h('label',{style:S.field},h('span',{style:S.label},'负面提示词'),h('textarea',{value:c.negative||'',placeholder:'留空则跟随工作流负面提示词',onChange:e=>patch(c.id,{negative:e.target.value})}))),
  resampleModelSettings(c)):null,
 c.kind==='face'?h(React.Fragment,null,
  h('div',{className:'cc-post-param-group','data-layout':'pair'},resampleSourceBar(c),num(c,'denoise','降噪强度',.0001,1,.01,true)),
  h('div',{className:'cc-post-cell-prompts'},
   h('label',{style:S.field},h('span',{style:S.label},'提示词'),h('textarea',{value:c.prompt||'',placeholder:'留空则跟随工作流提示词',onChange:e=>patch(c.id,{prompt:e.target.value})})),
   h('label',{style:S.field},h('span',{style:S.label},'负面提示词'),h('textarea',{value:c.negative||'',placeholder:'留空则跟随工作流负面提示词',onChange:e=>patch(c.id,{negative:e.target.value})}))),
  resampleModelSettings(c)):null,
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
   h('button',{type:'button',style:S.btn2,onClick:()=>onEditWorkflow(c,setError)},'编辑工作流'),
   c.workflow?.id?h('button',{type:'button',style:S.btn2,onClick:async()=>{if(!await pcShowConfirm({title:'删除工作流',message:'从已保存工作流中删除？当前单元格副本会保留。'}))return;try{await jpost(EXPANDER+'/post/workflows/delete',{id:c.workflow.id},10000);setLibrary(rows=>rows.filter(w=>w.id!==c.workflow.id));patch(c.id,{workflow:{...c.workflow,id:undefined}});}catch(e){setError(errText(e));}}},'删除已保存工作流'):null)):null))))),
  h('div',{className:'cc-post-workbench-footer'},h('button',{type:'button',className:'cc-post-start',style:S.btn,disabled:processing,onClick:e=>{flyJobToTask(e?.currentTarget,'处理');onProcess?.(value.input);}},processing?'正在处理…':'开始处理'))
 ):null;
 return h(React.Fragment,null,embedded?h(React.Fragment,null,h('style',null,POST_MODULE_CSS),__pcBody):h('section',{className:'cc-workbench-module cc-post-workbench','data-module':'post','data-cc-guide':'post-panel'},h('style',null,POST_MODULE_CSS),
  h('header',{className:'cc-workbench-module-head cc-post-workbench-head',ref:headRef,'aria-expanded':expanded,onClick:e=>{if(e.target.closest('button,label,input,a,textarea,select'))return;toggleExpanded();}},h('span',{className:'cc-post-workbench-title'},h(PromptIcon,{name:'grip',size:14}),h('span',null,'生成后控制')),h('div',{className:'cc-post-workbench-tools'},h(PostAutoSwitch,{checked:value.autoExecute!==false,label:'自动执行',onChange:checked=>onChange({...value,autoExecute:checked})}),h('span',{className:'cc-post-workbench-count'},(cells.filter(c=>c.enabled!==false).length+(value.inpaint?.enabled!==false&&value.inpaint?1:0))+' 个图片处理'),h('button',{type:'button',className:'cc-post-collapse',title:expanded?'收起生成后控制':'展开生成后控制','aria-label':expanded?'收起生成后控制':'展开生成后控制','aria-expanded':expanded,onClick:e=>{e.stopPropagation();toggleExpanded();}},h(PromptIcon,{name:'chevronDown',size:16})))),
   __pcBody),
 pcConfirm?h(OverlayModal,{title:pcConfirm.title||'确认',width:420,theme,zIndex:2147481600,onClose:()=>{const r=pcConfirm.resolve;setPcConfirm(null);r&&r(false);}},h('div',{style:{display:'flex',flexDirection:'column',gap:12}},h('p',{style:{margin:0,lineHeight:1.6,fontSize:'13px'}},pcConfirm.message),h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8}},h('button',{type:'button',style:S.btn2,onClick:()=>{const r=pcConfirm.resolve;setPcConfirm(null);r&&r(false);}},'取消'),h('button',{type:'button',style:S.btn,onClick:()=>{const r=pcConfirm.resolve;setPcConfirm(null);r&&r(true);}},'确定')))):null);
}
