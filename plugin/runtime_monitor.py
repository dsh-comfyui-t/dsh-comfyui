"""Local resource sampling and ComfyUI's native progress feed. No tensor imports."""
from collections import OrderedDict
import copy
import json
import math
import os
import threading
import time
from urllib.parse import urlencode
import urllib.request


def _number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def _fraction(used, total):
    return max(0, min(100, used / total * 100)) if _number(used) is not None and _number(total) and total > 0 else None


def device_resource(device):
    total,free=_number(device.get('vram_total')),_number(device.get('vram_free'))
    reserved,torch_free=_number(device.get('torch_vram_total')),_number(device.get('torch_vram_free'))
    kind=str(device.get('type') or '')
    # ComfyUI's free value includes reusable torch cache. Add that cache back
    # for device usage; Intel XPU exposes allocator usage rather than global free.
    if kind in ('cpu','mps'):used=None;total=None;scope='shared'
    elif kind=='xpu':used=reserved;scope='comfy'
    else:used=max(0,min(total,total-free+(torch_free or 0))) if total and free is not None else None;scope='device'
    return {'name':str(device.get('name') or kind)[:200],'type':kind,'index':device.get('index'),
            'used':used,'total':total,'percent':_fraction(used,total),'torchReserved':reserved,'scope':scope}


class ProgressStore:
    def __init__(self, on_change=lambda:None):
        self.lock=threading.RLock();self.jobs=OrderedDict();self.current={};self.queue_current=None
        self.on_change=on_change

    def _job(self, pid):
        if not isinstance(pid,str) or not 0<len(pid)<160:return None
        row=self.jobs.setdefault(pid,{'promptId':pid,'state':'queued','node':None,'value':None,'max':None,
                                     'finished':set(),'nodes':{},'labels':{},'total':0,'startedSeen':False,'updatedAt':time.time()*1000})
        self.jobs.move_to_end(pid)
        while len(self.jobs)>64:self.jobs.popitem(last=False)
        return row

    def register(self,pid,graph):
        with self.lock:
            row=self._job(pid)
            if row is None:return
            if not isinstance(graph,dict):return
            graph={str(k):v for k,v in list(graph.items())[:4096] if isinstance(v,dict)}
            roots=[k for k,v in graph.items() if v.get('class_type') in ('PreviewImage','SaveImage','DSHPostStage')]
            required=set()
            pending=list(roots)
            while pending:
                key=pending.pop()
                if key in required or key not in graph:continue
                required.add(key)
                inputs=graph[key].get('inputs')
                for value in (inputs if isinstance(inputs,dict) else {}).values():
                    if isinstance(value,list) and len(value)==2 and isinstance(value[0],str):pending.append(value[0])
            if not required:required=set(graph)
            row['labels']={k:{'type':str(v.get('class_type') or '')[:120],
                              'label':str((v.get('_meta') if isinstance(v.get('_meta'),dict) else {}).get('title') or v.get('class_type') or k)[:160]} for k,v in graph.items() if k in required}
            row['total']=len(required)
        self.on_change()

    def ingest(self,event,channel='primary'):
        if not isinstance(event,dict) or not isinstance(event.get('data'),dict):return
        kind,data=event.get('type'),event['data']
        if kind not in ('execution_start','execution_cached','executing','progress','progress_state','executed','execution_success','execution_error','execution_interrupted'):return
        with self.lock:
            pid=data.get('prompt_id') or self.current.get(channel) or self.queue_current
            row=self._job(pid)
            if row is None:return
            # Terminal state is authoritative even if another websocket delivers
            # a late progress/executing event for the same prompt.
            if row['state'] in ('finished','error','cancelled'):return
            if kind=='execution_start':
                row.update(state='running',node=None,value=None,max=None,finished=set(),nodes={},startedSeen=True)
                self.current[channel]=pid
            elif kind=='execution_cached':
                row['finished'].update(str(n) for n in (data.get('nodes') or [])[:4096])
            elif kind=='executing':
                node=str(data['node']) if data.get('node') is not None else None
                if row['node'] and row['node']!=node and not row['nodes']:row['finished'].add(row['node'])
                if node!=row['node']:row.update(value=None,max=None)
                row['node']=node;row['state']='running';self.current[channel]=pid
                if node is None:row.update(state='finishing',value=None,max=None)
            elif kind=='progress':
                value,maximum=_number(data.get('value')),_number(data.get('max'))
                if value is not None and maximum and maximum>0:
                    node=str(data.get('node') or row['node'] or '') or None
                    row.update(state='running',node=node,value=max(0,min(value,maximum)),max=maximum)
            elif kind=='progress_state':
                nodes=data.get('nodes')
                if not isinstance(nodes,dict):return
                running=[];states={}
                for key,state in list(nodes.items())[:4096]:
                    if not isinstance(state,dict):continue
                    node=str(key);status=state.get('state')
                    value,maximum=_number(state.get('value')),_number(state.get('max'))
                    states[node]={'state':status,'value':value,'max':maximum}
                    if status=='finished':row['finished'].add(node)
                    if status=='running':running.append((node,value,maximum))
                row['nodes']=states
                if running:
                    candidate=next((v for v in running if v[0]==row['node']),None) or next((v for v in running if v[2] and v[2]>1),running[-1])
                    node,value,maximum=candidate
                    row.update(state='running',node=node,value=max(0,min(value,maximum)) if value is not None and maximum and maximum>1 else None,max=maximum if maximum and maximum>1 else None)
                elif row['node'] in row['finished']:
                    row.update(value=None,max=None)
            elif kind in ('execution_success','execution_error','execution_interrupted'):
                row.update(state={'execution_success':'finished','execution_error':'error','execution_interrupted':'cancelled'}[kind],value=None,max=None)
                if kind=='execution_success':row['finished'].update(row['labels'])
                if self.current.get(channel)==pid:self.current.pop(channel,None)
            # "executed" denotes UI output and is not a reliable whole-node count.
            row['updatedAt']=time.time()*1000
        self.on_change()

    def snapshot(self):
        with self.lock:
            result=[]
            for row in list(self.jobs.values())[-40:]:
                labels=row['labels'];finished=row['finished']
                completed=len(finished.intersection(labels)) if labels else len(finished)
                total=row['total'] or 0
                fraction=row['value']/row['max'] if row['max'] and row['value'] is not None else 0
                overall=min(.99,(completed+fraction)/total) if total and (row['startedSeen'] or row['nodes']) else None
                if row['state']=='finished':overall=1
                meta=labels.get(row['node'],{})
                result.append({'promptId':row['promptId'],'state':row['state'],'nodeId':row['node'],
                               'nodeLabel':meta.get('label') or row['node'] or '', 'nodeType':meta.get('type') or '',
                               'value':row['value'],'max':row['max'],'completedNodes':min(completed,total) if total else completed,
                               'totalNodes':total,'overall':overall,'updatedAt':row['updatedAt']})
            return result


