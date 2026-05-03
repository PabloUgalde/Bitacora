# AI-MAP — Bitácora de Vuelo

## 1. Nombre y Objetivo
PWA de bitácora aeronáutica para pilotos chilenos. Permite registrar horas de vuelo, gestionar licencias DGAC (DAR 61 / DAN 61), consultar resúmenes por aeronave/aeródromo/periodo, generar reportes PDF y funcionar offline. Tiene modelo freemium (plan Free / Pro vía Flow.cl).

**URL producción:** `https://bitacoradevuelo.cl`

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Vanilla JS (ES6+), HTML5, CSS3 — sin framework, sin bundler |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Edge Functions | Deno (TypeScript) desplegadas en Supabase |
| Pagos | Flow.cl (HMAC-SHA256 para firma de requests) |
| Email transaccional | Resend |
| Gráficos | Chart.js (CDN) |
| Import/Export Excel | SheetJS / XLSX (CDN) |
| PWA | Service Worker (`sw.js`), Web App Manifest |

---

## 3. Arquitectura y Flujo de Datos

```
landing.html  ──→  index.html (guard en línea)
                       │
               <script> en orden:
               state.js → auth.js → api.js → licenses-system.js
               → plan.js → ui.js → ui-render.js → summary-renderer.js
               → report-generator.js → add-flight-modal.js → saldo-inicial.js
               → data-importer.js → onboarding.js → profile-validator.js
               → anotaciones.js → mi-cuenta.js → backup-manager.js
               → time-utils.js → logbook-scanner.js → app.js  (último, inicializa todo)
```

**Flujo auth:** `index.html` → verifica `localStorage` (token Supabase) → si no hay sesión, redirige a `landing.html`. `auth.js` maneja login, logout y recovery links.

**Flujo de datos:** `api.js` hace fetch a Supabase REST. Vuelos offline se encolan en `localStorage` (`_pendingQueue`) y se sincronizan al reconectar.

**Flujo de pago (Pro):**
1. Frontend llama Edge Function `create-checkout` → crea orden en Flow.cl
2. Usuario paga en Flow → Flow llama `flow-webhook` → actualiza `plan='pro'` en Supabase
3. Usuario retorna a la app via `flow-return` → app recarga perfil y aplica features Pro

---

## 4. Mapa de Módulos Clave

| Archivo | Responsabilidad |
|---|---|
| `state.js` | Estado global (`flightData[]`, `userProfile`, `logbookState`). Constantes `HEADERS`, `SUMMARIZABLE_HEADERS`, `HEADER_STRUCTURE` |
| `auth.js` | Supabase Auth: login, logout, recovery, sesión. Variables globales `supabaseClient`, `currentUser` |
| `api.js` | CRUD vuelos en Supabase. Conversión objeto↔row. Cola offline (`_getPendingQueue`). Carga perfil de usuario |
| `app.js` | Entry point: inicializa módulos, event listeners globales, lógica de checkout result, registra Service Worker |
| `ui.js` | Router de vistas (`showView`), notificaciones, hamburger menu, modales genéricos |
| `ui-render.js` | Renderiza tabla del logbook con paginación, filtros y columnas ocultables |
| `summary-renderer.js` | Renderiza vistas de resumen (por tiempo, tipo, aeronave, aeródromo, IFR, página) |
| `report-generator.js` | Genera reporte imprimible / PDF |
| `add-flight-modal.js` | Modal de alta/edición de vuelos. Valida y llama `api.addFlight` / `api.updateFlight` |
| `licenses-system.js` | Catálogo DGAC: licencias, categorías, clases, funciones, habilitaciones especiales, médico |
| `plan.js` | Gate de features Pro. `plan.isPro()`, `plan.PRO_FEATURES[]`, `plan.apply()` |
| `data-importer.js` | Importa Excel/CSV → `flightData` vía SheetJS |
| `logbook-scanner.js` | **Escáner IA:** multi-foto, Gemini Vision, tabla editable, consolidación por página |
| `saldo-inicial.js` | Entrada de saldo inicial de horas (primer registro especial) |
| `onboarding.js` | Flujo de bienvenida para usuarios nuevos sin licencias ni vuelos |
| `anotaciones.js` | Sistema de notas/anotaciones libres por vuelo |
| `backup-manager.js` | Exporta/importa backup JSON del logbook |
| `time-utils.js` | Helpers de fecha/hora (parseo, formateo, UTC) |
| `mi-cuenta.js` | Gestión de cuenta: cambio contraseña, delete account |
| `profile-validator.js` | Valida campos del perfil antes de guardar |

