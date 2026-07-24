import { useEffect, useState } from 'react'

const SYM = c => c==='THB'?'฿':c==='NZD'?'NZ$':c==='AUD'?'A$':'₹'
const fmt = (n, sym='₹') => sym + Math.round(n||0).toLocaleString('en-IN')

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

function googleSpend(customerId) {
  const query = 'SELECT metrics.cost_micros, segments.date FROM campaign WHERE segments.date DURING THIS_MONTH'
  return fetch('/api/google-ads', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ customerId, query }), cache:'no-store'
  }).then(r=>r.json()).then(d => {
    if (d.error) return { error: d.error, today:0, week:0, month:0 }
    const today = new Date().toISOString().split('T')[0]
    const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay()+6)%7))
    const mondayStr = monday.toISOString().split('T')[0]
    let t=0,w=0,m=0
    for (const r of d.results||[]) {
      const cost = parseInt(r.metrics?.costMicros||0)/1e6
      m += cost
      if (r.segments?.date === today) t += cost
      if (r.segments?.date >= mondayStr) w += cost
    }
    return { today:t, week:w, month:m }
  }).catch(e => ({ error: e.message, today:0, week:0, month:0 }))
}

export default function ClientsView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spend, setSpend] = useState({})
  const [loadingSpend, setLoadingSpend] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/client-map', { cache:'no-store' })
      .then(r=>r.json())
      .then(d => { setData(d); setError(d.error||null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }
  useEffect(load, [])

  // Fetch spend for every mapped client, per platform
  useEffect(() => {
    if (!data?.clients) return
    const mapped = data.clients.filter(c => c.meta_account || c.google_account)
    if (mapped.length === 0) return
    setLoadingSpend(true)
    const sem = makeSemaphore(6)

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
      if (c.google_account) {
        result.google = await sem(()=>googleSpend(c.google_account.account_id))
      }
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
          <span style={{color:'var(--amber)'}}>
            {' '}Unmapped tracked accounts: {[...(data.unmapped.meta||[]), ...(data.unmapped.google||[])].join(', ')}
          </span>
        )}
      </div>

      <div className="tbl-wrap" style={{overflowX:'auto'}}>
        <table style={{width:'100%', minWidth:900, borderCollapse:'collapse', fontSize:12}}>
          <thead>
            <tr style={{borderBottom:'1.5px solid var(--border)'}}>
              {['Client','Platforms','Meta (MTD)','Google (MTD)','Blended (MTD)','Budget','Pacing'].map(h=>(
                <th key={h} style={{textAlign:'left', padding:'8px 10px', color:'var(--text3)', fontWeight:600, fontSize:11}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const s = spend[c.id] || {}
              const metaM = s.meta?.month || 0
              const googleM = s.google?.month || 0
              const blended = metaM + googleM
              const cur = c.meta_account?.currency || c.google_account?.currency || 'INR'
              const S = SYM(cur)
              const budget = c.monthly_budget ? Number(c.monthly_budget) : null

              // Pacing against the approved monthly budget
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
                    {c.google_account ? (s.google?.error ? <span style={{color:'var(--red)',fontSize:10}}>error</span> : fmt(googleM, SYM(c.google_account.currency))) : '—'}
                  </td>
                  <td style={{padding:'8px 10px', fontWeight:600}}>
                    {mixedCurrency
                      ? <span title="Meta and Google are in different currencies — a blended total would be misleading" style={{color:'var(--amber)', fontSize:11}}>mixed currency</span>
                      : (c.meta_account || c.google_account) ? fmt(blended, S) : '—'}
                  </td>
                  <td style={{padding:'8px 10px'}}>{budget ? fmt(budget, S) : '—'}</td>
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
