'use client';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import AdjustmentModal from './inventory-adjustment-modal';
import { PiSignInDuotone, PiWarningCircle, PiArrowsLeftRight } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { MovesPresetKey } from './inventory-movements-presets';
import MoveDetail from './inventory-movements-detail';
import SummaryCards from './inventory-movements-summary';
import ReceiptSummary from './inventory-receipt-summary';
import DeliverySummary from './inventory-delivery-summary';
import InternalSummary from './inventory-internal-summary';
import AdjustmentSummary from './inventory-adjustment-summary';
import { useMovementBrowser } from './use-movement-browser';
import MovementHeader from './inventory-movement-header';
import MovementFilters from './inventory-movement-filters';
import MovementTable from './inventory-movement-table';
export default function InventoryMovementsBrowser({
  preset: presetKey,
}: {
  preset: MovesPresetKey;
}) {
  const view = useMovementBrowser(presetKey);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const closeAdjustment = useCallback(() => setAdjustmentOpen(false), []);
  const { token, sessionStatus, preset, errorMsg, fetchMoves, stats, selected, setSelected } = view;
  if (sessionStatus !== 'loading' && !token) {
    return (
      <div className="flex h-[calc(100dvh-47px)] flex-col items-center justify-center gap-3 bg-gray-50 text-center">
        <PiSignInDuotone className="h-10 w-10 text-gray-300" />
        <h1 className="text-lg font-bold text-gray-900">Sign in required</h1>
        <p className="max-w-sm text-sm text-gray-500">
          Sign in to your tenant account to view {preset.emptyNoun}.
        </p>
        <Link
          href={routes.signIn}
          className="mt-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[640px] w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <MovementHeader
          view={view}
          onAdjustment={presetKey === 'adjustments' ? () => setAdjustmentOpen(true) : undefined}
        />
        <MovementFilters view={view} />
      </div>
      {/* ── Error banner ── */}
      {errorMsg && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2"
        >
          <span className="flex items-center gap-2 text-xs text-red-700">
            <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMsg}
            {' — showing no data.'}
          </span>
          <button
            type="button"
            onClick={() => fetchMoves()}
            className="rounded-lg bg-[#b20202] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#8f0202]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      {presetKey === 'receipts' ? (
        <ReceiptSummary
          moves={view.filtered}
          stats={stats}
          loading={view.loading}
          error={errorMsg}
          truncated={view.truncated}
        />
      ) : presetKey === 'adjustments' ? (
        <AdjustmentSummary
          moves={view.filtered}
          loading={view.loading}
          error={errorMsg}
          truncated={view.truncated}
        />
      ) : presetKey === 'internal' ? (
        <InternalSummary
          moves={view.filtered}
          loading={view.loading}
          error={errorMsg}
          truncated={view.truncated}
        />
      ) : presetKey === 'deliveries' ? (
        <DeliverySummary
          moves={view.filtered}
          stats={stats}
          loading={view.loading}
          error={errorMsg}
          truncated={view.truncated}
        />
      ) : (
        <SummaryCards
          presetTitle={preset.title}
          unitsLabel={preset.unitsLabel}
          showSupplier={preset.showSupplier}
          stats={stats}
        />
      )}

      <p className="border-b border-gray-200 bg-white px-4 py-2 text-[11px] text-gray-500">
        {presetKey === 'adjustments'
          ? 'Increases, decreases and net change use confirmed recorded stock changes. Pending and cancelled corrections do not post stock. Cost shows recorded correction value, not net valuation. '
          : presetKey === 'internal'
            ? 'Each warehouse leg is counted separately. Transfers in/out exclude returns; returns are shown separately and included in net stock change. Pending and cancelled records do not post stock. Route filters follow the recorded direction, including returns. '
            : presetKey === 'receipts'
              ? 'Received totals include confirmed incoming stock only. Pending, cancelled and rejected lines do not add stock. Internal transfers are shown in Internal. '
              : presetKey === 'deliveries'
                ? 'Issued totals count confirmed stock deductions only, not completed customer deliveries. Pending, cancelled and rejected lines do not issue stock. Returns and internal transfers have separate histories. '
                : 'Totals include confirmed on-hand changes only. Each warehouse leg is counted separately. '}
        Dates use your local time zone.
      </p>
      <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden lg:max-h-[70dvh] lg:flex-row">
        <MovementTable view={view} />
        {/* Detail panel */}
        <div
          className={`flex flex-col bg-white transition-all duration-200 ${selected ? 'w-full flex-1 overflow-auto lg:min-w-[300px]' : 'hidden'}`}
        >
          {selected ? (
            <MoveDetail
              move={selected}
              docTitle={preset.docTitle}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner">
                <PiArrowsLeftRight className="h-7 w-7 text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Select a line</p>
                <p className="mt-1 text-xs text-gray-400">
                  Click any row to view details
                  <br />
                  and print its document · Esc closes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {adjustmentOpen && presetKey === 'adjustments' && view.canAdjust && (
        <AdjustmentModal
          key={token}
          token={token}
          close={closeAdjustment}
          done={() => {
            setAdjustmentOpen(false);
            void fetchMoves();
          }}
        />
      )}
    </div>
  );
}
