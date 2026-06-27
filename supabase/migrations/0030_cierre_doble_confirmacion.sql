-- ════════════════════════════════════════════════════════════════
--  SIGPIP / App de actas — Cierre con doble confirmación (Agente 2)
--  El Agente 1 ya NO puede registrar (emitir) el acta solo: cuando
--  toca "Finalizar", queda una SOLICITUD de cierre. El acta se emite
--  recién cuando el Agente 2 la AUTORIZA desde su propio celular.
--  Todo el flujo pasa por RPC security definer (cada parte solo puede
--  hacer lo suyo). La señal viaja por la base (Realtime) para que no
--  se pierda si a un celular se le corta la señal un momento.
--  Correr DESPUÉS de 0029.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ─────────────── 1) Columnas de cierre en la designación ───────────────
alter table actas_designaciones add column if not exists cierre_solicitado_at timestamptz;
alter table actas_designaciones add column if not exists cierre_aprobado_at   timestamptz;
alter table actas_designaciones add column if not exists cierre_rechazado_at  timestamptz;

-- ─────────────── 2) RPC del flujo de cierre ───────────────

-- Agente 1 SOLICITA el cierre (al tocar "Finalizar"). Reinicia aprobación/rechazo
-- previos por si vuelve a pedirlo después de una corrección.
create or replace function solicitar_cierre_acta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update actas_designaciones
     set cierre_solicitado_at = now(),
         cierre_aprobado_at   = null,
         cierre_rechazado_at  = null
   where id = p_id and inspector1_id = auth.uid() and estado = 'aceptada';
  if not found then raise exception 'NO_AUTORIZADO_O_ESTADO_INVALIDO'; end if;
end $$;

-- Agente 1 CANCELA su propia solicitud de cierre (antes de que el 2 responda).
create or replace function cancelar_cierre_acta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update actas_designaciones
     set cierre_solicitado_at = null,
         cierre_aprobado_at   = null,
         cierre_rechazado_at  = null
   where id = p_id and inspector1_id = auth.uid() and estado = 'aceptada';
  if not found then raise exception 'NO_AUTORIZADO'; end if;
end $$;

-- Agente 2 AUTORIZA la emisión (su "firma" para registrar el acta).
create or replace function autorizar_cierre_acta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update actas_designaciones
     set cierre_aprobado_at  = now(),
         cierre_rechazado_at = null
   where id = p_id and inspector2_id = auth.uid() and estado = 'aceptada'
     and cierre_solicitado_at is not null;
  if not found then raise exception 'NO_AUTORIZADO_O_SIN_SOLICITUD'; end if;
end $$;

-- Agente 2 PIDE REVISAR (rechaza la emisión por ahora). Limpia la solicitud
-- para que el Agente 1 pueda seguir editando y volver a pedirla.
create or replace function rechazar_cierre_acta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update actas_designaciones
     set cierre_rechazado_at  = now(),
         cierre_solicitado_at = null,
         cierre_aprobado_at   = null
   where id = p_id and inspector2_id = auth.uid() and estado = 'aceptada';
  if not found then raise exception 'NO_AUTORIZADO'; end if;
end $$;

grant execute on function solicitar_cierre_acta(uuid) to authenticated;
grant execute on function cancelar_cierre_acta(uuid)  to authenticated;
grant execute on function autorizar_cierre_acta(uuid) to authenticated;
grant execute on function rechazar_cierre_acta(uuid)  to authenticated;

-- Realtime ya está habilitado sobre actas_designaciones (migración 0025).
