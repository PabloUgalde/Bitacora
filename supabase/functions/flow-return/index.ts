import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SITE_URL = 'https://bitacoradevuelo.cl'

// Flow POST-redirige al usuario a urlReturn después del pago.
// Como Cloudflare Pages sólo acepta GET, esta función recibe el POST
// y hace un 302 al sitio con el parámetro de éxito.
serve(async (req) => {
  // Ignorar OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  // Flow envía form-encoded con token (puede ser GET o POST)
  let token = ''
  if (req.method === 'POST') {
    const body = await req.text()
    token = new URLSearchParams(body).get('token') || ''
  } else {
    token = new URL(req.url).searchParams.get('token') || ''
  }

  const dest = token
    ? `${SITE_URL}/?checkout=success&token=${encodeURIComponent(token)}`
    : `${SITE_URL}/?checkout=success`

  return new Response(null, {
    status: 302,
    headers: { Location: dest },
  })
})
