import nodemailer from 'nodemailer';

const META_PROXY_BASE = 'https://meraki-meta-internal-dashboard.vercel.app/api/meta';

const CLIENTS = [
  { name:'Volvo (Krishna)',              accountId:'833603637085666',  currency:'INR' },
  { name:'North International (Old)',    accountId:'1297775434831152', currency:'INR' },
  { name:'PyaraBaby',                    accountId:'254564808465114',  currency:'INR' },
  { name:'Courtesy Honda',              accountId:'787341982723949',  currency:'INR' },
  { name:'SSW Mohali',                   accountId:'1999892177251081', currency:'INR' },
  { name:'Outlander 4×4 NZ',             accountId:'1318511879920658', currency:'NZD' },
  { name:'Pratha Preschool',             accountId:'1851775342206755', currency:'INR' },
  { name:'Asia Cosmetic Hospital',       accountId:'1444189929969376', currency:'THB' },
  { name:'Veriseek AI',                  accountId:'3252000788333236', currency:'INR' },
  { name:'Faith Diagnostics',            accountId:'330235162',        currency:'INR' },
  { name:'North International (New)',    accountId:'1418599015829087', currency:'INR' },
  { name:'Body Temple',                  accountId:'9141434999257273', currency:'INR' },
];

const SYM = c => c === 'THB' ? '฿' : c === 'NZD' ? 'NZ$' : '₹';

function fmtSpend(n, sym) {
  const v = parseFloat(n || 0);
  if (!v) return sym + '0';
  return sym + Math.round(v).toLocaleString('en-IN');
}

function parseResults(actions, spend, currency, actionValues) {
  if (!actions?.length) return '—';
  const s = SYM(currency);
  const PURCH = ['purchase','omni_purchase'];
  const LEAD  = ['lead','leadgen_grouped','onsite_conversion.lead','onsite_conversion.lead_grouped','contact_total','contact','onsite_web_lead'];
  const CONV  = ['onsite_conversion.messaging_first_reply','messaging_first_reply'];
  for (const [types, lbl] of [[PURCH,'Purchases'],[LEAD,'Leads'],[CONV,'Convos']]) {
    for (const t of types) {
      const a = actions.find(x => x.action_type === t || x.action_type?.startsWith(t));
      if (a && parseInt(a.value) > 0) {
        const cnt = parseInt(a.value);
        const cpa = cnt > 0 && spend > 0 ? Math.round(spend / cnt) : null;
        const av = lbl==='Purchases' && actionValues?.find(x=>x.action_type===t||x.action_type?.startsWith(t));
        const revenue = av && parseFloat(av.value)>0 ? Math.round(parseFloat(av.value)) : null;
        const extra = revenue ? ` · Rev ${s}${revenue.toLocaleString('en-IN')}` : cpa ? ` · ${lbl==='Purchases'?'CPP':'CPL'} ${s}${cpa}` : '';
        return `${cnt} ${lbl}${extra}`;
      }
    }
  }
  const lc = actions.find(x => x.action_type === 'link_click' || x.action_type === 'landing_page_view');
  if (lc && parseInt(lc.value) > 0) return `${lc.value} Clicks`;
  return '—';
}
async function metaFetch(endpoint, params, token) {
  const p = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`${META_PROXY_BASE}?endpoint=${encodeURIComponent(endpoint)}&${p}`);
  return r.json();
}

