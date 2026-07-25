import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getFxRates, toINR } from '../lib/exchangeRates.js';

const META_BASE = 'https://graph.facebook.com/v22.0';

// Same read-only guarantee as api/meta.js: GET only, insights endpoint only.
async function metaMonthSpend(accountId, token) {
  const p = new URLSearchParams({
    fields: 'spend',
    date_preset: 'this_month',
    access_token: token,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${META_BASE}/act_${accountId}/insights?${p}`, { signal: controller.signal });
    const d = await r.json();
    return parseFloat(d?.data?.[0]?.spend || 0);
  } catch {
    return null; // couldn't fetch — leave null rather than silently reporting 0 spend
  } finally {
    clearTimeout(timeout);
  }
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = supabaseAdmin();
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const today = istNow.toISOString().split('T')[0];
  const monthStart = new Date(istNow.getFullYear(), istNow.getMonth(), 1).toISOString().split('T')[0];
  const expectedPct = (istNow.getDate() / daysInMonth(istNow)) * 100;
  const fxRates = getFxRates();

  try {
    // 1. Clients + their budgets + platform mappings
    const { data: clients, error: cErr } = await db
      .from('meraki_clients')
      .select('id, name, meta_ad_account_id, google_ads_customer_id, monthly_budget, monthly_budget_month');
    if (cErr) throw new Error(`clients: ${cErr.message}`);
    if (!clients?.length) return res.status(200).json({ success: true, snapshotted: 0, note: 'no clients' });

    // 2. Meta accounts (currency + connection) for the mapped clients
    const metaIds = clients.map(c => c.meta_ad_account_id).filter(Boolean);
    let metaAccountsById = {};
    let tokenByConnection = {};
    if (metaIds.length) {
      const { data: accounts } = await db
        .from('meraki_ad_accounts')
        .select('account_id, currency, connection_id')
        .eq('platform', 'meta')
        .in('account_id', metaIds);
      metaAccountsById = Object.fromEntries((accounts || []).map(a => [a.account_id, a]));

      const connIds = [...new Set((accounts || []).map(a => a.connection_id).filter(Boolean))];
      if (connIds.length) {
        const { data: conns } = await db
          .from('meraki_ad_connections')
          .select('id, access_token, is_active')
          .in('id', connIds);
        tokenByConnection = Object.fromEntries((conns || []).filter(c => c.is_active).map(c => [c.id, c.access_token]));
      }
    }

    // 3. Google MTD spend, same daily-rollup logic as api/google-spend
    const { data: googleDaily } = await db
      .from('meraki_google_spend_daily')
      .select('client_id, spend_date, cost, currency')
      .gte('spend_date', monthStart);
    const googleMtdByClient = {};
    for (const r of googleDaily || []) {
      const g = googleMtdByClient[r.client_id] ||= { month: 0, currency: r.currency };
      g.month += Number(r.cost) || 0;
    }

    // 4. Build one row per client (Meta calls run in small batches to stay under rate limits)
    const rows = [];
    for (let i = 0; i < clients.length; i += 4) {
      const batch = clients.slice(i, i + 4);
      const batchRows = await Promise.all(batch.map(async c => {
        let metaSpend = null, metaCurrency = null;
        const acct = c.meta_ad_account_id ? metaAccountsById[c.meta_ad_account_id] : null;
        const token = acct?.connection_id ? tokenByConnection[acct.connection_id] : null;
        if (acct && token) {
          metaSpend = await metaMonthSpend(c.meta_ad_account_id, token);
          metaCurrency = acct.currency || 'INR';
        }

        const g = googleMtdByClient[c.id] || null;
        const googleSpend = g ? g.month : null;
        const googleCurrency = g ? g.currency : null;

        const metaInr = metaSpend != null && metaCurrency ? toINR(metaSpend, metaCurrency, fxRates) : 0;
        const googleInr = googleSpend != null && googleCurrency ? toINR(googleSpend, googleCurrency, fxRates) : 0;
        const blended = (metaInr || 0) + (googleInr || 0);

        const budget = c.monthly_budget != null ? Number(c.monthly_budget) : null;
        let actualPct = null, paceStatus = null;
        if (budget > 0) {
          actualPct = (blended / budget) * 100;
          const diff = actualPct - expectedPct;
          paceStatus = diff > 15 ? 'overspending' : diff < -15 ? 'underspending' : 'on_track';
        }

        return {
          client_id: c.id,
          snapshot_date: today,
          meta_spend_mtd: metaSpend,
          meta_currency: metaCurrency,
          google_spend_mtd: googleSpend,
          google_currency: googleCurrency,
          blended_spend_inr: blended,
          fx_rates_used: fxRates,
          budget,
          budget_month: c.monthly_budget_month || null,
          expected_pct: expectedPct,
          actual_pct: actualPct,
          pace_status: paceStatus,
        };
      }));
      rows.push(...batchRows);
    }

    // Upsert so a re-run the same day corrects today's row instead of duplicating it.
    const { error: upErr } = await db
      .from('meraki_budget_snapshots')
      .upsert(rows, { onConflict: 'client_id,snapshot_date' });
    if (upErr) throw new Error(`upsert: ${upErr.message}`);

    return res.status(200).json({ success: true, date: today, snapshotted: rows.length });
  } catch (err) {
    console.error('Budget snapshot cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
