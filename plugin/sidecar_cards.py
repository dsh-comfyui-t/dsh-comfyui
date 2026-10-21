"""dsh-comfyui-console 侧车：角色卡 / 风格卡 / LLLite 资产的读写。

从 expander.py 拆出（0.5.4）。这里只碰"卡文件与它的附属资产"：
读卡、写卡、打包、拆包、把 LLLite 权重和控制图铺到 ComfyUI 的目录里。

注意：卡里的字段是自由格式（`_cards_write` 直接合并未知键），
所以这里不要做字段白名单——新字段应当能原样存下来。
"""

import json
import math
import os
import re
import shutil
import time

from sidecar_state import (
    CFG,
    COMFY_INPUT,
    COMFY_PATCHES,
)
from sidecar_util import (
    _png_size,
    _sha256_file,
    _slug,
)


def _cards_scan(d):
    """扫描角色卡目录：返回里面所有可导入的卡（附带来源文件路径 __file）。"""
    if not d:
        return {'ok': False, 'error': '没有配置角色卡目录（config.json 的 cardsDir，或 /cards?dir=）', 'cards': []}
    if not os.path.isdir(d):
        return {'ok': False, 'error': '目录不存在: %s' % d, 'cards': []}
    out = []
    files = []
    for fn in os.listdir(d):
        if not fn.lower().endswith('.json'):
            continue
        fp = os.path.join(d, fn)
        try:
            files.append((os.path.getmtime(fp), fp))
        except Exception:
            continue
    files.sort()
    for _mt, fp in files:
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except Exception:
            continue
        if isinstance(raw, dict) and isinstance(raw.get('cards'), list):
            lst = raw['cards']
        elif isinstance(raw, list):
            lst = raw
        elif isinstance(raw, dict):
            lst = [raw]
        else:
            continue
        for c in lst:
            if not isinstance(c, dict):
                continue
            if not (c.get('name') or '').strip():
                continue
            if not (str(c.get('tags') or '').strip() or c.get('parts')):
                continue
            c = dict(c)
            c['__file'] = fp
            out.append(c)
    return {'ok': True, 'dir': d, 'count': len(out), 'cards': out}


