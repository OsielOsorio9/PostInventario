# FerreteríaPRO - Aplicación de Escritorio con Electron

## 📦 Empaquetar como App de Escritorio

### Requisitos Previos
- Node.js 18+ instalado
- npm o yarn

### Pasos para Crear la App de Escritorio

#### 1. Instalar Electron y dependencias

```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

#### 2. Crear archivo `electron/main.js`

```javascript
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Menú personalizado
const template = [
  {
    label: 'Archivo',
    submenu: [
      { label: 'Exportar Respaldo', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu-export') },
      { type: 'separator' },
      { label: 'Salir', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]
  },
  {
    label: 'Ver',
    submenu: [
      { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.webContents.reload() },
      { label: 'Pantalla Completa', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
      { type: 'separator' },
      { label: 'Modo Kiosco', accelerator: 'F9', click: () => mainWindow.webContents.send('menu-kiosco') }
    ]
  },
  {
    label: 'Ayuda',
    submenu: [
      { label: 'Atajos de Teclado', accelerator: 'F1', click: () => mainWindow.webContents.send('menu-help') }
    ]
  }
];

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

#### 3. Actualizar `package.json`

Agregar estos campos:

```json
{
  "name": "ferreteria-pro",
  "version": "1.0.0",
  "description": "Sistema de Gestión de Ferretería",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:preview": "npm run build && electron ."
  },
  "build": {
    "appId": "com.ferreteriapro.app",
    "productName": "FerreteríaPRO",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "public/icon.png"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "public/icon.png"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "public/icon.png"
    }
  }
}
```

#### 4. Crear icono

Coloca un icono PNG de 512x512 en `public/icon.png`

#### 5. Comandos de uso

**Desarrollo:**
```bash
npm run electron:dev
```

**Compilar para distribución:**
```bash
npm run electron:build
```

**Preview de la build:**
```bash
npm run electron:preview
```

### Archivos Generados

Los instaladores se generan en la carpeta `release/`:
- **Windows**: `FerreteríaPRO Setup 1.0.0.exe` (NSIS) y `FerreteríaPRO 1.0.0.exe` (Portable)
- **macOS**: `FerreteríaPRO-1.0.0.dmg`
- **Linux**: `FerreteríaPRO-1.0.0.AppImage` y `ferreteria-pro_1.0.0_amd64.deb`

### Ventajas de Electron

✅ **Offline completo**: Funciona sin internet
✅ **Acceso a sistema de archivos**: Backups automáticos
✅ **Mejor rendimiento**: Sin limitaciones del navegador
✅ **Actualizaciones automáticas**: Con electron-updater
✅ **Multiplataforma**: Windows, macOS, Linux

### Consideraciones

- **Tamaño**: La app pesará ~150-200MB (incluye Chromium)
- **Memoria**: Usa ~200-300MB de RAM
- **Seguridad**: Los datos se almacenan localmente en IndexedDB del navegador embebido
- **Actualizaciones**: Puedes implementar auto-actualización con electron-updater

### Alternativa: Tauri (Más Ligero)

Si prefieres una app más ligera (~10MB), considera [Tauri](https://tauri.app/):

```bash
npm install --save-dev @tauri-apps/cli @tauri-apps/api
npx tauri init
npm run tauri dev
npm run tauri build
```

Tauri usa el WebView del sistema en lugar de Chromium, resultando en apps mucho más pequeñas y eficientes.
