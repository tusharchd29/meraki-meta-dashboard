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

  const scope = ['ads_read', 'ads_management', 'business_management'].join(',')

  const authUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')

  return Response.redirect(authUrl.toString(), 302)
}
