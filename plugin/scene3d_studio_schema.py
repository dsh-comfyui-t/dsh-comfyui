"""Validation of editable text and per-camera presentation settings."""
import math,re
COLOR=re.compile(r'#[0-9a-fA-F]{6}')
RIPPLE_RING_MIN,RIPPLE_RING_MAX=3,9
def number(value,low,high):return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and low<=value<=high
def text_value(value,overlay=False):
    if not isinstance(value,dict) or not isinstance(value.get('content'),str) or not 1<=len(value['content'])<=256:raise ValueError('文字内容需为1–256字')
    if value.get('font') not in ('sans','serif') or not COLOR.fullmatch(str(value.get('color',''))):raise ValueError('文字字体或颜色无效')
    if overlay:
        for key,low,high in [('size',8,256),('x',0,1),('y',0,1)]:
            if not number(value.get(key),low,high):raise ValueError('镜头文字参数无效')
    else:
        for key,low,high in [('size',.02,10),('depth',0,5)]:
            if not number(value.get(key),low,high):raise ValueError('场景文字尺寸或厚度无效')
        for key in ('receiveShadow','castShadow','followCamera'):
            if not isinstance(value.get(key),bool):raise ValueError('文字阴影或朝向设置无效')
        target=value.get('faceCameraId','')
        if not isinstance(target,str) or len(target)>80 or (target and not re.fullmatch(r'[a-zA-Z0-9_-]+',target)):raise ValueError('文字目标镜头无效')
def camera_settings(settings):
    if not isinstance(settings,dict):raise ValueError('镜头设置无效')
    for key,low,high in [('width',64,4096),('height',64,4096),('fov',10,90),('lightAngle',-180,180),('lightHeight',5,85),('lightPower',0,5)]:
        if key in settings and not number(settings[key],low,high):raise ValueError('镜头设置超出范围')
    for key in ('width','height'):
        if key in settings and (not isinstance(settings[key],int) or isinstance(settings[key],bool)):raise ValueError('截图尺寸必须为整数')
    for key in ('background','clay'):
        if key in settings and not COLOR.fullmatch(str(settings[key])):raise ValueError('镜头颜色无效')
    if 'fisheye' in settings and not number(settings['fisheye'],0,6):raise ValueError('鱼眼强度超出范围')
    if 'frameScale' in settings and not number(settings['frameScale'],.25,1):raise ValueError('截图框显示比例无效')
    if 'frameProjectionScale' in settings and not number(settings['frameProjectionScale'],.001,1000):raise ValueError('取景框投影比例无效')
    if settings.get('mode','view') not in ('view','photo','firstPerson'):raise ValueError('镜头模式无效')
    for key,low,high in [('frameRoll',-180,180),('firstPersonYaw',-180,180),('firstPersonPitch',-89,89)]:
        if key in settings and not number(settings[key],low,high):raise ValueError('镜头旋转角度无效')
    for key in ('orthographic','floor','grid','lockRatio'):
        if key in settings and not isinstance(settings[key],bool):raise ValueError('镜头开关无效')
    filters=settings.get('filter',{})
    if not isinstance(filters,dict) or filters.get('style','none') not in ('none','mono','warm'):raise ValueError('滤镜无效')
    for key,low in [('brightness',.25),('contrast',.25),('saturation',0)]:
        if key in filters and not number(filters[key],low,2):raise ValueError('滤镜参数超出范围')
    texts=settings.get('shotTexts',[])
    if not isinstance(texts,list) or len(texts)>16:raise ValueError('每个镜头最多16段文字')
    for value in texts:text_value(value,True)
