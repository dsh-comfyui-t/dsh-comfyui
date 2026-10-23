#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check_tdz.py — 抓 "useEffect/useMemo 依赖数组引用了后面才声明的 state" 这类 TDZ 崩溃。

为什么需要它
    0.6.0 把 `theme` 加进 `saveLast` 的 useEffect 依赖数组，而那段 effect 写在
    `const [theme, setTheme] = useState(...)` **上面**。依赖数组在渲染时立即求值，
    于是 `ReferenceError: Cannot access 'theme' before initialization`，面板一点开就崩。
    `node --check` 只查语法，这类错误它查不出来。

判定规则（够用且不误报）
    1. 收集组件作用域里的声明行号：`const [x, setX] = ...` 与 `const x = ...`（1–2 个缩进）；
    2. 找到 `useEffect(` / `useMemo(` / `useCallback(` 的依赖数组（紧跟参数列表的那个 `[...]`）；
    3. 依赖数组里的标识符，若声明的行号 **大于** 该 effect 起始行 → TDZ 风险，报错。

用法
    python tools/check_tdz.py plugin/lib/client.js [更多文件...]
    python tools/check_tdz.py --root <套件根>        # 自动扫 plugin/lib/*.js

退出码：0 干净；1 有风险点；2 参数/文件错误。
"""
import io
import os
import re
import sys

DECL_BRACKET = re.compile(r'^(\t{1,2})const\s+\[\s*([A-Za-z0-9_$]+)\s*,')
DECL_PLAIN = re.compile(r'^(\t{1,2})const\s+([A-Za-z0-9_$]+)\s*=')
HOOK = re.compile(r'\b(useEffect|useMemo|useCallback)\s*\(')
DEPS_LINE = re.compile(r'\]\s*[,)]')          # 依赖数组收尾：`])` 或 `], [`
IDENT = re.compile(r'[A-Za-z0-9_$]+')


def collect_decls(lines):
    decls = {}
    for i, line in enumerate(lines, 1):
        m = DECL_BRACKET.match(line) or DECL_PLAIN.match(line)
        if m:
            name = m.group(2)
            decls.setdefault(name, i)          # 只记第一次声明
    return decls


def find_deps(lines, start):
    """从 hook 起始行往后找依赖数组，返回 (文本, 行号)；找不到返回 (None, None)。"""
    depth = 0
    started = False
    for i in range(start - 1, min(start + 60, len(lines))):
        line = lines[i]
        # 依赖数组总是 hook 调用里最后一个 `[` … `]`
        for m in re.finditer(r'\[([^\[\]]*)\]\s*\)', line):
            inner = m.group(1)
            if '*' in inner or inner.strip() == '' or '/*' in inner:
                return inner, i + 1
            if IDENT.findall(inner):
                return inner, i + 1
        if '(' in line:
            started = True
        if started:
            depth += line.count('(') - line.count(')')
        if depth < 0:
            break
    return None, None


STRING = re.compile(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`')
PROP = re.compile(r'\.\s*[A-Za-z0-9_$]+')


def dep_idents(deps):
    """依赖数组里的**自由变量**：去掉字符串字面量与属性访问（`job.status` 不是 `status`）。"""
    t = STRING.sub(' ', deps)
    t = PROP.sub(' ', t)
    return list(dict.fromkeys(IDENT.findall(t)))


def check_file(path):
    lines = io.open(path, encoding='utf-8', errors='replace').read().splitlines()
    decls = collect_decls(lines)
    problems = []
    for i, line in enumerate(lines, 1):
        m = HOOK.search(line)
        if not m:
            continue
        deps, deps_line = find_deps(lines, i)
        if not deps:
            continue
        for name in dep_idents(deps):
            if name in ('true', 'false', 'null', 'undefined', 'NaN'):
                continue
            d = decls.get(name)
            if d and d > i:
                problems.append((i, m.group(1), name, d))
    return problems


def main(argv):
    if '--root' in argv:
        root = argv[argv.index('--root') + 1]
        files = sorted(os.path.join(root, 'plugin', 'lib', f)
                       for f in os.listdir(os.path.join(root, 'plugin', 'lib')) if f.endswith('.js'))
    else:
        files = [a for a in argv[1:] if not a.startswith('-')]
    if not files:
        print('用法: check_tdz.py plugin/lib/client.js | --root <套件根>')
        return 2

    total = 0
    for path in files:
        if not os.path.isfile(path):
            print('  [缺文件] %s' % path)
            return 2
        probs = check_file(path)
        rel = os.path.basename(path)
        if probs:
            total += len(probs)
            for hook_line, hook, name, decl_line in probs:
                print('[TDZ] %s:%d  %s 依赖里的 `%s` 在第 %d 行才声明' % (rel, hook_line, hook, name, decl_line))
        else:
            print('[OK ] %s  %d 行，无依赖数组先用后声明' % (rel, len(io.open(path, encoding='utf-8', errors='replace').read().splitlines())))
    print('合计风险点 %d' % total)
    return 0 if total == 0 else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
