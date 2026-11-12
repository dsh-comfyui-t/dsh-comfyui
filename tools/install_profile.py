#!/usr/bin/env python3
"""Profile-aware Linux/WSL installer. Plan validation precedes any mutation."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = '@local/dsh-comfyui-console'
REGISTRATION = '\n# DSH x ComfyUI 绘图台\n- insert:\n    - id: comfyui-console\n      name: "@local/dsh-comfyui-console"\n'


def read_json(path):
    with open(path, encoding='utf-8-sig') as stream: data=json.load(stream)
    if not isinstance(data,dict): raise ValueError('JSON 顶层须为对象：'+str(path))
    return data


def profiles(home, selected='', allow_all=False):
    base = Path(home)/'profiles'
    if not base.is_dir(): raise ValueError('找不到 DSH profiles：' + str(base))
    choices = sorted(p for p in base.iterdir() if p.is_dir() and not p.is_symlink() and
                     not re.search(r'\.bak[-.]|\.uninstalled-',p.name) and (p/'cordis.patch.yml').is_file())
    if selected:
        if selected in ('.','..') or '/' in selected or '\\' in selected:
            raise ValueError('Profile 必须为 profiles 下的名称')
        found = [p for p in choices if p.name == selected]
        if not found: raise ValueError('Profile 不存在或缺少 cordis.patch.yml：' + selected)
        return found
    if not choices: raise ValueError('没有发现 DSH Profile')
    if allow_all or len(choices)==1 or {p.name for p in choices} <= {'desktop','web'}: return choices
    raise ValueError('发现多个 Profile，请用 --profile 指定：' + ', '.join(p.name for p in choices))


def destination(home, chosen, explicit=False):
    if explicit or chosen.name not in ('desktop','web') or (chosen/'node_modules/@local/dsh-comfyui-console').exists():
        return chosen/'node_modules/@local/dsh-comfyui-console'
    return Path(home)/'profiles/node_modules/@local/dsh-comfyui-console'


def atomic_bytes(path, content):
    temp = path.with_name(path.name+'.tmp-dsh-'+str(time.time_ns()))
    try:
        temp.write_bytes(content);os.replace(temp,path)
    finally:temp.unlink(missing_ok=True)


def atomic_text(path, content):
    atomic_bytes(path,content.encode('utf-8'))


def module(name, file):
    spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


def stop_sidecar(dest):
    # Terminate only our exact old expander path, never a main.py GPU process.
    wanted = str(dest/'expander.py').encode()
    if not (dest/'expander.py').is_file(): return
    visible_namespace = Path('/proc').is_dir() and Path('/proc/self').resolve().name == str(os.getpid())
    for entry in Path('/proc').iterdir() if visible_namespace else ():
        if not entry.name.isdigit() or int(entry.name)==os.getpid():continue
        try:
            command=(entry/'cmdline').read_bytes().split(b'\0')
            if wanted in command: os.kill(int(entry.name),signal.SIGTERM)
        except (OSError,ValueError):pass
    if os.environ.get('WSL_DISTRO_NAME') and shutil.which('powershell.exe') and shutil.which('wslpath'):
        try:
            import base64
            windows=subprocess.check_output(['wslpath','-w',str(dest/'expander.py')],text=True,timeout=5).strip().replace("'","''")
            script="$p='"+windows+"'; $q=[regex]::Escape($p); $pattern='(?i)(?:^|\\s)(?:\"'+$q+'\"|'+$q+')(?=\\s|$)'; Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('python.exe','pythonw.exe')) -and $_.CommandLine -and $_.CommandLine -match $pattern } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
            subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(script.encode('utf-16le')).decode()],timeout=10,check=True,capture_output=True)
        except (OSError,subprocess.SubprocessError):print('提示：旧 Windows Sidecar 未能停止，升级后请手动重启。',file=sys.stderr)


def ensure_electron(exe, windows, folder):
    """Install the pinned desktop runtime using the sidecar's platform Python."""
    script=str(folder/'install_electron.py')
    try:
        if windows and os.name!='nt':script=subprocess.check_output(['wslpath','-w',script],text=True,timeout=5).strip()
        result=subprocess.run([exe,'-u',script],timeout=900)
        if result.returncode:print('提示：Electron 安装未完成，可稍后运行 install_electron.py；插件其他功能仍可使用。',file=sys.stderr)
    except (OSError,subprocess.SubprocessError) as ex:print('提示：Electron 安装未完成：'+str(ex)[:400],file=sys.stderr)


def install(args):
    chosen = profiles(args.dsh_home,args.profile,args.list_profiles)
    if args.list_profiles:
        print(json.dumps([p.name for p in chosen],ensure_ascii=False));return 0
    stamp=time.strftime('%Y%m%d-%H%M%S')+'-'+str(time.time_ns())[-6:]
    source=ROOT/'plugin'; defaults=read_json(source/'config.example.json')
    release=module('dsh_release_files',ROOT/'tools/release_files.py')
    manifest_path=ROOT/'assets.json'
    if not manifest_path.is_file():manifest_path=source/'assets.json'
    manifest=read_json(manifest_path) if manifest_path.is_file() else {}
    has_release_assets=bool(manifest.get('assets'))
    plans=[]; groups={}
    shared=Path(args.dsh_home)/'profiles/node_modules/@local/dsh-comfyui-console'
    # Validate every file which will be read before moving or changing anything.
    for profile in chosen:
        dest=destination(args.dsh_home,profile,bool(args.profile))
        seed=dest if (dest/'config.json').is_file() else shared
        cfg={**defaults,**(read_json(seed/'config.json') if (seed/'config.json').is_file() else {})}
        for key,value in (('comfyRoot',args.comfy_root),('startScript',args.start_script),('pythonExe',args.python_exe)):
            if value is not None:cfg[key]=value
        pkg=read_json(profile/'package.json') if (profile/'package.json').is_file() else None
        if pkg is not None and not isinstance(pkg.get('dependencies',{}),dict): raise ValueError('Profile dependencies 须为对象：'+str(profile))
        text=(profile/'cordis.patch.yml').read_text(encoding='utf-8-sig')
        plans.append((profile,dest,pkg,text))
        groups[dest]=cfg
    bootstrap=module('dsh_install_bootstrap',source/'install_translation.py')
    install_python='';install_windows=False
    for dest,cfg in groups.items():
        wsl=bootstrap.is_wsl()
        exe=bootstrap.select_python(cfg,wsl)
        windows=wsl and exe.lower().endswith('.exe')
        install_python,install_windows=exe,windows
        cross=bootstrap._CROSS
        converted=cross.normalize_config(cfg,windows=windows,wsl=wsl,distro=os.environ.get('WSL_DISTRO_NAME',''),
            convert=(lambda p:cross.wsl_convert(p,'windows' if windows else 'linux')) if wsl else None)
        cfg.clear();cfg.update(converted)
        if windows:
            bridge=cross.windows_path(str(source/'runtime_bridge.py'),convert=lambda p:cross.wsl_convert(p,'windows'))
            try:
                # --quick: the preflight only needs platform + plugin readability.
                # A full resources() audit walks every asset over UNC (minutes on a
                # 500 MB plugin) and used to blow the 8 s budget for WSL users.
                run=subprocess.run([exe,'-X','utf8',bridge,'--inspect','--quick'],cwd=str(Path(exe).parent),capture_output=True,text=True,encoding='utf-8',timeout=25)
                inspection=json.loads(run.stdout)
                if run.returncode or inspection.get('platform')!='nt' or not inspection.get('pluginReadable'):
                    raise ValueError('Windows Python 无法读取插件文件，请检查 WSL interop / UNC 权限')
            except (OSError,ValueError,subprocess.SubprocessError) as ex:
                raise ValueError('Windows/WSL 预检失败，安装尚未修改文件：'+str(ex)) from ex
        if args.start_script and not Path(bootstrap.host_path(args.start_script,wsl)).is_file():raise ValueError('启动文件不存在：'+args.start_script)
        if dest.resolve().is_relative_to(source.resolve()):raise ValueError('安装目标不能位于发行包 plugin 内')
    version=read_json(source/'package.json')['version']
    stages={};swapped=[];modified=[]
    originals={path:path.read_bytes() for profile,_,_,_ in plans for path in
               (profile/'package.json',profile/'cordis.patch.yml') if path.is_file()}
    try:
        # Finish every copy, config and bundle validation before stopping old services.
        for dest,cfg in groups.items():
            dest.parent.mkdir(parents=True,exist_ok=True)
            stage=Path(tempfile.mkdtemp(prefix=dest.name+'.stage-',dir=dest.parent));stages[dest]=stage
            shutil.copytree(source,stage,dirs_exist_ok=True,ignore=lambda d,n:release.ignored(d,n,assets=has_release_assets))
            atomic_text(stage/'config.json',json.dumps(cfg,ensure_ascii=False,indent=2)+'\n')
            module('dsh_install_ports',ROOT/'tools/sync_client_ports.py').sync(stage,refresh_identity=True)
        for dest in groups:
            stop_sidecar(dest)
            release.preserve_runtime(dest,stages[dest])
            backup=Path(str(dest)+'.bak-'+stamp) if dest.exists() else None
            if backup:dest.rename(backup)
            swapped.append((dest,backup))
            stages[dest].rename(dest)
        for profile,dest,pkg,text in plans:
            if pkg is not None:
                path=profile/'package.json';shutil.copy2(path,str(path)+'.bak-'+stamp)
                pkg.setdefault('dependencies',{})[PLUGIN]=version
                atomic_text(path,json.dumps(pkg,ensure_ascii=False,indent=2)+'\n');modified.append(path)
            if not re.search(r'name:\s*["\']?@local/dsh-comfyui-console(?:["\']|\s|$)',text):
                path=profile/'cordis.patch.yml';shutil.copy2(path,str(path)+'.bak-'+stamp)
                atomic_text(path,text.rstrip()+'\n'+REGISTRATION);modified.append(path)
    except BaseException:
        # Restore byte-for-byte, including BOM/CRLF; never discard an old backup.
        rollback_errors=[]
        for path in reversed(modified):
            try:atomic_bytes(path,originals[path])
            except OSError as ex:rollback_errors.append(str(ex))
        for dest,backup in reversed(swapped):
            try:
                if dest.exists():shutil.rmtree(dest)
                if backup and backup.exists():backup.rename(dest)
            except OSError as ex:rollback_errors.append(str(ex))
        if rollback_errors:print('自动恢复未全部完成，请保留备份并手动检查：'+'；'.join(rollback_errors),file=sys.stderr)
        raise
    finally:
        for stage in stages.values():
            if stage.exists():shutil.rmtree(stage)
    for dest in groups:print('已安装到：'+str(dest))
    ensure_electron(install_python,install_windows,next(iter(groups)))
    if not getattr(args,'skip_assets',False) and has_release_assets:
        for dest in groups:
            script=dest/'tools/install_assets.py'
            if not script.is_file():continue
            print('安装 3D 资产与词库（首次需要联网，约 528 MB；失败可重试）…',flush=True)
            if subprocess.run([sys.executable,'-u',str(script),'--root',str(dest)]).returncode:
                print('提示：资产下载未完成，插件主体已安装；联网后重新运行安装器或 tools/install_assets.py 即可补齐。',file=sys.stderr)
    for profile,_,_,_ in plans:print('已注册 Profile：'+profile.name)
    if not args.skip_translation:
        for dest in groups:
            print('安装 / 检查离线英中翻译（首次需要联网，已有组件直接复用）…',flush=True)
            if subprocess.run([sys.executable,'-u',str(dest/'install_translation.py')]).returncode:
                print('提示：离线翻译安装未完成，插件主体已安装；可在中文预览中重试。',file=sys.stderr)
    if not getattr(args,'skip_post_controls',False):
        for dest in groups:
            print('提示：生成后控制桥接节点（DSHPostScale/Stage/ImageSize）请在插件的「生成后控制」中按提示安装；安装需要重启 ComfyUI。',flush=True)
    print('完成。请重启 DSH。原配置、Profile 及插件备份均已保留。')
    return 0


