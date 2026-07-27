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

// Pacing driven purely by the client-approved monthly_budget (set in the
// Connections panel, or on a mapped client in Clients (Blended)) — NOT
// Meta's account-level spend_cap, which rarely matches what was actually
// approved, and which Google Ads has no equivalent of at all. No budget
// set = pacing can't be computed; that's shown plainly rather than guessed
// at. Exported so the Google tab can compute the same pacing consistently.
export function paceStatus(monthSpend, monthlyBudget) {
  if (!monthlyBudget || monthlyBudget <= 0) return { label: 'No budget set', cls: 'na', expectedPct: null, actualPct: null }
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
  const expectedPct = (dayOfMonth / daysInMonth) * 100
  const actualPct = (monthSpend / monthlyBudget) * 100
  const diff = actualPct - expectedPct
  if (diff > 15) return { label: 'Overspending', cls: 'r', expectedPct, actualPct }
  if (diff < -15) return { label: 'Underspending', cls: 'a', expectedPct, actualPct }
  return { label: 'On track', cls: 'g', expectedPct, actualPct }
}

function useMetaBilling(clientList) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientList || clientList.length === 0) { setRows([]); return }
    setLoading(true)
    const semaphore = makeSemaphore(8)
    const fetch$ = (endpoint, params) => semaphore(() => apiFetch(endpoint, params))

    Promise.all(clientList.map(async cl => {
      const [today, week, month, camps] = await Promise.all([
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend', date_preset:'today' }),
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend', date_preset:'this_week_mon_today' }),
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend', date_preset:'this_month' }),
        fetch$(`act_${cl.accountId}/campaigns`, { fields:'effective_status', limit:'200' }),
      ])
      const todaySpend = parseFloat(today?.data?.[0]?.spend || 0)
      const weekSpend = parseFloat(week?.data?.[0]?.spend || 0)
      const monthSpend = parseFloat(month?.data?.[0]?.spend || 0)
      const activeCamps = (camps?.data || []).filter(c => c.effective_status === 'ACTIVE').length
      const totalCamps = (camps?.data || []).length
      return {
        key: cl.key, name: cl.name, currency: cl.currency,
        todaySpend, weekSpend, monthSpend, activeCamps, totalCamps,
        monthlyBudget: cl.monthlyBudget,
        pace: paceStatus(monthSpend, cl.monthlyBudget),
      }
    })).then(results => { setRows(results); setLoading(false) })
      .catch(() => setLoading(false))
  }, [JSON.stringify(clientList)])

  return { rows, loading }
}

// Shared by this view and the Google Ads tab so "spent this month vs
// approved budget" reads identically everywhere it appears.
export function BillingTable({ platform, rows, loading }) {
  if (loading) return <div className="no-data-box">Loading {platform} spend data…</div>
  if (!rows || rows.length === 0) {
    return <div className="no-data-box">No tracked {platform} accounts. Connect and check some in the 🔌 Connections panel.</div>
  }
  return (
    <div className="tbl-wrap" style={{overflowX:'auto', WebkitOverflowScrolling:'touch'}}>
      <table style={{width:'100%', minWidth:720, borderCollapse:'collapse', fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1.5px solid var(--border)'}}>
            {['Client','Campaigns','Today','This Week','This Month','Approved Budget','Pacing'].map(h=>(
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
            const pace = r.pace || { label: 'No budget set', cls: 'na', expectedPct: null, actualPct: null }
            return (
              <tr key={r.key} style={{borderBottom:'1px solid var(--border)'}}>
                <td style={{padding:'8px 10px', fontWeight:600}}>{r.name}</td>
                <td style={{padding:'8px 10px'}}>{r.activeCamps}/{r.totalCamps} active</td>
                <td style={{padding:'8px 10px'}}>{r.todaySpend != null ? fmt(r.todaySpend, S) : '—'}</td>
                <td style={{padding:'8px 10px'}}>{r.weekSpend != null ? fmt(r.weekSpend, S) : '—'}</td>
                <td style={{padding:'8px 10px'}}>{fmt(r.monthSpend, S)}</td>
                <td style={{padding:'8px 10px'}}>{r.monthlyBudget ? fmt(r.monthlyBudget, S) : '—'}</td>
                <td style={{padding:'8px 10px'}}>
                  <span className={`pill pill-${pace.cls==='na'?'b':pace.cls}`}>{pace.label}</span>
                  {pace.actualPct != null && (
                    <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>
                      {pace.actualPct.toFixed(0)}% of budget vs {pace.expectedPct.toFixed(0)}% of month elapsed
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

export default function BillingView({ clientList }) {
  const meta = useMetaBilling(clientList)
  const noBudgetCount = (rows) => (rows || []).filter(r => !r.error && !r.monthlyBudget).length

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Billing &amp; Pacing <span style={{fontSize:11, fontWeight:400, color:'var(--text3)'}}>· Meta</span></div>
      </div>
      <div style={{fontSize:11, color:'var(--text3)', marginBottom:10}}>
        Pacing compares month-to-date spend against each client's approved monthly budget (set per account in 🔌 Connections), adjusted for how far through the month we are.
        Overspending = &gt;15% ahead of pace; Underspending = &gt;15% behind.
        Looking for Google Ads? It has its own <b>Google Ads</b> tab now.
      </div>
      <BillingTable platform="Meta" rows={meta.rows} loading={meta.loading} />
      {noBudgetCount(meta.rows) > 0 && (
        <div style={{fontSize:11, color:'var(--amber)', marginTop:8}}>
          {noBudgetCount(meta.rows)} client{noBudgetCount(meta.rows)>1?'s have':' has'} no approved budget set yet — set it in 🔌 Connections to see pacing.
        </div>
      )}
    </div>
  )
}
