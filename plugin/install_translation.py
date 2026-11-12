"""Installer/retry entry point; use the same Python and data directory as sidecar.

The Linux bootstrap can hand off to Windows Python when DSH runs in WSL.
No sidecar or ComfyUI process needs to be started to install translation.
"""
import importlib.util
import json
import ntpath
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent


_cross_spec = importlib.util.spec_from_file_location('dsh_translation_paths', HERE/'cross_paths.py')
_CROSS = importlib.util.module_from_spec(_cross_spec)
_cross_spec.loader.exec_module(_CROSS)


def is_wsl():
    if os.name == 'nt':
        return False
    if os.environ.get('WSL_DISTRO_NAME') or os.environ.get('WSL_INTEROP'):
        return True
    try:
        return bool(re.search(r'microsoft|wsl', Path('/proc/version').read_text(), re.I))
    except OSError:
        return False


def host_path(value, wsl):
    return _CROSS.windows_path(value) if os.name=='nt' else _CROSS.linux_path(value,wsl,distro=os.environ.get('WSL_DISTRO_NAME',''),convert=(lambda p:_CROSS.wsl_convert(p,'linux')) if wsl else None)


def select_python(config, wsl):
    """Follow lib/index.js: explicit interpreter, portable roots, system Python."""
    def valid(value):
        try: return bool(value) and Path(host_path(str(value), wsl)).is_file()
        except ValueError: return False
    explicit = str(config.get('pythonExe') or '')
    if valid(explicit):
        return host_path(explicit, wsl)
    if wsl and explicit.lower().endswith('.exe'):
        raise ValueError('明确配置的 Windows Python 不可访问；请检查 WSL interop / 路径，未改用 Linux Python')
    roots = [str(config.get('comfyRoot') or '')]
    script = str(config.get('startScript') or '')
    if script:
        roots.append(ntpath.dirname(script) if re.match(r'^[a-zA-Z]:', script) else str(Path(script).parent))
    if wsl or os.name == 'nt':
        roots += [drive + suffix for drive in ('C:', 'D:', 'E:', 'F:') for suffix in
                  ('\\ComfyUI\\ComfyUI_Windows_portable', '\\ComfyUI\\ComfyUI_windows_portable', '\\ComfyUI_windows_portable')]
    for root in roots:
        if not root:
            continue
        for folder in ('python_standalone', 'python_embeded', 'python_embedded'):
            join = ntpath.join if re.match(r'^[a-zA-Z]:', root) else os.path.join
            candidate = join(root, folder, 'python.exe')
            if valid(candidate):
                return host_path(candidate, wsl)
        join = ntpath.join if re.match(r'^[a-zA-Z]:', root) else os.path.join
        windows = os.name == 'nt' or (wsl and bool(re.match(r'^[a-zA-Z]:|^/mnt/[a-zA-Z]/', root)))
        for base in (root, join(root, 'ComfyUI')):
            for folder in ('.venv','venv','env'):
                candidate = join(base,folder,'Scripts' if windows else 'bin','python.exe' if windows else 'python')
                if valid(candidate): return host_path(candidate,wsl)
                if wsl:
                    for suffix in (('bin','python'),('bin','python3'),('Scripts','python.exe')):
                        candidate=join(base,folder,*suffix)
                        if valid(candidate):return host_path(candidate,wsl)
    explicit_comfy = str(config.get('comfyPythonExe') or '')
    if valid(explicit_comfy): return host_path(explicit_comfy,wsl)
    return shutil.which('python.exe' if os.name == 'nt' else 'python3') or sys.executable


def runtime_command(executable, wsl):
    script = str(HERE / 'install_translation.py')
    windows = wsl and executable.lower().endswith('.exe')
    if windows:
        script = _CROSS.windows_path(script,convert=lambda p:subprocess.check_output(['wslpath','-w',p],text=True,encoding='utf-8',timeout=5).strip())
    return [executable, '-u', script, '--runtime'], str(Path(executable).parent) if windows else str(HERE)


def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install(config):
    dictionary = load_module('dsh_install_dictionary', 'tag_dictionary.py')
    config=dict(config)
    for key in ('dataDir','dbPath'):
        if config.get(key): config[key]=_CROSS.runtime_path(config[key])
    path = dictionary.data_path(config)
    try:
        in_plugin = os.path.commonpath([os.path.realpath(path), str(HERE)]) == str(HERE)
    except ValueError:
        in_plugin = False  # Different Windows drives are valid.
    if in_plugin:
        raise ValueError('翻译组件必须存放在插件目录之外，请检查 dataDir / dbPath')
    translation = load_module('dsh_install_translation', 'offline_translation.py')
    engine = translation.OfflineTranslation(path.parent)
    if engine.status()['ready']:
        print('离线翻译已安装，直接复用：' + str(engine.root), flush=True)
        return 0
    state = engine.install()
    last_message = ''
    while True:
        message = state.get('message', '')
        if message != last_message:
            print(message, flush=True)
            last_message = message
        if state['status'] != 'running':
            break
        time.sleep(1)
        state = engine.status()
    if state.get('ready'):
        print('离线翻译已就绪：' + str(engine.root), flush=True)
        return 0
    print('插件主体可继续使用。请检查网络、Python/pip 和上述安装日志，然后重新运行插件安装脚本，或在中文预览中点击安装重试。', flush=True)
    return 1


def main(argv):
    try:
        config = json.loads((HERE / 'config.json').read_text(encoding='utf-8-sig'))
        if argv == ['--runtime']:
            return install(config)
        if argv:
            raise ValueError('不支持的参数')
        wsl = is_wsl()
        executable = select_python(config, wsl)
        command, directory = runtime_command(executable, wsl)
        print('准备安装 / 检查离线英中翻译组件（已有组件将复用）…', flush=True)
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        # Arguments never pass through a shell, including Chinese paths and spaces.
        return subprocess.run(command, cwd=directory, creationflags=flags).returncode
    except Exception as e:
        print('离线翻译安装未完成：' + str(e), flush=True)
        print('插件主体可继续安装；修复后重新运行安装脚本，或在中文预览中重试。', flush=True)
        return 1


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, OSError):
        pass
    sys.exit(main(sys.argv[1:]))
