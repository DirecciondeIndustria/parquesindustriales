-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Carga masiva de datos de demostración
--  ~40 empresas, ~120 parcelas, 160 expedientes, ~60 inspecciones.
--  Idempotente: si ya hay >100 expedientes, no vuelve a cargar.
-- ════════════════════════════════════════════════════════════════
do $$
declare
  parque_ids  uuid[];
  empresa_ids uuid[];
  parcela_ids uuid[];
  tipo_ids    uuid[];
  rubros   text[] := array['Metalúrgica','Pesquera','Plásticos','Alimentos','Maderera','Textil','Química','Logística','Frigorífico','Automotriz','Electrónica','Construcciones','Petroquímica','Reciclados','Cerámica'];
  geos     text[] := array['Patagonia','del Golfo','del Sur','Andina','Atlántica','Chubut','del Valle','Austral','Comodoro','Madryn','Esquel','Rawson'];
  sufijos  text[] := array['S.A.','S.R.L.','S.A.S.','y Cía.'];
  est_par  text[] := array['operativa','desarrollo','incumplimiento','libre','escriturada','operativa','libre','operativa'];
  est_exp  text[] := array['iniciado','en_tramite','en_tramite','en_tramite','finalizado','demorado','archivado'];
  inspectores text[] := array['Ing. R. Gómez','Ing. L. Fernández','Téc. M. Ruiz','Ing. C. Díaz','Téc. A. Sosa'];
  est_insp text[] := array['pendiente','programada','realizada','observada','incumplimiento'];
  i int; nid uuid; cnt int; k int;
  fini date; fv date; upd timestamptz; est text; tt uuid; emp uuid; par uuid;
  ie text; fprog date;
begin
  if (select count(*) from expedientes) > 100 then
    raise notice 'Datos masivos ya cargados; no se duplican.';
    return;
  end if;

  select array_agg(id) into parque_ids from parques_industriales;
  select array_agg(id) into tipo_ids   from tipos_tramite;

  -- ── Empresas (40) ──
  for i in 1..40 loop
    insert into empresas (razon_social, cuit, domicilio, telefono, email, actividad, estado, fecha_radicacion)
    values (
      rubros[(1+floor(random()*array_length(rubros,1)))::int] || ' ' ||
        geos[(1+floor(random()*array_length(geos,1)))::int] || ' ' ||
        sufijos[(1+floor(random()*array_length(sufijos,1)))::int],
      '30-' || (10000000+floor(random()*89999999))::bigint || '-' || floor(random()*9)::int,
      'Parcela industrial s/n',
      '0280-44' || (10000+floor(random()*89999))::int,
      'contacto' || i || '@empresa.com.ar',
      rubros[(1+floor(random()*array_length(rubros,1)))::int],
      case when random() < 0.85 then 'activa' else 'inactiva' end,
      current_date - (floor(random()*3000))::int
    );
  end loop;
  select array_agg(id) into empresa_ids from empresas;

  -- ── Parcelas (120) ──
  for i in 1..120 loop
    est := est_par[(1+floor(random()*array_length(est_par,1)))::int];
    insert into parcelas (parque_id, identificacion, superficie, estado, empresa_id, fecha_adjudicacion, escriturada)
    values (
      parque_ids[(1+floor(random()*array_length(parque_ids,1)))::int],
      'Mz. ' || chr((65+floor(random()*8))::int) || ' Parc. ' || (1+floor(random()*40))::int,
      (1000+floor(random()*9000))::int,
      est::estado_parcela,
      case when est = 'libre' then null else empresa_ids[(1+floor(random()*array_length(empresa_ids,1)))::int] end,
      case when est = 'libre' then null else current_date - (floor(random()*2500))::int end,
      (est = 'escriturada')
    );
  end loop;
  select array_agg(id) into parcela_ids from parcelas;

  -- ── Expedientes (160) ──
  for i in 1..160 loop
    tt  := tipo_ids[(1+floor(random()*array_length(tipo_ids,1)))::int];
    emp := empresa_ids[(1+floor(random()*array_length(empresa_ids,1)))::int];
    par := parcela_ids[(1+floor(random()*array_length(parcela_ids,1)))::int];
    est := est_exp[(1+floor(random()*array_length(est_exp,1)))::int];
    fini := current_date - (10+floor(random()*350))::int;
    fv := case when random() < 0.4 then current_date - (floor(random()*30))::int
               when random() < 0.8 then current_date + (floor(random()*60))::int
               else null end;
    upd := case when random() < 0.25 then now() - ((30+floor(random()*40))::int || ' days')::interval
                else now() - (floor(random()*20)::int || ' days')::interval end;

    insert into expedientes (numero, anio, tipo_tramite_id, empresa_id, parcela_id, estado, fecha_inicio, plazo_vencimiento, updated_at, observaciones)
    values (1000 + i, 2024 + floor(random()*3)::int, tt, emp, par, est::estado_expediente, fini, fv, upd,
            'Expediente de demostración generado automáticamente.')
    returning id into nid;

    -- Avanzar etapas (el trigger ya las creó).
    select count(*) into cnt from expediente_etapas where expediente_id = nid;
    if cnt > 0 then
      if est = 'finalizado' then
        update expediente_etapas set estado = 'completada',
               fecha_entrada = fini, fecha_salida = fini + (floor(random()*40))::int
        where expediente_id = nid;
      else
        k := floor(random()*cnt)::int;  -- cantidad de hitos completados (0..cnt-1)
        if k > 0 then
          update expediente_etapas set estado = 'completada',
                 fecha_entrada = fini, fecha_salida = fini + (floor(random()*30))::int
          where expediente_id = nid and orden <= k;
        end if;
        update expediente_etapas set estado = 'en_curso',
               fecha_entrada = fini + (floor(random()*40))::int
        where expediente_id = nid and orden = k + 1;
      end if;
    end if;
  end loop;

  -- ── Inspecciones (60) ──
  for i in 1..60 loop
    ie := est_insp[(1+floor(random()*array_length(est_insp,1)))::int];
    fprog := current_date - 30 + (floor(random()*60))::int;
    insert into inspecciones (parcela_id, empresa_id, fecha_programada, fecha_realizada, estado, inspector, observaciones)
    values (
      parcela_ids[(1+floor(random()*array_length(parcela_ids,1)))::int],
      empresa_ids[(1+floor(random()*array_length(empresa_ids,1)))::int],
      fprog,
      case when ie in ('realizada','observada','incumplimiento') then fprog else null end,
      ie,
      inspectores[(1+floor(random()*array_length(inspectores,1)))::int],
      'Observaciones de demostración.'
    );
  end loop;

  raise notice 'Datos masivos cargados correctamente.';
end $$;

select fn_generar_alertas();
