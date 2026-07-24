import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { refreshGoogleAccessToken } from '@/lib/googleAdsToken'

// READ-ONLY. Google Ads mutations go through separate *:mutate endpoints
// which this proxy never calls — it only ever hits googleAds:searchStream.
// The validation below is defence in depth on top of that: the query must
// be a bare SELECT against an allowlisted resource, with no statement
// chaining and no mutation keywords anywhere in it.
const ALLOWED_FROM = ['campaign', 'customer', 'campaign_budget', 'ad_group', 'ad_group_ad']
const FORBIDDEN_KEYWORDS = [
  'MUTATE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'REMOVE', 'GRANT', 'REVOKE', 'EXEC',
]

function isAllowedQuery(query) {
  if (typeof query !== 'string') return false
  const q = query.trim().toUpperCase()

  if (!q.startsWith('SELECT')) return false
  // No statement chaining — a single SELECT only
  if (q.includes(';')) return false
  // No mutation verbs anywhere, even in a subclause
  if (FORBIDDEN_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`).test(q))) return false

  // Must target an allowlisted resource
  const fromMatch = q.match(/\bFROM\s+([A-Z_]+)/)
  if (!fromMatch) return false
  return ALLOWED_FROM.includes(fromMatch[1].toLowerCase())
}

export async function POST(request) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    return Response.json(
      { error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured yet — apply for one in Google Ads API Center.' },
      { status: 400 }
    )
  }

  const { customerId, query } = await request.json()
  if (!customerId || !query) return Response.json({ error: 'missing customerId/query' }, { status: 400 })

  if (!isAllowedQuery(query)) {
    return Response.json({ error: 'Query not permitted. This proxy only allows read-only SELECT queries against campaign/customer.' }, { status: 403 })
  }

  const db = supabaseAdmin()

  // Find which connection owns this tracked customer account
  const { data: acct, error: acctErr } = await db
    .from('meraki_ad_accounts')
    .select('connection_id')
    .eq('platform', 'google_ads')
    .eq('account_id', customerId)
    .eq('is_tracked', true)
    .maybeSingle()

  if (acctErr) return Response.json({ error: acctErr.message }, { status: 500 })
  if (!acct?.connection_id) {
    return Response.json({ error: 'Account not tracked or not connected. Check it in the Connections panel.' }, { status: 404 })
  }

  const { data: conn, error: connErr } = await db
    .from('meraki_ad_connections')
    .select('refresh_token, is_active')
    .eq('id', acct.connection_id)
    .eq('is_active', true)
    .maybeSingle()

  if (connErr) return Response.json({ error: connErr.message }, { status: 500 })
  if (!conn?.refresh_token) {
    return Response.json({ error: 'No active connection for this account. Reconnect it from the Connections panel.' }, { status: 404 })
  }

  try {
    // Google access tokens are short-lived — mint a fresh one for every call
    // rather than trusting a possibly-stale stored one.
    const { accessToken, expiresAt } = await refreshGoogleAccessToken(conn.refresh_token)
    await db
      .from('meraki_ad_connections')
      .update({ access_token: accessToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', acct.connection_id)

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      const message = Array.isArray(data) ? data[0]?.error?.message : data?.error?.message
      return Response.json({ error: message || 'Google Ads API request failed' }, { status: 500 })
    }

    // searchStream returns an array of batches, each with a `results` array
    const results = (Array.isArray(data) ? data : [data]).flatMap(batch => batch.results || [])
    return Response.json({ results })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
