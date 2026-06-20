'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiUserCircle,
  PiTrash,
  PiFloppyDisk,
  PiWarningCircle,
  PiEnvelopeSimple,
  PiPhone,
  PiKey,
  PiStorefront,
} from 'react-icons/pi';
import {
  employeeService,
  type Employee,
  type EmployeeInput,
} from '@/services/employee.service';
import { routes } from '@/config/routes';
import { fraunces } from './employees-fonts';
import EmployeeProfileForm, {
  EMPLOYEE_FORM_SECTIONS,
  Avatar,
  RoleBadge,
  StatusBadge,
  fullName,
  employeeToForm,
} from './employee-profile-form';

export default function EmployeeDetail({
  employeeId,
}: {
  employeeId: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await employeeService.getEmployeeById(employeeId, token);
      const e = res.data.employee;
      setEmployee(e);
      setForm(employeeToForm(e));
    } catch (e) {
      setNotFound(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [employeeId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!employee || !form) return;
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (form.posAccess && form.pin && !/^\d{4,6}$/.test(form.pin)) {
      toast.error('PIN must be 4–6 digits');
      return;
    }
    setSaving(true);
    try {
      // Never send email (immutable); only send a PIN when one was typed; the
      // owner's role/status are locked server-side anyway.
      const payload: Partial<EmployeeInput> = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        posAccess: form.posAccess,
        posName: form.posName,
        posPermissions: form.posPermissions,
        employeeProfile: form.employeeProfile,
      };
      if (employee.role !== 'tenant_owner') {
        payload.role = form.role;
        payload.status = form.status;
      }
      if (form.pin) payload.pin = form.pin;
      const res = await employeeService.updateEmployee(
        employee._id,
        payload,
        token
      );
      const updated = res.data.employee;
      setEmployee(updated);
      setForm(employeeToForm(updated));
      toast.success('Employee updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!employee) return;
    if (employee.role === 'tenant_owner') {
      toast.error('The tenant owner cannot be removed');
      return;
    }
    if (!confirm(`Remove ${fullName(employee)}? They will lose all access.`))
      return;
    setDeleting(true);
    try {
      await employeeService.removeEmployee(employee._id, token);
      toast.success('Employee removed');
      router.push(routes.employees.list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
      setDeleting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-gray-100" />
      </main>
    );
  }

  // ── Not found ──
  if (notFound || !employee || !form) {
    return (
      <main className="mx-auto w-full max-w-2xl px-3 py-16 text-center sm:px-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <PiWarningCircle className="h-8 w-8 text-gray-400" />
        </div>
        <h1 className="text-lg font-semibold text-gray-800">
          Employee not found
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          This employee may have been removed, or you don&apos;t have access.
        </p>
        <Link
          href={routes.employees.list}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to employees
        </Link>
      </main>
    );
  }

  const isOwner = employee.role === 'tenant_owner';

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

        <div className="relative">
          <Link
            href={routes.employees.list}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-red-200 transition-colors hover:text-white"
          >
            <PiArrowLeft className="h-4 w-4" /> Employees
          </Link>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-full ring-2 ring-white/30">
              <Avatar e={employee} size={64} />
            </div>
            <div className="min-w-0">
              <h1
                className={`${fraunces.className} text-3xl font-semibold text-white`}
              >
                {fullName(employee)}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RoleBadge role={employee.role} />
                <StatusBadge status={employee.status} />
                {employee.posAccess && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <PiStorefront className="h-3.5 w-3.5" />
                    {employee.hasPin && <PiKey className="h-3 w-3" />}
                    POS
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-red-100">
                <span className="inline-flex items-center gap-1.5">
                  <PiEnvelopeSimple className="h-3.5 w-3.5" />
                  {employee.email}
                </span>
                {employee.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <PiPhone className="h-3.5 w-3.5" />
                    {employee.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-6 pb-28 pt-6 md:px-10 lg:px-14">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Anchored side-nav */}
          <nav className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-6 space-y-0.5">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Sections
              </p>
              {EMPLOYEE_FORM_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-[#b20202]/5 hover:text-[#b20202]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 flex-1"
          >
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-4 flex items-center gap-2">
                <PiUserCircle className="h-5 w-5 text-[#b20202]" />
                <h2 className="text-base font-semibold text-gray-900">
                  Edit profile
                </h2>
              </div>
              <EmployeeProfileForm
                form={form}
                setForm={setForm}
                token={token}
                editing={employee}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3 md:px-10 lg:px-14">
          <button
            type="button"
            onClick={remove}
            disabled={isOwner || deleting || saving}
            title={isOwner ? 'The owner cannot be removed' : 'Remove employee'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-600"
          >
            <PiTrash className="h-4 w-4" />
            {deleting ? 'Removing…' : 'Delete'}
          </button>
          <div className="flex items-center gap-3">
            <Link
              href={routes.employees.list}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={saving || deleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
            >
              <PiFloppyDisk className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
