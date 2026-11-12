"""Quick-edit repairs isolated from Sidecar and ComfyUI tensor state.

Only the explicit model-install action accesses the network. Inference is a
bounded CPU subprocess; PNGs live in a temporary directory and are removed.
"""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import threading
import urllib.request
import uuid
import re
import time

MODEL_URL = 'https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt'
MODEL_MD5 = 'e3aa4aaa15225a33ec84f9f4bc47e500'
MAX_PNG = 32 * 1024 * 1024
MAX_BODY = 90 * 1024 * 1024
RUN_LOCK = threading.Lock()
INSTALL_LOCK = threading.Lock()
JOBS_LOCK = threading.Lock()
JOBS = {}
CANCELLED = {}
SEGMENT_MODELS = {
    'mobile_sam_image_encoder.onnx': '580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749',
    'sam_mask_decoder_single.onnx': '93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d',
}
SEGMENT_REVISION = '0d3b403339b4674a82493d5e97964dd78089ddc8'


class EditCancelled(ValueError):
    pass


def request_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{8,96}', value):
        raise ValueError('修图请求标识无效')
    return value


def cancel(value):
    key = request_id(value)
    with JOBS_LOCK:
        now = time.monotonic()
        for old, timestamp in list(CANCELLED.items()):
            if now - timestamp > 300:
                CANCELLED.pop(old, None)
        if len(CANCELLED) >= 256:
            CANCELLED.pop(next(iter(CANCELLED)))
        CANCELLED[key] = now
        process = JOBS.get(key)
        if process is not None and process.poll() is None:
            process.terminate()
    return {'ok': True, 'cancelled': True}


def cancelled(key):
    with JOBS_LOCK:
        return key in CANCELLED


def segment_folder():
    return model_path().parent / 'segmentation'


def install_segment_models():
    if not INSTALL_LOCK.acquire(False):
        raise ValueError('修图模型正在准备中，请稍候')
    folder = segment_folder()
    try:
        folder.mkdir(parents=True, exist_ok=True)
        for name, digest in SEGMENT_MODELS.items():
            target = folder / name
            if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == digest:
                continue
            temp = folder / ('.' + uuid.uuid4().hex + '.part')
            try:
                url = 'https://huggingface.co/Acly/MobileSAM/resolve/' + SEGMENT_REVISION + '/' + name
                with urllib.request.urlopen(url, timeout=120) as response, temp.open('xb') as stream:
                    total = 0
                    while block := response.read(1024 * 1024):
                        total += len(block)
                        if total > 40 * 1024 * 1024:
                            raise ValueError('物体识别模型下载大小异常')
                        stream.write(block)
                if hashlib.sha256(temp.read_bytes()).hexdigest() != digest:
                    raise ValueError('物体识别模型校验失败')
                os.replace(temp, target)
            finally:
                temp.unlink(missing_ok=True)
        return status()
    finally:
        INSTALL_LOCK.release()



def model_path():
    # Reuse the plugin's persisted resource root when configured. This also
    # keeps model access consistent with the running Sidecar's data namespace.
    config = Path(__file__).with_name('config.json')
    if config.is_file():
        with config.open(encoding='utf-8-sig') as stream:
            configured = json.load(stream).get('dataDir')
        if configured:
            return Path(os.path.normpath(configured)) / 'quick-edit' / 'big-lama.pt'
    if os.name == 'nt':
        # WSL launchers may pass a Linux-style LOCALAPPDATA. Ask Windows for
        # the actual per-user folder rather than treating that as a UNC path.
        import ctypes
        folder = ctypes.create_unicode_buffer(32768)
        ok = ctypes.windll.shell32.SHGetFolderPathW(None, 28, None, 0, folder)
        local = Path(folder.value if ok == 0 else os.environ.get('LOCALAPPDATA') or Path.home())
        root = local / 'DSH' / 'ComfyUIConsole'
        current = root / 'quick-edit' / 'big-lama.pt'
        legacy = local / 'DSHComfyUI' / 'quick-edit' / 'big-lama.pt'
        # Share the formal plugin's persisted resource namespace. Older installs
        # may continue using their existing cache without another download.
        if not current.is_file() and legacy.is_file():
            return legacy
    else:
        root = Path(os.environ.get('XDG_CACHE_HOME') or Path.home() / '.cache') / 'DSHComfyUI'
    return root / 'quick-edit' / 'big-lama.pt'


def verify_model(path):
    digest = hashlib.md5()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    if digest.hexdigest() != MODEL_MD5:
        raise ValueError('LaMa 模型校验失败，请重新准备模型')


