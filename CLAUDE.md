# Bitácora de Vuelo — CLAUDE.md

App PWA de bitácora de vuelo para pilotos chilenos. Producción: **https://bitacoradevuelo.cl**

## Stack
- **Frontend:** Vanilla JS / HTML5 / CSS3 — sin framework, sin bundler
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions en Deno/TS)
- **Pagos:** Flow.cl (HMAC-SHA256)
- **Email:** Resend (`noreply@bitacoradevuelo.cl`)
- **Librería gráficos:** Chart.js (CDN)
- **Excel/CSV:** SheetJS (CDN)
- **PWA:** Service Worker `sw.js` (cache v2.38), `manifest.json`

## Estructura de archivos clave

| Archivo | Rol |
|---------|-----|
| `index.html` | App shell (772 líneas, carga 15+ scripts en orden específico) |
| `landing.html` | Landing page pública (v2 HUD). CTAs apuntan a `index.html?auth=1`. Sin formularios inline — el auth vive en la app. |
| `app.js` | Entry point: inicializa módulos, event listeners, registra SW |
| `state.js` | Estado global: `flightData[]`, `userProfile`, `logbookState`. También expone helpers globales usados por todo el resto (`formatHours`, `normalizeAircraftModel`) — carga primero para que estén disponibles en los scripts siguientes |
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
| `supabase/functions/` | Edge Functions: `create-checkout`, `flow-webhook`, `flow-return` (pago único), `flow-subscription-start`, `flow-subscription-return`, `flow-subscription-webhook`, `flow-subscription-cancel` (cargo automático — ver sección propia), `delete-account`, `gemini-ocr`, `wx-proxy` (JWT + Pro en /gemini), `send-announcement` (anuncios por Resend: preview/dry-run/test/send, protegida por secreto `ANNOUNCE_SECRET`, deployada con `--no-verify-jwt` porque su propio secreto ya la protege) |
| `marketing/` | `email-en-vuelo-preview.html` (copia de vista previa — la fuente es la Edge Function) y `whatsapp-en-vuelo.md` (textos de difusión) |

**Orden de carga de scripts (crítico):**
`state.js → auth.js → api.js → licenses-system.js → plan.js → ui.js → ui-render.js → summary-renderer.js → report-generator.js → add-flight-modal.js → saldo-inicial.js → data-importer.js → onboarding.js → profile-validator.js → anotaciones.js → mi-cuenta.js → backup-manager.js → time-utils.js → logbook-scanner.js → aeronaves-db.js → live-log.js → peso-balance.js → app.js`

## Base de datos (Supabase)

**Tablas principales:**
- `profiles` — metadata usuario: `full_name`, `plan`, `plan_expires_at`, `trial_used`, `licenses` (JSONB), `pagina_config` (JSONB — ver "Formato de bitácora física / vuelos por página" más abajo)
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
- **Pago único:** Flow.cl → `flow-webhook` → activa Pro en Supabase → email por Resend
- **Cargo automático (opcional, en paralelo al pago único):** Flow.cl Suscripciones — ver sección propia más abajo

## Cargo automático (Flow Subscriptions, ago-2026)

Camino alternativo al pago único existente: el usuario registra su tarjeta una vez y Flow cobra solo cada mes/año, reintenta cobros fallidos y notifica por webhook. `create-checkout`/`flow-webhook`/`flow-return` (pago único) quedan intactos — el usuario elige "pagar una vez" o "activar cargo automático" en el mismo modal de upgrade.

**Flujo:** `plan.activateAutopay(planType)` → `flow-subscription-start` (crea `customer` en Flow si no existe, guarda `flow_customer_id`, llama `customer/register`) → redirect a Flow para ingresar tarjeta → `flow-subscription-return` (confirma `customer/getRegisterStatus`, crea la suscripción con `subscription/create`, guarda `flow_subscription_id`/`flow_subscription_status`/`flow_card_last4`).

**Otorgamiento de Pro — confirmado empíricamente en sandbox 05-ago-2026 (distinto de lo asumido al diseñar):** Flow resuelve el primer cobro de forma **síncrona** dentro de la misma llamada a `subscription/create` — la respuesta ya trae `invoices[0]` con `status:1` (pagado) cuando el plan no tiene trial. `flow-subscription-return` revisa ese primer invoice y, si viene pagado, otorga `plan='pro'` + `plan_expires_at` (= `invoices[0].period_end`) y manda el email de confirmación **ahí mismo**, sin esperar ningún webhook — luego redirige a `/?subscription=success`. Si el invoice no viene pagado (plan con `trial_period_days > 0`, ej. el anual) no se otorga Pro y redirige a `/?subscription=pending`; en ese caso queda pendiente de `flow-subscription-webhook` para cuando llegue el cobro real (sin verificar aún, ver riesgo abajo). `flow-subscription-webhook` sigue siendo responsable de las **renovaciones futuras** (mes 2 en adelante) — eso tampoco está verificado todavía, se sabrá recién cuando llegue la fecha de renovación de una suscripción de prueba.

