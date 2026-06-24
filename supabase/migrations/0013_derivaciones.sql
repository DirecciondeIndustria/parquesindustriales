-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 9: Mesa de entrada y derivación de documentación
--  La mesa de entrada (rol archivo o delegado) registra el ingreso de
--  documentación y la deriva a un agente, que la ve como pendiente al
--  iniciar sesión. Todos en la oficina ven los movimientos.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists derivaciones (
  id             uuid primary key default gen_random_uuid(),
  tipo_documental text,
  descripcion    text not null,
  empresa_id     uuid references empresas (id) on delete set null,
  expediente_id  uuid references expedientes (id) on delete set null,
  documento_id   uuid references documentos (id) on delete set null,
  de_usuario     uuid references usuarios (id) on delete set null,
  a_usuario      uuid not null references usuarios (id) on delete cascade,
  estado         text not null default 'pendiente',   -- pendiente | recibida
  nota           text,
  fecha          timestamptz not null default now(),
  recibida_at    timestamptz
);
create index if not exists idx_deriv_a on derivaciones (a_usuario, estado);
create index if not exists idx_deriv_exp on derivaciones (expediente_id);

-- ── RLS ──
alter table derivaciones enable row level security;
do $$
begin
  execute 'drop policy if exists deriv_sel on derivaciones';
  execute 'drop policy if exists deriv_ins on derivaciones';
  execute 'drop policy if exists deriv_upd on derivaciones';
  execute 'drop policy if exists deriv_del on derivaciones';
  -- Todos los de la oficina ven los movimientos.
  execute 'create policy deriv_sel on derivaciones for select using (auth.uid() is not null)';
  -- Solo la mesa de entrada (rol archivo o delegado) deriva, y como sí misma.
  execute 'create policy deriv_ins on derivaciones for insert with check (es_mesa_entrada() and de_usuario = auth.uid())';
  -- El destinatario marca "recibida"; mesa de entrada y admin también pueden corregir.
  execute 'create policy deriv_upd on derivaciones for update using (a_usuario = auth.uid() or es_mesa_entrada() or es_admin())';
  execute 'create policy deriv_del on derivaciones for delete using (es_mesa_entrada() or es_admin())';
end $$;

-- Auditar las derivaciones.
drop trigger if exists trg_aud_derivaciones on derivaciones;
create trigger trg_aud_derivaciones
  after insert or update or delete on derivaciones
  for each row execute function fn_auditoria();
