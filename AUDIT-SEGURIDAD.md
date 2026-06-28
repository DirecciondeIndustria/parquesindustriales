# Audit de Ciberseguridad — SIGPIP v1
**Fecha:** Junio 2026  
**Alcance:** App Android + Frontend Web + Backend Supabase  
**Criterio:** OWASP Top 10 2023 + contexto de gobierno (datos de inspección sensibles)

---

## 1. VULNERABILIDADES ACTUALES (CRÍTICAS)

### 🔴 1.1 XSS (Cross-Site Scripting) — Severidad ALTA
**Ubicación:** `web/public/actas-inspeccion/index.html` líneas 976, 1744, 1792, 1800, 1858, 2010, 2314, 2369, 2396, 3029, 3093, 3170, 3391, 3418, 3490, 3567, 3728, 3839

**Problema:** Uso masivo de `innerHTML` con datos dinámicos:
```javascript
cont.innerHTML = list.map(r => `<div>${r.empresa}</div>`).join('');
```
Si `r.empresa` viene de un campo editable o no validado, un atacante inyecta script:
```javascript
r.empresa = "<img src=x onerror='alert(1)'>";
```

**Impacto:** Robo de tokens de sesión, hijacking de co-inspección, alteración de actas en vivo.

**Remedio:** Reemplazar `innerHTML` → `textContent` o `insertAdjacentHTML` + sanitización.

---

### 🔴 1.2 Almacenamiento Local sin Encripción — Severidad ALTA
**Ubicación:** `localStorage` (líneas 1516, 1522, 1526, 1567, 1578, 2827, 2831, 2834, 2922, 3010)

**Problema:** Guardás datos sensibles en `localStorage`:
```javascript
localStorage.setItem('inspecciones_list', JSON.stringify(list));
```
**Vulnerabilidades:**
- Si el dispositivo se roba/jailbreakea, los datos están en texto claro.
- Las inspecciones en borrador con datos de empresas, multas, fotos, ubicación quedan expuestas.
- `localStorage` es accesible desde cualquier script (incluyendo XSS).

**Impacto:** Exposición de datos confidenciales de inspección industrial.

**Remedio:** 
- Android: usar `@capacitor/secure-storage` (cifrado con Keystore del dispositivo).
- Web: cifrar antes de guardar (no es para web, pero si lo hace alguien, hacerlo bien).

---

### 🟡 1.3 Falta de Validación de Entrada en Frontend — Severidad MEDIA
**Problema:** Los campos de texto (`empresa`, `inspector`, `observaciones`, etc.) no se validan antes de enviar a Supabase.

**Riesgo:**
```javascript
const { error } = await supa.auth.signInWithPassword({ email, password: pass });
```
¿Qué pasa si `email` contiene caracteres Unicode maliciosos o inyección SQL en comentarios?

**Remedio:** Validar en frontend (UX) y OBLIGATORIAMENTE en backend (seguridad).

---

### 🟡 1.4 HTTPS y Certificados — Severidad MEDIA-BAJA
**Estado:** La app carga desde `https://sigpip.vercel.app/` (bueno).

**Pero:** ¿Hay certificate pinning en la app nativa? Sin pinning, un MITM con cert falso intercepta todas las llamadas Supabase.

**Remedio:** Agregar certificate pinning en Android (Capacitor).

---

### 🟡 1.5 Exposición de Errores — Severidad BAJA
**Problema:** Los `console.log`, `console.warn` aparecen en logs públicos:
```javascript
console.warn('Capacitor Geolocation falló, usando fallback:', e);
```

**Riesgo:** Stack traces revelan tecnología interna (Supabase, Capacitor, versiones).

**Remedio:** Eliminar logs en producción; si necesitas, enviarlos a un logger privado (Sentry, CloudWatch).

---

## 2. RIESGOS POR ARQUITECTURA

### 🟠 2.1 Falta de Rate Limiting en API Supabase
**Problema:** Supabase tiene límites por defecto, pero no hay `X-RateLimit` headers configurado explícitamente.

