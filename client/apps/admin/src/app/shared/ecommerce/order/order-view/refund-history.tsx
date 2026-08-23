'use client';

import { Title } from 'rizzui';
import type { Order } from '@/services/order.service';
import { formatCurrency, shortDate, humanize } from './format';
import { Row } from './widgets';

/** POS partial returns / refunds recorded against this order. */
export default function RefundHistory({ order }: { order: Order }) {
  const refunds = order.refunds ?? [];
  if (!refunds.length) return null;

  return (
    <div>
      <Title
        as="h3"
        className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg"
      >
        Returns &amp; Refunds
      </Title>
      <div className="space-y-3">
        {refunds.map((r, i) => (
          <div key={i} className="rounded-xl border border-muted px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-gray-900">
                {r.receiptNumber ?? `Refund ${i + 1}`}
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(r.totalRefunded, order.currency)}
              </span>
            </div>
            <div className="space-y-1">
              {shortDate(r.refundedAt) && (
                <Row label="Processed" value={shortDate(r.refundedAt)} />
              )}
              {r.paymentMethod && (
                <Row label="Method" value={humanize(r.paymentMethod)} />
              )}
              {r.reason && <Row label="Reason" value={r.reason} />}
            </div>
            {!!r.items?.length && (
              <ul className="mt-2 space-y-1 border-t border-muted pt-2">
                {r.items.map((line, li) => {
                  const product =
                    order.items[line.orderItemIndex ?? -1]?.product?.name;
                  return (
                    <li key={li} className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">
                        {line.quantity ?? 0} ×{' '}
                        {product ?? `Item ${(line.orderItemIndex ?? 0) + 1}`}
                        {line.restock === false && (
                          <span className="ms-1 text-orange-500">
                            (not restocked)
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-gray-700">
                        {formatCurrency(line.amount, order.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
