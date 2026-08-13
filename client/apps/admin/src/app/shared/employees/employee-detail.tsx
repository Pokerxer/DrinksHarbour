'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  PiIdentificationCard,
  PiArrowCounterClockwise,
} from 'react-icons/pi';
import {
  employeeService,
  type Employee,
  type EmployeeInput,
} from '@/services/employee.service';
import {
  shiftService,
  shiftTemplateService,
  type ShiftTemplate,
} from '@/services/shift.service';
import {
  LAGOS_OFFSET_MINUTES,
  addDays,
  localToday,
  fillPreview,
  fillSummaryLabel,
  fillDatesLabel,
  summariseFillResult,
} from './shift-roster-utils';
import {
  seatOptions,
  seatOptionToPosition,
  defaultSeatPosition,
} from './shift-position-utils';
import { buildLabelMap } from './org-config-utils';
import { employeeRoleService, type EmployeeRole } from '@/services/orgStructure.service';

const OFFSET = LAGOS_OFFSET_MINUTES;
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
import EmployeeBadge from './employee-badge';
import FillReportModal from './fill-report-modal';

export default function EmployeeDetail({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const sessionUserId =
    (session?.user as { id?: string; _id?: string })?.id ??
    (session?.user as { id?: string; _id?: string })?._id ??
    '';

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [colleagues, setColleagues] = useState<Employee[]>([]);
  const [form, setForm] = useState<EmployeeInput | null>(null);
  // Snapshot of the last-saved form, used to detect unsaved changes.
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [activeSection, setActiveSection] = useState('details');

  const [patternOpen, setPatternOpen] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [patternBusy, setPatternBusy] = useState(false);
  const [patternReport, setPatternReport] = useState<ReturnType<
    typeof summariseFillResult
  > | null>(null);
  const [pattern, setPattern] = useState({ templateId: '', from: '', to: '' });
  // Which crew position this employee fills on the chosen pattern — the same
  // explicit-per-seat choice as the roster's own fill drawer, just for the one
  // person this page is about. Reset to the pattern's own default whenever the
  // pattern changes, see the effect below.
  const [position, setPosition] = useState<string | null>(null);

  const dirty = useMemo(
    () => !!form && JSON.stringify(form) !== baseline,
    [form, baseline]
  );

  const load = useCallback(async () => {
    if (!token) {
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await employeeService.getEmployeeById(employeeId, token);
      const e = res.data.employee;
      const f = employeeToForm(e);
      setEmployee(e);
      setForm(f);
      setBaseline(JSON.stringify(f));
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

  // Fetch the full team once so the Work section can resolve the manager link
  // and derive direct reports for the org chart.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    employeeService
      .getEmployees(token)
      .then((res) => {
        if (!cancelled) setColleagues(res.data?.employees ?? []);
      })
      .catch(() => {
        /* org chart is non-critical; ignore load failures */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Shift patterns (and the roles behind their crew positions) for the "Add to
  // a shift pattern" drawer, loaded on first open.
  useEffect(() => {
    if (!patternOpen || templates.length) return;
    Promise.all([shiftTemplateService.list(token), employeeRoleService.list(token)])
      .then(([t, r]) => {
        setTemplates(t.filter((tpl) => tpl.isActive));
        setRoles(r);
      })
      .catch(() => toast.error('Could not load shift patterns'));
  }, [patternOpen, templates.length, token]);

  const roleNames = useMemo(() => buildLabelMap(roles), [roles]);

  const chosenTemplate =
    templates.find((t) => t._id === pattern.templateId) ?? null;

  // The position defaults to the pattern's own first-with-room choice — same
  // rule as ticking a person in the roster's fill drawer (defaultSeatPosition)
  // — whenever the chosen pattern changes, so switching patterns never leaves
  // a position id from the PREVIOUS one's crew silently attached to this seat.
  useEffect(() => {
    const t = templates.find((x) => x._id === pattern.templateId) ?? null;
    setPosition(t ? defaultSeatPosition(t, [], roleNames) : null);
  }, [pattern.templateId, templates, roleNames]);

  // Warn before closing/reloading the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    if (loading || notFound) return;
    const els = EMPLOYEE_FORM_SECTIONS.map((s) =>
      document.getElementById(s.id)
    ).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, notFound]);

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
        avatar: form.avatar ?? null,
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
      const f = employeeToForm(updated);
      setEmployee(updated);
      setForm(f);
      setBaseline(JSON.stringify(f));
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
    if (sessionUserId && employee._id === sessionUserId) {
      toast.error('You cannot remove your own account');
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

  // Clear the POS PIN. The edit form can only ever *set* a PIN (blank means
  // "keep current"), so removing one needs its own explicit action.
  const resetPin = async () => {
    if (!employee) return;
    if (
      !confirm(
        `Remove the POS PIN for ${fullName(employee)}? They will need to set a new one before using the terminal.`
      )
    )
      return;
    setResettingPin(true);
    try {
      const res = await employeeService.resetPin(employee._id, token);
      const updated = res.data.employee;
      const f = employeeToForm(updated);
      setEmployee(updated);
      setForm(f);
      setBaseline(JSON.stringify(f));
      toast.success('POS PIN cleared');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset PIN');
    } finally {
      setResettingPin(false);
    }
  };

  // Fill this employee's rota from a chosen shift pattern. Same endpoint,
  // same rules as the roster's fill drawer — this just pre-selects one person.
  async function addToPattern() {
    if (!pattern.templateId) {
      toast.error('Choose a shift pattern');
      return;
    }
    setPatternBusy(true);
    try {
      const result = await shiftService.fill(
        {
          templateId: pattern.templateId,
          employees: [{ employee: employeeId, position }],
          from: pattern.from,
          to: pattern.to,
        },
        token
      );
      setPatternOpen(false);
      setPatternReport(summariseFillResult(result));
      toast.success(
        `${result.created} shift${result.created === 1 ? '' : 's'} created`
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to fill the pattern'
      );
    } finally {
      setPatternBusy(false);
    }
  }

  // Revert in-progress edits back to the last saved state.
  const reset = () => {
    if (!employee) return;
    setForm(employeeToForm(employee));
  };

  // Navigate to the list, guarding against losing unsaved edits.
  const cancel = () => {
    if (dirty && !confirm('Discard unsaved changes and leave this page?'))
      return;
    router.push(routes.employees.list);
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href={routes.employees.list}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-200 transition-colors hover:text-white"
            >
              <PiArrowLeft className="h-4 w-4" /> Employees
            </Link>
            <div className="flex items-center gap-2">
              {employee.hasPin && (
                <button
                  type="button"
                  onClick={resetPin}
                  disabled={resettingPin}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/25 disabled:opacity-60"
                  title="Remove the POS PIN so the employee must set a new one"
                >
                  <PiKey className="h-4 w-4" />
                  {resettingPin ? 'Clearing…' : 'Reset PIN'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowBadge(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/25"
              >
                <PiIdentificationCard className="h-4 w-4" />
                Generate badge
              </button>
              <button
                type="button"
                onClick={() => {
                  // Default to the visible week, same as the roster's own fill
                  // entry point, so the two never behave differently — an empty
                  // from/to left Fill enabled with a preview that had already
                  // collapsed to "nothing to create".
                  const today = localToday(OFFSET);
                  setPattern((p) => ({
                    ...p,
                    from: p.from || today,
                    to: p.to || addDays(today, 6),
                  }));
                  setPatternOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/25"
              >
                Add to a shift pattern
              </button>
            </div>
          </div>

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
                  className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    activeSection === s.id
                      ? 'bg-[#b20202]/10 font-semibold text-[#b20202]'
                      : 'text-gray-600 hover:bg-[#b20202]/5 hover:text-[#b20202]'
                  }`}
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
                colleagues={colleagues}
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
            disabled={
              isOwner ||
              deleting ||
              saving ||
              (sessionUserId !== '' && employee._id === sessionUserId)
            }
            title={
              isOwner
                ? 'The owner cannot be removed'
                : sessionUserId !== '' && employee._id === sessionUserId
                  ? 'You cannot remove your own account'
                  : 'Remove employee'
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-600"
          >
            <PiTrash className="h-4 w-4" />
            {deleting ? 'Removing…' : 'Delete'}
          </button>
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="hidden items-center gap-1.5 text-xs font-medium text-amber-600 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={!dirty || saving || deleting}
              title="Revert unsaved changes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PiArrowCounterClockwise className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || deleting || !dirty}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
            >
              <PiFloppyDisk className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {showBadge && (
        <EmployeeBadge
          employee={employee}
          onClose={() => setShowBadge(false)}
          // Issuing a number rewrites the employee this page is editing, so the
          // page takes the new one — otherwise the next save would submit the
          // profile it loaded, without the number.
          onIssued={setEmployee}
        />
      )}

      {/* Fill this employee's rota from a chosen shift pattern — the same
          `/fill` endpoint and rules as the roster's fill drawer, pre-selected
          to this one person. */}
      {patternOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !patternBusy && setPatternOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="text-base font-bold text-gray-900">
              Add to a shift pattern
            </h2>

            <label className="mt-3 block text-xs font-semibold text-gray-600">
              Pattern
              <select
                value={pattern.templateId}
                onChange={(e) =>
                  setPattern({ ...pattern, templateId: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose a pattern…</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Which of the pattern's crew positions this employee fills —
                explicit, same as ticking a person in the roster's own fill
                drawer, never guessed on their behalf. */}
            {chosenTemplate && (
              <label className="mt-3 block text-xs font-semibold text-gray-600">
                Position
                <select
                  value={position ?? ''}
                  onChange={(e) =>
                    setPosition(seatOptionToPosition(e.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {seatOptions(chosenTemplate, [], roleNames).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-3 flex gap-2">
              <label className="flex-1 text-xs font-semibold text-gray-600">
                From
                <input
                  type="date"
                  value={pattern.from}
                  onChange={(e) =>
                    setPattern({ ...pattern, from: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex-1 text-xs font-semibold text-gray-600">
                To
                <input
                  type="date"
                  value={pattern.to}
                  onChange={(e) =>
                    setPattern({ ...pattern, to: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              {chosenTemplate
                ? fillSummaryLabel(
                    fillPreview(chosenTemplate, pattern.from, pattern.to).count,
                    1
                  )
                : 'Choose a pattern to preview the days'}
            </p>
            {chosenTemplate && (
              <p className="mt-0.5 text-xs text-gray-400">
                {fillDatesLabel(
                  fillPreview(chosenTemplate, pattern.from, pattern.to).dates
                )}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPatternOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addToPattern}
                disabled={
                  patternBusy ||
                  !pattern.templateId ||
                  !pattern.from ||
                  !pattern.to ||
                  pattern.from > pattern.to
                }
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {patternBusy ? 'Filling…' : 'Fill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {patternReport && (
        <FillReportModal
          report={patternReport}
          onClose={() => setPatternReport(null)}
        />
      )}
    </div>
  );
}
