"""dsh-comfyui-console 侧车：卡包（.dslcard / 卡包 zip）的打包与拆包。

从 expander.py 拆出（0.5.4）。一条卡包 = 一张卡 + 它依赖的 LoRA / 底模 / LLLite 权重。

格式约定（别改，改了就与旧包不兼容）：
  PACK_MAGIC   包内索引文件头
  BASE_MODEL   底模期望的文件名表
  CORE_EMBED   必备 embedding
"""

import base64
import hashlib
import io as _io
import json
import os
import re
import shutil
import struct
import sys
import time
import zipfile

from sidecar_state import (
    COMFY_PATCHES,
    COMFY_ROOT,
)
from sidecar_cards import _lllite_root
from sidecar_util import (
    _dl_to,
    _png_size,
    _scan_loras,
    _sha256_file,
    _slug,
)


PACK_MAGIC = b'DSLCARD2\n'


def _loras_dir():
    for rel in (('ComfyUI', 'models', 'loras'), ('models', 'loras')):
        d = os.path.join(COMFY_ROOT, *rel)
        if os.path.isdir(d):
            return d
    return os.path.join(COMFY_ROOT, 'models', 'loras')


def _pack_root():
    return os.path.join(_loras_dir(), '_dshcards')




CORE_EMBED = ['julinst-e10']
BASE_MODEL = {'unet': 'anima-aesthetic-v1.1.safetensors',
              'clip': 'qwen_3_06b_base.safetensors',
              'vae': 'qwen_image_vae.safetensors'}
_SHA_CACHE = {}


def _sha_cached(p):
    try:
        st = os.stat(p)
        key = (p, st.st_size, int(st.st_mtime))
        if key in _SHA_CACHE:
            return _SHA_CACHE[key]
        v = _sha256_file(p)
        _SHA_CACHE[key] = v
        return v
    except Exception:
        return ''


def _pack_sources():
    fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lora来源.json')
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _resolve_path(root, name, prefer_dir=''):
    """把卡里的 lora 名解析成真实路径：优先卡自己的 _dshcards/<卡Id>/ 副本，
    其次全局同名，最后任意子目录（递归）。这样重新导出不会误用/漏找内嵌副本。"""
    base = os.path.basename(str(name or ''))
    if not base:
        return ''
    cands = []
    want = os.path.join(root, prefer_dir, base) if prefer_dir else ''
    if want and os.path.isfile(want):
        cands.append(want)
    root_p = os.path.join(root, base)
    if os.path.isfile(root_p):
        cands.append(root_p)
    if not cands:
        idx = _scan_loras(root)
        for rel in idx.get(base.lower(), []):
            cands.append(os.path.join(root, rel))
    return cands[0] if cands else ''


