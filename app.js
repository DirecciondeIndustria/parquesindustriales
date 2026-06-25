// ════════════════════════════════════════════════════════════════
//  INSPECCIONES PARQUES INDUSTRIALES – Lógica de la aplicación
// ════════════════════════════════════════════════════════════════

const TOTAL_STEPS = 9;
const DRAFT_KEY = 'insp_draft_v1';
let currentStep = 1;
let agents = [];
let photos = [];            // array de dataURLs (JPEG comprimido)
let sigStore = { 1: null, 2: null, 3: null }; // firmas (dataURL PNG por firmante)
let editingId = null;        // id de inspección en curso (null = nueva)
let cachedList = [];         // historial cargado en memoria
let _draftTimer = null;      // debounce de autoguardado

// ── DB LAYER (Supabase o local) ──────────────────────────────────
let supa = null;
let ONLINE = false;
// Tabla destino de las actas (compartida con el SIGPIP). Por defecto la
// tabla histórica 'inspecciones'; en la integración se usa 'actas_inspeccion'.
const TABLA = (window.APP_CONFIG && window.APP_CONFIG.TABLA_ACTAS) || 'inspecciones';
let CURRENT_USER = null; // { id, email, nombre, rol } del inspector logueado

function initDB() {
  const c = window.APP_CONFIG || {};
  if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase) {
    try {
      supa = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
      ONLINE = true;
    } catch (e) { ONLINE = false; }
  }
  const badge = document.getElementById('modeBadge');
  badge.textContent = ONLINE ? 'Online' : 'Local';
  badge.className = 'mode-badge ' + (ONLINE ? 'mode-online' : 'mode-local');
  document.getElementById('configWarn').style.display = ONLINE ? 'none' : 'block';
}

async function dbList() {
  if (ONLINE) {
    const { data, error } = await supa.from(TABLA)
      .select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); toast('Error al cargar historial'); return localList(); }
    return data || [];
  }
  return localList();
}

function localList() {
  try { return JSON.parse(localStorage.getItem('inspecciones_list') || '[]'); }
  catch (e) { return []; }
}

// Número inicial configurado (correlatividad con actas previas hechas a mano)
function getStartNumber(anio) {
  const v = parseInt(localStorage.getItem('numeroInicial_' + anio) || '0', 10);
  return isNaN(v) ? 0 : v;
}
function setStartNumber(anio, n) {
  if (n && n > 0) localStorage.setItem('numeroInicial_' + anio, String(n));
  else localStorage.removeItem('numeroInicial_' + anio);
}

async function dbNextNumero(anio) {
  let next = 1;
  if (ONLINE) {
    const { data, error } = await supa.from(TABLA)
      .select('numero').eq('anio', anio).order('numero', { ascending: false }).limit(1);
    if (error) { console.error(error); }
    next = ((data && data[0]) ? data[0].numero : 0) + 1;
  } else {
    const list = localList().filter(r => r.anio === anio);
    next = list.reduce((m, r) => Math.max(m, r.numero || 0), 0) + 1;
  }
  // Respetar el número inicial elegido en Configuración
  return Math.max(next, getStartNumber(anio) || 1);
}

async function dbSave(record) {
  if (ONLINE) {
    if (record.id) {
      const { error } = await supa.from(TABLA).update(record).eq('id', record.id);
      if (error) throw error;
      return record.id;
    } else {
      const { data, error } = await supa.from(TABLA).insert(record).select('id').single();
      if (error) throw error;
      return data.id;
    }
  }
  // Local
  const list = localList();
  if (record.id) {
    const i = list.findIndex(r => r.id === record.id);
    if (i >= 0) list[i] = record; else list.unshift(record);
  } else {
    record.id = 'loc_' + Date.now();
    record.created_at = new Date().toISOString();
    list.unshift(record);
  }
  localStorage.setItem('inspecciones_list', JSON.stringify(list));
  return record.id;
}

async function dbDelete(id) {
  if (ONLINE && !String(id).startsWith('loc_')) {
    const { error } = await supa.from(TABLA).delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const list = localList().filter(r => String(r.id) !== String(id));
  localStorage.setItem('inspecciones_list', JSON.stringify(list));
}

// ── AUTENTICACIÓN (inspectores del SIGPIP) ───────────────────────
// La app comparte el Supabase del SIGPIP. Los inspectores inician sesión
// con el mismo usuario/clave que tienen en el SIGPIP (rol 'inspector').
async function ensureAuth() {
  const cfg = window.APP_CONFIG || {};
  if (!ONLINE || !cfg.REQUIERE_LOGIN) return true; // modo local: sin login
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (session) { await loadCurrentUser(); updateUserChip(); return true; }
  } catch (e) { console.error(e); }
  showLogin();
  return false;
}

async function loadCurrentUser() {
  try {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) { CURRENT_USER = null; return; }
    let nombre = user.email, rol = null, activo = true;
    try {
      const { data } = await supa.from('usuarios')
        .select('nombre, rol, activo').eq('id', user.id).single();
      if (data) { nombre = data.nombre || nombre; rol = data.rol; activo = data.activo !== false; }
    } catch (e) { /* sin fila en usuarios: igual queda autenticado */ }
    CURRENT_USER = { id: user.id, email: user.email, nombre, rol, activo };
  } catch (e) { console.error(e); CURRENT_USER = null; }
}

function showLogin() {
  const el = document.getElementById('loginScreen');
  if (el) el.classList.add('show');
}
function hideLogin() {
  const el = document.getElementById('loginScreen');
  if (el) el.classList.remove('show');
}

async function doLogin(ev) {
  if (ev) ev.preventDefault();
  const email = (document.getElementById('loginEmail').value || '').trim();
  const pass = document.getElementById('loginPass').value || '';
  const errBox = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errBox.style.display = 'none';
  if (!email || !pass) { errBox.textContent = 'Ingresá tu email y contraseña.'; errBox.style.display = 'block'; return; }
  btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Ingresando…';
  try {
    const { error } = await supa.auth.signInWithPassword({ email, password: pass });
    if (error) {
      errBox.textContent = 'Email o contraseña incorrectos.';
      errBox.style.display = 'block';
      return;
    }
    await loadCurrentUser();
    if (CURRENT_USER && CURRENT_USER.activo === false) {
      await supa.auth.signOut(); CURRENT_USER = null;
      errBox.textContent = 'Tu usuario está inactivo. Contactá al administrador.';
      errBox.style.display = 'block';
      return;
    }
    document.getElementById('loginPass').value = '';
    updateUserChip();
    hideLogin();
    await refreshDashboard();
  } catch (e) {
    errBox.textContent = 'No se pudo conectar. Revisá tu conexión.';
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
}

async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  try { await supa.auth.signOut(); } catch (e) {}
  CURRENT_USER = null;
  closeSettings();
  showLogin();
}

function updateUserChip() {
  const block = document.getElementById('sessionBlock');
  if (!block) return;
  if (ONLINE && CURRENT_USER) {
    block.style.display = 'block';
    const nombre = CURRENT_USER.nombre || CURRENT_USER.email || 'Inspector';
    document.getElementById('sessUser').textContent = nombre;
    document.getElementById('sessRol').textContent = CURRENT_USER.rol || 'usuario';
    document.getElementById('sessAvatar').textContent = (nombre.trim()[0] || 'I').toUpperCase();
  } else {
    block.style.display = 'none';
  }
}

// ── INIT ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('hdrLogo').src = window.LOGO_BASE64;
  const _ll = document.getElementById('loginLogo'); if (_ll) _ll.src = window.LOGO_BASE64;
  initDB();
  const _authed = await ensureAuth();
  if (_authed) await refreshDashboard();
  document.getElementById('agentInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addAgent(); }
  });
  window.addEventListener('resize', () => { if (document.getElementById('sigModal').classList.contains('show')) fitSigCanvas(); });
  document.getElementById('inspInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addInspector(); }
  });
  setupMasks();
  // Autoguardado de borrador mientras se completa el wizard
  const wiz = document.getElementById('screenWizard');
  wiz.addEventListener('input', scheduleDraftSave);
  wiz.addEventListener('change', scheduleDraftSave);
  // Teclado del visor de fotos
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('show')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbNav(-1);
    else if (e.key === 'ArrowRight') lbNav(1);
  });
});

