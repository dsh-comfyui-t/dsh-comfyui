"""Model identification from bounded file metadata; no GPU or tensor payload loading.

Architecture signatures follow the installed ComfyUI model_detection.py and
ComfyUI-GGUF loader conventions. Unknown/ambiguous variants require confirmation.
"""
from functools import lru_cache
from pathlib import Path
import json
import os
import re
import struct
import subprocess
import sys
import threading

MAX_HEADER = 64 * 1024 * 1024
MAX_TENSORS = 250000
_locks = [threading.Lock() for _ in range(16)]


def _safetensors(path):
    with open(path, 'rb') as stream:
        raw = stream.read(8)
        if len(raw) != 8:
            raise ValueError('文件头不完整')
        size = int.from_bytes(raw, 'little')
        if not 0 < size <= MAX_HEADER or size + 8 > os.path.getsize(path):
            raise ValueError('文件头无效或文件未下载完整')
        header = json.loads(stream.read(size))
    if not isinstance(header, dict) or len(header) > MAX_TENSORS:
        raise ValueError('模型文件头无效')
    tensors = {}
    for key, value in header.items():
        if key == '__metadata__' or not isinstance(value, dict):
            continue
        shape, offsets = value.get('shape'), value.get('data_offsets')
        if not isinstance(shape, list) or len(shape) > 8 or any(type(n) is not int or n < 0 for n in shape):
            continue
        if not isinstance(offsets, list) or len(offsets) != 2 or any(type(n) is not int for n in offsets):
            continue
        if not 0 <= offsets[0] <= offsets[1] <= os.path.getsize(path) - size - 8:
            raise ValueError('模型数据不完整')
        tensors[str(key)] = shape
    meta = header.get('__metadata__', {})
    return meta if isinstance(meta, dict) else {}, tensors


class _GGUFReader:
    def __init__(self, stream):
        self.stream = stream

    def read(self, n):
        if n < 0 or self.stream.tell() + n > MAX_HEADER:
            raise ValueError('GGUF 文件头过大')
        data = self.stream.read(n)
        if len(data) != n:
            raise ValueError('GGUF 文件头不完整')
        return data

    def number(self, fmt):
        return struct.unpack('<' + fmt, self.read(struct.calcsize('<' + fmt)))[0]

    def string(self):
        n = self.number('Q')
        if n > 1024 * 1024:
            raise ValueError('GGUF 字段过长')
        return self.read(n).decode('utf-8')

    def value(self, kind, keep=True, depth=0):
        formats = {0:'B', 1:'b', 2:'H', 3:'h', 4:'I', 5:'i', 6:'f', 7:'?', 10:'Q', 11:'q', 12:'d'}
        if kind in formats:
            return self.number(formats[kind])
        if kind == 8:
            return self.string()
        if kind != 9 or depth:
            raise ValueError('GGUF 字段类型不支持')
        subtype, count = self.number('I'), self.number('Q')
        if count > 1000000:
            raise ValueError('GGUF 数组过长')
        if not keep and subtype in formats:
            self.read(count * struct.calcsize('<' + formats[subtype]))
            return None
        if keep and count > 1024:
            raise ValueError('GGUF 元信息数组过长')
        result = []
        for _ in range(count):
            value = self.value(subtype, keep, depth + 1)
            if keep:
                result.append(value)
        return result if keep else None


def _gguf(path):
    meta, shapes = {}, {}
    with open(path, 'rb') as stream:
        reader = _GGUFReader(stream)
        if reader.read(4) != b'GGUF' or reader.number('I') not in (2, 3):
            raise ValueError('GGUF 版本不支持')
        count, fields = reader.number('Q'), reader.number('Q')
        if count > MAX_TENSORS or fields > 50000:
            raise ValueError('GGUF 字段数量过多')
        for _ in range(fields):
            key, kind = reader.string(), reader.number('I')
            keep = key.startswith(('general.', 'modelspec.', 'comfy.gguf.orig_shape.'))
            value = reader.value(kind, keep)
            if keep:
                meta[key] = value
        for _ in range(count):
            name, dims = reader.string(), reader.number('I')
            if dims > 8:
                raise ValueError('GGUF 张量尺寸无效')
            shape = [reader.number('Q') for _ in range(dims)]
            reader.number('I')  # quantization type
            reader.number('Q')  # data offset; tensor data is never read
            original = meta.get('comfy.gguf.orig_shape.' + name)
            shapes[name] = original if isinstance(original, list) else list(reversed(shape))
    return {k:v for k,v in meta.items() if not k.startswith('comfy.gguf.orig_shape.')}, shapes


