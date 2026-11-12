"""Grounded pose conversation; provider output is data, never executable code."""
import json,math,re
from urllib.error import HTTPError

SYSTEM='''You are a Chinese-speaking 3D building assistant inside a local 3D editor. Build simple reference scenes on a 1 m grid with 3 m storeys by placing single-cell modules. Return ONLY JSON: {"reply":"简短中文说明","plan":"给用户看的搭建方案","operations":[]}.
Grid: 1 m per cell, 3 m per storey; cell=[x,storey,z] integers; facing is one of n/e/s/w.
Modules (fixed size, one per cell):
- floor, slab: 1x1 floor panels
- wall_3_solid: 3 m wall
- wall_3_window_closed, wall_3_window_open: wall with a window
- wall_3_door_closed, wall_3_door_open, wall_3_doorway: wall with a door / opening
- wall_2_solid: 2 m wall; wall_1_solid: 1 m low wall; fence
- roof_flat, roof_slope: 1x1 roof pieces
- stair_straight: 1x1 stair; pillar: 3 m column
- bed_double: 1.8x2 m double bed; nightstand; wardrobe; desk; chair; lamp; rug: bedroom furniture
Operations (max 48):
1. place: {"type":"place","module":"wall_3_solid","cell":[x,y,z],"facing":"n","color":"#aeb3bc","name":"..."}
2. remove: {"type":"remove","id":"..."}
3. paint: {"type":"paint","id":"...","color":"#aabbcc"}
Walls, windows and doors are wall variants; place the door/window module inside the wall row and face it outward.
A rectangular room: floor modules across the footprint at storey 0, then wall modules on the perimeter cells, replacing a few with door/window modules.
Scale reference: human 1.8 m, door 2 m, window sill 1 m.
Design guidance: interior > building > city > outdoor; hard-surface/planar scenes are easier. Prefer a few coherent modules over many scattered ones.
Reply in concise natural Chinese. Do not mention JSON, ids or internal reasoning.'''

def vector(value,limit):
    return isinstance(value,list) and len(value)==3 and all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) and abs(x)<=limit for x in value)

def validate_scene(value):
    if not isinstance(value,dict) or not isinstance(value.get('objects'),list):raise ValueError('场景数据无效')
    if len(value['objects'])>512:raise ValueError('场景物体过多')
    result={'id':str(value.get('id','scene'))[:80],'name':str(value.get('name',''))[:128],'objects':[],'selectedId':str(value.get('selectedId',''))[:80]}
    ids=set()
    for item in value['objects']:
        if not isinstance(item,dict):raise ValueError('场景物体无效')
        oid=item.get('id')
        if not isinstance(oid,str) or not 1<=len(oid)<=80 or oid in ids:raise ValueError('场景物体编号无效')
        model=item.get('model')
        if not isinstance(model,str) or not 1<=len(model)<=80:raise ValueError('场景物体模型无效')
        if not vector(item.get('position'),10000) or not vector(item.get('rotation'),180) or not vector(item.get('scale'),100):raise ValueError('场景物体变换无效')
        color=item.get('color','')
        if not isinstance(color,str) or (color and not re.fullmatch(r'#[0-9a-fA-F]{6}',color)):raise ValueError('场景物体颜色无效')
        ids.add(oid)
        result['objects'].append({'id':oid,'model':model,'name':str(item.get('name',''))[:128],'position':item['position'],'rotation':item['rotation'],'scale':item['scale'],'color':color,'cell':item.get('cell') if isinstance(item.get('cell'),list) and len(item['cell'])==3 else None,'facing':item.get('facing') if item.get('facing') in ('n','e','s','w') else ''})
    cam=value.get('camera')
    if isinstance(cam,dict) and vector(cam.get('position'),10000) and vector(cam.get('target'),10000):
        result['camera']={'position':cam['position'],'target':cam['target']}
    return result

from scene3d_modules import MODULE_IDS