**Cupón de descuento (05-ago-2026):** campo de texto "Código de descuento" en el modal, solo visible para el plan anual — el código se manda como query param (`?coupon=`) a través de `url_return` de `customer/register` y se resuelve a un `couponId` numérico en `flow-subscription-return` vía el secreto `FLOW_COUPON_MAP` (JSON, ej. `{"PILOTOCUA":1278}` — editable sin redeploy). `subscription/create` solo acepta el id numérico de Flow, no el nombre visible en su dashboard. Si el código no resuelve, la suscripción se crea igual sin descuento y se agrega `&couponInvalid=1` al redirect para avisar al usuario.

**Cancelación:** `plan.cancelSubscription()` → `flow-subscription-cancel` — lee `flow_subscription_id` de la propia fila del usuario autenticado (nunca del body, para que nadie cancele la suscripción de otro), llama `subscription/cancel` en Flow. El acceso Pro sigue activo hasta `plan_expires_at` — no se retira al cancelar, se deja vencer igual que un pago único no renovado. **Verificado en sandbox 05-ago-2026**: la suscripción quedó "Cancelada" en el dashboard de Flow y `flow_subscription_status='cancelled'` en Supabase, con `plan='pro'` intacto hasta el vencimiento.

**Columnas nuevas en `profiles`** (`supabase/add-subscription-columns.sql`): `flow_customer_id`, `flow_subscription_id`, `flow_subscription_status` (`inactive|active|trial|past_due|cancelled`), `flow_card_last4`. Ninguna se agrega al GRANT de `protect-plan-columns.sql` — quedan escribibles solo por `service_role` (mismo tratamiento que `plan`/`plan_expires_at`/`trial_used`).

**Secretos propios, separados del pago único:** las 4 funciones nuevas usan `FLOW_SUB_API_KEY`/`FLOW_SUB_SECRET`/`FLOW_SUB_ENV` (NO `FLOW_API_KEY`/`FLOW_SECRET`/`FLOW_ENV`, que son los que ya usan `create-checkout`/`flow-webhook` en producción). Como solo existe un proyecto Supabase, esto es lo que permite dejar el cargo automático apuntando a Flow **sandbox** indefinidamente sin arriesgar los pagos únicos reales — son credenciales de Flow completamente distintas (sandbox.flow.cl tiene su propio API key/secret, no es el mismo par con un flag). Recién cuando se valide todo el ciclo se cambia `FLOW_SUB_ENV` a `production` con las credenciales de Flow producción. También requieren el contrato **"Cargo Automático"** activado como medio de pago en la cuenta Flow (Medios de pago → Editar datos → seleccionar Cargo Automático → código por email) — sin esto, `customer/register` falla con `code:7001 "Commerce has not automatic charge contract"`.

**Las 4 funciones se deployan con `--no-verify-jwt`** (igual que `create-checkout`/`flow-webhook`/`flow-return`): `flow-subscription-return` y `flow-subscription-webhook` los llama Flow directamente (redirect del navegador / servidor a servidor) sin header de autorización — con la verificación JWT de la plataforma activada (el default de `supabase functions deploy`) fallan con `UNAUTHORIZED_NO_AUTH_HEADER` antes de ejecutar el código. `flow-subscription-start`/`flow-subscription-cancel` validan el JWT ellos mismos en el código (`supabase.auth.getUser(token)`), igual que `create-checkout`.

**⚠️ Riesgo sin verificar:** el shape del body que Flow envía a `urlCallback` de suscripciones para **renovaciones** (`invoiceId` vs `token` vs `subscriptionId`) no está confirmado todavía — no llegó ninguna renovación real aún (la primera suscripción de prueba se creó y canceló el mismo día). `flow-subscription-webhook` maneja varios shapes de forma defensiva y loguea el body crudo, pero falta ver un caso real cuando venza el primer ciclo mensual de una suscripción de prueba (05-sep-2026 aprox.).

**⚠️ Debug temporal activo:** tabla `public._debug_log` + inserts `dbg(...)` en `flow-subscription-return` — quedaron adrede para poder diagnosticar la renovación cuando llegue. Sacar (`drop table public._debug_log` + quitar los `dbg(...)` del código) antes de pasar a producción.

