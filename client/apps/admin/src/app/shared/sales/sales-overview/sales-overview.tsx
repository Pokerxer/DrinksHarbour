// Orchestrator of the /sales Overview page.
//
// Data comes from five parallel server group-by aggregations so every figure
// counts ALL matching tenant documents, not just a page of them — the same
// authority the orders list itself defers to. Definitions (what "booked" or
// "outstanding" mean) live in sales-overview-helpers and are unit-tested;
// this file only fetches, formats and composes.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowUUpLeft,
  PiCurrencyDollar,
  PiFileTextDuotone,
  PiPlus,
  PiReceipt,
  PiTrayArrowDown,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrderGroup,
} from '@/services/salesOrder.service';
import { fmtCur } from '@/app/shared/purchases/purchases-analytics-helpers';
import SalesOverviewKpis, {
  type SalesOverviewKpi,
} from './sales-overview-kpis';
import SalesOverviewRecent from './sales-overview-recent';
import {
  bookedThisMonth,
  monthToDateRange,
  openQuotations,
  tallyGroups,
  toDeliver,
  unpaidBalance,
  mergeRecentDocs,
} from './sales-overview-helpers';

const RECENT_LIMIT = 8;
const GROUP_PAGE = { page: 1, limit: 1 };

interface OverviewData {
  orderTallies: Record<string, { count: number; total: number }>;
  monthTallies: Record<string, { count: number; total: number }>;
  payTallies: Record<string, { count: number; total: number }>;
  quoteTallies: Record<string, { count: number; total: number }>;
  recentDocs: Parameters<typeof mergeRecentDocs>[0];
  currency: string;
  truncated: boolean;
}

export default function SalesOverview() {
  const { data: session } = useSession();
  const token =
    (session?.user as { token?: string } | undefined)?.token ?? '';

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const range = monthToDateRange();
      const [ordersAll, ordersMonth, payments, quotes, recentOrders, recentQuotes] =
        await Promise.all([
          salesOrderService.list(token, {
            docType: 'order',
            groupBy: 'orderStatus',
            ...GROUP_PAGE,
          }),
          salesOrderService.list(token, {
            docType: 'order',
            groupBy: 'orderStatus',
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            ...GROUP_PAGE,
          }),
          salesOrderService.list(token, {
            docType: 'order',
            groupBy: 'paymentStatus',
            ...GROUP_PAGE,
          }),
          salesOrderService.list(token, {
            docType: 'quotation',
            groupBy: 'quoteStatus',
            ...GROUP_PAGE,
          }),
          // Two short doc pages feed the recent table; grouping cannot — it
          // returns tallies, not rows.
          salesOrderService.list(token, { docType: 'order', limit: RECENT_LIMIT }),
          salesOrderService.list(token, {
            docType: 'quotation',
            limit: RECENT_LIMIT,
          }),
        ]);

      const groupsOf = (r: { groups?: SalesOrderGroup[] }) => r.groups ?? [];
      setData({
        orderTallies: tallyGroups(groupsOf(ordersAll)),
        monthTallies: tallyGroups(groupsOf(ordersMonth)),
        payTallies: tallyGroups(groupsOf(payments)),
        quoteTallies: tallyGroups(groupsOf(quotes)),
        recentDocs: mergeRecentDocs(
          recentOrders.data ?? [],
          recentQuotes.data ?? [],
          RECENT_LIMIT
        ),
        currency: groupsOf(ordersAll)[0]?.currency ?? 'NGN',
        truncated: [ordersAll, payments, quotes].some((r) => r.truncated === true),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="animate-pulse">
        <div className="mb-6 h-9 w-44 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[118px] rounded-xl border border-gray-200 bg-white p-5">
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="mt-3 h-7 w-32 rounded bg-gray-100" />
              <div className="mt-2 h-3 w-40 rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-80 rounded-xl border border-gray-200 bg-white" />
      </div>
    );
  }

  const cur = data.currency;
  const booked = bookedThisMonth(data.monthTallies);
  const deliver = toDeliver(data.orderTallies);
  const openQ = openQuotations(data.quoteTallies);
  const unpaid = unpaidBalance(data.payTallies);

  const kpis: SalesOverviewKpi[] = [
    {
      key: 'booked',
      label: 'Booked this month',
      value: fmtCur(booked.revenue, cur),
      sub: `${booked.count} confirmed order${booked.count === 1 ? '' : 's'} · drafts excluded`,
      href: routes.eCommerce.salesOrders,
      icon: <PiCurrencyDollar />,
      accentClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'deliver',
      label: 'To deliver',
      value: String(deliver.count),
      sub:
        deliver.count > 0
          ? `${fmtCur(deliver.value, cur)} awaiting shipment`
          : 'Nothing waiting to ship',
      href: routes.eCommerce.salesFulfillList,
      icon: <PiTrayArrowDown />,
      accentClass: 'bg-blue-50 text-blue-600',
    },
    {
      key: 'quotes',
      label: 'Open quotations',
      value: String(openQ.count),
      sub:
        openQ.expired > 0
          ? `${fmtCur(openQ.value, cur)} · ${openQ.expired} expired`
          : `${fmtCur(openQ.value, cur)} quoted`,
      href: routes.eCommerce.salesQuotations,
      icon: <PiFileTextDuotone />,
      accentClass: 'bg-violet-50 text-violet-600',
    },
    {
      key: 'unpaid',
      label: 'Outstanding (unpaid)',
      value: fmtCur(unpaid.unpaidTotal, cur),
      sub:
        unpaid.partialCount > 0
          ? `${unpaid.unpaidCount} unpaid · ${unpaid.partialCount} partially paid`
          : `${unpaid.unpaidCount} order${unpaid.unpaidCount === 1 ? '' : 's'} unpaid`,
      href: routes.eCommerce.salesOrders,
      icon: <PiReceipt />,
      accentClass: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {data.truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Counts cover your most recent documents only — narrow the period for
          exact totals.
        </div>
      )}

      <SalesOverviewKpis kpis={kpis} />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Shortcuts</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={routes.eCommerce.createSale}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <PiPlus className="h-4 w-4" />
              New Sale
            </Link>
            <Link
              href={routes.eCommerce.salesFulfillList}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiTrayArrowDown className="h-4 w-4" />
              Fulfillment
            </Link>
            <Link
              href={routes.eCommerce.createSalesReturn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiArrowUUpLeft className="h-4 w-4" />
              New Return
            </Link>
          </div>
      </section>

      <SalesOverviewRecent docs={data.recentDocs} />
    </div>
  );
}
