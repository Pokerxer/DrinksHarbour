'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';
import { NAV_ITEMS } from '../_constants';

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName = user?.firstName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="lg:hidden bg-white border-b border-stone-100 sticky top-0 z-20">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white text-xs font-black">
            {initials}
          </div>
          <span className="font-bold text-stone-900 text-sm">{displayName}</span>
        </div>
        <button onClick={() => setOpen(o => !o)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500">
          {open ? <Icon.PiX size={20} /> : <Icon.PiList size={20} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-stone-100 bg-white px-4 pb-4 pt-2">
          {NAV_ITEMS.map(({ icon: Ic, label, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active ? 'bg-red-50/50 text-red-700' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Ic size={17} className={active ? 'text-red-700' : 'text-stone-400'} />
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full mt-1 transition-all duration-150"
          >
            <Icon.PiSignOut size={17} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
