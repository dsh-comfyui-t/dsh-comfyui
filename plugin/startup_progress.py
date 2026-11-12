"""Per-attempt startup logs and cancellation of only the owned launch process."""
import os
import re
import signal
import subprocess
import threading
import time
import uuid


class StartupCancelled(Exception):
    pass


class StartupProgress:
    def __init__(self, directory):
        self.directory = directory
        self.lock = threading.RLock()
        self.cancelled = {}
        self.current = None

    @staticmethod
    def valid_id(value):
        return isinstance(value, str) and bool(re.fullmatch(r'[a-zA-Z0-9_-]{8,80}', value))

    def run(self, fn, mode=None, attempt=None):
        attempt = attempt or uuid.uuid4().hex
        if not self.valid_id(attempt):
            return False, '无效的启动标识'
        with self.lock:
            if self.current and (self.current['active'] or self.current['stopping']):
                return False, 'ComfyUI 正在启动，请等待当前启动完成'
            self.cancelled = {k:v for k,v in self.cancelled.items() if time.monotonic()-v < 300}
            if attempt in self.cancelled:
                return False, '已停止启动'
            offsets = {}
            for name in ('stdout', 'stderr'):
                try: offsets[name] = os.path.getsize(self._path(name))
                except OSError: offsets[name] = 0
            state = self.current = dict(id=attempt, active=True, stopping=False, cancelled=False,
                startedAt=time.time(), mode=mode, phase='正在检查启动环境', process=None,
                offsets=offsets, result=None)
        try:
            result = fn()
        except StartupCancelled:
            result = (False, '已停止启动')
        except BaseException:
            with self.lock:
                state.update(active=False, phase='启动失败', result=False)
            raise
        with self.lock:
            if state['cancelled']:
                result = (False, '已停止启动')
            state.update(active=False, result=result[0], phase=result[1])
        return result

    def spawn(self, factory):
        # Cancellation and Popen must be atomic: no late process after Stop.
        with self.lock:
            state = self.current
            if state and state['cancelled']:
                raise StartupCancelled()
            process = factory()
            if state:
                state.update(process=process, phase='等待 ComfyUI 服务就绪')
            return process

    def is_cancelled(self):
        with self.lock:
            return bool(self.current and self.current['cancelled'])

    def cancel(self, attempt):
        if not self.valid_id(attempt):
            return False, '无效的启动标识'
        with self.lock:
            state = self.current
            # Remember an early cancellation if POST /start has not arrived yet.
            self.cancelled[attempt] = time.monotonic()
            if len(self.cancelled) > 128:
                self.cancelled.pop(next(iter(self.cancelled)))
            if not state or state['id'] != attempt:
                return True, '已停止连接尝试'
            if state['result'] is True:
                return True, 'ComfyUI 已就绪，启动过程已经结束'
            if state['stopping']:
                return False, '正在停止启动，请稍候'
            state.update(cancelled=True, stopping=True, phase='正在停止启动')
            process = state['process']
        try:
            if process and process.poll() is None:
                if os.name == 'nt':
                    result = subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],
                        capture_output=True, timeout=20)
                    if result.returncode and process.poll() is None:
                        raise RuntimeError('无法结束本次启动进程')
                elif os.getpgid(process.pid) == process.pid:
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait(timeout=5)
            with self.lock:
                state.update(phase='已停止启动', stopping=False)
            return True, '已停止启动'
        except ProcessLookupError:
            with self.lock: state.update(stopping=False, phase='已停止启动')
            return True, '已停止启动'
        except Exception as error:
            with self.lock: state.update(stopping=False, phase='停止失败：'+str(error))
            return False, '停止失败：'+str(error)

    def _path(self, name):
        return os.path.join(self.directory, 'comfy-'+name+'.log')

    def snapshot(self, attempt=None):
        with self.lock:
            state = self.current
            if not state or (attempt and state['id'] != attempt):
                return dict(id=attempt, active=False, phase='等待启动请求', logs={})
            view = {k:state[k] for k in ('id','active','stopping','cancelled','startedAt','mode','phase','result')}
            process, offsets = state['process'], dict(state['offsets'])
        view['pid'] = process.pid if process else None
        view['exitCode'] = process.poll() if process else None
        logs = {}
        for name, start in offsets.items():
            try:
                with open(self._path(name), 'rb') as stream:
                    stream.seek(0, 2); size = stream.tell()
                    stream.seek(max(start if start <= size else 0, size-32768))
                    text = stream.read(32768).decode('utf-8', errors='replace')
                    # Terminal escape sequences have no place in a text console.
                    logs[name] = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)
            except OSError:
                logs[name] = ''
        view['logs'] = logs
        return view
