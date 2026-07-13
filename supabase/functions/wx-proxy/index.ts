import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const AW_BASE      = 'https://aviationweather.gov/api/data'
const MC_BASE      = 'https://www.meteochile.gob.cl/PortalDMC-web/metaer/home/resultado_busqueda.xhtml'
const OA_BASE      = 'https://ourairports.com/airports'
const REDEMET_BASE = 'https://api-redemet.decea.mil.br'
const BROWSER_UA   = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

const AW_ALLOWED = new Set(['metar', 'taf', 'pirep', 'sigmet', 'airsigmet'])

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  })
}

// Extrae los mensajes del XML embebido en el HTML de MeteoChile
function parseMcXml(html: string): string[] {
  const m = html.match(/xml\s*=\s*'(<mensajes>[\s\S]*?<\/mensajes>)'\s*;/)
  if (!m) return []
  const msgs = [...m[1].matchAll(/<mensaje>([\s\S]*?)<\/mensaje>/g)]
  return msgs.map(x => x[1].trim()).filter(Boolean)
}

// Extrae METAR y TAF del HTML de OurAirports (/airports/{ICAO}/weather.html)
// Estructura: <p class="report">METAR …</p>  y  <p class="report">TAF …</p>
function parseOaWeather(html: string): { metar: string; taf: string } {
  const reports = [...html.matchAll(/<p class="report">([\s\S]*?)<\/p>/g)]
    .map(m => m[1].replace(/\s+/g, ' ').trim())
  const metar = reports.find(r => !r.startsWith('TAF')) || ''
  const taf   = reports.find(r => r.startsWith('TAF')) || ''
  return { metar, taf }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url  = new URL(req.url)
  const path = url.pathname.replace(/^\/wx-proxy\/?/, '')
  const [endpoint, ...rest] = path.split('/')

  // ── MeteoChile proxy ──────────────────────────────────────────────
  // /wx-proxy/mc/metar?ids=SCPD&limite=6
  // /wx-proxy/mc/taf?ids=SCEL&limite=3
  if (endpoint === 'mc') {
    const tipo_map: Record<string, string> = { metar: 'SA', taf: 'FT' }
    const sub    = rest[0] || 'metar'
    const tipo   = tipo_map[sub]
    if (!tipo) return json({ error: 'tipo no soportado (metar|taf)' }, 400)

    const ids    = url.searchParams.get('ids') || ''
    const limite = url.searchParams.get('limite') || '6'
    if (!ids) return json({ error: 'parámetro ids requerido' }, 400)

    try {
      const mcUrl = `${MC_BASE}?estacion=${encodeURIComponent(ids)}&tipo=${tipo}&deco=no&limite=${limite}`
      const res   = await fetch(mcUrl, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return json({ error: `MeteoChile ${res.status}` }, 502)

      const html = await res.text()
      const msgs = parseMcXml(html)

      // Extraer el raw METAR/TAF (después de "METAR " o "TAF ")
      const keyword = sub === 'taf' ? 'TAF ' : 'METAR '
      const raws = msgs.map(msg => {
        const idx = msg.indexOf(keyword)
        return idx >= 0 ? msg.slice(idx + keyword.length).replace(/=$/, '').trim() : msg.trim()
      }).filter(Boolean)

      return json({ source: 'MeteoChile', station: ids, tipo: sub, items: raws })
    } catch (e) {
      return json({ error: String(e) }, 502)
    }
  }

  // ── REDEMET Brasil — GAMET, METAR, TAF ───────────────────────────
  // /wx-proxy/gamet-br                    → GAMETs de los 4 FIRs brasileños
  // /wx-proxy/redemet/metar?ids=SBGR      → METAR de un aeródromo
  // /wx-proxy/redemet/taf?ids=SBGR        → TAF de un aeródromo
  if (endpoint === 'gamet-br' || endpoint === 'redemet') {
    const rdKey = Deno.env.get('REDEMET_KEY') || ''
    if (!rdKey) return json({ error: 'REDEMET_KEY no configurada' }, 503)

    if (endpoint === 'gamet-br') {
      try {
        const res = await fetch(`${REDEMET_BASE}/mensagens/gamet?api_key=${rdKey}`, {
          signal: AbortSignal.timeout(20000),
        })
        if (!res.ok) return json({ error: `REDEMET ${res.status}` }, 502)
        const j = await res.json()
        const items: Array<{ id_fir: string; validade_inicial: string; validade_final: string; mens: string }> =
          j?.data?.data || []
        const result: Record<string, { text: string; validFrom: string; validTo: string }> = {}
        for (const it of items) {
          if (it.id_fir && it.mens) {
            result[it.id_fir] = { text: it.mens, validFrom: it.validade_inicial, validTo: it.validade_final }
          }
        }
        return json(result)
      } catch (e) {
        return json({ error: String(e) }, 502)
      }
    }

    // /wx-proxy/redemet/metar?ids=SBGR  o  /wx-proxy/redemet/taf?ids=SBGR
    const sub  = rest[0] // 'metar' | 'taf'
    const ids  = url.searchParams.get('ids') || ''
    if (!ids || !['metar', 'taf'].includes(sub)) {
      return json({ error: 'uso: /redemet/{metar|taf}?ids=ICAO' }, 400)
    }
    const icao = ids.trim().toUpperCase()
    try {
      const res = await fetch(`${REDEMET_BASE}/mensagens/${sub}/${icao}?api_key=${rdKey}`, {
        signal: AbortSignal.timeout(14000),
      })
      if (!res.ok) return json({ error: `REDEMET ${res.status}` }, 502)
      const j = await res.json()
      const mens: string = j?.data?.data?.[0]?.mens || ''
      return json({ source: 'REDEMET', station: icao, mens })
    } catch (e) {
      return json({ error: String(e) }, 502)
    }
  }

  // ── INUMET Uruguay — solo cabecera para obtener Last-Modified ─────
  // /wx-proxy/gamet-uy-age → { lastModified, url }
  if (endpoint === 'gamet-uy-age') {
    const INUMET_PDF = 'https://www.inumet.gub.uy/reportes/aeronautica/gamet.pdf'
    try {
      const res = await fetch(INUMET_PDF, {
        method: 'HEAD',
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(10000),
      })
      const lastModified = res.headers.get('last-modified') || null
      return json({ lastModified, url: INUMET_PDF })
    } catch (e) {
      return json({ error: String(e) }, 502)
    }
  }

  // ── OurAirports proxy ────────────────────────────────────────────
  // /wx-proxy/oa?ids=SBPP  → { metar, taf } scrapeados de weather.html
  if (endpoint === 'oa') {
    const ids = url.searchParams.get('ids') || ''
    if (!ids) return json({ error: 'parámetro ids requerido' }, 400)
    const icao = ids.trim().toUpperCase()
    try {
      const res = await fetch(`${OA_BASE}/${icao}/weather.html`, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return json({ error: `OurAirports ${res.status}` }, 502)
      const html = await res.text()
      const { metar, taf } = parseOaWeather(html)
      return json({ source: 'OurAirports', station: icao, metar, taf })
    } catch (e) {
      return json({ error: String(e) }, 502)
    }
  }

  // ── AVWX proxy (cobertura mundial) ──────────────────────────────
  // /wx-proxy/avwx/metar?ids=SCEL
  // /wx-proxy/avwx/taf?ids=SCEL
  // /wx-proxy/avwx/metar?ids=SCEL&count=4   (histórico)
  if (endpoint === 'avwx') {
    const avwxKey = Deno.env.get('AVWX_KEY') || ''
    if (!avwxKey) return json({ error: 'AVWX_KEY no configurada' }, 503)

    const sub  = rest[0] // 'metar' | 'taf'
    const ids  = url.searchParams.get('ids') || ''
    if (!ids || !['metar', 'taf'].includes(sub)) {
      return json({ error: 'uso: /avwx/{metar|taf}?ids=ICAO' }, 400)
    }
    const icao   = ids.trim().toUpperCase()
    const count  = url.searchParams.get('count') || ''
    const params = new URLSearchParams({ token: avwxKey })
    if (count) params.set('count', count)

    try {
      const res = await fetch(`https://avwx.rest/api/${sub}/${icao}?${params}`, {
        headers: { Authorization: `BEARER ${avwxKey}` },
        signal: AbortSignal.timeout(14000),
      })
      if (!res.ok) return json({ error: `AVWX ${res.status}` }, res.status >= 500 ? 502 : res.status)
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      })
    } catch (e) {
      return json({ error: String(e) }, 502)
    }
  }

  // ── Gemini proxy (IA de ruta) ─────────────────────────────────────
  // POST /wx-proxy/gemini  body: { contents, generationConfig, model? }
  if (endpoint === 'gemini') {
    if (req.method !== 'POST') return json({ error: 'POST requerido' }, 405)
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY no configurada' }, 503)

    try {
      const body  = await req.json()
      const model = body.model || 'gemini-3.1-flash-lite-preview'
      const res   = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig }),
          signal: AbortSignal.timeout(60000),
        }
      )
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      return json({ error: String(e) }, 502)
    }
  }

  // ── OpenTopoData SRTM proxy (elevación de terreno) ─────────────
  // /wx-proxy/topo?locations=lat,lon|lat,lon|...
  // Rutea a través del proxy para evitar restricciones CORS del browser.
  if (endpoint === 'topo') {
    const locations = url.searchParams.get('locations') || ''
    if (!locations) return json({ error: 'parámetro locations requerido' }, 400)
    for (const dataset of ['srtm90m', 'aster30m']) {
      try {
        const res = await fetch(
          `https://api.opentopodata.org/v1/${dataset}?locations=${encodeURIComponent(locations)}`,
          { signal: AbortSignal.timeout(12000) }
        )
        if (res.status === 429) continue
        if (!res.ok) continue
        return new Response(await res.text(), {
          headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
        })
      } catch { continue }
    }
    return json({ error: 'OpenTopoData no disponible' }, 502)
  }

  // ── NOAA / aviationweather.gov proxy ─────────────────────────────
  // /wx-proxy/metar?ids=SCEL&hours=6
  // /wx-proxy/taf?ids=SCEL&hours=24
  if (!AW_ALLOWED.has(endpoint)) {
    return json({ error: 'endpoint no permitido' }, 400)
  }

  const params = new URLSearchParams(url.search)
  params.set('format', 'json')
  const target = `${AW_BASE}/${endpoint}?${params}`

  try {
    const res  = await fetch(target, {
      headers: { 'User-Agent': 'EasyPlan/1.0 wx-proxy' },
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.text()
    return new Response(body, {
      status: res.status,
      headers: {
        ...CORS,
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (e) {
    return json({ error: String(e) }, 502)
  }
})
