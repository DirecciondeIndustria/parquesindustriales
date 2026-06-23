-- ════════════════════════════════════════════════════════════════
--  SIGPIP — Fase 2: Flujos de trámite + instanciación automática
--  Define las etapas de cada tipo de trámite (Mód. 5) y hace que al
--  crear un expediente se generen sus etapas automáticamente.
-- ════════════════════════════════════════════════════════════════

-- Limpiar definiciones previas (re-ejecutable).
delete from etapas_definicion;

-- Helper local para insertar etapas por nombre de tipo de trámite.
do $$
declare
  t_id uuid;
begin
  -- ── Adjudicación ──
  select id into t_id from tipos_tramite where nombre = 'Adjudicación';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud inicial', 10),
    (t_id, 2, 'Recepción documental', 15),
    (t_id, 3, 'Evaluación técnica', 20),
    (t_id, 4, 'Inspección', 15),
    (t_id, 5, 'Dictamen', 15),
    (t_id, 6, 'Proyecto de Decreto', 20),
    (t_id, 7, 'Firma', 15),
    (t_id, 8, 'Adjudicación', null);

  -- ── Transferencia ──
  select id into t_id from tipos_tramite where nombre = 'Transferencia';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud', 10),
    (t_id, 2, 'Verificación documental', 15),
    (t_id, 3, 'Evaluación', 20),
    (t_id, 4, 'Inspección', 15),
    (t_id, 5, 'Proyecto de Resolución', 20),
    (t_id, 6, 'Firma', 15),
    (t_id, 7, 'Transferencia aprobada', null);

  -- ── Hipoteca ──
  select id into t_id from tipos_tramite where nombre = 'Hipoteca';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud', 10),
    (t_id, 2, 'Documentación bancaria', 20),
    (t_id, 3, 'Informe técnico', 15),
    (t_id, 4, 'Evaluación legal', 20),
    (t_id, 5, 'Resolución', 15),
    (t_id, 6, 'Firma', null);

  -- ── Comodato ──
  select id into t_id from tipos_tramite where nombre = 'Comodato';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud', 10),
    (t_id, 2, 'Evaluación', 20),
    (t_id, 3, 'Proyecto', 20),
    (t_id, 4, 'Firma', 15),
    (t_id, 5, 'Formalización', null);

  -- ── Flujos genéricos para el resto ──
  select id into t_id from tipos_tramite where nombre = 'Baja';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud / Detección', 10),
    (t_id, 2, 'Evaluación', 20),
    (t_id, 3, 'Proyecto de acto', 20),
    (t_id, 4, 'Firma', null);

  select id into t_id from tipos_tramite where nombre = 'Recuperación de parcela';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Detección de incumplimiento', 10),
    (t_id, 2, 'Intimación', 15),
    (t_id, 3, 'Evaluación', 20),
    (t_id, 4, 'Proyecto de acto', 20),
    (t_id, 5, 'Firma', null);

  select id into t_id from tipos_tramite where nombre = 'Regularización';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud', 10),
    (t_id, 2, 'Verificación documental', 20),
    (t_id, 3, 'Evaluación', 20),
    (t_id, 4, 'Resolución', null);

  select id into t_id from tipos_tramite where nombre = 'Escrituración';
  insert into etapas_definicion (tipo_tramite_id, orden, nombre, plazo_dias) values
    (t_id, 1, 'Solicitud', 10),
    (t_id, 2, 'Documentación dominial', 20),
    (t_id, 3, 'Informe legal', 20),
    (t_id, 4, 'Escribanía', 30),
    (t_id, 5, 'Escritura firmada', null);
end $$;

-- ─── Al crear un expediente, generar sus etapas según el tipo ───
create or replace function fn_instanciar_etapas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo_tramite_id is not null then
    insert into expediente_etapas (expediente_id, orden, nombre, estado, fecha_entrada)
    select new.id, ed.orden, ed.nombre,
           case when ed.orden = 1 then 'en_curso' else 'pendiente' end,
           case when ed.orden = 1 then now() else null end
    from etapas_definicion ed
    where ed.tipo_tramite_id = new.tipo_tramite_id
    order by ed.orden;
  end if;
  return new;
end $$;

drop trigger if exists trg_instanciar on expedientes;
create trigger trg_instanciar after insert on expedientes
  for each row execute function fn_instanciar_etapas();
