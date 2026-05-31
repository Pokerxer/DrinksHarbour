'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PiCaretDown } from 'react-icons/pi';
import { routes } from '@/config/routes';

type NavItem =
  | { label: string; href: string; items?: never }
  | { label: string; href?: never; items: { label: string; href: string }[] };

const navItems: NavItem[] = [
  {
    label: 'Orders',
    items: [
      { label: 'Requests for Quotation', href: routes.eCommerce.purchases },
      {
        label: 'Purchase Orders',
        href: `${routes.eCommerce.purchases}?status=confirmed`,
      },
      { label: 'Create Purchase Order', href: routes.eCommerce.createPurchase },
      { label: 'Receive Goods', href: routes.eCommerce.receivePurchase },
      { label: 'Validate Receipt', href: routes.eCommerce.validateReceipt },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Vendor Bills', href: routes.eCommerce.vendorBills },
      { label: 'Create Bill', href: routes.eCommerce.createVendorBill },
      { label: 'Vendor Returns', href: routes.eCommerce.vendorReturns },
      { label: 'Create Return', href: routes.eCommerce.createVendorReturn },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { label: 'Purchase Analysis', href: routes.eCommerce.purchaseAnalytics },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Vendors', href: routes.eCommerce.purchaseVendors },
      {
        label: 'Purchase Agreements',
        href: routes.eCommerce.purchaseAgreements,
      },
      { label: 'Vendor Pricelists', href: routes.eCommerce.vendorPricelists },
      { label: 'UOM Conversions', href: routes.eCommerce.uomConversions },
      { label: 'Exchange Rates', href: routes.eCommerce.exchangeRates },
      { label: 'Settings', href: routes.eCommerce.purchaseSettings },
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
          const isDropdownActive =
            'items' in item &&
            (item.items?.some(
              (s) => s.href !== '#' && pathname.startsWith(s.href)
            ) ??
              false);
          const isOpen = openMenu === item.label;

          const activeCls =
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

          if ('href' in item && item.href) {
            const isActive = pathname === item.href;
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
                  isDropdownActive || isOpen
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
                    const isSubActive =
                      sub.href !== '#' && pathname === sub.href;
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
