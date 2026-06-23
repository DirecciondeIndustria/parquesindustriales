-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 0: Fundaciones
--  Roles, maestros base, expedientes, flujos, auditoría y RLS.
--  Aplicar en: Supabase → SQL Editor (o supabase db push).
-- ════════════════════════════════════════════════════════════════

-- ───────────────────────── ENUMS ─────────────────────────
create type rol_usuario as enum (
  'administrador', 'director', 'direccion_general',
  'parques', 'archivo', 'inspector', 'consulta'
);

create type estado_parcela as enum (
  'libre', 'operativa', 'desarrollo', 'incumplimiento', 'escriturada'
);

create type estado_expediente as enum (
  'iniciado', 'en_tramite', 'demorado', 'finalizado', 'archivado', 'baja'
);

-- ──────────────────── USUARIOS / ROLES ───────────────────
-- Perfil ligado a auth.users (1:1). El rol gobierna la RLS.
create table usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  email       text,
  rol         rol_usuario not null default 'consulta',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Helper: rol del usuario actual (SECURITY DEFINER evita recursión en RLS).
create or replace function current_rol()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from usuarios where id = auth.uid()
$$;

create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select current_rol() in ('administrador', 'director')
$$;

create or replace function puede_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select current_rol() in ('administrador', 'director', 'parques', 'archivo')
$$;

-- ───────────────────────── MAESTROS ──────────────────────
create table parques_industriales (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  localidad   text not null,
  superficie  numeric,
  estado      text default 'activo',
  created_at  timestamptz not null default now()
);

create table empresas (
  id             uuid primary key default gen_random_uuid(),
  razon_social   text not null,
  cuit           text,
  domicilio      text,
  telefono       text,
  email          text,
  representantes jsonb default '[]'::jsonb,
  actividad      text,
  estado         text default 'activa',
  fecha_radicacion date,
  created_at     timestamptz not null default now()
);

