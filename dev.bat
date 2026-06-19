@echo off
cd /d "%~dp0"

start "Stream Toolkit" cmd /k npm run dev

echo Esperando a que la web este lista en localhost:3000...
:wait
timeout /t 2 /nobreak > nul
curl -s --max-time 1 http://localhost:3000 > nul 2>&1
if errorlevel 1 goto wait

echo Web lista. Abriendo Chrome y OBS...
start chrome http://localhost:3000/admin
start "" "C:\Program Files\obs-studio\bin\64bit\obs64.exe" --enable-media-stream --use-fake-ui-for-media-stream
