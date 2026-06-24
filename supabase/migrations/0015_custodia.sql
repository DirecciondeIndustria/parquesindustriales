-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 10: Custodia física de expedientes (ficheros)
--  Cada EXPEDIENTE tiene su número de fichero. Se controla quién lo
--  tiene en su poder (o si está en el archivo) y el "pasamano":
--   · Solo la mesa de entrada da SALIDA del archivo.
--   · Después, solo quien lo tiene en su poder puede pasarlo a otro.
--   · Nadie puede auto-asignarse un expediente que no tiene.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

alter table expedientes add column if not exists numero_fichero  text;
-- poseedor_actual null = el expediente está en el archivo (en su fichero).
alter table expedientes add column if not exists poseedor_actual uuid references usuarios (id) on delete set null;

-- ── Historial de movimientos (ruta interna del expediente) ──
create table if not exists custodia_movimientos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references expedientes (id) on delete cascade,
  de_usuario     uuid references usuarios (id) on delete set null,   -- null = desde el archivo
  a_usuario      uuid references usuarios (id) on delete set null,   -- null = devuelto al archivo
  registrado_por uuid references usuarios (id) on delete set null,
  nota           text,
  fecha          timestamptz not null default now()
);
create index if not exists idx_custodia_exp on custodia_movimientos (expediente_id);

-- ── RPC: mover / entregar un expediente (con las reglas de custodia) ──
create or replace function mover_expediente(p_exp uuid, p_a_usuario uuid, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actual uuid;
begin
  select poseedor_actual into v_actual from expedientes where id = p_exp;

  if p_a_usuario is not distinct from v_actual then
    raise exception 'El expediente ya está en esa ubicación.';
  end if;

  if v_actual is null then
    -- Está en el archivo: solo la mesa de entrada lo saca, y hacia un agente.
    if not es_mesa_entrada() then
      raise exception 'Solo la mesa de entrada puede dar salida de un expediente del archivo.';
    end if;
    if p_a_usuario is null then
      raise exception 'Indicá a qué agente se le entrega el expediente.';
    end if;
  else
    -- En circulación: solo quien lo tiene (o admin) puede moverlo;
    -- devolverlo al archivo también lo puede hacer la mesa de entrada.
    if not (auth.uid() = v_actual or es_admin() or (p_a_usuario is null and es_mesa_entrada())) then
      raise exception 'No podés mover un expediente que no está en tu poder.';
    end if;
  end if;

  insert into custodia_movimientos (expediente_id, de_usuario, a_usuario, registrado_por, nota)
  values (p_exp, v_actual, p_a_usuario, auth.uid(), p_nota);

  update expedientes set poseedor_actual = p_a_usuario where id = p_exp;
end $$;

grant execute on function mover_expediente(uuid, uuid, text) to authenticated;

-- ── RLS: todos leen la ruta interna; los movimientos se hacen por RPC ──
alter table custodia_movimientos enable row level security;
drop policy if exists custodia_sel on custodia_movimientos;
create policy custodia_sel on custodia_movimientos for select using (auth.uid() is not null);

-- Auditar los movimientos de custodia.
drop trigger if exists trg_aud_custodia on custodia_movimientos;
create trigger trg_aud_custodia
  after insert or update or delete on custodia_movimientos
  for each row execute function fn_auditoria();
