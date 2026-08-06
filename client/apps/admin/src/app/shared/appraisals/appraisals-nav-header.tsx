'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiClipboardTextDuotone,
  PiUsersThreeDuotone,
  PiCalendarDotsDuotone,
  PiSquaresFourDuotone,
} from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /**
   * Custom active predicate. Used by the overview link: /appraisals is the
   * prefix of every other appraisal route, and bare prefix matching would
   * light it up on team/cycles/templates. This matches the overview plus its
   * detail routes (/appraisals/[id], /appraisals/reviews/...) while leaving
   * the sibling sections to their own links.
   */
  match?: (pathname: string) => boolean;
};

const SIBLING_SEGMENTS = ['team', 'cycles', 'templates'];

const navItems: NavItem[] = [
  {
    label: 'My Appraisals',
    href: '/appraisals',
    icon: <PiClipboardTextDuotone />,
    match: (p) =>
      p === '/appraisals' ||
      (p.startsWith('/appraisals/') &&
        !SIBLING_SEGMENTS.some((seg) => p.startsWith(`/appraisals/${seg}`))),
  },
  {
    label: 'My Team',
    href: '/appraisals/team',
    icon: <PiUsersThreeDuotone />,
  },
  {
    label: 'Cycles',
    href: '/appraisals/cycles',
    icon: <PiCalendarDotsDuotone />,
  },
  {
    label: 'Templates',
    href: '/appraisals/templates',
    icon: <PiSquaresFourDuotone />,
  },
];

/**
 * Section chrome for every /appraisals/* route, mirroring POSNavHeader: an
 * app launcher, the section brand, and the appraisal pages' nav links.
 * Rendered once by the (hydrogen)/appraisals layout so it stays visible
 * across the overview, team, cycles, templates and detail pages.
 */
export default function AppraisalsNavHeader() {
  const pathname = usePathname();

  const activeCls =
    'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

  return (
    <nav className="relative mb-0 flex items-center border-b border-gray-200 bg-white">
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href="/appraisals"
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="text-sm font-semibold text-gray-900">Appraisals</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center overflow-x-auto pl-2">
        {navItems.map((item) => {
          const isActive = item.match
            ? item.match(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm transition-colors ${
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
