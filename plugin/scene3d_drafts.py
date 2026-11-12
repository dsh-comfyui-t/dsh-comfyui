"""Component-owned temporary scenes. They never appear in the preset library."""
import json
import os
from pathlib import Path
import time
import uuid
from scene3d_store import ID, LOCK, validate_scene


class DraftStore:
    LEASE_SECONDS = 600

    def __init__(self, root):
        self.root = Path(root) / 'drafts'
        self.root.mkdir(parents=True, exist_ok=True)
    def cleanup(self):
        # Run only when a new host page starts. An existing component must remain
        # recoverable after a long machine sleep or background suspension.
        with LOCK:
            for path in self.root.glob('*.json'):
                if path.is_symlink(): continue
                try:
                    row = json.loads(path.read_text(encoding='utf8'))
                    if time.time() - row.get('lease', 0) > self.LEASE_SECONDS:
                        if row.get('active'): self.release(path.stem)
                        elif time.time() - row.get('lease', 0) > 86400: path.unlink()
                except (OSError, ValueError, TypeError): continue

    def path(self, key):
        if not isinstance(key, str) or not ID.fullmatch(key):
            raise ValueError('临时场景会话无效')
        path = self.root / (key + '.json')
        if path.is_symlink() or not path.resolve().is_relative_to(self.root.resolve()):
            raise ValueError('临时场景路径无效')
        return path

    def _write(self, row):
        path = self.path(row['channel'])
        temp = path.with_name('.' + uuid.uuid4().hex + '.tmp')
        try:
            temp.write_text(json.dumps(row, ensure_ascii=False, allow_nan=False), encoding='utf8')
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)
        return row

    def read(self, key):
        with LOCK:
            path = self.path(key)
            if not path.is_file(): return {'channel': key, 'active': False}
            if path.stat().st_size > 2 * 1024 * 1024: raise ValueError('临时场景过大')
            row = json.loads(path.read_text(encoding='utf8'))
            return row

    @staticmethod
    def state(row):
        return {k: v for k, v in row.items() if k not in ('scene', 'lease')}

    def open(self, key):
        with LOCK:
            row = self.read(key)
            # Released identifiers cannot be resurrected by late editor requests.
            if self.path(key).exists() and not row.get('active'):
                raise ValueError('临时场景已结束，请重新添加 3D 参考组件')
            row.update(channel=key, sceneId=key, active=True, lease=time.time())
            row.setdefault('name', '临时场景')
            row.setdefault('presetId', '')
            return self._write(row)

    def update(self, key, body):
        with LOCK:
            row = self.read(key)
            if not row.get('active'): raise ValueError('临时场景已结束，无法写回已移除的组件')
            scene = validate_scene(body.get('scene'))
            preset = str(body.get('presetId') or '')
            if preset and not ID.fullmatch(preset): raise ValueError('场景预设编号无效')
            row.update(scene=scene, name=str(body.get('name') or '临时场景')[:128],
                       presetId=preset, presetDirty=body.get('presetDirty') is True, revision=str(time.time_ns()))
            return self._write(row)

    def touch(self, key):
        with LOCK:
            row = self.read(key)
            if row.get('active'):
                row['lease'] = time.time()
                self._write(row)
            return self.state(row)

    def apply(self, key, asset):
        with LOCK:
            row = self.read(key)
            if not row.get('active') or not row.get('scene'): raise ValueError('临时场景尚未保存')
            row.update(asset=asset, applyRevision=str(time.time_ns()))
            return self.state(self._write(row))

    def set_reference(self, key, capture):
        with LOCK:
            row = self.read(key)
            if not row.get('active'): raise ValueError('临时场景已结束')
            row['referenceCapture'] = capture
            row['referenceRevision'] = str(time.time_ns())
            return self.state(self._write(row))

    def release(self, key):
        with LOCK:
            from scene3d_captures import CaptureStore
            CaptureStore(self.root.parent,None).clear_draft(key)
            return self._write({'channel': key, 'active': False, 'lease': time.time()})

    def capture(self, key):
        with LOCK:
            row = self.read(key)
            if not row.get('active'): raise ValueError('临时场景已结束')
            row['captureRequest'] = uuid.uuid4().hex
            row.pop('captureAck', None)
            return self.state(self._write(row))

    def capture_ack(self, key, token):
        with LOCK:
            row = self.read(key)
            if not row.get('active') or not token or token != row.get('captureRequest'):
                raise ValueError('场景同步请求已结束')
            row['captureAck'] = token
            return self.state(self._write(row))

    def resume(self, key):
        with LOCK:
            row = self.read(key)
            if not row.get('active'): return self.state(row)
            row.pop('captureRequest', None)
            row.pop('captureAck', None)
            return self.state(self._write(row))
