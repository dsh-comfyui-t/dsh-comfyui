#!/usr/bin/env node
/**
 * build_client.mjs —— 把 lib/{dict,presets,workflow,dictcard,online_models,app}.js
 * 拼成 lib/client.js。纯 Node 实现，取代 tools/build_client.py（0.7.130）。
 *
 * 为什么换：DSH 客户端插件只认单个 ./client 入口，浏览器里没有文件系统，
 * require() 不能解析同目录文件，所以源码必须拼成一个单文件。原实现用 Python，
 * 而带插件的机器不一定有 Python —— 分发时装包不该被构建工具绑架。
 *
 * 切分依据是 client.js 里的分段注释：
 *     // ==== ... （来自 lib/dict.js）====
 *     ...
 * 标记之前的包装头（window.__ModuleLoader__ 那段）与 app.js 之后的
 * exports.apply / return module.exports 尾巴原样保留。
 *
 * 用法：
 *     node tools/build_client.mjs           重建，自动备份旧 client.js
 *     node tools/build_client.mjs --check   只比对，不一致退 1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(HERE);
const LIB = path.join(PKG, 'lib');
const CLIENT = path.join(LIB, 'client.js');
const IND = '\t\t';
const TAIL_ANCHOR = '\n' + IND + 'exports.apply = apply;';
const MARK_RE = /^\t\t\/\/ =+ [^\n]*来自 lib\/(\w+)\.js[^\n]*$/gm;
const SOURCES = ['dict', 'presets', 'workflow', 'dictcard', 'online_models', 'app'];
const EXPORT_RE = /^[ \t]*export\s+(default\s+)?/;

const rd = (p) => fs.readFileSync(p, 'utf8');
const wr = (p, t) => fs.writeFileSync(p, t, 'utf8');

export function build() {
  const c = rd(CLIENT);
  const marks = [...c.matchAll(MARK_RE)];
  const found = marks.map((m) => m[1]);
  if (found.join(',') !== SOURCES.join(',')) {
    throw new Error('client.js 分段标记不对：[' + found.join(', ') + ']（应为 [' + SOURCES.join(', ') + ']）');
  }
  const head = c.slice(0, marks[0].index);
  const t = c.indexOf(TAIL_ANCHOR, marks[marks.length - 1].index + marks[marks.length - 1][0].length);
  if (t < 0) throw new Error('client.js 找不到 exports.apply 尾巴锚点，拒绝重建');
  const tail = c.slice(t + 1);
  const out = [head];
  marks.forEach((m, i) => {
    const src = rd(path.join(LIB, SOURCES[i] + '.js')).replace(/\n+$/, '');
    const body = src.split('\n').map((ln) => {
      const stripped = ln.replace(EXPORT_RE, '');
      return stripped.trim() ? IND + stripped : '';
    });
    out.push(m[0] + '\n' + body.join('\n') + '\n');
  });
  out.push(tail);
  return { old: c, next: out.join('') };
}

export function checkModuleId() {
  const name = JSON.parse(rd(path.join(PKG, 'package.json'))).name;
  const want = '\tid: "' + name + '",';
  if (!rd(CLIENT).includes(want)) {
    console.log('[FAIL] client.js 模块 id 不是 ' + name + '（应为本包名）');
    return 1;
  }
  console.log('[ok  ] 模块 id = ' + name);
  return 0;
}

function main() {
  const { old, next } = build();
  const check = process.argv.includes('--check');
  if (check) {
    const same = old === next;
    console.log(same ? 'client.js 与源文件一致' : 'client.js 落后于源文件');
    console.log('差异: ' + (next.length - old.length >= 0 ? '+' : '') + (next.length - old.length) + ' 字符');
    return same ? checkModuleId() : 1;
  }
  if (old === next) {
    console.log('已是最新，无需重建');
    return checkModuleId();
  }
  // 备份放包外：放 lib/ 里会被打进发布包（0.5.7 实测漏过一次）
  const BAK = path.join(PKG, '.build-backup');
  fs.mkdirSync(BAK, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6}).*/, '$1-$2');
  const bak = path.join(BAK, 'client.js.bak-' + stamp);
  fs.copyFileSync(CLIENT, bak);
  wr(CLIENT, next);
  console.log('重建完成: ' + old.length + ' -> ' + next.length + ' 字符  备份 ' + path.basename(bak));
  return checkModuleId();
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}