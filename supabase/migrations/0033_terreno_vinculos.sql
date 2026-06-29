-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Vínculos manuales polígono ↔ acta / polígono ↔ expediente
--
--  Permite al usuario vincular explícitamente un terreno (polígono KMZ)
--  con un acta de inspección y/o un expediente. Separado de la detección
--  automática por punto-en-polígono (que sirve solo para visualización).
--  Aplicar en: Supabase → SQL Editor. Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists terreno_vinculos (
  id            uuid primary key default gen_random_uuid(),
  terreno_id    uuid not null references actas_terrenos (id) on delete cascade,
  acta_id       uuid references actas_inspeccion (id) on delete cascade,
  expediente_id uuid references expedientes (id) on delete cascade,
  nota          text,                              -- comentario opcional
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  -- Al menos uno de los dos vínculos debe estar presente
  constraint chk_vinculo_minimo check (acta_id is not null or expediente_id is not null)
);

create index if not exists idx_tv_terreno on terreno_vinculos (terreno_id);
create index if not exists idx_tv_acta    on terreno_vinculos (acta_id);
create index if not exists idx_tv_expte   on terreno_vinculos (expediente_id);

-- ─────────────── RLS ───────────────
alter table terreno_vinculos enable row level security;

drop policy if exists tv_sel on terreno_vinculos;
drop policy if exists tv_ins on terreno_vinculos;
drop policy if exists tv_del on terreno_vinculos;

create policy tv_sel on terreno_vinculos for select using (auth.uid() is not null);
create policy tv_ins on terreno_vinculos for insert with check (puede_editar());
create policy tv_del on terreno_vinculos for delete using (puede_editar());

-- ─────────────── Auditoría ───────────────
drop trigger if exists trg_aud_terreno_vinculos on terreno_vinculos;
create trigger trg_aud_terreno_vinculos
  after insert or update or delete on terreno_vinculos
  for each row execute function fn_auditoria();
