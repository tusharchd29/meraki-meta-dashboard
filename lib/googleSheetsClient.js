import { google } from 'googleapis'

// Reuses the GOOGLE_SERVICE_ACCOUNT_JSON already configured for the Meta
// daily-sheet crons (api/cron-meta-fetch.js, api/cron-meta-email.js) — same
// credential, same 'spreadsheets' scope, just a second consumer. No new
// Google Cloud setup needed; the only new step is sharing the target Sheet
// with this service account's email (see getServiceAccountEmail below).
export async function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')
  const credentials = JSON.parse(raw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth: await auth.getClient() })
}

// The server can read this env var at runtime even though nobody browsing
// Vercel's UI (or Claude, editing this code) can see the raw secret value —
// surfacing it here is how the person setting this up finds out which
// email to share their Sheet with, without anyone having to paste a secret
// into chat or a screenshot.
export function getServiceAccountEmail() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try { return JSON.parse(raw).client_email || null } catch { return null }
}
