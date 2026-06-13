'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PiPlus,
  PiArrowClockwise,
  PiPencilSimple,
  PiTrash,
  PiX,
  PiCheck,
  PiMagnifyingGlass,
  PiBuildings,
  PiEnvelope,
  PiPhone,
  PiGlobe,
  PiList,
  PiSquaresFour,
  PiUser,
  PiMapPin,
  PiIdentificationCard,
  PiBank,
  PiWarning,
  PiArrowRight,
  PiCaretDown,
  PiCaretLeft,
  PiCaretRight,
  PiFunnel,
  PiSlidersHorizontal,
  PiStar,
  PiBookmark,
  PiTrashSimple,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_TERMS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_14', label: 'Net 14' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];

const AVATAR_PALETTE = [
  { bg: '#fef2f2', text: '#b91c1c' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#f0fdf4', text: '#15803d' },
  { bg: '#faf5ff', text: '#7e22ce' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#f0fdfa', text: '#0f766e' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eef2ff', text: '#4338ca' },
  { bg: '#fffbeb', text: '#b45309' },
  { bg: '#ecfeff', text: '#0e7490' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAvatar(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Search / filter / group constants ───────────────────────────────────────

const PAGE_SIZE = 20;

const FILTER_OPTIONS = [
  { id: 'individuals', label: 'Individuals', group: 'type' },
  { id: 'companies', label: 'Companies', group: 'type' },
  { id: 'has_website', label: 'Has Website', group: 'info' },
  { id: 'has_bank', label: 'Has Bank Details', group: 'info' },
  { id: 'archived', label: 'Archived', group: 'status' },
] as const;

type FilterId = (typeof FILTER_OPTIONS)[number]['id'];

const GROUP_BY_OPTIONS = [
  { id: 'country', label: 'Country' },
  { id: 'type', label: 'Vendor Type' },
  { id: 'payment_terms', label: 'Payment Terms' },
] as const;

type GroupById = (typeof GROUP_BY_OPTIONS)[number]['id'] | null;

// ── Custom filter builder ─────────────────────────────────────────────────────

const CF_FIELDS = [
  { id: 'name', label: 'Name', placeholder: 'e.g. Acme Corp' },
  { id: 'email', label: 'Email', placeholder: 'e.g. info@acme.com' },
  { id: 'phone', label: 'Phone', placeholder: 'e.g. +1 234 567 8900' },
  { id: 'city', label: 'City', placeholder: 'e.g. Lagos' },
  { id: 'country', label: 'Country', placeholder: 'e.g. Nigeria' },
  { id: 'payment_terms', label: 'Payment Terms', placeholder: 'e.g. net_30' },
  { id: 'tax_id', label: 'Tax ID', placeholder: 'e.g. 12-3456789' },
] as const;

type CFField = (typeof CF_FIELDS)[number]['id'];

const CF_OPS = [
  { id: 'contains', label: 'contains', needsValue: true },
  { id: 'not_contains', label: 'does not contain', needsValue: true },
  { id: 'equals', label: 'equals', needsValue: true },
  { id: 'not_equals', label: 'is not equal to', needsValue: true },
  { id: 'is_set', label: 'is set', needsValue: false },
  { id: 'is_not_set', label: 'is not set', needsValue: false },
] as const;

type CFOp = (typeof CF_OPS)[number]['id'];

export interface CustomFilter {
  id: string;
  field: CFField;
  operator: CFOp;
  value: string;
}

interface SavedSearch {
  id: string;
  name: string;
  search: string;
  activeFilters: FilterId[];
  customFilters: CustomFilter[];
  groupBy: GroupById;
  statusFilter: StatusFilter;
  useByDefault?: boolean;
}

function getGroupKey(v: Vendor, groupBy: GroupById): string {
  if (groupBy === 'country') return v.address?.country || 'No Country';
  if (groupBy === 'type')
    return v.vendorType === 'individual' ? 'Individual' : 'Company';
  if (groupBy === 'payment_terms') {
    const term = PAYMENT_TERMS.find((t) => t.value === v.paymentTerms);
    return term?.label ?? v.paymentTerms ?? 'No Terms';
  }
  return '';
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'grid';
type SortOption = 'name_asc' | 'name_desc' | 'active_first' | 'inactive_first';
type StatusFilter = 'all' | 'active' | 'inactive';
type Tab = 'general' | 'address' | 'contact' | 'bank';

interface FormState {
  name: string;
  vendorType: 'individual' | 'company';
  email: string;
  phone: string;
  website: string;
  taxId: string;
  paymentTerms: string;
  isActive: boolean;
  notes: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    vendorType: 'company',
    email: '',
    phone: '',
    website: '',
    taxId: '',
    paymentTerms: 'net_30',
    isActive: true,
    notes: '',
    street: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
  };
}

function vendorToForm(v: Vendor): FormState {
  return {
    name: v.name ?? '',
    vendorType: v.vendorType ?? 'company',
    email: v.email ?? '',
    phone: v.phone ?? '',
    website: v.website ?? '',
    taxId: v.taxId ?? '',
    paymentTerms: v.paymentTerms ?? 'net_30',
    isActive: v.isActive !== false,
    notes: v.notes ?? '',
    street: v.address?.street ?? '',
    city: v.address?.city ?? '',
    state: v.address?.state ?? '',
    country: v.address?.country ?? '',
    zipCode: v.address?.zipCode ?? '',
    contactName: v.contactPerson?.name ?? '',
    contactEmail: v.contactPerson?.email ?? '',
    contactPhone: v.contactPerson?.phone ?? '',
    bankAccountName: v.bankDetails?.accountName ?? '',
    bankAccountNumber: v.bankDetails?.accountNumber ?? '',
    bankName: v.bankDetails?.bankName ?? '',
  };
}

function formToPayload(f: FormState) {
  return {
    name: f.name.trim(),
    vendorType: f.vendorType,
    email: f.email.trim() || undefined,
    phone: f.phone.trim() || undefined,
    website: f.website.trim() || undefined,
    taxId: f.taxId.trim() || undefined,
    paymentTerms: f.paymentTerms as Vendor['paymentTerms'],
    isActive: f.isActive,
    notes: f.notes.trim() || undefined,
    address:
      f.street || f.city || f.state || f.country || f.zipCode
        ? {
            street: f.street || undefined,
            city: f.city || undefined,
            state: f.state || undefined,
            country: f.country || undefined,
            zipCode: f.zipCode || undefined,
          }
        : undefined,
    contactPerson:
      f.contactName || f.contactEmail || f.contactPhone
        ? {
            name: f.contactName || undefined,
            email: f.contactEmail || undefined,
            phone: f.contactPhone || undefined,
          }
        : undefined,
    bankDetails:
      f.bankAccountName || f.bankAccountNumber || f.bankName
        ? {
            accountName: f.bankAccountName || undefined,
            accountNumber: f.bankAccountNumber || undefined,
            bankName: f.bankName || undefined,
          }
        : undefined,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

const SELECT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {required && <span className="text-[#b20202]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Vendor Avatar ────────────────────────────────────────────────────────────

function VendorAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const palette = getAvatar(name);
  const sizeMap = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl font-bold ${sizeMap[size]}`}
      style={{ background: palette.bg, color: palette.text }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Vendor Card (Grid) ───────────────────────────────────────────────────────

function VendorCard({
  vendor,
  onEdit,
  onDelete,
  onView,
}: {
  vendor: Vendor;
  onEdit: (v: Vendor) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const termLabel =
    PAYMENT_TERMS.find((t) => t.value === vendor.paymentTerms)?.label ??
    vendor.paymentTerms;
  const location = [vendor.address?.city, vendor.address?.country]
    .filter(Boolean)
    .join(', ');
  const isActive = vendor.isActive !== false;
  const isCompany = vendor.vendorType !== 'individual';

  return (
    <div
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
      onClick={() => onView(vendor._id)}
    >
      {/* Header gradient banner */}
      <div
        className="relative h-16 w-full"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, #b20202 0%, #7f0000 100%)'
            : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
          {isCompany ? (
            <PiBuildings className="h-3 w-3 text-white/90" />
          ) : (
            <PiUser className="h-3 w-3 text-white/90" />
          )}
          <span className="text-[10px] font-medium text-white/90">
            {isCompany ? 'Company' : 'Individual'}
          </span>
        </div>
      </div>

      {/* Avatar overlapping banner */}
      <div className="-mt-5 px-4">
        <div className="inline-flex rounded-xl shadow-sm ring-2 ring-white">
          <VendorAvatar name={vendor.name} size="md" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="flex-1 font-semibold leading-tight text-gray-900 transition-colors group-hover:text-[#b20202]">
            {vendor.name}
          </p>
          <span
            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {location && (
          <p className="mb-3 flex items-center gap-1 text-xs text-gray-400">
            <PiMapPin className="h-3 w-3 shrink-0" />
            {location}
          </p>
        )}

        <div className="mb-3 space-y-1.5">
          {vendor.email && (
            <a
              href={`mailto:${vendor.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-xs text-gray-600 transition-colors hover:text-[#b20202]"
            >
              <PiEnvelope className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{vendor.email}</span>
            </a>
          )}
          {vendor.phone && (
            <a
              href={`tel:${vendor.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-xs text-gray-600 transition-colors hover:text-[#b20202]"
            >
              <PiPhone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {vendor.phone}
            </a>
          )}
          {vendor.website && (
            <a
              href={
                vendor.website.startsWith('http')
                  ? vendor.website
                  : `https://${vendor.website}`
              }
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-xs text-blue-500 hover:underline"
            >
              <PiGlobe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {vendor.website.replace(/^https?:\/\//, '')}
              </span>
            </a>
          )}
          {vendor.contactPerson?.name && (
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <PiUser className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {vendor.contactPerson.name}
            </p>
          )}
          {!vendor.email &&
            !vendor.phone &&
            !vendor.website &&
            !vendor.contactPerson?.name && (
              <p className="text-xs italic text-gray-300">No contact info</p>
            )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          {termLabel ? (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {termLabel}
            </span>
          ) : (
            <span />
          )}

          {confirmDelete ? (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <PiWarning className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-600">Delete?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(vendor._id);
                  setConfirmDelete(false);
                }}
                className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(vendor);
                }}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Edit vendor"
              >
                <PiPencilSimple className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Delete vendor"
              >
                <PiTrash className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(vendor._id);
                }}
                className="ml-0.5 flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                View <PiArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── List Row Actions (inline delete confirm) ─────────────────────────────────

function ListRowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <div
        className="flex items-center justify-end gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-medium text-red-600">Delete?</span>
        <button
          type="button"
          onClick={() => {
            onDelete();
            setConfirm(false);
          }}
          className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="Edit"
      >
        <PiPencilSimple className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setConfirm(true);
        }}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        title="Delete"
      >
        <PiTrash className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Vendor Modal ─────────────────────────────────────────────────────────────

const MODAL_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'general',
    label: 'General',
    icon: <PiIdentificationCard className="h-4 w-4" />,
  },
  { id: 'address', label: 'Address', icon: <PiMapPin className="h-4 w-4" /> },
  { id: 'contact', label: 'Contact', icon: <PiUser className="h-4 w-4" /> },
  { id: 'bank', label: 'Banking', icon: <PiBank className="h-4 w-4" /> },
];

function VendorModal({
  vendor,
  onClose,
  onSaved,
  token,
}: {
  vendor: Vendor | null;
  onClose: () => void;
  onSaved: () => void;
  token: string;
}) {
  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState<FormState>(
    vendor ? vendorToForm(vendor) : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  function set(patch: Partial<FormState>) {
    setForm((p) => ({ ...p, ...patch }));
    const keys = Object.keys(patch) as (keyof FormState)[];
    if (keys.some((k) => errors[k])) {
      setErrors((e) => {
        const n = { ...e };
        keys.forEach((k) => delete n[k]);
        return n;
      });
    }
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Vendor name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Invalid email address';
    setErrors(e);
    if (e.name) {
      setTab('general');
      return false;
    }
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (vendor) {
        await vendorService.update(vendor._id, payload, token);
        toast.success('Vendor updated');
      } else {
        await vendorService.create(payload, token);
        toast.success('Vendor created');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Left tab rail */}
        <div className="flex w-44 shrink-0 flex-col bg-gray-50 py-6">
          <div className="mb-6 px-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {vendor ? 'Edit Vendor' : 'New Vendor'}
            </p>
          </div>
          <nav className="flex flex-col gap-0.5 px-2">
            {MODAL_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
                }`}
              >
                <span
                  className={tab === t.id ? 'text-[#b20202]' : 'text-gray-400'}
                >
                  {t.icon}
                </span>
                {t.label}
                {t.id === 'general' && (errors.name || errors.email) && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </nav>

          {/* Status toggle in sidebar */}
          <div className="mt-auto px-4 pb-2">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Status
              </p>
              <button
                type="button"
                onClick={() => set({ isActive: !form.isActive })}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  form.isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${form.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}
                />
                {form.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {MODAL_TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-xs text-gray-400">
                {tab === 'general' && 'Basic info and payment settings'}
                {tab === 'address' && 'Billing and delivery address'}
                {tab === 'contact' && 'Primary contact person details'}
                {tab === 'bank' && 'Bank account for payments'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <PiX className="h-5 w-5" />
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto px-6 py-5"
            style={{ maxHeight: '62vh' }}
          >
            {tab === 'general' && (
              <div className="space-y-4">
                <Field label="Vendor Name" required error={errors.name}>
                  <input
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    className={`${INPUT_CLS} ${errors.name ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}
                    placeholder="e.g. Diageo Nigeria Ltd"
                    autoFocus
                  />
                </Field>

                <Field label="Vendor Type">
                  <div className="grid grid-cols-2 gap-2">
                    {(['company', 'individual'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set({ vendorType: type })}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                          form.vendorType === type
                            ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {type === 'company' ? (
                          <PiBuildings className="h-4 w-4" />
                        ) : (
                          <PiUser className="h-4 w-4" />
                        )}
                        {type === 'company' ? 'Company' : 'Individual'}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email" error={errors.email}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set({ email: e.target.value })}
                      className={`${INPUT_CLS} ${errors.email ? 'border-red-400 ring-2 ring-red-400/20' : ''}`}
                      placeholder="vendor@example.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={form.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                      className={INPUT_CLS}
                      placeholder="+234 800 000 0000"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Website">
                    <input
                      value={form.website}
                      onChange={(e) => set({ website: e.target.value })}
                      placeholder="https://"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Tax / RC Number">
                    <input
                      value={form.taxId}
                      onChange={(e) => set({ taxId: e.target.value })}
                      className={INPUT_CLS}
                      placeholder="RC0000000"
                    />
                  </Field>
                </div>

                <Field label="Payment Terms">
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => set({ paymentTerms: e.target.value })}
                    className={SELECT_CLS}
                  >
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Internal Notes">
                  <textarea
                    value={form.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                    rows={2}
                    className={INPUT_CLS}
                    placeholder="Any internal notes about this vendor…"
                  />
                </Field>
              </div>
            )}

            {tab === 'address' && (
              <div className="space-y-4">
                <Field label="Street Address">
                  <input
                    value={form.street}
                    onChange={(e) => set({ street: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="123 Main Street"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <input
                      value={form.city}
                      onChange={(e) => set({ city: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="State / Province">
                    <input
                      value={form.state}
                      onChange={(e) => set({ state: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Country">
                    <input
                      value={form.country}
                      onChange={(e) => set({ country: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="ZIP / Postal Code">
                    <input
                      value={form.zipCode}
                      onChange={(e) => set({ zipCode: e.target.value })}
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'contact' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-xs text-gray-500">
                  Primary contact for purchase orders and communications.
                </div>
                <Field label="Full Name">
                  <input
                    value={form.contactName}
                    onChange={(e) => set({ contactName: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => set({ contactEmail: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={form.contactPhone}
                    onChange={(e) => set({ contactPhone: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
              </div>
            )}

            {tab === 'bank' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Bank details are used for payment reconciliation only. Keep
                  this information confidential.
                </div>
                <Field label="Bank Name">
                  <input
                    value={form.bankName}
                    onChange={(e) => set({ bankName: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="e.g. Access Bank"
                  />
                </Field>
                <Field label="Account Name">
                  <input
                    value={form.bankAccountName}
                    onChange={(e) => set({ bankAccountName: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Account Number">
                  <input
                    value={form.bankAccountNumber}
                    onChange={(e) => set({ bankAccountNumber: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="10-digit NUBAN"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <div className="flex gap-1">
              {MODAL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`h-1.5 rounded-full transition-all ${
                    tab === t.id
                      ? 'w-5 bg-[#b20202]'
                      : 'w-1.5 bg-gray-200 hover:bg-gray-300'
                  }`}
                  aria-label={`Go to ${t.label}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#b20202] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#9a0101] disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving…
                  </>
                ) : (
                  <>
                    <PiCheck className="h-4 w-4" />
                    {vendor ? 'Update Vendor' : 'Create Vendor'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Table (reused by list view + grouped list) ────────────────────────

function VendorTable({
  vendors,
  onEdit,
  onDelete,
  onView,
}: {
  vendors: Vendor[];
  onEdit: (v: Vendor) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Vendor
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Contact
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
              Type
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">
              Terms
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {vendors.map((v) => {
            const isActive = v.isActive !== false;
            return (
              <tr
                key={v._id}
                className="group cursor-pointer transition-colors hover:bg-gray-50/70"
                onClick={() => onView(v._id)}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <VendorAvatar name={v.name} size="sm" />
                    <div>
                      <p className="font-semibold text-gray-900 transition-colors group-hover:text-[#b20202]">
                        {v.name}
                      </p>
                      {v.address?.city && (
                        <p className="flex items-center gap-1 text-xs text-gray-400">
                          <PiMapPin className="h-2.5 w-2.5" />
                          {[v.address.city, v.address.country]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="space-y-0.5">
                    {v.email && (
                      <a
                        href={`mailto:${v.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-gray-600 transition-colors hover:text-[#b20202]"
                      >
                        <PiEnvelope className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="max-w-[160px] truncate">
                          {v.email}
                        </span>
                      </a>
                    )}
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-gray-600 transition-colors hover:text-[#b20202]"
                      >
                        <PiPhone className="h-3 w-3 shrink-0 text-gray-400" />
                        {v.phone}
                      </a>
                    )}
                    {!v.email && !v.phone && (
                      <span className="text-xs italic text-gray-300">—</span>
                    )}
                  </div>
                </td>
                <td className="hidden px-4 py-3.5 md:table-cell">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    {v.vendorType !== 'individual' ? (
                      <>
                        <PiBuildings className="h-3.5 w-3.5 text-gray-400" />
                        Company
                      </>
                    ) : (
                      <>
                        <PiUser className="h-3.5 w-3.5 text-gray-400" />
                        Individual
                      </>
                    )}
                  </span>
                </td>
                <td className="hidden px-4 py-3.5 sm:table-cell">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {v.paymentTerms
                      ? (PAYMENT_TERMS.find((t) => t.value === v.paymentTerms)
                          ?.label ?? v.paymentTerms)
                      : '—'}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}
                    />
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <ListRowActions
                    onEdit={() => onEdit(v)}
                    onDelete={() => onDelete(v._id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="h-16 bg-gray-200" />
      <div className="px-4 pb-4 pt-3">
        <div className="-mt-3 mb-3 h-10 w-10 rounded-xl bg-gray-200 ring-2 ring-white" />
        <div className="mb-1.5 h-4 w-32 rounded bg-gray-200" />
        <div className="mb-3 h-3 w-20 rounded bg-gray-100" />
        <div className="space-y-2">
          <div className="h-3 w-40 rounded bg-gray-100" />
          <div className="h-3 w-28 rounded bg-gray-100" />
        </div>
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3">
          <div className="h-3 w-14 rounded bg-gray-100" />
          <div className="flex gap-1">
            <div className="h-6 w-6 rounded-lg bg-gray-100" />
            <div className="h-6 w-6 rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Odoo-style unified Search Bar ───────────────────────────────────────────

function FilterCheckbox({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-gray-50 ${active ? 'text-gray-900' : 'text-gray-600'}`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'
        }`}
      >
        {active && <PiCheck className="h-2.5 w-2.5 text-white" />}
      </span>
      {label}
    </button>
  );
}

function SearchBar({
  search,
  onSearchChange,
  activeFilters,
  onToggleFilter,
  customFilters,
  onAddCustomFilter,
  onRemoveCustomFilter,
  groupBy,
  onGroupByChange,
  savedSearches,
  onSaveSearch,
  onLoadSearch,
  onDeleteSavedSearch,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  activeFilters: Set<FilterId>;
  onToggleFilter: (id: FilterId) => void;
  customFilters: CustomFilter[];
  onAddCustomFilter: (f: CustomFilter) => void;
  onRemoveCustomFilter: (id: string) => void;
  groupBy: GroupById;
  onGroupByChange: (g: GroupById) => void;
  savedSearches: SavedSearch[];
  onSaveSearch: (name: string, useByDefault: boolean) => void;
  onLoadSearch: (s: SavedSearch) => void;
  onDeleteSavedSearch: (id: string) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Custom filter builder — multi-row pending state
  const [pendingRows, setPendingRows] = useState<
    { id: string; field: CFField; operator: CFOp; value: string }[]
  >([]);

  function addPendingRow() {
    setPendingRows((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        field: 'name',
        operator: 'contains',
        value: '',
      },
    ]);
  }
  function updatePendingRow(
    id: string,
    patch: Partial<{ field: CFField; operator: CFOp; value: string }>
  ) {
    setPendingRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }
  function removePendingRow(id: string) {
    setPendingRows((prev) => prev.filter((r) => r.id !== id));
  }

  // (no custom group builder — preset options cover all supported fields)

  // Save search state
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDefault, setSaveDefault] = useState(false);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
        setPendingRows([]);
        setShowSaveForm(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleAddCustomFilters() {
    const toAdd = pendingRows.filter((r) => {
      const needsValue =
        CF_OPS.find((o) => o.id === r.operator)?.needsValue ?? true;
      return !needsValue || r.value.trim();
    });
    toAdd.forEach((r) =>
      onAddCustomFilter({
        id: r.id,
        field: r.field,
        operator: r.operator,
        value: r.value.trim(),
      })
    );
    setPendingRows([]);
  }

  function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    onSaveSearch(name, saveDefault);
    setSaveName('');
    setSaveDefault(false);
    setShowSaveForm(false);
    setPanelOpen(false);
  }

  const allFilterTags = [
    ...Array.from(activeFilters).map((fid) => ({
      key: fid,
      label: FILTER_OPTIONS.find((f) => f.id === fid)?.label ?? fid,
      onRemove: () => onToggleFilter(fid),
      color: 'red' as const,
    })),
    ...customFilters.map((cf) => {
      const field = CF_FIELDS.find((f) => f.id === cf.field)?.label ?? cf.field;
      const opMeta = CF_OPS.find((o) => o.id === cf.operator);
      const op = opMeta?.label ?? cf.operator;
      const label = opMeta?.needsValue
        ? `${field} ${op} "${cf.value}"`
        : `${field} ${op}`;
      return {
        key: cf.id,
        label,
        onRemove: () => onRemoveCustomFilter(cf.id),
        color: 'red' as const,
      };
    }),
    ...(groupBy
      ? [
          {
            key: 'groupby',
            label: `▸ ${GROUP_BY_OPTIONS.find((g) => g.id === groupBy)?.label}`,
            onRemove: () => onGroupByChange(null),
            color: 'blue' as const,
          },
        ]
      : []),
  ];

  return (
    <div ref={barRef} className="relative">
      {/* ── Search bar row ── */}
      <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Left: search icon + active tags + input */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 px-3 py-1.5">
          <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
          {allFilterTags.map((tag) => (
            <span
              key={tag.key}
              className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                tag.color === 'blue'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-[#b20202]/10 text-[#b20202]'
              }`}
            >
              <PiFunnel className="h-3 w-3 shrink-0" />
              {tag.label}
              <button
                type="button"
                onClick={tag.onRemove}
                className="ml-0.5 opacity-70 hover:opacity-100"
              >
                <PiX className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setPanelOpen(true)}
            placeholder={allFilterTags.length ? '' : 'Search vendors…'}
            className="min-w-[120px] flex-1 bg-transparent py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="shrink-0 text-gray-400 hover:text-gray-600"
            >
              <PiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right: toggle button */}
        <button
          type="button"
          onClick={() => setPanelOpen((p) => !p)}
          className={`flex shrink-0 items-center justify-center border-l border-gray-200 px-3 transition-colors ${
            panelOpen
              ? 'bg-gray-100 text-gray-700'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
          }`}
          title="Toggle search options"
        >
          {panelOpen ? (
            <PiCaretDown className="h-4 w-4 rotate-180 transition-transform" />
          ) : (
            <PiCaretDown className="h-4 w-4 transition-transform" />
          )}
        </button>
      </div>

      {/* ── Unified 3-column panel ── */}
      {panelOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[640px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {/* ── Column 1: Filters ── */}
            <div className="flex max-h-[400px] flex-col overflow-y-auto p-4">
              <div className="mb-3 flex items-center gap-2">
                <PiFunnel className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Filters
                </span>
              </div>

              {/* Type group */}
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Type
              </p>
              <div className="mt-0.5 space-y-0.5">
                {FILTER_OPTIONS.filter((f) => f.group === 'type').map((f) => (
                  <FilterCheckbox
                    key={f.id}
                    active={activeFilters.has(f.id)}
                    label={f.label}
                    onClick={() => onToggleFilter(f.id)}
                  />
                ))}
              </div>

              <div className="my-2 border-t border-gray-100" />

              {/* Info group */}
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Info
              </p>
              <div className="mt-0.5 space-y-0.5">
                {FILTER_OPTIONS.filter((f) => f.group === 'info').map((f) => (
                  <FilterCheckbox
                    key={f.id}
                    active={activeFilters.has(f.id)}
                    label={f.label}
                    onClick={() => onToggleFilter(f.id)}
                  />
                ))}
              </div>

              <div className="my-2 border-t border-gray-100" />

              {/* Status group */}
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Status
              </p>
              <div className="mt-0.5 space-y-0.5">
                {FILTER_OPTIONS.filter((f) => f.group === 'status').map((f) => (
                  <FilterCheckbox
                    key={f.id}
                    active={activeFilters.has(f.id)}
                    label={f.label}
                    onClick={() => onToggleFilter(f.id)}
                  />
                ))}
              </div>

              {/* Active custom filters */}
              {customFilters.length > 0 && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Custom
                  </p>
                  <div className="mt-0.5 space-y-0.5">
                    {customFilters.map((cf) => {
                      const field =
                        CF_FIELDS.find((f) => f.id === cf.field)?.label ??
                        cf.field;
                      const opMeta = CF_OPS.find((o) => o.id === cf.operator);
                      const cfLabel = opMeta?.needsValue
                        ? `${field} ${opMeta.label} "${cf.value}"`
                        : `${field} ${opMeta?.label}`;
                      return (
                        <div
                          key={cf.id}
                          className="flex w-full items-center justify-between gap-2 rounded bg-[#b20202]/5 px-2 py-1.5 text-xs text-gray-700"
                        >
                          <span className="truncate">{cfLabel}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveCustomFilter(cf.id)}
                            className="shrink-0 text-gray-400 hover:text-[#b20202]"
                          >
                            <PiX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="my-2 border-t border-gray-100" />

              {/* Multi-row custom filter builder */}
              {pendingRows.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  <div className="space-y-1">
                    {pendingRows.map((row, i) => {
                      const rowNeedsValue =
                        CF_OPS.find((o) => o.id === row.operator)?.needsValue ??
                        true;
                      const fieldMeta = CF_FIELDS.find(
                        (f) => f.id === row.field
                      );
                      return (
                        <div key={row.id}>
                          {i > 0 && (
                            <div className="flex items-center gap-2 py-1">
                              <div className="h-px flex-1 bg-gray-200" />
                              <span className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                and
                              </span>
                              <div className="h-px flex-1 bg-gray-200" />
                            </div>
                          )}
                          <div className="rounded-md border border-gray-200 bg-white">
                            {/* Row 1: field + operator + remove */}
                            <div className="flex items-stretch divide-x divide-gray-100">
                              <select
                                value={row.field}
                                onChange={(e) =>
                                  updatePendingRow(row.id, {
                                    field: e.target.value as CFField,
                                  })
                                }
                                className="min-w-0 flex-1 rounded-l-md bg-transparent px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#b20202]"
                              >
                                {CF_FIELDS.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={row.operator}
                                onChange={(e) =>
                                  updatePendingRow(row.id, {
                                    operator: e.target.value as CFOp,
                                  })
                                }
                                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#b20202]"
                              >
                                <optgroup label="Match">
                                  {CF_OPS.filter((o) => o.needsValue).map(
                                    (o) => (
                                      <option key={o.id} value={o.id}>
                                        {o.label}
                                      </option>
                                    )
                                  )}
                                </optgroup>
                                <optgroup label="Existence">
                                  {CF_OPS.filter((o) => !o.needsValue).map(
                                    (o) => (
                                      <option key={o.id} value={o.id}>
                                        {o.label}
                                      </option>
                                    )
                                  )}
                                </optgroup>
                              </select>
                              <button
                                type="button"
                                onClick={() => removePendingRow(row.id)}
                                className="shrink-0 rounded-r-md px-2 text-gray-300 hover:bg-red-50 hover:text-red-400"
                              >
                                <PiX className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {/* Row 2: value input or no-value hint */}
                            {rowNeedsValue ? (
                              <div className="border-t border-gray-100 px-2 py-1.5">
                                <input
                                  value={row.value}
                                  onChange={(e) =>
                                    updatePendingRow(row.id, {
                                      value: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' &&
                                    handleAddCustomFilters()
                                  }
                                  placeholder={
                                    fieldMeta?.placeholder ?? 'Value…'
                                  }
                                  autoFocus={i === pendingRows.length - 1}
                                  className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-300 focus:outline-none"
                                />
                              </div>
                            ) : (
                              <div className="border-t border-gray-100 px-2 py-1.5">
                                <span className="text-xs italic text-gray-300">
                                  no value needed
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={addPendingRow}
                      className="flex items-center gap-1 text-xs font-medium text-[#b20202] hover:underline"
                    >
                      <PiPlus className="h-3 w-3" />
                      New Rule
                    </button>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPendingRows([])}
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomFilters}
                        disabled={pendingRows.every((r) => {
                          const nv =
                            CF_OPS.find((o) => o.id === r.operator)
                              ?.needsValue ?? true;
                          return nv && !r.value.trim();
                        })}
                        className="rounded-md bg-[#b20202] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {pendingRows.length > 1
                          ? `Add ${pendingRows.length} Filters`
                          : 'Add Filter'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={addPendingRow}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                >
                  <PiPlus className="h-3.5 w-3.5" />
                  Add Custom Filter
                  <PiCaretDown className="ml-auto h-3 w-3" />
                </button>
              )}
            </div>

            {/* ── Column 2: Group By ── */}
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <PiSlidersHorizontal className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Group By
                </span>
              </div>

              {/* Active group chip */}
              {groupBy && (
                <>
                  <div className="mb-2 flex items-center justify-between rounded-md bg-blue-50 px-2.5 py-1.5">
                    <span className="text-xs font-medium text-blue-700">
                      ▸ {GROUP_BY_OPTIONS.find((g) => g.id === groupBy)?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onGroupByChange(null)}
                      className="ml-2 text-blue-400 hover:text-blue-600"
                      title="Clear grouping"
                    >
                      <PiX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mb-2 border-t border-gray-100" />
                </>
              )}

              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Fields
              </p>
              <div className="mt-0.5 space-y-0.5">
                {GROUP_BY_OPTIONS.map((g) => {
                  const active = groupBy === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onGroupByChange(active ? null : g.id)}
                      className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          active
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className={active ? 'font-medium' : ''}>
                        {g.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Column 3: Favorites ── */}
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <PiStar className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Favorites
                </span>
              </div>

              {/* Saved search list */}
              {savedSearches.length > 0 && (
                <div className="mb-2 space-y-0.5">
                  {savedSearches.map((s) => (
                    <div
                      key={s.id}
                      className="group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-gray-50"
                    >
                      {s.useByDefault && (
                        <PiStar className="h-3 w-3 shrink-0 text-amber-400" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onLoadSearch(s);
                          setPanelOpen(false);
                        }}
                        className="flex-1 text-left text-sm text-gray-700 hover:text-gray-900"
                      >
                        {s.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSavedSearch(s.id)}
                        className="ml-1 shrink-0 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      >
                        <PiTrashSimple className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="my-2 border-t border-gray-100" />
                </div>
              )}

              {/* Save current search */}
              {showSaveForm ? (
                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') setShowSaveForm(false);
                    }}
                    placeholder="Search name…"
                    className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                    autoFocus
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={saveDefault}
                      onChange={(e) => setSaveDefault(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-[#b20202]"
                    />
                    Use by default
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!saveName.trim()}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#b20202] px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <PiBookmark className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveForm(false);
                        setSaveName('');
                      }}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveForm(true)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  Save current search
                  <PiCaretDown className="ml-auto h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurchasesVendors() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  // null = new vendor modal, a Vendor = edit modal, undefined = modal closed
  const [editing, setEditing] = useState<Vendor | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('name_asc');
  const [view, setView] = useState<ViewMode>('grid');
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(new Set());
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [groupBy, setGroupBy] = useState<GroupById>(null);
  const [page, setPage] = useState(1);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('vendor_saved_searches') ?? '[]');
    } catch {
      return [];
    }
  });

  const debouncedSearch = useDebounce(search, 250);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, activeFilters, customFilters, groupBy]);

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await vendorService.getAll(token);
      setVendors(res);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load vendors'
      );
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Cmd/Ctrl+N shortcut for new vendor
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && editing === undefined) {
        e.preventDefault();
        setEditing(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  async function handleDelete(id: string) {
    // Optimistic removal — restored on error
    const prev = [...vendors];
    setVendors((p) => p.filter((v) => v._id !== id));
    try {
      await vendorService.delete(id, token);
      toast.success('Vendor deleted');
    } catch (err: unknown) {
      setVendors(prev);
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete vendor'
      );
    }
  }

  function toggleFilter(id: FilterId) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function persistSavedSearches(list: SavedSearch[]) {
    setSavedSearches(list);
    localStorage.setItem('vendor_saved_searches', JSON.stringify(list));
  }

  function handleSaveSearch(name: string, useByDefault: boolean) {
    const entry: SavedSearch = {
      id: Date.now().toString(),
      name,
      search: debouncedSearch,
      activeFilters: Array.from(activeFilters),
      customFilters,
      groupBy,
      statusFilter,
      useByDefault,
    };
    persistSavedSearches([entry, ...savedSearches]);
    toast.success(`Saved "${name}"`);
  }

  function handleLoadSearch(s: SavedSearch) {
    setSearch(s.search);
    setActiveFilters(new Set(s.activeFilters));
    setCustomFilters(s.customFilters ?? []);
    setGroupBy(s.groupBy);
    setStatusFilter(s.statusFilter);
    setPage(1);
  }

  function handleDeleteSavedSearch(id: string) {
    persistSavedSearches(savedSearches.filter((s) => s.id !== id));
  }

  const q = debouncedSearch.toLowerCase().trim();
  const filtered = vendors.filter((v) => {
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.phone?.includes(q) ||
      v.address?.city?.toLowerCase().includes(q) ||
      v.address?.country?.toLowerCase().includes(q) ||
      v.contactPerson?.name?.toLowerCase().includes(q);

    const matchesStatus = activeFilters.has('archived')
      ? v.isActive === false
      : statusFilter === 'all' ||
        (statusFilter === 'active' && v.isActive !== false) ||
        (statusFilter === 'inactive' && v.isActive === false);

    // type filters: if both or neither selected → show all
    const wantIndividuals = activeFilters.has('individuals');
    const wantCompanies = activeFilters.has('companies');
    const matchesType =
      (!wantIndividuals && !wantCompanies) ||
      (wantIndividuals && wantCompanies) ||
      (wantIndividuals && v.vendorType === 'individual') ||
      (wantCompanies && v.vendorType !== 'individual');

    const matchesInfo =
      (!activeFilters.has('has_website') || !!v.website) &&
      (!activeFilters.has('has_bank') || !!v.bankDetails?.bankName);

    // Custom filters (all must match)
    const matchesCustom = customFilters.every((cf) => {
      const raw = (() => {
        if (cf.field === 'name') return v.name;
        if (cf.field === 'email') return v.email ?? '';
        if (cf.field === 'phone') return v.phone ?? '';
        if (cf.field === 'city') return v.address?.city ?? '';
        if (cf.field === 'country') return v.address?.country ?? '';
        if (cf.field === 'payment_terms') return v.paymentTerms ?? '';
        if (cf.field === 'tax_id') return v.taxId ?? '';
        return '';
      })().toLowerCase();
      const val = cf.value.toLowerCase();
      if (cf.operator === 'contains') return raw.includes(val);
      if (cf.operator === 'not_contains') return !raw.includes(val);
      if (cf.operator === 'equals') return raw === val;
      if (cf.operator === 'not_equals') return raw !== val;
      if (cf.operator === 'is_set') return raw.length > 0;
      if (cf.operator === 'is_not_set') return raw.length === 0;
      return true;
    });

    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesInfo &&
      matchesCustom
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name_asc') return a.name.localeCompare(b.name);
    if (sort === 'name_desc') return b.name.localeCompare(a.name);
    if (sort === 'active_first')
      return (b.isActive !== false ? 1 : 0) - (a.isActive !== false ? 1 : 0);
    if (sort === 'inactive_first')
      return (a.isActive !== false ? 1 : 0) - (b.isActive !== false ? 1 : 0);
    return 0;
  });

  // Pagination (disabled when groupBy is active — show all when grouped)
  const totalPages = groupBy
    ? 1
    : Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePageI = Math.min(page, totalPages);
  const paged = groupBy
    ? sorted
    : sorted.slice((safePageI - 1) * PAGE_SIZE, safePageI * PAGE_SIZE);

  // Grouping
  const groups: { key: string; items: Vendor[] }[] = [];
  if (groupBy) {
    const map = new Map<string, Vendor[]>();
    for (const v of paged) {
      const key = getGroupKey(v, groupBy);
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    for (const [key, items] of Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      groups.push({ key, items });
    }
  }

  const activeCount = vendors.filter((v) => v.isActive !== false).length;
  const inactiveCount = vendors.length - activeCount;
  const companyCount = vendors.filter(
    (v) => v.vendorType !== 'individual'
  ).length;

  const STATUS_TABS: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All Vendors', count: vendors.length },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
  ];

  const hasAnyFilter =
    search ||
    statusFilter !== 'all' ||
    activeFilters.size > 0 ||
    customFilters.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage supplier relationships and contact information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <PiArrowClockwise
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9a0101]"
            title="New vendor (⌘N)"
          >
            <PiPlus className="h-4 w-4" />
            New Vendor
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-gray-900 px-5 py-4 text-white">
          <p className="text-xs font-medium text-gray-400">Total</p>
          <p className="mt-1 text-3xl font-bold">{vendors.length}</p>
          <p className="mt-0.5 text-xs text-gray-500">vendors</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-medium text-emerald-600">Active</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">
            {activeCount}
          </p>
          <p className="mt-0.5 text-xs text-emerald-500">suppliers</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-400">Inactive</p>
          <p className="mt-1 text-3xl font-bold text-gray-500">
            {inactiveCount}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">paused</p>
        </div>
        <div className="rounded-2xl border border-[#b20202]/10 bg-[#b20202]/5 px-5 py-4">
          <p className="text-xs font-medium text-[#b20202]/70">Companies</p>
          <p className="mt-1 text-3xl font-bold text-[#b20202]">
            {companyCount}
          </p>
          <p className="mt-0.5 text-xs text-[#b20202]/60">registered</p>
        </div>
      </div>

      {/* ── Status tabs ─────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              statusFilter === tab.id
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                statusFilter === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Odoo-style Search Bar ────────────────────────────── */}
      <SearchBar
        search={search}
        onSearchChange={setSearch}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        customFilters={customFilters}
        onAddCustomFilter={(f) => setCustomFilters((p) => [...p, f])}
        onRemoveCustomFilter={(id) =>
          setCustomFilters((p) => p.filter((f) => f.id !== id))
        }
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        savedSearches={savedSearches}
        onSaveSearch={handleSaveSearch}
        onLoadSearch={handleLoadSearch}
        onDeleteSavedSearch={handleDeleteSavedSearch}
      />

      {/* ── Sort + count + view toggle ───────────────────────── */}
      <div className="flex items-center gap-2">
        {!loading && (
          <span className="flex-1 text-sm text-gray-400">
            {groupBy
              ? `${sorted.length} vendor${sorted.length !== 1 ? 's' : ''} in ${groups.length} group${groups.length !== 1 ? 's' : ''}`
              : `${sorted.length} vendor${sorted.length !== 1 ? 's' : ''}`}
          </span>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 shadow-sm focus:border-[#b20202] focus:outline-none"
        >
          <option value="name_asc">A → Z</option>
          <option value="name_desc">Z → A</option>
          <option value="active_first">Active first</option>
          <option value="inactive_first">Inactive first</option>
        </select>

        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setView('grid')}
            title="Grid view"
            className={`p-2.5 transition-colors ${
              view === 'grid'
                ? 'bg-[#b20202] text-white'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <PiSquaresFour className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            title="List view"
            className={`p-2.5 transition-colors ${
              view === 'list'
                ? 'bg-[#b20202] text-white'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <PiList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────── */}
      {loading && view === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
      {loading && view === 'list' && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-0"
            >
              <div className="h-8 w-8 rounded-lg bg-gray-200" />
              <div className="h-3.5 w-36 rounded bg-gray-200" />
              <div className="h-3 w-28 rounded bg-gray-100" />
              <div className="ml-auto h-3 w-16 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
            <PiBuildings className="h-8 w-8 text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {hasAnyFilter
                ? 'No vendors match your filters'
                : 'No vendors yet'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {hasAnyFilter
                ? 'Try adjusting your search or filters'
                : 'Add your first supplier to get started'}
            </p>
          </div>
          {!hasAnyFilter ? (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9a0101]"
            >
              <PiPlus className="h-4 w-4" /> Add First Vendor
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setActiveFilters(new Set());
                setCustomFilters([]);
              }}
              className="text-sm font-medium text-[#b20202] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Grid view ────────────────────────────────────────── */}
      {!loading && sorted.length > 0 && view === 'grid' && (
        <>
          {groupBy ? (
            <div className="space-y-6">
              {groups.map(({ key, items }) => (
                <div key={key}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {key}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {items.length}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((v) => (
                      <VendorCard
                        key={v._id}
                        vendor={v}
                        onEdit={setEditing}
                        onDelete={handleDelete}
                        onView={(id) => router.push(`/purchases/vendors/${id}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paged.map((v) => (
                <VendorCard
                  key={v._id}
                  vendor={v}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onView={(id) => router.push(`/purchases/vendors/${id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── List view ────────────────────────────────────────── */}
      {!loading && sorted.length > 0 && view === 'list' && (
        <>
          {groupBy ? (
            <div className="space-y-6">
              {groups.map(({ key, items }) => (
                <div key={key}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {key}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {items.length}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <VendorTable
                    vendors={items}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onView={(id) => router.push(`/purchases/vendors/${id}`)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <VendorTable
              vendors={paged}
              onEdit={setEditing}
              onDelete={handleDelete}
              onView={(id) => router.push(`/purchases/vendors/${id}`)}
            />
          )}
        </>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
      {!loading && !groupBy && sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-gray-500">
            {(safePageI - 1) * PAGE_SIZE + 1}–
            {Math.min(safePageI * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePageI === 1}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <PiCaretLeft className="h-3.5 w-3.5" /> Prev
            </button>

            {/* Page number pills */}
            <div className="flex items-center gap-0.5 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 || p === totalPages || Math.abs(p - safePageI) <= 1
                )
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1 text-xs text-gray-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p as number)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                        safePageI === p
                          ? 'bg-[#b20202] text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePageI === totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Next <PiCaretRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────── */}
      {editing !== undefined && (
        <VendorModal
          vendor={editing}
          token={token}
          onClose={() => setEditing(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
