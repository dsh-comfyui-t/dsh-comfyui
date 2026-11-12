"""Immutable editor manifests. Pixels use the existing validated PNG store."""
import hashlib
import json
import math
import os
import re
import threading
import uuid

MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
ID = re.compile(r'[0-9a-f]{64}')
LAYER_ID = re.compile(r'[A-Za-z0-9_-]{1,96}')
COLOR = re.compile(r'#[0-9a-fA-F]{6}')
LOCK = threading.RLock()


class ReferenceEditorDocuments:
    def __init__(self, references):
        self.references = references
        self.root = references.root / 'editor_documents'
        if self.root.is_symlink():
            raise ValueError('编辑历史目录不能为符号链接')
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, identifier):
        if not isinstance(identifier, str) or not ID.fullmatch(identifier):
            raise ValueError('编辑历史 ID 无效')
        path = self.root / (identifier + '.json')
        if path.is_symlink() or not path.resolve().is_relative_to(self.root.resolve()):
            raise ValueError('编辑历史路径无效')
        return path

    def validate(self, data):
        if not isinstance(data, dict) or data.get('version') != 1:
            raise ValueError('编辑历史版本无效')
        checked = {}

        def image(identifier, size=None):
            if not isinstance(identifier, str) or not ID.fullmatch(identifier):
                raise ValueError('编辑历史图片 ID 无效')
            if identifier not in checked:
                path = self.references.path(identifier)
                if not path.is_file() or not 0 < path.stat().st_size <= 32 * 1024 * 1024:
                    raise ValueError('编辑历史中的图片不存在')
                with path.open('rb') as f:
                    header = f.read(24)
                if len(header) != 24 or header[:8] != b'\x89PNG\r\n\x1a\n':
                    raise ValueError('编辑历史图片无效')
                checked[identifier] = (int.from_bytes(header[16:20], 'big'), int.from_bytes(header[20:24], 'big'))
            if size and checked[identifier] != size:
                raise ValueError('历史图层尺寸与画布不符')

        def number(value, low, high):
            return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and low <= value <= high

        def size(entry):
            dimensions = entry.get('size', {})
            w, h = dimensions.get('w'), dimensions.get('h')
            if not isinstance(w, int) or not isinstance(h, int) or not (1 <= w <= 8192 and 1 <= h <= 8192 and w * h <= 16 * 1024 * 1024):
                raise ValueError('编辑历史画布尺寸无效')
            return w, h

        image(data.get('original'))
        image(data.get('asset'))
        history = data.get('history', {})
        items, index = history.get('items'), history.get('index')
        if not isinstance(items, list) or not 1 <= len(items) <= 20 or not isinstance(index, int) or isinstance(index, bool) or not 0 <= index < len(items):
            raise ValueError('编辑历史位置或步数无效')
        for entry in items:
            if not isinstance(entry, dict):
                raise ValueError('编辑历史条目无效')
            dimensions = size(entry)
            layers, shapes = entry.get('layers'), entry.get('shapes')
            if not isinstance(layers, list) or not 1 <= len(layers) <= 256 or not isinstance(shapes, list) or len(shapes) > 4096:
                raise ValueError('编辑历史图层数量无效')
            ids = set()
            for layer in layers:
                if not isinstance(layer, dict) or not isinstance(layer.get('id'), str) or not LAYER_ID.fullmatch(layer['id']) or layer['id'] in ids:
                    raise ValueError('编辑图层 ID 无效')
                ids.add(layer['id'])
                if layer.get('kind') not in ('base', 'paint', 'vector') or not isinstance(layer.get('name'), str) or len(layer['name']) > 128 or not isinstance(layer.get('visible'), bool) or not number(layer.get('opacity'), 0, 1):
                    raise ValueError('编辑图层属性无效')
                image(layer.get('image'), dimensions)
            if entry.get('activeId') not in ids:
                raise ValueError('选中图层不存在')
            for shape in shapes:
                if not isinstance(shape, dict) or shape.get('layerId') not in ids or shape.get('kind') not in ('rect', 'ellipse', 'line', 'triangle'):
                    raise ValueError('矢量图形关联无效')
                for key in ('x', 'y', 'w', 'h', 'stroke'):
                    if not number(shape.get(key), -1000000, 1000000):
                        raise ValueError('矢量图形参数无效')
                if not isinstance(shape.get('color'), str) or not COLOR.fullmatch(shape['color']):
                    raise ValueError('矢量图形颜色无效')
            if not isinstance(entry.get('fillEnabled'), bool) or not COLOR.fullmatch(str(entry.get('imageBackgroundColor', ''))):
                raise ValueError('图片底色参数无效')
        image(data['asset'], size(items[index]))
        # Canonical JSON also rejects NaN/Infinity and bounds arbitrary metadata.
        encoded = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf8')
        if len(encoded) > MAX_DOCUMENT_BYTES:
            raise ValueError('编辑历史元数据过大')
        return encoded

    def save(self, data):
        encoded = self.validate(data)
        identifier = hashlib.sha256(encoded).hexdigest()
        target = self.path(identifier)
        with LOCK:
            if not target.exists():
                temp = self.root / ('.' + uuid.uuid4().hex + '.tmp')
                try:
                    with temp.open('xb') as f:
                        f.write(encoded)
                        f.flush()
                        os.fsync(f.fileno())
                    os.replace(temp, target)
                finally:
                    temp.unlink(missing_ok=True)
        return {'id': identifier, 'version': 1, 'asset': data['asset'], 'original': data['original']}

    def read(self, identifier):
        path = self.path(identifier)
        if not path.is_file() or not 0 < path.stat().st_size <= MAX_DOCUMENT_BYTES:
            raise ValueError('编辑历史不存在，请重试读取')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != identifier:
            raise ValueError('编辑历史文件校验失败')
        data = json.loads(raw)
        self.validate(data)
        return data
