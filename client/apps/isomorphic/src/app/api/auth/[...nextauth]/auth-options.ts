import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@/env.mjs';
import { pagesOptions } from './pages-options';
import type { UserRole } from '@/types/authorization';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      _id: string;
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      tenant?: string | { _id: string; slug?: string };
      tenantId?: string;
      avatar?: { url: string };
    };
    token: string;
    refreshToken?: string;
  };
  message?: string;
}

interface TenantSlugResponse {
  success: boolean;
  data?: { tenant?: { slug?: string } };
}

interface RefreshTokenResponse {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
    expiresIn: string;
  };
  message?: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString();
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const decoded = decodeJwtPayload(token);
  if (!decoded || typeof decoded.exp !== 'number') return false;
  return decoded.exp * 1000 < Date.now();
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await fetch(`${API_URL}/api/users/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token');
      return null;
    }

    const data = await response.json() as RefreshTokenResponse;
    if (data.success && data.data) {
      return {
        token: data.data.token,
        refreshToken: data.data.refreshToken,
      };
    }

    return null;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  pages: {
    ...pagesOptions,
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, token }) {
      if (token.refreshToken && token.accessToken) {
        try {
          if (isTokenExpired(token.accessToken as string)) {
            const refreshedTokens = await refreshAccessToken(token.refreshToken as string);
            if (refreshedTokens) {
              token.accessToken = refreshedTokens.token;
              token.refreshToken = refreshedTokens.refreshToken;
            } else {
              return { ...session, error: 'RefreshAccessTokenError' };
            }
          }
        } catch (error) {
          console.error('Error refreshing token in session callback:', error);
          return { ...session, error: 'RefreshAccessTokenError' };
        }
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          tenantId: token.tenantId as string | null,
          tenantSlug: token.tenantSlug as string | null,
          token: token.accessToken as string,
        },
        error: token.error,
      };
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantSlug = (user as { tenantSlug?: string | null }).tenantSlug ?? null;
        token.accessToken = user.token;
        token.refreshToken = (user as { refreshToken?: string }).refreshToken;
      }

      if (trigger === 'update' && token.accessToken) {
        const decoded = decodeJwtPayload(token.accessToken as string);
        if (decoded && typeof decoded.exp === 'number' && decoded.exp * 1000 < Date.now()) {
          if (token.refreshToken) {
            const refreshedTokens = await refreshAccessToken(token.refreshToken as string);
            if (refreshedTokens) {
              token.accessToken = refreshedTokens.token;
              token.refreshToken = refreshedTokens.refreshToken;
            }
          }
        }
      }

      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please provide both email and password');
        }

        try {
          const response = await fetch(`${API_URL}/api/users/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          // Check if response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response from login API:', text);
            
            // If it's HTML, try to extract useful info
            if (text.startsWith('<')) {
              throw new Error('Login service unavailable. Please check if the backend server is running.');
            }
            
            throw new Error(`Server returned invalid response: ${text.substring(0, 100)}...`);
          }

          const data = await response.json() as LoginResponse;

          if (!response.ok || !data.success) {
            const errorMessage = data.message || 'Invalid email or password';
            throw new Error(errorMessage);
          }

          const userRole = data.data.user.role;
          const validRoles: UserRole[] = ['admin', 'super_admin', 'tenant_admin', 'tenant_owner', 'tenant_staff', 'customer'];
          if (!validRoles.includes(userRole)) {
            throw new Error(`Access denied. Role '${userRole}' is not authorized to access this system.`);
          }

          const tenantValue = data.data.user.tenant;
          const tenantId = typeof tenantValue === 'object' && tenantValue !== null
            ? tenantValue._id
            : tenantValue || data.data.user.tenantId || null;

          // Resolve tenant slug from populated tenant object or via API
          let tenantSlug: string | null = null;
          if (typeof tenantValue === 'object' && tenantValue !== null && tenantValue.slug) {
            tenantSlug = tenantValue.slug;
          } else if (tenantId) {
            try {
              const tenantRes = await fetch(`${API_URL}/api/tenants/${tenantId}`, {
                headers: { Authorization: `Bearer ${data.data.token}` },
              });
              if (tenantRes.ok) {
                const tenantJson = await tenantRes.json() as TenantSlugResponse;
                tenantSlug = tenantJson?.data?.tenant?.slug ?? null;
              }
            } catch { /* non-blocking — slug stays null */ }
          }

          return {
            id: data.data.user._id || data.data.user.id,
            email: data.data.user.email,
            name: `${data.data.user.firstName} ${data.data.user.lastName}`,
            firstName: data.data.user.firstName,
            lastName: data.data.user.lastName,
            role: userRole,
            tenantId,
            tenantSlug,
            image: data.data.user.avatar?.url || null,
            token: data.data.token,
            refreshToken: data.data.refreshToken,
          };
        } catch (error: unknown) {
          console.error('Auth error:', error);
          
          // Handle network errors specifically
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error('Network error: Unable to connect to authentication server. Please check your internet connection and ensure the backend server is running.');
          }
          
          const message = error instanceof Error ? error.message : 'Authentication failed';
          throw new Error(message);
        }
      },
    }),
    CredentialsProvider({
      id: 'pos-pin',
      name: 'POS PIN',
      credentials: {
        tenantSlug: { label: 'Tenant Slug', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.tenantSlug || !credentials?.pin) {
          throw new Error('Tenant and PIN are required');
        }
        try {
          const response = await fetch(`${API_URL}/api/pos/auth/pin-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantSlug: credentials.tenantSlug, pin: credentials.pin }),
          });
          const data = await response.json() as LoginResponse;
          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Invalid PIN');
          }
          const user = data.data.user;
          const tenantValue = user.tenant;
          const tenantId = typeof tenantValue === 'object' && tenantValue !== null
            ? tenantValue._id : tenantValue || null;
          const tenantSlug = typeof tenantValue === 'object' && tenantValue !== null
            ? (tenantValue as any).slug ?? null : null;
          return {
            id: String(user._id || user.id),
            email: user.email,
            name: (user as any).posName || `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId,
            tenantSlug,
            image: null,
            token: data.data.token,
            refreshToken: data.data.refreshToken,
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'PIN authentication failed';
          throw new Error(message);
        }
      },
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
};
