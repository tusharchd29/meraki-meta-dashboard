'use client'
import { useState, useEffect } from 'react'

const PASSWORD = 'meraki2026'
const TOKEN_EXPIRY = new Date('2026-08-04')

// ── Password Gate ─────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const attempt = () => {
    if (input === PASSWORD) { if(typeof window !== 'undefined') sessionStorage.setItem('ma_auth','1'); onUnlock() }
    else { setError(true); setShake(true); setTimeout(()=>setShake(false),500); setTimeout(()=>setError(false),2000); setInput('') }
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8faf6',fontFamily:'Inter,sans-serif'}}>
      <div style={{textAlign:'center',animation:shake?'shake 0.4s ease':'none'}}>
        <div style={{fontSize:26,fontWeight:800,marginBottom:4}}><span style={{color:'#7DC242'}}>meraki</span><span style={{color:'#29ABE2'}}>ads</span></div>
        <div style={{fontSize:12,color:'#888',marginBottom:28,letterSpacing:1}}>META INTELLIGENCE · LIVE</div>
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:14,padding:'28px 32px',boxShadow:'0 4px 24px rgba(0,0,0,0.06)',minWidth:300}}>
          <div style={{fontSize:13,fontWeight:600,color:'#333',marginBottom:14}}>Enter Password</div>
          <input type='password' value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&attempt()} autoFocus placeholder='••••••••••'
            style={{width:'100%',padding:'10px 14px',borderRadius:8,border:error?'1.5px solid #e05252':'1.5px solid #d1d5db',fontSize:15,outline:'none',boxSizing:'border-box',textAlign:'center',letterSpacing:4,background:error?'#fff5f5':'#fff',transition:'border 0.2s'}}/>
          {error&&<div style={{fontSize:11,color:'#e05252',marginTop:8}}>Incorrect password.</div>}
          <button onClick={attempt} style={{marginTop:14,width:'100%',padding:'10px',background:'#7DC242',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Unlock Dashboard</button>
        </div>
        <div style={{fontSize:10,color:'#bbb',marginTop:16}}>Meraki Ads Internal · Restricted Access</div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

// ── Clients ───────────────────────────────────────────────────────────────────
const CLIENTS = [
  { key:'volvo',      name:'Volvo (Krishna — Meraki Ads)',         accountId:'833603637085666',  currency:'INR', vertical:'Automotive'    },
  { key:'north-old',  name:'North International (Old)',            accountId:'1297775434831152', currency:'INR', vertical:'Education'     },
  { key:'pyarababy',  name:'PyaraBaby',                            accountId:'254564808465114',  currency:'INR', vertical:'Ecommerce'     },
  { key:'honda',      name:'Courtesy Honda',                       accountId:'787341982723949',  currency:'INR', vertical:'Automotive'    },
  { key:'ssw',        name:'Sri Sri Well Being (SSW Mohali)',      accountId:'1999892177251081', currency:'INR', vertical:'Wellness'      },
  { key:'outlander',  name:'Outlander 4×4 New Zealand',            accountId:'1318511879920658', currency:'NZD', vertical:'Auto/Services' },
  { key:'pratha',     name:'Pratha Preschool',                     accountId:'1851775342206755', currency:'INR', vertical:'Education'     },
  { key:'asia',       name:'Asia Cosmetic Hospital',               accountId:'1444189929969376', currency:'THB', vertical:'Healthcare'    },
  { key:'veriseek',   name:'Veriseek AI',                          accountId:'3252000788333236', currency:'INR', vertical:'EdTech'        },
  { key:'faith',      name:'Faith Diagnostics',                    accountId:'330235162',        currency:'INR', vertical:'Healthcare'    },
  { key:'north-new',  name:'North International (New — Hiring)',   accountId:'1418599015829087', currency:'INR', vertical:'Education'     },
  { key:'bodyt',      name:'Body Temple',                          accountId:'9141434999257273', currency:'INR', vertical:'Health/Fitness' },
]

const INSIGHT_FIELDS = 'spend,impressions,clicks,ctr,cpm,reach,frequency,actions,video_thruplay_watched_actions'

// ── Helpers ───────────────────────────────────────────────────────────────────
const SYM = c => c==='THB'?'฿':c==='NZD'?'NZ$':'₹'
const fmtSpend = (n,s='₹') => { const v=parseFloat(n||0); if(!v) return s+'0'; return s+v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) }
const fmtNum = n => { const v=parseFloat(n||0); if(!v) return '0'; if(v>=1000000) return (v/1000000).toFixed(1)+'M'; if(v>=1000) return (v/1000).toFixed(1)+'K'; return Math.round(v).toString() }
const fmtDate = iso => { if(!iso) return '—'; return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}) }
const fmtBudget = (c, S) => {
  if (c.daily_budget && parseFloat(c.daily_budget)>0) return { label: S+Math.round(parseFloat(c.daily_budget)/100).toLocaleString('en-IN'), type:'Daily' }
  if (c.lifetime_budget && parseFloat(c.lifetime_budget)>0) return { label: S+Math.round(parseFloat(c.lifetime_budget)/100).toLocaleString('en-IN'), type:'Lifetime' }
  return { label:'—', type:'' }
}

function getDateParams(preset,cfrom,cto) {
  if(preset==='Today') return{date_preset:'today'}
  if(preset==='Yesterday') return{date_preset:'yesterday'}
  if(preset==='Last 7D') return{date_preset:'last_7d'}
  if(preset==='14D') return{date_preset:'last_14d'}
  if(preset==='30D') return{date_preset:'last_30d'}
  if(preset==='This Month') return{date_preset:'this_month'}
  if(preset==='custom'&&cfrom&&cto) return{time_range:JSON.stringify({since:cfrom,until:cto})}
  return{date_preset:'today'}
}

function objLabel(o='') {
  const m={OUTCOME_LEADS:'LEADS',OUTCOME_SALES:'SALES',OUTCOME_AWARENESS:'AWARENESS',OUTCOME_ENGAGEMENT:'ENGAGEMENT',OUTCOME_TRAFFIC:'TRAFFIC',LEAD_GENERATION:'LEADS',CONVERSIONS:'SALES',MESSAGES:'LEADS',POST_ENGAGEMENT:'ENGAGEMENT',VIDEO_VIEWS:'AWARENESS',REACH:'AWARENESS',BRAND_AWARENESS:'AWARENESS',LINK_CLICKS:'TRAFFIC',PAGE_LIKES:'ENGAGEMENT',OUTCOME_APP_PROMOTION:'APP'}
  return m[o.toUpperCase().replace(/\s/g,'_')]||o||'—'
}
function objCls(o){const l=objLabel(o);return l==='LEADS'?'obj-leads':l==='SALES'?'obj-sales':l==='AWARENESS'?'obj-aware':l==='ENGAGEMENT'?'obj-eng':'obj-traffic'}
function campStatus(c){
  const s=(c.effective_status||c.status||'').toUpperCase()
  if(s==='ACTIVE') return{dot:'on',label:'Active'}
  if(s==='PAUSED') return{dot:'na',label:'Paused'}
  if(s==='ARCHIVED') return{dot:'na',label:'Archived'}
  if(s.includes('ERROR')||s.includes('DISAPPROVED')) return{dot:'off',label:'Error'}
  return{dot:'na',label:s||'—'}
}
function accStatus(code){
  if(code===1) return{cls:'ok',dot:'g',badge:'LIVE',badgeCls:'sb-live'}
  if(code===9) return{cls:'err',dot:'r',badge:'GRACE PERIOD',badgeCls:'sb-err'}
  if(code===2) return{cls:'err',dot:'r',badge:'DISABLED',badgeCls:'sb-err'}
  if(code===3) return{cls:'err',dot:'r',badge:'UNSETTLED',badgeCls:'sb-err'}
  if(code===7) return{cls:'warn',dot:'a',badge:'PENDING',badgeCls:'sb-warn'}
  if(code===101) return{cls:'off',dot:'e',badge:'CLOSED',badgeCls:'sb-off'}
  return{cls:'ok',dot:'g',badge:'LIVE',badgeCls:'sb-live'}
}
function parseResults(ins,currency){
  if(!ins) return{text:'—',cls:'',count:0}
  const s=SYM(currency),spend=parseFloat(ins.spend||0),actions=ins.actions||[]
  const LEAD=['lead','onsite_conversion.lead_grouped','contact_total']
  const PURCH=['purchase','omni_purchase']
  const CONV=['onsite_conversion.messaging_first_reply','messaging_first_reply']
  const CLICK=['link_click','landing_page_view']
  for(const[types,lbl]of[[PURCH,'Purchases'],[LEAD,'Leads'],[CONV,'Convos'],[CLICK,'Clicks']]){
    for(const t of types){
      const a=actions.find(x=>x.action_type===t||x.action_type?.startsWith(t))
      if(a&&parseInt(a.value)>0){
        const cnt=parseInt(a.value),cpa=cnt>0&&spend>0?Math.round(spend/cnt):null
        const cpaLbl=lbl==='Purchases'?'CPP':lbl==='Clicks'?'CPC':'CPL'
        return{text:`${cnt} ${lbl}${cpa?` · ${cpaLbl} ${s}${cpa}`:''}`,cls:'green',count:cnt}
      }
    }
  }
  const tp=ins.video_thruplay_watched_actions?.[0]
  if(tp&&parseInt(tp.value)>0){
    const cnt=parseInt(tp.value),ctp=spend>0&&cnt>0?spend/cnt:null
    return{text:`${fmtNum(cnt)} ThruPlays${ctp?` · ${s}${ctp<1?ctp.toFixed(3):Math.round(ctp)}`:''}`,cls:'green',count:cnt}
  }
  if(ins.reach&&parseInt(ins.reach)>0) return{text:`Reach ${fmtNum(ins.reach)}`,cls:'',count:0}
  if(spend>0) return{text:'Spend only',cls:'',count:0}
  return{text:'—',cls:'',count:0}
}

// ── Token expiry ──────────────────────────────────────────────────────────────
function tokenDaysLeft() {
  const diff = TOKEN_EXPIRY - new Date()
  return Math.ceil(diff / (1000*60*60*24))
}

// ── Spend pacing ──────────────────────────────────────────────────────────────
function calcPacing(spentSubunits, capSubunits) {
  if (!capSubunits || parseFloat(capSubunits) === 0) return null
  const spent = parseFloat(spentSubunits||0)/100
  const cap = parseFloat(capSubunits)/100
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
  const dayOfMonth = now.getDate()
  const expectedPct = (dayOfMonth / daysInMonth) * 100
  const actualPct = (spent / cap) * 100
  const diff = actualPct - expectedPct
  return { spent, cap, actualPct, expectedPct, diff, dayOfMonth, daysInMonth }
}

// ── Budget ETA ────────────────────────────────────────────────────────────────
function calcETA(dailySpend, budgetRemainingSubunits) {
  if (!budgetRemainingSubunits || !dailySpend || dailySpend <= 0) return null
  const remaining = parseFloat(budgetRemainingSubunits)/100
  const days = remaining / dailySpend
  return { remaining, days: Math.round(days) }
}

