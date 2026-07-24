import { getActiveClients } from '@/lib/getActiveClients'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const GRAPH = 'https://graph.facebook.com/v22.0'

// For each tracked ad account, finds the distinct Facebook Pages its ads
// promote. If an account shows more than one Page, per-account spend is
// really several clients combined — which matters for billing.

async function tokenFor(accountId, db) {
  const { data: acct } = await db
    .from('meraki_ad_accounts')
    .select('connection_id')
    .eq('platform', 'meta')
    .eq('account_id', accountId)
    .eq('is_tracked', true)
    .maybeSingle()
  if (!acct?.connection_id) return null
  const { data: conn } = await db
    .from('meraki_ad_connections')
    .select('access_token')
    .eq('id', acct.connection_id)
    .eq('is_active', true)
    .maybeSingle()
  return conn?.access_token || null
}

export async function GET() {
  try {
    const clients = await getActiveClients()
    const db = supabaseAdmin()
    const results = []
    const pageNameCache = new Map()

    for (const cl of clients) {
      const accountId = `act_${cl.accountId}`
      const token = await tokenFor(accountId, db)
      if (!token) { results.push({ client: cl.name, accountId, error: 'no token' }); continue }

      // Pull ads and read the Page each one promotes
      const url = `${GRAPH}/${accountId}/ads?fields=creative{object_story_spec{page_id}}&limit=200&access_token=${token}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.error) { results.push({ client: cl.name, accountId, error: json.error.message }); continue }

      const pageIds = new Set()
      for (const ad of json.data || []) {
        const pid = ad?.creative?.object_story_spec?.page_id
        if (pid) pageIds.add(pid)
      }

      // Resolve page names (cached across accounts)
      const pages = []
      for (const pid of pageIds) {
        if (!pageNameCache.has(pid)) {
          try {
            const pRes = await fetch(`${GRAPH}/${pid}?fields=name&access_token=${token}`)
            const pJson = await pRes.json()
            pageNameCache.set(pid, pJson?.name || pid)
          } catch { pageNameCache.set(pid, pid) }
        }
        pages.push({ page_id: pid, name: pageNameCache.get(pid) })
      }

      results.push({
        client: cl.name,
        accountId,
        ads_sampled: (json.data || []).length,
        distinct_pages: pages.length,
        pages,
        multi_client_account: pages.length > 1,
      })
    }

    const multi = results.filter(r => r.multi_client_account)
    return Response.json({
      summary: {
        accounts_checked: results.length,
        accounts_with_multiple_pages: multi.length,
        verdict: multi.length === 0
          ? 'Every account maps to a single Page — per-account spend equals per-client spend. Current billing model is correct.'
          : `${multi.length} account(s) advertise more than one Page — per-account spend combines multiple clients, so billing needs Page-level or campaign-level attribution.`,
      },
      accounts: results,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
