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
               → time-utils.js → app.js  (último, inicializa todo)
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

## 7. Estado Actual del Desarrollo

- App funcional y en producción (`bitacoradevuelo.cl`)
- Auth, CRUD de vuelos, resúmenes, importación Excel, PDF y pagos Pro operativos
- PWA instalable con soporte offline básico

---

## 8. Próximos Pasos / Pendientes

_(Actualizar según sprint actual)_

- [ ] Mejoras en importador de vuelos (en curso — commits recientes)
- [ ] Rayos / validaciones para ingreso de vuelos (reciente)
- [ ] Revisar UX del onboarding para nuevos usuarios
- [ ] Tests de regresión en flujo de pago Flow.cl
- [ ] Optimizar `ui-render.js` para logbooks con >500 vuelos
