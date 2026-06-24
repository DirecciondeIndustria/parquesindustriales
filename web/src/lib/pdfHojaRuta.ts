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

/** Carga /logo.png y lo devuelve como dataURL con sus dimensiones. */
function cargarLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      try { resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }); }
      catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}

// Paleta oficial Marca Chubut (Brandbook V1.3).
const NARANJA: [number, number, number] = [255, 104, 44];   // Naranja Chubut (principal)
const AMBAR:   [number, number, number] = [255, 177, 9];     // Amarillo andino
const AZUL:    [number, number, number] = [33, 112, 140];    // Azul atlántico
const VERDE:   [number, number, number] = [22, 163, 74];
const GRIS:    [number, number, number] = [148, 163, 184];

export async function exportarHojaRuta(exp: Expediente, etapas: Etapa[], subs: SubTramite[], meta: Meta) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  let y = 16;
  const logo = await cargarLogo();

  const colorEstado = (e: Etapa): [number, number, number] =>
    e.estado === 'completada' ? VERDE : e.estado === 'en_curso' ? AZUL : GRIS;
  const etiqueta = (e: Etapa) => e.estado === 'completada' ? 'HECHO' : e.estado === 'en_curso' ? 'EN CURSO' : 'PENDIENTE';

  // Casilla de verificación dibujada (jsPDF no renderiza ☑ / ☐).
  const casilla = (x: number, baseline: number, done: boolean) => {
    const s = 3, top = baseline - 2.7;
    doc.setDrawColor(150).setLineWidth(0.3).rect(x, top, s, s);
    if (done) {
      doc.setDrawColor(...VERDE).setLineWidth(0.6);
      doc.line(x + 0.6, top + 1.6, x + 1.25, top + 2.4);
      doc.line(x + 1.25, top + 2.4, x + 2.6, top + 0.5);
    }
  };

  // ── Encabezado: logo centrado sobre blanco (Brandbook) ──
  let hb = 12;   // borde inferior del bloque del logo
  if (logo) {
    const maxW = 110, maxH = 18;
    let w = maxW, h = (logo.h / logo.w) * maxW;
    if (h > maxH) { h = maxH; w = (logo.w / logo.h) * maxH; }
    doc.addImage(logo.dataUrl, 'PNG', (W - w) / 2, 8, w, h);
    hb = 8 + h + 3;
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...NARANJA);
    doc.text('SIGPIP', W / 2, 14, { align: 'center' });
    hb = 18;
  }
  doc.setDrawColor(...NARANJA).setLineWidth(0.6).line(M, hb, W - M, hb);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110);
  doc.text('Dirección de Industria · Ministerio de Producción · Provincia del Chubut', W / 2, hb + 5, { align: 'center' });
  doc.setFontSize(7).setTextColor(140);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, W - M, hb + 5, { align: 'right' });

  y = hb + 14;
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(`Hoja de Ruta — Expediente N° ${exp.numero}/${exp.anio}${exp.sigla ? ` ${exp.sigla}` : ''}`, M, y);
  y += 8;

  // ── Datos generales ──
  doc.setFontSize(10);
  const dato = (label: string, valor: string) => {
    doc.setFont('helvetica', 'bold').setTextColor(...NARANJA);
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
    doc.setFont('helvetica', 'bold').setTextColor(...NARANJA);
    doc.text('Observaciones:', M, y); y += 5;
    doc.setFont('helvetica', 'normal').setTextColor(40);
    const obs = doc.splitTextToSize(exp.observaciones, W - 2 * M);
    doc.text(obs, M, y);
    y += obs.length * 5 + 2;
  }

  // ── Resumen de avance (con barra de progreso) ──
  const total = etapas.length;
  const hechas = etapas.filter((e) => e.estado === 'completada').length;
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  y += 2;
  doc.setDrawColor(...NARANJA).setLineWidth(0.4).line(M, y, W - M, y); y += 7;
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NARANJA);
  doc.text(`Avance del trámite: ${hechas}/${total} hitos (${pct}%)`, M, y); y += 3;
  const barW = W - 2 * M;
  doc.setFillColor(238, 242, 247).roundedRect(M, y, barW, 3, 1.5, 1.5, 'F');
  if (pct > 0) { doc.setFillColor(...NARANJA).roundedRect(M, y, (barW * pct) / 100, 3, 1.5, 1.5, 'F'); }
  y += 10;

  // ── Hoja de ruta ──
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(30);
  doc.text('Hoja de ruta', M, y); y += 6;

  for (const et of etapas.sort((a, b) => a.orden - b.orden)) {
    if (y > 268) { doc.addPage(); y = 20; }
    const col = colorEstado(et);
    // Punto de estado del hito.
    doc.setFillColor(...col).circle(M + 1.5, y - 1.4, 1.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...col);
    doc.text(`${et.orden}. ${et.nombre}`, M + 6, y);
    // Etiqueta de estado a la derecha.
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    doc.text(`[${etiqueta(et)}]`, W - M, y, { align: 'right' });
    const fechas = [
      et.fecha_entrada && `inicio ${fmtFecha(et.fecha_entrada)}`,
      et.fecha_salida && `fin ${fmtFecha(et.fecha_salida)}`,
    ].filter(Boolean).join(' · ');
    if (fechas) {
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(130);
      doc.text(fechas, M + 6, y + 3.5);
      y += 3.5;
    }
    y += 5;

    const reqs = subs.filter((s) => s.expediente_etapa_id === et.id);
    for (const r of reqs) {
      if (y > 282) { doc.addPage(); y = 20; }
      casilla(M + 7, y, r.completado);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(r.completado ? 110 : 60);
      doc.text(`${r.nombre}${r.obligatorio ? ' *' : ''}`, M + 12, y);
      const foja = fmtFoja(r.foja_desde, r.foja_hasta);
      if (foja) {
        doc.setTextColor(130);
        doc.text(foja, W - M, y, { align: 'right' });
      }
      y += 5;
    }
    y += 2.5;
  }

  // ── Pie ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...AMBAR).setLineWidth(0.4).line(M, 286, W - M, 286);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text('* requisito obligatorio · Documento generado por SIGPIP', M, 291);
    doc.text(`Página ${i} de ${pages}`, W - M, 291, { align: 'right' });
  }

  doc.save(`HojaRuta_Exp_${exp.numero}-${exp.anio}.pdf`);
}
