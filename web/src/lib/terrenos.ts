import { supabase } from './supabase';

// ════════════════════════════════════════════════════════════════
//  Terrenos = polígonos de los KMZ de Google Earth (tabla actas_terrenos).
//  - Parseo del KMZ en el navegador (JSZip por CDN + DOMParser).
//  - Cruce punto-en-polígono (ray casting) para vincular un acta al
//    terreno que la contiene.
// ════════════════════════════════════════════════════════════════

export interface Terreno {
  id: string;
  nombre: string | null;
  archivo: string | null;
  geom: { type: 'Polygon'; coordinates: number[][][] }; // anillos [[ [lng,lat], ... ]]
}

// ---- Carga de JSZip desde CDN (sin sumar dependencia al build) ----
let jszipPromise: Promise<any> | null = null;
function loadJSZip(): Promise<any> {
  const w = window as any;
  if (w.JSZip) return Promise.resolve(w.JSZip);
  if (jszipPromise) return jszipPromise;
  jszipPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';
    s.async = true;
    s.onload = () => resolve((window as any).JSZip);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return jszipPromise;
}

function parseCoords(s: string): number[][] {
  return s
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [lng, lat] = tok.split(',').map(Number);
      return [lng, lat];
    })
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

// Extrae los polígonos (anillo exterior) de un KMZ o KML. Devuelve nombre + geom.
export async function parseKmz(file: File): Promise<{ nombre: string; geom: Terreno['geom'] }[]> {
  let kmlText: string;
  if (file.name.toLowerCase().endsWith('.kml')) {
    // KML: XML sin comprimir, se lee directo.
    kmlText = await file.text();
  } else {
    // KMZ: ZIP que contiene un .kml adentro.
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const kmlName = Object.keys(zip.files).find((n: string) => n.toLowerCase().endsWith('.kml'));
    if (!kmlName) return [];
    kmlText = await zip.files[kmlName].async('text');
  }
  const xml = new DOMParser().parseFromString(kmlText, 'application/xml');

  const out: { nombre: string; geom: Terreno['geom'] }[] = [];
  const placemarks = Array.from(xml.getElementsByTagName('Placemark'));
  placemarks.forEach((pm) => {
    const nombre = pm.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    const polys = Array.from(pm.getElementsByTagName('Polygon'));
    polys.forEach((poly) => {
      const outer = poly.getElementsByTagName('outerBoundaryIs')[0] || poly;
      const coordsEl = outer.getElementsByTagName('coordinates')[0];
      const ring = parseCoords(coordsEl?.textContent || '');
      if (ring.length >= 3) out.push({ nombre, geom: { type: 'Polygon', coordinates: [ring] } });
    });
  });
  return out;
}

// ---- Base de datos ----
export async function fetchTerrenos(): Promise<Terreno[]> {
  const { data, error } = await supabase.from('actas_terrenos').select('*').order('archivo');
  if (error) throw error;
  return (data ?? []) as Terreno[];
}

export async function saveTerrenos(
  rows: { nombre: string; geom: Terreno['geom'] }[],
  archivo: string
): Promise<void> {
  if (!rows.length) return;
  const payload = rows.map((r) => ({ nombre: r.nombre || null, archivo, geom: r.geom }));
  const { error } = await supabase.from('actas_terrenos').insert(payload);
  if (error) throw error;
}

export async function deleteTerrenosByArchivo(archivo: string): Promise<void> {
  const { error } = await supabase.from('actas_terrenos').delete().eq('archivo', archivo);
  if (error) throw error;
}

// ---- Geometría ----
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Devuelve el terreno cuyo polígono contiene el punto (o undefined).
export function terrenoContaining(lat: number, lng: number, terrenos: Terreno[]): Terreno | undefined {
  return terrenos.find((t) => {
    const rings = t.geom?.coordinates;
    if (!rings || !rings[0]) return false;
    // Dentro del anillo exterior y fuera de los huecos (anillos interiores).
    if (!pointInRing(lng, lat, rings[0])) return false;
    for (let k = 1; k < rings.length; k++) if (pointInRing(lng, lat, rings[k])) return false;
    return true;
  });
}

// Convierte un anillo [lng,lat] a [lat,lng] para Leaflet.
export function ringToLatLng(ring: number[][]): [number, number][] {
  return ring.map((p) => [p[1], p[0]] as [number, number]);
}

// ── Vínculos manuales terreno ↔ acta / expediente ────────────────
export interface TerrenoVinculo {
  id: string;
  terreno_id: string;
  acta_id: string | null;
  expediente_id: string | null;
  nota: string | null;
  created_at: string;
  // joins opcionales
  acta?: { id: string; numero: number | null; anio: number | null; razon_social: string | null; fecha: string | null } | null;
  expediente?: { id: string; numero: string | null; tipo?: { nombre: string } | null; empresa?: { razon_social: string } | null } | null;
}

export async function fetchVinculos(terreno_id: string): Promise<TerrenoVinculo[]> {
  const { data, error } = await supabase
    .from('terreno_vinculos')
    .select(`
      id, terreno_id, acta_id, expediente_id, nota, created_at,
      acta:actas_inspeccion(id, numero, anio, razon_social, fecha),
      expediente:expedientes(id, numero, empresa:empresas(razon_social), tipo:tipos_tramite(nombre))
    `)
    .eq('terreno_id', terreno_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TerrenoVinculo[];
}

export async function addVinculo(
  terreno_id: string,
  target: { acta_id?: string; expediente_id?: string },
  nota?: string
): Promise<void> {
  const { error } = await supabase.from('terreno_vinculos').insert({
    terreno_id,
    acta_id: target.acta_id ?? null,
    expediente_id: target.expediente_id ?? null,
    nota: nota ?? null,
  });
  if (error) throw error;
}

export async function removeVinculo(id: string): Promise<void> {
  const { error } = await supabase.from('terreno_vinculos').delete().eq('id', id);
  if (error) throw error;
}
