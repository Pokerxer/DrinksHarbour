'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiCaretDown,
  PiClipboardTextDuotone,
  PiCurrencyDollarDuotone,
  PiChartBarDuotone,
  PiGearDuotone,
  PiFileTextDuotone,
  PiShoppingCartDuotone,
  PiPlusCircleDuotone,
  PiTrayArrowDownDuotone,
  PiCheckCircleDuotone,
  PiReceiptDuotone,
  PiArrowUUpLeftDuotone,
  PiChartLineUpDuotone,
  PiUsersThreeDuotone,
  PiHandshakeDuotone,
  PiListChecksDuotone,
  PiArrowsLeftRightDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
} from '@/app/shared/nav-dropdown-panel';

type NavItem = {
  label: string;
  icon: React.ReactNode;
  items: NavSubItem[];
};

const navItems: NavItem[] = [
  {
    label: 'Orders',
    icon: <PiClipboardTextDuotone />,
    items: [
      {
        label: 'Requests for Quotation',
        href: routes.eCommerce.purchases,
        icon: <PiFileTextDuotone />,
        desc: 'Draft RFQs',
      },
      {
        label: 'Purchase Orders',
        href: `${routes.eCommerce.purchases}?status=confirmed`,
        icon: <PiShoppingCartDuotone />,
        desc: 'Confirmed orders',
      },
      {
        label: 'Create Purchase Order',
        href: routes.eCommerce.createPurchase,
        icon: <PiPlusCircleDuotone />,
        desc: 'New order',
      },
      {
        label: 'Receive Goods',
        href: routes.eCommerce.receivePurchase,
        icon: <PiTrayArrowDownDuotone />,
        desc: 'Incoming stock',
      },
      {
        label: 'Validate Receipt',
        href: routes.eCommerce.validateReceipt,
        icon: <PiCheckCircleDuotone />,
        desc: 'Confirm deliveries',
      },
      {
        label: 'Stock Transfers',
        href: routes.eCommerce.stockTransfers,
        icon: <PiArrowsLeftRightDuotone />,
        desc: 'Move stock between warehouses',
      },
    ],
  },
  {
    label: 'Billing',
    icon: <PiCurrencyDollarDuotone />,
    items: [
      {
        label: 'Vendor Bills',
        href: routes.eCommerce.vendorBills,
        icon: <PiReceiptDuotone />,
        desc: 'Payables',
      },
      {
        label: 'Create Bill',
        href: routes.eCommerce.createVendorBill,
        icon: <PiPlusCircleDuotone />,
        desc: 'New bill',
      },
      {
        label: 'Vendor Returns',
        href: routes.eCommerce.vendorReturns,
        icon: <PiArrowUUpLeftDuotone />,
        desc: 'Send stock back',
      },
      {
        label: 'Create Return',
        href: routes.eCommerce.createVendorReturn,
        icon: <PiPlusCircleDuotone />,
        desc: 'New return',
      },
    ],
  },
  {
    label: 'Reporting',
    icon: <PiChartBarDuotone />,
    items: [
      {
        label: 'Purchase Analysis',
        href: routes.eCommerce.purchaseAnalytics,
        icon: <PiChartLineUpDuotone />,
        desc: 'Spend insights',
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiGearDuotone />,
    items: [
      {
        label: 'Vendors',
        href: routes.eCommerce.purchaseVendors,
        icon: <PiUsersThreeDuotone />,
        desc: 'Supplier directory',
      },
      {
        label: 'Purchase Agreements',
        href: routes.eCommerce.purchaseAgreements,
        icon: <PiHandshakeDuotone />,
        desc: 'Contracts & blankets',
      },
      {
        label: 'Vendor Pricelists',
        href: routes.eCommerce.vendorPricelists,
        icon: <PiListChecksDuotone />,
        desc: 'Negotiated prices',
      },
      {
        label: 'UOM Conversions',
        href: routes.eCommerce.uomConversions,
        icon: <PiArrowsLeftRightDuotone />,
        desc: 'Unit mapping',
      },
      {
        label: 'Exchange Rates',
        href: routes.eCommerce.exchangeRates,
        icon: <PiCurrencyDollarDuotone />,
        desc: 'Multi-currency',
      },
      {
        label: 'Settings',
        href: routes.eCommerce.purchaseSettings,
        icon: <PiGearDuotone />,
        desc: 'Module options',
      },
    ],
  },
];

export default function PurchasesNavHeader() {
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

      <Link
        href={routes.eCommerce.purchases}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pl-4 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Purchases</span>
      </Link>

      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDropdownActive = item.items.some(
            (s) => s.href !== '#' && pathname.startsWith(s.href.split('?')[0])
          );
          const isOpen = openMenu === item.label;

          const activeCls =
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

          // Configuration has many items — show it in two columns.
          const columns = item.items.length > 4 ? 2 : 1;

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
                  columns={columns}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
