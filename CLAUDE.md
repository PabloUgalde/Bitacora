# Bitácora de Vuelo — CLAUDE.md

App PWA de bitácora de vuelo para pilotos chilenos. Producción: **https://bitacoradevuelo.cl**

## Stack
- **Frontend:** Vanilla JS / HTML5 / CSS3 — sin framework, sin bundler
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions en Deno/TS)
- **Pagos:** Flow.cl (HMAC-SHA256)
- **Email:** Resend (`noreply@bitacoradevuelo.cl`)
- **Librería gráficos:** Chart.js (CDN)
- **Excel/CSV:** SheetJS (CDN)
- **PWA:** Service Worker `sw.js` (cache v2.28), `manifest.json`

## Estructura de archivos clave

| Archivo | Rol |
|---------|-----|
| `index.html` | App shell (772 líneas, carga 15+ scripts en orden específico) |
| `landing.html` | Landing page pública (v2 HUD). CTAs apuntan a `index.html?auth=1`. Sin formularios inline — el auth vive en la app. |
| `app.js` | Entry point: inicializa módulos, event listeners, registra SW |
| `state.js` | Estado global: `flightData[]`, `userProfile`, `logbookState` |
| `auth.js` | Supabase Auth: login, registro, recuperación de contraseña |
| `api.js` | CRUD de vuelos, offline queue, sincronización con Supabase |
| `ui.js` | Router, notificaciones, modales, utilidades UI |
| `ui-render.js` | Renderiza tabla del logbook con paginación y filtros |
| `summary-renderer.js` | Vistas de resumen (por tiempo, tipo, aeropuerto, IFR) |
| `report-generator.js` | Exportación PDF/Excel, layout de impresión |
| `plan.js` | Gating Free/Pro: `isPro()`, `checkProFeatures()` |
| `licenses-system.js` | Catálogo de licencias DGAC (DAR 61 / DAN 61) |
| `add-flight-modal.js` | Modal de agregar/editar vuelo con validación |
| `saldo-inicial.js` | Ingreso de saldo inicial (registro especial) |
| `data-importer.js` | Importación Excel/CSV con validación de esquema (35KB) |
| `anotaciones.js` | Notas por vuelo |
| `mi-cuenta.js` | Configuración de cuenta, cambio de contraseña, eliminación |
| `onboarding.js` | Flujo de bienvenida para nuevos usuarios |
| `time-utils.js` | Parseo y formateo de fechas/horas |
| `logbook-scanner.js` | Escáner IA de bitácora física: multi-foto, Gemini Vision, revisión editable, consolidación |
| `supabase/functions/` | Edge Functions: `create-checkout`, `flow-webhook`, `flow-return`, `delete-account`, `gemini-ocr` |

**Orden de carga de scripts (crítico):**
`state.js → auth.js → api.js → licenses-system.js → plan.js → ui.js → ui-render.js → summary-renderer.js → report-generator.js → add-flight-modal.js → saldo-inicial.js → data-importer.js → onboarding.js → profile-validator.js → anotaciones.js → mi-cuenta.js → backup-manager.js → time-utils.js → logbook-scanner.js → app.js`

## Base de datos (Supabase)

**Tablas principales:**
- `profiles` — metadata usuario: `full_name`, `plan`, `plan_expires_at`, `trial_used`, `licenses` (JSONB)
- `flights` — logbook (31 columnas): `fecha`, `aeronave_marca_modelo`, `matricula`, `duracion_total`, tipos de aeronave (LSA/Monomotor/etc.), aterrizajes (día/noche), condiciones (IFR/Diurno/Nocturno), tipos de tiempo (Solo/PIC/SIC/Instrucción), `observaciones`, `pagina_bitacora`, `es_saldo_inicial`, `deleted_at` (papelera/soft-delete — ver `supabase/soft-delete-flights.sql`)
- `anotaciones` — notas libres por vuelo

