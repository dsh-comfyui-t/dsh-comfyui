/**
 * 预置预设 —— 从用户的**官方预设**派生的几套。
 *
 * 正/负提示词都是**逐字照抄**自：
 *     E:\aqca\work\anima\prompt_11series.txt
 *     E:\aqca\work\anima\neg_11series.txt
 * 包括 `EMBBED:` 的原拼写、`((dark grey background))`、
 * `pure color,blue roses`（无空格逗号）、`blue flower Hair clip`（Hair 大写）。
 *
 * `seed: true` 标记为内置预置：只在**不存在**时补进去，不会覆盖用户改过的版本。
 */
export const SEED_PRESETS = [
	{
		seed: true,
		name: '官方预设 · 原版（比耶）',
		cat: '官方预设',
		w: 896, h: 1152, steps: 20, cfg: 3.5,
		sampler: 'er_sde', scheduler: 'simple',
		ckpt: 'kirazuriAnima_v30AnimaBase1.safetensors',
		loras: [],
		pos: [
			'EMBBED:, (@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4),  flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR, BREAK,',
			'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, red drop earrings, delicate face, playful wink, bright mischievous smile, looking directly at viewer,',
			'ENVIRONMENT:, simple background, pure color background, ((dark grey background)), pure color,blue roses in the background,',
			'SUBJECT:, one hand behinde,the other hand rise level to her eyes making a sideways peace sign, rised beside head, head tilted toward the peace sign, shoulders slightly turned,',
			'CLOTHINGS:, light blue flower hair clip, long white trench coat, (white trench coat), (white shirt, light blue pleated skirt), light blue bow tie, white thigh-high stockings, white high heel ankle boots,blue flower Hair clip, ',
			'COMPOSITION:, full body, (slightly high angle shot, tilted angle shot, Dutch angle), three-quarter view, subtle wide-angle perspective, clear silhouette, dynamic poster composition,',
		].join('\n\n'),
		neg: [
			'worst quality, low quality, score_1, score_2, score_3, blurry, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra limbs, missing limbs, broken legs, merged bodies, floating body, unclear contact, disconnected pose, unrealistic piggyback pose, wrong hand placement, wrong leg placement, cropped body, cropped feet, multiple people, background details, furniture, scenery, text, watermark,',
			'excessive background detail, cropped feet, hidden shoes, painterly rendering, thick painting,  realistic lighting, glossy 3d rendering, overly detailed background, cluttered signs, (look down, face down), (close up),',
		].join('\n\n'),
	},
	{
		seed: true,
		name: '官方预设 · 站姿立正',
		cat: '官方预设',
		w: 896, h: 1152, steps: 20, cfg: 3.5,
		sampler: 'er_sde', scheduler: 'simple',
		ckpt: 'kirazuriAnima_v30AnimaBase1.safetensors',
		loras: [],
		pos: [
			'EMBBED:, (@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4),  flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR, BREAK,',
			'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, red drop earrings, delicate face, playful wink, bright mischievous smile, looking directly at viewer,',
			'ENVIRONMENT:, simple background, pure color background, ((dark grey background)), pure color,blue roses in the background,',
			'SUBJECT:, standing at attention, both legs straight and together, both arms straight at her sides, back straight, formal posture, chin slightly raised,',
			'CLOTHINGS:, light blue flower hair clip, long white trench coat, (white trench coat), (white shirt, light blue pleated skirt), light blue bow tie, white thigh-high stockings, white high heel ankle boots,blue flower Hair clip, ',
			'COMPOSITION:, full body, (slightly low angle shot, tilted angle shot), three-quarter view, subtle wide-angle perspective, clear silhouette, dynamic poster composition,',
		].join('\n\n'),
		neg: null,   // null = 用官方那条（见 ensureSeeds 的填充逻辑）
	},
	{
		seed: true,
		name: '官方预设 · 正面证件照站姿',
		cat: '官方预设',
		w: 896, h: 1152, steps: 20, cfg: 3.5,
		sampler: 'er_sde', scheduler: 'simple',
		ckpt: 'kirazuriAnima_v30AnimaBase1.safetensors',
		loras: [],
		pos: [
			// ⚠️ 前置 (from below:1.2)：实测不加这句，即使姿势段写 upright、
			//    COMPOSITION 写 eye-level，出图仍会翻回俯视。这是"抵掉模型下压
			//    倾向"的必要项，不是真的想拍仰视 —— 别单独删。
			//    见 docs/生成经验.md #3：决定视角的是姿势，相机词只是辅助。
			'(from below:1.2), EMBBED:, (@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4),  flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR, BREAK,',
			'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, red drop earrings, delicate face, playful wink, bright mischievous smile, looking directly at viewer,',
			'ENVIRONMENT:, simple background, pure color background, ((dark grey background)), pure color,blue roses in the background,',
			'SUBJECT:, standing up straight, facing directly forward, body squarely facing the viewer, both legs straight and together, both feet together pointing forward, both arms straight down at her sides, hands relaxed and open, back straight, shoulders level, head upright, chin level, formal upright posture,',
			'CLOTHINGS:, light blue flower hair clip, long white trench coat, (white trench coat), (white shirt, light blue pleated skirt), light blue bow tie, white thigh-high stockings, white high heel ankle boots,blue flower Hair clip, ',
			'COMPOSITION:, full body, straight-on view, front view, eye-level shot, centered composition, symmetrical framing, flat perspective, clear silhouette, plain even framing,',
		].join('\n\n'),
		neg: null,
	},
]


