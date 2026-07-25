import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  encode as defaultJwtEncode,
  decode as defaultJwtDecode,
} from 'next-auth/jwt';
import { pagesOptions } from './pages-options';
import { MFA_REQUIRED_PREFIX } from './mfa-challenge';
import { ADMIN_ACCESS_ROLES, type UserRole } from '@/types/authorization';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// Per-login "remember me" session lengths. The session cookie is kept for the
// longer (remember) window, but the JWT inside is stamped with a shorter `exp`
// when the user did NOT tick "remember me" — so a non-remembered session is
// effectively signed out after DEFAULT_SESSION_MAX_AGE regardless of cookie.
const DEFAULT_SESSION_MAX_AGE = 24 * 60 * 60; // 1 day
const REMEMBER_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

interface AuthenticatedUser {
  _id: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenant?: string | { _id: string; slug?: string };
  tenantId?: string;
  avatar?: { url: string };
}

interface LoginResponse {
  success: boolean;
  data: {
    user: AuthenticatedUser;
    token: string;
    refreshToken?: string;
    // Present instead of `token` when the account has MFA enabled — the login
    // is only half-complete until the code is verified.
    mfaRequired?: boolean;
    pendingMfaToken?: string;
    // Proof of a recent MFA challenge, for `requireMfa` on privileged routes.
    mfaToken?: string;
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

function assertRoleMayAccessAdmin(role: UserRole): void {
  if (!ADMIN_ACCESS_ROLES.includes(role)) {
    throw new Error(
      `Access denied. Role '${role}' is not authorized to access this system.`
    );
  }
}

/**
 * Map a successful backend auth response onto the NextAuth `user` object.
 * Shared by the password and MFA providers — `/api/users/mfa/verify` returns
 * the same `{ user, token, refreshToken }` shape as `/api/users/login`.
 */
async function toSessionUser(
  user: AuthenticatedUser,
  token: string,
  refreshToken: string | undefined,
  remember: boolean
) {
  const tenantValue = user.tenant;
  const tenantId =
    typeof tenantValue === 'object' && tenantValue !== null
      ? tenantValue._id
      : tenantValue || user.tenantId || null;

  // Resolve tenant slug from populated tenant object or via API
  let tenantSlug: string | null = null;
  if (
    typeof tenantValue === 'object' &&
    tenantValue !== null &&
    tenantValue.slug
  ) {
    tenantSlug = tenantValue.slug;
  } else if (tenantId) {
    try {
      const tenantRes = await fetch(`${API_URL}/api/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tenantRes.ok) {
        const tenantJson = (await tenantRes.json()) as TenantSlugResponse;
        tenantSlug = tenantJson?.data?.tenant?.slug ?? null;
      }
    } catch {
      /* non-blocking — slug stays null */
    }
  }

  return {
    id: user._id || user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId,
    tenantSlug,
    image: user.avatar?.url || null,
    token,
    refreshToken,
    remember,
  };
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

/**
 * Refresh a little before the access token actually expires.
 *
 * Parallel requests can enter `jwt()` together and race to spend the same
 * refresh token, which the backend rotates and revokes on first use. Refreshing
 * early means the common case is one refresh while the old token is still
 * usable. It narrows the race rather than closing it; the residual cost of an
 * exact tie is a single spurious sign-out.
 */
const REFRESH_SKEW_SECONDS = 60;

function isTokenExpiring(token: string): boolean {
  const decoded = decodeJwtPayload(token);
  if (!decoded || typeof decoded.exp !== 'number') return false;
  return (decoded.exp - REFRESH_SKEW_SECONDS) * 1000 < Date.now();
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

    const data = (await response.json()) as RefreshTokenResponse;
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
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    ...pagesOptions,
  },
  session: {
    strategy: 'jwt',
    // Upper bound on the cookie lifetime; the effective session length is
    // governed per-login by the JWT `exp` set in `jwt.encode` below.
    maxAge: REMEMBER_SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60, // re-issue the JWT at most once per day of activity
  },
  // Custom encode honours the per-login `remember` flag carried on the token,
  // giving a longer JWT `exp` when the user opted into "remember me".
  jwt: {
    encode: async ({ token, secret, maxAge }) => {
      const remember = token?.remember === true;
      const effectiveMaxAge = remember
        ? REMEMBER_SESSION_MAX_AGE
        : DEFAULT_SESSION_MAX_AGE;
      return defaultJwtEncode({
        token,
        secret,
        maxAge: token ? effectiveMaxAge : maxAge,
      });
    },
    decode: defaultJwtDecode,
  },
  callbacks: {
    // Pure: whatever `jwt()` settled on is what the client sees. Refreshing
    // here would be silently discarded — NextAuth re-encodes the cookie from
    // the `jwt()` return value only.
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          tenantId: token.tenantId as string | null,
          tenantSlug: token.tenantSlug as string | null,
          token: token.accessToken as string,
          mfaToken: token.mfaToken as string | undefined,
        },
        error: token.error,
      };
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantSlug =
          (user as { tenantSlug?: string | null }).tenantSlug ?? null;
        token.accessToken = user.token;
        token.refreshToken = (user as { refreshToken?: string }).refreshToken;
        // Carry the per-login "remember me" choice so `jwt.encode` can pick the
        // right session lifetime. Defaults to a short session when absent.
        token.remember = (user as { remember?: boolean }).remember === true;
        token.mfaToken = (user as { mfaToken?: string }).mfaToken;
        return token;
      }

      // Step-up mints a fresh mfa-verified token mid-session. `update()` is the
      // only way to get it into the cookie: the JWT is re-encoded from the
      // return value of this callback and nowhere else.
      if (trigger === 'update') {
        const updated = (session as { mfaToken?: string } | undefined)
          ?.mfaToken;
        if (updated) token.mfaToken = updated;
      }

      // Refresh here, where the return value is re-encoded into the session
      // cookie, so the rotated refresh token survives to be used next time.
      if (
        token.accessToken &&
        token.refreshToken &&
        isTokenExpiring(token.accessToken as string)
      ) {
        try {
          const refreshedTokens = await refreshAccessToken(
            token.refreshToken as string
          );
          if (refreshedTokens) {
            token.accessToken = refreshedTokens.token;
            token.refreshToken = refreshedTokens.refreshToken;
            delete token.error;
          } else {
            token.error = 'RefreshAccessTokenError';
          }
        } catch (error) {
          console.error('Error refreshing token in jwt callback:', error);
          token.error = 'RefreshAccessTokenError';
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
        rememberMe: { label: 'Remember Me', type: 'text' },
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
              throw new Error(
                'Login service unavailable. Please check if the backend server is running.'
              );
            }

            throw new Error(
              `Server returned invalid response: ${text.substring(0, 100)}...`
            );
          }

          const data = (await response.json()) as LoginResponse;

          if (!response.ok || !data.success) {
            const errorMessage = data.message || 'Invalid email or password';
            throw new Error(errorMessage);
          }

          assertRoleMayAccessAdmin(data.data.user.role);

          // MFA-enabled accounts get no tokens here — only a 5-minute pending
          // token to spend on the `mfa` provider below. Returning a user now
          // would mint a session whose `token` is undefined.
          if (data.data.mfaRequired) {
            if (!data.data.pendingMfaToken) {
              throw new Error(
                'Two-factor authentication is required but the server did not issue a challenge. Please try again.'
              );
            }
            throw new Error(
              `${MFA_REQUIRED_PREFIX}${data.data.pendingMfaToken}`
            );
          }

          return toSessionUser(
            data.data.user,
            data.data.token,
            data.data.refreshToken,
            credentials.rememberMe === 'true'
          );
        } catch (error: unknown) {
          // An MFA challenge is a normal outcome, not a failure to log.
          if (
            !(error instanceof Error) ||
            !error.message.startsWith(MFA_REQUIRED_PREFIX)
          ) {
            console.error('Auth error:', error);
          }

          // Handle network errors specifically
          if (
            error instanceof TypeError &&
            error.message === 'Failed to fetch'
          ) {
            throw new Error(
              'Network error: Unable to connect to authentication server. Please check your internet connection and ensure the backend server is running.'
            );
          }

          const message =
            error instanceof Error ? error.message : 'Authentication failed';
          throw new Error(message);
        }
      },
    }),
    // Second half of the MFA login. The pending token is held in React state on
    // /signin between the two calls — never in a URL or storage — and dies with
    // the page or after 5 minutes server-side, whichever comes first.
    CredentialsProvider({
      id: 'mfa',
      name: 'Two-Factor Code',
      credentials: {
        pendingMfaToken: { label: 'Pending MFA Token', type: 'text' },
        code: { label: 'Code', type: 'text' },
        rememberMe: { label: 'Remember Me', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.pendingMfaToken || !credentials?.code) {
          throw new Error('Please provide your verification code');
        }

        try {
          const response = await fetch(`${API_URL}/api/users/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pendingMfaToken: credentials.pendingMfaToken,
              code: credentials.code,
            }),
          });

          const data = (await response.json()) as LoginResponse;

          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Invalid verification code');
          }

