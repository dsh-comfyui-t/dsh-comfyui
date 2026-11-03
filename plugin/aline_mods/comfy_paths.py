"""Read-only ComfyUI path discovery. Never execute a launcher or create directories.

All relative CLI paths use the launcher's effective working directory. Explicit
config paths are absolute, and invalid selections remain errors, not fallbacks.
"""
import os
import re
import importlib.util
_CROSS_SPEC = importlib.util.spec_from_file_location('dsh_paths_cross', os.path.join(os.path.dirname(__file__),'cross_paths.py'))
_CROSS = importlib.util.module_from_spec(_CROSS_SPEC)
_CROSS_SPEC.loader.exec_module(_CROSS)
from functools import lru_cache


@lru_cache(maxsize=32)
def _yaml_document(path, modified, size):
    import yaml
    with open(path, encoding="utf-8-sig") as stream:
        return yaml.safe_load(stream)

@lru_cache(maxsize=16)
def _script_content(path, modified, size, adapters):
    return adapters.read_script(path)


FLAGS = {'--output-directory': 'output', '--temp-directory': 'temp',
         '--base-directory': 'base', '--extra-model-paths-config': 'models'}
CONFIG_KEYS = ('outputDirectory', 'tempDirectory', 'extraModelPathsConfig')


def normalize(value):
    value = str(value or '').strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        value = value[1:-1]
    value = os.path.expandvars(os.path.expanduser(value))
    return _CROSS.runtime_path(value) if value else ''


def absolute(value, cwd):
    value = normalize(value)
    if not value:
        raise ValueError('路径为空')
    if any(c in value for c in ('\x00', '\r', '\n', '"')):
        raise ValueError('路径包含不支持的控制字符或引号')
    # Foreign Windows paths must never become relative filenames on Linux.
    if os.name != 'nt' and (re.match(r'^[A-Za-z]:', value) or value.startswith('\\\\')):
        raise ValueError('Windows 路径须由 Windows sidecar 解析：' + value)
    if re.search(r'%[^%]+%|\$(?:[A-Za-z_{(])|`', value):
        raise ValueError('路径含无法静态解析的变量或命令：' + value)
    return os.path.abspath(value if os.path.isabs(value) else os.path.join(cwd, value))


def tokens(line):
    # Keep backslashes in Windows paths; shlex(posix=True) destroys them.
    pattern = r'''(?:"[^"\n]*"|'[^'\n]*'|[^\s"']+)+'''
    out = []
    for token in re.findall(pattern, line):
        # Remove only syntactic quotes; preserve an apostrophe in "O'Brien".
        out.append(''.join(part[1:-1] if part[:1] in ('"', "'") else part
                           for part in re.findall(r'''"[^"\n]*"|'[^'\n]*'|[^\s"']+''', token)))
    return out


def parse_args(args):
    found = {}; i = 0
    while i < len(args):
        token = str(args[i]); flag, equal, val = token.partition('=')
        if flag not in FLAGS:
            i += 1; continue
        name = FLAGS[flag]; values = []
        if equal:
            values = [val]
        else:
            i += 1
            while i < len(args) and not str(args[i]).startswith('--'):
                values.append(str(args[i])); i += 1
                if name != 'models': break
            i -= 1
        if not values or any(not v for v in values):
            raise ValueError(flag + ' 缺少路径参数')
        if name == 'models': found.setdefault(name, []).extend(values)
        else: found[name] = values[-1]
        i += 1
    return found


