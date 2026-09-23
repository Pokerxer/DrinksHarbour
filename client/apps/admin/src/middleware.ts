import { NextResponse, type NextRequest } from 'next/server';
import { pagesOptions } from '@/app/api/auth/[...nextauth]/pages-options';
import withAuth from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import {
  TENANT_ROLES,
  type UserRole,
} from '@/types/authorization';
import { hasAdminSession } from '@/app/api/auth/[...nextauth]/session-guard';
import { roleCanAccessRoute } from '@/config/route-roles';

interface NextAuthRequest extends NextRequest {
  nextauth?: {
    token: {
      role?: string;
      accessToken?: string;
      tenantId?: string;
      tenantSlug?: string;
      /** Cached snapshot — see refreshTenantPlan in auth-options.ts. */
      plan?: string;
      subscriptionStatus?: string;
    } | null;
  };
}

/** Extract tenant slug from hostname or ?_tenant= query param (for local dev). */
function extractTenantSlug(req: NextRequest): string | null {
  // Local dev fallback: ?_tenant=acme
  const devSlug = req.nextUrl.searchParams.get('_tenant');
  if (devSlug && process.env.NODE_ENV === 'development') return devSlug.toLowerCase();

  const hostname = req.headers.get('host') || req.nextUrl.hostname;
  // Strip port for local dev
  const host = hostname.split(':')[0];

  // Known non-tenant hostnames
  const rootHosts = ['admin.drinksharbour.com', 'localhost', '127.0.0.1'];
  if (rootHosts.includes(host)) return null;

  // Match <slug>.drinksharbour.com
  const match = host.match(/^([a-z0-9-]+)\.drinksharbour\.com$/);
  if (match && match[1] !== 'admin' && match[1] !== 'www') {
    return match[1];
  }

  return null;
}

// Cookie names NextAuth uses (vary by HTTPS/HTTP)
const SESSION_COOKIES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

/**
 * If the browser holds a session cookie encrypted with a different secret
 * (common after NEXTAUTH_SECRET changes), getToken() returns null but the
 * cookie keeps resending, triggering JWT_SESSION_ERROR on every request.
 * Clear the bad cookie here and redirect to sign-in once, ending the loop.
 */
async function clearStaleCookieIfNeeded(
  req: NextRequest
): Promise<NextResponse | null> {
  const hasCookie = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasCookie) return null;

  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) return null; // valid — let withAuth handle it normally
  } catch {
    // decryption failed — fall through to clear
  }

  // Cookie exists but can't be decrypted — wipe it and redirect to sign-in
  const signInUrl = new URL(pagesOptions.signIn ?? '/signin', req.url);
  signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.redirect(signInUrl);
  SESSION_COOKIES.forEach((name) => res.cookies.delete(name));
  return res;
}

const authMiddleware = withAuth(
  async function middleware(req: NextRequest) {
    const authReq = req as NextAuthRequest;
    const token = authReq.nextauth?.token;
    const path = req.nextUrl.pathname;
    // No fallback role: `authorized` below has already refused anything without
    // a recognised one, and inventing 'viewer' here meant an unknown role
    // quietly passed every check written in terms of PLATFORM/TENANT roles.
    const role = (token?.role ?? null) as UserRole | null;
    const tenantId = token?.tenantId as string | undefined;

    if (role && TENANT_ROLES.includes(role) && !tenantId) {
      return NextResponse.redirect(new URL('/access-denied', req.url));
    }

    // ── Subdomain detection ──────────────────────────────────────────────────
    const tenantSlug = extractTenantSlug(req);

    // Build response with x-tenant-slug header so server components can read it
    const requestHeaders = new Headers(req.headers);
    if (tenantSlug) {
      requestHeaders.set('x-tenant-slug', tenantSlug);
    } else {
      requestHeaders.delete('x-tenant-slug');
    }

    // If a tenant-role user visits a subdomain that isn't theirs, redirect them
    // (We compare by slug; the token stores tenantId so we rely on the slug
    //  being set in the token as well, or fall back to blocking unknown subdomains.)
    if (tenantSlug && role && TENANT_ROLES.includes(role)) {
      const tokenSlug = (token as any)?.tenantSlug as string | undefined;
      // If we have a slug in the token and it doesn't match, send to access-denied
      if (!tokenSlug || tokenSlug !== tenantSlug) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // ── Role-based access control ────────────────────────────────────────────
    let customPermissions: string[] = [];
    if (role === 'tenant_staff' && (path === '/inventory' || path.startsWith('/inventory/') || path === '/settings/api-keys')) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/users/me/permissions`, {
          headers: { Authorization: `Bearer ${token?.accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(3000),
        });
        if (response.ok) customPermissions = (await response.json() as { data: { customPermissions: string[] } }).data.customPermissions;
      } catch { /* Fail closed when fresh grants cannot be loaded. */ }
    }
    if (!roleCanAccessRoute(path, role, customPermissions)) {
      return NextResponse.redirect(new URL('/access-denied', req.url));
    }

    // Live subscription access is checked in app/template.tsx on navigation.
    // A cached JWT plan must never prevent a newly upgraded tenant reaching it.

    // The pathname a server component is rendering for. Server components get
    // no access to the URL, and app/template.tsx needs it to run the
    // authoritative plan check against the live tenant. Same mechanism as
    // x-tenant-slug above.
    requestHeaders.set('x-pathname', path);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  },
  {
    pages: {
      ...pagesOptions,
    },
    callbacks: {
      // A token alone is not authorization: it must carry a whitelisted admin
      // role and a backend access token.
      authorized: ({ token }) => hasAdminSession(token),
    },
  }
);

