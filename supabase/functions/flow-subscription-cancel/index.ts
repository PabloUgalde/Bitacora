import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Secretos propios del cargo automático — ver nota en flow-subscription-start
const FLOW_API_KEY     = Deno.env.get('FLOW_SUB_API_KEY')!
const FLOW_SECRET      = Deno.env.get('FLOW_SUB_SECRET')!
const FLOW_BASE        = Deno.env.get('FLOW_SUB_ENV') === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api'
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
// Cancela el cargo automático del usuario autenticado. El subscriptionId se
// lee SIEMPRE de la propia fila del usuario (nunca del body) para que nadie
// pueda cancelar la suscripción de otra persona. El acceso Pro no se retira
// acá — sigue vigente hasta plan_expires_at, igual que al dejar vencer un
// pago único.
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('flow_subscription_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.flow_subscription_id) {
      throw new Error('No tienes una suscripción con cargo automático activa')
    }

    await flowPost('subscription/cancel', { subscriptionId: profile.flow_subscription_id })

    await supabase.from('profiles')
      .update({ flow_subscription_status: 'cancelled' })
      .eq('id', user.id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('flow-subscription-cancel error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
