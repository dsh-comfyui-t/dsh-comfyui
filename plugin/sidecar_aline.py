# -*- coding: utf-8 -*-
"""A 线（preview/8200）功能移植：模型库。

从 preview/expander.py 原样搬来 32 个函数 / 691 行。
不改逻辑，只补一层配置适配：A 线的键名和本地 sidecar_state 不一样。

  A 线 comfyRoot           -> 指向 ComfyUI 目录本身（D:\\paint\\ComfyUI）
  本地 comfyRoot           -> 指向父目录（D:\\paint），main.py 在 comfyRoot/ComfyUI/main.py
  A 线 outputDirectory     -> 本地 outputDir
  A 线 comfyPythonExe      -> 本地 pythonExe

下面那个 CFG 就是把本地值翻译成 A 线那套键名，搬过来的函数不用改一行。

生成方式：脚本按依赖闭包从 preview/expander.py 抽取，勿手工调整函数顺序
（模块级函数之间没有前向引用，顺序只影响阅读）。
"""
import hashlib
import importlib.util as _importlib_util
import io
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from urllib.parse import urlsplit, parse_qs, urlencode

from sidecar_state import CFG as _LOCAL_CFG

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, 'config.json')


def _aline_comfy_root():
    """本地 comfyRoot 可能是父目录（D:\\paint），也可能是 ComfyUI 本身，两种都要认。"""
    r = str(_LOCAL_CFG.get('comfyRoot') or '').strip()
    if not r:
        return ''
    if os.path.isfile(os.path.join(r, 'main.py')):
        return r
    if os.path.isfile(os.path.join(r, 'ComfyUI', 'main.py')):
        return os.path.join(r, 'ComfyUI')
    return r


COMFY_ROOT = _aline_comfy_root()

# 翻译成 A 线那套键名；搬过来的函数一律读这个 CFG
CFG = {
    'comfyRoot': COMFY_ROOT,
    'outputDirectory': str(_LOCAL_CFG.get('outputDir') or ''),
    'tempDirectory': os.path.join(str(_LOCAL_CFG.get('workDir') or HERE), 'temp'),
    'dataDir': os.path.dirname(str(_LOCAL_CFG.get('workDir') or HERE)),
    'workDir': str(_LOCAL_CFG.get('workDir') or ''),
    'pythonExe': str(_LOCAL_CFG.get('pythonExe') or ''),
    'comfyPythonExe': str(_LOCAL_CFG.get('pythonExe') or ''),
    'comfyMain': str(_LOCAL_CFG.get('comfyMain') or ''),
    'comfyPort': _LOCAL_CFG.get('comfyPort') or 8188,
    'sidecarPort': _LOCAL_CFG.get('sidecarPort') or 8199,
    'extraArgs': list(_LOCAL_CFG.get('extraComfyArgs') or []),
}


def _load_aline_mod(name, filename):
    spec = _importlib_util.spec_from_file_location(name, os.path.join(HERE, 'aline_mods', filename))
    mod = _importlib_util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


LAUNCH_MODES = _load_aline_mod('aline_launch_modes', 'launch_modes.py')
COMFY_PATHS = _load_aline_mod('aline_comfy_paths', 'comfy_paths.py')
CROSS_PATHS = _load_aline_mod('aline_cross_paths', 'cross_paths.py')

# 词典/翻译惰性加载（A 线同一套）
_dict_module = None
_DICTIONARY = None
_DICTIONARY_LOCK = threading.Lock()
_TRANSLATION = None
_translation_module = None
_TRANSLATION_LOCK = threading.Lock()


# ---- 模型组用到的模块级锁与常量（A 线原文）----
_SETTINGS_LOCK = threading.RLock()
_MODEL_DIR_KEYS = {
    'checkpoint': ('checkpoints',),
    'diffusion': ('diffusion_models', 'unet'),
    'clip': ('text_encoders', 'clip'),
    'vae': ('vae',),
    'lora': ('loras', 'lora'),
    'upscale': ('upscale_models',),
    'controlnet': ('controlnet',),
    'embedding': ('embeddings',),
}
_MODEL_EXTENSIONS = {'.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf', '.onnx', '.sft'}
_MODEL_SOURCE_LOCK = threading.RLock()
_MODEL_TASKS = {}
_MODEL_TASKS_LOCK = threading.Lock()
_MODEL_ASSETS = None       # _model_assets() 的惰性缓存（函数里有 global 声明）
_ONLINE_MODELS = None     # _online_models() 的惰性缓存
_ONLINE_LOCK = threading.Lock()

# ---- 第二批用到的模块级常量（A 线原文 + 本地派生）----
COMFY_MAIN = CFG.get('comfyMain') or ''
COMFY_PORT = CFG.get('comfyPort') or 8188
COMFY_PY = CFG.get('comfyPy') or CFG.get('pythonExe') or ''
COMFY_EXTRA_ARGS = list(CFG.get('extraArgs') or [])
WORK_DIR = CFG.get('workDir') or ''
CREDS = str(_LOCAL_CFG.get('credsFile') or os.path.join(os.path.expanduser('~'), '.dsh', '.credentials.yaml'))
BOUND_SIDECAR_PORT = CFG.get('sidecarPort') or 8199
_COMFY_UPDATE_CACHE = {'time': 0.0, 'data': None}
_COMFY_UPDATE_CACHE_SECONDS = 1800
_OUTPUT_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
_SESSION_CUSTOM_OUTPUTS = set()
_OUTPUT_SAVE_LOCK = threading.Lock()
_THUMB_LOCK = threading.Lock()
_POST_LOCK = threading.RLock()
_OUTPUT_PREVIEW_PROFILES = {
    'medium': (512, 80),
    'large': (1280, 88),
}

# 本地已经有自己的 Comfy 生命周期管理，直接复用，不再新建一份
from sidecar_comfy import Comfy as _LocalComfy
COMFY = _LocalComfy()

RUNTIME_BRIDGE = _load_aline_mod('aline_runtime_bridge', 'runtime_bridge.py')
COMPATIBILITY = _load_aline_mod('aline_compatibility', 'compatibility.py')
COMFY_INSTALL = _load_aline_mod('aline_comfy_install', 'comfy_install.py')


# A 线 CFG 还有这些键，本地配置里没有对应项（或语义不同），给安全默认值，
# 让搬过来的函数按 A 线的分支走，而不是 KeyError。
for _k, _v in (
    ('comfyLayout', 'portable'),
    ('comfyMainDir', ''),
    ('comfyPythonSource', ''),
    ('comfyRootSource', 'config'),
    ('configErrors', []),
    ('namespaceErrors', []),
    ('pathWarnings', []),
    ('launcherSelectionRequired', False),
    ('launchers', []),
    ('startScript', ''),
    ('startScriptSource', ''),
    ('outputDir', CFG.get('outputDirectory') or ''),
    ('extraComfyArgs', list(CFG.get('extraArgs') or [])),
    ('comfyPythonExe', CFG.get('pythonExe') or ''),
    ('comfyPy', CFG.get('pythonExe') or ''),
):
    CFG.setdefault(_k, _v)

# 函数里有 global 声明的惰性缓存/单例
_THUMB_WRITES = 0
_POST_SERVICE = None
_POST_DEPENDENCIES = None

# ==================== 以下从 preview/expander.py 原样搬入 ====================
# 39 个函数 + 1 个类 / 828 行
# 类: ModelTaskCancelled

class ModelTaskCancelled(ValueError):
    pass



def _dictionary():
    global _DICTIONARY, _dict_module
    with _DICTIONARY_LOCK:
        if _DICTIONARY is None:
            # A missing SQLite extension must not break ComfyUI lifecycle/AI APIs.
            if _dict_module is None:
                import importlib.util
                spec = importlib.util.spec_from_file_location('dsh_tag_dictionary', os.path.join(HERE, 'aline_mods', 'tag_dictionary.py'))
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                _dict_module = module
            config = {}
            if os.path.isfile(CONFIG):
                with open(CONFIG, encoding='utf-8-sig') as f:
                    config = json.load(f)
            for key in ('dataDir','dbPath'):
                if config.get(key): config[key] = CROSS_PATHS.runtime_path(config[key])
            path = _dict_module.data_path(config)
            try:
                in_plugin = os.path.commonpath([os.path.realpath(path), os.path.realpath(HERE)]) == os.path.realpath(HERE)
            except ValueError:
                in_plugin = False  # Different local Windows drives are valid.
            if in_plugin:
                raise ValueError('词库须存放在插件目录之外')
            _DICTIONARY = _dict_module.Dictionary(path, os.path.join(HERE, 'dictionary_seed.json'))
    return _DICTIONARY


def _path_settings(include_models=True):
    with _SETTINGS_LOCK:
        return COMFY_PATHS.resolve(COMFY_ROOT,dict(CFG),LAUNCH_MODES,_MODEL_DIR_KEYS,include_models)



def _safe_relative_model_path(value, allow_empty=False):
    """Normalize a user supplied model-relative path and reject traversal/absolute paths."""
    raw = str(value or '').strip().replace('\\', '/')
    if not raw:
        if allow_empty:
            return ''
        raise ValueError('模型路径不能为空')
    if any(ord(c) < 32 for c in raw) or ':' in raw:
        raise ValueError('模型路径包含不支持的字符')
    if raw.startswith('/') or re.match(r'^[A-Za-z]:', raw):
        raise ValueError('只能使用模型目录内的相对路径')
    parts = [p for p in raw.split('/') if p not in ('', '.')]
    if not parts or any(p == '..' for p in parts):
        raise ValueError('模型路径不能包含 ..')
    return os.path.join(*parts)



def _path_inside(root, path):
    try:
        return os.path.commonpath([os.path.realpath(root), os.path.realpath(path)]) == os.path.realpath(root)
    except ValueError:
        return False



def _model_roots(kind, include_missing_default=True):
    paths = _path_settings()
    if kind == 'models' or str(kind).startswith('folder:'):
        base = paths.get('modelBase')
        if not base:
            raise ValueError('无法确定 models 目录，请先配置 ComfyUI 路径')
        if kind == 'models':
            root = base
        else:
            name = kind[7:]
            if not name or name in ('.', '..') or any(c in name for c in '/\\:\x00\r\n'):
                raise ValueError('模型文件夹名称无效')
            root = os.path.join(base, name)
        if not os.path.isdir(root):
            raise ValueError('模型目录不存在：' + root)
        return [root]
    if kind not in _MODEL_DIR_KEYS:
        raise ValueError('未知模型类型：' + str(kind))
    roots = []
    preferred = [entry['path'] for entry in paths['modelPaths'] if entry['kind'] == kind and entry['isDefault']]
    roots.extend(reversed(preferred))
    if paths['modelBase']:
        model_base = paths['modelBase']
        for key in _MODEL_DIR_KEYS[kind]:
            roots.append(os.path.join(model_base, key))
    roots.extend(entry['path'] for entry in paths['modelPaths'] if entry['kind'] == kind and not entry['isDefault'])
    clean = []
    seen = set()
    normalized = []
    for root in roots:
        root = os.path.normpath(root)
        real = os.path.normcase(os.path.realpath(root))
        if real in seen:
            continue
        seen.add(real); normalized.append(root)
    clean.extend([root for root in normalized if os.path.isdir(root)])
    if not clean and include_missing_default and normalized:
        clean.append(normalized[0])
    return clean



def _resolve_model_file(kind, name, root_id=None):
    rel = _safe_relative_model_path(name)
    if os.path.splitext(rel)[1].lower() not in _MODEL_EXTENSIONS:
        raise ValueError('不支持管理该文件类型')
    roots = _model_roots(kind, include_missing_default=False)
    if root_id is not None and str(root_id) != '':
        try:
            idx = int(root_id)
        except (TypeError, ValueError):
            raise ValueError('模型根目录编号无效')
        if idx < 0 or idx >= len(roots):
            raise ValueError('模型根目录编号越界')
        roots = [roots[idx]]
    for root in roots:
        candidate = os.path.join(root, rel)
        if os.path.isfile(candidate) and _path_inside(root, candidate):
            return root, candidate
    raise ValueError('找不到模型文件：' + str(name))



def _default_model_root(kind):
    roots = _model_roots(kind, include_missing_default=True)
    if not roots:
        raise ValueError('无法确定 ComfyUI 模型目录，请先配置启动路径')
    root = roots[0]
    os.makedirs(root, exist_ok=True)
    return root



def _model_public_name(root, path):
    return os.path.relpath(path, root).replace('/', os.sep).replace('\\', os.sep)



