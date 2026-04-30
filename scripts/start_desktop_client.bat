@echo off
setlocal
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File scripts\start_desktop_client.ps1 %*
