// @ts-nocheck
'use client';

import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';

function SessionHandler({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      signOut({ callbackUrl: '/signin' });
    }
  }, [session]);

  return <>{children}</>;
}

export default function AuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: any;
}): React.ReactNode {
  return (
    <SessionProvider session={session}>
      <SessionHandler>{children}</SessionHandler>
    </SessionProvider>
  );
}
