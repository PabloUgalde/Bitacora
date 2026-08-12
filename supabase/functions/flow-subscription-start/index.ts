import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Secretos propios del cargo automático (FLOW_SUB_*), separados de
// FLOW_API_KEY/FLOW_SECRET/FLOW_ENV que usa el pago único (create-checkout /
// flow-webhook). Así se puede dejar esto en sandbox sin afectar los pagos
// reales que ya corren en producción con las otras credenciales.
const FLOW_API_KEY         = Deno.env.get('FLOW_SUB_API_KEY')!
const FLOW_SECRET          = Deno.env.get('FLOW_SUB_SECRET')!
const FLOW_BASE            = Deno.env.get('FLOW_SUB_ENV') === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api'
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ─── HMAC-SHA256 para firmar requests a Flow ─────────────────────────────────
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

// Mientras el cargo automático se prueba en sandbox, se permite además un
// origin local para poder correr index.html sin subirlo al hosting real.
// TODO: quitar 'http://localhost:8080' antes de habilitar esto en producción.
const ALLOWED_ORIGINS = ['https://bitacoradevuelo.cl', 'http://localhost:8080']
function corsHeadersFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
// Inicia el registro de tarjeta para cargo automático: crea el cliente en Flow
// (si no existe) y devuelve la URL de Flow donde el usuario ingresa su tarjeta.
// La suscripción en sí se crea recién en flow-subscription-return, una vez
// confirmado el registro (ver CLAUDE.md, sección "Cargo automático").
serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Usuario no autenticado')

    const { plan, couponCode } = await req.json()
    if (!['monthly', 'annual'].includes(plan)) throw new Error('Plan inválido')

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, flow_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    let customerId = profile?.flow_customer_id

    if (!customerId) {
      const customer = await flowPost('customer/create', {
        name: profile?.full_name || user.email!,
        email: profile?.email || user.email!,
        externalId: user.id,
      })
      customerId = customer.customerId
      await supabase.from('profiles').update({ flow_customer_id: customerId }).eq('id', user.id)
    }

    const couponParam = couponCode ? `&coupon=${encodeURIComponent(couponCode)}` : ''
    const urlReturn = `${SUPABASE_URL}/functions/v1/flow-subscription-return?plan=${plan}${couponParam}`
    const register = await flowPost('customer/register', {
      customerId,
      url_return: urlReturn,
    })

    return new Response(JSON.stringify({ url: `${register.url}?token=${register.token}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('flow-subscription-start error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
