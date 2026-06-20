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
  PiStorefront,
  PiGlobeSimple,
  PiMagnifyingGlass,
  PiX,
  PiEnvelopeSimple,
  PiPhone,
  PiWarningCircle,
  PiCoins,
} from 'react-icons/pi';
import {
  contactService,
  type Contact,
  type ContactInput,
  type ContactSource,
  type ContactStatus,
  type ContactStats,
} from '@/services/contact.service';
import { routes } from '@/config/routes';
import { fraunces } from './contacts-fonts';
import ContactForm, {
  EMPTY_FORM,
  Avatar,
  SourceBadge,
  StatusBadge,
  fullName,
} from './contact-form';

const naira = (n: number) =>
  `₦${Math.round(n).toLocaleString('en-NG')}`;

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

// ── Create drawer (quick "New contact") ───────────────────────────────────────
//
// Edits live on the dedicated /contacts/[id] page; the drawer is kept for fast
// creation of an in-store contact only. It reuses the same ContactForm.

function ContactDrawer({
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  form: ContactInput;
  setForm: (f: ContactInput) => void;
  saving: boolean;
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
              New contact
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
          <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            New contacts are saved as in-store customers. Online-store customers
            are created when shoppers sign up.
          </p>
          <ContactForm form={form} setForm={setForm} editing={null} />
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
            {saving ? 'Saving…' : 'Create contact'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContactsList() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [items, setItems] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'' | ContactSource>('');
  const [statusFilter, setStatusFilter] = useState<'' | ContactStatus>('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContactInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await contactService.getContacts(token);
      setItems(res.data?.contacts ?? []);
      setStats(res.data?.stats ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load contacts');
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

  const openDetail = (c: Contact) =>
    router.push(routes.contacts.detail(c.key));

  const save = async () => {
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (
      form.email &&
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      toast.error('Email is not valid');
      return;
    }
    setSaving(true);
    try {
      await contactService.createContact(form, token);
      toast.success('Contact created');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Contact) => {
    const label =
      c.source === 'ecommerce'
        ? `Remove ${fullName(c)} from the directory? Their online account will be archived.`
        : `Remove ${fullName(c)}? This in-store contact will be permanently deleted.`;
    if (!confirm(label)) return;
    try {
      await contactService.removeContact(c.key, token);
      toast.success('Contact removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  // ── client-side search + filter ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        fullName(c).toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, sourceFilter, statusFilter]);

  const total = stats?.total ?? items.length;

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
                Contacts
              </h1>
              <p className="mt-0.5 text-sm text-red-200">
                Every customer — in-store &amp; online — in one directory
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
              New contact
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 pb-10 pt-6 md:px-10 lg:px-14">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Contacts"
            value={String(total)}
            sub={`${stats?.both ?? 0} in both stores`}
            icon={<PiUsersThree className="h-5 w-5" />}
            accent
          />
          <StatCard
            label="In-store"
            value={String(stats?.instore ?? 0)}
            sub="POS customers"
            icon={<PiStorefront className="h-5 w-5" />}
          />
          <StatCard
            label="Online"
            value={String(stats?.ecommerce ?? 0)}
            sub="Storefront shoppers"
            icon={<PiGlobeSimple className="h-5 w-5" />}
          />
          <StatCard
            label="Total Spent"
            value={naira(stats?.totalSpent ?? 0)}
            sub={`${(stats?.loyaltyPoints ?? 0).toLocaleString('en-NG')} loyalty pts`}
            icon={<PiCoins className="h-5 w-5" />}
          />
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {filtered.length} of {total}{' '}
            {total === 1 ? 'contact' : 'contacts'}
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
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as '' | ContactSource)
              }
              className={selectCls}
            >
              <option value="">All sources</option>
              <option value="instore">In-store</option>
              <option value="ecommerce">Online</option>
              <option value="both">In both</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as '' | ContactStatus)
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
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Reach</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Loyalty</th>
                  <th className="px-5 py-3 text-right">Spent</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                          <PiWarningCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-700">
                          {total === 0 ? 'No contacts yet' : 'No matches'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {total === 0
                            ? 'Add your first in-store contact to get started.'
                            : 'Try a different search or filter.'}
                        </p>
                        {total === 0 && (
                          <button
                            type="button"
                            onClick={openCreate}
                            className="mt-4 flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
                          >
                            <PiPlus className="h-4 w-4" /> New contact
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, i) => (
                    <motion.tr
                      key={c.key}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.3) }}
                      onClick={() => openDetail(c)}
                      className="group cursor-pointer transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar c={c} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {fullName(c)}
                            </p>
                            {c.notes && (
                              <p className="truncate text-xs text-gray-400">
                                {c.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.email ? (
                          <p className="flex items-center gap-1.5 text-sm text-gray-600">
                            <PiEnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{c.email}</span>
                          </p>
                        ) : (
                          <span className="text-xs text-gray-300">
                            No email
                          </span>
                        )}
                        {c.phone && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                            <PiPhone className="h-3.5 w-3.5 shrink-0" />
                            {c.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <SourceBadge source={c.source} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {c.loyaltyPoints > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-gray-700">
                            <PiCoins className="h-3.5 w-3.5 text-amber-500" />
                            {c.loyaltyPoints.toLocaleString('en-NG')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {c.totalSpent > 0 ? (
                          <span className="text-sm font-semibold tabular-nums text-gray-700">
                            {naira(c.totalSpent)}
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
                              openDetail(c);
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
                              remove(c);
                            }}
                            title="Remove"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
          <ContactDrawer
            form={form}
            setForm={setForm}
            saving={saving}
            onClose={() => setShowForm(false)}
            onSave={save}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
