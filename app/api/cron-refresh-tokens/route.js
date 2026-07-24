import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Runs daily. Facebook lets you re-exchange a still-valid long-lived token
// for a fresh 60-day one without the user re-approving anything — so as long
// as this runs at least once before the current token's 60 days are up,
// a connected Meta login never needs to be reconnected manually.
// Vercel Cron calls this on the schedule set in vercel.json.

const REFRESH_WINDOW_DAYS = 10 // refresh anything expiring within this many days

export async function GET(request) {
  // Vercel Cron sends this header automatically; block manual public hits.
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return Response.json({ error: 'META_APP_ID/META_APP_SECRET not configured' }, { status: 500 })
  }

  const db = supabaseAdmin()
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 86400000).toISOString()

  const { data: dueConnections, error } = await db
    .from('meraki_ad_connections')
    .select('id, access_token, token_expires_at, provider_user_name')
    .eq('platform', 'meta')
    .eq('is_active', true)
    .lte('token_expires_at', cutoff)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = []

  for (const conn of dueConnections || []) {
    try {
      const exchangeUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
      exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token')
      exchangeUrl.searchParams.set('client_id', appId)
      exchangeUrl.searchParams.set('client_secret', appSecret)
      exchangeUrl.searchParams.set('fb_exchange_token', conn.access_token)

      const res = await fetch(exchangeUrl.toString())
      const data = await res.json()

      if (!res.ok || !data.access_token) {
        // Token likely already expired or was revoked — needs manual reconnect
        results.push({ id: conn.id, name: conn.provider_user_name, ok: false, error: data?.error?.message })
        continue
      }

      const expiresInSeconds = data.expires_in || 60 * 24 * 60 * 60
      const newExpiry = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

      await db
        .from('meraki_ad_connections')
        .update({ access_token: data.access_token, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq('id', conn.id)

      results.push({ id: conn.id, name: conn.provider_user_name, ok: true, newExpiry })
    } catch (e) {
      results.push({ id: conn.id, name: conn.provider_user_name, ok: false, error: e.message })
    }
  }

  return Response.json({ checked: (dueConnections || []).length, results })
}
