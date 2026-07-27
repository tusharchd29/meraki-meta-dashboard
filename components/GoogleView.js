import { useEffect, useState } from 'react'
import GoogleImport from './GoogleImport'
import { paceStatus } from './BillingView'

const SYM = c => c === 'THB' ? '฿' : c === 'NZD' ? 'NZ$' : '₹'
const fmt = (n, sym) => sym + Math.round(n || 0).toLocaleString('en-IN')

function statusPill(status) {
  const s = (status || '').toLowerCase()
  if (s === 'enabled') return <span className="pill pill-g">Enabled</span>
  if (s === 'paused') return <span className="pill pill-a">Paused</span>
  if (s === 'removed') return <span className="pill pill-r">Removed</span>
  return <span className="pill pill-b">{status || '—'}</span>
}

// One expandable card per Google-mapped client, styled to match Meta's
// Account View cards (same acc-card/acc-hdr/kc classes) — campaign-level
// detail (status, cost, impressions, clicks, conversions, CTR) from the
// most recent import, instead of just one aggregate row in a table.
function GoogleAccountCard({ row, open, onToggle }) {
  const S = SYM(row.currency)
  const pace = row.pace || { label: 'No budget set', cls: 'na' }
  const dotCls = pace.cls === 'r' ? 'r' : pace.cls === 'a' ? 'a' : pace.cls === 'g' ? 'g' : 'e'
  const campaigns = [...(row.campaigns || [])].sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0))

  return (
    <div className={`acc-card ${dotCls === 'r' ? 'err' : dotCls === 'a' ? 'warn' : dotCls === 'g' ? 'ok' : 'off'}${open ? ' open' : ''}`}>
      <div className="acc-hdr" onClick={onToggle}>
        <div className="acc-exp">▶</div>
        <div className={`acc-sdot ${dotCls}`} />
        <div className="acc-info">
          <div className="acc-name">{row.name}</div>
          <div className="acc-meta">
            {row.currency} · {row.period ? `imported ${row.period.split(' → ')[1]}` : 'no import yet'}
            {row.staleDays != null && ` (${row.staleDays}d ago)`} · {row.activeCamps}/{row.totalCamps} enabled
          </div>
        </div>
        <div className="acc-kpis">
          <div className="kc">
            <div className="kc-lbl">Budget</div>
            <div className="kc-val n">{row.monthlyBudget ? fmt(row.monthlyBudget, S) : '—'}</div>
          </div>
          <div className="kc">
            <div className="kc-lbl">This Month</div>
            <div className="kc-val b">{fmt(row.monthSpend, S)}</div>
          </div>
          <div className="kc">
            <div className="kc-lbl">Pacing</div>
            <div className={`kc-val ${pace.cls === 'na' ? 'n' : pace.cls}`}>{pace.label}</div>
          </div>
        </div>
      </div>
      <div className="acc-body">
        {campaigns.length ? (
          <table className="camp-tbl">
            <thead>
              <tr>
                <th>Status</th><th>Campaign</th><th>Type</th>
                <th>Cost</th><th>Impr.</th><th>Clicks</th><th>Conv.</th><th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const impr = Number(c.impressions) || 0
                const clicks = Number(c.clicks) || 0
                const ctr = impr > 0 ? ((clicks / impr) * 100).toFixed(2) + '%' : '—'
                return (
                  <tr key={i}>
                    <td>{statusPill(c.campaign_status)}</td>
                    <td>{c.campaign_name}</td>
                    <td style={{ color: 'var(--text3)' }}>{c.campaign_type || '—'}</td>
                    <td>{fmt(c.cost, S)}</td>
                    <td>{impr.toLocaleString('en-IN')}</td>
                    <td>{clicks.toLocaleString('en-IN')}</td>
                    <td>{c.conversions != null ? Number(c.conversions).toLocaleString('en-IN') : '—'}</td>
                    <td>{ctr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-data-box">No campaign-level detail in the latest import for this client.</div>
        )}
      </div>
    </div>
  )
}

// Google Ads has its own tab so import, tracking, and pacing all live in one
// place instead of being split across Clients (Blended) and Billing &
// Pacing. Budgets still come from meraki_clients.monthly_budget (the same
// value editable on Clients (Blended)).
export default function GoogleView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spendData, setSpendData] = useState(null)
  const [openKeys, setOpenKeys] = useState(() => new Set())

  const load = () => {
    setLoading(true)
    fetch('/api/client-map', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setError(d.error || null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }
  useEffect(load, [])

  const loadSpend = () => {
    fetch('/api/google-spend', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setSpendData(d))
      .catch(() => {})
  }
  useEffect(loadSpend, [])

  const toggle = (key) => setOpenKeys(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  if (loading) return <div className="no-data-box">Loading Google Ads data…</div>
  if (error) return <div className="no-data-box" style={{ color: 'var(--red)' }}>Error: {error}</div>

  const clients = data?.clients || []
  const latest = spendData?.latest || {}
  const mtd = spendData?.mtd || {}
  const ids = [...new Set([...Object.keys(latest), ...Object.keys(mtd)])]

  // One card per client that has ever had a Google export imported — budget
  // comes straight off the client roster so pacing actually works, and
  // campaign detail comes from the latest import so the card isn't just a
  // spend number the way the old table row was.
  const rows = ids.map(id => {
    const p = latest[id]
    const m = mtd[id]
    const client = clients.find(c => String(c.id) === String(id))
    const monthSpend = m ? m.month : Number(p?.account_cost || 0)
    const monthlyBudget = client?.monthly_budget ? Number(client.monthly_budget) : null
    return {
      key: id,
      name: client?.name || p?.client_name || (p?.source_file ? p.source_file.replace(/\.[^.]+$/, '') : 'Imported client'),
      currency: m?.currency || p?.currency || 'INR',
      monthSpend,
      period: p ? `${p.period_start} → ${p.period_end}` : null,
      staleDays: p?.stale_days ?? null,
      activeCamps: p?.active_campaigns ?? 0,
      totalCamps: p?.campaigns?.length ?? 0,
      campaigns: p?.campaigns || [],
      monthlyBudget,
      pace: paceStatus(monthSpend, monthlyBudget),
    }
  }).sort((a, b) => b.monthSpend - a.monthSpend)

  const noBudgetCount = rows.filter(r => !r.monthlyBudget).length
  const unmappedGoogle = data?.unmapped?.google || []

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Google Ads</div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length} client{rows.length === 1 ? '' : 's'} with imports</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
        Google spend comes from manually imported exports below, not a live API (that needs
        GOOGLE_ADS_DEVELOPER_TOKEN, which Google approves separately). Campaign detail reflects the
        most recent import, not real time — check the "imported" date on each card. Budgets and
        account mapping are shared with <b>Clients (Blended)</b> — set them there, they'll show up
        here automatically.
      </div>

      <GoogleImport clients={clients} onImported={() => { loadSpend(); load() }} />

      {rows.length === 0 ? (
        <div className="no-data-box">No tracked Google accounts have an import yet. Use the importer above to add one.</div>
      ) : (
        <div className="accounts" style={{ marginTop: 14 }}>
          {rows.map(row => (
            <GoogleAccountCard key={row.key} row={row} open={openKeys.has(row.key)} onToggle={() => toggle(row.key)} />
          ))}
        </div>
      )}

      {noBudgetCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 12 }}>
          {noBudgetCount} client{noBudgetCount > 1 ? 's have' : ' has'} no approved budget set yet —
          set it on the Clients (Blended) tab to see pacing.
        </div>
      )}

      {unmappedGoogle.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {unmappedGoogle.length} tracked Google account{unmappedGoogle.length === 1 ? '' : 's'} not yet mapped to a client
          (won't appear above until mapped on Clients (Blended)): {unmappedGoogle.join(', ')}
        </div>
      )}
    </div>
  )
}