def _manage_model_files(payload):
    """Create folders, move model files/folders and reveal model files."""
    if not isinstance(payload, dict):
        raise ValueError('请求必须是对象')
    action = str(payload.get('action') or '').strip()
    kind = str(payload.get('kind') or '').strip()
    if kind not in _MODEL_DIR_KEYS and kind != 'models' and not kind.startswith('folder:'):
        raise ValueError('模型类型无效')
    if kind == 'models' and action not in ('open', 'open_directory', 'open_file'):
        raise ValueError('models 目录只供浏览；请先进入一个模型文件夹')
    if action in ('open_directory', 'open_file'):
        root, target = _browser_target(kind, payload.get('root_id', 0), payload.get('folder', ''), directory=action == 'open_directory')
        _reveal_library_path(target, directory=action == 'open_directory')
        return {'ok': True, 'action': action, 'path': target}
    name = str(payload.get('name') or '').strip()
    folder = _safe_relative_model_path(payload.get('folder', ''), allow_empty=True)

    if action == 'mkdir':
        if not folder:
            raise ValueError('请输入要创建的文件夹名称')
        roots = _model_roots(kind, include_missing_default=True)
        rid = payload.get('root_id')
        if rid is not None and str(rid) != '':
            try:
                idx = int(rid)
            except (TypeError, ValueError):
                raise ValueError('模型根目录编号无效')
            if idx < 0 or idx >= len(roots):
                raise ValueError('模型根目录编号越界')
            root = roots[idx]
            os.makedirs(root, exist_ok=True)
        else:
            root = _default_model_root(kind)
        target = os.path.join(root, folder)
        if not _path_inside(root, target):
            raise ValueError('目标文件夹越出模型目录')
        if os.path.lexists(target) and not os.path.isdir(target):
            raise ValueError('同名文件已存在')
        os.makedirs(target, exist_ok=True)
        return {'ok': True, 'action': action, 'folder': os.path.relpath(target, root).replace('\\','/'), 'root': root}

    if action == 'open':
        if not name:
            raise ValueError('请先选择一个模型')
        root, source = _resolve_model_file(kind, name, payload.get('root_id'))
        if os.name == 'nt':
            subprocess.Popen(['explorer.exe', '/select,' + os.path.normpath(source)], close_fds=True)
        else:
            opener = shutil.which('xdg-open')
            if not opener:
                raise ValueError('当前系统没有可用的文件管理器打开命令（xdg-open）')
            subprocess.Popen([opener, os.path.dirname(source)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return {'ok': True, 'action': action, 'name': name, 'path': source}

    if action in ('move', 'move_many'):
        names = payload.get('names') if action == 'move_many' else [name]
        if not isinstance(names, list) or not names:
            raise ValueError('请先选择模型')
        resolved = []
        targets = []
        needed_dirs = set()
        for item in names:
            item_name = item.get('name') if isinstance(item, dict) else item
            item_root = item.get('root_id') if isinstance(item, dict) else None
            root, source = _resolve_model_file(kind, item_name, item_root)
            target_dir = os.path.join(root, folder) if folder else root
            if not _path_inside(root, target_dir):
                raise ValueError('目标文件夹越出模型目录')
            needed_dirs.add(target_dir)
            target = os.path.join(target_dir, os.path.basename(source))
            if os.path.normcase(os.path.realpath(target)) == os.path.normcase(os.path.realpath(source)):
                resolved.append((root, source, target, item_name)); continue
            if os.path.exists(target):
                raise ValueError('目标文件夹中已存在同名模型：' + os.path.basename(source))
            resolved.append((root, source, target, item_name))
            targets.append(target)
        # Preflight the entire selection before creating directories or moving any file.
        for target_dir in sorted(needed_dirs, key=len):
            os.makedirs(target_dir, exist_ok=True)
        _model_assets().move_models([(root, source, target) for root, source, target, old in resolved], store=_model_assets_base())
        moved = [{'old_name': old, 'new_name': _model_public_name(root, target).replace('\\', '/')}
                 for root, source, target, old in resolved]
        return {'ok': True, 'action': action, 'moved': moved,
                'new_name': moved[0]['new_name'] if len(moved) == 1 else '', 'folder': folder.replace('\\','/')}

    if action == 'move_folder':
        source_folder = _safe_relative_model_path(payload.get('source_folder', ''))
        roots = _model_roots(kind, include_missing_default=False)
        root_id = payload.get('root_id')
        if root_id is not None and str(root_id) != '':
            try:
                idx = int(root_id)
            except (TypeError, ValueError):
                raise ValueError('模型根目录编号无效')
            if idx < 0 or idx >= len(roots):
                raise ValueError('模型根目录编号越界')
            roots = [roots[idx]]
        match = None
        for root in roots:
            candidate = os.path.join(root, source_folder)
            if os.path.isdir(candidate) and _path_inside(root, candidate):
                match = (root, candidate); break
        if not match:
            raise ValueError('找不到源文件夹')
        root, source_dir = match
        target_parent = os.path.join(root, folder) if folder else root
        if not _path_inside(root, target_parent):
            raise ValueError('目标文件夹越出模型目录')
        target = os.path.join(target_parent, os.path.basename(source_dir))
        source_real, target_real = os.path.realpath(source_dir), os.path.realpath(target)
        if os.path.normcase(source_real) == os.path.normcase(target_real):
            return {'ok': True, 'action': action, 'folder': source_folder.replace('\\','/')}
        if os.path.commonpath([source_real, target_real]) == source_real:
            raise ValueError('不能把文件夹移动到自己的子文件夹')
        if os.path.exists(target):
            raise ValueError('目标位置已存在同名文件夹')
        os.makedirs(target_parent, exist_ok=True)
        assets=_model_assets();store=_model_assets_base();cached=[]
        for parent,dirs,files in os.walk(source_dir,followlinks=False):
            dirs[:]=[d for d in dirs if not os.path.islink(os.path.join(parent,d))]
            for filename in files:
                source_file=os.path.join(parent,filename)
                if os.path.splitext(filename)[1].lower() in _MODEL_EXTENSIONS and not os.path.islink(source_file) and _path_inside(root,source_file):
                    cached.append((assets.asset_directory(source_file,store),os.path.join(target,os.path.relpath(source_file,source_dir))))
        shutil.move(source_dir, target)
        try:
            for old,target_file in cached:assets.copy_model_assets(old,target_file,store)
        except Exception as ex:
            try:shutil.move(target,source_dir)
            except OSError:raise ValueError('附件迁移失败且文件夹未能恢复，请检查源目录和目标目录') from ex
            raise ValueError('附件迁移失败，已恢复原文件夹') from ex
        return {'ok': True, 'action': action, 'old_folder': source_folder.replace('\\','/'),
                'folder': os.path.relpath(target, root).replace('\\','/')}

    raise ValueError('不支持的模型文件操作')


def _model_header_info_cached(path, size_on_disk, mtime_ns):
    """Bounded, read-only header inspection. Never deserialize pickle or tensor payloads."""
    unknown = {'mode': 'unknown', 'embedded_clip': None, 'embedded_vae': None}
    if os.path.splitext(path)[1].lower() not in ('.safetensors', '.sft'):
        return {}, unknown
    try:
        with open(path, 'rb') as f:
            raw = f.read(8)
            if len(raw) != 8:
                return {}, unknown
            size = int.from_bytes(raw, 'little', signed=False)
            if size <= 0 or size > 64 * 1024 * 1024 or size + 8 > size_on_disk:
                return {}, unknown
            header = json.loads(f.read(size).decode('utf-8'))
        if not isinstance(header, dict):
            return {}, unknown
        meta = header.get('__metadata__', {})
        meta = meta if isinstance(meta, dict) else {}
        keys = [k for k, v in header.items() if k != '__metadata__' and isinstance(v, dict)
                and isinstance(v.get('shape'), list) and isinstance(v.get('data_offsets'), list)]
        # Prefixes describe component packaging, not the architecture or tensor compatibility.
        adapter = any('lora_' in k.lower() or '.lora_' in k.lower() or '.lora_A.' in k or '.lora_B.' in k for k in keys)
        network = any(k.startswith(('model.diffusion_model.', 'diffusion_model.', 'input_blocks.', 'double_blocks.',
                                   'joint_blocks.', 'transformer_blocks.', 'img_in.', 'x_embedder.',
                                   'patch_embed.', 'patch_embedder.', 'net.blocks.', 'net.x_embedder.')) for k in keys)
        if adapter or not network:
            return meta, unknown
        clip = any(k.startswith(('cond_stage_model.', 'conditioner.embedders.', 'text_encoders.', 'text_encoder.')) for k in keys)
        vae = any(k.startswith(('first_stage_model.', 'vae.')) for k in keys)
        return meta, {'mode': 'checkpoint' if clip or vae else 'diffusion',
                      'embedded_clip': clip, 'embedded_vae': vae}
    except (OSError, ValueError, UnicodeError, OverflowError, RecursionError):
        return {}, unknown



def _model_header_info(path):
    try:
        st = os.stat(path)
        return _model_header_info_cached(os.path.realpath(path), st.st_size, st.st_mtime_ns)
    except OSError:
        return {}, {'mode': 'unknown', 'embedded_clip': None, 'embedded_vae': None}



def _read_safetensors_metadata(path):
    return _model_header_info(path)[0]



def _infer_model_base(metadata):
    values = []
    for key in ('modelspec.architecture', 'ss_base_model_version', 'ss_sd_model_name',
                'ss_base_model', 'base_model', 'modelspec.title'):
        value = metadata.get(key)
        if value is not None:
            values.append(str(value))
    joined = ' '.join(values).lower()
    # Anima：modelspec.architecture 常见写作 'anima-preview/lora'、'Anima/lora' 等，
    # 大小写与子版本五花八门，统一归一成 'Anima'，否则会被拆成好几个分类
    if 'anima' in joined:
        return 'Anima'
    if 'illustrious' in joined:
        return 'Illustrious / SDXL'
    if 'pony' in joined:
        return 'Pony / SDXL'
    if 'flux' in joined:
        return 'FLUX'
    if 'stable-diffusion-xl' in joined or 'sdxl' in joined:
        return 'SDXL'
    if 'stable-diffusion-v3' in joined or re.search(r'(^|[^a-z])sd3([^a-z]|$)', joined):
        return 'SD3'
    if 'stable-diffusion-v2' in joined or re.search(r'(^|[^a-z])sd2([^a-z]|$)', joined):
        return 'SD2.x'
    if 'stable-diffusion-v1' in joined or re.search(r'(^|[^a-z])sd[_ -]?v?1([^0-9]|$)', joined):
        return 'SD1.x'
    return str(values[0])[:120] if values else '未知'



def _human_file_size(n):
    value = float(n or 0)
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if value < 1024 or unit == 'TB':
            return ('%.2f %s' % (value, unit)) if unit in ('GB', 'TB') else ('%.1f %s' % (value, unit))
        value /= 1024.0



def _model_assets():
    global _MODEL_ASSETS
    if _MODEL_ASSETS is None:
        import importlib.util
        spec = importlib.util.spec_from_file_location('dsh_model_assets', os.path.join(HERE, 'aline_mods', 'model_assets.py'))
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        _MODEL_ASSETS = module
    return _MODEL_ASSETS



def _model_assets_base():
    return os.path.join(os.path.dirname(_model_source_cache_path()), "model_assets")



def _model_previews_info(kind, name, root_id=None):
    root, source = _resolve_model_file(kind, name, root_id)
    from urllib.parse import urlencode
    result = []
    for path, mime in _model_assets().preview_files(root, source, store=_model_assets_base()):
        stat = path.stat()
        query = {'kind': kind, 'name': _model_public_name(root, source).replace('\\', '/'),
                 'root_id': _model_roots(kind).index(root), 'asset': path.name,
                 'v': str(stat.st_mtime_ns) + '-' + str(stat.st_size)}
        result.append({'url': '/models/preview?' + urlencode(query), 'filename': path.name, 'mime': mime, 'id': _model_assets().preview_id(path)})
    return result



def _model_preview_info(kind, name, root_id=None):
    result = _model_previews_info(kind, name, root_id)
    return result[0] if result else None



def _model_source_cache_path():
    try:
        base = os.path.dirname(str(_dictionary().path))
    except Exception:
        if os.name == 'nt':
            base = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'DSH', 'ComfyUIConsole')
        else:
            base = os.path.join(os.environ.get('XDG_DATA_HOME') or os.path.join(os.path.expanduser('~'), '.local', 'share'), 'DSH', 'ComfyUIConsole')
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, 'model_sources.json')



def _load_model_source_cache():
    path = _model_source_cache_path()
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}



def _save_model_source_cache(data):
    path = _model_source_cache_path()
    parent=os.path.dirname(path);os.makedirs(parent,exist_ok=True)
    temporary=None
    with _MODEL_SOURCE_LOCK:
        current=_load_model_source_cache();current.update(data)
        try:
            with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=parent,prefix='.model-sources-',suffix='.tmp',delete=False) as stream:
                temporary=stream.name;json.dump(current,stream,ensure_ascii=False,indent=2)
            os.replace(temporary,path)
        finally:
            if temporary and os.path.exists(temporary):os.unlink(temporary)



def _model_cache_key(kind, root, source):
    stat = os.stat(source)
    return '%s|%s|%s|%s|%s' % (kind, os.path.normcase(os.path.realpath(root)),
                                _model_public_name(root, source).replace('\\', '/'), int(stat.st_size), int(stat.st_mtime))



def _adjacent_civitai_info(source):
    cached = _model_assets().read_source(os.path.dirname(source), source, _model_assets_base())
    if cached and urlsplit(str(cached.get('url') or '')).scheme == 'https':return cached
    stem = os.path.splitext(source)[0]
    try:
        info_path = stem + '.dsh-source.json'
        if os.path.islink(info_path) or os.path.getsize(info_path) > 1024*1024:
            raise ValueError('invalid metadata')
        with open(info_path, encoding='utf-8') as f:
            info = json.load(f)
        if isinstance(info, dict) and urlsplit(str(info.get('url') or '')).scheme == 'https':
            return info
    except (OSError, ValueError):
        pass
    candidates = [stem + '.civitai.info', stem + '.civitai.json']
    for path in candidates:
        if not os.path.isfile(path) or os.path.islink(path) or os.path.getsize(path) > 1024*1024:
            continue
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        model_obj = data.get('model') if isinstance(data.get('model'), dict) else {}
        model_id = data.get('modelId') or model_obj.get('id')
        version_id = data.get('id') or data.get('modelVersionId')
        if model_id:
            url = 'https://civitai.com/models/%s' % model_id
            if version_id:
                url += '?modelVersionId=%s' % version_id
            return {'provider': 'Civitai', 'url': url, 'title': str(data.get('name') or model_obj.get('name') or ''),
                    'base_model': str(data.get('baseModel') or ''), 'trained_words': [str(w) for w in (data.get('trainedWords') or []) if str(w).strip()][:50],
                    'method': 'sidecar-metadata', 'provider_id': 'civitai', 'model_id': str(model_id), 'version_id': str(version_id or '')}
    return None



def _model_detail(kind, name, root_id=None):
    if os.path.splitext(str(name))[1].lower() not in _MODEL_EXTENSIONS:
        root, source = _browser_target(kind, 0 if root_id is None else root_id, name, directory=False)
        size = os.path.getsize(source)
        return {'kind': kind, 'root_id': int(root_id or 0), 'name': name, 'filename': os.path.basename(source),
                'size': size, 'size_text': _human_file_size(size), 'is_model': False, 'previews': [], 'source': None}
    root, source = _resolve_model_file(kind, name, root_id)
    stat = os.stat(source)
    metadata = _read_safetensors_metadata(source)
    key = _model_cache_key(kind, root, source)
    cached = _adjacent_civitai_info(source) or _load_model_source_cache().get(key)
    return {
        'kind': kind, 'root_id': _model_roots(kind).index(root), 'name': _model_public_name(root, source).replace('\\', '/'),
        'filename': os.path.basename(source), 'folder': os.path.dirname(_model_public_name(root, source)).replace('\\', '/'),
        'size': int(stat.st_size), 'size_text': _human_file_size(stat.st_size),
        'base_type': _infer_model_base(metadata), 'extension': os.path.splitext(source)[1].lower(),
        'source': cached, 'preview': _model_preview_info(kind, name, root_id), 'previews': _model_previews_info(kind, name, root_id),
        'loading': dict(_model_header_info(source)[1]),
        'metadata': {k: str(metadata[k])[:500] for k in ('modelspec.title','modelspec.architecture','modelspec.author','modelspec.usage_hint','modelspec.trigger_phrase') if k in metadata},
    }



def _persist_model_source(root, source, info):
    return _model_assets().save_source(root,source,info,_model_assets_base())



def _fetch_model_preview(kind, name, root_id=None, info=None, fill=False, cancel_event=None):
    _check_model_task(cancel_event)
    root, source = _resolve_model_file(kind, name, root_id)
    existing = _model_preview_info(kind, name, root_id)
    if existing and not fill:
        return {'ok': True, 'preview': existing, 'previews': _model_previews_info(kind, name, root_id), 'cached': True, 'message': '使用已有本地预览图'}
    info = info or _adjacent_civitai_info(source) or _load_model_source_cache().get(_model_cache_key(kind, root, source))
    if not info:
        return {'ok': False, 'preview': None, 'message': '请先获取模型来源，再获取预览图'}
    provider = info.get('provider_id')
    repo = info.get('model_id')
    parsed = urlsplit(str(info.get('url') or ''))
    parts = [p for p in parsed.path.split('/') if p]
    if not provider or not repo:
        if parsed.hostname in ('civitai.com', 'civitai.red') and len(parts) >= 2 and parts[0] == 'models' and parts[1].isdigit():
            provider, repo = 'civitai', parts[1]
        elif parsed.hostname in ('huggingface.co', 'hf-mirror.com') and len(parts) >= 2:
            provider, repo = ('huggingface' if parsed.hostname == 'huggingface.co' else 'hfmirror'), '/'.join(parts[:2])
        elif parsed.hostname in ('modelscope.cn', 'www.modelscope.cn') and len(parts) >= 3 and parts[0] == 'models':
            provider, repo = 'modelscope', '/'.join(parts[1:3])
        else:
            return {'ok': False, 'preview': None, 'message': '该来源暂不支持自动获取预览图'}
    before = os.stat(source)
    service = _online_models()
    model = service.detail(provider, str(repo))
    _check_model_task(cancel_event)
    versions = model.get('versions') or []
    version_id = str(info.get('version_id') or (parse_qs(parsed.query).get('modelVersionId') or [''])[0])
    version_name = str(info.get('version') or '')
    # The source identifies a *model version*, not just a model page. Never
    # silently use the first version if its images may depict another release.
    if version_id:
        version = next((v for v in versions if str(v.get('id')) == version_id), None)
        if version is None:
            return {'ok': False, 'preview': existing, 'previews': _model_previews_info(kind, name, root_id),
                    'message': '来源已识别，但未找到对应版本的示例图（未使用其他版本图片）'}
    elif version_name:
        version = next((v for v in versions if str(v.get('name')) == version_name), None)
        if version is None:
            return {'ok': False, 'preview': existing, 'previews': _model_previews_info(kind, name, root_id),
                    'message': '来源版本名称不匹配，已跳过可能不对应的示例图'}
    elif len(versions) == 1:
        version = versions[0]
    elif len(versions) > 1:
        return {'ok': False, 'preview': existing, 'previews': _model_previews_info(kind, name, root_id),
                'message': '来源包含多个版本，但本地没有版本 ID；为避免配错图，暂不自动下载示例'}
    else:
        version = {}
    after = os.stat(source)
    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError('模型文件发生变化，请重新选择模型')
    _check_model_task(cancel_event)
    result = service.save_model_preview(root, source, model, version, **({"event": cancel_event} if cancel_event is not None else {}))
    _check_model_task(cancel_event)
    preview = _model_preview_info(kind, name, root_id)
    return {'ok': bool(preview), 'preview': preview, 'previews': _model_previews_info(kind, name, root_id), 'cached': result['status']=='existing',
            'message': result.get('message') or '来源没有可用预览图'}



def _source_and_preview(kind, name, root_id=None, cancel_event=None):
    _check_model_task(cancel_event)
    result = _fetch_model_source(kind, name, root_id, **({"cancel_event": cancel_event} if cancel_event is not None else {}))
    _check_model_task(cancel_event)
    root, source = _resolve_model_file(kind, name, root_id)
    try:
        _check_model_task(cancel_event)
        _persist_model_source(root, source, result['source'])
    except (OSError,ValueError):
        result['warning'] = '来源已识别，但来源记录未能保存到独立附件目录'
    # The source button is an explicit user action: fetch missing example
    # images even when a user-supplied local cover already exists. Never
    # overwrite that cover or any previously downloaded preview slot.
    try:
        art = _fetch_model_preview(kind, name, root_id, result['source'], fill=True, **({"cancel_event": cancel_event} if cancel_event is not None else {}))
        result['preview'] = art.get('preview')
        result['previews'] = art.get('previews') or []
        result['preview_message'] = art.get('message') or ''
    except ModelTaskCancelled:
        raise
    except Exception as ex:
        # Failed image retrieval must not discard a valid source or local art.
        result['previews'] = _model_previews_info(kind, name, root_id)
        result['preview'] = result['previews'][0] if result['previews'] else None
        result['preview_message'] = '来源已识别，示例图获取失败：' + str(ex)[:400]
    return result



