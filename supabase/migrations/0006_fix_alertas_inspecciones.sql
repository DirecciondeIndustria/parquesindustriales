-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fix: alertar TODA inspección pendiente/programada
--  (antes solo alertaba las vencidas, así que una programada para hoy
--   o a futuro no generaba alerta).
-- ════════════════════════════════════════════════════════════════

create or replace function fn_generar_alertas()
returns void language plpgsql security definer set search_path = public as $$
begin
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

  -- Toda inspección pendiente o programada (vencida = alta; futura/hoy = media).
  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'inspeccion',
         case when i.fecha_programada is not null and i.fecha_programada < current_date then 'alta' else 'media' end,
         'Inspección pendiente de ejecución' ||
           coalesce(' (programada ' || to_char(i.fecha_programada, 'DD/MM/YYYY') || ')', '') || '.',
         i.expediente_id, 'inspector'
  from inspecciones i
  where i.estado in ('pendiente', 'programada');
end $$;

-- Recalcular ya.
select fn_generar_alertas();
