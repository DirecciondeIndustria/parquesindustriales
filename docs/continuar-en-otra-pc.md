# Continuar el trabajo (y este chat) en otra PC

## 1. El código (lo importante) — ya está
Está en GitHub y en OneDrive. En la otra PC, una de estas:
- **OneDrive** con la misma cuenta: la carpeta `INDUSTRIA WEB` se sincroniza sola.
- **Git:** `git clone https://github.com/DirecciondeIndustria/parquesindustriales.git`
  (o, si ya la tenés, `git pull` para traer lo último).

## 2. Correr la web localmente en la otra PC
1. Instalar **Node.js** y **Git**.
2. En la carpeta `web/`: `npm install`.
3. Crear `web/.env` (NO está en Git por ser secreto) con:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
   (copialo del `web/.env` de esta PC).
4. `npm run dev` para desarrollo, `npm run build` para compilar.

## 3. Seguir ESTE chat de Claude Code en la otra PC
La conversación y la memoria de Claude se guardan en tu perfil, **fuera** de OneDrive/Git.
Para llevarlas, dejé una copia sincronizable en la carpeta del proyecto:

```
INDUSTRIA WEB/_traspaso-claude/.claude/
```

En la otra PC (con OneDrive ya sincronizado), copiá el contenido de esa carpeta sobre tu perfil:
- `_traspaso-claude/.claude/projects/...`  →  `C:\Users\<TU_USUARIO>\.claude\projects\...`
- `_traspaso-claude/.claude/plans/...`     →  `C:\Users\<TU_USUARIO>\.claude\plans\...`

Después, abrí una terminal en la carpeta del proyecto y corré:
```
claude --resume
```
y elegí la sesión para retomar con todo el historial.

> Nota: funciona mejor si el **usuario de Windows y la ruta** son iguales en ambas PCs
> (el nombre de la carpeta en `projects/` depende de la ruta del proyecto).
> Alternativa más simple: usar la **app de escritorio/web de Claude** con la misma cuenta;
> ahí las conversaciones suelen sincronizar solas.

## 4. Si OneDrive no sincroniza un archivo
Si subís algo (un PDF, etc.) y no aparece en la otra PC:
- Verificá el ícono de **OneDrive** en la barra de tareas: que diga "Actualizado" (no "Pausado" ni con error).
- Las dos PCs tienen que estar **encendidas y online** con OneDrive corriendo.
- Asegurate de que el archivo esté **dentro** de la carpeta de OneDrive (no en otra ruta).
- Para algo importante y seguro entre PCs, mejor **subilo a Git** (`git add`, `commit`, `push`) — es el canal confiable.
