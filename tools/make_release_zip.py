# -*- coding: utf-8 -*-
"""make_release_zip.py —— 按 MANIFEST.sha256 打成品包。

包内顶层目录 dsh-comfy-cards-next-<version>/，清单逐条打入 + 清单自身。
"""
import io, os, sys, json, zipfile, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = json.load(io.open(os.path.join(ROOT, 'VERSION.json'), encoding='utf-8'))['version']
NAME = 'dsh-comfy-cards-next-%s' % VER

manifest = os.path.join(ROOT, 'MANIFEST.sha256')
items = []
for line in io.open(manifest, encoding='utf-8'):
    line = line.rstrip('\n')
    if not line.strip(): continue
    items.append(line.split('  ', 1)[1])

zip_path = os.path.join(os.path.dirname(ROOT), NAME + '.zip')
missing, added = [], 0
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for relp in items:
        fp = os.path.join(ROOT, relp.replace('/', os.sep))
        if not os.path.isfile(fp):
            missing.append(relp); continue
        z.write(fp, NAME + '/' + relp)
        added += 1
    z.write(manifest, NAME + '/MANIFEST.sha256')
    added += 1

size = os.path.getsize(zip_path)
sha = hashlib.sha256(open(zip_path, 'rb').read()).hexdigest()
with io.open(zip_path + '.sha256', 'w', encoding='utf-8', newline='\n') as f:
    f.write('%s  %s\n' % (sha, os.path.basename(zip_path)))

print('  成品包: %s' % os.path.basename(zip_path))
print('  条目: %d（清单 %d + 清单自身 1）' % (added, len(items)))
print('  大小: %.1f MB' % (size / 1048576.0))
print('  SHA256: %s' % sha)
if missing:
    print('  缺失 %d 项:' % len(missing))
    for m in missing[:10]: print('    ' + m)

# 自检：包内条数与清单对账，并做一次完整性检查
with zipfile.ZipFile(zip_path) as z:
    print('  包内实际条目: %d' % len(z.namelist()))
    bad = z.testzip()
print('  完整性: %s' % ('OK' if bad is None else 'BAD ' + str(bad)))