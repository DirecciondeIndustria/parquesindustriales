-- ════════════════════════════════════════════════════════════════
--  SIGPIP / App de actas — Fotos compartidas en vivo (co-inspección)
--  Mientras el Agente 1 arma el acta, el Agente 2 (aceptado) puede
--  aportar fotos desde su propio dispositivo. Ambos ven la galería en
--  tiempo real; al firmar, el Agente 1 guarda todas las fotos.
--  Correr DESPUÉS de 0025/0027.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

create table if not exists actas_fotos_draft (
  id           uuid primary key default gen_random_uuid(),
  draft_id     text not null,                         -- borrador del acta (designación)
  autor_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor_nombre text,
  foto         text not null,                          -- data URL comprimida
  created_at   timestamptz not null default now()
);
create index if not exists idx_fotos_draft on actas_fotos_draft (draft_id, created_at);

-- DELETE por realtime necesita el row completo (para borrar la foto en el otro device).
alter table actas_fotos_draft replica identity full;

alter table actas_fotos_draft enable row level security;

drop policy if exists fotos_sel on actas_fotos_draft;
drop policy if exists fotos_ins on actas_fotos_draft;
drop policy if exists fotos_del on actas_fotos_draft;

-- Ver: cualquiera de los dos inspectores de esa designación.
create policy fotos_sel on actas_fotos_draft for select using (
  exists (
    select 1 from actas_designaciones d
    where d.draft_id = actas_fotos_draft.draft_id
      and (d.inspector1_id = auth.uid() or d.inspector2_id = auth.uid())
  )
);

-- Aportar: solo el propio autor y solo mientras la designación esté aceptada.
create policy fotos_ins on actas_fotos_draft for insert with check (
  autor_id = auth.uid()
  and exists (
    select 1 from actas_designaciones d
    where d.draft_id = actas_fotos_draft.draft_id
      and d.estado = 'aceptada'
      and (d.inspector1_id = auth.uid() or d.inspector2_id = auth.uid())
  )
);

-- Borrar: el autor de la foto, o el inspector titular de esa acta.
create policy fotos_del on actas_fotos_draft for delete using (
  autor_id = auth.uid()
  or exists (
    select 1 from actas_designaciones d
    where d.draft_id = actas_fotos_draft.draft_id and d.inspector1_id = auth.uid()
  )
);

-- Cerrar la co-inspección: el titular finaliza la designación y se limpian las
-- fotos del borrador (ya quedaron guardadas dentro del acta).
create or replace function finalizar_designacion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_draft text;
begin
  select draft_id into v_draft from actas_designaciones
   where id = p_id and inspector1_id = auth.uid();
  if v_draft is null then raise exception 'NO_AUTORIZADO'; end if;
  update actas_designaciones set estado = 'finalizada' where id = p_id;
  delete from actas_fotos_draft where draft_id = v_draft;
end $$;
grant execute on function finalizar_designacion(uuid) to authenticated;

-- Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'actas_fotos_draft'
  ) then
    alter publication supabase_realtime add table actas_fotos_draft;
  end if;
end $$;
