// send-announcement — envía el correo de anuncio "En Vuelo" a los usuarios vía Resend.
//
// Protegida por secreto (Supabase secret ANNOUNCE_SECRET — configurar antes de usar):
//   supabase secrets set ANNOUNCE_SECRET=<algo-largo-y-aleatorio>
//   supabase functions deploy send-announcement
//
// Uso (reemplaza $SECRET):
//   Preview en browser:  https://<proj>.supabase.co/functions/v1/send-announcement?preview=1&secret=$SECRET
//   Dry-run (no envía):  curl -X POST .../send-announcement -H "x-announce-secret: $SECRET" -d '{"mode":"dry-run"}'
//   Prueba (solo a ti):  curl -X POST .../send-announcement -H "x-announce-secret: $SECRET" -d '{"mode":"test","testEmail":"pablougalde@gmail.com"}'
//   Envío real:          curl -X POST .../send-announcement -H "x-announce-secret: $SECRET" -d '{"mode":"send"}'
//
// Envío individual (no batch) para personalizar el saludo con el nombre del
// perfil, con pausa de 600 ms entre correos (límite Resend: 2 req/s).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!
const ANNOUNCE_SECRET = Deno.env.get('ANNOUNCE_SECRET') || ''
const SITE_URL        = 'https://bitacoradevuelo.cl'
const FROM_EMAIL      = 'Bitácora de Vuelo <noreply@bitacoradevuelo.cl>'

const SUBJECT = '✈️ Nuevo en Bitácora: módulo En Vuelo — Live Log, Peso y Balance, CX-3 y EasyPlan'

