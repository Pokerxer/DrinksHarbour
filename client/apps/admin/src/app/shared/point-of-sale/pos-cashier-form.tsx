'use client';

import { useState } from 'react';
import type { POSCashier } from '@/app/shared/point-of-sale/types';
import { PiX } from 'react-icons/pi';

interface FormPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  posName: string;
  pin: string;
  posAccess: boolean;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-gray-600">
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </span>
        {hint && <span className="text-[11px] font-normal text-gray-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10';

export default function CashierFormModal({
  cashier,
  onClose,
  onSave,
}: {
  cashier?: POSCashier;
  onClose: () => void;
  onSave: (payload: FormPayload) => void;
}) {
  const isEdit = Boolean(cashier);
  const [form, setForm] = useState<FormPayload>({
    firstName: cashier?.firstName ?? '',
    lastName: cashier?.lastName ?? '',
    email: cashier?.email ?? '',
    phone: cashier?.phone ?? '',
    posName: cashier?.posName ?? '',
    pin: '',
    posAccess: cashier?.posAccess ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormPayload>(key: K, value: FormPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  function handleSave() {
    if (!form.firstName.trim()) return setError('First name is required');
    if (!form.email.trim()) return setError('Email is required');
    if (form.pin && !/^\d{4,6}$/.test(form.pin))
      return setError('PIN must be 4–6 digits');
    if (!isEdit && !form.pin)
      return setError('A 4–6 digit PIN is required for a new cashier');

    setSaving(true);
    // Let the parent own the API call + toasts; it closes the modal on success.
    onSave({
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      posName: form.posName.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div className="flex w-full sm:w-[480px] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[#b20202] px-5 py-4">
          <h3 className="text-sm font-bold text-white">
            {isEdit ? 'Edit Cashier' : 'New Cashier'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" required>
                <input
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder="e.g. Ada"
                />
              </Field>
              <Field label="Last name">
                <input
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  placeholder="e.g. Obi"
                />
              </Field>
            </div>

            <Field label="Email" required>
              <input
                className={inputClass}
                type="email"
                value={form.email}
                disabled={isEdit}
                onChange={(e) => set('email', e.target.value)}
                placeholder="cashier@shop.com"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="e.g. 0801 234 5678"
                />
              </Field>
              <Field label="POS name" hint="shown on receipts">
                <input
                  className={inputClass}
                  value={form.posName}
                  onChange={(e) => set('posName', e.target.value)}
                  placeholder="Defaults to first name"
                />
              </Field>
            </div>

            <Field
              label="PIN"
              required={!isEdit}
              hint={isEdit ? 'blank keeps current PIN' : '4–6 digits'}
            >
              <input
                className={inputClass}
                type="password"
                inputMode="numeric"
                value={form.pin}
                onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))}
                placeholder={isEdit ? '••••' : 'e.g. 4321'}
              />
            </Field>

            {isEdit && (
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">
                  POS access
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.posAccess}
                  onClick={() => set('posAccess', !form.posAccess)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.posAccess ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      form.posAccess ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#b20202] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create Cashier'}
          </button>
        </div>
      </div>
    </div>
  );
}
