import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Secretos propios del cargo automático — ver nota en flow-subscription-start
const FLOW_API_KEY         = Deno.env.get('FLOW_SUB_API_KEY')!
const FLOW_SECRET          = Deno.env.get('FLOW_SUB_SECRET')!
const FLOW_BASE            = Deno.env.get('FLOW_SUB_ENV') === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api'
const FLOW_PLAN_ID_ANNUAL  = Deno.env.get('FLOW_PLAN_ID_ANNUAL')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!
const SITE_URL             = 'https://bitacoradevuelo.cl'
const FROM_EMAIL           = 'Bitácora de Vuelo <noreply@bitacoradevuelo.cl>'

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
      <h1 style="margin:0 0 6px;color:#ffffff;font-size:20px;font-weight:500;">Cobro automático confirmado</h1>
      <p style="margin:0;color:#9E9E9E;font-size:13px;">Tu membresía Pro se renovó</p>
    </td></tr>

    <tr><td style="background-color:#1E1E1E;padding:24px 28px;">
      <span style="display:inline-block;background:rgba(76,175,80,0.12);color:#4CAF50;border:0.5px solid rgba(76,175,80,0.3);font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;margin-bottom:14px;">Pro activo</span>
      <p style="margin:0 0 12px;color:#E0E0E0;font-size:15px;">Hola <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 16px;color:#9E9E9E;font-size:13px;line-height:1.7;">
        Tu cargo automático fue procesado correctamente. Tienes acceso completo a todas las funciones de <strong style="color:#E0E0E0;">Bitácora de Vuelo Pro</strong>.
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

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Parsea una fecha devuelta por Flow ('yyyy-mm-dd' o 'yyyy-mm-dd HH:mm:ss');
// si no es parseable, devuelve null para que el caller use un fallback.
function parseFlowDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

// ─── Handler principal ────────────────────────────────────────────────────────
// urlCallback configurado en cada plan de Flow (plans/create). Se dispara en
// cada evento de cobro de una suscripción (cargo exitoso, fallido, cancelado).
//
// ⚠️ El shape exacto del body no está confirmado por documentación pública —
// a diferencia de flow-webhook (pago único, contrato "token" ya verificado),
// aquí se maneja de forma defensiva y se loguea el body crudo. Verificar en
// sandbox antes de apuntar el urlCallback de producción (ver CLAUDE.md).
serve(async (req) => {
  const body = await req.text()
  const params = new URLSearchParams(body)
  console.log('flow-subscription-webhook body:', body)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)

  try {
    const invoiceId = params.get('invoiceId')
    const subscriptionIdParam = params.get('subscriptionId')
    const token = params.get('token')

    let invoice: Record<string, any> | null = null

    if (invoiceId) {
      invoice = await flowGet('invoice/get', { invoiceId })
    } else if (subscriptionIdParam) {
      const subscription = await flowGet('subscription/get', { subscriptionId: subscriptionIdParam })
      const invoices = Array.isArray(subscription?.invoices) ? subscription.invoices : []
      invoice = invoices[0] || null
    } else if (token) {
      // Shape visto en pagos únicos (token → payment/getStatus). Sin
      // confirmación de que aplique a suscripciones; se deja como intento
      // best-effort, no bloquea el resto del manejo defensivo.
      console.error('flow-subscription-webhook: solo llegó "token", shape no confirmado:', body)
    }

    if (!invoice) {
      console.error('flow-subscription-webhook: no se pudo resolver invoice desde el body:', body)
      return new Response('OK', { status: 200 })
    }

    const subscriptionId: string = invoice.subscriptionId
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('flow_subscription_id', subscriptionId)
      .maybeSingle()

    if (!profileRow) {
      console.error('flow-subscription-webhook: no se encontró usuario para subscriptionId', subscriptionId)
      return new Response('OK', { status: 200 })
    }
    const userId = profileRow.id

    // status de invoice: 0=unpaid, 1=paid, 2=cancelled
    if (invoice.status === 1) {
      const now = new Date()
      // Fallback si period_end no viene o no es parseable: consultar el plan
      // real de la suscripción para saber si el ciclo es mensual o anual,
      // en vez de asumir uno de los dos.
      let periodEnd = parseFlowDate(invoice.period_end)
      let planIdForFallback: string | undefined
      if (!periodEnd) {
        const subscription = await flowGet('subscription/get', { subscriptionId })
        planIdForFallback = subscription?.planId
        periodEnd = planIdForFallback === FLOW_PLAN_ID_ANNUAL
          ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
          : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate() + 1)
      }

      await supabase.from('profiles').update({
        plan: 'pro',
        plan_expires_at: periodEnd.toISOString(),
        flow_subscription_status: 'active',
      }).eq('id', userId)

      console.log(`✅ Cargo automático confirmado para ${userId}, vence ${periodEnd.toISOString()}`)

      const email = profileRow?.email
      if (email) {
        const amount = invoice.amount ? `$${Number(invoice.amount).toLocaleString('es-CL')} CLP` : ''
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: '✅ Cobro automático confirmado — Bitácora de Vuelo Pro',
            html: emailPagoExitoso({
              name: profileRow?.full_name || 'Piloto',
              amount,
              planLabel: 'Cargo automático Pro',
              startDate: formatDate(now),
              expiryDate: formatDate(periodEnd),
              orderId: String(invoice.id ?? invoiceId ?? ''),
            }),
          }),
        })
        console.log(`📧 Email de cargo automático enviado a ${email}`)
      }

    } else if (invoice.status === 2) {
      await supabase.from('profiles').update({ flow_subscription_status: 'cancelled' }).eq('id', userId)
      console.log(`Suscripción ${subscriptionId} cancelada`)
    } else {
      // status 0: cobro fallido — se respeta el grace period / reintentos ya
      // configurado en el plan de Flow (days_until_due, charges_retries_number);
      // no se baja `plan` acá, solo se refleja el estado moroso.
      await supabase.from('profiles').update({ flow_subscription_status: 'past_due' }).eq('id', userId)
      console.log(`Cobro fallido/pendiente para suscripción ${subscriptionId}`)
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('flow-subscription-webhook error:', err.message)
    // Siempre 200 para que Flow no reintente indefinidamente
    return new Response('OK', { status: 200 })
  }
})