// ── SCREEN ROUTING ───────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const isWizard = id === 'screenWizard';
  document.getElementById('navBar').style.display = isWizard ? 'flex' : 'none';
  document.getElementById('progressWrap').style.display = isWizard ? 'block' : 'none';
  document.getElementById('stepCounter').style.display = isWizard ? 'block' : 'none';
  document.getElementById('fabPhoto').style.display = isWizard ? 'flex' : 'none';
  document.getElementById('hdrBack').style.display = (id === 'screenHome') ? 'none' : 'flex';
  document.getElementById('hdrGear').style.display = (id === 'screenHome') ? 'flex' : 'none';
  document.getElementById('hdrTitle').textContent =
    id === 'screenWizard' ? 'Nueva Inspección' :
    id === 'screenDetail' ? 'Detalle del Acta' : 'Inspecciones Industriales';
  window.scrollTo({ top: 0 });
}

function goHome() {
  const inWizard = document.getElementById('screenWizard').classList.contains('active');
  const completed = document.getElementById('doneScreen').style.display === 'block';
  if (inWizard && !completed) {
    if (editingId === null) {
      // Nueva inspección a medias → guardar como borrador (no se pierde nada)
      if (hasWizardData()) { saveDraft(); toast('Guardado como borrador'); }
    } else {
      if (!confirm('¿Salir sin guardar los cambios de esta acta?')) return;
    }
  }
  editingId = null;
  resetWizardState();
  showScreen('screenHome');
  refreshDashboard();
}

// ── CONFIGURACIÓN (numeración) ───────────────────────────────────
async function openSettings() {
  const year = new Date().getFullYear();
  const cur = getStartNumber(year);
  document.getElementById('numeroInicial').value = cur > 0 ? cur : '';
  const next = await dbNextNumero(year);
  document.getElementById('nextNumText').innerHTML =
    `La próxima inspección será la <b>N° ${String(next).padStart(3, '0')}/${year}</b>`;
  renderInspList();
  updateUserChip();
  document.getElementById('settingsOverlay').classList.add('show');
  document.getElementById('settingsSheet').classList.add('show');
}
function closeSettings(ev) {
  if (ev && ev.target && ev.target.id !== 'settingsOverlay') return;
  document.getElementById('settingsOverlay').classList.remove('show');
  document.getElementById('settingsSheet').classList.remove('show');
}
async function saveSettings() {
  const year = new Date().getFullYear();
  const n = parseInt(document.getElementById('numeroInicial').value, 10);
  setStartNumber(year, isNaN(n) ? 0 : n);
  closeSettings();
  toast(n > 0 ? `Numeración configurada desde N° ${n}` : 'Numeración inicial restablecida');
}

// ── DASHBOARD ────────────────────────────────────────────────────
async function refreshDashboard() {
  cachedList = await dbList();
  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth();
  document.getElementById('statTotal').textContent = cachedList.length;
  document.getElementById('statAnio').textContent = cachedList.filter(r => r.anio === yr).length;
  document.getElementById('statMes').textContent = cachedList.filter(r => {
    const d = new Date(r.created_at || r.fecha); return d.getFullYear() === yr && d.getMonth() === mo;
  }).length;
  renderList();
  buildDatalists();
  checkDraftBanner();
}

