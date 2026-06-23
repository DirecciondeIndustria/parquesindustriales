/**
 * Formatea una fecha SOLO-FECHA ("YYYY-MM-DD") como DD/MM/YYYY sin aplicar
 * conversión de zona horaria (evita el desfase de un día con UTC).
 */
export function fmtFecha(s: string | null | undefined): string {
  if (!s) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(s).toLocaleDateString('es-AR');
}
