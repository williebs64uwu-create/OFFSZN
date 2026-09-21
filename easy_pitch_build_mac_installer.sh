#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# OFFSZN — EASY PITCH macOS Build & Installer Script (VST3, AU, Component)
# ═══════════════════════════════════════════════════════════════════════════════
PROJECT_NAME="EASY_PITCH"
DISPLAY_NAME="EASY PITCH"
BUNDLE_NAME="EASY PITCH"
VERSION="1.0.0"

LOWER_PROJECT_NAME="easypitch"

echo "================================================="
echo " Compilando $DISPLAY_NAME v$VERSION para macOS "
echo "================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/plugins/easy-pitch"

if [ -z "$JUCE_DIR" ]; then
    if [ -d "$SCRIPT_DIR/JUCE" ]; then
        export JUCE_DIR="$SCRIPT_DIR/JUCE"
    elif [ -d "/opt/homebrew/share/JUCE" ]; then
        export JUCE_DIR="/opt/homebrew/share/JUCE"
    fi
fi

if [ ! -d "$PLUGIN_DIR" ]; then
    echo "Directorio de plugin no encontrado en $PLUGIN_DIR"
    exit 1
fi

cd "$PLUGIN_DIR"

# 1. Crear directorio de compilación
mkdir -p build_mac
cd build_mac

# 2. Generar proyecto Xcode usando CMake con soporte Universal (Apple Silicon + Intel)
echo "--> Generando archivos de compilación con CMake..."
cmake -G "Xcode" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0" \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      ..

# 3. Compilar en modo Release
echo "--> Compilando el plugin en modo Release..."
cmake --build . --config Release --parallel 4

# Volver al directorio del plugin
cd "$PLUGIN_DIR"

# 4. Crear estructura para el instalador (.pkg)
echo "--> Preparando estructura de directorios del instalador..."

INSTALLER_DIR="$PLUGIN_DIR/MacInstaller"
ROOT_DIR="$INSTALLER_DIR/Root"

VST3_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/VST3"
AU_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/Components"
APP_DIR="$ROOT_DIR/Applications"
GUI_DIR="$ROOT_DIR/Library/Application Support/OFFSZN/EasyPitchGui"

rm -rf "$INSTALLER_DIR"
mkdir -p "$VST3_DIR"
mkdir -p "$AU_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$GUI_DIR"

# 5. Copiar los artefactos compilados a la estructura del instalador
echo "--> Copiando VST3..."
find ./build_mac -name "EASY PITCH.vst3" -type d -exec cp -R {} "$VST3_DIR/" \; || true
find ./build_mac -name "EASY_PITCH.vst3" -type d -exec cp -R {} "$VST3_DIR/" \; || true

echo "--> Copiando AU (.component)..."
find ./build_mac -name "EASY PITCH.component" -type d -exec cp -R {} "$AU_DIR/" \; || true
find ./build_mac -name "EASY_PITCH.component" -type d -exec cp -R {} "$AU_DIR/" \; || true
find ./build_mac -name "*PITCH*.component" -type d -exec cp -R {} "$AU_DIR/" \; || true

echo "--> Copiando Standalone App..."
find ./build_mac -name "EASY PITCH.app" -type d -exec cp -R {} "$APP_DIR/" \; || true
find ./build_mac -name "EASY_PITCH.app" -type d -exec cp -R {} "$APP_DIR/" \; || true

echo "--> Copiando GUI (mockup.html) a Application Support y a los bundles..."
cp -f mockup.html "$GUI_DIR/mockup.html" || true

# Inyectar mockup.html también en Resources del bundle para redundancia absoluta
find "$VST3_DIR" -name "Resources" -type d -exec cp -f mockup.html {}/mockup.html \; || true
find "$AU_DIR" -name "Resources" -type d -exec cp -f mockup.html {}/mockup.html \; || true
find "$APP_DIR" -name "Resources" -type d -exec cp -f mockup.html {}/mockup.html \; || true

# 6. Generar el componente del paquete (.pkg)
echo "--> Generando componente del paquete..."
pkgbuild --root "$ROOT_DIR" \
         --identifier "com.offszn.${LOWER_PROJECT_NAME}" \
         --version "$VERSION" \
         --install-location "/" \
         "$INSTALLER_DIR/${PROJECT_NAME}_Component.pkg"

# 7. Generar el instalador final usando productbuild
echo "--> Generando Instalador Final (.pkg)..."
productbuild --synthesize \
             --package "$INSTALLER_DIR/${PROJECT_NAME}_Component.pkg" \
             "$INSTALLER_DIR/distribution.xml"

FINAL_PKG="$SCRIPT_DIR/EASY_PITCH_Mac_Installer_v${VERSION}.pkg"

productbuild --distribution "$INSTALLER_DIR/distribution.xml" \
             --package-path "$INSTALLER_DIR" \
             "$FINAL_PKG"

echo "================================================="
echo " ¡Instalador macOS creado con éxito! "
echo " Archivo final: $FINAL_PKG "
echo "================================================="
