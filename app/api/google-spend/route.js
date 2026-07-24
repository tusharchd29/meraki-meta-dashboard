import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Latest imported period per client, plus its campaigns. Because exports are
// date-range aggregates rather than daily data, we report the period as-is
// rather than pretending we can split it into today/this-week.
export async function GET() {
  try {
    const db = supabaseAdmin()
    const { data: periods, error } = await db
      .from('meraki_google_spend_periods')
      .select('*')
      .order('period_end', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const { data: campaigns, error: cErr } = await db
      .from('meraki_google_campaigns')
      .select('client_id, period_start, period_end, campaign_name, campaign_status, campaign_type, cost, impressions, clicks, conversions, currency')
      .order('cost', { ascending: false })
    if (cErr) return Response.json({ error: cErr.message }, { status: 500 })

    // Most recent period per client
    const latest = {}
    for (const p of periods || []) {
      if (!latest[p.client_id]) latest[p.client_id] = p
    }
    for (const id of Object.keys(latest)) {
      const p = latest[id]
      p.campaigns = (campaigns || []).filter(c =>
        c.client_id === id && c.period_start === p.period_start && c.period_end === p.period_end)
      p.active_campaigns = p.campaigns.filter(c => (c.campaign_status||'').toLowerCase()==='enabled').length
      p.stale_days = Math.floor((new Date() - new Date(p.period_end)) / 86400000)
    }

    return Response.json({ latest, all_periods: periods || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
