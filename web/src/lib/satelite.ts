// Arma una imagen satelital estática (JPEG dataURL) a partir de los tiles
// de Esri World Imagery, centrada en un punto, con un pin marcando el lugar.
// Sirve para incrustar en el PDF del acta (jsPDF.addImage no acepta mapas).

const TILE = 256;
// Esri usa orden z/y/x
const tileUrl = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => resolve(null), 9000);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

export async function satelliteDataUrl(
  lat: number,
  lng: number,
  opts?: { zoom?: number; grid?: number; size?: number }
): Promise<string | null> {
  const zoom = opts?.zoom ?? 18;            // MapTiler tiene imagen real bastante más profunda
  const grid = opts?.grid ?? 3;             // 3x3 tiles alrededor del punto
  const out = opts?.size ?? 540;            // lado del recorte final (px)
  if (typeof document === 'undefined') return null;

  const n = 2 ** zoom;
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  const xt = Math.floor(xf), yt = Math.floor(yf);
  const half = Math.floor(grid / 2);

  const big = document.createElement('canvas');
  big.width = grid * TILE; big.height = grid * TILE;
  const ctx = big.getContext('2d');
  if (!ctx) return null;

  const tasks: Promise<void>[] = [];
  for (let dx = -half; dx <= half; dx++) {
    for (let dy = -half; dy <= half; dy++) {
      const tx = xt + dx, ty = yt + dy;
      const url = tileUrl(zoom, tx, ty);
      tasks.push(
        loadImg(url).then((img) => {
          if (img) ctx.drawImage(img, (dx + half) * TILE, (dy + half) * TILE);
        })
      );
    }
  }
  await Promise.all(tasks);

  // Pixel del punto exacto dentro del lienzo grande.
  const pxCenter = (xf - (xt - half)) * TILE;
  const pyCenter = (yf - (yt - half)) * TILE;

  // Recorte cuadrado centrado en el punto.
  const sx = Math.max(0, Math.min(big.width - out, pxCenter - out / 2));
  const sy = Math.max(0, Math.min(big.height - out, pyCenter - out / 2));
  const crop = document.createElement('canvas');
  crop.width = out; crop.height = out;
  const cctx = crop.getContext('2d');
  if (!cctx) return null;
  cctx.drawImage(big, sx, sy, out, out, 0, 0, out, out);

  // Pin en la posición del punto dentro del recorte.
  const mx = pxCenter - sx, my = pyCenter - sy;
  cctx.lineWidth = 3; cctx.strokeStyle = '#ffffff';
  cctx.fillStyle = '#e11d2a';
  cctx.beginPath(); cctx.arc(mx, my, 9, 0, Math.PI * 2); cctx.fill(); cctx.stroke();
  cctx.fillStyle = '#ffffff';
  cctx.beginPath(); cctx.arc(mx, my, 3, 0, Math.PI * 2); cctx.fill();

  try { return crop.toDataURL('image/jpeg', 0.85); } catch { return null; }
}
