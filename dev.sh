#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

TWITCH_CHANNEL="horuser"
TWITCH_URL="https://www.twitch.tv/${TWITCH_CHANNEL}"
ADMIN_URL="http://localhost:3000/admin"

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

npm run dev &
DEV_PID=$!

echo "Esperando a que la web este lista en localhost:3000..."
until curl -s --max-time 1 http://localhost:3000 > /dev/null 2>&1; do
  sleep 2
done

echo "Web lista. Abriendo panel admin y Twitch..."
open_url "$ADMIN_URL"
open_url "$TWITCH_URL"

if command -v obs >/dev/null 2>&1; then
  echo "Abriendo OBS..."
  obs --enable-media-stream --use-fake-ui-for-media-stream >/dev/null 2>&1 &
fi

wait $DEV_PID
