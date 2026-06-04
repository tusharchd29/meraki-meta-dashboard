'use client'
import { useState, useEffect, useRef } from 'react'

const CLIENTS = [
  { key:'volvo',      name:'Volvo (Krishna — Meraki Ads)',         accountId:'833603637085666',  currency:'INR', vertical:'Automotive',   status:'ok',   dot:'g', score:88 },
  { key:'north-old',  name:'North International (Old Account)',    accountId:'1297775434831152', currency:'INR', vertical:'Education',    status:'ok',   dot:'g', score:81 },
  { key:'pyarababy',  name:'PyaraBaby',                            accountId:'254564808465114',  currency:'INR', vertical:'Ecommerce',    status:'ok',   dot:'g', score:80 },
  { key:'honda',      name:'Courtesy Honda',                       accountId:'787341982723949',  currency:'INR', vertical:'Automotive',   status:'ok',   dot:'g', score:71 },
  { key:'ssw',        name:'Sri Sri Well Being (SSW Mohali)',      accountId:'1999892177251081', currency:'INR', vertical:'Wellness',     status:'ok',   dot:'g', score:67 },
  { key:'outlander',  name:'Outlander 4×4 New Zealand',            accountId:'1318511879920658', currency:'NZD', vertical:'Auto/Services',status:'ok',   dot:'g', score:66 },
  { key:'pratha',     name:'Pratha Preschool',                     accountId:'1851775342206755', currency:'INR', vertical:'Education',    status:'warn', dot:'a', score:55 },
  { key:'asia',       name:'Asia Cosmetic Hospital',               accountId:'1444189929969376', currency:'THB', vertical:'Healthcare',   status:'err',  dot:'r', score:null },
  { key:'veriseek',   name:'Veriseek AI',                          accountId:'3252000788333236', currency:'INR', vertical:'EdTech',       status:'err',  dot:'r', score:null },
  { key:'faith',      name:'Faith Diagnostics',                    accountId:'330235162',        currency:'INR', vertical:'Healthcare',   status:'err',  dot:'r', score:null },
  { key:'north-new',  name:'North International (New — Hiring)',   accountId:'1418599015829087', currency:'INR', vertical:'Education',    status:'err',  dot:'r', score:null },
  { key:'bodyt',      name:'Body Temple',                          accountId:'2001372527419414', currency:'INR', vertical:'Health/Fitness',status:'off',  dot:'e', score:null },
]

const TOKEN = 'EAAZBpEehq4PMBRmHs3Sxb1nUs3hlDaT9gnV98n5Vhi3iZBGRRvC5DR2CSNESBFthGqtjhUCwqL2fRHh1ZBZAinoGEP3CLz2OBFaFTpZAZB2SBkC8lAWr0pOYypkVx1HuF0LjOsXn8awJtsyY5f4vKRp5ffoz94ipHoieTSTkevVUGqPJBoivGaPEi9ES49oOwjuvLaLnSxwZCnR82MNFoeHGoqkZBhU2L7DENaeYjgZDZD'
const INSIGHT_FIELDS = 'spend,impressions,clicks,ctr,cpm,reach,frequency,actions,video_thruplay_watched_actions,cost_per_action_type,action_values'

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
function parseResults(ins, currency) {
  if(!ins) return {text:'—', cls:'', count:0}
  const s = SYM(currency)
  const spend = parseFloat(ins.spend||0)
  const actions = ins.actions||[]
  // Priority order for result type
  const LEAD_TYPES   = ['lead','onsite_conversion.lead_grouped','contact_total','onsite_conversion.messaging_conversation_started_7d']
  const PURCH_TYPES  = ['purchase','omni_purchase','onsite_web_purchase']
  const CONV_TYPES   = ['onsite_conversion.messaging_first_reply','onsite_conversion.messaging_conversation_started_7d']
  const TRAFFIC_TYPES= ['link_click','landing_page_view']

  for(const types of [PURCH_TYPES,LEAD_TYPES,CONV_TYPES,TRAFFIC_TYPES]) {
    for(const t of types) {
      const a = actions.find(x=>x.action_type===t)
      if(a&&parseInt(a.value)>0) {
        const cnt = parseInt(a.value)
        const cpa = cnt>0&&spend>0 ? Math.round(spend/cnt) : null
        const lbl = types===PURCH_TYPES?'Purchases':types===LEAD_TYPES?'Leads':types===CONV_TYPES?'Convos':'Clicks'
        const cpaStr = cpa ? ` · ${lbl==='Clicks'?'CPC':lbl==='Purchases'?'CPP':'CPL'} ${s}${cpa}` : ''
        return {text:`${cnt} ${lbl}${cpaStr}`, cls:'green', count:cnt}
      }
    }
  }
  // ThruPlays
  const tp = ins.video_thruplay_watched_actions?.[0]
  if(tp&&parseInt(tp.value)>0) {
    const cnt=parseInt(tp.value)
    const ctp=spend>0&&cnt>0?(spend/cnt)<1?(spend/cnt).toFixed(3):Math.round(spend/cnt):null
    return {text:`${fmtNum(cnt)} ThruPlays${ctp?' · ₹'+ctp:''}`, cls:'green', count:cnt}
  }
  // Reach fallback
  if(ins.reach&&parseInt(ins.reach)>0) return {text:`Reach ${fmtNum(ins.reach)}`, cls:'', count:0}
  if(spend>0) return {text:'Spend only', cls:'', count:0}
  return {text:'—', cls:'', count:0}
}

