@echo off
title Backend - Sistema Concursos (puerto 8000)
cd /d "%~dp0backend"

echo Liberando puerto 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
  taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo.
echo Iniciando UN solo backend en http://localhost:8000
echo No cierres esta ventana. Para detener: Ctrl+C
echo.
python run.py
pause