// ── API helpers ───────────────────────────────────────────────────────────────
function apiFetch(endpoint, params={}) {
  const qs = new URLSearchParams({ endpoint })
  Object.entries(params).forEach(([k,v]) => qs.set(k,v))
  return fetch(`/api/meta?${qs}`).then(r=>r.json())
}
function metaUrl(type,{accountId,campId,adsetId,adId}={}) {
  const base='https://adsmanager.facebook.com/adsmanager/manage'
  const act=accountId?`?act=${accountId}`:''
  if(type==='billing') return`https://business.facebook.com/billing_hub/payment_activity${act}`
  if(type==='campaign') return campId?`${base}/campaigns${act}&selected_campaign_ids=${campId}`:`${base}/campaigns${act}`
  if(type==='adset') return adsetId?`${base}/adsets${act}&selected_adset_ids=${adsetId}`:`${base}/campaigns${act}`
  if(type==='ad') return adId?`${base}/ads${act}&selected_ad_ids=${adId}`:`${base}/ads${act}`
  return`${base}/campaigns${act}`
}
function openMeta(type,ids={}) { window.open(metaUrl(type,ids),'_blank','noopener') }

function Spinner({size=14}) {
  return <div style={{width:size,height:size,border:'2px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>
}

// ── Semaphore fetch ───────────────────────────────────────────────────────────
function makeSemaphore(max=4) {
  let running=0; const queue=[]
  const run=()=>{while(running<max&&queue.length>0){const{fn,resolve,reject}=queue.shift();running++;fn().then(v=>{running--;run();resolve(v)}).catch(e=>{running--;run();reject(e)})}}
  return fn=>new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});run()})
}

// ── Main data fetch ───────────────────────────────────────────────────────────
async function fetchAllData(dateParams) {
  const cache = {}
  const semaphore = makeSemaphore(4)
  const fetch$ = (endpoint, params) => semaphore(()=>apiFetch(endpoint, params))

  await Promise.all(CLIENTS.map(async cl => {
    const S = SYM(cl.currency)
    const entry = { cl, accInfo:null, ins:null, campaigns:[], trend:[], alerts:{rejected:[],billing:[],noSpend:false,highFreq:[]}, topPerf:[] }
    try {
      const [accData, insData, campListData, campInsData, adsData, adsetInsData, trendData, billingData] = await Promise.all([
        fetch$(`act_${cl.accountId}`, { fields:'name,account_status,currency,balance,spend_cap,amount_spent,disable_reason,funding_source_details' }),
        fetch$(`act_${cl.accountId}/insights`, { fields:INSIGHT_FIELDS, ...dateParams }),
        fetch$(`act_${cl.accountId}/campaigns`, {
          fields:'id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time',
          filtering:JSON.stringify([{field:'effective_status',operator:'IN',value:['ACTIVE','PAUSED']}]),
          limit:'30'
        }),
        fetch$(`act_${cl.accountId}/insights`, { fields:INSIGHT_FIELDS+',campaign_id,campaign_name', level:'campaign', limit:'30', ...dateParams }),
        fetch$(`act_${cl.accountId}/ads`, {
          fields:'id,name,effective_status,ad_review_feedback,campaign_id,created_time',
          filtering:JSON.stringify([{field:'effective_status',operator:'IN',value:['DISAPPROVED','WITH_ISSUES']}]),
          limit:'10'
        }),
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend,frequency,campaign_id,adset_id,actions,ctr', level:'adset', limit:'50', ...dateParams }),
        // 7-day daily trend (always last 7 days regardless of date filter)
        fetch$(`act_${cl.accountId}/insights`, { fields:'spend,impressions,clicks', date_preset:'last_7d', time_increment:'1' }),
        // Billing activities — fetch recent events, filter client-side for top-ups
        fetch$(`act_${cl.accountId}/activities`, { fields:'event_time,event_type,extra_data', limit:'20' }),
      ])

      // Account info + billing
      if (!accData.error) {
        entry.accInfo = accData

        // Last top-up: scan activities for any funding/payment event
        const TOPUP_TYPES = ['add_fund_to_prepay','prepay_fund_added','add_funding_source',
          'funding_event_successful','payment_done','add_payment_method']
        const allActivities = billingData?.data||[]
        const topUpEvent = allActivities.find(e =>
          TOPUP_TYPES.some(t => (e.event_type||'').toLowerCase().includes(t.toLowerCase().replace(/_/g,'')))
          || (e.event_type||'').toLowerCase().includes('fund')
          || (e.event_type||'').toLowerCase().includes('pay')
        )
        entry.lastTopUp = topUpEvent?.event_time || null
        entry.allActivities = allActivities // store for raw debug

        // Funding source type
        const fundingType = accData.funding_source_details?.type || null
        entry.fundingType = fundingType
        const isPrepaid = ['PREPAY','1',1].includes(fundingType)

        // Balance (informational only — not an alert trigger)
        const bal = parseFloat(accData.balance||0)/100
        entry.balance = bal
        entry.isPrepaid = isPrepaid

        const statusMap = {1:'Active',2:'Disabled',3:'Unsettled',7:'Pending Review',9:'Grace Period',100:'Pending Closure',101:'Closed'}

        // ONLY alert on real problems:
        // 1. Account disabled/suspended/grace period
        if (accData.account_status !== 1)
          entry.alerts.billing.push({
            type:'status',
            status:statusMap[accData.account_status]||`Status ${accData.account_status}`,
            detail:accData.disable_reason?`Reason: ${accData.disable_reason}`:'Fix in Meta Business Manager → Billing',
            severity:accData.account_status===9?'r':'a'
          })

        // 2. Spend cap nearly exhausted (95%+) — this WILL pause ads
        if (accData.spend_cap && parseFloat(accData.spend_cap) > 0) {
          const spent = parseFloat(accData.amount_spent||0)/100
          const cap = parseFloat(accData.spend_cap)/100
          const pct = cap > 0 ? (spent/cap)*100 : 0
          if (pct >= 95)
            entry.alerts.billing.push({
              type:'spend_cap',
              status:`Spend Cap ${pct.toFixed(0)}% Used`,
              detail:`${fmtSpend(spent,S)} of ${fmtSpend(cap,S)} cap used — increase cap in Meta now or ads will pause`,
              severity:'r'
            })
          else if (pct >= 85)
            entry.alerts.billing.push({
              type:'spend_cap',
              status:`Spend Cap ${pct.toFixed(0)}% Used`,
              detail:`${fmtSpend(spent,S)} of ${fmtSpend(cap,S)} used — consider increasing cap soon`,
              severity:'a'
            })
        }
      }

      entry.ins = insData.error ? {_err:insData.error.message||'API Error'} : (insData.data?.[0]||null)

      // Campaigns
      if (campListData.data?.length) {
        const insMap = {}
        ;(campInsData.data||[]).forEach(r => { insMap[r.campaign_id] = r })
        entry.campaigns = campListData.data.map(c => ({...c, ins:insMap[c.id]||null}))
        entry.campaigns.sort((a,b) => parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      }

      // Trend data
      entry.trend = (trendData.data||[]).map(d => ({
        date: d.date_start,
        spend: parseFloat(d.spend||0),
        impressions: parseInt(d.impressions||0),
        clicks: parseInt(d.clicks||0),
      })).sort((a,b) => a.date.localeCompare(b.date))

      // Rejected ads
      const activeCampIds = new Set((campListData.data||[]).filter(c=>(c.effective_status||'').toUpperCase()==='ACTIVE').map(c=>c.id))
      const now=Date.now(), H24=24*60*60*1000, H72=72*60*60*1000
      ;(adsData.data||[]).filter(ad=>activeCampIds.has(ad.campaign_id)).forEach(ad => {
        let reason='Policy violation or creative issue'
        if (ad.ad_review_feedback) {
          try {
            const ex=o=>{if(typeof o==='string')return[o];if(Array.isArray(o))return o.flatMap(ex);if(typeof o==='object'&&o)return Object.values(o).flatMap(ex);return[]}
            const r=ex(ad.ad_review_feedback).filter(s=>s&&s.length>2)
            if(r.length) reason=r.slice(0,2).join(' · ')
          } catch(e){}
        }
        const ageMs=ad.created_time?(now-new Date(ad.created_time).getTime()):H72+1
        const severity=ageMs<=H24?'r':ageMs<=H72?'a':'old'
        entry.alerts.rejected.push({adId:ad.id,campId:ad.campaign_id,adName:ad.name,status:ad.effective_status,reason,severity,createdTime:ad.created_time})
      })

      // No spend + high freq — use account-level insights (not adset sum which can lag/be empty)
      const adsetRows = adsetInsData.data||[]
      const insSpend = parseFloat(insData.data?.[0]?.spend || 0)
      if(insSpend===0&&!accData.error&&accData.account_status===1) entry.alerts.noSpend=true
      const seen=new Set()
      adsetRows.forEach(row => {
        const freq=parseFloat(row.frequency||0), k=row.campaign_id
        if(freq>=2.5&&!seen.has(k)){seen.add(k);entry.alerts.highFreq.push({adsetId:row.adset_id,campId:row.campaign_id,freq:freq.toFixed(2),spend:fmtSpend(parseFloat(row.spend||0),S),severity:freq>=3?'r':'a'})}
      })

      // Top performers
      ;(campInsData.data||[]).forEach(row=>{
        const spend=parseFloat(row.spend||0)
        if(spend<50) return
        const res=parseResults(row,cl.currency)
        if(res.count>0) entry.topPerf.push({campId:row.campaign_id,campName:row.campaign_name,spend:fmtSpend(spend,S),result:res.text,ctr:parseFloat(row.ctr||0).toFixed(2)+'%',cpa:Math.round(spend/res.count),S})
      })

    } catch(e) { entry.ins={_err:e.message} }
    cache[cl.key] = entry
  }))
  return cache
}

// ── Sparkline (7-day trend) ───────────────────────────────────────────────────
function Sparkline({ data, color='#7DC242', width=120, height=32 }) {
  if (!data||data.length<2) return <span style={{fontSize:10,color:'var(--text3)'}}>no data</span>
  const vals = data.map(d=>d.spend)
  const max = Math.max(...vals)||1
  const pts = vals.map((v,i)=>`${(i/(vals.length-1))*width},${height-(v/max)*height*0.9}`).join(' ')
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={`${pts} ${width},${height} 0,${height}`} fill={color} fillOpacity={0.08} stroke="none"/>
    </svg>
  )
}

