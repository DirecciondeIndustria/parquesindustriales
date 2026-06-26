-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Nuevos roles principales (paso 1 de 2)
--  Agrega los valores nuevos al enum rol_usuario. Va en su PROPIA
--  migración porque Postgres no permite usar un valor de enum recién
--  agregado dentro de la misma transacción.
--  CORRER ESTE PRIMERO, solo. Luego correr 0027_roles_modelo.sql.
--  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

alter type rol_usuario add value if not exists 'jefe_departamento';
alter type rol_usuario add value if not exists 'mesa_entrada';
alter type rol_usuario add value if not exists 'tecnico_administrativo';
