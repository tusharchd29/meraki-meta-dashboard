import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parseGoogleAdsExport } from '@/lib/parseGoogleAdsExport'

export const dynamic = 'force-dynamic'

// The export carries no account identifier, so the client is chosen at import
// time and passed in as clientId. Re-importing the same client+period
// overwrites, so uploading a corrected or extended export is safe.
export async function POST(request) {
  try {
    const { fileText, filename, clientId, preview = true, periodStart, periodEnd } = await request.json()
    if (!fileText) return Response.json({ error: 'no file content' }, { status: 400 })

    const parsed = parseGoogleAdsExport(fileText)
    if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 })

    const start = periodStart || parsed.dateRange?.start
    const end = periodEnd || parsed.dateRange?.end

    const summary = {
      reportTitle: parsed.reportTitle,
      period_start: start,
      period_end: end,
      currency: parsed.currency,
      account_cost: parsed.account_cost,
      campaigns_cost: parsed.campaigns_cost,
      impressions: parsed.impressions,
      clicks: parsed.clicks,
      conversions: parsed.conversions,
      active_campaigns: parsed.active_campaigns,
      total_campaigns: parsed.total_campaigns,
      campaigns: parsed.campaigns,
      is_daily: parsed.is_daily,
      daily_rows: parsed.daily?.length || 0,
      warnings: parsed.warnings,
    }

    if (preview) return Response.json({ preview: true, ...summary })

    if (!clientId) return Response.json({ error: 'Select which client this export belongs to.' }, { status: 400 })
    if (!start || !end) return Response.json({ error: 'Period start/end could not be determined — set them manually.' }, { status: 400 })

    const db = supabaseAdmin()

    const { error: pErr } = await db.from('meraki_google_spend_periods').upsert({
      client_id: clientId,
      period_start: start,
      period_end: end,
      account_cost: parsed.account_cost,
      campaigns_cost: parsed.campaigns_cost,
      impressions: parsed.impressions,
      clicks: parsed.clicks,
      conversions: parsed.conversions,
      currency: parsed.currency,
      source_file: filename || null,
      imported_at: new Date().toISOString(),
    }, { onConflict: 'client_id,period_start,period_end' })
    if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

    // Daily rows are the accurate path: keyed (client, date) so overlapping
    // exports correct each other instead of double-counting.
    if (parsed.is_daily && parsed.daily?.length > 0) {
      const dailyRows = parsed.daily.map(d => ({
        client_id: clientId,
        spend_date: d.spend_date,
        cost: d.cost || 0,
        impressions: d.impressions || null,
        clicks: d.clicks || null,
        conversions: d.conversions || null,
        currency: parsed.currency || null,
        source_file: filename || null,
        imported_at: new Date().toISOString(),
      }))
      const { error: dErr } = await db.from('meraki_google_spend_daily')
        .upsert(dailyRows, { onConflict: 'client_id,spend_date' })
      if (dErr) return Response.json({ error: dErr.message }, { status: 500 })
    }

    if (parsed.campaigns.length > 0) {
      const rows = parsed.campaigns.map(c => ({
        client_id: clientId,
        period_start: start,
        period_end: end,
        campaign_name: c.campaign_name,
        campaign_status: c.campaign_status,
        campaign_type: c.campaign_type,
        budget: c.budget,
        budget_type: c.budget_type,
        cost: c.cost,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        ctr: c.ctr,
        currency: c.currency,
        imported_at: new Date().toISOString(),
      }))
      const { error: cErr } = await db.from('meraki_google_campaigns')
        .upsert(rows, { onConflict: 'client_id,period_start,period_end,campaign_name' })
      if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
    }

    return Response.json({ imported: true, ...summary })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// Remove previously-imported Google Ads data for a client.
// Two modes, both via query params (matches the report-recipients DELETE convention):
//   ?clientId=X&all=true                      -> wipes every import for that client
//   ?clientId=X&periodStart=Y&periodEnd=Z      -> wipes only that date range (used for
//                                                 both single-import delete and "delete
//                                                 this merged range" from the history UI)
// Deletes across all three tables so periods/daily/campaigns never go out of sync.
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const all = searchParams.get('all') === 'true'
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')

    if (!clientId) return Response.json({ error: 'missing clientId' }, { status: 400 })
    if (!all && (!periodStart || !periodEnd)) {
      return Response.json({ error: 'provide periodStart+periodEnd, or all=true' }, { status: 400 })
    }

    const db = supabaseAdmin()

    let periodsQ = db.from('meraki_google_spend_periods').delete().eq('client_id', clientId)
    let dailyQ = db.from('meraki_google_spend_daily').delete().eq('client_id', clientId)
    let campaignsQ = db.from('meraki_google_campaigns').delete().eq('client_id', clientId)

    if (!all) {
      // Periods/campaigns are matched by range containment (covers exact-match
      // single-import deletes and multi-import "delete this merged range" alike).
      periodsQ = periodsQ.gte('period_start', periodStart).lte('period_end', periodEnd)
      campaignsQ = campaignsQ.gte('period_start', periodStart).lte('period_end', periodEnd)
      // Daily rows are matched by date, since they're keyed per-day not per-period.
      dailyQ = dailyQ.gte('spend_date', periodStart).lte('spend_date', periodEnd)
    }

    const [pRes, dRes, cRes] = await Promise.all([periodsQ, dailyQ, campaignsQ])
    const err = pRes.error || dRes.error || cRes.error
    if (err) return Response.json({ error: err.message }, { status: 500 })

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
