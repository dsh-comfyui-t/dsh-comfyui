# -*- coding: utf-8 -*-
"""gen_manifest.py —— 按分发口径重算 MANIFEST.sha256。

清单来源 = 根文档 + plugin/ + install/ + skills/ + tools/ + scripts/ + .github/
排除本机私人配置、构建备份、Python 缓存、运行日志、临时件。
格式固定两空格：<sha256>  <relative/path>
"""
import io, os, sys, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TOP = ['plugin', 'install', 'skills', 'tools', 'scripts', '.github']
SKIP_DIRS = {'__pycache__', 'node_modules', '.git', '.build-backup', '.bak-old', 'work'}
SKIP_FILES = {'config.json', 'lora来源.json', 'sidecar.err.log', 'debug.log'}
SKIP_RE = ('.bak-', '.prev', '.pyc', '.log')

def rel(p):
    return os.path.relpath(p, ROOT).replace('\\', '/')

def included(name):
    if name in SKIP_FILES: return False
    for s in SKIP_RE:
        if s in name: return False
    return True

entries = []
# 根文档（不含 MANIFEST 自身）
for fn in sorted(os.listdir(ROOT)):
    fp = os.path.join(ROOT, fn)
    if not os.path.isfile(fp): continue
    if fn == 'MANIFEST.sha256': continue
    if not included(fn): continue
    entries.append(fp)

for top in TOP:
    base = os.path.join(ROOT, top)
    if not os.path.isdir(base): continue
    for dp, dns, fns in os.walk(base):
        dns[:] = sorted(d for d in dns if d not in SKIP_DIRS)
        for fn in sorted(fns):
            if not included(fn): continue
            entries.append(os.path.join(dp, fn))

lines = ['%s  %s' % (hashlib.sha256(open(p, 'rb').read()).hexdigest(), rel(p)) for p in entries]
out = os.path.join(ROOT, 'MANIFEST.sha256')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(sorted(lines, key=lambda x: x.split('  ', 1)[1])) + '\n')

print('  MANIFEST.sha256: %d 条' % len(lines))
from collections import Counter
c = Counter(l.split('  ', 1)[1].split('/')[0] if '/' in l.split('  ', 1)[1] else '(根文件)' for l in lines)
for k, v in sorted(c.items(), key=lambda x: -x[1]):
    print('    %-16s %3d' % (k, v))