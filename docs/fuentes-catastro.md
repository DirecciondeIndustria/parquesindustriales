# Fuentes de Catastro — Relevamiento de Parques (drones / postproceso)

Registro de las fuentes de información del sistema **Relevamiento de Parques** (relevamiento aéreo
con drones y postproceso GIS) para su futura incorporación al **SIGPIP**.

- **Origen:** https://relevamiento-de-parques.netlify.app/#/catastro (solapa **Catastro**)
- **Acceso:** sesión autenticada del propio sistema (credenciales del titular).
- **Procesamiento:** OcusCloud by SkyDron SAS · sensores DJI FC330 y Parrot ANAFI · capturas Ene–Feb 2022.
- **Relevado el:** 2026-06-26.

> Nota: los productos GIS (DEM, GeoTiff, SHP, nube de puntos, 3D, curvas) son archivos pesados →
> se usan como **capas de mapa / descargas**, no como datos a pegar en una tabla. Los SHP de parcelas
> podrían convertirse a geometría (GeoJSON) para el mapa del SIGPIP. El contenido textual (fichas
> técnicas, puntos de control TXT, Doc de postproceso GPS) sí es directamente incorporable.

---

## 1) Descargas — "Productos de PostProceso" (links de Google Drive)

Apartado **Catastro → Descargas** (único para todos los parques).

| # | Producto | Tipo | Link |
|---|----------|------|------|
| 1 | DEM | Carpeta | https://drive.google.com/drive/folders/1w6IeAEL7wsNCv5U7JLljFRHmNicIflYP |
| 2 | GeoTiff | Carpeta | https://drive.google.com/drive/folders/1MARu1PV29QbhytPh7H75e4NdutEL3gt6 |
| 3 | JPG | Carpeta | https://drive.google.com/drive/folders/1Yh-8OpgD-IXCUnPbk4xB_x2IE0uNUOHb |
| 4 | SHP ESRI | Carpeta | https://drive.google.com/drive/folders/1DpQqJ2fd5WNnZDxWsRPEQWE1hotukI-d |
| 5 | TXT Puntos de control | Carpeta | https://drive.google.com/drive/folders/1xVkdF_iJd0og2FTefhXUWFCcLu_URfv6 |
| 6 | 3D | Carpeta | https://drive.google.com/drive/folders/1Jyhj_bFH4UfSKr5HKp-94i-4vbMGze6_ |
| 7 | Nube de puntos | Carpeta | https://drive.google.com/drive/folders/15-evYDCXpGG8gIZf-_6GPHVk6DjDnUsZ |
| 8 | Simulación de vectores por lluvias | Carpeta | https://drive.google.com/drive/folders/1nGp_Nq8o0PZT59vVizgb5esWbPTu3feM |
| 9 | Curvas de 50 cm | Carpeta | https://drive.google.com/drive/folders/1PE6sSFAlIn7Ff8aFogLWZEfqeUxCoxFe |
| 10 | Curvas de 100 cm | Carpeta | https://drive.google.com/drive/folders/1X4XSBPkgGJkt34QY4E8Cipi3ucOTn0YA |
| 11 | Archivo de adquisición de puntos GPS | Archivo | https://drive.google.com/file/d/1Dvp9YcX-MIcXP5oVwmHWEt0fFkUPtwoa/view |
| 12 | Post Procesamiento de datos GPS | Doc Google | https://docs.google.com/document/d/1U2WxgBhX_aW0Db_ahIOXJgnOfWaBSEca/edit |

---

## 2) Fichas técnicas por parque

Estructura del catastro: **Comodoro Rivadavia** · **Puerto Madryn** (Introducción, Conexa,
Liviano PIL, Pesado PIP [Zona Este/Oeste/Sur], Pesquero PIPE) · **Trelew** · **Trevelin**.
(Las secciones "Introducción" y la vista general de Puerto Madryn son narrativas; no se incluyen acá.)

