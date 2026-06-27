---
name: fuentes-catastro-drones
description: Dónde está el registro de fuentes de catastro (relevamiento con drones) para integrar al SIGPIP
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9535c8b7-3aae-4e12-bfe3-3556ec49e584
---

El relevamiento aéreo (drones / postproceso GIS) de los parques industriales está en el sistema
externo **Relevamiento de Parques**: https://relevamiento-de-parques.netlify.app/#/catastro
(requiere login del titular). Sus datos quedaron registrados en el repo SIGPIP en
`docs/fuentes-catastro.md`: 12 links de descarga de Google Drive (DEM, GeoTiff, SHP, nube de puntos,
3D, curvas, GPS, etc.) + las fichas técnicas de los 9 parques/sub-parques (Comodoro Rivadavia;
Puerto Madryn: Conexa, Liviano PIL, Pesado PIP [Zona Este/Oeste/Sur], Pesquero PIPE; Trelew; Trevelin).

Pendiente/idea: integrarlo al SIGPIP (capas de mapa desde los SHP, fichas como metadatos de cada
parque, links de descarga por parque, capa de riesgo de anegamiento). Procesamiento original:
OcusCloud by SkyDron SAS, capturas Ene–Feb 2022.
