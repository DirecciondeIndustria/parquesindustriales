# Estado del proyecto y pendientes — SIGPIP

> Resumen para retomar el trabajo desde cualquier PC / chat nuevo.
> Si abrís un chat nuevo de Claude: pedile *"leé los archivos en docs/ para tomar contexto"*.

## Qué es
- **SIGPIP** (web React + Vite + Supabase): gestión de Parques Industriales. Deploy en **Vercel** (`sigpip.vercel.app`), automático con cada `git push` a `main`.
- **App de actas de inspección** (HTML, en `web/public/actas-inspeccion/`): la usan los inspectores desde el celular. Fuente espejo: `deploy-inspecciones/` (gitignored).
- **Repo:** https://github.com/DirecciondeIndustria/parquesindustriales

## URLs
- SIGPIP (gestión): `https://sigpip.vercel.app/`
- Portal de Empresas: `https://sigpip.vercel.app/portal-empresas`
- App de inspecciones: `https://sigpip.vercel.app/actas-inspeccion`
- Restablecer contraseña: `https://sigpip.vercel.app/restablecer`

## Funciones agregadas recientemente (ya en el código)
- Co-inspección: 2º agente con **consentimiento**, **firmas pre-registradas**, panel de pendientes + realtime + alerta sonora.
- **Fotos compartidas en vivo** entre los 2 inspectores; vista en vivo del acta para el Agente 2 + botón flotante de fotos.
- Descartar acta en curso cierra la co-inspección (no guarda).
- **Modelo de roles**: principal + secundario (Inspector) + delegación de Mesa de Entrada con consentimiento. Permisos por rol principal; borrado solo admin; un solo Mesa de Entrada.
- **Recuperar contraseña por email** (autogestión) + reset por admin.
- Login unificado (SIGPIP / Portal Empresas / Inspectores), favicon, branding.

## ⚠️ PENDIENTES a aplicar en Supabase (SQL Editor) — verificar que estén corridas
Correr en orden si todavía no se aplicaron:
1. `supabase/migrations/0025_coinspeccion.sql` (designaciones + firma + RPC + realtime)
2. `supabase/migrations/0026_roles_enum.sql` (valores de enum — **correr solo, primero**)
3. `supabase/migrations/0027_roles_modelo.sql` (modelo de roles, helpers, delegación)
4. `supabase/migrations/0028_fotos_compartidas.sql` (fotos en vivo)
5. `supabase/migrations/0029_cancelar_coinspeccion.sql` (cerrar co-inspección)

## ⚠️ Otros pendientes de configuración (no son código)
- **SMTP para emails de recuperación**: el correo propio de Supabase tiene límite bajo. Conectar un SMTP gratuito (Resend / Brevo / SendGrid) en *Supabase → Project Settings → Auth → SMTP*. (No hay servidor del ministerio.)
- **Redirect URL**: en *Supabase → Authentication → URL Configuration* deben estar `https://sigpip.vercel.app/restablecer` y `https://sigpip.vercel.app/**`.
- **Largo mínimo de contraseña**: 6 (ajustado en *Authentication*).
- **Usuarios**: el admin asigna roles desde *Usuarios*; cada inspector registra su **firma** en la app de actas.

## Ideas a futuro (no empezadas)
- Integrar las **fuentes de catastro** (relevamiento drones) — ver `docs/fuentes-catastro.md`: capas de mapa desde SHP, fichas como metadatos por parque, links de descarga por parque.

## Cómo trabajar entre 2 PCs
- Proyecto fuera de OneDrive, en `C:\dev\parquesindustriales`.
- Al empezar: doble clic en `actualizar.bat` (git pull).
- Al terminar: doble clic en `guardar.bat` (git add/commit/pull/push).
- Correr la web: `cd web` → `npm install` (1ra vez) → `npm run dev`. Necesita `web/.env` (no está en Git).
