"""dsh-comfyui-console 侧车：配置与模块级状态。

从 expander.py 拆出（0.5.4）。这里只有一个真相：配置从哪来、派生量怎么算。

为什么可以"整体搬走再导入"：全文件原本只有一处 `global`（_PROBE_DIAG），
配置只在模块加载时算一次，之后都是原地修改 dict/list，不重新绑定名字。
所以 `from sidecar_state import CFG` 拿到的是同一个对象，语义不变。

改这里要小心：本模块 import 时就会执行配置加载（找不到 ComfyUI 会打印提示），
这是原有行为，不要改成惰性求值——那会改变启动时的可见输出。
"""

import datetime
import json
import os
import re
import sys

# 中文 Windows：stdout/stderr 被重定向到文件时默认 cp936，打印 ✗/✓ 会抛
# UnicodeEncodeError 把整个进程打死。本模块在导入期就会 print（_load_cfg），
# 所以必须在这里就生效，不能指望调用方先设好。
for _s in (sys.stdout, sys.stderr):
    try:
        # ⚠️ 必须在任何 import 期 print 之前执行，见 docs/生成经验.md #6
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
import time


HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, 'config.json')
PKG_JSON = os.path.join(HERE, 'package.json')
STARTED_AT = time.strftime('%Y-%m-%dT%H:%M:%S')

# config.json 里本版认识的键；其余键一律当"用户/新版本键"原样保留
KNOWN_CFG_KEYS = {
    'configVersion', 'comfyRoot', 'pythonExe', 'workDir', 'credsFile', 'comfyPort',
    'sidecarPort', 'extraComfyArgs', 'outputDir', 'saveDir', 'cardsDir', 'allowLan', '_note',
    'sidecarToken', 'requireToken',
}


def _pkg_meta():
    # 读 package.json 的更新元数据（供 /version 比对「已加载 vs 磁盘」）
    try:
        with open(PKG_JSON, encoding='utf-8') as f:
            m = json.load(f)
    except Exception:
        return {'version': '', 'configVersion': 1, 'minHost': ''}
    d = m.get('dsh') if isinstance(m.get('dsh'), dict) else {}
    try:
        cv = int(d.get('configVersion') or 1)
    except Exception:
        cv = 1
    return {'version': m.get('version') or '', 'configVersion': cv, 'minHost': d.get('minHost') or ''}


_PKG = _pkg_meta()
VERSION_LOADED = _PKG['version']
CONFIG_VERSION = _PKG['configVersion']


def _default_cards_dir():
    """cardsDir 没配时的兜底：<用户文档>/dsh-comfyui/角色卡（同级派生 画风 / 词库）。"""
    try:
        home = os.path.expanduser('~')
        docs = os.path.join(home, 'Documents')
        if not os.path.isdir(docs):
            docs = home
        d = os.path.join(docs, 'dsh-comfyui', '角色卡')
        os.makedirs(d, exist_ok=True)
        print('[config] cardsDir 没配，用兜底目录:', d)
        return d
    except Exception as e:
        print('[config] 兜底 cardsDir 建不出来:', e)
        return ''


_SKIP_DIRS = {'windows', 'program files', 'program files (x86)', 'programdata',
              '$recycle.bin', 'system volume information', 'perflogs', 'recovery',
              'msocache', 'node_modules', 'appdata', 'windows.old'}


def _scan_drives(max_per_drive=600):
    """扫各盘一级子目录，找「本目录下有 ComfyUI\\main.py 或 python_embeded\\python.exe」的根。

    固定候选表盖不住用户自选布局（如 F:\\AI-WORK\\ComfyUI\\main.py +
    F:\\AI-WORK\\python_embeded\\python.exe，根就是 F:\\AI-WORK）——
    2026-10-22 报告 ⑥。只扫一级，命中即返回，找不到就交给后续报错提示。
    """
    def ok(c):
        return (os.path.isfile(os.path.join(c, 'python_embeded', 'python.exe'))
                or os.path.isfile(os.path.join(c, 'ComfyUI', 'main.py'))
                or os.path.isfile(os.path.join(c, 'main.py')))

    out = []
    for letter in 'CDEFGHIJK':
        base = letter + ':\\'
        if not os.path.isdir(base):
            continue
        if ok(base.rstrip('\\')):
            out.append(base.rstrip('\\'))
        try:
            names = os.listdir(base)
        except Exception:
            continue
        n = 0
        for name in names:
            if name.lower() in _SKIP_DIRS:
                continue
            p = os.path.join(base, name)
            try:
                if not os.path.isdir(p):
                    continue
            except Exception:
                continue
            n += 1
            if n > max_per_drive:
                break
            if ok(p):
                out.append(p)
    return out


