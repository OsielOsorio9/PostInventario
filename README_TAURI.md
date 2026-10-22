# 🚀 FerreteríaPRO - Empaquetado con Tauri

## ⚡ Inicio Rápido

### Windows
```bash
# 1. Instalar Rust (si no lo tienes)
winget install Rustlang.Rustup

# 2. Instalar Visual Studio Build Tools
# Descarga desde: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Selecciona "Desktop development with C++"

# 3. Generar iconos (opcional pero recomendado)
npx tauri icon public/icon.png

# 4. Ejecutar el script de build
build-tauri.bat

# O manualmente:
npm run tauri:build
```

### macOS
```bash
# 1. Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Instalar Xcode Command Line Tools
xcode-select --install

# 3. Generar iconos
npx tauri icon public/icon.png

# 4. Ejecutar el script de build
chmod +x build-tauri.sh
./build-tauri.sh

# O manualmente:
npm run tauri:build
```

### Linux (Ubuntu/Debian)
```bash
# 1. Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Instalar dependencias del sistema
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# 3. Generar iconos
npx tauri icon public/icon.png

# 4. Ejecutar el script de build
chmod +x build-tauri.sh
./build-tauri.sh

# O manualmente:
npm run tauri:build
```

## 📦 Archivos Generados

Después del build, encontrarás los instaladores en:

```
src-tauri/target/release/bundle/
├── msi/
│   └── FerreteríaPRO_1.0.0_x64_en-US.msi    # Windows Installer
├── nsis/
│   └── FerreteríaPRO_1.0.0_x64-setup.exe    # Windows Setup
├── dmg/
│   └── FerreteríaPRO_1.0.0_x64.dmg          # macOS Disk Image
├── deb/
│   └── ferreteriapro_1.0.0_amd64.deb        # Debian/Ubuntu Package
└── appimage/
    └── ferreteriapro_1.0.0_amd64.AppImage   # Linux AppImage
```

## 🎯 Desarrollo Local

Para probar la aplicación en modo desarrollo:

```bash
npm run tauri:dev
```

Esto abrirá la aplicación en una ventana nativa con hot-reload.

## 🔧 Troubleshooting

### Windows: "WebView2 not found"
Instala WebView2 Runtime:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Windows: Error de compilación C++
Asegúrate de tener Visual Studio Build Tools instalado con "Desktop development with C++"

### Linux: "webkit2gtk not found"
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### macOS: Error de compilación
```bash
xcode-select --install
```

### Iconos no se generan
Asegúrate de tener un archivo PNG de al menos 1024x1024 píxeles:
```bash
npx tauri icon path/to/your-icon.png
```

## 📊 Tamaño de la Aplicación

- **Instalador Windows (.msi)**: ~8-12 MB
- **App macOS (.dmg)**: ~10-15 MB
- **Paquete Linux (.deb)**: ~8-12 MB
- **AppImage Linux**: ~10-15 MB

Comparado con Electron (~150-200 MB), Tauri es **10-20 veces más pequeño**.

## 🔄 Actualizar Versión

Para cambiar la versión de la aplicación:

1. Edita `src-tauri/tauri.conf.json`:
```json
{
  "package": {
    "version": "1.0.1"  // Cambia aquí
  }
}
```

2. Edita `src-tauri/Cargo.toml`:
```toml
[package]
version = "1.0.1"  # Cambia aquí
```

3. Reconstruye:
```bash
npm run tauri:build
```

## 📚 Documentación Adicional

- [TAURI.md](./TAURI.md) - Documentación completa de Tauri
- [QUICK_START_TAURI.md](./QUICK_START_TAURI.md) - Guía rápida

## ✅ Checklist Antes de Empaquetar

- [ ] Rust instalado (`rustc --version`)
- [ ] Dependencias del sistema instaladas
- [ ] `npm install` ejecutado
- [ ] Iconos generados en `src-tauri/icons/`
- [ ] `npm run tauri:dev` funciona correctamente
- [ ] Aplicación probada en modo desarrollo
- [ ] Versión actualizada en `tauri.conf.json` y `Cargo.toml`

## 🎓 Recursos

- [Documentación oficial de Tauri](https://tauri.app/v1/guides/)
- [API Reference](https://tauri.app/v1/api/)
- [Comunidad de Tauri](https://discord.com/invite/tauri)
