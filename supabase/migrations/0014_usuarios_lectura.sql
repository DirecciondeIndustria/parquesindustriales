-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 9b: lectura de la lista de usuarios
--  Para delegar mesa de entrada y para derivar documentación hace falta
--  ver al resto de los agentes. Permitimos que cualquier usuario
--  autenticado LEA la lista de usuarios. La creación/edición sigue
--  siendo exclusiva del admin (políticas de insert/update sin cambios).
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

drop policy if exists usuarios_sel on usuarios;
create policy usuarios_sel on usuarios for select using (auth.uid() is not null);
