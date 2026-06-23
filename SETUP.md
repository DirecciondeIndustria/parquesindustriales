# Guía de instalación – Plataforma de Inspecciones

Esta plataforma funciona de dos maneras:

- **Modo LOCAL** (sin configurar nada): ya funciona, pero las inspecciones se guardan **solo en ese celular/computadora**.
- **Modo ONLINE** (con Supabase): todas las inspecciones quedan en una **base de datos central** y se pueden consultar desde cualquier dispositivo.

---

## ¿Qué permite hacer la plataforma?

Es un sistema integral de gestión y control de inspecciones, optimizado para **celular, tablet y computadora**:

- **Cargar actas** con un asistente paso a paso (9 pasos): datos, predio, responsable, acceso, estado, actividad, servicios, fotos y firmas digitales.
- **Ciudad → parque automático**: al elegir la ciudad (Comodoro Rivadavia, Trelew, Trevelin o Puerto Madryn) aparecen solo los parques de esa ciudad.
- **Inspectores registrados**: cargá una vez los agentes en Configuración ⚙️ y después se autocompletan al escribir el nombre.
- **Conformidad / Declaración Jurada**: la empresa presta conformidad y el documento queda con carácter de declaración jurada, con aviso de **firma digital** al pie de cada hoja.
- **Firma cómoda en el celular**: se firma de a uno (inspector titular → inspector 2 → responsable) a pantalla completa; podés girar el teléfono para más comodidad. Las firmas quedan estampadas también en el margen de cada hoja del PDF.
- **Fotos en alta calidad** en el acta.
- **Autoguardado de borrador**: si cerrás la app a mitad de carga, al volver podés **continuar** donde quedaste (no se pierde nada).
- **Editar** y **eliminar** actas ya guardadas.
- **Usar un acta como base** para crear otra parecida más rápido.
- **Visor de fotos** (tocá una foto del acta para verla en grande).
- **Reportes y estadísticas** (pestaña *Reportes*): inspecciones por mes, por parque industrial, % en actividad, % con acceso, cobertura de servicios, y más. Con filtro por año.
- **Informe PDF** agregado y **exportación a Excel/CSV** del historial completo.
- **Copias de seguridad**: descargá un respaldo `.json` (con fotos y firmas) y restauralo en otro dispositivo. Está en el ícono de Configuración ⚙️.
- **PDF del acta** con formato oficial, listo para imprimir o firmar.
- **Máscaras y sugerencias**: CUIT y DNI se formatean solos; los agentes, parques y ciudades usados se sugieren al escribir.

> Mientras no se configure Supabase, todo esto funciona en **modo local**. Para no perder datos, hacé respaldos periódicos desde Configuración.

---

## Parte 1 – Crear la base de datos en Supabase (gratis)

1. Entrá a **https://supabase.com** y hacé clic en **Start your project**. Creá una cuenta (podés usar tu cuenta de Google/GitHub).
2. Una vez dentro, hacé clic en **New project**.
   - Elegí un nombre (ej: `inspecciones-industria`).
   - Poné una contraseña para la base de datos (guardala).
   - Región: elegí **South America (São Paulo)** que es la más cercana.
   - Clic en **Create new project** y esperá ~2 minutos.
3. Cuando el proyecto esté listo, en el menú lateral entrá a **SQL Editor** → **New query**, pegá TODO el bloque de abajo y hacé clic en **Run**:

```sql
-- Tabla de inspecciones
create table if not exists inspecciones (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  anio int not null,
  razon_social text,
  cuit text,
  parque text,
  ciudad text,
  fecha date,
  estado text default 'completada',
  datos jsonb,
  fotos jsonb,
  sig1 text,
  sig2 text,
  sig3 text,
  created_at timestamptz default now()
);

-- Índice para la autonumeración por año
create index if not exists idx_insp_anio on inspecciones (anio, numero);

-- Permitir lectura/escritura desde la app
alter table inspecciones enable row level security;
create policy "app_acceso" on inspecciones
  for all using (true) with check (true);
```

Deberías ver "Success. No rows returned". ✅

---

## Parte 2 – Conectar la app con tu base de datos

1. En Supabase, andá a **Project Settings** (el engranaje abajo a la izquierda) → **API**.
2. Copiá estos dos datos:
   - **Project URL** (ej: `https://abcdxyz.supabase.co`)
   - **anon public** (una clave larga que empieza con `eyJ...`)
3. Abrí el archivo **`index.html`** con el Bloc de notas y buscá (Ctrl+B / Ctrl+F) el texto **`SUPABASE_URL`**. Vas a encontrar este bloque; pegá tus valores entre las comillas:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...tu_clave_larga...",
  NUMERACION: "anio"
};
```

4. Guardá el archivo. Listo: al abrir la app, arriba a la derecha verás la etiqueta **"Online"** en verde.

---

## Parte 3 – Publicar la web para usarla desde el celular

Para que entre desde cualquier teléfono con un link, subí la carpeta a un hosting gratuito. La opción más simple:

### Opción A – Netlify (recomendada, sin cuenta técnica)
1. Entrá a **https://app.netlify.com/drop**
2. Arrastrá la carpeta **INDUSTRIA WEB** completa a esa página.
3. En segundos te da un link público (ej: `https://inspecciones-industria.netlify.app`). Ese link funciona en cualquier celular.

### Opción B – Vercel / GitHub Pages
También sirven; cualquier hosting de sitios estáticos funciona, porque la app es 100% HTML/JS.

> **Tip:** En el celular, abrí el link y usá "Agregar a pantalla de inicio" para tenerla como si fuera una app.

---

## Archivos del proyecto

> **IMPORTANTE:** La app es **un solo archivo: `index.html`**. Tiene todo adentro (lógica, logo y librerías), así que funciona con doble clic incluso **sin internet** y sin depender de OneDrive. Para usarla solo necesitás ese archivo.

| Archivo | Qué es |
|---|---|
| **`index.html`** | **La aplicación completa** (es el único que necesitás para usarla) |
| `SETUP.md` | Esta guía |
| `template.html`, `app.js`, `config.js`, `assets/`, `vendor/` | Archivos **fuente** para mantenimiento. No hace falta abrirlos. |
| `build.py` | Regenera `index.html` (autocontenido) y `dev.html` (para depurar) desde las fuentes. Ejecutá `python build.py` luego de editar las fuentes. |
| `dev.html` | Versión de desarrollo (carga los `.js` por separado). No usar para distribuir. |

---

## Preguntas frecuentes

**¿Pierdo los datos si no configuro Supabase?**
En modo local los datos viven en el navegador del dispositivo. Si borrás el historial del navegador, se pierden. Por eso conviene configurar Supabase.

**¿La numeración se comparte entre celulares?**
Solo en modo Online. Ahí el número siguiente se calcula mirando todas las actas de la base de datos (correlativo por año: 001/2026, 002/2026…).

**¿Las fotos se guardan?**
Sí, se comprimen y se guardan junto al acta (en la base de datos en modo online, o en el dispositivo en modo local) y aparecen en el PDF.
