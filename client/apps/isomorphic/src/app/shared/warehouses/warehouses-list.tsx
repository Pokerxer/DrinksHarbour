'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiPlus,
  PiPencilSimple,
  PiTrash,
  PiArrowRight,
  PiArrowsClockwise,
  PiWarehouse,
  PiStorefront,
  PiTruck,
  PiStar,
  PiCheckCircle,
  PiProhibit,
  PiMapPin,
  PiWarningCircle,
  PiX,
  PiBuildings,
  PiCheck,
} from 'react-icons/pi';
import {
  warehouseService,
  type Warehouse,
  type WarehouseInput,
} from '@/services/warehouse.service';
import { routes } from '@/config/routes';
import WarehousesNavHeader from './warehouses-nav-header';

const EMPTY: WarehouseInput = {
  name: '',
  code: '',
  type: 'warehouse',
  address: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  },
  contact: { name: '', phone: '', email: '' },
  notes: '',
  isActive: true,
  isDefault: false,
};

// ── type metadata ──────────────────────────────────────────────────────────────

const TYPE_META: Record<
  Warehouse['type'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  warehouse: {
    label: 'Warehouse',
    color: '#b20202',
    icon: <PiWarehouse className="h-4 w-4" />,
  },
  store: {
    label: 'Store',
    color: '#0ea5e9',
    icon: <PiStorefront className="h-4 w-4" />,
  },
  distribution_center: {
    label: 'Distribution',
    color: '#f97316',
    icon: <PiTruck className="h-4 w-4" />,
  },
};

function addressLine(w: Warehouse): string {
  const a = w.address ?? {};
  return (
    [a.line1, a.city, a.state, a.country].filter(Boolean).join(', ') ||
    'No address on file'
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border p-5 ${accent ? 'border-[#b20202]/20 bg-[#b20202]/5' : 'border-gray-200 bg-white'}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-500'}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-xl font-black tabular-nums leading-none ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Warehouse card ───────────────────────────────────────────────────────────────

function WarehouseCard({
  w,
  onView,
  onEdit,
  onDelete,
}: {
  w: Warehouse;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[w.type];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="h-1 w-full" style={{ background: meta.color }} />

      <div className="flex flex-1 flex-col p-6">
        {/* Title row */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-bold tracking-wide text-gray-900">
                {w.name}
              </h3>
              {w.isDefault && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  <PiStar weight="fill" className="h-3 w-3" />
                  Default
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
              <PiMapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{addressLine(w)}</span>
            </p>
          </div>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: meta.color }}
          >
            {meta.icon}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Code
            </p>
            <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-gray-900">
              {w.code}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Type
            </p>
            <p className="mt-0.5 truncate text-lg font-bold text-gray-900">
              {meta.label}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onView}
            className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101]"
          >
            View stock
            <PiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="flex items-center gap-2">
            {w.isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                <PiCheckCircle className="h-3.5 w-3.5" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                <PiProhibit className="h-3.5 w-3.5" />
                Inactive
              </span>
            )}
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <PiPencilSimple className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <PiTrash className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit modal ──────────────────────────────────────────────────────────

function WarehouseModal({
  editing,
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  editing: Warehouse | null;
  form: WarehouseInput;
  setForm: (f: WarehouseInput) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const field =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

  const setAddr = (
    key: keyof NonNullable<WarehouseInput['address']>,
    val: string
  ) => setForm({ ...form, address: { ...form.address, [key]: val } });
  const setContact = (
    key: keyof NonNullable<WarehouseInput['contact']>,
    val: string
  ) => setForm({ ...form, contact: { ...form.contact, [key]: val } });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PiWarehouse className="h-5 w-5 text-[#b20202]" />
            <span className="text-base font-semibold text-gray-900">
              {editing ? 'Edit warehouse' : 'New warehouse'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Details */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-700">
                Name
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Main Warehouse"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Code{' '}
                <span className="font-normal text-gray-400">
                  (auto-generated)
                </span>
                <input
                  readOnly
                  disabled
                  className={`mt-1.5 ${field} cursor-not-allowed bg-gray-50 text-gray-500`}
                  value={form.code || (editing ? '' : 'Assigned on save')}
                  placeholder="Assigned on save"
                />
              </label>
              <label className="col-span-2 text-sm font-medium text-gray-700">
                Type
                <select
                  className={`mt-1.5 ${field}`}
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as Warehouse['type'],
                    })
                  }
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="distribution_center">
                    Distribution center
                  </option>
                </select>
              </label>
            </div>
          </section>

          {/* Address */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Address
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2 text-sm font-medium text-gray-700">
                Street address
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.address?.line1 ?? ''}
                  onChange={(e) => setAddr('line1', e.target.value)}
                  placeholder="39 Gana St"
                />
              </label>
              <label className="col-span-2 text-sm font-medium text-gray-700">
                Address line 2{' '}
                <span className="font-normal text-gray-400">(optional)</span>
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.address?.line2 ?? ''}
                  onChange={(e) => setAddr('line2', e.target.value)}
                  placeholder="Suite, unit, building"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                City
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.address?.city ?? ''}
                  onChange={(e) => setAddr('city', e.target.value)}
                  placeholder="Abuja"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                State / Region
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.address?.state ?? ''}
                  onChange={(e) => setAddr('state', e.target.value)}
                  placeholder="FCT"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Country
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.address?.country ?? ''}
                  onChange={(e) => setAddr('country', e.target.value)}
                  placeholder="Nigeria"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Postal code
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.address?.postalCode ?? ''}
                  onChange={(e) => setAddr('postalCode', e.target.value)}
                  placeholder="900101"
                />
              </label>
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Contact
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2 text-sm font-medium text-gray-700">
                Contact name
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.contact?.name ?? ''}
                  onChange={(e) => setContact('name', e.target.value)}
                  placeholder="Warehouse manager"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Phone
                <input
                  type="tel"
                  className={`mt-1.5 ${field}`}
                  value={form.contact?.phone ?? ''}
                  onChange={(e) => setContact('phone', e.target.value)}
                  placeholder="+234…"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  className={`mt-1.5 ${field}`}
                  value={form.contact?.email ?? ''}
                  onChange={(e) => setContact('email', e.target.value)}
                  placeholder="depot@drinksharbour.com"
                />
              </label>
            </div>
          </section>

          {/* Notes */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Notes
            </p>
            <textarea
              rows={3}
              className={`${field} resize-none`}
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Operating hours, access instructions, anything worth remembering…"
            />
          </section>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                form.isActive
                  ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {form.isActive && <PiCheck className="h-4 w-4 shrink-0" />}
              Active
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, isDefault: !form.isDefault })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                form.isDefault
                  ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {form.isDefault && <PiCheck className="h-4 w-4 shrink-0" />}
              Default
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────────

