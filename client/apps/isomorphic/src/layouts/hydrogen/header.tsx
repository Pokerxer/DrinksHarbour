// @ts-nocheck
'use client';

import Link from 'next/link';
import HamburgerButton from '@/layouts/hamburger-button';
import Sidebar from '@/layouts/hydrogen/sidebar';
import Logo from '@core/components/logo';
import HeaderMenuRight from '@/layouts/header-menu-right';
import StickyHeader from '@/layouts/sticky-header';
import SearchWidget from '@/app/shared/search/search';
import { useHydrogenSidebar } from '@/layouts/hydrogen/hydrogen-sidebar-utils';
import { PiListBold } from 'react-icons/pi';

export default function Header() {
  const { expanded, setExpanded } = useHydrogenSidebar();

  return (
    <StickyHeader className="z-[990] 2xl:py-5 3xl:px-8 4xl:px-10">
      <div className="flex w-full max-w-2xl items-center">
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
        
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="hidden xl:flex me-3 h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
            aria-label="Open sidebar"
          >
            <PiListBold className="h-5 w-5" />
          </button>
        )}
        
        <Link
          href={'/'}
          aria-label="Site Logo"
          className="me-4 w-9 shrink-0 text-gray-800 hover:text-gray-900 lg:me-5 xl:hidden"
        >
          <Logo iconOnly={true} />
        </Link>

        <SearchWidget />
      </div>

      <HeaderMenuRight />
    </StickyHeader>
  );
}
