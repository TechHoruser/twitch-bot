@echo off
cd /d "%~dp0"

echo Cerrando instancia previa del servidor de desarrollo (si existe)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

start "Stream Toolkit" cmd /k npm run dev

echo Esperando a que la web este lista en localhost:3000...
:wait
timeout /t 2 /nobreak > nul
curl -s --max-time 1 http://localhost:3000 > nul 2>&1
if errorlevel 1 goto wait

echo Web lista. Abriendo navegador y OBS en el segundo monitor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-layout.ps1" -AdminUrl "http://localhost:3000/admin" -TwitchUrl "https://www.twitch.tv/horuser"
