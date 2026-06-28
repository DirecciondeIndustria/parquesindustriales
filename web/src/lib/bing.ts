// Bing Maps Aerial tiles. Requiere API key gratuita (sin CC):
// https://www.bingmapsportal.com → My keys → Create → Key type: Basic
// Bing usa "quadkeys" en vez de z/x/y estándar.
export const BING_KEY = 'TU_BING_KEY_AQUI';
export const BING_ATTR = '© Microsoft Bing © Maxar';
export const BING_MAX_ZOOM = 20;
export const BING_MAX_NATIVE = 19;

export function toQuadkey(x: number, y: number, z: number): string {
  let q = '';
  for (let i = z; i > 0; i--) {
    let d = 0;
    const m = 1 << (i - 1);
    if (x & m) d++;
    if (y & m) d += 2;
    q += d;
  }
  return q;
}

export function bingTileUrl(x: number, y: number, z: number): string {
  const q = toQuadkey(x, y, z);
  const sub = (x + y) & 3;
  return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${q}.jpeg?g=1&key=${BING_KEY}`;
}

// Crea un L.TileLayer compatible con Bing Maps para usar en Leaflet.
// Uso: createBingLayer(L).addTo(map)
export function createBingLayer(L: any) {
  const BingTileLayer = L.TileLayer.extend({
    getTileUrl(coords: { x: number; y: number; z: number }) {
      return bingTileUrl(coords.x, coords.y, coords.z);
    },
  });
  return new BingTileLayer('', {
    maxZoom: BING_MAX_ZOOM,
    maxNativeZoom: BING_MAX_NATIVE,
    attribution: BING_ATTR,
  });
}
