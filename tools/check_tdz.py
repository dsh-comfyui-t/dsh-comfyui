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
import os
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
        # 行中间的声明（带 ^ 锚定的正则一行只能匹配一次，靠这两条补）
        # 注意：只在含 const/let/var 的行生效，否则 }  , [guide, step 这种依赖数组会被误收
    ]
    decl_at = {}



    _mid_decl = [
        re.compile(r'\[\s*([A-Za-z_$][\w$]*)\s*,'),      # ...[a, setA]
        re.compile(r'(?<![\w$.:\-])([A-Za-z_$][\w$]*)\s*='),  # ...a = ...（排除 a-b= 与 key: a= 这类非声明）
    ]
    for i, ln in enumerate(lines, 1):
        # 一行可能有多个声明，逐个正则 finditer 全量收，不能 break
        for rx in decl_re:
            for m in rx.finditer(ln):
                decl_at.setdefault(m.group(1), i)
        # 行中间的第二、第三个声明（锚定正则一行只能匹配一次）
        # 只在含 const/let/var 的行生效，否则依赖数组 } , [guide, step 会被误收
        if re.search(r'\b(?:const|let|var)\b', ln) and not ln.lstrip().startswith('//'):
            for rx in _mid_decl:
                for m in rx.finditer(ln):
                    decl_at.setdefault(m.group(1), i)

    # 形参解构：只认 `function X({a, b})` / `({a, b}) =>` 这种，不再匹配任意 {...}
    # 必须放在 decl_re 循环之后：否则对象的 {key: v} 会被当成声明，覆盖真正的行号
    _param_re = re.compile(r'\(\s*\{([^}]*)\}\s*\)\s*(?:=>|\{|$)')
    for _ln, _line in enumerate(lines, 1):
        _t = _line.strip()
        if not _t or _t.startswith('//'):
            continue
        if 'function' not in _line and '=>' not in _line:
            continue
        _m = _param_re.search(_line)
        if not _m:
            continue
        for _part in _m.group(1).split(','):
            _nm = _part.split(':')[-1].split('=')[0].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', _nm):
                # 取最小行号：decl_re 循环可能已把同名变量记到更晚的行（如 ...,guide=xxx）
                if _nm not in decl_at or decl_at[_nm] > _ln:
                    decl_at[_nm] = _ln

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
    # 默认查仓库里的 app.js；不要把某人机器的绝对路径写进来
    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    targets = sys.argv[1:] or [
        os.path.join(_root, 'plugin', 'lib', 'app.js'),
    ]
    bad = 0
    for t in targets:
        bad += check(t)
        print()
    sys.exit(1 if bad else 0)