create table parcelas (
  id                uuid primary key default gen_random_uuid(),
  parque_id         uuid not null references parques_industriales (id) on delete restrict,
  identificacion    text not null,            -- ej. "Ej.5 Circ.2 S.A Mz.10 P.4"
  ejido text, circ text, sector text, manzana text, macizo text, parcela text,
  superficie        numeric,
  estado            estado_parcela not null default 'libre',
  empresa_id        uuid references empresas (id) on delete set null,
  fecha_adjudicacion date,
  escriturada       boolean not null default false,
  hipoteca_vigente  boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ──────────────── FLUJOS DE TRÁMITE (Mód. 5) ─────────────
create table tipos_tramite (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,             -- Adjudicación, Transferencia, Hipoteca...
  activo  boolean not null default true
);

create table etapas_definicion (
  id              uuid primary key default gen_random_uuid(),
  tipo_tramite_id uuid not null references tipos_tramite (id) on delete cascade,
  orden           int not null,
  nombre          text not null,            -- "Evaluación técnica", "Firma"...
  plazo_dias      int,                      -- plazo sugerido para esta etapa
  docs_requeridos text[],                   -- tipos documentales exigidos
  unique (tipo_tramite_id, orden)
);

-- ──────────────── EXPEDIENTES (Mód. 4) ───────────────────
create table expedientes (
  id                uuid primary key default gen_random_uuid(),
  numero            int not null,
  anio              int not null,
  tipo_tramite_id   uuid references tipos_tramite (id),
  empresa_id        uuid references empresas (id) on delete set null,
  parcela_id        uuid references parcelas (id) on delete set null,
  estado            estado_expediente not null default 'iniciado',
  responsable_id    uuid references usuarios (id) on delete set null,
  fecha_inicio      date not null default current_date,
  plazo_vencimiento date,
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (numero, anio)
);

create table expediente_etapas (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references expedientes (id) on delete cascade,
  orden          int not null,
  nombre         text not null,
  estado         text not null default 'pendiente',  -- pendiente|en_curso|completada
  responsable_id uuid references usuarios (id) on delete set null,
  fecha_entrada  timestamptz,
  fecha_salida   timestamptz
);

-- ──────────────── AUDITORÍA (Mód. 14) ────────────────────
create table auditoria (
  id            bigint generated always as identity primary key,
  usuario_id    uuid,
  usuario_email text,
  accion        text not null,             -- INSERT | UPDATE | DELETE
  tabla         text not null,
  registro_id   text,
  datos_antes   jsonb,
  datos_despues jsonb,
  fecha         timestamptz not null default now()
);

create or replace function fn_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  insert into auditoria (usuario_id, usuario_email, accion, tabla, registro_id, datos_antes, datos_despues)
  values (
    uid,
    (select email from usuarios where id = uid),
    tg_op, tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- Auditar las tablas de gestión.
do $$
declare t text;
begin
  foreach t in array array['empresas','parcelas','parques_industriales','expedientes','expediente_etapas']
  loop
    execute format(
      'create trigger trg_aud_%1$s after insert or update or delete on %1$s
       for each row execute function fn_auditoria()', t);
  end loop;
end $$;

-- updated_at automático en expedientes.
create or replace function fn_touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_touch_exp before update on expedientes
  for each row execute function fn_touch_updated();

-- ═══════════════════════ RLS ═══════════════════════════
-- Patrón: todo usuario autenticado LEE; solo roles de gestión ESCRIBEN;
-- admin/director borran. La tabla usuarios se autogestiona.

alter table usuarios               enable row level security;
alter table parques_industriales   enable row level security;
alter table empresas               enable row level security;
alter table parcelas               enable row level security;
alter table tipos_tramite          enable row level security;
alter table etapas_definicion      enable row level security;
alter table expedientes            enable row level security;
alter table expediente_etapas      enable row level security;
alter table auditoria              enable row level security;

-- usuarios: cada uno ve su perfil; admin ve y gestiona todos.
create policy usuarios_sel on usuarios for select using (id = auth.uid() or es_admin());
create policy usuarios_upd on usuarios for update using (es_admin());
create policy usuarios_ins on usuarios for insert with check (es_admin());

-- Maestros y flujos: lectura para autenticados, escritura para gestión.
do $$
declare t text;
begin
  foreach t in array array['parques_industriales','empresas','parcelas',
                            'tipos_tramite','etapas_definicion',
                            'expedientes','expediente_etapas']
  loop
    execute format('create policy %1$s_sel on %1$s for select using (auth.uid() is not null)', t);
    execute format('create policy %1$s_ins on %1$s for insert with check (puede_editar())', t);
    execute format('create policy %1$s_upd on %1$s for update using (puede_editar())', t);
    execute format('create policy %1$s_del on %1$s for delete using (es_admin())', t);
  end loop;
end $$;

-- Auditoría: solo lectura, y solo admin/director.
create policy auditoria_sel on auditoria for select using (es_admin());

-- ═══════════════════ DATOS SEMILLA ═════════════════════
insert into tipos_tramite (nombre) values
  ('Adjudicación'), ('Transferencia'), ('Hipoteca'),
  ('Comodato'), ('Baja'), ('Recuperación de parcela'),
  ('Regularización'), ('Escrituración');

-- Parques según las actas de inspección (PARQUES_POR_CIUDAD en app.js).
insert into parques_industriales (nombre, localidad) values
  ('Parque Industrial Pesado',                  'Comodoro Rivadavia'),
  ('Sector Equipamientos Complementarios',      'Comodoro Rivadavia'),
  ('Parque Industrial Pesado',                  'Trelew'),
  ('Zona de Actividades Complementarias',       'Trelew'),
  ('Parque Industrial Pesado',                  'Puerto Madryn'),
  ('Parque Industrial Liviano',                 'Puerto Madryn'),
  ('Parque Industrial Pesquero',                'Puerto Madryn'),
  ('Zona Industrial Conexa al Aluminio',        'Puerto Madryn'),
  ('Parque Industrial Pesado',                  'Trevelin');
