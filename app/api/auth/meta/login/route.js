// Step 1 of Meta OAuth: send the user to Facebook's consent screen.
// After approving, Facebook redirects to /api/auth/meta/callback with a `code`.

export async function GET(request) {
  const appId = process.env.META_APP_ID
  if (!appId) {
    return Response.json({ error: 'META_APP_ID not configured' }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/auth/meta/callback`

  // Optional: who is connecting, and where to send them back to afterwards
  const { searchParams } = new URL(request.url)
  const connectedBy = searchParams.get('by') || ''
  const returnTo = searchParams.get('return_to') || '/'

  // state carries context through the redirect round-trip; Facebook echoes it back untouched
  const state = Buffer.from(JSON.stringify({ connectedBy, returnTo })).toString('base64url')

  const authUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')

  // READ-ONLY BY CONSTRUCTION.
  // ads_management is deliberately NOT requested. It is the scope that grants
  // create/edit/pause/delete on campaigns, ad sets and ads — without it, a
  // token issued through this app is physically incapable of mutating ad
  // data, regardless of what any code does with it. This is the strongest
  // guarantee available: it holds even against a bug or a malicious change
  // in this repo, because the permission was never granted by the user.
  //
  // ads_read            — read campaigns/ads/insights. Required.
  // business_management — enumerate business portfolios and the ad accounts
  //                       inside them. Required for account discovery; this
  //                       app only ever issues GET requests against it.
  const configId = process.env.META_LOGIN_CONFIG_ID
  if (configId) {
    authUrl.searchParams.set('config_id', configId)
  } else {
    authUrl.searchParams.set('scope', ['ads_read', 'business_management'].join(','))
  }

  return Response.redirect(authUrl.toString(), 302)
}