def install_model():
    if not INSTALL_LOCK.acquire(False):
        raise ValueError('LaMa 模型正在准备中，请稍候')
    target = model_path()
    temp = target.with_name('.big-lama-' + uuid.uuid4().hex + '.part')
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_file():
            try:
                verify_model(target)
                return status()
            except ValueError:
                pass
        with urllib.request.urlopen(MODEL_URL, timeout=120) as response, temp.open('xb') as stream:
            total = 0
            while block := response.read(1024 * 1024):
                total += len(block)
                if total > 260 * 1024 * 1024:
                    raise ValueError('LaMa 下载文件大小异常')
                stream.write(block)
        verify_model(temp)
        os.replace(temp, target)
        return status()
    finally:
        temp.unlink(missing_ok=True)
        INSTALL_LOCK.release()


def status():
    path = model_path()
    try:
        path.stat()
        ready, detail = path.is_file(), ''
    except OSError as error:
        ready, detail = False, str(error)
    return {'ok': True, 'version': 4, 'lama': ready, 'modelError': detail,
            'opencv': importlib.util.find_spec('cv2') is not None,
            'segmentation': all((segment_folder() / name).is_file() for name in SEGMENT_MODELS),
            'onnxruntime': importlib.util.find_spec('onnxruntime') is not None,
            'torch': importlib.util.find_spec('torch') is not None, 'device': 'cpu',
            'installing': INSTALL_LOCK.locked(), 'busy': RUN_LOCK.locked(), 'modelPath': str(model_path())}


