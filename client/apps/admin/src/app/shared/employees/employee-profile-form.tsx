'use client';

import { useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  PiPlus,
  PiTrash,
  PiX,
  PiCheck,
  PiCrown,
  PiShieldCheck,
  PiUser,
  PiCheckCircle,
  PiProhibit,
  PiPauseCircle,
  PiUploadSimple,
  PiPaperclip,
  PiSpinnerGap,
} from 'react-icons/pi';
import {
  POS_PERMISSIONS,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  type AvatarInput,
  type Employee,
  type EmployeeInput,
  type EmployeeProfile,
  type EmployeeRole,
  type EmployeeStatus,
  type PosPermission,
} from '@/services/employee.service';
import { uploadService } from '@/services/upload.service';
import { fraunces } from './employees-fonts';

// ── metadata (shared by the list, the drawer and the detail page) ─────────────

export const ROLE_META: Record<
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

export const STATUS_META: Record<
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

export const EMPTY_PROFILE: EmployeeProfile = {
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
    address: {
      street: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: '',
    },
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
  work: {
    department: '',
    jobPosition: '',
    jobTitle: '',
    manager: '',
    workAddress: {
      company: '',
      street: '',
      street2: '',
      city: '',
      zip: '',
      country: '',
    },
    workLocation: '',
    note: '',
  },
  timezone: 'Africa/Lagos',
};

export const EMPTY_FORM: EmployeeInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  avatar: null,
  role: 'tenant_staff',
  status: 'active',
  posAccess: false,
  posName: '',
  posPermissions: ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale'],
  pin: '',
  employeeProfile: EMPTY_PROFILE,
};

// Anchored side-nav sections for the full-page editor (order = render order).
export const EMPLOYEE_FORM_SECTIONS: { id: string; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'access', label: 'Access' },
  { id: 'pos', label: 'Point of Sale' },
  { id: 'work', label: 'Work Information' },
  { id: 'private-contact', label: 'Private Contact' },
  { id: 'personal', label: 'Personal Information' },
  { id: 'emergency', label: 'Emergency Contact' },
  { id: 'visa', label: 'Visa & Work Permit' },
  { id: 'citizenship', label: 'Citizenship' },
  { id: 'location', label: 'Location' },
  { id: 'family', label: 'Family' },
  { id: 'education', label: 'Education' },
  { id: 'documents', label: 'Documents' },
  { id: 'appraisal', label: 'Appraisal' },
  { id: 'approvers', label: 'Approvers' },
  { id: 'planning', label: 'Planning' },
  { id: 'app-settings', label: 'Application Settings' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'timezone', label: 'Timezone' },
];

// ── name helpers ──────────────────────────────────────────────────────────────

export function fullName(e: Employee): string {
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email;
}

export function initials(e: Employee): string {
  const a = e.firstName?.[0] ?? '';
  const b = e.lastName?.[0] ?? '';
  return (a + b).toUpperCase() || e.email[0]?.toUpperCase() || '?';
}

/**
 * Normalise an API Employee into the editable EmployeeInput shape. Date inputs
 * need yyyy-mm-dd; the API returns full ISO timestamps. The tenant_owner role
 * is mapped to tenant_admin to satisfy the input type — the form locks the
 * control separately via `editing.role`.
 */
export function employeeToForm(e: Employee): EmployeeInput {
  const ep = e.employeeProfile ?? {};
  const toDay = (v?: string | null) => (v ? String(v).slice(0, 10) : '');
  const normProfile: EmployeeProfile = {
    ...EMPTY_PROFILE,
    ...ep,
    personal: { ...ep.personal, birthday: toDay(ep.personal?.birthday) },
    appraisal: { nextAppraisalDate: toDay(ep.appraisal?.nextAppraisalDate) },
  };
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone,
    avatar: e.avatar ? { url: e.avatar } : null,
    role: e.role === 'tenant_owner' ? 'tenant_admin' : e.role,
    status: e.status,
    posAccess: e.posAccess,
    posName: e.posName,
    posPermissions: e.posPermissions,
    pin: '',
    employeeProfile: normProfile,
  };
}

