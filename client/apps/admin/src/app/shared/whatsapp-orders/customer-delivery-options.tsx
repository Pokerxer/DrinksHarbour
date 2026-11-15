'use client';

import type { WhatsAppDeliveryAddress } from '@/services/whatsapp-order.service';
import type { DeliveryDraft } from './delivery-card';
import type useCustomerContext from './use-customer-context';

export default function CustomerDeliveryOptions({
  customer,
  onApply,
}: {
  customer: ReturnType<typeof useCustomerContext>;
  onApply: (draft: DeliveryDraft) => void;
}) {
  const addresses = customer.context?.addresses ?? [];
  if (customer.loading)
    return (
      <p role="status" className="text-xs text-gray-500">
        Loading saved addresses…
      </p>
    );
  if (customer.failed)
    return (
      <p className="text-xs text-gray-600">
        Could not refresh saved addresses.{' '}
        <button
          type="button"
          className="font-semibold text-brand"
          onClick={customer.retry}
        >
          Retry
        </button>
      </p>
    );
  if (!addresses.length) return null;

  function apply(address: WhatsAppDeliveryAddress) {
    const { address: street, state, lga, country, zipCode, pin } = address;
    onApply({ address: street, state, lga, country, zipCode, pin });
  }

  return (
    <div className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <label
        htmlFor="wa-saved-delivery"
        className="block text-xs font-semibold text-gray-700"
      >
        Reuse a delivery address
      </label>
      <select
        id="wa-saved-delivery"
        className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
        value=""
        onChange={(event) => {
          const address = addresses.find(
            (row) => row.id === event.target.value
          );
          if (address) apply(address);
        }}
      >
        <option value="">Choose a saved or previous address…</option>
        {addresses.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label} · {row.address} · {row.lga || row.state}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">
        Choosing an address recalculates the delivery fee.
      </p>
    </div>
  );
}
