'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import { PiCaretDown, PiList } from 'react-icons/pi';
import { usePOSAuth } from './store';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel from '@/app/shared/nav-dropdown-panel';
import MobileNavMenu, {
  activeMobileNavLabel,
} from '@/app/shared/warehouses/mobile-nav-menu';
import ShopSelector from './components/pos-shop-selector';
import { navItems } from './pos-nav-items';

export default function POSNavHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { token: posToken } = usePOSAuth();
  const adminToken = (session?.user as { token?: string })?.token ?? null;
  const token = adminToken ?? posToken ?? '';

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        close();
        closeMobile();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [close, closeMobile]);

  useEffect(() => {
    close();
    closeMobile();
  }, [pathname, close, closeMobile]);

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex shrink-0 flex-wrap items-center border-b border-muted bg-gray-0"
    >
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.pos.index}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-3 sm:pr-5"
      >
        <Image
          src="/logo-short.png"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden text-sm font-semibold text-gray-900 sm:inline">
          Point of Sale
        </span>
      </Link>

      {/* Shop selector */}
      {token && <ShopSelector token={token} />}

      <div className="ml-auto flex min-w-0 items-center pr-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          aria-expanded={mobileOpen}
          aria-controls="pos-mobile-menu"
          aria-label="Point of Sale menu"
          className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${mobileOpen ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <PiList className="h-4 w-4 shrink-0" />
          <span className="max-w-[64px] truncate min-[380px]:max-w-[80px] sm:max-w-none">
            {activeMobileNavLabel(navItems, pathname) ?? 'Menu'}
          </span>
        </button>
      </div>

      {/* Nav links */}
      <div className="hidden min-w-0 flex-1 flex-wrap items-center pl-2 md:flex md:basis-full xl:basis-auto">
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
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors md:px-4 ${
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
                aria-expanded={isOpen}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors md:px-4 ${
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
      <MobileNavMenu
        items={navItems}
        open={mobileOpen}
        onClose={closeMobile}
        id="pos-mobile-menu"
      />
    </nav>
  );
}