**Papelera (soft-delete) y protecciones anti-pérdida de datos:**
- `deleteFlight`/`deleteAllFlights` marcan `deleted_at` en vez de DELETE físico; UI de papelera en Configuración → Zona de peligro (restaurar / vaciar). Purga automática client-side a los 30 días. Fallback a DELETE físico si la columna no existe aún.
- "Eliminar todos los vuelos" exige escribir ELIMINAR y descarga respaldo CSV automático antes de ejecutar. "Eliminar cuenta" también descarga respaldo (pero su borrado es físico, por privacidad).
- `loadInitialFlights` compara la nube con el caché local: si la nube devuelve 0 (o < 50% con 10+ vuelos locales), muestra modal de discrepancia ofreciendo descargar la copia local en CSV antes de sobrescribir el caché. La nube SIEMPRE es la fuente de verdad — nunca se re-sube el caché local automáticamente.
- Saldo inicial: se guarda (upsert) ANTES de eliminar el anterior — nunca borrar-antes-de-escribir.

**Supabase project:** `rdnniehpsdforkfngwrf.supabase.co`

## Planes Free/Pro
- **Free:** CRUD básico de vuelos, dashboard, resumen por tiempo
- **Pro:** Resúmenes por aeronave/aeropuerto/IFR, exportación Excel/PDF, búsqueda avanzada
- **Trial:** 14 días sin tarjeta
- **Pago:** Flow.cl → webhook → activa Pro en Supabase → email por Resend

## Offline sync
- Escrituras se encolan en `localStorage._pendingQueue`
- `api.syncPendingFlights()` sincroniza al reconectar
- SW intercepta fetch solo para recursos locales (no Supabase/CDN)

## Variables de entorno (Supabase Secrets)
```
FLOW_API_KEY, FLOW_SECRET, FLOW_ENV (production/sandbox)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
GEMINI_API_KEY   ← usado por la Edge Function gemini-ocr (nunca expuesto al cliente)
```

## Patrones de código
- Módulos como object literals: `const ModuleName = { method() {} }`
- Estado global con `let` en `state.js` (no hay módulos ES ni bundler)
- Campos y comentarios en español (domain language = DGAC)
- Claves de Supabase son publicables (seguridad vía RLS + JWT)

## Landing page (v2 HUD)

`landing.html` fue rediseñada completamente. Características clave:

- **Estética:** dark aviation HUD — paleta gold `#D4AF37`, fondo `#070809`, scanlines CSS
- **Tipografías:** Space Grotesk (cuerpo), Barlow Condensed (títulos grandes), Share Tech Mono (datos HUD)
- **HUD flotante:** paneles ALT/IAS/HDG en lateral derecho + barra VS izquierda, animados con scroll via `lerp()` en `requestAnimationFrame`
- **Radar hero:** anillos SVG + sweep giratorio como fondo animado
- **Banda de instrumentos:** datos de ejemplo explícitamente etiquetados con badge "EJEMPLO" y texto explicativo. No son datos reales de plataforma.
- **Mockups inline:** dashboard y resúmenes renderizados como HTML/SVG — sin imágenes externas
- **Pricing toggle:** vista mensual / anual con dos grids intercambiables (`grid-monthly` / `grid-annual`)
- **Auth:** todos los CTAs → `index.html?auth=1`. Redirect automático si hay sesión activa en `localStorage` (`sb-rdnniehpsdforkfngwrf-auth-token`)
- **Sin dependencias externas de JS** — todo vanilla, sin Chart.js ni librerías en el landing

## Escáner IA de bitácora física (`logbook-scanner.js`)

Módulo para digitalizar páginas físicas de bitácora mediante visión IA.

**Flujo:** Upload multi-foto → compresión automática si >3.5MB → Edge Function `gemini-ocr` (proxy JWT) → Gemini Vision → revisión/edición por foto → consolidación ordenada por número de página → descarga Excel o importación directa.

**API:** Google Gemini `gemini-3.1-flash-lite-preview`, llamado vía Edge Function `gemini-ocr` (Supabase). El cliente envía JWT de Supabase; la key de Gemini vive en `GEMINI_API_KEY` (secreto de Supabase) y nunca llega al browser. Usar solo modelos Gemini con visión — Gemma (texto puro) rechaza imágenes.

