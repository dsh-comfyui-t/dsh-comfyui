"""Bounded local raster previews and model sidecar files; no remote access."""
import errno
import hashlib
import json
import threading
import os
from pathlib import Path
import shutil
import uuid

MAX_PREVIEW = 8 * 1024 * 1024
ASSET_LOCK = threading.RLock()
MODEL_EXTENSIONS = {'.safetensors','.ckpt','.pt','.pth','.bin','.gguf','.onnx','.sft'}

FORMATS = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
           '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif'}


def raster_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png', '.png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg', '.jpg'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif', '.gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp', '.webp'
    if data[4:8] == b'ftyp' and any(brand in data[8:32] for brand in (b'avif', b'avis')):
        return 'image/avif', '.avif'
    raise ValueError('预览文件不是受支持的栅格图片')


def confined(root, path):
    return Path(path).resolve().is_relative_to(Path(root).resolve())


def preview_candidates(model):
    model = Path(model); stem = model.with_suffix('')
    # User art first; DSH stores up to eight source previews without replacing it.
    bases = [(stem, '.preview'), (model, '.preview'), (stem, '.dsh-preview')]
    bases += [(stem, '.dsh-preview-%02d' % i) for i in range(2, 9)]
    bases += [(stem, '')]
    return [Path(str(base) + suffix + ext) for base, suffix in bases for ext in FORMATS]


def preview_files(root, model, store=None):
    if store is not None:
        migrate_legacy(root, model, store)
    result = []
    candidates = preview_candidates(model)
    if store is not None:
        central = asset_directory(model, store)
        # User covers remain first, then DSH's central gallery, then legacy fallbacks.
        user = [p for p in candidates if '.dsh-preview' not in p.name]
        generated = [p for p in candidates if '.dsh-preview' in p.name]
        candidates = user[:len(FORMATS)*2] + sorted(central.glob('*.dsh-preview*'),key=lambda p:('.dsh-preview-' in p.name,p.name)) + generated + user[len(FORMATS)*2:]
    # A legacy DSH preview may have been copied into the central store while its
    # on-disk original was intentionally retained (e.g. two models share a stem).
    # Both copies have the same filename and therefore the same public preview ID.
    # Prefer the managed copy for display and keep the original file untouched.
    managed_names = set()
    if store is not None:
        managed_root = asset_directory(model, store)
        managed_names = {p.name for p in candidates if p.parent == managed_root and p.is_file() and not p.is_symlink()}
    for path in dict.fromkeys(candidates):
        if store is not None and path.parent != managed_root and path.name in managed_names and '.dsh-preview' in path.name:
            continue
        if path.is_symlink() or not (confined(root, path) or (store is not None and confined(asset_directory(model, store), path))) or not path.is_file():
            continue
        try:
            if not 0 < path.stat().st_size <= MAX_PREVIEW:
                continue
            with path.open('rb') as f:
                mime, ext = raster_type(f.read(32))
            result.append((path, mime))
        except (OSError, ValueError):
            continue
    if store is not None:
        state = gallery_state(model, store)
        result = [(p, m) for p, m in result if preview_id(p) not in state.get('hidden', [])]
        result.sort(key=lambda pair: preview_id(pair[0]) != state.get('primary'))
    return result


def preview_id(path):
    return hashlib.sha256(Path(path).name.encode('utf-8')).hexdigest()


def gallery_state(model, store):
    path = asset_directory(model, store) / 'gallery.json'
    if path.is_symlink(): raise ValueError('预览图设置路径无效')
    if not path.exists(): return {}
    data = json.loads(_read_bounded(path, 1024 * 1024).decode('utf-8'))
    if not isinstance(data, dict): raise ValueError('预览图设置损坏')
    return data


def _save_gallery_state(model, store, state):
    directory = asset_directory(model, store, create=True)
    target = directory / 'gallery.json'
    if target.is_symlink(): raise ValueError('预览图设置路径无效')
    part = directory / ('.gallery-' + uuid.uuid4().hex + '.part')
    try:
        part.write_text(json.dumps(state, ensure_ascii=False), encoding='utf-8')
        os.replace(part, target)
    finally: part.unlink(missing_ok=True)


