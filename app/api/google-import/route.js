import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parseGoogleAdsExport } from '@/lib/parseGoogleAdsExport'

export const dynamic = 'force-dynamic'

// Two-phase import:
//   preview: true  — parse and report what was understood, write nothing
//   preview: false — write to meraki_google_spend_daily
//
// Rows are keyed (customer_id, spend_date), so re-importing overlapping date
// ranges corrects the existing figures rather than double-counting. That
// matters when a weekly export overlaps a previous 3-day one.

export async function POST(request) {
  try {
    const { fileText, filename, preview = true, fallbackDate } = await request.json()
    if (!fileText) return Response.json({ error: 'no file content supplied' }, { status: 400 })

    const parsed = parseGoogleAdsExport(fileText, filename)
    if (parsed.rows.length === 0) {
      return Response.json({ error: 'No usable rows found.', warnings: parsed.warnings, columnMap: parsed.columnMap }, { status: 400 })
    }

    // Rows with no date fall back to a date supplied by the user (e.g. when
    // the export is a date-range total with no per-day breakdown).
    const rows = parsed.rows.map(r => ({ ...r, spend_date: r.spend_date || fallbackDate || null }))
    const datedRows = rows.filter(r => r.spend_date && r.customer_id)
    const unusable = rows.length - datedRows.length

    const dates = datedRows.map(r => r.spend_date).sort()
    const accounts = [...new Set(datedRows.map(r => r.customer_id))]

    const summary = {
      rows_parsed: parsed.rows.length,
      rows_importable: datedRows.length,
      rows_unusable: unusable,
      date_from: dates[0] || null,
      date_to: dates[dates.length - 1] || null,
      accounts_seen: accounts.length,
      columnMap: parsed.columnMap,
      warnings: [
        ...parsed.warnings,
        ...(unusable > 0 ? [`${unusable} row(s) can't be imported: missing a date or a customer id. Supply a date if the export has no day column.`] : []),
      ],
      sample: datedRows.slice(0, 5),
    }

    if (preview) return Response.json({ preview: true, ...summary })

    if (datedRows.length === 0) {
      return Response.json({ error: 'Nothing importable — every row lacks a date or customer id.', ...summary }, { status: 400 })
    }

    const db = supabaseAdmin()

    // Collapse duplicates within the same file (same account+date appearing
    // on multiple campaign rows) by summing them, so a campaign-level export
    // aggregates to account level correctly.
    const byKey = new Map()
    for (const r of datedRows) {
      const key = `${r.customer_id}|${r.spend_date}`
      const existing = byKey.get(key)
      if (existing) {
        existing.cost += r.cost || 0
        existing.impressions = (existing.impressions || 0) + (r.impressions || 0)
        existing.clicks = (existing.clicks || 0) + (r.clicks || 0)
        existing.conversions = (existing.conversions || 0) + (r.conversions || 0)
      } else {
        byKey.set(key, { ...r })
      }
    }

    const toWrite = [...byKey.values()].map(r => ({
      customer_id: r.customer_id,
      account_name: r.account_name,
      spend_date: r.spend_date,
      cost: r.cost || 0,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
      currency: r.currency,
      source_file: filename || null,
      imported_at: new Date().toISOString(),
    }))

    const { error: upErr } = await db
      .from('meraki_google_spend_daily')
      .upsert(toWrite, { onConflict: 'customer_id,spend_date' })
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })

    await db.from('meraki_google_imports').insert({
      filename: filename || null,
      rows_parsed: parsed.rows.length,
      rows_written: toWrite.length,
      date_from: summary.date_from,
      date_to: summary.date_to,
      accounts_seen: summary.accounts_seen,
      warnings: summary.warnings.join(' | ') || null,
    })

    return Response.json({ imported: true, rows_written: toWrite.length, ...summary })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// Recent import history
export async function GET() {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('meraki_google_imports')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(20)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ imports: data || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
