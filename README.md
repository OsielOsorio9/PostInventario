# 🔧 FerreteríaPRO

Sistema de gestión de ferretería completo, desarrollado con React + Vite + TypeScript.

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

**Windows:**
```bash
# Haz doble clic en:
instalar.bat
```

**Manual (cualquier sistema):**
```bash
npm install
```

### 2. Abrir la Aplicación

**Opción A: Con servidor (desarrollo)**
```bash
# Windows: doble clic en
abrir.bat

# Mac/Linux:
chmod +x abrir.sh
./abrir.sh
```

**Opción B: HTML portable (un solo archivo)**
```bash
# Windows: doble clic en
build-portable.bat

# O manualmente:
npm run build:portable
```
Esto genera `dist/index.html` que se puede abrir con doble clic.

---

## 📦 Opciones de Ejecución

| Método | Comando | Resultado |
|--------|---------|-----------|
| **Desarrollo** | `abrir.bat` | Servidor en localhost:3000 |
| **Portable** | `build-portable.bat` | Un solo HTML (~1-2 MB) |
| **Build normal** | `npm run build` | Carpeta dist/ con múltiples archivos |
| **Preview** | `npm run preview` | Servidor estático en localhost:4173 |
| **App escritorio** | `npm run tauri:build` | Instalador nativo (~10 MB) |

---

## 🎯 Características

- ✅ **Inventario completo** con búsqueda fuzzy y gestión de fotos
- ✅ **Punto de venta (POS)** con pagos en CUP/USD y crédito
- ✅ **Conversión automática** USD ↔ CUP según tasa
- ✅ **Cálculo de PEP** (Precio Promedio Ponderado) automático
- ✅ **Cierre semanal** con distribución de ganancias
- ✅ **Métricas en tiempo real** con gráficos
- ✅ **Cuentas por cobrar** con abonos
- ✅ **Control de merma** para productos defectuosos
- ✅ **Encriptación AES-256** para respaldos
- ✅ **Multi-moneda** (CUP y USD)
- ✅ **100% offline** - funciona sin internet

---

## 📚 Documentación

- [Cómo abrir la aplicación](./COMO_ABRIR.md)
- [Solución de problemas](./SOLUCION_PROBLEMAS.md)
- [Guía de Tauri (app de escritorio)](./README_TAURI.md)
- [Documentación completa de Tauri](./TAURI.md)

---

## 🛠️ Comandos Disponibles

```bash
# Instalación
npm install                    # Instalar dependencias

# Desarrollo
npm run dev                    # Servidor de desarrollo
npm run build                  # Build para producción
npm run build:portable         # Build portable (un solo HTML)
npm run preview                # Preview del build

# App de escritorio (requiere Tauri)
npm run tauri:dev              # Desarrollo con Tauri
npm run tauri:build            # Compilar instalador nativo

# Utilidades
npm run typecheck              # Verificar tipos TypeScript
```

---

## 📋 Requisitos

- **Node.js** 18+ ([descargar](https://nodejs.org/))
- **npm** 8+ (incluido con Node.js)
- **Navegador moderno** (Chrome, Firefox, Edge, Safari)

Para app de escritorio (opcional):
- **Rust** ([instalar](https://rustup.rs/))
- **Tauri** (se instala con `npm install`)

---

## 🔐 Credenciales de Acceso

**Clave maestra:** `123+3210@`

Al abrir la aplicación por primera vez, te pedirá esta clave para activar la licencia.

---

## 💾 Respaldo de Datos

Los datos se almacenan localmente en el navegador (IndexedDB).

**Hacer respaldo:**
1. Ve a "Respaldo" en el menú
2. Click en "Exportar JSON Cifrado" o "Exportar Excel"

**Restaurar:**
1. Ve a "Respaldo"
2. Click en "Restaurar desde JSON"

---

## 🌐 Tecnologías

- **Frontend:** React 18 + TypeScript
- **Build tool:** Vite
- **Estilos:** Tailwind CSS
- **Gráficos:** Chart.js
- **Búsqueda:** Fuse.js
- **Excel:** SheetJS (xlsx)
- **Encriptación:** Web Crypto API (AES-256-GCM)
- **Base de datos:** IndexedDB
- **App escritorio:** Tauri (opcional)

---

## 📄 Licencia

Este proyecto es privado y confidencial.

---

## 🆘 ¿Problemas?

Consulta la [guía de solución de problemas](./SOLUCION_PROBLEMAS.md) o ejecuta:

```bash
instalar.bat
```
