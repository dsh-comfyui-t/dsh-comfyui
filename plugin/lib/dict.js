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
export const LIB = {
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
export const EXTRA = [
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
export function buildCn2En() {
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
export function translateCn(text, pairs) {
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
