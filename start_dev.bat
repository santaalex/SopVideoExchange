@echo off
echo =========================================
echo SopVideoExchange Local Dev Server
echo =========================================

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH!
    pause
    exit /b 1
)

:: Check if virtual environment exists
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

:: Activate virtual environment
call .venv\Scripts\activate.bat

:: Install requirements
echo Installing dependencies from requirements.txt...
pip install -r requirements.txt

:: Start FastAPI server
echo Starting Webhook Trigger Server...
python -m uvicorn src.trigger.main:app --host 0.0.0.0 --port 8000 --reload
