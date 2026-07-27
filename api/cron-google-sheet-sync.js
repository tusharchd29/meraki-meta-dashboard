import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { syncGoogleAdsSheet } from '../lib/googleAdsSheetSync.js';

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sheetId = process.env.GOOGLE_ADS_SHEET_ID;
  if (!sheetId) {
    // Not set up yet — not an error, just nothing to do.
    return res.status(200).json({ skipped: 'GOOGLE_ADS_SHEET_ID not configured' });
  }

  try {
    const db = supabaseAdmin();
    const result = await syncGoogleAdsSheet(sheetId, db);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Google Ads sheet sync cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
