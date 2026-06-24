-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 8: Permisos, delegación de mesa de entrada y auditoría
--  · Delegación temporal del rol mesa de entrada (archivo) de Marcela.
--  · Función es_mesa_entrada() (rol archivo o delegación activa).
--  · Más tablas auditadas + auditoría visible para todos los agentes.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ── Delegación temporal de mesa de entrada ──
create table if not exists delegaciones_mesa (
  id          uuid primary key default gen_random_uuid(),
  de_usuario  uuid not null references usuarios (id) on delete cascade,
  a_usuario   uuid not null references usuarios (id) on delete cascade,
  desde       date not null default current_date,
  hasta       date,                       -- null = sin fecha de fin
  revocada    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_deleg_a on delegaciones_mesa (a_usuario);

-- ── ¿El usuario ejerce mesa de entrada? (rol archivo o delegación activa) ──
create or replace function es_mesa_entrada(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from usuarios where id = uid and rol = 'archivo')
    or exists (
      select 1 from delegaciones_mesa d
      where d.a_usuario = uid and not d.revocada
        and current_date >= d.desde
        and (d.hasta is null or current_date <= d.hasta)
    )
$$;
grant execute on function es_mesa_entrada(uuid) to authenticated;

-- ── RLS: la delegación la crea/gestiona quien es mesa de entrada o admin ──
alter table delegaciones_mesa enable row level security;
do $$
begin
  execute 'drop policy if exists deleg_sel on delegaciones_mesa';
  execute 'drop policy if exists deleg_ins on delegaciones_mesa';
  execute 'drop policy if exists deleg_upd on delegaciones_mesa';
  execute 'drop policy if exists deleg_del on delegaciones_mesa';
  execute 'create policy deleg_sel on delegaciones_mesa for select using (auth.uid() is not null)';
  execute 'create policy deleg_ins on delegaciones_mesa for insert with check (es_admin() or current_rol() = ''archivo'')';
  execute 'create policy deleg_upd on delegaciones_mesa for update using (es_admin() or current_rol() = ''archivo'')';
  execute 'create policy deleg_del on delegaciones_mesa for delete using (es_admin() or current_rol() = ''archivo'')';
end $$;

-- ── Auditoría: agregar las tablas que faltaban ──
do $$
declare t text;
begin
  foreach t in array array['etapas_definicion','expediente_subtramites','usuarios','delegaciones_mesa']
  loop
    execute format('drop trigger if exists trg_aud_%1$s on %1$s', t);
    execute format('create trigger trg_aud_%1$s after insert or update or delete on %1$s
                    for each row execute function fn_auditoria()', t);
  end loop;
end $$;

-- ── Auditoría visible para todos los agentes (el filtro por usuario es de UI) ──
drop policy if exists auditoria_sel on auditoria;
create policy auditoria_sel on auditoria for select using (auth.uid() is not null);