**Parámetros clave del modelo:**
- `temperature: 0.1`, `response_mime_type: 'application/json'`
- `thinkingConfig` eliminado — no soportado por modelos lite

**Estado interno:** `_pages[]` (una entrada por foto con `{ file, photoURL, _displayURL, rotation, mime, flights, processed, _error }`). `_mode: 'page' | 'all'` controla si se opera sobre una página o el consolidado.

**Validaciones:** tipo avión suma vs duración, diurno+nocturno vs duración. Los roles (PIC/SIC/Solo/Instrucción) NO se validan en suma — son concurrentes en aviación.

**Rotación de imagen:** `_applyRotation(page)` genera `_displayURL` via canvas (imagen real rotada, no CSS transform). Se actualiza tanto el thumbnail como la foto principal. La URL rotada se cachea en `page._displayURL`.

**Rate limit:** `_scanPage()` detecta el mensaje "retry in Xs" de Gemini y hace countdown visible + reintento automático. Botón "↻ Reintentar" por foto en caso de error persistente.

**Re-escanear:** botón `↺` en thumbnail de cada foto (visible siempre, no solo en errores) y botón `↺ Re-escanear` en barra de navegación de la vista de revisión. Permite volver a analizar fotos con resultados insatisfactorios sin reiniciar el flujo completo. Usa `rescanCurrent()` o `_retryPage()`.

**Detección de formato de tiempo:** el prompt detecta automáticamente si la bitácora usa formato decimal (H.h: `1|5=1.5`) o HH:MM (`1:30→1.5`) verificando contra el TOTAL PAGINA. Campos de conteo entero (Aterrizajes Dia/Noche, NO) se leen sin conversión.

**Independencia de filas:** el prompt instruye explícitamente a leer cada fila de forma independiente sin inferir valores de filas adyacentes (crítico para bitácoras con múltiples aeronaves similares).

**Timeout client-side:** AbortController de 90s — evita que el fetch quede colgado indefinidamente si el modelo no responde.

**Número de página:** Gemini lee el número impreso en la foto. Fallback: calcula continuando desde el máximo existente en `flightData`.

**Totales:** integrados como `<tfoot>` sticky en la misma tabla (no sección separada).

**Importación:** usa `api.saveFlightsBatch()` — mismo pipeline que el importador Excel.

Ver `ai-map.md` para detalles de integración IA.

## Estado actual del proyecto
✅ Completamente funcional en producción  
✅ Auth, CRUD vuelos, offline, dashboard, logbook, resúmenes, licencias, pagos, PWA, importador Excel/CSV, impresión  
✅ Landing v2 HUD desplegada  
✅ Escáner IA de bitácora física (funcional, pendiente prueba completa post rate-limit)  
✅ Auditoría de integridad de datos aplicada (jul 2026): cola offline por usuario, sync con upsert idempotente, SW app shell completo (v2.28), renovación Pro extiende vencimiento, guard de trial  
✅ Protecciones anti-pérdida (jul 2026): papelera soft-delete 30 días, auto-backup CSV pre-borrado, confirmación escrita en borrado masivo, guard de discrepancia nube/caché, saldo inicial upsert-primero  
⚠️ Área de desarrollo activa: `logbook-scanner.js`, `data-importer.js`  
❌ Sin tests, sin linter, sin TypeScript

## Pendientes de la auditoría (jul 2026) — analizar y resolver en próxima sesión

Detectados en la revisión de integridad pero NO modificados (requieren decisión o pruebas):

