import { useEffect, useState } from 'react'
import GoogleImport from './GoogleImport'
import { paceStatus } from './BillingView'

const SYM = c => c === 'THB' ? '฿' : c === 'NZD' ? 'NZ$' : '₹'
const fmt = (n, sym) => sym + Math.round(n || 0).toLocaleString('en-IN')

function makeSemaphore(max = 4) {
  let running = 0; const queue = []
  const run = () => { while (running < max && queue.length > 0) { const { fn, resolve, reject } = queue.shift(); running++; fn().then(v => { running--; run(); resolve(v) }).catch(e => { running--; run(); reject(e) }) } }
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); run() })
}

// Meta MTD spend for clients mapped to both platforms, so pacing here can
// blend it in the same way ClientsView's "Blended" column does — the
// approved budget on a dual-platform client covers both legs together, not
// just Google. Only fetched for accounts actually mapped+tracked on Meta;
// everything else paces on Google-only spend as before.
function metaMonthSpend(accountId) {
  const qs = new URLSearchParams({ endpoint: `${accountId}/insights`, fields: 'spend', date_preset: 'this_month' })
  return fetch(`/api/meta?${qs}`, { cache: 'no-store' }).then(r => r.json())
    .then(d => parseFloat(d?.data?.[0]?.spend || 0)).catch(() => 0)
}

function useMetaSpendForBlending(metaAccountIds) {
  const [spendByAccount, setSpendByAccount] = useState({})
  useEffect(() => {
    if (!metaAccountIds.length) { setSpendByAccount({}); return }
    const semaphore = makeSemaphore(6)
    Promise.all(metaAccountIds.map(id => semaphore(() => metaMonthSpend(id)).then(spend => [id, spend])))
      .then(entries => setSpendByAccount(Object.fromEntries(entries)))
      .catch(() => {})
  }, [JSON.stringify(metaAccountIds)])
  return spendByAccount
}

function statusPill(status) {
  const s = (status || '').toLowerCase()
  if (s === 'enabled') return <span className="pill pill-g">Enabled</span>
  if (s === 'paused') return <span className="pill pill-a">Paused</span>
  if (s === 'removed') return <span className="pill pill-r">Removed</span>
  return <span className="pill pill-b">{status || '—'}</span>
}

// Live campaign spend for the current calendar month, for every tracked
// Google Ads account, via the existing read-only /api/google-ads proxy —
// same GAQL-over-REST pattern Google's own docs describe. This is what
// turns a tracked account from "just a name" into an actual account card,
// same as Meta. Requires GOOGLE_ADS_DEVELOPER_TOKEN to be set server-side;
// until it is, every call fails with the same clear, expected error, which
// this surfaces once at the top rather than as N identical card errors —
// and everything falls back to whatever CSV import data exists, so this
// code ships now and lights up automatically the moment the token's added
// to Vercel, no redeploy needed.
const LIVE_QUERY = `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date DURING THIS_MONTH ORDER BY metrics.cost_micros DESC`

function useLiveGoogleAds(trackedClients) {
  const [liveByAccount, setLiveByAccount] = useState({})
  const [loading, setLoading] = useState(false)
  const [configError, setConfigError] = useState(null)

  useEffect(() => {
    if (!trackedClients.length) { setLiveByAccount({}); return }
    setLoading(true)
    let cancelled = false
    const semaphore = makeSemaphore(5)

    Promise.all(trackedClients.map(cl => semaphore(async () => {
      try {
        const res = await fetch('/api/google-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: cl.accountId, query: LIVE_QUERY }),
        })
        const d = await res.json()
        if (!res.ok || d.error) return { accountId: cl.accountId, error: d.error || `HTTP ${res.status}` }
        const campaigns = (d.results || []).map(r => ({
          campaign_name: r.campaign?.name || '(unnamed campaign)',
          campaign_status: r.campaign?.status,
          cost: (Number(r.metrics?.costMicros ?? r.metrics?.cost_micros ?? 0)) / 1e6,
          impressions: Number(r.metrics?.impressions || 0),
          clicks: Number(r.metrics?.clicks || 0),
          conversions: r.metrics?.conversions != null ? Number(r.metrics.conversions) : null,
        }))
        const monthSpend = campaigns.reduce((s, c) => s + c.cost, 0)
        return { accountId: cl.accountId, campaigns, monthSpend }
      } catch (e) {
        return { accountId: cl.accountId, error: e.message }
      }
    }))).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) map[r.accountId] = r
      setLiveByAccount(map)
      setLoading(false)
      const notConfigured = results.find(r => r.error && /GOOGLE_ADS_DEVELOPER_TOKEN/i.test(r.error))
      setConfigError(notConfigured ? notConfigured.error : null)
    })
    return () => { cancelled = true }
  }, [JSON.stringify(trackedClients.map(c => c.accountId))])

  return { liveByAccount, loading, configError }
}

