#!/bin/bash

# ========================================
#   FerreteríaPRO - Abrir Aplicación
# ========================================
# Este script inicia el servidor de desarrollo
# y abre la aplicación en el navegador
# ========================================

echo ""
echo "========================================"
echo "  FerreteríaPRO - Iniciando..."
echo "========================================"
echo ""

# Cambiar a la carpeta del proyecto
cd "$(dirname "$0")"

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    echo "[X] Node.js no está instalado"
    echo ""
    echo "Descarga Node.js desde:"
    echo "https://nodejs.org/"
    echo ""
    exit 1
fi

echo "[OK] Node.js encontrado:"
node --version
echo ""

# Verificar que las dependencias estén instaladas
if [ ! -d "node_modules" ]; then
    echo "[!] Instalando dependencias..."
    npm install
    echo ""
fi

echo "[OK] Dependencias instaladas"
echo ""
echo "Iniciando servidor de desarrollo..."
echo "La aplicación estará disponible en: http://localhost:3000"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

# Detectar el comando para abrir el navegador
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    OPEN_CMD="open"
else
    # Linux
    OPEN_CMD="xdg-open"
fi

# Iniciar el servidor en segundo plano
npm run dev &
SERVER_PID=$!

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "Deteniendo servidor..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}

# Capturar Ctrl+C
trap cleanup SIGINT SIGTERM

# Esperar a que el servidor inicie
echo "Esperando a que el servidor esté listo..."
sleep 5

# Abrir el navegador
echo "Abriendo navegador..."
$OPEN_CMD "http://localhost:3000"

echo ""
echo "========================================"
echo "[OK] Servidor iniciado correctamente"
echo "========================================"
echo ""
echo "La aplicación está corriendo en:"
echo "http://localhost:3000"
echo ""
echo "Para detener el servidor:"
echo "Presiona Ctrl+C en esta ventana"
echo ""
echo "========================================"
echo ""

# Mantener el servidor corriendo
wait $SERVER_PID
