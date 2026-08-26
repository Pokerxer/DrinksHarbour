'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { routes } from '@/config/routes';
import {
  PiChatCircleDotsDuotone,
  PiFilesDuotone,
  PiUsersThreeDuotone,
} from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** True = active only on the exact path (the /support overview is also the
   *  prefix of every other support route, so prefix matching would light up
   *  "Customers" on every support page). */
  exact?: boolean;
};

const navItems: NavItem[] = [
  {
    label: 'Inbox',
    href: routes.support.inbox,
    icon: <PiChatCircleDotsDuotone />,
  },
  {
    label: 'Customers',
    href: routes.support.dashboard,
    icon: <PiUsersThreeDuotone />,
    exact: true,
  },
  {
    label: 'Snippets',
    href: routes.support.snippets,
    icon: <PiFilesDuotone />,
  },
];

/**
 * Section chrome for every /support/* route, mirroring POSNavHeader: an app
 * launcher, the section brand, and the support pages' nav links. Rendered once
 * by the (hydrogen)/support layout so it stays visible across the overview,
 * inbox, message detail and snippets pages.
 */
export default function SupportNavHeader() {
  const pathname = usePathname();

  const activeCls =
    'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

  return (
    <nav className="relative mb-0 flex flex-wrap items-center border-b border-gray-200 bg-white">
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.support.dashboard}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden min-[480px]:inline text-sm font-semibold text-gray-900">Support</span>
      </Link>

      {/* Nav links */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center pl-2">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        })}
      </div>
    </nav>
  );
}
