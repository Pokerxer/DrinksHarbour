import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pagesOptions } from '@/app/api/auth/[...nextauth]/pages-options';
import withAuth from 'next-auth/middleware';
import type { UserRole } from '@/types/authorization';
import { PLATFORM_ROLES, TENANT_ROLES } from '@/types/authorization';

interface NextAuthRequest extends NextRequest {
  nextauth?: {
    token: {
      role?: string;
      tenantId?: string;
    } | null;
  };
}

export default withAuth(
  function middleware(req: NextRequest) {
    const authReq = req as NextAuthRequest;
    const token = authReq.nextauth?.token;
    const path = req.nextUrl.pathname;
    const role = (token?.role as UserRole) ?? 'viewer';
    const tenantId = token?.tenantId as string | undefined;

    if (path.startsWith('/executive') || path.startsWith('/financial')) {
      if (!PLATFORM_ROLES.includes(role)) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    if (path.startsWith('/ecommerce') || path.startsWith('/logistics')) {
      if (TENANT_ROLES.includes(role) && !tenantId) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    if (path.startsWith('/roles-permissions') || path.startsWith('/users')) {
      if (!PLATFORM_ROLES.includes(role) && role !== 'tenant_admin' && role !== 'tenant_owner') {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }

    return NextResponse.next();
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

export const config = {
  matcher: [
    '/',
    '/executive/:path*',
    '/financial/:path*',
    '/analytics/:path*',
    '/logistics/:path*',
    '/ecommerce/:path*',
    '/support/:path*',
    '/file/:path*',
    '/file-manager',
    '/invoice/:path*',
    '/forms/profile-settings/:path*',
    '/roles-permissions/:path*',
    '/users/:path*',
  ],
};
