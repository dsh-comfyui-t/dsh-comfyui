"""PNG edit provenance and collision-safe output export; standard library only."""
import json
import os
import struct
import time
import zlib

MAX_TEXT = 2 * 1024 * 1024


def original_params(value):
    """Bound the browser's original-settings snapshot; never accept image bytes."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError('原始生成信息格式无效')
    def clean(item, depth=0):
        if depth > 32:
            raise ValueError('原始生成信息层级过深')
        if isinstance(item, dict):
            return {key: clean(val, depth+1) for key, val in item.items()
                    if key not in ('__proto__', 'prototype', 'constructor', 'base64', 'dataUrl', 'imageBytes', 'sourceOutput')}
        if isinstance(item, list):
            return [clean(val, depth+1) for val in item]
        if isinstance(item, str) and item.lower().startswith('data:image/'):
            return None
        return item
    snapshot = clean(value)
    encoded = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf8')
    if len(encoded) > 256 * 1024:
        raise ValueError('原始生成信息过大，未覆盖保存内容')
    return snapshot or None


def annotated_png(data, metadata, original_params=None, source_name=''):
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('编辑结果必须为 PNG')
    texts = {k: str(metadata[k]) for k in ('prompt', 'workflow', 'parameters') if metadata.get(k)}
    if original_params:
        texts['dsh_original_params'] = json.dumps(original_params, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    texts['dsh_image_edit'] = json.dumps({'edited': True, 'version': 1, 'editedAt': int(time.time()),
                                        'sourceName': str(source_name)[:256], 'parametersDescribe': 'original-before-edit'}, ensure_ascii=False)
    if sum(len(v.encode('utf8')) for v in texts.values()) > MAX_TEXT:
        raise ValueError('原始图片生成信息过大，未导出文件')
    chunks = [data[:8]]
    pos = 8
    while pos + 12 <= len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]
        kind = data[pos+4:pos+8]
        end = pos + length + 12
        if end > len(data):
            raise ValueError('PNG 数据不完整')
        if kind == b'IEND':
            for name, value in texts.items():
                # Uncompressed iTXt is Unicode-safe and supported by ComfyUI metadata readers.
                text = name.encode('ascii') + b'\0\0\0\0\0' + value.encode('utf8')
                payload = b'iTXt' + text
                chunks.append(struct.pack('>I', len(text)) + payload + struct.pack('>I', zlib.crc32(payload) & 0xffffffff))
        if kind not in (b'tEXt', b'iTXt', b'zTXt'):
            chunks.append(data[pos:end])
        pos = end
        if kind == b'IEND':
            if pos != len(data):
                raise ValueError('PNG 尾部数据无效')
            return b''.join(chunks)
    raise ValueError('PNG 缺少结束块')


def save_unique(data, folder, prefix, next_path):
    if not folder or not os.path.isabs(folder):
        raise ValueError('输出目录必须是本机绝对路径')
    os.makedirs(folder, exist_ok=True)
    while True:
        target = next_path(folder, prefix, '.png')
        try:
            with open(target, 'xb') as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            return target
        except FileExistsError:
            continue
        except BaseException:
            try:
                os.remove(target)
            except OSError:
                pass
            raise
