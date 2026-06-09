'use client'
import { useState, useEffect, useCallback } from 'react'

const PASSWORD = 'meraki2026'

function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const attempt = () => {
    if (input === PASSWORD) {
      sessionStorage.setItem('ma_auth', '1')
      onUnlock()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setTimeout(() => setError(false), 2000)
      setInput('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faf6', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', animation: shake ? 'shake 0.4s ease' : 'none' }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          <span style={{ color: '#7DC242' }}>meraki</span><span style={{ color: '#29ABE2' }}>ads</span>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 28, letterSpacing: 1 }}>META INTELLIGENCE · LIVE</div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', minWidth: 300 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 14 }}>Enter Password</div>
          <input
            type='password'
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            autoFocus
            placeholder='••••••••••'
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: error ? '1.5px solid #e05252' : '1.5px solid #d1d5db', fontSize: 15, outline: 'none', boxSizing: 'border-box', textAlign: 'center', letterSpacing: 4, background: error ? '#fff5f5' : '#fff', transition: 'border 0.2s' }}
          />
          {error && <div style={{ fontSize: 11, color: '#e05252', marginTop: 8 }}>Incorrect password. Try again.</div>}
          <button
            onClick={attempt}
            style={{ marginTop: 14, width: '100%', padding: '10px', background: '#7DC242', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}
          >Unlock Dashboard</button>
        </div>
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 16 }}>Meraki Ads Internal · Restricted Access</div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

