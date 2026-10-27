"""Conservative adapters for managed ComfyUI startup; never edit the user's script.

Recognized direct ComfyUI launch lines get --disable-auto-launch in a private
runtime copy. Unsupported launchers remain available in browser/legacy mode;
background mode refuses to silently execute a script it cannot control.
"""
import os
from pathlib import Path
import re
import shutil
import tempfile

class UnsupportedLaunch(ValueError):
    pass


def read_script(path):
    with open(path,'rb') as stream:
        raw=stream.read(1024*1024+1)
    if len(raw)>1024*1024:
        raise UnsupportedLaunch('启动脚本超过 1 MiB，无法自动适配')
    if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
        return raw.decode('utf-16')
    for encoding in ('utf-8-sig','gb18030'):
        try:return raw.decode(encoding)
        except UnicodeDecodeError:pass
    raise UnsupportedLaunch('无法识别启动脚本编码')


def _command_line(line, ext):
    """Find a direct Python main.py invocation, with no shell chaining/redirection.

    Quoted paths and literal metacharacters inside quotes are preserved. Expansions
    are not evaluated by the adapter; the user's original shell handles them.
    """
    line=line.lstrip('@').strip()
    if ext in ('.bat','.cmd'):
        line=re.sub(r'^call\s+(?=(?:"?[^\r\n]*?python))','',line,flags=re.I)
        line=re.sub(r'^start\s+""\s+(?:/b\s+)?','',line,flags=re.I)
    if ext=='.ps1':line=re.sub(r'^&\s+','',line)
    if ext=='.sh':line=re.sub(r'^exec\s+','',line)
    # Reject start-process/conda wrappers and indirect launchers. "python.exe"
    # can have an absolute/relative quoted path and flags before main.py.
    python=r'(?:"[^"\r\n]*[/\\]?python(?:[0-9.]*)?(?:\.exe)?"|\'[^\'\r\n]*[/\\]?python(?:[0-9.]*)?(?:\.exe)?\'|[^\s"\']*python(?:[0-9.]*)?(?:\.exe)?)'
    prefix=re.match(r'^'+python+r'\s+',line,re.I)
    if not prefix:return None
    tokens=re.findall(r'"[^"]*"|\'[^\']*\'|\S+',line[prefix.end():])
    i=0
    while i<len(tokens):
        token=tokens[i].strip('"\'')
        if token in ('-X','-W'):
            i+=2;continue
        if re.fullmatch(r'-[suEIBO]+',token):
            i+=1;continue
        if token=='--':i+=1
        break
    if i>=len(tokens) or tokens[i].strip('"\'').replace('\\','/').rsplit('/',1)[-1].lower()!='main.py':return None
    quote=None;escaped=False
    for c in line:
        if escaped:escaped=False;continue
        if c==('`' if ext=='.ps1' else '^' if ext in ('.bat','.cmd') else '\\'):
            escaped=True;continue
        if c in ('"',"'"):
            if quote==c:quote=None
            elif quote is None:quote=c
        if quote is None and c in '&|<>;':
            raise UnsupportedLaunch('启动行含命令链、重定向或后台子命令，无法可靠控制')
    if quote:raise UnsupportedLaunch('启动行引号不完整')
    # No attempt to forward dynamic script arguments/flags, since the original
    # UI does not supply any. These placeholders could inject competing flags.
    if any(t in line for t in ('%*','$args','"$@"',"'$@'",'${@}')):
        raise UnsupportedLaunch('启动行包含动态参数，请使用明确的 ComfyUI 启动参数')
    if any(t in line for t in ('$(', '`' if ext=='.sh' else '\x00')):
        raise UnsupportedLaunch('启动行包含动态命令替换，无法可靠控制')
    if re.search(r'--(?:auto-launch|disable-auto-launch)(?=[\s"\']|$)',line):
        line=re.sub(r'(?<!\S)--(?:auto-launch|disable-auto-launch)(?!\S)','',line)
    return line.rstrip()+' --disable-auto-launch'


def activation_info(content, ext, script_dir=None):
    """Recognize standard venv activation without sourcing arbitrary shell code."""
    if not script_dir: return {}
    cwd = script_dir; found = []
    for raw in content.splitlines():
        line = raw.strip().lstrip('@')
        line = re.sub(r'%~dp0', lambda _: script_dir + os.sep, line, flags=re.I)
        line = re.sub(r'\$PSScriptRoot\b', lambda _: script_dir, line, flags=re.I)
        cd = re.fullmatch(r'(?:cd|chdir|pushd|Set-Location)\s+(?:/d\s+)?["\']?([^"\']+?)["\']?', line, re.I)
        if cd and not re.search(r'[;&|<>`$%]', cd[1]):
            cwd = os.path.abspath(os.path.join(cwd, cd[1])); continue
        pattern = r'(?:source|\.)\s+(.+)' if ext == '.sh' else r'call\s+(.+)' if ext in ('.bat','.cmd') else r'(?:\.|&)\s+(.+)'
        match = re.fullmatch(pattern, line, re.I)
        if not match: continue
        value = match[1].strip()
        if value[:1] in ('"', "'") and value[-1:] == value[:1]: value = value[1:-1]
        expected = 'activate' if ext == '.sh' else 'activate.bat' if ext in ('.bat','.cmd') else 'activate.ps1'
        if os.path.basename(value).lower() != expected or re.search(r'[;&|<>`$%"\']', value): continue
        path = os.path.abspath(os.path.join(cwd,value))
        venv = os.path.dirname(os.path.dirname(path))
        python = os.path.join(os.path.dirname(path),'python' if ext == '.sh' else 'python.exe')
        if not (os.path.isfile(path) and os.path.isfile(python) and os.path.isfile(os.path.join(venv,'pyvenv.cfg'))): continue
        found.append({'line':raw.strip().lstrip('@'), 'python':python, 'root':venv})
    if len(found)>1: raise UnsupportedLaunch('启动脚本包含多个 venv 激活，无法确定解释器')
    return found[0] if found else {}


