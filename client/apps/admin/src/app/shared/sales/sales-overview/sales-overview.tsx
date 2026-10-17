// Orchestrator of the /sales Overview page.
//
// Data comes from scoped server groups and two recent-document pages. Capped
// groups are explicitly flagged, including the monthly totals. Definitions (what "booked" or
// "outstanding" mean) live in sales-overview-helpers and are unit-tested;
// this file only fetches, formats and composes.

'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowUUpLeft,
  PiArrowsClockwise,
  PiCurrencyNgn,
  PiFileTextDuotone,
  PiPlus,
  PiReceipt,
  PiTrayArrowDown,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { useSalesOverview } from './use-sales-overview';
import { fmtCur } from '@/app/shared/purchases/purchases-analytics-helpers';
import SalesOverviewKpis, {
  type SalesOverviewKpi,
} from './sales-overview-kpis';
import SalesOverviewRecent from './sales-overview-recent';
import {
  bookedThisMonth,
  openQuotations,
  toDeliver,
  unpaidBalance,
} from './sales-overview-helpers';

export default function SalesOverview() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string } | undefined)?.token ?? '';
  const { data, loading, error, load } = useSalesOverview(token);

  if (status !== 'loading' && !token) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        Sign in to view your sales overview.
      </p>
    );
  }
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
      <div
        role="status"
        aria-label="Loading sales overview"
        className="animate-pulse motion-reduce:animate-none"
      >
        <div className="mb-6 h-9 w-44 rounded-lg bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[118px] rounded-xl border border-gray-200 bg-white p-5"
            >
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
      icon: <PiCurrencyNgn />,
      accentClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'deliver',
      label: 'To deliver',
      value: String(deliver.count),
      sub:
        deliver.count > 0
          ? `${fmtCur(deliver.value, cur)} in orders awaiting delivery`
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
      label: 'Outstanding orders',
      value: fmtCur(unpaid.unpaidTotal, cur),
      sub:
        unpaid.partialCount > 0
          ? `${unpaid.unpaidCount} unpaid · ${unpaid.partialCount} partially paid`
          : `${unpaid.unpaidCount} order${unpaid.unpaidCount === 1 ? '' : 's'} unpaid · credits deducted`,
      href: routes.eCommerce.salesOrders,
      icon: <PiReceipt />,
      accentClass: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {data.truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Some counts and values cover your most recent documents only. Open the
          orders or quotations list and narrow its date range for smaller
          results.
        </div>
      )}

      <SalesOverviewKpis kpis={kpis} />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-lexend text-sm font-semibold text-gray-900">
            Sales workspace
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            NGN orders and quotations · recent documents show all currencies
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <PiArrowsClockwise aria-hidden className="h-4 w-4" /> Refresh
          </button>
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
            href={routes.eCommerce.salesReturns}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiArrowUUpLeft className="h-4 w-4" />
            Returns
          </Link>
          <Link
            href={routes.accounting.invoices}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiReceipt className="h-4 w-4" /> Customer invoices
          </Link>
        </div>
      </section>

      <SalesOverviewRecent docs={data.recentDocs} />
    </div>
  );
}
