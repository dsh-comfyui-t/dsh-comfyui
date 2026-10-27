// Online model browser. Uses the existing React, SelectMenu and OverlayModal.
function onlineBytes(value) {
    const n=Number(value)||0;if(!n)return '未知大小';
    const units=['B','KB','MB','GB','TB'];let x=n,i=0;
    while(x>=1024 && i<units.length-1){x/=1024;i++;}
    return x.toFixed(i>1?2:0)+' '+units[i];
}
function onlineCount(value) {const n=Number(value)||0;return n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(n);}
async function onlineRequest(path,body,signal) {
    const ctl=new AbortController(),abort=()=>ctl.abort();
    if(signal?.aborted)ctl.abort();else signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,45000);
    try{
        // X-Console-Client 必须带：本地侧车的 _auth_ok() 靠它放行，缺了就 401
        // "missing or bad X-Console-Token"（A 线原版没这个要求，合并过来才暴露）。
        // 注意本文件在 app.js 之前拼接，CONSOLE_HEADERS 还没初始化，这里写字面量。
        const response=await fetch(EXPANDER+'/online/'+path,{method:body===undefined?'GET':'POST',signal:ctl.signal,
            headers:Object.assign({'X-Console-Client':'1'},body===undefined?{}:{'Content-Type':'application/json'}),
            ...(body===undefined?{}:{body:JSON.stringify(body)})});
        let data;try{data=await response.json();}catch{throw new Error('在线模型服务返回异常，请完整重启 DSH 和 sidecar');}
        if(!response.ok)throw new Error(data.error || '请求失败（HTTP '+response.status+'）');
        return data;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
const ONLINE_ACCESS_CACHE=new Map();
// 记住上次选的来源与筛选：Civitai/HF 在无代理的国内网络下必然超时，
// 每次刷新都退回 civitai 等于每次都要重新踩一遍墙。只存筛选字段，不存结果缓存。
// v2：默认来源由 civitai 改为 modelscope（本机实测 civitai/HF/hf-mirror 全部超时，
//     仅魔搭 0.3s 可达）。带版本号是为了让升级前的旧值（provider=civitai）自动作废，
//     否则用户不做任何操作就还是踩墙。
const ONLINE_QUERY_KEY='dsh-comfyui-console/online-query';
const ONLINE_QUERY_VERSION=2;
const ONLINE_DEFAULT_QUERY={provider:'modelscope',q:'',type:'',base:'',sort:'Most Downloaded',period:'AllTime',nsfw:false};
function readOnlineQuery(){
    try{
        const raw=window.localStorage.getItem(ONLINE_QUERY_KEY);
        const o=raw?JSON.parse(raw):null;
        if(!o||typeof o!=='object')return {};
        if(o.v!==ONLINE_QUERY_VERSION)return {};            // 旧结构作废，回默认
        return o.query&&typeof o.query==='object'?o.query:{};
    }catch(e){return {};}
}
function saveOnlineQuery(q){
    try{window.localStorage.setItem(ONLINE_QUERY_KEY,JSON.stringify({v:ONLINE_QUERY_VERSION,query:q}));}
    catch(e){/* 隐私模式/超配额忽略 */}
}
const ONLINE_SESSION={query:Object.assign({},ONLINE_DEFAULT_QUERY,readOnlineQuery()),completed:null,cache:null};
// Values are source API identifiers; display labels may include a searchable family name.
const ONLINE_BASE_GROUPS=[
    ['SDXL',['SDXL 0.9','SDXL 1.0','SDXL 1.0 LCM','SDXL Lightning','SDXL Hyper','SDXL Turbo','SDXL Distilled','Illustrious','NoobAI','Pony','Pony V7','Playground v2']],
    ['SD 1.x',['SD 1.4','SD 1.5','SD 1.5 LCM','SD 1.5 Hyper']],
    ['SD 2.x',['SD 2.0','SD 2.0 768','SD 2.1','SD 2.1 768','SD 2.1 Unclip']],
    ['SD 3.x',['SD 3','SD 3.5','SD 3.5 Large','SD 3.5 Large Turbo','SD 3.5 Medium']],
    ['FLUX',['Flux.1 S','Flux.1 D','Flux.1 Krea','Flux.1 Kontext','Flux.2 D','Flux.2 Klein 9B','Flux.2 Klein 9B-base','Flux.2 Klein 4B','Flux.2 Klein 4B-base']],
    ['图像 Image',['Anima','MOSS Image','Chroma','HiDream','HiDream-O1','Hunyuan 1','Kolors','Krea 2','Krea 2 Turbo','Krea 3','Lumina','PixArt a','PixArt E','Qwen','Qwen 2','Qwen 2.1','Qwen 3','Stable Cascade','ZImageTurbo','ZImageBase']],
    ['视频 Video',['CogVideoX','Hunyuan Video','LTXV','LTXV2','LTXV 2.3','LTXV 2.5','Mochi','SVD','SVD XT','Wan Video','Wan Video 1.3B t2v','Wan Video 14B t2v','Wan Video 14B i2v 480p','Wan Video 14B i2v 720p','Wan Video 2.2 TI2V-5B','Wan Video 2.2 I2V-A14B','Wan Video 2.2 T2V-A14B','Wan Video 2.5 T2V','Wan Video 2.5 I2V']],
    ['其他 Other',['Upscaler','Other']]
];
const ONLINE_BASES=ONLINE_BASE_GROUPS.flatMap(([,names])=>names);
function onlineNameCompare(a,b){return String(a).localeCompare(String(b),'en',{sensitivity:'base',numeric:true});}
const ONLINE_BASE_QUICK=['SDXL 1.0','Illustrious','Pony','Anima'].sort(onlineNameCompare);
const ONLINE_TYPES=[['','全部'],['Checkpoint','Checkpoint'],['LORA','LoRA'],['LoCon','LoCon'],['DoRA','DoRA'],
    ['UNet','UNet'],['VAE','VAE'],['TextEncoder','Text Encoder'],['CLIP','CLIP'],['CLIPVision','CLIP Vision'],
    ['TextualInversion','Embedding'],['Controlnet','ControlNet'],['Upscaler','Upscaler'],
    ['Hypernetwork','Hypernetwork'],['AestheticGradient','Aesthetic Gradient'],['MotionModule','Motion Module'],
    ['Detection','Detection'],['VisionLanguage','Vision Language'],['LLM','LLM'],
    ['Poses','Poses'],['Wildcards','Wildcards'],['Workflows','Workflows'],['ComfyWorkflows','ComfyUI Workflows'],['Other','Other']].sort((a,b)=>!a[0]?-1:!b[0]?1:onlineNameCompare(a[1],b[1]));
const ONLINE_BASE_NAMES=[...new Set(ONLINE_BASE_GROUPS.flatMap(([,names])=>names))].sort(onlineNameCompare);
function onlineTypeLabel(value){const row=ONLINE_TYPES.find(x=>x[0]===value);return row?row[1]:value;}
function onlineAccessLabel(model){if(model?.early_access)return 'Early Access';if(model?.gated)return '需授权';return '';}
function onlineDefaultTarget(model,version,file,targets) {
    const path=String(file?.remote_path||'').toLowerCase(),base=String(version?.base_model||'').toLowerCase();
    const fileType=String(file?.type||'').toLowerCase();
    const fileKind=/vae/.test(fileType)?'vae':/(diffusion|unet)/.test(fileType)?'diffusion':/(text.?encoder|clip)/.test(fileType)?'clip':'';
    const explicit=({LORA:'lora',LoCon:'lora',DoRA:'lora',UNet:'diffusion',TextEncoder:'clip','Text Encoder':'clip',CLIP:'clip',VAE:'vae',Controlnet:'controlnet',TextualInversion:'embedding',Upscaler:'upscale'})[model.type]||'';
    let kind=/(^|\/)(text_encoders?|clip)\//.test(path)?'clip':/(^|\/)vae\//.test(path)?'vae':/(^|\/)(diffusion_models|unet)\//.test(path)?'diffusion':'';
    if(!kind)kind=explicit||(model.type==='Checkpoint'?(fileKind||(fileType?'checkpoint':(/anima|moss|flux|qwen|sd.?3|lumina|z.?image/.test(base)?'diffusion':'checkpoint'))):'');
    const target=targets.find(t=>t.kind===kind);return target?target.kind+':'+target.root_id:'';
}
function OnlineBaseFilter({provider,value,onChange,theme}) {
    const tags=String(value||'').split(',').map(v=>v.trim()).filter(Boolean);
    const [draft,setDraft]=React.useState(''),[open,setOpen]=React.useState(false),[rect,setRect]=React.useState(null);
    const composing=React.useRef(false),inputRef=React.useRef(null),popoverRef=React.useRef(null);
    const multiple=provider==='civitai';
    const options=(provider==='civitai'?ONLINE_BASE_NAMES:[]).filter(v=>!tags.includes(v)&&v.toLowerCase().includes(draft.trim().toLowerCase())).slice(0,80);
    const place=()=>{const node=inputRef.current,box=node?.getBoundingClientRect?.(),vh=(typeof window!=='undefined'?window.innerHeight:900),height=Math.min(240,Math.max(120,vh-16));let top=(box?.bottom??64)+4;if(top+height>vh-8)top=Math.max(8,(box?.top??64)-height-4);setRect({left:box?.left??12,top,width:Math.max(220,Math.min(box?.width??260,(typeof window!=='undefined'?window.innerWidth:1200)-24))});setOpen(true);};
    const commit=v=>{const text=String(v||'').trim();if(!text)return;const next=multiple?[...new Set([...tags,text])]:[text];onChange(next.join(','));setDraft('');setOpen(false);};
    const remove=v=>onChange(tags.filter(x=>x!==v).join(','));
    React.useEffect(()=>{
        if(!open)return;
        const close=e=>{if(popoverRef.current?.contains(e.target)||inputRef.current?.contains(e.target))return;setOpen(false);};
        const hide=e=>{if(popoverRef.current?.contains(e?.target))return;setOpen(false);};
        document.addEventListener('mousedown',close,true);
        document.addEventListener('scroll',hide,true);
        window.addEventListener('resize',hide);
        return()=>{document.removeEventListener('mousedown',close,true);document.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);};
    },[open]);
    const menu=open&&(options.length||draft.trim())?floating(h('div',{ref:popoverRef,className:'dsh-comfy-floating cc-online-base-popover',style:{...(theme||{}),zIndex:2147481000,left:rect?.left??12,top:rect?.top??64,width:rect?.width??260,background:'var(--cc-surface, #1b1d22)',border:'1px solid var(--cc-border, #3a3f4a)',borderRadius:'7px',color:'var(--cc-text, #e8eaf0)',boxShadow:'0 10px 28px rgba(0,0,0,.28)',overflow:'hidden'},onMouseDown:e=>e.preventDefault()},
        h('div',{className:'cc-online-base-menu',role:'listbox','aria-label':'基底模型候选',style:{maxHeight:'min(240px, calc(100vh - 18px))',overflowY:'auto',overscrollBehavior:'contain',background:'var(--cc-surface, #1b1d22)',color:'var(--cc-text, #e8eaf0)',padding:'4px'}},
            draft.trim()&&!options.includes(draft.trim())?h('button',{type:'button',className:'cc-online-base-option',onClick:()=>commit(draft)},'+ 使用“'+draft.trim()+'”'):null,
            ...options.map(v=>h('button',{key:v,type:'button',className:'cc-online-base-option',onClick:()=>commit(v)},v))))):null;
    return h(React.Fragment,null,
        h('div',{className:'cc-online-filter-group cc-online-base-group'},
            h('div',{className:'cc-online-filter-heading'},h('strong',null,provider==='civitai'?'基底模型':'基底模型仓库')),
            h('div',{className:'cc-online-base-picker'},
                ...tags.map(tag=>h('span',{key:tag,className:'cc-online-base-tag'},tag,
                    h('button',{type:'button','aria-label':'移除基底模型 '+tag,onClick:()=>remove(tag)},'×'))),
                h('input',{ref:inputRef,value:draft,'aria-label':'输入或选择基底模型','aria-expanded':open,
                    placeholder:tags.length?'继续添加…':'输入或选择基底模型…',
                    onFocus:place,onClick:place,onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;},
                    onChange:e=>{setDraft(e.target.value);if(!open)place();},
                    onKeyDown:e=>{
                        if(e.key==='Backspace'&&!draft&&tags.length){remove(tags[tags.length-1]);return;}
                        if(e.key==='Enter'&&!composing.current&&!e.isComposing&&e.keyCode!==229){e.preventDefault();commit(options[0]||draft);}
                        if(e.key==='Escape'){setOpen(false);}
                    }}))),
        menu);
}
const ONLINE_PAGE_SIZE=24;
function onlineMergePages(prev,next){
    const seen=new Set((prev?.items||[]).map(m=>m.provider+':'+m.id));
    const items=[...(prev?.items||[]),...((next?.items||[]).filter(m=>!seen.has(m.provider+':'+m.id)))];
    return {...next,items,page:next?.page||prev?.page||1};
}

