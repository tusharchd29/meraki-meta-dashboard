import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { attachPortalCookies } from '@/lib/portalAuth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { access_token, refresh_token, expires_in } = await request.json()
    if (!access_token || !refresh_token) return Response.json({ error: 'Invalid sign-in link.' }, { status: 400 })
    const db = supabaseAdmin()
    const { data, error } = await db.auth.getUser(access_token)
    if (error || !data?.user) return Response.json({ error: 'The sign-in link is invalid or expired.' }, { status: 401 })

    const { data: memberships, error: membershipError } = await db.from('meraki_client_portal_memberships')
      .select('id,status').eq('auth_user_id', data.user.id)
    if (membershipError) return Response.json({ error: membershipError.message }, { status: 500 })
    const permitted = (memberships || []).filter(m => m.status === 'active' || m.status === 'pending')
    if (!permitted.length) return Response.json({ error: 'This account has not been granted customer portal access.' }, { status: 403 })

    // A verified invitation/sign-in link activates pending memberships for this identity.
    const pendingIds = permitted.filter(m => m.status === 'pending').map(m => m.id)
    if (pendingIds.length) {
      const { error: activateError } = await db.from('meraki_client_portal_memberships')
        .update({ status: 'active', updated_at: new Date().toISOString() }).in('id', pendingIds)
      if (activateError) return Response.json({ error: activateError.message }, { status: 500 })
      await db.from('meraki_client_access_audit_logs').insert({
        actor: data.user.email || 'customer', action: 'customer_invitation_accepted',
        target_email: data.user.email || null, details: { membership_count: pendingIds.length },
      })
    }

    const response = Response.json({ ok: true })
    attachPortalCookies(response, { access_token, refresh_token, expires_in: Number(expires_in) || 3600 })
    return response
  } catch (e) {
    return Response.json({ error: e.message || 'Unable to establish customer session.' }, { status: 500 })
  }
}
