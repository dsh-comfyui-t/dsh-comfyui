"""大模型路线的探查与缓存（local / ollama / 别的 OpenAI 兼容端点）。

从 expander.py 拆出（0.5.4）。这里决定"扩写用哪个模型"，不碰卡也不碰出图。
"""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

from sidecar_state import (
    HERE,
    CONFIG,
    _CREDS_CACHE,
    _read_creds,
)
from sidecar_util import (
    _http_json,
    _port_open,
    _rid,
)


# ======================================================================
#  A) 提示词扩写
# ======================================================================


def load_routes():
    routes = []
    if os.path.exists(CONFIG):
        try:
            try:
                c = json.load(open(CONFIG, encoding='utf-8'))
            except Exception:
                c = json.load(open(CONFIG, encoding='utf-8-sig'))   # 带 BOM 的 config
            if c.get('base_url'):
                routes.append({'name': c.get('name', 'config'), 'base': c['base_url'].rstrip('/'),
                               'key': c.get('api_key') or '', 'model': c.get('model') or ''})
        except Exception as e:
            print('config.json 读取失败:', e)
    routes.append({'name': 'local-llama', 'base': 'http://127.0.0.1:8083/v1',
                   'key': 'sk-local', 'model': ''})
    key = _CREDS_CACHE['v'] if _CREDS_CACHE['v'] is not None else _read_creds()
    _CREDS_CACHE['v'] = key
    if key:
        routes.append({'name': 'deepseek', 'base': 'https://api.deepseek.com/v1',
                       'key': key, 'model': 'deepseek-chat'})
    return routes


ROUTES_FILE = os.path.join(HERE, 'routes.json')
# 常见的本地 OpenAI 兼容端点（跑起来就会被自动发现）
_LOCAL_CANDIDATES = [
    ('http://127.0.0.1:11434/v1', 'Ollama'),
    ('http://127.0.0.1:1234/v1', 'LM Studio'),
    ('http://127.0.0.1:8083/v1', 'llama.cpp'),
    ('http://127.0.0.1:8080/v1', '本地 OpenAI'),
    ('http://127.0.0.1:8000/v1', 'vLLM'),
    ('http://127.0.0.1:5001/v1', 'text-generation-webui'),
    ('http://127.0.0.1:5000/v1', '本地 OpenAI'),
    ('http://127.0.0.1:8001/v1', '本地 OpenAI'),
    ('http://127.0.0.1:8081/v1', '本地 OpenAI'),
    ('http://127.0.0.1:8090/v1', '本地 OpenAI'),
]
_PROBE_DIAG = []


def load_user_routes():
    try:
        d = json.load(open(ROUTES_FILE, encoding='utf-8'))
        return [r for r in (d.get('routes') or []) if r.get('base')]
    except Exception:
        return []


def save_user_routes(rs):
    try:
        with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
            json.dump({'routes': rs}, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print('routes.json 写入失败:', e)
        return False






def probe_local():
    """探测本地 OpenAI 兼容端点：/v1/models -> /models -> Ollama 原生 /api/tags。"""
    global _PROBE_DIAG
    out, diag = [], []

    def one(item):
        base, name = item
        if not _port_open(base):
            return {'base': base, 'name': name, 'open': False, 'models': 0}, []
        root = base[:-3] if base.endswith('/v1') else base
        ids, err = [], ''
        for url in (base + '/models', base + '/models', root + '/v1/models', root + '/api/tags'):
            try:
                d = _http_json(url, 'local', timeout=2.0)
                raw = d.get('data') or d.get('models') or []
                ids = [m.get('id') or m.get('name') for m in raw if (m.get('id') or m.get('name'))]
                if ids:
                    break
            except Exception as e:
                err = '%s: %s' % (url, e)
        routes = [{'id': _rid('local', base, m), 'name': name, 'kind': 'local',
                   'base': base, 'model': m, 'hasKey': False} for m in ids[:12]]
        return {'base': base, 'name': name, 'open': True,
                'models': len(ids), 'error': '' if ids else err}, routes

    try:
        import concurrent.futures as _cf
        with _cf.ThreadPoolExecutor(max_workers=len(_LOCAL_CANDIDATES) or 4) as ex:
            results = list(ex.map(one, _LOCAL_CANDIDATES))
    except Exception:
        results = [one(c) for c in _LOCAL_CANDIDATES]
    for d, rs in results:
        diag.append(d)
        out.extend(rs)
    _PROBE_DIAG[:] = diag   # 原地更新：跨模块导入的是同一个 list，重新绑定会断开
    return out


_ROUTE_CACHE = {'t': 0.0, 'v': None}


def all_routes(force=False):
    """云端 + 用户自建 + 本地探测，给面板做下拉（10 秒缓存，避免每次都读凭证）。"""
    now = time.time()
    if not force and _ROUTE_CACHE['v'] is not None and now - _ROUTE_CACHE['t'] < 10:
        return _ROUTE_CACHE['v']
    out = _all_routes_uncached()
    _ROUTE_CACHE['t'] = now
    _ROUTE_CACHE['v'] = out
    return out


def _all_routes_uncached():
    """云端 + 用户自建 + 本地探测（实际实现）。"""
    seen, out = set(), []
    for r in load_routes():
        base = (r.get('base') or '').rstrip('/')
        if not base:
            continue
        kind = 'cloud' if base.startswith('https://') else 'local'
        if kind == 'local':
            # 本地端点统一交给 probe_local（多路径 + 诊断），这里不重复列出
            continue
        rid = _rid(kind, base, r.get('model') or '')
        if rid in seen:
            continue
        seen.add(rid)
        out.append({'id': rid, 'name': r.get('name') or base, 'kind': kind,
                    'base': base, 'model': r.get('model') or '',
                    'hasKey': bool(r.get('key'))})
    for r in load_user_routes():
        base = (r.get('base') or '').rstrip('/')
        kind = 'api' if base.startswith('https://') else 'local'
        rid = _rid(kind, base, r.get('model') or '')
        if rid in seen:
            continue
        seen.add(rid)
        out.append({'id': rid, 'name': r.get('name') or base, 'kind': kind,
                    'base': base, 'model': r.get('model') or '',
                    'hasKey': bool(r.get('key'))})
    for r in probe_local():
        if r['id'] in seen:
            continue
        seen.add(r['id'])
        out.append(r)
    return out


def find_route(route_id):
    """按 id 找路线；先查带 key 的真实配置，最后才查本地探测。"""
    if not route_id:
        return None
    for r in load_routes() + load_user_routes():
        base = (r.get('base') or '').rstrip('/')
        model = r.get('model') or ''
        kind = 'cloud' if base.startswith('https://') else 'api'
        ids = {_rid(kind, base, model), _rid('local', base, model), _rid('api', base, model)}
        if route_id in ids:
            return {'name': r.get('name') or base, 'base': base,
                    'key': r.get('key') or 'local', 'model': model}
    for r in all_routes():
        if r['id'] == route_id:
            return {'name': r['name'], 'base': r['base'],
                    'key': 'local', 'model': r['model']}
    return None