### Comodoro Rivadavia — *Parque Industrial de Comodoro Rivadavia*
| Campo | Valor |
|---|---|
| Captura / Proceso | 14 Feb 2022 / 29 Mar 2022 |
| GSD Ortomosaico | 3.78 cm/px (DEM 15,08 cm/px) |
| Área límite | 1.878.854,17 m² |
| Sensor | DJI FC330 |
| Obturación media | 1/1259 |
| Imágenes procesadas | 1184 (100%) |
| Total de puntos | 66,50 M |
| Densidad nube | 4.626,57 pts/cm² |
| Malla triangular | 4 M |
| Calidad / Modo | Alta |
**Obs.:** anegaciones que afectan casi toda la superficie; crecida del Río Del Tordillo (cauce
temporario, 15–200 m de ancho, hasta 4 m de profundidad); terraplenes que actúan como embalses;
alcantarillado insuficiente; ascenso de nivel freático y contaminación de acuíferos.

### Puerto Madryn / Conexa — *Parque Industrial Conexa*
| Campo | Valor |
|---|---|
| Captura / Proceso | 18 Feb 2022 / 23 Mar 2022 |
| GSD Ortomosaico | 4.39 cm/px (DEM 17,60 cm/px) |
| Área límite | 28.028.442,49 m² |
| Sensor | DJI FC330 |
| Obturación media | 1/1506 |
| Imágenes procesadas | 314 (100%) |
| Total de puntos | 19,6 M |
| Densidad nube | 1.783,73 pts/cm² |
| Malla triangular | 2,4 M |
**Obs.:** sin cursos de agua constantes; lagunas unitarias no vinculadas; geografía pronunciada
O→E hacia el mar (variación de 40 m en 1800 m) que facilita el escurrimiento.

### Puerto Madryn / Liviano (PIL) — *Parque Industrial Liviano PIL*
| Campo | Valor |
|---|---|
| Captura / Proceso | 13 Ene 2022 / 27 Mar 2022 |
| GSD Ortomosaico | 4.45 cm/px (DEM 17,80 cm/px) |
| Área límite | 1.637.241,78 m² |
| Sensor | DJI FC330 |
| Obturación media | 1/205 |
| Imágenes procesadas | 296 (100%) |
| Total de puntos | 18 M |
| Densidad nube | 17,03 pts/cm² *(según origen)* |
| Malla triangular | 2,8 M |
**Obs.:** urbanización no planificada, deficiencia de pluviales, arrastre de sedimentos y obstrucción
de escurrimientos → propenso a inundación.

### Puerto Madryn / Pesado (PIP) — Zona Este — *Parque Industrial Pesado PIP (Zona Este)*
| Campo | Valor |
|---|---|
| Captura / Proceso | 7 Ene 2022 / 28 Mar 2022 |
| GSD Ortomosaico | 3.53 cm/px (DEM 14,12 cm/px) |
| Área límite | 1.692.045,37 m² |
| Sensor | Parrot ANAFI |
| Obturación media | 1/3846 |
| Imágenes procesadas | 413 (100%) |
| Total de puntos | 25,8 M |
| Densidad nube | 2.303,88 pts/cm² |
| Malla triangular | 3,9 M |
**Obs.:** lechos de ríos secos y escorrentías; aluviones e inundaciones en valles fluviales y
depresiones sin salida; grietas en el terreno junto a caminos de ingreso.

### Puerto Madryn / Pesado (PIP) — Zona Oeste — *Parque Industrial Pesado PIP (Zona Oeste)*
| Campo | Valor |
|---|---|
| Captura / Proceso | 7 Ene 2022 / 28 Mar 2022 |
| GSD Ortomosaico | 3.12 cm/px (DEM 12,47 cm/px) |
| Área límite | 3.670.232,63 m² |
| Sensor | Parrot ANAFI y DJI FC330 |
| Obturación media | 1/3846 |
| Imágenes procesadas | 1456 (100%) |
| Total de puntos | 25,8 M |
| Densidad nube | 2.703,47 pts/cm² |
| Malla triangular | 3,9 M |
**Obs.:** zonificación por pendientes hacia el SE; áreas susceptibles a acumulación de agua y
erosión hídrica intensa en tormentas; condiciona desarrollo de proyectos.

