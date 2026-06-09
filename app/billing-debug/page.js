'use client'
import { useState } from 'react'

const CLIENTS = [
  { key:'volvo',     name:'Volvo',           accountId:'833603637085666'  },
  { key:'north-old', name:'North Intl (Old)',accountId:'1297775434831152' },
  { key:'pyarababy', name:'PyaraBaby',        accountId:'254564808465114'  },
  { key:'honda',     name:'Courtesy Honda',  accountId:'787341982723949'  },
  { key:'ssw',       name:'SSW Mohali',      accountId:'1999892177251081' },
  { key:'outlander', name:'Outlander NZ',    accountId:'1318511879920658' },
  { key:'pratha',    name:'Pratha Preschool',accountId:'1851775342206755' },
  { key:'asia',      name:'Asia Cosmetic',   accountId:'1444189929969376' },
  { key:'veriseek',  name:'Veriseek AI',     accountId:'3252000788333236' },
  { key:'faith',     name:'Faith Diagnostics',accountId:'330235162'       },
  { key:'north-new', name:'North Intl (New)',accountId:'1418599015829087' },
  { key:'bodyt',     name:'Body Temple',     accountId:'9141434999257273' },
]

function apiFetch(endpoint, params={}) {
  const qs = new URLSearchParams({ endpoint })
  Object.entries(params).forEach(([k,v]) => qs.set(k,v))
  return fetch(`/api/meta?${qs}`).then(r=>r.json())
}