def uninstall(args):
    chosen=profiles(args.dsh_home,args.profile);stamp=time.strftime('%Y%m%d-%H%M%S')+'-'+str(time.time_ns())[-6:]
    for profile in chosen:
        if (profile/'package.json').is_file():
            package=read_json(profile/'package.json')
            if not isinstance(package.get('dependencies',{}),dict):raise ValueError('Profile dependencies 须为对象')
    for profile in chosen:
        patch=profile/'cordis.patch.yml';text=patch.read_text(encoding='utf-8-sig')
        new=re.sub(r'\n?# DSH x ComfyUI 绘图台(?:（本地插件）)?\n- insert:\n    - id: comfyui-console\n      name: "@local/dsh-comfyui-console"\n?', '\n', text)
        if new!=text:
            shutil.copy2(patch,str(patch)+'.bak-uninstall-'+stamp);atomic_text(patch,new)
        if (profile/'package.json').is_file():
            pkg=read_json(profile/'package.json')
            if PLUGIN in pkg.get('dependencies',{}):
                shutil.copy2(profile/'package.json',str(profile/'package.json')+'.bak-uninstall-'+stamp)
                del pkg['dependencies'][PLUGIN];atomic_text(profile/'package.json',json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')
        dest=profile/'node_modules/@local/dsh-comfyui-console'
        if dest.is_dir():stop_sidecar(dest);dest.rename(str(dest)+'.uninstalled-'+stamp)
    # A shared legacy install can still serve an unselected Profile.
    base=Path(args.dsh_home)/'profiles'
    active=any(re.search(r'name:\s*["\']?@local/dsh-comfyui-console(?:["\']|\s|$)',(profile/'cordis.patch.yml').read_text(encoding='utf-8-sig')) for profile in profiles(args.dsh_home,allow_all=True))
    shared=base/'node_modules/@local/dsh-comfyui-console'
    if not active and shared.is_dir():stop_sidecar(shared);shared.rename(str(shared)+'.uninstalled-'+stamp)
    print('已取消所选 Profile 注册，插件和配置保留为备份。请重启 DSH。');return 0


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dsh-home',default=os.environ.get('DSH_HOME',str(Path.home()/'.dsh')))
    parser.add_argument('--profile',default='')
    parser.add_argument('--start-script');parser.add_argument('--comfy-root');parser.add_argument('--python-exe')
    parser.add_argument('--skip-post-controls',action='store_true');parser.add_argument('--skip-translation',action='store_true');parser.add_argument('--skip-assets',action='store_true');parser.add_argument('--list-profiles',action='store_true')
    parser.add_argument('--uninstall',action='store_true')
    args=parser.parse_args()
    try:return uninstall(args) if args.uninstall else install(args)
    except (OSError,ValueError,subprocess.SubprocessError) as ex:
        print('安装配置失败：'+str(ex),file=sys.stderr);return 1


if __name__=='__main__':raise SystemExit(main())
