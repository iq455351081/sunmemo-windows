@echo off
rem 先清理残留实例（防止旧进程占住单实例锁导致新启动被顶掉）
taskkill /IM electron.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
