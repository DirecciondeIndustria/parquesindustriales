-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Modelo de roles principal + secundario + delegación (paso 2)
--  Correr DESPUÉS de 0026_roles_enum.sql.  Re-ejecutable.
--
--  Principales: administrador, director, jefe_departamento, mesa_entrada,
--               tecnico_administrativo, inspector.
--  Secundario (opcional): solo 'inspector' (la Mesa secundaria surge solo
--               de una delegación con consentimiento).
--  Permisos según el rol principal. Borrado: solo administrador.
--  Único Mesa de Entrada principal a la vez (salvo delegación).
-- ════════════════════════════════════════════════════════════════

-- ─────────────── 1) Columna de rol secundario ───────────────
alter table usuarios add column if not exists rol_secundario rol_usuario;
alter table usuarios drop constraint if exists usuarios_rol_secundario_chk;
alter table usuarios add constraint usuarios_rol_secundario_chk
  check (rol_secundario is null or rol_secundario = 'inspector');

-- ─────────────── 2) Remap de usuarios existentes (one-time, seguro) ───────────────
-- 'archivo' → el más antiguo queda como Mesa de Entrada (único); el resto Técnico Admin.
update usuarios u set rol = 'tecnico_administrativo'
 where u.rol = 'archivo'
   and u.id <> (select id from usuarios where rol = 'archivo' order by created_at asc limit 1);
update usuarios set rol = 'mesa_entrada' where rol = 'archivo';
-- Resto de roles viejos no contemplados.
update usuarios set rol = 'director'              where rol = 'direccion_general';
update usuarios set rol = 'tecnico_administrativo' where rol = 'parques';
update usuarios set rol = 'inspector'            where rol = 'consulta';
-- (administrador, director, inspector se conservan.)

-- ─────────────── 3) Único Mesa de Entrada principal ───────────────
create unique index if not exists ux_mesa_principal
  on usuarios (rol) where rol = 'mesa_entrada';

-- ─────────────── 4) Helpers de permisos (reconfiguran el RLS existente) ───────────────
-- Borrar y gestión total: solo administrador.
create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select current_rol() = 'administrador'
$$;

-- Edición general del SIGPIP: todos los principales menos inspector.
create or replace function puede_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select current_rol() in
    ('administrador','director','jefe_departamento','mesa_entrada','tecnico_administrativo')
$$;

-- Acceso a la app de actas: inspector como principal o secundario.
create or replace function puede_inspeccionar(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios
    where id = uid and activo and (rol = 'inspector' or rol_secundario = 'inspector')
  )
$$;
grant execute on function puede_inspeccionar(uuid) to authenticated;

-- ─────────────── 5) Delegación de Mesa con consentimiento ───────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'delegaciones_mesa' and column_name = 'estado'
  ) then
    alter table delegaciones_mesa add column estado text not null default 'pendiente';
    -- Filas previas: no revocadas valían como activas → 'aceptada'.
    update delegaciones_mesa set estado = case when revocada then 'revocada' else 'aceptada' end;
  end if;
end $$;

-- Mesa de Entrada efectiva: principal mesa_entrada, o admin, o delegación ACEPTADA y vigente.
create or replace function es_mesa_entrada(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from usuarios where id = uid and rol = 'mesa_entrada' and activo)
    or exists (select 1 from usuarios where id = uid and rol = 'administrador' and activo)
    or exists (
      select 1 from delegaciones_mesa d
      join usuarios u on u.id = d.a_usuario and u.activo
      where d.a_usuario = uid and d.estado = 'aceptada'
        and current_date >= d.desde and (d.hasta is null or current_date <= d.hasta)
    )
$$;

