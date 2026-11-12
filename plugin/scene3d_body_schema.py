"""Versioned, bounded mannequin proportions; old scenes omit bodyShape."""
import math

def body_ranges(model):
    if model not in ('bodykun','bodychan'):return {}
    limits={
        **{key:(.65,1.4) for key in ('headSize','headWidth','headHeight','headDepth')},
        'chestWidth':(.7,1.4),'chestDepth':(.7,1.4),'chestLength':(.75,1.3),
        'waistWidth':(.65,1.4),'waistDepth':(.65,1.4),'waistLength':(.75,1.3),
        'hipWidth':(.7,1.4),'hipDepth':(.7,1.4),
    }
    for part in ('upperArm','forearm','thigh','calf'):
        for side in ('L','R'):
            limits[part+'Length'+side]=(.7,1.3)
            limits[part+'Thickness'+side]=(.65,1.4)
    for part in ('handSize','footSize'):
        for side in ('L','R'):limits[part+side]=(.6,1.5)
    if model=='bodychan':limits.update(breastSize=(.5,1.6),gluteSize=(.5,1.6))
    return limits

def validate_body_shape(shape,model):
    limits=body_ranges(model)
    if not limits or not isinstance(shape,dict) or type(shape.get('version')) is not int or shape['version']!=1:
        raise ValueError('体型数据版本或模型无效')
    if type(shape.get('linked',True)) is not bool:raise ValueError('体型左右同步设置无效')
    values=shape.get('values')
    if not isinstance(values,dict) or len(values)>len(limits):raise ValueError('体型参数无效')
    for key,value in values.items():
        if key not in limits or type(value) not in (float,int) or not math.isfinite(value) or not limits[key][0]<=value<=limits[key][1]:
            raise ValueError('体型参数超出允许范围：'+str(key)[:80])
