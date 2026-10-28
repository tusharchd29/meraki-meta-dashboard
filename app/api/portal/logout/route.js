import { clearPortalCookies } from '@/lib/portalAuth'
export async function POST() {
  return clearPortalCookies(Response.json({ ok: true }))
}