def validate_operations(value,scene):
    if not isinstance(value,list) or len(value)>256:raise ValueError('AI 场景指令数量无效')
    ids={o['id'] for o in scene['objects']}
    out=[]
    for op in value:
        if not isinstance(op,dict):raise ValueError('AI 场景指令格式无效')
        kind=op.get('type')
        if kind=='place':
            module=op.get('module')
            if not isinstance(module,str) or module not in MODULE_IDS:raise ValueError('AI 使用了不存在的模块')
            cell=op.get('cell')
            if not isinstance(cell,list) or len(cell)!=3 or any(not isinstance(v,int) or isinstance(v,bool) for v in cell) or any(abs(v)>64 for v in cell):raise ValueError('AI 格子坐标无效')
            facing=op.get('facing','n')
            if facing not in ('n','e','s','w'):raise ValueError('AI 朝向无效')
            item={'type':'place','module':module,'cell':cell,'facing':facing}
            if 'color' in op:
                if not isinstance(op['color'],str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',op['color']):raise ValueError('AI 颜色无效')
                item['color']=op['color']
            if 'name' in op:item['name']=str(op['name'])[:64]
            out.append(item)
        elif kind=='remove':
            if op.get('id') not in ids:raise ValueError('AI 指向了不存在的物体')
            out.append({'type':'remove','id':op['id']})
        elif kind=='paint':
            if op.get('id') not in ids:raise ValueError('AI 指向了不存在的物体')
            if not isinstance(op.get('color'),str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',op['color']):raise ValueError('AI 颜色无效')
            out.append({'type':'paint','id':op['id'],'color':op['color']})
        elif kind=='transform':
            if op.get('id') not in ids:raise ValueError('AI 指向了不存在的物体')
            item={'type':'transform','id':op['id']}
            if 'position' in op:
                if not vector(op['position'],10000):raise ValueError('AI 移动位置无效')
                item['position']=op['position']
            if 'rotation' in op:
                if not vector(op['rotation'],180):raise ValueError('AI 旋转角度无效')
                item['rotation']=op['rotation']
            if 'scale' in op:
                if not vector(op['scale'],100) or any(not .05<=abs(v)<=20 for v in op['scale']):raise ValueError('AI 缩放尺寸无效')
                item['scale']=op['scale']
            if not any(k in item for k in ('position','rotation','scale')):raise ValueError('AI 变换为空')
            out.append(item)
        elif kind=='delete':
            if op.get('id') not in ids:raise ValueError('AI 指向了不存在的物体')
            out.append({'type':'delete','id':op['id']})
        elif kind=='place_tile':
            tile=op.get('tile');cell=op.get('cell')
            if tile not in {'floor','wall','door','window','roof','fence','stair','pillar'}:raise ValueError('瓦片类型无效')
            if not isinstance(cell,list) or len(cell)!=3 or any(not isinstance(v,int) or isinstance(v,bool) for v in cell) or any(abs(v)>64 for v in cell):raise ValueError('格子坐标无效')
            item={'type':'place_tile','tile':tile,'cell':cell}
            if 'color' in op:
                if not isinstance(op['color'],str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',op['color']):raise ValueError('瓦片颜色无效')
                item['color']=op['color']
            out.append(item)
        elif kind=='remove_tile':
            cell=op.get('cell')
            if not isinstance(cell,list) or len(cell)!=3 or any(not isinstance(v,int) or isinstance(v,bool) for v in cell) or any(abs(v)>64 for v in cell):raise ValueError('格子坐标无效')
            out.append({'type':'remove_tile','cell':cell})
        elif kind=='paint_tile':
            cell=op.get('cell')
            if not isinstance(cell,list) or len(cell)!=3 or any(not isinstance(v,int) or isinstance(v,bool) for v in cell) or any(abs(v)>64 for v in cell):raise ValueError('格子坐标无效')
            if not isinstance(op.get('color'),str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',op['color']):raise ValueError('瓦片颜色无效')
            out.append({'type':'paint_tile','cell':cell,'color':op['color']})
        elif kind=='clear':out.append({'type':'clear'})
        elif kind=='camera':
            if 'position' in op and not vector(op['position'],10000):raise ValueError('AI 镜头位置无效')
            if 'target' in op and not vector(op['target'],10000):raise ValueError('AI 镜头目标无效')
            out.append({k:op[k] for k in ('type','position','target') if k in op})
        else:raise ValueError('AI 返回了不支持的场景操作')
    return out

def pose_chat(body,routes,http_json,pick_model,progress=None):
    emit=progress or (lambda *a,**k:None)
    if not isinstance(body,dict) or not isinstance(body.get('message'),str) or not 1<=len(body['message'].strip())<=4000:raise ValueError('请填写不超过 4000 字的场景描述')
    scene=validate_scene(body.get('scene'));history=body.get('history',[])
    if not isinstance(history,list):raise ValueError('聊天记录无效')
    messages=[{'role':'system','content':SYSTEM}]
    for item in history[-12:]:
        if isinstance(item,dict) and item.get('role') in ('user','assistant') and isinstance(item.get('content'),str):messages.append({'role':item['role'],'content':item['content'][:4000]})
    messages.append({'role':'user','content':'SCENE:\n'+json.dumps(scene,ensure_ascii=False)+'\nREQUEST:\n'+body['message'].strip()})
    emit('scene','已读取场景与 '+str(len(scene['objects']))+' 个物体')
    last='没有可用的模型连接'
    for route in routes:
        try:
            emit('connect','正在连接 '+str(route.get('name','AI'))[:80])
            model=pick_model(route)
            if not model:continue
            model_label=str(route.get('name','AI'))+' / '+model
            emit('generate','正在生成动作方案',model=model_label)
            response=http_json(route['base']+'/chat/completions',route['key'],{'model':model,'messages':messages,'temperature':.2,'max_tokens':7000},timeout=120)
            raw=response['choices'][0]['message']['content'];match=re.search(r'\{.*\}',raw,re.S);result=json.loads(match.group(0) if match else raw)
            if not isinstance(result,dict) or not isinstance(result.get('reply'),str):raise ValueError('AI 没有返回有效的场景说明')
            plan=result.get('plan','');plan=plan[:800] if isinstance(plan,str) else ''
            emit('validate','正在校验场景方案',plan=plan)
            operations=validate_operations(result.get('operations',[]),scene)
            emit('ready','已校验 '+str(len(operations))+' 项动作')
            return {'reply':result['reply'][:6000],'plan':plan,'operations':operations,'targetId':scene['id'],'model':str(route.get('name',''))+' / '+model}
        except Exception as ex:
            emit('retry','当前连接未完成，检查后续可用模型')
            detail=str(ex)
            if isinstance(ex,HTTPError):
                try:
                    payload=json.loads(ex.read(8192));message=payload.get('error',{}).get('message')
                    if isinstance(message,str):detail+=' — '+message[:500]
                except Exception:pass
            if route.get('key'):detail=detail.replace(route['key'],'[redacted]')
            last=str(route.get('name','model'))+': '+detail[:600]
    raise RuntimeError('AI 场景服务暂不可用：'+last)


def progress_writer(path):
    """Private worker-to-parent status file; never contains credentials or reasoning."""
    if not path:return lambda *a,**k:None
    from pathlib import Path
    import os,time
    file=Path(path);events=[];started=time.monotonic()
    def emit(stage,label,**metadata):
        event={'stage':stage,'label':str(label)[:240],'elapsed':round(time.monotonic()-started,2)}
        for key in ('model','plan'):
            if isinstance(metadata.get(key),str):event[key]=metadata[key][:800 if key=='plan' else 160]
        events.append(event)
        try:
            temp=file.with_suffix('.tmp');temp.write_text(json.dumps({'events':events[-32:]},ensure_ascii=False),encoding='utf8');os.replace(temp,file)
        except OSError:pass
    return emit


class PoseJobs:
    """Expose bounded status for cancellable pose workers without changing other AI jobs."""
    def __init__(self,manager):
        import threading
        self.manager=manager;self.lock=threading.RLock();self.rows={}
    @staticmethod
    def key(value):
        if not isinstance(value,str) or not re.fullmatch(r'pose-[A-Za-z0-9_-]{3,95}',value):raise ValueError('姿势请求编号无效')
        return value
    def _read(self,row):
        from pathlib import Path
        if row.get('path'):
            try:
                file=Path(row['path'])
                if file.stat().st_size<32768:
                    data=json.loads(file.read_text(encoding='utf8'))
                    if isinstance(data.get('events'),list):row['events']=data['events'][-32:]
            except (OSError,ValueError):pass
        return {'events':list(row.get('events',[])),'active':row.get('active',False),'cancelled':row.get('cancelled',False)}
    def status(self,key):
        self.key(key)
        with self.lock:
            row=self.rows.get(key)
            return self._read(row) if row else {'events':[],'active':False,'pending':True}
    def cancel(self,key):
        self.key(key);self.manager.cancel(key)
        with self.lock:
            row=self.rows.get(key)
            if row:row['cancelled']=True
    def run(self,key,body):
        import tempfile,time
        from pathlib import Path
        self.key(key)
        with self.lock:
            now=time.monotonic()
            self.rows={k:v for k,v in self.rows.items() if v.get('active') or now-v['at']<600}
            if key in self.rows:raise ValueError('姿势请求编号已使用')
            if sum(bool(v.get('active')) for v in self.rows.values())>=4:raise ValueError('AI 姿势请求过多，请稍后重试')
            if len(self.rows)>=32:
                oldest=min((k for k in self.rows if not self.rows[k].get('active')),key=lambda k:self.rows[k]['at'],default=None)
                if oldest:self.rows.pop(oldest)
            row={'events':[],'active':True,'at':now};self.rows[key]=row
        try:
            with tempfile.TemporaryDirectory(prefix='dsh-pose-status-') as folder:
                row['path']=str(Path(folder)/'status.json')
                try:
                    result=self.manager.run(key,{'action':'pose','pose':body,'pose_progress':row['path']})
                    with self.lock:result['process']=self._read(row)['events']
                    return result
                finally:
                    with self.lock:self._read(row);row.pop('path',None)
        finally:
            with self.lock:row['active']=False;row['at']=time.monotonic()
