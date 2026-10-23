/**
 * ⚠️ 自动生成，不要直接改这个文件。
 *
 * 由 tools/build_client.py 从下面三个源文件拼出：
 *     lib/dict.js     中英对照词库（LIB / EXTRA / buildCn2En / translateCn）
 *     lib/presets.js  预置预设（官方预设的几套派生）
 *     lib/app.js      界面与 Cordis 注册
 * 改完源文件后跑： python plugin/tools/build_client.py   （--check 只比对不写）
 *
 * 为什么单文件：DSH 客户端插件只认一个 ./client 导出，浏览器侧没有文件系统，
 * require() 只能解析已注册的模块工厂，不能 require 同目录的文件。
 */
window.__ModuleLoader__.load({
	id: "dsh-comfyui-console",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		// ==================== 中英对照词库（来自 lib/dict.js）====================
		/**
		 * DSH × ComfyUI 绘图台 —— 中英对照词库（分类）
		 *
		 * 设计：
		 *   - LIB 按「用途分类」组织，每类下一串 [中文名, 英文标签]
		 *   - 图库页点一下就把英文标签追加进正向提示词
		 *   - CN2EN 由 LIB 自动展平（中文名 → 英文标签），供"中文转标签"用
		 *   - EXTRA 是额外词汇表（同义词、常用词），也进 CN2EN
		 *
		 * 规则：英文一律用 Danbooru 风格标签，逗号分隔，不带括号（权重由页面另外加）。
		 */
		const LIB = {
		  '质量': [
		    ['杰作', 'masterpiece, best quality, very aesthetic, absurdres'],
		    ['最高画质', 'best quality, amazing quality, very aesthetic, absurdres, HDR'],
		    ['高清', 'highres, absurdres, HDR'],
		    ['极简质量串', 'masterpiece, best quality'],
		  ],
		  '风格': [
		    ['平涂赛璐璐', 'flat color, cel shading, flat shading, solid color blocks, minimal gradient'],
		    ['干净线稿', 'clean crisp lineart, prominent clean lineart'],
		    ['粗线稿', 'bold lineart, thick outlines, heavy line weight'],
		    ['线稿加重', '(lineart:1.4), prominent clean lineart'],
		    ['2D 动画风', '2d anime illustration'],
		    ['望月けい风', '(@mochizuki_kei, mochizuki_kei style)'],
		    ['厚涂', 'painterly, thick painting, detailed shading, soft lighting'],
		    ['电影感', 'cinematic lighting, depth of field, lens flare, bokeh, dramatic shadows'],
		    ['复古赛璐璐', 'retro anime, 90s anime, cel animation, film grain'],
		    ['水彩', 'watercolor, soft edges, paper texture'],
		    ['像素画', 'pixel art, limited palette, dithering'],
		    ['高对比', 'high contrast, strong shadows, vivid colors'],
		  ],
		    '衣服-常服': [
		    ['白大衣', 'long white trench coat, open coat'],
		    ['白衬衫', 'white shirt'],
		    ['薄荷领结', 'light blue bowtie'],
		    ['蓝百褶裙', 'light blue pleated skirt'],
		    ['白过膝袜', 'white thighhighs, zettai ryouiki'],
		    ['白高跟靴', 'white high heel ankle boots'],
		    ['校服', 'school uniform, blazer, plaid skirt'],
		    ['水手服', 'serafuku, sailor collar, pleated skirt'],
		    ['连衣裙', 'one-piece dress'],
		    ['毛衣', 'sweater, knitwear'],
		    ['牛仔裤', 'jeans, denim'],
		    ['运动服', 'tracksuit, jersey'],
		  ],
		  '衣服-军礼服': [
		    ['军礼服·大类', '(military dress uniform:1.3)'],
		    ['肩章', 'gold epaulettes'],
		    ['绶带', 'gold aiguillette on the shoulder'],
		    ['勋章', 'ribbon bar and medals on the chest'],
		    ['大檐帽', 'peaked cap with gold insignia'],
		    ['白手套', 'white gloves'],
		    ['双排扣', 'double-breasted jacket with gold buttons'],
		    ['金侧条裤', 'white trousers with a gold side stripe'],
		    ['长尾礼服大衣', 'long ceremonial dress coat with tails'],
		    ['披风', 'ceremonial cape over the shoulders, red cape lining'],
		    ['佩剑', 'ceremonial saber at her hip'],
		    ['联邦白礼服', 'white ceremonial dress uniform, earth federation dress uniform'],
		    ['吉翁绿礼服', 'olive green officer dress uniform, zeon officer dress uniform'],
		    ['藏青礼服', 'navy blue dress uniform, red trim and red cuffs'],
		    ['绯红礼服', 'crimson red dress uniform, gold trim'],
		    ['黑金礼服', 'black and gold dress uniform, ornate gold embroidery'],
		    ['女式礼服裙装', 'white dress uniform jacket, matching knee-length pleated skirt'],
		  ],
		  '衣服-驾驶员服': [
		    ['驾驶员服·大类', '(pilot suit:1.3)'],
		    ['宇宙服', '(normal suit:1.3), pressurized space suit'],
		    ['联邦宇宙服', 'white and blue normal suit, earth federation space force normal suit'],
		    ['吉翁宇宙服', 'olive green zeon space suit, zeon principality space force normal suit'],
		    ['夏亚红', 'crimson red zeon normal suit, zeon ace pilot suit'],
		    ['天人的', 'black and white celestial being pilot suit, gundam 00 pilot suit'],
		    ['ZAFT红衣', 'red zaft military uniform, gundam seed zaft red uniform'],
		    ['OZ制服', 'white oz military uniform, blue cape, gundam wing oz uniform'],
		    ['铁血驾驶员服', 'white and red utilitarian flight suit, gundam iron blooded orphans pilot suit'],
		    ['头盔夹腋下', 'sealed helmet held under one arm'],
		    ['生命维持背包', 'life support backpack, chest control panel'],
		  ],
		  '姿态-站': [
		    ['立正', 'standing at attention, both legs straight and together, both arms straight at her sides'],
		    ['正面证件照', 'standing up straight, facing directly forward, body squarely facing the viewer, both feet together pointing forward, both arms straight down at her sides, formal upright posture'],
		    ['自然站', 'standing, straight legs, both arms relaxed at her sides, weight on one leg'],
		    ['手插口袋', 'standing, both hands in coat pockets, shoulders relaxed, contrapposto'],
		    ['靠墙站', 'leaning against a wall, back against the wall, one leg bent with foot on the wall'],
		    ['叉腰', 'hands on hips, akimbo'],
		    ['抱臂', 'crossed arms'],
		    ['背手', 'arms behind back, hands behind her back'],
		  ],
		  '姿态-坐': [
		    ['坐椅子', 'sitting on a chair, legs crossed at the knee, upper body upright'],
		    ['抱膝坐', 'sitting on the ground, knees drawn up to her chest, arms wrapped around her knees'],
		    ['侧坐伸腿', 'sitting on the ground, legs extended to one side, one hand planted on the ground'],
		    ['盘腿坐', 'sitting cross-legged on the ground'],
		    ['跪坐', 'kneeling on both knees, sitting back on her heels, wariza'],
		    ['坐在桌边', 'sitting on the edge of a desk, legs dangling'],
		    ['屈膝坐床', 'sitting on a bed, knees up, hugging a pillow'],
		  ],
		  '姿态-其他': [
		    ['蹲姿', 'crouching, knees deeply bent, one hand touching the ground'],
		    ['跪姿', 'kneeling on both knees, sitting back on her heels'],
		    ['仰卧', 'lying on her back, arms spread out to the sides'],
		    ['俯卧', 'lying on her stomach, on her front'],
		    ['侧卧', 'lying on her side'],
		    ['漂浮', 'floating in the air, coat fluttering, hair floating upward'],
		    ['跳跃', 'jumping, mid-air, legs bent'],
		    ['回头', 'looking back, turning head'],
		    ['踮脚', 'standing on tiptoes, tiptoes'],
		  ],
		  '动作': [
		    ['比耶', 'peace sign, v sign'],
		    ['手举到脸边比耶', 'one hand raised beside her head making a sideways peace sign'],
		    ['挥手', 'waving, waving hand'],
		    ['伸手', 'reaching out, outstretched arm, reaching towards viewer'],
		    ['鼓掌', 'clapping'],
		    ['敬礼', 'salute, military salute'],
		    ['扶帽檐', 'hand on the brim of her cap, adjusting her hat'],
		    ['拨头发', 'hand in her own hair, brushing hair'],
		    ['手放胸前', 'hand on own chest'],
		    ['握拳', 'clenched fist, hand on hip'],
		    ['举剑', 'holding a sword, raised sword'],
		    ['持花', 'holding a flower, holding a rose'],
		    ['捧书', 'holding a book, reading'],
		    ['拿咖啡', 'holding a coffee cup'],
		    ['双手捧脸', 'hands on own face, hands framing face'],
		    ['撑伞', 'holding an umbrella, umbrella'],
		    ['拉手', 'holding hands, linked hands'],
		    ['递东西', 'holding out an object towards viewer'],
		  ],
		  '表情': [
		    ['眨眼', 'one eye closed, wink'],
		    ['坏笑', 'mischievous smile, grin, open mouth'],
		    ['浅笑', 'slight smile, closed mouth'],
		    ['面瘫', 'expressionless, blank stare, emotionless'],
		    ['惊讶', 'surprised, wide-eyed, open mouth'],
		    ['害羞', 'blush, embarrassed, shy'],
		    ['生气', 'angry, pout, frown'],
		    ['伤心', 'sad, crying, tears'],
		    ['沉思', 'thinking, pensive'],
		    ['自信', 'confident, smug, smirk'],
		    ['困倦', 'sleepy, heavy eyelids, yawning'],
		    ['挑衅', 'smug, teasing smile'],
		    ['张嘴笑', 'open mouth, laughing, happy'],
		  ],
		  '背景': [
		    ['纯色背景', 'simple background, pure color background'],
		    ['深灰背景', '((dark grey background))'],
		    ['蓝玫瑰背景', 'blue roses in the background, blue theme'],
		    ['白背景', 'white background'],
		    ['黑背景', 'black background'],
		    ['渐变背景', 'gradient background'],
		    ['星星背景', 'starry sky, night sky, stars'],
		    ['樱花背景', 'cherry blossoms, sakura, falling petals'],
		    ['教室', 'classroom, school desk'],
		    ['街道', 'city street, urban, buildings'],
		    ['海边', 'beach, ocean, seaside'],
		    ['森林', 'forest, trees'],
		    ['天空', 'sky, clouds'],
		    ['虚化背景', 'blurry background, bokeh, depth of field'],
		    ['几何背景', 'geometric background, abstract background'],
		  ],
		  '镜头': [
		    ['全身', 'full body'],
		    ['半身', 'upper body, portrait'],
		    ['胸像', 'bust shot'],
		    ['膝上', 'cowboy shot'],
		    ['特写', 'close-up, face focus'],
		    ['大特写', 'extreme close-up'],
		    ['正面', 'front view, straight-on view'],
		    ['四分之三侧', 'three-quarter view'],
		    ['侧面', 'from side, profile'],
		    ['背面', 'from behind, back view'],
		    ['俯视', 'from above, high angle shot'],
		    ['仰视', 'from below, low angle shot'],
		    ['平视', 'eye-level shot'],
		    ['荷兰角', 'Dutch angle, tilted angle shot'],
		    ['广角', 'wide shot, subtle wide-angle perspective'],
		    ['对称构图', 'centered composition, symmetrical framing'],
		    ['居中', 'centered composition'],
		    ['海报构图', 'dynamic poster composition, clear silhouette'],
		  ],
		  '负面': [
		    ['质量负面', 'worst quality, low quality, blurry'],
		    ['解剖负面', 'bad anatomy, bad proportions, bad hands, extra fingers, missing fingers, fused fingers'],
		    ['肢体负面', 'extra limbs, extra arms, extra legs, missing limbs, malformed limbs'],
		    ['手部负面', 'bad hands, extra digits, fewer digits, wrong hand placement'],
		    ['多图负面', 'multiple views, reference sheet, character sheet, collage, split screen'],
		    ['文字负面', 'text, watermark, signature, username, artist name, jpeg artifacts'],
		    ['幼态负面', 'loli, child, chibi, toddler'],
		    ['多人负面', '2girls, multiple girls, duo'],
		    ['厚涂负面', 'painterly rendering, thick painting, glossy 3d rendering, realistic lighting'],
		    ['腿长负面', 'long legs, extremely long legs, stilt legs, disproportionate legs'],
		    ['健硕负面', 'muscular, muscular female, broad shoulders, heavy build, stocky, thick thighs'],
		    ['裁切负面', 'cropped body, cropped feet, out of frame'],
		    ['低头负面', '(look down, face down)'],
		    ['CloseUp负面', '(close up)'],
		  ],
		}

		/**
		 * 额外词表：不在图库里、但"中文转标签"时希望认得的词。
		 * 也用于把常见中文说法映射到标准标签。
		 */
		const EXTRA = [
		  ['白色', 'white'], ['黑色', 'black'], ['红色', 'red'], ['蓝色', 'blue'],
		  ['粉色', 'pink'], ['紫色', 'purple'], ['绿色', 'green'], ['黄色', 'yellow'],
		  ['金色', 'gold'], ['银色', 'silver'], ['灰色', 'grey'], ['橙色', 'orange'],
		  ['长', 'long'], ['短', 'short'], ['大', 'large'], ['小', 'small'],
		  ['少女', '1girl'], ['一个人', 'solo'], ['女性', 'female'],
		  ['头发', 'hair'], ['眼睛', 'eyes'], ['脸', 'face'], ['手', 'hands'],
		  ['衣服', 'clothes'], ['帽子', 'hat'], ['裙子', 'skirt'], ['裤子', 'pants'],
		  ['鞋', 'shoes'], ['靴子', 'boots'], ['手套', 'gloves'], ['披风', 'cape'],
		  ['微笑', 'smile'], ['笑', 'smile'], ['哭', 'crying'], ['生气', 'angry'],
		  ['看镜头', 'looking at viewer'], ['看向旁边', 'looking away'],
		  ['闭眼', 'closed eyes'], ['睁眼', 'open eyes'],
		  ['花', 'flower'], ['玫瑰', 'rose'], ['蓝玫瑰', 'blue roses'],
		  ['星星', 'stars'], ['月亮', 'moon'], ['太阳', 'sun'],
		  ['雨', 'rain'], ['雪', 'snow'], ['风', 'wind'],
		  ['室内', 'indoors'], ['室外', 'outdoors'],
		  ['白天', 'day'], ['夜晚', 'night'],
		  ['单色', 'monochrome'], ['彩色', 'colorful'],
		  ['和风', 'japanese clothes, kimono'], ['汉服', 'hanfu, chinese clothes'],
		  ['制服', 'uniform'], ['军装', 'military uniform'], ['礼服', 'dress uniform'],
		  ['机甲', 'mecha'], ['机器人', 'robot'], ['飞船', 'spaceship'],
		  ['武器', 'weapon'], ['刀', 'sword, katana'], ['枪', 'gun'],
		  ['眼镜', 'glasses'], ['耳机', 'headphones'], ['项圈', 'collar'],
		  ['尾巴', 'tail'], ['翅膀', 'wings'], ['角', 'horns'],
		  ['猫耳', 'cat ears, nekomimi'], ['兽耳', 'animal ears'],
		  // —— 姿势大类词（第一版漏了，测试时"站姿"没被识别）——
		  ['站姿', 'standing'], ['坐姿', 'sitting'], ['蹲姿', 'crouching'],
		  ['跪姿', 'kneeling'], ['躺姿', 'lying down'], ['卧姿', 'lying down'],
		  ['姿势', 'pose'], ['动作姿势', 'pose'],
		  // —— 服装大类词 ——
		  ['军礼服', '(military dress uniform:1.3)'], ['礼服', 'dress uniform'],
		  ['驾驶员服', '(pilot suit:1.3)'], ['宇宙服', '(normal suit:1.3)'],
		  ['军服', 'military uniform'], ['军装', 'military uniform'],
		  ['私服', 'casual clothes'], ['便服', 'casual clothes'],
		  ['发饰', 'hair ornament'], ['头饰', 'hair ornament'],
		  ['耳坠', 'drop earrings'], ['耳环', 'earrings'],
		  // —— 画质 / 风格 ——
		  ['赛璐璐', 'cel shading'], ['平涂', 'flat color, cel shading, flat shading'],
		  ['线稿', 'lineart'], ['高画质', 'best quality, very aesthetic, absurdres'],
		  ['正面', 'front view'], ['侧面', 'from side'], ['背面', 'from behind'],
		  ['全身', 'full body'], ['半身', 'upper body'], ['特写', 'close-up'],
		]

		/** 把 LIB + EXTRA 展平成「中文 → 英文」查找表；长词优先匹配。 */
		function buildCn2En() {
		  const dict = new Map()
		  const put = (cn, en) => {
		    if (!cn || !en) return
		    if (!dict.has(cn)) dict.set(cn, en)
		  }
		  for (const cat of Object.keys(LIB)) {
		    for (const pair of LIB[cat]) put(pair[0], pair[1])
		  }
		  for (const pair of EXTRA) put(pair[0], pair[1])
		  // 按长度降序，保证"蓝玫瑰"先于"玫瑰"、"白过膝袜"先于"袜子"
		  return Array.from(dict.entries()).sort((a, b) => b[0].length - a[0].length)
		}

		/**
		 * 中文 → 英文标签串。
		 * 扫描输入，把认得的中文词替换成英文标签，其余原样保留。
		 *
		 * ⚠️ 替换时必须**前后补逗号**。第一版用空格替换，结果插进来的标签
		 *    自己带逗号、彼此之间没逗号，整串糊成一句（踩过）。
		 *    这里用哨兵字符占位，最后统一收敛逗号，避免和英文标签内部的逗号打架。
		 *
		 * @returns {{out: string, hits: Array<[string,string]>, misses: string[]}}
		 */
		function translateCn(text, pairs) {
			const SENT = '\u0001'
			let s = String(text || '')
			const hits = []
			for (const [cn, en] of pairs) {
				if (s.indexOf(cn) >= 0) {
					s = s.split(cn).join(SENT + en + SENT)
					hits.push([cn, en])
				}
			}
			const out = s
				.split(SENT).join(', ')
				.replace(/[，、；：]/g, ',')
				.replace(/\s*,\s*/g, ', ')          // 逗号两侧统一一个空格
				.replace(/(?:,\s*)+/g, ', ')        // 连续逗号收敛
				.replace(/\s{2,}/g, ' ')
				.replace(/^[,\s]+|[,\s]+$/g, '')
			// 没被转换掉的连续中文算未匹配
			const misses = Array.from(new Set((out.match(/[\u4e00-\u9fa5]+/g) || [])))
			return { out: out, hits: hits, misses: misses }
		}
		// ==================== 预置预设（来自 lib/presets.js）====================
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
		const SEED_PRESETS = [
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
		const VIEWS = [
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
		function applyView(pos, neg, key) {	const v = VIEWS.filter((x) => x.key === key)[0]
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
		function detectView(pos) {
			const s = String(pos || '');
			if (/from below:1\.[4-9]|\(low angle shot|worm's-eye/.test(s)) return 'low';
			if (/from below:1\.[1-3]|eye-level shot|straight-on view/.test(s)) return 'eye';
			return 'high';
		}
		// ==================== ComfyUI 工作流解析（来自 lib/workflow.js）====================
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
		// ==================== 词库小卡片组件（来自 lib/dictcard.js）====================
		// 词库小卡片的两个组件：一对输入框（中文备注 + 英文标签 + 词性）和整张卡片的编辑弹层。
		// 独立成段是为了把 app.js 里 9k 字符的 JSX 挪走；拼接后仍在同一个工厂作用域里。

		/** 词性三键：正 / 负 / 自（自＝没标，插入时按正向算） */
		function PolKeys(props) {
			const cur = props.pol || "";
			return ["pos", "neg", ""].map((k) => h("button", {
				key: "p" + (k || "auto"),
				type: "button",
				title: k === "pos" ? "永远进正向" : (k === "neg" ? "永远进负面（插入时进负面栏）" : "自动：没标词性，插入时按正向"),
				onClick: (e) => {
					if (e && e.stopPropagation) e.stopPropagation();
					if (props.onPick) props.onPick(k);
				},
				style: {
					fontSize: "10.5px", lineHeight: 1.15, padding: "1px 6px", borderRadius: "999px", cursor: "pointer",
					background: cur === k ? (k === "neg" ? "var(--c-bad-bg)" : (k === "pos" ? "var(--c-accent-bg2)" : "var(--c-panel2)")) : "transparent",
					color: k === "neg" ? "var(--c-bad)" : (k === "pos" ? "var(--c-fg2)" : "var(--c-fg5)"),
					border: "1px solid " + (cur === k ? (k === "neg" ? "var(--c-bad)" : (k === "pos" ? "var(--c-accent)" : "var(--c-line)")) : "var(--c-line)"),
				},
			}, k === "pos" ? "正" : k === "neg" ? "负" : "自"));
		}

		/** 一对输入：中文备注 + 英文标签 + 词性 + 按钮。草稿自己管，提交交给外面 */
		function CapPairInput(props) {
			const [cn, setCn] = React.useState(props.initCn || "");
			const [en, setEn] = React.useState(props.initEn || "");
			const [myPol, setMyPol] = React.useState(props.pol || "");   // 自管词性（新增那行用）
			const curPol = props.onPol ? (props.pol || "") : myPol;      // 外部给了 onPol 就是受控
			const pickPol = (k) => { if (props.onPol) props.onPol(k); else setMyPol(k); };
			const submit = () => {
				const c = String(cn).trim(), e = String(en).trim();
				setCn(""); setEn("");
				props.onCommit(c, e, curPol);
			};
			const inputStyle = { padding: "2px 5px", borderRadius: "999px", fontSize: "11.5px", border: "none", background: "transparent", color: "var(--c-fg)" };
			return h("span", {
				style: { display: "inline-flex", alignItems: "center", gap: "2px", padding: "1px 3px 1px 8px", borderRadius: "999px",
					border: "1px dashed var(--c-line)", background: props.accent ? "var(--c-accent-bg2)" : "transparent",
					flex: props.grow ? "1 1 240px" : "0 0 auto", minWidth: props.grow ? "180px" : "0" },
			},
				h("input", {
					autoFocus: !!props.autoFocus, value: cn, placeholder: "中文备注",
					onChange: (e) => setCn(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); }
						else if (e.key === "Escape") { e.stopPropagation(); props.onCancel(); }
					},
					style: Object.assign({ width: "92px" }, inputStyle),
				}),
				h("span", { style: { width: "1px", height: "14px", background: "var(--c-line)", flexShrink: 0 } }),
				h("input", {
					value: en, placeholder: props.enHint || "英文标签",
					onChange: (e) => setEn(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter" || e.key === "," || e.key === "，") { e.preventDefault(); e.stopPropagation(); submit(); }
						else if (e.key === "Backspace" && !en && props.onEmptyBackspace) { e.preventDefault(); e.stopPropagation(); props.onEmptyBackspace(); }
						else if (e.key === "Escape") { e.stopPropagation(); props.onCancel(); }
					},
					onBlur: () => { const c = String(cn).trim(), e2 = String(en).trim(); if (e2 && props.onBlur) props.onBlur(c, e2, curPol); },
					style: Object.assign({ flex: props.grow ? "1 1 110px" : "0 0 auto", width: props.grow ? null : "136px", minWidth: "88px" }, inputStyle),
				}),
				props.showPol === false ? null : h(PolKeys, { pol: curPol, onPick: pickPol }),
				h("button", {
					style: Object.assign({}, S.btn2, { padding: "1px 9px", fontSize: "11px", borderRadius: "999px" }),
					title: props.btnTitle || "", onClick: submit,
				}, props.btn || "加"),
				props.onDrop ? h("button", {
					style: Object.assign({}, S.btn2, { padding: "1px 8px", fontSize: "11px", borderRadius: "999px", borderColor: "var(--c-bad)", color: "var(--c-bad)" }),
					onClick: () => props.onDrop(),
				}, "删掉") : null);
		}

		/** 词库小卡片编辑弹层：中文名 + 胶囊提示词（每颗带词性）+ 保存 / 删除 / 导出 */
		function DictCardEditor(props) {
			const d = props.draft || {};
			const patch = props.patch;
			const [capIdx, setCapIdx] = React.useState(-1);
			const [, bump] = React.useState(0);          // 改词性后本弹层自己重画
			const touch = () => { bump((x) => x + 1); if (props.onChanged) props.onChanged(); };
			const tags = Array.from(new Set(String(d.e2 || "").split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)));
			const setTags = (arr) => patch({ e2: arr.join(", ") });
			const pushTag = (cn, en, pol) => {
				const add = String(en || "").split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
				if (!add.length) return;
				const cur = tags.slice();
				add.forEach((x) => { if (cur.indexOf(x) < 0) cur.push(x); });
				setTags(cur);
				const n = String(cn || "").trim();
				if (n) add.forEach((x) => setCapNote(x, n));
				if (pol === "pos" || pol === "neg") add.forEach((x) => setCapPol(x, pol));
				touch();
			};
			const dropTag = (i) => {
				const cur = tags.slice();
				const t0 = cur[i];
				if (!t0) return;
				cur.splice(i, 1);
				setTags(cur);
				setCapNote(t0, "");
				setCapIdx(-1);
				touch();
			};
			const commitCap = (i, cn, en) => {
				const cur = tags.slice();
				const old = cur[i] || "";
				const t = String(en || "").trim();
				if (t) cur[i] = t;
				setTags(cur);
				if (old && old !== t) setCapNote(old, "");
				if (t) setCapNote(t, String(cn || "").trim());
				setCapIdx(-1);
				touch();
			};
			/** 点胶囊上的词性键：自 → 正 → 负 → 自 */
			const cyclePol = (tk) => {
				const cur = capPolOf(tk);
				setCapPol(tk, cur === "pos" ? "neg" : (cur === "neg" ? "" : "pos"));
				touch();
			};
			/** 胶囊芯片上的词性小标 */
			const polTag = (tk) => {
				const p = capPolOf(tk);
				return h("span", {
					title: (p === "pos" ? "正向：插入时进正向栏" : (p === "neg" ? "负面：插入时进负面栏" : "自动：没标词性，插入时按正向"))
						+ "\u000A点一下：自 → 正 → 负 → 自",
					onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); cyclePol(tk); },
					style: { flexShrink: 0, fontSize: "10px", lineHeight: 1.15, padding: "1px 5px", borderRadius: "999px", cursor: "pointer",
						fontWeight: 700,
						background: p === "neg" ? "var(--c-bad-bg)" : (p === "pos" ? "var(--c-accent-bg2)" : "transparent"),
						color: p === "neg" ? "var(--c-bad)" : (p === "pos" ? "var(--c-fg2)" : "var(--c-fg5)"),
						border: "1px solid " + (p === "neg" ? "var(--c-bad)" : (p === "pos" ? "var(--c-accent)" : "var(--c-line)")) },
				}, p === "pos" ? "正" : (p === "neg" ? "负" : "自"));
			};
			return h("div", {
				onClick: props.onClose,
				style: { position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.38)", display: "flex", alignItems: "center", justifyContent: "center" },
			},
				h("div", {
					onClick: (e) => e.stopPropagation(),
					onKeyDown: (e) => {
						if (e.key === "Escape") { e.stopPropagation(); props.onClose(); }
						else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); props.onSave(); }
					},
					style: { width: "min(560px, 92vw)", background: "var(--c-panel)", color: "var(--c-fg)", border: "1px solid var(--c-line)",
						borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 18px 48px rgba(0,0,0,.38)" },
				},
					h("div", { style: { fontSize: "13px", fontWeight: 600 } }, d.isNew ? "新建卡片" : ("改词条 · " + d.cat)),
					h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, d.isNew
						? "中文＝卡片上显示的字；英文＝真正进提示词的标签。每颗胶囊自己带词性：负 → 插入时进负面，正/自 → 进正向。"
						: "中文＝卡片上显示的字；英文＝真正进提示词的标签。每颗胶囊自己带词性：负 → 插入时进负面，正/自 → 进正向。"),
					d.isNew ? h("div", { style: { display: "flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "var(--c-fg3)" } },
						"分类",
						h("select", {
							value: d.cat,
							onChange: (e) => patch({ cat: e.target.value }),
							style: Object.assign({}, S.sel || S.inp, { flex: "1 1 auto", minWidth: 0 }),
						}, (props.groups.length ? props.groups : [props.group]).filter((x) => !x.all).map((x) => h("option", { key: x.key, value: dictCardTargetCat(x) },
							x.name + "（" + dictCardTargetCat(x) + "）")))) : null,
					h("div", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "中文"),
					h("input", {
						value: d.c || "", autoFocus: true,
						onChange: (e) => patch({ c: e.target.value }),
						style: Object.assign({}, S.input || S.inp, { width: "100%", boxSizing: "border-box" }),
					}),
					h("div", { style: { display: "flex", alignItems: "baseline", gap: "8px", fontSize: "12px", color: "var(--c-fg3)" } },
						h("span", null, "提示词本体"),
						h("span", { style: { fontSize: "11px", color: "var(--c-fg5)" } }, "每颗胶囊：词性小标（点它 自→正→负）+ 中文备注；点正文改字，× 删掉；底下那行加新胶囊时先选词性")),
					h("div", {
						style: { display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center", alignContent: "flex-start",
							padding: "6px", borderRadius: "8px", border: "1px solid var(--c-line)", background: "var(--c-panel2)",
							minHeight: "40px", maxHeight: "176px", overflowY: "auto", boxSizing: "border-box" },
					},
						tags.map((tk, i) => (capIdx === i
							? h(CapPairInput, {
								key: "ce" + i, autoFocus: true, accent: true, initCn: capNoteOf(tk), initEn: tk, btn: "确定",
								pol: capPolOf(tk),
								onPol: (v) => { setCapPol(tk, v); touch(); },
								onCommit: (cn, en) => commitCap(i, cn, en), onCancel: () => setCapIdx(-1), onDrop: () => dropTag(i),
							})
							: h("span", {
								key: tk + "-" + i,
								title: (capNoteOf(tk) ? capNoteOf(tk) + "\u000A" : "") + tk + "\u000A点正文：改中文备注 / 英文标签 · 点词性小标：切 自/正/负 · × 删掉这颗",
								style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 6px 2px 4px", borderRadius: "999px",
									border: "1px solid " + (capPolOf(tk) === "neg" ? "var(--c-bad)" : "var(--c-line)"),
									background: "var(--c-card)", fontSize: "11.5px", color: "var(--c-fg2)", maxWidth: "100%", cursor: "pointer" },
							},
								polTag(tk),
								h("span", {
									onClick: () => setCapIdx(i),
									style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
								}, capNoteOf(tk) || tk),
								h("span", {
									title: "删掉这颗",
									onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); dropTag(i); },
									style: { cursor: "pointer", color: "var(--c-bad)", fontWeight: 700, padding: "0 1px" },
								}, "×")))),
						h(CapPairInput, {
							grow: true, enHint: tags.length ? "继续加英文…" : "英文标签，回车添加", btn: "加",
							btnTitle: "把这对（中文备注 + 英文标签）按选中的词性加成一颗胶囊",
							onCommit: (cn, en, pol) => pushTag(cn, en, pol),
							onCancel: props.onClose,
							onEmptyBackspace: () => dropTag(tags.length - 1),
							onBlur: (cn, en, pol) => pushTag(cn, en, pol),
						})),
					h("div", { style: { display: "flex", gap: "8px", alignItems: "center", paddingTop: "2px" } },
						h("button", { style: S.btn2, onClick: props.onSave }, d.isNew ? "创建卡片" : "保存"),
						h("button", { style: S.btn2, title: "把这张卡片导出成 .json（含中文备注与词性），别人导入即可用", onClick: props.onExportThis }, "导出这张"),
						d.isNew ? null : h("button", { style: S.btn2, onClick: props.onDelete }, "删除"),
						h("button", { style: S.btn2, onClick: props.onClose }, "取消"),
						h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg5)" } }, "Ctrl+回车保存 · Esc 取消")),
					!d.isNew && (d.en !== d.e2 || d.cn !== d.c)
						? h("div", { style: { fontSize: "11.5px", color: "var(--c-fg4)", borderTop: "1px solid var(--c-line)", paddingTop: "6px" } },
							"原：", d.cn, " → ", d.e2)
						: null));
		}
		// ==================== 界面与注册（来自 lib/app.js）====================
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
		/** 只给侧车加：jpost/jget 也被 ComfyUI 复用，无差别加会改动 ComfyUI 的请求语义 */
		function sidecarHeaders(url) {
			return String(url || "").indexOf(EXPANDER) === 0 ? Object.assign({}, CONSOLE_HEADERS) : {};
		}

		/** 模块级函数（写盘/存档/后台任务）也要能提示，Console 渲染时把 setMsg 挂进来 */
		let MSG_SINK = null;
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
			unet: "anima-aesthetic-v1.1.safetensors",
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
		const OFFICIAL_NEG = (typeof SEED_PRESETS !== 'undefined' && SEED_PRESETS[0] && SEED_PRESETS[0].neg) || '';

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
		function setCapNote(tag, note) {
			const k = String(tag || "").trim().toLowerCase();
			if (!k) return;
			USER.capNote = USER.capNote || {};
			const v = String(note || "").trim();
			if (v) USER.capNote[k] = v; else delete USER.capNote[k];
			saveUser();
		}

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
		function dictBuildTree() {
			const lib = allLib();
			const root = { name: "", path: "", children: [], count: 0 };
			const idx = new Map([["", root]]);
			for (const p of dictAllPaths().sort((x, y) => String(x).localeCompare(String(y), "zh"))) {
				let cur = "";
				for (const seg of dictSplit(p)) {
					cur = cur ? cur + "/" + seg : seg;
					if (!idx.has(cur)) {
						idx.set(cur, { name: seg, path: cur, children: [], count: 0 });
						idx.get(dictParent(cur)).children.push(idx.get(cur));
					}
				}
			}
			for (const [p, node] of idx) node.count = (lib[p] || []).length;
			return root;
		}

		/** 拖拽中的分类（模块级：重渲染不丢） */
		const DRAG = { from: null };

		/** 返回 dict.js 里的原键（含已被移走的内置分类）；不是内置就返回空串 */
		function builtinKey(p) {
			if (Object.prototype.hasOwnProperty.call(LIB, p)) return p;
			for (const k of Object.keys(USER.moved || {})) if ((USER.moved || {})[k] === p) return k;
			return "";
		}
		/** 全库搜索：中文名或英文标签包含关键词即命中；空查询返回 null */
		function dictSearch(q, lib, limit) {
			const kw = String(q || "").trim().toLowerCase();
			if (!kw) return null;
			const out = [];
			const cap = limit || 200;
			for (const cat of Object.keys(lib || {})) {
				for (const p of lib[cat] || []) {
					const cn = String(p[0] || "").toLowerCase();
					const en = String(p[1] || "").toLowerCase();
					if (cn.indexOf(kw) >= 0 || en.indexOf(kw) >= 0) {
						out.push({ cat: cat, cn: p[0], en: p[1] });
						if (out.length >= cap) return out;
					}
				}
			}
			return out;
		}
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

		function dirDelete(kind, path, name, id) {
			return fetch(EXPANDER + "/dir/del", {
				method: "POST",
				headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
				body: JSON.stringify({ kind: String(kind || ""), path: String(path || ""), name: String(name || ""), id: String(id || "") }),
			}).then((r) => r.json());
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
		  { id: "st-mochi", name: "もちづきけい · 官方画风", note: "官方预设 EMBBED 段（去掉 EMBBED: / BREAK,）", tags: base },
		  { id: "st-clean", name: "干净线稿 · 平涂", note: "线稿清楚 + 平涂上色，适合立绘", tags: "2d anime illustration, prominent clean lineart, expressive variable line weight, (lineart:1.4), flat color, cel shading, crisp clean outline" },
		  { id: "st-paint", name: "厚涂 · 电影光影", note: "厚涂质感 + 打光，适合氛围图", tags: "painterly illustration, thick brush strokes, rich texture, soft rim light, cinematic lighting, subtle glow, detailed background" },
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
			} else {
				g["1"] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: o.ckpt } };
			}
			g["2"] = { class_type: "CLIPLoader", inputs: { clip_name: o.clip, type: animaUNet ? "qwen_image" : (o.clipType || "stable_diffusion") } };
			g["3"] = { class_type: "VAELoader", inputs: { vae_name: o.vae } };
			let modelSrc = ["1", 0], clipSrc = ["2", 0];
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
			g["8"] = { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["3", 0] } };

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
			const [clip, setClip] = React.useState(L.clip || MODEL_DEFAULTS.clip);
			const [clipType, setClipType] = React.useState(L.clipType || MODEL_DEFAULTS.clipType);
			const [vae, setVae] = React.useState(L.vae || MODEL_DEFAULTS.vae);
			const [selLoras, setSelLoras] = React.useState((L.loras && L.loras.length) ? L.loras : MODEL_DEFAULTS.loras);
			const [pos, setPos] = React.useState(L.pos || "");
			const [neg, setNeg] = React.useState(L.neg || "");
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
			  saveLast({ ckpt, clip, clipType, vae, loras: selLoras, w, h: hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey });
			}, [ckpt, clip, clipType, vae, selLoras, w, hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey]);

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
			const [promptOpen, setPromptOpen] = React.useState("");
			// "prompt"=白话+正负两块 / "custom"=新面板（功能待定）；选择记在 localStorage，刷新后保持
			const [zoneModeRaw, setZoneModeRaw] = React.useState(() => {
				try { return localStorage.getItem("comfyui.zoneMode") === "custom" ? "custom" : "prompt"; } catch (e) { return "prompt"; }
			});
			const [tagEdit, setTagEdit] = React.useState(null);
			const [capOpen, setCapOpen] = React.useState(false);   // 胶囊二级菜单（展开）
			const viewPrev = React.useRef(null);   // 切视角前的 pos/neg，用于「再点一次取消」
			const sizePrev = React.useRef(null);   // 套用常用尺寸前的宽高，用于「再点一次取消」
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
		          setMsg("ComfyUI 未运行：点右上「启动 ComfyUI」手动启动（或双击 D:\\paint\\start-comfy.ps1）");
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
				if (anima && list.indexOf("anima-aesthetic-v1.1.safetensors") >= 0) return "anima-aesthetic-v1.1.safetensors";
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
				const prefer = (isAnima && unets.indexOf("anima-aesthetic-v1.1.safetensors") >= 0)
					? "anima-aesthetic-v1.1.safetensors" : modelList[0];
				setCkpt(prefer);
			}, [clipType, unets.length, ckpts.length]);

			// 参数变了就记住（下次进来还在）
			React.useEffect(() => {
				const byType = Object.assign({}, (USER.last && USER.last.byType) || {});
				if (ckpt) byType[isAnima ? "qwen_image" : "ckpt"] = ckpt;
				USER.last = { ckpt, clip, clipType, vae, loras: selLoras, pos, neg, w, h: hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme, seed, lockSeed, viewKey, byType };
				saveUser();
			}, [ckpt, vae, clip, clipType, selLoras, pos, neg, w, hh, steps, cfg, sampler, scheduler, prefix, upscale, upscaleModel, upscaleFactor, theme]);

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
				const _stab = stabilizePrompt(pos, neg, lockCards);
				if (_stab.moved) setMsg("特征锁：把 " + _stab.moved + " 个词从正向移到了负向（稳定角色特征）");
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
				// 种子：勾了「固定」且填了非 0 才复用，否则每次随机；出完把实际值写回输入框
				const _lock = !!lockSeed && Number(seed) > 0;
				const _usedSeed = _lock ? Math.floor(Number(seed)) : Math.floor(Math.random() * 1e15);
				const graph = buildGraph({
					ckpt, unet: ckpt, clip, clipType: effectiveClipType(ckpt, clipType, unets), vae, loras: selLoras, pos: _pos, neg: _neg,
					w: Number(w), h: Number(hh), steps: Number(steps), cfg: Number(cfg),
					sampler, scheduler, seed: _usedSeed, prefix,
					lllite: _wire,
					upscale, upscaleModel, upscaleFactor,
				});
				await BG.run(graph, { w, h: hh, steps, cfg, seed: _usedSeed, prefix, lllite: _extra ? _cp.weights_key + "/" + _cp.preset : "" }, _extra);
				if (!_lock) setSeed(_usedSeed);
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


			function doTranslate() {
				const r = translateCn(cnIn, rebuildDict());
				setCnResult(r);
			}
			function applyTranslate() {
				if (!cnResult) return;
				insert(cnResult.out);
				setMsg(cnResult.misses.length ? ("已插入；这些词没认出来：" + cnResult.misses.join(" ")) : "已插入（全部匹配）");
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

			function removeFrag(cat, cn) {

				const key = String(cn || "").trim();

				if (!key) return;

				const _bk = builtinKey(cat) || cat;
				const isBuiltin = (LIB[_bk] || []).some((p) => String(p[0]).trim() === key);

				if (isBuiltin) {

					USER.hidden = USER.hidden || {};

					USER.hidden[_bk] = Array.from(new Set((USER.hidden[_bk] || []).concat([key])));

					saveUser();

					setMsg("已隐藏内置词条「" + key + "」（点「恢复全部隐藏」可找回）");

					return;

				}

				if (!window.confirm("从词库删除「" + key + "」？删了就找不回来了")) return;

				const list = (USER.frags && USER.frags[cat]) || [];

				const i = list.findIndex((p) => String(p[0]).trim() === key);

				if (i >= 0) list.splice(i, 1);

				if (USER.frags && USER.frags[cat] && !USER.frags[cat].length) delete USER.frags[cat];

				saveUser();

				setMsg("已从词库删除「" + key + "」");

			}

			function saveFrag(cn, en, cat) {
				if (!cn || !en) { setMsg("词条的中文和英文都要填"); return; }
				const c = cat || "自定义";
				USER.frags = USER.frags || {};
				USER.frags[c] = (USER.frags[c] || []).concat([[cn, en]]);
				saveUser();
				CN_PAIRS = buildCn2En();
				setMsg("已加入词库「" + c + "」：" + cn + " → " + en);
			}

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
							onClick: (e) => { e.stopPropagation(); prDel(key, tk); setMsg("已删掉「" + (capNoteOf(tk) || tk) + "」"); },
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
						}, h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "0" } }, zh || tk), x);
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

				const loraModal = loraOpen
				  ? h("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }, onClick: () => setLoraOpen(false) },
				      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px", width: "min(720px,92vw)", maxHeight: "86vh", overflow: "auto", background: "var(--c-card)", border: "1px solid rgba(127,127,127,.45)", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 16px 48px rgba(15,23,42,.35)" }, onClick: (e) => e.stopPropagation() },
				        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
				          h("span", { style: { fontWeight: 700, fontSize: "14px" } }, "LoRA 选择"),
				          h("span", { style: { fontSize: "12.5px", color: "var(--c-fg2)" } }, "已选 " + selLoras.length + " / " + loras.length)),
				        h("div", { style: Object.assign({}, S.scrollBox, { maxHeight: "46vh", overflowY: "auto" }) },
				          loras.map((Ln) => h("span", { key: Ln, onClick: () => toggleLora(Ln), style: Object.assign({}, S.chip, { fontSize: "13px", padding: "5px 11px", color: "var(--c-fg)", borderColor: "rgba(127,127,127,.5)" }, selLoras.some((x) => x.name === Ln) ? { background: "rgba(90,160,235,.45)", borderColor: "rgba(120,180,245,.95)", color: "var(--c-accent-fg)" } : {}) }, Ln.replace(/\.safetensors$/, "")))),
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
				  		h("button", { style: S.btn2, onClick: () => setTab("lib") }, "打开词库"),
				  		h("button", { style: S.btn2, onClick: () => setTab("preset") }, "打开预设"),
				  		(job && job.image)
				  			? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0 } },
				  					h("button", { style: CARD_BTN_ACCENT, onClick: () => openInExplorer(job.image), title: "在资源管理器里选中这张图" }, "打开文件所在位置"),
				  					h("button", { style: CARD_BTN, onClick: () => saveCurrent(false), title: "复制一份到你设定的复制位置" }, "存到保存位置"),
				  					h("button", { style: CARD_BTN, onClick: () => { BG.clear(); setMsg("已清空出图结果"); }, title: "把这张图和进度一起清掉" }, "清空"))
				  			: null),

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
				          h("button", { style: S.btn2, onClick: () => { setPos(""); setNeg(""); lockCards = []; } }, "清空"),
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
				    		    h("label", { style: S.field },
				    		    	h("span", { style: S.label }, isAnima ? "底模（Diffusion · Anima）" : "底模（Checkpoint）"),
				    		    	h("select", { style: Object.assign({}, S.sel, { width: "100%" }, modelBad ? { borderColor: "var(--c-bad)" } : null), value: ckpt, onChange: (e) => setCkpt(e.target.value) }, opt(modelList, ckpt))),
				    		    modelBad ? h("div", { style: { fontSize: "11.5px", lineHeight: 1.45, color: "var(--c-bad)" } },
				    		    	isAnima
				    		    		? "「" + ckpt + "」在 checkpoints 里，不是 Anima 底模。编码器类型 qwen_image 要 diffusion_models 的模型，否则 ComfyUI 会退 400。"
				    		    		: "「" + ckpt + "」不在 checkpoints 里；编码器类型不是 qwen_image 时只能走 checkpoint 底模。") : null,
				    		    h("label", { style: S.field }, h("span", { style: S.label }, "文本编码器"), h("select", { style: Object.assign({}, S.sel, { width: "100%" }), value: clip, onChange: (e) => setClip(e.target.value) }, opt(clips, clip))),
				    		    h("label", { style: S.field }, h("span", { style: S.label }, "编码器类型"), h("select", { style: Object.assign({}, S.sel, { width: "100%" }), value: clipType, onChange: (e) => {
				    		    	const v = e.target.value;
				    		    	setClipType(v);
				    		    	const next = pickModelFor(v);
				    		    	if (next) setCkpt(next);
				    		    } }, opt(clipTypes, clipType))),
				    		    h("label", { style: S.field }, h("span", { style: S.label }, "VAE"), h("select", { style: Object.assign({}, S.sel, { width: "100%" }), value: vae, onChange: (e) => setVae(e.target.value) }, opt(vaes, vae))),
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
				    		    h("div", { ref: pRef, style: { display: "grid", gridTemplateColumns: pCols2 === 1 ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "start", flexShrink: 0, minHeight: 0 } }, num("宽", w, (v) => { setSizePick(""); setW(v); }, 8), num("高", hh, (v) => { setSizePick(""); setHh(v); }, 8), num("步数", steps, setSteps), num("CFG", cfg, setCfg, 0.1)),
				    		    // 常用尺寸一键套用（不影响档位；点一下直接改宽高）
				    		    h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", marginTop: "2px" } },
				    		      h("span", { style: Object.assign({}, S.label, { minWidth: "auto", marginRight: "2px" }) }, "常用尺寸"),
				    		      RES_PRESETS.map((r) => {
				    		        const on = (sizePick === r[0]);
				    		        return h("button", {
				    		          key: r[0],
				    		          style: Object.assign({}, S.btn2, { padding: "1px 7px", fontSize: "11.5px" }, on ? { borderColor: "var(--c-accent)", background: "var(--c-accent-bg)", color: "var(--c-accent-fg)" } : null),
				    		          title: r[0] + " · " + r[1] + "×" + r[2] + (on ? "（当前，再点一次取消）" : "点一下套用"),
				    		          onClick: () => {
				    		            if (on) {
				    		              const p0 = sizePrev.current;
				    		              sizePrev.current = null;
				    		              setSizePick("");
				    		              if (p0) { setW(p0.w); setHh(p0.h); setMsg("已取消「" + r[0] + "」，宽高还原 " + p0.w + "×" + p0.h); }
				    		              else setMsg("已取消「" + r[0] + "」（宽高不变，只是不再高亮）");
				    		              return;
				    		            }
				    		            sizePrev.current = { w: w, hh: hh };
				    		            setSizePick(r[0]);
				    		            setW(r[1]); setHh(r[2]);
				    		          },
				    		        }, r[0]);
				    		      })),
				    		    h("div", { style: { display: "grid", gridTemplateColumns: pCols2 === 1 ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "8px", alignItems: "start", flexShrink: 0, minHeight: 0 } },
				    		      h("label", { style: S.field }, h("span", { style: S.label }, "采样器"), h("select", { style: Object.assign({}, S.sel, { width: "100%", minWidth: 0 }), value: sampler, onChange: (e) => setSampler(e.target.value) }, opt(samplers, sampler))),
				    		      h("label", { style: S.field }, h("span", { style: S.label }, "调度器"), h("select", { style: Object.assign({}, S.sel, { width: "100%", minWidth: 0 }), value: scheduler, onChange: (e) => setScheduler(e.target.value) }, opt(schedulers, scheduler)))),
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
				    		        ? h("span", { style: S.dim }, "成品 " + Math.round(Number(w) * (Number(upscaleFactor) || 4) / 4 * 4) + "×" + Math.round(Number(hh) * (Number(upscaleFactor) || 4) / 4 * 4))
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
				    		        }, v.label))),
				    		      h("span", { style: { width: "1px", height: "18px", background: "var(--c-line)", flexShrink: 0 } }),
				    		      h("span", { style: Object.assign({}, S.label, { minWidth: "auto" }) }, "种子"),
				    		      h("input", {
				    		        type: "number", value: seed, min: 0, step: 1,
				    		        style: Object.assign({}, S.inp, { width: "150px", fontSize: "12px", padding: "3px 6px" }),
				    		        title: "填 0 或取消「固定」= 每次随机",
				    		        onChange: (e) => setSeed(e.target.value),
				    		      }),
				    		      h("button", {
				    		        style: Object.assign({}, S.btn2, { padding: "3px 10px" }),
				    		        title: "换一个随机种子并锁定",
				    		        onClick: () => { setSeed(Math.floor(Math.random() * 1e15)); setLockSeed(true); },
				    		      }, "随机"),
				    		      h("label", {
				    		        style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12.5px", cursor: "pointer", userSelect: "none" },
				    		        title: "勾上就复用这个种子（复现同一张图）",
				    		      },
				    		        h("input", { type: "checkbox", checked: !!lockSeed, onChange: (e) => setLockSeed(e.target.checked) }),
				    		        "固定"),
				    		      (lockSeed && Number(seed) > 0)
				    		        ? h("span", { style: S.dim }, "同参数下可复现")
				    		        : null),

				    		    (Number(steps) >= 40 || Number(w) * Number(hh) >= 1024 * 1400)
				    		      ? h("div", { style: { border: "1px solid rgba(224,180,106,.5)", background: "rgba(224,180,106,.12)", borderRadius: "8px", padding: "5px 9px", fontSize: "12px", lineHeight: 1.45 } }, "⚠️ " + w + "×" + hh + " / " + steps + " 步属重负载（896×1152/20 步约 45 秒）")
				    		      : null)),


				  // ③ 左下：正负提示词,
					  capExpand

		),
			  loraModal, promptModal, expandModal, tagEditPanel);
			}

			// ==================== 词库页 ====================
		/** ===== 词库（新版）：方形小卡片 + 提示词胶囊 =====
		 *  全分类实装：八大内置分类 + 自建分类都用卡片界面；「旧版」按钮仍保留，随时可切回树状。
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
			const [cardMode, setCardMode] = React.useState(true);
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
			if (!cardMode) return h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, minHeight: 0 } },
				h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
					h("button", { style: Object.assign({}, S.btn2, { fontWeight: 600 }), onClick: () => setCardMode(true), title: "回到新版卡片词库" }, "◂ 新版卡片"),
					h("span", { style: { fontSize: "11.5px", color: "var(--c-fg4)" } }, "当前是旧版树状词库；点左边按钮随时切回新版")),
				h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, minHeight: 0 } },
					h(libTabLegacy, { onBack: () => setCardMode(true) })));

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
					h("button", { style: S.btn2, onClick: () => setCardMode(false), title: "回老的树状词库界面" }, "旧版"),
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
				h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px", maxHeight: "46vh", overflowY: "auto", padding: "2px" } },
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

		function libTabLegacy() {
				const lib = allLib();
				const cats = Object.keys(lib);
				const cat = cats.indexOf(activeCat) >= 0 ? activeCat : cats[0];
				const items = lib[cat] || [];
				const dictHits = dictSearch(dictQ, lib);
				const rows = dictHits ? dictHits.map((x) => ({ cat: x.cat, p: [x.cn, x.en] })) : items.map((x) => ({ cat: cat, p: x }));
				const toPos = target === "pos";
				/** 目标开关（正向 / 负面）—— 词库和中文转换都按它决定插到哪 */
				/** 词库树：新建子分类 / 删除分类 / 节点渲染 */

				function newSubCat(base) {

					const input = window.prompt("新建子分类的名称（建在「" + (base || "根") + "」下）", "");

					const n = String(input || "").trim().replace(/\//g, "-");

					if (!n) return;

					const p = base ? base + "/" + n : n;

					USER.cats = USER.cats || [];

					if (USER.cats.indexOf(p) < 0 && !(USER.frags || {})[p]) USER.cats.push(p);

					saveUser();

					setActiveCat(p);

					setFoldedCats(Object.assign({}, foldedCats, { [p]: false }));

					setMsg("已新建分类「" + p + "」");

				}

				function delCat(p) {

					if (!p) { setMsg("先选中一个分类"); return; }

					if (builtinKey(p)) { setMsg("内置分类不能整类删除（可点词条右侧 × 逐条隐藏）"); return; }

					const subs = dictAllPaths().filter((x) => x === p || x.indexOf(p + "/") === 0);

					const n = subs.reduce((acc, x) => acc + (((USER.frags || {})[x] || []).length), 0);

					if (!window.confirm("删除分类「" + p + "」" + (subs.length > 1 ? "及其 " + (subs.length - 1) + " 个子分类" : "") + (n ? "，连同里面的 " + n + " 条自定义词条" : "") + "？删了就找不回来了")) return;

					for (const x of subs) { if (USER.frags) delete USER.frags[x]; if (USER.hidden) delete USER.hidden[x]; }

					USER.cats = (USER.cats || []).filter((x) => subs.indexOf(x) < 0);

					saveUser();

					setActiveCat(dictParent(p));

					setMsg("已删除分类「" + p + "」");

				}

				/** 拖拽：把 from 分类（含子类与词条）挪到 to 下；to 为空 = 挪回一级 */

				function moveCat(from, to, newName) {

					if (!from || from === to) return;

					const bkey = builtinKey(from);

					if (to && to.indexOf(from + "/") === 0) { setMsg("不能拖到它自己的子分类里"); return; }

					const parent = dictParent(from);

					if (parent === to && !newName) { setMsg("已经在「" + (to || "全部") + "」下了"); return; }

					const name = String(newName || from.slice(parent ? parent.length + 1 : 0)).trim().replace(/\//g, "-");

					const dest = to ? to + "/" + name : name;

					if (dictAllPaths().indexOf(dest) >= 0) { setMsg("「" + (to || "全部") + "」下已有同名分类，先改名再拖"); return; }

					const inside = (k) => k === from || k.indexOf(from + "/") === 0;

					const remap = (p) => dest + p.slice(from.length);

					const rekey = (obj) => { const out = {}; for (const k of Object.keys(obj || {})) out[inside(k) ? remap(k) : k] = obj[k]; return out; };

					USER.frags = rekey(USER.frags);

					USER.hidden = rekey(USER.hidden);

					USER.cats = (USER.cats || []).map((x) => (inside(x) ? remap(x) : x));
					if (bkey) { USER.moved = USER.moved || {}; USER.moved[bkey] = dest; }
					saveUser();

					setActiveCat(dest);

					setMsg("已把「" + from + "」挪到「" + (to || "全部") + "」下 → " + dest);

				}


				/** 非拖拽兜底：输入目标路径来移动当前分类 */

						/** 改名：自定义分类重写路径；内置分类记一条位置 */
				function renameCat(from) {
					if (!from) { setMsg("先选中一个分类"); return; }
					const cur = dictSplit(from).pop();
					const t = window.prompt("把「" + cur + "」改名叫什么？（内置分类也能改，等于记一条位置）", cur);
					if (t === null) return;
					const nm = String(t).trim().replace(/\//g, "-");
					if (!nm || nm === cur) return;
					moveCat(from, dictParent(from), nm);
				}
				/** 改词条：内置的拒绝；自定义的可改中文名与英文标签 */
				function renameEntry(cat, p) {
					const builtin = (LIB[cat] || []).some((x) => String(x[0]).trim() === String(p[0]).trim());
					if (builtin) { setMsg("内置词条不能改名（它写死在 dict.js）；可新建一条自定义词条代替"); return; }
					const cn = String(window.prompt("中文名", p[0]) || "").trim();
					if (!cn) return;
					const en = String(window.prompt("英文标签（Danbooru 风格，逗号分隔）", p[1]) || "").trim();
					if (!en) return;
					const list = (USER.frags && USER.frags[cat]) || [];
					const i = list.findIndex((x) => String(x[0]).trim() === String(p[0]).trim());
					if (i < 0) { setMsg("没找到这条词条"); return; }
					list[i] = [cn, en];
					saveUser();
					setMsg("已改词条「" + p[0] + "」→「" + cn + "」：" + en);
				}
				function moveToPrompt(from) {

					if (!from) { setMsg("先选中一个分类"); return; }

					const t = window.prompt("把「" + from + "」移动到哪个分类下？（留空 = 一级；可用 / 表示层级，也可直接写新名字）", dictParent(from));

					if (t === null) return;

					moveCat(from, String(t).trim().replace(/^\/+|\/+$/g, ""));

				}

				function renderNode(node, depth) {

					if (!node.name) return (node.children || []).map((c) => renderNode(c, 0));

					const kids = node.children || [];

					const isOpen = !(foldedCats || {})[node.path];

					const isSel = node.path === cat;

					const isBuiltin = !!builtinKey(node.path);

					return h(React.Fragment, { key: node.path },

						h("div", {

							onMouseDown: (e) => { e.preventDefault(); DRAG.from = node.path; setDragFrom(node.path); setDragOver(""); }, onMouseEnter: () => { if (DRAG.from) setDragOver(node.path); }, onMouseUp: () => { if (!DRAG.from) return; const f = DRAG.from; DRAG.from = null; setDragFrom(""); setDragOver(""); if (f !== node.path) moveCat(f, node.path); }, title: "拖动我 → 放到另一个分类上，即成为它的子集", style: { display: "flex", alignItems: "center", gap: "4px", padding: "2px 4px", paddingLeft: (6 + depth * 14) + "px", borderRadius: "5px", cursor: "pointer", background: isSel ? "rgba(90,160,235,.30)" : (dragOver === node.path ? "rgba(120,200,140,.25)" : "transparent"), border: "1px solid " + (isSel ? "rgba(90,160,235,.75)" : "transparent") },

						},

							h("span", { onClick: (e) => { e.stopPropagation(); if (kids.length) setFoldedCats(Object.assign({}, foldedCats, { [node.path]: isOpen })); }, style: { width: "12px", opacity: kids.length ? 0.85 : 0, fontSize: "10px" } }, isOpen ? "▼" : "▶"),

							h("span", { onClick: () => setActiveCat(node.path), style: { flex: 1, fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, node.name),

							h("span", { onClick: () => setActiveCat(node.path), style: { fontSize: "11px", opacity: 0.55 } }, "(" + node.count + ")"),

							h("span", { title: "在此分类下新建子分类", onClick: (e) => { e.stopPropagation(); newSubCat(node.path); }, style: { opacity: 0.6, padding: "0 3px" } }, "＋"),

							h("span", { title: "重命名这个分类", onClick: (e) => { e.stopPropagation(); renameCat(node.path); }, style: { opacity: 0.6, padding: "0 3px" } }, "✎"), isBuiltin ? null : h("span", { title: "删除此分类（含子类）", onClick: (e) => { e.stopPropagation(); delCat(node.path); }, style: { opacity: 0.55, padding: "0 3px" } }, "✕")),

						isOpen && kids.length ? kids.map((c) => renderNode(c, depth + 1)) : null);

				}
				const targetSwitch = h("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } },
					h("span", { style: S.label }, "插入到："),
					h("span", {
						onClick: () => setTarget("pos"),
						style: Object.assign({}, S.chip, toPos ? { background: "rgba(90,160,235,.35)", borderColor: "rgba(90,160,235,.8)" } : {}),
					}, "正向提示词"),
					h("span", {
						onClick: () => setTarget("neg"),
						style: Object.assign({}, S.chip, !toPos ? { background: "rgba(224,106,106,.32)", borderColor: "rgba(224,106,106,.8)" } : {}),
					}, "负面提示词"),
					h("span", { style: S.dim },
						toPos ? "（点词条 → 追加到正向）" : "（点词条 → 追加到负面）"));
				return h(React.Fragment, null,
					// 插入目标 —— 放在最上面，因为下面所有东西都受它影响
					h("div", {
						style: Object.assign({}, S.card, {
							borderColor: toPos ? "rgba(90,160,235,.5)" : "rgba(224,106,106,.5)",
							background: toPos ? "rgba(90,160,235,.08)" : "rgba(224,106,106,.08)",
						}),
					},
						targetSwitch,
						h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
							h("button", {
								style: S.btn2,
								onClick: () => { setNeg(OFFICIAL_NEG); setMsg("已把官方负面提示词填入负面框"); },
							}, "填入官方负面提示词"),
							h("button", { style: S.btn2, onClick: () => { setNeg(""); setMsg("已清空负面"); } }, "清空负面"), h("button", { style: S.btn2, onClick: () => { USER.hidden = {}; saveUser(); setMsg("已恢复全部隐藏词条"); } }, "恢复全部隐藏"),
							h("button", { style: S.btn2, onClick: () => setTab("gen") }, "去生成页看两个框"))),

					// 中文转标签
					h("div", { style: S.card },
						h("span", { style: S.label }, "中文 → 英文标签（输入中文，一键转成 Danbooru 标签）"),
						h("div", { style: { display: "flex", gap: "8px" } },
							h("input", {
								style: Object.assign({}, S.inp, { width: "auto", flex: 1 }),
								placeholder: "例：长发 红围巾 白衬衫 微笑 挥手 黄昏街道",
								value: cnIn, onChange: (e) => setCnIn(e.target.value),
								onKeyDown: (e) => { if (e.key === "Enter") doTranslate(); },
							}),
							h("button", { style: S.btn, onClick: doTranslate }, "转换"),
							cnResult ? h("button", { style: S.btn, onClick: applyTranslate },
								"插入到" + (toPos ? "正向" : "负面")) : null),
						cnResult ? h("div", { style: { display: "flex", flexDirection: "column", gap: "5px" } },
							h("div", { style: Object.assign({}, S.ta, { minHeight: "44px", whiteSpace: "pre-wrap", wordBreak: "break-all" }) }, cnResult.out),
							h("span", { style: S.dim }, "匹配 " + cnResult.hits.length + " 个词条"),
							cnResult.misses.length
								? h("span", { style: S.warn }, "未识别：" + cnResult.misses.join(" / ") + "（可到下面「自定义词条」补进去）")
								: h("span", { style: S.ok }, "全部识别 ✓")) : null),

					// 自定义词条
					h("div", { style: S.card },
						h("span", { style: S.label }, "自定义词条（加进去后「中文转标签」立刻认得）"),
						h("div", { style: S.row },
							h("input", { id: "nf_cn", style: Object.assign({}, S.inp, { width: "130px" }), placeholder: "中文" }),
							h("input", { id: "nf_en", style: Object.assign({}, S.inp, { width: "260px" }), placeholder: "english tags" }),
							h("input", { id: "nf_cat", style: Object.assign({}, S.inp, { width: "110px" }), placeholder: "分类(可空)" }),
							h("button", {
								style: S.btn2,
								onClick: () => {
									const g = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
									saveFrag(g("nf_cn").trim(), g("nf_en").trim(), g("nf_cat").trim());
									["nf_cn", "nf_en"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
								},
							}, "加入词库"))),

					// 分类词库
					h("div", { style: S.card },
										h("div", { style: { display: "flex", gap: "6px", marginBottom: "4px" } }, h("input", { style: Object.assign({}, S.inp, { width: "auto", flex: 1 }), placeholder: "搜索词条：中文或英文都行（搜全部分类）", value: dictQ, onChange: (e) => setDictQ(e.target.value) }), h("button", { style: S.btn2, onClick: () => setDictQ("") }, "清空")),
		h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" } }, h("span", { style: dragFrom ? S.ok : S.dim }, dragFrom ? ("正在拖动「" + dragFrom + "」→ 拖到目标分类上松手（拖到 🗂 全部 = 回一级）") : (msg || "按住分类行拖到另一个分类上，即成为它的子集；也可选中后点「移动到…」")), h("button", { style: S.btn2, onClick: () => moveToPrompt(cat) }, "移动到…")),

						h("div", { onMouseUp: () => { if (!DRAG.from) return; const f = DRAG.from; const t = dragOver === "__root__" ? "" : dragOver; DRAG.from = null; setDragFrom(""); setDragOver(""); if (t && t !== f) moveCat(f, t); }, style: { display: "flex", flexDirection: "column", gap: "1px", maxHeight: "260px", overflowY: "auto", marginBottom: "6px", userSelect: "none" } },
							h("div", { onMouseEnter: () => { if (DRAG.from) setDragOver("__root__"); }, onMouseUp: () => { if (!DRAG.from) return; const f = DRAG.from; DRAG.from = null; setDragOver(""); moveCat(f, ""); }, style: { display: "flex", alignItems: "center", gap: "4px", padding: "2px 4px", borderRadius: "5px", background: dragOver === "__root__" ? "rgba(120,200,140,.22)" : "transparent" } }, h("span", { style: { opacity: 0.8 } }, "🗂 全部"), h("span", { style: { fontSize: "11px", opacity: 0.5 } }, "(" + Object.keys(lib).reduce((n, k) => n + (lib[k] || []).length, 0) + ")"), h("span", { title: "新建一级分类（在最上层）", onClick: (e) => { e.stopPropagation(); newSubCat(""); }, style: { opacity: 0.7, padding: "0 6px", cursor: "pointer", fontWeight: 600, marginLeft: "auto" } }, "＋ 新建一级")),
							renderNode(dictBuildTree(), 0)),
						h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" } },
							h("button", { style: S.btn2, onClick: () => newSubCat(cat) }, "＋ 在「" + (cat || "根") + "」下建子分类"),
							h("button", { style: S.btn2, onClick: () => newSubCat("") }, "＋ 新建一级分类"), h("button", { style: S.btn2, onClick: () => delCat(cat) }, "删除此分类")),
						h("span", { style: S.label }, dictHits ? ("搜索结果 " + dictHits.length + " 条（跨全部分类）· 点英文插入 · 点分类路径跳过去") : ("点一下追加到「" + (toPos ? "正向" : "负面") + "」提示词 · 当前分类：" + cat)),
						h("div", { style: { display: "flex", flexDirection: "column", gap: "5px", maxHeight: "300px", overflowY: "auto" } },
							rows.map((row, i) => h("div", {
								key: i, onClick: () => insert(row.p[1]), title: row.p[1],
								style: { display: "flex", gap: "8px", alignItems: "baseline", padding: "3px 6px", borderRadius: "5px", cursor: "pointer", background: "rgba(127,127,127,.08)" },
							},
								h("span", { title: "点这里改中文名 / 英文标签", onClick: (e) => { e.stopPropagation(); renameEntry(row.cat, row.p); }, style: { minWidth: "120px", fontSize: "12.5px", textDecoration: "underline dotted", cursor: "text" } }, (dictHits ? row.cat + " / " : "") + row.p[0]),
								h("span", { style: { fontSize: "11.5px", opacity: 0.62, wordBreak: "break-all", flex: 1 } }, row.p[1]), h("span", { title: "从词库移除（内置词条只隐藏，可恢复）", onClick: (e) => { e.stopPropagation(); removeFrag(row.cat, row.p[0]); }, style: { padding: "0 6px", opacity: 0.5, fontSize: "13px", fontWeight: 600, flex: "0 0 auto" } }, "×"))))));
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
				  ["style", "画风", ["illustration", "anime", "art style", " style", "painterly", "realistic", "sketch", "watercolor", "cel", "brush", "stroke", "texture"]],
				  ["line", "线条", ["lineart", "line weight", "outline", "ink", "pencil", "line"]],
				  ["color", "上色", ["color", "coloring", "palette", "tone", "shading", "gradient", "flat"]],
				  ["light", "光影", ["light", "lighting", "shadow", "glow", "highlight", "rim", "cinematic"]],
				];
				const STYLE_ORDER = ["trigger", "style", "line", "color", "light", "extra"];
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
				/** 把一整串风格标签拆进各模块（每项 {t,n}） */
				function splitStyleTags(tags) {
				  const parts = { trigger: "", style: [], line: [], color: [], light: [], extra: [] };
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
		     * 2026-10-22 实测 絉林.json 少了 `schemaVersion: 2` 与整条 `loraNote`（只有备份里还有）。
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
				if (!window.confirm("确定删除角色卡「" + c.name + "」？")) return;
				USER.cards = (USER.cards || []).filter((x) => x.id !== c.id);
				saveUser();
				setMsg("已删除角色卡「" + c.name + "」");
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
															h("label", { style: CARD_BTN }, "选择图片…",
																h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: pickCoverFile })),
															(job && job.image) ? h("button", { style: CARD_BTN_ACCENT, onClick: () => applyCardCover(job.image, "已用最近一张出图当封面，并写入卡文件") }, "用最近一张出图") : null,
															h("button", { style: CARD_BTN, onClick: () => applyCardCover("") }, "清除封面")),
														h("input", { style: Object.assign({}, inp, { flex: "none" }), value: String(d.cover || "").indexOf("data:") === 0 ? "（本地图片，已压缩内嵌）" : (d.cover || ""), placeholder: "或粘贴图片地址 https://…", onChange: (e) => set("cover", e.target.value), onBlur: (e) => applyStyleCover(e.target.value) }))),
												h("div", { style: { display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" } },
													h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "12px 0 4px" } }, "资产与迁移（可选 · 让这张卡能跨机器、跨底模活下去）")),
												h("div", { style: row }, h("span", { style: lab }, "底模"),
													h("input", { style: inp, value: _bmText, placeholder: "逗号分隔，例如 anima-aesthetic-v1.1.safetensors", onChange: (e) => { set("baseModelsText", e.target.value); setCardChk(null); } })),
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
				  setMsg("已插入风格「" + c.name + "」" + (core ? "（核心画风）" : "") + " · 正向新增 " + np + " 条" + (ng ? " · 负面新增 " + nn + " 条" : "") + loraMsg + metaMsg);
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
				  setStyleEdit({ id: c.id, name: c.name || "", note: c.note || "", cover: styleCoverOf(c), neg: normPart(c.neg), parts: parts, loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), isNew: false, builtin: !!c.builtin });
				}

				function delStyleCard(c) {
				  if (c.builtin) { setMsg("内置风格卡不能删除，可以点「编辑」改它的标签与封面"); return; }
				  if (!window.confirm("确定删除风格卡「" + c.name + "」？")) return;
				  USER.styleCards = (USER.styleCards || []).filter((x) => x.id !== c.id);
				  saveUser();
				  setMsg("已删除风格卡「" + c.name + "」");
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
		    const rec = { id: "s" + String(Date.now()) + "_" + ok.length, name: nm, tags: tags, note: String(c.note || ""), cover: String(c.cover || ""), parts: (c.parts && typeof c.parts === "object") ? c.parts : splitStyleTags(tags), neg: normPart(c.neg), loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}) };
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
				  return h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
				    h("div", {
				      style: { position: "relative", borderRadius: "10px", overflow: "hidden", border: on ? "2px solid rgba(130,190,255,.95)" : "1px solid rgba(var(--c-ink-rgb),.14)", background: "var(--c-panel)", cursor: "pointer" },
				      title: (c.tags || "") + (c.note ? "\n备注：" + c.note : ""),
				      onClick: () => setStyleSel(on ? "" : c.id),
				    },
				      cardCoverBox(c),
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
				          h("label", { style: CARD_BTN }, "选择图片…",
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
				return h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
					h("div", {
						style: { position: "relative", borderRadius: "10px", overflow: "hidden", border: on ? "2px solid rgba(130,190,255,.95)" : "1px solid rgba(var(--c-ink-rgb),.14)", background: "rgba(var(--c-ink-rgb),.05)", cursor: "pointer" },
						title: (c.tags || "") + (c.note ? "\n备注：" + c.note : ""),
						onClick: () => setCardSel(on ? "" : c.id),
					},
						cardCoverBox(c),
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
						  } catch (e) { setOnline(false); setMsg("启动失败：" + errText(e) + "。也可双击 D:\\paint\\start-comfy.ps1"); return; }
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
					  [["gen", "生成"], ["style", "风格卡"], ["card", "角色卡"], ["lib", "词库"], ["preset", "预设"]].map(([k, label]) =>
					    h("div", {
					      key: k, onClick: () => setTab(k),
					      style: Object.assign({}, S.tab, tab === k ? S.tabOn : S.tabOff),
					    }, label)),
							  msg ? h("span", { title: msg, style: Object.assign({}, S.dim, { marginLeft: "auto", padding: "0 8px", fontSize: "12px", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1 }, /失败|连不上|离线|没认出来/.test(msg) ? S.bad : {}) }, msg) : null),

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
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
