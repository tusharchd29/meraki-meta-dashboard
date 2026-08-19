const GRAPH = 'https://graph.facebook.com/v22.0'

// Same paging helper as meraki-meta-dashboard/lib/discoverMetaAccounts.js —
// kept local (not imported cross-repo) so this app has zero dependency on
// the ads dashboard and can be deployed/rotated independently.
async function fetchAllPages(url, token, cap = 500) {
  const out = []
  let next = `${url}${url.includes('?') ? '&' : '?'}limit=100&access_token=${token}`
  while (next && out.length < cap) {
    const res = await fetch(next)
    const json = await res.json()
    if (json.error) {
      return { data: out, error: json.error.message }
    }
    out.push(...(json.data || []))
    next = json.paging?.next || null
  }
  return { data: out }
}

// Every Facebook Page this token administers, each enriched with its linked
// Instagram Business Account (if any) — the report needs both, since Page
// Insights and IG Insights are separate Graph API surfaces even though
// they're presented as one report.
//
// Each returned Page gets its own PAGE ACCESS TOKEN (not the user token) —
// Insights calls on both /page-id/insights and /ig-id/insights require the
// page token, not the user token that authorized the login.
export async function discoverMetaPages(userAccessToken) {
  const warnings = []

  const pages = await fetchAllPages(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}`,
    userAccessToken
  )
  if (pages.error) warnings.push(`me/accounts: ${pages.error}`)

  const result = pages.data.map((p) => ({
    page_id: p.id,
    page_name: p.name || null,
    page_access_token: p.access_token, // long-lived if the user token was long-lived
    ig_user_id: p.instagram_business_account?.id || null,
    ig_username: p.instagram_business_account?.username || null,
    ig_profile_picture_url: p.instagram_business_account?.profile_picture_url || null,
  }))

  return { pages: result, warnings }
}
