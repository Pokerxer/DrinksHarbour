'use client';
import { useState, useRef, useEffect } from 'react';
import POSLocationSelect from './pos-location-select';
import { posApi } from '../api';
import type { POSShop } from '../types';
import { PiStorefront, PiX, PiCheck } from 'react-icons/pi';
export default function NewShopModal({
  onClose,
  onCreated,
  token,
}: {
  onClose: () => void;
  onCreated: (shop: POSShop) => void;
  token: string;
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'retail' | 'wholesale'>('retail');
  const [color, setColor] = useState('#b20202');
  const [desc, setDesc] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Shop name is required');
      return;
    }
    if (!warehouse) {
      setError('Select a stock location');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { shop } = await posApi.createShop(token, {
        name: name.trim(),
        mode,
        color,
        description: desc,
        warehouse,
      });
      onCreated(shop);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PiStorefront className="h-5 w-5 text-[#b20202]" />
            <span className="text-base font-semibold text-gray-900">
              New Shop
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

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <POSLocationSelect
            token={token}
            value={warehouse}
            onChange={setWarehouse}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Shop Name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DRIVE-THRU, ONLINE, VIP BAR"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['retail', 'wholesale'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === m
                      ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {mode === m && <PiCheck className="h-4 w-4 shrink-0" />}
                  <span className="capitalize">{m}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {mode === 'retail'
                ? 'Walk-in customers, cashier-facing.'
                : 'Bulk & account-based orders, manager-facing.'}
            </p>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                />
                <span className="font-mono text-xs text-gray-500">{color}</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Short description"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !warehouse}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
