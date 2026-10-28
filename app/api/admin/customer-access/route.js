import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  try {
    const db = supabaseAdmin()
    const [clientsRes, accountsRes, membersRes, accessRes, auditRes] = await Promise.all([
      db.from('meraki_clients').select('id,name,status,meta_ad_account_id,google_ads_customer_id').order('name'),
      db.from('meraki_ad_accounts').select('platform,account_id,account_name,currency,business_name,is_tracked').eq('is_tracked', true).order('account_name'),
      db.from('meraki_client_portal_memberships').select('id,client_id,auth_user_id,email,role,crm_access,status,created_at,updated_at').order('created_at', { ascending: false }),
      db.from('meraki_client_ad_account_access').select('id,client_id,platform,account_id,created_at'),
      db.from('meraki_client_access_audit_logs').select('id,client_id,actor,action,target_email,details,created_at').order('created_at', { ascending: false }).limit(50),
    ])
    const failure = [clientsRes, accountsRes, membersRes, accessRes, auditRes].find(r => r.error)
    if (failure) return Response.json({ error: failure.error.message }, { status: 500 })
    return Response.json({
      clients: clientsRes.data || [],
      accounts: accountsRes.data || [],
      memberships: membersRes.data || [],
      assignments: accessRes.data || [],
      auditLogs: auditRes.data || [],
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { clientId, email, role = 'viewer', crmAccess = false, accounts = [] } = body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!clientId) return Response.json({ error: 'Choose a customer workspace.' }, { status: 400 })
    if (!emailPattern.test(normalizedEmail)) return Response.json({ error: 'Enter a valid customer email address.' }, { status: 400 })
    if (!['client_admin', 'viewer'].includes(role)) return Response.json({ error: 'Invalid role.' }, { status: 400 })
    if (!Array.isArray(accounts)) return Response.json({ error: 'Account assignments must be a list.' }, { status: 400 })
    if (accounts.length > 100) return Response.json({ error: 'Too many account assignments.' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: client, error: clientError } = await db.from('meraki_clients').select('id,name').eq('id', clientId).maybeSingle()
    if (clientError) return Response.json({ error: clientError.message }, { status: 500 })
    if (!client) return Response.json({ error: 'Customer workspace not found.' }, { status: 404 })

    const cleanedAccounts = accounts.map(a => ({
      platform: String(a?.platform || ''),
      account_id: String(a?.account_id || ''),
    }))
    if (cleanedAccounts.some(a => !['meta', 'google_ads'].includes(a.platform) || !a.account_id || a.account_id.length > 100)) {
      return Response.json({ error: 'One or more account selections are invalid.' }, { status: 400 })
    }
    const uniqueKeys = new Set(cleanedAccounts.map(a => a.platform + ':' + a.account_id))
    if (uniqueKeys.size !== cleanedAccounts.length) return Response.json({ error: 'Duplicate account selections are not allowed.' }, { status: 400 })

    if (cleanedAccounts.length) {
      const { data: available, error: availableError } = await db.from('meraki_ad_accounts')
        .select('platform,account_id').eq('is_tracked', true)
      if (availableError) return Response.json({ error: availableError.message }, { status: 500 })
      const availableKeys = new Set((available || []).map(a => a.platform + ':' + a.account_id))
      if (cleanedAccounts.some(a => !availableKeys.has(a.platform + ':' + a.account_id))) {
        return Response.json({ error: 'An account is not currently tracked or is unavailable. Refresh and try again.' }, { status: 400 })
      }
    }

    const origin = new URL(request.url).origin
    let authUser = null
    const { data: existingMembership } = await db.from('meraki_client_portal_memberships')
      .select('id,auth_user_id,status').eq('client_id', clientId).eq('email', normalizedEmail).maybeSingle()

    if (existingMembership?.auth_user_id) {
      const { data: userData } = await db.auth.admin.getUserById(existingMembership.auth_user_id)
      authUser = userData?.user || null
    }

    if (!authUser) {
      const invited = await db.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: `${origin}/portal`,
        data: { portal_client_id: clientId, portal_client_name: client.name },
      })
      if (!invited.error) authUser = invited.data?.user || null
      if (invited.error) {
        // Existing Auth users can be added to another workspace without creating a second identity.
        const { data: usersData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
        authUser = (usersData?.users || []).find(u => (u.email || '').toLowerCase() === normalizedEmail) || null
        if (!authUser) return Response.json({ error: invited.error.message || 'Could not send the invitation. Check Supabase Auth email configuration.' }, { status: 400 })
      }
    }
    if (!authUser?.id) return Response.json({ error: 'Invitation did not return a valid user. No assignment was saved.' }, { status: 502 })

    const nextStatus = authUser.email_confirmed_at ? 'active' : 'pending'
    const { data: membership, error: membershipError } = await db.from('meraki_client_portal_memberships').upsert({
      client_id: clientId,
      auth_user_id: authUser.id,
      email: normalizedEmail,
      role,
      crm_access: Boolean(crmAccess),
      status: existingMembership?.status === 'suspended' ? 'suspended' : nextStatus,
      invited_by: 'master_admin',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,email' }).select().single()
    if (membershipError) return Response.json({ error: membershipError.message }, { status: 500 })

    const { error: deleteError } = await db.from('meraki_client_ad_account_access').delete().eq('client_id', clientId)
    if (deleteError) return Response.json({ error: deleteError.message, partial: true }, { status: 500 })

    if (cleanedAccounts.length) {
      const { error: insertError } = await db.from('meraki_client_ad_account_access').insert(cleanedAccounts.map(a => ({
        client_id: clientId, platform: a.platform, account_id: a.account_id, created_by: 'master_admin',
      })))
      if (insertError) return Response.json({ error: insertError.message, partial: true }, { status: 500 })
    }

    const { error: auditError } = await db.from('meraki_client_access_audit_logs').insert({
      client_id: clientId,
      actor: 'master_admin',
      action: existingMembership ? 'customer_access_updated' : 'customer_invited',
      target_email: normalizedEmail,
      details: { role, crm_access: Boolean(crmAccess), account_count: cleanedAccounts.length, account_assignments: cleanedAccounts },
    })
    if (auditError) return Response.json({ error: 'Access saved, but audit logging failed: ' + auditError.message, partial: true }, { status: 500 })

    return Response.json({
      ok: true,
      invited: !authUser.email_confirmed_at,
      membership: { ...membership, client_name: client.name },
      assignedAccountCount: cleanedAccounts.length,
    })
  } catch (e) {
    return Response.json({ error: e.message || 'Unable to save customer access.' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { membershipId, status, role, crmAccess } = await request.json()
    if (!membershipId) return Response.json({ error: 'Missing membership ID.' }, { status: 400 })
    const update = { updated_at: new Date().toISOString() }
    if (status !== undefined) {
      if (!['pending', 'active', 'suspended'].includes(status)) return Response.json({ error: 'Invalid membership status.' }, { status: 400 })
      update.status = status
    }
    if (role !== undefined) {
      if (!['client_admin', 'viewer'].includes(role)) return Response.json({ error: 'Invalid role.' }, { status: 400 })
      update.role = role
    }
    if (crmAccess !== undefined) update.crm_access = Boolean(crmAccess)
    if (Object.keys(update).length === 1) return Response.json({ error: 'No changes supplied.' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: before, error: beforeError } = await db.from('meraki_client_portal_memberships')
      .select('id,client_id,email,role,crm_access,status').eq('id', membershipId).maybeSingle()
    if (beforeError) return Response.json({ error: beforeError.message }, { status: 500 })
    if (!before) return Response.json({ error: 'Membership not found.' }, { status: 404 })
    const { error } = await db.from('meraki_client_portal_memberships').update(update).eq('id', membershipId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const { error: auditError } = await db.from('meraki_client_access_audit_logs').insert({
      client_id: before.client_id, actor: 'master_admin', action: 'membership_updated', target_email: before.email,
      details: { before: { role: before.role, crm_access: before.crm_access, status: before.status }, after: update },
    })
    if (auditError) return Response.json({ error: 'Membership updated, but audit logging failed: ' + auditError.message, partial: true }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message || 'Unable to update membership.' }, { status: 500 })
  }
}
