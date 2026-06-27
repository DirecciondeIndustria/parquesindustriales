@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   GUARDAR  -  Sube tus cambios a la nube (push)
echo ================================================
echo.
set "msg="
set /p "msg=Que cambiaste? (escribi una nota corta y Enter): "
if "%msg%"=="" set "msg=Cambios"
echo.
echo --- Marcando cambios ---
git add -A
echo --- Guardando punto ---
git commit -m "%msg%"
echo --- Trayendo lo ultimo de la nube ---
git pull --no-edit
echo --- Subiendo a la nube ---
git push
echo.
echo Listo! Tus cambios estan en la nube y en la otra PC (despues de actualizar).
pause