def _load_cfg():
    """读 config.json；没有就自动探测。

    **不写死任何用户路径** —— 这样整个目录拷给别人也能跑。
    """
    cfg = {}
    if os.path.exists(CONFIG):
        try:
            cfg = json.load(open(CONFIG, encoding='utf-8'))
        except Exception:
            # 记事本 / PowerShell 5.1 的 -Encoding utf8 会写 BOM，utf-8 直接解析失败。
            # 先用 utf-8-sig 重试一次，仍失败才降级成自动探测（2026-10-22 报告 ⑤）。
            try:
                cfg = json.load(open(CONFIG, encoding='utf-8-sig'))
                print('[config] config.json 带 BOM，已用 utf-8-sig 读取')
            except Exception as e:
                print('[config] config.json 读取失败，改用自动探测:', e)

    def ok(c):
        if not c:
            return False
        return (os.path.isfile(os.path.join(c, 'python_embeded', 'python.exe'))
                or os.path.isfile(os.path.join(c, 'ComfyUI', 'main.py'))
                or os.path.isfile(os.path.join(c, 'main.py')))

    root = cfg.get('comfyRoot') or ''
    if not ok(root):
        home = os.path.expanduser('~')
        for c in (r'E:\ComfyUI\ComfyUI_windows_portable',
                  r'C:\ComfyUI\ComfyUI_windows_portable',
                  r'D:\ComfyUI\ComfyUI_windows_portable',
                  r'F:\ComfyUI\ComfyUI_windows_portable',
                  os.path.join(home, 'ComfyUI_windows_portable'),
                  os.path.join(home, 'Desktop', 'ComfyUI_windows_portable'),
                  os.path.join(home, 'Downloads', 'ComfyUI_windows_portable')):
            if ok(c):
                root = c
                print('[config] 自动探测到 ComfyUI:', root)
                break
    if not ok(root):
        for c in _scan_drives():
            if ok(c):
                root = c
                print('[config] 扫盘自动找到 ComfyUI:', root)
                break
    if not ok(root):
        print('=' * 72)
        print('✗ 找不到 ComfyUI。请改本目录的 config.json：')
        print(r'   { "comfyRoot": "D:\\ComfyUI\\ComfyUI_windows_portable" }')
        print('  （该目录下应有 python_embeded\\python.exe 与 ComfyUI\\main.py）')
        print('=' * 72)
        root = ''

    py = cfg.get('pythonExe') or ''
    if not (py and os.path.isfile(py)):
        py = os.path.join(root, 'python_embeded', 'python.exe') if root else ''
    cfgver = 0
    try:
        cfgver = int(cfg.get('configVersion') or 0)
    except Exception:
        cfgver = 0
    if cfgver and cfgver > CONFIG_VERSION:
        print('[config] config.json 是更新版本写的（v%d > 本版 v%d）：本版只认已知键，其余原样保留'
              % (cfgver, CONFIG_VERSION))

    work = cfg.get('workDir') or HERE
    try:
        os.makedirs(work, exist_ok=True)
    except Exception:
        work = HERE
    return {
        'comfyRoot': root,
        'comfyPy': py,
        'comfyMain': os.path.join(root, 'ComfyUI', 'main.py') if root else '',
        'comfyPort': int(cfg.get('comfyPort') or 8188),
        'sidecarPort': int(cfg.get('sidecarPort') or 8199),
        'workDir': work,
        'outputDir': cfg.get('outputDir') or '',
        'saveDir': cfg.get('saveDir') or '',
        # 换机器兜底：config.json 里 cardsDir 空着时，按「文档\dsh-comfyui\角色卡」给一个
        # 真实可写目录（画风/词库由 dirname 派生），否则 /cards 与 /dir/* 全部只能报错。
        'cardsDir': cfg.get('cardsDir') or _default_cards_dir(),
        'credsFile': cfg.get('credsFile') or '',
        'allowLan': bool(cfg.get('allowLan')),
        'sidecarToken': (cfg.get('sidecarToken') or ''),
        'requireToken': cfg.get('requireToken') is not False,
        'configVersion': cfgver or CONFIG_VERSION,
        'configVersionRaw': cfgver,   # 配置文件里的原值（0 = 还没被迁移过）
        'unknownKeys': sorted(k for k in cfg if k not in KNOWN_CFG_KEYS),
        'extraArgs': cfg.get('extraComfyArgs') or [
            '--disable-pinned-memory', '--disable-async-offload',
            '--disable-dynamic-vram', '--cache-none',
        ],
    }


CFG = _load_cfg()
# 回退顺序与原 expander.py 中部那处重算一致：配置 -> 环境变量 -> 本机默认
# ---- ComfyUI 后端（去依赖化）------------------------------------------------
# 原来这里写死 r'D:\paint\ComfyUI'（上游作者的开发机路径），别的机器上根本不存在，
# 于是 comfyRoot 永远"看起来配了但实际无效"，报错全落在下游。
# 现在：
#   comfyUrl      完整地址，可指向局域网/远程（http://192.168.1.10:8188）
#   backendMode   auto | managed | remote
#       auto      有可用 comfyRoot -> managed；否则 remote
#       managed   能拉起/停止本地 ComfyUI，能推算 output 目录
#       remote    只走 HTTP，绝不碰进程与本地路径
# 两者取一即可：只填 comfyUrl 就是纯客户端（远程 ComfyUI 场景）。
_COMFY_ROOT_CFG = (CFG['comfyRoot'] or os.environ.get('DSH_COMFY_ROOT') or '').strip()


