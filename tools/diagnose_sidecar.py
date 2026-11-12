#!/usr/bin/env python3
"""Read-only diagnostic for this installation's loopback Sidecar.
No process termination or changes to credentials, settings, or services.
"""
from pathlib import Path
import argparse
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('dsh_runtime_bridge',ROOT/'runtime_bridge.py')
bridge=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

def main():
    ap=argparse.ArgumentParser()
    default_config=ROOT/'config.json' if (ROOT/'config.json').is_file() else ROOT/'config.example.json'
    ap.add_argument('--config',default=str(default_config))
    args=ap.parse_args()
    cfg={}
    path=Path(args.config)
    if path.is_file():
        cfg=json.loads(path.read_text('utf-8-sig'))
    port=cfg.get('sidecarPort',8199)
    result=bridge.probe(port,instance_id=cfg.get('instanceId',''),required_api=15,timeout=3.0)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if result['state']=='mismatch':
        print('端口已被占用，但未通过本安装校验。请完整退出 DSH 后再诊断；不要盲目结束其他进程。')
    return 0 if result.get('healthy') else 1
if __name__=='__main__':raise SystemExit(main())
