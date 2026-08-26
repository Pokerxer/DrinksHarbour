'use client';

import { useEffect, useState } from 'react';
import {
  PiCaretDown,
  PiCaretUp,
  PiChefHat,
  PiSpinner,
} from 'react-icons/pi';
import {
  usePOSAuth,
  usePOSTables,
  usePOSRealtimeTick,
  usePOSSettings,
} from '@/app/shared/point-of-sale/store';
import { tabElapsedLabel } from '@/app/shared/point-of-sale/components/pos-table-helpers';
import { useTabActions } from '@/app/shared/point-of-sale/hooks/useTabActions';

/**
 * Tabs status panel — a slim, collapsible bar between the cart header and the
 * item list. One row per occupied table: `T3 · 2 rounds · 1 ready · 45m`,
 * straight from the rounds summary the server computes on GET /api/pos/tables.
 * Tapping a row loads that tab exactly like tapping it on the floor strip
 * (shared useTabActions), so the kitchen picture and the floor stay one click
 * apart at the till.
 */
export default function POSTKitchenPanel() {
  const { token } = usePOSAuth();
  const settings = usePOSSettings();
  const { tables, refresh } = usePOSTables();
  const { tick } = usePOSRealtimeTick();
  const { loadingTabId, loadTabAndBind } = useTabActions();

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!token) return;
    refresh(token);
  }, [token, tick, refresh]);

  if (!settings.isBarRestaurant) return null;

  const occupied = tables.filter((t) => t.status === 'occupied' && t.tab);
  if (occupied.length === 0) return null;

  const activeRounds = occupied.reduce(
    (s, t) => s + (t.tab?.rounds?.active ?? 0),
    0
  );

  return (
    <div className="shrink-0 border-b border-gray-100 bg-gray-50/80">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left transition-colors hover:bg-gray-100"
      >
        <PiChefHat className="h-3.5 w-3.5 shrink-0 text-[#b20202]" />
        <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Open tabs · {occupied.length}
          {activeRounds > 0 ? ` · ${activeRounds} in kitchen` : ''}
        </span>
        {expanded ? (
          <PiCaretUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        ) : (
          <PiCaretDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {occupied.map((t) => {
            const rounds = t.tab?.rounds;
            const isLoading = loadingTabId === t._id;
            return (
              <button
                key={t._id}
                type="button"
                disabled={isLoading}
                onClick={() => void loadTabAndBind(t)}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-white disabled:cursor-wait"
              >
                {isLoading ? (
                  <PiSpinner className="h-3.5 w-3.5 shrink-0 animate-spin text-[#b20202]" />
                ) : (
                  <span className="w-12 shrink-0 truncate font-bold text-gray-900">
                    {t.name}
                  </span>
                )}
                <span className="text-gray-600">
                  {rounds?.total ?? 0} round{(rounds?.total ?? 0) === 1 ? '' : 's'}
                </span>
                {(rounds?.ready ?? 0) > 0 && (
                  <span className="rounded bg-emerald-50 px-1.5 font-semibold text-emerald-700">
                    {rounds!.ready} ready
                  </span>
                )}
                {(rounds?.preparing ?? 0) > 0 && (
                  <span className="rounded bg-amber-50 px-1.5 font-semibold text-amber-700">
                    {rounds!.preparing} preparing
                  </span>
                )}
                {(rounds?.pending ?? 0) > 0 && (
                  <span className="rounded bg-blue-50 px-1.5 font-semibold text-blue-700">
                    {rounds!.pending} pending
                  </span>
                )}
                <span className="ml-auto shrink-0 text-gray-400">
                  {tabElapsedLabel(t.tab?.openedAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
