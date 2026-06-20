'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
  PiProhibit,
  PiPauseCircle,
  PiMagnifyingGlass,
  PiX,
  PiCheck,
  PiCrown,
  PiShieldCheck,
  PiUser,
  PiKey,
  PiEnvelopeSimple,
  PiPhone,
  PiStorefront,
  PiWarningCircle,
  PiUploadSimple,
  PiPaperclip,
  PiSpinnerGap,
} from 'react-icons/pi';
import {
  employeeService,
  POS_PERMISSIONS,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  type Employee,
  type EmployeeInput,
  type EmployeeProfile,
  type EmployeeRole,
  type EmployeeStatus,
  type PosPermission,
} from '@/services/employee.service';
import { uploadService } from '@/services/upload.service';
import { fraunces } from './employees-fonts';

// ── metadata ─────────────────────────────────────────────────────────────────

const ROLE_META: Record<
  EmployeeRole,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  tenant_owner: {
    label: 'Owner',
    color: '#b20202',
    bg: 'bg-[#b20202]/10 text-[#b20202]',
    icon: <PiCrown weight="fill" className="h-3.5 w-3.5" />,
  },
  tenant_admin: {
    label: 'Admin',
    color: '#7c3aed',
    bg: 'bg-violet-50 text-violet-700',
    icon: <PiShieldCheck weight="fill" className="h-3.5 w-3.5" />,
  },
  tenant_staff: {
    label: 'Staff',
    color: '#0ea5e9',
    bg: 'bg-sky-50 text-sky-700',
    icon: <PiUser weight="fill" className="h-3.5 w-3.5" />,
  },
};

const STATUS_META: Record<
  EmployeeStatus,
  { label: string; bg: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Active',
    bg: 'bg-green-50 text-green-700',
    icon: <PiCheckCircle className="h-3.5 w-3.5" />,
  },
  inactive: {
    label: 'Inactive',
    bg: 'bg-gray-100 text-gray-500',
    icon: <PiProhibit className="h-3.5 w-3.5" />,
  },
  suspended: {
    label: 'Suspended',
    bg: 'bg-amber-50 text-amber-700',
    icon: <PiPauseCircle className="h-3.5 w-3.5" />,
  },
};

const PERMISSION_LABELS: Record<PosPermission, string> = {
  'pos:sell': 'Sell',
  'pos:refund': 'Refund',
  'pos:void': 'Void',
  'pos:price_override': 'Price override',
  'pos:discount': 'Discount',
  'pos:terminal:retail': 'Retail terminal',
  'pos:terminal:wholesale': 'Wholesale terminal',
};

const EMPTY_PROFILE: EmployeeProfile = {
  privateContact: { email: '', phone: '', bankAccounts: [] },
  personal: {
    legalName: '',
    birthday: '',
    placeOfBirthCity: '',
    placeOfBirthCountry: '',
    gender: '',
    payslipLanguage: '',
  },
  emergencyContact: { name: '', phone: '' },
  visaWorkPermit: { visaNo: '', workPermitNo: '', documentUrl: '' },
  citizenship: {
    nationality: '',
    nonResident: false,
    identificationNo: '',
    ssnNo: '',
    passportNo: '',
  },
  location: {
    address: { street: '', street2: '', city: '', state: '', zip: '', country: '' },
    homeWorkDistanceKm: 0,
  },
  family: { maritalStatus: '', dependentChildren: 0 },
  education: { certificateLevel: '', fieldOfStudy: '' },
  documents: {
    idCardUrl: '',
    drivingLicenseUrl: '',
    simCardUrl: '',
    internetInvoiceUrl: '',
  },
  appraisal: { nextAppraisalDate: '' },
  approvers: { hrResponsible: '', expense: '', timeOff: '' },
  planning: { roles: [], defaultRole: '' },
  appSettings: { analyticDistribution: '', hourlyCost: 0 },
  attendance: { rfidBadge: '' },
  timezone: 'Africa/Lagos',
};

// ── nested profile get/set by dot-path (immutable) ──────────────────────────────

type AnyRecord = Record<string, unknown>;

function getIn(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) => (acc == null ? undefined : (acc as AnyRecord)[k]),
      obj
    );
}

function setIn(obj: AnyRecord, path: string, value: unknown): AnyRecord {
  const keys = path.split('.');
  const root: AnyRecord = { ...obj };
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] =
      next && typeof next === 'object' && !Array.isArray(next)
        ? { ...(next as AnyRecord) }
        : {};
    cur = cur[k] as AnyRecord;
  }
  cur[keys[keys.length - 1]] = value;
  return root;
}

const PFIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

// Reusable profile inputs (module-level so they don't remount/lose focus).

function PText({
  label,
  path,
  profile,
  setP,
  placeholder,
  type = 'text',
  span2 = false,
}: {
  label: string;
  path: string;
  profile: EmployeeProfile;
  setP: (path: string, value: unknown) => void;
  placeholder?: string;
  type?: string;
  span2?: boolean;
}) {
  return (
    <label
      className={`text-sm font-medium text-gray-700 ${span2 ? 'col-span-2' : ''}`}
    >
      {label}
      <input
        type={type}
        className={`mt-1.5 ${PFIELD}`}
        value={(getIn(profile, path) as string | number | undefined) ?? ''}
        onChange={(e) =>
          setP(
            path,
            type === 'number'
              ? e.target.value === ''
                ? ''
                : Number(e.target.value)
              : e.target.value
          )
        }
        placeholder={placeholder}
      />
    </label>
  );
}

function PSelect({
  label,
  path,
  profile,
  setP,
  options,
}: {
  label: string;
  path: string;
  profile: EmployeeProfile;
  setP: (path: string, value: unknown) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <select
        className={`mt-1.5 ${PFIELD}`}
        value={(getIn(profile, path) as string | undefined) ?? ''}
        onChange={(e) => setP(path, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-gray-100 pt-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function UploadField({
  label,
  path,
  profile,
  setP,
  token,
}: {
  label: string;
  path: string;
  profile: EmployeeProfile;
  setP: (path: string, value: unknown) => void;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const url = (getIn(profile, path) as string | undefined) ?? '';

  const onPick = async (file?: File) => {
    if (!file) return;
    if (!token) {
      toast.error('Not authenticated');
      return;
    }
    setBusy(true);
    try {
      const res = await uploadService.uploadImage(file, token, 'employee-docs');
      setP(path, res.data.url);
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 ${busy ? 'opacity-60' : ''}`}
        >
          {busy ? (
            <PiSpinnerGap className="h-4 w-4 animate-spin" />
          ) : (
            <PiUploadSimple className="h-4 w-4" />
          )}
          {url ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </label>
        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1 text-xs text-[#b20202] hover:underline"
            >
              <PiPaperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">View file</span>
            </a>
            <button
              type="button"
              onClick={() => setP(path, '')}
              className="rounded p-1 text-gray-400 hover:text-red-600"
              title="Remove"
            >
              <PiX className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400">No file</span>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM: EmployeeInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'tenant_staff',
  status: 'active',
  posAccess: false,
  posName: '',
  posPermissions: ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale'],
  pin: '',
  employeeProfile: EMPTY_PROFILE,
};

function fullName(e: Employee): string {
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email;
}

function initials(e: Employee): string {
  const a = e.firstName?.[0] ?? '';
  const b = e.lastName?.[0] ?? '';
  return (a + b).toUpperCase() || e.email[0]?.toUpperCase() || '?';
}

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

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ e }: { e: Employee }) {
  if (e.avatar) {
    return (
      <Image
        src={e.avatar}
        alt={fullName(e)}
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-gray-200"
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: ROLE_META[e.role]?.color ?? '#9ca3af' }}
    >
      {initials(e)}
    </div>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: EmployeeRole }) {
  const m = ROLE_META[role];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.bg}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${m.bg}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

// ── Create / Edit drawer ───────────────────────────────────────────────────────

function EmployeeDrawer({
  editing,
  form,
  setForm,
  saving,
  token,
  onClose,
  onSave,
}: {
  editing: Employee | null;
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

  // The owner cannot be demoted/suspended, so lock those controls when editing one.
  const isOwner = editing?.role === 'tenant_owner';

  const field =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

  const togglePerm = (p: PosPermission) => {
    const set = new Set(form.posPermissions ?? []);
    if (set.has(p)) set.delete(p);
    else set.add(p);
    setForm({ ...form, posPermissions: [...set] });
  };

  // Nested HR profile read/write by dot-path.
  const profile = form.employeeProfile ?? {};
  const setP = (path: string, value: unknown) =>
    setForm({
      ...form,
      employeeProfile: setIn(
        (form.employeeProfile ?? {}) as AnyRecord,
        path,
        value
      ) as EmployeeProfile,
    });

  const roles = profile.planning?.roles ?? [];
  const banks = profile.privateContact?.bankAccounts ?? [];
  const setBank = (i: number, key: string, val: string) => {
    const next = banks.map((b, idx) => (idx === i ? { ...b, [key]: val } : b));
    setP('privateContact.bankAccounts', next);
  };
  const addBank = () =>
    setP('privateContact.bankAccounts', [
      ...banks,
      { bankName: '', accountNumber: '', accountName: '' },
    ]);
  const removeBank = (i: number) =>
    setP(
      'privateContact.bankAccounts',
      banks.filter((_, idx) => idx !== i)
    );

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
              {editing ? 'Edit employee' : 'New employee'}
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
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Identity */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-700">
                First name
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  placeholder="Ada"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Last name
                <input
                  className={`mt-1.5 ${field}`}
                  value={form.lastName ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  placeholder="Obi"
                />
              </label>
              <label className="col-span-2 text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  disabled={!!editing}
                  className={`mt-1.5 ${field} ${editing ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ada@drinksharbour.com"
                />
              </label>
              <label className="col-span-2 text-sm font-medium text-gray-700">
                Phone{' '}
                <span className="font-normal text-gray-400">(optional)</span>
                <input
                  type="tel"
                  className={`mt-1.5 ${field}`}
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+234…"
                />
              </label>
            </div>
          </section>

          {/* Role & status */}
          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Access
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-700">
                Role
                <select
                  disabled={isOwner}
                  className={`mt-1.5 ${field} ${isOwner ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
                  value={isOwner ? 'tenant_owner' : form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as EmployeeInput['role'],
                    })
                  }
                >
                  {isOwner && <option value="tenant_owner">Owner</option>}
                  <option value="tenant_admin">Admin</option>
                  <option value="tenant_staff">Staff</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Status
                <select
                  disabled={isOwner}
                  className={`mt-1.5 ${field} ${isOwner ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as EmployeeStatus,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
            </div>
            {isOwner && (
              <p className="mt-2 text-[11px] text-gray-400">
                The tenant owner&apos;s role and status are locked.
              </p>
            )}
          </section>

          {/* POS access */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Point of Sale
              </p>
              <button
                type="button"
                onClick={() => setForm({ ...form, posAccess: !form.posAccess })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.posAccess ? 'bg-[#b20202]' : 'bg-gray-200'}`}
                aria-pressed={form.posAccess}
                title="Toggle POS access"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.posAccess ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {form.posAccess && (
              <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <label className="block text-sm font-medium text-gray-700">
                  Display name on terminal
                  <input
                    className={`mt-1.5 ${field} bg-white`}
                    value={form.posName ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, posName: e.target.value })
                    }
                    placeholder={form.firstName || 'Cashier name'}
                  />
                </label>

                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Permissions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {POS_PERMISSIONS.map((p) => {
                      const on = (form.posPermissions ?? []).includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePerm(p)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            on
                              ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {on && <PiCheck className="h-3.5 w-3.5 shrink-0" />}
                          {PERMISSION_LABELS[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block text-sm font-medium text-gray-700">
                  PIN{' '}
                  <span className="font-normal text-gray-400">
                    {editing?.hasPin
                      ? '(leave blank to keep current)'
                      : '(4–6 digits, optional)'}
                  </span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    className={`mt-1.5 ${field} bg-white tracking-[0.3em]`}
                    value={form.pin ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pin: e.target.value.replace(/\D/g, '').slice(0, 6),
                      })
                    }
                    placeholder="••••"
                  />
                </label>
              </div>
            )}
          </section>

          {/* ── HR profile ── */}

          <ProfileSection title="Private Contact">
            <PText label="Private email" path="privateContact.email" profile={profile} setP={setP} type="email" placeholder="myprivateemail@example.com" span2 />
            <PText label="Private phone" path="privateContact.phone" profile={profile} setP={setP} type="tel" placeholder="+234…" span2 />
            <div className="col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Bank accounts</p>
                <button type="button" onClick={addBank} className="flex items-center gap-1 text-xs font-semibold text-[#b20202] hover:underline">
                  <PiPlus className="h-3.5 w-3.5" /> Add account
                </button>
              </div>
              <div className="space-y-2">
                {banks.length === 0 && <p className="text-xs text-gray-400">No bank accounts.</p>}
                {banks.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <input className={PFIELD} value={b.bankName ?? ''} onChange={(e) => setBank(i, 'bankName', e.target.value)} placeholder="Bank" />
                    <input className={PFIELD} value={b.accountNumber ?? ''} onChange={(e) => setBank(i, 'accountNumber', e.target.value)} placeholder="Account no." />
                    <input className={PFIELD} value={b.accountName ?? ''} onChange={(e) => setBank(i, 'accountName', e.target.value)} placeholder="Account name" />
                    <button type="button" onClick={() => removeBank(i)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove">
                      <PiTrash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </ProfileSection>

          <ProfileSection title="Personal Information">
            <PText label="Legal name" path="personal.legalName" profile={profile} setP={setP} placeholder="Alice" span2 />
            <PText label="Birthday" path="personal.birthday" profile={profile} setP={setP} type="date" />
            <PSelect label="Gender" path="personal.gender" profile={profile} setP={setP} options={GENDER_OPTIONS} />
            <PText label="Place of birth — city" path="personal.placeOfBirthCity" profile={profile} setP={setP} placeholder="City" />
            <PText label="Place of birth — country" path="personal.placeOfBirthCountry" profile={profile} setP={setP} placeholder="Country" />
            <PText label="Payslip language" path="personal.payslipLanguage" profile={profile} setP={setP} placeholder="User Language" span2 />
          </ProfileSection>

          <ProfileSection title="Emergency Contact">
            <PText label="Contact" path="emergencyContact.name" profile={profile} setP={setP} placeholder="Full name" />
            <PText label="Phone" path="emergencyContact.phone" profile={profile} setP={setP} type="tel" placeholder="+234…" />
          </ProfileSection>

          <ProfileSection title="Visa & Work Permit">
            <PText label="Visa No" path="visaWorkPermit.visaNo" profile={profile} setP={setP} />
            <PText label="Work Permit No" path="visaWorkPermit.workPermitNo" profile={profile} setP={setP} />
            <UploadField label="Document" path="visaWorkPermit.documentUrl" profile={profile} setP={setP} token={token} />
          </ProfileSection>

          <ProfileSection title="Citizenship">
            <PText label="Nationality (Country)" path="citizenship.nationality" profile={profile} setP={setP} span2 />
            <button
              type="button"
              onClick={() => setP('citizenship.nonResident', !profile.citizenship?.nonResident)}
              className={`col-span-2 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${profile.citizenship?.nonResident ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {profile.citizenship?.nonResident && <PiCheck className="h-4 w-4 shrink-0" />}
              Non-resident
            </button>
            <PText label="Identification No" path="citizenship.identificationNo" profile={profile} setP={setP} />
            <PText label="SSN No" path="citizenship.ssnNo" profile={profile} setP={setP} />
            <PText label="Passport No" path="citizenship.passportNo" profile={profile} setP={setP} span2 />
          </ProfileSection>

          <ProfileSection title="Location">
            <PText label="Street" path="location.address.street" profile={profile} setP={setP} placeholder="Street…" span2 />
            <PText label="Street 2" path="location.address.street2" profile={profile} setP={setP} placeholder="Street 2…" span2 />
            <PText label="City" path="location.address.city" profile={profile} setP={setP} />
            <PText label="State" path="location.address.state" profile={profile} setP={setP} />
            <PText label="ZIP" path="location.address.zip" profile={profile} setP={setP} />
            <PText label="Country" path="location.address.country" profile={profile} setP={setP} />
            <PText label="Home-Work Distance (km)" path="location.homeWorkDistanceKm" profile={profile} setP={setP} type="number" span2 />
          </ProfileSection>

          <ProfileSection title="Family">
            <PSelect label="Marital Status" path="family.maritalStatus" profile={profile} setP={setP} options={MARITAL_OPTIONS} />
            <PText label="Dependent Children" path="family.dependentChildren" profile={profile} setP={setP} type="number" />
          </ProfileSection>

          <ProfileSection title="Education">
            <PText label="Certificate Level" path="education.certificateLevel" profile={profile} setP={setP} />
            <PText label="Field of Study" path="education.fieldOfStudy" profile={profile} setP={setP} />
          </ProfileSection>

          <ProfileSection title="Documents">
            <UploadField label="ID Card Copy" path="documents.idCardUrl" profile={profile} setP={setP} token={token} />
            <UploadField label="Driving License" path="documents.drivingLicenseUrl" profile={profile} setP={setP} token={token} />
            <UploadField label="SIM Card Copy" path="documents.simCardUrl" profile={profile} setP={setP} token={token} />
            <UploadField label="Internet Subscription Invoice" path="documents.internetInvoiceUrl" profile={profile} setP={setP} token={token} />
          </ProfileSection>

          <ProfileSection title="Appraisal">
            <PText label="Next Appraisal Date" path="appraisal.nextAppraisalDate" profile={profile} setP={setP} type="date" span2 />
          </ProfileSection>

          <ProfileSection title="Approvers">
            <PText label="HR Responsible" path="approvers.hrResponsible" profile={profile} setP={setP} span2 />
            <PText label="Expense" path="approvers.expense" profile={profile} setP={setP} />
            <PText label="Time Off" path="approvers.timeOff" profile={profile} setP={setP} />
          </ProfileSection>

          <ProfileSection title="Planning">
            <label className="col-span-2 text-sm font-medium text-gray-700">
              Roles <span className="font-normal text-gray-400">(comma-separated)</span>
              <input
                className={`mt-1.5 ${PFIELD}`}
                value={roles.join(', ')}
                onChange={(e) =>
                  setP(
                    'planning.roles',
                    e.target.value.split(',').map((r) => r.trim()).filter(Boolean)
                  )
                }
                placeholder="e.g. Bartender"
              />
            </label>
            <PText label="Default Role" path="planning.defaultRole" profile={profile} setP={setP} placeholder="e.g. Bartender" span2 />
          </ProfileSection>

          <ProfileSection title="Application Settings">
            <PText label="Analytic Distribution" path="appSettings.analyticDistribution" profile={profile} setP={setP} span2 />
            <PText label="Hourly Cost (₦)" path="appSettings.hourlyCost" profile={profile} setP={setP} type="number" span2 />
          </ProfileSection>

          <ProfileSection title="Attendance / Point of Sale">
            <PText label="RFID / Badge Number" path="attendance.rfidBadge" profile={profile} setP={setP} placeholder="041667944074" span2 />
            <p className="col-span-2 -mt-1 text-[11px] text-gray-400">
              The POS PIN is set in the Point of Sale section above.
            </p>
          </ProfileSection>

          <ProfileSection title="Timezone">
            <PText label="Timezone" path="timezone" profile={profile} setP={setP} placeholder="Africa/Lagos" span2 />
          </ProfileSection>
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
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create employee'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EmployeesList() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | EmployeeRole>('');
  const [statusFilter, setStatusFilter] = useState<'' | EmployeeStatus>('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
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
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    // Date inputs need yyyy-mm-dd; the API returns full ISO timestamps.
    const ep = e.employeeProfile ?? {};
    const toDay = (v?: string | null) => (v ? String(v).slice(0, 10) : '');
    const normProfile: EmployeeProfile = {
      ...EMPTY_PROFILE,
      ...ep,
      personal: { ...ep.personal, birthday: toDay(ep.personal?.birthday) },
      appraisal: { nextAppraisalDate: toDay(ep.appraisal?.nextAppraisalDate) },
    };
    setForm({
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone,
      role: e.role === 'tenant_owner' ? 'tenant_admin' : e.role,
      status: e.status,
      posAccess: e.posAccess,
      posName: e.posName,
      posPermissions: e.posPermissions,
      pin: '',
      employeeProfile: normProfile,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('A valid email is required');
      return;
    }
    if (form.posAccess && form.pin && !/^\d{4,6}$/.test(form.pin)) {
      toast.error('PIN must be 4–6 digits');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // Build a partial: never send email (immutable), and only send a PIN
        // when the admin actually typed one.
        const payload: Partial<EmployeeInput> = {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          posAccess: form.posAccess,
          posName: form.posName,
          posPermissions: form.posPermissions,
          employeeProfile: form.employeeProfile,
        };
        if (editing.role !== 'tenant_owner') {
          payload.role = form.role;
          payload.status = form.status;
        }
        if (form.pin) payload.pin = form.pin;
        await employeeService.updateEmployee(editing._id, payload, token);
      } else {
        const payload: EmployeeInput = { ...form };
        if (!payload.pin) delete payload.pin;
        if (!payload.posAccess) {
          delete payload.posName;
          delete payload.posPermissions;
        }
        await employeeService.createEmployee(payload, token);
      }
      toast.success(editing ? 'Employee updated' : 'Employee created');
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
              onChange={(e) =>
                setRoleFilter(e.target.value as '' | EmployeeRole)
              }
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
                      className="group transition-colors hover:bg-gray-50/70"
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
                            onClick={() => openEdit(e)}
                            title="Edit"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(e)}
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
            editing={editing}
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
