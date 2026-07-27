import { getSheetsClient } from './googleSheetsClient.js'

// Reads the two tabs a Meraki Ads Google Ads Manager Script writes
// (see google-ads-script/meraki-sync.gs for the script itself) and feeds
// them into the SAME tables a manual CSV import already writes to. This is
// deliberate: every downstream system (MTD pacing in the report, the
// Google Ads account cards, Billing & Pacing) already handles that data
// shape correctly — this is just a second, automatic way to fill it, not a
// new code path that needs its own correctness story.
//
// Daily tab -> meraki_google_spend_daily (true daily granularity — this is
//   exactly the 'Day column' format the report's month-to-date pacing
//   already prefers over period-aggregate imports).
// Campaigns tab -> meraki_google_campaigns, as a month-to-date snapshot
//   that's fully replaced each sync (it's a point-in-time view, not a
//   historical record — same idea as re-uploading a fresh CSV covering
//   1st-of-month through today).
export async function syncGoogleAdsSheet(sheetId, db) {
  const sheets = await getSheetsClient()

  const { data: clients, error: clientsErr } = await db
    .from('meraki_clients')
    .select('id, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null)
  if (clientsErr) throw new Error(`clients: ${clientsErr.message}`)
  const clientByAccountId = Object.fromEntries(clients.map(c => [String(c.google_ads_customer_id), c.id]))

  const unmapped = new Set()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // ── Daily tab ──────────────────────────────────────────────────────────
  const dailyResp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Daily!A2:I100000' })
  const dailyByClient = {}
  for (const row of (dailyResp.data.values || [])) {
    const [accountId, , date, cost, impressions, clicks, conversions, currency] = row
    if (!accountId || !date) continue
    const clientId = clientByAccountId[String(accountId)]
    if (!clientId) { unmapped.add(String(accountId)); continue }
    ;(dailyByClient[clientId] ||= []).push({
      client_id: clientId,
      spend_date: date,
      cost: Number(cost) || 0,
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      conversions: conversions !== undefined && conversions !== '' ? Number(conversions) : null,
      currency: currency || 'INR',
      source_file: 'google-ads-script-sync',
    })
  }
  let dailyRowsSynced = 0
  for (const [clientId, rows] of Object.entries(dailyByClient)) {
    // Re-syncing shouldn't duplicate a date already written — replace just
    // the dates present in this batch for this client, not the client's
    // whole history (a sync that only covers 'today' shouldn't touch
    // yesterday's row from a prior run).
    const dates = [...new Set(rows.map(r => r.spend_date))]
    const { error: delErr } = await db.from('meraki_google_spend_daily').delete().eq('client_id', clientId).in('spend_date', dates)
    if (delErr) throw new Error(`daily delete: ${delErr.message}`)
    const { error: insErr } = await db.from('meraki_google_spend_daily').insert(rows)
    if (insErr) throw new Error(`daily insert: ${insErr.message}`)
    dailyRowsSynced += rows.length
  }

  // ── Campaigns tab ─────────────────────────────────────────────────────
  const campResp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Campaigns!A2:J100000' })
  const today = now.toISOString().split('T')[0]
  const campByClient = {}
  for (const row of (campResp.data.values || [])) {
    const [accountId, , currency, campaignName, status, cost, impressions, clicks, conversions] = row
    if (!accountId || !campaignName) continue
    if (campaignName.startsWith('(no campaigns') || campaignName.startsWith('ERROR')) continue
    const clientId = clientByAccountId[String(accountId)]
    if (!clientId) { unmapped.add(String(accountId)); continue }
    ;(campByClient[clientId] ||= []).push({
      client_id: clientId,
      period_start: monthStart,
      period_end: today,
      campaign_name: campaignName,
      campaign_status: status || null,
      cost: Number(cost) || 0,
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      conversions: conversions !== undefined && conversions !== '' ? Number(conversions) : null,
      currency: currency || 'INR',
    })
  }
  let campaignRowsSynced = 0
  for (const [clientId, rows] of Object.entries(campByClient)) {
    const { error: delErr } = await db.from('meraki_google_campaigns').delete().eq('client_id', clientId).eq('period_start', monthStart)
    if (delErr) throw new Error(`campaigns delete: ${delErr.message}`)
    const { error: insErr } = await db.from('meraki_google_campaigns').insert(rows)
    if (insErr) throw new Error(`campaigns insert: ${insErr.message}`)
    campaignRowsSynced += rows.length
  }

  return { dailyRowsSynced, campaignRowsSynced, unmappedAccountIds: [...unmapped] }
}
