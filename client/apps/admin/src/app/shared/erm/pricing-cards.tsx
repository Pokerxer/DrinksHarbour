'use client';

import { PiCheckBold, PiArrowRightBold } from 'react-icons/pi';
import { Button } from 'rizzui/button';
import { Badge } from 'rizzui';
import type { ErmPlan } from '@/services/erm.service';

const FEATURE_LABELS: Record<string, string> = {
  inventory: 'Inventory management',
  orders: 'Order management',
  pos_single: 'Single-location POS',
  pos_multi: 'Multi-location POS',
  pos_realtime: 'Real-time POS + bar tab',
  sales_invoicing: 'Sales invoicing',
  crm_basic: 'Basic CRM',
  crm_advanced: 'Advanced CRM',
  purchase_orders: 'Purchase orders',
  multi_location: 'Multi-location & warehouses',
  advanced_reports: 'Advanced analytics',
  api_access: 'API access',
  custom_integrations: 'Custom integrations',
  priority_support: 'Priority support',
  table_management: 'Table management',
  event_booking: 'Event & booking management',
  bar_inventory: 'Bar & cellar inventory',
  guest_crm: 'Guest CRM & guest list',
};

export default function PricingCards({
  plans,
  currentPlan,
  onSelectPlan,
  loading,
  disabled = false,
  canReactivate = false,
}: {
  plans: ErmPlan[];
  currentPlan: string;
  onSelectPlan: (key: string) => void;
  loading: string | null;
  disabled?: boolean;
  canReactivate?: boolean;
}) {
  const paid = plans.filter(
    (p) => p.key !== 'free_trial' && p.key !== 'custom'
  );

  if (!paid.length)
    return (
      <p role="status" className="text-sm text-gray-600">
        Plans could not be loaded.{' '}
        <a href="/settings/billing" className="underline">
          Try again
        </a>
        .
      </p>
    );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {paid.map((plan) => {
        const isCurrent = plan.key === currentPlan;
        const isPopular = plan.key === 'growth';

        return (
          <div
            key={plan.key}
            className={`relative flex flex-col rounded-2xl border p-5 transition-shadow ${
              isPopular
                ? 'border-primary shadow-sm'
                : 'border-gray-200 dark:border-gray-700'
            } ${isCurrent ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}
          >
            {isPopular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                Popular
              </span>
            )}

            <div className="mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">
                {plan.label}
              </h3>
              <p className="mt-0.5 text-2xl font-extrabold text-gray-900 dark:text-white">
                ₦{plan.priceMonthly.toLocaleString('en-NG')}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {(plan.commissionRate * 100).toFixed(0)}% marketplace commission
              </p>
            </div>

            <ul className="mb-5 flex-1 space-y-1.5">
              <li className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {plan.skuLimit === null
                  ? 'Unlimited SKUs'
                  : `Up to ${plan.skuLimit} SKUs`}
              </li>
              <li className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {plan.staffLimit === null
                  ? 'Unlimited staff'
                  : `${plan.staffLimit} staff user${plan.staffLimit !== 1 ? 's' : ''}`}
              </li>
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                >
                  <PiCheckBold className="h-3 w-3 shrink-0 text-green-500" />
                  {FEATURE_LABELS[f] ?? f}
                </li>
              ))}
            </ul>

            {isCurrent && !canReactivate ? (
              <Badge className="w-full justify-center bg-gray-100 py-1.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Current plan
              </Badge>
            ) : (
              <Button
                size="sm"
                className={`w-full gap-1 ${isPopular ? 'bg-primary text-white hover:bg-primary-dark' : ''}`}
                variant={isPopular ? undefined : 'outline'}
                isLoading={loading === plan.key}
                disabled={disabled || loading !== null}
                onClick={() => onSelectPlan(plan.key)}
              >
                {isCurrent ? 'Reactivate' : 'Choose plan'}{' '}
                <PiArrowRightBold className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
