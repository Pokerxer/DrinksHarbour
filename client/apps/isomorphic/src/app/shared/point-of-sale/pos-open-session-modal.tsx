'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth, usePOSSettings } from '@/app/shared/point-of-sale/store';
import { useTenant } from '@/context/TenantContext';
import { POSSession } from '@/app/shared/point-of-sale/types';

type Props = {
  onSessionOpened: (session: POSSession) => void;
};

export default function POSOpenSessionModal({ onSessionOpened }: Props) {
  const { token, staff, terminal } = usePOSAuth();
  const { tenant } = useTenant();
  const { requireOpeningCash } = usePOSSettings();
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState('');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const cashIsRequired =
    requireOpeningCash && (!openingCash || Number(openingCash) <= 0);

  const cashierName = staff
    ? staff.posName || `${staff.firstName} ${staff.lastName}`
    : 'Cashier';

  async function handleOpen() {
    if (!token) return;
    setOpening(true);
    setError('');
    try {
      const session = await posApi.openSession(
        token,
        Number(openingCash) || 0,
        terminal ?? 'retail'
      );
      onSessionOpened(session);
    } catch (err: any) {
      setError(err.message || 'Failed to open session');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Image
            src="/logo-short.svg"
            alt="DH"
            width={32}
            height={32}
            className="rounded-full"
          />
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {tenant?.name || 'DrinksHarbour'}
            </p>
            <h2 className="text-base font-bold text-gray-900">Open Session</h2>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-400">Cashier</p>
            <p className="text-sm font-semibold text-gray-700">{cashierName}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="mb-1 text-sm font-semibold text-gray-800">
            Opening Control
          </p>
          <p className="mb-5 text-xs text-gray-500">
            Enter the cash amount in the till at the start of this session.
            {requireOpeningCash && (
              <span className="ml-1 font-semibold text-[#b20202]">
                Required.
              </span>
            )}
          </p>

          {/* Opening cash table */}
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Payment Method
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Opening Balance
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">💰</span>
                <span className="text-sm font-medium text-gray-800">Cash</span>
              </div>
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  ₦
                </span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
                  placeholder="0.00"
                  min={0}
                  autoFocus
                  className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-3 text-right text-sm font-semibold outline-none transition-colors focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={() => router.push(routes.pos.index)}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening || cashIsRequired}
            title={cashIsRequired ? 'Opening cash is required' : undefined}
            className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#b20202' }}
          >
            {opening ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Opening…
              </>
            ) : (
              'Open Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
