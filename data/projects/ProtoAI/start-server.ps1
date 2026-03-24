$node = "D:\runtime\node\node.exe"
$server = "D:\server\server.js"
$log = "D:\data\logs\server.log"

Write-Host "Starting ProtoAI local server..."
Start-Process -FilePath $node -ArgumentList $server -RedirectStandardOutput $log -RedirectStandardError $log

Start-Sleep -Seconds 1

Write-Host "Opening ProtoAI UI..."
Start-Process "http://localhost:17890"
