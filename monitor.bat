@echo off
chcp 65001 >nul
echo [Log Monitor] Streaming server.log in real-time...
echo Press Ctrl+C to exit this monitor. (The server will keep running in the background)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content server.log -Wait -Tail 30 -Encoding utf8"
