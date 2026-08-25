'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiTag } from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import { pricelistService } from '@/services/pricelist.service';
import ConfirmDialog from '@/app/shared/purchases/pricelists/confirm-dialog';
import type { Pricelist } from './types';
import { useDebouncedValue } from './use-debounced-value';
import ListToolbar from './list-toolbar';
import ListDialogs, { EmptyPanel } from './list-dialogs';
import StatsStrip from './stats-strip';
import PricelistTable from './pricelist-table';
import PricelistPanel from './pricelist-panel';

const PAGE = 50;

export default function POSPricelists() {
  const { data: session } = useSession();
  const token = session?.user?.token as string | undefined;

  const [rows, setRows] = useState<Pricelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState<'all' | 'selectable' | 'website'>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Pricelist | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Pricelist | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await pricelistService.list(token, {
        search: debouncedSearch,
        page,
        limit: PAGE,
      });
      setRows(res.data.pricelists);
      setTotal(res.data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when search settles
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const filtered = rows.filter((pl) => {
    if (status === 'selectable') return !!pl.isSelectable;
    if (status === 'website') return !!pl.website;
    return true;
  });

  const allChecked =
    filtered.length > 0 && filtered.every((p) => checked.has(p._id));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(filtered.map((p) => p._id)));
  }
  function toggleOne(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Enter a name');
      return;
    }
    try {
      const res = await pricelistService.create({ name: newName.trim() }, token!);
      toast.success('Pricelist created');
      setNewName('');
      setCreating(false);
      setSelected(res.data);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await pricelistService.delete(deleteTarget._id, token!);
      toast.success('Deleted');
      if (selected?._id === deleteTarget._id) setSelected(null);
      setChecked((prev) => {
        const n = new Set(prev);
        n.delete(deleteTarget._id);
        return n;
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteTarget(null);
      load();
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(checked);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) => pricelistService.delete(id, token!))
    );
    const failedIds = new Set(
      results
        .map((r, i) => (r.status === 'rejected' ? ids[i] : ''))
        .filter(Boolean)
    );
    if (failedIds.size === 0) toast.success(`${ids.length} deleted`);
    else
      toast.error(
        `${ids.length - failedIds.size} deleted · ${failedIds.size} failed`
      );
    setChecked((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => {
        if (!failedIds.has(id)) n.delete(id);
      });
      return n;
    });
    if (selected && ids.includes(selected._id) && !failedIds.has(selected._id))
      setSelected(null);
    setBulkBusy(false);
    setBulkConfirm(false);
    load();
  }

  async function refreshSelected() {
    load();
    if (selected) {
      try {
        const res = await pricelistService.get(selected._id, token!);
        setSelected(res.data);
      } catch {
        /* list refresh already surfaces errors */
      }
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <POSNavHeader />

      <ListToolbar
        total={total}
        shownCount={filtered.length}
        search={search}
        status={status}
        page={page}
        totalPages={totalPages}
        loading={loading}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onPage={setPage}
        onReload={load}
        onCreate={() => setCreating(true)}
      />

      <StatsStrip rows={rows} />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col overflow-hidden border-r border-gray-200 transition-all duration-200 ${
            selected ? 'w-[55%]' : 'flex-1'
          }`}
        >
          {checked.size > 0 && (
            <div
              className="flex shrink-0 items-center gap-3 bg-white px-4 py-2.5"
              style={{ borderBottom: `2px solid ${BRAND}` }}
            >
              <div className="flex-1 text-xs font-semibold text-gray-700">
                <span className="font-bold" style={{ color: BRAND }}>
                  {checked.size}
                </span>{' '}
                selected
              </div>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                disabled={bulkBusy}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setBulkConfirm(true)}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: BRAND }}
              >
                Delete {checked.size > 1 ? `${checked.size} items` : 'item'}
              </button>
            </div>
          )}

          <PricelistTable
            rows={filtered}
            loading={loading}
            error={error}
            creating={creating}
            newName={newName}
            checked={checked}
            selectedId={selected?._id ?? null}
            onNewNameChange={setNewName}
            onCreate={handleCreate}
            onCancelCreate={() => {
              setCreating(false);
              setNewName('');
            }}
            onSelect={(pl) =>
              setSelected(selected?._id === pl._id ? null : pl)
            }
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onDeleteRequest={setDeleteTarget}
            page={page}
            totalPages={totalPages}
            total={total}
            onPage={setPage}
          />
        </div>

        {/* Detail panel */}
        <div
          className={`flex flex-col bg-white transition-all duration-200 ${
            selected ? 'flex-1 overflow-hidden' : 'w-72 shrink-0'
          }`}
        >
          {selected ? (
            <PricelistPanel
              pl={selected}
              token={token}
              onClose={() => setSelected(null)}
              onRefresh={refreshSelected}
            />
          ) : (
            <EmptyPanel />
          )}
        </div>
      </div>

      <ListDialogs
        deleteTarget={deleteTarget}
        bulkConfirm={bulkConfirm}
        checkedCount={checked.size}
        bulkBusy={bulkBusy}
        selected={selected}
        onConfirmDelete={confirmDelete}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmBulk={handleBulkDelete}
        onCancelBulk={() => setBulkConfirm(false)}
      />
    </div>
  );
}