async function apiFetch(endpoint, params={}) {
  const qs = new URLSearchParams({endpoint, token:TOKEN})
  // Add params individually to preserve encoding
  Object.entries(params).forEach(([k,v]) => qs.set(k, v))
  const r = await fetch(`/api/meta?${qs.toString()}`)
  return r.json()
}

function Spinner({size=14}) {
  return <div style={{width:size,height:size,border:'2px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccCard({client, dateParams, activeDateLabel, isVisible}) {
  const [open,       setOpen]  = useState(false)
  const [ins,        setIns]   = useState(undefined) // undefined=loading, null=empty, obj=data
  const [camps,      setCamps] = useState([])
  const [campLoad,   setCampL] = useState(false)
  const dpKey = JSON.stringify(dateParams)

  // Account-level insights
  useEffect(()=>{
    setIns(undefined)
    apiFetch(`act_${client.accountId}/insights`,{fields:INSIGHT_FIELDS, ...dateParams})
      .then(d=>{
        if(d.error) setIns({_err:d.error.message||d.error.type||'API Error'})
        else        setIns(d.data?.[0]||null)
      })
      .catch(e=>setIns({_err:e.message}))
  },[client.accountId, dpKey])

  // Campaign list + insights (when card opens)
  useEffect(()=>{
    if(!open) return
    setCampL(true); setCamps([])
    apiFetch(`act_${client.accountId}/campaigns`,{
      fields:'id,name,objective,status,effective_status,daily_budget,lifetime_budget',
      limit:'30'
    }).then(async d=>{
      if(d.error||!d.data?.length){ setCampL(false); return }
      // Fetch insights for each campaign individually in parallel
      const merged = await Promise.all(d.data.map(async c=>{
        try {
          const ci = await apiFetch(`${c.id}/insights`,{
            fields: INSIGHT_FIELDS,
            ...dateParams
          })
          return {...c, ins: ci.data?.[0] || null}
        } catch(e) {
          return {...c, ins: null}
        }
      }))
      merged.sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      setCamps(merged)
      setCampL(false)
    }).catch(()=>setCampL(false))
  },[open, client.accountId, dpKey])

  if(!isVisible) return null

  const S    = SYM(client.currency)
  const spend= parseFloat(ins?.spend||0)
  const impr = parseInt(ins?.impressions||0)
  const ctr  = parseFloat(ins?.ctr||0)
  const freq = parseFloat(ins?.frequency||0)
  const cpm  = parseFloat(ins?.cpm||0)
  const reach= parseInt(ins?.reach||0)
  const clicks=parseInt(ins?.clicks||0)
  const res  = ins && !ins._err ? parseResults(ins, client.currency) : {text:'—',cls:'',count:0}

  const scoreColor = !client.score?'var(--text3)':client.score>=75?'var(--green)':client.score>=60?'var(--amber)':'var(--red)'
  const badgeCls   = client.status==='ok'?'sb-live':client.status==='warn'?'sb-warn':client.status==='err'?'sb-err':'sb-off'
  const badgeTxt   = client.status==='ok'?'LIVE':client.status==='warn'?'FREQ CRITICAL':client.status==='err'?'ISSUE':'NOT ENABLED'

  return (
    <div className={`acc-card ${client.status}${open?' open':''}`} data-client={client.key}>
      <div className="acc-hdr" onClick={()=>setOpen(o=>!o)}>
        <div className="acc-exp">›</div>
        <div className={`acc-sdot ${client.dot}`}/>
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
          ) : ins===null ? (
            <div className="kc"><div className="kc-lbl">Spend</div><div className="kc-val n">No data</div></div>
          ) : (
            <>
              <div className="kc">
                <div className="kc-lbl">Spend</div>
                <div className={`kc-val ${spend>0?'n':'r'}`}>{fmtSpend(spend,S)}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">Impressions</div>
                <div className="kc-val n">{fmtNum(impr)}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">Clicks</div>
                <div className="kc-val n">{fmtNum(clicks)}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">CTR</div>
                <div className={`kc-val ${ctr>=1.5?'g':ctr>0&&ctr<0.8?'r':'n'}`}>{ctr>0?ctr.toFixed(2)+'%':'—'}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">CPM</div>
                <div className="kc-val n">{cpm>0?S+cpm.toFixed(0):'—'}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">Reach</div>
                <div className="kc-val n">{reach>0?fmtNum(reach):'—'}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">Freq</div>
                <div className={`kc-val ${freq>=2.5?'r':freq>=2?'a':'n'}`}>{freq>0?freq.toFixed(2):'—'}</div>
              </div>
              <div className="kc">
                <div className="kc-lbl">Results</div>
                <div className={`kc-val ${res.cls==='green'?'g':res.cls==='red'?'r':'n'}`}
                  style={{fontSize:10,maxWidth:100,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {res.text}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="acc-right">
          <div className="acc-badges">
            <span className={`s-badge ${badgeCls}`}>{badgeTxt}</span>
            {freq>=2.5&&<span className="chip-r">Freq {freq.toFixed(2)}</span>}
            {freq>=2&&freq<2.5&&<span className="chip-a">Freq {freq.toFixed(2)}</span>}
            {ins!==undefined&&ins!==null&&!ins._err&&spend===0&&<span className="chip-r">No Spend</span>}
          </div>
          {client.score!==null&&(
            <div className="opp-score">
              <span className="opp-lbl">Score</span>
              <div className="opp-bar"><div className="opp-fill" style={{width:`${client.score}%`,background:scoreColor}}/></div>
              <span className="opp-num" style={{color:scoreColor}}>{client.score}</span>
            </div>
          )}
        </div>
      </div>

      <div className="acc-body">
        {client.key==='bodyt'&&<div className="no-data-box">MCP rollout pending. Monitor via Meta Ads Manager directly.</div>}

        {campLoad&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px',color:'var(--text3)',fontSize:12}}>
            <Spinner size={14}/>Fetching campaigns from Meta API…
          </div>
        )}

        {!campLoad&&camps.length===0&&open&&client.key!=='bodyt'&&(
          <div className="no-data-box">No campaigns found for this period.</div>
        )}

        {!campLoad&&camps.length>0&&(
          <table className="camp-tbl">
            <thead>
              <tr><th>Campaign</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr>
            </thead>
            <tbody>
              {camps.map((c,i)=>{
                const ci   = c.ins
                const cs   = campStatusInfo(c)
                const cSpend = parseFloat(ci?.spend||0)
                const cCtr   = parseFloat(ci?.ctr||0)
                const cFreq  = parseFloat(ci?.frequency||0)
                const cRes   = parseResults(ci, client.currency)
                const CC     = {green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)',blue:'var(--blue-dk)'}
                return (
                  <tr key={c.id||i}>
                    <td><b>{c.name}</b></td>
                    <td><span className={`obj-b ${objCls(c.objective)}`}>{objLabel(c.objective)}</span></td>
                    <td style={{fontFamily:'JetBrains Mono',fontSize:11}}>{ci?fmtSpend(cSpend,SYM(client.currency)):'—'}</td>
                    <td style={{color:CC[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                    <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>
                      {cCtr>0?cCtr.toFixed(2)+'%':'—'}
                    </td>
                    <td style={cFreq>=2.5?{color:'var(--red)',fontWeight:600}:cFreq>=2?{color:'var(--amber)'}:{}}>
                      {cFreq>0?cFreq.toFixed(2):'—'}
                    </td>
                    <td><div className="st-ind"><div className={`st-dot ${cs.dot}`}/>{cs.label}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {ins&&!ins._err&&ins!==null&&!campLoad&&(
          <div className="insight-row">
            <div className="insight-box ib-trend">
              <div className="ib-ttl">📡 Live — {activeDateLabel}</div>
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
                <div className="ib-ttl">🚨 No Spend This Period</div>
                <div className="ib-item">Zero spend in {activeDateLabel}. Check account status, billing, or spend limits in Meta Business Manager.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── All Campaigns cross-account table ─────────────────────────────────────────
function CampaignsView({filter, dateParams, activeDateLabel}) {
  const [rows, setRows]   = useState([])
  const [loading, setLoad]= useState(false)
  const dpKey = JSON.stringify(dateParams)

  useEffect(()=>{
    setLoad(true); setRows([])
    const clients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)
    Promise.all(clients.map(async cl=>{
      try {
        // Get campaigns
        const cd = await apiFetch(`act_${cl.accountId}/campaigns`,{
          fields:'id,name,objective,status,effective_status', limit:'30'
        })
        if(!cd.data?.length) return []
        // Fetch insights per campaign individually
        const withIns = await Promise.all(cd.data.map(async c=>{
          try {
            const ci = await apiFetch(`${c.id}/insights`,{fields:INSIGHT_FIELDS,...dateParams})
            return {campName:c.name, accName:cl.name, obj:c.objective,
              ins:ci.data?.[0]||null, status:campStatusInfo(c),
              currency:cl.currency, S:SYM(cl.currency)}
          } catch {
            return {campName:c.name, accName:cl.name, obj:c.objective,
              ins:null, status:campStatusInfo(c), currency:cl.currency, S:SYM(cl.currency)}
          }
        }))
        return withIns
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
        <div className="sec-ttl">All Campaigns <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <span style={{fontSize:11,color:'var(--text3)'}}>{rows.length} campaigns</span>
      </div>
      {loading&&<div style={{textAlign:'center',padding:40,color:'var(--text3)',fontSize:12}}><div style={{width:26,height:26,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 10px'}}/> Fetching all campaigns…</div>}
      {!loading&&rows.length>0&&(
        <div className="tbl-wrap">
          <table className="all-camp-tbl">
            <thead><tr><th>Campaign</th><th>Account</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const cS  =parseFloat(r.ins?.spend||0)
                const cCtr=parseFloat(r.ins?.ctr||0)
                const cFr =parseFloat(r.ins?.frequency||0)
                const cRes=parseResults(r.ins,r.currency)
                return (
                  <tr key={i}>
                    <td><b>{r.campName}</b></td>
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
      {!loading&&rows.length===0&&<div className="no-data-box">No campaign data for this period.</div>}
    </div>
  )
}

// ── Live Alerts View ─────────────────────────────────────────────────────────
function AlertsView({ dateParams, activeDateLabel }) {
  const [data,    setData]    = useState(null)   // { rejected, billing, adsets, performance }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)

    async function fetchAll() {
      const results = {
        rejected: [],    // disapproved ads per account
        billing:  [],    // account billing/status issues
        highFreq: [],    // high frequency adsets
        noSpend:  [],    // zero spend accounts
        topPerf:  [],    // best performing campaigns
        worstPerf:[],    // worst performing / high CPL
      }

      await Promise.all(CLIENTS.map(async cl => {
        const S = SYM(cl.currency)
        try {
          // 1. Account info — billing status, balance, account_status
          const accInfo = await apiFetch(`act_${cl.accountId}`, {
            fields: 'name,account_status,disable_reason,amount_spent,balance,currency,spend_cap,adtrust_dsl,funding_source_details'
          })

          // Account status issues
          const statusMap = {1:'Active',2:'Disabled',3:'Unsettled',7:'Pending Review',9:'Grace Period',100:'Pending Closure',101:'Closed',201:'Closed'}
          if (accInfo.account_status && accInfo.account_status !== 1) {
            results.billing.push({
              client: cl.name,
              key: cl.key,
              type: 'status',
              status: statusMap[accInfo.account_status] || `Status ${accInfo.account_status}`,
              detail: accInfo.disable_reason ? `Disable reason: ${accInfo.disable_reason}` : `Account not active — fix in Meta Business Manager`,
              severity: accInfo.account_status === 9 ? 'r' : 'a'
            })
          }

          // Balance / funding issues
          const balance = parseFloat(accInfo.balance || 0)
          if (balance !== undefined && balance < 100 && accInfo.account_status === 1) {
            results.billing.push({
              client: cl.name, key: cl.key, type: 'balance',
              status: 'Low Balance',
              detail: `Balance: ${S}${balance.toFixed(0)} — top up to avoid delivery interruption`,
              severity: balance < 10 ? 'r' : 'a'
            })
          }

          // Spend cap check
          if (accInfo.spend_cap && parseFloat(accInfo.spend_cap) > 0) {
            const spent = parseFloat(accInfo.amount_spent || 0) / 100
            const cap   = parseFloat(accInfo.spend_cap) / 100
            const pct   = cap > 0 ? (spent / cap) * 100 : 0
            if (pct >= 85) {
              results.billing.push({
                client: cl.name, key: cl.key, type: 'spend_cap',
                status: `Spend Cap ${pct.toFixed(0)}% Used`,
                detail: `${S}${fmtSpend(spent,'').replace(S,'')} spent of ${S}${fmtSpend(cap,'').replace(S,'')} cap — increase cap or campaigns will stop`,
                severity: pct >= 95 ? 'r' : 'a'
              })
            }
          }

          // 2. Rejected / disapproved ads
          const adsData = await apiFetch(`act_${cl.accountId}/ads`, {
            fields: 'name,effective_status,adset_id,campaign_id,ad_review_feedback',
            filtering: JSON.stringify([{field:'effective_status',operator:'IN',value:['DISAPPROVED','WITH_ISSUES']}]),
            limit: '10'
          })
          ;(adsData.data || []).forEach(ad => {
            const feedback = ad.ad_review_feedback
            let reason = 'Policy violation or creative issue'
            if (feedback) {
              const reasons = Object.values(feedback).flat()
              if (reasons.length) reason = reasons.slice(0,2).join(' · ')
            }
            results.rejected.push({
              client: cl.name, key: cl.key,
              adName: ad.name,
              status: ad.effective_status,
              reason,
              severity: 'r'
            })
          })

          // 3. Account insights — zero spend, high freq adsets
          const insData = await apiFetch(`act_${cl.accountId}/insights`, {
            fields: 'spend,frequency,impressions,actions,ctr',
            level: 'adset',
            limit: '30',
            ...dateParams
          })
          const adsetRows = insData.data || []

          // Zero spend at account level
          const totalSpend = adsetRows.reduce((s,r) => s + parseFloat(r.spend||0), 0)
          if (totalSpend === 0 && cl.status !== 'off') {
            results.noSpend.push({ client: cl.name, key: cl.key, currency: cl.currency })
          }

          // High frequency adsets
          adsetRows.forEach(row => {
            const freq = parseFloat(row.frequency || 0)
            if (freq >= 2.5) {
              results.highFreq.push({
                client: cl.name, key: cl.key,
                freq: freq.toFixed(2),
                spend: fmtSpend(parseFloat(row.spend||0), S),
                severity: freq >= 3 ? 'r' : 'a'
              })
            }
          })

          // 4. Campaign performance — top & worst
          const campIns = await apiFetch(`act_${cl.accountId}/insights`, {
            fields: 'campaign_name,spend,actions,ctr,cpm,frequency',
            level: 'campaign',
            limit: '10',
            ...dateParams
          })
          ;(campIns.data || []).forEach(row => {
            const spend = parseFloat(row.spend || 0)
            if (spend < 10) return
            const res = parseResults(row, cl.currency)
            if (res.count > 0 && spend > 0) {
              const cpa = Math.round(spend / res.count)
              results.topPerf.push({
                client: cl.name, key: cl.key,
                campName: row.campaign_name,
                spend: fmtSpend(spend, S),
                result: res.text,
                ctr: parseFloat(row.ctr||0).toFixed(2) + '%',
                cpa, S
              })
            }
          })

        } catch(e) {
          // skip this account on error
        }
      }))

      // Sort top performers by lowest CPA
      results.topPerf.sort((a,b) => a.cpa - b.cpa)

      setData(results)
      setLoading(false)
    }

    fetchAll()
  }, [JSON.stringify(dateParams)])

  const totalIssues = data ? (data.rejected.length + data.billing.length + data.noSpend.length) : 0
  const totalWarnings = data ? data.highFreq.length : 0

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">
          Alerts &amp; Recommendations
          <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span>
        </div>
        {data && (
          <div style={{display:'flex',gap:6}}>
            {totalIssues > 0 && <span className="pill pill-r">🚨 {totalIssues} Critical</span>}
            {totalWarnings > 0 && <span className="pill pill-a">⚠ {totalWarnings} Warnings</span>}
            {totalIssues === 0 && totalWarnings === 0 && <span className="pill pill-g">✓ All Clear</span>}
          </div>
        )}
      </div>

      {loading && (
        <div style={{textAlign:'center',padding:50,color:'var(--text3)'}}>
          <div style={{width:28,height:28,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/>
          <div style={{fontSize:12}}>Checking all accounts for issues…<br/><span style={{fontSize:11,opacity:.7}}>Fetching ad status, billing, performance data</span></div>
        </div>
      )}

      {data && (
        <>
          {/* ── Rejected / Disapproved Ads ── */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🚫 Rejected / Disapproved Ads</span>
              <span className={`pill ${data.rejected.length > 0 ? 'pill-r' : 'pill-g'}`}>
                {data.rejected.length > 0 ? `${data.rejected.length} Rejected` : '✓ None'}
              </span>
            </div>
            {data.rejected.length === 0 && (
              <div className="alert-row">
                <div className="ar-ico g">✓</div>
                <div className="ar-body"><div className="ar-ttl">No disapproved or rejected ads</div><div className="ar-sub">All ads across all accounts are approved and running.</div></div>
              </div>
            )}
            {data.rejected.map((a,i) => (
              <div key={i} className="alert-row">
                <div className="ar-ico r">🚫</div>
                <div className="ar-body">
                  <div className="ar-ttl">{a.client} — Ad Rejected: "{a.adName}"</div>
                  <div className="ar-sub">Status: <b>{a.status}</b> · Reason: {a.reason}</div>
                </div>
                <span className="ar-tag">{a.client}</span>
                <span className="ar-lift" style={{background:'var(--red-lt)',color:'var(--red)',borderColor:'var(--red-bd)'}}>Fix Required</span>
                <button className="ar-btn">Review Ad →</button>
              </div>
            ))}
          </div>

          {/* ── Billing / Account Status Issues ── */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>💳 Billing &amp; Account Status</span>
              <span className={`pill ${data.billing.length > 0 ? 'pill-r' : 'pill-g'}`}>
                {data.billing.length > 0 ? `${data.billing.length} Issues` : '✓ All Healthy'}
              </span>
            </div>
            {data.billing.length === 0 && (
              <div className="alert-row">
                <div className="ar-ico g">✓</div>
                <div className="ar-body"><div className="ar-ttl">No billing or account status issues</div><div className="ar-sub">All accounts are active with no payment errors detected.</div></div>
              </div>
            )}
            {data.billing.map((a,i) => (
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.severity}`}>{a.severity==='r'?'🚨':'⚠️'}</div>
                <div className="ar-body">
                  <div className="ar-ttl">{a.client} — {a.status}</div>
                  <div className="ar-sub">{a.detail}</div>
                </div>
                <span className="ar-tag">{a.client}</span>
                <button className="ar-btn">Fix in Meta →</button>
              </div>
            ))}
          </div>

          {/* ── Zero Spend Accounts ── */}
          {data.noSpend.length > 0 && (
            <div className="alerts-panel">
              <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
                <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>💸 Zero Spend — {activeDateLabel}</span>
                <span className="pill pill-r">{data.noSpend.length} Accounts</span>
              </div>
              {data.noSpend.map((a,i) => (
                <div key={i} className="alert-row">
                  <div className="ar-ico r">💸</div>
                  <div className="ar-body">
                    <div className="ar-ttl">{a.client} — No spend in {activeDateLabel}</div>
                    <div className="ar-sub">Zero ad delivery this period. Check if campaigns are active, spend limits are set, or billing needs attention.</div>
                  </div>
                  <span className="ar-tag">{a.client}</span>
                  <button className="ar-btn">Check Campaigns →</button>
                </div>
              ))}
            </div>
          )}

          {/* ── High Frequency Warnings ── */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{background:'rgba(217,119,6,0.03)'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🔁 High Frequency — Audience Fatigue Risk</span>
              <span className={`pill ${data.highFreq.length > 0 ? 'pill-a' : 'pill-g'}`}>
                {data.highFreq.length > 0 ? `${data.highFreq.length} Ad Sets` : '✓ All Good'}
              </span>
            </div>
            {data.highFreq.length === 0 && (
              <div className="alert-row">
                <div className="ar-ico g">✓</div>
                <div className="ar-body"><div className="ar-ttl">No high-frequency ad sets detected</div><div className="ar-sub">All ad sets are below the 2.5 frequency threshold for this period.</div></div>
              </div>
            )}
            {data.highFreq.map((a,i) => (
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.severity}`}>{a.severity==='r'?'🚨':'⚠️'}</div>
                <div className="ar-body">
                  <div className="ar-ttl">{a.client} — Frequency {a.freq} {parseFloat(a.freq)>=3?'· Audience Burnt':' · Fatigue Risk'}</div>
                  <div className="ar-sub">Spend {a.spend} this period at freq {a.freq}. {parseFloat(a.freq)>=3?'Pause and refresh creative immediately — audience fully saturated.':'Consider refreshing creative or expanding audience targeting.'}</div>
                </div>
                <span className="ar-tag">{a.client}</span>
                <span className={`${a.severity==='r'?'chip-r':'chip-a'}`}>Freq {a.freq}</span>
                <button className="ar-btn">Refresh Creative →</button>
              </div>
            ))}
          </div>

          {/* ── Top Performing Campaigns ── */}
          {data.topPerf.length > 0 && (
            <div className="alerts-panel">
              <div className="ap-hdr" style={{background:'rgba(125,194,66,0.03)'}}>
                <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>📈 Top Performing Campaigns — {activeDateLabel}</span>
                <span className="pill pill-g">{data.topPerf.length} Campaigns</span>
              </div>
              {data.topPerf.slice(0,8).map((a,i) => (
                <div key={i} className="alert-row">
                  <div className="ar-ico g">{i===0?'⭐':'📈'}</div>
                  <div className="ar-body">
                    <div className="ar-ttl">{a.client} — {a.campName}</div>
                    <div className="ar-sub">Spend: <b>{a.spend}</b> · Results: <b>{a.result}</b> · CTR: <b>{a.ctr}</b></div>
                  </div>
                  <span className="ar-tag">{a.client}</span>
                  <span className="ar-lift">{a.S}{a.cpa} CPA</span>
                  <button className="ar-btn">Scale →</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [view,        setView]      = useState('accounts')
  const [filter,      setFilter]    = useState('all')
  const [dateRange,   setDateRange] = useState('Last 7D')
  const [showCustom,  setShowCustom]= useState(false)
  const [customFrom,  setCustomFrom]= useState('')
  const [customTo,    setCustomTo]  = useState('')
  const [customLabel, setCustLbl]   = useState('')
  const customRef = useRef(null)

  useEffect(()=>{
    const h=e=>{ if(customRef.current&&!customRef.current.contains(e.target)) setShowCustom(false) }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[])

  const todayStr = new Date().toISOString().split('T')[0]
  function applyCustom(){
    if(!customFrom||!customTo) return
    const fmt=d=>{ const[,m,dd]=d.split('-'); return `${dd}/${m}` }
    setCustLbl(`${fmt(customFrom)}–${fmt(customTo)}`)
    setDateRange('custom'); setShowCustom(false)
  }

  const activeDateLabel = dateRange==='custom'?customLabel:dateRange
  const dateParams      = getDateParams(dateRange, customFrom, customTo)

  const sidebar = [
    {section:'All Clients'},
    {key:'all',     dot:'g', name:'All Accounts'},
    {section:'Opp Score · Active', mt:true},
    {key:'volvo',     dot:'g', name:'Volvo',            score:'88', scoreCls:'sc-hi'},
    {key:'north-old', dot:'g', name:'North Intl (Old)', score:'81', scoreCls:'sc-hi'},
    {key:'pyarababy', dot:'g', name:'PyaraBaby',        score:'80', scoreCls:'sc-hi'},
    {key:'honda',     dot:'g', name:'Courtesy Honda',   score:'71', scoreCls:'sc-md'},
    {key:'ssw',       dot:'a', name:'SSW Mohali',       score:'67', scoreCls:'sc-lo'},
    {key:'outlander', dot:'a', name:'Outlander NZ',     score:'66', scoreCls:'sc-lo'},
    {key:'pratha',    dot:'r', name:'Pratha Preschool', score:'55', scoreCls:'sc-lo'},
    {section:'Issues', mt:true},
    {key:'faith',     dot:'r', name:'Faith Diagnostics',score:'—',  scoreCls:'sc-na'},
    {key:'asia',      dot:'r', name:'Asia Cosmetic',    score:'—',  scoreCls:'sc-na'},
    {key:'veriseek',  dot:'r', name:'Veriseek AI',      score:'—',  scoreCls:'sc-na'},
    {key:'north-new', dot:'r', name:'North Intl (New)', score:'—',  scoreCls:'sc-na'},
    {section:'Not Enabled', mt:true},
    {key:'bodyt',     dot:'e', name:'Body Temple',      score:'—',  scoreCls:'sc-na'},
  ]

  const visibleClients = filter==='all'?CLIENTS:CLIENTS.filter(c=>c.key===filter)

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
          <span className="pill pill-g">● {CLIENTS.filter(c=>c.status==='ok').length} Active</span>
          <span className="pill pill-r">🔴 {CLIENTS.filter(c=>c.status==='err').length} Issues</span>
          <span className="pill pill-a">⚠ {CLIENTS.filter(c=>c.status==='warn').length} Warning</span>
          <button className="refresh-btn" onClick={()=>window.location.reload()}>↻ Refresh</button>
        </div>
      </div>

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

      <div className="main-wrap"><div className="main">
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
            <div className="accounts">
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
        {view==='campaigns'&&<CampaignsView filter={filter} dateParams={dateParams} activeDateLabel={activeDateLabel}/>}
        {view==='alerts'&&<AlertsView dateParams={dateParams} activeDateLabel={activeDateLabel}/>}
      </div></div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
