// Separate login path for the organic Social Reports feature. Kept apart
// from /api/auth/meta/login (the ads OAuth flow) deliberately: someone
// connecting an ad account should never get a surprise Page/Instagram
// permission prompt, and existing ad-account connections shouldn't be
// forced to re-auth just because this feature shipped later.
//
// Same META_APP_ID / META_APP_SECRET as the ads flow — this is one Meta
// App with two separate, scope-limited entry points into it, not two apps.

export async function GET(request) {
  const appId = process.env.META_APP_ID
  if (!appId) {
    return Response.json({ error: 'META_APP_ID not configured' }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/auth/meta-social/callback`

  const { searchParams } = new URL(request.url)
  const connectedBy = searchParams.get('by') || ''
  const returnTo = searchParams.get('return_to') || '/'

  const state = Buffer.from(JSON.stringify({ connectedBy, returnTo })).toString('base64url')

  const authUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')

  // READ-ONLY, organic-reporting only. No ads_*, no *_manage_posts, no
  // instagram_content_publish — this token cannot touch ad accounts or
  // post/edit anything on any connected Page or Instagram account.
  authUrl.searchParams.set(
    'scope',
    [
      'pages_show_list',
      'pages_read_engagement',
      'read_insights',
      'instagram_basic',
      'instagram_manage_insights',
    ].join(',')
  )

  return Response.redirect(authUrl.toString(), 302)
}
