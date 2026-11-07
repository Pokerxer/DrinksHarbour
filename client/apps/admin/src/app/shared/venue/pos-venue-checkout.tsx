'use client';
import VenueCheckout from './venue-checkout';
import { venueCartLines } from '@/services/venue/cart-lines';
import { saveCheckoutLines } from '@/services/venue/checkout-lines';
import { usePOSAuth, usePOSCart, usePOSUI } from '@/app/shared/point-of-sale/store';
export default function POSVenueCheckout() {
  const { token } = usePOSAuth();
  const { items, tableBinding, bindTable, clearCart, unbindTable, discountValue, appliedRewards } = usePOSCart();
  const { setActiveView } = usePOSUI();
  if (!token || !tableBinding?.serviceSessionId)
    return (
      <div className="p-6">
        <p
          role="alert"
          className="max-w-md rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <strong>Table payment unavailable.</strong> Reopen this table online
          before taking payment, then return to this checkout.
        </p>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
      <VenueCheckout token={token} sessionId={tableBinding.serviceSessionId} mode="pos" prepare={async () => {
    if (tableBinding.version === undefined) throw new Error('Reload this table before taking payment.');
    const result = await saveCheckoutLines(token, tableBinding.serviceSessionId!, { expectedVersion: tableBinding.version, lines: venueCartLines(items, discountValue, appliedRewards) }, 'pos');
    bindTable({ ...tableBinding, version: result.version, lineVersion: result.lineVersion });
  }} onSettled={() => { clearCart(); unbindTable(); setActiveView('sell'); }} />
      <button onClick={() => setActiveView('sell')} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-gray-700 underline transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-gray-200 dark:hover:text-white">
        Back to table
      </button>
    </div>
  );
}
