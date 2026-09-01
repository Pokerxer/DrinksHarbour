// client/apps/admin/src/app/shared/sales/sales-cart-import-modal.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PiX,
  PiMagnifyingGlass,
  PiShoppingCart,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  salesOrderService,
  type CartQuoteItem,
  type CartQuoteResult,
} from '@/services/salesOrder.service';
import { cartLineKey } from '@/app/shared/ecommerce/cart-list/cart-meta';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';

type ModalState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'not-found'; matchBy: CartQuoteResult['matchBy'] }
  | { phase: 'empty' }
  | { phase: 'results'; data: CartQuoteResult };

export interface SalesCartImportModalProps {
  open: boolean;
  token: string;
  customer: POSCustomer | null;
  onClose: () => void;
  onConfirm: (items: CartQuoteItem[]) => void;
}

/**
 * Pull a marketplace customer's cart into the current quotation as lines.
 * Shown via the "Import from cart" button in SalesCustomerBar once a customer
 * with an email is selected. Calls GET /api/sales-orders/customer-cart and
 * shows the tenant-sellable lines (skipped lines from other tenants are
 * summarised, not listed).
 */
export default function SalesCartImportModal({
  open,
  token,
  customer,
  onClose,
  onConfirm,
}: SalesCartImportModalProps) {
  const [state, setState] = useState<ModalState>({ phase: 'idle' });
  const [emailInput, setEmailInput] = useState('');
  const [hasQueried, setHasQueried] = useState(false);

  // Reset when the modal opens or the selected customer changes.
  useEffect(() => {
    if (!open || !customer?._id) {
      setState({ phase: 'idle' });
      setEmailInput('');
      setHasQueried(false);
      return;
    }
    setEmailInput(customer.email || '');
    setHasQueried(false);
    setState({ phase: 'idle' });
  }, [open, customer?._id, customer?.email]);

  /**
   * Look up the marketplace cart. `email` is passed explicitly so staff can
   * name the drinksharbour.com account when the POSCustomer has none on file —
   * marketplace registration does not create POSCustomers, so without this the
   * bridge (POSCustomer.email -> User.email) has nothing to match on.
   */
  const fetchCart = useCallback(
    async (email: string) => {
      if (!customer?._id) return;
      setHasQueried(true);
      setState({ phase: 'loading' });
      try {
        const res = await salesOrderService.getCustomerCart(token, {
          posCustomerId: customer._id,
          email: email || undefined,
        });
        const data = res.data;
        if (!data.found) {
          setState({ phase: 'not-found', matchBy: data.matchBy });
          return;
        }
        if (data.items.length === 0) {
          setState({ phase: 'empty' });
          return;
        }
        setState({ phase: 'results', data });
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Failed to load cart',
        });
      }
    },
    [customer?._id, token]
  );

  // Auto-run when the customer already carries an email; otherwise wait for the
  // operator to type one (see the email prompt in the body below).
  useEffect(() => {
    if (!open || !customer?._id || hasQueried) return;
    if (!customer.email) return;
    void fetchCart(customer.email);
  }, [open, customer?._id, customer?.email, hasQueried, fetchCart]);

  if (!open) return null;

  const customerName = customer
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : '';
  const needsEmail = !customer?.email;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Import customer cart"
    >
      <div
        className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-base font-bold text-gray-900">
              Import from marketplace cart
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {customerName}
              {customer?.email && (
                <span className="ml-1 text-gray-400">({customer.email})</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Email prompt — when the POSCustomer has no email, staff must enter the marketplace customer's email. */}
          {needsEmail && !hasQueried && (
            <div className="space-y-3 pb-4">
              <p className="text-sm text-gray-600">
                This customer has no email on file. Enter their <strong>drinksharbour.com</strong> email to find their cart.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="customer@email.com"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailInput.trim()) {
                      void fetchCart(emailInput.trim());
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!emailInput.trim()}
                  onClick={() => void fetchCart(emailInput.trim())}
                  className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-40"
                >
                  Search
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {state.phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
              <p className="text-sm text-gray-500">
                Looking up {customerName}&#39;s cart&hellip;
              </p>
            </div>
          )}

          {/* Error */}
          {state.phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <PiWarningCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm font-medium text-gray-700">
                {state.message}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 text-xs font-semibold text-brand hover:underline"
              >
                Close
              </button>
            </div>
          )}

          {/* Not found */}
          {state.phase === 'not-found' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <PiMagnifyingGlass className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">
                No drinksharbour.com account found
              </p>
              {/* The server only reports found:false when no POSCustomer or no
                  marketplace User matched, and matchBy is 'not-found' on both
                  of those paths — a matched user always comes back found:true
                  (with an empty item list at worst). */}
              <p className="text-xs text-gray-400">
                No marketplace user matches{' '}
                {emailInput || customer?.email || customer?.phone || 'this customer'}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setHasQueried(false);
                  setState({ phase: 'idle' });
                }}
                className="mt-1 text-xs font-semibold text-[#b20202] hover:underline"
              >
                Try another email
              </button>
            </div>
          )}

          {/* Empty */}
          {state.phase === 'empty' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <PiShoppingCart className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">
                {customerName}&#39;s cart is empty
              </p>
              <p className="text-xs text-gray-400">
                They haven&#39;t added anything to their cart yet.
              </p>
            </div>
          )}

          {/* Results */}
          {state.phase === 'results' && (
            <>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">
                  {state.data.items.length} item
                  {state.data.items.length !== 1 ? 's' : ''} sellable by your
                  store
                </span>
                {state.data.skippedCount > 0 && (
                  <span className="text-gray-400">
                    {state.data.skippedCount} item
                    {state.data.skippedCount !== 1 ? 's' : ''} from other stores
                    excluded
                  </span>
                )}
              </div>

              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {/* Same key collision as the Live Carts page: the cart's own
                    line identity is (product, subproduct, size), and this
                    endpoint returns one entry per cart line without merging. */}
                {state.data.items.map((item, idx) => (
                  <li
                    key={cartLineKey(item, idx)}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                        {item.sku && <span>{item.sku}</span>}
                        {item.sizeName && <span>{item.sizeName}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-bold text-gray-900">
                        x{item.quantity}
                      </span>
                      {item.marketplaceUnitPrice > 0 && (
                        <span className="text-[10px] text-gray-400">
                          &#8358;
                          {item.marketplaceUnitPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-[11px] text-gray-400">
                Prices will be re-set to your store&#39;s pricelist on import.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2.5 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          {state.phase === 'results' && (
            <button
              type="button"
              onClick={() => onConfirm(state.data.items)}
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
            >
              Add {state.data.items.length} line
              {state.data.items.length !== 1 ? 's' : ''} to quotation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
