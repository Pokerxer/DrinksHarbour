'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiArrowRight,
  PiPlus,
  PiGear,
  PiTrash,
  PiCheck,
  PiProhibit,
  PiX,
  PiFloppyDisk,
  PiSpinnerGap,
  PiEnvelopeSimple,
  PiPhone,
  PiUser,
  PiStorefront,
  PiGlobeSimple,
  PiUsersThree,
  PiCoins,
  PiShoppingBag,
  PiNotePencil,
  PiArrowSquareOut,
  PiIdentificationCard,
  PiClock,
  PiCamera,
} from 'react-icons/pi';
import {
  contactService,
  type Contact,
  type ContactInput,
  type ContactStatus,
} from '@/services/contact.service';
import { uploadService } from '@/services/upload.service';
import { routes } from '@/config/routes';
import { SOURCE_META, fullName, initials, contactToForm } from './contact-form';

// ── compact ₦ formatter (mirrors the vendor smart buttons) ────────────────────
const money = (n: number) =>
  n >= 1_000_000
    ? `₦${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `₦${(n / 1_000).toFixed(0)}k`
      : `₦${Math.round(n)}`;
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15 disabled:bg-gray-50 disabled:text-gray-400';
const LABEL_CLS =
  'block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {children}
    </div>
  );
}

// ── Smart metric button (count + label, optional link) ────────────────────────
function SmartButton({
  icon,
  label,
  count,
  href,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  count?: string | number;
  href?: string;
  highlight?: boolean;
}) {
  const cls = [
    'relative flex flex-col items-center justify-center gap-0.5 min-w-[80px] px-4 py-2',
    'rounded-lg border cursor-pointer select-none transition-all duration-150',
    highlight
      ? 'border-[#b20202]/30 bg-[#b20202]/8 text-[#b20202] hover:bg-[#b20202]/12'
      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700',
  ].join(' ');

  const inner = (
    <>
      <span className="flex items-center gap-1.5 leading-none">
        <span
          className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${highlight ? '' : 'opacity-40'}`}
        >
          {icon}
        </span>
        <span
          className={`text-base font-black tabular-nums ${highlight ? 'text-[#b20202]' : 'text-gray-700'}`}
        >
          {count ?? 0}
        </span>
      </span>
      <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400">
        {label}
      </span>
    </>
  );

  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return <div className={cls}>{inner}</div>;
}

type DetailTab = 'notes' | 'meta';

