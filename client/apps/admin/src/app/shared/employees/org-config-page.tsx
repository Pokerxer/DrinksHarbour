'use client';

// One CRUD screen, three entities.
//
// Departments, job positions and HR/planning roles differ only in their form
// fields and their table columns; the search, filter, sort, slide-over,
// optimistic list state and 409 delete-guard handling are identical. Those live
// here once and each page supplies the two things that actually differ.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiPencilSimple,
  PiTrash,
  PiX,
  PiArrowsClockwise,
  PiWarningCircle,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import {
  activeFilterParam,
  sortOrgRows,
  isDuplicateName,
  type ActiveFilter,
  type OrgSort,
  type OrgRowLike,
} from './org-config-utils';
import type { OrgListParams } from '@/services/orgStructure.service';

export const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

/** A labelled form control. Module-level so it never remounts and loses focus. */
export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm font-medium text-gray-700 ${className}`}>
      {label}
      {hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

type Row = OrgRowLike & { _id: string };

export interface OrgColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export interface OrgConfigPageProps<T extends Row, TInput> {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  /** Singular noun, lowercase — used in buttons and confirmations. */
  noun: string;
  service: {
    list: (token: string, params?: OrgListParams) => Promise<T[]>;
    create: (input: TInput, token: string) => Promise<T>;
    update: (id: string, input: Partial<TInput>, token: string) => Promise<T>;
    remove: (id: string, token: string) => Promise<void>;
  };
  columns: OrgColumn<T>[];
  emptyDraft: TInput;
  toDraft: (row: T) => TInput;
  renderForm: (
    draft: TInput,
    patch: (p: Partial<TInput>) => void,
    ctx: { rows: T[]; editingId: string | null }
  ) => React.ReactNode;
  /** Extra validation beyond "name is required". Return a message to block. */
  validate?: (draft: TInput) => string | null;
  /** Loaded alongside the list — e.g. the departments a position can belong to. */
  onLoaded?: (rows: T[]) => void;
  /**
   * Sort options. Defaults to name / headcount / newest; an entity with no
   * headcount (a shift template) passes its own rather than offering a sort
   * that silently does nothing.
   */
  sorts?: { value: OrgSort; label: string }[];
  /** Overrides the delete-confirmation body for entities held open by something
   *  other than employees. */
  describeDelete?: (row: T) => string;
}

const DEFAULT_SORTS: { value: OrgSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'employees', label: 'Headcount' },
  { value: 'recent', label: 'Newest' },
];

export default function OrgConfigPage<
  T extends Row,
  TInput extends { name: string },
>({
  title,
  subtitle,
  icon,
  noun,
  service,
  columns,
  emptyDraft,
  toDraft,
  renderForm,
  validate,
  onLoaded,
  sorts = DEFAULT_SORTS,
  describeDelete,
}: OrgConfigPageProps<T, TInput>) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [sort, setSort] = useState<OrgSort>('name');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const items = await service.list(token, {
        search: search.trim() || undefined,
        isActive: activeFilterParam(activeFilter),
      });
      setRows(items);
      onLoaded?.(items);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to load ${title.toLowerCase()}`
      );
    } finally {
      setLoading(false);
    }
    // `service` and `onLoaded` are stable module-level values; including them
    // would re-run this on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, activeFilter]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per keystroke.
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const visible = useMemo(() => sortOrgRows(rows, sort), [rows, sort]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  }

  function openEdit(row: T) {
    setEditingId(row._id);
    setDraft(toDraft(row));
    setPanelOpen(true);
  }

  const patch = useCallback((p: Partial<TInput>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  async function save() {
    const name = String(draft.name ?? '').trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    // Caught client-side so the user is not made to wait for a 409 that says
    // the same thing.
    if (isDuplicateName(name, rows, editingId ?? undefined)) {
      toast.error(`A ${noun} with that name already exists`);
      return;
    }
    const problem = validate?.(draft);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await service.update(editingId, draft, token);
        toast.success(`${title.replace(/s$/, '')} updated`);
      } else {
        await service.create(draft, token);
        toast.success(`${title.replace(/s$/, '')} created`);
      }
      setPanelOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(row: T) {
    try {
      await service.remove(row._id, token);
      toast.success(`${title.replace(/s$/, '')} deleted`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      // The API refuses with a 409 naming what still references the record and
      // telling the admin to deactivate instead. Surfaced verbatim — a generic
      // "delete failed" would strip the only actionable part.
      toast.error(err instanceof Error ? err.message : 'Delete failed', {
        duration: 6000,
      });
      setConfirmDelete(null);
    }
  }

  return (
    <div className="px-4 py-6 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202] text-white [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </span>
          <div>
            <h1
              className={`${fraunces.className} text-2xl font-black text-gray-900`}
            >
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
        >
          <PiPlus className="h-4 w-4" />
          New {noun}
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className={`${FIELD} pl-9`}
            placeholder={`Search ${title.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          className={`${FIELD} w-auto`}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>

        <select
          className={`${FIELD} w-auto`}
          value={sort}
          onChange={(e) => setSort(e.target.value as OrgSort)}
          aria-label="Sort"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={load}
          aria-label="Refresh"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition-colors hover:text-gray-900"
        >
          <PiArrowsClockwise
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60">
              {columns.map((c) => (
                <th
                  key={c.header}
                  className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 ${c.className ?? ''}`}
                >
                  {c.header}
                </th>
              ))}
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading && !visible.length && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-12 text-center"
                >
                  <p className="text-sm font-medium text-gray-500">
                    {search || activeFilter !== 'all'
                      ? `No ${title.toLowerCase()} match those filters`
                      : `No ${title.toLowerCase()} yet`}
                  </p>
                  {!search && activeFilter === 'all' && (
                    <button
                      type="button"
                      onClick={openCreate}
                      className="mt-3 text-sm font-semibold text-[#b20202] hover:underline"
                    >
                      Create the first one
                    </button>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((row) => (
                <tr
                  key={row._id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 ${
                    row.isActive ? '' : 'opacity-60'
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.header}
                      className={`px-4 py-3 ${c.className ?? ''}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row.name}`}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                      >
                        <PiPencilSimple className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(row)}
                        aria-label={`Delete ${row.name}`}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-[#b20202]"
                      >
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Create / edit slide-over */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !saving && setPanelOpen(false)}
              className="fixed inset-0 z-40 bg-gray-900/30"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-base font-bold text-gray-900">
                  {editingId ? `Edit ${noun}` : `New ${noun}`}
                </h2>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                >
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {renderForm(draft, patch, { rows, editingId })}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202] disabled:opacity-60"
                >
                  {saving
                    ? 'Saving…'
                    : editingId
                      ? 'Save changes'
                      : `Create ${noun}`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="fixed inset-0 z-40 bg-gray-900/30"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#b20202]">
                  <PiWarningCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Delete {confirmDelete.name}?
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {describeDelete?.(confirmDelete) ??
                      ((confirmDelete.employeeCount ?? 0) > 0
                        ? `${confirmDelete.employeeCount} ${
                            confirmDelete.employeeCount === 1
                              ? 'employee is'
                              : 'employees are'
                          } assigned to this ${noun}. Deleting will be refused — deactivate it instead.`
                        : `This cannot be undone. Deactivate it instead if you may need it later.`)}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => doDelete(confirmDelete)}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f0202]"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
