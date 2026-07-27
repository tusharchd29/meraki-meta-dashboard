import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
const autoTable = autoTableImport.default || autoTableImport;
import { supabaseAdmin } from './supabaseAdmin.js';
import { getFxRates, toINR } from './exchangeRates.js';
import { DANCING_SCRIPT_BOLD_BASE64 } from './fonts/dancingScript700.js';
import { getActiveClients, getActiveGoogleAdsClients } from './getActiveClients.js';

const META_BASE = 'https://graph.facebook.com/v22.0';
const BRAND_GREEN = [125, 194, 66];   // #7DC242
const BRAND_GREEN_DK = [90, 154, 40]; // #5a9a28
const BRAND_BLUE = [41, 171, 226];    // #29ABE2

export function monthBounds(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const iso = d => d.toISOString().split('T')[0];
  return { start: iso(start), end: iso(end), label: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
}

export function defaultTargetMonth() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const prevMonth = new Date(ist.getFullYear(), ist.getMonth() - 1, 1);
  return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
}

function metaResultsLabel(actions, spend) {
  if (!actions?.length) return { count: null, label: '' };
  const PURCH = ['purchase', 'omni_purchase'];
  const LEAD = ['lead', 'onsite_conversion.lead_grouped', 'contact_total'];
  for (const [types, lbl] of [[PURCH, 'Purchases'], [LEAD, 'Leads']]) {
    for (const t of types) {
      const a = actions.find(x => x.action_type === t);
      if (a && parseInt(a.value) > 0) return { count: parseInt(a.value), label: lbl };
    }
  }
  const lc = actions.find(x => x.action_type === 'link_click');
  if (lc && parseInt(lc.value) > 0) return { count: parseInt(lc.value), label: 'Clicks' };
  return { count: null, label: '' };
}