**Riesgo:** Ataque de fuerza bruta en login, DOS en lista de inspecciones.

**Remedio:**
- Habilitar rate limiting en Supabase (Project Settings → Auth → Rate Limiting).
- Agregar middleware en Vercel para rate limit global por IP.

---

### 🟠 2.2 Autenticación sin 2FA
**Problema:** Login solo email + password. Sin segundo factor.

**Riesgo:** Si la contraseña se filtra (breach en otro sitio), la cuenta se compromete.

**Remedio:**
- Habilitar TOTP (Time-based OTP) en Supabase Auth.
- Para inspectores en campo, usar autenticación sin contraseña (magic link por email o biometría).

---

### 🟠 2.3 Roles y Permisos (RLS) — Estado Desconocido
**Problema:** No vi las políticas RLS de Supabase en el código. ¿Están bien configuradas?

**Preguntas críticas:**
- ¿Un inspector puede ver actas de otro inspector?
- ¿Puede modificar el `estado` de un acta (pasar de `Borrador` → `Firmada` sin autorización)?
- ¿El Portal de Empresas filtra datos por `parque_id` correctamente?

**Remedio:** Auditar cada tabla con `EXPLAIN` y validar RLS row-level:
```sql
SELECT * FROM actas WHERE user_id = auth.uid(); -- Solo sus actas
```

---

### 🟠 2.4 Co-inspección en Vivo — Canal sin Autenticación Verificada
**Problema:** El segundo inspector recibe notificación y entra a co-inspeccionar. ¿Cómo se verifica que realmente es un inspector autorizado?

**Riesgo:** Si alguien intercepta el token de co-inspección o advina el `co_inspector_id`, puede ver/manipular actas.

**Remedio:**
- Usar Supabase Realtime con JWT verificado.
- Enviar notificación solo al dispositivo registrado del inspector (push notification segura, no web).
- Expiración corta del token de co-inspección (5 min).

---

## 3. VULNERABILIDADES ESPECÍFICAS DE MÓVIL (Android)

### 🟠 3.1 Almacenamiento de Fotos en Cache del Dispositivo
**Problema:** ¿Dónde guardás las fotos tomadas antes de subirlas?
```javascript
const result = await Filesystem.writeFile({
  path: filename,
  directory: 'CACHE'
});
```
Si es en `CACHE`, están legibles por cualquier app con permiso.

**Remedio:**
- Usar `DOCUMENTS` o directorio privado de la app.
- Cifrar fotos en reposo con `@capacitor/secure-storage`.

---

### 🟠 3.2 Jailbreak/Root Detection
**Problema:** No hay detección de dispositivo comprometido. Un inspector podría ejecutar la app desde un emulador sin restricciones.

**Remedio:** Agregar validación nativa:
```java
boolean isDeviceSecure = DeviceIntegrityManager.check();
if (!isDeviceSecure) { alert("Dispositivo no seguro"); return; }
```

---

### 🟠 3.3 Debuggable Flag en APK
**Problema:** ¿El APK está compilado con `android:debuggable="false"`?

**Riesgo:** Si está en `true`, alguien puede atacar la app con debugger ADB.

**Remedio:** Verificar en `AndroidManifest.xml`. En CI/CD:
```xml
android:debuggable="false"
```

---

### 🟠 3.4 Protección de Certificados de Firma
**Problema:** El keystore (`sigpip.keystore`) está en GitHub Secrets. ¿Quién puede acceder a los secrets?

**Remedio:**
- Limitar access a GitHub Secrets a solo CI/CD.
- Rotar el keystore cada 2 años.
- No compartir el password del keystore en canales claros.

---

## 4. VULNERABILIDADES DE API / BACKEND

### 🟠 4.1 CORS Permisivo
**Problema:** Si Supabase está configurado con `CORS: *`, cualquier sitio puede hacer llamadas.

