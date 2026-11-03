"""三类卡的「目录即真相」读写（0.7.60）。

角色卡 / 风格卡 / 词库三处的磁盘目录分别是：
    <cardsDir>            角色卡（config.json 配的）
    dirname(cardsDir)/画风  风格卡
    dirname(cardsDir)/词库  词库

面板里看到的列表在每次同步时**完全重建**自磁盘：目录里删掉文件，面板上那张卡就消失。
反方向（面板里改卡）由 `_dir_write` 写回文件，所以两边不会漂。

一个磁盘文件里可以是一张卡，也可以是数组/信封（`cards` / `styleCards` / `dictCards` 键），
扫描时统一摊平，写回时按 id → name 命中就地更新，不重排别人的顺序。
"""

import json
import os
import shutil
import time

from sidecar_state import CFG
from sidecar_util import _slug

KIND_SUB = {'style': '画风', 'dict': '词库'}
ENV_KEYS = {'cards': ('cards',), 'style': ('styleCards', 'cards'), 'dict': ('dictCards', 'dict', 'cards')}


def _kind_dir(kind='cards'):
    """kind → (规范名, 绝对目录)。风格卡/词库按角色卡目录的同级兄弟目录算。"""
    k = str(kind or 'cards').strip().lower()
    if k in ('role', 'card', 'cards'):
        k = 'cards'
    try:
        cd = str((CFG.get('cardsDir') or '') if isinstance(CFG, dict) else '')
    except Exception:
        cd = ''
    if k == 'cards':
        return 'cards', cd
    sub = KIND_SUB.get(k)
    if not sub or not cd:
        return k, ''
    return k, os.path.join(os.path.dirname(os.path.abspath(cd)), sub)


def _env_of(kind, raw):
    """从磁盘 JSON 取卡片数组 → (env, envkey, list)；认不出来就 (None, None, None)。"""
    keys = ENV_KEYS.get(kind) or ('cards',)
    if isinstance(raw, dict):
        for kk in keys:
            if isinstance(raw.get(kk), list):
                return raw, kk, raw[kk]
        if str(raw.get('name') or raw.get('cn') or '').strip():
            return {keys[0]: [raw]}, keys[0], [raw]
        return None, None, None
    if isinstance(raw, list):
        return {'version': 1, keys[0]: raw}, keys[0], raw
    return None, None, None



def _file_cards(fp, kind):
    """读一个文件 → (env, envkey, list)；读不了返回 (None, None, None)。"""
    if not os.path.isfile(fp):
        return None, None, None
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            raw = json.load(f)
    except Exception:
        return None, None, None
    return _env_of(kind, raw)


def _same_card(c, cid, name):
    """同一张卡判定：双方都有 id 就只认 id（同名不同 id 必须是两张卡、两个文件）。"""
    if not isinstance(c, dict):
        return False
    oid = str(c.get('id') or '').strip()
    if cid and oid:
        return oid == cid
    if cid and not oid:
        return str(c.get('name') or c.get('cn') or '').strip() == name
    return bool(name) and str(c.get('name') or c.get('cn') or '').strip() == name


def _pick_file(d, kind, name, cid, prefer='', ignore_same=False):
    """给这张卡挑一个文件：优先它自己原来的单卡文件，否则 <卡名>.json（重名自动 -2/-3）。

    0.7.78：ignore_same=True 时**同名也不复用** —— 用于「同名但内容不同」，另存一份而不是覆盖。
    """
    if prefer and os.path.isfile(prefer):
        _e, _k, lst = _file_cards(prefer, kind)
        if lst is not None and len(lst) == 1 and _same_card(lst[0], cid, name):
            return os.path.abspath(prefer)
    base = _slug(name) or 'card'
    cand = os.path.join(d, base + '.json')
    n = 2
    while os.path.isfile(cand):
        if not ignore_same:
            _e, _k, lst = _file_cards(cand, kind)
            if lst is not None and len(lst) == 1 and _same_card(lst[0], cid, name):
                break
        cand = os.path.join(d, '%s-%d.json' % (base, n))
        n += 1
    return cand


def _dir_scan(kind='cards'):
    k, d = _kind_dir(kind)
    if not d:
        return {'ok': False, 'kind': k, 'dir': '', 'count': 0, 'cards': [],
                'error': '没有配置角色卡目录（config.json 的 cardsDir）'}
    if not os.path.isdir(d):
        return {'ok': True, 'kind': k, 'dir': d, 'count': 0, 'cards': [], 'missing': True}
    files = []
    for fn in os.listdir(d):
        low = fn.lower()
        if not low.endswith('.json'):
            continue
        if '.bak' in low or low.endswith('.multi.bak') or '.tmp' in low:
            continue
        fp = os.path.join(d, fn)
        try:
            files.append((os.path.getmtime(fp), fp))
        except Exception:
            continue
    files.sort()
    out = []
    for _mt, fp in files:
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except Exception:
            continue
        _env, envkey, lst = _env_of(k, raw)
        if lst is None:
            continue
        for c in lst:
            if not isinstance(c, dict):
                continue
            if not str(c.get('name') or c.get('cn') or '').strip():
                continue
            rec = dict(c)
            rec['__file'] = fp
            rec['__envkey'] = envkey
            if len(lst) > 1:
                rec['__multi'] = True
            out.append(rec)
    return {'ok': True, 'kind': k, 'dir': d, 'count': len(out), 'cards': out}


