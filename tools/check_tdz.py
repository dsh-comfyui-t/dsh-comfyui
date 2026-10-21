# -*- coding: utf-8 -*-
"""检查 hook 依赖数组里的变量是否都声明在使用之前。

为什么只查依赖数组：
    `React.useEffect(() => {...}, [a, b])` 里，**依赖数组在渲染时立即求值**，
    而 effect 函数体是渲染后才跑的。所以只有依赖数组会被 TDZ 打死。

2026-10-21 实际踩到：
    我把 `theme` 加进了 saveLast 的依赖数组，而 `const [theme, setTheme]`
    在它下面 20 行。组件每次渲染都抛
    `ReferenceError: Cannot access 'theme' before initialization`，面板直接崩。
    node --check 语法完全合法，查不出来。

用法：
    python tools/check_tdz.py <app.js>
"""
import io
import re
import sys


def check(path):
    src = io.open(path, encoding='utf-8').read()
    lines = src.splitlines()

    # 收集所有声明：名字 -> 行号（同名取最早）
    decl_re = [
        re.compile(r'^\s*(?:const|let|var)\s+\[\s*([A-Za-z_$][\w$]*)\s*,'),        # const [a, setA]
        re.compile(r'^\s*(?:const|let|var)\s+\[\s*([A-Za-z_$][\w$]*)\s*\]'),        # const [a]
        re.compile(r'^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*='),             # const a =
        re.compile(r'^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*,'),             # const a,
        re.compile(r'^\s*function\s+([A-Za-z_$][\w$]*)\s*\('),                     # function a(
        re.compile(r'^\s*import\s+\{?[^}]*\b([A-Za-z_$][\w$]*)\b'),                # import a
        re.compile(r'^\s*export\s+(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)'),
    ]
    decl_at = {}
    for i, ln in enumerate(lines, 1):
        for rx in decl_re:
            m = rx.match(ln)
            if m:
                name = m.group(1)
                decl_at.setdefault(name, i)
                break

    # 找 useEffect / useMemo / useCallback 的依赖数组
    #   形如  }, [a, b, c]);
    dep_re = re.compile(r'^\s*\}\s*,\s*\[([^\]]*)\]\s*\)\s*;')
    # 往回找对应的 hook 起始行
    problems = []
    hooks = []
    for i, ln in enumerate(lines, 1):
        if 'React.useEffect(' in ln or 'React.useMemo(' in ln or 'React.useCallback(' in ln:
            hooks.append(i)

    for i, ln in enumerate(lines, 1):
        m = dep_re.match(ln)
        if not m:
            continue
        deps_raw = m.group(1).strip()
        if not deps_raw:
            continue
        deps = [d.strip() for d in deps_raw.split(',') if d.strip()]
        # 对应的 hook 起始行：小于 i 的最后一个
        start = max([h for h in hooks if h < i], default=0)
        for d in deps:
            if not re.match(r'^[A-Za-z_$][\w$]*$', d):
                continue
            dl = decl_at.get(d)
            if dl is None:
                problems.append((i, start, d, None))
            elif dl > start:
                problems.append((i, start, d, dl))

    print('=== %s ===' % path)
    print('  声明了 %d 个名字，%d 个 hook，%d 个依赖数组有问题'
          % (len(decl_at), len(hooks), len(problems)))
    if not problems:
        print('  ✓ 没有 TDZ 风险')
        return 0
    for dep_line, hook_line, name, decl_line in problems:
        if decl_line is None:
            print('  ✗ L%-5d 依赖里的 %-20s 找不到声明' % (dep_line, name))
        else:
            print('  ✗ L%-5d 依赖里的 %-20s 声明在 L%d（hook 在 L%d，晚了）'
                  % (dep_line, name, decl_line, hook_line))
    return len(problems)


if __name__ == '__main__':
    targets = sys.argv[1:] or [
        r'E:\aqca\profiles\node_modules\@local\dsh-comfyui-console\lib\app.js',
        r'E:\aqca\work\comfyui\build\0.6.0\plugin\lib\app.js',
    ]
    bad = 0
    for t in targets:
        bad += check(t)
        print()
    sys.exit(1 if bad else 0)
