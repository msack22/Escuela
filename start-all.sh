#!/usr/bin/env bash
set -euo pipefail

# Escuela - Backend (pm2) y Frontend (Vite)
cd "$(dirname "$0")"

kill_port() {
  local port=$1
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Cerrando proceso en puerto $port (PID ${pids})"
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

echo ""
echo "==== Escuela - Backend (pm2) y Frontend (Vite) ===="
echo ""

# --- Backend via pm2 ---
if pm2 show escuela-backend 2>/dev/null | grep -q "online"; then
  echo "Backend ya está corriendo en pm2 (escuela-backend), saltando..."
else
  echo "Iniciando backend con pm2..."
  kill_port 3001
  pm2 start backend/ecosystem.config.cjs --update-env
  pm2 save
fi
echo "Backend →  http://localhost:3001  (pm2: escuela-backend)"

echo ""

# --- Frontend Vite en esta terminal ---
echo "Iniciando frontend..."
kill_port 3000
echo "Frontend →  http://localhost:3000"
echo ""
echo "Ctrl+C para detener el frontend (el backend sigue vivo en pm2)."
echo ""

cd frontend && npm run dev
