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
  PiChartLineUpDuotone,
  PiGearSixDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
  type NavSection,
} from '@/app/shared/nav-dropdown-panel';

type NavItem = {
  label: string;
  icon: React.ReactNode;
  items?: NavSubItem[];
  sections?: NavSection[];
};

const reportingItems: NavSubItem[] = [
  // Every Reporting entry is the analysis page pre-grouped along one
  // dimension — Odoo's trick of making each menu item a lens, not a page.
  {
    label: 'Sales',
    href: `${routes.eCommerce.salesAnalytics}?groupBy=order_month`,
    icon: <PiChartLineUpDuotone />,
    desc: 'Revenue over time',
  },
  {
    label: 'Salespersons',
    href: `${routes.eCommerce.salesAnalytics}?groupBy=salesperson`,
    icon: <PiFileTextDuotone />,
    desc: 'Who is selling',
  },
  {
    label: 'Products',
    href: `${routes.eCommerce.salesAnalytics}?groupBy=product`,
    icon: <PiShoppingCartDuotone />,
    desc: 'What moves',
  },
  {
    label: 'Customers',
    href: `${routes.eCommerce.salesAnalytics}?groupBy=customer`,
    icon: <PiTrayArrowDownDuotone />,
    desc: 'Who buys',
  },
];

// Configuration entries link only to pages that exist; sections mirror the
// Odoo Sales configuration tree. Missing targets (Headers/Footers, Payment
// Providers…) are deliberately absent rather than dead links.
const configSections: NavSection[] = [
  {
    heading: undefined,
    items: [{ label: 'Settings', href: '/settings' }],
  },
  {
    heading: 'Sales Orders',
    items: [
      {
        label: 'Delivery Methods',
        href: routes.inventory.deliveryMethods,
      },
      { label: 'Pricelists', href: '/point-of-sale/pricelists' },
    ],
  },
  {
    heading: 'Products',
    items: [
      { label: 'Attributes', href: routes.inventory.attributes },
      { label: 'Combo Choices', href: routes.pos.combos },
      { label: 'Categories', href: routes.eCommerce.subCategories },
      { label: 'Units & Packagings', href: routes.eCommerce.uomConversions },
    ],
  },
];

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
  {
    label: 'Reporting',
    icon: <PiChartLineUpDuotone />,
    items: reportingItems,
  },
  {
    label: 'Configuration',
    icon: <PiGearSixDuotone />,
    sections: configSections,
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
      className="relative mb-0 flex flex-wrap items-center border-b border-gray-200 bg-white"
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
        <span className="hidden min-[480px]:inline text-sm font-semibold text-gray-900">Sales</span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-wrap items-center pl-2">
        {navItems.map((item) => {
          const flatHrefs = [
            ...(item.items ?? []).map((s) => s.href),
            ...(item.sections ?? []).flatMap((sec) =>
              sec.items.map((s) => s.href)
            ),
          ];
          // Deep-linked reporting lenses (?groupBy=…) belong to the analysis
          // page; match on path only so the tab stays lit inside it.
          const isDropdownActive = flatHrefs.some((href) => {
            if (href === '#' || !href) return false;
            const path = href.split('?')[0];
            return (
              pathname === path ||
              (path !== routes.eCommerce.salesAnalytics &&
                pathname.startsWith(path))
            );
          });
          const isOpen = openMenu === item.label;
          const activeCls =
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-brand';

          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors md:px-4 ${
                  isDropdownActive || isOpen
                    ? `${activeCls} text-brand`
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
                  sections={item.sections}
                  pathname={pathname.split('?')[0]}
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
