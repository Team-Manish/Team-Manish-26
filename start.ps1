Write-Host "Starting EduTrack..." -ForegroundColor Cyan
Write-Host ""

# Start backend
Write-Host "[1/2] Starting backend on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node server.js" -WindowStyle Normal

# Wait for backend to be ready
Start-Sleep -Seconds 2

# Start frontend
Write-Host "[2/2] Starting frontend on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npx vite" -WindowStyle Normal

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "Both servers started!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Open http://localhost:3000 in your browser." -ForegroundColor Cyan
