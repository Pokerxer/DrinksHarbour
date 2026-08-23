// Shared chrome for the /sales/[id] detail pages.
//
// The order and quotation details used to carry ~150 duplicated lines each —
// breadcrumb, header card and the dark action sidebar — which had already
// drifted (one disabled its buttons while busy, the other did not). This shell
// is that chrome once, with slots for what genuinely differs: the total,
// payment subline, lifecycle banners, and the action list.
//
// Layout stacks below lg; a fixed-width sidebar used to squeeze the document
// on tablet/mobile widths.

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDate } from './sales-helpers';

export interface DetailAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'ghost' | 'quiet-danger';
  disabled?: boolean;
}

export interface StatusPill {
  label: string;
  bg: string;
  color: string;
  dot: string;
}

const ACTION_CLASS: Record<NonNullable<DetailAction['variant']>, string> = {
  primary:
    'bg-brand text-white font-bold hover:bg-brand-dark active:scale-[0.98]',
  ghost:
    'bg-white/[0.06] font-medium text-white/80 ring-1 ring-white/10 hover:bg-white/10 hover:text-white',
  'quiet-danger':
    'bg-white/[0.06] font-medium text-white/50 ring-1 ring-white/10 hover:bg-red-900/30 hover:text-red-400',
};

function ActionButton({ action }: { action: DetailAction }) {
  const cls = `flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_CLASS[action.variant ?? 'ghost']}`;
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={cls}>
        {action.icon} {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cls}
    >
      {action.icon} {action.label}
    </button>
  );
}

function CustomerBlock({
  name,
  phone,
  email,
}: {
  name: string;
  phone?: string;
  email?: string;
}) {
  return (
    <div className="border-t border-white/[0.08] p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
        Customer
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          {phone && <p className="mt-0.5 text-xs text-white/40">{phone}</p>}
          {email && (
            <a
              href={`mailto:${email}`}
              className="mt-0.5 block text-xs text-brand transition-colors hover:text-[#e03030]"
            >
              Send message
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SalesDetailShell({
  backHref,
  backLabel,
  eyebrow,
  soNumber,
  createdAt,
  statusPill,
  total,
  totalSubline,
  banner,
  actions = [],
  customer,
  children,
}: {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  soNumber: string;
  createdAt?: string;
  statusPill: StatusPill;
  /** Preformatted grand total — currency handling stays with the caller. */
  total: string;
  /** Payment state under the total — money wording differs per doc type. */
  totalSubline?: ReactNode;
  /** Lifecycle warning strip inside the header card (expiry etc.). */
  banner?: ReactNode;
  actions?: DetailAction[];
  customer?: { name: string; phone?: string; email?: string };
  /** Primary-column content: info + lines + fulfillments. */
  children: ReactNode;
}) {
  const showActions = actions.length > 0 || !!totalSubline;
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-500 print:hidden">
        <Link href={backHref} className="transition-colors hover:text-gray-700">
          {backLabel}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-900">{soNumber}</span>
      </nav>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
                  {eyebrow}
                </p>
                <h1 className="truncate text-3xl font-extrabold tracking-tight text-gray-900">
                  {soNumber}
                </h1>
                <p className="mt-1 text-sm text-gray-400">{fmtDate(createdAt)}</p>
              </div>
              <span
                className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: statusPill.bg, color: statusPill.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: statusPill.dot }}
                />
                {statusPill.label}
              </span>
            </div>
            {banner && <div className="mt-4">{banner}</div>}
          </div>

          {children}
        </div>

        <aside className="sticky top-6 w-full shrink-0 self-start overflow-hidden rounded-2xl bg-[#0f0e13] print:hidden lg:w-[17rem]">
          <div className="p-6">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
              Total Amount
            </p>
            <p
              className="text-[2.25rem] font-bold leading-none text-white"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {total}
            </p>
            {totalSubline && (
              <div className="mt-2 text-xs">{totalSubline}</div>
            )}

            {showActions && (
              <>
                <div className="my-5 h-px bg-white/[0.08]" />
                <div className="space-y-2">
                  {actions.map((a) => (
                    <ActionButton key={a.key} action={a} />
                  ))}
                </div>
              </>
            )}
          </div>

          {customer && <CustomerBlock {...customer} />}

          <div className="border-t border-white/[0.06] px-6 py-3">
            <p className="font-mono text-[10px] text-white/20">{soNumber}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
