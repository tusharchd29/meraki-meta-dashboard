import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const PORTAL_ACCESS_COOKIE = 'ma_portal_access'
export const PORTAL_REFRESH_COOKIE = 'ma_portal_refresh'

function cookieValue(request, name) {
  return request.cookies?.get?.(name)?.value || ''
}

function cookieHeader(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

export function clearPortalCookies(response) {
  response.headers.append('Set-Cookie', cookieHeader(PORTAL_ACCESS_COOKIE, '', 0))
  response.headers.append('Set-Cookie', cookieHeader(PORTAL_REFRESH_COOKIE, '', 0))
  return response
}

export function attachPortalCookies(response, session) {
  if (!session?.access_token || !session?.refresh_token) return response
  response.headers.append('Set-Cookie', cookieHeader(PORTAL_ACCESS_COOKIE, session.access_token, Math.max(60, session.expires_in || 3600)))
  response.headers.append('Set-Cookie', cookieHeader(PORTAL_REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30))
  return response
}

async function refreshSession(refreshToken) {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey || !refreshToken) return null
  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function getPortalSession(request) {
  const accessToken = cookieValue(request, PORTAL_ACCESS_COOKIE)
  const refreshToken = cookieValue(request, PORTAL_REFRESH_COOKIE)
  const db = supabaseAdmin()
  if (accessToken) {
    const { data, error } = await db.auth.getUser(accessToken)
    if (!error && data?.user) return { user: data.user, session: null, accessToken }
  }
  const refreshed = await refreshSession(refreshToken)
  if (!refreshed?.access_token) return { user: null, session: null, accessToken: null }
  const { data, error } = await db.auth.getUser(refreshed.access_token)
  if (error || !data?.user) return { user: null, session: null, accessToken: null }
  return { user: data.user, session: refreshed, accessToken: refreshed.access_token }
}

export async function portalMemberships(userId) {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('meraki_client_portal_memberships')
    .select('id, client_id, auth_user_id, email, role, crm_access, status, meraki_clients(id, name, status)')
    .eq('auth_user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return data || []
}

export function portalLoginClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured for customer portal login')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