1. **`wx-proxy` es un proxy abierto** (`supabase/functions/wx-proxy/index.ts`): CORS `*`, sin autenticación. El endpoint `/wx-proxy/gemini` permite a cualquiera consumir `GEMINI_API_KEY` (también expone AVWX y REDEMET). Sirve a herramientas-vuelo — no romper ese consumidor. Opciones: validar header `Origin` contra lista blanca, rate limit, o mover el endpoint Gemini a función autenticada.
2. **"Eliminar cuenta" no elimina la cuenta de Auth**: `miCuenta.deleteAccount()` usa la ruta cliente (`api.deleteUserAccountAndData`) que borra vuelos y perfil, pero el usuario de Supabase Auth sigue existiendo. La Edge Function `delete-account` sí lo elimina pero está sin usar por un problema de CORS anotado en `mi-cuenta.js`. Retomar: diagnosticar el CORS y cablear la función (con fallback cliente).
3. **Importación parcial duplica vuelos**: si un lote falla a mitad de una importación Excel/escáner, reintentar re-importa los lotes ya insertados (cada parseo genera ids nuevos). Solución propuesta: dedupe por fecha+matrícula+duración antes de insertar, o ids deterministas por contenido.
4. **Sin control de concurrencia multi-dispositivo**: ediciones son "last write wins" a nivel de fila completa; una cola offline vieja de un dispositivo puede pisar ediciones más recientes de otro. Evaluar `updated_at` + comparación antes de escribir.
5. ✅ RESUELTO (13-jul-2026): RLS verificado vía Management API — `flights`, `profiles`, `anotaciones` y `aircraft` tienen RLS habilitado con política `ALL` restringida a `auth.uid()`. **PERO se detectó un hueco nuevo → ver punto 13.**
6. **`gemini-ocr` acepta body arbitrario**: cualquier usuario autenticado puede usarla como proxy Gemini genérico (modelo pinneado, pero sin límite de tamaño ni forma del payload). Considerar validar estructura del body y limitar tamaño.
7. **`time-utils.js` está vacío (0 bytes)** y no se carga en `index.html` — eliminar el archivo o implementar lo planeado.
8. **XSS con datos propios**: varios render usan `innerHTML` con valores del usuario sin escapar (ej. sugerencias de observaciones en `app.js`, tablas del logbook). Riesgo bajo (self-XSS), pero conviene una función `escapeHtml` común.
9. **Multi-tab**: dos pestañas escribiendo `localStorage` (`flightLogData`, cola pending) pueden pisarse entre sí. Evaluar `storage` event o BroadcastChannel para invalidar estado.
10. **Deploy pendiente de Edge Functions corregidas**: `supabase functions deploy flow-webhook create-checkout` (cambios de renovación y trial aplicados en el código, aún sin desplegar).
11. ✅ RESUELTO (13-jul-2026): `supabase/soft-delete-flights.sql` ejecutado en producción vía Management API (columna `deleted_at` + índice `flights_user_deleted_idx` verificados). La papelera está activa.
12. **Backups de Supabase según plan**: confirmar si el proyecto está en plan Free (sin backups automáticos) o Pro (diarios, 7 días). Si es Free, evaluar upgrade o un dump programado (`pg_dump` vía GitHub Action / cron) como respaldo de toda la base.
13. ✅ RESUELTO (13-jul-2026): privilegios de columna aplicados en producción (`supabase/protect-plan-columns.sql`). El rol `authenticated` solo puede INSERT/UPDATE las columnas de perfil que escribe `api.saveProfile()`; `plan`, `plan_expires_at` y `trial_used` quedan escribibles solo por service role y postgres (dashboard). Verificado: UPDATE de `plan` como authenticated → `permission denied`; columnas normales y DELETE de cuenta propia siguen funcionando. Si en el futuro `saveProfile` escribe una columna nueva, hay que agregarla al GRANT o el guardado de perfil fallará con 42501.

## Archivos de mayor complejidad
- `data-importer.js` (35KB) — parseo de fechas Excel, validación de esquema
- `api.js` (28KB) — offline queue, CRUD completo
- `app.js` (45KB) — inicialización y event listeners de toda la app
- `logbook-scanner.js` (~600 líneas) — escáner IA multi-foto, revisión editable, consolidación, retry
- `index.html` (~800 líneas) — shell + carga de scripts
- `supabase/functions/gemini-ocr/index.ts` — proxy JWT para Gemini, CORS multi-origen

## No hay build step
Sin `package.json`. Los archivos se despliegan tal cual. Para desplegar: subir archivos al hosting (Supabase static / Cloudflare Pages). Edge functions: `supabase functions deploy <nombre>`.
