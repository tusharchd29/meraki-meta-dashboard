// Diagnostic endpoint — shows exactly what this deployment would send to
// Facebook, without actually redirecting. Use this to confirm the
// redirect_uri matches what's whitelisted in the Meta app settings.
// Safe to hit publicly: returns no secrets, only the App ID (which is public
// by design) and the computed URLs.

export async function GET(request) {
  const url = new URL(request.url)
  const origin = url.origin
  const redirectUri = `${origin}/api/auth/meta/callback`
  const appId = process.env.META_APP_ID
  const configId = process.env.META_LOGIN_CONFIG_ID

  const authUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId || 'MISSING')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', 'debug')
  authUrl.searchParams.set('response_type', 'code')
  if (configId) {
    authUrl.searchParams.set('config_id', configId)
  } else {
    // Must match the real login route exactly — this is a debug preview,
    // and previewing a scope wider than what's actually requested would be
    // misleading (and dangerous if anyone ever used this URL to connect).
    authUrl.searchParams.set('scope', ['ads_read', 'business_management'].join(','))
  }

  return Response.json({
    detected_origin: origin,
    redirect_uri_being_sent: redirectUri,
    whitelist_this_exact_string_in_meta: redirectUri,
    env_check: {
      META_APP_ID: appId ? `set (${appId})` : 'MISSING',
      META_APP_SECRET: process.env.META_APP_SECRET ? 'set' : 'MISSING',
      META_LOGIN_CONFIG_ID: configId ? `set (${configId})` : 'not set (using classic scope)',
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      CRON_SECRET: process.env.CRON_SECRET ? 'set' : 'MISSING',
    },
    full_auth_url: authUrl.toString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
