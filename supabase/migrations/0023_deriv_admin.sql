-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 16b: admin/director también pueden derivar
--  Hasta ahora solo la mesa de entrada (rol archivo) podía insertar
--  derivaciones. Con la Mesa de Entradas y Salidas, admin/director
--  derivan desde las entradas registradas. Se amplía la política de
--  INSERT acorde (sigue exigiendo derivar como uno mismo).
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════
do $$
begin
  execute 'drop policy if exists deriv_ins on derivaciones';
  execute 'create policy deriv_ins on derivaciones for insert with check ((es_mesa_entrada() or es_admin()) and de_usuario = auth.uid())';
end $$;
