// ==================== 生成任务（模块级，跨面板存活）====================
/** 底模能吃多长的提示词 —— 只用来**提示**，不拦提交。
 *
 *  这是「一张卡换到底模上为什么变糊」最常见的原因：SD1.5 / SDXL 的文本编码器
 *  只吃 77 个 CLIP token，超出的部分被静默截掉；ComfyUI 不报错，任务照样 success，
 *  出来是一张跟提示词没什么关系的图。而 Anima（Qwen3 0.6B）/ MOSS（Qwen3.5 9B）
 *  用大语言模型当编码器，几千字符都吃得下。
 *
 *  所以同一张卡（本仓主卡正词 1886 字符）在 Anima 上正常、在 SDXL 上只剩开头
 *  一小段生效。用户看到的不是报错，是"图变差了"，无从判断原因。
 *
 *  阈值取自本机实测：SDXL 正词 508 字符正常、1886 字符出彩色噪点场；
 *  Anima 正词 1886 + 负词 4236 正常。给 600 / 6000 两个保守档。
 *  判据用工作流里的编码器节点，而不是 latent 节点：Anima 与 SDXL 都用
 *  EmptyLatentImage（见 LATENT_BY_CLIP_TYPE），光看 latent 分不出来。
 *  CLIPLoader 的 type 才写着真相 —— qwen_image / moss_image 是 LLM 编码器，
 *  flux / sd3 是 T5，都吃得下几千字符；stable_diffusion / sdxl 是 77 token 的 CLIP。
 *  走 checkpoint 内置 CLIP 时没有 CLIPLoader 节点，这时退回 latent 判：SD3/Flux
 *  的 latent 本身就是大编码器家族的标志。 */
function promptBudgetOf(graph) {
	try {
		for (const id in graph) {
			const n = graph[id];
			if (!n) continue;
			if (n.class_type === "CLIPLoader" || n.class_type === "CLIPLoaderGGUF") {
				const ty = String((n.inputs && n.inputs.type) || "").toLowerCase();
				if (/qwen|moss|lumina|t5|flux|sd3/.test(ty)) return 6000;
				return 600;
			}
		}
	} catch (e) { /* ignore */ }
	try {
		for (const id in graph) {
			const ct = graph[id] && graph[id].class_type;
			if (ct === "EmptySD3LatentImage" || ct === "EmptyFlux2LatentImage") return 6000;
		}
	} catch (e) { /* ignore */ }
	return 600;
}
function longestPromptOf(graph) {
	let worst = { len: 0, text: "" };
	try {
		for (const id in graph) {
			const n = graph[id];
			if (!n || n.class_type !== "CLIPTextEncode") continue;
			const t = (n.inputs && n.inputs.text) || "";
			if (t.length > worst.len) worst = { len: t.length, text: t };
		}
	} catch (e) { /* ignore */ }
	return worst;
}

/**
 * 关键点：任务状态与轮询都放在**模块级**，不放在 React 里。
 * DSH 的 main slot 一次只渲染一个面板，切到对话框时本页面会被卸载；
 * 若把轮询放在组件里，切走就断了、回来也拿不到结果。
 */