export default function BillingDebug() {
  const [selected, setSelected] = useState(CLIENTS[6])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true); setData(null)
    try {
      const [acc, act] = await Promise.all([
        apiFetch(`act_${selected.accountId}`, {
          fields:'name,account_status,currency,balance,spend_cap,amount_spent,funding_source_details'
        }),
        apiFetch(`act_${selected.accountId}/activities`, {
          fields:'event_time,event_type,extra_data',
          limit:'50'
        }),
      ])

      // Compute available funds
      const cap = parseFloat(acc.spend_cap||0)
      const spent = parseFloat(acc.amount_spent||0)
      const available = cap > 0 ? Math.max(0, (cap - spent)/100) : null

      setData({ acc, act, available, cap: cap/100, spent: spent/100 })
    } catch(e) { setData({ error: e.message }) }
    setLoading(false)
  }

  const TH = {padding:'7px 12px',textAlign:'left',fontWeight:700,color:'#555',fontSize:11,textTransform:'uppercase',letterSpacing:'.05em',background:'#f5f5f5',borderBottom:'1px solid #eee'}
  const TD = {padding:'7px 12px',borderBottom:'1px solid #f0f0f0',fontSize:12,verticalAlign:'top'}

  return (
    <div style={{padding:24,fontFamily:'system-ui',maxWidth:1100,margin:'0 auto',background:'#fafaf7',minHeight:'100vh'}}>
      <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>
        <span style={{color:'#7DC242'}}>meraki</span><span style={{color:'#29ABE2'}}>ads</span>
        <span style={{fontSize:13,color:'#888',fontWeight:600,marginLeft:12}}>Billing API Debug</span>
      </div>
      <p style={{color:'#888',fontSize:12,marginBottom:20}}>
        Shows exact raw values from Meta API. <b>Check what event_type Meta returns for payments.</b>
      </p>

      <div style={{display:'flex',gap:10,marginBottom:24,alignItems:'center'}}>
        <select value={selected.key} onChange={e=>setSelected(CLIENTS.find(c=>c.key===e.target.value))}
          style={{padding:'8px 12px',borderRadius:8,border:'1.5px solid #ddd',fontSize:13,cursor:'pointer',background:'#fff'}}>
          {CLIENTS.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <button onClick={run} disabled={loading}
          style={{padding:'8px 20px',background:loading?'#aaa':'#7DC242',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:loading?'default':'pointer'}}>
          {loading?'Fetching…':'Fetch Raw Data'}
        </button>
      </div>

      {data?.error && <div style={{color:'red',padding:12,background:'#fff5f5',borderRadius:8,fontSize:12}}>{data.error}</div>}

      {data && !data.error && (<>
        {/* Key numbers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            {l:'balance (raw ÷100)', v:`₹${(parseFloat(data.acc.balance||0)/100).toFixed(2)}`, note:'Outstanding bill — NOT available funds'},
            {l:'spend_cap (raw ÷100)', v:`₹${data.cap.toFixed(2)}`, note:'Total funds ever loaded'},
            {l:'amount_spent (raw ÷100)', v:`₹${data.spent.toFixed(2)}`, note:'⚠ LIFETIME total spent'},
            {l:'Available (cap − spent)', v:data.available !== null ? `₹${data.available.toFixed(2)}` : '—', note:'Should match Meta billing UI'},
          ].map(({l,v,note})=>(
            <div key={l} style={{background:'#fff',padding:'12px 14px',borderRadius:10,border:'1px solid #eee',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#888',textTransform:'uppercase',marginBottom:4}}>{l}</div>
              <div style={{fontFamily:'monospace',fontSize:18,fontWeight:700,color:'#333',marginBottom:4}}>{v}</div>
              <div style={{fontSize:10,color:'#aaa'}}>{note}</div>
            </div>
          ))}
        </div>

        {/* funding_source_details */}
        <h3 style={{fontSize:13,fontWeight:700,marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em',color:'#444'}}>funding_source_details (raw)</h3>
        <pre style={{background:'#fff',padding:14,borderRadius:10,border:'1px solid #eee',fontSize:11,marginBottom:24,overflowX:'auto'}}>
          {JSON.stringify(data.acc.funding_source_details||'null — field not returned',null,2)}
        </pre>

        {/* Activities */}
        <h3 style={{fontSize:13,fontWeight:700,marginBottom:4,textTransform:'uppercase',letterSpacing:'.06em',color:'#444'}}>
          Billing Activities — Last 50 Events
        </h3>
        <p style={{fontSize:11,color:'#888',marginBottom:8}}>
          Look for the event_type that corresponds to "adding funds". That's the string we need for last payment detection.
        </p>
        {data.act.error
          ? <div style={{padding:12,background:'#fff5f5',borderRadius:8,fontSize:12,color:'red',marginBottom:24}}>API Error: {JSON.stringify(data.act.error)}</div>
          : (data.act.data||[]).length === 0
          ? <div style={{padding:12,background:'#f5f5f5',borderRadius:8,fontSize:12,color:'#888',marginBottom:24}}>
              No activities returned.<br/>
              This means either: no events in default window, or this access token lacks activities permission.
            </div>
          : <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',border:'1px solid #eee',borderRadius:10,overflow:'hidden',marginBottom:24,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
              <thead><tr>
                <th style={TH}>#</th>
                <th style={TH}>event_type</th>
                <th style={TH}>Date/Time (IST)</th>
                <th style={TH}>extra_data</th>
              </tr></thead>
              <tbody>
                {(data.act.data||[]).map((e,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{...TD,color:'#aaa',width:30}}>{i+1}</td>
                    <td style={{...TD,fontFamily:'monospace',fontSize:11,color:'#29ABE2',fontWeight:600}}>{e.event_type||'—'}</td>
                    <td style={{...TD,fontSize:11,color:'#555',whiteSpace:'nowrap'}}>
                      {e.event_time?new Date(e.event_time).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
                    </td>
                    <td style={{...TD,fontFamily:'monospace',fontSize:10,color:'#777',wordBreak:'break-all',maxWidth:350}}>
                      {e.extra_data ? (typeof e.extra_data === 'string' ? e.extra_data : JSON.stringify(e.extra_data)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }

        {/* Raw JSON */}
        <details>
          <summary style={{cursor:'pointer',fontSize:12,color:'#888',marginBottom:8}}>Full raw JSON (click to expand)</summary>
          <pre style={{background:'#fff',padding:14,borderRadius:10,fontSize:10,overflowX:'auto',border:'1px solid #eee',maxHeight:400,overflow:'auto'}}>
            {JSON.stringify(data,null,2)}
          </pre>
        </details>
      </>)}
    </div>
  )
}
