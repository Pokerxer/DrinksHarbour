'use client';

// app/shared/warehouses/warehouse-detail/subproduct-inventory-drawer.tsx
// Warehouse-scoped view of one stock line: identity, quantities, pricing,
// bin location, batches and the movement audit trail. Everything shown is
// filtered to THIS warehouse — the drawer never mixes in other locations.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiX,
  PiPackageBold,
  PiMapPin,
  PiStackBold,
  PiArrowsClockwise,
  PiArrowUpRightBold,
  PiArrowDownRightBold,
  PiSlidersHorizontalBold,
  PiArrowsLeftRightBold,
  PiArrowBendDownLeftBold,
} from 'react-icons/pi';
import {
  warehouseStockService,
  type WarehouseMovement,
  type WarehouseStockRow,
} from '@/services/warehouseStock.service';
import { warehouseService, type WarehouseBatch } from '@/services/warehouse.service';
import { routes } from '@/config/routes';
import {
  skuOf,
  productNameOf as nameOf,
  sizeLabelOf as sizeOf,
  imageOf,
  subProductIdOf,
  sizeIdOf,
} from '../warehouse-ref-helpers';
import { availOf, belowReorderOf, statusOf } from './row-utils';
import { StatusBadge, ReorderBadge } from './badges';

// Pricing derivation mirrors the server's stock/all flattening
// (server/services/warehouse.service.js → getAllStock): size-level prices win
// when present, falling back to the SubProduct-level fields.
export const lineCostOf = (r: WarehouseStockRow): number => {
  if (typeof r.size !== 'object' || !r.size) return r.subProduct && typeof r.subProduct === 'object' ? (r.subProduct.costPrice ?? 0) : 0;
  return r.size.costPrice && r.size.costPrice > 0
    ? r.size.costPrice
    : typeof r.subProduct === 'object' && r.subProduct
      ? (r.subProduct.costPrice ?? 0)
      : 0;
};

export const lineSellOf = (r: WarehouseStockRow): number => {
  if (typeof r.size !== 'object' || !r.size)
    return typeof r.subProduct === 'object' && r.subProduct ? (r.subProduct.baseSellingPrice ?? 0) : 0;
  return r.size.sellingPrice && r.size.sellingPrice > 0
    ? r.size.sellingPrice
    : typeof r.subProduct === 'object' && r.subProduct
      ? (r.subProduct.baseSellingPrice ?? 0)
      : 0;
};

