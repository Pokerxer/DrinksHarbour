'use client';

import Link from 'next/link';
import { useTenant } from '@/context/TenantContext';
import { PiStorefrontDuotone, PiArrowRightBold, PiCheckCircleFill, PiWarningCircleFill } from 'react-icons/pi';

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  active:      { dot: 'bg-green-500',  label: 'Active' },
  trialing:    { dot: 'bg-blue-500',   label: 'Trial' },
  past_due:    { dot: 'bg-amber-500',  label: 'Past Due' },
  canceled:    { dot: 'bg-red-500',    label: 'Canceled' },
  suspended:   { dot: 'bg-red-600',    label: 'Suspended' },
};

export default function TenantBanner() {
  const { tenant, isMainSite, tenantSlug } = useTenant();

  if (isMainSite || !tenant) return null;

  const planLabel = tenant.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : 'Unknown';

  const subStatus = tenant.subscriptionStatus?.toLowerCase() ?? 'active';
  const statusStyle = STATUS_STYLES[subStatus] ?? { dot: 'bg-gray-400', label: subStatus };
  const isPastDue = subStatus === 'past_due';
  const isSuspended = subStatus === 'suspended' || subStatus === 'canceled';

  return (
    <div
      className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        isSuspended
          ? 'border-red-200 bg-red-50'
          : isPastDue
          ? 'border-amber-200 bg-amber-50'
          : 'border-blue-100 bg-blue-50'
      }`}
    >
      {/* Left: icon + info */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: tenant.primaryColor || '#dc2626' }}
        >
          {tenant.logo?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo.url}
              alt={tenant.logo.alt || tenant.name}
              className="h-9 w-9 rounded-lg object-contain"
            />
          ) : (
            <PiStorefrontDuotone className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</span>
            {tenantSlug && (
              <span className="rounded bg-gray-200/80 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                {tenantSlug}.drinksharbour.com
              </span>
            )}
            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 ring-1 ring-gray-200">
              {planLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            <span className="text-xs text-gray-500">{statusStyle.label}</span>
            {isPastDue && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-amber-700">
                <PiWarningCircleFill className="h-3.5 w-3.5" /> Payment overdue
              </span>
            )}
            {subStatus === 'active' && (
              <span className="flex items-center gap-0.5 text-xs text-green-700">
                <PiCheckCircleFill className="h-3.5 w-3.5" /> Subscription active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: settings link — platform admins go to tenant management, tenant users go to profile settings */}
      <Link
        href={isMainSite ? "/tenants" : "/forms/profile-settings"}
        className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 transition-all hover:bg-gray-50 hover:ring-gray-300"
      >
        Settings
        <PiArrowRightBold className="h-3 w-3" />
      </Link>
    </div>
  );
}
