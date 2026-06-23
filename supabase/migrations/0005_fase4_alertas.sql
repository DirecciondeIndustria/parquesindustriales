-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 4: Motor de alertas + RLS de alertas/auditoría
-- ════════════════════════════════════════════════════════════════

-- Tabla de alertas (faltaba crearla en la Fase 0).
create table if not exists alertas (
  id              bigint generated always as identity primary key,
  tipo            text not null,            -- vencimiento | sin_movimiento | inspeccion | ...
  severidad       text not null default 'media',  -- alta | media | baja
  mensaje         text not null,
  expediente_id   uuid references expedientes (id) on delete cascade,
  empresa_id      uuid references empresas (id) on delete cascade,
  destinatario_rol text,
  leida           boolean not null default false,
  fecha           timestamptz not null default now()
);

alter table alertas enable row level security;

-- Distinguir alertas automáticas de las manuales.
alter table alertas add column if not exists automatica boolean not null default true;

-- ─── Motor: regenera las alertas automáticas según el estado actual ───
create or replace function fn_generar_alertas()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Borrar las automáticas no leídas (se recalculan).
  delete from alertas where automatica = true and leida = false;

  -- Plazo vencido.
  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'vencimiento', 'alta',
         'Expediente ' || e.numero || '/' || e.anio || ': plazo vencido hace ' ||
           (current_date - e.plazo_vencimiento) || ' día(s).', e.id, 'parques'
  from expedientes e
  where e.plazo_vencimiento is not null and e.plazo_vencimiento < current_date
    and e.estado not in ('finalizado', 'archivado', 'baja');

  -- Plazo próximo (<= 7 días).
  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'vencimiento', 'media',
         'Expediente ' || e.numero || '/' || e.anio || ': vence en ' ||
           (e.plazo_vencimiento - current_date) || ' día(s).', e.id, 'parques'
  from expedientes e
  where e.plazo_vencimiento is not null
    and e.plazo_vencimiento >= current_date
    and e.plazo_vencimiento <= current_date + 7
    and e.estado not in ('finalizado', 'archivado', 'baja');

  -- Expedientes sin movimiento (> 45 días).
  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'sin_movimiento', 'alta',
         'Expediente ' || e.numero || '/' || e.anio || ': sin movimiento hace ' ||
           extract(day from now() - e.updated_at)::int || ' días.', e.id, 'parques'
  from expedientes e
  where e.updated_at < now() - interval '45 days'
    and e.estado not in ('finalizado', 'archivado', 'baja');

  -- Inspecciones pendientes/programadas con fecha pasada.
  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'inspeccion', 'media',
         'Inspección pendiente de ejecución' ||
           coalesce(' (programada ' || to_char(i.fecha_programada, 'DD/MM/YYYY') || ')', '') || '.',
         i.expediente_id, 'inspector'
  from inspecciones i
  where i.estado in ('pendiente', 'programada')
    and (i.fecha_programada is null or i.fecha_programada < current_date);
end $$;

-- Permitir que el frontend la dispare ("Recalcular ahora").
grant execute on function fn_generar_alertas() to authenticated;

-- ─── RLS ───
-- alertas: ya tenía RLS (alterada en 0001). Aseguramos políticas de lectura/marcado.
drop policy if exists auditoria_sel on auditoria;        -- (se recrea abajo, idempotente)
drop policy if exists alertas_sel on alertas;
drop policy if exists alertas_upd on alertas;
drop policy if exists alertas_ins on alertas;
drop policy if exists alertas_del on alertas;

create policy alertas_sel on alertas for select using (auth.uid() is not null);
create policy alertas_upd on alertas for update using (auth.uid() is not null);   -- marcar leída
create policy alertas_ins on alertas for insert with check (puede_editar());
create policy alertas_del on alertas for delete using (puede_editar());

-- auditoria: solo admin/director leen.
create policy auditoria_sel on auditoria for select using (es_admin());

-- ─── Programación diaria con pg_cron (si está disponible) ───
-- En Supabase: Database → Extensions → habilitar "pg_cron" si esto falla.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sigpip-alertas') then
    perform cron.unschedule('sigpip-alertas');
  end if;
  perform cron.schedule('sigpip-alertas', '0 6 * * *', 'select fn_generar_alertas();');
exception when others then
  raise notice 'pg_cron no disponible; habilitalo en Database → Extensions. Las alertas igual se recalculan desde el botón de la app.';
end $$;

-- Primera corrida inmediata.
select fn_generar_alertas();
