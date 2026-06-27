@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   ACTUALIZAR  -  Trae lo ultimo de la nube (pull)
echo ================================================
echo.
git pull
echo.
echo Listo. Ya tenes la ultima version. Podes cerrar esta ventana.
pause
