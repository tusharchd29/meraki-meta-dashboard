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

    // Resolve real client names — periods/campaigns only store client_id.
    // Without this, the UI has nothing to show but the uploaded filename.
    const clientIds = [...new Set((periods || []).map(p => p.client_id))]
    const nameById = {}
    if (clientIds.length > 0) {
      const { data: clients } = await db
        .from('meraki_clients')
        .select('id, name')
        .in('id', clientIds)
      for (const c of clients || []) nameById[c.id] = c.name
    }

    // Label every period with its client name up front (not just the latest
    // one) — the import-history list needs to group/display all of them.
    for (const p of periods || []) {
      p.client_name = nameById[p.client_id] || null
    }

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

    // Daily data, when available, is authoritative — it's the only source
    // that can be sliced to the current month regardless of export ranges.
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]
    const monday = new Date(now)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const mondayStr = monday.toISOString().split('T')[0]

    const { data: daily } = await db
      .from('meraki_google_spend_daily')
      .select('client_id, spend_date, cost, currency')
      .gte('spend_date', monthStart)

    const mtd = {}
    for (const r of daily || []) {
      const m = mtd[r.client_id] ||= { month: 0, week: 0, today: 0, currency: r.currency, latest: null }
      const cost = Number(r.cost) || 0
      m.month += cost
      if (r.spend_date >= mondayStr) m.week += cost
      if (r.spend_date === today) m.today += cost
      if (!m.latest || r.spend_date > m.latest) m.latest = r.spend_date
    }

    return Response.json({ latest, mtd, all_periods: periods || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
