import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FLOW_API_KEY      = Deno.env.get('FLOW_API_KEY')!
const FLOW_SECRET       = Deno.env.get('FLOW_SECRET')!
const FLOW_BASE         = Deno.env.get('FLOW_ENV') === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api'
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://bitacoradevuelo.cl',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Validar JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Usuario no autenticado')

    const { plan } = await req.json()
    if (!['trial', 'monthly', 'annual'].includes(plan)) throw new Error('Plan inválido')

    const successUrl = `${SUPABASE_URL}/functions/v1/flow-return`

    // ── TRIAL: activar directo en Supabase, sin cobro ─────────────────────────
    if (plan === 'trial') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_used')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.trial_used) throw new Error('El período de prueba ya fue utilizado')

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 14)

      await supabase.from('profiles').upsert({
        id: user.id,
        plan: 'pro',
        plan_expires_at: expiresAt.toISOString(),
        trial_used: true,
      }, { onConflict: 'id' })

      return new Response(JSON.stringify({ url: 'https://bitacoradevuelo.cl/?checkout=success' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── MENSUAL / ANUAL: pago único via Flow ──────────────────────────────────
    const isAnnual = plan === 'annual'
    const commerceOrder = `${plan}-${user.id.slice(0, 8)}-${Date.now()}`

    const payment = await flowPost('payment/create', {
      commerceOrder,
      subject:         isAnnual ? 'Bitácora Pro — Plan Anual' : 'Bitácora Pro — Plan Mensual',
      currency:        'CLP',
      amount:          isAnnual ? '60000' : '6000',
      email:           user.email!,
      urlConfirmation: `${SUPABASE_URL}/functions/v1/flow-webhook`,
      urlReturn:       successUrl,
      optional:        JSON.stringify({ userId: user.id, plan }),
    })

    return new Response(JSON.stringify({ url: `${payment.url}?token=${payment.token}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('create-checkout error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
