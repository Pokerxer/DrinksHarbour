'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { routes } from '@/config/routes';
import { PiCaretDown } from 'react-icons/pi';

type NavItem =
  | { label: string; href: string; items?: never }
  | { label: string; href?: never; items: { label: string; href: string }[] };

const navItems: NavItem[] = [
  { label: 'Dashboard', href: routes.pos.index },
  {
    label: 'Orders',
    items: [
      { label: 'Orders',               href: routes.pos.orders },
      { label: 'Sessions',             href: routes.pos.sessions },
      { label: 'Payments',             href: '#' },
      { label: 'Preparation Printers', href: '#' },
      { label: 'Preparation Display',  href: '#' },
      { label: 'Customers',            href: '#' },
    ],
  },
  {
    label: 'Products',
    items: [
      { label: 'Products',             href: `${routes.eCommerce.subProducts}?from=pos` },
      { label: 'Product Variants',     href: `${routes.eCommerce.subProducts}?from=pos` },
      { label: 'Combo Choices',        href: routes.pos.combos },
      { label: 'Pricelists',           href: routes.pos.pricelists },
      { label: 'Discount & Loyalty',   href: routes.pos.loyalty },
      { label: 'Gift cards & eWallet', href: '#' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { label: 'Orders',         href: routes.pos.orders },
      { label: 'Sales Details',  href: '#' },
      { label: 'Session Report', href: routes.pos.sessions },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Settings',               href: routes.pos.settings },
      { label: 'Payment Methods',        href: '#' },
      { label: 'Coins/Bills',            href: '#' },
      { label: 'Point of Sales',         href: routes.pos.index },
      { label: 'Note Models',            href: '#' },
      { label: 'Products',               href: `${routes.eCommerce.subProducts}?from=pos` },
      { label: 'PoS Product Categories', href: routes.eCommerce.categories },
      { label: 'Attributes',             href: '#' },
    ],
  },
];

const BRAND = '#b20202';
const BRAND_HOVER_BG = '#fef2f2';

export default function POSNavHeader() {
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

  useEffect(() => { close(); }, [pathname, close]);

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex items-center border-b border-gray-200 bg-white"
    >
      {/* Brand */}
      <Link
        href={routes.pos.index}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 pr-5 py-2"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Point of Sale</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDirectActive = 'href' in item && item.href === pathname;
          const isDropdownActive =
            'items' in item &&
            (item.items?.some((s) => s.href !== '#' && pathname.startsWith(s.href)) ?? false);
          const isActive = isDirectActive || isDropdownActive;
          const isOpen = openMenu === item.label;

          const activeCls = `font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[${BRAND}]`;

          if ('href' in item && item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          }

          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex items-center gap-1 px-4 py-3 text-sm transition-colors ${
                  isActive || isOpen
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
                <PiCaretDown
                  className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full z-50 min-w-[210px] rounded-b border border-t-0 border-gray-200 bg-white shadow-lg">
                  {item.items?.map((sub) => {
                    const isSubActive = sub.href !== '#' && pathname === sub.href;
                    return (
                      <Link
                        key={sub.label}
                        href={sub.href}
                        onClick={close}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          isSubActive
                            ? 'bg-[#fef2f2] font-medium text-[#b20202]'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
