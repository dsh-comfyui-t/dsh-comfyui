# -*- coding: utf-8 -*-
"""SPEC.md 的执行体。26 条判定，逐条给结论。

用法：
    python tools/check_spec.py                  # 检查 plugin/（仓库布局）
    python tools/check_spec.py <插件目录>        # 检查任意构建产物
    python tools/check_spec.py --json           # 机器可读

退出码 0 = 全过（SKIP 不算失败）。CI 用。
"""
import hashlib
import io
import json
import os
import re
import subprocess
import sys

# ---------- 定位 ----------
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
args = [a for a in sys.argv[1:] if not a.startswith('--')]
AS_JSON = '--json' in sys.argv

if args:
    PLUG = os.path.abspath(args[0])
elif os.path.isdir(os.path.join(ROOT, 'plugin')):
    PLUG = os.path.join(ROOT, 'plugin')
else:
    PLUG = ROOT                      # 直接是插件目录
REPO = ROOT if os.path.isdir(os.path.join(ROOT, 'variants')) else None

RESULTS = []


def rec(code, ok, detail='', skip=False):
    RESULTS.append({'code': code, 'status': 'SKIP' if skip else ('OK' if ok else 'FAIL'),
                    'detail': detail})


def read(p):
    try:
        return io.open(p, encoding='utf-8').read()
    except Exception:
        return ''


def exists(p):
    return os.path.isfile(p)


pkgp = os.path.join(PLUG, 'package.json')
pkg = {}
try:
    pkg = json.load(io.open(pkgp, encoding='utf-8'))
except Exception as e:
    rec('S1', False, 'package.json 读不了: %s' % e)

name = pkg.get('name') or ''
ver = pkg.get('version') or ''
dsh = pkg.get('dsh') or {}

# ================= 身份与版本 =================
rec('S1', bool(name), 'name=%r' % name)
rec('S2', bool(re.match(r'^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$', ver)),
    'version=%r 不含作者/变体字样' % ver)

vp = os.path.join(PLUG, 'VERSION.json')
if exists(vp):
    vj = json.load(io.open(vp, encoding='utf-8'))
    rec('S3', vj.get('bundleVersion') == ver,
        'VERSION.json=%r vs package.json=%r' % (vj.get('bundleVersion'), ver))
else:
    rec('S3', True, '单插件目录无 VERSION.json', skip=True)

VAR_DIR = os.path.join(REPO, 'variants') if REPO else None
variants = []
if VAR_DIR and os.path.isdir(VAR_DIR):
    for f in sorted(os.listdir(VAR_DIR)):
        if f.endswith('.json'):
            try:
                variants.append(json.load(io.open(os.path.join(VAR_DIR, f), encoding='utf-8')))
            except Exception:
                pass

if variants:
    vs = {v.get('version') for v in variants if v.get('version')}
    rec('S4', len(vs) <= 1, '各变体 version: %s' % (sorted(vs) or '未声明'))
else:
    rec('S4', True, '无 variants/ 目录', skip=True)

# ---- S5 四处一致 ----
idx_src = read(os.path.join(PLUG, 'lib', 'index.js'))
cid_src = read(os.path.join(PLUG, 'lib', 'client.js'))
patch_src = read(os.path.join(PLUG, 'cordis.patch.yml'))

m_idx = re.search(r"export\s+const\s+name\s*=\s*'([^']*)'", idx_src)
m_cid = re.search(r'__ModuleLoader__\s*\.\s*load\s*\(\s*\{.*?\bid\s*:\s*[\'"]([^\'"]+)[\'"]',
                  cid_src, re.S)
patch_names = re.findall(r"name:\s*'([^']*)'", patch_src)
places = {
    'package.json': name,
    'lib/index.js': m_idx.group(1) if m_idx else None,
    'lib/client.js': m_cid.group(1) if m_cid else None,
    'cordis.patch.yml': patch_names[0] if patch_names else None,
}
bad = {k: v for k, v in places.items() if v != name}
rec('S5', not bad, '四处=%s' % (bad if bad else '全一致'), )

# ---- S5a build_client --check ----
bc = os.path.join(PLUG, 'tools', 'build_client.py')
if exists(bc):
    r = subprocess.run([sys.executable, bc, '--check'], cwd=PLUG, capture_output=True,
                       text=True, encoding='utf-8', errors='replace')
    rec('S5a', r.returncode == 0, (r.stdout or '').strip().splitlines()[-1] if r.stdout else '')
else:
    rec('S5a', False, 'tools/build_client.py 不存在')

# ================= 官方契约 =================
rec('S6', pkg.get('type') == 'module', 'type=%r' % pkg.get('type'))