**Edge Functions (`supabase/functions/`):**
- `create-checkout` — crea orden de pago en Flow.cl
- `flow-webhook` — recibe confirmación de Flow, actualiza DB
- `flow-return` — redirige al usuario de vuelta a la app tras el pago
- `delete-account` — elimina cuenta de usuario (requiere service role key)

---

## 5. Modelo de Datos — Vuelo

Columnas canónicas (en `HEADERS`):
```
id | Fecha | Aeronave Marca y Modelo | Matricula Aeronave | Desde | Hasta |
Duracion Total de Vuelo | LSA | Monomotor | Multimotor | Turbo Helice |
Turbo Jet | Helicoptero | Planeador | Ultraliviano | Aterrizajes Dia |
Aterrizajes Noche | Diurno | Nocturno | IFR | NO | Tipo | Simulador o
Entrenador de Vuelo | Travesia | Solo | Piloto al Mando (PIC) |
Copiloto (SIC) | Instruccion Recibida | Como Instructor | Observaciones |
Pagina Bitacora a Replicar
```
El campo `es_saldo_inicial: true` marca el registro de saldo inicial (siempre último en el sort).

**Sort canónico:** fecha desc → página desc → saldo al final.

---

## 6. Convenciones de Código

- **Sin framework, sin TypeScript, sin bundler.** JS vanilla cargado con `<script>` en orden.
- **Pattern módulo objeto literal:** `const api = { método() {} }`. Estado global en variables `let` en `state.js`.
- **Nomenclatura en español** para variables de dominio (vuelo, aeronave, licencia). Inglés para infraestructura (auth, fetch, render).
- **CSS:** `style.css` (base) → `custom-styles.css` (overrides) → `mobile.css` (responsive) → `print.css` (media print).
- **Offline-first:** operaciones de escritura encolan en `localStorage` si no hay conexión.
- Supabase keys expuestas en `auth.js` son **publishable/anon** (RLS protege la DB).

---

## 7. Integraciones IA

### Escáner de bitácora física (`logbook-scanner.js`)

**Proveedor:** Google Gemini via Edge Function proxy (sin SDK — `fetch` directo al proxy)  
**Modelo actual:** `gemini-3.1-flash-lite-preview` (multimodal, soporta imágenes)  
**Nota modelos:** usar solo modelos Gemini con visión — Gemma es texto puro y rechaza imágenes.  
**API key:** secreto `GEMINI_API_KEY` en Supabase. Cliente envía JWT de Supabase a `gemini-ocr`; la key nunca llega al browser.  

**Edge Function `gemini-ocr`:**
- Valida JWT de Supabase antes de proxear
- CORS: permite `https://bitacoradevuelo.cl`, `localhost:8080`, `localhost:3000`
- Retorna error 400 con mensaje legible si el modelo falla
- Sin AbortController propio — Supabase aplica su timeout natural (~150s free tier)

**Parámetros del modelo:**
```json
{
  "generationConfig": {
    "temperature": 0.1,
    "response_mime_type": "application/json"
  }
}
```
`thinkingConfig` eliminado — no soportado por modelos lite ni Gemma.  
`temperature: 0.1` en vez de 0 para permitir variación al re-escanear.

**Flujo:**
```
Upload N fotos
  → _compress(): reduce a max 2400px / JPEG 88% si >3.5MB
  → rotación canvas-baked si page.rotation != 0
  → fetch con AbortController 90s (client-side) → Edge Function gemini-ocr (JWT) → modelo
  → si rate limit "retry in Xs": countdown visible + reintento automático
  → JSON array 30 campos por vuelo (regex extrae JSON aunque venga en markdown)
  → revisión/edición por foto (◀ ▶) con lupa zoom ×5
  → consolidar → ordenar por Pagina Bitacora a Replicar
  → descargar Excel  ó  api.saveFlightsBatch()
```

