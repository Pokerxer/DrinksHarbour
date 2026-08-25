'use client';

import { useState, useRef, useEffect } from 'react';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiCheckCircle,
  PiSpinner,
} from 'react-icons/pi';
import type { CartCustomer } from '@/app/shared/point-of-sale/store';
import { POSCustomer } from '@/app/shared/point-of-sale/types';
import { posApi } from '@/app/shared/point-of-sale/api';
import toast from 'react-hot-toast';

export default function CustomerModal({
  current,
  token,
  onSelectCustomer,
  onClose,
}: {
  current: CartCustomer;
  token: string | null;
  onSelectCustomer: (c: POSCustomer | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<POSCustomer[]>([]);
  const [searching, setSearching] = useState(false);

  // Create new customer form
  const [showCreate, setShowCreate] = useState(false);
  const [cFirst, setCFirst] = useState('');
  const [cLast, setCLast] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!token) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await posApi.searchCustomers(token, search.trim(), 15);
        setResults(data.customers);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, token]);

  // Load recent customers on open
  useEffect(() => {
    if (!token || search.trim()) return;
    posApi
      .searchCustomers(token, '', 10)
      .then((d) => setResults(d.customers))
      .catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!token || !cFirst.trim()) return;
    setCreating(true);
    try {
      const data = await posApi.createCustomer(token, {
        firstName: cFirst.trim(),
        lastName: cLast.trim(),
        phone: cPhone.trim(),
        email: cEmail.trim(),
      });
      onSelectCustomer(data.customer);
    } catch (err: unknown) {
      // If duplicate phone, the API returns 409 with the existing customer
      const body = (err as { customer?: POSCustomer })?.customer;
      if (body) {
        onSelectCustomer(body);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to create customer'
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Close
          </button>
          <div className="relative flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-[#b20202]"
            />
          </div>
          {searching && (
            <PiSpinner className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
          )}
        </div>

        {/* Results list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Walk-in */}
          <button
            type="button"
            onClick={() => onSelectCustomer(null)}
            className={`flex w-full items-center justify-between border-b border-gray-50 px-5 py-3 text-left text-sm hover:bg-gray-50 ${
              !current.customerId ? 'bg-amber-50' : ''
            }`}
          >
            <div>
              <p className="font-semibold text-gray-700">Walk-in Customer</p>
              <p className="text-[10px] text-gray-400">No loyalty tracking</p>
            </div>
            {!current.customerId && (
              <PiCheckCircle className="h-4 w-4 text-amber-500" />
            )}
          </button>

          {results.map((c) => {
            const isSelected = current.customerId === String(c._id);
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => onSelectCustomer(c)}
                className={`flex w-full items-center justify-between border-b border-gray-50 px-5 py-3 text-left transition-colors hover:bg-gray-50 ${
                  isSelected ? 'bg-red-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold leading-tight ${isSelected ? 'text-[#b20202]' : 'text-gray-800'}`}
                  >
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {c.phone || c.email || 'No contact'}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-xs font-bold text-amber-600">
                    {c.loyaltyPoints.toLocaleString()} pts
                  </p>
                  {c.totalOrders ? (
                    <p className="text-[10px] text-gray-400">
                      {c.totalOrders} orders
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}

          {!search.trim() && results.length === 0 && !searching && (
            <p className="px-5 py-4 text-center text-xs text-gray-400">
              No customers yet — create one below
            </p>
          )}
          {search.trim() && results.length === 0 && !searching && (
            <p className="px-5 py-4 text-center text-xs text-gray-400">
              No customers found for &ldquo;{search}&rdquo;
            </p>
          )}
        </div>

        {/* Create new customer */}
        <div className="shrink-0 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="flex w-full items-center gap-2 px-5 py-3 text-xs font-bold text-[#b20202] transition-colors hover:bg-red-50"
          >
            <PiPlus className="h-3.5 w-3.5" />
            {showCreate ? 'Hide form' : 'Create new customer'}
          </button>
          {showCreate && (
            <div className="space-y-2 border-t border-gray-100 px-5 pb-4 pt-3">
              <div className="flex gap-2">
                <input
                  value={cFirst}
                  onChange={(e) => setCFirst(e.target.value)}
                  placeholder="First name *"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
                <input
                  value={cLast}
                  onChange={(e) => setCLast(e.target.value)}
                  placeholder="Last name"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="Phone"
                  type="tel"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
                <input
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!cFirst.trim() || creating}
                className="w-full rounded-lg py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#b20202' }}
              >
                {creating ? 'Creating…' : 'Create & Select'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
