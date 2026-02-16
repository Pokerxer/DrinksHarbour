import { DefaultSession } from 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      token: string;
      firstName?: string;
      lastName?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    token: string;
    firstName?: string;
    lastName?: string;
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id?: string;
    role?: string;
    accessToken?: string;
    idToken?: string;
  }
}
