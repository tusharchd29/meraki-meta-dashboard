// Parses Google Ads Manager "Campaign report" exports.
//
// Verified against a real export. Notable characteristics that make naive
// CSV parsing fail:
//   - UTF-16LE encoded with a BOM (not UTF-8)
//   - Tab-delimited despite the .csv extension
//   - Line 1 is a report title, line 2 is the date range, line 3 is the header
//   - Contains NO account name or customer id — you export from inside one
//     account, so the client has to be chosen at import time
//   - No per-day breakdown; the whole file is one date-range aggregate
//   - Several "Total: ..." rows at the end. "Total: Account" is the true
//     account figure and can EXCEED "Total: Campaigns", which only covers the
//     campaign rows actually listed.
//   - Numbers may be quoted with thousands separators ("1,575"), and empty
//     values appear as " --"

const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12,
}

// Google exports UTF-16LE with a BOM. Decoding as UTF-8 yields text riddled
// with null bytes, so sniff the BOM and decode accordingly.
export function decodeExport(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder('utf-8').decode(bytes)
}

function splitLine(line, delimiter = '\t') {
  const out = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function num(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '' || s === '--' || s === '- -') return null
  const cleaned = s.replace(/[^\d.\-]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// "27 June 2026 - 24 July 2026"  ->  { start, end }
export function parseDateRange(line) {
  if (!line) return null
  const parts = line.split(/\s+[-–]\s+/)
  if (parts.length !== 2) return null

  const one = (s) => {
    const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
    if (!m) return null
    const month = MONTHS[m[2].toLowerCase()]
    if (!month) return null
    return `${m[3]}-${String(month).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`
  }
  const start = one(parts[0]), end = one(parts[1])
  if (!start || !end) return null
  return { start, end }
}

// Day cells are usually ISO (2026-07-24). Refuse ambiguous DD/MM vs MM/DD
// rather than guessing and being silently wrong for half the year.
function parseDay(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`
  }
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, a, b, y] = slash
    if (parseInt(a) > 12) return `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`
    if (parseInt(b) > 12) return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`
    return null
  }
  return null
}

export function parseGoogleAdsExport(text) {
  const warnings = []
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 3) return { error: 'File has too few lines to be a Google Ads report.' }

  const reportTitle = lines[0].trim()
  const dateRange = parseDateRange(lines[1])
  if (!dateRange) {
    warnings.push(`Couldn't read the date range from line 2 ("${lines[1]?.slice(0,60)}"). You'll need to set the period manually.`)
  }

  // Locate the header row (contains a Cost column)
  let headerIdx = -1, cols = []
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const cells = splitLine(lines[i])
    if (cells.some(c => c.toLowerCase() === 'cost')) { headerIdx = i; cols = cells; break }
  }
  if (headerIdx === -1) return { error: 'Could not find a header row containing a "Cost" column.' }

  const idx = (name) => cols.findIndex(c => c.toLowerCase() === name.toLowerCase())
  // Column names vary between report types and locales, so match loosely as
  // a fallback rather than failing when a label differs slightly.
  const idxLoose = (...names) => {
    for (const n of names) {
      const exact = idx(n)
      if (exact !== -1) return exact
    }
    for (const n of names) {
      const i = cols.findIndex(c => c.toLowerCase().includes(n.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }
  const I = {
    day: idxLoose('Day', 'Date'),
    status: idxLoose('Campaign status', 'Status'),
    campaign: idxLoose('Campaign'),
    budget: idxLoose('Budget'),
    budgetType: idxLoose('Budget type'),
    currency: idxLoose('Currency code', 'Currency'),
    campaignType: idxLoose('Campaign type'),
    impressions: idxLoose('Impr.', 'Impressions'),
    clicks: idxLoose('Clicks'),
    ctr: idxLoose('CTR'),
    cost: idxLoose('Cost', 'Spend'),
    conversions: idxLoose('Conversions', 'Conv.'),
  }

  // If the export is segmented by Day, we can build true daily rows — which
  // is the only way to derive month-to-date from an arbitrary export range.
  const isDaily = I.day !== -1

  const campaigns = []
  const totals = {}
  const dailyMap = new Map()
  let unparsedDays = 0
  let currency = null

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    if (cells.length < 3) continue
    const first = (cells[0] || '').trim()

    if (I.currency !== -1 && cells[I.currency] && !currency) currency = cells[I.currency]

    if (first.toLowerCase().startsWith('total:')) {
      const label = first.slice(6).trim()
      totals[label] = {
        cost: num(cells[I.cost]),
        impressions: num(cells[I.impressions]),
        clicks: num(cells[I.clicks]),
        conversions: num(cells[I.conversions]),
      }
      continue
    }

    const cost = num(cells[I.cost])

    if (isDaily) {
      const d = parseDay(cells[I.day])
      if (d) {
        const cur = dailyMap.get(d) || { spend_date: d, cost: 0, impressions: 0, clicks: 0, conversions: 0 }
        cur.cost += cost || 0
        cur.impressions += num(cells[I.impressions]) || 0
        cur.clicks += num(cells[I.clicks]) || 0
        cur.conversions += num(cells[I.conversions]) || 0
        dailyMap.set(d, cur)
      } else {
        unparsedDays++
      }
    }

    const name = I.campaign !== -1 ? cells[I.campaign] : null
    if (!name) continue

    campaigns.push({
      campaign_name: name,
      campaign_status: I.status !== -1 ? cells[I.status] : null,
      campaign_type: I.campaignType !== -1 ? cells[I.campaignType] : null,
      budget: num(cells[I.budget]),
      budget_type: I.budgetType !== -1 ? cells[I.budgetType] : null,
      cost: cost || 0,
      impressions: num(cells[I.impressions]),
      clicks: num(cells[I.clicks]),
      conversions: num(cells[I.conversions]),
      ctr: I.ctr !== -1 ? cells[I.ctr] : null,
      currency: I.currency !== -1 ? cells[I.currency] : null,
    })
  }

  // "Total: Account" is the authoritative account figure. "Total: Campaigns"
  // only covers the campaign rows present in the export, which may be a
  // filtered or paginated subset — using it as the account total would
  // under-report spend.
  const accountTotal = totals['Account']?.cost ?? null
  const campaignsTotal = totals['Campaigns']?.cost ?? campaigns.reduce((s,c)=>s+(c.cost||0),0)

  if (accountTotal == null) {
    warnings.push('No "Total: Account" row found — falling back to the sum of listed campaigns, which may under-report if the export was filtered.')
  } else if (campaignsTotal != null && accountTotal > campaignsTotal * 1.01) {
    warnings.push(`Account total (${accountTotal.toFixed(2)}) exceeds the listed campaigns total (${campaignsTotal.toFixed(2)}) — the export doesn't list every campaign. The account total is used for billing.`)
  }

  if (!isDaily) {
    warnings.push('This export has no Day column, so it is a single date-range total. Month-to-date figures cannot be derived from it — add a "Day" segment to the report for accurate monthly pacing.')
  } else if (unparsedDays > 0) {
    warnings.push(`${unparsedDays} row(s) had an unreadable or ambiguous date and were skipped.`)
  }

  const activeCampaigns = campaigns.filter(c => (c.campaign_status||'').toLowerCase() === 'enabled').length

  return {
    reportTitle,
    dateRange,
    currency,
    campaigns,
    totals,
    account_cost: accountTotal ?? campaignsTotal,
    campaigns_cost: campaignsTotal,
    impressions: totals['Account']?.impressions ?? null,
    clicks: totals['Account']?.clicks ?? null,
    conversions: totals['Account']?.conversions ?? null,
    active_campaigns: activeCampaigns,
    total_campaigns: campaigns.length,
    is_daily: isDaily,
    daily: [...dailyMap.values()].sort((a,b)=>a.spend_date.localeCompare(b.spend_date)),
    warnings,
  }
}