function renderList() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const list = cachedList.filter(r => {
    if (!q) return true;
    return [r.razon_social, r.parque, r.ciudad, r.cuit, `${r.numero}/${r.anio}`]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  const cont = document.getElementById('actaList');
  const cnt = document.getElementById('listCount');
  if (cnt) cnt.textContent = list.length;
  // Sin animación de stagger mientras se busca (evita parpadeo por tecla)
  cont.classList.toggle('no-anim', !!q);
  if (list.length === 0) {
    cont.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/></svg>
      <p>${q ? 'Sin resultados para tu búsqueda.' : 'Todavía no hay inspecciones registradas.'}</p></div>`;
    return;
  }
  const pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const cal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  cont.innerHTML = list.map(r => {
    const num = String(r.numero || 0).padStart(3, '0');
    const fecha = r.fecha ? formatShortDate(r.fecha) : '';
    const d = r.datos || {};
    const nF = (r.fotos || []).length;
    const chips = [];
    if (d.enActividad) chips.push('<span class="chip ok">● En actividad</span>');
    else if (d.sinActividad) chips.push('<span class="chip warn">○ Sin actividad</span>');
    if (d.noPudoAcceder) chips.push('<span class="chip no">⃠ No accedió</span>');
    else if (d.accesoInterior || d.accesoPredi) chips.push('<span class="chip">✓ Con acceso</span>');
    if (nF) chips.push(`<span class="chip">📷 ${nF}</span>`);
    const estado = r.estado === 'borrador' ? '<span class="acta-status st-borrador">Borrador</span>' : '';
    return `<div class="acta-card" onclick="openDetail('${r.id}')">
      ${estado}
      <div class="acta-num"><span class="n">${num}</span><span class="y">${r.anio || ''}</span></div>
      <div class="acta-info">
        <div class="empresa">${esc(r.razon_social) || 'Sin razón social'}</div>
        <div class="meta">${pin} ${esc(r.parque) || '—'}${r.ciudad ? ' · ' + esc(r.ciudad) : ''}</div>
        <div class="meta">${cal} ${fecha}${r.cuit ? ' · CUIT ' + esc(r.cuit) : ''}</div>
        ${chips.length ? `<div class="meta tags">${chips.join(' ')}</div>` : ''}
      </div>
      <div class="acta-chev">${chev}</div>
    </div>`;
  }).join('');
}

// ── DETAIL ───────────────────────────────────────────────────────
let lbPhotos = [], lbIndex = 0;

function openDetail(id) {
  const r = cachedList.find(x => String(x.id) === String(id));
  if (!r) return;
  const num = String(r.numero || 0).padStart(3, '0');
  const d = r.datos || {};
  const fotos = r.fotos || [];
  const respFull = [d.respNombre, d.respApellido].filter(Boolean).join(' ') || '—';

  // Resúmenes legibles de los checkboxes
  const acceso = [];
  if (d.accesoPredi) acceso.push('Acceso al predio');
  if (d.accesoInterior) acceso.push('Acceso al interior');
  if (d.noPudoAcceder) { acceso.push('No se pudo acceder'); if (d.seNegoAcceso) acceso.push('· se negó'); if (d.otrosMotivos) acceso.push('· otros motivos'); }
  const estadoP = [];
  if (d.cercado) estadoP.push('Cercado'); if (d.movSuelos) estadoP.push('Mov. de suelos'); if (d.sinModif) estadoP.push('Sin modificaciones');
  if (d.sinConstruccion) estadoP.push('Sin construcción'); if (d.enConstruccion) estadoP.push('En construcción'); if (d.conConstruccion) estadoP.push('Construcción finalizada');
  const servicios = [];
  if (d.srvEnergia) servicios.push('Energía'); if (d.srvGasRed) servicios.push('Gas de red'); if (d.srvGasEnvasado) servicios.push('Gas envasado');
  if (d.srvAguaPot) servicios.push('Agua potable'); if (d.srvAguaInd) servicios.push('Agua industrial'); if (d.srvCloacas) servicios.push('Cloacas');
  if (d.srvOtros) servicios.push(d.srvOtrosTexto || 'Otros');
  const actividad = d.enActividad ? 'En actividad' : (d.sinActividad ? 'Sin actividad' : '—');

  const row = (k, v) => v ? `<div class="dl-row"><span class="dl-k">${k}</span><span class="dl-v">${esc(v)}</span></div>` : '';
  const block = (title, rows) => rows.trim() ? `<div class="detail-section"><h3>${title}</h3>${rows}</div>` : '';

  lbPhotos = fotos;
  const gallery = fotos.length ? `<div class="detail-section"><h3>📷 Registro fotográfico (${fotos.length})</h3>
    <div class="detail-photos">${fotos.map((src, i) => `<img src="${src}" onclick="openLightbox(${i})" alt="Foto ${i + 1}">`).join('')}</div></div>` : '';

  document.getElementById('screenDetail').innerHTML = `
    <div class="detail-head">
      ${r.estado === 'borrador' ? '<div class="acta-status st-borrador" style="position:static;display:inline-block;margin-bottom:6px">Borrador</div>' : ''}
      <div class="num">Acta Nº ${num}/${r.anio || ''}</div>
      <div class="empresa">${esc(r.razon_social) || 'Sin razón social'}</div>
      <div class="meta">
        📍 ${esc(r.parque) || '—'}${r.ciudad ? ', ' + esc(r.ciudad) : ''}<br>
        📅 ${r.fecha ? formatLongDate(r.fecha) : '—'}${d.hora ? ' · ' + esc(d.hora) + ' hs' : ''}
      </div>
    </div>

    ${block('Empresa y responsable',
      row('Razón social', r.razon_social) + row('CUIT', r.cuit) +
      row('Domicilio legal', d.domicilioEmpresa) + row('Correo', d.emailEmpresa) +
      row('Recibe', respFull + (d.respCargo ? ' (' + d.respCargo + ')' : '')) + row('DNI', d.respDni) +
      row('Agentes', (d.agents || []).join(', ')))}

    ${block('Establecimiento',
      row('Predio', d.establecimiento) + row('Dirección', d.domicilioEstablec) +
      row('Parque', d.parqueIndustrial) +
      row('Nom. catastral', [d.ejido && 'Ej.' + d.ejido, d.circ && 'Circ.' + d.circ, d.sector && 'S.' + d.sector, d.division && 'D.' + d.division, d.parcela && 'P.' + d.parcela].filter(Boolean).join(' ')))}

    ${block('Acceso', row('Resultado', acceso.join(' ')) + row('Observaciones', d.obsAcceso) + row('Motivos', d.otrosMotivosTexto))}
    ${block('Estado del predio', row('Estado', estadoP.join(', ')) + row('Construcción', d.estadoConstruccion) + row('Observaciones', d.obsEstadoPredi))}
    ${block('Actividad industrial', row('Estado', actividad) + row('Detalle', d.detalleActividad) + row('Productos/servicios', d.productos) + row('Personal', d.personal) + row('Capacidad', d.capacidad) + row('Observaciones', d.obsActividad))}
    ${block('Servicios', row('Disponibles', servicios.join(', ')) + row('Observaciones', d.obsServicios))}
    ${block('Otras observaciones', d.otrasObs ? `<div style="font-size:13.5px;line-height:1.6;color:var(--ink-soft)">${esc(d.otrasObs)}</div>` : '')}
    ${gallery}

    <div class="detail-actions">
      <button class="btn btn-success" onclick="downloadFromRecord('${r.id}')">📄 Descargar PDF</button>
      <button class="btn btn-primary" onclick="editInspeccion('${r.id}')">✏️ Editar acta</button>
      <button class="btn btn-ghost" onclick="duplicateAsNew('${r.id}')">📋 Usar como base para nueva</button>
      <button class="btn btn-danger" onclick="deleteInspeccion('${r.id}')">🗑️ Eliminar acta</button>
      <button class="btn btn-prev" onclick="goHome()">Volver al inicio</button>
    </div>`;
  showScreen('screenDetail');
}

// ── EDITAR / ELIMINAR ────────────────────────────────────────────
async function editInspeccion(id) {
  const r = cachedList.find(x => String(x.id) === String(id));
  if (!r) return;
  resetWizardState();
  editingId = r.id;
  showScreen('screenWizard');
  goToStep(1);
  loadDataIntoForm(r.datos || {}, true);
  photos = (r.fotos || []).slice();
  sigStore = { 1: r.sig1 || null, 2: r.sig2 || null, 3: r.sig3 || null };
  renderPhotos(); updateFab();
  document.getElementById('hdrTitle').textContent = `Editar Acta ${String(r.numero).padStart(3, '0')}/${r.anio}`;
  toast('Editando acta — modificá lo necesario y finalizá');
}

async function deleteInspeccion(id) {
  const r = cachedList.find(x => String(x.id) === String(id));
  if (!r) return;
  if (!confirm(`¿Eliminar definitivamente el Acta Nº ${String(r.numero).padStart(3, '0')}/${r.anio}? Esta acción no se puede deshacer.`)) return;
  await dbDelete(id);
  toast('Acta eliminada');
  await refreshDashboard();
  goHome();
}

async function downloadFromRecord(id) {
  const r = cachedList.find(x => String(x.id) === String(id));
  if (!r) return;
  const d = Object.assign({}, r.datos, {
    actaNum: r.numero, actaYear: r.anio, photos: r.fotos || [],
    sig1: r.sig1, sig2: r.sig2, sig3: r.sig3
  });
  await renderPDF(d);
}

function duplicateAsNew(id) {
  const r = cachedList.find(x => String(x.id) === String(id));
  if (!r) return;
  startNewInspeccion(r.datos);
}

// ── START NEW INSPECTION ─────────────────────────────────────────
async function startNewInspeccion(prefill) {
  // Si hay un borrador sin terminar, ofrecer continuarlo antes de pisarlo
  if (!prefill && getDraft()) {
    if (confirm('Tenés una inspección sin terminar guardada como borrador.\n\nAceptar = continuar ese borrador.\nCancelar = empezar una nueva (se descarta el borrador).')) {
      resumeDraft(); return;
    }
    clearDraft();
  }
  resetWizardState();
  editingId = null;
  showScreen('screenWizard');
  goToStep(1);

  const now = new Date();
  const year = now.getFullYear();
  document.getElementById('fecha').value = now.toISOString().split('T')[0];
  document.getElementById('hora').value = now.toTimeString().slice(0, 5);

  // Autonumeración (editable por el usuario)
  const next = await dbNextNumero(year);
  document.getElementById('actaNum').value = next;
  document.getElementById('actaYear').value = year;

  if (prefill) {
    // Precargar datos de empresa/predio desde un acta previa (sin número, firmas ni fotos)
    loadDataIntoForm(prefill, false);
    toast('Datos precargados del acta anterior');
  }
}

// Carga un objeto de datos del formulario en los campos del wizard.
// includeNumero=true conserva el N°/año (edición); false los deja autonumerados (duplicado).
function loadDataIntoForm(data, includeNumero) {
  Object.keys(data || {}).forEach(k => {
    if (!includeNumero && (k === 'actaNum' || k === 'actaYear')) return;
    const el = document.getElementById(k);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!data[k];
    else el.value = data[k] == null ? '' : data[k];
  });
  agents = Array.isArray(data.agents) ? [...data.agents] : [];
  renderAgents();
  // Poblar el desplegable de parques según la ciudad cargada (y conservar el guardado)
  updateParquesOptions(data.parqueIndustrial || '');
  reapplyConditionals();
}

function resetWizardState() {
  agents = []; photos = []; sigStore = { 1: null, 2: null, 3: null }; currentStep = 1;
  document.querySelectorAll('#screenWizard input, #screenWizard textarea').forEach(el => {
    if (el.type === 'checkbox') el.checked = false;
    else if (el.type !== 'hidden') el.value = '';
    el.classList.remove('invalid');
  });
  document.querySelectorAll('.field-err').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.conditional').forEach(c => c.classList.remove('show'));
  document.getElementById('doneScreen').style.display = 'none';
  updateParquesOptions();
  renderAgents(); renderPhotos(); updateFab();
}

// ── WIZARD NAVIGATION ────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('doneScreen').style.display = 'none';
  document.getElementById('navBar').style.display = 'flex';
  const el = document.getElementById('step' + n);
  if (el) el.classList.add('active');
  document.getElementById('progressFill').style.width = Math.round((n / TOTAL_STEPS) * 100) + '%';
  document.getElementById('stepCounter').innerHTML = `Paso <b>${n}</b> de ${TOTAL_STEPS}`;
  const prev = document.getElementById('btnPrev'), next = document.getElementById('btnNext');
  prev.style.display = n === 1 ? 'none' : 'flex';
  const arrowR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  if (n === TOTAL_STEPS) { next.innerHTML = 'Finalizar ' + check; next.className = 'btn btn-success'; }
  else { next.innerHTML = 'Siguiente ' + arrowR; next.className = 'btn btn-next'; }
  if (n === 9) renderSigList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function requireField(id, msg) {
  const el = document.getElementById(id);
  if (!el.value.trim()) {
    el.classList.add('invalid'); toast(msg); el.focus();
    el.addEventListener('input', () => el.classList.remove('invalid'), { once: true });
    return false;
  }
  el.classList.remove('invalid');
  return true;
}

function nextStep() {
  // Validación de campos obligatorios por paso
  if (currentStep === 1 && !requireField('ciudad', 'Ingresá la ciudad')) return;
  if (currentStep === 3) {
    if (!requireField('respNombre', 'Ingresá el nombre de quien recibe')) return;
    if (!requireField('razonSocial', 'Ingresá la razón social')) return;
  }
  if (currentStep < TOTAL_STEPS) { currentStep++; goToStep(currentStep); }
  else finishForm();
}
function prevStep() { if (currentStep > 1) { currentStep--; goToStep(currentStep); } }

async function finishForm() {
  document.getElementById('loadingOverlay').classList.add('show');
  document.getElementById('loadingText').textContent = ONLINE ? 'Guardando en la base de datos…' : 'Guardando…';
  try {
    const d = collectFormData();
    const record = {
      numero: parseInt(d.actaNum) || 0,
      anio: parseInt(d.actaYear) || new Date().getFullYear(),
      razon_social: d.razonSocial || '',
      cuit: d.cuit || '',
      parque: d.parqueIndustrial || '',
      ciudad: d.ciudad || '',
      fecha: d.fecha || null,
      estado: 'completada',
      datos: d,
      fotos: photos,
      sig1: sigStore[1] || null,
      sig2: sigStore[2] || null,
      sig3: sigStore[3] || null,
    };
    // Trazabilidad: qué inspector (usuario del SIGPIP) cargó el acta
    if (ONLINE && CURRENT_USER) {
      record.inspector_id = CURRENT_USER.id;
      record.inspector_nombre = CURRENT_USER.nombre || CURRENT_USER.email || null;
    }
    // Si estamos editando un acta existente, conservar su id y fecha de creación
    if (editingId) {
      record.id = editingId;
      const prev = cachedList.find(x => String(x.id) === String(editingId));
      if (prev && prev.created_at) record.created_at = prev.created_at;
    }
    editingId = await dbSave(record);
    clearDraft();
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('navBar').style.display = 'none';
    document.getElementById('progressFill').style.width = '100%';
    document.getElementById('stepCounter').textContent = '¡Completada!';
    const dest = ONLINE ? 'en la base de datos online' : 'en este dispositivo';
    document.getElementById('doneText').textContent =
      `Acta Nº ${String(record.numero).padStart(3,'0')}/${record.anio} guardada ${dest}.`;
    document.getElementById('doneScreen').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    alert('Error al guardar: ' + (err.message || err));
  } finally {
    document.getElementById('loadingOverlay').classList.remove('show');
  }
}

// ── AGENTS ───────────────────────────────────────────────────────
function addAgent() {
  const inp = document.getElementById('agentInput');
  const name = inp.value.trim();
  if (!name) return;
  agents.push(name); inp.value = ''; renderAgents();
}
function removeAgent(i) { agents.splice(i, 1); renderAgents(); }
function renderAgents() {
  document.getElementById('agentTags').innerHTML = agents.map((a, i) =>
    `<div class="agent-tag"><span>${esc(a)}</span><button onclick="removeAgent(${i})">×</button></div>`).join('');
}

// ── PHOTOS (con compresión) ──────────────────────────────────────
function addPhotos(files, fromFab) {
  const arr = Array.from(files || []);
  if (arr.length === 0) return;
  let pending = arr.length;
  arr.forEach(file => {
    compressImage(file, 1800, 0.85).then(dataUrl => {
      photos.push(dataUrl);
      renderPhotos(); updateFab();
      if (--pending === 0) {
        toast(`${arr.length === 1 ? 'Foto agregada' : arr.length + ' fotos agregadas'} (${photos.length} en total)`);
      }
    }).catch(() => { pending--; });
  });
  // reset inputs
  document.getElementById('photoInput').value = '';
  document.getElementById('fabPhotoInput').value = '';
}

function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = height * maxDim / width; width = maxDim; }
        else if (height > maxDim) { width = width * maxDim / height; height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function removePhoto(i) { photos.splice(i, 1); renderPhotos(); updateFab(); }

function renderPhotos() {
  const grid = document.getElementById('photoGrid');
  if (!grid) return;
  const hint = document.getElementById('photoHint');
  if (hint) hint.style.display = photos.length ? 'none' : 'block';
  const thumbs = photos.map((src, i) =>
    `<div class="photo-thumb"><img src="${src}"><button class="photo-del" onclick="removePhoto(${i})">×</button></div>`).join('');
  grid.innerHTML = thumbs +
    `<div class="photo-add-btn" onclick="document.getElementById('photoInput').click()"><div class="ico">📷</div><div>Agregar</div></div>`;
}

function updateFab() {
  const badge = document.getElementById('fabBadge');
  badge.textContent = photos.length;
  badge.style.display = photos.length ? 'flex' : 'none';
}

// ── FIRMAS (modal a pantalla completa, una por vez) ──────────────
const SIG_ROLES = { 1: 'Inspector titular', 2: 'Inspector 2 (opcional)', 3: 'Responsable de la empresa' };
let sigModalPad = null, currentSigN = 1, sigFlow = false;

function getSigDataURL(n) { return sigStore[n] || null; }

function sigPersonName(n) {
  if (n === 1) return (document.getElementById('agente1Nombre').value || '').trim() || (agents[0] || '');
  if (n === 2) return (document.getElementById('agente2Nombre').value || '').trim() || (agents[1] || '');
  return [document.getElementById('respNombre').value, document.getElementById('respApellido').value].filter(Boolean).join(' ');
}

function renderSigList() {
  const cont = document.getElementById('sigList');
  if (!cont) return;
  const pen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  cont.innerHTML = [1, 2, 3].map(n => {
    const signed = !!sigStore[n];
    const name = sigPersonName(n);
    const sub = signed ? ('Firmado' + (name ? ' · ' + esc(name) : '')) : (name ? esc(name) : (n === 3 ? 'Responsable' : 'Sin firmar'));
    return `<div class="sig-row ${signed ? 'signed' : ''}">
      <div class="sr-ico">${signed ? check : pen}</div>
      <div class="sr-info"><b>${esc(SIG_ROLES[n])}</b><span>${sub}</span></div>
      ${signed ? `<img class="sr-prev" src="${sigStore[n]}" alt="firma">` : ''}
      <button class="sr-btn" onclick="openSigModal(${n},false)">${signed ? 'Re-firmar' : 'Firmar'}</button>
    </div>`;
  }).join('');
  const resp = sigPersonName(3);
  document.getElementById('sigPersonLabel').textContent = resp ? ('Responsable firmante: ' + resp) : '';
}

function startSignFlow() { openSigModal(1, true); }

function openSigModal(n, flow) {
  currentSigN = n; sigFlow = !!flow;
  document.getElementById('sigmStep').textContent = n + ' / 3';
  const nm = sigPersonName(n);
  document.getElementById('sigmRole').textContent = SIG_ROLES[n] + (nm ? ' — ' + nm : '');
  document.getElementById('sigmSkip').style.display = sigFlow ? 'block' : 'none';
  document.getElementById('sigModal').classList.add('show');
  requestAnimationFrame(() => {
    fitSigCanvas();
    if (!sigModalPad) {
      sigModalPad = new SignaturePad(document.getElementById('sigmCanvas'), { penColor: '#0f2c49', minWidth: 1.1, maxWidth: 3.0, backgroundColor: 'rgba(255,255,255,0)' });
      document.getElementById('sigmCanvas').addEventListener('pointerdown', () => { document.getElementById('sigmPh').style.opacity = '0'; });
    }
    sigModalPad.clear();
    document.getElementById('sigmPh').style.opacity = '';
    if (sigStore[n]) {
      const ph = document.getElementById('sigmPh'); ph.style.opacity = '0';
      try { sigModalPad.fromDataURL(sigStore[n]); } catch (e) {}
    }
  });
}

function fitSigCanvas() {
  const canvas = document.getElementById('sigmCanvas');
  const stage = document.getElementById('sigmStage');
  if (!canvas || !stage) return;
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const w = stage.clientWidth, h = stage.clientHeight;
  const data = (sigModalPad && !sigModalPad.isEmpty()) ? sigModalPad.toData() : null;
  canvas.width = w * ratio; canvas.height = h * ratio;
  canvas.getContext('2d').scale(ratio, ratio);
  if (sigModalPad) { sigModalPad.clear(); if (data) sigModalPad.fromData(data); }
}

function clearSigModal() { if (sigModalPad) { sigModalPad.clear(); document.getElementById('sigmPh').style.opacity = ''; } }

function saveSigModal() {
  if (!sigModalPad || sigModalPad.isEmpty()) { toast('Firmá en el recuadro o tocá Omitir'); return; }
  sigStore[currentSigN] = sigModalPad.toDataURL('image/png');
  renderSigList();
  scheduleDraftSave();
  advanceSig();
}
function skipSig() { advanceSig(); }
function advanceSig() {
  if (sigFlow && currentSigN < 3) openSigModal(currentSigN + 1, true);
  else { closeSigModal(); toast('Firmas registradas'); }
}
function closeSigModal() { document.getElementById('sigModal').classList.remove('show'); renderSigList(); }

// ── CONDITIONALS ─────────────────────────────────────────────────
function toggleCond(checkId, targetId) {
  document.getElementById(targetId).classList.toggle('show', document.getElementById(checkId).checked);
}
function reapplyConditionals() {
  [['noPudoAcceder','noAccesoSub'],['otrosMotivos','otrosMotivosSub'],['enConstruccion','enConstrSub'],['enActividad','actividadSub'],['srvOtros','srvOtrosSub']]
    .forEach(([c, t]) => { if (document.getElementById(c)?.checked) document.getElementById(t).classList.add('show'); });
}

// ── COLLECT DATA ─────────────────────────────────────────────────
function collectFormData() {
  const chk = id => document.getElementById(id)?.checked || false;
  const val = id => document.getElementById(id)?.value || '';
  return {
    actaNum: val('actaNum'), actaYear: val('actaYear'),
    ciudad: val('ciudad'), fecha: val('fecha'), hora: val('hora'), agents: [...agents],
    establecimiento: val('establecimiento'), domicilioEstablec: val('domicilioEstablec'),
    parqueIndustrial: val('parqueIndustrial'), ciudadParque: val('ciudadParque'),
    ejido: val('ejido'), circ: val('circ'), sector: val('sector'), division: val('division'),
    parcela: val('parcela'), macizo: val('macizo'), manzana: val('manzana'),
    respNombre: val('respNombre'), respApellido: val('respApellido'), respDni: val('respDni'), respCargo: val('respCargo'),
    razonSocial: val('razonSocial'), cuit: val('cuit'), domicilioEmpresa: val('domicilioEmpresa'), emailEmpresa: val('emailEmpresa'),
    accesoPredi: chk('accesoPredi'), accesoInterior: chk('accesoInterior'), noPudoAcceder: chk('noPudoAcceder'),
    seNegoAcceso: chk('seNegoAcceso'), otrosMotivos: chk('otrosMotivos'), otrosMotivosTexto: val('otrosMotivosTexto'), obsAcceso: val('obsAcceso'),
    cercado: chk('cercado'), movSuelos: chk('movSuelos'), sinModif: chk('sinModif'),
    sinConstruccion: chk('sinConstruccion'), enConstruccion: chk('enConstruccion'), construcActual: chk('construcActual'),
    construcDetenida: chk('construcDetenida'), conConstruccion: chk('conConstruccion'),
    estadoConstruccion: val('estadoConstruccion'), obsEstadoPredi: val('obsEstadoPredi'),
    sinActividad: chk('sinActividad'), enActividad: chk('enActividad'), detalleActividad: val('detalleActividad'),
    productos: val('productos'), personal: val('personal'), capacidad: val('capacidad'), obsActividad: val('obsActividad'),
    srvEnergia: chk('srvEnergia'), srvGasRed: chk('srvGasRed'), srvGasEnvasado: chk('srvGasEnvasado'),
    srvAguaPot: chk('srvAguaPot'), srvAguaInd: chk('srvAguaInd'), srvCloacas: chk('srvCloacas'),
    srvOtros: chk('srvOtros'), srvOtrosTexto: val('srvOtrosTexto'), obsServicios: val('obsServicios'),
    otrasObs: val('otrasObs'),
    conformidadDDJJ: chk('conformidadDDJJ'), conformidadAclara: val('conformidadAclara'),
    agente1Nombre: val('agente1Nombre'), agente2Nombre: val('agente2Nombre'),
  };
}

// ── PDF (botón en pantalla final, usa estado actual) ─────────────
async function generatePDF() {
  const d = collectFormData();
  d.photos = photos;
  d.sig1 = getSigDataURL(1); d.sig2 = getSigDataURL(2); d.sig3 = getSigDataURL(3);
  await renderPDF(d);
}

async function renderPDF(d, returnBase64) {
  if (!returnBase64) {
    document.getElementById('loadingOverlay').classList.add('show');
    document.getElementById('loadingText').textContent = 'Generando PDF…';
    await new Promise(r => setTimeout(r, 50));
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297, ML = 22, MR = 22, TW = PW - ML - MR, footerY = PH - 12;
    let y = 18;
    const C_DARK = [26, 46, 74], C_ACCENT = [232, 80, 10], C_GRAY = [90, 110, 133], C_LIGHT = [205, 215, 227], C_BLACK = [15, 15, 15];

    const setFont = (st, sz, col) => { doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(...(col || C_BLACK)); };

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
        if (window.LOGO_BASE64) {
          const lw = 50, lh = lw * (105 / 827); // logo real 827x105
          doc.addImage(window.LOGO_BASE64, 'PNG', ML, 14, lw, lh);
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
    function checkY(n) { if (y + n > PH - 20) newPage(); }
    function gap(n) { y += (n || 3); }

    function sectionTitle(t) {
      checkY(14); gap(3);
      doc.setFillColor(...C_ACCENT); doc.rect(ML, y - 4, 2.5, 6, 'F');
      setFont('bold', 10.5, C_DARK); doc.text(t, ML + 5, y); y += 5;
      doc.setDrawColor(...C_LIGHT); doc.setLineWidth(0.3); doc.line(ML, y, PW - MR, y); y += 4;
    }
    // Dibuja una casilla vectorial (recuadro + tilde si está marcada)
    function drawCheckbox(x, yBase, checked, s) {
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
    function writeCheck(checked, label, indent, size) {
      const sz = size || 10; checkY(6.5);
      const bx = ML + (indent || 0);
      drawCheckbox(bx, y, checked);
      // Marcadas: negrita y color oscuro. Sin marcar: gris claro para que resalten las marcadas.
      setFont(checked ? 'bold' : 'normal', sz, checked ? C_DARK : [140, 152, 168]);
      const tx = bx + 5.4;
      const lines = doc.splitTextToSize(label, TW - (indent || 0) - 5.4);
      doc.text(lines, tx, y); y += lines.length * (sz * 0.42) + 2.6;
    }
    function writeLabel(label, value, size) {
      const sz = size || 9.5; checkY(8); setFont('bold', sz, C_DARK);
      const lw = doc.getTextWidth(label + ' '); doc.text(label + ' ', ML, y);
      setFont('normal', sz, C_BLACK);
      const vLines = doc.splitTextToSize(value || '—', TW - lw);
      doc.text(vLines[0], ML + lw, y);
      if (vLines.length > 1) { y += sz * 0.42 + 0.5; doc.text(vLines.slice(1), ML + lw, y); y += (vLines.length - 1) * (sz * 0.42 + 0.5); }
      else y += sz * 0.42 + 2;
    }
    function writeParagraph(txt, size) {
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
    const servicios = [
      [d.srvEnergia, 'Energía'], [d.srvAguaPot, 'Agua potable'],
      [d.srvGasRed, 'Gas de red'], [d.srvAguaInd, 'Agua de uso industrial'],
      [d.srvGasEnvasado, 'Gas envasado'], [d.srvCloacas, 'Cloacas'],
    ];
    const colW = TW / 2;
    checkY(servicios.length / 2 * 6.4 + 4);
    const baseY = y;
    function srvItem(item, x, yy) {
      drawCheckbox(x, yy, item[0]);
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
    function sigBox(x, img, name, role) {
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
  } catch (err) {
    console.error(err); alert('Error al generar el PDF: ' + err.message);
  } finally {
    document.getElementById('loadingOverlay').classList.remove('show');
  }
}

// ── HELPERS ──────────────────────────────────────────────────────
function formatLongDate(s) {
  if (!s) return '___';
  const [y, m, dd] = s.split('-'); if (!y) return s;
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${parseInt(dd)} días del mes de ${months[parseInt(m) - 1]} de ${y}`;
}
function formatShortDate(s) {
  if (!s) return ''; const [y, m, dd] = s.split('-'); if (!y) return s; return `${dd}/${m}/${y}`;
}
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastT); window._toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// ════════════════════════════════════════════════════════════════
//  PESTAÑAS HISTORIAL / REPORTES
// ════════════════════════════════════════════════════════════════
function switchTab(which) {
  const isRep = which === 'rep';
  document.getElementById('tabHist').classList.toggle('active', !isRep);
  document.getElementById('tabRep').classList.toggle('active', isRep);
  document.getElementById('viewHistorial').style.display = isRep ? 'none' : 'block';
  document.getElementById('viewReportes').style.display = isRep ? 'block' : 'none';
  if (isRep) renderReportes();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ════════════════════════════════════════════════════════════════
//  AUTOGUARDADO DE BORRADOR
// ════════════════════════════════════════════════════════════════
function hasWizardData() {
  const d = collectFormData();
  const ignore = new Set(['actaNum', 'actaYear', 'fecha', 'hora']);
  for (const k in d) {
    if (ignore.has(k)) continue;
    const v = d[k];
    if (Array.isArray(v) ? v.length : (v === true || (typeof v === 'string' && v.trim()))) return true;
  }
  return photos.length > 0;
}

function scheduleDraftSave() {
  if (editingId !== null) return;                  // no autoguardar ediciones de actas existentes
  if (!document.getElementById('screenWizard').classList.contains('active')) return;
  if (document.getElementById('doneScreen').style.display === 'block') return;
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(saveDraft, 700);
}

function saveDraft() {
  if (editingId !== null || !hasWizardData()) return;
  try {
    const draft = {
      datos: collectFormData(),
      photos: photos,
      sigs: { 1: getSigDataURL(1), 2: getSigDataURL(2), 3: getSigDataURL(3) },
      step: currentStep,
      ts: Date.now()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) { /* cuota llena: ignorar */ }
}

function clearDraft() { localStorage.removeItem(DRAFT_KEY); _draftTimer && clearTimeout(_draftTimer); checkDraftBanner(); }

function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
}

function checkDraftBanner() {
  const banner = document.getElementById('draftBanner');
  const draft = getDraft();
  if (!draft) { banner.style.display = 'none'; return; }
  const d = draft.datos || {};
  const titulo = d.razonSocial || d.establecimiento || 'Inspección sin terminar';
  document.getElementById('draftTitle').textContent = titulo;
  const when = draft.ts ? new Date(draft.ts) : null;
  document.getElementById('draftMeta').textContent =
    'Borrador · paso ' + (draft.step || 1) + ' de ' + TOTAL_STEPS + (when ? ' · ' + when.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  banner.style.display = 'flex';
}

function resumeDraft() {
  const draft = getDraft();
  if (!draft) return;
  resetWizardState();
  editingId = null;
  showScreen('screenWizard');
  loadDataIntoForm(draft.datos || {}, true);
  photos = (draft.photos || []).slice();
  sigStore = Object.assign({ 1: null, 2: null, 3: null }, draft.sigs || {});
  renderPhotos(); updateFab();
  currentStep = Math.min(draft.step || 1, TOTAL_STEPS);
  goToStep(currentStep);
  toast('Borrador recuperado');
}

function discardDraft() {
  if (!confirm('¿Descartar el borrador guardado?')) return;
  clearDraft();
  toast('Borrador descartado');
}

// ════════════════════════════════════════════════════════════════
//  LIGHTBOX (visor de fotos)
// ════════════════════════════════════════════════════════════════
function openLightbox(i) {
  if (!lbPhotos.length) return;
  lbIndex = i;
  document.getElementById('lbImg').src = lbPhotos[i];
  document.getElementById('lbCount').textContent = (i + 1) + ' / ' + lbPhotos.length;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }
function lbNav(dir) {
  lbIndex = (lbIndex + dir + lbPhotos.length) % lbPhotos.length;
  openLightbox(lbIndex);
}

// ════════════════════════════════════════════════════════════════
//  COPIAS DE SEGURIDAD / EXPORTACIÓN
// ════════════════════════════════════════════════════════════════
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

function exportBackup() {
  const data = { app: 'inspecciones-industria', version: 1, exported_at: new Date().toISOString(), inspecciones: cachedList };
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(JSON.stringify(data), `respaldo_inspecciones_${stamp}.json`, 'application/json');
  toast('Respaldo descargado');
}

async function importBackup(files) {
  const file = (files || [])[0];
  document.getElementById('restoreInput').value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.inspecciones;
    if (!Array.isArray(arr)) throw new Error('Formato no reconocido');
    if (!confirm(`El respaldo contiene ${arr.length} inspección(es). Se agregarán/combinarán con las actuales. ¿Continuar?`)) return;
    if (ONLINE) {
      for (const r of arr) { const rec = Object.assign({}, r); delete rec.id; await dbSave(rec); }
    } else {
      const cur = localList();
      const byKey = new Map(cur.map(r => [r.numero + '-' + r.anio, r]));
      arr.forEach(r => { byKey.set((r.numero) + '-' + (r.anio), r); });
      localStorage.setItem('inspecciones_list', JSON.stringify([...byKey.values()]));
    }
    await refreshDashboard();
    toast(`Restauradas ${arr.length} inspecciones`);
  } catch (e) { alert('No se pudo restaurar el respaldo: ' + (e.message || e)); }
}

function exportCSV() {
  if (!cachedList.length) { toast('No hay inspecciones para exportar'); return; }
  const cols = [
    ['N°', r => r.numero], ['Año', r => r.anio], ['Fecha', r => r.fecha || ''],
    ['Razón social', r => r.razon_social || ''], ['CUIT', r => r.cuit || ''],
    ['Parque', r => r.parque || ''], ['Ciudad', r => r.ciudad || ''],
    ['Responsable', r => [r.datos?.respNombre, r.datos?.respApellido].filter(Boolean).join(' ')],
    ['DNI', r => r.datos?.respDni || ''], ['Cargo', r => r.datos?.respCargo || ''],
    ['Acceso', r => r.datos?.noPudoAcceder ? 'No' : ((r.datos?.accesoPredi || r.datos?.accesoInterior) ? 'Sí' : '')],
    ['Actividad', r => r.datos?.enActividad ? 'En actividad' : (r.datos?.sinActividad ? 'Sin actividad' : '')],
    ['Personal', r => r.datos?.personal || ''], ['Productos/servicios', r => r.datos?.productos || ''],
    ['Energía', r => r.datos?.srvEnergia ? 'Sí' : ''], ['Gas red', r => r.datos?.srvGasRed ? 'Sí' : ''],
    ['Agua potable', r => r.datos?.srvAguaPot ? 'Sí' : ''], ['Cloacas', r => r.datos?.srvCloacas ? 'Sí' : ''],
    ['Fotos', r => (r.fotos || []).length], ['Observaciones', r => r.datos?.otrasObs || ''],
  ];
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const rows = cachedList.map(r => cols.map(c => q(c[1](r))).join(';'));
  const csv = '﻿' + cols.map(c => q(c[0])).join(';') + '\n' + rows.join('\n');
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `inspecciones_${stamp}.csv`, 'text/csv;charset=utf-8');
  toast('CSV exportado (abrir con Excel)');
}

// ════════════════════════════════════════════════════════════════
//  MÁSCARAS Y SUGERENCIAS DE ENTRADA
// ════════════════════════════════════════════════════════════════
function fmtCuit(v) {
  const n = (v || '').replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 10) return n.slice(0, 2) + '-' + n.slice(2);
  return n.slice(0, 2) + '-' + n.slice(2, 10) + '-' + n.slice(10);
}
function fmtDni(v) {
  const n = (v || '').replace(/\D/g, '').slice(0, 8);
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function setupMasks() {
  const cuit = document.getElementById('cuit');
  if (cuit) cuit.addEventListener('input', () => { const p = cuit.selectionStart; cuit.value = fmtCuit(cuit.value); });
  const dni = document.getElementById('respDni');
  if (dni) dni.addEventListener('input', () => { dni.value = fmtDni(dni.value); });
}

// Sugerencias (datalist) a partir del historial: agentes, parques, ciudades
function buildDatalists() {
  const agentes = new Set(getInspectores());
  cachedList.forEach(r => { (r.datos?.agents || []).forEach(a => a && agentes.add(a)); });
  let dl = document.getElementById('dl-agentes');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-agentes'; document.body.appendChild(dl); }
  dl.innerHTML = [...agentes].sort().map(v => `<option value="${esc(v)}">`).join('');
  ['agentInput', 'agente1Nombre', 'agente2Nombre'].forEach(id => {
    const el = document.getElementById(id); if (el) el.setAttribute('list', 'dl-agentes');
  });
}

// ════════════════════════════════════════════════════════════════
//  CIUDADES Y PARQUES INDUSTRIALES (selección encadenada)
// ════════════════════════════════════════════════════════════════
const PARQUES_POR_CIUDAD = {
  'Comodoro Rivadavia': ['Parque Industrial Pesado', 'Sector Equipamientos Complementarios'],
  'Trelew': ['Parque Industrial Pesado', 'Zona de Actividades Complementarias'],
  'Puerto Madryn': ['Parque Industrial Pesado', 'Parque Industrial Liviano', 'Parque Industrial Pesquero', 'Zona Industrial Conexa al Aluminio'],
  'Trevelin': ['Parque Industrial Pesado'],
};

function updateParquesOptions(selected) {
  const sel = document.getElementById('parqueIndustrial');
  if (!sel) return;
  const ciudad = document.getElementById('ciudad').value;
  const list = (PARQUES_POR_CIUDAD[ciudad] || []).slice();
  if (selected && !list.includes(selected)) list.push(selected); // conservar valor previo/legacy
  const placeholder = ciudad ? 'Elegí el parque…' : 'Elegí primero la ciudad (Paso 1)…';
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    list.map(p => `<option ${p === selected ? 'selected' : ''}>${esc(p)}</option>`).join('');
}

function onCiudadChange() { updateParquesOptions(); }

// ════════════════════════════════════════════════════════════════
//  REGISTRO DE INSPECTORES (para autocompletar)
// ════════════════════════════════════════════════════════════════
function getInspectores() { try { return JSON.parse(localStorage.getItem('inspectores_reg') || '[]'); } catch (e) { return []; } }
function setInspectores(arr) { localStorage.setItem('inspectores_reg', JSON.stringify(arr)); }
function addInspector() {
  const inp = document.getElementById('inspInput');
  const n = (inp.value || '').trim();
  if (!n) return;
  const arr = getInspectores();
  if (!arr.some(x => x.toLowerCase() === n.toLowerCase())) arr.push(n);
  arr.sort((a, b) => a.localeCompare(b, 'es'));
  setInspectores(arr); inp.value = '';
  renderInspList(); buildDatalists();
}
function removeInspector(i) {
  const arr = getInspectores(); arr.splice(i, 1); setInspectores(arr);
  renderInspList(); buildDatalists();
}
function renderInspList() {
  const c = document.getElementById('inspList'); if (!c) return;
  const arr = getInspectores();
  c.innerHTML = arr.length
    ? arr.map((n, i) => `<span class="insp-chip">${esc(n)}<button onclick="removeInspector(${i})" aria-label="Quitar">×</button></span>`).join('')
    : '<span class="insp-empty">Todavía no hay inspectores cargados.</span>';
}

// ════════════════════════════════════════════════════════════════
//  REPORTES Y ESTADÍSTICAS
// ════════════════════════════════════════════════════════════════
let repYear = 'all';

function computeStats(year) {
  const data = cachedList.filter(r => year === 'all' || r.anio === year);
  const s = {
    total: data.length, byMonth: Array(12).fill(0), byParque: {},
    acceso: { con: 0, sin: 0, nd: 0 }, actividad: { activa: 0, sin: 0, nd: 0 },
    servicios: { srvEnergia: 0, srvGasRed: 0, srvGasEnvasado: 0, srvAguaPot: 0, srvAguaInd: 0, srvCloacas: 0 },
    construccion: { sin: 0, en: 0, fin: 0 }, totalFotos: 0, personalTotal: 0,
  };
  data.forEach(r => {
    const d = r.datos || {};
    const fecha = r.fecha || (r.created_at ? r.created_at.slice(0, 10) : '');
    const mo = fecha ? parseInt(fecha.split('-')[1], 10) - 1 : null;
    if (mo != null && mo >= 0 && mo < 12) s.byMonth[mo]++;
    const pq = (r.parque || d.parqueIndustrial || 'Sin parque').trim();
    s.byParque[pq] = (s.byParque[pq] || 0) + 1;
    if (d.noPudoAcceder) s.acceso.sin++; else if (d.accesoPredi || d.accesoInterior) s.acceso.con++; else s.acceso.nd++;
    if (d.enActividad) s.actividad.activa++; else if (d.sinActividad) s.actividad.sin++; else s.actividad.nd++;
    Object.keys(s.servicios).forEach(k => { if (d[k]) s.servicios[k]++; });
    if (d.sinConstruccion) s.construccion.sin++; if (d.enConstruccion) s.construccion.en++; if (d.conConstruccion) s.construccion.fin++;
    s.totalFotos += (r.fotos || []).length;
    const p = parseInt((d.personal || '').replace(/\D/g, ''), 10); if (!isNaN(p)) s.personalTotal += p;
  });
  return s;
}

function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

function donutSVG(segments, centerText) {
  const total = segments.reduce((a, x) => a + x.value, 0) || 1;
  let off = 0;
  const circles = segments.filter(x => x.value > 0).map(x => {
    const len = (x.value / total) * 100;
    const c = `<circle cx="18" cy="18" r="15.915" fill="none" stroke="${x.color}" stroke-width="4.2"
      stroke-dasharray="${len.toFixed(2)} ${(100 - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len; return c;
  }).join('');
  return `<svg class="donut" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#eef2f7" stroke-width="4.2"/>
    ${circles}
    <text class="donut-center" x="18" y="18" text-anchor="middle" dominant-baseline="central" transform="rotate(90 18 18)">${centerText}</text>
  </svg>`;
}
function legend(items) {
  return `<div class="legend">${items.map(it =>
    `<div class="legend-item"><span class="legend-dot" style="background:${it.color}"></span><span class="lg-l">${it.label}</span><span class="lg-v">${it.value}</span></div>`
  ).join('')}</div>`;
}

function renderReportes() {
  const cont = document.getElementById('viewReportes');
  const years = [...new Set(cachedList.map(r => r.anio).filter(Boolean))].sort((a, b) => b - a);
  if (repYear !== 'all' && !years.includes(repYear)) repYear = 'all';

  if (!cachedList.length) {
    cont.innerHTML = `<div class="rep-card"><div class="rep-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>
      <p>Todavía no hay inspecciones para generar reportes.</p></div></div>`;
    return;
  }
  const s = computeStats(repYear);
  const meses = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const maxMonth = Math.max(1, ...s.byMonth);

  // KPIs
  const kpis = `<div class="kpi-grid">
    <div class="kpi"><div class="kv">${s.total}</div><div class="kl">Inspecciones</div></div>
    <div class="kpi ok"><div class="kv">${pct(s.actividad.activa, s.total)}%</div><div class="kl">En actividad</div><div class="ks">${s.actividad.activa} de ${s.total}</div></div>
    <div class="kpi accent"><div class="kv">${pct(s.acceso.con, s.total)}%</div><div class="kl">Con acceso</div><div class="ks">${s.acceso.con} de ${s.total}</div></div>
    <div class="kpi"><div class="kv">${Object.keys(s.byParque).length}</div><div class="kl">Parques</div><div class="ks">${s.totalFotos} fotos</div></div>
  </div>`;

  // Por mes
  const porMes = `<div class="rep-card">
    <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Inspecciones por mes</h3>
    <div class="rsub">Distribución mensual ${repYear === 'all' ? '(todos los años)' : 'de ' + repYear}</div>
    <div class="vbars">${s.byMonth.map((n, i) =>
      `<div class="vbar"><div class="vb-n">${n || ''}</div><div class="vb-fill" style="height:${Math.round((n / maxMonth) * 100)}%"></div><div class="vb-x">${meses[i]}</div></div>`
    ).join('')}</div></div>`;

  // Por parque (top 6)
  const parquesArr = Object.entries(s.byParque).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxPq = Math.max(1, ...parquesArr.map(p => p[1]));
  const porParque = `<div class="rep-card">
    <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Inspecciones por parque industrial</h3>
    <div class="rsub">Los parques con más actividad de inspección</div>
    ${parquesArr.map(([name, n]) => `<div class="bar-row">
      <span class="bar-label">${esc(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / maxPq) * 100)}%"></div></div>
      <span class="bar-val">${n}</span></div>`).join('')}</div>`;

  // Donut actividad + acceso
  const donAct = donutSVG([
    { value: s.actividad.activa, color: '#15803d' }, { value: s.actividad.sin, color: '#e8550d' }, { value: s.actividad.nd, color: '#cbd5e1' }
  ], pct(s.actividad.activa, s.total) + '%');
  const donAcc = donutSVG([
    { value: s.acceso.con, color: '#173a5e' }, { value: s.acceso.sin, color: '#dc2626' }, { value: s.acceso.nd, color: '#cbd5e1' }
  ], pct(s.acceso.con, s.total) + '%');
  const donuts = `<div class="rep-card">
    <h3>Actividad industrial</h3><div class="rsub">Estado al momento de la inspección</div>
    <div class="donut-wrap">${donAct}${legend([
      { label: 'En actividad', value: s.actividad.activa, color: '#15803d' },
      { label: 'Sin actividad', value: s.actividad.sin, color: '#e8550d' },
      { label: 'Sin dato', value: s.actividad.nd, color: '#cbd5e1' }])}</div>
    </div>
    <div class="rep-card">
    <h3>Acceso al predio</h3><div class="rsub">¿Se pudo ingresar al establecimiento?</div>
    <div class="donut-wrap">${donAcc}${legend([
      { label: 'Con acceso', value: s.acceso.con, color: '#173a5e' },
      { label: 'No se accedió', value: s.acceso.sin, color: '#dc2626' },
      { label: 'Sin dato', value: s.acceso.nd, color: '#cbd5e1' }])}</div>
    </div>`;

  // Cobertura de servicios
  const srvLabels = { srvEnergia: 'Energía', srvGasRed: 'Gas de red', srvGasEnvasado: 'Gas envasado', srvAguaPot: 'Agua potable', srvAguaInd: 'Agua industrial', srvCloacas: 'Cloacas' };
  const servicios = `<div class="rep-card">
    <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9z"/></svg> Cobertura de servicios</h3>
    <div class="rsub">% de predios que cuentan con cada servicio</div>
    ${Object.keys(srvLabels).map(k => { const p = pct(s.servicios[k], s.total); return `<div class="bar-row">
      <span class="bar-label">${srvLabels[k]}</span>
      <div class="bar-track"><div class="bar-fill ok" style="width:${p}%"></div></div>
      <span class="bar-val">${p}%</span></div>`; }).join('')}</div>`;

  const filtros = `<div class="rep-filters">
    <select onchange="repYear=this.value==='all'?'all':parseInt(this.value);renderReportes()">
      <option value="all" ${repYear === 'all' ? 'selected' : ''}>Todos los años</option>
      ${years.map(y => `<option value="${y}" ${repYear === y ? 'selected' : ''}>${y}</option>`).join('')}
    </select>
    <button class="btn btn-ghost" style="flex:0 0 auto;padding:0 16px" onclick="exportCSV()">📊 CSV</button>
    <button class="btn btn-primary" style="flex:0 0 auto;padding:0 16px" onclick="generarInforme()">📄 Informe</button>
  </div>`;

  cont.innerHTML = filtros + kpis + porMes + donuts + porParque + servicios;
  // Animar barras/donut al renderizar
  requestAnimationFrame(() => { /* transición ya aplicada por width/height inline */ });
}

// Informe PDF agregado de estadísticas
async function generarInforme() {
  const s = computeStats(repYear);
  if (!s.total) { toast('No hay datos para el informe'); return; }
  document.getElementById('loadingOverlay').classList.add('show');
  document.getElementById('loadingText').textContent = 'Generando informe…';
  await new Promise(r => setTimeout(r, 50));
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, ML = 22, TW = PW - 44; let y = 18;
    const C_DARK = [26, 46, 74], C_ACC = [232, 80, 10], C_GRAY = [90, 110, 133], C_LIGHT = [205, 215, 227];
    const sf = (st, sz, c) => { doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(...(c || [15, 15, 15])); };
    try { if (window.LOGO_BASE64) doc.addImage(window.LOGO_BASE64, 'PNG', ML, 12, 50, 50 * (105 / 827)); } catch (e) {}
    y = 30;
    sf('bold', 16, C_DARK); doc.text('INFORME DE INSPECCIONES', ML, y); y += 7;
    sf('normal', 10, C_GRAY); doc.text(`Período: ${repYear === 'all' ? 'Todos los años' : repYear}  ·  Generado: ${new Date().toLocaleDateString('es-AR')}`, ML, y); y += 4;
    doc.setDrawColor(...C_LIGHT); doc.line(ML, y, PW - ML, y); y += 9;

    const kpiData = [
      ['Total de inspecciones', s.total],
      ['En actividad', `${s.actividad.activa}  (${pct(s.actividad.activa, s.total)}%)`],
      ['Sin actividad', `${s.actividad.sin}  (${pct(s.actividad.sin, s.total)}%)`],
      ['Con acceso al predio', `${s.acceso.con}  (${pct(s.acceso.con, s.total)}%)`],
      ['Sin acceso', `${s.acceso.sin}  (${pct(s.acceso.sin, s.total)}%)`],
      ['Parques inspeccionados', Object.keys(s.byParque).length],
      ['Personal relevado (total)', s.personalTotal],
      ['Fotografías registradas', s.totalFotos],
    ];
    sf('bold', 12, C_ACC); doc.text('Indicadores generales', ML, y); y += 6;
    kpiData.forEach(([k, v]) => { sf('normal', 10.5, C_DARK); doc.text(k, ML + 2, y); sf('bold', 10.5, [15, 15, 15]); doc.text(String(v), PW - ML, y, { align: 'right' }); doc.setDrawColor(238, 242, 247); doc.line(ML, y + 1.6, PW - ML, y + 1.6); y += 7.4; });
    y += 5;

    sf('bold', 12, C_ACC); doc.text('Inspecciones por parque industrial', ML, y); y += 6;
    const parq = Object.entries(s.byParque).sort((a, b) => b[1] - a[1]);
    const maxPq = Math.max(1, ...parq.map(p => p[1]));
    parq.forEach(([name, n]) => {
      sf('normal', 10, C_DARK); doc.text(doc.splitTextToSize(name, 90)[0], ML + 2, y);
      const bx = ML + 96, bw = TW - 96 - 14;
      doc.setFillColor(238, 242, 247); doc.roundedRect(bx, y - 3.4, bw, 4.4, 1, 1, 'F');
      doc.setFillColor(...C_DARK); doc.roundedRect(bx, y - 3.4, Math.max(2, bw * (n / maxPq)), 4.4, 1, 1, 'F');
      sf('bold', 10, C_DARK); doc.text(String(n), PW - ML, y, { align: 'right' });
      y += 7; if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4;

    sf('bold', 12, C_ACC); doc.text('Cobertura de servicios', ML, y); y += 6;
    const srvL = { srvEnergia: 'Energía', srvGasRed: 'Gas de red', srvGasEnvasado: 'Gas envasado', srvAguaPot: 'Agua potable', srvAguaInd: 'Agua industrial', srvCloacas: 'Cloacas' };
    Object.keys(srvL).forEach(k => {
      const p = pct(s.servicios[k], s.total);
      sf('normal', 10, C_DARK); doc.text(srvL[k], ML + 2, y);
      const bx = ML + 96, bw = TW - 96 - 14;
      doc.setFillColor(238, 242, 247); doc.roundedRect(bx, y - 3.4, bw, 4.4, 1, 1, 'F');
      doc.setFillColor(31, 157, 84); doc.roundedRect(bx, y - 3.4, Math.max(2, bw * (p / 100)), 4.4, 1, 1, 'F');
      sf('bold', 10, C_DARK); doc.text(p + '%', PW - ML, y, { align: 'right' });
      y += 7;
    });

    sf('normal', 7.5, C_GRAY); doc.text('Av. 9 de julio 280 Rawson – Chubut  /  Tel. 280 4482606/607', PW / 2, 287, { align: 'center' });
    doc.save(`Informe_Inspecciones_${repYear === 'all' ? 'historico' : repYear}.pdf`);
  } catch (e) { alert('Error al generar el informe: ' + e.message); }
  finally { document.getElementById('loadingOverlay').classList.remove('show'); }
}
