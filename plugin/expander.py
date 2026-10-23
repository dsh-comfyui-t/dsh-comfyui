# -*- coding: utf-8 -*-
"""提示词扩写 sidecar + ComfyUI 生命周期管理。

两个职责：
  A) 提示词扩写 —— 本地 8B 优先，不通走 DeepSeek（浏览器直连 LLM 会被 CORS/密钥卡住）
  B) ComfyUI 的按需启停 —— 本进程只有 ~27 MB，所以让它常驻当"启动器"，
     ComfyUI（~880 MB 内存 + 显存）按需拉起、闲置自动卸载模型。

为什么把 B 放在这里而不是 DSH 插件里：
  DSH 的客户端页面碰不到进程；host 插件能起但不能在"用户打开页面时"被触发。
  而一个常驻的本地 HTTP 服务两者都能做到，且 CORS 已验证可用。

端点：
  GET  /health              健康检查
  POST /expand              {text, negative} -> {positive, negative, model}
  GET  /comfy/status        -> {running, idle_seconds, auto_unload_in}
  POST /comfy/start         确保 ComfyUI 在跑（不在就拉起），并重置闲置计时
  POST /comfy/touch         重置闲置计时（页面有活动时调）
  POST /comfy/unload        让 ComfyUI 卸载模型、释放显存（进程留着，下次加载快）
  POST /comfy/stop          彻底关掉 ComfyUI 进程（连内存一起还）
  POST /open                {filename, subfolder} -> 在资源管理器里定位这张出图

闲置策略：超过 AUTO_UNLOAD_SECONDS 没有 comfy/* 活动 -> 自动 unload（不杀进程）。
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --- 本机补丁 2026-10-21：自己把脚本目录加进 sys.path --------------------
# ⚠️ ComfyUI 便携版的 python_embeded 里有 python313._pth，解释器处于**隔离模式**：
#    sys.path 完全由 ._pth 决定，**不会**把脚本所在目录放进 sys.path[0]
#    （普通 Python 会）。实测：
#        sys.path[0] = E:\ComfyUI\ComfyUI_windows_portable\ComfyUI
#        插件目录在 sys.path 里: False
#    0.1.0 的 expander.py 是单文件、不 import 兄弟模块，所以什么解释器都能跑；
#    拆成 9 个 sidecar_*.py 之后，用 python_embeded\pythonw.exe 启动就是
#        ModuleNotFoundError: No module named 'sidecar_util'
#    并且进程 code=1 秒退 -> host 保活每 15s 重试，永远起不来。
#    这里补上，不再依赖解释器的默认行为。
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
# --- 补丁结束 -----------------------------------------------------------


# --- 本机补丁 2026-10-15 -------------------------------------------------
# 中文版 Windows 下 sys.stdout/stderr 默认 GBK；插件打印 '✗' / '✓' 这类字符时
# 会抛 UnicodeEncodeError 并**立刻结束整个进程**（实测：sidecar 一启动就 code=1，
# 日志只留下崩溃栈，真正的错误被自己的报错盖住）。强制 UTF-8 + 容错。

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
# --- 补丁结束 -----------------------------------------------------------

# 无状态工具函数已拆出（见 sidecar_util.py），此处导入以保持原调用点不变
from sidecar_util import (
    _NO_WINDOW,
    _dedupe,
    _dl_to,
    _hide_kwargs,
    _http_json,
    _http_post_nojson,
    _is_cjk,
    _models_list,
    _nl_unknown_ok,
    _norm_dir,
    _png_size,
    _port_already_serving,
    _port_open,
    _reveal_in_explorer,
    _rid,
    _scan_loras,
    _sha256_file,
    _slug,
    _tags,
    pick_model,
)

# 配置与模块级状态在 sidecar_state.py（0.5.4 起）
from sidecar_state import (
    HERE,
    CONFIG,
    PKG_JSON,
    STARTED_AT,
    KNOWN_CFG_KEYS,
    _pkg_meta,
    _PKG,
    VERSION_LOADED,
    CONFIG_VERSION,
    _load_cfg,
    CFG,
    COMFY_ROOT,
    COMFY_BASE,
    BACKEND_MODE,
    MANAGED,
    COMFY_PY,
    COMFY_MAIN,
    COMFY_PORT,
    WORK_DIR,
    CREDS,
    COMFY_EXTRA_ARGS,
    AUTO_UNLOAD_SECONDS,
    WATCH_INTERVAL,
    _read_creds,
    _CREDS_CACHE,
    COMFY_INPUT,
    COMFY_PATCHES,
)

# ComfyUI 进程管理在 sidecar_comfy.py（0.5.4 起）
from sidecar_comfy import (
    _comfy_exe,
    Comfy,
)

# 卡的读写与 LLLite 资产在 sidecar_cards.py（0.5.4 起）
from sidecar_dirs import (
    _dir_scan,
    _dir_clear,
    _dir_split,
    _dir_write,
    _dir_del,
)
from sidecar_cards import (
    _cards_scan,
    _cards_write,
    _lllite_root,
    _lllite_tables,
    _cards_import,
    _cards_selfcontained,
    _stage_control_image,
    _stage_lllite_weights,
    _lllite_asset_add,
    _lllite_resolve,
)

# 卡包打包与拆包在 sidecar_pack.py（0.5.4 起）
from sidecar_loras import (
    _loras_list,
    _loras_import_url,
    _loras_import_zip,
    _loras_scan,
    _loras_import_path,
    _loras_import_stream,
    _loras_del,
)
from sidecar_pack import (
    PACK_MAGIC,
    CORE_EMBED,
    BASE_MODEL,
    _SHA_CACHE,
    _loras_dir,
    _pack_root,
    _sha_cached,
    _pack_sources,
    _resolve_path,
    _pack_build,
    _model_lists,
    _base_mismatch,
    _stylecards_unpack,
    _stylecards_packed,
)

# 见 sidecar_routes.py（0.5.4 起）
from sidecar_routes import (
    ROUTES_FILE,
    _LOCAL_CANDIDATES,
    _PROBE_DIAG,
    _ROUTE_CACHE,
    load_routes,
    load_user_routes,
    save_user_routes,
    probe_local,
    all_routes,
    _all_routes_uncached,
    find_route,
)

# 见 sidecar_llm.py（0.5.4 起）
from sidecar_llm import (
    NL_SYSTEM,
    SYSTEM,
    _QUALITY,
    _BAD_TAGS,
    _CAMERA_BLOCK,
    _CN_MAP,
    _INVENT_BLOCK,
    _EN_DROP,
    _SRC_TXT,
    _CN_DROP,
    _NL_BANNED,
    _NL_POSE,
    _NL_NEG_BASE,
    _keep_cjk,
    _cn_map_tags,
    tidy_nl,
    tidy_expand,
    expand,
    LOCAL_LLM_DIR,
    LOCAL_LLM_PORT,
    _LOCAL_LLM_PID,
    _local_llm_paths,
    _local_llm_models,
    local_llm_status,
    start_local_llm,
    stop_local_llm,
)

# 见 sidecar_config.py（0.5.4 起）
from sidecar_config import (
    _output_dirs,
    _resolve_output,
    _cfg_set,
    _comfy_models,
    _card_validate,
    _set_output_dir,
    _save_dir,
    _set_save_dir,
    _copy_to_save,
)

# 见 sidecar_auth.py（0.5.4 起）
from sidecar_auth import (
    _LOCAL_ORIGIN_RE,
    _LAN_ORIGIN_RE,
    _OPEN_PATHS,
    _TOKEN_CACHE,
    _origin_ok,
    _token_file,
    _load_or_create_token,
    _token,
    _token_required,
    _auth_ok,
)



# ======================================================================
#  B) ComfyUI 生命周期
# ======================================================================
# 运行时黑框：Windows 上每跑一次控制台程序（netstat / taskkill）都会闪一个窗口。
# 统一用 CREATE_NO_WINDOW + STARTF_USESHOWWINDOW(SW_HIDE) 把它压掉。





COMFY = Comfy()







# 请求体上限分档：普通 JSON 接口与二进制上传分开，避免小接口也吃 256MB
MAX_BODY = 8 << 20            # /expand /cards/write /lllite /config/* ...
MAX_BODY_UPLOAD = 1024 << 20  # 卡包二进制上传：上限 1GB（unpack 是边收边落盘的流式写法，不吃内存）
UPLOAD_PATHS = ('/stylecards/unpack', '/cards/import', '/cards/selfcontained', '/loras/import')



def _pack_out_dir():
    """0.7.54：卡包落盘目录 = cardsDir 同级「卡包」，不存在就建。"""
    try:
        cd = os.path.abspath(CFG.get('cardsDir') or '') if isinstance(CFG, dict) else ''
    except Exception:
        cd = ''
    base = os.path.dirname(cd) if cd else ''
    d = os.path.join(base, '卡包') if base else os.path.join(os.getcwd(), '卡包')
    if not os.path.isdir(d):
        os.makedirs(d)
    return d


def _reveal_card_target(path, kind):
    """0.7.52：打开某类卡片的落盘位置。path 有值且存在就选中它，否则按 kind 打开目录。"""
    k = str(kind or '').strip().lower()
    raw = str(path or '').strip()
    try:
        cd = os.path.abspath(CFG.get('cardsDir') or '') if isinstance(CFG, dict) else ''
    except Exception:
        cd = ''
    base = os.path.dirname(cd) if cd else ''
    dirs = {
        'cards': cd,
        'style': (os.path.join(base, '\u753b\u98ce') if base else ''),
        'dict': (os.path.join(base, '\u8bcd\u5e93') if base else ''),
        'pack': (os.path.join(base, '卡包') if base else ''),
    }
    want = dirs.get(k, '')
    if raw:
        p = os.path.abspath(raw)
        if os.path.isfile(p):
            ok, m = _reveal_in_explorer(p)
            return (ok, m, p)
        if os.path.isdir(p):
            want = p
    if not want:
        return (False, '\u6ca1\u6709\u53ef\u6253\u5f00\u7684\u76ee\u5f55\uff08config.json \u6ca1\u914d cardsDir\uff09', '')
    if not os.path.isdir(want):
        try:
            os.makedirs(want)
        except Exception as e:
            return (False, '\u76ee\u5f55\u4e0d\u5b58\u5728\u4e5f\u5efa\u4e0d\u51fa\u6765: %s (%s)' % (want, e), want)
    if os.name != 'nt':
        return (False, '\u4ec5\u652f\u6301 Windows', want)
    try:
        os.startfile(want)
        return (True, '\u5df2\u6253\u5f00\u76ee\u5f55', want)
    except Exception as e:
        return (False, str(e), want)


class H(BaseHTTPRequestHandler):
    routes = []

    def _cors(self):
        # ⚠️ 不能回 '*'：回 '*' 时 evil.com 的预检会通过，浏览器就能带着自定义头
        #    打侧车（见 docs/生成经验.md #8）。这里只回显白名单内的 Origin。
        _ao = self.headers.get('Origin') or ''
        self.send_header('Access-Control-Allow-Origin', _ao if (_ao and _origin_ok(self)) else 'null')
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers',
                         'Content-Type, X-Console-Token, X-Console-Client')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        # 自定义头默认不暴露给浏览器 JS，导出的文件名/统计靠它，必须显式放行
        self.send_header('Access-Control-Expose-Headers', 'X-Card-Meta, Content-Length')

    def _json(self, code, obj):
        if not _origin_ok(self):
            code = 403
            obj = {'ok': False, 'error': 'forbidden origin'}
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self._cors()
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()


    def do_GET(self):
        p = self.path.split('?')[0]
        if not _auth_ok(self, p):
            self._json(401, {'ok': False, 'error': 'missing or bad X-Console-Token'})
            return
        if p == '/stylecards/packed':
            self._json(200, _stylecards_packed())
            return
        if p == '/version':
            now = _pkg_meta()
            self._json(200, {
                'ok': True,
                'loaded': VERSION_LOADED,              # 本进程装载时的版本
                'disk': now.get('version') or '',      # 磁盘上现在的版本
                'stale': bool(now.get('version') and VERSION_LOADED
                              and now.get('version') != VERSION_LOADED),
                'configVersion': CONFIG_VERSION,
                'configVersionOnDisk': (CFG.get('configVersionRaw') if isinstance(CFG, dict) else None),
                'minHost': _PKG.get('minHost') or '',
                'pid': os.getpid(),
                'startedAt': STARTED_AT,
                'unknownConfigKeys': (CFG.get('unknownKeys') or []) if isinstance(CFG, dict) else [],
                'limits': {'json': MAX_BODY, 'upload': MAX_BODY_UPLOAD, 'uploadPaths': list(UPLOAD_PATHS)},
                'tokenRequired': _token_required(),
            })
            return
        if p == '/health':
            self._json(200, {'ok': True, 'routes': [r['name'] for r in self.routes]})
        elif p == '/routes':
            self._json(200, {'routes': all_routes(force='refresh' in (self.path or '')), 'probed': _PROBE_DIAG})
        elif p == '/models':
            self._json(200, {'ok': True, 'models': _models_list(self.routes, self.path)})
        elif p == '/local/status':
            self._json(200, local_llm_status())
        elif p == '/comfy/status':
            self._json(200, COMFY.status())
        elif p == '/comfy/queue':
            # 让页面能区分"还在跑"和"失败了"，而不是傻等超时。
            info = {'running': COMFY.running(), 'busy': False, 'queue_running': 0,
                    'queue_pending': 0, 'exec_info': {}}
            if info['running']:
                try:
                    q = _http_json(COMFY_BASE + '/queue', '', timeout=5)
                    info['queue_running'] = len(q.get('queue_running') or [])
                    info['queue_pending'] = len(q.get('queue_pending') or [])
                    info['busy'] = info['queue_running'] > 0
                except Exception as e:
                    info['error'] = str(e)
            self._json(200, info)
        elif p == '/config/save':
            d = _save_dir()
            self._json(200, {
                'ok': True, 'dir': d,
                'exists': bool(d) and os.path.isdir(d),
            })
        elif p == '/cards':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            d = ((q.get('dir') or [''])[0] or ((CFG.get('cardsDir') or '') if isinstance(CFG, dict) else ''))
            self._json(200, _cards_scan(d))
        elif p == '/loras':
            qs = self.path.split('?', 1)[1] if '?' in self.path else ''
            self._json(200, _loras_list('sha=1' in qs))
        elif p == '/dir/list':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            kind = ((q.get('kind') or ['cards'])[0] or 'cards')
            self._json(200, _dir_scan(kind))
        elif p == '/lllite':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            d = ((q.get('dir') or [''])[0] or '')
            self._json(200, _lllite_tables(d))
        elif p == '/config/outdir':
            d = (CFG.get('outputDir') or '') if isinstance(CFG, dict) else ''
            self._json(200, {
                'ok': True, 'dir': d,
                'exists': bool(d) and os.path.isdir(d),
            })
        else:
            self._json(404, {'error': 'not found'})

    def do_POST(self):
        p = self.path.split('?')[0]
        if not _auth_ok(self, p):
            self._json(401, {'ok': False, 'error': 'missing or bad X-Console-Token'})
            return
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except Exception:
            n = 0
        limit = MAX_BODY_UPLOAD if p in UPLOAD_PATHS else MAX_BODY
        if n > limit:
            self._json(413, {'ok': False, 'error': 'body 过大: %d 字节（该接口上限 %d）' % (n, limit)})
            return
        if p == '/stylecards/unpack':
            auto = 'auto=1' in (self.path or '')
            import time as _t
            _t0 = _t.time()
            _r = _stylecards_unpack(self, n, 1 if auto else 0)
            _line = '[unpack %s] %.1f MB %.2fs auto=%d ok=%s card=%s err=%s' % (
                _t.strftime('%Y-%m-%d %H:%M:%S'), n / 1048576.0, _t.time() - _t0, auto,
                _r.get('ok'), ((_r.get('card') or {}).get('name') or ''), (_r.get('error') or ''))
            print(_line, flush=True)
            try:
                _lg = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')
                os.makedirs(_lg, exist_ok=True)
                with open(os.path.join(_lg, 'unpack.log'), 'a', encoding='utf-8') as _f:
                    _f.write(_line + '\n')
            except Exception:
                pass
            self._json(200, _r)
            return
        if p == '/loras/import' and (self.headers.get('X-Filename') or ''):
            # 浏览器上传：body 是文件本身（不是 JSON），文件名走 X-Filename（URL 编码过）
            import urllib.parse as _up
            fn = _up.unquote(self.headers.get('X-Filename') or '')
            self._json(200, _loras_import_stream(self.rfile, n, fn))
            return
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except Exception as e:
            self._json(400, {'error': 'bad json: %s' % e})
            return
        if not isinstance(body, dict):
            self._json(400, {'ok': False, 'error': 'body 必须是 JSON 对象'})
            return

        if p == '/cards/validate':
            self._json(200, _card_validate(body))
            return

        if p in ('/stylecards/pack', '/cards/pack'):
            out, meta = _pack_build(body.get('card') or {},
                                    body.get('cardType') or ('role' if p == '/cards/pack' else 'style'),
                                    body.get('mode') or 'hybrid', body.get('embed') or [],
                                    bool(body.get('embedPatches')), bool(body.get('embedAssets')))
            plan = (meta or {}).pop('_pack_plan', None)
            if plan is None:
                self._json(400, meta or {'ok': False, 'error': '打包失败'})
                return
            blob_list = plan.get('blobs') or []
            head_bytes = plan.get('header') or b''
            total = len(head_bytes) + sum(os.path.getsize(x) for x in blob_list)
            meta['bytes'] = total
            if bool(body.get('toDisk')):
                d_out = _pack_out_dir()
                fn = str(meta.get('filename') or '').strip() or 'card.dslcard'
                fn = ''.join(ch for ch in fn if ch not in '\\/:*?"<>|').strip() or 'card.dslcard'
                fp_out = os.path.join(d_out, fn)
                n = 2
                while os.path.isfile(fp_out):
                    stem, ext2 = os.path.splitext(fn)
                    fp_out = os.path.join(d_out, '%s-%d%s' % (stem, n, ext2))
                    n += 1
                try:
                    with open(fp_out, 'wb') as fh2:
                        fh2.write(head_bytes)
                        for fpp in blob_list:
                            with open(fpp, 'rb') as f2:
                                while True:
                                    b3 = f2.read(1 << 20)
                                    if not b3:
                                        break
                                    fh2.write(b3)
                except Exception as e:
                    self._json(500, {'ok': False, 'error': '\u5199\u5361\u5305\u5931\u8d25: %s' % e})
                    return
                out_meta = dict(meta)
                out_meta['ok'] = True
                out_meta['path'] = fp_out
                out_meta['bytes'] = total
                out_meta['filename'] = os.path.basename(fp_out)
                self._json(200, out_meta)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(total))
            self.send_header('X-Card-Meta', json.dumps(meta))
            self._cors()
            self.end_headers()
            self.wfile.write(head_bytes)
            for fp in blob_list:
                with open(fp, 'rb') as fh:
                    while True:
                        b2 = fh.read(1 << 20)
                        if not b2:
                            break
                        self.wfile.write(b2)
            return

        if p == '/cards/import':
            self._json(200, _cards_import(body or {}))
            return

        if p == '/cards/selfcontained':
            self._json(200, _cards_selfcontained(body or {}))
            return

        if p == '/cards/write':
            self._json(200, _cards_write(body))
            return
        if p == '/lllite/assets/add':
            self._json(200, _lllite_asset_add(body or {}))
            return
        if p == '/lllite/stage':
            # 把控制图与 LLLite 权重摆到 ComfyUI 能看见的位置，返回可写进 graph 的短名。
            # 面板 graph 走原生 ModelPatchLoader + AnimaLLLiteApply，这两个节点只认目录里的名字。
            body = body or {}
            try:
                root = _lllite_root(body.get('dir'))
                tables = _lllite_tables(root)
                assets = tables.get('assets') or {}
                weights = tables.get('weights') or {}
                aid = str(body.get('asset') or '')
                wk = str(body.get('weights_key') or '')
                a = assets.get(aid) or {}
                w = weights.get(wk) or {}
                if not a or not w:
                    out = {'ok': False, 'error': '资产或权重不在表里: %s / %s' % (aid, wk)}
                else:
                    out = {'ok': True, 'image': _stage_control_image(root, a),
                           'patch': _stage_lllite_weights(root, wk, w),
                           'weights_key': wk, 'asset': aid}
            except Exception as e:
                out = {'ok': False, 'error': 'staging 失败: %s' % e}
            self._json(200, out)
            return
        if p == '/lllite/resolve':
            self._json(200, _lllite_resolve(body))
            return
        if p == '/local/start':
            self._json(200, start_local_llm())
            return
        if p == '/local/stop':
            self._json(200, stop_local_llm())
            return
        if p == '/routes':
            try:
                act = body.get('action') or 'add'
                rs = load_user_routes()
                base = (body.get('base') or '').rstrip('/')
                model = body.get('model') or ''
                if act == 'add' and base:
                    rs = [r for r in rs if not (r.get('base', '').rstrip('/') == base
                                                and (r.get('model') or '') == model)]
                    rs.append({'name': body.get('name') or base, 'base': base,
                               'key': body.get('key') or '', 'model': model})
                    save_user_routes(rs)
                    self._json(200, {'ok': True, 'routes': all_routes(force=True)})
                elif act == 'delete' and base:
                    rs = [r for r in rs if not (r.get('base', '').rstrip('/') == base
                                                and (r.get('model') or '') == model)]
                    save_user_routes(rs)
                    self._json(200, {'ok': True, 'routes': all_routes(force=True)})
                else:
                    self._json(400, {'error': 'base 不能为空'})
            except Exception as e:
                self._json(500, {'error': str(e)})
        elif p == '/models':
            self._json(200, {'ok': True, 'models': _models_list(self.routes, self.path)})
        elif p == '/expand':
            try:
                self._json(200, expand(body.get('text', ''), body.get('negative', ''), self.routes,
                                    body.get('route'), body.get('model'), body.get('kind') or 'expand'))
            except Exception as e:
                self._json(502, {'error': str(e)})
        elif p == '/comfy/start':
            ok, m = COMFY.start()
            self._json(200 if ok else 500, {'ok': ok, 'message': m, 'status': COMFY.status()})
        elif p == '/comfy/touch':
            COMFY.touch()
            self._json(200, {'ok': True, 'status': COMFY.status()})
        elif p == '/comfy/unload':
            ok, m = COMFY.unload()
            self._json(200 if ok else 500, {'ok': ok, 'message': m, 'status': COMFY.status()})
        elif p == '/comfy/stop':
            ok, m = COMFY.stop()
            self._json(200 if ok else 500, {'ok': ok, 'message': m, 'status': COMFY.status()})
        elif p == '/open':
            err, path = _resolve_output(body.get('filename', ''), body.get('subfolder', ''))
            if err:
                self._json(400, {'ok': False, 'error': err, 'path': path})
            else:
                ok, m = _reveal_in_explorer(path)
                self._json(200 if ok else 500, {'ok': ok, 'message': m, 'path': path})
        elif p == '/config/save':
            ok, m, d = _set_save_dir(body.get('dir', ''))
            self._json(200 if ok else 400, {'ok': ok, 'message': m, 'dir': d})
        elif p == '/reveal':
            ok, m, tpath = _reveal_card_target(body.get('path', ''), body.get('kind', ''))
            self._json(200 if ok else 400, {'ok': ok, 'message': m, 'error': ('' if ok else m), 'path': tpath})
        elif p == '/save-json':
            fn0 = str(body.get('filename') or 'export.json').strip()
            # 0.7.78：拒绝 .. 路径段（以前会被拼成 '....逃逸.json' 落在卡包目录里）
            if '..' in fn0 or fn0.rstrip() in ('.', ''):
                self._json(400, {'ok': False, 'error': 'filename 非法（不能含 ..）: %s' % fn0})
                return
            txt = body.get('text')
            if txt is None:
                self._json(400, {'ok': False, 'error': '\u7f3a text'})
                return
            try:
                d_out = _pack_out_dir()
                fn = ''.join(ch for ch in fn0 if ch not in '\\/:*?"<>|').strip() or 'export.json'
                fp = os.path.join(d_out, fn)
                n2 = 2
                while os.path.isfile(fp):
                    stem, ext2 = os.path.splitext(fn)
                    fp = os.path.join(d_out, '%s-%d%s' % (stem, n2, ext2))
                    n2 += 1
                data = str(txt).encode('utf-8')
                with open(fp, 'wb') as fh3:
                    fh3.write(data)
                self._json(200, {'ok': True, 'path': fp, 'bytes': len(data)})
            except Exception as e:
                self._json(500, {'ok': False, 'error': '\u5199\u6587\u4ef6\u5931\u8d25: %s' % e})
        elif p == '/log':
            txt = str(body.get('text') or '')[:4000]
            try:
                lp = os.path.join(WORK_DIR, 'client-err.log')
                with open(lp, 'a', encoding='utf-8') as fh9:
                    fh9.write(time.strftime('[%Y-%m-%d %H:%M:%S] ') + txt + '\n')
                self._json(200, {'ok': True, 'path': lp})
            except Exception as e:
                self._json(500, {'ok': False, 'error': str(e)})
        elif p == '/loras/import':
            # 网址 / 本机路径（含 .zip）三态；上传模式在上面已 return
            _u = str(body.get('url') or '').strip()
            _p = str(body.get('path') or '').strip().strip('"')
            if _u:
                self._json(200, _loras_import_url(_u, body.get('token') or '', body.get('filename') or ''))
            elif _p.lower().endswith('.zip'):
                self._json(200, _loras_import_zip(_p))
            else:
                self._json(200, _loras_import_path(_p))
        elif p == '/loras/scan':
            self._json(200, _loras_scan(body.get('dir') or ''))
        elif p == '/loras/del':
            self._json(200, _loras_del(body.get('name') or ''))
        elif p == '/dir/write':
            self._json(200, _dir_write(body or {}))
        elif p == '/dir/clear':
            self._json(200, _dir_clear(body or {}))
        elif p == '/dir/split':
            self._json(200, _dir_split(str((body or {}).get('kind') or 'cards')))
        elif p == '/dir/del':
            self._json(200, _dir_del(body or {}))
        elif p == '/save':
            ok, m, path = _copy_to_save(body.get('filename', ''), body.get('subfolder', ''))
            self._json(200 if ok else 400, {'ok': ok, 'message': m, 'path': path})
        elif p == '/config/outdir':
            ok, m, d = _set_output_dir(body.get('dir', ''))
            self._json(200 if ok else 400, {'ok': ok, 'message': m, 'dir': d})
        elif p == '/comfy/restart':
            okStop, mStop = COMFY.stop()
            ok, m = COMFY.start()
            if not ok and not okStop:
                m = '%s；%s' % (mStop, m)
            self._json(200 if ok else 500, {'ok': ok, 'message': m, 'status': COMFY.status()})
        else:
            self._json(404, {'error': 'not found'})

    def log_message(self, *a):
        pass


# ===== 风格卡自包含容器 .dslcard v2（卡 + 内嵌 LoRA 权重） =====




def _mark_started_ok(port):
    """往 work/sidecar.err.log 追加一行「本次起来了」。

    err.log 只增不减：历史失败的 traceback 会一直留在里面（2026-10-22 报告 ②）。
    成功启动时补一条状态行，看日志的人一眼就知道哪一段是本次运行的。
    """
    try:
        with open(os.path.join(WORK_DIR, 'sidecar.err.log'), 'a', encoding='utf-8') as f:
            f.write('---------- started OK %s pid=%d port=%d v%s ----------\n'
                    % (time.strftime('%Y-%m-%dT%H:%M:%S'), os.getpid(), port, VERSION_LOADED or '?'))
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=CFG['sidecarPort'])
    ap.add_argument('--no-watch', action='store_true', help='关掉闲置自动卸载')
    a = ap.parse_args()
    H.routes = load_routes()

    if _port_already_serving(a.port):
        print('端口 %d 已有 sidecar 在服务，本次直接退出（不重复起）' % a.port)
        return 0

    try:
        srv = ThreadingHTTPServer(('127.0.0.1', a.port), H)
    except OSError as e:
        print('端口 %d 绑不上（%s），退出' % (a.port, e))
        return 0

    print('DSH sidecar @ http://127.0.0.1:%d  (v%s · configVersion %d)'
          % (a.port, VERSION_LOADED or '?', CONFIG_VERSION))
    print('  扩写路线（按序试）:', ', '.join(r['name'] for r in H.routes))
    print('  ComfyUI 闲置 %.0f 分钟自动卸载模型（进程保留）' % (AUTO_UNLOAD_SECONDS / 60))
    print('  ComfyUI 当前状态:', '运行中' if COMFY.running() else '未运行')
    _mark_started_ok(a.port)

    if not a.no_watch:
        t = threading.Thread(target=COMFY.watcher, daemon=True)
        t.start()

    srv.serve_forever()
    return 0


if __name__ == '__main__':
    sys.exit(main())
