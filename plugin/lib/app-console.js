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
	// 画布常驻：切走生成页**不再清图**（2026-11-10 用户要求）。
	// 只有「生成下一张」会覆盖、「清空 / 全部清空」按钮会清 —— 切页、刷新都保留最近一张。
	const setTab = (k) => {
		setTabRaw(k);
	};
	/** 实验性功能页：体检输出（放在主 Console 里，切 tab 不会丢） */
	const [labProbe, setLabProbe] = React.useState("");
	/** 版本更新检查结果（GitHub）；updBusy 供「立即检查」用 */
	const [upd, setUpd] = React.useState(null);
	const [updBusy, setUpdBusy] = React.useState(false);
	const [online, setOnline] = React.useState(null);
	const [conn, setConn] = React.useState(0);
	// ---- 启动过程（顶栏「启动 ComfyUI」→ 转圈 + 停止启动）----
	// 2026-11-01：原来是一个同步 jpost("/comfy/start", {}, 120000)，点完只有一行文字，
	// 按钮本身不变，看起来"什么都没发生"。改成后端后台线程 + attempt 轮询：
	// 点下去立刻换成红底「■ 停止启动」，每 800ms 拿一次阶段文字，结束时复原。
	const [launchAtt, setLaunchAtt] = React.useState(null);
	const [launchPhase, setLaunchPhase] = React.useState("");
	const launchAttRef = React.useRef(null);
	const launchLive = React.useRef(false);
	launchAttRef.current = launchAtt;
	React.useEffect(() => () => { launchLive.current = false; }, []);
	const stopLaunch = React.useCallback(async () => {
		const aid = launchAttRef.current;
		launchLive.current = false;
		setLaunchAtt(null); setLaunchPhase("");
		if (!aid) return;
		try { await jpost(EXPANDER + "/comfy/startup/cancel", { attempt: aid }, 15000); } catch (e) {}
		setMsg("已停止启动"); setOnline(null); setConn((c) => c + 1);
	}, []);
	const beginLaunch = React.useCallback(async () => {
		if (launchAttRef.current) return;
		const aid = (typeof crypto !== "undefined" && crypto.randomUUID)
			? crypto.randomUUID()
			: "att-" + Date.now() + "-" + Math.random().toString(16).slice(2);
		launchLive.current = true;
		setLaunchAtt(aid); setLaunchPhase("正在准备启动…");
		setOnline(null); setMsg("正在启动 ComfyUI…");
		try {
			const r = await jpost(EXPANDER + "/comfy/start", { mode: "background", attempt: aid }, 30000);
			if (!r || !r.ok) throw new Error((r && r.message) || "start 失败");
		} catch (e) {
			if (!launchLive.current) return;
			launchLive.current = false; setLaunchAtt(null); setLaunchPhase("");
			setOnline(false); setMsg("启动失败：" + errText(e));
			return;
		}
		const deadline = Date.now() + 180000;
		let snap = null;
		while (launchLive.current && Date.now() < deadline) {
			await new Promise((res) => setTimeout(res, 800));
			if (!launchLive.current) return;
			try {
				const sp = await jget(EXPANDER + "/comfy/startup?attempt=" + encodeURIComponent(aid), 6000);
				snap = (sp && sp.snapshot) || null;
			} catch (e) { continue; }
			if (snap && snap.phase) { setLaunchPhase(snap.phase); setMsg(snap.phase); }
			if (snap && snap.finishedAt) break;
		}
		if (!launchLive.current) return;
		launchLive.current = false; setLaunchAtt(null); setLaunchPhase("");
		if (snap && snap.cancelled) { setMsg("已停止启动"); setOnline(null); setConn((c) => c + 1); return; }
		if (!snap || !snap.finishedAt) { setOnline(false); setMsg("启动超时（180 秒内没有结果）"); return; }
		if (!snap.ok) { setOnline(false); setMsg("启动失败：" + (snap.message || "?")); return; }
		setMsg(snap.message || "ComfyUI 已启动");
		setOnline(null); setConn((c) => c + 1);
	}, []);

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
		MODEL_PICKED_SINK = (name) => {
			// 诊断：确认模型库的「使用」真的把名字回传到了这一侧。
			// 看不到这句 = 生成页没挂载（停在别的 tab）或 chooseMainModel 没调到钩子。
			DIAG("[诊断1] 收到底模 " + String(name));
			if (name) setCkpt((cur) => (cur === name ? cur : name));
		};
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
		// 诊断：effect 每次触发都把现场打出来，能直接看出是列表没到齐还是提前 return。
		try {
			DIAG("[诊断2] effect 触发 底模=" + ckpt + " | unets=" + unets.length + " ckpts=" + ckpts.length
				+ " clips=" + clips.length + " vaes=" + vaes.length + " | 已适配=" + (adaptedCkptRef.current || "无"));
		} catch (e) { }
		const FAMILY_CLIP_TYPE = {
			sdxl: "stable_diffusion", sd15: "stable_diffusion", sd2: "stable_diffusion", legacy: "stable_diffusion",
			flux: "flux", sd3: "sd3", anima: "qwen_image", moss: "moss_image",
		};
		(async () => {
			try {
				// ⚠️ 2026-10-31：kind 直接按底模实际所在目录定，不再拿 clipType 猜。
				//    原来猜的方向是「先有 clipType 才知道去哪个目录读元数据」，而 clipType
				//    又要靠这次适配来定 —— 循环依赖，切到 moss_image 时必然读错目录、
				//    拿到 d=null 然后静默放弃适配。
				//
				//    侧车的 kind 词表见 sidecar_aline.py 的 _MODEL_DIR_KEYS：
				//    diffusion_models 对应的 key 是 "diffusion"，不是 "unet"
				//    （传 "unet" 会被 /models/detail 直接退 400）。
				const _kind = unets.indexOf(ckpt) >= 0 ? "diffusion" : "checkpoint";
				let d = null;
				try {
					d = await jget(EXPANDER + "/models/detail?kind=" + _kind + "&name=" + encodeURIComponent(ckpt), 15000);
				} catch (e0) { d = null; }
				if (!d) {
					const _alt = _kind === "diffusion" ? "checkpoint" : "diffusion";
					try {
						d = await jget(EXPANDER + "/models/detail?kind=" + _alt + "&name=" + encodeURIComponent(ckpt), 15000);
					} catch (e1) { d = null; }
				}
				if (dead) return;
				const key = profileKeyFromModelBase(d && d.base_type) || profileKeyFromModelName(ckpt);
				const p = key ? MODEL_PROFILES[key] : null;
				// 注意：「未命中 profile」不等于出错。Anima 的 A 线 profile 用 stable_diffusion
				// 编码器，而本地面板要 qwen_image，套错会把底模当 checkpoint 送进去直接 400，
				// 所以 profileKeyFromModelBase 对 anima 故意返回空 —— 让它走下面按目录判链的兜底分支。
				const _dirSide = unets.indexOf(ckpt) >= 0 ? "diffusion_models" : "checkpoints";
				DIAG("[诊断3] base_type=" + ((d && d.base_type) || "读不到")
					+ " → key=" + (key || "空")
					+ " → " + (p ? "命中 " + (p.label || key) : "按目录判链"
						+ "（" + _dirSide + " ⇒ " + (unets.indexOf(ckpt) >= 0 ? "UNet 链" : "Checkpoint 链") + "，正常）"));
				// 元数据读不到、文件名也猜不出家族时，至少把链切对：
				// 底模在 diffusion_models 里就必须走 UNet 链，否则 ComfyUI 会拿它去
				// CheckpointLoaderSimple，直接报找不到该 checkpoint。
				if (!p) {
					const wantUnet = unets.indexOf(ckpt) >= 0;
					// ⚠️ 时序：clips / vaes 是异步填的，effect 第一次跑时可能还是空数组。
					//    这时挑不到编码器就不能记 ref，否则列表到齐后 effect 重跑会被拦，
					//    编码器永远是空的。只有该设的都设上了才落 ref。
					//
					// ⚠️ 2026-11：原来这里是 `wantUnet ? (/moss/i.test(ckpt) ? "moss" : "anima") : ""`
					//    —— 只要底模在 diffusion_models 里，不是 moss 就当 anima。
					//    Anima 与 MOSS 是本机唯二的 UNet 底模，所以当时成立；
					//    但市面上还有 HunyuanDiT / Chroma / Qwen-Image / Lumina 这类同样放进
					//    diffusion_models 的 DiT 底模，一律当 anima 会硬塞 qwen_3_06b 编码器 +
					//    qwen_image 链 —— 提交后要么 400，要么出图是坏的却报成功。
					//    认不出家族就不猜：只把加载链切对，编码器/VAE 原样留给用户，
					//    并明确报出来。宁可给一条能看懂的不匹配提示，也不要静默出错图。
					const fam2 = !wantUnet ? ""
						: (/moss/i.test(ckpt) ? "moss"
							: (/anima/i.test(ckpt) ? "anima" : ""));
					if (wantUnet && !fam2) {
						// 不猜配套件，也不动 clipType：UNet 链该用哪种编码器类型只有家族知道。
						// 记一次 ref，避免每次列表刷新都重弹同一条提示。
						adaptedCkptRef.current = ckpt;
						try {
							MSG("底模 " + ckpt + " 在 diffusion_models 里，但认不出是哪个家族；"
								+ "文本编码器类型、编码器与 VAE 请手动选择 —— "
								+ "自动猜会塞错编码器，出图报成功但内容是坏的。");
						} catch (e) { /* ignore */ }
						return;
					}
					const c2 = fam2 ? pickByHints(clips, PROFILE_CLIP_HINT[fam2]) : "";
					const v2 = fam2 ? pickByHints(vaes, PROFILE_VAE_HINT[fam2]) : "";
					const ready = wantUnet ? (!!c2 && !!v2) : (clips.length > 0 || vaes.length > 0 || ckpts.length > 0);
					if (adaptedCkptRef.current === ckpt && ready) return;
					if (!ready) return;   // 列表还没到齐，等下一次 effect
					adaptedCkptRef.current = ckpt;
					// ⚠️ 2026-10-31：这里原来是
					//        if (wantUnet) return isUnetClipType(cur) ? cur : "qwen_image";
					//    同一处病根：isUnetClipType 只分「UNet / 非 UNet」，不区分
					//    qwen_image 与 moss_image。从 MOSS 换成 Anima 时 cur 还是 moss_image，
					//    判定为「已经在 UNet 链上」就原样保留 —— 于是选 Anima 显示 moss_image。
					//    兜底分支本来就已经按文件名算出了 fam2，直接用它定具体类型。
					const wantType = wantUnet ? (fam2 === "moss" ? "moss_image" : "qwen_image") : "";
					setClipType((cur) => {
						if (wantUnet) return cur === wantType ? cur : wantType;
						return isUnetClipType(cur) ? (ckpts.length ? "stable_diffusion" : cur) : cur;
					});
					// 链切对了还得把配套件带上，否则首次使用时光有底模、编码器空着提交必 400。
					// 家族按文件名粗分：含 moss 的走 MOSS 那套（Qwen3.5-9B + FLUX.2 VAE），
					// 其余 UNet 族按 Anima（Qwen3 0.6B + Qwen-Image VAE）。
					if (wantUnet) {
						if (c2) setClip((cur) => (cur === c2 ? cur : c2));
						if (v2) setVae((cur) => (cur === v2 ? cur : v2));
						try { MSG("已按底模切换加载链 → " + (fam2 === "moss" ? "MOSS-Image" : "Anima（qwen_image）") + (c2 ? "、编码器 " + c2 : "") + (v2 ? "、VAE " + v2 : "")); } catch (e) { /* ignore */ }
					} else {
						// checkpoint 自带 CLIP 与 VAE，外挂件必须清空，否则会盖掉内置的
						setClip((cur) => (cur === "" ? cur : ""));
						setVae((cur) => (cur === "" ? cur : ""));
						// 家族认不出时，内置 CLIP/VAE 这条路对绝大多数整合包是对的，
						// 所以照常走；但用户有权知道「系统没认出来」，否则他换了采样参数
						// 对不上时会以为是自己的提示词问题。只说一次。
						try {
							MSG("底模 " + ckpt + " 的家族未能识别：已按 checkpoint 内置 CLIP/VAE 加载，"
								+ "采样按当前面板设置执行。若出图异常，请先确认底模实际架构。");
						} catch (e) { /* ignore */ }
					}
					return;
				}
				const fam = p.family;
				// 同一个底模只适配一次：之后用户手改编码器/VAE 不被反复覆盖。
				// 同样要等列表到齐，否则 MOSS 这种需要外挂编码器的会被空列表卡住。
				const needEnc = fam === "anima" || fam === "moss";
				const cNeed = needEnc ? pickByHints(clips, PROFILE_CLIP_HINT[fam]) : "";
				const vNeed = pickByHints(vaes, PROFILE_VAE_HINT[fam]);
				const ready2 = needEnc ? !!cNeed : true;
				if (adaptedCkptRef.current === ckpt && ready2) return;
				if (needEnc && !ready2) return;   // 等 clips 到齐再适配
				adaptedCkptRef.current = ckpt;
				const notes = [];
				const next = p.clipType || FAMILY_CLIP_TYPE[fam] || "";
				// UNet 族（qwen_image / moss_image）必须显式切过去，否则会留在 checkpoint 链上。
				//
				// ⚠️ 2026-10-31：这里原来有一句「同族内不覆盖用户细分选择」：
				//        if (isUnetClipType(cur) === isUnetClipType(next)) return cur;
				//    但 isUnetClipType 只回答「是不是 UNet 链」，qwen_image 与 moss_image
				//    都算 true，于是 Anima → MOSS 这一跳被判成「同族」直接 return，
				//    编码器类型永远停在 qwen_image —— 这正是「编码器类型还是不变」。
				//    profile 已经明确给出该用的具体类型，按它切就行，不需要这层拦。
				if (next) {
					setClipType((cur) => (cur === next ? cur : next));
					if (next !== clipType) notes.push("类型 " + next);
				}
				// VAE：按家族线索从 vaes 里挑；checkpoint 系没有线索就走内置（清空）。
				const v = pickByHints(vaes, PROFILE_VAE_HINT[fam]);
				setVae((cur) => {
					if (v) return cur === v ? cur : v;
					return fam === "anima" || fam === "moss" ? cur : "";   // checkpoint 系用内置 VAE
				});
				if (v) notes.push("VAE " + v);
				// 编码器：anima / moss 这类 UNet 族必须外挂文本编码器；checkpoint 系清空走内置 CLIP。
				//
				// ⚠️ 2026-10-31：原来只有 fam === "anima" 这一支，MOSS 选完底模后
				//    「文本编码器」还空着，直接提交会因为 CLIPLoader 拿不到 clip 而 400。
				if (fam === "anima" || fam === "moss") {
					const c = pickByHints(clips, PROFILE_CLIP_HINT[fam]);
					if (c) { setClip((cur) => (cur === c ? cur : c)); notes.push("编码器 " + c); }
				} else {
					setClip((cur) => (cur === "" ? cur : ""));
				}
				if (notes.length) {
					try { MSG("已按底模自动适配：" + (p.label || key) + " → " + notes.join("、") +
						(fam === "anima" || fam === "moss" ? "" : "（编码器与 VAE 走 checkpoint 内置）")); } catch (e) { /* ignore */ }
				}
			} catch (e) { /* 读不到元数据就保持现状，不猜 */ }
		})();
		return () => { dead = true; };
	}, [ckpt, vaes, clips, unets.length, ckpts.length]);
	const [selLoras, setSelLoras] = React.useState((L.loras && L.loras.length) ? L.loras : MODEL_DEFAULTS.loras);
	const [pos, setPos] = React.useState(L.pos || "");
	const [neg, setNeg] = React.useState(L.neg || "");
	/* 随机系统账本：记录每个槽位当前由随机按钮写进提示词的那段文本。
	   再按任意一个随机按钮时，先把这些旧值逐词剥掉，再写新值 —— 这就是「再按一次换掉旧的随机词」。
	   用户自己敲的词不在账上，永远不会被删。用 ref 而不是 state：它只影响下一次点击的替换口径，
	   不需要触发重渲染。

	   落盘到 localStorage：账本一旦只活在内存里，刷新页面或重启 dsh web 就清零，
	   上一次随机写进去的词会被当成"用户手写"永久保护起来 —— 按一次多攒一套姿势，
	   攒到五六套时模型只能在冲突里折中，每张图看起来都一个样。 */
	const rndBySlot = React.useRef(null);
	if (rndBySlot.current === null) {
		let saved = null;
		try { saved = JSON.parse(window.localStorage.getItem("dsh.comfy.rndBySlot") || "null"); } catch (e) { saved = null; }
		rndBySlot.current = (saved && typeof saved === "object") ? saved : {};
	}
	const rndSaveLedger = (obj) => {
		try { window.localStorage.setItem("dsh.comfy.rndBySlot", JSON.stringify(obj || {})); } catch (e) { /* 隐私模式下写不了就算了 */ }
	};
	/* 每个槽位「历史上被随机按钮写过的所有词」的集合。
	   三个随机按钮每次按下都会用它把残留一起剥掉：账本只记当前一轮，
	   而老版本留下的堆积、换了浏览器、清了 localStorage 这些情况账本都是空的，
	   只有这份历史能认出「哪些词当初是随机来的」，才不会越按越乱。 */
	const rndSeen = React.useRef(null);
	if (rndSeen.current === null) {
		let savedSeen = null;
		try { savedSeen = JSON.parse(window.localStorage.getItem("dsh.comfy.rndSeen") || "null"); } catch (e) { savedSeen = null; }
		rndSeen.current = (savedSeen && typeof savedSeen === "object") ? savedSeen : {};
	}
	const rndSaveSeen = (obj) => {
		try { window.localStorage.setItem("dsh.comfy.rndSeen", JSON.stringify(obj || {})); } catch (e) { /* 同上 */ }
	};
	/* 上一次抽到的姿势族。90 条姿势里「站」占 21%、「躺」14%、「坐」13%，纯均匀抽的话
	   三张里至少两张同族的概率是 41.6%，肉眼看就是"一直一个姿势"。所以抽之前先排除上一族。
	   记两族而不是一族：只排一族时，三张里「A B A」这种首尾撞车仍占 18.7%。 */
	const rndLastPoseFam = React.useRef([]);
	/* 分镜同理：距离（全身/中景/特写…）和角度（仰/俯/侧/背/过肩）各记最近两族。
	   62 条分镜里「全身+正面」占大头，纯均匀抽三张出来很容易看起来是同一个机位。 */
	const rndLastFrameDist = React.useRef([]);
	const rndLastFrameAngle = React.useRef([]);
	/* 光影同理：30 段分冷/暖/硬/柔/特效/对比六族，连着两张都用「霓虹溢光」等于没换。 */
	const rndLastLightFam = React.useRef([]);
	/* 场景同理：190 段分十族，不分族的话「森林→森林→山谷」看起来就是野外一路到头。 */
	const rndLastSceneFam = React.useRef([]);
	/* 道具同理：157 段分束缚/军事/血腥/兵器/音乐/食物/电子/工具/自然/织物/杂项，
	   不分族的话手枪完了还是手枪、茶杯完了还是茶杯。 */
	const rndLastPropFam = React.useRef([]);
	/* 外观 / 表情 / 附加特征 / 服饰 / 画风：这五个槽位原来只有纯均匀抽取，
	   池子再大也会连撞（100 段外观里「长发」占一半，三张全是长发很常见）。 */
	const rndLastLookFam = React.useRef([]);
	const rndLastMoodFam = React.useRef([]);
	const rndLastExtraFam = React.useRef([]);
	const rndLastOutfitFam = React.useRef([]);
	const rndLastStyleFam = React.useRef([]);
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
		// 开关开着但已经没有可挂条件图的卡了 → 一起关掉，别让下一次出图带着空的 plan 跑
		try { if (llliteOn && !llliteCards().length) { setLllliteOn(false); COND.clear(); } } catch (e) { }
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
	/**
	 * 工作流支路开关（0.8.1）。
	 *
	 * 这三个是 buildGraph 从「固定图」变成「可组合图」的第一步 ——
	 * 都是可选支路，关掉时工作流与 0.8.0 逐节点一致，不开的人完全不受影响。
	 *
	 *   hires         二次采样：latent 放大再低 denoise 过一遍（33/34/35）
	 *   splitEncoding 提示词分段编码：按空行切开分别编码再拼（41.. / 51.. / 61.. / 71..）
	 *   initImage     图生图：LoadImage → VAEEncode → KSampler(denoise<1)（36/37）
	 */
	const [hires, setHires] = React.useState(Object.assign({ enabled: false, denoise: 0.45, scale: 1.5 }, L.hires || {}));
	/**
	 * 【实验性】手 / 脚局部重绘（节点 40 起）。
	 *   mode  off 关闭 / hands 只手 / feet 只脚 / both 手+脚
	 *   denoise 这块区域的重画强度（0.35 轻改、0.55 重画）
	 *   guide   裁出来的区域放大到多高再重采（768 = 细节明显，但慢）
	 * 区域按画面比例猜，不靠检测器 —— 所以是实验性功能，默认 off。
	 */
	const [detail, setDetail] = React.useState(Object.assign({ mode: "off", denoise: 0.42, guide: 768 }, L.detail || {}));
	const [splitEncoding, setSplitEncoding] = React.useState(!!L.splitEncoding);
	const [initImage, setInitImage] = React.useState(Object.assign({ image: "", denoise: 0.6 }, L.initImage || {}));
	const [inputImages, setInputImages] = React.useState([]);
	/**
	 * 图生图的二级选择面板（0.8.1）。
	 * 原来只有一个下拉读 ComfyUI input 目录 —— 那里面通常什么都没有。
	 * 现在点「选择」弹面板，两个来源：历史（output 目录，走侧车 /outputs）与自己上传。
	 * 两者最终都落到 ComfyUI input/dsh_init/（LoadImage 只认 input 目录）。
	 */
	const [initOpen, setInitOpen] = React.useState(false);
	const [initTab, setInitTab] = React.useState("history");
	const [initHistory, setInitHistory] = React.useState([]);
	const [initBusy, setInitBusy] = React.useState(false);
	// ---- 图生图入口：原来在 libTab 里，画布右下角的「工作流支路」也要调，提到 Console 主体 ----
	/** 打开面板并拉一次历史（output 目录最近 48 张） */
	async function openInitPicker() {
		setInitOpen(true);
		setInitTab("history");
		await loadInitHistory();
	}
	/** 历史列表：侧车 /outputs 扫 outputDir，返回 items[].{path,filename,width,height,mtime} */
	async function loadInitHistory() {
		setInitBusy(true);
		try {
			const r = await jget(EXPANDER + "/outputs?limit=48", 20000);
			setInitHistory((r && r.items) || []);
		} catch (e) {
			setMsg("拉不到历史图：" + errText(e));
			setInitHistory([]);
		} finally {
			setInitBusy(false);
		}
	}

		// OverlayModal 要的是 --cc-* 变量对象（hostPalette 的产物），不是面板自己的 theme state。
		// 只在面板打开时算一次，避免每次渲染都 getComputedStyle。
		const ccVars = initOpen && typeof document !== "undefined"
			? hostPalette(document.querySelector(".dsh-comfy-ui") || document.body)
			: undefined;

	/** 选中历史图 → 侧车铺到 ComfyUI input/dsh_init → 记进 initImage.image */
	async function pickInitFromHistory(it) {
		setInitBusy(true);
		try {
			const r = await jpost(EXPANDER + "/comfy/stage-init", { path: it.path }, 40000);
			if (r && r.ok) {
				setInitImage(Object.assign({}, initImage, { image: r.image }));
				setInitOpen(false);
				setMsg("已用这张作初始图：" + r.name);
			} else {
				setMsg("铺图失败：" + ((r && r.error) || "未知原因"));
			}
		} catch (e) {
			setMsg("铺图失败：" + errText(e));
		} finally {
			setInitBusy(false);
		}
	}
	/** 自己上传：FileReader 读成 dataURL → 侧车 base64 落盘 → 同样记进 initImage.image */
	async function uploadInitFile(files) {
		const f = files && files[0];
		if (!f) return;
		setInitBusy(true);
		try {
			const dataUrl = await new Promise((res, rej) => {
				const fr = new FileReader();
				fr.onload = () => res(String(fr.result || ""));
				fr.onerror = () => rej(new Error("读文件失败"));
				fr.readAsDataURL(f);
			});
			const r = await jpost(EXPANDER + "/comfy/stage-init", { name: f.name, b64: dataUrl }, 90000);
			if (r && r.ok) {
				setInitImage(Object.assign({}, initImage, { image: r.image }));
				setInitOpen(false);
				setMsg("已上传并设为初始图：" + r.name);
			} else {
				setMsg("上传失败：" + ((r && r.error) || "未知原因"));
			}
		} catch (e) {
			setMsg("上传失败：" + errText(e));
		} finally {
			setInitBusy(false);
		}
	}
	// 主题：跟随系统 / 浅色 / 深色 / 纯白 / 纯黑 / 自定义（存进 USER.last，下次打开还是这个）
	const [theme, setTheme] = React.useState(Object.assign({}, THEME_DEFAULTS, L.theme || {}));
	/**
	 * SelectMenu / OverlayModal 的弹层走 createPortal 挂到 body 下，拿不到
	 * .dsh-comfy-ui 上的 CSS 变量，必须把 --cc-* 显式传进去。
	 * 注意 theme 是「主题设置对象」（mode/bg/fg），不是变量表 —— 直接传它会让
	 * 弹层没有 --cc-surface / --cc-border，背景透明、边框消失。
	 */
	const [uiVars, setUiVars] = React.useState({});
	React.useEffect(() => {
		if (typeof document === "undefined") return undefined;
		const el = document.querySelector(".dsh-comfy-ui") || document.body;
		let dead = false;
		const apply = () => {
			if (dead) return;
			const next = hostPalette(el);
			setUiVars((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
		};
		apply();
		// --c-* 由 resolveTheme 在同一帧注入，等它落盘后再测一次拿到真实底色
		const timer = setTimeout(apply, 80);
		return () => { dead = true; clearTimeout(timer); };
	}, [theme]);
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
	  saveLast({ ckpt, clip, clipType, vae, loras: selLoras, w, h: hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, sizeMultiplier, seedMode, hires, splitEncoding, initImage, detail });
	}, [ckpt, clip, clipType, vae, selLoras, w, hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, sizeMultiplier, seedMode]);

	const [msg, setMsg] = React.useState("");
	// 插件版本探针：loaded = 本进程装载的版本，disk = 磁盘版本；不一致=包换了但没重启
	const [ver, setVer] = React.useState(null);
	MSG_SINK = setMsg;   // 让模块级 MSG() 走同一个提示位

	/**
	 * 版本推送：启动 6 秒后静默问一次 GitHub（只提示，不下载、不替换文件）。
	 * 手动检查在「实验性功能」页，带 force=1 绕缓存。失败静默——不能因为没网就弹一堆错。
	 */
	React.useEffect(() => {
		let alive = true;
		const tm = setTimeout(() => {
			jget(EXPANDER + "/update/check", 15000).then((d) => {
				if (!alive || !d) return;
				setUpd(d);
				if (d.ok && d.hasUpdate) MSG("有新版本 " + d.latest + "（当前 " + d.current + "）· 详情在「实验性功能」页");
			}).catch(() => { /* 静默 */ });
		}, 6000);
		return () => { alive = false; clearTimeout(tm); };
	}, []);

	function checkUpdateNow() {
		if (updBusy) return;
		setUpdBusy(true);
		jget(EXPANDER + "/update/check?force=1", 15000)
			.then((d) => {
				setUpd(d || null);
				if (d && d.ok) setMsg(d.hasUpdate ? "有新版本 " + d.latest + "（当前 " + d.current + "）" : "已是最新版本 " + d.current);
				else setMsg("检查失败：" + ((d && d.error) || "未知原因"));
			})
			.catch((e) => setMsg("检查失败：" + ((e && e.message) || e)))
			.then(() => setUpdBusy(false));
	}

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
	/* 0.7.130：生成页的身份控制开关。卡里 conditioning.enabled 默认 false（场景出图不该被
	   控制图锁住姿态和背景），需要锁脸/锁衣服时在面板上临时打开，只影响本次会话。 */
	const [llliteOn, setLllliteOn] = React.useState(false);
	const [lllitePick, setLlllitePick] = React.useState("");
	React.useEffect(() => COND.subscribe(() => setCondVer((v) => v + 1)), []);
	/** 当前插入的角色卡里，带 conditioning.presets 的那些（面板据此决定要不要显示开关） */
	function llliteCards() {
		const ids = INSERTED.chars().map((r) => String(r.id || ""));
		return (USER.cards || []).filter((c) => c && c.conditioning && c.conditioning.presets
			&& Object.keys(c.conditioning.presets).length
			&& ids.indexOf(String(c.id || c.name || "")) >= 0);
	}
	/** 开关切换：开 → 临时 resolve（绕过卡里的 enabled）；关 → 清空 plan，节点整段不进图 */
	async function toggleLllite(next, card, preset) {
		const target = card || llliteCards()[0];
		if (!next || !target) { setLllliteOn(false); COND.clear(); return; }
		setLllliteOn(true);
		const cond = target.conditioning || {};
		const keys = Object.keys(cond.presets || {});
		const key = String(target.id || target.name || "");
		if (preset && keys.indexOf(preset) >= 0) COND.picks[key] = preset;
		else if (lllitePick && keys.indexOf(lllitePick) >= 0) COND.picks[key] = lllitePick;
		setLlllitePick(COND.pickOf(target, keys));
		const r = await COND.resolve(target, [Number(w), Number(hh)], true);
		if (r && r.status === "resolved") setMsg("身份控制已开启（" + (COND.pickOf(target, keys)) + " · 强度 " + r.strength + "）");
		else setMsg("身份控制开启失败：" + ((r && (r.reason || r.status)) || "未知原因"));
	}
	/** 角色卡「插入」的二级菜单：存当前打开菜单的卡 id */
	const [insMenu, setInsMenu] = React.useState("");
	/** 风格卡：选中 / 编辑中的草稿 / 插入二级菜单 */
	const [styleSel, setStyleSel] = React.useState("");
	const [styleEdit, setStyleEdit] = React.useState(null);
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
	/** 词库二级视图：分类词库 / 提示词段构建 */
	const [segOn, setSegOn] = React.useState(false);
	/** 段构建：槽位 → 该段完整键名 */
	const [segSel, setSegSel] = React.useState({});
	/** 段构建：正在挑选的槽位 */
	const [segOpen, setSegOpen] = React.useState("style");
	/** 段构建：评级 */
	const [segRating, setSegRating] = React.useState("rating:questionable");
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
      }, [expandOpen, apiOpen, loraOpen, promptOpen, cardEdit, insMenu, tagAt, styleEdit, styleMenu, impRep]);
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
				// 图生图的初始图：ComfyUI input 目录里的文件（面板上传时侧车会 staging 到这里）
				try {
					const li = await jget(COMFY + "/object_info/LoadImage");
					const _ii = comboOptions(li, "LoadImage", "image");
					if (!dead) setInputImages(_ii);
				} catch (e) { /* 没有 LoadImage 节点就先空着 */ }
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
					// 浏览器打不通不代表服务没起：ComfyUI 的 origin 校验对外部 Origin 直接 403，
					// 而那个 403 不带 Access-Control-Allow-Origin，浏览器一律报 Failed to fetch。
					// 侧车不受同源策略约束，让它替我们判一次，才能给出准确的下一步。
					let srv = null;
					try { srv = await jget(EXPANDER + "/comfy/online", 4000); } catch (e2) { /* 侧车也没起 */ }
					if (dead) return;
					if (srv && srv.running && srv.cors === false) {
						setMsg("ComfyUI 在线，但页面被跨域拒绝（它由外部启动，没开 CORS）——点右上「重启 ComfyUI」，由插件带 CORS 接管");
					} else if (srv && srv.running) {
						setMsg("ComfyUI 在线但页面打不开（" + COMFY + "）：检查面板的 ComfyUI 地址是否指向它");
					} else {
						setMsg("ComfyUI 未运行：点右上「启动 ComfyUI」，或在 ComfyUI 目录里手动跑 main.py");
					}
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


	// 底模分两条链：UNet 族（编码器类型在 UNET_CLIP_TYPES 里，如 qwen_image / moss_image）
	// 走 UNETLoader 读 diffusion_models，其余走 CheckpointLoaderSimple 读 checkpoints。
	// 两边的名字不能互相投递——混投会被 ComfyUI 校验拦成 HTTP 400
	// （2026-10-20 实测：animagine-xl-3.1 被塞进 UNETLoader）。
	//
	// ⚠️ 2026-10-31：判定方向反过来了。原来是「先看 clipType 决定去哪个目录找底模」，
	//    于是选 moss_image 要先滚 30 项类型下拉，模型库还会落错目录。
	//    现在改成「看底模落在哪个目录决定走哪条链」——选了 diffusion_models 里的文件
	//    就是 UNet 链，选了 checkpoints 里的就是 ckpt 链，clipType 随后自动跟上。
	//    ckpt 为空（首次进入）时才退回按 clipType 猜。
	const ckptIsUnet = !!ckpt && unets.indexOf(ckpt) >= 0;
	const isAnima = ckpt ? ckptIsUnet : isUnetClipType(clipType);
	const modelList = ckptIsUnet ? unets : ckpts;
	/** 跨目录的合并列表：扁平选择界面用，也用作「这个名字本机认不认」的判据 */
	const allModels = unets.concat(ckpts);
	/** 只在这名字两个目录都没有时算错——跨目录选底模是本设计的正常行为，不是错误 */
	const modelBad = !!ckpt && allModels.length > 0 && allModels.indexOf(ckpt) < 0;
	/** 底模卡上那句提示的来源标签 */
	const ckptSourceLabel = ckptIsUnet ? "diffusion" : "checkpoint";
	/**
	 * 某分支上次用的底模（USER.last.byType 里按 unet / ckpt 各存一份）。
	 * 2026-10-31：原来 UNet 那格叫 "qwen_image"，于是 qwen_image 与 moss_image 抢同一个槽，
	 * 切换一次就把对方的选择覆盖掉。改成中性 key "unet"，老存档回退读旧 key。
	 */
	const savedModelFor = (anima) => {
		const bt = (USER.last && USER.last.byType) || {};
		if (!anima) return bt["ckpt"] || "";
		return bt["unet"] || bt["qwen_image"] || "";
	};
	/**
	 * UNet 族各自的文件名线索：切到某个族时，优先在这个族里挑长得像的底模。
	 *
	 * ⚠️ 2026-10-31：pickModelFor 原来无条件优先 anima-aesthetic-v1.1.safetensors，
	 *    于是选 moss_image 时会把 Anima 的底模塞进 UNETLoader —— 名字对但权重错，
	 *    ComfyUI 会拿 Anima 的权重去跑 MOSS 的文本编码器和 FLUX.2 VAE，出来是噪声。
	 */
	const UNET_MODEL_HINTS = {
		qwen_image: [/anima/i, /qwen/i],
		moss_image: [/moss/i],
	};
	/** 按 clipType 在该族的底模列表里挑一个像样的；挑不到返回 "" */
	const pickUnetByHint = (type, list) => {
		const hints = UNET_MODEL_HINTS[String(type || "")] || [];
		for (const re of hints) {
			const hit = list.find((x) => re.test(String(x || "")));
			if (hit) return hit;
		}
		return "";
	};
	/** 切分支时挑底模：本分支上次用的 > 当前值（若在新列表里）> 该族线索命中 > 列表第一个 */
	const pickModelFor = (type) => {
		const anima = isUnetClipType(type);
		const list = anima ? unets : ckpts;
		if (ckpt && list.indexOf(ckpt) >= 0) return ckpt;          // 眼下这个在新分支里有效 -> 优先保住
		const saved = savedModelFor(anima);
		if (saved && list.indexOf(saved) >= 0) return saved;       // 否则回到该分支上次用的
		if (anima) {
			// 先把本族线索命中的用上；moss_image 不会再被塞 Anima 的权重
			const byHint = pickUnetByHint(type, list);
			if (byHint) return byHint;
			const animaDefault = pickUnetByHint("qwen_image", list);
			if (animaDefault) return animaDefault;
		}
		return list[0] || "";
	};
	/**
	 * ⚠️ 2026-10-21：本机 diffusion_models 是空的（UNETLoader.unet_name 0 条），
	 *    但 0.6.0 的 MODEL_DEFAULTS.clipType 就是 qwen_image，于是面板一上来停在
	 *    Anima 分支、底模下拉空空如也，看起来像"模型没法选"。
	 *    这里在「UNet 分支没有底模、而 checkpoints 有」时自动切到别的编码器类型。
	 *    将来真往 diffusion_models 放了模型（unets 不为空），这条就不再触发。
	 */
	React.useEffect(() => {
		if (!isUnetClipType(clipType)) return;
		if (unets.length > 0 || ckpts.length === 0) return;
		const alt = (clipTypes || []).filter((x) => !isUnetClipType(x))[0];
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
		// 同一族里再按该族线索挑（moss_image 挑 moss*，qwen_image 挑 anima*）；
		// 原来这里写死 anima-aesthetic，选 moss_image 时会塞给 UNETLoader 一个 Anima 权重。
		const prefer = (isAnima ? pickUnetByHint(clipType, modelList) : "") || modelList[0];
		setCkpt(prefer);
	}, [clipType, unets.length, ckpts.length]);

	// 参数变了就记住（下次进来还在）
	React.useEffect(() => {
		const byType = Object.assign({}, (USER.last && USER.last.byType) || {});
		if (ckpt) byType[isAnima ? "unet" : "ckpt"] = ckpt;
		USER.last = Object.assign({}, USER.last || {}, { ckpt, clip, clipType, vae, loras: selLoras, pos, neg, w, h: hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, byType, sizeMultiplier, seedMode, hires, splitEncoding, initImage, detail });
		saveUser();
	}, [ckpt, vae, clip, clipType, selLoras, pos, neg, w, hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, sizeMultiplier, seedMode, hires, splitEncoding, initImage, detail, seed, lockSeed, viewKey]);

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
			setMsg("底模「" + ckpt + "」在 diffusion_models 和 checkpoints 里都找不到。"
				+ "当前可用的底模：" + (allModels.join(" / ") || "无（先把权重放进 models 目录）"));
			return;
		}
		touch();
		setTab("gen");
		const _mc = multiCharAdjust(pos, neg);
		const _stab = stabilizePrompt(_mc.pos, _mc.neg, lockCards);
		if (_stab.moved) setMsg("特征锁：把 " + _stab.moved + " 个词从正向移到了负向（稳定角色特征）");
		if (_mc.n >= 2) setMsg("多角色模式：已挂 " + _mc.n + " 张角色卡 · 人数标签 " + _mc.n + "girls · 人物类数量负向已放行");
		// 身份控制：resolved 先把控制图/权重摆进 ComfyUI 目录，再接线；其余状态明说不静默
		// 面板开关开着但 plan 还没落定（刚插入卡 / 改过画布尺寸 / 上个会话残留）时补解析一次
		if (llliteOn && (!COND.plan || COND.plan.status === "off")) {
			const _cs = llliteCards();
			if (_cs.length) { try { await COND.resolve(_cs[0], [Number(w), Number(hh)], true); } catch (e) { } }
			else { setLllliteOn(false); }
		}
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
			hires, splitEncoding, initImage, detail,
		});
		await BG.run(graph, { w: _sz.w, h: _sz.h, steps, cfg, seed: _usedSeed, prefix, lllite: _extra ? _cp.weights_key + "/" + _cp.preset : "", hires, splitEncoding, initImage }, _extra);
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
		// 随机资料库也接进中文反查：把「RS-51 松林空地 → pine clearing, tall grass…」
		// 「RQ-12 跪伏抬头 → kneeling, head raised…」这类条目剥掉编号转成中文键。
		// 这样离线规则能认的就不只是 NL_EXTRA 里手写的那几百个词，而是整个资料库近千条。
		const RL = (typeof RND_LIB === "object" && RND_LIB) ? RND_LIB : null;
		if (RL) {
			for (const slot of Object.keys(RL)) {
				const pool = RL[slot];
				if (!pool || typeof pool !== "object") continue;
				for (const key of Object.keys(pool)) {
					const en = String(pool[key] || "").trim();
					if (!en) continue;
					const zh = String(key).replace(/^[A-Z]{2,3}-\d+\s*/, "").trim();
					if (!zh || zh === slot) continue;
					// 全名走正常合并；再挂两三个尾部核心词当别名，
					// 这样用户说「山林」也能命中「秋季山林」，不必把整条条目名背下来。
					// 别名只在没被占用时占位，绝不覆盖 NL_EXTRA / 词库里已有的词，
					// 否则「黄昏」会被一堆场景名的尾巴挤成几十段。
					const alts = [zh];
					if (zh.length >= 4) {
						alts.push(zh.slice(-3), zh.slice(-2));   // 尾部：「秋季山林」→「山林」
						alts.push(zh.slice(0, 2));               // 头部：「跪伏叩首」→「跪伏」
					} else if (zh.length === 3) { alts.push(zh.slice(-2), zh.slice(0, 2)); }
					for (let ai = 0; ai < alts.length; ai++) {
						const a = alts[ai];
						if (a.length < 2) continue;
						const prev = map[a];
						if (!prev) { map[a] = en; continue; }
						if (ai === 0) {
							// 同名条目（好几个「烛光」）合并成多行标签，封顶 10 段
							if (prev.split(", ").length < 10 && prev.indexOf(en) < 0) map[a] = prev + ", " + en;
						}
					}
				}
			}
		}
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
// 供历史页调用：把「当前挂着的卡」全部解除。清 INSERTED 同时给卡片去蓝框，
// 再清 lockCards 让下一次出图不再套用任何禁词锁。
CLEAR_CARD_STATE_SINK = () => {
	lockCards = [];
	try {
		Object.keys(INSERTED.map).forEach((k) => { delete INSERTED.map[String(k)]; });
		INSERTED.save();
		INSERTED.emit();
	} catch (e) { }
};


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
		const box = { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", overflow: "visible", border: "1px solid rgba(127,127,127,.28)", borderRadius: "10px", padding: "8px 10px" };
		// 画布占 ~73%（2.7fr:1fr）；行用 minmax 下限，窗口再矮也不会把内容挤扁 ⇒ 整页可滚动
	const narrow = rW > 0 ? rW < 640 : false;   // 用面板宽度（pW 是参数卡内网格宽度，别混用）  // 窄屏：单列堆叠（手机/平板竖屏，2026-10-18）
				const tiny = rW > 0 ? rW < 460 : false;    // 手机竖屏：再压一档
				const mid = rW > 0 && rW < 980;             // 中等宽：右栏收窄，别把左栏挤扁
				const gpos = () => ({});   // 布局改成左右两列 flex 后不再需要行列定位（保留调用点）
				const grid = { display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) clamp(210px, 32%, 420px)", alignItems: "stretch", gridAutoRows: "max-content", gap: "10px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", flex: "0 0 auto", minHeight: 0, overflowX: narrow ? "visible" : "clip" };
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
		                      loraDropAt === g.key ? { borderBottomColor: "var(--c-ok, #16a34a)", background: "rgba(22,163,74,.14)" } : {}),
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

		  			  h("div", { className: "cfy-left", style: { display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "100%", minWidth: 0, minHeight: 0, boxSizing: "border-box" } },
h("div", { className: "cfy-canvas", style: Object.assign({}, box, gpos("1", "1"), { position: "relative", height: tiny ? "32vh" : (narrow ? "36vh" : "42vh"), flex: "0 0 auto", alignItems: "stretch", justifyContent: "flex-start", gap: "8px", minHeight: 0, overflow: "hidden", background: "repeating-conic-gradient(rgba(127,127,127,.07) 0% 25%, rgba(0,0,0,0) 0% 50%) 50% / 24px 24px" }) },
		  	h("div", { style: { position: "relative", flex: "1 1 auto", minHeight: 0, maxHeight: "100%", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", overflow: "hidden", position: "relative" } },
			  	h("span", { style: { position: "absolute", top: "6px", left: "8px", fontSize: "11.5px", color: "var(--c-fg4)", background: "rgba(255,255,255,.86)", border: "1px solid rgba(var(--c-ink-rgb),.10)", borderRadius: "4px", padding: "1px 6px", pointerEvents: "none", zIndex: 2, whiteSpace: "nowrap" } }, timeHintText()),
		  		(job && job.image)
		  			? h("img", {
		  				src: job.image,
		  				title: "点击放大查看（滚轮缩放 · 拖拽移动 · Esc 关闭）",
		  				onClick: () => { try { if (!OUTPUT_VIEW_SINK) return; const it = (job && job.output) ? Object.assign({}, job.output, { url: job.image }) : { id: job.image, url: job.image, filename: "最近出图" }; OUTPUT_VIEW_SINK(it); } catch (e) {} },
		  				style: { position: "absolute", inset: 0, margin: "auto", maxWidth: "calc(100% - 10px)", maxHeight: "calc(100% - 10px)", width: "auto", height: "auto", objectFit: "contain", display: "block", borderRadius: "6px", cursor: "zoom-in" } })
		  			: h("span", { style: S.dim }, (job && job.status === "running") ? "正在出图…" : "画布出图展示 —— 点右下「生成」"),
		  		(job && job.status === "running") ? h("span", { style: S.warn }, "生成中：" + (job.message || job.progress || job.status || "")) : null,

		  		),
		  /* 工作流支路（2026-11-10 转正）：原来藏在词库页的实验性卡片里。
		     放在画布容器内部的最后一行（flex 占位，不是 absolute）——
		     画布是固定高 + overflow:hidden，absolute 会被裁掉，flex 行不会。 */
		  h("div", { style: { flex: "0 0 auto", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "7px", flexWrap: "wrap", background: "rgba(255,255,255,.92)", border: "1px solid rgba(var(--c-ink-rgb),.12)", borderRadius: "6px", padding: "3px 9px", fontSize: "11.5px", lineHeight: "1.5", boxShadow: "0 1px 4px rgba(0,0,0,.06)" } },
		  	h("span", { style: { fontWeight: 700, color: "var(--c-fg)", whiteSpace: "nowrap" } }, "工作流支路"),
		  	h("label", { style: { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", whiteSpace: "nowrap" }, title: "latent 放大后再采一遍：纹理是重新生成的，不是插值糊的。约慢一倍" },
		  		h("input", { type: "checkbox", checked: !!hires.enabled, onChange: (e) => setHires(Object.assign({}, hires, { enabled: e.target.checked })) }), "二次采样"),
		  	hires.enabled ? h("input", { type: "number", min: 0.05, max: 0.9, step: 0.05, value: hires.denoise, title: "高了改构图，低了没效果；实测 0.35~0.55 可用", style: Object.assign({}, S.inp, { width: "56px", padding: "2px 4px", fontSize: "11px" }), onChange: (e) => setHires(Object.assign({}, hires, { denoise: Number(e.target.value) })) }) : null,
		  	hires.enabled ? h("select", { title: "latent 放大倍率", style: Object.assign({}, S.sel, { width: "auto", minWidth: "auto", padding: "1px 3px", fontSize: "11px" }), value: String(hires.scale), onChange: (e) => setHires(Object.assign({}, hires, { scale: Number(e.target.value) })) }, [1.25, 1.5, 2].map((f) => h("option", { key: f, value: String(f) }, "×" + f))) : null,
		  	h("label", { style: { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", whiteSpace: "nowrap" }, title: "按空行切开分别编码再拼：超长时截断只影响最后一段，不会把 COMPOSITION 段吃掉" },
		  		h("input", { type: "checkbox", checked: !!splitEncoding, onChange: (e) => setSplitEncoding(e.target.checked) }), "分段编码"),
		  	h("button", { type: "button", style: Object.assign({}, S.btn2, { padding: "2px 7px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }, initImage.image ? { borderColor: "rgba(120,170,255,.75)" } : null), onClick: openInitPicker, disabled: initBusy, title: "点开选参考图：从历史挑一张，或上传自己的图" }, initBusy ? "图生图…" : (initImage.image ? ("图生图：" + String(initImage.image).replace(/^dsh_init\//, "")) : "图生图 ▸")),
		  	initImage.image ? h("input", { type: "number", min: 0.05, max: 1, step: 0.05, value: initImage.denoise, title: "越低越贴原图", style: Object.assign({}, S.inp, { width: "52px", padding: "2px 4px", fontSize: "11px" }), onChange: (e) => setInitImage(Object.assign({}, initImage, { denoise: Number(e.target.value) })) }) : null,
		  	initImage.image ? h("button", { type: "button", style: Object.assign({}, S.btn2, { padding: "2px 6px", fontSize: "11px" }), onClick: () => setInitImage(Object.assign({}, initImage, { image: "" })), title: "关掉图生图，回到纯文生图" }, "×") : null),
		  	),

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
		    ? h("div", { style: Object.assign({}, box, gpos("1", "3 / 6"), { gap: narrow ? "6px" : "8px", flex: "0 0 auto", alignSelf: "stretch", width: "100%", minHeight: "0", overflow: "hidden" }) },
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
		      : { alignSelf: "stretch", alignContent: "flex-start", position: "sticky", top: 0, zIndex: 2, display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "100%", minHeight: 0, minWidth: 0, boxSizing: "border-box", background: "var(--c-card)" } },
		    h("div", { style: Object.assign({}, box, { minWidth: 0, flex: "0 0 auto", gap: "4px" }) },
		    		    h("span", { style: hd }, "底模 / 编码器 / LoRA"),
		    		    h("div", { style: Object.assign({}, S.field, { gap: "3px" }) },
		    		    	h("span", { style: S.label }, "底模（" + ckptSourceLabel + "）"),
		    		    	h("button", { type: "button", "aria-label": "选择底模",
		    		    		title: ckpt ? ("当前底模：" + ckpt + "；点击打开模型库更换") : "点击打开模型库选择底模",
		    		    		style: { display: "flex", alignItems: "center", gap: "8px", width: "100%", minWidth: 0, boxSizing: "border-box",
		    		    			padding: "2px 8px 2px 4px", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit",
		    		    			border: "1px solid " + (modelBad ? "var(--c-bad)" : "rgba(127,127,127,.32)"),
		    		    			borderRadius: "8px", background: "rgba(127,127,127,.06)" },
		    		    		onClick: () => {
		    		    			// 走 A 线模型库：弹窗经 portal 到 body，pvhost 收起时也看得见；
		    		    			// 在里面点「使用」选中底模，名字再由 MODEL_PICKED_SINK 回到这里。
		    		    			//
		    		    			// ⚠️ 2026-10-31：kind 原来写死 "checkpoint"，于是不管编码器类型是
		    		    			//    qwen_image 还是 moss_image，模型库永远落进 checkpoints 目录，
		    		    			//    用户能看到 meinaMix / SDXL，却怎么也找不到 diffusion_models 里的
		    		    			//    MOSS。改成按当前底模实际所在目录传；还没选底模时传 "all"，
		    		    			//    模型库会给出跨目录的扁平底模列表。
		    		    			if (typeof OPEN_MODEL_PICKER_SINK === "function") {
		    		    				const k = !ckpt ? "all" : (unets.indexOf(ckpt) >= 0 ? "unet" : "checkpoint");
		    		    				OPEN_MODEL_PICKER_SINK(k, ckpt);
		    		    			}
		    		    			else setTab("pv-online");
		    		    		} },
		    		    		h(LocalCkptThumb, { kind: ckptIsUnet ? "unet" : "checkpoint", name: ckpt, width: 40, height: 52 }),
		    		    		h("span", { style: { display: "flex", flexDirection: "column", gap: "1px", minWidth: 0, flex: "1 1 auto", overflow: "hidden" } },
		    		    			h("strong", { title: ckpt, style: { fontSize: "12.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, shortLora(ckpt) || "选择底模"),
		    		    			h("small", { title: ckpt, style: { fontSize: "11px", opacity: .62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ckpt || "点击打开模型库")))),
		    		    modelBad ? h("div", { style: { fontSize: "11.5px", lineHeight: 1.45, color: "var(--c-bad)" } },
		    		    	"「" + ckpt + "」在 diffusion_models 和 checkpoints 里都找不到，请重新选一个底模。") : null,
		    		    h("label", { style: Object.assign({}, S.field, { gap: "2px" }) }, h("span", { style: Object.assign({}, S.label, { fontSize: "11.5px" }) }, "文本编码器"), h("select", { style: Object.assign({}, S.sel, { width: "100%", padding: "3px 7px" }), value: clip, onChange: (e) => setClip(e.target.value) },
		    		    	h("option", { value: "" }, "（跟随底模内置 CLIP）"), opt(clips, clip))),
		    		    h("label", { style: Object.assign({}, S.field, { gap: "2px" }) }, h("span", { style: Object.assign({}, S.label, { fontSize: "11.5px" }) }, "编码器类型"), h("select", { style: Object.assign({}, S.sel, { width: "100%", padding: "3px 7px" }), value: clipType, onChange: (e) => {
		    		    	const v = e.target.value;
		    		    	setClipType(v);
		    		    	const next = pickModelFor(v);
		    		    	if (next) setCkpt(next);
		    		    } }, opt(clipTypes, clipType))),
		    		    h("label", { style: Object.assign({}, S.field, { gap: "2px" }) }, h("span", { style: Object.assign({}, S.label, { fontSize: "11.5px" }) }, "VAE"), h("select", { style: Object.assign({}, S.sel, { width: "100%", padding: "3px 7px" }), value: vae, onChange: (e) => setVae(e.target.value) },
		    		    	h("option", { value: "" }, "（跟随底模内置 VAE）"), opt(vaes, vae))),
		    		    h("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "auto", flexWrap: "wrap" } },
		    		    	h("span", { style: Object.assign({}, S.label, { fontSize: "12.5px" }), title: "点右边按钮弹出二级菜单" }, "LoRA"),
		    		    	selLoras.length
		    		    		? selLoras.map((x) => h("span", { key: x.name, style: { display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(90,160,235,.22)", border: "1px solid rgba(90,160,235,.55)", borderRadius: "6px", padding: "2px 7px", fontSize: "12px", color: "var(--c-fg)", whiteSpace: "nowrap" } },
		    		    				x.name.replace(/\.safetensors$/, ""),
		    		    				h("b", { style: { fontWeight: 600, color: "var(--c-accent)" } }, Number(x.model).toFixed(2))))
		    		    		: h("span", { style: { fontSize: "12.5px", color: "var(--c-warn)" } }, "未选"),
		    		    	h("button", { style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }), onClick: () => setLoraOpen(true), title: "打开 LoRA 二级菜单" }, "选择（" + selLoras.length + "/" + loras.length + "）"))),
		    		    /* 0.7.130：身份控制（LLLite）开关。只在插入的卡带 conditioning.presets 时出现。
		    		       平时关着——控制图是「纯角色线稿」，开着会把背景削掉、姿态锁成正立；
		    		       需要锁脸锁衣服（定妆照、角色一致性对照）时勾开，只影响本次会话。 */
		    		    (() => {
		    		      const cs = llliteCards();
		    		      if (!cs.length) return null;
		    		      const card = cs[0];
		    		      const keys = Object.keys(card.conditioning.presets || {});
		    		      const act = llliteOn ? { borderColor: "var(--c-accent)", color: "var(--c-accent-fg)", background: "rgba(90,160,235,.18)" } : {};
		    		      return h("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" } },
		    		        h("span", { style: Object.assign({}, S.label, { fontSize: "12.5px" }), title: "用控制图锁定这张角色卡的脸和服饰；代价是背景会被削掉、姿态锁成正立，场景出图请保持关闭" }, "身份控制"),
		    		        h("button", { type: "button", style: Object.assign({}, S.btn2, { padding: "4px 10px", fontSize: "12.5px" }, act), "aria-pressed": !!llliteOn, onClick: () => toggleLllite(!llliteOn, card) }, llliteOn ? "开" : "关"),
		    		        llliteOn ? h("select", { style: Object.assign({}, S.sel, { width: "auto", padding: "3px 7px", fontSize: "12.5px" }), value: lllitePick, title: "控制图档位（按画布比例选）", onChange: (e) => toggleLllite(true, card, e.target.value) },
		    		          ...keys.map((k) => h("option", { key: k, value: k }, k))) : null,
		    		        h("span", { style: { fontSize: "11.5px", color: "var(--c-fg4)" } }, cs.length > 1 ? ("共 " + cs.length + " 张卡可选 · 用最近插入的「" + (card.name || card.id) + "」") : ""));
		    		    })(),
		    		    // 三个随机按钮（0.7.124）：塞在整块压缩后腾出的空间里，横排一行，不改外层布局
		    		    // 用 auto-fit + 74px 下限：右栏窄到放不下三个时自动折成两行，不会把「随机全部」切掉
		    		    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))", gap: "5px", marginTop: "2px" } },
		    		      h("button", { type: "button", style: Object.assign({}, S.btn2, { padding: "4px 6px", fontSize: "12px", fontWeight: 600, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }), title: "从词库抽一套角色：外观（发色/发型/瞳色/体型）+ 情绪 + 附加特征 + 服饰 + 道具。画风/动作/场景/取景保持不变", onClick: rndRoleOnly }, "随机角色"),
		    		      h("button", { type: "button", style: Object.assign({}, S.btn2, { padding: "4px 6px", fontSize: "12px", fontWeight: 600, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }), title: "只换画面侧：表情 + 道具 + 动作 + 场景 + 取景/分镜。发色瞳色服饰与画风全部保持不变", onClick: rndSegOnly }, "随机画面"),
		    		      h("button", { type: "button", style: Object.assign({}, S.btn2, { padding: "4px 6px", fontSize: "12px", fontWeight: 600, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderColor: "var(--c-accent)", color: "var(--c-accent-fg)" }), title: "十路全抽：画风 + 外观 + 情绪 + 附加特征 + 服饰 + 道具 + 动作 + 场景 + 取景 + 光影", onClick: rndAllBoth }, "随机全部")),
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
		    		      // 步数 + CFG 并排（2026-11-11）：num() 本来就是 flex:1 1 0 的小控件，
		    		      // 直接放进栅格会被各自占一格、撑成两行；这里用一条占满宽度的 flex 行收拢。
		    		      h("div", { style: { gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-start", minWidth: 0 } },
		    		        num("步数", steps, setSteps), num("CFG", cfg, setCfg, 0.1))),
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
		    		    // 采样器 + 调度器始终同一排（2026-11-11）：这两个下拉各占一行太浪费，
		    		    // 只有真正的窄屏（tiny）才退回单列。
		    		    h("div", { style: { display: "grid", gridTemplateColumns: tiny ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "start", flexShrink: 0, minHeight: 0 } },
		    		      h("div", { style: S.field }, h("span", { style: S.label }, "采样器"), h(SelectMenu, { theme: uiVars, label: "采样器", options: samplers, value: sampler, onChange: setSampler, minWidth: 0, forceSearch: true })),
		    		      h("div", { style: S.field }, h("span", { style: S.label }, "调度器"), h(SelectMenu, { theme: uiVars, label: "调度器", options: schedulers, value: scheduler, onChange: setScheduler, minWidth: 0, forceSearch: true }))),
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
		    		      h("div", { style: S.field }, h("span", { style: S.label, title: "锁定=复用这个种子；递增/递减=每次生成后 ±1；随机=每次换" }, "Seed 变化"), h(SelectMenu, { theme: uiVars, label: "Seed 变化", value: seedMode, onChange: setSeedMode, minWidth: 0, options: [{ value: "lock", label: "锁定" }, { value: "increment", label: "递增" }, { value: "decrement", label: "递减" }, { value: "random", label: "随机" }] }))),

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
	{ key: "light", name: "光线", src: ["光线"] },
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
// ==================== 词库 · 提示词段构建（二级视图）====================
function segTextNow() {
	const sel = segSel || {};
	if (sel.preset && SEG.blocks.preset && SEG.blocks.preset[sel.preset]) {
		return SEG.quality + ", " + segRating + ", " + SEG.blocks.preset[sel.preset];
	}
	const segText = SEG.order.map((k) => (k !== "preset" && sel[k] ? SEG.blocks[k][sel[k]] : "")).filter(Boolean).join(", ");
	return SEG.quality + ", " + segRating + (segText ? ", " + segText : "");
}
function copySeg() {
	const text = segTextNow();
	try {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(
				() => setMsg("已复制到剪贴板"),
				() => setMsg("剪贴板被拦，请手动选中预览框复制"));
		} else { setMsg("剪贴板不可用，请手动选中预览框复制"); }
	} catch (e) { setMsg("剪贴板被拦，请手动选中预览框复制"); }
}
function randomSeg() {
	const next = {};
	SEG.order.forEach((k) => {
		const ks = Object.keys(SEG.blocks[k] || {});
		if (ks.length) next[k] = ks[Math.floor(Math.random() * ks.length)];
	});
	setSegSel(next);
	setMsg("随机了一套，不满意再按一次");
}

// ===== 生成页三个随机按钮（0.7.124）：随机角色 / 随机画面 / 随机全部 =====
// 数据来源分两处：
//   RND_LIB（lib/randomlib.js，独立资料库）—— look 外观 + mood 情绪
//   SEG（lib/dict.js 词库）—— style / outfit / prop / pose / scene / frame
// 「人物」槽位（character）是固定白发红瞳的 20 种表情，和 look 抢同一批发色瞳色 tag，
// 抽 look 时一律删掉 character，避免两套头发眼睛叠在一起。
function rndPick(arr) {
	return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : null;
}
function rndHas(obj, k) {
	return !!(obj && k && Object.prototype.hasOwnProperty.call(obj, k));
}
// 合并池：同一槽位把 SEG 词库与 RND_LIB 资料库并起来抽，两边各管各的，互不覆盖。
// SEG 缺这一路时（比如 look / mood / extra 只有 RND_LIB 有）也能正常返回。
function rndPool(k) {
	return Object.assign({}, (SEG.blocks || {})[k] || {}, (RND_LIB || {})[k] || {});
}
// 前缀：质量词 + 分级。只加一次（逐词去重保证重复按不会再塞一遍）
function rndPrefix() {
	return [SEG.quality, segRating].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
}
// 只取指定槽位的文本，没抽到的槽位跳过
function rndSlotText(sel, slots) {
	const parts = [];
	(slots || []).forEach((k) => {
		const pool = rndPool(k);
		if (rndHas(pool, sel[k])) parts.push(pool[sel[k]]);
	});
	return parts.join(", ");
}
// 拼提示词：quality, rating, style, look, mood, extra, outfit, prop, pose, scene, frame
function rndText(sel) {
	const parts = [];
	const push = (v) => { const s = String(v || "").trim(); if (s) parts.push(s); };
	push(SEG.quality);
	push(segRating);
	["style", "look", "mood", "extra", "outfit", "prop", "pose", "scene", "frame"].forEach((k) => {
		const pool = rndPool(k);
		if (rndHas(pool, sel[k])) push(pool[sel[k]]);
	});
	return parts.join(", ");
}
// 从某个池里抽一个 key；pool 是 {key: value} 或直接给 keys 数组
function rndKey(pool) {
	const ks = Object.keys(pool || {});
	return ks.length ? rndPick(ks) : "";
}
// 附加特征（兽耳/角/眼镜/纹身…）：不是每张图都要带，留 1/3 概率抽到「无」。
// 带兽耳和带恶魔角是两种完全不同的角色，强行每次都加会让随机池失去一半多样性。
function rndExtra() {
	const ks = Object.keys((RND_LIB || {}).extra || {});
	if (!ks.length) return "";
	if (Math.random() < 0.34) return "";
	return rndFamPick("extra", rndExtraFamily, rndLastExtraFam);
}
// 姿势族：把 90 条姿势按「基础身体姿态」归类，用于换族抽取。
// 顺序有意义——先匹配更具体的（跑/跳/蹲/跪/躺/趴），最后才是「站」这种兜底大类，
// 否则 "sitting on the ground" 会被 stand 之类的宽规则先吃掉。
// 外观族：按「头发怎么处理」分。发型是这三个槽位里视觉差最大的维度，
// 同色系换个发型出来的完全是另一个角色。顺序先特殊后兜底。
const RND_LOOK_FAM = [
	{ k: "双", re: /\btwin tails|twin braids|twintails|side ponytail|double\b/i },
	{ k: "编", re: /\bbraid|braided\b/i },
	{ k: "卷", re: /\bcurly|wavy|drill hair\b/i },
	{ k: "束", re: /\bponytail|hair bun|updo|messy bun|half updo\b/i },
	{ k: "短", re: /\bshort (hair|bob|platinum|blue|red|white|silver|black|orange|pink|teal|dark|green|ash|messy|spiky)|bob cut|bob hair|pixie cut|undercut|bowl cut|short hair\b/i },
	{ k: "长", re: /\blong|medium\b/i },
];
function rndLookFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_LOOK_FAM.length; i++) if (RND_LOOK_FAM[i].re.test(s)) return RND_LOOK_FAM[i].k;
	return "长";
}
// 表情族：正 / 负 / 怒 / 冷 / 强。表情连着两张同族，出来的就是同一张脸的情绪。
const RND_MOOD_FAM = [
	{ k: "正", re: /\bsmile|happy|joy|grin|amused|content|grateful|relieved|hopeful|peaceful|gentle|warm|tender|affection|giddy|satisfied|proud|innocent|triumphant|confident|smug\b/i },
	{ k: "负", re: /\bsad|cry|tear|sorrow|grief|despair|lonely|regret|ashamed|pained|hurt|broken|horrified|fear|scared|vulnerable|grieving|wistful|melancholic|embarrass|tired|exhausted|shy|blush\b/i },
	{ k: "怒", re: /\banger|angry|rage|furious|irritated|annoyed|hostile|predatory|threat|intimidat|defiant|challenging|scorn|disgust|mocking\b/i },
	{ k: "冷", re: /\bexpressionless|blank|deadpan|stoic|cold|unimpressed|distant|neutral|absent-minded|dazed|silent|calm|serene|sleepy|lazy|half-closed\b/i },
	{ k: "强", re: /\bsurprised|shock|amazed|excited|panic|desperate|manic|wild|intense|focused|determined|mesmerized|flustered|nervous|anticipation|confused|thinking|curious|surprised\b/i },
	{ k: "其它", re: /./ },
];
function rndMoodFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_MOOD_FAM.length; i++) if (RND_MOOD_FAM[i].re.test(s)) return RND_MOOD_FAM[i].k;
	return "其它";
}
// 附加特征族：兽 / 超自然 / 饰品 / 伤痕 / 穿孔刺青 / 面具服饰 / 其它
// 兽耳连出两次和「兽耳→角→伤痕」是完全不同的观感。
const RND_EXTRA_FAM = [
	{ k: "兽", re: /\bear|tail|fang|paw\b/i },
	{ k: "超自然", re: /\bhorn|wing|halo|antlers|spectral|glowing|runic|rune|crystal|scales|gills|split tongue\b/i },
	{ k: "伤痕", re: /\bscar|bandage|bandaid|stitch|burn|bruise|wound|claw marks|eyebags\b/i },
	{ k: "穿孔", re: /\bpiercing|tattoo|serial number\b/i },
	{ k: "服饰", re: /\bglasses|sunglasses|mask|veil|hood|hat|beret|cap|headscarf|eyepatch|monocle|harness|armband|thigh strap|anklet|body chain|collar\b/i },
	{ k: "饰品", re: /\bearring|necklace|pendant|choker|crown|tiara|hairband|hair clip|hairpin|flower crown|jewelry\b/i },
	{ k: "其它", re: /\bblush marks|freckles|mole|pale skin|nail polish\b/i },
];
function rndExtraFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_EXTRA_FAM.length; i++) if (RND_EXTRA_FAM[i].re.test(s)) return RND_EXTRA_FAM[i].k;
	return "其它";
}
// 服饰族：制服 / 民族 / 战斗 / 泳装内衣 / 日常 / 礼服 / 功能 / 其它
const RND_OUTFIT_FAM = [
	{ k: "制服", re: /\bserafuku|school uniform|blazer|office lady|police|flight attendant|nurse|maid|miko|gakuran|teacher|cheerleader|gym uniform|apron|lab coat|medical coat|scrubs|cassock|nun habit|military dress\b/i },
	{ k: "民族", re: /\byukata|kimono|qipao|hanfu|sari|hanbok|abaya|chinese clothes|japanese\b/i },
	{ k: "战斗", re: /\bcamouflage|multicam|plate carrier|combat shirt|ghillie|body armor|plate armor|power armor|riot|bomb suit|tactical|exoskeleton|hazmat|wetsuit|spacesuit|plug suit|racing suit|fencing|riding habit|firefighter\b/i },
	{ k: "泳装内衣", re: /\bswimsuit|bikini|underwear|bra|panties|babydoll|negligee|lingerie|garter|thighhighs|bodysuit|leotard|towel|bandages only|latex\b/i },
	{ k: "礼服", re: /\bgown|tuxedo|tailcoat|evening|backless|wedding dress|prom dress|fur stole|lolita|gothic\b/i },
	{ k: "功能", re: /\braincoat|rain poncho|down jacket|hoodie|track suit|jersey|overalls|mechanic|cargo pants|techwear|bomber jacket|trench coat|cloak|sweater|cardigan|knit|leather jacket|ragged clothes|military coat\b/i },
	{ k: "日常", re: /\bcamisole|t-shirt|shirt|skirt|jeans|shorts|dress|pajamas|robe|suit|vest|chiffon\b/i },
];
function rndOutfitFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_OUTFIT_FAM.length; i++) if (RND_OUTFIT_FAM[i].re.test(s)) return RND_OUTFIT_FAM[i].k;
	return "其它";
}
// 画风族：绘画 / 摄影 / 动漫画 / 3D / 图形 / 复古。
// 画风是所有槽位里改观感最狠的一个 —— 连出两次同族比什么都明显。
const RND_STYLE_FAM = [
	{ k: "绘画", re: /\bpainterly|watercolor|oil painting|impressionist|baroque|charcoal|engraving|ink wash|sumi-e|pastel|gouache|thick paint|pencil sketch|graphite\b/i },
	{ k: "摄影", re: /\bphotograph|film|kodak|infrared|long exposure|double exposure|bokeh|grain|soft focus|harsh lighting|neon lights\b/i },
	{ k: "动漫画", re: /\banime|manga|cel shading|screencap|shoujo|shounen|lineart|moé|chibi\b/i },
	{ k: "3D", re: /\b3d|render|cg|low poly|voxel\b/i },
	{ k: "图形", re: /\bpop art|minimalist|poster|collage|paper cutout|pixel|vector|graphic|halftone|muted colors|vivid colors|monochrome|duotone|morandi\b/i },
	{ k: "复古", re: /\bretro|vintage|ukiyo-e|art deco|art nouveau|90s|steampunk|vaporwave|cyberpunk|dark gothic\b/i },
];
function rndStyleFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_STYLE_FAM.length; i++) if (RND_STYLE_FAM[i].re.test(s)) return RND_STYLE_FAM[i].k;
	return "其它";
}
// 通用换族抽取：避开最近两族。poolName 对应 rndPool 的键，famFn 是该池的分族函数。
function rndFamPick(poolName, famFn, histRef) {
	const pool = rndPool(poolName);
	const ks = Object.keys(pool);
	if (!ks.length) return "";
	const hist = Array.isArray(histRef.current) ? histRef.current : [];
	let cand = ks;
	if (hist.length) {
		const strict = ks.filter((k) => hist.indexOf(famFn(pool[k])) < 0);
		if (strict.length) cand = strict;
		else {
			const last = hist[hist.length - 1];
			const one = ks.filter((k) => famFn(pool[k]) !== last);
			if (one.length) cand = one;
		}
	}
	const pick = rndPick(cand);
	if (pick) histRef.current = [famFn(pool[pick])].concat(hist.slice(0, 1));
	return pick;
}
const RND_POSE_FAM = [
	{ k: "悬吊", re: /\bsuspend|hanging|inverted|levitating|floating|weightless|underwater\b/i },
	{ k: "跑",   re: /\brun(ning)?\b|sprint|charging|run toward|crouched start|striding|fleeing|pursuing|vaulting over|being dragged|breaking free|walking fast\b/i },
	{ k: "跳",   re: /\bjump(ing)?\b|leaping|midair|mid-air|airborne|leap|falling|free fall|dropping|landing\b/i },
	{ k: "爬",   re: /\bcrawl|on all fours|climbing|on elbows|hands and knees\b/i },
	{ k: "跪",   re: /\bkneel(ing)?\b|\bseiza\b|prostrating|wariza|straddling|riding\b/i },
	{ k: "躺",   re: /\blying\b|\bon (back|stomach|side)\b|\bsupine\b|reclining\b/i },
	{ k: "蹲",   re: /\bsquat(ting)?\b|\bcrouch(ing)?\b|deep squat|low stance|curled up in corner\b/i },
	{ k: "趴",   re: /\bprone\b|\blying on stomach\b|bent over|bending over|draped over|hands on ground|flat on ground|body flat|diving low\b/i },
	{ k: "坐",   re: /\bsit(ting)?\b|crossed legs|cross-legged|on chair|on floor|dangling|hand on own cheek\b/i },
	{ k: "靠",   re: /\bleaning\b|\bagainst wall\b|against tree|on railing\b/i },
	// 站是兜底大类：上半身的手势、情绪、扭身全归这里，所以它排在最后、判据最宽
	{ k: "站",   re: /\bstand(ing)?\b|\bsalute\b|upright|facing viewer|facing off|selfie|stretching|head back|looking down|finger to mouth|hand in hair|looking back|turning|tiptoes|reaching up|hands together|holding hands|finger heart|outstretched arms|from behind|hands on (own )?head|hand on own forehead|twisting torso|raising hand|fighting stance|hugging|embrace|carrying over shoulder|bridal carry|pushing away|wading|covering face|arms spread wide|arms crossed over chest|stepping back|hugging self|arms limp|hands in pockets|crossed arms|arms behind back\b/i },
];
function rndPoseFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_POSE_FAM.length; i++) {
		if (RND_POSE_FAM[i].re.test(s)) return RND_POSE_FAM[i].k;
	}
	return "其它";
}
// 分镜族：距离 + 角度两个维度。
// 距离决定"画面里装多少"，角度决定"从哪看"——两者都换，机位才真的变。
// 规则顺序是先具体后宽泛（极特写 → 近景 → 胸上 → 中景 → 全身 → 远景 → 大远景），
// 否则 "full length shot, wide framing" 会被 wide shot 先吃掉。
const RND_FRAME_DIST = [
	{ k: "极特写", re: /\bextreme close-up\b|\bmacro shot\b|\beyes focus\b|\beye focus\b|\blips focus\b|\bfeet focus\b|\biris detail\b/i },
	{ k: "近景",   re: /\bclose-up\b|\bface focus\b|\bportrait\b|\bnape\b/i },
	{ k: "胸上",   re: /\bupper body\b|\bchest up\b|\bcollarbone\b/i },
	{ k: "中景",   re: /\bmedium shot\b|\bcowboy shot\b|\bwaist up\b|\bknee-up\b|\bmid-thigh\b|\bthree-quarter body\b/i },
	{ k: "全身",   re: /\bfull length shot\b|\bfull body\b|\bpanorama\b/i },
	{ k: "远景",   re: /\bwide shot\b|\bdistant figure\b/i },
	{ k: "大远景", re: /\bextreme wide\b|\bscenery focus\b|\bsmall figure\b/i },
];
// 「正面」「构图类」不算特殊角度，返回空串 —— 它们不参与角度换族，
// 否则 62 条里一半以上都是 front view，一排除就没得抽了。
const RND_FRAME_ANGLE = [
	{ k: "仰视", re: /\blow angle\b|\bfrom below\b|\bworm'?s eye\b/i },
	{ k: "俯视", re: /\bhigh angle\b|\bfrom above\b|\btop-down\b|\boverhead\b|\bcctv\b/i },
	{ k: "过肩", re: /\bover the shoulder\b/i },
	{ k: "背面", re: /\bfrom behind\b|\bback view\b|\bback of head\b/i },
	{ k: "侧视", re: /\bside view\b|\bprofile\b|\bthree-quarter view\b|\bfrom side\b/i },
];
function rndFrameDist(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_FRAME_DIST.length; i++) {
		if (RND_FRAME_DIST[i].re.test(s)) return RND_FRAME_DIST[i].k;
	}
	// 没写距离的（三分法 / 框中框 / 荷兰角 / 鱼眼…）归「构图」：
	// 它们确实是一个独立的分镜取向，不该被当成"未知"而不参与换族。
	return "构图";
}
function rndFrameAngle(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_FRAME_ANGLE.length; i++) {
		if (RND_FRAME_ANGLE[i].re.test(s)) return RND_FRAME_ANGLE[i].k;
	}
	return "";
}
// 换族抽分镜：距离和角度都避开最近两族，连按三张必然是三种机位。
// 兜底两级：先退到只避距离一族，再退到全池（62 条、8 个距离族，实际不会走到）。
function rndFrameKey() {
	const pool = rndPool("frame");
	const ks = Object.keys(pool);
	if (!ks.length) return "";
	const hd = Array.isArray(rndLastFrameDist.current) ? rndLastFrameDist.current : [];
	const ha = Array.isArray(rndLastFrameAngle.current) ? rndLastFrameAngle.current : [];
	let cand = ks;
	if (hd.length || ha.length) {
		const strict = ks.filter((k) => {
			const d = rndFrameDist(pool[k]);
			const a = rndFrameAngle(pool[k]);
			const dOk = hd.indexOf(d) < 0;
			const aOk = !a || ha.indexOf(a) < 0;   // 候选没特殊角度 → 不算冲突
			return dOk && aOk;
		});
		const distOnly = ks.filter((k) => hd.indexOf(rndFrameDist(pool[k])) < 0);
		if (strict.length) cand = strict;
		else if (distOnly.length) cand = distOnly;
	}
	const pick = rndPick(cand);
	if (pick) {
		const d = rndFrameDist(pool[pick]);
		const a = rndFrameAngle(pool[pick]);
		rndLastFrameDist.current = [d].concat(hd.slice(0, 1));
		if (a) rndLastFrameAngle.current = [a].concat(ha.slice(0, 1));
	}
	return pick;
}
// 光影族：光从哪来、多硬、怎么落。顺序先具体（特效光有强特征词）后泛（冷暖是底色）。
const RND_LIGHT_FAM = [
	{ k: "特效", re: /\bvolumetric|god rays|light shafts|tyndall|lens flare|anamorphic|bokeh|prism|chromatic|sparks|embers|shadow pattern|gobo|neon|halation|reflections|shimmer|caustics|mirror reflection|reflective floor|slanted beam|dust motes|striped light|blinds shadow|lightning flash|searchlight|headlight sweep|moving beam\b/i },
	{ k: "对比", re: /\bcinematic lighting|dramatic light|cross lighting|key light|motivated light|split lighting|half warm half cool|mixed color temperature|warm and cool\b/i },
	{ k: "硬光", re: /\bhard shadow|harsh|low key|single light source|spotlight|top lighting|underlighting|overexposed|blown highlights|side lighting|form defining|hard edge|hard beam|stark white\b/i },
	{ k: "剪影", re: /\bsilhouette|contre-jour|backlit|backlighting|rim light\b/i },
	{ k: "柔光", re: /\bsoft light|high key|diffused|haze|fog|misty|vignette|falloff|bounce light|ambient glow|reflected light|softbox|even light|beauty light|snow bounce|cool fill\b/i },
	{ k: "暖光", re: /\bgolden hour|warm sunlight|sunset|candlelight|warm flicker|amber|firelight|lantern glow|fire glow|orange flicker|campfire|warm orange|dusk backlight|orange gradient\b/i },
	{ k: "冷光", re: /\bcool blue|moonlight|fluorescent|cold white|clinical|silver cast|teal|monitor glow|blue face light|polar night blue\b/i },
];
function rndLightFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_LIGHT_FAM.length; i++) {
		if (RND_LIGHT_FAM[i].re.test(s)) return RND_LIGHT_FAM[i].k;
	}
	return "其它";
}
// 换族抽光影：避开最近两族，30 段分 7 族，排完还剩至少 5 族可选。
function rndLightKey() {
	const pool = rndPool("light");
	const ks = Object.keys(pool);
	if (!ks.length) return "";
	const hist = Array.isArray(rndLastLightFam.current) ? rndLastLightFam.current : [];
	let cand = ks;
	if (hist.length) {
		const strict = ks.filter((k) => hist.indexOf(rndLightFamily(pool[k])) < 0);
		if (strict.length) cand = strict;
		else {
			const last = hist[hist.length - 1];
			const one = ks.filter((k) => rndLightFamily(pool[k]) !== last);
			if (one.length) cand = one;
		}
	}
	const pick = rndPick(cand);
	if (pick) {
		const f = rndLightFamily(pool[pick]);
		rndLastLightFam.current = [f].concat(hist.slice(0, 1));
	}
	return pick;
}
// 道具族：按「这东西是干什么用的」分。顺序先特殊后常规——
// 枪和束缚器具的判定词一旦被「杂项」吃掉，就会出现「步枪被归成日用小物」这种误判。
const RND_PROP_FAM = [
	{ k: "束缚", re: /\bcorset|whip|clothespins|harness|handcuffs|blindfold|leash|chain, shackle\b/i },
	{ k: "军事", re: /\brifle|pistol|handgun|shotgun|machine gun|submachine gun|ballistic shield|gas grenade|night vision|nvg|medical bag|dog tags|spotting scope|ammo|grenade|sledgehammer\b/i },
	{ k: "血腥", re: /\bamputee|severed|wound|cross-section|blood|stump|bandage|skeleton mask|welding mask|gas mask|red cloth\b/i },
	{ k: "兵器", re: /\blongsword|katana|drawn string|spear|battle axe|kunai|daggers|scythe|blade\b/i },
	{ k: "音乐", re: /\bpiano|flute|cello|accordion|taiko|harmonica|guitar|violin\b/i },
	{ k: "食物", re: /\bapple|bread|coffee|wine bottle|ice cream|bento|cake slice|lollipop|teacup|cup, tea\b/i },
	{ k: "电子", re: /\blaptop|headphone|console|tablet|monitor|smartphone|camera|flashlight|radio|photograph\b/i },
	{ k: "工具", re: /\bwrench|hammer|saw,|screwdriver|rope coil\b/i },
	{ k: "自然", re: /\brose|sunflower|potted plant|fallen leaf|vine|\bcat,|white dove|butterfly|snake|crow|bouquet|dried flowers\b/i },
	{ k: "织物", re: /\bcape|veil|blanket|flag on pole|ribbon|scarf|gloves|thighhighs|high heels|boots|pendant|earrings|ring,|hair stick|flower crown|jewelry|lace parasol\b/i },
	{ k: "杂项", re: /\bchair|mirror|sofa|ladder|bathtub|bicycle|motorcycle|skateboard|oar|kite|book|lantern|pocket watch|umbrella|candle|folding fan|round fan|half mask|smoking pipe|cigarette|backpack|luggage|suitcase|plush toy\b/i },
];
function rndPropFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_PROP_FAM.length; i++) {
		if (RND_PROP_FAM[i].re.test(s)) return RND_PROP_FAM[i].k;
	}
	return "其它";
}
// 场景族：按「这是哪一类地方」分。顺序先特殊后常规——太空/高空/水下/极端天气的判定词
// 一旦被「城市」「自然」先吃掉，就会出现「海滩被当成高空」（beach 带 sky）这种误判。
// 所以高空族里刻意不含单独的 sky 一词。
const RND_SCENE_FAM = [
	{ k: "棚拍", re: /\bsimple background|plain background|studio backdrop\b/i },
	{ k: "太空", re: /\bspace station|nebula|cosmic|alien terrain|meteor|stargate|deep space|earth below\b/i },
	{ k: "高空", re: /\bcloud layer|above the clouds|cable car|balloon|cliff edge|floating island|airplane|aircraft cabin|airfield|runway|on top of train\b/i },
	{ k: "水下", re: /\bunderwater|submerged|reef|kelp|coral|sunken|caustics|shallow water\b/i },
	{ k: "极端", re: /\btornado|sandstorm|blizzard|thunderstorm|flood|volcanic ash|aurora|hoarfrost|whiteout|storm|downpour\b/i },
	{ k: "幻想", re: /\bmagic|rune|temple|castle|dragon|crystal cavern|abyss|otherworld|surreal|dreamscape|inverted world|abstract space|digital space|paper world|mirror space|void\b/i },
	{ k: "废墟", re: /\bruin|abandoned|collapsed|war-torn|destroyed street|burning city|wreck|trench|broken pews|empty swimming pool\b/i },
	{ k: "室内", re: /\broom|interior|indoor|corridor|classroom|kitchen|bathroom|bedroom|library|cafe|bar|cell |laboratory|server|theater|museum|office|warehouse|basement|cabin|hospital|mall|store|shrine|church|factory|bakery|greenhouse|poolside|swimming pool|laundromat|entryway\b/i },
	{ k: "城市", re: /\bstreet|city|alley|rooftop|subway|station|pier|bridge|parking|intersection|building|shop|platform|crosswalk|railway|harbor|checkpoint|gas station|deck|overpass|promenade|plaza|square|highway|port|scaffolding|vending machine|bus stop|school gate|night market|mall|district|passage\b/i },
	{ k: "自然", re: /\bforest|mountain|field|meadow|canyon|glacier|swamp|cave|waterfall|lake|desert|cliff|grassland|tundra|shore|beach|bamboo|flower|garden|river|valley|hill|grove|spring|volcano|crater|graveyard|gravestone|moss\b/i },
];
function rndSceneFamily(v) {
	const s = String(v || "");
	for (let i = 0; i < RND_SCENE_FAM.length; i++) {
		if (RND_SCENE_FAM[i].re.test(s)) return RND_SCENE_FAM[i].k;
	}
	return "其它";
}
// 通用填充：keep 里的槽位有值就不动；其余按来源重抽
function rndFill(keep, opts) {
	const o = opts || {};
	const next = Object.assign({}, segSel || {});
	delete next.preset;
	delete next.character;                       // 永远不用 character，交给 look
	if (o.look) next.look = rndFamPick("look", rndLookFamily, rndLastLookFam);
	if (o.mood) next.mood = rndFamPick("mood", rndMoodFamily, rndLastMoodFam);
	// 光影是独立槽位，不在 SEG.order 里，所以不能靠下面的循环，得单独抽
	if (o.light) next.light = rndLightKey();
	if (o.extra) {
		const ex = rndExtra();
		if (ex) next.extra = ex; else delete next.extra;
	}
	SEG.order.forEach((k) => {
		if (k === "preset" || k === "character") return;
		if (keep.indexOf(k) >= 0 && next[k]) return;
		if (!o.slots || o.slots.indexOf(k) >= 0) {
			// 十个槽位全部走换族抽取：站着换站着的变体、全身换全身、森林换森林、
			// 手枪换手枪、长发换长发，肉眼看都看不出区别
			let v;
			if (k === "pose") v = rndFamPick("pose", rndPoseFamily, rndLastPoseFam);
			else if (k === "scene") v = rndFamPick("scene", rndSceneFamily, rndLastSceneFam);
			else if (k === "frame") v = rndFrameKey();
			else if (k === "prop") v = rndFamPick("prop", rndPropFamily, rndLastPropFam);
			else if (k === "look") v = rndFamPick("look", rndLookFamily, rndLastLookFam);
			else if (k === "mood") v = rndFamPick("mood", rndMoodFamily, rndLastMoodFam);
			else if (k === "extra") v = rndFamPick("extra", rndExtraFamily, rndLastExtraFam);
			else if (k === "outfit") v = rndFamPick("outfit", rndOutfitFamily, rndLastOutfitFam);
			else if (k === "style") v = rndFamPick("style", rndStyleFamily, rndLastStyleFam);
			else v = rndKey(rndPool(k));
			if (v) next[k] = v;
		}
	});
	setSegSel(next);
	return { sel: next, text: rndText(next) };
}
const RND_NON_ROLE = ["style", "pose", "scene", "frame"];   // 随机角色时保留：画风与构图
// 随机画面时保留：人物本体（外观/服饰）+ 画风。重抽的是表情 + 道具 + 动作 + 场景 + 取景。
// 表情不算「角色特征」（特征 = 发色/发型/瞳色/体型），它是状态，跟姿势场景一起归画面侧。
const RND_NON_SCENE = ["look", "outfit", "style"];
const RND_SCENE_SLOTS = ["prop", "pose", "scene", "frame"];
// 随机全部：除 preset（整套，会吞掉其它槽位）与 character（固定白发红瞳，和 look 抢 tag）之外的全路
const RND_ALL_SLOTS = SEG.order.filter((k) => k !== "preset" && k !== "character");
// 把选中的槽位压成短 ID 串，给消息栏用：ST-02 LK-12 MD-04 OF-02 PR-03 PO-29 SC-27 FR-12
function rndIdOf(v) {
	const s = String(v || "").trim();
	return s ? s.split(/\s+/)[0] : "";
}
// 三个按钮各自负责的槽位（账本按槽位记账，所以跨按钮重叠时后按的那个说了算）
// light（光影）归画面侧：它是状态不是本体，换光等于换一张照片，但人还是同一个。
const RND_APPLY_ROLE = ["look", "mood", "extra", "outfit", "prop"];
const RND_APPLY_SCENE = ["mood", "prop", "pose", "scene", "frame", "light"];
const RND_APPLY_ALL = ["style", "look", "mood", "extra", "outfit", "prop", "pose", "scene", "frame", "light"];
// 随机按钮统一入口：先把 slots 这些槽位「随机按钮写过的东西」剥干净，再补上本次抽到的新词。
//
// 剥除范围有两层：
//   1) 当前账本 store[k]        —— 上一轮写进去的那一段
//   2) 该槽位历史全集 seen[k]   —— 这个槽位历次被随机写过的所有词
// 第 2 层是必要的：账本可能被判丢（换浏览器、清了 localStorage、老版本留下的堆积），
// 只靠第 1 层的话那些词会被当成「用户手写」永久保留，越按越乱，最后提示词里躺着五六套
// 互相冲突的姿势，模型只能在冲突里折中，每张图都长一个样。
// 用户自己敲的词只要没被随机按钮用过，就不在任何一层里，永远不会被删。
// 按槽位自愈：把提示词里属于这些槽位的词，每个槽位只留「最后一段连续块」。
//
// 为什么需要它：账本 rndBySlot 与历史集 rndSeen 都是后加的，老版本只追加不剥离，
// 用户提示词里可能已经躺着五六套互斥的姿势/场景/分镜。这些词在账本里没有记录，
// 于是会被当成「用户手写」永久保护，重启多少次都不会掉。这一层不看账本，
// 直接拿池子里的词做字典反查，同一槽位堆了几段就只留最后一段。
// 副作用：用户手写的词若恰好与池中词同形（如 standing）也会被折叠，但只保留最后那套，
// 视觉上仍是「一套完整描述」，比一次堆五套强得多。
function rndStripBySlot(cur, slots, guard) {
	const toks = String(cur || "").split(",").map((x) => x.trim()).filter(Boolean);
	if (!toks.length) return String(cur || "").trim();
	const maps = {};
	for (let si = 0; si < (slots || []).length; si++) {
		const k = slots[si];
		const pool = rndPool(k);
		const bag = new Set();
		for (const key of Object.keys(pool)) {
			for (const w of String(pool[key] || "").split(",")) {
				const s = w.trim().toLowerCase();
				if (s) bag.add(s);
			}
		}
		maps[k] = bag;
	}
	const bySlot = {};
	for (let i = 0; i < toks.length; i++) {
		const lw = toks[i].toLowerCase();
		for (let si = 0; si < (slots || []).length; si++) {
			const k = slots[si];
			if (maps[k] && maps[k].has(lw)) { (bySlot[k] = bySlot[k] || []).push(i); break; }
		}
	}
	const drop = new Set();
	for (const k of (slots || [])) {
		const idx = bySlot[k] || [];
		if (idx.length <= 1) continue;
		// 从尾部往前找连续的最后一个块，它之前的同槽位词全部丢掉
		let start = idx.length - 1;
		while (start > 0 && idx[start] - idx[start - 1] === 1) start--;
		for (let j = 0; j < start; j++) {
			// 卡片插进来的词不进 drop：它们不是随机写的，不该被折叠掉
			if (guard && guard.has(toks[idx[j]].toLowerCase())) continue;
			drop.add(idx[j]);
		}
	}
	if (!drop.size) return toks.join(", ");
	return toks.filter((_, i) => !drop.has(i)).join(", ");
}
/**
 * 已插入卡片登记的词（2026-11-11）
 *
 * 随机三连按「槽位账本」剥词：账本 store 与历史集 seen 里记过的词一律当成
 * 上一轮随机写进去的，先剥掉再写新的。但风格卡插入时也往 pos 里写了词 ——
 * 那些词不在随机账本里，本不该被动到；可只要它们与某个槽位的池子同形
 * （光影、机位、姿态、道具本来就有大面积交叉），就会被当成「上一轮的旧词」
 * 剥掉。卡片于是被判成「部分移除」，用户看到的就是
 * 「随机一下，风格卡插入就丢了」。
 *
 * 这里把已插入卡片登记过的词全部列为受保护，任何随机剥除都绕开它们。
 */
function cardProtected() {
	const keep = new Set();
	try {
		INSERTED.all().forEach((r) => {
			(r.posTokens || []).forEach((t) => { const s = String(t).trim().toLowerCase(); if (s) keep.add(s); });
			(r.negTokens || []).forEach((t) => { const s = String(t).trim().toLowerCase(); if (s) keep.add(s); });
		});
	} catch (e) { }
	return keep;
}
function rndApply(slots, sel) {
	const store = rndBySlot.current || {};
	const seen = rndSeen.current || {};
	const oldTexts = [];
	(slots || []).forEach((k) => {
		if (store[k]) oldTexts.push(store[k]);
		const bag = seen[k];
		if (bag) oldTexts.push(Object.keys(bag).join(", "));
	});
	/* 受保护：已插入卡片（风格卡 / 角色卡）登记过的词，随机功能不得剥除。 */
	const _guard = cardProtected();
	const _drop = new Set();
	(oldTexts || []).forEach((tx) => {
		String(tx || "").split(",").forEach((w) => {
			const s = w.trim().toLowerCase();
			if (s && !_guard.has(s)) _drop.add(s);
		});
	});
	const base0 = _drop.size
		? String(pos || "").split(",").map((x) => x.trim()).filter((x) => x && !_drop.has(x.toLowerCase())).join(", ")
		: String(pos || "").trim();
	// 再按槽位折叠一次：账本没记录的老堆积、手贴的多套描述，同一槽位只留最后一段。
	const base = rndStripBySlot(base0, slots, _guard);
	const add = [rndPrefix(), rndSlotText(sel, slots)].filter(Boolean).join(", ");
	const items = add.split(",").map((x) => x.trim()).filter(Boolean);
	const have = new Set(base.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean));
	/* 0.7.130：原来只跟 base 比，本次新词自己的重复没人管。
	   多个槽位带同一个词时（动作槽和取景槽都能出 from above / high angle / full body），
	   它会连着写 2–3 遍。同一个词重复三次等于把权重抬高，模型于是被死死钉在那个视角上，
	   背景又没跟着换透视——构图就裂了。这里对新词也去重，只保留第一次出现。 */
	const _freshSeen = new Set();
	const _fresh0 = items.filter((t) => {
		const k = t.toLowerCase();
		if (have.has(k) || _freshSeen.has(k)) return false;
		_freshSeen.add(k);
		return true;
	});
	/* 0.7.130：角度互斥。动作槽和取景槽都会带机位词，from above（正上方垂直俯拍）
	   和 high angle（高角度斜俯拍）虽然同属「俯视」，落在同一张图里却是两套透视；
	   背景若没跟着换视角，就会出现角色俯视、场景平视的割裂。
	   按 rndFrameAngle 的族归类，同一族只留先出现的那个。 */
	const _angleSeen = [];
	const fresh = _fresh0.filter((t) => {
		const fam = rndFrameAngle(t);
		if (!fam) return true;
		if (_angleSeen.indexOf(fam) >= 0) return false;
		_angleSeen.push(fam);
		return true;
	});
	const next = base ? (fresh.length ? base + ", " + fresh.join(", ") : base) : fresh.join(", ");
	setPos(next);
	const store2 = Object.assign({}, store);
	(slots || []).forEach((k) => {
		const v = sel[k];
		const pool = rndPool(k);
		if (v && rndHas(pool, v)) store2[k] = pool[v]; else delete store2[k];
	});
	rndBySlot.current = store2;
	rndSaveLedger(store2);
	// 历史全集持续累积：下回按同一个按钮时，这一轮写进去的词也在剥除范围内。
	const seen2 = Object.assign({}, seen);
	(slots || []).forEach((k) => {
		const v = sel[k];
		const pool = rndPool(k);
		if (!v || !rndHas(pool, v)) return;
		const bag = Object.assign({}, seen2[k] || {});
		const t = String(pool[v] || "");
		t.split(",").forEach((w) => { const s = w.trim(); if (s) bag[s.toLowerCase()] = s; });
		seen2[k] = bag;
	});
	rndSeen.current = seen2;
	rndSaveSeen(seen2);
	return fresh.length;
}
// 清掉提示词里所有「曾经被随机按钮写过」的词，只留用户自己敲的。
function rndRoleOnly() {
	// 换人：look + mood + extra + outfit + prop；画风与构图保持。再按时先把上一次这套角色剥掉再写新的。
	const r = rndFill(RND_NON_ROLE, { look: true, mood: true, extra: true, slots: ["outfit", "prop"] });
	const added = rndApply(RND_APPLY_ROLE, r.sel);
	const ids = [r.sel.look, r.sel.mood, r.sel.extra, r.sel.outfit, r.sel.prop].map(rndIdOf).filter(Boolean).join(" ");
	setMsg("随机角色 换掉旧的，写入 +" + added + " 词：" + ids);
}
function rndSegOnly() {
	// 换画面：表情（mood）+ 道具（prop）+ 动作（pose）+ 场景（scene）+ 取景/分镜（frame）+ 光影（light）。
	// 只保留人物本体（look / outfit / extra）与画风（style），空的也不补。
	const r = rndFill(RND_NON_SCENE, { mood: true, light: true, slots: RND_SCENE_SLOTS });
	const added = rndApply(RND_APPLY_SCENE, r.sel);
	// 消息栏打出这次抽到的机位 ID 和姿势首词：一眼能看出到底换没换。
	// 如果这里每次都不同、出图却还是同一个姿态，说明提示词里还挂着别的姿势词在压它，
	// 不是随机功能没生效。
	const poseTag = String(rndPool("pose")[r.sel.pose] || "").split(",")[0].trim();
	const lightTag = String(rndPool("light")[r.sel.light] || "").split(",")[0].trim();
	setMsg("随机画面 +" + added + " 词 · " + rndIdOf(r.sel.pose) + "/" + rndIdOf(r.sel.frame) + "/" + rndIdOf(r.sel.light) + " · 姿势=" + (poseTag || "—") + " · 光=" + (lightTag || "—") + " · " + String(pos || "").length + " 字符");
}
function rndAllBoth() {
	// 十路全抽：style + look + mood + extra + outfit + prop + pose + scene + frame + light
	const r = rndFill([], { look: true, mood: true, extra: true, light: true, slots: RND_ALL_SLOTS });
	const added = rndApply(RND_APPLY_ALL, r.sel);
	const ids = [r.sel.style, r.sel.look, r.sel.mood, r.sel.extra, r.sel.outfit, r.sel.prop, r.sel.pose, r.sel.scene, r.sel.frame, r.sel.light].map(rndIdOf).filter(Boolean).join(" ");
	setMsg("随机全部 换掉旧的，写入 +" + added + " 词：" + ids);
}
function segBuilder() {
	const order = SEG.order;
	const label = SEG.labels || {};
	const blocks = SEG.blocks || {};
	const sel = segSel || {};
	const picked = order.filter((k) => sel[k]).length;
	const full = segTextNow();
	const cur = blocks[segOpen] ? segOpen : order[0];
	const curList = Object.keys(blocks[cur] || {});

	const rowOf = (k) => h("div", {
		key: k,
		onClick: () => setSegOpen(k),
		title: sel.preset && k !== "preset" ? "已选「整套」，这一槽不参与拼接" : "",
		style: {
			opacity: sel.preset && k !== "preset" ? 0.45 : 1,
			display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", cursor: "pointer", borderRadius: "8px",
			border: "1px solid " + (segOpen === k ? "var(--c-accent)" : (sel[k] ? "rgba(74,192,122,.55)" : "var(--c-line)")),
			background: segOpen === k ? "var(--c-panel2)" : "transparent",
		},
	},
		h("span", { style: { minWidth: "42px", fontSize: "12px", color: "var(--c-fg4)" } }, label[k] || k),
		h("span", { style: { flex: 1, fontSize: "12.5px", wordBreak: "break-all" } }, sel[k] || h("span", { style: { color: "var(--c-fg5)" } }, "未选")),
		sel[k] ? h("span", {
			title: "清空这一段",
			onClick: (e) => { e.stopPropagation(); setSegSel(Object.assign({}, sel, { [k]: "" })); },
			style: Object.assign({}, S.chip, { padding: "0 8px", lineHeight: "18px" }),
		}, "×") : null);

	return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
		h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
			h("button", { style: S.btn, onClick: () => setSegOn(false) }, "← 返回词库"),
			h("span", { style: { fontWeight: 700, fontSize: "15px" } }, "提示词段构建"),
			h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "已选 " + picked + "/" + order.length),
			h("span", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, sel.preset ? "已选「整套」：只输出 质量词+评级+整套串，其余槽位不参与" : "拼装顺序固定：风格 → 人物 → 衣服 → 道具 → 动作 → 场景 → 取景（顺序即权重）")),

		h("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } },
			h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "评级："),
			(SEG.ratings || []).map((r) => h("span", {
				key: r,
				onClick: () => setSegRating(r),
				style: Object.assign({}, S.chip, { cursor: "pointer", padding: "3px 10px" },
					r === segRating ? { background: "var(--c-accent)", color: "var(--c-accent-on)", borderColor: "var(--c-accent)" } : {}),
			}, r.replace("rating:", "")))),

		h("div", { style: { display: "flex", flexDirection: "column", gap: "5px" } }, order.map(rowOf)),

		h("div", { style: { border: "1px solid var(--c-line)", borderRadius: "8px", padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" } },
			h("div", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, (label[cur] || cur) + " · " + curList.length + " 个可选（" + (SEG.hints[cur] || "") + "）"),
			h("div", { style: { display: "flex", flexDirection: "column", gap: "4px", maxHeight: "300px", overflowY: "auto" } },
				curList.map((k) => h("div", {
					key: k,
					title: blocks[cur][k],
					onClick: () => setSegSel(Object.assign({}, sel, { [cur]: sel[cur] === k ? "" : k })),
					style: { display: "flex", gap: "8px", alignItems: "baseline", padding: "4px 6px", borderRadius: "5px", cursor: "pointer",
						background: sel[cur] === k ? "rgba(74,192,122,.16)" : "transparent" },
				},
					h("span", { style: { minWidth: "50px", fontSize: "11.5px", color: "var(--c-fg5)" } }, k.split(" ")[0]),
					h("span", { style: { minWidth: "150px", fontSize: "12.5px" } }, k.slice(k.indexOf(" ") + 1)),
					h("span", { style: { fontSize: "11px", color: "var(--c-fg5)", wordBreak: "break-all" } }, blocks[cur][k]))))),

		h("div", { style: { border: "1px solid var(--c-line)", borderRadius: "8px", padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px" } },
			h("div", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "拼好的提示词（" + full.length + " 字符）"),
			h("textarea", { style: Object.assign({}, S.ta, { minHeight: "96px" }), readOnly: true, value: full }),
			h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
				h("button", { style: S.btn, onClick: () => { setPos(full); setMsg("已写入正向提示词"); } }, "写入正向"),
				h("button", { style: S.btn2, onClick: () => { insert(full, "pos"); setMsg("已追加到正向"); } }, "追加到正向"),
				h("button", { style: S.btn2, onClick: () => { insert(full, "neg"); setMsg("已追加到负面"); } }, "追加到负面"),
				h("button", { style: S.btn2, onClick: copySeg }, "复制"),
				h("button", { style: S.btn2, onClick: randomSeg }, "随机一套"),
				h("button", { style: S.btn2, onClick: () => setSegSel({}) }, "清空全部"),
				h("button", { style: S.btn2, onClick: () => setTab("gen") }, "去生成页")),
			h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "写入 = 替换正向框；追加 = 接在原有内容后面。")));
}

