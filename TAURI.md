# FerreteríaPRO - Aplicación de Escritorio con Tauri

## 🚀 ¿Por qué Tauri?

✅ **Ultra ligero**: ~10MB vs ~200MB de Electron
✅ **Bajo consumo**: ~50-80MB RAM vs ~300MB de Electron
✅ **WebView nativo**: Usa el navegador del sistema (Edge WebView2 en Windows, WebKit en macOS, WebKitGTK en Linux)
✅ **Rust backend**: Más seguro y eficiente
✅ **Multiplataforma**: Windows, macOS, Linux
✅ **Offline completo**: Funciona sin internet

## 📦 Instalación de Tauri

### 1. Instalar Rust

**Windows:**
```powershell
winget install Rustlang.Rustup
```

**macOS/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Instalar dependencias del sistema

**Windows:**
- Instalar [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Seleccionar "Desktop development with C++"

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### 3. Instalar Tauri CLI

```bash
npm install --save-dev @tauri-apps/cli
```

## 🔧 Configuración

### 1. Inicializar Tauri

```bash
npx tauri init
```

Responde las preguntas:
- **App name**: FerreteríaPRO
- **Window title**: FerreteríaPRO
- **Web assets location**: `../dist`
- **Dev server URL**: `http://localhost:5173`
- **Dev command**: `npm run dev`
- **Build command**: `npm run build`

### 2. Configurar `src-tauri/tauri.conf.json`

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/schema.json",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "FerreteríaPRO",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "open": true
      },
      "fs": {
        "all": true,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "copyFile": true,
        "createDir": true,
        "removeDir": true,
        "removeFile": true,
        "renameFile": true,
        "exists": true
      },
      "dialog": {
        "all": true,
        "open": true,
        "save": true
      },
      "path": {
        "all": true
      }
    },
    "bundle": {
      "active": true,
      "category": "Business",
      "copyright": "",
      "deb": {
        "depends": []
      },
      "externalBin": [],
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.ferreteriapro.app",
      "longDescription": "Sistema de Gestión de Ferretería",
      "macOS": {
        "entitlements": null,
        "exceptionDomain": "",
        "frameworks": [],
        "providerShortName": null,
        "signingIdentity": null
      },
      "resources": [],
      "shortDescription": "Gestión de Ferretería",
      "targets": "all",
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      }
    },
    "security": {
      "csp": null
    },
    "updater": {
      "active": false
    },
    "windows": [
      {
        "fullscreen": false,
        "height": 900,
        "resizable": true,
        "title": "FerreteríaPRO",
        "width": 1400,
        "minWidth": 1024,
        "minHeight": 768
      }
    ]
  }
}
```

### 3. Configurar `src-tauri/src/main.rs`

```rust
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 📝 Actualizar `package.json`

Agregar estos scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

## 🎨 Generar Iconos

### Opción 1: Usar icono existente

Si tienes un PNG de 1024x1024:

```bash
npx tauri icon path/to/your/icon.png
```

Esto generará todos los tamaños necesarios en `src-tauri/icons/`

### Opción 2: Crear icono simple

Crea un archivo `public/icon.svg` con tu logo y conviértelo:

```bash
# Instalar librsvg
# macOS: brew install librsvg
# Linux: sudo apt install librsvg2-bin

rsvg-convert -w 1024 -h 1024 public/icon.svg -o icon.png
npx tauri icon icon.png
```

## 🚀 Comandos de Uso

### Desarrollo

```bash
npm run tauri:dev
```

Esto:
1. Inicia el servidor de desarrollo Vite
2. Abre la app en una ventana nativa
3. Recarga automáticamente al cambiar código

### Compilar para Distribución

```bash
npm run tauri:build
```

Esto genera:
- **Windows**: `src-tauri/target/release/bundle/msi/FerreteríaPRO_1.0.0_x64_en-US.msi`
- **macOS**: `src-tauri/target/release/bundle/dmg/FerreteríaPRO_1.0.0_x64.dmg`
- **Linux**: 
  - `src-tauri/target/release/bundle/deb/ferreteriapro_1.0.0_amd64.deb`
  - `src-tauri/target/release/bundle/appimage/ferreteriapro_1.0.0_amd64.AppImage`