// ==================== 视角（1.0 移植）====================
export const VIEWS = [
	{
		key: 'high',
		label: '俯视',
		hint: '官方原版视角（相机略高于视线）',
		prefix: '',
		pose: 'SUBJECT:, one hand behinde,the other hand rise level to her eyes making a sideways peace sign, rised beside head, head tilted toward the peace sign, shoulders slightly turned,',
		comp: 'COMPOSITION:, full body, (slightly high angle shot, tilted angle shot, Dutch angle), three-quarter view, subtle wide-angle perspective, clear silhouette, dynamic poster composition,',
		negAdd: '',
	},
	{
		key: 'eye',
		label: '平视',
		hint: '相机与视线齐平，正面全身',
		prefix: '(from below:1.2), ',
		pose: 'SUBJECT:, standing up straight, facing directly forward, both legs straight and together, both feet together pointing forward, both arms straight down at her sides, back straight, shoulders level, head upright, chin level, upright posture,',
		comp: 'COMPOSITION:, full body, straight-on view, front view, centered composition, symmetrical framing, flat perspective, no perspective distortion, clear silhouette,',
		negAdd: " from above, high angle shot, looking down, bird's-eye view,",
	},
	{
		key: 'low',
		label: '仰视',
		hint: '相机低于视线向上拍',
		prefix: '(from below:1.5), (low angle shot:1.4), ',
		pose: 'SUBJECT:, standing up straight, facing directly forward, both legs straight and together, both feet together pointing forward, both arms straight down at her sides, back straight, shoulders level, head upright, chin level, upright posture,',
		comp: 'COMPOSITION:, full body, (full body:1.4), from below, low angle shot, whole body in frame, feet visible, dramatic foreshortening, clear silhouette,',
		negAdd: " from above, high angle shot, looking down, bird's-eye view,",
	},
]

/**
 * 把一条正负提示词改造成指定视角。
 *
 * 只动两处：**最后一个 `SUBJECT:` 段（姿势）** 和 **`COMPOSITION:` 段**，
 * 并把前置相机词挂到整条最前面。其余段落**逐字不动**。
 *
 * @param {string} pos 原正向提示词
 * @param {string} neg 原负向提示词
 * @param {'high'|'eye'|'low'} key 视角
 * @returns {{pos: string, neg: string, changed: boolean, moved: number}}
 */
export function applyView(pos, neg, key) {	const v = VIEWS.filter((x) => x.key === key)[0]
	if (!v) return { pos: pos, neg: neg, changed: false, moved: 0 }

	// 1) 剥掉已有的前置相机词（形如 `(...), ` 且出现在第一个 `XXX:,` 段首之前）
	let body = String(pos || '')
	body = body.replace(/^(?:\([^()]*\)\s*,\s*)+/, '')

	let blocks = body.split(/\n\s*\n/)
	// 2) 换掉 COMPOSITION 段
	let hitComp = 0
	blocks = blocks.map((b) => {
		if (/^\s*COMPOSITION:/.test(b)) { hitComp++; return v.comp }
		return b
	})
	if (!hitComp) blocks.push(v.comp)

	// 3) 换掉**最后一个** SUBJECT: 段（即姿势段；第一个是角色外貌段）
	let lastSub = -1
	blocks.forEach((b, i) => { if (/^\s*SUBJECT:/.test(b)) lastSub = i })
	if (lastSub >= 0) blocks[lastSub] = v.pose

	let out = blocks.join('\n\n')
	if (v.prefix) out = v.prefix + out

	// 4) 负向：先去掉旧的压制句，再按视角加回
	let n = String(neg || '')
	n = n.replace(/\s*from above,\s*high angle shot,\s*looking down,\s*bird's-eye view,/g, '')
	if (v.negAdd) n = n.replace(/\s*$/, '') + v.negAdd

	return { pos: out, neg: n, changed: true, moved: (hitComp ? 1 : 0) + (lastSub >= 0 ? 1 : 0) }
}


/**
 * 从一条正向提示词**反推**它属于哪个视角。
 *
 * 用途：套用一个（可能是很久以前存的）预设之后，让「视角」按钮的高亮跟实际一致 ——
 * 避免"看着是平视、实际发出去的还是俯视构图"。
 *
 * @param {string} pos
 * @returns {'high'|'eye'|'low'}
 */
export function detectView(pos) {
	const s = String(pos || '');
	if (/from below:1\.[4-9]|\(low angle shot|worm's-eye/.test(s)) return 'low';
	if (/from below:1\.[1-3]|eye-level shot|straight-on view/.test(s)) return 'eye';
	return 'high';
}
