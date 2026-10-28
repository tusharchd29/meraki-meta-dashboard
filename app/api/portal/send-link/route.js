import { portalLoginClient } from '@/lib/portalAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { email } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    const client = portalLoginClient()
    const origin = new URL(request.url).origin
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: `${origin}/portal`, shouldCreateUser: false },
    })
    if (error) {
      // Return a generic message to avoid exposing whether an address is registered.
      return Response.json({ ok: true, message: 'If this email has portal access, a sign-in link will arrive shortly.' })
    }
    return Response.json({ ok: true, message: 'If this email has portal access, a sign-in link will arrive shortly.' })
  } catch (e) {
    return Response.json({ error: e.message || 'Unable to send a sign-in link.' }, { status: 500 })
  }
}
