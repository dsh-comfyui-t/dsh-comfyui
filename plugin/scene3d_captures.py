"""Scene-owned screenshot albums. Raster bytes never enter scene JSON."""
from pathlib import Path
import json,os,uuid,time,shutil
from scene3d_store import ID,LOCK
from reference_images import png_dimensions

class CaptureStore:
    def __init__(self,root,references):
        self.root=Path(root);self.references=references
    def folder(self,scope,owner):
        if scope not in ('scene','draft') or not isinstance(owner,str) or not ID.fullmatch(owner):raise ValueError('截图所属场景无效')
        folder=self.root/('drafts' if scope=='draft' else 'scenes')/owner/'screenshots'
        if not folder.resolve().is_relative_to(self.root.resolve()) or any(p.is_symlink() for p in [folder,*folder.parents] if p!=self.root.parent):raise ValueError('截图路径无效')
        return folder
    def path(self,scope,owner,key,suffix):
        if not isinstance(key,str) or not ID.fullmatch(key):raise ValueError('截图编号无效')
        p=self.folder(scope,owner)/(key+suffix)
        if p.is_symlink():raise ValueError('截图路径无效')
        return p
    def list(self,scope,owner):
        with LOCK:
            folder=self.folder(scope,owner);items=[]
            if folder.exists():
                for p in folder.glob('*.json'):
                    if p.is_symlink() or p.stat().st_size>32768:continue
                    try:items.append(self.read(scope,owner,p.stem))
                    except (ValueError,OSError,KeyError):continue
            return {'items':sorted(items,key=lambda r:r['created'],reverse=True)}
    def read(self,scope,owner,key):
        p=self.path(scope,owner,key,'.json')
        if not p.is_file() or p.stat().st_size>32768:raise ValueError('截图不存在')
        row=json.loads(p.read_text(encoding='utf8'))
        row['url']='/scene3d/captures/image/'+scope+'/'+owner+'/'+key
        return row
    def image(self,scope,owner,key):
        p=self.path(scope,owner,key,'.png')
        if not p.is_file() or p.stat().st_size>32*1024*1024:raise ValueError('截图不存在或过大')
        data=p.read_bytes();png_dimensions(data);return data
    def write(self,scope,owner,row,data=None):
        folder=self.folder(scope,owner);folder.mkdir(parents=True,exist_ok=True)
        if data is not None:
            png_dimensions(data);self._atomic(self.path(scope,owner,row['id'],'.png'),data)
        clean={k:v for k,v in row.items() if k!='url'}
        self._atomic(self.path(scope,owner,row['id'],'.json'),json.dumps(clean,ensure_ascii=False).encode())
        return self.read(scope,owner,row['id'])
    @staticmethod
    def _atomic(path,data):
        temp=path.with_name('.'+uuid.uuid4().hex+'.tmp')
        try:temp.write_bytes(data);os.replace(temp,path)
        finally:temp.unlink(missing_ok=True)
    def create(self,scope,owner,body):
        with LOCK:
            data=self.references.read((body.get('asset') or {}).get('id'));width,height=png_dimensions(data)
            row={'id':uuid.uuid4().hex,'name':str(body.get('name') or '截图')[:128],'created':time.time(),'width':width,'height':height,'shotId':str(body.get('shotId') or '')[:80]}
            return self.write(scope,owner,row,data)
    def delete(self,scope,owner,key):
        with LOCK:
            self.read(scope,owner,key)
            self.path(scope,owner,key,'.json').unlink();self.path(scope,owner,key,'.png').unlink(missing_ok=True)
            return {'ok':True}
    def copy(self,source_scope,source_owner,target_owner):
        with LOCK:
            if source_scope=='scene' and source_owner==target_owner:return self.list('scene',target_owner)
            for row in self.list(source_scope,source_owner)['items']:
                self.write('scene',target_owner,row,self.image(source_scope,source_owner,row['id']))
            return self.list('scene',target_owner)
    def delete_scene(self,owner):
        folder=self.folder('scene',owner).parent
        if folder.exists():shutil.rmtree(folder)
    def clear_draft(self,owner):
        folder=self.folder('draft',owner)
        if folder.exists():shutil.rmtree(folder.parent)
    def apply(self,scope,owner,key):
        return self.references.save(self.image(scope,owner,key))

def handle_capture(store,drafts,scenes,body):
    channel=body.get('channel');draft=drafts.read(channel)
    if not draft.get('active'):raise ValueError('所属组件已结束')
    scene_id=body.get('sceneId') or ''
    if scene_id:scenes.read(scene_id)
    scope,owner=('scene',scene_id) if scene_id else ('draft',channel)
    action=body.get('action');key=body.get('id')
    if action=='clear-draft':
        store.clear_draft(channel);return {'ok':True}
    if action=='list':return {**store.list(scope,owner),'reference':draft.get('referenceCapture')}
    if action=='create':return store.create(scope,owner,body)
    if action=='delete':return store.delete(scope,owner,key)
    if action=='apply':
        asset=store.apply(scope,owner,key)
        reference={'id':key,'scope':scope,'owner':owner}
        drafts.set_reference(channel,reference)
        return {'asset':asset,'reference':reference}
    raise ValueError('未知截图操作')

def save_scene_album(scenes,captures,drafts,body):
    """Prepare cloned albums before publishing a new preset; roll back on failure."""
    from scene3d_store import validate_scene
    validate_scene(body.get('scene'))
    source=body.get('captureSource') or {}
    if not source and body.get('scene',{}).get('albumSession'):
        legacy_channel=body['scene']['albumSession'];legacy_draft=drafts.read(legacy_channel)
        if legacy_draft.get('active'):source={'channel':legacy_channel,'sceneId':legacy_draft.get('presetId') or ''}
    channel=source.get('channel');source_id=source.get('sceneId')
    portable_scene={key:value for key,value in body['scene'].items() if key!='albumSession'}
    body={**body,'scene':portable_scene}
    if channel and not drafts.read(channel).get('active'):raise ValueError('所属组件已结束')
    if source_id:scenes.read(source_id)
    target=body.get('id') or uuid.uuid4().hex;index=scenes.path(target)
    with LOCK:
        previous=index.read_bytes() if index.is_file() else None
        folder=captures.folder('scene',target).parent
        stage=None
        if previous is None:
            if folder.exists():raise ValueError('场景目录已存在，请另存为新场景')
            stage_id='save-'+uuid.uuid4().hex;stage=captures.folder('scene',stage_id).parent;stage.mkdir(parents=True)
            try:
                if channel:captures.copy('scene' if source_id else 'draft',source_id or channel,stage_id)
            except Exception:
                shutil.rmtree(stage);raise
        elif channel and source_id and source_id!=target:
            raise ValueError('不能用其他场景的相册覆盖现有预设，请另存为')
        try:
            row=scenes.save({**body,'id':target})
            if stage:
                captures._atomic(stage/'scene.json',json.dumps(row,ensure_ascii=False).encode());os.replace(stage,folder)
            else:
                folder.mkdir(parents=True,exist_ok=True);captures._atomic(folder/'scene.json',json.dumps(row,ensure_ascii=False).encode())
            return row
        except Exception:
            if previous is None:index.unlink(missing_ok=True)
            else:captures._atomic(index,previous)
            if stage and stage.exists():shutil.rmtree(stage)
            raise
