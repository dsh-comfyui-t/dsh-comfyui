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
	// 画布出图点击放大：把图交给输出查看器（缩放 / 拖拽 / 前后切换全在这套里）
	OUTPUT_VIEW_SINK = (it) => { if (!it) return; setOutputDetailScope("recent"); setOutputDetail(it); };
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
	// 2026-10-31：带 attempt 的启动会话。有值时按钮变成「启动中…」，可悬浮停止，
	// 下方浮层轮询 /comfy/startup 显示阶段与后台日志。
	const [startSession, setStartSession] = React.useState(null);
	const [stoppingStart, setStoppingStart] = React.useState(false);
	const launchAttempt = React.useRef(null);
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
    /**
     * 底模扁平清单：底模选择场景下不再走文件夹树，直接列全机所有底模。
     *
     * 2026-10-31：模型库与生成面板是两个独立组件，这里没有 unets 状态，
     * 所以自己从 ComfyUI 的两个 loader 枚举取一次，合并成扁平列表。
     * 每项 {name, source:"diffusion"|"checkpoint", size}。
     */
    const [flatBaseModels,setFlatBaseModels]=React.useState([]);
    const [flatBaseLoading,setFlatBaseLoading]=React.useState(false);
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
    // 0.7.165：历史页批量删除。平时工具只有「刷新」，点「删除」进入勾选模式，
    // 那一颗原地变成「确认删除 (N)」+「取消」，勾完一次删完。
    const [outputDeleteMode,setOutputDeleteMode]=React.useState(false);
    const [outputSelected,setOutputSelected]=React.useState(()=>new Set());
    const [outputDeleting,setOutputDeleting]=React.useState(false);
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
            // 2026-10-31：带 attempt 提交，启动改在 sidecar 的后台线程里跑，
            // 前端拿得到阶段文字和后台日志，也能中途叫停。
            // 提交后自己在这儿轮询到结束，保持「等到真正就绪才刷新模型列表」的老语义。
            const _aid = (typeof crypto !== "undefined" && crypto.randomUUID)
                ? crypto.randomUUID()
                : "att-" + Date.now() + "-" + Math.random().toString(16).slice(2);
            launchAttempt.current = { id: _aid, startedAt: Date.now() };
            setStartSession(launchAttempt.current);
            const r = await jpost(EXPANDER + "/comfy/start", { mode, attempt: _aid }, 30000);
            if (!r?.ok) throw new Error(r?.message || "启动失败");
            if (r.started) {
                const deadline = Date.now() + 120000;
                let snap = null;
                while (Date.now() < deadline) {
                    await new Promise((res) => setTimeout(res, 1000));
                    try {
                        const sp = await jget(EXPANDER + "/comfy/startup?attempt=" + encodeURIComponent(_aid), 6000);
                        snap = sp && sp.snapshot;
                    } catch (e) { /* sidecar 忙，下一轮再问 */ }
                    if (snap && snap.finishedAt) break;
                }
                if (!snap || !snap.finishedAt) throw new Error("启动超时（120 秒内没有结果）");
                if (snap.cancelled) { setMsg("已停止启动"); return; }
                if (!snap.ok) throw new Error(snap.message || "启动失败");
                setMsg(snap.message || "已启动");
            }
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
            // 启动会话结束，按钮回到常态、浮层轮询停掉
            launchAttempt.current = null;
            setStartSession(null);
        }
    }
    /** 停止本次启动：只终止这次启动拉起的进程树，已在跑的外部服务不受影响。 */
    async function stopStartup() {
        const attempt = launchAttempt.current;
        if (!attempt) return;
        setStoppingStart(true);
        try {
            const r = await jpost(EXPANDER + "/comfy/startup/cancel", { attempt: attempt.id }, 30000);
            setMsg(r?.message || (r?.ok ? "已请求停止启动" : "停止启动失败"));
        } catch (e) {
            setMsg("停止启动失败：" + errText(e));
        } finally {
            setStoppingStart(false);
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
    /** 底模选择场景：kind 为 all / unet / checkpoint / diffusion / ckpt 之一 */
    const isBaseModelPick=()=>{
        // ⚠️ 从底模卡进来时 componentPicker 被 openModelLibrary 置成 null，
        //    所以主判据只能是 modelLibraryKind；componentPicker 仅作补充。
        const k=String(modelLibraryKind||"").toLowerCase();
        if(k==="all"||k==="unet"||k==="checkpoint"||k==="diffusion"||k==="ckpt")return true;
        const pk=String((componentPicker&&componentPicker.kind)||"").toLowerCase();
        return pk==="all"||pk==="unet"||pk==="checkpoint"||pk==="diffusion"||pk==="ckpt";
    };
    /**
     * 拉全机底模清单（diffusion_models + checkpoints 合并）。
     * 直接问 ComfyUI 的两个 loader 枚举，和绘图台底模下拉同源，不用扫文件系统。
     */
    async function loadFlatBaseModels(){
        setFlatBaseLoading(true);
        const out=[];
        try{
            try{
                const u=await jget(COMFY+"/object_info/UNETLoader",20000);
                comboOptions(u,"UNETLoader","unet_name").filter(x=>!/^put_/.test(x)).forEach(n=>out.push({name:n,source:"diffusion"}));
            }catch(e){}
            try{
                const c=await jget(COMFY+"/object_info/CheckpointLoaderSimple",20000);
                comboOptions(c,"CheckpointLoaderSimple","ckpt_name").filter(x=>!/^put_/.test(x)).forEach(n=>out.push({name:n,source:"checkpoint"}));
            }catch(e){}
        }finally{
            setFlatBaseModels(out);
            setFlatBaseLoading(false);
        }
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
        // 底模场景不走目录树，也就不必扫文件系统：直接问 ComfyUI 要两个 loader 的枚举。
        if(isBaseModelPick()){loadFlatBaseModels();return;}
        const timer=setTimeout(()=>loadModelLibrary(modelLibraryKind),modelLibraryQuery?180:0);
        return()=>{clearTimeout(timer);modelLibraryLoadRef.current?.abort();modelLibraryLoadRef.current=null;};
    },[showModelLibrary,modelLibraryKind,modelActiveFolder.root_id,modelActiveFolder.path,modelLibraryQuery,componentPicker&&componentPicker.kind]);
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
        // 在模型库点「使用」选中底模时，把名字回传给生成页那份 ckpt（两套 state）。
        //
        // ⚠️ 2026-10-31：原来只有 mode==="checkpoint" 才回传，于是选 diffusion 类底模
        //    （Anima / MOSS，住在 diffusion_models 里）时生成页根本收不到，界面看着
        //    像是「点了使用但没反应」。两条链都要回传。
        if(typeof MODEL_PICKED_SINK==="function"){try{MODEL_PICKED_SINK(name);}catch(e){/* 生成页未挂载时忽略 */}}
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
        // —— 底模场景：扁平清单，不显示文件夹 ——
        //
        // 2026-10-31：底模分成 diffusion_models 与 checkpoints 两个目录，用户要记
        // 「哪个目录放哪类模型」才能找到东西，而点底模卡时 kind 又被写死成 checkpoint，
        // 于是 MOSS 这类放在 diffusion_models 的底模根本不出现在列表里。
        // 这里改成一次性列出两边全部底模，选完由 applyFocusedModel 回写并触发自动适配。
        if(isBaseModelPick()){
            const q=modelLibraryQuery.trim().toLowerCase();
            const list=flatBaseModels.filter(x=>!q||x.name.toLowerCase().includes(q));
            const rowFor=(x)=>{
                const kind=x.source==="diffusion"?"diffusion":"checkpoint";
                const item={name:x.name,file:x.name,kind,root_id:0,is_model:true};
                const key=libraryItemKey(item),selected=modelLibrarySelection.includes(key),focused=modelLibraryFocus&&modelLibraryFocus.name===x.name&&(modelLibraryFocus.kind||"")===kind;
                return h("button",{type:"button",key:"flat:"+kind+":"+x.name,
                    className:"cc-model-tree-row"+((selected||focused)?" is-selected":""),
                    "aria-pressed":!!(selected||focused),
                    title:x.name+"（"+kind+"）",
                    onClick:()=>{setModelLibraryFocus(item);setModelLibrarySelection([key]);}},
                    h("span",{className:"cc-model-tree-icon"},h(PromptIcon,{name:"file",size:14})),
                    h("span",{className:"cc-model-tree-name"},
                        h("span",null,x.name),
                        h("small",null,kind==="diffusion"?"diffusion_models · UNETLoader":"checkpoints · CheckpointLoader")),
                    h("span",{className:"cc-model-tree-meta"},kind==="diffusion"?"diffusion":"ckpt"));
            };
            return h("div",{className:"cc-model-tree","data-cc-guide":"model-library-left"},
                h("div",{className:"cc-model-tree-nav"},
                    h("span",{className:"cc-model-tree-root","aria-label":"底模清单"},(componentPicker&&componentPicker.label)||"全部底模"),
                    h("button",{type:"button",className:"cc-library-icon",style:S.btn2,"aria-label":"刷新底模清单","data-cc-tooltip":"刷新底模清单","aria-busy":flatBaseLoading,onClick:loadFlatBaseModels},
                        flatBaseLoading?h(PromptIcon,{name:"spinner",size:16}):h(PromptIcon,{name:"refresh",size:16}))),
                h("div",{className:"cc-model-tree-scroll"},
                    flatBaseLoading
                        ? h("div",{className:"cc-model-library-loading",role:"status"},h("span",{className:"cc-icon-spinner"},h(PromptIcon,{name:"spinner",size:14})),"正在读取底模清单…")
                        : list.length
                            ? list.map(rowFor)
                            : h("div",{className:"cc-model-library-empty"},q?"没有匹配的底模":"本机没有底模")));
        }
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
                h("div",{className:"cc-model-library-hint"},isBaseModelPick()
                    ? "全部底模已合并列出（diffusion_models + checkpoints）· 单击选中 → 右侧「使用」→ 自动加载配套编码器与 VAE"
                    : "目录内单击展开 · Ctrl/⌘ 多选 · Shift 连选 · 拖动模型或文件夹移动")));
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
            const saved=items.map(x=>({...x,saved:true,source:"output",url:savedOutputUrl(x.path, x.mtime)}));
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
        /* 0.7.131：把 mtime 拼进 URL 当版本号。侧车的 /outputs/thumb 带 `Cache-Control:
           private, max-age=300`，而 URL 里只有 path+quality——同名文件被重新生成/覆盖时
           URL 一字不变，浏览器 5 分钟内继续拿旧缩略图，卡片上的图就和文件对不上。
           侧车自己的缓存 key 含 mtime_ns，问题只出在浏览器这一层。 */
        const _v = item.mtime || item.createdAt || 0;
        return EXPANDER+"/outputs/thumb?path="+encodeURIComponent(item.path)+"&quality="+encodeURIComponent(outputPreviewQuality)+"&v="+encodeURIComponent(String(_v));
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
    // 0.7.165：历史页批量删除。单张删除仍走每张卡片右上角的按钮（manageOutput），
    // 这里只管「进入勾选模式 → 全选/逐张勾 → 一次确认 → 逐张走同一个接口」。
    function toggleOutputSelect(item){
        const key=outputKey(item);
        setOutputSelected(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});
    }
    function exitOutputDeleteMode(){setOutputDeleteMode(false);setOutputSelected(new Set());}
    function toggleOutputSelectAll(){
        const keys=filteredOutputs().map(outputKey);
        setOutputSelected(prev=>{
            const next=new Set(prev);
            if(keys.length&&keys.every(k=>next.has(k)))keys.forEach(k=>next.delete(k));
            else keys.forEach(k=>next.add(k));
            return next;
        });
    }
    async function deleteSelectedOutputs(){
        const picked=outputItems.filter(x=>outputSelected.has(outputKey(x)));
        if(!picked.length){setMsg("请先勾选要删除的图片");return;}
        const files=picked.filter(x=>x.path).length,temps=picked.length-files;
        const ask="确定永久删除选中的 "+files+" 张图片文件？"+(temps?"另有 "+temps+" 条 Temp 记录会一起从本次会话移除。":"")+"此操作无法撤销。";
        if(!window.confirm(ask))return;
        setOutputDeleting(true);
        let ok=0,fail=0;
        for(const item of picked){
            try{
                if(!item.path){SESSION_OUTPUTS.remove(item.promptId||outputKey(item));ok++;continue;}
                await jpost(EXPANDER+"/outputs/manage",{action:"delete",path:item.path},15000);
                SESSION_OUTPUTS.remove(item.promptId||item.id||item.path||item.url);
                ok++;
            }catch(e){fail++;}
        }
        setOutputDeleting(false);setOutputSelected(new Set());setOutputDeleteMode(false);setOutputDetail(null);
        try{await loadOutputs({force:true,silent:true});}catch(e){}
        setMsg(fail?("已删除 "+ok+" 张，"+fail+" 张失败，请刷新后重试"):("已删除 "+ok+" 张图片"));
    }
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
    function applyOutputParams(item){if(expandPhaseRef.current!=="idle"){setMsg("请先完成或停止 AI 操作");return;}const _raw=item?.params||null;const p=_raw?{..._raw,...(_raw.generationInputs||{})}:null;if(!p||!Object.keys(p).length){setMsg("这张图片缺少可读取的 ComfyUI 生成参数，当前设置未改变");return;}const _need=["pos","neg","ckpt","modelConfig","steps","cfg","sampler","scheduler","w","baseW","seed","usedSeed","loras","upscale","sizeMultiplier"];if(!_need.some(k=>p[k]!==undefined)){setMsg("读到元数据但没有可套用的生成参数，当前设置未改变");return;}/* 0.7.130：套用历史参数 = 完全还原这张图的状态，先把上一张卡挂着的插入与禁词锁清掉，否则 stabilizePrompt 会拿旧锁把新提示词里的词当禁词剔掉（<角色>的裙长闸 / 体型锁最明显，表现为「同样的词换个卡构图就不对」）。*/if(CLEAR_CARD_STATE_SINK){try{CLEAR_CARD_STATE_SINK();}catch(e){}}if(p.pos!==undefined)updatePrompt({pos:p.pos||"",neg:p.negativeApplied===false?promptRef.current.neg:p.neg||""});if(p.ckpt||p.modelConfig){restoreModelSetup(p);}else{if(p.clip)setClip(p.clip);if(p.vae)setVae(p.vae);}if(p.clipType)setClipType(p.clipType);if(Array.isArray(p.loras))setSelLoras(p.loras);setW(p.baseW||p.w||w);setHh(p.baseH||p.h||hh);setSizeMultiplier(preciseSizeMultiplier(p.sizeMultiplier));if(p.steps)setSteps(p.steps);if(p.cfg!==undefined)setCfg(p.cfg);if(p.sampler)setSampler(p.sampler);if(p.scheduler)setScheduler(p.scheduler);if(p.usedSeed!==undefined||p.seed!==undefined)setSeed(p.usedSeed??p.seed);setSeedMode(p.seedMode||"lock");if(p.postControls||p.upscale!==undefined)setPostControls(normalizePost(p));if(p.upscale!==undefined)setUpscale(!!p.upscale);if(p.upscaleModel)setUpscaleModel(p.upscaleModel);if(p.upscaleFactor)setUpscaleFactor(p.upscaleFactor);setOutputDetail(null);switchTab("gen");setMsg("已用该图片的生成参数替换当前设置");}
    /**
     * 套用历史生成参数（2026-11-11 修）
     *
     * 原来按钮写的是 disabled:!item?.params —— 而列表接口 /outputs 为了轻量
     * 不带 params，只有 /outputs/detail 这条单条记录会带（侧车
     * _output_record(include_params=True)）。详情面板是异步合并的，按钮在
     * 参数回来之前一直是灰的；元数据缺失的图则永远灰着，点下去毫无反应，
     * 看起来就是「历史的套用功能坏了」。
     *
     * 现在按钮永远可点：手上没有参数就先补取一次 detail，取不到再明确告诉
     * 原因，不再静默。
     */
    async function applyOutputParamsWithFetch(item){
        if(!item){setMsg("没有选中图片");return;}
        if(item.params&&Object.keys(item.params).length){applyOutputParams(item);return;}
        if(!item.path){setMsg("Temp 输出没有持久文件路径，读不到生成参数");return;}
        setMsg("正在读取这张图的生成参数…");
        try{
            const data=await jget(EXPANDER+"/outputs/detail?path="+encodeURIComponent(item.path),20000);
            const merged={...item,...data,params:data.params||item.params||null};
            setOutputDetail(cur=>(cur&&outputKey(cur)===outputKey(item))?merged:cur);
            if(!merged.params||!Object.keys(merged.params).length){
                setMsg("这张图没有可读取的生成参数（PNG 元数据缺失，或不是本机 ComfyUI 生成的图），当前设置未改变");
                return;
            }
            applyOutputParams(merged);
        }catch(e){setMsg("读取生成参数失败："+errText(e));}
    }
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
                h("button",{type:"button",style:S.btn,title:"把这张图的提示词与全部生成参数还原到生成页",onClick:()=>applyOutputParamsWithFetch(item)},"套用此图生成设置"),
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
        // 0.7.130：历史卡片右上角加「打开图片位置」，直接调侧车 /outputs/manage
        // （详情页的「打开所在位置」按钮早就有了，但网格里每张图都得先点进详情才能用，
        //  找一张刚出的图要多两步）。stopPropagation 是必须的，否则会连带打开详情浮层。
        // 0.7.130：卡片右上角按钮组（打开位置 / 删除）。删除复用详情页的 manageOutput(item,"delete")，
        // 它自带 confirm 且删完会 loadOutputs 刷新；这里只负责阻止冒泡，别让点击穿透到卡片的 openOutputDetail。
        const cardBtn=(x,icon,title,action,danger)=>h("button",{type:"button",
            className:"cc-output-card-act"+(danger?" is-danger":""),
            title, "aria-label":title,
            onClick:e=>{e.stopPropagation();e.preventDefault();manageOutput(x,action);},
            onKeyDown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();manageOutput(x,action);}}},
            h(PromptIcon,{name:icon,size:15}));
        const revealBtn=(x)=>h("div",{className:"cc-output-card-actions"},
            x.path?cardBtn(x,"folder","在资源管理器中打开图片位置","open",false):null,
            cardBtn(x,"trash",x.path?"永久删除这张图片":"从本次会话移除这条记录","delete",true));
        const card=(x,index=0)=>{
            // 0.7.165：删除模式下点卡片 = 勾选，不再打开详情；勾选圈盖住右上角按钮组。
            const on=outputDeleteMode&&outputSelected.has(outputKey(x));
            return h("article",{key:outputKey(x),className:"cc-output-card"+(on?" is-selected":""),tabIndex:0,
                "aria-pressed":outputDeleteMode?on:undefined,
                onClick:()=>{if(outputDeleteMode)toggleOutputSelect(x);else openOutputDetail(x);},
                onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(outputDeleteMode)toggleOutputSelect(x);else openOutputDetail(x);}}},
                outputDeleteMode?h("span",{className:"cc-output-check","aria-hidden":"true"},h(PromptIcon,{name:on?"checkSquare":"square",size:19})):revealBtn(x),
                h("img",{src:outputPreviewSrc(x),
                    onError:e=>{/* 0.7.131：原来靠 dataset.fallback 防重入，但 React 复用节点时标记会留到下一张图，导致后续加载失败时不再回退。改成比对当前 src。 */const im=e.currentTarget;if(!x.url||!im.src||im.src===x.url)return;im.src=x.url;},
                    loading:index<8?"eager":"lazy",decoding:"async",fetchPriority:index<4?"high":"low",alt:x.filename||"输出图片"}),
                h("div",{className:"cc-output-card-meta"},
                    h("span",{className:"cc-output-card-name"},x.filename||"Temp 输出"),
                    h("div",{className:"cc-output-card-sub"},h("span",null,(x.width||"?")+" × "+(x.height||"?")+" · "+formatGenerationDuration(x)),h("span",{className:"cc-output-card-state"},x.saved?"已保存":"Temp"))));
        };
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
                    /* 0.7.131：带文字的刷新按钮。原来只有一个 31px 的纯图标按钮，还挤在横向
                       可滚动的工具栏里（overflow-x:auto + nowrap），窗口一窄就被推到可视区外，
                       看上去就像历史页根本没有刷新功能。这里在计数器左侧补一个带文字的按钮，
                       点击强制重扫磁盘（force:true 绕过 60 秒缓存）。 */
                    /* 0.7.165：删除按钮就在「刷新」左边一颗。点一下进入勾选模式，这颗原地换成
                       「确认删除 (N)」，右边多出「取消」；刷新按钮全程可用，边勾边刷新也不会丢已选（按 key 记）。 */
                    outputDeleteMode?h(React.Fragment,null,
                        h("button",{type:"button",className:"cc-output-mode-btn",title:"勾选当前筛选结果里的全部图片",disabled:outputDeleting,onClick:toggleOutputSelectAll},
                            h(PromptIcon,{name:"checkSquare",size:14}),h("span",null,"全选")),
                        h("button",{type:"button",className:"cc-output-mode-btn is-danger",title:"永久删除勾选的图片",disabled:outputDeleting,onClick:deleteSelectedOutputs},
                            outputDeleting?h(PromptIcon,{name:"spinner",size:14}):h(PromptIcon,{name:"trash",size:14}),
                            h("span",null,outputDeleting?"删除中…":("确认删除"+(outputSelected.size?" ("+outputSelected.size+")":"")))),
                        h("button",{type:"button",className:"cc-output-mode-btn",title:"退出删除模式，已勾选的会清空",disabled:outputDeleting,onClick:exitOutputDeleteMode},
                            h(PromptIcon,{name:"x",size:14}),h("span",null,"取消")))
                    :h("button",{type:"button",className:"cc-output-mode-btn",title:"勾选并批量删除历史图片",onClick:()=>{setOutputSelected(new Set());setOutputDeleteMode(true);}},
                        h(PromptIcon,{name:"trash",size:14}),h("span",null,"删除")),
                    h("button",{type:"button",className:"cc-output-refresh-text",title:"重新扫描输出目录，把新出的图拉进来",disabled:outputLoading,onClick:()=>loadOutputs({force:true,silent:false})},
                        outputLoading?h(PromptIcon,{name:"spinner",size:14}):h(PromptIcon,{name:"refresh",size:14}),
                        h("span",null,outputLoading?"刷新中…":"刷新")),
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
        style: Object.assign({}, S.wrap, theme, cVarsFromCC(theme), (props && props.page) ? { paddingBottom: 0 } : null) },
        h("style", null, UI_CSS),
        // 固定的全局工具栏与页面导航，同属一个 sticky 容器。
        h("div",{ref:stickyShellRef,className:"cc-sticky-shell"},
		// 嵌入模式（props.page 有值）下这排整个隐藏：外层已经有 tab 条和二级页返回条，
		// 再叠一条 A 线自己的标题栏 + 关闭/模型库/释放显存/原界面/连接设置/教程 是重复的。
		// 连接设置在外层生成页有入口；其余动作在 A 线独立界面里仍然存在。
		(props && props.page) ? null : h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
			h("div", { style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", minWidth: 0 } },
				h("strong", { style: { fontSize: "15px" } }, "Comfy Cards Next"),
				status, renderTaskSummary()),
			h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 } },
				comfyUpdate?.available?h("button",{type:"button",className:"cc-update-btn",title:"ComfyUI 有新版本可用",onClick:()=>{setUpdateError("");setUpdateOpen(true);}},"可更新"):null,
				h(ComfyStartupButton, { theme,
					starting, online,
					session: startSession,
					stopping: stoppingStart,
					onConnect: connectionAction,
					onStop: stopStartup,
				}),
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

