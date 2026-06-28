// Fuente base: Esri World Imagery. Sin key, CORS abierto.
// Overlay: CONAE SAOCOM mosaicos por provincia (WMS público, sin key).
export const SAT_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SAT_ATTR = '© Esri © Maxar | Mosaico SAOCOM © CONAE';
export const SAT_MAX_ZOOM = 19;
export const SAT_MAX_NATIVE = 17;

export const CONAE_WMS_URL = 'https://geoportal.conae.gov.ar/geoserver/ows';
// Capa SAOCOM de Chubut 2022 (también disponible por provincia).
export const CONAE_LAYER = 'saocom_mosaicos:Chubut_2022';
