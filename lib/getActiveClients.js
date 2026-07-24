import { supabaseAdmin } from '@/lib/supabaseAdmin'

function slugify(name, id) {
  const base = (name || id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return base || id
}

// Generic: the tracked, connected account list for a given platform.
// An account only shows up once (a) its connection is active, AND
// (b) the user has explicitly checked it "tracked". No hardcoded fallback.
async function getActiveClientsForPlatform(platform) {
  const db = supabaseAdmin()

  const { data: accounts, error } = await db
    .from('meraki_ad_accounts')
    .select('account_id, account_name, display_name, vertical, slug, currency, connection_id, is_tracked, monthly_budget')
    .eq('platform', platform)
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
      accountId: platform === 'meta' ? a.account_id.replace(/^act_/, '') : a.account_id,
      currency: a.currency || 'INR',
      vertical: a.vertical || null,
      monthlyBudget: a.monthly_budget != null ? Number(a.monthly_budget) : null,
    }))
    .filter((c, i, arr) => arr.findIndex(x => x.accountId === c.accountId) === i)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getActiveClients() {
  return getActiveClientsForPlatform('meta')
}

export async function getActiveGoogleAdsClients() {
  return getActiveClientsForPlatform('google_ads')
}
