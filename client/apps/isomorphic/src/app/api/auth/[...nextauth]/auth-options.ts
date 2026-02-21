import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@/env.mjs';
import { pagesOptions } from './pages-options';

// Server API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

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
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          token: token.accessToken as string,
        },
      };
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.token;
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
          // Call the server API for authentication
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

          const data = await response.json();

          if (!response.ok || !data.success) {
            // Pass through the server error message
            const errorMessage = data.message || 'Invalid email or password';
            throw new Error(errorMessage);
          }

          // Check if user has admin role
          const userRole = data.data.user.role;
          if (!['admin', 'super_admin', 'tenant_admin', 'tenant_owner'].includes(userRole)) {
            throw new Error('Access denied. Admin privileges required.');
          }

          // Return user data for NextAuth
          return {
            id: data.data.user._id || data.data.user.id,
            email: data.data.user.email,
            name: `${data.data.user.firstName} ${data.data.user.lastName}`,
            firstName: data.data.user.firstName,
            lastName: data.data.user.lastName,
            role: data.data.user.role,
            image: data.data.user.avatar?.url || null,
            token: data.data.token,
          };
        } catch (error: any) {
          console.error('Auth error:', error);
          // Re-throw the error with the message for NextAuth to handle
          throw new Error(error.message || 'Authentication failed');
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
