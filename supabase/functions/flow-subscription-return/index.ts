import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Secretos propios del cargo automático — ver nota en flow-subscription-start
const FLOW_API_KEY         = Deno.env.get('FLOW_SUB_API_KEY')!
const FLOW_SECRET          = Deno.env.get('FLOW_SUB_SECRET')!
const FLOW_BASE            = Deno.env.get('FLOW_SUB_ENV') === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api'
const FLOW_PLAN_ID_MONTHLY = Deno.env.get('FLOW_PLAN_ID_MONTHLY')!
const FLOW_PLAN_ID_ANNUAL  = Deno.env.get('FLOW_PLAN_ID_ANNUAL')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!
const SITE_URL             = 'https://bitacoradevuelo.cl'
const FROM_EMAIL           = 'Bitácora de Vuelo <noreply@bitacoradevuelo.cl>'

// Mientras el frontend nuevo no está subido al hosting real, el redirect final
// del navegador puede apuntar a un origin de prueba (ej. localhost) sin tocar
// los links del email (que siempre deben ser el dominio real). Se controla
// con el secreto opcional SUB_TEST_REDIRECT — quitarlo antes de producción.
const REDIRECT_BASE = Deno.env.get('SUB_TEST_REDIRECT') || SITE_URL

// Mapa código-de-cupón → couponId numérico de Flow (subscription/create solo
// acepta el id numérico, no el nombre visible en el dashboard). Se mantiene
// como secreto editable (FLOW_COUPON_MAP, JSON) para no requerir redeploy al
// agregar/cambiar cupones. Ej: {"PILOTOCUA":1278}
function resolveCouponId(code: string): number | null {
  if (!code) return null
  try {
    const map = JSON.parse(Deno.env.get('FLOW_COUPON_MAP') || '{}')
    const id = map[code.trim().toUpperCase()]
    return typeof id === 'number' ? id : null
  } catch {
    return null
  }
}

