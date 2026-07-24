import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { discoverMetaAdAccounts } from '@/lib/discoverMetaAccounts'

export const dynamic = 'force-dynamic'

// Re-runs account discovery for an existing Meta connection. Use this when a
// portfolio gains new ad accounts, or when partner access is granted after
// the login was first connected — no need to disconnect and reconnect.
// Existing is_tracked / monthly_budget values are preserved: upsert only
// writes the discovery fields.
export async function POST(request) {
  try {
    const { connectionId } = await request.json()
    if (!connectionId) return Response.json({ error: 'missing connectionId' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: conn, error: connErr } = await db
      .from('meraki_ad_connections')
      .select('id, access_token, is_active')
      .eq('id', connectionId)
      .eq('platform', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (connErr) return Response.json({ error: connErr.message }, { status: 500 })
    if (!conn?.access_token) return Response.json({ error: 'No active Meta connection found' }, { status: 404 })

    const discovery = await discoverMetaAdAccounts(conn.access_token)

    if (discovery.accounts.length > 0) {
      const rows = discovery.accounts.map(a => ({
        connection_id: conn.id,
        platform: 'meta',
        account_id: a.account_id,
        account_name: a.account_name,
        currency: a.currency,
        business_id: a.business_id,
        business_name: a.business_name,
        access_type: a.access_type,
        synced_at: new Date().toISOString(),
      }))
      const { error: upErr } = await db
        .from('meraki_ad_accounts')
        .upsert(rows, { onConflict: 'platform,account_id' })
      if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
    }

    return Response.json({
      synced: discovery.accounts.length,
      portfolios: discovery.businessCount,
      warnings: discovery.warnings,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
