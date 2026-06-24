-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 12: Portal externo de empresas (solo lectura)
--  Cada empresa puede tener una cuenta (email+contraseña) para ver, a
--  grandes rasgos, el estado de SUS expedientes. Seguridad:
--   · El usuario externo NO tiene perfil interno (usuarios), así que por
--     la 0016 no puede leer NINGUNA tabla interna.
--   · Solo accede a VISTAS del portal, ya filtradas a su empresa, y a su
--     propia fila de acceso. No ve requisitos, documentos, custodia, etc.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ── Vínculo cuenta externa ↔ empresa ──
create table if not exists empresa_accesos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  user_id    uuid not null unique,          -- id de la cuenta (auth.users)
  email      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table empresa_accesos enable row level security;
do $$
begin
  execute 'drop policy if exists acc_sel on empresa_accesos';
  execute 'drop policy if exists acc_ins on empresa_accesos';
  execute 'drop policy if exists acc_upd on empresa_accesos';
  execute 'drop policy if exists acc_del on empresa_accesos';
  -- El admin gestiona; el propio usuario externo puede leer su vínculo.
  execute 'create policy acc_sel on empresa_accesos for select using (es_admin() or user_id = auth.uid())';
  execute 'create policy acc_ins on empresa_accesos for insert with check (es_admin())';
  execute 'create policy acc_upd on empresa_accesos for update using (es_admin())';
  execute 'create policy acc_del on empresa_accesos for delete using (es_admin())';
end $$;

-- ¿A qué empresa pertenece la cuenta externa? (null si no es externa / inactiva)
create or replace function empresa_de_acceso(uid uuid default auth.uid())
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from empresa_accesos where user_id = uid and activo limit 1
$$;
grant execute on function empresa_de_acceso(uuid) to authenticated;

-- ── Notas a la empresa (solicitudes de documentación / informes) ──
create table if not exists notas_empresa (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas (id) on delete cascade,
  expediente_id uuid references expedientes (id) on delete set null,
  numero_nota   text not null,
  asunto        text not null,
  fecha         date not null default current_date,
  created_by    uuid references usuarios (id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table notas_empresa enable row level security;
do $$
begin
  execute 'drop policy if exists notas_sel on notas_empresa';
  execute 'drop policy if exists notas_ins on notas_empresa';
  execute 'drop policy if exists notas_upd on notas_empresa';
  execute 'drop policy if exists notas_del on notas_empresa';
  execute 'create policy notas_sel on notas_empresa for select using (es_usuario_activo() or empresa_id = empresa_de_acceso(auth.uid()))';
  execute 'create policy notas_ins on notas_empresa for insert with check (puede_editar())';
  execute 'create policy notas_upd on notas_empresa for update using (puede_editar())';
  execute 'create policy notas_del on notas_empresa for delete using (puede_editar())';
end $$;
drop trigger if exists trg_aud_notas on notas_empresa;
create trigger trg_aud_notas after insert or update or delete on notas_empresa
  for each row execute function fn_auditoria();

-- ── VISTAS del portal (definer: corren con permisos del dueño y se
--    auto-filtran a la empresa del usuario externo; no exponen las tablas) ──
create or replace view portal_empresa as
  select e.id, e.razon_social
  from empresas e
  where e.id = empresa_de_acceso(auth.uid());

create or replace view portal_expedientes as
  select e.id, e.numero, e.anio, e.sigla, e.estado, e.fecha_inicio,
         (select ee.nombre from expediente_etapas ee
            where ee.expediente_id = e.id and ee.estado = 'en_curso' order by ee.orden limit 1) as etapa_actual,
         (select count(*) from expediente_etapas ee where ee.expediente_id = e.id) as total_etapas,
         (select count(*) from expediente_etapas ee where ee.expediente_id = e.id and ee.estado = 'completada') as etapas_completadas
  from expedientes e
  where e.empresa_id = empresa_de_acceso(auth.uid());

-- Línea de tiempo a grandes rasgos (nombres de hitos y estado; SIN requisitos)
create or replace view portal_movimientos as
  select ee.expediente_id, ee.orden, ee.nombre, ee.estado, ee.fecha_entrada, ee.fecha_salida
  from expediente_etapas ee
  join expedientes e on e.id = ee.expediente_id
  where e.empresa_id = empresa_de_acceso(auth.uid());

create or replace view portal_notas as
  select n.id, n.expediente_id, n.numero_nota, n.asunto, n.fecha
  from notas_empresa n
  where n.empresa_id = empresa_de_acceso(auth.uid());

grant select on portal_empresa, portal_expedientes, portal_movimientos, portal_notas to authenticated;
