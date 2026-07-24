import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// A "client" is the billing entity. It can own a Meta ad account, a Google
// Ads customer, or both — which is what makes blended reporting possible.
// meraki_clients already existed for the Client Health Board, so this maps
// onto it rather than introducing a second, competing client list.

export async function GET() {
  try {
    const db = supabaseAdmin()

    const { data: clients, error } = await db
      .from('meraki_clients')
      .select('id, name, status, meta_ad_account_id, google_ads_customer_id, monthly_budget, monthly_budget_month')
      .order('name')
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Every tracked account, so the UI can offer them in the mapping dropdowns
    const { data: accounts, error: acctErr } = await db
      .from('meraki_ad_accounts')
      .select('platform, account_id, account_name, currency, business_name, is_tracked, monthly_budget')
      .eq('is_tracked', true)
    if (acctErr) return Response.json({ error: acctErr.message }, { status: 500 })

    const metaAccounts = (accounts || []).filter(a => a.platform === 'meta')
    const googleAccounts = (accounts || []).filter(a => a.platform === 'google_ads')

    const byMeta = new Map(metaAccounts.map(a => [a.account_id, a]))
    const byGoogle = new Map(googleAccounts.map(a => [a.account_id, a]))

    const enriched = (clients || []).map(c => {
      const meta = c.meta_ad_account_id ? byMeta.get(c.meta_ad_account_id) : null
      const google = c.google_ads_customer_id ? byGoogle.get(c.google_ads_customer_id) : null
      return {
        ...c,
        meta_account: meta ? { account_id: meta.account_id, name: meta.account_name, currency: meta.currency } : null,
        google_account: google ? { account_id: google.account_id, name: google.account_name, currency: google.currency } : null,
        // Mapped to an account id that isn't currently tracked — surfaced so
        // it's obvious why a mapped client shows no data.
        meta_untracked: !!c.meta_ad_account_id && !meta,
        google_untracked: !!c.google_ads_customer_id && !google,
        platforms: [meta ? 'meta' : null, google ? 'google_ads' : null].filter(Boolean),
      }
    })

    // Tracked accounts not yet claimed by any client — these would be missing
    // from client-level reporting entirely, so the UI can prompt to map them.
    const claimedMeta = new Set((clients || []).map(c => c.meta_ad_account_id).filter(Boolean))
    const claimedGoogle = new Set((clients || []).map(c => c.google_ads_customer_id).filter(Boolean))

    return Response.json({
      clients: enriched,
      available: {
        meta: metaAccounts.map(a => ({ account_id: a.account_id, name: a.account_name, currency: a.currency, business_name: a.business_name, claimed: claimedMeta.has(a.account_id) })),
        google: googleAccounts.map(a => ({ account_id: a.account_id, name: a.account_name, currency: a.currency, claimed: claimedGoogle.has(a.account_id) })),
      },
      unmapped: {
        meta: metaAccounts.filter(a => !claimedMeta.has(a.account_id)).map(a => a.account_name || a.account_id),
        google: googleAccounts.filter(a => !claimedGoogle.has(a.account_id)).map(a => a.account_name || a.account_id),
      },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// Set or clear a client's platform mappings and monthly budget.
// Pass only the fields being changed; null clears a mapping.
export async function PATCH(request) {
  try {
    const { clientId, metaAccountId, googleCustomerId, monthlyBudget, budgetMonth } = await request.json()
    if (!clientId) return Response.json({ error: 'missing clientId' }, { status: 400 })

    const update = {}
    if (metaAccountId !== undefined) update.meta_ad_account_id = metaAccountId || null
    if (googleCustomerId !== undefined) update.google_ads_customer_id = googleCustomerId || null
    if (monthlyBudget !== undefined) update.monthly_budget = monthlyBudget === null ? null : Number(monthlyBudget)
    if (budgetMonth !== undefined) update.monthly_budget_month = budgetMonth || null

    if (Object.keys(update).length === 0) {
      return Response.json({ error: 'nothing to update' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const { error } = await db.from('meraki_clients').update(update).eq('id', clientId)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// Create a new client entity (for accounts that don't match an existing one)
export async function POST(request) {
  try {
    const { name, metaAccountId, googleCustomerId } = await request.json()
    if (!name?.trim()) return Response.json({ error: 'missing name' }, { status: 400 })

    const db = supabaseAdmin()
    const { data, error } = await db
      .from('meraki_clients')
      .insert({
        name: name.trim(),
        status: 'active',
        meta_ad_account_id: metaAccountId || null,
        google_ads_customer_id: googleCustomerId || null,
      })
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ ok: true, client: data })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
