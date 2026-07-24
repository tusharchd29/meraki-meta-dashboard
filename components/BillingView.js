import { useEffect, useState } from 'react'

const SYM = c => c==='THB'?'฿':c==='NZD'?'NZ$':'₹'
const fmt = (n, sym) => sym + Math.round(n||0).toLocaleString('en-IN')

function makeSemaphore(max=4) {
  let running=0; const queue=[]
  const run=()=>{while(running<max&&queue.length>0){const{fn,resolve,reject}=queue.shift();running++;fn().then(v=>{running--;run();resolve(v)}).catch(e=>{running--;run();reject(e)})}}
  return fn=>new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});run()})
}
function apiFetch(endpoint, params={}) {
  const qs = new URLSearchParams({ endpoint })
  Object.entries(params).forEach(([k,v]) => qs.set(k,v))
  return fetch(`/api/meta?${qs}`).then(r=>r.json())
}
function gAdsFetch(customerId, query) {
  return fetch('/api/google-ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, query })
  }).then(r=>r.json())
}

// Pacing status label + color, comparing % of month elapsed vs % of monthly cap spent
function paceStatus(actualPct, expectedPct) {
  const diff = actualPct - expectedPct
  if (!isFinite(diff)) return { label: 'No cap set', cls: 'na' }
  if (diff > 15) return { label: 'Overspending', cls: 'r' }
  if (diff < -15) return { label: 'Underspending', cls: 'a' }
  return { label: 'On track', cls: 'g' }
}

function useMetaBilling(clientList) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientList || clientList.length === 0) { setRows([]); return }
    setLoading(true)
    const semaphore = makeSemaphore(4)
    const fetch$ = (endpoint, params) => semaphore(() => apiFetch(endpoint, params))

    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()

    Promise.all(clientList.map(async cl => {
      const [today, week, month, acct, camps] = await Promise.all([
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend', date_preset:'today' }),
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend', date_preset:'this_week_mon_today' }),
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend', date_preset:'this_month' }),
        fetch$(`act_${cl.accountId}`, { fields:'spend_cap,amount_spent,currency' }),
        fetch$(`act_${cl.accountId}/campaigns`, { fields:'effective_status', limit:'200' }),
      ])
      const todaySpend = parseFloat(today?.data?.[0]?.spend || 0)
      const weekSpend = parseFloat(week?.data?.[0]?.spend || 0)
      const monthSpend = parseFloat(month?.data?.[0]?.spend || 0)
      const cap = parseFloat(acct?.spend_cap || 0) / 100 // spend_cap comes back in subunits
      const activeCamps = (camps?.data || []).filter(c => c.effective_status === 'ACTIVE').length
      const totalCamps = (camps?.data || []).length
      const expectedPct = (dayOfMonth / daysInMonth) * 100
      const actualPct = cap > 0 ? (monthSpend / cap) * 100 : NaN
      const pace = paceStatus(actualPct, expectedPct)
      return {
        key: cl.key, name: cl.name, currency: cl.currency,
        todaySpend, weekSpend, monthSpend, cap, activeCamps, totalCamps,
        expectedPct, actualPct, pace,
      }
    })).then(results => { setRows(results); setLoading(false) })
      .catch(() => setLoading(false))
  }, [JSON.stringify(clientList)])

  return { rows, loading }
}

function useGoogleAdsBilling(clientList) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!clientList || clientList.length === 0) { setRows([]); return }
    setLoading(true)
    setError(null)
    const semaphore = makeSemaphore(4)

    Promise.all(clientList.map(async cl => {
      const query = `
        SELECT campaign.status, metrics.cost_micros, segments.date
        FROM campaign
        WHERE segments.date DURING THIS_MONTH
      `.trim()
      const res = await semaphore(() => gAdsFetch(cl.accountId, query))
      if (res.error) return { key: cl.key, name: cl.name, error: res.error }

      const today = new Date().toISOString().split('T')[0]
      const monday = new Date()
      monday.setDate(monday.getDate() - ((monday.getDay()+6)%7))
      const mondayStr = monday.toISOString().split('T')[0]

      let todaySpend=0, weekSpend=0, monthSpend=0
      const activeCampaignIds = new Set(), allCampaignIds = new Set()
      for (const r of res.results || []) {
        const cost = parseInt(r.metrics?.costMicros || 0) / 1e6
        const date = r.segments?.date
        monthSpend += cost
        if (date === today) todaySpend += cost
        if (date >= mondayStr) weekSpend += cost
        const campId = r.campaign?.resourceName
        allCampaignIds.add(campId)
        if (r.campaign?.status === 'ENABLED') activeCampaignIds.add(campId)
      }
      return {
        key: cl.key, name: cl.name, currency: cl.currency || 'INR',
        todaySpend, weekSpend, monthSpend,
        activeCamps: activeCampaignIds.size, totalCamps: allCampaignIds.size,
        cap: null, expectedPct: null, actualPct: null, pace: { label: 'No cap tracked', cls: 'na' },
      }
    })).then(results => { setRows(results); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [JSON.stringify(clientList)])

  return { rows, loading, error }
}