### Puerto Madryn / Pesado (PIP) — Zona Sur — *Parque Industrial Pesado PIP (Zona Sur)*
| Campo | Valor |
|---|---|
| Captura / Proceso | 10 Ene 2022 / 28 Mar 2022 |
| GSD Ortomosaico | 11.05 cm/px (DEM 40,38 cm/px) |
| Área límite | 3.122.232,33 m² |
| Sensor | Parrot ANAFI y DJI FC330 |
| Obturación media | 1/3846 |
| Imágenes procesadas | 956 (100%) |
| Total de puntos | 21,6 M |
| Densidad nube | 1.126,47 pts/cm² |
| Malla triangular | 2,0 M |
| Calidad / Modo | Medio |
**Obs.:** escorrentías profundas y extensas; el caudal corre al norte del PI Puerto Madryn y anega
el sector de subestaciones eléctricas; canteras de áridos (alguna abandonada → potencial basural).
*(En el origen, el "Proyecto Nombre" figura como "zona Oeste" — parece un error de carga.)*

### Puerto Madryn / Pesquero (PIPE) — *Parque Industrial Pesquero PIPE*
| Campo | Valor |
|---|---|
| Captura / Proceso | 5 Ene 2022 / 28 Mar 2022 |
| GSD Ortomosaico | 3.49 cm/px (DEM 13,66 cm/px) |
| Área límite | 2.611.451,49 m² |
| Sensor | Parrot ANAFI |
| Obturación media | 1/3846 |
| Imágenes procesadas | 851 (100%) |
| Total de puntos | 51 M |
| Densidad nube | 2.842,83 pts/cm² |
| Malla triangular | 4,0 M |
**Obs.:** sobre la costa hay erosión, aporte y deriva costera de sedimentos hacia las barrancas.

### Trelew — *Parque Industrial Pesado y de Actividades Complementarias*
| Campo | Valor |
|---|---|
| Proyecto | Trelew / Pesado y Complementario |
| Captura / Proceso | 12 Feb 2022 / 29 Mar 2022 |
| GSD Ortomosaico | 3.96 cm/px (DEM 15,79 cm/px) |
| Área límite | 45.754.259,30 m² |
| Sensor | DJI FC330 |
| Obturación media | 1/1192 |
| Imágenes procesadas | 1329 (100%) |
| Total de puntos | 49,3 M |
| Densidad nube | 1.272,77 pts/cm² |
| Malla triangular | 4,0 M |
**Obs.:** diagnóstico de riesgo en 4 dimensiones (peligrosidad, vulnerabilidad social, exposición,
incertidumbre); fuentes: drones, inspección ocular, DEM, GlobalMapper, contacto con vecinos; la
cara sur es la más afectada.

### Trevelin — *Parque Industrial de Trevelin*
| Campo | Valor |
|---|---|
| Captura / Proceso | 12 Ene 2022 / 29 Mar 2022 |
| GSD Ortomosaico | 3.91 cm/px (DEM 15,69 cm/px) |
| Área límite | 433.783,34 m² |
| Sensor | DJI FC330 |
| Obturación media | 1/276 |
| Imágenes procesadas | 185 (100%) |
| Total de puntos | 11 M |
| Densidad nube | 3.000,76 pts/cm² |
| Malla triangular | 970.447 |
**Obs.:** sin corrientes de agua constantes; río Percey en la cara Oeste; **sin** riesgos de
inundación por crecidas del río.

---

## 3) Próximos pasos posibles para integrar al SIGPIP
- Convertir los **SHP de parcelas** a GeoJSON y mostrarlos como capa en el mapa del SIGPIP.
- Cargar estas **fichas técnicas** como metadatos de cada parque (ya existe la entidad parques).
- Enlazar desde cada parque del SIGPIP a sus **descargas** (links de Drive de arriba).
- Incorporar las **zonas de anegamiento por lluvias** como capa de riesgo.
