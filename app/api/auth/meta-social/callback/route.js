import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { discoverMetaPages } from '@/lib/discoverMetaPages'

// Kept structurally parallel to /api/auth/meta/callback (the ads OAuth
// callback) but writes to social_connections / social_pages instead of
// meraki_ad_connections / meraki_ad_accounts — same Meta App, same
// META_APP_ID/META_APP_SECRET, deliberately separate token/connection
// records since this token carries different (Page/IG) scopes.

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
    // ignore malformed state
  }

  const fail = (message) => {
    const dest = new URL(returnTo, url.origin)
    dest.searchParams.set('meta_social_connect_error', message)
    return Response.redirect(dest.toString(), 302)
  }

  if (errorParam) return fail(errorParam)
  if (!code) return fail('missing_code')

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return fail('server_not_configured')

  const redirectUri = `${url.origin}/api/auth/meta-social/callback`

  try {
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

    const userAccessToken = longData.access_token
    const expiresInSeconds = longData.expires_in || 60 * 24 * 60 * 60
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    const meRes = await fetch(
      `https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${userAccessToken}`
    )
    const me = await meRes.json()
    if (!meRes.ok || !me.id) return fail('failed_to_fetch_identity')

    const discovery = await discoverMetaPages(userAccessToken)
    const pages = discovery.pages

    const db = supabaseAdmin()

    const { data: connection, error: connErr } = await db
      .from('social_connections')
      .upsert(
        {
          provider_user_id: me.id,
          provider_user_name: me.name || null,
          user_access_token: userAccessToken,
          token_expires_at: tokenExpiresAt,
          connected_by: connectedBy || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider_user_id' }
      )
      .select()
      .single()

    if (connErr) return fail(`db_error: ${connErr.message}`)

    if (pages.length > 0) {
      const rows = pages.map((p) => ({
        connection_id: connection.id,
        page_id: p.page_id,
        page_name: p.page_name,
        page_access_token: p.page_access_token,
        ig_user_id: p.ig_user_id,
        ig_username: p.ig_username,
        ig_profile_picture_url: p.ig_profile_picture_url,
        is_active: true,
        synced_at: new Date().toISOString(),
      }))
      const { error: pageErr } = await db.from('social_pages').upsert(rows, { onConflict: 'page_id' })
      if (pageErr) return fail(`db_error_pages: ${pageErr.message}`)
    }

    const dest = new URL(returnTo, url.origin)
    dest.searchParams.set('meta_social_connected', String(pages.length))
    return Response.redirect(dest.toString(), 302)
  } catch (e) {
    return fail(e.message || 'unknown_error')
  }
}
