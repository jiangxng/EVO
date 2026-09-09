$ErrorActionPreference = "Stop"
Write-Host "Starting EVO v0.9..."
docker compose up -d --build
Write-Host ""
Write-Host "EVO is starting."
Write-Host "Open: http://localhost:3000"
Write-Host ""
Write-Host "Status:"
docker compose ps
