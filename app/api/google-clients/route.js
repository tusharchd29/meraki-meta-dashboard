import { getActiveGoogleAdsClients } from '@/lib/getActiveClients'

export async function GET() {
  try {
    const clients = await getActiveGoogleAdsClients()
    return Response.json({ clients })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
