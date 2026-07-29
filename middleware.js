import { NextResponse } from 'next/server'
import { computeSessionToken, SESSION_COOKIE } from '@/lib/dashboardAuth'

// Must stay reachable without a session cookie:
//  - /api/auth/session         — this is how the cookie gets issued in the first place
//  - /api/auth/*/callback      — Facebook/Google redirect the browser here after OAuth
//                                consent; blocking it would break connecting new accounts
//  - /api/auth/*/login         — kicks off the OAuth redirect; no sensitive data returned
// Note: this middleware only covers app-router routes under app/api/**. The
// separate top-level api/cron-*.js files are plain Vercel Functions (not part
// of Next's routing) and are already protected independently via CRON_SECRET.
const PUBLIC_PATHS = new Set([
  '/api/auth/session',
  '/api/auth/meta/callback',
  '/api/auth/meta/login',
  '/api/auth/google-ads/callback',
  '/api/auth/google-ads/login',
])

export async function middleware(request) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const expectedPassword = process.env.DASHBOARD_PASSWORD
  if (!expectedPassword) {
    // Server isn't configured for the new auth yet — fail closed rather than
    // silently letting every route through unauthenticated.
    return NextResponse.json({ error: 'DASHBOARD_PASSWORD not configured on the server' }, { status: 500 })
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  if (!cookie) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const expected = await computeSessionToken(expectedPassword)
  if (cookie !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  // Exclude the top-level api/cron-*.js functions — they're plain Vercel
  // Functions (not Next app-router routes) that already enforce their own
  // CRON_SECRET check. The comment above assumed the '/api/:path*' matcher
  // wouldn't reach them since they're outside app/api/**, but Next.js
  // middleware matches on URL path alone, regardless of which routing
  // system serves the request underneath — so it WAS intercepting every
  // cron invocation (including Vercel's own scheduled trigger, not just
  // manual ones) and returning 401 before CRON_SECRET was ever checked.
  matcher: ['/api/((?!cron-).*)'],
}
