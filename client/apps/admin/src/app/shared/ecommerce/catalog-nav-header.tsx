'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { routes } from '@/config/routes';
import {
  PiImageDuotone,
  PiListBulletsDuotone,
  PiStorefrontDuotone,
  PiTagDuotone,
} from 'react-icons/pi';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: 'Categories', href: routes.eCommerce.categories, icon: <PiTagDuotone /> },
  {
    label: 'Sub-Categories',
    href: routes.eCommerce.subCategories,
    icon: <PiListBulletsDuotone />,
  },
  { label: 'Brands', href: routes.eCommerce.brands, icon: <PiStorefrontDuotone /> },
  { label: 'Banners', href: routes.eCommerce.banners, icon: <PiImageDuotone /> },
];

/**
 * Section chrome for the catalog pages (/categories, /sub-categories, /brands,
 * /banners), mirroring SupportNavHeader/POSNavHeader: app launcher, section
 * brand, and the catalog nav links. Rendered once per route tree by the
 * per-section layouts so create/edit/detail pages share the same chrome.
 */
export default function CatalogNavHeader() {
  const pathname = usePathname();

  const activeCls =
    'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

  return (
    <nav className="relative mb-0 flex flex-wrap items-center border-b border-gray-200 bg-white">
      {/* App launcher toggle */}
      <LauncherButton className="me-1 ms-3 shadow-none" />

      {/* Brand */}
      <Link
        href={routes.eCommerce.categories}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-5"
      >
        <Image
          src="/logo-short.svg"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden min-[480px]:inline text-sm font-semibold text-gray-900">Catalog</span>
      </Link>

      {/* Nav links */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center pl-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
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