def _browser_target(kind, root_id=0, folder='', directory=True):
    roots = _model_roots(kind, include_missing_default=False)
    try:
        if isinstance(root_id, bool) or str(root_id) != str(int(root_id)):
            raise ValueError()
        if int(root_id) < 0:
            raise ValueError()
        root = roots[int(root_id)]
    except (ValueError, TypeError, IndexError):
        raise ValueError('模型根目录编号无效')
    rel = _safe_relative_model_path(folder, allow_empty=directory)
    target = os.path.join(root, rel) if rel else root
    if not _path_inside(root, target):
        raise ValueError('文件路径越出模型目录')
    if not (os.path.isdir(target) if directory else os.path.isfile(target)):
        raise ValueError('目录或文件不存在：' + str(folder))
    return root, target



def _reveal_library_path(target, directory=False):
    if os.name == 'nt':
        args = ['explorer.exe', os.path.normpath(target)] if directory else ['explorer.exe', '/select,' + os.path.normpath(target)]
        subprocess.Popen(args, close_fds=True)
    else:
        opener = shutil.which('xdg-open')
        if not opener:
            raise ValueError('当前系统没有可用的文件管理器打开命令（xdg-open）')
        subprocess.Popen([opener, target if directory else os.path.dirname(target)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)



def _model_browser_catalog(query=""):
    paths = _path_settings()
    base = paths.get('modelBase') or ''
    result = {'path': base, 'folders': [], 'models': [], 'warnings': list(paths.get('pathWarnings', []))}
    seen = set()
    def add(kind, rid, path, external=False):
        key = os.path.normcase(os.path.realpath(path))
        if key in seen or not os.path.isdir(path):
            return
        seen.add(key)
        result['folders'].append({'kind': kind, 'root_id': rid, 'name': os.path.basename(path.rstrip('/\\')),
                                  'path': path, 'pin_key': key, 'folder': '', 'external': external})
    if base and os.path.isdir(base):
        for entry in sorted(os.scandir(base), key=lambda x: x.name.casefold()):
            if not entry.is_dir():
                continue
            kind = next((k for k, names in _MODEL_DIR_KEYS.items() if entry.name in names), 'folder:' + entry.name)
            try:
                roots = _model_roots(kind, include_missing_default=False)
                rid = next((i for i, root in enumerate(roots) if os.path.normcase(os.path.realpath(root)) == os.path.normcase(os.path.realpath(entry.path))), 0)
                add(kind, rid, entry.path)
            except (OSError, ValueError) as ex:
                result['warnings'].append(entry.name + '：' + str(ex)[:400])
        result['models'] = _browse_model_library('models')['models']
    elif base:
        result['warnings'].append('models 目录不存在：' + base)
    for kind in _MODEL_DIR_KEYS:
        for rid, path in enumerate(_model_roots(kind, include_missing_default=False)):
            add(kind, rid, path, external=True)
    result['folders'].sort(key=lambda x: (x['name'].casefold(), x['path'].casefold()))
    query = str(query or '').strip().casefold()
    if query:
        files = [m for m in result['models'] if query in m['file'].casefold()]
        for entry in result['folders']:
            try:
                data = _browse_model_library(entry['kind'], entry['root_id'], query=query)
            except OSError as ex:
                result['warnings'].append(str(ex)[:400]); continue
            files.extend(dict(m, category=entry['name']) for m in data['models'])
            result['warnings'].extend(data['warnings'])
        seen_files = set()
        result['models'] = []
        for item in files:
            key = os.path.normcase(os.path.realpath(item['path']))
            if key not in seen_files:
                seen_files.add(key); result['models'].append(item)
        result['models'].sort(key=lambda x: (x['file'].casefold(), x['path'].casefold()))
        result['folders'] = [f for f in result['folders'] if query in f['name'].casefold()]
    return result



def _browse_model_library(kind, root_id=0, folder='', query='', preferred='', tree=False):
    # Preferred model is used only for the existing Dock shortcuts.
    if preferred:
        try:
            root, source = _resolve_model_file(kind, preferred)
            root_id = _model_roots(kind, include_missing_default=False).index(root)
            folder = '' if tree else os.path.dirname(_model_public_name(root, source))
        except ValueError:
            pass
    root, current = _browser_target(kind, root_id, folder)
    folder = os.path.relpath(current, root).replace('\\', '/')
    folder = '' if folder == '.' else folder
    result = {'kind': kind, 'root_id': int(root_id), 'folder': folder, 'path': current,
              'roots': [{'id': int(root_id), 'name': os.path.basename(root.rstrip('/\\')), 'path': root}],
              'folders': [], 'models': [], 'warnings': []}
    query = str(query or '').strip().casefold()
    def add_file(path):
        if os.path.islink(path) or not _path_inside(root, path) or _model_assets().is_model_attachment(root,path):
            return
        try:
            stat = os.stat(path)
        except OSError:
            return
        name = _model_public_name(root, path).replace('\\', '/')
        result['models'].append({'kind': kind, 'root_id': int(root_id), 'name': name, 'file': os.path.basename(path),
                                 'path': path, 'folder': os.path.dirname(name), 'size': int(stat.st_size),
                                 'size_text': _human_file_size(stat.st_size), 'is_model': os.path.splitext(path)[1].lower() in _MODEL_EXTENSIONS})
    if query or tree:
        # Search / tree enumeration never follows directory links.
        def on_error(error): result['warnings'].append(str(error)[:400])
        for parent, dirs, files in os.walk(current, followlinks=False, onerror=on_error):
            dirs[:] = sorted([d for d in dirs if not os.path.islink(os.path.join(parent, d)) and _path_inside(root, os.path.join(parent, d))], key=str.casefold)
            if tree and not query:
                parent_rel=os.path.relpath(parent,root).replace('\\','/')
                parent_rel='' if parent_rel=='.' else parent_rel
                for name in dirs:
                    result['folders'].append({'root_id':int(root_id),'path':(parent_rel+'/'+name).strip('/'),'name':name,'parent':parent_rel})
            for filename in files:
                if not query or query in filename.casefold():
                    add_file(os.path.join(parent, filename))
    else:
        for entry in sorted(os.scandir(current), key=lambda x: x.name.casefold()):
            if entry.is_dir():
                if entry.is_symlink() or not _path_inside(root, entry.path):
                    result['warnings'].append('未进入目录链接：' + entry.name)
                    continue
                rel = _model_public_name(root, entry.path).replace('\\', '/')
                result['folders'].append({'root_id': int(root_id), 'path': rel, 'name': entry.name, 'parent': folder})
            elif entry.is_file():
                add_file(entry.path)
    result['models'].sort(key=lambda x: x['name'].casefold())
    return result



def _scan_model_library(kind):
    roots = _model_roots(kind, include_missing_default=True)
    result = {'kind': kind, 'roots': [], 'folders': [], 'models': []}
    for root_id, root in enumerate(roots):
        result['roots'].append({'id': root_id, 'name': os.path.basename(root.rstrip('\\/')) or root, 'path': root})
        for current, dirs, files in os.walk(root):
            dirs[:] = sorted([d for d in dirs if not d.startswith('.')], key=str.lower)
            rel_dir = os.path.relpath(current, root)
            rel_dir = '' if rel_dir == '.' else rel_dir.replace('\\', '/')
            for d in dirs:
                rel = (rel_dir + '/' + d).strip('/')
                result['folders'].append({'root_id': root_id, 'path': rel, 'name': d, 'parent': rel_dir})
            for f in sorted(files, key=str.lower):
                ext = os.path.splitext(f)[1].lower()
                if ext not in _MODEL_EXTENSIONS:
                    continue
                full = os.path.join(current, f)
                rel = os.path.relpath(full, root).replace('\\', '/')
                try:
                    size = os.path.getsize(full)
                except OSError:
                    size = 0
                result['models'].append({'root_id': root_id, 'name': rel, 'file': f, 'folder': rel_dir,
                                         'size': int(size), 'size_text': _human_file_size(size)})
    result['folders'].sort(key=lambda x: (x['root_id'], x['path'].lower()))
    result['models'].sort(key=lambda x: (x['root_id'], x['name'].lower()))
    return result



def _sha256_file(path, cancel_event=None):
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            _check_model_task(cancel_event)
            chunk = f.read(8 * 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    _check_model_task(cancel_event)
    return digest.hexdigest()



def _fetch_model_source(kind, name, root_id=None, cancel_event=None):
    _check_model_task(cancel_event)
    root, source = _resolve_model_file(kind, name, root_id)
    key = _model_cache_key(kind, root, source)
    cache = _load_model_source_cache()
    adjacent = _adjacent_civitai_info(source)
    if adjacent:
        cache[key] = adjacent; _save_model_source_cache(cache)
        return {'ok': True, 'source': adjacent, 'cached': True}
    if key in cache:
        return {'ok': True, 'source': cache[key], 'cached': True}
    sha = _sha256_file(source, **({"cancel_event": cancel_event} if cancel_event is not None else {})).upper()
    _check_model_task(cancel_event)
    url = 'https://civitai.com/api/v1/model-versions/by-hash/' + sha
    try:
        service = _online_models()
        data = service._json(url, 'civitai')
        _check_model_task(cancel_event)
    except ModelTaskCancelled:
        raise
    except Exception as ex:
        raise ValueError('未能从 Civitai 识别该模型：%s' % ex)
    if not isinstance(data, dict) or not data.get('modelId'):
        raise ValueError('Civitai 没有返回可识别的模型来源')
    source_info = {'provider': 'Civitai',
                   'url': 'https://%s/models/%s?modelVersionId=%s' % (getattr(service, 'civitai_domain', 'civitai.com'), data.get('modelId'), data.get('id')),
                   'title': str(data.get('name') or ''), 'base_model': str(data.get('baseModel') or ''),
                   'trained_words': [str(w) for w in (data.get('trainedWords') or []) if str(w).strip()][:50],
                   'sha256': sha, 'method': 'sha256', 'provider_id': 'civitai',
                   'model_id': str(data.get('modelId')), 'version_id': str(data.get('id'))}
    _check_model_task(cancel_event)
    cache[key] = source_info; _save_model_source_cache(cache)
    return {'ok': True, 'source': source_info, 'cached': False}


def _model_roots_info(kind):
    roots = _model_roots(kind, include_missing_default=True)
    return {'kind': kind, 'roots': [{'path': r, 'exists': os.path.isdir(r)} for r in roots]}



def _check_model_task(event):
    if event is not None and event.is_set():
        raise ModelTaskCancelled('模型任务已取消')



def _register_model_task(request_id):
    if not isinstance(request_id, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{8,80}', request_id):
        raise ValueError('无效的模型任务 ID')
    with _MODEL_TASKS_LOCK:
        if request_id in _MODEL_TASKS:
            raise ValueError('模型任务 ID 已在使用')
        event = threading.Event()
        _MODEL_TASKS[request_id] = event
        return event



def _cancel_model_task(request_id):
    with _MODEL_TASKS_LOCK:
        event = _MODEL_TASKS.get(request_id)
        if event is not None:
            event.set()
    return bool(event)



def _online_models():
    global _ONLINE_MODELS
    with _ONLINE_LOCK:
        if _ONLINE_MODELS is None:
            import importlib.util
            spec = importlib.util.spec_from_file_location('dsh_online_models', os.path.join(HERE, 'aline_mods', 'online_models.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            _ONLINE_MODELS = module.OnlineModels(os.path.dirname(_model_source_cache_path()), _model_roots)
        return _ONLINE_MODELS





# ==================== 第二批：历史 / 设置 / 翻译 / 小接口 ====================
class ExpansionJobs:
    def __init__(self):
        self.lock = threading.Lock()
        self.active = {}
        self.cancelled = {}  # 取消请求可能先于生成请求到达；短时保留墓碑。

    def _prune(self):
        now = time.monotonic()
        for key, at in list(self.cancelled.items()):
            if now - at > 300:
                self.cancelled.pop(key, None)

    @staticmethod
    def _validate(job_id):
        if not isinstance(job_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,100}', job_id):
            raise ValueError('无效的扩写任务 ID')
        return job_id

    def cancel(self, job_id):
        job_id = self._validate(job_id)
        with self.lock:
            self._prune()
            self.cancelled[job_id] = time.monotonic()
            if len(self.cancelled) > 512:
                oldest = min(self.cancelled, key=self.cancelled.get)
                self.cancelled.pop(oldest, None)
            job = self.active.get(job_id)
            if job:
                job['cancelled'].set()
                proc = job.get('process')
            else:
                proc = None
        if proc and proc.poll() is None:
            try:
                proc.kill()  # 只杀本次扩写 worker，绝不影响 ComfyUI/sidecar。
            except OSError:
                pass
        return True

    def run(self, job_id, payload):
        job_id = self._validate(job_id)
        job = {'cancelled':threading.Event(), 'process':None}
        with self.lock:
            self._prune()
            if job_id in self.cancelled:
                raise RuntimeError('扩写已取消')
            if job_id in self.active:
                raise ValueError('扩写任务 ID 已在使用')
            if len(self.active) >= 4:
                raise RuntimeError('并发扩写任务过多，请稍后重试')
            self.active[job_id] = job
        proc = None
        try:
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
            proc = subprocess.Popen([sys.executable, '-u', os.path.abspath(__file__), '--expand-worker'],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, encoding='utf-8', errors='replace',
                creationflags=flags)
            with self.lock:
                job['process'] = proc
                stopped = job['cancelled'].is_set()
            if stopped:
                proc.kill()
            try:
                out, err = proc.communicate(input=json.dumps(payload, ensure_ascii=False), timeout=205)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                raise TimeoutError('AI 扩写超时')
            if job['cancelled'].is_set():
                raise RuntimeError('扩写已取消')
            if proc.returncode:
                raise RuntimeError('AI 扩写进程失败：' + (err or out)[-500:])
            result = json.loads(out.strip().splitlines()[-1])
            if not result.get('ok'):
                raise RuntimeError(str(result.get('error') or 'AI 扩写失败'))
            return result['result']
        finally:
            with self.lock:
                self.active.pop(job_id, None)
                self.cancelled.pop(job_id, None)
            if proc and proc.poll() is None:
                proc.kill()
                proc.communicate()



def _translation():
    global _TRANSLATION, _translation_module
    with _TRANSLATION_LOCK:
        if _TRANSLATION is None:
            import importlib.util
            spec = importlib.util.spec_from_file_location('dsh_offline_translation', os.path.join(HERE, 'aline_mods', 'offline_translation.py'))
            _translation_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(_translation_module)
            _TRANSLATION = _translation_module.OfflineTranslation(_dictionary().path.parent)
        return _TRANSLATION

def _normal_path(path):
    return CROSS_PATHS.runtime_path(path)



def _valid_comfy_root(root):
    return bool(COMFY_INSTALL.layout(root))



def _infer_root_from_script(script):
    return COMFY_INSTALL.infer_root(script, COMFY_PATHS, LAUNCH_MODES)



def _portable_root_candidates():
    """Same portable-layout candidates as the Node host (not arbitrary disk traversal)."""
    home = os.path.expanduser('~')
    names = ('ComfyUI_Windows_portable', 'ComfyUI_windows_portable')
    if os.name == 'nt':
        for drive in ('C:', 'D:', 'E:', 'F:'):
            for name in names:
                yield os.path.join(drive + os.sep, 'ComfyUI', name)
            yield os.path.join(drive + os.sep, 'ComfyUI_windows_portable')
    for parent in (home, os.path.join(home, 'Desktop'), os.path.join(home, 'Downloads')):
        for name in names:
            yield os.path.join(parent, name)
        yield os.path.join(parent, 'ComfyUI')



def _resolve_comfy_root(cfg):
    """Return validated root, provenance, warnings. Never return an invalid saved root."""
    warnings = []
    try: saved = _normal_path(cfg.get('comfyRoot', ''))
    except ValueError as ex: warnings.append(str(ex)); saved = ''
    try: script = _normal_path(cfg.get('startScript', ''))
    except ValueError as ex: warnings.append(str(ex)); script = ''
    if _valid_comfy_root(saved):
        return saved, 'config.comfyRoot', warnings
    if saved:
        warnings.append('comfyRoot 无效（缺少 ComfyUI/main.py 或源码布局标志），已忽略：' + saved)
    inferred = _infer_root_from_script(script)
    if inferred:
        return inferred, 'config.startScript', warnings
    if script:
        warnings.append('startScript 无法定位有效 ComfyUI 根目录：' + script)
    for candidate in _portable_root_candidates():
        if _valid_comfy_root(candidate):
            return candidate, 'auto.portable', warnings
    return '', 'not-found', warnings



def _safe_optional_path(value, warnings):
    try: return _normal_path(value)
    except ValueError as ex: warnings.append(str(ex)); return ''



def _load_cfg():
    cfg = {}; config_errors=[]
    if os.path.exists(CONFIG):
        try:
            with open(CONFIG, encoding='utf-8-sig') as f:
                cfg = json.load(f)
            if not isinstance(cfg,dict):raise ValueError('config.json 顶层必须是对象')
        except (OSError,ValueError) as ex:
            cfg={};config_errors.append('配置读取失败：'+str(ex))
    def port(key,default):
        value=cfg.get(key,default)
        if isinstance(value,bool) or not re.fullmatch(r'[0-9]+',str(value)) or not 1<=int(value)<=65535:
            config_errors.append(key+' 必须为 1–65535 的整数');return default
        return int(value)
    comfy_port=port('comfyPort',8188);sidecar_port=port('sidecarPort',8199)
    if comfy_port==sidecar_port:config_errors.append('ComfyUI 和 Sidecar 端口不能相同')
    if not isinstance(cfg.get('extraModelPathsConfig',[]),list) or any(not isinstance(p,str) for p in cfg.get('extraModelPathsConfig',[])):
        config_errors.append('extraModelPathsConfig 必须为路径字符串数组')
    root, root_source, root_warnings = _resolve_comfy_root(cfg)
    namespace_errors=[]
    try: script = _normal_path(cfg.get('startScript', ''))
    except ValueError as ex: script = str(cfg.get('startScript') or ''); namespace_errors.append(str(ex)); root_warnings.append(str(ex))
    info = COMFY_INSTALL.layout(root) or {}
    launchers = COMFY_INSTALL.launchers(root, COMFY_PATHS, LAUNCH_MODES)
    script_source = 'config.startScript' if script else 'direct'
    compatible = [entry for entry in launchers if entry['compatible'] and entry['recognized']]
    selection_required = not script and len(compatible) > 1 and not cfg.get('comfyPythonExe')
    if not script and len(compatible) == 1:
        script = compatible[0]['path']; script_source = 'auto.launcher'
    try: py = _normal_path(cfg.get('comfyPythonExe', ''))
    except ValueError as ex: root_warnings.append(str(ex)); namespace_errors.append(str(ex)); py = ''
    py_source = 'config.comfyPythonExe' if cfg.get('comfyPythonExe') else ''
    if py and not os.path.isfile(py):
        root_warnings.append('ComfyUI Python 不存在：' + py)
        py = ''  # Explicit but broken interpreter does not fall back.
    elif not py_source:
        py, py_source = COMFY_INSTALL.select_python(root, script, COMFY_PATHS, LAUNCH_MODES)
        if not py:
            try: sidecar_py = _normal_path(cfg.get('pythonExe', ''))
            except ValueError as ex: root_warnings.append(str(ex)); sidecar_py = ''
            py = sidecar_py if sidecar_py and os.path.isfile(sidecar_py) else sys.executable if root else ''
            py_source = 'config.pythonExe' if py == sidecar_py and py else 'sidecar.fallback' if py else 'not-found'
            if py: root_warnings.append('未找到 ComfyUI 专用 Python，直接启动将使用 Sidecar 解释器；请确认已安装 ComfyUI 依赖。')
    if selection_required:
        root_warnings.append('发现多个启动文件，请在连接设置选择所需硬件的启动文件；不会自动选择 NVIDIA 或更改 GPU 参数。')
    try: work = _normal_path(cfg.get('workDir', '')) or HERE
    except ValueError as ex: root_warnings.append(str(ex)); work = HERE
    try:
        os.makedirs(work, exist_ok=True)
    except OSError:
        work = HERE
    return {
        'namespaceErrors': namespace_errors,'configErrors':config_errors,
        'comfyRoot': root, 'comfyRootSource': root_source, 'pathWarnings': root_warnings+config_errors, 'comfyPy': py,
        'comfyMainDir': info.get('mainDir', ''), 'comfyLayout': info.get('layout', 'not-found'),
        'comfyPythonSource': py_source, 'comfyPythonExe': cfg.get('comfyPythonExe') or '',
        'startScriptSource': script_source, 'launchers': launchers, 'launcherSelectionRequired': selection_required,
        'comfyMain': info.get('main', ''),
        'startScript': script,
        'instanceId': cfg.get('instanceId') or '',
        'outputDirectory': str(cfg.get('outputDirectory') or ''),
        'tempDirectory': str(cfg.get('tempDirectory') or ''),
        'extraModelPathsConfig': cfg.get('extraModelPathsConfig') if isinstance(cfg.get('extraModelPathsConfig'), list) else [],
        'comfyPort':comfy_port,
        'sidecarPort':sidecar_port,
        'workDir': work, 'credsFile': _safe_optional_path(cfg.get('credsFile', ''), root_warnings),
        'allowedOrigins': cfg.get('allowedOrigins') or [],
        'allowNullOrigin': bool(cfg.get('allowNullOrigin', False)),
        'extraArgs': cfg.get('extraComfyArgs') if isinstance(cfg.get('extraComfyArgs'), list) else [],
    }



def _comfy_repo_root():
    for candidate in (os.path.join(COMFY_ROOT, 'ComfyUI'), COMFY_ROOT):
        if os.path.isdir(os.path.join(candidate, '.git')):
            return candidate
    return ''



def _comfy_git_binary():
    candidate = os.path.join(COMFY_ROOT, 'MinGit', 'cmd', 'git.exe')
    if os.path.isfile(candidate):
        return candidate
    return shutil.which('git') or 'git'



def _comfy_git(args, timeout=60):
    repo = _comfy_repo_root()
    if not repo:
        raise ValueError('无法定位 ComfyUI 的 .git 目录')
    env = os.environ.copy()
    env['PATH'] = os.path.join(COMFY_ROOT, 'MinGit', 'cmd') + os.pathsep + env.get('PATH', '')
    result = subprocess.run([_comfy_git_binary()] + list(args), cwd=repo, env=env,
                            capture_output=True, text=True, timeout=timeout,
                            encoding='utf-8', errors='replace')
    if result.returncode:
        raise ValueError((result.stderr or result.stdout or 'git 命令失败').strip()[:600])
    return result.stdout.strip()



def _version_key(value):
    try:
        return tuple(int(part) for part in re.findall(r'\d+', str(value))[:4])
    except Exception:
        return (0,)



def _comfy_current_version():
    repo = _comfy_repo_root()
    if not repo:
        return ''
    try:
        text = open(os.path.join(repo, 'comfyui_version.py'), encoding='utf-8').read()
        match = re.search(r'__version__\s*=\s*["\']([^"\']+)', text)
        if match:
            return match.group(1)
    except OSError:
        pass
    try:
        return _comfy_git(['describe', '--tags', '--abbrev=0'], timeout=20)
    except Exception:
        return ''



def _comfy_latest_version(force=False):
    now = time.time()
    cached = _COMFY_UPDATE_CACHE.get('data')
    if not force and cached and now - _COMFY_UPDATE_CACHE.get('time', 0) < _COMFY_UPDATE_CACHE_SECONDS:
        return cached
    try:
        output = _comfy_git(['ls-remote', '--tags', '--refs', 'origin', 'v*'], timeout=45)
        versions = []
        for line in output.splitlines():
            ref = line.split('\t')[-1].strip()
            match = re.search(r'/v(\d+(?:\.\d+){1,3})$', ref)
            if match:
                versions.append(match.group(1))
        latest = max(versions, key=_version_key) if versions else ''
        if not latest:
            raise ValueError('远程没有可识别的 ComfyUI 版本标签')
        data = {'latest': latest, 'error': ''}
    except Exception as exc:
        data = {'latest': '', 'error': str(exc)[:500]}
    _COMFY_UPDATE_CACHE['time'] = now
    _COMFY_UPDATE_CACHE['data'] = data
    return data



def _comfy_queue_counts():
    if not COMFY.running():
        return 0, 0
    try:
        data = _http_json('http://127.0.0.1:%d/queue' % COMFY_PORT, '', timeout=8)
        return len(data.get('queue_running') or []), len(data.get('queue_pending') or [])
    except Exception:
        return 1, 0



def _comfy_update_info(force=False):
    current = _comfy_current_version()
    latest_data = _comfy_latest_version(force)
    latest = latest_data.get('latest', '')
    running, pending = _comfy_queue_counts()
    dirty = False
    repo = _comfy_repo_root()
    if repo:
        try:
            dirty = bool(_comfy_git(['status', '--porcelain'], timeout=20))
        except Exception:
            dirty = False
    return {'current': current, 'latest': latest,
            'available': bool(current and latest and _version_key(latest) > _version_key(current)),
            'running': COMFY.running(), 'queue_running': running, 'queue_pending': pending,
            'busy': bool(running or pending), 'localChanges': dirty,
            'repo': repo, 'error': latest_data.get('error', '')}



def _update_launch_settings(data):
    with _SETTINGS_LOCK:
        return _update_launch_settings_locked(data)



def _update_launch_settings_locked(data):
    """只修改明确许可字段，原子保存；不要丢掉用户的其他配置。"""
    if not isinstance(data, dict):
        raise ValueError('配置必须是 JSON 对象')
    script = _normal_path(data.get('startScript', CFG['startScript']))
    if script:
        suffix = os.path.splitext(script)[1].lower()
        allowed = {'.bat', '.cmd', '.ps1', '.py', '.sh', '.exe'}
        if suffix not in allowed:
            raise ValueError('启动文件只支持 .bat / .cmd / .ps1 / .py / .sh / .exe')
        if not os.path.isabs(script) or not os.path.isfile(script):
            raise ValueError('启动文件不存在或不是绝对路径：' + script)
        if os.name == 'nt' and suffix == '.sh':
            raise ValueError('Windows sidecar 不支持 .sh，请选择 .bat/.cmd/.ps1/.py')
        if os.name != 'nt' and suffix in ('.bat', '.cmd', '.ps1', '.exe'):
            raise ValueError('当前 sidecar 是 Linux Python；Windows 启动脚本需要用 Windows Python 启动 sidecar（参见 WSL 安装说明）')
    if script: CROSS_PATHS.command_cwd(script)
    port = data.get('comfyPort', CFG['comfyPort'])
    if isinstance(port, bool) or not str(port).isdigit() or not (1 <= int(port) <= 65535):
        raise ValueError('ComfyUI 端口范围须为 1–65535')
    port = int(port)
    if port == BOUND_SIDECAR_PORT:
        raise ValueError('ComfyUI 端口不能与 sidecar 端口相同')
    old = {}
    if os.path.isfile(CONFIG):
        with open(CONFIG, encoding='utf-8-sig') as f:
            old = json.load(f)
        if not isinstance(old,dict):raise ValueError('config.json 顶层必须是对象，原文件保留')
    old['startScript'] = script
    old['comfyPort'] = port
    if script:
        inferred = _infer_root_from_script(script)
        if inferred:
            old['comfyRoot'] = inferred
    for key in COMFY_PATHS.CONFIG_KEYS:
        if key not in data:
            continue
        value = data[key]
        if key == 'extraModelPathsConfig':
            if not isinstance(value, list) or any(not isinstance(x, str) for x in value):
                raise ValueError('extraModelPathsConfig 必须为路径字符串数组')
            value = [COMFY_PATHS.normalize(x) for x in value if x.strip()]
        else:
            if not isinstance(value, str): raise ValueError(key + ' 必须为字符串')
            value = COMFY_PATHS.normalize(value)
        old[key] = value
    if 'comfyRoot' in data:
        value = _normal_path(data['comfyRoot'])
        if value and (not os.path.isabs(value) or not _valid_comfy_root(value)):
            raise ValueError('ComfyUI 安装目录无效：' + value)
        old['comfyRoot'] = value
    if 'comfyPythonExe' in data:
        value = _normal_path(data['comfyPythonExe'])
        if value and (not os.path.isabs(value) or not os.path.isfile(value)):
            raise ValueError('ComfyUI Python 不存在或不是绝对路径：' + value)
        old['comfyPythonExe'] = value
    candidate_root, _, _ = _resolve_comfy_root(old)
    if script and data.get('comfyRoot'):
        inferred_root = _infer_root_from_script(script)
        if inferred_root and os.path.realpath(COMFY_INSTALL.layout(inferred_root)['mainDir']) != os.path.realpath(COMFY_INSTALL.layout(candidate_root)['mainDir']):
            raise ValueError('启动文件与安装目录不一致，请清空安装目录自动识别，或选择对应的启动文件。')
    diagnostic = COMFY_PATHS.resolve(candidate_root, old, LAUNCH_MODES, _MODEL_DIR_KEYS)
    # Only validate newly supplied explicit fields; unchanged broken config stays
    # visible in /settings and cannot silently redirect file access.
    for name, key in (('output', 'outputDirectory'), ('temp', 'tempDirectory')):
        if key in data and old.get(key) and diagnostic['resolvedPaths'][name]['error']:
            raise ValueError(diagnostic['resolvedPaths'][name]['error'])
    if 'extraModelPathsConfig' in data:
        explicit_models={os.path.normcase(os.path.realpath(path)) for path in old.get('extraModelPathsConfig',[])}
        for entry in diagnostic['modelConfigs']:
            if os.path.normcase(os.path.realpath(entry['path'])) in explicit_models and entry['error']:
                raise ValueError(entry['error'])
        for path in old.get('extraModelPathsConfig', []):
            if not os.path.isabs(path) or not os.path.isfile(path):
                raise ValueError('模型配置文件不存在或不是绝对路径：' + path)
    if COMFY_PATHS.launch_overrides(candidate_root, old) and script:
        caps = LAUNCH_MODES.capabilities(script)
        if not caps['background']:
            raise ValueError('此启动脚本无法安全应用目录设置：' + caps['reason'])
    fd,tmp = tempfile.mkstemp(prefix='.dsh-settings-',suffix='.tmp',dir=os.path.dirname(os.path.abspath(CONFIG)))
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as f:
            json.dump(old,f,ensure_ascii=False,indent=2)
        os.replace(tmp,CONFIG)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    refreshed = _load_cfg()
    CFG.update(refreshed)
    global COMFY_ROOT, COMFY_PY, COMFY_MAIN, COMFY_PORT, COMFY_EXTRA_ARGS
    COMFY_ROOT, COMFY_PY, COMFY_MAIN = CFG['comfyRoot'], CFG['comfyPy'], CFG['comfyMain']
    COMFY_PORT, COMFY_EXTRA_ARGS = CFG['comfyPort'], CFG['extraArgs']
    return _public_settings()



def _public_settings():
    with _SETTINGS_LOCK:
        return _public_settings_locked()



def _public_settings_locked():
    paths = _path_settings()
    output = paths['resolvedPaths']['output']
    return {'startScript': CFG['startScript'], 'comfyPort': CFG['comfyPort'],
            'sidecarPort': BOUND_SIDECAR_PORT, 'sidecarOS': os.name,
            'configErrors':CFG.get('configErrors',[]),
            'configured': bool(not CFG.get('configErrors') and not CFG.get('namespaceErrors') and not CFG.get('launcherSelectionRequired') and ((CFG['startScript'] and os.path.isfile(CFG['startScript'])) or (COMFY_PY and os.path.isfile(COMFY_PY) and os.path.isfile(COMFY_MAIN)))),
            'comfyLayout': CFG.get('comfyLayout'), 'comfyMainDir': CFG.get('comfyMainDir'),
            'comfyPythonExe': CFG.get('comfyPythonExe', ''), 'comfyPython': COMFY_PY,
            'comfyPythonSource': CFG.get('comfyPythonSource'), 'sidecarPython': sys.executable,
            'startScriptSource': CFG.get('startScriptSource'), 'launchers': CFG.get('launchers', []),
            'launcherSelectionRequired': CFG.get('launcherSelectionRequired', False),
            'launchModes': LAUNCH_MODES.capabilities(CFG['startScript']),
            'comfyRoot': CFG['comfyRoot'], 'comfyRootSource': CFG['comfyRootSource'],
            **paths, 'pathWarnings': CFG['pathWarnings'] + paths['pathWarnings'],
            'pathConfig': {key: CFG.get(key, [] if key == 'extraModelPathsConfig' else '') for key in COMFY_PATHS.CONFIG_KEYS},
            'outputRoot': '' if output['error'] else output['path'],
            'tempRoot': '' if paths['resolvedPaths']['temp']['error'] else paths['resolvedPaths']['temp']['path'],
            'pythonAvailable': bool(COMFY_PY and os.path.isfile(COMFY_PY))}



def _http_json(url, key, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    hdr = {'Content-Type': 'application/json'}
    if key:
        hdr['Authorization'] = 'Bearer ' + key
    req = urllib.request.Request(url, data=data, headers=hdr)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)



def _finish_model_task(request_id, event):
    with _MODEL_TASKS_LOCK:
        if _MODEL_TASKS.get(request_id) is event:
            del _MODEL_TASKS[request_id]


def _thumbnail_for_output(path, quality='medium'):
    """Generate bounded, disk-cached previews outside output/. Never expose arbitrary paths."""
    global _THUMB_WRITES
    quality = str(quality or 'medium').strip().lower()
    if quality not in _OUTPUT_PREVIEW_PROFILES:
        raise ValueError('预览画质无效')
    max_edge, webp_quality = _OUTPUT_PREVIEW_PROFILES[quality]
    path = _authorized_output_path(path)
    st = os.stat(path)
    if st.st_size > 256 * 1024 * 1024:
        raise ValueError('输出图片超过 256 MiB 上限')
    try:
        from PIL import Image, ImageOps
    except ImportError:
        raise ValueError('缩略图需要 Pillow；请在 sidecar Python 环境安装 pillow')
    # Do not store previews inside output/ (they would be re-indexed as images).
    cache_root = os.path.join(tempfile.gettempdir(), 'dsh-comfyui-thumbs',
                              hashlib.sha256(os.path.realpath(COMFY_ROOT).encode()).hexdigest()[:16])
    signature = '|'.join((os.path.realpath(path), str(st.st_size), str(st.st_mtime_ns),
                          'v2', quality, str(max_edge), str(webp_quality)))
    key = hashlib.sha256(signature.encode('utf-8', 'surrogatepass')).hexdigest()
    target = os.path.join(cache_root, key + '.webp')
    with _THUMB_LOCK:
        if os.path.isfile(target):
            with open(target, 'rb') as f: return f.read()
        os.makedirs(cache_root, exist_ok=True)
        # Pillow rejects decompression bombs; also cap decoded pixels explicitly.
        with Image.open(path) as image:
            if image.width * image.height > 100_000_000:
                raise ValueError('图片尺寸过大，无法创建预览')
            # JPEG can reduce decode cost before the final resize; other formats simply ignore draft().
            try: image.draft('RGB', (max_edge, max_edge))
            except (AttributeError, ValueError): pass
            image = ImageOps.exif_transpose(image)
            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS, reducing_gap=2.0)
            if image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            output = io.BytesIO()
            image.save(output, format='WEBP', quality=webp_quality, method=3)
            data = output.getvalue()
        temp = target + '.' + str(threading.get_ident()) + '.tmp'
        try:
            with open(temp, 'wb') as f: f.write(data)
            os.replace(temp, target)
        finally:
            if os.path.exists(temp): os.unlink(temp)
        _THUMB_WRITES += 1
        if _THUMB_WRITES % 32 == 0:
            # LRU-ish cap shared by both preview profiles.
            candidates = sorted((os.path.join(cache_root, n) for n in os.listdir(cache_root)
                                 if n.endswith('.webp')), key=os.path.getmtime, reverse=True)
            for old in candidates[1000:]:
                try: os.remove(old)
                except OSError: pass
        return data




def _resolved_image_root(name):
    entry = _path_settings(include_models=False)['resolvedPaths'][name]
    if entry['error']:
        raise ValueError(entry['error'])
    os.makedirs(entry['path'], exist_ok=True)
    return os.path.normpath(entry['path'])



def _default_output_root():
    return _resolved_image_root('output')



def _comfy_temp_root():
    return _resolved_image_root('temp')



def _safe_output_rel(value, allow_empty=False):
    raw = str(value or '').strip().replace('\\', '/')
    if not raw:
        return '' if allow_empty else (_ for _ in ()).throw(ValueError('输出路径不能为空'))
    if raw.startswith('/') or re.match(r'^[A-Za-z]:', raw):
        raise ValueError('这里需要 output 目录内的相对路径')
    parts = [x for x in raw.split('/') if x not in ('', '.')]
    if not parts or any(x == '..' for x in parts):
        raise ValueError('输出路径不能包含 ..')
    return os.path.join(*parts)



def _image_dimensions(path):
    try:
        with open(path, 'rb') as f:
            head = f.read(32)
            if head.startswith(b'\x89PNG\r\n\x1a\n') and len(head) >= 24:
                return int.from_bytes(head[16:20], 'big'), int.from_bytes(head[20:24], 'big')
            if head[:2] == b'\xff\xd8':
                f.seek(2)
                while True:
                    marker = f.read(2)
                    if len(marker) < 2: break
                    if marker[0] != 0xFF: continue
                    code = marker[1]
                    if code in (0xD8, 0xD9): continue
                    ln = int.from_bytes(f.read(2), 'big')
                    if ln < 2: break
                    if code in range(0xC0, 0xC4):
                        data = f.read(ln - 2)
                        if len(data) >= 5: return int.from_bytes(data[3:5], 'big'), int.from_bytes(data[1:3], 'big')
                    else: f.seek(ln - 2, 1)
    except OSError:
        pass
    return 0, 0



def _png_text(path):
    out = {}
    if os.path.splitext(path)[1].lower() != '.png':
        return out
    import zlib
    try:
        with open(path, 'rb') as f:
            if f.read(8) != b'\x89PNG\r\n\x1a\n': return out
            while True:
                raw = f.read(8)
                if len(raw) < 8: break
                ln = int.from_bytes(raw[:4], 'big'); typ = raw[4:8]
                if ln > 8 * 1024 * 1024 or typ not in (b'tEXt', b'iTXt'):
                    f.seek(ln + 4, 1)
                    if typ == b'IEND': break
                    continue
                data = f.read(ln); f.read(4)
                if typ == b'tEXt' and b'\x00' in data:
                    key, val = data.split(b'\x00', 1); out[key.decode('latin1', 'replace')] = val.decode('utf-8', 'replace')
                elif typ == b'iTXt':
                    parts = data.split(b'\x00', 5)
                    if len(parts) == 6:
                        key, flag, method, lang, translated, value = parts
                        if flag == b'\x01':
                            try:
                                decoder=zlib.decompressobj()
                                value=decoder.decompress(value, 8 * 1024 * 1024 + 1)
                                if len(value)>8 * 1024 * 1024 or decoder.unconsumed_tail:
                                    continue
                            except (zlib.error, ValueError): continue
                        out[key.decode('utf-8','replace')] = value.decode('utf-8','replace')
                if typ == b'IEND': break
    except OSError:
        pass
    return out



def _node_execution_state(node):
    """Return active / bypass / disabled for ComfyUI/LiteGraph node state hints."""
    if not isinstance(node, dict):
        return 'active'

    def truthy(value):
        if value is True:
            return True
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return value.strip().lower() in ('1', 'true', 'yes', 'on', 'enabled', 'disabled', 'mute', 'muted', 'bypass', 'skip', 'skipped')
        return False

    mode = node.get('mode')
    if isinstance(mode, str):
        low = mode.strip().lower()
        if low in ('4', 'bypass', 'bypassed'):
            return 'bypass'
        if low in ('2', 'never', 'mute', 'muted', 'disabled', 'skip', 'skipped'):
            return 'disabled'
    elif mode == 4:  # LiteGraph BYPASS
        return 'bypass'
    elif mode == 2:  # LiteGraph NEVER / ComfyUI Mute
        return 'disabled'

    bags = [node]
    for key in ('flags', 'properties'):
        value = node.get(key)
        if isinstance(value, dict):
            bags.append(value)
    for bag in bags:
        if truthy(bag.get('bypass')) or truthy(bag.get('bypassed')):
            return 'bypass'
        for key in ('disabled', 'mute', 'muted', 'skip', 'skipped'):
            if truthy(bag.get(key)):
                return 'disabled'
    return 'active'



def _workflow_node_states(workflow):
    if not isinstance(workflow, dict) or not isinstance(workflow.get('nodes'), list):
        return {}
    return {str(node.get('id')): _node_execution_state(node)
            for node in workflow.get('nodes') if isinstance(node, dict) and node.get('id') is not None}



def _looks_like_output_node(node_type):
    low = ''.join(ch for ch in str(node_type or '').lower() if ch.isalnum())
    if not low:
        return False
    if 'previewimage' in low or 'saveimage' in low or 'imagesave' in low or 'imageoutput' in low:
        return True
    if 'saveanimated' in low and ('png' in low or 'webp' in low or 'image' in low):
        return True
    if 'websocket' in low and 'image' in low:
        return True
    return False




def _bypass_passthrough_input_names(node_type, output_slot=None, ui_node=None, available_inputs=None):
    """Best-effort LiteGraph bypass routing.

    Bypass must not make auxiliary model inputs (ControlNet, upscaler, etc.) look executed.
    Prefer exact UI output/input name or type matches; then handle common ComfyUI transform nodes.
    Returning [] is safer than following every input when the mapping is ambiguous.
    """
    available = set(str(x) for x in (available_inputs or []) if x is not None)
    if isinstance(ui_node, dict):
        inputs = [x for x in (ui_node.get('inputs') or []) if isinstance(x, dict)]
        outputs = [x for x in (ui_node.get('outputs') or []) if isinstance(x, dict)]
        out = outputs[output_slot] if isinstance(output_slot, int) and 0 <= output_slot < len(outputs) else None
        if out:
            out_name = str(out.get('name') or '').strip().lower()
            out_type = str(out.get('type') or '').strip().lower()
            exact = [str(inp.get('name')) for inp in inputs
                     if str(inp.get('name') or '').strip().lower() == out_name and str(inp.get('name')) in available]
            if exact:
                return exact[:1]
            same_type = [str(inp.get('name')) for inp in inputs
                         if out_type and str(inp.get('type') or '').strip().lower() == out_type and str(inp.get('name')) in available]
            if len(same_type) == 1:
                return same_type
            if len(same_type) > 1:
                for preferred in ('positive', 'negative', 'model', 'clip', 'image', 'samples', 'latent', 'conditioning'):
                    if preferred in out_name:
                        hit = [name for name in same_type if preferred in name.lower()]
                        if hit:
                            return hit[:1]
                # Paired outputs such as positive/negative usually preserve input/output ordering.
                if isinstance(output_slot, int) and 0 <= output_slot < len(same_type):
                    return [same_type[output_slot]]

    low = str(node_type or '').lower()
    if 'loraloader' in low:
        preferred = 'model' if output_slot in (None, 0) else 'clip' if output_slot == 1 else ''
        return [preferred] if preferred in available else []
    if 'controlnet' in low and ('apply' in low or 'conditioning' in low):
        preferred = 'positive' if output_slot in (None, 0) else 'negative' if output_slot == 1 else ''
        return [preferred] if preferred in available else []
    if 'upscale' in low and 'model' in low and 'image' in available:
        return ['image']
    if ('modelsampling' in low or 'modelpatch' in low or 'freeu' in low) and 'model' in available:
        return ['model']

    # Generic one-in / one-out transforms are safe to bypass through.
    linked = [name for name in available if name]
    if len(linked) == 1:
        return linked
    return []



def _filename_prefix_matches(prefix, output_filename):
    if not prefix or not output_filename:
        return False
    prefix = str(prefix).replace('\\', '/').rstrip('/')
    prefix = prefix.rsplit('/', 1)[-1]
    stem = os.path.splitext(os.path.basename(str(output_filename)))[0]
    if not prefix:
        return False
    # Dynamic ComfyUI tokens cannot be reconstructed reliably from the PNG alone.
    if '%' in prefix:
        static = prefix.split('%', 1)[0].rstrip('_- ')
        return bool(static and stem.startswith(static))
    return stem.startswith(prefix)



def _params_from_api_prompt(graph, workflow=None, output_filename='', strict_output=False, output_node_id=None):
    if not isinstance(graph, dict):
        return None
    nodes = {str(k): v for k, v in graph.items() if isinstance(v, dict)}
    if not nodes:
        return None
    ui_states = _workflow_node_states(workflow)
    workflow_nodes = (workflow.get('nodes') or []) if isinstance(workflow, dict) else []
    ui_nodes = {str(n.get('id')): n for n in workflow_nodes if isinstance(n, dict) and n.get('id') is not None}

    def state(node_id):
        node_id = str(node_id)
        ui = ui_states.get(node_id, 'active')
        if ui != 'active':
            return ui
        return _node_execution_state(nodes.get(node_id))

    def linked_refs(node):
        out = []
        for name, value in (node.get('inputs') or {}).items():
            if isinstance(value, list) and len(value) >= 2 and str(value[0]) in nodes:
                ref = (str(value[0]), value[1], str(name))
                if ref not in out:
                    out.append(ref)
        return out

    downstream = {node_id: set() for node_id in nodes}
    for target_id, node in nodes.items():
        for origin_id, _slot, _name in linked_refs(node):
            downstream.setdefault(origin_id, set()).add(target_id)

    def output_score(node_id):
        node = nodes[node_id]
        typ = str(node.get('class_type', ''))
        inputs = node.get('inputs') or {}
        score = 0
        if _looks_like_output_node(typ):
            score += 100
        if not downstream.get(node_id):
            score += 10
        prefix = inputs.get('filename_prefix')
        if _filename_prefix_matches(prefix, output_filename):
            score += 1000
        return score

    candidates = [node_id for node_id, node in nodes.items()
                  if _looks_like_output_node(node.get('class_type')) and state(node_id) == 'active']
    exact = [node_id for node_id in candidates
             if _filename_prefix_matches((nodes[node_id].get('inputs') or {}).get('filename_prefix'), output_filename)]
    if output_node_id is not None:
        if str(output_node_id) not in candidates: return None
        roots = [str(output_node_id)]
    elif strict_output and (not candidates or len(exact)>1 or len(candidates)>1 and not exact):
        return None
    elif exact:
        roots = [max(exact, key=output_score)]
    elif len(candidates) == 1:
        roots = candidates
    elif candidates:
        # A PNG normally belongs to one output node. When no filename prefix can identify it,
        # pick the strongest sink instead of unioning every output branch (which would leak models
        # from unrelated previews / saves into this image's inspector).
        roots = [max(candidates, key=output_score)]
    else:
        samplers = [node_id for node_id, node in nodes.items()
                    if (str(node.get('class_type', '')).startswith('KSampler') and node.get('class_type') != 'KSamplerSelect' or node.get('class_type') in ('SamplerCustomAdvanced', 'SamplerCustom')) and state(node_id) == 'active']
        if not samplers:
            return None
        sink_samplers = [node_id for node_id in samplers if not downstream.get(node_id)]
        roots = [sink_samplers[0] if sink_samplers else samplers[0]]

    reachable = set()
    active_ids = set()
    bypass_ids = set()
    blocked_ids = set()
    distance = {}
    visited_refs = set()
    queue = [(root, None, 0) for root in roots]
    while queue:
        node_id, out_slot, dist = queue.pop(0)
        node_id = str(node_id)
        visit_key = (node_id, out_slot)
        if visit_key in visited_refs:
            continue
        visited_refs.add(visit_key)
        reachable.add(node_id)
        distance[node_id] = min(dist, distance.get(node_id, dist))
        st = state(node_id)
        if st == 'disabled':
            blocked_ids.add(node_id)
            continue
        refs = linked_refs(nodes[node_id])
        if st == 'bypass':
            bypass_ids.add(node_id)
            allowed = set(_bypass_passthrough_input_names(
                (nodes[node_id] or {}).get('class_type'), out_slot, ui_nodes.get(node_id), [name for _origin, _slot, name in refs]))
            refs = [ref for ref in refs if ref[2] in allowed]
        else:
            active_ids.add(node_id)
        for parent_id, parent_slot, _name in refs:
            queue.append((parent_id, parent_slot, dist + 1))

    sampler_ids = [node_id for node_id in active_ids
                   if (str(nodes[node_id].get('class_type', '')).startswith('KSampler') and nodes[node_id].get('class_type') != 'KSamplerSelect') or nodes[node_id].get('class_type') in ('SamplerCustomAdvanced', 'SamplerCustom')]
    if not sampler_ids:
        return None
    sampler_id = min(sampler_ids, key=lambda node_id: distance.get(node_id, 10**9))
    sampler = nodes[sampler_id]
    ks = sampler.get('inputs') or {}

    def src(inp):
        if isinstance(inp, list) and inp and str(inp[0]) in reachable:
            return str(inp[0]), nodes.get(str(inp[0]))
        return None, None

    def scalar(value):
        return not isinstance(value, (list, dict))

    def first_input(inputs, *names):
        for name in names:
            value = inputs.get(name)
            if value not in (None, ''):
                return value
        return None

    if sampler.get('class_type') in ('SamplerCustomAdvanced', 'SamplerCustom'):
        original_ks = ks
        guider = (src(ks.get('guider'))[1] or {}).get('inputs') or {}
        guider_type = (src(ks.get('guider'))[1] or {}).get('class_type')
        schedule_node = src(ks.get('sigmas'))[1] or {}
        schedule = schedule_node.get('inputs') or {}
        selector = (src(ks.get('sampler'))[1] or {}).get('inputs') or {}
        noise = (src(ks.get('noise'))[1] or {}).get('inputs') or {}
        ks = dict(ks)
        for key in ('model', 'positive', 'negative', 'cfg'):
            if key in guider:
                ks[key] = guider[key]
        if guider_type == 'BasicGuider':
            ks.update(positive=guider.get('conditioning'), negative=None, cfg=1)
        steps = schedule.get('steps', 0)
        if schedule_node.get('class_type') == 'ManualSigmas':
            values = [v.strip() for v in str(schedule.get('sigmas', '')).split(',') if v.strip()]
            steps = max(0, len(values) - 1)
        ks.update(steps=steps, seed=noise.get('noise_seed', original_ks.get('noise_seed')),
                  sampler_name=selector.get('sampler_name', ''),
                  scheduler=schedule.get('scheduler', schedule_node.get('class_type', '')))
        if 'denoise' in schedule:
            ks['denoise'] = schedule['denoise']

    def collect_conditioning_text(inp):
        seen, texts = set(), []
        def walk(ref):
            node_id, node = src(ref)
            if not node:
                return
            out_slot = ref[1] if isinstance(ref, list) and len(ref) > 1 else None
            seen_key = (node_id, out_slot)
            if seen_key in seen:
                return
            seen.add(seen_key)
            if state(node_id) == 'disabled':
                return
            typ = str(node.get('class_type', ''))
            inputs = node.get('inputs') or {}
            text = inputs.get('text')
            if typ == 'ConditioningZeroOut':
                return
            if typ == 'TextEncodeQwenImage21':
                text = inputs.get('negative_prompt' if out_slot == 1 else 'prompt', '')
                if isinstance(text, str) and text.strip():
                    texts.append(text)
                return
            if node_id in active_ids and 'CLIPTextEncode' in typ and isinstance(text, str) and text.strip():
                texts.append(text)
                return
            # Common conditioning nodes (ControlNet apply, hooks, etc.) expose positive/negative
            # as paired outputs. Follow only the branch that feeds the sampler so the opposite
            # prompt is not accidentally merged into this side.
            if out_slot in (0, 1) and 'positive' in inputs and 'negative' in inputs:
                branch = inputs.get('positive' if out_slot == 0 else 'negative')
                if isinstance(branch, list):
                    walk(branch)
                return
            for value in inputs.values():
                if isinstance(value, list) and value and str(value[0]) in reachable:
                    walk(value)
        walk(inp)
        out = []
        for text in texts:
            if text not in out:
                out.append(text)
        return '\n'.join(out)

    def latent_size(inp):
        seen = set()
        def walk(ref):
            node_id, node = src(ref)
            if not node or node_id in seen or state(node_id) == 'disabled':
                return (0, 0)
            seen.add(node_id)
            inputs = node.get('inputs') or {}
            try:
                w, h = int(inputs.get('width') or 0), int(inputs.get('height') or 0)
                if w > 0 and h > 0:
                    return (w, h)
            except (TypeError, ValueError):
                pass
            for key in ('samples', 'latent', 'latent_image', 'image', 'pixels'):
                value = inputs.get(key)
                if isinstance(value, list):
                    got = walk(value)
                    if got != (0, 0):
                        return got
            return (0, 0)
        return walk(inp)

    known_model_inputs = {
        'checkpoint': ('ckpt_name',),
        'diffusion': ('unet_name', 'diffusion_model', 'model_name'),
        'lora': ('lora_name',),
        'vae': ('vae_name',),
        'text encoder': ('clip_name', 'clip_name1', 'clip_name2', 'clip_name3', 'clip_name4', 'text_encoder_name'),
        'controlnet': ('control_net_name', 'controlnet_name'),
        'upscaler': ('model_name',),
        'clip vision': ('clip_name',),
        'style model': ('style_model_name',),
        'ip-adapter': ('ipadapter_file', 'ipadapter_name', 'model_name'),
        'gligen': ('gligen_name',),
    }

    def model_kind(typ):
        low = typ.lower()
        if 'checkpointloader' in low: return 'checkpoint'
        if 'loraloader' in low: return 'lora'
        if 'vaeloader' in low: return 'vae'
        if any(x in low for x in ('dualcliploader', 'triplecliploader', 'quadruplecliploader')) or low == 'cliploader': return 'text encoder'
        if 'controlnetloader' in low: return 'controlnet'
        if 'upscalemodelloader' in low: return 'upscaler'
        if 'clipvisionloader' in low: return 'clip vision'
        if 'stylemodelloader' in low: return 'style model'
        if 'ipadapter' in low and 'loader' in low: return 'ip-adapter'
        if 'gligenloader' in low: return 'gligen'
        if 'unetloader' in low or 'diffusionmodelload' in low: return 'diffusion'
        return ''

    models = []
    seen_models = set()
    for node_id in sorted(active_ids, key=lambda x: distance.get(x, 10**9), reverse=True):
        node = nodes[node_id]
        typ = str(node.get('class_type', ''))
        kind = model_kind(typ)
        if not kind:
            continue
        inputs = node.get('inputs') or {}
        for key in known_model_inputs.get(kind, ()):
            value = inputs.get(key)
            if not isinstance(value, str) or not value.strip():
                continue
            ident = (kind, value.strip(), node_id, key)
            if ident in seen_models:
                continue
            seen_models.add(ident)
            row = {'kind': kind, 'name': value.strip(), 'nodeType': typ, 'nodeId': node_id}
            if kind == 'lora':
                row['strengthModel'] = inputs.get('strength_model', 1)
                row['strengthClip'] = 0 if typ == 'LoraLoaderModelOnly' else inputs.get('strength_clip', inputs.get('strength_model', 1))
                row['modelOnly'] = typ == 'LoraLoaderModelOnly'
            models.append(row)

    checkpoint_rows = [m for m in models if m.get('kind') == 'checkpoint']
    ckpt = checkpoint_rows[-1]['name'] if checkpoint_rows else ''
    loras = [{'name': m.get('name', ''), 'model': m.get('strengthModel', 1), 'clip': m.get('strengthClip', m.get('strengthModel', 1)), 'modelOnly': m.get('modelOnly', False)}
             for m in models if m.get('kind') == 'lora']
    clip_rows = [m for m in models if m.get('kind') == 'text encoder']
    clip = ' + '.join(m['name'] for m in clip_rows)
    clip_type = ''
    for node_id in active_ids:
        node = nodes[node_id]
        typ = str(node.get('class_type', ''))
        if typ in ('CLIPLoader', 'DualCLIPLoader', 'TripleCLIPLoader', 'QuadrupleCLIPLoader'):
            clip_type = str((node.get('inputs') or {}).get('type', '') or clip_type)
            if clip_type:
                break
    vae_rows = [m for m in models if m.get('kind') == 'vae']
    vae = vae_rows[-1]['name'] if vae_rows else ''

    w, h = latent_size(ks.get('latent_image'))
    seed = first_input(ks, 'seed', 'noise_seed')
    result = {
        'ckpt': ckpt, 'clip': clip, 'clipType': clip_type, 'vae': vae, 'loras': loras, 'models': models,
        'pos': collect_conditioning_text(ks.get('positive')), 'neg': collect_conditioning_text(ks.get('negative')),
        'w': w, 'h': h,
        'steps': int(ks.get('steps') or 0), 'cfg': ks.get('cfg', 0),
        'sampler': str(first_input(ks, 'sampler_name', 'sampler') or ''),
        'scheduler': str(first_input(ks, 'scheduler') or ''), 'seed': seed,
    }
    if 'denoise' in ks:
        result['denoise'] = ks.get('denoise')
    negative_node = src(ks.get('negative'))[1] or {}
    if negative_node.get('class_type') == 'ConditioningZeroOut' or ks.get('negative') is None:
        result['negativeApplied'] = False
    for node_id in active_ids:
        node = nodes[node_id]
        meta = (node.get('_meta') or {}).get('dsh_model_config')
        if not isinstance(meta, dict) or node.get('class_type') not in ('UNETLoader', 'CheckpointLoaderSimple'):
            continue
        inputs = node.get('inputs') or {}
        config = {k: meta[k] for k in ('profile', 'clipSkip', 'identity', 'componentOrder', 'contentMode', 'embeddedClip', 'embeddedVae') if k in meta}
        config.update({'version': 1, 'mode': 'diffusion' if node.get('class_type') == 'UNETLoader' else 'checkpoint',
                       'main': inputs.get('unet_name', ''), 'dtype': inputs.get('weight_dtype', 'default')})
        for other_id in active_ids:
            other = nodes[other_id]; oi = other.get('inputs') or {}
            if other.get('class_type') in ('DualCLIPLoader', 'TripleCLIPLoader', 'QuadrupleCLIPLoader'):
                result['clip'] = oi.get('clip_name1', '')
                config['clip2'] = oi.get('clip_name2', '')
                if other.get('class_type') in ('TripleCLIPLoader', 'QuadrupleCLIPLoader'):
                    config['clip3'] = oi.get('clip_name3', '')
                if other.get('class_type') == 'QuadrupleCLIPLoader':
                    config['clip4'] = oi.get('clip_name4', '')
                if str(config.get('profile', '')).startswith(('sd3-', 'sd35-')):
                    config['encoderMode'] = 'triple' if other.get('class_type') == 'TripleCLIPLoader' else 'dual'
            if other.get('class_type') == 'CLIPLoader':
                result['clip'] = oi.get('clip_name', '')
                if str(config.get('profile', '')).startswith(('sd3-', 'sd35-')):
                    config['encoderMode'] = 't5'
            if other.get('class_type') in ('ModelSamplingSD3', 'ModelSamplingAuraFlow'):
                config['shift'] = oi.get('shift')
            if other.get('class_type') == 'SkipLayerGuidanceDiTSimple':
                config['slg'] = True
            if other.get('class_type') == 'FluxGuidance':
                config['guidance'] = oi.get('guidance')
            if other.get('class_type') == 'CLIPSetLastLayer':
                config['clipSkip'] = abs(int(oi.get('stop_at_clip_layer') or 0))
        if str(config.get('profile', '')).startswith(('sd3-', 'sd35-')):
            result['clipType'] = 'sd3'
            config.setdefault('encoderMode', 'embedded')
            config.setdefault('shift', None)
        requested_lora = meta.get('accelerationLora')
        acceleration_rows = [row for row in loras if row.get('name') == requested_lora]
        if (requested_lora and len(acceleration_rows) == 1 and acceleration_rows[0].get('modelOnly')
                and acceleration_rows[0].get('model') == 1):
            config['accelerationLora'] = requested_lora
            # The adapter recreates this dedicated node. Keeping it as a style LoRA would
            # double-apply it (or block generation) after applying the output parameters.
            result['loras'] = [row for row in loras if row is not acceleration_rows[0]]
        config.setdefault('slg', False)
        result['modelConfig'] = config
        break
    sampler_settings = {}
    for key, value in ks.items():
        if scalar(value):
            sampler_settings[str(key)] = value
    result['samplerSettings'] = sampler_settings
    result['_graphFilter'] = {
        'outputNodeIds': roots,
        'activeNodeCount': len(active_ids),
        'bypassedNodeCount': len(bypass_ids),
        'blockedNodeCount': len(blocked_ids),
        'totalNodeCount': len(nodes),
    }
    return result



def _params_from_ui_workflow(workflow, output_filename='', strict_output=False):
    """Best-effort fallback for PNGs that retain ComfyUI's UI workflow but not the API prompt graph.

    Only nodes on the selected output's upstream dependency path are considered. Mute/disabled nodes are
    blocked; bypass nodes are traversed but are not themselves reported as active model loaders.
    """
    if not isinstance(workflow, dict) or not isinstance(workflow.get('nodes'), list):
        return None
    nodes = {str(n.get('id')): n for n in workflow.get('nodes') if isinstance(n, dict) and n.get('id') is not None}
    if not nodes:
        return None
    links = {}
    downstream = {node_id: set() for node_id in nodes}
    for row in workflow.get('links') or []:
        if isinstance(row, list) and len(row) >= 5:
            link = {'origin': str(row[1]), 'origin_slot': row[2], 'target': str(row[3]), 'target_slot': row[4]}
            links[str(row[0])] = link
            if link['origin'] in nodes and link['target'] in nodes:
                downstream.setdefault(link['origin'], set()).add(link['target'])

    def state(node_id):
        return _node_execution_state(nodes.get(str(node_id)))

    def widgets(node):
        vals = node.get('widgets_values') or []
        return vals if isinstance(vals, list) else []

    def incoming_refs(node):
        out = []
        for inp in node.get('inputs') or []:
            if isinstance(inp, dict) and inp.get('link') is not None:
                link = links.get(str(inp.get('link')))
                if link and link['origin'] in nodes:
                    ref = (link['origin'], link.get('origin_slot'), str(inp.get('name') or ''))
                    if ref not in out:
                        out.append(ref)
        return out

    def incoming_ids(node):
        out = []
        for origin, _slot, _name in incoming_refs(node):
            if origin not in out:
                out.append(origin)
        return out

    def input_ref(node, name):
        for inp in node.get('inputs') or []:
            if isinstance(inp, dict) and inp.get('name') == name and inp.get('link') is not None:
                link = links.get(str(inp.get('link')))
                if link:
                    return link['origin'], nodes.get(link['origin']), link.get('origin_slot')
        return None, None, None

    def input_node(node, name):
        node_id, source, _slot = input_ref(node, name)
        return node_id, source

    def output_prefix(node):
        vals = widgets(node)
        if not vals:
            return ''
        typ = str(node.get('type', '')).lower()
        if 'save' in typ and 'image' in typ and isinstance(vals[0], str):
            return vals[0]
        return ''

    candidates = [node_id for node_id, node in nodes.items()
                  if _looks_like_output_node(node.get('type')) and state(node_id) == 'active']
    exact = [node_id for node_id in candidates if _filename_prefix_matches(output_prefix(nodes[node_id]), output_filename)]
    if strict_output and (not candidates or len(exact)>1 or len(candidates)>1 and not exact):
        return None
    if exact:
        roots = [exact[0]]
    elif len(candidates) == 1:
        roots = candidates
    elif candidates:
        sinks = [node_id for node_id in candidates if not downstream.get(node_id)]
        roots = [sinks[0] if sinks else candidates[0]]
    else:
        samplers = [node_id for node_id, node in nodes.items()
                    if (str(node.get('type', '')).startswith('KSampler') and node.get('type') != 'KSamplerSelect'
                        or node.get('type') in ('SamplerCustomAdvanced', 'SamplerCustom')) and state(node_id) == 'active']
        if not samplers:
            return None
        sink_samplers = [node_id for node_id in samplers if not downstream.get(node_id)]
        roots = [sink_samplers[0] if sink_samplers else samplers[0]]

    reachable = set()
    active_ids = set()
    bypass_ids = set()
    blocked_ids = set()
    distance = {}
    visited_refs = set()
    queue = [(root, None, 0) for root in roots]
    while queue:
        node_id, out_slot, dist = queue.pop(0)
        node_id = str(node_id)
        visit_key = (node_id, out_slot)
        if visit_key in visited_refs:
            continue
        visited_refs.add(visit_key)
        reachable.add(node_id)
        distance[node_id] = min(dist, distance.get(node_id, dist))
        st = state(node_id)
        if st == 'disabled':
            blocked_ids.add(node_id)
            continue
        refs = incoming_refs(nodes[node_id])
        if st == 'bypass':
            bypass_ids.add(node_id)
            allowed = set(_bypass_passthrough_input_names(
                (nodes[node_id] or {}).get('type'), out_slot, nodes.get(node_id), [name for _origin, _slot, name in refs]))
            refs = [ref for ref in refs if ref[2] in allowed]
        else:
            active_ids.add(node_id)
        for parent_id, parent_slot, _name in refs:
            queue.append((parent_id, parent_slot, dist + 1))

    sampler_ids = [node_id for node_id in active_ids
                   if str(nodes[node_id].get('type', '')).startswith('KSampler') and nodes[node_id].get('type') != 'KSamplerSelect'
                   or nodes[node_id].get('type') in ('SamplerCustomAdvanced', 'SamplerCustom')]
    if not sampler_ids:
        return None
    sampler_id = min(sampler_ids, key=lambda node_id: distance.get(node_id, 10**9))
    sampler = nodes[sampler_id]
    sw = widgets(sampler)
    advanced_ksampler = sampler.get('type') == 'KSamplerAdvanced'
    seed_index = 1 if advanced_ksampler else 0
    seed = sw[seed_index] if len(sw) > seed_index else None
    offset = seed_index + (2 if len(sw) > seed_index + 1 and isinstance(sw[seed_index + 1], str) else 1)
    steps = sw[offset] if len(sw) > offset else 0
    cfg = sw[offset + 1] if len(sw) > offset + 1 else 0
    sampler_name = sw[offset + 2] if len(sw) > offset + 2 else ''
    scheduler = sw[offset + 3] if len(sw) > offset + 3 else ''
    denoise = sw[offset + 4] if len(sw) > offset + 4 and not advanced_ksampler else None
    conditioning_source = sampler
    if sampler.get('type') in ('SamplerCustomAdvanced', 'SamplerCustom'):
        _, guider = input_node(sampler, 'guider')
        _, schedule = input_node(sampler, 'sigmas')
        _, selector = input_node(sampler, 'sampler')
        _, noise = input_node(sampler, 'noise')
        guider, schedule, selector, noise = guider or {}, schedule or {}, selector or {}, noise or {}
        conditioning_source = guider or sampler
        gv, sv, nv = widgets(guider), widgets(schedule), widgets(noise)
        custom_cfg_index = 3 if len(sw) > 2 and isinstance(sw[2], str) else 2
        cfg = 1 if guider.get('type') == 'BasicGuider' else (gv[0] if gv else (sw[custom_cfg_index] if len(sw) > custom_cfg_index else 0))
        seed = nv[0] if nv else (sw[1] if len(sw) > 1 else None)
        sampler_name = (widgets(selector) or [''])[0]
        scheduler = schedule.get('type', '')
        steps, denoise = 0, None
        if scheduler == 'ManualSigmas' and sv:
            steps = max(0, len([v for v in str(sv[0]).split(',') if v.strip()]) - 1)
        elif scheduler == 'BasicScheduler':
            scheduler = sv[0] if sv else ''
            steps = sv[1] if len(sv) > 1 else 0
            denoise = sv[2] if len(sv) > 2 else None
        elif scheduler in ('Flux2Scheduler', 'SDTurboScheduler'):
            steps = sv[0] if sv else 0
            if schedule.get('type') == 'SDTurboScheduler' and len(sv) > 1:
                denoise = sv[1]

    def collect_text(start_id, start_slot=None):
        if not start_id:
            return ''
        seen, texts = set(), []
        def walk(node_id, out_slot=None):
            node_id = str(node_id)
            seen_key = (node_id, out_slot)
            if seen_key in seen or node_id not in reachable or state(node_id) == 'disabled':
                return
            seen.add(seen_key)
            node = nodes[node_id]
            typ = str(node.get('type', ''))
            vals = widgets(node)
            if typ == 'ConditioningZeroOut':
                return
            if typ == 'TextEncodeQwenImage21':
                index = 1 if out_slot == 1 else 0
                text = vals[index] if len(vals) > index else ''
                if isinstance(text, str) and text.strip():
                    texts.append(text)
                return
            if node_id in active_ids and 'CLIPTextEncode' in typ and vals and isinstance(vals[0], str) and vals[0].strip():
                texts.append(vals[0])
                return
            named = []
            for inp in node.get('inputs') or []:
                if not isinstance(inp, dict) or inp.get('link') is None:
                    continue
                link = links.get(str(inp.get('link')))
                if link and link['origin'] in nodes:
                    named.append((str(inp.get('name') or ''), link['origin'], link.get('origin_slot')))
            names = {name for name, _origin, _slot in named}
            if out_slot in (0, 1) and 'positive' in names and 'negative' in names:
                wanted = 'positive' if out_slot == 0 else 'negative'
                for name, origin, origin_slot in named:
                    if name == wanted:
                        walk(origin, origin_slot)
                return
            for _name, origin, origin_slot in named:
                walk(origin, origin_slot)
        walk(start_id, start_slot)
        out = []
        for text in texts:
            if text not in out:
                out.append(text)
        return '\n'.join(out)

    def latent_size(start_id):
        seen = set()
        def walk(node_id):
            node_id = str(node_id)
            if node_id in seen or node_id not in reachable or state(node_id) == 'disabled':
                return (0, 0)
            seen.add(node_id)
            node = nodes[node_id]
            vals = widgets(node)
            typ = str(node.get('type', ''))
            if ('Latent' in typ or 'Image' in typ) and len(vals) >= 2 and isinstance(vals[0], (int, float)) and isinstance(vals[1], (int, float)):
                w, h = int(vals[0]), int(vals[1])
                if w > 0 and h > 0:
                    return (w, h)
            for parent_id in incoming_ids(node):
                got = walk(parent_id)
                if got != (0, 0):
                    return got
            return (0, 0)
        return walk(start_id)

    positive_id, _, positive_slot = input_ref(conditioning_source, 'conditioning' if conditioning_source.get('type') == 'BasicGuider' else 'positive')
    negative_id, _, negative_slot = input_ref(conditioning_source, 'negative')
    latent_id, _ = input_node(sampler, 'latent_image')
    w, h = latent_size(latent_id) if latent_id else (0, 0)

    models = []
    for node_id in sorted(active_ids, key=lambda x: distance.get(x, 10**9), reverse=True):
        node = nodes[node_id]
        typ = str(node.get('type', ''))
        vals = widgets(node)
        row = None
        if typ.startswith('CheckpointLoader') and vals:
            row = {'kind':'checkpoint','name':str(vals[0])}
        elif typ.startswith('LoraLoader') and vals:
            name = str(vals[0]); sm = vals[1] if len(vals)>1 else 1; sc = 0 if typ == 'LoraLoaderModelOnly' else (vals[2] if len(vals)>2 else sm)
            row = {'kind':'lora','name':name,'strengthModel':sm,'strengthClip':sc,'modelOnly':typ == 'LoraLoaderModelOnly'}
        elif typ == 'VAELoader' and vals:
            row = {'kind':'vae','name':str(vals[0])}
        elif typ == 'CLIPLoader' and vals:
            row = {'kind':'text encoder','name':str(vals[0])}
        elif typ in ('DualCLIPLoader','TripleCLIPLoader','QuadrupleCLIPLoader') and vals:
            count = 4 if typ.startswith('Quadruple') else 3 if typ.startswith('Triple') else 2
            for value in vals[:count]:
                if isinstance(value, str) and value:
                    models.append({'kind':'text encoder','name':value,'nodeType':typ,'nodeId':node_id})
        elif 'ControlNetLoader' in typ and vals:
            row = {'kind':'controlnet','name':str(vals[0])}
        elif 'UpscaleModelLoader' in typ and vals:
            row = {'kind':'upscaler','name':str(vals[0])}
        elif ('UNETLoader' in typ or 'DiffusionModelLoader' in typ) and vals:
            row = {'kind':'diffusion','name':str(vals[0])}
        elif 'CLIPVisionLoader' in typ and vals:
            row = {'kind':'clip vision','name':str(vals[0])}
        elif 'StyleModelLoader' in typ and vals:
            row = {'kind':'style model','name':str(vals[0])}
        elif 'IPAdapter' in typ and 'Loader' in typ and vals:
            row = {'kind':'ip-adapter','name':str(vals[0])}
        elif 'GLIGENLoader' in typ and vals:
            row = {'kind':'gligen','name':str(vals[0])}
        if row and row.get('name'):
            row.update({'nodeType':typ,'nodeId':node_id}); models.append(row)

    checkpoint_rows = [m for m in models if m.get('kind') == 'checkpoint']
    ckpt = checkpoint_rows[-1]['name'] if checkpoint_rows else ''
    loras = [{'name':m.get('name',''),'model':m.get('strengthModel',1),'clip':m.get('strengthClip',m.get('strengthModel',1)),'modelOnly':m.get('modelOnly',False)}
             for m in models if m.get('kind') == 'lora']
    clip_rows = [m for m in models if m.get('kind') == 'text encoder']
    clip = ' + '.join(m['name'] for m in clip_rows)
    clip_type = ''
    for node_id in active_ids:
        node = nodes[node_id]
        typ = str(node.get('type', ''))
        vals = widgets(node)
        if typ == 'CLIPLoader' and len(vals) > 1:
            clip_type = str(vals[1]); break
        if typ in ('DualCLIPLoader','TripleCLIPLoader'):
            count = 3 if typ.startswith('Triple') else 2
            if len(vals) > count:
                clip_type = str(vals[count]); break
    vae_rows = [m for m in models if m.get('kind') == 'vae']
    vae = vae_rows[-1]['name'] if vae_rows else ''

    result = {'ckpt':ckpt,'clip':clip,'clipType':clip_type,'vae':vae,'loras':loras,'models':models,
              'pos':collect_text(positive_id, positive_slot),'neg':collect_text(negative_id, negative_slot),'w':w,'h':h,
              'steps':steps,'cfg':cfg,'sampler':str(sampler_name or ''),'scheduler':str(scheduler or ''),'seed':seed,
              'samplerSettings':{'seed':seed,'steps':steps,'cfg':cfg,'sampler_name':sampler_name,'scheduler':scheduler},
              '_graphFilter':{'outputNodeIds':roots,'activeNodeCount':len(active_ids),'bypassedNodeCount':len(bypass_ids),
                              'blockedNodeCount':len(blocked_ids),'totalNodeCount':len(nodes)}}
    if denoise is not None:
        result['denoise'] = denoise; result['samplerSettings']['denoise'] = denoise
    if conditioning_source.get('type') == 'BasicGuider' or nodes.get(negative_id, {}).get('type') == 'ConditioningZeroOut':
        result['negativeApplied'] = False
    return result



def _output_record(path, root=None, source='output', include_params=False):
    path=os.path.normpath(path); st=os.stat(path); w,h=_image_dimensions(path)
    rel=os.path.relpath(path, root).replace('\\','/') if root and _path_inside(root,path) else os.path.basename(path)
    rec={'id':hashlib.sha1((source+'|'+os.path.realpath(path)).encode('utf-8','replace')).hexdigest(),
         'source':source,'filename':os.path.basename(path),'relative_path':rel,'path':path,
         'folder':os.path.dirname(rel).replace('\\','/') if '/' in rel else '',
         'size':st.st_size,'mtime':st.st_mtime,'width':w,'height':h}
    if include_params:
        meta=_png_text(path); prompt=meta.get('prompt'); workflow=meta.get('workflow')
        workflow_obj=None
        if workflow:
            try: workflow_obj=json.loads(workflow)
            except (ValueError, TypeError): workflow_obj=None
        if prompt:
            try:
                params=_params_from_api_prompt(json.loads(prompt), workflow_obj, os.path.basename(path))
                if params: params['_metadataSource']='prompt'; rec['params']=params
            except (ValueError, TypeError): pass
        if 'params' not in rec and workflow_obj:
            try:
                params=_params_from_ui_workflow(workflow_obj, os.path.basename(path))
                if params: params['_metadataSource']='workflow'; rec['params']=params
            except (ValueError, TypeError): pass
    if include_params:
        group=_post_services()[0].lookup(path)
        if group:
            rec.update(stages=group['stages'],groupId=group['id'],promptId=group.get('promptId'))
            stage=_post_services()[0].verified_stage(path)
            if stage:
                rec['imageInfo']=stage.get('imageInfo')
                if stage.get('note'):rec['note']=stage['note']
                if stage.get('params'):rec['params']=stage['params']
    return rec



def _scan_outputs(limit=1000, offset=0, cancel_event=None):
    _check_model_task(cancel_event)
    root=_default_output_root(); rows=[]
    if os.path.isdir(root):
        for base, dirs, files in os.walk(root):
            _check_model_task(cancel_event)
            dirs[:] = [d for d in dirs if not os.path.islink(os.path.join(base,d))]
            for name in files:
                _check_model_task(cancel_event)
                if os.path.splitext(name)[1].lower() not in _OUTPUT_EXTENSIONS: continue
                path=os.path.join(base,name)
                if os.path.islink(path) or not _path_inside(root, path):
                    continue
                try: rows.append(_output_record(path,root,'output'))
                except OSError: pass
    _check_model_task(cancel_event)
    groups=_post_services()[0].groups()
    hidden=set();extra=[]
    known={os.path.normcase(os.path.realpath(row['path'])) for row in rows}
    for group in groups:
        stages=[stage for stage in group.get('stages',[]) if stage.get('path') and os.path.isfile(stage['path'])]
        if not stages:continue
        final=stages[-1]
        hidden.update(os.path.normcase(os.path.realpath(stage['path'])) for stage in stages[:-1])
        key=os.path.normcase(os.path.realpath(final['path']))
        if key not in known:
            try:extra.append(_output_record(final['path'],None,'custom'))
            except OSError:pass
    rows=[row for row in rows if os.path.normcase(os.path.realpath(row['path'])) not in hidden]+extra
    rows.sort(key=lambda x:x['mtime'], reverse=True)
    start=max(0,min(int(offset or 0),1000000))
    size=max(1,min(int(limit or 1000),5000))
    return {'root':root,'items':rows[start:start+size],'total':len(rows),'offset':start,'hasMore':start+size<len(rows)}



def _authorized_output_path(raw):
    """Only default output or custom files explicitly saved in this process."""
    path = _normal_path(raw)
    if not path or not os.path.isfile(path) or os.path.splitext(path)[1].lower() not in _OUTPUT_EXTENSIONS:
        raise ValueError('找不到可访问的输出图片')
    real = os.path.normcase(os.path.realpath(path))
    if not _path_inside(_default_output_root(), path) and real not in _SESSION_CUSTOM_OUTPUTS and real not in _post_services()[0].saved_paths():
        raise ValueError('不允许访问未登记的外部图片')
    return path



def _output_detail(path):
    path = _authorized_output_path(path)
    root = _default_output_root()
    return _output_record(path, root if _path_inside(root, path) else None,
                          'output' if _path_inside(root, path) else 'custom', include_params=True)



def _resolve_comfy_image(info):
    if not isinstance(info, dict): raise ValueError('图片信息无效')
    typ=str(info.get('type') or 'temp')
    root=_default_output_root() if typ=='output' else _comfy_temp_root()
    sub=_safe_output_rel(info.get('subfolder',''), allow_empty=True)
    name=os.path.basename(str(info.get('filename') or ''))
    if not name: raise ValueError('图片文件名为空')
    path=os.path.join(root,sub,name) if sub else os.path.join(root,name)
    if not _path_inside(root,path) or not os.path.isfile(path): raise ValueError('找不到 ComfyUI 图片文件')
    return path




def _next_prefixed_path(folder, prefix, ext='.png'):
    prefix=re.sub(r'[<>:"/\\|?*\x00-\x1f]+','_',str(prefix or 'dsh_comfy').strip()).strip(' .') or 'dsh_comfy'
    ext=(str(ext or '.png').lower() if str(ext or '.png').startswith('.') else '.'+str(ext).lower())
    os.makedirs(folder,exist_ok=True)
    # Match Comfy-style numeric suffixes without accidentally consuming the file extension.
    # Examples counted for prefix "portrait": portrait_001.png, portrait_00005_.png.
    pat=re.compile(r'^'+re.escape(prefix)+r'_(\d+)(?:_|(?=\.))',re.I)
    nums=[]
    for n in os.listdir(folder):
        if os.path.splitext(n)[1].lower()!=ext:
            continue
        m=pat.match(n)
        if m: nums.append(int(m.group(1)))
    return os.path.join(folder, '%s_%03d%s' % (prefix,(max(nums)+1 if nums else 1),ext))



def _save_temp_to_custom(payload):
    source=_resolve_comfy_image(payload.get('image') or {})
    folder=_normal_path(payload.get('folder',''))
    if not folder or not os.path.isabs(folder): raise ValueError('自定义保存路径必须是本机绝对路径')
    os.makedirs(folder,exist_ok=True)
    # Reserve names atomically across concurrent queue completions. Never overwrite an existing image.
    with _OUTPUT_SAVE_LOCK:
        while True:
            target=_next_prefixed_path(folder,payload.get('prefix') or 'dsh_comfy',os.path.splitext(source)[1].lower() or '.png')
            try:
                with open(target, 'xb') as dest, open(source, 'rb') as inp:
                    shutil.copyfileobj(inp, dest, 1024 * 1024)
                break
            except FileExistsError:
                continue
            except BaseException:
                try: os.remove(target)
                except OSError: pass
                raise
        _SESSION_CUSTOM_OUTPUTS.add(os.path.normcase(os.path.realpath(target)))
    default_root=_default_output_root()
    if _path_inside(default_root,target):
        return {'ok':True,'item':_output_record(target,default_root,'output')}
    return {'ok':True,'item':_output_record(target,None,'custom')}



def _manage_output(payload):
    action=str(payload.get('action') or '')
    path=_authorized_output_path(payload.get('path') or '')
    real=os.path.normcase(os.path.realpath(path))
    if action=='open':
        if os.name=='nt': subprocess.Popen(['explorer.exe','/select,'+os.path.normpath(path)],close_fds=True)
        else:
            opener=shutil.which('xdg-open')
            if not opener: raise ValueError('没有可用的文件管理器')
            subprocess.Popen([opener,os.path.dirname(path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        return {'ok':True}
    if action=='delete':
        os.remove(path); _SESSION_CUSTOM_OUTPUTS.discard(real); return {'ok':True}
    raise ValueError('未知输出管理操作')



def _pick_folder(initial=''):
    initial=_normal_path(initial or '')
    if os.name=='nt':
        ps=shutil.which('powershell.exe') or shutil.which('powershell')
        if not ps: raise ValueError('找不到 PowerShell，无法打开文件夹选择器')
        init=initial.replace("'","''") if initial else ''
        script=("Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; "
                + ("$d.SelectedPath='%s'; " % init if init else '')
                + "if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::OutputEncoding=[Text.Encoding]::UTF8; Write-Output $d.SelectedPath}")
        r=subprocess.run([ps,'-NoProfile','-STA','-Command',script],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=300)
        return {'path':r.stdout.strip()}
    return {'path':initial}


def _post_services():
    global _POST_SERVICE, _POST_DEPENDENCIES
    with _POST_LOCK:
        if _POST_SERVICE is None:
            import importlib.util
            spec=importlib.util.spec_from_file_location('dsh_post_processing',os.path.join(HERE, 'aline_mods', 'post_processing.py'))
            m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
            class API:
                def __getattr__(self,key):return globals()[key]
            api=API();_POST_SERVICE=m.PostProcessing(api);_POST_DEPENDENCIES=m.Dependencies(api)
    return _POST_SERVICE,_POST_DEPENDENCIES



def _open_default_browser(url):
    """在 sidecar 所在系统打开默认浏览器。

    WSL DSH + Windows Python sidecar 时，这里就是 Windows 的默认浏览器，
    比 DSH 页面的 window.open 更可靠（不受弹窗拦截影响）。
    """
    try:
        if os.name == 'nt':
            os.startfile(url)
        else:
            import webbrowser
            webbrowser.open(url, new=2)
        print('[browser] opened', url, flush=True)
        return True
    except Exception as ex:
        print('[browser] open failed:', ex, flush=True)
        return False



def _comfy_browser_url():
    return 'http://127.0.0.1:%d/' % COMFY_PORT



# ==================== 第三批：输出预览图管理 ====================
def _preview_image_context(payload, include_bytes=False):
    """Resolve an authorised image and its actual branch, never browser-supplied models."""
    raw=payload.get('path')
    image=payload.get('image')
    params=None;data=None
    if raw:
        path=_authorized_output_path(raw)
        before=os.stat(path)
        meta=_png_text(path)
        trusted_stage=_post_services()[0].verified_stage(path)
        output_node=trusted_stage.get('node') if trusted_stage else None
        # Some older/custom output nodes write an incomplete workflow or a text
        # field that is not valid JSON. These files should fall back to the exact
        # image+history verification below instead of causing a server error.
        try:
            workflow=json.loads(meta['workflow']) if meta.get('workflow') else None
        except (TypeError,ValueError):
            workflow=None
        try:
            if meta.get('prompt'):
                params=_params_from_api_prompt(json.loads(meta['prompt']),workflow,os.path.basename(path),strict_output=True,output_node_id=output_node)
            elif workflow:
                params=_params_from_ui_workflow(workflow,os.path.basename(path),strict_output=True)
        except (TypeError,ValueError):
            params=None
        if include_bytes:
            with open(path,'rb') as stream:data=stream.read(_model_assets().MAX_PREVIEW+1)
        after=os.stat(path)
        if (before.st_mtime_ns,before.st_size)!=(after.st_mtime_ns,after.st_size):
            raise ValueError('图片正在变化，请稍后重试')
        if not params and isinstance(image,dict) and payload.get('prompt_id'):
            # Metadata-disabled PNG/JPEG or a renamed custom save: history must
            # identify the output, and its actual bytes must equal this local file.
            verified,original=_preview_image_context({'image':image,'prompt_id':payload['prompt_id']},True)
            if data is None:
                with open(path,'rb') as stream:data=stream.read(_model_assets().MAX_PREVIEW+1)
            if data!=original: raise ValueError('任务图片与本地文件不一致，无法确认模型归属')
            return verified,data if include_bytes else None
    elif isinstance(image,dict) and payload.get('prompt_id'):
        pid=str(payload['prompt_id'])
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',pid): raise ValueError('任务编号无效')
        history=_http_json('http://127.0.0.1:%d/history/%s'%(COMFY_PORT,pid),'',timeout=20)
        entry=history.get(pid) or {}; matches=[]
        for node_id,out in (entry.get('outputs') or {}).items():
            for candidate in out.get('images',[]) if isinstance(out,dict) else []:
                if all(str(candidate.get(k) or ('temp' if k=='type' else ''))==str(image.get(k) or ('temp' if k=='type' else '')) for k in ('filename','subfolder','type')):
                    matches.append((node_id,candidate))
        if len(matches)!=1: raise ValueError('该图片未在任务输出中找到，或无法确定输出链路')
        prompt=entry.get('prompt') or []
        graph=prompt[2] if isinstance(prompt,list) and len(prompt)>2 else None
        node_id,verified=matches[0]
        extra=entry.get('extra_data') or (prompt[3] if len(prompt)>3 and isinstance(prompt[3],dict) else {})
        workflow=extra.get('extra_pnginfo',{}).get('workflow')
        params=_params_from_api_prompt(graph,workflow,verified.get('filename',''),strict_output=True,output_node_id=node_id)
        if include_bytes:
            from urllib.parse import urlencode
            url='http://127.0.0.1:%d/view?'%COMFY_PORT+urlencode({k:verified.get(k,'') for k in ('filename','subfolder','type')})
            with urllib.request.urlopen(url,timeout=25) as response:data=response.read(_model_assets().MAX_PREVIEW+1)
    else:
        raise ValueError('该图片缺少可核验的文件位置或任务记录')
    if not params or not params.get('models'): raise ValueError('图片缺少可确认的模型信息，不能加入模型预览图')
    if include_bytes:
        if not data or len(data)>_model_assets().MAX_PREVIEW: raise ValueError('图片为空或超过预览图上限 8 MiB')
        _model_assets().raster_type(data)
    return params,data



def _output_preview_targets(payload, params=None):
    if params is None: params,_=_preview_image_context(payload)
    aliases={'text encoder':'clip','upscaler':'upscale','clip vision':'folder:clip_vision','style model':'folder:style_models','ip-adapter':'folder:ipadapter','gligen':'folder:gligen'}
    items=[];seen=set();warnings=[]
    for row in params.get('models',[]):
        kind=aliases.get(row.get('kind'),row.get('kind'));name=row.get('name')
        # A zero-weight LoRA is loaded but has no influence on this output.
        if kind=='lora' and row.get('strengthModel',1)==0 and row.get('strengthClip',1)==0: continue
        if not name: continue
        try:
            roots=_model_roots(kind,include_missing_default=False)
            found=[]
            for idx,root in enumerate(roots):
                try:
                    _r,file=_resolve_model_file(kind,name,idx)
                    found.append((idx,root,file))
                except ValueError: continue
            if len(found)!=1:
                warnings.append(str(name)+('：同名文件位于多个模型目录，无法确认具体文件' if found else '：本地未找到模型文件'));continue
            idx,root,file=found[0];key=os.path.normcase(os.path.realpath(file))
            if key in seen:continue
            seen.add(key);items.append({'kind':kind,'name':_model_public_name(root,file).replace('\\','/'),'root_id':idx,'label':row.get('kind'),'path':file})
        except (ValueError,OSError) as ex:warnings.append(str(name)+'：'+str(ex))
    return {'items':items,'warnings':warnings}



def _add_output_preview(payload):
    # Validate again on commit; a browser cannot supply another model or stale list.
    params,data=_preview_image_context(payload,include_bytes=True)
    targets=_output_preview_targets(payload,params)['items']
    target=payload.get('target') or {}
    selected=next((r for r in targets if all(str(r[k])==str(target.get(k)) for k in ('kind','name','root_id'))),None)
    if not selected: raise ValueError('只能保存为这张图片实际使用且可确认的模型的预览图')
    root,model=_resolve_model_file(selected['kind'],selected['name'],selected['root_id'])
    _model_assets().append_preview(root,model,_model_assets_base(),data)
    return {'ok':True,'previews':_model_previews_info(selected['kind'],selected['name'],selected['root_id'])}




# ==================== 第四批：ComfyUI 更新 / 提示词精修 ====================
def _apply_comfy_update():
    with _COMFY_UPDATE_LOCK:
        info = _comfy_update_info(force=True)
        if info.get('error'):
            raise ValueError('检查最新版本失败：' + info['error'])
        if not info.get('available'):
            raise ValueError('当前已是最新版本')
        if info.get('busy'):
            raise ValueError('还有任务在队列中，请等待生成完成后再更新')
        latest = info['latest']
        was_running = bool(info.get('running'))
        if was_running:
            ok, message = COMFY.stop()
            if not ok:
                raise ValueError('无法停止 ComfyUI：' + str(message))
        try:
            _comfy_git(['fetch', '--tags', '--force', 'origin'], timeout=180)
            _comfy_git(['checkout', '-f', 'v' + latest], timeout=120)
            python = os.path.join(COMFY_ROOT, 'python_standalone', 'python.exe')
            if not os.path.isfile(python):
                python = sys.executable
            repo = _comfy_repo_root()
            result = subprocess.run([python, '-m', 'pip', 'install', '-r', os.path.join(repo, 'requirements.txt')],
                                    cwd=repo, capture_output=True, text=True, timeout=900,
                                    encoding='utf-8', errors='replace')
            if result.returncode:
                raise ValueError((result.stdout or '')[-800:] + (result.stderr or '')[-800:])
            if was_running:
                ok, message = COMFY.start('background')
                if not ok:
                    raise ValueError('更新完成，但重启 ComfyUI 失败：' + str(message))
            _COMFY_UPDATE_CACHE['time'] = 0
            _COMFY_UPDATE_CACHE['data'] = None
            return {'ok': True, 'current': latest, 'latest': latest,
                    'message': '已更新到 v' + latest + ('，ComfyUI 已重新启动' if was_running else '')}
        except Exception:
            if was_running and not COMFY.running():
                try:
                    COMFY.start('background')
                except Exception:
                    pass
            raise



def pick_model(rt):
    if rt['model']:
        return rt['model']
    d = _http_json(rt['base'] + '/models', rt['key'], timeout=10)
    return (d.get('data') or [{}])[0].get('id', '')



def _chat_tags(messages, routes, require_reply=False):
    last = None
    for rt in routes:
        try:
            model = pick_model(rt)
            if not model:
                continue
            d = _http_json(rt['base'] + '/chat/completions', rt['key'], {
                'model': model, 'messages': messages,
                'temperature': 0.3, 'max_tokens': 1600,
            }, timeout=180)
            raw = d['choices'][0]['message']['content']
            # 兼容部分模型输出 ```json fenced block。
            m = re.search(r'\{.*\}', raw, re.S)
            result = json.loads(m.group(0) if m else raw)
            if not isinstance(result, dict) or not isinstance(result.get('positive'), str):
                raise ValueError('LLM 没有返回合法的 positive 字段')
            out = {'positive': result['positive'],
                   'negative': result.get('negative', '') if isinstance(result.get('negative', ''), str) else '',
                   'model': '%s / %s' % (rt['name'], model)}
            if require_reply:
                out['reply'] = str(result.get('reply') or '已更新标签')
            return out
        except Exception as e:
            last = '%s: %s' % (rt['name'], e)
    raise RuntimeError('所有 LLM 路线都不通（最后错误 %s）' % last)



def model_prompt_system(model_profile=None):
    """Use an adapter ID, never client-supplied system text."""
    if model_profile in (None, '', 'legacy'):
        return SYSTEM
    natural = model_profile in ('flux-dev', 'flux-schnell', 'flux-krea', 'qwen-image', 'qwen-lightning8', 'qwen-distill', 'qwen-2512', 'qwen-2512-lightning4', 'qwen21', 'qwen21-turbo', 'z-image', 'z-image-turbo', 'flux2-dev', 'flux2-turbo', 'flux2-klein4-base', 'flux2-klein4-distilled', 'flux2-klein9-base', 'flux2-klein9-distilled', 'hidream-full', 'hidream-dev', 'hidream-fast', 'moss-sft', 'moss-base', 'krea2-turbo', 'krea2-raw', 'chroma', 'lumina2', 'hunyuan21')
    unused_negative = model_profile in ('flux-dev', 'flux-schnell', 'flux-krea', 'anima-turbo', 'anima-turbo-lora', 'sdxl-turbo', 'sdxl-lightning-1', 'sdxl-lightning-2', 'sdxl-lightning-4', 'sdxl-lightning-8', 'qwen-lightning8', 'qwen-distill', 'qwen-2512-lightning4', 'z-image-turbo', 'flux2-dev', 'flux2-turbo', 'flux2-klein4-distilled', 'flux2-klein9-distilled', 'hidream-dev', 'hidream-fast', 'krea2-turbo')
    rules = ('You edit image-generation prompts. Return ONLY JSON with string fields positive and negative. '
             'Preserve subjects, relationships, composition, artist names and literal text to render. '
             'Do not insert generic quality words, rating/score tags, embeddings, LoRA directives or control syntax unless requested. '
             'Preserve structured JSON layout keys, coordinates, literal lettering and syntax unless the user explicitly requests edits. '
             'Translate descriptive Chinese into clear English, but preserve quoted text intended to appear in the image. ')
    rules += ('Use coherent natural-language descriptions for the selected image architecture. Avoid numeric parentheses weights and Danbooru-only shorthand. ' if natural else
              'Preserve tags, natural language or a mixture; do not force everything into comma-separated tags. ')
    if model_profile in ('sd3-medium', 'sd35-large', 'sd35-medium', 'sd35-turbo'):
        rules += 'Use clear natural-language descriptions for SD3/SD3.5; keep negative instructions separate, including Large Turbo. Preserve literal lettering. Do not add FLUX guidance directives. '
    if model_profile in ('anima-base', 'anima-aesthetic', 'anima-turbo', 'anima-turbo-lora'):
        rules += 'Anima can interpret weighted parentheses; do not remove or invent weights unless requested. '
    if model_profile == 'anima-aesthetic':
        rules += 'Do not add score_* tags. '
    rules += ('The selected workflow does not use negative conditioning: return negative as an empty string. Describe desired results affirmatively. ' if unused_negative else
              'Keep positive and negative instructions separate, preserving unchanged details. ')
    return rules



def refine(positive, negative, instruction, history, routes, model_profile=None):
    """按指令局部修改已有标签；对话历史最多携带最近 10 轮。"""
    instruction = str(instruction or '').strip()
    if not instruction:
        raise ValueError('instruction 不能为空')
    context = []
    for item in (history if isinstance(history, list) else [])[-20:]:
        if isinstance(item, dict) and item.get('role') in ('user', 'assistant'):
            context.append({'role': item['role'], 'content': str(item.get('text') or '')[:2000]})
    system = model_prompt_system(model_profile) + ('\nRefinement: keep existing positive/negative prompts unless the latest user '
                       'instruction changes them. Reply with JSON including positive, negative, '
                       'and a short Chinese reply describing exactly what changed. '
                       'Do not discard unchanged character details.')
    user = ('CURRENT POSITIVE:\n%s\nCURRENT NEGATIVE:\n%s\nCHANGE REQUEST:\n%s' % (
        str(positive)[:16000], str(negative)[:8000], instruction[:4000]))
    return _chat_tags([{'role': 'system', 'content': system}] + context +
                      [{'role': 'user', 'content': user}], routes, require_reply=True)


