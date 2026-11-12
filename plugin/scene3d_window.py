"""Native 3D editor: save the component draft before an ordinary close."""
import os
import sys
import threading
import traceback


class EditorAPI:
    def __init__(self, url=""):
        from urllib.parse import parse_qs, urlsplit
        self._args = parse_qs(urlsplit(url).fragment)
        self._window = None
        self._ready = False
        self._allow_close = False
        self._closing = False

    def ready(self):
        self._ready = True
        self._publish_ready()

    def failed(self, message):
        self._publish_ready(str(message))

    def _publish_ready(self, error=''):
        channel = self._args.get('channel', [''])[0]
        if not channel: return
        from scene3d_windows import mark_ready
        mark_ready(os.path.dirname(os.path.abspath(__file__)),
                   self._args.get('instance', [''])[0], os.getpid(), channel, error)

    def close_result(self, saved):
        self._closing = False
        if saved:
            self._allow_close = True
            self._window.destroy()

    def discard_removed(self):
        # The owning component has explicitly been removed or its session ended.
        self._allow_close = True
        self._window.destroy()

    def closing(self):
        if self._allow_close or not self._ready: return True
        if not self._closing:
            self._closing = True
            threading.Thread(target=self._request_close, daemon=True).start()
        return False

    def _request_close(self):
        try:
            self._window.evaluate_js('window.dshScene3D.requestClose()')
        except Exception:
            self._closing = False
            log_error()
            # If the renderer itself is unavailable, keep the window and its draft.
            self._window.create_confirmation_dialog('无法完成关闭', '无法联系场景编辑页面。窗口已保留，请稍后重试关闭。')


def log_error():
    path = os.path.join(os.environ.get('TEMP') or os.path.expanduser('~'), 'dsh-scene3d-window.log')
    with open(path, 'a', encoding='utf-8') as stream:
        stream.write(traceback.format_exc() + '\n')


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else ''
    if not url: raise SystemExit('missing editor URL')
    from electron_runtime import run_editor
    return run_editor('scene3d', url)


if __name__ == '__main__':
    try: main()
    except Exception:
        log_error()
        raise
