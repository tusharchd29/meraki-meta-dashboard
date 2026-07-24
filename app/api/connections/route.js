import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Lists connections (never returns raw tokens to the browser) and lets the
// dashboard disconnect a login. Read/write here always goes through the
// service role key server-side — the browser never sees an access token.

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
    .select('connection_id, platform, account_id, account_name, currency, synced_at')

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
