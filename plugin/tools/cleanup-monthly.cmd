@echo off
rem dsh-comfy-cards-next 月度清理。由计划任务调用；也可手动双击。
rem 侧车启动时另有 --auto 自检，两者互不依赖，任一失效仍会清。
rem 路径全部按本脚本位置推导，不写死任何机器上的绝对路径。
setlocal
set HERE=%~dp0
for %%i in ("%HERE%..") do set PLUGIN=%%~fi
set PY=
if defined COMFY_ROOT if exist "%COMFY_ROOT%\runtime\python312\pythonw.exe" set PY=%COMFY_ROOT%\runtime\python312\pythonw.exe
if not defined PY if exist "%COMFY_ROOT%\venv312\Scripts\python.exe" set PY=%COMFY_ROOT%\venv312\Scripts\python.exe
if not defined PY for %%p in (pythonw.exe) do if not "%%~$PATH:p"=="" set PY=%%~$PATH:p
if not defined PY for %%p in (python.exe) do if not "%%~$PATH:p"=="" set PY=%%~$PATH:p
if not defined PY (
  echo [cleanup] 找不到 Python：请设置 COMFY_ROOT，或把 python 加进 PATH。
  exit /b 1
)
"%PY%" "%PLUGIN%\tools\cleanup.py" --apply
endlocal
