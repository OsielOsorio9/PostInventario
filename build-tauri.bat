@echo off
REM Script de instalación y build para FerreteríaPRO con Tauri
REM Ejecutar en Windows

echo.
echo ========================================
echo   FerreteríaPRO - Instalación de Tauri
echo ========================================
echo.

REM Verificar si Rust está instalado
where rustc >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Rust no está instalado
    echo.
    echo Descarga e instala Rust desde:
    echo https://rustup.rs/
    echo.
    echo O ejecuta en PowerShell:
    echo winget install Rustlang.Rustup
    echo.
    pause
    exit /b 1
)

echo [OK] Rust instalado:
rustc --version
echo.

REM Instalar dependencias
echo Instalando dependencias...
call npm install

REM Verificar archivos de Tauri
if not exist "src-tauri\tauri.conf.json" (
    echo [X] src-tauri\tauri.conf.json no encontrado
    pause
    exit /b 1
)

if not exist "src-tauri\src\main.rs" (
    echo [X] src-tauri\src\main.rs no encontrado
    pause
    exit /b 1
)

echo [OK] Archivos de Tauri encontrados
echo.

REM Verificar iconos
if not exist "src-tauri\icons" (
    echo [!] No se encontraron iconos en src-tauri\icons\
    echo Genera iconos con: npx tauri icon tu-icono.png
    echo.
)

echo.
echo Iniciando build de Tauri...
echo Esto puede tardar varios minutos la primera vez...
echo.

REM Ejecutar build de Tauri
call npm run tauri:build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Build completado exitosamente!
    echo.
    echo Los instaladores están en:
    echo    src-tauri\target\release\bundle\
    echo.
    echo Archivos generados:
    dir /s /b src-tauri\target\release\bundle\*.msi 2>nul
    dir /s /b src-tauri\target\release\bundle\*.exe 2>nul
) else (
    echo.
    echo [X] Error durante el build
    echo.
    echo Posibles soluciones:
    echo 1. Instala Visual Studio Build Tools
    echo    https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo 2. Instala WebView2 Runtime
    echo    https://developer.microsoft.com/en-us/microsoft-edge/webview2/
    echo 3. Verifica que Rust esté correctamente instalado
)

echo.
pause
