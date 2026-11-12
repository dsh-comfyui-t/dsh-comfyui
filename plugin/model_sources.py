"""Bounded provenance lookup and background batches. No model uploads/inference.

The host supplies authorized enumeration/resolution and the existing network
client, so Windows, WSL and custom model roots use the same path policy.
"""
from pathlib import Path
from contextlib import closing
from urllib.parse import quote, urlencode
import copy
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import uuid


class SourceNotFound(ValueError):
    pass


class SourceResolver:
    def __init__(self, directory, service, check_cancel):
        self.directory = Path(directory)
        self.service = service
        self.check = check_cancel

    @staticmethod
    def signature(path):
        st = os.stat(path)
        return (st.st_size, st.st_mtime_ns, st.st_ctime_ns, st.st_ino)

    def digest(self, path, event=None, progress=lambda **kw: None):
        self.check(event)
        before = self.signature(path)
        identity = os.path.normcase(os.path.realpath(path))
        signature = json.dumps(before)
        self.directory.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(str(self.directory / 'model_source_hashes.sqlite3'), timeout=5)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS hashes (path TEXT PRIMARY KEY, signature TEXT, sha256 TEXT)')
            row = db.execute('SELECT sha256 FROM hashes WHERE path=? AND signature=?', (identity, signature)).fetchone()
            if row and re.fullmatch('[a-f0-9]{64}', row[0]):
                progress(phase='hashing', bytes=before[0], size=before[0], hashCached=True)
                return row[0]
        digest = hashlib.sha256()
        received = 0
        last = 0
        with open(path, 'rb') as stream:
            while True:
                self.check(event)
                chunk = stream.read(8 * 1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
                received += len(chunk)
                if time.monotonic() - last > .15:
                    progress(phase='hashing', bytes=received, size=before[0], hashCached=False)
                    last = time.monotonic()
        self.check(event)
        if self.signature(path) != before:
            raise ValueError('模型文件发生变化，请稍后重试')
        sha = digest.hexdigest()
        with closing(sqlite3.connect(str(self.directory / 'model_source_hashes.sqlite3'), timeout=5)) as db, db:
            db.execute('INSERT OR REPLACE INTO hashes VALUES (?,?,?)', (identity, signature, sha))
        progress(phase='hashing', bytes=received, size=before[0], hashCached=False)
        return sha

    def lookup(self, path, event=None, progress=lambda **kw: None, hints=None):
        before = self.signature(path)
        sha = self.digest(path, event, progress)
        service = self.service()
        errors = []
        progress(phase='querying', provider='Civitai')
        try:
            data = service._json('https://civitai.com/api/v1/model-versions/by-hash/' + sha.upper(), 'civitai')
            self.check(event)
            if isinstance(data, dict) and data.get('modelId'):
                model = data.get('model') if isinstance(data.get('model'), dict) else {}
                creator = model.get('creator') if isinstance(model.get('creator'), dict) else {}
                if not creator:
                    try:
                        extra = service._json('https://civitai.com/api/v1/models/' + str(int(data['modelId'])), 'civitai')
                        if isinstance(extra, dict):
                            model = extra
                            creator = model.get('creator') if isinstance(model.get('creator'), dict) else {}
                    except Exception:
                        self.check(event)  # An optional author lookup cannot discard an exact match.
                info = {'provider': 'Civitai', 'provider_id': 'civitai', 'method': 'sha256', 'sha256': sha.upper(),
                        'url': 'https://%s/models/%s?modelVersionId=%s' % (getattr(service, 'civitai_domain', 'civitai.com'), data['modelId'], data.get('id', '')),
                        'title': str(model.get('name') or data.get('name') or ''), 'version': str(data.get('name') or ''),
                        'author': str(creator.get('username') or ''), 'base_model': str(data.get('baseModel') or ''),
                        'trained_words': [str(v)[:500] for v in (data.get('trainedWords') or [])[:50]],
                        'model_id': str(data['modelId']), 'version_id': str(data.get('id') or '')}
                return self._unchanged(path, before, info, event)
        except Exception as ex:
            self.check(event)
            if getattr(ex, 'status', None) != 404:
                errors.append('Civitai：' + str(ex)[:240])
        # HF has repository search, not a global file-hash reverse index. Search
        # a small candidate pool, and accept only an actual matching LFS SHA256.
        repos = []
        for hint in (hints or {}).values():
            match = re.search(r'https://(?:huggingface.co|hf-mirror.com)/([\w.-]+/[\w.-]+)', str(hint))
            if match and match[1] not in repos:
                repos.append(match[1])
        stem = Path(path).stem
        cleaned = re.sub(r'(?i)[._-](?:q\d[^ ]*|fp\d+|bf\d+)$', '', stem).replace('_', '-')
        query = cleaned[:100]
        if len(repos) < 3 and len(query) >= 3:
            self.check(event)
            progress(phase='querying', provider='Hugging Face')
            try:
                data = service._json('https://huggingface.co/api/models?' + urlencode({'search': query, 'limit': 3}), 'huggingface')
                for model in data if isinstance(data, list) else []:
                    repo = model.get('id') if isinstance(model, dict) else None
                    if isinstance(repo, str) and re.fullmatch(r'[\w.-]+(?:/[\w.-]+)?', repo) and repo not in repos:
                        repos.append(repo)
            except Exception as ex:
                self.check(event)
                errors.append('Hugging Face：' + str(ex)[:240])
        matches = []
        for repo in repos[:3]:
            self.check(event)
            progress(phase='querying', provider='Hugging Face')
            try:
                model = service.detail('huggingface', repo)
                for version in model.get('versions') or []:
                    if any(str(f.get('sha256') or '').lower() == sha for f in version.get('files') or []):
                        matches.append({'provider': 'Hugging Face', 'provider_id': 'huggingface', 'method': 'hf-sha256',
                                        'sha256': sha.upper(), 'url': 'https://huggingface.co/' + quote(repo, safe='/'),
                                        'model_id': repo, 'version_id': str(version.get('id') or ''),
                                        'title': str(model.get('name') or repo), 'author': str(model.get('author') or ''),
                                        'version': str(version.get('name') or ''), 'base_model': str(model.get('base_model') or ''), 'trained_words': []})
                        break
            except Exception as ex:
                self.check(event)
                if getattr(ex, 'status', None) != 404:
                    errors.append('Hugging Face：' + str(ex)[:240])
        if matches:
            info = dict(matches[0])
            if len(matches) > 1:
                info['alternatives'] = matches[1:]
            return self._unchanged(path, before, info, event)
        if errors:
            raise ValueError('；'.join(errors))
        raise SourceNotFound('未找到哈希一致的模型来源；Hugging Face 仅检查了有限的候选仓库')

    def _unchanged(self, path, before, info, event):
        self.check(event)
        if self.signature(path) != before:
            raise ValueError('模型文件发生变化，来源未写入，请重试')
        return info


class SourceBatch:
    """One sequential worker; status survives dialog/page lifetimes and restart."""
    ACTIVE = ('scanning', 'running', 'stopping')

    def __init__(self, directory, enumerate_items, fetch, check_cancel):
        self.path = Path(directory) / 'model_source_batch.json'
        self.enumerate = enumerate_items
        self.fetch = fetch
        self.check = check_cancel
        self.lock = threading.RLock()
        self.event = threading.Event()
        self.job = None
        self.last_write = 0
        try:
            if self.path.stat().st_size <= 16 * 1024 * 1024:
                job = json.loads(self.path.read_text('utf8'))
                if isinstance(job, dict) and isinstance(job.get('results'), list):
                    self.job = job
                    if job.get('status') in self.ACTIVE:
                        job.update(status='interrupted', message='Sidecar 已重启；已保存的来源仍然保留，可重新获取未完成项')
        except (OSError, ValueError):
            pass

    def snapshot(self):
        with self.lock:
            if not self.job:
                return {'job': None}
            public = {k: v for k, v in self.job.items() if k not in ('results', 'request_id')}
            issues = [r for r in self.job['results'] if r['status'] in ('failed', 'not_found') or r.get('preview_status') == 'failed']
            public['issues'] = issues[:50]
            public['issueCount'] = len(issues)
            return {'job': copy.deepcopy(public)}

    def _save(self, force=False):
        if not force and time.monotonic() - self.last_write < 1:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_name(self.path.name + '.tmp')
        temporary.write_text(json.dumps(self.job, ensure_ascii=False), encoding='utf8')
        os.replace(temporary, self.path)
        self.last_write = time.monotonic()

    def start(self, payload):
        if not isinstance(payload, dict):
            raise ValueError('批量来源参数无效')
        scope = payload.get('scope', 'folder')
        if scope not in ('folder', 'library', 'retry'):
            raise ValueError('批量来源范围无效')
        if payload.get('force') is not None and not isinstance(payload.get('force'), bool):
            raise ValueError('重新获取参数必须为布尔值')
        if payload.get('request_id') is not None and (not isinstance(payload['request_id'], str) or not re.fullmatch(r'[a-zA-Z0-9_-]{8,80}', payload['request_id'])):
            raise ValueError('来源任务请求ID无效')
        with self.lock:
            if self.job and (self.job.get('status') in self.ACTIVE or payload.get('request_id') and payload['request_id'] == self.job.get('request_id')):
                return self.snapshot()
            retry = None
            if scope == 'retry':
                if not self.job or payload.get('job_id') != self.job.get('id'):
                    raise ValueError('待重试的来源任务已变化，请刷新状态')
                retry = [r['item'] for r in self.job['results'] if r['status'] == 'failed' or r.get('preview_status') == 'failed']
                if not retry:
                    raise ValueError('没有可重试的来源查询或预览图失败项；未找到来源的模型不会重试')
                payload = dict(self.job['options'], scope='retry', request_id=payload.get('request_id'))
            options = {k: payload.get(k) for k in ('scope', 'kind', 'root_id', 'folder', 'force')}
            self.event = threading.Event()
            previous = self.job
            self.job = {'id': uuid.uuid4().hex, 'request_id': payload.get('request_id'), 'status': 'scanning',
                        'options': options, 'started': time.time(), 'total': 0, 'processed': 0, 'found': 0, 'skipped': 0,
                        'not_found': 0, 'failed': 0, 'preview_saved': 0, 'preview_existing': 0, 'preview_missing': 0,
                        'preview_failed': 0, 'phase': 'scanning', 'current': '', 'message': '', 'results': []}
            try:
                self._save(True)
            except OSError:
                self.job = previous
                raise
            threading.Thread(target=self._run, args=(retry, self.event), daemon=True, name='model-source-batch').start()
            return self.snapshot()

    def cancel(self, job_id):
        with self.lock:
            if self.job and self.job['id'] == job_id and self.job['status'] in self.ACTIVE:
                self.event.set()
                self.job.update(status='stopping', message='正在停止；当前网络请求可能需要等待超时')
            return self.snapshot()

    def _progress(self, **change):
        with self.lock:
            self.job.update(change)

    def _run(self, retry, event):
        try:
            items = retry if retry is not None else self.enumerate(self.job['options'], event)
            self.check(event)
            with self.lock:
                self.job.update(total=len(items), status='running')
            for item in items:
                self.check(event)
                self._progress(current=item['name'], phase='checking', bytes=0, size=0, provider='')
                message = ''
                preview_status = ''
                preview_message = ''
                try:
                    result = self.fetch(item, bool(self.job['options'].get('force')), event, self._progress)
                    status = 'skipped' if result.get('skipped') else 'found'
                    preview_status = result.get('preview_status') or ''
                    preview_message = str(result.get('preview_message') or '')[:500]
                except SourceNotFound as ex:
                    status, message = 'not_found', str(ex)[:500]
                except Exception as ex:
                    self.check(event)
                    status, message = 'failed', str(ex)[:500]
                with self.lock:
                    self.job[status] += 1
                    if preview_status in ('saved', 'existing', 'missing', 'failed'):
                        self.job['preview_' + preview_status] += 1
                    self.job['processed'] += 1
                    self.job['results'].append({'item': item, 'name': item['name'], 'status': status, 'message': message,
                                                'preview_status': preview_status, 'preview_message': preview_message})
                    self._save()
            self.check(event)
            self._progress(status='completed', phase='done', current='', message='来源获取完成', finished=time.time())
        except Exception as ex:
            self._progress(status='cancelled' if event.is_set() else 'failed', phase='done', current='',
                           message='已停止；已完成的来源已保留' if event.is_set() else str(ex)[:500], finished=time.time())
        finally:
            with self.lock:
                self._save(True)