def _cards_write(body):
    """把一张卡写回它来源的文件：先按 id 匹配，再按 name；都没命中才追加。

    2026-10-20 修：旧版只按 name 匹配，改名后保存会新增一张
    （当时盘上出现过 3 张赫林）；且新卡落盘时 id 被跳过导致丢 id。
    """
    fp = (body or {}).get('path') or ''
    card = dict((body or {}).get('card') or {})
    name = str(card.get('name') or '').strip()
    cid = str(card.get('id') or '').strip()
    if not fp:
        return {'ok': False, 'error': '缺 path'}
    fp = os.path.abspath(fp)
    _cd = os.path.abspath((CFG.get('cardsDir') or '') if isinstance(CFG, dict) else '')
    if not _cd:
        return {'ok': False, 'error': '没有角色卡目录（config.json 的 cardsDir）'}
    try:
        if os.path.commonpath([fp, _cd]) != _cd:
            return {'ok': False, 'error': 'path 不在角色卡目录内，拒绝写: %s' % fp}
    except Exception:
        return {'ok': False, 'error': 'path 非法: %s' % fp}
    if not name:
        return {'ok': False, 'error': '卡缺 name'}
    env = None
    if os.path.isfile(fp):
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except Exception:
            raw = None
        if isinstance(raw, dict) and isinstance(raw.get('cards'), list):
            env = raw
        elif isinstance(raw, list):
            env = {'version': 1, 'cards': raw}
    if env is None:
        env = {'version': 1, 'exportedAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'cards': []}
    lst = env['cards']
    hit, by = -1, ''
    if cid:
        for i, c in enumerate(lst):
            if isinstance(c, dict) and str(c.get('id') or '').strip() == cid:
                hit, by = i, 'id'
                break
    if hit < 0:
        for i, c in enumerate(lst):
            if isinstance(c, dict) and str(c.get('name') or '').strip() == name:
                hit, by = i, 'name'
                break
    base = dict(lst[hit]) if (hit >= 0 and isinstance(lst[hit], dict)) else {}
    clean = dict(base)
    for k, v in card.items():
        if str(k).startswith('__') or k in ('builtin',):
            continue
        clean[k] = v
    if cid:
        clean['id'] = cid
    elif not clean.get('id'):
        clean['id'] = _slug(name)
    if hit >= 0:
        lst[hit] = clean
        mode = 'update'
    else:
        lst.append(clean)
        mode = 'append'
    tmp = fp + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8', newline='') as f:
            json.dump(env, f, ensure_ascii=False, indent=2)
        os.replace(tmp, fp)
    except Exception as e:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass
        return {'ok': False, 'error': '写盘失败: %s' % e}
    return {'ok': True, 'path': fp, 'count': len(lst), 'mode': mode, 'matchedBy': by,
            'id': clean.get('id'), 'name': clean.get('name')}


# ────────────────────────── LLLite 卡级条件（P2） ──────────────────────────
# 卡里 conditioning 与 lora/loraW 同构：选中卡即自动解析出「控制图 + 权重档 + 强度」。
# 四种状态：resolved 可渲染 / degraded 缺件降级 / blocked 校验失败 / off 未启用。
# 原则：宁可吵，不许哑——任何缺件都必须带 reason 回给面板。

def _lllite_root(d=None):
    if d:
        return d
    return (CFG.get('cardsDir') or '') if isinstance(CFG, dict) else ''




def _lllite_tables(d=None):
    root = _lllite_root(d)
    out = {'ok': True, 'dir': root, 'weights': {}, 'assets': {}}
    if not root:
        out.update({'ok': False, 'error': '没有角色卡目录（config.json 的 cardsDir）'})
        return out
    try:
        with open(os.path.join(root, 'lllite-index.json'), 'r', encoding='utf-8') as f:
            out['weights'] = json.load(f) or {}
    except Exception as e:
        out['weights_error'] = str(e)
    try:
        with open(os.path.join(root, '_cond', 'assets.json'), 'r', encoding='utf-8') as f:
            out['assets'] = json.load(f) or {}
    except Exception as e:
        out['assets_error'] = str(e)
    return out


def _cards_import(body):
    """导入自包含卡：把 conditioning.presets[*].image.b64 落成 _cond/*.png 并写回 assets.json。"""
    import base64
    root = _lllite_root(body.get('dir'))
    if not root:
        return {'ok': False, 'error': '没有角色卡目录（config.json 的 cardsDir）'}
    card = body.get('card') or {}
    cond = card.get('conditioning') or {}
    presets = cond.get('presets') or {}
    cdir = os.path.join(root, '_cond')
    os.makedirs(cdir, exist_ok=True)
    ap = os.path.join(cdir, 'assets.json')
    if os.path.exists(ap):
        try:
            assets = json.load(open(ap, encoding='utf-8')) or {}
        except Exception as e:
            return {'ok': False, 'error': 'assets.json 损坏，已中止以免覆盖: %s' % e}
    else:
        assets = {}
    done, skipped, bad = [], [], []
    for pid, pr in presets.items():
        im = (pr or {}).get('image') or {}
        b64 = str(im.get('b64') or '')
        aid = str((pr or {}).get('asset') or '')
        if not b64 or not aid:
            continue
        try:
            raw = base64.b64decode(b64)
        except Exception as e:
            bad.append({'preset': pid, 'reason': 'base64 解码失败: %s' % e})
            continue
        nm = os.path.basename(str(im.get('name') or '')) or (os.path.splitext(os.path.basename(aid))[0] + '.png')
        if not nm.lower().endswith('.png'):
            nm += '.png'
        dst = os.path.join(cdir, nm)
        want = str(im.get('sha256') or '').lower()
        if os.path.isfile(dst) and (not want or _sha256_file(dst) == want):
            skipped.append(nm)
        else:
            with open(dst, 'wb') as fh:
                fh.write(raw)
            got = _sha256_file(dst)
            if want and got != want:
                bad.append({'preset': pid, 'reason': '控制图 sha 不符: %s != %s' % (got[:12], want[:12])})
                continue
            done.append(nm)
        with open(dst, 'rb') as _fh:
            w, h = _png_size(_fh.read())
        assets[aid] = {'file': '_cond/' + nm, 'sha256': _sha256_file(dst), 'w': w, 'h': h,
                       'framing': str((pr or {}).get('framing') or ''), 'source': '卡内嵌入'}
    with open(ap, 'w', encoding='utf-8', newline='') as fh:
        json.dump(assets, fh, ensure_ascii=False, indent=2)
    return {'ok': True, 'written': done, 'skipped': skipped, 'bad': bad,
            'weights': sorted((cond.get('weights') or {}).keys()), 'dir': root}


def _cards_selfcontained(body):
    """把一张卡变成自包含形式：控制图嵌成 base64、权重清单嵌进 conditioning.weights。"""
    import base64
    root = _lllite_root(body.get('dir'))
    if not root:
        return {'ok': False, 'error': '没有角色卡目录（config.json 的 cardsDir）'}
    card = dict(body.get('card') or {})
    cond = dict(card.get('conditioning') or {})
    presets = dict(cond.get('presets') or {})
    tables = _lllite_tables(root)
    assets = tables.get('assets') or {}
    weights = tables.get('weights') or {}
    used, imgs, miss = {}, [], []
    for pid, pr in list(presets.items()):
        pr = dict(pr or {})
        wk = str(pr.get('weights') or '')
        if wk and isinstance(weights.get(wk), dict):
            w = weights[wk]
            used[wk] = {'name': os.path.basename(str(w.get('file') or '')),
                        'sha256': str(w.get('sha256') or ''),
                        'bytes': int(w.get('bytes') or 0)}
        elif wk:
            miss.append('权重档不在表里: %s' % wk)
        aid = str(pr.get('asset') or '')
        a = assets.get(aid) or {}
        fp = ''
        if a.get('file'):
            fp = os.path.join(root, str(a['file']).replace('/', os.sep))
        if not (fp and os.path.isfile(fp)):
            fp = os.path.join(root, '_cond', os.path.splitext(os.path.basename(aid))[0] + '.png')
        if fp and os.path.isfile(fp):
            raw = open(fp, 'rb').read()
            pr['image'] = {'name': os.path.basename(fp),
                           'b64': base64.b64encode(raw).decode('ascii'),
                           'sha256': _sha256_file(fp),
                           'w': a.get('w'), 'h': a.get('h')}
            imgs.append(pid)
        elif aid:
            miss.append('控制图缺失: %s' % aid)
        presets[pid] = pr
    cond['presets'] = presets
    if used:
        cond['weights'] = used
    card['conditioning'] = cond
    card['schemaVersion'] = 3
    for k in ('file', '__file'):
        card.pop(k, None)
    blob = json.dumps(card, ensure_ascii=False).encode('utf-8')
    return {'ok': True, 'card': card, 'weights': sorted(used.keys()), 'images': imgs,
            'missing': miss, 'bytes': len(blob)}



def _stage_control_image(root, asset):
    """控制图 → ComfyUI input/dsh_lllite/<name>.png，返回 LoadImage 认的相对路径。"""
    src = asset.get('file') or ''
    if not os.path.isabs(src):
        src = os.path.join(root, src)
    if not os.path.exists(src):
        raise RuntimeError('控制图不存在: %s' % src)
    dst_dir = os.path.join(COMFY_INPUT, 'dsh_lllite')
    os.makedirs(dst_dir, exist_ok=True)
    name = os.path.basename(src)
    dst = os.path.join(dst_dir, name)
    want = _sha256_file(src)
    if not os.path.exists(dst) or _sha256_file(dst) != want:
        shutil.copyfile(src, dst)
    return 'dsh_lllite/' + name


def _stage_lllite_weights(root, key, rec):
    """LLLite 权重 → ComfyUI models/model_patches/julin-lllite-<key>.safetensors。"""
    src = rec.get('file') or ''
    if not os.path.isabs(src):
        src = os.path.join(root, src)
    if not os.path.exists(src):
        raise RuntimeError('权重不存在: %s' % src)
    os.makedirs(COMFY_PATCHES, exist_ok=True)
    safe = re.sub(r'[^A-Za-z0-9._-]', '_', key)
    name = 'julin-lllite-%s.safetensors' % safe
    dst = os.path.join(COMFY_PATCHES, name)
    if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(src):
        shutil.copyfile(src, dst)
    return name




def _lllite_asset_add(body):
    import base64
    root = _lllite_root(body.get('dir'))
    if not root:
        return {'ok': False, 'error': '没有角色卡目录（config.json 的 cardsDir）'}
    name = re.sub(r'[^A-Za-z0-9._-]', '_', str(body.get('name') or 'control')) or 'control'
    if not name.lower().endswith('.png'):
        name += '.png'
    raw = body.get('b64') or ''
    try:
        data = base64.b64decode(raw, validate=True)
    except Exception as e:
        return {'ok': False, 'error': 'base64 解码失败: %s' % e}
    w, h = _png_size(data)
    if not w or not h:
        return {'ok': False, 'error': '不是有效的 PNG（只收 PNG 线条稿/参考图）'}
    dst_dir = os.path.join(root, '_cond')
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, name)
    with open(dst, 'wb') as fh:
        fh.write(data)
    aid = 'cond/' + os.path.splitext(name)[0]
    ap = os.path.join(root, '_cond', 'assets.json')
    if os.path.exists(ap):
        try:
            assets = json.load(open(ap, encoding='utf-8')) or {}
        except Exception as e:
            return {'ok': False, 'error': 'assets.json 损坏，已中止以免覆盖: %s' % e}
    else:
        assets = {}
    assets[aid] = {'file': '_cond/' + name, 'sha256': _sha256_file(dst), 'w': w, 'h': h,
                   'framing': str(body.get('framing') or 'closeup'), 'source': '面板导入'}
    with open(ap, 'w', encoding='utf-8', newline='') as fh:
        json.dump(assets, fh, ensure_ascii=False, indent=2)
    return {'ok': True, 'asset': aid, 'w': w, 'h': h, 'ratio': round(w / float(h), 3),
            'sha256': assets[aid]['sha256']}


