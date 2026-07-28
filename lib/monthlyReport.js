import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
const autoTable = autoTableImport.default || autoTableImport;
import { supabaseAdmin } from './supabaseAdmin.js';
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

const SHORT_DATE = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// An explicit, arbitrary start/end (both 'YYYY-MM-DD', inclusive) — the
// path a custom date-range report or a weekly report resolves through.
export function customRangeBounds(start, end) {
  if (!start || !end) throw new Error('Both start and end dates are required')
  if (start > end) throw new Error('Start date must be before end date')
  return { start, end, label: `${SHORT_DATE(start)} – ${SHORT_DATE(end)}` }
}

// What pacing actually needs to answer is 'given everything spent so far
// this month, are we on track for the full monthly budget by month-end' —
// not 'did this specific window spend its isolated share.' The latter
// (an earlier version of this function) is actively misleading: a client
// who blew through their budget in week 1 and then went quiet in week 3
// would show week 3 as 'under budget', while actually running well over
// for the month. Getting this right needs month-to-date spend (from the
// 1st of the report's end month through the report's end date), which is
// a DIFFERENT range than the report's own display window whenever that
// window doesn't start on the 1st (i.e. any week or custom-range report).
function monthToDateInfo(start, end) {
  const endDate = new Date(end + 'T00:00:00')
  const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate()
  const monthStart = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`
  const daysElapsed = endDate.getDate()
  return {
    monthStart,
    daysInMonth,
    daysElapsed,
    expectedPct: (daysElapsed / daysInMonth) * 100,
    // If the report's own window already starts on the 1st (a full-month
    // report, or a custom range that happens to begin at month start),
    // its own period spend already IS month-to-date — no extra fetch needed.
    needsSeparateFetch: start !== monthStart,
  }
}

// Monday through Sunday of the week before the current one, in IST — what
// the weekly cron reports on. Computed the same "shift to IST, read local
// fields" way defaultTargetMonth() does, since Vercel functions run in UTC.
export function lastWeekBounds() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = (ist.getDay() + 6) % 7; // Monday=0 .. Sunday=6
  const thisMonday = new Date(ist.getFullYear(), ist.getMonth(), ist.getDate() - dayOfWeek);
  const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1);
  const iso = d => d.toISOString().split('T')[0];
  return customRangeBounds(iso(lastMonday), iso(lastSunday));
}

// Single place every caller (manual "Generate" click, the monthly cron,
// the weekly cron) resolves a request into the {start,end,label} triple
// buildMonthlyReportData actually needs — so there's one definition of
// what "this month" or "last week" means, not one per call site.
export function resolveReportRange({ mode, month, start, end } = {}) {
  if (mode === 'week') return lastWeekBounds();
  if (mode === 'range' || (start && end)) return customRangeBounds(start, end);
  return monthBounds(month || defaultTargetMonth());
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

// Meta's rate-limit/"try again" errors come back as HTTP 200 with an error
// object in the JSON body, not a non-200 status — a plain status check
// misses them. Codes 4/17/32/613 are Meta's documented throttling codes;
// is_transient covers the rest.
const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 613]);
function isTransientMetaError(data) {
  return data?.error?.is_transient === true || TRANSIENT_META_CODES.has(data?.error?.code);
}

// 10s-per-attempt timeout, retried up to 3 times total on network errors,
// 5xx, or Meta's own transient error codes, with backoff (500ms, 1.5s).
async function fetchGraphWithRetry(url, attempts = 3) {
  let lastErrorMessage = 'unknown error';
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const r = await fetch(url, { signal: controller.signal });
      const d = await r.json();
      clearTimeout(timeout);
      const shouldRetry = r.status >= 500 || isTransientMetaError(d);
      if (!shouldRetry || i === attempts - 1) return d;
      lastErrorMessage = d?.error?.message || `HTTP ${r.status}`;
    } catch (e) {
      clearTimeout(timeout);
      lastErrorMessage = e.message;
      if (i === attempts - 1) return { error: { message: e.message } };
    }
    await new Promise(res => setTimeout(res, 500 * Math.pow(3, i)));
  }
  return { error: { message: lastErrorMessage } };
}

// Follows Graph API paging so an account with more than one page of
// campaigns doesn't get silently truncated at the first page's limit.
async function fetchGraphAllPages(url, cap = 2000) {
  const out = [];
  let next = url;
  while (next && out.length < cap) {
    const d = await fetchGraphWithRetry(next);
    if (d?.error) return { error: d.error.message, data: out };
    out.push(...(d?.data || []));
    next = d?.paging?.next || null;
  }
  return { error: null, data: out };
}

// Read-only, GET-only, insights-only — same contract as app/api/meta.js.
async function fetchMetaCampaigns(accountId, token, since, until) {
  const p = new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,actions',
    time_range: JSON.stringify({ since, until }),
    action_attribution_windows: JSON.stringify(['1d_click', '7d_click', '1d_view']),
    limit: '200',
    access_token: token,
  });
  const d = await fetchGraphWithRetry(`${META_BASE}/act_${accountId}/insights?${p}`);
  if (d?.error) return { error: d.error.message, campaigns: [] };
  const campaigns = (d?.data || []).map(row => {
    const spend = parseFloat(row.spend || 0);
    const { count, label } = metaResultsLabel(row.actions, spend);
    return { id: row.campaign_id, name: row.campaign_name, spend, resultCount: count, resultLabel: label };
  });
  return { error: null, campaigns };
}

// Lightweight account-level total — used only to get month-to-date spend
// for pacing, where the per-campaign breakdown isn't needed. Cheaper than
// re-running fetchMetaCampaigns for a (usually wider) date range.
async function fetchMetaAccountSpend(accountId, token, since, until) {
  const p = new URLSearchParams({
    fields: 'spend',
    time_range: JSON.stringify({ since, until }),
    access_token: token,
  });
  const d = await fetchGraphWithRetry(`${META_BASE}/act_${accountId}/insights?${p}`);
  if (d?.error) return { error: d.error.message, spend: null };
  return { error: null, spend: parseFloat(d?.data?.[0]?.spend || 0) };
}

// Whether each campaign is actually live right now — independent of
// whether it spent anything this reporting period. A campaign that's
// ACTIVE but shows 0 spend didn't necessarily do nothing; it may not have
// any insights rows at all for the period, so this list (not the insights
// call above) is the source of truth for "is it running."
async function fetchMetaCampaignStatuses(accountId, token) {
  const p = new URLSearchParams({
    fields: 'id,name,effective_status',
    limit: '200', // paginated below, not a hard cap
    access_token: token,
  });
  const { error, data } = await fetchGraphAllPages(`${META_BASE}/act_${accountId}/campaigns?${p}`);
  if (error) return { error, campaigns: [] };
  const campaigns = data.map(c => ({ id: c.id, name: c.name, status: c.effective_status || null }));
  return { error: null, campaigns };
}

// Merges live campaign status onto the spend/results list, and adds back
// any currently-running campaign that had no insights rows at all this
// period (Meta's insights endpoint only returns rows with some activity —
// a campaign that's ACTIVE but genuinely spent/served nothing wouldn't
// appear there, which is exactly the case worth surfacing: it's running
// but doing nothing).
function mergeMetaCampaignStatus(insightRows, statusRows) {
  const statusById = new Map(statusRows.map(s => [s.id, s.status]));
  const seenIds = new Set();
  const merged = insightRows.map(row => {
    if (row.id) seenIds.add(row.id);
    return { ...row, status: row.id ? (statusById.get(row.id) ?? null) : null };
  });
  for (const s of statusRows) {
    if (seenIds.has(s.id)) continue;
    merged.push({ id: s.id, name: s.name, spend: 0, resultCount: null, resultLabel: '', status: s.status });
  }
  return merged;
}

const META_RUNNING_STATUSES = new Set(['ACTIVE']);
const GOOGLE_RUNNING_STATUSES = new Set(['enabled']);
function isRunning(status) {
  if (status == null) return null; // unknown — status wasn't available
  return META_RUNNING_STATUSES.has(status) || GOOGLE_RUNNING_STATUSES.has(String(status).toLowerCase());
}

// BUG FIX: Google exports are arbitrary date-range aggregates chosen by
// whoever ran the export (e.g. "27 June – 24 July"), not calendar-aligned
// periods — there's no per-day breakdown to slice unless the export
// included a "Day" column (see meraki_google_spend_daily below). The old
// version of this function included any import that merely *overlapped*
// the requested range and counted its FULL cost — so an export spanning
// two months would have its entire total double-counted into both
// months' reports. That's likely why reported spend didn't match what
// was actually spent in the month: it could include days outside it.
//
// Fix: only include imports FULLY CONTAINED within [start, end] for the
// per-campaign breakdown — no partial-cost guessing. Imports that only
// partially overlap are excluded and reported by name so nothing is
// silently dropped or silently wrong; the client-level total prefers true
// daily data (see googleDailyTotalForClient) specifically because it
// doesn't have this problem at all.
function googleCampaignsForMonth(allCampaigns, clientId, start, end) {
  const clientRows = allCampaigns.filter(c => c.client_id === clientId)
  const rows = clientRows.filter(c => c.period_start >= start && c.period_end <= end)
  const excluded = clientRows.filter(c => c.period_start <= end && c.period_end >= start && !(c.period_start >= start && c.period_end <= end))
  const excludedPeriods = [...new Set(excluded.map(c => `${c.period_start} → ${c.period_end}`))]

  const byName = new Map()
  for (const r of rows) {
    const cost = Number(r.cost) || 0
    const conversions = r.conversions != null ? Number(r.conversions) : null
    const existing = byName.get(r.campaign_name)
    if (!existing) {
      byName.set(r.campaign_name, {
        name: r.campaign_name, spend: cost, resultCount: conversions,
        resultLabel: conversions != null ? 'Conversions' : '', currency: r.currency,
        // Status reflects the most recently imported export covering this
        // month, since that's the freshest signal a manual CSV import can give.
        status: r.campaign_status || null, statusAsOf: r.period_end,
      })
    } else {
      existing.spend += cost
      if (conversions != null) existing.resultCount = (existing.resultCount || 0) + conversions
      if (r.campaign_status && (!existing.statusAsOf || r.period_end > existing.statusAsOf)) {
        existing.status = r.campaign_status
        existing.statusAsOf = r.period_end
      }
    }
  }
  return { campaigns: [...byName.values()], excludedPeriods }
}

// The one number that can't have the over-counting bug above: real
// per-day spend, when the export included a "Day" column. Summing exactly
// the days in [start, end] gives the true total regardless of what
// arbitrary range the original export covered.
function googleDailyTotalForClient(dailyRows, clientId, start, end) {
  const rows = dailyRows.filter(r => r.client_id === clientId && r.spend_date >= start && r.spend_date <= end)
  if (!rows.length) return null
  return { total: rows.reduce((s, r) => s + (Number(r.cost) || 0), 0), currency: rows[0].currency }
}

// Builds the full per-client report data for an already-resolved
// {start,end,label} range (see resolveReportRange) — used the same way
// whether that range came from a picked month, a picked week, or an
// explicit custom date range. Shared by the cron (emails automatically)
// and the dashboard's manual trigger (emails on demand + returns the PDF
// for immediate download).
export async function buildMonthlyReportData({ start, end, label }) {
  const db = supabaseAdmin();

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
    .select('id, name, meta_ad_account_id, google_ads_customer_id, monthly_budget, meta_monthly_budget, google_monthly_budget')
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
  const liveMappedClients = allClients.filter(c =>
    (c.meta_ad_account_id && liveMetaIds.has(c.meta_ad_account_id)) ||
    (c.google_ads_customer_id && liveGoogleIds.has(c.google_ads_customer_id))
  );

  // meraki_clients can carry stale duplicates from before the roster was
  // cleaned up — two rows mapped to the exact same underlying account (e.g.
  // "She Care" and "SSW" both pointing at the same Meta ad account) render
  // as two near-identical full pages in the PDF. Collapse any such
  // collision down to one row, keeping whichever has a budget set (the more
  // deliberately-configured entry) so the duplicate doesn't survive purely
  // by insertion order.
  const dedupedByKey = new Map();
  const droppedDuplicates = [];
  for (const c of liveMappedClients) {
    const key = c.meta_ad_account_id ? `meta:${c.meta_ad_account_id}` : `google:${c.google_ads_customer_id}`;
    const existing = dedupedByKey.get(key);
    if (!existing) {
      dedupedByKey.set(key, c);
      continue;
    }
    const hasBudget = c => c.monthly_budget != null || c.meta_monthly_budget != null || c.google_monthly_budget != null;
    const candidateIsBetter = hasBudget(c) && !hasBudget(existing);
    if (candidateIsBetter) {
      dedupedByKey.set(key, c);
      droppedDuplicates.push(existing.name);
    } else {
      droppedDuplicates.push(c.name);
    }
  }
  const mappedClients = [...dedupedByKey.values()];

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
    .select('client_id, campaign_name, campaign_status, cost, conversions, currency, period_start, period_end');

  const mtdInfo = monthToDateInfo(start, end);

  // Widened to start-of-month (not just the report's own window) so this
  // one fetch can serve both the period-level lookup below AND the
  // month-to-date pacing lookup, without a second round trip to Supabase.
  const { data: googleDaily } = await db
    .from('meraki_google_spend_daily')
    .select('client_id, spend_date, cost, currency')
    .gte('spend_date', mtdInfo.monthStart)
    .lte('spend_date', end);

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
        const [r, statusResult] = await Promise.all([
          fetchMetaCampaigns(c.meta_ad_account_id, token, start, end),
          fetchMetaCampaignStatuses(c.meta_ad_account_id, token),
        ]);
        metaCampaigns = mergeMetaCampaignStatus(r.campaigns, statusResult.campaigns);
        metaError = r.error;
        metaCurrency = acct.currency || 'INR';
        metaSpend = metaCampaigns.reduce((s, m) => s + m.spend, 0);
      }

      const { campaigns: googleC, excludedPeriods: googleExcludedPeriods } = googleCampaigns
        ? googleCampaignsForMonth(googleCampaigns, c.id, start, end)
        : { campaigns: [], excludedPeriods: [] };
      const googleDailyTotal = googleDaily ? googleDailyTotalForClient(googleDaily, c.id, start, end) : null;
      const googleCurrency = googleDailyTotal?.currency || googleC[0]?.currency || null;
      // Prefer the true daily total for the number that actually drives
      // budget pacing — it can't have the over-counting problem a
      // period-based import can. The campaign breakdown below still comes
      // from period data (no per-campaign daily granularity exists), so it
      // may not sum to exactly this figure; googleExcludedPeriods explains
      // why when that happens.
      const googleSpend = googleDailyTotal ? googleDailyTotal.total : googleC.reduce((s, g) => s + g.spend, 0);
      const googleStatus = (c.google_ads_customer_id && !googleC.length && !googleDailyTotal)
        ? 'Google Ads mapped but no export imported for this period yet.'
        : null;

      // Report in the account's own currency — never convert to INR. Budget
      // is assumed to be entered in that same currency, so spend and budget
      // compare directly with no FX step. When Meta and Google share a
      // currency (the normal case, including plain INR), their spend sums
      // directly since it's already the same unit. If they genuinely differ
      // (e.g. Meta in THB, Google in NZD for one client), summing them would
      // require a conversion we're told never to do — so they're kept
      // separate instead, and budget pacing is left unset rather than
      // guessed against a mixed figure.
      const currency = metaCurrency || googleCurrency || 'INR';
      const mixedCurrency = !!(metaCurrency && googleCurrency && metaCurrency !== googleCurrency);
      const spend = mixedCurrency ? null : (metaSpend + googleSpend); // this report window's own spend — unaffected by the MTD fetch below

      // Budgets are approved separately per platform now; this report paces
      // blended MTD spend, so it sums both. Falls back to the legacy
      // combined field only for clients not yet re-entered under the split
      // fields.
      const hasSplitBudget = c.meta_monthly_budget != null || c.google_monthly_budget != null;
      const budget = hasSplitBudget
        ? Number(c.meta_monthly_budget || 0) + Number(c.google_monthly_budget || 0)
        : (c.monthly_budget != null ? Number(c.monthly_budget) : null);
      let mtdSpend = null, finalPct = null, pace = null, expectedPct = null, googleMtdIncomplete = false;
      if (!mixedCurrency) {
        let metaMtdSpend = metaSpend, googleMtdSpend = googleSpend;
        if (mtdInfo.needsSeparateFetch) {
          if (acct && token) {
            const mtdResult = await fetchMetaAccountSpend(c.meta_ad_account_id, token, mtdInfo.monthStart, end);
            if (mtdResult.spend != null) metaMtdSpend = mtdResult.spend;
          }
          const googleMtdDaily = googleDaily ? googleDailyTotalForClient(googleDaily, c.id, mtdInfo.monthStart, end) : null;
          if (googleMtdDaily) googleMtdSpend = googleMtdDaily.total;
          else if (c.google_ads_customer_id) googleMtdIncomplete = true; // no daily import covers the full month — falling back to this window's own Google spend, which understates true MTD
        }
        mtdSpend = metaMtdSpend + googleMtdSpend;
      }
      if (budget > 0 && mtdSpend != null) {
        finalPct = (mtdSpend / budget) * 100;
        expectedPct = mtdInfo.expectedPct;
        const diff = finalPct - expectedPct;
        pace = diff > 15 ? 'over_budget' : diff < -15 ? 'under_budget' : 'on_budget';
      }

      return {
        name: c.name,
        metaCampaigns, metaError, metaCurrency, metaStatus, metaSpend,
        googleCampaigns: googleC, googleCurrency, googleStatus, googleSpend, googleExcludedPeriods,
        googleSpendIsDaily: !!googleDailyTotal, googleMtdIncomplete,
        currency, mixedCurrency,
        budget, spend, mtdSpend, finalPct, pace, expectedPct,
        isMtdSeparate: mtdInfo.needsSeparateFetch,
        daysElapsed: mtdInfo.daysElapsed, daysInMonth: mtdInfo.daysInMonth,
      };
    }));
    clientReports.push(...results);
  }

  // Every client here already passed the live-connection gate above, so a
  // zero here is real signal ("connected, nothing spent yet this month")
  // rather than noise — nothing further to filter out.
  return { clientReports, label, start, end, droppedDuplicates };
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Shared file-naming convention for every report artifact (manual download,
// manual email, monthly cron, weekly cron) — "Meraki PPC Report - Jun-2026.pdf"
// for a full calendar month, or "Meraki PPC Report - 20Jul-26Jul2026.pdf"
// for a week or any other custom range.
export function reportFileName({ start, end }) {
  const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00');
  const isFullMonth = s.getDate() === 1 && e.getMonth() === s.getMonth() && e.getFullYear() === s.getFullYear() &&
    e.getDate() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
  if (isFullMonth) return `Meraki PPC Report - ${MONTH_ABBR[s.getMonth()]}-${s.getFullYear()}.pdf`;
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}${MONTH_ABBR[d.getMonth()]}`;
  return `Meraki PPC Report - ${fmt(s)}-${fmt(e)}${e.getFullYear()}.pdf`;
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
//
// CRITICAL: keep every (cx, cy, w, h) combo's bounding box fully inside
// the page (0-210mm x, 0-297mm y for A4 portrait). jsPDF's context2d
// silently calls addPage() the first time a filled/stroked path's bounds
// extend past the current page edge — not gated by the documented
// `autoPaging` flag (which is false by default and unrelated here). This
// bit the original bottom-right placement (cy=265, h=90 → bottom edge at
// 310mm, 13mm past the page), which meant literally every report ever
// generated had a blank page 1: the very first watermark call jumped the
// document to page 2 before any content — including the whole overview
// page — was drawn, and jsPDF's auto-created page 1 was left empty.
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

// The two decorative watermarks every page gets, in one place so the fixed
// (in-bounds) coordinates can't drift out of sync between call sites again.
function drawPageWatermarks(doc) {
  drawLeafWatermark(doc, 178, 230, 46, 90, -16, 0.05); // bottom-right — cy lowered from 265 to keep the bounding box on-page
  drawLeafWatermark(doc, 24, 40, 26, 52, 12, 0.04);    // top-left — already within bounds
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

// Pretty-prints a raw platform status ('ACTIVE', 'enabled', 'WITH_ISSUES')
// into something readable ('Active', 'Enabled', 'With Issues').
function statusLabel(status) {
  if (!status) return '—';
  return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

// A campaign with no spend and no result is only noise if it's ALSO not
// currently running — that's the legacy/paused case that turned Volvo's
// Google table into 60+ lines of "0 0 Conversions". A campaign that IS
// currently running but spent nothing this period is the opposite of
// noise: it's a live campaign doing nothing, worth a human's attention, so
// it's kept and pushed to the top rather than hidden. Status 'unknown'
// (null — the platform didn't return one) is treated as not-running for
// filtering purposes, since there's no live signal to justify keeping it.
function activeCampaignRows(list) {
  const kept = [];
  let hidden = 0;
  for (const r of list) {
    const hasActivity = r.spend > 0 || r.resultCount > 0;
    const running = isRunning(r.status) === true;
    if (!hasActivity && !running) hidden++;
    else kept.push(r);
  }
  kept.sort((a, b) => {
    const aFlag = (isRunning(a.status) === true && !(a.spend > 0 || a.resultCount > 0)) ? 0 : 1;
    const bFlag = (isRunning(b.status) === true && !(b.spend > 0 || b.resultCount > 0)) ? 0 : 1;
    return aFlag - bFlag;
  });
  return { kept, hidden };
}

// Genuinely nothing to report: no budget was ever set for it, it spent
// nothing on either platform, and there's no error/status worth flagging.
// These are almost always stale or test ad accounts that got swept in by
// "Track" — one full page each is pure scroll with zero information, so
// they're collapsed into a single compact appendix at the end instead.
function hasNoActivity(c) {
  return c.budget == null && c.metaSpend === 0 && c.googleSpend === 0 && c.metaCampaigns.length === 0 &&
    c.googleCampaigns.length === 0 && !c.metaError && !c.metaStatus && !c.googleStatus;
}

// Every amount in this report is shown in the account's own currency —
// never converted. INR gets the familiar 'Rs' prefix; anything else is
// labeled with its currency code so a THB or NZD figure is never
// mistaken for INR.
function fmtMoney(amount, currency) {
  const rounded = Math.round(amount).toLocaleString('en-IN');
  return (!currency || currency === 'INR') ? `Rs ${rounded}` : `${currency} ${rounded}`;
}

// Shared by the PDF and the email summary: the spend figure to display,
// accounting for the rare case where Meta and Google use two different
// currencies for the same client, which can't be added into one number
// without converting.
function spendDisplay(c) {
  return c.spend != null
    ? fmtMoney(c.spend, c.currency)
    : `Meta ${fmtMoney(c.metaSpend, c.metaCurrency)} + Google ${fmtMoney(c.googleSpend, c.googleCurrency)}`;
}
function hadAnySpend(c) {
  return (c.metaSpend || 0) > 0 || (c.googleSpend || 0) > 0;
}

const PACE_RANK = { over_budget: 0, under_budget: 1, on_budget: 2 };
function urgencyRank(c) {
  if (c.pace != null) return PACE_RANK[c.pace];
  return 3; // spending with no budget set — still worth seeing, just after the paced ones
}

export function buildBrandedPdf(clientReports, monthLabel, droppedDuplicates = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const hasScriptFont = registerBrandFont(doc);

  const activeReports = clientReports.filter(c => !hasNoActivity(c));
  const quietReports = clientReports.filter(hasNoActivity);
  // The core split this page exists to make obvious at a glance: who
  // actually spent money this period, versus who's tracked (has a budget
  // or real campaigns) but simply didn't spend in this specific window.
  // Mixing these into one table is exactly what made it hard to tell
  // what's actually happening from the summary alone.
  const spendingReports = activeReports.filter(hadAnySpend);
  const noSpendReports = activeReports.filter(c => !hadAnySpend(c));
  const sortedSpending = [...spendingReports].sort((a, b) =>
    urgencyRank(a) - urgencyRank(b) || a.name.localeCompare(b.name)
  );
  const sortedNoSpend = [...noSpendReports].sort((a, b) => a.name.localeCompare(b.name));

  // Every client report carries the same isMtdSeparate/daysElapsed/daysInMonth
  // (they all share one report range), so any one of them tells us whether
  // this report's window starts on the 1st (full-month report — its own
  // spend already IS month-to-date) or not (week/custom-range — pacing
  // pulled a separate month-to-date figure).
  const periodInfo = clientReports[0];
  const isMtdSeparate = !!periodInfo && periodInfo.isMtdSeparate;

  const newPage = () => {
    doc.addPage();
    drawPageWatermarks(doc);
  };

  // ── Page 1: overview, split by whether there's spend to look at, so
  //    the whole period is scannable without paging through every client
  //    or hunting through one mixed table. ──────────────────────────────
  drawPageWatermarks(doc);
  brandHeader(doc, hasScriptFont, 'Monthly Campaign Report — Overview');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`${monthLabel}   |   ${spendingReports.length} spending, ${noSpendReports.length} tracked with no spend this period   |   each in its own account currency, not converted`, 14, 32, { maxWidth: 182 });

  let y = 40;
  if (isMtdSeparate) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(140, 140, 140);
    doc.text(`Pacing below uses month-to-date spend (everything spent since the 1st of the month, not just this report's own window) against each full monthly budget, adjusted for how far into the month we are (${periodInfo.daysElapsed}/${periodInfo.daysInMonth} days). "Spent" still shows only this report's own window.`, 14, y, { maxWidth: 182 });
    y += 10;
  }

  doc.setFontSize(10);
  doc.setTextColor(...BRAND_GREEN_DK);
  doc.setFont('helvetica', 'bold');
  doc.text(`Spending This Period (${spendingReports.length})`, 14, y);
  y += 4;

  if (sortedSpending.length) {
    autoTable(doc, {
      startY: y,
      head: [['Client', 'Budget', 'Spent', 'Pacing (Month-to-Date)']],
      body: sortedSpending.map(c => [
        c.name,
        c.budget != null ? fmtMoney(c.budget, c.currency) : 'not set',
        spendDisplay(c),
        c.pace ? `${c.pace.replace('_', ' ')} (${c.finalPct != null ? c.finalPct.toFixed(0) : '—'}% of budget)`
          : (c.mixedCurrency ? 'mixed currency — see detail page' : 'no budget set'),
      ]),
      theme: 'grid',
      headStyles: { fillColor: BRAND_GREEN, textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 246] },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2.2 },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 3) return;
        const c = sortedSpending[data.row.index];
        if (c.pace === 'over_budget') data.cell.styles.textColor = [220, 38, 38];
        else if (c.pace === 'under_budget') data.cell.styles.textColor = [217, 119, 6];
        else if (c.pace === 'on_budget') data.cell.styles.textColor = [22, 163, 74];
        data.cell.styles.fontStyle = 'bold';
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('No client spent anything this period.', 14, y + 4);
    y += 12;
  }

  if (y > 250) { newPage(); y = 20; }

  doc.setFontSize(10);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'bold');
  doc.text(`Tracked, No Spend This Period (${noSpendReports.length})`, 14, y);
  y += 4;

  if (sortedNoSpend.length) {
    autoTable(doc, {
      startY: y,
      head: [['Client', 'Budget']],
      body: sortedNoSpend.map(c => [c.name, c.budget != null ? fmtMoney(c.budget, c.currency) : 'not set']),
      theme: 'grid',
      headStyles: { fillColor: [150, 150, 150], textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [110, 110, 110] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2.2 },
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    y += 8;
  }

  let noteY = y;
  if (quietReports.length) {
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`+ ${quietReports.length} tracked account${quietReports.length === 1 ? '' : 's'} with no budget and no campaigns at all — listed on the last page instead of a full page each.`, 14, noteY, { maxWidth: 182 });
    noteY += 6;
  }
  if (droppedDuplicates.length) {
    doc.setFontSize(8);
    doc.setTextColor(200, 140, 20);
    doc.text(`Note: ${droppedDuplicates.length} duplicate client mapping${droppedDuplicates.length === 1 ? '' : 's'} pointing at an already-listed account ${droppedDuplicates.length === 1 ? 'was' : 'were'} skipped (${droppedDuplicates.join(', ')}) — worth cleaning up in Clients (Blended).`, 14, noteY, { maxWidth: 182 });
  }

  // ── One page per client with actual activity or a budget ──────────────
  activeReports.forEach((c) => {
    newPage();
    brandHeader(doc, hasScriptFont, 'Monthly Campaign Report');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`${c.name}   |   ${monthLabel}`, 14, 32);

    // Allocated vs spent summary block
    const hasNote = c.mixedCurrency || c.isMtdSeparate;
    const boxHeight = hasNote ? 23 : 19;
    doc.setDrawColor(...BRAND_GREEN);
    doc.setFillColor(248, 250, 246);
    doc.roundedRect(14, 37, 182, boxHeight, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Allocated (Budget)', 18, 44);
    doc.text('Spent', 78, 44);
    doc.text('Pacing (MTD)', 138, 44);
    doc.setFont('helvetica', 'normal');
    doc.text(c.budget != null ? fmtMoney(c.budget, c.currency) : 'not set', 18, 51);
    doc.text(spendDisplay(c), 78, 51);
    const paceColor = c.pace === 'over_budget' ? [220, 38, 38] : c.pace === 'under_budget' ? [217, 119, 6] : [22, 163, 74];
    doc.setTextColor(...paceColor);
    doc.setFont('helvetica', 'bold');
    doc.text(c.pace ? `${c.pace.replace('_', ' ')} (${c.finalPct != null ? c.finalPct.toFixed(0) : '—'}% of budget)`
      : (c.mixedCurrency ? 'mixed currency' : 'no budget set'), 138, 51);
    if (c.mixedCurrency) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('Meta and Google use different currencies for this client — shown separately below, not combined.', 18, 55.5, { maxWidth: 174 });
    } else if (c.isMtdSeparate) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      const mtdText = c.mtdSpend != null
        ? `Pacing compares month-to-date spend (${fmtMoney(c.mtdSpend, c.currency)}, since the 1st) to the full budget above — not the ${fmtMoney(c.spend, c.currency)} shown as 'Spent' for just this report window.${c.googleMtdIncomplete ? ' Google MTD may be understated — no daily-granularity import covers the full month.' : ''}`
        : `Pacing needs month-to-date spend, which couldn't be fetched for this client this time — treat the pacing figure with caution.`;
      doc.text(mtdText, 18, 55.5, { maxWidth: 174 });
    }

    let y = hasNote ? 67 : 63;

    const { kept: metaRows, hidden: metaHidden } = activeCampaignRows(c.metaCampaigns);
    if (metaRows.length) {
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_GREEN_DK);
      doc.setFont('helvetica', 'bold');
      doc.text(`Meta Campaigns (${c.metaCurrency || 'INR'})`, 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Campaign', 'Status', 'Spend', 'Results']],
        body: metaRows.map(m => [
          m.name,
          statusLabel(m.status),
          Math.round(m.spend).toLocaleString('en-IN'),
          m.resultCount != null ? `${m.resultCount} ${m.resultLabel}` : '—',
        ]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_GREEN, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 246] },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const m = metaRows[data.row.index];
          const flagged = isRunning(m.status) === true && !(m.spend > 0 || m.resultCount > 0);
          if (flagged) {
            data.cell.styles.textColor = [180, 130, 20];
            if (data.column.index === 1) data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(140, 140, 140);
      const metaFlaggedCount = metaRows.filter(m => isRunning(m.status) === true && !(m.spend > 0 || m.resultCount > 0)).length;
      if (metaFlaggedCount) {
        doc.text(`Note: ${metaFlaggedCount} campaign${metaFlaggedCount === 1 ? ' is' : 's are'} currently active with no spend this period — worth a look.`, 14, y);
        y += 4;
      }
      if (metaHidden) {
        doc.text(`+ ${metaHidden} paused/inactive campaign${metaHidden === 1 ? '' : 's'} with no spend this period not shown.`, 14, y);
        y += 4;
      }
      y += 4;
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
    } else if (c.metaCampaigns.length && metaHidden === c.metaCampaigns.length) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`No spend on any Meta campaign this period (${metaHidden} inactive campaign${metaHidden === 1 ? '' : 's'} hidden).`, 14, y);
      y += 8;
    }

    if (y > 250) { newPage(); y = 20; }

    const { kept: googleRows, hidden: googleHidden } = activeCampaignRows(c.googleCampaigns);
    if (googleRows.length) {
      doc.setFontSize(10);
      doc.setTextColor(20, 100, 160);
      doc.setFont('helvetica', 'bold');
      doc.text(`Google Campaigns (${c.googleCurrency || 'INR'}, from manual import)`, 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Campaign', 'Status (as of last import)', 'Spend', 'Results']],
        body: googleRows.map(g => [
          g.name,
          statusLabel(g.status),
          Math.round(g.spend).toLocaleString('en-IN'),
          g.resultCount != null ? `${g.resultCount} ${g.resultLabel}` : '—',
        ]),
        theme: 'grid',
        headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 250, 253] },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const g = googleRows[data.row.index];
          const flagged = isRunning(g.status) === true && !(g.spend > 0 || g.resultCount > 0);
          if (flagged) {
            data.cell.styles.textColor = [180, 130, 20];
            if (data.column.index === 1) data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      let gy = doc.lastAutoTable.finalY + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(140, 140, 140);
      const googleFlaggedCount = googleRows.filter(g => isRunning(g.status) === true && !(g.spend > 0 || g.resultCount > 0)).length;
      if (googleFlaggedCount) {
        doc.text(`Note: ${googleFlaggedCount} campaign${googleFlaggedCount === 1 ? ' is' : 's are'} enabled per the last import with no spend that period — worth a look.`, 14, gy);
        gy += 4;
      }
      if (googleHidden) {
        doc.text(`+ ${googleHidden} paused/removed campaign${googleHidden === 1 ? '' : 's'} with no spend this period not shown.`, 14, gy);
        gy += 4;
      }
      if (c.googleExcludedPeriods?.length) {
        doc.text(`Excludes ${c.googleExcludedPeriods.length} import(s) that only partially overlap this period (${c.googleExcludedPeriods.join('; ')}) — avoids double-counting days outside it. Client total above uses ${c.googleSpendIsDaily ? 'true daily-tracked spend' : 'this breakdown'}.`, 14, gy, { maxWidth: 182 });
      }
    } else {
      doc.setFontSize(8);
      doc.setTextColor(c.googleStatus ? 200 : 150, c.googleStatus ? 140 : 150, c.googleStatus ? 20 : 150);
      const fallback = c.googleCampaigns.length && googleHidden === c.googleCampaigns.length
        ? `No spend on any Google campaign this period (${googleHidden} inactive campaign${googleHidden === 1 ? '' : 's'} hidden).`
        : c.googleExcludedPeriods?.length
          ? `No import fully covers this period — ${c.googleExcludedPeriods.length} import(s) only partially overlap it (${c.googleExcludedPeriods.join('; ')}), so no campaign breakdown is shown. ${c.googleSpendIsDaily ? 'Client total above still uses true daily-tracked spend for this exact range.' : 'Import a Day-segmented export to get an accurate total for this exact range.'}`
          : (c.googleStatus || 'No Google Ads account mapped for this client.');
      doc.text(fallback, 14, y, { maxWidth: 182 });
    }

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'italic');
    doc.text('merakiads.in · Internal Report', 14, 289);
  });

  // ── Appendix: tracked accounts with no budget and no spend this month —
  //    one compact table instead of a near-empty page each. ─────────────
  if (quietReports.length) {
    newPage();
    brandHeader(doc, hasScriptFont, 'Monthly Campaign Report — No Activity');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`${monthLabel}   |   Tracked accounts with no budget set and no spend this month`, 14, 32);
    autoTable(doc, {
      startY: 40,
      head: [['Client']],
      body: quietReports.map(c => [c.name]),
      theme: 'grid',
      headStyles: { fillColor: [150, 150, 150], textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [110, 110, 110] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2.2 },
    });
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'italic');
    doc.text('Set a budget or check tracking in Connections if any of these should be active. merakiads.in · Internal Report', 14, 289);
  }

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
          <th style="padding:6px;text-align:right">Budget</th>
          <th style="padding:6px;text-align:right">Spent</th>
          <th style="padding:6px;text-align:right">Pacing (MTD)</th>
        </tr>
        ${clientReports.map((c, i) => `
          <tr style="background:${i % 2 ? '#f8faf6' : '#fff'}">
            <td style="padding:6px">${c.name}</td>
            <td style="padding:6px;text-align:right">${c.budget != null ? fmtMoney(c.budget, c.currency) : '—'}</td>
            <td style="padding:6px;text-align:right">${spendDisplay(c)}</td>
            <td style="padding:6px;text-align:right;color:${c.pace === 'over_budget' ? '#dc2626' : c.pace === 'under_budget' ? '#d97706' : '#16a34a'}">
              ${c.pace ? c.pace.replace('_', ' ') + (c.finalPct != null ? ` (${c.finalPct.toFixed(0)}% of budget)` : '') : (c.mixedCurrency ? 'mixed currency' : 'no budget')}
            </td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}
