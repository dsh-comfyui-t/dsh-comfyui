#!/usr/bin/env python3
"""Rebuild current single-file DSH browser bundle from its 16 source modules.

Usage: python tools/build_client.py --check    (read-only verification)
       python tools/build_client.py            (rewrite bundle)

Does not need dependencies and does not rewrite any of the original source files.
"""
from pathlib import Path
import argparse
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
CLIENT=ROOT/'plugin'/'lib'/'client.js'
MARKER=re.compile(r"^\t\t// ===== (.*?) =====[ \t]*$", re.M)
EXPORT=re.compile(r'^([ \t]*)export\s+(?:default\s+)?')
TAIL='\n\t\texports.apply = apply;'

def render():
    old=CLIENT.read_text('utf-8')
    marks=list(MARKER.finditer(old))
    if len(marks)!=16 or not marks[0].group(1).endswith('number_input.js') or marks[-1].group(1)!='app.js':
        raise ValueError('Unexpected client.js module header sequence; refusing to rewrite')
    tail_at=old.find(TAIL,marks[-1].end())
    if tail_at<0:raise ValueError('No client export trailer; refusing to rewrite')
    out=[old[:marks[0].start()]]
    for i, mark in enumerate(marks):
        name=mark.group(1)
        rel=Path('plugin/scene3d/number_input.js') if name=='../scene3d/number_input.js' else Path('plugin')/'lib'/name
        path=(ROOT/rel).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():raise ValueError(f'Missing or invalid source file {rel}')
        code=path.read_text('utf-8').rstrip('\n')
        lines=[EXPORT.sub(r'\1',line) for line in code.split('\n')]
        body='\n'.join('\t\t'+line for line in lines)
        # The last module has no blank line before the export trailer.
        extra='\n\n' if i<len(marks)-1 else ''
        out.append(mark.group(0)+'\n'+body+extra)
    out.append(old[tail_at:])
    return old, ''.join(out)

def _write_bundle(text):
    # Keep the CRLF/LF style the bundle already uses so a rebuild on Linux/WSL
    # does not rewrite every line of a Windows-maintained file.
    crlf=b'\r\n' in CLIENT.read_bytes()
    data=text.encode('utf-8')
    CLIENT.write_bytes(data.replace(b'\n',b'\r\n') if crlf else data)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--check',action='store_true')
    args=ap.parse_args()
    old,new=render()
    if args.check:
        if new!=old:
            print('client.js does not match its source modules')
            return 1
        print('client.js matches all source modules')
        return 0
    if new!=old:
        _write_bundle(new)
        print('Rebuilt client.js')
    else:print('client.js unchanged')
    # DSH 0.2.1 resolves a local plugin's client as <pkg>/lib/<exports['./client']>,
    # i.e. lib/lib/client.js; DSH 0.2.2 resolves it as <pkg>/<exports>. Keep a copy
    # at the nested path so one package works on both host versions.
    nested=CLIENT.parent/'lib'
    nested.mkdir(exist_ok=True)
    (nested/'client.js').write_bytes(CLIENT.read_bytes())
    print('Synced lib/lib/client.js (0.2.1 compatibility path)')
    return 0
if __name__=='__main__':sys.exit(main())