class HostResources:
    def __init__(self):
        self.previous=None;self.primed=False
        try:
            import psutil
            self.psutil=psutil
        except ImportError:self.psutil=None

    def sample(self):
        cpu={'percent':None};memory={'used':None,'total':None,'percent':None}
        try:
            if self.psutil:
                value=self.psutil.cpu_percent(interval=None)
                cpu['percent']=value if self.primed else None;self.primed=True
                mem=self.psutil.virtual_memory();memory={'used':mem.total-mem.available,'total':mem.total,'percent':mem.percent}
            elif os.name=='nt':
                import ctypes
                from ctypes import wintypes
                idle,kernel,user=wintypes.FILETIME(),wintypes.FILETIME(),wintypes.FILETIME()
                if ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle),ctypes.byref(kernel),ctypes.byref(user)):
                    integer=lambda v:(v.dwHighDateTime<<32)|v.dwLowDateTime
                    current=(integer(idle),integer(kernel)+integer(user))
                    if self.previous:
                        delta=current[1]-self.previous[1]
                        if delta>0:cpu['percent']=max(0,min(100,(1-(current[0]-self.previous[0])/delta)*100))
                    self.previous=current
                class Memory(ctypes.Structure):
                    _fields_=[('length',wintypes.DWORD),('load',wintypes.DWORD)]+[(k,ctypes.c_ulonglong) for k in ('total','available','pageTotal','pageAvailable','virtualTotal','virtualAvailable','extended')]
                mem=Memory();mem.length=ctypes.sizeof(mem)
                if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)):
                    memory={'used':mem.total-mem.available,'total':mem.total,'percent':_fraction(mem.total-mem.available,mem.total)}
            elif os.path.isfile('/proc/stat'):
                with open('/proc/stat') as stream:values=[int(v) for v in stream.readline().split()[1:9]]
                current=(sum(values),values[3]+values[4])
                if self.previous and current[0]>self.previous[0]:cpu['percent']=(1-(current[1]-self.previous[1])/(current[0]-self.previous[0]))*100
                self.previous=current
                with open('/proc/meminfo') as stream:info={parts[0].rstrip(':'):int(parts[1])*1024 for line in stream if len(parts:=line.split())>=2}
                total=info.get('MemTotal');available=info.get('MemAvailable')
                if total is not None and available is not None:memory={'used':total-available,'total':total,'percent':_fraction(total-available,total)}
        except (OSError,ValueError,AttributeError,TypeError):pass
        return {'cpu':cpu,'memory':memory,'devices':[],'sampledAt':time.time()*1000}


