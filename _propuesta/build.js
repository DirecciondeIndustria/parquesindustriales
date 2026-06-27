const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak
} = require("docx");

// ---------- helpers ----------
const NAVY = "1F3864";
const BLUE = "2E5496";
const LIGHT = "D9E2F3";
const LIGHTER = "EAF0FA";
const GREY = "808080";
const CW = 9360; // content width US Letter, 1" margins

const border = { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellM = { top: 60, bottom: 60, left: 120, right: 120 };

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size })],
  });
}
function bullet(text, bold) {
  return new Paragraph({
    numbering: { reference: "b", level: 0 },
    spacing: { after: 60, line: 276 },
    children: typeof text === "string"
      ? [new TextRun({ text, bold })]
      : text,
  });
}
function H1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function H2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}

function hcell(text, w, align) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cellM,
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align ?? AlignmentType.LEFT, spacing: { after: 0 },
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 19 })] })],
  });
}
function cell(text, w, opts = {}) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cellM,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: opts.align ?? AlignmentType.LEFT, spacing: { after: 0 },
      children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: 19 })] })],
  });
}

// 3-col money table: desc | usd | pesos
function moneyTable(rows, totalRows = []) {
  const widths = [5360, 1800, 2200];
  const head = new TableRow({ tableHeader: true, children: [
    hcell("Concepto", widths[0]),
    hcell("USD", widths[1], AlignmentType.RIGHT),
    hcell("Pesos (MEP $1.500)", widths[2], AlignmentType.RIGHT),
  ]});
  const body = rows.map((r, i) => new TableRow({ children: [
    cell(r[0], widths[0], { fill: i % 2 ? LIGHTER : undefined }),
    cell(r[1], widths[1], { align: AlignmentType.RIGHT, fill: i % 2 ? LIGHTER : undefined }),
    cell(r[2], widths[2], { align: AlignmentType.RIGHT, fill: i % 2 ? LIGHTER : undefined }),
  ]}));
  const totals = totalRows.map(r => new TableRow({ children: [
    cell(r[0], widths[0], { bold: true, fill: r[3] || LIGHT }),
    cell(r[1], widths[1], { bold: true, align: AlignmentType.RIGHT, fill: r[3] || LIGHT }),
    cell(r[2], widths[2], { bold: true, align: AlignmentType.RIGHT, fill: r[3] || LIGHT }),
  ]}));
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
    rows: [head, ...body, ...totals] });
}

// 2-col feature table: module | detail
function featTable(rows) {
  const widths = [2700, 6660];
  const head = new TableRow({ tableHeader: true, children: [
    hcell("Módulo", widths[0]), hcell("Funcionalidades", widths[1]),
  ]});
  const body = rows.map((r, i) => new TableRow({ children: [
    cell(r[0], widths[0], { bold: true, fill: i % 2 ? LIGHTER : undefined }),
    new TableCell({ borders, width: { size: widths[1], type: WidthType.DXA }, margins: cellM,
      shading: i % 2 ? { fill: LIGHTER, type: ShadingType.CLEAR } : undefined,
      children: r[1].map(t => new Paragraph({ spacing: { after: 30, line: 264 },
        children: [new TextRun({ text: t, size: 19 })] })) }),
  ]}));
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: widths, rows: [head, ...body] });
}

// ---------- document ----------
const children = [];

