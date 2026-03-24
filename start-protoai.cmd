@echo off
setlocal

REM Base directory of this script (portable)
set BASE=%~dp0

REM Path to portable Node
set NODE=%BASE%runtime\node\node.exe

REM Path to server
set SERVER=%BASE%server\server.js

echo Starting ProtoAI local server...
start "ProtoAI Server" "%NODE%" "%SERVER%"

REM Give server a moment to start
timeout /t 1 >nul

echo Opening ProtoAI UI...
start "" http://localhost:17890

endlocal
