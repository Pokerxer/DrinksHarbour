'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import WarehouseAnalysis from '../warehouse-analysis';
import HistoryPanel from './history-panel';
import { fraunces } from '../../purchases/purchases-fonts';
import {
  PiChartBarBold,
  PiShoppingCartBold,
  PiArrowsLeftRightBold,
  PiClockCounterClockwiseBold,
  PiWarehouseBold,
  PiArrowLeftBold,
  PiMapPinBold,
} from 'react-icons/pi';

type Tab = 'stock' | 'purchases' | 'transfers' | 'movements';
const tabs: { id: Tab; label: string }[] = [
  { id: 'stock', label: 'Stock analysis' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'movements', label: 'Stock history' },
];
export default function LocationAnalysis({ warehouseId }: { warehouseId: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('stock');
  const [visited, setVisited] = useState<Tab[]>(['stock']);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectTab = (id: Tab) => {
    setTab(id);
    setVisited((value) => (value.includes(id) ? value : [...value, id]));
  };
  const icons = [
    PiChartBarBold,
    PiShoppingCartBold,
    PiArrowsLeftRightBold,
    PiClockCounterClockwiseBold,
  ];
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setWarehouse(null);
    setError('');
    if (!token) return;
    warehouseService
      .getWarehouseById(warehouseId, token)
      .then((result) => {
        if (active) setWarehouse((result as { data: Warehouse }).data);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load warehouse');
      });
    return () => {
      active = false;
    };
  }, [warehouseId, token, retry]);
  if (error)
    return (
      <div role="alert" className="rounded-xl border p-6">
        {error}
        <button className="ml-3 underline" onClick={() => setRetry((value) => value + 1)}>
          Retry
        </button>
      </div>
    );
  if (!warehouse)
    return (
      <p className="p-6">
        {status !== 'loading' && !token
          ? 'Sign in to view warehouse analysis.'
          : 'Loading warehouse…'}
      </p>
    );
  return (
    <div className="space-y-6">
      <Link
        href={routes.warehouses.detail(warehouseId)}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
      >
        <PiArrowLeftBold aria-hidden="true" /> <span>Back to warehouse</span>
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#b20202]/10 text-[#b20202]">
            <PiWarehouseBold className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#8b7a6b]">
              Warehouse analysis
            </p>
            <h1
              className={`${fraunces.className} text-2xl font-semibold text-[#2a2420] sm:text-3xl`}
            >
              {warehouse.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="rounded-md bg-[#f6f3ed] px-2 py-1 font-mono font-semibold text-[#65594e]">
                {warehouse.code}
              </span>
              <span className="capitalize">{warehouse.type?.replaceAll('_', ' ')}</span>
              {warehouse.address?.city && (
                <span className="inline-flex items-center gap-1">
                  <PiMapPinBold aria-hidden="true" />
                  {warehouse.address.city}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-gray-500">
          Explore stock levels, purchases and every stock movement at this location.
        </p>
      </header>
      <div
        role="tablist"
        aria-label="Warehouse analysis"
        className="grid grid-cols-2 gap-2 rounded-xl border border-[#ece4d6] bg-[#f6f3ed] p-1.5 lg:grid-cols-4"
      >
        {tabs.map((item, index) => {
          const Icon = icons[index];
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              onClick={() => selectTab(item.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                selectTab(tabs[next].id);
                tabRefs.current[next]?.focus();
              }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202] ${tab === item.id ? 'bg-white text-[#b20202] shadow-sm' : 'text-[#75695d] hover:bg-white/60'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      {visited.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`panel-${id}`}
          hidden={tab !== id}
          aria-labelledby={`tab-${id}`}
        >
          {id === 'stock' ? (
            <WarehouseAnalysis key={warehouseId} warehouseId={warehouseId} />
          ) : (
            <HistoryPanel warehouseId={warehouseId} token={token} tab={id} />
          )}
        </div>
      ))}
    </div>
  );
}
