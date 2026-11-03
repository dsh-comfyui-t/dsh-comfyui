"""Install missing FaceDetailer dependencies into the selected ComfyUI, never the plugin environment.
Existing node repositories and detection models are reused, never updated in place.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

HERE=Path(__file__).resolve().parent
PACKAGES=(('ComfyUI-Impact-Pack','https://github.com/ltdrdata/ComfyUI-Impact-Pack.git'),('ComfyUI-Impact-Subpack','https://github.com/ltdrdata/ComfyUI-Impact-Subpack.git'))
DETECTOR_URL='https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8m.pt'


def module(name,file):
    spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


FACE=module('dsh_face_model_roles',HERE/'face_models.py')

def find_repo(base,name):
    target=name.lower().replace('-','').replace('_','')
    for p in base.iterdir() if base.is_dir() else []:
        if p.is_dir() and not p.is_symlink() and p.name.lower().replace('-','').replace('_','')==target:return p
    return None


def status(api):
    cfg=api.CFG;main=Path(cfg.get('comfyMainDir') or '/__missing_comfy__');custom=main/'custom_nodes'
    packages={name:bool(find_repo(custom,name)) for name,_ in PACKAGES}
    model=main/'models/ultralytics/bbox/face_yolov8m.pt'
    loaded={};online=False
    try:
        loaded=api._http_json('http://127.0.0.1:%d/object_info'%api.COMFY_PORT,'',timeout=3);online=True
    except Exception:pass
    if not isinstance(loaded,dict):loaded={};online=False
    options=[]
    if isinstance(loaded,dict):
        d=loaded.get('UltralyticsDetectorProvider',{}).get('input',{}).get('required',{}).get('model_name',[[]])[0]
        if isinstance(d,list):options=[str(x) for x in d if str(x).startswith('bbox/')]
    ready=bool(loaded.get('FaceDetailer') and loaded.get('UltralyticsDetectorProvider') and any('face' in name.lower() for name in options))
    bridge_file=custom/'dsh_post_controls/__init__.py';bridge_source=HERE/'comfy_nodes/dsh_post_controls/__init__.py'
    bridge_current=bridge_file.is_file() and not bridge_file.is_symlink() and bridge_file.read_bytes()==bridge_source.read_bytes()
    files=all(packages.values()) and model.is_file() and not model.is_symlink()
    available=FACE.available(loaded);models={}
    for role,spec in FACE.CATALOG.items():
        existing=FACE.find(api,role,spec['name'])
        models[role]={'default':spec['name'],'path':str(existing) if existing else '','available':available[role],'nodeLoaded':bool(loaded.get('SAMLoader' if role=='sam' else 'UltralyticsDetectorProvider')),'fileExists':bool(existing and FACE.valid_file(existing,spec['min_bytes'],spec['max_bytes']))}
    return {'faceModelsVersion':1,'models':models,'packages':packages,'detector':models['bbox']['path'] or str(model),'detectorExists':models['bbox']['fileExists'],'online':online,'ready':ready,'filesInstalled':files,'bridgeCurrent':bridge_current,
            'bridge':bool(loaded.get('DSHPostScale') and loaded.get('DSHPostStage') and loaded.get('DSHPostImageSize')),'message':'FaceDetailer 已就绪' if ready else '文件已安装；请重启 ComfyUI，确认节点及检测模型可加载' if files else '缺少 FaceDetailer 组件或检测模型；安装前请关闭 ComfyUI'}


def install(api,models=None):
    requested=FACE.selection(models)
    cfg=api.CFG;main=Path(cfg.get('comfyMainDir') or '')
    if not cfg.get('comfyMainDir') or not (main/'main.py').is_file():raise ValueError('未配置有效 ComfyUI，请先设置连接目录')
    py=cfg.get('comfyPy')
    if not py or cfg.get('comfyPythonSource') in ('sidecar.fallback','not-found') or not Path(py).is_file():raise ValueError('无法确认 ComfyUI Python，请在连接设置明确指定；未使用插件 Python 安装')
    state=status(api)
    bridge_file=main/'custom_nodes/dsh_post_controls/__init__.py'
    bridge_source=HERE/'comfy_nodes/dsh_post_controls/__init__.py'
    bridge_current=bridge_file.is_file() and bridge_file.read_bytes()==bridge_source.read_bytes()
    if state['ready'] and state['bridge'] and bridge_current and (models is None or FACE.requested_ready(state,requested)):print('FaceDetailer 已可用，复用现有节点及检测模型',flush=True);return state
    if state['online']:raise ValueError('请先关闭 ComfyUI，再安装或修复 FaceDetailer；不会自动停止生成任务')
    custom=main/'custom_nodes';custom.mkdir(parents=True,exist_ok=True)
    if custom.is_symlink():raise ValueError('自动安装不写入符号链接 custom_nodes，请手动安装')
    lock=custom/'.dsh-face-install.lock'
    fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.write(fd,str(os.getpid()).encode());os.close(fd)
    try:
        bridge=custom/'dsh_post_controls';source=HERE/'comfy_nodes/dsh_post_controls/__init__.py'
        if bridge.is_symlink():raise ValueError('DSH 图片桥接目录是符号链接，请手动检查')
        bridge.mkdir(exist_ok=True)
        if (bridge/'__init__.py').is_symlink():raise ValueError('DSH 图片桥接文件是符号链接，请手动检查')
        if (bridge/'__init__.py').is_file() and (bridge/'__init__.py').read_bytes()!=source.read_bytes():
            shutil.copy2(bridge/'__init__.py',bridge/('__init__.py.bak-'+str(time.time_ns())))
        bridge_temp=bridge/('.dsh-'+uuid.uuid4().hex+'.tmp')
        try:shutil.copy2(source,bridge_temp);os.replace(bridge_temp,bridge/'__init__.py')
        finally:bridge_temp.unlink(missing_ok=True)
        print('DSH 图片桥接节点已安装',flush=True)
        env={**os.environ,'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8','COMFYUI_PATH':str(main),'COMFYUI_MODEL_PATH':str(main/'models')}
        # Keep the user's inference stack (especially Intel XPU builds) fixed.
        constraint=custom/('.dsh-constraints-'+uuid.uuid4().hex+'.txt')
        query="import importlib.metadata as m,json; wanted={'torch','torchvision','torchaudio','intel-extension-for-pytorch','numpy','xformers'}; print(json.dumps({d.metadata['Name']:d.version for d in m.distributions() if d.metadata['Name'].lower() in wanted}))"
        result=subprocess.run([str(py),'-s','-c',query],env=env,check=True,capture_output=True,text=True,encoding='utf-8',timeout=30)
        versions=json.loads(result.stdout.strip());constraint.write_text(''.join(k+'=='+v+'\n' for k,v in versions.items()),encoding='utf-8');env['PIP_CONSTRAINT']=str(constraint)
        git=shutil.which('git')
        if not git:
            git=next((str(p) for p in (main.parent/'MinGit/cmd/git.exe',main.parent/'MinGit/bin/git.exe',main.parent/'git/cmd/git.exe') if p.is_file()),None)
        for name,url in PACKAGES:
            repo=find_repo(custom,name)
            if repo is None:
                if not git:raise ValueError('自动安装需要 Git，请安装 Git 或手动安装 Impact Pack / Subpack')
                temp=custom/('.dsh-install-'+uuid.uuid4().hex)
                try:
                    print('下载 '+name,flush=True);subprocess.run([git,'clone','--depth','1',url,str(temp)],env=env,check=True,timeout=300)
                    if not (temp/'__init__.py').is_file():raise ValueError('节点包不完整：'+name)
                    repo=custom/name
                    if repo.exists():raise ValueError('目标节点目录已存在，请刷新后重试')
                    temp.rename(repo)
                finally:
                    if temp.exists():shutil.rmtree(temp,ignore_errors=True)
            else:print('复用节点目录 '+str(repo)+'（不更新源码）',flush=True)
            requirements=repo/'requirements.txt'
            if requirements.is_file():
                print('检查 '+name+' 的 Python 依赖',flush=True)
                subprocess.run([str(py),'-s','-m','pip','install','--upgrade-strategy','only-if-needed','-c',str(constraint),'-r',str(requirements)],cwd=repo,env=env,check=True,timeout=900)
            # Impact Pack install.py builds its runtime resources; Subpack's installer
            # downloads unrelated hand/person models, so its pip requirements + face
            # detector are installed explicitly here instead.
            if name=='ComfyUI-Impact-Pack' and (repo/'install.py').is_file():subprocess.run([str(py),'-s',str(repo/'install.py')],cwd=repo,env=env,check=True,timeout=600)
        for role,names in requested.items():
            for name in names:ensure_model(api,role,name)
        print('FaceDetailer 组件安装完成，请启动 / 重启 ComfyUI。',flush=True)
        return status(api)
    finally:
        lock.unlink(missing_ok=True)
        if 'constraint' in locals():constraint.unlink(missing_ok=True)


def install_models(api,models=None):
    requested=FACE.selection(models);main=Path(api.CFG.get('comfyMainDir') or '')
    if not api.CFG.get('comfyMainDir') or not (main/'main.py').is_file():raise ValueError('未配置有效 ComfyUI，请先设置连接目录')
    custom=main/'custom_nodes';custom.mkdir(parents=True,exist_ok=True)
    if custom.is_symlink():raise ValueError('custom_nodes 是符号链接，请手动检查')
    lock=custom/'.dsh-face-install.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.write(fd,str(os.getpid()).encode());os.close(fd)
    try:
        for role,names in requested.items():
            for name in names:ensure_model(api,role,name)
        print('检测模型文件已准备；请刷新模型列表。若节点尚未加载，请另行安装节点并重启 ComfyUI。',flush=True)
        return status(api)
    finally:lock.unlink(missing_ok=True)


def ensure_model(api,role,name):
    spec=FACE.CATALOG[role];existing=FACE.find(api,role,name)
    if existing:
        minimum=spec['min_bytes'] if name==spec['name'] else 100000
        if not FACE.valid_file(existing,minimum):raise ValueError('现有检测模型不完整，已保留原文件：'+name)
        print('复用检测模型 '+str(existing),flush=True);return existing
    if name!=spec['name']:raise ValueError('未找到自定义检测模型 '+name+'；请放入 '+spec['folder']+' 或选择内置推荐模型后安装')
    root=FACE.roots(api,role)[0];target=root.joinpath(*Path(name).parts)
    # Never write through a symlink in any of the model path components.
    for parent in [target,*target.parents]:
        if parent.is_symlink():raise ValueError('检测模型路径包含符号链接，请手动检查：'+name)
    target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_name('.dsh-face-'+str(os.getpid())+'-'+uuid.uuid4().hex+'.part')
    try:
        print('下载 '+name,flush=True)
        url=DETECTOR_URL if role=='bbox' else spec['url']
        with urllib.request.urlopen(url,timeout=60) as response,temp.open('xb') as stream:
            headers=getattr(response,'headers',{});expected=int(headers.get('Content-Length') or 0)
            if expected and (expected<spec['min_bytes'] or expected>spec['max_bytes']):raise ValueError('检测模型响应大小异常：'+name)
            total=0;reported=0
            while True:
                chunk=response.read(1024*1024)
                if not chunk:break
                total+=len(chunk)
                if total>spec['max_bytes']:raise ValueError('检测模型超过大小限制：'+name)
                stream.write(chunk)
                if total-reported>=16*1024*1024:print('%s 已下载 %.0f MiB'%(name,total/1024/1024),flush=True);reported=total
        if expected and total!=expected or not FACE.valid_file(temp,spec['min_bytes'],spec['max_bytes']):raise ValueError('检测模型下载不完整或响应不是模型文件：'+name)
        try:
            if os.name=='nt':os.rename(temp,target)
            else:os.link(temp,target)
        except FileExistsError:
            if not FACE.valid_file(target,spec['min_bytes'],spec['max_bytes']):raise ValueError('并发创建的检测模型无效，已保留：'+name)
        return target
    finally:temp.unlink(missing_ok=True)


def cleanup_partials(api,models,pid):
    if not str(pid).isdigit():return
    for role,names in FACE.selection(models).items():
        for name in names:
            for root in FACE.roots(api,role):
                parent=root.joinpath(*Path(name).parts).parent
                if parent.is_symlink() or not parent.resolve().is_relative_to(root.resolve()):continue
                for path in parent.glob('.dsh-face-'+str(pid)+'-*.part'):path.unlink(missing_ok=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--runtime',action='store_true');parser.add_argument('--status',action='store_true');parser.add_argument('--models-json');parser.add_argument('--models-only',action='store_true');args=parser.parse_args()
    if not args.runtime:
        boot=module('dsh_post_bootstrap',HERE/'install_translation.py')
        cfg=json.loads((HERE/'config.json').read_text(encoding='utf-8-sig'));wsl=boot.is_wsl();exe=boot.select_python(cfg,wsl)
        script=str(HERE/'install_post_controls.py')
        if wsl and exe.lower().endswith('.exe'):script=boot._CROSS.windows_path(script,convert=lambda p:subprocess.check_output(['wslpath','-w',p],text=True,timeout=5).strip())
        return subprocess.call([exe,'-u',script,'--runtime']+(['--status'] if args.status else [])+(['--models-json',args.models_json] if args.models_json else [])+(['--models-only'] if args.models_only else []))
    api=module('dsh_post_api',HERE/'expander.py')
    print(json.dumps(status(api) if args.status else (install_models if args.models_only else install)(api,json.loads(args.models_json) if args.models_json else None),ensure_ascii=False),flush=True);return 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as ex:print('FaceDetailer 安装未完成：'+str(ex),file=sys.stderr);raise SystemExit(1)
