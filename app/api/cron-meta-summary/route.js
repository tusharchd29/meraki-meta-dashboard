import nodemailer from 'nodemailer';

const META_PROXY_BASE = 'https://meraki-meta-internal-dashboard.vercel.app/api/meta';

const CLIENTS = [
  { name:'Volvo (Krishna)',              accountId:'833603637085666',  currency:'INR' },
  { name:'North International (Old)',    accountId:'1297775434831152', currency:'INR' },
  { name:'PyaraBaby',                    accountId:'254564808465114',  currency:'INR' },
  { name:'Courtesy Honda',               accountId:'787341982723949',  currency:'INR' },
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

function parseResults(actions, spend, currency) {
  if (!actions?.length) return '—';
  const s = SYM(currency);
  const PURCH = ['purchase','omni_purchase'];
  const LEAD  = ['lead','onsite_conversion.lead_grouped','contact_total'];
  for (const [types, lbl] of [[PURCH,'Purchases'],[LEAD,'Leads']]) {
    for (const t of types) {
      const a = actions.find(x => x.action_type === t);
      if (a && parseInt(a.value) > 0) {
        const cnt = parseInt(a.value);
        const cpa = cnt > 0 && spend > 0 ? Math.round(spend / cnt) : null;
        return `${cnt} ${lbl}${cpa ? ` · ${lbl==='Purchases'?'CPP':'CPL'} ${s}${cpa}` : ''}`;
      }
    }
  }
  const lc = actions.find(x => x.action_type === 'link_click');
  if (lc && parseInt(lc.value) > 0) return `${lc.value} Clicks`;
  return '—';
}

async function fetchClient(client, token) {
  try {
    const params = new URLSearchParams({
      endpoint: `act_${client.accountId}/insights`,
      fields: 'spend,impressions,clicks,ctr,actions',
      date_preset: 'today',
    });
    const r = await fetch(`${META_PROXY_BASE}?${params}&access_token=${token}`);
    const d = await r.json();
    const ins = d?.data?.[0] || null;
    const spend = parseFloat(ins?.spend || 0);
    return {
      name: client.name,
      currency: client.currency,
      spend,
      impressions: parseInt(ins?.impressions || 0),
      ctr: parseFloat(ins?.ctr || 0),
      results: parseResults(ins?.actions, spend, client.currency),
      active: !!ins && spend > 0,
    };
  } catch {
    return { name: client.name, currency: client.currency, spend: 0, impressions: 0, ctr: 0, results: 'Error', active: false };
  }
}

function buildHtml(rows, date, timeIST) {
  const active = rows.filter(r => r.active).length;
  const totalINR = rows.filter(r => r.currency === 'INR').reduce((s, r) => s + r.spend, 0);

  const tableRows = rows.map(r => {
    const sym = SYM(r.currency);
    const spendFmt = r.spend > 0 ? `<strong>${fmtSpend(r.spend, sym)}</strong>` : `<span style="color:#bbb">—</span>`;
    const impFmt   = r.impressions > 0 ? r.impressions.toLocaleString('en-IN') : `<span style="color:#bbb">—</span>`;
    const ctrFmt   = r.ctr > 0 ? r.ctr.toFixed(2) + '%' : `<span style="color:#bbb">—</span>`;
    return `<tr style="background:${r.active ? '#fff' : '#fafafa'};border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px 12px;font-size:13px;color:${r.active ? '#222' : '#aaa'};">${r.name}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">${spendFmt}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:right;color:#555;">${impFmt}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:right;color:#555;">${ctrFmt}</td>
      <td style="padding:8px 12px;font-size:12px;color:#29ABE2;">${r.results}</td>
    </tr>`;
  }).join('');

  return `<div style="font-family:Inter,sans-serif;max-width:720px;margin:0 auto;background:#f4f7f2;">
  <div style="background:#7DC242;padding:18px 24px;border-radius:12px 12px 0 0;">
    <span style="color:#fff;font-size:20px;font-weight:800;">meraki<span style="color:#29ABE2;">ads</span></span>
    <span style="color:rgba(255,255,255,0.85);font-size:12px;margin-left:10px;">META INTELLIGENCE · DAILY SUMMARY</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;padding:14px 24px;display:flex;gap:36px;">
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Date</div>
         <div style="font-size:14px;font-weight:700;color:#333;margin-top:2px;">${date} · ${timeIST} IST</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Active Clients</div>
         <div style="font-size:14px;font-weight:700;color:#7DC242;margin-top:2px;">${active} / ${rows.length}</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Total INR Spend</div>
         <div style="font-size:14px;font-weight:700;color:#333;margin-top:2px;">₹${Math.round(totalINR).toLocaleString('en-IN')}</div></div>
  </div>
  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f8faf6;border-bottom:2px solid #e5e9e0;">
        <th style="padding:9px 12px;text-align:left;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Client</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Spend Today</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Impressions</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">CTR</th>
        <th style="padding:9px 12px;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Results</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div style="padding:16px 24px;border-top:1px solid #f0f0f0;text-align:center;">
      <a href="https://meraki-meta-internal-dashboard.vercel.app" style="background:#7DC242;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">Open Live Dashboard →</a>
    </div>
  </div>
  <div style="text-align:center;padding:10px;font-size:10px;color:#bbb;">Meraki Ads Internal · ${date} ${timeIST} IST · Meta Graph API</div>
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
    const results = await Promise.all(CLIENTS.map(c => fetchClient(c, token)));
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

    await transporter.sendMail({
      from: `"Meraki Ads Meta" <${process.env.GMAIL_USER}>`,
      to: ['tusharchd29@gmail.com', 'heena@merakiads.in'],
      subject: `📊 Meta Daily Summary — ${activeCount} Active Clients · ${date}`,
      html,
    });

    return Response.json({ success: true, date, timeIST, activeClients: activeCount, totalClients: results.length });
  } catch (err) {
    console.error('Meta cron error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
