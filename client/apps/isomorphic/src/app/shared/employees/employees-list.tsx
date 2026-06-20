'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiPlus,
  PiPencilSimple,
  PiTrash,
  PiArrowsClockwise,
  PiUsersThree,
  PiUserCircle,
  PiCheckCircle,
  PiMagnifyingGlass,
  PiX,
  PiShieldCheck,
  PiKey,
  PiEnvelopeSimple,
  PiPhone,
  PiStorefront,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  employeeService,
  type Employee,
  type EmployeeInput,
  type EmployeeRole,
  type EmployeeStatus,
} from '@/services/employee.service';
import { routes } from '@/config/routes';
import { fraunces } from './employees-fonts';
import EmployeeProfileForm, {
  EMPTY_FORM,
  Avatar,
  RoleBadge,
  StatusBadge,
  fullName,
} from './employee-profile-form';

// ── Stat card ────────────────────────────────────────────────────────────────

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

// ── Create drawer (quick "New employee") ────────────────────────────────────────
//
// Edits now live on the dedicated /employees/[id] page; the drawer is kept for
// fast creation only. It reuses the same EmployeeProfileForm as the detail page.

function EmployeeDrawer({
  form,
  setForm,
  saving,
  token,
  onClose,
  onSave,
}: {
  form: EmployeeInput;
  setForm: (f: EmployeeInput) => void;
  saving: boolean;
  token: string;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PiUserCircle className="h-5 w-5 text-[#b20202]" />
            <span className="text-base font-semibold text-gray-900">
              New employee
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <EmployeeProfileForm
            form={form}
            setForm={setForm}
            token={token}
            editing={null}
          />
        </div>

        {/* Footer */}
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
            {saving ? 'Saving…' : 'Create employee'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EmployeesList() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | EmployeeRole>('');
  const [statusFilter, setStatusFilter] = useState<'' | EmployeeStatus>('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await employeeService.getEmployees(token);
      setItems(res.data?.employees ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openDetail = (e: Employee) => router.push(routes.employees.detail(e._id));

  const save = async () => {
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('A valid email is required');
      return;
    }
    if (form.posAccess && form.pin && !/^\d{4,6}$/.test(form.pin)) {
      toast.error('PIN must be 4–6 digits');
      return;
    }
    setSaving(true);
    try {
      const payload: EmployeeInput = { ...form };
      if (!payload.pin) delete payload.pin;
      if (!payload.posAccess) {
        delete payload.posName;
        delete payload.posPermissions;
      }
      await employeeService.createEmployee(payload, token);
      toast.success('Employee created');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Employee) => {
    if (e.role === 'tenant_owner') {
      toast.error('The tenant owner cannot be removed');
      return;
    }
    if (!confirm(`Remove ${fullName(e)}? They will lose all access.`)) return;
    try {
      await employeeService.removeEmployee(e._id, token);
      toast.success('Employee removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  // ── client-side search + filter ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      if (roleFilter && e.role !== roleFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        fullName(e).toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q) ||
        (e.posName || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, roleFilter, statusFilter]);

  // ── stats ──
  const total = items.length;
  const activeCount = items.filter((e) => e.status === 'active').length;
  const adminCount = items.filter(
    (e) => e.role === 'tenant_admin' || e.role === 'tenant_owner'
  ).length;
  const posCount = items.filter((e) => e.posAccess).length;

  const selectCls =
    'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20';

  return (
    <div className="flex flex-col">
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
              <h1
                className={`${fraunces.className} mt-0.5 text-3xl font-semibold text-white`}
              >
                Employees
              </h1>
              <p className="mt-0.5 text-sm text-red-200">
                Manage your team, roles, status & POS access
              </p>
            </div>
          </div>

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
              New employee
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 pb-10 pt-6 md:px-10 lg:px-14">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Employees"
            value={String(total)}
            sub={`${total - activeCount} not active`}
            icon={<PiUsersThree className="h-5 w-5" />}
            accent
          />
          <StatCard
            label="Active"
            value={String(activeCount)}
            sub="Currently working"
            icon={<PiCheckCircle className="h-5 w-5" />}
          />
          <StatCard
            label="Owners & Admins"
            value={String(adminCount)}
            sub="Management access"
            icon={<PiShieldCheck className="h-5 w-5" />}
          />
          <StatCard
            label="POS Access"
            value={String(posCount)}
            sub="Can use the terminal"
            icon={<PiStorefront className="h-5 w-5" />}
          />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {filtered.length} of {total}{' '}
            {total === 1 ? 'employee' : 'employees'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone…"
                className="w-56 rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as '' | EmployeeRole)}
              className={selectCls}
            >
              <option value="">All roles</option>
              <option value="tenant_owner">Owner</option>
              <option value="tenant_admin">Admin</option>
              <option value="tenant_staff">Staff</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as '' | EmployeeStatus)
              }
              className={selectCls}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">POS</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                          <PiWarningCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-700">
                          {total === 0 ? 'No employees yet' : 'No matches'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {total === 0
                            ? 'Add your first team member to get started.'
                            : 'Try a different search or filter.'}
                        </p>
                        {total === 0 && (
                          <button
                            type="button"
                            onClick={openCreate}
                            className="mt-4 flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
                          >
                            <PiPlus className="h-4 w-4" /> New employee
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((e, i) => (
                    <motion.tr
                      key={e._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.3) }}
                      onClick={() => openDetail(e)}
                      className="group cursor-pointer transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar e={e} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {fullName(e)}
                            </p>
                            {e.posName && e.posName !== e.firstName && (
                              <p className="truncate text-xs text-gray-400">
                                POS: {e.posName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="flex items-center gap-1.5 text-sm text-gray-600">
                          <PiEnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{e.email}</span>
                        </p>
                        {e.phone && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                            <PiPhone className="h-3.5 w-3.5 shrink-0" />
                            {e.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={e.role} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {e.posAccess ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b20202]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#b20202]">
                            <PiStorefront className="h-3.5 w-3.5" />
                            {e.hasPin ? <PiKey className="h-3 w-3" /> : null}
                            Enabled
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openDetail(e);
                            }}
                            title="Edit"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              remove(e);
                            }}
                            disabled={e.role === 'tenant_owner'}
                            title={
                              e.role === 'tenant_owner'
                                ? 'The owner cannot be removed'
                                : 'Remove'
                            }
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <EmployeeDrawer
            form={form}
            setForm={setForm}
            saving={saving}
            token={token}
            onClose={() => setShowForm(false)}
            onSave={save}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
