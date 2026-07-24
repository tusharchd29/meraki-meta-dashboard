import { getActiveClients } from '@/lib/getActiveClients'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Tests the full chain server-side in one request:
//   1. Does /api/clients return the tracked accounts?
//   2. Does token resolution find a live token for one of them?
//   3. Does a real Meta API call succeed with that token?
// Returns no secrets — tokens are reported only as present/absent + length.

export async function GET() {
  const out = { step1_clients: null, step2_token: null, step3_meta_call: null }

  // Step 1 — the client list the dashboard renders from
  try {
    const clients = await getActiveClients()
    out.step1_clients = {
      ok: true,
      count: clients.length,
      sample: clients.slice(0, 5).map(c => ({ key: c.key, name: c.name, accountId: c.accountId, currency: c.currency, monthlyBudget: c.monthlyBudget })),
    }
    if (clients.length === 0) {
      out.step1_clients.hint = 'No tracked accounts returned — dashboard would render empty.'
      return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Step 2 — token resolution for the first tracked account
    const first = clients[0]
    const accountId = `act_${first.accountId}`
    const db = supabaseAdmin()
    const { data: acct, error: acctErr } = await db
      .from('meraki_ad_accounts')
      .select('connection_id')
      .eq('platform', 'meta')
      .eq('account_id', accountId)
      .eq('is_tracked', true)
      .maybeSingle()

    if (acctErr || !acct?.connection_id) {
      out.step2_token = { ok: false, accountId, error: acctErr?.message || 'no connection_id found for this account' }
      return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
    }

    const { data: conn, error: connErr } = await db
      .from('meraki_ad_connections')
      .select('access_token, is_active, token_expires_at')
      .eq('id', acct.connection_id)
      .eq('is_active', true)
      .maybeSingle()

    if (connErr || !conn?.access_token) {
      out.step2_token = { ok: false, accountId, error: connErr?.message || 'no active connection / no token' }
      return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
    }

    out.step2_token = {
      ok: true,
      accountId,
      token_present: true,
      token_length: conn.access_token.length,
      expires_at: conn.token_expires_at,
    }

    // Step 3 — a real call to Meta with that token
    const metaUrl = `https://graph.facebook.com/v22.0/${accountId}/insights?fields=spend,impressions&date_preset=this_month&access_token=${conn.access_token}`
    const res = await fetch(metaUrl, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    out.step3_meta_call = {
      ok: res.ok && !data.error,
      http_status: res.status,
      meta_error: data.error ? { message: data.error.message, type: data.error.type, code: data.error.code } : null,
      data_returned: data.data || null,
    }
  } catch (e) {
    out.fatal = e.message
  }

  return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