// ── Avatar + badges ─────────────────────────────────────────────────────────

export function Avatar({ e, size = 40 }: { e: Employee; size?: number }) {
  if (e.avatar) {
    return (
      <Image
        src={e.avatar}
        alt={fullName(e)}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-1 ring-gray-200"
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        background: ROLE_META[e.role]?.color ?? '#9ca3af',
        height: size,
        width: size,
        fontSize: Math.round(size * 0.3),
      }}
    >
      {initials(e)}
    </div>
  );
}

export function RoleBadge({ role }: { role: EmployeeRole }) {
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

export function StatusBadge({ status }: { status: EmployeeStatus }) {
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

function PTextArea({
  label,
  path,
  profile,
  setP,
  placeholder,
  rows = 3,
}: {
  label: string;
  path: string;
  profile: EmployeeProfile;
  setP: (path: string, value: unknown) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="col-span-2 text-sm font-medium text-gray-700">
      {label}
      <textarea
        rows={rows}
        className={`mt-1.5 ${PFIELD} resize-y`}
        value={(getIn(profile, path) as string | undefined) ?? ''}
        onChange={(e) => setP(path, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function ProfileSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-gray-100 pt-5">
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

// ── The full employee form (basic Details/Access/POS + Odoo-style HR profile) ──
//
// One source of truth shared by the create drawer and the /employees/[id] page.
// Renders only the form sections; the caller supplies any header / scroll
// container / save footer.

// Circular profile-photo picker. Uploads via Cloudinary and reports the
// resulting { url, publicId } (or null when cleared) back to the form.
function AvatarField({
  url,
  seed,
  token,
  onChange,
}: {
  url: string;
  seed: string;
  token: string;
  onChange: (avatar: AvatarInput | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const letters =
    seed
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '?';

  const onPick = async (file?: File) => {
    if (!file) return;
    if (!token) {
      toast.error('Not authenticated');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setBusy(true);
    try {
      const res = await uploadService.uploadImage(file, token, 'employee-avatars');
      onChange({ url: res.data.url, publicId: res.data.publicId });
      toast.success('Photo updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-2 flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Employee photo"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-[#b20202]/15"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#b20202]/10 text-xl font-bold text-[#b20202] ring-2 ring-[#b20202]/15">
            {letters}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
            <PiSpinnerGap className="h-5 w-5 animate-spin text-[#b20202]" />
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">Profile photo</p>
        <p className="mt-0.5 text-xs text-gray-400">
          JPG or PNG, used on the employee badge.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202] hover:text-[#b20202] ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            <PiUploadSimple className="h-4 w-4" />
            {url ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </label>
          {url && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <PiTrash className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Organization chart ────────────────────────────────────────────────────────
//
// A simple vertical hierarchy: manager → current employee → direct reports.
// Built entirely client-side from the colleague list passed into the form.

function OrgNode({
  e,
  subtitle,
  highlight = false,
}: {
  e: Employee;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${
        highlight
          ? 'border-[#b20202]/30 bg-[#b20202]/5'
          : 'border-gray-200 bg-white'
      }`}
    >
      <Avatar e={e} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">
          {fullName(e)}
        </p>
        <p className="truncate text-xs text-gray-400">
          {subtitle || e.email}
        </p>
      </div>
      <span className="ml-auto shrink-0">
        <RoleBadge role={e.role} />
      </span>
    </div>
  );
}

function OrgConnector() {
  return (
    <div className="flex justify-center py-1.5">
      <span className="h-4 w-px bg-gray-200" />
    </div>
  );
}

function OrgChart({
  manager,
  current,
  reports,
  currentTitle,
}: {
  manager: Employee | null;
  current: Employee;
  reports: Employee[];
  currentTitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      {manager ? (
        <>
          <OrgNode
            e={manager}
            subtitle={manager.employeeProfile?.work?.jobTitle || 'Manager'}
          />
          <OrgConnector />
        </>
      ) : (
        <p className="mb-2 text-center text-xs text-gray-400">
          No manager assigned
        </p>
      )}

      <OrgNode e={current} subtitle={currentTitle} highlight />

      {reports.length > 0 && (
        <>
          <OrgConnector />
          <p
            className={`${fraunces.className} mb-2 text-center text-xs font-semibold text-gray-500`}
          >
            {reports.length} direct{' '}
            {reports.length === 1 ? 'report' : 'reports'}
          </p>
          <div className="space-y-2">
            {reports.map((r) => (
              <OrgNode
                key={r._id}
                e={r}
                subtitle={r.employeeProfile?.work?.jobTitle}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function EmployeeProfileForm({
  form,
  setForm,
  token,
  editing,
  colleagues = [],
}: {
  form: EmployeeInput;
  setForm: (f: EmployeeInput) => void;
  token: string;
  /** The employee being edited, or null when creating. */
  editing: Employee | null;
  /** Other employees, used for the Manager picker and org chart. */
  colleagues?: Employee[];
}) {
  // The owner cannot be demoted/suspended, so lock those controls when editing one.
  const isOwner = editing?.role === 'tenant_owner';

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

  // ── Manager picker + org chart (derived from `colleagues`) ──
  // Candidates exclude the person being edited (you can't be your own manager).
  const managerOptions = colleagues.filter((c) => c._id !== editing?._id);
  const managerId = profile.work?.manager ?? '';
  const manager = managerId
    ? colleagues.find((c) => c._id === managerId) ?? null
    : null;
  const reports = editing
    ? colleagues.filter(
        (c) =>
          c._id !== editing._id &&
          c.employeeProfile?.work?.manager === editing._id
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Identity */}
      <section id="details" className="scroll-mt-28">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Details
        </p>
        <div className="grid grid-cols-2 gap-4">
          <AvatarField
            url={form.avatar?.url ?? ''}
            seed={
              [form.firstName, form.lastName].filter(Boolean).join(' ') ||
              form.email
            }
            token={token}
            onChange={(avatar) => setForm({ ...form, avatar })}
          />
          <label className="text-sm font-medium text-gray-700">
            First name
            <input
              className={`mt-1.5 ${PFIELD}`}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Ada"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Last name
            <input
              className={`mt-1.5 ${PFIELD}`}
              value={form.lastName ?? ''}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Obi"
            />
          </label>
          <label className="col-span-2 text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              disabled={!!editing}
              className={`mt-1.5 ${PFIELD} ${editing ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ada@drinksharbour.com"
            />
          </label>
          <label className="col-span-2 text-sm font-medium text-gray-700">
            Phone <span className="font-normal text-gray-400">(optional)</span>
            <input
              type="tel"
              className={`mt-1.5 ${PFIELD}`}
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+234…"
            />
          </label>
        </div>
      </section>

      {/* Role & status */}
      <section
        id="access"
        className="scroll-mt-28 border-t border-gray-100 pt-5"
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Access
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">
            Role
            <select
              disabled={isOwner}
              className={`mt-1.5 ${PFIELD} ${isOwner ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
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
              className={`mt-1.5 ${PFIELD} ${isOwner ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as EmployeeStatus })
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
      <section id="pos" className="scroll-mt-28 border-t border-gray-100 pt-5">
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
                className={`mt-1.5 ${PFIELD} bg-white`}
                value={form.posName ?? ''}
                onChange={(e) => setForm({ ...form, posName: e.target.value })}
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
                className={`mt-1.5 ${PFIELD} bg-white tracking-[0.3em]`}
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

      {/* Work information + org chart */}
      <ProfileSection id="work" title="Work Information">
        <PText
          label="Department"
          path="work.department"
          profile={profile}
          setP={setP}
          placeholder="e.g. Sales"
        />
        <PText
          label="Job Position"
          path="work.jobPosition"
          profile={profile}
          setP={setP}
          placeholder="e.g. Sales Associate"
        />
        <PText
          label="Job Title"
          path="work.jobTitle"
          profile={profile}
          setP={setP}
          placeholder="e.g. Senior Bartender"
          span2
        />
        <label className="col-span-2 text-sm font-medium text-gray-700">
          Manager
          <select
            className={`mt-1.5 ${PFIELD}`}
            value={managerId}
            onChange={(e) => setP('work.manager', e.target.value)}
          >
            <option value="">—</option>
            {managerOptions.map((c) => (
              <option key={c._id} value={c._id}>
                {fullName(c)}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 mt-1">
          <p className="mb-2 text-sm font-medium text-gray-700">Work Address</p>
          <div className="grid grid-cols-2 gap-4">
            <PText
              label="Company"
              path="work.workAddress.company"
              profile={profile}
              setP={setP}
              placeholder="DrinksHarbour"
              span2
            />
            <PText
              label="Street"
              path="work.workAddress.street"
              profile={profile}
              setP={setP}
              placeholder="Street…"
              span2
            />
            <PText
              label="Street 2"
              path="work.workAddress.street2"
              profile={profile}
              setP={setP}
              placeholder="Street 2…"
              span2
            />
            <PText
              label="City"
              path="work.workAddress.city"
              profile={profile}
              setP={setP}
            />
            <PText
              label="ZIP"
              path="work.workAddress.zip"
              profile={profile}
              setP={setP}
            />
            <PText
              label="Country"
              path="work.workAddress.country"
              profile={profile}
              setP={setP}
              span2
            />
          </div>
        </div>

        <PText
          label="Work Location"
          path="work.workLocation"
          profile={profile}
          setP={setP}
          placeholder="e.g. Maitama Branch"
          span2
        />
        <PTextArea
          label="Note"
          path="work.note"
          profile={profile}
          setP={setP}
          placeholder="Anything worth noting about this role…"
        />

        {editing && (
          <div className="col-span-2 mt-2">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Organization Chart
            </p>
            <OrgChart
              manager={manager}
              current={editing}
              reports={reports}
              currentTitle={profile.work?.jobTitle || profile.work?.jobPosition}
            />
          </div>
        )}
      </ProfileSection>

      {/* ── HR profile ── */}

      <ProfileSection id="private-contact" title="Private Contact">
        <PText
          label="Private email"
          path="privateContact.email"
          profile={profile}
          setP={setP}
          type="email"
          placeholder="myprivateemail@example.com"
          span2
        />
        <PText
          label="Private phone"
          path="privateContact.phone"
          profile={profile}
          setP={setP}
          type="tel"
          placeholder="+234…"
          span2
        />
        <div className="col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Bank accounts</p>
            <button
              type="button"
              onClick={addBank}
              className="flex items-center gap-1 text-xs font-semibold text-[#b20202] hover:underline"
            >
              <PiPlus className="h-3.5 w-3.5" /> Add account
            </button>
          </div>
          <div className="space-y-2">
            {banks.length === 0 && (
              <p className="text-xs text-gray-400">No bank accounts.</p>
            )}
            {banks.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <input
                  className={PFIELD}
                  value={b.bankName ?? ''}
                  onChange={(e) => setBank(i, 'bankName', e.target.value)}
                  placeholder="Bank"
                />
                <input
                  className={PFIELD}
                  value={b.accountNumber ?? ''}
                  onChange={(e) => setBank(i, 'accountNumber', e.target.value)}
                  placeholder="Account no."
                />
                <input
                  className={PFIELD}
                  value={b.accountName ?? ''}
                  onChange={(e) => setBank(i, 'accountName', e.target.value)}
                  placeholder="Account name"
                />
                <button
                  type="button"
                  onClick={() => removeBank(i)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Remove"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </ProfileSection>

      <ProfileSection id="personal" title="Personal Information">
        <PText
          label="Legal name"
          path="personal.legalName"
          profile={profile}
          setP={setP}
          placeholder="Alice"
          span2
        />
        <PText
          label="Birthday"
          path="personal.birthday"
          profile={profile}
          setP={setP}
          type="date"
        />
        <PSelect
          label="Gender"
          path="personal.gender"
          profile={profile}
          setP={setP}
          options={GENDER_OPTIONS}
        />
        <PText
          label="Place of birth — city"
          path="personal.placeOfBirthCity"
          profile={profile}
          setP={setP}
          placeholder="City"
        />
        <PText
          label="Place of birth — country"
          path="personal.placeOfBirthCountry"
          profile={profile}
          setP={setP}
          placeholder="Country"
        />
        <PText
          label="Payslip language"
          path="personal.payslipLanguage"
          profile={profile}
          setP={setP}
          placeholder="User Language"
          span2
        />
      </ProfileSection>

      <ProfileSection id="emergency" title="Emergency Contact">
        <PText
          label="Contact"
          path="emergencyContact.name"
          profile={profile}
          setP={setP}
          placeholder="Full name"
        />
        <PText
          label="Phone"
          path="emergencyContact.phone"
          profile={profile}
          setP={setP}
          type="tel"
          placeholder="+234…"
        />
      </ProfileSection>

      <ProfileSection id="visa" title="Visa & Work Permit">
        <PText
          label="Visa No"
          path="visaWorkPermit.visaNo"
          profile={profile}
          setP={setP}
        />
        <PText
          label="Work Permit No"
          path="visaWorkPermit.workPermitNo"
          profile={profile}
          setP={setP}
        />
        <UploadField
          label="Document"
          path="visaWorkPermit.documentUrl"
          profile={profile}
          setP={setP}
          token={token}
        />
      </ProfileSection>

      <ProfileSection id="citizenship" title="Citizenship">
        <PText
          label="Nationality (Country)"
          path="citizenship.nationality"
          profile={profile}
          setP={setP}
          span2
        />
        <button
          type="button"
          onClick={() =>
            setP('citizenship.nonResident', !profile.citizenship?.nonResident)
          }
          className={`col-span-2 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${profile.citizenship?.nonResident ? 'border-[#b20202] bg-[#fef2f2] text-[#b20202]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
        >
          {profile.citizenship?.nonResident && (
            <PiCheck className="h-4 w-4 shrink-0" />
          )}
          Non-resident
        </button>
        <PText
          label="Identification No"
          path="citizenship.identificationNo"
          profile={profile}
          setP={setP}
        />
        <PText
          label="SSN No"
          path="citizenship.ssnNo"
          profile={profile}
          setP={setP}
        />
        <PText
          label="Passport No"
          path="citizenship.passportNo"
          profile={profile}
          setP={setP}
          span2
        />
      </ProfileSection>

      <ProfileSection id="location" title="Location">
        <PText
          label="Street"
          path="location.address.street"
          profile={profile}
          setP={setP}
          placeholder="Street…"
          span2
        />
        <PText
          label="Street 2"
          path="location.address.street2"
          profile={profile}
          setP={setP}
          placeholder="Street 2…"
          span2
        />
        <PText
          label="City"
          path="location.address.city"
          profile={profile}
          setP={setP}
        />
        <PText
          label="State"
          path="location.address.state"
          profile={profile}
          setP={setP}
        />
        <PText
          label="ZIP"
          path="location.address.zip"
          profile={profile}
          setP={setP}
        />
        <PText
          label="Country"
          path="location.address.country"
          profile={profile}
          setP={setP}
        />
        <PText
          label="Home-Work Distance (km)"
          path="location.homeWorkDistanceKm"
          profile={profile}
          setP={setP}
          type="number"
          span2
        />
      </ProfileSection>

      <ProfileSection id="family" title="Family">
        <PSelect
          label="Marital Status"
          path="family.maritalStatus"
          profile={profile}
          setP={setP}
          options={MARITAL_OPTIONS}
        />
        <PText
          label="Dependent Children"
          path="family.dependentChildren"
          profile={profile}
          setP={setP}
          type="number"
        />
      </ProfileSection>

      <ProfileSection id="education" title="Education">
        <PText
          label="Certificate Level"
          path="education.certificateLevel"
          profile={profile}
          setP={setP}
        />
        <PText
          label="Field of Study"
          path="education.fieldOfStudy"
          profile={profile}
          setP={setP}
        />
      </ProfileSection>

      <ProfileSection id="documents" title="Documents">
        <UploadField
          label="ID Card Copy"
          path="documents.idCardUrl"
          profile={profile}
          setP={setP}
          token={token}
        />
        <UploadField
          label="Driving License"
          path="documents.drivingLicenseUrl"
          profile={profile}
          setP={setP}
          token={token}
        />
        <UploadField
          label="SIM Card Copy"
          path="documents.simCardUrl"
          profile={profile}
          setP={setP}
          token={token}
        />
        <UploadField
          label="Internet Subscription Invoice"
          path="documents.internetInvoiceUrl"
          profile={profile}
          setP={setP}
          token={token}
        />
      </ProfileSection>

      <ProfileSection id="appraisal" title="Appraisal">
        <PText
          label="Next Appraisal Date"
          path="appraisal.nextAppraisalDate"
          profile={profile}
          setP={setP}
          type="date"
          span2
        />
      </ProfileSection>

      <ProfileSection id="approvers" title="Approvers">
        <PText
          label="HR Responsible"
          path="approvers.hrResponsible"
          profile={profile}
          setP={setP}
          span2
        />
        <PText
          label="Expense"
          path="approvers.expense"
          profile={profile}
          setP={setP}
        />
        <PText
          label="Time Off"
          path="approvers.timeOff"
          profile={profile}
          setP={setP}
        />
      </ProfileSection>

      <ProfileSection id="planning" title="Planning">
        <label className="col-span-2 text-sm font-medium text-gray-700">
          Roles{' '}
          <span className="font-normal text-gray-400">(comma-separated)</span>
          <input
            className={`mt-1.5 ${PFIELD}`}
            value={roles.join(', ')}
            onChange={(e) =>
              setP(
                'planning.roles',
                e.target.value
                  .split(',')
                  .map((r) => r.trim())
                  .filter(Boolean)
              )
            }
            placeholder="e.g. Bartender"
          />
        </label>
        <PText
          label="Default Role"
          path="planning.defaultRole"
          profile={profile}
          setP={setP}
          placeholder="e.g. Bartender"
          span2
        />
      </ProfileSection>

      <ProfileSection id="app-settings" title="Application Settings">
        <PText
          label="Analytic Distribution"
          path="appSettings.analyticDistribution"
          profile={profile}
          setP={setP}
          span2
        />
        <PText
          label="Hourly Cost (₦)"
          path="appSettings.hourlyCost"
          profile={profile}
          setP={setP}
          type="number"
          span2
        />
      </ProfileSection>

      <ProfileSection id="attendance" title="Attendance / Point of Sale">
        <PText
          label="RFID / Badge Number"
          path="attendance.rfidBadge"
          profile={profile}
          setP={setP}
          placeholder="041667944074"
          span2
        />
        <p className="col-span-2 -mt-1 text-[11px] text-gray-400">
          The POS PIN is set in the Point of Sale section above.
        </p>
      </ProfileSection>

      <ProfileSection id="timezone" title="Timezone">
        <PText
          label="Timezone"
          path="timezone"
          profile={profile}
          setP={setP}
          placeholder="Africa/Lagos"
          span2
        />
      </ProfileSection>
    </div>
  );
}
