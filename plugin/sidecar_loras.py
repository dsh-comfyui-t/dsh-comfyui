# -*- coding: utf-8 -*-
"""LoRA 管理：列表 / 导入 / 删除（0.7.70）。

三个动作全部落在 ComfyUI 的 `models/loras`（由 `sidecar_pack._loras_dir()` 从 comfyRoot 派生）：

    GET  /loras              → 扫 .safetensors / .pt / .ckpt / .sft / .bin（跳过 _trash* 与 _dshcards）
    POST /loras/import       → 四种模式
                                a) JSON {"path": "D:\\dl\\x.safetensors"}  本机文件复制进来
                                b) 原始二进制 body + 头 X-Filename: <名字>  浏览器上传
                                c) JSON {"url": "https://…"}               从网站直链下载（支持 Civitai 直链 + token）
                                d) 以上 a/c 指向 .zip                        自动解压挑出里面的权重
    POST /loras/scan         → {"dir": "C:\\Users\\x\\Downloads"}   列出下载文件夹里的权重包
    POST /loras/del          → {"name": "<相对路径>"} 搬进 <loras>/_trash-<时间戳>/，**不硬删**

去重口径：同名且 sha256 相同 → 不重复落盘，返回 dedup=True；
同名但内容不同 → 另存 `<名>-2.safetensors`，绝不覆盖已有权重。
"""
import hashlib
import json
import os
import shutil
import time

from sidecar_pack import _loras_dir

def _warn(msg):
    """0.7.78：以前这里全是 `except Exception: pass` —— 下载/落盘失败一点痕迹都不留。
    现在统一追加到 <plugin>/work/warn.log，排查时先看这个文件。"""
    try:
        import time as _t
        d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'warn.log'), 'a', encoding='utf-8') as f:
            f.write('[%s] loras: %s\n' % (_t.strftime('%Y-%m-%d %H:%M:%S'), msg))
    except Exception as _e:
        _warn('suppressed: %s' % _e)


EXTS = ('.safetensors', '.pt', '.ckpt', '.sft', '.bin')
SKIP_DIRS = ('_trash', '_dshcards')


def _root():
    r = _loras_dir()
    if not r or not os.path.isdir(r):
        return ''
    return os.path.abspath(r)


def _sha256_file(fp, chunk=1 << 20):
    h = hashlib.sha256()
    with open(fp, 'rb') as f:
        for blk in iter(lambda: f.read(chunk), b''):
            h.update(blk)
    return h.hexdigest()


def _rel_ok(rel):
    """相对路径必须干净：不能绝对、不能 ..、必须在 loras 目录内。"""
    s = str(rel or '').replace('\\', '/').strip().lstrip('/')
    if not s or '..' in s.split('/'):
        return ''
    return s


def _abs_of(rel):
    root = _root()
    if not root:
        return '', ''
    clean = _rel_ok(rel)
    if not clean:
        return root, ''
    fp = os.path.abspath(os.path.join(root, clean.replace('/', os.sep)))
    try:
        if os.path.commonpath([fp, root]) != root:
            return root, ''
    except Exception:
        return root, ''
    return root, fp


def _loras_list(with_sha=False):
    root = _root()
    if not root:
        return {'ok': False, 'error': '找不到 ComfyUI 的 models/loras 目录（config.json 的 comfyRoot 没配对？）'}
    out = []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if not d.startswith(SKIP_DIRS)]
        for f in fn:
            if not f.lower().endswith(EXTS):
                continue
            fp = os.path.join(dp, f)
            rel = os.path.relpath(fp, root).replace('\\', '/')
            try:
                st = os.stat(fp)
            except Exception:
                continue
            it = {'name': rel, 'bytes': st.st_size, 'mtime': int(st.st_mtime)}
            if with_sha:
                try:
                    it['sha256'] = _sha256_file(fp)
                except Exception as _e:
                    _warn('suppressed: %s' % _e)
            out.append(it)
    out.sort(key=lambda x: x['name'].lower())
    return {'ok': True, 'dir': root, 'count': len(out), 'totalBytes': sum(x['bytes'] for x in out), 'loras': out}


def _target_name(name):
    """落盘名字：只留文件名那一段，扩展名缺失补 .safetensors。"""
    base = os.path.basename(str(name or '').replace('\\', '/')).strip()
    if not base:
        return ''
    for bad in ('..', ':', '*', '?', '"', '<', '>', '|'):
        base = base.replace(bad, '_')
    if not base.lower().endswith(EXTS):
        base += '.safetensors'
    return base