/** 最后一次出图存在 localStorage，刷新 / 切页都不丢；只有「生成下一张」或手动「清空」会替换它 */
const LAST_IMG_KEY = "dsh.comfy.lastImage";
function readLastImage() {
	try {
		const raw = window.localStorage.getItem(LAST_IMG_KEY);
		if (!raw) return null;
		const o = JSON.parse(raw);
		return (o && o.image) ? o : null;
	} catch (e) { return null; }
}
const BG = {
	job: readLastImage(),   // {pid, startedAt, status, message, image, error, params} —— 启动时先接上次那张
	listeners: new Set(),
	timer: null,
	emit() {
		this.listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
	},
	set(patch) {
		this.job = Object.assign({}, this.job || {}, patch);
		this.persistLastImage();
		this.emit();
	},
	/** 出图完成才落盘；跑着的任务不进 localStorage，刷新后不会显示半张空图 */
	persistLastImage() {
		try {
			const j = this.job;
			if (j && j.image && j.status === "done") {
				window.localStorage.setItem(LAST_IMG_KEY, JSON.stringify({
					pid: j.pid, status: "done", message: j.message || "完成 ✓",
					image: j.image, imageInfo: j.imageInfo, output: j.output,
					completedAt: j.completedAt, generationMs: j.generationMs,
				}));
			}
		} catch (e) { /* 隐私模式写不了就算了，不影响本次会话 */ }
	},
	snapshot() { return this.job ? Object.assign({}, this.job) : null; },
	subscribe(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
	clear() {
		this.job = null;
		try { window.localStorage.removeItem(LAST_IMG_KEY); } catch (e) { }
		this.emit();
	},
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
			// 提交前先量一次提示词长度：超预算不会报错，只会被编码器静默截断。
			// 这里只提示、不拦 —— 截断后仍可能出可用的图，用户自己决定要不要改。
			const _lp = longestPromptOf(graph);
			const _bud = promptBudgetOf(graph);
			if (_lp.len > _bud) {
				MSG("提示词 " + _lp.len + " 字符，超过这个底模的文本编码器上限（约 " + _bud
					+ " 字符），超出部分会被静默截掉 —— 出图可能和后半段描述无关。"
					+ "换大编码器底模，或把后半段挪到前面。");
			}
			/* 同配方重跑（2026-11-11）
			 *
			 * ComfyUI 按节点输入的哈希做执行缓存：配方 + 种子完全一致时整条链命中
			 * execution_cached，SaveImage 不重新执行，/history 里回的仍是上一次的
			 * 文件名（实测连续五次都是 dsh_comfy_00098_.png）。画布 URL 不变，
			 * 用户看到的就是「点了生成但什么都没发生」。
			 *
			 * 这里只给 SaveImage 换一个本次唯一的 filename_prefix：下游节点输入变了，
			 * 缓存必然失效、一定会落新文件，画布也就跟着刷新。种子语义不动 ——
			 * 画面仍然是同种子同配方的那一张，只把「为什么一样」说清楚。
			 */
			try {
				const _sig = JSON.stringify(graph);
				if (this.lastSig === _sig) {
					const _k = Object.keys(graph).find((k) => graph[k] && graph[k].class_type === "SaveImage");
					if (_k) {
						const _base = String((graph[_k].inputs || {}).filename_prefix || "dsh_comfy");
						graph[_k].inputs.filename_prefix = _base + "_r" + Date.now().toString(36);
						MSG("同配方同种子重跑：上次那张是 ComfyUI 复用缓存的结果。这次已单独命名并重新落盘，画面与上一张相同；想换画面把种子改成随机，或点「随机」再生成");
					}
				}
				this.lastSig = _sig;
			} catch (e) { }
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
	// 0.7.130：以前 baseModelsText 只要不是 null 就优先，于是空字符串会把已有数组吃掉
	// （编辑器没带值 → 输入框空 → 保存即清空底模）。改成"非空文本才优先"。
	const txt = (d && d.baseModelsText != null) ? String(d.baseModelsText).trim() : "";
	const arr = (d && Array.isArray(d.baseModels)) ? d.baseModels.join(", ") : "";
	const t = txt || arr;
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
	return { text: "未标注底模", full: "这张卡还没填底模。点「编辑」→「底模」补上，之后右上角就会显示模型名。", muted: true };
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
	// UNet 链：底模是单文件 DiT（UNETLoader 读 diffusion_models），文本编码器外挂。
	// 判据是「这个编码器类型是否属于 UNet 族」（UNET_CLIP_TYPES），不是只认 qwen_image ——
	// MOSS-Image 也是这一族（moss_image_* DiT + Qwen3.5-9B TE + FLUX.2 VAE）。
	const animaUNet = isUnetClipType(o.clipType);
	if (animaUNet) {
		g["1"] = { class_type: "UNETLoader", inputs: { unet_name: o.unet || o.ckpt || MODEL_DEFAULTS.unet, weight_dtype: "default" } };
		// type 必须跟着面板选的那个走：qwen_image 与 moss_image 的 TE 实现不同，
		// 写死会让 CLIPLoader 用错编码器（MOSS 会被当成 Qwen-Image，回 400 或出噪声）。
		g["2"] = { class_type: "CLIPLoader", inputs: { clip_name: o.clip, type: o.clipType || "qwen_image" } };
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
	if (animaUNet && !o.clip) throw new Error("当前底模需要外部文本编码器（" + (o.clipType || "qwen") + "），请在「文本编码器」里选一个");
	let modelSrc = ["1", 0], clipSrc = g["2"] ? ["2", 0] : ["1", 1];
	(o.loras || []).forEach((L, i) => {
		const id = String(10 + i);
		g[id] = {
			class_type: "LoraLoader",
			inputs: { model: modelSrc, clip: clipSrc, lora_name: L.name, strength_model: L.model, strength_clip: L.clip },
		};
		modelSrc = [id, 0]; clipSrc = [id, 1];
	});
	/**
	 * 提示词编码。
	 *
	 * 不分段（默认）：一个 CLIPTextEncode，跟原来一样。
	 * 分段（o.splitEncoding）：按空行切开，每段独立编码再用 ConditioningCombine 串起来。
	 *
	 * 为什么值得分段：超预算时 ComfyUI **静默截断**，单节点塞整条会把后半截全吃掉
	 * （`COMPOSITION:` 段一没了构图就全乱）；分段之后截断只影响最后一段。
	 * 六段式预设本来就是按 `\n\n` 写的，天然适配。
	 *
	 * 节点号：正段 41..48 / 负段 51..58，combine 正 61..67 / 负 71..77。
	 * 段数上限 8 —— 再多就把剩下的并进最后一段，别把节点号挤到 LoRA 的 10+n 上。
	 */
	const splitSegments = (text) => String(text || "")
		.split(/\n\s*\n/)
		.map((s) => s.trim())
		.filter(Boolean);
	const encodeCond = (text, base) => {
		const segs = o.splitEncoding ? splitSegments(text) : [];
		if (segs.length < 2) {
			g[base] = { class_type: "CLIPTextEncode", inputs: { text: text, clip: clipSrc } };
			// 节点 id 必须是字符串：ComfyUI 的 [node_id, output_index] 里 node_id 按字符串查表，
			// 传数字 4 会被当成无效引用（这里 base 是数字，必须 String 一次）
			return [String(base), 0];
		}
		const MAXSEG = 8;
		const list = segs.length > MAXSEG
			? segs.slice(0, MAXSEG - 1).concat([segs.slice(MAXSEG - 1).join("\n\n")])
			: segs;
		const cbase = base === 4 ? 41 : 51;
		const kbase = base === 4 ? 61 : 71;
		let acc = null;
		list.forEach((s, i) => {
			const id = String(cbase + i);
			g[id] = { class_type: "CLIPTextEncode", inputs: { text: s, clip: clipSrc } };
			if (!acc) { acc = [id, 0]; return; }
			const kid = String(kbase + i - 1);
			g[kid] = { class_type: "ConditioningCombine", inputs: { conditioning_1: acc, conditioning_2: [id, 0] } };
			acc = [kid, 0];
		});
		return acc;
	};
	const posSrc = encodeCond(o.pos, 4);
	const negSrc = encodeCond(o.neg, 5);
	/**
	 * 主 latent：空 latent（文生图），或从一张图编码（图生图）。
	 *
	 * 图生图这条支路是补能力缺口 —— 原来 denoise 写死 1.0，整条链只有 txt2img，
	 * 改图 / 局部重绘 / 风格迁移都没法做。
	 * LoadImage 读的是 ComfyUI 的 input 目录；面板侧车 /comfy/upload 会把本地图 staging 进去。
	 */
	let latentSrc = null, mainDenoise = 1.0;
	if (o.initImage && o.initImage.image) {
		g["36"] = { class_type: "LoadImage", inputs: { image: o.initImage.image } };
		g["37"] = { class_type: "VAEEncode", inputs: { pixels: ["36", 0], vae: vaeSrc } };
		latentSrc = ["37", 0];
		mainDenoise = Math.min(1, Math.max(0.01, Number(o.initImage.denoise) || 0.6));
	} else {
		g["6"] = { class_type: latentNodeFor(o.clipType, o.latent), inputs: { width: o.w, height: o.h, batch_size: 1 } };
		latentSrc = ["6", 0];
	}
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
			model: modelForSampler, positive: posSrc, negative: negSrc, latent_image: latentSrc,
			seed: o.seed, steps: o.steps, cfg: o.cfg,
			sampler_name: o.sampler, scheduler: o.scheduler, denoise: mainDenoise,
		},
	};
	g["8"] = { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: vaeSrc } };
	// ↑ 主采样解码。注意：开了二次采样时这一支**仍然要建** ——
	//   #33 只吃 latent（["7",0]），不需要像素；但 #8 留着会被判悬空节点，
	//   ComfyUI 照样执行一次完整 decode（1024×1408 大约多花 3~5 秒），纯浪费。
	//   所以下面 hires 分支里会把 #8 摘掉，由 #35 承担解码。

	/**
	 * 生成后放大。
	 *
	 * ⚠️ 为什么不直接生成高分辨率：模型在约 1 MP 上训练，直接出 8.29 MP（4K）	 *    属分布外崩坏。实测 3840x2160 花 19 分 34 秒、出 4 个脑袋；
	 *    而 960x544 出图 + 4x 放大只要 39~54 秒，解剖正确。
	 *
	 * ⚠️ 节点号用 30/31/32 —— 20/21/22 已被 LLLite 占用（LoadImage /
	 *    ModelPatchLoader / AnimaLLLiteApply），撞号会让工作流直接坏。
	 *
	 * 放大后**只保存最终图**（SaveImage 接在放大之后），
	 * 这样任务轮询拿到的是成品，不会误拿底图。
	 */
	let finalSrc = ["8", 0];
	/**
	 * 二次采样（hires fix）。
	 *
	 * 和下面那个 ESRGAN 放大的区别：ESRGAN 是**插值**，细节是猜的；
	 * 这里是 latent 放大后**再采一遍**，纹理（皮肤、发丝、织物）是重新生成的。
	 * 代价是慢一倍左右，收益比换采样器大得多。
	 *
	 * 三条硬约束：
	 *   1) 必须接同一条 model 链（modelForSampler），换链 = 画风断层
	 *   2) positive/negative 用同一组条件，否则构图会漂
	 *   3) denoise 高了改构图、低了没效果，0.35~0.55 是可用区间，默认 0.45
	 * 步数砍半：二次采样从 mid-noise 起步，不需要跑满。
	 * 节点号 33/34/35 避开 LLLite(20-22) 与放大(30-32)。
	 */
	if (o.hires && o.hires.enabled) {
		const hs = Math.min(2.5, Math.max(1.05, Number(o.hires.scale) || 1.5));
		g["33"] = {
			class_type: "LatentUpscaleBy",
			inputs: { samples: ["7", 0], upscale_method: "nearest-exact", scale_by: hs },
		};
		g["34"] = {
			class_type: "KSampler",
			inputs: {
				model: modelForSampler, positive: posSrc, negative: negSrc, latent_image: ["33", 0],
				seed: o.seed,
				steps: Math.max(6, Math.round(Number(o.steps) * 0.5)),
				cfg: o.cfg, sampler_name: o.sampler, scheduler: o.scheduler,
				denoise: Math.min(0.9, Math.max(0.05, Number(o.hires.denoise) || 0.45)),
			},
		};
		g["35"] = { class_type: "VAEDecode", inputs: { samples: ["34", 0], vae: vaeSrc } };
		finalSrc = ["35", 0];
		// 摘掉 #8：二次采样后它没人引用，留着就是一次白跑的整幅 decode
		delete g["8"];
	}
	/**
	 * 【实验性】手 / 脚局部重绘。
	 *
	 * 位置：二次采样之后、超分之前 —— 先别放大，放大模型不在时这条路也能跑。
	 * 做法：按画面比例框出目标区域 → 裁切 → 放大到引导尺寸 → 只对这块 latent 重采 →
	 *       缩回原尺寸 → 用羽化矩形蒙版贴回。**全程只用 ComfyUI 内置节点**，
	 *       不依赖 Impact Pack / 检测器 / 任何外部权重。
	 *
	 * 已知局限（这就是它标"实验性"的原因）：
	 *   区域是**按比例猜的**，不是检测出来的。全身竖图默认值可用；
	 *   半身、坐姿、举手过头、趴姿会框偏。框偏不会崩，只是那块被无意义地重画一遍。
	 *   真要按姿态自动定位，得接 YOLO 检测器（hand_yolov8s 等），那是第二阶段。
	 *
	 * 节点号 200 起，每区域 9 个：Crop / ScaleBy(上) / VAEEncode / KSampler /
	 *   VAEDecode / ImageScale(回原尺寸) / SolidMask / FeatherMask / CompositeMasked。
	 *
	 * ⚠️ 号段别改回 40+：分段编码占 41–48（正段）、51–58（负段）、
	 *    61–67 / 71–77（ConditioningCombine）。40+ 会静默覆盖那些节点，
	 *    表现是「开了分段编码之后局部重绘消失」或「提示词后半段丢了」。
	 *
	 * 三处刻意选择（每处都对应一次实测或一条已有结论）：
	 *   1) model 用 modelSrc（LoRA 链末端），**不接** AnimaLLLiteApply 之后的 modelForSampler。
	 *      控制图是全身构图，套在手上/脚上的裁切里毫无对应关系，会以浅灰描边渗进画面
	 *      （与 §14「乘数别拉高」同一个机制）；顺带省一次 patch 应用。
	 *   2) 步数取主链 45%（8–16）：denoise ≤0.5 的局部重采不需要跑满，多出来的步数只改细节噪点。
	 *   3) 种子沿用主种子：同一张图重复跑，重绘结果一样，才能做 A/B。
	 */
	let detailSrc = finalSrc;
	if (o.detail && o.detail.mode && o.detail.mode !== "off") {
		const _dm = String(o.detail.mode);
		const _wantHands = _dm === "hands" || _dm === "both";
		const _wantFeet = _dm === "feet" || _dm === "both";
		const _hsF = (o.hires && o.hires.enabled) ? Math.min(2.5, Math.max(1.05, Number(o.hires.scale) || 1.5)) : 1;
		const _DW = Math.max(128, Math.round(Number(o.w) * _hsF));
		const _DH = Math.max(128, Math.round(Number(o.h) * _hsF));
		const _den = Math.min(0.85, Math.max(0.1, Number(o.detail.denoise) || 0.42));
		const _guide = Math.min(1024, Math.max(320, Math.round(Number(o.detail.guide) || 768)));
		const _boxes = [];
		if (_wantHands) {
			const _s = Math.round(Math.min(_DW * 0.36, _DH * 0.28));
			_boxes.push({ key: "handL", x: Math.round(_DW * 0.20 - _s / 2), y: Math.round(_DH * 0.58 - _s / 2), w: _s, h: _s });
			_boxes.push({ key: "handR", x: Math.round(_DW * 0.80 - _s / 2), y: Math.round(_DH * 0.58 - _s / 2), w: _s, h: _s });
		}
		if (_wantFeet) {
			const _fw = Math.round(_DW * 0.60), _fh = Math.round(_DH * 0.22);
			_boxes.push({ key: "feet", x: Math.round(_DW * 0.20), y: Math.round(_DH * 0.98 - _fh), w: _fw, h: _fh });
		}
		_boxes.forEach(function (b, i) {
			const cx = Math.max(0, Math.min(Math.max(0, _DW - b.w), b.x));
			const cy = Math.max(0, Math.min(Math.max(0, _DH - b.h), b.y));
			const cw = Math.min(b.w, _DW - cx), ch = Math.min(b.h, _DH - cy);
			if (cw < 32 || ch < 32) return;
			const n = 200 + i * 9;
			const k = Math.max(1, Math.min(4, _guide / Math.min(cw, ch)));
			const fw = Math.round(cw * 0.12), fh = Math.round(ch * 0.12);
			g[String(n)] = { class_type: "ImageCrop", inputs: { image: detailSrc, width: cw, height: ch, x: cx, y: cy } };
			g[String(n + 1)] = { class_type: "ImageScaleBy", inputs: { image: [String(n), 0], upscale_method: "lanczos", scale_by: k } };
			g[String(n + 2)] = { class_type: "VAEEncode", inputs: { pixels: [String(n + 1), 0], vae: vaeSrc } };
			g[String(n + 3)] = {
				class_type: "KSampler",
				inputs: {
					model: modelSrc, positive: posSrc, negative: negSrc, latent_image: [String(n + 2), 0],
					seed: o.seed,
					steps: Math.max(8, Math.min(16, Math.round(Number(o.steps) * 0.45))),
					cfg: o.cfg, sampler_name: o.sampler, scheduler: o.scheduler,
					denoise: _den,
				},
			};
			g[String(n + 4)] = { class_type: "VAEDecode", inputs: { samples: [String(n + 3), 0], vae: vaeSrc } };
			g[String(n + 5)] = { class_type: "ImageScale", inputs: { image: [String(n + 4), 0], upscale_method: "lanczos", width: cw, height: ch, crop: "disabled" } };
			g[String(n + 6)] = { class_type: "SolidMask", inputs: { value: 1, width: cw, height: ch } };
			g[String(n + 7)] = { class_type: "FeatherMask", inputs: { mask: [String(n + 6), 0], left: fw, top: fh, right: fw, bottom: fh } };
			g[String(n + 8)] = { class_type: "ImageCompositeMasked", inputs: { destination: detailSrc, source: [String(n + 5), 0], x: cx, y: cy, resize_source: false, mask: [String(n + 7), 0] } };
			detailSrc = [String(n + 8), 0];
		});
		if (detailSrc !== finalSrc) finalSrc = detailSrc;
	}
	if (o.upscale && o.upscaleModel) {
		g["30"] = { class_type: "UpscaleModelLoader", inputs: { model_name: o.upscaleModel } };
		g["31"] = { class_type: "ImageUpscaleWithModel", inputs: { upscale_model: ["30", 0], image: finalSrc } };
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
 * --cc-*（hostPalette 探测宿主的产物）反向映射成 --c-*（插件主题令牌）。
 * 绘图台 .dsh-comfy-ui 根上原来只注入了 --cc-*，于是 400+ 处
 * var(--c-card) / var(--c-fg2) / var(--c-line) / rgba(var(--c-ink-rgb),…) 全部未定义：
 * 弹出菜单背景透明、边框消失、次要文字颜色继承宿主。这里把两套令牌接成同源。
 */
function cVarsFromCC(v) {
	if (!v) return {};
	const text = v['--cc-text'] || '#202630';
	const bg = v['--cc-bg'] || '#f8f9fb';
	const muted = v['--cc-muted'] || text;
	return {
		'--c-fg': text,
		'--c-fg2': text,
		'--c-fg3': muted,
		'--c-fg4': muted,
		'--c-fg5': muted,
		'--c-card': bg,
		'--c-panel': v['--cc-surface'] || bg,
		'--c-panel2': v['--cc-control'] || bg,
		'--c-line': v['--cc-border'] || bg,
		'--c-ink-rgb': hexToRgbTriplet(text),
		'--c-accent': v['--cc-accent'] || '#2568bd',
		'--c-accent-bg': v['--cc-accent-bg'] || '#e2edfc',
		'--c-accent-bg2': v['--cc-accent-bg'] || '#e2edfc',
		'--c-accent-fg': v['--cc-accent-text'] || '#174b8b',
		'--c-accent-on': bg,
		'--c-bad': v['--cc-bad'] || '#b52f3c',
		'--c-bad2': v['--cc-bad'] || '#b52f3c',
		'--c-bad-bg': v['--cc-accent-bg'] || '#e2edfc',
		'--c-warn': v['--cc-warn'] || '#895800',
		'--c-warn2': v['--cc-warn'] || '#895800',
		'--c-warn-bg': v['--cc-control'] || bg,
		'--c-ok': v['--cc-ok'] || '#15754b',
		'--c-scheme': v['--cc-scheme'] || 'light',
	};
}

/**
 * 反向：--c-* → --cc-*。dcomfy-panel 只拿到插件主题，浮层/portal 拿不到，补一套同源令牌。
 */
function ccVarsFromC(v) {
	if (!v) return {};
	const text = v['--c-fg'] || '#202630';
	const bg = v['--c-card'] || '#f8f9fb';
	const muted = v['--c-fg4'] || text;
	return {
		'--cc-bg': bg,
		'--cc-text': text,
		'--cc-muted': muted,
		'--cc-surface': v['--c-panel'] || bg,
		'--cc-control': v['--c-panel2'] || bg,
		'--cc-hover': v['--c-panel2'] || bg,
		'--cc-border': v['--c-line'] || bg,
		'--cc-accent': v['--c-accent'] || '#2568bd',
		'--cc-accent-bg': v['--c-accent-bg'] || '#e2edfc',
		'--cc-accent-text': v['--c-accent-fg'] || '#174b8b',
		'--cc-ok': v['--c-ok'] || '#15754b',
		'--cc-bad': v['--c-bad'] || '#b52f3c',
		'--cc-warn': v['--c-warn'] || '#895800',
		'--cc-preview-outline': text,
		'--cc-scheme': v['--c-scheme'] || 'light',
		colorScheme: v['--c-scheme'] || 'light',
	};
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

