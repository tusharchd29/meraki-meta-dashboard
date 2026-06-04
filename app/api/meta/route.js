const HARDCODED_TOKEN = 'EAAZBpEehq4PMBRmHs3Sxb1nUs3hlDaT9gnV98n5Vhi3iZBGRRvC5DR2CSNESBFthGqtjhUCwqL2fRHh1ZBZAinoGEP3CLz2OBFaFTpZAZB2SBkC8lAWr0pOYypkVx1HuF0LjOsXn8awJtsyY5f4vKRp5ffoz94ipHoieTSTkevVUGqPJBoivGaPEi9ES49oOwjuvLaLnSxwZCnR82MNFoeHGoqkZBhU2L7DENaeYjgZDZD'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const token = searchParams.get('token') || process.env.META_ACCESS_TOKEN || HARDCODED_TOKEN
  if (!endpoint) return Response.json({ error: { message: 'No endpoint' } }, { status: 400 })
  const params = new URLSearchParams(searchParams)
  params.delete('endpoint'); params.delete('token')
  params.set('access_token', token)
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${endpoint}?${params}`, { next: { revalidate: 0 } })
    return Response.json(await res.json())
  } catch (e) {
    return Response.json({ error: { message: e.message } }, { status: 500 })
  }
}
