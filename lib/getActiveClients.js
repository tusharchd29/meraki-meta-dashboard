import { supabaseAdmin } from '@/lib/supabaseAdmin'

function slugify(name, id) {
  const base = (name || id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return base || id
}

// Every Meta ad account the dashboard should show — legacy backfilled
// accounts (no OAuth connection yet, served by META_ACCESS_TOKEN) plus
// accounts synced from any still-active connection. Disconnected/inactive
// connections' accounts are excluded automatically.
export async function getActiveClients() {
  const db = supabaseAdmin()

  const { data: accounts, error } = await db
    .from('meraki_ad_accounts')
    .select('account_id, account_name, display_name, vertical, slug, currency, connection_id')
    .eq('platform', 'meta')

  if (error) throw new Error(`Supabase error: ${error.message}`)

  let activeConnectionIds = new Set()
  const connectionIds = [...new Set((accounts || []).map(a => a.connection_id).filter(Boolean))]
  if (connectionIds.length > 0) {
    const { data: connections, error: connErr } = await db
      .from('meraki_ad_connections')
      .select('id, is_active')
      .in('id', connectionIds)
    if (connErr) throw new Error(`Supabase error: ${connErr.message}`)
    activeConnectionIds = new Set((connections || []).filter(c => c.is_active).map(c => c.id))
  }

  return (accounts || [])
    .filter(a => !a.connection_id || activeConnectionIds.has(a.connection_id))
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
