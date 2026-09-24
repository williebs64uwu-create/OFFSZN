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
cmake -G "Xcode" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0" \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      ..

# 3. Compilar en modo Release
echo "--> Compilando el plugin en modo Release..."
cmake --build . --config Release --parallel 4

# Volver a la raíz del repositorio
cd ..

# 4. Crear estructura para el instalador (.pkg)
echo "--> Preparando estructura de directorios del instalador..."

INSTALLER_DIR="MacInstaller"
ROOT_DIR="$INSTALLER_DIR/Root"
SCRIPTS_DIR="$INSTALLER_DIR/Scripts"

VST3_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/VST3"
AU_DIR="$ROOT_DIR/Library/Audio/Plug-Ins/Components"
APP_DIR="$ROOT_DIR/Applications"
GUI_DIR="$ROOT_DIR/Library/Application Support/OFFSZN/COCA_COLAGui"

rm -rf "$INSTALLER_DIR"
mkdir -p "$VST3_DIR"
mkdir -p "$AU_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$GUI_DIR"
mkdir -p "$SCRIPTS_DIR"

# 5. Copiar los archivos compilados a la estructura del instalador (sin duplicados)
echo "--> Copiando VST3..."
if [ -d "build_mac/${PROJECT_NAME}_artefacts/Release/VST3/${PROJECT_NAME}.vst3" ]; then
    cp -R "build_mac/${PROJECT_NAME}_artefacts/Release/VST3/${PROJECT_NAME}.vst3" "$VST3_DIR/"
else
    SRC=$(find ./build_mac -name "${PROJECT_NAME}.vst3" -type d | head -n 1)
    [ -n "$SRC" ] && cp -R "$SRC" "$VST3_DIR/"
fi

echo "--> Copiando AU (.component)..."
if [ -d "build_mac/${PROJECT_NAME}_artefacts/Release/AU/${PROJECT_NAME}.component" ]; then
    cp -R "build_mac/${PROJECT_NAME}_artefacts/Release/AU/${PROJECT_NAME}.component" "$AU_DIR/"
else
    SRC=$(find ./build_mac -name "${PROJECT_NAME}.component" -type d | head -n 1)
    [ -n "$SRC" ] && cp -R "$SRC" "$AU_DIR/"
fi

echo "--> Copiando Standalone App..."
if [ -d "build_mac/${PROJECT_NAME}_artefacts/Release/Standalone/${PROJECT_NAME}.app" ]; then
    cp -R "build_mac/${PROJECT_NAME}_artefacts/Release/Standalone/${PROJECT_NAME}.app" "$APP_DIR/"
else
    SRC=$(find ./build_mac -name "${PROJECT_NAME}.app" -type d | head -n 1)
    [ -n "$SRC" ] && cp -R "$SRC" "$APP_DIR/"
fi

echo "--> Firmando binarios con ad-hoc codesign para macOS (Apple Silicon Gatekeeper)..."
codesign --force --deep -s - "$VST3_DIR/${PROJECT_NAME}.vst3" || true
codesign --force --deep -s - "$AU_DIR/${PROJECT_NAME}.component" || true
codesign --force --deep -s - "$APP_DIR/${PROJECT_NAME}.app" || true

echo "--> Copiando GUI y Assets a Application Support..."
cp -f mockup.html "$GUI_DIR/" || true
cp -f index.html "$GUI_DIR/" || true
cp -f rack_bg.png "$GUI_DIR/" 2>/dev/null || true
cp -f BOTTLE-FULL.png "$GUI_DIR/" 2>/dev/null || true
cp -f BOTTLE-EMPTY.png "$GUI_DIR/" 2>/dev/null || true

# 6. Crear script postinstall para limpiar cuarentena y resetear AU cache para Logic
cat << 'EOF' > "$SCRIPTS_DIR/postinstall"
#!/bin/bash
# Limpiar cuarentena Gatekeeper en plugins instalados
xattr -cr "/Library/Audio/Plug-Ins/VST3/COCA_COLA.vst3" 2>/dev/null || true
xattr -cr "/Library/Audio/Plug-Ins/Components/COCA_COLA.component" 2>/dev/null || true
xattr -cr "/Applications/COCA_COLA.app" 2>/dev/null || true
chmod -R 755 "/Library/Audio/Plug-Ins/VST3/COCA_COLA.vst3" 2>/dev/null || true
chmod -R 755 "/Library/Audio/Plug-Ins/Components/COCA_COLA.component" 2>/dev/null || true
chmod -R 755 "/Library/Application Support/OFFSZN/COCA_COLAGui" 2>/dev/null || true

# Notificar al sistema de audio de macOS para registrar el Audio Unit en Logic Pro
killall -9 AudioComponentRegistrar 2>/dev/null || true
exit 0
EOF
chmod +x "$SCRIPTS_DIR/postinstall"

# 7. Generar el componente del paquete (.pkg) con scripts
echo "--> Generando componente del paquete..."
pkgbuild --root "$ROOT_DIR" \
         --scripts "$SCRIPTS_DIR" \
         --identifier "com.offszn.${LOWER_PROJECT_NAME}" \
         --version "$VERSION" \
         --install-location "/" \
         "$INSTALLER_DIR/${PROJECT_NAME}_Component.pkg"

# 8. Generar el instalador final usando productbuild
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