def _pack_build(card, card_type='style', mode='hybrid', embed_keys=None, embed_patches=False, embed_assets=False):
    """就地打包：返回 (bytes, meta)。复用与 CLI 相同的容器格式。"""
    import struct
    root = _loras_dir()
    if not os.path.isdir(root):
        return None, {'ok': False, 'error': '找不到 ComfyUI 的 models/loras 目录: %s（导出依赖它取权重与 sha256）' % root}
    srcs = _pack_sources()
    names = []
    if card_type == 'role':
        n = os.path.basename(str((card or {}).get('lora') or ''))
        if n:
            names.append(n)
    else:
        for l in ((card or {}).get('loras') or []):
            if isinstance(l, dict):
                n = str(l.get('name') or '').replace('/', os.sep)
                if n and n.lower().endswith('.safetensors') and n not in names:
                    names.append(n)
    if not names:
        return None, {'ok': False, 'error': '卡里没有可打包的 LoRA'}
    # 内嵌键统一成「文件名去扩展名」：面板/脚本传 `x.safetensors`、`x`、带路径都能命中
    ek = []
    for k in (embed_keys or []):
        s = str(k).strip().replace('/', os.sep).replace('\\', os.sep)
        if not s:
            continue
        s = os.path.splitext(os.path.basename(s))[0]
        if s and s not in ek:
            ek.append(s)
    if mode == 'baked':
        ek = [os.path.splitext(n)[0] for n in names]
    elif mode == 'recipe':
        ek = []
    elif mode == 'hybrid' and not ek:
        # 默认内嵌：卡里标了 local-derived 且本机确实存在的那些；一台机器都没有才退回内置名单
        cands = []
        for n in names:
            key = os.path.splitext(os.path.basename(n))[0]
            src = srcs.get(key) or srcs.get(os.path.basename(n)) or {}
            if str(src.get('kind') or '') == 'local-derived' and os.path.isfile(os.path.join(root, n)):
                cands.append(key)
        ek = cands or [k for k in CORE_EMBED if os.path.isfile(os.path.join(root, k + '.safetensors'))]
    prefer = ''
    try:
        em = str((card or {}).get('embeddedDir') or '')
        if em:
            prefer = em
    except Exception:
        pass
    files, blobs, off, emb = [], [], 0, 0
    for n in names:
        p = _resolve_path(root, n, prefer)
        base_n = os.path.basename(n)
        key = os.path.splitext(base_n)[0]
        is_emb = key in ek
        if is_emb and not os.path.isfile(p):
            return None, {'ok': False, 'error': '内嵌缺文件: %s' % p}
        size = os.path.getsize(p) if os.path.isfile(p) else 0
        it = {'name': base_n, 'size': size, 'sha256': _sha_cached(p) if os.path.isfile(p) else '',
              'role': 'embed' if is_emb else 'ref', 'verify': True}
        s = srcs.get(key) or srcs.get(n)
        if s:
            it['source'] = s
        elif not is_emb:
            it['source'] = {'kind': 'unknown'}
        if is_emb:
            it['offset'] = off
            blobs.append(p)
            off += size
            emb += size
        files.append(it)
    if card_type == 'role' and (embed_patches or embed_assets):
        import base64 as _b64, hashlib as _hl, tempfile as _tf
        _cond = (card or {}).get('conditioning') or {}
        if embed_patches:
            for _k, _v in (_cond.get('weights') or {}).items():
                nm = os.path.basename(str((_v or {}).get('name') or ''))
                if not nm:
                    continue
                p = os.path.join(COMFY_PATCHES, nm)
                if not os.path.isfile(p):
                    return None, {'ok': False, 'error': '内嵌 LLLite 权重缺文件: %s' % p}
                sz = os.path.getsize(p)
                files.append({'name': nm, 'size': sz, 'sha256': _sha_cached(p), 'role': 'embed',
                              'dest': 'patch', 'verify': True, 'offset': off})
                blobs.append(p); off += sz; emb += sz
        if embed_assets:
            for pid, pr in ((_cond.get('presets') or {}).items()):
                im = (pr or {}).get('image') or {}
                b64 = str(im.get('b64') or '')
                if not b64:
                    continue
                raw = _b64.b64decode(b64)
                nm = os.path.splitext(str(im.get('name') or pid))[0] + '.png'
                td = _tf.mkdtemp(prefix='dshpack-')
                fp = os.path.join(td, nm)
                open(fp, 'wb').write(raw)
                files.append({'name': nm, 'size': len(raw), 'sha256': _hl.sha256(raw).hexdigest(),
                              'role': 'embed', 'dest': 'asset', 'verify': True, 'offset': off,
                              'preset': pid, 'asset': str((pr or {}).get('asset') or '')})
                blobs.append(fp); off += len(raw); emb += len(raw)

    card = dict(card or {})
    # 导出件不带本机绝对路径（__file 来自 /cards 扫描，对方机器上没有意义，还会泄露导出者目录）
    card.pop('__file', None)
    card['packMode'] = mode
    card['embeddedLoras'] = [f['name'] for f in files if f['role'] == 'embed']
    card['embeddedBytes'] = emb
    cid = _slug(card.get('name'))[:40]
    head = {'format': 'dsh-stylecard/2', 'version': (3 if (embed_patches or embed_assets) else 2), 'cardId': cid, 'cardType': card_type,
            'card': card, 'files': files, 'mode': mode, 'baseModel': BASE_MODEL}
    hb = json.dumps(head, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    head_full = PACK_MAGIC + struct.pack('<I', len(hb)) + hb
    data = head_full if not blobs else None      # 无外部 blob 才直接返回字节；否则由 do_POST 流式从磁盘发
    unresolved = [f['name'] for f in files if f['role'] == 'ref' and not f.get('sha256')]
    meta = {'ok': True, 'unresolved': unresolved, 'mode': mode, 'cardType': card_type, 'bytes': (len(head_full) + sum(os.path.getsize(p) for p in blobs) if blobs else len(data)),
            'embed': [f['name'] for f in files if f['role'] == 'embed'],
            'refs': [f['name'] for f in files if f['role'] == 'ref'],
            'filename': cid + ('.dslrecipe' if mode == 'recipe' else '.dslcard'),
            '_pack_plan': {'header': PACK_MAGIC + struct.pack('<I', len(hb)) + hb, 'blobs': blobs}}
    return data, meta





def _model_lists():
    root = _loras_dir()
    base = os.path.dirname(root)

    def ls(*subs):
        out = []
        for sub in subs:
            d = os.path.join(base, sub)
            if not os.path.isdir(d):
                continue
            for r, _dd, fs_ in os.walk(d):
                for x in fs_:
                    if x.lower().endswith(('.safetensors', '.ckpt', '.pt', '.bin', '.gguf')):
                        out.append(os.path.relpath(os.path.join(r, x), d).replace('\\\\', '/'))
        return out
    return {'unet': ls('diffusion_models', 'checkpoints'),
            'clip': ls('text_encoders', 'clip'), 'vae': ls('vae')}


def _base_mismatch(want):
    if not isinstance(want, dict) or not want:
        return []
    have = _model_lists()
    bad = []
    for k, v in want.items():
        if not v:
            continue
        pool = have.get(k) or []
        if isinstance(v, str):
            v = [v]
        for nm in v:
            if not nm:
                continue
            if nm not in pool and os.path.basename(nm) not in [os.path.basename(x) for x in pool]:
                bad.append({'kind': k, 'name': nm})
    return bad




def _stylecards_unpack(handler, n, auto=0):
    """接收 .dslcard / .dslrecipe：
       mode=baked  → 全部权重落盘；
       mode=recipe → 按 名字+sha256 在本地解析，缺件进 missing（auto=1 时尝试下载）；
       mode=hybrid → 内嵌件落盘 + 其余按 recipe 解析。
    """
    import struct
    import tempfile
    if n <= 0:
        return {'ok': False, 'error': '空请求'}
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.cardpack')
    try:
        left = n
        while left > 0:
            chunk = handler.rfile.read(min(1 << 20, left))
            if not chunk:
                break
            tmp.write(chunk)
            left -= len(chunk)
        tmp.close()
        with open(tmp.name, 'rb') as f:
            if f.read(len(PACK_MAGIC)) != PACK_MAGIC:
                return {'ok': False, 'error': '不是 .dslcard 容器（magic 不符）'}
            rl = f.read(4)
            if len(rl) != 4:
                return {'ok': False, 'error': '头部长度缺失'}
            hlen = struct.unpack('<I', rl)[0]
            if hlen <= 0 or hlen > 32 << 20:
                return {'ok': False, 'error': '头部长度异常: %d' % hlen}
            head = json.loads(f.read(hlen).decode('utf-8'))
            files = head.get('files') or []
            card = dict(head.get('card') or {})
            card_id = _slug(head.get('cardId') or card.get('name'))
            root = _loras_dir()
            dst = os.path.join(_pack_root(), card_id)
            base = f.tell()
            embedded = [x for x in files if x.get('role') != 'ref' and x.get('offset') is not None]
            refs = [x for x in files if not (x.get('role') != 'ref' and x.get('offset') is not None)]
            mode = head.get('mode') or ('baked' if embedded and not refs else ('recipe' if not embedded else 'hybrid'))

            written, dedup, shadowed = [], [], []
            asset_errs = []   # 原版漏了这行：except 里 append 会 NameError
            for it in embedded:
                nm = os.path.basename(str(it.get('name') or ''))
                if not nm:
                    continue
                _dest = str(it.get('dest') or 'lora')
                if _dest in ('patch', 'asset'):
                    import hashlib as _h2
                    if _dest == 'patch':
                        _tdir = COMFY_PATCHES
                    else:
                        _croot = _lllite_root(None)
                        if not _croot:
                            return {'ok': False, 'error': '导入控制图需要角色卡目录（cardsDir）'}
                        _tdir = os.path.join(_croot, '_cond')
                    os.makedirs(_tdir, exist_ok=True)
                    _tp = os.path.join(_tdir, nm)
                    _want = str(it.get('sha256') or '').lower()
                    if os.path.isfile(_tp) and (not _want or _sha_cached(_tp) == _want):
                        dedup.append({'name': nm, 'dest': _dest, 'abs': _tp, 'reused': 'disk'})
                        continue
                    _off = int(it.get('offset') or 0)
                    _size = int(it.get('size') or 0)
                    f.seek(base + _off)
                    _h = _h2.sha256()
                    with open(_tp, 'wb') as _o:
                        _left = _size
                        while _left > 0:
                            _b = f.read(min(1 << 20, _left))
                            if not _b:
                                break
                            _o.write(_b); _h.update(_b); _left -= len(_b)
                    if _left > 0:
                        try:
                            os.remove(_tp)
                        except Exception:
                            pass
                        return {'ok': False, 'error': '容器被截断：%s 还缺 %d 字节' % (nm, _left)}
                    _got = _h.hexdigest()
                    written.append({'name': nm, 'dest': _dest, 'size': _size, 'sha256': _got, 'abs': _tp,
                                    'sha256_ok': (not _want) or _want == _got})
                    if _dest == 'asset':
                        try:
                            _ap = os.path.join(_tdir, 'assets.json')
                            _as = json.load(open(_ap, encoding='utf-8')) if os.path.exists(_ap) else {}
                            _stem = os.path.splitext(nm)[0]
                            with open(_tp, 'rb') as _fh:
                                _w2, _h2p = _png_size(_fh.read())
                            if not _w2 or not _h2p:
                                raise ValueError('不是有效 PNG，尺寸读不出')
                            _as[str(it.get('asset') or ('cond/' + _stem))] = {
                                'file': '_cond/' + nm, 'sha256': _got, 'w': _w2, 'h': _h2p,
                                'framing': 'pack', 'source': '卡包导入'}
                            with open(_ap, 'w', encoding='utf-8', newline='') as _af:
                                json.dump(_as, _af, ensure_ascii=False, indent=2)
                        except Exception as _e:
                            asset_errs.append({'name': nm, 'error': str(_e)})
                    continue
                want0 = str(it.get('sha256') or '').lower()
                gpath = os.path.join(root, nm)
                if os.path.isfile(gpath):
                    gsha = _sha_cached(gpath)
                    if (not want0) or want0 == gsha:
                        dedup.append({'name': nm, 'size': os.path.getsize(gpath), 'sha256': gsha,
                                      'lora': nm, 'reused': 'global'})
                        continue
                    shadowed.append({'name': nm, 'global_sha': gsha, 'card_sha': want0})
                off = int(it.get('offset') or 0)
                size = int(it.get('size') or 0)
                f.seek(base + off)
                os.makedirs(dst, exist_ok=True)
                fp = os.path.join(dst, nm)
                import hashlib
                h = hashlib.sha256()
                with open(fp, 'wb') as o:
                    left2 = size
                    while left2 > 0:
                        b = f.read(min(1 << 20, left2))
                        if not b:
                            break
                        o.write(b)
                        h.update(b)
                        left2 -= len(b)
                want = str(it.get('sha256') or '').lower()
                got = h.hexdigest()
                written.append({'name': nm, 'size': size, 'sha256': got,
                                'sha256_ok': (not want) or want == got,
                                'lora': '_dshcards' + os.sep + card_id + os.sep + nm, 'abs': fp})

            have = _scan_loras(root)
            resolved, missing, conflicts = [], [], []
            for it in refs:
                nm = os.path.basename(str(it.get('name') or ''))
                if not nm:
                    continue
                src = it.get('source') or {}
                cands = have.get(nm.lower()) or []
                if not cands:
                    missing.append({'name': nm, 'size': it.get('size'), 'sha256': it.get('sha256'),
                                    'source': src, 'reason': '本地没有这个文件'})
                    continue
                rel = cands[0]
                want = str(it.get('sha256') or '').lower()
                got = ''
                if want and it.get('verify') is not False:
                    got = _sha256_file(os.path.join(root, rel))
                if want and got and got != want:
                    conflicts.append({'name': nm, 'local': rel.replace('\\\\', '/'), 'want_sha': want,
                                      'got_sha': got, 'size_want': it.get('size'),
                                      'size_local': os.path.getsize(os.path.join(root, rel)),
                                      'source': src})
                else:
                    resolved.append({'name': nm, 'lora': rel.replace('\\\\', '/'), 'sha_ok': True,
                                     'size': os.path.getsize(os.path.join(root, rel))})

            if auto and missing:
                still = []
                for m in missing:
                    url = (m.get('source') or {}).get('url')
                    ok, msg = _dl_to(url, os.path.join(root, m['name']), m.get('sha256') or '')
                    if ok:
                        resolved.append({'name': m['name'], 'lora': m['name'], 'sha_ok': True,
                                         'size': os.path.getsize(os.path.join(root, m['name'])), 'downloaded': msg})
                        have.setdefault(m['name'].lower(), []).append(m['name'])
                    else:
                        m['error'] = msg
                        still.append(m)
                missing = still

            mp = {}
            for w in written:
                if w.get('dest') in ('patch', 'asset'):
                    continue
                mp[w['name'].lower()] = w.get('lora') or w['name']
            for d in dedup:
                if d.get('dest') in ('patch', 'asset'):
                    continue
                mp[d['name'].lower()] = d.get('lora') or d['name']
            for r in resolved:
                mp[r['name'].lower()] = r['lora']
            miss_set = set(os.path.basename(m['name']).lower() for m in missing)
            for l in (card.get('loras') or []):
                if isinstance(l, dict):
                    bn = os.path.basename(str(l.get('name') or '')).lower()
                    if bn in mp:
                        l['name'] = mp[bn].replace('\\\\', os.sep)
                        l.pop('missing', None)
                    elif bn:
                        l['missing'] = True
            rb = os.path.basename(str(card.get('lora') or '')).lower()
            if rb and rb in mp:
                card['lora'] = mp[rb]
            elif rb and rb in miss_set:
                card['loraMissing'] = True
            if any(w.get('dest', 'lora') == 'lora' for w in written):
                card['embeddedDir'] = '_dshcards' + os.sep + card_id
            card['packMode'] = mode
            bad_base = _base_mismatch(head.get('baseModel'))
            ctype = head.get('cardType') or ('role' if card.get('lora') and not card.get('loras') else 'style')
            return {'ok': True, 'cardType': ctype, 'mode': mode, 'card': card, 'written': written,
                    'dedup': dedup, 'shadowed': shadowed,
                    'resolved': resolved, 'missing': missing, 'conflicts': conflicts,
                    'baseMismatch': bad_base, 'dir': dst, 'root': root,
                    'count': len(written), 'total': len(files), 'assetErrors': asset_errs}
    except Exception as ex:
        return {'ok': False, 'error': '解包失败: %s' % ex}
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


def _stylecards_packed():
    root = _pack_root()
    out = []
    if os.path.isdir(root):
        for d in sorted(os.listdir(root)):
            p = os.path.join(root, d)
            if os.path.isdir(p):
                fs_ = sorted(x for x in os.listdir(p) if x.lower().endswith('.safetensors'))
                out.append({'id': d, 'dir': p,
                            'loras': [{'name': '_dshcards' + os.sep + d + os.sep + x,
                                       'size': os.path.getsize(os.path.join(p, x))} for x in fs_]})
    return {'ok': True, 'root': root, 'cards': out}
