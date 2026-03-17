@echo off
title Escuela - Backend (Node) y Frontend (Vite)
cd /d "%~dp0"

echo.
echo ==== Escuela - Backend (Node) y Frontend (Vite) ====
echo.
echo 1) Liberando puertos 8000 (backend Node) y 3000 (frontend Vite)...
echo.

:: Matar procesos en puerto 8000
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host 'Cerrando proceso en puerto 8000 - PID ' + $_.OwningProcess; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: Matar procesos en puerto 3000
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host 'Cerrando proceso en puerto 3000 - PID ' + $_.OwningProcess; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo 2) Puertos liberados. Iniciando servicios...
echo.

:: Backend (Node - npm run dev)
pushd "%~dp0backend"
start "Backend - Escuela (8000)" cmd /k "npm run dev"
popd

:: Frontend (Vite - npm run dev)
pushd "%~dp0frontend"
start "Frontend - Escuela (3000)" cmd /k "npm run dev"
popd

echo.
echo 3) Se abrieron dos ventanas nuevas:
echo    Backend:  http://localhost:8000
echo    Frontend: http://localhost:3000
echo.
echo Ya podes cerrar esta ventana sin afectar los servicios.
echo.
pause

