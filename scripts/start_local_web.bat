@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start_local_web.ps1" %*
if errorlevel 1 (
  echo.
  echo Startup failed. Please check the error above.
  pause
  exit /b 1
)
endlocal
