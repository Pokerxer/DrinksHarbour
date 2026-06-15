'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiPlus, PiPencilSimple, PiTrash, PiEye } from 'react-icons/pi';
import {
  warehouseService,
  type Warehouse,
  type WarehouseInput,
} from '@/services/warehouse.service';
import { routes } from '@/config/routes';

const EMPTY: WarehouseInput = {
  name: '',
  code: '',
  type: 'warehouse',
  address: { line1: '', city: '', state: '', country: '' },
  isActive: true,
  isDefault: false,
};

export default function WarehousesList() {
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
      isActive: w.isActive,
      isDefault: w.isDefault,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#B20202] px-4 py-2 text-white"
        >
          <PiPlus /> New warehouse
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">
          No warehouses yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w._id} className="border-t">
                  <td className="px-4 py-3">
                    {w.name}{' '}
                    {w.isDefault && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{w.code}</td>
                  <td className="px-4 py-3">{w.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{w.address?.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    {w.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={routes.warehouses.detail(w._id)}
                        className="rounded p-1.5 hover:bg-gray-100"
                        title="View stock"
                      >
                        <PiEye />
                      </Link>
                      <button
                        onClick={() => openEdit(w)}
                        className="rounded p-1.5 hover:bg-gray-100"
                        title="Edit"
                      >
                        <PiPencilSimple />
                      </button>
                      <button
                        onClick={() => remove(w)}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <PiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? 'Edit' : 'New'} warehouse
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-1 text-sm">
                Name
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="col-span-1 text-sm">
                Code
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
              <label className="col-span-1 text-sm">
                Type
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
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
              <label className="col-span-1 text-sm">
                City
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.address?.city ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, city: e.target.value },
                    })
                  }
                />
              </label>
              <label className="col-span-2 text-sm">
                Address
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.address?.line1 ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, line1: e.target.value },
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />{' '}
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                />{' '}
                Default
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-[#B20202] px-4 py-2 text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
