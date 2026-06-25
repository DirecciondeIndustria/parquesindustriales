-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Actas de inspección (app mobile de inspectores)
--  Tabla informativa: guarda la COPIA COMPLETA del acta que genera la
--  app de inspecciones del celular (datos, fotos, firmas). El SIGPIP de
--  escritorio la muestra de forma informativa (no se enlaza a expedientes).
--  Convive con la tabla `inspecciones` (gestión/seguimiento), que no se toca.
--  Aplicar en: Supabase → SQL Editor.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists actas_inspeccion (
  id               uuid primary key default gen_random_uuid(),
  -- Identificación del acta (numeración correlativa por año, la maneja la app)
  numero           int,
  anio             int,
  -- Datos resumen (para listar/buscar sin abrir el jsonb)
  razon_social     text,
  cuit             text,
  parque           text,
  ciudad           text,
  fecha            date,
  estado           text not null default 'completada',
  -- Payload completo del acta tal como lo arma la app (todos los campos del formulario)
  datos            jsonb,
  -- Fotos (data URLs comprimidas) y firmas (PNG data URL)
  fotos            jsonb,
  sig1             text,
  sig2             text,
  sig3             text,
  -- Trazabilidad: qué inspector la cargó
  inspector_id     uuid references auth.users (id) on delete set null default auth.uid(),
  inspector_nombre text,
  created_at       timestamptz not null default now()
);

-- Índices para el listado del SIGPIP
create index if not exists idx_actas_anio_num on actas_inspeccion (anio, numero);
create index if not exists idx_actas_cuit     on actas_inspeccion (cuit);
create index if not exists idx_actas_created  on actas_inspeccion (created_at desc);

-- ─────────────── RLS ───────────────
alter table actas_inspeccion enable row level security;

drop policy if exists actas_sel on actas_inspeccion;
drop policy if exists actas_ins on actas_inspeccion;
drop policy if exists actas_upd on actas_inspeccion;
drop policy if exists actas_del on actas_inspeccion;

-- Lectura: cualquier usuario autenticado del SIGPIP (vista informativa).
create policy actas_sel on actas_inspeccion
  for select using (auth.uid() is not null);

-- Alta: inspectores (cargando como ellos mismos) o perfiles con edición.
create policy actas_ins on actas_inspeccion
  for insert with check (
    (current_rol() = 'inspector' and inspector_id = auth.uid())
    or puede_editar()
  );

-- Modificación / baja: solo administración (las actas son registros).
create policy actas_upd on actas_inspeccion
  for update using (es_admin());
create policy actas_del on actas_inspeccion
  for delete using (es_admin());

-- ─────────────── Auditoría ───────────────
drop trigger if exists trg_aud_actas_inspeccion on actas_inspeccion;
create trigger trg_aud_actas_inspeccion
  after insert or update or delete on actas_inspeccion
  for each row execute function fn_auditoria();
