-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 5: Bloqueo de hitos y requisitos
--  La hoja de ruta pasa a ser un control real: no se puede avanzar ni
--  finalizar un expediente con requisitos OBLIGATORIOS pendientes, y
--  solo se pueden marcar los requisitos de la etapa EN CURSO (fuerza el
--  orden por hito). El control vive en la base: no se puede saltar ni
--  editando los datos a mano.
--  Re-ejecutable (create or replace / drop if exists).
-- ════════════════════════════════════════════════════════════════

-- ── Helper: obligatorios pendientes de una etapa ──
create or replace function etapa_obligatorios_pendientes(p_etapa uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from expediente_subtramites
  where expediente_etapa_id = p_etapa and obligatorio and not completado
$$;

grant execute on function etapa_obligatorios_pendientes(uuid) to authenticated;

-- ── RPC: avanzar / finalizar un expediente con validación atómica ──
create or replace function avanzar_expediente(p_exp uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actual    expediente_etapas;
  v_siguiente expediente_etapas;
  v_faltan    text;
  v_pend      int;
begin
  if not puede_editar() then
    raise exception 'No tenés permisos para avanzar el trámite.';
  end if;

  -- Etapa en curso del expediente.
  select * into v_actual
  from expediente_etapas
  where expediente_id = p_exp and estado = 'en_curso'
  order by orden
  limit 1;

  if v_actual.id is null then
    raise exception 'El expediente no tiene una etapa en curso.';
  end if;

  -- ¿Quedan requisitos obligatorios pendientes en la etapa actual?
  select string_agg(nombre, ', ') into v_faltan
  from expediente_subtramites
  where expediente_etapa_id = v_actual.id and obligatorio and not completado;

  if v_faltan is not null then
    raise exception 'No se puede avanzar la etapa "%": faltan requisitos obligatorios: %',
      v_actual.nombre, v_faltan;
  end if;

  -- Completar la etapa actual.
  update expediente_etapas
    set estado = 'completada', fecha_salida = now()
    where id = v_actual.id;

  -- ¿Hay etapa siguiente?
  select * into v_siguiente
  from expediente_etapas
  where expediente_id = p_exp and orden = v_actual.orden + 1
  limit 1;

  if v_siguiente.id is not null then
    update expediente_etapas
      set estado = 'en_curso', fecha_entrada = now()
      where id = v_siguiente.id;
    update expedientes set estado = 'en_tramite' where id = p_exp;
  else
    -- Finalizar: defensa adicional (no debería haber pendientes a esta altura).
    select count(*) into v_pend
    from expediente_etapas
    where expediente_id = p_exp and estado <> 'completada';
    if v_pend > 0 then
      raise exception 'No se puede finalizar: hay etapas sin completar.';
    end if;

    select count(*) into v_pend
    from expediente_subtramites es
    join expediente_etapas ee on ee.id = es.expediente_etapa_id
    where ee.expediente_id = p_exp and es.obligatorio and not es.completado;
    if v_pend > 0 then
      raise exception 'No se puede finalizar: hay requisitos obligatorios pendientes.';
    end if;

    update expedientes set estado = 'finalizado' where id = p_exp;
  end if;
end $$;

grant execute on function avanzar_expediente(uuid) to authenticated;

-- ── Regla de orden: solo se marcan requisitos de la etapa EN CURSO ──
create or replace function fn_validar_subtramite()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  if new.completado is distinct from old.completado then
    select estado into v_estado
    from expediente_etapas
    where id = new.expediente_etapa_id;

    if v_estado is distinct from 'en_curso' then
      raise exception 'Solo se pueden marcar los requisitos de la etapa en curso.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_subtramite on expediente_subtramites;
create trigger trg_validar_subtramite
  before update on expediente_subtramites
  for each row execute function fn_validar_subtramite();

-- ── Blindaje: no cerrar un expediente con pendientes (cierre manual) ──
create or replace function fn_validar_cierre_expediente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pend int;
begin
  if new.estado in ('finalizado', 'archivado')
     and new.estado is distinct from old.estado then

    select count(*) into v_pend
    from expediente_etapas
    where expediente_id = new.id and estado <> 'completada';
    if v_pend > 0 then
      raise exception 'No se puede cerrar el expediente: hay etapas sin completar.';
    end if;

    select count(*) into v_pend
    from expediente_subtramites es
    join expediente_etapas ee on ee.id = es.expediente_etapa_id
    where ee.expediente_id = new.id and es.obligatorio and not es.completado;
    if v_pend > 0 then
      raise exception 'No se puede cerrar el expediente: hay requisitos obligatorios pendientes.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_cierre on expedientes;
create trigger trg_validar_cierre
  before update on expedientes
  for each row execute function fn_validar_cierre_expediente();
