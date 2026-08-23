'use client';

// app/shared/warehouses/warehouse-detail/detail-header.tsx
// Identity hero: name, code, type, location, contact, active/default chips —
// plus the page-level actions (Edit, Export, Refresh).

import { useRouter } from 'next/navigation';
import {
  PiArrowLeft,
  PiArrowsClockwise,
  PiMapPin,
  PiPackageBold,
  PiPencilSimpleBold,
  PiStarBold,
} from 'react-icons/pi';
import type { Warehouse } from '@/services/warehouse.service';
import { routes } from '@/config/routes';
import { fraunces } from '../../purchases/purchases-fonts';

export default function DetailHeader({
  warehouse,
  loading,
  onEdit,
  onRefresh,
  exportSlot,
}: {
  warehouse: Warehouse | null;
  loading: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  exportSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const addr = warehouse?.address
    ? [warehouse.address.city, warehouse.address.state]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div>
      <LinkBack />

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#ece4d6] bg-white p-6 shadow-sm">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10 text-[#b20202]">
            <PiPackageBold className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1
              className={`${fraunces.className} truncate text-2xl font-semibold text-[#2a2420]`}
            >
              {warehouse?.name ?? 'Warehouse'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              {(warehouse?.code || !warehouse) && (
                <span className="font-mono font-semibold text-gray-700">
                  {warehouse?.code ?? '···'}
                </span>
              )}
              {warehouse?.type && (
                <span className="capitalize">
                  {warehouse.type.replace('_', ' ')}
                </span>
              )}
              {addr && (
                <span className="inline-flex items-center gap-1">
                  <PiMapPin className="h-3.5 w-3.5" />
                  {addr}
                </span>
              )}
              {warehouse && (
                <>
                  <ActiveChip active={warehouse.isActive} />
                  <DefaultChip isDefault={warehouse.isDefault} />
                </>
              )}
            </div>
            {warehouse?.contact?.name && (
              <p className="mt-1 text-xs text-gray-400">
                Contact: {warehouse.contact.name}
                {warehouse.contact.phone ? ` · ${warehouse.contact.phone}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rendered by the parent so it can pass live filter context */}
          {exportSlot}
          <button
            type="button"
            onClick={onEdit}
            disabled={!warehouse}
            className="inline-flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PiPencilSimpleBold className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <PiArrowsClockwise
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkBack() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(routes.warehouses.list)}
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#b20202]"
    >
      <PiArrowLeft className="h-4 w-4" /> Warehouses
    </button>
  );
}

export function ActiveChip({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      Inactive
    </span>
  );
}

function DefaultChip({ isDefault }: { isDefault: boolean }) {
  if (!isDefault) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
      <PiStarBold className="h-3 w-3" /> Default
    </span>
  );
}
