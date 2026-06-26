-- ════════════════════════════════════════════════════════════════
--  SIGPIP / App de inspecciones — Co-inspección con consentimiento
--  • Firma digital pre-registrada por inspector (usuarios.firma).
--  • Designación de un 2º agente que DEBE aceptar desde su propia
--    sesión (consentimiento). La aceptación y la copia de la firma
--    se hacen SOLO vía RPC security definer: el Agente 1 no puede
--    forjar la aceptación ni inyectar la firma del Agente 2.
--  Aplicar en: Supabase → SQL Editor.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ─────────────── 1) Firma del inspector ───────────────
alter table usuarios add column if not exists firma text;  -- PNG data URL

-- Guardar mi propia firma (solo la columna firma; NO permite tocar el rol).
create or replace function guardar_mi_firma(p_firma text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  update usuarios set firma = p_firma where id = auth.uid();
end $$;

-- Listar inspectores (id, nombre) para elegir 2º agente, sin exponer firma
-- ni demás datos. Solo inspectores autenticados; excluye al propio usuario.
create or replace function listar_inspectores()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select u.id, u.nombre
  from usuarios u
  where u.rol = 'inspector' and u.activo and u.id <> auth.uid()
  order by u.nombre;
$$;

-- ─────────────── 2) Tabla de designaciones ───────────────
create table if not exists actas_designaciones (
  id                uuid primary key default gen_random_uuid(),
  draft_id          text not null,                       -- borrador del Agente 1 (correlación)
  inspector1_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  inspector1_nombre text,
  inspector2_id     uuid not null references auth.users (id) on delete cascade,
  inspector2_nombre text,
  inspector2_firma  text,                                -- la setea SOLO el RPC al aceptar
  estado            text not null default 'pendiente',   -- pendiente|aceptada|rechazada|cancelada
  created_at        timestamptz not null default now(),
  responded_at      timestamptz
);

create index if not exists idx_desig_inv  on actas_designaciones (inspector2_id, estado);
create index if not exists idx_desig_own  on actas_designaciones (inspector1_id, estado);
create index if not exists idx_desig_draft on actas_designaciones (draft_id);

-- ─────────────── 3) RLS ───────────────
alter table actas_designaciones enable row level security;

drop policy if exists desig_sel on actas_designaciones;
drop policy if exists desig_ins on actas_designaciones;
-- (No hay policy de update/delete para clientes: todo pasa por RPC.)

-- Lectura: solo las dos partes (necesario también para Realtime).
create policy desig_sel on actas_designaciones
  for select using (inspector1_id = auth.uid() or inspector2_id = auth.uid());

-- Alta: solo el propio Agente 1, que debe ser inspector.
create policy desig_ins on actas_designaciones
  for insert with check (inspector1_id = auth.uid() and current_rol() = 'inspector');

-- ─────────────── 4) RPC de estado (security definer) ───────────────

-- Agente 1 crea la designación hacia un inspector. Resuelve nombres server-side.
create or replace function crear_designacion(p_draft_id text, p_inspector2 uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rol2 rol_usuario; v_nom1 text; v_nom2 text;
begin
  if current_rol() <> 'inspector' then raise exception 'SOLO_INSPECTORES'; end if;
  if p_inspector2 = auth.uid() then raise exception 'NO_TE_PODES_AGREGAR'; end if;
  select rol, nombre into v_rol2, v_nom2 from usuarios where id = p_inspector2;
  if v_rol2 is null then raise exception 'INSPECTOR_INEXISTENTE'; end if;
  if v_rol2 <> 'inspector' then raise exception 'EL_AGENTE2_NO_ES_INSPECTOR'; end if;
  select nombre into v_nom1 from usuarios where id = auth.uid();
  insert into actas_designaciones (draft_id, inspector1_id, inspector1_nombre, inspector2_id, inspector2_nombre)
  values (p_draft_id, auth.uid(), v_nom1, p_inspector2, v_nom2)
  returning id into v_id;
  return v_id;
end $$;

-- Agente 2 ACEPTA: valida que sea él, y copia SU firma desde usuarios.firma.
create or replace function aceptar_designacion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_firma text;
begin
  select firma into v_firma from usuarios where id = auth.uid();
  if v_firma is null or v_firma = '' then raise exception 'FIRMA_NO_REGISTRADA'; end if;
  update actas_designaciones
     set estado = 'aceptada', responded_at = now(), inspector2_firma = v_firma
   where id = p_id and inspector2_id = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

-- Agente 2 RECHAZA.
create or replace function rechazar_designacion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update actas_designaciones
     set estado = 'rechazada', responded_at = now()
   where id = p_id and inspector2_id = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

-- Agente 1 CANCELA su propia solicitud.
create or replace function cancelar_designacion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update actas_designaciones
     set estado = 'cancelada', responded_at = now()
   where id = p_id and inspector1_id = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

-- Permisos de ejecución para usuarios autenticados.
grant execute on function guardar_mi_firma(text)            to authenticated;
grant execute on function listar_inspectores()              to authenticated;
grant execute on function crear_designacion(text, uuid)     to authenticated;
grant execute on function aceptar_designacion(uuid)         to authenticated;
grant execute on function rechazar_designacion(uuid)        to authenticated;
grant execute on function cancelar_designacion(uuid)        to authenticated;

-- ─────────────── 5) Auditoría ───────────────
drop trigger if exists trg_aud_actas_designaciones on actas_designaciones;
create trigger trg_aud_actas_designaciones
  after insert or update or delete on actas_designaciones
  for each row execute function fn_auditoria();

-- ─────────────── 6) Realtime ───────────────
-- Habilita la tabla en la publicación de Realtime (si no estaba ya).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'actas_designaciones'
  ) then
    alter publication supabase_realtime add table actas_designaciones;
  end if;
end $$;
