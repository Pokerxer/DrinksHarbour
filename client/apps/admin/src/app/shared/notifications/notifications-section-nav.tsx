'use client';
import Link from 'next/link';
import Image from 'next/image';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  notificationPages,
  canOpenNotificationPage,
} from '@/config/notification-pages';
import { useEffectivePermissions } from '@/hooks/use-effective-permissions';
export default function NotificationsSectionNav() {
  const pathname = usePathname(),
    { data: session } = useSession();
  const permissions = useEffectivePermissions(session?.user?.token);
  return (
    <nav
      aria-label="Notification features"
      className="mb-0 flex flex-wrap items-center border-b border-muted bg-gray-0"
    >
      <LauncherButton className="me-1 ms-3 shadow-none" />
      <Link
        href="/notifications"
        aria-label="Notifications home"
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pr-4"
      >
        <Image
          src="/logo-short.png"
          alt="DrinksHarbour"
          width={30}
          height={30}
          className="rounded-full"
        />
        <span className="hidden text-sm font-semibold text-gray-900 sm:inline">
          Notifications
        </span>
      </Link>
      <div className="flex min-w-0 basis-full gap-1 overflow-x-auto pl-2 xl:flex-1 xl:basis-auto">
        {notificationPages
          .filter((p) =>
            canOpenNotificationPage(
              p.href,
              session?.user?.role,
              permissions?.customPermissions || []
            )
          )
          .map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={pathname === p.href ? 'page' : undefined}
              className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-sm transition-colors ${pathname === p.href ? 'font-semibold text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]' : 'font-normal text-gray-600 hover:text-gray-900'}`}
            >
              {p.label}
            </Link>
          ))}
      </div>
    </nav>
  );
}
