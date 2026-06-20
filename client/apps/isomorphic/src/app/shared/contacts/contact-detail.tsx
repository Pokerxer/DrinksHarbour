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
  PiCoins,
  PiArrowCounterClockwise,
} from 'react-icons/pi';
import {
  contactService,
  type Contact,
  type ContactInput,
} from '@/services/contact.service';
import { routes } from '@/config/routes';
import { fraunces } from './contacts-fonts';
import ContactForm, {
  CONTACT_FORM_SECTIONS,
  Avatar,
  SourceBadge,
  StatusBadge,
  fullName,
  contactToForm,
} from './contact-form';

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

export default function ContactDetail({ contactKey }: { contactKey: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [contact, setContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactInput | null>(null);
  // Snapshot of the last-saved form, used to detect unsaved changes.
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeSection, setActiveSection] = useState('details');

  const dirty = useMemo(
    () => !!form && JSON.stringify(form) !== baseline,
    [form, baseline]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await contactService.getContact(contactKey, token);
      const c = res.data.contact;
      const f = contactToForm(c);
      setContact(c);
      setForm(f);
      setBaseline(JSON.stringify(f));
    } catch (e) {
      setNotFound(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactKey, token]);

  useEffect(() => {
    load();
  }, [load]);

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
    const els = CONTACT_FORM_SECTIONS.map((s) =>
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
    if (!contact || !form) return;
    if (contact.source !== 'ecommerce' && !form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    setSaving(true);
    try {
      // Ecommerce customers are storefront-owned: only status is editable.
      const payload: Partial<ContactInput> =
        contact.source === 'ecommerce'
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
      toast.success('Contact updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!contact) return;
    const label =
      contact.source === 'ecommerce'
        ? `Remove ${fullName(contact)} from the directory? Their online account will be archived.`
        : `Remove ${fullName(contact)}? This in-store contact will be permanently deleted.`;
    if (!confirm(label)) return;
    setDeleting(true);
    try {
      await contactService.removeContact(contact.key, token);
      toast.success('Contact removed');
      router.push(routes.contacts.list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
      setDeleting(false);
    }
  };

  // Revert in-progress edits back to the last saved state.
  const reset = () => {
    if (!contact) return;
    setForm(contactToForm(contact));
  };

  // Navigate to the list, guarding against losing unsaved edits.
  const cancel = () => {
    if (dirty && !confirm('Discard unsaved changes and leave this page?'))
      return;
    router.push(routes.contacts.list);
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
  if (notFound || !contact || !form) {
    return (
      <main className="mx-auto w-full max-w-2xl px-3 py-16 text-center sm:px-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <PiWarningCircle className="h-8 w-8 text-gray-400" />
        </div>
        <h1 className="text-lg font-semibold text-gray-800">
          Contact not found
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          This contact may have been removed, or you don&apos;t have access.
        </p>
        <Link
          href={routes.contacts.list}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to contacts
        </Link>
      </main>
    );
  }

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
              href={routes.contacts.list}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-200 transition-colors hover:text-white"
            >
              <PiArrowLeft className="h-4 w-4" /> Contacts
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-full ring-2 ring-white/30">
              <Avatar c={contact} size={64} />
            </div>
            <div className="min-w-0">
              <h1
                className={`${fraunces.className} text-3xl font-semibold text-white`}
              >
                {fullName(contact)}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SourceBadge source={contact.source} />
                <StatusBadge status={contact.status} />
                {contact.loyaltyPoints > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <PiCoins className="h-3.5 w-3.5" />
                    {contact.loyaltyPoints.toLocaleString('en-NG')} pts
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-red-100">
                {contact.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <PiEnvelopeSimple className="h-3.5 w-3.5" />
                    {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <PiPhone className="h-3.5 w-3.5" />
                    {contact.phone}
                  </span>
                )}
                {contact.totalSpent > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <PiCoins className="h-3.5 w-3.5" />
                    {naira(contact.totalSpent)} spent
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
              {CONTACT_FORM_SECTIONS.map((s) => (
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
                  Edit contact
                </h2>
              </div>
              <ContactForm form={form} setForm={setForm} editing={contact} />
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
            disabled={deleting || saving}
            title="Remove contact"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  );
}