class RuntimeMonitor:
    def __init__(self,port,instance_id,legacy_client='dsh-comfyui-console'):
        self.port=int(port);self.instance_id=instance_id;self.legacy_client=legacy_client
        self.client_id=legacy_client+'-'+(instance_id or str(os.getpid()))
        self.condition=threading.Condition();self.stop_event=threading.Event();self.legacy_needed=threading.Event()
        self.primary_ready=threading.Event();self.started=False;self.revision=0
        self.resources=HostResources();self.data={'resources':{},'comfyOnline':False,'queueRunning':0,'queuePending':0}
        self.connections={'primary':False,'legacy':False};self.transport_error=''
        self.progress=ProgressStore(self.changed)

    def changed(self):
        with self.condition:self.revision+=1;self.condition.notify_all()

    def start(self):
        with self.condition:
            if self.started:return
            self.started=True
            for target,args in ((self._sample_loop,()),(self._socket_loop,('primary',self.client_id)),(self._socket_loop,('legacy',self.legacy_client))):
                threading.Thread(target=target,args=args,daemon=True).start()

    def prepare_submission(self):
        self.start();self.primary_ready.wait(1.5)
        return self.client_id

    def _get(self,path):
        with urllib.request.urlopen('http://127.0.0.1:%d%s'%(self.port,path),timeout=2.5) as response:
            return json.loads(response.read(8*1024*1024))

    def _sample_loop(self):
        while not self.stop_event.is_set():
            resources=self.resources.sample();online=False;running=[];pending=[]
            try:
                stats=self._get('/system_stats');online=True
                resources['devices']=[device_resource(device) for device in stats.get('devices',[])[:8] if isinstance(device,dict)]
                queue=self._get('/queue');running=queue.get('queue_running') or [];pending=queue.get('queue_pending') or []
                with self.progress.lock:self.progress.queue_current=running[0][1] if running and len(running[0])>1 else None
                # Recover labels for already-running tasks from the former browser
                # client without publishing prompts or stealing a native UI client.
                for entry in running:
                    if len(entry)>3 and isinstance(entry[3],dict) and entry[3].get('client_id') in (self.legacy_client,self.client_id):
                        with self.progress.lock:known=bool(self.progress.jobs.get(entry[1],{}).get('labels'))
                        if not known:self.progress.register(entry[1],entry[2])
                legacy=any(len(row)>3 and isinstance(row[3],dict) and row[3].get('client_id')==self.legacy_client for row in running)
                if legacy:self.legacy_needed.set()
                else:self.legacy_needed.clear()
            except (OSError,ValueError,TypeError,IndexError):
                self.legacy_needed.clear()
            with self.condition:self.data={'resources':resources,'comfyOnline':online,'queueRunning':len(running),'queuePending':len(pending)}
            self.changed();self.stop_event.wait(2)

    def _socket_loop(self,channel,client_id):
        # websocket-client is present in ComfyUI portable; aiohttp is the ComfyUI dependency fallback.
        while not self.stop_event.is_set():
            if channel=='legacy' and not self.legacy_needed.wait(.5):continue
            try:
                try:import websocket
                except ImportError:
                    import asyncio
                    asyncio.run(self._aiohttp_socket(channel,client_id));continue
                url='ws://127.0.0.1:%d/ws?%s'%(self.port,urlencode({'clientId':client_id}))
                ws=websocket.create_connection(url,timeout=2,origin='http://127.0.0.1:%d'%self.port,enable_multithread=True)
                self._connected(channel,True)
                try:
                    while not self.stop_event.is_set() and (channel!='legacy' or self.legacy_needed.is_set()):
                        try:message=ws.recv()
                        except websocket.WebSocketTimeoutException:continue
                        if not message:break
                        if isinstance(message,str):self._message(message,channel)
                finally:ws.close()
            except Exception as error:
                with self.condition:self.transport_error='缺少本地 WebSocket 依赖' if isinstance(error,ImportError) else '正在重新连接 ComfyUI 进度服务'
                self.stop_event.wait(2)
            finally:self._connected(channel,False)

    async def _aiohttp_socket(self,channel,client_id):
        import aiohttp
        url='http://127.0.0.1:%d/ws?%s'%(self.port,urlencode({'clientId':client_id}))
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(url,heartbeat=15,headers={'Origin':'http://127.0.0.1:%d'%self.port}) as ws:
                self._connected(channel,True)
                while not self.stop_event.is_set() and (channel!='legacy' or self.legacy_needed.is_set()):
                    try:message=await ws.receive(timeout=2)
                    except TimeoutError:continue
                    if message.type==aiohttp.WSMsgType.TEXT:self._message(message.data,channel)
                    elif message.type in (aiohttp.WSMsgType.CLOSED,aiohttp.WSMsgType.ERROR):break

    def _message(self,message,channel):
        if len(message)>2*1024*1024:return
        try:self.progress.ingest(json.loads(message),channel)
        except (ValueError,TypeError,KeyError,OverflowError):pass

    def _connected(self,channel,connected):
        with self.condition:self.connections[channel]=connected
        if channel=='primary':
            if connected:self.primary_ready.set()
            else:self.primary_ready.clear()
        self.changed()

    def snapshot(self):
        self.start()
        with self.condition:
            data=copy.deepcopy(self.data);revision=self.revision
            data.update(version=1,instanceId=self.instance_id,clientId=self.client_id,revision=revision,
                        progressConnected=any(self.connections.values()),progressMessage='' if any(self.connections.values()) else self.transport_error,
                        serverTime=time.time()*1000)
        data['jobs']=self.progress.snapshot()
        return data

    def wait(self,revision,timeout=10):
        with self.condition:self.condition.wait_for(lambda:self.revision!=revision or self.stop_event.is_set(),timeout)

    def close(self):self.stop_event.set();self.changed()