          assertRoleMayAccessAdmin(data.data.user.role);

          const sessionUser = await toSessionUser(
            data.data.user,
            data.data.token,
            data.data.refreshToken,
            credentials.rememberMe === 'true'
          );

          // Carried into the JWT so privileged calls can present it as
          // x-mfa-token; the admin never receives this API's own cookies.
          return { ...sessionUser, mfaToken: data.data.mfaToken };
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : 'Two-factor verification failed';
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
            body: JSON.stringify({
              tenantSlug: credentials.tenantSlug,
              pin: credentials.pin,
            }),
          });
          const data = (await response.json()) as LoginResponse;
          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Invalid PIN');
          }
          const user = data.data.user;
          // The PIN endpoint performed no role check at all, so a customer
          // account with a PIN could open an admin session through the POS.
          assertRoleMayAccessAdmin(user.role);
          const tenantValue = user.tenant;
          const tenantId =
            typeof tenantValue === 'object' && tenantValue !== null
              ? tenantValue._id
              : tenantValue || null;
          const tenantSlug =
            typeof tenantValue === 'object' && tenantValue !== null
              ? ((tenantValue as any).slug ?? null)
              : null;
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
          const message =
            error instanceof Error
              ? error.message
              : 'PIN authentication failed';
          throw new Error(message);
        }
      },
    }),
  ],
};
