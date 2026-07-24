import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { refreshGoogleAccessToken } from '@/lib/googleAdsToken'

// Called from the Connections panel's "Sync accounts" button for a
// google_ads connection. Requires GOOGLE_ADS_DEVELOPER_TOKEN — until that's
// set this returns a clear error instead of a confusing API failure.

export async function POST(request) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    return Response.json(
      { error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured yet — apply for one in Google Ads API Center, then set it in Vercel env vars and retry.' },
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

    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, '')
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    }
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId

    const res = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
      headers,
    })
    const data = await res.json()
    if (!res.ok) {
      return Response.json({ error: data?.error?.message || 'listAccessibleCustomers failed' }, { status: 500 })
    }

    // resourceNames look like "customers/1234567890"
    const customerIds = (data.resourceNames || []).map((rn) => rn.split('/')[1])

    if (customerIds.length > 0) {
      const rows = customerIds.map((id) => ({
        connection_id: connectionId,
        platform: 'google_ads',
        account_id: id,
        account_name: null, // customer name requires a separate GAQL query; left for a later pass
        synced_at: new Date().toISOString(),
      }))
      const { error: acctErr } = await db
        .from('meraki_ad_accounts')
        .upsert(rows, { onConflict: 'platform,account_id' })
      if (acctErr) return Response.json({ error: acctErr.message }, { status: 500 })
    }

    return Response.json({ synced: customerIds.length, customerIds })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
