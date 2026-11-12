"""Local scene documents; raster bytes remain in reference_images."""
from pathlib import Path
import base64,binascii,json,math,os,re,threading,uuid,time

LOCK=threading.RLock()
ID=re.compile(r'[a-zA-Z0-9_-]{1,80}')
from scene3d_modules import MODULE_IDS as BUILDING_IDS
MODULE_IDS=BUILDING_IDS|{'wall_line','floor_area','roof_area','tile'}
MODELS={'bodykun','bodychan','doll-male','doll-female','skeleton','deepseek-chan','base-study-female','base-study-male','base-study-female-rigged','base-study-male-rigged','box','sphere','cylinder','cone','plane','torus','text'}|MODULE_IDS

def validate_scene(scene):
    if not isinstance(scene,dict) or scene.get('version')!=1:raise ValueError('场景版本无效')
    raw=json.dumps(scene,ensure_ascii=False,allow_nan=False)
    if len(raw.encode())>1024*1024:raise ValueError('场景超过1 MiB')
    objects=scene.get('objects')
    if not isinstance(objects,list) or len(objects)>512:raise ValueError('场景最多512个物体')
    seen=set()
    def vector(v,n,limit):
        return isinstance(v,list) and len(v)==n and all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) and abs(x)<=limit for x in v)
    for item in objects:
        if not isinstance(item,dict) or item.get('model') not in MODELS:raise ValueError('场景包含未知模型')
        key=item.get('id','')
        if not isinstance(key,str) or not ID.fullmatch(key) or key in seen:raise ValueError('物体编号无效')
        seen.add(key)
        for field,n,limit in [('position',3,10000),('quaternion',4,1.001),('scale',3,100)]:
            if not vector(item.get(field),n,limit):raise ValueError('物体变换无效')
        shape=item.get('bodyShape')
        if shape is not None:
            from scene3d_body_schema import validate_body_shape
            validate_body_shape(shape,item['model'])
        bones=item.get('bones',{})
        if not isinstance(bones,dict) or len(bones)>1000 or any(not isinstance(k,str) or len(k)>256 or not vector(v,4,1.001) for k,v in bones.items()):raise ValueError('姿势数据无效')
    camera=scene.get('camera',{})
    if not vector(camera.get('position'),3,10000) or not vector(camera.get('target'),3,10000):raise ValueError('镜头数据无效')
    settings=scene.get('settings',{})
    for field,low,high in [('fov',10,90),('lightAngle',-180,180),('lightHeight',5,85),('lightPower',0,5)]:
        value=settings.get(field)
        if not isinstance(value,(int,float)) or isinstance(value,bool) or not math.isfinite(value) or not low<=value<=high:raise ValueError('镜头或灯光参数无效')
    for field in ('background','clay'):
        if not isinstance(settings.get(field),str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',settings[field]):raise ValueError('场景颜色无效')
    zoom=camera.get('zoom',1)
    if not isinstance(zoom,(int,float)) or not math.isfinite(zoom) or not .01<=zoom<=100:raise ValueError('镜头缩放无效')
    for key in ('width','height'):
        v=settings.get(key)
        if not isinstance(v,int) or not 64<=v<=4096:raise ValueError('截图尺寸需为64–4096')
    if settings['width']*settings['height']>16*1024*1024:raise ValueError('截图超过16MP')
    shots=scene.get('shots')
    if shots is not None:
        if not isinstance(shots,list) or not 1<=len(shots)<=4:raise ValueError('镜头数量需在1–4之间')
        shot_ids=set()
        for shot in shots:
            if not isinstance(shot,dict):raise ValueError('镜头数据无效')
            sid=shot.get('id','')
            if not isinstance(sid,str) or not ID.fullmatch(sid) or sid in shot_ids:raise ValueError('镜头编号无效')
            shot_ids.add(sid)
            if not isinstance(shot.get('name'),str) or len(shot['name'])>64:raise ValueError('镜头名称无效')
            cam=shot.get('camera')
            if not isinstance(cam,dict) or not vector(cam.get('position'),3,10000) or not vector(cam.get('target'),3,10000):raise ValueError('镜头数据无效')
            z=cam.get('zoom',1)
            if not isinstance(z,(int,float)) or isinstance(z,bool) or not math.isfinite(z) or not .01<=z<=100:raise ValueError('镜头缩放无效')
            for key in ('width','height'):
                v=shot.get(key)
                if not isinstance(v,int) or not 64<=v<=4096:raise ValueError('镜头截图尺寸需为64–4096')
            if shot['width']*shot['height']>16*1024*1024:raise ValueError('镜头截图超过16MP')
        active=scene.get('activeShot',0)
        if not isinstance(active,int) or isinstance(active,bool) or not 0<=active<len(shots):raise ValueError('当前镜头无效')
    from scene3d_studio_schema import validate_studio
    validate_studio(scene)
    return json.loads(raw)

class SceneStore:
    def __init__(self,root):self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
    def path(self,key):
        if not isinstance(key,str) or not ID.fullmatch(key):raise ValueError('场景编号无效')
        path=self.root/(key+'.json')
        if path.is_symlink() or not path.resolve().is_relative_to(self.root.resolve()):raise ValueError('场景路径无效')
        return path
    def cover_path(self,key):
        self.path(key)  # identical ID and path traversal checks as the scene document
        path=self.root/'covers'/(key+'.jpg')
        if path.is_symlink() or not path.resolve().is_relative_to(self.root.resolve()):raise ValueError('场景封面路径无效')
        return path
    @staticmethod
    def decode_cover(value):
        if value is None:return None
        if not isinstance(value,str) or not value.startswith('data:image/jpeg;base64,') or len(value)>550000:raise ValueError('场景封面必须是小尺寸 JPEG 截图')
        try:data=base64.b64decode(value.split(',',1)[1],validate=True)
        except (binascii.Error,ValueError):raise ValueError('场景封面编码无效')
        if len(data)<4 or len(data)>400000 or not data.startswith(b'\xff\xd8\xff') or not data.endswith(b'\xff\xd9'):raise ValueError('场景封面图片无效或过大')
        return data
    def cover(self,key):
        with LOCK:
            path=self.cover_path(key)
            if not self.path(key).is_file() or not path.is_file() or path.stat().st_size>400000:raise ValueError('场景封面不存在')
            return path.read_bytes()
    def delete_cover(self,key):
        with LOCK:self.cover_path(key).unlink(missing_ok=True)
    def list(self):
        rows=[]
        with LOCK:
            for p in self.root.glob('*.json'):
                if p.is_symlink():continue
                try:
                    r=self.read(p.stem);rows.append({**{k:r[k] for k in ('id','name','updated','preset')},'hasCover':self.cover_path(r['id']).is_file()})
                except (ValueError,OSError,KeyError):continue
        return {'items':sorted(rows,key=lambda r:r['updated'],reverse=True)}
    def read(self,key):
        with LOCK:
            p=self.path(key)
            if not p.is_file() or p.stat().st_size>16*1024*1024:raise ValueError('场景不存在或过大')
            r=json.loads(p.read_text(encoding='utf8'));validate_scene(r['scene']);return r
    def save(self,body):
        scene=validate_scene(body.get('scene'));cover=self.decode_cover(body.get('cover'));key=body.get('id') or uuid.uuid4().hex;p=self.path(key)
        name=str(body.get('name') or '未命名场景').strip()[:128] or '未命名场景'
        with LOCK:
            row={'id':key,'name':name,'preset':bool(body.get('preset')),'updated':time.time(),'scene':scene}
            tmp=p.with_name('.'+uuid.uuid4().hex+'.tmp')
            dest=self.cover_path(key) if cover is not None else None
            cover_tmp=dest.with_name('.'+uuid.uuid4().hex+'.tmp') if dest else None
            old_cover=dest.read_bytes() if dest and dest.is_file() else None
            cover_committed=False
            try:
                tmp.write_text(json.dumps(row,ensure_ascii=False,allow_nan=False),encoding='utf8')
                if dest:
                    dest.parent.mkdir(exist_ok=True)
                    cover_tmp.write_bytes(cover)
                    os.replace(cover_tmp,dest);cover_committed=True
                try:os.replace(tmp,p)
                except BaseException:
                    if cover_committed:
                        if old_cover is None:dest.unlink(missing_ok=True)
                        else:
                            cover_tmp.write_bytes(old_cover);os.replace(cover_tmp,dest)
                    raise
            finally:
                tmp.unlink(missing_ok=True)
                if cover_tmp:cover_tmp.unlink(missing_ok=True)
        return row
