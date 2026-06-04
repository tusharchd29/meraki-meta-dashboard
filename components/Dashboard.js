'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Exact client config from original HTML ────────────────────────────────────
const CLIENTS = [
  { key:'volvo',      name:'Volvo (Krishna — Meraki Ads)',         accountId:'833603637085666',  currency:'INR', vertical:'Automotive', status:'ok',   dot:'g', score:88 },
  { key:'north-old',  name:'North International (Old Account)',    accountId:'1297775434831152', currency:'INR', vertical:'Education',   status:'ok',   dot:'g', score:81 },
  { key:'pyarababy',  name:'PyaraBaby',                            accountId:'254564808465114',  currency:'INR', vertical:'Ecommerce',   status:'ok',   dot:'g', score:80 },
  { key:'honda',      name:'Courtesy Honda',                       accountId:'787341982723949',  currency:'INR', vertical:'Automotive', status:'ok',   dot:'g', score:71 },
  { key:'ssw',        name:'Sri Sri Well Being (SSW Mohali)',      accountId:'1999892177251081', currency:'INR', vertical:'Wellness',    status:'ok',   dot:'g', score:67 },
  { key:'outlander',  name:'Outlander 4×4 New Zealand',            accountId:'1318511879920658', currency:'NZD', vertical:'Auto/Services',status:'ok',  dot:'g', score:66 },
  { key:'pratha',     name:'Pratha Preschool',                     accountId:'1851775342206755', currency:'INR', vertical:'Education',   status:'warn', dot:'a', score:55 },
  { key:'asia',       name:'Asia Cosmetic Hospital',               accountId:'1444189929969376', currency:'THB', vertical:'Healthcare',  status:'err',  dot:'r', score:null },
  { key:'veriseek',   name:'Veriseek AI',                          accountId:'3252000788333236', currency:'INR', vertical:'EdTech',      status:'err',  dot:'r', score:null },
  { key:'faith',      name:'Faith Diagnostics',                    accountId:'330235162',        currency:'INR', vertical:'Healthcare',  status:'err',  dot:'r', score:null },
  { key:'north-new',  name:'North International (New — Hiring)',   accountId:'1418599015829087', currency:'INR', vertical:'Education',   status:'err',  dot:'r', score:null },
  { key:'bodyt',      name:'Body Temple',                          accountId:'2001372527419414', currency:'INR', vertical:'Health/Fitness',status:'off', dot:'e', score:null },
]

const TOKEN = 'EAAZBpEehq4PMBRmHs3Sxb1nUs3hlDaT9gnV98n5Vhi3iZBGRRvC5DR2CSNESBFthGqtjhUCwqL2fRHh1ZBZAinoGEP3CLz2OBFaFTpZAZB2SBkC8lAWr0pOYypkVx1HuF0LjOsXn8awJtsyY5f4vKRp5ffoz94ipHoieTSTkevVUGqPJBoivGaPEi9ES49oOwjuvLaLnSxwZCnR82MNFoeHGoqkZBhU2L7DENaeYjgZDZD'

