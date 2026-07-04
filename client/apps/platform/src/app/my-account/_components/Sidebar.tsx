'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';
import { NAV_ITEMS } from '../_constants';

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  cork:   { label: 'Cork',   color: 'bg-amber-400/20 text-amber-200 border-amber-400/30' },
  barrel: { label: 'Barrel', color: 'bg-blue-400/20 text-blue-200 border-blue-400/30' },
  cellar: { label: 'Cellar', color: 'bg-purple-400/20 text-purple-200 border-purple-400/30' },
  vault:  { label: 'Vault',  color: 'bg-yellow-300/20 text-yellow-200 border-yellow-300/30' },
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const displayName = user?.firstName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const tier = user?.loyaltyTier || 'cork';
  const badge = TIER_BADGE[tier];

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-stone-900 via-red-950 to-stone-900 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-lg font-black flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm truncate">{displayName}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-red-200 truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>
      <nav className="p-2">
        {NAV_ITEMS.map(({ icon: Ic, label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'border-l-2 border-red-700 bg-red-50/50 text-red-700'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <Ic size={17} className={active ? 'text-red-700' : 'text-stone-400'} />
              {label}
            </Link>
          );
        })}
        <div className="border-t border-stone-100 mt-2 pt-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-all duration-150"
          >
            <Icon.PiSignOut size={17} /> Sign Out
          </button>
        </div>
      </nav>
    </div>
  );
}
