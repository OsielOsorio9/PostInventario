#!/bin/bash

# Script de instalación y build para FerreteríaPRO con Tauri
# Ejecutar en macOS/Linux

echo "🔧 FerreteríaPRO - Instalación de Tauri"
echo "========================================"
echo ""

# Verificar si Rust está instalado
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust no está instalado"
    echo "Instálalo con: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo "✅ Rust instalado: $(rustc --version)"
echo ""

# Instalar dependencias de Tauri
echo "📦 Instalando dependencias de Tauri..."
npm install

# Verificar que los archivos de Tauri existan
if [ ! -f "src-tauri/tauri.conf.json" ]; then
    echo "❌ src-tauri/tauri.conf.json no encontrado"
    exit 1
fi

if [ ! -f "src-tauri/src/main.rs" ]; then
    echo "❌ src-tauri/src/main.rs no encontrado"
    exit 1
fi

echo "✅ Archivos de Tauri encontrados"
echo ""

# Verificar iconos
if [ ! -d "src-tauri/icons" ]; then
    echo "⚠️  No se encontraron iconos en src-tauri/icons/"
    echo "Genera iconos con: npx tauri icon tu-icono.png"
    echo ""
    read -p "¿Continuar sin iconos personalizados? (s/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🚀 Iniciando build de Tauri..."
echo "Esto puede tardar varios minutos la primera vez..."
echo ""

# Ejecutar build de Tauri
npm run tauri:build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Build completado exitosamente!"
    echo ""
    echo "📦 Los instaladores están en:"
    echo "   src-tauri/target/release/bundle/"
    echo ""
    echo "📂 Archivos generados:"
    ls -lh src-tauri/target/release/bundle/*/ 2>/dev/null || echo "   (Verifica la carpeta bundle)"
else
    echo ""
    echo "❌ Error durante el build"
    exit 1
fi
