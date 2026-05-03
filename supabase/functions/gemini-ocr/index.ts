import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function corsHeaders(origin: string | null) {
  const allowed = ['https://bitacoradevuelo.cl', 'http://localhost:8080', 'http://localhost:3000'];
  const allowedOrigin = origin && allowed.includes(origin) ? origin : 'https://bitacoradevuelo.cl';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new Error('Usuario no autenticado')

    const body = await req.json()

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error?.message || `Gemini HTTP ${resp.status}`)

    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('gemini-ocr error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
