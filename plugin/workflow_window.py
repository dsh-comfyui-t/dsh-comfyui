"""Open the workflow editor using the same native backend as the 3D editor."""
import sys


class EditorAPI:
    def __init__(self):
        self.dirty = False
        self._window = None

    def set_dirty(self, dirty):
        self.dirty = bool(dirty)

    def close(self):
        self._window.destroy()

    def closing(self):
        if self.dirty:
            return self._window.create_confirmation_dialog('尚未保存', '工作流尚未保存，放弃修改并关闭？')
        return True


if __name__ == '__main__':
    from electron_runtime import run_editor
    raise SystemExit(run_editor('workflow', sys.argv[1]))
