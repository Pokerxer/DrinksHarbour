'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiCaretDown,
  PiGaugeDuotone,
  PiBookOpenDuotone,
  PiChartBarDuotone,
  PiBookOpenTextDuotone,
  PiReceiptDuotone,
  PiUsersDuotone,
  PiHandshakeDuotone,
  PiFileTextDuotone,
  PiArrowCounterClockwiseDuotone,
  PiMoneyDuotone,
  PiStackDuotone,
  PiPackageDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
} from '@/app/shared/nav-dropdown-panel';

type NavItem =
  | { label: string; href: string; icon: React.ReactNode }
  | { label: string; icon: React.ReactNode; items: NavSubItem[] };

const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: routes.accounting.index,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Journal Entries',
    href: routes.accounting.journalEntries,
    icon: <PiBookOpenDuotone />,
  },
  {
    label: 'Reports',
    href: routes.accounting.reports,
    icon: <PiChartBarDuotone />,
  },
  {
    label: 'Customers',
    icon: <PiUsersDuotone />,
    items: [
      { label: 'Invoices', href: routes.accounting.invoices, icon: <PiFileTextDuotone />, desc: 'Open customer invoices' },
      { label: 'Credit Notes', href: routes.accounting.creditNotes, icon: <PiArrowCounterClockwiseDuotone />, desc: 'Issue customer credits' },
      { label: 'Payments', href: `${routes.accounting.payments}?side=customer`, icon: <PiMoneyDuotone />, desc: 'Register customer payments' },
      { label: 'Batch Payments', href: `${routes.accounting.batchPayments}?side=customer`, icon: <PiStackDuotone />, desc: 'Group payments for deposit' },
      { label: 'Products', href: routes.accounting.products, icon: <PiPackageDuotone />, desc: 'What you sell' },
      { label: 'Customers', href: routes.accounting.customers, icon: <PiUsersDuotone />, desc: 'Balances & contacts' },
    ],
  },
  {
    label: 'Vendors',
    icon: <PiHandshakeDuotone />,
    items: [
      { label: 'Bills', href: routes.accounting.bills, icon: <PiFileTextDuotone />, desc: 'Open vendor bills' },
      { label: 'Payments', href: `${routes.accounting.payments}?side=vendor`, icon: <PiMoneyDuotone />, desc: 'Pay your vendors' },
      { label: 'Batch Payments', href: `${routes.accounting.batchPayments}?side=vendor`, icon: <PiStackDuotone />, desc: 'Group payments for payout' },
      { label: 'Products', href: routes.accounting.products, icon: <PiPackageDuotone />, desc: 'What you sell' },
      { label: 'Vendors', href: routes.accounting.vendors, icon: <PiHandshakeDuotone />, desc: 'Balances & contacts' },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiBookOpenTextDuotone />,
    items: [
      {
        label: 'Chart of Accounts',
        href: routes.accounting.chartOfAccounts,
        icon: <PiBookOpenTextDuotone />,
        desc: 'Accounts & balances',
      },
      {
        label: 'Taxes',
        href: routes.accounting.taxes,
        icon: <PiReceiptDuotone />,
        desc: 'Rates, ledger, summary',
      },
    ],
  },
];

function subItemsOf(item: NavItem): NavSubItem[] {
  if ('items' in item) return item.items;
  return [];
}

export default function AccountingNavHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [close]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex items-center border-b border-gray-200 bg-white"
    >
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.accounting.index}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Accounting</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDirectActive = 'href' in item && item.href === pathname;
          const isDropdownActive = subItemsOf(item).some(
            (s) => s.href !== '#' && pathname.startsWith(s.href.split('?')[0])
          );
          const isActive = isDirectActive || isDropdownActive;
          const isOpen = openMenu === item.label;

          const activeCls = `font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]`;

          if ('href' in item) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          }

          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isActive || isOpen
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                  {item.icon}
                </span>
                {item.label}
                <PiCaretDown
                  className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <NavDropdownPanel
                  items={subItemsOf(item)}
                  pathname={pathname}
                  onNavigate={close}
                  columns={1}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
