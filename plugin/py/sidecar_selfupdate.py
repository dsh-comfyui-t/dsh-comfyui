# -*- coding: utf-8 -*-
"""GitHub 新版本检查（只查不装）。

口径：
  · 只看 GitHub Releases（`/releases/latest`，draft / prerelease 不算），没有 Release 就退到 tags
  · 版本按数字段比较，不作字符串序比较（0.10.0 > 0.9.0）
  · 成功结果缓存 6 小时（匿名 GitHub API 限 60 次/小时）；失败缓存 10 分钟，网络断时不反复打
  · 仓库来自 config.updateRepo（形如 owner/repo），可用环境变量 DSH_CARDS_UPDATE_REPO 覆盖
  · 代理取 config.updateProxy，其次 HTTPS_PROXY / HTTP_PROXY
  · 可选 GITHUB_TOKEN：配了就走认证额度（5000 次/小时），也顺带绕开部分网络限制

不做的事：不下载、不解压、不替换文件。升级仍然走 tools/update.ps1 或 dsh plugin。
"""

import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request

API = 'https://api.github.com'
UA = 'dsh-comfy-cards-next-updater'

_OK_TTL = 6 * 3600          # 成功结果缓存 6 小时
_FAIL_TTL = 10 * 60         # 失败缓存 10 分钟

_CACHE = {'at': 0.0, 'ttl': 0, 'data': None, 'repo': ''}


def _cfg():
    """读 config.json（侧车与插件共用一份；读不到就当空配置）。"""
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, '..', 'config.json'), os.path.join(here, 'config.json')):
        try:
            with open(p, encoding='utf-8') as f:
                d = json.load(f)
            if isinstance(d, dict):
                return d
        except Exception:
            continue
    return {}


def _repo_slug():
    env = (os.environ.get('DSH_CARDS_UPDATE_REPO') or '').strip()
    if env:
        return env
    cfg = _cfg()
    v = str(cfg.get('updateRepo') or '').strip()
    return v


def _proxy():
    cfg = _cfg()
    v = str(cfg.get('updateProxy') or '').strip()
    if v:
        return v
    for k in ('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'):
        v = (os.environ.get(k) or '').strip()
        if v:
            return v
    return ''