exp = pkg.get('exports') or {}


def exp_ok(key, want_suffix):
    val = exp.get(key)
    # 标准 ESM 条件导出：既可以写成字符串，也可以写成 {"default": "..."}
    if isinstance(val, dict):
        val = val.get('default') or val.get('import') or val.get('require')
    if not isinstance(val, str):
        return False, 'exports[%r] 无法解析出路径: %r' % (key, exp.get(key))
    p = os.path.normpath(os.path.join(PLUG, val.lstrip('./')))
    ok = val.endswith(want_suffix) and os.path.isfile(p)
    return ok, 'exports[%r]=%r 存在=%s' % (key, val, os.path.isfile(p))


ok1, d1 = exp_ok('.', 'index.js')
ok2, d2 = exp_ok('./client', 'client.js')
rec('S7', ok1 and ok2, d1 + ' | ' + d2)

rec('S8', (dsh.get('client') or {}).get('platform') == 'web',
    'platform=%r' % (dsh.get('client') or {}).get('platform'))

MINHOST_ALLOWED = {'0.2.0-rc.2', '0.2.0', '0.2.0-rc.1', '0.1.9', '0.1.8'}
rec('S9', dsh.get('minHost') in MINHOST_ALLOWED, 'minHost=%r' % dsh.get('minHost'))

# CONFIG_VERSION 有两种合法写法：
#   a) 字面量  const CONFIG_VERSION = 2          -> 必须等于 dsh.configVersion
#   b) 派生    const CONFIG_VERSION = Number(PKG.dsh.configVersion || 1)
#              -> 从 package.json 反读，天生自洽，恒合规（而且是更优设计）
m_lit = re.search(r'const\s+CONFIG_VERSION\s*=\s*(\d+)\s*;', idx_src)
if m_lit:
    code_cv = int(m_lit.group(1))
    rec('S10', dsh.get('configVersion') == code_cv,
        '字面量 %r vs dsh.configVersion=%r' % (code_cv, dsh.get('configVersion')))
elif re.search(r'CONFIG_VERSION\s*=\s*Number\([^)]*configVersion', idx_src):
    rec('S10', True, '由 package.json 的 dsh.configVersion 派生（单一真源）')
else:
    rec('S10', False, '既不是字面量也不是派生，无法判定')

need = ['name', 'version', 'configVersion']
missing = [n for n in need if not re.search(r'export\s+const\s+' + n + r'\b', idx_src)]
no_apply = not re.search(r'export\s+function\s+apply\s*\(', idx_src)
rec('S11', not missing and not no_apply,
    '缺导出=%s apply=%s' % (missing or '无', '缺' if no_apply else '有'))

rec('S12', places['lib/client.js'] == name, 'load id=%r' % places['lib/client.js'])

# S13 dsh.bundle 或 README 手动步骤
has_bundle = 'bundle' in dsh
bundle_patch = (dsh.get('bundle') or {}).get('patch')
readme = ''
for cand in ('README.md', 'README.MD', os.path.join('plugin', 'README.md')):
    p = os.path.join(REPO or PLUG, cand) if REPO else os.path.join(PLUG, cand)
    if exists(p):
        readme = read(p)
        break
if not readme:
    readme = read(os.path.join(PLUG, 'README.md'))
manual_ok = bool(re.search(r'cordis\.patch\.yml', readme)) and bool(
    re.search(r'comfyui-console', readme))
if has_bundle:
    ok = bool(bundle_patch) and exists(os.path.join(PLUG, bundle_patch.lstrip('./')))
    rec('S13', ok, 'dsh.bundle.patch=%r 存在=%s' % (
        bundle_patch, exists(os.path.join(PLUG, (bundle_patch or '').lstrip('./')))))
else:
    rec('S13', manual_ok,
        '未声明 dsh.bundle → README 必须写手动注册步骤；README 里有 patch 说明=%s' % manual_ok)

# S14 包内不许有的东西
bad_files = []
for root, dirs, files in os.walk(PLUG):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for d in list(dirs):
        if d in ('__pycache__', '.build-backup'):
            bad_files.append(os.path.relpath(os.path.join(root, d), PLUG) + '/')
    for f in files:
        if f == 'config.json' or '.bak-' in f or f.endswith('.pyc'):
            bad_files.append(os.path.relpath(os.path.join(root, f), PLUG))
rec('S14', not bad_files, str(bad_files[:5]) if bad_files else '干净')

