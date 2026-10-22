@echo off
REM ========================================
REM   FerreteríaPRO - Build Portable
REM ========================================
REM Genera un único archivo HTML que se puede
REM abrir directamente con doble clic
REM ========================================

echo.
echo ========================================
echo   FerreteríaPRO - Build Portable
echo ========================================
echo.

REM Cambiar a la carpeta del proyecto
cd /d "%~dp0"

REM Verificar que Node.js esté instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js no está instalado
    echo.
    echo Descarga Node.js desde:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

REM Verificar que las dependencias estén instaladas
if not exist "node_modules" (
    echo [!] Instalando dependencias...
    call npm install
    echo.
)

echo Generando archivo HTML portable...
echo Esto puede tardar unos segundos...
echo.

REM Ejecutar el build con vite-plugin-singlefile
call npm run build:portable

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [OK] Build completado exitosamente
    echo ========================================
    echo.
    echo Archivo generado:
    echo    dist\index.html
    echo.
    echo Este archivo contiene TODA la aplicación
    echo (HTML, CSS y JavaScript en un solo archivo)
    echo.
    echo Puedes:
    echo - Abrirlo con doble clic
    echo - Copiarlo a un USB
    echo - Compartirlo por email
    echo.
    echo ========================================
) else (
    echo.
    echo [X] Error durante el build
    echo.
)

pause
