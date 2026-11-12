"""Install the pinned official Electron runtime for the current desktop platform."""
import argparse,hashlib,json,os,platform,shutil,stat,sys,tempfile,urllib.request,zipfile
from pathlib import Path

VERSION='45.0.0'
def target():
 system={'win32':'win32','darwin':'darwin','linux':'linux'}.get(sys.platform)
 arch={'amd64':'x64','x86_64':'x64','arm64':'arm64','aarch64':'arm64'}.get(platform.machine().lower())
 if not system or not arch:raise ValueError('Unsupported Electron desktop platform / architecture')
 return system,arch
def cache_root():
 if sys.platform=='win32':return Path(os.environ.get('LOCALAPPDATA',Path.home()/'AppData/Local'))/'DSHComfyUI/electron'
 if sys.platform=='darwin':return Path.home()/'Library/Caches/DSHComfyUI/electron'
 return Path(os.environ.get('XDG_CACHE_HOME',Path.home()/'.cache'))/'DSHComfyUI/electron'
def install(root=None):
 system,arch=target();root=Path(root) if root else cache_root();dest=root/VERSION/(system+'-'+arch)
 executable=dest/('electron.exe' if system=='win32' else 'Electron.app/Contents/MacOS/Electron' if system=='darwin' else 'electron')
 if executable.is_file():print('Electron runtime already installed:',executable);return
 name=f'electron-v{VERSION}-{system}-{arch}.zip';base=f'https://github.com/electron/electron/releases/download/v{VERSION}/'
 root.mkdir(parents=True,exist_ok=True)
 with urllib.request.urlopen(base+'SHASUMS256.txt',timeout=60) as response:checksums=response.read().decode()
 expected=next(line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip('*')==name)
 archive=root/name
 print('Downloading official Electron',VERSION,system,arch,flush=True)
 with urllib.request.urlopen(base+name,timeout=120) as response,archive.open('wb') as stream:shutil.copyfileobj(response,stream)
 actual=hashlib.sha256(archive.read_bytes()).hexdigest()
 if actual!=expected:raise ValueError('Electron download SHA256 mismatch; archive was not installed')
 dest.parent.mkdir(parents=True,exist_ok=True)
 stage=Path(tempfile.mkdtemp(prefix=system+'-'+arch+'-',dir=dest.parent))
 with zipfile.ZipFile(archive) as package:
  for info in package.infolist():
   path=stage/info.filename
   if not path.resolve().is_relative_to(stage.resolve()):raise ValueError('Archive path escapes runtime directory')
   if stat.S_ISLNK(info.external_attr>>16):
    link=package.read(info).decode();resolved=(path.parent/link).resolve()
    if not resolved.is_relative_to(stage.resolve()):raise ValueError('Archive symlink escapes runtime directory')
    path.parent.mkdir(parents=True,exist_ok=True);path.symlink_to(link)
   else:
    package.extract(info,stage)
    if os.name!='nt' and (info.external_attr>>16)&0o111:path.chmod(path.stat().st_mode|0o111)
 if dest.exists():raise ValueError('Runtime destination exists; preserve it and choose another cache root')
 stage.rename(dest)
 (dest/'dsh-runtime.json').write_text(json.dumps({'version':VERSION,'platform':system,'arch':arch,'sha256':actual}))
 print('Verified and installed:',executable,flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache-root');args=parser.parse_args();install(args.cache_root)
