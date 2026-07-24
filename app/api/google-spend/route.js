import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Aggregated Google Ads spend from imported exports, since live API access
// isn't available. Returns today / this-week / this-month totals per
// customer id, matching the shape the dashboard already uses for Meta.
export async function GET() {
  try {
    const db = supabaseAdmin()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    const { data, error } = await db
      .from('meraki_google_spend_daily')
      .select('customer_id, account_name, spend_date, cost, currency')
      .gte('spend_date', monthStart)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const today = now.toISOString().split('T')[0]
    const monday = new Date(now)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const mondayStr = monday.toISOString().split('T')[0]

    const byCustomer = {}
    let latestDate = null
    for (const r of data || []) {
      if (!byCustomer[r.customer_id]) {
        byCustomer[r.customer_id] = {
          customer_id: r.customer_id, account_name: r.account_name,
          today: 0, week: 0, month: 0, currency: r.currency || null,
        }
      }
      const c = byCustomer[r.customer_id]
      const cost = Number(r.cost) || 0
      c.month += cost
      if (r.spend_date === today) c.today += cost
      if (r.spend_date >= mondayStr) c.week += cost
      if (!latestDate || r.spend_date > latestDate) latestDate = r.spend_date
    }

    return Response.json({
      spend: byCustomer,
      // How current the imported data is — important, since this is manual
      latest_date: latestDate,
      stale_days: latestDate
        ? Math.floor((new Date(today) - new Date(latestDate)) / 86400000)
        : null,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