**⚠️ Detalle cosmético sin resolver:** `plan_expires_at` se guarda parseando `invoices[0].period_end` de Flow (ej. "2026-09-04 00:00:00") como si fuera UTC; si en realidad es hora de Chile, la fecha mostrada en la UI puede verse un día antes (ej. "03-09" en vez de "04-09") para usuarios en huso horario negativo. No afecta el cobro real, solo el texto de vencimiento mostrado.

**Estado actual (05-ago-2026): validado en sandbox el ciclo completo mensual** (registrar tarjeta → primer cobro síncrono → Pro otorgado → cancelar → confirmado "Cancelada" en Flow). **Sin validar todavía:** ciclo del plan anual con trial (el otorgamiento de Pro debería quedar pendiente del webhook a los 14 días — no probado), renovaciones mensuales futuras (webhook), y el cupón de descuento recién agregado. Nada de esto se ha desplegado a producción — todo corre contra Flow sandbox desde `http://localhost:8080` (no subido al hosting real). Antes de producción falta: repetir creación de planes/cupones/`urlCallback` con credenciales de Flow producción, sacar el debug temporal, y subir `plan.js`/`app.js`/`index.html` al hosting **después** de desplegar las funciones de producción.

**⚠️ Restos operativos de la sesión de pruebas (06-ago-2026) — limpiar/verificar antes de continuar o de ir a producción:**
- Servidor local `python3 -m http.server 8080` corriendo en background desde la raíz del repo, sirviendo `index.html` para probar contra Flow sandbox sin tocar el hosting real.
- Secreto `SUB_TEST_REDIRECT=http://localhost:8080` seteado en Supabase — hace que `flow-subscription-return` redirija a localhost en vez de a `bitacoradevuelo.cl`. **Sacarlo antes de producción** (`supabase secrets unset SUB_TEST_REDIRECT` o dejar de setearlo).
- Usuario de prueba: `pugalde@toyvi.cl` / contraseña `test1234` (fijada directo en `auth.users` vía `crypt()`/`pgcrypto`, sin pasar por email, porque el envío de recuperación de contraseña de Supabase Auth no estaba llegando — pendiente de investigar esa causa raíz aparte, podría afectar a usuarios reales).
- Tabla `public._debug_log` en la base de producción (mismo proyecto que todo lo demás) con los inserts de diagnóstico de `flow-subscription-return` — pendiente `drop table` + quitar las llamadas `dbg(...)` del código una vez validada la renovación mensual (~05-sep-2026).
- Quedaron varias suscripciones de prueba creadas/canceladas en el dashboard de Flow sandbox (customer `cus_d46d6e38c3`) — no requieren limpieza para que todo funcione, pero conviene saber que existen si se revisa el dashboard de Flow.
- Posible cambio de proveedor de pago en evaluación: se consideró migrar el cargo automático de Flow a **Mercado Pago Suscripciones** — sin decisión tomada, pendiente confirmar con soporte de Mercado Pago si se requiere empresa constituida o basta con cuenta de vendedor persona natural antes de invertir tiempo en portar el desarrollo.

## Offline sync
- Escrituras se encolan en `localStorage._pendingQueue`
- `api.syncPendingFlights()` sincroniza al reconectar
- SW intercepta fetch solo para recursos locales (no Supabase/CDN)

