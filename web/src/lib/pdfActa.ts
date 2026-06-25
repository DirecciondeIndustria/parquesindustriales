import { jsPDF } from 'jspdf';
import { fmtFecha } from './fechas';

// Acta tal como llega de la app móvil (tabla actas_inspeccion).
export interface ActaPdf {
  numero: number | null;
  anio: number | null;
  razon_social: string | null;
  cuit: string | null;
  parque: string | null;
  ciudad: string | null;
  fecha: string | null;
  datos: Record<string, any> | null;
  fotos: string[] | null;
  sig1: string | null;
  sig2: string | null;
  sig3: string | null;
  inspector_nombre: string | null;
  created_at: string;
}

const NARANJA: [number, number, number] = [255, 104, 44];
const AMBAR: [number, number, number] = [255, 177, 9];
const VERDE: [number, number, number] = [22, 163, 74];

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

const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export async function exportarActaPdf(a: ActaPdf) {
  const logo = await cargarLogo();
  const W = 210, H = 297, M = 16;                 // A4 (mm)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const d = (a.datos ?? {}) as Record<string, any>;
  const nro = `${String(a.numero ?? 0).padStart(3, '0')}/${a.anio ?? ''}`;
  let y = 0;

  const encabezado = (): number => {
    let hb = 12;
    if (logo) {
      const maxW = 100, maxH = 16;
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
    return hb + 11;
  };

  const saltar = (alto: number) => { if (y + alto > H - 16) { doc.addPage(); y = encabezado(); } };

  const seccion = (titulo: string) => {
    saltar(12);
    y += 1;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NARANJA);
    doc.text(titulo.toUpperCase(), M, y);
    y += 1.5;
    doc.setDrawColor(...AMBAR).setLineWidth(0.3).line(M, y, W - M, y);
    y += 5;
  };

  const dato = (label: string, valor: unknown) => {
    saltar(6);
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(90);
    doc.text(`${label}:`, M, y);
    const lw = doc.getTextWidth(`${label}: `);
    doc.setFont('helvetica', 'normal').setTextColor(30);
    const val = doc.splitTextToSize(txt(valor), W - 2 * M - lw - 2);
    doc.text(val, M + lw + 2, y);
    y += Math.max(5, val.length * 4.5);
  };

  const chips = (items: string[]) => {
    if (items.length === 0) { dato('', 'Sin marcar'); return; }
    saltar(6);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(30);
    const linea = doc.splitTextToSize('✓ ' + items.join('    ✓ '), W - 2 * M);
    doc.text(linea, M, y);
    y += linea.length * 4.5 + 1;
  };

  const marc = (pairs: [boolean, string][]) => pairs.filter(([c]) => !!c).map(([, l]) => l);

  // ── Título ──
  y = encabezado();
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(20);
  doc.text(`Acta de Inspección N° ${nro}`, M, y);
  y += 8;

  // ── General ──
  seccion('General');
  dato('Fecha / hora', `${fmtFecha(a.fecha)}${d.hora ? ' · ' + d.hora : ''}`);
  dato('Ciudad', a.ciudad);
  dato('Inspector que cargó', a.inspector_nombre);
  if (Array.isArray(d.agents) && d.agents.length) dato('Agentes', d.agents.join(', '));

  // ── Empresa ──
  seccion('Empresa');
  dato('Razón social', a.razon_social);
  dato('CUIT', a.cuit);
  dato('Domicilio legal', d.domicilioEmpresa);
  dato('Email', d.emailEmpresa);

  // ── Responsable ──
  seccion('Responsable que recibe');
  dato('Nombre', `${d.respNombre || ''} ${d.respApellido || ''}`.trim());
  dato('DNI', d.respDni);
  dato('Cargo', d.respCargo);

  // ── Establecimiento ──
  seccion('Establecimiento');
  dato('Predio', d.establecimiento);
  dato('Dirección', d.domicilioEstablec);
  dato('Parque industrial', a.parque);
  dato('Nomenclatura', `Ejido ${d.ejido || '—'} · Circ ${d.circ || '—'} · Sec ${d.sector || '—'} · Div ${d.division || '—'} · Parc ${d.parcela || '—'}${d.macizo ? ' · Mac ' + d.macizo : ''}`);

  // ── Acceso ──
  seccion('Acceso al predio');
  chips(marc([
    [d.accesoPredi, 'Acceso al predio'], [d.accesoInterior, 'Acceso al interior'],
    [d.noPudoAcceder, 'No se pudo acceder'], [d.seNegoAcceso, 'Se negó el acceso'],
    [d.otrosMotivos, 'Otros motivos'],
  ]));
  if (d.otrosMotivosTexto) dato('Motivos', d.otrosMotivosTexto);
  if (d.obsAcceso) dato('Observaciones', d.obsAcceso);

  // ── Estado del predio ──
  seccion('Estado del predio');
  chips(marc([
    [d.cercado, 'Cercado total/parcial'], [d.movSuelos, 'Movimiento de suelos'],
    [d.sinModif, 'Sin modificaciones'], [d.sinConstruccion, 'Sin construcción'],
    [d.enConstruccion, 'En construcción'], [d.construcActual, 'Actualmente'],
    [d.construcDetenida, 'Detenida/abandonada'], [d.conConstruccion, 'Construcción finalizada'],
  ]));
  if (d.estadoConstruccion) dato('Características', d.estadoConstruccion);
  if (d.obsEstadoPredi) dato('Observaciones', d.obsEstadoPredi);

  // ── Actividad ──
  seccion('Actividad industrial');
  chips(marc([[d.sinActividad, 'Sin actividad'], [d.enActividad, 'En actividad']]));
  if (d.detalleActividad) dato('Detalle', d.detalleActividad);
  if (d.productos) dato('Productos/servicios', d.productos);
  if (d.personal) dato('Personal', d.personal);
  if (d.capacidad) dato('Capacidad', d.capacidad);
  if (d.obsActividad) dato('Observaciones', d.obsActividad);

  // ── Servicios ──
  seccion('Servicios del predio');
  chips(marc([
    [d.srvEnergia, 'Energía'], [d.srvGasRed, 'Gas de red'], [d.srvGasEnvasado, 'Gas envasado'],
    [d.srvAguaPot, 'Agua potable'], [d.srvAguaInd, 'Agua industrial'], [d.srvCloacas, 'Cloacas'],
    [d.srvOtros, d.srvOtrosTexto ? `Otros: ${d.srvOtrosTexto}` : 'Otros'],
  ]));
  if (d.obsServicios) dato('Observaciones', d.obsServicios);

  if (d.otrasObs) {
    seccion('Otras observaciones');
    saltar(6);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(30);
    const obs = doc.splitTextToSize(String(d.otrasObs), W - 2 * M);
    doc.text(obs, M, y);
    y += obs.length * 4.5 + 2;
  }

  // ── Fotos ──
  const fotos = a.fotos ?? [];
  if (fotos.length) {
    seccion(`Fotografías (${fotos.length})`);
    const cols = 3, gap = 4, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = cw * 0.75;
    let col = 0;
    for (const src of fotos) {
      if (col === 0) saltar(ch + 2);
      const x = M + col * (cw + gap);
      try {
        const fmt = src.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(src, fmt, x, y, cw, ch);
      } catch { /* foto inválida, se omite */ }
      col++;
      if (col >= cols) { col = 0; y += ch + gap; }
    }
    if (col !== 0) y += ch + gap;
  }

  // ── Firmas ──
  const firmas = [
    { img: a.sig1, nom: d.agente1Nombre || (Array.isArray(d.agents) ? d.agents[0] : '') || 'Agente 1', rol: 'Agente inspector' },
    { img: a.sig2, nom: d.agente2Nombre || (Array.isArray(d.agents) ? d.agents[1] : '') || 'Agente 2', rol: 'Agente inspector' },
    { img: a.sig3, nom: `${d.respNombre || ''} ${d.respApellido || ''}`.trim() || 'Responsable', rol: d.respCargo || 'Responsable' },
  ].filter((f) => f.img);
  if (firmas.length) {
    seccion('Firmas');
    const fw = (W - 2 * M - 8 * (firmas.length - 1)) / firmas.length, fh = 22;
    saltar(fh + 10);
    firmas.forEach((f, i) => {
      const x = M + i * (fw + 8);
      doc.setDrawColor(210).setLineWidth(0.3).rect(x, y, fw, fh);
      try { doc.addImage(f.img!, 'PNG', x + 2, y + 2, fw - 4, fh - 4); } catch { /* ignore */ }
      doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(40);
      doc.text(doc.splitTextToSize(f.nom, fw), x, y + fh + 4);
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(120);
      doc.text(doc.splitTextToSize(f.rol, fw), x, y + fh + 8);
    });
    y += fh + 12;
  }

  // ── Pie en todas las hojas ──
  const pages = doc.getNumberOfPages();
  const generado = `Generado: ${new Date().toLocaleString('es-AR')}`;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...VERDE).setLineWidth(0.3).line(M, H - 12, W - M, H - 12);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Acta N° ${nro} · ${generado}`, M, H - 7);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 7, { align: 'right' });
  }

  doc.save(`Acta_${String(a.numero ?? 0).padStart(3, '0')}-${a.anio ?? ''}.pdf`);
}
