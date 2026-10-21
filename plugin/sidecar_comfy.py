"""dsh-comfyui-console 侧车：ComfyUI 进程管理。

从 expander.py 拆出（0.5.4）。职责就一件事：把 ComfyUI 那个进程管好——
起 / 停 / 重启 / 查状态 / 闲置卸载 / 等它就绪。

约定：这里只读 sidecar_state 里的配置，不写回去。要改配置走 config 端点。
"""

import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from sidecar_state import (
    AUTO_UNLOAD_SECONDS,
    CFG,
    COMFY_EXTRA_ARGS,
    COMFY_MAIN,
    COMFY_PORT,
    COMFY_PY,
    COMFY_ROOT,
    WATCH_INTERVAL,
    WORK_DIR,
)
from sidecar_util import (
    _hide_kwargs,
    _http_json,
    _http_post_nojson,
)


def _comfy_exe():
    r"""优先用 pythonw.exe 启动 ComfyUI。

    为什么：comfyroot\python_embeded\python.exe 是 venv 启动器，它会**再 exec 一次**
    真解释器（D:\paint\runtime\python312\python.exe）。re-exec 出来的进程不继承
    CREATE_NO_WINDOW / DETACHED_PROCESS，于是照样弹一个黑框。
    pythonw.exe 是 GUI 子系统，没有控制台可弹；stdout/stderr 已重定向到日志文件，
    所以 ComfyUI 的 print / traceback 一样能落盘。
    """
    if os.name == 'nt' and COMFY_PY:
        w = os.path.join(os.path.dirname(COMFY_PY), 'pythonw.exe')
        if os.path.isfile(w):
            return w
    return COMFY_PY