def script_args(script, root, adapters):
    """Only a unique literal main.py command; shell setup is not evaluated."""
    cwd = os.path.dirname(script) if script else root
    if not script or os.path.splitext(script)[1].lower() == '.py':
        return {}, cwd, []
    ext = os.path.splitext(script)[1].lower()
    if ext not in ('.bat', '.cmd', '.ps1', '.sh'):
        return {}, cwd, ['无法静态读取启动器参数；请明确配置目录并确认实际服务使用相同路径。']
    try:
        stat = os.stat(script)
        content = _script_content(script, stat.st_mtime_ns, stat.st_size, adapters)
        continuation = '^' if ext in ('.bat', '.cmd') else '`' if ext == '.ps1' else '\\'
        content = re.sub(re.escape(continuation) + r'\s*\r?\n', ' ', content)
        found = []; unknown_cwd = False
        for original in content.splitlines():
            line = original.strip().lstrip('@')
            if not line or line.startswith(('#', '::')) or re.match(r'rem\s', line, re.I): continue
            def expand_known(value):
                value = re.sub(r'%~dp0', lambda _: os.path.dirname(script) + os.sep, value, flags=re.I)
                return re.sub(r'\$PSScriptRoot\b', lambda _: os.path.dirname(script), value, flags=re.I)
            cd = re.fullmatch(r'(?:cd|chdir|pushd|Set-Location)\s+(?:/d\s+)?(.+)', line, re.I)
            if cd:
                try:
                    parts = tokens(cd[1])
                    if len(parts) != 1: raise ValueError('工作目录含动态命令')
                    cwd = absolute(expand_known(parts[0]), cwd)
                except (ValueError, IndexError): unknown_cwd = True
                continue
            if re.match(r'(?:cd|chdir|pushd|popd|Set-Location)\b', line, re.I): unknown_cwd = True
            command = adapters._command_line(line, ext)
            if command:
                if unknown_cwd: raise ValueError('启动脚本工作目录无法静态解析')
                values = [expand_known(value) for value in tokens(command)]
                parsed = parse_args(values)
                main = next((value for value in values if value.replace('\\', '/').rsplit('/', 1)[-1].lower() == 'main.py'), '')
                parsed.update(_main=main, _python=values[0])
                activation = adapters.activation_info(content, ext, os.path.dirname(script))
                if activation: parsed['_venv_python'] = activation['python']
                found.append((parsed, cwd))
        if len(found) != 1:
            raise ValueError('未识别唯一的 Python main.py 启动行')
        return found[0][0], found[0][1], []
    except (ValueError, OSError) as ex:
        # Retain unresolved path flags as errors instead of switching directories.
        unresolved = {name: '$UNRESOLVED' for flag, name in FLAGS.items() if flag in locals().get('content', '') and name != 'models'}
        if '--extra-model-paths-config' in locals().get('content', ''): unresolved['models'] = ['$UNRESOLVED']
        return unresolved, cwd, ['启动参数未解析：' + str(ex) + '；默认目录仅为推断，请核对。']


