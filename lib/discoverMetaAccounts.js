const GRAPH = 'https://graph.facebook.com/v22.0'

// Follows Graph API paging so a portfolio with more accounts than one page
// doesn't get silently truncated.
async function fetchAllPages(url, token, cap = 500) {
  const out = []
  let next = `${url}${url.includes('?') ? '&' : '?'}limit=100&access_token=${token}`
  while (next && out.length < cap) {
    const res = await fetch(next)
    const json = await res.json()
    if (json.error) {
      // Permission errors on a single portfolio shouldn't abort the whole sync
      return { data: out, error: json.error.message }
    }
    out.push(...(json.data || []))
    next = json.paging?.next || null
  }
  return { data: out }
}

// Every ad account this token can reach, from three sources:
//   1. /me/adaccounts        — accounts the person is directly assigned to
//   2. business owned_ad_accounts  — accounts the portfolio itself owns
//   3. business client_ad_accounts — clients' accounts the portfolio has
//                                    partner access to (the agency case)
// Deduped by account_id; the first source that yields an account wins, so a
// directly-assigned account keeps 'direct' as its access_type.
export async function discoverMetaAdAccounts(token) {
  const byId = new Map()
  const warnings = []

  const add = (a, accessType, business) => {
    const id = `act_${a.account_id || String(a.id).replace(/^act_/, '')}`
    if (byId.has(id)) return
    byId.set(id, {
      account_id: id,
      account_name: a.name || null,
      currency: a.currency || null,
      access_type: accessType,
      business_id: business?.id || null,
      business_name: business?.name || null,
    })
  }

  // 1. Directly assigned
  const direct = await fetchAllPages(`${GRAPH}/me/adaccounts?fields=account_id,name,currency`, token)
  if (direct.error) warnings.push(`me/adaccounts: ${direct.error}`)
  direct.data.forEach(a => add(a, 'direct', null))

  // 2 & 3. Everything reachable through each business portfolio
  const businesses = await fetchAllPages(`${GRAPH}/me/businesses?fields=id,name`, token)
  if (businesses.error) warnings.push(`me/businesses: ${businesses.error}`)

  for (const biz of businesses.data) {
    const owned = await fetchAllPages(`${GRAPH}/${biz.id}/owned_ad_accounts?fields=account_id,name,currency`, token)
    if (owned.error) warnings.push(`${biz.name} owned: ${owned.error}`)
    owned.data.forEach(a => add(a, 'owned', biz))

    const client = await fetchAllPages(`${GRAPH}/${biz.id}/client_ad_accounts?fields=account_id,name,currency`, token)
    if (client.error) warnings.push(`${biz.name} client: ${client.error}`)
    client.data.forEach(a => add(a, 'client', biz))
  }

  return {
    accounts: [...byId.values()],
    businessCount: businesses.data.length,
    warnings,
  }
}