**Estado interno:** `_pages[]` — `{ id, file, photoURL, _displayURL, rotation, mime, flights, processed, _error }`.  
`_displayURL`: URL canvas-rotada cacheada, usada por thumbnail Y lupa (no CSS transform).  
`_mode: 'page' | 'all'`.

**Métodos clave:**
- `_scanPage(page, i)` — procesa una página con retry automático en rate limit
- `_retryPage(pageId)` — reintento manual desde thumbnail (aparece en errores Y en páginas ya procesadas)
- `rescanCurrent()` — re-escanea la página actualmente visible desde barra de navegación
- `_applyRotation(page)` — computa `_displayURL`, actualiza thumbnail src + foto principal
- `_compress(b64, mime)` — compresión/resize preventivo antes de enviar
- `_tfootHtml()` — genera `<tfoot>` sticky con totales integrados en la tabla

**Prompt — secciones clave:**
- **Independencia de filas:** cada fila se lee de forma completamente independiente, sin inferir ni copiar valores de otras filas (CC-KUH y CC-KUG pueden coexistir en la misma página)
- **Detección de formato de tiempo:** las bitácoras chilenas usan DOS formatos:
  - Decimal H.h: columna dividida en horas | décimas (1|5=1.5, 0|6=0.6, 0|75=0.75)
  - HH:MM: convertir a decimal (1:30→1.5, 0:45→0.75)
  - Detección: verificar con TOTAL PAGINA si existe; si parte derecha >59 → es decimal
- **Campos de conteo entero** (NO convertir): Aterrizajes Dia, Aterrizajes Noche, NO
- **Campos de tiempo** (convertir o leer decimal): todos los demás numéricos
- Fechas → YYYY-MM-DD
- Matrículas CC-XXX/CC-XXXX, leer cada letra individualmente

**UX — botón Re-escanear:**
- Thumbnail lateral: botón `↺` junto al estado de cada página (visible siempre, no solo en errores)
- Barra de navegación: botón `↺ Re-escanear` actúa sobre la página actualmente visible
- Ambos reutilizan `_scanPage()` incluyendo manejo de rate limit

**Validaciones activas:**
- Tipo avión suma ≠ duración total
- Diurno + Nocturno ≠ duración total
- Sin fecha / duración cero
- ~~Roles (PIC+SIC+Solo) ≠ duración~~ — eliminada, roles son concurrentes

**Número de página:** modelo lee el número impreso. Fallback: continúa desde el máximo de `flightData`.

**Timeout client-side:** AbortController de 90s — si el modelo no responde, cancela el fetch con mensaje legible en lugar de quedar colgado indefinidamente.

**Pendiente:**
- Gating Pro — actualmente disponible para todos los usuarios
- Considerar upgrade a tier pago de Gemini para superar límite free tier
- Modo multi-imagen en un solo request (Gemini soporta N `inline_data` en `contents[]`)
- Fix scroll del modal en vista consolidada (botones de pie quedan fuera del viewport en pantallas pequeñas)

---

## 8. Estado Actual del Desarrollo

- ✅ App funcional y en producción (`bitacoradevuelo.cl`)
- ✅ Auth, CRUD de vuelos, resúmenes, importación Excel, PDF y pagos Pro operativos
- ✅ PWA instalable con soporte offline básico
- ✅ Escáner IA: proxy seguro, rotación correcta, retry automático, totales integrados
- ⚠️ Escáner pendiente prueba completa (rate limit free tier agotado en desarrollo)

---

## 9. Próximos Pasos / Pendientes

- [ ] Upgrade Gemini API a tier pago (o migrar a Claude API) para superar límite 20 req/día
- [ ] Gating del escáner IA (¿Free o Pro?)
- [ ] Refinar prompt con más ejemplos de bitácoras DGAC reales
- [ ] Revisar UX del onboarding para nuevos usuarios
- [ ] Tests de regresión en flujo de pago Flow.cl
- [ ] Optimizar `ui-render.js` para logbooks con >500 vuelos
