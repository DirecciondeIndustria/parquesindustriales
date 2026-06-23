-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 3: Documentos, Inspecciones, Escrituración, Archivo
--  (Sin OCR todavía — se evalúa en plan Pro.)
-- ════════════════════════════════════════════════════════════════

-- ─────────────── MÓDULO 6: Gestión documental ───────────────
create table if not exists documentos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid references expedientes (id) on delete cascade,
  empresa_id     uuid references empresas (id) on delete set null,
  parcela_id     uuid references parcelas (id) on delete set null,
  tipo_documental text not null,
  nombre         text not null,
  storage_path   text not null,
  mime           text,
  tamano         bigint,
  subido_por     uuid references usuarios (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_doc_exp on documentos (expediente_id);
create index if not exists idx_doc_emp on documentos (empresa_id);

-- Bucket de Storage para los archivos (privado).
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- ─────────────── MÓDULO 7: Inspecciones ───────────────
-- Registro de inspecciones del SIGPIP (la app de actas detallada se
-- integra luego apuntando a esta misma base).
create table if not exists inspecciones (
  id               uuid primary key default gen_random_uuid(),
  expediente_id    uuid references expedientes (id) on delete set null,
  parcela_id       uuid references parcelas (id) on delete set null,
  empresa_id       uuid references empresas (id) on delete set null,
  fecha_programada date,
  fecha_realizada  date,
  estado           text not null default 'pendiente',  -- pendiente|programada|realizada|observada|incumplimiento
  inspector        text,
  observaciones    text,
  created_at       timestamptz not null default now()
);

-- ─────────────── MÓDULO 8: Escrituración ───────────────
-- Se apoya en la tabla parcelas; agregamos datos dominiales.
alter table parcelas add column if not exists escritura_fecha date;
alter table parcelas add column if not exists dominio text;
alter table parcelas add column if not exists restricciones text;

-- ─────────────── MÓDULO 9: Archivo físico ───────────────
create table if not exists archivo_fisico (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid references expedientes (id) on delete cascade,
  estanteria    text,
  caja          text,
  archivo       text,
  estado        text not null default 'activo',  -- activo|archivado|baja
  observaciones text,
  created_at    timestamptz not null default now()
);

-- ─────────────── RLS ───────────────
alter table documentos     enable row level security;
alter table inspecciones   enable row level security;
alter table archivo_fisico enable row level security;

do $$
declare t text;
begin
  foreach t in array array['documentos','inspecciones','archivo_fisico']
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

-- Auditar las nuevas tablas de gestión.
do $$
declare t text;
begin
  foreach t in array array['documentos','inspecciones','archivo_fisico']
  loop
    execute format('drop trigger if exists trg_aud_%1$s on %1$s', t);
    execute format('create trigger trg_aud_%1$s after insert or update or delete on %1$s
                    for each row execute function fn_auditoria()', t);
  end loop;
end $$;

-- ─────────────── RLS de Storage (bucket documentos) ───────────────
drop policy if exists "doc_sel" on storage.objects;
drop policy if exists "doc_ins" on storage.objects;
drop policy if exists "doc_del" on storage.objects;
create policy "doc_sel" on storage.objects for select
  using (bucket_id = 'documentos' and auth.uid() is not null);
create policy "doc_ins" on storage.objects for insert
  with check (bucket_id = 'documentos' and auth.uid() is not null);
create policy "doc_del" on storage.objects for delete
  using (bucket_id = 'documentos' and auth.uid() is not null);
