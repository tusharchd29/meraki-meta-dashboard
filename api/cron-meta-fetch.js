import { google } from 'googleapis';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const SHEET_ID = '11_5rGUGJuK9DLNiXNdu_QAgtcVg3M0gFNppO1uZ7tZk';
const TAB_NAME = 'Meta Daily';
const META_BASE = 'https://graph.facebook.com/v22.0';

// Pulls every tracked, connected Meta ad account along with the token to use
// for it. Purely opt-in: an account only appears here once its owning login
// is connected AND active AND it's been explicitly checked "tracked" in the
// Connections panel. No hardcoded array, no env-token fallback.
async function getClientsWithTokens() {
  const db = supabaseAdmin();

  const { data: accounts, error } = await db
    .from('meraki_ad_accounts')
    .select('account_id, account_name, display_name, currency, connection_id')
    .eq('platform', 'meta')
    .eq('is_tracked', true)
    .not('connection_id', 'is', null);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  if (!accounts || accounts.length === 0) return [];

  const connectionIds = [...new Set(accounts.map(a => a.connection_id))];
  const { data: connections, error: connErr } = await db
    .from('meraki_ad_connections')
    .select('id, access_token, is_active')
    .in('id', connectionIds);
  if (connErr) throw new Error(`Supabase error: ${connErr.message}`);
  const tokenByConnection = Object.fromEntries(
    (connections || []).filter(c => c.is_active).map(c => [c.id, c.access_token])
  );

  return accounts
    .map(a => ({
      name: a.display_name || a.account_name || a.account_id,
      accountId: a.account_id.replace(/^act_/, ''),
      currency: a.currency || 'INR',
      token: tokenByConnection[a.connection_id],
    }))
    .filter(c => !!c.token); // connection went inactive between the two queries — skip it
}

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function ensureTab(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === TAB_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TAB_NAME } } }],
      },
    });
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A1:L1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'Date', 'Client', 'Currency', 'Spend', 'Impressions', 'CTR%',
          'Results', 'Account Status', 'Rejected Ads', 'Zero Spend Alert',
          'Budget Alert', 'Last Updated (IST)'
        ]],
      },
    });
  }
}

async function metaGet(endpoint, params, token) {
  const p = new URLSearchParams({ ...params, access_token: token });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${META_BASE}/${endpoint}?${p}`, { signal: controller.signal });
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseResults(actions, spend, currency) {
  if (!actions?.length) return '';
  const SYM = currency === 'THB' ? '฿' : currency === 'NZD' ? 'NZ$' : '₹';
  const PURCH = ['purchase', 'omni_purchase'];
  const LEAD  = ['lead', 'onsite_conversion.lead_grouped', 'contact_total'];
  for (const [types, lbl] of [[PURCH, 'Purchases'], [LEAD, 'Leads']]) {
    for (const t of types) {
      const a = actions.find(x => x.action_type === t);
      if (a && parseInt(a.value) > 0) {
        const cnt = parseInt(a.value);
        const cpa = cnt > 0 && spend > 0 ? Math.round(spend / cnt) : null;
        return `${cnt} ${lbl}${cpa ? ` (${lbl === 'Purchases' ? 'CPP' : 'CPL'} ${SYM}${cpa})` : ''}`;
      }
    }
  }
  const lc = actions.find(x => x.action_type === 'link_click');
  if (lc && parseInt(lc.value) > 0) return `${lc.value} Clicks`;
  return '';
}

async function fetchClient(client, token) {
  const row = {
    name: client.name,
    currency: client.currency,
    spend: 0, impressions: 0, ctr: 0,
    results: '', accountStatus: 'OK',
    rejectedAds: '', zeroSpendAlert: '', budgetAlert: '',
  };

  try {
    // Account status
    const acct = await metaGet(`act_${client.accountId}`, { fields: 'account_status' }, token);
    const code = acct?.account_status;
    if (code === 2)      row.accountStatus = 'DISABLED';
    else if (code === 9) row.accountStatus = 'GRACE PERIOD';
    else if (code === 3) row.accountStatus = 'UNSETTLED';
    else if (code === 7) row.accountStatus = 'PENDING';

    // Today's insights
    const ins = await metaGet(`act_${client.accountId}/insights`, {
      fields: 'spend,impressions,ctr,outbound_clicks_ctr,actions',
      date_preset: 'today',
      action_attribution_windows: JSON.stringify(['1d_click','7d_click','1d_view']),
    }, token);
    const d = ins?.data?.[0] || null;
    const spend = parseFloat(d?.spend || 0);
    row.spend = spend;
    row.impressions = parseInt(d?.impressions || 0);
    row.ctr = parseFloat(d?.ctr || 0);
    row.results = parseResults(d?.actions, spend, client.currency);

    // Campaigns — zero spend + budget alerts
    const camps = await metaGet(`act_${client.accountId}/campaigns`, {
      fields: 'name,effective_status,daily_budget,lifetime_budget,budget_remaining',
      limit: 50,
    }, token);
    const activeCamps = (camps?.data || []).filter(c => c.effective_status === 'ACTIVE');

    if (spend === 0 && activeCamps.length > 0) {
      row.zeroSpendAlert = `${activeCamps.length} active campaign(s) but no spend`;
    }

    const budgetWarnings = [];
    for (const c of activeCamps) {
      const remaining = parseFloat(c.budget_remaining || 0);
      const lifetime = parseFloat(c.lifetime_budget || 0);
      if (lifetime > 0 && remaining < lifetime * 0.05) {
        budgetWarnings.push(`"${c.name}" <5% lifetime budget left`);
      }
    }
    row.budgetAlert = budgetWarnings.join('; ');

    // Rejected ads
    const ads = await metaGet(`act_${client.accountId}/ads`, {
      fields: 'name,effective_status',
      limit: 50,
    }, token);
    const rejected = (ads?.data || []).filter(a =>
      ['DISAPPROVED', 'WITH_ISSUES'].includes(a.effective_status)
    );
    if (rejected.length > 0) {
      row.rejectedAds = rejected.map(a => `${a.name} (${a.effective_status})`).join('; ');
    }

  } catch (e) {
    row.accountStatus = `ERROR: ${e.message?.slice(0, 50)}`;
  }

  return row;
}



export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const today = istNow.toISOString().split('T')[0];
  const timeIST = istNow.toISOString().split('T')[1].slice(0, 5);

  try {
    const clients = await getClientsWithTokens();
    if (clients.length === 0) {
      return res.status(500).json({ error: 'No accounts with a usable token found. Connect one from the dashboard Connections panel.' });
    }

    const sheets = await getSheets();
    await ensureTab(sheets);

    // Fetch all clients in parallel (batched 4 at a time to avoid rate limits)
    const results = [];
    for (let i = 0; i < clients.length; i += 4) {
      const batch = await Promise.all(clients.slice(i, i + 4).map(c => fetchClient(c, c.token)));
      results.push(...batch);
    }

    // Always append — every fetch creates a new record for audit history
    const values = results.map(r => [
      today,
      r.name,
      r.currency,
      r.spend,
      r.impressions,
      r.ctr ? r.ctr.toFixed(2) : '0',
      r.results,
      r.accountStatus,
      r.rejectedAds,
      r.zeroSpendAlert,
      r.budgetAlert,
      timeIST,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A:L`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    return res.status(200).json({ success: true, date: today, timeIST, rowsSaved: results.length });
  } catch (err) {
    console.error('Meta fetch cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
