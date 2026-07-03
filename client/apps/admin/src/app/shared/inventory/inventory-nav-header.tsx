'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiCaretDown,
  PiGaugeDuotone,
  PiArrowsLeftRightDuotone,
  PiTrayArrowDownDuotone,
  PiTruckDuotone,
  PiArrowsClockwiseDuotone,
  PiSlidersDuotone,
  PiClipboardTextDuotone,
  PiTrashDuotone,
  PiShoppingCartDuotone,
  PiArrowsCounterClockwiseDuotone,
  PiChartBarDuotone,
  PiCubeDuotone,
  PiMapPinDuotone,
  PiCoinsDuotone,
  PiClockCounterClockwiseDuotone,
  PiGearDuotone,
  PiBuildingsDuotone,
  PiSwapDuotone,
  PiStackDuotone,
  PiSignpostDuotone,
  PiTagDuotone,
  PiPackageDuotone,
  PiTruckTrailerDuotone,
  PiCubeTransparentDuotone,
  PiWrenchDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
  type NavSection,
} from '@/app/shared/nav-dropdown-panel';

type NavItem =
  | { label: string; href: string; icon: React.ReactNode }
  | { label: string; icon: React.ReactNode; items: NavSubItem[] }
  | { label: string; icon: React.ReactNode; sections: NavSection[] };

const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: routes.inventory.index,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Operations',
    icon: <PiArrowsLeftRightDuotone />,
    items: [
      {
        label: 'Transfers',
        href: routes.inventory.transfers,
        icon: <PiArrowsLeftRightDuotone />,
        desc: 'Move stock between warehouses',
      },
      {
        label: 'Receipts',
        href: routes.inventory.receipts,
        icon: <PiTrayArrowDownDuotone />,
        desc: 'Incoming stock',
      },
      {
        label: 'Deliveries',
        href: routes.inventory.deliveries,
        icon: <PiTruckDuotone />,
        desc: 'Outgoing stock',
      },
      {
        label: 'Internal',
        href: routes.inventory.internal,
        icon: <PiArrowsClockwiseDuotone />,
        desc: 'Internal moves',
      },
      {
        label: 'Adjustments',
        href: routes.inventory.adjustments,
        icon: <PiSlidersDuotone />,
        desc: 'Stock corrections',
      },
      {
        label: 'Physical Inventory',
        href: routes.inventory.physicalInventory,
        icon: <PiClipboardTextDuotone />,
        desc: 'Count & reconcile',
      },
      {
        label: 'Scrap',
        href: routes.inventory.scrap,
        icon: <PiTrashDuotone />,
        desc: 'Damaged, expired, written off',
      },
      {
        label: 'Procurement',
        href: routes.inventory.procurement,
        icon: <PiShoppingCartDuotone />,
        desc: 'What to buy now',
      },
      {
        label: 'Replenishment',
        href: routes.inventory.replenishment,
        icon: <PiArrowsCounterClockwiseDuotone />,
        desc: 'Reordering rules',
      },
    ],
  },
  {
    label: 'Reporting',
    icon: <PiChartBarDuotone />,
    items: [
      {
        label: 'Stock',
        href: routes.inventory.stock,
        icon: <PiCubeDuotone />,
        desc: 'Stock on hand',
      },
      {
        label: 'Locations',
        href: routes.inventory.locations,
        icon: <PiMapPinDuotone />,
        desc: 'Stock by location',
      },
      {
        label: 'Valuation',
        href: routes.inventory.valuation,
        icon: <PiCoinsDuotone />,
        desc: 'Inventory value',
      },
      {
        label: 'Moves History',
        href: routes.inventory.movesHistory,
        icon: <PiClockCounterClockwiseDuotone />,
        desc: 'Every stock move',
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiGearDuotone />,
    sections: [
      {
        heading: 'Warehouse Management',
        items: [
          {
            label: 'Settings',
            href: routes.inventory.settings,
            icon: <PiGearDuotone />,
          },
          {
            label: 'Warehouses',
            href: routes.warehouses.list,
            icon: <PiBuildingsDuotone />,
          },
          {
            label: 'Operation Types',
            href: routes.inventory.operationTypes,
            icon: <PiSwapDuotone />,
          },
          {
            label: 'Locations',
            href: routes.inventory.configLocations,
            icon: <PiMapPinDuotone />,
          },
          {
            label: 'Storage Categories',
            href: routes.inventory.storageCategories,
            icon: <PiStackDuotone />,
          },
          {
            label: 'Putaway Rules',
            href: routes.inventory.putawayRules,
            icon: <PiSignpostDuotone />,
          },
        ],
      },
      {
        heading: 'Products',
        items: [
          {
            label: 'Categories',
            href: routes.eCommerce.categories,
            icon: <PiTagDuotone />,
          },
          {
            label: 'Attributes',
            href: routes.inventory.attributes,
            icon: <PiWrenchDuotone />,
          },
        ],
      },
      {
        heading: 'Delivery',
        items: [
          {
            label: 'Delivery Methods',
            href: routes.inventory.deliveryMethods,
            icon: <PiTruckTrailerDuotone />,
          },
          {
            label: 'Package Types',
            href: routes.inventory.packageTypes,
            icon: <PiCubeTransparentDuotone />,
          },
          {
            label: 'Products',
            href: routes.eCommerce.subProducts,
            icon: <PiPackageDuotone />,
          },
        ],
      },
    ],
  },
];

function subItemsOf(item: NavItem): NavSubItem[] {
  if ('items' in item) return item.items;
  if ('sections' in item) return item.sections.flatMap((s) => s.items);
  return [];
}

export default function InventoryNavHeader() {
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
        href={routes.inventory.index}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Inventory</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDirectActive = 'href' in item && item.href === pathname;
          const isDropdownActive = subItemsOf(item).some(
            (s) => s.href !== '#' && pathname.startsWith(s.href)
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

          const flatItems = 'items' in item ? item.items : undefined;
          const columns: 1 | 2 = (flatItems?.length ?? 0) > 4 ? 2 : 1;

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
                  items={flatItems}
                  sections={'sections' in item ? item.sections : undefined}
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
