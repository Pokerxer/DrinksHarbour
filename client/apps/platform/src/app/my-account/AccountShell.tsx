'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ─── Context ──────────────────────────────────────────────────────────────────

interface AccountUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  createdAt?: string;
}

interface AccountCtx {
  user: AccountUser | null;
  setUser: (u: AccountUser) => void;
  token: string | null;
}

export const AccountContext = createContext<AccountCtx>({ user: null, setUser: () => {}, token: null });
export const useAccount = () => useContext(AccountContext);

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { icon: Icon.PiSquaresFourBold, label: 'Overview',        href: '/my-account' },
  { icon: Icon.PiPackageBold,     label: 'My Orders',       href: '/my-account/orders' },
  { icon: Icon.PiHeartBold,       label: 'Wishlist',        href: '/wishlist' },
  { icon: Icon.PiMapPinBold,      label: 'Addresses',       href: '/my-account/addresses' },
  { icon: Icon.PiCreditCardBold,  label: 'Payment Methods', href: '/my-account/payment-methods' },
  { icon: Icon.PiBellBold,        label: 'Notifications',   href: '/my-account/notifications' },
  { icon: Icon.PiShieldBold,      label: 'Security',        href: '/my-account/security' },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function AccountShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]       = useState<AccountUser | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('dh_token') || sessionStorage.getItem('dh_token');
    if (!t) { router.push('/login?redirect=/my-account'); return; }
    setToken(t);

    const stored = localStorage.getItem('dh_user') || sessionStorage.getItem('dh_user');
    if (stored) { try { setUser(JSON.parse(stored)); } catch {} }

    fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const u = data.data?.user || data.user || data.data;
          setUser(u);
          localStorage.setItem('dh_user', JSON.stringify(u));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    ['dh_token', 'dh_user'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = user?.firstName || user?.name || user?.username || 'User';
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <AccountContext.Provider value={{ user, setUser: (u) => setUser(u), token }}>
      <div className="min-h-screen bg-gray-50">

        {/* ── Mobile header ─────────────────────────────────────────────── */}
        <div className="lg:hidden bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white text-xs font-black">
                {initials}
              </div>
              <span className="font-bold text-gray-900 text-sm">{displayName}</span>
            </div>
            <button onClick={() => setMobileNavOpen(o => !o)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
              {mobileNavOpen ? <Icon.PiX size={20} /> : <Icon.PiList size={20} />}
            </button>
          </div>

          {/* Mobile nav dropdown */}
          {mobileNavOpen && (
            <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2">
              {NAV.map(({ icon: Ic, label, href }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Ic size={17} className={active ? 'text-red-700' : 'text-gray-400'} />
                    {label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full mt-1"
              >
                <Icon.PiSignOut size={17} /> Sign Out
              </button>
            </div>
          )}
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="grid lg:grid-cols-4 gap-8 items-start">

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="hidden lg:block lg:col-span-1 sticky top-8">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Profile block */}
                <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-lg font-black flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{displayName}</p>
                      <p className="text-xs text-red-200 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Nav links */}
                <nav className="p-2">
                  {NAV.map(({ icon: Ic, label, href }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          active
                            ? 'bg-red-50 text-red-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Ic size={17} className={active ? 'text-red-700' : 'text-gray-400'} />
                        {label}
                      </Link>
                    );
                  })}
                  <div className="border-t border-gray-100 mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-all"
                    >
                      <Icon.PiSignOut size={17} /> Sign Out
                    </button>
                  </div>
                </nav>
              </div>
            </aside>

            {/* ── Content ─────────────────────────────────────────────────── */}
            <main className="lg:col-span-3 min-w-0">
              {children}
            </main>

          </div>
        </div>
      </div>
    </AccountContext.Provider>
  );
}
