"""侧车的访问控制：本机 Origin 白名单 + X-Console-Token。

从 expander.py 拆出（0.5.4）。默认 fail closed：取不到 token 就拒绝，
只有带本机 Origin 的页面请求（浏览器直连）才免 token。
"""

import os
import re
import secrets
import time

from sidecar_state import (
    CFG,
    WORK_DIR,
)





# ⚠️ 2026-10-21：DSH **桌面版**的渲染进程 origin 是 `dsh-app://app`，不是 localhost。
#    只认 localhost 会让桌面版面板的每个请求都 403 + ACAO null（表现是"连不上侧车"）。
#    dsh-app:// 只由本应用注册，等价于"自己的 UI"，不比 localhost 宽。
_LOCAL_ORIGIN_RE = re.compile(
    r'^(?:https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?'
    r'|dsh-app://[A-Za-z0-9._-]+)$')
_LAN_ORIGIN_RE = re.compile(
    r'^https?://(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$')


def _origin_ok(handler):
    """只放行本机页面（带 Origin 时）；allowLan=true 时额外放行私网段页面。

    不带 Origin 的本地工具 / curl 照旧放行 —— 浏览器才带 Origin，服务端脚本不带。
    """
    o = handler.headers.get('Origin') or ''
    if not o:
        return True
    if _LOCAL_ORIGIN_RE.match(o):
        return True
    if isinstance(CFG, dict) and CFG.get('allowLan') and _LAN_ORIGIN_RE.match(o):
        return True
    return False


# ---- 侧车 token ---------------------------------------------------------
# 没有鉴权时，本机任何进程/页面都能调 /expand（花你的 API key）、/cards/write
# （改卡）、/comfy/stop（停服务）。默认开启；config.json 里 requireToken=false
# 可临时关掉（仅调试）。
import secrets  # noqa: E402  （放在常量区之后，避免改动文件头）

_TOKEN_CACHE = {'token': ''}
_OPEN_PATHS = ('/health', '/version')
# <img src> 是浏览器直接发的图片请求：既不能加 X-Console-Client，也不带 Origin，
# 落进 token 分支必然 401 —— 表现就是"图全裂"。这些前缀只返回图片字节
# （输出图 / 输出缩略图 / 模型预览图 / 在线模型图），不涉及写操作与本机任意路径读取，
# 所以按只读放行。写操作和其余 GET 仍然走原鉴权。
# /loras/file 单独一个理由：导出走浏览器 <a download>，拿不到自定义头；它只返回
# models/loras 里的文件（_abs_of 已挡掉 .. 之类），仍然是只读。
_OPEN_GET_PREFIXES = ('/outputs/view', '/outputs/thumb', '/models/preview', '/online/images/', '/loras/file')


def _token_file():
    return os.path.join(WORK_DIR, 'sidecar-token.txt')


def _load_or_create_token():
    t = (CFG.get('sidecarToken') or '') if isinstance(CFG, dict) else ''
    if t:
        return t
    p = _token_file()
    try:
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                t = (f.read() or '').strip()
            if t:
                return t
    except Exception:
        pass
    t = secrets.token_urlsafe(32)
    try:
        os.makedirs(WORK_DIR, exist_ok=True)
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(t)
        try:
            os.chmod(p, 0o600)
        except Exception:
            pass
        print('[auth] sidecar token 已生成 ->', p)
    except Exception as e:
        print('[auth] token 落盘失败:', e)
    return t


def _token():
    if not _TOKEN_CACHE.get('token'):
        _TOKEN_CACHE['token'] = _load_or_create_token()
    return _TOKEN_CACHE['token']


def _token_required():
    return not (isinstance(CFG, dict) and CFG.get('requireToken') is False)


def _auth_ok(handler, path):
    """分层校验：
    - OPTIONS / health / version 一律放行
    - 浏览器来源：Origin 在本机/私网白名单 **且** 带 X-Console-Client（跨源必过预检）-> 免 token
    - 没有 Origin 的调用者（本机脚本 / curl / 其它软件）-> 必须带 X-Console-Token
    这样面板零改动，同时把"任意本机进程随便调"这条堵掉。
    """
    if handler.command == 'OPTIONS':
        return True
    if path in _OPEN_PATHS:
        return True
    if handler.command == 'GET' and path.startswith(_OPEN_GET_PREFIXES):
        return True
    # ⚠️ Origin 是**客户端可控的请求头**，单看它挡不住本机恶意进程（见 docs/生成经验.md #8）。
    #    所以这里做两道叠闸：
    #      闸一（浏览器）：要求带 X-Console-Client —— 自定义头会强制跨源预检，
    #                      而 expander 的 ACAO 只回显白名单 Origin，evil.com 的预检必败，
    #                      浏览器根本发不出这个请求。
    #      闸二（脚本）：无 Origin 的调用者仍必须带 X-Console-Token（读盘能力=可信度门槛）。
    cli = (handler.headers.get('X-Console-Client') or '').strip()
    o = handler.headers.get('Origin') or ''
    if cli and _LOCAL_ORIGIN_RE.match(o):
        return True
    if cli and isinstance(CFG, dict) and CFG.get('allowLan') and _LAN_ORIGIN_RE.match(o):
        return True
    if not _token_required():
        return True
    want = _token()
    if not want:
        return False          # 取不到 token 一律拒绝（fail closed）
    got = (handler.headers.get('X-Console-Token') or '').strip()
    return secrets.compare_digest(got, want)
