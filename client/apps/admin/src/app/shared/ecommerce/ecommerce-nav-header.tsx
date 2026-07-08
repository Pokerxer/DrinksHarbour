'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import {
  PiCaretDown,
  PiStorefrontDuotone,
  PiPackageDuotone,
  PiReceiptDuotone,
  PiUsersThreeDuotone,
  PiGearSixDuotone,
  PiStackDuotone,
  PiCashRegisterDuotone,
  PiIdentificationCardDuotone,
  PiSlidersHorizontalDuotone,
  PiUserGearDuotone,
  PiTagDuotone,
  PiStarDuotone,
  PiMegaphoneDuotone,
  PiBuildingsDuotone,
  PiChartLineUpDuotone,
  PiGaugeDuotone,
} from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, {
  type NavSubItem,
} from '@/app/shared/nav-dropdown-panel';
import { TENANT_ROLES } from '@/types/authorization';

type NavItem =
  | { label: string; href: string; icon: React.ReactNode; items?: never }
  | { label: string; href?: never; icon: React.ReactNode; items: NavSubItem[] };

// ── Tenant nav: store operators running their branded subdomain ──────────────
const tenantNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: routes.eCommerce.dashboard,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Orders',
    href: routes.eCommerce.orders,
    icon: <PiReceiptDuotone />,
  },
  {
    label: 'Sub-Products',
    icon: <PiPackageDuotone />,
    items: [
      {
        label: 'My Sub-Products',
        href: routes.eCommerce.subProducts,
        icon: <PiPackageDuotone />,
        desc: 'Your sellable stock instances',
      },
      {
        label: 'Add Sub-Product',
        href: routes.eCommerce.createSubProduct,
        icon: <PiPackageDuotone />,
        desc: 'Link to a catalog product or create new',
      },
    ],
  },
  {
    label: 'Inventory',
    icon: <PiStackDuotone />,
    items: [
      {
        label: 'Categories',
        href: routes.eCommerce.categories,
        icon: <PiTagDuotone />,
      },
      {
        label: 'Brands',
        href: routes.eCommerce.brands,
        icon: <PiTagDuotone />,
      },
      {
        label: 'Banners',
        href: routes.eCommerce.banners,
        icon: <PiMegaphoneDuotone />,
        desc: 'Storefront promotional banners',
      },
    ],
  },
  {
    label: 'Point of Sale',
    icon: <PiCashRegisterDuotone />,
    items: [
      {
        label: 'POS Dashboard',
        href: routes.pos.index,
        icon: <PiCashRegisterDuotone />,
        desc: 'Terminal overview',
      },
      {
        label: 'Cashiers',
        href: routes.pos.cashiers,
        icon: <PiIdentificationCardDuotone />,
        desc: 'POS staff & PINs',
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiGearSixDuotone />,
    items: [
      {
        label: 'Account Settings',
        href: routes.forms.profileSettings,
        icon: <PiUserGearDuotone />,
        desc: 'Your profile & security',
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: <PiSlidersHorizontalDuotone />,
        desc: 'Workspace settings',
      },
    ],
  },
];

// ── Platform admin nav: super-admin / admin running the central marketplace ──
const adminNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: routes.eCommerce.dashboard,
    icon: <PiGaugeDuotone />,
  },
  {
    label: 'Products',
    icon: <PiPackageDuotone />,
    items: [
      {
        label: 'Central Catalog',
        href: routes.eCommerce.products,
        icon: <PiPackageDuotone />,
        desc: 'Single source of truth for products',
      },
      {
        label: 'Add Product',
        href: routes.eCommerce.createProduct,
        icon: <PiPackageDuotone />,
      },
      {
        label: 'Sub-Products',
        href: routes.eCommerce.subProducts,
        icon: <PiStackDuotone />,
        desc: 'Tenant-owned selling instances',
      },
      {
        label: 'Categories',
        href: routes.eCommerce.categories,
        icon: <PiTagDuotone />,
      },
      {
        label: 'Brands',
        href: routes.eCommerce.brands,
        icon: <PiTagDuotone />,
      },
    ],
  },
  {
    label: 'Tenants',
    href: routes.eCommerce.tenants,
    icon: <PiBuildingsDuotone />,
  },
  {
    label: 'Orders',
    href: routes.eCommerce.orders,
    icon: <PiReceiptDuotone />,
  },
  {
    label: 'Engagement',
    icon: <PiStarDuotone />,
    items: [
      {
        label: 'Reviews',
        href: routes.eCommerce.reviews,
        icon: <PiStarDuotone />,
      },
      {
        label: 'Promotions',
        href: routes.eCommerce.promotions,
        icon: <PiMegaphoneDuotone />,
      },
      {
        label: 'Banners',
        href: routes.eCommerce.banners,
        icon: <PiMegaphoneDuotone />,
      },
    ],
  },
  {
    label: 'Configuration',
    icon: <PiGearSixDuotone />,
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: <PiSlidersHorizontalDuotone />,
        desc: 'Platform settings',
      },
      {
        label: 'Analytics',
        href: routes.analytics,
        icon: <PiChartLineUpDuotone />,
      },
    ],
  },
];

export default function EcommerceNavHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? '';
  const isTenantUser = TENANT_ROLES.includes(role as any);

  const navItems = isTenantUser ? tenantNavItems : adminNavItems;

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

  const brandLabel = isTenantUser ? 'Store' : 'Marketplace';

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex items-center border-b border-gray-200 bg-white"
    >
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.eCommerce.dashboard}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-3 sm:pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden text-sm font-semibold text-gray-900 sm:inline">
          {brandLabel}
        </span>
      </Link>

      {/* Nav links — horizontally scrollable on mobile */}
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto pl-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          const activeCls =
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

          if ('href' in item && item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors sm:px-4 ${
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

          const columns = (item.items?.length ?? 0) > 4 ? 2 : 1;

          return (
            <div key={item.label} className="lg:relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors sm:px-4 ${
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
                  columns={columns as 1 | 2}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