// ── Bar Chart (7-day daily spend) ─────────────────────────────────────────────
function SpendBarChart({ data, S }) {
  if (!data||data.length===0) return <div style={{color:'var(--text3)',fontSize:11,padding:'8px 0'}}>No trend data</div>
  const maxSpend = Math.max(...data.map(d=>d.spend))||1
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:4,height:60,padding:'0 4px'}}>
      {data.map((d,i)=>{
        const h = Math.max(3,(d.spend/maxSpend)*54)
        const dt = new Date(d.date)
        const lbl = dt.toLocaleDateString('en-IN',{day:'numeric',month:'short'})
        return (
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <div style={{fontSize:8,color:'var(--text3)',whiteSpace:'nowrap'}}>{d.spend>0?S+Math.round(d.spend).toLocaleString('en-IN'):''}</div>
            <div title={`${lbl}: ${S}${d.spend.toFixed(0)}`}
              style={{width:'100%',height:h,background:d.spend>0?'var(--green)':'var(--border)',borderRadius:'3px 3px 0 0',transition:'height .3s',cursor:'default'}}/>
            <div style={{fontSize:8,color:'var(--text3)',whiteSpace:'nowrap'}}>{lbl.split(' ')[0]}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Campaign Drill-Down ───────────────────────────────────────────────────────
function CampaignDrillDown({ camp, accountId, currency, dateParams, onClose }) {
  const [tab, setTab] = useState('adsets')
  const [adsets, setAdsets] = useState(null)
  const [adsetIns, setAdsetIns] = useState(null)
  const [demographics, setDemographics] = useState(null)
  const [placements, setPlacements] = useState(null)
  const [creatives, setCreatives] = useState(null)
  const [loading, setLoading] = useState({adsets:false,demographics:false,placements:false,creatives:false})
  const S = SYM(currency)

  // Load adsets immediately on open
  useEffect(() => {
    setLoading(l=>({...l,adsets:true}))
    Promise.all([
      // Fetch adsets for this campaign directly
      apiFetch(`act_${accountId}/adsets`, {
        fields:'id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining,start_time,end_time,optimization_goal',
        filtering:JSON.stringify([{field:'campaign_id',operator:'EQUAL',value:camp.id}]),
        limit:'30'
      }),
      // Fetch insights via campaign edge — level=adset works correctly here
      apiFetch(`${camp.id}/insights`, {
        fields:INSIGHT_FIELDS+',adset_id,adset_name',
        level:'adset',
        limit:'30',
        ...dateParams
      })
    ]).then(([asData, asIns]) => {
      const insMap = {}
      ;(asIns.data||[]).forEach(r => { insMap[r.adset_id]=r })
      const list = (asData.data||[]).map(a=>({...a, ins:insMap[a.id]||null}))
      list.sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))
      setAdsets(list)
      setLoading(l=>({...l,adsets:false}))
    }).catch(e=>{ console.error('Adset fetch error:',e); setLoading(l=>({...l,adsets:false})) })
  }, [camp.id])

  const loadDemographics = () => {
    if (demographics) return
    setLoading(l=>({...l,demographics:true}))
    apiFetch(`${camp.id}/insights`, {
      fields:'spend,impressions,clicks,ctr,reach',
      breakdowns:'age,gender',
      ...dateParams
    }).then(d=>{ setDemographics(d.data||[]); setLoading(l=>({...l,demographics:false})) })
     .catch(()=>setLoading(l=>({...l,demographics:false})))
  }

  const loadPlacements = () => {
    if (placements) return
    setLoading(l=>({...l,placements:true}))
    apiFetch(`${camp.id}/insights`, {
      fields:'spend,impressions,clicks,ctr,reach',
      breakdowns:'publisher_platform,platform_position',
      ...dateParams
    }).then(d=>{ setPlacements(d.data||[]); setLoading(l=>({...l,placements:false})) })
     .catch(()=>setLoading(l=>({...l,placements:false})))
  }

  const loadCreatives = () => {
    if (creatives) return
    setLoading(l=>({...l,creatives:true}))
    apiFetch(`act_${accountId}/ads`, {
      fields:'id,name,effective_status,creative{id,title,body,image_url,thumbnail_url,object_story_spec}',
      filtering:JSON.stringify([{field:'campaign_id',operator:'EQUAL',value:camp.id}]),
      limit:'20'
    }).then(d=>{ setCreatives(d.data||[]); setLoading(l=>({...l,creatives:false})) })
     .catch(()=>setLoading(l=>({...l,creatives:false})))
  }

  useEffect(() => {
    if (tab==='demographics') loadDemographics()
    if (tab==='placements') loadPlacements()
    if (tab==='creatives') loadCreatives()
  }, [tab])

  const bgt = fmtBudget(camp, S)
  const campIns = camp.ins
  const CS = campStatus(camp)

  return (
    <div
      style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:40,overflowY:'auto'}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}
    >
      <div style={{background:'var(--card)',borderRadius:16,width:'92%',maxWidth:920,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',marginBottom:40,flexShrink:0}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span className={`obj-b ${objCls(camp.objective)}`}>{objLabel(camp.objective)}</span>
              <div className="st-ind"><div className={`st-dot ${CS.dot}`}/>{CS.label}</div>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:4}}>{camp.name}</div>
            <div style={{fontSize:11,color:'var(--text3)',fontFamily:'JetBrains Mono',display:'flex',gap:16}}>
              <span>ID: {camp.id}</span>
              {bgt.label!=='—'&&<span>Budget: {bgt.label} <span style={{opacity:.6}}>{bgt.type}</span></span>}
              <span>Start: {fmtDate(camp.start_time)}</span>
              {camp.stop_time&&<span style={{color:'var(--amber)'}}>End: {fmtDate(camp.stop_time)}</span>}
            </div>
          </div>
          {/* Quick KPIs */}
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            {[
              {l:'Spend',v:campIns?fmtSpend(parseFloat(campIns.spend||0),S):'—'},
              {l:'CTR',v:campIns?parseFloat(campIns.ctr||0).toFixed(2)+'%':'—'},
              {l:'CPM',v:campIns&&parseFloat(campIns.cpm||0)>0?S+parseFloat(campIns.cpm||0).toFixed(0):'—'},
              {l:'Results',v:campIns?parseResults(campIns,currency).text:'—'},
            ].map(({l,v})=>(
              <div key={l} style={{textAlign:'center',padding:'6px 10px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,minWidth:70}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',marginBottom:2}}>{l}</div>
                <div style={{fontFamily:'JetBrains Mono',fontSize:11,fontWeight:700,color:'var(--text2)'}}>{v}</div>
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{background:'none',border:'1px solid var(--border)',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:'var(--text3)',flexShrink:0}}>×</button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:2,padding:'10px 20px 0',borderBottom:'1px solid var(--border)'}}>
          {[['adsets','Ad Sets'],['demographics','Demographics'],['placements','Placements'],['creatives','Creatives'],['debug','Raw Data']].map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{padding:'6px 14px',fontSize:12,fontWeight:600,borderRadius:'6px 6px 0 0',border:'1px solid',borderBottom:'none',cursor:'pointer',
                background:tab===k?'var(--card)':'transparent',
                borderColor:tab===k?'var(--border)':'transparent',
                color:tab===k?'var(--green-dk)':'var(--text3)',
                marginBottom:tab===k?-1:0}}>
              {label}
            </button>
          ))}
        </div>

        <div style={{padding:'16px 20px',maxHeight:'60vh',overflowY:'auto'}}>
          {/* Ad Sets tab */}
          {tab==='adsets'&&(
            loading.adsets ? <div style={{display:'flex',alignItems:'center',gap:8,padding:20}}><Spinner/><span style={{fontSize:12,color:'var(--text3)'}}>Loading ad sets…</span></div>
            : !adsets||adsets.length===0 ? <div className="no-data-box">No ad sets found for this campaign.</div>
            : <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--bg)'}}>
                  {['Ad Set','Budget','Spend','Results','CTR','Freq','Status'].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid var(--border)'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {adsets.map((a,i)=>{
                    const ai=a.ins, as=campStatus(a), bgt=fmtBudget(a,S)
                    const aSpend=parseFloat(ai?.spend||0), aCtr=parseFloat(ai?.ctr||0), aFreq=parseFloat(ai?.frequency||0)
                    const aRes=parseResults(ai,currency)
                    return (
                      <tr key={i} style={{borderBottom:'1px solid var(--border)',cursor:'pointer'}}
                        onClick={()=>openMeta('adset',{accountId,adsetId:a.id})}>
                        <td style={{padding:'8px 10px'}}><b style={{color:'var(--blue-dk)'}}>{a.name}</b> <span style={{fontSize:9,color:'var(--text3)'}}>↗</span></td>
                        <td style={{padding:'8px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>
                          {bgt.label!=='—'?<>{bgt.label}<span style={{fontSize:9,color:'var(--text3)',marginLeft:3}}>{bgt.type}</span></>:'—'}
                        </td>
                        <td style={{padding:'8px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{ai?fmtSpend(aSpend,S):'—'}</td>
                        <td style={{padding:'8px 10px',color:aRes.cls==='green'?'var(--green-dk)':'var(--text2)',fontWeight:aRes.cls?600:400}}>{aRes.text}</td>
                        <td style={{padding:'8px 10px',color:aCtr>=1.5?'var(--green-dk)':aCtr>0&&aCtr<0.8?'var(--red)':'var(--text2)'}}>{aCtr>0?aCtr.toFixed(2)+'%':'—'}</td>
                        <td style={{padding:'8px 10px',color:aFreq>=2.5?'var(--red)':aFreq>=2?'var(--amber)':'var(--text2)',fontWeight:aFreq>=2.5?700:400}}>{aFreq>0?aFreq.toFixed(2):'—'}</td>
                        <td style={{padding:'8px 10px'}}><div className="st-ind"><div className={`st-dot ${as.dot}`}/>{as.label}</div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          )}

          {/* Demographics tab */}
          {tab==='demographics'&&(
            loading.demographics ? <div style={{display:'flex',alignItems:'center',gap:8,padding:20}}><Spinner/><span style={{fontSize:12,color:'var(--text3)'}}>Loading demographics…</span></div>
            : !demographics||demographics.length===0 ? <div className="no-data-box">No demographic data for this period.</div>
            : <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--bg)'}}>
                  {['Age','Gender','Spend','Impressions','Clicks','CTR','Reach'].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid var(--border)'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...demographics].sort((a,b)=>parseFloat(b.spend||0)-parseFloat(a.spend||0)).map((d,i)=>{
                    const spend=parseFloat(d.spend||0), ctr=parseFloat(d.ctr||0)
                    return (
                      <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                        <td style={{padding:'7px 10px',fontWeight:600}}>{d.age||'—'}</td>
                        <td style={{padding:'7px 10px',textTransform:'capitalize'}}>{d.gender||'—'}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtSpend(spend,S)}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtNum(d.impressions)}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtNum(d.clicks)}</td>
                        <td style={{padding:'7px 10px',color:ctr>=1.5?'var(--green-dk)':ctr>0&&ctr<0.8?'var(--red)':'var(--text2)'}}>{ctr>0?ctr.toFixed(2)+'%':'—'}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtNum(d.reach)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          )}

          {/* Placements tab */}
          {tab==='placements'&&(
            loading.placements ? <div style={{display:'flex',alignItems:'center',gap:8,padding:20}}><Spinner/><span style={{fontSize:12,color:'var(--text3)'}}>Loading placements…</span></div>
            : !placements||placements.length===0 ? <div className="no-data-box">No placement data for this period.</div>
            : <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'var(--bg)'}}>
                  {['Platform','Position','Spend','Impressions','Clicks','CTR'].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid var(--border)'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...placements].sort((a,b)=>parseFloat(b.spend||0)-parseFloat(a.spend||0)).map((d,i)=>{
                    const spend=parseFloat(d.spend||0), ctr=parseFloat(d.ctr||0)
                    const platform=d.publisher_platform||'—', pos=(d.platform_position||'—').replace(/_/g,' ')
                    return (
                      <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                        <td style={{padding:'7px 10px',fontWeight:600,textTransform:'capitalize'}}>{platform}</td>
                        <td style={{padding:'7px 10px',textTransform:'capitalize',color:'var(--text2)'}}>{pos}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtSpend(spend,S)}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtNum(d.impressions)}</td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono',fontSize:11}}>{fmtNum(d.clicks)}</td>
                        <td style={{padding:'7px 10px',color:ctr>=1.5?'var(--green-dk)':ctr>0&&ctr<0.8?'var(--red)':'var(--text2)'}}>{ctr>0?ctr.toFixed(2)+'%':'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          )}

          {/* Creatives tab */}
          {tab==='creatives'&&(
            loading.creatives ? <div style={{display:'flex',alignItems:'center',gap:8,padding:20}}><Spinner/><span style={{fontSize:12,color:'var(--text3)'}}>Loading creatives…</span></div>
            : !creatives||creatives.length===0 ? <div className="no-data-box">No ads / creatives found.</div>
            : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                {creatives.map((ad,i)=>{
                  const cr = ad.creative||{}
                  const thumb = cr.thumbnail_url||cr.image_url||null
                  const title = cr.title||cr.object_story_spec?.link_data?.name||cr.object_story_spec?.video_data?.title||ad.name
                  const body = cr.body||cr.object_story_spec?.link_data?.message||cr.object_story_spec?.video_data?.message||''
                  const st = ad.effective_status||''
                  const isRejected = ['DISAPPROVED','WITH_ISSUES'].includes(st)
                  return (
                    <div key={i} style={{background:'var(--bg)',border:`1.5px solid ${isRejected?'var(--red-bd)':'var(--border)'}`,borderRadius:10,overflow:'hidden',cursor:'pointer'}}
                      onClick={()=>openMeta('ad',{accountId,adId:ad.id})}>
                      {thumb
                        ? <img src={thumb} alt="" style={{width:'100%',height:110,objectFit:'cover',display:'block'}} onError={e=>{e.target.style.display='none'}}/>
                        : <div style={{height:80,background:'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🖼</div>}
                      <div style={{padding:'8px 10px'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--text)',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title||ad.name}</div>
                        {body&&<div style={{fontSize:10,color:'var(--text3)',overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',lineHeight:1.4}}>{body}</div>}
                        <div style={{marginTop:6,display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:isRejected?'var(--red-lt)':'var(--green-lt)',color:isRejected?'var(--red)':'var(--green-dk)',border:`1px solid ${isRejected?'var(--red-bd)':'var(--green-bd)'}`}}>{st}</span>
                          <span style={{fontSize:9,color:'var(--text3)'}}>↗ Open in Meta</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          )}

          {/* Raw debug tab */}
          {tab==='debug'&&(
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>
              <div style={{fontWeight:700,color:'var(--text3)',marginBottom:8}}>Campaign raw fields</div>
              <pre style={{background:'var(--bg)',padding:12,borderRadius:8,border:'1px solid var(--border)',overflowX:'auto',fontSize:10,lineHeight:1.6}}>{JSON.stringify({
                id:camp.id, status:camp.status, effective_status:camp.effective_status,
                daily_budget:camp.daily_budget, daily_budget_div100:camp.daily_budget?(parseFloat(camp.daily_budget)/100).toFixed(2):'—',
                lifetime_budget:camp.lifetime_budget, lifetime_budget_div100:camp.lifetime_budget?(parseFloat(camp.lifetime_budget)/100).toFixed(2):'—',
                budget_remaining:camp.budget_remaining, start_time:camp.start_time, stop_time:camp.stop_time,
              },null,2)}</pre>
              <div style={{fontWeight:700,color:'var(--text3)',margin:'12px 0 8px'}}>Insights raw fields</div>
              <pre style={{background:'var(--bg)',padding:12,borderRadius:8,border:'1px solid var(--border)',overflowX:'auto',fontSize:10,lineHeight:1.6}}>{JSON.stringify(camp.ins||'No insights for this period',null,2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccCard({ cl, entry, activeDateLabel, isVisible, dateParams }) {
  const [open, setOpen] = useState(false)
  const [drillCamp, setDrillCamp] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareRange, setCompareRange] = useState('last_7d')
  const [compareData, setCompareData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  // NOTE: early return MUST come after all hooks (React rules of hooks)
  const S = SYM(cl.currency)
  const accInfo = entry?.accInfo
  const ins = entry?.ins
  const camps = entry?.campaigns||[]
  const trend = entry?.trend||[]
  const lastTopUp = entry?.lastTopUp || null
  const fundingType = entry?.fundingType
  const isPrepaid = entry?.isPrepaid || false
  const bal = entry?.balance ?? null
  const st = accInfo ? accStatus(accInfo.account_status) : {cls:'ok',dot:'g',badge:'LIVE',badgeCls:'sb-live'}

  const spend=parseFloat(ins?.spend||0), impr=parseInt(ins?.impressions||0)
  const ctr=parseFloat(ins?.ctr||0), freq=parseFloat(ins?.frequency||0)
  const cpm=parseFloat(ins?.cpm||0), reach=parseInt(ins?.reach||0)
  const clicks=parseInt(ins?.clicks||0)
  const res = ins&&!ins._err ? parseResults(ins,cl.currency) : {text:'—',cls:'',count:0}
  const loading = entry===undefined

  // Pacing
  const pacing = accInfo ? calcPacing(accInfo.amount_spent, accInfo.spend_cap) : null

  // ETA — use today's spend as proxy for daily burn
  const todaySpend = trend.length>0 ? trend[trend.length-1]?.spend : 0
  const activeCampBudgetRemaining = camps.reduce((sum,c)=>sum+parseFloat(c.budget_remaining||0),0)
  const eta = activeCampBudgetRemaining>0&&todaySpend>0 ? calcETA(todaySpend, activeCampBudgetRemaining*100) : null

  // Score
  const liveScore = ins&&!ins._err&&spend>0 ? (()=>{
    let s=70
    if(ctr>=2)s+=10;else if(ctr>=1.5)s+=5;else if(ctr<0.5)s-=10
    if(freq>=3)s-=20;else if(freq>=2.5)s-=12;else if(freq>=2)s-=5
    if(res.count>0)s+=8
    return Math.max(0,Math.min(100,Math.round(s)))
  })() : null
  const scoreColor = !liveScore?'var(--text3)':liveScore>=75?'var(--green)':liveScore>=60?'var(--amber)':'var(--red)'
  const CC = {green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)'}

  // Compare ranges
  const loadCompare = () => {
    if (compareData) return
    setCompareLoading(true)
    apiFetch(`act_${cl.accountId}/insights`, {
      fields: INSIGHT_FIELDS,
      date_preset: compareRange
    }).then(d=>{
      setCompareData(d.data?.[0]||null)
      setCompareLoading(false)
    }).catch(()=>setCompareLoading(false))
  }

  useEffect(()=>{
    if(compareMode) { setCompareData(null); loadCompare() }
  },[compareMode,compareRange])

  // CSV Export
  const exportCSV = () => {
    const rows = [['Campaign','Objective','Budget','Start','End','Spend','CTR','CPM','Freq','Status']]
    camps.forEach(c=>{
      const bgt=fmtBudget(c,S)
      rows.push([
        c.name, objLabel(c.objective), bgt.label+' '+bgt.type,
        fmtDate(c.start_time), c.stop_time?fmtDate(c.stop_time):'Ongoing',
        fmtSpend(parseFloat(c.ins?.spend||0),S),
        parseFloat(c.ins?.ctr||0).toFixed(2)+'%',
        parseFloat(c.ins?.cpm||0).toFixed(0),
        parseFloat(c.ins?.frequency||0).toFixed(2),
        campStatus(c).label
      ])
    })
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob)
    a.download=`${cl.key}-campaigns-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); setExportMsg('Exported!'); setTimeout(()=>setExportMsg(''),2000)
  }

  if (!isVisible) return null

  return (
    <>
      {drillCamp&&<CampaignDrillDown camp={drillCamp} accountId={cl.accountId} currency={cl.currency} dateParams={dateParams} onClose={()=>setDrillCamp(null)}/>}
      <div className={`acc-card ${st.cls}${open?' open':''}`} data-client={cl.key}>
        <div className="acc-hdr" onClick={()=>setOpen(o=>!o)}>
          <div className="acc-exp">›</div>
          <div className={`acc-sdot ${st.dot}`}/>
          <div className="acc-info">
            <div className="acc-name">{cl.name}</div>
            <div className="acc-meta">#{cl.accountId} · {cl.currency} · {cl.vertical} · {activeDateLabel}</div>
          </div>
          <div className="acc-kpis">
            {loading ? (
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px'}}><Spinner size={11}/><span style={{fontSize:10,color:'var(--text3)'}}>Loading…</span></div>
            ) : ins?._err ? (
              <div className="kc" style={{minWidth:180}}><div className="kc-lbl">Error</div><div className="kc-val r" style={{fontSize:9,whiteSpace:'normal'}}>{ins._err.slice(0,80)}</div></div>
            ) : (
              <>
                <div className="kc"><div className="kc-lbl">Spend</div><div className={`kc-val ${spend>0?'n':'r'}`}>{fmtSpend(spend,S)}</div></div>
                <div className="kc"><div className="kc-lbl">Impressions</div><div className="kc-val n">{fmtNum(impr)}</div></div>
                <div className="kc"><div className="kc-lbl">Clicks</div><div className="kc-val n">{fmtNum(clicks)}</div></div>
                <div className="kc"><div className="kc-lbl">CTR</div><div className={`kc-val ${ctr>=1.5?'g':ctr>0&&ctr<0.8?'r':'n'}`}>{ctr>0?ctr.toFixed(2)+'%':'—'}</div></div>
                <div className="kc"><div className="kc-lbl">CPM</div><div className="kc-val n">{cpm>0?S+cpm.toFixed(0):'—'}</div></div>
                <div className="kc"><div className="kc-lbl">Reach</div><div className="kc-val n">{reach>0?fmtNum(reach):'—'}</div></div>
                <div className="kc"><div className="kc-lbl">Freq</div><div className={`kc-val ${freq>=2.5?'r':freq>=2?'a':'n'}`}>{freq>0?freq.toFixed(2):'—'}</div></div>
                <div className="kc"><div className="kc-lbl">Results</div><div className={`kc-val ${res.cls==='green'?'g':'n'}`} style={{fontSize:10,maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{res.text}</div></div>
                {trend.length>0&&<div className="kc" style={{minWidth:130}}><div className="kc-lbl">7D Trend</div><Sparkline data={trend} width={110} height={24}/></div>}
              </>
            )}
          </div>
          <div className="acc-right">
            <div className="acc-badges">
              <span className={`s-badge ${st.badgeCls}`}>{st.badge}</span>
              {ins&&!ins._err&&freq>=2.5&&<span className="chip-r">Freq {freq.toFixed(2)}</span>}
              {ins&&!ins._err&&freq>=2&&freq<2.5&&<span className="chip-a">Freq {freq.toFixed(2)}</span>}
              {ins&&!ins._err&&spend===0&&impr===0&&<span className="chip-r">No Spend</span>}
              {eta&&eta.days<=5&&<span className="chip-r">Budget ETA {eta.days}d</span>}
              {eta&&eta.days>5&&eta.days<=10&&<span className="chip-a">Budget ETA {eta.days}d</span>}
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

        {open&&(
          <div className="acc-body">
            {/* Toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
              <button onClick={()=>setCompareMode(m=>!m)}
                style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:6,border:'1.5px solid var(--border)',background:compareMode?'var(--blue-lt)':'transparent',color:compareMode?'var(--blue-dk)':'var(--text3)',cursor:'pointer'}}>
                ⇄ Compare
              </button>
              {compareMode&&(
                <select value={compareRange} onChange={e=>{setCompareRange(e.target.value);setCompareData(null)}}
                  style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text2)',cursor:'pointer'}}>
                  <option value="yesterday">vs Yesterday</option>
                  <option value="last_7d">vs Last 7D</option>
                  <option value="last_14d">vs Last 14D</option>
                  <option value="last_30d">vs Last 30D</option>
                  <option value="last_month">vs Last Month</option>
                </select>
              )}
              <button onClick={exportCSV}
                style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:6,border:'1.5px solid var(--border)',background:'transparent',color:'var(--text3)',cursor:'pointer'}}>
                ↓ CSV {exportMsg&&<span style={{color:'var(--green-dk)',marginLeft:4}}>{exportMsg}</span>}
              </button>
              <button onClick={()=>setShowRaw(r=>!r)}
                style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:6,border:'1.5px solid var(--border)',background:showRaw?'var(--amber-lt)':'transparent',color:showRaw?'var(--amber)':'var(--text3)',cursor:'pointer'}}>
                🔍 Raw API
              </button>
            </div>

            {/* Compare panel */}
            {compareMode&&(
              <div style={{padding:'10px 14px',background:'var(--blue-lt)',borderBottom:'1px solid var(--blue-bd)'}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--blue-dk)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>⇄ Comparison — {activeDateLabel} vs {compareRange.replace(/_/g,' ')}</div>
                {compareLoading ? <div style={{display:'flex',alignItems:'center',gap:6}}><Spinner size={11}/><span style={{fontSize:11,color:'var(--text3)'}}>Loading…</span></div>
                : compareData ? (
                  <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                    {[
                      {l:'Spend',a:spend,b:parseFloat(compareData.spend||0),fmt:v=>fmtSpend(v,S)},
                      {l:'Impressions',a:impr,b:parseInt(compareData.impressions||0),fmt:fmtNum},
                      {l:'Clicks',a:clicks,b:parseInt(compareData.clicks||0),fmt:fmtNum},
                      {l:'CTR',a:ctr,b:parseFloat(compareData.ctr||0),fmt:v=>v.toFixed(2)+'%'},
                      {l:'CPM',a:cpm,b:parseFloat(compareData.cpm||0),fmt:v=>S+v.toFixed(0)},
                      {l:'Freq',a:freq,b:parseFloat(compareData.frequency||0),fmt:v=>v.toFixed(2)},
                    ].map(({l,a,b,fmt})=>{
                      const diff = b>0 ? ((a-b)/b)*100 : 0
                      const up = diff>=0
                      return (
                        <div key={l} style={{textAlign:'center',minWidth:90}}>
                          <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',marginBottom:3}}>{l}</div>
                          <div style={{fontFamily:'JetBrains Mono',fontSize:12,fontWeight:700,color:'var(--text)'}}>{fmt(a)}</div>
                          <div style={{fontSize:10,color:'var(--text3)'}}>was {fmt(b)}</div>
                          {b>0&&<div style={{fontSize:10,fontWeight:700,color:up?'var(--green-dk)':'var(--red)'}}>{up?'▲':'▼'}{Math.abs(diff).toFixed(1)}%</div>}
                        </div>
                      )
                    })}
                  </div>
                ) : <div style={{fontSize:11,color:'var(--text3)'}}>No data for comparison period.</div>}
              </div>
            )}

            {/* 7-day spend chart */}
            {trend.length>0&&(
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>📈 7-Day Daily Spend</div>
                <SpendBarChart data={trend} S={S}/>
              </div>
            )}

            {/* Pacing + ETA */}
            {(pacing||eta)&&(
              <div style={{display:'flex',gap:8,padding:'10px 14px',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
                {pacing&&(
                  <div style={{flex:1,minWidth:220,padding:'9px 12px',borderRadius:8,background:Math.abs(pacing.diff)>15?'var(--amber-lt)':'var(--green-lt)',border:`1px solid ${Math.abs(pacing.diff)>15?'var(--amber-bd)':'var(--green-bd)'}`}}>
                    <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>📊 Spend Pacing (This Month)</div>
                    <div style={{fontSize:12,color:'var(--text2)',marginBottom:4}}>
                      Day <b>{pacing.dayOfMonth}</b> of <b>{pacing.daysInMonth}</b> — should be at <b>{pacing.expectedPct.toFixed(0)}%</b>, actually at <b>{pacing.actualPct.toFixed(0)}%</b>
                    </div>
                    <div style={{height:6,background:'var(--border)',borderRadius:3,marginBottom:4,overflow:'hidden',position:'relative'}}>
                      <div style={{height:'100%',borderRadius:3,background:'var(--text3)',width:`${pacing.expectedPct}%`,position:'absolute',opacity:.4}}/>
                      <div style={{height:'100%',borderRadius:3,background:pacing.diff<-15?'var(--amber)':'var(--green)',width:`${Math.min(100,pacing.actualPct)}%`}}/>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:pacing.diff<-15?'var(--amber)':pacing.diff>15?'var(--blue-dk)':'var(--green-dk)'}}>
                      {pacing.diff<-5?`⚠ Underpacing by ${Math.abs(pacing.diff).toFixed(0)}%`:pacing.diff>5?`✓ Ahead by ${pacing.diff.toFixed(0)}%`:'✓ On track'}
                    </div>
                  </div>
                )}
                {eta&&(
                  <div style={{flex:1,minWidth:180,padding:'9px 12px',borderRadius:8,background:eta.days<=5?'var(--red-lt)':eta.days<=10?'var(--amber-lt)':'var(--green-lt)',border:`1px solid ${eta.days<=5?'var(--red-bd)':eta.days<=10?'var(--amber-bd)':'var(--green-bd)'}`}}>
                    <div style={{fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>⏱ Budget Exhaustion ETA</div>
                    <div style={{fontSize:12,color:'var(--text2)',marginBottom:4}}>Remaining: <b>{S}{Math.round(activeCampBudgetRemaining).toLocaleString('en-IN')}</b></div>
                    <div style={{fontSize:12,color:'var(--text2)',marginBottom:4}}>Daily burn: <b>{S}{Math.round(todaySpend).toLocaleString('en-IN')}</b></div>
                    <div style={{fontSize:13,fontWeight:700,color:eta.days<=5?'var(--red)':eta.days<=10?'var(--amber)':'var(--green-dk)'}}>
                      {eta.days<=0?'🚨 Budget exhausted!':eta.days===1?'🚨 Exhausts today!':eta.days<=5?`🚨 Exhausts in ${eta.days} days`:eta.days<=10?`⚠ ~${eta.days} days left`:`✓ ~${eta.days} days left`}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campaign table */}
            {camps.length===0&&<div className="no-data-box">No active/paused campaigns found for this period.</div>}
            {camps.length>0&&(
              <table className="camp-tbl">
                <thead><tr>
                  <th>Campaign</th><th>Obj</th><th>Budget</th><th>Start</th><th>End</th>
                  <th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {camps.map((c,i)=>{
                    const ci=c.ins, cs=campStatus(c)
                    const cS=parseFloat(ci?.spend||0), cCtr=parseFloat(ci?.ctr||0), cFreq=parseFloat(ci?.frequency||0)
                    const cRes=parseResults(ci,cl.currency)
                    const bgt=fmtBudget(c,SYM(cl.currency))
                    return (
                      <tr key={c.id||i}>
                        <td>
                          <b style={{color:'var(--blue-dk)',cursor:'pointer'}} onClick={()=>openMeta('campaign',{accountId:cl.accountId,campId:c.id})}>{c.name}</b>
                          <span style={{fontSize:9,color:'var(--text3)',marginLeft:4}}>↗</span>
                        </td>
                        <td><span className={`obj-b ${objCls(c.objective)}`}>{objLabel(c.objective)}</span></td>
                        <td style={{fontFamily:'JetBrains Mono',fontSize:11,whiteSpace:'nowrap'}}>
                          {bgt.label!=='—'?<>{bgt.label}<span style={{fontSize:9,color:'var(--text3)',marginLeft:3}}>{bgt.type}</span></>:'—'}
                        </td>
                        <td style={{fontSize:11,color:'var(--text2)',whiteSpace:'nowrap'}}>{fmtDate(c.start_time)}</td>
                        <td style={{fontSize:11,whiteSpace:'nowrap'}}>{c.stop_time?<span style={{color:'var(--amber)'}}>{fmtDate(c.stop_time)}</span>:<span style={{color:'var(--green-dk)',fontSize:10}}>Ongoing</span>}</td>
                        <td style={{fontFamily:'JetBrains Mono',fontSize:11}}>{ci?fmtSpend(cS,SYM(cl.currency)):'—'}</td>
                        <td style={{color:CC[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                        <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>{cCtr>0?cCtr.toFixed(2)+'%':'—'}</td>
                        <td style={cFreq>=2.5?{color:'var(--red)',fontWeight:600}:cFreq>=2?{color:'var(--amber)'}:{}}>{cFreq>0?cFreq.toFixed(2):'—'}</td>
                        <td><div className="st-ind"><div className={`st-dot ${cs.dot}`}/>{cs.label}</div></td>
                        <td>
                          <button onClick={()=>setDrillCamp(c)}
                            style={{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:5,border:'1px solid var(--green-bd)',background:'var(--green-lt)',color:'var(--green-dk)',cursor:'pointer',whiteSpace:'nowrap'}}>
                            Drill In →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Insight boxes */}
            {ins&&!ins._err&&(
              <div className="insight-row">
                <div className="insight-box ib-trend">
                  <div className="ib-ttl">📡 Live — {activeDateLabel}</div>
                  <div className="ib-item">Spend: <b>{fmtSpend(spend,S)}</b> · Reach: <b>{fmtNum(reach)}</b> · Impressions: <b>{fmtNum(impr)}</b></div>
                  <div className="ib-item">CTR: <b>{ctr>0?ctr.toFixed(2)+'%':'—'}</b> · CPM: <b>{cpm>0?S+cpm.toFixed(0):'—'}</b> · Freq: <b>{freq>0?freq.toFixed(2):'—'}</b></div>
                  {res.text!=='—'&&<div className="ib-item">Top Result: <b>{res.text}</b></div>}
                </div>
                {accInfo&&(
                  <div className="insight-box ib-reco">
                    <div className="ib-ttl">💳 Billing</div>
                    <div className="ib-item">Type: <b>{isPrepaid?'Prepaid':fundingType?'Auto (Credit/Debit)':'—'}</b></div>
                    {bal!==null&&<div className="ib-item">Balance: <b>{S}{bal.toLocaleString('en-IN',{maximumFractionDigits:0})}</b> <span style={{fontSize:10,color:'var(--text3)'}}>{isPrepaid?'(prepaid funds)':'(account balance)'}</span></div>}
                    <div className="ib-item">Last top-up: <b>{lastTopUp?new Date(lastTopUp).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'}</b></div>
                    <div className="ib-item" style={{fontSize:10,marginTop:2}}>
                      <a href={`https://business.facebook.com/billing_hub/payment_activity?act=${cl.accountId}`} target="_blank" rel="noopener" style={{color:'var(--blue-dk)'}}>View billing history →</a>
                    </div>
                  </div>
                )}
                {freq>=2&&<div className="insight-box ib-warn"><div className="ib-ttl">⚠ Frequency Alert</div><div className="ib-item">Freq <b>{freq.toFixed(2)}</b> — {freq>=2.5?'audience fatigue, refresh creative':'approaching fatigue, monitor'}</div></div>}
                {spend===0&&impr===0&&<div className="insight-box ib-err"><div className="ib-ttl">🚨 No Spend</div><div className="ib-item">Zero delivery in {activeDateLabel}. Check account status and billing.</div></div>}
              </div>
            )}

            {/* Raw debug */}
            {showRaw&&<RawDebug entry={entry} cl={cl}/>}
          </div>
        )}
      </div>
    </>
  )
}

// ── Raw Debug ─────────────────────────────────────────────────────────────────
function RawDebug({ entry, cl }) {
  if (!entry) return null
  const acc=entry.accInfo, ins=entry.ins, camps=entry.campaigns||[]
  return (
    <div style={{margin:'10px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:11,background:'#f8f9fa',border:'1px solid var(--border)',borderRadius:8,padding:12,overflowX:'auto'}}>
      <div style={{fontWeight:700,color:'#555',marginBottom:6}}>📦 Account raw fields</div>
      {acc?<table style={{borderCollapse:'collapse',width:'100%',marginBottom:12}}>
        <thead><tr style={{background:'#eee'}}>{['Field','Raw Value','Interpreted'].map(h=><th key={h} style={{padding:'3px 8px',textAlign:'left',fontSize:11}}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            {f:'balance',r:acc.balance,n:`÷100 = ${(parseFloat(acc.balance||0)/100).toFixed(2)} ${cl.currency}`},
            {f:'amount_spent',r:acc.amount_spent,n:`÷100 = ${(parseFloat(acc.amount_spent||0)/100).toFixed(2)} ${cl.currency}`},
            {f:'spend_cap',r:acc.spend_cap,n:acc.spend_cap?`÷100 = ${(parseFloat(acc.spend_cap||0)/100).toFixed(2)} ${cl.currency}`:'Not set'},
            {f:'account_status',r:acc.account_status,n:{1:'Active',2:'Disabled',3:'Unsettled',7:'Pending',9:'Grace Period',101:'Closed'}[acc.account_status]||'Unknown'},
            {f:'currency',r:acc.currency,n:'—'},
          ].map(r=>(
            <tr key={r.f} style={{borderBottom:'1px solid #eee'}}>
              <td style={{padding:'3px 8px',color:'#7DC242',fontWeight:600}}>{r.f}</td>
              <td style={{padding:'3px 8px',color:'#333'}}>{String(r.r??'—')}</td>
              <td style={{padding:'3px 8px',color:'#888'}}>{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>:<div style={{color:'#999',marginBottom:12}}>Account data not loaded</div>}
      <div style={{fontWeight:700,color:'#555',marginBottom:6}}>📊 Insights raw</div>
      <pre style={{background:'#fff',padding:8,borderRadius:6,border:'1px solid #eee',fontSize:10,overflowX:'auto',marginBottom:12}}>{JSON.stringify(ins||'No insights',null,2)}</pre>
      <div style={{fontWeight:700,color:'#555',marginBottom:6}}>💰 Campaign budgets raw</div>
      <table style={{borderCollapse:'collapse',width:'100%'}}>
        <thead><tr style={{background:'#eee'}}>{['Campaign','daily_budget','lifetime_budget','÷100 daily','÷100 lifetime','start','stop'].map(h=><th key={h} style={{padding:'3px 8px',textAlign:'left',fontSize:10,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
        <tbody>
          {camps.map((c,i)=>(
            <tr key={i} style={{borderBottom:'1px solid #eee'}}>
              <td style={{padding:'3px 8px',color:'#7DC242',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</td>
              <td style={{padding:'3px 8px'}}>{c.daily_budget??'—'}</td>
              <td style={{padding:'3px 8px'}}>{c.lifetime_budget??'—'}</td>
              <td style={{padding:'3px 8px',fontWeight:600}}>{c.daily_budget?(parseFloat(c.daily_budget)/100).toFixed(0):'—'}</td>
              <td style={{padding:'3px 8px',fontWeight:600}}>{c.lifetime_budget?(parseFloat(c.lifetime_budget)/100).toFixed(0):'—'}</td>
              <td style={{padding:'3px 8px',color:'#888'}}>{c.start_time?new Date(c.start_time).toLocaleDateString('en-IN'):'—'}</td>
              <td style={{padding:'3px 8px',color:c.stop_time?'#d97706':'#888'}}>{c.stop_time?new Date(c.stop_time).toLocaleDateString('en-IN'):'Ongoing'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Campaigns Table View ──────────────────────────────────────────────────────
function CampaignsView({ cache, filter, activeDateLabel, dateParams }) {
  const [drillCamp, setDrillCamp] = useState(null)
  const [drillClient, setDrillClient] = useState(null)
  const CC = {green:'var(--green-dk)',red:'var(--red)',amber:'var(--amber)'}
  const clients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)
  const rows = clients.flatMap(cl=>{
    const entry=cache[cl.key]; if(!entry) return []
    return (entry.campaigns||[]).map(c=>({
      camp:c, campName:c.name, accName:cl.name, accId:cl.accountId, campId:c.id,
      obj:c.objective, ins:c.ins, status:campStatus(c), currency:cl.currency, S:SYM(cl.currency),
      daily_budget:c.daily_budget, lifetime_budget:c.lifetime_budget, start_time:c.start_time, stop_time:c.stop_time,
      cl
    }))
  }).sort((a,b)=>parseFloat(b.ins?.spend||0)-parseFloat(a.ins?.spend||0))

  return (
    <div>
      {drillCamp&&drillClient&&<CampaignDrillDown camp={drillCamp} accountId={drillClient.accountId} currency={drillClient.currency} dateParams={dateParams} onClose={()=>{setDrillCamp(null);setDrillClient(null)}}/>}
      <div className="sec-hdr">
        <div className="sec-ttl">Active &amp; Paused Campaigns <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <span style={{fontSize:11,color:'var(--text3)'}}>{rows.length} campaigns</span>
      </div>
      {rows.length>0?(
        <div className="tbl-wrap">
          <table className="all-camp-tbl">
            <thead><tr>
              <th>Campaign</th><th>Account</th><th>Obj</th><th>Budget</th><th>Start</th><th>End</th>
              <th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const cS=parseFloat(r.ins?.spend||0), cCtr=parseFloat(r.ins?.ctr||0), cFr=parseFloat(r.ins?.frequency||0)
                const cRes=parseResults(r.ins,r.currency), bgt=fmtBudget(r,r.S)
                return (
                  <tr key={i}>
                    <td><b style={{color:'var(--blue-dk)',cursor:'pointer'}} onClick={()=>openMeta('campaign',{accountId:r.accId,campId:r.campId})}>{r.campName}</b> <span style={{fontSize:9,color:'var(--text3)'}}>↗</span></td>
                    <td style={{color:'var(--text2)',fontSize:11}}>{r.accName}</td>
                    <td><span className={`obj-b ${objCls(r.obj)}`}>{objLabel(r.obj)}</span></td>
                    <td style={{fontFamily:'JetBrains Mono',fontSize:11,whiteSpace:'nowrap'}}>
                      {bgt.label!=='—'?<>{bgt.label}<span style={{fontSize:9,color:'var(--text3)',marginLeft:3}}>{bgt.type}</span></>:'—'}
                    </td>
                    <td style={{fontSize:11,color:'var(--text2)',whiteSpace:'nowrap'}}>{fmtDate(r.start_time)}</td>
                    <td style={{fontSize:11,whiteSpace:'nowrap'}}>{r.stop_time?<span style={{color:'var(--amber)'}}>{fmtDate(r.stop_time)}</span>:<span style={{color:'var(--green-dk)',fontSize:10}}>Ongoing</span>}</td>
                    <td style={{fontFamily:'JetBrains Mono',fontSize:11}}>{r.ins?fmtSpend(cS,r.S):'—'}</td>
                    <td style={{color:CC[cRes.cls]||'var(--text2)',fontWeight:cRes.cls?600:400}}>{cRes.text}</td>
                    <td style={cCtr>=1.5?{color:'var(--green-dk)'}:cCtr>0&&cCtr<0.8?{color:'var(--red)'}:{}}>{cCtr>0?cCtr.toFixed(2)+'%':'—'}</td>
                    <td style={cFr>=2.5?{color:'var(--red)',fontWeight:600}:cFr>=2?{color:'var(--amber)'}:{}}>{cFr>0?cFr.toFixed(2):'—'}</td>
                    <td><div className="st-ind"><div className={`st-dot ${r.status.dot}`}/>{r.status.label}</div></td>
                    <td>
                      <button onClick={()=>{setDrillCamp(r.camp);setDrillClient(r.cl)}}
                        style={{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:5,border:'1px solid var(--green-bd)',background:'var(--green-lt)',color:'var(--green-dk)',cursor:'pointer',whiteSpace:'nowrap'}}>
                        Drill In →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ):(
        <div className="no-data-box">No campaigns found for this period.</div>
      )}
    </div>
  )
}

// ── Alerts View ───────────────────────────────────────────────────────────────
function AlertsView({ cache, filter, activeDateLabel }) {
  const clients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)
  const [showOldRejected, setShowOldRejected] = useState(false)
  const results={rejected:[],billing:[],noSpend:[],highFreq:[],topPerf:[]}

  // Build billing overview rows
  const billingOverview = clients.map(cl=>{
    const entry=cache[cl.key]; if(!entry||!entry.accInfo) return null
    const S=SYM(cl.currency)
    const acc=entry.accInfo
    const bal = entry.balance ?? 0
    const isPrepaid = entry.isPrepaid || false
    const lastTopUp = entry.lastTopUp
    const spent = parseFloat(acc.amount_spent||0)/100
    const cap = acc.spend_cap ? parseFloat(acc.spend_cap)/100 : null
    const capPct = cap&&cap>0 ? (spent/cap)*100 : null
    return{cl,S,bal,isPrepaid,lastTopUp,spent,cap,capPct,status:acc.account_status,fundingType:entry.fundingType}
  }).filter(Boolean)

  clients.forEach(cl=>{
    const entry=cache[cl.key]; if(!entry) return
    const S=SYM(cl.currency)
    entry.alerts.rejected.forEach(a=>results.rejected.push({...a,client:cl.name,key:cl.key,accountId:cl.accountId}))
    entry.alerts.billing.forEach(a=>results.billing.push({...a,client:cl.name,key:cl.key,accountId:cl.accountId}))
    if(entry.alerts.noSpend) results.noSpend.push({client:cl.name,key:cl.key,accountId:cl.accountId})
    entry.alerts.highFreq.forEach(a=>results.highFreq.push({...a,client:cl.name,key:cl.key,accountId:cl.accountId}))
    entry.topPerf.forEach(a=>results.topPerf.push({...a,client:cl.name,key:cl.key,accountId:cl.accountId}))
  })
  results.topPerf.sort((a,b)=>a.cpa-b.cpa)
  const activeRejected=results.rejected.filter(a=>a.severity!=='old')
  const oldRejected=results.rejected.filter(a=>a.severity==='old')
  const totalCritical=activeRejected.filter(a=>a.severity==='r').length+results.billing.filter(b=>b.severity==='r').length+results.noSpend.length
  const totalWarn=results.billing.filter(b=>b.severity==='a').length+results.highFreq.length

  // Token expiry alert
  const daysLeft = tokenDaysLeft()

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Alerts &amp; Recommendations <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <div style={{display:'flex',gap:6}}>
          {totalCritical>0&&<span className="pill pill-r">🚨 {totalCritical} Critical</span>}
          {totalWarn>0&&<span className="pill pill-a">⚠ {totalWarn} Warnings</span>}
          {totalCritical===0&&totalWarn===0&&<span className="pill pill-g">✓ All Clear</span>}
        </div>
      </div>

      {/* Token expiry */}
      {daysLeft<=60&&(
        <div className="alerts-panel" style={{marginBottom:14}}>
          <div className="ap-hdr"><span style={{fontSize:13,fontWeight:700}}>🔑 Meta Access Token Expiry</span>
            <span className={`pill ${daysLeft<=14?'pill-r':daysLeft<=30?'pill-a':'pill-b'}`}>{daysLeft} days left</span></div>
          <div className="alert-row">
            <div className={`ar-ico ${daysLeft<=14?'r':daysLeft<=30?'a':'b'}`}>{daysLeft<=14?'🚨':daysLeft<=30?'⚠️':'ℹ️'}</div>
            <div className="ar-body">
              <div className="ar-ttl">Token expires on {TOKEN_EXPIRY.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
              <div className="ar-sub">{daysLeft<=14?'Renew immediately — dashboard will break without a valid token.':daysLeft<=30?'Plan to renew soon. Get new token from Meta Business Manager.':'Heads up: token will expire in 2 months. Note in calendar.'}</div>
            </div>
            <button className="ar-btn" onClick={()=>window.open('https://developers.facebook.com/tools/accesstoken/','_blank','noopener')}>Renew Token →</button>
          </div>
        </div>
      )}

      {/* Rejected ads */}
      <div className="alerts-panel">
        <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🚫 Rejected / Disapproved Ads</span>
          <span className={`pill ${activeRejected.length>0?'pill-r':'pill-g'}`}>{activeRejected.length>0?`${activeRejected.length} Rejected`:'✓ None'}</span>
        </div>
        {activeRejected.length===0
          ?<div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No disapproved or rejected ads</div><div className="ar-sub">All active ads are approved.</div></div></div>
          :activeRejected.map((a,i)=>(
            <div key={i} className="alert-row">
              <div className="ar-ico r">{a.severity==='r'?'🚫':'⚠️'}</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — Ad Rejected: "{a.adName}"</div><div className="ar-sub">Status: <b>{a.status}</b> · {a.reason} · <i>Rejected: {a.createdTime?new Date(a.createdTime).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'unknown'}</i></div></div>
              <span className="ar-tag">{a.client}</span>
              <span className="ar-lift" style={{background:'var(--red-lt)',color:'var(--red)',borderColor:'var(--red-bd)'}}>Fix Required</span>
              <button className="ar-btn" onClick={()=>openMeta('ad',{accountId:a.accountId,adId:a.adId})}>Review in Meta →</button>
            </div>
          ))}
        {oldRejected.length>0&&(
          <div style={{borderTop:'1px solid #eee',padding:'8px 14px'}}>
            <button onClick={()=>setShowOldRejected(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#999',display:'flex',alignItems:'center',gap:6}}>
              {showOldRejected?'▲':'▼'} {oldRejected.length} older rejection{oldRejected.length>1?'s':''} hidden (&gt;72 hrs)
            </button>
            {showOldRejected&&oldRejected.map((a,i)=>(
              <div key={i} className="alert-row" style={{opacity:.5}}>
                <div className="ar-ico" style={{color:'#bbb'}}>⚫</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — Ad Rejected: "{a.adName}"</div><div className="ar-sub">Status: <b>{a.status}</b> · {a.reason}</div></div>
                <span className="ar-tag">{a.client}</span>
                <button className="ar-btn" onClick={()=>openMeta('ad',{accountId:a.accountId,adId:a.adId})}>Review →</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing Overview Table */}
      <div className="alerts-panel">
        <div className="ap-hdr" style={{background:'rgba(41,171,226,0.03)'}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>💳 Billing Overview — All Accounts</span>
          <span className={`pill ${results.billing.length>0?'pill-r':'pill-g'}`}>{results.billing.length>0?`${results.billing.length} Issues`:'✓ All Healthy'}</span>
        </div>
        {billingOverview.length>0?(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'var(--bg)'}}>
                {['Account','Type','Balance','Last Top-up','Spend Cap','Status'].map(h=>(
                  <th key={h} style={{padding:'7px 13px',textAlign:'left',fontSize:9,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid var(--border)'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {billingOverview.map((r,i)=>{
                  return (
                    <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                      <td style={{padding:'8px 13px',fontWeight:600,color:'var(--text)'}}>{r.cl.name.split(' ').slice(0,2).join(' ')}</td>
                      <td style={{padding:'8px 13px',color:'var(--text2)'}}>{r.isPrepaid?'Prepaid':r.fundingType?'Auto (Credit/Debit)':'—'}</td>
                      <td style={{padding:'8px 13px',fontFamily:'JetBrains Mono',fontSize:11,color:'var(--text)'}}>
                        {r.S}{r.bal.toLocaleString('en-IN',{maximumFractionDigits:0})}
                        <span style={{marginLeft:5,fontSize:9,color:'var(--text3)'}}>{r.isPrepaid?'prepaid':'balance'}</span>
                      </td>
                      <td style={{padding:'8px 13px',color:'var(--text2)',fontSize:11}}>
                        {r.lastTopUp ? new Date(r.lastTopUp).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : <span style={{color:'var(--text3)'}}>—</span>}
                      </td>
                      <td style={{padding:'8px 13px',fontSize:11}}>
                        {r.cap ? (
                          <span style={{color:r.capPct>=95?'var(--red)':r.capPct>=85?'var(--amber)':'var(--text2)'}}>
                            {r.capPct?.toFixed(0)}% <span style={{color:'var(--text3)',fontSize:10}}>({r.S}{Math.round(r.spent).toLocaleString('en-IN')} / {r.S}{Math.round(r.cap).toLocaleString('en-IN')})</span>
                          </span>
                        ) : <span style={{color:'var(--text3)'}}>No cap</span>}
                      </td>
                      <td style={{padding:'8px 13px'}}>
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:4,
                          background:r.status===1?'var(--green-lt)':'var(--red-lt)',
                          color:r.status===1?'var(--green-dk)':'var(--red)',
                          border:`1px solid ${r.status===1?'var(--green-bd)':'var(--red-bd)'}`}}>
                          {r.status===1?'Active':'Issue'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ):<div className="no-data-box">Loading billing data…</div>}
        {results.billing.length>0&&(
          <div style={{borderTop:'1px solid var(--border)',padding:'4px 0'}}>
            {results.billing.map((a,i)=>(
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.severity}`}>{a.severity==='r'?'🚨':'⚠️'}</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — {a.status}</div><div className="ar-sub">{a.detail}</div></div>
                <span className="ar-tag">{a.client}</span>
                <button className="ar-btn" onClick={()=>openMeta(a.type==='balance'||a.type==='spend_cap'?'billing':'campaign',{accountId:a.accountId})}>Fix in Meta →</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {results.noSpend.length>0&&(
        <div className="alerts-panel">
          <div className="ap-hdr" style={{background:'rgba(224,82,82,0.03)'}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>💸 Zero Spend — {activeDateLabel}</span>
            <span className="pill pill-r">{results.noSpend.length} Accounts</span>
          </div>
          {results.noSpend.map((a,i)=>(
            <div key={i} className="alert-row">
              <div className="ar-ico r">💸</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — No spend in {activeDateLabel}</div><div className="ar-sub">Zero ad delivery. Check campaigns are active and billing is correct.</div></div>
              <span className="ar-tag">{a.client}</span>
              <button className="ar-btn" onClick={()=>openMeta('campaign',{accountId:a.accountId})}>Check Account →</button>
            </div>
          ))}
        </div>
      )}

      <div className="alerts-panel">
        <div className="ap-hdr" style={{background:'rgba(217,119,6,0.03)'}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>🔁 High Frequency — Audience Fatigue Risk</span>
          <span className={`pill ${results.highFreq.length>0?'pill-a':'pill-g'}`}>{results.highFreq.length>0?`${results.highFreq.length} Ad Sets`:'✓ All Good'}</span>
        </div>
        {results.highFreq.length===0
          ?<div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No high-frequency ad sets</div><div className="ar-sub">All ad sets are below 2.5 frequency threshold.</div></div></div>
          :results.highFreq.map((a,i)=>(
            <div key={i} className="alert-row">
              <div className={`ar-ico ${a.severity}`}>{a.severity==='r'?'🚨':'⚠️'}</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — Frequency {a.freq} {parseFloat(a.freq)>=3?'· Audience Burnt':'· Fatigue Risk'}</div><div className="ar-sub">Spend {a.spend} at freq {a.freq}. {parseFloat(a.freq)>=3?'Pause and refresh creative immediately.':'Consider refreshing creative or expanding audience.'}</div></div>
              <span className="ar-tag">{a.client}</span>
              <span className={a.severity==='r'?'chip-r':'chip-a'}>Freq {a.freq}</span>
              <button className="ar-btn" onClick={()=>openMeta('adset',{accountId:a.accountId,adsetId:a.adsetId})}>Refresh Creative →</button>
            </div>
          ))}
      </div>

      {results.topPerf.length>0&&(
        <div className="alerts-panel">
          <div className="ap-hdr" style={{background:'rgba(125,194,66,0.03)'}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>📈 Top Performing Campaigns — {activeDateLabel}</span>
            <span className="pill pill-g">{results.topPerf.length} with Results</span>
          </div>
          {results.topPerf.slice(0,8).map((a,i)=>(
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
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function DashboardInner() {
  const [view, setView] = useState('accounts')
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('Today')
  const [customFrom, setFrom] = useState('')
  const [customTo, setTo] = useState('')
  const [customLabel, setCustLbl] = useState('')
  const [cache, setCache] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [fetchKey, setFetchKey] = useState(0)
  const [lastFetched, setLastFetched] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]
  const activeDateLabel = dateRange==='custom' ? customLabel : dateRange
  const dateParams = getDateParams(dateRange, customFrom, customTo)
  const daysLeft = tokenDaysLeft()

  useEffect(() => {
    let cancelled=false
    setCache(null); setRefreshing(true)
    setLoadingMsg(`Loading data for all ${CLIENTS.length} accounts…`)
    fetchAllData(dateParams).then(data=>{
      if(cancelled) return
      setCache(data); setLastFetched(new Date()); setRefreshing(false); setLoadingMsg('')
    }).catch(()=>{ if(!cancelled){setRefreshing(false);setLoadingMsg('Failed to load. Click Refresh to retry.')} })
    return ()=>{ cancelled=true }
  }, [JSON.stringify(dateParams), fetchKey])

  const filteredClients = filter==='all' ? CLIENTS : CLIENTS.filter(c=>c.key===filter)
  const filteredEntries = filteredClients.map(c=>cache?.[c.key]?.ins).filter(d=>d&&!d._err)
  const totalSpend = filteredEntries.reduce((s,d)=>s+parseFloat(d?.spend||0),0)
  const totalImpr = filteredEntries.reduce((s,d)=>s+parseInt(d?.impressions||0),0)
  const totalReach = filteredEntries.reduce((s,d)=>s+parseInt(d?.reach||0),0)
  const totalClicks = filteredEntries.reduce((s,d)=>s+parseInt(d?.clicks||0),0)
  const ctrVals = filteredEntries.filter(d=>parseFloat(d?.ctr||0)>0)
  const avgCtr = ctrVals.length ? ctrVals.reduce((s,d)=>s+parseFloat(d.ctr||0),0)/ctrVals.length : 0
  const activeCount = filteredClients.filter(c=>{const d=cache?.[c.key]?.ins;return d&&!d._err&&parseFloat(d.spend||0)>0}).length
  const statsReady = cache!==null
  const isFiltered = filter!=='all'
  const filterName = isFiltered ? CLIENTS.find(c=>c.key===filter)?.name?.split(' ').slice(0,2).join(' ') : null

  const issueMap = {}
  CLIENTS.forEach(c=>{
    if(!cache?.[c.key]){issueMap[c.key]=0;return}
    const a=cache[c.key].alerts
    issueMap[c.key]=a.rejected.filter(r=>r.severity!=='old').length+a.billing.length+(a.noSpend?1:0)+a.highFreq.length
  })

  const sidebar = [
    {section:'All Clients'},{key:'all',dot:'g',name:'All Accounts'},
    {section:'By Account',mt:true},
    ...CLIENTS.map(cl=>{
      const ins=cache?.[cl.key]?.ins, spend=ins?parseFloat(ins.spend||0):null, freq=ins?parseFloat(ins.frequency||0):0
      const dot=!cache?'e':ins?._err?'r':spend>0?freq>=2.5?'r':freq>=2?'a':'g':'e'
      const score=ins&&!ins._err&&spend>0?(()=>{const ct=parseFloat(ins.ctr||0),f=parseFloat(ins.frequency||0);let s=70;if(ct>=2)s+=10;else if(ct>=1.5)s+=5;else if(ct<0.5)s-=10;if(f>=3)s-=20;else if(f>=2.5)s-=12;else if(f>=2)s-=5;return Math.max(0,Math.min(100,Math.round(s)))})():null
      const scoreCls=!score?'sc-na':score>=75?'sc-hi':score>=60?'sc-md':'sc-lo'
      return{key:cl.key,dot,name:cl.name,score,scoreCls,issues:issueMap[cl.key]||0}
    })
  ]

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
          {daysLeft<=30&&<span className={`pill ${daysLeft<=14?'pill-r':'pill-a'}`}>🔑 Token {daysLeft}d</span>}
          {statsReady&&isFiltered&&<span className="pill pill-b">🔍 {filterName}</span>}
          {statsReady&&<span className="pill pill-g">● {activeCount} Spending</span>}
          {statsReady&&<span className="pill pill-b">{fmtSpend(totalSpend)}</span>}
          {lastFetched&&<span style={{fontSize:10,color:'var(--text3)',marginRight:4}}>Updated {lastFetched.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button className="refresh-btn" onClick={()=>setFetchKey(k=>k+1)} disabled={refreshing} style={{opacity:refreshing?.6:1}}>
            {refreshing?'↻ Loading…':'↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="sidebar">
        {sidebar.map((item,i)=>{
          if(item.section) return<div key={i} className="sb-section" style={item.mt?{marginTop:4}:{}}>{item.section}</div>
          if(item.key==='all') return(
            <div key="all" className={`sb-item${filter==='all'?' active':''}`} onClick={()=>setFilter('all')}>
              <div className="sb-dot g"/><span className="sb-name">All Accounts</span>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                {Object.values(issueMap).reduce((s,n)=>s+n,0)>0&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,background:'var(--red-lt)',color:'var(--red)',border:'1px solid var(--red-bd)'}}>!{Object.values(issueMap).reduce((s,n)=>s+n,0)}</span>}
                <span className="sb-score sc-na">{CLIENTS.length}</span>
              </div>
            </div>
          )
          return(
            <div key={item.key} className={`sb-item${filter===item.key?' active':''}`} onClick={()=>setFilter(item.key)}>
              <div className={`sb-dot ${item.dot}`}/>
              <span className="sb-name">{item.name.length>20?item.name.slice(0,20)+'…':item.name}</span>
              <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                {item.issues>0&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,background:'var(--red-lt)',color:'var(--red)',border:'1px solid var(--red-bd)'}}>!{item.issues}</span>}
                <span className={`sb-score ${item.scoreCls}`}>{item.score??'—'}</span>
              </div>
            </div>
          )
        })}
        <div className="sb-section" style={{marginTop:6}}>Live Status</div>
        <div className="sb-info">
          📅 {activeDateLabel}<br/>
          🔗 Meta API · <span style={{color:'var(--green-dk)'}}>Connected</span><br/>
          🔑 Token: <span style={{color:daysLeft<=14?'var(--red)':daysLeft<=30?'var(--amber)':'var(--green-dk)'}}>{daysLeft}d left</span><br/>
          {statsReady&&<>
            {isFiltered&&<><b style={{color:'var(--blue-dk)'}}>🔍 {filterName}</b><br/></>}
            💰 Spend: <b>{fmtSpend(totalSpend)}</b><br/>
            📊 Impr: <b>{fmtNum(totalImpr)}</b><br/>
            🖱 Clicks: <b>{fmtNum(totalClicks)}</b><br/>
            {!isFiltered&&<>✅ {activeCount}/{CLIENTS.length} spending</>}
          </>}
        </div>
      </div>

      <div className="statsbar">
        {refreshing?(
          <div className="kpi-pill kpi-n"><Spinner size={11}/><span className="kpi-lbl" style={{marginLeft:4}}>{loadingMsg}</span></div>
        ):statsReady?<>
          {isFiltered&&<div className="kpi-pill kpi-b" style={{borderColor:'var(--blue-bd)',background:'var(--blue-lt)'}}><div className="kpi-dot"/><span className="kpi-lbl">Filter</span><span className="kpi-val" style={{fontSize:11,maxWidth:90,overflow:'hidden',textOverflow:'ellipsis'}}>{filterName}</span></div>}
          <div className="kpi-pill kpi-g"><div className="kpi-dot"/><span className="kpi-lbl">Spend</span><span className="kpi-val">{fmtSpend(totalSpend)}</span></div>
          <div className="kpi-pill kpi-b"><div className="kpi-dot"/><span className="kpi-lbl">Impressions</span><span className="kpi-val">{fmtNum(totalImpr)}</span></div>
          <div className="kpi-pill kpi-n"><div className="kpi-dot"/><span className="kpi-lbl">Reach</span><span className="kpi-val">{fmtNum(totalReach)}</span></div>
          <div className="kpi-pill kpi-n"><div className="kpi-dot"/><span className="kpi-lbl">Clicks</span><span className="kpi-val">{fmtNum(totalClicks)}</span></div>
          {avgCtr>0&&<div className={`kpi-pill ${avgCtr>=1.5?'kpi-g':avgCtr<0.8?'kpi-r':'kpi-n'}`}><div className="kpi-dot"/><span className="kpi-lbl">Avg CTR</span><span className="kpi-val">{avgCtr.toFixed(2)}%</span></div>}
          {!isFiltered&&<><div className="sb-sep"/><div className="kpi-pill kpi-g"><div className="kpi-dot"/><span className="kpi-lbl">Spending</span><span className="kpi-val">{activeCount}/{CLIENTS.length}</span></div></>}
        </>:<div className="kpi-pill kpi-n"><Spinner size={11}/><span className="kpi-lbl" style={{marginLeft:4}}>Loading live data…</span></div>}
        <div className="sb-sep"/>
        <div className="date-grp">
          {['Today','Yesterday','Last 7D','14D','30D','This Month'].map(d=>(
            <button key={d} className={`dr${dateRange===d?' active':''}`} onClick={()=>setDateRange(d)}>{d}</button>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:4,background:dateRange==='custom'?'var(--green-lt)':'rgba(0,0,0,0.04)',border:dateRange==='custom'?'1px solid var(--green-bd)':'1px solid var(--border)',borderRadius:20,padding:'3px 10px'}}>
            <span style={{fontSize:10,fontWeight:600,color:dateRange==='custom'?'var(--green-dk)':'var(--text3)',whiteSpace:'nowrap'}}>From</span>
            <input type="date" max={customTo||todayStr} value={customFrom}
              onChange={e=>{setFrom(e.target.value);if(e.target.value&&customTo){const fmt=d=>{const[,m,dd]=d.split('-');return`${dd}/${m}`};setCustLbl(`${fmt(e.target.value)}–${fmt(customTo)}`);setDateRange('custom')}}}
              style={{fontFamily:'JetBrains Mono',fontSize:10,border:'none',background:'transparent',color:dateRange==='custom'?'var(--green-dk)':'var(--text)',outline:'none',cursor:'pointer',width:100}}/>
            <span style={{fontSize:10,fontWeight:600,color:dateRange==='custom'?'var(--green-dk)':'var(--text3)'}}>→</span>
            <input type="date" min={customFrom} max={todayStr} value={customTo}
              onChange={e=>{setTo(e.target.value);if(customFrom&&e.target.value){const fmt=d=>{const[,m,dd]=d.split('-');return`${dd}/${m}`};setCustLbl(`${fmt(customFrom)}–${fmt(e.target.value)}`);setDateRange('custom')}}}
              style={{fontFamily:'JetBrains Mono',fontSize:10,border:'none',background:'transparent',color:dateRange==='custom'?'var(--green-dk)':'var(--text)',outline:'none',cursor:'pointer',width:100}}/>
          </div>
        </div>
      </div>

      <div className="main-wrap"><div className="main">
        {refreshing&&(
          <div style={{textAlign:'center',padding:60,color:'var(--text3)'}}>
            <div style={{width:32,height:32,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 14px'}}/>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text2)',marginBottom:6}}>{loadingMsg}</div>
            <div style={{fontSize:11,opacity:.6}}>Fetching all accounts in parallel — this takes ~5–8 seconds</div>
          </div>
        )}
        {!refreshing&&cache&&<>
          <div style={{display:view==='accounts'?'block':'none'}}>
            <div className="sec-hdr">
              <div className="sec-ttl">Client Accounts <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span></div>
              <span style={{fontSize:11,color:'var(--text3)'}}>{filteredClients.length} accounts</span>
            </div>
            <div className="accounts">
              {CLIENTS.map(c=>(
                <AccCard key={c.key} cl={c} entry={cache[c.key]} activeDateLabel={activeDateLabel}
                  isVisible={filter==='all'||filter===c.key} dateParams={dateParams}/>
              ))}
            </div>
          </div>
          <div style={{display:view==='campaigns'?'block':'none'}}>
            <CampaignsView cache={cache} filter={filter} activeDateLabel={activeDateLabel} dateParams={dateParams}/>
          </div>
          <div style={{display:view==='alerts'?'block':'none'}}>
            <AlertsView cache={cache} filter={filter} activeDateLabel={activeDateLabel}/>
          </div>
        </>}
      </div></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}

export default function Dashboard() {
  const [unlocked, setUnlocked] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(()=>{
    setMounted(true)
    if(typeof window !== 'undefined' && sessionStorage.getItem('ma_auth')==='1') setUnlocked(true)
  },[])
  if(!mounted) return null
  if(!unlocked) return <PasswordGate onUnlock={()=>setUnlocked(true)}/>
  return <DashboardInner/>
}