## Variables de entorno (Supabase Secrets)
```
FLOW_API_KEY, FLOW_SECRET, FLOW_ENV (production/sandbox)   ← pago único (create-checkout, flow-webhook)
FLOW_SUB_API_KEY, FLOW_SUB_SECRET, FLOW_SUB_ENV             ← cargo automático (flow-subscription-*), credenciales separadas
FLOW_PLAN_ID_MONTHLY, FLOW_PLAN_ID_ANNUAL                   ← planId de Flow para cargo automático
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

## Formato de bitácora física / vuelos por página (13-ago-2026)

Numeración automática de "Página Bitácora a Replicar" (agregar vuelo manual, Live Log, importador Excel, escáner IA) asumía siempre **8 vuelos por página**, que es el formato DGAC vigente — pero bitácoras antiguas (o de otras imprentas) traen más o menos, y un mismo piloto puede haber usado más de un formato a lo largo de su carrera (bitácora vieja con N vuelos/página hasta cierta página, luego una nueva con 8). Configurable en **Configuración → Formato de Bitácora**.

**Modelo de datos:** `profiles.pagina_config` (JSONB, `supabase/add-pagina-config-column.sql`, aplicada en producción) — lista de *breakpoints* ordenados por página de inicio, no pares desde/hasta explícitos (evita bugs de huecos/solapamientos): `[{"desde":1,"vuelosPorPagina":6},{"desde":121,"vuelosPorPagina":8}]` significa páginas 1-120 con 6 vuelos/página, desde la 121 en adelante con 8. Array vacío o ausente = 8 (comportamiento histórico, sin cambios para quien no toque la configuración nueva). Como lo escribe el propio usuario desde Configuración (`api.saveProfile`), necesitó GRANT explícito de `insert`/`update` para `authenticated` — ver [[bitacora-profiles-column-grants]] en memoria: cualquier columna nueva de `profiles` que escriba el cliente sin ese GRANT falla con 42501.

**Helpers globales (`state.js`):**
- `getVuelosPorPagina(pageNumber, config?)` — busca en `userProfile.paginaConfig` (o el `config` explícito) el breakpoint vigente para esa página; default 8 si no hay config.
- `assignPageNumbers(startPage, startCountOnStartPage, count, config?)` — asigna página a `count` vuelos nuevos en orden, empezando en `startPage` con `startCountOnStartPage` cupos ya ocupados; respeta cambios de formato a mitad de camino si el rango de la importación cruza un breakpoint.

Reemplazan los `Math.floor(i / 8)` / `>= 8` hardcodeados que existían en: `ui.js` (`createFlightObject`, alta manual), `live-log.js` (guardado post-vuelo), `app.js` (importador Excel, modos `auto` e `insert_start`), `data-importer.js` (`showPageNumberModal`, cálculo de página para el texto del modal) y `logbook-scanner.js` (`_autoFillPages`, fallback cuando Gemini no detectó el número de página impreso en la foto).

**UI (Configuración → Formato de Bitácora, `#panel-pagina-config`):** filas editables `{desde, vuelosPorPagina}` — la primera siempre empieza en la página 1 (campo deshabilitado); el "hasta" de cada fila se deriva del `desde` de la siguiente y se recalcula en vivo al escribir sin perder el foco del input (`app._updatePaginaHastaLabels`, actualiza solo el texto, no reconstruye los inputs). "+ Agregar cambio de formato" (`app.addPaginaConfigRow`) agrega un rango nuevo arrancando después de la última página conocida (`flightData` o el último rango). Validación al guardar (`app.saveSettings`): el primer rango debe empezar en 1, los `desde` deben ser crecientes y sin repetir, `vuelosPorPagina` ≥ 1.

Los vuelos ya guardados **no se renumeran retroactivamente** al cambiar la configuración — solo gobierna la asignación de página para vuelos nuevos a partir de ese momento, igual que el resto del pipeline de paginación.

## Estado actual del proyecto
✅ Completamente funcional en producción  
✅ Auth, CRUD vuelos, offline, dashboard, logbook, resúmenes, licencias, pagos, PWA, importador Excel/CSV, impresión  
✅ Landing v2 HUD desplegada  
✅ Escáner IA de bitácora física (funcional, pendiente prueba completa post rate-limit)  
✅ Auditoría de integridad de datos aplicada (jul 2026): cola offline por usuario, sync con upsert idempotente, SW app shell completo (v2.28), renovación Pro extiende vencimiento, guard de trial  
✅ Protecciones anti-pérdida (jul 2026): papelera soft-delete 30 días, auto-backup CSV pre-borrado, confirmación escrita en borrado masivo, guard de discrepancia nube/caché, saldo inicial upsert-primero  
✅ Módulo "En Vuelo" integrado (14-jul-2026) — ver sección propia más abajo  
✅ Formato de bitácora configurable (13-ago-2026): vuelos por página ya no está hardcodeado en 8, configurable por rango de páginas en Configuración — ver sección propia  
⚠️ Cargo automático (Flow Subscriptions) implementado en código (04-ago-2026), pendiente de deploy y de crear los planes en Flow — ver sección propia y punto 14 de "Pendientes"  
⚠️ Área de desarrollo activa: `logbook-scanner.js`, `data-importer.js`, módulo En Vuelo, cargo automático  
❌ Sin linter ni TypeScript. Tests funcionales Playwright en `herramientas-vuelo/tests/` (t5 cubre la integración En Vuelo)

## Módulo "En Vuelo" (integrado 14-jul-2026 desde herramientas-vuelo)

Menú **En Vuelo ▼** en la nav con 4 herramientas. Origen: repo `~/Documents/GitHub/herramientas-vuelo` (los fixes se aplican allá y se copian acá; `cx3.html`/`easyplan.html` son copias de `cx3_flight_computer.html`/`easyplan.html` + guard Pro inyectado en `<head>`).

| Pieza | Archivo | Gating |
|---|---|---|
| Live Log (timer de vuelo) | `live-log.js` → vista `view-live-log` | Free |
| Peso y Balance | `peso-balance.js` + `aeronaves-db.js` → vista `view-peso-balance` | Free: 1 aeronave/día (`_pbDailyUse` en localStorage, `_checkDailyLimit`); Pro: ilimitado |
| Computador CX-3 | `cx3.html` (página aparte, autocontenida) | Pro (guard client-side + nada server que proteger: es matemática local) |
| EasyPlan Meteo | `easyplan.html` (página aparte) | Pro (guard client-side + `wx-proxy` valida JWT; `/gemini` exige plan Pro server-side) |