class Comfy:
    def __init__(self):
        self.lock = threading.Lock()
        self.last_activity = time.time()
        self.unloaded_at = 0.0

    @staticmethod
    def port_open(port=COMFY_PORT, timeout=0.6):
        import socket
        s = socket.socket()
        s.settimeout(timeout)
        try:
            s.connect(('127.0.0.1', port))
            return True
        except Exception:
            return False
        finally:
            try:
                s.close()
            except Exception:
                pass

    @staticmethod
    def pid_on_port(port=COMFY_PORT):
        """按监听端口找 PID。先试 psutil，失败退回 netstat。"""
        try:
            import psutil
            for c in psutil.net_connections(kind='tcp'):
                if c.laddr and c.laddr.port == port and c.status == psutil.CONN_LISTEN:
                    return c.pid
        except Exception:
            pass
        try:
            out = subprocess.run(['netstat', '-ano', '-p', 'TCP'], capture_output=True,
                                 text=True, timeout=10, **_hide_kwargs()).stdout
            for line in out.splitlines():
                if (':%d ' % port) in line and 'LISTENING' in line:
                    return int(line.split()[-1])
        except Exception:
            pass
        return None

    def running(self):
        return self.port_open()

    def touch(self):
        with self.lock:
            self.last_activity = time.time()

    def busy(self):
        """ComfyUI 是否正在执行任务。卸载/关闭前必须查，否则会打断正在跑的图。"""
        if not self.running():
            return False
        try:
            q = _http_json('http://127.0.0.1:%d/queue' % COMFY_PORT, '', timeout=10)
            return len(q.get('queue_running') or []) > 0
        except Exception:
            return False

    def serving(self, timeout=3):
        """端口上是不是**真在应答**（不只是端口被占用）。"""
        try:
            _http_json('http://127.0.0.1:%d/system_stats' % COMFY_PORT, '', timeout=timeout)
            return True
        except Exception:
            return False

    def _alive(self, pid):
        """进程还在不在（taskkill 对 venv 启动器只杀壳，必须实测）。"""
        try:
            r = subprocess.run(['tasklist', '/FI', 'PID eq %s' % pid, '/NH'],
                               capture_output=True, text=True, timeout=15, **_hide_kwargs())
            return str(pid) in (r.stdout or '')
        except Exception:
            return False

    def _kill_pid(self, pid):
        """杀掉进程**树**：comfyroot 的 python.exe 是 venv 启动器，会再 exec 一次真解释器，
        只杀启动器会把真正占着 user\\comfyui.db 的子进程留在那里 —— 这就是
        「点了启动仍然 ASSETS_STARTUP_FAILED: in_use」的直接原因。"""
        pid = int(pid)
        try:
            subprocess.run(['taskkill', '/PID', str(pid), '/F', '/T'],
                           capture_output=True, text=True, timeout=25, **_hide_kwargs())
        except Exception:
            pass
        if not self._alive(pid):
            return True
        try:
            os.kill(pid, 9)
        except Exception:
            pass
        if not self._alive(pid):
            return True
        try:
            subprocess.run(['powershell', '-NoProfile', '-Command',
                            'Stop-Process -Id %d -Force -ErrorAction SilentlyContinue' % pid],
                           capture_output=True, text=True, timeout=20, **_hide_kwargs())
        except Exception:
            pass
        return not self._alive(pid)

    def _wait_port_free(self, seconds=30):
        for _ in range(int(seconds)):
            if not self.port_open():
                return True
            time.sleep(1)
        return not self.port_open()

    def _stray_pids(self):
        """找出所有跑着 ComfyUI main.py 的 python 进程（含还没绑端口的）。
        端口探不到它们，但 sqlite 资产库 user\\comfyui.db 是单实例独占的，
        留下的幽灵会让每次启动都以 ASSETS_STARTUP_FAILED: in_use 失败。"""
        try:
            ps = ("Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" | "
                  "Where-Object { $_.CommandLine -like '*main.py*' } | "
                  "Select-Object -ExpandProperty ProcessId")
            r = subprocess.run(['powershell', '-NoProfile', '-Command', ps],
                               capture_output=True, text=True, timeout=25, **_hide_kwargs())
            out = []
            for line in (r.stdout or '').splitlines():
                line = line.strip()
                if line.isdigit():
                    out.append(int(line))
            return out
        except Exception:
            return []

    def _kill_strays(self, keep=()):
        killed, seen = [], []
        for pid in self._stray_pids():
            seen.append(pid)
            if pid in keep or pid == os.getpid():
                continue
            if self._kill_pid(pid):
                killed.append(pid)
        try:
            with open(os.path.join(WORK_DIR, 'comfy-strays.log'), 'a', encoding='utf-8') as f:
                f.write('%s seen=%r killed=%r\n' % (time.strftime('%H:%M:%S'), seen, killed))
        except Exception:
            pass
        return killed

    def _log_hint(self):
        """从 comfy-stderr.log 尾部捞出最可能让用户看懂的那一行失败原因"""
        try:
            fp = os.path.join(WORK_DIR, 'comfy-stderr.log')
            with open(fp, 'rb') as f:
                f.seek(0, 2)
                size = f.tell()
                f.seek(max(0, size - 40000))
                txt = f.read().decode('utf-8', 'replace')
            lines = [re.sub(r'\x1b\[[0-9;]*m', '', x).strip() for x in txt.splitlines()]
            lines = [x for x in lines if x]
            for key, hint in (
                ('ASSETS_STARTUP_FAILED', '另有一个 ComfyUI 占着 user\\comfyui.db（资产库单实例锁）'),
                ('already using this database', '另有一个 ComfyUI 占着 user\\comfyui.db'),
                ('Address already in use', '端口被占：另一个 ComfyUI 已绑 8188'),
                ('comfyui-workflow-templates is not installed', '缺 comfyui-workflow-templates（不影响启动，仅模板）'),
                ('ModuleNotFoundError', '缺 Python 依赖'),
                ('CUDA out of memory', '显存不足'),
            ):
                for x in reversed(lines):
                    if key in x:
                        return hint
            return ''
        except Exception:
            return ''

    def _launch(self):
        exe = _comfy_exe()
        if not os.path.exists(exe):
            return None, '找不到 ' + exe
        flags = 0
        if os.name == 'nt':
            flags = 0x00000008 | 0x00000200 | 0x08000000  # DETACHED | NEW_PROCESS_GROUP | NO_WINDOW
        # ⚠️ 必须把 stdout/stderr 落到文件。
        #    早先用了 DEVNULL，出图卡住时**完全拿不到服务端日志**，无从判断。踩过。
        try:
            out = open(os.path.join(WORK_DIR, 'comfy-stdout.log'), 'ab', buffering=0)
            err = open(os.path.join(WORK_DIR, 'comfy-stderr.log'), 'ab', buffering=0)
        except Exception:
            out = err = subprocess.DEVNULL
        args = [exe, '-s', COMFY_MAIN,
                '--listen', '127.0.0.1', '--port', str(COMFY_PORT),
                '--enable-cors-header', '*', '--disable-auto-launch'] + COMFY_EXTRA_ARGS
        # 面板里设的「出图落地位置」⇒ 传给 ComfyUI（extraComfyArgs 里已有就不重复加）
        _od = (CFG.get('outputDir') or '').strip() if isinstance(CFG, dict) else ''
        if _od and '--output-directory' not in args:
            try:
                os.makedirs(_od, exist_ok=True)
                args += ['--output-directory', _od]
            except Exception:
                pass
        try:
            proc = subprocess.Popen(
                args,
                cwd=COMFY_ROOT,
                stdout=out, stderr=err, stdin=subprocess.DEVNULL,
                creationflags=flags,
                startupinfo=_hide_kwargs().get('startupinfo'),
            )
        except Exception as e:
            return None, 'Popen 失败: %s' % e
        return proc, ''

    def start(self):
        """确保 ComfyUI 在跑。带自愈：僵尸进程清掉、进程秒退自动重试一次。

        2026-10-18 用户反馈「每次重启都会拉起失败，需要再点一次」——
        根因是上一轮进程没退干净（端口还占着或应答不了），旧实现只探端口，
        于是把僵尸当「已在运行」，或者新进程绑定失败直接退出。
        """
        self.touch()
        if self.serving(2):
            return True, '已在运行'
        if self.port_open():
            # 端口占着但不应答：给它 20 秒自证，还不行就当僵尸杀掉
            for _ in range(20):
                time.sleep(1)
                if self.serving(2):
                    return True, '已在运行'
            pid = self.pid_on_port()
            if pid:
                print('[comfy] 端口被占但无应答，清理僵尸 PID %s' % pid, flush=True)
                self._kill_pid(pid)
            self._wait_port_free(20)

        last = ''
        # 先把所有跑着 main.py 的进程清掉（端口探不到它们，但资产库锁在它们手里）
        strays = self._kill_strays()
        if strays:
            print('[comfy] 清掉 %d 个残留 ComfyUI 进程: %s' % (len(strays), strays), flush=True)
            self._wait_port_free(15)
        for attempt in (1, 2):
            if self.serving(2):
                return True, '已在运行'
            proc, m = self._launch()
            if proc is None:
                return False, m
            for _ in range(45):
                time.sleep(1)
                if self.serving(2):
                    return True, '已拉起（日志: comfy-stderr.log）'
                if proc.poll() is not None:
                    last = '进程启动后立即退出（exit=%s）' % proc.returncode
                    break
            else:
                last = '45 秒内端口不应答'
            if attempt == 1:
                print('[comfy] 第 1 次拉起失败（%s），清端口后重试一次' % last, flush=True)
                pid = self.pid_on_port()
                if pid:
                    self._kill_pid(pid)
                self._kill_strays()
                self._wait_port_free(15)
                time.sleep(2)
        hint = self._log_hint()
        extra = ('；原因: ' + hint) if hint else ''
        return False, '拉起失败：%s%s（日志: comfy-stderr.log）' % (last, extra)

    def unload(self, force=False):
        """让 ComfyUI 卸载模型、释放显存；**进程保留**。

        正在出图时默认拒绝（不然会把跑了一半的任务打断）。
        """
        if not self.running():
            return True, 'ComfyUI 没在跑，无需卸载'
        if not force and self.busy():
            return False, '正在出图，暂不卸载（等它跑完）'
        self.touch()
        try:
            # ⚠️ /free 返回空 body，按 JSON 解析会抛错，见 docs/生成经验.md #4
            _http_post_nojson('http://127.0.0.1:%d/free' % COMFY_PORT,
                              {'unload_models': True, 'free_memory': True}, timeout=30)
            with self.lock:
                self.unloaded_at = time.time()
            return True, '已请求卸载模型'
        except Exception as e:
            return False, 'unload 失败: %s' % e

    def stop(self):
        """彻底关掉 ComfyUI 进程：杀掉监听进程，并**等端口真的释放**再返回。"""
        if not self.port_open() and not self.serving(1):
            return True, 'ComfyUI 没在跑'
        pid = self.pid_on_port()
        if not pid:
            if self._wait_port_free(10):
                return True, '已关闭'
            return False, '找不到监听 %d 的进程' % COMFY_PORT
        if not self._kill_pid(pid):
            return False, 'taskkill 失败 (PID %s)' % pid
        if self._wait_port_free(30):
            time.sleep(0.5)
            return True, '已关闭 (PID %s)' % pid
        # 还占着：再杀一次，别让下一轮 start 撞上僵尸
        pid2 = self.pid_on_port()
        if pid2:
            self._kill_pid(pid2)
            if self._wait_port_free(15):
                return True, '已关闭 (PID %s)' % pid2
        return False, 'taskkill 后仍在监听 %d' % COMFY_PORT

    def status(self):
        with self.lock:
            idle = time.time() - self.last_activity
        return {
            'running': self.running(),
            'busy': self.busy(),
            'idle_seconds': round(idle, 1),
            'auto_unload_after': AUTO_UNLOAD_SECONDS,
            'auto_unload_in': max(0, round(AUTO_UNLOAD_SECONDS - idle, 1)),
            'last_unload_ago': (round(time.time() - self.unloaded_at, 1)
                                if self.unloaded_at else None),
        }

    def watcher(self):
        """后台巡检：闲置超时且**不在出图** -> 卸载模型（不杀进程）。"""
        while True:
            try:
                time.sleep(WATCH_INTERVAL)
                with self.lock:
                    idle = time.time() - self.last_activity
                if idle >= AUTO_UNLOAD_SECONDS and self.running():
                    if self.busy():
                        # 正在出图：把计时器推后，别在人家跑图时卸载
                        self.touch()
                        print('[comfy] 闲置超时但正在出图，推迟卸载', flush=True)
                        continue
                    ok, m = self.unload()
                    print('[comfy] 闲置 %.0f 秒，自动卸载: %s (%s)' % (idle, ok, m), flush=True)
            except Exception as e:
                print('[comfy] watcher 异常:', e, flush=True)
