/**
 * Host 侧（Node）—— DSH 启动时拉起「提示词扩写 + ComfyUI 生命周期」sidecar。
 *
 * 自包含设计：整个插件包拷到别的机器也能用。
 *   - 路径全部来自同目录的 config.json（install.ps1 会生成）
 *   - sidecar（expander.py）就在插件包里，不依赖外部目录
 *   - ComfyUI 路径自动探测常见位置；找不到会在日志里写明怎么改
 *
 * 职责划分：
 *   - sidecar ~27 MB，**常驻**，本插件在 DSH 启动时拉起
 *   - ComfyUI ~880 MB 内存 + 显存，**按需**（页面调 /comfy/start 才拉）
 *
 * ⚠️ 日志一律落文件，不要只 console.log ——
 *    DSH 里 console 输出看不到，2026-10-12 排查"重启后服务没起来"时因此无法取证。
 */
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 本包目录（插件根）：lib/ 的上一层 */
let PKG_DIR = ''
try {
  PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
} catch (e) {
  PKG_DIR = process.cwd()
}

// ---- 更新元数据（只在模块装载时读一次：进程内保持"已加载版本"，与磁盘版本比对可判"要不要重启"）----
let PKG = {}
try { PKG = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) } catch (e) { PKG = {} }
const PLUGIN_VERSION = PKG.version || '0.0.0'
const CONFIG_VERSION = Number((PKG.dsh && PKG.dsh.configVersion) || 1)
const MIN_HOST = (PKG.dsh && PKG.dsh.minHost) || ''

/** config.json 的默认骨架：迁移时只补缺失键，用户键与未知键原样保留。 */
const CONFIG_DEFAULTS = {
  comfyRoot: '', pythonExe: '', workDir: '', credsFile: '',
  comfyPort: 8188, sidecarPort: 8199,
  // ⚠️ --disable-pinned-memory 缺失会让出图从 42 秒掉到 15 分钟以上，见 docs/生成经验.md #1
  extraComfyArgs: ['--disable-pinned-memory', '--disable-async-offload', '--disable-dynamic-vram', '--cache-none'],
  outputDir: '', saveDir: '', cardsDir: '', allowLan: false,
}

/**
 * 把 config.json 升到当前 configVersion。
 * 规则：① 不删任何用户键（含本版不认识的键）② 只补缺失键 ③ 写入 configVersion ④ 幂等
 */
