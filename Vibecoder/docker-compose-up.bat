@echo off
echo Starting Academic Doubt Forum with Docker Compose...
docker compose up -d --build
docker compose ps
echo Forum is live at: http://localhost:3000
pause
