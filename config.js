// ════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE LA PLATAFORMA
//  Editá estos dos valores con los datos de tu proyecto Supabase.
//  Instrucciones completas en el archivo SETUP.md
// ════════════════════════════════════════════════════════════════

window.APP_CONFIG = {
  // Pegá aquí la URL de tu proyecto (Settings → API → Project URL)
  SUPABASE_URL: "",

  // Pegá aquí la clave pública "anon" (Settings → API → Project API keys → anon public)
  SUPABASE_ANON_KEY: "",

  // Cómo avanza la numeración: "anio" = correlativo por año (001/2026, 002/2026...)
  NUMERACION: "anio"
};

// Si los dos campos de arriba quedan vacíos, la app funciona en MODO LOCAL
// (guarda las inspecciones solo en este dispositivo). Apenas cargues las
// credenciales de Supabase, pasa automáticamente a MODO ONLINE con base de datos.