def manage_preview(root, model, store, action, identifier):
    with ASSET_LOCK:
        files = preview_files(root, model, store)
        found = next((p for p, _ in files if preview_id(p) == identifier), None)
        if found is None: raise ValueError('预览图已删除或不属于此模型，请刷新')
        state = gallery_state(model, store)
        if action == 'primary': state['primary'] = identifier
        elif action == 'delete':
            # A local cover can be shared by same-stem models. Remove its gallery
            # association without deleting that user's original neighbouring file.
            state['hidden'] = list(dict.fromkeys(state.get('hidden', []) + [identifier]))
            if state.get('primary') == identifier: state.pop('primary', None)
        else: raise ValueError('不支持的预览图操作')
        _save_gallery_state(model, store, state)
        # Association commit comes first; a failed unlink cannot resurrect the entry.
        if action == 'delete' and confined(asset_directory(model, store), found):
            try: found.unlink(missing_ok=True)
            except OSError: pass  # Hidden association is already durably committed.


def append_preview(root, model, store, data):
    """Append output art without replacing local covers or provider slots."""
    if not isinstance(data, bytes) or not data or len(data) > MAX_PREVIEW:
        raise ValueError('预览图为空或超过 8 MiB')
    raster_type(data)
    with ASSET_LOCK:
        files = preview_files(root, model, store)
        digest = hashlib.sha256(data).digest()
        for path, _ in files:
            if hashlib.sha256(_read_bounded(path, MAX_PREVIEW)).digest() == digest:
                return path
        if len(files) >= 128: raise ValueError('该模型已有 128 张预览图，请先删除部分图片')
        if not data or len(data) > MAX_PREVIEW: raise ValueError('预览图为空或超过 8 MiB')
        _mime, ext = raster_type(data)
        directory = asset_directory(model, store, create=True)
        target = directory / (Path(model).stem + '.dsh-preview-user-' + uuid.uuid4().hex + ext)
        temporary = directory / ('.preview-' + uuid.uuid4().hex + '.part')
        try:
            temporary.write_bytes(data)
            publish_no_replace(temporary, target)
        finally: temporary.unlink(missing_ok=True)
        return target


def read_preview(root, model, filename=None, store=None):
    for path, mime in preview_files(root, model, store):
        if filename and path.name != filename:
            continue
        try:
            with path.open('rb') as f:
                data = f.read(MAX_PREVIEW + 1)
            if not data or len(data) > MAX_PREVIEW:
                continue
            detected, ext = raster_type(data)
            return path, detected, data
        except (OSError, ValueError):
            continue
    return None


def save_preview(root, model, mime, data, slot=None, store=None):
    model = Path(model)
    if not confined(root, model) or not model.is_file():
        raise ValueError('模型已移动或目标目录无效')
    if not data or len(data) > MAX_PREVIEW:
        raise ValueError('预览图为空或超过 8 MiB')
    detected, ext = raster_type(data)
    if mime.split(';')[0].lower() != detected:
        raise ValueError('预览图内容与来源格式不匹配')
    if slot is not None and slot not in range(1, 9):
        raise ValueError('预览图序号无效')
    if slot is None:
        existing = read_preview(root, model, store=store)
        if existing:
            return existing[0]
    suffix = '.dsh-preview' if slot in (None, 1) else '.dsh-preview-%02d' % slot
    base = asset_directory(model, store, create=True) if store is not None else model.parent
    target = base / (model.stem + suffix + ext)
    if not confined(base, target) or target.is_symlink():
        raise ValueError('预览图目标越出了模型目录')
    part = target.parent / ('.dsh-preview-' + uuid.uuid4().hex + '.part')
    try:
        with part.open('xb') as f:
            f.write(data)
        if not model.is_file() or not confined(base, target):
            raise ValueError('模型已移动，请重新获取预览')
        publish_no_replace(part, target)
        return target
    finally:
        part.unlink(missing_ok=True)


def slot_preview(root, model, slot, store=None):
    suffix = '.dsh-preview' if slot == 1 else '.dsh-preview-%02d' % slot
    for path, mime in preview_files(root, model, store):
        if path.with_suffix('').name == Path(model).with_suffix('').name + suffix:
            return path
    return None


def publish_no_replace(source, target):
    source, target = Path(source), Path(target)
    try:
        os.link(source, target)
    except OSError as e:
        if e.errno not in (errno.EXDEV, errno.EPERM, errno.EOPNOTSUPP, errno.ENOTSUP):
            raise
        created = False
        try:
            with target.open('xb') as out, source.open('rb') as inp:
                created = True
                shutil.copyfileobj(inp, out, 1024 * 1024)
            shutil.copystat(source, target)
        except Exception:
            if created:
                target.unlink(missing_ok=True)
            raise
    source.unlink()


