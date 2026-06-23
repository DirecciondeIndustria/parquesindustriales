-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 2b: Hitos + trámites secundarios (requisitos)
--  Dos niveles: HITO principal (etapas_definicion) y SUB-TRÁMITES
--  (requisitos) dentro de cada hito. Editable en plantilla y por
--  expediente.
-- ════════════════════════════════════════════════════════════════

-- ── Plantilla: sub-trámites por hito de cada tipo de trámite ──
create table if not exists subtramites_definicion (
  id                 uuid primary key default gen_random_uuid(),
  etapa_definicion_id uuid not null references etapas_definicion (id) on delete cascade,
  orden              int not null default 1,
  nombre             text not null,
  obligatorio        boolean not null default true
);

-- ── Instancia: sub-trámites de un expediente (editables por expediente) ──
create table if not exists expediente_subtramites (
  id                 uuid primary key default gen_random_uuid(),
  expediente_etapa_id uuid not null references expediente_etapas (id) on delete cascade,
  orden              int not null default 1,
  nombre             text not null,
  obligatorio        boolean not null default true,
  completado         boolean not null default false,
  completado_at      timestamptz,
  completado_por     uuid references usuarios (id) on delete set null
);

-- Vincular cada hito instanciado con su definición (para arrastrar sub-trámites).
alter table expediente_etapas
  add column if not exists definicion_id uuid references etapas_definicion (id) on delete set null;

-- ── RLS (mismo patrón: leen autenticados, editan gestión, borran admin) ──
alter table subtramites_definicion    enable row level security;
alter table expediente_subtramites    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['subtramites_definicion','expediente_subtramites']
  loop
    execute format('drop policy if exists %1$s_sel on %1$s', t);
    execute format('drop policy if exists %1$s_ins on %1$s', t);
    execute format('drop policy if exists %1$s_upd on %1$s', t);
    execute format('drop policy if exists %1$s_del on %1$s', t);
    execute format('create policy %1$s_sel on %1$s for select using (auth.uid() is not null)', t);
    execute format('create policy %1$s_ins on %1$s for insert with check (puede_editar())', t);
    execute format('create policy %1$s_upd on %1$s for update using (puede_editar())', t);
    execute format('create policy %1$s_del on %1$s for delete using (puede_editar())', t);
  end loop;
end $$;

-- Auditar la plantilla de sub-trámites.
drop trigger if exists trg_aud_subtramites_definicion on subtramites_definicion;
create trigger trg_aud_subtramites_definicion
  after insert or update or delete on subtramites_definicion
  for each row execute function fn_auditoria();

-- ── Trigger: al crear expediente, instanciar hitos Y sus sub-trámites ──
create or replace function fn_instanciar_etapas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo_tramite_id is not null then
    insert into expediente_etapas (expediente_id, definicion_id, orden, nombre, estado, fecha_entrada)
    select new.id, ed.id, ed.orden, ed.nombre,
           case when ed.orden = 1 then 'en_curso' else 'pendiente' end,
           case when ed.orden = 1 then now() else null end
    from etapas_definicion ed
    where ed.tipo_tramite_id = new.tipo_tramite_id;

    insert into expediente_subtramites (expediente_etapa_id, orden, nombre, obligatorio)
    select ee.id, sd.orden, sd.nombre, sd.obligatorio
    from subtramites_definicion sd
    join expediente_etapas ee on ee.definicion_id = sd.etapa_definicion_id
    where ee.expediente_id = new.id;
  end if;
  return new;
end $$;

-- (El trigger trg_instanciar ya existe y usa esta función actualizada.)