- **CSS:** `en-vuelo.css` (generado desde `herramientas-vuelo/style.css`, sin reset global; inputs escopados a las vistas). Clases prefijadas `ll-`/`pb-`/`ac-`/`ftb-`.
- **Aeronaves P&B en Supabase (tabla `wb_aircraft`, 14-jul-2026):** `user_id NULL` = catálogo global (6 aeronaves sembradas, editable desde dashboard/service role sin re-deploy); `user_id = uid` = aeronaves creadas por el usuario. RLS: authenticated lee catálogo + propias, escribe solo propias; anon no ve nada. SQL en `supabase/wb-aircraft.sql` + `wb-aircraft-seed.sql` (ya aplicados en producción). El cliente (`pesoBalance._loadCloudAircraft`) mergea catálogo sobre `AERONAVES_DB` y propias sobre `_miFlota` (nube manda; customs locales creadas offline se suben al reconectar).
- **Aeronaves propias:** botón "+ Crear propia" en P&B — formulario con datos del POH: estaciones dinámicas y envolvente como POLÍGONO DE VÉRTICES (peso + posición por punto, ver abajo); el gráfico se deriva solo de esos puntos. Editar (✎) y borrado definitivo. Los chips del Live Log las resuelven vía `pesoBalance._getAcData`.
- **Modos de envolvente (`envelopeMode`):** `'moment'` (POH clásico Cessna — gráfica en momento/1000) o `'cg'` (aviones modernos tipo Cirrus — gráfica en posición CG en pulgadas). El cálculo es idéntico; cambia qué dato pide el formulario (momento vacío vs CG vacío) y la unidad nativa del eje X de la gráfica y de cada vértice de la envolvente (in vs momento/1000).
- **Envolvente CG como polígono de vértices (rediseño 11-ago-2026):** antes la tabla del formulario pedía, por cada fila, un peso + límite delantero + límite trasero (`{weight, fwd_in, aft_in}`) — dos coordenadas por peso, obligando una forma simétrica peso-por-peso. Muchos manuales (especialmente categoría Utilitaria) tienen envolventes con más de dos límites por peso — el gráfico de vértices del POH no es simétrico. Ahora la tabla pide un vértice por fila (`{x, y}`: peso + posición, en el orden en que se recorre el contorno del gráfico del manual) — se pueden agregar tantos vértices como tenga el gráfico real, y el polígono resultante es exactamente ese contorno, no una aproximación interpolada linealmente entre pares peso/fwd/aft. `pesoBalance._polygonFor(env, mode)` normaliza cualquier envolvente guardada al polígono `{x,y}[]`: si ya viene en formato de vértices la usa tal cual; si es una aeronave vieja guardada en el formato legado `{weight, fwd_in, aft_in}` la convierte subiendo por el límite delantero y bajando por el trasero (compatibilidad hacia atrás, sin migración forzada de datos de usuarios). La validación (`_checkLimits`) ya no interpola fwd/aft por peso — usa `_envelopeXRangeAtWeight` (intersección de la recta horizontal al peso actual con el perímetro del polígono) para obtener el rango válido a ese peso, generalizando "límite delantero/trasero" a cualquier forma de polígono; compara contra CG (in, modo `cg`) o momento/1000 (modo `moment`) según corresponda. `_drawChart`/`_updateEnvPreview` dibujan el mismo polígono. El catálogo (`aeronaves-db.js` y `wb_aircraft` en Supabase) ya traía este polígono preciso por separado como `cgEnvelopeGraph{Normal,Utility}` (dibujado a mano desde el gráfico del manual, usado solo para el dibujo) en paralelo a la tabla `cgEnvelope{Normal,Utility}` (usada solo para validar) — esa redundancia se eliminó: `cgEnvelopeGraph*` pasó a ser directamente `cgEnvelope{Normal,Utility}` (más preciso que la tabla que reemplazó, ahora también usado para validar). Migrado en `aeronaves-db.js`; `supabase/migrate-envelope-vertices.sql` migra el catálogo en `wb_aircraft` (producción) — **pendiente de ejecutar**, es idempotente. Preview en vivo desde el primer vértice ingresado (antes exigía 2 puntos para mostrar algo): 1 vértice = punto suelto, 2 = línea abierta, 3+ = contorno cerrado con relleno; para guardar se exige un mínimo de 3 vértices (área real). El orden de las filas ya no se reordena por peso al guardar — es el orden de trazado del polígono.