function migrateConfigFile() {
  const cfgPath = join(PKG_DIR, 'config.json')
  if (!existsSync(cfgPath)) return { migrated: false, from: null }
  let c = {}
  try { c = JSON.parse(readFileSync(cfgPath, 'utf8')) } catch (e) {
    return { migrated: false, from: null, error: String((e && e.message) || e) }
  }
  const from = Number(c.configVersion || 0)
  if (from >= CONFIG_VERSION) return { migrated: false, from }
  const out = Object.assign({}, c)
  for (const k of Object.keys(CONFIG_DEFAULTS)) if (out[k] === undefined) out[k] = CONFIG_DEFAULTS[k]
  out.configVersion = CONFIG_VERSION
  if (!out._note) out._note = 'configVersion 由插件按 package.json 的 dsh.configVersion 自动维护；升级插件会就地迁移，不需要重装。'
  try {
    writeFileSync(cfgPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
  } catch (e) {
    return { migrated: false, from, error: String((e && e.message) || e) }
  }
  return { migrated: true, from, to: CONFIG_VERSION }
}

/** 首次装载时按 config.example.json 生成 config.json（只写探测到的值，其余留空给用户填）。 */
function bootstrapConfig(found) {
  const cfgPath = join(PKG_DIR, 'config.json')
  const exPath = join(PKG_DIR, 'config.example.json')
  let base = {}
  try { if (existsSync(exPath)) base = JSON.parse(readFileSync(exPath, 'utf8')) } catch (e) { base = {} }
  const out = Object.assign({}, CONFIG_DEFAULTS, base, found, { configVersion: CONFIG_VERSION })
  try {
    writeFileSync(cfgPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
    console.log('[comfyui-console] 已生成 config.json（按探测结果填充，cardsDir/outputDir 请自行确认）')
    return true
  } catch (e) {
    console.log('[comfyui-console] 生成 config.json 失败: ' + (e && e.message))
    return false
  }
}

/** 读 config.json；缺项用默认值并自动探测 ComfyUI。 */
function loadConfig() {
  const cfgPath = join(PKG_DIR, 'config.json')
  const migration = migrateConfigFile()
  let c = {}
  if (existsSync(cfgPath)) {
    try { c = JSON.parse(readFileSync(cfgPath, 'utf8')) } catch (e) { c = {} }
  }
  const looksLikeComfy = (p) => {
    try {
      if (!p) return false
      return existsSync(join(p, 'python_embeded', 'python.exe')) || existsSync(join(p, 'main.py'))
    } catch (e) { return false }
  }
  let root = c.comfyRoot || ''
  if (!looksLikeComfy(root)) {
    const home = process.env.USERPROFILE || 'C:\\'
    const cands = [
      'E:\\ComfyUI\\ComfyUI_windows_portable',
      'C:\\ComfyUI\\ComfyUI_windows_portable',
      'D:\\ComfyUI\\ComfyUI_windows_portable',
      'F:\\ComfyUI\\ComfyUI_windows_portable',
      join(home, 'ComfyUI_windows_portable'),
      join(home, 'Desktop', 'ComfyUI_windows_portable'),
      join(home, 'Downloads', 'ComfyUI_windows_portable'),
    ]
    for (const p of cands) { if (looksLikeComfy(p)) { root = p; break } }
  }
  const py = (c.pythonExe && existsSync(c.pythonExe))
    ? c.pythonExe
    : (root ? join(root, 'python_embeded', 'python.exe') : '')
  const work = c.workDir || PKG_DIR
  try { mkdirSync(work, { recursive: true }) } catch (e) { /* ignore */ }
  let cfgFound = existsSync(cfgPath)
  if (!cfgFound) {
    cfgFound = bootstrapConfig({ comfyRoot: root || '', pythonExe: py || '', workDir: work })
  }
  return {
    comfyRoot: root,
    pythonExe: py,
    workDir: work,
    sidecarPort: Number(c.sidecarPort) || 8199,
    comfyPort: Number(c.comfyPort) || 8188,
    expander: join(PKG_DIR, 'expander.py'),
    cfgFound,
    configVersion: Number(c.configVersion || CONFIG_VERSION),
    migration,
  }
}

const CFG = loadConfig()
const LOGFILE = join(CFG.workDir, 'host-plugin.log')

log('plugin ' + PLUGIN_VERSION + ' 装载 · configVersion=' + CFG.configVersion + '/' + CONFIG_VERSION
  + (CFG.migration && CFG.migration.migrated ? '（已就地迁移 v' + CFG.migration.from + '→v' + CFG.migration.to + '）' : '')
  + (CFG.migration && CFG.migration.error ? '（迁移失败：' + CFG.migration.error + '）' : '')
  + (MIN_HOST ? ' · minHost=' + MIN_HOST : ''));

function log(msg) {
  const line = new Date().toISOString() + '  ' + msg + '\n'
  try { appendFileSync(LOGFILE, line) } catch (e) { /* ignore */ }
  try { console.log('[comfyui-console] ' + msg) } catch (e) { /* ignore */ }
}

/** 探端口 —— 用 net.connect，不碰 HTTP/TLS（本机 schannel 是坏的）。 */
function portOpen(port, timeoutMs = 900) {
  return new Promise((resolve) => {
    let done = false
    let sock = null
    const finish = (v) => {
      if (done) return
      done = true
      try { if (sock) sock.destroy() } catch { /* ignore */ }
      resolve(v)
    }
    try {
      sock = createConnection({ host: '127.0.0.1', port })
      sock.setTimeout(timeoutMs)
      sock.once('connect', () => finish(true))
      sock.once('timeout', () => finish(false))
      sock.once('error', () => finish(false))
    } catch { finish(false) }
  })
}

/** 子进程输出落文件的 fd（打不开就退化为 ignore，绝不抛）。 */
function openLogFd(name) {
  try { return openSync(join(CFG.workDir, name), 'a') } catch (e) { return 'ignore' }
}

/**
 * 拉起子进程。
 *
 * 2026-10-16：sidecar 改用 `pythonw.exe`（GUI 子系统，**不分配控制台**）启动。
 * 原先只靠 `windowsHide: true`，在本机会失效 —— 系统装了 Windows Terminal 1.24，
 * 由 WT 接管的新控制台窗口忽略隐藏标志，于是每次装载本插件都弹出黑框
 * （2026-10-16 18:19 实测：WindowsTerminal.exe / OpenConsole.exe 与 python.exe 同秒启动）。
 * pythonw 没有控制台可弹；它的 stdout/stderr 仍按句柄继承，所以照旧接进
 * `sidecar.out.log` / `sidecar.err.log`，expander.py 的 print 与 traceback 不丢。
 */
/**
 * 日志轮转：err.log 超过 2 MB 就滚成 .1。
 *
 * err.log 是追加写的，之前失败的 traceback 会一直躺在文件里，用户补完文件重启后
 * 看到旧 traceback 会以为还没修好（2026-10-22 报告 ②）。轮转 + 启动分隔线一起解决。
 */
function rotateLog(name, maxBytes) {
  try {
    const p = join(CFG.workDir, name)
    if (statSync(p).size > (maxBytes || 2 * 1024 * 1024)) renameSync(p, p + '.1')
  } catch (e) { /* 文件不存在或正被占用，忽略 */ }
}

function launch(exe, args, cwd, tag) {
  const lowered = /(^|[\\/])python\.exe$/i.test(exe)
  const wantExe = lowered ? exe.replace(/python\.exe$/i, 'pythonw.exe') : exe
  const useExe = lowered && existsSync(wantExe) ? wantExe : exe
  if (lowered && useExe !== wantExe) log('⚠ 找不到 pythonw.exe，退回 python.exe（可能弹控制台）: ' + wantExe)
  log('launch ' + tag + ' -> ' + useExe + '  cwd=' + cwd)
  rotateLog('sidecar.err.log')
  const outFd = openLogFd('sidecar.out.log')
  const errFd = openLogFd('sidecar.err.log')
  try {
    appendFileSync(join(CFG.workDir, 'sidecar.err.log'),
      '\n---------- sidecar start ' + new Date().toISOString() + ' (' + tag + ') ----------\n')
  } catch (e) { /* 忽略 */ }
  const child = spawn(useExe, args, {
    cwd,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', outFd, errFd]
  })
  for (const fd of [outFd, errFd]) {
    try { if (typeof fd === 'number') closeSync(fd) } catch (e) { /* ignore */ }
  }
  child.on('error', (e) => log('拉起失败 ' + tag + ': ' + (e && e.message)))
  child.on('exit', (code, sig) => log('子进程退出 ' + tag + ' pid=' + child.pid + ' code=' + code + ' sig=' + sig))
  child.unref()
  log('已 spawn ' + tag + ' pid=' + child.pid)
  return child
}

/**
 * 确保侧车在线，返回最终是否在线。
 * opts.quiet=true 时只在"本该在线却不在"的情况下打日志——保活循环每 60 秒调一次，
 * 不能让日志文件每天长 4000 行。
 */
async function ensureServices(opts) {
  const quiet = !!(opts && opts.quiet)
  try {
    const already = await portOpen(CFG.sidecarPort)
    if (!quiet) {
      log('ensureServices: 检查 :' + CFG.sidecarPort + ' …  config.json 存在=' + CFG.cfgFound
        + '  comfyRoot=' + (CFG.comfyRoot || '(未找到)') + '  pythonExe=' + (CFG.pythonExe || '(未找到)'))
    }
    if (already) {
      if (!quiet) log('sidecar 已在运行 (:' + CFG.sidecarPort + ')，跳过')
    } else if (!CFG.pythonExe || !existsSync(CFG.pythonExe)) {
      log('✗ 找不到 Python：' + (CFG.pythonExe || '(空)')
        + '  → 请在 ' + join(PKG_DIR, 'config.json') + ' 里填 comfyRoot 或 pythonExe')
    } else if (!existsSync(CFG.expander)) {
      log('✗ 找不到 expander.py：' + CFG.expander)
    } else {
      log('sidecar 未运行，准备拉起')
      try {
        launch(CFG.pythonExe, [CFG.expander, '--port', String(CFG.sidecarPort)], CFG.workDir, 'sidecar')
      } catch (e) {
        log('sidecar 拉起异常: ' + (e && e.message))
      }
    }
    // 只有真要拉起时才等它起来；已在线就直接返回，不再白等 3 秒
    if (!already) await new Promise((r) => setTimeout(r, 3000))
    const ok = await portOpen(CFG.sidecarPort)
    if (!quiet || !ok) {
      log('ensureServices 结束：:' + CFG.sidecarPort + ' ' + (ok ? '在线 ✓' : '仍不在线 ✗'))
    }
    return ok
  } catch (e) {
    log('ensureServices 异常: ' + (e && e.message))
    return false
  }
}

export const name = 'dsh-comfyui-console'
export const version = PLUGIN_VERSION
export const configVersion = CONFIG_VERSION

/**
 * Cordis host 插件入口。**同步返回**，后台再拉起服务。
 * 绝不允许抛异常（抛了会影响 DSH 启动）。
 */
// 保活节奏：在线时每分钟确认一次（代价只有一次 TCP connect）；不在线就拉起，
// 连续失败按 15s / 30s / … 退避到 5 分钟，避免 python 路径写错时把日志刷爆。
const KEEPALIVE_MS = 60000
const KEEPALIVE_RETRY_MIN_MS = 15000
const KEEPALIVE_RETRY_MAX_MS = 300000

export function apply(ctx) {
  try {
    log('apply() 被调用 —— host 插件已装载')
    let stopped = false
    let timer = null
    let fails = 0

    const schedule = (ms) => {
      if (stopped) return
      timer = setTimeout(tick, ms)
      if (timer && typeof timer.unref === 'function') timer.unref()
    }

    async function tick() {
      if (stopped) return
      let online = false
      try { online = await portOpen(CFG.sidecarPort) } catch { online = false }
      if (online) {
        if (fails) log('保活：侧车已恢复 (:' + CFG.sidecarPort + ')')
        fails = 0
        schedule(KEEPALIVE_MS)
        return
      }
      log('保活：侧车不在线 (:' + CFG.sidecarPort + ')，第 ' + (fails + 1) + ' 次尝试拉起')
      try { online = await ensureServices({ quiet: true }) } catch (e) { log('保活异常: ' + (e && e.message)) }
      if (online) {
        fails = 0
        schedule(KEEPALIVE_MS)
      } else {
        fails++
        schedule(Math.min(KEEPALIVE_RETRY_MAX_MS, KEEPALIVE_RETRY_MIN_MS * fails))
      }
    }

    schedule(4000)   // 启动后先等 4 秒，别跟 DSH 自己的启动抢资源

    // Cordis 卸载插件时停掉保活；拿不到 effect 也不影响功能（进程退出即止）
    if (ctx && typeof ctx.effect === 'function') {
      try {
        ctx.effect(() => () => {
          stopped = true
          if (timer) clearTimeout(timer)
        })
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    log('apply 异常: ' + (e && e.message))
  }
}

export { ensureServices, portOpen, loadConfig }
