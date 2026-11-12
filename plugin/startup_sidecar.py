"""Start only this installation's Sidecar after verifying loopback identity.

Used by the hidden Windows login launcher. No ComfyUI/GPU start, dependency
installation, credential reads, listener or firewall changes.
"""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

HERE=Path(__file__).resolve().parent


def _probe(*args,**kwargs):
    spec=importlib.util.spec_from_file_location('dsh_startup_probe',HERE/'runtime_bridge.py')
    bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
    return bridge.probe(*args,**kwargs)


def _port(value,label):
    if isinstance(value,bool) or not isinstance(value,(str,int)) or not re.fullmatch(r'[0-9]+',str(value)) or not 1<=int(value)<=65535:
        raise ValueError(label+' 必须为 1–65535 的整数')
    return int(value)


def ensure(directory=HERE,probe=None,launch=None,pause=time.sleep,attempts=20,interval=.5):
    directory=Path(directory);probe=probe or _probe;launch=launch or subprocess.Popen
    with open(directory/'config.json',encoding='utf-8-sig') as stream:cfg=json.load(stream)
    if not isinstance(cfg,dict):raise ValueError('config.json 顶层必须为对象')
    port=_port(cfg.get('sidecarPort',8199),'sidecarPort');comfy=_port(cfg.get('comfyPort',8188),'comfyPort')
    if port==comfy:raise ValueError('ComfyUI 和 Sidecar 端口不能相同')
    identity=cfg.get('instanceId') or ''
    if not isinstance(identity,str):raise ValueError('instanceId 必须为字符串')
    script=directory/'expander.py'
    if not script.is_file():raise ValueError('未找到本安装 expander.py')
    def check():return probe(port,identity,required_api=15,timeout=3.0)
    state=check()
    if state.get('healthy') and state.get('state')=='healthy' and state.get('ok') is True:
        return {'ok':True,'state':'healthy','reused':True,'started':False,'port':port}
    if state.get('ok') is not True or state.get('state')!='closed':
        return {'ok':False,'state':state.get('state','unknown'),'started':False,'detail':state.get('detail','无法确认当前 Sidecar；停止重复启动')}
    options={'cwd':str(directory),'stdin':subprocess.DEVNULL,'stdout':subprocess.DEVNULL,'stderr':subprocess.DEVNULL,'close_fds':True}
    if os.name=='nt':options['creationflags']=getattr(subprocess,'CREATE_NO_WINDOW',0)
    else:options['start_new_session']=True
    child=launch([sys.executable,'-X','utf8',str(script),'--port',str(port)],**options)
    for _ in range(max(1,attempts)):
        state=check()
        if state.get('healthy') and state.get('state')=='healthy' and state.get('ok') is True:
            return {'ok':True,'state':'healthy','reused':False,'started':True,'pid':child.pid,'port':port}
        if state.get('state') in ('unknown','mismatch') or child.poll() is not None:break
        pause(interval)
    return {'ok':False,'state':state.get('state','unknown'),'started':True,'pid':child.pid,
            'detail':state.get('detail','Sidecar 尚未就绪，请检查启动日志')}


def main():
    try:result=ensure()
    except (OSError,ValueError,subprocess.SubprocessError) as ex:result={'ok':False,'state':'unknown','started':False,'detail':str(ex)[:600]}
    print(json.dumps(result,ensure_ascii=True),flush=True)
    return 0 if result['ok'] else 1


if __name__=='__main__':raise SystemExit(main())
