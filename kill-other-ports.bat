@echo off
title Liberar puertos (dejar solo 8000 y 3000)
setlocal enabledelayedexpansion

:: Puertos que SÍ queremos usar: backend 8000, frontend 3000
set KEEP=8000 3000

:: Puertos típicos de dev que queremos liberar (todo lo que no sea backend/frontend)
set PORTS=5173 5174 5175 3001 3002 3004 3005 3006 3007 5000 5001 8080 8081 4000 8888 4200 4173 24678

echo.
echo Liberando puertos de desarrollo (se mantienen 8000=backend y 3000=frontend)...
echo.

for %%p in (%PORTS%) do (
  for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%%p.*LISTENING"') do (
    set pid=%%a
    if not "!pid!"=="" (
      echo Cerrando proceso en puerto %%p - PID !pid!
      taskkill /F /PID !pid! 2>nul
    )
  )
)

echo.
echo Listo. Puertos 8000 (backend) y 3000 (frontend) no se tocaron.
echo Para arrancar solo backend y frontend:
echo   - start-backend.bat
echo   - start-frontend.bat
echo.
pause
