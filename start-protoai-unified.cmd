@echo off
setlocal

REM Base directory of this script
set BASE=%~dp0

REM Paths
set NODE=%BASE%runtime\node\node.exe
set SERVER=%BASE%server\server.js
set LOG=%BASE%data\logs\server.log

echo ==========================================
echo   ProtoAI Unified Launcher (Portable)
echo ==========================================

REM Check if PowerShell exists
where powershell >nul 2>&1
if %errorlevel%==0 (
    echo PowerShell detected. Using PowerShell launcher...
    powershell -ExecutionPolicy Bypass -File "%BASE%start-protoai.ps1"
    exit /b
)

echo PowerShell not found. Using batch launcher...

REM Start Node server
start "ProtoAI Server" "%NODE%" "%SERVER%"

timeout /t 1 >nul

REM Open UI
start "" http://localhost:17890

endlocal
