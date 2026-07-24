import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { discoverMetaAdAccounts } from '@/lib/discoverMetaAccounts'

// Step 2 of Meta OAuth: Facebook redirects here with a `code`.
// We exchange it for a short-lived token, exchange that for a 60-day
// long-lived token, fetch which ad accounts it can see, and store all of it.

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error_description') || url.searchParams.get('error')

  let returnTo = '/'
  let connectedBy = ''
  try {
    if (stateRaw) {
      const decoded = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'))
      returnTo = decoded.returnTo || '/'
      connectedBy = decoded.connectedBy || ''
    }
  } catch {
    // ignore malformed state, fall back to defaults
  }

  const fail = (message) => {
    const dest = new URL(returnTo, url.origin)
    dest.searchParams.set('meta_connect_error', message)
    return Response.redirect(dest.toString(), 302)
  }

  if (errorParam) return fail(errorParam)
  if (!code) return fail('missing_code')

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return fail('server_not_configured')

  const redirectUri = `${url.origin}/api/auth/meta/callback`

  try {
    // 1) Exchange the auth code for a short-lived user access token
    const codeExchangeUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    codeExchangeUrl.searchParams.set('client_id', appId)
    codeExchangeUrl.searchParams.set('client_secret', appSecret)
    codeExchangeUrl.searchParams.set('redirect_uri', redirectUri)
    codeExchangeUrl.searchParams.set('code', code)

    const shortRes = await fetch(codeExchangeUrl.toString())
    const shortData = await shortRes.json()
    if (!shortRes.ok || !shortData.access_token) {
      return fail(shortData?.error?.message || 'code_exchange_failed')
    }

    // 2) Exchange the short-lived token for a 60-day long-lived token
    const longExchangeUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    longExchangeUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longExchangeUrl.searchParams.set('client_id', appId)
    longExchangeUrl.searchParams.set('client_secret', appSecret)
    longExchangeUrl.searchParams.set('fb_exchange_token', shortData.access_token)

    const longRes = await fetch(longExchangeUrl.toString())
    const longData = await longRes.json()
    if (!longRes.ok || !longData.access_token) {
      return fail(longData?.error?.message || 'long_token_exchange_failed')
    }

    const accessToken = longData.access_token
    const expiresInSeconds = longData.expires_in || 60 * 24 * 60 * 60 // fallback ~60 days
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    // 3) Who is this? (Facebook user id, not one of our team's identities)
    const meRes = await fetch(
      `https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${accessToken}`
    )
    const me = await meRes.json()
    if (!meRes.ok || !me.id) return fail('failed_to_fetch_identity')

    // 4) Which ad accounts can this token see? This covers directly-assigned
    //    accounts plus everything reachable through each business portfolio
    //    (owned accounts and clients the portfolio has partner access to).
    const discovery = await discoverMetaAdAccounts(accessToken)
    const accounts = discovery.accounts

    const db = supabaseAdmin()

    // 5) Upsert the connection (one row per Facebook login)
    const { data: connection, error: connErr } = await db
      .from('meraki_ad_connections')
      .upsert(
        {
          platform: 'meta',
          provider_user_id: me.id,
          provider_user_name: me.name || null,
          access_token: accessToken,
          refresh_token: null,
          token_expires_at: tokenExpiresAt,
          connected_by: connectedBy || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'platform,provider_user_id' }
      )
      .select()
      .single()

    if (connErr) return fail(`db_error: ${connErr.message}`)

    // 6) Upsert each ad account this login can access
    if (accounts.length > 0) {
      const rows = accounts.map((a) => ({
        connection_id: connection.id,
        platform: 'meta',
        account_id: a.account_id,
        account_name: a.account_name,
        currency: a.currency,
        business_id: a.business_id,
        business_name: a.business_name,
        access_type: a.access_type,
        synced_at: new Date().toISOString(),
      }))
      const { error: acctErr } = await db
        .from('meraki_ad_accounts')
        .upsert(rows, { onConflict: 'platform,account_id' })
      if (acctErr) return fail(`db_error_accounts: ${acctErr.message}`)
    }

    const dest = new URL(returnTo, url.origin)
    dest.searchParams.set('meta_connected', String(accounts.length))
    return Response.redirect(dest.toString(), 302)
  } catch (e) {
    return fail(e.message || 'unknown_error')
  }
}
