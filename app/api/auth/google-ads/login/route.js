// Step 1 of Google Ads OAuth: send the user to Google's consent screen.
// Note: login/token storage works independently of the Google Ads Developer
// Token — that token is only needed later when actually calling the Ads API.

export async function GET(request) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  if (!clientId) {
    return Response.json({ error: 'GOOGLE_ADS_CLIENT_ID not configured' }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/auth/google-ads/callback`

  const { searchParams } = new URL(request.url)
  const connectedBy = searchParams.get('by') || ''
  const returnTo = searchParams.get('return_to') || '/'
  const state = Buffer.from(JSON.stringify({ connectedBy, returnTo })).toString('base64url')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  // adwords — read Google Ads data (this app only ever issues read queries;
  //           see READ_ONLY_POLICY.md).
  // openid/email — needed purely to identify which Google account connected,
  //           so multiple logins can be told apart. Without these the
  //           userinfo lookup in the callback fails.
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/adwords',
    'openid',
    'email',
  ].join(' '))
  authUrl.searchParams.set('access_type', 'offline') // required to get a refresh_token
  authUrl.searchParams.set('prompt', 'consent')       // forces refresh_token on repeat logins too
  authUrl.searchParams.set('state', state)

  return Response.redirect(authUrl.toString(), 302)
}
