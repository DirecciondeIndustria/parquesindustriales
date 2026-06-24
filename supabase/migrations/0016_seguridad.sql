-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 11: Endurecimiento de seguridad (defensa en profundidad)
--
--  Problema principal corregido: hasta ahora cualquier sesión autenticada
--  (incluso una cuenta creada por fuera del alta de admin, o una cuenta
--  desactivada) podía LEER toda la base, porque las políticas de lectura
--  exigían solo `auth.uid() is not null`.
--
--  Ahora TODO acceso (lectura y escritura) exige tener un perfil de
--  usuario ACTIVO en la tabla `usuarios`. Una cuenta sin perfil, o un
--  usuario desactivado, no puede leer ni escribir absolutamente nada.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

-- ── Helper: ¿el llamante es un usuario con perfil activo? ──
create or replace function es_usuario_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios where id = auth.uid() and activo)
$$;
grant execute on function es_usuario_activo() to authenticated;

-- ── El rol solo cuenta si el usuario está activo (corta a los desactivados) ──
create or replace function current_rol()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from usuarios where id = auth.uid() and activo
$$;

-- ── Mesa de entrada: rol archivo activo, o delegación activa a un usuario activo ──
create or replace function es_mesa_entrada(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from usuarios where id = uid and rol = 'archivo' and activo)
    or exists (
      select 1 from delegaciones_mesa d
      join usuarios u on u.id = d.a_usuario and u.activo
      where d.a_usuario = uid and not d.revocada
        and current_date >= d.desde and (d.hasta is null or current_date <= d.hasta)
    )
$$;

-- ── Toda LECTURA exige perfil activo (reemplaza `auth.uid() is not null`) ──
do $$
declare r text; tbl text; pol text;
begin
  foreach r in array array[
    'parques_industriales|parques_industriales_sel',
    'empresas|empresas_sel',
    'parcelas|parcelas_sel',
    'tipos_tramite|tipos_tramite_sel',
    'etapas_definicion|etapas_definicion_sel',
    'expedientes|expedientes_sel',
    'expediente_etapas|expediente_etapas_sel',
    'subtramites_definicion|subtramites_definicion_sel',
    'expediente_subtramites|expediente_subtramites_sel',
    'documentos|documentos_sel',
    'inspecciones|inspecciones_sel',
    'archivo_fisico|archivo_fisico_sel',
    'alertas|alertas_sel',
    'siglas_ministerio|siglas_sel',
    'delegaciones_mesa|deleg_sel',
    'derivaciones|deriv_sel',
    'custodia_movimientos|custodia_sel',
    'auditoria|auditoria_sel',
    'usuarios|usuarios_sel'
  ] loop
    tbl := split_part(r, '|', 1); pol := split_part(r, '|', 2);
    execute format('drop policy if exists %I on %I', pol, tbl);
    execute format('create policy %I on %I for select using (es_usuario_activo())', pol, tbl);
  end loop;
end $$;

-- ── La escritura de alertas (marcar leída) también exige perfil activo ──
drop policy if exists alertas_upd on alertas;
create policy alertas_upd on alertas for update using (es_usuario_activo());

-- ── Storage de documentos: leer = usuario activo; subir/borrar = gestión ──
drop policy if exists "doc_sel" on storage.objects;
drop policy if exists "doc_ins" on storage.objects;
drop policy if exists "doc_del" on storage.objects;
create policy "doc_sel" on storage.objects for select
  using (bucket_id = 'documentos' and es_usuario_activo());
create policy "doc_ins" on storage.objects for insert
  with check (bucket_id = 'documentos' and puede_editar());
create policy "doc_del" on storage.objects for delete
  using (bucket_id = 'documentos' and puede_editar());

-- ── Recalcular alertas: lo dispara cron (uid nulo) o un usuario activo ──
create or replace function fn_generar_alertas()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not es_usuario_activo() then
    raise exception 'No autorizado.';
  end if;

  delete from alertas where automatica = true and leida = false;

  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'vencimiento', 'alta',
         'Expediente ' || e.numero || '/' || e.anio || ': plazo vencido hace ' ||
           (current_date - e.plazo_vencimiento) || ' día(s).', e.id, 'parques'
  from expedientes e
  where e.plazo_vencimiento is not null and e.plazo_vencimiento < current_date
    and e.estado not in ('finalizado', 'archivado', 'baja');

  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'vencimiento', 'media',
         'Expediente ' || e.numero || '/' || e.anio || ': vence en ' ||
           (e.plazo_vencimiento - current_date) || ' día(s).', e.id, 'parques'
  from expedientes e
  where e.plazo_vencimiento is not null
    and e.plazo_vencimiento >= current_date
    and e.plazo_vencimiento <= current_date + 7
    and e.estado not in ('finalizado', 'archivado', 'baja');

  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'sin_movimiento', 'alta',
         'Expediente ' || e.numero || '/' || e.anio || ': sin movimiento hace ' ||
           extract(day from now() - e.updated_at)::int || ' días.', e.id, 'parques'
  from expedientes e
  where e.updated_at < now() - interval '45 days'
    and e.estado not in ('finalizado', 'archivado', 'baja');

  insert into alertas (tipo, severidad, mensaje, expediente_id, destinatario_rol)
  select 'inspeccion', 'media',
         'Inspección pendiente de ejecución' ||
           coalesce(' (programada ' || to_char(i.fecha_programada, 'DD/MM/YYYY') || ')', '') || '.',
         i.expediente_id, 'inspector'
  from inspecciones i
  where i.estado in ('pendiente', 'programada')
    and (i.fecha_programada is null or i.fecha_programada < current_date);
end $$;

grant execute on function fn_generar_alertas() to authenticated;
