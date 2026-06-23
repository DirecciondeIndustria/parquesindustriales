export const TIPOS_DOCUMENTALES = [
  'Nota', 'Plano de mensura', 'Plano de obra', 'Proyecto industrial',
  'Informe técnico', 'Documentación fiscal', 'Documentación contable',
  'Fotografía', 'Acta de inspección', 'Resolución', 'Decreto',
  'Escritura', 'Contrato', 'Comodato', 'Otro',
];

export const ESTADOS_INSPECCION: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#94a3b8' },
  programada:     { label: 'Programada',     color: '#2563eb' },
  realizada:      { label: 'Realizada',      color: '#16a34a' },
  observada:      { label: 'Observada',      color: '#eab308' },
  incumplimiento: { label: 'Incumplimiento', color: '#dc2626' },
};
