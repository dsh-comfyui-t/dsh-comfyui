"""dsh-comfyui-console 侧车：无状态工具函数。

从 expander.py 拆出来的纯函数（不读任何模块级可变状态：CFG / CONFIG / COMFY_* 等）。
拆出的目的：这些函数与 HTTP 处理、ComfyUI 进程管理无关，混在一起容易在改端点时误伤。
约定：本文件里的函数只依赖参数与标准库，**不要**在这里引入读全局配置的代码。
"""

import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def _rid(kind, base, model):
    return '%s|%s|%s' % (kind, base, model or '')

# 判据必须是"主动连得上"，见 docs/生成经验.md #5
def _port_open(base):
    """本地端点是否在监听（连接被拒立刻返回，不会拖慢下拉）。"""
    import socket
    import urllib.parse as _up
    try:
        u = _up.urlparse(base)
        host = u.hostname or '127.0.0.1'
        port = u.port or (443 if u.scheme == 'https' else 80)
        with socket.create_connection((host, port), 0.15):
            return True
    except Exception:
        return False

def _http_json(url, key, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    hdr = {'Content-Type': 'application/json'}
    if key:
        hdr['Authorization'] = 'Bearer ' + key
    req = urllib.request.Request(url, data=data, headers=hdr)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def _http_post_nojson(url, body=None, timeout=30):
    """POST 但**不解析响应体**。

    ComfyUI 的 /free 是 `web.Response(status=200)`，body 是空的，
    按 JSON 解析会报 "Expecting value: line 1 column 1 (char 0)"。已踩。
    """
    data = json.dumps(body).encode() if body is not None else b''
    req = urllib.request.Request(url, data=data,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status

def pick_model(rt, want=None):
    """路线里挑模型：显式指定优先，其次路线自己配的，最后取服务端第一个。"""
    if want:
        return want
    if rt['model']:
        return rt['model']
    d = _http_json(rt['base'] + '/models', rt['key'], timeout=10)
    return (d.get('data') or [{}])[0].get('id', '')

def _tags(s):
    out = []
    for t in re.split(r"[,，]", s or ""):
        t = t.strip().strip(".").strip()
        if not t or t.lower().startswith("score_"):
            continue
        out.append(t)
    return out

def _dedupe(tags):
    seen, out = set(), []
    for t in tags:
        k = t.lower().replace("_", " ").strip()
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
    return out

def _is_cjk(t):
    return bool(re.search(r"[\u4e00-\u9fff]", t or ""))

def _nl_unknown_ok(u):
    u = str(u or '').strip()
    if not u:
        return ''
    bad = ('乱码', '无法识别', '未识别', '不详', '描述中', '没有提到', '未提及')
    if any(b in u for b in bad):
        return ''
    return u[:120]

_NO_WINDOW = 0x08000000

def _hide_kwargs():
    """给 subprocess 的「不开窗」参数；非 Windows 返回空字典。"""
    if os.name != 'nt':
        return {}
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = subprocess.SW_HIDE
    return {'creationflags': _NO_WINDOW, 'startupinfo': si}

def _norm_dir(raw):
    """路径归一 + 建目录：返回 (ok, err, abspath)"""
    d = str(raw or "").strip().strip('"')
    if not d:
        return (False, '路径为空', '')
    try:
        d = os.path.abspath(os.path.expanduser(d))
    except Exception as e:
        return (False, '路径无效: %s' % e, '')
    if os.path.exists(d) and not os.path.isdir(d):
        return (False, '这个路径是个文件，不是文件夹', '')
    try:
        os.makedirs(d, exist_ok=True)
    except Exception as e:
        return (False, '创建目录失败: %s' % e, '')
    return (True, '', d)

def _models_list(routes, path):
    """合并各路由的 /models，?route= 可过滤"""
    rid = (urllib.parse.parse_qs(urllib.parse.urlparse(path).query).get('route') or [''])[0]
    rts = routes
    if rid:
        one = next((r for r in routes if _rid(r['base'], r.get('model', '')) == rid or r['name'] == rid), None)
        rts = [one] if one else []
    out = []
    for rt in rts:
        try:
            d = _http_json(rt['base'] + '/models', rt['key'], timeout=10)
            out += [{'id': m.get('id', ''), 'name': m.get('id', ''), 'route': rt['name']}
                    for m in (d.get('data') or []) if m.get('id')]
        except Exception:
            continue
    return out

def _reveal_in_explorer(path):
    """在资源管理器里定位并选中这个文件。"""
    if os.name != 'nt':
        return (False, '仅支持 Windows')
    # explorer.exe 是 GUI 程序，不分配控制台。**千万不要**给它 SW_HIDE ——
    # 那会让 explorer 把新窗口以隐藏状态打开，看起来就是「点了没反应」。踩过。
    try:
        subprocess.Popen(['explorer', '/select,', os.path.normpath(path)])
        return (True, '已在资源管理器中定位')
    except Exception as e:
        # 定位失败时退回「打开所在文件夹」，至少让人看到文件
        try:
            os.startfile(os.path.dirname(os.path.normpath(path)))
            return (True, '已打开所在文件夹（未能选中文件）')
        except Exception as e2:
            return (False, str(e) + ' / ' + str(e2))

def _sha256_file(fp):
    import hashlib
    h = hashlib.sha256()
    with open(fp, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def _png_size(data):
    """不依赖 Pillow：从 IHDR 读宽高。"""
    if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        return 0, 0
    return int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')

def _slug(s):
    keep = []
    for ch in str(s or ''):
        if ch.isalnum() or ch in '-_.':
            keep.append(ch)
        elif ch in ' \\/':
            keep.append('-')
    out = ''.join(keep).strip('-')
    return out[:48] or 'card'

def _scan_loras(root):
    """name(小写) -> [相对路径...]，短路径优先（全局优先于 _dshcards 子目录）。"""
    out = {}
    if not os.path.isdir(root):
        return out
    for r, _d, fs_ in os.walk(root):
        for x in fs_:
            if not x.lower().endswith('.safetensors'):
                continue
            rel = os.path.relpath(os.path.join(r, x), root)
            out.setdefault(x.lower(), []).append(rel)
    for k in out:
        out[k].sort(key=lambda s: (len(s), s))
    return out

def _dl_to(url, dst, want_sha='', timeout=120):
    """一键下载：流式写 .part → 校验 sha256 → 改名。"""
    import shutil
    import urllib.request
    if not url:
        return False, '没有下载地址'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + '.part'
    try:
        req = urllib.request.Request(str(url), headers={'User-Agent': 'Mozilla/5.0 dsh-cardpack'})
        h = hashlib_sha = __import__('hashlib').sha256()
        with urllib.request.urlopen(req, timeout=timeout) as r, open(tmp, 'wb') as o:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                o.write(b)
                h.update(b)
        got = h.hexdigest()
        if want_sha and got.lower() != str(want_sha).lower():
            os.unlink(tmp)
            return False, 'sha256 不符（得到 %s…）' % got[:8]
        shutil.move(tmp, dst)
        return True, '已下载 %.1f MB' % (os.path.getsize(dst) / 1048576.0)
    except Exception as ex:
        try:
            if os.path.isfile(tmp):
                os.unlink(tmp)
        except Exception:
            pass
        return False, '下载失败: %s' % ex

def _port_already_serving(port, timeout=0.8):
    """端口上是否**已有服务在应答**（不只是"被占用"）。

    ⚠️ 不能用"bind 失败"当判据：Python 的 HTTPServer 默认
       allow_reuse_address = 1，在 Windows 上**允许多个进程绑同一端口**，
       bind 会成功，于是堆出一堆僵尸 sidecar（2026-10-12 实测堆了 4 个）。
       所以改成主动连一下：连得上 = 已有实例在服务 = 本次直接退出。
    """
    import socket
    s = socket.socket()
    s.settimeout(timeout)
    try:
        s.connect(('127.0.0.1', port))
        return True
    except Exception:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass
