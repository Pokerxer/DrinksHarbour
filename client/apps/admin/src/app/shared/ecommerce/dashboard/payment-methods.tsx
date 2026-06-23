// @ts-nocheck
'use client';

import WidgetCard from '@core/components/cards/widget-card';
import cn from '@core/utils/class-names';
import { useDashboard } from './use-dashboard';
import {
  PiHandCoinsDuotone,
  PiBankDuotone,
  PiCreditCardDuotone,
  PiDeviceMobileDuotone,
  PiWalletDuotone,
  PiQuestionDuotone,
} from 'react-icons/pi';

interface MethodMeta { label: string; Icon: React.ElementType; bg: string; text: string; bar: string }

const METHOD_META: Record<string, MethodMeta> = {
  cash_on_delivery: { label: 'Cash on Delivery', Icon: PiHandCoinsDuotone,  bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600',  bar: 'bg-amber-400' },
  cod:              { label: 'Cash on Delivery', Icon: PiHandCoinsDuotone,  bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-600',  bar: 'bg-amber-400' },
  bank_transfer:    { label: 'Bank Transfer',    Icon: PiBankDuotone,       bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600',   bar: 'bg-blue-400'  },
  bank:             { label: 'Bank Transfer',    Icon: PiBankDuotone,       bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-600',   bar: 'bg-blue-400'  },
  card:             { label: 'Card',             Icon: PiCreditCardDuotone, bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600', bar: 'bg-violet-400'},
  mobile_money:     { label: 'Mobile Money',     Icon: PiDeviceMobileDuotone,bg:'bg-green-50 dark:bg-green-900/20',   text: 'text-green-600',  bar: 'bg-green-400' },
  wallet:           { label: 'Wallet',           Icon: PiWalletDuotone,     bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600', bar: 'bg-indigo-400'},
};

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 py-2">
      <div className="h-9 w-9 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-gray-200" />
        <div className="h-2 w-full rounded bg-gray-100" />
      </div>
      <div className="h-4 w-12 rounded bg-gray-200" />
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

export default function PaymentMethods({ className }: { className?: string }) {
  const data = useDashboard();
  const breakdown = data?.paymentBreakdown ?? [];

  const total = breakdown.reduce((s, p) => s + p.count, 0);

  return (
    <WidgetCard
      title="Payment Methods"
      description="This month's orders"
      descriptionClassName="text-gray-500 mt-0.5"
      className={className}
    >
      {!data ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : breakdown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <PiCreditCardDuotone className="mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">No payment data yet</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {breakdown.map(item => {
            const meta = METHOD_META[item.method] ?? { label: item.method, Icon: PiQuestionDuotone, bg: 'bg-gray-100', text: 'text-gray-500', bar: 'bg-gray-400' };
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div key={item.method} className="flex items-center gap-3">
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', meta.bg)}>
                  <meta.Icon className={cn('h-5 w-5', meta.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 truncate">{meta.label}</span>
                    <span className="ms-2 shrink-0 text-xs text-gray-500">{item.count} orders · {pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', meta.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{fmt(item.total)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
