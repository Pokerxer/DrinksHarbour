'use client';

import { useState } from 'react';
import { Button } from 'rizzui/button';
import {
  PiPlusBold,
  PiWarehouseDuotone,
  PiStorefrontDuotone,
} from 'react-icons/pi';
import { subscribeAddOn, cancelAddOn } from '@/services/erm.service';
import type { ErmAddOn, ErmAddOnType, ErmStatus } from '@/services/erm.service';

const ADD_ON_ICONS: Record<ErmAddOnType, React.ElementType> = {
  extra_warehouse: PiWarehouseDuotone,
  extra_shop: PiStorefrontDuotone,
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

/**
 * Add-on quotas, and the buttons that actually change them.
 *
 * Until this existed, `Tenant.addOns[]` was written by nothing: the pricing
 * page sold extra shops and warehouses, the server enforced
 * `1 + sum(addOns[].quantity)`, and no code path could ever make that sum
 * anything but zero — so every tenant was capped at one of each however much
 * they paid.
 */
export default function AddOnsCard({
  status,
  token,
}: {
  status: ErmStatus;
  token: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(addOn: ErmAddOn) {
    if (status.canManageBilling !== true || !status.writesAllowed || busy) return;
    setBusy(`buy:${addOn.type}`);
    setError(null);
    try {
      const { authorizationUrl } = await subscribeAddOn(addOn.type, token);
      window.location.href = authorizationUrl;
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  async function handleCancel(addOn: ErmAddOn) {
    if (status.canManageBilling !== true || busy) return;
    if (
      !confirm(
        `Cancel one ${addOn.label.toLowerCase()}? You will lose the slot at the end of the billing period.`
      )
    )
      return;
    setBusy(`cancel:${addOn.type}`);
    setError(null);
    try {
      await cancelAddOn(addOn.type, token);
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Add-ons
        </h2>
        <span className="text-xs text-gray-500">First of each is free</span>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        {status.addOnsAllowed
          ? 'Each extra unit is billed as its own subscription and can be cancelled on its own.'
          : `The ${status.planLabel} plan includes one of each. Upgrade to Pro or above to buy more.`}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {status.addOns.map((addOn) => {
          const Icon = ADD_ON_ICONS[addOn.type];
          const atLimit = addOn.used >= addOn.allowance;

          return (
            <li
              key={addOn.type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
            >
              <div className="flex items-center gap-3">
                {Icon && <Icon className="h-5 w-5 shrink-0 text-[#b20202]" />}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {addOn.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNaira(addOn.priceMonthly)}/mo · using {addOn.used} of{' '}
                    {addOn.allowance}
                    {addOn.purchased > 0 && ` · ${addOn.purchased} paid`}
                    {!!addOn.pendingCancellation && ` · ${addOn.pendingCancellation} cancellation pending`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {status.canManageBilling === true && addOn.purchased > (addOn.pendingCancellation ?? 0) && (
                  <Button
                    size="sm"
                    variant="text"
                    className="text-red-600"
                    isLoading={busy === `cancel:${addOn.type}`}
                    disabled={busy !== null}
                    onClick={() => handleCancel(addOn)}
                  >
                    Remove one
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={busy === `buy:${addOn.type}`}
                  disabled={busy !== null || !status.addOnsAllowed || !status.writesAllowed || status.canManageBilling !== true}
                  onClick={() => handleBuy(addOn)}
                >
                  <PiPlusBold className="me-1.5 h-3 w-3" />
                  {atLimit ? 'Add a slot' : 'Buy another'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
