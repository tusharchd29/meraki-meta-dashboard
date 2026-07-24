import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Step 2 of Google Ads OAuth: Google redirects here with a `code`.
// We exchange it for an access token + refresh token and store the connection.
// Listing which Ads accounts this login can manage requires the Developer
// Token (a separate one-time Google approval) — that sync happens later via
// a "Sync accounts" action once GOOGLE_ADS_DEVELOPER_TOKEN is set.

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  let returnTo = '/'
  let connectedBy = ''
  try {
    if (stateRaw) {
      const decoded = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
      returnTo = decoded.returnTo || '/'
      connectedBy = decoded.connectedBy || ''
    }
  } catch {
    // ignore malformed state
  }

  const fail = (message) => {
    const dest = new URL(returnTo, url.origin)
    dest.searchParams.set('google_connect_error', message)
    return Response.redirect(dest.toString(), 302)
  }

  if (errorParam) return fail(errorParam)
  if (!code) return fail('missing_code')

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail('server_not_configured')

  const redirectUri = `${url.origin}/api/auth/google-ads/callback`

  try {
    // Exchange the auth code for access_token + refresh_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      return fail(tokenData?.error_description || tokenData?.error || 'code_exchange_failed')
    }

    if (!tokenData.refresh_token) {
      // Happens if the user already granted consent before and Google skipped
      // issuing a new refresh_token. prompt=consent above should prevent this,
      // but guard anyway since without it we can't silently refresh later.
      return fail('no_refresh_token_returned_try_revoking_access_and_reconnect')
    }

    const expiresInSeconds = tokenData.expires_in || 3600
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    // Identify who logged in
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userinfo = await userinfoRes.json()
    const providerUserId = userinfo?.id || userinfo?.email
    if (!providerUserId) return fail('failed_to_fetch_identity')

    const db = supabaseAdmin()

    const { error: connErr } = await db.from('meraki_ad_connections').upsert(
      {
        platform: 'google_ads',
        provider_user_id: providerUserId,
        provider_user_name: userinfo?.email || userinfo?.name || null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: tokenExpiresAt,
        connected_by: connectedBy || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'platform,provider_user_id' }
    )

    if (connErr) return fail(`db_error: ${connErr.message}`)

    const dest = new URL(returnTo, url.origin)
    dest.searchParams.set('google_connected', '1')
    return Response.redirect(dest.toString(), 302)
  } catch (e) {
    return fail(e.message || 'unknown_error')
  }
}
