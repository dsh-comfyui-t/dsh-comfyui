"""Local native workflow editor sessions; drafts never replace host cells implicitly."""
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import time


class WorkflowWindows:
    def __init__(self):
        self.sessions = {}
        self.lock = threading.RLock()

    def open(self, body, port, instance, here):
        if body.get('instance', '') != instance:
            raise ValueError('工作流编辑实例不匹配，请刷新绘图台')
        channel = body.get('channel', '')
        if not isinstance(channel, str) or not re.fullmatch(r'[a-f0-9-]{32,80}', channel):
            raise ValueError('工作流编辑会话无效')
        workflow = body.get('workflow')
        if not isinstance(workflow, dict) or not isinstance(workflow.get('nodes'), list):
            raise ValueError('工作流格式无效')
        if len(json.dumps(body).encode()) > 2 * 1024 * 1024:
            raise ValueError('工作流数据过大')
        from editor_runtime import require_editor
        require_editor('workflow', here)
        with self.lock:
            old = self.sessions.get(channel)
            if old and old['process'].poll() is None:
                from electron_runtime import focus_worker
                focus_worker(here, 'workflow', channel)
                return {'ok': True, 'channel': channel, 'running': True, 'ready': self.get(channel)['ready']}
            self.sessions = {k: v for k, v in self.sessions.items()
                             if v['process'].poll() is None or time.time() - v['created'] < 86400}
            if len(self.sessions) >= 64:
                raise ValueError('编辑会话过多，请关闭旧窗口并重启 Sidecar')
            url = f'http://127.0.0.1:{port}/workflow/editor.html#{channel}'
            with open(Path(tempfile.gettempdir()) / 'dsh-workflow-window.log', 'ab') as log:
                proc = subprocess.Popen([sys.executable, str(Path(here) / 'workflow_window.py'), url],
                    cwd=here, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                    start_new_session=os.name != 'nt')
            self.sessions[channel] = {'workflow': copy.deepcopy(workflow),
                'theme': {k: v for k, v in (body.get('theme') if isinstance(body.get('theme'), dict) else {}).items()
                          if k.startswith('--cc-') and isinstance(v, str)},
                'here': str(here), 'revision': old['revision'] if old else 0, 'result': None, 'process': proc, 'created': time.time()}
            return {'ok': True, 'channel': channel, 'ready': False}

    def get(self, channel):
        with self.lock:
            s = self.sessions.get(channel)
            if not s:
                raise ValueError('编辑会话已失效，请从绘图台重新打开')
            from electron_runtime import worker_state
            state=worker_state(s['here'],'workflow',channel) if s['process'].poll() is None else None
            worker_error=state.get('error','') if state and state.get('pid')==s['process'].pid else ''
            return {k: copy.deepcopy(s[k]) for k in ('workflow', 'theme', 'revision', 'result')} | {
                'running': s['process'].poll() is None,
                'ready': bool(state and state.get('pid')==s['process'].pid and state.get('ready')),
                'error': worker_error or ('Electron 工作流窗口启动失败，请检查运行时；日志：dsh-workflow-window.log' if s['process'].poll() not in (None, 0) else '')}

    def save(self, channel, body, service):
        with self.lock:
            if channel not in self.sessions:
                raise ValueError('编辑会话已失效，请从绘图台重新打开')
            result = service.save_workflow(body)
            s = self.sessions[channel]
            s['workflow'] = copy.deepcopy(result['workflow'])
            s['result'] = copy.deepcopy(result['workflow'])
            s['revision'] += 1
            return result


WINDOWS = WorkflowWindows()
