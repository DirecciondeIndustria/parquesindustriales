// Fuente de imagen satelital: MapTiler (satellite-v2). Mejor zoom que Esri
// (imagen real hasta ~z21 en Patagonia) y gratis. La key es de cliente
// (pensada para el navegador); conviene restringirla por dominio en MapTiler.
export const MAPTILER_KEY = '4HDaNkXjAOehIAHuzDKG';
export const SAT_TILE_URL = `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`;
export const SAT_ATTR = '© MapTiler © Maxar';
export const SAT_MAX_ZOOM = 22;
export const SAT_MAX_NATIVE = 20; // imagen real disponible hasta ~z20-21
