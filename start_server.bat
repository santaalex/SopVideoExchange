@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
echo Starting SopVideoExchange FastAPI Server...
echo All logs are being appended to server.log. Run monitor.bat to watch the output!
call .\.venv\Scripts\activate.bat
python -u -m uvicorn src.main:app --host 0.0.0.0 --port 8000 >> server.log 2>&1
pause
