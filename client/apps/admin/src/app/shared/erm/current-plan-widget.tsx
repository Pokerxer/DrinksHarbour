import {
  PiCrownDuotone,
  PiCalendarDuotone,
  PiPackageDuotone,
  PiUsersDuotone,
} from 'react-icons/pi';
import type { ErmStatus } from '@/services/erm.service';

function UsageMeter({
  label,
  used,
  limit,
  Icon,
}: {
  label: string;
  used: number;
  limit: number | null;
  Icon: React.ElementType;
}) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const nearLimit = limit !== null && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <span
          className={`text-xs ${nearLimit ? 'font-semibold text-red-600' : 'text-gray-500'}`}
        >
          {used.toLocaleString()} /{' '}
          {limit === null ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-red-500' : 'bg-[#b20202]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  trialing:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  past_due: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

export default function CurrentPlanWidget({ status }: { status: ErmStatus }) {
  const renewDate = status.currentPeriodEnd ?? status.trialEndsAt;
  const renewLabel = renewDate
    ? new Date(renewDate).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <PiCrownDuotone className="h-6 w-6 text-[#b20202]" />
          <div>
            <p className="text-xs text-gray-500">Current plan</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {status.planLabel}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status.subscriptionStatus] ?? STATUS_STYLES.canceled}`}
        >
          {status.subscriptionStatus.replace('_', ' ')}
        </span>
      </div>

      {renewLabel && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
          <PiCalendarDuotone className="h-4 w-4 shrink-0" />
          {status.subscriptionStatus === 'trialing'
            ? `Trial ends ${renewLabel}`
            : `Renews ${renewLabel}`}
        </p>
      )}

      <div className="space-y-3">
        <UsageMeter
          label="Products (SKUs)"
          used={status.usage.skus.used}
          limit={status.usage.skus.limit}
          Icon={PiPackageDuotone}
        />
        <UsageMeter
          label="Staff users"
          used={status.usage.staff.used}
          limit={status.usage.staff.limit}
          Icon={PiUsersDuotone}
        />
      </div>

      <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Marketplace commission:{' '}
        <span className="font-semibold">{status.commissionRate}%</span>
      </div>
    </div>
  );
}
