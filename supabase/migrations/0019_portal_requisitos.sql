-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 14: La empresa ve la hoja de ruta con requisitos
--  Se muestran TODOS los hitos, pero los requisitos SOLO de los hitos
--  ya completados y del hito en curso. Los requisitos de hitos futuros
--  NUNCA se exponen (para que la empresa no se adelante a presentarlos).
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- Movimientos del portal, ahora con el id del hito (para colgar requisitos).
drop view if exists portal_movimientos;
create view portal_movimientos as
  select ee.id as etapa_id, ee.expediente_id, ee.orden, ee.nombre, ee.estado,
         ee.fecha_entrada, ee.fecha_salida
  from expediente_etapas ee
  join expedientes e on e.id = ee.expediente_id
  where e.empresa_id = empresa_de_acceso(auth.uid());

-- Requisitos visibles para la empresa: solo de hitos completados o en curso.
drop view if exists portal_requisitos;
create view portal_requisitos as
  select s.id, ee.expediente_id, s.expediente_etapa_id, s.orden,
         s.nombre, s.obligatorio, s.completado
  from expediente_subtramites s
  join expediente_etapas ee on ee.id = s.expediente_etapa_id
  join expedientes e on e.id = ee.expediente_id
  where e.empresa_id = empresa_de_acceso(auth.uid())
    and ee.estado in ('completada', 'en_curso');

grant select on portal_movimientos, portal_requisitos to authenticated;
