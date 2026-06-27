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
- **Espejo idéntico para el Agente 2**: ve el mismo wizard (mismos campos/pantallas) que carga el Agente 1, en vivo; puede navegar a pasos anteriores ("Seguir al inspector" para volver a sincronizar) y seguir sumando fotos. Reemplaza la "tablita" resumen anterior.
- **Doble confirmación para emitir el acta**: al tocar "Finalizar", el Agente 1 queda esperando; el Agente 2 autoriza ("Firmar acta") desde su celular y recién ahí se registra. (Sin Agente 2, se guarda directo como antes.) Requiere migración `0030`.
- **Ubicación geográfica del acta**: al confirmar/registrar el acta, el celular toma el GPS (lat/lng/precisión) y lo guarda. En el SIGPIP (Inspecciones → Ver acta) se muestra "Ubicación de la firma": coordenadas + **imagen satelital a ~200 m** (Esri World Imagery) con pin + enlaces a Google Maps. También en el **PDF** (SIGPIP y celular). Requiere migración `0031`.
- **Terrenos (KMZ)**: en Inspecciones, los perfiles con edición pueden subir **KMZ de Google Earth** (varios, con varios polígonos). Si un acta cae dentro de un polígono, se dibuja ese **terreno** sobre la imagen satelital (en el acta y como capa en el **mapa general**). El cruce punto-en-polígono es en el navegador (sin PostGIS). Requiere migración `0032`.
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
6. `supabase/migrations/0030_cierre_doble_confirmacion.sql` (doble confirmación: el Agente 2 autoriza la emisión del acta)
7. `supabase/migrations/0031_actas_ubicacion.sql` (columnas lat/lng/precisión/momento para la ubicación de la firma)
8. `supabase/migrations/0032_actas_terrenos.sql` (tabla de terrenos/polígonos de KMZ para vincular actas)

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
