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
          fields:'event_time,event_type,extra_data', limit:'30'
        }),
      ])
      setData({ acc, act })
    } catch(e) { setData({ error: e.message }) }
    setLoading(false)
  }

  const TH = {padding:'7px 12px',textAlign:'left',fontWeight:700,color:'#555',fontSize:11,textTransform:'uppercase',letterSpacing:'.05em',background:'#f5f5f5',borderBottom:'1px solid #eee'}
  const TD = {padding:'7px 12px',borderBottom:'1px solid #f0f0f0',fontSize:12,verticalAlign:'top'}

  return (
    <div style={{padding:24,fontFamily:'system-ui',maxWidth:1100,margin:'0 auto',background:'#fafaf7',minHeight:'100vh'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        <span style={{fontSize:22,fontWeight:800}}><span style={{color:'#7DC242'}}>meraki</span><span style={{color:'#29ABE2'}}>ads</span></span>
        <span style={{fontSize:13,color:'#888',fontWeight:600}}>Billing API Debug</span>
      </div>
      <p style={{color:'#888',fontSize:12,marginBottom:20}}>Shows exact raw values from Meta API for any account. Use this to verify what balance/activity data is available.</p>

      <div style={{display:'flex',gap:10,marginBottom:24,alignItems:'center'}}>
        <select value={selected.key} onChange={e=>setSelected(CLIENTS.find(c=>c.key===e.target.value))}
          style={{padding:'8px 12px',borderRadius:8,border:'1.5px solid #ddd',fontSize:13,cursor:'pointer',background:'#fff'}}>
          {CLIENTS.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <button onClick={run} disabled={loading}
          style={{padding:'8px 20px',background:loading?'#aaa':'#7DC242',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:loading?'default':'pointer'}}>
          {loading?'Fetching…':'Fetch Raw Data'}
        </button>
        <code style={{fontSize:11,color:'#aaa'}}>act_{selected.accountId}</code>
      </div>

      {data?.error && <div style={{color:'red',padding:12,background:'#fff5f5',borderRadius:8,fontSize:12}}>Error: {data.error}</div>}

      {data && !data.error && (<>
        {/* Account Fields */}
        <h3 style={{fontSize:13,fontWeight:700,color:'#444',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>📦 Account Fields</h3>
        <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',border:'1px solid #eee',borderRadius:10,overflow:'hidden',marginBottom:24,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
          <thead><tr><th style={TH}>Field</th><th style={TH}>Raw Value</th><th style={TH}>÷100</th><th style={TH}>Notes</th></tr></thead>
          <tbody>
            {[
              {f:'balance', r:data.acc.balance, n:'For prepaid: this is outstanding amount owed, NOT available funds'},
              {f:'amount_spent', r:data.acc.amount_spent, n:'⚠ LIFETIME total — not current period'},
              {f:'spend_cap', r:data.acc.spend_cap, n:'Monthly/period spending limit if set'},
              {f:'account_status', r:data.acc.account_status, n:{1:'✅ Active',2:'❌ Disabled',3:'⚠ Unsettled',9:'⚠ Grace Period'}[data.acc.account_status]||'Unknown'},
              {f:'currency', r:data.acc.currency, n:'Currency code'},
            ].map(({f,r,n})=>(
              <tr key={f}>
                <td style={{...TD,color:'#7DC242',fontFamily:'monospace',fontWeight:600}}>{f}</td>
                <td style={{...TD,fontFamily:'monospace',color:'#333'}}>{String(r??'—')}</td>
                <td style={{...TD,fontFamily:'monospace',color:'#29ABE2',fontWeight:600}}>{r?`${(parseFloat(r)/100).toFixed(2)}`:'—'}</td>
                <td style={{...TD,color:'#888',fontSize:11}}>{n}</td>
              </tr>
            ))}
            <tr>
              <td style={{...TD,color:'#7DC242',fontFamily:'monospace',fontWeight:600}}>funding_source_details</td>
              <td style={{...TD,fontFamily:'monospace',color:'#333',fontSize:10,wordBreak:'break-all'}} colSpan={3}>{JSON.stringify(data.acc.funding_source_details||null,null,2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Activities */}
        <h3 style={{fontSize:13,fontWeight:700,color:'#444',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>🏦 Billing Activities — Last 30 Events</h3>
        {data.act.error
          ? <div style={{padding:12,background:'#fff5f5',borderRadius:8,fontSize:12,color:'red',marginBottom:24}}>API Error: {JSON.stringify(data.act.error)}</div>
          : (data.act.data||[]).length === 0
          ? <div style={{padding:12,background:'#f5f5f5',borderRadius:8,fontSize:12,color:'#888',marginBottom:24}}>
              No activities returned. This could mean:<br/>
              1. Activities API requires broader permissions (ads_management)<br/>
              2. No events in the default time window<br/>
              3. Account has no logged activities
            </div>
          : <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',border:'1px solid #eee',borderRadius:10,overflow:'hidden',marginBottom:24,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
              <thead><tr>
                <th style={TH}>event_type</th>
                <th style={TH}>Date/Time</th>
                <th style={TH}>extra_data (raw)</th>
              </tr></thead>
              <tbody>
                {(data.act.data||[]).map((e,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{...TD,fontFamily:'monospace',fontSize:11,color:'#29ABE2',fontWeight:600,whiteSpace:'nowrap'}}>{e.event_type||'—'}</td>
                    <td style={{...TD,fontSize:11,color:'#555',whiteSpace:'nowrap'}}>
                      {e.event_time?new Date(e.event_time).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
                    </td>
                    <td style={{...TD,fontFamily:'monospace',fontSize:10,color:'#777',wordBreak:'break-all',maxWidth:400}}>
                      {e.extra_data ? JSON.stringify(e.extra_data) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }

        {/* Full raw JSON */}
        <h3 style={{fontSize:13,fontWeight:700,color:'#444',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>📄 Full Raw JSON</h3>
        <pre style={{background:'#fff',padding:14,borderRadius:10,fontSize:10,overflowX:'auto',border:'1px solid #eee',maxHeight:300,overflow:'auto',color:'#333'}}>
          {JSON.stringify(data,null,2)}
        </pre>
      </>)}
    </div>
  )
}
