import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Boton, inputCls, EncabezadoPagina, Skeleton } from '../components/ui';
import { fmtFecha } from '../lib/fechas';
import { renderActaPdf } from '../lib/pdfActaOficial';
import { satelliteDataUrl } from '../lib/satelite';
import { SAT_TILE_URL, SAT_ATTR, SAT_MAX_ZOOM, SAT_MAX_NATIVE } from '../lib/maptiler';
import { usePermisos } from '../lib/permisos';
import {
  type Terreno,
  fetchTerrenos, parseKmz, saveTerrenos, deleteTerrenosByArchivo,
  terrenoContaining, ringToLatLng,
  fetchVinculos, addVinculo, removeVinculo,
} from '../lib/terrenos';

// Acta completa cargada desde la app de inspecciones del celular.
// Tabla `actas_inspeccion` (ver migración 0024). Vista de SOLO LECTURA.
interface Acta {
  id: string;
  numero: number | null;
  anio: number | null;
  razon_social: string | null;
  cuit: string | null;
  parque: string | null;
  ciudad: string | null;
  fecha: string | null;
  estado: string | null;
  datos: Record<string, unknown> | null;
  fotos: string[] | null;
  sig1: string | null;
  sig2: string | null;
  sig3: string | null;
  inspector_nombre: string | null;
  lat: number | null;
  lng: number | null;
  geo_precision: number | null;
  geo_at: string | null;
  created_at: string;
}

