'use client';

import { useEffect, useState } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { PiMagnifyingGlass, PiPlus, PiUserBold } from 'react-icons/pi';
import {
  whatsappOrderService,
  type WhatsAppCustomer,
} from '@/services/whatsapp-order.service';
import {
  SUGGESTION_MENU,
  SUGGESTION_ROW,
} from '../sales/sales-dropdown-styles';

export interface CustomerDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  _id?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  needsPhone?: boolean;
  needsLastName?: boolean;
}

const EMPTY_CUSTOMER: CustomerDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};
const fieldClass =
  'min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function BuilderCustomerBar({
  value,
  onChange,
  token,
  liveLoyalty,
  loyaltyLoading,
  loyaltyUnavailable,
}: {
  value: CustomerDraft;
  onChange: (customer: CustomerDraft) => void;
  token: string;
  liveLoyalty?: Pick<WhatsAppCustomer, 'loyaltyPoints' | 'loyaltyTier'>;
  loyaltyLoading?: boolean;
  loyaltyUnavailable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<{
    term: string;
    customers?: WhatsAppCustomer[];
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const term = search.trim();
  const current = result?.term === term ? result : null;
  const loyalty = liveLoyalty ?? value;

  useEffect(() => {
    if (!token || value._id || adding) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      whatsappOrderService
        .searchCustomers(token, term, controller.signal)
        .then(({ customers }) => {
          if (!controller.signal.aborted) setResult({ term, customers });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ term });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [token, term, value._id, adding]);

  function select(customer: WhatsAppCustomer | null) {
    if (!customer) return;
    onChange({
      ...customer,
      needsPhone: !customer.phone,
      needsLastName: !customer.lastName,
    });
    setSearch('');
    setAdding(false);
  }

  function startAdding() {
    const phone = /^\+?[\d\s().-]+$/.test(term);
    const [firstName, ...lastName] = term.split(/\s+/);
    const email = term.includes('@');
    setForm({
      firstName: phone || email ? value.firstName : firstName,
      lastName: phone || email ? value.lastName : lastName.join(' '),
      email: email ? term : value.email,
      phone: phone ? term : value.phone,
    });
    setSaveError(undefined);
    setAdding(true);
  }

  async function save() {
    if (saving) return;
    setSaveError(undefined);
    setSaving(true);
    try {
      const { customer } = await whatsappOrderService.saveCustomer(token, form);
      select(customer);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save customer'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <PiUserBold className="text-brand" /> Customer
        </h2>
      </div>
      <div className="p-4">
        {value._id ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {value.firstName} {value.lastName}
                </p>
                <p className="break-words text-xs text-gray-600">
                  {[value.email, value.phone].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-700">
                  {loyalty.loyaltyPoints?.toLocaleString() ?? '0'} loyalty
                  points ·{' '}
                  <span className="capitalize">
                    {loyalty.loyaltyTier ?? 'cork'}
                  </span>
                  {loyaltyLoading && (
                    <span className="ml-2 text-gray-500">Refreshing…</span>
                  )}
                  {loyaltyUnavailable && (
                    <span className="ml-2 text-gray-500">
                      Last known balance
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  onChange(EMPTY_CUSTOMER);
                }}
                className="text-xs font-semibold text-brand"
              >
                Change customer
              </button>
            </div>
            {(value.needsLastName || !value.lastName) && (
              <label className="mt-3 block text-sm">
                Last name for this order
                <input
                  className={fieldClass}
                  value={value.lastName}
                  onChange={(e) =>
                    onChange({ ...value, lastName: e.target.value })
                  }
                />
              </label>
            )}
            {(value.needsPhone || !value.phone) && (
              <label className="mt-3 block text-sm">
                Phone for this order
                <input
                  type="tel"
                  className={fieldClass}
                  value={value.phone}
                  onChange={(e) =>
                    onChange({ ...value, phone: e.target.value })
                  }
                />
              </label>
            )}
          </>
        ) : adding ? (
          <fieldset disabled={saving}>
            <legend className="mb-3 text-sm font-semibold">Add customer</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['firstName', 'First name', 'text'],
                  ['lastName', 'Last name', 'text'],
                  ['email', 'Email', 'email'],
                  ['phone', 'WhatsApp phone', 'tel'],
                ] as const
              ).map(([key, label, type]) => (
                <label
                  key={key}
                  className="space-y-1 text-xs font-medium text-gray-700"
                >
                  {label}
                  <input
                    type={type}
                    className={fieldClass}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((previous) => ({
                        ...previous,
                        [key]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            {saveError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {saveError}
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={
                  !token ||
                  saving ||
                  ![
                    form.firstName,
                    form.lastName,
                    form.email,
                    form.phone,
                  ].every((field) => field.trim())
                }
                onClick={save}
              >
                {saving ? 'Saving…' : 'Save customer'}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
            </div>
          </fieldset>
        ) : (
          <Combobox
            immediate
            value={null}
            onChange={(choice: WhatsAppCustomer | 'add' | null) => {
              if (choice === 'add') startAdding();
              else select(choice);
            }}
          >
            <div className="relative">
              <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <ComboboxInput
                aria-label="Search customers"
                placeholder="Search by name, phone or email"
                value={search}
                className={`${fieldClass} pl-9`}
                onChange={(event) => setSearch(event.target.value)}
              />
              <ComboboxOptions
                modal={false}
                className={`${SUGGESTION_MENU} max-h-64 overflow-y-auto`}
              >
                {!current ? (
                  <p className="px-3 py-2 text-sm text-gray-500" role="status">
                    Searching…
                  </p>
                ) : !current.customers ? (
                  <p className="px-3 py-2 text-sm text-red-700" role="alert">
                    Could not load customers. Edit your search to try again.
                  </p>
                ) : current.customers.length ? (
                  current.customers.map((customer) => (
                    <ComboboxOption
                      key={customer._id}
                      value={customer}
                      className={`cursor-pointer px-3 py-2 ${SUGGESTION_ROW} data-[focus]:bg-gray-100`}
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[customer.phone, customer.email]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </ComboboxOption>
                  ))
                ) : (
                  <>
                    <p className="px-3 py-2 text-sm text-gray-500">
                      No matching customers
                    </p>
                    <ComboboxOption
                      as="button"
                      type="button"
                      value="add"
                      className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-3 text-left text-sm font-semibold text-brand data-[focus]:bg-gray-100"
                    >
                      <PiPlus /> Add customer
                    </ComboboxOption>
                  </>
                )}
              </ComboboxOptions>
            </div>
          </Combobox>
        )}
      </div>
    </section>
  );
}
