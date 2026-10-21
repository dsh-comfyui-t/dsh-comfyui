"""配置读写与出图目录解析。

从 expander.py 拆出（0.5.4）。/config/* 与 /cards/validate 的落地逻辑在这里：
改配置、定位出图目录、把出图另存到用户指定位置。
"""

import json
import os
import shutil
import urllib.error
import urllib.parse
import urllib.request

from sidecar_state import (
    CFG,
    COMFY_PORT,
    COMFY_ROOT,
    CONFIG,
    CONFIG_VERSION,
)
from sidecar_util import (
    _http_json,
    _norm_dir,
)


# ======================================================================
#  HTTP
# ======================================================================
def _output_dirs():
    r"""所有可能的出图目录（config.json 的 comfyRoot 下）。

    本机 ComfyUI 由 D:\paint\start-comfy.ps1 启动，带 --output-directory <root>\out，
    所以真图在 <root>\out；只有面板自己拉起的实例才用 ComfyUI\output 默认目录。
    两个都要认，否则「打开文件所在位置」会报文件不存在。
    """
    if not COMFY_ROOT:
        return []
    cands = []
    extra = CFG.get('outputDir') if isinstance(CFG, dict) else ''
    if extra:
        cands.append(extra)
    cands += [
        os.path.join(COMFY_ROOT, 'out'),
        os.path.join(COMFY_ROOT, 'ComfyUI', 'output'),
    ]
    seen = []
    for c in cands:
        n = os.path.normcase(os.path.normpath(c))
        if n not in seen and os.path.isdir(c):
            seen.append(n)
    return [c for c in cands if os.path.isdir(c)]


def _resolve_output(filename, subfolder):
    """把 (filename, subfolder) 安全地解析成输出目录里的绝对路径。

    只接受输出目录内的文件：filename 强制取 basename，subfolder 同样只取最后一段，
    拼好后再用 realpath 前缀校验一次，任何越狱尝试都直接拒绝。
    """
    roots = _output_dirs()
    if not roots:
        return ('没配置 comfyRoot 或出图目录不存在，不知道出图存在哪', '')
    fn = os.path.basename(str(filename or '').replace('\\', '/'))
    if not fn:
        return ('缺少 filename', '')
    sub = str(subfolder or '').replace('\\', '/').strip('/')
    if sub:
        sub = os.path.basename(sub)
    tried = []
    for root in roots:
        path = os.path.normpath(os.path.join(root, sub, fn))
        base = os.path.normcase(os.path.normpath(root))
        if os.path.normcase(path) != base and not os.path.normcase(path).startswith(base + os.sep):
            return ('路径不在出图目录内', '')
        tried.append(path)
        if os.path.isfile(path):
            return ('', path)
    return ('文件不存在，找过：' + ' | '.join(tried), tried[0])




def _cfg_set(**kw):
    """改 config.json 的若干字段并同步 CFG；返回错误字符串（空 = 成功）"""
    try:
        cfg = {}
        if os.path.exists(CONFIG):
            with open(CONFIG, encoding='utf-8') as f:
                cfg = json.load(f)
        cfg.update(kw)
        try:
            if int(cfg.get('configVersion') or 0) < CONFIG_VERSION:
                cfg['configVersion'] = CONFIG_VERSION
        except Exception:
            cfg['configVersion'] = CONFIG_VERSION
        with open(CONFIG, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=4)
    except Exception as e:
        return '写 config.json 失败: %s' % e
    CFG.update(kw)
    return ''




def _comfy_models(node, field):
    """问 ComfyUI 要某节点的可选模型清单（没启动就返回空列表）。"""
    try:
        d = _http_json('http://127.0.0.1:%d/object_info/%s' % (COMFY_PORT, node), '', timeout=10)
        info = (d or {}).get(node) or {}
        req = ((info.get('input') or {}).get('required') or {})
        val = req.get(field) or []
        names = val[0] if val and isinstance(val[0], list) else []
        return [str(x) for x in names]
    except Exception:
        return []


def _card_validate(body):
    """卡的生命周期自检（schemaVersion 4 起新增的三个自由字段）。

    baseModels  -> 这张卡依赖哪些底模，现在还在不在本机
    training    -> 训练记录（config / 数据清单摘要），用于换机重建
    regression  -> 回归锚（固定 seed + 固定取景的样张），用于迁移验证

    三个字段都走 _cards_write 的"自由合并"，后端不需要白名单；
    这个端点只回答"还能不能用"。
    """
    card = (body or {}).get('card') or {}
    want = [str(x).strip() for x in (card.get('baseModels') or []) if str(x).strip()]
    out = {'ok': True, 'checked': False, 'missingBaseModels': [],
           'presentBaseModels': [], 'notes': []}
    avail = set(_comfy_models('CheckpointLoaderSimple', 'ckpt_name'))
    avail |= set(_comfy_models('UNETLoader', 'unet_name'))
    if not avail:
        out['notes'].append('ComfyUI 未响应或没有模型（可能没启动）：本次未校验底模')
    else:
        out['checked'] = True
        for w in want:
            if w in avail:
                out['presentBaseModels'].append(w)
            else:
                out['missingBaseModels'].append(w)
        if out['missingBaseModels']:
            out['notes'].append('底模不在本机: ' + ', '.join(out['missingBaseModels']))
    if not (card.get('training') or {}):
        out['notes'].append('没有 training 记录：换机器后无法重建这张卡')
    if not (card.get('regression') or {}):
        out['notes'].append('没有 regression 锚：底模升级后无法自动判断是否还成立')
    return out


def _set_output_dir(raw):
    """设置 ComfyUI 的**实际输出目录**（下次启动生效，--output-directory）"""
    ok, err, d = _norm_dir(raw)
    if not ok:
        return (False, err, '')
    err = _cfg_set(outputDir=d)
    if err:
        return (False, err, '')
    return (True, '设为 ' + d + '（需重启 ComfyUI 才生效）', d)


def _save_dir():
    """用户自定义的「出图另存到」路径 = 可选外备份"""
    return (CFG.get('saveDir') or '').strip() if isinstance(CFG, dict) else ''


def _set_save_dir(raw):
    """校验并持久化保存位置；空值 = 清空"""
    if not str(raw or '').strip().strip('"'):
        err = _cfg_set(saveDir='')
        return (False, err, '') if err else (True, '已清空保存位置', '')
    ok, err, d = _norm_dir(raw)
    if not ok:
        return (False, err, '')
    err = _cfg_set(saveDir=d)
    return (False, err, '') if err else (True, '设为 ' + d, d)


def _copy_to_save(filename, subfolder):
    """把某张出图复制到保存位置；同名已存在且内容一致就跳过。"""
    target = _save_dir()
    if not target:
        return (False, '还没有设置保存位置', '')
    if not os.path.isdir(target):
        return (False, '保存位置不存在: ' + target, '')
    err, src = _resolve_output(filename, subfolder)
    if err:
        return (False, err, src)
    dst = os.path.join(target, os.path.basename(src))
    try:
        if os.path.normcase(os.path.abspath(src)) != os.path.normcase(os.path.abspath(dst)):
            import shutil
            shutil.copy2(src, dst)
    except Exception as e:
        return (False, '复制失败: %s' % e, dst)
    return (True, '已存到 ' + dst, dst)