def adapt_script(content,ext,overrides=None,browser=False,script_dir=None):
    activation = activation_info(content, ext, script_dir)
    lines=content.splitlines();out=[];found=0
    # Join ordinary shell continuations before identifying a command.
    continuation='^' if ext in ('.bat','.cmd') else '`' if ext=='.ps1' else '\\'
    joined=[];pending=''
    for line in lines:
        line=pending+line.lstrip() if pending else line
        if line.rstrip().endswith(continuation):
            pending=line.rstrip()[:-1]+' ';continue
        joined.append(line);pending=''
    if pending:raise UnsupportedLaunch('脚本续行未结束')
    for original in joined:
        line=original.strip();plain=line.lstrip('@').strip()
        if not plain or plain.startswith('#') or (ext in ('.bat','.cmd') and (plain.lower().startswith('rem ') or plain.startswith('::'))):
            out.append(original);continue
        if activation and plain == activation['line']:
            out.append('rem DSH: standard venv environment' if ext in ('.bat','.cmd') else '# DSH: standard venv environment')
            continue
        command=_command_line(plain,ext)
        if command:
            if browser:
                command = command.removesuffix(' --disable-auto-launch')
                if '--disable-auto-launch' in plain: command += ' --disable-auto-launch'
                elif '--auto-launch' in plain: command += ' --auto-launch'
            for flag, values in (overrides or {}).items():
                for index, value in enumerate(values):
                    if any(c in value for c in ('\x00', '\r', '\n', '"')):
                        raise UnsupportedLaunch('目录包含不支持的控制字符或引号')
                    variable = 'DSH_PATH_' + flag[2:].replace('-', '_').upper() + '_' + str(index)
                    ref = ('%' + variable + '%') if ext in ('.bat', '.cmd') else ('$env:' + variable) if ext == '.ps1' else ('${' + variable + '}')
                    command += (' ' + flag if index == 0 else '') + ' "' + ref + '"'
            if overrides and ext in ('.bat', '.cmd'): out.append('setlocal DisableDelayedExpansion')
            found+=1;out.append(command)
            if overrides and ext in ('.bat', '.cmd'): out.append('endlocal')
            continue
        # Explicit standalone browser launch commands are suppressed. Everything
        # else must match a narrowly allowed non-launching setup statement.
        browser_command=(
            re.fullmatch(r'start\s+(?:""\s+)?["\']?https?://[^\s"\']+["\']?\s*',plain,re.I) if ext in ('.bat','.cmd') else
            re.fullmatch(r'Start-Process\s+(?:-FilePath\s+)?["\']https?://[^"\']+["\']\s*',plain,re.I) if ext=='.ps1' else
            re.fullmatch(r'(?:xdg-open|open)\s+["\']?https?://[^\s"\']+["\']?\s*',plain,re.I))
        if browser_command:
            if browser: out.append(original)
            continue
        if ext in ('.bat','.cmd'):
            if re.fullmatch(r'pause(?:\s+>\s*nul)?',plain,re.I):
                if browser: out.append(original)
                continue
            if re.fullmatch(r'chcp\s+\d+(?:\s*>\s*nul)?',plain,re.I):
                out.append(original);continue
            allowed=bool(re.match(r'^(?:echo(?:\s|\.)|setlocal(?:\s|$)|endlocal$|set\s+(?!/p\b|/a\b)|(?:cd|chdir|pushd)\s+|popd$|exit\s+/b(?:\s+\d+)?$)',plain,re.I))
            # Do not let setup statements smuggle extra commands after & or |.
            if allowed and re.search(r'[&|<>]',plain):allowed=False
            if re.search(r'%(?:~[a-z]*[0-9]|[0-9])',re.sub(r'%~dp0','',plain,flags=re.I),re.I):allowed=False
        elif ext=='.ps1':
            allowed=bool(re.match(r'^(?:(?:\$env:[A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^;]+$|Set-Location\s+[^;]+$|Write-Host\s+[^;]+$)',plain,re.I))
            if '$(' in plain or re.search(r'[&|;]',plain):allowed=False
        else:
            allowed=bool(re.match(r'^(?:cd\s+|export\s+[A-Za-z_][A-Za-z0-9_]*=|[A-Za-z_][A-Za-z0-9_]*=|echo\s+)',plain))
            if re.search(r'[;&|<>`]|\$\(',plain):allowed=False
        if not allowed:raise UnsupportedLaunch('脚本包含无法可靠适配的命令：'+plain[:100])
        out.append(original)
    if found!=1:raise UnsupportedLaunch('须能识别唯一一条 Python main.py 启动命令')
    result='\n'.join(out)+'\n'
    if ext in ('.bat','.cmd'):
        if re.search(r'%(?:~[a-z]*[0-9]|[0-9])',re.sub(r'%~dp0','',result,flags=re.I),re.I):
            raise UnsupportedLaunch('脚本使用了不支持的位置参数')
        result=re.sub(r'%~dp0','%DSH_COMFY_SCRIPT_DIR%',result,flags=re.I)
    elif ext=='.ps1':
        result=re.sub(r'\$PSScriptRoot\b','$env:DSH_COMFY_SCRIPT_DIR',result,flags=re.I)
        result=re.sub(r'\$PSCommandPath\b','$env:DSH_COMFY_ORIGINAL_SCRIPT',result,flags=re.I)
    elif '$0' in result or 'BASH_SOURCE' in result:
        raise UnsupportedLaunch('脚本依赖自己的文件路径，当前无法可靠适配')
    return result


