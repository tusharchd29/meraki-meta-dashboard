import { getActiveGoogleAdsClients } from '@/lib/getActiveClients'

// Never cache: the dashboard must see tracking/budget changes immediately.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const clients = await getActiveGoogleAdsClients()
    return Response.json({ clients })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