**Remedio:** Restringir CORS a dominios conocidos:
```
https://sigpip.vercel.app
https://app.sigpip.gob.ar (producción futura)
```

---

### 🟠 4.2 Secrets en Environment Variables
**Problema:** ¿El `SUPABASE_KEY` (anon key) está en el código del cliente?

**Riesgo:** Cualquiera puede leer el `.env` o inspeccionarlo en el navegador. Con la anon key, pueden hacer llamadas a Supabase.

**Remedio:**
- Usar Supabase RLS obligatoriamente (que haga).
- Si necesita control extra, crear un backend proxy (serverless en Vercel) que valide permisos.

---

### 🟠 4.3 Inyección SQL en Búsquedas
**Problema:** ¿Hay búsquedas de empresas/parques que usen texto libre sin parametrizar?

**Riesgo:** `WHERE empresa LIKE '%' + input + '%'` → inyección SQL.

**Remedio:**
- Supabase usa prepared statements, así que está seguro si usás el client correctamente.
- Ejemplo seguro:
```javascript
const { data } = await supa
  .from('empresas')
  .select('*')
  .ilike('nombre', `%${search}%`); // .ilike() parametriza
```

---

## 5. SEGURIDAD DE DATOS SENSIBLES

### 🟠 5.1 Ubicación GPS + Fotos + Identidad Inspector
**Problema:** El acta de inspección vincula:
- `geo.lat, geo.lng` (ubicación exacta del inspector)
- `foto` (prueba visual de la inspección)
- Nombre del inspector
- Nombre de la empresa (sin anonimizar)

**Riesgo:** Un atacante correlaciona ubicación + foto → identifica movimientos del inspector.

**Remedio:**
- No guardar GPS exacto públicamente (redondear a ~10m).
- Fotos: cifrar en reposo, acceso restringido a permisos de la acta.
- Logs de auditoría: quién accedió qué acta y cuándo.

---

### 🟠 5.2 Retención de Datos
**Problema:** ¿Cuánto tiempo se guardan las actas en Supabase? ¿Hay política de borrado de datos antiguos?

**Remedio:**
- Definir ciclo de vida: inspecciones de >5 años → archivo (base de datos histórica separada).
- Backup: ubicación segura, encriptado, no en mismo datacenter que producción.

---

## 6. INCIDENTES Y RESPUESTA

### 🟡 6.1 Falta de Monitoreo y Logging
**Problema:** No hay alertas si alguien intenta múltiples logins fallidos o accede a actas ajena.

**Remedio:**
- Habilitar Supabase Logs (ver todas las queries que genera).
- Integrar con Sentry para errores.
- Crear CloudWatch alerts:
  - "Más de 10 fallos de login en 5 min" → banear IP.
  - "Acceso a acta fuera de parque asignado" → alert manual.

---

### 🟡 6.2 Falta de Política de Incident Response
**Problema:** ¿Qué hace si descubrís una acta comprometida?

**Remedio:** Documentar:
- Quién reporta (inspector, admin, usuario externo).
- Quién investiga (dev + admin).
- Notificación a afectados (empresa, supervisor).
- Remediación (borrar, reparar, auditar).

---

## 7. IMPLEMENTACIÓN POR PRIORIDAD

### 🚨 CRÍTICO (hacer YA)
- [ ] Eliminar `innerHTML`, reemplazar con `textContent` + sanitización (DOMPurify).
- [ ] Migrar `localStorage` → Capacitor Secure Storage.
- [ ] Validar entrada en frontend + backend (Zod/Yup en frontend, Postgres CHECK en backend).
- [ ] Auditar RLS de todas las tablas.
- [ ] Habilitar 2FA en Supabase Auth.

### ⚠️ ALTO (próximas 2 semanas)
- [ ] Agregar Certificate Pinning en Android.
- [ ] Configurar Rate Limiting (Supabase + Vercel).
- [ ] Limpiar logs en producción (no exponer stack traces).
- [ ] Verificar `android:debuggable="false"` en APK.
- [ ] Implementar jailbreak detection.

