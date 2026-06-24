-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 15b: la aceptación de notificación digital es irrevocable
--  desde el portal. La empresa puede ACTIVARLA (una vez), pero NO puede
--  desactivarla por sistema: para revocar debe presentar nota firmada en
--  Mesa de Entrada y la Dirección la da de baja (desde Empresas).
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create or replace function portal_set_notif_email(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  v_emp := empresa_de_acceso(auth.uid());
  if v_emp is null then
    raise exception 'No autorizado.';
  end if;
  if not p_valor then
    raise exception 'Para revocar la notificación digital debe presentar nota firmada en Mesa de Entrada del Ministerio de Producción.';
  end if;
  update empresas set notif_email = true where id = v_emp;
end $$;
