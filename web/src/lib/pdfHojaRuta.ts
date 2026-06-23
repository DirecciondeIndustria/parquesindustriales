import { jsPDF } from 'jspdf';
import { fmtFecha } from './fechas';
import type { Expediente, Etapa } from './expediente';

interface SubTramite {
  expediente_etapa_id: string; nombre: string; obligatorio: boolean; completado: boolean;
  foja_desde?: number | null; foja_hasta?: number | null;
}
interface Meta { tipo?: string; empresa?: string; parcela?: string; }

/** "f. 30-48" / "f. 49" / "" según las fojas cargadas. */
function fmtFoja(d?: number | null, h?: number | null): string {
  if (d == null && h == null) return '';
  if (d != null && h != null && h !== d) return `f. ${d}-${h}`;
  return `f. ${d ?? h}`;
}

const BRAND: [number, number, number] = [15, 76, 129];

export function exportarHojaRuta(exp: Expediente, etapas: Etapa[], subs: SubTramite[], meta: Meta) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  let y = 16;

  // ── Encabezado ──
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text('SIGPIP — Hoja de Ruta de Expediente', M, 12);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text('Dirección de Industria · Ministerio de Producción · Provincia del Chubut', M, 18);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, M, 23);

  y = 36;
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(`Expediente N° ${exp.sigla ? `${exp.sigla} ` : ''}${exp.numero}/${exp.anio}`, M, y);
  y += 8;

  // ── Datos generales ──
  doc.setFontSize(10);
  const dato = (label: string, valor: string) => {
    doc.setFont('helvetica', 'bold').setTextColor(...BRAND);
    doc.text(`${label}: `, M, y);
    const w = doc.getTextWidth(`${label}: `);
    doc.setFont('helvetica', 'normal').setTextColor(40);
    doc.text(valor || '—', M + w, y);
    y += 6;
  };
  dato('Tipo de trámite', meta.tipo ?? '—');
  dato('Empresa', meta.empresa ?? '—');
  dato('Parcela', meta.parcela ?? '—');
  dato('Estado', exp.estado);
  dato('Inicio', fmtFecha(exp.fecha_inicio));
  dato('Vencimiento', fmtFecha(exp.plazo_vencimiento));
  if (exp.observaciones) {
    doc.setFont('helvetica', 'bold').setTextColor(...BRAND);
    doc.text('Observaciones:', M, y); y += 5;
    doc.setFont('helvetica', 'normal').setTextColor(40);
    doc.text(doc.splitTextToSize(exp.observaciones, W - 2 * M), M, y);
    y += doc.splitTextToSize(exp.observaciones, W - 2 * M).length * 5 + 2;
  }

  // ── Resumen de avance ──
  const total = etapas.length;
  const hechas = etapas.filter((e) => e.estado === 'completada').length;
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  y += 2;
  doc.setDrawColor(...BRAND).setLineWidth(0.3).line(M, y, W - M, y); y += 7;
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BRAND);
  doc.text(`Avance del trámite: ${hechas}/${total} hitos (${pct}%)`, M, y); y += 8;

  // ── Timeline ──
  doc.setFontSize(11).setTextColor(20);
  doc.text('Hoja de ruta', M, y); y += 6;

  const etiqueta = (e: Etapa) => e.estado === 'completada' ? '[HECHO]' : e.estado === 'en_curso' ? '[EN CURSO]' : '[PENDIENTE]';
  const colorEstado = (e: Etapa): [number, number, number] =>
    e.estado === 'completada' ? [22, 163, 74] : e.estado === 'en_curso' ? [37, 99, 235] : [148, 163, 184];

  for (const et of etapas.sort((a, b) => a.orden - b.orden)) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...colorEstado(et));
    const fechas = [
      et.fecha_entrada && `inicio ${fmtFecha(et.fecha_entrada)}`,
      et.fecha_salida && `fin ${fmtFecha(et.fecha_salida)}`,
    ].filter(Boolean).join(' · ');
    doc.text(`${et.orden}. ${et.nombre}  ${etiqueta(et)}`, M, y);
    if (fechas) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120);
      doc.text(fechas, W - M, y, { align: 'right' });
    }
    y += 5;

    const reqs = subs.filter((s) => s.expediente_etapa_id === et.id);
    for (const r of reqs) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60);
      const check = r.completado ? '☑' : '☐';
      const foja = fmtFoja(r.foja_desde, r.foja_hasta);
      doc.text(`     ${check} ${r.nombre}${r.obligatorio ? ' *' : ''}`, M, y);
      if (foja) {
        doc.setTextColor(120);
        doc.text(foja, W - M, y, { align: 'right' });
      }
      y += 4.5;
    }
    y += 2;
  }

  // ── Pie ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text('* requisito obligatorio · Documento generado por SIGPIP', M, 290);
    doc.text(`Página ${i} de ${pages}`, W - M, 290, { align: 'right' });
  }

  doc.save(`HojaRuta_Exp_${exp.numero}-${exp.anio}.pdf`);
}
