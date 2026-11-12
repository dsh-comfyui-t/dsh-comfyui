#!/usr/bin/env python3
"""Read-only runtime/path/loopback report for an installed plugin.

Never starts ComfyUI, installs dependencies or changes a firewall/listener.
Use --plugin-dir for an installed Profile; --output is an optional local JSON.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys


def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plugin-dir',default=str(Path(__file__).resolve().parents[1]/'plugin'))
    parser.add_argument('--output')
    args=parser.parse_args();directory=Path(args.plugin_dir).expanduser().resolve()
    sys.dont_write_bytecode=True
    output=Path(args.output).expanduser().resolve() if args.output else None
    if output and output.is_relative_to(directory):
        print(json.dumps({'readOnly':True,'error':'报告须保存在插件目录之外，避免覆盖运行文件','gpuTested':False},ensure_ascii=False));return 1
    config_path=directory/'config.json'
    if not config_path.is_file():config_path=directory/'config.example.json'
    try:
        cfg=json.loads(config_path.read_text(encoding='utf-8-sig'))
        if not isinstance(cfg,dict):raise ValueError('config.json 顶层必须是对象')
        boot=load('dsh_check_bootstrap',directory/'install_translation.py');wsl=boot.is_wsl();exe=boot.select_python(cfg,wsl)
        windows=wsl and exe.lower().endswith('.exe')
        bridge=str(directory/'runtime_bridge.py');config=str(config_path)
        if windows:
            bridge=boot._CROSS.windows_path(bridge,convert=lambda p:boot._CROSS.wsl_convert(p,'windows'))
            config=boot._CROSS.windows_path(config,convert=lambda p:boot._CROSS.wsl_convert(p,'windows'))
        cwd=str(Path(exe).parent) if windows else str(directory)
        def call(*arguments):
            # -B / PYTHONDONTWRITEBYTECODE: the probe must not leave __pycache__ in
            # the installed plugin, or a read-only check modifies the release tree.
            env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
            result=subprocess.run([exe,'-B','-X','utf8',bridge,*arguments],cwd=cwd,capture_output=True,text=True,encoding='utf-8',timeout=12,env=env)
            value=json.loads(result.stdout)
            if not isinstance(value,dict):raise ValueError('实际 Python 检查返回无效对象')
            if result.returncode or not value.get('ok'):raise ValueError(value.get('detail','实际 Python 检查失败'))
            return value
        runtime=call('--inspect','--config',config,'--quick')
        # Traverse the shared source locally; the selected runtime checks actual
        # UNC readability using grouped launch-critical directory listings.
        editor=directory/'editor_runtime.py'
        if editor.is_file():
            resources=load('dsh_check_resources',editor).resources(directory)
        else:
            # A partial/older copy may lack the editor module; that is reported as a
            # warning instead of failing the whole environment check.
            resources={}
        service=call('--probe',str(cfg.get('sidecarPort') or 8199),'--instance-id',str(cfg.get('instanceId') or ''),'--timeout','3')
        report={'ok':service.get('state') in ('healthy','closed') and not any(resources.values()),'resources':resources,'readOnly':True,'hostPlatform':os.name,'hostWSL':wsl,'runtime':runtime,'sidecar':service,
                'gpuTested':False,'notes':['跨环境链路按所选 Python 实际检查；GPU 推理和其他主机未验证。']}
    except (OSError,ValueError,subprocess.SubprocessError) as ex:
        report={'ok':False,'readOnly':True,'error':str(ex),'gpuTested':False}
    text=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if output:
        try:output.write_text(text,encoding='utf-8')
        except OSError as ex:
            report={'ok':False,'readOnly':True,'error':'无法保存报告：'+str(ex),'gpuTested':False};text=json.dumps(report,ensure_ascii=False)+'\n'
    print(text,end='');return 1 if 'error' in report or report.get('ok') is False else 0


if __name__=='__main__':raise SystemExit(main())
