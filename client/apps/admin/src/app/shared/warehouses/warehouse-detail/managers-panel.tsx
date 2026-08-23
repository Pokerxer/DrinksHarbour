'use client';

// app/shared/warehouses/warehouse-detail/managers-panel.tsx
// Manager picker for this location. Fetches the tenant's staff-level users
// once on mount (limit 200), filters them client-side to the tenant-scoped
// roles, and lets an admin tick who manages this warehouse. Saving replaces
// the whole list via PATCH /api/warehouses/:id/managers and asks the parent
// to refetch so the rest of the screen reflects the new manager set.

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PiMagnifyingGlassBold, PiUsersBold } from 'react-icons/pi';
import {
  listAdminUsers,
  TENANT_SCOPED_ROLES,
  type AdminUserRow,
} from '@/services/adminUser.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';

/** Only tenant-scoped roles can be handed warehouse responsibility. */
const MANAGER_ROLES = new Set<string>(TENANT_SCOPED_ROLES);

function rowName(u: AdminUserRow): string {
  return (
    u.displayName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.email ||
    u._id
  );
}

export default function ManagersPanel({
  warehouse,
  token,
  onChanged,
}: {
  warehouse: Warehouse;
  token: string;
  onChanged: () => void;
}) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => loadSelected(warehouse));
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const res = await listAdminUsers({ limit: 200 }, token);
      setUsers(res.users.filter((u) => MANAGER_ROLES.has(u.role)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load users');
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // A reload of the parent hands us a fresh warehouse; re-seed the selection
  // from whatever the server currently considers the manager list.
  useEffect(() => {
    setSelected(loadSelected(warehouse));
  }, [warehouse]);

  const candidates = useMemo(() => users ?? [], [users]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...candidates].sort((a, b) =>
      rowName(a).localeCompare(rowName(b))
    );
    if (!q) return sorted;
    return sorted.filter(
      (u) =>
        rowName(u).toLowerCase().includes(q) ||
        String(u.email ?? '').toLowerCase().includes(q)
    );
  }, [candidates, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await warehouseService.setManagers(warehouse._id, [...selected], token);
      toast.success('Managers updated');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save managers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#ece4d6] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PiUsersBold className="h-5 w-5 text-gray-400" />
        <h2 className="mr-auto font-bold text-gray-900">Warehouse managers</h2>
        <div className="relative">
          <PiMagnifyingGlassBold className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search staff users"
            className="w-full min-w-[14rem] rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20 sm:w-64"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Managers of this location can send and receive its stock transfers.
      </p>

      {loadError ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-[#b20202]">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={fetchUsers}
            className="rounded-lg border border-[#b20202]/30 px-3 py-1 font-semibold hover:bg-white"
          >
            Retry
          </button>
        </div>
      ) : users === null ? (
        <div className="mt-3 space-y-2" aria-hidden>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
          {candidates.length === 0
            ? 'No tenant staff users found.'
            : 'No users match your search.'}
        </p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((u) => {
            const id = u._id;
            const checked = selected.has(id);
            return (
              <li key={id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? 'border-[#b20202]/40 bg-[#b20202]/5'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="h-4 w-4 shrink-0 accent-[#b20202]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-900">
                      {rowName(u)}
                    </span>
                    {u.email && (
                      <span className="block truncate text-xs text-gray-400">
                        {u.email}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {u.role.replace('tenant_', '')}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-end gap-3">
        <span className="mr-auto text-xs text-gray-400">
          {selected.size} selected
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saving || !token}
          className="rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save managers'}
        </button>
      </div>
    </section>
  );
}

function loadSelected(warehouse: Warehouse): Set<string> {
  return new Set((warehouse.managers ?? []).map((m) => m._id));
}
