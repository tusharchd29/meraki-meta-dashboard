import { useEffect, useState } from 'react'

const SYM = c => c==='THB'?'฿':c==='NZD'?'NZ$':c==='AUD'?'A$':'₹'
const fmt = (n, sym='₹') => sym + Math.round(n||0).toLocaleString('en-IN')
const currentMonthStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }

function makeSemaphore(max=6) {
  let running=0; const queue=[]
  const run=()=>{while(running<max&&queue.length>0){const{fn,resolve,reject}=queue.shift();running++;fn().then(v=>{running--;run();resolve(v)}).catch(e=>{running--;run();reject(e)})}}
  return fn=>new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});run()})
}

function metaSpend(accountId, preset) {
  const qs = new URLSearchParams({ endpoint: `${accountId}/insights`, fields: 'spend', date_preset: preset })
  return fetch(`/api/meta?${qs}`, { cache:'no-store' }).then(r=>r.json())
    .then(d => parseFloat(d?.data?.[0]?.spend || 0)).catch(()=>0)
}

// Google spend comes from manually imported exports, not a live API.

// Budget was previously display-only — there was no way in the UI to
// actually set a client's budget. This makes it editable and auto-stamps
// monthly_budget_month so a stale (last month's) budget can be flagged
// instead of silently reused. `field` is 'meta_monthly_budget' or
// 'google_monthly_budget' — budgets are approved separately per platform.
function BudgetCell({ client, field, S, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(client[field] ?? '')
  const [saving, setSaving] = useState(false)
  const isStale = client[field] != null && client.monthly_budget_month && client.monthly_budget_month !== currentMonthStr()

  useEffect(() => { setValue(client[field] ?? '') }, [client[field]])

  const save = async () => {
    const num = value === '' ? null : Number(value)
    if (value !== '' && (isNaN(num) || num < 0)) return
    setSaving(true)
    await onSave(client.id, field, num)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" min="0" autoFocus value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={save}
          style={{ width: 90, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1.5px solid var(--green-bd)' }}
        />
        {saving && <span style={{ fontSize: 10, color: 'var(--text3)' }}>saving…</span>}
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Click to edit budget">
      {client[field] != null ? fmt(client[field], S) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>set →</span>}
      {isStale && <span className="pill pill-a" style={{ fontSize: 9 }} title={`Last set for ${client.monthly_budget_month} — confirm it still applies this month`}>stale</span>}
    </div>
  )
}

export default function ClientsView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spend, setSpend] = useState({})
  const [loadingSpend, setLoadingSpend] = useState(false)
  const [editing, setEditing] = useState(false)
  const [googleSpendMap, setGoogleSpendMap] = useState({})
  const [googleMeta, setGoogleMeta] = useState({})

  const load = () => {
    setLoading(true)
    fetch('/api/client-map', { cache:'no-store' })
      .then(r=>r.json())
      .then(d => { setData(d); setError(d.error||null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }
  useEffect(load, [])

  const loadGoogle = () => {
    fetch('/api/google-spend', { cache:'no-store' }).then(r=>r.json())
      .then(d => { setGoogleSpendMap(d.latest||{}); setGoogleMeta(d.mtd||{}) })
      .catch(()=>{})
  }
  useEffect(loadGoogle, [])

  // Fetch spend for every mapped client, per platform
  useEffect(() => {
    if (!data?.clients) return
    const mapped = data.clients.filter(c => c.meta_account || c.google_account)
    if (mapped.length === 0) return
    setLoadingSpend(true)
    const sem = makeSemaphore(10)

    Promise.all(mapped.map(async c => {
      const result = { meta:null, google:null }
      if (c.meta_account) {
        const [today, week, month] = await Promise.all([
          sem(()=>metaSpend(c.meta_account.account_id, 'today')),
          sem(()=>metaSpend(c.meta_account.account_id, 'this_week_mon_today')),
          sem(()=>metaSpend(c.meta_account.account_id, 'this_month')),
        ])
        result.meta = { today, week, month, currency: c.meta_account.currency }
      }
      // Google figures come from the imported map, keyed by customer id
      // (digits only, since exports and stored ids can differ in formatting).
      return [c.id, result]
    })).then(entries => {
      setSpend(Object.fromEntries(entries))
      setLoadingSpend(false)
    }).catch(()=>setLoadingSpend(false))
  }, [JSON.stringify(data?.clients?.map(c=>[c.id, c.meta_account?.account_id, c.google_account?.account_id]))])

  const setMapping = async (clientId, field, value) => {
    await fetch('/api/client-map', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ clientId, [field]: value || null })
    })
    load()
  }

  const saveBudget = async (clientId, field, value) => {
    const body = { clientId, budgetMonth: value == null ? null : currentMonthStr() }
    body[field === 'meta_monthly_budget' ? 'metaMonthlyBudget' : 'googleMonthlyBudget'] = value
    await fetch('/api/client-map', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    })
    load()
  }

  if (loading) return <div className="no-data-box">Loading clients…</div>
  if (error) return <div className="no-data-box" style={{color:'var(--red)'}}>Error: {error}</div>

  const clients = data?.clients || []
  const mapped = clients.filter(c => c.meta_account || c.google_account)
  const both = mapped.filter(c => c.meta_account && c.google_account)

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Clients — Individual &amp; Blended</div>
        <button className="refresh-btn" onClick={()=>setEditing(e=>!e)}>
          {editing ? '✓ Done mapping' : '⚙ Map accounts'}
        </button>
      </div>

      <div style={{fontSize:11, color:'var(--text3)', marginBottom:10}}>
        {mapped.length} of {clients.length} clients mapped · {both.length} running on both platforms.
        {(data?.unmapped?.meta?.length > 0 || data?.unmapped?.google?.length > 0) && (
          <span style={{color:'var(--amber)'}} title="These already appear in the Monthly Report on their own, using the budget set in Connections. Map them here only if you want a custom name, a different budget, or to blend Meta + Google spend into one client.">
            {' '}Tracked but unmapped ({(data.unmapped.meta||[]).length + (data.unmapped.google||[]).length}) — reported individually unless mapped for blending: {[...(data.unmapped.meta||[]), ...(data.unmapped.google||[])].join(', ')}
          </span>
        )}
      </div>

      <div style={{fontSize:11, color:'var(--text3)', marginBottom:16, padding:'8px 12px', background:'rgba(41,171,226,.06)', border:'1px solid var(--blue-bd)', borderRadius:8}}>
        Importing a Google Ads export? That now lives on the <b>Google Ads</b> tab — imports uploaded there
        use the same client mapping and budgets as this table, so nothing else changes.
      </div>

      <div className="tbl-wrap" style={{overflowX:'auto'}}>
        <table style={{width:'100%', minWidth:900, borderCollapse:'collapse', fontSize:12}}>
          <thead>
            <tr style={{borderBottom:'1.5px solid var(--border)'}}>
              {['Client','Platforms','Meta (MTD)','Google (MTD)','Blended (MTD)','Meta Budget','Google Budget','Pacing'].map(h=>(
                <th key={h} style={{textAlign:'left', padding:'8px 10px', color:'var(--text3)', fontWeight:600, fontSize:11}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const s = spend[c.id] || {}
              const metaM = s.meta?.month || 0
              const g = googleSpendMap[c.id]
              const gMtd = googleMeta[c.id]
              // Prefer true month-to-date from daily data; fall back to the
              // latest period total, which covers a different range.
              const googleM = gMtd ? gMtd.month : (g ? Number(g.account_cost||0) : 0)
              const blended = metaM + googleM
              const cur = c.meta_account?.currency || c.google_account?.currency || 'INR'
              const S = SYM(cur)
              // Budgets are approved separately per platform now. The
              // combined figure used for this row's pacing is their sum;
              // monthly_budget (legacy, single combined field) is only used
              // as a fallback for clients not yet re-entered under the split
              // fields.
              const hasSplitBudget = c.meta_monthly_budget != null || c.google_monthly_budget != null
              const budget = hasSplitBudget
                ? Number(c.meta_monthly_budget || 0) + Number(c.google_monthly_budget || 0)
                : (c.monthly_budget ? Number(c.monthly_budget) : null)

              // Pacing against the combined approved budget
              let pace = null
              if (budget > 0) {
                const now = new Date()
                const expectedPct = (now.getDate() / new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()) * 100
                const actualPct = (blended / budget) * 100
                const diff = actualPct - expectedPct
                pace = {
                  label: diff > 15 ? 'Overspending' : diff < -15 ? 'Underspending' : 'On track',
                  cls: diff > 15 ? 'r' : diff < -15 ? 'a' : 'g',
                  actualPct, expectedPct,
                }
              }

              const mixedCurrency = c.meta_account && c.google_account &&
                c.meta_account.currency && c.google_account.currency &&
                c.meta_account.currency !== c.google_account.currency

              return (
                <tr key={c.id} style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'8px 10px', fontWeight:600}}>{c.name}</td>
                  <td style={{padding:'8px 10px'}}>
                    {editing ? (
                      <div style={{display:'flex', flexDirection:'column', gap:4}}>
                        <select
                          value={c.meta_ad_account_id || ''}
                          onChange={e=>setMapping(c.id, 'metaAccountId', e.target.value)}
                          style={{fontSize:11, padding:'2px 4px', maxWidth:200}}
                        >
                          <option value="">— no Meta account —</option>
                          {(data.available?.meta||[]).map(a=>(
                            <option key={a.account_id} value={a.account_id}>
                              {a.name || a.account_id}{a.claimed && a.account_id!==c.meta_ad_account_id ? ' (mapped elsewhere)' : ''}
                            </option>
                          ))}
                        </select>
                        <select
                          value={c.google_ads_customer_id || ''}
                          onChange={e=>setMapping(c.id, 'googleCustomerId', e.target.value)}
                          style={{fontSize:11, padding:'2px 4px', maxWidth:200}}
                        >
                          <option value="">— no Google account —</option>
                          {(data.available?.google||[]).map(a=>(
                            <option key={a.account_id} value={a.account_id}>
                              {a.name || a.account_id}{a.claimed && a.account_id!==c.google_ads_customer_id ? ' (mapped elsewhere)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div style={{display:'flex', gap:4}}>
                        {c.meta_account && <span className="pill pill-b" style={{fontSize:10}}>Meta</span>}
                        {c.google_account && <span className="pill pill-g" style={{fontSize:10}}>Google</span>}
                        {!c.meta_account && !c.google_account && <span style={{color:'var(--text3)'}}>— unmapped —</span>}
                        {(c.meta_untracked || c.google_untracked) && (
                          <span className="pill pill-a" style={{fontSize:10}} title="Mapped to an account that isn't currently tracked">untracked</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{padding:'8px 10px'}}>{c.meta_account ? fmt(metaM, SYM(c.meta_account.currency)) : '—'}</td>
                  <td style={{padding:'8px 10px'}}>
                    {gMtd ? (
                      <>
                        {fmt(googleM, SYM(gMtd.currency))}
                        <div style={{fontSize:9, color:'var(--text3)'}}>
                          month-to-date · to {gMtd.latest}
                        </div>
                      </>
                    ) : g ? (
                      <>
                        {fmt(googleM, SYM(g.currency))}
                        <div style={{fontSize:9, color:'var(--amber)'}} title="This export had no Day column, so it covers its own date range rather than the current month">
                          {g.period_start} → {g.period_end} · not month-to-date
                        </div>
                      </>
                    ) : <span style={{color:'var(--text3)',fontSize:10}}>no import</span>}
                  </td>
                  <td style={{padding:'8px 10px', fontWeight:600}}>
                    {mixedCurrency
                      ? <span title="Meta and Google are in different currencies — a blended total would be misleading" style={{color:'var(--amber)', fontSize:11}}>mixed currency</span>
                      : (c.meta_account || g) ? fmt(blended, S) : '—'}
                  </td>
                  <td style={{padding:'8px 10px'}}><BudgetCell client={c} field="meta_monthly_budget" S={S} onSave={saveBudget}/></td>
                  <td style={{padding:'8px 10px'}}><BudgetCell client={c} field="google_monthly_budget" S={S} onSave={saveBudget}/></td>
                  <td style={{padding:'8px 10px'}}>
                    {pace ? (
                      <>
                        <span className={`pill pill-${pace.cls}`}>{pace.label}</span>
                        <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>
                          {pace.actualPct.toFixed(0)}% of budget vs {pace.expectedPct.toFixed(0)}% of month
                        </div>
                      </>
                    ) : <span style={{color:'var(--text3)'}}>no budget</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {loadingSpend && <div style={{fontSize:11, color:'var(--text3)', marginTop:8}}>Loading spend figures…</div>}
    </div>
  )
}