def capabilities(script):
    if not script:return {'background':True,'managed_browser':True,'reason':''}
    ext=Path(script).suffix.lower()
    try:
        if ext in ('.bat','.cmd','.ps1','.sh'):
            adapt_script(read_script(script),ext,script_dir=os.path.dirname(os.path.abspath(script)))
        elif ext=='.py':
            if Path(script).name.lower()!='main.py' or not (Path(script).parent/'comfy'/'cli_args.py').is_file():
                raise UnsupportedLaunch('自定义 Python 包装脚本不能保证阻止打开网页')
        else:raise UnsupportedLaunch('可执行启动器的内部行为无法自动控制')
        return {'background':True,'managed_browser':True,'reason':''}
    except (UnsupportedLaunch,OSError) as ex:
        return {'background':False,'managed_browser':False,'reason':str(ex)}


def prepare_script(script,mode,overrides=None):
    caps=capabilities(script)
    if not caps['background']:
        if mode=='background' or overrides:raise UnsupportedLaunch('此脚本不支持可靠的后台模式：'+caps['reason'])
        return script,None,{},caps
    ext=Path(script).suffix.lower()
    if ext=='.py':return script,None,{},caps
    original_content=read_script(script)
    activation=activation_info(original_content,ext,os.path.dirname(os.path.abspath(script)))
    content=adapt_script(original_content,ext,overrides,browser=mode=='browser',script_dir=os.path.dirname(os.path.abspath(script)))
    folder=tempfile.mkdtemp(prefix='dsh-comfy-launch-')
    copy=Path(folder)/('launch'+ext)
    # cmd.exe reads the Windows active ANSI code page, unlike PowerShell's BOM
    # aware reader. Use the local code page to retain non-ASCII paths/comments.
    encoding='mbcs' if os.name=='nt' and ext in ('.bat','.cmd') else 'utf-8-sig' if ext=='.ps1' else 'utf-8'
    codepage=re.search(r'(?im)^\s*@?chcp\s+(\d+)(?:\s*>\s*nul)?\s*$',content)
    if codepage and ext in ('.bat','.cmd'):
        encoding='utf-8' if codepage[1]=='65001' else 'cp'+codepage[1]
    try:
        with open(copy,'w',encoding=encoding,newline='\r\n' if ext in ('.bat','.cmd') else '\n') as stream:
            stream.write(content)
    except BaseException:
        shutil.rmtree(folder,ignore_errors=True);raise
    env={'DSH_COMFY_SCRIPT_DIR':os.path.dirname(os.path.abspath(script))+os.sep,
         'DSH_COMFY_ORIGINAL_SCRIPT':os.path.abspath(script)}
    if activation:
        env['VIRTUAL_ENV']=activation['root']
        env['PATH']=os.path.dirname(activation['python'])+os.pathsep+os.environ.get('PATH','')
    for flag, values in (overrides or {}).items():
        for index, value in enumerate(values):
            env['DSH_PATH_' + flag[2:].replace('-', '_').upper() + '_' + str(index)] = value
    return str(copy),folder,env,caps


def process_options(platform=None):
    """No DETACHED_PROCESS/CREATE_NEW_CONSOLE combination; preserve process-tree ownership."""
    import subprocess
    windows=(platform or os.name)=='nt'
    options={'creationflags':(0x08000000 | 0x00000200) if windows else 0,
             'start_new_session':not windows}
    if windows:
        startup=subprocess.STARTUPINFO()
        startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow=0
        options['startupinfo']=startup
    return options