### 📋 MEDIO (próximo sprint)
- [ ] Sentry para monitoreo de errores.
- [ ] Política CORS restrictiva.
- [ ] Auditoría de co-inspección (token con expiración).
- [ ] Redondear GPS (privacy-preserving).
- [ ] Logs centralizados (CloudWatch).

### 🔧 BAJO (nice-to-have)
- [ ] Encryption de fotos en reposo.
- [ ] Backend proxy en Vercel para control de RLS.
- [ ] Data retention policy (archival de actas viejas).
- [ ] Incident response playbook.

---

## 8. CHECKLIST PREVIO A PRODUCCIÓN

```
SEGURIDAD DE CÓDIGO:
☐ Sin innerHTML en datos dinámicos (sanitizado o textContent)
☐ Validación de entrada en frontend y backend
☐ Secrets NO en .env/.git (usar GitHub Secrets + CI/CD)
☐ Logs limpios (no exponen stack traces)

AUTENTICACIÓN Y AUTORIZACIÓN:
☐ 2FA habilitado en Supabase
☐ RLS auditado en cada tabla
☐ CORS restrictivo
☐ Rate limiting configurado

ALMACENAMIENTO:
☐ localStorage reemplazado con Secure Storage
☐ Fotos en directorio privado (no CACHE)
☐ Backup encriptado en zona segura

MÓVIL:
☐ APK sin debuggable
☐ Certificate pinning
☐ Jailbreak detection
☐ Permisos minimales en AndroidManifest

OPERACIONES:
☐ Monitoreo (Sentry + CloudWatch)
☐ Alertas de anomalías (login fallidos, acceso no autorizado)
☐ Plan de incident response
☐ Política de datos (retención, borrado, archivo)
```

---

## 9. ESTIMACIÓN DE ESFUERZO

| Tarea | Horas | Prioridad |
|-------|-------|-----------|
| XSS + sanitización | 16 | CRÍTICO |
| Migrate localStorage → Secure Storage | 12 | CRÍTICO |
| Validación de entrada (frontend + backend) | 20 | CRÍTICO |
| Auditar + arreglar RLS | 14 | CRÍTICO |
| 2FA en Supabase | 6 | ALTO |
| Certificate Pinning | 10 | ALTO |
| Rate Limiting | 8 | ALTO |
| Jailbreak Detection | 8 | ALTO |
| Sentry + logging | 12 | MEDIO |
| CORS + security headers | 4 | MEDIO |
| **TOTAL CRÍTICO + ALTO** | **110 horas** | ~3 semanas 1 dev |

---

## 10. TECNOLOGÍAS RECOMENDADAS

### Frontend Seguridad:
- **DOMPurify** — sanitizar HTML dinámico.
- **Zod o Yup** — validar datos en frontend.
- **@owasp/browser-apis** — evitar vulnerable APIs.

### Backend Seguridad:
- **Supabase RLS** — ya tenés, auditar bien.
- **PostgREST CHECK constraints** — validación en DB.
- **Supabase Realtime JWT** — co-inspección segura.

### Móvil:
- **@capacitor/secure-storage** — cifrado nativo.
- **@capacitor-community/app-integrity** — jailbreak detection.
- **Native SSL pinning** — en MainActivity.java.

### Operaciones:
- **Sentry** — error tracking.
- **AWS CloudWatch / Datadog** — logs + alertas.
- **Vault (HashiCorp)** — gestión de secrets (si escalás).

---

**Conclusión:**  
SIGPIP es una app de riesgo **MEDIO-ALTO** (datos de inspección industrial son sensibles).  
Las vulnerabilidades XSS + localStorage son **CRÍTICAS** y hacen que sea insegura para producción ahora.  
Con ~110 horas de trabajo en los items CRÍTICO+ALTO, podés llevar el riesgo a **BAJO**.  
Antes de que los inspectores del Chubut empiecen a usar: **auditar RLS y arreglar XSS**.
