"""Optional CPU translation, isolated from ComfyUI and the sidecar's dependencies.

Only installation uses the network. Inference reads a local Argos en->zh package
with CTranslate2 + SentencePiece; no chat model, Torch or sentence-splitter download.
"""
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.request
import unicodedata
import zipfile

MODEL_URL = 'https://argos-net.com/v1/translate-en_zh-1_9.argosmodel'
MODEL_NAME = 'Argos Translate English-Chinese 1.9'
MODEL_SHA256 = '433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab'


class OfflineTranslation:
    def __init__(self, root, direction='en-zh'):
        if direction not in ('en-zh','zh-en'): raise ValueError('不支持的翻译方向')
        self.direction = direction
        self.model_name = MODEL_NAME if direction=='en-zh' else 'Argos Translate Chinese-English 1.9'
        self.model_url = MODEL_URL if direction=='en-zh' else 'https://argos-net.com/v1/translate-zh_en-1_9.argosmodel'
        self.model_sha256 = MODEL_SHA256 if direction=='en-zh' else '62e7af5a3a48b530e47b7b3e5c78c2de79073ecd815750d2bf3ab35b4a67da2d'
        self.root = Path(root) / ('offline-translation' if direction=='en-zh' else 'offline-translation-zh-en')
        self.lock = threading.Lock()
        self.infer_lock = threading.Lock()
        self.cache = collections.OrderedDict()
        self.install_state = {'status': 'missing', 'message': '尚未安装离线翻译组件'}

    def status(self):
        ready = (self.root / 'ready.json').is_file()
        with self.lock:
            state = dict(self.install_state)
        if ready and state['status'] != 'running':
            state.update(status='ready', message='离线翻译已就绪')
        return {**state, 'ready': ready, 'name': self.model_name, 'path': str(self.root), 'direction':self.direction}

    def install(self):
        with self.lock:
            if self.install_state['status'] == 'running':
                return {**self.install_state, 'ready': False}
            if (self.root / 'ready.json').is_file():
                return {'status': 'ready', 'ready': True, 'message': '离线翻译已就绪'}
            self.install_state = {'status': 'running', 'message': '正在安装 CPU 离线翻译组件…'}
            threading.Thread(target=self._install, daemon=True).start()
            return {**self.install_state, 'ready': False}

    def _install(self):
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
            # --target avoids altering the ComfyUI / sidecar environment.
            shared = self.root.parent / 'offline-translation' / 'runtime'
            if not (self.direction=='zh-en' and (shared/'ctranslate2').is_dir() and (shared/'sentencepiece').is_dir()):
                with open(self.root / 'install.log', 'w', encoding='utf-8') as log:
                    result = subprocess.run([sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check',
                        '--only-binary=:all:', '--upgrade', '--target', str(self.root / 'runtime'),
                        'ctranslate2>=4.0,<5', 'sentencepiece>=0.2,<0.3'],
                        stdout=log, stderr=subprocess.STDOUT, timeout=1200, creationflags=flags)
                if result.returncode:
                    raise RuntimeError('运行依赖安装失败。请确认 sidecar Python 支持 pip 和当前系统的二进制包；详情见 ' + str(self.root / 'install.log'))
            with self.lock:
                self.install_state['message'] = '正在下载离线翻译包…'
            archive = self.root / 'model.download'
            digest = hashlib.sha256()
            try:
                cached = archive.is_file() and hashlib.sha256(archive.read_bytes()).hexdigest()==self.model_sha256
                if cached:
                    digest.update(archive.read_bytes())
                else:
                    request = urllib.request.Request(self.model_url, headers={'User-Agent': 'DSH-ComfyUI-Console/0.4.4'})
                    with urllib.request.urlopen(request, timeout=90) as response, open(archive, 'wb') as out:
                        total = 0
                        while True:
                            chunk = response.read(1024 * 1024)
                            if not chunk:
                                break
                            total += len(chunk)
                            if total > 1024 * 1024 * 1024:
                                raise ValueError('翻译包大小超出上限')
                            out.write(chunk)
                            digest.update(chunk)
                if digest.hexdigest() != self.model_sha256:
                    raise ValueError('翻译包校验不匹配，请稍后重试或联系维护者更新来源')
                with tempfile.TemporaryDirectory(dir=self.root, prefix='unpack-') as tmp:
                    base = Path(tmp).resolve()
                    with zipfile.ZipFile(archive) as z:
                        if sum(i.file_size for i in z.infolist()) > 2 * 1024**3:
                            raise ValueError('翻译包解压大小超出上限')
                        for item in z.infolist():
                            target = (base / item.filename).resolve()
                            if not target.is_relative_to(base) or (item.external_attr >> 16) & 0o170000 == 0o120000:
                                raise ValueError('翻译包包含不安全路径')
                        z.extractall(base)
                    metas = list(base.rglob('metadata.json'))
                    candidates = [m.parent for m in metas if json.loads(m.read_text(encoding='utf-8')).get('from_code') == self.direction.split('-')[0]
                                  and json.loads(m.read_text(encoding='utf-8')).get('to_code') == self.direction.split('-')[1]]
                    if len(candidates) != 1:
                        raise ValueError('未找到唯一的英中翻译模型')
                    package = candidates[0]
                    if not (package / 'sentencepiece.model').is_file() or not (package / 'model' / 'model.bin').is_file():
                        raise ValueError('翻译包缺少模型或分词器')
                    dest = self.root / 'model'
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.move(str(package), dest)
                # Validate native imports and a real inference before declaring ready.
                translated = self._run(['A girl with long hair.' if self.direction=='en-zh' else '一个长头发的女孩。'])
                if not translated or not translated[0].strip():
                    raise RuntimeError('翻译组件自检没有返回文本')
                manifest = {'model': self.model_name, 'url': self.model_url, 'sha256': digest.hexdigest(), 'direction': self.direction}
                (self.root / 'ready.json').write_text(json.dumps(manifest), encoding='utf-8')
            finally:
                archive.unlink(missing_ok=True)
            with self.lock:
                self.install_state = {'status': 'ready', 'message': '离线翻译安装完成'}
        except Exception as e:
            with self.lock:
                self.install_state = {'status': 'error', 'message': str(e)}

    def _run(self, texts):
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        # Windows portable Python can inherit an ANSI console code page (for example
        # cp1252). The worker returns Chinese JSON, so force UTF-8 both through the
        # child environment and inside the worker itself. Parent decoding was already
        # UTF-8; without this the worker can crash while *printing* a valid result.
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUTF8'] = '1'
        run = subprocess.run([sys.executable, '-u', str(Path(__file__).resolve()), '--worker', str(self.root)],
            input=json.dumps(texts, ensure_ascii=False), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding='utf-8', errors='replace', timeout=180, creationflags=flags, env=env)
        if run.returncode:
            raise RuntimeError('离线翻译失败：' + run.stderr[-500:])
        result = json.loads(run.stdout.strip().splitlines()[-1])
        if not isinstance(result, list) or len(result) != len(texts):
            raise ValueError('离线翻译返回数量异常')
        return result

    def translate(self, texts):
        if not self.status()['ready']:
            raise RuntimeError('尚未安装离线翻译组件')
        with self.infer_lock:
            missing = list(dict.fromkeys(t for t in texts if t not in self.cache))
            if missing:
                for src, dst in zip(missing, self._run(missing)):
                    self.cache[src] = dst
            result = [self.cache[t] for t in texts]
            for t in texts:
                self.cache.move_to_end(t)
            while len(self.cache) > 512:
                self.cache.popitem(last=False)
            return result