def comfy_root_usable(root):
    """这个 root 到底能不能当本地 ComfyUI 用（有 main.py 或 python_embeded）。"""
    if not root or not os.path.isdir(root):
        return False
    return (os.path.isfile(os.path.join(root, 'python_embeded', 'python.exe'))
            or os.path.isfile(os.path.join(root, 'ComfyUI', 'main.py'))
            or os.path.isfile(os.path.join(root, 'main.py')))


COMFY_ROOT = _COMFY_ROOT_CFG
_BACKEND_MODE_CFG = (CFG.get('backendMode') or os.environ.get('DSH_COMFY_BACKEND') or '').strip().lower()
if _BACKEND_MODE_CFG in ('managed', 'remote'):
    BACKEND_MODE = _BACKEND_MODE_CFG
else:
    BACKEND_MODE = 'managed' if comfy_root_usable(COMFY_ROOT) else 'remote'
MANAGED = (BACKEND_MODE == 'managed')

# 地址：显式 comfyUrl 优先；否则按 comfyPort 拼本地默认
_COMFY_URL_CFG = (CFG.get('comfyUrl') or os.environ.get('DSH_COMFY_URL') or '').strip()
COMFY_BASE = (_COMFY_URL_CFG.rstrip('/') if _COMFY_URL_CFG
              else 'http://127.0.0.1:%d' % int(CFG.get('comfyPort') or 8188))

COMFY_PY = CFG['comfyPy']
COMFY_MAIN = CFG['comfyMain']
COMFY_PORT = CFG['comfyPort']
WORK_DIR = CFG['workDir']
CREDS = CFG['credsFile'] or os.path.join(os.path.expanduser('~'), '.dsh', '.credentials.yaml')

# ⚠️ 关键启动参数 —— 2026-10-10 对照实验得出，别删。
#
# 症状：896x1152 一次出图从 42 秒劣化到 15 分钟以上；日志进度条显示
#       第 1 步只要 4.24s，随后掉到 175 s/it（"第一步飞快然后掉悬崖"= 换页特征）。
# 真因：ComfyUI 默认策略会 `Enabled pinned memory 6263.0` —— 想**钉住 6.2 GB
#       物理内存**，而这台机器常常只剩 2 GB。钉不住就疯狂换页。
#
# 实测（512x512/8 步，健康基线 12 秒）：
#   基线                      86 秒
#   禁 pinned                 10 秒   ← 8.6 倍
#   禁 async offload         143 秒
#   禁 pinned + async         10 秒
#   全家桶                    16 秒   （且出图后空闲内存 3.57 GB vs 基线 1.86 GB）
#
# 实测（真实规格 896x1152/20 步，sd.cpp 同规格约 80 秒）：
#   只禁 pinned               42 秒   出图后空闲 2.37 GB
#   全家桶                    45 秒   出图后空闲 3.85 GB   ← 选它
COMFY_EXTRA_ARGS = CFG['extraArgs']

AUTO_UNLOAD_SECONDS = 600      # 闲置 10 分钟 -> 卸载模型（进程留着）
WATCH_INTERVAL = 30            # 后台巡检间隔

def _read_creds():
    """从 DSH 凭证里抠出 DEEPSEEK_API_KEY（只用于本地 sidecar，不外传）。"""
    try:
        txt = open(CREDS, encoding='utf-8', errors='replace').read()
        m = re.search(r'DEEPSEEK_API_KEY:\s*([^\s]+)', txt)
        return m.group(1).strip().strip('"\'') if m else ''
    except Exception:
        return ''


_CREDS_CACHE = {'v': None}

# ComfyUI 下的两个固定子目录（原在 expander.py 中部，被 cards 与 pack 两组共用）
# 这两个是本地磁盘路径，remote 模式下没有意义，置空（下游都已判空）
def _comfy_sub(root, *cands):
    r"""在 root 下找第一个存在的候选子路径。

    为什么需要：`comfyRoot` 的两种真实布局都对得上 ——
      ComfyUI_windows_portable  ->  ComfyUI/input、ComfyUI/models/model_patches
      自建目录（本机 D:/paint） ->  同样是 ComfyUI/input、ComfyUI/models/model_patches
    原来写死 <root>/input，在便携版与自建目录下**都不存在**：
    `os.makedirs` 把目录凭空建出来，LLLite 图与 model_patches 于是写进了 ComfyUI 看不见的地方
    （本机实测：D:/paint/input 与 D:/paint/models/model_patches 是空壳，真货在 D:/paint/ComfyUI/ 下）。
    """
    if not root:
        return ''
    for c in cands:
        p = os.path.join(root, *c)
        if os.path.isdir(p):
            return p
    return os.path.join(root, *cands[0])


COMFY_INPUT = _comfy_sub(COMFY_ROOT, ('ComfyUI', 'input'), ('input',)) if MANAGED else ''
COMFY_PATCHES = _comfy_sub(COMFY_ROOT, ('ComfyUI', 'models', 'model_patches'),
                           ('models', 'model_patches')) if MANAGED else ''
