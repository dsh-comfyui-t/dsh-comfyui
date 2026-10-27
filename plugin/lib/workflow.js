function parseWorkflow(jsonText) {
	let d
	try {
		d = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText
	} catch (e) {
		return { ok: false, error: 'JSON 解析失败：' + (e && e.message) }
	}
	if (!d || typeof d !== 'object') return { ok: false, error: '不是有效的 JSON 对象' }
	try {
		if (Array.isArray(d.nodes)) return parseUi(d)
		return parseApi(d)
	} catch (e) {
		return { ok: false, error: '解析出错：' + (e && e.message) }
	}
}
// 词库小卡片的两个组件：一对输入框（中文备注 + 英文标签 + 词性）和整张卡片的编辑弹层。
// 独立成段是为了把 app.js 里 9k 字符的 JSX 挪走；拼接后仍在同一个工厂作用域里。

/** 词性三键：正 / 负 / 自（自＝没标，插入时按正向算） */

/**
 * ComfyUI 工作流 JSON → 本插件的预设格式。
 *
 * 支持两种格式：
 *   - UI 格式（ComfyUI 里「保存」出来的，顶层有 nodes/links）
 *   - API 格式（/prompt 提交用的，形如 { "1": { class_type, inputs } }）
 *
 * 设计取舍：**只抽取本插件预设能表达的字段**
 *   ckpt / clip / vae / loras / 正向 / 负向 / 尺寸 / 步数 / CFG / 采样器 / 调度器 / seed
 * 工作流里的其他节点（放大、ControlNet、ADetailer…）**不试图复现**，
 * 而是列进 `ignored` 让用户知道"这些没被带过来"。
 *
 * 2026-10-12 对着用户的真实工作流（Anima_原始工作流.json）写的，难点有三个：
 *   ① 10 个 Reroute 节点 —— 链路要**穿透**（Reroute 只透传，不是终点）
 *   ② 正/负提示词藏在**子图**里 —— 要下潜到 definitions.subgraphs 里找
 *   ③ 第三方节点（CR SDXL Aspect Ratio / SamplerSEEDS2）—— 各自的 widgets 顺序不同
 */

