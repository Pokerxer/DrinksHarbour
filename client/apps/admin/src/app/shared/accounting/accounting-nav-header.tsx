'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PiBooksDuotone, PiCaretDown, PiArrowUpRight } from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import { navItems } from './accounting-navigation';
import { accountingNavActive } from './accounting-documents';

function Navigation() {
  const pathname = usePathname();
  const side = useSearchParams().get('side') || 'customer';
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(null);
  }, [pathname, side]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const selected = navItems.find((item) => item.label === open);
  return (
    <nav
      ref={root}
      aria-label="Accounting"
      className="relative z-20 min-w-0 border-b border-gray-200 bg-white"
    >
      <div className="flex min-h-14 items-center gap-2 px-2 sm:px-4">
        <LauncherButton className="shrink-0 shadow-none" />
        <Link
          href="/accounting"
          className="flex items-center gap-2 text-sm font-bold text-gray-900"
        >
          <PiBooksDuotone className="h-6 w-6 text-brand" />
          Accounting
        </Link>
        <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-gray-500">
          NGN · GENERAL LEDGER
        </span>
      </div>
      <div className="flex overflow-x-auto px-2 sm:px-4">
        {navItems.map((item) => {
          const active =
            'href' in item
              ? accountingNavActive(item.href, pathname, side)
              : item.items.some((link) =>
                  accountingNavActive(link.href, pathname, side)
                );
          const cls = `flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors sm:text-sm ${active || open === item.label ? 'border-brand text-brand' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`;
          return 'href' in item ? (
            <Link
              key={item.label}
              href={item.href}
              className={cls}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ) : (
            <button
              type="button"
              key={item.label}
              className={cls}
              aria-expanded={open === item.label}
              aria-controls="accounting-menu"
              onClick={() => setOpen(open === item.label ? null : item.label)}
            >
              {item.label}
              <PiCaretDown
                className={open === item.label ? 'rotate-180' : ''}
              />
            </button>
          );
        })}
      </div>
      {selected && 'items' in selected && (
        <div
          id="accounting-menu"
          className="absolute inset-x-0 top-full grid gap-1 rounded-b-2xl border border-gray-200 bg-white p-3 shadow-xl sm:grid-cols-2 lg:grid-cols-3"
        >
          {selected.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(null)}
              className={`flex min-h-14 items-center gap-3 rounded-xl p-3 hover:bg-gray-50 ${accountingNavActive(item.href, pathname, side) ? 'bg-red-50 text-brand' : 'text-gray-700'}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {item.label}
                </span>
                <span className="block text-xs text-gray-500">{item.desc}</span>
              </span>
              <PiArrowUpRight className="ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
export default function AccountingNavHeader() {
  return (
    <Suspense fallback={<div className="h-24 border-b bg-white" />}>
      <Navigation />
    </Suspense>
  );
}
