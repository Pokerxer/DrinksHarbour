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
      tenant?: string;
      tenantId?: string;
      avatar?: { url: string };
    };
    token: string;
  };
  message?: string;
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
      // Check if token is expired
      if (token.accessToken) {
        try {
          const decoded = JSON.parse(Buffer.from((token.accessToken as string).split('.')[1], 'base64').toString());
          if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            return { ...session, error: 'RefreshAccessTokenError' };
          }
        } catch (error) {
          console.error('Error decoding token in session callback:', error);
        }
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          tenantId: token.tenantId as string | null,
          token: token.accessToken as string,
        },
        error: token.error,
      };
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.accessToken = user.token;
      }

      // Check if token is expired
      if (token.accessToken) {
        try {
          const decoded = JSON.parse(Buffer.from((token.accessToken as string).split('.')[1], 'base64').toString());
          if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            token.error = 'RefreshAccessTokenError';
          }
        } catch (error) {
          console.error('Error decoding token in jwt callback:', error);
        }
      }

      return token;
    },
    async redirect({ url, baseUrl }) {
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
          const validRoles: UserRole[] = ['admin', 'super_admin', 'tenant_admin', 'tenant_owner', 'staff', 'cashier', 'viewer'];
          if (!validRoles.includes(userRole)) {
            throw new Error('Access denied. Valid role required.');
          }

          return {
            id: data.data.user._id || data.data.user.id,
            email: data.data.user.email,
            name: `${data.data.user.firstName} ${data.data.user.lastName}`,
            firstName: data.data.user.firstName,
            lastName: data.data.user.lastName,
            role: userRole,
            tenantId: data.data.user.tenant || data.data.user.tenantId || null,
            image: data.data.user.avatar?.url || null,
            token: data.data.token,
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
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
};
