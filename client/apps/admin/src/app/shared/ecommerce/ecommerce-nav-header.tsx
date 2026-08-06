'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import { PiCaretDown } from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel from '@/app/shared/nav-dropdown-panel';
import { useTenant } from '@/context/TenantContext';
import { TENANT_ROLES } from '@/types/authorization';
import {
  getEcommerceNavItems,
} from '@/app/shared/ecommerce/ecommerce-nav-items';

export default function EcommerceNavHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { tenant } = useTenant();

  const role = session?.user?.role ?? '';
  // Tenant accent color — the sidebar highlights in the tenant's brand color;
  // the top bar used to hardcode the platform red, which clashed on subdomains.
  const accentColor = tenant?.primaryColor || '#b20202';

  const navItems = getEcommerceNavItems({ role, plan: tenant?.plan });

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

  const isTenantUser = TENANT_ROLES.includes(role as any);
  const brandLabel = isTenantUser ? 'Store' : 'Marketplace';

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex items-center border-b border-muted bg-gray-0"
      style={{ ['--nav-accent' as string]: accentColor }}
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
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--nav-accent)]';

          if ('href' in item && item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors sm:px-4 ${
                  isActive
                    ? `${activeCls} text-[var(--nav-accent)]`
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
                    ? `${activeCls} text-[var(--nav-accent)]`
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