- **Cómo explicar el orden de los vértices (referencia visual):** el diagrama de ejemplo de ForeFlight (envolvente Normal/Utility de un C172, https://support.foreflight.com/hc/article_attachments/12470596810775) es la referencia útil para explicarle a un usuario cómo cargar su propia tabla de vértices. En esa imagen los puntos están numerados 1-2-3-4-5 pero *no* en orden de trazado del contorno — el orden real del perímetro es 3 (esquina inferior izquierda, límite delantero al peso mínimo) → 2 (quiebre del límite delantero) → 1 (quiebre superior donde el límite delantero se une al techo de peso máximo) → 4 (esquina superior derecha, límite trasero al peso máximo) → 5 (esquina inferior derecha, límite trasero al peso mínimo) → cierre implícito de vuelta a 3 por el piso de peso mínimo. Nuestra tabla exige orden de trazado real, así que el vértice 1 de nuestro formulario es el punto 3 de esa imagen (arranca en la esquina inferior izquierda, límite delantero al peso mínimo) y de ahí en adelante sigue la misma dirección de la imagen: nuestro vértice 2 = su punto 2, nuestro vértice 3 = su punto 1, nuestro vértice 4 = su punto 4, nuestro vértice 5 = su punto 5. Sirve para orientar a un usuario que está mirando el gráfico de su propio POH y no sabe por dónde empezar a cargar filas.
- **Aeronaves públicas (`is_public`, 14-jul-2026):** checkbox "🌐 Compartir con la comunidad" en el formulario (solo visible con `supabaseClient`, requiere matrícula válida). RLS: cualquier autenticado LEE las públicas; solo el dueño edita/borra. En Base de Datos aparece la sección "Comunidad" (`pesoBalance._community`); "＋ Copiar a mi flota" crea una **copia propia privada** con id nuevo (los datos de W&B no deben cambiar bajo el usuario si el dueño edita la suya).
- **Anti-duplicados de matrícula:** índice único `wb_aircraft_public_reg_idx` (case-insensitive) sobre catálogo + públicas — dos aeronaves no pueden compartir matrícula. Chequeo en 3 capas: `_findDuplicateRegistration` (local, catálogo+comunidad ya cargada) al guardar cualquier matrícula; `_checkPublicRegistrationCloud` (round-trip a la nube) solo al marcar pública; y captura de `23505` en `_syncCustomToCloud` como resguardo final ante una carrera entre dos publicaciones simultáneas (revierte a privada localmente y avisa). Mensaje siempre dirige a **info@bitacoradevuelo.cl**.
- **Matrícula validada** en el formulario: `XX-ABC` (prefijo OACI 1-2 letras + guion + 1-5 alfanuméricos) o `N1234AB` (EEUU, sin guion, sin cero inicial) — `_validReg()`. Obligatoria si la aeronave es pública.
- **Marca/modelo normalizada** al guardar (`_normalizeMakeModel`, solo en Peso y Balance): corrige la marca por distancia Levenshtein ≤2 (misma inicial) contra `_BRANDS` + alias (`beech`→Beechcraft) — "cesna/cezna/cessnna" → "Cessna"; tokens con dígitos a mayúsculas (172n→172N, pa-28→PA-28), resto capitalizado. Distinto de `normalizeAircraftModel` (ver abajo): éste expande a nombre de marca completo, aquél preserva el estilo designador corto que usa el resto de la bitácora.
- **Campo Aeronave estandarizado (`normalizeAircraftModel`, `state.js`):** el resto de la app (Live Log, modal de agregar/editar vuelo, importador Excel/CSV, escáner IA) usa este helper global en vez de un simple `.toUpperCase()` — colapsa el espacio entre el prefijo de letras y el número de modelo ("C 172"→"C172") y limpia espacios alrededor de guiones sin insertarlos ni quitarlos ("PA - 28"→"PA-28", "PA28" queda igual). No convierte a nombre de marca completo — asume que el piloto ya escribe en formato designador corto (C150, C182, PA-28).
- **Designador OACI derivado (`aircraftIcaoDesignator`, `state.js`):** convierte el nombre completo marca+modelo del catálogo/flota de Peso y Balance ("Cessna 172M Skyhawk") al designador corto ("C172") — Cessna colapsa la letra de variante, Piper trunca al número de serie (PA-28-181→PA-28), el resto de marcas ya usan el modelo como segundo token (Cirrus SR22T, Diamond DA40) y se toma tal cual. Usado al hacer click en un chip de la flota en Live Log, para no llenar el campo Aeronave con el nombre descriptivo largo del catálogo.
- **Live Log guarda directo**: post-vuelo → `_saveToBitacora()` construye el vuelo desde `_buildRow()` (orden HEADERS) y llama `api.saveFlight()` → hereda cola offline. CSV queda como opción secundaria. Si el piloto marca Diurno+Nocturno, pide desglose de horas (suma = duración).
- **Aterrizajes obligatorios al aterrizar:** al tocar ATERRIZAR se muestra `_renderLandingDialog` — una pantalla dedicada que pide aterrizajes Día/Noche (default inteligente según la condición del vuelo) antes de continuar al formulario post-vuelo completo. No deja avanzar con ambos campos vacíos (puede guardarse 0, pero no por omisión silenciosa). Antes era un campo opcional dentro de `_renderPostFlight` que quedaba en 0 si no se tocaba.
- **Precisión decimal detectada:** `_detectDecimalPrecision()` mira los vuelos ya guardados en `flightData` y decide si la bitácora del usuario usa 1 decimal (1.2) o 2 (1.23), aplicándolo a la duración que calcula el timer de Live Log (antes siempre forzaba 2 decimales) y al desglose Diurno/Nocturno.
- **Pausar/Reanudar (10-ago-2026):** botón `⏸ Pausar` / `▶ Reanudar` en la pantalla de vuelo activo — el vuelo sigue corriendo (no aterriza, no cancela), solo se congela el conteo. `_elapsedMs(state)` es la única fuente de verdad del tiempo transcurrido: resta a `now - startTs` la suma de intervalos en pausa (`pausedMs` acumulado + el intervalo en curso vía `pauseStartTs`) — la usan el timer en vivo, la barra global inferior y el cálculo final al aterrizar (`_handleLand`). La barra inferior (`flight-timer-bar`) se atenúa con la clase `ftb-paused` mientras está en pausa; el `setInterval` de 1s sigue corriendo sin lógica especial porque el cálculo se congela solo.
  - **Bug corregido (11-ago-2026):** aterrizar (`_handleLand`) sin haber reanudado dejaba el intervalo de pausa abierto hasta ese instante — `_elapsedMs` descontaba todo ese tramo, vaciando `dur` (y con él Duración Total, tipo de avión, Diurno/Nocturno, roles: todos derivados de `dur`) aunque el piloto sí voló ese tiempo. Reproducido en producción: vuelo real "Habilitación Nocturna alumno" grabado con `duracion_total`/`diurno`/`pic`/`monomotor` en 0 y `aterrizajes_noche` intacto (por ser un campo manual, no derivado de `dur`). Fix: `_handleLand` cierra la pausa (`paused=false`, `pauseStartTs=null`) **sin sumarla a `pausedMs`** antes de calcular `elapsedMs` — perdona el tramo final en pausa en vez de excluirlo. Los intervalos de pausa ya cerrados (con resume antes de aterrizar) se siguen descontando igual que antes.
- **Log de Despegue/Aterrizaje + duración editable (11-ago-2026):** segundo caso de duración en 0 sin pausa de por medio (vuelo real CC-PGF, 08-ago) — causa probable: pantalla bloqueada / cambio de app mientras el timer corría, patrón conocido en PWAs iOS donde reabrir por el ícono de inicio a veces cae en otra partición de `localStorage` y se pierde la continuidad. En vez de perseguir esa causa puntual, `_renderPostFlight` ahora expone tres respaldos manuales: campos "Despegue"/"Aterrizaje" (`type="time"`, editables — al cambiarlos, `_recomputeFromTimes` recalcula la duración desde la diferencia y descarta cualquier `manualDuration` previo) y "Duración (h)" editable directamente (`state.manualDuration`, con precedencia sobre el cálculo del timer en `_buildRow`). `_saveToBitacora` además bloquea con `confirm()` si la duración final da 0, explicando la causa probable, en vez de guardar en silencio. `en-vuelo.css` necesitó agregar `input[type="time"]` al selector de estilos (antes solo cubría text/number/date).
- **Respaldo en la nube del vuelo activo (`live_log_sessions`, 11-ago-2026):** hasta ahora el vuelo en curso vivía solo en `localStorage._liveLog` — si la app se cerraba por un error a mitad de vuelo (el mismo escenario de arriba: iOS mata el proceso, o cambio de dispositivo) no había forma de recuperarlo. Tabla nueva `public.live_log_sessions` (`user_id` PK, `state` jsonb, `updated_at`; RLS por `auth.uid()`, SQL en `supabase/live-log-sessions.sql`, ya aplicada en producción) — una fila por usuario con el mismo shape que `localStorage._liveLog`. `liveLog._saveState`/`_clearState` quedaron envueltos: cada guardado local dispara un upsert a la nube (debounced 800ms vía `_syncStateToCloud`, best-effort — si falla solo hace `console.warn`, nunca bloquea el flujo local ni offline) y `_clearState` borra la fila (al guardar el vuelo en la bitácora o cancelarlo). `liveLog.init()` es ahora `async`: si no hay vuelo activo en este dispositivo, `_recoverFromCloud()` consulta la fila del usuario y, si existe, la restaura en `localStorage` + notifica "Se recuperó un vuelo que había quedado sin guardar" — nunca pisa un vuelo local real si uno ya se inició mientras esperaba la respuesta. `flights` sigue siendo la única fuente de verdad del vuelo ya guardado; esto es solo un respaldo temporal del vuelo a medias.
- **Elementos globales:** `#live-badge` (header) y `#flight-timer-bar` (fija abajo, click → `view-live-log`, wiring en `app.init`). `liveLog.init()` y `pesoBalance.init()` corren en `app.init` (restauran vuelo activo tras recarga).
- **Guard de páginas Pro:** lee `sb-...-auth-token`, consulta `profiles.plan` vía REST; sin token → `index.html?auth=1`; sin Pro → `index.html?upgrade=envuelo` (app.js muestra upgrade screen). Fail-open si la REST falla (offline) — lo caro se protege server-side.
- **wx-proxy asegurado:** JWT obligatorio en todas las rutas; `/gemini` además exige plan Pro vigente, modelo pinneado, body ≤100KB, maxOutputTokens ≤1024. EasyPlan envía `Authorization` en todos sus fetch (`_authHeaders()`).
- **EasyPlan — fichas de estación cercana con coordenadas incrementales (11-ago-2026):** el markup de las fichas "Usar datos de estación cercana" (para aeródromos sin METAR) se separó de `_renderNoMetarMsg` a `_nearbyChipsHtml`, para poder reconstruirlas después. Al generar el plan, las coordenadas OurAirports de *todo* el set de aeródromos con METAR bajan en background tras el render inicial; a medida que llegan, `_refreshNearbyChips` reconstruye (no solo reordena) las fichas de los aeródromos sin dato con las estaciones realmente más cercanas. Reemplaza a `_updateChipDistances`, que solo recalculaba distancias sobre chips ya pintados con el set parcial de coordenadas que hubiera en caché en ese momento.
- **SW v2.33**: app shell incluye `en-vuelo.css`, `aeronaves-db.js`, `live-log.js`, `peso-balance.js`, `cx3.html`, `easyplan.html`.
- Manual: capítulo "En Vuelo" (`#envuelo`). Landing: herramientas agregadas a las 4 tarjetas de pricing.

**⚠️ Deploy pendiente (orden importa):**
1. Subir archivos nuevos de Bitácora al hosting (index/ui/app/sw + en-vuelo.css, live-log.js, peso-balance.js, aeronaves-db.js, cx3.html, easyplan.html, manual, landing).
2. Recién después: `supabase functions deploy wx-proxy` — al desplegarlo, el EasyPlan standalone viejo (sin JWT) deja de funcionar; el de Bitácora ya manda token.

## Pendientes de la auditoría (jul 2026) — analizar y resolver en próxima sesión

Detectados en la revisión de integridad pero NO modificados (requieren decisión o pruebas):

1. ✅ RESUELTO EN CÓDIGO (14-jul-2026): `wx-proxy` ahora exige JWT de Supabase en todas las rutas y plan Pro en `/gemini` (modelo pinneado, body ≤100KB, tokens acotados). **Falta deploy** — ver orden de deploy en la sección "Módulo En Vuelo" (romper el standalone viejo es intencional: EasyPlan migró a Bitácora como feature Pro).
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
14. **Cargo automático: ciclo mensual completo validado en sandbox (05-ago-2026)** — registro de tarjeta, cobro síncrono, otorgamiento de Pro y cancelación confirmados funcionando. Pendiente: probar plan anual con trial de 14 días, renovaciones mensuales futuras (webhook sin verificar), sacar debug temporal (`_debug_log`), y todo el ciclo de deploy a producción (planes/cupones/credenciales/`urlCallback` de Flow real). Ver sección "Cargo automático (Flow Subscriptions, ago-2026)".

## Archivos de mayor complejidad
- `data-importer.js` (35KB) — parseo de fechas Excel, validación de esquema
- `api.js` (28KB) — offline queue, CRUD completo
- `app.js` (45KB) — inicialización y event listeners de toda la app
- `logbook-scanner.js` (~600 líneas) — escáner IA multi-foto, revisión editable, consolidación, retry
- `index.html` (~800 líneas) — shell + carga de scripts
- `supabase/functions/gemini-ocr/index.ts` — proxy JWT para Gemini, CORS multi-origen

## No hay build step
Sin `package.json`. Los archivos se despliegan tal cual. Para desplegar: subir archivos al hosting (Supabase static / Cloudflare Pages). Edge functions: `supabase functions deploy <nombre>`.
