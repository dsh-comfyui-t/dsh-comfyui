"""Read-only checks for the local Electron editors. Never import a GUI backend."""
import importlib.util
import json
import os
from pathlib import Path
import re

FILES = {
    'reference': ('reference_images.py', 'lib/reference_image.js', 'lib/inpaint.js'),
    'scene3d': ('electron_runtime.py', 'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/policy.cjs', 'desktop/runtime.json', 'scene3d_window.py', 'scene3d_windows.py', 'scene3d_drafts.py', 'scene3d_store.py', 'scene3d_captures.py', 'scene3d_studio_schema.py', 'scene3d_body_schema.py', 'scene3d_joint_review.py', 'scene3d/editor.html',
                'scene3d_ai_pose.py', 'scene3d_control.py', 'scene3d_modules.py', 'scene3d/render_fallback.js', 'scene3d/control_bridge.js', 'scene3d/capture_size.js', 'scene3d/lighting.js', 'scene3d/modules.js', 'scene3d/tiles.js', 'scene3d/pose_chat.js', 'scene3d/pose_control.js', 'scene3d/number_input.js', 'scene3d/ground_grid.js', 'scene3d/ground_effects.js', 'scene3d/ground_ripples.js', 'scene3d/ripple_editing.js', 'scene3d_assets.py', 'scene3d/editor.js', 'scene3d/editor.css', 'scene3d/studio.css', 'scene3d/camera_studio.js', 'scene3d/object_ui.js', 'scene3d/text.js', 'scene3d/size_presets.json', 'scene3d/fonts/sans.typeface.json', 'scene3d/fonts/serif.typeface.json', 'scene3d/fonts/sans.ttf', 'scene3d/fonts/serif.ttf', 'scene3d/vendor/addons/loaders/FontLoader.js', 'scene3d/vendor/addons/geometries/TextGeometry.js', 'scene3d/viewport.js', 'scene3d/camera_modes.js', 'scene3d/frame_resize.js', 'scene3d/interface.js', 'scene3d/developer.js', 'scene3d/appearance.js', 'scene3d/body.js', 'scene3d/body_ui.js', 'scene3d/garment.js', 'scene3d/skirt.js', 'scene3d/hair.js', 'scene3d/catalog.json',
                'scene3d/vendor/three.module.js', 'scene3d/vendor/three.core.js',
                'scene3d/vendor/addons/controls/OrbitControls.js',
                'scene3d/vendor/addons/controls/TransformControls.js',
                'scene3d/vendor/addons/loaders/GLTFLoader.js',
                'scene3d/vendor/addons/utils/SkeletonUtils.js', 'lib/scene3d.js'),
    'workflow': ('electron_runtime.py', 'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/policy.cjs', 'desktop/runtime.json', 'workflow_window.py', 'workflow_windows.py', 'post_processing.py',
                 'workflow/editor.html', 'workflow/react.js', 'workflow/react-dom.js',
                 'lib/workflow_window.js', 'lib/workflow_canvas.js', 'lib/workflow_litegraph_vendor.js', 'lib/workflow_native.js', 'lib/workflow_browser.js', 'lib/client.js'),
}


def resources(here=None, features=None):
    root = Path(here or Path(__file__).parent)
    resolved_root = root.resolve()
    active = set(features or FILES)
    result = {kind: [name for name in files if not (root / name).is_file() or (root / name).stat().st_size == 0] if kind in active else []
              for kind, files in FILES.items()}
    if 'scene3d' in active:
        for family in ('sans','serif'):
            manifest=root/('scene3d/fonts/'+family+'.typeface.json')
            if manifest.is_file():
                try:
                    for page in json.loads(manifest.read_text(encoding='utf8')).get('pages',[]):
                        name='scene3d/fonts/'+family+'-pages/'+page+'.json'
                        if not re.fullmatch(r'[0-9a-f]{1,4}',page) or not (root/name).is_file():result['scene3d'].append(name)
                except (ValueError,TypeError):result['scene3d'].append('scene3d/fonts/'+family+'（字体清单无效）')
    # Detect a partial update where the new HTML loads an older generated bundle.
    client = root / 'lib/client.js'
    if client.is_file():
        try:
            bundled = client.read_text(encoding='utf8')
            for kind, markers in {
                'reference': ('function ReferenceImageControl(', 'function InpaintMaskEditor('),
                'scene3d': ('function useScene3DWindow(',),
                'workflow': ('exports.mountWorkflowEditor = mountWorkflowEditor;',)
            }.items():
                if kind in active and any(marker not in bundled for marker in markers):
                    result[kind].append('lib/client.js（未包含当前扩展，请重新构建完整客户端）')
        except (OSError, UnicodeError):
            for kind in active: result[kind].append('lib/client.js（无法读取）')
    else:
        for kind in active.intersection(('reference', 'scene3d')): result[kind].append('lib/client.js')
    # Three.js addon files have relative dependencies of their own.
    base = (root / 'scene3d').resolve()
    pending = [root / name for name in FILES['scene3d'] if name.endswith('.js')] if 'scene3d' in active else []
    seen = set()
    while pending:
        file = pending.pop().resolve()
        if file in seen or not file.is_file(): continue
        seen.add(file)
        try: text = file.read_text(encoding='utf8')
        except (OSError, UnicodeError):
            result['scene3d'].append(str(file.relative_to(resolved_root))); continue
        for name in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]", text):
            if name == 'three': target = base / 'vendor/three.module.js'
            elif name.startswith('three/addons/'): target = base / 'vendor/addons' / name[len('three/addons/'):]
            elif name.startswith('.'): target = file.parent / name.split('?',1)[0].split('#',1)[0]
            else: continue
            target = target.resolve()
            if not target.is_relative_to(base): continue
            if not target.is_file(): result['scene3d'].append(str(target.relative_to(resolved_root)))
            elif target.suffix == '.js': pending.append(target)
    catalog = root / 'scene3d/catalog.json'
    if 'scene3d' in active and catalog.is_file():
        try:
            entries = json.loads(catalog.read_text(encoding='utf8'))
            if not isinstance(entries, list): raise ValueError('invalid catalog')
            for entry in entries:
                name = entry.get('file', '')
                base = (root / 'scene3d').resolve()
                file = (base / name).resolve()
                if not name or not file.is_relative_to(base) or not file.is_file() or file.stat().st_size == 0:
                    result['scene3d'].append('scene3d/' + str(name))
        except (OSError, ValueError, TypeError, AttributeError):
            result['scene3d'].append('scene3d/catalog.json（格式无效）')
    return {kind: list(dict.fromkeys(missing)) for kind, missing in result.items()}


