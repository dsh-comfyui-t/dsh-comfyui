"""Public model catalog and managed downloads. Standard library only.

Remote metadata is data, never HTML or a destination path. Credentials stay in
the sidecar's user directory and are only sent to their provider's API host.
"""
import hashlib
from contextlib import contextmanager
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import threading
import time
from urllib.parse import parse_qs, quote, urlencode, urlsplit
import urllib.error
import urllib.request
import uuid

import importlib.util
_assets_spec = importlib.util.spec_from_file_location('dsh_model_assets_online', Path(__file__).with_name('model_assets.py'))
assets = importlib.util.module_from_spec(_assets_spec)
_assets_spec.loader.exec_module(assets)

PROVIDERS = {'civitai': 'Civitai', 'huggingface': 'Hugging Face', 'modelscope': 'ModelScope · 魔搭', 'hfmirror': 'HF-Mirror · 第三方镜像'}
CIVITAI_HOSTS = ('civitai.com', 'civitai.red')

def canonical_provider(value):
    return 'civitai' if str(value).lower() in ('civitai', 'civitai.com', 'civitai.red', 'civitaired') else str(value)

TOKEN_HOSTS = {'civitai': 'civitai.com', 'huggingface': 'huggingface.co', 'modelscope': 'modelscope.cn'}
HF_ENDPOINTS = {'huggingface': 'https://huggingface.co', 'hfmirror': 'https://hf-mirror.com'}
DEFAULT_NETWORK = {'mode': 'system', 'proxy': '', 'domestic_direct': False}
DOMESTIC_HOSTS = ('hf-mirror.com', 'modelscope.cn', 'modelscope.oss-cn-beijing.aliyuncs.com', 'cdn-lfs-cn-1.modelscope.cn')
EXTENSIONS = {'.safetensors', '.sft', '.ckpt', '.pt', '.pth', '.bin', '.gguf', '.onnx'}
KINDS = {'Checkpoint': 'checkpoint', 'LORA': 'lora', 'LoCon': 'lora', 'DoRA': 'lora',
         'TextualInversion': 'embedding', 'VAE': 'vae', 'Controlnet': 'controlnet',
         'Upscaler': 'upscale', 'Text Encoder': 'clip', 'TextEncoder': 'clip', 'CLIP': 'clip', 'UNet': 'diffusion'}
ACTIVE = {'queued', 'running', 'verifying', 'paused'}


class CatalogError(Exception):
    pass


def clean_text(value, limit=16000):
    class TextOnly(HTMLParser):
        def __init__(self):
            super().__init__(); self.parts = []; self.hidden = 0
        def handle_starttag(self, tag, attrs):
            if tag in ('script', 'style'):
                self.hidden += 1
            if tag in ('br', 'p', 'div', 'li'):
                self.parts.append('\n')
        def handle_endtag(self, tag):
            if tag in ('script', 'style'):
                self.hidden = max(0, self.hidden - 1)
        def handle_data(self, data):
            if not self.hidden:
                self.parts.append(data)
    parser = TextOnly()
    parser.feed(str(value or '')[:limit * 2])
    return re.sub(r'\n{3,}', '\n\n', ''.join(parser.parts)).strip()[:limit]


def public_url(url, proxy_dns=None):
    p = urlsplit(str(url))
    if p.scheme != 'https' or p.username or p.password or p.port not in (None, 443):
        raise CatalogError('来源地址必须是公开 HTTPS 地址')
    host = (p.hostname or '').lower()
    allowed = host in ('civitai.com', 'civitai.red', 'image.civitai.com', 'huggingface.co', 'hf.co', 'hf-mirror.com', 'modelscope.cn', 'modelscope.oss-cn-beijing.aliyuncs.com') or any(
        host.endswith(suffix) for suffix in ('.civitai.com', '.civitai.red', '.huggingface.co', '.hf.co', '.xethub.hf.co', '.cloudflarestorage.com', '.cloudfront.net', '.modelscope.cn', '.hf-mirror.com'))
    if not allowed:
        raise CatalogError('来源返回了不受支持的下载 / 图片域名')
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise CatalogError('拒绝访问本机或内网来源地址')
    except socket.gaierror as e:
        # Corporate / WSL proxy setups can delegate DNS to the HTTPS proxy.
        # The fixed provider/CDN allowlist still applies to every redirect.
        if not (urllib.request.getproxies().get('https') if proxy_dns is None else proxy_dns):
            raise CatalogError('无法解析来源域名，请检查网络') from e
    return url


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, validator=None):
        super().__init__(); self.validator = validator

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        (self.validator or public_url)(newurl)
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if result is not None and urlsplit(req.full_url).hostname != urlsplit(newurl).hostname:
            result.remove_header('Authorization')
        return result


def validate_network(value):
    if not isinstance(value, dict):
        raise ValueError('网络设置格式无效')
    mode = value.get('mode', 'system')
    proxy = str(value.get('proxy') or '').strip()
    if mode not in ('system', 'direct', 'custom'):
        raise ValueError('请选择有效的连接方式')
    if proxy:
        try:
            u = urlsplit(proxy)
            valid = u.scheme == 'http' and u.hostname and u.port and not u.username and not u.password and u.path in ('', '/') and not u.query and not u.fragment
        except ValueError:
            valid = False
        if not valid or len(proxy) > 1000 or any(ord(c) < 33 for c in proxy):
            raise ValueError('代理请填写 http://主机:端口（HTTP / mixed 端口）；不支持 SOCKS、HTTPS 代理地址、账号密码或路径')
        proxy = proxy.rstrip('/')
    if mode == 'custom' and not proxy:
        raise ValueError('请填写 HTTP 代理地址')
    return {'mode': mode, 'proxy': proxy, 'domestic_direct': bool(value.get('domestic_direct', False))}


def domestic_host(url):
    host = (urlsplit(url).hostname or '').lower()
    return any(host == h or host.endswith('.' + h) for h in DOMESTIC_HOSTS)


