// Computes the expected session token from the dashboard password + a
// server-only pepper. Never sends the password itself back to the browser —
// only this derived token, as an httpOnly cookie the browser can't read.
// Uses Web Crypto (globalThis.crypto.subtle) so the same code works in both
// the Edge-runtime middleware and Node-runtime route handlers.
export async function computeSessionToken(password) {
  const pepper = process.env.DASHBOARD_SESSION_SECRET || ''
  const data = new TextEncoder().encode(`${password}:${pepper}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export const SESSION_COOKIE = 'ma_session'
