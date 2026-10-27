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


def inspect_runtime(config_path=''):
    cfg={}
    if config_path:
        with open(config_path,encoding='utf-8-sig') as stream:cfg=json.load(stream)
        if not isinstance(cfg,dict):raise ValueError('配置顶层须为对象')
    return {'ok':True,'platform':os.name,'python':sys.executable,'version':sys.version.split()[0],
            'cwd':os.getcwd(),'pluginReadable':(Path(__file__).parent/'expander.py').is_file(),
            'configReadable':bool(config_path),'instanceId':cfg.get('instanceId','')}


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
        result.update(state='healthy' if result['healthy'] else 'mismatch',detail=('ComfyUI 本机连接正常' if service=='comfy' else '当前 Sidecar 已就绪') if result['healthy'] else '服务身份、API 或端口未通过验证')
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
    parser.add_argument('--config',default='');parser.add_argument('--instance-id',default='')
    parser.add_argument('--api',type=int,default=15);parser.add_argument('--timeout',type=float,default=DEFAULT_PROBE_TIMEOUT)
    args=parser.parse_args(argv)
    try:
        result=inspect_runtime(args.config) if args.inspect else probe(args.probe,args.instance_id,args.api,args.timeout)
    except (OSError,ValueError) as ex:result={'ok':False,'state':'unknown','detail':str(ex)[:400]}
    print(json.dumps(result,ensure_ascii=True),flush=True)
    return 0 if result['ok'] else 1


if __name__=='__main__':raise SystemExit(main())