const ONLINE_CSS=`
.dsh-comfy-ui .cc-online-page{display:flex;flex:1 1 0;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:hidden}
.dsh-comfy-ui .cc-online-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:none;padding:9px 10px;border:1px solid var(--cc-border);border-radius:10px;background:var(--cc-surface);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.dsh-comfy-ui .cc-online-toolbar>.cc-select-trigger{width:190px;flex:0 0 190px}
.dsh-comfy-ui .cc-online-search{display:flex;gap:6px;flex:1;min-width:200px}
.dsh-comfy-ui .cc-online-search input{flex:1;min-width:0}
.dsh-comfy-ui .cc-online-layout{display:grid;grid-template-columns:218px minmax(0,1fr);gap:20px;min-width:0;min-height:0;flex:1 1 0;overflow:hidden;align-items:stretch}
.dsh-comfy-ui .cc-online-sidebar{border-right:1px solid var(--cc-border);padding:2px 15px 12px 1px;min-width:0;min-height:0;height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;-ms-overflow-style:none}
.dsh-comfy-ui .cc-online-sidebar::-webkit-scrollbar{display:none;width:0;height:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filters{display:flex;flex-direction:column;gap:17px;min-width:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-field{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:12px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-field>input{width:100%!important;box-sizing:border-box;min-width:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-field>.cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;max-width:100%;width:100%;min-width:0!important;text-align:left}
.dsh-comfy-floating .cc-online-field .cc-select-label{display:block;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-group{display:flex;flex-direction:column;gap:9px;font-size:12px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-chips{display:flex;gap:6px;flex-wrap:wrap}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-chip{border:1px solid var(--cc-border);border-radius:16px;background:var(--cc-control);color:var(--cc-muted);padding:5px 9px;font:inherit;font-size:12px;cursor:pointer}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-chip[aria-pressed="true"]{border:1px solid var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-chip:hover{color:var(--cc-text)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-clear{padding:2px 0;border:0;background:transparent;color:var(--cc-muted);font:inherit;font-size:11px;cursor:pointer}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-clear:hover{color:var(--cc-accent-text)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-custom-base{min-width:0;color:var(--cc-muted);font-size:11px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-custom-base>summary{cursor:pointer;width:fit-content}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-custom-base[open]>summary{margin-bottom:7px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-custom{display:flex;gap:5px;min-width:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-custom>input{flex:1 1 0;min-width:0;width:0!important;box-sizing:border-box}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-custom>button{flex:none;padding:6px 8px;min-height:32px}
.dsh-comfy-ui .cc-online-results{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;height:100%;overflow:hidden}
.dsh-comfy-ui .cc-online-results-scroll{flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding:2px 7px 12px 2px}
.dsh-comfy-ui .cc-online-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-content:start}
.dsh-comfy-ui .cc-online-model-card{border:1px solid var(--cc-border);padding:0;border-radius:8px;overflow:hidden;min-width:0;text-align:left;background:var(--cc-surface);color:var(--cc-text);font:inherit;cursor:pointer;display:flex;flex-direction:column}
.dsh-comfy-ui .cc-online-model-card:hover{border:1px solid var(--cc-accent);background:color-mix(in srgb,var(--cc-surface) 88%,var(--cc-accent-bg));transform:translateY(-1px);box-shadow:0 7px 20px rgba(0,0,0,.13)}
.dsh-comfy-ui .cc-online-model-card:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-ui .cc-online-card-media{position:relative;aspect-ratio:3/4;max-height:310px;width:100%;background:var(--cc-control);overflow:hidden}
.dsh-comfy-ui .cc-online-card-media>img,.dsh-comfy-ui .cc-online-card-media>.cc-online-no-image{width:100%;height:100%;object-fit:cover;display:flex}
.dsh-comfy-ui .cc-online-nsfw-badge{display:inline-flex;align-items:center;padding:4px 7px;border-radius:6px;background:rgba(180,40,55,.92);color:#fff;font-size:10px;font-weight:800;letter-spacing:.03em}
.dsh-comfy-ui .cc-online-card-media .cc-online-nsfw-badge{position:absolute;left:8px;bottom:8px}
.dsh-comfy-ui .cc-online-detail-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsh-comfy-ui .cc-online-access-badge{position:absolute;top:8px;right:8px;padding:4px 7px;border-radius:6px;background:rgba(176,96,20,.9);color:#fff;font-size:10px;font-weight:800;letter-spacing:.02em;backdrop-filter:blur(6px)}
.cc-online-access-warning{display:flex;flex-direction:column;gap:7px;padding:10px 11px;border:1px solid rgba(210,130,40,.55);border-radius:7px;background:rgba(210,130,40,.10);font-size:12px;line-height:1.55}
.cc-online-access-warning>strong{color:#e9a44b;font-size:12px}
.cc-online-access-warning>button{align-self:flex-start;padding:4px 8px;border:1px solid rgba(210,130,40,.6);border-radius:5px;background:transparent;color:var(--cc-text);font:inherit;font-size:11px;cursor:pointer}
.dsh-comfy-ui .cc-online-type-badge{position:absolute;top:8px;left:8px;padding:4px 7px;border-radius:6px;background:color-mix(in srgb,var(--cc-surface) 88%,transparent);backdrop-filter:blur(8px);color:var(--cc-text);font-size:10px;font-weight:700;border:1px solid color-mix(in srgb,var(--cc-border) 80%,transparent)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-no-image{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--cc-muted);font-size:12px;min-height:140px;background:var(--cc-control)}
.dsh-comfy-ui .cc-online-card-info{display:flex;flex-direction:column;gap:5px;padding:10px;min-width:0;width:100%;box-sizing:border-box}
.dsh-comfy-ui .cc-online-card-info>small{font-size:11px;color:var(--cc-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-comfy-ui .cc-online-card-info>strong{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:37px;overflow-wrap:anywhere}
.dsh-comfy-ui .cc-online-card-stats{font-size:11px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-online-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:260px;text-align:center;overflow-wrap:anywhere;padding:18px}
.dsh-comfy-ui .cc-online-loading{display:flex;align-items:center;flex-wrap:wrap;gap:10px;justify-content:center;padding:16px 10px;color:var(--cc-muted);font-size:13px;min-width:0}
.dsh-comfy-ui .cc-online-loading>button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;flex:none;white-space:nowrap;margin:0}
.dsh-comfy-floating .cc-online-downloads{display:flex;flex-direction:column;gap:10px;min-width:0}
.dsh-comfy-floating .cc-online-download-list{display:flex;flex-direction:column;gap:8px;max-height:none;overflow:visible;padding-right:0}
.dsh-comfy-floating .cc-online-download-summary{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:0 0 10px;border-bottom:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-online-download-summary>div{display:flex;flex-direction:column;gap:4px;min-width:0}
.dsh-comfy-floating .cc-online-download-counts{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-online-job{display:flex;flex-direction:column;gap:7px;padding:11px 12px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);font-size:12px;min-width:0}
.dsh-comfy-floating .cc-online-job-head{display:flex;align-items:center;gap:8px;min-width:0}
.dsh-comfy-floating .cc-online-job-status{flex:none;padding:3px 7px;border-radius:5px;background:var(--cc-border);color:var(--cc-text);font-size:10px;font-weight:700}
.dsh-comfy-floating .cc-online-job.is-running .cc-online-job-status,.dsh-comfy-floating .cc-online-job.is-verifying .cc-online-job-status,.dsh-comfy-floating .cc-online-job.is-queued .cc-online-job-status{background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-online-job.is-paused .cc-online-job-status{background:rgba(210,140,40,.18);color:#e0a04a}
.dsh-comfy-floating .cc-online-job.is-failed .cc-online-job-status{background:rgba(200,60,70,.18);color:#e58a91}
.dsh-comfy-floating .cc-online-job.is-completed .cc-online-job-status{background:rgba(50,160,100,.18);color:#78d0a0}
.dsh-comfy-floating .cc-online-job-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-online-job-message{font-size:11px;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-floating .cc-online-job.is-failed .cc-online-job-message{color:#e08a8a}
.dsh-comfy-floating .cc-online-job-path{font-size:10px;color:var(--cc-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,Consolas,monospace}
.dsh-comfy-floating .cc-online-job-progress{display:flex;flex-direction:column;gap:4px}
.dsh-comfy-floating .cc-online-job progress{width:100%;height:8px;accent-color:var(--cc-accent)}
.dsh-comfy-floating .cc-online-job-stats{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-online-job-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;padding-top:1px}
.dsh-comfy-floating .cc-online-job-action{padding:5px 9px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-surface);color:var(--cc-text);font:inherit;font-size:11px;cursor:pointer}
.dsh-comfy-floating .cc-online-job-action:hover{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-online-job-action.is-primary{border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-online-downloads .cc-online-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:180px;text-align:center;overflow-wrap:anywhere;padding:18px}
.dsh-comfy-ui .cc-online-more-status{text-align:center;padding:14px;color:var(--cc-muted);font-size:11px}
.dsh-comfy-ui .cc-online-filter-button{display:none;align-items:center;justify-content:center;font:inherit;font-size:12px;line-height:1.2;min-height:34px;height:34px;padding:0 10px;box-sizing:border-box;border-radius:6px!important;flex:none;width:auto;white-space:nowrap}
.dsh-comfy-floating .cc-online-network{display:flex;flex-direction:column;gap:12px;min-width:0}
.dsh-comfy-floating .cc-online-diagnostic-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsh-comfy-floating .cc-online-diagnostic-toolbar>.cc-select-trigger{display:flex;justify-content:space-between;gap:10px;flex:1;min-width:180px;max-width:100%}
.dsh-comfy-floating .cc-online-diagnostic-results{display:flex;flex-direction:column;gap:10px;padding-top:10px;border-top:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-online-diagnostic-row{display:flex;flex-direction:column;gap:5px;font-size:12px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-online-diagnostic-row>div{display:flex;gap:12px;justify-content:space-between}
.dsh-comfy-floating .cc-online-token-settings{border-top:1px solid var(--cc-border);padding-top:12px;font-size:12px}
.dsh-comfy-floating .cc-online-token-settings>summary{cursor:pointer;color:var(--cc-muted)}
.dsh-comfy-floating .cc-online-token-settings>div{margin-top:12px}
.dsh-comfy-floating .cc-online-detail{display:grid;grid-template-columns:minmax(0,42fr) minmax(0,58fr);gap:18px;min-width:0}
.dsh-comfy-floating .cc-online-detail-media{display:flex;flex-direction:column;gap:8px;min-width:0}
.dsh-comfy-floating .cc-online-detail-image{width:100%;height:450px;object-fit:contain;border-radius:7px;background:var(--cc-control)}
.dsh-comfy-floating .cc-online-detail-info{display:flex;flex-direction:column;gap:13px;min-width:0;padding-right:4px}
.dsh-comfy-floating .cc-online-detail-heading{display:flex;flex-direction:column;gap:7px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-online-detail-heading>strong{font-size:18px}
.dsh-comfy-floating .cc-online-image-controls{display:flex;align-items:center;justify-content:space-between;gap:5px;font-size:12px}
.dsh-comfy-floating .cc-online-trigger-words{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.dsh-comfy-floating .cc-online-trigger-words span{background:var(--cc-control);border:1px solid var(--cc-border);border-radius:5px;padding:4px 7px;font-size:12px;overflow-wrap:anywhere;user-select:text}
.dsh-comfy-floating .cc-online-description{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-online-description>summary{cursor:pointer;color:var(--cc-muted)}
.dsh-comfy-floating .cc-online-description>div{margin-top:10px;line-height:1.6}
@media(max-width:800px){.dsh-comfy-ui .cc-online-layout{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-online-sidebar{display:none}.dsh-comfy-ui .cc-online-filter-button{display:inline-flex}}
@media(max-width:700px){.dsh-comfy-floating .cc-online-detail{grid-template-columns:minmax(0,1fr)}.dsh-comfy-floating .cc-online-detail-image{height:300px}}

/* Constrain by the DSH panel, not just the browser viewport. */
.dsh-comfy-ui .cc-online-page{container-type:inline-size;gap:10px}
.dsh-comfy-ui .cc-online-toolbar>button,.dsh-comfy-ui .cc-online-search>button{width:auto;flex:none;white-space:nowrap;min-height:34px;border-radius:6px!important}
.dsh-comfy-ui .cc-online-toolbar>.cc-select-trigger{width:155px;flex-basis:155px;min-width:0!important}
.dsh-comfy-ui .cc-online-toolbar>.cc-icon-button{width:34px;padding:0!important}
.dsh-comfy-ui .cc-online-search{flex:1 1 220px;min-width:160px}
.dsh-comfy-ui .cc-online-search input{width:100%;border-radius:6px!important}
.dsh-comfy-ui .cc-online-layout{grid-template-columns:204px minmax(0,1fr);gap:14px}
.dsh-comfy-ui .cc-online-sidebar{padding-right:12px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filters{gap:12px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-chip{width:auto;flex:none;border-radius:6px!important;--cc-button-border:var(--cc-border)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-type-grid .cc-online-filter-chip{padding:6px 10px;min-height:30px}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-filter-chip[aria-pressed="true"]{--cc-button-border:var(--cc-accent)}
.dsh-comfy-ui .cc-online-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.dsh-comfy-ui .cc-online-model-card{border-radius:8px!important}
.dsh-comfy-ui .cc-online-card-info{gap:4px;padding:8px}
.dsh-comfy-ui .cc-online-card-info>strong{font-size:13px}
.dsh-comfy-floating .cc-online-detail-fields,.dsh-comfy-floating .cc-online-network-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dsh-comfy-floating .cc-online-wide{grid-column:1/-1}
.dsh-comfy-floating .cc-online-detail-info{gap:10px}
.dsh-comfy-floating .cc-online-detail-image{height:clamp(220px,48vh,420px)}
.dsh-comfy-floating .cc-online-description>div{max-height:none;overflow:visible}
.dsh-comfy-floating .cc-online-preview-strip{display:flex;gap:5px;overflow-x:auto;padding:2px}
.dsh-comfy-floating .cc-online-preview-strip>button{width:48px;height:56px;padding:0;flex:none;border:1px solid var(--cc-border);border-radius:6px!important;overflow:hidden;background:var(--cc-control)}
.dsh-comfy-floating .cc-online-preview-strip>button[aria-pressed=true]{border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-online-preview-strip img{width:100%;height:100%;object-fit:cover}
.dsh-comfy-floating .cc-online-trigger-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-comfy-floating .cc-online-trigger-heading button{width:auto}
.dsh-comfy-floating .cc-online-download-action{align-self:flex-start;min-height:34px}
@container(min-width:1480px){.dsh-comfy-ui .cc-online-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
@container(max-width:1120px){.dsh-comfy-ui .cc-online-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container(max-width:900px){.dsh-comfy-ui .cc-online-layout{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-online-sidebar{display:none}.dsh-comfy-ui .cc-online-filter-button{display:inline-flex}.dsh-comfy-ui .cc-online-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container(max-width:620px){.dsh-comfy-ui .cc-online-search{order:2;flex:1 0 100%;min-width:0}.dsh-comfy-ui .cc-online-toolbar{gap:6px}.dsh-comfy-ui .cc-online-toolbar>.cc-select-trigger{width:145px;flex-basis:145px}.dsh-comfy-ui .cc-online-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-comfy-ui .cc-online-card-media{aspect-ratio:3/4}.dsh-comfy-ui .cc-online-card-info>strong{font-size:12px}}
@media(max-width:520px){.dsh-comfy-floating .cc-online-detail-fields,.dsh-comfy-floating .cc-online-network-fields{grid-template-columns:minmax(0,1fr)}}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-type-grid{display:flex;flex-wrap:wrap;gap:9px;min-width:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-picker{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-height:34px;padding:4px 6px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);cursor:text}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-picker:focus-within{border-color:var(--cc-accent)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-tag{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:3px 6px;border:1px solid var(--cc-accent);border-radius:5px;background:var(--cc-accent-bg);color:var(--cc-accent-text);font-size:11px;overflow-wrap:anywhere}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-tag button{border:0;background:transparent;color:inherit;padding:0 2px;cursor:pointer;font:inherit;line-height:1}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-online-base-picker>input{flex:1 1 90px;min-width:70px;width:auto!important;height:24px;border:0!important;outline:0;background:transparent!important;color:var(--cc-text);font:inherit;font-size:12px;padding:0 3px;box-shadow:none!important}
.cc-online-base-popover{position:fixed;z-index:2147481000;min-width:220px;max-height:min(240px,calc(100vh - 16px));background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:7px;box-shadow:0 10px 28px rgba(0,0,0,.28);overflow:hidden;box-sizing:border-box}
.cc-online-base-popover .cc-online-base-menu{margin:0;max-height:min(240px,calc(100vh - 18px));overflow-y:auto;overscroll-behavior:contain;background:var(--cc-surface);padding:4px;scrollbar-width:thin}
.cc-online-base-popover .cc-online-base-option{display:block;width:100%;text-align:left;padding:6px 7px;border:0;border-radius:4px;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;cursor:pointer;overflow-wrap:anywhere}
.cc-online-base-popover .cc-online-base-option:hover{background:var(--cc-hover);color:var(--cc-accent-text)}
.dsh-comfy-floating.cc-online-viewer{position:fixed;inset:0;z-index:1200;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:rgba(6,8,12,.72);backdrop-filter:blur(3px);color:var(--cc-text);min-width:0;min-height:0}
.dsh-comfy-floating.cc-online-viewer.is-single{grid-template-columns:minmax(0,1fr)}
.cc-online-viewer-close{position:absolute;top:14px;right:16px;z-index:4;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(20,24,30,.55);color:#fff;cursor:pointer;backdrop-filter:blur(6px)}
.cc-online-viewer-stage{position:relative;display:flex;flex-direction:column;justify-content:center;gap:10px;min-width:0;min-height:0;padding:22px 16px 14px;overflow:hidden}
.cc-online-viewer-stage.is-status{align-items:center;justify-content:center}
.cc-online-viewer-image{width:100%;flex:1 1 0;min-height:0;object-fit:contain;border-radius:8px;background:rgba(0,0,0,.18)}
.cc-online-viewer-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;display:inline-flex;align-items:center;justify-content:center;width:42px;height:64px;border:0;border-radius:8px;background:rgba(10,12,16,.55);color:#fff;cursor:pointer;backdrop-filter:blur(6px)}
.cc-online-viewer-nav:hover{background:rgba(10,12,16,.78)}
.cc-online-viewer-nav.is-prev{left:22px}.cc-online-viewer-nav.is-next{right:22px}
.cc-online-viewer-count{flex:none;text-align:center;font-size:11px;color:rgba(255,255,255,.75)}
.cc-online-viewer-thumbs{display:flex;gap:6px;justify-content:center;overflow-x:auto;padding:2px;flex:none;max-height:74px}
.cc-online-viewer-thumbs>button{width:58px;height:58px;padding:0;flex:none;border:2px solid transparent;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.08);cursor:pointer}
.cc-online-viewer-thumbs>button[aria-pressed="true"]{border-color:var(--cc-accent)}
.cc-online-viewer-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.cc-online-viewer-info{min-width:0;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:26px 26px 30px;background:var(--cc-surface);border-left:1px solid var(--cc-border);display:flex;flex-direction:column;gap:12px;scrollbar-width:none;-ms-overflow-style:none}
.cc-online-viewer-info::-webkit-scrollbar{display:none;width:0;height:0}
.cc-online-viewer-heading{display:flex;flex-direction:column;gap:7px;overflow-wrap:anywhere}
.cc-online-viewer-heading>strong{font-size:20px;line-height:1.3;padding-right:32px}
.cc-online-viewer-meta{font-size:12px;color:var(--cc-muted)}
.cc-online-detail-type{align-self:flex-start;display:inline-flex;align-items:center;padding:4px 9px;border-radius:5px;background:var(--cc-accent-bg);border:1px solid var(--cc-accent);color:var(--cc-accent-text);font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.cc-online-version-tags{display:flex;gap:6px;flex-wrap:wrap;padding:2px 0}
.cc-online-base-model{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--cc-muted)}
.cc-online-base-model>strong{display:inline-flex;align-items:center;padding:3px 8px;border-radius:5px;border:1px solid var(--cc-border);background:var(--cc-control);color:var(--cc-text);font-size:11px}
.cc-online-version-tag{padding:5px 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-muted);font:inherit;font-size:12px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-online-version-tag[aria-pressed="true"]{border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text);font-weight:700}
.cc-online-viewer-fields{display:flex;flex-direction:column;gap:10px;min-width:0}
.cc-online-detail-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding-top:3px}
.cc-online-source-link{display:inline-flex;align-items:center;min-height:34px;padding:0 11px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-text);text-decoration:none;font-size:12px}
.cc-online-source-link:hover{border-color:var(--cc-accent);background:var(--cc-hover)}
.cc-online-description{display:flex;flex:1 1 auto;flex-direction:column;gap:8px;min-height:0;font-size:12px;line-height:1.65;overflow-wrap:anywhere;border-top:1px solid var(--cc-border);padding-top:12px}
.cc-online-description>div{white-space:pre-wrap}
.cc-online-desc-toggle{align-self:flex-start;padding:2px 0;border:0;background:transparent;color:var(--cc-accent);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.cc-online-desc-toggle:hover{color:var(--cc-accent-text);text-decoration:underline}
.cc-online-viewer-loading{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:rgba(255,255,255,.8);font-size:13px}
@media(max-width:800px){.dsh-comfy-floating.cc-online-viewer{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,42fr) minmax(0,58fr)}.cc-online-viewer-info{border-left:0;border-top:1px solid var(--cc-border)}.cc-online-viewer-stage{padding:16px 12px 10px}.cc-online-viewer-image{max-height:42vh}.cc-online-viewer-nav.is-prev{left:12px}.cc-online-viewer-nav.is-next{right:12px}}

`;

