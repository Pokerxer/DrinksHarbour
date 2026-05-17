'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { PiGearSix, PiMagnifyingGlass, PiCaretDown, PiArrowRight } from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from './pos-nav-header';

const terminals = [
  {
    id: 'retail',
    title: 'RETAIL',
    badge: 'CASHIERS',
    description: 'Front-counter sales for walk-in customers',
    avatarLetter: 'R',
    avatarBg: 'bg-orange-500',
  },
  {
    id: 'wholesale',
    title: 'WHOLESALE',
    badge: 'MANAGERS',
    description: 'Bulk & account-based orders',
    avatarLetter: 'M',
    avatarBg: 'bg-sky-600',
  },
];

function today() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

type TerminalSessionState = {
  sessionOpen: boolean | null; // null = loading
  closingDate: string | null;
  closingBalance: string | null;
};

const DEFAULT_STATE: TerminalSessionState = { sessionOpen: null, closingDate: null, closingBalance: null };

export default function POSDashboard() {
  const router = useRouter();
  const { token } = usePOSAuth();
  const [retailInfo, setRetailInfo]       = useState<TerminalSessionState>(DEFAULT_STATE);
  const [wholesaleInfo, setWholesaleInfo] = useState<TerminalSessionState>(DEFAULT_STATE);

  useEffect(() => {
    if (!token) return;

    function fetchTerminal(type: 'retail' | 'wholesale', setter: (s: TerminalSessionState) => void) {
      posApi
        .getSessionInfo(token!, type)
        .then((data) => {
          const last = data.lastSession;
          setter({
            sessionOpen: !!data.currentSession,
            closingDate: last
              ? new Date(last.closedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
              : null,
            closingBalance: last ? formatCurrency(last.totalSales) : null,
          });
        })
        .catch(() => setter({ sessionOpen: false, closingDate: null, closingBalance: null }));
    }

    fetchTerminal('retail', setRetailInfo);
    fetchTerminal('wholesale', setWholesaleInfo);
  }, [token]);

  const terminalInfo = { retail: retailInfo, wholesale: wholesaleInfo };

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      {/* ── Nav ── */}
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <POSNavHeader />
      </div>

      {/* ── Hero band ── */}
      <div
        className="relative overflow-hidden bg-[#b20202] px-6 py-10 md:px-10 lg:px-14"
        style={{
          background: 'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          {/* Left: brand + title */}
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20 backdrop-blur-sm">
              <Image
                src="/logo-short.svg"
                alt="DrinksHarbour"
                width={44}
                height={44}
                className="rounded-xl"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200">
                DrinksHarbour
              </p>
              <h1 className="mt-0.5 text-3xl font-bold text-white">Point of Sale</h1>
              <p className="mt-1 text-sm text-red-200">
                Select a terminal to begin selling
              </p>
            </div>
          </div>

          {/* Right: date + search */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-sm font-medium text-red-200">{today()}</p>
            <div className="relative flex w-64 items-center">
              <PiMagnifyingGlass className="absolute left-3 h-4 w-4 text-red-300" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-9 text-sm text-white placeholder-red-300 outline-none backdrop-blur-sm focus:border-white/40 focus:bg-white/15"
              />
              <button
                type="button"
                className="absolute right-0 flex h-9 w-9 items-center justify-center border-l border-white/20 text-red-300 hover:text-white"
              >
                <PiCaretDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 bg-gray-50 px-6 pb-8 pt-6 md:px-10 lg:px-14">

        {/* Page sub-heading row */}
        <div className="mb-5 flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-700">Point of Sale</h2>
          <button
            type="button"
            aria-label="Configure"
            className="text-gray-400 transition-colors hover:text-[#b20202]"
          >
            <PiGearSix className="h-4 w-4" />
          </button>
        </div>

        {/* Terminal cards */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {terminals.map((t) => {
            const info = terminalInfo[t.id as 'retail' | 'wholesale'];
            return (
              <div
                key={t.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Red top accent */}
                <div className="h-1 w-full bg-[#b20202]" />

                <div className="flex flex-1 flex-col p-7">
                  {/* Title */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold tracking-wide text-gray-900">
                        {t.title}{' '}
                        <span className="font-normal text-gray-500">[{t.badge}]</span>
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-400">{t.description}</p>
                    </div>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.avatarBg} text-sm font-bold text-white`}
                    >
                      {t.avatarLetter}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="my-6 grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-gray-50 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Closing Balance
                      </p>
                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {info.closingBalance ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Last Closed
                      </p>
                      <p className="mt-1 text-xl font-bold text-gray-900">
                        {info.closingDate ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => router.push(`${routes.pos.lock}?terminal=${t.id}`)}
                      className="flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] active:bg-[#8f0101]"
                    >
                      {info.sessionOpen ? 'Continue Selling' : 'Open Session'}
                      <PiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>

                    {info.sessionOpen === null ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />
                    ) : info.sessionOpen ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Session open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        No active session
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
