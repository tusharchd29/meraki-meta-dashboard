import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Lists connections and every account each one can see (never returns raw
// tokens to the browser), lets the dashboard disconnect a login, and lets it
// toggle which accounts are actually tracked (shown in the dashboard). Reads
// and writes here always go through the service role key server-side.

export async function GET() {
  const db = supabaseAdmin()

  const { data: connections, error } = await db
    .from('meraki_ad_connections')
    .select(
      'id, platform, provider_user_name, connected_by, connected_at, token_expires_at, is_active'
    )
    .order('connected_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: accounts, error: acctErr } = await db
    .from('meraki_ad_accounts')
    .select('connection_id, platform, account_id, account_name, display_name, currency, synced_at, is_tracked, monthly_budget')

  if (acctErr) return Response.json({ error: acctErr.message }, { status: 500 })

  const withAccounts = connections.map((c) => ({
    ...c,
    accounts: accounts.filter((a) => a.connection_id === c.id),
  }))

  return Response.json({ connections: withAccounts })
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'missing id' }, { status: 400 })

  const db = supabaseAdmin()
  const { error } = await db
    .from('meraki_ad_connections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// Toggles whether a specific account (identified by platform + its stored
// account_id, e.g. 'act_123456789') shows up in the dashboard, and/or sets
// its client-approved monthly budget used for pacing. Either field can be
// sent alone — pass only what changed.
export async function PATCH(request) {
  const { platform, accountId, tracked, monthlyBudget } = await request.json()
  if (!platform || !accountId) {
    return Response.json({ error: 'missing platform/accountId' }, { status: 400 })
  }
  if (typeof tracked !== 'boolean' && monthlyBudget === undefined) {
    return Response.json({ error: 'nothing to update — pass tracked and/or monthlyBudget' }, { status: 400 })
  }

  const update = { synced_at: new Date().toISOString() }
  if (typeof tracked === 'boolean') update.is_tracked = tracked
  if (monthlyBudget !== undefined) update.monthly_budget = monthlyBudget === null ? null : Number(monthlyBudget)

  const db = supabaseAdmin()
  const { error } = await db
    .from('meraki_ad_accounts')
    .update(update)
    .eq('platform', platform)
    .eq('account_id', accountId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