def _lllite_resolve(body):
    body = body or {}
    root = _lllite_root(body.get('dir'))
    card = body.get('card') or {}
    cond = card.get('conditioning') or {}
    if not cond or not cond.get('enabled'):
        return {'ok': True, 'status': 'off', 'reason': '卡未启用 conditioning'}
    cv = body.get('canvas') or [1024, 1504]
    try:
        cw, ch = float(cv[0]), float(cv[1])
    except Exception:
        cw, ch = 1024.0, 1504.0
    name = str(body.get('framing') or cond.get('default') or '')
    presets = cond.get('presets') or {}
    if name not in presets:
        return {'ok': True, 'status': 'degraded', 'preset': name,
                'reason': '档位不存在: %s' % name}
    tables = _lllite_tables(root)
    assets = tables.get('assets') or {}
    weights = tables.get('weights') or {}
    # 2026-10-20 自包含卡（schemaVersion 3）：卡里带的权重清单与图元优先，lllite-index/assets.json 只作回退
    _cw = cond.get('weights') or {}
    if isinstance(_cw, dict):
        for _k, _v in _cw.items():
            if not isinstance(_v, dict):
                continue
            _nm = os.path.basename(str(_v.get('name') or ''))
            if not _nm:
                continue
            _cur = dict(weights.get(_k) or {})
            _pf2 = os.path.join(COMFY_PATCHES, _nm)
            _cur.update({'file': (_pf2 if os.path.isfile(_pf2) else (str(_cur.get('file') or '') or _pf2)),
                         'sha256': str(_v.get('sha256') or _cur.get('sha256') or ''),
                         'bytes': int(_v.get('bytes') or _cur.get('bytes') or 0),
                         'source': '\u5361\u5185\u6e05\u5355'})
            weights[_k] = _cur
    for _pid, _pr in presets.items():
        _im = (_pr or {}).get('image') or {}
        if not isinstance(_im, dict):
            continue
        _aid = str((_pr or {}).get('asset') or '')
        if not _aid:
            continue
        _cur = dict(assets.get(_aid) or {})
        _fn = os.path.basename(str(_im.get('name') or '')) or (os.path.splitext(os.path.basename(_aid))[0] + '.png')
        _cur.update({'file': '_cond/' + _fn,
                     'sha256': str(_im.get('sha256') or _cur.get('sha256') or ''),
                     'w': _im.get('w') or _cur.get('w'), 'h': _im.get('h') or _cur.get('h')})
        assets[_aid] = _cur
    ratio = (cw / ch) if ch else 0.0

    # 相称判定以「控制图自己的比例」为准：画布比例 / 控制图比例 落在 0.80–1.25 即视为相称。
    # 不相称不是硬拦——先在所有档位里找一张相称的控制图自动顶替，并如实说明换了哪一档。
    def _ar(pid):
        pr = presets.get(pid) or {}
        a = assets.get(str(pr.get('asset') or '')) or {}
        try:
            w_, h_ = float(a.get('w')), float(a.get('h'))
            return (w_ / h_) if h_ else 0.0
        except Exception:
            return 0.0

    def _fits(r):
        return bool(r) and ratio > 0 and 0.80 <= (ratio / r) <= 1.25

    auto_note = ''
    if not _fits(_ar(name)):
        cands = [k for k in presets if _fits(_ar(k))]
        if cands:
            best = sorted(cands, key=lambda k: abs(math.log(_ar(k) / ratio)))[0]
            auto_note = ('画布比例 %.2f 与「%s」档控制图(比例 %.2f)不相称，已自动改用「%s」档(比例 %.2f)'
                         % (ratio, name, _ar(name), best, _ar(best)))
            name = best
        else:
            return {'ok': True, 'status': 'degraded', 'preset': name,
                    'reason': '画布比例 %.2f 与现有控制图都不相称（%s）；换画布，或按该比例补一张控制图'
                              % (ratio, '、'.join('%s=%.2f' % (k, _ar(k)) for k in presets))}
    p = presets.get(name) or {}
    want = str(p.get('framing') or name)
    aid = str(p.get('asset') or '')
    a = assets.get(aid)
    if not a:
        return {'ok': True, 'status': 'degraded', 'preset': name,
                'reason': '控制图资产缺失: %s' % (aid or '(未指定)')}
    ctrl = os.path.join(root, str(a.get('file') or ''))
    if not os.path.isfile(ctrl):
        return {'ok': True, 'status': 'degraded', 'preset': name,
                'reason': '控制图文件不存在: %s' % ctrl}
    if body.get('verify', True) and a.get('sha256'):
        try:
            if _sha256_file(ctrl).lower() != str(a.get('sha256') or '').strip().lower():
                return {'ok': True, 'status': 'blocked', 'preset': name,
                        'reason': '控制图 sha256 不匹配（拿错图或被改过）: %s' % os.path.basename(ctrl)}
        except Exception as e:
            return {'ok': True, 'status': 'degraded', 'preset': name, 'reason': '控制图读取失败: %s' % e}
    wk = str(p.get('weights') or '')
    w = weights.get(wk)
    if not w:
        return {'ok': True, 'status': 'degraded', 'preset': name,
                'reason': '权重档不存在: %s' % (wk or '(未指定)')}
    wf = str(w.get('file') or '')
    if not os.path.isfile(wf):
        return {'ok': True, 'status': 'degraded', 'preset': name,
                'reason': '权重文件不存在: %s' % wf}
    if body.get('verify', True) and w.get('sha256'):
        try:
            if _sha256_file(wf).lower() != str(w.get('sha256') or '').strip().lower():
                return {'ok': True, 'status': 'blocked', 'preset': name,
                        'reason': '权重 sha256 不匹配: %s' % os.path.basename(wf)}
        except Exception as e:
            return {'ok': True, 'status': 'degraded', 'preset': name, 'reason': '权重读取失败: %s' % e}
    return {'ok': True, 'status': 'resolved', 'preset': name, 'framing': want, 'asset': str(p.get('asset') or ''),
            'control_image': ctrl, 'weights': wf, 'weights_key': wk,
            'strength': float(p.get('strength') or 1.0),
            'canvas_ratio': round(ratio, 3), 'asset_ratio': round(_ar(name), 3),
            'autoPicked': bool(auto_note), 'note': auto_note or '',
            'prompt_add': str(p.get('promptAdd') or ''), 'neg_add': str(p.get('negAdd') or ''),
            'preprocess': p.get('preprocess') or {}, 'reason': 'ok'}
