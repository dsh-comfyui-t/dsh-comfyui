"""Desktop Electron runtime discovery and private per-editor focus transport."""
import hashlib,json,os,platform,re,subprocess,sys,tempfile,time,uuid
from pathlib import Path
from urllib.parse import parse_qs,urlsplit

VERSION='45.0.0'
def desktop_target():
 return ({'win32':'win32','darwin':'darwin','linux':'linux'}.get(sys.platform,''),{'amd64':'x64','x86_64':'x64','arm64':'arm64','aarch64':'arm64'}.get(platform.machine().lower(),''))
def cache_root():
 if sys.platform=='win32':return Path(os.environ.get('LOCALAPPDATA',Path.home()/'AppData/Local'))/'DSHComfyUI/electron'
 if sys.platform=='darwin':return Path.home()/'Library/Caches/DSHComfyUI/electron'
 return Path(os.environ.get('XDG_CACHE_HOME',Path.home()/'.cache'))/'DSHComfyUI/electron'
def electron_executable(here=None):
 here=Path(here or Path(__file__).parent);system,arch=desktop_target()
 if not system or not arch:return ''
 cfg={}
 try:cfg=json.loads((here/'config.json').read_text(encoding='utf-8-sig'))
 except (OSError,ValueError):pass
 if not isinstance(cfg,dict):cfg={}
 name='electron.exe' if system=='win32' else 'Electron.app/Contents/MacOS/Electron' if system=='darwin' else 'electron'
 choices=[os.environ.get('DSH_ELECTRON_PATH',''),cfg.get('electronExecutable',''),here/'desktop/runtimes'/(system+'-'+arch)/name,cache_root()/VERSION/(system+'-'+arch)/name]
 for candidate in choices:
  if not isinstance(candidate,(str,os.PathLike)) or not candidate:continue
  path=Path(candidate).expanduser()
  if not path.is_absolute():path=here/path
  if path.is_file() and (os.name=='nt' or os.access(path,os.X_OK)):return str(path.resolve())
 return ''
