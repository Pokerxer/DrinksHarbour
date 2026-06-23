// @ts-nocheck
'use client';

import Link from 'next/link';
import Image from 'next/image';
import HamburgerButton from '@/layouts/hamburger-button';
import Sidebar from '@/layouts/hydrogen/sidebar';
import Logo from '@core/components/logo';
import HeaderMenuRight from '@/layouts/header-menu-right';
import StickyHeader from '@/layouts/sticky-header';
import SearchWidget from '@/app/shared/search/search';
import { useHydrogenSidebar } from '@/layouts/hydrogen/hydrogen-sidebar-utils';
import { useTenant } from '@/context/TenantContext';
import { PiListBold } from 'react-icons/pi';

export default function Header() {
  const { expanded, setExpanded } = useHydrogenSidebar();
  const { tenant, isMainSite } = useTenant();

  const accentColor = tenant?.primaryColor || '#dc2626';

  return (
    <StickyHeader className="z-[990] 2xl:py-5 3xl:px-8 4xl:px-10">
      <div className="flex w-full max-w-2xl items-center">
        {/* Mobile: hamburger opens sidebar drawer */}
        {expanded ? (
          <HamburgerButton
            view={<Sidebar className="static w-full 2xl:w-full" />}
          />
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="me-3 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all xl:hidden"
            aria-label="Open sidebar"
          >
            <PiListBold className="h-5 w-5" />
          </button>
        )}

        {/* Desktop: toggle sidebar */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="hidden xl:flex me-3 h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
            aria-label="Open sidebar"
          >
            <PiListBold className="h-5 w-5" />
          </button>
        )}

        {/* Mobile logo — shown when sidebar is closed */}
        <Link
          href="/"
          aria-label="Logo"
          className="me-4 shrink-0 xl:hidden"
        >
          {isMainSite ? (
            <Logo iconOnly className="w-9 text-gray-800 hover:text-gray-900" />
          ) : tenant?.logo?.url ? (
            <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={tenant.logo.url}
                alt={tenant.logo.alt || tenant.name}
                fill
                className="object-contain"
              />
            </div>
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {tenant?.name?.charAt(0)?.toUpperCase() ?? 'T'}
            </div>
          )}
        </Link>

        <SearchWidget />
      </div>

      <HeaderMenuRight />
    </StickyHeader>
  );
}
