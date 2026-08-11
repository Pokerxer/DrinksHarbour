import { NextResponse, type NextRequest } from 'next/server';
import { pagesOptions } from '@/app/api/auth/[...nextauth]/pages-options';
import withAuth from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import {
  PLATFORM_ROLES,
  TENANT_ROLES,
  canAdministerAppraisals,
  type UserRole,
} from '@/types/authorization';
import { hasAdminSession } from '@/app/api/auth/[...nextauth]/session-guard';

interface NextAuthRequest extends NextRequest {
  nextauth?: {
    token: {
      role?: string;
      tenantId?: string;
      tenantSlug?: string;
    } | null;
  };
}

/** Extract tenant slug from hostname or ?_tenant= query param (for local dev). */
function extractTenantSlug(req: NextRequest): string | null {
  // Local dev fallback: ?_tenant=acme
  const devSlug = req.nextUrl.searchParams.get('_tenant');
  if (devSlug) return devSlug;

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

/**
 * `path` is `prefix` or sits underneath it, matching on whole URL segments.
 *
 * A bare `path.startsWith('/users')` also matches `/users-guide` and
 * `/usersettings`, so every route whose name merely begins with a gated one
 * inherited that gate. Today those gates all redirect to /access-denied, so
 * the over-match fails closed and nothing is exposed — but it silently
 * reserves a whole namespace of URLs, and the same helper is what keeps a
 * future `/appraisals/templates-help` from being read as HR-only (or, if a
 * gate is ever inverted into an allow, from being read as public).
 */
function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
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
  signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
  const res = NextResponse.redirect(signInUrl);
  SESSION_COOKIES.forEach((name) => res.cookies.delete(name));
  return res;
}

const authMiddleware = withAuth(
  function middleware(req: NextRequest) {
    const authReq = req as NextAuthRequest;
    const token = authReq.nextauth?.token;
    const path = req.nextUrl.pathname;
    // No fallback role: `authorized` below has already refused anything without
    // a recognised one, and inventing 'viewer' here meant an unknown role
    // quietly passed every check written in terms of PLATFORM/TENANT roles.
    const role = (token?.role ?? null) as UserRole | null;
    const tenantId = token?.tenantId as string | undefined;

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
      if (tokenSlug && tokenSlug !== tenantSlug) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // ── Role-based access control ────────────────────────────────────────────

    // Platform-only sections — tenant roles cannot access these at all
    if (isUnder(path, '/executive') || isUnder(path, '/financial')) {
      if (!role || !PLATFORM_ROLES.includes(role)) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // Platform-only ecommerce pages — tenant management, brand management
    // Tenant roles should only manage their own data via the tenant sidebar
    const PLATFORM_ONLY_PATHS = [
      '/tenants',
      '/products', // main product catalog is platform-only; tenants use /sub-products
    ];
    if (
      role &&
      TENANT_ROLES.includes(role) &&
      PLATFORM_ONLY_PATHS.some((p) => isUnder(path, p))
    ) {
      return NextResponse.redirect(new URL('/access-denied', req.url));
    }

    // General ecommerce/logistics — require tenantId for tenant roles
    const ECOMMERCE_PREFIXES = [
      '/ecommerce',
      '/products',
      '/sub-products',
      '/categories',
      '/sub-categories',
      '/brands',
      '/tenants',
      '/banners',
    ];
    if (
      ECOMMERCE_PREFIXES.some((p) => isUnder(path, p)) ||
      isUnder(path, '/logistics')
    ) {
      if (role && TENANT_ROLES.includes(role) && !tenantId) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // User/role management — platform admins + tenant owners/admins only
    if (isUnder(path, '/roles-permissions') || isUnder(path, '/users')) {
      if (
        !role ||
        (!PLATFORM_ROLES.includes(role) &&
          role !== 'tenant_admin' &&
          role !== 'tenant_owner')
      ) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // Staff management — same audience as /roles-permissions; the tenant
    // sidebar already hides "Employees" from tenant_staff, so block the
    // direct URL too (defense in depth).
    if (isUnder(path, '/employees')) {
      if (
        !role ||
        (!PLATFORM_ROLES.includes(role) &&
          role !== 'tenant_admin' &&
          role !== 'tenant_owner')
      ) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // Appraisal cycle + template administration — HR audience only.
    //
    // Note the deliberate asymmetry with /employees above: bare /appraisals is
    // NOT gated, because tenant_staff must reach their own appraisal and their
    // assigned feedback forms. Only the HR sub-routes are restricted.
    //
    // The predicate is shared with the appraisals nav header (see
    // canAdministerAppraisals) rather than spelled out inline a second time:
    // when the chrome and the gate disagree, tenant_staff get offered tabs
    // that land them on /access-denied.
    if (
      isUnder(path, '/appraisals/cycles') ||
      isUnder(path, '/appraisals/templates')
    ) {
      if (!canAdministerAppraisals(role)) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

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
 * ONE ROUTE IS ABSENT ON PURPOSE: `/kiosk/:token`.
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
    '/store-analytics/:path*',
    '/profile/:path*',
    '/support/:path*',
    '/file/:path*',
    '/file-manager',
    '/invoice/:path*',
    '/forms/profile-settings/:path*',
    '/roles-permissions/:path*',
    '/users/:path*',
    '/employees/:path*',
    '/appraisals/:path*',
    '/point-of-sale/:path*',
    '/inventory/:path*',
    '/pos/sell',
    '/pos/orders',
    '/pos/sessions',
  ],
};
