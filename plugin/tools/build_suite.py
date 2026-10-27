# -*- coding: utf-8 -*-
"""套件打包器 —— 白名单制。

为什么不用 `Compress-Archive *`：0.5.3 曾把 `plugin/sidecar-token.txt`（43 字节真密钥）
打进包，因为它是"先全打再排除"的黑名单思路，新冒出来的私件只要没进排除表就会泄。

白名单口径：
  套件根：START-HERE-AI.md、安装说明-给人看.md、VERSION.json、LICENSE、MANIFEST.sha256
  plugin/：package.json.files 里列出的每一项（目录则整目录递归）
  skills/：整目录
另外支持一个可选的 install/ 目录（套件安装脚本）。

打包后强制断言：包内不得含 sidecar-token.txt / config.json / lora来源.json（真件）/ *.pyc / *.bak* / .git。

用法：
  python tools/build_suite.py --suite <套件根> --out <输出目录> [--name 绘图台双卡套件-1.1.7-2026-10-21]
  python tools/build_suite.py --suite <套件根> --out <输出目录> --check    # 只校验不打包
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
import zipfile

ROOT_DOCS = ['START-HERE-AI.md', '安装说明-给人看.md', 'VERSION.json', 'LICENSE']
FORBIDDEN_SUFFIX = ('.pyc', '.bak', '.orig', '.rej')
FORBIDDEN_NAME = {'sidecar-token.txt', 'config.json', 'lora来源.json'}
FORBIDDEN_PART = ('__pycache__', '.git', 'node_modules', '.pytest_cache')


def die(msg):
    print('[FAIL] ' + msg)
    sys.exit(1)


def relfiles(base, skip=FORBIDDEN_PART):
    """递归列出 base 下所有文件（相对路径，正斜杠）。"""
    out = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fn in filenames:
            p = os.path.join(dirpath, fn)
            out.append(os.path.relpath(p, base).replace('\\', '/'))
    return sorted(out)


def local_imports(plug):
    """扫 plugin/*.py 的「同目录本地模块」依赖。

    白名单制打包只按 package.json files 收件 —— files 里少写一个 .py，
    装完就是启动即 ModuleNotFoundError（0.7.81 实际事故：sidecar_dirs.py
    与 sidecar_loras.py 都漏了，expander.py 第 129 行直接崩）。
    """
    mods = {fn[:-3] for fn in os.listdir(plug) if fn.endswith('.py')}
    deps = {}
    for fn in sorted(os.listdir(plug)):
        if not fn.endswith('.py'):
            continue
        try:
            text = io.open(os.path.join(plug, fn), encoding='utf-8').read()
        except Exception:
            continue
        for m in re.finditer(r'^\s*(?:from\s+([A-Za-z_]\w*)\s+import|import\s+([A-Za-z_]\w*))', text, re.M):
            name = m.group(1) or m.group(2)
            if name == fn[:-3]:
                continue
            # sidecar_* 前缀一律算本地依赖 —— 文件被漏掉时正好靠这条抓出来
            if name in mods or name.startswith('sidecar_'):
                deps.setdefault(fn, set()).add(name)
    return deps


def expand(items, plug):
    """把白名单条目展开成实际文件（目录递归）。"""
    files = []
    for it in items:
        p = os.path.join(plug, it.rstrip('/'))
        if os.path.isdir(p):
            sub = it.strip('/')
            files.extend('plugin/' + sub + '/' + r for r in relfiles(p))
        elif os.path.isfile(p):
            files.append('plugin/' + it.rstrip('/'))
        else:
            die('白名单条目不存在：plugin/%s' % it)
    return files


def forbidden(rel):
    name = rel.rsplit('/', 1)[-1]
    if name in FORBIDDEN_NAME:
        return True
    # '.bak' 带时间戳时（client.js.bak-20261021-175203）不以 .bak 结尾，所以按子串判
    if '.bak' in name or '.orig' in name or '.rej' in name:
        return True
    if name.endswith('.pyc'):
        return True
    return any(part in rel.split('/') for part in FORBIDDEN_PART)


def sha256(p):
    h = hashlib.sha256()
    with io.open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--suite', required=True)
    ap.add_argument('--out', default='')
    ap.add_argument('--name', default='')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()

    if not a.check and not a.out:
        die('打包需要 --out（只校验可省略）')
    suite = os.path.abspath(a.suite)
    plug = os.path.join(suite, 'plugin')
    pkg = json.loads(io.open(os.path.join(plug, 'package.json'), encoding='utf-8').read())
    ver = json.loads(io.open(os.path.join(suite, 'VERSION.json'), encoding='utf-8').read())

    if pkg.get('version') != ver['components']['plugin']['version']:
        die('版本不一致：package.json %s vs VERSION.json %s'
            % (pkg.get('version'), ver['components']['plugin']['version']))
    if pkg.get('version') != ver.get('pluginVersion', pkg.get('version')):
        pass  # 兼容老结构：只以 components.plugin.version 为准

    wanted = []
    for d in ROOT_DOCS:
        p = os.path.join(suite, d)
        if not os.path.isfile(p):
            die('套件根缺少白名单文件：' + d)
        wanted.append(d)
    # package.json 自身不在 npm files 里（npm 隐式打包），但手工打包必须显式加，
    # 否则装出来的插件 /version/loaded 为空、契约检查全挂（0.5.7 实测漏过）。
    wanted.append('plugin/package.json')
    wanted.extend(expand(pkg.get('files') or [], plug))
    skill = os.path.join(suite, 'skills')
    if os.path.isdir(skill):
        wanted.extend('skills/' + r for r in relfiles(skill))
    inst = os.path.join(suite, 'install')
    if os.path.isdir(inst):
        wanted.extend('install/' + r for r in relfiles(inst))

    # 白名单漏一个本地模块 = 装完起不来，所以这里先拦一道
    deps = local_imports(plug)
    miss_mod = sorted({d for s in deps.values() for d in s if ('plugin/%s.py' % d) not in wanted})
    if miss_mod:
        die('本地模块被 import 但没进白名单（package.json files）：' + ', '.join(m + '.py' for m in miss_mod))
    notpacked = [fn for fn in sorted(os.listdir(plug))
                 if fn.endswith('.py') and ('plugin/' + fn) not in wanted]
    if notpacked:
        die('plugin 根目录的 .py 没进白名单：' + ', '.join(notpacked))
    print('[OK] import 覆盖：%d 个 py 的本地依赖全部在包内' % len([f for f in os.listdir(plug) if f.endswith('.py')]))

    REQUIRED = ('plugin/package.json', 'plugin/cordis.patch.yml', 'plugin/lib/index.js',
                'plugin/lib/client.js', 'plugin/expander.py', 'VERSION.json', 'LICENSE')
    miss = [r for r in REQUIRED if r not in wanted]
    if miss:
        die('包内缺少必需文件：' + ', '.join(miss))

    bad = [r for r in wanted if forbidden(r)]
    if bad:
        die('白名单里混进了禁用文件：' + ', '.join(bad))

    print('白名单展开：%d 个文件（plugin.files %d 项）' % (len(wanted), len(pkg.get('files') or [])))

    # MANIFEST（相对路径 + 两个空格分隔，sha256sum 兼容）
    lines = []
    for rel in wanted:
        if rel == 'MANIFEST.sha256':
            continue
        full = os.path.join(suite, rel.replace('/', os.sep))
        lines.append('%s  %s' % (sha256(full), rel))
    man = '\n'.join(lines) + '\n'
    if a.check:
        old = ''
        mp = os.path.join(suite, 'MANIFEST.sha256')
        if os.path.isfile(mp):
            old = io.open(mp, encoding='utf-8').read()
        if old != man:
            die('MANIFEST.sha256 与白名单不一致（重跑不带 --check 生成）')
        print('[OK] MANIFEST 与白名单一致（%d 条）' % len(lines))
        return
    io.open(os.path.join(suite, 'MANIFEST.sha256'), 'w', encoding='utf-8', newline='\n').write(man)

    name = a.name or ('绘图台双卡套件-%s-%s' % (ver['bundleVersion'], ver.get('builtAt', '')[:10]))
    os.makedirs(a.out, exist_ok=True)
    zp = os.path.join(a.out, name + '.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in wanted + ['MANIFEST.sha256']:
            z.write(os.path.join(suite, rel.replace('/', os.sep)), name + '/' + rel)

    # 打包后断言：包内不得含私件
    with zipfile.ZipFile(zp) as z:
        names = z.namelist()
    leak = [n for n in names if forbidden(n.split('/', 1)[-1])]
    if leak:
        os.remove(zp)
        die('包内含禁用文件：' + ', '.join(leak))
    print('[OK] %s' % zp)
    print('     %d 条目 / %.1f KB / MANIFEST %d 条' % (len(names), os.path.getsize(zp) / 1024.0, len(lines)))


if __name__ == '__main__':
    main()