function emailHtml(name: string): string {
  const gold = '#D4AF37', bg = '#121212', surface = '#1E1E1E', border = '#383838',
        text = '#E0E0E0', muted = '#9E9E9E'
  const feature = (icon: string, title: string, desc: string, pro = false) => `
    <tr><td style="padding:0 0 14px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${surface};border:1px solid ${border};border-radius:10px;">
        <tr>
          <td style="padding:16px 18px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
            <div style="font-size:16px;font-weight:700;color:#FFFFFF;">
              ${icon}&nbsp; ${title}
              ${pro ? `<span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#000;background:${gold};border-radius:8px;padding:2px 8px;vertical-align:middle;">PRO</span>` : ''}
            </div>
            <div style="font-size:14px;line-height:1.5;color:${text};padding-top:6px;">${desc}</div>
          </td>
        </tr>
      </table>
    </td></tr>`

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${bg}" style="background:${bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td align="center" style="padding-bottom:24px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
    <div style="font-size:12px;letter-spacing:4px;color:${gold};font-weight:700;">BITÁCORA DE VUELO</div>
    <div style="font-size:26px;font-weight:800;color:#FFFFFF;padding-top:10px;">Nuevo módulo: <span style="color:${gold};">En Vuelo</span> ✈️</div>
  </td></tr>

  <!-- Intro -->
  <tr><td style="padding-bottom:20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:${text};">
    Hola ${name},<br><br>
    Tu bitácora ahora te acompaña también <strong style="color:#FFFFFF;">durante el vuelo</strong>.
    Acabamos de lanzar <strong style="color:${gold};">En Vuelo</strong>: cuatro herramientas de piloto
    integradas a tu cuenta, disponibles desde hoy en el menú de la app.
  </td></tr>

  <!-- Features -->
  ${feature('⏱', 'Live Log — tu vuelo en tiempo real',
    'Inicia el cronómetro antes de despegar y al aterrizar el vuelo se guarda directo en tu bitácora, con la duración exacta. Funciona sin señal: se sincroniza cuando recuperas conexión. El GPS te sugiere el aeródromo más cercano.')}
  ${feature('⚖', 'Peso y Balance',
    'Calcula peso y centro de gravedad con envolvente CG gráfica, límites por categoría y combustible máximo cargable. Incluye Cessna 150/172/182 y conversión automática lbs/kg y gal/litros.')}
  ${feature('🔢', 'Computador de vuelo CX-3',
    'Altitud de presión y densidad, TAS/Mach, viento, tiempo-velocidad-distancia, combustible, planeo, holding y más — ideal para planificar y para preparar exámenes DGAC. 100% offline.', true)}
  ${feature('🌦', 'EasyPlan Meteo',
    'Briefing de ruta con METAR, TAF y GAMET, elevación del terreno con altitud sugerida y un análisis meteorológico generado con IA para tu ruta.', true)}

  <!-- Plan note -->
  <tr><td style="padding:4px 0 24px 0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.6;color:${muted};">
    <strong style="color:${text};">Live Log</strong> y <strong style="color:${text};">Peso y Balance</strong> están disponibles para todos.
    El <strong style="color:${text};">CX-3</strong> y <strong style="color:${text};">EasyPlan</strong> son parte del Plan Pro —
    si aún no lo has probado, tienes <strong style="color:${gold};">14 días gratis, sin tarjeta</strong>.
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:32px;">
    <a href="${SITE_URL}" style="display:inline-block;background:${gold};color:#000000;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:8px;">
      Probar En Vuelo →
    </a>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="border-top:1px solid ${border};padding-top:20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.6;color:${muted};">
    Recibes este correo porque tienes una cuenta en
    <a href="${SITE_URL}" style="color:${gold};text-decoration:none;">bitacoradevuelo.cl</a>.<br>
    ¿Dudas o sugerencias? Responde este correo — leemos todo.<br>
    Bitácora de Vuelo · Chile
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

serve(async (req) => {
  const url = new URL(req.url)

  // ── Autorización por secreto ──
  const secret = req.headers.get('x-announce-secret') || url.searchParams.get('secret') || ''
  if (!ANNOUNCE_SECRET || secret !== ANNOUNCE_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  // ── Preview en browser ──
  if (req.method === 'GET' && url.searchParams.get('preview')) {
    return new Response(emailHtml('Piloto'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (req.method !== 'POST') return new Response('POST requerido', { status: 405 })

  let body: { mode?: string; testEmail?: string } = {}
  try { body = await req.json() } catch { /* body vacío = dry-run */ }
  const mode = body.mode || 'dry-run'

  const admin = createClient(SUPABASE_URL, SUPABASE_SVC)

  // ── Modo prueba: un solo correo ──
  if (mode === 'test') {
    const to = body.testEmail
    if (!to) return new Response(JSON.stringify({ error: 'testEmail requerido' }), { status: 400 })
    const r = await sendOne(to, 'Piloto de prueba')
    return new Response(JSON.stringify({ mode, to, ok: r.ok, detail: r.detail }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Recolectar destinatarios: usuarios confirmados ──
  const recipients: { email: string; name: string }[] = []
  const names = new Map<string, string>()
  const { data: profiles } = await admin.from('profiles').select('id, full_name')
  for (const p of profiles || []) if (p.full_name) names.set(p.id, p.full_name)

  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
    for (const u of data.users) {
      if (u.email && u.email_confirmed_at) {
        const first = (names.get(u.id) || '').trim().split(/\s+/)[0]
        recipients.push({ email: u.email, name: first || 'piloto' })
      }
    }
    if (data.users.length < 1000) break
    page++
  }
  // dedupe por email
  const seen = new Set<string>()
  const unique = recipients.filter(r => !seen.has(r.email) && seen.add(r.email))

  if (mode === 'dry-run') {
    return new Response(JSON.stringify({
      mode, total: unique.length,
      sample: unique.slice(0, 10).map(r => `${r.name} <${r.email}>`),
    }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (mode !== 'send') return new Response(JSON.stringify({ error: `mode inválido: ${mode}` }), { status: 400 })

  // ── Envío real, 1 a 1 con pausa (Resend: 2 req/s) ──
  const results: { email: string; ok: boolean; detail?: string }[] = []
  for (const r of unique) {
    const res = await sendOne(r.email, r.name)
    results.push({ email: r.email, ok: res.ok, detail: res.ok ? undefined : res.detail })
    await new Promise(rs => setTimeout(rs, 600))
  }
  const sent = results.filter(x => x.ok).length
  console.log(`📧 Anuncio En Vuelo: ${sent}/${unique.length} enviados`)
  return new Response(JSON.stringify({ mode, total: unique.length, sent, failed: results.filter(x => !x.ok) }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function sendOne(to: string, name: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject: SUBJECT, html: emailHtml(name) }),
    })
    if (!res.ok) return { ok: false, detail: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 200) }
  }
}
