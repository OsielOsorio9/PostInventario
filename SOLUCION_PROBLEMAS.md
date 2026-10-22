# 🔧 Solución de Problemas - FerreteríaPRO

## ❌ Error: "vite no se reconoce como un comando"

### Causa
Las dependencias del proyecto no están instaladas.

### ✅ Solución Rápida

**Opción 1: Ejecutar el instalador (Recomendado)**
```bash
# Haz doble clic en:
instalar.bat
```

**Opción 2: Instalar manualmente**
```bash
# Abre CMD o PowerShell en la carpeta del proyecto
npm install
```

**Opción 3: Si npm install falla**
```bash
# Elimina node_modules y el lock file
rmdir /s /q node_modules
del package-lock.json

# Reinstala
npm install
```

---

## ❌ Error: "Node.js no está instalado"

### Causa
Node.js no está instalado en tu sistema.

### ✅ Solución

**Opción 1: Con winget (Windows 10/11)**
```powershell
winget install OpenJS.NodeJS.LTS
```

**Opción 2: Descarga manual**
1. Ve a: https://nodejs.org/
2. Descarga la versión **LTS** (recomendada)
3. Ejecuta el instalador
4. **CIERRA y REABRE** la terminal
5. Verifica: `node --version`

---

## ❌ Error: "El puerto 3000 está en uso"

### Causa
Otra aplicación está usando el puerto 3000.

### ✅ Solución

**Opción 1: Cerrar la otra aplicación**
Busca y cierra cualquier servidor web que esté corriendo.

**Opción 2: Cambiar el puerto**
Edita `vite.config.js`:
```javascript
export default defineConfig({
  server: {
    port: 3001,  // Cambia a otro puerto
  },
});
```

---

## ❌ Error: "No se puede abrir file:// directamente"

### Causa
El build normal usa rutas absolutas que no funcionan con `file://`.

### ✅ Solución

**Opción 1: Usar build portable (Recomendado)**
```bash
build-portable.bat
```
Esto genera un único archivo HTML que se puede abrir con doble clic.

**Opción 2: Configurar base relativa**
Edita `vite.config.js`:
```javascript
export default defineConfig({
  base: './',  // Agrega esta línea
  // ... resto de configuración
});
```
Luego ejecuta `npm run build` y abre `dist/index.html`.

---

## ❌ Error: "La página se ve en blanco"

### Causa
Puede ser un error de JavaScript o problema de conexión.

### ✅ Solución

1. **Abre la consola del navegador** (F12)
2. Ve a la pestaña "Console"
3. Busca errores en rojo
4. Verifica que el servidor esté corriendo
5. Recarga la página (Ctrl+F5)

---

## ❌ Error: "npm install tarda mucho o falla"

### Causa
Problemas de red o configuración de npm.

### ✅ Solución

**Opción 1: Usar mirror de npm**
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

**Opción 2: Limpiar caché de npm**
```bash
npm cache clean --force
npm install
```

**Opción 3: Usar yarn (alternativa)**
```bash
npm install -g yarn
yarn install
```

---

## ❌ Error: "Tauri no compila"

### Causa
Faltan dependencias de Rust o herramientas de build.

### ✅ Solución

**Windows:**
1. Instala Rust: https://rustup.rs/
2. Instala Visual Studio Build Tools
3. Selecciona "Desktop development with C++"

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential
```

---

## 📋 Checklist de Instalación

Antes de ejecutar la aplicación, verifica:

- [ ] **Node.js instalado**: `node --version` (debe mostrar v18+ o v20+)
- [ ] **npm instalado**: `npm --version` (debe mostrar 8+)
- [ ] **Dependencias instaladas**: existe la carpeta `node_modules`
- [ ] **Vite disponible**: `node_modules/.bin/vite.cmd` existe (Windows)

---

## 🚀 Comandos Útiles

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Build para producción
npm run build

# Build portable (un solo HTML)
npm run build:portable

# Preview del build
npm run preview

# App de escritorio (requiere Tauri)
npm run tauri:build
```

---

## 📞 ¿Sigues teniendo problemas?

1. **Verifica tu versión de Node.js**
   ```bash
   node --version
   npm --version
   ```
   Debe ser Node.js 18+ y npm 8+

2. **Elimina y reinstala**
   ```bash
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   ```

3. **Ejecuta como administrador** (Windows)
   - Click derecho en CMD o PowerShell
   - "Ejecutar como administrador"

4. **Verifica el firewall/antivirus**
   - Asegúrate de que no esté bloqueando Node.js o npm

---

## 📚 Más Información

- [Cómo abrir la aplicación](./COMO_ABRIR.md)
- [Guía de Tauri](./README_TAURI.md)
- [Documentación completa](./TAURI.md)
