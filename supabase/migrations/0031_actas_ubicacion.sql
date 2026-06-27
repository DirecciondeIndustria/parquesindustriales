-- ════════════════════════════════════════════════════════════════
--  SIGPIP / Actas de inspección — Ubicación geográfica de la firma
--  Guarda dónde se CONFIRMÓ (registró) el acta: coordenadas tomadas
--  por GPS del celular del inspector al momento de emitir el acta.
--  El SIGPIP de escritorio muestra las coordenadas + imagen satelital.
--  Correr DESPUÉS de 0024.  Re-ejecutable.
-- ════════════════════════════════════════════════════════════════

alter table actas_inspeccion add column if not exists lat           double precision; -- latitud (grados)
alter table actas_inspeccion add column if not exists lng           double precision; -- longitud (grados)
alter table actas_inspeccion add column if not exists geo_precision double precision; -- precisión informada por el GPS (metros)
alter table actas_inspeccion add column if not exists geo_at        timestamptz;       -- momento de la captura

-- Índice para futuras consultas/mapa por ubicación.
create index if not exists idx_actas_geo on actas_inspeccion (lat, lng);

-- Las políticas RLS de 0024 (insert por inspector / select autenticado) ya
-- cubren estas columnas: no hace falta tocarlas.
