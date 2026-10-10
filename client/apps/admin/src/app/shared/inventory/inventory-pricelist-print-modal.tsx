'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiTag, PiX } from 'react-icons/pi';
import { useTenant } from '@/context/TenantContext';
import type { StockRow } from '@/services/warehouseStock.service';
import { downloadPricelistPdf } from '@/utils/print/pricelist-print';
import {
  downloadPricelistCsv,
  printCustomerPricelist,
  resolvePricelistOrigin,
  type ScopeSelection,
  type PricelistPrintOptions,
} from './inventory-pricelist-print';
import { resolveExportRows } from './inventory-pricelist-data';
import { useInventoryPricelistData } from './use-inventory-pricelist-data';
import {
  defaultPricelistSettings,
  restorePricelistSettings,
  type PricelistSettings,
} from './inventory-pricelist-settings';
import type { PriceColumn } from './inventory-pricelist-columns';
import ScopePicker from './inventory-pricelist-scope-picker';
import ColumnPicker from './inventory-pricelist-column-picker';
import DocumentOptions from './inventory-pricelist-document-options';
import Preview from './inventory-pricelist-preview';

interface Props {
  open: boolean;
  rows: StockRow[];
  onClose: () => void;
}
/** Scope changes and closing discard outstanding requests, caches and form state. */
export default function PricelistPrintModal(props: Props) {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const user = session?.user as
    | { token?: string; id?: string; _id?: string; email?: string }
    | undefined;
  const token = user?.token ?? '';
  const storageKey = `dh-inventory-pricelist-print-v2:${tenant?._id ?? 'platform'}:${user?.id ?? user?._id ?? user?.email ?? 'anonymous'}`;
  if (!props.open) return null;
  return (
    <PricelistModalContents
      key={`${storageKey}:${token}`}
      {...props}
      token={token}
      storageKey={storageKey}
    />
  );
}

function PricelistModalContents({
  rows,
  onClose,
  token,
  storageKey,
}: Props & { token: string; storageKey: string }) {
  const { tenant } = useTenant();
  const [settings, setSettings] = useState<PricelistSettings>(() => {
    try {
      return restorePricelistSettings(
        JSON.parse(localStorage.getItem(storageKey) || 'null')
      );
    } catch {
      return defaultPricelistSettings();
    }
  });
  const [scopeMode, setScopeMode] = useState<'current' | 'select'>('current');
  const [scope, setScope] = useState<ScopeSelection>({
    categories: [],
    subCategories: [],
    brands: [],
    productIds: [],
  });
  const data = useInventoryPricelistData(
    token,
    settings.columns.map((c) => c.plId),
    scopeMode === 'select'
  );
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      /* Optional persistence. */
    }
  }, [settings, storageKey]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  const effectiveRows = useMemo(
    () => resolveExportRows(scopeMode, scope, data.catalog, rows),
    [scopeMode, scope, data.catalog, rows]
  );
  const origin = resolvePricelistOrigin(
    effectiveRows,
    tenant?.name,
    data.warehouses
  );
  const columns: PriceColumn[] = settings.columns.map((c) => {
    const pricelist = c.plId ? (data.details[c.plId]?.data ?? null) : null;
    return {
      label:
        c.label.trim() ||
        pricelist?.name ||
        (c.plId
          ? data.pricelists.find((p) => p._id === c.plId)?.name ||
            'Unavailable pricelist'
          : 'Recommended Sales Price'),
      pricelist,
      mode: c.mode,
    };
  });
  const canExport =
    data.ready && effectiveRows.length > 0 && columns.length > 0;
  const options: PricelistPrintOptions = {
    ...settings,
    title: settings.title.trim() || 'Price List',
    priceColumns: columns,
    originName: origin.name,
    originWarehouseCount: origin.warehouseCount,
    originHead:
      origin.head ??
      (tenant
        ? {
            address: tenant.address?.formatted || tenant.address?.street || '',
            city: [
              tenant.address?.city,
              tenant.address?.state,
              tenant.address?.country,
            ]
              .filter(Boolean)
              .join(', '),
            email: tenant.contactEmail || tenant.email || '',
            phone: tenant.contactPhone || tenant.phone || '',
          }
        : undefined),
  };
  function exportList(kind: 'print' | 'pdf' | 'csv') {
    if (!canExport) {
      toast.error(
        'Load the selected rules and choose products and price columns first'
      );
      return;
    }
    try {
      if (kind === 'csv') downloadPricelistCsv(effectiveRows, null, options);
      else if (kind === 'pdf')
        downloadPricelistPdf(effectiveRows, null, options);
      else printCustomerPricelist(effectiveRows, null, options);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not generate the pricelist'
      );
    }
  }
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricelist-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <PiTag className="h-5 w-5 text-[#b20202]" />
            <div>
              <h2
                id="pricelist-title"
                className="text-sm font-bold text-gray-900"
              >
                Generate customer pricelist
              </h2>
              <p className="text-xs text-gray-500">
                {effectiveRows.length} stock lines · {columns.length} price
                columns
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-700">
              What&apos;s on the list
            </h3>
            <div className="flex gap-2">
              {(
                [
                  {
                    key: 'current',
                    label: `Current selection / view (${rows.length})`,
                  },
                  { key: 'select', label: 'Choose products…' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={scopeMode === m.key}
                  onClick={() => setScopeMode(m.key)}
                  className={`rounded-lg px-3 py-2 text-xs ${scopeMode === m.key ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {scopeMode === 'select' && (
              <>
                <ScopePicker
                  catalog={data.catalog}
                  loading={data.catalogLoading}
                  selection={scope}
                  onChange={setScope}
                />
                <p className="text-[11px] text-gray-500">
                  Choose categories, sub-categories, brands or products.
                  Matching any selection includes the product.
                </p>
              </>
            )}
            {!effectiveRows.length && (
              <p className="text-xs text-amber-700">
                Choose at least one product or return to the current view.
              </p>
            )}
          </section>
          <ColumnPicker
            pricelists={data.pricelists}
            loading={data.listLoading}
            columns={settings.columns}
            onChange={(columns) => setSettings((s) => ({ ...s, columns }))}
          />
          {!!data.errors.length && (
            <div
              role="alert"
              className="space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {data.errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
              <button
                type="button"
                onClick={data.retry}
                className="font-semibold underline"
              >
                Retry loading
              </button>
            </div>
          )}
          <DocumentOptions settings={settings} onChange={setSettings} />
          <Preview
            rows={effectiveRows}
            columns={columns}
            discountPercent={settings.discountPercent}
            ready={data.ready}
          />
          <p className="text-[11px] text-gray-500">
            Letterhead: {origin.name || 'DrinksHarbour'}. Stock merges per
            product and size across locations. PDF and print open the document
            preview.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          {(['csv', 'pdf', 'print'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={!canExport}
              onClick={() => exportList(kind)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${kind === 'print' ? 'bg-[#b20202] text-white' : 'border border-gray-200 text-gray-600'}`}
            >
              {kind === 'print' ? 'Preview & Print' : kind.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