def resolve(root, cfg, adapters, model_keys, include_models=True):
    script = cfg.get('startScript', '')
    args, cwd, warnings = script_args(script, root, adapters)
    errors = []
    if not script:
        try: args = parse_args(cfg.get('extraArgs', cfg.get('extraComfyArgs')) or [])
        except ValueError as ex: errors.append(str(ex))
    main_dir = (os.path.join(root,'ComfyUI') if os.path.isfile(os.path.join(root,'ComfyUI','main.py')) else root if os.path.isfile(os.path.join(root,'main.py')) else os.path.join(root,'ComfyUI')) if root else ''
    base = main_dir if root else ''
    if args.get('base'):
        try: base = absolute(args['base'], cwd)
        except ValueError as ex: errors.append(str(ex)); base = ''
    resolved = {}
    for name, key in (('output', 'outputDirectory'), ('temp', 'tempDirectory')):
        explicit = cfg.get(key, '')
        value = explicit or args.get(name, '')
        source = 'config.' + key if explicit else 'launch.' + name if value else 'default'
        error = ''; path = ''
        try:
            if value:
                if explicit and not os.path.isabs(normalize(value)):
                    raise ValueError('明确配置必须使用绝对路径')
                path = absolute(value, cwd)
                # ComfyUI --temp-directory denotes a parent, not the final temp dir.
                if not os.path.isdir(path): raise ValueError('目录不存在：' + path)
                if name == 'temp': path = os.path.join(path, 'temp')
            else:
                if not base: raise ValueError('无法定位 ComfyUI 根目录')
                path = os.path.join(base, name)
            if os.path.exists(path) and not os.path.isdir(path): raise ValueError('路径不是目录：' + path)
        except ValueError as ex:
            error = name + '：' + str(ex); errors.append(error)
        resolved[name] = {'path': path, 'source': source, 'error': error}
    if not include_models:
        return {'resolvedPaths': resolved, 'pathWarnings': warnings, 'pathErrors': errors}
    configs = []; seen = set()
    # ComfyUI automatically loads its own YAML; portable-root YAML is forwarded
    # explicitly by our launcher so the Sidecar and ComfyUI see the same set.
    defaults = [os.path.join(main_dir, 'extra_model_paths.yaml'),
                os.path.join(root, 'extra_model_paths.yaml')] if root else []
    for value, source in ([(p, 'default') for p in defaults if os.path.isfile(p)] +
                          [(p, 'launch.models') for p in args.get('models', [])] +
                          [(p, 'config.extraModelPathsConfig') for p in (cfg.get('extraModelPathsConfig') or []) if str(p).strip()]):
        entry = None
        try:
            if source.startswith('config.') and not os.path.isabs(normalize(value)):
                raise ValueError('模型配置须为绝对路径：' + str(value))
            path = absolute(value, cwd)
            real = os.path.normcase(os.path.realpath(path))
            if real in seen: continue
            seen.add(real)
            entry = {'path': path, 'source': source, 'error': ''}; configs.append(entry)
            if not os.path.isfile(path): raise ValueError('模型配置文件不存在：' + path)
        except ValueError as ex:
            errors.append(str(ex))
            if entry is not None: entry['error'] = str(ex)
            else: configs.append({'path': str(value), 'source': source, 'error': str(ex)})
    models = []; yaml_module = None
    if any(not c['error'] for c in configs):
        try:
            import yaml as yaml_module
        except ImportError:
            warnings.append('Sidecar Python 缺少 PyYAML，无法读取额外模型目录。请用该解释器安装 PyYAML 后重启 Sidecar。')
    if yaml_module:
        for item in configs:
            if item['error']: continue
            pending_models=[];pending_warnings=[]
            try:
                stat = os.stat(item['path'])
                data = _yaml_document(item['path'], stat.st_mtime_ns, stat.st_size)
                if data is None: data = {}
                if not isinstance(data, dict): raise ValueError('顶层须为映射')
                for block_name, block in data.items():
                    if block is None: continue
                    if not isinstance(block, dict): raise ValueError(str(block_name) + ' 须为映射')
                    base_value=block.get('base_path')
                    if base_value is not None and not isinstance(base_value,str):raise ValueError(str(block_name)+'.base_path 须为字符串')
                    default=block.get('is_default',False)
                    if default is None or default=='':default=False
                    if isinstance(default,int) and default in (0,1):default=bool(default)
                    if isinstance(default,str) and default.lower() in ('true','false'):default=default.lower()=='true'
                    if not isinstance(default,bool):raise ValueError(str(block_name)+'.is_default 须为 true/false')
                    base_path = absolute(base_value or '.', os.path.dirname(item['path']))
                    for kind, keys in model_keys.items():
                        for key in keys:
                            values = block.get(key)
                            if values is None: continue
                            if not isinstance(values, str): raise ValueError(key + ' 须为字符串或多行字符串')
                            for value in values.splitlines():
                                if not value.strip(): continue
                                path = absolute(value.strip(), base_path)
                                record = {'kind': kind, 'path': path, 'config': item['path'],
                                          'isDefault': default, 'exists': os.path.isdir(path)}
                                pending_models.append(record)
                                if not record['exists']: pending_warnings.append('模型目录不存在：' + path + '（' + item['path'] + '）')
                models.extend(pending_models);warnings.extend(pending_warnings)
            except (OSError, ValueError, yaml_module.YAMLError) as ex:
                item['error'] = 'YAML 解析失败：' + str(ex)
                message=item['path']+'：'+item['error'];warnings.append(message);errors.append(message)
    return {'resolvedPaths': resolved, 'modelConfigs': configs, 'modelPaths': models,
            'modelBase': os.path.join(base, 'models') if base else '',
            'pathWarnings': list(dict.fromkeys(warnings)), 'pathErrors': errors}


def launch_overrides(root, cfg):
    """Argument values passed via environment variables, never shell interpolation."""
    overrides = {}
    for flag, key in (('--output-directory', 'outputDirectory'), ('--temp-directory', 'tempDirectory')):
        if cfg.get(key): overrides[flag] = [normalize(cfg[key])]
    files = [normalize(value) for value in (cfg.get('extraModelPathsConfig') or []) if str(value).strip()]
    portable_yaml = os.path.join(root, 'extra_model_paths.yaml') if root else ''
    if portable_yaml and os.path.isfile(os.path.join(root, 'ComfyUI', 'main.py')) and os.path.isfile(portable_yaml): files.insert(0, portable_yaml)
    if files: overrides['--extra-model-paths-config'] = files
    return overrides
