# SIGPIP — Plan de Arquitectura

**Sistema Integral de Gestión de Parques Industriales Provinciales**
Dirección de Industria · Subsecretaría de Industria y Comercio · Ministerio de Producción · Provincia del Chubut

Versión del plan: 1.0 — 2026-06-22
Stack elegido: **Supabase + frontend web**

---

## 1. Resumen ejecutivo

El SIGPIP es un **sistema de gestión multiusuario**, no una app de carga aislada. La app de actas de inspección que ya existe (`index.html` autocontenido) cubre el **Módulo 7** y se integra como una pieza del sistema mayor, reutilizando su tabla `inspecciones` de Supabase.

A diferencia del prototipo actual (datos en `localStorage` / un solo archivo), el SIGPIP exige:

- **Base de datos central** compartida por todos los usuarios (no el navegador de cada uno).
- **Autenticación real + roles + permisos** (Módulo 15) con seguridad a nivel de fila.
- **Auditoría** de cada acción (Módulo 14).
- **Procesos en segundo plano** para alertas (Módulo 11) y asistente IA (Módulo 12), que corren aunque nadie tenga la web abierta.
- **Almacenamiento de archivos** con OCR y búsqueda (Módulo 6).

Todo esto encaja en la plataforma de **Supabase** (Postgres + Auth + Storage + Edge Functions + Cron + Realtime), que el usuario ya conoce del proyecto actual.

---

## 2. Arquitectura técnica

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (web SPA)                                          │
│  Vite + React + TypeScript + Tailwind + shadcn/ui           │
│  TanStack Query (datos) · React Router (navegación)         │
│  supabase-js (Auth, datos, Storage, Realtime)               │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────────────────────────────┐
│  SUPABASE                                                     │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Postgres    │ │ Auth     │ │ Storage  │ │ Edge        │ │
│  │ + RLS       │ │ (roles)  │ │ (buckets)│ │ Functions   │ │
│  │ + triggers  │ │          │ │          │ │ (Deno/TS)   │ │
│  │ + pg_cron   │ │          │ │          │ │             │ │
│  └─────────────┘ └──────────┘ └──────────┘ └──────┬──────┘ │
└────────────────────────────────────────────────────┼────────┘
                                                       │
                              ┌────────────────────────┼──────────┐
                              ▼                         ▼          ▼
                       Claude API              OCR (Tesseract /   Email/
                       (Asistente +            servicio cloud)    notificaciones
                        generador de actos)
```

### Por qué este frontend
- **React + TypeScript**: para 15 módulos hace falta un router, componentes reutilizables y tipado. El enfoque "un solo `index.html`" no escala a este tamaño.
- **shadcn/ui + Tailwind**: componentes accesibles y un diseño profesional rápido (tablas, formularios, modales, dashboards).
- **TanStack Query**: caché, sincronización y estados de carga sin reinventarlos.
- **supabase-js**: mismo cliente que ya usa la app de inspecciones.

> El sitio se despliega como estático (Vercel / Netlify / o el hosting del Gobierno). Toda la lógica sensible vive en Postgres (RLS) y Edge Functions, nunca en el navegador.

### Componentes de Supabase por responsabilidad
| Necesidad del brief | Pieza de Supabase |
|---|---|
| Datos compartidos (Mód. 1–9) | Postgres |
| Roles y permisos (Mód. 15) | Auth + tabla `roles` + **RLS** |
| Auditoría (Mód. 14) | **Triggers** de Postgres → tabla `auditoria` |
| Documentos, fotos, PDF (Mód. 6) | Storage (buckets privados) |
| OCR (Mód. 6) | Edge Function → Tesseract / servicio cloud, guarda texto en `documentos.texto_ocr` (índice full-text) |
| Alertas automáticas (Mód. 11) | **pg_cron** + Edge Function que escanea vencimientos |
| Tablero en vivo (Mód. 10) | Vistas / vistas materializadas + Realtime |
| Asistente IA + generador de actos (Mód. 12, 13) | Edge Function → **Claude API** (modelos `claude-opus-4-8` / `claude-sonnet-4-6`) |
| Notificaciones | Edge Function → email (Resend/SMTP) + Realtime in-app |

---

## 3. Modelo de datos (núcleo)

Tablas principales y sus relaciones. Cada FK lleva RLS según rol.

```
parques_industriales
  └─< parcelas >─ empresas (ocupante actual)
                    │