// ─── HMAC-SHA256 ──────────────────────────────────────────────────────────────
async function sign(params: Record<string, string>): Promise<string> {
  const toSign = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(FLOW_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function flowGet(endpoint: string, params: Record<string, string>) {
  const p: Record<string, string> = { apiKey: FLOW_API_KEY, ...params }
  p.s = await sign(p)
  const res = await fetch(`${FLOW_BASE}/${endpoint}?${new URLSearchParams(p).toString()}`)
  return res.json()
}

async function flowPost(endpoint: string, params: Record<string, string>) {
  const p: Record<string, string> = { apiKey: FLOW_API_KEY, ...params }
  p.s = await sign(p)
  const res = await fetch(`${FLOW_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(p).toString(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Flow ${endpoint}: ${JSON.stringify(json)}`)
  return json
}

// Mapea el status numérico de subscription/create a nuestro texto en profiles.
// 0=inactive, 1=active, 2=trial, 4=cancelled (según doc de Flow) — sin
// confirmar en sandbox todavía, ver CLAUDE.md sección "Cargo automático".
function mapSubscriptionStatus(status: number): string {
  switch (status) {
    case 1: return 'active'
    case 2: return 'trial'
    case 4: return 'cancelled'
    default: return 'inactive'
  }
}

// Parsea una fecha devuelta por Flow ('yyyy-mm-dd' o 'yyyy-mm-dd HH:mm:ss').
function parseFlowDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Email de pago confirmado (duplicado de flow-webhook — sin módulo compartido) ──
function emailPagoExitoso(opts: {
  name: string; amount: string; planLabel: string
  startDate: string; expiryDate: string; orderId: string
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:32px 16px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="background-color:#121212;padding:18px 28px;border-radius:12px 12px 0 0;border-bottom:1px solid #2a2a2a;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;padding-right:12px;">
          <img src="${SITE_URL}/icon-192.png" width="40" height="40" style="border-radius:8px;display:block;" alt="Bitácora de Vuelo">
        </td>
        <td style="vertical-align:middle;">
          <span style="display:block;color:#ffffff;font-size:15px;font-weight:500;">Bitácora de Vuelo</span>
          <span style="display:block;color:#D4AF37;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px;">registro oficial de horas</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background-color:#0a1a0e;padding:28px;text-align:center;border-bottom:1px solid #2a2a2a;">
      <div style="font-size:32px;margin-bottom:10px;">✅</div>
      <h1 style="margin:0 0 6px;color:#ffffff;font-size:20px;font-weight:500;">Cargo automático activado</h1>
      <p style="margin:0;color:#9E9E9E;font-size:13px;">Tu membresía Pro está activa</p>
    </td></tr>
    <tr><td style="background-color:#1E1E1E;padding:24px 28px;">
      <span style="display:inline-block;background:rgba(76,175,80,0.12);color:#4CAF50;border:0.5px solid rgba(76,175,80,0.3);font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;margin-bottom:14px;">Pro activo</span>
      <p style="margin:0 0 12px;color:#E0E0E0;font-size:15px;">Hola <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 16px;color:#9E9E9E;font-size:13px;line-height:1.7;">
        Tu tarjeta quedó registrada y el primer cobro fue exitoso. Tienes acceso completo a todas las funciones de <strong style="color:#E0E0E0;">Bitácora de Vuelo Pro</strong>. A partir de ahora se renueva sola.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
        <tr><td style="background:#252525;border:1px solid #D4AF37;border-radius:8px;padding:14px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <p style="margin:0 0 3px;color:#D4AF37;font-size:14px;font-weight:500;">${opts.planLabel}</p>
              <p style="margin:0 0 3px;color:#9E9E9E;font-size:12px;">Cobrado el ${opts.startDate}</p>
              <p style="margin:0;color:#4CAF50;font-size:12px;">Próxima renovación <strong>${opts.expiryDate}</strong></p>
            </td>
            <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
              <span style="display:block;color:#D4AF37;font-size:20px;font-weight:600;">${opts.amount}</span>
            </td>
          </tr></table>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
        <tr><td style="background-color:#252525;border:0.5px solid #383838;border-left:3px solid #4CAF50;border-radius:0 8px 8px 0;padding:12px 14px;">
          <p style="margin:0;color:#9E9E9E;font-size:12px;line-height:1.8;">
            <strong style="color:#E0E0E0;">N° de invoice:</strong> ${opts.orderId}<br>
            <strong style="color:#E0E0E0;">Fecha:</strong> ${opts.startDate}
          </p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 20px;">
        <a href="${SITE_URL}" style="display:inline-block;background:#D4AF37;color:#111111;font-size:13px;font-weight:600;padding:12px 30px;border-radius:8px;text-decoration:none;">Ir a mi bitácora →</a>
      </td></tr></table>
      <hr style="border:none;border-top:1px solid #2a2a2a;margin:18px 0;">
      <p style="margin:0;color:#9E9E9E;font-size:12px;line-height:1.7;">
        ¿Quieres cancelar el cargo automático? Puedes hacerlo desde Configuración → Mi cuenta.<br>
        ¿Tienes preguntas? <a href="mailto:info@bitacoradevuelo.cl" style="color:#D4AF37;">info@bitacoradevuelo.cl</a>
      </p>
    </td></tr>
    <tr><td style="background-color:#121212;padding:14px 28px;text-align:center;border-top:1px solid #2a2a2a;border-radius:0 0 12px 12px;">
      <p style="margin:0;color:#555555;font-size:11px;line-height:1.7;">
        © 2026 Bitácora de Vuelo · Chile<br>
        <a href="${SITE_URL}/terminos" style="color:#777777;text-decoration:underline;">Términos</a> ·
        <a href="${SITE_URL}/privacidad" style="color:#777777;text-decoration:underline;">Privacidad</a>
      </p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body>
</html>`
}

// ─── Handler principal ────────────────────────────────────────────────────────
// Flow redirige aquí (GET, url_return de customer/register) tras el registro
// de tarjeta. Confirma el registro y crea la suscripción.
//
// Otorga plan='pro' directo si el primer invoice de subscription/create ya
// viene pagado (status 1) — confirmado en sandbox 05-ago-2026: Flow resuelve
// el primer cobro de forma SÍNCRONA dentro de esa misma llamada y no dispara
// un webhook aparte para esa primera factura (el urlCallback del plan solo
// parece usarse para renovaciones futuras). Si el invoice no viene pagado
// (planes con trial_period_days > 0, por ejemplo), no se otorga Pro aquí y
// queda a cargo de flow-subscription-webhook cuando llegue el cobro real.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const url = new URL(req.url)
  let token = url.searchParams.get('token') || ''
  const plan = url.searchParams.get('plan') || ''
  const couponCode = url.searchParams.get('coupon') || ''

  if (!token && req.method === 'POST') {
    const body = await req.text()
    token = new URLSearchParams(body).get('token') || ''
  }

  const fail = () => new Response(null, {
    status: 302,
    headers: { Location: `${REDIRECT_BASE}/?subscription=failed` },
  })

  if (!token || !['monthly', 'annual'].includes(plan)) {
    console.error('flow-subscription-return: falta token o plan inválido', { token, plan })
    return fail()
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)

  // TODO: debug temporal para diagnosticar el flujo en sandbox — quitar
  // junto con la tabla public._debug_log una vez validado el ciclo completo.
  const dbg = (tag: string, payload: unknown) =>
    supabase.from('_debug_log').insert({ tag, payload }).then(() => {})

  await dbg('return:entry', { token, plan })

  try {
    const register = await flowGet('customer/getRegisterStatus', { token })
    console.log('customer/getRegisterStatus:', JSON.stringify(register))
    await dbg('return:getRegisterStatus', register)

    // status "1" = tarjeta registrada correctamente. Confirmado en sandbox
    // 05-ago-2026: Flow devuelve el status como string, no como número, y "1"
    // es éxito (no "2" como en payment/getStatus — son escalas distintas).
    if (!register.customerId || String(register.status) !== '1') {
      console.error('Registro de tarjeta no exitoso:', register)
      await dbg('return:register-status-not-2', register)
      return fail()
    }

    const customerId: string = register.customerId

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, plan, plan_expires_at')
      .eq('flow_customer_id', customerId)
      .maybeSingle()

    await dbg('return:profile-lookup', { customerId, profile, profileErr })

    if (!profile) {
      console.error('flow-subscription-return: no se encontró usuario para customerId', customerId)
      return fail()
    }

    const planId = plan === 'annual' ? FLOW_PLAN_ID_ANNUAL : FLOW_PLAN_ID_MONTHLY
    const couponId = resolveCouponId(couponCode)
    if (couponCode && !couponId) {
      console.error('flow-subscription-return: código de cupón no reconocido:', couponCode)
    }
    const subscriptionParams: Record<string, string> = { planId, customerId }
    if (couponId) subscriptionParams.couponId = String(couponId)

    await dbg('return:before-subscription-create', { planId, customerId, couponCode, couponId })
    const subscription = await flowPost('subscription/create', subscriptionParams)
    await dbg('return:subscription-create-result', subscription)

    const firstInvoice = Array.isArray(subscription.invoices) ? subscription.invoices[0] : null
    const firstInvoicePaid = firstInvoice?.status === 1

    const profileUpdate: Record<string, unknown> = {
      flow_subscription_id: subscription.subscriptionId,
      flow_subscription_status: mapSubscriptionStatus(subscription.status),
      flow_card_last4: register.last4CardDigits || null,
    }

    const now = new Date()
    let periodEnd: Date | null = null
    if (firstInvoicePaid) {
      periodEnd = parseFlowDate(firstInvoice.period_end) ||
        (plan === 'annual'
          ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
          : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()))
      profileUpdate.plan = 'pro'
      profileUpdate.plan_expires_at = periodEnd.toISOString()
    }

    const { error: updateErr } = await supabase.from('profiles').update(profileUpdate).eq('id', profile.id)
    await dbg('return:profile-update', { firstInvoicePaid, profileUpdate, updateErr })

    console.log(`✅ Suscripción ${subscription.subscriptionId} creada para ${profile.id} (primer invoice pagado: ${firstInvoicePaid})`)

    if (firstInvoicePaid && profile.email) {
      const planLabel = plan === 'annual' ? 'Plan Pro Anual (cargo automático)' : 'Plan Pro Mensual (cargo automático)'
      const amount = firstInvoice.amount ? `$${Number(firstInvoice.amount).toLocaleString('es-CL')} CLP` : ''
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: profile.email,
          subject: '✅ Cargo automático activado — Bitácora de Vuelo Pro',
          html: emailPagoExitoso({
            name: profile.full_name || 'Piloto',
            amount,
            planLabel,
            startDate: formatDate(now),
            expiryDate: formatDate(periodEnd!),
            orderId: String(firstInvoice.id ?? ''),
          }),
        }),
      }).catch(e => console.error('Error enviando email de cargo automático:', e.message))
    }

    const couponFlag = (couponCode && !couponId) ? '&couponInvalid=1' : ''
    return new Response(null, {
      status: 302,
      headers: { Location: `${REDIRECT_BASE}/?subscription=${firstInvoicePaid ? 'success' : 'pending'}${couponFlag}` },
    })

  } catch (err) {
    console.error('flow-subscription-return error:', err.message)
    await dbg('return:catch', { message: err.message, stack: err.stack })
    return fail()
  }
})
