-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 13: Consultas empresa ↔ oficina (solo texto)
--  La empresa puede consultar sobre su expediente desde el portal; la
--  oficina responde/aclara y puede notificar pedidos de información.
--  IMPORTANTE: es un canal SOLO de texto. La empresa NO puede adjuntar
--  ni responder con documentación por el sistema: eso va por vía postal
--  o presencial en Mesa de Entrada. (No hay columnas de archivo aquí.)
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists consultas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas (id) on delete cascade,
  expediente_id uuid references expedientes (id) on delete set null,
  emisor        text not null check (emisor in ('empresa', 'oficina')),
  tipo          text not null default 'consulta',  -- consulta | respuesta | solicitud
  autor_id      uuid,                               -- auth uid de quien escribió (informativo)
  autor_nombre  text,
  mensaje       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_consultas_exp on consultas (expediente_id);
create index if not exists idx_consultas_emp on consultas (empresa_id);

alter table consultas enable row level security;
do $$
begin
  execute 'drop policy if exists consultas_sel on consultas';
  execute 'drop policy if exists consultas_ins_empresa on consultas';
  execute 'drop policy if exists consultas_ins_oficina on consultas';
  execute 'drop policy if exists consultas_del on consultas';

  -- Leen: internos (todo) y la empresa (lo suyo).
  execute 'create policy consultas_sel on consultas for select using (es_usuario_activo() or empresa_id = empresa_de_acceso(auth.uid()))';

  -- La empresa solo puede escribir como "empresa" y en su propia empresa.
  execute 'create policy consultas_ins_empresa on consultas for insert with check (emisor = ''empresa'' and empresa_id = empresa_de_acceso(auth.uid()))';

  -- La oficina (usuario interno activo) solo puede escribir como "oficina".
  execute 'create policy consultas_ins_oficina on consultas for insert with check (emisor = ''oficina'' and es_usuario_activo())';

  -- Borrado: solo admin (moderación).
  execute 'create policy consultas_del on consultas for delete using (es_admin())';
end $$;

-- Auditar las consultas.
drop trigger if exists trg_aud_consultas on consultas;
create trigger trg_aud_consultas after insert or update or delete on consultas
  for each row execute function fn_auditoria();
