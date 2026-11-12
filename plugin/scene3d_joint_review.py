"""Temporary, durable control-point annotations. Never changes rigs or scene presets."""
from pathlib import Path
import hashlib
import json
import math
import os
import tempfile
import threading
import time

LOCK = threading.RLock()


class JointReviewStore:
    def __init__(self, root, catalog):
        self.root = Path(root)
        self.catalog = {row['id']: row for row in catalog}

    def _path(self):
        if self.root.is_symlink():
            raise ValueError('关节记录路径无效')
        self.root.mkdir(parents=True, exist_ok=True)
        path = self.root / 'joint-review.json'
        if path.is_symlink():
            raise ValueError('关节记录路径无效')
        return path

    def _read(self):
        path = self._path()
        if not path.exists():
            return {'version': 1, 'entries': []}
        value = json.loads(path.read_text(encoding='utf8'))
        if not isinstance(value, dict) or value.get('version') != 1 or not isinstance(value.get('entries'), list):
            raise ValueError('关节记录文件格式无效，请保留文件供排查')
        return value

    def read(self):
        with LOCK:
            return self._read()

    @staticmethod
    def _text(body, key, limit=256, optional=False):
        value = body.get(key, '')
        if not isinstance(value, str) or len(value) > limit or (not optional and not value.strip()) or any(ord(c) < 32 for c in value):
            raise ValueError('关节记录字段无效：' + key)
        return value

    @staticmethod
    def _vector(body, key, length):
        value = body.get(key)
        if not isinstance(value, list) or len(value) != length or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 100000 for v in value):
            raise ValueError('关节位置数据无效：' + key)
        return value

    def update(self, body):
        with LOCK:
            value = self._read()
            if body.get('action') == 'remove':
                key = self._text(body, 'id', 64)
                value['entries'] = [entry for entry in value['entries'] if entry['id'] != key]
            elif body.get('action') == 'record':
                model = self.catalog.get(self._text(body, 'model', 80))
                if not model or body.get('asset') != model['file'] or body.get('rigRevision', 0) != model.get('rigRevision', 0):
                    raise ValueError('人偶资源已更新，请关闭后重新打开编辑器再记录')
                name = self._text(body, 'bone')
                path = body.get('bonePath')
                if not isinstance(path, list) or not 1 <= len(path) <= 64:
                    raise ValueError('骨骼层级无效')
                path = [self._text({'name': part}, 'name') for part in path]
                if path[-1] != name:
                    raise ValueError('骨骼层级与名称不匹配')
                index = body.get('boneIndex')
                if isinstance(index, bool) or not isinstance(index, int) or not 0 <= index < 4096:
                    raise ValueError('骨骼索引无效')
                source = body.get('source')
                if source not in ('viewport', 'list'):
                    raise ValueError('关节点击来源无效')
                identity = [model['id'], model['file'], model.get('rigRevision', 0), path, index]
                key = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()
                now = time.time()
                entry = dict(id=key, model=model['id'], modelLabel=model['label'], asset=model['file'],
                             rigRevision=model.get('rigRevision', 0), bone=name, bonePath=path, boneIndex=index,
                             jointLabel=self._text(body, 'jointLabel'), parent=self._text(body, 'parent', optional=True),
                             objectId=self._text(body, 'objectId', 80), objectLabel=self._text(body, 'objectLabel', 80),
                             localPosition=self._vector(body, 'localPosition', 3), worldPosition=self._vector(body, 'worldPosition', 3),
                             quaternion=self._vector(body, 'quaternion', 4), source=source,
                             firstClickedAt=now, lastClickedAt=now, clicks=1)
                old = next((row for row in value['entries'] if row['id'] == key), None)
                if old:
                    entry.update(firstClickedAt=old['firstClickedAt'], clicks=old['clicks'] + 1)
                    value['entries'].remove(old)
                elif len(value['entries']) >= 2000:
                    raise ValueError('关节记录已达 2000 项，请先整理记录')
                value['entries'].insert(0, entry)
            else:
                raise ValueError('未知关节记录操作')
            value['updatedAt'] = time.time()
            path = self._path()
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', dir=self.root, delete=False) as stream:
                    temporary = stream.name
                    json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, path)
            finally:
                if temporary and os.path.exists(temporary):
                    os.unlink(temporary)
            return value
