# 📘 Instructivo: usar el mismo proyecto en 2 (o más) PCs con Git + .bat

Guía genérica y reutilizable. Sirve para **cualquier proyecto**: solo reemplazá el nombre
del repositorio y la carpeta. Pensada para alguien que **no es experto**.

---

## Idea general
El proyecto vive en **GitHub** (la "nube"). Cada PC tiene una copia local. Para trabajar:

- **`actualizar.bat`** → trae lo último de la nube (antes de empezar).
- **`guardar.bat`** → sube tus cambios a la nube (al terminar).

Así las dos PCs quedan siempre sincronizadas, sin pendrives ni OneDrive.

---

## Requisitos (instalar una sola vez en cada PC)
1. **Git** → https://git-scm.com/download/win
2. **Node.js** (solo si el proyecto lo usa) → https://nodejs.org
3. Una **cuenta de GitHub** y un **repositorio** creado para el proyecto.

> Recomendación: poné el proyecto **fuera de OneDrive/Descargas**, por ejemplo en
> `C:\dev\NOMBRE-PROYECTO`.

---

## PARTE A — Preparar el proyecto (se hace UNA vez, en la PC original)

> Si el proyecto **ya está en GitHub**, saltá a la Parte B.

1. Abrir una terminal **dentro de la carpeta del proyecto**.
2. Inicializar y subir a GitHub:
   ```
   git init
   git add -A
   git commit -m "Primera version"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git push -u origin main
   ```
3. Crear un archivo **`.gitignore`** para que NO se suban cosas pesadas o secretas:
   ```
   node_modules/
   dist/
   *.log
   .env
   .env.local
   ```
4. Copiar los dos archivos `.bat` (más abajo) a la carpeta del proyecto.

---

## PARTE B — Configurar la segunda PC (se hace UNA vez)

1. Elegir/crear la carpeta, por ejemplo `C:\dev`.
2. Abrir una terminal ahí y **clonar** el proyecto (descarga todo):
   ```
   git clone https://github.com/TU-USUARIO/TU-REPO.git
   ```
   Esto crea la carpeta `TU-REPO` con todo adentro.
3. La **primera vez** que hagas `guardar.bat`, Git va a pedir login de GitHub → se abre
   el navegador, iniciás sesión y listo (queda guardado para siempre).
4. **Archivos secretos (`.env`):** como NO viajan por Git, hay que crearlos a mano.
   Copiá el `.env` de la PC original (por mensaje privado / pendrive) y pegalo en la
   misma ruta (ej. dentro de la carpeta del proyecto o de `web/`).
5. Si el proyecto usa Node, instalá las dependencias una vez:
   ```
   npm install
   ```

---

## PARTE C — Uso diario (en CUALQUIER PC)

1. **Antes de empezar a trabajar:** doble clic en **`actualizar.bat`**.
2. Trabajás normalmente.
3. **Al terminar:** doble clic en **`guardar.bat`** → te pide una nota corta de qué
   cambiaste, y sube todo.

> 🔑 **Regla de oro:** siempre `actualizar` al empezar y `guardar` al terminar. Así
> nunca se pisan los cambios entre las dos PCs.

---

## 📄 Los dos archivos .bat (copiar tal cual)

**`actualizar.bat`**
```bat
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
```

**`guardar.bat`**
```bat
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
```

> Estos `.bat` funcionan **estén donde estén dentro de la carpeta del proyecto** — la
> línea `cd /d "%~dp0"` hace que se ubiquen solos. No hay que editar nada adentro.

---

## ⚠️ Problemas comunes

| Síntoma | Solución |
|---|---|
| Pide usuario/contraseña al subir | Es el login de GitHub la 1ª vez. Iniciá sesión en el navegador cuando se abra. |
| `guardar.bat` dice "conflicto" / "merge" | Trabajaron en las 2 PCs a la vez sin actualizar. Resolver con alguien que sepa Git. |
| El proyecto no arranca en la 2ª PC | Falta el `.env` (Parte B, paso 4) o falta `npm install`. |
| "fatal: not a git repository" | El `.bat` no está dentro de la carpeta del proyecto clonado. |
