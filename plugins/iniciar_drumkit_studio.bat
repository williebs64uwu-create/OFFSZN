@echo off
title FL Studio Drumkit Studio (Desktop App)
echo ========================================================
echo   Iniciando FL Studio Drumkit Studio - Desktop Edition
echo ========================================================
echo.
cd /d "d:\!OFFSZN\PROYECTOS\OFFSZN\plugins"

start "" /B node drumkit_desktop_server.js
timeout /t 1 /nobreak >nul

:: Intentar abrir en modo App de Microsoft Edge o Google Chrome (sin barra de navegador)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:4782 --window-size=1440,900
    exit
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:4782 --window-size=1440,900
    exit
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:4782 --window-size=1440,900
    exit
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://localhost:4782 --window-size=1440,900
    exit
)

:: Si no encuentra Edge o Chrome, abrir en el navegador predeterminado
start http://localhost:4782
exit