// COVER
children.push(
  new Paragraph({ spacing: { before: 1600, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "CSS", bold: true, size: 72, color: NAVY }),
      new TextRun({ text: " Developers", bold: true, size: 72, color: BLUE })] }),
  new Paragraph({ spacing: { after: 1400 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Ingeniería de software a medida", italics: true, size: 22, color: GREY })] }),
  new Paragraph({ spacing: { before: 0, after: 0 }, alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 8 } },
    children: [new TextRun({ text: "PROPUESTA COMERCIAL", bold: true, size: 56, color: NAVY })] }),
  new Paragraph({ spacing: { before: 240, after: 80 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "SIGPIP", bold: true, size: 40, color: BLUE })] }),
  new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Sistema Integral de Gestión de Parques Industriales", size: 26, color: NAVY })] }),
  new Paragraph({ spacing: { after: 2000 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Plataforma web + aplicación móvil de inspección", italics: true, size: 22, color: GREY })] }),
  new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Presentado por: ", size: 22 }), new TextRun({ text: "CSS Developers", bold: true, size: 22 })] }),
  new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Destinatario: ", size: 22 }), new TextRun({ text: "Ministerio de Producción — Provincia del Chubut", bold: true, size: 22 })] }),
  new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Fecha: Junio de 2026", size: 22 })] }),
  new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Validez de la oferta: 30 días corridos", italics: true, size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// TOC
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Índice")] }),
  new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),
);

// 1. RESUMEN EJECUTIVO
children.push(H1("1. Resumen ejecutivo"));
children.push(P("SIGPIP es un sistema de información ya desarrollado y en funcionamiento para la gestión integral de los parques industriales de la provincia. Reúne en una sola plataforma la administración territorial (parques, parcelas y empresas radicadas), la tramitación de expedientes con flujos de trabajo, la gestión documental y de escrituraciones, un módulo completo de inspecciones con aplicación móvil para los agentes en campo, un portal de autogestión para las empresas y un tablero de indicadores para la toma de decisiones."));
children.push(P("A diferencia de un desarrollo genérico, SIGPIP refleja con exactitud los procesos reales del organismo: fue concebido conociendo en detalle cada circuito administrativo y de inspección. Esto reduce a prácticamente cero el riesgo de implementación y el tiempo de puesta en marcha, ya que no requiere una etapa de relevamiento ni adaptaciones de fondo."));
children.push(P("La presente propuesta ofrece dos modalidades de contratación —llave en mano (pago único) y licencia anual gestionada (SaaS)— con su desglose económico, además de una opción híbrida recomendada y un esquema de ampliación por demanda.", { after: 60 }));

// 2. DESCRIPCIÓN
children.push(H1("2. Descripción del sistema"));
children.push(P("SIGPIP es una aplicación web responsiva, accesible desde computadora o celular, complementada por una aplicación móvil específica para las inspecciones en campo. Centraliza la información de los parques industriales de la provincia (Comodoro Rivadavia, Puerto Madryn —Conexa, PIL, PIP y PIPE—, Trelew y Trevelin) y digitaliza de punta a punta los circuitos de gestión, inspección y vinculación con las empresas."));
children.push(P("El sistema opera bajo un modelo de roles y permisos que distingue perfiles de administración, mesa de entrada, inspectores y empresas, con trazabilidad completa de las acciones (auditoría) y seguridad de datos a nivel de base de datos.", { after: 60 }));

// 3. FUNCIONALIDADES
children.push(H1("3. Funcionalidades del sistema"));
children.push(P("El sistema está compuesto por más de 20 módulos funcionales, agrupados en siete áreas:", { after: 120 }));

children.push(H2("3.1. Núcleo, seguridad y administración"));
children.push(featTable([
  ["Acceso y seguridad", [
    "Login unificado para los tres entornos (gestión SIGPIP, Portal de Empresas e Inspectores).",
    "Recuperación de contraseña por email (autogestión) y restablecimiento por administrador.",
    "Seguridad de datos a nivel de fila (RLS) en la base de datos.",
  ]],
  ["Roles y permisos", [
    "Modelo de roles: rol principal + rol secundario (Inspector) + delegación de Mesa de Entrada con consentimiento.",
    "Permisos diferenciados por rol; un único responsable de Mesa de Entrada; borrado restringido a administradores.",
  ]],
  ["Usuarios y auditoría", [
    "Alta y administración de usuarios y asignación de roles.",
    "Registro de auditoría de las acciones realizadas en el sistema.",
  ]],
]));

children.push(H2("3.2. Gestión territorial"));
children.push(featTable([
  ["Parques", ["Administración de los parques industriales de la provincia y sus datos."]],
  ["Parcelas", ["Gestión de parcelas dentro de cada parque."]],
  ["Empresas", ["Registro y administración de las empresas radicadas."]],
]));

children.push(H2("3.3. Expedientes, trámites y documentación"));
children.push(featTable([
  ["Expedientes", ["Gestión de expedientes con vista de detalle completa por trámite."]],
  ["Flujos de trabajo", ["Circuito de estados de cada trámite (workflow) para su seguimiento."]],
  ["Documentos", ["Gestión documental asociada a expedientes y empresas."]],
  ["Escrituraciones", ["Seguimiento de los procesos de escrituración."]],
  ["Archivo", ["Resguardo y consulta de la documentación histórica."]],
]));

children.push(H2("3.4. Inspecciones (gestión web)"));
children.push(featTable([
  ["Inspecciones", ["Planificación y administración de las inspecciones desde la web."]],
  ["Actas", ["Gestión de las actas de inspección generadas en campo."]],
  ["Alertas", ["Avisos y alertas vinculados a inspecciones y vencimientos."]],
]));

children.push(H2("3.5. Aplicación móvil de inspección"));
children.push(P("Componente de mayor complejidad técnica. La utilizan los inspectores desde el celular, en campo:", { after: 100 }));
children.push(featTable([
  ["Actas en campo", ["Generación del acta de inspección directamente desde el celular."]],
  ["Co-inspección", [
    "Incorporación de un segundo agente a la inspección con consentimiento explícito.",
    "Firmas pre-registradas de los inspectores.",
    "Panel de pendientes con actualización en tiempo real y alerta sonora.",
  ]],
  ["Trabajo colaborativo en vivo", [
    "Fotos compartidas en vivo entre los dos inspectores.",
    "Vista en vivo del acta para el segundo agente, con botón flotante de fotos.",
    "El descarte del acta en curso cierra automáticamente la co-inspección.",
  ]],
]));

children.push(H2("3.6. Portal de Empresas (autogestión externa)"));
children.push(featTable([
  ["Acceso empresas", ["Entorno de acceso para las empresas radicadas en los parques."]],
  ["Mis expedientes", ["Seguimiento por parte de la empresa del estado de sus expedientes."]],
  ["Mi cuenta", ["Gestión de los datos y la cuenta de la empresa."]],
]));

children.push(H2("3.7. Tablero e indicadores"));
children.push(featTable([
  ["Dashboard", ["Tablero de indicadores con gráficos para la toma de decisiones."]],
  ["Consultas y reportes", ["Consultas y reportes sobre la información del sistema."]],
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 4. ARQUITECTURA
children.push(H1("4. Arquitectura, tecnología e infraestructura"));
children.push(bullet([new TextRun({ text: "Frontend: ", bold: true }), new TextRun("aplicación web moderna (React + Vite), responsiva para escritorio y celular.")]));
children.push(bullet([new TextRun({ text: "Backend y base de datos: ", bold: true }), new TextRun("Supabase (PostgreSQL) con seguridad a nivel de fila, funciones y capacidades en tiempo real.")]));
children.push(bullet([new TextRun({ text: "Despliegue: ", bold: true }), new TextRun("publicación continua en la nube (Vercel), con actualización automática ante cada versión.")]));
children.push(bullet([new TextRun({ text: "Correo: ", bold: true }), new TextRun("servicio SMTP para los emails de recuperación y notificaciones.")]));
children.push(bullet([new TextRun({ text: "Disponibilidad: ", bold: true }), new TextRun("accesible vía web desde cualquier dispositivo, sin instalación.")], false));

// 5. MODELO 1
children.push(H1("5. Modelo 1 — Llave en mano (pago único)"));
children.push(P("Entrega del sistema completo, puesto en producción y operativo, con capacitación, migración de datos y garantía.", { after: 120 }));
children.push(H2("5.1. Desarrollo del sistema (producto)"));
children.push(moneyTable([
  ["Núcleo, seguridad, login unificado, roles y delegación, auditoría (incluye 29 migraciones de base de datos y RLS)", "18.000", "27.000.000"],
  ["Gestión territorial — Parques, Parcelas y Empresas", "10.000", "15.000.000"],
  ["Expedientes, Flujos (workflow), Documentos, Escrituraciones y Archivo", "16.000", "24.000.000"],
  ["Inspecciones (web) y Alertas", "8.000", "12.000.000"],
  ["Aplicación móvil de inspección (co-inspección, firmas, fotos en vivo, alertas)", "22.000", "33.000.000"],
  ["Portal de Empresas (acceso externo)", "9.000", "13.500.000"],
  ["Dashboard, reportes, consultas y Mi Cuenta", "9.000", "13.500.000"],
], [["Subtotal producto", "92.000", "138.000.000"]]));

children.push(H2("5.2. Servicios de implementación"));
children.push(moneyTable([
  ["Puesta en marcha, despliegue productivo y configuración (Supabase, Vercel, SMTP, dominio)", "8.000", "12.000.000"],
  ["Migración y carga inicial de datos", "9.000", "13.500.000"],
  ["Capacitación (personal de gestión e inspectores)", "7.000", "10.500.000"],
  ["Documentación y manuales de uso", "4.000", "6.000.000"],
  ["Gestión de proyecto (PM)", "6.000", "9.000.000"],
], [["Subtotal servicios", "34.000", "51.000.000"]]));

children.push(H2("5.3. Total llave en mano"));
children.push(moneyTable([], [
  ["Neto", "126.000", "189.000.000", LIGHT],
  ["IVA 21%", "26.460", "39.690.000", LIGHTER],
  ["TOTAL con IVA", "152.460", "228.690.000", LIGHT],
]));
children.push(P("Incluye garantía post-implementación de 90 días (corrección de defectos sin cargo). Esfuerzo equivalente: ~1.600 a 1.800 horas de desarrollo e implementación.", { before: 120, italics: true, color: GREY, size: 19 }));
children.push(P("Esquema de pago sugerido: 40% de anticipo · 40% contra puesta en producción · 20% al finalizar la garantía.", { italics: true, color: GREY, size: 19, after: 60 }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 6. MODELO 2
children.push(H1("6. Modelo 2 — Licencia anual (SaaS gestionado)"));
children.push(P("Derecho de uso del sistema con infraestructura, soporte, mantenimiento y mejoras incluidas, bajo un abono anual. Modalidad recomendada por su menor barrera de entrada y por tratarse de gasto operativo (no de capital).", { after: 120 }));
children.push(H2("6.1. Desglose del abono anual"));
children.push(moneyTable([
  ["Derecho de uso / licencia del software", "24.000", "36.000.000"],
  ["Infraestructura gestionada (Supabase Pro, Vercel, SMTP, backups, dominio)", "3.600", "5.400.000"],
  ["Soporte y mesa de ayuda (SLA — gestión e inspectores)", "9.000", "13.500.000"],
  ["Mantenimiento correctivo (errores, parches de seguridad, actualizaciones)", "6.000", "9.000.000"],
  ["Evolutivo incluido (bolsa de ~80 a 100 horas/año de mejoras)", "7.000", "10.500.000"],
], [
  ["Neto anual", "49.600", "74.400.000", LIGHTER],
  ["IVA 21%", "10.416", "15.624.000", LIGHTER],
  ["TOTAL con IVA (anual)", "60.016", "90.024.000", LIGHT],
]));
children.push(P("Equivale a aproximadamente $7.500.000 por mes (con IVA). Facturación anual anticipada o trimestral. Se recomienda contrato a 3 o 4 años.", { before: 120, italics: true, color: GREY, size: 19, after: 60 }));

children.push(H2("6.2. Opción híbrida (recomendada)"));
children.push(P("Combina una puesta en marcha reducida con el abono anual: baja la inversión inicial y asegura la continuidad del servicio.", { after: 100 }));
children.push(moneyTable([
  ["Setup inicial (puesta en marcha + capacitación + migración de datos)", "30.000", "45.000.000"],
  ["Licencia anual (según desglose 6.1)", "49.600", "74.400.000"],
], [["Año 1 (neto, setup + licencia)", "79.600", "119.400.000"]]));
children.push(P("A partir del segundo año se abona únicamente la licencia anual. En un horizonte de 4 años, esta modalidad recauda más que el llave en mano y brinda servicio continuo.", { before: 120, italics: true, color: GREY, size: 19, after: 60 }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// 7. AMPLIACIONES
children.push(H1("7. Ampliaciones y ajuste de la licencia"));
children.push(P("El sistema puede crecer según la demanda del organismo mediante tres mecanismos escalonados, definidos contractualmente para que la ampliación sea previsible y no requiera renegociar la totalidad del acuerdo:", { after: 100 }));
children.push(bullet([new TextRun({ text: "Bolsa de evolutivo (incluida): ", bold: true }), new TextRun("ajustes menores dentro de las ~80 a 100 horas anuales. Las horas adicionales se facturan a una tarifa preacordada (USD 55 a 70 por hora).")]));
children.push(bullet([new TextRun({ text: "Módulos nuevos (cotización aparte): ", bold: true }), new TextRun("desarrollos de mayor envergadura (p. ej. integración de catastro/drones, nuevos circuitos). Una vez entregados, la licencia anual se reajusta entre 12% y 18% del valor del módulo por su mantenimiento continuo.")]));
children.push(bullet([new TextRun({ text: "Licencia escalonada por uso: ", bold: true }), new TextRun("el abono puede atarse a variables que crecen con la demanda (cantidad de parques, de usuarios/inspectores activos y de módulos contratados), de modo que la ampliación ajuste el valor automáticamente.")], false));
children.push(P("Cláusulas previstas: tarifa de hora de evolutivo preacordada, procedimiento de orden de cambio (estimación y aprobación por escrito antes de ejecutar) y reajuste anual de la licencia.", { before: 80, italics: true, color: GREY, size: 19, after: 60 }));

// 8. CONDICIONES
children.push(H1("8. Condiciones comerciales"));
children.push(bullet([new TextRun({ text: "Moneda y tipo de cambio: ", bold: true }), new TextRun("valores expresados en dólares estadounidenses (USD) y convertidos a pesos al tipo de cambio MEP de $1.500 por USD. La facturación se realiza al tipo de cambio MEP del día de emisión (cláusula de actualización por volatilidad).")]));
children.push(bullet([new TextRun({ text: "Impuestos: ", bold: true }), new TextRun("IVA 21% discriminado. Se ajustará según el régimen de retenciones o exenciones que corresponda al organismo.")]));
children.push(bullet([new TextRun({ text: "Validez de la oferta: ", bold: true }), new TextRun("30 días corridos desde la fecha de la propuesta.")]));
children.push(bullet([new TextRun({ text: "Garantía: ", bold: true }), new TextRun("90 días post-implementación en la modalidad llave en mano; soporte y mantenimiento continuos en la modalidad de licencia.")]));
children.push(bullet([new TextRun({ text: "No incluye: ", bold: true }), new TextRun("la integración GIS/catastro (relevamiento con drones) ni desarrollos nuevos fuera del alcance descripto, que se cotizan por separado (ver punto 7).")], false));

children.push(P("Quedamos a disposición para coordinar una presentación del sistema y avanzar con la modalidad que mejor se ajuste a las necesidades del organismo.", { before: 200, after: 200 }));
children.push(P("CSS Developers", { bold: true, size: 24, color: NAVY }));
children.push(P("Ingeniería de software a medida", { italics: true, color: GREY, size: 19, after: 60 }));
children.push(P("[Nombre del responsable] · [Email] · [Teléfono]", { color: GREY, size: 20 }));

// ---------- build ----------
const doc = new Document({
  creator: "CSS Developers",
  title: "Propuesta Comercial SIGPIP",
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: NAVY, font: "Arial" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIGHT, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: BLUE, font: "Arial" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
  ]},
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({
      spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF", space: 4 } },
      tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
      children: [
        new TextRun({ text: "Propuesta Comercial — SIGPIP", size: 16, color: GREY }),
        new TextRun({ text: "\tCSS Developers", size: 16, color: GREY }),
      ] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 0 },
      children: [new TextRun({ text: "Página ", size: 16, color: GREY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
        new TextRun({ text: " de ", size: 16, color: GREY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("C:/dev/parquesindustriales/_propuesta/Propuesta-Comercial-SIGPIP.docx", buf);
  console.log("OK escrito");
});
