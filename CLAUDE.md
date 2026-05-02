# Bitácora de Vuelo — CLAUDE.md

App PWA de bitácora de vuelo para pilotos chilenos. Producción: **https://bitacoradevuelo.cl**

## Stack
- **Frontend:** Vanilla JS / HTML5 / CSS3 — sin framework, sin bundler
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions en Deno/TS)
- **Pagos:** Flow.cl (HMAC-SHA256)
- **Email:** Resend (`noreply@bitacoradevuelo.cl`)
- **Librería gráficos:** Chart.js (CDN)
- **Excel/CSV:** SheetJS (CDN)
- **PWA:** Service Worker `sw.js` (cache v2.27), `manifest.json`

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
| `supabase/functions/` | Edge Functions: `create-checkout`, `flow-webhook`, `flow-return`, `delete-account` |

**Orden de carga de scripts (crítico):**
`state.js → auth.js → api.js → licenses-system.js → plan.js → ui.js → ui-render.js → summary-renderer.js → report-generator.js → add-flight-modal.js → saldo-inicial.js → data-importer.js → onboarding.js → profile-validator.js → anotaciones.js → mi-cuenta.js → backup-manager.js → time-utils.js → app.js`

## Base de datos (Supabase)

**Tablas principales:**
- `profiles` — metadata usuario: `full_name`, `plan`, `plan_expires_at`, `trial_used`, `licenses` (JSONB)
- `flights` — logbook (31 columnas): `fecha`, `aeronave_marca_modelo`, `matricula`, `duracion_total`, tipos de aeronave (LSA/Monomotor/etc.), aterrizajes (día/noche), condiciones (IFR/Diurno/Nocturno), tipos de tiempo (Solo/PIC/SIC/Instrucción), `observaciones`, `pagina_bitacora`, `es_saldo_inicial`
- `anotaciones` — notas libres por vuelo

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

## Estado actual del proyecto
✅ Completamente funcional en producción  
✅ Auth, CRUD vuelos, offline, dashboard, logbook, resúmenes, licencias, pagos, PWA, importador Excel/CSV, impresión  
✅ Landing v2 HUD desplegada  
⚠️ Área de desarrollo activa: `data-importer.js`, validaciones de ingreso (`app.js`)  
❌ Sin tests, sin linter, sin TypeScript

## Archivos de mayor complejidad
- `data-importer.js` (35KB) — parseo de fechas Excel, validación de esquema
- `api.js` (28KB) — offline queue, CRUD completo
- `app.js` (45KB) — inicialización y event listeners de toda la app
- `index.html` (772 líneas) — shell + carga de scripts

## No hay build step
Sin `package.json`. Los archivos se despliegan tal cual. Para desplegar: subir archivos al hosting (Supabase static / Cloudflare Pages). Edge functions: `supabase functions deploy <nombre>`.
