@echo off
cd /d "%~dp0retail-intelligence\backend"
if not exist .venv\Scripts\python.exe (
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install -r requirements.txt
)
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