const fmtMoney = (v: number, currency = 'NGN'): string => {
  const symbol =
    currency === 'NGN'
      ? '₦'
      : currency === 'USD'
        ? '$'
        : currency === 'EUR'
          ? '€'
          : currency === 'GBP'
            ? '£'
            : `${currency} `;
  return `${symbol}${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const MOVEMENT_META: Record<
  WarehouseMovement['type'],
  { label: string; cls: string; icon: React.ReactNode; signed: '+' | '-' | '=' }
> = {
  received: {
    label: 'Received',
    cls: 'bg-green-50 text-green-700',
    icon: <PiArrowDownRightBold className="h-3 w-3" />,
    signed: '+',
  },
  returned: {
    label: 'Returned',
    cls: 'bg-green-50 text-green-700',
    icon: <PiArrowBendDownLeftBold className="h-3 w-3" />,
    signed: '+',
  },
  transfer_in: {
    label: 'Transfer in',
    cls: 'bg-blue-50 text-blue-700',
    icon: <PiArrowsLeftRightBold className="h-3 w-3" />,
    signed: '+',
  },
  transfer_out: {
    label: 'Transfer out',
    cls: 'bg-orange-50 text-orange-700',
    icon: <PiArrowsLeftRightBold className="h-3 w-3" />,
    signed: '-',
  },
  shipped: {
    label: 'Shipped',
    cls: 'bg-red-50 text-red-600',
    icon: <PiArrowUpRightBold className="h-3 w-3" />,
    signed: '-',
  },
  adjusted: {
    label: 'Recounted',
    cls: 'bg-gray-100 text-gray-600',
    icon: <PiSlidersHorizontalBold className="h-3 w-3" />,
    signed: '=',
  },
};

const relDate = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

type Tab = 'overview' | 'batches' | 'history';

export default function SubProductInventoryDrawer({
  warehouseId,
  row,
  onClose,
  onAdjust,
  onTransfer,
}: {
  warehouseId: string;
  row: WarehouseStockRow;
  onClose: () => void;
  onAdjust: (r: WarehouseStockRow) => void;
  onTransfer: (r: WarehouseStockRow) => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [tab, setTab] = useState<Tab>('overview');
  const [batches, setBatches] = useState<WarehouseBatch[] | null>(null);
  const [movements, setMovements] = useState<WarehouseMovement[] | null>(null);

  const name = nameOf(row) || skuOf(row) || 'Unnamed product';
  const subProductId = subProductIdOf(row);
  const sizeId = sizeIdOf(row);
  const canOperate = !!(subProductId && sizeId);

  // Batches + movements are both cheap, line-scoped queries — load together.
  useEffect(() => {
    if (!token || !canOperate) return;
    let alive = true;
    warehouseService
      .getBatches(warehouseId, token, {
        subProduct: subProductId as string,
        size: sizeId as string,
      })
      .then((res) => alive && setBatches(res.data ?? []))
      .catch((e) =>
        alive &&
        toast.error(e instanceof Error ? e.message : 'Failed to load batches')
      );
    warehouseStockService
      .getWarehouseMovements(warehouseId, token, {
        subProduct: subProductId as string,
        size: sizeId as string,
        limit: 50,
      })
      .then((res) => alive && setMovements(res.data ?? []))
      .catch(() => alive && setMovements([]));
    return () => {
      alive = false;
    };
  }, [token, warehouseId, subProductId, sizeId, canOperate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cost = lineCostOf(row);
  const sell = lineSellOf(row);
  const margin = sell - cost;
  const marginPct = cost > 0 ? (margin / cost) * 100 : null;
  const currency =
    typeof row.subProduct === 'object' && row.subProduct
      ? (row.subProduct.currency ?? 'NGN')
      : 'NGN';
  const stockValue = row.currentQuantity * cost;
  const loc = [row.zone, row.aisle, row.shelf, row.bin].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[190] flex justify-end bg-black/40 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Inventory for ${name}`}
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            {imageOf(row) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageOf(row) as string}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <PiPackageBold className="h-5 w-5 text-gray-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Inventory · this warehouse
            </p>
            <h2 className="truncate text-base font-bold text-gray-900">
              {name}
            </h2>
            <p className="font-mono text-xs text-gray-400">
              {skuOf(row)} · Size {sizeOf(row)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={statusOf(row)} />
              <ReorderBadge show={belowReorderOf(row)} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex shrink-0 gap-1 border-b border-gray-100 px-6 pt-3">
          {(
            [
              ['overview', 'Overview'],
              ['batches', `Batches${batches ? ` (${batches.length})` : ''}`],
              [
                'history',
                `History${movements ? ` (${movements.length})` : ''}`,
              ],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              role="tab"
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
                tab === id
                  ? 'border-b-2 border-[#b20202] text-[#b20202]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {tab === 'overview' && (
            <>
              {/* Quantities */}
              <section>
                <SectionTitle>Quantities</SectionTitle>
                <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/50 text-center">
                  <Kpi
                    label="On hand"
                    value={row.currentQuantity.toLocaleString()}
                    tone="strong"
                  />
                  <Kpi label="Reserved" value={row.reservedQuantity.toLocaleString()} />
                  <Kpi
                    label="Available"
                    value={availOf(row).toLocaleString()}
                    tone="accent"
                  />
                </div>
              </section>

              {/* Pricing */}
              <section>
                <SectionTitle>Pricing & value</SectionTitle>
                <div className="space-y-2 rounded-xl border border-gray-100 p-4">
                  <PriceRow
                    label="Cost price"
                    value={fmtMoney(cost, currency)}
                    hint={
                      typeof row.size === 'object' && row.size?.costPrice
                        ? 'Size-level cost'
                        : 'Sub-product cost'
                    }
                  />
                  <PriceRow
                    label="Selling price"
                    value={fmtMoney(sell, currency)}
                    hint={
                      typeof row.size === 'object' && row.size?.sellingPrice
                        ? 'Size-level price'
                        : 'Base selling price'
                    }
                  />
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="text-xs text-gray-500">
                      Margin{' '}
                      {marginPct !== null && (
                        <span
                          className={`ml-1 font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}
                        >
                          ({margin >= 0 ? '+' : ''}
                          {marginPct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                    <b
                      className={`tabular-nums ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}
                    >
                      {fmtMoney(margin, currency)}
                    </b>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="text-xs text-gray-500">
                      Stock value{' '}
                      <span className="text-gray-300">(on hand × cost)</span>
                    </span>
                    <b className="tabular-nums text-gray-900">
                      {fmtMoney(stockValue, currency)}
                    </b>
                  </div>
                </div>
              </section>

              {/* Location */}
              <section>
                <SectionTitle>Bin location</SectionTitle>
                {loc.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 p-4 text-sm text-gray-700">
                    <PiMapPin className="h-4 w-4 text-[#b20202]" />
                    {loc.map((part, i) => (
                      <span key={`${part}-${i}`} className="flex items-center gap-2">
                        {i > 0 && <span className="text-gray-300">·</span>}
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold">
                          {part}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <EmptyHint text="No zone/aisle/shelf/bin assigned for this line yet." />
                )}
              </section>
            </>
          )}

          {tab === 'batches' &&
            (batches === null ? (
              <LoadingRows />
            ) : batches.length === 0 ? (
              <EmptyHint
                icon={<PiStackBold className="h-6 w-6 text-gray-200" />}
                text="No batches tracked for this line in this warehouse."
              />
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div
                    key={b._id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gray-100 px-4 py-3 text-sm shadow-sm"
                  >
                    <span className="font-mono font-semibold text-gray-700">
                      {b.batchNumber}
                    </span>
                    <span className="tabular-nums text-gray-500">
                      {b.quantity} units
                    </span>
                    {b.expiryDate && (
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                          new Date(b.expiryDate).getTime() < Date.now()
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Exp{' '}
                        {new Date(b.expiryDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {tab === 'history' &&
            (movements === null ? (
              <LoadingRows />
            ) : movements.length === 0 ? (
              <EmptyHint
                icon={<PiArrowsClockwise className="h-6 w-6 text-gray-200" />}
                text="No stock movements recorded here yet."
              />
            ) : (
              <ol className="relative space-y-0 border-l border-gray-100 pl-4">
                {movements.map((m) => {
                  const meta = MOVEMENT_META[m.type];
                  return (
                    <li key={m._id} className="relative pb-4">
                      <span className="absolute -left-[21px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-gray-200" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                        <b className="tabular-nums text-sm text-gray-900">
                          {meta.signed === '+'
                            ? `+${m.quantity}`
                            : meta.signed === '-'
                              ? `−${m.quantity}`
                              : `→ ${m.balanceAfter}`}
                        </b>
                        <span className="text-xs text-gray-400">
                          bal. {m.balanceAfter}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {relDate(m.createdAt)}
                        {m.performedBy?.name
                          ? ` · by ${m.performedBy.name}`
                          : ''}
                        {m.reference ? ` · ${m.reference}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ))}
        </div>

        {/* ── Footer actions ── */}
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 p-4">
          <button
            type="button"
            disabled={!canOperate}
            onClick={() => onAdjust(row)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Adjust stock
          </button>
          <button
            type="button"
            disabled={!canOperate || availOf(row) <= 0}
            title={availOf(row) <= 0 ? 'Nothing available to transfer' : undefined}
            onClick={() => onTransfer(row)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-[#b20202] hover:text-[#b20202] disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300 disabled:hover:border-gray-100 disabled:hover:text-gray-300"
          >
            Transfer out
          </button>
          {subProductId && (
            <Link
              href={routes.eCommerce.editSubProduct(subProductId)}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
            >
              <PiArrowUpRightBold className="h-3.5 w-3.5" />
              Open full product page
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  );
}

function Kpi({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'strong' | 'accent';
}) {
  const cls =
    tone === 'accent'
      ? 'font-black text-[#b20202]'
      : tone === 'strong'
        ? 'font-bold text-gray-900'
        : 'font-semibold text-gray-600';
  return (
    <div className="px-2 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`mt-0.5 text-lg tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">
        {label}
        {hint && <span className="ml-1 text-gray-300">· {hint}</span>}
      </span>
      <b className="tabular-nums text-gray-900">{value}</b>
    </div>
  );
}

function EmptyHint({
  text,
  icon,
}: {
  text: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-12 text-center">
      {icon ?? <PiMapPin className="h-6 w-6 text-gray-200" />}
      <p className="max-w-xs text-sm text-gray-400">{text}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 py-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg bg-gray-100"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
