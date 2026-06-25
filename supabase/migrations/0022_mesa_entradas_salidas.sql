-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 16: Mesa de Entradas y Salidas
--  Registro de TODO lo que ingresa (y más adelante egresa) de la
--  oficina: Notas, Planos, Expedientes, Notificaciones de Personal,
--  Correspondencia y Proyectos Industriales. Cada tipo guarda sus
--  campos específicos en `datos` (jsonb).
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists movimientos_mesa (
  id            uuid primary key default gen_random_uuid(),
  sentido       text not null default 'entrada',   -- entrada | salida (salida en fase siguiente)
  tipo          text not null,                      -- Nota | Plano | Expediente | Notificación de Personal | Correspondencia | Proyecto Industrial
  empresa_id    uuid references empresas (id) on delete set null,
  expediente_id uuid references expedientes (id) on delete set null,
  datos         jsonb not null default '{}'::jsonb, -- campos propios de cada tipo
  observaciones text,
  created_by    uuid references usuarios (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_mov_mesa_sentido on movimientos_mesa (sentido, created_at desc);
create index if not exists idx_mov_mesa_exp     on movimientos_mesa (expediente_id);
create index if not exists idx_mov_mesa_emp     on movimientos_mesa (empresa_id);

-- ── RLS: leen los autenticados, registra/edita la mesa de entrada o admin ──
alter table movimientos_mesa enable row level security;
do $$
begin
  execute 'drop policy if exists mov_mesa_sel on movimientos_mesa';
  execute 'drop policy if exists mov_mesa_ins on movimientos_mesa';
  execute 'drop policy if exists mov_mesa_upd on movimientos_mesa';
  execute 'drop policy if exists mov_mesa_del on movimientos_mesa';
  execute 'create policy mov_mesa_sel on movimientos_mesa for select using (auth.uid() is not null)';
  execute 'create policy mov_mesa_ins on movimientos_mesa for insert with check ((es_mesa_entrada() or es_admin()) and created_by = auth.uid())';
  execute 'create policy mov_mesa_upd on movimientos_mesa for update using (es_mesa_entrada() or es_admin())';
  execute 'create policy mov_mesa_del on movimientos_mesa for delete using (es_mesa_entrada() or es_admin())';
end $$;

-- Auditar los movimientos de mesa.
drop trigger if exists trg_aud_mov_mesa on movimientos_mesa;
create trigger trg_aud_mov_mesa
  after insert or update or delete on movimientos_mesa
  for each row execute function fn_auditoria();

-- ════════════════════════════════════════════════════════════════
--  Recaratulación de expediente
--  Cuando un expediente vuelve a la oficina con nuevo número/año/sigla
--  (recaratulado por el Ministerio), se actualiza el registro existente
--  conservando su id, historial y vínculos. Atómico y auditado por el
--  trigger de `expedientes`.
-- ════════════════════════════════════════════════════════════════
create or replace function recaratular_expediente(
  p_exp_id uuid,
  p_numero int,
  p_anio   int,
  p_sigla  text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_mesa_entrada() or puede_editar()) then
    raise exception 'No autorizado para recaratular expedientes.';
  end if;
  if p_numero is null or p_anio is null then
    raise exception 'Número y año son obligatorios para recaratular.';
  end if;
  update expedientes
     set numero = p_numero,
         anio   = p_anio,
         sigla  = nullif(trim(coalesce(p_sigla, '')), '')
   where id = p_exp_id;
  if not found then
    raise exception 'No se encontró el expediente a recaratular.';
  end if;
end $$;
grant execute on function recaratular_expediente(uuid, int, int, text) to authenticated;