// ── Helpers ───────────────────────────────────────────────────────────────────
function sym(cur) {
  if (cur==='THB') return '฿'
  if (cur==='NZD') return 'NZ$'
  return '₹'
}
function fmtSpend(n, s='₹') {
  const v = parseFloat(n||0)
  if (!v) return s+'0'
  if (v>=100000) return s+(v/100000).toFixed(1)+'L'
  if (v>=1000)   return s+(v/1000).toFixed(1)+'K'
  return s+Math.round(v)
}
function fmtNum(n) {
  const v = parseFloat(n||0)
  if (!v) return '0'
  if (v>=1000000) return (v/1000000).toFixed(1)+'M'
  if (v>=1000)    return (v/1000).toFixed(1)+'K'
  return Math.round(v).toString()
}
function getDateParams(preset, cfrom, cto) {
  if (preset==='Today')      return {date_preset:'today'}
  if (preset==='Last 7D')    return {date_preset:'last_7_days'}
  if (preset==='14D')        return {date_preset:'last_14_days'}
  if (preset==='30D')        return {date_preset:'last_30_days'}
  if (preset==='This Month') return {date_preset:'this_month'}
  if (preset==='custom'&&cfrom&&cto) return {time_range:JSON.stringify({since:cfrom,until:cto})}
  return {date_preset:'last_7_days'}
}
function objLabel(o='') {
  const m={OUTCOME_LEADS:'LEADS',OUTCOME_SALES:'SALES',OUTCOME_AWARENESS:'AWARENESS',OUTCOME_ENGAGEMENT:'ENGAGEMENT',OUTCOME_TRAFFIC:'TRAFFIC',LEAD_GENERATION:'LEADS',CONVERSIONS:'SALES',MESSAGES:'LEADS',POST_ENGAGEMENT:'ENGAGEMENT',VIDEO_VIEWS:'AWARENESS',REACH:'AWARENESS',BRAND_AWARENESS:'AWARENESS',LINK_CLICKS:'TRAFFIC',PAGE_LIKES:'ENGAGEMENT',OUTCOME_APP_PROMOTION:'APP'}
  return m[o.toUpperCase().replace(/\s/g,'_')] || o || '—'
}
function objCls(o) {
  const l=objLabel(o)
  if(l==='LEADS') return 'obj-leads'
  if(l==='SALES') return 'obj-sales'
  if(l==='AWARENESS') return 'obj-aware'
  if(l==='ENGAGEMENT') return 'obj-eng'
  return 'obj-traffic'
}
function campStatus(c) {
  const s=(c.effective_status||c.status||'').toUpperCase()
  if(s==='ACTIVE')  return {dot:'on',  label:'Active'}
  if(s==='PAUSED')  return {dot:'na',  label:'Paused'}
  if(s==='ARCHIVED')return {dot:'na',  label:'Archived'}
  if(s.includes('ERROR')||s.includes('DISAPPROVED')) return {dot:'off',label:'Error'}
  return {dot:'na',label:s||'—'}
}
function getResults(ins, currency) {
  if (!ins) return {text:'—', cls:''}
  const spend = parseFloat(ins.spend||0)
  const s = sym(currency)
  if (ins.actions?.length) {
    const priority = ['lead','onsite_conversion.lead_grouped','purchase','onsite_conversion.messaging_first_reply','contact_total','landing_page_view']
    for (const k of priority) {
      const a = ins.actions.find(x=>x.action_type===k||x.action_type?.includes(k.split('.')[0]))
      if (a) {
        const cnt = parseInt(a.value||0)
        const cpa = cnt>0 ? Math.round(spend/cnt) : null
        const lbl = k.includes('purchase')?'Purchases':k.includes('lead')||k.includes('landing')?'Leads':k.includes('message')||k.includes('contact')?'Convos':'Results'
        return {text:`${cnt} ${lbl}${cpa?' · CPL '+s+cpa:''}`, cls:cnt>0?'green':'red'}
      }
    }
    const a=ins.actions[0]
    return {text:`${parseInt(a.value||0)} ${a.action_type?.split('.').pop()||'results'}`,cls:''}
  }
  if(ins.video_thruplay_watched_actions?.[0]) {
    const tp=parseInt(ins.video_thruplay_watched_actions[0].value||0)
    const ctp=tp>0?Math.round(spend/tp):null
    return {text:`${fmtNum(tp)} ThruPlays${ctp?' · '+s+(ctp<1?ctp.toFixed(3):ctp):''}`,cls:'green'}
  }
  if(ins.impressions) return {text:fmtNum(ins.impressions)+' impressions',cls:''}
  return {text:'—',cls:''}
}
async function apiFetch(endpoint, params={}) {
  const qs = new URLSearchParams({endpoint, token:TOKEN, ...params})
  const r = await fetch(`/api/meta?${qs}`)
  return r.json()
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({size=14}) {
  return <div style={{width:size,height:size,border:'2px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccCard({client, dateParams, activeDateLabel, isVisible}) {
  const [open, setOpen]       = useState(false)
  const [ins,  setIns]        = useState(null)
  const [insLoading, setInsL] = useState(true)
  const [camps, setCamps]     = useState([])
  const [campLoading, setCampL] = useState(false)
  const dpKey = JSON.stringify(dateParams)

  // Fetch account-level insights on mount + date change
  useEffect(()=>{
    setInsL(true); setIns(null)
    apiFetch(`act_${client.accountId}/insights`,{
      fields:'spend,impressions,clicks,ctr,cpm,reach,frequency,actions,video_thruplay_watched_actions',
      ...dateParams
    }).then(d=>{
      setIns(d.data?.[0]||null)
      setInsL(false)
    }).catch(()=>setInsL(false))
  },[client.accountId, dpKey])

  // Fetch campaigns when opened + date change
  useEffect(()=>{
    if(!open) return
    setCampL(true); setCamps([])
    apiFetch(`act_${client.accountId}/campaigns`,{
      fields:'name,objective,status,effective_status,daily_budget,lifetime_budget',
      limit:'25'
    }).then(async d=>{
      const list = d.data||[]
      const withIns = await Promise.all(list.map(async c=>{
        try {
          const ci = await apiFetch(`${c.id}/insights`,{
            fields:'spend,impressions,clicks,ctr,cpm,frequency,actions,reach,video_thruplay_watched_actions',
            ...dateParams
          })
          return {...c, ins:ci.data?.[0]||null}
        } catch { return {...c,ins:null} }
      }))
      // Sort by spend desc, filter 0-spend last
      withIns.sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      setCamps(withIns)
      setCampL(false)
    }).catch(()=>setCampL(false))
  },[open, client.accountId, dpKey])

  if (!isVisible) return null

  const S     = sym(client.currency)
  const spend = parseFloat(ins?.spend||0)
  const impr  = parseInt(ins?.impressions||0)
  const ctr   = parseFloat(ins?.ctr||0)
  const freq  = parseFloat(ins?.frequency||0)
  const cpm   = parseFloat(ins?.cpm||0)
  const reach = parseInt(ins?.reach||0)
  const clicks= parseInt(ins?.clicks||0)
  const res   = getResults(ins, client.currency)

  // Derive score color
  const scoreColor = client.score>=75?'var(--green)':client.score>=60?'var(--amber)':'var(--red)'

  // Status badge
  const badgeCls = client.status==='ok'?'sb-live':client.status==='warn'?'sb-warn':client.status==='err'?'sb-err':'sb-off'
  const badgeTxt = client.status==='ok'?'LIVE':client.status==='warn'?'FREQ CRITICAL':client.status==='err'?'ISSUE':'NOT ENABLED'

  return (
    <div className={`acc-card ${client.status}${open?' open':''}`} data-client={client.key}>
      <div className="acc-hdr" onClick={()=>setOpen(o=>!o)}>
        <div className="acc-exp">›</div>
        <div className={`acc-sdot ${client.dot}`}/>
        <div className="acc-info">
          <div className="acc-name">{client.name}</div>
          <div className="acc-meta">#{client.accountId} · {client.currency} · {client.vertical} · {activeDateLabel}</div>
        </div>

        {/* KPI boxes — matching original HTML layout */}
        <div className="acc-kpis">
          {insLoading ? (
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px'}}>
              <Spinner size={11}/><span style={{fontSize:10,color:'var(--text3)'}}>Loading…</span>
            </div>
          ) : ins ? (
            <>
              <div className="kc"><div className="kc-lbl">Spend</div>
                <div className={`kc-val ${spend>0?'n':'r'}`}>{fmtSpend(spend,S)}</div></div>
              <div className="kc"><div className="kc-lbl">Impressions</div>
                <div className="kc-val n">{fmtNum(impr)}</div></div>
              <div className="kc"><div className="kc-lbl">Clicks</div>
                <div className="kc-val n">{fmtNum(clicks)}</div></div>
              <div className="kc"><div className="kc-lbl">CTR</div>
                <div className={`kc-val ${ctr>=1.5?'g':ctr>0&&ctr<0.8?'r':'n'}`}>{ctr>0?ctr.toFixed(2)+'%':'—'}</div></div>
              <div className="kc"><div className="kc-lbl">CPM</div>
                <div className="kc-val n">{cpm>0?S+cpm.toFixed(0):'—'}</div></div>
              <div className="kc"><div className="kc-lbl">Reach</div>
                <div className="kc-val n">{reach>0?fmtNum(reach):'—'}</div></div>
              <div className="kc"><div className="kc-lbl">Freq</div>
                <div className={`kc-val ${freq>=2.5?'r':freq>=2?'a':'n'}`}>{freq>0?freq.toFixed(2):'—'}</div></div>
              <div className="kc"><div className="kc-lbl">Results</div>
                <div className={`kc-val ${res.cls==='green'?'g':res.cls==='red'?'r':'n'}`} style={{fontSize:10,maxWidth:90,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{res.text}</div></div>
            </>
          ) : (
            <div className="kc"><div className="kc-lbl">Data</div><div className="kc-val r">No data</div></div>
          )}
        </div>

        <div className="acc-right">
          <div className="acc-badges">
            <span className={`s-badge ${badgeCls}`}>{badgeTxt}</span>
            {freq>=2.5 && <span className="chip-r">Freq {freq.toFixed(2)}</span>}
            {freq>=2&&freq<2.5 && <span className="chip-a">Freq {freq.toFixed(2)}</span>}
            {spend===0&&!insLoading && <span className="chip-r">No Spend</span>}
          </div>
          {client.score!==null && (
            <div className="opp-score">
              <span className="opp-lbl">Score</span>
              <div className="opp-bar"><div className="opp-fill" style={{width:`${client.score}%`,background:scoreColor}}/></div>
              <span className="opp-num" style={{color:scoreColor}}>{client.score}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded body */}
      <div className="acc-body">
        {client.key==='bodyt' && (
          <div className="no-data-box">MCP rollout pending. Monitor via Meta Ads Manager directly.</div>
        )}

        {campLoading && (
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'16px 14px',color:'var(--text3)',fontSize:12}}>
            <Spinner size={14}/> Fetching campaigns from Meta API…
          </div>
        )}

        {!campLoading && camps.length===0 && open && client.key!=='bodyt' && (
          <div className="no-data-box">No campaigns found for this period.</div>
        )}

        {!campLoading && camps.length>0 && (
          <table className="camp-tbl">
            <thead>
              <tr><th>Campaign</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr>
            </thead>
            <tbody>
              {camps.map((c,i)=>{
                const ci   = c.ins
                const cs   = campStatus(c)
                const cS   = parseFloat(ci?.spend||0)
                const cCtr = parseFloat(ci?.ctr||0)
                const cFreq= parseFloat(ci?.frequency||0)
                const cRes = getResults(ci, client.currency)
                const colorMap = {green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)',blue:'var(--blue-dk)'}
                return (
                  <tr key={c.id||i}>
                    <td><b>{c.name}</b></td>
                    <td><span className={`obj-b ${objCls(c.objective)}`}>{objLabel(c.objective)}</span></td>
                    <td>{ci?fmtSpend(cS,sym(client.currency)):'—'}</td>
                    <td style={{color:colorMap[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                    <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>{cCtr>0?cCtr.toFixed(2)+'%':'—'}</td>
                    <td style={cFreq>=2.5?{color:'var(--red)',fontWeight:600}:cFreq>=2?{color:'var(--amber)'}:{}}>{cFreq>0?cFreq.toFixed(2):'—'}</td>
                    <td><div className="st-ind"><div className={`st-dot ${cs.dot}`}/>{cs.label}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Insight row */}
        {ins && !campLoading && (
          <div className="insight-row">
            <div className="insight-box ib-trend">
              <div className="ib-ttl">📡 Live Summary — {activeDateLabel}</div>
              <div className="ib-item">Spend: <b>{fmtSpend(spend,S)}</b> · Reach: <b>{fmtNum(reach)}</b> · Impressions: <b>{fmtNum(impr)}</b></div>
              <div className="ib-item">CTR: <b>{ctr>0?ctr.toFixed(2)+'%':'—'}</b> · CPM: <b>{cpm>0?S+cpm.toFixed(0):'—'}</b> · Freq: <b>{freq>0?freq.toFixed(2):'—'}</b></div>
              {res.text!=='—'&&<div className="ib-item">Top Result: <b>{res.text}</b></div>}
            </div>
            {freq>=2&&(
              <div className="insight-box ib-warn">
                <div className="ib-ttl">⚠ Frequency Alert</div>
                <div className="ib-item">Freq <b>{freq.toFixed(2)}</b> — {freq>=2.5?'audience fatigue, refresh creative':'approaching fatigue, monitor closely'}</div>
              </div>
            )}
            {spend===0&&(
              <div className="insight-box ib-err">
                <div className="ib-ttl">🚨 No Spend</div>
                <div className="ib-item">Zero spend in selected period. Check account status, billing, or spend limits in Meta Business Manager.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── All Campaigns view ────────────────────────────────────────────────────────
function CampaignsView({filter, dateParams, activeDateLabel}) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const dpKey = JSON.stringify(dateParams)

  useEffect(()=>{
    setLoading(true); setRows([])
    const clients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)
    Promise.all(clients.map(async cl=>{
      try {
        const cd = await apiFetch(`act_${cl.accountId}/campaigns`,{
          fields:'name,objective,status,effective_status',limit:'25'
        })
        const camps = cd.data||[]
        return Promise.all(camps.map(async c=>{
          try {
            const ci = await apiFetch(`${c.id}/insights`,{
              fields:'spend,impressions,clicks,ctr,cpm,frequency,actions,reach,video_thruplay_watched_actions',
              ...dateParams
            })
            const d=ci.data?.[0]||null
            const cs=campStatus(c)
            return {campName:c.name,accName:cl.name,obj:c.objective,ins:d,status:cs,currency:cl.currency,S:sym(cl.currency)}
          } catch { return null }
        }))
      } catch { return [] }
    })).then(all=>{
      const flat = all.flat().filter(Boolean)
      flat.sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      setRows(flat)
      setLoading(false)
    })
  },[filter, dpKey])

  const colorMap={green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)',blue:'var(--blue-dk)'}
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">All Campaigns <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <span style={{fontSize:11,color:'var(--text3)'}}>{rows.length} campaigns</span>
      </div>
      {loading&&(
        <div style={{textAlign:'center',padding:40,color:'var(--text3)',fontSize:12}}>
          <div style={{width:26,height:26,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 10px'}}/>
          Fetching all campaigns…
        </div>
      )}
      {!loading&&rows.length>0&&(
        <div className="tbl-wrap">
          <table className="all-camp-tbl">
            <thead><tr><th>Campaign</th><th>Account</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const cS   = parseFloat(r.ins?.spend||0)
                const cCtr = parseFloat(r.ins?.ctr||0)
                const cFreq= parseFloat(r.ins?.frequency||0)
                const cRes = getResults(r.ins,r.currency)
                return (
                  <tr key={i}>
                    <td><b>{r.campName}</b></td>
                    <td style={{color:'var(--text2)',fontSize:11}}>{r.accName}</td>
                    <td><span className={`obj-b ${objCls(r.obj)}`}>{objLabel(r.obj)}</span></td>
                    <td>{r.ins?fmtSpend(cS,r.S):'—'}</td>
                    <td style={{color:colorMap[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                    <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>{cCtr>0?cCtr.toFixed(2)+'%':'—'}</td>
                    <td style={cFreq>=2.5?{color:'var(--red)',fontWeight:600}:cFreq>=2?{color:'var(--amber)'}:{}}>{cFreq>0?cFreq.toFixed(2):'—'}</td>
                    <td><div className="st-ind"><div className={`st-dot ${r.status.dot}`}/>{r.status.label}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading&&rows.length===0&&<div className="no-data-box">No campaign data for this period.</div>}
    </div>
  )
}

// ── Alerts view (static from original HTML — these are analyst insights) ──────
function AlertsView() {
  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Alerts &amp; Recommendations <span className="live-badge">● Based on Live Data</span></div>
      </div>
      {[
        {
          title:'🚨 Critical — Fix Today', titleCls:'r', pillCls:'pill-r', pillTxt:'4 Critical',
          bg:'rgba(224,82,82,0.03)',
          rows:[
            {ico:'r',e:'🚨',ttl:'Veriseek AI — IN_GRACE_PERIOD · Spend Collapsed 99% · Billing Emergency',sub:'Only ₹435 total spend last 7D vs normal levels. Brand Awareness alone active at ₹36. 3 of 4 campaigns fully paused. Fix billing in Meta Business Manager NOW or all delivery stops permanently.',tag:'Veriseek',btn:'Fix Billing →'},
            {ico:'r',e:'🚨',ttl:'Asia Cosmetic — 0 Leads in 7 Days · Compliance Campaign Burnt (Freq 3.23)',sub:'฿6,054 spent, zero leads, frequency 3.23 — audience completely saturated. Campaign now paused. Reactivate Tummy Tuck / Liposuction campaigns (฿140 CPL was best performer) with fresh creative.',tag:'Asia Cosmetic',btn:'Take Action →'},
            {ico:'r',e:'🚨',ttl:'Faith Diagnostics — Lead Campaigns Blocked · Spend Limit Not Lifted',sub:'Only ₹424 on post engagement boosts. Zero leads. Spend limit preventing all lead ad delivery. Increase account-level spend cap in Meta Business Manager.',tag:'Faith',btn:'Fix in Meta →'},
            {ico:'r',e:'🚨',ttl:'North Intl (New/Hiring) — Zero Spend · Account Fully Blocked',sub:'Zero campaigns returned from API. No spend whatsoever in last 7D. Account appears completely blocked by spend limit. Reset spend cap in Ads Manager to restore delivery.',tag:'North Intl New',btn:'Fix in Meta →'},
          ]
        },
        {
          title:'⚠ Warnings — Action This Week', titleCls:'a', pillCls:'pill-a', pillTxt:'4 Warnings',
          bg:'rgba(217,119,6,0.03)',
          rows:[
            {ico:'a',e:'⚠️',ttl:'Pratha Preschool — Freq 3.27 · Opp Score Dropped to 55 · Urgent Creative Refresh',sub:'Awareness campaign frequency hit 3.27 — audience completely saturated. Opp Score fell to 55. Pause Awareness immediately or refresh creative + expand audience. June CTWA at ₹84 CPR is healthy — keep it.',tag:'Pratha',btn:'Pause/Refresh →'},
            {ico:'a',e:'⚠️',ttl:'PyaraBaby — Stroller Catalogue: ₹9,803 Spent, Only 2 Purchases (CPP ₹4,901)',sub:'Campaign now paused. ₹9.8K burned for 2 purchases. Remarketing Catalogue is far more efficient at ₹486 CPP with 8.53% CTR. Consolidate budget into Remarketing and WABA.',tag:'PyaraBaby',btn:'Reallocate →'},
            {ico:'a',e:'⚠️',ttl:'SSW Mohali — 5 Fragmented Ad Set Groups · Meta Flagging Consolidation',sub:'Multiple ad sets with similar setups reducing Awareness delivery. Indore CTWA CPR ₹199 vs Delhi ₹86 — needs creative review. Meta recommends consolidation for budget efficiency.',tag:'SSW Mohali',btn:'Consolidate →'},
            {ico:'a',e:'⚠️',ttl:'Honda — Chandigarh Frequency at 2.00 · Watch for Fatigue',sub:'Chandigarh campaign frequency reached 2.00. CPL at ₹95 vs Okhla ₹51. If CPL rises or frequency hits 2.5, refresh creative or expand audience. Two ad sets also budget-limited.',tag:'Honda',btn:'Monitor →'},
          ]
        },
        {
          title:'📈 Scale Opportunities', titleCls:'g', pillCls:'pill-g', pillTxt:'3 Opportunities',
          bg:'rgba(125,194,66,0.03)',
          rows:[
            {ico:'g',e:'⭐',ttl:'SSW Delhi — 100 Leads at ₹25 CPL, 4.22% CTR · Best Campaign Across All Accounts',sub:'Delhi panchkarma is the single strongest performing campaign in the entire Meraki portfolio. 100 leads, ₹25 CPL, 4.22% CTR, freq 1.33 — enormous headroom to scale.',tag:'SSW Mohali',lift:'↑ Scale Now',btn:'Increase Budget →'},
            {ico:'g',e:'📈',ttl:'Outlander NZ — Winter Sale · NZ$3.37 CPR · Meta: +77% More Conversions if Scaled',sub:"Launched June 1st. Best CPR (NZ$3.37) and CTR (2.44%) in account. Meta Opportunity Score flags this ad set for scaling — +77% more conversions at +11pts score improvement.",tag:'Outlander NZ',lift:'+77% convos',btn:'Scale Budget →'},
            {ico:'g',e:'📈',ttl:'Honda Okhla — 40 Leads at ₹51 CPL, 1.64% CTR · Consider Budget Increase',sub:'Okhla is consistently the best-performing Honda campaign. ₹51 CPL with 40 leads. Meta has 2 ad sets flagged as budget-limited — ready to spend more if cap is raised.',tag:'Honda',lift:'₹51 CPL',btn:'Scale Budget →'},
          ]
        },
        {
          title:'🎯 Top Meta Recommendations — Cross-Account', titleCls:'b', pillCls:'pill-b', pillTxt:'Live · Meta API',
          bg:'rgba(41,171,226,0.03)',
          rows:[
            {ico:'b',e:'✨',ttl:'Enable A+ Creative Enhancements — Honda (+14pts), PyaraBaby (+4pts), Outlander (+10pts), SSW (+6pts)',sub:'Honda: 11% lower CPR. PyaraBaby: 19% lower CPR. Outlander: 5% lower CPR. SSW: 23% lower CPR. Single action, multi-account impact. Zero cost to enable.',tag:'4 Accounts',lift:'Up to 23% lower CPR',btn:'Apply →'},
            {ico:'b',e:'🔗',ttl:'Connect CRM via Conversions API — Volvo (+6pts), North Intl (+6pts), Honda (+3pts), SSW (+2pts)',sub:'All 4 lead-gen accounts have active CAPI CRM recommendation. Estimated 24% lower CPL across all. North Intl Malta campaign alone worth +6pt score lift.',tag:'4 Accounts',lift:'24% lower CPL',btn:'Setup CAPI →'},
            {ico:'b',e:'🎵',ttl:'Add Auto Music — Volvo (52% lower CPR, +3pts), Outlander (+3pts), North Intl (16% lower, +2pts)',sub:'Free, zero-effort action — Meta adds music automatically. Volvo has the biggest potential lift (52% lower CPR on 3 ads). Enable in 30 seconds per account.',tag:'3 Accounts',lift:'Up to 52% lower CPR',btn:'Enable →'},
            {ico:'b',e:'📱',ttl:'Add 9:16 Reels — Pratha (+43pts!!), SSW (+2pts each on 3 ad sets), North Intl (+1pt)',sub:'Pratha has a massive +43pt score lift available from adding a single 9:16 Reels creative. SSW flagged for 8% lower CPR on 3 ad sets. North Intl 8% lower CPR on 2 campaigns.',tag:'3 Accounts',lift:'Up to +43pts',btn:'Create Reels →'},
          ]
        }
      ].map((panel,pi)=>(
        <div key={pi} className="alerts-panel">
          <div className="ap-hdr" style={{background:panel.bg}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{panel.title}</span>
            <span className={`pill ${panel.pillCls}`}>{panel.pillTxt}</span>
          </div>
          {panel.rows.map((a,i)=>(
            <div key={i} className="alert-row">
              <div className={`ar-ico ${a.ico}`}>{a.e}</div>
              <div className="ar-body"><div className="ar-ttl">{a.ttl}</div><div className="ar-sub">{a.sub}</div></div>
              <span className="ar-tag">{a.tag}</span>
              {a.lift&&<span className="ar-lift">{a.lift}</span>}
              <button className="ar-btn">{a.btn}</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [view,        setView]       = useState('accounts')
  const [filter,      setFilter]     = useState('all')
  const [dateRange,   setDateRange]  = useState('Last 7D')
  const [showCustom,  setShowCustom] = useState(false)
  const [customFrom,  setCustomFrom] = useState('')
  const [customTo,    setCustomTo]   = useState('')
  const [customLabel, setCustomLabel]= useState('')
  const customRef = useRef(null)

  useEffect(()=>{
    function h(e){ if(customRef.current&&!customRef.current.contains(e.target)) setShowCustom(false) }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[])

  const todayStr = new Date().toISOString().split('T')[0]
  function applyCustom(){
    if(!customFrom||!customTo) return
    const fmt=d=>{ const[y,m,dd]=d.split('-'); return dd+'/'+m }
    setCustomLabel(fmt(customFrom)+'–'+fmt(customTo))
    setDateRange('custom'); setShowCustom(false)
  }

  const activeDateLabel = dateRange==='custom' ? customLabel : dateRange
  const dateParams = getDateParams(dateRange, customFrom, customTo)

  const sidebar = [
    {section:'All Clients'},
    {key:'all', dot:'g', name:'All Accounts'},
    {section:'Opp Score · Active', mt:true},
    {key:'volvo',     dot:'g', name:'Volvo',             score:'88', scoreCls:'sc-hi'},
    {key:'north-old', dot:'g', name:'North Intl (Old)',  score:'81', scoreCls:'sc-hi'},
    {key:'pyarababy', dot:'g', name:'PyaraBaby',         score:'80', scoreCls:'sc-hi'},
    {key:'honda',     dot:'g', name:'Courtesy Honda',    score:'71', scoreCls:'sc-md'},
    {key:'ssw',       dot:'a', name:'SSW Mohali',        score:'67', scoreCls:'sc-lo'},
    {key:'outlander', dot:'a', name:'Outlander NZ',      score:'66', scoreCls:'sc-lo'},
    {key:'pratha',    dot:'r', name:'Pratha Preschool',  score:'55', scoreCls:'sc-lo'},
    {section:'Issues', mt:true},
    {key:'faith',     dot:'r', name:'Faith Diagnostics', score:'—',  scoreCls:'sc-na'},
    {key:'asia',      dot:'r', name:'Asia Cosmetic',     score:'—',  scoreCls:'sc-na'},
    {key:'veriseek',  dot:'r', name:'Veriseek AI',       score:'—',  scoreCls:'sc-na'},
    {key:'north-new', dot:'r', name:'North Intl (New)',  score:'—',  scoreCls:'sc-na'},
    {section:'Not Enabled', mt:true},
    {key:'bodyt',     dot:'e', name:'Body Temple',       score:'—',  scoreCls:'sc-na'},
  ]

  const visibleClients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)

  return (
    <>
      <div className="bg-layer">
        <svg className="bl-1" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z"/></svg>
        <svg className="bl-2" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z"/></svg>
        <svg className="bl-3" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0z"/></svg>
        <svg className="bl-4" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z"/></svg>
      </div>
      <div className="wm"><span>merakiads</span></div>

      {/* TOPBAR */}
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
          <span className="pill pill-g">● {CLIENTS.filter(c=>c.status==='ok').length} Active</span>
          <span className="pill pill-r">🔴 {CLIENTS.filter(c=>c.status==='err').length} Issues</span>
          <span className="pill pill-a">⚠ {CLIENTS.filter(c=>c.status==='warn').length} Warning</span>
          <button className="refresh-btn" onClick={()=>{ setDateRange(d=>d); window.location.reload() }}>↻ Refresh</button>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        {sidebar.map((item,i)=>{
          if(item.section) return <div key={i} className="sb-section" style={item.mt?{marginTop:4}:{}}>{item.section}</div>
          return (
            <div key={i} className={`sb-item${filter===item.key?' active':''}`} onClick={()=>setFilter(item.key)}>
              <div className={`sb-dot ${item.dot}`}/>
              <span className="sb-name">{item.name}</span>
              {item.score!==undefined&&<span className={`sb-score ${item.scoreCls}`}>{item.score}</span>}
            </div>
          )
        })}
        <div className="sb-section" style={{marginTop:6}}>Info</div>
        <div className="sb-info">
          📅 {activeDateLabel}<br/>
          🔗 Meta API · <span style={{color:'var(--green-dk)'}}>Connected</span><br/>
          <span style={{color:'var(--red)'}}>🔴 Veriseek: IN_GRACE_PERIOD</span><br/>
          <span style={{color:'var(--red)'}}>🔴 Faith + North New: Blocked</span><br/>
          <span style={{color:'var(--text3)'}}>⚫ 1 not MCP-enabled</span>
        </div>
      </div>

      {/* STATSBAR */}
      <div className="statsbar">
        <div className="kpi-pill kpi-g"><div className="kpi-dot"/><span className="kpi-lbl">Clients</span><span className="kpi-val">{CLIENTS.length}</span></div>
        <div className="kpi-pill kpi-g"><div className="kpi-dot"/><span className="kpi-lbl">Active</span><span className="kpi-val">{CLIENTS.filter(c=>c.status==='ok').length}</span></div>
        <div className="kpi-pill kpi-r"><div className="kpi-dot"/><span className="kpi-lbl">Issues</span><span className="kpi-val">{CLIENTS.filter(c=>c.status==='err').length}</span></div>
        <div className="kpi-pill kpi-a"><div className="kpi-dot"/><span className="kpi-lbl">Warnings</span><span className="kpi-val">{CLIENTS.filter(c=>c.status==='warn').length}</span></div>
        <div className="sb-sep"/>
        <div className="date-grp">
          {['Today','Last 7D','14D','30D','This Month'].map(d=>(
            <button key={d} className={`dr${dateRange===d?' active':''}`}
              onClick={()=>{setDateRange(d);setShowCustom(false)}}>{d}</button>
          ))}
          <div className="custom-range-wrap" ref={customRef}>
            <button className={`dr${dateRange==='custom'?' active':''}`} onClick={()=>setShowCustom(s=>!s)}>
              {dateRange==='custom'?customLabel:'Custom ▾'}
            </button>
            {showCustom&&(
              <div className="custom-picker">
                <div className="custom-picker-row"><label>From</label>
                  <input type="date" max={customTo||todayStr} value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></div>
                <div className="custom-picker-row"><label>To</label>
                  <input type="date" min={customFrom} max={todayStr} value={customTo} onChange={e=>setCustomTo(e.target.value)}/></div>
                <div className="custom-picker-btns">
                  <button className="custom-picker-cancel" onClick={()=>setShowCustom(false)}>Cancel</button>
                  <button className="custom-picker-apply" onClick={applyCustom}>Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-wrap"><div className="main">

        {/* ACCOUNT VIEW */}
        {view==='accounts'&&(
          <div>
            <div className="alerts-strip">
              <div className="al-chip r">🚨 <span className="al-chip-txt"><b>Asia Cosmetic:</b> 0 leads · ฿6,054 spent · Freq 3.23 — audience burnt</span></div>
              <div className="al-chip r">🚨 <span className="al-chip-txt"><b>Veriseek:</b> IN_GRACE_PERIOD — only ₹435 active in 7D (99% collapse)</span></div>
              <div className="al-chip r">🚨 <span className="al-chip-txt"><b>Faith + North New:</b> Spend limit — 0 lead campaigns running</span></div>
              <div className="al-chip a">⚠ <span className="al-chip-txt"><b>Pratha:</b> Awareness freq 3.27 — critical fatigue · Opp Score dropped to 55</span></div>
              <div className="al-chip a">⚠ <span className="al-chip-txt"><b>PyaraBaby:</b> Stroller CPP ₹4,901 — ₹9.8K wasted on 2 purchases</span></div>
            </div>
            <div className="sec-hdr">
              <div className="sec-ttl">Client Accounts <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span></div>
              <span style={{fontSize:11,color:'var(--text3)'}}>{visibleClients.length} accounts</span>
            </div>
            <div className="accounts" id="acc-list">
              {CLIENTS.map(c=>(
                <AccCard
                  key={c.key+JSON.stringify(dateParams)}
                  client={c}
                  dateParams={dateParams}
                  activeDateLabel={activeDateLabel}
                  isVisible={filter==='all'||filter===c.key}
                />
              ))}
            </div>
          </div>
        )}

        {/* CAMPAIGNS TABLE */}
        {view==='campaigns'&&(
          <CampaignsView filter={filter} dateParams={dateParams} activeDateLabel={activeDateLabel}/>
        )}

        {/* ALERTS */}
        {view==='alerts'&&<AlertsView/>}

      </div></div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
