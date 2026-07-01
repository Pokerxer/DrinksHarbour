import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Platform app middleware — tenant subdomain resolution for storefronts.
 *
 * Resolves the tenant slug from the hostname (e.g. "shopname.drinksharbour.com")
 * and injects it as an `x-tenant-slug` request header so Server Components
 * and API routes can read it via `headers()`.
 *
 * The backend's resolveTenantContext middleware then uses this header (for
 * super_admin/admin cross-tenant ops) or ignores it (for tenant users whose
 * JWT tenant is the authority).
 *
 * For the main marketplace (drinksharbour.com, www.drinksharbour.com), no
 * tenant header is set — the storefront shows all approved products.
 */

const RESERVED_SUBDOMAINS = [
  'www',
  'drinksharbour',
  'admin',
  'platform',
  'api',
  'localhost',
  '127',
];

function extractTenantSlug(req: NextRequest): string | null {
  const hostname = req.headers.get('host') || req.nextUrl.hostname;
  // Strip port for local dev
  const host = hostname.split(':')[0].toLowerCase();

  // Local dev fallback: ?_tenant=acme
  const devSlug = req.nextUrl.searchParams.get('_tenant');
  if (devSlug) return devSlug;

  // Known non-tenant hostnames — main marketplace
  if (RESERVED_SUBDOMAINS.some((r) => host === r || host.startsWith(`${r}.`))) {
    return null;
  }

  // Match <slug>.drinksharbour.com or <slug>.localhost
  const match = host.match(/^([a-z0-9-]+)\.(?:drinksharbour\.com|localhost)$/);
  if (match && !RESERVED_SUBDOMAINS.includes(match[1])) {
    return match[1];
  }

  return null;
}

export function middleware(req: NextRequest) {
  const tenantSlug = extractTenantSlug(req);

  // Inject x-tenant-slug header for downstream Server Components / API routes
  const requestHeaders = new Headers(req.headers);
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  } else {
    requestHeaders.delete('x-tenant-slug');
  }

  // Also set x-is-tenant-site flag so the backend knows this is a tenant storefront
  if (tenantSlug) {
    requestHeaders.set('x-is-tenant-site', 'true');
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)',
  ],
};