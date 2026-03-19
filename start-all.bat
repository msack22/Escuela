@echo off
title Escuela - Backend (Node) y Frontend (Vite)
cd /d "%~dp0"

echo.
echo ==== Escuela - Backend (Node) y Frontend (Vite) ====
echo.
echo 0) Verificando Tor (SOCKS5 en 127.0.0.1:9050)...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$torReady = Get-NetTCPConnection -LocalPort 9050 -State Listen -ErrorAction SilentlyContinue; if ($torReady) { Write-Host 'Tor ya esta escuchando en 9050.'; exit 0 }; $candidates = @($env:TOR_EXE_PATH, (Join-Path $env:ProgramFiles 'Tor Browser\Browser\TorBrowser\Tor\tor.exe'), (Join-Path ${env:ProgramFiles(x86)} 'Tor Browser\Browser\TorBrowser\Tor\tor.exe'), (Join-Path $env:USERPROFILE 'Desktop\Tor Browser\Browser\TorBrowser\Tor\tor.exe')); $torExe = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1; if (-not $torExe) { Write-Warning 'No se encontro tor.exe. Defini TOR_EXE_PATH o instala Tor Browser. Seguimos sin Tor.'; exit 0 }; Write-Host ('Iniciando Tor desde: ' + $torExe); Start-Process -FilePath $torExe -WindowStyle Minimized; $ok = $false; 1..30 | ForEach-Object { Start-Sleep -Seconds 1; if (Get-NetTCPConnection -LocalPort 9050 -State Listen -ErrorAction SilentlyContinue) { $ok = $true; break } }; if ($ok) { Write-Host 'Tor listo en 127.0.0.1:9050'; } else { Write-Warning 'Tor no quedo disponible en 9050 dentro de 30s. Revisar Tor manualmente.' }"

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

