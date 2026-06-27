-- ════════════════════════════════════════════════════════════════
--  SIGPIP / Inspecciones — Terrenos (polígonos de KMZ de Google Earth)
--  Guarda cada polígono de los KMZ que sube la Dirección. Cuando un
--  acta tiene coordenadas dentro de un polígono, el SIGPIP dibuja ese
--  terreno sobre la imagen satelital (en el acta y en el mapa general).
--  El cruce punto-en-polígono se hace en el navegador (sin PostGIS).
--  Aplicar en: Supabase → SQL Editor.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists actas_terrenos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text,                                  -- nombre del Placemark en el KMZ
  archivo     text,                                  -- nombre del KMZ de origen (para agrupar/borrar)
  geom        jsonb not null,                        -- GeoJSON Polygon { type, coordinates: [[[lng,lat],...]] }
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null default auth.uid()
);

create index if not exists idx_terrenos_archivo on actas_terrenos (archivo);

-- ─────────────── RLS ───────────────
alter table actas_terrenos enable row level security;

drop policy if exists terrenos_sel on actas_terrenos;
drop policy if exists terrenos_ins on actas_terrenos;
drop policy if exists terrenos_del on actas_terrenos;

-- Lectura: cualquier usuario autenticado del SIGPIP.
create policy terrenos_sel on actas_terrenos
  for select using (auth.uid() is not null);

-- Alta y baja: perfiles con permiso de edición (no inspectores).
create policy terrenos_ins on actas_terrenos
  for insert with check (puede_editar());
create policy terrenos_del on actas_terrenos
  for delete using (puede_editar());

-- ─────────────── Auditoría ───────────────
drop trigger if exists trg_aud_actas_terrenos on actas_terrenos;
create trigger trg_aud_actas_terrenos
  after insert or update or delete on actas_terrenos
  for each row execute function fn_auditoria();