def _torch_worker(path):
    # weights_only prevents arbitrary pickle code; FakeTensorMode skips storages.
    # Runs in its own process so torch is never imported into the Sidecar server.
    import torch
    from torch._subclasses.fake_tensor import FakeTensorMode
    with FakeTensorMode():
        obj = torch.load(path, map_location='cpu', weights_only=True)
    if not isinstance(obj, dict):
        raise ValueError('文件不包含模型权重')
    state = obj.get('state_dict', obj)
    if not isinstance(state, dict) or len(state) > MAX_TENSORS:
        raise ValueError('模型权重结构无法识别')
    shapes = {str(k):list(v.shape) for k,v in state.items() if isinstance(k, str) and hasattr(v, 'shape') and len(v.shape) <= 8}
    meta = obj.get('__metadata__', {})
    meta = {str(k):str(v)[:2048] for k,v in meta.items()} if isinstance(meta, dict) else {}
    return meta, shapes


def _torch_header(path):
    kwargs = {'creationflags':subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    result = subprocess.run([sys.executable, '-I', '-X', 'utf8', __file__, '--torch-header', path],
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=25, **kwargs)
    if result.returncode or len(result.stdout) > MAX_HEADER:
        raise ValueError('此文件无法快速识别，可手动选择模型类型')
    records = [line[len(b'DSH_MODEL_HEADER:'):] for line in result.stdout.splitlines() if line.startswith(b'DSH_MODEL_HEADER:')]
    if len(records) != 1:
        raise ValueError('此文件无法快速识别，可手动选择模型类型')
    data = json.loads(records[0])
    return data['metadata'], data['shapes']


def _normalized(shapes):
    result = {}
    for key, shape in shapes.items():
        name = key
        for prefix in ('module.', 'model.diffusion_model.', 'diffusion_model.', 'model.', 'net.'):
            if name.startswith(prefix):
                name = name[len(prefix):]
        result[name] = shape
    return result


def _structure(shapes, metadata):
    """Return compatible profiles, family and a default only when well determined."""
    s = _normalized(shapes)
    has = lambda text:any(text in k for k in s)
    shape = lambda key:s.get(key, [])
    if has('lora_A') or has('lora_B') or any(k.startswith('lora_') for k in s):
        return [], '', '', '这是 LoRA，请选择主模型'
    if has('llm_adapter.blocks.0.cross_attn.q_proj') and 'blocks.0.mlp.layer1.weight' in s:
        return ['anima-base','anima-aesthetic','anima-turbo'], 'anima', 'anima-base', ''
    if 'shared_block_modulation.weight' in s and has('layers.0.proj.ffn_up_gate'):
        return ['moss-sft','moss-base'], 'moss', '', ''
    if 'txtfusion.projector.weight' in s:
        return ['krea2-raw','krea2-turbo'], 'krea2', '', ''
    if 'caption_projection.0.linear.weight' in s:
        return ['hidream-full','hidream-dev','hidream-fast'], 'hidream', '', ''
    if 'txt_in.text_norm.weight' in s and has('transformer_blocks.0.img_mlp'):
        return ['qwen21','qwen21-turbo'], 'qwen21', 'qwen21', ''
    if 'txt_norm.weight' in s and has('transformer_blocks.') and 'img_in.weight' in s:
        if has('addition_t_embedding'):
            return [], 'qwen', '', '此模型需要专用图像编辑流程'
        return ['qwen-image','qwen-2512','qwen-distill'], 'qwen', '', ''
    if has('joint_blocks.0.context_block.attn.qkv'):
        w = shape('x_embedder.proj.weight')
        if len(w) > 1 and w[1] != 16:
            return [], 'sd3', '', '此模型需要专用流程'
        hidden = w[0] if w else 0
        profile = 'sd35-large' if hidden == 2432 else 'sd35-medium' if has('attn.ln_q.') else 'sd3-medium'
        return [profile, 'sd35-turbo'] if profile == 'sd35-large' else [profile], 'sd3', profile, ''
    if 'double_stream_modulation_img.lin.weight' in s:
        w = shape('img_in.weight')
        hidden = w[0] if w else 0
        if hidden in (3072, 4096):
            size = 4 if hidden == 3072 else 9
            choices = [f'flux2-klein{size}-base', f'flux2-klein{size}-distilled']
            return choices, f'flux2-klein{size}', '', ''
        return ['flux2-dev','flux2-turbo'], 'flux2', 'flux2-dev', ''
    if 'img_in.weight' in s and has('double_blocks.0.img_attn.'):
        w = shape('img_in.weight')
        if len(w) > 1 and w[1] not in (64,):
            return [], 'flux', '', '此模型需要专用图像编辑流程'
        if has('distilled_guidance_layer'):
            return ['chroma'], 'chroma', 'chroma', ''
        default = 'flux-dev' if has('guidance_in.') else 'flux-schnell'
        return ['flux-dev','flux-krea'] if default == 'flux-dev' else [default], 'flux', default, ''
    if 'cap_embedder.1.weight' in s and has('layers.0.'):
        w = shape('cap_embedder.1.weight')
        if w and w[0] == 3840:
            return ['z-image','z-image-turbo'], 'z-image', '', ''
        if w and w[0] == 2304:
            return ['lumina2'], 'lumina2', 'lumina2', ''
    if has('double_blocks.0.img_attn_qkv') and has('cond_type_embedding'):
        return ['hunyuan21'], 'hunyuan', 'hunyuan21', ''
    conv = shape('input_blocks.0.0.weight') or shape('conv_in.weight')
    if conv:
        if len(conv) > 1 and conv[1] != 4:
            return [], '', '', '此模型需要专用补绘流程'
        contexts = [v[1] for k,v in s.items() if k.endswith('attn2.to_k.weight') and len(v) == 2]
        adm = shape('label_emb.0.0.weight') or shape('add_embedding.linear_1.weight')
        dim = max(contexts, default=0)
        if dim == 2048 or (len(adm) > 1 and adm[1] == 2816):
            return ['sdxl','illustrious','pony','sdxl-turbo','sdxl-lightning-1','sdxl-lightning-2','sdxl-lightning-4','sdxl-lightning-8'], 'sdxl', 'sdxl', ''
        if dim == 768:
            return ['sd15'], 'sd15', 'sd15', ''
        if dim == 1024:
            return ['sd2'], 'sd2', 'sd2', ''
        if dim == 1280:
            return [], 'sdxl', '', '此模型需要 Refiner 专用流程'
    arch = str(metadata.get('general.architecture') or metadata.get('modelspec.architecture') or '').lower()
    aliases = {'sd1':(['sd15'],'sd15','sd15'), 'sdxl':(['sdxl','illustrious','pony'],'sdxl','sdxl'),
               'flux':(['flux-dev','flux-schnell','flux-krea'],'flux',''),
               'sd3':(['sd3-medium','sd35-medium','sd35-large','sd35-turbo'],'sd3',''),
               'anima':(['anima-base','anima-aesthetic','anima-turbo'],'anima','anima-base'),
               'lumina2':(['lumina2'],'lumina2','lumina2'), 'hidream':(['hidream-full','hidream-dev','hidream-fast'],'hidream',''),
               'qwen_image':(['qwen-image','qwen-2512','qwen-distill'],'qwen',''),
               'chroma':(['chroma'],'chroma','chroma')}
    if arch in aliases and shapes:
        return *aliases[arch], ''
    return [], '', '', ''


def _hint(text):
    text = text.lower()
    # Names such as NoTurbo/base paths must not silently select Turbo weights.
    if re.search(r'no[ _-]?turbo|without[ _-]?turbo', text):
        text = re.sub('turbo', '', text)
    if re.search(r'kontext|inpaint|refiner|layered|\bfill\b', text):
        return ''
    if 'illustrious' in text: return 'illustrious'
    if 'pony' in text: return 'pony'
    if 'lightning' in text:
        match = re.search(r'([1248])[ _-]?steps?', text)
        if match and ('sdxl' in text or 'xl' in text): return 'sdxl-lightning-'+match[1]
    if 'anima' in text:
        return 'anima-turbo' if 'turbo' in text else 'anima-aesthetic' if 'aesthetic' in text else 'anima-base'
    if re.search(r'flux[ ._-]?2', text):
        if 'klein' in text:
            size = 9 if '9b' in text else 4 if '4b' in text else 0
            return f'flux2-klein{size}-'+('base' if 'base' in text else 'distilled') if size else ''
        return 'flux2-turbo' if 'turbo' in text else 'flux2-dev' if 'dev' in text else ''
    if 'flux' in text: return 'flux-schnell' if 'schnell' in text else 'flux-krea' if 'krea' in text else 'flux-dev' if 'dev' in text else ''
    if 'moss' in text: return 'moss-base' if re.search(r'\bbase\b', text) else 'moss-sft' if re.search(r'sft|turbo', text) else ''
    if re.search(r'z[ _-]?image', text): return 'z-image-turbo' if 'turbo' in text else 'z-image'
    if re.search(r'krea[ _-]?2', text): return 'krea2-turbo' if 'turbo' in text else 'krea2-raw' if 'raw' in text else ''
    if 'hidream' in text: return 'hidream-fast' if 'fast' in text else 'hidream-dev' if 'dev' in text else 'hidream-full' if 'full' in text else ''
    if re.search(r'qwen[ _-]?image', text):
        if re.search(r'2[._]1', text): return 'qwen21-turbo' if 'turbo' in text else 'qwen21'
        return 'qwen-2512' if '2512' in text else 'qwen-distill' if 'distill' in text else 'qwen-image'
    if re.search(r'sd[ _.-]?3[ _.-]?5', text): return 'sd35-turbo' if 'turbo' in text else 'sd35-large' if 'large' in text else 'sd35-medium' if 'medium' in text else ''
    if 'sdxl' in text: return 'sdxl-turbo' if 'turbo' in text else 'sdxl'
    return ''


def identify(shapes, metadata, name='', source_hint=''):
    candidates, family, default, unsupported = _structure(shapes, metadata)
    profile, confidence = default, 'high' if default else 'unknown'
    origin = '文件结构' if family else ''
    metadata_text = ' '.join(str(metadata.get(k, '')) for k in
        ('modelspec.architecture','modelspec.title','ss_base_model_version','ss_sd_model_name','base_model',
         'general.name','general.basename','general.finetune'))
    # A more specific variant is accepted only when compatible with the structure.
    hints = [_hint(source_hint), _hint(metadata_text), _hint(name)]
    for i, hint in enumerate(hints):
        if hint and hint in candidates:
            profile, confidence = hint, 'high'
            origin = ('本地来源记录','模型元信息','文件结构与名称')[i]
            break
    if not family and not unsupported:
        # Metadata-only suggestions stay unconfirmed; filenames alone never decide.
        proposal = hints[0] or hints[1] or hints[2]
        if proposal:
            candidates = [proposal]
    return {'profile':profile or '', 'family':family, 'confidence':confidence,
            'candidates':candidates, 'method':origin,
            'message':unsupported or ('' if profile else '无法确定具体类型，请手动确认')}


@lru_cache(maxsize=128)
def _cached(path, size, mtime, source_hint):
    extension = Path(path).suffix.lower()
    result = {'profile':'', 'family':'', 'confidence':'unknown', 'candidates':[], 'method':'',
              'format':extension.lstrip('.').upper(), 'fingerprint':f'{size}:{mtime}',
              'mode':'unknown', 'embedded_clip':None, 'embedded_vae':None}
    try:
        if extension in ('.safetensors','.sft'):
            meta, shapes = _safetensors(path)
        elif extension == '.gguf':
            meta, shapes = _gguf(path)
        elif extension in ('.ckpt','.pt','.pth','.bin'):
            meta, shapes = _torch_header(path)
        else:
            raise ValueError('此格式无法自动识别，可手动选择模型类型')
        result.update(identify(shapes, meta, Path(path).name, source_hint))
        if result['family']:
            clip = any(k.startswith(('cond_stage_model.','conditioner.embedders.','text_encoders.','text_encoder.')) for k in shapes)
            vae = any(k.startswith(('first_stage_model.','vae.')) for k in shapes)
            result.update(mode='checkpoint' if clip or vae else 'diffusion', embedded_clip=clip, embedded_vae=vae)
        elif extension == '.gguf':
            result.update(mode='diffusion', embedded_clip=False, embedded_vae=False)
    except (OSError,ValueError,TypeError,UnicodeError,OverflowError,RecursionError,struct.error,subprocess.SubprocessError) as error:
        result['message'] = str(error)[:240] if isinstance(error, ValueError) else '无法读取模型信息，请重试或手动选择类型'
    return result


def inspect_model(path, source_hint=''):
    path = os.path.realpath(path)
    # Preview metadata and automatic inspection can request the same file together.
    with _locks[hash(path) % len(_locks)]:
        for _ in range(2):
            stat = os.stat(path)
            key = (path, stat.st_size, stat.st_mtime_ns, str(source_hint)[:4096])
            result = dict(_cached(*key))
            after = os.stat(path)
            if (stat.st_size, stat.st_mtime_ns) == (after.st_size, after.st_mtime_ns):
                return result
        return {**result,'profile':'','confidence':'unknown','message':'模型文件正在变化，请完成复制或下载后重新识别'}


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] != '--torch-header':
        raise SystemExit(2)
    metadata, shapes = _torch_worker(sys.argv[2])
    print('\nDSH_MODEL_HEADER:'+json.dumps({'metadata':metadata,'shapes':shapes},ensure_ascii=True))
