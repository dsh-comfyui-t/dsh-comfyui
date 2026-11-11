# -*- coding: utf-8 -*-
"""check_size.py —— 规模守卫：拦住"文件 / 函数悄悄长成屎山"。

背景：2026-11-10 把 lib/app.js 从单文件 14,191 行拆成 6 个模块。
拆分只能做一次，之后靠这个脚本守——新代码一旦把某个文件或某个函数
撑过阈值就当场报出来，而不是等半年后又要重拆一遍。

用法：
    python tools/check_size.py            # 报告，超阈值退 1
    python tools/check_size.py --quiet    # 只在超标时输出

阈值：
    单文件  1200 行    （超出说明该按职责再拆）
    单函数   400 行    （超出说明该提子组件 / 拆纯函数）

KNOWN_BIG 里的是拆分时就已经超标的，属于"知道它大、暂时不动"，
不计入失败；新增超标项才退 1。改小一个就从列表里删掉它。
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
LIB = os.path.join(PKG, 'lib')
PY = os.path.join(PKG, 'py')

FILE_LIMIT = 1200
FUNC_LIMIT = 400

# 拆分当天就已经超标的存量，不算回归
KNOWN_BIG = {
    'app-console.js': 'Console() 生成页整体，2026-11-10 拆分时就这么大',
    'app-library.js': 'libTab 词库页 + PANEL 组装，同上',
    'app-preview.js': 'PreviewConsole / OutputInspector，同上',
    'sidecar_aline.py': 'A 线安装/版本/依赖逻辑，待拆',
    'expander.py': '侧车入口与路由聚合，待拆',
}


def js_func_spans(src):
    """返回 [(函数名, 起行, 止行)]。只认行首 function / const X = (...) => { 形态。"""
    out = []
    lines = src.split('\n')
    for i, ln in enumerate(lines):
        m = re.match(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', ln)
        if not m:
            continue
        name = m.group(1)
        depth, j, started = 0, i, False
        while j < len(lines):
            line = lines[j]
            k, n = 0, len(line)
            while k < n:
                ch = line[k]
                if ch == '/' and k + 1 < n and line[k + 1] in '/*':
                    if line[k + 1] == '/':
                        break
                if ch in '\'"`':
                    q, k = ch, k + 1
                    while k < n and line[k] != q:
                        k += 2 if line[k] == '\\' else 1
                elif ch == '{':
                    depth += 1
                    started = True
                elif ch == '}':
                    depth -= 1
                k += 1
            if started and depth <= 0:
                out.append((name, i + 1, j + 1))
                break
            j += 1
    return out


def scan_js():
    rows = []
    for fn in sorted(os.listdir(LIB)):
        if not fn.endswith('.js') or fn == 'client.js' or '.bak' in fn:
            continue
        p = os.path.join(LIB, fn)
        src = io.open(p, encoding='utf-8').read()
        n = src.count('\n') + 1
        rows.append((fn, n, n > FILE_LIMIT and fn not in KNOWN_BIG))
        for name, a, b in js_func_spans(src):
            span = b - a + 1
            if span > FUNC_LIMIT:
                rows.append(('  %s L%d-%d %s()' % (fn, a, b, name), span, False))
    return rows


def scan_py():
    rows = []
    for fn in sorted(os.listdir(PY)):
        if not fn.endswith('.py'):
            continue
        p = os.path.join(PY, fn)
        src = io.open(p, encoding='utf-8').read()
        n = src.count('\n') + 1
        rows.append((fn, n, n > FILE_LIMIT and fn not in KNOWN_BIG))
    return rows


def main():
    quiet = '--quiet' in sys.argv
    rows = scan_js() + scan_py()
    bad = [r for r in rows if r[2]]
    over = [r for r in rows if r[1] > (FUNC_LIMIT if r[0].startswith('  ') else FILE_LIMIT)]
    if not quiet:
        print('文件规模（阈值 %d 行）:' % FILE_LIMIT)
        for name, n, _ in rows:
            if not name.startswith('  '):
                mark = '!!' if name not in KNOWN_BIG and n > FILE_LIMIT else '  '
                known = ' (存量)' if name in KNOWN_BIG else ''
                print('  %s %-22s %5d 行%s' % (mark, name, n, known))
        longfn = [r for r in rows if r[0].startswith('  ')]
        print('函数规模（阈值 %d 行）: %d 个超标' % (FUNC_LIMIT, len(longfn)))
        for name, n, _ in longfn:
            print('     %-46s %5d 行' % (name, n))
    if bad:
        print()
        print('[FAIL] 新增超标 %d 处（不在 KNOWN_BIG 里）:' % len(bad))
        for name, n, _ in bad:
            print('  %s  %d 行' % (name, n))
        return 1
    if not quiet:
        print()
        print('[ok  ] 没有新增超标项')
    return 0


if __name__ == '__main__':
    sys.exit(main())
