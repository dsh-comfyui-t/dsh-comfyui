#!/usr/bin/env python3
"""Build release asset zips and write assets.json for install_assets.py.

Usage (from plugin-src):
  python3 tools/pack_assets.py --out dist/assets

Writes one zip per asset id plus assets.json next to the zips (and, with
--manifest-out, into the plugin root so the installer can read it). Upload the
zips to a GitHub Release and keep the generated assets.json with the release
branch.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CHUNK = 1024 * 1024

# id -> (source directory, glob/recursive selection, target directory inside the plugin)
GROUPS = [
    ('scene3d-models', ROOT / 'plugin/scene3d/models', 'catalog', 'plugin/scene3d/models'),
    ('scene3d-fonts', ROOT / 'plugin/scene3d/fonts', 'all', 'plugin/scene3d/fonts'),
    ('vocabulary', ROOT / 'plugin/vocabulary', 'sqlite', 'plugin/vocabulary'),
]


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        while True:
            chunk = stream.read(CHUNK)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def catalog_models(directory):
    """Only the models referenced by catalog.json ship; hidden ones stay local."""
    catalog = directory.parent / 'catalog.json'
    if not catalog.is_file():
        raise SystemExit('缺少 catalog.json：' + str(catalog))
    data = json.loads(catalog.read_text('utf-8'))
    names = []

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key == 'file' and isinstance(value, str):
                    name = Path(value).name
                    if name and name not in names:
                        names.append(name)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    files = [directory / name for name in names if (directory / name).is_file()]
    missing = [name for name in names if not (directory / name).is_file()]
    if missing:
        print('警告：catalog 引用的模型缺失：' + ', '.join(missing), file=sys.stderr)
    if not files:
        raise SystemExit('catalog.json 没有解析到模型文件')
    return files


def group_files(directory, mode):
    if mode == 'catalog':
        return catalog_models(directory)
    if mode == 'sqlite':
        return sorted(p for p in directory.iterdir() if p.is_file() and p.suffix in ('.sqlite3', '.db'))
    return sorted(p for p in directory.rglob('*') if p.is_file() and not p.is_symlink())


def build_zip(zip_path, base_dir, files):
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.relative_to(base_dir).as_posix())


def main():
    parser = argparse.ArgumentParser(description='打包发布资产并生成 assets.json')
    parser.add_argument('--out', default=str(ROOT / 'dist/assets'), help='zip 输出目录')
    parser.add_argument('--manifest-out', default='', help='assets.json 额外写出位置（默认只写 out 目录）')
    parser.add_argument('--tag', default='', help='Release tag，默认 v<plugin/package.json version>')
    parser.add_argument('--base', default='https://github.com/dsh-comfyui-t/dsh-comfyui/releases/download')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    out = Path(args.out).resolve()
    tag = args.tag
    if not tag:
        package = json.loads((ROOT / 'plugin/package.json').read_text('utf-8-sig'))
        tag = 'v' + str(package.get('version') or '0.0.0')
    manifest = {
        'version': 1,
        'tag': tag,
        'base': args.base.rstrip('/'),
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'assets': [],
    }
    total = 0
    for entry_id, directory, mode, target in GROUPS:
        if not directory.is_dir():
            print('警告：目录不存在，跳过 %s：%s' % (entry_id, directory), file=sys.stderr)
            continue
        files = group_files(directory, mode)
        if not files:
            print('警告：没有文件，跳过 %s' % entry_id, file=sys.stderr)
            continue
        zip_path = out / (entry_id + '.zip')
        raw = sum(p.stat().st_size for p in files)
        if args.dry_run:
            print('[dry-run] %s：%d 个文件 %.1f MB → %s' % (entry_id, len(files), raw / 1048576, zip_path))
            continue
        build_zip(zip_path, directory, files)
        size = zip_path.stat().st_size
        digest = sha256_file(zip_path)
        total += size
        manifest['assets'].append({
            'id': entry_id,
            'file': zip_path.name,
            'target': target,
            'size': size,
            'sha256': digest,
            'version': 1,
        })
        print('%-16s %3d 个文件  原始 %7.1f MB  压缩 %7.1f MB  %s' % (
            entry_id, len(files), raw / 1048576, size / 1048576, digest[:16] + '…'))
    if args.dry_run:
        return 0
    manifest_path = out / 'assets.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print('\n清单：%s（tag %s，合计 %.1f MB）' % (manifest_path, tag, total / 1048576))
    if args.manifest_out:
        target = Path(args.manifest_out).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(manifest_path.read_text('utf-8'), 'utf-8')
        print('已复制清单到：%s' % target)
    print('下一步：把 %s 下的 *.zip 上传到 Release %s，再发布 assets.json。' % (out, tag))
    return 0


if __name__ == '__main__':
    sys.exit(main())
