export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const token = searchParams.get('token') || process.env.META_ACCESS_TOKEN
  if (!token) return Response.json({ error: { message: 'No access token' } }, { status: 400 })
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
