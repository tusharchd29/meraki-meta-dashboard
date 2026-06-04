'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Static client data matching the original HTML exactly ─────────────────────
const CLIENTS = [
  {
    key: 'volvo', name: 'Volvo (Krishna — Meraki Ads)', accountId: '833603637085666',
    currency: 'INR', vertical: 'Automotive', status: 'ok', dot: 'g',
    badge: 'LIVE', badgeCls: 'sb-live', chip: 'Vijayawada CPL ₹101', chipCls: 'chip-a',
    score: 88, scoreColor: 'var(--green)', scoreBg: 'var(--green)',
    kpis: [
      { lbl: 'Leads', val: '48', cls: 'g' }, { lbl: 'Best CPL', val: '₹90', cls: 'g' },
      { lbl: 'Spend', val: '₹6.14K', cls: 'n' }, { lbl: 'CHD Reach', val: '243K', cls: 'g' }
    ],
    campaigns: [
      { name: 'Vijayawada | Feb 2026', obj: 'leads', spend: '₹2,129', result: '21 Leads · CPL ₹101', resultCls: 'green', ctr: '0.72%', freq: '1.55', status: 'Active', dot: 'on' },
      { name: 'Hyderabad | Feb 2026', obj: 'leads', spend: '₹1,895', result: '21 Leads · CPL ₹90', resultCls: 'green', ctr: '0.61%', freq: '1.55', status: 'Active · Best', dot: 'on' },
      { name: 'Chandigarh | EX 30 | June', obj: 'leads', spend: '₹825', result: '6 Leads · CPL ₹137', resultCls: 'green', ctr: '1.32%', freq: '1.46', status: 'Active', dot: 'on' },
      { name: 'CHD Awareness — XC60 99 Years', obj: 'aware', spend: '₹653', result: 'Reach 243,699', resultCls: 'green', ctr: '0.14%', freq: '1.17', status: 'Active', dot: 'on' },
      { name: 'Hyderabad | Followers Campaign', obj: 'traffic', spend: '₹641', result: '410 Profile Visits · ₹1.56', resultCls: 'blue', ctr: '0.51%', freq: '1.22', status: 'Active', dot: 'on' },
    ],
    insight: { type: 'trend', title: '📊 This Week', items: ['Hyderabad: <b>₹90 CPL</b> — best in account, 21 leads', 'Vijayawada holding at <b>₹101 CPL</b> — both cities solid', 'CHD Awareness: <b>243K reach</b> at freq 1.17 — very healthy'] },
    reco: { title: '🎯 Meta Recs (Score 88)', items: ['🎵 <b>Add music to 3 ads</b> — 52% lower CPR (highest lift in portfolio!)', '🔗 <b>Connect CRM via CAPI</b> on Vijayawada &amp; Hyderabad — 24% lower CPL (+6pts)', '📱 <b>Add 9:16 Reels</b> to CHD awareness — 6% lower CPM'] }
  },
  {
    key: 'north-old', name: 'North International (Old Account)', accountId: '1297775434831152',
    currency: 'INR', vertical: 'Education', status: 'ok', dot: 'g',
    badge: 'LIVE', badgeCls: 'sb-live', chip: 'Malta CPL ₹121', chipCls: 'chip-a',
    score: 81, scoreColor: 'var(--green)', scoreBg: 'var(--green)',
    kpis: [
      { lbl: 'Leads', val: '130', cls: 'g' }, { lbl: 'Best CPL', val: '₹30', cls: 'g' },
      { lbl: 'Spend', val: '₹12.8K', cls: 'n' }, { lbl: 'CTWA Convos', val: '32', cls: 'b' }
    ],
    campaigns: [
      { name: 'Finland | Malta Open Campaign', obj: 'leads', spend: '₹4,851', result: '40 Leads · CPL ₹121', resultCls: 'amber', ctr: '2.04%', freq: '1.82', status: 'Active', dot: 'on' },
      { name: 'Generic Campaign | Lead Gen', obj: 'leads', spend: '₹4,552', result: '57 Leads · CPL ₹80', resultCls: 'green', ctr: '2.11%', freq: '1.91', status: 'Active', dot: 'on' },
      { name: 'CTWA Finland | 14th April', obj: 'leads', spend: '₹1,291', result: '32 Convos · CPR ₹40', resultCls: 'blue', ctr: '1.95%', freq: '1.61', status: 'Active', dot: 'on' },
      { name: 'Finland Study Visa | PAN INDIA', obj: 'leads', spend: '₹989', result: '33 Leads · CPL ₹30', resultCls: 'green', ctr: '3.90%', freq: '1.87', status: 'Active · Best CTR', dot: 'on', ctrCls: 'green' },
      { name: 'Schengen Awareness | 7th May', obj: 'aware', spend: '₹606', result: '11,266 ThruPlays · ₹0.054', resultCls: 'green', ctr: '0.00%', freq: '1.79', status: 'Active', dot: 'on' },
      { name: 'TOFU Schengen/Finland | 4th April', obj: 'aware', spend: '₹522', result: '6,160 ThruPlays · ₹0.085', resultCls: 'green', ctr: '0.21%', freq: '1.02', status: 'Active', dot: 'on' },
    ],
    insight: { type: 'trend', title: '📊 This Week Highlights', items: ['Finland PAN INDIA: <b>₹30 CPL, 3.90% CTR</b> — best campaign in account', 'Generic Lead Gen: <b>57 leads at ₹80 CPL</b> — consistent performer', 'CTWA: <b>32 convos at ₹40 CPR</b> — WhatsApp pipeline flowing well'] },
    reco: { title: '🎯 Meta Recs (Score 81)', items: ['🔗 <b>CAPI CRM on Malta campaign</b> — 24% lower CPL (+6pts, highest lift)', '🔗 <b>CAPI CRM on Finland PAN INDIA</b> — 24% lower CPL (+4pts)', '🎵 <b>Add music to 3 ads</b> — 16% lower CPR (+2pts)'] }
  },
  {
    key: 'pyarababy', name: 'PyaraBaby', accountId: '254564808465114',
    currency: 'INR', vertical: 'Ecommerce', status: 'ok', dot: 'g',
    badge: 'LIVE', badgeCls: 'sb-live', chip: 'Stroller CPP ₹4,901', chipCls: 'chip-r',
    score: 80, scoreColor: 'var(--green)', scoreBg: 'var(--green)',
    kpis: [
      { lbl: 'WABA Convos', val: '570', cls: 'b' }, { lbl: 'CPR WABA', val: '₹3.39', cls: 'g' },
      { lbl: 'Purchases', val: '11', cls: 'g' }, { lbl: 'Best CPP', val: '₹486', cls: 'a' }
    ],
    campaigns: [
      { name: 'Scalled Campaign | 18th May', obj: 'sales', spend: '₹10,987', result: '7 Purchases · CPP ₹1,570', resultCls: 'amber', ctr: '1.42%', freq: '1.81', status: 'Active', dot: 'on' },
      { name: 'Stroller Catalogue | Adv+ CBO', obj: 'sales', spend: '₹9,803', result: '2 Purchases · CPP ₹4,901', resultCls: 'red', ctr: '2.87%', freq: '2.26', freqCls: 'amber', status: 'Paused · No ROAS', dot: 'warn' },
      { name: 'Lead Gen | Sellers | 7th April', obj: 'leads', spend: '₹5,362', result: '1,529 Convos · CPR ₹3.51', resultCls: 'blue', ctr: '2.84%', freq: '1.28', status: 'Paused', dot: 'na' },
      { name: 'Remarketing Catalogue | 18th May', obj: 'sales', spend: '₹1,942', result: '4 Purchases · CPP ₹486', resultCls: 'green', ctr: '8.53%', ctrCls: 'green', freq: '2.54', status: 'Active · Best CTR', dot: 'on' },
      { name: 'Lead Gen | Sellers | WABA (new)', obj: 'leads', spend: '₹1,934', result: '570 Convos · CPR ₹3.39', resultCls: 'blue', ctr: '1.55%', freq: '2.32', freqCls: 'amber', status: 'Active', dot: 'on' },
    ],
    insight: { type: 'err', title: '🚨 Stroller CPP Critical', items: ['Stroller Catalogue: <b>₹9.8K spent, only 2 purchases</b> at CPP ₹4,901 — now paused', 'Remarketing at <b>₹486 CPP, 8.53% CTR</b> — far more efficient, scale this', 'WABA convos 570 at ₹3.39 — excellent, keep running'] },
    reco: { title: '🎯 Meta Recs (Score 80)', items: ['🔀 <b>Merge 2 fragmented ad sets</b> in WABA — 33% lower CPR (+4pts)', '✨ <b>A+ Creative Enhancements</b> on 3 ads — 19% lower CPR (+4pts)', '📱 <b>Add 9:16 Reels to WABA</b> — 8% lower CPR'] }
  },
  {
    key: 'honda', name: 'Courtesy Honda', accountId: '787341982723949',
    currency: 'INR', vertical: 'Automotive', status: 'ok', dot: 'g',
    badge: 'LIVE', badgeCls: 'sb-live', chip: 'CHD Freq 2.00', chipCls: 'chip-a',
    score: 71, scoreColor: 'var(--amber)', scoreBg: 'var(--amber)',
    kpis: [
      { lbl: 'Leads', val: '110', cls: 'g' }, { lbl: 'Best CPL', val: '₹51', cls: 'g' },
      { lbl: 'Spend', val: '₹6.75K', cls: 'n' }, { lbl: 'Best CTR', val: '1.64%', cls: 'g' }
    ],
    campaigns: [
      { name: 'Okhla Leads | May_HONDA', obj: 'leads', spend: '₹2,022', result: '40 Leads · CPL ₹51', resultCls: 'green', ctr: '1.64%', ctrCls: 'green', freq: '1.79', status: 'Active · Best', dot: 'on' },
      { name: 'Chandigarh Leads | May_HONDA', obj: 'leads', spend: '₹2,004', result: '21 Leads · CPL ₹95', resultCls: 'green', ctr: '1.13%', freq: '2.00', freqCls: 'amber', status: 'Active · Watch Freq', dot: 'on' },
      { name: 'Panipat Leads | May_HONDA', obj: 'leads', spend: '₹1,406', result: '26 Leads · CPL ₹54', resultCls: 'green', ctr: '0.78%', freq: '1.59', status: 'Active', dot: 'on' },
      { name: 'Karnal Leads | May_HONDA', obj: 'leads', spend: '₹1,319', result: '23 Leads · CPL ₹57', resultCls: 'green', ctr: '0.96%', freq: '1.73', status: 'Active · ✅ Improved', dot: 'on' },
    ],
    insight: { type: 'trend', title: '📊 This Week', items: ['Okhla: <b>40 leads at ₹51 CPL</b> — best in account, strong 1.64% CTR', 'Karnal: <b>₹57 CPL</b> — major improvement, proving the fix worked ✅', 'Chandigarh freq <b>2.00</b> — approaching fatigue threshold, monitor closely'] },
    reco: { title: '🎯 Meta Recs (Score 71)', items: ['✨ <b>A+ Creative Enhancements</b> on 5 ads — 11% lower CPR (+14pts)', '🔗 <b>CAPI CRM</b> on 4 campaigns — 24% lower CPL (+2–3pts each)', '💰 <b>2 ad sets budget-limited</b> — increase spend cap for more leads'] }
  },
  {
    key: 'ssw', name: 'Sri Sri Well Being (SSW Mohali)', accountId: '1999892177251081',
    currency: 'INR', vertical: 'Wellness', status: 'ok', dot: 'g',
    badge: 'LIVE', badgeCls: 'sb-live', chip: 'Fragmentation 5 groups', chipCls: 'chip-a',
    score: 67, scoreColor: 'var(--amber)', scoreBg: 'var(--amber)',
    kpis: [
      { lbl: 'Leads', val: '216', cls: 'g' }, { lbl: 'Best CPL', val: '₹25', cls: 'g' },
      { lbl: 'Spend', val: '₹14.4K', cls: 'n' }, { lbl: 'ThruPlays', val: '57.6K', cls: 'g' }
    ],
    campaigns: [
      { name: 'delhi-if-panchkarma | 29th April', obj: 'leads', spend: '₹2,470', result: '100 Leads · CPL ₹25', resultCls: 'green', ctr: '4.22%', ctrCls: 'green', freq: '1.33', status: 'Active · Star 🌟', dot: 'on' },
      { name: 'mohali-if-panchkarma | 28th Jan', obj: 'leads', spend: '₹2,610', result: '38 Leads · CPL ₹69', resultCls: 'green', ctr: '2.41%', freq: '1.54', status: 'Active', dot: 'on' },
      { name: 'indore-if-panchkarma | 29th April', obj: 'leads', spend: '₹1,997', result: '78 Leads · CPL ₹26', resultCls: 'green', ctr: '2.65%', freq: '1.27', status: 'Active', dot: 'on' },
      { name: 'indore_SSW_TOFU', obj: 'aware', spend: '₹1,772', result: '18,346 ThruPlays · ₹0.097', resultCls: 'green', ctr: '0.16%', freq: '1.18', status: 'Active', dot: 'on' },
      { name: 'mohali_SSW_TOFU', obj: 'aware', spend: '₹1,765', result: '17,277 ThruPlays · ₹0.102', resultCls: 'green', ctr: '0.25%', freq: '1.28', status: 'Active', dot: 'on' },
      { name: 'delhi_SSW_TOFU', obj: 'aware', spend: '₹1,182', result: '10,096 ThruPlays · ₹0.117', resultCls: 'green', ctr: '0.30%', freq: '1.17', status: 'Active', dot: 'on' },
      { name: 'delhi_wa_panchkarma | 29th May CTWA', obj: 'leads', spend: '₹864', result: '10 Convos · CPR ₹86', resultCls: 'blue', ctr: '2.20%', freq: '1.58', status: 'Active', dot: 'on' },
      { name: 'ludhiana_SSW_TOFU', obj: 'aware', spend: '₹620', result: '6,129 ThruPlays · ₹0.101', resultCls: 'green', ctr: '0.24%', freq: '1.15', status: 'Active', dot: 'on' },
      { name: 'indore-wa-panchkarma | 29th May CTWA', obj: 'leads', spend: '₹796', result: '4 Convos · CPR ₹199', resultCls: 'amber', ctr: '1.55%', freq: '1.76', status: 'Active · High CPR', dot: 'on' },
    ],
    insight: { type: 'trend', title: '📊 This Week Standouts', items: ['Delhi: <b>100 leads at ₹25 CPL, 4.22% CTR</b> — top performer across ALL accounts', 'Indore: <b>78 leads at ₹26 CPL</b> — excellent alongside Delhi', 'Indore CTWA CPR ₹199 vs Delhi ₹86 — creative refresh needed in Indore'] },
    reco: { title: '🎯 Meta Recs (Score 67)', items: ['✨ <b>A+ Creative on 10 ads</b> — 23% lower CPR (+6pts)', '🔗 <b>Consolidate 5 fragmented TOFU ad set groups</b> — more Awareness (+1–2pts each)', '👥 <b>Switch 3 ad sets to Advantage+ Audience</b> — 9.7% lower CPR'] }
  },
  {
    key: 'outlander', name: 'Outlander 4×4 New Zealand', accountId: '1318511879920658',
    currency: 'NZD', vertical: 'Auto/Services', status: 'ok', dot: 'g',
    badge: 'LIVE · NZD', badgeCls: 'sb-live', chip: null,
    score: 66, scoreColor: 'var(--amber)', scoreBg: 'var(--amber)',
    kpis: [
      { lbl: 'Convos', val: '108', cls: 'g' }, { lbl: 'Best CPR', val: 'NZ$3.37', cls: 'g' },
      { lbl: 'Spend', val: 'NZ$620', cls: 'n' }, { lbl: 'Best CTR', val: '2.44%', cls: 'g' }
    ],
    campaigns: [
      { name: 'Testimonial Videos | 19th Dec', obj: 'eng', spend: 'NZ$140', result: '35 Convos · NZ$3.99', resultCls: 'green', ctr: '2.40%', freq: '1.64', status: 'Active', dot: 'on' },
      { name: 'Complete Package | 10th Nov', obj: 'eng', spend: 'NZ$140', result: '20 Convos · NZ$6.98', resultCls: 'green', ctr: '1.80%', freq: '2.22', freqCls: 'amber', status: 'Active · Watch Freq', dot: 'on' },
      { name: 'Auckland | Snorkel | 21st May', obj: 'eng', spend: 'NZ$139', result: '33 Convos · NZ$4.21', resultCls: 'green', ctr: '1.84%', freq: '2.03', status: 'Active', dot: 'on' },
      { name: 'Winter Sale | 1st June', obj: 'eng', spend: 'NZ$57', result: '17 Convos · NZ$3.37', resultCls: 'green', ctr: '2.44%', ctrCls: 'green', freq: '1.98', status: 'Active · Scale ↑', dot: 'on' },
      { name: 'Video Campaign | 24th Apr', obj: 'eng', spend: 'NZ$92', result: '13 Convos · NZ$7.09', resultCls: 'amber', ctr: '1.72%', freq: '1.77', status: 'Paused', dot: 'na' },
      { name: 'Sale Creatives | Autumn Sale', obj: 'eng', spend: 'NZ$53', result: '7 Convos · NZ$7.61', resultCls: 'amber', ctr: '1.33%', freq: '1.58', status: 'Paused', dot: 'na' },
    ],
    insight: { type: 'trend', title: '📊 This Week', items: ['Winter Sale launched June 1: <b>NZ$3.37 CPR, 2.44% CTR</b> — scale immediately', 'Testimonials: <b>35 convos at NZ$3.99</b> — strong performer', 'Complete Package freq <b>2.22</b> — creative refresh approaching'] },
    reco: { title: '🎯 Meta Recs (Score 66)', items: ['📈 <b>Scale Winter Sale ad set</b> — +77% more convos (+11pts, biggest lift!)', '✨ <b>A+ Creative Enhancements</b> on 4 ads — 5% lower CPR (+10pts)', '🎵 <b>Add auto-music to 3 ads</b> — higher CTR (+3pts)'] }
  },
  {
    key: 'pratha', name: 'Pratha Preschool', accountId: '1851775342206755',
    currency: 'INR', vertical: 'Education', status: 'warn', dot: 'a',
    badge: 'FREQ CRITICAL', badgeCls: 'sb-warn', chip: 'Freq 3.27', chipCls: 'chip-r', chip2: 'Score 55', chip2Cls: 'chip-r',
    score: 55, scoreColor: 'var(--red)', scoreBg: 'var(--red)',
    kpis: [
      { lbl: 'CTWA (June)', val: '8', cls: 'g' }, { lbl: 'CPR June', val: '₹84', cls: 'g' },
      { lbl: 'ThruPlays', val: '12,274', cls: 'g' }, { lbl: 'Aware Freq', val: '3.27', cls: 'r' }
    ],
    campaigns: [
      { name: 'CTWA | Day Care | 1st June', obj: 'leads', spend: '₹674', result: '8 Convos · CPR ₹84', resultCls: 'green', ctr: '0.70%', freq: '1.24', status: 'Active', dot: 'on' },
      { name: 'CTWA | Day Care | 28th May', obj: 'leads', spend: '₹1,086', result: '5 Convos · CPR ₹217', resultCls: 'amber', ctr: '0.84%', freq: '1.58', status: 'Paused', dot: 'na' },
      { name: 'Awareness Video | 30th March', obj: 'aware', spend: '₹671', result: '12,274 ThruPlays · ₹0.055', resultCls: 'green', ctr: '0.00%', freq: '3.27', freqCls: 'red', status: 'Freq Critical', dot: 'warn' },
    ],
    insight: { type: 'err', title: '🚨 Opp Score Dropped to 55 — Freq 3.27', items: ['Awareness campaign: <b>freq 3.27</b> — audience fully saturated, pause immediately', 'May CTWA at CPR ₹217 vs June at ₹84 — keep June, keep May paused', 'Meta flags: add 9:16 Reels (+43pts to score!), switch to Advantage+ audience'] },
    reco: { title: '🎯 Meta Recs (Score 55)', items: ['📱 <b>Add 9:16 Reels</b> to CTWA ad set — 8% lower CPR (+43pts score lift!)', '👥 <b>Switch Awareness to Advantage+</b> — 37% lower CPT (+1pt)', '📈 <b>Scale Awareness budget</b> — +54% more ThruPlays (once creative refreshed)'] }
  },
  {
    key: 'asia', name: 'Asia Cosmetic Hospital', accountId: '1444189929969376',
    currency: 'THB', vertical: 'Healthcare', status: 'err', dot: 'r',
    badge: '0 LEADS', badgeCls: 'sb-err', chip: 'Freq 3.23', chipCls: 'chip-r',
    score: null,
    kpis: [
      { lbl: 'Spend', val: '฿6,054', cls: 'n' }, { lbl: 'Leads', val: '0', cls: 'r' },
      { lbl: 'Campaigns', val: '1', cls: 'n' }, { lbl: 'Freq', val: '3.23', cls: 'r' }
    ],
    campaigns: [
      { name: 'META Leads | Compliances | 25th May', obj: 'leads', spend: '฿6,054', result: '0 Leads · CTR 1.05%', resultCls: 'red', ctr: '1.05%', freq: '3.23', freqCls: 'red', status: 'Paused (burnt)', dot: 'off' },
    ],
    insight: { type: 'err', title: '🚨 Critical — 0 Leads in 7 Days', items: ['Compliance campaign: <b>฿6K spent, 0 leads, freq 3.23</b> — completely burnt out', 'Only 1 campaign active last 7D — all others still paused', 'Action: Reactivate Tummy Tuck / Liposuction (฿140 CPL best performer)'] },
    reco: { type: 'trend', title: '📊 Account Context', items: ['Vertical: <b>MedSpa &amp; Elective Surgeries · Thailand (THB)</b>', 'No opportunity score — no active delivery generating signal data', 'Need fresh creative + new audience before any budget allocation'] }
  },
  {
    key: 'veriseek', name: 'Veriseek AI', accountId: '3252000788333236',
    currency: 'INR', vertical: 'EdTech', status: 'err', dot: 'r',
    badge: 'GRACE PERIOD', badgeCls: 'sb-err', chip: 'Nearly Dead', chipCls: 'chip-r',
    score: null,
    kpis: [
      { lbl: 'Active Spend', val: '₹36', cls: 'r' }, { lbl: 'Campaigns', val: '4', cls: 'n' },
      { lbl: 'Active', val: '1', cls: 'r' }, { lbl: 'Status', val: 'GRACE', cls: 'r' }
    ],
    campaigns: [
      { name: 'Awareness Page | 02nd April', obj: 'aware', spend: '₹166', result: '87 ThruPlays · ₹1.91', resultCls: 'green', ctr: '0.00%', freq: '1.27', status: 'Paused', dot: 'na' },
      { name: 'Engagement Campaign | 14th May', obj: 'eng', spend: '₹117', result: '81 Engagements · ₹1.44', resultCls: 'green', ctr: '0.96%', freq: '1.06', status: 'Paused', dot: 'na' },
      { name: 'Veriseek Waitlist | 13th May', obj: 'traffic', spend: '₹116', result: '5 Clicks · ₹23 CPC', resultCls: 'amber', ctr: '0.13%', freq: '1.05', status: 'Paused', dot: 'na' },
      { name: 'Brand Awareness | 16th April', obj: 'aware', spend: '₹36', result: '26 ThruPlays', resultCls: 'amber', ctr: '0.00%', freq: '1.03', status: 'Active (barely)', dot: 'warn' },
    ],
    insight: { type: 'err', title: '🚨 Billing Emergency — Fix NOW', items: ['Grace period: <b>only ₹435 total in last 7D</b> — 99% spend collapse', '3 of 4 campaigns paused — only Brand Awareness ₹36 trickling through', 'Fix billing in Meta Business Manager immediately or all delivery stops permanently'] },
    reco: { type: 'trend', title: '📊 Collapse Context', items: ['Grace period severely throttled all delivery to near-zero', 'All 4 campaigns have minimal impressions (39–4,755 total)', 'Requires billing fix BEFORE any optimization changes'] }
  },
  {
    key: 'faith', name: 'Faith Diagnostics', accountId: '330235162',
    currency: 'INR', vertical: 'Healthcare', status: 'err', dot: 'r',
    badge: 'SPEND LIMIT', badgeCls: 'sb-err', chip: null,
    score: null,
    kpis: [
      { lbl: 'Lead Spend', val: '₹0', cls: 'r' }, { lbl: 'Only Active', val: 'Boost', cls: 'n' },
      { lbl: 'Boost Spend', val: '₹424', cls: 'n' }, { lbl: 'Delivery', val: 'BLOCKED', cls: 'r' }
    ],
    campaigns: [],
    errBox: '🚨 Only activity in last 7D: <b>Faith Diagnostic | Boosts</b> — ₹424 spent on post engagement (2,036 interactions). Zero lead campaigns running. All lead campaigns still blocked by spend limit. Increase account-level spend cap in Meta Business Manager to resume lead delivery immediately.'
  },
  {
    key: 'north-new', name: 'North International (New — Hiring)', accountId: '1418599015829087',
    currency: 'INR', vertical: 'Education', status: 'err', dot: 'r',
    badge: 'SPEND LIMIT', badgeCls: 'sb-err', chip: null,
    score: null,
    kpis: [
      { lbl: 'Spend', val: '₹0', cls: 'r' }, { lbl: 'Delivery', val: 'BLOCKED', cls: 'r' }
    ],
    campaigns: [],
    errBox: '🚨 Zero spend in last 7D. No campaigns returned from API — account appears completely blocked. Reset spend cap in Meta Ads Manager.'
  },
  {
    key: 'bodyt', name: 'Body Temple', accountId: '2001372527419414',
    currency: 'INR', vertical: 'Health/Fitness', status: 'off', dot: 'e',
    badge: 'NOT MCP-ENABLED', badgeCls: 'sb-off', chip: null,
    score: null,
    kpis: [{ lbl: 'MCP', val: 'OFF', cls: 'n' }],
    campaigns: [],
    noDataBox: 'MCP rollout pending. Monitor via Meta Ads Manager directly.'
  }
]