class CatalogProxy(urllib.request.ProxyHandler):
    """Choose the proxy again on redirects; mainland destinations can stay direct."""
    def __init__(self, network):
        self.network = dict(network)
        mode = network['mode']
        proxies = urllib.request.getproxies() if mode == 'system' else {} if mode == 'direct' else {'http': network['proxy'], 'https': network['proxy']}
        super().__init__(proxies)

    def proxy_open(self, req, proxy, type):
        if self.network['domestic_direct'] and domestic_host(req.full_url):
            return None
        if self.network['mode'] == 'custom':
            # All catalog requests are HTTPS and custom URLs have no credentials.
            # Explicit user selection must not be silently bypassed by NO_PROXY.
            selected = urlsplit(proxy)
            req.set_proxy(selected.netloc, selected.scheme)
            return None
        return super().proxy_open(req, proxy, type)


def safe_filename(name):
    name = str(name or '')
    if not name or len(name) > 180 or name in ('.', '..') or any(c in name for c in '/\\:\x00<>"|?*') or any(ord(c)<32 for c in name) or name[-1:] in (' ', '.'):
        raise ValueError('模型文件名无效')
    if re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', name, re.I):
        raise ValueError('模型文件名不适用于 Windows')
    if Path(name).suffix.lower() not in EXTENSIONS:
        raise ValueError('请选择模型权重文件；不下载脚本或压缩包')
    return name


