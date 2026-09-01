'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cn from '@core/utils/class-names';
import {
  PiCaretDownBold,
  PiEnvelopeSimpleBold,
  PiPhoneBold,
  PiFileTextBold,
} from 'react-icons/pi';
import { formatCurrency, shortDate } from '../order/order-view/format';
import {
  BUCKET_META,
  cartLineKey,
  formatAge,
  isFollowUpWorthy,
  lineSummary,
} from './cart-meta';
import type { AdminCart } from '@/services/adminCart.service';

/**
 * One cart row, expandable to show its lines.
 *
 * The lines ship with the list response, so expanding costs no request — a
 * cart holds at most a few dozen items and staff open several in a row while
 * triaging.
 */
export default function CartTableRow({
  cart,
  index,
  onCreateQuotation,
}: {
  cart: AdminCart;
  index: number;
  onCreateQuotation: (cart: AdminCart) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = BUCKET_META[cart.bucket];
  const worthChasing = isFollowUpWorthy(cart.bucket, cart.value);

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: Math.min(index * 0.02, 0.3) }}
        className={cn(
          'border-b border-muted transition-colors hover:bg-gray-50',
          open && 'bg-gray-50'
        )}
      >
        {/* Shopper */}
        <td className="px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-start gap-2 text-left"
          >
            <PiCaretDownBold
              className={cn(
                'mt-1 h-3 w-3 shrink-0 text-gray-400 transition-transform',
                open && 'rotate-180'
              )}
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900">
                {cart.user.name}
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-400">
                {cart.user.email || cart.user.phone || 'No contact on file'}
              </span>
            </span>
          </button>
        </td>

        {/* Contents */}
        <td className="px-5 py-4 text-sm text-gray-600">
          {lineSummary(cart.itemCount, cart.totalQuantity, cart.skippedCount)}
        </td>

        {/* Value */}
        <td className="px-5 py-4">
          <span className="font-bold text-gray-900">
            {formatCurrency(cart.value)}
          </span>
        </td>

        {/* Age + bucket */}
        <td className="px-5 py-4">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
              meta.badge
            )}
            title={meta.hint}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
            {meta.label}
          </span>
          <span className="mt-1 block text-xs text-gray-400">
            {formatAge(cart.ageHours)} · {shortDate(cart.updatedAt) ?? '—'}
          </span>
        </td>

        {/* Actions */}
        <td className="px-5 py-4 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {cart.user.email && (
              <a
                href={`mailto:${cart.user.email}`}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title={`Email ${cart.user.email}`}
                aria-label={`Email ${cart.user.name}`}
              >
                <PiEnvelopeSimpleBold className="h-4 w-4" />
              </a>
            )}
            {cart.user.phone && (
              <a
                href={`tel:${cart.user.phone}`}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title={`Call ${cart.user.phone}`}
                aria-label={`Call ${cart.user.name}`}
              >
                <PiPhoneBold className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onCreateQuotation(cart)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                worthChasing
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'border border-muted text-gray-600 hover:border-primary hover:text-primary'
              )}
            >
              <PiFileTextBold className="h-3.5 w-3.5" />
              Quote
            </button>
          </div>
        </td>
      </motion.tr>

      <AnimatePresence initial={false}>
        {open && (
          <tr className="border-b border-muted bg-gray-50/60">
            <td colSpan={5} className="px-5 pb-5 pt-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="overflow-hidden rounded-xl border border-muted bg-gray-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-2 font-semibold">Product</th>
                        <th className="px-4 py-2 font-semibold">Size</th>
                        <th className="px-4 py-2 font-semibold">Qty</th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Unit
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          Line
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.items.map((it, idx) => (
                        <tr
                          key={cartLineKey(it, idx)}
                          className="border-b border-muted last:border-0"
                        >
                          <td className="px-4 py-2.5">
                            <span className="block font-medium text-gray-900">
                              {it.name}
                            </span>
                            {it.sku && (
                              <span className="text-[11px] text-gray-400">
                                {it.sku}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {it.sizeName || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {it.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                            {formatCurrency(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                  {/* The shopper's snapshot price is a forecast, not an offer —
                      the pricelist engine reprices every line on import. */}
                  <span>
                    Marketplace prices at time of adding — a quotation reprices
                    against your pricelist.
                  </span>
                  {cart.skippedCount > 0 && (
                    <span>
                      {cart.skippedCount} further item
                      {cart.skippedCount === 1 ? '' : 's'} in this cart belong
                      to other stores and are not shown.
                    </span>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
