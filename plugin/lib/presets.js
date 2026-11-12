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

/**
 * 内置预设的版本号。
 *
 * ⚠️ 2026-10-15 加：原来 `ensureSeeds()` **只补不更新**，导致改了 presets.js
 *    也刷不到浏览器里已存的那份（localStorage），旧版会永远用下去。
 *    现在存进 localStorage 的内置预设带 `builtin: true` 标记；
 *    这个版本号一变，就**先删掉所有带标记的、再重新写入**，用户自建的预设不受影响。
 *
 *    v1 -> v2：视角修正（姿势 + 前置相机词 + 去 dynamic poster composition）
 */
export const SEED_PRESETS_VERSION = 2;

export const SEED_PRESETS = [
	{
		seed: true,
		name: '官方预设 · 原版（比耶 / 俯视）',
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
		name: '官方预设 · 站姿（平视）',
		cat: '官方预设',
		w: 896, h: 1152, steps: 20, cfg: 3.5,
		sampler: 'er_sde', scheduler: 'simple',
		ckpt: 'kirazuriAnima_v30AnimaBase1.safetensors',
		loras: [],
		pos: [
			'(from below:1.2), EMBBED:, (@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4),  flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR, BREAK,',
			'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, red drop earrings, delicate face, playful wink, bright mischievous smile, looking directly at viewer,',
			'ENVIRONMENT:, simple background, pure color background, ((dark grey background)), pure color,blue roses in the background,',
			'SUBJECT:, standing up straight, facing directly forward, both legs straight and together, both feet together pointing forward, both arms straight down at her sides, back straight, shoulders level, head upright, chin level, upright posture,',
			'CLOTHINGS:, light blue flower hair clip, long white trench coat, (white trench coat), (white shirt, light blue pleated skirt), light blue bow tie, white thigh-high stockings, white high heel ankle boots,blue flower Hair clip, ',
			'COMPOSITION:, full body, straight-on view, front view, centered composition, symmetrical framing, flat perspective, no perspective distortion, clear silhouette,',
		].join('\n\n'),
		neg: null,   // null = 用官方那条 + 平视的压制句（见 ensureSeeds 的填充逻辑）
	},
	{
		seed: true,
		name: '官方预设 · 正面证件照（平视）',
		cat: '官方预设',
		w: 896, h: 1152, steps: 20, cfg: 3.5,
		sampler: 'er_sde', scheduler: 'simple',
		ckpt: 'kirazuriAnima_v30AnimaBase1.safetensors',
		loras: [],
		pos: [
			'(from below:1.2), EMBBED:, (@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4),  flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR, BREAK,',
			'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, red drop earrings, delicate face, playful wink, bright mischievous smile, looking directly at viewer,',
			'ENVIRONMENT:, simple background, pure color background, ((dark grey background)), pure color,blue roses in the background,',
			'SUBJECT:, standing up straight, facing directly forward, body squarely facing the viewer, both legs straight and together, both feet together pointing forward, both arms straight down at her sides, hands relaxed and open, back straight, shoulders level, head upright, chin level, formal upright posture,',
			'CLOTHINGS:, light blue flower hair clip, long white trench coat, (white trench coat), (white shirt, light blue pleated skirt), light blue bow tie, white thigh-high stockings, white high heel ankle boots,blue flower Hair clip, ',
			'COMPOSITION:, full body, straight-on view, front view, centered composition, symmetrical framing, flat perspective, no perspective distortion, clear silhouette,',
		].join('\n\n'),
		neg: null,
	},
	{
		seed: true,
		name: '官方预设 · 站姿（仰视）',
		cat: '官方预设',
		w: 896, h: 1152, steps: 20, cfg: 3.5,
		sampler: 'er_sde', scheduler: 'simple',
		ckpt: 'kirazuriAnima_v30AnimaBase1.safetensors',
		loras: [],
		pos: [
			'(from below:1.5), (low angle shot:1.4), EMBBED:, (@mochizuki_kei, mochizuki_kei style), 2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4),  flat style, extreme aesthetic, newest, masterpiece, best quality, amazing quality, very aesthetic, absurdres, HDR, BREAK,',
			'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, red drop earrings, delicate face, playful wink, bright mischievous smile, looking directly at viewer,',
			'ENVIRONMENT:, simple background, pure color background, ((dark grey background)), pure color,blue roses in the background,',
			'SUBJECT:, standing up straight, facing directly forward, both legs straight and together, both feet together pointing forward, both arms straight down at her sides, back straight, shoulders level, head upright, chin level, upright posture,',
			'CLOTHINGS:, light blue flower hair clip, long white trench coat, (white trench coat), (white shirt, light blue pleated skirt), light blue bow tie, white thigh-high stockings, white high heel ankle boots,blue flower Hair clip, ',
			'COMPOSITION:, full body, (full body:1.4), from below, low angle shot, whole body in frame, feet visible, dramatic foreshortening, clear silhouette,',
		].join('\n\n'),
		neg: null,
	},
]

/**
 * 视角定义 —— 「一键切视角」用的。
 *
 * ⚠️ 2026-10-15 实测结论：**决定视角的是「姿势」，不是「相机段」。**
 *    官方那套比耶姿势（head tilted + 手举到脸边）会把相机钉死在「俯视近景」，
 *    把相机段权重提到 1.7、负向加 from above 都压不住。
 *    换成直立姿势后，相机段立刻生效。
 *
 *    另外三件必须一起做，少一件就还是俯视：
 *      - 相机词**前置**到整条提示词最前面（放最后会被稀释）
 *      - 平视也要加一点 `from below`（模型在竖幅 full body 下天然把镜头放在头顶以上）
 *      - 构图段去掉 `dynamic poster composition`（"动态海报构图"本身鼓励倾斜）
 *
 *    验收：out\_交付版验收.png（15 套 x 3 视角 x 多种子）、out\_眼平梯度.png
 */
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
