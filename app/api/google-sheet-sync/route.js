import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getServiceAccountEmail } from '@/lib/googleSheetsClient'
import { syncGoogleAdsSheet } from '@/lib/googleAdsSheetSync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET: setup status — which email to share the Sheet with, and whether
// GOOGLE_ADS_SHEET_ID is configured yet. Lets the UI walk someone through
// setup without any secret ever being displayed or typed into chat.
export async function GET() {
  return Response.json({
    serviceAccountEmail: getServiceAccountEmail(),
    sheetConfigured: !!process.env.GOOGLE_ADS_SHEET_ID,
  })
}

// POST: manual "Sync now" trigger — same logic the cron runs automatically.
export async function POST() {
  const sheetId = process.env.GOOGLE_ADS_SHEET_ID
  if (!sheetId) {
    return Response.json({ error: 'GOOGLE_ADS_SHEET_ID not configured yet — add it in Vercel env vars once your Sheet is set up.' }, { status: 400 })
  }
  try {
    const db = supabaseAdmin()
    const result = await syncGoogleAdsSheet(sheetId, db)
    return Response.json({ ok: true, ...result })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
