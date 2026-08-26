'use client';

import { useEffect, useState } from 'react';
import {
  PiArrowsOutSimple,
  PiSpinner,
  PiTable,
  PiUsers,
  PiX,
} from 'react-icons/pi';
import {
  usePOSAuth,
  usePOSTables,
  usePOSRealtimeTick,
  usePOSSettings,
} from '@/app/shared/point-of-sale/store';
import type { POSTableSummary } from '@/app/shared/point-of-sale/types';
import {
  tabElapsedLabel,
  tableStatusClasses,
} from '@/app/shared/point-of-sale/components/pos-table-helpers';
import { useTabActions } from '@/app/shared/point-of-sale/hooks/useTabActions';
import POSTableMapModal from '@/app/shared/point-of-sale/components/pos-table-map-modal';

/**
 * Venue floor strip above the product grid. Bar/restaurant tenants only —
 * resellers and venues with no tables render nothing at all.
 */
export default function POSTableStrip() {
  const { token } = usePOSAuth();
  const settings = usePOSSettings();
  const { tables, refresh } = usePOSTables();
  const { tick } = usePOSRealtimeTick();
  const {
    opening,
    loadingTabId,
    openTabAndBind,
    loadTabAndBind,
  } = useTabActions();

  const [assigning, setAssigning] = useState<POSTableSummary | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  // Fetch on mount, then again whenever another device opens/moves a tab (the
  // realtime tick bumps on order:created etc.) or this terminal fires a round.
  useEffect(() => {
    if (!token) return;
    refresh(token);
  }, [token, tick, refresh]);

  if (!settings.isBarRestaurant) return null;
  if (tables.length === 0) return null;

  function handleTableClick(table: POSTableSummary) {
    if (table.status === 'inactive') return;
    if (table.status === 'occupied') {
      void loadTabAndBind(table);
      return;
    }
    setAssigning(table);
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <PiTable className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="scrollbar-none flex flex-1 items-center gap-1.5 overflow-x-auto">
          {tables.map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() => handleTableClick(t)}
              disabled={t.status === 'inactive' || loadingTabId === t._id}
              title={`${t.name}${t.seats ? ` · ${t.seats} seats` : ''}`}
              className={`flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${tableStatusClasses(
                t.status
              )}`}
            >
              {loadingTabId === t._id ? (
                <PiSpinner className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span>{t.name}</span>
              )}
              {t.status === 'occupied' && t.tab && (
                <span className="whitespace-nowrap font-medium opacity-80">
                  · {tabElapsedLabel(t.tab.openedAt)} · {t.tab.itemCount}{' '}
                  item{t.tab.itemCount !== 1 ? 's' : ''}
                  {(t.tab.guests ?? 0) > 0 ? ` · ${t.tab.guests}p` : ''}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-50 hover:text-[#b20202]"
          title="Floor map"
        >
          <PiArrowsOutSimple className="h-4 w-4" />
        </button>
      </div>

      {assigning && (
        <AssignGuestsModal
          table={assigning}
          busy={opening}
          onConfirm={(guests) => void openTabAndBind(assigning, guests)}
          onClose={() => {
            if (!opening) setAssigning(null);
          }}
        />
      )}

      {mapOpen && (
        <POSTableMapModal
          tables={tables}
          loadingTabId={loadingTabId}
          onTableClick={handleTableClick}
          onClose={() => setMapOpen(false)}
        />
      )}
    </>
  );
}

// ── Assign modal ────────────────────────────────────────────────────────────────
// Seats a party: confirms the table and an optional guest count before the
// server parks the empty hold that IS the tab.

function AssignGuestsModal({
  table,
  busy,
  onConfirm,
  onClose,
}: {
  table: POSTableSummary;
  busy: boolean;
  onConfirm: (guests?: number) => void;
  onClose: () => void;
}) {
  const [guests, setGuests] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">{table.name}</h2>
            <p className="text-[11px] text-gray-400">
              Open a tab{table.seats ? ` · ${table.seats} seats` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <PiUsers className="h-3 w-3" /> Guests
          </label>
          <input
            type="number"
            min={0}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            placeholder="Optional"
            autoFocus
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none placeholder-gray-300 focus:border-[#b20202]"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm(guests.trim() === '' ? undefined : Number(guests))
            }
            className="flex items-center gap-1.5 rounded-xl bg-[#b20202] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8f0202] disabled:opacity-60"
          >
            {busy && <PiSpinner className="h-3.5 w-3.5 animate-spin" />}
            Open tab
          </button>
        </div>
      </div>
    </div>
  );
}
