// @ts-nocheck
'use client';

import { Title, Text, Avatar, Button, Popover } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import {
  PiUserDuotone,
  PiGearDuotone,
  PiStorefrontDuotone,
  PiSignOutDuotone,
} from 'react-icons/pi';

export default function ProfileMenu({
  buttonClassName,
  avatarClassName,
  username = false,
}: {
  buttonClassName?: string;
  avatarClassName?: string;
  username?: boolean;
}) {
  const { data: session } = useSession();
  const { tenant } = useTenant();

  const displayName =
    session?.user?.name ||
    [session?.user?.firstName, session?.user?.lastName].filter(Boolean).join(' ') ||
    session?.user?.email?.split('@')[0] ||
    'User';

  const avatarSrc = session?.user?.image || undefined;
  const accentColor = tenant?.primaryColor || '#3b82f6';

  return (
    <ProfileMenuPopover>
      <Popover.Trigger>
        <button
          className={cn(
            'w-9 shrink-0 rounded-full outline-none focus-visible:ring-[1.5px] focus-visible:ring-gray-400 focus-visible:ring-offset-2 active:translate-y-px sm:w-10',
            buttonClassName
          )}
        >
          <Avatar
            src={avatarSrc}
            name={displayName}
            className={cn('!h-9 w-9 sm:!h-10 sm:!w-10', avatarClassName)}
          />
          {!!username && (
            <span className="username hidden text-gray-200 dark:text-gray-700 md:inline-flex">
              Hi, {displayName.split(' ')[0]}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Content className="z-[9999] p-0 dark:bg-gray-100 [&>svg]:dark:fill-gray-100">
        <DropdownMenu
          displayName={displayName}
          email={session?.user?.email}
          avatarSrc={avatarSrc}
          tenant={tenant}
          accentColor={accentColor}
        />
      </Popover.Content>
    </ProfileMenuPopover>
  );
}

function ProfileMenuPopover({ children }: React.PropsWithChildren<{}>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <Popover isOpen={isOpen} setIsOpen={setIsOpen} shadow="sm" placement="bottom-end">
      {children}
    </Popover>
  );
}

function DropdownMenu({
  displayName,
  email,
  avatarSrc,
  tenant,
  accentColor,
}: {
  displayName: string;
  email?: string | null;
  avatarSrc?: string;
  tenant: ReturnType<typeof useTenant>['tenant'];
  accentColor: string;
}) {
  const menuItems = [
    { name: 'My Profile', href: routes.profile, icon: <PiUserDuotone className="h-4 w-4" /> },
    { name: 'Account Settings', href: routes.forms.profileSettings, icon: <PiGearDuotone className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 text-left rtl:text-right">
      {/* User info header */}
      <div className="flex items-center border-b border-gray-200 px-5 pb-4 pt-5">
        <Avatar src={avatarSrc} name={displayName} className="h-10 w-10 flex-shrink-0" />
        <div className="ms-3 min-w-0">
          <Title as="h6" className="truncate text-sm font-semibold text-gray-900">
            {displayName}
          </Title>
          {email && (
            <Text className="truncate text-xs text-gray-500">{email}</Text>
          )}
        </div>
      </div>

      {/* Tenant context badge (tenant users only) */}
      {tenant && (
        <div
          className="mx-3 mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}25` }}
        >
          <PiStorefrontDuotone className="h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold" style={{ color: accentColor }}>
              {tenant.name}
            </p>
            <p className="truncate text-[10px] text-gray-400">{tenant.slug}.drinksharbour.com</p>
          </div>
        </div>
      )}

      {/* Nav links */}
      <div className="grid px-3 py-3 font-medium text-gray-700">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="group my-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-gray-100 focus:outline-none hover:dark:bg-gray-50/50"
          >
            <span className="text-gray-400 group-hover:text-gray-600">{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <div className="border-t border-gray-200 px-5 pb-5 pt-4">
        <Button
          className="flex h-auto w-full items-center gap-2.5 justify-start p-0 text-sm font-medium text-gray-700 outline-none hover:text-gray-900 focus-visible:ring-0"
          variant="text"
          onClick={() => signOut()}
        >
          <PiSignOutDuotone className="h-4 w-4 text-gray-400" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
