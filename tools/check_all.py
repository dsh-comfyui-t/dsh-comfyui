# -*- coding: utf-8 -*-
"""一条命令跑全套检查。CI 用它，本地改完也用它。

检查项：
  1. 所有 .js 的 node --check（语法）
  2. 所有 .py 的 py_compile（语法）
  3. lib/client.js 与 lib/{dict,presets,workflow,app}.js 是否一致（build_client --check）
  4. hook 依赖数组的 TDZ（依赖渲染时立即求值，比声明早就是 ReferenceError）
  5. test_theme：主题调色板与 resolveTheme 的单测
  6. test_views：视角 applyView / detectView 的单测

用法：
    python tools/check_all.py
退出码 0 = 全过。
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGIN = os.path.join(ROOT, 'plugin')
TOOLS = os.path.join(ROOT, 'tools')

ok = True


def run(label, cmd, cwd=None, expect_zero=True):
    global ok
    r = subprocess.run(cmd, cwd=cwd or ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    passed = (r.returncode == 0) if expect_zero else True
    print('  %s %s' % ('OK  ' if passed else 'FAIL', label))
    if not passed:
        ok = False
        out = ((r.stdout or '') + (r.stderr or '')).strip()
        for ln in out.splitlines()[-12:]:
            print('       ' + ln)
    return r


def main():
    print('=== 1. JS 语法 ===')
    for f in sorted(os.listdir(os.path.join(PLUGIN, 'lib'))):
        if f.endswith('.js'):
            run(f, ['node', '--check', os.path.join(PLUGIN, 'lib', f)])

    print('=== 2. Python 语法 ===')
    for f in sorted(os.listdir(PLUGIN)):
        if f.endswith('.py'):
            run(f, [sys.executable, '-c',
                    'import py_compile,sys; py_compile.compile(sys.argv[1], doraise=True)',
                    os.path.join(PLUGIN, f)])

    print('=== 3. client.js 与源一致 ===')
    run('build_client --check', [sys.executable, 'tools/build_client.py', '--check'], cwd=PLUGIN)

    print('=== 3b. 包名一致性 ===')
    run('check_naming', [sys.executable, os.path.join(TOOLS, 'check_naming.py')])

    print('=== 4. TDZ ===')
    run('check_tdz', [sys.executable, os.path.join(TOOLS, 'check_tdz.py'),
                      os.path.join(PLUGIN, 'lib', 'app.js')])

    print('=== 5. 主题单测 ===')
    run('test_theme', ['node', os.path.join(TOOLS, 'test_theme.mjs')])

    print('=== 6. 视角单测 ===')
    run('test_views', ['node', os.path.join(TOOLS, 'test_views.mjs')])

    print()
    print('结论:', '全部通过' if ok else '有失败项')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
