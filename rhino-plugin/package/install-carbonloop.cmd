@echo off
setlocal
set "carbonloop_yak=C:\Program Files\Rhino 8\System\Yak.exe"
if not exist "%carbonloop_yak%" (
  echo Rhino 8 Yak.exe not found. Install Rhino 8 first.
  pause
  exit /b 1
)
"%carbonloop_yak%" install "%~dp0carbonloop-rhino-0.3.1-any-win.yak"
if errorlevel 1 (
  echo Installation failed. Keep this message for support.
  pause
  exit /b 1
)
echo CarbonLoop 0.3.1 installed. Save your models and restart Rhino 8.
pause
