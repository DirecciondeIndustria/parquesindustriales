-- ════════════════════════════════════════════════════════════════
--  SIGPIP — RESET de datos de demostración
--  ⚠️ BORRA TODOS los datos de negocio (empresas, parcelas, expedientes,
--     inspecciones, documentos, derivaciones, custodia, alertas, auditoría)
--     y carga un set nuevo CON los campos nuevos (sigla, n° de fichero,
--     poseedor/custodia).
--  MANTIENE: usuarios, siglas del Ministerio, tipos de trámite y las
--     plantillas de hitos/requisitos.
--  Ejecutar en Supabase → SQL Editor. Requiere migraciones 0001–0015 aplicadas.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Borrar datos de negocio ──
delete from derivaciones;
delete from custodia_movimientos;
delete from inspecciones;
delete from documentos;
delete from alertas;
delete from archivo_fisico;
delete from expedientes;          -- cascada: expediente_etapas, expediente_subtramites, custodia
delete from parcelas;
delete from empresas;
delete from parques_industriales;
truncate table auditoria restart identity;

-- ── 2) Cargar datos nuevos ──
do $$
declare
  t_adj uuid; t_transf uuid; t_hip uuid; t_com uuid; t_escr uuid;
  pq1 uuid; pq2 uuid; pq3 uuid;
  emp1 uuid; emp2 uuid; emp3 uuid; emp4 uuid; emp5 uuid;
  pc1 uuid; pc2 uuid; pc3 uuid; pc4 uuid; pc5 uuid; pc6 uuid;
  ex uuid;
  v_sigla text; v_sigla_old text;
  v_users uuid[]; u1 uuid; u2 uuid; u3 uuid;
