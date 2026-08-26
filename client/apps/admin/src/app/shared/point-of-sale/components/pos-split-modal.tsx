'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PiMinus, PiPlus, PiX } from 'react-icons/pi';
import {
  usePOSCart,
  usePOSAuth,
  usePOSPricelist,
  getEffectiveBundlePriceForItem,
} from '@/app/shared/point-of-sale/store';
import { createOrder as createOrderOffline } from '@/app/shared/point-of-sale/offline/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type {
  POSCartItem,
  POSOrderResponse,
} from '@/app/shared/point-of-sale/types';
import cn from '@core/utils/class-names';
import {
  groupsToOrderPayloads,
  splitEqually,
  validateGroups,
  type PayerGroup,
} from './pos-split-helpers';
import { posItemKey } from './pos-table-helpers';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PayerTender {
  paymentMethod: string;
  amountTendered: number;
  splitPayments?: { method: string; amount: number }[];
}

interface POSSplitModalProps {
  // The payment screen's shared builder — identical item mapping, pricing
  // snapshot and discount scoping as an ordinary Validate. Never forked here.
  buildOrderPayload: (
    subset: POSCartItem[],
    tender: PayerTender,
    opts?: { tableContext?: boolean }
  ) => { payload: Record<string, unknown>; clientTotal: number };
  onClose: () => void;
  onPayerSettled: (units: Array<{ key: string; qty: number }>) => void;
  onComplete: (lastOrder: POSOrderResponse, lastItems: POSCartItem[]) => void;
}

const TENDER_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card / POS' },
  { value: 'bank_transfer', label: 'Transfer' },
  { value: 'mobile_money', label: 'Mobile' },
];

const MIN_PAYERS = 2;
const MAX_PAYERS = 10;

// Dry tender for preview calls — clientTotal ignores the tender entirely.
const DRY_TENDER: PayerTender = { paymentMethod: 'cash', amountTendered: 0 };

