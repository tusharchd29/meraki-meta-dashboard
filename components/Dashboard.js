'use client'
import { useState, useEffect, useCallback } from 'react'
import styles from './Dashboard.module.css'

const STATUS_MAP = {
  1: { label: 'Active', cls: 'active' },
  2: { label: 'Disabled', cls: 'inactive' },
  3: { label: 'Unsettled', cls: 'err' },
  7: { label: 'Pending Review', cls: 'warn' },
  9: { label: 'Grace Period', cls: 'warn' },
  100: { label: 'Pending Closure', cls: 'warn' },
  101: { label: 'Closed', cls: 'inactive' },
  201: { label: 'Closed', cls: 'inactive' },
}

function fmt(n, currency = false) {
  if (n === null || n === undefined || n === '') return '—'
  const num = parseFloat(n)
  if (isNaN(num)) return '—'
  if (currency) {
    if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L'
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K'
    return '₹' + num.toFixed(0)
  }
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toFixed(0)
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLbl}>{label}</div>
      <div className={`${styles.kpiVal} ${color ? styles[color] : ''}`}>{value}</div>
      <div className={styles.kpiSub}>{sub}</div>
    </div>
  )
}

function AccRow({ acc, insights, loading }) {
  const [open, setOpen] = useState(false)
  const status = STATUS_MAP[acc.account_status] || { label: 'Unknown', cls: 'inactive' }
  const lifetimeSpend = parseFloat(acc.amount_spent || 0) / 100

  const ins = insights || {}
  const spend = parseFloat(ins.spend || 0)
  const impr = parseInt(ins.impressions || 0)
  const ctr = parseFloat(ins.ctr || 0)
  const cpm = parseFloat(ins.cpm || 0)
  const clicks = parseInt(ins.clicks || 0)
  const reach = parseInt(ins.reach || 0)
  const freq = parseFloat(ins.frequency || 0)
  const results = ins.actions ? ins.actions.reduce((s, a) => s + parseInt(a.value || 0), 0) : null

  return (
    <div className={`${styles.accCard} ${styles[status.cls]}`}>
      <div className={styles.accHdr} onClick={() => setOpen(o => !o)}>
        <div className={styles.accInfo}>
          <div className={styles.accName}>{acc.name}</div>
          <div className={styles.accId}>act_{acc.account_id} · {acc.currency || 'INR'}</div>
        </div>
        <span className={`${styles.accStatus} ${styles['st_' + status.cls]}`}>{status.label}</span>
        <div className={styles.accKpis}>
          <div className={styles.ak}>
            <div className={styles.akLbl}>Lifetime</div>
            <div className={`${styles.akVal} ${styles.b}`}>{fmt(lifetimeSpend, true)}</div>
          </div>
          <div className={styles.ak}>
            <div className={styles.akLbl}>Spend</div>
            <div className={`${styles.akVal} ${spend > 0 ? styles.g : ''}`}>
              {loading ? '...' : fmt(spend, true)}
            </div>
          </div>
          <div className={styles.ak}>
            <div className={styles.akLbl}>Impressions</div>
            <div className={styles.akVal}>{loading ? '...' : fmt(impr)}</div>
          </div>
          <div className={styles.ak}>
            <div className={styles.akLbl}>CTR</div>
            <div className={`${styles.akVal} ${ctr >= 1.5 ? styles.g : ctr > 0 && ctr < 0.8 ? styles.r : ''}`}>
              {loading ? '...' : ctr > 0 ? ctr.toFixed(2) + '%' : '—'}
            </div>
          </div>
          <div className={styles.ak}>
            <div className={styles.akLbl}>CPM</div>
            <div className={styles.akVal}>{loading ? '...' : fmt(cpm, true)}</div>
          </div>
        </div>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className={styles.insRow}>
          <div className={styles.insItem}><div className={styles.insLbl}>Clicks</div><div className={styles.insVal}>{fmt(clicks)}</div></div>
          <div className={styles.insItem}><div className={styles.insLbl}>Reach</div><div className={styles.insVal}>{fmt(reach)}</div></div>
          <div className={styles.insItem}><div className={styles.insLbl}>Frequency</div><div className={styles.insVal}>{freq > 0 ? freq.toFixed(2) : '—'}</div></div>
          <div className={styles.insItem}><div className={styles.insLbl}>Results</div><div className={styles.insVal}>{results !== null ? fmt(results) : '—'}</div></div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [token, setToken] = useState('')
  const [days, setDays] = useState(7)
  const [accounts, setAccounts] = useState([])
  const [insights, setInsights] = useState({})
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({ spend: 0, impr: 0, ctr: 0, active: 0 })
  const [filter, setFilter] = useState('all')

  const callApi = useCallback(async (endpoint, params = {}) => {
    const qs = new URLSearchParams({ endpoint, token, ...params })
    const res = await fetch(`/api/meta?${qs}`)
    return res.json()
  }, [token])

  const loadAccounts = useCallback(async () => {
    if (!token) { setError('Please enter your Meta access token.'); return }
    setLoading(true); setError(''); setAccounts([]); setInsights({})
    try {
      const data = await callApi('me/adaccounts', { fields: 'name,account_id,account_status,currency,amount_spent', limit: '50' })
      if (data.error) { setError(data.error.message); setLoading(false); return }
      const accs = data.data || []
      setAccounts(accs)
      setLoading(false)
      loadInsights(accs)
    } catch (e) {
      setError('Network error: ' + e.message)
      setLoading(false)
    }
  }, [token, callApi])

  const loadInsights = useCallback(async (accs) => {
    setInsightsLoading(true)
    const results = {}
    let totalSpend = 0, totalImpr = 0, ctrs = [], active = 0

    await Promise.all((accs || accounts).map(async acc => {
      if (acc.account_status === 1) active++
      try {
        const data = await callApi(`act_${acc.account_id}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpm,reach,frequency,actions',
          date_preset: `last_${days}_days`
        })
        if (data.data && data.data[0]) {
          const d = data.data[0]
          results[acc.account_id] = d
          totalSpend += parseFloat(d.spend || 0)
          totalImpr += parseInt(d.impressions || 0)
          if (parseFloat(d.ctr) > 0) ctrs.push(parseFloat(d.ctr))
        }
      } catch (e) { /* skip */ }
    }))

    setInsights(results)
    setSummary({
      spend: totalSpend,
      impr: totalImpr,
      ctr: ctrs.length ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : 0,
      active
    })
    setInsightsLoading(false)
  }, [accounts, days, callApi])

  useEffect(() => {
    if (accounts.length > 0) loadInsights(accounts)
  }, [days])

  const filtered = filter === 'all' ? accounts : accounts.filter(a => {
    if (filter === 'active') return a.account_status === 1
    if (filter === 'inactive') return a.account_status !== 1
    return true
  })

  return (
    <div className={styles.root}>
      {/* Watermark */}
      <div className={styles.wm}><span>merakiads</span></div>

      {/* Topbar */}
      <div className={styles.topbar}>
        <span className={styles.logo}><span className={styles.logoG}>meraki</span><span className={styles.logoB}>ads</span></span>
        <div className={styles.tbDiv} />
        <span className={styles.tbLbl}>Meta Live Dashboard</span>
        <div className={styles.liveDot} />
        <div className={styles.tbRight}>
          <div className={styles.dateTabs}>
            {[7, 30, 90].map(d => (
              <button key={d} className={`${styles.dtab} ${days === d ? styles.dtabActive : ''}`} onClick={() => setDays(d)}>
                {d}D
              </button>
            ))}
          </div>
          <button className={styles.btnOutline} onClick={loadAccounts}>↻ Refresh</button>
        </div>
      </div>

      {/* Token Bar */}
      <div className={styles.tokenBar}>
        <span className={styles.tokenLbl}>Access Token:</span>
        <input
          className={styles.tokenInput}
          type="password"
          placeholder="Paste your Meta access token here (or set META_ACCESS_TOKEN env var)..."
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadAccounts()}
        />
        <button className={styles.btnPrimary} onClick={loadAccounts}>Load Data →</button>
      </div>

      <div className={styles.main}>
        {/* KPI Row */}
        <div className={styles.kpiRow}>
          <KpiCard label="Total Accounts" value={accounts.length || '—'} sub="across all clients" />
          <KpiCard label="Active Accounts" value={summary.active || '—'} sub="running campaigns" color="g" />
          <KpiCard label={`Spend (${days}D)`} value={fmt(summary.spend, true)} sub="across all accounts" color="b" />
          <KpiCard label="Impressions" value={fmt(summary.impr)} sub={`last ${days} days`} />
          <KpiCard label="Avg CTR" value={summary.ctr > 0 ? summary.ctr.toFixed(2) + '%' : '—'} sub="across accounts" color="g" />
        </div>

        {/* Error */}
        {error && <div className={styles.errorBox}><strong>⚠ Error</strong>{error}</div>}

        {/* Filter + Header */}
        <div className={styles.secHdr}>
          <div className={styles.secTtl}>Ad Accounts</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['all', 'active', 'inactive'].map(f => (
              <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'active' ? '● Active' : '○ Inactive'}
              </button>
            ))}
            <span className={styles.accCount}>{filtered.length} accounts</span>
          </div>
        </div>

        {/* Accounts */}
        <div className={styles.accounts}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              Fetching your ad accounts...
            </div>
          )}
          {!loading && accounts.length === 0 && !error && (
            <div className={styles.empty}>Enter your token above and click "Load Data" to see your live ad accounts.</div>
          )}
          {filtered.map(acc => (
            <AccRow
              key={acc.account_id}
              acc={acc}
              insights={insights[acc.account_id]}
              loading={insightsLoading && !insights[acc.account_id]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
