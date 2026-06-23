-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 6: Avance automático y ordenado + número de foja
--  · El estado de los hitos ya NO se edita a mano: avanza solo cuando
--    se completan los requisitos OBLIGATORIOS del hito en curso.
--  · Se agrega foja (desde/hasta) por requisito para ubicar cada
--    documento en el expediente físico.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ── Foja de cada requisito (ubicación en el expediente físico) ──
alter table expediente_subtramites
  add column if not exists foja_desde int,
  add column if not exists foja_hasta int;

-- ── Avance automático: al completar los obligatorios de la etapa en
--    curso, se cierra y se abre la siguiente. No autofinaliza el último
--    hito (eso queda como acción explícita de cierre). ──
create or replace function fn_autoavance_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_exp   uuid;
  v_etapa expediente_etapas;
  v_next  expediente_etapas;
  v_oblig int;
  v_pend  int;
begin
  -- Solo nos interesa cuando un requisito pasa a "completado".
  if tg_op = 'UPDATE' and new.completado is not distinct from old.completado then
    return new;
  end if;
  if not new.completado then
    return new;
  end if;

  select ee.expediente_id into v_exp
  from expediente_etapas ee where ee.id = new.expediente_etapa_id;

  loop
    select * into v_etapa from expediente_etapas
    where expediente_id = v_exp and estado = 'en_curso'
    order by orden limit 1;
    exit when v_etapa.id is null;

    select count(*) filter (where obligatorio) into v_oblig
    from expediente_subtramites where expediente_etapa_id = v_etapa.id;
    select count(*) into v_pend
    from expediente_subtramites
    where expediente_etapa_id = v_etapa.id and obligatorio and not completado;

    -- Avanza solo si el hito tiene obligatorios y están todos cumplidos.
    exit when v_oblig = 0 or v_pend > 0;

    select * into v_next from expediente_etapas
    where expediente_id = v_exp and orden = v_etapa.orden + 1 limit 1;
    exit when v_next.id is null;   -- último hito: no se autofinaliza

    update expediente_etapas set estado = 'completada', fecha_salida = now() where id = v_etapa.id;
    update expediente_etapas set estado = 'en_curso',  fecha_entrada = now() where id = v_next.id;
    update expedientes        set estado = 'en_tramite' where id = v_exp;
  end loop;

  return new;
end $$;

drop trigger if exists trg_autoavance on expediente_subtramites;
create trigger trg_autoavance
  after insert or update on expediente_subtramites
  for each row execute function fn_autoavance_etapa();

-- ── Corrección controlada: reabrir la etapa anterior (un paso atrás) ──
--    Único modo de "volver"; no se puede editar el estado libremente.
create or replace function reabrir_etapa(p_exp uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_actual expediente_etapas; v_prev expediente_etapas;
begin
  if not puede_editar() then
    raise exception 'No tenés permisos para reabrir la etapa.';
  end if;

  select * into v_actual from expediente_etapas
  where expediente_id = p_exp and estado = 'en_curso'
  order by orden limit 1;

  -- Expediente cerrado (sin etapa en curso): reabrir el último hito.
  if v_actual.id is null then
    select * into v_actual from expediente_etapas
    where expediente_id = p_exp order by orden desc limit 1;
    if v_actual.id is null then raise exception 'El expediente no tiene etapas.'; end if;
    update expediente_etapas set estado = 'en_curso', fecha_salida = null where id = v_actual.id;
    update expedientes set estado = 'en_tramite' where id = p_exp;
    return;
  end if;

  -- Reabrir la etapa previa completada y dejar la actual pendiente.
  select * into v_prev from expediente_etapas
  where expediente_id = p_exp and orden < v_actual.orden and estado = 'completada'
  order by orden desc limit 1;
  if v_prev.id is null then
    raise exception 'No hay una etapa anterior para reabrir.';
  end if;

  update expediente_etapas set estado = 'pendiente', fecha_entrada = null where id = v_actual.id;
  update expediente_etapas set estado = 'en_curso',  fecha_salida  = null where id = v_prev.id;
  update expedientes set estado = 'en_tramite' where id = p_exp;
end $$;

grant execute on function reabrir_etapa(uuid) to authenticated;