function onlineImageSrc(src){const value=String(src||'');return /^https?:\/\//i.test(value)?value:(value?EXPANDER+value:'');}
function OnlineModelImage({src,name,className=''}) {
    const [failed,setFailed]=React.useState(false);
    React.useEffect(()=>setFailed(false),[src]);
    return src && !failed?h('img',{className,src:onlineImageSrc(src),alt:name||'模型预览',loading:'lazy',decoding:'async',referrerPolicy:'no-referrer',onError:()=>setFailed(true)}):
        h('div',{className:'cc-online-no-image '+className},h(PromptIcon,{name:'image',size:32}),h('span',null,'暂无预览'));
}

const ONLINE_PROVIDERS=[{value:'civitai',label:'Civitai'},{value:'huggingface',label:'Hugging Face'},
    {value:'modelscope',label:'ModelScope · 魔搭'},{value:'hfmirror',label:'HF-Mirror · 第三方镜像'}];
function OnlineSourceSettings({theme,onClose,provider='civitai'}) {
    const [status,setStatus]=React.useState(null),[values,setValues]=React.useState({civitai:'',huggingface:'',modelscope:''});
    const [network,setNetwork]=React.useState({mode:'system',proxy:'',domestic_direct:false}),[testProvider,setTestProvider]=React.useState(provider);
    const [civitaiDomain,setCivitaiDomain]=React.useState('civitai.com');
    const [clear,setClear]=React.useState({}),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[probe,setProbe]=React.useState(null);
    const mounted=React.useRef(true),running=probe?.status==='running';
    React.useEffect(()=>{mounted.current=true;const ctl=new AbortController();
        onlineRequest('settings',undefined,ctl.signal).then(r=>{if(ctl.signal.aborted)return;setStatus(r);if(r.network)setNetwork(r.network);setCivitaiDomain(r.civitai_domain||'civitai.com');
            if(r.diagnostic_id)onlineRequest('diagnostics/'+r.diagnostic_id,undefined,ctl.signal).then(p=>{if(!ctl.signal.aborted)setProbe(p);}).catch(()=>{});
        }).catch(e=>{if(!ctl.signal.aborted)setError(errText(e));});return()=>{mounted.current=false;ctl.abort();};},[]);
    React.useEffect(()=>{if(!probe?.id || probe.status!=='running')return;let timer,active=true;const ctl=new AbortController();
        const poll=async()=>{try{const r=await onlineRequest('diagnostics/'+probe.id,undefined,ctl.signal);if(!active)return;setProbe(r);if(r.status==='running')timer=setTimeout(poll,700);
        }catch(e){if(active){setError(errText(e));setProbe(p=>p?{...p,status:'failed'}:p);}}};
        timer=setTimeout(poll,350);return()=>{active=false;clearTimeout(timer);ctl.abort();};
    },[probe?.id,probe?.status]);
    const save=async(test=false)=>{setBusy(true);setError('');try{const payload={};
        for(const p of ['civitai','huggingface','modelscope'])if(values[p].trim() || clear[p])payload[p]=clear[p]?'':values[p].trim();
        if(status?.network_version===1)payload.network=network;
        if(status?.civitai_domains)payload.civitai_domain=civitaiDomain;
        const saved=await onlineRequest('settings',payload);if(!mounted.current)return;
        setStatus(saved);setValues({civitai:'',huggingface:'',modelscope:''});setClear({});
        if(test){const result=await onlineRequest('diagnostics',{provider:testProvider});if(mounted.current)setProbe(result);}
        else onClose();
    }catch(e){if(mounted.current)setError(errText(e));}finally{if(mounted.current)setBusy(false);}};
    const stateName={pending:'等待',running:'检测中',passed:'可连接',failed:'失败',skipped:'未检测'};
    return h(OverlayModal,{title:'在线模型来源设置',width:640,theme,onClose},
        h('section',{className:'cc-online-network'},h('strong',null,'网络连接'),
            status&&!status.civitai_domains?h('small',{style:S.warn},'当前服务尚未提供 Civitai 地址切换，请完整重启 DSH / sidecar。'):null,
            status&&!status.network_version?h('span',{style:S.warn},'当前 sidecar 不支持网络设置，请完整重启 DSH / sidecar。'):null,
            h('div',{className:'cc-online-network-fields'},h('label',{className:'cc-online-field'},h('span',null,'连接方式'),h(SelectMenu,{theme,label:'在线模型连接方式',value:network.mode,
                options:[{value:'system',label:'跟随 Python / 系统代理'},{value:'direct',label:'直接连接'},{value:'custom',label:'指定 HTTP 代理'}],onChange:mode=>setNetwork(n=>({...n,mode}))})),
            status?.civitai_domains?h('label',{className:'cc-online-field'},h('span',null,'Civitai 访问地址'),h(SelectMenu,{theme,label:'Civitai 访问地址',value:civitaiDomain,onChange:setCivitaiDomain,options:status.civitai_domains.map(value=>({value,label:value}))})):null,
            network.mode==='custom'?h('label',{className:'cc-online-field'},h('span',null,'代理地址'),h('input',{style:{...S.inp,width:'100%',boxSizing:'border-box'},
                'aria-label':'在线模型 HTTP 代理地址',placeholder:'http://127.0.0.1:7890',value:network.proxy,disabled:busy,onChange:e=>setNetwork(n=>({...n,proxy:e.target.value}))})):null),
            network.mode!=='direct'?h('label',{style:S.dim},h('input',{type:'checkbox',checked:network.domestic_direct,onChange:e=>setNetwork(n=>({...n,domestic_direct:e.target.checked}))}),' 国内来源直连（ModelScope / HF-Mirror）'):null,
            h('small',{style:S.dim},'仅影响在线模型请求；支持 HTTP / mixed 代理端口，不支持 SOCKS、HTTPS 代理地址或账号密码。'),
            h('div',{className:'cc-online-diagnostic-toolbar'},h(SelectMenu,{theme,label:'连接检测来源',options:ONLINE_PROVIDERS,value:testProvider,onChange:setTestProvider}),
                h('button',{type:'button',style:S.btn2,disabled:busy||running||status?.network_version!==1,onClick:()=>save(true)},busy?'正在保存…':running?'正在检测连接…':'保存并检测连接')),
            h('small',{style:S.dim},'在运行插件服务的电脑检测。下载仅读取前 1 KiB，不代表大文件全程稳定。'),
            probe?h('div',{className:'cc-online-diagnostic-results',role:'region','aria-label':'在线模型连接检测结果','aria-live':'polite'},
                h('strong',null,(ONLINE_PROVIDERS.find(p=>p.value===probe.provider)?.label||probe.provider)+' · '+({system:'跟随系统',direct:'直接连接',custom:'指定代理'}[probe.network?.mode]||'当前配置')+(probe.network?.domestic_direct?' · 国内来源直连':'')),
                ...(probe.items||[]).map(step=>h('div',{key:step.kind,className:'cc-online-diagnostic-row'},
                    h('div',null,h('strong',null,step.label),h('span',{style:step.status==='failed'?S.bad:step.status==='passed'?S.ok:S.dim},stateName[step.status]||step.status)),
                    h('small',{style:S.dim},step.message+(step.ms!=null?' · '+step.ms+' ms':'')+(step.host?' · '+step.host:'')+(step.route?' · '+({direct:'直连',custom:'指定代理',system:'按系统配置'}[step.route]||step.route):'')))),
                probe.error?h('span',{role:'alert',style:S.bad},probe.error):null):null),
        h('details',{className:'cc-online-token-settings'},h('summary',null,'API Token（需要授权时填写）'),
            h('div',{className:'cc-online-network'},
                ...[['civitai','Civitai','https://civitai.com/user/account'],['huggingface','Hugging Face','https://huggingface.co/settings/tokens'],['modelscope','ModelScope','https://modelscope.cn/my/myaccesstoken']].map(([id,name,url])=>
                    h('label',{key:id,style:{display:'flex',flexDirection:'column',gap:7}},h('strong',null,name),
                        h('input',{type:'password',autoComplete:'new-password',style:{...S.inp,width:'100%',boxSizing:'border-box'},value:values[id],disabled:busy||!!clear[id],
                            'aria-label':name+' API Token',placeholder:status?.providers?.find(p=>p.id===id)?.configured?'已保存 Token，留空保持不变':'API Token（可选）',
                            onChange:e=>setValues(v=>({...v,[id]:e.target.value}))}),
                        h('span',{style:{...S.dim,display:'flex',justifyContent:'space-between',gap:8}},
                            h('a',{href:url,target:'_blank',rel:'noopener noreferrer'},'获取 Token'),
                            h('label',null,h('input',{type:'checkbox',checked:!!clear[id],onChange:e=>setClear(v=>({...v,[id]:e.target.checked}))}),' 清除已保存 Token')))),
                h('small',{style:S.dim},'Token 仅保存在本机用户目录；Hugging Face Token 不发送给 HF-Mirror，镜像仅支持公开文件。'))),
        error?h('div',{role:'alert',style:S.bad},error):null,
        h('button',{type:'button',style:S.btn,disabled:busy||running||!status,onClick:()=>save(false)},busy?'保存中…':'保存来源设置'));
}

function onlineFolderName(target){
    const path=String(target?.path||'').replace(/[\\/]+$/,'');
    return path.split(/[\\/]/).pop()||String(target?.kind||'models');
}
function onlineTargetRootLabel(target){return '...\\models\\'+onlineFolderName(target);}

function OnlineModelDetail({item,theme,onClose,onDownload,onSettings}) {
    const [data,setData]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
    const [versionId,setVersionId]=React.useState(''),[fileId,setFileId]=React.useState('');
    const [targets,setTargets]=React.useState([]),[targetId,setTargetId]=React.useState(''),[folder,setFolder]=React.useState('');
    const [folders,setFolders]=React.useState([]),[showDesc,setShowDesc]=React.useState(false);
    const [imageIndex,setImageIndex]=React.useState(0),[started,setStarted]=React.useState(false),[retry,setRetry]=React.useState(0),[copied,setCopied]=React.useState(false),[accessCheck,setAccessCheck]=React.useState(null);
    const version=data?.versions?.find(v=>v.id===versionId),file=version?.files?.find(f=>f.id===fileId);
    React.useEffect(()=>{const ctl=new AbortController();setError('');
        Promise.all([onlineRequest('detail?provider='+encodeURIComponent(item.provider)+'&id='+encodeURIComponent(item.id),undefined,ctl.signal),
            onlineRequest('targets',undefined,ctl.signal)]).then(([model,r])=>{
                if(ctl.signal.aborted)return;setData(model);setTargets(r.items||[]);
                const v=model.versions?.[0],f=v?.files?.find(x=>x.primary)||v?.files?.[0];
                setVersionId(v?.id||'');setFileId(f?.id||'');setTargetId(onlineDefaultTarget(model,v,f,r.items||[]));
                setFolder('');setFolders([]);setImageIndex(0);setShowDesc(false);setStarted(false);
            }).catch(e=>{if(!ctl.signal.aborted)setError(errText(e));});return()=>ctl.abort();
    },[item.provider,item.id,retry]);
    React.useEffect(()=>{let active=true;const ctl=new AbortController();
        if(!targetId){setFolders([]);return()=>ctl.abort();}
        const [kind,rootId]=targetId.split(':');
        jget(EXPANDER+'/models/browser?kind='+encodeURIComponent(kind)+'&root_id='+encodeURIComponent(rootId),12000,ctl.signal)
            .then(r=>{if(active)setFolders(Array.isArray(r?.folders)?r.folders:[]);})
            .catch(()=>{if(active)setFolders([]);});
        return()=>{active=false;ctl.abort();};
    },[targetId]);
    React.useEffect(()=>{
        if(!data||data.provider!=='civitai'||!versionId||!fileId){setAccessCheck(null);return;}
        let active=true;const ctl=new AbortController();setAccessCheck({status:'checking'});
        onlineRequest('access',{provider:data.provider,model_id:data.id,version_id:versionId,file_id:fileId},ctl.signal)
            .then(r=>{if(active)setAccessCheck(r);})
            .catch(e=>{if(active)setAccessCheck({status:'error',message:errText(e)});});
        return()=>{active=false;ctl.abort();};
    },[data?.provider,data?.id,versionId,fileId]);

    const changeVersion=id=>{setVersionId(id);setImageIndex(0);setCopied(false);setStarted(false);const v=data.versions.find(v=>v.id===id),f=v?.files?.find(x=>x.primary)||v?.files?.[0];setFileId(f?.id||'');setTargetId(onlineDefaultTarget(data,v,f,targets));setFolder('');};
    const start=async()=>{setBusy(true);setError('');try{
        const [kind,rootId]=targetId.split(':');
        const job=await onlineRequest('downloads',{provider:data.provider,model_id:data.id,version_id:versionId,file_id:fileId,kind,root_id:Number(rootId),folder});
        setStarted(true);onDownload(job);
    }catch(e){setError(errText(e));}finally{setBusy(false);}};
    const targetOptions=[];
    for(const t of targets){
        const base=t.kind+':'+t.root_id+'|';
        targetOptions.push({value:base,label:onlineTargetRootLabel(t)});
        if(base.slice(0,-1)===targetId)for(const f of folders){
            const rel=String(f.path||f.name||'').replace(/^[\\/]+|[\\/]+$/g,'');
            if(rel)targetOptions.push({value:base+rel,label:onlineTargetRootLabel(t)+'\\'+rel.replace(/\//g,'\\')});
        }
    }
    const images=(version?.images?.length?version.images:[data?.image]).filter(Boolean);
    const currentImage=images[imageIndex]||images[0]||'';
    const changeImage=step=>{if(images.length<2)return;setImageIndex(i=>(i+step+images.length)%images.length);};
    React.useEffect(()=>{
        const key=e=>{
            if(e.key==='Escape'){e.preventDefault();onClose();return;}
            const tag=String(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag))return;
            if(e.key==='ArrowLeft'){e.preventDefault();changeImage(-1);}
            else if(e.key==='ArrowRight'){e.preventDefault();changeImage(1);}
        };
        document.addEventListener('keydown',key,true);
        const old=document.body?.style?.overflow||'';if(document.body)document.body.style.overflow='hidden';
        return()=>{document.removeEventListener('keydown',key,true);if(document.body)document.body.style.overflow=old;};
    },[images.length,onClose]);
    const typeLabel=onlineTypeLabel(data?.type||item.type);
    const baseModel=version?.base_model||data?.base_model||'';
    const early=!!(version?.early_access ?? data?.early_access),gated=!!data?.gated,paid=!!data?.paid_access,token=!!data?.token_configured;
    const accessStatus=accessCheck?.status||'',checking=accessStatus==='checking',authBlocked=accessStatus==='auth'||accessStatus==='forbidden';
    const blocked=authBlocked||(early&&!paid&&accessStatus!=='ok');
    const description=[data?.description,version?.description].filter(Boolean).join('\n\n')||'来源未提供说明';
    const descLimit=420,descPreview=description.length>descLimit?description.slice(0,descLimit)+'…':description;
    const meta=data?[(ONLINE_PROVIDERS.find(p=>p.value===data.provider)?.label||data.provider),data.author,onlineCount(data.downloads)+' 次下载'].filter(Boolean).join(' · '):'';
    const closeButton=h('button',{type:'button',className:'cc-online-viewer-close','aria-label':'关闭模型详情',onClick:onClose},h(PromptIcon,{name:'x',size:20}));
    const info=data?h('aside',{className:'cc-online-viewer-info'},
        h('div',{className:'cc-online-viewer-heading'},h('div',{className:'cc-online-detail-badges'},h('span',{className:'cc-online-detail-type'},typeLabel),data.nsfw?h('span',{className:'cc-online-nsfw-badge',title:'成人内容'},'NSFW'):null),h('strong',null,data.name),h('span',{className:'cc-online-viewer-meta'},meta)),
        data.versions?.length?h('div',{className:'cc-online-version-tags'},...data.versions.map(v=>h('button',{key:v.id,type:'button',className:'cc-online-version-tag','aria-pressed':v.id===versionId,title:v.base_model||'',onClick:()=>changeVersion(v.id)},v.name))):null,
        baseModel?h('div',{className:'cc-online-base-model'},h('span',null,'基底模型'),h('strong',null,baseModel)):null,
        early||gated||authBlocked?h('div',{className:'cc-online-access-warning',role:'status'},
            h('strong',null,early?'Early Access · 不能匿名直接下载':authBlocked?'需要登录 / 授权':'来源受限 · 需要授权'),
            h('span',null,early
                ?(paid?'当前账号已有该模型的 Early Access 访问权限。':'该模型处于 Early Access，需要 Civitai 登录 Token，且账号需具备该模型的访问权限（通常涉及会员/付费）。')
                :authBlocked
                    ?(token?'Civitai 拒绝了当前凭证：Token 无效、账号没有该模型访问权限，或来源地区受限。':'Civitai 要求登录/API Token 才能下载该模型；当前未配置 Token。')
                    :(token?'该模型在来源站点受访问限制，请确认账号已获批访问。':'该模型在来源站点受访问限制，需要先登录/授权后才能下载。')),
            (authBlocked||!token||!paid)&&onSettings?h('button',{type:'button',onClick:onSettings},'配置来源 Token'):null):null,
        h('div',{className:'cc-online-viewer-fields'},
            h('label',{className:'cc-online-field'},h('span',null,'权重文件'),h(SelectMenu,{theme,label:'权重文件',options:(version?.files||[]).map(f=>({value:f.id,label:f.remote_path+' · '+onlineBytes(f.size)})),value:fileId,
                onChange:id=>{setFileId(id);setStarted(false);setFolder('');setTargetId(onlineDefaultTarget(data,version,version.files.find(f=>f.id===id),targets));},forceSearch:true})),
            file?h('span',{className:'cc-online-wide',style:S.dim},[file.format,file.precision,onlineBytes(file.size)].filter(Boolean).join(' · ')):null,
            h('label',{className:'cc-online-field cc-online-wide'},h('span',null,'下载到'),
                h(SelectMenu,{theme,label:'模型下载目录',options:targetOptions.length?targetOptions:[{value:'',label:'没有可用下载目录'}],value:targetId?targetId+'|'+folder:'',onChange:value=>{const [tid,sub]=String(value).split('|');setTargetId(tid);setFolder(sub||'');setStarted(false);},forceSearch:true})),
            targets.length&&file&&!targetId?h('span',{style:S.dim},'没有自动匹配的目录，请手动选择下载位置。'):null,
            !targets.length?h('span',{style:S.warn},'请先在连接设置配置 ComfyUI 路径，再重新打开此窗口。'):null),
        version?.trained_words?.length?h('div',null,h('div',{className:'cc-online-trigger-heading'},h('strong',null,'触发词'),h('button',{type:'button',style:S.btn2,onClick:async()=>{try{await navigator.clipboard.writeText(version.trained_words.join(', '));setCopied(true);}catch{setError('复制失败，请手动选择触发词复制。');}}},copied?'已复制':'复制触发词')),h('div',{className:'cc-online-trigger-words'},...version.trained_words.map((w,i)=>h('span',{key:i},w)))):null,
        data.license?h('span',{style:S.dim},'许可 / 使用信息：'+data.license):null,
        data.gated?h('span',{style:S.dim},'该模型需要先在来源网站获得访问授权，并配置 Token。'):null,
        ['huggingface','hfmirror','modelscope'].includes(item.provider)?h('span',{style:S.dim},'此处下载选定的单个权重文件；分片 / Diffusers 仓库请按来源说明完整下载。'):null,
        item.provider==='hfmirror'?h('span',{style:S.dim},'第三方镜像，仅访问公开文件，不发送 Hugging Face Token；下载可能重定向到其他存储域名。'):null,
        error?h('div',{role:'alert',style:S.bad},error):null,
        h('div',{className:'cc-online-detail-actions'},
            h('button',{type:'button',className:'cc-online-download-action',style:S.btn,disabled:busy||!file||!targetId||started||blocked||checking,onClick:start},checking?'正在验证下载权限…':blocked?(early?'需要 Early Access 授权':'需要登录 / 授权'):busy?'正在创建下载任务…':started?'已加入下载队列':'下载模型'),
            data.url?h('a',{className:'cc-online-source-link',href:data.url,target:'_blank',rel:'noopener noreferrer'},'查看来源'):null),
        !version?.files?.length?h('span',{style:S.dim},'此版本没有可下载的单文件模型权重。'):null,
        h('section',{className:'cc-online-description'},h('strong',null,'模型说明'),h('div',null,showDesc?description:descPreview),
            description.length>descLimit?h('button',{type:'button',className:'cc-online-desc-toggle',onClick:()=>setShowDesc(v=>!v)},showDesc?'收起':'展开全部信息'):null)
    ):null;
    const stage=data?h('section',{className:'cc-online-viewer-stage'},
        currentImage?h('img',{className:'cc-online-viewer-image',src:onlineImageSrc(currentImage),alt:data.name}):h('div',{className:'cc-online-no-image'},h(PromptIcon,{name:'image',size:40}),'该模型没有预览图'),
        images.length>1?h('button',{type:'button',className:'cc-online-viewer-nav is-prev','aria-label':'上一张模型预览',onClick:()=>changeImage(-1)},h(PromptIcon,{name:'chevronLeft',size:22})):null,
        images.length>1?h('button',{type:'button',className:'cc-online-viewer-nav is-next','aria-label':'下一张模型预览',onClick:()=>changeImage(1)},h(PromptIcon,{name:'chevronRight',size:22})):null,
        h('div',{className:'cc-online-viewer-count'},(images.length?Math.min(imageIndex+1,images.length):0)+' / '+images.length),
        images.length>1?h('div',{className:'cc-online-viewer-thumbs'},...images.map((src,i)=>h('button',{key:src+':'+i,type:'button','aria-pressed':i===imageIndex,'aria-label':'选择模型预览 '+(i+1),onClick:()=>setImageIndex(i)},h('img',{src:onlineImageSrc(src),alt:'预览 '+(i+1)})))):null
    ):h('section',{className:'cc-online-viewer-stage is-status'},h('div',{className:'cc-online-viewer-loading'},error?h(React.Fragment,null,h('span',{style:S.bad},error),h('button',{type:'button',style:S.btn2,onClick:()=>setRetry(n=>n+1)},'重试详情')):h(React.Fragment,null,h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner'})),'正在读取模型详情…')));
    return floating(h('div',{className:'dsh-comfy-floating cc-online-viewer'+(data?'':' is-single'),style:{...(theme||{})},role:'dialog','aria-modal':'true','aria-label':'模型详情'},closeButton,stage,info));
}


function onlineShortPath(path){
    const raw=String(path||''),parts=raw.replace(/\\/g,'/').split('/').filter(Boolean);
    return parts.length>4?'…\\'+parts.slice(-3).join('\\'):raw;
}

function OnlineModelsPanel({theme,onDownloaded,onMessage}) {
    const [params,setParams]=React.useState(()=>({...ONLINE_SESSION.query})),[draft,setDraft]=React.useState(ONLINE_SESSION.query.q);
    const initialCache=ONLINE_SESSION.cache?.key===JSON.stringify(ONLINE_SESSION.query)?ONLINE_SESSION.cache.result:null;
    const [result,setResult]=React.useState(()=>initialCache||{items:[],has_more:false,cursor:'',page:1}),[busy,setBusy]=React.useState(!initialCache),[error,setError]=React.useState('');
    const [selected,setSelected]=React.useState(null),[showSettings,setShowSettings]=React.useState(false),[filterDialog,setFilterDialog]=React.useState(false),[showJobs,setShowJobs]=React.useState(false);
    const [jobs,setJobs]=React.useState([]),[searchRefresh,setSearchRefresh]=React.useState(0);
    const key=JSON.stringify(params);
    const request=React.useRef({id:0,controller:null}),completed=React.useRef(ONLINE_SESSION.completed),mounted=React.useRef(true),downloadedCallback=React.useRef(onDownloaded),loadingMore=React.useRef(false);
    const [accessMap,setAccessMap]=React.useState(()=>Object.fromEntries(ONLINE_ACCESS_CACHE));
    const accessQueue=React.useRef([]),accessActive=React.useRef(0);
    const pageCache=React.useRef(new Map()),pageCursors=React.useRef(new Map([[1,'']])),resultsScroll=React.useRef(null);
    downloadedCallback.current=onDownloaded;
    const scrollResultsTop=()=>{try{resultsScroll.current?.scrollTo?.({top:0,behavior:'auto'});}catch{if(resultsScroll.current)resultsScroll.current.scrollTop=0;}};
    function pumpAccess(){
        while(accessActive.current<3&&accessQueue.current.length){
            const item=accessQueue.current.shift();accessActive.current++;
            onlineRequest('access',{provider:'civitai',url:item.url})
                .then(r=>{const st=r?.status;if(!mounted.current||!['ok','auth','forbidden'].includes(st))return;ONLINE_ACCESS_CACHE.set(item.key,st);setAccessMap(prev=>({...prev,[item.key]:st}));})
                .catch(()=>{})
                .finally(()=>{accessActive.current--;pumpAccess();});
        }
    }
    function queueAccess(key,url){
        if(!key||!url||ONLINE_ACCESS_CACHE.has(key)||accessQueue.current.some(x=>x.key===key))return;
        accessQueue.current.push({key,url});pumpAccess();
    }
    React.useEffect(()=>{
        const root=resultsScroll.current;
        if(!root||typeof IntersectionObserver==='undefined')return;
        const observer=new IntersectionObserver(entries=>{
            for(const entry of entries)if(entry.isIntersecting){
                observer.unobserve(entry.target);
                const key=entry.target.dataset.onlineAccessKey,url=entry.target.dataset.onlineAccessUrl;
                if(key&&url)queueAccess(key,url);
            }
        },{root,rootMargin:'180px'});
        root.querySelectorAll('[data-online-access-url]').forEach(node=>observer.observe(node));
        return()=>observer.disconnect();
    },[result]);

    async function search(targetPage=1,force=false,append=false){
        targetPage=Math.max(1,Number(targetPage)||1);
        if(loadingMore.current&&!force)return;
        if(!force&&pageCache.current.has(targetPage)){
            // A pending network response must never overwrite a restored page.
            request.current.controller?.abort();request.current.id++;request.current.controller=null;
            const cached=pageCache.current.get(targetPage),merged=append?onlineMergePages(result,cached):cached;
            setResult(merged);setError('');setBusy(false);
            ONLINE_SESSION.cache={key,time:Date.now(),result:merged};if(!append)scrollResultsTop();return;
        }
        loadingMore.current=true;
        request.current.controller?.abort();
        const ctl=new AbortController(),id=++request.current.id;request.current.controller=ctl;
        setBusy(true);setError('');if(targetPage===1&&force)setResult({items:[],has_more:false,cursor:'',page:1});
        const cursorRequired=['huggingface','hfmirror'].includes(params.provider)||(params.provider==='civitai'&&!!params.q);
        let cursor=pageCursors.current.get(targetPage)||'';
        try{
            if(cursorRequired&&targetPage>1&&!cursor){
                // These APIs expose opaque cursors. Resolve only the unseen gap so numbered
                // navigation remains usable instead of repeating page 1 or inventing offsets.
                let start=targetPage-1;
                while(start>1&&!pageCursors.current.has(start))start--;
                let walkCursor=pageCursors.current.get(start)||'';
                for(let p=start;p<targetPage;p++){
                    const walkQuery={...params,page:p};if(walkCursor)walkQuery.cursor=walkCursor;
                    const walk=await onlineRequest('search?'+Object.entries(walkQuery).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(k==='nsfw'?(v?'1':'0'):v)).join('&'),undefined,ctl.signal);
                    if(!mounted.current||ctl.signal.aborted||id!==request.current.id)return;
                    const walkPage={...walk,page:p,items:walk.items||[]};pageCache.current.set(p,walkPage);
                    if(!walkPage.cursor)throw new Error('该来源没有更多分页结果。');
                    pageCursors.current.set(p+1,walkPage.cursor);walkCursor=walkPage.cursor;
                }
                cursor=pageCursors.current.get(targetPage)||'';
            }
            const query={...params,page:targetPage};
            if(cursor)query.cursor=cursor;
            const data=await onlineRequest('search?'+Object.entries(query).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(k==='nsfw'?(v?'1':'0'):v)).join('&'),undefined,ctl.signal);
            if(!mounted.current||ctl.signal.aborted||id!==request.current.id)return;
            const next={...data,page:targetPage,items:data.items||[]};
            if(!next.items.length)next.has_more=false;
            pageCache.current.set(targetPage,next);if(next.cursor)pageCursors.current.set(targetPage+1,next.cursor);else pageCursors.current.delete(targetPage+1);
            const merged=append?onlineMergePages(result,next):next;
            ONLINE_SESSION.cache={key,time:Date.now(),result:merged};setResult(merged);if(!append)scrollResultsTop();
        }catch(e){if(mounted.current&&!ctl.signal.aborted&&id===request.current.id)setError(errText(e));}
        finally{if(id===request.current.id)loadingMore.current=false;if(mounted.current&&id===request.current.id)setBusy(false);}
    }
    const loadMore=()=>{if(loadingMore.current||busy||!result.has_more)return;setError('');search((Number(result.page)||1)+1,false,true);};
    React.useEffect(()=>{
        const node=resultsScroll.current;
        if(!node||busy||!result.has_more||error)return;
        if(node.scrollHeight<=node.clientHeight+120)loadMore();
    },[result,busy,error]);
    function stopSearch(){
        request.current.controller?.abort();
        request.current.id++;
        request.current.controller=null;loadingMore.current=false;
        setBusy(false);setError('');
        onMessage?.('已停止在线模型搜索');
    }
    React.useEffect(()=>{ONLINE_SESSION.query={...params};saveOnlineQuery(ONLINE_SESSION.query);pageCache.current=new Map();pageCursors.current=new Map([[1,'']]);
        if(!searchRefresh&&ONLINE_SESSION.cache?.key===key){const cached=ONLINE_SESSION.cache.result;pageCache.current.set(cached.page||1,cached);if(cached.cursor)pageCursors.current.set((cached.page||1)+1,cached.cursor);setResult(cached);setBusy(false);return;}
        const timer=setTimeout(()=>search(1,true),180);return()=>{clearTimeout(timer);request.current.controller?.abort();};},[key,searchRefresh]);
    React.useEffect(()=>{let timer,active=true;const ctl=new AbortController();
        const poll=async()=>{try{const data=await onlineRequest('downloads',undefined,ctl.signal);if(!active)return;
            setJobs(data.items||[]);const done=new Set((data.items||[]).filter(j=>j.status==='completed').map(j=>j.id));
            if(completed.current)for(const job of data.items||[])if(done.has(job.id)&&!completed.current.has(job.id))downloadedCallback.current?.(job);
            completed.current=done;ONLINE_SESSION.completed=done;
            timer=setTimeout(poll,(data.items||[]).some(j=>['queued','running','verifying','paused'].includes(j.status))?1200:4500);
        }catch{if(active)timer=setTimeout(poll,6000);}};
        poll();return()=>{active=false;clearTimeout(timer);ctl.abort();};
    },[]);
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current.controller?.abort();};},[]);
    const update=patch=>setParams(p=>({...p,...patch}));
    const chooseProvider=provider=>{setParams(p=>({...p,provider,type:'',base:'',period:'AllTime'}));};
    const typeTags=String(params.type||'').split(',').map(v=>v.trim()).filter(Boolean);
    const baseTags=String(params.base||'').split(',').map(v=>v.trim()).filter(Boolean);
    const toggleType=v=>{if(!v)update({type:''});else{const next=typeTags.includes(v)?typeTags.filter(x=>x!==v):[...typeTags,v];update({type:next.join(',')});}};
    const filters=()=>h('div',{className:'cc-online-filters'},
        h('label',{className:'cc-online-field'},h('strong',null,'排序'),h(SelectMenu,{theme,label:'在线模型排序',options:[{value:'Most Downloaded',label:'最多下载'},{value:'Highest Rated',label:'评分 / 喜爱'},{value:'Newest',label:'最新发布'}],value:params.sort,onChange:sort=>update({sort})})),
        params.provider!=='modelscope'?h(OnlineBaseFilter,{provider:params.provider,value:params.base,onChange:base=>update({base}),theme}):null,
        h('div',{className:'cc-online-filter-group'},h('strong',null,'模型类型'),
            h('div',{className:'cc-online-type-grid'},...(params.provider==='civitai'?ONLINE_TYPES:[['','全部'],['LORA','LoRA']]).map(([id,label])=>h('button',{key:id||'all',type:'button',className:'cc-online-filter-chip','aria-pressed':id?typeTags.includes(id):!typeTags.length,onClick:()=>toggleType(id)},label)))),
        params.provider==='civitai'?h('label',{className:'cc-online-field'},h('strong',null,'时间范围'),h(SelectMenu,{theme,label:'在线模型时间范围',options:[['AllTime','全部时间'],['Year','一年'],['Month','一个月'],['Week','一周'],['Day','一天']].map(([value,label])=>({value,label})),value:params.period,onChange:period=>update({period})})):null,
        params.provider==='civitai'?h('label',{style:S.dim},h('input',{type:'checkbox',checked:params.nsfw,onChange:e=>update({nsfw:e.target.checked})}),' 包含成人内容'):null,
        h('button',{type:'button',style:S.btn2,onClick:()=>update({type:'',base:'',sort:'Most Downloaded',period:'AllTime',nsfw:false})},'重置筛选'));
    const applied=[typeTags.length&&['type','类型：'+typeTags.map(onlineTypeLabel).join('、')],baseTags.length&&['base','基底：'+baseTags.join('、')],params.period!=='AllTime'&&['period','时间：'+({Year:'一年',Month:'一个月',Week:'一周',Day:'一天'}[params.period]||params.period)],params.nsfw&&['nsfw','包含成人内容']].filter(Boolean);
    const jobNames={queued:'排队中',running:'下载中',verifying:'校验中',paused:'已暂停',completed:'已完成',failed:'失败',cancelled:'已取消',interrupted:'已中断'};
    const jobActive=job=>['queued','running','verifying','paused'].includes(job.status);
    const active=jobs.filter(jobActive),finished=jobs.filter(job=>!jobActive(job));
    const jobPercent=job=>job.total?Math.min(100,Math.floor(job.received/job.total*100))+'%':'';
    const cancel=async job=>{try{await onlineRequest('downloads/'+job.id+'/cancel',{});setJobs(r=>r.map(x=>x.id===job.id?{...x,status:x.status==='paused'?'cancelled':x.status,message:'正在取消…'}:x));}catch(e){onMessage?.(errText(e));}};
    const pause=async job=>{try{const r=await onlineRequest('downloads/'+job.id+'/pause',{});setJobs(prev=>prev.map(x=>x.id===job.id?{...x,...r}:x));}catch(e){onMessage?.(errText(e));}};
    const retry=async job=>{try{const r=await onlineRequest('downloads/'+job.id+'/retry',{});setJobs(prev=>[r,...prev]);}catch(e){onMessage?.(errText(e));}};
    const clearFinished=async()=>{try{const r=await onlineRequest('downloads/clear',{});setJobs(r.items||[]);}catch(e){onMessage?.(errText(e));}};
    return h('section',{className:'cc-online-page','data-cc-guide':'online-page','aria-label':'在线模型库'},
        h('style',null,ONLINE_CSS),
        h('div',{className:'cc-online-toolbar','data-cc-guide':'online-toolbar'},
            h(SelectMenu,{theme,label:'模型来源',options:ONLINE_PROVIDERS,value:params.provider,onChange:chooseProvider,minWidth:145}),
            h('form',{className:'cc-online-search',onSubmit:e=>{e.preventDefault();update({q:draft.trim()});setSearchRefresh(n=>n+1);}},
                h('input',{type:'search',style:S.inp,'aria-label':'搜索在线模型',placeholder:'搜索模型名称…',value:draft,onChange:e=>setDraft(e.target.value)}),
                h('button',{type:'submit',style:S.btn2},h(PromptIcon,{name:'search',size:13}),' 搜索')),
            h('button',{type:'button',className:'cc-online-filter-button',style:S.btn2,'aria-label':'筛选','aria-haspopup':'dialog',onClick:()=>setFilterDialog(true)},'筛选'+(applied.length?' · '+applied.length:'')),
            h('button',{type:'button',style:S.btn2,onClick:()=>setShowJobs(v=>!v),'aria-expanded':showJobs,'aria-pressed':showJobs},'查看下载'+(active.length?' · '+active.length:'')),
            h('button',{type:'button',style:S.btn2,onClick:()=>setShowSettings(true)},'来源与连接'),
            h('button',{type:'button',className:'cc-icon-button cc-tooltip-right cc-task-cancel-icon',style:S.btn2,'aria-busy':busy,'aria-label':busy?'停止搜索在线模型':'刷新在线模型','data-cc-tooltip':busy?'停止搜索在线模型':'刷新在线模型',onClick:busy?stopSearch:()=>setSearchRefresh(n=>n+1)},busy?h(React.Fragment,null,h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner'})),h('span',{className:'cc-icon-stop','aria-hidden':'true'},h(PromptIcon,{name:'stop'}))):h(PromptIcon,{name:'refresh'}))),
        h('div',{className:'cc-online-layout'},h('aside',{className:'cc-online-sidebar','data-cc-guide':'online-filters','aria-label':'在线模型筛选'},filters()),
            h('div',{className:'cc-online-results','data-cc-guide':'online-results','aria-busy':busy},
                h('div',{ref:resultsScroll,className:'cc-online-results-scroll',tabIndex:0,'aria-label':'在线模型列表',onScroll:e=>{const node=e.currentTarget;if(node.scrollTop+node.clientHeight>=node.scrollHeight-160)loadMore();}},
                    error?h('div',{role:'alert',className:'cc-online-empty'},h('span',{style:S.bad},error),h('button',{type:'button',style:S.btn2,onClick:()=>result.items.length?loadMore():search(1,true)},result.items.length?'重试加载更多':'重新加载')):null,
                    !busy&&!error&&!result.items.length?h('div',{className:'cc-online-empty'},h(PromptIcon,{name:'image',size:32}),h('strong',null,'没有匹配模型'),h('span',{style:S.dim},'试试其他名称、来源或筛选条件。')):null,
                    h('div',{className:'cc-online-grid'},...result.items.map(model=>{const accessKey=model.provider+':'+model.id,accessFiles=model.versions?.[0]?.files||[],accessFile=accessFiles.find(f=>f.primary)||accessFiles.find(f=>/\.(safetensors|ckpt|pt|bin)$/i.test(f.name))||accessFiles[0],accessUrl=model.provider==='civitai'&&!model.early_access&&accessFile?.url?accessFile.url:'',accessStatus=accessMap[accessKey];return h('button',{type:'button',key:accessKey,className:'cc-online-model-card',onClick:()=>setSelected(model),'aria-label':'查看模型 '+model.name,'data-online-access-key':accessKey,'data-online-access-url':accessUrl||undefined},
                        h('div',{className:'cc-online-card-media'},h(OnlineModelImage,{src:model.image,name:model.name}),
                            h('span',{className:'cc-online-type-badge'},model.type),
                            onlineAccessLabel(model)?h('span',{className:'cc-online-access-badge',title:'该模型不能匿名直接下载'},onlineAccessLabel(model)):accessStatus==='auth'?h('span',{className:'cc-online-access-badge',title:'实际下载需要登录/Token 或授权'},'需登录'):accessStatus==='forbidden'?h('span',{className:'cc-online-access-badge',title:'来源拒绝访问'},'需授权'):null,
                            model.nsfw?h('span',{className:'cc-online-nsfw-badge',title:'成人内容'},'NSFW'):null),
                        h('div',{className:'cc-online-card-info'},h('small',null,model.author||'未知作者'),h('strong',null,model.name),
                            h('small',{className:'cc-online-base'},model.base_model||'未标注基础模型'),h('span',{className:'cc-online-card-stats'},'↓ '+onlineCount(model.downloads)+'  ·  ♡ '+onlineCount(model.likes))));
                        })),
                    busy?h('div',{role:'status',className:'cc-online-loading'},h('span',{className:'cc-icon-spinner','aria-hidden':'true'},h(PromptIcon,{name:'spinner'})),h('span',null,result.items.length?'正在加载下一批…':'正在加载模型…'),h('button',{type:'button',style:S.btn2,onClick:stopSearch},h(PromptIcon,{name:'stop',size:13}),h('span',null,'停止搜索'))):null,
                    !busy&&result.items.length&&!result.has_more?h('div',{className:'cc-online-more-status'},'没有更多模型了'):null))),
        showJobs?h(OverlayModal,{title:'下载任务',width:780,theme,onClose:()=>setShowJobs(false)},
            h('div',{className:'cc-online-downloads',role:'region','aria-label':'模型下载任务'},
                h('div',{className:'cc-online-download-summary'},
                    h('div',null,h('strong',null,jobs.length?jobs.length+' 个任务':'暂无下载任务'),
                        h('span',{className:'cc-online-download-counts'},
                            h('span',null,'进行中 '+active.filter(j=>j.status!=='paused').length),
                            h('span',null,'暂停 '+jobs.filter(j=>j.status==='paused').length),
                            h('span',null,'失败 '+jobs.filter(j=>j.status==='failed').length),
                            h('span',null,'完成 '+jobs.filter(j=>j.status==='completed').length))),
                    finished.length?h('button',{type:'button',className:'cc-online-job-action',onClick:clearFinished},'清除已结束'):null),
                jobs.length
                    ? h('div',{className:'cc-online-download-list'},...jobs.map(job=>h('div',{className:'cc-online-job is-'+(job.status||'unknown'),key:job.id},
                        h('div',{className:'cc-online-job-head'},
                            h('span',{className:'cc-online-job-status'},jobNames[job.status]||job.status),
                            h('strong',{className:'cc-online-job-name',title:job.filename},job.filename)),
                        job.message?h('div',{className:'cc-online-job-message'},job.message):null,
                        job.path?h('div',{className:'cc-online-job-path',title:job.path},onlineShortPath(job.path)):null,
                        (job.total||job.received)?h('div',{className:'cc-online-job-progress'},
                            h('progress',{max:job.total||undefined,value:job.total?Math.min(job.received,job.total):undefined,'aria-label':job.filename+' 下载进度'}),
                            h('div',{className:'cc-online-job-stats'},
                                h('span',null,onlineBytes(job.received)+(job.total?' / '+onlineBytes(job.total):'')),
                                jobPercent(job)?h('span',null,jobPercent(job)):null,
                                job.speed?h('span',null,onlineBytes(job.speed)+'/s'):null)):null,
                        h('div',{className:'cc-online-job-actions'},
                            job.status==='running'||job.status==='paused'?h('button',{type:'button',className:'cc-online-job-action',onClick:()=>pause(job)},job.status==='paused'?'继续下载':'暂停下载'):null,
                            jobActive(job)?h('button',{type:'button',className:'cc-online-job-action',onClick:()=>cancel(job)},'取消下载'):null,
                            ['failed','cancelled','interrupted'].includes(job.status)&&job.version_id&&job.file_id?h('button',{type:'button',className:'cc-online-job-action is-primary',onClick:()=>retry(job)},'重试'):null))))
                    : h('div',{className:'cc-online-empty'},h(PromptIcon,{name:'file',size:28}),h('span',{style:S.dim},'开始下载模型后，任务会显示在这里。'))
            )
        ):null,
        filterDialog?h(OverlayModal,{title:'筛选与排序',width:460,theme,onClose:()=>setFilterDialog(false)},filters()):null,
        showSettings?h(OnlineSourceSettings,{theme,provider:params.provider,onClose:()=>{setShowSettings(false);ONLINE_ACCESS_CACHE.clear();setAccessMap({});setSearchRefresh(n=>n+1);}}):null,
        selected?h(OnlineModelDetail,{key:selected.provider+':'+selected.id,item:selected,theme,onClose:()=>setSelected(null),onSettings:()=>{setSelected(null);setShowSettings(true);},onDownload:job=>{setJobs(p=>[job,...p]);setSelected(null);setShowJobs(true);onMessage?.('已加入下载队列：'+job.filename);}}):null);
}
