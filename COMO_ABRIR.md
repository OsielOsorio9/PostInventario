# 🚀 FerreteríaPRO - Cómo Abrir la Aplicación

## ⚡ Opción 1: Abrir con Servidor de Desarrollo (Recomendado)

### Windows
```bash
# Simplemente haz doble clic en:
abrir.bat
```

### macOS/Linux
```bash
# Dar permisos de ejecución (solo la primera vez)
chmod +x abrir.sh

# Luego ejecuta:
./abrir.sh
```

**¿Qué hace este script?**
1. Verifica que Node.js esté instalado
2. Instala dependencias si es necesario
3. Inicia el servidor de desarrollo en `http://localhost:3000`
4. Abre automáticamente el navegador

**Para detener:** Cierra la ventana del servidor o presiona `Ctrl+C`

---

## 📦 Opción 2: Build Portable (Un Solo Archivo HTML)

Si quieres un archivo HTML que se pueda abrir con doble clic **sin servidor**:

### Windows
```bash
# Haz doble clic en:
build-portable.bat
```

### Manualmente (cualquier sistema)
```bash
npm run build:portable
```

**Resultado:** Se genera `dist/index.html` - un único archivo que contiene:
- ✅ Todo el HTML
- ✅ Todo el CSS (inline)
- ✅ Todo el JavaScript (inline)
- ✅ Fuentes y recursos (inline)

**Ventajas:**
- Se puede abrir con doble clic directamente
- Se puede copiar a un USB
- Se puede enviar por email
- No requiere servidor web

**Limitaciones:**
- El archivo será más grande (~1-2 MB)
- IndexedDB funciona correctamente en `file://`
- Algunas funciones de red pueden estar limitadas

---

## 🌐 Opción 3: Servir con Preview

Si ya hiciste un build normal (`npm run build`), puedes servirlo con:

```bash
npm run preview
```

Esto inicia un servidor estático en `http://localhost:4173` que sirve los archivos de `dist/`.

---

## 🔧 Opción 4: Configuración Manual para `file://`

Si quieres que el build normal funcione con doble clic:

### 1. Editar `vite.config.js`

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',  // ← Agregar esta línea
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
```

### 2. Hacer build

```bash
npm run build
```

### 3. Abrir `dist/index.html`

Ahora puedes abrir `dist/index.html` con doble clic.

**⚠️ Nota:** Esto funciona porque:
- `base: './'` usa rutas relativas en lugar de absolutas
- Los módulos ES funcionan en `file://` en navegadores modernos
- IndexedDB funciona en `file://`

---

## 📊 Comparación de Métodos

| Método | Requiere Servidor | Tamaño | Velocidad | Recomendado para |
|--------|-------------------|--------|-----------|------------------|
| `abrir.bat` / `abrir.sh` | ✅ Sí | N/A | ⚡ Rápido | Desarrollo diario |
| Build Portable | ❌ No | ~1-2 MB | ⚡ Rápido | Distribución, USB |
| `npm run preview` | ✅ Sí | ~500 KB | ⚡ Rápido | Testing de build |
| `file://` con `base: './'` | ❌ No | ~500 KB | ⚡ Rápido | Uso local simple |

---

## 🎯 ¿Cuál Usar?

### Para Desarrollo
```bash
abrir.bat  # o ./abrir.sh en Mac/Linux
```
- Hot-reload automático
- Cambios instantáneos
- Ideal para programar

### Para Distribuir
```bash
build-portable.bat  # Genera un solo HTML
```
- Un solo archivo
- Se puede compartir fácilmente
- No requiere instalación

### Para Producción (App de Escritorio)
```bash
npm run tauri:build  # Genera instalador nativo
```
- App nativa de ~10 MB
- Instalador profesional
- Mejor rendimiento

---

## 🐛 Solución de Problemas

### "Node.js no está instalado"
Descarga e instala Node.js desde: https://nodejs.org/

### "El puerto 3000 está en uso"
Cierra otras aplicaciones que usen el puerto 3000 o edita `vite.config.js` para usar otro puerto.

### "No se puede abrir file:// directamente"
Usa `build-portable.bat` que genera un archivo optimizado para `file://`

### "La página se ve en blanco"
- Verifica que el servidor esté corriendo
- Abre la consola del navegador (F12) para ver errores
- Asegúrate de que las dependencias estén instaladas (`npm install`)

---

## 📝 Resumen de Comandos

```bash
# Desarrollo (con servidor)
abrir.bat                    # Windows
./abrir.sh                   # Mac/Linux

# Build portable (un solo HTML)
build-portable.bat           # Windows
npm run build:portable       # Cualquier sistema

# Build normal
npm run build                # Genera dist/ con múltiples archivos

# Preview del build
npm run preview              # Sirve dist/ en localhost:4173

# App de escritorio
npm run tauri:build          # Genera instalador nativo (~10 MB)
```

---

## ✅ Checklist Rápido

- [ ] Node.js instalado (`node --version`)
- [ ] Dependencias instaladas (`npm install`)
- [ ] Elegir método de apertura
- [ ] Ejecutar el comando correspondiente
- [ ] Aplicación abierta en el navegador

---

## 📚 Más Información

- [README principal](./README.md)
- [Guía de Tauri](./README_TAURI.md)
- [Documentación de Tauri](./TAURI.md)