const OBJ_MAP = {
  leads: 'obj-leads', sales: 'obj-sales', aware: 'obj-aware',
  eng: 'obj-eng', traffic: 'obj-traffic', blocked: 'obj-blocked'
}
const OBJ_LABEL = {
  leads: 'LEADS', sales: 'SALES', aware: 'AWARENESS',
  eng: 'ENGAGEMENT', traffic: 'TRAFFIC', blocked: 'BLOCKED'
}
const COLOR_MAP = { green: 'var(--green-dk)', red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue-dk)' }

function ObjBadge({ type }) {
  return <span className={`obj-b ${OBJ_MAP[type] || ''}`}>{OBJ_LABEL[type] || type.toUpperCase()}</span>
}

function StInd({ dot, label }) {
  return <div className="st-ind"><div className={`st-dot ${dot}`}></div>{label}</div>
}

function InsightBox({ box }) {
  if (!box) return null
  const cls = box.type === 'err' ? 'ib-err' : box.type === 'warn' ? 'ib-warn' : box.type === 'reco' ? 'ib-reco' : 'ib-trend'
  return (
    <div className={`insight-box ${cls}`}>
      <div className="ib-ttl">{box.title}</div>
      {box.items.map((item, i) => <div key={i} className="ib-item" dangerouslySetInnerHTML={{ __html: item }} />)}
    </div>
  )
}

