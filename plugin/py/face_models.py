"""FaceDetailer model roles and conservative file checks; no inference imports."""
from pathlib import Path, PurePosixPath
import json

CATALOG = {
 'bbox': {'name':'bbox/face_yolov8m.pt','folder':'ultralytics','url':'https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8m.pt','min_bytes':100000,'max_bytes':128*1024*1024},
 'sam': {'name':'sam_vit_b_01ec64.pth','folder':'sams','url':'https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth','min_bytes':300*1024*1024,'max_bytes':512*1024*1024},
 'segm': {'name':'segm/person_yolov8n-seg.pt','folder':'ultralytics','url':'https://huggingface.co/Bingsu/adetailer/resolve/main/person_yolov8n-seg.pt','min_bytes':100000,'max_bytes':128*1024*1024},
}

def selection(payload=None):
    if payload is None:return {'bbox':[CATALOG['bbox']['name']], 'sam':[], 'segm':[]}
    if not isinstance(payload,dict) or set(payload)-set(CATALOG):raise ValueError('检测模型选择无效')
    out={}
    for role in CATALOG:
        values=payload.get(role,[])
        if not isinstance(values,list) or len(values)>24:raise ValueError('检测模型列表无效')
        clean=[]
        for name in values:
            if not isinstance(name,str) or not name or len(name)>255 or any(c in name for c in '\\:\x00\r\n') or PurePosixPath(name).is_absolute() or any(p in ('..','.') for p in name.split('/')):raise ValueError('检测模型必须为目录内相对名称')
            if role=='segm' and not name.startswith('segm/'):raise ValueError('SEGM 必须选择 segm/ 分割模型')
            if role=='bbox' and not name.startswith(('bbox/','segm/')):raise ValueError('BBOX 模型分类无效')
            if name not in clean:clean.append(name)
        out[role]=clean
    if not out['bbox']:out['bbox']=[CATALOG['bbox']['name']]
    return out

def options(info,node):
    desc=(info.get(node,{}) or {}).get('input',{}).get('required',{}).get('model_name') or []
    raw=desc[0] if desc and isinstance(desc[0],list) else (desc[1].get('options',[]) if len(desc)>1 and isinstance(desc[1],dict) else [])
    return [v for v in raw if isinstance(v,str) and v and not Path(v).name.lower().startswith('put_')]

def available(info):
    yolo=options(info,'UltralyticsDetectorProvider')
    return {'bbox':[v for v in yolo if v.startswith(('bbox/','segm/'))], 'sam':options(info,'SAMLoader'), 'segm':[v for v in yolo if v.startswith('segm/')]}

def roots(api,role):
    main=Path(api.CFG.get('comfyMainDir') or '/__missing_comfy__');folder=CATALOG[role]['folder'];paths={}
    try:paths=api._path_settings()
    except (AttributeError,ValueError,OSError):pass
    try:
        keys={**api._MODEL_DIR_KEYS,'sams':('sams',),'ultralytics':('ultralytics',),'ultralytics_bbox':('ultralytics_bbox',),'ultralytics_segm':('ultralytics_segm',)}
        paths=api.COMFY_PATHS.resolve(api.COMFY_ROOT,dict(api.CFG),api.LAUNCH_MODES,keys)
    except (AttributeError,ValueError,OSError):pass
    rows=paths.get('modelPaths',[])
    values=[Path(row['path']) for row in reversed(rows) if row.get('kind')==folder and row.get('isDefault') and row.get('path')]
    values.extend([Path(paths.get('modelBase') or main/'models')/folder,main/'models'/folder])
    for row in paths.get('modelPaths',[]):
        if row.get('path') and (row.get('kind') in (folder,'folder:'+folder) or row.get('key')==folder):values.append(Path(row['path']))
    return list(dict.fromkeys(values))

def find(api,role,name):
    for root in roots(api,role):
        path=root.joinpath(*PurePosixPath(name).parts)
        if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()):return path
    if role!='sam':
        prefix,_,relative=name.partition('/')
        try:
            keys={'ultralytics_bbox':('ultralytics_bbox',),'ultralytics_segm':('ultralytics_segm',)}
            paths=api.COMFY_PATHS.resolve(api.COMFY_ROOT,dict(api.CFG),api.LAUNCH_MODES,keys)
        except (AttributeError,ValueError,OSError):paths={}
        for row in paths.get('modelPaths',[]):
            if row.get('kind')!='ultralytics_'+prefix or not row.get('path'):continue
            root=Path(row['path']);path=root.joinpath(*PurePosixPath(relative).parts)
            if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()):return path
    return None

def valid_file(path,minimum=100000,maximum=None):
    path=Path(path)
    if path.is_symlink() or not path.is_file():return False
    size=path.stat().st_size
    if size<minimum or maximum and size>maximum:return False
    with path.open('rb') as stream:head=stream.read(16)
    if head.startswith((b'PK',b'\x80')):return True
    if path.suffix=='.safetensors':
        length=int.from_bytes(head[:8],'little')
        if 0<length<min(size-8,16*1024*1024):
            try:
                with path.open('rb') as stream:stream.read(8);return isinstance(json.loads(stream.read(length)),dict)
            except (ValueError,UnicodeError):pass
    return False

def requested_ready(state,models):
    for role,names in models.items():
        if not names:continue
        record=state.get('models',{}).get(role,{})
        if record.get('default') in names and not record.get('fileExists'):return False
        if not record.get('nodeLoaded') or any(name not in record.get('available',[]) for name in names):return False
    return True
