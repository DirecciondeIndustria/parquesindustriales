// ════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN — App de Inspecciones (mobile)
//  Conectada al MISMO proyecto Supabase del SIGPIP. Las actas confirmadas
//  se guardan en la tabla `actas_inspeccion`; el SIGPIP de escritorio las
//  muestra de forma informativa. La clave anon es pública (la misma que
//  usa el frontend del SIGPIP) — RLS protege los datos.
// ════════════════════════════════════════════════════════════════

window.APP_CONFIG = {
  SUPABASE_URL: "https://ogtwpaxpyjhhcykfptep.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndHdwYXhweWpoaGN5a2ZwdGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzkxODYsImV4cCI6MjA5Nzc1NTE4Nn0.4S-FM2A5RH5SwoBc7t8Afwg-C3NHK2X9ATGgrK9VKbc",
  TABLA_ACTAS: "actas_inspeccion",
  REQUIERE_LOGIN: true,
  NUMERACION: "anio"
};