## 📊 Comparación: Electron vs Tauri

| Característica | Electron | Tauri |
|----------------|----------|-------|
| **Tamaño** | ~200MB | ~10MB |
| **RAM** | ~300MB | ~80MB |
| **Startup** | ~3-5s | ~1-2s |
| **Backend** | Node.js | Rust |
| **WebView** | Chromium embebido | Nativo del sistema |
| **Seguridad** | Buena | Excelente (Rust) |
| **Curva aprendizaje** | Baja | Media (requiere Rust) |

## 🔧 Características Avanzadas

### Acceso a Sistema de Archivos

Tauri permite acceso nativo al sistema de archivos:

```typescript
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
import { save, open } from '@tauri-apps/api/dialog';

// Guardar archivo
const filePath = await save({
  defaultPath: 'backup.json',
  filters: [{ name: 'JSON', extensions: ['json'] }]
});

if (filePath) {
  await writeTextFile(filePath, JSON.stringify(data));
}

// Abrir archivo
const selected = await open({
  filters: [{ name: 'JSON', extensions: ['json'] }]
});

if (selected) {
  const content = await readTextFile(selected as string);
  // Procesar contenido
}
```

### Notificaciones Nativas

```typescript
import { sendNotification } from '@tauri-apps/api/notification';

sendNotification({ title: 'FerreteríaPRO', body: 'Venta registrada' });
```

### Menú de Aplicación

En `src-tauri/src/main.rs`:

```rust
use tauri::{CustomMenuItem, Menu, Submenu};

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Salir");
    let submenu = Submenu::new("Archivo", Menu::new().add_item(quit));
    let menu = Menu::new().add_submenu(submenu);

    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| {
            match event.menu_item_id() {
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 🐛 Troubleshooting

### Error: "WebView2 not found" (Windows)

Instala [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Error: "webkit2gtk not found" (Linux)

```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### La app no carga en desarrollo

Verifica que Vite esté corriendo en el puerto correcto:
```bash
npm run dev
# Debe estar en http://localhost:5173
```

### Iconos no se muestran

Regenera los iconos:
```bash
npx tauri icon tu-icono.png
```

## 📦 Distribución

### Windows

Distribuye el archivo `.msi` o `.exe` generado en `src-tauri/target/release/bundle/`

### macOS

Distribuye el archivo `.dmg` o firma la app con certificado de Apple

### Linux

Distribuye el archivo `.deb` (Debian/Ubuntu) o `.AppImage` (universal)

## 🔄 Actualizaciones Automáticas

Tauri soporta actualizaciones automáticas. Configura en `tauri.conf.json`:

```json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.tu-sitio.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "TU_CLAVE_PUBLICA"
    }
  }
}
```

## 📚 Recursos

- [Documentación oficial de Tauri](https://tauri.app/v1/guides/)
- [API Reference](https://tauri.app/v1/api/)
- [Ejemplos](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [Discord de Tauri](https://discord.com/invite/tauri)

## ✅ Checklist de Migración

- [ ] Instalar Rust
- [ ] Instalar dependencias del sistema
- [ ] Instalar Tauri CLI (`npm install --save-dev @tauri-apps/cli`)
- [ ] Ejecutar `npx tauri init`
- [ ] Configurar `tauri.conf.json`
- [ ] Crear `src-tauri/src/main.rs`
- [ ] Actualizar `package.json` con scripts de Tauri
- [ ] Generar iconos (`npx tauri icon`)
- [ ] Probar en desarrollo (`npm run tauri:dev`)
- [ ] Compilar para distribución (`npm run tauri:build`)
- [ ] Probar instaladores generados
- [ ] Configurar actualizaciones automáticas (opcional)

## 🎯 Ventajas para FerreteríaPRO

✅ **Portabilidad**: App de 10MB que cabe en cualquier USB
✅ **Rápido**: Inicio instantáneo, ideal para punto de venta
✅ **Offline**: Funciona completamente sin internet
✅ **Seguro**: Datos encriptados localmente
✅ **Profesional**: Instalador nativo con icono y menú
✅ **Actualizable**: Sistema de actualizaciones automático
✅ **Multiplataforma**: Un solo código para Windows, Mac y Linux
