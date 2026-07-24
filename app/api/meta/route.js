// READ-ONLY Meta API proxy
// Only whitelisted read endpoints are permitted. No writes, no POST/PATCH/DELETE forwarded.
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Allowed read-only endpoint patterns (regex)
const ALLOWED_PATTERNS = [
  /^act_\d+\/insights$/,
  /^act_\d+\/campaigns$/,
  /^act_\d+\/adsets$/,
  /^act_\d+\/ads$/,
  /^act_\d+\/activities$/,
  /^act_\d+$/,
  /^me$/,
  /^\d+\/insights$/,   // campaign/adset level insights
  /^\d+\/adsets$/,
  /^\d+\/ads$/,
  /^\d+$/,
]

function isAllowedEndpoint(endpoint) {
  return ALLOWED_PATTERNS.some(p => p.test(endpoint))
}

// Resolves which stored token to use for a given request.
// Priority: explicit ?token= override (debugging) > stored connection for the
// account (from the endpoint's act_<id> prefix, or an explicit ?account= param
// for campaign/adset-level endpoints that don't carry the account id) > the
// legacy single-token env var, kept as a fallback during migration.
async function resolveToken(searchParams, endpoint) {
  const explicitToken = searchParams.get('token')
  if (explicitToken) return { token: explicitToken, source: 'explicit' }

  const accountParam = searchParams.get('account') // e.g. act_123456789
  const accountMatch = endpoint.match(/^(act_\d+)/)
  const accountId = accountParam || (accountMatch ? accountMatch[1] : null)

  if (accountId) {
    try {
      const db = supabaseAdmin()
      const { data: acct } = await db
        .from('meraki_ad_accounts')
        .select('connection_id')
        .eq('platform', 'meta')
        .eq('account_id', accountId)
        .maybeSingle()

      if (acct?.connection_id) {
        const { data: conn } = await db
          .from('meraki_ad_connections')
          .select('access_token, is_active, token_expires_at')
          .eq('id', acct.connection_id)
          .eq('is_active', true)
          .maybeSingle()

        if (conn?.access_token) return { token: conn.access_token, source: 'connection' }
      }
    } catch {
      // Supabase not configured yet, or lookup failed — fall through to env token
    }
  }

  if (process.env.META_ACCESS_TOKEN) {
    return { token: process.env.META_ACCESS_TOKEN, source: 'env_fallback' }
  }

  return { token: null, source: 'none' }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')

  if (!endpoint) {
    return Response.json({ error: { message: 'No endpoint specified' } }, { status: 400 })
  }

  // Strict allowlist — reject anything not matching read-only patterns
  if (!isAllowedEndpoint(endpoint)) {
    return Response.json(
      { error: { message: `Endpoint not permitted: ${endpoint}. This dashboard is read-only.` } },
      { status: 403 }
    )
  }

  const { token } = await resolveToken(searchParams, endpoint)

  if (!token) {
    return Response.json(
      { error: { message: 'No access token available for this account. Connect it from the Connections panel.' } },
      { status: 500 }
    )
  }

  // Build Meta API URL — pass all params except endpoint/token/account
  const metaParams = new URLSearchParams()
  metaParams.set('access_token', token)

  for (const [key, value] of searchParams.entries()) {
    if (key === 'endpoint' || key === 'token' || key === 'account') continue
    metaParams.set(key, value)
  }

  const url = `https://graph.facebook.com/v22.0/${endpoint}?${metaParams.toString()}`

  try {
    // Always GET — never forward writes
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 }
    })
    const data = await res.json()
    return Response.json(data)
  } catch (e) {
    return Response.json({ error: { message: `Fetch failed: ${e.message}`, url } }, { status: 500 })
  }
}

// POST, PATCH, DELETE are intentionally not exported — returns 405 by default