def _place(tmp_path, want_name):
    """把临时文件放到 loras 根目录，按 sha 去重；返回 (结果字典)。"""
    root = _root()
    if not root:
        return {'ok': False, 'error': '找不到 models/loras 目录'}
    name = _target_name(want_name)
    if not name:
        return {'ok': False, 'error': '没有文件名'}
    try:
        sha = _sha256_file(tmp_path)
        size = os.path.getsize(tmp_path)
    except Exception as e:
        return {'ok': False, 'error': '读临时文件失败: %s' % e}
    cand = os.path.join(root, name)
    n = 2
    while os.path.exists(cand):
        try:
            if os.path.getsize(cand) == size and _sha256_file(cand) == sha:
                os.remove(tmp_path)
                return {'ok': True, 'name': os.path.basename(cand), 'path': cand,
                        'bytes': size, 'sha256': sha, 'dedup': True, 'note': '同名同内容，已复用本机那份'}
        except Exception as _e:
            _warn('suppressed: %s' % _e)
        stem, ext = os.path.splitext(name)
        cand = os.path.join(root, '%s-%d%s' % (stem, n, ext))
        n += 1
    try:
        shutil.move(tmp_path, cand)
    except Exception as e:
        try:
            os.remove(tmp_path)
        except Exception as _e:
            _warn('suppressed: %s' % _e)
        return {'ok': False, 'error': '落盘失败: %s' % e}
    return {'ok': True, 'name': os.path.basename(cand), 'path': cand, 'bytes': size, 'sha256': sha, 'dedup': False}


def _loras_import_path(src):
    root = _root()
    if not root:
        return {'ok': False, 'error': '找不到 models/loras 目录'}
    src = os.path.abspath(str(src or '').strip().strip('"'))
    if not os.path.isfile(src):
        return {'ok': False, 'error': '源文件不存在: %s' % src}
    if not src.lower().endswith(EXTS):
        return {'ok': False, 'error': '只认 %s：%s' % (' / '.join(EXTS), os.path.basename(src))}
    tmp = os.path.join(root, '.import-%d.tmp' % int(time.time() * 1000))
    try:
        shutil.copy2(src, tmp)
    except Exception as e:
        return {'ok': False, 'error': '复制失败: %s' % e}
    return _place(tmp, os.path.basename(src))


def _loras_import_stream(stream, n, filename):
    """浏览器上传：把 body 流写进临时文件再落盘（不整包读进内存）。"""
    root = _root()
    if not root:
        return {'ok': False, 'error': '找不到 models/loras 目录'}
    name = _target_name(filename)
    if not name:
        return {'ok': False, 'error': '缺少 X-Filename 头'}
    tmp = os.path.join(root, '.upload-%d.tmp' % int(time.time() * 1000))
    left = int(n or 0)
    try:
        with open(tmp, 'wb') as f:
            while left > 0:
                blk = stream.read(min(1 << 20, left))
                if not blk:
                    break
                f.write(blk)
                left -= len(blk)
    except Exception as e:
        try:
            os.remove(tmp)
        except Exception as _e:
            _warn('suppressed: %s' % _e)
        return {'ok': False, 'error': '收文件失败: %s' % e}
    if left > 0:
        try:
            os.remove(tmp)
        except Exception as _e:
            _warn('suppressed: %s' % _e)
        return {'ok': False, 'error': '上传不完整，还缺 %d 字节' % left}
    return _place(tmp, name)


def _loras_del(name):
    root, fp = _abs_of(name)
    if not root:
        return {'ok': False, 'error': '找不到 models/loras 目录'}
    if not fp or not os.path.isfile(fp):
        return {'ok': False, 'error': '文件不存在: %s' % (name or '')}
    trash = os.path.join(root, '_trash-' + time.strftime('%Y%m%d-%H%M%S'))
    try:
        os.makedirs(trash, exist_ok=True)
        tgt = os.path.join(trash, os.path.basename(fp))
        n = 2
        while os.path.exists(tgt):
            stem, ext = os.path.splitext(os.path.basename(fp))
            tgt = os.path.join(trash, '%s-%d%s' % (stem, n, ext))
            n += 1
        shutil.move(fp, tgt)
    except Exception as e:
        return {'ok': False, 'error': '搬进 _trash 失败: %s' % e}
    left = _loras_list().get('count', 0)
    return {'ok': True, 'name': os.path.basename(fp), 'from': fp, 'trash': trash, 'left': left,
            'note': '已搬进 _trash（不硬删，想恢复搬回来）'}

# ---------------- 从网站下载 / 压缩包 / 下载文件夹扫描（0.7.71） ----------------

def _max_bytes():
    try:
        mb = int(os.environ.get('DSH_LORA_MAX_MB') or 0)
    except Exception:
        mb = 0
    return (mb or 8192) * 1024 * 1024


def _url_name(url, headers):
    """文件名：Content-Disposition 优先，其次 URL 末段；去掉查询串与危险字符。"""
    cd = ''
    try:
        cd = headers.get('Content-Disposition') or headers.get('content-disposition') or ''
    except Exception:
        cd = ''
    raw = ''
    if cd:
        import re as _re
        m = _re.search(r"filename\*=UTF-8''([^;]+)", cd) or _re.search(r'filename="?([^";]+)"?', cd)
        if m:
            import urllib.parse as _up
            raw = _up.unquote(m.group(1).strip())
    if not raw:
        import urllib.parse as _up
        raw = os.path.basename(_up.urlparse(url).path)
    base = os.path.basename(str(raw).replace('\\', '/')).strip()
    for bad in ('..', ':', '*', '?', '"', '<', '>', '|'):
        base = base.replace(bad, '_')
    return base


