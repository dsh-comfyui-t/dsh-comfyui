# -*- coding: utf-8 -*-
"""VERSION.json 是版本的**单一真源**。改了它，跑这个脚本把版本号同步到别处。

同步目标：
    plugin/package.json        version
    plugin/README.md           里形如 0.6.1 的版本字样（只改第一处 "版本" 行）
    VERSION.json               components.plugin.version / bundleVersion

多人协作时最容易出的问题是「包名 0.6.1、文档写 0.6.0、README 写 0.5.9」，
这个脚本就是防这个的。CI 里有 --check 模式。

用法：
    python tools/sync_version.py           # 写
    python tools/sync_version.py --check   # 只比对，不一致退 1
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VP = os.path.join(ROOT, 'VERSION.json')
PKG = os.path.join(ROOT, 'plugin', 'package.json')

check_only = '--check' in sys.argv

v = json.load(io.open(VP, encoding='utf-8'))
ver = v['bundleVersion']
changes = []

pkg = json.load(io.open(PKG, encoding='utf-8'))
if pkg.get('version') != ver:
    changes.append('plugin/package.json: %s -> %s' % (pkg.get('version'), ver))
    if not check_only:
        pkg['version'] = ver
        io.open(PKG, 'w', encoding='utf-8', newline='\n').write(
            json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

if v.get('components', {}).get('plugin', {}).get('version') != ver:
    changes.append('VERSION.json components.plugin.version 不一致')
    if not check_only:
        v['components']['plugin']['version'] = ver
        io.open(VP, 'w', encoding='utf-8', newline='\n').write(
            json.dumps(v, ensure_ascii=False, indent=2) + '\n')

if changes:
    print('版本不一致:')
    for c in changes:
        print('  ' + c)
    if check_only:
        sys.exit(1)
    print('已同步到 %s' % ver)
else:
    print('版本一致: %s' % ver)
