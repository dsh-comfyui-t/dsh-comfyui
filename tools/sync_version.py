#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""VERSION.json 是唯一版本源。本脚本把它的版本号同步到所有该出现的地方。

用法:
    python tools/sync_version.py            # 写入（幂等）
    python tools/sync_version.py --check    # 只检查，不一致时 exit 1
    python tools/sync_version.py --json     # 机器可读输出

被同步的位置:
    plugin/package.json          version
    plugin/README.md             vX.Y.Z
    START-HERE-AI.md             **X.Y.Z** / loaded=X.Y.Z / 顶栏 vX.Y.Z / 插件 X.Y.Z
    安装说明-给人看.md             套件版本 X.Y.Z ｜ 插件 X.Y.Z
    VERSION.json                 version 字段自身也写（单线：与 components.plugin.version 同值）

所有写盘均为 UTF-8 无 BOM（PowerShell/Node 侧不允许 BOM）。
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


ROOT = os.path.abspath(_arg_value('--root') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VFILE = os.path.join(ROOT, 'VERSION.json')

SEMVER = r'\d+\.\d+\.\d+'
# 只匹配独立的 x.y.z，避免把 0.4.1 里的 4.1 再替换一次
VER_RE = re.compile(r'(?<![\d.^])' + SEMVER + r'(?![\d.-])')   # ^ 依赖版本、-rc/-beta 后缀都不替换
BUNDLE_RE = re.compile(r'(套件版本\s+)' + SEMVER)


def read(path):
    with io.open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write(path, text):
    # newline='' 防止 Windows 下把 \n 变成 \r\n（保持文件原有换行风格由调用方负责）
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def load_version():
    with io.open(VFILE, 'r', encoding='utf-8') as f:
        v = json.load(f)
    plugin = v['components']['plugin']['version']
    bundle = v.get('version') or v.get('bundleVersion') or plugin  # 单线：version 优先
    return v, plugin, bundle


def targets(plugin_ver, bundle_ver):
    """返回 [(相对路径, 原始文本, 期望文本)]"""
    out = []
    pkg = os.path.join(ROOT, 'plugin', 'package.json')
    out.append((pkg, None, None))  # 占位，单独处理（JSON 结构）

    docs = [
        os.path.join(ROOT, 'plugin', 'README.md'),
        os.path.join(ROOT, 'START-HERE-AI.md'),
        os.path.join(ROOT, u'安装说明-给人看.md'),
    ]
    for p in docs:
        if not os.path.exists(p):
            continue
        raw = read(p)
        new = VER_RE.sub(plugin_ver, raw)
        new = BUNDLE_RE.sub(lambda m: m.group(1) + bundle_ver, new)
        if new != raw:
            out.append((p, raw, new))
        else:
            out.append((p, raw, raw))
    return out


def sync_package(plugin_ver):
    p = os.path.join(ROOT, 'plugin', 'package.json')
    raw = read(p)
    new = re.sub(r'("version"\s*:\s*")[^"]*(")', lambda m: m.group(1) + plugin_ver + m.group(2), raw, count=1)
    return p, raw, new


def main():
    # Windows 控制台默认 GBK，中文路径会显示成乱码（不影响文件内容）
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    check_only = '--check' in sys.argv
    as_json = '--json' in sys.argv

    v, plugin_ver, bundle_ver = load_version()
    jobs = targets(plugin_ver, bundle_ver)
    jobs.insert(0, sync_package(plugin_ver))

    drift = []
    changed = []
    for path, raw, new in jobs:
        if raw is None:  # package.json 占位行不会被走到
            continue
        rel = os.path.relpath(path, ROOT)
        if raw != new:
            drift.append(rel)
            if not check_only:
                write(path, new)
                changed.append(rel)

    # VERSION.json 自身的一致性：package.json 的 version 必须等于 components.plugin.version
    pkg_path = os.path.join(ROOT, 'plugin', 'package.json')
    pkg_ver = None
    try:
        with io.open(pkg_path, 'r', encoding='utf-8') as f:
            pkg_ver = json.load(f).get('version')
    except Exception as e:
        print('FAIL package.json 解析失败: %s' % e)
        return 1

    # 单线（2026-10-23）：VERSION.json 的 version 字段必须等于插件版本
    if not check_only and v.get('version') != plugin_ver:
        v2 = dict(v)
        v2['version'] = plugin_ver
        write(VFILE, json.dumps(v2, ensure_ascii=False, indent=2) + '\n')
        changed.append('VERSION.json')

    result = {
        'version': bundle_ver,
        'pluginVersion': plugin_ver,
        'packageVersion': pkg_ver,
        'drift': drift,
        'changed': changed,
        'consistent': (pkg_ver == plugin_ver and bundle_ver == plugin_ver and not drift),
    }

    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print('VERSION.json: version %s / plugin %s / package.json %s'
              % (bundle_ver, plugin_ver, pkg_ver))
        if drift:
            print('漂移位置 (%d):' % len(drift))
            for d in drift:
                print('  - ' + d)
        else:
            print('全部一致')
        if changed:
            print('已改写: ' + ', '.join(changed))

    if check_only and not result['consistent']:
        return 1
    if pkg_ver != plugin_ver:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
