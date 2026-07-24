import { createClient } from '@supabase/supabase-js'

// Server-only client. Uses the service role key so it can read/write the
// meraki_ad_connections / meraki_ad_accounts tables directly (RLS has no
// anon policies on those tables — only this key can touch them).
// Never import this file from client components.
let _client = null

export function supabaseAdmin() {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured')
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}