const CLIENTS = [
  { key:'volvo',      name:'Volvo (Krishna — Meraki Ads)',         accountId:'833603637085666',  currency:'INR', vertical:'Automotive'    },
  { key:'north-old',  name:'North International (Old Account)',    accountId:'1297775434831152', currency:'INR', vertical:'Education'     },
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
function fmtSpend(n,s='₹'){const v=parseFloat(n||0);if(!v)return s+'0';return s+v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtNum(n){const v=parseFloat(n||0);if(!v)return '0';if(v>=1000000)return(v/1000000).toFixed(1)+'M';if(v>=1000)return(v/1000).toFixed(1)+'K';return Math.round(v).toString()}
function getDateParams(preset,cfrom,cto){
  if(preset==='Today')return{date_preset:'today'}
  if(preset==='Last 7D')return{date_preset:'last_7d'}
  if(preset==='14D')return{date_preset:'last_14d'}
  if(preset==='30D')return{date_preset:'last_30d'}
  if(preset==='This Month')return{date_preset:'this_month'}
  if(preset==='custom'&&cfrom&&cto)return{time_range:JSON.stringify({since:cfrom,until:cto})}
  return{date_preset:'today'}
}
function objLabel(o=''){
  const m={OUTCOME_LEADS:'LEADS',OUTCOME_SALES:'SALES',OUTCOME_AWARENESS:'AWARENESS',OUTCOME_ENGAGEMENT:'ENGAGEMENT',OUTCOME_TRAFFIC:'TRAFFIC',LEAD_GENERATION:'LEADS',CONVERSIONS:'SALES',MESSAGES:'LEADS',POST_ENGAGEMENT:'ENGAGEMENT',VIDEO_VIEWS:'AWARENESS',REACH:'AWARENESS',BRAND_AWARENESS:'AWARENESS',LINK_CLICKS:'TRAFFIC',PAGE_LIKES:'ENGAGEMENT',OUTCOME_APP_PROMOTION:'APP'}
  return m[o.toUpperCase().replace(/\s/g,'_')]||o||'—'
}
function objCls(o){const l=objLabel(o);return l==='LEADS'?'obj-leads':l==='SALES'?'obj-sales':l==='AWARENESS'?'obj-aware':l==='ENGAGEMENT'?'obj-eng':'obj-traffic'}
function campStatus(c){
  const s=(c.effective_status||c.status||'').toUpperCase()
  if(s==='ACTIVE')return{dot:'on',label:'Active'}
  if(s==='PAUSED')return{dot:'na',label:'Paused'}
  if(s==='ARCHIVED')return{dot:'na',label:'Archived'}
  if(s.includes('ERROR')||s.includes('DISAPPROVED'))return{dot:'off',label:'Error'}
  return{dot:'na',label:s||'—'}
}
function accStatus(code){
  if(code===1)return{cls:'ok',dot:'g',badge:'LIVE',badgeCls:'sb-live'}
  if(code===9)return{cls:'err',dot:'r',badge:'GRACE PERIOD',badgeCls:'sb-err'}
  if(code===2)return{cls:'err',dot:'r',badge:'DISABLED',badgeCls:'sb-err'}
  if(code===3)return{cls:'err',dot:'r',badge:'UNSETTLED',badgeCls:'sb-err'}
  if(code===7)return{cls:'warn',dot:'a',badge:'PENDING',badgeCls:'sb-warn'}
  if(code===101)return{cls:'off',dot:'e',badge:'CLOSED',badgeCls:'sb-off'}
  return{cls:'ok',dot:'g',badge:'LIVE',badgeCls:'sb-live'}
}
function parseResults(ins,currency){
  if(!ins)return{text:'—',cls:'',count:0}
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
  if(ins.reach&&parseInt(ins.reach)>0)return{text:`Reach ${fmtNum(ins.reach)}`,cls:'',count:0}
  if(spend>0)return{text:'Spend only',cls:'',count:0}
  return{text:'—',cls:'',count:0}
}

function fmtBudget(campaign, S) {
  // Meta returns budgets in subunits (paise/cents) — divide by 100
  if (campaign.daily_budget && parseFloat(campaign.daily_budget) > 0)
    return { label: S + Math.round(parseFloat(campaign.daily_budget) / 100).toLocaleString('en-IN'), type: 'Daily' }
  if (campaign.lifetime_budget && parseFloat(campaign.lifetime_budget) > 0)
    return { label: S + Math.round(parseFloat(campaign.lifetime_budget) / 100).toLocaleString('en-IN'), type: 'Lifetime' }
  return { label: '—', type: '' }
}
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function apiFetch(endpoint, params={}){
  const qs = new URLSearchParams({ endpoint })
  Object.entries(params).forEach(([k,v]) => qs.set(k, v))
  return fetch(`/api/meta?${qs}`).then(r => r.json())
}

// Meta deep links
function metaUrl(type,{accountId,campId,adsetId,adId}={}){
  const base='https://adsmanager.facebook.com/adsmanager/manage'
  const act=accountId?`?act=${accountId}`:''
  if(type==='billing')return`https://business.facebook.com/billing_hub/payment_activity${act}`
  if(type==='campaign')return campId?`${base}/campaigns${act}&selected_campaign_ids=${campId}`:`${base}/campaigns${act}`
  if(type==='adset')return adsetId?`${base}/adsets${act}&selected_adset_ids=${adsetId}`:`${base}/campaigns${act}`
  if(type==='ad')return adId?`${base}/ads${act}&selected_ad_ids=${adId}`:`${base}/ads${act}`
  return`${base}/campaigns${act}`
}
function openMeta(type,ids={}){window.open(metaUrl(type,ids),'_blank','noopener')}

function Spinner({size=14}){
  return<div style={{width:size,height:size,border:'2px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>
}

// ── Single top-level data fetcher ─────────────────────────────────────────────
// Fetches ALL data for all accounts in one pass. Returns structured cache object.
async function fetchAllData(dateParams) {
  const cache = {}

  // Max 4 concurrent requests
  const semaphore = (() => {
    let running = 0
    const queue = []
    const MAX = 4
    const run = () => {
      while (running < MAX && queue.length > 0) {
        const { fn, resolve, reject } = queue.shift()
        running++
        fn().then(v => { running--; run(); resolve(v) }).catch(e => { running--; run(); reject(e) })
      }
    }
    return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); run() })
  })()

  const fetch$ = (endpoint, params) => semaphore(() => apiFetch(endpoint, params))

  await Promise.all(CLIENTS.map(async cl => {
    const S = SYM(cl.currency)
    const entry = { cl, accInfo: null, ins: null, campaigns: [], alerts: { rejected: [], billing: [], noSpend: false, highFreq: [] }, topPerf: [] }

    try {
      const [accData, insData, campListData, campInsData, adsData, adsetInsData] = await Promise.all([
        // Account info
        fetch$(`act_${cl.accountId}`, { fields: 'name,account_status,currency,balance,spend_cap,amount_spent,disable_reason' }),
        // Account-level insights
        fetch$(`act_${cl.accountId}/insights`, { fields: INSIGHT_FIELDS, ...dateParams }),
        // Campaign list
        fetch$(`act_${cl.accountId}/campaigns`, {
          fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time',
          filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
          limit: '30'
        }),
        // Campaign-level insights
        fetch$(`act_${cl.accountId}/insights`, { fields: INSIGHT_FIELDS + ',campaign_id', level: 'campaign', limit: '30', ...dateParams }),
        // Disapproved ads
        fetch$(`act_${cl.accountId}/ads`, {
          fields: 'id,name,effective_status,ad_review_feedback,campaign_id,created_time',
          filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['DISAPPROVED', 'WITH_ISSUES'] }]),
          limit: '10'
        }),
        // Adset-level insights for frequency
        fetch$(`act_${cl.accountId}/insights`, { fields: 'spend,frequency,campaign_id,adset_id,actions,ctr', level: 'adset', limit: '50', ...dateParams }),
      ])

      // Account info
      if (!accData.error) {
        entry.accInfo = accData
        const statusMap = { 1: 'Active', 2: 'Disabled', 3: 'Unsettled', 7: 'Pending Review', 9: 'Grace Period', 100: 'Pending Closure', 101: 'Closed' }
        if (accData.account_status !== 1)
          entry.alerts.billing.push({ type: 'status', status: statusMap[accData.account_status] || `Status ${accData.account_status}`, detail: accData.disable_reason ? `Reason: ${accData.disable_reason}` : 'Fix in Meta Business Manager → Billing', severity: accData.account_status === 9 ? 'r' : 'a' })
        const bal = parseFloat(accData.balance || 0) / 100  // Meta returns balance in subunits (paise/cents)
        if (bal >= 0 && bal < 500 && accData.account_status === 1)
          entry.alerts.billing.push({ type: 'balance', status: 'Low Balance', detail: `Balance: ${S}${bal.toFixed(0)} — top up to prevent interruption`, severity: bal < 50 ? 'r' : 'a' })
        if (accData.spend_cap && parseFloat(accData.spend_cap) > 0) {
          const spent = parseFloat(accData.amount_spent || 0) / 100, cap = parseFloat(accData.spend_cap) / 100, pct = cap > 0 ? (spent / cap) * 100 : 0
          if (pct >= 85) entry.alerts.billing.push({ type: 'spend_cap', status: `Spend Cap ${pct.toFixed(0)}% Used`, detail: `${fmtSpend(spent, S)} of ${fmtSpend(cap, S)} used — increase cap`, severity: pct >= 95 ? 'r' : 'a' })
        }
      }

      // Insights
      entry.ins = insData.error ? { _err: insData.error.message || 'API Error' } : (insData.data?.[0] || null)

      // Campaigns
      if (campListData.data?.length) {
        const insMap = {}
        ;(campInsData.data || []).forEach(r => { insMap[r.campaign_id] = r })
        entry.campaigns = campListData.data.map(c => ({ ...c, ins: insMap[c.id] || null }))
        entry.campaigns.sort((a, b) => parseFloat(b.ins?.spend || 0) - parseFloat(a.ins?.spend || 0))
      }

      // Rejected ads — only flag ads whose parent campaign is currently ACTIVE
      const activeCampIds = new Set(
        (campListData.data || [])
          .filter(c => (c.effective_status || '').toUpperCase() === 'ACTIVE')
          .map(c => c.id)
      )
      const now = Date.now()
      const H24 = 24 * 60 * 60 * 1000
      const H72 = 72 * 60 * 60 * 1000
      ;(adsData.data || []).filter(ad => activeCampIds.has(ad.campaign_id)).forEach(ad => {
        let reason = 'Policy violation or creative issue'
        if (ad.ad_review_feedback) {
          try {
            const ex = o => { if (typeof o === 'string') return [o]; if (Array.isArray(o)) return o.flatMap(ex); if (typeof o === 'object' && o) return Object.values(o).flatMap(ex); return [] }
            const r = ex(ad.ad_review_feedback).filter(s => s && s.length > 2)
            if (r.length) reason = r.slice(0, 2).join(' · ')
          } catch (e) {}
        }
        const ageMs = ad.created_time ? (now - new Date(ad.created_time).getTime()) : H72 + 1
        const severity = ageMs <= H24 ? 'r' : ageMs <= H72 ? 'a' : 'old'
        entry.alerts.rejected.push({ adId: ad.id, campId: ad.campaign_id, adName: ad.name, status: ad.effective_status, reason, severity, createdTime: ad.created_time })
      })

      // No spend + high freq
      const adsetRows = adsetInsData.data || []
      const totalSpend = adsetRows.reduce((s, r) => s + parseFloat(r.spend || 0), 0)
      if (totalSpend === 0 && !accData.error && accData.account_status === 1) entry.alerts.noSpend = true
      const seen = new Set()
      adsetRows.forEach(row => {
        const freq = parseFloat(row.frequency || 0)
        const k = row.campaign_id
        if (freq >= 2.5 && !seen.has(k)) {
          seen.add(k)
          entry.alerts.highFreq.push({ adsetId: row.adset_id, campId: row.campaign_id, freq: freq.toFixed(2), spend: fmtSpend(parseFloat(row.spend || 0), S), severity: freq >= 3 ? 'r' : 'a' })
        }
      })

      // Top performers
      ;(campInsData.data || []).forEach(row => {
        const spend = parseFloat(row.spend || 0)
        if (spend < 50) return
        const res = parseResults(row, cl.currency)
        if (res.count > 0) entry.topPerf.push({ campId: row.campaign_id, campName: row.campaign_name, spend: fmtSpend(spend, S), result: res.text, ctr: parseFloat(row.ctr || 0).toFixed(2) + '%', cpa: Math.round(spend / res.count), S })
      })

    } catch (e) {
      entry.ins = { _err: e.message }
    }

    cache[cl.key] = entry
  }))

  return cache
}

