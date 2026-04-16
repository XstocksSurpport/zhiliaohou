@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Serve-Localhost3002.ps1"
if errorlevel 1 pause