// ── Small UI pieces ───────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'border-[#b20202] bg-red-50 text-[#b20202]'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      )}
    >
      {children}
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-30"
      >
        <PiMinus className="h-4 w-4" />
      </button>
      <span className="w-24 text-center text-sm font-bold tabular-nums">
        {value} payers
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-30"
      >
        <PiPlus className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function POSSplitModal({
  buildOrderPayload,
  onClose,
  onPayerSettled,
  onComplete,
}: POSSplitModalProps) {
  const { items, tableBinding } = usePOSCart();
  const { token, terminal } = usePOSAuth();
  const { selectedPricelist } = usePOSPricelist();

  const [mode, setMode] = useState<'equal' | 'byItem'>('equal');
  const [payerCount, setPayerCount] = useState(MIN_PAYERS);
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [settleSelectedOnly, setSettleSelectedOnly] = useState(false);
  const [method, setMethod] = useState('cash');
  const [running, setRunning] = useState(false);

  const totalUnits = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );
  const maxPayers = Math.min(MAX_PAYERS, Math.max(MIN_PAYERS, totalUnits));

  // Value-aware allocation ordering uses the store's own effective pricing —
  // never a reimplementation (plan invariant).
  const effectiveUnitPrice = (i: POSCartItem) =>
    getEffectiveBundlePriceForItem(i, selectedPricelist).price;

  const equalGroups = useMemo(
    () =>
      mode === 'equal'
        ? splitEqually(items, posItemKey, payerCount, effectiveUnitPrice)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, items, payerCount, selectedPricelist]
  );

  const byGroups: PayerGroup[] = useMemo(
    () =>
      Array.from({ length: payerCount }, (_, i) => ({
        id: `payer-${i + 1}`,
        label: `Payer ${i + 1}`,
        itemRefs: Object.keys(assign).filter((k) => assign[k] === i),
      })),
    [assign, payerCount]
  );

  // Live ₦ preview through the SHARED builder (goods − allocated discount).
  const previews = useMemo(() => {
    const groups = mode === 'equal' ? equalGroups : byGroups;
    return groupsToOrderPayloads(groups, items).map((p) => ({
      group: p.group,
      count: p.items.length,
      total: buildOrderPayload(p.items, DRY_TENDER).clientTotal,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, equalGroups, byGroups, items]);

  const unassigned = items.filter((i) => assign[posItemKey(i)] === undefined);
  const byValidation = validateGroups(byGroups, posItemKey, items, {
    requireFullCoverage: !settleSelectedOnly,
  });

  const confirmDisabled =
    running ||
    token == null ||
    (mode === 'equal'
      ? !previews.some((p) => p.count > 0)
      : !byValidation.ok);

  async function handleConfirm() {
    if (!token || running) return;
    if (mode === 'byItem' && !byValidation.ok) {
      toast.error(byValidation.error ?? 'Assignment incomplete');
      return;
    }

    const payloads = groupsToOrderPayloads(
      mode === 'equal' ? equalGroups : byGroups,
      items
    ).filter((p) => p.items.length > 0);
    if (!payloads.length) return;

    setRunning(true);
    try {
      const settledUnits = new Map<string, number>();
      let lastOrder: POSOrderResponse | null = null;
      let lastItems: POSCartItem[] = [];

      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        // Table context rides ONLY the final payer's payload, so the server's
        // hold-consume/table-free path runs exactly once (plan constraint).
        const isFinal = i === payloads.length - 1;
        const { clientTotal } = buildOrderPayload(p.items, DRY_TENDER);
        const { payload } = buildOrderPayload(
          p.items,
          { paymentMethod: method, amountTendered: clientTotal },
          { tableContext: isFinal }
        );

        try {
          const res = await createOrderOffline(token, terminal ?? 'retail', {
            ...payload,
          });
          lastOrder = res.order;
          lastItems = p.items;
          toast.success(
            `${p.group.label} charged ${formatCurrency(clientTotal)}`
          );
          for (const it of p.items) {
            const key = posItemKey(it);
            settledUnits.set(key, (settledUnits.get(key) ?? 0) + it.quantity);
          }
          onPayerSettled(
            Array.from(settledUnits.entries()).map(([key, qty]) => ({
              key,
              qty,
            }))
          );
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : 'payment was rejected';
          toast.error(
            `${p.group.label}'s payment failed — ${msg}. Their items stay in the cart${
              tableBinding ? ' and the table remains bound' : ''
            }; run Split bill again for the remainder.`
          );
          return; // stop on first failure; earlier payers stay settled
        }
      }

      if (lastOrder) onComplete(lastOrder, lastItems);
    } finally {
      setRunning(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Split bill</h2>
            <p className="text-xs text-gray-500">
              {formatCurrency(
                previews.reduce((s, p) => s + p.total, 0)
              )}{' '}
              across payers · each settles as its own receipt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        {/* Mode + tender */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          <Chip active={mode === 'equal'} onClick={() => setMode('equal')}>
            Equally
          </Chip>
          <Chip active={mode === 'byItem'} onClick={() => setMode('byItem')}>
            By item
          </Chip>
          <span className="mx-1 h-5 w-px bg-gray-200" />
          {TENDER_METHODS.map((m) => (
            <Chip
              key={m.value}
              active={method === m.value}
              onClick={() => setMethod(m.value)}
            >
              {m.label}
            </Chip>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-1.5 overflow-y-auto px-5 py-4">
          <div className="mb-3">
            <Stepper
              value={payerCount}
              min={MIN_PAYERS}
              max={maxPayers}
              onChange={(v) => {
                setPayerCount(v);
                setAssign(Object.fromEntries(Object.entries(assign).filter(
                  ([, payer]) => payer < v
                )));
              }}
            />
          </div>

          {mode === 'equal'
            ? previews.map((p) => (
                <div
                  key={p.group.id}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-4 py-3',
                    p.count > 0
                      ? 'border-gray-200 bg-white'
                      : 'border-dashed border-gray-200 bg-gray-50 opacity-60'
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {p.group.label}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {p.count > 0
                        ? `${p.count} line${p.count > 1 ? 's' : ''} · equal unit allocation`
                        : 'no items — add more units or fewer payers'}
                    </p>
                  </div>
                  <p className="text-base font-bold tabular-nums text-gray-900">
                    {formatCurrency(p.total)}
                  </p>
                </div>
              ))
            : items.map((item) => {
                const key = posItemKey(item);
                const payerIdx = assign[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {item.name}
                        {item.variant ? ` · ${item.variant}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {item.quantity} ×{' '}
                        {formatCurrency(effectiveUnitPrice(item))}
                      </p>
                    </div>
                    <select
                      value={payerIdx ?? ''}
                      onChange={(e) =>
                        setAssign((prev) => {
                          const next = { ...prev };
                          if (e.target.value === '') delete next[key];
                          else next[key] = Number(e.target.value);
                          return next;
                        })
                      }
                      className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 focus:border-[#b20202] focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {Array.from({ length: payerCount }, (_, i) => (
                        <option key={i} value={i}>
                          Payer {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}

          {mode === 'byItem' && unassigned.length > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-700">
                Unassigned ({unassigned.length})
              </p>
              <p className="mt-0.5 truncate text-[11px] text-amber-600">
                {unassigned
                  .map((i) => `${i.name} ×${i.quantity}`)
                  .join(', ')}
              </p>
            </div>
          )}

          {mode === 'byItem' && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={settleSelectedOnly}
                onChange={(e) => setSettleSelectedOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#b20202]"
              />
              Settle assigned lines only (rest stays in the cart)
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-2 border-t border-gray-100 px-5 py-4">
          {mode === 'byItem' && !byValidation.ok && (
            <p className="text-xs font-medium text-red-600">
              {byValidation.error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={running}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className="flex-[2] rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: '#b20202' }}
            >
              {running
                ? 'Charging…'
                : `Charge ${previews.filter((p) => p.count > 0).length} payer${
                    previews.filter((p) => p.count > 0).length === 1 ? '' : 's'
                  }`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
