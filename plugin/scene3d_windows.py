"""Restore the existing 3D window without discarding its unsaved scene."""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import tempfile
import threading

LOCK = threading.RLock()

def record_path(here, instance):
    key = hashlib.sha256((str(here) + str(instance)).encode()).hexdigest()[:24]
    return Path(tempfile.gettempdir()) / ('dsh-scene3d-' + key + '.json')

def remember(here, instance, pid, channel, draft=False, backend=None):
    path = record_path(here, instance)
    temp = path.with_suffix('.tmp')
    row={'pid': pid, 'channel': channel, 'draft': draft, 'ready': not draft}
    if backend: row.update(backend=backend, here=str(here))
    temp.write_text(json.dumps(row), encoding='utf-8')
    os.replace(temp, path)

def window_for_pid(pid):
    if os.name != 'nt': return None
    user = ctypes.WinDLL('user32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle: return None
    try:
        name = ctypes.create_unicode_buffer(32768); size = wintypes.DWORD(len(name))
        import sys
        if not kernel.QueryFullProcessImageNameW(handle, 0, name, ctypes.byref(size)): return None
        if os.path.normcase(name.value) != os.path.normcase(sys.executable): return None
    finally: kernel.CloseHandle(handle)
    result = []
    callback = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    @callback
    def visit(hwnd, _):
        owner = wintypes.DWORD(); user.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value == pid:
            title = ctypes.create_unicode_buffer(256); user.GetWindowTextW(hwnd, title, len(title))
            if title.value == 'DSH · 3D 参考编辑器': result.append(hwnd)
        return True
    user.EnumWindows.argtypes = [callback, wintypes.LPARAM]
    user.EnumWindows(visit, 0)
    return result[0] if len(result) == 1 else None

def current(here, instance):
    try:
        item = json.loads(record_path(here, instance).read_text(encoding='utf-8'))
        import re
        if not isinstance(item['pid'], int) or item['pid'] <= 0: return None
        if not re.fullmatch(r'[a-f0-9-]{8,80}', item['channel']): return None
        if item.get('backend') == 'electron':
            from electron_runtime import worker_state
            state=worker_state(here,'scene3d',item['channel'])
            if state and state.get('pid')==item['pid']:
                return {**item,'hwnd':None,'error':state.get('error','')}
            return None
        hwnd = window_for_pid(item['pid'])
        return {**item, 'hwnd': hwnd} if hwnd else None
    except (OSError, ValueError, KeyError, TypeError): return None

def restore(item):
    if item.get('backend') == 'electron':
        from electron_runtime import focus_worker
        if not focus_worker(item['here'],'scene3d',item['channel']): raise ValueError('Electron 窗口仍在启动，请稍后重试')
        return
    user = ctypes.WinDLL('user32', use_last_error=True)
    user.IsIconic.argtypes = [wintypes.HWND]
    user.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    user.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
    user.SetForegroundWindow.argtypes = [wintypes.HWND]
    hwnd = item['hwnd']
    user.ShowWindow(hwnd, 9 if user.IsIconic(hwnd) else 5)
    user.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040)
    user.SetForegroundWindow(hwnd)


def mark_ready(here, instance, pid, channel, error=''):
    """The worker acknowledges that the scene has rendered, not merely spawned."""
    path = record_path(here, instance)
    with LOCK:
        try: item = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError): return
        if item.get('pid') != pid or item.get('channel') != channel: return
        item.update(ready=not bool(error), error=str(error)[:600])
        temp = path.with_suffix('.ready.tmp')
        temp.write_text(json.dumps(item), encoding='utf-8'); os.replace(temp, path)