def validate_studio(scene):
    environment=scene.get('sceneEnvironment',{})
    if not isinstance(environment,dict):raise ValueError('场景环境无效')
    if 'background' in environment and not COLOR.fullmatch(str(environment['background'])):raise ValueError('场景背景颜色无效')
    lights=scene.get('sceneLights',[])
    if not isinstance(lights,list) or len(lights)>8:raise ValueError('场景最多8个光源')
    light_ids=set()
    for light in lights:
        if not isinstance(light,dict) or not isinstance(light.get('id'),str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}',light['id']) or light['id'] in light_ids:raise ValueError('光源标识无效')
        light_ids.add(light['id'])
        if not isinstance(light.get('name'),str) or len(light['name'])>64:raise ValueError('光源名称无效')
        position=light.get('position')
        if not isinstance(position,list) or len(position)!=3 or not all(number(x,-100,100) for x in position):raise ValueError('光源位置无效')
        if not COLOR.fullmatch(str(light.get('color',''))) or not number(light.get('power'),0,10):raise ValueError('光源颜色或强度无效')
        for key in ('shadow','falloff'):
            if key in light and not isinstance(light[key],bool):raise ValueError('光源开关无效')
        if 'range' in light and not number(light['range'],1,100):raise ValueError('光源范围无效')
    ground=scene.get('groundGrid',{})
    if not isinstance(ground,dict):raise ValueError('地面网格设置无效')
    if ground.get('pattern','square') not in ('square','diamond','hexagon','brick','triangle','dots','mirror'):raise ValueError('网格图案无效')
    if 'size' in ground and not number(ground['size'],.05,20):raise ValueError('网格大小超出范围')
    if 'radius' in ground and not number(ground['radius'],1,10000):raise ValueError('网格范围超出范围')
    for key in ('lineColor','floorColor'):
        if key in ground and not COLOR.fullmatch(str(ground[key])):raise ValueError('地面颜色无效')
    for key in ('visible','capture','transparent','ripples','floorVisible'):
        if key in ground and not isinstance(ground[key],bool):raise ValueError('网格开关无效')
    if 'rippleDensity' in ground and not number(ground['rippleDensity'],.25,32):raise ValueError('涟漪密集度超出范围')
    if 'rippleWidth' in ground and not number(ground['rippleWidth'],.01,2):raise ValueError('涟漪起伏宽度超出范围')
    if 'rippleHeight' in ground and not number(ground['rippleHeight'],.001 if 'rippleDensity' in ground else 0,.5):raise ValueError('涟漪起伏高度超出范围')
    if 'rippleSize' in ground and not number(ground['rippleSize'],.25,100):raise ValueError('涟漪半径超出范围')
    for key,manual in [('autoRipples',False),('manualRipples',True)]:
        rows=ground.get(key,[])
        if not isinstance(rows,list) or len(rows)>16:raise ValueError('涟漪数量超出范围')
        ids=set()
        for row in rows:
            if not isinstance(row,dict) or not isinstance(row.get('id'),str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',row['id']) or row['id'] in ids:raise ValueError('涟漪标识无效')
            ids.add(row['id'])
            if not isinstance(row.get('rings'),int) or isinstance(row['rings'],bool) or not RIPPLE_RING_MIN<=row['rings']<=RIPPLE_RING_MAX:raise ValueError('涟漪圈数超出自然波组范围')
            for axis in ('x','z'):
                if not number(row.get(axis),-10000,10000):raise ValueError('涟漪位置无效')
            if manual:
                if not number(row.get('size'),.25,20):raise ValueError('手动涟漪半径无效')
            else:
                if not isinstance(row.get('objectId'),str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',row['objectId']):raise ValueError('涟漪关联物体无效')
                for axis in ('rx','rz'):
                    if not number(row.get(axis),.025,1000):raise ValueError('接触区域大小无效')
    camera_settings(scene['settings'])
    for shot in scene.get('shots',[]):camera_settings(shot.get('settings',{}))
    shot_ids={shot['id'] for shot in scene.get('shots',[])}
    owners=set()
    for obj in scene['objects']:
        if 'firstPersonBody' in obj and (not isinstance(obj['firstPersonBody'],bool) or obj['model']!='bodykun'):raise ValueError('第一人称素体无效')
        owner=obj.get('firstPersonFor')
        if owner is not None:
            if not obj.get('firstPersonBody') or not isinstance(owner,str) or owner not in shot_ids or owner in owners:raise ValueError('第一人称镜头关联无效')
            owners.add(owner)
        if obj.get('color') is not None and not COLOR.fullmatch(str(obj['color'])):raise ValueError('物体颜色无效')
        if obj.get('model')=='text':text_value(obj.get('text'))
    for shot in scene.get('shots',[]):
        if shot.get('settings',{}).get('mode')=='firstPerson' and shot['id'] not in owners:raise ValueError('第一人称镜头缺少关联素体')

