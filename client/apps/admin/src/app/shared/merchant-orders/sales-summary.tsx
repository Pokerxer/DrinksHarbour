'use client';

import { useEffect, useState } from 'react';
import { merchantRequest } from '@/services/merchant-order.service';

type SalesSummary = {
  tenant: { name: string; slug: string };
  marketplaceSalesTotal: number;
  marketplaceSalesOrders: number;
};

const naira = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount || 0);

/** Accepts only a well-formed sales-summary payload — anything else (e.g. a
 * mismatched mock or an error body) renders nothing instead of breaking the
 * workspace. */
function parseSummary(data: unknown): SalesSummary | null {
  if (!data || typeof data !== 'object') return null;
  const source = data as Record<string, unknown>;
  const tenant =
    source.tenant && typeof source.tenant === 'object'
      ? (source.tenant as Record<string, unknown>)
      : null;
  const total = Number(source.marketplaceSalesTotal);
  const orders = Number(source.marketplaceSalesOrders);
  if (!tenant || typeof tenant.name !== 'string' || typeof tenant.slug !== 'string')
    return null;
  if (!Number.isFinite(total) || !Number.isFinite(orders)) return null;
  return {
    tenant: { name: tenant.name, slug: tenant.slug },
    marketplaceSalesTotal: total,
    marketplaceSalesOrders: orders,
  };
}

/**
 * Tenant's gross marketplace sales, read from the denormalised Tenant
 * aggregate (posted sales_revenue journals, source 'marketplace' — the same
 * rows the settlement statements pay out on). Renders nothing when the read
 * fails: the fulfillment workspace must never be blocked by a stats read.
 */
export default function SalesSummary({ token }: { token: string }) {
  const [summary, setSummary] = useState<SalesSummary | null>(null);

  useEffect(() => {
    let alive = true;
    merchantRequest<unknown>(token, '/sales-summary', 'GET')
      .then((data) => {
        if (alive) setSummary(parseSummary(data));
      })
      .catch(() => {
        /* stats are optional chrome — the queue itself is the workspace */
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (!summary) return null;

  return (
    <section
      aria-label="Marketplace sales summary"
      className="grid grid-cols-1 gap-4 rounded-xl border border-muted bg-gray-50 p-4 dark:bg-gray-100/30 sm:grid-cols-3 sm:p-5"
    >
      <div>
        <p className="text-xs font-medium text-gray-500">
          Total marketplace sales
        </p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {naira(summary.marketplaceSalesTotal)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          Paid orders on the DrinksHarbour marketplace
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">Paid orders</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {summary.marketplaceSalesOrders.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          Orders containing this store&rsquo;s lines
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">Store</p>
        <p className="mt-1 truncate text-2xl font-semibold text-gray-900">
          {summary.tenant.name}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">/{summary.tenant.slug}</p>
      </div>
    </section>
  );
}
