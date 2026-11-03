"""Explicit host/runtime path namespaces. No shell evaluation or guessed mount.

Drive mounts /mnt/<letter> are understood for compatibility. UNC WSL shares are
mapped back only for the current distro; a generic UNC needs an explicit mount.
"""
import ntpath
import os
import re
import subprocess


def clean(value):
    value = str(value or '').strip()
    if len(value)>1 and value[0]==value[-1] and value[0] in ('"', "'"): value=value[1:-1]
    if any(c in value for c in ('\0','\r','\n','"')): raise ValueError('路径包含不支持的控制字符或引号')
    return value


def is_wsl():
    if os.name=='nt': return False
    if os.environ.get('WSL_DISTRO_NAME') or os.environ.get('WSL_INTEROP'): return True
    try:
        with open('/proc/version',encoding='utf-8') as stream:return bool(re.search('microsoft|wsl',stream.read(),re.I))
    except OSError:return False


def windows_path(value, distro='', convert=None):
    value=clean(value)
    if value.startswith('//'):value=value.replace('/','\\')
    if not value:return ''
    if re.match(r'^[a-zA-Z]:[/\\]',value) or value.startswith('\\\\'):
        return ntpath.normpath(value)
    match=re.fullmatch(r'/mnt/([a-zA-Z])(?:/(.*))?',value)
    if match:return ntpath.normpath(match[1].upper()+':\\'+(match[2] or '').replace('/','\\'))
    if value.startswith('/'):
        if convert:
            result=clean(convert(value))
            if re.match(r'^[a-zA-Z]:[/\\]',result) or result.startswith('\\\\'):return ntpath.normpath(result)
            raise ValueError('wslpath 没有返回 Windows 绝对路径')
        if distro and re.fullmatch(r'[A-Za-z0-9_. -]+',distro):
            return ntpath.normpath('\\\\wsl.localhost\\'+distro+value.replace('/','\\'))
        raise ValueError('Linux 路径缺少 WSL 发行版/转换结果，不能作为 Windows 路径：'+value)
    return ntpath.normpath(value)


def linux_path(value, wsl=False, distro='', convert=None):
    value=clean(value)
    if value.startswith('//'):value=value.replace('/','\\')
    if not value:return ''
    unc=re.fullmatch(r'\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(?:\\(.*))?',value,re.I)
    if unc:
        if not wsl or not distro or unc[1].casefold()!=distro.casefold():
            raise ValueError('UNC 指向其他或未知 WSL 发行版：'+value)
        tail=(unc[2] or '').replace('\\','/')
        if '..' in tail.split('/'):raise ValueError('UNC 路径不能跨出发行版根目录')
        return os.path.normpath('/'+tail)
    if value.startswith('\\\\'):raise ValueError('网络 UNC 需先明确挂载到 Linux 目录：'+value)
    if re.match(r'^[a-zA-Z]:[/\\]',value):
        if not wsl:raise ValueError('Windows 路径须由 Windows Python 或 WSL 解析：'+value)
        if convert:
            result=clean(convert(value))
            if not result.startswith('/') or '\\' in result:raise ValueError('wslpath 没有返回 Linux 绝对路径')
            return os.path.normpath(result)
        return '/mnt/'+value[0].lower()+'/'+value[3:].replace('\\','/')
    return os.path.normpath(value)


def wsl_convert(value, target):
    flag='-w' if target=='windows' else '-u'
    try:result=subprocess.check_output(['wslpath',flag,clean(value)],text=True,encoding='utf-8',timeout=5).strip()
    except (OSError,subprocess.SubprocessError) as ex:raise ValueError('wslpath 转换失败：'+str(ex)) from ex
    return windows_path(result) if target=='windows' else linux_path(result,wsl=True,distro=os.environ.get('WSL_DISTRO_NAME',''))


def runtime_path(value, platform=None, distro=None):
    target=platform or os.name
    distro=os.environ.get('WSL_DISTRO_NAME','') if distro is None else distro
    if target=='nt':return windows_path(value,distro=distro)
    wsl=is_wsl()
    return linux_path(value,wsl=wsl,distro=distro,convert=(lambda p:wsl_convert(p,'linux')) if wsl else None)


def command_cwd(script, platform=None):
    """cmd.exe cannot retain a UNC working directory: fail before spawning."""
    target=platform or os.name
    value=windows_path(script) if target=='nt' else clean(script)
    if target=='nt' and value.lower().endswith(('.bat','.cmd')) and ntpath.dirname(value).startswith('\\\\'):
        raise ValueError('Windows cmd 不支持 UNC 工作目录。请将 ComfyUI 的 .bat/.cmd 启动文件放到 Windows 盘符目录；插件文件可保留在 WSL。')
    return ntpath.dirname(value) if target=='nt' else os.path.dirname(value)

PATH_FIELDS = ('comfyRoot','pythonExe','comfyPythonExe','startScript','workDir','credsFile',
               'dataDir','dbPath','outputDirectory','tempDirectory')


def normalize_config(config, windows=False, wsl=False, distro='', convert=None):
    """Convert a copy for the selected interpreter; never migrate a database."""
    result=dict(config)
    def transform(value):
        return windows_path(value,distro,convert) if windows else linux_path(value,wsl,distro,convert)
    for key in PATH_FIELDS:
        if result.get(key):result[key]=transform(result[key])
    extra=result.get('extraModelPathsConfig') or []
    if not isinstance(extra,list):raise ValueError('extraModelPathsConfig 必须为路径数组')
    result['extraModelPathsConfig']=[transform(path) for path in extra if str(path).strip()]
    for key in ('dataDir','dbPath'):
        value=result.get(key) or ''
        if value and not (bool(re.match(r'^[A-Za-z]:[/\\]',value)) if windows else os.path.isabs(value)) and not (windows and value.startswith('\\\\')):
            raise ValueError(key+' 必须为实际 Sidecar 的绝对路径')
        if value and ((windows and value.startswith('\\\\')) or
                      (not windows and (re.match(r'^[A-Za-z]:',value) or value.startswith('/mnt/')))):
            raise ValueError(key+' 不能跨系统/UNC 保存 SQLite；请使用实际 Sidecar 的本机持久化目录。现有数据库不会迁移。')
    if result.get('startScript'):command_cwd(result['startScript'],'nt' if windows else 'posix')
    return result
