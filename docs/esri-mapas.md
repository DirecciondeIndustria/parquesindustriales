# Mapas satelitales Esri en SIGPIP

## Qué se usa

**Esri World Imagery** — tiles satelitales gratuitos, sin API key, CORS abierto.  
URL del tile: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

> Orden de coordenadas: **z / y / x** (distinto a OpenStreetMap que es z/x/y).

---

## 1. Mapa interactivo con Leaflet (web React)

Archivo: `web/src/lib/maptiler.ts`

```ts
export const SAT_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SAT_ATTR      = '© Esri © Maxar';
export const SAT_MAX_ZOOM        = 19;  // zoom máximo que permite Leaflet
export const SAT_MAX_NATIVE_ZOOM = 17;  // zoom máximo con imagen real (Chubut)
```

Uso en un componente con Leaflet:

```ts
import { SAT_TILE_URL, SAT_ATTR, SAT_MAX_ZOOM, SAT_MAX_NATIVE } from '../lib/maptiler';

L.tileLayer(SAT_TILE_URL, {
  maxZoom:       SAT_MAX_ZOOM,
  maxNativeZoom: SAT_MAX_NATIVE,  // evita pedir tiles que no existen
  attribution:   SAT_ATTR,
}).addTo(map);
```

> **Importante:** `maxNativeZoom: 17` hace que Leaflet escale el tile de zoom 17
> cuando el usuario hace zoom a 18 o 19, en lugar de pedir un tile que no existe
> (lo que devolvería el placeholder gris *"Map data not yet available"*).

Leaflet se carga desde CDN sin agregar dependencia al build:

```ts
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
```

---

## 2. Imagen estática para PDF (canvas)

Para incrustar en un PDF (jsPDF no acepta mapas interactivos), se construye
una imagen JPEG descargando tiles directamente y dibujándolos en un `<canvas>`.

Archivo: `web/src/lib/satelite.ts`

```ts
const tileUrl = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  //                                                                                        ^ y antes que x

export async function satelliteDataUrl(lat: number, lng: number): Promise<string | null> {
  const zoom = 17;   // máximo nativo — NO subir a 18/19 (devuelve tile gris)
  const grid = 3;    // grilla 3×3 tiles alrededor del punto
  const out  = 540;  // lado del recorte final en px

  // 1. Convertir lat/lng a coordenadas de tile
  const n  = 2 ** zoom;
  const xf = ((lng + 180) / 360) * n;
  const yf = ((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2) * n;
  const xt = Math.floor(xf), yt = Math.floor(yf);
  const half = Math.floor(grid / 2);

  // 2. Descargar tiles y dibujarlos en canvas grande
  const big = document.createElement('canvas');
  big.width = big.height = grid * 256;
  const ctx = big.getContext('2d')!;
  await Promise.all(
    Array.from({ length: grid }, (_, i) => i - half).flatMap((dx) =>
      Array.from({ length: grid }, (_, j) => j - half).map(async (dy) => {
        const img = await loadImg(tileUrl(zoom, xt + dx, yt + dy));
        if (img) ctx.drawImage(img, (dx + half) * 256, (dy + half) * 256);
      })
    )
  );

  // 3. Recortar centrado en el punto
  const pxC = (xf - (xt - half)) * 256;
  const pyC = (yf - (yt - half)) * 256;
  const sx  = Math.max(0, Math.min(big.width  - out, pxC - out / 2));
  const sy  = Math.max(0, Math.min(big.height - out, pyC - out / 2));
  const crop = document.createElement('canvas');
  crop.width = crop.height = out;
  const c = crop.getContext('2d')!;
  c.drawImage(big, sx, sy, out, out, 0, 0, out, out);

  // 4. Dibujar pin en el punto exacto
  const mx = pxC - sx, my = pyC - sy;
  c.lineWidth = 3; c.strokeStyle = '#fff'; c.fillStyle = '#e11d2a';
  c.beginPath(); c.arc(mx, my, 9, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(mx, my, 3, 0, Math.PI * 2); c.fill();

  return crop.toDataURL('image/jpeg', 0.85);
}

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => resolve(null), 9000);
    img.onload  = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}
```

---

## 3. CSP (Content Security Policy)

Para que los tiles carguen en producción (Vercel), hay que permitir la URL
en el header `Content-Security-Policy` de `web/vercel.json`:

```json
"connect-src": "... https://server.arcgisonline.com ..."
"img-src":     "... https: ..."
```

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| Tile gris *"Map data not yet available"* | Zoom > 17 en zonas rurales de Chubut | Usar `maxNativeZoom: 17` en Leaflet y `zoom = 17` en canvas |
| CORS error al cargar tiles en canvas | Falta `img.crossOrigin = 'anonymous'` | Agregarlo antes de asignar `img.src` |
| Tile en orden incorrecto | Confundir orden x/y de OSM con y/x de Esri | URL de Esri: `.../tile/{z}/{y}/{x}` |
| PDF sin mapa | `satelliteDataUrl` retorna `null` | Verificar que el canvas tenga contexto 2D y que los tiles carguen (revisar CSP) |

---

## Atribución requerida

Por los términos de uso de Esri, el mapa debe mostrar:

```
© Esri © Maxar
```
