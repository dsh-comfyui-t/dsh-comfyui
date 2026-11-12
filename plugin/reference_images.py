"""Immutable local PNG references and ComfyUI input upload; stdlib only."""
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import threading
import urllib.request
import uuid
import zlib

MAX_BYTES = 32 * 1024 * 1024
MAX_PIXELS = 16 * 1024 * 1024
LOCK = threading.RLock()
IDENTIFIER = re.compile(r'[0-9a-f]{64}')


def png_dimensions(data):
    if not 0 < len(data) <= MAX_BYTES or data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('参考图须为不超过 32 MiB 的 PNG')
    pos = 8; width = height = channels = 0; compressed = []; ended = False
    while pos + 12 <= len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]; kind = data[pos+4:pos+8]
        end = pos + length + 12
        if end > len(data): raise ValueError('PNG 数据不完整')
        value = data[pos+8:pos+8+length]
        if zlib.crc32(kind + value) & 0xffffffff != struct.unpack('>I', data[end-4:end])[0]:
            raise ValueError('PNG 校验失败')
        if pos == 8 and kind != b'IHDR': raise ValueError('PNG 缺少头部')
        if kind == b'IHDR':
            if width or length != 13: raise ValueError('PNG 头部无效')
            width,height,depth,color,compression,filtering,interlace = struct.unpack('>IIBBBBB', value)
            if not (1 <= width <= 8192 and 1 <= height <= 8192 and width*height <= MAX_PIXELS):
                raise ValueError('参考图最大边 8192px，总像素不得超过 16MP')
            if depth != 8 or color not in (2,6) or compression or filtering or interlace:
                raise ValueError('请用图片编辑器导出标准 RGB/RGBA PNG')
            channels = 3 if color == 2 else 4
        elif kind == b'IDAT': compressed.append(value)
        elif kind == b'IEND':
            if length or end != len(data): raise ValueError('PNG 结束块无效')
            ended = True; break
        elif kind[:1].isupper() and kind != b'PLTE': raise ValueError('不支持的 PNG 数据块')
        pos = end
    if not ended or not width or not compressed: raise ValueError('PNG 数据不完整')
    row = width*channels + 1; expected = row*height
    decoder = zlib.decompressobj()
    try: pixels = decoder.decompress(b''.join(compressed), expected+1)
    except zlib.error as ex: raise ValueError('PNG 像素数据损坏') from ex
    if len(pixels) != expected or not decoder.eof or decoder.unused_data or any(pixels[i] > 4 for i in range(0,expected,row)):
        raise ValueError('PNG 像素长度或过滤方式无效')
    return width,height


class ReferenceImages:
    def __init__(self, root, comfy_url):
        self.root = Path(root).expanduser().absolute()
        if self.root.is_symlink(): raise ValueError('参考图目录不能为符号链接')
        self.root.mkdir(parents=True, exist_ok=True)
        self.comfy_url = comfy_url

    def path(self, identifier):
        if not isinstance(identifier,str) or not IDENTIFIER.fullmatch(identifier): raise ValueError('参考图 ID 无效')
        p = self.root/(identifier+'.png')
        if p.is_symlink() or not p.resolve().is_relative_to(self.root.resolve()): raise ValueError('参考图路径无效')
        return p

    def read(self, identifier):
        p = self.path(identifier)
        if not p.is_file(): raise ValueError('参考图文件不存在，请重新选择图片')
        if p.stat().st_size > MAX_BYTES: raise ValueError('参考图文件过大')
        data = p.read_bytes()
        if hashlib.sha256(data).hexdigest() != identifier: raise ValueError('参考图文件已损坏，请重新选择')
        png_dimensions(data)
        return data

    def info(self, identifier, data=None):
        data = self.read(identifier) if data is None else data
        width,height = png_dimensions(data)
        return {'id':identifier,'width':width,'height':height,'bytes':len(data),'url':'/references/'+identifier}

    def save(self, data):
        png_dimensions(data); identifier = hashlib.sha256(data).hexdigest(); p = self.path(identifier)
        with LOCK:
            if p.exists():
                self.read(identifier)
            else:
                temp = self.root/('.'+uuid.uuid4().hex+'.tmp')
                try:
                    with temp.open('xb') as f: f.write(data)
                    os.replace(temp,p)
                finally: temp.unlink(missing_ok=True)
        return self.info(identifier,data)

    def prepare(self, identifier):
        data = self.read(identifier); boundary = 'DSHReference'+uuid.uuid4().hex
        fields = {'type':'input','overwrite':'true'}
        body = b''
        for key,value in fields.items():
            body += ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n'%(boundary,key,value)).encode()
        body += ('--%s\r\nContent-Disposition: form-data; name="image"; filename="%s.png"\r\nContent-Type: image/png\r\n\r\n'%(boundary,identifier)).encode()+data+('\r\n--%s--\r\n'%boundary).encode()
        req = urllib.request.Request(self.comfy_url()+'/upload/image', data=body,
            headers={'Content-Type':'multipart/form-data; boundary='+boundary},method='POST')
        with urllib.request.urlopen(req,timeout=45) as response:
            result = json.loads(response.read(65537))
        subfolder=str(result.get('subfolder') or '')
        if result.get('type')!='input' or subfolder not in ('','dsh_reference') or not re.fullmatch(re.escape(identifier)+r'(?: \(\d+\))?\.png',str(result.get('name',''))):
            raise ValueError('ComfyUI 返回的参考图路径无效')
        return {**self.info(identifier,data),'input':(subfolder+'/' if subfolder else '')+result['name']}