# S15 MANIFEST（构建产物里才有）
mp = os.path.join(PLUG, 'MANIFEST.sha256')
if exists(mp):
    mism = []
    n = 0
    for line in read(mp).splitlines():
        if not line.strip():
            continue
        h, rel = line.split('  ', 1)
        fp = os.path.join(PLUG, rel)
        if not exists(fp):
            mism.append((rel, '缺失'))
        elif hashlib.sha256(open(fp, 'rb').read()).hexdigest() != h:
            mism.append((rel, 'hash 不符'))
        n += 1
    rec('S15', not mism, '%d 条，问题: %s' % (n, mism[:3] if mism else '无'))
else:
    rec('S15', True, '源码目录无 MANIFEST（构建产物才需要）', skip=True)

# ================= 变体声明 =================
if not variants:
    for c in ('S16', 'S17', 'S18', 'S19', 'S20'):
        rec(c, True, '无 variants/', skip=True)
else:
    REQUIRED = ['id', 'name', 'label', 'design', 'differs', 'prereq']
    miss = [(v.get('id', '?'), [k for k in REQUIRED if k not in v]) for v in variants]
    miss = [(i, m) for i, m in miss if m]
    rec('S16', not miss, str(miss) if miss else '%d 个变体字段齐' % len(variants))

    names = [v.get('name') for v in variants]
    rec('S17', len(set(names)) == len(names), 'names=%s' % names)

    ndef = sum(1 for v in variants if v.get('default'))
    rec('S18', ndef <= 1, 'default:true 的份数=%d' % ndef)

    design_dir = os.path.join(PLUG, 'lib', 'designs')
    missd = [v.get('design') for v in variants
             if not exists(os.path.join(design_dir, '%s.js' % v.get('design')))]
    rec('S19', not missd, '缺设计文件=%s' % (missd or '无'))

    bad_ex = []
    for v in variants:
        for f in (v.get('excludeFiles') or []):
            if not os.path.exists(os.path.join(PLUG, f.replace('*', ''))):
                bad_ex.append((v.get('id'), f))
    rec('S20', not bad_ex, 'excludeFiles 写错=%s' % (bad_ex or '无'))

# S20a 存档键跨变体一致（源码目录里查）
app_src = read(os.path.join(PLUG, 'lib', 'app.js'))
m_ls = re.search(r'const\s+LS_KEY\s*=\s*"([^"]+)"', app_src)
rec('S20a', bool(m_ls), 'LS_KEY=%r（所有变体必须相同）' % (m_ls.group(1) if m_ls else None))

# ================= 可安装性 =================
rec('S21', 'bootstrapConfig' in idx_src and 'ComfyUI_windows_portable' in idx_src,
    'bootstrapConfig=%s 自动探测=%s' % ('有' if 'bootstrapConfig' in idx_src else '缺',
                                        '有' if 'ComfyUI_windows_portable' in idx_src else '缺'))

PREREQ_CHECKS = {'comfyui-installed', 'python-embed', 'cors-header'}
declared = set()
for v in variants:
    declared |= set(v.get('prereq') or [])
unknown = declared - PREREQ_CHECKS
rec('S22', not unknown, '未实现的 prereq=%s（已实现: %s）' % (unknown or '无', sorted(PREREQ_CHECKS)))

kw = ['minHost', 'ComfyUI']
if (dsh.get('client') or {}).get('platform') == 'web':
    kw.append('cors')
hit = [k for k in kw if k.lower() in readme.lower()]
rec('S23', len(hit) == len(kw), 'README 含 %s / 需 %s' % (hit, kw))

# S24 打包文件名（只在 dist 里查）
rec('S24', True, '构建时校验（dist 文件名需含 version + variant id）', skip=True)

# ================= 输出 =================
if AS_JSON:
    print(json.dumps(RESULTS, ensure_ascii=False, indent=2))
else:
    print('检查目标: %s' % PLUG)
    if REPO:
        print('仓库根  : %s' % REPO)
    print()
    fails = [r for r in RESULTS if r['status'] == 'FAIL']
    skips = [r for r in RESULTS if r['status'] == 'SKIP']
    for r in RESULTS:
        mark = {'OK': 'OK  ', 'FAIL': 'FAIL', 'SKIP': 'SKIP'}[r['status']]
        print('  %s %-5s %s' % (mark, r['code'], r['detail'][:130]))
    print()
    print('  共 %d 条：通过 %d · 失败 %d · 跳过 %d'
          % (len(RESULTS), len(RESULTS) - len(fails) - len(skips), len(fails), len(skips)))
    if fails:
        print('  ' + '✗ 有不合规条款：' + ', '.join(r['code'] for r in fails))
    else:
        print('  ✓ 全部合规')

sys.exit(0 if not any(r['status'] == 'FAIL' for r in RESULTS) else 1)