-- Delegar (solo Mesa principal o admin). Crea pendiente; el receptor debe aceptar.
create or replace function delegar_mesa(p_a uuid, p_desde date default current_date, p_hasta date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (current_rol() = 'mesa_entrada' or es_admin()) then raise exception 'SOLO_MESA_O_ADMIN'; end if;
  if p_a = auth.uid() then raise exception 'NO_TE_PODES_DELEGAR'; end if;
  if not exists (select 1 from usuarios where id = p_a and activo) then raise exception 'USUARIO_INEXISTENTE'; end if;
  insert into delegaciones_mesa (de_usuario, a_usuario, desde, hasta, estado)
  values (auth.uid(), p_a, coalesce(p_desde, current_date), p_hasta, 'pendiente')
  returning id into v_id;
  return v_id;
end $$;

create or replace function aceptar_delegacion_mesa(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update delegaciones_mesa set estado = 'aceptada'
   where id = p_id and a_usuario = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

create or replace function rechazar_delegacion_mesa(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update delegaciones_mesa set estado = 'rechazada'
   where id = p_id and a_usuario = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

create or replace function revocar_delegacion_mesa(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update delegaciones_mesa set estado = 'revocada', revocada = true
   where id = p_id and (de_usuario = auth.uid() or es_admin()) and estado in ('pendiente','aceptada');
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

grant execute on function delegar_mesa(uuid, date, date)   to authenticated;
grant execute on function aceptar_delegacion_mesa(uuid)    to authenticated;
grant execute on function rechazar_delegacion_mesa(uuid)   to authenticated;
grant execute on function revocar_delegacion_mesa(uuid)    to authenticated;

-- ─────────────── 6) Asignación de roles: SOLO admin ───────────────
create or replace function admin_set_roles(p_user uuid, p_principal rol_usuario, p_secundario rol_usuario default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'SOLO_ADMIN'; end if;
  if p_principal not in
     ('administrador','director','jefe_departamento','mesa_entrada','tecnico_administrativo','inspector')
     then raise exception 'ROL_PRINCIPAL_INVALIDO'; end if;
  if p_secundario is not null and p_secundario <> 'inspector'
     then raise exception 'ROL_SECUNDARIO_INVALIDO'; end if;
  if p_principal = 'mesa_entrada' and exists (
       select 1 from usuarios where rol = 'mesa_entrada' and id <> p_user)
     then raise exception 'YA_EXISTE_MESA_ENTRADA'; end if;
  update usuarios
     set rol = p_principal,
         rol_secundario = case when p_secundario = p_principal then null else p_secundario end
   where id = p_user;
  if not found then raise exception 'USUARIO_INEXISTENTE'; end if;
end $$;
grant execute on function admin_set_roles(uuid, rol_usuario, rol_usuario) to authenticated;

-- ─────────────── 7) Actas: usar el rol inspector ampliado (principal o secundario) ───────────────
drop policy if exists actas_ins on actas_inspeccion;
create policy actas_ins on actas_inspeccion
  for insert with check (
    (puede_inspeccionar() and inspector_id = auth.uid())
    or puede_editar()
  );

create or replace function crear_designacion(p_draft_id text, p_inspector2 uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nom1 text; v_nom2 text;
begin
  if not puede_inspeccionar() then raise exception 'SOLO_INSPECTORES'; end if;
  if p_inspector2 = auth.uid() then raise exception 'NO_TE_PODES_AGREGAR'; end if;
  if not exists (select 1 from usuarios where id = p_inspector2) then raise exception 'INSPECTOR_INEXISTENTE'; end if;
  if not puede_inspeccionar(p_inspector2) then raise exception 'EL_AGENTE2_NO_ES_INSPECTOR'; end if;
  select nombre into v_nom2 from usuarios where id = p_inspector2;
  select nombre into v_nom1 from usuarios where id = auth.uid();
  insert into actas_designaciones (draft_id, inspector1_id, inspector1_nombre, inspector2_id, inspector2_nombre)
  values (p_draft_id, auth.uid(), v_nom1, p_inspector2, v_nom2)
  returning id into v_id;
  return v_id;
end $$;

create or replace function listar_inspectores()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select u.id, u.nombre
  from usuarios u
  where u.activo and u.id <> auth.uid()
    and (u.rol = 'inspector' or u.rol_secundario = 'inspector')
  order by u.nombre;
$$;

-- Listar agentes activos (para elegir a quién delegar y resolver nombres).
create or replace function listar_agentes()
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select u.id, u.nombre from usuarios u
  where u.activo and u.id <> auth.uid()
  order by u.nombre;
$$;
grant execute on function listar_agentes() to authenticated;

-- ─────────────── 8) Realtime para avisar delegaciones ───────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'delegaciones_mesa'
  ) then
    alter publication supabase_realtime add table delegaciones_mesa;
  end if;
end $$;