export default function WarehousesList() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [items, setItems] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WarehouseInput>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await warehouseService.getWarehouses(token);
      setItems(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  };
  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setForm({
      name: w.name,
      code: w.code,
      type: w.type,
      address: w.address ?? {},
      contact: w.contact ?? {},
      notes: w.notes ?? '',
      isActive: w.isActive,
      isDefault: w.isDefault,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing)
        await warehouseService.updateWarehouse(editing._id, form, token);
      else await warehouseService.createWarehouse(form, token);
      toast.success(editing ? 'Updated' : 'Created');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (w: Warehouse) => {
    if (!confirm(`Delete warehouse "${w.name}"?`)) return;
    try {
      await warehouseService.deleteWarehouse(w._id, token);
      toast.success('Deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  // ── derived stats ──
  const total = items.length;
  const activeCount = items.filter((w) => w.isActive).length;
  const storeCount = items.filter((w) => w.type === 'store').length;
  const defaultWh = items.find((w) => w.isDefault);

  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      {/* ── Nav ── */}
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <WarehousesNavHeader />
      </div>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 py-8 md:px-10 lg:px-14"
        style={{
          background:
            'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
              <Image
                src="/logo-short.svg"
                alt="DrinksHarbour"
                width={38}
                height={38}
                className="rounded-xl"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200">
                DrinksHarbour
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-white">
                Warehouses
              </h1>
              <p className="mt-0.5 text-sm text-red-200">
                Manage stock locations, stores & distribution centers
              </p>
            </div>
          </div>

          {/* Hero actions */}
          <div className="flex items-center gap-3">
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              title="Refresh"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#b20202] transition-colors hover:bg-red-50"
            >
              <PiPlus className="h-4 w-4" />
              New warehouse
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 bg-gray-50 px-6 pb-10 pt-6 md:px-10 lg:px-14">
        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Locations"
            value={String(total)}
            sub={`${total - activeCount} inactive`}
            icon={<PiBuildings className="h-5 w-5" />}
            accent
          />
          <StatCard
            label="Active"
            value={String(activeCount)}
            sub="Currently in use"
            icon={<PiCheckCircle className="h-5 w-5" />}
          />
          <StatCard
            label="Stores"
            value={String(storeCount)}
            sub="Retail-facing"
            icon={<PiStorefront className="h-5 w-5" />}
          />
          <StatCard
            label="Default"
            value={defaultWh?.name ?? '—'}
            sub={defaultWh ? `Code ${defaultWh.code}` : 'None set'}
            icon={<PiStar className="h-5 w-5" />}
          />
        </div>

        {/* Section label */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            All Warehouses
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl border border-gray-200 bg-white"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PiWarningCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">
              No warehouses yet
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              Create your first stock location to get started.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
            >
              <PiPlus className="h-4 w-4" /> New warehouse
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((w) => (
              <WarehouseCard
                key={w._id}
                w={w}
                onView={() => router.push(routes.warehouses.detail(w._id))}
                onEdit={() => openEdit(w)}
                onDelete={() => remove(w)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <WarehouseModal
          editing={editing}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setShowForm(false)}
          onSave={save}
        />
      )}
    </div>
  );
}