def _vtuple(s):
    """'0.8.0' / 'v0.8.0' / '0.8.0-rc.2' → 可比较的整数三元组。

    只取 major.minor.patch：预发布后缀（-rc.2 / +build）不参与数字比较，
    否则 '1.0-rc.2' 会算成 (1,0,0,2) 而比 '1.0' 的 (1,0,0) 「大」——反了。
    预发布关系交给 _is_newer 兜底。
    """
    core = re.split(r'[-+]', str(s or '').strip().lstrip('vV'))[0]
    parts = []
    for seg in re.split(r'[._]', core):
        m = re.match(r'^(\d+)', seg)
        parts.append(int(m.group(1)) if m else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def _is_newer(latest, cur):
    """latest 是否比 cur 新。

    数字段不同就按数字比（0.10.0 > 0.9.9）；数字段相同再看预发布：
    1.0 > 1.0-rc.2，反过来 1.0-rc.2 不算比 1.0 新。
    """
    a, b = _vtuple(latest), _vtuple(cur)
    if a != b:
        return a > b
    return ('-' not in str(latest)) and ('-' in str(cur))


def _get(url, timeout=10):
    hdr = {'User-Agent': UA, 'Accept': 'application/vnd.github+json',
           'X-GitHub-Api-Version': '2022-11-28'}
    tok = (os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN') or '').strip()
    if tok:
        hdr['Authorization'] = 'Bearer ' + tok
    req = urllib.request.Request(url, headers=hdr)
    proxy = _proxy()
    if proxy:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({'http': proxy, 'https': proxy}))
        ctx = op.open
    else:
        ctx = urllib.request.urlopen
    with ctx(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def _latest(slug):
    """拿最新版本：优先 Release，其次 tag。返回 (version, url, name, publishedAt, notes, source)。"""
    fixed = slug.strip('/')
    try:
        d = _get('%s/repos/%s/releases/latest' % (API, fixed))
        tag = str(d.get('tag_name') or '').strip()
        if tag:
            return (tag, str(d.get('html_url') or ''), str(d.get('name') or ''),
                    str(d.get('published_at') or ''), str(d.get('body') or '')[:1500], 'release')
    except urllib.error.HTTPError as e:
        # 404 = 这个仓库还没有 Release（常见于刚开的新仓库），退到 tags
        if e.code not in (404, 403):
            raise
    tags = _get('%s/repos/%s/tags?per_page=20' % (API, fixed))
    if isinstance(tags, list) and tags:
        best = None
        for t in tags:
            name = str(t.get('name') or '')
            if not name:
                continue
            if best is None or _vtuple(name) > _vtuple(best):
                best = name
        if best:
            return (best, 'https://github.com/%s/releases' % fixed, '', '', '', 'tag')
    raise RuntimeError('仓库里没有 Release 也没有 tag')


def _current_version():
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        with open(os.path.join(here, '..', 'package.json'), encoding='utf-8') as f:
            return str(json.load(f).get('version') or '')
    except Exception:
        return ''


def check_update(force=False):
    """返回给前端的体检结果。永远 200，用 ok 区分成败。"""
    now = time.time()
    slug = _repo_slug()
    cur = _current_version()

    if not slug:
        return {'ok': False, 'configured': False, 'current': cur,
                'error': '还没配仓库：在 config.json 里加 "updateRepo": "owner/repo"',
                'checkedAt': int(now), 'cached': False}

    if (not force) and str(_cfg().get('updateCheck', True)).strip().lower() in ('false', '0', 'no', 'off'):
        return {'ok': False, 'disabled': True, 'configured': True, 'current': cur,
                'error': 'config.json 里 updateCheck=false，自动检查已关闭（点「立即检查」仍可查）',
                'checkedAt': int(now), 'cached': False}
    if (not force) and _CACHE['data'] is not None and _CACHE['repo'] == slug \
            and (now - _CACHE['at']) < _CACHE['ttl']:
        out = dict(_CACHE['data'])
        out['cached'] = True
        return out

    try:
        tag, url, name, published, notes, source = _latest(slug)
        latest = tag.lstrip('vV')
        has = _is_newer(latest, cur)
        data = {'ok': True, 'configured': True, 'repo': slug, 'current': cur,
                'latest': latest, 'tag': tag, 'hasUpdate': has, 'url': url,
                'name': name, 'publishedAt': published, 'notes': notes,
                'source': source, 'checkedAt': int(now), 'cached': False}
        _CACHE.update({'at': now, 'ttl': _OK_TTL, 'data': data, 'repo': slug})
        return data
    except urllib.error.HTTPError as e:
        msg = 'GitHub 返回 %s' % e.code
        if e.code == 404:
            msg += '（仓库名不对，或者仓库里既没有 Release 也没有 tag）'
        elif e.code == 403:
            msg += '（可能是没配 GITHUB_TOKEN 且匿名额度用完了）'
    except urllib.error.URLError as e:
        msg = '连不上 GitHub：%s' % (getattr(e, 'reason', e),)
    except (ssl.SSLError, OSError) as e:
        msg = '网络错误：%s' % (e,)
    except Exception as e:
        msg = str(e) or e.__class__.__name__

    data = {'ok': False, 'configured': True, 'repo': slug, 'current': cur,
            'error': msg, 'checkedAt': int(now), 'cached': False,
            'hint': '要代理的话在 config.json 加 "updateProxy": "http://127.0.0.1:PORT"'}
    _CACHE.update({'at': now, 'ttl': _FAIL_TTL, 'data': data, 'repo': slug})
    return data
