# 🚀 Guía Rápida: FerreteríaPRO con Tauri

## Instalación en 5 Pasos

### 1️⃣ Instalar Rust

**Windows:**
```powershell
winget install Rustlang.Rustup
```

**macOS/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2️⃣ Instalar Dependencias del Sistema

**Windows:**
- Descargar e instalar [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Seleccionar "Desktop development with C++"

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### 3️⃣ Generar Iconos

Necesitas un icono PNG de al menos 1024x1024 píxeles:

```bash
# Si tienes un icono PNG
npx tauri icon path/to/your-icon.png

# Esto creará todos los tamaños necesarios en src-tauri/icons/
```

### 4️⃣ Probar en Desarrollo

```bash
npm run tauri:dev
```

Esto abrirá la app en una ventana nativa con hot-reload.

### 5️⃣ Compilar para Distribución

```bash
npm run tauri:build
```

Los instaladores se generarán en `src-tauri/target/release/bundle/`:
- **Windows**: `.msi` y `.exe`
- **macOS**: `.dmg`
- **Linux**: `.deb` y `.AppImage`

## 📊 Comparación Rápida

| | Electron | Tauri |
|---|---|---|
| **Tamaño** | ~200MB | ~10MB |
| **RAM** | ~300MB | ~80MB |
| **Inicio** | 3-5s | 1-2s |
| **Backend** | Node.js | Rust |

## 🎯 Comandos Útiles

```bash
# Desarrollo
npm run tauri:dev

# Build de producción
npm run tauri:build

# Solo build del frontend
npm run build

# Ver logs
npm run tauri:dev -- --verbose
```

## 🐛 Solución de Problemas

### WebView2 no encontrado (Windows)
Descarga e instala [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Error de compilación en Linux
```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### La app no carga
Verifica que el servidor Vite esté corriendo en `http://localhost:5173`

## 📚 Más Información

Para detalles completos, consulta [TAURI.md](./TAURI.md)

## ✅ Checklist Final

- [ ] Rust instalado (`rustc --version`)
- [ ] Dependencias del sistema instaladas
- [ ] Iconos generados (`src-tauri/icons/` existe)
- [ ] `npm run tauri:dev` funciona
- [ ] `npm run tauri:build` genera instaladores
- [ ] Probado en Windows/macOS/Linux según necesidad
