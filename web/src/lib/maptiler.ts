// Fuente de imagen satelital: Esri World Imagery. Sin key, CORS abierto.
// Imagen real disponible hasta ~z17 en Patagonia.
export const SAT_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SAT_ATTR = '© Esri © Maxar';
export const SAT_MAX_ZOOM = 19;
export const SAT_MAX_NATIVE = 17;
