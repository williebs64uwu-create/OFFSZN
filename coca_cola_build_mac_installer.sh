#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# OFFSZN — COCA-COLA macOS Build & Installer Script (VST3, AU, Component)
# ═══════════════════════════════════════════════════════════════════════════════
PROJECT_NAME="COCA_COLA"
DISPLAY_NAME="Coca-Cola"
VERSION="1.0.0"

LOWER_PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]')

echo "================================================="
echo " Compilando $DISPLAY_NAME v$VERSION para macOS "
echo "================================================="

# 1. Crear directorio de compilación
mkdir -p build_mac
cd build_mac

# 2. Generar proyecto Xcode usando CMake con soporte Apple Silicon + Intel
echo "--> Generando archivos de compilación con CMake..."
cmake -G "Xcode" -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0" ..

# 3. Compilar en modo Release
echo "--> Compilando el plugin en modo Release..."
cmake --build . --config Release --parallel 4

# Volver a la raíz del repositorio
cd ..

# 4. Crear estructura para el instalador (.pkg)
echo "--> Preparando estructura de directorios del instalador..."

INSTALLER_DIR="MacInstaller"
ROOT_DIR="$INSTALLER_DIR/Root"

VST3_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/VST3"
AU_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/Components"
APP_DIR="$ROOT_DIR/Applications"
GUI_DIR="$ROOT_DIR/Library/Application Support/OFFSZN/COCA_COLAGui"

rm -rf "$INSTALLER_DIR"
mkdir -p "$VST3_DIR"
mkdir -p "$AU_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$GUI_DIR"

# 5. Copiar los archivos compilados a la estructura del instalador
echo "--> Copiando VST3..."
find ./build_mac -name "${PROJECT_NAME}.vst3" -type d -exec cp -R {} "$VST3_DIR/" \; || true
find ./build_mac -name "COCA_COLA.vst3" -type d -exec cp -R {} "$VST3_DIR/" \; || true

echo "--> Copiando AU (.component)..."
find ./build_mac -name "${PROJECT_NAME}.component" -type d -exec cp -R {} "$AU_DIR/" \; || true
find ./build_mac -name "COCA_COLA.component" -type d -exec cp -R {} "$AU_DIR/" \; || true
find ./build_mac -name "*COCA*.component" -type d -exec cp -R {} "$AU_DIR/" \; || true

echo "--> Copiando Standalone App..."
find ./build_mac -name "${PROJECT_NAME}.app" -type d -exec cp -R {} "$APP_DIR/" \; || true
find ./build_mac -name "COCA_COLA.app" -type d -exec cp -R {} "$APP_DIR/" \; || true

echo "--> Copiando GUI y Assets a Application Support..."
cp -f mockup.html "$GUI_DIR/" || true
cp -f index.html "$GUI_DIR/" || true
cp -f rack_bg.png "$GUI_DIR/" 2>/dev/null || true
cp -f BOTTLE-FULL.png "$GUI_DIR/" 2>/dev/null || true
cp -f BOTTLE-EMPTY.png "$GUI_DIR/" 2>/dev/null || true

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

productbuild --distribution "$INSTALLER_DIR/distribution.xml" \
             --package-path "$INSTALLER_DIR" \
             "${PROJECT_NAME}_Mac_Installer_v${VERSION}.pkg"

echo "================================================="
echo " ¡Instalador macOS creado con éxito! "
echo " Archivo final: ${PROJECT_NAME}_Mac_Installer_v${VERSION}.pkg "
echo "================================================="