def status(here=None):
 system,arch=desktop_target();executable=electron_executable(here)
 desktop=system!='linux' or bool(os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'))
 return {'platform':os.name,'system':system,'arch':arch,'supported':bool(system and arch),'desktop':desktop,'backend':'electron','electronVersion':VERSION,'electronExecutable':executable,'ready':bool(executable and desktop)}
def validate_url(kind,url):
 p=urlsplit(url)
 if kind not in ('workflow','scene3d') or p.scheme!='http' or p.hostname not in ('127.0.0.1','localhost','::1') or p.username or p.password or not p.port or p.query or p.path!='/'+kind+'/editor.html':raise ValueError('编辑器地址无效；仅允许本机 Sidecar 编辑页面')
 args=parse_qs(p.fragment);channel=p.fragment if kind=='workflow' else args.get('channel',[''])[0]
 if not re.fullmatch(r'[a-f0-9-]{8,80}',channel):raise ValueError('编辑器会话无效')
 return channel,args.get('instance',[''])[0]
def worker_path(here,kind,channel):
 key=hashlib.sha256((os.path.normcase(os.path.abspath(here))+'|'+kind+'|'+channel).encode()).hexdigest()[:32]
 return Path(tempfile.gettempdir())/('dsh-electron-'+key+'.json')
def atomic(path,value):
 temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
 try:
  with temp.open('x',encoding='utf8') as f:json.dump(value,f)
  try:temp.chmod(0o600)
  except OSError:pass
  os.replace(temp,path)
 finally:temp.unlink(missing_ok=True)
def worker_state(here,kind,channel):
 try:
  row=json.loads(worker_path(here,kind,channel).read_text(encoding='utf8'))
  if not isinstance(row,dict):return None
  pid,heartbeat=row.get('pid'),row.get('heartbeat')
  if type(pid) is not int or pid<=0 or type(heartbeat) not in (int,float):return None
  return row if row.get('kind')==kind and row.get('channel')==channel and -1<=time.time()-heartbeat<5 else None
 except (OSError,ValueError,TypeError):return None
def read_events(path,owner,after):
 """Ignore stale launches and malformed records without taking down the editor."""
 try:journal=json.loads(path.read_text(encoding='utf8'))
 except (OSError,ValueError,TypeError):return []
 if not isinstance(journal,list):return []
 events={}
 for item in journal[-32:]:
  if not isinstance(item,dict) or type(item.get('pid')) is not int or item['pid']!=owner:continue
  seq=item.get('seq')
  if type(seq) is int and seq>after and item.get('type') in ('ready','error'):
   events[seq]={'seq':seq,'type':item['type'],'message':str(item.get('message',''))[:600]}
 return [events[seq] for seq in sorted(events)]
def focus_windows_process(pid):
 """Restore only the actual Electron browser window owned by this editor PID.

 Titles change when documents are renamed; do not identify windows by title.
 Use asynchronous restore so a temporarily busy renderer cannot block Sidecar.
 Other desktop platforms retain Electron's normal activation path.
 """
 if os.name!='nt' or type(pid) is not int or pid<=0:return False
 try:
  import ctypes
  from ctypes import wintypes as t
  user=ctypes.WinDLL('user32',use_last_error=True)
  user.GetForegroundWindow.restype=t.HWND
  user.GetWindowThreadProcessId.argtypes=[t.HWND,ctypes.POINTER(t.DWORD)]
  user.GetClassNameW.argtypes=[t.HWND,t.LPWSTR,ctypes.c_int]
  user.IsWindowVisible.argtypes=[t.HWND];user.IsIconic.argtypes=[t.HWND]
  user.GetWindow.argtypes=[t.HWND,t.UINT];user.GetWindow.restype=t.HWND
  user.ShowWindowAsync.argtypes=[t.HWND,ctypes.c_int]
  user.BringWindowToTop.argtypes=[t.HWND]
  user.SetForegroundWindow.argtypes=[t.HWND]
  user.SetWindowPos.argtypes=[t.HWND,t.HWND,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,t.UINT]
  callback=ctypes.WINFUNCTYPE(t.BOOL,t.HWND,t.LPARAM);found=[]
  @callback
  def visit(hwnd,_):
   owner=t.DWORD();user.GetWindowThreadProcessId(hwnd,ctypes.byref(owner))
   if owner.value==pid and user.IsWindowVisible(hwnd) and not user.GetWindow(hwnd,4):
    name=ctypes.create_unicode_buffer(128);user.GetClassNameW(hwnd,name,128)
    if name.value=='Chrome_WidgetWin_1':found.append(hwnd)
   return True
  user.EnumWindows.argtypes=[callback,t.LPARAM];user.EnumWindows(visit,0)
  if len(found)!=1:return False
  hwnd=found[0]
  if user.IsIconic(hwnd):user.ShowWindowAsync(hwnd,9)
  user.BringWindowToTop(hwnd);user.SetForegroundWindow(hwnd)
  if user.GetForegroundWindow()!=hwnd:
   # A brief z-order lift makes background-launched windows visible. Remove
   # topmost immediately: editors must never remain above the user's apps.
   user.SetWindowPos(hwnd,t.HWND(-1),0,0,0,0,0x0013)
   user.SetWindowPos(hwnd,t.HWND(-2),0,0,0,0,0x0013)
   user.SetForegroundWindow(hwnd)
  return user.GetForegroundWindow()==hwnd and not user.IsIconic(hwnd)
 except (OSError,ValueError,AttributeError):return False

def focus_worker(here,kind,channel):
 state=worker_state(here,kind,channel)
 if not state:return False
 atomic(worker_path(here,kind,channel).with_suffix('.focus.json'),{'pid':state['pid'],'nonce':uuid.uuid4().hex,'op':'focus'})
 focus_windows_process(state.get('electronPid'));return True
def run_editor(kind,url):
 here=Path(__file__).parent;channel,instance=validate_url(kind,url);exe=electron_executable(here)
 if not exe:raise RuntimeError('未安装 Electron 独立窗口运行时，请运行 tools/install_electron.py')
 if not status(here)['desktop']:raise RuntimeError('当前 Sidecar 没有桌面会话，请在用户桌面系统启动 Electron 窗口宿主')
 path=worker_path(here,kind,channel);command=path.with_suffix('.focus.json')
 env={k:v for k,v in os.environ.items() if k not in ('ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH')}
 event_file=path.with_suffix('.events.json')
 env['DSH_EDITOR_EVENT_PATH']=str(event_file)
 env['DSH_EDITOR_CONTROL_PATH']=str(command)
 env['DSH_EDITOR_OWNER_PID']=str(os.getpid())
 kwargs={}
 if os.name=='nt':
  startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=1;kwargs['startupinfo']=startup
 proc=subprocess.Popen([exe,str(here/'desktop/main.cjs'),'--kind='+kind,'--url='+url,'--worker-key='+path.stem],cwd=str(Path(exe).parent),env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,**kwargs)
 focus_until=time.monotonic()+3;next_focus=0;focused=False
 state={'kind':kind,'channel':channel,'pid':os.getpid(),'electronPid':proc.pid,'ready':False,'backend':'electron','error':''};last_event=0;published=0
 try:
  while proc.poll() is None:
   if os.name=='nt' and not focused and time.monotonic()<focus_until and time.monotonic()>=next_focus:
    focused=focus_windows_process(proc.pid);next_focus=time.monotonic()+.2
   for event in read_events(event_file,os.getpid(),last_event):
    last_event=event['seq'];op=event['type']
    if op=='ready':state.update(ready=True,error='')
    else:state.update(ready=False,error=event['message'])
    if kind=='scene3d':
     from scene3d_windows import mark_ready
     mark_ready(str(here),instance,os.getpid(),channel,state['error'])
   if time.monotonic()-published>.5:
    state['heartbeat']=time.time();atomic(path,state);published=time.monotonic()
   time.sleep(.1)
  if proc.returncode:raise RuntimeError('Electron 窗口退出异常：'+str(proc.returncode))
 finally:
  path.unlink(missing_ok=True);command.unlink(missing_ok=True);event_file.unlink(missing_ok=True)
 return 0
