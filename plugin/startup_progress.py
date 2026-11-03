# -*- coding: utf-8 -*-
"""ComfyUI 启动进度 · 取消信号 · 后台日志增量。

背景
----
0.7.151 的 `Comfy.start()` 是同步阻塞的：前端 `POST /comfy/start` 一路等到
45 秒 × 2 次尝试结束才拿到结果，中途既看不到「现在卡在哪一步」，也没有
任何办法叫停。用户只能盯着一个转圈的按钮，超时了再点一次。

这里补三件事，都不动 `Comfy.start()` 已有的判定逻辑：

1. **进度**：把启动拆成有名字的阶段（清僵尸 / 拉起 / 等端口 / 重试 / 完成），
   由 `Comfy.start()` 在关键位置回调 `phase()` 写进来。
2. **取消**：`cancel()` 置标志，`Comfy.start()` 在每个等待循环里查一次；
   只有本次启动自己拉起的进程树会被回收，外部已在跑的 ComfyUI 不动。
3. **日志**：按偏移增量读 `comfy-stdout.log` / `comfy-stderr.log`，
   前端每秒轮询一次就能滚动看到后台输出。

状态全在内存里，进程重启即丢 —— 启动本来就是短生命周期操作，不需要落盘。
"""

import os
import re
import threading
import time

# 单条日志流最多保留这么多字节，超出就丢掉最旧的（前端 pre 也只显示尾部）
_LOG_CAP = 32 * 1024
# 保留最近多少个 attempt 的完整记录，避免长时间开着页面反复启动把内存吃满
_KEEP = 8
# attempt 标识的合法形状：前端 crypto.randomUUID() 是 36 字符带连字符，
# 测试脚本用 dbg-<时间戳>。限定字符集，免得奇怪 id 混进日志。
_ID_RE = re.compile(r'[a-zA-Z0-9_-]{8,80}')
# 终端控制序列（颜色、进度条、光标移动）。日志里留着只会干扰阅读。
_ANSI_RE = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')


