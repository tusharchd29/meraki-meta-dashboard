export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const token = searchParams.get('token') || process.env.META_ACCESS_TOKEN

  if (!token) {
    return Response.json({ error: { message: 'No access token provided' } }, { status: 400 })
  }

  if (!endpoint) {
    return Response.json({ error: { message: 'No endpoint specified' } }, { status: 400 })
  }

  // Build the full Meta Graph API URL
  const params = new URLSearchParams(searchParams)
  params.delete('endpoint')
  params.delete('token')
  params.set('access_token', token)

  const metaUrl = `https://graph.facebook.com/v19.0/${endpoint}?${params.toString()}`

  try {
    const res = await fetch(metaUrl, { next: { revalidate: 0 } })
    const data = await res.json()
    return Response.json(data)
  } catch (e) {
    return Response.json({ error: { message: e.message } }, { status: 500 })
  }
}