# Read-only prompt vocabulary; explicit user dictionary entries still take priority.
PREVIEW_GLOSSARY = {
    'absurdres': '超高分辨率', 'highres': '高分辨率', 'lowres': '低分辨率',
    'hdr': '高动态范围', 'masterpiece': '杰作', 'best quality': '最佳质量',
    'worst quality': '最差质量', 'low quality': '低质量',
    'looking directly at viewer': '直视观者',
}


def protected_preview_text(value):
    text = value.strip()
    # Fragmentary headings, names and ComfyUI syntax are not prose. Translating
    # them with a subtitle-trained model can hallucinate unrelated ASS markup.
    return (not text or not re.search(r'[A-Za-z]', text)
            or re.fullmatch(r'[A-Za-z][A-Za-z0-9_ /-]{0,60}[:：]', text) is not None
            or re.search(r'(?:^|[\s,])@\S+', text) is not None
            or re.match(r'^(?:embedding:|https?://|www\.)', text, re.I) is not None
            or re.fullmatch(r'<[^>]+>|\[[^\]]+\]|(?:BREAK|AND)', text) is not None
            or re.search(r'\{[^{}]*\\[A-Za-z1-4]', text) is not None
            or re.search(r'\.(?:safetensors|gguf|ckpt|pt|pth|bin)(?:\s|$)', text, re.I) is not None)