expedientes >───────┘   (FK empresa, parcela, tipo_tramite)
  ├─< expediente_etapas      (timeline + responsable + estado + plazos)  ← Mód. 4 y 5
  ├─< documentos             (Storage path + texto_ocr)                  ← Mód. 6
  ├─< inspecciones           (YA EXISTE — se enlaza por expediente_id)   ← Mód. 7
  ├─< alertas                                                            ← Mód. 11
  └─< actos_administrativos  (generados desde plantillas)                ← Mód. 13

usuarios (profiles) ─ roles                                              ← Mód. 15
auditoria  (quién / cuándo / qué)                                        ← Mód. 14
tipos_tramite ─< etapas_definicion  (plantilla de flujo por tipo)        ← Mód. 5
plantillas_acto                                                          ← Mód. 13
archivo_fisico  (estantería / caja / archivo, FK expediente)            ← Mód. 9
```

### Tablas y campos clave

- **parques_industriales** — `id, nombre, localidad, superficie, estado, geo (polígono opcional)`. Conteos (parcelas, empresas, escrituradas...) se calculan por vista, no se duplican.
- **parcelas** — `id, parque_id, identificacion (ejido/circ/sector/manzana/parcela), superficie, estado, empresa_id, fecha_adjudicacion, escriturada (bool), hipoteca_vigente`. El **color del mapa** (Mód. 1) se deriva del estado: verde/amarillo/rojo/gris/azul.
- **empresas** — `id, razon_social, cuit, domicilio, telefono, email, representantes (jsonb), actividad, estado, fecha_radicacion`. (Reutiliza los campos que ya guarda el acta: `razon_social`, `cuit`.)
- **expedientes** — `id, numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, responsable_id, fecha_inicio, plazo_vencimiento, observaciones`. Es el **núcleo** (Mód. 4).
- **tipos_tramite** + **etapas_definicion** — definen los flujos del Mód. 5 (adjudicación, transferencia, hipoteca, comodato, baja, etc.) de forma **configurable**, sin hardcodear pasos.
- **expediente_etapas** — instancias de cada paso: `expediente_id, etapa, estado, responsable_id, fecha_entrada, fecha_salida, dias_en_etapa`. Alimenta el **timeline** (Mód. 4) y el **semáforo**.
- **documentos** — `id, expediente_id?/empresa_id?/parcela_id?, tipo_documental, storage_path, texto_ocr (tsvector), version, subido_por, fecha`.
- **inspecciones** — **ya existe**; se añade `expediente_id`, `parcela_id`, `empresa_id` para enlazarla al resto.
- **alertas** — `id, tipo, severidad, mensaje, expediente_id?, empresa_id?, destinatario_rol, leida, fecha`.
- **auditoria** — `id, usuario_id, accion, tabla, registro_id, datos_antes (jsonb), datos_despues (jsonb), fecha`.
- **usuarios/roles** — perfiles ligados a `auth.users`; rol determina permisos vía RLS.
- **actos_administrativos** + **plantillas_acto** — Mód. 13.
- **archivo_fisico** — Mód. 9.

### Estado y semáforo (la "funcionalidad diferencial")
Cada expediente expone, vía vista calculada, lo que pide el brief como Centro de Control:
- **Semáforo** (verde / amarillo / rojo) según plazo y días sin movimiento.
- **Tiempo transcurrido** en la etapa actual.
- **Responsable actual**.
- **Documentación faltante** (qué `tipo_documental` exige la etapa y aún no está en `documentos`).
- **Próxima acción recomendada** (de `etapas_definicion`).

---

## 4. Roles y permisos (Módulo 15)

Implementado con **RLS de Postgres** (la seguridad no depende del frontend):

| Rol | Permiso |
|---|---|
| Administrador | Control total |
| Director de Industria | Control total |
| Dirección General | Consulta + aprobación |
| Depto. Parques Industriales | Gestión de expedientes |
| Depto. Archivo | Gestión documental / archivo físico |
| Inspector | Carga de inspecciones (ya cubierto por la app actual) |
| Consulta | Solo lectura |

---

## 5. Roadmap por fases

> Cada fase entrega algo usable y demostrable a la Dirección.

### Fase 0 — Fundaciones (infraestructura)
- Proyecto Supabase, esquema base, **Auth + roles + RLS** mínimas.
- **Auditoría** por triggers desde el día 1.
- Shell de la app (login, navegación lateral por módulos, layout responsive).
- Pipeline de despliegue.

### Fase 1 — Maestros (Módulos 1, 2, 3)
- ABM de **Parques, Empresas, Parcelas**.
- **Mapa del parque** con parcelas coloreadas por estado.
- Ficha catastral de parcela; ficha única de empresa.

### Fase 2 — Núcleo de expedientes (Módulos 4, 5)
- Expediente electrónico con **timeline**, semáforo, responsable, plazos.
- Motor de **flujos configurables** por tipo de trámite.

### Fase 3 — Documentos e integración operativa (Módulos 6, 7, 8, 9)
- Repositorio documental + Storage + **OCR** + búsqueda.
- **Integrar la app de inspecciones existente** (Mód. 7) al expediente.
- Control de **escrituraciones** (Mód. 8) con % automático.
- **Archivo físico** (Mód. 9).

### Fase 4 — Inteligencia operativa (Módulos 10, 11, 14)
- **Tablero ejecutivo** con KPIs y gráficos (reutiliza el módulo de reportes que ya hiciste en la app de actas).
- **Motor de alertas** (pg_cron) + notificaciones.
- Vista de **auditoría/trazabilidad**.

### Fase 5 — IA (Módulos 12, 13)
- **Asistente administrativo** (Claude API): detecta demoras, resume expedientes, sugiere próximos pasos.
- **Generador de actos administrativos** desde plantillas con datos del expediente.

---

## 6. Decisiones tomadas y pendientes

### Definidas (2026-06-23)
- **Hosting del frontend**: **Netlify** (sitio estático).
- **Datos iniciales**: **no hay padrón previo**; los maestros (parques, empresas, parcelas) se cargan desde cero dentro del sistema. → No hace falta etapa de importación; sí conviene un ABM cómodo y carga masiva opcional por CSV más adelante.
- **Supabase**: arrancamos en **plan gratuito**.

### Implicancias del plan gratuito (a tener presentes)
El plan Free de Supabase impone límites que condicionan el diseño:
- **Storage 1 GB** y **base 500 MB**: es el cuello de botella real. Un repositorio documental con PDFs escaneados y fotos lo consume rápido. → Mitigación: comprimir imágenes (ya se hace en la app de actas, 1800px/0.85), limitar tamaño de subida, y prever el salto a Pro cuando el volumen crezca.
- **Pausa por inactividad**: el proyecto Free se suspende tras ~1 semana sin uso. Para un sistema en producción real eventualmente habrá que ir a Pro.
- **OCR**: en Free conviene empezar **sin OCR automático** (o Tesseract en una Edge Function on-demand) y dejar el OCR cloud para cuando haya presupuesto.
- **pg_cron / Edge Functions**: disponibles en Free con cuota suficiente para empezar las alertas.

### Pendientes (no bloquean Fase 0)
1. **OCR**: Tesseract autoalojado vs. servicio cloud (definir en Fase 3).
2. **Email de notificaciones**: servicio (Resend/SendGrid) vs. SMTP institucional (definir en Fase 4).
3. **Salto a plan Pro**: cuándo, según consumo de Storage.

---

## 7. Cómo se reaprovecha lo ya construido

- La **tabla `inspecciones`** y toda la lógica de actas/PDF/firmas de `app.js` se mantienen; solo se enlazan al expediente.
- El **módulo de reportes/KPIs** que ya existe es la base del Tablero Ejecutivo (Mód. 10).
- La experiencia de **Supabase + config** del proyecto actual acelera la Fase 0.
- El acta oficial (Decreto 1239/06) y el diseño visual existente sirven como referencia de identidad para el resto de la UI.
