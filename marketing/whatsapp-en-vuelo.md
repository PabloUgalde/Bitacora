# Difusión WhatsApp — Módulo "En Vuelo"

Textos listos para copiar/pegar. WhatsApp usa `*negrita*` y `_cursiva_`.

---

## 1. Mensaje completo (grupos de pilotos / clubes / lista de difusión)

✈️ *Novedad en Bitácora de Vuelo* ✈️

Lanzamos *En Vuelo*: 4 herramientas de piloto integradas a tu bitácora digital 👇

⏱ *Live Log* — inicia el cronómetro al despegar y al aterrizar el vuelo se guarda solo en tu bitácora, con la duración exacta. Funciona sin señal. _Gratis para todos._

⚖ *Peso y Balance* — CG, envolvente gráfica y combustible máximo cargable. Cessna 150/172/182 incluidos. _Gratis (1 aeronave/día)._

🔢 *Computador CX-3* — viento, TAS, altitud de densidad, TSD, combustible, holding… ideal para exámenes DGAC. 100% offline.

🌦 *EasyPlan Meteo* — briefing de ruta con METAR/TAF/GAMET, terreno y análisis con IA.

👉 Pruébalo en https://bitacoradevuelo.cl
Plan Pro con *14 días gratis, sin tarjeta*.

---

## 2. Mensaje corto (estados de WhatsApp / reenvío rápido)

✈️ *Bitácora de Vuelo* ahora te acompaña EN el vuelo:
⏱ cronómetro que registra tu vuelo solo
⚖ peso y balance
🔢 computador CX-3
🌦 briefing meteo con IA

Gratis para partir → https://bitacoradevuelo.cl

---

## 3. Mensaje 1-a-1 (contacto directo / instructores)

Hola! Te cuento que en Bitácora de Vuelo lanzamos el módulo *En Vuelo*: el Live Log cronometra tu vuelo y lo guarda directo en la bitácora (funciona sin señal en aeródromos rurales), y sumamos peso y balance, un computador CX-3 y briefing meteo con IA. Live Log y P&B son gratis — dale una mirada: https://bitacoradevuelo.cl 🛩

---

## Notas de uso

- Para volumen (listas grandes o WhatsApp Business API) conviene armar una
  *lista de difusión* en WhatsApp Business normal — con pocos usuarios no se
  justifica WABA con templates aprobados.
- El correo equivalente se envía con la Edge Function `send-announcement`
  (ver `supabase/functions/send-announcement/index.ts`, incluye preview,
  dry-run y modo prueba).
- Imagen sugerida para acompañar: captura del Live Log en vuelo (barra verde
  + cronómetro) o del gráfico de envolvente CG.
