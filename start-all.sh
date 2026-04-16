#!/bin/bash
# Escuela - Backend (Node) y Frontend (Vite)
cd "$(dirname "$0")"

echo ""
echo "==== Escuela - Backend (Node) y Frontend (Vite) ===="
echo ""

# 0) Verificar / levantar Tor (SOCKS5 en 127.0.0.1:9050)
echo "0) Verificando Tor (SOCKS5 en 127.0.0.1:9050)..."
echo ""

if lsof -iTCP:9050 -sTCP:LISTEN -t &>/dev/null; then
  echo "Tor ya esta escuchando en 9050."
elif command -v brew &>/dev/null && brew list tor &>/dev/null 2>&1; then
  echo "Iniciando Tor via brew services..."
  brew services start tor
  TOR_OK=false
  for i in $(seq 1 20); do
    sleep 1
    if lsof -iTCP:9050 -sTCP:LISTEN -t &>/dev/null; then
      TOR_OK=true
      break
    fi
  done
  if $TOR_OK; then
    echo "Tor listo en 127.0.0.1:9050"
  else
    echo "Tor no quedo disponible en 9050 dentro de 20s. Revisar con: brew services info tor"
  fi
else
  echo "Tor no encontrado. Instala con: brew install tor"
  echo "Seguimos sin Tor (el scraping funcionara sin rotacion de IP)."
fi

echo ""
echo "1) Liberando puertos 8000 (backend) y 3000 (frontend)..."
echo ""

# Matar procesos en puerto 8000
PID_8000=$(lsof -iTCP:8000 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID_8000" ]; then
  echo "Cerrando proceso en puerto 8000 - PID $PID_8000"
  kill -9 $PID_8000 2>/dev/null
fi

# Matar procesos en puerto 3000
PID_3000=$(lsof -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PID_3000" ]; then
  echo "Cerrando proceso en puerto 3000 - PID $PID_3000"
  kill -9 $PID_3000 2>/dev/null
fi

echo ""
echo "2) Puertos liberados. Iniciando servicios..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Backend en nueva ventana de Terminal
osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/backend' && npm run dev\""

# Frontend en nueva ventana de Terminal
osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/frontend' && npm run dev\""

echo ""
echo "3) Se abrieron dos ventanas nuevas:"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Ya podes cerrar esta ventana sin afectar los servicios."
echo ""
