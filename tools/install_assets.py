#!/usr/bin/env python3
"""Download and unpack release assets (3D models/fonts, vocabulary).

Runs from the installed plugin root (or from plugin-src/tools). Assets are
declared in assets.json; each entry names a zip, its sha256 and the directory
it unpacks into. Failures are reported but never abort the plugin install: the
installer prints a retry hint and the plugin still works without the assets.

Network access is required on first install (about 528 MB). Re-running is safe:
an entry whose marker matches the manifest sha256 is skipped.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import urllib.request
import zipfile

DEFAULT_MANIFEST = 'assets.json'
CHUNK = 1024 * 1024


def log(message):
    print(message, flush=True)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        while True:
            chunk = stream.read(CHUNK)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def marker_path(root, entry):
    return root / entry['target'] / '.installed.json'


def installed_ok(root, entry):
    marker = marker_path(root, entry)
    if not marker.is_file():
        return False
    try:
        data = json.loads(marker.read_text('utf-8'))
    except (OSError, ValueError):
        return False
    return (data.get('sha256') == entry.get('sha256')
            and int(data.get('version') or 0) == int(entry.get('version') or 1))


def asset_url(manifest, entry):
    if entry.get('url'):
        return entry['url']
    base = manifest.get('base') or ''
    tag = (manifest.get('tag') or '').strip('/')
    if not base or not entry.get('file'):
        return ''
    return base.rstrip('/') + ('/' + tag if tag else '') + '/' + entry['file']


def download(url, dest, timeout=60):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'dsh-comfyui-console-installer/1.0',
        'Accept': 'application/octet-stream',
    })
    started = time.time()
    with urllib.request.urlopen(request, timeout=timeout) as response, open(dest, 'wb') as out:
        total = int(response.headers.get('Content-Length') or 0)
        got = 0
        while True:
            chunk = response.read(CHUNK)
            if not chunk:
                break
            out.write(chunk)
            got += len(chunk)
            elapsed = max(0.05, time.time() - started)
            if total:
                percent = got * 100 // total
                sys.stdout.write('\r  %d/%d MB (%d%%) %.1f MB/s   ' % (
                    got // CHUNK, total // CHUNK, percent, got / elapsed / CHUNK))
            else:
                sys.stdout.write('\r  %d MB %.1f MB/s   ' % (got // CHUNK, got / elapsed / CHUNK))
            sys.stdout.flush()
        if total:
            sys.stdout.write('\n')
    return dest.stat().st_size if dest.exists() else 0


def safe_extract(zip_path, target):
    target.mkdir(parents=True, exist_ok=True)
    root = target.resolve()
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            name = info.filename
            if name.startswith('/') or name.startswith('\\'):
                raise ValueError('压缩包包含绝对路径：' + name)
            if '..' in Path(name).parts:
                raise ValueError('压缩包包含越界路径：' + name)
            destination = (target / name).resolve()
            if destination != root and root not in destination.parents:
                raise ValueError('压缩包包含越界路径：' + name)
        archive.extractall(target)


def install_entry(root, manifest, entry, retries, dry_run):
    entry_id = entry.get('id') or entry.get('file') or '?'
    target = root / entry['target']
    if installed_ok(root, entry):
        log('跳过 %s：已安装' % entry_id)
        return True
    url = asset_url(manifest, entry)
    if not url or not entry.get('sha256'):
        log('跳过 %s：清单缺少 url/sha256（发布前先运行 tools/pack_assets.py）' % entry_id)
        return False
    size_mb = int(entry.get('size') or 0) / 1048576
    if dry_run:
        log('[dry-run] %s ← %s (%.1f MB) → %s' % (entry_id, url, size_mb, target))
        return True
    log('下载 %s (%.1f MB)…' % (entry_id, size_mb))
    last_error = None
    for attempt in range(1, retries + 1):
        temp = None
        try:
            handle, temp_name = tempfile.mkstemp(prefix='dsh-asset-', suffix='.zip')
            os.close(handle)
            temp = Path(temp_name)
            download(url, temp)
            actual = sha256_file(temp)
            expected = str(entry['sha256']).lower()
            if actual != expected:
                raise ValueError('sha256 不匹配：期望 %s… 实际 %s…' % (expected[:12], actual[:12]))
            safe_extract(temp, target)
            marker = marker_path(root, entry)
            marker.parent.mkdir(parents=True, exist_ok=True)
            marker.write_text(json.dumps({
                'id': entry_id,
                'sha256': expected,
                'version': int(entry.get('version') or 1),
                'installedAt': time.time(),
            }, ensure_ascii=False), 'utf-8')
            log('完成 %s → %s' % (entry_id, target))
            last_error = None
            break
        except Exception as error:  # noqa: BLE001 - report and retry any transport/zip error
            last_error = error
            log('失败 %s（第 %d/%d 次）：%s' % (entry_id, attempt, retries, error))
            if attempt < retries:
                time.sleep(min(6, attempt * 2))
        finally:
            if temp and temp.exists():
                try:
                    temp.unlink()
                except OSError:
                    pass
    return last_error is None


def main():
    parser = argparse.ArgumentParser(description='下载并解包插件发布资产')
    parser.add_argument('--root', default=str(Path(__file__).resolve().parents[1]),
                        help='插件根目录（含 assets.json），默认脚本上一级')
    parser.add_argument('--manifest', default='', help='清单路径，默认 <root>/assets.json')
    parser.add_argument('--only', default='', help='只处理这些 id（逗号分隔）')
    parser.add_argument('--retries', type=int, default=3)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--strict', action='store_true', help='有失败时返回非 0')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    manifest_path = Path(args.manifest) if args.manifest else root / DEFAULT_MANIFEST
    if not manifest_path.is_file():
        log('找不到资产清单：%s' % manifest_path)
        return 0 if not args.strict else 2
    try:
        manifest = json.loads(manifest_path.read_text('utf-8-sig'))
    except ValueError as error:
        log('资产清单格式错误：%s' % error)
        return 0 if not args.strict else 2
    entries = manifest.get('assets')
    if not isinstance(entries, list) or not entries:
        log('资产清单为空，跳过')
        return 0

    only = {item.strip() for item in (args.only or '').split(',') if item.strip()}
    log('资产清单：%s（%d 项）' % (manifest_path, len(entries)))
    results = []
    for entry in entries:
        if not isinstance(entry, dict) or not entry.get('target'):
            log('跳过非法条目：%r' % (entry,))
            results.append(False)
            continue
        if only and (entry.get('id') or '') not in only:
            continue
        results.append(install_entry(root, manifest, entry, max(1, args.retries), args.dry_run))

    failed = results.count(False)
    if failed:
        log('')
        log('有 %d 项资产未安装。插件主体可用；联网后重新运行安装器或本脚本即可补齐。' % failed)
        return 1 if args.strict else 0
    log('（dry-run，未下载）' if args.dry_run else '全部资产已就绪')
    return 0


if __name__ == '__main__':
    sys.exit(main())
