'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PiArrowUpRight,
  PiArrowDownLeft,
  PiArrowUpLeft,
  PiStorefront,
  PiShoppingCart,
  PiReceipt,
} from 'react-icons/pi';
import { arApService } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';

export default function AccountingOperations({ token }: { token: string }) {
  const [balances, setBalances] = useState<{
    receivable: number;
    payable: number;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      arApService.receivablesSummary(token),
      arApService.payablesSummary(token),
    ])
      .then(([ar, ap]) => {
        if (!cancelled)
          setBalances({
            receivable: ar.data.totalOutstanding,
            payable: ap.data.totalOutstanding,
          });
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Could not load balances'
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return (
    <section aria-label="Accounting workbench" className="mb-6 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Your accounting workbench
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Follow money from its source through to your books.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Money to collect',
            value: balances?.receivable,
            href: '/accounting/invoices',
            icon: PiArrowDownLeft,
            caption: 'Review customer invoices',
          },
          {
            label: 'Money to pay',
            value: balances?.payable,
            href: '/accounting/bills',
            icon: PiArrowUpLeft,
            caption: 'Review vendor bills',
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 hover:border-red-200 hover:shadow-sm"
          >
            <span className="rounded-xl bg-red-50 p-2 text-brand">
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="my-1 break-words text-xl font-semibold tabular-nums text-gray-900">
                {card.value == null ? '—' : fmtMoney(card.value)}
              </p>
              <p className="text-xs text-gray-500">{card.caption}</p>
            </div>
          </Link>
        ))}
        <Link
          href="/accounting/payments?side=customer"
          className="flex flex-col justify-between rounded-2xl bg-gray-900 p-4 text-white"
        >
          <div className="flex justify-between">
            <PiReceipt className="h-5 w-5" />
            <PiArrowUpRight />
          </div>
          <div className="mt-3">
            <p className="font-semibold">Receipts & payments</p>
            <p className="mt-1 text-xs text-gray-300">
              Allocate money to invoices and bills
            </p>
          </div>
        </Link>
        <Link
          href="/accounting/journal-entries"
          className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4"
        >
          <div className="flex justify-between text-brand">
            <PiReceipt className="h-5 w-5" />
            <PiArrowUpRight />
          </div>
          <div className="mt-3">
            <p className="font-semibold text-gray-900">Review the ledger</p>
            <p className="mt-1 text-xs text-gray-500">
              Trace postings and adjustments
            </p>
          </div>
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          Open balances could not load: {error}. Open Invoices or Bills to
          retry.
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: 'Purchases', href: '/purchases', icon: PiShoppingCart },
          { label: 'Sales orders', href: '/sales', icon: PiReceipt },
          {
            label: 'Point of sale',
            href: '/point-of-sale',
            icon: PiStorefront,
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 font-medium text-gray-600 hover:text-brand"
          >
            <link.icon className="h-4 w-4" />
            {link.label}
            <PiArrowUpRight />
          </Link>
        ))}
      </div>
    </section>
  );
}
