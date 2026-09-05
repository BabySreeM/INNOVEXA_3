@echo off
echo Starting Innovexa Dashboard Live Server...
set PORT=5173
set BASE_PATH=/
cd /d "%~dp0artifacts\aquaguard"
npx vite --host 0.0.0.0