def _download(url, token='', filename=''):
    """流式下载到 loras 目录下的临时文件，返回 (tmp_path, 推断名, 提示)。"""
    import urllib.request
    root = _root()
    if not root:
        return None, '', '找不到 models/loras 目录'
    u = str(url or '').strip()
    if not u.lower().startswith(('http://', 'https://')):
        return None, '', '只认 http/https 链接: %s' % u[:80]
    tmp = os.path.join(root, '.download-%d.tmp' % int(time.time() * 1000))
    req = urllib.request.Request(u, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) dsh-comfyui-console/0.7.71',
        'Accept': '*/*',
    })
    if token:
        req.add_header('Authorization', 'Bearer ' + str(token))
    cap = _max_bytes()
    done = 0
    try:
        with urllib.request.urlopen(req, timeout=120) as r, open(tmp, 'wb') as f:
            name = _url_name(u, r.headers)
            while True:
                blk = r.read(1 << 20)
                if not blk:
                    break
                f.write(blk)
                done += len(blk)
                if done > cap:
                    raise RuntimeError('超过上限 %d MB（DSH_LORA_MAX_MB 可改）' % (cap // 1048576))
    except Exception as e:
        try:
            os.remove(tmp)
        except Exception as _e:
            _warn('suppressed: %s' % _e)
        return None, '', '下载失败: %s' % e
    return tmp, (filename or name), '%d MB' % round(done / 1048576, 2)


def _extract_zip(zip_path, keep_name=''):
    """zip 里挑出权重：逐个解到临时文件再 _place，返回结果列表。"""
    import zipfile
    root = _root()
    results = []
    try:
        zf = zipfile.ZipFile(zip_path)
    except Exception as e:
        return [{'ok': False, 'error': '不是有效 zip: %s' % e}]
    with zf:
        members = [m for m in zf.namelist()
                   if m.lower().endswith(EXTS) and not m.startswith('__MACOSX')
                   and not os.path.basename(m).startswith('.')]
        if not members:
            return [{'ok': False, 'error': '压缩包里没有 %s 权重' % ' / '.join(EXTS)}]
        for m in members:
            dst = os.path.join(root, '.unzip-%d.tmp' % int(time.time() * 1000))
            try:
                with zf.open(m) as src, open(dst, 'wb') as out:
                    shutil.copyfileobj(src, out, 1 << 20)
            except Exception as e:
                results.append({'ok': False, 'name': os.path.basename(m), 'error': '解压失败: %s' % e})
                continue
            one = _place(dst, os.path.basename(m) or keep_name)
            one['fromZip'] = os.path.basename(zip_path)
            results.append(one)
    return results


def _loras_import_url(url, token='', filename=''):
    tmp, name, note = _download(url, token, filename)
    if not tmp:
        return {'ok': False, 'error': note}
    try:
        if str(name).lower().endswith('.zip'):
            out = _extract_zip(tmp, name)
            try:
                os.remove(tmp)
            except Exception as _e:
                _warn('suppressed: %s' % _e)
            ok = [x for x in out if x.get('ok')]
            return {'ok': bool(ok), 'fromUrl': url, 'downloaded': note, 'count': len(ok),
                    'items': out, 'name': (ok[0].get('name') if len(ok) == 1 else ''),
                    'error': ('' if ok else '压缩包里没有可用权重')}
        return _place(tmp, name)
    except Exception as e:
        try:
            os.remove(tmp)
        except Exception as _e:
            _warn('suppressed: %s' % _e)
        return {'ok': False, 'error': '导入失败: %s' % e}


def _loras_import_zip(path):
    p = os.path.abspath(str(path or '').strip().strip('"'))
    if not os.path.isfile(p):
        return {'ok': False, 'error': '文件不存在: %s' % p}
    out = _extract_zip(p, os.path.basename(p))
    ok = [x for x in out if x.get('ok')]
    return {'ok': bool(ok), 'count': len(ok), 'items': out,
            'error': ('' if ok else '压缩包里没有可用权重')}


def _loras_scan(dirpath):
    """下载文件夹里能直接导的东西：权重本体与 .zip 包。"""
    d = os.path.abspath(str(dirpath or '').strip().strip('"'))
    if not os.path.isdir(d):
        return {'ok': False, 'error': '目录不存在: %s' % d}
    out = []
    try:
        for f in os.listdir(d):
            fp = os.path.join(d, f)
            if not os.path.isfile(fp):
                continue
            low = f.lower()
            if not (low.endswith(EXTS) or low.endswith('.zip')):
                continue
            try:
                st = os.stat(fp)
            except Exception:
                continue
            out.append({'name': f, 'path': fp, 'bytes': st.st_size, 'mtime': int(st.st_mtime),
                        'zip': low.endswith('.zip')})
    except Exception as e:
        return {'ok': False, 'error': '读目录失败: %s' % e}
    out.sort(key=lambda x: -x['mtime'])
    return {'ok': True, 'dir': d, 'count': len(out), 'files': out}

