-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Datos de demostración (ficticios)
--  Idempotente: si ya se cargó, no duplica.
-- ════════════════════════════════════════════════════════════════
do $$
declare
  t_adj uuid; t_transf uuid; t_hip uuid; t_com uuid; t_escr uuid;
  pm_pesado uuid; pm_liviano uuid; pm_pesquero uuid;
  cr_pesado uuid; tw_pesado uuid;
  emp1 uuid; emp2 uuid; emp3 uuid; emp4 uuid; emp5 uuid; emp6 uuid;
  pc1 uuid; pc2 uuid; pc3 uuid; pc4 uuid; pc5 uuid; pc6 uuid; pc7 uuid;
  ex uuid;
begin
  if exists (select 1 from empresas where cuit = '30-71010101-1') then
    raise notice 'Datos demo ya cargados; no se duplican.';
    return;
  end if;

  select id into t_adj   from tipos_tramite where nombre = 'Adjudicación';
  select id into t_transf from tipos_tramite where nombre = 'Transferencia';
  select id into t_hip   from tipos_tramite where nombre = 'Hipoteca';
  select id into t_com   from tipos_tramite where nombre = 'Comodato';
  select id into t_escr  from tipos_tramite where nombre = 'Escrituración';

  select id into pm_pesado   from parques_industriales where nombre = 'Parque Industrial Pesado'   and localidad = 'Puerto Madryn' limit 1;
  select id into pm_liviano  from parques_industriales where nombre = 'Parque Industrial Liviano'  and localidad = 'Puerto Madryn' limit 1;
  select id into pm_pesquero from parques_industriales where nombre = 'Parque Industrial Pesquero' and localidad = 'Puerto Madryn' limit 1;
  select id into cr_pesado   from parques_industriales where nombre = 'Parque Industrial Pesado'   and localidad = 'Comodoro Rivadavia' limit 1;
  select id into tw_pesado   from parques_industriales where nombre = 'Parque Industrial Pesado'   and localidad = 'Trelew' limit 1;

  -- ── Empresas ──
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion) values
    ('Metalúrgica Patagonia S.A.',      '30-71010101-1', 'Av. Industrial 1200, Pto. Madryn', '0280-4451200', 'info@metalpatagonia.com.ar', 'Metalurgia', 'activa',   '2019-03-12') returning id into emp1;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion) values
    ('Pesquera del Golfo S.R.L.',       '30-71020202-2', 'Muelle Storni s/n, Pto. Madryn',   '0280-4456789', 'contacto@pesgolfo.com',     'Procesamiento de pescado', 'activa', '2017-08-01') returning id into emp2;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion) values
    ('Plásticos del Sur S.A.',          '30-71030303-3', 'Calle 9 N° 450, Trelew',           '0280-4423344', 'admin@plasticosdelsur.com', 'Plásticos', 'activa',   '2021-11-20') returning id into emp3;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion) values
    ('Servicios Petroleros CR S.A.',    '30-71040404-4', 'Parque Ind. Pesado, Comodoro',     '0297-4567890', 'rrhh@servpetcr.com',        'Servicios petroleros', 'activa', '2015-05-10') returning id into emp4;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion) values
    ('Alimentos Andinos S.R.L.',        '30-71050505-5', 'Ruta 259 km 4, Trevelin',          '02945-480123', 'ventas@alimentosandinos.com','Alimentos', 'activa',   '2022-02-14') returning id into emp5;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion) values
    ('Maderera Cordillera S.A.',        '30-71060606-6', 'Av. San Martín 2300, Trelew',      '0280-4498877', 'info@madcordillera.com',    'Madera', 'inactiva',  '2016-09-30') returning id into emp6;

  -- ── Parcelas ──
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada) values
    (pm_pesado,   'Mz. A Parc. 1', 5000, 'operativa',      emp1, '2019-06-01', true)  returning id into pc1;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada) values
    (pm_pesquero, 'Mz. C Parc. 8', 8200, 'operativa',      emp2, '2017-10-15', true)  returning id into pc2;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada) values
    (tw_pesado,   'Mz. 4 Parc. 3', 3500, 'desarrollo',     emp3, '2021-12-05', false) returning id into pc3;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada) values
    (cr_pesado,   'Mz. 2 Parc. 7', 6400, 'incumplimiento', emp4, '2015-07-01', false) returning id into pc4;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada) values
    (pm_liviano,  'Mz. B Parc. 2', 2800, 'escriturada',    emp1, '2018-04-20', true)  returning id into pc5;
  insert into parcelas (parque_id, identificacion, superficie, estado) values
    (pm_liviano,  'Mz. B Parc. 3', 2800, 'libre')  returning id into pc6;
  insert into parcelas (parque_id, identificacion, superficie, estado) values
    (tw_pesado,   'Mz. 4 Parc. 4', 3500, 'libre')  returning id into pc7;

  -- ── Expedientes (el trigger genera las etapas; luego avanzamos algunos) ──

  -- 1) Adjudicación EN TRÁMITE (avanzado hasta Inspección)
  insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, plazo_vencimiento, observaciones)
    values (901, 2026, t_adj, emp3, pc3, 'en_tramite', current_date - 40, current_date + 12, 'Adjudicación de parcela para planta de reciclado.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-40, fecha_salida=current_date-30 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-30, fecha_salida=current_date-18 where expediente_id=ex and orden=2;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-18, fecha_salida=current_date-8  where expediente_id=ex and orden=3;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-8 where expediente_id=ex and orden=4;

  -- 2) Transferencia VENCIDA (plazo pasado)
  insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, plazo_vencimiento, observaciones)
    values (902, 2026, t_transf, emp1, pc1, 'en_tramite', current_date - 60, current_date - 9, 'Transferencia de titularidad. Pendiente firma.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-60, fecha_salida=current_date-50 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-50, fecha_salida=current_date-35 where expediente_id=ex and orden=2;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-35 where expediente_id=ex and orden=3;

  -- 3) Hipoteca SIN MOVIMIENTO (updated_at viejo)
  insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, updated_at, observaciones)
    values (903, 2026, t_hip, emp2, pc2, 'en_tramite', current_date - 70, now() - interval '52 days', 'Constitución de hipoteca con entidad bancaria.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-70, fecha_salida=current_date-60 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-60 where expediente_id=ex and orden=2;

  -- 4) Comodato FINALIZADO
  insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, observaciones)
    values (904, 2025, t_com, emp5, pc7, 'finalizado', '2025-09-01', 'Comodato formalizado.') returning id into ex;
  update expediente_etapas set estado='completada' where expediente_id=ex;

  -- 5) Adjudicación RECIÉN INICIADA (en término)
  insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, plazo_vencimiento, observaciones)
    values (905, 2026, t_adj, emp5, pc6, 'iniciado', current_date - 3, current_date + 45, 'Solicitud de adjudicación para depósito.') returning id into ex;

  -- 6) Escrituración EN TRÁMITE
  insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, plazo_vencimiento, observaciones)
    values (906, 2026, t_escr, emp1, pc5, 'en_tramite', current_date - 20, current_date + 5, 'Escrituración traslativa de dominio.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-20, fecha_salida=current_date-10 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-10 where expediente_id=ex and orden=2;

  -- ── Inspecciones ──
  insert into inspecciones (parcela_id, empresa_id, fecha_programada, estado, inspector, observaciones) values
    (pc4, emp4, current_date - 5, 'programada', 'Ing. R. Gómez', 'Verificar incumplimiento de obra.'),
    (pc3, emp3, current_date + 3, 'programada', 'Ing. L. Fernández', 'Inspección de avance de obra.'),
    (pc1, emp1, current_date - 30, 'realizada',  'Ing. R. Gómez', 'Planta operativa, sin observaciones.'),
    (pc2, emp2, current_date - 12, 'observada',  'Ing. L. Fernández', 'Faltan matafuegos señalizados.');

  raise notice 'Datos demo cargados correctamente.';
end $$;

-- Recalcular alertas con los datos nuevos.
select fn_generar_alertas();