def module_available(name):
    try: return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError): return False


def webview2_version():
    """Same EdgeUpdate registration families recognized by pywebview's WinForms backend."""
    if os.name != 'nt': return ''
    import winreg
    ids = ('{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', '{2CD8A007-E189-409D-A2C8-9AF4EF3C72AA}',
           '{0D50BFEC-CD6A-4F9A-964C-C7416E3ACB10}', '{65C35B14-6C1D-4122-AC46-7148CC9D6497}')
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        for view in (winreg.KEY_WOW64_32KEY, winreg.KEY_WOW64_64KEY):
            for identifier in ids:
                try:
                    with winreg.OpenKey(hive, r'SOFTWARE\Microsoft\EdgeUpdate\Clients' + '\\' + identifier,
                                        0, winreg.KEY_READ | view) as key:
                        value = str(winreg.QueryValueEx(key, 'pv')[0])
                        if re.fullmatch(r'\d+(?:\.\d+){1,3}', value) and int(value.split('.')[0]) >= 86:
                            return value
                except OSError: pass
    return ''


def native_status():
    from electron_runtime import status
    return status()


def launch_resources(kind, here=None):
    """Check launch-critical files without the full recursive UNC path audit.

    The explicit compatibility report still uses resources(), including static
    import traversal and canonical paths. Launching must not repeat that audit.
    """
    root = Path(here or Path(__file__).parent)
    names = list(FILES[kind])
    if kind == 'scene3d': names += ['scene3d/drafts.js', 'scene3d/notices.js']
    missing = []
    if kind == 'scene3d':
        try:
            from pathlib import PureWindowsPath, PurePosixPath
            entries=json.loads((root/'scene3d/catalog.json').read_text(encoding='utf8'))
            if not isinstance(entries,list):raise ValueError('catalog')
            for entry in entries:
                name=entry.get('file','')
                if not isinstance(name,str) or not name:raise ValueError('model path')
                win,posix=PureWindowsPath(name),PurePosixPath(name)
                if win.is_absolute() or win.drive or posix.is_absolute() or '..' in win.parts or '..' in posix.parts:raise ValueError('model path')
                names.append('scene3d/'+name)
        except (OSError,ValueError,TypeError,AttributeError):missing.append('scene3d/catalog.json（格式无效）')
    # Directory entries carry Windows file metadata: one UNC listing per folder,
    # instead of two network stat operations for every individual resource.
    folders={}
    for name in names:
        path=Path(name);folders.setdefault(path.parent,{})[path.name]=name
    for folder,wanted in folders.items():
        found=set()
        try:
            with os.scandir(root/folder) as entries:
                for entry in entries:
                    if entry.name not in wanted:continue
                    try:
                        if entry.is_file(follow_symlinks=False) and entry.stat(follow_symlinks=False).st_size:found.add(entry.name)
                    except OSError:pass
        except OSError:pass
        missing.extend(name for leaf,name in wanted.items() if leaf not in found)
    return list(dict.fromkeys(missing))


def require_editor(kind, here=None, quick=False):
    state = native_status()
    if not state.get('supported'):
        raise ValueError('Electron 独立窗口暂不支持此系统或 CPU 架构')
    if not state.get('desktop',True):
        raise ValueError('当前 Sidecar 没有桌面会话；Windows + WSL 请使用 Windows Python 启动窗口宿主，远程设备请在桌面端运行编辑器')
    if not state.get('electronExecutable'):
        raise ValueError('未找到 Electron 运行时，请运行插件 install_electron.py；也可配置 electronExecutable 或 DSH_ELECTRON_PATH')
    missing = launch_resources(kind, here) if quick else resources(here, (kind,))[kind]
    if missing:
        raise ValueError('编辑器资源不完整，请更新完整插件：' + '、'.join(missing[:6]))
    return state
