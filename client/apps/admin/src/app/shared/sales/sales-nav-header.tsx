// client/apps/admin/src/app/shared/sales/sales-nav-header.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiCaretDown,
  PiFileTextDuotone,
  PiShoppingCartDuotone,
  PiPlusCircleDuotone,
  PiTrayArrowDownDuotone,
  PiArrowUUpLeftDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
} from '@/app/shared/nav-dropdown-panel';

type NavItem = { label: string; icon: React.ReactNode; items: NavSubItem[] };

const navItems: NavItem[] = [
  {
    label: 'Quotations & Orders',
    icon: <PiFileTextDuotone />,
    items: [
      {
        label: 'Quotations',
        href: routes.eCommerce.salesQuotations,
        icon: <PiFileTextDuotone />,
        desc: 'Draft & sent quotes',
      },
      {
        label: 'Orders',
        href: routes.eCommerce.salesOrders,
        icon: <PiShoppingCartDuotone />,
        desc: 'Confirmed & fulfilling',
      },
      {
        label: 'New Sale',
        href: routes.eCommerce.createSale,
        icon: <PiPlusCircleDuotone />,
        desc: 'Create quotation or order',
      },
    ],
  },
  {
    label: 'Fulfillment',
    icon: <PiTrayArrowDownDuotone />,
    items: [
      {
        label: 'Awaiting Fulfillment',
        href: routes.eCommerce.salesFulfillList,
        icon: <PiTrayArrowDownDuotone />,
        desc: 'Ship outstanding orders',
      },
    ],
  },
  {
    label: 'Returns',
    icon: <PiArrowUUpLeftDuotone />,
    items: [
      {
        label: 'All Returns',
        href: routes.eCommerce.salesReturns,
        icon: <PiArrowUUpLeftDuotone />,
        desc: 'Restocked / reversed',
      },
      {
        label: 'New Return',
        href: routes.eCommerce.createSalesReturn,
        icon: <PiPlusCircleDuotone />,
        desc: 'Return fulfilled units',
      },
    ],
  },
];

export default function SalesNavHeader() {
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
      <LauncherButton className="me-1 ms-3 shadow-none" />

      <Link
        href={routes.eCommerce.salesOrders}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pl-4 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Sales</span>
      </Link>

      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDropdownActive = item.items.some(
            (s) => s.href !== '#' && pathname.startsWith(s.href.split('?')[0])
          );
          const isOpen = openMenu === item.label;
          const activeCls =
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isDropdownActive || isOpen
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
                  items={item.items}
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
