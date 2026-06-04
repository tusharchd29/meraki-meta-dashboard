'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSpend(n, sym = '₹') {
  const num = parseFloat(n || 0)
  if (!num) return sym + '0'
  if (num >= 100000) return sym + (num / 100000).toFixed(1) + 'L'
  if (num >= 1000) return sym + (num / 1000).toFixed(1) + 'K'
  return sym + num.toFixed(0)
}
function fmtNum(n) {
  const num = parseFloat(n || 0)
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return Math.round(num).toString()
}
function currSym(cur) {
  if (cur === 'THB') return '฿'
  if (cur === 'NZD') return 'NZ$'
  if (cur === 'USD') return '$'
  return '₹'
}
function getDateParams(preset, customFrom, customTo) {
  if (preset === 'Today') return { date_preset: 'today' }
  if (preset === 'Last 7D') return { date_preset: 'last_7_days' }
  if (preset === '14D') return { date_preset: 'last_14_days' }
  if (preset === '30D') return { date_preset: 'last_30_days' }
  if (preset === 'This Month') return { date_preset: 'this_month' }
  if (preset === 'custom' && customFrom && customTo)
    return { time_range: JSON.stringify({ since: customFrom, until: customTo }) }
  return { date_preset: 'last_7_days' }
}
function getObjLabel(obj) {
  const map = {
    OUTCOME_LEADS: 'LEADS', OUTCOME_SALES: 'SALES', OUTCOME_AWARENESS: 'AWARENESS',
    OUTCOME_ENGAGEMENT: 'ENGAGEMENT', OUTCOME_TRAFFIC: 'TRAFFIC', OUTCOME_APP_PROMOTION: 'APP',
    LINK_CLICKS: 'TRAFFIC', POST_ENGAGEMENT: 'ENGAGEMENT', VIDEO_VIEWS: 'AWARENESS',
    REACH: 'AWARENESS', BRAND_AWARENESS: 'AWARENESS', LEAD_GENERATION: 'LEADS',
    CONVERSIONS: 'SALES', MESSAGES: 'LEADS', PAGE_LIKES: 'ENGAGEMENT',
  }
  const clean = (obj || '').toUpperCase().replace(/\s+/g, '_')
  return map[clean] || obj || '—'
}
function getObjCls(obj) {
  const label = getObjLabel(obj)
  if (label === 'LEADS') return 'obj-leads'
  if (label === 'SALES') return 'obj-sales'
  if (label === 'AWARENESS') return 'obj-aware'
  if (label === 'ENGAGEMENT') return 'obj-eng'
  if (label === 'TRAFFIC') return 'obj-traffic'
  return 'obj-traffic'
}
function getAccStatus(acc) {
  if (acc.account_status === 2) return { cls: 'off', dot: 'e', badge: 'DISABLED', badgeCls: 'sb-off' }
  if (acc.account_status === 3) return { cls: 'err', dot: 'r', badge: 'UNSETTLED', badgeCls: 'sb-err' }
  if (acc.account_status === 9) return { cls: 'err', dot: 'r', badge: 'GRACE PERIOD', badgeCls: 'sb-err' }
  if (acc.account_status === 101 || acc.account_status === 201) return { cls: 'off', dot: 'e', badge: 'CLOSED', badgeCls: 'sb-off' }
  if (acc.account_status === 7) return { cls: 'warn', dot: 'a', badge: 'PENDING', badgeCls: 'sb-warn' }
  return { cls: 'ok', dot: 'g', badge: 'LIVE', badgeCls: 'sb-live' }
}
function getCampStatus(c) {
  const s = (c.effective_status || c.status || '').toUpperCase()
  if (s === 'ACTIVE') return { dot: 'on', label: 'Active' }
  if (s === 'PAUSED') return { dot: 'na', label: 'Paused' }
  if (s === 'ARCHIVED') return { dot: 'na', label: 'Archived' }
  if (s.includes('DELETED')) return { dot: 'off', label: 'Deleted' }
  if (s.includes('ERROR') || s.includes('DISAPPROVED')) return { dot: 'off', label: s }
  if (s.includes('PENDING')) return { dot: 'warn', label: 'Pending' }
  return { dot: 'na', label: s || '—' }
}
function getResultSummary(ins) {
  if (!ins) return { text: '—', cls: '' }
  const spend = parseFloat(ins.spend || 0)
  // Try actions
  if (ins.actions && ins.actions.length) {
    // Prefer leads/purchase/messaging
    const priority = ['lead','purchase','onsite_conversion.messaging_first_reply','onsite_conversion.lead_grouped','contact_total']
    for (const key of priority) {
      const a = ins.actions.find(x => x.action_type === key || x.action_type?.includes(key))
      if (a) {
        const count = parseInt(a.value || 0)
        const cpa = count > 0 ? (spend / count).toFixed(0) : null
        const lbl = key.includes('purchase') ? 'Purchases' : key.includes('lead') ? 'Leads' : key.includes('message') || key.includes('contact') ? 'Convos' : 'Results'
        const sym = ins._sym || '₹'
        return { text: `${count} ${lbl}${cpa ? ' · ' + sym + cpa + ' each' : ''}`, cls: count > 0 ? 'green' : 'red' }
      }
    }
    // Fallback: first action
    const a = ins.actions[0]
    const count = parseInt(a.value || 0)
    return { text: `${count} ${a.action_type?.split('.').pop() || 'results'}`, cls: count > 0 ? 'green' : '' }
  }
  // No actions — show impressions
  if (ins.impressions) return { text: fmtNum(ins.impressions) + ' impressions', cls: '' }
  return { text: '—', cls: '' }
}
const COLOR_MAP = { green: 'var(--green-dk)', red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue-dk)' }

