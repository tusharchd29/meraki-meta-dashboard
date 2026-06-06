import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const SHEET_ID = '11_5rGUGJuK9DLNiXNdu_QAgtcVg3M0gFNppO1uZ7tZk';
const TAB_NAME = 'Meta Daily';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

function alertBadge(severity) {
  if (severity === 'critical') return 'background:#FEE2E2;color:#DC2626;';
  if (severity === 'warning')  return 'background:#FEF3C7;color:#D97706;';
  return 'background:#DBEAFE;color:#2563EB;';
}

function buildHtml(rows, date, timeIST, slot) {
  // rows: [{name, currency, spend, impressions, ctr, results, accountStatus, rejectedAds, zeroSpendAlert, budgetAlert}]
  const SYM = c => c === 'THB' ? '฿' : c === 'NZD' ? 'NZ$' : '₹';

  const active = rows.filter(r => parseFloat(r.spend) > 0).length;
  const totalINR = rows
    .filter(r => r.currency === 'INR')
    .reduce((s, r) => s + parseFloat(r.spend || 0), 0);

  // Count alerts
  let criticalCount = 0, warningCount = 0;
  for (const r of rows) {
    if (r.accountStatus !== 'OK' && r.accountStatus !== '') {
      if (['DISABLED','GRACE PERIOD'].includes(r.accountStatus)) criticalCount++;
      else warningCount++;
    }
    if (r.rejectedAds) criticalCount++;
    if (r.zeroSpendAlert) warningCount++;
    if (r.budgetAlert) warningCount++;
  }

  // Performance table
  const tableRows = rows.map(r => {
    const sym = SYM(r.currency);
    const spend = parseFloat(r.spend || 0);
    const spendFmt = spend > 0
      ? `<strong>${sym}${Math.round(spend).toLocaleString('en-IN')}</strong>`
      : `<span style="color:#bbb">—</span>`;
    const impFmt = parseInt(r.impressions || 0) > 0
      ? parseInt(r.impressions).toLocaleString('en-IN')
      : `<span style="color:#bbb">—</span>`;
    const ctrFmt = parseFloat(r.ctr || 0) > 0
      ? parseFloat(r.ctr).toFixed(2) + '%'
      : `<span style="color:#bbb">—</span>`;
    const hasCritical = r.rejectedAds || ['DISABLED','GRACE PERIOD'].includes(r.accountStatus);
    const hasWarning = r.zeroSpendAlert || r.budgetAlert ||
      ['UNSETTLED','PENDING'].includes(r.accountStatus);
    const dot = hasCritical ? '🔴 ' : hasWarning ? '🟡 ' : '';
    return `<tr style="background:${spend > 0 ? '#fff' : '#fafafa'};border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px 12px;font-size:13px;color:${spend > 0 ? '#222' : '#aaa'};">${dot}${r.name}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">${spendFmt}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:right;color:#555;">${impFmt}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:right;color:#555;">${ctrFmt}</td>
      <td style="padding:8px 12px;font-size:12px;color:#29ABE2;">${r.results || '—'}</td>
    </tr>`;
  }).join('');

  // Alerts section
  const alertRows = rows.filter(r =>
    r.rejectedAds || r.zeroSpendAlert || r.budgetAlert ||
    (r.accountStatus && r.accountStatus !== 'OK')
  );

  const alertsHtml = alertRows.length === 0
    ? `<div style="padding:14px 16px;background:#F0FDF4;border-radius:8px;color:#16A34A;font-size:13px;font-weight:600;">✅ No alerts — all accounts healthy</div>`
    : alertRows.map(r => {
        const items = [];
        if (['DISABLED','GRACE PERIOD'].includes(r.accountStatus))
          items.push({ sev: 'critical', icon: '⛔', msg: `Account ${r.accountStatus}` });
        else if (r.accountStatus && r.accountStatus !== 'OK')
          items.push({ sev: 'warning', icon: '⚠️', msg: `Account ${r.accountStatus}` });
        if (r.rejectedAds)
          items.push({ sev: 'critical', icon: '🚫', msg: `Rejected: ${r.rejectedAds.slice(0, 120)}` });
        if (r.zeroSpendAlert)
          items.push({ sev: 'warning', icon: '📉', msg: r.zeroSpendAlert });
        if (r.budgetAlert)
          items.push({ sev: 'warning', icon: '💰', msg: r.budgetAlert });
        return `<div style="margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">${r.name}</div>
          ${items.map(i => `<div style="padding:7px 12px;border-radius:6px;margin-bottom:4px;font-size:12px;${alertBadge(i.sev)}">${i.icon} ${i.msg}</div>`).join('')}
        </div>`;
      }).join('');

  const slotLabel = slot === 'morning' ? '☀️ Morning Report' : '🌆 Evening Report';

  // Token expiry warning — token expires Aug 4 2026
  const tokenExpiry = new Date('2026-08-04');
  const today2 = new Date(date);
  const daysLeft = Math.ceil((tokenExpiry - today2) / (1000 * 60 * 60 * 24));
  let tokenWarningHtml = '';
  if (daysLeft <= 14) {
    const urgency = daysLeft <= 3 ? 'background:#FEE2E2;color:#DC2626;border:1px solid #FCA5A5;' : 'background:#FEF3C7;color:#D97706;border:1px solid #FCD34D;';
    tokenWarningHtml = `<div style="margin:8px 0;padding:12px 16px;border-radius:8px;font-size:12px;font-weight:600;${urgency}">
      ⚠️ Meta Access Token expires in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> (Aug 4, 2026) — please refresh it in Meta Business Manager before it expires.
    </div>`;
  }

  return `<div style="font-family:Inter,sans-serif;max-width:720px;margin:0 auto;background:#f4f7f2;">
  <div style="background:#7DC242;padding:18px 24px;border-radius:12px 12px 0 0;">
    <span style="color:#fff;font-size:20px;font-weight:800;">meraki<span style="color:#29ABE2;">ads</span></span>
    <span style="color:rgba(255,255,255,0.85);font-size:12px;margin-left:10px;">META INTELLIGENCE · ${slotLabel.toUpperCase()}</span>
  </div>

  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;padding:14px 24px;display:flex;gap:28px;flex-wrap:wrap;">
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Date</div>
         <div style="font-size:14px;font-weight:700;color:#333;margin-top:2px;">${date} · ${timeIST} IST</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Active Clients</div>
         <div style="font-size:14px;font-weight:700;color:#7DC242;margin-top:2px;">${active} / ${rows.length}</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Total INR Spend</div>
         <div style="font-size:14px;font-weight:700;color:#333;margin-top:2px;">₹${Math.round(totalINR).toLocaleString('en-IN')}</div></div>
    <div><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Alerts</div>
         <div style="font-size:14px;font-weight:700;margin-top:2px;">
           ${criticalCount > 0 ? `<span style="color:#DC2626;">🔴 ${criticalCount} critical</span>` : ''}
           ${warningCount > 0 ? `<span style="color:#D97706;margin-left:6px;">🟡 ${warningCount} warnings</span>` : ''}
           ${criticalCount === 0 && warningCount === 0 ? '<span style="color:#16A34A;">✅ All clear</span>' : ''}
         </div></div>
  </div>

  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;overflow:hidden;">
    <div style="padding:10px 16px 6px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0f0;">📊 Today's Performance</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f8faf6;border-bottom:2px solid #e5e9e0;">
        <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Client</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Spend</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Impressions</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">CTR</th>
        <th style="padding:8px 12px;font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Results</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <div style="background:#fff;border:1px solid #e5e9e0;border-top:none;border-radius:0 0 12px 12px;padding:16px;">
    <div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">🚨 Alerts & Issues</div>
    ${alertsHtml}
  </div>

  <div style="padding:14px;text-align:center;">
    <a href="${SHEET_URL}" style="background:#29ABE2;color:#fff;padding:9px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;margin-right:8px;">View Sheet →</a>
    <a href="https://meraki-meta-internal-dashboard.vercel.app" style="background:#7DC242;color:#fff;padding:9px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">Open Dashboard →</a>
  </div>
  ${tokenWarningHtml}
  <div style="text-align:center;padding:8px;font-size:10px;color:#bbb;">Meraki Ads Internal · ${date} · Data saved to Google Sheets</div>
</div>`;
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const today = istNow.toISOString().split('T')[0];
  const timeIST = istNow.toISOString().split('T')[1].slice(0, 5);
  const slot = parseInt(timeIST.split(':')[0]) < 12 ? 'morning' : 'evening';

  try {
    const sheets = await getSheets();

    // Read today's rows from sheet
    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A:L`,
    });
    const allRows = res2.data.values || [];
    const headers = allRows[0] || [];
    const todayRows = allRows.slice(1).filter(r => r[0] === today);

    if (todayRows.length === 0) {
      return res.status(200).json({ skipped: true, reason: 'No data for today in sheet yet' });
    }

    const rows = todayRows.map(r => ({
      name:          r[headers.indexOf('Client')] || r[1] || '',
      currency:      r[headers.indexOf('Currency')] || r[2] || 'INR',
      spend:         r[headers.indexOf('Spend')] || r[3] || 0,
      impressions:   r[headers.indexOf('Impressions')] || r[4] || 0,
      ctr:           r[headers.indexOf('CTR%')] || r[5] || 0,
      results:       r[headers.indexOf('Results')] || r[6] || '',
      accountStatus: r[headers.indexOf('Account Status')] || r[7] || 'OK',
      rejectedAds:   r[headers.indexOf('Rejected Ads')] || r[8] || '',
      zeroSpendAlert:r[headers.indexOf('Zero Spend Alert')] || r[9] || '',
      budgetAlert:   r[headers.indexOf('Budget Alert')] || r[10] || '',
    }));

    const html = buildHtml(rows, today, timeIST, slot);

    const criticalCount = rows.filter(r =>
      r.rejectedAds || ['DISABLED','GRACE PERIOD'].includes(r.accountStatus)
    ).length;

    const activeCount = rows.filter(r => parseFloat(r.spend) > 0).length;
    const slotEmoji = slot === 'morning' ? '☀️' : '🌆';
    const subjectPrefix = criticalCount > 0 ? `🚨 ${criticalCount} Critical Alert(s)` : `${slotEmoji} Meta ${slot.charAt(0).toUpperCase() + slot.slice(1)} Report`;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Meraki Ads Meta" <${process.env.GMAIL_USER}>`,
      to: ['tusharchd29@gmail.com', 'heena@merakiads.in'],
      subject: `${subjectPrefix} — ${activeCount} Active Clients · ${today}`,
      html,
    });

    return res.status(200).json({ success: true, date: today, timeIST, slot, rowsRead: rows.length });
  } catch (err) {
    console.error('Meta email cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