class StartupTracker:
    """一次启动 = 一个 attempt。同 id 重复 begin 会重置该 attempt。"""

    def __init__(self):
        self._lock = threading.RLock()
        self._items = {}        # attempt_id -> dict
        self._order = []        # 插入顺序，用于淘汰
        # 提前取消记忆：用户点了停止，但 POST /comfy/start 可能还在路上。
        # 记下 id 再往后的 300 秒内拒绝用同一个 id 启动，否则「停止」会丢。
        self._cancelled_ids = {}
        # 拉起进程用的独立锁：保证「检查取消」和「Popen」是一个原子步，
        # 取消之后不会再冒出迟到的进程。与 _lock 分开是为了不阻塞快照轮询。
        self._spawn_lock = threading.Lock()

    # ---------- 内部 ----------

    def _get(self, attempt_id):
        return self._items.get(str(attempt_id or ''))

    def _trim(self):
        while len(self._order) > _KEEP:
            old = self._order.pop(0)
            self._items.pop(old, None)

    def _purge_cancelled(self, window=300.0, cap=128):
        now = time.monotonic()
        for aid in [k for k, t in self._cancelled_ids.items() if now - t >= window]:
            self._cancelled_ids.pop(aid, None)
        while len(self._cancelled_ids) > cap:
            self._cancelled_ids.pop(next(iter(self._cancelled_ids)))

    @staticmethod
    def valid_id(attempt_id):
        """前端发的是 crypto.randomUUID()（36 字符，带连字符），测试用 dbg-<ts> 这类。
        限定字符集与长度，避免奇怪的 id 混进日志或路径。"""
        return bool(_ID_RE.fullmatch(str(attempt_id or '')))

    # ---------- 生命周期 ----------

    def begin(self, attempt_id):
        """登记一次启动。

        返回 True = 已登记，可以启动；
        返回 False = 这个 id 之前被取消过（或 id 不合法），调用方应直接判失败。
        """
        aid = str(attempt_id or '')
        if not self.valid_id(aid):
            return False
        with self._lock:
            self._purge_cancelled()
            if aid in self._cancelled_ids:
                return False
            if aid in self._items:
                self._items.pop(aid, None)
                try:
                    self._order.remove(aid)
                except ValueError:
                    pass
            self._items[aid] = {
                'id': aid,
                'startedAt': time.time(),
                'finishedAt': None,
                'phase': '正在准备启动…',
                'pid': None,
                'ok': None,
                'message': '',
                'cancelRequested': False,
                'cancelled': False,
                'logs': {'stdout': '', 'stderr': ''},
                'offsets': {},          # path -> 已读字节
                'steps': [],
            }
            self._order.append(aid)
            self._trim()
            return True

    def spawn(self, attempt_id, factory):
        """拉起进程。取消检查与 Popen 必须在同一个临界区里完成。

        不这样做的话，用户在 `_launch()` 走到一半时点停止，取消会被漏掉，
        进程照常出来变成孤儿 —— 只能事后按 PID 回收，而 PID 可能还没登记。
        """
        with self._spawn_lock:
            if self.cancelled(attempt_id):
                raise StartupCancelled('已停止启动')
            result = factory()
            pid = None
            try:
                pid = getattr(result[0], 'pid', None) if result else None
            except Exception:
                pid = None
            if pid is not None:
                with self._lock:
                    it = self._get(attempt_id)
                    if it:
                        it['pid'] = pid
                        it['phase'] = '等待 ComfyUI 服务就绪'
            return result

    def phase(self, attempt_id, text, pid=None):
        """记一个阶段。文本直接显示在前端状态行。"""
        with self._lock:
            it = self._get(attempt_id)
            if not it:
                return
            it['phase'] = str(text)
            it['steps'].append({'at': time.time(), 'text': str(text)})
            if len(it['steps']) > 40:
                it['steps'] = it['steps'][-40:]
            if pid is not None:
                it['pid'] = pid

    def set_pid(self, attempt_id, pid):
        with self._lock:
            it = self._get(attempt_id)
            if it:
                it['pid'] = pid

    def finish(self, attempt_id, ok, message=''):
        with self._lock:
            it = self._get(attempt_id)
            if not it:
                return
            it['ok'] = bool(ok)
            it['message'] = str(message or '')
            it['finishedAt'] = time.time()
            it['phase'] = '已完成' if ok else '已结束（失败）'

    # ---------- 取消 ----------

    def cancel(self, attempt_id):
        """请求取消。返回 (accepted, message)。

        无论当前有没有对应的活动记录，都先把这个 id 记进「提前取消」表：
        POST /comfy/startup/cancel 和 POST /comfy/start 是两条独立的请求，
        停止可能先到。不记住的话迟到的启动会把「已停止」变成「已启动」。

        accepted=False 表示这次启动已经结束或已经请求过，重复点没有意义。
        """
        aid = str(attempt_id or '')
        if not self.valid_id(aid):
            return False, '无效的启动标识'
        with self._lock:
            self._purge_cancelled()
            self._cancelled_ids[aid] = time.monotonic()
            it = self._get(aid)
            if not it:
                # 启动请求还没到，或早就结束并淘汰了。两种情况都算「已受理停止」。
                return True, '已停止连接尝试'
            if it['ok'] is True and it['finishedAt']:
                return True, 'ComfyUI 已就绪，启动过程已经结束'
            if it['finishedAt']:
                return False, '这次启动已经结束'
            if it['cancelRequested']:
                return False, '已经请求过停止，正在等进程退出'
            it['cancelRequested'] = True
            it['phase'] = '正在停止本次启动…'
            return True, '已请求停止'

    def cancelled(self, attempt_id):
        """`Comfy.start()` 在等待循环里调用这个。提前取消也算。"""
        aid = str(attempt_id or '')
        with self._lock:
            it = self._get(aid)
            if it and it['cancelRequested']:
                return True
            return aid in self._cancelled_ids

    def mark_cancelled(self, attempt_id):
        with self._lock:
            it = self._get(attempt_id)
            if it:
                it['cancelled'] = True

    # ---------- 日志 ----------

    def pump_logs(self, attempt_id, paths):
        """按偏移增量读日志文件，追加到该 attempt 的 logs 里。

        paths 形如 {'stdout': 'D:/.../comfy-stdout.log', 'stderr': '...'}。
        每次只读新增部分，所以可以每秒调用。
        """
        with self._lock:
            it = self._get(attempt_id)
            if not it:
                return
            for stream, path in (paths or {}).items():
                if stream not in ('stdout', 'stderr') or not path:
                    continue
                try:
                    if not os.path.isfile(path):
                        continue
                    size = os.path.getsize(path)
                    off = it['offsets'].get(path)
                    if off is None or size < off:
                        # 首次读，或者日志被截断重写：只取尾部，不要整份历史
                        off = max(0, size - _LOG_CAP)
                    if size <= off:
                        it['offsets'][path] = size
                        continue
                    with open(path, 'rb') as f:
                        f.seek(off)
                        chunk = f.read(min(size - off, _LOG_CAP))
                    it['offsets'][path] = off + len(chunk)
                    # 剥掉终端控制序列：ComfyUI 带进度条/彩色输出，原样塞进 <pre>
                    # 会显示成一堆 [32m [0m，还会把光标挪来挪去。
                    text = _ANSI_RE.sub('', chunk.decode('utf-8', 'replace'))
                    merged = (it['logs'].get(stream) or '') + text
                    if len(merged) > _LOG_CAP:
                        merged = merged[-_LOG_CAP:]
                    it['logs'][stream] = merged
                except Exception:
                    # 日志读不到不影响启动本身
                    continue

    # ---------- 快照 ----------

    def snapshot(self, attempt_id):
        """给前端轮询用。附带 elapsed 秒数。"""
        with self._lock:
            it = self._get(attempt_id)
            if not it:
                return None
            out = {
                'id': it['id'],
                'startedAt': it['startedAt'],
                'finishedAt': it['finishedAt'],
                'phase': it['phase'],
                'pid': it['pid'],
                'ok': it['ok'],
                'message': it['message'],
                'cancelRequested': it['cancelRequested'],
                'cancelled': it['cancelled'],
                'elapsed': max(0.0, (it['finishedAt'] or time.time()) - it['startedAt']),
                'logs': dict(it['logs']),
                'steps': list(it['steps']),
            }
            return out

    def active(self):
        """当前还没结束的 attempt id（最多一个），没有就返回 None。"""
        with self._lock:
            for aid in reversed(self._order):
                it = self._items.get(aid)
                if it and not it['finishedAt']:
                    return aid
            return None


TRACKER = StartupTracker()


class StartupCancelled(Exception):
    """`Comfy.start()` 发现自己被取消时抛这个，由路由层转成普通失败消息。"""
    pass
