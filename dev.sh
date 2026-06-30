#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

TWITCH_CHANNEL="horuser"
TWITCH_URL="https://www.twitch.tv/${TWITCH_CHANNEL}"
ADMIN_URL="http://localhost:3000/admin"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
  *)                    IS_WINDOWS=0 ;;
esac

# Cierra el servidor de desarrollo previo (lo que escucha en :3000) si lo hay.
kill_dev_server() {
  if [ "$IS_WINDOWS" = "1" ]; then
    powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1 || true
  else
    if command -v lsof >/dev/null 2>&1; then
      lsof -ti tcp:3000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
    fi
  fi
}

open_url() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 &
  else
    echo "No se encontro un comando para abrir el navegador. Abri manualmente: $url"
  fi
}

echo "Cerrando instancia previa del servidor de desarrollo (si existe)..."
kill_dev_server

npm run dev &
DEV_PID=$!

echo "Esperando a que la web este lista en localhost:3000..."
until curl -s --max-time 1 http://localhost:3000 > /dev/null 2>&1; do
  sleep 2
done

echo "Web lista. Abriendo panel admin, Twitch y OBS..."
if [ "$IS_WINDOWS" = "1" ]; then
  # En Windows: abrir navegador + OBS posicionados en el segundo monitor,
  # cerrando y reabriendo OBS si ya estaba en ejecucion.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "dev-layout.ps1" \
    -AdminUrl "$ADMIN_URL" -TwitchUrl "$TWITCH_URL" || true
else
  open_url "$ADMIN_URL"
  open_url "$TWITCH_URL"
  if command -v obs >/dev/null 2>&1; then
    echo "Reiniciando OBS..."
    pkill -f obs >/dev/null 2>&1 || true
    sleep 1
    obs >/dev/null 2>&1 &
  fi
fi

wait $DEV_PID
