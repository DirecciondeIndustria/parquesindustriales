import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from './logoActa';

// ════════════════════════════════════════════════════════════════
//  PDF OFICIAL del acta — PORTADO TAL CUAL de la app de inspecciones
//  (función renderPDF). Mismo layout, textos, medidas y formato.
//  Recibe `d` = { ...acta.datos, photos, sig1, sig2, sig3 }.
// ════════════════════════════════════════════════════════════════

type RGB = [number, number, number];

function formatLongDate(s: string | null | undefined): string {
  if (!s) return '___';
  const [y, m, dd] = s.split('-'); if (!y) return s;
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${parseInt(dd)} días del mes de ${months[parseInt(m) - 1]} de ${y}`;
}

export function renderActaPdf(d: any, returnBase64?: boolean): string | void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, ML = 22, MR = 22, TW = PW - ML - MR, footerY = PH - 12;
  let y = 18;
  const C_DARK: RGB = [26, 46, 74], C_ACCENT: RGB = [232, 80, 10], C_GRAY: RGB = [90, 110, 133], C_LIGHT: RGB = [205, 215, 227], C_BLACK: RGB = [15, 15, 15];

  const setFont = (st: string, sz: number, col?: number[]) => { doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(...((col || C_BLACK) as [number, number, number])); };

  // Firmas estampadas en vertical (perpendicular) en el margen izquierdo de cada hoja
  function drawMarginSignatures() {
    const sigs = [d.sig1, d.sig2, d.sig3].filter(Boolean);
    if (!sigs.length) return;
    doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.2); doc.line(ML - 4, 30, ML - 4, PH - 22);
    const slots = [44, 124, 204]; // y de inicio de cada firma vertical (hasta 3)
    sigs.forEach((img, i) => {
      try { doc.addImage(img, 'PNG', 17, slots[i], 30, 8, undefined, 'FAST', 90); } catch (e) {}
    });
  }
  function drawHeader() {
    setFont('italic', 8, C_GRAY);
    doc.text('"Año de la Innovación y Modernización del Estado de la Provincia del Chubut"', PW / 2, 8, { align: 'center' });
    doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.3); doc.line(ML, 11, PW - MR, 11);
    try {
      if (LOGO_BASE64) {
        const lw = 50, lh = lw * (105 / 827); // logo real 827x105
        doc.addImage(LOGO_BASE64, 'PNG', ML, 14, lw, lh);
      }
    } catch (e) {}
    drawMarginSignatures();
    y = 34;
  }
  function drawFooter() {
    doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.3); doc.line(ML, footerY - 6, PW - MR, footerY - 6);
    setFont('italic', 7, C_ACCENT);
    doc.text('Documento generado y firmado digitalmente — su validez no requiere firma ológrafa.', PW / 2, footerY - 2.5, { align: 'center' });
    setFont('normal', 7.5, C_GRAY);
    doc.text('Av. 9 de julio 280 Rawson – Chubut  /  Tel. 280 4482606/607', PW / 2, footerY + 1.5, { align: 'center' });
  }
  function newPage() { drawFooter(); doc.addPage(); drawHeader(); }
  function checkY(n: number) { if (y + n > PH - 20) newPage(); }
  function gap(n?: number) { y += (n || 3); }

  function sectionTitle(t: string) {
    checkY(14); gap(3);
    doc.setFillColor(...C_ACCENT); doc.rect(ML, y - 4, 2.5, 6, 'F');
    setFont('bold', 10.5, C_DARK); doc.text(t, ML + 5, y); y += 5;
    doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.3); doc.line(ML, y, PW - MR, y); y += 4;
  }
  // Dibuja una casilla vectorial (recuadro + tilde si está marcada)
  function drawCheckbox(x: number, yBase: number, checked: boolean, s?: number) {
    const side = s || 3.6;
    const top = yBase - side + 0.5;
    doc.setLineWidth(0.45);
    if (checked) {
      doc.setFillColor(...C_DARK); doc.setDrawColor(...C_DARK);
      doc.roundedRect(x, top, side, side, 0.6, 0.6, 'FD');
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.7);
      doc.line(x + side * 0.22, top + side * 0.55, x + side * 0.42, top + side * 0.78);
      doc.line(x + side * 0.42, top + side * 0.78, x + side * 0.80, top + side * 0.24);
    } else {
      doc.setDrawColor(...C_GRAY); doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, top, side, side, 0.6, 0.6, 'FD');
    }
  }
  function writeCheck(checked: any, label: string, indent?: number, size?: number) {
    const sz = size || 10; checkY(6.5);
    const bx = ML + (indent || 0);
    drawCheckbox(bx, y, !!checked);
    // Marcadas: negrita y color oscuro. Sin marcar: gris claro para que resalten las marcadas.
    setFont(checked ? 'bold' : 'normal', sz, checked ? C_DARK : [140, 152, 168]);
    const tx = bx + 5.4;
    const lines = doc.splitTextToSize(label, TW - (indent || 0) - 5.4);
    doc.text(lines, tx, y); y += lines.length * (sz * 0.42) + 2.6;
  }
  function writeLabel(label: string, value: string, size?: number) {
    const sz = size || 9.5; checkY(8); setFont('bold', sz, C_DARK);
    const lw = doc.getTextWidth(label + ' '); doc.text(label + ' ', ML, y);
    setFont('normal', sz, C_BLACK);
    const vLines = doc.splitTextToSize(value || '—', TW - lw);
    doc.text(vLines[0], ML + lw, y);
    if (vLines.length > 1) { y += sz * 0.42 + 0.5; doc.text(vLines.slice(1), ML + lw, y); y += (vLines.length - 1) * (sz * 0.42 + 0.5); }
    else y += sz * 0.42 + 2;
  }
  function writeParagraph(txt: string, size?: number) {
    const sz = size || 9.5; setFont('normal', sz, C_BLACK);
    const lines = doc.splitTextToSize(txt, TW); checkY(lines.length * 4.4 + 3);
    doc.text(lines, ML, y); y += lines.length * 4.4 + 3;
  }

  // ── PÁGINA 1 ──
  drawHeader();
  setFont('bold', 16, C_DARK); doc.text('ACTA DE INSPECCIÓN', PW / 2 - 16, y, { align: 'center' });
  setFont('bold', 16, C_ACCENT); doc.text(`Nº ${String(d.actaNum || '___').toString().padStart(3, '0')}/${d.actaYear || '___'}`, PW / 2 + 28, y);
  y += 9; doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.4); doc.line(ML, y, PW - MR, y); y += 7;

  const agentNames = (d.agents && d.agents.length) ? d.agents.join(', ') : '_______________';
  const respFull = [d.respNombre, d.respApellido].filter(Boolean).join(' ') || '_______________';
  writeParagraph(`En la ciudad de ${d.ciudad || '_______________'} a los ${formatLongDate(d.fecha)} siendo las ${d.hora || '___'} hs se hace/n presente/s en nombre del Ministerio de Producción: ${agentNames}`, 10);
  writeParagraph(`en el establecimiento/predio: ${d.establecimiento || '_______________'}, situado en calle ${d.domicilioEstablec || '_______________'}, Parque Industrial ${d.parqueIndustrial || '_______________'}, nomenclatura catastral: Ejido ${d.ejido || '___'} Circ. ${d.circ || '___'} Sector ${d.sector || '___'} División ${d.division || '___'} Parcela ${d.parcela || '___'}${d.macizo ? ' Macizo/Fracción ' + d.macizo : ''} y solicitando el comparendo del propietario o responsable se presenta el/la Señor/a: ${respFull}, DNI: ${d.respDni || '_______________'}, en carácter de ${d.respCargo || '_______________'} de la firma/razón social: ${d.razonSocial || '_______________'}, CUIT: ${d.cuit || '_______________'} a quien se le hace saber que se practicará una inspección en el marco de los Art. 18º, 19º y 20º del Decreto Provincial Nº 1239/06, a los efectos de verificar el estado actual del inmueble y de la actividad industrial.`, 10);
  gap(2);

  checkY(22);
  doc.setDrawColor(255, 193, 7); doc.setFillColor(255, 248, 225); doc.setLineWidth(0.5);
  doc.roundedRect(ML, y, TW, 18, 2, 2, 'FD');
  setFont('bolditalic', 9, [102, 77, 3]); doc.text('IMPORTANTE:', ML + 4, y + 5);
  setFont('italic', 9, [102, 77, 3]);
  doc.text(doc.splitTextToSize('La obstaculización o impedimento del acceso de los inspectores a los establecimientos industriales constituye una infracción pasible de sanción de acuerdo al Art. 21º del Decreto antes mencionado.', TW - 8), ML + 4, y + 10);
  y += 22;
  setFont('normal', 10, C_GRAY); doc.text('De la inspección surge:', ML, y); y += 5;

  // Acceso
  sectionTitle('¿Se accedió al predio e interior de instalaciones?');
  writeCheck(d.accesoPredi, 'Acceso al predio', 4);
  writeCheck(d.accesoInterior, 'Acceso al interior de las instalaciones', 4);
  writeCheck(d.noPudoAcceder, 'No se pudo acceder', 4);
  if (d.noPudoAcceder) {
    writeCheck(d.seNegoAcceso, 'Se negó el acceso', 10);
    writeCheck(d.otrosMotivos, 'Otros motivos', 10);
    if (d.otrosMotivosTexto) writeLabel('   Motivos:', d.otrosMotivosTexto);
  }
  if (d.obsAcceso) { gap(1); writeLabel('Observaciones:', d.obsAcceso); }

  // Estado del predio
  sectionTitle('Estado del predio');
  writeCheck(d.cercado, 'Cercado total / parcial', 4);
  writeCheck(d.movSuelos, 'Con movimiento de suelos / nivelación', 4);
  writeCheck(d.sinModif, 'Sin modificaciones (estado natural)', 4);
  writeCheck(d.sinConstruccion, 'Sin construcción', 4);
  writeCheck(d.enConstruccion, 'En construcción', 4);
  if (d.enConstruccion) {
    writeCheck(d.construcActual, 'Actualmente', 10);
    writeCheck(d.construcDetenida, 'Construcción detenida / abandonada', 10);
  }
  writeCheck(d.conConstruccion, 'Con construcción finalizada', 4);
  if (d.estadoConstruccion) writeLabel('Estado y características:', d.estadoConstruccion);
  if (d.obsEstadoPredi) writeLabel('Observaciones:', d.obsEstadoPredi);

  // Actividad
  sectionTitle('Actividad industrial al momento de la inspección');
  writeCheck(d.sinActividad, 'Sin actividad', 4);
  writeCheck(d.enActividad, 'En actividad', 4);
  if (d.enActividad) {
    if (d.detalleActividad) writeLabel('Detalle de la actividad:', d.detalleActividad);
    if (d.productos) writeLabel('Productos / servicios:', d.productos);
    if (d.personal) writeLabel('Personal en operación:', d.personal);
    if (d.capacidad) writeLabel('Capacidad de producción:', d.capacidad);
  }
  if (d.obsActividad) writeLabel('Observaciones:', d.obsActividad);

  // Servicios
  sectionTitle('Servicios que posee el predio');
  const servicios: [any, string][] = [
    [d.srvEnergia, 'Energía'], [d.srvAguaPot, 'Agua potable'],
    [d.srvGasRed, 'Gas de red'], [d.srvAguaInd, 'Agua de uso industrial'],
    [d.srvGasEnvasado, 'Gas envasado'], [d.srvCloacas, 'Cloacas'],
  ];
  const colW = TW / 2;
  checkY(servicios.length / 2 * 6.4 + 4);
  const baseY = y;
  function srvItem(item: [any, string], x: number, yy: number) {
    drawCheckbox(x, yy, !!item[0]);
    setFont(item[0] ? 'bold' : 'normal', 10, item[0] ? C_DARK : [140, 152, 168]);
    doc.text(item[1], x + 5.4, yy);
  }
  for (let i = 0; i < servicios.length; i += 2) {
    const yy = baseY + (i / 2) * 6.4;
    srvItem(servicios[i], ML + 4, yy);
    if (servicios[i + 1]) srvItem(servicios[i + 1], ML + colW + 4, yy);
  }
  y = baseY + (servicios.length / 2) * 6.4 + 1;
  writeCheck(d.srvOtros, `Otros${d.srvOtrosTexto ? ': ' + d.srvOtrosTexto : ''}`, 4);
  if (d.obsServicios) writeLabel('Observaciones:', d.obsServicios);

  // Otras observaciones
  if (d.otrasObs) { sectionTitle('Otras observaciones'); writeParagraph(d.otrasObs); }

  // Conformidad – Declaración Jurada
  sectionTitle('Conformidad – Declaración Jurada');
  writeParagraph('El/la responsable del establecimiento presta plena conformidad con el registro digital de la presente inspección y declara bajo juramento que los datos consignados son veraces y se corresponden con el estado real del inmueble y de la actividad industrial al momento de la inspección, asumiendo lo aquí manifestado con carácter de declaración jurada, en el marco de los Art. 18º, 19º y 20º del Decreto Provincial Nº 1239/06.', 9.5);
  if (d.conformidadAclara) writeLabel('Aclaraciones del responsable:', d.conformidadAclara);
  writeCheck(!!d.conformidadDDJJ, 'El responsable prestó conformidad y aceptó el carácter de declaración jurada.', 4);

  // Cierre + firmas
  gap(4); checkY(60);
  setFont('normal', 9.5, C_BLACK);
  doc.text('Sin más, se firma un (1) ejemplar de la presente quedando en posesión del Ministerio de Producción.-', ML, y, { maxWidth: TW });
  y += 12;

  checkY(48);
  const boxW = (TW - 12) / 2, boxH = 26;
  function sigBox(x: number, img: string, name: string, role: string) {
    // Sin recuadro: la firma se estampa sobre la línea, lista para validar
    if (img) { try { doc.addImage(img, 'PNG', x + 6, y, boxW - 12, boxH, undefined, 'FAST'); } catch (e) {} }
    doc.setDrawColor(...C_GRAY); doc.setLineWidth(0.3); doc.line(x + 4, y + boxH + 1, x + boxW - 4, y + boxH + 1);
    setFont('bold', 8.5, C_DARK);
    doc.text(name || '', x + boxW / 2, y + boxH + 5, { align: 'center' });
    setFont('normal', 7.5, C_GRAY);
    doc.text(role, x + boxW / 2, y + boxH + 8.5, { align: 'center', maxWidth: boxW });
  }
  sigBox(ML, d.sig1, d.agente1Nombre || (d.agents && d.agents[0]) || '', 'Agente Inspector');
  sigBox(ML + boxW + 12, d.sig2, d.agente2Nombre || (d.agents && d.agents[1]) || '', 'Agente Inspector');
  y += boxH + 14;
  checkY(boxH + 14);
  sigBox(ML + boxW / 2 + 6, d.sig3, respFull, `${d.respCargo || 'Responsable'}${d.razonSocial ? ' – ' + d.razonSocial : ''}`);
  y += boxH + 12;

  // Ubicación de la firma (coordenadas + imagen satelital ~zoom 17)
  if (d.geoLat != null && d.geoLng != null) {
    sectionTitle('Ubicación de la firma');
    writeLabel('Coordenadas:', `${Number(d.geoLat).toFixed(6)}, ${Number(d.geoLng).toFixed(6)}`);
    if (d.geoAcc != null) writeLabel('Precisión GPS:', `± ${Math.round(Number(d.geoAcc))} m`);
    if (d.geoImg) {
      const imgW = 90, imgH = 90; // tamaño mediano, proporcional (cuadrado)
      gap(1); checkY(imgH + 6);
      const ix = ML + (TW - imgW) / 2;
      try {
        doc.addImage(d.geoImg, 'JPEG', ix, y, imgW, imgH);
        doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.3); doc.rect(ix, y, imgW, imgH);
      } catch (e) {}
      y += imgH + 3;
      setFont('italic', 6.5, C_GRAY);
      doc.text('© Microsoft Bing © Maxar', ix + imgW, y, { align: 'right' });
      y += 4;
    }
  }

  // Fotos
  if (d.photos && d.photos.length) {
    newPage(); sectionTitle('Registro Fotográfico');
    const iw = (TW - 8) / 2, ih = iw * 0.72; let col = 0;
    for (const p of d.photos) {
      checkY(ih + 6);
      const ix = ML + col * (iw + 8);
      try { doc.addImage(p, 'JPEG', ix, y, iw, ih); doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.3); doc.rect(ix, y, iw, ih); } catch (e) {}
      col++; if (col >= 2) { col = 0; y += ih + 6; }
    }
    if (col !== 0) y += ih + 6;
  }

  drawFooter();
  const idStr = `${String(d.actaNum || '000').toString().padStart(3, '0')}-${d.actaYear || '2026'}`;
  const safe = (d.razonSocial || 'empresa').replace(/[^a-z0-9]/gi, '_').slice(0, 30);
  if (returnBase64) return doc.output('datauristring');
  doc.save(`Acta_Inspeccion_${idStr}_${safe}.pdf`);
}
