'use client';

import React from 'react';
import {
  PiCheckSquare,
  PiSquare,
  PiDotsSixVertical,
  PiTrash,
  PiTag,
  PiCaretLeft,
  PiCaretRight,
} from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';
import TableFooter from './table-footer';
import TableCreateRow from './table-create-row';
import type { Pricelist } from './types';

interface Props {
  rows: Pricelist[];
  loading: boolean;
  error: string;
  creating: boolean;
  newName: string;
  checked: Set<string>;
  selectedId: string | null;
  onNewNameChange(v: string): void;
  onCreate(): void;
  onCancelCreate(): void;
  onSelect(pl: Pricelist): void;
  onToggleOne(id: string): void;
  onToggleAll(): void;
  onDeleteRequest(pl: Pricelist): void;
  page: number;
  totalPages: number;
  total: number;
  onPage(p: number): void;
}

export default function PricelistTable({
  rows,
  loading,
  error,
  creating,
  newName,
  checked,
  selectedId,
  onNewNameChange,
  onCreate,
  onCancelCreate,
  onSelect,
  onToggleOne,
  onToggleAll,
  onDeleteRequest,
  page,
  totalPages,
  total,
  onPage,
}: Props) {
  const allChecked = rows.length > 0 && rows.every((p) => checked.has(p._id));

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200"
          style={{ borderTopColor: BRAND }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-red-500">
        ⚠ {error}
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
            <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <th className="w-8 px-2 py-3 text-center">
                <button
                  type="button"
                  aria-label="Select all"
                  onClick={onToggleAll}
                  className="text-gray-400 hover:text-[#b20202]"
                >
                  {allChecked || (checked.size > 0 && !allChecked) ? (
                    <PiCheckSquare
                      className="h-4 w-4"
                      style={allChecked ? { color: BRAND } : { color: '#9ca3af' }}
                    />
                  ) : (
                    <PiSquare className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="w-6 px-1 py-3" />
              <th className="px-3 py-3 text-left">Pricelist Name</th>
              <th className="px-3 py-3 text-left">Country Groups</th>
              <th className="px-3 py-3 text-left">Currency</th>
              <th className="px-3 py-3 text-center">Selectable</th>
              <th className="px-3 py-3 text-left">Website</th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {creating && (
              <TableCreateRow
                newName={newName}
                onNameChange={onNewNameChange}
                onCreate={onCreate}
                onCancel={onCancelCreate}
              />
            )}

            {rows.length === 0 && !creating ? (
              <tr>
                <td colSpan={8} className="py-20 text-center">
                  <PiTag className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                  <p className="text-sm text-gray-400">
                    No pricelists — click New to create one
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((pl) => {
                const isChk = checked.has(pl._id);
                const isSel = selectedId === pl._id;
                // NOTE: explicit composition — the original monolith had an
                // operator-precedence bug (`'' + isChk ? …`) that styled every
                // unchecked row as selected and killed hover.
                const rowCls = [
                  'cursor-pointer border-b border-gray-100 transition-colors',
                  isSel ? 'text-white' : '',
                  !isSel && isChk ? 'bg-[#b20202]/5' : '',
                  !isSel && !isChk ? 'bg-white hover:bg-gray-50' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr
                    key={pl._id}
                    className={rowCls}
                    style={
                      isSel
                        ? { backgroundColor: BRAND }
                        : { borderLeft: isChk ? `2px solid ${BRAND}` : '2px solid transparent' }
                    }
                    onClick={() => onSelect(pl)}
                  >
                    <td
                      className="w-8 px-2 py-2.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Select ${pl.name}`}
                        onClick={() => onToggleOne(pl._id)}
                        className="text-gray-400 hover:text-[#b20202]"
                      >
                        {isChk ? (
                          <PiCheckSquare className="h-4 w-4" style={{ color: BRAND }} />
                        ) : (
                          <PiSquare className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className={`px-1 py-2.5 ${isSel ? 'text-red-200' : 'text-gray-200'}`}>
                      <PiDotsSixVertical className="h-3.5 w-3.5" />
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold ${isSel ? 'text-white' : 'text-gray-900'}`}
                    >
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {pl.name}
                        {pl.isDefault && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              isSel ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            Default
                          </span>
                        )}
                        {((pl.shops || []).length > 0 ||
                          (pl.warehouses || []).length > 0) && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              isSel ? 'bg-white/15 text-red-100' : 'bg-gray-100 text-gray-500'
                            }`}
                            title={`${(pl.shops || []).length} shop(s), ${(pl.warehouses || []).length} warehouse(s)`}
                          >
                            {(pl.shops || []).length}s · {(pl.warehouses || []).length}w
                          </span>
                        )}
                        {(pl.customerTags || []).length > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              isSel ? 'bg-white/15 text-red-100' : 'bg-teal-50 text-teal-600'
                            }`}
                            title={`Customer tags: ${(pl.customerTags || []).join(', ')}`}
                          >
                            {(pl.customerTags || []).join(', ')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 ${isSel ? 'text-red-100' : 'text-gray-500'}`}>
                      {(pl.countryGroups || []).join(', ') || (
                        <span className={isSel ? 'text-red-200' : 'text-gray-300'}>—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 ${isSel ? 'text-red-100' : 'text-gray-600'}`}>
                      {pl.currency || 'NGN'}
                    </td>
                    <td
                      className="px-3 py-2.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pl.isSelectable ? (
                        <PiCheckSquare
                          className="mx-auto h-4 w-4"
                          style={isSel ? { color: '#fff' } : { color: BRAND }}
                        />
                      ) : (
                        <PiSquare
                          className={`mx-auto h-4 w-4 ${isSel ? 'text-red-200' : 'text-gray-300'}`}
                        />
                      )}
                    </td>
                    <td className={`px-3 py-2.5 ${isSel ? 'text-red-100' : 'text-gray-600'}`}>
                      {pl.website || (
                        <span className={isSel ? 'text-red-200' : 'text-gray-300'}>—</span>
                      )}
                    </td>
                    <td
                      className="w-8 px-2 py-2.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Delete ${pl.name}`}
                        onClick={() => onDeleteRequest(pl)}
                        className={`transition-colors ${
                          isSel ? 'text-white/60 hover:text-white' : 'text-gray-300 hover:text-red-500'
                        }`}
                      >
                        <PiTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <TableFooter page={page} totalPages={totalPages} total={total} onPage={onPage} />
      )}
    </>
  );
}

const PAGE_SIZE = 50;
