// READ-ONLY Meta API proxy
// Only whitelisted read endpoints are permitted. No writes, no POST/PATCH/DELETE forwarded.

const DEFAULT_TOKEN = 'EAAZBpEehq4PMBRmHs3Sxb1nUs3hlDaT9gnV98n5Vhi3iZBGRRvC5DR2CSNESBFthGqtjhUCwqL2fRHh1ZBZAinoGEP3CLz2OBFaFTpZAZB2SBkC8lAWr0pOYypkVx1HuF0LjOsXn8awJtsyY5f4vKRp5ffoz94ipHoieTSTkevVUGqPJBoivGaPEi9ES49oOwjuvLaLnSxwZCnR82MNFoeHGoqkZBhU2L7DENaeYjgZDZD'

// Allowed read-only endpoint patterns (regex)
const ALLOWED_PATTERNS = [
  /^act_\d+\/insights$/,
  /^act_\d+\/campaigns$/,
  /^act_\d+\/adsets$/,
  /^act_\d+\/ads$/,
  /^act_\d+$/,
  /^me$/,
  /^\d+\/insights$/,
  /^\d+$/,
]

function isAllowedEndpoint(endpoint) {
  return ALLOWED_PATTERNS.some(p => p.test(endpoint))
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const token = searchParams.get('token') || process.env.META_ACCESS_TOKEN || DEFAULT_TOKEN

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

  // Build Meta API URL — pass all params except endpoint/token
  const metaParams = new URLSearchParams()
  metaParams.set('access_token', token)

  for (const [key, value] of searchParams.entries()) {
    if (key === 'endpoint' || key === 'token') continue
    metaParams.set(key, value)
  }

  const url = `https://graph.facebook.com/v19.0/${endpoint}?${metaParams.toString()}`

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
