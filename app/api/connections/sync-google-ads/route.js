import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { refreshGoogleAccessToken } from '@/lib/googleAdsToken'

// Called from the Connections panel's "Sync accounts" button for a
// google_ads connection. Requires GOOGLE_ADS_DEVELOPER_TOKEN — until that's
// set this returns a clear error instead of a confusing API failure.
//
// Walks the FULL account tree below the top-level MCC (GOOGLE_ADS_LOGIN_CUSTOMER_ID)
// in a single GAQL query against the `customer_client` resource, rather than
// listAccessibleCustomers. Why this matters: listAccessibleCustomers only
// returns accounts the *logged-in user* has a direct link to, and doesn't
// tell you which of those are themselves manager (sub-MCC) accounts vs.
// actual client ad accounts — so a manager-of-managers setup would silently
// miss every account nested under a sub-manager. customer_client returns
// every descendant at every depth in one call, tagged with `level` (hops
// from the top MCC) and `manager` (true/false), so we can flatten the whole
// hierarchy and only track the real (non-manager) leaf accounts.
export async function POST(request) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    return Response.json(
      { error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured yet — apply for one in Google Ads API Center, then set it in Vercel env vars and retry.' },
      { status: 400 }
    )
  }

  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, '')
  if (!loginCustomerId) {
    return Response.json(
      { error: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID not configured yet — set your top-level Google Ads Manager (MCC) id in Vercel env vars and retry.' },
      { status: 400 }
    )
  }

  const { connectionId } = await request.json()
  if (!connectionId) return Response.json({ error: 'missing connectionId' }, { status: 400 })

  const db = supabaseAdmin()

  const { data: conn, error: connErr } = await db
    .from('meraki_ad_connections')
    .select('id, refresh_token, platform')
    .eq('id', connectionId)
    .eq('platform', 'google_ads')
    .maybeSingle()

  if (connErr) return Response.json({ error: connErr.message }, { status: 500 })
  if (!conn) return Response.json({ error: 'connection not found' }, { status: 404 })

  try {
    const { accessToken, expiresAt } = await refreshGoogleAccessToken(conn.refresh_token)

    // Keep the freshly minted access token around too, harmless if unused elsewhere
    await db
      .from('meraki_ad_connections')
      .update({ access_token: accessToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', connectionId)

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'login-customer-id': loginCustomerId,
      'Content-Type': 'application/json',
    }

    // level <= 10 is generous headroom — real MCC trees are rarely more than
    // 2-3 levels deep, this just guards against an unexpectedly deep tree
    // getting silently truncated by a default.
    const hierarchyQuery = `
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.manager,
        customer_client.level,
        customer_client.status
      FROM customer_client
      WHERE customer_client.level <= 10
    `.trim()

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${loginCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: hierarchyQuery }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || data?.[0]?.error?.message || 'customer_client hierarchy query failed'
      return Response.json({ error: msg }, { status: 500 })
    }

    // searchStream can come back as either a single object or an array of
    // response chunks depending on result size — normalize both shapes.
    const rows = (Array.isArray(data) ? data : [data]).flatMap((chunk) => chunk.results || [])

    // level 0 is the top MCC's own self-row — skip it. Skip manager rows
    // too (sub-MCCs show up as their own row with manager: true); only
    // ENABLED, non-manager accounts are actual client ad accounts worth
    // tracking and querying for campaign data.
    const clientRows = rows.filter((r) => {
      const cc = r.customerClient || {}
      return Number(cc.level) > 0 && cc.manager !== true && cc.status === 'ENABLED'
    })
    const managerCount = rows.filter((r) => {
      const cc = r.customerClient || {}
      return Number(cc.level) > 0 && cc.manager === true
    }).length

    if (clientRows.length > 0) {
      const upsertRows = clientRows.map((r) => {
        const cc = r.customerClient
        return {
          connection_id: connectionId,
          platform: 'google_ads',
          account_id: String(cc.id),
          account_name: cc.descriptiveName || null,
          currency: cc.currencyCode || null,
          synced_at: new Date().toISOString(),
        }
      })
      const { error: acctErr } = await db
        .from('meraki_ad_accounts')
        .upsert(upsertRows, { onConflict: 'platform,account_id' })
      if (acctErr) return Response.json({ error: acctErr.message }, { status: 500 })
    }

    return Response.json({
      synced: clientRows.length,
      managerAccountsSkipped: managerCount,
      customerIds: clientRows.map((r) => String(r.customerClient.id)),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
