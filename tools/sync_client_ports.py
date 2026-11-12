#!/usr/bin/env python3
"""Synchronize one installed config/client pair; rollback failed pair writes.

Repeated manual sync preserves the installation identity. Installers explicitly
request a fresh identity. This is an in-process rollback, not crash recovery.
"""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import uuid

ANCHOR = 'const INSTALLED_PORTS = { comfyPort: 8188, sidecarPort: 8199 };'
PORT_DECLARATION = re.compile(r'^(?P<indent>[ \t]*)const INSTALLED_PORTS = \{ comfyPort: [0-9]+, sidecarPort: [0-9]+ \};[ \t]*\r?$',re.M)
ID_DECLARATION = re.compile(r'^(?P<indent>[ \t]*)const INSTALLED_INSTANCE_ID = ("(?:[^"\\\r\n]|\\.)*");[ \t]*\r?$',re.M)


def port(value,label):
    if isinstance(value,bool) or not isinstance(value,(str,int)) or not re.fullmatch(r'[0-9]+',str(value)):
        raise ValueError(label+': invalid port')
    number=int(value)
    if not 1<=number<=65535:raise ValueError(label+': port outside 1..65535')
    return number


def _discard(path):
    try:path.unlink(missing_ok=True)
    except PermissionError:
        os.chmod(path,stat.S_IMODE(path.stat().st_mode)|stat.S_IWUSR);path.unlink(missing_ok=True)


def _temporary(path,data,label):
    fd,name=tempfile.mkstemp(prefix='.dsh-sync-'+label+'-',dir=path.parent)
    temp=Path(name)
    try:
        with os.fdopen(fd,'wb') as stream:stream.write(data)
        os.chmod(temp,stat.S_IMODE(path.stat().st_mode))
        return temp
    except BaseException:
        _discard(temp);raise


def sync(destination,refresh_identity=False):
    directory=Path(destination)
    lock=directory/'.dsh-port-sync.lock'
    try:fd=os.open(lock,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    except FileExistsError as ex:raise ValueError('端口同步正在进行或上次未正常结束；确认没有同步进程后检查 .dsh-port-sync.lock 和备份') from ex
    try:
        with os.fdopen(fd,'w') as stream:stream.write(str(os.getpid()))
        return _sync(directory,refresh_identity)
    finally:lock.unlink(missing_ok=True)


def _sync(directory,refresh_identity):
    config_path=directory/'config.json';client=directory/'lib/client.js'
    config_bytes=config_path.read_bytes();client_bytes=client.read_bytes()
    config=json.loads(config_bytes.decode('utf-8-sig'))
    if not isinstance(config,dict):raise ValueError('config.json 顶层必须为对象')
    comfy=port(config.get('comfyPort',8188),'comfyPort');sidecar=port(config.get('sidecarPort',8199),'sidecarPort')
    if comfy==sidecar:raise ValueError('ComfyUI and sidecar must use different ports')
    code=client_bytes.decode('utf-8-sig')
    if len(PORT_DECLARATION.findall(code))!=1:raise ValueError('missing/ambiguous INSTALLED_PORTS anchor in client.js')
    if len(ID_DECLARATION.findall(code))!=1:raise ValueError('missing/ambiguous installed instance identity anchor')
    identity=config.get('instanceId')
    if refresh_identity or not isinstance(identity,str) or not identity:
        identity=str(uuid.uuid4())
    config['instanceId']=identity
    config.update(comfyPort=comfy,sidecarPort=sidecar)
    code=PORT_DECLARATION.sub(lambda match:match['indent']+f'const INSTALLED_PORTS = {{ comfyPort: {comfy}, sidecarPort: {sidecar} }};',code,count=1)
    code=ID_DECLARATION.sub(lambda match:match['indent']+'const INSTALLED_INSTANCE_ID = '+json.dumps(identity)+';',code,count=1)
    values={client:code.encode('utf-8'),config_path:(json.dumps(config,ensure_ascii=False,indent=2)+'\n').encode('utf-8')}
    originals={client:client_bytes,config_path:config_bytes}
    # DSH 0.2.1 resolves <pkg>/lib/<exports['./client']> to lib/lib/client.js;
    # keep that nested copy byte-identical or the installed identity/ports are stale.
    nested=directory/'lib/lib/client.js'
    if nested.is_file():
        values[nested]=code.encode('utf-8');originals[nested]=nested.read_bytes()
    staged={};backups={};committed=[];keep_backups=False
    try:
        for path,data in values.items():
            staged[path]=_temporary(path,data,'new');backups[path]=_temporary(path,originals[path],'backup')
        for path in values:
            os.replace(staged[path],path);committed.append(path)
    except BaseException as error:
        failures=[]
        for path in reversed(committed):
            try:os.replace(backups[path],path)
            except OSError as ex:failures.append(str(ex))
        if failures:
            keep_backups=True
            existing=[str(path) for path in backups.values() if path.exists()]
            raise RuntimeError('同步失败且自动恢复未完成，请保留并检查备份：'+'；'.join(existing)) from error
        raise
    finally:
        for path in staged.values():_discard(path)
        if not keep_backups:
            for path in backups.values():_discard(path)
    return comfy,sidecar


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    parser.add_argument('--new-instance',action='store_true',help='manual install/upgrade: generate a new installation identity')
    args=parser.parse_args()
    try:
        cp,sp=sync(args.destination,refresh_identity=args.new_instance)
        print(f'Browser port defaults updated: ComfyUI={cp}, Sidecar={sp}; restart Sidecar / DSH after changes.')
    except (OSError,ValueError,RuntimeError) as ex:sys.exit(str(ex))
