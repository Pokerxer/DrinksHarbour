'use client';

import React, { useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MobileNav from './_components/MobileNav';
import Sidebar from './_components/Sidebar';

type AccountUser = NonNullable<ReturnType<typeof useAuth>['user']>;

interface AccountCtx {
  user: AccountUser | null;
  setUser: (u: Partial<AccountUser> | AccountUser | null) => void;
  token: string | null;
}

export const AccountContext = createContext<AccountCtx>({ user: null, setUser: () => {}, token: null });
export const useAccount = () => useContext(AccountContext);

export default function AccountShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading, loadProfile, updateUser } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !token) {
      router.push('/login?redirect=/my-account');
      return;
    }
    loadProfile();
  }, [isAuthenticated, isLoading, token, router, loadProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AccountContext.Provider value={{ user, token, setUser: (u) => { if (u) updateUser(u); } }}>
      <div className="min-h-screen bg-stone-50">
        <MobileNav />
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="grid lg:grid-cols-4 gap-8 items-start">
            <aside className="hidden lg:block lg:col-span-1 sticky top-8">
              <Sidebar />
            </aside>
            <main className="lg:col-span-3 min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </AccountContext.Provider>
  );
}
