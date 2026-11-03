#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""分发前契约检查：package.json 里少一个键，宿主会静默跳过整个插件（0.4.0 就是这么炸的）。

用法:
    python tools/check_contract.py
    python tools/check_contract.py --json

退出码 0 = 全部通过；1 = 有 FAIL。
"""
import io
import json
import os
import re
import sys

def _arg_value(name):
    argv = sys.argv
    for i, a in enumerate(argv):
        if a == name and i + 1 < len(argv):
            return argv[i + 1]
        if a.startswith(name + '='):
            return a.split('=', 1)[1]
    return None


# --root 允许检查任意一份插件根（套件根 / 已安装目录都可以）
ROOT = os.path.abspath(_arg_value('--root') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PKG = os.path.join(ROOT, 'plugin', 'package.json')
VER = os.path.join(ROOT, 'VERSION.json')
MAN = os.path.join(ROOT, 'MANIFEST.sha256')

rows = []


def add(name, ok, detail='', level='FAIL'):
    rows.append({'check': name, 'status': 'ok' if ok else level, 'detail': detail})
    return ok


def read_json(path):
    with io.open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    as_json = '--json' in sys.argv

    # ---- package.json 可解析 ----
    try:
        pkg = read_json(PKG)
        add('package.json:parse', True, os.path.basename(PKG))
    except Exception as e:
        add('package.json:parse', False, str(e))
        return report(as_json)

    dsh = pkg.get('dsh') or {}

    # ---- 宿主必需键（缺任何一个都会让插件被跳过或客户端不加载）----
    patch = ((dsh.get('bundle') or {}).get('patch') or '')
    add('dsh.bundle.patch', bool(patch), patch or 'missing -> host skips the bundle')
    if patch:
        p = os.path.join(ROOT, 'plugin', patch.lstrip('./'))
        add('dsh.bundle.patch:file', os.path.exists(p), os.path.relpath(p, ROOT) if os.path.exists(p) else p + ' not found')

    platform = ((dsh.get('client') or {}).get('platform') or '')
    add('dsh.client.platform', platform == 'web', platform or 'missing')

    exports = pkg.get('exports') or {}
    client_export = exports.get('./client')
    add('exports["./client"]', bool(client_export), json.dumps(client_export, ensure_ascii=False) if client_export else 'missing')

    peers = pkg.get('peerDependencies') or {}
    add('peerDependencies', bool(peers.get('@deepseek-ai/cordis')),
        ', '.join(sorted(peers.keys())) if peers else 'missing')

    main = pkg.get('main') or ''
    add('main', bool(main) and os.path.exists(os.path.join(ROOT, 'plugin', main)),
        main or 'missing')

    files = pkg.get('files') or []

    def whitelisted(need):
        """files 支持目录形式（'lib/' 覆盖 lib/index.js），也支持精确文件名。"""
        for f in files:
            f = str(f).strip()
            if f == need:
                return True
            if f.endswith('/') and need.startswith(f):
                return True
        return False

    for need in ('lib/index.js', 'lib/client.js', 'expander.py'):
        add('files:' + need, whitelisted(need),
            'covered' if whitelisted(need) else 'not whitelisted')

    # files 里点名了但文件不存在：npm pack 会静默少一件，安装后才表现为功能缺失
    for f in files:
        f = str(f).strip()
        if not f or f.endswith('/'):
            continue
        p = os.path.join(ROOT, 'plugin', f)
        if not os.path.exists(p):
            alt = p + '.example'
            add('files:exists:' + f, os.path.exists(alt),
                ('only %s.example present' % f) if os.path.exists(alt) else 'listed but missing',
                level='WARN')

    # ---- 本地 import 覆盖：files 漏一个 .py = 装完 ModuleNotFoundError（0.7.81 事故）----
    pdir = os.path.join(ROOT, 'plugin')
    if os.path.isdir(pdir):
        mods = {fn[:-3] for fn in os.listdir(pdir) if fn.endswith('.py')}
        deps = {}
        for fn in sorted(os.listdir(pdir)):
            if not fn.endswith('.py'):
                continue
            try:
                text = io.open(os.path.join(pdir, fn), encoding='utf-8').read()
            except Exception:
                continue
            for m in re.finditer(r'^\s*(?:from\s+([A-Za-z_]\w*)\s+import|import\s+([A-Za-z_]\w*))', text, re.M):
                name = m.group(1) or m.group(2)
                if name == fn[:-3]:
                    continue
                if name in mods or name.startswith('sidecar_'):
                    deps.setdefault(fn, set()).add(name)
        absent = sorted({d for s in deps.values() for d in s
                         if not os.path.isfile(os.path.join(pdir, d + '.py'))})
        add('files:local-module-exists', not absent,
            'covered' if not absent else ('import 了但文件不存在: ' + ', '.join(x + '.py' for x in absent)))
        miss = sorted({d for s in deps.values() for d in s if not whitelisted(d + '.py')})
        add('files:local-imports', not miss,
            ('%d 个 py 的本地依赖全部在白名单' % len(mods)) if not miss
            else ('import 了但 files 没列: ' + ', '.join(x + '.py' for x in miss)))
        loose = [fn for fn in sorted(os.listdir(pdir))
                 if fn.endswith('.py') and not whitelisted(fn)]
        add('files:all-sidecar-py', not loose,
            'covered' if not loose else ('未进白名单: ' + ', '.join(loose)))

    # 已经不再分发的旧包名/私有标记
    add('name:public', not str(pkg.get('name', '')).startswith('@local/'), str(pkg.get('name')))
    add('private:false', pkg.get('private') is not True, 'private=true blocks distribution')

    # ---- 版本一致 ----
    if os.path.exists(VER):
        try:
            ver = read_json(VER)
            pv = pkg.get('version')
            cv = ver.get('components', {}).get('plugin', {}).get('version')
            add('version:match', pv == cv, 'package %s vs VERSION %s' % (pv, cv))
            _bv = ver.get('version') or ver.get('bundleVersion')
            add('version:single-line', bool(_bv) and _bv == cv,
                '%s（单线：须等于 package 版本）' % _bv)
        except Exception as e:
            add('VERSION.json', False, str(e))
    else:
        add('VERSION.json', True, 'not present (installed copy)', level='WARN')

    # ---- MANIFEST：必须按 UTF-8 读（含中文路径），否则会误报缺文件 ----
    if os.path.exists(MAN):
        try:
            with io.open(MAN, 'r', encoding='utf-8') as f:
                lines = f.read().split('\n')
            import hashlib
            ok_n = bad_n = miss_n = 0
            bad = []
            for line in lines:
                line = line.strip()
                if not line or len(line) < 66:
                    continue
                digest, rel = line.split(None, 1)
                rel = rel.lstrip('*').strip()
                p = os.path.join(ROOT, rel)
                if not os.path.exists(p):
                    miss_n += 1
                    bad.append('missing ' + rel)
                    continue
                h = hashlib.sha256()
                with open(p, 'rb') as fp:
                    for chunk in iter(lambda: fp.read(1 << 20), b''):
                        h.update(chunk)
                if h.hexdigest().lower() == digest.lower():
                    ok_n += 1
                else:
                    bad_n += 1
                    bad.append('hash ' + rel)
            add('MANIFEST', bad_n == 0 and miss_n == 0,
                '%d ok / %d bad / %d missing' % (ok_n, bad_n, miss_n) + ((' | ' + '; '.join(bad[:5])) if bad else ''))
        except Exception as e:
            add('MANIFEST', False, 'read failed: %s' % e)
    else:
        add('MANIFEST', True, 'not present (skipped)', level='WARN')

    # ---- 套件层：技能随包（含词库章节）+ 安装脚本 + MANIFEST 覆盖 ----
    skill = os.path.join(ROOT, 'skills', 'comfyui-cards', 'SKILL.md')
    if os.path.isfile(skill):
        stxt = io.open(skill, encoding='utf-8').read()
        add('skills:comfyui-cards', True, '%d 字符' % len(stxt))
        add('skills:front-matter', stxt.startswith('---\n') and 'name: "comfyui-cards"' in stxt
            and 'whenToUse:' in stxt, 'yaml 头三键')
        add('skills:dict-section', ('## 18.' in stxt) and ('USER.capPol' in stxt),
            '词库小卡片章节（§18 + capPol）')
        add('skills:trainer-provenance', ('获取方式（2026-10-22 实测核对' in stxt)
            and ('github.com/kohya-ss/sd-scripts' in stxt),
            '§11 训练脚本出处（上游仓 + 实测 sha）')
        add('skills:card-disk-version', ('0.7.47' in stxt) and ('fromDisk' in stxt),
            '§1.1 角色卡磁盘同步的版本差说明')
    else:
        add('skills:comfyui-cards', False, 'missing skills/comfyui-cards/SKILL.md')
    sdir = os.path.join(ROOT, 'skills', 'comfyui-cards', 'scripts')
    if os.path.isdir(sdir):
        names = sorted(os.listdir(sdir))
        need = ['README.md', 'dataset-character.toml', 'dataset-lllite.toml', 'make-lora-sheet-full.py',
                'make-lora-sheet.py', 'style_check.py', 'train.ps1']
        miss2 = [n for n in need if n not in names]
        add('skills:scripts', not miss2,
            ('%d 个文件（训练/评测脚本随包）' % len(names)) if not miss2 else ('缺 ' + ', '.join(miss2)))
        tp = os.path.join(sdir, 'train.ps1')
        if os.path.isfile(tp):
            raw = open(tp, 'rb').read()
            add('skills:train.ps1-ascii', all(b < 128 for b in raw) and raw[:3] != b'\xef\xbb\xbf',
                '%d 字节，纯 ASCII 无 BOM' % len(raw))
    else:
        add('skills:scripts', False, 'missing skills/comfyui-cards/scripts/')
    for rel in ('install/install-ai.ps1', 'install/verify.ps1'):
        p2 = os.path.join(ROOT, rel.replace('/', os.sep))
        add('install:' + os.path.basename(rel), os.path.isfile(p2), rel)
    if os.path.isfile(MAN):
        mtext = io.open(MAN, encoding='utf-8').read()
        add('MANIFEST:covers-skills', 'skills/comfyui-cards/SKILL.md' in mtext, '')
        add('MANIFEST:covers-install', 'install/install-ai.ps1' in mtext, '')

    return report(as_json)


def report(as_json):
    fails = [r for r in rows if r['status'] == 'FAIL']
    if as_json:
        print(json.dumps({'ok': not fails, 'fails': len(fails), 'checks': rows}, ensure_ascii=False, indent=2))
    else:
        for r in rows:
            print('[%-4s] %-26s %s' % (r['status'], r['check'], r['detail']))
        print('')
        print('RESULT: %s (%d checks, %d FAIL)' % ('PASS' if not fails else 'FAIL', len(rows), len(fails)))
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(main())