const nro = (a: Acta) => `${String(a.numero ?? 0).padStart(3, '0')}/${a.anio ?? ''}`;
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export default function Actas() {
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Acta | null>(null);
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista');
  const [terrenosModal, setTerrenosModal] = useState(false);
  const { puedeEditar } = usePermisos();

  const { data: terrenos = [] } = useQuery({ queryKey: ['actas_terrenos'], queryFn: fetchTerrenos });

  const { data: actas = [], isLoading, error } = useQuery({
    queryKey: ['actas_inspeccion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actas_inspeccion')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Acta[];
    },
  });

  const q = busca.trim().toLowerCase();
  const visibles = q
    ? actas.filter((a) =>
        [a.razon_social, a.parque, a.ciudad, a.cuit, nro(a), a.inspector_nombre]
          .filter(Boolean).join(' ').toLowerCase().includes(q))
    : actas;

  return (
    <div>
      <EncabezadoPagina
        titulo="Inspecciones"
        descripcion={`${actas.length} acta${actas.length === 1 ? '' : 's'} recibida${actas.length === 1 ? '' : 's'} desde la app de inspectores`}
      />

      <p className="text-xs text-slate-400 mb-4">
        Vista informativa de solo lectura. Las actas se cargan desde la app móvil de inspecciones y se reflejan acá automáticamente.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className={`${inputCls} max-w-sm flex-1 min-w-[220px]`}
          placeholder="Buscar por empresa, parque, CUIT, N° o inspector…"
          value={busca} onChange={(e) => setBusca(e.target.value)}
        />
        <div className="inline-flex rounded-lg ring-1 ring-slate-200 overflow-hidden text-sm">
          <button
            className={`px-3 py-2 ${vista === 'lista' ? 'bg-[var(--brand)] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setVista('lista')}
          >Lista</button>
          <button
            className={`px-3 py-2 ${vista === 'mapa' ? 'bg-[var(--brand)] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setVista('mapa')}
          >Mapa</button>
        </div>
        {vista === 'mapa' && (
          <span className="text-xs text-slate-400">
            {visibles.filter((a) => a.lat != null && a.lng != null).length} de {visibles.length} con ubicación
          </span>
        )}
        {puedeEditar && (
          <button
            className="ml-auto px-3 py-2 text-sm rounded-lg ring-1 ring-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            onClick={() => setTerrenosModal(true)}
          >🗺️ Terrenos (KMZ){terrenos.length ? ` · ${terrenos.length}` : ''}</button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm mb-4">
          No se pudieron cargar las actas. Verificá que la migración <code>0024_actas_inspeccion.sql</code> esté aplicada en Supabase.
        </div>
      )}

      {vista === 'mapa' ? (
        <MapaActas actas={visibles} onSel={setSel} terrenos={terrenos} />
      ) : (
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Parque</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Inspector</th>
              <th className="px-4 py-3 font-medium">Fotos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
            )}
            {!isLoading && visibles.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                {q ? 'Sin resultados.' : 'Todavía no se recibieron actas desde la app.'}
              </td></tr>
            )}
            {visibles.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSel(a)}>
                <td className="px-4 py-3 font-semibold text-[var(--brand)]">{nro(a)}</td>
                <td className="px-4 py-3 text-slate-700">{txt(a.razon_social)}</td>
                <td className="px-4 py-3 text-slate-600">{txt(a.parque)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {txt(a.ciudad)}
                  {a.lat != null && a.lng != null && (
                    <span title="Acta con ubicación geográfica" className="ml-1">📍</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{fmtFecha(a.fecha)}</td>
                <td className="px-4 py-3 text-slate-600">{txt(a.inspector_nombre)}</td>
                <td className="px-4 py-3 text-slate-600">{a.fotos?.length ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[var(--brand)] hover:underline">Ver acta</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <Modal titulo={sel ? `Acta de inspección N° ${nro(sel)}` : ''} abierto={!!sel} onCerrar={() => setSel(null)}>
        {sel && (
          <>
            <div className="flex justify-end mb-3">
              <Boton onClick={async () => {
                const geoImg = sel.lat != null && sel.lng != null ? await satelliteDataUrl(sel.lat, sel.lng) : null;
                renderActaPdf({
                  actaNum: sel.numero, actaYear: sel.anio, ...(sel.datos ?? {}),
                  photos: sel.fotos ?? [], sig1: sel.sig1, sig2: sel.sig2, sig3: sel.sig3,
                  geoLat: sel.lat, geoLng: sel.lng, geoAcc: sel.geo_precision, geoImg,
                });
              }}>Descargar PDF</Boton>
            </div>
            <DetalleActa a={sel} terrenos={terrenos} />
          </>
        )}
      </Modal>

      <Modal titulo="Terrenos (KMZ de Google Earth)" abierto={terrenosModal} onCerrar={() => setTerrenosModal(false)}>
        <TerrenosManager terrenos={terrenos} />
      </Modal>
    </div>
  );
}

// ─────────── Detalle de solo lectura ───────────
function Dato({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="text-slate-500 min-w-[150px] shrink-0">{k}</span>
      <span className="text-slate-800 font-medium break-words">{txt(v)}</span>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--brand)] mb-2">{titulo}</h3>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">Sin marcar.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 text-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M20 6 9 17l-5-5" /></svg>
          {t}
        </span>
      ))}
    </div>
  );
}

// Carga Leaflet desde CDN una sola vez (sin sumar dependencia al build).
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return leafletPromise;
}

