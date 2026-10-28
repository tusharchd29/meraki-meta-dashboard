import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { attachPortalCookies } from '@/lib/portalAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { access_token, refresh_token } = await request.json()
    if (!access_token || !refresh_token) return Response.json({ error: 'Invalid sign-in link.' }, { status: 400 })
    const url = process.env.SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY
    if (!url || !anonKey) return Response.json({ error: 'Customer sign-in is not configured.' }, { status: 503 })
    const refreshedResponse = await fetch(url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ refresh_token }),
      cache: 'no-store',
    })
    if (!refreshedResponse.ok) return Response.json({ error: 'The sign-in link is invalid or expired. Request a new link.' }, { status: 401 })
    const session = await refreshedResponse.json()
    if (!session?.access_token || !session?.refresh_token || !session?.user?.id) return Response.json({ error: 'Unable to verify the sign-in link.' }, { status: 401 })
    const db = supabaseAdmin()
    const { data, error } = await db.auth.getUser(session.access_token)
    if (error || !data?.user || data.user.id !== session.user.id) return Response.json({ error: 'The sign-in link could not be verified.' }, { status: 401 })
    const { data: memberships, error: membershipError } = await db.from('meraki_client_portal_memberships').select('id,status').eq('auth_user_id', data.user.id)
    if (membershipError) return Response.json({ error: 'Unable to verify customer access.' }, { status: 500 })
    const permitted = (memberships || []).filter(m => m.status === 'active' || m.status === 'pending')
    if (!permitted.length) return Response.json({ error: 'This account has not been granted customer portal access.' }, { status: 403 })
    const pendingIds = permitted.filter(m => m.status === 'pending').map(m => m.id)
    if (pendingIds.length) {
      const { error: activateError } = await db.from('meraki_client_portal_memberships').update({ status: 'active', updated_at: new Date().toISOString() }).in('id', pendingIds)
      if (activateError) return Response.json({ error: 'Unable to activate customer access.' }, { status: 500 })
      await db.from('meraki_client_access_audit_logs').insert({ actor: data.user.email || 'customer', action: 'customer_invitation_accepted', target_email: data.user.email || null, details: { membership_count: pendingIds.length } })
    }
    const response = Response.json({ ok: true })
    attachPortalCookies(response, { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: Number(session.expires_in) || 3600 })
    return response
  } catch {
    return Response.json({ error: 'Unable to establish customer session.' }, { status: 500 })
  }
}
