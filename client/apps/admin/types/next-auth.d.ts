import { DefaultSession } from 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string | null;
      tenantSlug: string | null;
      token: string;
      firstName?: string;
      lastName?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    tenantId?: string | null;
    tenantSlug?: string | null;
    token: string;
    firstName?: string;
    lastName?: string;
    refreshToken?: string;
    remember?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    tenantId?: string | null;
    tenantSlug?: string | null;
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    error?: string;
    remember?: boolean;
  }
}
