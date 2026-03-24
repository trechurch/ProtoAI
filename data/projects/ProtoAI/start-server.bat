@echo off
setlocal

REM Path to portable Node
set NODE=D:\runtime\node\node.exe

REM Path to server
set SERVER=D:\server\server.js

echo Starting ProtoAI local server...

REM Start Node in a new window so it stays alive
start "ProtoAI Server" "%NODE%" "%SERVER%"

REM Give server a moment to start
timeout /t 1 >nul

echo Opening ProtoAI UI...
start "" http://localhost:17890

endlocal