def companions(model):
    model = Path(model); stem = str(model.with_suffix(''))
    candidates = [Path(stem + suffix) for suffix in ('.dsh-source.json', '.civitai.info', '.civitai.json')]
    candidates.extend(preview_candidates(model))
    return list(dict.fromkeys(p for p in candidates if os.path.lexists(p)))


def move_models(plans, store=None):
    """Preflight all model/attachment destinations, then move with rollback."""
    plans = list(plans)
    cached = [(asset_directory(source, store), target) for root,source,target in plans] if store is not None else []
    pairs = []; targets = {}; sources = set()
    for root, source, target in plans:
        source, target = Path(source), Path(target)
        if os.path.normcase(str(source.resolve())) == os.path.normcase(str(target.resolve())):
            continue
        for src in [source, *companions(source)]:
            dst = target if src == source else target.parent / src.name
            if src.is_symlink() or not confined(root, src) or not confined(root, dst):
                raise ValueError('模型或附件路径无效，不能移动符号链接或越界文件')
            if not src.is_file():
                raise ValueError('模型附件不是普通文件')
            src_key, dst_key = os.path.normcase(str(src.resolve())), os.path.normcase(str(dst.resolve()))
            if dst_key in targets:
                if targets[dst_key] == src_key:
                    continue
                raise ValueError('多个模型或附件的目标同名，请分别移动')
            if os.path.lexists(dst):
                raise ValueError('目标文件夹中已存在同名模型或附件：' + dst.name)
            targets[dst_key] = src_key; sources.add(src_key); pairs.append((src, dst))
    moved = []
    try:
        for source, target in pairs:
            publish_no_replace(source, target)
            moved.append((source, target))
        for old, target in cached:
            copy_model_assets(old, target, store)
    except Exception as e:
        failed = []
        for source, target in reversed(moved):
            try:
                publish_no_replace(target, source)
            except OSError:
                failed.append(str(target))
        if failed:
            raise ValueError('移动失败，部分文件未恢复，请检查源目录和目标目录') from e
        raise ValueError('移动模型或附件失败，已恢复原位置：' + str(e)) from e


def asset_directory(model, store, create=False):
    """Path + file signature, never a hash/read of model content."""
    model = Path(model); stat = model.stat()
    identity = os.path.normcase(str(model.resolve())) + '|' + str(stat.st_size) + '|' + str(stat.st_mtime_ns)
    base = Path(store).resolve()
    directory = base / hashlib.sha256(identity.encode('utf-8')).hexdigest()
    if directory.is_symlink() or not confined(base, directory):
        raise ValueError('模型附件存储路径无效')
    if create:
        directory.mkdir(parents=True, exist_ok=True)
    return directory


def _read_bounded(path, limit):
    with Path(path).open('rb') as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError('模型附件过大')
    return data


def _copy_verified(source, target, limit=MAX_PREVIEW):
    """Copy without replacing; verify bytes before a caller may remove legacy data."""
    source, target = Path(source), Path(target)
    if source.is_symlink() or target.is_symlink() or not 0 < source.stat().st_size <= limit:
        raise ValueError('旧附件不是受支持的普通文件')
    data = _read_bounded(source, limit)
    if target.exists():
        if _read_bounded(target, limit) != data:
            raise ValueError('附件备份冲突，已保留原文件')
        return
    temporary = target.parent / ('.asset-' + uuid.uuid4().hex + '.part')
    try:
        with temporary.open('xb') as stream:stream.write(data)
        publish_no_replace(temporary, target)
        if _read_bounded(target, limit) != data:raise ValueError('附件备份验证失败')
    finally:temporary.unlink(missing_ok=True)


