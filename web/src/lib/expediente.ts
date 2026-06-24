export interface Expediente {
  id: string;
  numero: number;
  anio: number;
  sigla: string | null;
  tipo_tramite_id: string | null;
  empresa_id: string | null;
  parcela_id: string | null;
  estado: 'iniciado' | 'en_tramite' | 'demorado' | 'finalizado' | 'archivado' | 'baja';
  numero_fichero: string | null;
  poseedor_actual: string | null;
  responsable_id: string | null;
  fecha_inicio: string;
  plazo_vencimiento: string | null;
  observaciones: string | null;
  updated_at: string;
}

export interface Etapa {
  id: string;
  expediente_id: string;
  orden: number;
  nombre: string;
  estado: 'pendiente' | 'en_curso' | 'completada';
  responsable_id: string | null;
  fecha_entrada: string | null;
  fecha_salida: string | null;
}

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';

export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: '#16a34a', amarillo: '#eab308', rojo: '#dc2626', gris: '#94a3b8',
};

const DIA = 86400000;
function dias(desde: string): number {
  return Math.floor((Date.now() - new Date(desde).getTime()) / DIA);
}
function diasHasta(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / DIA);
}

/** Calcula el semáforo del expediente según plazo y días sin movimiento. */
export function semaforo(e: Expediente): { color: Semaforo; motivo: string } {
  if (e.estado === 'finalizado' || e.estado === 'archivado') return { color: 'gris', motivo: 'Cerrado' };
  if (e.estado === 'baja') return { color: 'gris', motivo: 'Baja' };

  if (e.plazo_vencimiento) {
    const d = diasHasta(e.plazo_vencimiento);
    if (d < 0) return { color: 'rojo', motivo: `Plazo vencido hace ${-d} día(s)` };
    if (d <= 7) return { color: 'amarillo', motivo: `Vence en ${d} día(s)` };
  }

  const sinMov = dias(e.updated_at);
  if (sinMov > 45) return { color: 'rojo', motivo: `Sin movimiento hace ${sinMov} días` };
  if (sinMov >= 30) return { color: 'amarillo', motivo: `Sin movimiento hace ${sinMov} días` };

  return { color: 'verde', motivo: 'En término' };
}

export const ESTADO_LABEL: Record<Expediente['estado'], string> = {
  iniciado: 'Iniciado', en_tramite: 'En trámite', demorado: 'Demorado',
  finalizado: 'Finalizado', archivado: 'Archivado', baja: 'Baja',
};

export function diasEnEtapa(et: Etapa): number | null {
  return et.fecha_entrada ? dias(et.fecha_entrada) : null;
}

/** Formato oficial del expediente: Número/Año Sigla (ej. "1025/2026 MP"). */
export function fmtExp(e: { numero: number; anio: number; sigla: string | null }): string {
  return `${e.numero}/${e.anio}${e.sigla ? ` ${e.sigla}` : ''}`;
}
