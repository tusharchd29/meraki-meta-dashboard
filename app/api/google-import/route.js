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
