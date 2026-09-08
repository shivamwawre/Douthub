@echo off
echo ========================================================
echo   Building and Launching Academic Doubt Forum in Docker
echo ========================================================
docker build -t douthub-forum:latest .
if %errorlevel% neq 0 (
    echo [ERROR] Docker build failed. Please ensure Docker Desktop is running.
    pause
    exit /b %errorlevel%
)

echo.
echo Stopping existing container if running...
docker stop douthub-academic-forum 2>nul
docker rm douthub-academic-forum 2>nul

echo.
echo Starting container on http://localhost:3000 ...
docker run -d --name douthub-academic-forum -p 3000:3000 -v "%cd%/academic_forum.db:/app/academic_forum.db" douthub-forum:latest

echo.
echo Container status:
docker ps --filter "name=douthub-academic-forum"
echo.
echo Forum is live at: http://localhost:3000
pause
