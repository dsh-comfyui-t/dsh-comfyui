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
import { spawn, spawnSync, execFileSync, execFile } from 'node:child_process'
import { createConnection } from 'node:net'
import { get as httpGet } from 'node:http'

// Keep in lockstep with expander.py /health and the browser.
export const REQUIRED_SIDECAR_API = 15
// WSL / Windows cold loopback checks can take >1s before ECONNREFUSED.
export const STARTUP_PROBE_TIMEOUT_MS = 3000
export const WINDOWS_PROBE_PROCESS_TIMEOUT_MS = 12000
import { appendFileSync, existsSync, readFileSync, mkdirSync, statSync, closeSync } from 'node:fs'
import {rotateLog, diagnosticRecord, bootstrapLog} from './host_diagnostics.js'
import { dirname, join, win32, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 本包目录（插件根）：lib/ 的上一层 */
let PKG_DIR = ''
try {
  PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
} catch (e) {
  PKG_DIR = process.cwd()
}

/** WSL 的 Node 不认识 D:\\...；Windows Python 也不认识 /home/...。 */
function isWSL() {
  if (process.platform !== 'linux') return false
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true
  try { return /microsoft|wsl/i.test(readFileSync('/proc/version', 'utf8')) } catch { return false }
}
const WSL = isWSL()
function cleanPath(p) {
  p=String(p||'').trim()
  if(p.length>1&&['"',"'"].includes(p[0])&&p.at(-1)===p[0])p=p.slice(1,-1)
  if(/[\x00\r\n"]/.test(p))throw new Error('路径包含不支持的控制字符或引号')
  return p
}
function hostPath(p, options={}) {
  p=cleanPath(p);if(p.startsWith('//'))p=p.replace(/\//g,'\\');if(!p)return ''
  const wsl=options.wsl??WSL,distro=options.distro??process.env.WSL_DISTRO_NAME??''
  if(process.platform==='win32') {
    const mount=p.match(/^\/mnt\/([a-z])(?:\/(.*))?$/i)
    if(mount)return win32.normalize(mount[1].toUpperCase()+':\\'+(mount[2]||''))
    if(p.startsWith('/')){if(!distro)throw new Error('Linux 路径缺少 WSL 发行版');return win32.normalize('\\\\wsl.localhost\\'+distro+p.replace(/\//g,'\\'))}
    return win32.normalize(p)
  }
  const share=p.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(?:\\(.*))?$/i)
  if(share) {
    if(!wsl||!distro||share[1].toLowerCase()!==distro.toLowerCase())throw new Error('UNC 指向其他或未知 WSL 发行版')
    const tail=(share[2]||'').replace(/\\/g,'/')
    if(tail.split('/').includes('..'))throw new Error('UNC 路径跨出发行版根目录')
    return '/'+tail
  }
  if(p.startsWith('\\\\'))throw new Error('网络 UNC 需要先挂载到 Linux 目录')
  if(/^[a-z]:[\\/]/i.test(p)) {
    if(!wsl)throw new Error('Windows 路径不能直接用于原生 Linux')
    try {
      const result=cleanPath(options.convert?options.convert(p):execFileSync('wslpath',['-u',p],{encoding:'utf8',timeout:4000}).trim())
      if(!result.startsWith('/')||result.includes('\\'))throw new Error('wslpath 返回路径无效')
      return result
    } catch(error) {
      throw new Error('wslpath 转换失败：'+error.message)
    }
  }
  return p
}
function winPath(p, convert) {
  p=cleanPath(p);if(p.startsWith('//'))p=p.replace(/\//g,'\\');if(!p)return ''
  if(/^[a-z]:[\\/]/i.test(p)||p.startsWith('\\\\'))return win32.normalize(p)
  if(!WSL&&process.platform!=='win32'&&!convert)throw new Error('Linux 路径转 Windows 需要 WSL / wslpath')
  let result
  try {result=cleanPath(convert?convert(p):execFileSync('wslpath',['-w',p],{encoding:'utf8',timeout:4000}).trim())}
  catch(error){throw new Error('wslpath 转换失败：'+error.message)}
  if(!/^[a-z]:[\\/]/i.test(result)&&!result.startsWith('\\\\'))throw new Error('wslpath 未返回 Windows 绝对路径')
  return win32.normalize(result)
}

function validFile(p) { try { return !!p && statSync(hostPath(p)).isFile() } catch { return false } }
function pathAPI(p) { return /^[a-z]:[\\/]/i.test(p) ? win32 : {join, dirname, resolve, isAbsolute} }
function installLayout(root) {
  if (!root) return null
  const api=pathAPI(root), nested=api.join(root,'ComfyUI')
  if(validFile(api.join(nested,'main.py')))return {root,mainDir:nested,layout:'portable'}
  if(validFile(api.join(root,'main.py'))&&(validFile(api.join(root,'folder_paths.py'))||validFile(api.join(root,'comfy','cli_args.py'))))return {root,mainDir:root,layout:'source'}
  return null
}
function locatePython(root) {
  if(!root)return ''
  const api=pathAPI(root), info=installLayout(root), candidates=[]
  for(const folder of ['python_standalone','python_embeded','python_embedded'])candidates.push(api.join(root,folder,'python.exe'))
  const windows=process.platform==='win32'||(WSL&&(/^[a-z]:/i.test(root)||/^\/mnt\/[a-z](?:\/|$)/i.test(root)))
  for(const base of new Set([info?.mainDir||root,root]))for(const folder of ['.venv','venv','env']) {
    candidates.push(api.join(base,folder,windows?'Scripts':'bin',windows?'python.exe':'python'))
    if(!windows||WSL)candidates.push(api.join(base,folder,'bin','python3'))
    if(WSL)candidates.push(api.join(base,folder,windows?'bin':'Scripts',windows?'python':'python.exe'))
  }
  return candidates.find(validFile)||''
}
function validComfyRoot(root) { return !!installLayout(root) }
function scriptRoot(script) {
  if (!script || !validFile(script)) return ''
  const api=pathAPI(script), folder=api.dirname(script)
  const known=value=>value.replace(/%~dp0/ig,folder+(/^[a-z]:/i.test(script)?'\\':'/')).replace(/\$PSScriptRoot\b/ig,folder)
  const tokenize=line=>(line.match(/(?:"[^"\n]*"|'[^'\n]*'|[^\s"'])+/g)||[]).map(token=>(token.match(/"[^"\n]*"|'[^'\n]*'|[^\s"']+/g)||[]).map(part=>/^["']/.test(part)?part.slice(1,-1):part).join(''))
  try {
    if(statSync(hostPath(script)).size>1024*1024)throw new Error('large launcher')
    const bytes=readFileSync(hostPath(script))
    const text=bytes[0]===255&&bytes[1]===254?new TextDecoder('utf-16le').decode(bytes):new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    let cwd=folder, invalid=false;const mains=[]
    const joined=text.replace(/(?:\^|`|\\)\s*\r?\n/g,' ')
    for(let line of joined.split(/\r?\n/)) {
      line=line.trim().replace(/^@/,'')
      if(!line||/^(?:#|::|rem\s)/i.test(line))continue
      const cd=line.match(/^(?:cd|chdir|pushd|Set-Location)\s+(?:\/d\s+)?(.+)$/i)
      if(cd) {
        const parts=tokenize(cd[1]);if(parts.length!==1||/[\$%`;&|<>]/.test(known(parts[0])))invalid=true
        else cwd=api.resolve(cwd,known(parts[0]));continue
      }
      if(/^(?:popd|cd|chdir|pushd|Set-Location)\b/i.test(line))invalid=true
      line=line.replace(/^(?:call\s+|exec\s+|&\s+)/i,'').replace(/^start\s+""\s+(?:\/b\s+)?/i,'')
      const values=tokenize(line).map(known)
      if(!/(?:^|[\\/])python[0-9.]*(?:\.exe)?$/i.test(values[0]||''))continue
      let index=1
      while(index<values.length) {if(['-X','-W'].includes(values[index]))index+=2;else if(/^-[suEIBO]+$/.test(values[index])||values[index]==='--')index++;else break}
      const main=values[index]||''
      if(!/(?:^|[\\/])main\.py$/i.test(main))continue
      if(invalid||/[\$%`]/.test(main)||/[;&|<>]/.test(line.replace(/"[^"\n]*"|'[^'\n]*'/g,'')))throw new Error('dynamic launcher')
      mains.push(api.resolve(cwd,main))
    }
    if(mains.length===1) {
      const mainDir=api.dirname(mains[0]), parent=api.dirname(mainDir)
      const embedded=['python_standalone','python_embeded','python_embedded'].some(folder=>validFile(api.join(parent,folder,'python.exe')))
      for(const candidate of embedded||!installLayout(mainDir)?[parent,mainDir]:[mainDir,parent])if(installLayout(candidate)?.mainDir===mainDir)return candidate
    }
  } catch {}
  let root=folder
  for(let depth=0;depth<3;depth++) { if(validComfyRoot(root))return root; const parent=api.dirname(root);if(parent===root)break;root=parent }
  return ''
}

function* portableCandidates() {
  // Candidate order must match expander.py::_portable_root_candidates.
  if (process.platform === 'win32' || WSL) {
    for (const drive of ['C:', 'D:', 'E:', 'F:']) {
      for (const name of ['ComfyUI_Windows_portable', 'ComfyUI_windows_portable']) {
        yield win32.join(drive + '\\', 'ComfyUI', name)
      }
      yield win32.join(drive + '\\', 'ComfyUI_windows_portable')
    }
  }
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (home) {
    for (const base of [home, join(home, 'Desktop'), join(home, 'Downloads')]) {
      for (const name of ['ComfyUI_Windows_portable', 'ComfyUI_windows_portable']) yield join(base, name)
      yield join(base,'ComfyUI')
    }
  }
}
function resolveComfyRoot(c) {
  const warnings = []
  const saved = c.comfyRoot || ''
  if (validComfyRoot(saved)) return { root: saved, source: 'config.comfyRoot', warnings }
  if (saved) warnings.push('comfyRoot 无效（缺少 ComfyUI/main.py 或源码布局标志），已忽略：' + saved)
  const script = c.startScript || ''
  const inferred = scriptRoot(script)
  if (inferred) return { root: inferred, source: 'config.startScript', warnings }
  if (script) warnings.push('startScript 无法定位有效 ComfyUI 根目录：' + script)
  for (const candidate of portableCandidates()) {
    if (validComfyRoot(candidate)) return { root: candidate, source: 'auto.portable', warnings }
  }
  return { root: '', source: 'not-found', warnings }
}
function discoverRoot(c) { return resolveComfyRoot(c).root }

function systemPython() {
  try {
    const utility = process.platform === 'win32' ? 'where.exe' : 'which'
    const name = process.platform === 'win32' ? 'python.exe' : 'python3'
    const lines = execFileSync(utility, [name], { encoding: 'utf8', timeout: 2500 }).trim().split(/\r?\n/)
    return lines.find(validFile) || ''
  } catch { return '' }
}
function loadConfig() {
  let c = {},configErrors=[]
  const cfgPath = join(PKG_DIR, 'config.json')
  if (existsSync(cfgPath)) {
    try { c = JSON.parse(readFileSync(cfgPath,'utf8').replace(/^\uFEFF/,''));if(!c||Array.isArray(c)||typeof c!=='object')throw new Error('config.json 顶层必须是对象') } catch(error) { c={};configErrors.push('配置读取失败：'+error.message) }
  }
  const readPort=(key,fallback)=>{
    const value=c[key]??fallback
    if((typeof value!=='number'&&typeof value!=='string')||!/^\d+$/.test(String(value))||!Number.isInteger(Number(value))||Number(value)<1||Number(value)>65535){configErrors.push(key+' 必须为 1–65535 的整数');return fallback}
    return Number(value)
  }
  const sidecarPort=readPort('sidecarPort',8199),comfyPort=readPort('comfyPort',8188)
  if(sidecarPort===comfyPort)configErrors.push('ComfyUI 和 Sidecar 端口不能相同')
  const resolved = resolveComfyRoot(c)
  const root = resolved.root
  const invalidWindowsPython=WSL&&/\.exe$/i.test(c.pythonExe||'')&&!validFile(c.pythonExe)
  if(invalidWindowsPython)resolved.warnings.push('明确配置的 Windows Python 不可访问，请检查 WSL interop / 路径；不会改用 Linux Python')
  const pythonExe = invalidWindowsPython ? '' : validFile(c.pythonExe) ? c.pythonExe : (locatePython(root) || (validFile(c.comfyPythonExe) ? c.comfyPythonExe : '') || systemPython())
  let work=PKG_DIR
  try {work=hostPath(c.workDir)||PKG_DIR}catch(error){resolved.warnings.push('workDir 无法在 Host 中访问，日志使用插件目录：'+error.message)}
  try { mkdirSync(work, { recursive: true }) } catch { /* use fallback below */ }
  return {
    comfyRoot: root, comfyLayout: installLayout(root)?.layout || 'not-found', comfyRootSource: resolved.source, pathWarnings: resolved.warnings, pythonExe, workDir: existsSync(work) ? work : PKG_DIR,
    sidecarPort,comfyPort,configErrors,
    expander: join(PKG_DIR, 'expander.py'), cfgFound: existsSync(cfgPath),
    startScript: c.startScript || '', instanceId: c.instanceId || '', wsl: WSL,
  }
}

const CFG = loadConfig()
const LOGFILE = join(CFG.workDir, 'host-plugin.log')

function log(msg) {
  const line = new Date().toISOString() + '  ' + msg + '\n'
  try { rotateLog(LOGFILE);appendFileSync(LOGFILE, line) } catch (e) { /* ignore */ }
  try { console.log('[comfyui-console] ' + msg) } catch (e) { /* ignore */ }
}

/** 探端口 —— 用 net.connect，不碰 HTTP/TLS（本机 schannel 是坏的）。 */
function probeLocalPort(port, timeoutMs=STARTUP_PROBE_TIMEOUT_MS, connect=createConnection) {
  return new Promise(resolve=>{
    let socket,timer,settled=false
    const done=value=>{if(settled)return;settled=true;clearTimeout(timer);socket?.destroy();resolve(value)}
    timer=setTimeout(()=>done({ok:false,state:'unknown',reachable:false,detail:'本机端口探测超时'}),timeoutMs)
    try {
      socket=connect({host:'127.0.0.1',port})
      socket.once('connect',()=>done({ok:true,state:'mismatch',reachable:true,detail:'端口已占用'}))
      socket.once('error',error=>done(error.code==='ECONNREFUSED'?{ok:true,state:'closed',reachable:false}:{ok:false,state:'unknown',reachable:false,detail:'无法确认端口状态：'+error.message}))
    }catch(error){done({ok:false,state:'unknown',reachable:false,detail:error.message})}
  })
}
async function portOpen(port,timeoutMs=STARTUP_PROBE_TIMEOUT_MS){return (await probeLocalPort(port,timeoutMs)).reachable}

/** A total deadline also covers aborted or continuously trickling responses. */
function sidecarHealthy(port, timeoutMs=STARTUP_PROBE_TIMEOUT_MS, instanceId=CFG.instanceId) {
  return new Promise(resolve=>{
    let req,timer,settled=false
    const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);req?.destroy();resolve(ok)}
    timer=setTimeout(()=>done(false),timeoutMs)
    try {
      req=httpGet(`http://127.0.0.1:${port}/health`,{timeout:timeoutMs},res=>{
        if(res.statusCode!==200){res.resume();done(false);return}
        let body='',bytes=0
        res.on('data',chunk=>{bytes+=chunk.length;if(bytes>16384){done(false);return}body+=chunk})
        res.on('aborted',()=>done(false));res.on('error',()=>done(false))
        res.on('end',()=>{
          try {const j=JSON.parse(body);done(j.ok===true&&j.service==='dsh-comfyui-console'&&j.apiVersion===REQUIRED_SIDECAR_API&&j.sidecarPort===port&&(!instanceId||j.instanceId===instanceId))}
          catch{done(false)}
        })
      })
      req.on('timeout',()=>done(false));req.on('error',()=>done(false))
    }catch{done(false)}
  })
}

function launch(exe, args, cwd, tag) {
  log('launch ' + tag + ' -> ' + exe + '  cwd=' + cwd)
  const sidecar=tag==='sidecar',descriptor=sidecar?bootstrapLog(PKG_DIR):null
  const fields={tag,instanceId:CFG.instanceId,port:CFG.sidecarPort,windowsBridge:WSL&&/\.exe$/i.test(exe)}
  if(sidecar)diagnosticRecord(PKG_DIR,'launcher_start',fields)
  let child
  try {
    child=spawn(exe,args,{cwd,detached:true,stdio:descriptor===null?'ignore':['ignore',descriptor,descriptor],windowsHide:true})
  } catch(error) {
    if(sidecar)diagnosticRecord(PKG_DIR,'launcher_error',{...fields,errorCode:error.code||'',message:error.message})
    throw error
  } finally {if(descriptor!==null)try{closeSync(descriptor)}catch{}}
  child.on('error', e => {
    log('拉起失败 ' + tag + ': ' + (e && e.message))
    if(sidecar)diagnosticRecord(PKG_DIR,'launcher_error',{...fields,launcherPid:child.pid,errorCode:e.code||'',message:e.message})
  })
  child.on('exit', (code,sig) => {
    log('子进程退出 ' + tag + ' pid=' + child.pid + ' code=' + code + ' sig=' + sig)
    if(sidecar)diagnosticRecord(PKG_DIR,'launcher_exit',{...fields,launcherPid:child.pid,exitCode:code,signal:sig})
  })
  child.unref()
  if(sidecar)diagnosticRecord(PKG_DIR,'launcher_spawned',{...fields,launcherPid:child.pid})
  log('已 spawn ' + tag + ' pid=' + child.pid)
  return child
}

function bridgeProbe(port, instanceId=CFG.instanceId, cfg=CFG) {
  return new Promise(resolve=>{
    let exe, script, cwd
    try {
      exe=hostPath(cfg.pythonExe)
      script=winPath(join(dirname(cfg.expander),'runtime_bridge.py'))
      cwd=dirname(exe)
    } catch(error){resolve({ok:false,state:'unknown',detail:error.message});return}
    execFile(exe,['-X','utf8',script,'--probe',String(port),'--instance-id',instanceId||'','--api',String(REQUIRED_SIDECAR_API),'--timeout',String(STARTUP_PROBE_TIMEOUT_MS/1000)],
      {cwd,windowsHide:true,encoding:'utf8',timeout:WINDOWS_PROBE_PROCESS_TIMEOUT_MS,maxBuffer:32768},(error,stdout)=>{
        try {
          const value=JSON.parse(stdout.trim())
          if(error||!value||value.platform!=='nt'||value.port!==port||typeof value.ok!=='boolean'||!['closed','healthy','mismatch','unknown'].includes(value.state))throw new Error('探针响应无效')
          resolve(value)
        }catch(parseError){resolve({ok:false,state:'unknown',detail:'Windows Python 探针失败：'+(error?.message||parseError.message)})}
      })
  })
}
async function probeRuntimeService(cfg=CFG, bridge=bridgeProbe) {
  if(cfg.wsl&&/\.exe$/i.test(cfg.pythonExe||''))return bridge(cfg.sidecarPort,cfg.instanceId,cfg)
  if(await sidecarHealthy(cfg.sidecarPort,STARTUP_PROBE_TIMEOUT_MS,cfg.instanceId))return {ok:true,state:'healthy',healthy:true,reachable:true}
  return {...await probeLocalPort(cfg.sidecarPort),healthy:false}
}
async function ensureServices(options={}) {
  const cfg=options.cfg||CFG,probe=options.probe||(()=>probeRuntimeService(cfg)),write=options.log||log,start=options.launch||launch,pause=options.pause||(ms=>new Promise(resolve=>setTimeout(resolve,ms)))
  try {
    write('ensureServices: 检查端口 :'+cfg.sidecarPort+'，安装身份及 API')
    for(const warning of cfg.pathWarnings||[])write('路径诊断: '+warning)
    if(cfg.configErrors?.length){write('停止启动：'+cfg.configErrors.join('；'));return}
    let state=await probe()
    if(state.state==='healthy'){write('当前安装 Sidecar 已在线，复用现有服务');return}
    if(state.state!=='closed'||state.ok!==true){write('停止启动：'+(state.detail||'端口占用或无法确认当前运行环境')+'；不会重复拉起 Sidecar');return}
    if(!cfg.pythonExe||!validFile(cfg.pythonExe)){write('找不到可运行的 Sidecar Python，请修正 config.json.pythonExe');return}
    if(!existsSync(cfg.expander)){write('找不到 expander.py：'+cfg.expander);return}
    const exe=hostPath(cfg.pythonExe),windows=cfg.wsl&&/\.exe$/i.test(cfg.pythonExe)
    const script=windows?winPath(cfg.expander):cfg.expander
    const cwd=windows?dirname(exe):cfg.workDir
    start(exe,['-X','utf8',script,'--port',String(cfg.sidecarPort)],cwd,'sidecar')
    for(let attempt=0;attempt<12;attempt++) {
      state=await probe()
      if(state.state==='healthy')break
      if(state.state==='unknown'||state.state==='mismatch')break
      await pause(1000)
    }
    write('Sidecar '+(state.state==='healthy'?'已就绪':'尚未就绪：'+(state.detail||state.state)))
  }catch(error){write('ensureServices 异常：'+error.message)}
}

/**
 * 关闭 DSH 时同步关掉本插件在后台启动的 ComfyUI（外部启动的实例不动）。
 * 用子进程 + 短脚本发 HTTP，保证在 dispose/进程退出阶段也能完成。
 */
function stopOwnedComfySync() {
  try {
    const port = Number(CFG.sidecarPort) || 8199
    const script = "const http=require('node:http');const port=Number(process.argv[1]);" +
      "const req=http.request({host:'127.0.0.1',port,path:'/comfy/stop?owned_only=1',method:'POST',timeout:12000},res=>{res.resume();res.on('end',()=>process.exit(0))});" +
      "req.on('error',()=>process.exit(0));req.on('timeout',()=>{try{req.destroy()}catch{}process.exit(0)});req.end();" +
      "setTimeout(()=>process.exit(0),13000)"
    spawnSync(process.execPath, ['-e', script, String(port)], { timeout: 15000, windowsHide: true, stdio: 'ignore' })
  } catch (e) {
    log('关闭后台 ComfyUI 失败: ' + (e && e.message))
  }
}

export const name = '@local/dsh-comfyui-console'

/**
 * Cordis host 插件入口。**同步返回**，后台再拉起服务。
 * 绝不允许抛异常（抛了会影响 DSH 启动）。
 */
export function apply(ctx) {
  // A DSH hot reload can call apply more than once without disposing the previous
  // context. Keep exactly one watchdog per host JS process and release the old one.
  const monitorKey = Symbol.for('dsh-comfyui-console.host-watchdog')
  const previous = globalThis[monitorKey]
  if (previous && typeof previous.stop === 'function') previous.stop()
  let checking = false, disposed = false
  let failedStarts = 0, nextStartAttempt = 0
  const run = async (reason) => {
    if (checking || disposed) return
    checking = true
    try {
      log(reason + '，开始 ensureServices')
      await ensureServices()
    } catch (e) {
      log('后台任务异常: ' + (e && e.message))
    } finally { checking = false }
  }
  const monitor = async () => {
    if (checking || disposed) return
    checking = true
    try {
      const state = await probeLocalPort(CFG.sidecarPort)
      // Check only whether the configured port is closed: after an update the
      // installed instance id changes, so probing the old identity would report
      // a mismatch even though the new Sidecar is healthy. A closed port means
      // an installer stopped it or it crashed; relaunch it.
      if (state.state === 'closed') {
        // Do not retry failed launches every five seconds (or flood the log).
        // Never attempt a launch while an unfamiliar service owns the port.
        const now = Date.now()
        if (now >= nextStartAttempt) {
          nextStartAttempt = now + Math.min(300000, 30000 * 2 ** Math.min(failedStarts, 4))
          failedStarts += 1
          await ensureServices()
        }
      } else if (state.state === 'mismatch') {
        // Port is occupied: never adopt or terminate an unknown instance.
        failedStarts = 0
        nextStartAttempt = 0
      } else if (state.state === 'unknown') {
        // Transient networking errors are not proof that the port is safe.
        nextStartAttempt = Date.now() + 30000
      } else {
        failedStarts = 0
        nextStartAttempt = 0
      }
    } catch (e) {
      log('Sidecar 巡检异常: ' + (e && e.message))
    } finally { checking = false }
  }
  try {
    log('apply() 被调用 —— host 插件已装载')
    const t = setTimeout(() => run('首次加载'), 4000)
    if (t && typeof t.unref === 'function') t.unref()
    // Installers stop the old Sidecar before swapping files. Keep a lightweight
    // watchdog so the next healthy Host process can bring it back without a DSH
    // restart; only closed ports are relaunched.
    const timer = setInterval(monitor, 5000)
    if (timer && typeof timer.unref === 'function') timer.unref()
    const token = {}
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      disposed = true
      clearTimeout(t)
      clearInterval(timer)
      if (globalThis[monitorKey]?.token === token) delete globalThis[monitorKey]
      stopOwnedComfySync()
    }
    globalThis[monitorKey] = {token, stop}
    if (typeof ctx?.on === 'function') ctx.on('dispose', stop)
    process.once('exit', stop)
    process.once('SIGTERM', () => { stop(); process.exit(0) })
    process.once('SIGINT', () => { stop(); process.exit(0) })
  } catch (e) {
    log('apply 异常: ' + (e && e.message))
  }
}

export { ensureServices, portOpen, sidecarHealthy, loadConfig, hostPath, winPath, isWSL, locatePython, discoverRoot, resolveComfyRoot, installLayout, scriptRoot, bridgeProbe, probeRuntimeService, probeLocalPort }
