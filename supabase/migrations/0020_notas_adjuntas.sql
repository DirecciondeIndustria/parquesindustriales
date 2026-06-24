-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 15: Notas con archivo adjunto + opt-in de la empresa
--  · La oficina adjunta el PDF de la nota al hito en curso.
--  · La empresa (si optó por la vía digital) ve/descarga la nota desde
--    el portal y ve los requisitos que se le piden para avanzar.
--  · La empresa puede activar/desactivar la recepción digital.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- Opt-in de la empresa a recibir notas por el portal (además del postal).
alter table empresas add column if not exists notif_email boolean not null default false;

-- La nota se cuelga de un hito y puede llevar un archivo adjunto.
alter table notas_empresa add column if not exists expediente_etapa_id uuid references expediente_etapas (id) on delete set null;
alter table notas_empresa add column if not exists storage_path  text;
alter table notas_empresa add column if not exists nombre_archivo text;

-- ── Bucket privado para las notas ──
insert into storage.buckets (id, name, public) values ('notas', 'notas', false)
on conflict (id) do nothing;

-- Storage RLS: la oficina sube/borra; lee la oficina o la empresa dueña
-- (el primer "folder" del path es el empresa_id).
drop policy if exists "notas_files_sel" on storage.objects;
drop policy if exists "notas_files_ins" on storage.objects;
drop policy if exists "notas_files_del" on storage.objects;
create policy "notas_files_sel" on storage.objects for select using (
  bucket_id = 'notas' and (
    es_usuario_activo()
    or (storage.foldername(name))[1] = empresa_de_acceso(auth.uid())::text
  )
);
create policy "notas_files_ins" on storage.objects for insert with check (bucket_id = 'notas' and puede_editar());
create policy "notas_files_del" on storage.objects for delete using (bucket_id = 'notas' and puede_editar());

-- ── La empresa puede optar (o no) por la recepción digital, desde el portal ──
create or replace function portal_set_notif_email(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  v_emp := empresa_de_acceso(auth.uid());
  if v_emp is null then raise exception 'No autorizado.'; end if;
  update empresas set notif_email = p_valor where id = v_emp;
end $$;
grant execute on function portal_set_notif_email(boolean) to authenticated;

-- ── Vistas del portal actualizadas ──
drop view if exists portal_empresa;
create view portal_empresa as
  select e.id, e.razon_social, e.email, e.notif_email
  from empresas e
  where e.id = empresa_de_acceso(auth.uid());

drop view if exists portal_notas;
create view portal_notas as
  select n.id, n.expediente_id, n.expediente_etapa_id, n.numero_nota, n.asunto, n.fecha,
         n.storage_path, n.nombre_archivo
  from notas_empresa n
  where n.empresa_id = empresa_de_acceso(auth.uid());

grant select on portal_empresa, portal_notas to authenticated;