/** 各节点 widgets_values 的字段顺序（ComfyUI 的约定，不同节点不一样）。 */
const WIDGETS = {
	KSampler: ['seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
	KSamplerAdvanced: ['add_noise', 'noise_seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'start_at_step', 'end_at_step', 'return_with_leftover_noise'],
	CheckpointLoaderSimple: ['ckpt_name'],
	CheckpointLoader: ['config_name', 'ckpt_name'],
	LoraLoader: ['lora_name', 'strength_model', 'strength_clip'],
	LoraLoaderModelOnly: ['lora_name', 'strength_model'],
	CLIPLoader: ['clip_name', 'type', 'device'],
	VAELoader: ['vae_name'],
	EmptyLatentImage: ['width', 'height', 'batch_size'],
	EmptySD3LatentImage: ['width', 'height', 'batch_size'],
	LatentUpscaleBy: ['upscale_method', 'scale_by'],
	'CR SDXL Aspect Ratio': ['width', 'height', 'preset', 'swap', 'batch'],
	'CR Aspect Ratio': ['width', 'height', 'preset', 'swap', 'batch'],
	SamplerSEEDS2: ['distribution', 'min', 'max', 'std'],
	CLIPTextEncode: ['text'],
};

/** 这些节点不认识也不报警（纯管道/注释/UI 标记）。 */
const SILENT = new Set([
	'Reroute', 'Note', 'MarkdownNote', 'PrimitiveNode', 'Note Plus (mtb)',
	'PreviewImage', 'ShowText|pysssss', 'easy showAnything',
]);

/** 组装 widgets_values 成具名字典 */
function widgetMap(node) {
	const t = node.type || node.class_type
	const keys = WIDGETS[t]
	const vals = node.widgets_values
	if (!keys || !Array.isArray(vals)) return {}
	const out = {}
	for (let i = 0; i < keys.length && i < vals.length; i++) out[keys[i]] = vals[i]
	return out
}

/** 剥掉值外面的引号/空白 */
function cleanStr(v) {
	if (v === null || v === undefined) return ''
	return String(v)
}

// ======================================================================
//  UI 格式
// ======================================================================
function parseUi(wf) {
	const nodes = wf.nodes || []
	const byId = new Map(nodes.map((n) => [String(n.id), n]))
	const linkById = new Map()
	for (const L of (wf.links || [])) {
		if (Array.isArray(L)) {
			linkById.set(L[0], { from: String(L[1]), fromSlot: L[2], to: String(L[3]), toSlot: L[4], type: L[5] })
		} else if (L && typeof L === 'object') {
			linkById.set(L.id, { from: String(L.origin_id), fromSlot: L.origin_slot, to: String(L.target_id), toSlot: L.target_slot, type: L.type })
		}
	}
	const subgraphs = new Map()
	for (const s of ((wf.definitions || {}).subgraphs || [])) subgraphs.set(s.id, s)

	/**
	 * 链路解析 —— 带**上下文**，因为要能跨图来回：
	 *   ctx = {kind:'main'}                   在主图里
	 *   ctx = {kind:'sub', sg, outer}         在某个子图内部，outer 是外层那个子图节点
	 *
	 * ⚠️ 第一版没带上下文，导致子图内的 CLIPTextEncode 顺着 clip 输入往外追时，
	 *    用的是**主图**的 link 表去查**子图**的 link id，永远查不到，
	 *    于是 clip / vae 全空。这是本模块最容易写错的地方。
	 */
	function subgraphOutputSource(sg, slot) {
		const out = (sg.outputs || [])[slot]
		if (!out) return null
		for (const lid of (out.linkIds || [])) {
			const l = (sg.links || []).find((x) => x.id === lid)
			if (l) {
				const inner = (sg.nodes || []).find((x) => String(x.id) === String(l.origin_id))
				if (inner) return { node: inner, slot: l.origin_slot }
			}
		}
		return null
	}

	/** 子图输入节点（id=-10）→ 映射回外层那条 link */
	function subgraphInputOuter(ctx, linkId) {
		const sg = ctx.sg
		const idx = (sg.inputs || []).findIndex((inp) => (inp.linkIds || []).indexOf(linkId) >= 0)
		if (idx < 0) return null
		const outerIn = (ctx.outer.inputs || [])[idx]
		if (!outerIn || outerIn.link === null || outerIn.link === undefined) return null
		return outerIn.link
	}

	/** 已知源节点后的继续解析（处理 Reroute 透传与子图下潜） */
	function resolveNode(ctx, node, slot, depth) {
		if (!node || depth > 40) return null
		if (node.type === 'Reroute') {
			const inLink = (node.inputs || [])[0] ? node.inputs[0].link : null
			return resolveLink(ctx, inLink, depth + 1)
		}
		if (ctx.kind === 'main' && subgraphs.has(node.type)) {
			const sg = subgraphs.get(node.type)
			const inner = subgraphOutputSource(sg, slot)
			if (!inner) return null
			return resolveNode({ kind: 'sub', sg: sg, outer: node }, inner.node, inner.slot, depth + 1)
		}
		return { node: node, slot: slot, ctx: ctx }
	}

	/** 顺着 link 找真正的产出节点 */
	function resolveLink(ctx, linkId, depth) {
		depth = depth || 0
		if (depth > 40 || linkId === null || linkId === undefined) return null
		if (ctx.kind === 'main') {
			const L = linkById.get(linkId)
			if (!L) return null
			const n = byId.get(L.from)
			if (!n) return null
			return resolveNode(ctx, n, L.fromSlot, depth)
		}
		// 子图内部
		const l = (ctx.sg.links || []).find((x) => x.id === linkId)
		if (!l) return null
		if (String(l.origin_id) === '-10') {
			// 命中子图的输入节点 -> 跨回外层
			const outerLink = subgraphInputOuter(ctx, linkId)
			if (outerLink === null) return null
			return resolveLink({ kind: 'main' }, outerLink, depth + 1)
		}
		const n = (ctx.sg.nodes || []).find((x) => String(x.id) === String(l.origin_id))
		if (!n) return null
		return resolveNode(ctx, n, l.origin_slot, depth)
	}

	/** 取一个输入端口连的源节点（带回上下文，供继续往上追） */
	function srcOf(node, inputName, ctx) {
		const inp = (node.inputs || []).find((i) => i.name === inputName)
		if (!inp || inp.link === null || inp.link === undefined) return null
		return resolveLink(ctx || { kind: 'main' }, inp.link, 0)
	}

	/** 读 CLIPTextEncode 的文本：优先 widget；有连线就试连线，失败再回退 widget */
	function textOf(node, ctx) {
		const w = widgetMap(node)
		if (w.text !== undefined && w.text !== null && String(w.text).length) return String(w.text)
		const s = srcOf(node, 'text', ctx)
		if (s) {
			const sw = widgetMap(s.node)
			if (sw.text) return String(sw.text)
			if (s.node.widgets_values && typeof s.node.widgets_values[0] === 'string') return s.node.widgets_values[0]
		}
		return ''
	}

	// ---- 找 KSampler ----
	const samplers = nodes.filter((n) => n.type === 'KSampler' || n.type === 'KSamplerAdvanced')
	if (!samplers.length) return { ok: false, error: '工作流里没找到 KSampler 节点' }
	// 多个就取第一个（若被 mute 则跳过）
	const ks = samplers.find((n) => n.mode !== 2 && n.mode !== 4) || samplers[0]
	const kw = widgetMap(ks)

	// ---- 正/负提示词 ----
	let pos = ''
	let neg = ''
	const pSrc = srcOf(ks, 'positive', { kind: 'main' })
	if (pSrc && /CLIPTextEncode|TextEncode/i.test(pSrc.node.type || '')) pos = textOf(pSrc.node, pSrc.ctx)
	const nSrc = srcOf(ks, 'negative', { kind: 'main' })
	if (nSrc && /CLIPTextEncode|TextEncode/i.test(nSrc.node.type || '')) neg = textOf(nSrc.node, nSrc.ctx)

	// ---- 模型链：KSampler.model → [LoraLoader…] → CheckpointLoaderSimple ----
	// ⚠️ 注意：输出悬空的 LoraLoader 不在链上，会被正确地忽略（见 dangling 提示）
	const loras = []
	let ckpt = ''
	let cur = srcOf(ks, 'model', { kind: 'main' })
	let guard = 0
	while (cur && guard++ < 40) {
		const t = cur.node.type
		if (t === 'LoraLoader') {
			const w = widgetMap(cur.node)
			loras.unshift({
				name: cleanStr(w.lora_name),
				model: (w.strength_model === undefined ? 1 : Number(w.strength_model)),
				clip: (w.strength_clip === undefined ? 1 : Number(w.strength_clip)),
			})
			cur = srcOf(cur.node, 'model', cur.ctx)
			continue
		}
		if (t === 'LoraLoaderModelOnly') {
			const w = widgetMap(cur.node)
			loras.unshift({ name: cleanStr(w.lora_name), model: Number(w.strength_model || 1), clip: Number(w.strength_model || 1) })
			cur = srcOf(cur.node, 'model', cur.ctx)
			continue
		}
		if (/CheckpointLoader/.test(t || '')) {
			ckpt = cleanStr(widgetMap(cur.node).ckpt_name)
			break
		}
		// 其他（比如 ModelSamplingXxx）不追了
		break
	}

	// ---- 悬空节点提示：有 LoraLoader 但输出没接任何地方 ----
	const dangling = []
	for (const n of nodes) {
		if (!/^LoraLoader/.test(n.type || '')) continue
		const outs = (n.outputs || []).filter((o) => (o.links || []).length)
		if (!outs.length) {
			const w = widgetMap(n)
			dangling.push(cleanStr(w.lora_name) + '（id=' + n.id + '，输出未接任何节点，已忽略）')
		}
	}

	// ---- CLIP / VAE：顺着 KSampler.positive 的 clip 输入找（要能跨子图来回）----
	let clip = ''
	let clipType = ''
	let vae = ''
	const seenNodes = new Set()
	function findLoader(src, depth) {
		depth = depth || 0
		if (!src || depth > 25) return
		const node = src.node
		const key = (src.ctx && src.ctx.kind === 'sub' ? 'S' : 'M') + ':' + node.id
		if (seenNodes.has(key)) return
		seenNodes.add(key)
		const w = widgetMap(node)
		if (node.type === 'CLIPLoader' && !clip) { clip = cleanStr(w.clip_name); clipType = cleanStr(w.type) }
		if (node.type === 'VAELoader' && !vae) { vae = cleanStr(w.vae_name) }
		for (const i of (node.inputs || [])) {
			if (i.link === null || i.link === undefined) continue
			const s = srcOf(node, i.name, src.ctx)
			if (s && s.node) findLoader(s, depth + 1)
		}
	}
	if (pSrc) findLoader(pSrc)
	// 从 KSampler 的 latent / model 也扫一遍，兜住 VAE 挂别处的情况
	const lat0 = srcOf(ks, 'latent_image', { kind: 'main' })
	if (lat0) findLoader(lat0)
	// checkpoint 自带的 vae 名（有些工作流不接 VAELoader）
	if (!vae) {
		const lat1 = srcOf(ks, 'latent_image', { kind: 'main' })
		if (lat1) {
			for (const i of (lat1.node.inputs || [])) {
				const s = srcOf(lat1.node, i.name, lat1.ctx)
				if (s && s.node.type === 'VAEDecode') {
					const v = srcOf(s.node, 'vae', s.ctx)
					if (v && v.node.type === 'VAELoader') vae = cleanStr(widgetMap(v.node).vae_name)
				}
			}
		}
	}
	// 全图兜底：只有唯一一个 VAELoader 就直接用
	if (!vae) {
		const vls = nodes.filter((n) => n.type === 'VAELoader')
		if (vls.length === 1) vae = cleanStr(widgetMap(vls[0]).vae_name)
	}
	if (!clip) {
		const cls = nodes.filter((n) => n.type === 'CLIPLoader')
		if (cls.length === 1) { const w = widgetMap(cls[0]); clip = cleanStr(w.clip_name); clipType = cleanStr(w.type) }
	}

	// ---- 尺寸 ----
	let w = 0
	let h = 0
	const lat = srcOf(ks, 'latent_image', { kind: 'main' })
	if (lat) {
		const lw = widgetMap(lat.node)
		if (lw.width) { w = Number(lw.width); h = Number(lw.height) }
		// 若上游还有 EmptyLatentImage / CR Aspect Ratio，继续追
		if (!w) {
			for (const i of (lat.node.inputs || [])) {
				if (i.link === null || i.link === undefined) continue
				const s = srcOf(lat.node, i.name, lat.ctx)
				if (s) { const sw = widgetMap(s.node); if (sw.width) { w = Number(sw.width); h = Number(sw.height) } }
			}
		}
	}
	if (!w) {
		const el = nodes.find((n) => /EmptyLatentImage|EmptySD3LatentImage/.test(n.type || ''))
		if (el) { const ew = widgetMap(el); w = Number(ew.width) || 0; h = Number(ew.height) || 0 }
	}

	// ---- 未识别节点 ----
	const known = new Set(Object.keys(WIDGETS).concat([
		'VAEDecode', 'VAEEncode', 'SaveImage', 'LoadImage', 'Reroute', 'Note',
		'CR Upscale Image', 'ImageScale', 'ImageScaleBy', 'UpscaleModelLoader',
		'PreviewImage', 'KSampler',
	]))
	const ignored = []
	for (const n of nodes) {
		const t = n.type || ''
		if (SILENT.has(t) || known.has(t)) continue
		if (subgraphs.has(t)) { ignored.push('子图 ' + t.slice(0, 8) + '…（已下潜取正/负）'); continue }
		if (ignored.indexOf(t) < 0) ignored.push(t)
	}

	return {
		ok: true,
		format: 'ui',
		ckpt: ckpt,
		clip: clip,
		clipType: clipType,
		vae: vae,
		loras: loras,
		pos: pos,
		neg: neg,
		w: w,
		h: h,
		steps: Number(kw.steps) || 0,
		cfg: (kw.cfg === undefined ? 0 : Number(kw.cfg)),
		sampler: cleanStr(kw.sampler_name),
		scheduler: cleanStr(kw.scheduler),
		seed: (kw.seed === undefined ? null : kw.seed),
		ignored: ignored,
		dangling: dangling,
		notes: [
			'KSampler id=' + ks.id,
			'子图下潜: ' + (subgraphs.size ? '是（' + subgraphs.size + ' 个）' : '无'),
			'Reroute 穿透: 已处理',
		].concat(dangling.length ? ['发现悬空 LoRA：' + dangling.join('；')] : []),
	}
}

// ======================================================================
//  API 格式
// ======================================================================
function parseApi(wf) {
	const nodes = wf.prompt || wf
	const byId = new Map()
	for (const k of Object.keys(nodes)) {
		const v = nodes[k]
		if (v && typeof v === 'object' && v.class_type) byId.set(String(k), v)
	}
	if (!byId.size) return { ok: false, error: '看不懂这个 JSON：既不是 UI 格式也不像 API 格式' }

	function srcOf(node, inputName) {
		const ins = node.inputs || {}
		const v = ins[inputName]
		if (!Array.isArray(v)) return null
		const n = byId.get(String(v[0]))
		return n ? { node: n, slot: v[1], id: String(v[0]) } : null
	}

	const samplers = []
	byId.forEach((v, k) => { if (/^KSampler/.test(v.class_type)) samplers.push({ v, k }) })
	if (!samplers.length) return { ok: false, error: '工作流里没找到 KSampler 节点' }
	const { v: ks, k: ksId } = samplers[0]

	const pos = (() => {
		const s = srcOf(ks, 'positive')
		return s && /TextEncode/i.test(s.node.class_type) ? cleanStr(s.node.inputs.text) : ''
	})()
	const neg = (() => {
		const s = srcOf(ks, 'negative')
		return s && /TextEncode/i.test(s.node.class_type) ? cleanStr(s.node.inputs.text) : ''
	})()

	const loras = []
	let ckpt = ''
	let clip = ''
	let clipType = ''
	let vae = ''
	let cur = srcOf(ks, 'model')
	let guard = 0
	while (cur && guard++ < 40) {
		const ct = cur.node.class_type
		if (ct === 'LoraLoader') {
			loras.unshift({
				name: cleanStr(cur.node.inputs.lora_name),
				model: Number(cur.node.inputs.strength_model === undefined ? 1 : cur.node.inputs.strength_model),
				clip: Number(cur.node.inputs.strength_clip === undefined ? 1 : cur.node.inputs.strength_clip),
			})
			cur = srcOf(cur.node, 'model'); continue
		}
		if (/CheckpointLoader/.test(ct)) { ckpt = cleanStr(cur.node.inputs.ckpt_name); break }
		cur = srcOf(cur.node, 'model')
	}
	const pSrc = srcOf(ks, 'positive')
	if (pSrc) {
		// 顺着 clip 输入找 CLIPLoader（可能经过 LoRA）
		let c = pSrc.node
		let g2 = 0
		while (c && g2++ < 20) {
			if (c.class_type === 'CLIPLoader') { clip = cleanStr(c.inputs.clip_name); clipType = cleanStr(c.inputs.type); break }
			const nxt = srcOf(c, 'clip')
			c = nxt ? nxt.node : null
		}
	}
	byId.forEach((v) => { if (v.class_type === 'VAELoader' && !vae) vae = cleanStr(v.inputs.vae_name) })

	let w = 0, h = 0
	const lat = srcOf(ks, 'latent_image')
	if (lat) { w = Number(lat.node.inputs.width) || 0; h = Number(lat.node.inputs.height) || 0 }

	const ignored = []
	const knownApi = /^(KSampler|CLIPTextEncode|CheckpointLoaderSimple|LoraLoader|CLIPLoader|VAELoader|EmptyLatentImage|EmptySD3LatentImage|VAEDecode|VAEEncode|SaveImage|LoadImage|LatentUpscaleBy|ImageScale|ImageScaleBy|UpscaleModelLoader|Reroute|Note|PreviewImage)/
	byId.forEach((v) => { if (!knownApi.test(v.class_type) && ignored.indexOf(v.class_type) < 0) ignored.push(v.class_type) })

	return {
		ok: true, format: 'api',
		ckpt, clip, clipType, vae, loras, pos, neg, w, h,
		steps: Number(ks.inputs.steps) || 0,
		cfg: Number(ks.inputs.cfg) || 0,
		sampler: cleanStr(ks.inputs.sampler_name),
		scheduler: cleanStr(ks.inputs.scheduler),
		seed: ks.inputs.seed === undefined ? null : ks.inputs.seed,
		ignored, notes: ['KSampler id=' + ksId],
	}
}

/** 主入口 */
