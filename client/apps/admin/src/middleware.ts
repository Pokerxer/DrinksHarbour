import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pagesOptions } from '@/app/api/auth/[...nextauth]/pages-options';
import withAuth from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@/types/authorization';
import { PLATFORM_ROLES, TENANT_ROLES } from '@/types/authorization';

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
    const role = (token?.role as UserRole) ?? 'viewer';
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
    if (tenantSlug && TENANT_ROLES.includes(role)) {
      const tokenSlug = (token as any)?.tenantSlug as string | undefined;
      // If we have a slug in the token and it doesn't match, send to access-denied
      if (tokenSlug && tokenSlug !== tenantSlug) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // ── Role-based access control ────────────────────────────────────────────

    // Platform-only sections — tenant roles cannot access these at all
    if (path.startsWith('/executive') || path.startsWith('/financial')) {
      if (!PLATFORM_ROLES.includes(role)) {
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
      TENANT_ROLES.includes(role) &&
      PLATFORM_ONLY_PATHS.some((p) => path.startsWith(p))
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
      ECOMMERCE_PREFIXES.some((p) => path.startsWith(p)) ||
      path.startsWith('/logistics')
    ) {
      if (TENANT_ROLES.includes(role) && !tenantId) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    // User/role management — platform admins + tenant owners/admins only
    if (path.startsWith('/roles-permissions') || path.startsWith('/users')) {
      if (
        !PLATFORM_ROLES.includes(role) &&
        role !== 'tenant_admin' &&
        role !== 'tenant_owner'
      ) {
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
      authorized: ({ token }) => {
        return !!token;
      },
    },
  }
);

export default async function middleware(req: NextRequest) {
  const staleResponse = await clearStaleCookieIfNeeded(req);
  if (staleResponse) return staleResponse;
  return (authMiddleware as any)(req);
}

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
    '/support/:path*',
    '/file/:path*',
    '/file-manager',
    '/invoice/:path*',
    '/forms/profile-settings/:path*',
    '/roles-permissions/:path*',
    '/users/:path*',
    '/point-of-sale/:path*',
    '/inventory/:path*',
    '/pos/sell',
    '/pos/orders',
    '/pos/sessions',
  ],
};