def clean_preview_translation(source, translated):
    if not isinstance(translated, str):
        return None
    # Reject invented formatting rather than stripping a few codes and keeping
    # the unrelated sentence. Preserve the complete original segment instead.
    if (re.search(r'\{[^{}]*\\[A-Za-z1-4]', translated)
            or re.search(r'<(?:/?s|unk|\|[^>]*\|)>', translated)
            or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', translated)):
        return None
    translated = translated.replace('\u2581', ' ').strip()
    if not translated or len(translated) > max(120, len(source) * 5):
        return None
    return translated


def preview_translate(dictionary, engine, texts):
    if not isinstance(texts, list) or len(texts) > 512 or any(not isinstance(t, str) for t in texts):
        raise ValueError('texts 必须为最多 512 项的字符串数组')
    if sum(len(t) for t in texts) > 24000:
        raise ValueError('中文预览一次最多处理 24000 个字符')
    items, missing, indexes = [], [], []
    def lookup_text(value):
        # ComfyUI prompt escapes are syntax, not part of the stored Tag name.
        return re.sub(r'\\([()[\]\\,:])', r'\1', value)

    def normalize(value):
        return ' '.join(unicodedata.normalize('NFKC', lookup_text(value)).replace('_', ' ').casefold().split())
    for i, value in enumerate(texts):
        candidates = []
        # Exact complete outputs only. Legacy/user snippets remain snippets in
        # storage, but their existing Chinese titles are valid display labels.
        # Never infer a single Tag translation by splitting a macro's output.
        if value:
            rows = dictionary.preview_matches([value, lookup_text(value)])
            candidates = [r for r in rows if r.get('kind') in ('tag', 'snippet', 'translation') and normalize(r['output']) == normalize(value)
                          and re.search(r'[\u3400-\u9fff]', r['label'])]
            candidates.sort(key=lambda r: (-r.get('preferred', 0), r.get('source')!='user',
                r.get('kind')!='tag', -r.get('confidence', 0), str(r['id'])))
        if candidates:
            # A verified prompt tag is the useful display sense. Generic dictionary
            # definitions remain searchable instead of adding archaic spellings
            # and unrelated dictionary senses to every Chinese preview label.
            if any(r.get('kind')=='tag' and r.get('namespace')=='danbooru' for r in candidates):
                candidates=[r for r in candidates if not (r.get('catalog') and r.get('kind')=='translation')]
            labels = list(dict.fromkeys(r['label'] for r in candidates))
            items.append({'text': ' / '.join(labels), 'source': 'dictionary', 'alternatives': labels})
        elif protected_preview_text(value):
            items.append({'text': value, 'source': 'original'})
        elif normalize(value) in PREVIEW_GLOSSARY:
            items.append({'text': PREVIEW_GLOSSARY[normalize(value)], 'source': 'dictionary'})
        else:
            items.append({'text': value, 'source': 'original'})
            missing.append(value.replace('_', ' '))
            indexes.append(i)
    warning = ''
    if missing:
        if engine.status()['ready']:
            try:
                result = engine.translate(missing)
                if not isinstance(result, list) or len(result) != len(indexes):
                    raise ValueError('离线翻译返回数量异常')
                rejected = 0
                for i, translated in zip(indexes, result):
                    clean = clean_preview_translation(texts[i], translated)
                    if clean is None:
                        rejected += 1
                    else:
                        items[i] = {'text': clean, 'source': 'machine'}
                if rejected:
                    warning = '部分译文格式异常，已保留对应原文。'
            except Exception as e:
                warning = str(e) + '；未翻译内容显示原文。'
        else:
            warning = '词库未收录的内容暂显示原文；安装离线翻译组件后可翻译。'
    return {'items': items, 'warning': warning, 'engine': engine.status()}


def _force_utf8_stdio():
    # Python's redirected stdio on Windows may still use the active ANSI code page.
    # Reconfigure before loading the translation runtime so JSON output can always
    # contain Chinese text. Keep this defensive even though _run also sets env vars.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except (AttributeError, OSError):
            pass


def worker(root):
    _force_utf8_stdio()
    runtime = root / 'runtime'
    if not (runtime/'ctranslate2').is_dir():
        runtime = root.parent / 'offline-translation' / 'runtime'
    sys.path.insert(0, str(runtime))
    import ctranslate2
    import sentencepiece
    package = root / 'model'
    meta = json.loads((package / 'metadata.json').read_text(encoding='utf-8'))
    tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(package / 'sentencepiece.model'))
    model = ctranslate2.Translator(str(package / 'model'), device='cpu', compute_type='int8', inter_threads=1, intra_threads=2)
    texts = json.loads(sys.stdin.read(1000000))
    outputs = []
    for text in texts:
        # Preserve paragraphs; bound individual token batches without dropping text.
        paragraphs = []
        for paragraph in text.split('\n'):
            sentences = re.split(r'(?<=[.!?])\s+', paragraph)
            results = []
            for sentence in sentences:
                tokens = tokenizer.encode(sentence, out_type=str)
                chunks = [tokens[n:n+200] for n in range(0, len(tokens), 200)]
                if not chunks:
                    continue
                prefix = meta.get('target_prefix', '')
                batches = model.translate_batch(chunks, beam_size=4, replace_unknowns=True,
                    max_decoding_length=512, target_prefix=[[prefix]]*len(chunks) if prefix else None)
                translated = tokenizer.decode([token for b in batches for token in b.hypotheses[0]]).replace('\u2581', ' ')
                if prefix and translated.startswith(prefix):
                    translated = translated[len(prefix):]
                results.append(translated.strip())
            paragraphs.append(' '.join(results))
        outputs.append('\n'.join(paragraphs))
    print(json.dumps(outputs, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--worker':
        worker(Path(sys.argv[2]))