function BillingTable({ platform, rows, loading }) {
  if (loading) return <div className="no-data-box">Loading {platform} spend data…</div>
  if (!rows || rows.length === 0) {
    return <div className="no-data-box">No tracked {platform} accounts. Connect and check some in the 🔌 Connections panel.</div>
  }
  return (
    <div className="tbl-wrap" style={{overflowX:'auto', WebkitOverflowScrolling:'touch'}}>
      <table style={{width:'100%', minWidth:720, borderCollapse:'collapse', fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1.5px solid var(--border)'}}>
            {['Client','Campaigns','Today','This Week','This Month','Monthly Cap','Pacing'].map(h=>(
              <th key={h} style={{textAlign:'left', padding:'8px 10px', color:'var(--text3)', fontWeight:600, fontSize:11}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            if (r.error) return (
              <tr key={r.key} style={{borderBottom:'1px solid var(--border)'}}>
                <td style={{padding:'8px 10px'}}>{r.name}</td>
                <td colSpan={6} style={{padding:'8px 10px', color:'var(--red)'}}>Error: {r.error}</td>
              </tr>
            )
            const S = SYM(r.currency)
            return (
              <tr key={r.key} style={{borderBottom:'1px solid var(--border)'}}>
                <td style={{padding:'8px 10px', fontWeight:600}}>{r.name}</td>
                <td style={{padding:'8px 10px'}}>{r.activeCamps}/{r.totalCamps} active</td>
                <td style={{padding:'8px 10px'}}>{fmt(r.todaySpend, S)}</td>
                <td style={{padding:'8px 10px'}}>{fmt(r.weekSpend, S)}</td>
                <td style={{padding:'8px 10px'}}>{fmt(r.monthSpend, S)}</td>
                <td style={{padding:'8px 10px'}}>{r.cap > 0 ? fmt(r.cap, S) : '—'}</td>
                <td style={{padding:'8px 10px'}}>
                  <span className={`pill pill-${r.pace.cls==='na'?'b':r.pace.cls}`}>{r.pace.label}</span>
                  {isFinite(r.actualPct) && (
                    <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>
                      {r.actualPct.toFixed(0)}% of cap vs {r.expectedPct.toFixed(0)}% of month elapsed
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function BillingView({ clientList, googleClientList }) {
  const [platformTab, setPlatformTab] = useState('meta')
  const meta = useMetaBilling(clientList)
  const google = useGoogleAdsBilling(googleClientList)

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Billing &amp; Pacing</div>
        <div style={{display:'flex', gap:6}}>
          <button className={`vtab${platformTab==='meta'?' active':''}`} onClick={()=>setPlatformTab('meta')} style={{fontSize:11, border:'none', background: platformTab==='meta'?undefined:'transparent'}}>Meta</button>
          <button className={`vtab${platformTab==='google'?' active':''}`} onClick={()=>setPlatformTab('google')} style={{fontSize:11, border:'none', background: platformTab==='google'?undefined:'transparent'}}>Google Ads</button>
        </div>
      </div>
      <div style={{fontSize:11, color:'var(--text3)', marginBottom:10}}>
        "Monthly Cap" pacing compares month-to-date spend against each account's spend cap, adjusted for how far through the month we are.
        Overspending = pace &gt;15% ahead of the month; Underspending = &gt;15% behind.
      </div>
      {platformTab==='meta' && <BillingTable platform="Meta" rows={meta.rows} loading={meta.loading} />}
      {platformTab==='google' && (
        <>
          <BillingTable platform="Google Ads" rows={google.rows} loading={google.loading} />
          {google.error && <div style={{fontSize:11, color:'var(--red)', marginTop:8}}>Error: {google.error}</div>}
          <div style={{fontSize:11, color:'var(--amber)', marginTop:8}}>
            Google Ads spend requires GOOGLE_ADS_DEVELOPER_TOKEN to be set on the server. Cap/pacing isn't tracked for Google yet — only spend and campaign status.
          </div>
        </>
      )}
    </div>
  )
}