_KNOWN_KINDS = ('cards', 'style', 'dict', 'role', 'card')


def _kind_ok(kind):
    return str(kind or 'cards').strip().lower() in _KNOWN_KINDS


def _dir_write(body):
    """一张卡 = 一个文件。

    文件名默认 <卡名>.json（重名自动 -2/-3）；卡改名时旧文件被删掉，写进新名字的文件。
    传进来的 path 只在「那个文件里正好就是这一张卡」时才复用——多卡文件不会被就地改写。
    """
    body = body or {}
    if not _kind_ok(body.get('kind')):
        return {'ok': False, 'error': '未知 kind: %s（只支持 cards / style / dict）' % str(body.get('kind'))}
    k, d = _kind_dir(body.get('kind'))
    card = dict(body.get('card') or {})
    if not d:
        return {'ok': False, 'error': '没有配置角色卡目录（config.json 的 cardsDir）'}
    name = str(card.get('name') or card.get('cn') or '').strip()
    if not name:
        return {'ok': False, 'error': '卡缺 name'}
    cid = str(card.get('id') or '').strip()
    d_abs = os.path.abspath(d)
    try:
        os.makedirs(d_abs, exist_ok=True)
    except Exception as e:
        return {'ok': False, 'error': '目录建不出来: %s' % e}
    want = str(body.get('path') or '').strip()
    if want:
        want_abs = os.path.abspath(want)
        try:
            if os.path.commonpath([want_abs, d_abs]) != d_abs:
                return {'ok': False, 'error': 'path 不在 %s 内，拒绝写: %s' % (d, want_abs)}
        except Exception:
            return {'ok': False, 'error': 'path 非法: %s' % want_abs}
    # 0.7.78：同名但内容不同（tags 不一样）且没有指定 path → 另存 -2 文件，返回 conflict 让客户端提示
    conflict = False
    existing_tags = ''
    if not want:
        probe = os.path.join(d_abs, (_slug(name) or 'card') + '.json')
        if os.path.isfile(probe):
            try:
                _e, _k, lst = _file_cards(probe, k)
            except Exception:
                lst = None
            if lst is not None and len(lst) == 1:
                old_tags = str((lst[0] or {}).get('tags') or '').strip()
                new_tags = str(card.get('tags') or '').strip()
                if old_tags != new_tags:
                    conflict = True
                    existing_tags = old_tags[:120]
    fp = _pick_file(d_abs, k, name, cid, want, ignore_same=conflict)
    clean = dict(card)
    for kk in list(clean.keys()):
        if str(kk).startswith('__') or kk in ('builtin', 'file', 'fromDisk', 'diskDir'):
            clean.pop(kk, None)
    if cid:
        clean['id'] = cid
    elif not clean.get('id'):
        clean['id'] = _slug(name)
    env = {'version': 1, 'exportedAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'cards': [clean]}
    if k == 'style':
        env = {'version': 1, 'exportedAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'styleCards': [clean]}
    elif k == 'dict':
        env = {'version': 1, 'exportedAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'dictCards': [clean]}
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
    # 卡改名导致换文件：把旧的那张单卡文件删掉
    old = os.path.abspath(want) if want else ''
    if old and old != os.path.abspath(fp) and os.path.isfile(old):
        _e, _k, lst = _file_cards(old, k)
        if lst is not None and len(lst) == 1 and _same_card(lst[0], cid, name):
            try:
                os.remove(old)
            except Exception:
                pass
    # 卡改名 → 文件名跟着改（目标名已被别的卡占着就不动，避免互相覆盖）
    want_name = os.path.join(d_abs, (_slug(name) or 'card') + '.json')
    if os.path.abspath(fp) != os.path.abspath(want_name) and not os.path.exists(want_name):
        try:
            os.replace(fp, want_name)
            fp = want_name
        except Exception:
            pass
    out = {'ok': True, 'kind': k, 'path': fp, 'count': 1, 'mode': 'single',
           'id': clean.get('id'), 'name': clean.get('name')}
    if conflict:
        out['conflict'] = True
        out['existingTags'] = existing_tags
    return out


def _dir_split(kind='cards'):
    """把历史遗留的多卡文件拆成一张一个文件（原文件留 .multi.bak 备份后删除）。"""
    k, d = _kind_dir(kind)
    if not d or not os.path.isdir(d):
        return {'ok': True, 'kind': k, 'dir': d, 'splitFiles': 0, 'cardsWritten': 0, 'errors': []}
    split_files = 0
    written = 0
    errors = []
    for fn in sorted(os.listdir(d)):
        if not fn.lower().endswith('.json'):
            continue
        fp = os.path.join(d, fn)
        _e, _k, lst = _file_cards(fp, k)
        if lst is None or len(lst) <= 1:
            continue
        try:
            bak = fp + '.multi.bak'
            with open(fp, 'rb') as src, open(bak, 'wb') as dst:
                dst.write(src.read())
        except Exception as e:
            errors.append('%s 备份失败: %s' % (fn, e))
            continue
        okn = 0
        for c in lst:
            if not isinstance(c, dict):
                continue
            r = _dir_write({'kind': k, 'card': c})
            if r.get('ok'):
                okn += 1
                written += 1
            else:
                errors.append('%s: %s' % (fn, r.get('error')))
        if okn == len(lst):
            try:
                os.remove(fp)
                split_files += 1
            except Exception as e:
                errors.append('%s 删不掉: %s' % (fn, e))
    return {'ok': True, 'kind': k, 'dir': d, 'splitFiles': split_files,
            'cardsWritten': written, 'errors': errors}


def _dir_del(body):
    """从磁盘文件里删掉一张卡；删空了就把文件也删掉。"""
    body = body or {}
    if not _kind_ok(body.get('kind')):
        return {'ok': False, 'error': '未知 kind: %s（只支持 cards / style / dict）' % str(body.get('kind'))}
    k, _d = _kind_dir(body.get('kind'))
    fp = str(body.get('path') or '').strip()
    name = str(body.get('name') or '').strip()
    cid = str(body.get('id') or '').strip()
    if not fp:
        return {'ok': False, 'error': '缺 path'}
    fp = os.path.abspath(fp)
    if not os.path.isfile(fp):
        return {'ok': True, 'kind': k, 'path': fp, 'removed': 0, 'deletedFile': False,
                'noop': True, 'note': '文件已经不在了'}
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            raw = json.load(f)
    except Exception as e:
        return {'ok': False, 'error': '读不了: %s' % e}
    env, envkey, lst = _env_of(k, raw)
    if lst is None:
        return {'ok': False, 'error': '这个文件里没有卡片数组'}
    keep = []
    removed = 0
    for c in lst:
        same = False
        if isinstance(c, dict):
            if cid and str(c.get('id') or '').strip() == cid:
                same = True
            elif name and str(c.get('name') or c.get('cn') or '').strip() == name:
                same = True
        if same:
            removed += 1
        else:
            keep.append(c)
    deleted = False
    try:
        if not keep:
            os.remove(fp)
            deleted = True
        else:
            env[envkey] = keep
            tmp = fp + '.tmp'
            with open(tmp, 'w', encoding='utf-8', newline='') as f:
                json.dump(env, f, ensure_ascii=False, indent=2)
            os.replace(tmp, fp)
    except Exception as e:
        return {'ok': False, 'error': '写盘失败: %s' % e}
    return {'ok': True, 'kind': k, 'path': fp, 'removed': removed, 'deletedFile': deleted}


def _dir_clear(body):
    """清空某一类卡目录：整包搬进 本地绘画/_清空备份-<时间戳>/<kind>/ 再返回清单。

    只搬不删——想恢复的人把文件搬回去就行，这也让「清空」可逆。
    """
    body = body or {}
    k, d = _kind_dir(body.get('kind'))
    if not d:
        return {'ok': False, 'error': '没有配置角色卡目录（config.json 的 cardsDir）'}
    d_abs = os.path.abspath(d)
    if not os.path.isdir(d_abs):
        return {'ok': True, 'kind': k, 'dir': d_abs, 'moved': [], 'count': 0, 'note': '目录不存在，没什么可清'}
    base = os.path.dirname(d_abs)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    dest = os.path.join(base, '_清空备份-' + stamp, k)
    moved = []
    failed = []
    try:
        os.makedirs(dest, exist_ok=True)
    except Exception as e:
        return {'ok': False, 'error': '备份目录建不出来: %s' % e}
    for fn in sorted(os.listdir(d_abs)):
        fp = os.path.join(d_abs, fn)
        if not os.path.isfile(fp):
            continue
        try:
            tgt = os.path.join(dest, fn)
            n = 2
            while os.path.exists(tgt):
                stem, ext2 = os.path.splitext(fn)
                tgt = os.path.join(dest, '%s-%d%s' % (stem, n, ext2))
                n += 1
            shutil.move(fp, tgt)
            moved.append(os.path.basename(tgt))
        except Exception as e:
            failed.append('%s: %s' % (fn, e))
    return {'ok': True, 'kind': k, 'dir': d_abs, 'backup': dest,
            'count': len(moved), 'moved': moved, 'failed': failed}
