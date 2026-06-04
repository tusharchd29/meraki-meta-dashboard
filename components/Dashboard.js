'use client'
import { useState, useEffect, useRef } from 'react'

const CLIENTS = [
  { key:'volvo',      name:'Volvo (Krishna — Meraki Ads)',         accountId:'833603637085666',  currency:'INR', vertical:'Automotive'   },
  { key:'north-old',  name:'North International (Old Account)',    accountId:'1297775434831152', currency:'INR', vertical:'Education'    },
  { key:'pyarababy',  name:'PyaraBaby',                            accountId:'254564808465114',  currency:'INR', vertical:'Ecommerce'    },
  { key:'honda',      name:'Courtesy Honda',                       accountId:'787341982723949',  currency:'INR', vertical:'Automotive'   },
  { key:'ssw',        name:'Sri Sri Well Being (SSW Mohali)',      accountId:'1999892177251081', currency:'INR', vertical:'Wellness'     },
  { key:'outlander',  name:'Outlander 4×4 New Zealand',            accountId:'1318511879920658', currency:'NZD', vertical:'Auto/Services'},
  { key:'pratha',     name:'Pratha Preschool',                     accountId:'1851775342206755', currency:'INR', vertical:'Education'    },
  { key:'asia',       name:'Asia Cosmetic Hospital',               accountId:'1444189929969376', currency:'THB', vertical:'Healthcare'   },
  { key:'veriseek',   name:'Veriseek AI',                          accountId:'3252000788333236', currency:'INR', vertical:'EdTech'       },
  { key:'faith',      name:'Faith Diagnostics',                    accountId:'330235162',        currency:'INR', vertical:'Healthcare'   },
  { key:'north-new',  name:'North International (New — Hiring)',   accountId:'1418599015829087', currency:'INR', vertical:'Education'    },
  { key:'bodyt',      name:'Body Temple',                          accountId:'2001372527419414', currency:'INR', vertical:'Health/Fitness'},
]

const TOKEN = 'EAAZBpEehq4PMBRmHs3Sxb1nUs3hlDaT9gnV98n5Vhi3iZBGRRvC5DR2CSNESBFthGqtjhUCwqL2fRHh1ZBZAinoGEP3CLz2OBFaFTpZAZB2SBkC8lAWr0pOYypkVx1HuF0LjOsXn8awJtsyY5f4vKRp5ffoz94ipHoieTSTkevVUGqPJBoivGaPEi9ES49oOwjuvLaLnSxwZCnR82MNFoeHGoqkZBhU2L7DENaeYjgZDZD'
const INSIGHT_FIELDS = 'spend,impressions,clicks,ctr,cpm,reach,frequency,actions,video_thruplay_watched_actions,cost_per_action_type'

// ── Helpers ───────────────────────────────────────────────────────────────────
const SYM = c => c==='THB'?'฿':c==='NZD'?'NZ$':'₹'
function fmtSpend(n, s='₹') {
  const v=parseFloat(n||0); if(!v) return s+'0'
  if(v>=100000) return s+(v/100000).toFixed(1)+'L'
  if(v>=1000)   return s+(v/1000).toFixed(1)+'K'
  return s+Math.round(v)
}
function fmtNum(n) {
  const v=parseFloat(n||0); if(!v) return '0'
  if(v>=1000000) return (v/1000000).toFixed(1)+'M'
  if(v>=1000)    return (v/1000).toFixed(1)+'K'
  return Math.round(v).toString()
}
function getDateParams(preset, cfrom, cto) {
  if(preset==='Today')      return {date_preset:'today'}
  if(preset==='Last 7D')    return {date_preset:'last_7d'}
  if(preset==='14D')        return {date_preset:'last_14d'}
  if(preset==='30D')        return {date_preset:'last_30d'}
  if(preset==='This Month') return {date_preset:'this_month'}
  if(preset==='custom'&&cfrom&&cto) return {time_range:JSON.stringify({since:cfrom,until:cto})}
  return {date_preset:'last_7d'}
}
function objLabel(o='') {
  const m={OUTCOME_LEADS:'LEADS',OUTCOME_SALES:'SALES',OUTCOME_AWARENESS:'AWARENESS',OUTCOME_ENGAGEMENT:'ENGAGEMENT',OUTCOME_TRAFFIC:'TRAFFIC',LEAD_GENERATION:'LEADS',CONVERSIONS:'SALES',MESSAGES:'LEADS',POST_ENGAGEMENT:'ENGAGEMENT',VIDEO_VIEWS:'AWARENESS',REACH:'AWARENESS',BRAND_AWARENESS:'AWARENESS',LINK_CLICKS:'TRAFFIC',PAGE_LIKES:'ENGAGEMENT',OUTCOME_APP_PROMOTION:'APP'}
  return m[o.toUpperCase().replace(/\s/g,'_')] || o || '—'
}
function objCls(o) {
  const l=objLabel(o)
  return l==='LEADS'?'obj-leads':l==='SALES'?'obj-sales':l==='AWARENESS'?'obj-aware':l==='ENGAGEMENT'?'obj-eng':'obj-traffic'
}
function campStatusInfo(c) {
  const s=(c.effective_status||c.status||'').toUpperCase()
  if(s==='ACTIVE')   return {dot:'on',  label:'Active'}
  if(s==='PAUSED')   return {dot:'na',  label:'Paused'}
  if(s==='ARCHIVED') return {dot:'na',  label:'Archived'}
  if(s.includes('ERROR')||s.includes('DISAPPROVED')) return {dot:'off',label:'Error'}
  if(s.includes('PENDING')) return {dot:'warn',label:'Pending'}
  return {dot:'na',label:s||'—'}
}
function accStatusInfo(statusCode) {
  if(statusCode===1)   return {cls:'ok',   dot:'g', badge:'LIVE',         badgeCls:'sb-live'}
  if(statusCode===9)   return {cls:'err',  dot:'r', badge:'GRACE PERIOD', badgeCls:'sb-err'}
  if(statusCode===2)   return {cls:'err',  dot:'r', badge:'DISABLED',     badgeCls:'sb-err'}
  if(statusCode===3)   return {cls:'err',  dot:'r', badge:'UNSETTLED',    badgeCls:'sb-err'}
  if(statusCode===7)   return {cls:'warn', dot:'a', badge:'PENDING',      badgeCls:'sb-warn'}
  if(statusCode===101) return {cls:'off',  dot:'e', badge:'CLOSED',       badgeCls:'sb-off'}
  return                      {cls:'warn', dot:'a', badge:'UNKNOWN',      badgeCls:'sb-warn'}
}
function parseResults(ins, currency) {
  if(!ins) return {text:'—', cls:'', count:0}
  const s=SYM(currency), spend=parseFloat(ins.spend||0), actions=ins.actions||[]
  const LEAD  =['lead','onsite_conversion.lead_grouped','contact_total']
  const PURCH =['purchase','omni_purchase','onsite_web_purchase']
  const CONV  =['onsite_conversion.messaging_first_reply','messaging_first_reply']
  const CLICK =['link_click','landing_page_view']
  for(const [types,lbl] of [[PURCH,'Purchases'],[LEAD,'Leads'],[CONV,'Convos'],[CLICK,'Clicks']]) {
    for(const t of types) {
      const a=actions.find(x=>x.action_type===t||x.action_type?.startsWith(t))
      if(a&&parseInt(a.value)>0) {
        const cnt=parseInt(a.value), cpa=cnt>0&&spend>0?Math.round(spend/cnt):null
        const cpaLbl=lbl==='Purchases'?'CPP':lbl==='Clicks'?'CPC':'CPL'
        return {text:`${cnt} ${lbl}${cpa?` · ${cpaLbl} ${s}${cpa}`:''}`, cls:'green', count:cnt}
      }
    }
  }
  const tp=ins.video_thruplay_watched_actions?.[0]
  if(tp&&parseInt(tp.value)>0) {
    const cnt=parseInt(tp.value), ctp=spend>0&&cnt>0?spend/cnt:null
    return {text:`${fmtNum(cnt)} ThruPlays${ctp?` · ${s}${ctp<1?ctp.toFixed(3):Math.round(ctp)}`:''}`, cls:'green', count:cnt}
  }
  if(ins.reach&&parseInt(ins.reach)>0) return {text:`Reach ${fmtNum(ins.reach)}`,cls:'',count:0}
  if(spend>0) return {text:'Spend only',cls:'',count:0}
  return {text:'—',cls:'',count:0}
}
async function apiFetch(endpoint, params={}) {
  const qs=new URLSearchParams({endpoint,token:TOKEN})
  Object.entries(params).forEach(([k,v])=>qs.set(k,v))
  const r=await fetch(`/api/meta?${qs}`)
  return r.json()
}
// ── Meta deep-link URL builder ───────────────────────────────────────────────
function metaUrl(type, {accountId, campId, adsetId, adId} = {}) {
  const base = 'https://adsmanager.facebook.com/adsmanager/manage'
  const act  = accountId ? `?act=${accountId}` : ''
  if(type==='account')   return `${base}/accounts${act}`
  if(type==='billing')   return `https://business.facebook.com/billing_hub/payment_activity${act}`
  if(type==='campaigns') return `${base}/campaigns${act}`
  if(type==='campaign')  return campId   ? `${base}/campaigns${act}&selected_campaign_ids=${campId}` : `${base}/campaigns${act}`
  if(type==='adset')     return adsetId  ? `${base}/adsets${act}&selected_adset_ids=${adsetId}` : `${base}/campaigns${act}`
  if(type==='ad')        return adId     ? `${base}/ads${act}&selected_ad_ids=${adId}` : `${base}/ads${act}`
  if(type==='ads')       return `${base}/ads${act}`
  return `${base}/campaigns${act}`
}
function openMeta(type, ids={}) {
  window.open(metaUrl(type, ids), '_blank', 'noopener')
}

