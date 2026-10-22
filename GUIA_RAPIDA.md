# ⚡ Guía Rápida - FerreteríaPRO

## 🚨 ¿Error: "vite no se reconoce"?

**Solución en 3 pasos:**

### Paso 1: Verificar Node.js
```bash
node --version
```
Si no está instalado, descárgalo desde: https://nodejs.org/

### Paso 2: Instalar dependencias
```bash
# Opción A: Script automático (Windows)
instalar.bat

# Opción B: Manual
npm install
```

### Paso 3: Abrir la aplicación
```bash
# Opción A: Con servidor (recomendado)
abrir.bat

# Opción B: HTML portable (sin servidor)
build-portable.bat
```

---

## 📂 Scripts Disponibles

| Archivo | Qué hace |
|---------|----------|
| `instalar.bat` | Instala todas las dependencias |
| `abrir.bat` | Inicia servidor y abre navegador |
| `build-portable.bat` | Genera un solo HTML portable |
| `build-tauri.bat` | Compila app de escritorio |

---

## 🎯 Flujo de Trabajo

### Para Desarrollo
```bash
1. instalar.bat          # Solo la primera vez
2. abrir.bat             # Cada vez que quieras usar
3. Navegador → http://localhost:3000
```

### Para Distribuir
```bash
1. build-portable.bat    # Genera dist/index.html
2. Copia dist/index.html # Un solo archivo
3. Abre con doble clic   # Funciona sin servidor
```

### Para App de Escritorio
```bash
1. Instalar Rust: https://rustup.rs/
2. npm run tauri:build   # Genera instalador
3. Busca en src-tauri/target/release/bundle/
```

---

## ❓ Problemas Comunes

### "vite no se reconoce"
→ Ejecuta `instalar.bat` o `npm install`

### "Node.js no está instalado"
→ Descarga desde https://nodejs.org/

### "El puerto 3000 está en uso"
→ Cierra otras aplicaciones o cambia el puerto en `vite.config.js`

### "La página se ve en blanco"
→ Abre la consola (F12) y busca errores

---

## 📚 Más Información

- [Guía completa de apertura](./COMO_ABRIR.md)
- [Solución de problemas](./SOLUCION_PROBLEMAS.md)
- [Documentación de Tauri](./README_TAURI.md)

---

## ✅ Checklist Rápido

Antes de empezar, verifica:

- [ ] Node.js instalado (`node --version`)
- [ ] Dependencias instaladas (`npm install` o `instalar.bat`)
- [ ] Puerto 3000 disponible
- [ ] Navegador moderno (Chrome, Firefox, Edge)

Si todo está correcto, ejecuta `abrir.bat` y la aplicación se abrirá automáticamente.