async function fetchClientData(client, token) {
  const result = {
    name: client.name,
    currency: client.currency,
    spend: 0, impressions: 0, ctr: 0,
    results: '—', active: false,
    alerts: [],
  };

  try {
    // 1. Account status
    const acct = await metaFetch(`act_${client.accountId}`, { fields: 'account_status,disable_reason' }, token);
    const status = acct?.account_status;
    if (status === 2) result.alerts.push({ type: 'account', severity: 'critical', msg: 'Account DISABLED' });
    else if (status === 9) result.alerts.push({ type: 'account', severity: 'critical', msg: 'Account in GRACE PERIOD (payment issue)' });
    else if (status === 3) result.alerts.push({ type: 'account', severity: 'warning', msg: 'Account UNSETTLED (outstanding balance)' });
    else if (status === 7) result.alerts.push({ type: 'account', severity: 'warning', msg: 'Account PENDING review' });

    // 2. Today's spend insights
    const ins = await metaFetch(`act_${client.accountId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,actions',
      date_preset: 'today',
    }, token);
    const insData = ins?.data?.[0] || null;
    const spend = parseFloat(insData?.spend || 0);
    result.spend = spend;
    result.impressions = parseInt(insData?.impressions || 0);
    result.ctr = parseFloat(insData?.ctr || 0);
    result.results = parseResults(insData?.actions, spend, client.currency, insData?.action_values);
    result.active = spend > 0;

    // 3. Active campaigns — check for paused + zero spend
    const camps = await metaFetch(`act_${client.accountId}/campaigns`, {
      fields: 'name,status,effective_status,daily_budget,lifetime_budget,budget_remaining',
      limit: 50,
    }, token);
    const campaigns = camps?.data || [];

    const activeCamps = campaigns.filter(c =>
      ['ACTIVE','CAMPAIGN_PAUSED'].includes(c.effective_status?.toUpperCase())
    );

    // Zero spend but has active campaigns
    if (spend === 0 && activeCamps.length > 0) {
      result.alerts.push({ type: 'spend', severity: 'warning', msg: `Zero spend today — ${activeCamps.length} campaign(s) appear active` });
    }

    // High frequency alert
    const freq = parseFloat(insData?.frequency || 0);
    if (freq >= 2.5) {
      result.alerts.push({ type: 'frequency', severity: freq >= 3 ? 'critical' : 'warning', msg: `High frequency: ${freq.toFixed(2)} — ${freq >= 3 ? 'audience burnt, refresh creative immediately' : 'approaching fatigue, monitor closely'}` });
    }

    // Budget exhausted check
    for (const c of activeCamps) {
      const remaining = parseFloat(c.budget_remaining || 0);
      const daily = parseFloat(c.daily_budget || 0);
      const lifetime = parseFloat(c.lifetime_budget || 0);
      if (lifetime > 0 && remaining < lifetime * 0.05) {
        result.alerts.push({ type: 'budget', severity: 'warning', msg: `"${c.name}" — lifetime budget nearly exhausted (<5% remaining)` });
      }
      if (daily > 0 && spend > 0 && spend >= daily * 0.95) {
        result.alerts.push({ type: 'budget', severity: 'info', msg: `"${c.name}" — daily budget nearly reached` });
      }
    }

    // 4. Rejected / disapproved ads
    const ads = await metaFetch(`act_${client.accountId}/ads`, {
      fields: 'name,effective_status,review_feedback',
      effective_status: JSON.stringify(['DISAPPROVED','WITH_ISSUES']),
      limit: 10,
    }, token);
    const badAds = ads?.data || [];
    for (const ad of badAds) {
      const feedback = ad.review_feedback ? Object.values(ad.review_feedback).flat().join(', ') : '';
      result.alerts.push({
        type: 'rejected',
        severity: 'critical',
        msg: `Ad "${ad.name}" — ${ad.effective_status}${feedback ? `: ${feedback.slice(0,80)}` : ''}`,
      });
    }

  } catch (e) {
    result.alerts.push({ type: 'error', severity: 'warning', msg: `Could not fetch data: ${e.message}` });
  }

  return result;
}

function alertBadge(severity) {
  if (severity === 'critical') return 'background:#FEE2E2;color:#DC2626;';
  if (severity === 'warning')  return 'background:#FEF3C7;color:#D97706;';
  return 'background:#DBEAFE;color:#2563EB;';
}

function alertIcon(type) {
  if (type === 'rejected') return '🚫';
  if (type === 'account')  return '⛔';
  if (type === 'budget')   return '💰';
  if (type === 'spend')    return '📉';
  return 'ℹ️';
}

function buildHtml(rows, date, timeIST) {
  const active = rows.filter(r => r.active).length;
  const totalINR = rows.filter(r => r.currency === 'INR').reduce((s, r) => s + r.spend, 0);
  const allAlerts = rows.flatMap(r => r.alerts.map(a => ({ ...a, client: r.name })));
  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
  const warningCount  = allAlerts.filter(a => a.severity === 'warning').length;

  // Performance table rows
  const tableRows = rows.map(r => {
    const sym = SYM(r.currency);
    const spendFmt = r.spend > 0 ? `<strong>${fmtSpend(r.spend, sym)}</strong>` : `<span style="color:#bbb">—</span>`;
    const impFmt   = r.impressions > 0 ? r.impressions.toLocaleString('en-IN') : `<span style="color:#bbb">—</span>`;
    const ctrFmt   = r.ctr > 0 ? r.ctr.toFixed(2) + '%' : `<span style="color:#bbb">—</span>`;
    const alertDot = r.alerts.some(a => a.severity === 'critical') ? '🔴 ' :
                     r.alerts.some(a => a.severity === 'warning')  ? '🟡 ' : '';
    return `<tr style="background:${r.active ? '#fff' : '#fafafa'};border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px 12px;font-size:13px;color:${r.active ? '#222' : '#aaa'};">${alertDot}${r.name}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">${spendFmt}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:right;color:#555;">${impFmt}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:right;color:#555;">${ctrFmt}</td>
      <td style="padding:8px 12px;font-size:12px;color:#29ABE2;">${r.results}</td>
    </tr>`;
  }).join('');

  // Alerts section — grouped by client
  const clientsWithAlerts = rows.filter(r => r.alerts.length > 0);
  const alertsHtml = clientsWithAlerts.length === 0 ? `
    <div style="padding:14px 16px;background:#F0FDF4;border-radius:8px;color:#16A34A;font-size:13px;font-weight:600;">
      ✅ No alerts — all accounts healthy
    </div>` : clientsWithAlerts.map(r => `
    <div style="margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${r.name}</div>
      ${r.alerts.map(a => `
        <div style="padding:8px 12px;border-radius:6px;margin-bottom:4px;font-size:12px;${alertBadge(a.severity)}">
          ${alertIcon(a.type)} ${a.msg}
        </div>`).join('')}
    </div>`).join('');

  return `<div style="font-family:Inter,sans-serif;max-width:720px;margin:0 auto;background:#f4f7f2;">

  <!-- Header -->
  <div style="background:#7DC242;padding:18px 24px;border-radius:12px 12px 0 0;">
    <span style="color:#fff;font-size:20px;font-weight:800;">meraki<span style="color:#29ABE2;">ads</span></span>
    <span style="color:rgba(255,255,255,0.85);font-size:12px;margin-left:10px;">META INTELLIGENCE · DAILY SUMMARY</span>
  </div>

  <!-- Summary bar -->
  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;padding:14px 24px;display:flex;gap:32px;flex-wrap:wrap;">
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Date</div>
         <div style="font-size:14px;font-weight:700;color:#333;margin-top:2px;">${date} · ${timeIST} IST</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Active Clients</div>
         <div style="font-size:14px;font-weight:700;color:#7DC242;margin-top:2px;">${active} / ${rows.length}</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Total INR Spend</div>
         <div style="font-size:14px;font-weight:700;color:#333;margin-top:2px;">₹${Math.round(totalINR).toLocaleString('en-IN')}</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Alerts</div>
         <div style="font-size:14px;font-weight:700;margin-top:2px;">
           ${criticalCount > 0 ? `<span style="color:#DC2626;">🔴 ${criticalCount} critical</span>` : ''}
           ${warningCount > 0  ? `<span style="color:#D97706;margin-left:8px;">🟡 ${warningCount} warnings</span>` : ''}
           ${criticalCount === 0 && warningCount === 0 ? '<span style="color:#16A34A;">✅ All clear</span>' : ''}
         </div></div>
  </div>

  <!-- Performance Table -->
  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;overflow:hidden;">
    <div style="padding:12px 16px 8px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0f0;">📊 Today's Performance</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f8faf6;border-bottom:2px solid #e5e9e0;">
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Client</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Spend</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Impressions</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">CTR</th>
        <th style="padding:9px 12px;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Results</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <!-- Alerts Section -->
  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;border-radius:0 0 12px 12px;padding:16px;">
    <div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">🚨 Alerts & Issues</div>
    ${alertsHtml}
  </div>

  <!-- CTA -->
  <div style="padding:16px;text-align:center;">
    <a href="https://meraki-meta-internal-dashboard.vercel.app" style="background:#7DC242;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">Open Live Dashboard →</a>
  </div>

  <div style="text-align:center;padding:8px;font-size:10px;color:#bbb;">Meraki Ads Internal · ${date} ${timeIST} IST · Meta Graph API</div>
</div>`;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: 'META_ACCESS_TOKEN not set' }, { status: 500 });
  }

  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const date = istNow.toISOString().split('T')[0];
  const timeIST = istNow.toISOString().split('T')[1].slice(0, 5);

  try {
    const results = await Promise.all(CLIENTS.map(c => fetchClientData(c, token)));
    const html = buildHtml(results, date, timeIST);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const activeCount = results.filter(r => r.active).length;
    const allAlerts = results.flatMap(r => r.alerts);
    const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;

    const subjectPrefix = criticalCount > 0 ? `🚨 ${criticalCount} Critical Alert(s)` : `📊 Meta Daily Summary`;

    await transporter.sendMail({
      from: `"Meraki Ads Meta" <${process.env.GMAIL_USER}>`,
      to: ['tusharchd29@gmail.com'],
      subject: `${subjectPrefix} — ${activeCount} Active Clients · ${date}`,
      html,
    });

    return Response.json({
      success: true, date, timeIST,
      activeClients: activeCount,
      totalAlerts: allAlerts.length,
      criticalAlerts: criticalCount,
    });
  } catch (err) {
    console.error('Meta cron error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
