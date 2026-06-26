-- ════════════════════════════════════════════════════════════════
--  SIGPIP / App de actas — Cancelar co-inspección en curso
--  Si el Agente 1 descarta el acta en curso (o empieza otra), se cierra
--  la designación sin guardar y se borran las fotos del borrador, para
--  que al Agente 2 le desaparezca "Aportar fotos".
--  Correr DESPUÉS de 0028.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create or replace function cancelar_coinspeccion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_draft text;
begin
  select draft_id into v_draft from actas_designaciones
   where id = p_id and inspector1_id = auth.uid();
  if v_draft is null then raise exception 'NO_AUTORIZADO'; end if;
  update actas_designaciones set estado = 'cancelada'
   where id = p_id and estado in ('pendiente', 'aceptada');
  delete from actas_fotos_draft where draft_id = v_draft;
end $$;
grant execute on function cancelar_coinspeccion(uuid) to authenticated;
