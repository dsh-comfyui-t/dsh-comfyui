@echo off
rem dsh-comfy-cards-next 月度清理。由计划任务调用；也可手动双击。
rem 侧车启动时另有 --auto 自检，两者互不依赖，任一失效仍会清。
setlocal
set PY=<ComfyUI父目录>\runtime\python312\pythonw.exe
if not exist "%PY%" set PY=<ComfyUI父目录>\venv312\Scripts\python.exe
"%PY%" "<DSH目录>\.dsh\plugins\dsh-comfy-cards-next\plugin\tools\cleanup.py" --apply
endlocal