export default async function middleware(req: NextRequest) {
  const staleResponse = await clearStaleCookieIfNeeded(req);
  if (staleResponse) return staleResponse;
  return (authMiddleware as any)(req);
}

/**
 * Every gated route must be listed here explicitly.
 *
 * This is an allow-list matcher, so a module that is merely *absent* gets no
 * middleware at all — not even the `authorized` session check. That fails OPEN
 * in a way that is easy to miss: the page still renders for a signed-out or
 * expired visitor, nothing redirects to /signin, and the client loaders simply
 * never receive a token. Most of them bail on `if (!token) return` while their
 * skeleton state is still `true`, so the route reads to the user as a dead
 * link that spins forever rather than as "please sign in".
 *
 * `/warehouses`, `/purchases`, `/sales`, `/settings`, `/contacts`, `/blog`,
 * `/store-analytics` and `/profile` were all missing for exactly that reason.
 * When adding a new top-level module, add it here too.
 *
 * PUBLIC KIOSKS ARE ABSENT ON PURPOSE: `/kiosk/:token` (attendance) and
 * `/kiosk/price-checker/:kioskSlug` (customer price checker).
 * The customer kiosk uses a separate HttpOnly session scoped to its proxy;
 * management under /retail-tools still requires an administrator session.
 *
 * It is the attendance clock on a screen in a shop, which by definition nobody
 * signs in to — the whole point of the work that added it. It is not
 * unprotected: the token in its URL is a long random per-device credential that
 * the API resolves to a tenant and that an admin can revoke from /settings, and
 * every call the page makes carries it (see server/middleware/kiosk.middleware.js).
 * The page renders nothing about the shop until that token comes back valid.
 *
 * Adding it to this list would send the counter tablet to /signin, which is the
 * one thing it must never do. Do NOT "fix" the omission — and do NOT reach for
 * the other shortcut either: un-gating `/employees` instead would make the
 * staff list and every HR profile public, which is what `isUnder()`'s comment
 * above is warning about.
 */
export const config = {
  matcher: [
    '/retail-tools/:path*',
    '/',
    '/executive/:path*',
    '/financial/:path*',
    '/analytics/:path*',
    '/logistics/:path*',
    '/ecommerce/:path*',
    '/products/:path*',
    '/sub-products/:path*',
    '/categories/:path*',
    '/sub-categories/:path*',
    '/brands/:path*',
    '/tenants/:path*',
    '/banners/:path*',
    '/warehouses/:path*',
    '/purchases/:path*',
    '/sales/:path*',
    '/contacts/:path*',
    '/blog/:path*',
    '/settings/:path*',
    '/bookings/:path*',
    '/store-analytics/:path*',
    '/profile/:path*',
    '/support/:path*',
    '/file/:path*',
    '/file-manager',
    '/invoice/:path*',
    '/forms/:path*',
    '/roles-permissions/:path*',
    '/users/:path*',
    '/employees/:path*',
    '/appraisals/:path*',
    '/point-of-sale/:path*',
    '/pos/:path*',
    '/inventory/:path*',
    // Added 2026-09-06. /accounting was the ONE (hydrogen) route group missing
    // from this list, so it got no middleware at all: its UI shell rendered for
    // signed-out visitors and merely failed its data loads, even though
    // accounting.routes.js gates the API behind Pro. /pos/pricelists was absent
    // for the same reason while its three siblings above were listed.
    '/accounting/:path*',
    // Ordinary POS screens, not kiosks: they render a shop's live orders and
    // price lists to whoever loads the URL. public `/kiosk/*` screens legitimately have no admin session, and it is not one of these.
    // The plan gate redirects here, so it must carry a session check of its own
    // — otherwise the one page a gated tenant is sent to is the one page that
    // does not know who they are.
    '/upgrade-required',
  ],
};
