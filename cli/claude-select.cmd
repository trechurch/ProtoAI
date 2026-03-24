@echo off
setlocal

REM Directory of this script (portable)
set BASE=%~dp0

REM Portable Node runtime
set NODE=%BASE%runtime\node\node.exe

REM Portable JS entry point
set SCRIPT=%BASE%claude-select.js

"%NODE%" "%SCRIPT%" %*

endlocal
