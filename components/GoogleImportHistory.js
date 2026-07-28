import { useState } from 'react'

const fmtDate = d => d
const SYM = c => c === 'THB' ? '฿' : c === 'NZD' ? 'NZ$' : '₹'

// Two ranges are considered the same "import history" entry if they overlap
// OR sit within a day of each other (e.g. 1st–15th and 16th–20th are really
// one continuous export history, just re-run partway through the month).
function rangesTouch(aEnd, bStart) {
  const gapDays = (new Date(bStart) - new Date(aEnd)) / 86400000
  return gapDays <= 1
}

// Groups a client's periods (already sorted by period_start) into merged
// display rows. Doesn't touch the database — this is purely how the table
// is drawn. Each merged row keeps its original period rows so individual
// imports can still be expanded/deleted one at a time.
function collapseOverlapping(periods) {
  const sorted = [...periods].sort((a, b) => a.period_start.localeCompare(b.period_start))
  const groups = []
  for (const p of sorted) {
    const last = groups[groups.length - 1]
    if (last && rangesTouch(last.period_end, p.period_start)) {
      last.items.push(p)
      if (p.period_end > last.period_end) last.period_end = p.period_end
      if (p.period_start < last.period_start) last.period_start = p.period_start
    } else {
      groups.push({ period_start: p.period_start, period_end: p.period_end, items: [p] })
    }
  }
  return groups
}

export default function GoogleImportHistory({ periods = [], onChanged }) {
  const [busyKey, setBusyKey] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const [error, setError] = useState(null)

  const byClient = {}
  for (const p of periods) {
    (byClient[p.client_id] ||= { name: p.client_name || 'Unmapped client', items: [] }).items.push(p)
  }

  const runDelete = async (key, params) => {
    setBusyKey(key); setError(null)
    try {
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`/api/google-import?${qs}`, { method: 'DELETE' })
      const d = await res.json()
      if (d.error) setError(d.error)
      else onChanged && onChanged()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyKey(null)
    }
  }

  const toggle = key => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const clientIds = Object.keys(byClient)
  if (clientIds.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Import history</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        Overlapping or back-to-back date ranges from the same client are shown as one row.
        Expand a row to see (and delete) the individual imports behind it.
      </div>
      {error && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</div>}

      {clientIds.map(clientId => {
        const { name, items } = byClient[clientId]
        const groups = collapseOverlapping(items)
        const allKey = `all-${clientId}`
        return (
          <div key={clientId} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
              <button
                onClick={() => { if (confirm(`Delete ALL imported Google Ads data for ${name}? This can't be undone.`)) runDelete(allKey, { clientId, all: 'true' }) }}
                disabled={busyKey === allKey}
                className="refresh-btn"
                style={{ fontSize: 10, opacity: busyKey === allKey ? 0.6 : 0.8 }}
              >
                {busyKey === allKey ? 'Deleting…' : 'Delete all for this client'}
              </button>
            </div>

            {groups.map((g, i) => {
              const groupKey = `${clientId}-${g.period_start}-${g.period_end}`
              const isOpen = expanded.has(groupKey)
              const merged = g.items.length > 1
              return (
                <div key={groupKey} style={{ background: 'rgba(0,0,0,.03)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 11.5 }}>
                      <b>{fmtDate(g.period_start)} → {fmtDate(g.period_end)}</b>
                      {merged && (
                        <span style={{ color: 'var(--text3)' }}> · {g.items.length} imports merged</span>
                      )}
                      {!merged && g.items[0].account_cost != null && (
                        <span style={{ color: 'var(--text3)' }}> · {SYM(g.items[0].currency)}{Math.round(g.items[0].account_cost).toLocaleString('en-IN')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {merged && (
                        <button onClick={() => toggle(groupKey)} className="refresh-btn" style={{ fontSize: 10, opacity: 0.8 }}>
                          {isOpen ? 'Hide imports' : 'Show imports'}
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm(`Delete data for ${fmtDate(g.period_start)} → ${fmtDate(g.period_end)}?`)) runDelete(groupKey, { clientId, periodStart: g.period_start, periodEnd: g.period_end }) }}
                        disabled={busyKey === groupKey}
                        className="refresh-btn"
                        style={{ fontSize: 10, opacity: busyKey === groupKey ? 0.6 : 0.8 }}
                      >
                        {busyKey === groupKey ? 'Deleting…' : merged ? 'Delete range' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {merged && isOpen && (
                    <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                      {g.items.map(p => {
                        const itemKey = `${clientId}-${p.period_start}-${p.period_end}-item`
                        return (
                          <div key={itemKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '4px 0' }}>
                            <span>
                              {fmtDate(p.period_start)} → {fmtDate(p.period_end)}
                              {p.account_cost != null && <span style={{ color: 'var(--text3)' }}> · {SYM(p.currency)}{Math.round(p.account_cost).toLocaleString('en-IN')}</span>}
                              {p.source_file && <span style={{ color: 'var(--text3)' }}> · {p.source_file}</span>}
                            </span>
                            <button
                              onClick={() => { if (confirm(`Delete this single import (${p.period_start} → ${p.period_end})?`)) runDelete(itemKey, { clientId, periodStart: p.period_start, periodEnd: p.period_end }) }}
                              disabled={busyKey === itemKey}
                              className="refresh-btn"
                              style={{ fontSize: 9, opacity: busyKey === itemKey ? 0.6 : 0.8 }}
                            >
                              {busyKey === itemKey ? '…' : 'Delete'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
