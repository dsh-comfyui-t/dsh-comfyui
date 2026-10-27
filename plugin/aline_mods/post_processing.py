"""Persistent workflow library and history-verified post-generation output groups.
No tensor dependencies; all inference stays in the target ComfyUI process.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import threading
import uuid

LOCK = threading.RLock()
MODES = ('final', 'original', 'all')


def atomic_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name('.'+path.name+'.'+uuid.uuid4().hex)
    try:
        with temp.open('x', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False)
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def read_json(path, default=None):
    path = Path(path)
    try:
        if path.is_symlink() or path.stat().st_size > 4*1024*1024: return default
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default


class PostProcessing:
    def __init__(self, api):
        self.api = api

    @property
    def directory(self):
        return Path(self.api._model_source_cache_path()).parent/'post-processing'

    def workflows(self):
        folder=self.directory/'workflows'
        return {'items': [r for p in sorted(folder.glob('*.json'))[:1000]
                          if isinstance(r:=read_json(p),dict)]}

    def save_workflow(self, payload):
        wf=copy.deepcopy(payload.get('workflow'))
        if not isinstance(wf,dict) or not str(wf.get('name','')).strip(): raise ValueError('请命名工作流')
        if len(json.dumps(wf))>1024*1024: raise ValueError('工作流超过 1 MiB')
        nodes=wf.get('nodes')
        if not isinstance(nodes,list) or not 1<=len(nodes)<=100: raise ValueError('工作流需包含 1–100 个节点')
        ids=set()
        for node in nodes:
            if not isinstance(node,dict) or not isinstance(node.get('id'),str) or node['id'] in ids: raise ValueError('节点 ID 无效或重复')
            ids.add(node['id'])
            if not isinstance(node.get('inputs'),dict) or not isinstance(node.get('type'),str): raise ValueError('节点定义无效')
            if re.match(r'^(Save|Preview)',node['type'],re.I): raise ValueError('图片保存由插件管理')
        edges={node['id']:[] for node in nodes}
        for node in nodes:
            for value in node['inputs'].values():
                if not isinstance(value,dict):continue
                if 'interface' in value:
                    if value['interface'] not in {'image','original','model','clip','vae','positive','negative','pos','neg','latent','seed','steps','cfg','sampler','scheduler','width','height'}:raise ValueError('未知插件接口')
                else:
                    if value.get('node') not in ids or type(value.get('slot')) is not int or value['slot']<0:raise ValueError('工作流连接无效')
                    edges[node['id']].append(value['node'])
        seen=set();visiting=set()
        def visit(node):
            if node in visiting:raise ValueError('工作流不能循环连接')
            if node in seen:return
            visiting.add(node)
            for parent in edges[node]:visit(parent)
            visiting.remove(node);seen.add(node)
        for node in ids:visit(node)
        if not isinstance(wf.get('output'),dict) or wf['output'].get('node') not in ids or type(wf['output'].get('slot')) is not int or wf['output']['slot']<0: raise ValueError('请指定处理结果')
        ident=wf.get('id')
        if ident and not re.fullmatch('[a-f0-9]{32}',str(ident)): raise ValueError('工作流 ID 无效')
        wf['id']=ident or uuid.uuid4().hex;wf['name']=str(wf['name']).strip()[:120]
        with LOCK: atomic_json(self.directory/'workflows'/(wf['id']+'.json'),wf)
        return {'ok':True,'workflow':wf}

    def delete_workflow(self, payload):
        ident=str(payload.get('id',''))
        if not re.fullmatch('[a-f0-9]{32}',ident): raise ValueError('工作流 ID 无效')
        with LOCK: (self.directory/'workflows'/(ident+'.json')).unlink(missing_ok=True)
        return {'ok':True}

    def groups(self):
        return [r for p in (self.directory/'groups').glob('*.json') if isinstance(r:=read_json(p),dict)]

    def saved_paths(self):
        return {os.path.normcase(os.path.realpath(s['path'])) for g in self.groups() for s in g.get('stages',[]) if s.get('path')}

    def lookup(self, path):
        key=os.path.normcase(os.path.realpath(path))
        for group in self.groups():
            if any(os.path.normcase(os.path.realpath(s.get('path','')))==key for s in group.get('stages',[]) if s.get('path')):
                return self.public(group)
        return None

    def verified_stage(self, path):
        key=os.path.normcase(os.path.realpath(path))
        for g in self.groups():
            for stage in g.get('stages',[]):
                if stage.get('path') and os.path.normcase(os.path.realpath(stage['path']))==key:
                    if Path(path).stat().st_size>256*1024*1024:return None
                    if stage.get('sha256')==hashlib.sha256(Path(path).read_bytes()).hexdigest():return copy.deepcopy(stage)
        return None

    def public(self, group):
        result=copy.deepcopy(group)
        result['stages']=[s for s in result.get('stages',[]) if not s.get('path') or os.path.isfile(s['path'])]
        for s in result['stages']:
            if s.get('path'):s['url']='/outputs/view?path='+self.api.urllib.parse.quote(s['path']) if hasattr(self.api,'urllib') else ''
        return result

    def complete(self, payload):
        pid=str(payload.get('prompt_id') or '')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}',pid): raise ValueError('prompt_id 无效')
        history=self.api._http_json('http://127.0.0.1:%d/history/%s'%(self.api.COMFY_PORT,pid), '', timeout=20)
        entry=history.get(pid) if isinstance(history,dict) else None
        if not entry:raise ValueError('未找到可信生成历史')
        prompt=entry.get('prompt') or []
        graph=prompt[2] if isinstance(prompt,list) and len(prompt)>2 else None
        if not isinstance(graph,dict): raise ValueError('历史工作流无效')
        mode=payload.get('mode','final')
        if mode not in MODES:raise ValueError('未知保存方式')
        retain=payload.get('save') is True
        folder=self.api._normal_path(payload.get('folder','')) if retain else ''
        if retain and (not folder or not os.path.isabs(folder)):raise ValueError('保存目录必须是绝对路径')
        gid=hashlib.sha256(pid.encode()).hexdigest();manifest=self.directory/'groups'/(gid+'.json')
        with LOCK:
            old=read_json(manifest,{}) or {};cached={s.get('node'):s for s in old.get('stages',[])}
            graph_hash=hashlib.sha256(json.dumps(graph,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            if old.get('graphHash') and old['graphHash']!=graph_hash:raise ValueError('任务历史已变化，不能复用原保存记录')
            if old.get('mode') and old['mode']!=mode:raise ValueError('同一任务的保存方式不能在重试时更改')
            stages=[];outputs=entry.get('outputs') or {};complete=entry.get('status',{}).get('status_str')!='error' and bool(outputs.get('9',{}).get('images'))
            tagged=[]
            for node,definition in graph.items():
                meta=definition.get('_meta',{}).get('dsh_post_stage')
                if definition.get('class_type') in ('PreviewImage','DSHPostStage') and isinstance(meta,dict) and meta.get('version')==1 and not meta.get('final'):
                    tagged.append((str(node),meta))
            tagged.sort(key=lambda x:int(x[1].get('index',0)))
            notes={int(meta.get('index',0)):(outputs.get(node,{}) or {}).get('dsh_note',[]) for node,meta in tagged}
            finalmeta=graph.get('9',{}).get('_meta',{}).get('dsh_post_stage',{})
            if complete:
                # The final PreviewImage duplicates the last stage, use its exact output node.
                if tagged and int(tagged[-1][1].get('index',0))==int(finalmeta.get('index',0)):
                    finalmeta={**tagged[-1][1],**finalmeta};tagged.pop()
                tagged.append(('9',{**finalmeta,'label':'最终输出','final':True}))
            if not tagged:raise ValueError('没有可恢复的生成后阶段图片')
            for node,meta in tagged:
                images=outputs.get(node,{}).get('images') or []
                if not images:continue
                if len(images)!=1:raise ValueError('当前生成后控制只支持单张图片输出，请在自定义工作流拆分批次')
                save_this=retain and (mode=='all' or meta.get('final') or mode=='original' and meta.get('index')==0 or not complete)
                if retain and complete and not save_this:continue
                previous=cached.get(node,{})
                valid_previous=bool(previous.get('path') and previous.get('sha256') and os.path.isfile(previous['path']) and Path(previous['path']).stat().st_size<=256*1024*1024 and hashlib.sha256(Path(previous['path']).read_bytes()).hexdigest()==previous['sha256'])
                image=images[0];source=previous['path'] if valid_previous and save_this else self.api._resolve_comfy_image(image)
                w,h=self.api._image_dimensions(source)
                record={'node':node,'index':int(meta.get('index',0)),'label':str(meta.get('label') or '阶段')[:120],
                        'width':w,'height':h,'imageInfo':image,'promptId':pid,'path':'','saved':False,'final':bool(meta.get('final'))}
                note=outputs.get(node,{}).get('dsh_note') or notes.get(record['index'])
                if note:record['note']='；'.join(str(n) for n in note)[:500]
                params=self.api._params_from_api_prompt(graph,output_filename=image.get('filename',''),strict_output=True,output_node_id=node)
                if params:
                    params['postControls']=graph.get('1',{}).get('_meta',{}).get('dsh_post_controls')
                    params['generationInputs']=graph.get('1',{}).get('_meta',{}).get('dsh_generation_inputs',{})
                    params['postStage']={'label':record['label'],'index':record['index'],'control':meta.get('cell')}
                    parent=graph.get(node,{})
                    for _ in range(5):
                        if parent.get('class_type') not in ('PreviewImage','DSHPostStage'):break
                        ref=parent.get('inputs',{}).get('images')
                        parent=graph.get(str(ref[0]),{}) if isinstance(ref,list) and ref else {}
                    if parent.get('class_type')=='FaceDetailer':
                        values=parent.get('inputs',{})
                        for dest,src in [('steps','steps'),('cfg','cfg'),('sampler','sampler_name'),('scheduler','scheduler'),('seed','seed'),('denoise','denoise')]:
                            if src in values:params[dest]=values[src]
                        params['samplerSettings']={key:values[key] for key in ('steps','cfg','sampler_name','scheduler','seed','denoise') if key in values}
                        params['faceDetailer']={key:values.get(key) for key in ('guide_size','max_size','bbox_threshold','feather')}

                    record['params']=params
                if save_this:
                    previous=cached.get(node,{})
                    if valid_previous:record.update({k:previous[k] for k in ('path','filename','source','saved') if k in previous})
                    else:
                        saved=self.api._save_temp_to_custom({'image':image,'folder':folder,'prefix':str(payload.get('prefix') or 'dsh_comfy')+'_'+('final' if meta.get('final') else 'stage'+str(record['index']))})['item']
                        record.update({k:saved[k] for k in ('path','filename','source')});record['saved']=True
                    record['sha256']=hashlib.sha256(Path(record['path']).read_bytes()).hexdigest()
                record['url']=''
                stages.append(record)
                # Checkpoint each durable copy so a save retry never duplicates successful steps.
                if retain:atomic_json(manifest,{'id':gid,'promptId':pid,'stages':stages,'complete':complete,'mode':mode,'graphHash':graph_hash})
            if not stages:raise ValueError('已完成步骤的预览不可用')
            # Do not retain Temp paths in a persistent manifest.
            durable=[s for s in stages if s.get('path')]
            if retain:atomic_json(manifest,{'id':gid,'promptId':pid,'stages':durable,'complete':complete,'mode':mode,'graphHash':graph_hash})
            # Only saved stages are offered for comparison after generation; unsaved temp previews are internal recovery points.
            available=stages if not retain else durable
            chosen=stages[-1]
            return {'ok':True,'groupId':gid,'complete':complete,'stages':available,'item':chosen,'failed':not complete}

class Dependencies:
    def __init__(self, api):
        self.api=api;self.proc=None;self.thread=None;self.lock=threading.RLock();self.log='';self.message='';self.cancelled=False

    def _installer(self):
        import importlib.util
        spec=importlib.util.spec_from_file_location('dsh_post_installer',Path(self.api.HERE)/'install_post_controls.py')
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

    def status(self):
        with self.lock:
            r=self._installer().status(self.api)
            r.update(running=bool(self.thread and self.thread.is_alive()),log=self.log[-12000:])
            if self.message and not (r.get('ready') and r.get('bridge')):r['message']=self.message
            return r

    def install_bridge(self):
        with self.lock:
            if self.thread and self.thread.is_alive():raise ValueError('组件安装正在进行，请稍后重试')
            cfg=self.api.CFG;main=Path(cfg.get('comfyMainDir') or '')
            if not cfg.get('comfyMainDir') or not (main/'main.py').is_file():raise ValueError('未配置有效 ComfyUI，请先设置连接目录')
            custom=main/'custom_nodes';custom.mkdir(parents=True,exist_ok=True)
            if custom.is_symlink():raise ValueError('custom_nodes 是符号链接，请手动安装')
            target=custom/'dsh_post_controls'
            if target.is_symlink():raise ValueError('dsh_post_controls 是符号链接，请手动检查')
            target.mkdir(exist_ok=True)
            dest=target/'__init__.py'
            if dest.is_symlink():raise ValueError('桥接文件是符号链接，请手动检查')
            source=Path(self.api.HERE)/'comfy_nodes/dsh_post_controls/__init__.py'
            if dest.is_file() and dest.read_bytes()!=source.read_bytes():
                shutil.copy2(dest,target/('__init__.py.bak-'+str(__import__('time').time_ns())))
            temp=target/('.dsh-'+uuid.uuid4().hex+'.tmp')
            try:
                shutil.copy2(source,temp);os.replace(temp,dest)
            finally:
                temp.unlink(missing_ok=True)
            self.message='桥接节点已复制，重启 ComfyUI 后生效'
            return self.status()

    def start(self,payload=None):
        installer=self._installer();requested=installer.FACE.selection(payload.get('models') if isinstance(payload,dict) else None) if payload is not None else None
        with self.lock:
            if self.thread and self.thread.is_alive():return self.status()
            state=self.status()
            if state.get('ready') and state.get('bridge') and state.get('bridgeCurrent') and (requested is None or installer.FACE.requested_ready(state,requested)):return state
            models_only=isinstance(payload,dict) and payload.get('modelsOnly') is True
            if not models_only and self.api.COMFY.running():raise ValueError('安装节点前请先关闭 ComfyUI；只安装检测模型可用单元格内按钮，不会终止当前任务')
            self.cancelled=False;self.log='';self.message='正在检查并安装 FaceDetailer…';self.models=requested;self.models_only=models_only
            self.thread=threading.Thread(target=self._run,daemon=True);self.thread.start()
        return self.status()

    def _run(self):
        import subprocess,sys
        cfg=dict(self.api.CFG);proc=None
        try:
            with self.lock:
                if self.cancelled:return
                proc=subprocess.Popen([sys.executable,'-u',str(Path(self.api.HERE)/'install_post_controls.py'),'--runtime']+(['--models-json',json.dumps(self.models)] if getattr(self,'models',None) is not None else [])+(['--models-only'] if getattr(self,'models_only',False) else []),
                    stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',
                    creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0) if os.name=='nt' else 0,start_new_session=os.name!='nt')
                self.proc=proc
            for line in proc.stdout:
                with self.lock:self.log=(self.log+line)[-12000:]
            code=proc.wait()
            with self.lock:self.message='安装已停止，可重试' if self.cancelled else 'FaceDetailer 安装完成，请启动 ComfyUI' if code==0 else '安装未完成，请查看记录并重试'
        except Exception as ex:
            with self.lock:self.message='安装失败：'+str(ex)[:400]
        finally:
            if proc:
                marker=Path(cfg.get('comfyMainDir',''))/'custom_nodes/.dsh-face-install.lock'
                try:
                    if marker.read_text().strip()==str(proc.pid):marker.unlink()
                except OSError:pass
            if proc:
                try:self._installer().cleanup_partials(self.api,getattr(self,'models',None),proc.pid)
                except (OSError,ValueError):pass
            if proc and proc.stdout:proc.stdout.close()
            with self.lock:
                self.proc=None
                if self.cancelled:self.message='安装已停止，可重试'

    def cancel(self):
        import signal,subprocess
        with self.lock:
            if not self.thread or not self.thread.is_alive():return self.status()
            self.cancelled=True;proc=self.proc
            if proc and proc.poll() is None:
                if os.name=='nt':subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
                else:
                    try:os.killpg(proc.pid,signal.SIGTERM)
                    except ProcessLookupError:pass
            self.message='正在停止安装…'
        return self.status()
