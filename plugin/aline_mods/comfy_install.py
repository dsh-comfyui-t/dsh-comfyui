"""Bounded installation discovery shared by Sidecar and installer bootstrap.

Reads files only. It does not import torch, run launchers, activate environments,
install dependencies, or infer which GPU a user wants to use.
"""
import os
import re


def layout(root):
    if not root: return None
    nested = os.path.join(root, 'ComfyUI')
    if os.path.isfile(os.path.join(nested, 'main.py')):
        main_dir, kind = nested, 'portable'
    elif (os.path.isfile(os.path.join(root, 'main.py')) and
          (os.path.isfile(os.path.join(root, 'folder_paths.py')) or
           os.path.isfile(os.path.join(root, 'comfy', 'cli_args.py')))):
        main_dir, kind = root, 'source'
    else: return None
    return {'root': root, 'mainDir': main_dir, 'main': os.path.join(main_dir, 'main.py'), 'layout': kind}


def infer_root(script, paths=None, adapters=None):
    if not script or not os.path.isfile(script): return ''
    if paths and adapters and os.path.splitext(script)[1].lower() != '.py':
        args, cwd, warnings = paths.script_args(script, os.path.dirname(script), adapters)
        if args.get('_main'):
            try:
                main_dir = os.path.dirname(paths.absolute(args['_main'], cwd))
                parent = os.path.dirname(main_dir)
                portable_python = any(os.path.isfile(os.path.join(parent, folder, 'python.exe')) for folder in ('python_standalone','python_embeded','python_embedded'))
                order = (parent, main_dir) if portable_python or not layout(main_dir) else (main_dir, parent)
                for candidate in order:
                    info = layout(candidate)
                    if info and os.path.realpath(info['mainDir']) == os.path.realpath(main_dir): return candidate
            except ValueError: pass
    current = os.path.dirname(script)
    for _ in range(3):
        if layout(current): return current
        parent = os.path.dirname(current)
        if parent == current: break
        current = parent
    return ''


def python_candidates(root, main_dir=''):
    for folder in ('python_standalone', 'python_embeded', 'python_embedded'):
        yield os.path.join(root, folder, 'python.exe')
    for base in dict.fromkeys((main_dir or root, root)):
        for folder in ('.venv', 'venv', 'env'):
            yield os.path.join(base, folder, 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(base, folder, 'bin', 'python')
            if os.name != 'nt': yield os.path.join(base, folder, 'bin', 'python3')


def select_python(root, script, paths, adapters):
    if script and os.path.isfile(script) and os.path.splitext(script)[1].lower() != '.py':
        args, cwd, _ = paths.script_args(script, root, adapters)
        value = args.get('_python', '')
        if value and (os.path.isabs(value) or '/' in value or '\\' in value):
            try:
                candidate = paths.absolute(value, cwd)
                if os.path.isfile(candidate): return candidate, 'launch.python'
            except ValueError: pass
        if args.get('_venv_python') and os.path.isfile(args['_venv_python']):
            return args['_venv_python'], 'launch.venv'
    info = layout(root)
    for candidate in python_candidates(root, info['mainDir'] if info else '') if root else ():
        if os.path.isfile(candidate): return candidate, 'install.python'
    return '', 'not-found'


def launchers(root, paths=None, adapters=None):
    info = layout(root)
    if not info: return []
    result = []; seen = set()
    for folder in dict.fromkeys((root, info['mainDir'], os.path.join(root, 'scripts'))):
        try: names = sorted(os.listdir(folder))
        except OSError: continue
        for name in names:
            if not re.fullmatch(r'(?:run|start)(?:[_ .-].*)?\.(?:bat|cmd|ps1|sh)', name, re.I): continue
            path = os.path.join(folder, name)
            if not os.path.isfile(path) or os.path.realpath(path) in seen: continue
            seen.add(os.path.realpath(path))
            lower = name.lower()
            backend = ('Intel' if re.search(r'intel|xpu|ipex|arc', lower) else
                       'AMD' if re.search(r'amd|rocm|directml', lower) else
                       'CPU' if 'cpu' in lower else 'NVIDIA' if re.search(r'nvidia|cuda', lower) else '通用')
            compatible = name.lower().endswith(('.bat','.cmd','.ps1')) if os.name == 'nt' else name.lower().endswith('.sh')
            recognized = False
            if paths and adapters:
                args, cwd, _ = paths.script_args(path, root, adapters)
                try: recognized = bool(args.get('_main') and os.path.realpath(paths.absolute(args['_main'],cwd)) == os.path.realpath(info['main']))
                except ValueError: pass
            result.append({'path':path, 'name':name, 'backend':backend, 'compatible':compatible, 'recognized':recognized})
    return result
