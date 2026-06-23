-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 7: Número de expediente manual + siglas del Ministerio
--  El número de expediente lo asigna el Ministerio (no el sistema): se
--  carga a mano número + año + sigla. Las siglas (actual e históricas)
--  se administran en una tabla; la vigente es la predeterminada.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ── Siglas / denominaciones del Ministerio (actual e históricas) ──
create table if not exists siglas_ministerio (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,            -- "Ministerio de Producción", etc.
  sigla      text not null,            -- "MP", "MPyT", etc.
  vigente    boolean not null default false,
  orden      int not null default 0,
  created_at timestamptz not null default now()
);

-- Sigla del expediente (denominación con la que lo caratuló el Ministerio).
alter table expedientes add column if not exists sigla text;

-- El número ya no es correlativo del sistema: puede repetirse entre
-- distintas siglas/años, así que la unicidad contempla la sigla.
do $$
begin
  alter table expedientes drop constraint if exists expedientes_numero_anio_key;
  if not exists (
    select 1 from pg_constraint where conname = 'expedientes_numero_anio_sigla_key'
  ) then
    alter table expedientes
      add constraint expedientes_numero_anio_sigla_key unique (numero, anio, sigla);
  end if;
end $$;

-- Solo una sigla vigente a la vez: al marcar una, se desmarcan las demás.
create or replace function fn_unica_sigla_vigente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.vigente then
    update siglas_ministerio set vigente = false
    where id <> new.id and vigente = true;
  end if;
  return new;
end $$;

drop trigger if exists trg_unica_sigla on siglas_ministerio;
create trigger trg_unica_sigla
  after insert or update of vigente on siglas_ministerio
  for each row when (new.vigente) execute function fn_unica_sigla_vigente();

-- ── RLS: leen autenticados, escriben roles de gestión ──
alter table siglas_ministerio enable row level security;
do $$
begin
  execute 'drop policy if exists siglas_sel on siglas_ministerio';
  execute 'drop policy if exists siglas_ins on siglas_ministerio';
  execute 'drop policy if exists siglas_upd on siglas_ministerio';
  execute 'drop policy if exists siglas_del on siglas_ministerio';
  execute 'create policy siglas_sel on siglas_ministerio for select using (auth.uid() is not null)';
  execute 'create policy siglas_ins on siglas_ministerio for insert with check (puede_editar())';
  execute 'create policy siglas_upd on siglas_ministerio for update using (puede_editar())';
  execute 'create policy siglas_del on siglas_ministerio for delete using (puede_editar())';
end $$;

-- Auditar la tabla de siglas.
drop trigger if exists trg_aud_siglas on siglas_ministerio;
create trigger trg_aud_siglas
  after insert or update or delete on siglas_ministerio
  for each row execute function fn_auditoria();

-- ── Sigla vigente inicial (editable desde la app) ──
insert into siglas_ministerio (nombre, sigla, vigente, orden)
select 'Ministerio de Producción', 'MP', true, 0
where not exists (select 1 from siglas_ministerio);
