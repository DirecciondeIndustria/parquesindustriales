// Íconos de línea (estilo Lucide), stroke = currentColor.
const PATHS: Record<string, string> = {
  tablero: 'M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 14h8v7H3z',
  parques: 'M3 21V8l6 4V8l6 4V5l6 3v13zM7 21v-3M12 21v-3M17 21v-3',
  empresas: 'M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 9h4a2 2 0 0 1 2 2v10M6 7h2M6 11h2M6 15h2',
  parcelas: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  expedientes: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  flujos: 'M6 3v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 6-6 6-6 6',
  documentos: 'M14 3v4a1 1 0 0 0 1 1h4M5 3h9l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM9 13h6M9 17h6',
  inspecciones: 'M9 4h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5a1 1 0 0 1 1-1zM9 13l2 2 4-4',
  escrituraciones: 'M5 3h10l4 4v14H5zM9 9h6M9 13h6M9 17h3',
  archivo: 'M3 4h18v4H3zM5 8v12h14V8M9 12h6',
  alertas: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  asistente: 'M12 8V4m0 4a4 4 0 0 0-4 4v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a4 4 0 0 0-4-4zM9 14h.01M15 14h.01M12 2v2',
  auditoria: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
};

export function Icon({ name, className = '', size = 20 }: { name: string; className?: string; size?: number }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
