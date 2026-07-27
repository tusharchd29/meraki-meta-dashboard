// ============================================================================
// READ-ONLY META API PROXY
// ============================================================================
// This dashboard NEVER writes to Meta. That guarantee is enforced at four
// independent layers, so no single mistake can break it:
//
//   1. SCOPE      — tokens are issued without `ads_management`, so they are
//                   physically incapable of mutating ad data. See
//                   app/api/auth/meta/login/route.js. This holds even if
//                   every check below were removed.
//   2. METHOD     — only GET is exported. POST/PUT/PATCH/DELETE are declared
//                   explicitly and always return 405, so a mutating request
//                   can never reach Graph.
//   3. ENDPOINT   — a strict allowlist of read-only Graph paths. Anything not
//                   matching is rejected with 403.
//   4. UPSTREAM   — the fetch to Graph hardcodes method GET and strips any
//                   parameter that could carry a mutation payload.
//
// Do not add a write path here. If write capability is ever genuinely needed,
// it belongs in a separate, separately-scoped service — not this proxy.
// ============================================================================
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Layer 3: allowed read-only endpoint patterns. Anchored at both ends so a
// crafted path can't smuggle extra segments past the check.
const ALLOWED_PATTERNS = [
  /^act_\d+$/,
  /^act_\d+\/insights$/,
  /^act_\d+\/campaigns$/,
  /^act_\d+\/adsets$/,
  /^act_\d+\/ads$/,
  /^act_\d+\/activities$/,
  /^me$/,
  /^me\/adaccounts$/,
  /^me\/businesses$/,
  /^\d+$/,
  /^\d+\/insights$/,
  /^\d+\/adsets$/,
  /^\d+\/ads$/,
  /^\d+\/owned_ad_accounts$/,
  /^\d+\/client_ad_accounts$/,
]

function isAllowedEndpoint(endpoint) {
  return ALLOWED_PATTERNS.some(p => p.test(endpoint))
}

// Layer 4: parameters that must never be forwarded upstream. `method` and
// `batch` could coerce a mutation; `access_token` would let a caller override
// the resolved per-account token with one of their own.
const BLOCKED_PARAMS = new Set([
  'endpoint', 'account', 'access_token', 'token',
  'method', 'batch', 'body', 'include_headers', 'relative_url',
])

const TOKEN_CACHE_TTL_MS = 60_000
const tokenCache = new Map()

async function lookupTokenForAccount(accountId) {
  const cached = tokenCache.get(accountId)
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL_MS) return cached.token

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

// Tokens are resolved server-side from the connection that owns the account.
// There is deliberately no caller-supplied token override — that would let
// anyone who can reach this endpoint proxy arbitrary credentials through it.
async function resolveToken(searchParams, endpoint) {
  const accountParam = searchParams.get('account')
  const accountMatch = endpoint.match(/^(act_\d+)/)
  const accountId = accountParam || (accountMatch ? accountMatch[1] : null)
  if (!accountId) return null
  return await lookupTokenForAccount(accountId)
}

// Meta's rate-limit and "try again" errors come back as HTTP 200 with an
// error object in the JSON body (not a non-200 status), so a naive
// "retry on bad status code" check misses them entirely. Codes 4/17/32/613
// are Meta's documented throttling codes; is_transient covers ones not
// worth hardcoding. A plain network exception or 5xx is retried too.
const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 613])
function isTransientMetaError(data) {
  const code = data?.error?.code
  return data?.error?.is_transient === true || TRANSIENT_META_CODES.has(code)
}

async function fetchWithRetry(url, attempts = 3) {
  let lastData = null, lastStatus = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, next: { revalidate: 0 } })
      const data = await res.json()
      lastData = data; lastStatus = res.status
      const shouldRetry = res.status >= 500 || isTransientMetaError(data)
      if (!shouldRetry || i === attempts - 1) return { data, status: res.status }
    } catch (e) {
      lastData = { error: { message: `Fetch failed: ${e.message}` } }
      if (i === attempts - 1) return { data: lastData, status: 500 }
    }
    await new Promise(r => setTimeout(r, 500 * Math.pow(3, i))) // 500ms, 1.5s
  }
  return { data: lastData, status: lastStatus }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')

  if (!endpoint) {
    return Response.json({ error: { message: 'No endpoint specified' } }, { status: 400 })
  }

  if (!isAllowedEndpoint(endpoint)) {
    return Response.json(
      { error: { message: `Endpoint not permitted: ${endpoint}. This dashboard is strictly read-only.` } },
      { status: 403 }
    )
  }

  const token = await resolveToken(searchParams, endpoint)
  if (!token) {
    return Response.json(
      { error: { message: 'No access token available for this account. Connect and track it in the Connections panel.' } },
      { status: 403 }
    )
  }

  const metaParams = new URLSearchParams()
  metaParams.set('access_token', token)
  for (const [key, value] of searchParams.entries()) {
    if (BLOCKED_PARAMS.has(key)) continue
    metaParams.set(key, value)
  }

  const url = `https://graph.facebook.com/v22.0/${endpoint}?${metaParams.toString()}`

  try {
    const { data } = await fetchWithRetry(url)
    return Response.json(data)
  } catch (e) {
    return Response.json({ error: { message: `Fetch failed: ${e.message}` } }, { status: 500 })
  }
}

// Layer 2: mutating methods are explicitly declared and always refused, so
// this is a deliberate contract rather than an accident of what got exported.
const methodNotAllowed = () =>
  Response.json(
    { error: { message: 'This proxy is read-only. Write operations are not supported.' } },
    { status: 405 }
  )

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