// ── Account Card (pure display — no fetching) ─────────────────────────────────
function AccCard({ cl, entry, activeDateLabel, isVisible }) {
  const [open, setOpen] = useState(false)
  if (!isVisible) return null

  const S = SYM(cl.currency)
  const accInfo = entry?.accInfo
  const ins = entry?.ins
  const camps = entry?.campaigns || []
  const st = accInfo ? accStatus(accInfo.account_status) : { cls: 'ok', dot: 'g', badge: 'LIVE', badgeCls: 'sb-live' }

  const spend = parseFloat(ins?.spend || 0)
  const impr = parseInt(ins?.impressions || 0)
  const ctr = parseFloat(ins?.ctr || 0)
  const freq = parseFloat(ins?.frequency || 0)
  const cpm = parseFloat(ins?.cpm || 0)
  const reach = parseInt(ins?.reach || 0)
  const clicks = parseInt(ins?.clicks || 0)
  const res = ins && !ins._err ? parseResults(ins, cl.currency) : { text: '—', cls: '', count: 0 }
  const loading = entry === undefined

  const liveScore = ins && !ins._err && spend > 0 ? (() => {
    let s = 70
    if (ctr >= 2) s += 10; else if (ctr >= 1.5) s += 5; else if (ctr < 0.5) s -= 10
    if (freq >= 3) s -= 20; else if (freq >= 2.5) s -= 12; else if (freq >= 2) s -= 5
    if (res.count > 0) s += 8
    return Math.max(0, Math.min(100, Math.round(s)))
  })() : null
  const scoreColor = !liveScore ? 'var(--text3)' : liveScore >= 75 ? 'var(--green)' : liveScore >= 60 ? 'var(--amber)' : 'var(--red)'
  const CC = { green: 'var(--green-dk)', red: 'var(--red)', amber: 'var(--amber)' }

  return (
    <div className={`acc-card ${st.cls}${open ? ' open' : ''}`} data-client={cl.key}>
      <div className="acc-hdr" onClick={() => setOpen(o => !o)}>
        <div className="acc-exp">›</div>
        <div className={`acc-sdot ${st.dot}`} />
        <div className="acc-info">
          <div className="acc-name">{cl.name}</div>
          <div className="acc-meta">#{cl.accountId} · {cl.currency} · {cl.vertical} · {activeDateLabel}</div>
        </div>
        <div className="acc-kpis">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px' }}><Spinner size={11} /><span style={{ fontSize: 10, color: 'var(--text3)' }}>Loading…</span></div>
          ) : ins?._err ? (
            <div className="kc" style={{ minWidth: 180 }}><div className="kc-lbl">Error</div><div className="kc-val r" style={{ fontSize: 9, whiteSpace: 'normal' }}>{ins._err.slice(0, 80)}</div></div>
          ) : (
            <>
              <div className="kc"><div className="kc-lbl">Spend</div><div className={`kc-val ${spend > 0 ? 'n' : 'r'}`}>{fmtSpend(spend, S)}</div></div>
              <div className="kc"><div className="kc-lbl">Impressions</div><div className="kc-val n">{fmtNum(impr)}</div></div>
              <div className="kc"><div className="kc-lbl">Clicks</div><div className="kc-val n">{fmtNum(clicks)}</div></div>
              <div className="kc"><div className="kc-lbl">CTR</div><div className={`kc-val ${ctr >= 1.5 ? 'g' : ctr > 0 && ctr < 0.8 ? 'r' : 'n'}`}>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">CPM</div><div className="kc-val n">{cpm > 0 ? S + cpm.toFixed(0) : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">Reach</div><div className="kc-val n">{reach > 0 ? fmtNum(reach) : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">Freq</div><div className={`kc-val ${freq >= 2.5 ? 'r' : freq >= 2 ? 'a' : 'n'}`}>{freq > 0 ? freq.toFixed(2) : '—'}</div></div>
              <div className="kc"><div className="kc-lbl">Results</div><div className={`kc-val ${res.cls === 'green' ? 'g' : 'n'}`} style={{ fontSize: 10, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.text}</div></div>
            </>
          )}
        </div>
        <div className="acc-right">
          <div className="acc-badges">
            <span className={`s-badge ${st.badgeCls}`}>{st.badge}</span>
            {ins && !ins._err && freq >= 2.5 && <span className="chip-r">Freq {freq.toFixed(2)}</span>}
            {ins && !ins._err && freq >= 2 && freq < 2.5 && <span className="chip-a">Freq {freq.toFixed(2)}</span>}
            {ins && !ins._err && spend === 0 && <span className="chip-r">No Spend</span>}
          </div>
          {liveScore !== null && (
            <div className="opp-score">
              <span className="opp-lbl">Score</span>
              <div className="opp-bar"><div className="opp-fill" style={{ width: `${liveScore}%`, background: scoreColor }} /></div>
              <span className="opp-num" style={{ color: scoreColor }}>{liveScore}</span>
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="acc-body">
          {camps.length === 0 && <div className="no-data-box">No active/paused campaigns found for this period.</div>}
          {camps.length > 0 && (
            <table className="camp-tbl">
              <thead><tr><th>Campaign</th><th>Obj</th><th>Budget</th><th>Start</th><th>End</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
              <tbody>
                {camps.map((c, i) => {
                  const ci = c.ins, cs = campStatus(c)
                  const cS = parseFloat(ci?.spend || 0), cCtr = parseFloat(ci?.ctr || 0), cFreq = parseFloat(ci?.frequency || 0)
                  const cRes = parseResults(ci, cl.currency)
                  const bgt = fmtBudget(c, SYM(cl.currency))
                  return (
                    <tr key={c.id || i} style={{ cursor: 'pointer' }} onClick={() => openMeta('campaign', { accountId: cl.accountId, campId: c.id })}>
                      <td><b style={{ color: 'var(--blue-dk)' }}>{c.name}</b> <span style={{ fontSize: 9, color: 'var(--text3)' }}>↗</span></td>
                      <td><span className={`obj-b ${objCls(c.objective)}`}>{objLabel(c.objective)}</span></td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {bgt.label !== '—' ? <>{bgt.label}<span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3 }}>{bgt.type}</span></> : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDate(c.start_time)}</td>
                      <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{c.stop_time ? <span style={{ color: 'var(--amber)' }}>{fmtDate(c.stop_time)}</span> : <span style={{ color: 'var(--green-dk)', fontSize: 10 }}>Ongoing</span>}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{ci ? fmtSpend(cS, SYM(cl.currency)) : '—'}</td>
                      <td style={{ color: CC[cRes.cls] || 'var(--text2)', fontWeight: cRes.cls ? 600 : 400 }}>{cRes.text}</td>
                      <td style={cCtr >= 1.5 ? { color: 'var(--green-dk)' } : cCtr > 0 && cCtr < 0.8 ? { color: 'var(--red)' } : {}}>{cCtr > 0 ? cCtr.toFixed(2) + '%' : '—'}</td>
                      <td style={cFreq >= 2.5 ? { color: 'var(--red)', fontWeight: 600 } : cFreq >= 2 ? { color: 'var(--amber)' } : {}}>{cFreq > 0 ? cFreq.toFixed(2) : '—'}</td>
                      <td><div className="st-ind"><div className={`st-dot ${cs.dot}`} />{cs.label}</div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {ins && !ins._err && (
            <div className="insight-row">
              <div className="insight-box ib-trend">
                <div className="ib-ttl">📡 Live — {activeDateLabel}</div>
                <div className="ib-item">Spend: <b>{fmtSpend(spend, S)}</b> · Reach: <b>{fmtNum(reach)}</b> · Impressions: <b>{fmtNum(impr)}</b></div>
                <div className="ib-item">CTR: <b>{ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</b> · CPM: <b>{cpm > 0 ? S + cpm.toFixed(0) : '—'}</b> · Freq: <b>{freq > 0 ? freq.toFixed(2) : '—'}</b></div>
                {res.text !== '—' && <div className="ib-item">Top Result: <b>{res.text}</b></div>}
              </div>
              {freq >= 2 && <div className="insight-box ib-warn"><div className="ib-ttl">⚠ Frequency Alert</div><div className="ib-item">Freq <b>{freq.toFixed(2)}</b> — {freq >= 2.5 ? 'audience fatigue, refresh creative' : 'approaching fatigue, monitor'}</div></div>}
              {spend === 0 && <div className="insight-box ib-err"><div className="ib-ttl">🚨 No Spend</div><div className="ib-item">Zero delivery in {activeDateLabel}. Check account status and billing.</div></div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Campaigns Table (pure display) ────────────────────────────────────────────
function CampaignsView({ cache, filter, activeDateLabel }) {
  const CC = { green: 'var(--green-dk)', red: 'var(--red)', amber: 'var(--amber)' }
  const clients = filter === 'all' ? CLIENTS : CLIENTS.filter(c => c.key === filter)
  const rows = clients.flatMap(cl => {
    const entry = cache[cl.key]
    if (!entry) return []
    return (entry.campaigns || []).map(c => ({
      campName: c.name, accName: cl.name, accId: cl.accountId, campId: c.id,
      obj: c.objective, ins: c.ins, status: campStatus(c), currency: cl.currency, S: SYM(cl.currency),
      daily_budget: c.daily_budget, lifetime_budget: c.lifetime_budget, start_time: c.start_time, stop_time: c.stop_time
    }))
  }).sort((a, b) => parseFloat(b.ins?.spend || 0) - parseFloat(a.ins?.spend || 0))

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Active &amp; Paused Campaigns <span className="live-badge">● LIVE · {activeDateLabel}</span></div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length} campaigns</span>
      </div>
      {rows.length > 0 ? (
        <div className="tbl-wrap">
          <table className="all-camp-tbl">
            <thead><tr><th>Campaign</th><th>Account</th><th>Obj</th><th>Budget</th><th>Start</th><th>End</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const cS = parseFloat(r.ins?.spend || 0), cCtr = parseFloat(r.ins?.ctr || 0), cFr = parseFloat(r.ins?.frequency || 0), cRes = parseResults(r.ins, r.currency)
                const bgt = fmtBudget(r, r.S)
                return (
                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => openMeta('campaign', { accountId: r.accId, campId: r.campId })}>
                    <td><b style={{ color: 'var(--blue-dk)' }}>{r.campName}</b> <span style={{ fontSize: 9, color: 'var(--text3)' }}>↗</span></td>
                    <td style={{ color: 'var(--text2)', fontSize: 11 }}>{r.accName}</td>
                    <td><span className={`obj-b ${objCls(r.obj)}`}>{objLabel(r.obj)}</span></td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {bgt.label !== '—' ? <>{bgt.label}<span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3 }}>{bgt.type}</span></> : '—'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDate(r.start_time)}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{r.stop_time ? <span style={{ color: 'var(--amber)' }}>{fmtDate(r.stop_time)}</span> : <span style={{ color: 'var(--green-dk)', fontSize: 10 }}>Ongoing</span>}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{r.ins ? fmtSpend(cS, r.S) : '—'}</td>
                    <td style={{ color: CC[cRes.cls] || 'var(--text2)', fontWeight: cRes.cls ? 600 : 400 }}>{cRes.text}</td>
                    <td style={cCtr >= 1.5 ? { color: 'var(--green-dk)' } : cCtr > 0 && cCtr < 0.8 ? { color: 'var(--red)' } : {}}>{cCtr > 0 ? cCtr.toFixed(2) + '%' : '—'}</td>
                    <td style={cFr >= 2.5 ? { color: 'var(--red)', fontWeight: 600 } : cFr >= 2 ? { color: 'var(--amber)' } : {}}>{cFr > 0 ? cFr.toFixed(2) : '—'}</td>
                    <td><div className="st-ind"><div className={`st-dot ${r.status.dot}`} />{r.status.label}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-data-box">No campaigns found for this period.</div>
      )}
    </div>
  )
}

// ── Alerts View (pure display) ────────────────────────────────────────────────
function AlertsView({ cache, filter, activeDateLabel }) {
  const clients = filter === 'all' ? CLIENTS : CLIENTS.filter(c => c.key === filter)

  const [showOldRejected, setShowOldRejected] = useState(false)
  const results = { rejected: [], billing: [], noSpend: [], highFreq: [], topPerf: [] }
  clients.forEach(cl => {
    const entry = cache[cl.key]
    if (!entry) return
    const S = SYM(cl.currency)
    entry.alerts.rejected.forEach(a => results.rejected.push({ ...a, client: cl.name, key: cl.key, accountId: cl.accountId }))
    entry.alerts.billing.forEach(a => results.billing.push({ ...a, client: cl.name, key: cl.key, accountId: cl.accountId }))
    if (entry.alerts.noSpend) results.noSpend.push({ client: cl.name, key: cl.key, accountId: cl.accountId })
    entry.alerts.highFreq.forEach(a => results.highFreq.push({ ...a, client: cl.name, key: cl.key, accountId: cl.accountId }))
    entry.topPerf.forEach(a => results.topPerf.push({ ...a, client: cl.name, key: cl.key, accountId: cl.accountId }))
  })
  results.topPerf.sort((a, b) => a.cpa - b.cpa)

  const d = results
  const activeRejected = d.rejected.filter(a => a.severity !== 'old')
  const oldRejected = d.rejected.filter(a => a.severity === 'old')
  const totalCritical = activeRejected.filter(a => a.severity === 'r').length + d.billing.filter(b => b.severity === 'r').length + d.noSpend.length
  const totalWarn = d.billing.filter(b => b.severity === 'a').length + d.highFreq.length

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">Alerts &amp; Recommendations <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {totalCritical > 0 && <span className="pill pill-r">🚨 {totalCritical} Critical</span>}
          {totalWarn > 0 && <span className="pill pill-a">⚠ {totalWarn} Warnings</span>}
          {totalCritical === 0 && totalWarn === 0 && <span className="pill pill-g">✓ All Clear</span>}
        </div>
      </div>
      <div className="alerts-panel">
        <div className="ap-hdr" style={{ background: 'rgba(224,82,82,0.03)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🚫 Rejected / Disapproved Ads</span>
          <span className={`pill ${activeRejected.length > 0 ? 'pill-r' : 'pill-g'}`}>{activeRejected.length > 0 ? `${activeRejected.length} Rejected` : '✓ None'}</span>
        </div>
        {activeRejected.length === 0
          ? <div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No disapproved or rejected ads</div><div className="ar-sub">All active ads are approved.</div></div></div>
          : activeRejected.map((a, i) => (
            <div key={i} className="alert-row">
              <div className="ar-ico r">{a.severity === 'r' ? '🚫' : '⚠️'}</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — Ad Rejected: "{a.adName}"</div><div className="ar-sub">Status: <b>{a.status}</b> · {a.reason} · <i>Rejected: {a.createdTime ? new Date(a.createdTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "unknown"}</i></div></div>
              <span className="ar-tag">{a.client}</span>
              <span className="ar-lift" style={{ background: 'var(--red-lt)', color: 'var(--red)', borderColor: 'var(--red-bd)' }}>Fix Required</span>
              <button className="ar-btn" onClick={() => openMeta('ad', { accountId: a.accountId, adId: a.adId })}>Review in Meta →</button>
            </div>
          ))}
        {oldRejected.length > 0 && (
          <div style={{ borderTop: '1px solid #eee', padding: '8px 14px' }}>
            <button onClick={() => setShowOldRejected(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', gap: 6 }}>
              {showOldRejected ? '▲' : '▼'} {oldRejected.length} older rejection{oldRejected.length > 1 ? 's' : ''} hidden (older than 72 hrs)
            </button>
            {showOldRejected && oldRejected.map((a, i) => (
              <div key={i} className="alert-row" style={{ opacity: 0.5 }}>
                <div className="ar-ico" style={{ color: '#bbb' }}>⚫</div>
                <div className="ar-body"><div className="ar-ttl">{a.client} — Ad Rejected: "{a.adName}"</div><div className="ar-sub">Status: <b>{a.status}</b> · {a.reason} · <i>Created: {a.createdTime ? new Date(a.createdTime).toLocaleDateString() : 'unknown'}</i></div></div>
                <span className="ar-tag">{a.client}</span>
                <button className="ar-btn" onClick={() => openMeta('ad', { accountId: a.accountId, adId: a.adId })}>Review in Meta →</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="alerts-panel">
        <div className="ap-hdr" style={{ background: 'rgba(224,82,82,0.03)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>💳 Billing &amp; Account Status</span>
          <span className={`pill ${d.billing.length > 0 ? 'pill-r' : 'pill-g'}`}>{d.billing.length > 0 ? `${d.billing.length} Issues` : '✓ All Healthy'}</span>
        </div>
        {d.billing.length === 0
          ? <div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No billing or payment issues</div><div className="ar-sub">All accounts are active with no payment errors detected.</div></div></div>
          : d.billing.map((a, i) => (
            <div key={i} className="alert-row">
              <div className={`ar-ico ${a.severity}`}>{a.severity === 'r' ? '🚨' : '⚠️'}</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — {a.status}</div><div className="ar-sub">{a.detail}</div></div>
              <span className="ar-tag">{a.client}</span>
              <button className="ar-btn" onClick={() => openMeta(a.type === 'balance' || a.type === 'spend_cap' ? 'billing' : 'campaign', { accountId: a.accountId })}>Fix in Meta →</button>
            </div>
          ))}
      </div>
      {d.noSpend.length > 0 && (
        <div className="alerts-panel">
          <div className="ap-hdr" style={{ background: 'rgba(224,82,82,0.03)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>💸 Zero Spend — {activeDateLabel}</span>
            <span className="pill pill-r">{d.noSpend.length} Accounts</span>
          </div>
          {d.noSpend.map((a, i) => (
            <div key={i} className="alert-row">
              <div className="ar-ico r">💸</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — No spend in {activeDateLabel}</div><div className="ar-sub">Zero ad delivery. Check campaigns are active and billing is correct.</div></div>
              <span className="ar-tag">{a.client}</span>
              <button className="ar-btn" onClick={() => openMeta('campaign', { accountId: a.accountId })}>Check Account →</button>
            </div>
          ))}
        </div>
      )}
      <div className="alerts-panel">
        <div className="ap-hdr" style={{ background: 'rgba(217,119,6,0.03)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🔁 High Frequency — Audience Fatigue Risk</span>
          <span className={`pill ${d.highFreq.length > 0 ? 'pill-a' : 'pill-g'}`}>{d.highFreq.length > 0 ? `${d.highFreq.length} Ad Sets` : '✓ All Good'}</span>
        </div>
        {d.highFreq.length === 0
          ? <div className="alert-row"><div className="ar-ico g">✓</div><div className="ar-body"><div className="ar-ttl">No high-frequency ad sets</div><div className="ar-sub">All ad sets are below the 2.5 frequency threshold.</div></div></div>
          : d.highFreq.map((a, i) => (
            <div key={i} className="alert-row">
              <div className={`ar-ico ${a.severity}`}>{a.severity === 'r' ? '🚨' : '⚠️'}</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — Frequency {a.freq} {parseFloat(a.freq) >= 3 ? '· Audience Burnt' : '· Fatigue Risk'}</div><div className="ar-sub">Spend {a.spend} at freq {a.freq}. {parseFloat(a.freq) >= 3 ? 'Pause and refresh creative immediately.' : 'Consider refreshing creative or expanding audience.'}</div></div>
              <span className="ar-tag">{a.client}</span>
              <span className={a.severity === 'r' ? 'chip-r' : 'chip-a'}>Freq {a.freq}</span>
              <button className="ar-btn" onClick={() => openMeta('adset', { accountId: a.accountId, adsetId: a.adsetId })}>Refresh Creative →</button>
            </div>
          ))}
      </div>
      {d.topPerf.length > 0 && (
        <div className="alerts-panel">
          <div className="ap-hdr" style={{ background: 'rgba(125,194,66,0.03)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📈 Top Performing Campaigns — {activeDateLabel}</span>
            <span className="pill pill-g">{d.topPerf.length} with Results</span>
          </div>
          {d.topPerf.slice(0, 8).map((a, i) => (
            <div key={i} className="alert-row">
              <div className="ar-ico g">{i === 0 ? '⭐' : '📈'}</div>
              <div className="ar-body"><div className="ar-ttl">{a.client} — {a.campName}</div><div className="ar-sub">Spend: <b>{a.spend}</b> · {a.result} · CTR: <b>{a.ctr}</b></div></div>
              <span className="ar-tag">{a.client}</span>
              <span className="ar-lift">{a.S}{a.cpa} CPA</span>
              <button className="ar-btn" onClick={() => openMeta('campaign', { accountId: a.accountId, campId: a.campId })}>Scale →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
function DashboardInner() {
  const [view, setView] = useState('accounts')
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('Today')
  const [customFrom, setFrom] = useState('')
  const [customTo, setTo] = useState('')
  const [customLabel, setCustLbl] = useState('')

  // Single cache for all data — null = not loaded, {} = loading, {key: entry} = loaded
  const [cache, setCache] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [fetchKey, setFetchKey] = useState(0) // increment to trigger refresh
  const [lastFetched, setLastFetched] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]
  const activeDateLabel = dateRange === 'custom' ? customLabel : dateRange
  const dateParams = getDateParams(dateRange, customFrom, customTo)

  // Fetch all data once on mount or when dateParams/fetchKey changes
  useEffect(() => {
    let cancelled = false
    setCache(null)
    setRefreshing(true)
    setLoadingMsg(`Loading data for all ${CLIENTS.length} accounts…`)

    fetchAllData(dateParams).then(data => {
      if (cancelled) return
      setCache(data)
      setLastFetched(new Date())
      setRefreshing(false)
      setLoadingMsg('')
    }).catch(e => {
      if (cancelled) return
      setRefreshing(false)
      setLoadingMsg('Failed to load. Click Refresh to retry.')
    })

    return () => { cancelled = true }
  }, [JSON.stringify(dateParams), fetchKey])

  const handleRefresh = () => {
    setFetchKey(k => k + 1)
  }

  // Compute stats from cache
  const filteredClients = filter === 'all' ? CLIENTS : CLIENTS.filter(c => c.key === filter)
  const filteredEntries = filteredClients.map(c => cache?.[c.key]?.ins).filter(d => d && !d._err)
  const totalSpend = filteredEntries.reduce((s, d) => s + parseFloat(d?.spend || 0), 0)
  const totalImpr = filteredEntries.reduce((s, d) => s + parseInt(d?.impressions || 0), 0)
  const totalReach = filteredEntries.reduce((s, d) => s + parseInt(d?.reach || 0), 0)
  const totalClicks = filteredEntries.reduce((s, d) => s + parseInt(d?.clicks || 0), 0)
  const ctrVals = filteredEntries.filter(d => parseFloat(d?.ctr || 0) > 0)
  const avgCtr = ctrVals.length ? ctrVals.reduce((s, d) => s + parseFloat(d.ctr || 0), 0) / ctrVals.length : 0
  const activeCount = filteredClients.filter(c => { const d = cache?.[c.key]?.ins; return d && !d._err && parseFloat(d.spend || 0) > 0 }).length
  const statsReady = cache !== null
  const isFiltered = filter !== 'all'
  const filterName = isFiltered ? CLIENTS.find(c => c.key === filter)?.name?.split(' ').slice(0, 2).join(' ') : null

  // Issue map for sidebar badges
  const issueMap = {}
  CLIENTS.forEach(c => {
    if (!cache?.[c.key]) { issueMap[c.key] = 0; return }
    const a = cache[c.key].alerts
    issueMap[c.key] = a.rejected.filter(r => r.severity !== 'old').length + a.billing.length + (a.noSpend ? 1 : 0) + a.highFreq.length
  })

  const sidebar = [
    { section: 'All Clients' },
    { key: 'all', dot: 'g', name: 'All Accounts' },
    { section: 'By Account', mt: true },
    ...CLIENTS.map(cl => {
      const ins = cache?.[cl.key]?.ins
      const spend = ins ? parseFloat(ins.spend || 0) : null
      const freq = ins ? parseFloat(ins.frequency || 0) : 0
      const dot = !cache ? 'e' : ins?._err ? 'r' : spend > 0 ? freq >= 2.5 ? 'r' : freq >= 2 ? 'a' : 'g' : 'e'
      const score = ins && !ins._err && spend > 0 ? (() => {
        const ct = parseFloat(ins.ctr || 0), f = parseFloat(ins.frequency || 0)
        let s = 70; if (ct >= 2) s += 10; else if (ct >= 1.5) s += 5; else if (ct < 0.5) s -= 10
        if (f >= 3) s -= 20; else if (f >= 2.5) s -= 12; else if (f >= 2) s -= 5
        return Math.max(0, Math.min(100, Math.round(s)))
      })() : null
      const scoreCls = !score ? 'sc-na' : score >= 75 ? 'sc-hi' : score >= 60 ? 'sc-md' : 'sc-lo'
      const issues = issueMap[cl.key] || 0
      return { key: cl.key, dot, name: cl.name, score, scoreCls, issues }
    })
  ]

  return (
    <>
      <div className="bg-layer">
        <svg className="bl-1" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" /></svg>
        <svg className="bl-2" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" /></svg>
        <svg className="bl-3" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0z" /></svg>
        <svg className="bl-4" viewBox="0 0 200 300"><path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" /></svg>
      </div>
      <div className="wm"><span>merakiads</span></div>

      <div className="topbar">
        <a className="logo" href="#"><span className="m">meraki</span><span className="a">ads</span></a>
        <div className="topbar-div" />
        <span className="topbar-lbl">Meta Intelligence · Live</span>
        <div className="view-tabs">
          {['accounts', 'campaigns', 'alerts'].map(v => (
            <div key={v} className={`vtab${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              {v === 'accounts' ? 'Account View' : v === 'campaigns' ? 'Campaign Table' : 'Alerts & Recommendations'}
            </div>
          ))}
        </div>
        <div className="topbar-right">
          {statsReady && isFiltered && <span className="pill pill-b">🔍 {filterName}</span>}
          {statsReady && <span className="pill pill-g">● {activeCount} Spending</span>}
          {statsReady && <span className="pill pill-b">{fmtSpend(totalSpend)}</span>}
          {lastFetched && <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 4 }}>Updated {lastFetched.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing} style={{ opacity: refreshing ? 0.6 : 1 }}>
            {refreshing ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="sidebar">
        {sidebar.map((item, i) => {
          if (item.section) return <div key={i} className="sb-section" style={item.mt ? { marginTop: 4 } : {}}>{item.section}</div>
          if (item.key === 'all') return (
            <div key="all" className={`sb-item${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
              <div className="sb-dot g" /><span className="sb-name">All Accounts</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {Object.values(issueMap).reduce((s, n) => s + n, 0) > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: 'var(--red-lt)', color: 'var(--red)', border: '1px solid var(--red-bd)' }}>!{Object.values(issueMap).reduce((s, n) => s + n, 0)}</span>}
                <span className="sb-score sc-na">{CLIENTS.length}</span>
              </div>
            </div>
          )
          return (
            <div key={item.key} className={`sb-item${filter === item.key ? ' active' : ''}`} onClick={() => setFilter(item.key)}>
              <div className={`sb-dot ${item.dot}`} />
              <span className="sb-name">{item.name.length > 20 ? item.name.slice(0, 20) + '…' : item.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {item.issues > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: 'var(--red-lt)', color: 'var(--red)', border: '1px solid var(--red-bd)' }}>!{item.issues}</span>}
                <span className={`sb-score ${item.scoreCls}`}>{item.score ?? '—'}</span>
              </div>
            </div>
          )
        })}
        <div className="sb-section" style={{ marginTop: 6 }}>Live Status</div>
        <div className="sb-info">
          📅 {activeDateLabel}<br />
          🔗 Meta API · <span style={{ color: 'var(--green-dk)' }}>Connected</span><br />
          {statsReady && <>
            {isFiltered && <><b style={{ color: 'var(--blue-dk)' }}>🔍 {filterName}</b><br /></>}
            💰 Spend: <b>{fmtSpend(totalSpend)}</b><br />
            📊 Impr: <b>{fmtNum(totalImpr)}</b><br />
            🖱 Clicks: <b>{fmtNum(totalClicks)}</b><br />
            {!isFiltered && <>✅ {activeCount}/{CLIENTS.length} spending</>}
          </>}
        </div>
      </div>

      <div className="statsbar">
        {refreshing ? (
          <div className="kpi-pill kpi-n"><Spinner size={11} /><span className="kpi-lbl" style={{ marginLeft: 4 }}>{loadingMsg}</span></div>
        ) : statsReady ? <>
          {isFiltered && <div className="kpi-pill kpi-b" style={{ borderColor: 'var(--blue-bd)', background: 'var(--blue-lt)' }}><div className="kpi-dot" /><span className="kpi-lbl">Filter</span><span className="kpi-val" style={{ fontSize: 11, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{filterName}</span></div>}
          <div className="kpi-pill kpi-g"><div className="kpi-dot" /><span className="kpi-lbl">Spend</span><span className="kpi-val">{fmtSpend(totalSpend)}</span></div>
          <div className="kpi-pill kpi-b"><div className="kpi-dot" /><span className="kpi-lbl">Impressions</span><span className="kpi-val">{fmtNum(totalImpr)}</span></div>
          <div className="kpi-pill kpi-n"><div className="kpi-dot" /><span className="kpi-lbl">Reach</span><span className="kpi-val">{fmtNum(totalReach)}</span></div>
          <div className="kpi-pill kpi-n"><div className="kpi-dot" /><span className="kpi-lbl">Clicks</span><span className="kpi-val">{fmtNum(totalClicks)}</span></div>
          {avgCtr > 0 && <div className={`kpi-pill ${avgCtr >= 1.5 ? 'kpi-g' : avgCtr < 0.8 ? 'kpi-r' : 'kpi-n'}`}><div className="kpi-dot" /><span className="kpi-lbl">Avg CTR</span><span className="kpi-val">{avgCtr.toFixed(2)}%</span></div>}
          {!isFiltered && <><div className="sb-sep" /><div className="kpi-pill kpi-g"><div className="kpi-dot" /><span className="kpi-lbl">Spending</span><span className="kpi-val">{activeCount}/{CLIENTS.length}</span></div></>}
        </> : <div className="kpi-pill kpi-n"><Spinner size={11} /><span className="kpi-lbl" style={{ marginLeft: 4 }}>Loading live data…</span></div>}
        <div className="sb-sep" />
        <div className="date-grp">
          {['Today', 'Last 7D', '14D', '30D', 'This Month'].map(d => (
            <button key={d} className={`dr${dateRange === d ? ' active' : ''}`} onClick={() => setDateRange(d)}>{d}</button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: dateRange === 'custom' ? 'var(--green-lt)' : 'rgba(0,0,0,0.04)', border: dateRange === 'custom' ? '1px solid var(--green-bd)' : '1px solid var(--border)', borderRadius: 20, padding: '3px 10px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: dateRange === 'custom' ? 'var(--green-dk)' : 'var(--text3)', whiteSpace: 'nowrap' }}>From</span>
            <input type="date" max={customTo || todayStr} value={customFrom}
              onChange={e => { setFrom(e.target.value); if (e.target.value && customTo) { const fmt = d => { const [, m, dd] = d.split('-'); return `${dd}/${m}` }; setCustLbl(`${fmt(e.target.value)}–${fmt(customTo)}`); setDateRange('custom') } }}
              style={{ fontFamily: 'JetBrains Mono', fontSize: 10, border: 'none', background: 'transparent', color: dateRange === 'custom' ? 'var(--green-dk)' : 'var(--text)', outline: 'none', cursor: 'pointer', width: 100 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: dateRange === 'custom' ? 'var(--green-dk)' : 'var(--text3)' }}>→</span>
            <input type="date" min={customFrom} max={todayStr} value={customTo}
              onChange={e => { setTo(e.target.value); if (customFrom && e.target.value) { const fmt = d => { const [, m, dd] = d.split('-'); return `${dd}/${m}` }; setCustLbl(`${fmt(customFrom)}–${fmt(e.target.value)}`); setDateRange('custom') } }}
              style={{ fontFamily: 'JetBrains Mono', fontSize: 10, border: 'none', background: 'transparent', color: dateRange === 'custom' ? 'var(--green-dk)' : 'var(--text)', outline: 'none', cursor: 'pointer', width: 100 }} />
          </div>
        </div>
      </div>

      <div className="main-wrap"><div className="main">
        {/* Loading overlay */}
        {refreshing && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{loadingMsg}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Fetching all accounts in parallel — this takes ~5 seconds</div>
          </div>
        )}

        {!refreshing && cache && <>
          <div style={{ display: view === 'accounts' ? 'block' : 'none' }}>
            <div className="sec-hdr">
              <div className="sec-ttl">Client Accounts <span className="live-badge">● LIVE · Meta API · {activeDateLabel}</span></div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{filteredClients.length} accounts</span>
            </div>
            <div className="accounts">
              {CLIENTS.map(c => (
                <AccCard key={c.key} cl={c} entry={cache[c.key]}
                  activeDateLabel={activeDateLabel}
                  isVisible={filter === 'all' || filter === c.key} />
              ))}
            </div>
          </div>
          <div style={{ display: view === 'campaigns' ? 'block' : 'none' }}>
            <CampaignsView cache={cache} filter={filter} activeDateLabel={activeDateLabel} />
          </div>
          <div style={{ display: view === 'alerts' ? 'block' : 'none' }}>
            <AlertsView cache={cache} filter={filter} activeDateLabel={activeDateLabel} />
          </div>
        </>}
      </div></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}

export default function Dashboard() {
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    if (sessionStorage.getItem('ma_auth') === '1') setUnlocked(true)
  }, [])
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return <DashboardInner />
}
