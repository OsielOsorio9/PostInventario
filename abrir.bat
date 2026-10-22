@echo off
REM ========================================
REM   FerreteríaPRO - Abrir Aplicación
REM ========================================
REM Este script inicia el servidor de desarrollo
REM y abre la aplicación en el navegador
REM ========================================

echo.
echo ========================================
echo   FerreteríaPRO - Iniciando...
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

echo [OK] Node.js encontrado:
node --version
echo.

REM Verificar que las dependencias estén instaladas
if not exist "node_modules" (
    echo [!] Instalando dependencias...
    call npm install
    echo.
)

echo [OK] Dependencias instaladas
echo.
echo Iniciando servidor de desarrollo...
echo La aplicación estará disponible en: http://localhost:3000
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

REM Iniciar el servidor en segundo plano
start "FerreteríaPRO Server" cmd /k "npm run dev"

REM Esperar a que el servidor inicie
echo Esperando a que el servidor esté listo...
timeout /t 5 /nobreak >nul

REM Abrir el navegador
echo Abriendo navegador...
start http://localhost:3000

echo.
echo ========================================
echo [OK] Servidor iniciado correctamente
echo ========================================
echo.
echo La aplicación está corriendo en:
echo http://localhost:3000
echo.
echo Para detener el servidor:
echo Cierra la ventana "FerreteríaPRO Server"
echo o presiona Ctrl+C en esa ventana
echo.
echo ========================================
echo.

REM Mantener esta ventana abierta para ver logs
pause
