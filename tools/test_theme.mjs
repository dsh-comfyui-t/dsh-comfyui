/**
 * 独立验证 resolveTheme：从 app.js 里把主题那一段抠出来，在 Node 里真跑。
 *
 * 这样做是因为面板本身离不开 React + DSH 上下文，
 * 但调色板逻辑是纯函数，可以单独验。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const APP = fileURLToPath(new URL('../plugin/lib/app.js', import.meta.url))
const src = readFileSync(APP, 'utf8')

// 抠出：THEME_DEFAULTS ... 到 resolveTheme 结束
const start = src.indexOf('const THEME_DEFAULTS')
const anchor = 'function resolveTheme('
const a = src.indexOf(anchor, start)
if (start < 0 || a < 0) { console.error('✗ 抠不出来'); process.exit(1) }
// 找 resolveTheme 的收尾：从 a 起第一个顶格 "}"
let depth = 0, end = -1, seen = false
for (let i = a; i < src.length; i++) {
  if (src[i] === '{') { depth++; seen = true }
  else if (src[i] === '}') { depth--; if (seen && depth === 0) { end = i + 1; break } }
}
const block = src.slice(start, end)

// THEME_DEFAULTS 在 isDarkColor 之前，所以要把 isDarkColor 也带上
const isDarkStart = src.indexOf('function isDarkColor')
let d2 = 0, isDarkEnd = -1, seen2 = false
for (let i = isDarkStart; i < src.length; i++) {
  if (src[i] === '{') { d2++; seen2 = true }
  else if (src[i] === '}') { d2--; if (seen2 && d2 === 0) { isDarkEnd = i + 1; break } }
}
const isDark = src.slice(isDarkStart, isDarkEnd)

const code = `${isDark}\n${block}\nreturn { THEME_DEFAULTS, THEME_LIGHT, THEME_DARK, resolveTheme, hexToRgbTriplet }`

let dark = false
const win = { matchMedia: (q) => ({ matches: dark, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) }
const fn = new Function('window', code)
const M = fn(win)

let pass = 0, fail = 0
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ✓ ' + label) }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  <- ' + extra : '')) }
}

const KEYS = Object.keys(M.THEME_LIGHT)
console.log('调色板定义了 ' + KEYS.length + ' 个变量')
console.log('  ' + KEYS.join(', '))
console.log()

const HEX = /^#[0-9a-fA-F]{3,8}$/
const RGBT = /^\d{1,3},\d{1,3},\d{1,3}$/

function checkPalette(name, obj) {
  let bad = 0
  for (const k of KEYS) {
    const v = obj[k]
    if (v === undefined) { console.log('    ✗ ' + name + ' 缺 ' + k); bad++; continue }
    if (k === '--c-ink-rgb') { if (!RGBT.test(v)) { console.log('    ✗ ' + name + '.' + k + ' = ' + v); bad++ } }
    else if (k === '--c-scheme') { if (!/^(light|dark)$/.test(String(v))) { console.log('    ✗ ' + name + '.' + k + ' = ' + v); bad++ } }
    else if (!HEX.test(v)) { console.log('    ✗ ' + name + '.' + k + ' = ' + v); bad++ }
  }
  return bad
}

console.log('=== 浅色 / 深色调色板本身 ===')
ok(checkPalette('LIGHT', M.THEME_LIGHT) === 0, 'THEME_LIGHT 全部是合法字面量')
ok(checkPalette('DARK', M.THEME_DARK) === 0, 'THEME_DARK 全部是合法字面量')
ok(M.THEME_LIGHT['--c-fg'] === '#111827', '浅色正文色 = #111827')
ok(M.THEME_DARK['--c-fg'] === '#e8e8ee', '深色正文色 = #e8e8ee')

console.log()
console.log('=== resolveTheme 四种模式 ===')
for (const [mode, sysDark, expectBg] of [
  ['auto', false, '#ffffff'],
  ['auto', true, '#24242a'],
  ['light', true, '#ffffff'],   // 系统深色但用户选浅色
  ['dark', false, '#24242a'],   // 系统浅色但用户选深色
]) {
  dark = sysDark
  const r = M.resolveTheme({ mode }, dark)
  const okk = r.background === expectBg && typeof r.color === 'string' && KEYS.every((k) => r[k])
  ok(okk, `mode=${mode} 系统${sysDark ? '深' : '浅'} -> 背景 ${r.background} (期望 ${expectBg})`,
     'got ' + r.background)
}

console.log()
console.log('=== custom 模式 ===')
for (const [bg, fg, wantScheme] of [
  ['#101010', '#eeeeee', 'dark'],
  ['#fafafa', '#222222', 'light'],
]) {
  const r = M.resolveTheme({ mode: 'custom', bg, fg })
  const okk = r.background === bg && r.color === fg && r.colorScheme === wantScheme
  ok(okk, `custom bg=${bg} fg=${fg} -> colorScheme=${r.colorScheme}（期望 ${wantScheme}）`)
  console.log('      --c-card=' + r['--c-card'] + '  --c-fg=' + r['--c-fg'] + '  --c-ink-rgb=' + r['--c-ink-rgb'])
}

console.log()
console.log('=== 退化输入 ===')
ok(!!M.resolveTheme(undefined).background, 'resolveTheme(undefined) 不抛错')
ok(!!M.resolveTheme({}).background, 'resolveTheme({}) 不抛错')
ok(M.resolveTheme({ mode: 'custom', bg: 'garbage', fg: 'x' })['--c-ink-rgb'] === '127,127,127',
   '自定义色非法时 ink-rgb 回退 127,127,127')

console.log()
console.log('='.repeat(52))
console.log('  通过 ' + pass + ' / ' + (pass + fail) + (fail ? '   ✗ 失败 ' + fail : '   ✓ 全部通过'))
console.log('='.repeat(52))
process.exit(fail ? 1 : 0)