// One expandable card per Google account — styled to match Meta's Account
// View cards (same acc-card/acc-hdr/kc classes). Shows live data when
// GOOGLE_ADS_DEVELOPER_TOKEN is configured, otherwise falls back to the
// most recent CSV import for that client, clearly labeled either way.
function GoogleAccountCard({ row, open, onToggle }) {
  const S = SYM(row.currency)
  const pace = row.pace || { label: 'No budget set', cls: 'na' }
  const dotCls = row.isLive ? (pace.cls === 'r' ? 'r' : pace.cls === 'a' ? 'a' : pace.cls === 'g' ? 'g' : 'e') : 'e'
  const campaigns = [...(row.campaigns || [])].sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0))

  return (
    <div className={`acc-card ${dotCls === 'r' ? 'err' : dotCls === 'a' ? 'warn' : dotCls === 'g' ? 'ok' : 'off'}${open ? ' open' : ''}`}>
      <div className="acc-hdr" onClick={onToggle}>
        <div className="acc-exp">▶</div>
        <div className={`acc-sdot ${dotCls}`} />
        <div className="acc-info">
          <div className="acc-name">
            {row.name}
            {row.isLive
              ? <span className="live-badge" style={{ marginLeft: 8 }}>● LIVE</span>
              : <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>LAST IMPORT</span>}
          </div>
          <div className="acc-meta">
            {row.currency}
            {row.isLive ? ' · this month, live' : row.period ? ` · imported ${row.period.split(' → ')[1]}${row.staleDays != null ? ` (${row.staleDays}d ago)` : ''}` : ' · not yet imported'}
            {' · '}{row.activeCamps}/{row.totalCamps} enabled
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
            {row.isBlended && (
              <div style={{ fontSize: 9, color: 'var(--text3)' }} title="This client also runs Meta Ads — pacing uses the blended total, not just Google">
                +{fmt(row.metaSpendThisMonth, S)} Meta = {fmt(row.blendedSpend, S)} blended
              </div>
            )}
          </div>
          <div className="kc">
            <div className="kc-lbl">Pacing</div>
            <div className={`kc-val ${pace.cls === 'na' ? 'n' : pace.cls}`}>{pace.label}</div>
          </div>
        </div>
      </div>
      <div className="acc-body">
        {row.liveError && (
          <div className="no-data-box" style={{ margin: '10px 14px' }}>Live fetch failed: {row.liveError}</div>
        )}
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
          <div className="no-data-box">
            {row.isLive ? 'No campaigns with activity this month.' : 'No campaign-level detail available. Import a CSV above, or wait for live sync.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GoogleView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spendData, setSpendData] = useState(null)
  const [trackedClients, setTrackedClients] = useState([])
  const [openKeys, setOpenKeys] = useState(() => new Set())
  const [sheetSyncStatus, setSheetSyncStatus] = useState(null) // { serviceAccountEmail, sheetConfigured }
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null) // { ok, dailyRowsSynced, campaignRowsSynced, unmappedAccountIds, error }

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

  useEffect(() => {
    fetch('/api/google-clients', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setTrackedClients(d.clients || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/google-sheet-sync', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setSheetSyncStatus(d))
      .catch(() => {})
  }, [])

  const runSync = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await fetch('/api/google-sheet-sync', { method: 'POST' })
      const d = await res.json()
      setSyncResult(res.ok ? d : { error: d.error })
      if (res.ok) { loadSpend(); load() }
    } catch (e) {
      setSyncResult({ error: e.message })
    } finally {
      setSyncing(false)
    }
  }

  const { liveByAccount, configError } = useLiveGoogleAds(trackedClients)

  const clientsForBlending = data?.clients || []
  const metaAccountIdsToBlend = [...new Set(
    clientsForBlending.filter(c => c.meta_account && c.google_account).map(c => c.meta_account.account_id)
  )]
  const metaSpendByAccount = useMetaSpendForBlending(metaAccountIdsToBlend)

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

  // Primary account list: every tracked Google Ads account (matching how
  // Meta's Account View works — Track in Connections = shows up here),
  // enriched with a mapped client's name/budget when one exists, live data
  // when available, and CSV import data as the fallback otherwise.
  const trackedRows = trackedClients.map(cl => {
    const mappedClient = clients.find(c => c.google_ads_customer_id === cl.accountId)
    const live = liveByAccount[cl.accountId]
    const clientId = mappedClient?.id
    const p = clientId != null ? latest[clientId] : null
    const m = clientId != null ? mtd[clientId] : null

    const isLive = !!live && !live.error
    const monthSpend = isLive ? live.monthSpend : (m ? m.month : Number(p?.account_cost || cl.monthSpend || 0))
    const monthlyBudget = mappedClient?.monthly_budget != null ? Number(mappedClient.monthly_budget) : cl.monthlyBudget
    const campaigns = isLive ? live.campaigns : (p?.campaigns || [])
    const isBlended = !!(mappedClient?.meta_account && mappedClient?.google_account)
    const metaSpendThisMonth = isBlended ? Number(metaSpendByAccount[mappedClient.meta_account.account_id] || 0) : 0
    const blendedSpend = monthSpend + metaSpendThisMonth

    return {
      key: cl.accountId,
      name: mappedClient?.name || cl.name,
      currency: cl.currency || m?.currency || p?.currency || 'INR',
      monthSpend,
      period: p ? `${p.period_start} → ${p.period_end}` : null,
      staleDays: p?.stale_days ?? null,
      activeCamps: isLive ? campaigns.filter(c => (c.campaign_status || '').toLowerCase() === 'enabled').length : (p?.active_campaigns ?? 0),
      totalCamps: campaigns.length,
      campaigns,
      monthlyBudget, isBlended, metaSpendThisMonth, blendedSpend,
      pace: paceStatus(isBlended ? blendedSpend : monthSpend, monthlyBudget),
      isLive,
      liveError: live?.error || null,
    }
  }).sort((a, b) => b.monthSpend - a.monthSpend)

  // Secondary: clients with a CSV import mapped to a Google account that
  // ISN'T currently tracked via a live connection (legacy imports, or an
  // account tracked under a different login). Keeps old data visible
  // without pretending it's live.
  const trackedAccountIds = new Set(trackedClients.map(c => c.accountId))
  const csvOnlyIds = [...new Set([...Object.keys(latest), ...Object.keys(mtd)])]
    .filter(id => {
      const client = clients.find(c => String(c.id) === String(id))
      return client?.google_ads_customer_id && !trackedAccountIds.has(client.google_ads_customer_id)
    })
  const csvOnlyRows = csvOnlyIds.map(id => {
    const p = latest[id]
    const m = mtd[id]
    const client = clients.find(c => String(c.id) === String(id))
    const monthSpend = m ? m.month : Number(p?.account_cost || 0)
    const monthlyBudget = client?.monthly_budget ? Number(client.monthly_budget) : null
    const isBlended = !!(client?.meta_account && client?.google_account)
    const metaSpendThisMonth = isBlended ? Number(metaSpendByAccount[client.meta_account.account_id] || 0) : 0
    const blendedSpend = monthSpend + metaSpendThisMonth
    return {
      key: `csv-${id}`,
      name: client?.name || p?.client_name || 'Imported client',
      currency: m?.currency || p?.currency || 'INR',
      monthSpend,
      period: p ? `${p.period_start} → ${p.period_end}` : null,
      staleDays: p?.stale_days ?? null,
      activeCamps: p?.active_campaigns ?? 0,
      totalCamps: p?.campaigns?.length ?? 0,
      campaigns: p?.campaigns || [],
      monthlyBudget, isBlended, metaSpendThisMonth, blendedSpend,
      pace: paceStatus(isBlended ? blendedSpend : monthSpend, monthlyBudget),
      isLive: false,
      liveError: null,
    }
  }).sort((a, b) => b.monthSpend - a.monthSpend)

  const rows = [...trackedRows, ...csvOnlyRows]
  const noBudgetCount = rows.filter(r => !r.monthlyBudget).length
  const unmappedGoogle = data?.unmapped?.google || []
  const liveCount = trackedRows.filter(r => r.isLive).length

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Google Ads</div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length} account{rows.length === 1 ? '' : 's'}{liveCount > 0 ? ` · ${liveCount} live` : ''}</span>
      </div>

      {configError ? (
        <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 14, lineHeight: 1.6, padding: '8px 12px', background: 'var(--amber-lt)', border: '1px solid var(--amber-bd)', borderRadius: 8 }}>
          Live data isn't on yet: {configError} — showing the most recent CSV import for each account instead. Once the developer
          token is added, these cards switch to live automatically, no further changes needed here.
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
          Tracked accounts show live campaign data for this month. Budgets and custom names are shared with{' '}
          <b>Clients (Blended)</b> — set them there, they'll show up here automatically.
          Clients mapped to both Meta and Google there get their Meta spend added in before pacing, since the approved budget covers both platforms together.
        </div>
      )}

      <div style={{
        background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12,
        padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          Auto-sync from Google Ads Scripts <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(no developer token needed)</span>
        </div>
        {sheetSyncStatus?.sheetConfigured ? (
          <>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
              Pulls from the Sheet your Google Ads Manager Script writes to. Runs automatically once a day; use the button for an
              on-demand refresh.
            </div>
            <button
              onClick={runSync}
              disabled={syncing}
              className="refresh-btn"
              style={{ opacity: syncing ? 0.6 : 1 }}
            >
              {syncing ? 'Syncing…' : '↻ Sync now'}
            </button>
            {syncResult && (
              <div style={{ fontSize: 11, marginTop: 8, color: syncResult.error ? 'var(--red)' : 'var(--green-dk)' }}>
                {syncResult.error
                  ? `Sync failed: ${syncResult.error}`
                  : `Synced ${syncResult.dailyRowsSynced} daily row(s) and ${syncResult.campaignRowsSynced} campaign row(s).` +
                    (syncResult.unmappedAccountIds?.length
                      ? ` ${syncResult.unmappedAccountIds.length} account ID(s) in the Sheet aren't mapped to a client yet: ${syncResult.unmappedAccountIds.join(', ')} — map them on Clients (Blended).`
                      : '')}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.7 }}>
            Not set up yet. One-time setup, no Google API approval needed:
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Create a Google Sheet (any name).</li>
              <li>
                Share it (Editor access) with:{' '}
                {sheetSyncStatus?.serviceAccountEmail
                  ? <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{sheetSyncStatus.serviceAccountEmail}</code>
                  : <em>loading…</em>}
              </li>
              <li>In Google Ads (Manager account) → Tools &amp; Settings → Bulk Actions → Scripts → + → paste in the Meraki sync script, set the Sheet URL, authorize, and schedule it (e.g. every 6 hours).</li>
              <li>Add <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>GOOGLE_ADS_SHEET_ID</code> (the long ID from the Sheet's URL) to Vercel's env vars.</li>
            </ol>
          </div>
        )}
      </div>

      <GoogleImport clients={clients} onImported={() => { loadSpend(); load() }} />

      {rows.length === 0 ? (
        <div className="no-data-box">No tracked Google accounts yet. Connect and track one in the 🔌 Connections panel, or import a CSV above.</div>
      ) : (
        <div className="accounts" style={{ marginTop: 14 }}>
          {rows.map(row => (
            <GoogleAccountCard key={row.key} row={row} open={openKeys.has(row.key)} onToggle={() => toggle(row.key)} />
          ))}
        </div>
      )}

      {noBudgetCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 12 }}>
          {noBudgetCount} account{noBudgetCount > 1 ? 's have' : ' has'} no approved budget set yet —
          set it on the Clients (Blended) tab to see pacing.
        </div>
      )}

      {unmappedGoogle.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {unmappedGoogle.length} tracked Google account{unmappedGoogle.length === 1 ? '' : 's'} not yet mapped to a client
          (still shown above using its Connections-level name/budget; map it on Clients (Blended) for a custom name): {unmappedGoogle.join(', ')}
        </div>
      )}
    </div>
  )
}