class OnlineModels:
    def __init__(self, data_dir, roots):
        self.data_dir = Path(data_dir); self.roots = roots
        self.lock = threading.RLock(); self.semaphore = threading.Semaphore(2)
        self.jobs = {}; self.cancel_events = {}; self.pause_events = {}; self.images = {}; self.cache = {}
        self.settings_path = self.data_dir / 'online_models.json'
        self.history_path = self.data_dir / 'model_downloads.json'
        self.tokens = {}; self.civitai_domain = 'civitai.com'; self.network = dict(DEFAULT_NETWORK); self.context = threading.local()
        self.diagnostics = {}; self._load()

    def _load(self):
        try:
            data = json.loads(self.settings_path.read_text(encoding='utf-8'))
            tokens = data.get('tokens', {}) if isinstance(data, dict) else {}
            domain = data.get('civitai_domain') if isinstance(data, dict) else None
            self.civitai_domain = domain if domain in CIVITAI_HOSTS else 'civitai.com'
            try:
                self.network = validate_network(data.get('network', DEFAULT_NETWORK)) if isinstance(data, dict) else dict(DEFAULT_NETWORK)
            except ValueError:
                self.network = dict(DEFAULT_NETWORK)
            self.tokens = {p: t for p, t in tokens.items() if p in TOKEN_HOSTS and isinstance(t, str) and len(t) <= 2048 and '\n' not in t and '\r' not in t} if isinstance(tokens, dict) else {}
        except (OSError, ValueError, TypeError):
            self.tokens = {}
        try:
            for job in json.loads(self.history_path.read_text(encoding='utf-8'))[-50:]:
                if job['status'] in ACTIVE:
                    job.update(status='interrupted', message='服务重启中断了下载，请重试')
                    if re.fullmatch(r'[a-f0-9]{32}', str(job.get('id'))):
                        target = Path(str(job.get('path') or '')).resolve()
                        try:
                            if any(target.is_relative_to(Path(r).resolve()) for r in self.roots(job.get('kind'))):
                                (target.parent / ('.dsh-' + job['id'] + '.part')).unlink(missing_ok=True)
                        except (OSError, ValueError):
                            pass
                self.jobs[job['id']] = job
        except (OSError, ValueError, TypeError, KeyError):
            self.jobs = {}

    def _write(self, path, data):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix('.tmp')
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, path)

    def settings(self, payload=None):
        with self.lock:
            if payload is not None:
                tokens = dict(self.tokens)
                for provider in TOKEN_HOSTS:
                    if provider in payload:
                        token = str(payload[provider]).strip()
                        if len(token) > 2048 or '\n' in token or '\r' in token:
                            raise ValueError('API Token 格式无效')
                        tokens[provider] = token
                network = validate_network(payload.get('network', self.network))
                domain = payload.get('civitai_domain', self.civitai_domain)
                if domain not in CIVITAI_HOSTS:
                    raise ValueError('Civitai 地址仅支持 civitai.com 或 civitai.red')
                self._write(self.settings_path, {'tokens': tokens, 'network': network, 'civitai_domain': domain})
                self.civitai_domain = domain
                self.tokens = tokens; self.network = network
                self.cache.clear()
            return {'providers': [{'id': p, 'name': label, 'configured': bool(self.tokens.get(p))} for p, label in PROVIDERS.items()], 'network': dict(self.network), 'network_version': 1, 'civitai_domain': self.civitai_domain, 'civitai_domains': list(CIVITAI_HOSTS), 'diagnostic_id': next(reversed(self.diagnostics), None)}

    def _open(self, url, provider='', timeout=30, extra_headers=None):
        provider = canonical_provider(provider)
        parsed = urlsplit(url)
        if provider == 'civitai' and parsed.hostname in CIVITAI_HOSTS and parsed.scheme == 'https' and not parsed.username and not parsed.password and parsed.port in (None, 443):
            domain = getattr(self.context, 'civitai_domain', self.civitai_domain)
            url = parsed._replace(netloc=domain).geturl()
        network = dict(getattr(self.context, 'network', self.network))
        proxy = CatalogProxy(network)
        validator = lambda u: public_url(u, proxy_dns=bool(proxy.proxies.get('https')) and not (network['domestic_direct'] and domestic_host(u)))
        validator(url)
        headers = {'User-Agent': 'DSH-ComfyUI-Console/0.6.2', 'Accept': 'application/json'}
        headers.update(extra_headers or {})
        host = urlsplit(url).hostname
        if self.tokens.get(provider) and (host in CIVITAI_HOSTS if provider == 'civitai' else host == TOKEN_HOSTS.get(provider)):
            headers['Authorization'] = 'Bearer ' + self.tokens[provider]
        try:
            return urllib.request.build_opener(proxy, SafeRedirect(validator)).open(urllib.request.Request(url, headers=headers), timeout=timeout)
        except urllib.error.HTTPError as e:
            messages = {401: '需要 API Token 或当前凭证无效', 403: '来源拒绝访问；请检查 Token、模型授权或网络地区限制',
                        404: '模型或文件已移除', 429: '来源请求过于频繁，请稍后重试'}
            raise CatalogError(messages.get(e.code, '来源请求失败（HTTP %s）' % e.code)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise CatalogError('连接模型来源失败，请检查网络后重试') from None

    def _json(self, url, provider=''):
        with self._open(url, provider, timeout=12 if getattr(self.context, 'diagnosing', False) else 30) as response:
            data = response.read(16 * 1024 * 1024 + 1)
            if len(data) > 16 * 1024 * 1024:
                raise CatalogError('来源返回数据过大')
        try:
            return json.loads(data)
        except ValueError:
            raise CatalogError('来源没有返回有效的模型数据') from None

    def _image(self, url):
        p = urlsplit(str(url or ''))
        if p.scheme != 'https' or not p.hostname:
            return ''
        # Metadata only registers a URL. Validation and DNS checks occur on fetch.
        key = hashlib.sha256(url.encode()).hexdigest()[:32]
        with self.lock:
            if len(self.images) >= 2048:
                self.images.pop(next(iter(self.images)))
            self.images[key] = url
        return '/online/images/' + key

    def _image_url(self, key):
        with self.lock:
            url = self.images.get(key)
        if isinstance(url, dict):
            entries = self._ms_files(url['repo'])
            images = self._ms_images(url['repo'], entries)
            if not images:
                raise CatalogError('该模型没有可用的预览图')
            url = images[0]
            with self.lock:
                self.images[key] = url
        return url

    def image(self, key, timeout=30):
        url = self._image_url(key)
        if not url:
            raise ValueError('预览图已失效，请刷新搜索')
        with self._open(url, timeout=timeout) as response:
            mime = response.headers.get('Content-Type', '').split(';')[0].lower()
            if mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'):
                raise CatalogError('来源预览图格式不受支持')
            data = response.read(8 * 1024 * 1024 + 1)
            if len(data) > 8 * 1024 * 1024:
                raise CatalogError('来源预览图过大')
        return mime, data

    def save_model_preview(self, root, target, model, version, event=None, progress=None):
        # Model-level cover can belong to a different version. Only use it
        # if the provider has no version-specific gallery at all.
        keys = version.get('images') or ([] if model.get('versions') else ([model['image']] if model.get('image') else []))
        captured = version.get('_preview_urls') or []
        if captured:
            keys = [self._image(url) for url in captured]
        keys = list(dict.fromkeys(keys))[:8]
        if not keys:
            return {'status': 'missing', 'count': 0, 'message': '来源没有预览图'}
        saved = []; existing = []; errors = []
        for index, key in enumerate(keys, 1):
            if event and event.is_set():
                errors.append('已跳过剩余预览图'); break
            if progress:
                progress(index, len(keys))
            found = assets.slot_preview(root, target, index, store=self.data_dir/"model_assets")
            if found:
                existing.append(found.name); continue
            try:
                stat = os.stat(target)
                mime, data = self.image(key.rsplit('/', 1)[-1], timeout=12)
                if event and event.is_set():
                    errors.append('已跳过剩余预览图'); break
                current = os.stat(target)
                if (current.st_ino, current.st_size, current.st_mtime_ns) != (stat.st_ino, stat.st_size, stat.st_mtime_ns):
                    raise ValueError('模型文件发生变化，请重新获取预览图')
                path = assets.save_preview(root, target, mime, data, slot=index, store=self.data_dir/"model_assets")
                saved.append(path.name)
            except Exception as e:
                errors.append('第 %d 张：%s' % (index, str(e)[:300]))
        count = len(saved) + len(existing)
        status = 'partial' if errors and count else 'failed' if errors else 'saved' if saved else 'existing'
        return {'status': status, 'count': count, 'filenames': saved + existing, 'errors': errors,
            'message': ('已保存 / 复用 %d 张预览图' % count) + ('；' + '；'.join(errors) if errors else '')}

    def _civitai(self, model):
        versions = []
        for v in model.get('modelVersions') or []:
            files = []
            for f in v.get('files') or []:
                try:
                    name = safe_filename(f.get('name'))
                except ValueError:
                    continue
                url = str(f.get('downloadUrl') or '')
                try:
                    parsed = urlsplit(url)
                    valid = parsed.scheme == 'https' and parsed.hostname in CIVITAI_HOSTS and not parsed.username and not parsed.password and parsed.port in (None, 443)
                except ValueError:
                    valid = False
                if not valid:
                    continue
                files.append({'id': str(f.get('id')), 'name': name, 'remote_path': name, 'url': url,
                    'size': int(float(f.get('sizeKB', 0) or 0) * 1024), 'sha256': str((f.get('hashes') or {}).get('SHA256') or '').lower(),
                    'primary': bool(f.get('primary')), 'format': (f.get('metadata') or {}).get('format', ''),
                    'precision': (f.get('metadata') or {}).get('fp', ''), 'type': str(f.get('type') or '')})
            images = [i for i in v.get('images') or [] if i.get('type', 'image') == 'image' and i.get('url')][:8]
            flags=int(v.get('flags') or 0)
            early=bool(flags & 8) or 'early' in str(v.get('availability') or '').lower()
            versions.append({'id': str(v.get('id')), 'name': str(v.get('name') or ''), 'base_model': str(v.get('baseModel') or ''),
                'trained_words': v.get('trainedWords') or [], 'files': files,
                'early_access': early, 'availability': str(v.get('availability') or ''), 'nsfw_level': v.get('nsfwLevel'),
                'images': [self._image(i['url']) for i in images],
                'image_original': images[0]['url'] if images else '', 'description': clean_text(v.get('description'))})
        early_access=any(v.get('early_access') for v in versions)
        return {'provider': 'civitai', 'id': str(model['id']), 'name': str(model.get('name') or ''),
            'early_access': early_access, 'paid_access': bool(model.get('hasActivePaidAccess')),
            'token_configured': bool(self.tokens.get('civitai')),
            'nsfw': bool(model.get('nsfw')), 'nsfw_level': model.get('nsfwLevel'),
            'type': str(model.get('type') or ''), 'author': str((model.get('creator') or {}).get('username') or ''),
            'description': clean_text(model.get('description')), 'tags': model.get('tags') or [],
            'url': 'https://' + getattr(self.context, 'civitai_domain', self.civitai_domain) + '/models/' + str(model['id']), 'versions': versions,
            'image': next((v['images'][0] for v in versions if v['images']), ''),
            'base_model': versions[0]['base_model'] if versions else '',
            'downloads': int((model.get('stats') or {}).get('downloadCount') or 0),
            'likes': int((model.get('stats') or {}).get('thumbsUpCount') or 0),
            'license': ', '.join(str(model[k]) for k in ('allowCommercialUse',) if model.get(k))}

    def _hf_type(self, model, tags):
        """Classify single-repo HF/ModelScope entries instead of defaulting everything to Checkpoint."""
        tag_text = ' '.join(str(t).lower() for t in (tags or []))
        pipeline = str(model.get('pipeline_tag') or '').lower()
        repo = str(model.get('id') or model.get('modelId') or '').lower()
        name = repo.rsplit('/', 1)[-1]
        if 'lora' in tag_text or 'lora' in name:
            return 'LORA'
        if pipeline in {'text-generation', 'text2text-generation', 'feature-extraction', 'fill-mask', 'sentence-similarity'} \
                or any(word in tag_text for word in ('text-encoder', 'text_encoder', 'text-generation')) \
                or re.search(r'(^|[-_/])(clip|t5|text[_-]?encoder)([-_/]|$)', name) \
                or (re.search(r'qwen[._-]?(?:3(?:\.5)?|2\.5)', name) and 'image' not in name):
            return 'TextEncoder'
        if 'vae' in tag_text or re.search(r'(^|[-_/])vae([-_/]|$)', name):
            return 'VAE'
        if 'controlnet' in tag_text or 'controlnet' in name:
            return 'Controlnet'
        if any(word in tag_text for word in ('upscaler', 'super-resolution')) or 'upscal' in name:
            return 'Upscaler'
        if any(word in tag_text for word in ('textual-inversion', 'textual inversion')) or re.search(r'(^|[-_/])embedding([-_/]|$)', name):
            return 'TextualInversion'
        if 'unet' in tag_text or 'diffusion' in tag_text:
            return 'UNet'
        return 'Checkpoint'

    def _hf(self, model, detailed=False, provider='huggingface'):
        endpoint = HF_ENDPOINTS[provider]
        repo = str(model.get('id') or model.get('modelId') or '')
        if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
            # Some official repositories have a single-component id.
            if not re.fullmatch(r'[\w.-]+', repo):
                raise CatalogError('Hugging Face 模型 ID 无效')
        card = model.get('cardData') or {}; tags = model.get('tags') or []
        model_type = self._hf_type(model, tags)
        revision = str(model.get('sha') or 'main')
        files = []
        images = []
        for f in model.get('siblings') or []:
            name = str(f.get('rfilename') or '')
            if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and len(images) < 8:
                images.append(self._image(endpoint + '/' + quote(repo, safe='/') + '/resolve/' + quote(revision, safe='') + '/' + quote(name, safe='/')))
            try:
                filename = safe_filename(name.split('/')[-1])
            except ValueError:
                continue
            if name.startswith('/') or any(p in ('..', '.') for p in name.split('/')):
                continue
            lfs = f.get('lfs') or {}
            files.append({'id': name, 'name': filename, 'remote_path': name,
                'url': endpoint + '/' + quote(repo, safe='/') + '/resolve/' + quote(revision, safe='') + '/' + quote(name, safe='/'),
                'size': int(f.get('size') or lfs.get('size') or 0), 'sha256': str(lfs.get('sha256') or '').lower(),
                'primary': False, 'format': Path(name).suffix[1:]})
        widget = card.get('widget') or []
        if isinstance(widget, list):
            for w in widget[:3]:
                url = (w.get('output') or {}).get('url') if isinstance(w, dict) else None
                if url:
                    if not str(url).startswith('https://'):
                        url = endpoint + '/' + quote(repo, safe='/') + '/resolve/' + quote(revision, safe='') + '/' + quote(str(url), safe='/')
                    if provider == 'hfmirror' and str(url).startswith('https://huggingface.co/'):
                        url = endpoint + str(url)[len('https://huggingface.co'):]
                    images.append(self._image(url))
        base = card.get('base_model') or ''
        return {'provider': provider, 'id': repo, 'name': str(card.get('model_name') or repo.split('/')[-1]),
            'author': repo.split('/')[0] if '/' in repo else '', 'type': model_type,
            'description': clean_text(card.get('description') or model.get('description') or ''), 'tags': tags[:30],
            'url': endpoint + '/' + quote(repo, safe='/'), 'base_model': ', '.join(base) if isinstance(base, list) else str(base),
            'versions': [{'id': revision, 'name': 'main · ' + revision[:8], 'base_model': str(base), 'trained_words': [],
                'files': files, 'images': images, 'image_original': '', 'description': ''}] if detailed else [],
            'image': images[0] if images else '', 'downloads': int(model.get('downloads') or 0), 'likes': int(model.get('likes') or 0),
            'origin_url': 'https://huggingface.co/' + quote(repo, safe='/'), 'via': PROVIDERS[provider],
            'license': str(card.get('license') or ''), 'gated': bool(model.get('gated')), 'token_configured': bool(self.tokens.get(provider))}

    @staticmethod
    def _repo_id(repo):
        if not re.fullmatch(r'[\w.-]+/[\w.-]+', str(repo)) or any(p in ('.', '..') for p in str(repo).split('/')):
            raise ValueError('模型仓库 ID 无效')
        return str(repo)

    @staticmethod
    def _ms_data(raw):
        if raw.get('success') is False or raw.get('Code', 200) != 200:
            raise CatalogError(clean_text(raw.get('message') or raw.get('Message') or 'ModelScope 接口返回失败', 400))
        return raw.get('data') or raw.get('Data') or {}

    def _ms_files(self, repo):
        self._repo_id(repo)
        raw = self._ms_data(self._json('https://modelscope.cn/api/v1/models/' + quote(repo, safe='/') + '/repo/files?Revision=master&Recursive=true', 'modelscope'))
        entries = raw.get('Files') or []
        # Official SDK documents a silent truncation threshold of 1000 entries.
        if len(entries) >= 1000:
            raise CatalogError('该仓库文件过多，请到 ModelScope 官网查看完整文件列表')
        return entries

    def _ms_url(self, repo, entry):
        rev = str(entry.get('Revision') or 'master')
        return 'https://modelscope.cn/api/v1/models/' + quote(repo, safe='/') + '/repo?' + urlencode({'Revision': rev, 'FilePath': entry['Path']})

    def _ms_images(self, repo, entries):
        images = [e for e in entries if str(e.get('Path') or '').lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and e.get('Type') != 'tree']
        images.sort(key=lambda e: (not any(w in e['Path'].lower() for w in ('montage', 'preview', 'cover')), e['Path']))
        return [self._ms_url(repo, e) for e in images[:8]]

    def _ms(self, model, entries=None):
        repo = self._repo_id(model.get('id'))
        tags = model.get('tags') or []
        kind = self._hf_type(model, tags)
        base = str(model.get('base_model') or '')
        result = {'provider': 'modelscope', 'id': repo, 'name': str(model.get('display_name') or repo.split('/')[-1]),
            'author': repo.split('/')[0], 'type': kind, 'base_model': base, 'tags': tags[:30],
            'downloads': int(model.get('downloads') or 0), 'likes': int(model.get('likes') or 0),
            'description': clean_text(model.get('description') or model.get('readme') or ''), 'license': str(model.get('license') or ''),
            'gated': bool(model.get('gated')), 'token_configured': bool(self.tokens.get('modelscope')), 'url': 'https://modelscope.cn/models/' + quote(repo, safe='/'), 'versions': [], 'image': ''}
        if entries is None:
            key = hashlib.sha256(('modelscope-cover:' + repo).encode()).hexdigest()[:32]
            with self.lock:
                if len(self.images) >= 2048:
                    self.images.pop(next(iter(self.images)))
                self.images.setdefault(key, {'repo': repo})
            result['image'] = '/online/images/' + key
            return result
        files = []
        for entry in entries:
            path = str(entry.get('Path') or '')
            if entry.get('Type') == 'tree' or path.startswith('/') or any(p in ('.', '..') for p in path.split('/')):
                continue
            try:
                name = safe_filename(path.split('/')[-1])
            except ValueError:
                continue
            files.append({'id': path, 'name': name, 'remote_path': path, 'url': self._ms_url(repo, entry),
                'size': int(entry.get('Size') or 0), 'sha256': str(entry.get('Sha256') or '').lower(),
                'primary': False, 'format': Path(name).suffix[1:]})
        images = [self._image(u) for u in self._ms_images(repo, entries)]
        result['image'] = images[0] if images else ''
        # Entries carry their own commit revisions. Each selected download is pinned
        # to that revision and checked against its SHA-256, even if master changes.
        result['versions'] = [{'id': 'master', 'name': 'master · 文件固定到各自提交', 'base_model': base,
            'files': files, 'images': images, 'trained_words': [], 'description': '', 'image_original': ''}]
        return result

    def search(self, query):
        provider = canonical_provider(query.get('provider') or 'civitai')
        if provider not in PROVIDERS:
            raise ValueError('该来源暂不支持站内搜索')
        q = str(query.get('q') or '').strip()[:200]
        page = max(1, min(40, int(query.get('page') or 1)))
        cursor = str(query.get('cursor') or '')[:3000]
        limit = 24
        key = json.dumps(query, sort_keys=True)
        with self.lock:
            cached = self.cache.get(key)
            if cached and time.monotonic() - cached[0] < 90:
                return cached[1]
        if provider == 'civitai':
            params = {'limit': limit, 'sort': str(query.get('sort') or 'Most Downloaded'),
                'period': str(query.get('period') or 'AllTime'), 'nsfw': 'true' if query.get('nsfw') else 'false'}
            if q:
                params['query'] = q
            if cursor:
                params['cursor'] = cursor
            elif not q:
                # Civitai rejects query+page. Browse requests may use page 1 directly,
                # while text search starts without page and follows opaque cursors.
                params['page'] = page
            types=[t.strip() for t in str(query.get('type') or '').split(',') if t.strip()][:24]
            bases=[b.strip()[:100] for b in str(query.get('base') or '').split(',') if b.strip()][:12]
            if types:
                params['types'] = types
            if bases:
                params['baseModels'] = bases
            raw = self._json('https://civitai.com/api/v1/models?' + urlencode(params, doseq=True), provider)
            items = [self._civitai(m) for m in raw.get('items') or []]
            meta = raw.get('metadata') or {}
            nxt = str(meta.get('nextPage') or '')
            next_cursor = str(meta.get('nextCursor') or '') or (parse_qs(urlsplit(nxt).query).get('cursor') or [''])[0]
            more = bool(next_cursor) or bool(nxt) or bool(meta.get('totalPages') and page < int(meta['totalPages']))
            result = {'items': items, 'has_more': more, 'cursor': next_cursor,
                'page': page, 'total': meta.get('totalItems'), 'provider': provider}
        elif provider == 'modelscope':
            params = {'page_number': page, 'page_size': limit, 'search': q,
                'sort': {'Newest': 'last_modified', 'Highest Rated': 'likes'}.get(str(query.get('sort')), 'downloads')}
            if not q:
                params['filter.task'] = 'text-to-image-synthesis'
            if query.get('type') == 'LORA':
                params['filter.library'] = 'lora'
            raw = self._ms_data(self._json('https://modelscope.cn/openapi/v1/models?' + urlencode(params), provider))
            items = [self._ms(m) for m in raw.get('models') or []]
            total = int(raw.get('total_count') or 0)
            result = {'items': items, 'has_more': page * limit < total, 'cursor': '', 'page': page, 'total': total, 'provider': provider}
        else:
            endpoint = HF_ENDPOINTS[provider]
            params = {'limit': limit, 'full': 'true', 'cardData': 'true', 'sort': {'Newest': 'createdAt',
                'Highest Rated': 'likes'}.get(str(query.get('sort')), 'downloads'), 'direction': -1}
            if q:
                params['search'] = q
            filters = []
            if not q:
                filters.append('comfyui')
            if 'LORA' in [t.strip() for t in str(query.get('type') or '').split(',') if t.strip()]:
                filters.append('lora')
            base=str(query.get('base') or '').split(',')[0].strip()
            if base:
                filters.append('base_model:' + base)
            if filters:
                params['filter'] = ','.join(filters)
            # HF cursor is an API pagination URL, never a user-selected host.
            url = endpoint + '/api/models?' + urlencode(params)
            if cursor:
                p = urlsplit(cursor)
                if p.scheme != 'https' or p.netloc not in (urlsplit(endpoint).netloc, 'huggingface.co') or p.path != '/api/models':
                    raise ValueError('分页游标无效')
                url = endpoint + p.path + '?' + p.query
            with self._open(url, provider, timeout=12 if getattr(self.context, 'diagnosing', False) else 30) as response:
                blob = response.read(16 * 1024 * 1024 + 1)
                if len(blob) > 16 * 1024 * 1024:
                    raise CatalogError('来源数据过大')
                raw = json.loads(blob)
                match = re.search(r'<([^>]+)>;\s*rel="next"', response.headers.get('Link', ''))
                next_cursor = match.group(1) if match else ''
            result = {'items': [self._hf(m, provider=provider) for m in raw], 'has_more': bool(next_cursor), 'cursor': next_cursor,
                'page': page, 'total': None, 'provider': provider}
        with self.lock:
            if len(self.cache) >= 60:
                self.cache.pop(next(iter(self.cache)))
            self.cache[key] = (time.monotonic(), result)
        return result

    def detail(self, provider, model_id):
        provider = canonical_provider(provider)
        if provider == 'civitai':
            if not str(model_id).isdigit():
                raise ValueError('Civitai 模型 ID 无效')
            return self._civitai(self._json('https://civitai.com/api/v1/models/' + str(model_id), provider))
        if provider == 'modelscope':
            self._repo_id(model_id)
            data = self._ms_data(self._json('https://modelscope.cn/openapi/v1/models/' + quote(str(model_id), safe='/'), provider))
            return self._ms(data, self._ms_files(str(model_id)))
        if provider in HF_ENDPOINTS:
            if not re.fullmatch(r'[\w.-]+(?:/[\w.-]+)?', str(model_id)) or any(p in ('.', '..') for p in str(model_id).split('/')):
                raise ValueError('Hugging Face 模型 ID 无效')
            data = self._json(HF_ENDPOINTS[provider] + '/api/models/' + quote(str(model_id), safe='/') + '?blobs=true', provider)
            return self._hf(data, True, provider)
        raise ValueError('来源不受支持')

    def diagnose(self, payload):
        provider = canonical_provider(payload.get('provider') or 'civitai')
        if provider not in PROVIDERS:
            raise ValueError('来源不受支持')
        with self.lock:
            if any(j['status'] == 'running' for j in self.diagnostics.values()):
                raise ValueError('连接检测正在进行，请等待结束')
            key = uuid.uuid4().hex
            job = {'id': key, 'provider': provider, 'status': 'running', 'network': dict(self.network),
                'created_at': time.time(), 'civitai_domain': self.civitai_domain, 'items': [{'kind': k, 'label': label, 'status': 'pending', 'message': '等待检测'}
                    for k, label in (('search', '搜索 / 元数据'), ('image', '预览图'), ('download', '权重下载'))]}
            self.diagnostics = {key: job}
            snapshot = json.loads(json.dumps(job))
            threading.Thread(target=self._diagnose, args=(job,), daemon=True).start()
            return snapshot

    def diagnosis(self, key):
        with self.lock:
            if key not in self.diagnostics:
                raise ValueError('检测记录不存在，请重新检测')
            return json.loads(json.dumps(self.diagnostics[key]))

    def _diagnose(self, job):
        self.context.network = job['network']; self.context.civitai_domain = job.get('civitai_domain', self.civitai_domain); self.context.diagnosing = True
        provider = job['provider']
        model = None; setup_error = ''
        try:
            step = job['items'][0]; start = time.monotonic()
            with self.lock:
                step.update(status='running', message='正在请求模型列表…')
            try:
                data = self.search({'provider': provider, 'q': 'Anima', 'page': 1, '_diagnostic': job['id']})
                items = data.get('items') or []
                with self.lock:
                    step.update(status='passed', message='搜索成功，返回 %d 条模型' % len(items), ms=int((time.monotonic()-start)*1000),
                        host=job.get('civitai_domain', 'civitai.com') if provider == 'civitai' else TOKEN_HOSTS.get(provider, 'hf-mirror.com'),
                        route='direct' if job['network']['mode']=='direct' or (job['network']['domestic_direct'] and provider in ('modelscope','hfmirror')) else job['network']['mode'])
                if items:
                    candidate = next((m for m in items if not m.get('gated')), items[0])
                    model = candidate if candidate.get('versions') else self.detail(provider, candidate['id'])
                else:
                    setup_error = '搜索成功但未返回样本模型'
            except Exception as e:
                setup_error = str(e)[:400]
                with self.lock:
                    if step['status'] != 'passed':
                        step.update(status='failed', message=setup_error, ms=int((time.monotonic()-start)*1000))
            for step in job['items'][1:]:
                start = time.monotonic()
                with self.lock:
                    step.update(status='running', message='正在检测…')
                try:
                    if not model:
                        with self.lock:
                            step.update(status='skipped', message='未取得检测样本：' + setup_error)
                        continue
                    if step['kind'] == 'image':
                        key = (model.get('image') or '').rsplit('/', 1)[-1]
                        url = self._image_url(key) if key else ''
                    else:
                        file = next((f for v in model.get('versions') or [] for f in v.get('files') or []
                            if not re.search(r'-\d{5}-of-\d{5}\.', f['name'])), None)
                        url = file['url'] if file else ''
                    if not url:
                        with self.lock:
                            step.update(status='skipped', message='样本没有预览图' if step['kind'] == 'image' else '样本没有可检测的单文件权重')
                        continue
                    # Read a maximum 1 KiB. If Range is ignored, close immediately;
                    # never save or queue a model during a connectivity check.
                    with self._open(url, provider if step['kind'] == 'download' else '', timeout=12,
                                    extra_headers={'Range': 'bytes=0-1023'}) as response:
                        mime = response.headers.get('Content-Type', '').split(';')[0].lower()
                        if step['kind'] == 'image' and mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'):
                            raise CatalogError('来源没有返回可用的预览图')
                        if step['kind'] == 'download' and ('html' in mime or 'json' in mime):
                            raise CatalogError('来源返回了网页 / 错误数据，未取得权重')
                        block = response.read(1024)
                        if not block:
                            raise CatalogError('来源返回空数据')
                        final = response.geturl() if hasattr(response, 'geturl') else url
                    host = urlsplit(final).hostname or ''
                    note = '预览图连接成功' if step['kind'] == 'image' else '已读取权重前 1 KiB；未保存文件，不代表大文件全程稳定'
                    with self.lock:
                        step.update(status='passed', message=note, host=host, ms=int((time.monotonic()-start)*1000),
                            route='direct' if job['network']['mode'] == 'direct' or (job['network']['domestic_direct'] and domestic_host(final)) else job['network']['mode'])
                except Exception as e:
                    with self.lock:
                        step.update(status='failed', message=str(e)[:400], ms=int((time.monotonic()-start)*1000))
        except Exception as e:
            with self.lock:
                job['error'] = str(e)[:400]
        finally:
            with self.lock:
                for step in job['items']:
                    if step['status'] in ('running', 'pending'):
                        step.update(status='skipped', message='检测未完成，请重试')
                job.update(status='completed', finished_at=time.time())
            self.context.__dict__.clear()

    def targets(self):
        result = []
        for kind, name in (('checkpoint', '底模 · Checkpoint'), ('diffusion', '底模 · Diffusion / UNet'), ('lora', 'LoRA'),
                           ('clip', 'Text Encoder'), ('vae', 'VAE'), ('upscale', '放大模型'), ('controlnet', 'ControlNet'), ('embedding', 'Embedding')):
            for i, root in enumerate(self.roots(kind)):
                result.append({'kind': kind, 'root_id': i, 'path': str(root), 'label': name + ' · ' + str(root)})
        return {'items': result}

    def downloads(self):
        with self.lock:
            return {'items': [dict(j) for j in list(self.jobs.values())[-50:]][::-1]}

    def _persist(self):
        self._write(self.history_path, list(self.jobs.values())[-50:])

    def _probe_access(self, url, provider):
        try:
            with self._open(url, provider, timeout=15, extra_headers={'Range':'bytes=0-0'}) as response:
                response.read(1)
            return {'status':'ok','message':'可以下载'}
        except CatalogError as e:
            message=str(e)
            if 'API Token' in message or '凭证' in message:
                return {'status':'auth','message':'Civitai 需要登录/API Token，或当前账号没有该模型的访问权限。'}
            if '拒绝访问' in message:
                return {'status':'forbidden','message':'来源拒绝访问，请检查 Token、模型授权或网络地区限制。'}
            return {'status':'error','message':message}

    def check_access(self, payload):
        provider=canonical_provider(payload.get('provider'))
        url=str(payload.get('url') or '')
        if url:
            parsed=urlsplit(url)
            if provider!='civitai' or parsed.scheme!='https' or parsed.hostname not in CIVITAI_HOSTS or parsed.username or parsed.password or parsed.port not in (None,443):
                raise ValueError('权限预检地址无效')
            return self._probe_access(url, provider)
        model=self.detail(provider, str(payload.get('model_id') or ''))
        version=next((v for v in model['versions'] if v['id']==str(payload.get('version_id'))), None)
        if not version: raise ValueError('所选模型版本已失效，请刷新详情')
        file=next((f for f in version['files'] if f['id']==str(payload.get('file_id'))), None)
        if not file: raise ValueError('所选文件已失效，请刷新详情')
        return self._probe_access(file['url'], provider)

    def start(self, payload):
        provider, model_id = canonical_provider(payload.get('provider')), str(payload.get('model_id'))
        model = self.detail(provider, model_id)
        version = next((v for v in model['versions'] if v['id'] == str(payload.get('version_id'))), None)
        if not version:
            raise ValueError('所选模型版本已失效，请刷新详情')
        file = next((f for f in version['files'] if f['id'] == str(payload.get('file_id'))), None)
        if not file:
            raise ValueError('所选文件已失效，请刷新详情')
        version = dict(version)
        with self.lock:
            version['_preview_urls'] = [self.images.get(key.rsplit('/', 1)[-1]) for key in version.get('images') or []
                if isinstance(self.images.get(key.rsplit('/', 1)[-1]), str)]
        name = safe_filename(file['name'])
        if re.search(r'-\d{5}-of-\d{5}\.', name):
            raise ValueError('这是分片权重，需完整仓库及索引文件；请从官网按仓库说明下载')
        kind = str(payload.get('kind') or KINDS.get(model['type']) or 'checkpoint')
        roots = self.roots(kind)
        idx = int(payload.get('root_id') or 0)
        if idx < 0 or idx >= len(roots):
            raise ValueError('请选择有效模型根目录')
        root = Path(roots[idx]).resolve()
        folder = str(payload.get('folder') or '').strip().replace('\\', '/')
        if folder.startswith('/') or ':' in folder or any(p in ('.', '..') or p[-1:] in (' ', '.') or re.search(r'[\x00-\x1f<>"|?*]', p) or re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', p, re.I) for p in folder.split('/') if p):
            raise ValueError('分类目录必须位于模型根目录内')
        target = root.joinpath(*[p for p in folder.split('/') if p], name)
        if not target.resolve().is_relative_to(root):
            raise ValueError('下载目标越出了模型根目录')
        if target.exists():
            raise ValueError('同名文件已存在，请更换分类目录；不会覆盖原模型')
        with self.lock:
            if sum(j['status'] in ACTIVE for j in self.jobs.values()) >= 8:
                raise ValueError('下载队列已满，请等待当前任务完成')
            if any(j['status'] in ACTIVE and j.get('path') == str(target) for j in self.jobs.values()):
                raise ValueError('该文件已经在下载队列中')
            job_id = uuid.uuid4().hex
            job = {'id': job_id, 'provider': provider, 'model_id': model_id, 'model_name': model['name'],
                'filename': name, 'kind': kind, 'root_id': idx, 'path': str(target), 'status': 'queued',
                'received': 0, 'total': file['size'], 'speed': 0, 'message': '等待下载', 'created_at': time.time(),
                'version_id': str(payload.get('version_id') or ''), 'file_id': str(payload.get('file_id') or ''), 'folder': folder}
            self.jobs[job_id] = job; self.cancel_events[job_id] = threading.Event(); self.pause_events[job_id] = threading.Event()
            try:
                self._persist()
            except OSError:
                self.jobs.pop(job_id, None); self.cancel_events.pop(job_id, None); self.pause_events.pop(job_id, None)
                raise CatalogError('无法保存下载任务，请检查用户目录权限') from None
            for key in list(self.jobs):
                if len(self.jobs) <= 100:
                    break
                if self.jobs[key]['status'] not in ACTIVE:
                    self.jobs.pop(key)
            threading.Thread(target=self._download, args=(job, file, model, version, root, target), daemon=True).start()
            return dict(job)

    def cancel(self, job_id):
        with self.lock:
            if job_id not in self.jobs:
                raise ValueError('下载任务不存在')
            event = self.cancel_events.get(job_id)
            pause = self.pause_events.get(job_id)
            if event:
                event.set()
                if pause: pause.clear()
                if self.jobs[job_id]['status'] in ('queued', 'paused'):
                    self.jobs[job_id].update(status='cancelled', speed=0, message='下载已取消')
                    self._persist()
                else:
                    self.jobs[job_id]['message'] = '正在取消…'
            return dict(self.jobs[job_id])

    def pause(self, job_id):
        with self.lock:
            job=self.jobs.get(job_id)
            if not job: raise ValueError('下载任务不存在')
            if job['status'] not in ('running', 'paused'):
                raise ValueError('当前任务不能暂停或继续')
            event=self.pause_events.get(job_id)
            if not event: raise ValueError('下载任务状态已失效')
            if job['status']=='paused':
                event.clear();job.update(status='running',message='继续下载')
            else:
                event.set();job.update(status='paused',speed=0,message='已暂停')
            self._persist()
            return dict(job)

    def retry(self, job_id):
        with self.lock:
            job=self.jobs.get(job_id)
            if not job: raise ValueError('下载任务不存在')
            if job['status'] in ACTIVE: raise ValueError('任务正在进行中')
            if not job.get('version_id') or not job.get('file_id'):
                raise ValueError('该任务缺少重试信息，请重新打开模型详情下载')
            payload={'provider':job['provider'],'model_id':job['model_id'],'version_id':job['version_id'],
                'file_id':job['file_id'],'kind':job['kind'],'root_id':job['root_id'],'folder':job.get('folder','')}
        return self.start(payload)

    def clear_finished(self):
        with self.lock:
            for key in list(self.jobs):
                if self.jobs[key]['status'] not in ACTIVE:
                    self.jobs.pop(key,None)
            self._persist()
            return self.downloads()

    @contextmanager
    def _slot(self, event):
        acquired = False
        try:
            while not event.is_set():
                if self.semaphore.acquire(timeout=.2):
                    acquired = True
                    break
            if not acquired:
                raise InterruptedError()
            yield
        finally:
            if acquired:
                self.semaphore.release()

    def _download(self, job, file, model, version, root, target):
        event = self.cancel_events[job['id']]
        part = target.parent / ('.dsh-' + job['id'] + '.part')
        try:
            with self._slot(event):
                if event.is_set():
                    raise InterruptedError()
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.resolve().is_relative_to(root):
                    raise ValueError('下载目标目录发生了变化，请重新选择')
                size = int(file.get('size') or 0)
                if size and shutil.disk_usage(target.parent).free < size + 16 * 1024 * 1024:
                    raise ValueError('目标磁盘空间不足')
                with self.lock:
                    job.update(status='running', message='正在下载')
                start = time.monotonic(); digest = hashlib.sha256()
                pause_event = self.pause_events.get(job['id']) or threading.Event()
                with self._open(file['url'], model['provider'], timeout=25) as response, open(part, 'xb') as out:
                    mime = response.headers.get('Content-Type', '').lower()
                    if 'text/html' in mime or 'application/json' in mime:
                        raise CatalogError('来源返回了网页或错误信息，没有提供模型文件')
                    expected = int(response.headers.get('Content-Length') or 0)
                    if expected and shutil.disk_usage(target.parent).free < expected + 16 * 1024 * 1024:
                        raise ValueError('目标磁盘空间不足')
                    with self.lock:
                        job['total'] = expected or size
                    while True:
                        if event.is_set():
                            raise InterruptedError()
                        if pause_event.is_set():
                            paused_at=time.monotonic()
                            with self.lock:
                                job.update(status='paused', speed=0, message='已暂停')
                                self._persist()
                            while pause_event.is_set():
                                if event.is_set():
                                    raise InterruptedError()
                                time.sleep(.2)
                            start += time.monotonic()-paused_at
                            with self.lock:
                                job.update(status='running', message='继续下载')
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk); digest.update(chunk)
                        with self.lock:
                            job['received'] += len(chunk)
                            job['speed'] = int(job['received'] / max(.1, time.monotonic() - start))
                    if expected and job['received'] != expected:
                        raise CatalogError('下载文件不完整，请重试')
                if not job['received']:
                    raise CatalogError('来源返回了空文件')
                with self.lock:
                    job.update(status='verifying', message='正在校验文件')
                if file.get('sha256') and re.fullmatch(r'[a-f0-9]{64}', file['sha256']) and digest.hexdigest() != file['sha256']:
                    raise CatalogError('SHA-256 校验不匹配，文件没有加入模型库')
                if event.is_set():
                    raise InterruptedError()
                if not target.resolve().is_relative_to(root):
                    raise ValueError('下载目标目录发生了变化')
                # link() atomically refuses existing files on both Windows/Unix.
                os.link(part, target); part.unlink()
                source = {'provider': PROVIDERS[model['provider']], 'url': model['url'], 'title': model['name'],
                    'base_model': version['base_model'], 'version': version['name'], 'hash': digest.hexdigest(), 'method': 'online-download',
                    'provider_id': model['provider'], 'model_id': model['id'], 'version_id': version['id'],
                    'file_id': file['id']}
                try:
                    assets.save_source(root,target,source,self.data_dir/'model_assets')
                except (OSError,ValueError):
                    pass
                with self.lock:
                    job.update(status='verifying', speed=0, message='模型已保存，正在保存预览图')
                def preview_progress(index, total):
                    with self.lock:
                        job['message'] = '模型已保存，正在保存预览图 %d / %d' % (index, total)
                preview = self.save_model_preview(root, target, model, version, event, preview_progress)
                with self.lock:
                    job.update(status='completed', speed=0, preview=preview, sha256=digest.hexdigest(), verified=bool(re.fullmatch(r'[a-f0-9]{64}', file.get('sha256') or '')),
                        message='下载完成，已加入本地模型目录' + ('；预览图未保存，可在本地模型库重试' if preview['status'] in ('failed', 'partial') else ''))
        except InterruptedError:
            with self.lock:
                job.update(status='cancelled', speed=0, message='下载已取消')
        except Exception as e:
            with self.lock:
                job.update(status='failed', speed=0, message=str(e)[:600])
        finally:
            try:
                part.unlink(missing_ok=True)
            except OSError:
                pass
            with self.lock:
                self.cancel_events.pop(job['id'], None)
                self.pause_events.pop(job['id'], None)
                self._persist()
