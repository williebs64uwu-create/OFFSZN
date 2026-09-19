@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       EASY PITCH - Compilacion Automatica VST3
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Configurando proyecto con CMake...
cmake -B build -G "Visual Studio 17 2022" -A x64
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo la configuracion de CMake.
    pause
    exit /b 1
)

echo.
echo [2/3] Compilando EASY PITCH en modo Release (x64)...
cmake --build build --config Release --parallel
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo la compilacion con Visual Studio.
    pause
    exit /b 1
)

echo.
echo [3/3] Copiando interfaz mockup.html a la carpeta de Standalone...
if exist "build\EASY_PITCH_artefacts\Release\Standalone" (
    copy /Y "mockup.html" "build\EASY_PITCH_artefacts\Release\Standalone\mockup.html" >nul
)

echo.
echo ========================================================
echo   COMPILACION EXITOSA!
echo   - VST3: build\EASY_PITCH_artefacts\Release\VST3\EASY PITCH.vst3
echo   - App:  build\EASY_PITCH_artefacts\Release\Standalone\EASY PITCH.exe
echo ========================================================
echo.

pause
