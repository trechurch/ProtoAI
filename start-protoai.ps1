$base = $PSScriptRoot

$node   = Join-Path $base "runtime\node\node.exe"
$server = Join-Path $base "server\server.js"
$log    = Join-Path $base "data\logs\server.log"
$errorLog = Join-Path $base "data\logs\error.log"

Write-Host "Starting ProtoAI local server..."
Start-Process -FilePath $node -ArgumentList $server -RedirectStandardOutput $log -RedirectStandardError $errorLog

Start-Sleep -Seconds 1

Write-Host "Opening ProtoAI UI..."
Start-Process "http://localhost:17890"



