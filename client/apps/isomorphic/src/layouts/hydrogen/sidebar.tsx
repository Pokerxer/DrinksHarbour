// @ts-nocheck
'use client';

import Logo from '@core/components/logo';
import cn from '@core/utils/class-names';
import Link from 'next/link';
import Image from 'next/image';
import { SidebarMenu } from './sidebar-menu';
import { PiXBold } from 'react-icons/pi';
import { useTenant } from '@/context/TenantContext';

interface SidebarProps {
  className?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const PLAN_COLORS: Record<string, string> = {
  starter:      'bg-gray-100 text-gray-600',
  pro:          'bg-blue-100 text-blue-700',
  business:     'bg-purple-100 text-purple-700',
  enterprise:   'bg-amber-100 text-amber-700',
};

export default function Sidebar({ className, isExpanded, onToggle }: SidebarProps) {
  const { tenant, isMainSite } = useTenant();

  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : null;
  const planColor = PLAN_COLORS[tenant?.plan?.toLowerCase() ?? ''] ?? 'bg-gray-100 text-gray-600';

  return (
    <aside
      className={cn(
        'fixed bottom-0 start-0 z-50 h-full w-[270px] border-e-2 border-gray-100 bg-white dark:bg-gray-100/50 2xl:w-72 transition-transform duration-300',
        !isExpanded && 'xl:-translate-x-full',
        className
      )}
    >
      <div className="sticky top-0 z-40 flex items-center justify-between bg-gray-0/10 px-6 pb-5 pt-5 dark:bg-gray-100/5 2xl:px-8 2xl:pt-6">
        {isMainSite ? (
          /* ── Platform admin: standard DrinksHarbour logo ── */
          <Link
            href={'/'}
            aria-label="Site Logo"
            className="text-gray-800 hover:text-gray-900"
          >
            <Logo className="max-w-[155px]" />
          </Link>
        ) : (
          /* ── Tenant subdomain: show tenant branding ── */
          <Link href={'/'} aria-label="Tenant Logo" className="flex items-center gap-2.5 min-w-0">
            {tenant?.logo?.url ? (
              <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
                <Image
                  src={tenant.logo.url}
                  alt={tenant.logo.alt || tenant.name}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: tenant?.primaryColor || '#dc2626' }}
              >
                {tenant?.name?.charAt(0)?.toUpperCase() ?? 'T'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-gray-900">
                {tenant?.name}
              </p>
              {planLabel && (
                <span className={cn('mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold leading-none', planColor)}>
                  {planLabel}
                </span>
              )}
            </div>
          </Link>
        )}

        {onToggle && (
          <button
            onClick={onToggle}
            className="hidden xl:flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close sidebar"
          >
            <PiXBold className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="custom-scrollbar h-[calc(100%-80px)] overflow-y-auto">
        <SidebarMenu />
      </div>
    </aside>
  );
}
