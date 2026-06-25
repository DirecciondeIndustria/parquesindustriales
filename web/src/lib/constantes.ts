export const TIPOS_DOCUMENTALES = [
  'Nota', 'Plano de mensura', 'Plano de obra', 'Proyecto industrial',
  'Informe técnico', 'Documentación fiscal', 'Documentación contable',
  'Fotografía', 'Acta de inspección', 'Resolución', 'Decreto',
  'Escritura', 'Contrato', 'Comodato', 'Otro',
];

// ── Mesa de Entradas y Salidas ──
// Tipos de ítem que pueden ingresar a la oficina. Cada uno abre un
// formulario con campos propios (ver ModalEntrada en Documentos.tsx).
export const TIPOS_ENTRADA = [
  'Nota', 'Plano', 'Expediente', 'Notificación de Personal',
  'Correspondencia', 'Proyecto Industrial',
] as const;
export type TipoEntrada = (typeof TIPOS_ENTRADA)[number];

// Instrumentos posibles para una Notificación de Personal.
export const TIPOS_INSTRUMENTO = ['Decreto', 'Resolución', 'Disposición', 'Circular'];

// Motivo por el que reingresa un expediente.
export const MOTIVOS_INGRESO_EXP = [
  { valor: 'recaratulacion', label: 'Recaratulación (nuevo número/año/letra)' },
  { valor: 'nuevo_cuerpo', label: 'Formación de otro cuerpo' },
] as const;

export const ESTADOS_INSPECCION: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#94a3b8' },
  programada:     { label: 'Programada',     color: '#21708c' },
  realizada:      { label: 'Realizada',      color: '#16a34a' },
  observada:      { label: 'Observada',      color: '#eab308' },
  incumplimiento: { label: 'Incumplimiento', color: '#dc2626' },
};
