'use client';

import { PiSpinner, PiX } from 'react-icons/pi';
import type { POSTableSummary } from '@/app/shared/point-of-sale/types';
import {
  groupTablesBySection,
  tabElapsedLabel,
  tableStatusClasses,
} from '@/app/shared/point-of-sale/components/pos-table-helpers';

/**
 * Full floor map over the strip's tables. All behaviour lives in the strip —
 * this is presentation only: section-grouped tiles that route clicks back to
 * the same handler the chips use.
 */
export default function POSTableMapModal({
  tables,
  loadingTabId,
  onTableClick,
  onClose,
}: {
  tables: POSTableSummary[];
  loadingTabId: string | null;
  onTableClick: (table: POSTableSummary) => void;
  onClose: () => void;
}) {
  const sections = groupTablesBySection(tables);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Floor map</h2>
            <p className="text-[11px] text-gray-400">
              Tap a free table to seat a party, an occupied one to load its tab
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

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {sections.map(({ section, tables: sectionTables }) => (
            <div key={section}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {section}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {sectionTables.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => onTableClick(t)}
                    disabled={t.status === 'inactive' || loadingTabId === t._id}
                    className={`flex min-h-[76px] flex-col items-start rounded-xl border p-2.5 text-left transition-colors disabled:cursor-not-allowed ${tableStatusClasses(
                      t.status
                    )}`}
                  >
                    <span className="flex w-full items-center gap-1 text-sm font-bold">
                      {loadingTabId === t._id ? (
                        <PiSpinner className="h-4 w-4 animate-spin" />
                      ) : (
                        t.name
                      )}
                    </span>
                    <span className="text-[10px] font-medium opacity-70">
                      {t.seats} seats
                    </span>
                    {t.status === 'occupied' && t.tab && (
                      <span className="mt-auto whitespace-nowrap text-[10px] font-semibold opacity-80">
                        {tabElapsedLabel(t.tab.openedAt)} · {t.tab.itemCount}{' '}
                        item{t.tab.itemCount !== 1 ? 's' : ''}
                        {(t.tab.guests ?? 0) > 0 ? ` · ${t.tab.guests}p` : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
