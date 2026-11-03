"""Read-only compatibility observations; no package installs or network changes."""
import importlib.util
import os
from pathlib import Path
import platform
import sys
import time


def snapshot(cfg, paths, cross, probe, sidecar_port):
    items=[]
    def add(key,label,status,detail):items.append({'key':key,'label':label,'status':status,'detail':str(detail)})
    add('runtime','Sidecar Python','ok',sys.executable+' · '+platform.python_version()+' · '+os.name)
    wsl=cross.is_wsl()
    add('environment','运行环境','ok','WSL / '+os.environ.get('WSL_DISTRO_NAME','未知发行版') if wsl else 'Windows' if os.name=='nt' else platform.system())
    try:
        import sqlite3
        add('sqlite','SQLite','ok',sqlite3.sqlite_version+'（只检查模块，未打开词库）')
    except ImportError as ex:add('sqlite','SQLite','error',ex)
    try:yaml_available=importlib.util.find_spec('yaml') is not None
    except (ValueError,ImportError):yaml_available=False
    add('yaml','额外模型 YAML','ok' if yaml_available else 'warning','PyYAML 可用' if yaml_available else 'PyYAML 未安装；额外模型 YAML 无法解析')
    root=cfg.get('comfyRoot','')
    add('root','ComfyUI 安装','ok' if root and os.path.isdir(root) else 'error',root or '未找到安装目录')
    script=cfg.get('startScript','')
    if script:
        try:
            cross.command_cwd(script)
            add('launcher','启动文件','ok' if os.path.isfile(script) else 'error',script)
        except ValueError as ex:add('launcher','启动文件','error',ex)
    else:add('launcher','启动方式','warning' if cfg.get('launcherSelectionRequired') else 'ok','请先选择硬件启动器' if cfg.get('launcherSelectionRequired') else '直接运行 main.py')
    py=cfg.get('comfyPy','')
    add('comfy_python','ComfyUI Python','ok' if py and os.path.isfile(py) else 'error',py or '未找到；请在连接设置指定解释器')
    for name,entry in paths.get('resolvedPaths',{}).items():
        add('path_'+name,'输出目录' if name=='output' else '临时目录','error' if entry.get('error') else 'ok',entry.get('error') or (entry['path']+' · '+entry['source']))
    for index,message in enumerate(dict.fromkeys(cfg.get('pathWarnings',[])+paths.get('pathWarnings',[]))):add('warning_'+str(index),'路径提示','warning',message)
    for index,message in enumerate(paths.get('pathErrors',[])):add('error_'+str(index),'路径错误','error',message)
    for index,message in enumerate(cfg.get('namespaceErrors',[])):add('namespace_'+str(index),'环境路径错误','error',message)
    for index,message in enumerate(cfg.get('configErrors',[])):add('config_'+str(index),'配置错误','error',message)
    # No imports or inference from a GPU/torch dependency.
    service=probe(cfg.get('comfyPort',8188),timeout=.6,health_path='/system_stats',service='comfy')
    add('comfy_service','本机 ComfyUI','ok' if service['healthy'] else 'warning',service['detail'])
    add('sidecar','Sidecar 地址','ok','127.0.0.1:'+str(sidecar_port)+' · 当前请求已到达此 Sidecar')
    add('matrix','真实 GPU / 跨环境矩阵','unverified','此检查不运行推理，也不能证明其他 Windows / WSL 主机已通过实机验证。')
    return {'ok':True,'checkedAt':time.time(),'platform':os.name,'wsl':wsl,'items':items,
            'summary':{'errors':sum(x['status']=='error' for x in items),'warnings':sum(x['status']=='warning' for x in items)},
            'readOnly':True,'gpuTested':False}