// Read-only, GET-only, insights-only — same contract as app/api/meta.js.
async function fetchMetaCampaigns(accountId, token, since, until) {
  const p = new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_name,spend,actions',
    time_range: JSON.stringify({ since, until }),
    action_attribution_windows: JSON.stringify(['1d_click', '7d_click', '1d_view']),
    limit: '200',
    access_token: token,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(`${META_BASE}/act_${accountId}/insights?${p}`, { signal: controller.signal });
    const d = await r.json();
    if (d?.error) return { error: d.error.message, campaigns: [] };
    const campaigns = (d?.data || []).map(row => {
      const spend = parseFloat(row.spend || 0);
      const { count, label } = metaResultsLabel(row.actions, spend);
      return { name: row.campaign_name, spend, resultCount: count, resultLabel: label };
    });
    return { error: null, campaigns };
  } catch (e) {
    return { error: e.message, campaigns: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// A campaign can appear in more than one CSV import overlapping the target
// month (e.g. a 1st–15th export and a 16th–31st export). Sum every import
// that overlaps the month per campaign, rather than keeping only the one
// with the latest period_end — picking "latest wins" silently drops the
// earlier half's spend whenever a month was imported in more than one piece.
function googleCampaignsForMonth(allCampaigns, clientId, start, end) {
  const rows = allCampaigns.filter(c =>
    c.client_id === clientId && c.period_start <= end && c.period_end >= start
  )
  const byName = new Map()
  for (const r of rows) {
    const cost = Number(r.cost) || 0
    const conversions = r.conversions != null ? Number(r.conversions) : null
    const existing = byName.get(r.campaign_name)
    if (!existing) {
      byName.set(r.campaign_name, { name: r.campaign_name, spend: cost, resultCount: conversions, resultLabel: conversions != null ? 'Conversions' : '', currency: r.currency })
    } else {
      existing.spend += cost
      if (conversions != null) existing.resultCount = (existing.resultCount || 0) + conversions
    }
  }
  return [...byName.values()]
}

// Builds the full per-client report data for a given 'YYYY-MM' month.
// Shared by the cron (emails automatically) and the dashboard's manual
// trigger (emails on demand + returns the PDF for immediate download).
export async function buildMonthlyReportData(targetMonth) {
  const { start, end, label } = monthBounds(targetMonth);
  const db = supabaseAdmin();
  const fxRates = getFxRates();

  // getActiveClients()/getActiveGoogleAdsClients() are the same functions
  // that decide what the live dashboard shows — an account only counts as
  // "connected" if it's checked as tracked in Connections AND its login is
  // currently active. Disconnect the login (or untrack the account) and its
  // ID drops out of these sets on the very next call; reconnect and it's
  // back. Nothing here is cached or remembered independently of that state.
  const [liveMeta, liveGoogle] = await Promise.all([
    getActiveClients(),
    getActiveGoogleAdsClients(),
  ]);
  const liveMetaIds = new Set(liveMeta.map(a => a.accountId));
  const liveGoogleIds = new Set(liveGoogle.map(a => a.accountId));

  const { data: rawClients, error: cErr } = await db
    .from('meraki_clients')
    .select('id, name, meta_ad_account_id, google_ads_customer_id, monthly_budget')
    .order('name');
  if (cErr) throw new Error(`clients: ${cErr.message}`);

  // The Clients (Blended) mapping UI stores whatever meraki_ad_accounts.
  // account_id it was given, which is 'act_123456' (the Graph API's own
  // format). Every other id in this function — liveMetaIds, fetchMetaCampaigns'
  // 'act_' prefixing, the accountId Connections stores — is unprefixed. Left
  // unnormalized, that mismatch means a manually mapped client NEVER matches
  // liveMetaIds below and silently drops out of the report, regardless of
  // whether it's tracked. Strip it once here so 'id' is the single format
  // used everywhere past this point.
  const allClients = rawClients.map(c => ({
    ...c,
    meta_ad_account_id: c.meta_ad_account_id ? c.meta_ad_account_id.replace(/^act_/, '') : c.meta_ad_account_id,
  }));

  // A mapped client (from the Clients (Blended) roster) only makes it into
  // the report if at least one of its platform mappings is currently live —
  // not just present in Supabase. A budget alone, with nothing connected,
  // isn't enough to appear.
  const mappedClients = allClients.filter(c =>
    (c.meta_ad_account_id && liveMetaIds.has(c.meta_ad_account_id)) ||
    (c.google_ads_customer_id && liveGoogleIds.has(c.google_ads_customer_id))
  );

  // Mapping a tracked account into meraki_clients is now optional, not a
  // prerequisite — it exists for blended Meta+Google clients, a custom
  // display name, or a budget that overrides the one set in Connections.
  // Any account that's simply checked "Track" in Connections but was never
  // mapped still belongs in the report; synthesize a client entry straight
  // from its own account data (name/currency/budget) so it isn't dropped.
  const coveredMetaIds = new Set(mappedClients.map(c => c.meta_ad_account_id).filter(Boolean));
  const coveredGoogleIds = new Set(mappedClients.map(c => c.google_ads_customer_id).filter(Boolean));

  const unmappedMetaClients = liveMeta
    .filter(a => !coveredMetaIds.has(a.accountId))
    .map(a => ({
      id: `meta:${a.accountId}`, // synthetic — no meraki_clients row, so no google-campaign/snapshot match, which is correct
      name: a.name,
      meta_ad_account_id: a.accountId,
      google_ads_customer_id: null,
      monthly_budget: a.monthlyBudget,
    }));

  const unmappedGoogleClients = liveGoogle
    .filter(a => !coveredGoogleIds.has(a.accountId))
    .map(a => ({
      id: `google:${a.accountId}`,
      name: a.name,
      meta_ad_account_id: null,
      google_ads_customer_id: a.accountId,
      monthly_budget: a.monthlyBudget,
    }));

  const clients = [...mappedClients, ...unmappedMetaClients, ...unmappedGoogleClients]
    .sort((a, b) => a.name.localeCompare(b.name));

  const metaIds = clients.map(c => c.meta_ad_account_id).filter(Boolean); // unprefixed, per the normalization above
  let metaAccountsById = {}, tokenByConnection = {};
  if (metaIds.length) {
    // meraki_ad_accounts.account_id is stored WITH the 'act_' prefix (how
    // Meta's own API returns it) — query with that, but key the lookup map
    // by the unprefixed id so `c.meta_ad_account_id` (normalized above) finds it.
    const { data: accounts } = await db
      .from('meraki_ad_accounts')
      .select('account_id, currency, connection_id')
      .eq('platform', 'meta')
      .in('account_id', metaIds.map(id => `act_${id}`));
    metaAccountsById = Object.fromEntries((accounts || []).map(a => [a.account_id.replace(/^act_/, ''), a]));
    const connIds = [...new Set((accounts || []).map(a => a.connection_id).filter(Boolean))];
    if (connIds.length) {
      const { data: conns } = await db
        .from('meraki_ad_connections')
        .select('id, access_token, is_active')
        .in('id', connIds);
      tokenByConnection = Object.fromEntries((conns || []).filter(c => c.is_active).map(c => [c.id, c.access_token]));
    }
  }

  const { data: googleCampaigns } = await db
    .from('meraki_google_campaigns')
    .select('client_id, campaign_name, cost, conversions, currency, period_start, period_end');

  const { data: snapshots } = await db
    .from('meraki_budget_snapshots')
    .select('client_id, snapshot_date, blended_spend_inr')
    .gte('snapshot_date', start)
    .lte('snapshot_date', end)
    .order('snapshot_date', { ascending: false });
  const lastSnapshotByClient = {};
  for (const s of snapshots || []) {
    if (!lastSnapshotByClient[s.client_id]) lastSnapshotByClient[s.client_id] = s;
  }

  const clientReports = [];
  for (let i = 0; i < clients.length; i += 4) {
    const batch = clients.slice(i, i + 4);
    const results = await Promise.all(batch.map(async c => {
      let metaCampaigns = [], metaError = null, metaCurrency = null, metaSpend = 0;
      const acct = c.meta_ad_account_id ? metaAccountsById[c.meta_ad_account_id] : null;
      const token = acct?.connection_id ? tokenByConnection[acct.connection_id] : null;
      // Why a mapped client might still show no Meta spend — surfaced in the
      // PDF instead of a silent blank, so "why is this zero" is answerable
      // without digging into Supabase.
      let metaStatus = null;
      if (!c.meta_ad_account_id) {
        metaStatus = null; // never mapped to a Meta account — nothing to say
      } else if (!acct) {
        metaStatus = 'Meta account mapped but not synced from any connection — check Connections.';
      } else if (!token) {
        metaStatus = 'Meta account mapped but its connection is inactive or not tracked — reconnect in Connections.';
      }
      if (acct && token) {
        const r = await fetchMetaCampaigns(c.meta_ad_account_id, token, start, end);
        metaCampaigns = r.campaigns;
        metaError = r.error;
        metaCurrency = acct.currency || 'INR';
        metaSpend = metaCampaigns.reduce((s, m) => s + m.spend, 0);
      }

      const googleC = googleCampaigns ? googleCampaignsForMonth(googleCampaigns, c.id, start, end) : [];
      const googleCurrency = googleC[0]?.currency || null;
      const googleSpend = googleC.reduce((s, g) => s + g.spend, 0);
      const googleStatus = (c.google_ads_customer_id && !googleC.length)
        ? 'Google Ads mapped but no export imported for this month yet.'
        : null;

      const snapshot = lastSnapshotByClient[c.id];
      const spentInr = snapshot
        ? Number(snapshot.blended_spend_inr)
        : (toINR(metaSpend, metaCurrency, fxRates) || 0) + (toINR(googleSpend, googleCurrency, fxRates) || 0);

      const budget = c.monthly_budget != null ? Number(c.monthly_budget) : null;
      let finalPct = null, pace = null;
      if (budget > 0) {
        finalPct = (spentInr / budget) * 100;
        pace = finalPct > 110 ? 'over_budget' : finalPct < 90 ? 'under_budget' : 'on_budget';
      }

      return {
        name: c.name,
        metaCampaigns, metaError, metaCurrency, metaStatus,
        googleCampaigns: googleC, googleCurrency, googleStatus,
        budget, spentInr, finalPct, pace,
      };
    }));
    clientReports.push(...results);
  }

  // Every client here already passed the live-connection gate above, so a
  // zero here is real signal ("connected, nothing spent yet this month")
  // rather than noise — nothing further to filter out.
  return { clientReports, label, targetMonth };
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Shared file-naming convention for every monthly report artifact (manual
// download, manual email, and the automatic cron) — "Meraki PPC Report - Jun-2026.pdf".
export function reportFileName(targetMonth) {
  const [y, m] = targetMonth.split('-').map(Number);
  return `Meraki PPC Report - ${MONTH_ABBR[m - 1]}-${y}.pdf`;
}

// ── Branding helpers ────────────────────────────────────────────────────────

function registerBrandFont(doc) {
  try {
    doc.addFileToVFS('DancingScript-Bold.ttf', DANCING_SCRIPT_BOLD_BASE64);
    doc.addFont('DancingScript-Bold.ttf', 'DancingScript', 'bold');
    return true;
  } catch {
    return false; // falls back to Helvetica if embedding ever fails
  }
}

// Simple two-curve leaf, drawn via the canvas-like context2d API bundled
// with jsPDF — echoes the botanical leaf motif used across the Meraki
// brand (see veriseek-report's .bg-layer) without needing an SVG import.
function drawLeafWatermark(doc, cx, cy, w, h, rotationDeg, opacity = 0.05) {
  try {
    const ctx = doc.context2d;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#7DC242';
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.bezierCurveTo(w / 2, -h / 4, w / 2, h / 4, 0, h / 2);
    ctx.bezierCurveTo(-w / 2, h / 4, -w / 2, -h / 4, 0, -h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = opacity * 1.6;
    ctx.strokeStyle = '#5a9a28';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, h / 2);
    ctx.stroke();
    ctx.restore();
  } catch {
    // Watermark is decorative — never let it break report generation.
  }
}

function brandHeader(doc, hasScriptFont, subtitle) {
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, 210, 24, 'F');

  if (hasScriptFont) doc.setFont('DancingScript', 'bold'); else doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(hasScriptFont ? 26 : 20);
  doc.setTextColor(255, 255, 255);
  doc.text('meraki', 14, hasScriptFont ? 17 : 16);
  const wMeraki = doc.getTextWidth('meraki');
  doc.setTextColor(215, 240, 255);
  doc.text('ads', 14 + wMeraki + 1, hasScriptFont ? 17 : 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(subtitle, 196, 15, { align: 'right' });
}

export function buildBrandedPdf(clientReports, monthLabel) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const hasScriptFont = registerBrandFont(doc);

  clientReports.forEach((c, idx) => {
    if (idx > 0) doc.addPage();

    // Botanical watermark, low-opacity, bottom-right corner of every page.
    drawLeafWatermark(doc, 178, 265, 46, 90, -16, 0.05);
    drawLeafWatermark(doc, 24, 40, 26, 52, 12, 0.04);

    brandHeader(doc, hasScriptFont, 'Monthly Campaign Report');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`${c.name}   |   ${monthLabel}`, 14, 32);

    // Allocated vs spent summary block
    doc.setDrawColor(...BRAND_GREEN);
    doc.setFillColor(248, 250, 246);
    doc.roundedRect(14, 37, 182, 19, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Allocated (Budget)', 18, 44);
    doc.text('Spent (INR)', 78, 44);
    doc.text('Pacing', 138, 44);
    doc.setFont('helvetica', 'normal');
    doc.text(c.budget != null ? `Rs ${Math.round(c.budget).toLocaleString('en-IN')}` : 'not set', 18, 51);
    doc.text(`Rs ${Math.round(c.spentInr).toLocaleString('en-IN')}`, 78, 51);
    const paceColor = c.pace === 'over_budget' ? [220, 38, 38] : c.pace === 'under_budget' ? [217, 119, 6] : [22, 163, 74];
    doc.setTextColor(...paceColor);
    doc.setFont('helvetica', 'bold');
    doc.text(c.pace ? `${c.pace.replace('_', ' ')} (${c.finalPct != null ? c.finalPct.toFixed(0) : '—'}%)` : 'no budget set', 138, 51);

    let y = 63;

    if (c.metaCampaigns.length) {
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_GREEN_DK);
      doc.setFont('helvetica', 'bold');
      doc.text(`Meta Campaigns (${c.metaCurrency || 'INR'})`, 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Campaign', 'Spend', 'Results']],
        body: c.metaCampaigns.map(m => [
          m.name,
          Math.round(m.spend).toLocaleString('en-IN'),
          m.resultCount != null ? `${m.resultCount} ${m.resultLabel}` : '—',
        ]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_GREEN, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 246] },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
      });
      y = doc.lastAutoTable.finalY + 8;
    } else if (c.metaError) {
      doc.setFontSize(8);
      doc.setTextColor(180, 60, 60);
      doc.text(`Meta: ${c.metaError}`, 14, y);
      y += 8;
    } else if (c.metaStatus) {
      doc.setFontSize(8);
      doc.setTextColor(200, 140, 20);
      doc.text(c.metaStatus, 14, y);
      y += 8;
    }

    if (y > 250) { doc.addPage(); drawLeafWatermark(doc, 178, 265, 46, 90, -16, 0.05); y = 20; }

    if (c.googleCampaigns.length) {
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_BLUE.map ? [30, 30, 30] : [30, 30, 30]);
      doc.setTextColor(20, 100, 160);
      doc.setFont('helvetica', 'bold');
      doc.text(`Google Campaigns (${c.googleCurrency || 'INR'}, from manual import)`, 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Campaign', 'Spend', 'Results']],
        body: c.googleCampaigns.map(g => [
          g.name,
          Math.round(g.spend).toLocaleString('en-IN'),
          g.resultCount != null ? `${g.resultCount} ${g.resultLabel}` : '—',
        ]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 250, 253] },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
      });
    } else {
      doc.setFontSize(8);
      doc.setTextColor(c.googleStatus ? 200 : 150, c.googleStatus ? 140 : 150, c.googleStatus ? 20 : 150);
      doc.text(c.googleStatus || 'No Google Ads account mapped for this client.', 14, y);
    }

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'italic');
    doc.text('merakiads.in · Internal Report', 14, 289);
  });

  return doc.output('datauristring').split(',')[1]; // base64
}

