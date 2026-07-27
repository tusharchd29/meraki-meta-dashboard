import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Google campaign data is only ever as fresh as the last manual export
// upload (there's no live API pull like Meta), so this always returns each
// client's most recently IMPORTED period — not "this month" or any other
// live date range. The Campaign Table tags these rows so it's obvious
// they're not real-time.
export async function GET() {
  try {
    const db = supabaseAdmin()

    const { data: clients, error: cErr } = await db
      .from('meraki_clients')
      .select('id, name')
      .not('google_ads_customer_id', 'is', null)
    if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
    if (!clients || clients.length === 0) return Response.json({ campaigns: [] })

    const clientIds = clients.map(c => c.id)
    const nameById = new Map(clients.map(c => [c.id, c.name]))

    const { data: periods, error: pErr } = await db
      .from('meraki_google_spend_periods')
      .select('client_id, period_start, period_end, imported_at')
      .in('client_id', clientIds)
      .order('imported_at', { ascending: false })
    if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

    // First row seen per client_id is the most recently imported, since the
    // query above is already sorted by imported_at descending.
    const latestByClient = new Map()
    for (const p of (periods || [])) {
      if (!latestByClient.has(p.client_id)) latestByClient.set(p.client_id, p)
    }

    const campaigns = []
    for (const [clientId, period] of latestByClient) {
      const { data: camps, error: campErr } = await db
        .from('meraki_google_campaigns')
        .select('campaign_name, campaign_status, campaign_type, budget, budget_type, cost, impressions, clicks, conversions, ctr, currency')
        .eq('client_id', clientId)
        .eq('period_start', period.period_start)
        .eq('period_end', period.period_end)
      if (campErr) continue

      for (const c of (camps || [])) {
        campaigns.push({
          client_id: clientId,
          client_name: nameById.get(clientId) || clientId,
          period_start: period.period_start,
          period_end: period.period_end,
          ...c,
        })
      }
    }

    return Response.json({ campaigns })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
