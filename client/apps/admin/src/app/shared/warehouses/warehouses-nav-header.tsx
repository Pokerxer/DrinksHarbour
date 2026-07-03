'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiCaretDown,
  PiBuildingsDuotone,
  PiPackageDuotone,
  PiTagDuotone,
  PiFilesDuotone,
  PiCubeDuotone,
  PiShoppingCartDuotone,
  PiTrayArrowDownDuotone,
  PiUsersThreeDuotone,
  PiReceiptDuotone,
  PiArrowUUpLeftDuotone,
  PiCashRegisterDuotone,
  PiChartLineUpDuotone,
  PiGearSixDuotone,
  PiSlidersHorizontalDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
} from '@/app/shared/nav-dropdown-panel';

type NavItem =
  | { label: string; href: string; icon: React.ReactNode; items?: never }
  | { label: string; href?: never; icon: React.ReactNode; items: NavSubItem[] };

const navItems: NavItem[] = [
  {
    label: 'Warehouses',
    href: routes.warehouses.list,
    icon: <PiBuildingsDuotone />,
  },
  {
    label: 'Analysis',
    href: routes.warehouses.analysis,
    icon: <PiChartLineUpDuotone />,
  },
  {
    label: 'Inventory',
    href: routes.inventory.index,
    icon: <PiCubeDuotone />,
  },
  {
    label: 'Catalog',
    icon: <PiPackageDuotone />,
    items: [
      {
        label: 'Products',
        href: routes.eCommerce.subProducts,
        icon: <PiPackageDuotone />,
        desc: 'Stock & variants',
      },
      {
        label: 'Categories',
        href: routes.eCommerce.categories,
        icon: <PiTagDuotone />,
        desc: 'Organize the catalog',
      },
      {
        label: 'Brands',
        href: routes.eCommerce.brands,
        icon: <PiFilesDuotone />,
        desc: 'Manufacturers',
      },
    ],
  },
  {
    label: 'Purchases',
    icon: <PiShoppingCartDuotone />,
    items: [
      {
        label: 'Purchase Orders',
        href: routes.eCommerce.purchases,
        icon: <PiShoppingCartDuotone />,
        desc: 'Buy from vendors',
      },
      {
        label: 'Receive Stock',
        href: routes.eCommerce.receivePurchase,
        icon: <PiTrayArrowDownDuotone />,
        desc: 'Goods receipts',
      },
      {
        label: 'Vendors',
        href: routes.eCommerce.purchaseVendors,
        icon: <PiUsersThreeDuotone />,
        desc: 'Supplier directory',
      },
      {
        label: 'Vendor Bills',
        href: routes.eCommerce.vendorBills,
        icon: <PiReceiptDuotone />,
        desc: 'Payables',
      },
      {
        label: 'Vendor Returns',
        href: routes.eCommerce.vendorReturns,
        icon: <PiArrowUUpLeftDuotone />,
        desc: 'Send stock back',
      },
    ],
  },
  {
    label: 'Point of Sale',
    href: routes.pos.index,
    icon: <PiCashRegisterDuotone />,
  },
  {
    label: 'Configuration',
    icon: <PiGearSixDuotone />,
    items: [
      {
        label: 'Settings',
        href: routes.warehouses.settings,
        icon: <PiSlidersHorizontalDuotone />,
        desc: 'Warehouse settings',
      },
      {
        label: 'Inventory',
        href: routes.warehouses.inventorySettings,
        icon: <PiCubeDuotone />,
        desc: 'Stock & valuation rules',
      },
    ],
  },
];

export default function WarehousesNavHeader() {
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
        href={routes.warehouses.list}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Warehouses</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDirectActive = 'href' in item && item.href === pathname;
          const isDropdownActive =
            'items' in item &&
            (item.items?.some(
              (s) => s.href !== '#' && pathname.startsWith(s.href)
            ) ??
              false);
          const isActive = isDirectActive || isDropdownActive;
          const isOpen = openMenu === item.label;

          const activeCls = `font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]`;

          if ('href' in item && item.href) {
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
                  items={item.items!}
                  pathname={pathname}
                  onNavigate={close}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