// Administración de terrenos: subir KMZ (varios), listarlos y borrarlos.
function TerrenosManager({ terrenos }: { terrenos: Terreno[] }) {
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState('');

  const grupos = Object.values(
    terrenos.reduce((acc, t) => {
      const k = t.archivo || '(sin nombre)';
      (acc[k] ||= { archivo: k, count: 0 }).count++;
      return acc;
    }, {} as Record<string, { archivo: string; count: number }>)
  );

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setSubiendo(true); setMsg('');
    let total = 0, archivos = 0, errores = 0;
    for (const file of Array.from(files)) {
      try {
        const polys = await parseKmz(file);
        if (!polys.length) { setMsg(`"${file.name}" no tenía polígonos.`); continue; }
        await saveTerrenos(polys, file.name);
        total += polys.length; archivos++;
      } catch (e) { errores++; console.error(e); }
    }
    await qc.invalidateQueries({ queryKey: ['actas_terrenos'] });
    setSubiendo(false);
    setMsg(`${archivos} archivo(s), ${total} polígono(s) cargados.${errores ? ` ${errores} con error.` : ''}`);
  }

  async function borrar(archivo: string) {
    if (!confirm(`¿Eliminar el KMZ "${archivo}" y todos sus polígonos?`)) return;
    try { await deleteTerrenosByArchivo(archivo); await qc.invalidateQueries({ queryKey: ['actas_terrenos'] }); }
    catch (e) { console.error(e); setMsg('No se pudo eliminar.'); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Subí archivos <strong>KMZ o KML</strong> de Google Earth con los polígonos de los terrenos. Cuando un acta
        tenga coordenadas dentro de un polígono, ese terreno se dibuja sobre la imagen satelital (en el acta y
        en el mapa general). Un mismo archivo puede tener varios polígonos.
      </p>
      <input
        type="file" accept=".kmz,.kml" multiple disabled={subiendo}
        onChange={(e) => onFiles(e.target.files)}
        className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:text-white hover:file:opacity-90"
      />
      {subiendo && <p className="text-sm text-slate-500">Procesando KMZ…</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">KMZ cargados ({grupos.length})</h4>
        {grupos.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no subiste ningún KMZ.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {grupos.map((g) => (
              <li key={g.archivo} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{g.archivo} <span className="text-slate-400">· {g.count} polígono(s)</span></span>
                <button onClick={() => borrar(g.archivo)} className="text-red-600 hover:underline text-xs">Eliminar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Mapa con TODOS los puntos de inspección (actas con coordenadas) + terrenos.
// Clic en un polígono abre un panel lateral para vincular/desvincular actas y expedientes.
function MapaActas({ actas, onSel, terrenos }: { actas: Acta[]; onSel: (a: Acta) => void; terrenos: Terreno[] }) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<any>(null);
  const [fallo, setFallo] = useState(false);
  const [terrenoSel, setTerrenoSel] = useState<Terreno | null>(null);
  const { puedeEditar } = usePermisos();
  const conGeo = actas.filter((a) => a.lat != null && a.lng != null);

  useEffect(() => {
    let cancelado = false;
    loadLeaflet().then((L) => {
      if (cancelado || !el.current) return;
      if (inst.current) { inst.current.remove(); inst.current = null; }
      const map = L.map(el.current, { scrollWheelZoom: true });
      L.tileLayer(SAT_TILE_URL, { maxZoom: SAT_MAX_ZOOM, maxNativeZoom: SAT_MAX_NATIVE, attribution: SAT_ATTR }).addTo(map);
      terrenos.forEach((t) => {
        if (!t.geom?.coordinates) return;
        const poly = L.polygon(t.geom.coordinates.map(ringToLatLng), {
          color: '#ffd400', weight: 2, fillColor: '#ffd400', fillOpacity: 0.08,
        }).addTo(map);
        if (t.nombre) poly.bindTooltip(t.nombre, { sticky: true });
        poly.on('click', () => setTerrenoSel(t));
      });
      const icon = L.divIcon({
        html: '<div style="font-size:24px;line-height:1;transform:translate(-2px,-10px)">📍</div>',
        className: '', iconSize: [24, 24], iconAnchor: [12, 24],
      });
      const pts: [number, number][] = [];
      conGeo.forEach((a) => {
        const lat = a.lat as number, lng = a.lng as number;
        const m = L.marker([lat, lng], { icon }).addTo(map);
        m.bindTooltip(`N° ${nro(a)} · ${a.razon_social ?? ''}`, { direction: 'top', offset: [0, -22] });
        m.on('click', () => onSel(a));
        pts.push([lat, lng]);
      });
      if (pts.length === 1) map.setView(pts[0], 16);
      else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
      else map.setView([-43.3, -65.3], 6);
      inst.current = map;
      setTimeout(() => { try { map.invalidateSize(); } catch { /* noop */ } }, 150);
    }).catch(() => setFallo(true));
    return () => { cancelado = true; if (inst.current) { inst.current.remove(); inst.current = null; } };
  }, [actas, terrenos]);

  if (fallo) return <p className="text-sm text-slate-400 bg-white rounded-xl shadow-sm p-4">No se pudo cargar el mapa. Probá recargar la página.</p>;
  return (
    <div>
      {conGeo.length === 0 && <p className="text-xs text-slate-400 mb-2">Ninguna de las actas mostradas tiene ubicación registrada todavía.</p>}
      <div className="flex gap-3 items-start">
        <div className="flex-1">
          <div ref={el} className="h-[60vh] min-h-[360px] rounded-xl shadow-sm overflow-hidden ring-1 ring-slate-200 bg-slate-100" style={{ zIndex: 0 }} />
          <p className="text-xs text-slate-400 mt-2">
            Clic en un <span className="text-yellow-500 font-semibold">polígono</span> para vincular actas/expedientes. Clic en un 📍 para ver el acta.
          </p>
        </div>
        {terrenoSel && (
          <PanelVinculos
            terreno={terrenoSel}
            actas={actas}
            puedeEditar={puedeEditar}
            onCerrar={() => setTerrenoSel(null)}
            onVerActa={onSel}
          />
        )}
      </div>
    </div>
  );
}

// Panel lateral que aparece al hacer clic en un polígono del mapa.
function PanelVinculos({
  terreno, actas, puedeEditar, onCerrar, onVerActa,
}: {
  terreno: Terreno;
  actas: Acta[];
  puedeEditar: boolean;
  onCerrar: () => void;
  onVerActa: (a: Acta) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'actas' | 'expedientes'>('actas');
  const [busca, setBusca] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: ['terreno_vinculos', terreno.id],
    queryFn: () => fetchVinculos(terreno.id),
  });

  // Expedientes para el selector (solo los activos)
  const { data: expedientes = [] } = useQuery({
    queryKey: ['expedientes_sel'],
    queryFn: async () => {
      const { data } = await supabase
        .from('expedientes')
        .select('id, numero, empresa:empresas(razon_social), tipo:tipos_tramite(nombre)')
        .order('created_at', { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const vinculosActas = vinculos.filter((v) => v.acta_id);
  const vinculosExptes = vinculos.filter((v) => v.expediente_id);

  // IDs ya vinculados para evitar duplicados
  const actasVinculadas = new Set(vinculosActas.map((v) => v.acta_id));
  const exptesVinculados = new Set(vinculosExptes.map((v) => v.expediente_id));

  const q = busca.trim().toLowerCase();
  const actasFiltradas = q
    ? actas.filter((a) => [nro(a), a.razon_social, a.cuit, a.parque].filter(Boolean).join(' ').toLowerCase().includes(q))
    : actas;
  const exptesFiltrados = q
    ? (expedientes as any[]).filter((e) => [e.numero, e.empresa?.razon_social, e.tipo?.nombre].filter(Boolean).join(' ').toLowerCase().includes(q))
    : expedientes as any[];

  async function vincularActa(acta_id: string) {
    if (actasVinculadas.has(acta_id)) return;
    setGuardando(true); setMsg('');
    try {
      await addVinculo(terreno.id, { acta_id });
      await qc.invalidateQueries({ queryKey: ['terreno_vinculos', terreno.id] });
      setMsg('✓ Vinculada');
    } catch { setMsg('Error al vincular.'); }
    setGuardando(false);
  }

  async function vincularExpte(expediente_id: string) {
    if (exptesVinculados.has(expediente_id)) return;
    setGuardando(true); setMsg('');
    try {
      await addVinculo(terreno.id, { expediente_id });
      await qc.invalidateQueries({ queryKey: ['terreno_vinculos', terreno.id] });
      setMsg('✓ Vinculado');
    } catch { setMsg('Error al vincular.'); }
    setGuardando(false);
  }

  async function desvincular(id: string) {
    setGuardando(true);
    try {
      await removeVinculo(id);
      await qc.invalidateQueries({ queryKey: ['terreno_vinculos', terreno.id] });
    } catch { setMsg('Error al desvincular.'); }
    setGuardando(false);
  }

  return (
    <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 flex flex-col max-h-[60vh]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">Terreno</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight">{terreno.nombre || 'Sin nombre'}</p>
          {terreno.archivo && <p className="text-xs text-slate-400">{terreno.archivo}</p>}
        </div>
        <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 text-lg leading-none mt-0.5">×</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 text-sm">
        <button
          onClick={() => { setTab('actas'); setBusca(''); setMsg(''); }}
          className={`flex-1 py-2 font-medium ${tab === 'actas' ? 'text-[var(--brand)] border-b-2 border-[var(--brand)]' : 'text-slate-500 hover:text-slate-700'}`}
        >Actas {vinculosActas.length > 0 && <span className="ml-1 text-xs bg-[var(--brand)] text-white rounded-full px-1.5 py-0.5">{vinculosActas.length}</span>}</button>
        <button
          onClick={() => { setTab('expedientes'); setBusca(''); setMsg(''); }}
          className={`flex-1 py-2 font-medium ${tab === 'expedientes' ? 'text-[var(--brand)] border-b-2 border-[var(--brand)]' : 'text-slate-500 hover:text-slate-700'}`}
        >Expedientes {vinculosExptes.length > 0 && <span className="ml-1 text-xs bg-[var(--brand)] text-white rounded-full px-1.5 py-0.5">{vinculosExptes.length}</span>}</button>
      </div>

      {/* Vínculos existentes */}
      <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
        {isLoading && <p className="text-xs text-slate-400 py-2">Cargando…</p>}

        {tab === 'actas' && (
          <>
            {vinculosActas.length === 0 && !isLoading && (
              <p className="text-xs text-slate-400 py-2">Sin actas vinculadas.</p>
            )}
            {vinculosActas.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <button
                  className="text-left text-xs hover:text-[var(--brand)]"
                  onClick={() => { const a = actas.find((x) => x.id === v.acta_id); if (a) onVerActa(a); }}
                >
                  <span className="font-semibold">N° {v.acta?.numero ?? '?'}/{v.acta?.anio ?? ''}</span>
                  <span className="block text-slate-500 truncate max-w-[180px]">{v.acta?.razon_social ?? '—'}</span>
                  {v.acta?.fecha && <span className="text-slate-400">{fmtFecha(v.acta.fecha)}</span>}
                </button>
                {puedeEditar && (
                  <button onClick={() => desvincular(v.id)} disabled={guardando} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">×</button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'expedientes' && (
          <>
            {vinculosExptes.length === 0 && !isLoading && (
              <p className="text-xs text-slate-400 py-2">Sin expedientes vinculados.</p>
            )}
            {vinculosExptes.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div className="text-xs">
                  <span className="font-semibold">{v.expediente?.numero ?? '—'}</span>
                  <span className="block text-slate-500 truncate max-w-[180px]">{(v.expediente as any)?.empresa?.razon_social ?? '—'}</span>
                  {(v.expediente as any)?.tipo?.nombre && <span className="text-slate-400">{(v.expediente as any).tipo.nombre}</span>}
                </div>
                {puedeEditar && (
                  <button onClick={() => desvincular(v.id)} disabled={guardando} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">×</button>
                )}
              </div>
            ))}
          </>
        )}

        {msg && <p className="text-xs text-emerald-600 py-1">{msg}</p>}

        {/* Buscador para vincular */}
        {puedeEditar && (
          <div className="pt-2 border-t border-slate-100 mt-1">
            <p className="text-xs text-slate-400 mb-1.5 font-medium">Vincular {tab === 'actas' ? 'acta' : 'expediente'}:</p>
            <input
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              placeholder={tab === 'actas' ? 'Buscar por N°, empresa…' : 'Buscar por número, empresa…'}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {tab === 'actas' && actasFiltradas.slice(0, 30).map((a) => {
                const yaVinculada = actasVinculadas.has(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={yaVinculada || guardando}
                    onClick={() => vincularActa(a.id)}
                    className={`w-full text-left text-xs rounded px-2 py-1.5 ${yaVinculada ? 'text-slate-300 cursor-default' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className="font-semibold text-[var(--brand)]">{nro(a)}</span>
                    <span className="ml-1 text-slate-500 truncate">{a.razon_social ?? ''}</span>
                    {yaVinculada && <span className="ml-1 text-slate-300">(ya vinculada)</span>}
                  </button>
                );
              })}
              {tab === 'expedientes' && exptesFiltrados.slice(0, 30).map((e: any) => {
                const yaVinculado = exptesVinculados.has(e.id);
                return (
                  <button
                    key={e.id}
                    disabled={yaVinculado || guardando}
                    onClick={() => vincularExpte(e.id)}
                    className={`w-full text-left text-xs rounded px-2 py-1.5 ${yaVinculado ? 'text-slate-300 cursor-default' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className="font-semibold text-[var(--brand)]">{e.numero ?? '—'}</span>
                    <span className="ml-1 text-slate-500 truncate">{e.empresa?.razon_social ?? ''}</span>
                    {yaVinculado && <span className="ml-1 text-slate-300">(ya vinculado)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Ubicación geográfica donde se confirmó el acta + mapa satelital (~zoom 17),
// con el polígono del terreno (KMZ) que contiene el punto, si existe.
function UbicacionFirma({ lat, lng, acc, at, terrenos }: { lat: number; lng: number; acc: number | null; at: string | null; terrenos: Terreno[] }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const [falloMapa, setFalloMapa] = useState(false);
  const gmapsSat = `https://www.google.com/maps/@${lat},${lng},200m/data=!3m1!1e3`;
  const gmapsPin = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const terreno = terrenoContaining(lat, lng, terrenos);

  useEffect(() => {
    let cancelado = false;
    loadLeaflet().then((L) => {
      if (cancelado || !mapEl.current) return;
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
      const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([lat, lng], 18);
      L.tileLayer(SAT_TILE_URL, { maxZoom: SAT_MAX_ZOOM, maxNativeZoom: SAT_MAX_NATIVE, attribution: SAT_ATTR }).addTo(map);
      // Polígono del terreno que contiene el punto.
      if (terreno?.geom?.coordinates) {
        const poly = L.polygon(terreno.geom.coordinates.map(ringToLatLng), {
          color: '#ffd400', weight: 2.5, fillColor: '#ffd400', fillOpacity: 0.12,
        }).addTo(map);
        try { map.fitBounds(poly.getBounds(), { padding: [20, 20], maxZoom: 18 }); } catch { /* noop */ }
      }
      const icon = L.divIcon({
        html: '<div style="font-size:24px;line-height:1;transform:translate(-2px,-10px)">📍</div>',
        className: '', iconSize: [24, 24], iconAnchor: [12, 24],
      });
      L.marker([lat, lng], { icon }).addTo(map);
      mapInst.current = map;
      // El modal puede recién mostrarse: recalcular tamaño tras montar.
      setTimeout(() => { try { map.invalidateSize(); } catch { /* noop */ } }, 150);
    }).catch(() => setFalloMapa(true));
    return () => { cancelado = true; if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, [lat, lng, terreno?.id]);

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-0.5 mb-2">
        <Dato k="Coordenadas" v={`${lat.toFixed(6)}, ${lng.toFixed(6)}`} />
        {acc != null && <Dato k="Precisión GPS" v={`± ${Math.round(acc)} m`} />}
        {at && <Dato k="Capturada" v={new Date(at).toLocaleString('es-AR')} />}
        {terreno && <Dato k="Terreno" v={`${terreno.nombre || 'Sin nombre'}${terreno.archivo ? ` · ${terreno.archivo}` : ''}`} />}
      </div>
      {!falloMapa ? (
        <div
          ref={mapEl}
          className="max-w-md h-72 rounded-lg overflow-hidden ring-1 ring-slate-200 bg-slate-100"
          style={{ zIndex: 0 }}
        />
      ) : (
        <p className="text-xs text-slate-400">No se pudo cargar el mapa satelital. Usá los enlaces de abajo.</p>
      )}
      <div className="flex flex-wrap gap-4 mt-2 text-xs">
        <a href={gmapsSat} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">Ver en Google Maps (satélite)</a>
        <a href={gmapsPin} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">Abrir punto exacto</a>
      </div>
    </div>
  );
}

function DetalleActa({ a, terrenos }: { a: Acta; terrenos: Terreno[] }) {
  const d = (a.datos ?? {}) as Record<string, any>;
  const marc = (pairs: [boolean, string][]) => pairs.filter(([c]) => !!c).map(([, l]) => l);

  const acceso = marc([
    [d.accesoPredi, 'Acceso al predio'],
    [d.accesoInterior, 'Acceso al interior'],
    [d.noPudoAcceder, 'No se pudo acceder'],
    [d.seNegoAcceso, 'Se negó el acceso'],
    [d.otrosMotivos, 'Otros motivos'],
  ]);
  const estado = marc([
    [d.cercado, 'Cercado total/parcial'],
    [d.movSuelos, 'Movimiento de suelos'],
    [d.sinModif, 'Sin modificaciones'],
    [d.sinConstruccion, 'Sin construcción'],
    [d.enConstruccion, 'En construcción'],
    [d.construcActual, '· Actualmente'],
    [d.construcDetenida, '· Detenida/abandonada'],
    [d.conConstruccion, 'Construcción finalizada'],
  ]);
  const servicios = marc([
    [d.srvEnergia, 'Energía'],
    [d.srvGasRed, 'Gas de red'],
    [d.srvGasEnvasado, 'Gas envasado'],
    [d.srvAguaPot, 'Agua potable'],
    [d.srvAguaInd, 'Agua industrial'],
    [d.srvCloacas, 'Cloacas'],
    [d.srvOtros, d.srvOtrosTexto ? `Otros: ${d.srvOtrosTexto}` : 'Otros'],
  ]);
  const agentes = Array.isArray(d.agents) ? d.agents : [];
  const firmas = [
    { img: a.sig1, nom: d.agente1Nombre || agentes[0] || 'Agente 1', rol: 'Agente inspector' },
    { img: a.sig2, nom: d.agente2Nombre || agentes[1] || 'Agente 2', rol: 'Agente inspector' },
    { img: a.sig3, nom: `${d.respNombre || ''} ${d.respApellido || ''}`.trim() || 'Responsable', rol: d.respCargo || 'Responsable' },
  ].filter((f) => f.img);

  return (
    <div className="space-y-1">
      <Seccion titulo="General">
        <Dato k="Fecha / hora" v={`${fmtFecha(a.fecha)}${d.hora ? ' · ' + d.hora : ''}`} />
        <Dato k="Ciudad" v={a.ciudad} />
        <Dato k="Inspector que cargó" v={a.inspector_nombre} />
        <Dato k="Agentes" v={agentes.join(', ')} />
        <Dato k="Recibido" v={new Date(a.created_at).toLocaleString('es-AR')} />
      </Seccion>

      <Seccion titulo="Empresa">
        <Dato k="Razón social" v={a.razon_social} />
        <Dato k="CUIT" v={a.cuit} />
        <Dato k="Domicilio legal" v={d.domicilioEmpresa} />
        <Dato k="Email" v={d.emailEmpresa} />
      </Seccion>

      <Seccion titulo="Responsable que recibe">
        <Dato k="Nombre" v={`${d.respNombre || ''} ${d.respApellido || ''}`.trim()} />
        <Dato k="DNI" v={d.respDni} />
        <Dato k="Cargo" v={d.respCargo} />
      </Seccion>

      <Seccion titulo="Establecimiento">
        <Dato k="Predio" v={d.establecimiento} />
        <Dato k="Dirección" v={d.domicilioEstablec} />
        <Dato k="Parque industrial" v={a.parque} />
        <Dato k="Nomenclatura" v={`Ejido ${d.ejido || '—'} · Circ ${d.circ || '—'} · Sec ${d.sector || '—'} · Div ${d.division || '—'} · Parc ${d.parcela || '—'}${d.macizo ? ' · Mac ' + d.macizo : ''}`} />
      </Seccion>

      <Seccion titulo="Ubicación de la firma">
        {a.lat != null && a.lng != null ? (
          <UbicacionFirma lat={a.lat} lng={a.lng} acc={a.geo_precision} at={a.geo_at} terrenos={terrenos} />
        ) : (
          <p className="text-sm text-slate-400">
            No se registró ubicación en esta acta. Se captura automáticamente al confirmar el acta desde el celular,
            con el GPS encendido y dando permiso de ubicación al navegador. Las actas anteriores a esta función no la tienen.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Acceso al predio">
        <Chips items={acceso} />
        {d.otrosMotivosTexto && <Dato k="Motivos" v={d.otrosMotivosTexto} />}
        {d.obsAcceso && <Dato k="Observaciones" v={d.obsAcceso} />}
      </Seccion>

      <Seccion titulo="Estado del predio">
        <Chips items={estado} />
        {d.estadoConstruccion && <Dato k="Características" v={d.estadoConstruccion} />}
        {d.obsEstadoPredi && <Dato k="Observaciones" v={d.obsEstadoPredi} />}
      </Seccion>

      <Seccion titulo="Actividad industrial">
        <Chips items={marc([[d.sinActividad, 'Sin actividad'], [d.enActividad, 'En actividad']])} />
        {d.detalleActividad && <Dato k="Detalle" v={d.detalleActividad} />}
        {d.productos && <Dato k="Productos/servicios" v={d.productos} />}
        {d.personal && <Dato k="Personal" v={d.personal} />}
        {d.capacidad && <Dato k="Capacidad" v={d.capacidad} />}
        {d.obsActividad && <Dato k="Observaciones" v={d.obsActividad} />}
      </Seccion>

      <Seccion titulo="Servicios del predio">
        <Chips items={servicios} />
        {d.obsServicios && <Dato k="Observaciones" v={d.obsServicios} />}
      </Seccion>

      {d.otrasObs && (
        <Seccion titulo="Otras observaciones">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{d.otrasObs}</p>
        </Seccion>
      )}

      {(a.fotos?.length ?? 0) > 0 && (
        <Seccion titulo={`Fotografías (${a.fotos!.length})`}>
          <div className="grid grid-cols-3 gap-2">
            {a.fotos!.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
                <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </a>
            ))}
          </div>
        </Seccion>
      )}

      {firmas.length > 0 && (
        <Seccion titulo="Firmas">
          <div className="grid grid-cols-2 gap-3">
            {firmas.map((f, i) => (
              <div key={i} className="text-center">
                <div className="bg-slate-50 rounded-lg ring-1 ring-slate-200 p-2 h-24 flex items-center justify-center">
                  <img src={f.img!} alt={`Firma ${i + 1}`} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1">{f.nom}</div>
                <div className="text-[11px] text-slate-400 capitalize">{f.rol}</div>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  );
}