begin
  -- Sigla vigente (y una histórica si existe) para caratular.
  select sigla into v_sigla from siglas_ministerio where vigente limit 1;
  v_sigla := coalesce(v_sigla, 'MP');
  select sigla into v_sigla_old from siglas_ministerio where not vigente order by orden limit 1;
  v_sigla_old := coalesce(v_sigla_old, v_sigla);

  -- Usuarios reales para asignar la custodia (poseedor del expediente).
  select array_agg(id order by nombre) into v_users from usuarios;
  u1 := v_users[1];
  u2 := coalesce(v_users[2], u1);
  u3 := coalesce(v_users[3], u1);

  select id into t_adj    from tipos_tramite where nombre = 'Adjudicación';
  select id into t_transf from tipos_tramite where nombre = 'Transferencia';
  select id into t_hip    from tipos_tramite where nombre = 'Hipoteca';
  select id into t_com    from tipos_tramite where nombre = 'Comodato';
  select id into t_escr   from tipos_tramite where nombre = 'Escrituración';

  -- ── Parques industriales ──
  insert into parques_industriales (nombre, localidad, superficie, estado)
    values ('Parque Industrial Pesado', 'Puerto Madryn', 120, 'activo') returning id into pq1;
  insert into parques_industriales (nombre, localidad, superficie, estado)
    values ('Parque Industrial Liviano', 'Trelew', 80, 'activo') returning id into pq2;
  insert into parques_industriales (nombre, localidad, superficie, estado)
    values ('Parque Industrial Pesado', 'Comodoro Rivadavia', 150, 'activo') returning id into pq3;

  -- ── Empresas ──
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion)
    values ('Metalúrgica Patagonia S.A.', '30-71010101-1', 'Av. Industrial 1200, Pto. Madryn', '0280-4451200', 'info@metalpatagonia.com.ar', 'Metalurgia', 'activa', '2019-03-12') returning id into emp1;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion)
    values ('Pesquera del Golfo S.R.L.', '30-71020202-2', 'Muelle Storni s/n, Pto. Madryn', '0280-4456789', 'contacto@pesgolfo.com', 'Procesamiento de pescado', 'activa', '2017-08-01') returning id into emp2;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion)
    values ('Plásticos del Sur S.A.', '30-71030303-3', 'Calle 9 N° 450, Trelew', '0280-4423344', 'admin@plasticosdelsur.com', 'Plásticos', 'activa', '2021-11-20') returning id into emp3;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion)
    values ('Servicios Petroleros CR S.A.', '30-71040404-4', 'Parque Ind. Pesado, Comodoro', '0297-4567890', 'rrhh@servpetcr.com', 'Servicios petroleros', 'activa', '2015-05-10') returning id into emp4;
  insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion)
    values ('Alimentos Andinos S.R.L.', '30-71050505-5', 'Ruta 259 km 4, Trevelin', '02945-480123', 'ventas@alimentosandinos.com', 'Alimentos', 'activa', '2022-02-14') returning id into emp5;

  -- ── Parcelas ──
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada)
    values (pq1, 'Mz. A Parc. 1', 5000, 'operativa', emp1, '2019-06-01', true) returning id into pc1;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada)
    values (pq1, 'Mz. C Parc. 8', 8200, 'operativa', emp2, '2017-10-15', true) returning id into pc2;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada)
    values (pq2, 'Mz. 4 Parc. 3', 3500, 'desarrollo', emp3, '2021-12-05', false) returning id into pc3;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada)
    values (pq3, 'Mz. 2 Parc. 7', 6400, 'incumplimiento', emp4, '2015-07-01', false) returning id into pc4;
  insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada)
    values (pq2, 'Mz. B Parc. 2', 2800, 'operativa', emp5, '2022-03-20', false) returning id into pc5;
  insert into parcelas (parque_id, identificacion, superficie, estado)
    values (pq2, 'Mz. B Parc. 3', 2800, 'libre') returning id into pc6;

  -- ── Expedientes (con sigla, n° de fichero y custodia) ──
  -- 1) Adjudicación en trámite — en poder de u1
  insert into expedientes (numero, anio, sigla, numero_fichero, tipo_tramite_id, empresa_id, parcela_id, estado, poseedor_actual, fecha_inicio, plazo_vencimiento, observaciones)
    values (1024, 2026, v_sigla, 'F-101', t_adj, emp1, pc1, 'en_tramite', u1, current_date - 40, current_date + 12, 'Adjudicación de parcela para ampliación de planta.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-40, fecha_salida=current_date-30 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-30, fecha_salida=current_date-18 where expediente_id=ex and orden=2;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-18 where expediente_id=ex and orden=3;
  insert into custodia_movimientos (expediente_id, de_usuario, a_usuario, registrado_por, nota) values (ex, null, u1, u1, 'Salida del archivo para evaluación.');

  -- 2) Transferencia con plazo vencido — en poder de u2
  insert into expedientes (numero, anio, sigla, numero_fichero, tipo_tramite_id, empresa_id, parcela_id, estado, poseedor_actual, fecha_inicio, plazo_vencimiento, observaciones)
    values (1025, 2026, v_sigla, 'F-102', t_transf, emp2, pc2, 'en_tramite', u2, current_date - 60, current_date - 9, 'Transferencia de titularidad. Pendiente firma.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-60, fecha_salida=current_date-45 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-45 where expediente_id=ex and orden=2;
  insert into custodia_movimientos (expediente_id, de_usuario, a_usuario, registrado_por, nota) values (ex, null, u2, u1, 'Entregado para análisis técnico.');

  -- 3) Hipoteca sin movimiento — en poder de u1
  insert into expedientes (numero, anio, sigla, numero_fichero, tipo_tramite_id, empresa_id, parcela_id, estado, poseedor_actual, fecha_inicio, updated_at, observaciones)
    values (987, 2026, v_sigla, 'F-103', t_hip, emp3, pc3, 'en_tramite', u1, current_date - 70, now() - interval '52 days', 'Constitución de hipoteca con entidad bancaria.') returning id into ex;
  update expediente_etapas set estado='en_curso', fecha_entrada=current_date-70 where expediente_id=ex and orden=1;
  insert into custodia_movimientos (expediente_id, de_usuario, a_usuario, registrado_por, nota) values (ex, null, u1, u1, 'Salida del archivo.');

  -- 4) Comodato FINALIZADO con sigla histórica — en el archivo
  insert into expedientes (numero, anio, sigla, numero_fichero, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, observaciones)
    values (500, 2024, v_sigla_old, 'F-080', t_com, emp4, pc4, 'finalizado', '2024-09-01', 'Comodato formalizado (expediente histórico).') returning id into ex;
  update expediente_etapas set estado='completada' where expediente_id=ex;

  -- 5) Adjudicación recién iniciada — en poder de u3
  insert into expedientes (numero, anio, sigla, numero_fichero, tipo_tramite_id, empresa_id, parcela_id, estado, poseedor_actual, fecha_inicio, plazo_vencimiento, observaciones)
    values (1030, 2026, v_sigla, 'F-104', t_adj, emp5, pc5, 'iniciado', u3, current_date - 3, current_date + 45, 'Solicitud de adjudicación para depósito.') returning id into ex;
  insert into custodia_movimientos (expediente_id, de_usuario, a_usuario, registrado_por, nota) values (ex, null, u3, u1, 'Entregado para caratular.');

  -- 6) Escrituración en trámite — en el archivo
  insert into expedientes (numero, anio, sigla, numero_fichero, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, plazo_vencimiento, observaciones)
    values (1031, 2026, v_sigla, 'F-105', t_escr, emp1, pc1, 'en_tramite', current_date - 20, current_date + 5, 'Escrituración traslativa de dominio.') returning id into ex;
  update expediente_etapas set estado='completada', fecha_entrada=current_date-20, fecha_salida=current_date-10 where expediente_id=ex and orden=1;
  update expediente_etapas set estado='en_curso',   fecha_entrada=current_date-10 where expediente_id=ex and orden=2;

  -- ── Inspecciones (cruzadas a expediente) ──
  insert into inspecciones (expediente_id, parcela_id, empresa_id, fecha_programada, estado, inspector, observaciones)
    select e.id, pc3, emp3, current_date + 3, 'programada', 'Ing. L. Fernández', 'Inspección de avance de obra.' from expedientes e where e.numero=987 and e.anio=2026;
  insert into inspecciones (parcela_id, empresa_id, fecha_programada, estado, inspector, observaciones)
    values (pc4, emp4, current_date - 5, 'programada', 'Ing. R. Gómez', 'Verificar incumplimiento de obra.'),
           (pc1, emp1, current_date - 30, 'realizada', 'Ing. R. Gómez', 'Planta operativa, sin observaciones.');

  -- ── Derivaciones de mesa de entrada (pendientes) ──
  insert into derivaciones (tipo_documental, descripcion, empresa_id, expediente_id, de_usuario, a_usuario, estado, nota)
    select 'Plano de obra', 'Planos de obra de ampliación', emp1, e.id, u1, u2, 'pendiente', 'Revisar y emitir dictamen técnico.'
    from expedientes e where e.numero=1024 and e.anio=2026;
  insert into derivaciones (tipo_documental, descripcion, empresa_id, de_usuario, a_usuario, estado, nota)
    values ('Nota', 'Nota de pronto despacho presentada por la empresa', emp5, u1, u3, 'pendiente', 'Adjuntar al expediente.');

  raise notice 'Reset completo: datos nuevos cargados.';
end $$;

-- Recalcular alertas con los datos nuevos.
select fn_generar_alertas();
