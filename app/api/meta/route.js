const DEFAULT_TOKEN = 'EAAZBpEehq4PMBRmHs3Sxb1nUs3hlDaT9gnV98n5Vhi3iZBGRRvC5DR2CSNESBFthGqtjhUCwqL2fRHh1ZBZAinoGEP3CLz2OBFaFTpZAZB2SBkC8lAWr0pOYypkVx1HuF0LjOsXn8awJtsyY5f4vKRp5ffoz94ipHoieTSTkevVUGqPJBoivGaPEi9ES49oOwjuvLaLnSxwZCnR82MNFoeHGoqkZBhU2L7DENaeYjgZDZD'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const token = searchParams.get('token') || process.env.META_ACCESS_TOKEN || DEFAULT_TOKEN

  if (!endpoint) {
    return Response.json({ error: { message: 'No endpoint specified' } }, { status: 400 })
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
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 }
    })
    const data = await res.json()
    return Response.json(data)
  } catch (e) {
    return Response.json({ error: { message: `Fetch failed: ${e.message}`, url } }, { status: 500 })
  }
}

// Debug route — test a single account
export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const token = body.token || process.env.META_ACCESS_TOKEN || DEFAULT_TOKEN
  const accountId = body.accountId || '833603637085666'

  const tests = [
    `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=spend,impressions&date_preset=last_7_days&access_token=${token}`,
    `https://graph.facebook.com/v19.0/act_${accountId}?fields=name,account_status,currency&access_token=${token}`,
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`,
  ]

  const results = {}
  for (const url of tests) {
    try {
      const r = await fetch(url)
      results[url.split('?')[0].split('/').pop()] = await r.json()
    } catch (e) {
      results['error'] = e.message
    }
  }
  return Response.json(results)
}
