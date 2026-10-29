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
import mimetypes
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
    _loras_file,
    _loras_rename,
    _loras_move,
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
# A 线（preview/8200）功能移植：模型库 / 历史 / 设置等 27 条路由的实现都搬到这里。
# 导入时会读一次配置，比 try_proxy 稳（不依赖 8200 是否在跑）。
try:
    import sidecar_aline as ALINE
except Exception as _aline_err:  # 移植模块坏了不能让整个 sidecar 起不来
    ALINE = None
    print('[aline] 模块导入失败，A 线路由将返回 503:', _aline_err)

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
            # 前端（A-alpha 移植块 verifySidecarHealth）按 apiVersion 校验 Sidecar 能力。
            # 8199 通过 sidecar_preview 透明代理提供了 A 线 v15 的全部路由，所以如实声明 15；
            # service / sidecarPort / instanceId 三个字段缺一个，前端就整块不认。
            try:
                _bound = int(self.server.server_address[1])
            except Exception:
                _bound = 0
            self._json(200, {'ok': True, 'service': 'dsh-comfyui-console', 'apiVersion': 15,
                             'dictionaryVersion': 1, 'postControlsVersion': 1, 'faceModelsVersion': 1,
                             'onlineModelsVersion': 2, 'modelAssetsVersion': 2, 'modelBrowserVersion': 2,
                             'routes': [r['name'] for r in self.routes],
                             'comfyPort': COMFY_PORT, 'sidecarPort': _bound,
                             'platform': os.name, 'instanceId': CFG.get('instanceId', '')})
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
            d = _loras_list('sha=1' in qs)
            # 0.7.136：给每个 LoRA 补上底模分类，前端据此分组。
            # _infer_model_base 读 safetensors header 里的 modelspec.architecture /
            # ss_base_model_version / ss_sd_model_name / modelspec.title，
            # 底层 _model_header_info_cached 按 realpath+size+mtime 缓存，二次请求几乎零成本。
            # ?base=0 可跳过（只想要快列表时用）。
            if 'base=0' not in qs:
                root = d.get('dir') or ''
                for it in (d.get('loras') or []):
                    try:
                        fp = os.path.join(root, str(it.get('name') or '').replace('/', os.sep))
                        it['base'] = ALINE._infer_model_base(ALINE._read_safetensors_metadata(fp))
                    except Exception:
                        it['base'] = '未知'
            self._json(200, d)
        elif p == '/loras/file':
            # 导出一个 LoRA：浏览器 <a download> 直接拉，所以不能要求自定义头（走 auth 白名单）。
            _q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            _nm = ((_q.get('name') or [''])[0] or '')
            _got, _err = _loras_file(_nm)
            if not _got:
                self._json(404, {'ok': False, 'error': _err})
                return
            _fp, _sz = _got
            _bn = os.path.basename(_fp)
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', str(_sz))
                # 中文文件名（<LoRA>.safetensors / <画风卡>-…）必须用 RFC 5987 的 filename*
                self.send_header('Content-Disposition',
                                 "attachment; filename*=UTF-8''%s" % urllib.parse.quote(_bn))
                self._cors()
                self.send_header('Access-Control-Expose-Headers', 'Content-Disposition')
                self.end_headers()
                with open(_fp, 'rb') as _f:
                    while True:
                        _blk = _f.read(1 << 20)
                        if not _blk:
                            break
                        self.wfile.write(_blk)
            except Exception:
                pass
            return
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
        # ---- 模型库（0.8.0 从 A 线 preview/8200 移植，实现在 sidecar_aline.py）----
        elif p == '/models/roots':
            kind = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('kind') or ['checkpoint'])[0]
            try:
                self._json(200, ALINE._model_roots_info(kind))
            except ValueError as ex:
                self._json(400, {'error': str(ex)})
        elif p in ('/models/catalog', '/models/browser'):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                if p == '/models/catalog':
                    result = ALINE._model_browser_catalog((q.get('q') or [''])[0])
                else:
                    result = ALINE._browse_model_library(
                        (q.get('kind') or ['models'])[0], (q.get('root_id') or ['0'])[0],
                        (q.get('folder') or [''])[0], (q.get('q') or [''])[0],
                        (q.get('preferred') or [''])[0], tree=(q.get('tree') or ['0'])[0] == '1')
                self._json(200, result)
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
        elif p == '/models/library':
            kind = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('kind') or ['checkpoint'])[0]
            try:
                self._json(200, ALINE._scan_model_library(kind))
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
        elif p == '/models/preview':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                root, source = ALINE._resolve_model_file(
                    (q.get('kind') or ['checkpoint'])[0], (q.get('name') or [''])[0],
                    (q.get('root_id') or [None])[0])
                found = ALINE._model_assets().read_preview(
                    root, source, (q.get('asset') or [None])[0], store=ALINE._model_assets_base())
                if not found:
                    self._json(404, {'error': '没有可用本地预览图'})
                    return
                path, mime, data = found
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'private, max-age=300')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self._cors()
                self.end_headers()
                self.wfile.write(data)
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
        elif p == '/models/detail':
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                self._json(200, ALINE._model_detail(
                    (q.get('kind') or ['checkpoint'])[0], (q.get('name') or [''])[0],
                    (q.get('root_id') or [None])[0]))
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
# ---- 历史 / 设置 / 翻译 / 在线（0.8.0 从 A 线 preview/8200 移植）----
        elif p == '/translation/status':
            try:
                self._json(200, ALINE._translation().status())
            except Exception as ex:
                self._json(503, {'error': str(ex)})
        elif p == '/settings':
            self._json(200, ALINE._public_settings())
        elif p == '/outputs/detail':
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            try: self._json(200, ALINE._output_detail((q.get('path') or [''])[0]))
            except (ValueError, OSError) as ex: self._json(400, {'error': str(ex)})
        elif p == '/outputs/thumb':
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            try:
                data = ALINE._thumbnail_for_output((q.get('path') or [''])[0], (q.get('quality') or ['medium'])[0])
                self.send_response(200)
                self.send_header('Content-Type', 'image/webp')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'private, max-age=300')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self._cors(); self.end_headers(); self.wfile.write(data)
            except (ValueError, OSError) as ex: self._json(400, {'error': str(ex)})
        elif p == '/outputs/view':
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            try:
                path = ALINE._authorized_output_path((q.get('path') or [''])[0])
                size = os.path.getsize(path)
                if size > 256 * 1024 * 1024: raise ValueError('输出图片超过 256 MiB 上限')
                mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(size))
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Cache-Control', 'private, max-age=30')
                self._cors(); self.end_headers()
                with open(path, 'rb') as inp:
                    while True:
                        chunk=inp.read(1024*1024)
                        if not chunk: break
                        self.wfile.write(chunk)
            except (ValueError, OSError) as ex: self._json(400, {'error': str(ex)})
        elif p == '/outputs':
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            request_id = (q.get('request_id') or [None])[0]
            event = None
            try:
                if request_id is not None:
                    event = ALINE._register_model_task(request_id)
                result = ALINE._scan_outputs((q.get('limit') or ['1000'])[0], (q.get('offset') or ['0'])[0],
                                       **({'cancel_event': event} if event is not None else {}))
                self._json(200, result)
            except ModelTaskCancelled as ex:
                self._json(409, {'error': str(ex), 'cancelled': True})
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
            finally:
                if event is not None:
                    ALINE._finish_model_task(request_id, event)
        elif p == '/comfy/online':
            # UI 轮询专用：只检测 ComfyUI API，避免队列接口阻塞导致状态误判。
            self._json(200, {'running': COMFY.running()})
        # ---- 诊断 / ComfyUI 更新（0.8.0 从 A 线移植）----
        elif p == '/diagnostics/compatibility':
            try: self._json(200, ALINE.COMPATIBILITY.snapshot(CFG, ALINE._path_settings(), ALINE.CROSS_PATHS, ALINE.RUNTIME_BRIDGE.probe, ALINE.BOUND_SIDECAR_PORT))
            except (ValueError,OSError) as ex: self._json(400, {'error':str(ex)})
        elif p == '/comfy/update':
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            self._json(200, ALINE._comfy_update_info(bool((q.get('refresh') or ['0'])[0] not in ('0', 'false', ''))))
        # ---- 生成后控制 / 词库 / 在线模型（0.8.0 从 A 线移植）----
        elif p in ('/post/workflows','/post/dependencies'):
            try:
                service,deps=ALINE._post_services()
                self._json(200,service.workflows() if p=='/post/workflows' else deps.status())
            except Exception as ex:self._json(400,{'error':str(ex)[:600]})
        elif p.startswith('/dictionary/'):
            self._dictionary_request('GET', p)
        elif p.startswith('/online/'):
            self._online_request('GET', p)
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
            _raw = self.rfile.read(n)
            body = json.loads(_raw or b'{}')
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
        elif p == '/loras/rename':
            self._json(200, _loras_rename(body.get('name') or '', body.get('newName') or ''))
        elif p == '/loras/move':
            self._json(200, _loras_move(body.get('name') or '', body.get('folder') or ''))
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
        # ---- 模型库写操作（0.8.0 从 A 线 preview/8200 移植）----
        elif p == '/models/manage':
            try:
                self._json(200, ALINE._manage_model_files(body))
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
        elif p in ('/models/tasks/cancel', '/outputs/tasks/cancel'):
            self._json(200, {'cancelled': ALINE._cancel_model_task((body or {}).get('request_id'))})
        elif p == '/models/preview':
            request_id = (body or {}).get('request_id')
            event = None
            try:
                if request_id is not None:
                    event = ALINE._register_model_task(request_id)
                kind = str((body or {}).get('kind') or 'checkpoint')
                name = str((body or {}).get('name') or '')
                root_id = (body or {}).get('root_id')
                kw = {'cancel_event': event} if event is not None else {}
                self._json(200, ALINE._fetch_model_preview(kind, name, root_id, fill=True, **kw))
            except ALINE.ModelTaskCancelled as ex:
                self._json(499, {'error': str(ex) or 'cancelled'})
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
# ---- 历史 / 设置 / 翻译 / 扩写（0.8.0 从 A 线 preview/8200 移植）----
        elif p == '/translation/install':
            try:
                self._json(200, ALINE._translation().install())
            except Exception as ex:
                self._json(503, {'error': str(ex)})
        elif p == '/preview/translate':
            try:
                engine = ALINE._translation()
                self._json(200, ALINE._translation_module.preview_translate(ALINE._dictionary(), engine, body.get('texts', [])))
            except ValueError as ex:
                self._json(400, {'error': str(ex)})
            except Exception as ex:
                self._json(503, {'error': str(ex)})
        elif p in ('/outputs/preview-targets','/outputs/add-preview','/models/previews/manage'):
            try:
                fn={'/outputs/preview-targets':_output_preview_targets,'/outputs/add-preview':_add_output_preview,'/models/previews/manage':_manage_model_preview}[p]
                self._json(200,fn(body))
            except (ValueError,OSError) as ex:self._json(400,{'error':str(ex)[:600]})
            except Exception as ex:self._json(503,{'error':str(ex)[:600]})
        elif p == '/outputs/save-temp':
            try: self._json(200, ALINE._save_temp_to_custom(body))
            except (ValueError, OSError) as ex: self._json(400, {'error': str(ex)})
        elif p == '/outputs/manage':
            try: self._json(200, ALINE._manage_output(body))
            except (ValueError, OSError) as ex: self._json(400, {'error': str(ex)})
        elif p == '/filesystem/pick-folder':
            try: self._json(200, ALINE._pick_folder(body.get('initial', '')))
            except (ValueError, OSError, subprocess.SubprocessError) as ex: self._json(400, {'error': str(ex)})
        elif p == '/settings':
            try:
                if ALINE._POST_DEPENDENCIES and ALINE._POST_DEPENDENCIES.thread and ALINE._POST_DEPENDENCIES.thread.is_alive():raise ValueError('FaceDetailer 安装期间不能更改连接配置')
                if COMFY.running() and int(body.get('comfyPort', COMFY_PORT)) != COMFY_PORT:
                    raise ValueError('ComfyUI 正在运行，修改端口前请先关闭它')
                settings = ALINE._update_launch_settings(body)
                self._json(200, {'ok': True, 'settings': settings})
            except (ValueError, OSError) as ex:
                self._json(400, {'error': str(ex)})
        elif p == '/expand/cancel':
            try:
                ALINE.EXPANSIONS.cancel(body.get('request_id'))
                self._json(200, {'ok':True, 'cancelled':True})
            except ValueError as ex:
                self._json(400, {'error':str(ex)})
        elif p in ('/expand', '/weight-language'):
            try:
                # 老客户端没有 request_id 时仍可扩写，但无法精确取消。
                import uuid
                job_id = body.get('request_id') or 'legacy-' + uuid.uuid4().hex
                result = ALINE.EXPANSIONS.run(job_id, {'text':body.get('text', ''),
                    'negative':body.get('negative', ''), 'model_profile':body.get('model_profile'),
                    'action': 'weight-language' if p == '/weight-language' else 'expand'})
                self._json(200, result)
            except ValueError as ex:
                self._json(400, {'error':str(ex)})
            except Exception as ex:
                self._json(502, {'error':str(ex)})
        elif p == '/comfy/open-browser':
            opened = ALINE._open_default_browser(ALINE._comfy_browser_url())
            self._json(200 if opened else 500, {'ok': opened, 'url': ALINE._comfy_browser_url()})
        # ---- 提示词精修 / ComfyUI 更新执行（0.8.0 从 A 线移植）----
        elif p == '/comfy/update':
            try:
                self._json(200, ALINE._apply_comfy_update())
            except (ValueError, OSError, subprocess.SubprocessError) as ex:
                self._json(409, {'error': str(ex)[:800]})
        elif p == '/refine':
            try:
                result = ALINE.refine(body.get('positive', ''), body.get('negative', ''),
                                body.get('instruction', ''), body.get('history', []), self.routes, body.get('model_profile'))
                self._json(200, result)
            except Exception as e:
                self._json(502, {'error':str(e)})
        # ---- 生成后控制 / 词库 / 在线模型（0.8.0 从 A 线移植）----
        elif p.startswith('/post/'):
            try:
                service,deps=ALINE._post_services()
                functions={'/post/workflows':lambda:service.save_workflow(body),'/post/workflows/delete':lambda:service.delete_workflow(body),
                           '/post/complete':lambda:service.complete(body),'/post/dependencies/install':lambda:deps.start(body),'/post/dependencies/cancel':deps.cancel,'/post/bridge/install':deps.install_bridge}
                if p not in functions:raise ValueError('未知生成后控制请求')
                self._json(200,functions[p]())
            except Exception as ex:self._json(400,{'error':str(ex)[:600]})
        elif p.startswith('/online/'):
            self._online_request('POST' , p, body)
        elif p.startswith('/dictionary/'):
            self._dictionary_request('POST', p, body)
        else:
            self._json(404, {'error': 'not found'})

    # ---- 词库 / 在线模型 / 生成后控制（0.8.0 从 A 线移植）----
    def _dictionary_request(self, method, path, body=None):
        try:
            result = ALINE._dictionary().handle(method,path,urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query),body or {})
            self._json(200,result)
        except Exception as ex:
            if isinstance(ex,(ValueError,TypeError,KeyError)) or type(ex).__name__=='IntegrityError':
                self._json(400,{'error':str(ex)})
            else:
                self._json(503,{'error':'词库暂不可用：'+str(ex)})


    def _dictionary_mutation(self, method):
        if not _auth_ok(self, self.path.split("?")[0]): return
        path=urllib.parse.urlsplit(self.path).path
        if not path.startswith('/dictionary/'):
            self._json(404,{'error':'not found'}); return
        try:
            n=int(self.headers.get('Content-Length') or 0)
            if not 0<=n<=self.MAX_BODY:
                self._json(413,{'error':'request body too large'}); return
            body=json.loads(self.rfile.read(n) or b'{}')
            if not isinstance(body,dict): raise ValueError('expected JSON object')
        except (ValueError,TypeError) as ex:
            self._json(400,{'error':str(ex)}); return
        self._dictionary_request(method,path,body)


    def do_PATCH(self):
        self._dictionary_mutation('PATCH')


    def do_DELETE(self):
        self._dictionary_mutation('DELETE')


    def _online_request(self, method, path, body=None):
        try:
            service = ALINE._online_models()
            query = {key: values[0] for key, values in urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).items()}
            if method == 'GET' and path.startswith('/online/images/'):
                mime, data = service.image(path.rsplit('/', 1)[-1])
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Cache-Control', 'private, max-age=300')
                self._cors(); self.end_headers(); self.wfile.write(data)
                return
            if method == 'POST' and path == '/online/diagnostics':
                result = service.diagnose(body or {})
            elif method == 'GET' and re.fullmatch(r'/online/diagnostics/[a-f0-9]{32}', path):
                result = service.diagnosis(path.rsplit('/', 1)[-1])
            elif method == 'GET' and path == '/online/search':
                query['nsfw'] = query.get('nsfw') == '1'
                result = service.search(query)
            elif method == 'GET' and path == '/online/detail':
                result = service.detail(query.get('provider'), query.get('id'))
            elif method == 'GET' and path == '/online/targets':
                result = service.targets()
            elif method == 'GET' and path == '/online/downloads':
                result = service.downloads()
            elif path == '/online/settings' and method in ('GET', 'POST'):
                result = service.settings(body if method == 'POST' else None)
            elif method == 'POST' and path == '/online/access':
                result = service.check_access(body or {})
            elif method == 'POST' and path == '/online/downloads':
                result = service.start(body or {})
            elif method == 'POST' and re.fullmatch(r'/online/downloads/[a-f0-9]{32}/pause', path):
                result = service.pause(path.split('/')[-2])
            elif method == 'POST' and re.fullmatch(r'/online/downloads/[a-f0-9]{32}/retry', path):
                result = service.retry(path.split('/')[-2])
            elif method == 'POST' and path == '/online/downloads/clear':
                result = service.clear_finished()
            elif method == 'POST' and re.fullmatch(r'/online/downloads/[a-f0-9]{32}/cancel', path):
                result = service.cancel(path.split('/')[-2])
            else:
                self._json(404, {'error': '在线模型库接口不存在'}); return
            self._json(200, result)
        except ValueError as ex:
            self._json(400, {'error': str(ex)})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as ex:
            self._json(502, {'error': str(ex)[:700]})


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