function Spinner({size=14}) {
  return <div style={{width:size,height:size,border:'2px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccCard({client, dateParams, activeDateLabel, isVisible, onDataLoad}) {
  const [open,     setOpen]  = useState(false)
  const [accInfo,  setAccInfo]= useState(null)   // live account info
  const [ins,      setIns]   = useState(undefined)
  const [camps,    setCamps] = useState([])
  const [campLoad, setCampL] = useState(false)
  const dpKey = JSON.stringify(dateParams)

  // Fetch account info + insights on mount / date change
  useEffect(()=>{
    setIns(undefined); setAccInfo(null)
    // Account info (status, balance, spend_cap)
    apiFetch(`act_${client.accountId}`,{
      fields:'name,account_status,currency,amount_spent,balance,spend_cap,disable_reason'
    }).then(d=>{ if(!d.error) setAccInfo(d) })

    // Account-level insights
    apiFetch(`act_${client.accountId}/insights`,{fields:INSIGHT_FIELDS,...dateParams})
      .then(d=>{
        if(d.error) setIns({_err:d.error.message||d.error.type})
        else        setIns(d.data?.[0]||{spend:'0',impressions:'0',clicks:'0',ctr:'0',cpm:'0',reach:'0',frequency:'0',_zero:true})
        // Report back for statsbar
        if(onDataLoad) onDataLoad(client.accountId, d.data?.[0]||null, d.error||null)
      })
      .catch(e=>{ setIns({_err:e.message}); if(onDataLoad) onDataLoad(client.accountId,null,e) })
  },[client.accountId, dpKey])

  // Campaigns — only ACTIVE when opened
  useEffect(()=>{
    if(!open) return
    setCampL(true); setCamps([])
    // Fetch only ACTIVE campaigns
    apiFetch(`act_${client.accountId}/campaigns`,{
      fields:'id,name,objective,status,effective_status',
      filtering:JSON.stringify([{field:'effective_status',operator:'IN',value:['ACTIVE','PAUSED']}]),
      limit:'30'
    }).then(async d=>{
      if(d.error||!d.data?.length){ setCampL(false); return }
      const merged = await Promise.all(d.data.map(async c=>{
        try {
          const ci=await apiFetch(`${c.id}/insights`,{fields:INSIGHT_FIELDS,...dateParams})
          return {...c, ins:ci.data?.[0]||null}
        } catch { return {...c,ins:null} }
      }))
      merged.sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      setCamps(merged); setCampL(false)
    }).catch(()=>setCampL(false))
  },[open, client.accountId, dpKey])

  if(!isVisible) return null

  const S     = SYM(client.currency)
  const st    = accInfo ? accStatusInfo(accInfo.account_status) : {cls:'ok',dot:'g',badge:'LIVE',badgeCls:'sb-live'}
  const spend = parseFloat(ins?.spend||0)
  const impr  = parseInt(ins?.impressions||0)
  const ctr   = parseFloat(ins?.ctr||0)
  const freq  = parseFloat(ins?.frequency||0)
  const cpm   = parseFloat(ins?.cpm||0)
  const reach = parseInt(ins?.reach||0)
  const clicks= parseInt(ins?.clicks||0)
  const res   = ins&&!ins._err&&!ins._zero ? parseResults(ins, client.currency) : {text:'—',cls:'',count:0}

  // Live opp score derived from frequency + CTR + results
  const liveScore = ins&&!ins._err&&!ins._zero&&spend>0 ? (()=>{
    let s=70
    if(ctr>=2)s+=10; else if(ctr>=1.5)s+=5; else if(ctr<0.5)s-=10
    if(freq>=3)s-=20; else if(freq>=2.5)s-=12; else if(freq>=2)s-=5
    if(res.count>0)s+=8
    if(spend===0)s=0
    return Math.max(0,Math.min(100,Math.round(s)))
  })() : null

  const scoreColor = !liveScore?'var(--text3)':liveScore>=75?'var(--green)':liveScore>=60?'var(--amber)':'var(--red)'

  return (
    <div className={`acc-card ${st.cls}${open?' open':''}`} data-client={client.key}>
      <div className="acc-hdr" onClick={()=>setOpen(o=>!o)}>
        <div className="acc-exp">›</div>
        <div className={`acc-sdot ${st.dot}`}/>
        <div className="acc-info">
          <div className="acc-name">{client.name}</div>
          <div className="acc-meta">#{client.accountId} · {client.currency} · {client.vertical} · {activeDateLabel}</div>
        </div>

        <div className="acc-kpis">
          {ins===undefined ? (
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px'}}>
              <Spinner size={11}/><span style={{fontSize:10,color:'var(--text3)'}}>Fetching…</span>
            </div>
          ) : ins?._err ? (
            <div className="kc" style={{minWidth:200}}>
              <div className="kc-lbl">Error</div>
              <div className="kc-val r" style={{fontSize:9,whiteSpace:'normal',maxWidth:200}}>{ins._err.slice(0,80)}</div>
            </div>
          ) : (
            <>
              <div className="kc"><div className="kc-lbl">Spend</div><div className={`kc-val ${spend>0?'n':'r'}`}>{fmtSpend(spend,S)}</div></div>
              <div className="kc"><div className="kc-lbl">Impressions</div><div className="kc-val n">{fmtNum(impr)}</div></div>
              <div className="kc"><div className="kc-lbl">Clicks</div><div className="kc-val n">{fmtNum(clicks)}</div></div>
              <div className="kc"><div className="kc-lbl">CTR</div><div className={`kc-val ${ctr>=1.5?'g':ctr>0&&ctr<0.8?'r':'n'}`}>{ctr>0?ctr.toFixed(2)+'%':'—'}</div></div>
              <div className="kc"><div className="kc-lbl">CPM</div><div className="kc-val n">{cpm>0?S+cpm.toFixed(0):'—'}</div></div>
              <div className="kc"><div className="kc-lbl">Reach</div><div className="kc-val n">{reach>0?fmtNum(reach):'—'}</div></div>
              <div className="kc"><div className="kc-lbl">Freq</div><div className={`kc-val ${freq>=2.5?'r':freq>=2?'a':'n'}`}>{freq>0?freq.toFixed(2):'—'}</div></div>
              <div className="kc"><div className="kc-lbl">Results</div>
                <div className={`kc-val ${res.cls==='green'?'g':res.cls==='red'?'r':'n'}`}
                  style={{fontSize:10,maxWidth:110,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{res.text}</div></div>
            </>
          )}
        </div>

        <div className="acc-right">
          <div className="acc-badges">
            <span className={`s-badge ${st.badgeCls}`}>{st.badge}</span>
            {freq>=2.5&&<span className="chip-r">Freq {freq.toFixed(2)}</span>}
            {freq>=2&&freq<2.5&&<span className="chip-a">Freq {freq.toFixed(2)}</span>}
            {ins!==undefined&&ins!==null&&!ins._err&&spend===0&&<span className="chip-r">No Spend</span>}
          </div>
          {liveScore!==null&&(
            <div className="opp-score">
              <span className="opp-lbl">Score</span>
              <div className="opp-bar"><div className="opp-fill" style={{width:`${liveScore}%`,background:scoreColor}}/></div>
              <span className="opp-num" style={{color:scoreColor}}>{liveScore}</span>
            </div>
          )}
        </div>
      </div>

      <div className="acc-body">
        {client.key==='bodyt'&&<div className="no-data-box">MCP rollout pending. Monitor via Meta Ads Manager directly.</div>}
        {campLoad&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'14px',color:'var(--text3)',fontSize:12}}><Spinner size={14}/>Fetching active campaigns…</div>}
        {!campLoad&&camps.length===0&&open&&client.key!=='bodyt'&&<div className="no-data-box">No active/paused campaigns found.</div>}
        {!campLoad&&camps.length>0&&ins?._zero&&<div style={{padding:'6px 14px 0',fontSize:11,color:'var(--amber)',fontWeight:600}}>⚠ No spend in {activeDateLabel} — campaign metrics will show — when no delivery occurred</div>}

        {!campLoad&&camps.length>0&&(
          <table className="camp-tbl">
            <thead><tr><th>Campaign</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {camps.map((c,i)=>{
                const ci=c.ins, cs=campStatusInfo(c)
                const cS=parseFloat(ci?.spend||0), cCtr=parseFloat(ci?.ctr||0), cFreq=parseFloat(ci?.frequency||0)
                const cRes=parseResults(ci,client.currency)
                const CC={green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)'}
                return (
                  <tr key={c.id||i} style={{cursor:'pointer'}} onClick={()=>openMeta('campaign',{accountId:client.accountId,campId:c.id})}>
                    <td><b style={{color:'var(--blue-dk)'}}>{c.name}</b> <span style={{fontSize:9,color:'var(--text3)'}}>↗</span></td>
                    <td><span className={`obj-b ${objCls(c.objective)}`}>{objLabel(c.objective)}</span></td>
                    <td style={{fontFamily:'JetBrains Mono',fontSize:11}}>{ci?fmtSpend(cS,SYM(client.currency)):'—'}</td>
                    <td style={{color:CC[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                    <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>{cCtr>0?cCtr.toFixed(2)+'%':'—'}</td>
                    <td style={cFreq>=2.5?{color:'var(--red)',fontWeight:600}:cFreq>=2?{color:'var(--amber)'}:{}}>{cFreq>0?cFreq.toFixed(2):'—'}</td>
                    <td><div className="st-ind"><div className={`st-dot ${cs.dot}`}/>{cs.label}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {ins&&!ins._err&&!campLoad&&(
          <div className="insight-row">
            <div className="insight-box ib-trend">
              <div className="ib-ttl">📡 Live — {activeDateLabel}</div>
              <div className="ib-item">Spend: <b>{fmtSpend(spend,S)}</b> · Reach: <b>{fmtNum(reach)}</b> · Impressions: <b>{fmtNum(impr)}</b></div>
              <div className="ib-item">CTR: <b>{ctr>0?ctr.toFixed(2)+'%':'—'}</b> · CPM: <b>{cpm>0?S+cpm.toFixed(0):'—'}</b> · Freq: <b>{freq>0?freq.toFixed(2):'—'}</b></div>
              {res.text!=='—'&&<div className="ib-item">Top Result: <b>{res.text}</b></div>}
            </div>
            {freq>=2&&<div className="insight-box ib-warn"><div className="ib-ttl">⚠ Frequency Alert</div><div className="ib-item">Freq <b>{freq.toFixed(2)}</b> — {freq>=2.5?'audience fatigue, refresh creative immediately':'approaching fatigue, monitor closely'}</div></div>}
            {(spend===0||ins?._zero)&&<div className="insight-box ib-err"><div className="ib-ttl">🚨 No Spend This Period</div><div className="ib-item">Zero delivery in {activeDateLabel}. Check account status, billing, or spend limits in Meta Business Manager.</div></div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Campaigns Table View ──────────────────────────────────────────────────────
function CampaignsView({filter, dateParams, activeDateLabel}) {
  const [rows, setRows]   = useState([])
  const [loading, setLoad]= useState(false)
  const dpKey = JSON.stringify(dateParams)

  useEffect(()=>{
    setLoad(true); setRows([])
    const clients = filter==='all'?CLIENTS:CLIENTS.filter(c=>c.key===filter)
    Promise.all(clients.map(async cl=>{
      try {
        const cd=await apiFetch(`act_${cl.accountId}/campaigns`,{
          fields:'id,name,objective,status,effective_status',
          filtering:JSON.stringify([{field:'effective_status',operator:'IN',value:['ACTIVE','PAUSED']}]),
          limit:'30'
        })
        if(!cd.data?.length) return []
        return Promise.all(cd.data.map(async c=>{
          try {
            const ci=await apiFetch(`${c.id}/insights`,{fields:INSIGHT_FIELDS,...dateParams})
            return {campName:c.name,accName:cl.name,obj:c.objective,ins:ci.data?.[0]||null,status:campStatusInfo(c),currency:cl.currency,S:SYM(cl.currency)}
          } catch { return {campName:c.name,accName:cl.name,obj:c.objective,ins:null,status:campStatusInfo(c),currency:cl.currency,S:SYM(cl.currency)} }
        }))
      } catch { return [] }
    })).then(all=>{
      const flat=all.flat()
      flat.sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      setRows(flat); setLoad(false)
    })
  },[filter, dpKey])

  const CC={green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)'}
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Active &amp; Paused Campaigns <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <span style={{fontSize:11,color:'var(--text3)'}}>{rows.length} campaigns</span>
      </div>
      {loading&&<div style={{textAlign:'center',padding:40,color:'var(--text3)',fontSize:12}}><div style={{width:26,height:26,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 10px'}}/>Fetching campaigns…</div>}
      {!loading&&rows.length>0&&(
        <div className="tbl-wrap">
          <table className="all-camp-tbl">
            <thead><tr><th>Campaign</th><th>Account</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const cS=parseFloat(r.ins?.spend||0),cCtr=parseFloat(r.ins?.ctr||0),cFr=parseFloat(r.ins?.frequency||0),cRes=parseResults(r.ins,r.currency)
                return (
                  <tr key={i} style={{cursor:'pointer'}} onClick={()=>openMeta('campaign',{accountId:CLIENTS.find(c=>c.name===r.accName)?.accountId,campId:undefined})}>
                    <td><b style={{color:'var(--blue-dk)'}}>{r.campName}</b> <span style={{fontSize:9,color:'var(--text3)'}}>↗</span></td>
                    <td style={{color:'var(--text2)',fontSize:11}}>{r.accName}</td>
                    <td><span className={`obj-b ${objCls(r.obj)}`}>{objLabel(r.obj)}</span></td>
                    <td style={{fontFamily:'JetBrains Mono',fontSize:11}}>{r.ins?fmtSpend(cS,r.S):'—'}</td>
                    <td style={{color:CC[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                    <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>{cCtr>0?cCtr.toFixed(2)+'%':'—'}</td>
                    <td style={cFr>=2.5?{color:'var(--red)',fontWeight:600}:cFr>=2?{color:'var(--amber)'}:{}}>{cFr>0?cFr.toFixed(2):'—'}</td>
                    <td><div className="st-ind"><div className={`st-dot ${r.status.dot}`}/>{r.status.label}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading&&rows.length===0&&<div className="no-data-box">No campaigns found for this period.</div>}
    </div>
  )
}

// ── Live Alerts View ──────────────────────────────────────────────────────────
function AlertsView({dateParams, activeDateLabel, filter, onIssuesLoaded}) {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const dpKey = JSON.stringify(dateParams)

  useEffect(()=>{
    setLoad(true); setData(null)
    const results={rejected:[],billing:[],noSpend:[],highFreq:[],topPerf:[]}

    Promise.all(CLIENTS.map(async cl=>{
      const S=SYM(cl.currency)
      try {
        // Account info — status, balance, spend cap
        const acc=await apiFetch(`act_${cl.accountId}`,{fields:'name,account_status,balance,spend_cap,amount_spent,disable_reason,currency'})
        if(!acc.error) {
          const statusMap={1:'Active',2:'Disabled',3:'Unsettled',7:'Pending Review',9:'Grace Period',100:'Pending Closure',101:'Closed'}
          if(acc.account_status!==1) {
            results.billing.push({client:cl.name,key:cl.key,accountId:cl.accountId,status:statusMap[acc.account_status]||`Status ${acc.account_status}`,detail:acc.disable_reason?`Reason: ${acc.disable_reason}`:'Fix in Meta Business Manager → Billing',severity:acc.account_status===9?'r':'a'})
          }
          // Spend cap check
          if(acc.spend_cap&&parseFloat(acc.spend_cap)>0) {
            const spent=parseFloat(acc.amount_spent||0)/100, cap=parseFloat(acc.spend_cap)/100, pct=cap>0?(spent/cap)*100:0
            if(pct>=85) results.billing.push({client:cl.name,key:cl.key,accountId:cl.accountId,status:`Spend Cap ${pct.toFixed(0)}% Used`,detail:`${S}${fmtSpend(spent,'').replace(S,'')} of ${S}${fmtSpend(cap,'').replace(S,'')} cap used — increase cap or ads will stop`,severity:pct>=95?'r':'a'})
          }
          // Low balance
          const bal=parseFloat(acc.balance||0)
          if(bal>=0&&bal<500&&acc.account_status===1) results.billing.push({client:cl.name,key:cl.key,accountId:cl.accountId,status:'Low Balance',detail:`Balance: ${S}${bal.toFixed(0)} — top up to prevent delivery interruption`,severity:bal<50?'r':'a'})
        }

        // Rejected / disapproved ads (active only)
        const ads=await apiFetch(`act_${cl.accountId}/ads`,{
          fields:'name,effective_status,ad_review_feedback',
          filtering:JSON.stringify([{field:'effective_status',operator:'IN',value:['DISAPPROVED','WITH_ISSUES']}]),
          limit:'10'
        })
        ;(ads.data||[]).forEach(ad=>{
          let reason='Policy violation or creative issue'
          if(ad.ad_review_feedback) {
            try {
              // feedback is nested: { global: { POLICY: ['reason1'] } } or similar
              const extractStrings = (obj) => {
                if(typeof obj === 'string') return [obj]
                if(Array.isArray(obj)) return obj.flatMap(extractStrings)
                if(typeof obj === 'object' && obj) return Object.values(obj).flatMap(extractStrings)
                return []
              }
              const reasons = extractStrings(ad.ad_review_feedback).filter(s=>s&&s.length>2)
              if(reasons.length) reason = reasons.slice(0,2).join(' · ')
            } catch(e) {}
          }
          results.rejected.push({client:cl.name,key:cl.key,accountId:cl.accountId,adId:ad.id,campId:ad.campaign_id,adName:ad.name,status:ad.effective_status,reason})
        })

        // Insights — zero spend + high frequency adsets
        const ins=await apiFetch(`act_${cl.accountId}/insights`,{fields:'spend,frequency,impressions,campaign_name,campaign_id,adset_id,actions,ctr,cpm',level:'adset',limit:'50',...dateParams})
        const rows=ins.data||[]
        const totalSpend=rows.reduce((s,r)=>s+parseFloat(r.spend||0),0)
        if(totalSpend===0&&acc.account_status===1) results.noSpend.push({client:cl.name,key:cl.key,accountId:cl.accountId})
        rows.forEach(row=>{
          const freq=parseFloat(row.frequency||0)
          if(freq>=2.5) results.highFreq.push({client:cl.name,key:cl.key,accountId:cl.accountId,adsetId:row.adset_id,campId:row.campaign_id,freq:freq.toFixed(2),spend:fmtSpend(parseFloat(row.spend||0),S),severity:freq>=3?'r':'a'})
        })

        // Top performing campaigns (active only, with spend)
        const campIns=await apiFetch(`act_${cl.accountId}/insights`,{fields:'campaign_name,campaign_id,spend,actions,ctr,frequency',level:'campaign',limit:'20',...dateParams})
        ;(campIns.data||[]).forEach(row=>{
          const spend=parseFloat(row.spend||0)
          if(spend<50) return
          const res=parseResults(row,cl.currency)
          if(res.count>0) results.topPerf.push({client:cl.name,key:cl.key,accountId:cl.accountId,campId:row.campaign_id,campName:row.campaign_name,spend:fmtSpend(spend,S),result:res.text,ctr:parseFloat(row.ctr||0).toFixed(2)+'%',cpa:Math.round(spend/res.count),S})
        })
      } catch(e) { /* skip */ }
    })).then(()=>{
      results.topPerf.sort((a,b)=>a.cpa-b.cpa)
      // Deduplicate highFreq by client
      const seen=new Set()
      results.highFreq=results.highFreq.filter(r=>{ const k=r.client+r.freq; if(seen.has(k)) return false; seen.add(k); return true })

      // Build per-account issue map for sidebar badges
      const issueMap = {}
      CLIENTS.forEach(c=>{ issueMap[c.key]=0 })
      results.rejected.forEach(r=>{ if(issueMap[r.key]!==undefined) issueMap[r.key]++ })
      results.billing.forEach(r=>{ if(issueMap[r.key]!==undefined) issueMap[r.key]++ })
      results.noSpend.forEach(r=>{ if(issueMap[r.key]!==undefined) issueMap[r.key]++ })
      results.highFreq.forEach(r=>{ if(issueMap[r.key]!==undefined) issueMap[r.key]++ })
      if(onIssuesLoaded) onIssuesLoaded(issueMap)

      setData(results); setLoad(false)
    })
  },[dpKey])

  // Apply sidebar filter
  const fd = data && filter !== 'all' ? {
    rejected: data.rejected.filter(r=>r.key===filter),
    billing:  data.billing.filter(r=>r.key===filter),
    noSpend:  data.noSpend.filter(r=>r.key===filter),
    highFreq: data.highFreq.filter(r=>r.key===filter),
    topPerf:  data.topPerf.filter(r=>r.key===filter),
  } : data
  const d = fd

  const totalCritical=d?(d.rejected.length+d.billing.filter(b=>b.severity==='r').length+d.noSpend.length):0
  const totalWarn=data?(data.billing.filter(b=>b.severity==='a').length+data.highFreq.length):0

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Alerts &amp; Recommendations <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span></div>
        {data&&<div style={{display:'flex',gap:6}}>
          {totalCritical>0&&<span className="pill pill-r">🚨 {totalCritical} Critical</span>}
          {totalWarn>0&&<span className="pill pill-a">⚠ {totalWarn} Warnings</span>}
          {totalCritical===0&&totalWarn===0&&<span className="pill pill-g">✓ All Clear</span>}
        </div>}
      </div>

      {loading&&<div style={{textAlign:'center',padding:50,color:'var(--text3)'}}>
        <div style={{width:28,height:28,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/>
        <div style={{fontSize:12}}>Checking {filter==='all'?`all ${CLIENTS.length} accounts`:CLIENTS.find(c=>c.key===filter)?.name||filter} for issues…<br/><span style={{fontSize:11,opacity:.7}}>Fetching ad status, billing, frequency data from Meta API</span></div>
      </div>}

      {d&&<>
        {/* Rejected Ads */}
        <div className="alerts-panel">
          <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🚫 Rejected / Disapproved Ads</span>
            <span className={`pill ${d.rejected.length>0?'pill-r':'pill-g'}`}>{d.rejected.length>0?`${d.rejected.length} Rejected`:'✓ None'}</span>
          </div>
          {d.rejected.length===0
            ?<div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No disapproved or rejected ads</div><div className="ar-sub">{`All active ads across all ${CLIENTS.length} accounts are approved.`}</div></div></div>
            :d.rejected.map((a,i)=>(
              <div key={i} className="alert-row">
                <div className="ar-ico r">🚫</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — Ad Rejected: "{a.adName}"</div><div className="ar-sub">Status: <b>{a.status}</b> · {a.reason}</div></div>
                <span className="ar-tag">{a.client}</span>
                <span className="ar-lift" style={{background:'var(--red-lt)',color:'var(--red)',borderColor:'var(--red-bd)'}}>Fix Required</span>
                <button className="ar-btn" onClick={()=>openMeta('ad',{accountId:a.accountId,adId:a.adId})}>Review in Meta →</button>
              </div>
            ))}
        </div>

        {/* Billing & Account Status */}
        <div className="alerts-panel">
          <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>💳 Billing &amp; Account Status</span>
            <span className={`pill ${d.billing.length>0?'pill-r':'pill-g'}`}>{d.billing.length>0?`${d.billing.length} Issues`:'✓ All Healthy'}</span>
          </div>
          {d.billing.length===0
            ?<div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No billing or payment issues</div><div className="ar-sub">All accounts are active with no payment errors or status issues detected.</div></div></div>
            :d.billing.map((a,i)=>(
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.severity}`}>{a.severity==='r'?'🚨':'⚠️'}</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — {a.status}</div><div className="ar-sub">{a.detail}</div></div>
                <span className="ar-tag">{a.client}</span>
                <button className="ar-btn" onClick={()=>openMeta(a.type==='balance'||a.type==='spend_cap'?'billing':'account',{accountId:a.accountId})}>Fix in Meta →</button>
              </div>
            ))}
        </div>

        {/* Zero Spend */}
        {d.noSpend.length>0&&(
          <div className="alerts-panel">
            <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>💸 Zero Spend — {activeDateLabel}</span>
              <span className="pill pill-r">{d.noSpend.length} Accounts</span>
            </div>
            {d.noSpend.map((a,i)=>(
              <div key={i} className="alert-row">
                <div className="ar-ico r">💸</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — No spend in {activeDateLabel}</div><div className="ar-sub">Zero ad delivery this period. Check if campaigns are active and billing is set up correctly.</div></div>
                <span className="ar-tag">{a.client}</span>
                <button className="ar-btn" onClick={()=>openMeta('campaigns',{accountId:a.accountId})}>Check Account →</button>
              </div>
            ))}
          </div>
        )}

        {/* High Frequency */}
        <div className="alerts-panel">
          <div className="ap-hdr" style={{background:'rgba(217,119,6,0.03)'}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🔁 High Frequency — Audience Fatigue Risk</span>
            <span className={`pill ${d.highFreq.length>0?'pill-a':'pill-g'}`}>{d.highFreq.length>0?`${d.highFreq.length} Ad Sets`:'✓ All Good'}</span>
          </div>
          {d.highFreq.length===0
            ?<div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No high-frequency ad sets</div><div className="ar-sub">All ad sets are below the 2.5 frequency threshold.</div></div></div>
            :d.highFreq.map((a,i)=>(
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.severity}`}>{a.severity==='r'?'🚨':'⚠️'}</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — Frequency {a.freq} {parseFloat(a.freq)>=3?'· Audience Burnt':'· Fatigue Risk'}</div><div className="ar-sub">Spend {a.spend} at freq {a.freq}. {parseFloat(a.freq)>=3?'Pause and refresh creative — audience fully saturated.':'Consider refreshing creative or expanding audience targeting.'}</div></div>
                <span className="ar-tag">{a.client}</span>
                <span className={a.severity==='r'?'chip-r':'chip-a'}>Freq {a.freq}</span>
                <button className="ar-btn" onClick={()=>openMeta('adset',{accountId:a.accountId,adsetId:a.adsetId})}>Refresh Creative →</button>
              </div>
            ))}
        </div>

        {/* Top Performers */}
        {d.topPerf.length>0&&(
          <div className="alerts-panel">
            <div className="ap-hdr" style={{background:'rgba(125,194,66,0.03)'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>📈 Top Performing Campaigns — {activeDateLabel}</span>
              <span className="pill pill-g">{d.topPerf.length} with Results</span>
            </div>
            {d.topPerf.slice(0,8).map((a,i)=>(
              <div key={i} className="alert-row">
                <div className="ar-ico g">{i===0?'⭐':'📈'}</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — {a.campName}</div><div className="ar-sub">Spend: <b>{a.spend}</b> · {a.result} · CTR: <b>{a.ctr}</b></div></div>
                <span className="ar-tag">{a.client}</span>
                <span className="ar-lift">{a.S}{a.cpa} CPA</span>
                <button className="ar-btn" onClick={()=>openMeta('campaign',{accountId:a.accountId,campId:a.campId})}>Scale →</button>
              </div>
            ))}
          </div>
        )}
      </>}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [view,       setView]     = useState('accounts')
  const [filter,     setFilter]   = useState('all')
  const [dateRange,  setDateRange]= useState('Today')
  const [showCustom, setShowC]    = useState(false)
  const [customFrom, setFrom]     = useState('')
  const [customTo,   setTo]       = useState('')
  const [customLabel,setCustLbl]  = useState('')
  const customRef = useRef(null)

  // Live statsbar data aggregated from all account cards
  const [liveStats,  setLiveStats]  = useState({})  // { accountId: insObj }
  const [issueMap,   setIssueMap]   = useState({})  // { clientKey: issueCount }

  useEffect(()=>{
    const h=e=>{ if(customRef.current&&!customRef.current.contains(e.target)) setShowC(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[])

  const todayStr=new Date().toISOString().split('T')[0]
  function applyCustom(){
    if(!customFrom||!customTo) return
    const fmt=d=>{ const[,m,dd]=d.split('-'); return `${dd}/${m}` }
    setCustLbl(`${fmt(customFrom)}–${fmt(customTo)}`); setDateRange('custom'); setShowC(false)
  }

  const activeDateLabel=dateRange==='custom'?customLabel:dateRange
  const dateParams=getDateParams(dateRange, customFrom, customTo)

  // Callback from each AccCard to update live statsbar
  const handleDataLoad = (accountId, ins, err) => {
    setLiveStats(prev=>({...prev, [accountId]: ins}))
  }

  // Compute live statsbar totals — filtered by sidebar selection
  const filteredClients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)
  const filteredIns     = filteredClients.map(c=>liveStats[c.accountId]).filter(Boolean)
  const totalSpend      = filteredIns.reduce((s,d)=>s+parseFloat(d?.spend||0),0)
  const totalImpr       = filteredIns.reduce((s,d)=>s+parseInt(d?.impressions||0),0)
  const totalReach      = filteredIns.reduce((s,d)=>s+parseInt(d?.reach||0),0)
  const totalClicks     = filteredIns.reduce((s,d)=>s+parseInt(d?.clicks||0),0)
  const avgCtr          = filteredIns.filter(d=>parseFloat(d?.ctr||0)>0)
  const avgCtrVal       = avgCtr.length ? avgCtr.reduce((s,d)=>s+parseFloat(d.ctr||0),0)/avgCtr.length : 0
  const activeCount     = filteredClients.filter(c=>{ const d=liveStats[c.accountId]; return d&&parseFloat(d.spend||0)>0 }).length
  const statsReady      = Object.keys(liveStats).length > 0
  const isFiltered      = filter !== 'all'
  const filterName      = isFiltered ? CLIENTS.find(c=>c.key===filter)?.name?.split(' ').slice(0,2).join(' ') : null

  // Sidebar — fully derived from CLIENTS list, no static scores
  const sidebar = [
    {section:'All Clients'},
    {key:'all', dot:'g', name:'All Accounts'},
    {section:'By Client', mt:true},
    ...CLIENTS.map(c=>({key:c.key, dot:'g', name:c.name.split(' ').slice(0,2).join(' ')}))
  ]

  const visibleClients=filter==='all'?CLIENTS:CLIENTS.filter(c=>c.key===filter)

  return (
    <>
      <div className="bg-layer">
        <svg className="bl-1" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z"/></svg>
        <svg className="bl-2" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z"/></svg>
        <svg className="bl-3" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0z"/></svg>
        <svg className="bl-4" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z"/></svg>
      </div>
      <div className="wm"><span>merakiads</span></div>

      <div className="topbar">
        <a className="logo" href="#"><span className="m">meraki</span><span className="a">ads</span></a>
        <div className="topbar-div"/>
        <span className="topbar-lbl">Meta Intelligence · Live</span>
        <div className="view-tabs">
          {['accounts','campaigns','alerts'].map(v=>(
            <div key={v} className={`vtab${view===v?' active':''}`} onClick={()=>setView(v)}>
              {v==='accounts'?'Account View':v==='campaigns'?'Campaign Table':'Alerts & Recommendations'}
            </div>
          ))}
        </div>
        <div className="topbar-right">
          {statsReady
            ?<>
              {isFiltered&&<span className="pill pill-b">🔍 {filterName}</span>}
              <span className="pill pill-g">● {activeCount} Spending</span>
              <span className="pill pill-b">{fmtSpend(totalSpend)}</span>
            </>
            :<><span className="pill pill-g">● {CLIENTS.length} Accounts</span></>}
          <button className="refresh-btn" onClick={()=>window.location.reload()}>↻ Refresh</button>
        </div>
      </div>

      <div className="sidebar">
        <div className="sb-section">All Clients</div>
        <div className={`sb-item${filter==='all'?' active':''}`} onClick={()=>setFilter('all')}>
          <div className="sb-dot g"/><span className="sb-name">All Accounts</span>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            {Object.values(issueMap).reduce((s,n)=>s+n,0)>0&&(
              <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,background:'var(--red-lt)',color:'var(--red)',border:'1px solid var(--red-bd)'}}>
                !{Object.values(issueMap).reduce((s,n)=>s+n,0)}
              </span>
            )}
            <span className="sb-score sc-na">{CLIENTS.length}</span>
          </div>
        </div>
        <div className="sb-section" style={{marginTop:4}}>By Account</div>
        {CLIENTS.map(cl=>{
          const ins=liveStats[cl.accountId]
          const hasSpend=ins&&parseFloat(ins.spend||0)>0
          const freq=ins?parseFloat(ins.frequency||0):0
          const dot=!ins?'e':hasSpend?freq>=2.5?'r':freq>=2?'a':'g':'e'
          const score=ins&&!ins._err&&hasSpend?(()=>{
            const ctr=parseFloat(ins.ctr||0),fr=parseFloat(ins.frequency||0)
            let s=70; if(ctr>=2)s+=10; else if(ctr>=1.5)s+=5; else if(ctr<0.5)s-=10
            if(fr>=3)s-=20; else if(fr>=2.5)s-=12; else if(fr>=2)s-=5
            return Math.max(0,Math.min(100,Math.round(s)))
          })():null
          const scoreCls=!score?'sc-na':score>=75?'sc-hi':score>=60?'sc-md':'sc-lo'
          const issueCount = issueMap[cl.key] || 0
          return (
            <div key={cl.key} className={`sb-item${filter===cl.key?' active':''}`} onClick={()=>setFilter(cl.key)}>
              <div className={`sb-dot ${dot}`}/>
              <span className="sb-name">{cl.name.length>20?cl.name.slice(0,20)+'…':cl.name}</span>
              <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                {issueCount>0&&(
                  <span style={{
                    fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,
                    background:'var(--red-lt)',color:'var(--red)',border:'1px solid var(--red-bd)',
                    whiteSpace:'nowrap'
                  }}>!{issueCount}</span>
                )}
                <span className={`sb-score ${scoreCls}`}>{score??'—'}</span>
              </div>
            </div>
          )
        })}
        <div className="sb-section" style={{marginTop:6}}>Live Status</div>
        <div className="sb-info">
          📅 {activeDateLabel}<br/>
          🔗 Meta API · <span style={{color:'var(--green-dk)'}}>Connected</span><br/>
          {statsReady&&<>
            {isFiltered&&<><b style={{color:'var(--blue-dk)'}}>🔍 {filterName}</b><br/></>}
            💰 Spend: <b>{fmtSpend(totalSpend)}</b><br/>
            📊 Impressions: <b>{fmtNum(totalImpr)}</b><br/>
            🖱 Clicks: <b>{fmtNum(totalClicks)}</b><br/>
            {!isFiltered&&<>✅ {activeCount}/{CLIENTS.length} spending</>}
          </>}
        </div>
      </div>

      <div className="statsbar">
        {statsReady
          ?<>
            {isFiltered&&<div className="kpi-pill kpi-b" style={{borderColor:'var(--blue-bd)',background:'var(--blue-lt)'}}><div className="kpi-dot"/><span className="kpi-lbl">Filter</span><span className="kpi-val" style={{fontSize:11,maxWidth:90,overflow:'hidden',textOverflow:'ellipsis'}}>{filterName}</span></div>}
            <div className="kpi-pill kpi-g"><div className="kpi-dot"/><span className="kpi-lbl">Spend</span><span className="kpi-val">{fmtSpend(totalSpend)}</span></div>
            <div className="kpi-pill kpi-b"><div className="kpi-dot"/><span className="kpi-lbl">Impressions</span><span className="kpi-val">{fmtNum(totalImpr)}</span></div>
            <div className="kpi-pill kpi-n"><div className="kpi-dot"/><span className="kpi-lbl">Reach</span><span className="kpi-val">{fmtNum(totalReach)}</span></div>
            <div className="kpi-pill kpi-n"><div className="kpi-dot"/><span className="kpi-lbl">Clicks</span><span className="kpi-val">{fmtNum(totalClicks)}</span></div>
            {avgCtrVal>0&&<div className={`kpi-pill ${avgCtrVal>=1.5?'kpi-g':avgCtrVal<0.8?'kpi-r':'kpi-n'}`}><div className="kpi-dot"/><span className="kpi-lbl">Avg CTR</span><span className="kpi-val">{avgCtrVal.toFixed(2)}%</span></div>}
            {!isFiltered&&<><div className="sb-sep"/><div className="kpi-pill kpi-g"><div className="kpi-dot"/><span className="kpi-lbl">Spending</span><span className="kpi-val">{activeCount}/{CLIENTS.length}</span></div></>}
          </>
          :<div className="kpi-pill kpi-n"><Spinner size={11}/><span className="kpi-lbl" style={{marginLeft:4}}>Loading live data…</span></div>
        }
        <div className="sb-sep"/>
        <div className="date-grp">
          <button className={`dr${dateRange==='Today'?' active':''}`} onClick={()=>setDateRange('Today')}>Today</button>
          <div style={{display:'flex',alignItems:'center',gap:4,background:dateRange==='custom'?'var(--green-lt)':'rgba(0,0,0,0.04)',border:dateRange==='custom'?'1px solid var(--green-bd)':'1px solid var(--border)',borderRadius:20,padding:'3px 10px'}}>
            <span style={{fontSize:10,fontWeight:600,color:dateRange==='custom'?'var(--green-dk)':'var(--text3)',whiteSpace:'nowrap'}}>From</span>
            <input type="date" max={customTo||todayStr} value={customFrom}
              onChange={e=>{ setFrom(e.target.value); if(e.target.value&&customTo){ const fmt=d=>{ const[,m,dd]=d.split('-'); return `${dd}/${m}` }; setCustLbl(`${fmt(e.target.value)}–${fmt(customTo)}`); setDateRange('custom') }}}
              style={{fontFamily:'JetBrains Mono',fontSize:10,border:'none',background:'transparent',color:dateRange==='custom'?'var(--green-dk)':'var(--text)',outline:'none',cursor:'pointer',width:100}}/>
            <span style={{fontSize:10,fontWeight:600,color:dateRange==='custom'?'var(--green-dk)':'var(--text3)'}}>→</span>
            <input type="date" min={customFrom} max={todayStr} value={customTo}
              onChange={e=>{ setTo(e.target.value); if(customFrom&&e.target.value){ const fmt=d=>{ const[,m,dd]=d.split('-'); return `${dd}/${m}` }; setCustLbl(`${fmt(customFrom)}–${fmt(e.target.value)}`); setDateRange('custom') }}}
              style={{fontFamily:'JetBrains Mono',fontSize:10,border:'none',background:'transparent',color:dateRange==='custom'?'var(--green-dk)':'var(--text)',outline:'none',cursor:'pointer',width:100}}/>
          </div>
        </div>
      </div>

      <div className="main-wrap"><div className="main">
        {view==='accounts'&&(
          <div>
            <div className="sec-hdr">
              <div className="sec-ttl">Client Accounts <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span></div>
              <span style={{fontSize:11,color:'var(--text3)'}}>{visibleClients.length} accounts</span>
            </div>
            <div className="accounts">
              {CLIENTS.map(c=>(
                <AccCard
                  key={c.key+JSON.stringify(dateParams)}
                  client={c}
                  dateParams={dateParams}
                  activeDateLabel={activeDateLabel}
                  isVisible={filter==='all'||filter===c.key}
                  onDataLoad={handleDataLoad}
                />
              ))}
            </div>
          </div>
        )}
        {view==='campaigns'&&<CampaignsView filter={filter} dateParams={dateParams} activeDateLabel={activeDateLabel}/>}
        {/* Always mounted so it prefetches on load */}
        <div style={{display:view==='alerts'?'block':'none'}}>
          <AlertsView dateParams={dateParams} activeDateLabel={activeDateLabel} filter={filter} onIssuesLoaded={setIssueMap}/>
        </div>
      </div></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
