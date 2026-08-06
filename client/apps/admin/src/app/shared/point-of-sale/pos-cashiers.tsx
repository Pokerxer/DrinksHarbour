'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSCashier } from '@/app/shared/point-of-sale/types';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import CashierFormModal from '@/app/shared/point-of-sale/pos-cashier-form';
import {
  PiIdentificationCardDuotone,
  PiPencilSimple,
  PiPlus,
  PiTrash,
  PiWarningCircle,
} from 'react-icons/pi';

// Server guards /api/pos/cashiers* with tenantAdminOrSuperAdmin; the UI hides
// the management actions from tenant_staff so the page degrades to read-only
// instead of erroring on every click.
const MANAGE_ROLES = ['super_admin', 'admin', 'tenant_admin', 'tenant_owner'];

function initials(c: POSCashier) {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    tenant_admin: 'bg-violet-50 text-violet-600',
    tenant_owner: 'bg-amber-50 text-amber-600',
    tenant_staff: 'bg-gray-100 text-gray-600',
  };
  const label: Record<string, string> = {
    tenant_admin: 'Admin',
    tenant_owner: 'Owner',
    tenant_staff: 'Staff',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        styles[role] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {label[role] ?? role}
    </span>
  );
}

export default function POSCashiers() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? null;
  const role = session?.user?.role ?? '';
  const canManage = MANAGE_ROLES.includes(role);

  const [cashiers, setCashiers] = useState<POSCashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; cashier: POSCashier }
    | null
  >(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    posApi
      .listCashiers(token)
      .then((data) => setCashiers(data.cashiers))
      .catch((err: Error) => setError(err.message || 'Failed to load cashiers'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSave(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    posName: string;
    pin: string;
    posAccess: boolean;
  }) {
    if (!token) return;
    const isEdit = modal?.mode === 'edit';
    const id = isEdit && modal.mode === 'edit' ? modal.cashier._id : null;
    const request = isEdit
      ? posApi.updateCashier(token, id!, {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          posName: payload.posName,
          posAccess: payload.posAccess,
          // Blank on edit = keep current PIN.
          ...(payload.pin ? { pin: payload.pin } : {}),
        })
      : posApi.createCashier(token, {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          posName: payload.posName,
          ...(payload.pin ? { pin: payload.pin } : {}),
        });

    request
      .then(() => {
        toast.success(isEdit ? 'Cashier updated' : 'Cashier created');
        setModal(null);
        load();
      })
      .catch((err: Error) => toast.error(err.message || 'Save failed'));
  }

  function handleDelete(cashier: POSCashier) {
    if (!token) return;
    setDeletingId(cashier._id);
    posApi
      .deleteCashier(token, cashier._id)
      .then(() => {
        toast.success('Cashier removed');
        setConfirmingId(null);
        setCashiers((prev) => prev.filter((c) => c._id !== cashier._id));
      })
      .catch((err: Error) => toast.error(err.message || 'Delete failed'))
      .finally(() => setDeletingId(null));
  }

  return (
    <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
      <POSNavHeader />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Cashiers</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            POS staff accounts &amp; PIN access for this store.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
          >
            <PiPlus className="h-4 w-4" />
            Add Cashier
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            Loading cashiers…
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <PiWarningCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-gray-600">{error}</p>
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        ) : cashiers.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <PiIdentificationCardDuotone className="h-7 w-7 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">
                No cashiers yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-gray-400">
                Add your first cashier so staff can sign in to the POS terminal
                with a PIN.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setModal({ mode: 'create' })}
                className="flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
              >
                <PiPlus className="h-4 w-4" />
                Add Cashier
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {cashiers.map((cashier) => {
              const isConfirming = confirmingId === cashier._id;
              const isDeleting = deletingId === cashier._id;
              return (
                <div
                  key={cashier._id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                    {initials(cashier)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {cashier.firstName} {cashier.lastName}
                      </p>
                      <RoleBadge role={cashier.role} />
                      {cashier.posAccess === false && (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-500">
                          POS disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {cashier.posName ? `${cashier.posName} · ` : ''}
                      {cashier.email}
                      {cashier.phone ? ` · ${cashier.phone}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      {isConfirming ? (
                        <>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDelete(cashier)}
                            className="flex h-8 items-center rounded-lg bg-red-50 px-2.5 text-xs font-bold text-red-500 hover:bg-red-100 disabled:opacity-50"
                          >
                            {isDeleting ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            title="Edit cashier"
                            onClick={() =>
                              setModal({ mode: 'edit', cashier })
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete cashier"
                            onClick={() => setConfirmingId(cashier._id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <CashierFormModal
          cashier={modal.mode === 'edit' ? modal.cashier : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
