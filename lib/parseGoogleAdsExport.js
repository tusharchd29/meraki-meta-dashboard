// Parses Google Ads Manager CSV/TSV exports.
//
// These exports vary a lot: report title and date-range rows before the
// header, localised column names, totals rows at the bottom, numbers with
// thousands separators or currency symbols. This parser is deliberately
// forgiving and reports what it couldn't understand rather than failing
// silently or guessing.

// Column aliases, lowercased. First match wins.
const COLUMN_ALIASES = {
  customer_id: ['customer id', 'account id', 'customer', 'account number', 'cid'],
  account_name: ['account name', 'account', 'descriptive name'],
  spend_date: ['day', 'date', 'week', 'month'],
  cost: ['cost', 'spend', 'amount spent', 'total cost'],
  impressions: ['impr.', 'impressions', 'impr'],
  clicks: ['clicks', 'click'],
  conversions: ['conversions', 'conv.', 'conversion'],
  currency: ['currency code', 'currency'],
}

function splitLine(line, delimiter) {
  // Handles quoted fields containing the delimiter
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim().replace(/^"|"$/g, ''))
}

function detectDelimiter(sample) {
  const tab = (sample.match(/\t/g) || []).length
  const comma = (sample.match(/,/g) || []).length
  return tab > comma ? '\t' : ','
}

function matchColumns(headerCells) {
  const lower = headerCells.map(h => h.toLowerCase().trim())
  const map = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = lower.findIndex(h => h === alias)
      if (idx !== -1) { map[field] = idx; break }
    }
    // fall back to a contains-match if no exact hit
    if (map[field] === undefined) {
      for (const alias of aliases) {
        const idx = lower.findIndex(h => h.includes(alias))
        if (idx !== -1) { map[field] = idx; break }
      }
    }
  }
  return map
}

function parseNumber(raw) {
  if (raw == null) return null
  // Strip currency symbols, spaces, thousands separators
  const cleaned = String(raw).replace(/[^\d.,\-]/g, '').replace(/,/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  // ISO first — Google's "Day" column is usually YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or MM/DD/YYYY — ambiguous, so only accept unambiguous cases
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, a, b, y] = slash
    // If one part is >12 it must be the day
    if (parseInt(a) > 12) return `${y}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`
    if (parseInt(b) > 12) return `${y}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`
    return null // genuinely ambiguous — don't guess
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

export function parseGoogleAdsExport(text, filename = '') {
  const warnings = []
  const rawLines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (rawLines.length === 0) return { rows: [], warnings: ['File is empty'], columnMap: {} }

  const delimiter = detectDelimiter(rawLines.slice(0, 10).join('\n'))

  // Find the header row: the first line that yields at least a cost column
  // and one of customer id / account name.
  let headerIdx = -1
  let columnMap = {}
  for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
    const cells = splitLine(rawLines[i], delimiter)
    const map = matchColumns(cells)
    if (map.cost !== undefined && (map.customer_id !== undefined || map.account_name !== undefined)) {
      headerIdx = i
      columnMap = map
      break
    }
  }

  if (headerIdx === -1) {
    return {
      rows: [],
      columnMap: {},
      warnings: ['Could not find a header row containing a cost column plus an account name or customer id. The export may use unexpected column names — send a sample and the parser can be adjusted.'],
    }
  }

  if (columnMap.spend_date === undefined) {
    warnings.push('No date column found. Rows will need a date supplied manually at import time.')
  }
  if (columnMap.customer_id === undefined) {
    warnings.push('No customer id column — accounts will be matched by name only, which is less reliable.')
  }

  const rows = []
  let skipped = 0

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const cells = splitLine(rawLines[i], delimiter)
    if (cells.length < 2) continue

    const first = (cells[0] || '').toLowerCase()
    // Google appends totals rows; these must not be imported as an account
    if (first.startsWith('total') || first.startsWith('grand total')) continue

    const cost = parseNumber(cells[columnMap.cost])
    if (cost === null) { skipped++; continue }

    const customerIdRaw = columnMap.customer_id !== undefined ? cells[columnMap.customer_id] : null
    const customerId = customerIdRaw ? String(customerIdRaw).replace(/\D/g, '') : null
    const accountName = columnMap.account_name !== undefined ? cells[columnMap.account_name] : null

    if (!customerId && !accountName) { skipped++; continue }

    rows.push({
      customer_id: customerId || null,
      account_name: accountName || null,
      spend_date: columnMap.spend_date !== undefined ? parseDate(cells[columnMap.spend_date]) : null,
      cost,
      impressions: columnMap.impressions !== undefined ? parseNumber(cells[columnMap.impressions]) : null,
      clicks: columnMap.clicks !== undefined ? parseNumber(cells[columnMap.clicks]) : null,
      conversions: columnMap.conversions !== undefined ? parseNumber(cells[columnMap.conversions]) : null,
      currency: columnMap.currency !== undefined ? cells[columnMap.currency] : null,
    })
  }

  if (skipped > 0) warnings.push(`${skipped} row(s) skipped — no usable cost value or no account identifier.`)

  const undated = rows.filter(r => !r.spend_date).length
  if (undated > 0 && columnMap.spend_date !== undefined) {
    warnings.push(`${undated} row(s) had a date that couldn't be parsed unambiguously (e.g. 01/02/2026 could be Jan 2 or Feb 1). Supply the date range manually for these.`)
  }

  return { rows, columnMap, warnings, delimiter, headerRow: headerIdx + 1, filename }
}
