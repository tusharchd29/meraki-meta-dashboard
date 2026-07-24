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

// Token lookups hit Supabase twice (account -> connection). A single
// dashboard load fires ~8 calls per account across ~16 accounts, so without
// caching that's ~256 extra DB round-trips and a load time measured in
// minutes. Serverless instances are reused between requests, so a short-TTL
// in-memory cache collapses almost all of that. 60s is well under the 60-day
// token lifetime, and a disconnect takes effect within a minute.
const TOKEN_CACHE_TTL_MS = 60_000
const tokenCache = new Map() // accountId -> { token, cachedAt }

async function lookupTokenForAccount(accountId) {
  const cached = tokenCache.get(accountId)
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL_MS) {
    return cached.token
  }

  const db = supabaseAdmin()
  const { data: acct } = await db
    .from('meraki_ad_accounts')
    .select('connection_id')
    .eq('platform', 'meta')
    .eq('account_id', accountId)
    .eq('is_tracked', true)
    .maybeSingle()

  let token = null
  if (acct?.connection_id) {
    const { data: conn } = await db
      .from('meraki_ad_connections')
      .select('access_token')
      .eq('id', acct.connection_id)
      .eq('is_active', true)
      .maybeSingle()
    token = conn?.access_token || null
  }

  tokenCache.set(accountId, { token, cachedAt: Date.now() })
  return token
}

// Resolves which stored token to use for a given request.
// Priority: explicit ?token= override (debugging only) > the connection that
// owns the account (from the endpoint's act_<id> prefix, or an explicit
// ?account= param for campaign/adset-level endpoints that don't carry the
// account id). No hardcoded/env fallback — an account with no active,
// tracked connection simply has no token, which is by design.
async function resolveToken(searchParams, endpoint) {
  const explicitToken = searchParams.get('token')
  if (explicitToken) return { token: explicitToken, source: 'explicit' }

  const accountParam = searchParams.get('account') // e.g. act_123456789
  const accountMatch = endpoint.match(/^(act_\d+)/)
  const accountId = accountParam || (accountMatch ? accountMatch[1] : null)

  if (!accountId) return { token: null, source: 'none' }

  const token = await lookupTokenForAccount(accountId)
  return token ? { token, source: 'connection' } : { token: null, source: 'none' }
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
    if (key === 'endpoint' || key === 'token' || key === 'account' || key === 'access_token') continue
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