def migrate_legacy(root, model, store):
    """Only move DSH-owned files. Keep a byte-for-byte backup and all user art."""
    model = Path(model)
    if not model.is_file() or not confined(root, model):raise ValueError('模型路径无效')
    with ASSET_LOCK:
        candidates = [p for p in preview_candidates(model) if '.dsh-preview' in p.name]
        candidates.append(model.with_suffix('.dsh-source.json'))
        # A legacy stem can be shared by .ckpt/.safetensors: never steal shared files.
        siblings = [p for p in model.parent.iterdir() if os.path.normcase(p.stem)==os.path.normcase(model.stem) and p.suffix.lower() in MODEL_EXTENSIONS and p.is_file()]
        for source in candidates:
            if not source.is_file() or source.is_symlink() or not confined(root, source):continue
            try:
                if source.suffix.lower()=='.json':
                    if source.stat().st_size>1024*1024:continue
                    if not isinstance(json.loads(_read_bounded(source,1024*1024).decode('utf-8-sig')),dict):continue
                else:
                    if source.stat().st_size>MAX_PREVIEW:continue
                    with source.open('rb') as stream:raster_type(stream.read(32))
                directory=asset_directory(model,store,create=True)
                backup=directory/'legacy-backup'
                if backup.is_symlink() or not confined(directory,backup):raise ValueError('附件备份路径无效')
                backup.mkdir(exist_ok=True)
                _copy_verified(source,backup/source.name)
                _copy_verified(source,directory/('source.json' if source.suffix.lower()=='.json' else source.name))
                if len(siblings)<=1 and _read_bounded(source,MAX_PREVIEW)==_read_bounded(backup/source.name,MAX_PREVIEW):source.unlink()
            except (OSError,ValueError):
                # Read-only, malformed or conflicting files remain intact; reads fall back.
                continue


def read_source(root, model, store):
    migrate_legacy(root,model,store)
    path=asset_directory(model,store)/'source.json'
    if path.is_symlink() or not path.is_file() or path.stat().st_size>1024*1024:return None
    try:
        value=json.loads(_read_bounded(path,1024*1024).decode('utf-8-sig'))
        return value if isinstance(value,dict) else None
    except (OSError,ValueError):return None


def save_source(root, model, value, store):
    if not isinstance(value,dict) or not confined(root,model) or not Path(model).is_file():raise ValueError('模型来源记录无效')
    data=json.dumps(value,ensure_ascii=False).encode('utf-8')
    if len(data)>1024*1024:raise ValueError('模型来源记录过大')
    with ASSET_LOCK:
        directory=asset_directory(model,store,create=True);target=directory/'source.json'
        if target.is_symlink():raise ValueError('模型来源存储路径无效')
        temporary=directory/('.source-'+uuid.uuid4().hex+'.part')
        try:
            temporary.write_bytes(data);os.replace(temporary,target)
        finally:temporary.unlink(missing_ok=True)
    return target


def copy_model_assets(old_directory, target, store):
    """Copy cache to a moved model's identity; old bytes remain as rollback backup."""
    old_directory=Path(old_directory)
    if old_directory.is_symlink() or not confined(store,old_directory):raise ValueError('模型附件来源路径无效')
    if not old_directory.is_dir():return
    with ASSET_LOCK:
        new=asset_directory(target,store,create=True)
        if old_directory==new:return
        for source in old_directory.iterdir():
            if source.name=='legacy-backup':continue
            if source.is_file() and not source.is_symlink() and (source.name in ('source.json','gallery.json') or source.suffix.lower() in FORMATS):
                _copy_verified(source,new/source.name)


def is_model_attachment(root, path):
    """Hide only recognised same-stem companions, not arbitrary user JSON/images."""
    path=Path(path)
    lower=path.name.lower()
    stems=[]
    for suffix in ('.dsh-source.json','.civitai.info','.civitai.json'):
        if lower.endswith(suffix):stems.append(path.name[:-len(suffix)])
    if path.suffix.lower() in FORMATS:
        base=path.stem
        import re
        stems.append(re.sub(r'\.(?:dsh-preview(?:-0[2-8])?|preview)$','',base,flags=re.I))
    for stem in stems:
        for candidate in [path.parent/stem,*[path.parent/(stem+ext) for ext in MODEL_EXTENSIONS]]:
            if candidate.suffix.lower() in MODEL_EXTENSIONS and candidate.is_file() and confined(root,candidate):return True
    # ComfyUI accepts uppercase model extensions on case-sensitive filesystems too.
    if stems:
        names={os.path.normcase(stem) for stem in stems}
        try:
            for candidate in path.parent.iterdir():
                if os.path.normcase(candidate.stem) in names and candidate.suffix.lower() in MODEL_EXTENSIONS and candidate.is_file() and confined(root,candidate):return True
        except OSError:pass
    return False
