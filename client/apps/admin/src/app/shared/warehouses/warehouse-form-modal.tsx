'use client';

// app/shared/warehouses/warehouse-form-modal.tsx
//
// Create / edit warehouse modal, shared by the warehouses list and the
// warehouse detail page. Extracted verbatim from warehouses-list.tsx so both
// surfaces stay in sync; the list owns create/delete, the detail page only
// ever opens this in edit mode.

import { useEffect } from 'react';
import { PiCheck, PiWarehouse, PiX } from 'react-icons/pi';
import {
  type Warehouse,
  type WarehouseInput,
} from '@/services/warehouse.service';

export const EMPTY_WAREHOUSE_FORM: WarehouseInput = {
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

/** Map an existing Warehouse onto the editable form shape. */
export const warehouseToForm = (w: Warehouse): WarehouseInput => ({
  name: w.name,
  code: w.code,
  type: w.type,
  address: w.address ?? {},
  contact: w.contact ?? {},
  notes: w.notes ?? '',
  isActive: w.isActive,
  isDefault: w.isDefault,
});

export default function WarehouseModal({
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

