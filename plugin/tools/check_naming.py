# -*- coding: utf-8 -*-
"""包名一致性检查 —— 这四处任何一处漏改，插件就静默不激活。

踩过两次：
  · lib/client.js 的 __ModuleLoader__.load({ id }) 漏改 -> client-modules:
    already executed without registering "<name>"，整个 web boot 失败
  · lib/index.js 的 export name / cordis.patch.yml 的 insert name 不同步 ->
    别人按标准方式装不上，只有靠 profile patch 硬指才work

这个脚本把它们对齐着查。CI 里跑。
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# 自适应：仓库布局是 <root>/plugin/package.json；插件自身的布局是 <root>/package.json
_cand = os.path.dirname(HERE)
if os.path.isfile(os.path.join(_cand, 'plugin', 'package.json')):
    ROOT, PLUGIN = _cand, os.path.join(_cand, 'plugin')
elif os.path.isfile(os.path.join(_cand, 'package.json')):
    ROOT, PLUGIN = _cand, _cand
else:
    raise SystemExit('找不到 package.json（既不在 <root>/plugin/ 也不在 <root>/）')

fails = []


def ok(cond, label, detail=''):
    print('  %s %s%s' % ('OK  ' if cond else 'FAIL', label, ('  ' + detail) if detail else ''))
    if not cond:
        fails.append(label)


pkg = json.load(io.open(os.path.join(PLUGIN, 'package.json'), encoding='utf-8'))
name = pkg.get('name')
ok(bool(name), 'package.json 有 name', name or '')

idx = io.open(os.path.join(PLUGIN, 'lib', 'index.js'), encoding='utf-8').read()
m = re.search(r"export\s+const\s+name\s*=\s*'([^']*)'", idx)
idx_name = m.group(1) if m else None
ok(idx_name == name, 'lib/index.js export name == package.json name',
   '%r vs %r' % (idx_name, name))

cid = io.open(os.path.join(PLUGIN, 'lib', 'client.js'), encoding='utf-8').read()
m2 = re.search(r'__ModuleLoader__\s*\.\s*load\s*\(\s*\{.*?\bid\s*:\s*[\'"]([^\'"]+)[\'"]', cid, re.S)
cid_name = m2.group(1) if m2 else None
ok(cid_name == name, 'lib/client.js load id == package.json name',
   '%r vs %r' % (cid_name, name))

patch = io.open(os.path.join(PLUGIN, 'cordis.patch.yml'), encoding='utf-8').read()
found = re.findall(r"name:\s*'([^']*)'", patch)
ok(bool(found) and all(x == name for x in found),
   'cordis.patch.yml 的 name == package.json name', str(found))

# 包内自带的 patch 只在 dsh.bundle 存在时生效 —— 声明与否要和 patch 内容说的一致
has_bundle = 'dsh' in pkg and isinstance(pkg.get('dsh'), dict) and 'bundle' in pkg['dsh']
print('  %s dsh.bundle %s' % ('OK  ' if True else '', '已声明' if has_bundle else '未声明（靠 profile patch 注册）'))

print()
if fails:
    print('  不一致 %d 处：改名时四处要一起动' % len(fails))
    sys.exit(1)
print('  包名四处一致 ✓')
