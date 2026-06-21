'use client';

import Image from 'next/image';
import {
  PiStorefront,
  PiGlobeSimple,
  PiUsersThree,
  PiCheckCircle,
  PiProhibit,
  PiPauseCircle,
} from 'react-icons/pi';
import {
  type Contact,
  type ContactInput,
  type ContactSource,
  type ContactStatus,
} from '@/services/contact.service';

// ── metadata (shared by the list, the drawer and the detail page) ─────────────

export const SOURCE_META: Record<
  ContactSource,
  { label: string; bg: string; icon: React.ReactNode; color: string }
> = {
  instore: {
    label: 'In-store',
    bg: 'bg-amber-50 text-amber-700',
    color: '#b45309',
    icon: <PiStorefront weight="fill" className="h-3.5 w-3.5" />,
  },
  ecommerce: {
    label: 'Online',
    bg: 'bg-sky-50 text-sky-700',
    color: '#0369a1',
    icon: <PiGlobeSimple weight="fill" className="h-3.5 w-3.5" />,
  },
  both: {
    label: 'In both',
    bg: 'bg-[#b20202]/10 text-[#b20202]',
    color: '#b20202',
    icon: <PiUsersThree weight="fill" className="h-3.5 w-3.5" />,
  },
};

export const STATUS_META: Record<
  ContactStatus,
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

export const EMPTY_FORM: ContactInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  notes: '',
  loyaltyPoints: 0,
  totalSpent: 0,
  totalOrders: 0,
  avatar: null,
  status: 'active',
};

// Anchored side-nav sections for the full-page editor (order = render order).
export const CONTACT_FORM_SECTIONS: { id: string; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'loyalty', label: 'Loyalty & Spend' },
  { id: 'notes', label: 'Notes' },
];

// ── name helpers ──────────────────────────────────────────────────────────────

export function fullName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '—';
}

export function initials(c: Contact): string {
  const a = c.firstName?.[0] ?? '';
  const b = c.lastName?.[0] ?? '';
  return (a + b).toUpperCase() || c.email?.[0]?.toUpperCase() || '?';
}

/** Normalise an API Contact into the editable ContactInput shape. */
export function contactToForm(c: Contact): ContactInput {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    loyaltyPoints: c.loyaltyPoints,
    totalSpent: c.totalSpent,
    totalOrders: c.totalOrders,
    avatar: c.avatar ? { url: c.avatar } : null,
    status: c.status,
  };
}

// ── Avatar + badges ─────────────────────────────────────────────────────────

export function Avatar({ c, size = 40 }: { c: Contact; size?: number }) {
  if (c.avatar) {
    return (
      <Image
        src={c.avatar}
        alt={fullName(c)}
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
        background: SOURCE_META[c.source]?.color ?? '#9ca3af',
        height: size,
        width: size,
        fontSize: Math.round(size * 0.3),
      }}
    >
      {initials(c)}
    </div>
  );
}

export function SourceBadge({ source }: { source: ContactSource }) {
  const m = SOURCE_META[source];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.bg}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ContactStatus }) {
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

const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

// ── The shared contact form ────────────────────────────────────────────────────
//
// One source of truth shared by the "New contact" drawer and the
// /contacts/[id] page. In-store contacts are fully editable; ecommerce contacts
// are storefront-owned, so every field except `status` is read-only here.

export default function ContactForm({
  form,
  setForm,
  /** The contact being edited, or null when creating (always in-store). */
  editing,
}: {
  form: ContactInput;
  setForm: (f: ContactInput) => void;
  editing: Contact | null;
}) {
  // Ecommerce customers come from storefront signup; only status is editable.
  const ecommerceLocked = editing?.source === 'ecommerce';

  return (
    <div className="space-y-6">
      {/* Identity */}
      <section id="details" className="scroll-mt-28">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Details
        </p>

        {ecommerceLocked && (
          <p className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            This is an online-store customer. Their profile is managed from the
            storefront — you can change their status here.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">
            First name
            <input
              disabled={ecommerceLocked}
              className={`mt-1.5 ${FIELD} ${ecommerceLocked ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Ada"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Last name
            <input
              disabled={ecommerceLocked}
              className={`mt-1.5 ${FIELD} ${ecommerceLocked ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              value={form.lastName ?? ''}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Obi"
            />
          </label>
          <label className="col-span-2 text-sm font-medium text-gray-700">
            Email <span className="font-normal text-gray-400">(optional)</span>
            <input
              type="email"
              disabled={ecommerceLocked}
              className={`mt-1.5 ${FIELD} ${ecommerceLocked ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ada@example.com"
            />
          </label>
          <label className="col-span-2 text-sm font-medium text-gray-700">
            Phone <span className="font-normal text-gray-400">(optional)</span>
            <input
              type="tel"
              disabled={ecommerceLocked}
              className={`mt-1.5 ${FIELD} ${ecommerceLocked ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+234…"
            />
          </label>

          {/* Status — only meaningful (and editable) for an ecommerce customer. */}
          {editing && editing.source !== 'instore' && (
            <label className="col-span-2 text-sm font-medium text-gray-700">
              Status
              <select
                className={`mt-1.5 ${FIELD}`}
                value={form.status ?? 'active'}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ContactStatus })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          )}
        </div>
      </section>

      {/* Loyalty & spend (in-store tracked) */}
      <section
        id="loyalty"
        className="scroll-mt-28 border-t border-gray-100 pt-5"
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Loyalty &amp; Spend
        </p>
        {ecommerceLocked ? (
          <p className="text-sm text-gray-400">
            Loyalty and spend are tracked for in-store customers only.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-medium text-gray-700">
              Loyalty points
              <input
                type="number"
                min={0}
                className={`mt-1.5 ${FIELD}`}
                value={form.loyaltyPoints ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    loyaltyPoints:
                      e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Total orders
              <input
                type="number"
                min={0}
                className={`mt-1.5 ${FIELD}`}
                value={form.totalOrders ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    totalOrders:
                      e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="col-span-2 text-sm font-medium text-gray-700">
              Total spent (₦)
              <input
                type="number"
                min={0}
                className={`mt-1.5 ${FIELD}`}
                value={form.totalSpent ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    totalSpent:
                      e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        )}
      </section>

      {/* Notes */}
      <section
        id="notes"
        className="scroll-mt-28 border-t border-gray-100 pt-5"
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Notes
        </p>
        {ecommerceLocked ? (
          <p className="text-sm text-gray-400">
            Notes are available for in-store contacts only.
          </p>
        ) : (
          <textarea
            rows={4}
            className={`${FIELD} resize-y`}
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Preferences, allergies, anything worth remembering…"
          />
        )}
      </section>
    </div>
  );
}