// ── API helper ────────────────────────────────────────────────────────────────
async function metaFetch(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params })
  const res = await fetch(`/api/meta?${qs}`)
  return res.json()
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Spinner({ size = 14 }) {
  return (
    <div style={{
      width: size, height: size, border: `2px solid var(--border)`,
      borderTopColor: 'var(--green)', borderRadius: '50%',
      animation: 'spin .7s linear infinite', flexShrink: 0
    }} />
  )
}

function AccCard({ acc, dateParams, activeDateLabel }) {
  const [open, setOpen] = useState(false)
  const [camps, setCamps] = useState([])
  const [campLoading, setCampLoading] = useState(false)
  const [accIns, setAccIns] = useState(null)
  const [insLoading, setInsLoading] = useState(false)
  const fetchedRef = useRef(false)

  const st = getAccStatus(acc)
  const sym = currSym(acc.currency)
  const ins = accIns

  // Fetch account-level insights immediately on mount / dateParams change
  useEffect(() => {
    async function load() {
      setInsLoading(true)
      setAccIns(null)
      try {
        const data = await metaFetch(`act_${acc.account_id}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpm,reach,frequency,actions,cost_per_action_type',
          ...dateParams
        })
        const d = data.data?.[0] || null
        if (d) d._sym = sym
        setAccIns(d)
      } catch (e) { setAccIns(null) }
      setInsLoading(false)
    }
    load()
    fetchedRef.current = false
  }, [acc.account_id, JSON.stringify(dateParams)])

  // Fetch campaigns when card is opened (once, then re-fetch on date change)
  useEffect(() => {
    if (!open) return
    fetchedRef.current = false
    loadCampaigns()
  }, [open, JSON.stringify(dateParams)])

  async function loadCampaigns() {
    if (campLoading) return
    setCampLoading(true)
    setCamps([])
    try {
      // Fetch campaigns list
      const campData = await metaFetch(`act_${acc.account_id}/campaigns`, {
        fields: 'name,objective,status,effective_status,daily_budget,lifetime_budget',
        limit: '20'
      })
      const rawCamps = campData.data || []
      if (!rawCamps.length) { setCampLoading(false); return }

      // Fetch insights for each campaign in parallel
      const withInsights = await Promise.all(rawCamps.map(async c => {
        try {
          const ins = await metaFetch(`${c.id}/insights`, {
            fields: 'spend,impressions,clicks,ctr,cpm,frequency,actions,reach',
            ...dateParams
          })
          const d = ins.data?.[0] || null
          if (d) d._sym = sym
          return { ...c, insights: d }
        } catch { return { ...c, insights: null } }
      }))
      setCamps(withInsights)
    } catch (e) { setCamps([]) }
    setCampLoading(false)
  }

  const spend = ins ? parseFloat(ins.spend || 0) : null
  const impr = ins ? parseInt(ins.impressions || 0) : null
  const ctr = ins ? parseFloat(ins.ctr || 0) : null
  const freq = ins ? parseFloat(ins.frequency || 0) : null
  const cpm = ins ? parseFloat(ins.cpm || 0) : null
  const reach = ins ? parseInt(ins.reach || 0) : null

  return (
    <div className={`acc-card ${st.cls}${open ? ' open' : ''}`}>
      <div className="acc-hdr" onClick={() => setOpen(o => !o)}>
        <div className="acc-exp">›</div>
        <div className={`acc-sdot ${st.dot}`} />
        <div className="acc-info">
          <div className="acc-name">{acc.name}</div>
          <div className="acc-meta">#{acc.account_id} · {acc.currency} · {activeDateLabel}</div>
        </div>

        {/* KPIs */}
        <div className="acc-kpis">
          {insLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
              <Spinner size={12} /><span style={{ fontSize: 10, color: 'var(--text3)' }}>Loading…</span>
            </div>
          ) : ins ? (
            <>
              <div className="kc"><div className="kc-lbl">Spend</div>
                <div className={`kc-val ${spend > 0 ? 'g' : 'n'}`}>{fmtSpend(spend, sym)}</div></div>
              <div className="kc"><div className="kc-lbl">Impressions</div>
                <div className="kc-val n">{fmtNum(impr)}</div></div>
              <div className="kc"><div className="kc-lbl">CTR</div>
                <div className={`kc-val ${ctr >= 1.5 ? 'g' : ctr > 0 && ctr < 0.8 ? 'r' : 'n'}`}>
                  {ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">CPM</div>
                <div className="kc-val n">{cpm > 0 ? sym + cpm.toFixed(0) : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">Reach</div>
                <div className="kc-val n">{reach > 0 ? fmtNum(reach) : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">Freq</div>
                <div className={`kc-val ${freq >= 2.5 ? 'r' : freq >= 2 ? 'a' : 'n'}`}>
                  {freq > 0 ? freq.toFixed(2) : '—'}</div></div>
            </>
          ) : (
            <div className="kc"><div className="kc-lbl">Spend</div>
              <div className="kc-val n">No data</div></div>
          )}
        </div>

        <div className="acc-right">
          <div className="acc-badges">
            <span className={`s-badge ${st.badgeCls}`}>{st.badge}</span>
            {freq >= 2.5 && <span className="chip-r">Freq {freq?.toFixed(2)}</span>}
            {freq >= 2 && freq < 2.5 && <span className="chip-a">Freq {freq?.toFixed(2)}</span>}
          </div>
          {spend !== null && (
            <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', marginTop: 2 }}>
              {ins?.actions ? getResultSummary(ins).text : ''}
            </div>
          )}
        </div>
      </div>

      <div className="acc-body">
        {campLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px', color: 'var(--text3)', fontSize: 12 }}>
            <Spinner size={14} /> Fetching campaigns from Meta API…
          </div>
        )}

        {!campLoading && camps.length === 0 && open && (
          <div className="no-data-box">No campaign data for this period.</div>
        )}

        {!campLoading && camps.length > 0 && (
          <table className="camp-tbl">
            <thead>
              <tr><th>Campaign</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr>
            </thead>
            <tbody>
              {camps.map((c, i) => {
                const ci = c.insights
                const cs = getCampStatus(c)
                const cspend = ci ? parseFloat(ci.spend || 0) : null
                const cctr = ci ? parseFloat(ci.ctr || 0) : null
                const cfreq = ci ? parseFloat(ci.frequency || 0) : null
                const res = ci ? getResultSummary(ci) : { text: '—', cls: '' }
                return (
                  <tr key={c.id || i}>
                    <td><b>{c.name}</b></td>
                    <td><span className={`obj-b ${getObjCls(c.objective)}`}>{getObjLabel(c.objective)}</span></td>
                    <td>{cspend !== null ? fmtSpend(cspend, sym) : '—'}</td>
                    <td style={{ color: COLOR_MAP[res.cls], fontWeight: res.cls ? 600 : 400 }}>{res.text}</td>
                    <td style={cctr >= 1.5 ? { color: 'var(--green-dk)' } : cctr > 0 && cctr < 0.8 ? { color: 'var(--red)' } : {}}>
                      {cctr > 0 ? cctr.toFixed(2) + '%' : '—'}
                    </td>
                    <td style={cfreq >= 2.5 ? { color: 'var(--red)', fontWeight: 600 } : cfreq >= 2 ? { color: 'var(--amber)' } : {}}>
                      {cfreq > 0 ? cfreq.toFixed(2) : '—'}
                    </td>
                    <td>
                      <div className="st-ind">
                        <div className={`st-dot ${cs.dot}`} />
                        {cs.label}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Live summary insights */}
        {ins && !campLoading && (
          <div className="insight-row">
            <div className="insight-box ib-trend">
              <div className="ib-ttl">📡 Live — {activeDateLabel}</div>
              <div className="ib-item">Spend: <b>{fmtSpend(spend, sym)}</b> · Impressions: <b>{fmtNum(impr)}</b> · Reach: <b>{fmtNum(reach)}</b></div>
              <div className="ib-item">CTR: <b>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</b> · CPM: <b>{cpm > 0 ? sym + cpm.toFixed(0) : '—'}</b> · Freq: <b>{freq > 0 ? freq.toFixed(2) : '—'}</b></div>
              {ins.actions?.length > 0 && (
                <div className="ib-item">
                  Top result: <b>{getResultSummary(ins).text}</b>
                </div>
              )}
            </div>
            {freq >= 2 && (
              <div className="insight-box ib-warn">
                <div className="ib-ttl">⚠ Frequency Alert</div>
                <div className="ib-item">Frequency <b>{freq.toFixed(2)}</b> — {freq >= 2.5 ? 'audience fatigue risk, consider refreshing creatives or expanding audience' : 'approaching fatigue, monitor closely'}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [view, setView] = useState('accounts')
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('Last 7D')
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const customRef = useRef(null)

  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [accounts, setAccounts] = useState([])
  const [accsLoading, setAccsLoading] = useState(false)
  const [accsError, setAccsError] = useState('')

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('meta_token') : ''
    if (saved) { setToken(saved); setTokenInput(saved) }
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (customRef.current && !customRef.current.contains(e.target)) setShowCustom(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]

  function applyCustom() {
    if (!customFrom || !customTo) return
    const fmt = d => { const [y, m, dd] = d.split('-'); return dd + '/' + m }
    setCustomLabel(fmt(customFrom) + '–' + fmt(customTo))
    setDateRange('custom')
    setShowCustom(false)
  }

  const activeDateLabel = dateRange === 'custom' ? customLabel : dateRange
  const dateParams = getDateParams(dateRange, customFrom, customTo)

  // Fetch ad accounts when token is set
  useEffect(() => {
    if (!token) return
    async function load() {
      setAccsLoading(true)
      setAccsError('')
      try {
        const data = await metaFetch('me/adaccounts', {
          token,
          fields: 'name,account_id,account_status,currency,amount_spent',
          limit: '50'
        })
        if (data.error) { setAccsError(data.error.message); setAccsLoading(false); return }
        setAccounts(data.data || [])
      } catch (e) { setAccsError(e.message) }
      setAccsLoading(false)
    }
    load()
  }, [token])

  function saveToken(t) {
    setToken(t)
    if (typeof window !== 'undefined') localStorage.setItem('meta_token', t)
  }

  // Inject token into dateParams for all children
  const dpWithToken = { ...dateParams, token }

  // Stats from accounts
  const activeAccs = accounts.filter(a => a.account_status === 1).length

  const filtered = filter === 'all' ? accounts : accounts.filter(a => {
    const n = a.name.toLowerCase()
    return n.includes(filter.toLowerCase())
  })

  const sidebar_static = [
    { section: 'Accounts' },
    { key: 'all', dot: 'g', name: 'All Accounts', filter: 'all' },
  ]

  return (
    <>
      {/* BG */}
      <div className="bg-layer">
        <svg className="bl-1" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" /></svg>
        <svg className="bl-2" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" /></svg>
        <svg className="bl-3" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0z" /></svg>
        <svg className="bl-4" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" /></svg>
      </div>
      <div className="wm"><span>merakiads</span></div>

      {/* TOPBAR */}
      <div className="topbar">
        <a className="logo" href="#"><span className="m">meraki</span><span className="a">ads</span></a>
        <div className="topbar-div" />
        <span className="topbar-lbl">Meta Intelligence · Live</span>
        <div className="view-tabs">
          {['accounts', 'campaigns'].map(v => (
            <div key={v} className={`vtab${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              {v === 'accounts' ? 'Account View' : 'All Campaigns'}
            </div>
          ))}
        </div>
        <div className="topbar-right">
          {token ? (
            <>
              <span className="pill pill-g">● {activeAccs} Active</span>
              <span className="pill pill-b">{accounts.length} Accounts</span>
            </>
          ) : (
            <span className="pill pill-a">⚠ No Token</span>
          )}
          <button className="refresh-btn" onClick={() => { if (token) saveToken(token) }}>↻ Refresh</button>
        </div>
      </div>

      {/* TOKEN BAR */}
      <div style={{ background: token ? 'var(--green-lt)' : 'var(--amber-lt)', borderBottom: '1px solid', borderColor: token ? 'var(--green-bd)' : 'var(--amber-bd)', padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: token ? 'var(--green-dk)' : 'var(--amber)', whiteSpace: 'nowrap' }}>
          {token ? '✓ Connected' : '⚠ Meta Token:'}
        </span>
        <input
          type="password"
          placeholder="Paste your Meta access token and press Enter…"
          value={tokenInput}
          onChange={e => setTokenInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && tokenInput.trim()) saveToken(tokenInput.trim()) }}
          style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '4px 10px', border: '1px solid', borderColor: token ? 'var(--green-bd)' : 'var(--amber-bd)', borderRadius: 7, background: '#fff', outline: 'none' }}
        />
        {token
          ? <button onClick={() => { setToken(''); setTokenInput(''); setAccounts([]); localStorage.removeItem('meta_token') }}
            style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}>× Clear</button>
          : <button onClick={() => { if (tokenInput.trim()) saveToken(tokenInput.trim()) }}
            style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 7, border: 'none', background: 'var(--green)', color: '#fff', cursor: 'pointer' }}>Load →</button>
        }
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sb-section">All Clients</div>
        <div className={`sb-item${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          <div className="sb-dot g" /><span className="sb-name">All Accounts</span>
          <span className="sb-score sc-na">{accounts.length || '—'}</span>
        </div>
        {accounts.length > 0 && (
          <>
            <div className="sb-section" style={{ marginTop: 4 }}>By Account</div>
            {accounts.map(a => {
              const st = getAccStatus(a)
              return (
                <div key={a.account_id} className={`sb-item${filter === a.account_id ? ' active' : ''}`}
                  onClick={() => setFilter(a.account_id)}>
                  <div className={`sb-dot ${st.dot}`} />
                  <span className="sb-name">{a.name}</span>
                  <span className={`sb-score ${a.account_status === 1 ? 'sc-hi' : 'sc-na'}`}>
                    {a.account_status === 1 ? 'ON' : 'OFF'}
                  </span>
                </div>
              )
            })}
          </>
        )}
        <div className="sb-section" style={{ marginTop: 6 }}>Status</div>
        <div className="sb-info">
          📅 {activeDateLabel}<br />
          🔗 Meta API · {token ? <span style={{ color: 'var(--green-dk)' }}>Connected</span> : <span style={{ color: 'var(--red)' }}>No token</span>}
          {accsLoading && <><br /><span style={{ color: 'var(--amber)' }}>⟳ Loading accounts…</span></>}
          {accounts.length > 0 && !accsLoading && <><br /><span style={{ color: 'var(--green-dk)' }}>✓ {accounts.length} accounts loaded</span></>}
          {accsError && <><br /><span style={{ color: 'var(--red)' }}>✗ {accsError}</span></>}
        </div>
      </div>

      {/* STATSBAR */}
      <div className="statsbar">
        {accsLoading ? (
          <div className="kpi-pill kpi-n"><Spinner size={11} /><span className="kpi-lbl" style={{ marginLeft: 4 }}>Loading accounts…</span></div>
        ) : accounts.length > 0 ? (
          <>
            <div className="kpi-pill kpi-g"><div className="kpi-dot" /><span className="kpi-lbl">Total Accounts</span><span className="kpi-val">{accounts.length}</span></div>
            <div className="kpi-pill kpi-g"><div className="kpi-dot" /><span className="kpi-lbl">Active</span><span className="kpi-val">{activeAccs}</span></div>
            <div className="kpi-pill kpi-r"><div className="kpi-dot" /><span className="kpi-lbl">Issues</span><span className="kpi-val">{accounts.filter(a => a.account_status !== 1).length}</span></div>
          </>
        ) : (
          <div className="kpi-pill kpi-n"><div className="kpi-dot" /><span className="kpi-lbl">Awaiting token</span><span className="kpi-val">—</span></div>
        )}
        <div className="sb-sep" />
        <div className="date-grp">
          {['Today', 'Last 7D', '14D', '30D', 'This Month'].map(d => (
            <button key={d} className={`dr${dateRange === d ? ' active' : ''}`}
              onClick={() => { setDateRange(d); setShowCustom(false) }}>{d}</button>
          ))}
          <div className="custom-range-wrap" ref={customRef}>
            <button className={`dr${dateRange === 'custom' ? ' active' : ''}`} onClick={() => setShowCustom(s => !s)}>
              {dateRange === 'custom' ? customLabel : 'Custom ▾'}
            </button>
            {showCustom && (
              <div className="custom-picker">
                <div className="custom-picker-row">
                  <label>From</label>
                  <input type="date" max={customTo || todayStr} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div className="custom-picker-row">
                  <label>To</label>
                  <input type="date" min={customFrom} max={todayStr} value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
                <div className="custom-picker-btns">
                  <button className="custom-picker-cancel" onClick={() => setShowCustom(false)}>Cancel</button>
                  <button className="custom-picker-apply" onClick={applyCustom}>Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-wrap"><div className="main">

        {/* No token state */}
        {!token && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Connect your Meta account</div>
            <div style={{ fontSize: 12, maxWidth: 400, margin: '0 auto' }}>
              Paste your Meta access token in the bar above and press Enter. All data — accounts, campaigns, spend, results — will load live from Meta API.
            </div>
          </div>
        )}

        {/* Loading state */}
        {token && accsLoading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13 }}>Fetching your Meta ad accounts…</div>
          </div>
        )}

        {/* Error state */}
        {accsError && (
          <div className="err-box" style={{ margin: 0, marginBottom: 12 }}>
            <strong>⚠ API Error</strong> {accsError}
          </div>
        )}

        {/* ACCOUNT VIEW */}
        {token && !accsLoading && accounts.length > 0 && view === 'accounts' && (
          <div>
            <div className="sec-hdr">
              <div className="sec-ttl">
                Client Accounts <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {filter !== 'all' && <button onClick={() => setFilter('all')} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', marginRight: 6 }}>× Clear filter</button>}
                {filtered.length} accounts
              </span>
            </div>
            <div className="accounts">
              {filtered.map(acc => (
                <AccCard
                  key={acc.account_id + JSON.stringify(dateParams)}
                  acc={acc}
                  dateParams={dpWithToken}
                  activeDateLabel={activeDateLabel}
                />
              ))}
            </div>
          </div>
        )}

        {/* CAMPAIGNS VIEW — cross-account campaign table */}
        {token && !accsLoading && accounts.length > 0 && view === 'campaigns' && (
          <CampaignsView
            accounts={filtered}
            dateParams={dpWithToken}
            activeDateLabel={activeDateLabel}
          />
        )}

      </div></div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

// ── All Campaigns cross-account view ─────────────────────────────────────────
function CampaignsView({ accounts, dateParams, activeDateLabel }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accounts.length) return
    async function load() {
      setLoading(true)
      setRows([])
      const all = []
      await Promise.all(accounts.map(async acc => {
        try {
          const campData = await metaFetch(`act_${acc.account_id}/campaigns`, {
            fields: 'name,objective,status,effective_status',
            limit: '20',
            ...dateParams
          })
          const camps = campData.data || []
          await Promise.all(camps.map(async c => {
            const ins = await metaFetch(`${c.id}/insights`, {
              fields: 'spend,impressions,clicks,ctr,cpm,frequency,actions,reach',
              ...dateParams
            })
            const d = ins.data?.[0] || null
            const sym = currSym(acc.currency)
            if (d) d._sym = sym
            const cs = getCampStatus(c)
            const res = d ? getResultSummary(d) : { text: '—', cls: '' }
            all.push({
              campName: c.name,
              accName: acc.name,
              accId: acc.account_id,
              obj: c.objective,
              spend: d ? parseFloat(d.spend || 0) : null,
              result: res,
              ctr: d ? parseFloat(d.ctr || 0) : null,
              freq: d ? parseFloat(d.frequency || 0) : null,
              status: cs,
              sym,
            })
          }))
        } catch (e) { /* skip */ }
      }))
      // Sort by spend desc
      all.sort((a, b) => (b.spend || 0) - (a.spend || 0))
      setRows(all)
      setLoading(false)
    }
    load()
  }, [accounts.length, JSON.stringify(dateParams)])

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">All Campaigns <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length} campaigns</span>
      </div>
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 12 }}>
          <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 10px' }} />
          Fetching all campaigns from Meta API…
        </div>
      )}
      {!loading && rows.length > 0 && (
        <div className="tbl-wrap">
          <table className="all-camp-tbl">
            <thead><tr><th>Campaign</th><th>Account</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.campName}</b></td>
                  <td style={{ color: 'var(--text2)', fontSize: 11 }}>{r.accName}</td>
                  <td><span className={`obj-b ${getObjCls(r.obj)}`}>{getObjLabel(r.obj)}</span></td>
                  <td>{r.spend !== null ? fmtSpend(r.spend, r.sym) : '—'}</td>
                  <td style={{ color: COLOR_MAP[r.result.cls], fontWeight: r.result.cls ? 600 : 400 }}>{r.result.text}</td>
                  <td style={r.ctr >= 1.5 ? { color: 'var(--green-dk)' } : r.ctr > 0 && r.ctr < 0.8 ? { color: 'var(--red)' } : {}}>
                    {r.ctr > 0 ? r.ctr.toFixed(2) + '%' : '—'}
                  </td>
                  <td style={r.freq >= 2.5 ? { color: 'var(--red)', fontWeight: 600 } : r.freq >= 2 ? { color: 'var(--amber)' } : {}}>
                    {r.freq > 0 ? r.freq.toFixed(2) : '—'}
                  </td>
                  <td>
                    <div className="st-ind">
                      <div className={`st-dot ${r.status.dot}`} />
                      {r.status.label}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length === 0 && (
        <div className="no-data-box">No campaign data found for this period.</div>
      )}
    </div>
  )
}
