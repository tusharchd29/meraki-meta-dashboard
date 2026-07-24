import { supabaseAdmin } from '@/lib/supabaseAdmin'

function slugify(name, id) {
  const base = (name || id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return base || id
}

// The dashboard's client list is entirely opt-in now: an account only shows
// up here once (a) it belongs to a connection that's still active, AND
// (b) the user has explicitly checked it "tracked" in the Connections panel.
// There is no hardcoded fallback and no env-token path — connecting a login
// only makes accounts *available* to pick, it doesn't turn them on.
export async function getActiveClients() {
  const db = supabaseAdmin()

  const { data: accounts, error } = await db
    .from('meraki_ad_accounts')
    .select('account_id, account_name, display_name, vertical, slug, currency, connection_id, is_tracked')
    .eq('platform', 'meta')
    .eq('is_tracked', true)
    .not('connection_id', 'is', null)

  if (error) throw new Error(`Supabase error: ${error.message}`)
  if (!accounts || accounts.length === 0) return []

  const connectionIds = [...new Set(accounts.map(a => a.connection_id))]
  const { data: connections, error: connErr } = await db
    .from('meraki_ad_connections')
    .select('id, is_active')
    .in('id', connectionIds)
  if (connErr) throw new Error(`Supabase error: ${connErr.message}`)
  const activeConnectionIds = new Set((connections || []).filter(c => c.is_active).map(c => c.id))

  return accounts
    .filter(a => activeConnectionIds.has(a.connection_id))
    .map(a => ({
      key: a.slug || slugify(a.display_name || a.account_name, a.account_id),
      name: a.display_name || a.account_name || a.account_id,
      accountId: a.account_id.replace(/^act_/, ''),
      currency: a.currency || 'INR',
      vertical: a.vertical || null,
    }))
    .filter((c, i, arr) => arr.findIndex(x => x.accountId === c.accountId) === i)
    .sort((a, b) => a.name.localeCompare(b.name))
}
