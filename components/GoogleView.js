import { useEffect, useState } from 'react'
import GoogleImport from './GoogleImport'
import { BillingTable, paceStatus } from './BillingView'

// Google Ads has its own tab so import, tracking, and pacing all live in one
// place instead of being split across Clients (Blended) and Billing &
// Pacing. Budgets still come from meraki_clients.monthly_budget (the same
// value editable on Clients (Blended)) — this view only adds the import
// tool and turns that budget into an actual spend-vs-budget table, which
// the old Billing & Pacing Google sub-tab never did (it never read
// monthly_budget at all, so pacing always showed "No budget set").
export default function GoogleView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spendData, setSpendData] = useState(null)

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

  if (loading) return <div className="no-data-box">Loading Google Ads data…</div>
  if (error) return <div className="no-data-box" style={{ color: 'var(--red)' }}>Error: {error}</div>

  const clients = data?.clients || []
  const latest = spendData?.latest || {}
  const mtd = spendData?.mtd || {}
  const ids = [...new Set([...Object.keys(latest), ...Object.keys(mtd)])]

  // One row per client that has ever had a Google export imported — budget
  // comes straight off the client roster so pacing actually works.
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
      weekSpend: m ? m.week : null,
      todaySpend: m ? m.today : null,
      isTrueMtd: !!m,
      period: p ? `${p.period_start} → ${p.period_end}` : null,
      activeCamps: p?.active_campaigns ?? 0,
      totalCamps: p?.campaigns?.length ?? 0,
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
        GOOGLE_ADS_DEVELOPER_TOKEN, which Google approves separately). Budgets and account mapping
        are shared with <b>Clients (Blended)</b> — set them there, they'll show up here automatically.
      </div>

      <GoogleImport clients={clients} onImported={() => { loadSpend(); load() }} />

      <BillingTable platform="Google Ads" rows={rows} loading={false} />

      {noBudgetCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8 }}>
          {noBudgetCount} client{noBudgetCount > 1 ? 's have' : ' has'} no approved budget set yet —
          set it on the Clients (Blended) tab to see pacing.
        </div>
      )}

      {unmappedGoogle.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {unmappedGoogle.length} tracked Google account{unmappedGoogle.length === 1 ? '' : 's'} not yet mapped to a client
          (won't appear in the table above until mapped on Clients (Blended)): {unmappedGoogle.join(', ')}
        </div>
      )}
    </div>
  )
}
