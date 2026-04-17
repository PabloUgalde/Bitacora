import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FLOW_API_KEY     = Deno.env.get('FLOW_API_KEY')!
const FLOW_SECRET      = Deno.env.get('FLOW_SECRET')!
const FLOW_BASE        = Deno.env.get('FLOW_ENV') === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api'
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!
const SITE_URL         = 'https://bitacoradevuelo.cl'
const FROM_EMAIL       = 'Bitácora de Vuelo <noreply@bitacoradevuelo.cl>'

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

// ─── Email de pago confirmado ─────────────────────────────────────────────────
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
      <h1 style="margin:0 0 6px;color:#ffffff;font-size:20px;font-weight:500;">Pago confirmado</h1>
      <p style="margin:0;color:#9E9E9E;font-size:13px;">Tu membresía Pro está activa</p>
    </td></tr>

    <tr><td style="background-color:#1E1E1E;padding:24px 28px;">
      <span style="display:inline-block;background:rgba(76,175,80,0.12);color:#4CAF50;border:0.5px solid rgba(76,175,80,0.3);font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;margin-bottom:14px;">Pro activo</span>
      <p style="margin:0 0 12px;color:#E0E0E0;font-size:15px;">Hola <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 16px;color:#9E9E9E;font-size:13px;line-height:1.7;">
        Tu pago fue procesado correctamente. Tienes acceso completo a todas las funciones de <strong style="color:#E0E0E0;">Bitácora de Vuelo Pro</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
        <tr><td style="background:#252525;border:1px solid #D4AF37;border-radius:8px;padding:14px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <p style="margin:0 0 3px;color:#D4AF37;font-size:14px;font-weight:500;">${opts.planLabel}</p>
              <p style="margin:0 0 3px;color:#9E9E9E;font-size:12px;">Activo desde el ${opts.startDate}</p>
              <p style="margin:0;color:#4CAF50;font-size:12px;">Vence el <strong>${opts.expiryDate}</strong></p>
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
            <strong style="color:#E0E0E0;">N° de orden:</strong> ${opts.orderId}<br>
            <strong style="color:#E0E0E0;">Fecha:</strong> ${opts.startDate}
          </p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 20px;">
        <a href="${SITE_URL}" style="display:inline-block;background:#D4AF37;color:#111111;font-size:13px;font-weight:600;padding:12px 30px;border-radius:8px;text-decoration:none;">Ir a mi bitácora →</a>
      </td></tr></table>
      <hr style="border:none;border-top:1px solid #2a2a2a;margin:18px 0;">
      <p style="margin:0;color:#9E9E9E;font-size:12px;line-height:1.7;">
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

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  // Flow envía POST con form-encoded body: token=...
  const body = await req.text()
  const params = new URLSearchParams(body)
  const token = params.get('token')

  if (!token) {
    console.error('flow-webhook: no token en el body')
    return new Response('Missing token', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)

  try {
    // Verificar estado del pago con Flow
    const payment = await flowGet('payment/getStatus', { token })
    console.log('Flow payment status:', payment.status, '| order:', payment.commerceOrder)

    // status 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
    if (payment.status !== 2) {
      console.log(`Pago no exitoso. Status: ${payment.status}`)
      return new Response('OK', { status: 200 })
    }

    // Leer userId y plan del campo optional
    // Flow puede devolver optional ya como objeto o como string JSON
    const optional = typeof payment.optional === 'string'
      ? JSON.parse(payment.optional || '{}')
      : (payment.optional || {})
    const userId: string = optional.userId
    const plan: string   = optional.plan

    if (!userId || !plan) {
      console.error('flow-webhook: optional sin userId o plan:', payment.optional)
      return new Response('OK', { status: 200 })
    }

    // Calcular expiración
    const now = new Date()
    const expiresAt = new Date()
    if (plan === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setDate(expiresAt.getDate() + 31)
    }

    // Actualizar plan en Supabase
    const { error: dbError } = await supabase.from('profiles')
      .update({ plan: 'pro', plan_expires_at: expiresAt.toISOString() })
      .eq('id', userId)

    if (dbError) {
      console.error('Supabase update error:', dbError)
      // No abortar — el pago fue exitoso, igual enviamos confirmación
    }

    console.log(`✅ Plan Pro activado para ${userId} hasta ${expiresAt.toISOString()}`)

    // Enviar email de confirmación
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()

    const email = profile?.email || payment.payer
    if (email) {
      const planLabel = plan === 'annual' ? 'Plan Pro Anual' : 'Plan Pro Mensual'
      const amount    = plan === 'annual' ? '$60.000 CLP' : '$6.000 CLP'

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: '✅ Pago confirmado — Bitácora de Vuelo Pro activo',
          html: emailPagoExitoso({
            name:       profile?.full_name || 'Piloto',
            amount,
            planLabel,
            startDate:  formatDate(now),
            expiryDate: formatDate(expiresAt),
            orderId:    payment.commerceOrder || token,
          }),
        }),
      })
      console.log(`📧 Email enviado a ${email}`)
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('flow-webhook error:', err.message)
    // Siempre 200 para que Flow no reintente indefinidamente
    return new Response('OK', { status: 200 })
  }
})