def png_data(value):
    if not isinstance(value, str) or len(value) > (MAX_PNG * 4 // 3 + 8):
        raise ValueError('修图 PNG 不得超过 32 MiB')
    try:
        data = base64.b64decode(value, validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError('修图图片编码无效') from error
    if len(data) < 33 or len(data) > MAX_PNG or data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        raise ValueError('修图仅接受有效的 PNG')
    width, height = struct.unpack('>II', data[16:24])
    if not (0 < width <= 8192 and 0 < height <= 8192 and width * height <= 16 * 1024 * 1024):
        raise ValueError('修图图片超过尺寸限制（最长边8192、总像素16MP）')
    return data, (width, height)


def process(payload):
    mode = payload.get('mode')
    if mode not in ('remove', 'spot', 'segment'):
        raise ValueError('未知修图工具')
    image, size = png_data(payload.get('image'))
    prompts = None
    brush_mask = None
    if mode == 'segment':
        if importlib.util.find_spec('onnxruntime') is None:
            raise ValueError('当前 Python 环境缺少 onnxruntime，暂不能识别物体；请选用已安装该依赖的运行环境')
        if not all((segment_folder() / name).is_file() for name in SEGMENT_MODELS):
            raise ValueError('请先准备物体识别模型')
        prompts = payload.get('prompts')
        if not isinstance(prompts, list) or not 1 <= len(prompts) <= 34:
            raise ValueError('物体选区提示无效')
        for point in prompts:
            if (not isinstance(point, list) or len(point) != 3
                or any(type(v) not in (int, float) or not __import__('math').isfinite(v) for v in point)
                or point[2] not in (0, 1, 2, 3)
                or not 0 <= point[0] < size[0] or not 0 <= point[1] < size[1]):
                raise ValueError('物体选区超出图片范围')
        if payload.get('brush_mask') is not None:
            brush_mask, brush_size = png_data(payload['brush_mask'])
            if brush_size != size:
                raise ValueError('画笔蒙版与图片尺寸不一致')
    else:
        mask, mask_size = png_data(payload.get('mask'))
        if size != mask_size:
            raise ValueError('修复范围与图片尺寸不一致')
    if mode == 'remove' and not model_path().is_file():
        raise ValueError('尚未准备 LaMa 模型，请先点击准备模型')
    key = request_id(payload.get('request_id') or uuid.uuid4().hex)
    if not RUN_LOCK.acquire(False):
        raise ValueError('上一项修图仍在处理中，请稍候')
    process = None
    try:
        with JOBS_LOCK:
            if key in CANCELLED:
                raise EditCancelled('已取消修图')
            if key in JOBS:
                raise ValueError('修图请求标识重复')
            JOBS[key] = None
        with tempfile.TemporaryDirectory(prefix='dsh-quick-edit-') as temp:
            folder = Path(temp)
            (folder / 'image.png').write_bytes(image)
            if prompts is not None:
                (folder / 'prompts.json').write_text(json.dumps(prompts), encoding='utf-8')
                if brush_mask is not None:
                    (folder / 'brush.png').write_bytes(brush_mask)
            else:
                (folder / 'mask.png').write_bytes(mask)
            local_worker = folder / 'quick_edit_worker.py'
            local_worker.write_bytes(Path(__file__).read_bytes())
            args = [sys.executable, '-B', '-X', 'utf8', str(local_worker), '--worker',
                    mode, str(folder), str(model_path())]
            env = {**os.environ, 'OMP_NUM_THREADS': '4', 'MKL_NUM_THREADS': '4'}
            options = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            with JOBS_LOCK:
                if key in CANCELLED:
                    raise EditCancelled('已取消修图')
                process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                           env=env, cwd=folder, **options)
                JOBS[key] = process
            try:
                stdout, stderr = process.communicate(timeout=180)
            except subprocess.TimeoutExpired as error:
                process.kill()
                process.communicate()
                raise ValueError('本次修图超过180秒，已停止；请缩小范围后重试') from error
            if cancelled(key):
                raise EditCancelled('已取消修图')
            if process.returncode:
                detail = stderr.decode('utf-8', errors='replace').strip().splitlines()
                raise ValueError('修图失败：' + (detail[-1][:400] if detail else '独立修图进程退出'))
            output = folder / 'output.png'
            if not output.is_file() or output.stat().st_size > MAX_PNG:
                raise ValueError('修图结果无效或超过32 MiB')
            return output.read_bytes()
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.communicate()
        with JOBS_LOCK:
            JOBS.pop(key, None)
        RUN_LOCK.release()


def repair(image, mask, mode, path=None):
    """RGB/alpha and mask pixels remain at source resolution. No brush radius.

    Context crop affects work/memory only; no resizing, block averaging or
    changes outside the supplied mask. Empty masks are exact no-ops.
    """
    import numpy as np
    from PIL import Image
    rgba = np.array(image.convert('RGBA'))
    if image.size != mask.size:
        raise ValueError('修复范围与图片尺寸不一致')
    # Mask PNG convention: white pixels on black, independent of PNG alpha.
    alpha = np.array(mask.convert('L'))
    ys, xs = np.where(alpha > 0)
    if not len(xs):
        return Image.fromarray(rgba)
    pad = 192 if mode == 'remove' else 24
    x0, y0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
    x1, y1 = min(image.width, int(xs.max()) + pad + 1), min(image.height, int(ys.max()) + pad + 1)
    crop = rgba[y0:y1, x0:x1]
    a = crop[:, :, 3:4].astype(np.float32) / 255
    rgb = np.round(crop[:, :, :3] * a + 255 * (1 - a)).astype(np.uint8)
    m = (alpha[y0:y1, x0:x1] > 0).astype(np.uint8)
    if m.all():
        raise ValueError('请保留一些未涂抹的周围区域，供修复参考')
    if mode == 'spot':
        import cv2
        # The neighborhood is independent of the brush/mask dimensions.
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        fixed = cv2.cvtColor(cv2.inpaint(bgr, m * 255, 3, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    elif mode == 'remove':
        if max(rgb.shape[:2]) > 1536:
            raise ValueError('本次去除范围过大，请分几次涂抹（单次范围加周边不超过1536像素）')
        import torch
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        verify_model(path)
        model = torch.jit.load(str(path), map_location='cpu').eval()
        height, width = rgb.shape[:2]
        dh, dw = (-height) % 8, (-width) % 8
        rgb_pad = np.pad(rgb, ((0, dh), (0, dw), (0, 0)), mode='symmetric')
        mask_pad = np.pad(m, ((0, dh), (0, dw)), mode='constant')
        tensor = torch.from_numpy(rgb_pad.transpose(2, 0, 1).copy()).float().unsqueeze(0) / 255
        mask_tensor = torch.from_numpy(mask_pad.copy()).float()[None, None]
        with torch.inference_mode():
            result = model(tensor, mask_tensor)[0, :, :height, :width].permute(1, 2, 0).numpy()
        fixed = np.clip(result * 255, 0, 255).astype(np.uint8)
    else:
        raise ValueError('未知修复工具')
    blend = alpha[y0:y1, x0:x1, None].astype(np.float32) / 255
    crop[:, :, :3] = np.round(crop[:, :, :3] * (1 - blend) + fixed * blend).astype(np.uint8)
    return Image.fromarray(rgba)


def segment(image, prompts, folder, brush_mask=None):
    """MobileSAM with full-resolution positive/negative brush constraints."""
    import numpy as np
    import cv2
    import onnxruntime as ort
    from PIL import Image
    options = ort.SessionOptions()
    options.intra_op_num_threads = min(4, os.cpu_count() or 1)
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    sessions = []
    for name, digest in SEGMENT_MODELS.items():
        path = Path(folder) / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('物体识别模型校验失败，请重新准备模型')
        sessions.append(ort.InferenceSession(str(path), sess_options=options,
                                           providers=['CPUExecutionProvider']))
    encoder, decoder = sessions
    width, height = image.size
    factor = 1024 / max(width, height)
    rw, rh = int(width * factor + .5), int(height * factor + .5)
    rgb = np.asarray(image.convert('RGB').resize((rw, rh), Image.Resampling.BILINEAR))
    # This pinned encoder includes normalization and square padding itself.
    embedding = encoder.run(None, {'input_image': rgb.astype(np.float32)})[0]
    coords = np.asarray([p[:2] for p in prompts] + [[0, 0]], dtype=np.float32)[None]
    coords[:, :, 0] *= rw / width
    coords[:, :, 1] *= rh / height
    labels = np.asarray([p[2] for p in prompts] + [-1], dtype=np.float32)[None]
    inputs = {
        'image_embeddings': embedding, 'point_coords': coords, 'point_labels': labels,
        'mask_input': np.zeros((1, 1, 256, 256), np.float32),
        'has_mask_input': np.zeros(1, np.float32),
        'orig_im_size': np.asarray([height, width], dtype=np.float32),
    }
    outputs = decoder.run(None, inputs)
    # Use raw logits: some SAM ONNX exports freeze their final crop to the
    # export image's aspect ratio. Resize/crop here preserves portrait input.
    names = [o.name for o in decoder.get_outputs()]
    logits = outputs[names.index('low_res_masks')][0, 0]
    include = exclude = None
    if brush_mask is not None:
        if brush_mask.size != image.size:
            raise ValueError('画笔蒙版与图片尺寸不一致')
        # Transparent=unknown; red=include; blue=exclude. PNG retains brush
        # footprint, soft alpha and the latest stroke's compositing order.
        brush = np.asarray(brush_mask.convert('RGBA'), dtype=np.float32) / 255
        include = brush[:, :, 0] * brush[:, :, 3]
        exclude = brush[:, :, 2] * brush[:, :, 3]
        total = np.maximum(1., include + exclude)
        include /= total
        exclude /= total
        dense = []
        for coverage in (include, exclude):
            resized = cv2.resize(coverage, (rw, rh), interpolation=cv2.INTER_LINEAR)
            padded = np.zeros((1024, 1024), np.float32)
            padded[:rh, :rw] = resized
            dense.append(cv2.resize(padded, (256, 256), interpolation=cv2.INTER_AREA))
        positive, negative = dense
        # Refine the initial prediction with a dense mask prior, rather than
        # using a sparse scribble as though it were a complete object mask.
        known = np.minimum(1., positive + negative)
        inputs['mask_input'] = (logits * (1-known) + 8*positive - 8*negative)[None, None].astype(np.float32)
        inputs['has_mask_input'] = np.ones(1, np.float32)
        outputs = decoder.run(None, inputs)
        logits = outputs[names.index('low_res_masks')][0, 0]
    logits = cv2.resize(logits, (1024, 1024), interpolation=cv2.INTER_LINEAR)[:rh, :rw]
    logits = cv2.resize(logits, (width, height), interpolation=cv2.INTER_LINEAR)
    mask = (logits > 0).astype(np.uint8) * 255
    # Feather the inferred border first. Explicit brush constraints are applied
    # afterwards, so neither model output nor feather can erase painted pixels.
    mask = cv2.GaussianBlur(mask, (3, 3), .6)
    if include is not None:
        known = np.minimum(1., include + exclude)
        mask = np.rint(mask * (1-known) + 255*include).clip(0,255).astype(np.uint8)
    if not np.any(mask):
        raise ValueError('没有选中区域，请涂抹目标物体后重试')
    return Image.fromarray(mask, 'L')


def worker(mode, folder, path):
    from PIL import Image
    folder = Path(folder)
    with Image.open(folder / 'image.png') as image:
        if mode == 'segment':
            prompts = json.loads((folder / 'prompts.json').read_text(encoding='utf-8'))
            brush_path = folder / 'brush.png'
            if brush_path.exists():
                with Image.open(brush_path) as brush:
                    result = segment(image, prompts, Path(path).parent / 'segmentation', brush_mask=brush)
            else:
                result = segment(image, prompts, Path(path).parent / 'segmentation')
        else:
            with Image.open(folder / 'mask.png') as mask:
                result = repair(image, mask, mode, path)
        result.save(folder / 'output.png', 'PNG')


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--worker':
        worker(sys.argv[2], sys.argv[3], sys.argv[4])
    elif sys.argv[1:] == ['--install']:
        print(json.dumps(install_model()))