function AccCard({ client, isVisible }) {
  const [open, setOpen] = useState(false)
  if (!isVisible) return null

  return (
    <div className={`acc-card ${client.status}${open ? ' open' : ''}`} data-client={client.key}>
      <div className="acc-hdr" onClick={() => setOpen(o => !o)}>
        <div className="acc-exp">›</div>
        <div className={`acc-sdot ${client.dot}`}></div>
        <div className="acc-info">
          <div className="acc-name">{client.name}</div>
          <div className="acc-meta">#{client.accountId} · {client.currency} · {client.vertical} · Last 7D</div>
        </div>
        <div className="acc-kpis">
          {client.kpis.map((k, i) => (
            <div key={i} className="kc">
              <div className="kc-lbl">{k.lbl}</div>
              <div className={`kc-val ${k.cls}`}>{k.val}</div>
            </div>
          ))}
        </div>
        <div className="acc-right">
          <div className="acc-badges">
            <span className={`s-badge ${client.badgeCls}`}>{client.badge}</span>
            {client.chip && <span className={client.chipCls}>{client.chip}</span>}
            {client.chip2 && <span className={client.chip2Cls}>{client.chip2}</span>}
          </div>
          {client.score !== null && client.score !== undefined && (
            <div className="opp-score">
              <span className="opp-lbl">Score</span>
              <div className="opp-bar"><div className="opp-fill" style={{ width: `${client.score}%`, background: client.scoreBg }}></div></div>
              <span className="opp-num" style={{ color: client.scoreColor }}>{client.score}</span>
            </div>
          )}
        </div>
      </div>
      <div className="acc-body">
        {client.errBox && <div className="err-box" dangerouslySetInnerHTML={{ __html: client.errBox }} />}
        {client.noDataBox && <div className="no-data-box">{client.noDataBox}</div>}
        {client.campaigns && client.campaigns.length > 0 && (
          <table className="camp-tbl">
            <thead><tr><th>Campaign</th><th>Obj</th><th>Spend</th><th>Results</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
            <tbody>
              {client.campaigns.map((c, i) => (
                <tr key={i}>
                  <td><b>{c.name}</b></td>
                  <td><ObjBadge type={c.obj} /></td>
                  <td>{c.spend}</td>
                  <td style={{ color: COLOR_MAP[c.resultCls], fontWeight: 600 }}>{c.result}</td>
                  <td style={c.ctrCls ? { color: COLOR_MAP[c.ctrCls] } : {}}>{c.ctr}</td>
                  <td style={c.freqCls ? { color: COLOR_MAP[c.freqCls] } : {}}>{c.freq}</td>
                  <td><StInd dot={c.dot} label={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(client.insight || client.reco) && (
          <div className="insight-row">
            {client.insight && <InsightBox box={client.insight} />}
            {client.reco && <InsightBox box={{ ...client.reco, type: 'reco' }} />}
          </div>
        )}
      </div>
    </div>
  )
}

// All campaigns flat list
const ALL_CAMPAIGNS = [
  { client: 'ssw', clientName: 'SSW Mohali', name: 'delhi-if-panchkarma', obj: 'leads', spend: '₹2,470', result: '100 Leads · ₹25', resultCls: 'green', ctr: '4.22%', ctrCls: 'green', freq: '1.33', status: 'Active', dot: 'on' },
  { client: 'ssw', clientName: 'SSW Mohali', name: 'mohali-if-panchkarma', obj: 'leads', spend: '₹2,610', result: '38 Leads · ₹69', resultCls: 'green', ctr: '2.41%', freq: '1.54', status: 'Active', dot: 'on' },
  { client: 'ssw', clientName: 'SSW Mohali', name: 'indore-if-panchkarma', obj: 'leads', spend: '₹1,997', result: '78 Leads · ₹26', resultCls: 'green', ctr: '2.65%', freq: '1.27', status: 'Active', dot: 'on' },
  { client: 'ssw', clientName: 'SSW Mohali', name: 'delhi CTWA | 29th May', obj: 'leads', spend: '₹864', result: '10 Convos · ₹86', resultCls: 'blue', ctr: '2.20%', freq: '1.58', status: 'Active', dot: 'on' },
  { client: 'ssw', clientName: 'SSW Mohali', name: 'indore CTWA | 29th May', obj: 'leads', spend: '₹796', result: '4 Convos · ₹199', resultCls: 'amber', ctr: '1.55%', freq: '1.76', status: 'Active', dot: 'on' },
  { client: 'ssw', clientName: 'SSW Mohali', name: 'TOFU: Indore/Mohali/Delhi/Ludhiana', obj: 'aware', spend: '₹5,339', result: '57.6K ThruPlays', resultCls: 'green', ctr: '0.24%', freq: '1.19', status: 'Active', dot: 'on' },
  { client: 'honda', clientName: 'Honda', name: 'Okhla Leads | May_HONDA', obj: 'leads', spend: '₹2,022', result: '40 Leads · ₹51', resultCls: 'green', ctr: '1.64%', ctrCls: 'green', freq: '1.79', status: 'Active', dot: 'on' },
  { client: 'honda', clientName: 'Honda', name: 'Chandigarh Leads | May_HONDA', obj: 'leads', spend: '₹2,004', result: '21 Leads · ₹95', resultCls: 'green', ctr: '1.13%', freq: '2.00', freqCls: 'amber', status: 'Active', dot: 'on' },
  { client: 'honda', clientName: 'Honda', name: 'Panipat Leads | May_HONDA', obj: 'leads', spend: '₹1,406', result: '26 Leads · ₹54', resultCls: 'green', ctr: '0.78%', freq: '1.59', status: 'Active', dot: 'on' },
  { client: 'honda', clientName: 'Honda', name: 'Karnal Leads | May_HONDA', obj: 'leads', spend: '₹1,319', result: '23 Leads · ₹57', resultCls: 'green', ctr: '0.96%', freq: '1.73', status: 'Active · ✅ Improved', dot: 'on' },
  { client: 'pyarababy', clientName: 'PyaraBaby', name: 'Scalled Campaign | 18th May', obj: 'sales', spend: '₹10,987', result: '7 Purchases · ₹1,570', resultCls: 'amber', ctr: '1.42%', freq: '1.81', status: 'Active', dot: 'on' },
  { client: 'pyarababy', clientName: 'PyaraBaby', name: 'Stroller Catalogue | Adv+', obj: 'sales', spend: '₹9,803', result: '2 Purchases · ₹4,901', resultCls: 'red', ctr: '2.87%', freq: '2.26', freqCls: 'amber', status: 'Paused · No ROAS', dot: 'warn' },
  { client: 'pyarababy', clientName: 'PyaraBaby', name: 'Lead Gen | Sellers | 7th April', obj: 'leads', spend: '₹5,362', result: '1,529 Convos · ₹3.51', resultCls: 'blue', ctr: '2.84%', freq: '1.28', status: 'Paused', dot: 'na' },
  { client: 'pyarababy', clientName: 'PyaraBaby', name: 'Lead Gen | Sellers | WABA', obj: 'leads', spend: '₹1,934', result: '570 Convos · ₹3.39', resultCls: 'blue', ctr: '1.55%', freq: '2.32', freqCls: 'amber', status: 'Active', dot: 'on' },
  { client: 'pyarababy', clientName: 'PyaraBaby', name: 'Remarketing Catalogue | 18th May', obj: 'sales', spend: '₹1,942', result: '4 Purchases · ₹486', resultCls: 'green', ctr: '8.53%', ctrCls: 'green', freq: '2.54', status: 'Active · Best', dot: 'on' },
  { client: 'north-old', clientName: 'North Intl (Old)', name: 'Finland | Malta Open Campaign', obj: 'leads', spend: '₹4,851', result: '40 Leads · ₹121', resultCls: 'amber', ctr: '2.04%', freq: '1.82', status: 'Active', dot: 'on' },
  { client: 'north-old', clientName: 'North Intl (Old)', name: 'Generic Campaign | Lead Gen', obj: 'leads', spend: '₹4,552', result: '57 Leads · ₹80', resultCls: 'green', ctr: '2.11%', freq: '1.91', status: 'Active', dot: 'on' },
  { client: 'north-old', clientName: 'North Intl (Old)', name: 'CTWA Finland | 14th April', obj: 'leads', spend: '₹1,291', result: '32 Convos · ₹40', resultCls: 'blue', ctr: '1.95%', freq: '1.61', status: 'Active', dot: 'on' },
  { client: 'north-old', clientName: 'North Intl (Old)', name: 'Finland Study Visa | PAN INDIA', obj: 'leads', spend: '₹989', result: '33 Leads · ₹30', resultCls: 'green', ctr: '3.90%', ctrCls: 'green', freq: '1.87', status: 'Active · Best CTR', dot: 'on' },
  { client: 'north-old', clientName: 'North Intl (Old)', name: 'Schengen/TOFU Awareness', obj: 'aware', spend: '₹1,128', result: '17,426 ThruPlays', resultCls: 'green', ctr: '0.11%', freq: '1.41', status: 'Active', dot: 'on' },
  { client: 'outlander', clientName: 'Outlander NZ', name: 'Testimonial Videos | 19th Dec', obj: 'eng', spend: 'NZ$140', result: '35 Convos · NZ$3.99', resultCls: 'green', ctr: '2.40%', freq: '1.64', status: 'Active', dot: 'on' },
  { client: 'outlander', clientName: 'Outlander NZ', name: 'Auckland | Snorkel | 21st May', obj: 'eng', spend: 'NZ$139', result: '33 Convos · NZ$4.21', resultCls: 'green', ctr: '1.84%', freq: '2.03', status: 'Active', dot: 'on' },
  { client: 'outlander', clientName: 'Outlander NZ', name: 'Winter Sale | 1st June', obj: 'eng', spend: 'NZ$57', result: '17 Convos · NZ$3.37', resultCls: 'green', ctr: '2.44%', ctrCls: 'green', freq: '1.98', status: 'Active · Scale ↑', dot: 'on' },
  { client: 'volvo', clientName: 'Volvo', name: 'Vijayawada | Feb 2026', obj: 'leads', spend: '₹2,129', result: '21 Leads · ₹101', resultCls: 'green', ctr: '0.72%', freq: '1.55', status: 'Active', dot: 'on' },
  { client: 'volvo', clientName: 'Volvo', name: 'Hyderabad | Feb 2026', obj: 'leads', spend: '₹1,895', result: '21 Leads · ₹90', resultCls: 'green', ctr: '0.61%', freq: '1.55', status: 'Active', dot: 'on' },
  { client: 'volvo', clientName: 'Volvo', name: 'CHD Awareness — XC60 99 Years', obj: 'aware', spend: '₹653', result: 'Reach 243,699', resultCls: 'green', ctr: '0.14%', freq: '1.17', status: 'Active', dot: 'on' },
  { client: 'pratha', clientName: 'Pratha', name: 'CTWA | Day Care | 1st June', obj: 'leads', spend: '₹674', result: '8 Convos · ₹84', resultCls: 'green', ctr: '0.70%', freq: '1.24', status: 'Active', dot: 'on' },
  { client: 'pratha', clientName: 'Pratha', name: 'Awareness Video | 30th March', obj: 'aware', spend: '₹671', result: '12,274 ThruPlays', resultCls: 'green', ctr: '0.00%', freq: '3.27', freqCls: 'red', status: 'Freq Critical', dot: 'warn' },
  { client: 'asia', clientName: 'Asia Cosmetic', name: 'META Leads | Compliances | 25th May', obj: 'leads', spend: '฿6,054', result: '0 Leads · Freq 3.23', resultCls: 'red', ctr: '1.05%', freq: '3.23', freqCls: 'red', status: 'Paused · Burnt', dot: 'off' },
  { client: 'veriseek', clientName: 'Veriseek', name: 'Brand Awareness | 16th April', obj: 'aware', spend: '₹36', result: '26 ThruPlays', resultCls: 'amber', ctr: '0.00%', freq: '1.03', status: 'Active (barely)', dot: 'warn' },
  { client: 'faith', clientName: 'Faith Diagnostics', name: 'Faith | Boosts', obj: 'eng', spend: '₹424', result: '2,036 Interactions', resultCls: 'n', ctr: '0.05%', freq: '1.38', status: 'Paused', dot: 'na' },
  { client: 'north-new', clientName: 'North Intl (New)', name: 'North Intl New — All Campaigns', obj: 'blocked', spend: '₹0', result: 'Spend limit', resultCls: 'red', ctr: '—', freq: '—', status: 'Blocked', dot: 'off' },
]

export default function Dashboard() {
  const [view, setView] = useState('accounts')
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('Last 7D')

  const sidebar = [
    { section: 'All Clients' },
    { key: 'all', dot: 'g', name: 'All Accounts' },
    { section: 'Opp Score · Active', mt: true },
    { key: 'volvo', dot: 'g', name: 'Volvo', score: '88', scoreCls: 'sc-hi' },
    { key: 'north-old', dot: 'g', name: 'North Intl (Old)', score: '81', scoreCls: 'sc-hi' },
    { key: 'pyarababy', dot: 'g', name: 'PyaraBaby', score: '80', scoreCls: 'sc-hi' },
    { key: 'honda', dot: 'g', name: 'Courtesy Honda', score: '71', scoreCls: 'sc-md' },
    { key: 'ssw', dot: 'a', name: 'SSW Mohali', score: '67', scoreCls: 'sc-lo' },
    { key: 'outlander', dot: 'a', name: 'Outlander NZ', score: '66', scoreCls: 'sc-lo' },
    { key: 'pratha', dot: 'r', name: 'Pratha Preschool', score: '55', scoreCls: 'sc-lo' },
    { section: 'Issues', mt: true },
    { key: 'faith', dot: 'r', name: 'Faith Diagnostics', score: '—', scoreCls: 'sc-na' },
    { key: 'asia', dot: 'r', name: 'Asia Cosmetic', score: '—', scoreCls: 'sc-na' },
    { key: 'veriseek', dot: 'r', name: 'Veriseek AI', score: '—', scoreCls: 'sc-na' },
    { key: 'north-new', dot: 'r', name: 'North Intl (New)', score: '—', scoreCls: 'sc-na' },
    { section: 'Not Enabled', mt: true },
    { key: 'bodyt', dot: 'e', name: 'Body Temple', score: '—', scoreCls: 'sc-na' },
  ]

  const filteredCamps = filter === 'all' ? ALL_CAMPAIGNS : ALL_CAMPAIGNS.filter(c => c.client === filter)

  return (
    <>
      {/* BG decorative */}
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
        <div className="topbar-div"></div>
        <span className="topbar-lbl">Meta Intelligence · Live</span>
        <div className="view-tabs">
          {['accounts','campaigns','alerts'].map(v => (
            <div key={v} className={`vtab${view===v?' active':''}`} onClick={() => setView(v)}>
              {v === 'accounts' ? 'Account View' : v === 'campaigns' ? 'Campaign Table' : 'Alerts & Recommendations'}
            </div>
          ))}
        </div>
        <div className="topbar-right">
          <span className="pill pill-g">● 9 Active</span>
          <span className="pill pill-r">🔴 2 Blocked</span>
          <span className="pill pill-a">⚠ 1 Grace Period</span>
          <button className="refresh-btn" onClick={() => window.location.reload()}>↻ Refresh</button>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        {sidebar.map((item, i) => {
          if (item.section) return (
            <div key={i} className="sb-section" style={item.mt ? { marginTop: 4 } : {}}>{item.section}</div>
          )
          return (
            <div key={i} className={`sb-item${filter===item.key?' active':''}`} onClick={() => setFilter(item.key)}>
              <div className={`sb-dot ${item.dot}`}></div>
              <span className="sb-name">{item.name}</span>
              {item.score !== undefined && <span className={`sb-score ${item.scoreCls}`}>{item.score}</span>}
            </div>
          )
        })}
        <div className="sb-section" style={{ marginTop: 6 }}>Info</div>
        <div className="sb-info">
          📅 Last 7D · Jun 4, 2026<br/>
          🔗 Meta MCP · Live<br/>
          <span style={{ color: 'var(--red)' }}>🔴 Veriseek: IN_GRACE_PERIOD</span><br/>
          <span style={{ color: 'var(--red)' }}>🔴 Faith + North New: Blocked</span><br/>
          <span style={{ color: 'var(--text3)' }}>⚫ 1 not MCP-enabled</span>
        </div>
      </div>

      {/* STATSBAR */}
      <div className="statsbar">
        <div className="kpi-pill kpi-g"><div className="kpi-dot"></div><span className="kpi-lbl">SSW Leads</span><span className="kpi-val">216</span></div>
        <div className="kpi-pill kpi-g"><div className="kpi-dot"></div><span className="kpi-lbl">Honda Leads</span><span className="kpi-val">110</span></div>
        <div className="kpi-pill kpi-b"><div className="kpi-dot"></div><span className="kpi-lbl">PB WABA Convos</span><span className="kpi-val">570</span></div>
        <div className="kpi-pill kpi-g"><div className="kpi-dot"></div><span className="kpi-lbl">Outlander Convos</span><span className="kpi-val">108</span></div>
        <div className="kpi-pill kpi-g"><div className="kpi-dot"></div><span className="kpi-lbl">Volvo Leads</span><span className="kpi-val">48</span></div>
        <div className="kpi-pill kpi-r"><div className="kpi-dot"></div><span className="kpi-lbl">Blocked/Grace</span><span className="kpi-val">3</span></div>
        <div className="sb-sep"></div>
        <div className="date-grp">
          {['Last 7D','14D','30D','This Month'].map(d => (
            <button key={d} className={`dr${dateRange===d?' active':''}`} onClick={() => setDateRange(d)}>{d}</button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="main-wrap"><div className="main">

        {/* ACCOUNT VIEW */}
        <div className={`view-section${view==='accounts'?' active':''}`}>
          <div className="alerts-strip">
            <div className="al-chip r">🚨 <span className="al-chip-txt"><b>Asia Cosmetic:</b> 0 leads · ฿6,054 spent · Freq 3.23 — audience burnt</span></div>
            <div className="al-chip r">🚨 <span className="al-chip-txt"><b>Veriseek:</b> IN_GRACE_PERIOD — only ₹435 active in 7D (99% collapse)</span></div>
            <div className="al-chip r">🚨 <span className="al-chip-txt"><b>Faith + North New:</b> Spend limit — 0 lead campaigns running</span></div>
            <div className="al-chip a">⚠ <span className="al-chip-txt"><b>Pratha:</b> Awareness freq 3.27 — critical fatigue · Opp Score dropped to 55</span></div>
            <div className="al-chip a">⚠ <span className="al-chip-txt"><b>PyaraBaby:</b> Stroller CPP ₹4,901 — ₹9.8K wasted on 2 purchases</span></div>
          </div>
          <div className="sec-hdr">
            <div className="sec-ttl">Client Accounts <span className="live-badge">● LIVE · Meta MCP · Last 7D · Jun 4, 2026</span></div>
          </div>
          <div className="accounts" id="acc-list">
            {CLIENTS.map(c => (
              <AccCard key={c.key} client={c} isVisible={filter === 'all' || filter === c.key} />
            ))}
            {CLIENTS.every(c => filter !== 'all' && filter !== c.key) && (
              <div className="empty-state"><p>No account found for this filter.</p></div>
            )}
          </div>
        </div>

        {/* CAMPAIGNS TABLE */}
        <div className={`view-section${view==='campaigns'?' active':''}`}>
          <div className="sec-hdr">
            <div className="sec-ttl">All Campaigns <span className="live-badge">● LIVE · Last 7D · Jun 4, 2026</span></div>
          </div>
          <div className="tbl-wrap">
            <table className="all-camp-tbl">
              <thead><tr><th>Campaign</th><th>Client</th><th>Obj</th><th>Spend</th><th>Result</th><th>CTR</th><th>Freq</th><th>Status</th></tr></thead>
              <tbody>
                {filteredCamps.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No campaigns found for this client.</td></tr>
                )}
                {filteredCamps.map((c, i) => (
                  <tr key={i} data-client={c.client}>
                    <td><b>{c.name}</b></td>
                    <td style={{ color: 'var(--text2)' }}>{c.clientName}</td>
                    <td><ObjBadge type={c.obj} /></td>
                    <td style={c.spend === '₹0' ? { color: 'var(--red)' } : {}}>{c.spend}</td>
                    <td style={{ color: COLOR_MAP[c.resultCls] || 'var(--text2)', fontWeight: COLOR_MAP[c.resultCls] ? 600 : 400 }}>{c.result}</td>
                    <td style={c.ctrCls ? { color: COLOR_MAP[c.ctrCls] } : {}}>{c.ctr}</td>
                    <td style={c.freqCls ? { color: COLOR_MAP[c.freqCls] } : {}}>{c.freq}</td>
                    <td><StInd dot={c.dot} label={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ALERTS & RECS */}
        <div className={`view-section${view==='alerts'?' active':''}`}>
          <div className="sec-hdr">
            <div className="sec-ttl">Alerts &amp; Recommendations <span className="live-badge">● LIVE · Last 7D · Jun 4, 2026</span></div>
          </div>

          {/* Critical */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{ background: 'rgba(224,82,82,0.03)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🚨 Critical — Fix Today</span>
              <span className="pill pill-r">4 Critical</span>
            </div>
            {[
              { ico: 'r', emoji: '🚨', ttl: 'Veriseek AI — IN_GRACE_PERIOD · Spend Collapsed 99% · Billing Emergency', sub: 'Only ₹435 total spend last 7D vs normal levels. Brand Awareness alone active at ₹36. 3 of 4 campaigns fully paused. Fix billing in Meta Business Manager NOW or all delivery stops permanently.', tag: 'Veriseek', btn: 'Fix Billing →' },
              { ico: 'r', emoji: '🚨', ttl: 'Asia Cosmetic — 0 Leads in 7 Days · Compliance Campaign Burnt (Freq 3.23)', sub: '฿6,054 spent, zero leads, frequency 3.23 — audience completely saturated. Campaign now paused. Reactivate Tummy Tuck / Liposuction campaigns (฿140 CPL was best performer) with fresh creative and new audience segments.', tag: 'Asia Cosmetic', btn: 'Take Action →' },
              { ico: 'r', emoji: '🚨', ttl: 'Faith Diagnostics — Lead Campaigns Blocked · Spend Limit Not Lifted', sub: 'Only ₹424 on post engagement boosts (2,036 interactions). Zero leads. Spend limit preventing all lead ad delivery. Increase account-level spend cap in Meta Business Manager.', tag: 'Faith', btn: 'Fix in Meta →' },
              { ico: 'r', emoji: '🚨', ttl: 'North Intl (New/Hiring) — Zero Spend · Account Fully Blocked', sub: 'Zero campaigns returned from API. No spend whatsoever in last 7D. Account appears completely blocked by spend limit. Reset spend cap in Ads Manager to restore delivery.', tag: 'North Intl New', btn: 'Fix in Meta →' },
            ].map((a, i) => (
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.ico}`}>{a.emoji}</div>
                <div className="ar-body"><div className="ar-ttl">{a.ttl}</div><div className="ar-sub">{a.sub}</div></div>
                <span className="ar-tag">{a.tag}</span>
                <button className="ar-btn">{a.btn}</button>
              </div>
            ))}
          </div>

          {/* Warnings */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{ background: 'rgba(217,119,6,0.03)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>⚠ Warnings — Action This Week</span>
              <span className="pill pill-a">4 Warnings</span>
            </div>
            {[
              { ico: 'a', emoji: '⚠️', ttl: 'Pratha Preschool — Freq 3.27 · Opp Score Dropped to 55 · Urgent Creative Refresh', sub: 'Awareness campaign frequency hit 3.27 — audience completely saturated. Opp Score fell to 55 (was higher). Pause Awareness immediately or refresh creative + expand audience. June CTWA at ₹84 CPR is healthy — keep it.', tag: 'Pratha', btn: 'Pause/Refresh →' },
              { ico: 'a', emoji: '⚠️', ttl: 'PyaraBaby — Stroller Catalogue: ₹9,803 Spent, Only 2 Purchases (CPP ₹4,901)', sub: 'Campaign now paused. ₹9.8K burned for 2 purchases. Remarketing Catalogue is far more efficient at ₹486 CPP with 8.53% CTR. Consolidate budget into Remarketing and WABA where CPR is ₹3.39.', tag: 'PyaraBaby', btn: 'Reallocate →' },
              { ico: 'a', emoji: '⚠️', ttl: 'SSW Mohali — 5 Fragmented Ad Set Groups · Meta Flagging Consolidation', sub: 'Multiple ad sets with similar setups but different creatives reducing Awareness delivery. Indore CTWA CPR ₹199 vs Delhi ₹86 — same setup, big gap, needs creative review. Meta recommends consolidation for budget efficiency.', tag: 'SSW Mohali', btn: 'Consolidate →' },
              { ico: 'a', emoji: '⚠️', ttl: 'Honda — Chandigarh Frequency at 2.00 · Watch for Fatigue', sub: 'Chandigarh campaign frequency reached 2.00 this week. CPL at ₹95 (vs Okhla ₹51). If CPL rises further or frequency hits 2.5, refresh creative or expand audience targeting. Two ad sets are also budget-limited — consider increasing cap.', tag: 'Honda', btn: 'Monitor →' },
            ].map((a, i) => (
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.ico}`}>{a.emoji}</div>
                <div className="ar-body"><div className="ar-ttl">{a.ttl}</div><div className="ar-sub">{a.sub}</div></div>
                <span className="ar-tag">{a.tag}</span>
                <button className="ar-btn">{a.btn}</button>
              </div>
            ))}
          </div>

          {/* Scale */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{ background: 'rgba(125,194,66,0.03)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📈 Scale Opportunities</span>
              <span className="pill pill-g">3 Opportunities</span>
            </div>
            {[
              { ico: 'g', emoji: '⭐', ttl: 'SSW Delhi — 100 Leads at ₹25 CPL, 4.22% CTR · Best Campaign Across All Accounts', sub: 'Delhi panchkarma is the single strongest performing campaign in the entire Meraki portfolio this week. 100 leads, ₹25 CPL, 4.22% CTR, freq 1.33 — enormous headroom to scale. Increase daily budget immediately.', tag: 'SSW Mohali', lift: '↑ Scale Now', btn: 'Increase Budget →' },
              { ico: 'g', emoji: '📈', ttl: 'Outlander NZ — Winter Sale · NZ$3.37 CPR · Meta: +77% More Conversions if Scaled', sub: 'Launched June 1st. Best CPR (NZ$3.37) and CTR (2.44%) in account. Meta Opportunity Score flags this exact ad set for scaling — +77% more conversions at +11pts score improvement. Act this week while it\'s fresh.', tag: 'Outlander NZ', lift: '+77% convos', btn: 'Scale Budget →' },
              { ico: 'g', emoji: '📈', ttl: 'Honda Okhla — 40 Leads at ₹51 CPL, 1.64% CTR · Consider Budget Increase', sub: 'Okhla is consistently the best-performing Honda campaign. ₹51 CPL with 40 leads. Meta has 2 ad sets flagged as budget-limited — the system is ready to spend more and generate more leads if cap is raised.', tag: 'Honda', lift: '₹51 CPL', btn: 'Scale Budget →' },
            ].map((a, i) => (
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.ico}`}>{a.emoji}</div>
                <div className="ar-body"><div className="ar-ttl">{a.ttl}</div><div className="ar-sub">{a.sub}</div></div>
                <span className="ar-tag">{a.tag}</span>
                <span className="ar-lift">{a.lift}</span>
                <button className="ar-btn">{a.btn}</button>
              </div>
            ))}
          </div>

          {/* Meta Recs */}
          <div className="alerts-panel">
            <div className="ap-hdr" style={{ background: 'rgba(41,171,226,0.03)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🎯 Top Meta Recommendations — Cross-Account</span>
              <span className="pill pill-b">Live · Meta API</span>
            </div>
            {[
              { ico: 'b', emoji: '✨', ttl: 'Enable A+ Creative Enhancements — Honda (+14pts), PyaraBaby (+4pts), Outlander (+10pts), SSW (+6pts)', sub: 'Honda: 11% lower CPR. PyaraBaby: 19% lower CPR. Outlander: 5% lower CPR. SSW: 23% lower CPR. Single action, multi-account impact. Applies across 20+ ads. Zero cost to enable.', tag: '4 Accounts', lift: 'Up to 23% lower CPR', btn: 'Apply →' },
              { ico: 'b', emoji: '🔗', ttl: 'Connect CRM via Conversions API — Volvo (+6pts), North Intl (+6pts), Honda (+3pts), SSW (+2pts)', sub: 'All 4 lead-gen accounts have active CAPI CRM recommendation. Estimated 24% lower CPL across all. North Intl Malta campaign alone worth +6pt score lift. Volvo Vijayawada also flagged for +3pts.', tag: '4 Accounts', lift: '24% lower CPL', btn: 'Setup CAPI →' },
              { ico: 'b', emoji: '🎵', ttl: 'Add Auto Music — Volvo (52% lower CPR, +3pts), Outlander (+3pts), North Intl (16% lower, +2pts)', sub: 'Free, zero-effort action — Meta adds music automatically. Volvo has the biggest potential lift (52% lower CPR on 3 ads). Outlander and North Intl also flagged. Enable in 30 seconds per account.', tag: '3 Accounts', lift: 'Up to 52% lower CPR', btn: 'Enable →' },
              { ico: 'b', emoji: '📱', ttl: 'Add 9:16 Reels — Pratha (+43pts!!), SSW (+2pts each on 3 ad sets), North Intl (+1pt)', sub: 'Pratha has a massive +43pt score lift available from adding a single 9:16 Reels creative to the CTWA ad set. SSW flagged for 8% lower CPR on 3 ad sets. North Intl 8% lower CPR on 2 campaigns.', tag: '3 Accounts', lift: 'Up to +43pts', btn: 'Create Reels →' },
            ].map((a, i) => (
              <div key={i} className="alert-row">
                <div className={`ar-ico ${a.ico}`}>{a.emoji}</div>
                <div className="ar-body"><div className="ar-ttl">{a.ttl}</div><div className="ar-sub">{a.sub}</div></div>
                <span className="ar-tag">{a.tag}</span>
                <span className="ar-lift">{a.lift}</span>
                <button className="ar-btn">{a.btn}</button>
              </div>
            ))}
          </div>
        </div>

      </div></div>
    </>
  )
}
