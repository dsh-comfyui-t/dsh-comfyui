/**
 * 视角功能单测：从 plugin/lib/presets.js 里把 VIEWS / applyView / detectView 抠出来真跑。
 *
 * 重点验：
 *   1. 前置相机词挂上了、重复应用不叠加
 *   2. 只动「最后一个 SUBJECT（姿势）」和 COMPOSITION，第一个 SUBJECT（角色外貌）逐字不动
 *   3. 负向压制句只加一次、切档时会被替换
 *   4. detectView 反推能对上（套用旧预设后按钮高亮才准）
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PRE = fileURLToPath(new URL('../plugin/lib/presets.js', import.meta.url))
const src = readFileSync(PRE, 'utf8')

function sliceBlock(startMark, endMark) {
  const a = src.indexOf(startMark)
  if (a < 0) throw new Error('presets.js 里找不到 ' + startMark)
  const b = endMark ? src.indexOf(endMark, a) : -1
  return src.slice(a, b < 0 ? src.length : b)
}

const viewsSrc = sliceBlock('export const VIEWS', 'export function applyView')
const applySrc = sliceBlock('export function applyView', 'export function detectView')
const detectSrc = sliceBlock('export function detectView')

const code =
  viewsSrc.replace(/export const/g, 'const') +
  applySrc.replace(/export function/g, 'function') +
  detectSrc.replace(/export function/g, 'function') +
  '; return { VIEWS, applyView, detectView };'

const M = new Function(code)()

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ✓ ' + label) }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  <- ' + extra : '')) }
}

console.log('=== 素材 ===')
ok(M.VIEWS.length === 3, 'VIEWS 三档，实际 ' + M.VIEWS.length)
ok(M.VIEWS.map((v) => v.key).join(',') === 'high,eye,low', '顺序 high,eye,low')
ok(M.VIEWS.every((v) => v.label && v.pose && v.comp), '每档都有 label/pose/comp')

const POS = [
  'EMBBED:, (@mochizuki_kei), 2d anime illustration, (lineart:1.4), BREAK,',
  'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, looking directly at viewer,',
  'ENVIRONMENT:, simple background, ((dark grey background)),',
  'SUBJECT:, sitting, one hand behind, head tilted,',
  'CLOTHINGS:, bandage bikini, bare feet,',
  'COMPOSITION:, three-quarter view, dynamic poster composition,',
].join('\n\n')
const NEG = 'worst quality, low quality, bad anatomy,'
const FIRST_SUBJECT = 'SUBJECT:, 1girl, solo, short white bob hair, bright red eyes, looking directly at viewer,'

console.log()
console.log('=== 切到平视 ===')
{
  const r = M.applyView(POS, NEG, 'eye')
  ok(r.changed, 'changed=true')
  ok(r.pos.startsWith('(from below:1.2), '), '前置相机词', r.pos.slice(0, 40))
  ok(r.pos.includes(FIRST_SUBJECT), '第一个 SUBJECT（角色外貌）逐字保留')
  ok(r.pos.includes(M.VIEWS[1].pose), '姿势段已换成平视的')
  ok(r.pos.includes(M.VIEWS[1].comp), 'COMPOSITION 已换成平视的')
  ok(!r.pos.includes('dynamic poster composition'), '旧的 dynamic poster composition 已去掉')
  ok(r.pos.includes('CLOTHINGS:, bandage bikini'), 'CLOTHINGS 段没被动')
  ok(r.pos.includes('ENVIRONMENT:, simple background'), 'ENVIRONMENT 段没被动')
  ok(r.neg.includes("bird's-eye view"), '负向加了俯视压制句')
  console.log('     改了 ' + r.moved + ' 段')
}

console.log()
console.log('=== 重复应用同一档（幂等）===')
{
  const once = M.applyView(POS, NEG, 'eye')
  const twice = M.applyView(once.pos, once.neg, 'eye')
  ok(!twice.pos.startsWith('(from below:1.2), (from below:1.2)'), '前置相机词没有叠加')
  ok(twice.pos === once.pos, '再次应用结果完全一致')
  const cnt = (twice.neg.match(/bird's-eye view/g) || []).length
  ok(cnt === 1, '负向压制句只有一份，实际 ' + cnt)
}

console.log()
console.log('=== 平视 -> 仰视 -> 平视 ===')
{
  const eye = M.applyView(POS, NEG, 'eye')
  const low = M.applyView(eye.pos, eye.neg, 'low')
  ok(low.pos.startsWith('(from below:1.5), (low angle shot:1.4), '), '仰视前置词替换掉平视的', low.pos.slice(0, 50))
  ok(!low.pos.includes('(from below:1.2)'), '平视的 from below:1.2 已被剥掉')
  ok(low.pos.includes(M.VIEWS[2].comp), '仰视构图已应用')
  const back = M.applyView(low.pos, low.neg, 'eye')
  ok(back.pos.startsWith('(from below:1.2), '), '切回平视前置词正确')
  ok(!back.pos.includes('(full body:1.4)'), '仰视的构图残留已清掉')
}

console.log()
console.log('=== detectView 反推 ===')
for (const k of ['high', 'eye', 'low']) {
  const r = M.applyView(POS, NEG, k)
  const d = M.detectView(r.pos)
  ok(d === k, '应用 ' + k + ' 后反推得到 ' + d)
}
ok(M.detectView(POS) === 'high', '原始俯视提示词反推为 high')
ok(M.detectView('') === 'high', '空串不崩，回退 high')

console.log()
console.log('=== 退化输入 ===')
ok(M.applyView('', '', 'eye').changed === true, '空提示词也能套')
ok(M.applyView(POS, NEG, 'nonexistent').changed === false, '未知 key -> changed=false')
ok(M.applyView(POS, NEG, 'eye').moved > 0, 'moved 计数不为 0')

console.log()
console.log('='.repeat(52))
console.log('  通过 ' + pass + ' / ' + (pass + fail) + (fail ? '   ✗ 失败 ' + fail : '   ✓ 全部通过'))
console.log('='.repeat(52))
process.exit(fail ? 1 : 0)
