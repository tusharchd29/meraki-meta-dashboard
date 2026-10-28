import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { attachPortalCookies, getPortalSession, portalMemberships } from '@/lib/portalAuth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  try {
    const auth = await getPortalSession(request)
    if (!auth.user) return Response.json({ authenticated: false }, { status: 401 })
    const memberships = await portalMemberships(auth.user.id)
    if (!memberships.length) return Response.json({ authenticated: false, error: 'No active customer workspace is assigned to this login.' }, { status: 403 })

    const db = supabaseAdmin()
    const enriched = await Promise.all(memberships.map(async membership => {
      const { data: assignments, error } = await db.from('meraki_client_ad_account_access')
        .select('platform,account_id').eq('client_id', membership.client_id)
      if (error) throw error
      const { data: accounts, error: accountsError } = assignments?.length
        ? await db.from('meraki_ad_accounts').select('platform,account_id,account_name,currency').eq('is_tracked', true)
            .in('account_id', assignments.map(a => a.account_id))
        : { data: [], error: null }
      if (accountsError) throw accountsError
      const allowed = new Set((assignments || []).map(a => a.platform + ':' + a.account_id))
      return {
        id: membership.id,
        client_id: membership.client_id,
        client_name: membership.meraki_clients?.name || 'Customer workspace',
        role: membership.role,
        crm_access: membership.crm_access,
        accounts: (accounts || []).filter(a => allowed.has(a.platform + ':' + a.account_id)).map(a => ({
          platform: a.platform, account_id: a.account_id, name: a.account_name, currency: a.currency,
        })),
      }
    }))
    const response = Response.json({ authenticated: true, email: auth.user.email, workspaces: enriched })
    attachPortalCookies(response, auth.session)
    return response
  } catch (e) {
    return Response.json({ error: e.message || 'Unable to load customer portal.' }, { status: 500 })
  }
}