export default function ContactDetail({ contactKey }: { contactKey: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [contact, setContact] = useState<Contact | null>(null);
  const [all, setAll] = useState<Contact[]>([]);
  const [form, setForm] = useState<ContactInput | null>(null);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('notes');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isDirty = !!form && JSON.stringify(form) !== baseline;

  // Ecommerce customers are storefront-owned: only status is editable here.
  const locked = contact?.source === 'ecommerce';

  const set = useCallback((key: keyof ContactInput, value: string | number) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const [one, list] = await Promise.all([
        contactService.getContact(contactKey, token),
        contactService.getContacts(token).catch(() => null),
      ]);
      const c = one.data.contact;
      const f = contactToForm(c);
      setContact(c);
      setForm(f);
      setBaseline(JSON.stringify(f));
      if (list) setAll(list.data?.contacts ?? []);
    } catch (e) {
      setNotFound(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactKey, token, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // ── record navigation across the directory ──
  const currentIndex = all.findIndex((c) => c.key === contactKey);
  const prev = currentIndex > 0 ? all[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < all.length - 1
      ? all[currentIndex + 1]
      : null;

  const go = (target: Contact | null) => {
    if (!target) return;
    if (isDirty && !confirm('Discard unsaved changes?')) return;
    router.push(routes.contacts.detail(target.key));
  };

  const handleSave = async () => {
    if (!contact || !form) return;
    if (!locked && !form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<ContactInput> = locked
        ? { status: form.status }
        : {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            notes: form.notes,
            loyaltyPoints: form.loyaltyPoints,
            totalSpent: form.totalSpent,
            totalOrders: form.totalOrders,
          };
      const res = await contactService.updateContact(
        contact.key,
        payload,
        token
      );
      const updated = res.data.contact;
      const f = contactToForm(updated);
      setContact(updated);
      setForm(f);
      setBaseline(JSON.stringify(f));
      toast.success('Contact saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (contact) setForm(contactToForm(contact));
  };

  // Upload + persist the customer photo immediately (in-store contacts only —
  // ecommerce avatars are owned by the storefront).
  const handlePhotoUpload = async (file?: File) => {
    if (!file || !contact) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploadingPhoto(true);
    try {
      const up = await uploadService.uploadImage(file, token, 'contact-avatars');
      const res = await contactService.updateContact(
        contact.key,
        { avatar: { url: up.data.url, publicId: up.data.publicId } },
        token
      );
      const updated = res.data.contact;
      const f = contactToForm(updated);
      setContact(updated);
      setForm(f);
      setBaseline(JSON.stringify(f));
      toast.success('Photo updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    const label =
      contact.source === 'ecommerce'
        ? `Remove ${fullName(contact)} from the directory? Their online account will be archived.`
        : `Permanently delete "${fullName(contact)}"? This cannot be undone.`;
    if (!confirm(label)) return;
    try {
      await contactService.removeContact(contact.key, token);
      toast.success('Contact removed');
      router.push(routes.contacts.list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PiSpinnerGap className="animate-spin text-4xl text-[#b20202]" />
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !contact || !form) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
        <PiUsersThree className="text-5xl" />
        <p>Contact not found</p>
        <Link
          href={routes.contacts.list}
          className="text-sm text-[#b20202] hover:underline"
        >
          Back to contacts
        </Link>
      </div>
    );
  }

  const sourceMeta = SOURCE_META[contact.source];
  const created = contact.createdAt
    ? new Date(contact.createdAt).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="min-h-screen w-full bg-white">
      <div>
        {/* ── Action Bar ── */}
        <div className="flex flex-wrap items-stretch border-b border-gray-200 bg-white">
          {/* ① New + Breadcrumb + Gear */}
          <div className="flex shrink-0 items-center gap-3 border-r border-gray-100 px-4 py-2">
            <Link
              href={routes.contacts.list}
              className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 active:scale-95"
            >
              <PiPlus className="h-3 w-3" />
              New
            </Link>

            <div className="flex items-center gap-1.5">
              <Link
                href={routes.contacts.list}
                className="text-xs font-medium text-[#b20202] transition-colors hover:text-[#7a0000]"
              >
                Contacts
              </Link>
              <svg
                viewBox="0 0 5 9"
                className="h-2.5 w-1.5 shrink-0 text-gray-300"
                fill="none"
              >
                <path
                  d="M1 1l3 3.5L1 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="max-w-[160px] truncate text-xs font-semibold text-gray-800">
                {fullName(contact)}
              </span>
              {contact.status !== 'active' && (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                  {contact.status}
                </span>
              )}
            </div>

            {/* Gear dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGearOpen((o) => !o)}
                className={`flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors ${gearOpen ? 'bg-gray-100 text-gray-600' : 'hover:bg-gray-100 hover:text-gray-600'}`}
              >
                <PiGear className="h-3.5 w-3.5" />
              </button>
              {gearOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setGearOpen(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-black/10">
                    <div className="border-b border-gray-100 px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                        Actions
                      </p>
                    </div>
                    <div className="p-1">
                      {/* Status toggle — only ecommerce customers carry a status */}
                      {locked && (
                        <button
                          type="button"
                          onClick={() => {
                            set(
                              'status',
                              form.status === 'active' ? 'inactive' : 'active'
                            );
                            setGearOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          {form.status === 'active' ? (
                            <PiProhibit className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          ) : (
                            <PiCheck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )}
                          {form.status === 'active'
                            ? 'Mark Inactive'
                            : 'Mark Active'}
                        </button>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          onClick={() => setGearOpen(false)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          <PiEnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          Send Email
                        </a>
                      )}
                      <div className="my-1 h-px bg-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setGearOpen(false);
                          handleDelete();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-red-600 transition-colors hover:bg-red-50"
                      >
                        <PiTrash className="h-3.5 w-3.5 shrink-0" />
                        Delete Contact
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ② Smart Metric Buttons */}
          <div className="flex flex-1 items-center py-2">
            <div className="flex flex-1 items-center gap-1 overflow-x-auto px-3">
              <SmartButton
                icon={<PiShoppingBag />}
                label="Orders"
                count={contact.totalOrders}
                href={`${routes.contacts.detail(contact.key)}/orders`}
                highlight={contact.totalOrders > 0}
              />
              <SmartButton
                icon={<PiCoins />}
                label="Spent"
                count={
                  contact.totalSpent > 0 ? money(contact.totalSpent) : '₦0'
                }
                highlight={contact.totalSpent > 0}
              />
              <SmartButton
                icon={<PiCoins />}
                label="Loyalty"
                count={contact.loyaltyPoints}
                highlight={contact.loyaltyPoints > 0}
              />
              <SmartButton
                icon={sourceMeta.icon}
                label="Source"
                count={sourceMeta.label}
                highlight
              />
            </div>
          </div>

          {/* ③ Save / Discard */}
          {isDirty && (
            <div className="flex shrink-0 items-center gap-1.5 border-l border-gray-100 px-3 py-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
              >
                <PiX className="h-3 w-3" />
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-[#b20202] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#950202] active:scale-95 disabled:opacity-60"
              >
                {saving ? (
                  <PiSpinnerGap className="h-3 w-3 animate-spin" />
                ) : (
                  <PiFloppyDisk className="h-3 w-3" />
                )}
                Save
              </button>
            </div>
          )}

          {/* ④ Record navigation */}
          <div className="flex shrink-0 items-center gap-0 border-l border-gray-100 px-3 py-2">
            <button
              type="button"
              onClick={() => go(prev)}
              disabled={!prev}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <PiArrowLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-gray-500">
              {currentIndex >= 0 ? currentIndex + 1 : '—'} / {all.length || '—'}
            </span>
            <button
              type="button"
              onClick={() => go(next)}
              disabled={!next}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <PiArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Identity Hero ── */}
        <div className="relative overflow-hidden border-b border-gray-800/60 bg-gradient-to-br from-[#0f0f0f] via-[#1a0606] to-[#111111] px-6 py-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="pointer-events-none absolute left-0 top-0 h-full w-[40%] bg-gradient-to-r from-[#b20202]/10 to-transparent" />

          {/* Source pill — read-only (source isn't an editable property) */}
          <div className="bg-white/8 mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">
            <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
              {sourceMeta.icon}
            </span>
            {sourceMeta.label === 'In both'
              ? 'In-store + Online'
              : `${sourceMeta.label} customer`}
          </div>

          <div className="flex items-center gap-5">
            {/* Avatar + status dot (click to upload for in-store contacts) */}
            <div
              className={`group relative shrink-0 ${locked ? '' : 'cursor-pointer'}`}
              onClick={() => !locked && photoInputRef.current?.click()}
              title={locked ? undefined : 'Click to upload photo'}
            >
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#b20202] to-[#6b0101] text-2xl font-black text-white shadow-2xl shadow-[#b20202]/40 ring-2 ring-white/10">
                {form.avatar?.url || contact.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.avatar?.url || contact.avatar}
                    alt={fullName(contact)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(contact)
                )}
              </div>
              {!locked && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {uploadingPhoto ? (
                      <PiSpinnerGap className="animate-spin text-xl text-white" />
                    ) : (
                      <PiCamera className="text-xl text-white" />
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handlePhotoUpload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </>
              )}
              <span
                className={`absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#111111] text-[9px] font-bold shadow-sm ${
                  contact.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'
                } text-white`}
              >
                {contact.status === 'active' ? '✓' : '—'}
              </span>
            </div>

            {/* Name + badges */}
            <div className="min-w-0 flex-1">
              {locked ? (
                <h1 className="text-2xl font-bold text-white">
                  {fullName(contact)}
                </h1>
              ) : (
                <input
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder="First name"
                  className="w-full border-0 border-b-2 border-white/15 bg-transparent pb-1 text-2xl font-bold text-white placeholder-white/25 focus:border-[#b20202] focus:outline-none"
                />
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    contact.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-white/10 text-white/40 ring-1 ring-white/10'
                  }`}
                >
                  {contact.status === 'active'
                    ? '● Active'
                    : `○ ${contact.status}`}
                </span>

                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/70 ring-1 ring-white/10 transition-colors hover:text-white"
                  >
                    <PiEnvelopeSimple className="text-xs" />
                    {contact.email}
                  </a>
                )}

                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/70 ring-1 ring-white/10 transition-colors hover:text-white"
                  >
                    <PiPhone className="text-xs" />
                    {contact.phone}
                  </a>
                )}

                {contact.loyaltyPoints > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/20">
                    <PiCoins className="text-xs" />
                    {contact.loyaltyPoints.toLocaleString('en-NG')} pts
                  </span>
                )}
              </div>
            </div>

            {/* Quick stat cards */}
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <div className="bg-white/8 rounded-xl border border-white/10 px-5 py-3.5 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-[#e85555]">
                  {contact.totalOrders}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Orders
                </p>
              </div>
              <div className="bg-white/8 rounded-xl border border-white/10 px-5 py-3.5 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-white">
                  {contact.totalSpent > 0 ? money(contact.totalSpent) : '—'}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Spend
                </p>
              </div>
              <div className="bg-white/8 rounded-xl border border-white/10 px-5 py-3.5 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-white">
                  {contact.loyaltyPoints}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Points
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Online-store notice */}
        {locked && (
          <div className="border-b border-sky-100 bg-sky-50 px-6 py-2.5 text-xs text-sky-700">
            This is an online-store customer. Their profile is managed from the
            storefront — you can change their status here.
          </div>
        )}

        {/* ── Two-column: Identity + Loyalty ── */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Identity & reach */}
          <div className="border-b border-gray-100 px-6 py-6 md:border-b-0 md:border-r">
            <h3 className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <PiUser className="text-[#b20202]" /> Identity
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="First name">
                  <input
                    value={form.firstName}
                    disabled={locked}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="Ada"
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    value={form.lastName ?? ''}
                    disabled={locked}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Obi"
                    className={INPUT_CLS}
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email ?? ''}
                  disabled={locked}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="ada@example.com"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone ?? ''}
                  disabled={locked}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+234…"
                  className={INPUT_CLS}
                />
              </Field>
            </div>
          </div>

          {/* Right: Loyalty & spend / status */}
          <div className="px-6 py-6">
            <h3 className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <PiCoins className="text-[#b20202]" /> Loyalty &amp; Spend
            </h3>
            {locked ? (
              <div className="space-y-3">
                <Field label="Status">
                  <select
                    value={form.status ?? 'active'}
                    onChange={(e) =>
                      set('status', e.target.value as ContactStatus)
                    }
                    className={INPUT_CLS}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </Field>
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">
                  Loyalty and spend are tracked for in-store customers only.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Loyalty points">
                    <input
                      type="number"
                      min={0}
                      value={form.loyaltyPoints ?? 0}
                      onChange={(e) =>
                        set(
                          'loyaltyPoints',
                          e.target.value === '' ? 0 : Number(e.target.value)
                        )
                      }
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Total orders">
                    <input
                      type="number"
                      min={0}
                      value={form.totalOrders ?? 0}
                      onChange={(e) =>
                        set(
                          'totalOrders',
                          e.target.value === '' ? 0 : Number(e.target.value)
                        )
                      }
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
                <Field label="Total spent (₦)">
                  <input
                    type="number"
                    min={0}
                    value={form.totalSpent ?? 0}
                    onChange={(e) =>
                      set(
                        'totalSpent',
                        e.target.value === '' ? 0 : Number(e.target.value)
                      )
                    }
                    className={INPUT_CLS}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-t border-gray-100">
          <div className="flex gap-1 border-b border-gray-100 bg-gray-50/50 px-4">
            {(
              [
                { id: 'notes', label: 'Notes', icon: <PiNotePencil /> },
                {
                  id: 'meta',
                  label: 'Details',
                  icon: <PiIdentificationCard />,
                },
              ] as { id: DetailTab; label: string; icon: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3.5 py-3 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'border-[#b20202] text-[#b20202]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <span
                  className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5">
            {/* Notes */}
            {activeTab === 'notes' && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-700">
                  Internal Notes
                </h3>
                <p className="mb-4 text-xs text-gray-400">
                  Preferences, allergies, anything worth remembering about this
                  contact.
                </p>
                {locked ? (
                  <p className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                    Notes are available for in-store contacts only.
                  </p>
                ) : (
                  <textarea
                    rows={6}
                    value={form.notes ?? ''}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Add a note…"
                    className={`${INPUT_CLS} resize-y`}
                  />
                )}
              </div>
            )}

            {/* Details / meta */}
            {activeTab === 'meta' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <PiUsersThree className="text-[#b20202]" /> Source
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">
                    {contact.source === 'both'
                      ? 'In-store + Online'
                      : sourceMeta.label}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <PiClock className="text-[#b20202]" /> First seen
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">
                    {created}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <PiCoins className="text-[#b20202]" /> Lifetime spend
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">
                    {contact.totalSpent > 0 ? naira(contact.totalSpent) : '—'}
                  </p>
                </div>
                {contact.ids.instore && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      <PiStorefront className="text-amber-600" /> In-store ID
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-gray-600">
                      {contact.ids.instore}
                    </p>
                  </div>
                )}
                {contact.ids.ecommerce && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      <PiGlobeSimple className="text-sky-600" /> Online ID
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-gray-600">
                      {contact.ids.ecommerce}
                    </p>
                  </div>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5"
                  >
                    <span>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        <PiEnvelopeSimple className="text-[#b20202]" /> Email
                      </span>
                      <span className="mt-2 block truncate text-sm font-semibold text-[#b20202]">
                        {contact.email}
                      </span>
                    </span>
                    <PiArrowSquareOut className="shrink-0 text-gray-300" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
