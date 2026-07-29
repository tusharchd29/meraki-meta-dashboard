import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const META_BASE = 'https://graph.facebook.com/v22.0';

// Same read-only guarantee as api/meta.js and cron-budget-snapshot.js:
// GET only, insights fields only, no write scope on the underlying token.
//
// This is a top-level Vercel Function (not under app/api/**) so it's
// naturally outside middleware.js's session-cookie check — same pattern
// as the cron-*.js files, protected by its own bearer token instead
// (BLEND_READ_TOKEN, separate from CRON_SECRET). Unlike the cron files
// this one is a plain GET endpoint meant to be called on-demand by
// meraki-blend's command box, not on a schedule.

const DATE_PRESETS = { today: 'today', '7d': 'last_7d', '30d': 'last_30d', this_month: 'this_month' };

async function resolveAccountAndToken(db, clientId) {
  const { data: client, error: cErr } = await db
    .from('meraki_clients')
    .select('id, name, meta_ad_account_id')
    .eq('id', clientId)
    .single();
  if (cErr || !client) throw new Error(`Client not found: ${cErr?.message || clientId}`);
  if (!client.meta_ad_account_id) throw new Error(`${client.name} has no Meta ad account mapped`);

  const { data: acct, error: aErr } = await db
    .from('meraki_ad_accounts')
    .select('account_id, currency, connection_id')
    .eq('platform', 'meta')
    .eq('account_id', client.meta_ad_account_id)
    .single();
  if (aErr || !acct) throw new Error(`${client.name}'s Meta account isn't synced yet — run "Sync accounts" on the live dashboard`);

  const { data: conn, error: connErr } = await db
    .from('meraki_ad_connections')
    .select('access_token, is_active')
    .eq('id', acct.connection_id)
    .single();
  if (connErr || !conn?.is_active) throw new Error(`No active Meta connection for ${client.name}`);

  return { accountId: client.meta_ad_account_id, currency: acct.currency || 'INR', token: conn.access_token, clientName: client.name };
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.BLEND_READ_TOKEN}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only' });
  }

  const { clientId, level = 'account', range = 'this_month' } = req.query;
  if (!clientId) return res.status(400).json({ ok: false, error: 'clientId is required' });

  const datePreset = DATE_PRESETS[range] || DATE_PRESETS.this_month;
  const db = supabaseAdmin();

  try {
    const { accountId, currency, token, clientName } = await resolveAccountAndToken(db, clientId);

    if (level === 'campaigns') {
      // Single call using nested field expansion — one round trip instead
      // of listing campaigns then fetching insights per campaign.
      const p = new URLSearchParams({
        fields: `campaigns.limit(50){name,status,effective_status,insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,actions}}`,
        access_token: token,
      });
      const r = await fetch(`${META_BASE}/${accountId}?${p}`);
      const d = await r.json();
      if (d?.error) throw new Error(d.error.message || 'Meta API error');

      const campaigns = (d?.campaigns?.data || []).map(c => {
        const insight = c.insights?.data?.[0] || {};
        return {
          name: c.name,
          status: c.status,
          effectiveStatus: c.effective_status,
          spend: parseFloat(insight.spend || 0),
          impressions: parseInt(insight.impressions || 0, 10),
          clicks: parseInt(insight.clicks || 0, 10),
          ctr: parseFloat(insight.ctr || 0),
          actions: insight.actions || [],
        };
      });

      return res.status(200).json({ ok: true, clientName, currency, range, level: 'campaigns', campaigns });
    }

    // account-level
    const p = new URLSearchParams({
      fields: 'spend,impressions,clicks,ctr,cpc,actions',
      date_preset: datePreset,
      access_token: token,
    });
    const r = await fetch(`${META_BASE}/${accountId}/insights?${p}`);
    const d = await r.json();
    if (d?.error) throw new Error(d.error.message || 'Meta API error');
    const row = d?.data?.[0] || {};

    return res.status(200).json({
      ok: true,
      clientName,
      currency,
      range,
      level: 'account',
      spend: parseFloat(row.spend || 0),
      impressions: parseInt(row.impressions || 0, 10),
      clicks: parseInt(row.clicks || 0, 10),
      ctr: parseFloat(row.ctr || 0),
      cpc: parseFloat(row.cpc || 0),
      actions: row.actions || [],
    });
  } catch (err) {
    console.error('blend-meta error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
