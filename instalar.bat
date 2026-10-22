@echo off
REM ========================================
REM   FerreteríaPRO - Instalación Inicial
REM ========================================
REM Este script instala todas las dependencias
REM necesarias para ejecutar la aplicación
REM ========================================

echo.
echo ========================================
echo   FerreteríaPRO - Instalación
echo ========================================
echo.

REM Cambiar a la carpeta del proyecto
cd /d "%~dp0"

REM Verificar que Node.js esté instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js no está instalado
    echo.
    echo ========================================
    echo PASO 1: Instalar Node.js
    echo ========================================
    echo.
    echo Opción 1 (Recomendada):
    echo   winget install OpenJS.NodeJS.LTS
    echo.
    echo Opción 2 (Manual):
    echo   Descarga desde: https://nodejs.org/
    echo   Instala la versión LTS
    echo.
    echo Después de instalar Node.js,
    echo CIERRA esta ventana y vuelve a ejecutar este script.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado:
node --version
echo.

REM Verificar npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm no está instalado
    echo Node.js parece estar incompleto.
    echo Reinstala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] npm encontrado:
npm --version
echo.

REM Verificar si node_modules existe
if exist "node_modules" (
    echo [OK] Dependencias ya instaladas
    echo.
    echo ¿Deseas reinstalarlas? (s/n)
    set /p REINSTALAR=
    if /i "%REINSTALAR%"=="s" (
        echo.
        echo Eliminando node_modules...
        rmdir /s /q node_modules
        echo.
    ) else (
        goto :SKIP_INSTALL
    )
)

echo ========================================
echo Instalando dependencias...
echo ========================================
echo.
echo Esto puede tardar 2-5 minutos
echo dependiendo de tu conexión a internet
echo.

REM Instalar dependencias
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [X] Error al instalar dependencias
    echo.
    echo Posibles soluciones:
    echo 1. Verifica tu conexión a internet
    echo 2. Ejecuta como administrador
    echo 3. Elimina node_modules y package-lock.json
    echo    y vuelve a ejecutar este script
    echo.
    pause
    exit /b 1
)

:SKIP_INSTALL
echo.
echo ========================================
echo [OK] Instalación completada
echo ========================================
echo.
echo Ahora puedes ejecutar la aplicación:
echo.
echo Opción 1: Abrir con servidor (desarrollo)
echo   abrir.bat
echo.
echo Opción 2: Generar HTML portable
echo   build-portable.bat
echo.
echo Opción 3: Compilar app de escritorio
echo   npm run tauri:build
echo.
echo ========================================
echo.

REM Preguntar si quiere abrir la aplicación ahora
echo ¿Deseas abrir la aplicación ahora? (s/n)
set /p ABRIR=
if /i "%ABRIR%"=="s" (
    echo.
    echo Abriendo aplicación...
    call abrir.bat
) else (
    echo.
    echo Para abrir manualmente, ejecuta:
    echo   abrir.bat
    echo.
)

pause
