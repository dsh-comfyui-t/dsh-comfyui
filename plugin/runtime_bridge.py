"""Small stdlib-only runtime inspector and loopback probe, callable across WSL.

No torch/ComfyUI imports, credential reads, dependency installs, firewall writes
or non-loopback connections. JSON output is ASCII-safe for Windows consoles.
"""
import argparse
import errno
import http.client
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time

MAX_HEALTH=16384
DEFAULT_PROBE_TIMEOUT=3.0  # Allow slow Windows / WSL cold refusal without weakening unknown.


def inspect_runtime(config_path='',quick=False):
    cfg={}
    if config_path:
        with open(config_path,encoding='utf-8-sig') as stream:cfg=json.load(stream)
        if not isinstance(cfg,dict):raise ValueError('配置顶层须为对象')
    report={'ok':True,'platform':os.name,'python':sys.executable,'version':sys.version.split()[0],
            'cwd':os.getcwd(),'pluginReadable':(Path(__file__).parent/'expander.py').is_file(),
            'configReadable':bool(config_path),'instanceId':cfg.get('instanceId','')}
    if (Path(__file__).parent/'editor_runtime.py').is_file():
        from editor_runtime import native_status, resources, launch_resources, FILES
        report['nativeEditors']=native_status()
        report['recentResources']={kind:launch_resources(kind) for kind in FILES} if quick else resources()
    return report


def probe(port, instance_id='', required_api=15, timeout=DEFAULT_PROBE_TIMEOUT, health_path='/health', service='sidecar'):
    port=int(port)
    if not 1<=port<=65535:raise ValueError('端口须为 1–65535')
    timeout=max(.05,min(float(timeout),5));deadline=time.monotonic()+timeout
    result={'ok':True,'platform':os.name,'port':port,'reachable':False,'healthy':False,
            'state':'closed','detail':'本机端口未监听'}
    try:
        with socket.create_connection(('127.0.0.1',port),timeout=timeout):pass
        result.update(reachable=True,state='mismatch',detail='端口已监听，尚未确认 Sidecar 身份')
    except OSError as ex:
        if ex.errno==errno.ECONNREFUSED or getattr(ex,'winerror',0)==10061:return result
        return {**result,'ok':False,'state':'unknown','detail':'无法确认本机端口状态：'+str(ex)[:200]}
    # Direct loopback only: no proxy or redirect. A shutdown timer enforces a
    # total deadline even for a server sending a continuous slow response.
    connection=None;wire=None;timer=None
    try:
        remaining=deadline-time.monotonic()
        if remaining<=0:raise TimeoutError('健康检查超过总时限')
        connection=http.client.HTTPConnection('127.0.0.1',port,timeout=remaining)
        connection.connect();wire=connection.sock
        def expire():
            try:wire.shutdown(socket.SHUT_RDWR)
            except OSError:pass
        timer=threading.Timer(max(.001,deadline-time.monotonic()),expire);timer.daemon=True;timer.start()
        connection.request('GET',health_path,headers={'Connection':'close'})
        with connection.getresponse() as response:
            if response.status!=200:raise ValueError('健康响应 HTTP '+str(response.status))
            payload=response.read(MAX_HEALTH+1)
            if len(payload)>MAX_HEALTH:raise ValueError('健康响应超过 16 KiB')
            if time.monotonic()>deadline:raise TimeoutError('健康检查超过总时限')
            health=json.loads(payload)
        if not isinstance(health,dict):raise ValueError('健康响应不是对象')
        result['healthy']=(isinstance(health.get('system'),dict) if service=='comfy' else (health.get('ok') is True and health.get('service')=='dsh-comfyui-console'
                           and health.get('apiVersion')==required_api and health.get('sidecarPort')==port
                           and (not instance_id or health.get('instanceId')==instance_id)))
        if result['healthy']:
            detail='ComfyUI 本机连接正常' if service=='comfy' else '当前 Sidecar 已就绪'
        elif service=='comfy':
            detail='ComfyUI 健康信息未包含预期的 system 字段'
        elif health.get('service')!='dsh-comfyui-console' or health.get('ok') is not True:
            detail='端口上的服务不是有效的 DSH Sidecar'
        elif health.get('apiVersion')!=required_api:
            detail='Sidecar API 版本不匹配（需要 %s，实际 %s）；请完整重启 DSH 和 Sidecar' % (required_api,health.get('apiVersion'))
        elif health.get('sidecarPort')!=port:
            detail='Sidecar 报告的端口与监听端口不一致'
        else:
            detail='Sidecar 安装实例身份不匹配；可能有旧版或其他安装仍占用端口，请完整重启 DSH，检查 8199 端口的进程'
        result.update(state='healthy' if result['healthy'] else 'mismatch',detail=detail)
    except (OSError,ValueError,http.client.HTTPException) as ex:
        result.update(state='mismatch',detail='端口已占用，健康检查未通过：'+str(ex)[:200])
    finally:
        if timer:timer.cancel()
        if connection:connection.close()
        if wire:wire.close()
    return result


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--inspect',action='store_true');mode.add_argument('--probe',type=int)
    parser.add_argument('--quick',action='store_true',help='Inspect launch-critical resources without a recursive UNC audit')
    parser.add_argument('--config',default='');parser.add_argument('--instance-id',default='')
    parser.add_argument('--api',type=int,default=15);parser.add_argument('--timeout',type=float,default=DEFAULT_PROBE_TIMEOUT)
    args=parser.parse_args(argv)
    try:
        result=inspect_runtime(args.config,args.quick) if args.inspect else probe(args.probe,args.instance_id,args.api,args.timeout)
    except (OSError,ValueError) as ex:result={'ok':False,'state':'unknown','detail':str(ex)[:400]}
    print(json.dumps(result,ensure_ascii=True),flush=True)
    return 0 if result['ok'] else 1


if __name__=='__main__':raise SystemExit(main())
