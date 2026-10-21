# -*- coding: utf-8 -*-
"""build_client.py —— 从 lib/{dict,presets,workflow,app}.js 拼接 lib/client.js

背景：DSH 客户端插件只认一个 ./client 导出，浏览器里没有文件系统，
require() 不能解析同目录文件，所以四个源文件必须拼成一个单文件。

切分依据是 client.js 里的四行分段注释：
    // ==== ... （来自 lib/dict.js）====
    // ==== ... （来自 lib/presets.js）====
    // ==== ... （来自 lib/workflow.js）====
    // ==== ... （来自 lib/app.js）====
标记之前的包装头（window.__ModuleLoader__ 那段）和 app.js 之后的
exports.apply / return module.exports 尾巴都原样保留。

用法：
    python plugin/tools/build_client.py            # 重建，自动备份旧 client.js
    python plugin/tools/build_client.py --check     # 只比对，不一致退 1
"""
import io, os, re, shutil, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(os.path.dirname(HERE), 'lib')
CLIENT = os.path.join(LIB, 'client.js')
IND = '\t\t'
TAIL_ANCHOR = '\n' + IND + 'exports.apply = apply;'
MARK_RE = re.compile(r'(?m)^' + IND + r'// =+ [^\n]*\u6765\u81ea lib/(\w+)\.js[^\n]*$')
SOURCES = ('dict', 'presets', 'workflow', 'app')
EXPORT_RE = re.compile(r'^[ \t]*export\s+(default\s+)?')


def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def build():
    c = read(CLIENT)
    marks = list(MARK_RE.finditer(c))
    found = [m.group(1) for m in marks]
    if found != list(SOURCES):
        raise SystemExit('client.js 分段标记不对：%r（应为 %r）' % (found, list(SOURCES)))
    head = c[:marks[0].start()]
    t = c.find(TAIL_ANCHOR, marks[-1].end())
    if t < 0:
        raise SystemExit('client.js 找不到 exports.apply 尾巴锚点，拒绝重建')
    tail = c[t + 1:]
    out = [head]
    for m, name in zip(marks, SOURCES):
        src = read(os.path.join(LIB, name + '.js')).rstrip('\n')
        body = []
        for ln in src.split('\n'):
            ln = EXPORT_RE.sub('', ln)          # 源文件是 ESM，拼进工厂时要去掉 export
            body.append('' if not ln.strip() else IND + ln)
        out.append(m.group(0) + '\n' + '\n'.join(body) + '\n')
    out.append(tail)
    return c, ''.join(out)


def main():
    c, new = build()
    if '--check' in sys.argv:
        same = (c == new)
        print('client.js 与源文件一致' if same else 'client.js 落后于源文件')
        print('差异: %+d 字符' % (len(new) - len(c)))
        return 0 if same else 1
    if c == new:
        print('已是最新，无需重建')
        return 0
    # 备份放在包外：放 lib/ 里会被打进发布包（0.5.7 实测漏过一次）
    BAK_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.build-backup')
    os.makedirs(BAK_DIR, exist_ok=True)
    bak = os.path.join(BAK_DIR, 'client.js.bak-' + time.strftime('%Y%m%d-%H%M%S'))
    shutil.copy2(CLIENT, bak)
    with io.open(CLIENT, 'w', encoding='utf-8', newline='') as f:
        f.write(new)
    print('重建完成: %d -> %d 字符  备份 %s' % (len(c), len(new), os.path.basename(bak)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
