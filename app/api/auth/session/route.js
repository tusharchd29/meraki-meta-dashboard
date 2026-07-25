import { computeSessionToken, SESSION_COOKIE } from '@/lib/dashboardAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const expectedPassword = process.env.DASHBOARD_PASSWORD
  if (!expectedPassword) {
    return Response.json({ error: 'DASHBOARD_PASSWORD not configured on the server' }, { status: 500 })
  }

  let password
  try {
    ;({ password } = await request.json())
  } catch {
    return Response.json({ error: 'malformed request' }, { status: 400 })
  }

  if (password !== expectedPassword) {
    return Response.json({ error: 'incorrect password' }, { status: 401 })
  }

  const token = await computeSessionToken(password)
  const res = Response.json({ ok: true })
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  )
  return res
}
