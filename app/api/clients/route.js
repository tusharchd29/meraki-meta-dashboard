import { getActiveClients } from '@/lib/getActiveClients'

// Returns the list of Meta ad accounts the dashboard should show — either
// backfilled legacy accounts or accounts synced from an active OAuth
// connection. Shape matches the old hardcoded CLIENTS array so Dashboard.js
// doesn't need to change how it consumes each entry.
export async function GET() {
  try {
    const clients = await getActiveClients()
    return Response.json({ clients })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
