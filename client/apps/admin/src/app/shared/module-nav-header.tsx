// @ts-nocheck
'use client';

/**
 * Generic POS-style navigation header for modules that had none.
 *
 * Same chrome as pos-nav-header/catalog-nav-header: app launcher, logo +
 * brand block, flat tabs with the red active underline.
 *
 * Responsive behaviour (shared rules across ALL module headers):
 * - brand text hides below ~480px (logo stays)
 * - below `md` the tab strip is replaced by a single Menu button that opens
 *   every destination in a dropdown (inventory/warehouses/ecommerce pattern)
 * - the tab strip returns and wraps softly at `md` and up
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { activeModuleHref } from './module-nav-active';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PiList } from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import MobileNavMenu, {
  activeMobileNavLabel,
} from '@/app/shared/warehouses/mobile-nav-menu';

export interface ModuleNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function ModuleNavHeader({
  brand,
  brandHref,
  tabs,
}: {
  brand: string;
  brandHref?: string;
  tabs: ModuleNavItem[];
}) {
  const pathname = usePathname();
  const home = brandHref ?? tabs[0]?.href ?? '/';

  const activeHref = activeModuleHref(pathname, tabs.map(tab => tab.href));

  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        closeMobile();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [closeMobile]);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const mobileItems = tabs.map((tab) => ({
    label: tab.label,
    href: tab.href,
    icon: tab.icon,
  }));

  return (
    <nav
      ref={navRef}
      className="relative mb-0 flex flex-wrap items-center border-b border-gray-200 bg-white"
    >
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={home}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.png"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden min-[480px]:inline text-sm font-semibold text-gray-900">
          {brand}
        </span>
      </Link>

      {/* Mobile menu button — replaces the wrapping tab strip below md */}
      <div className="ml-auto flex items-center pr-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="module-mobile-menu"
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
            mobileOpen
              ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <PiList className="h-4 w-4" />
          <span>
            {activeMobileNavLabel(mobileItems, pathname) ?? 'Menu'}
          </span>
        </button>
      </div>

      {/* Tabs — visible from md up; on mobile the Menu button above */}
      <div className="hidden min-w-0 flex-1 flex-wrap items-center pl-2 md:flex">
        {tabs.map((tab) => {
          const active = activeHref === tab.href;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm transition-colors md:px-4 ${
                active
                  ? 'font-semibold text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]'
                  : 'font-normal text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile dropdown: all destinations behind the Menu button */}
      <MobileNavMenu
        items={mobileItems}
        open={mobileOpen}
        onClose={closeMobile}
        id="module-mobile-menu"
      />
    </nav>
  );
}