export function buildSummaryHtml(clientReports, label) {
  const overBudgetCount = clientReports.filter(c => c.pace === 'over_budget').length;
  return `
    <div style="font-family:Arial,sans-serif;color:#333">
      <div style="font-family:cursive;font-size:22px;margin-bottom:2px">
        <span style="color:#7DC242;font-weight:700">meraki</span><span style="color:#29ABE2;font-weight:700">ads</span>
      </div>
      <h2 style="color:#5a9c2f;margin-top:4px">Monthly Campaign Report — ${label}</h2>
      <p>${clientReports.length} clients · ${overBudgetCount} over budget. Full per-campaign detail in the attached PDF.</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <tr style="background:#7dc242;color:#fff">
          <th style="padding:6px;text-align:left">Client</th>
          <th style="padding:6px;text-align:right">Budget (Rs)</th>
          <th style="padding:6px;text-align:right">Spent (Rs)</th>
          <th style="padding:6px;text-align:right">Pacing</th>
        </tr>
        ${clientReports.map((c, i) => `
          <tr style="background:${i % 2 ? '#f8faf6' : '#fff'}">
            <td style="padding:6px">${c.name}</td>
            <td style="padding:6px;text-align:right">${c.budget != null ? Math.round(c.budget).toLocaleString('en-IN') : '—'}</td>
            <td style="padding:6px;text-align:right">${Math.round(c.spentInr).toLocaleString('en-IN')}</td>
            <td style="padding:6px;text-align:right;color:${c.pace === 'over_budget' ? '#dc2626' : c.pace === 'under_budget' ? '#d97706' : '#16a34a'}">
              ${c.pace ? c.pace.replace('_', ' ') + (c.finalPct != null ? ` (${c.finalPct.toFixed(0)}%)` : '') : 'no budget'}
            </td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}
