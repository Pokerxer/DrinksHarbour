import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Info,
  Lock,
} from 'lucide-react';

/**
 * Venue workspace control kit.
 *
 * Mirrors the admin market-foundation control style (44px targets, visible
 * focus rings, disabled opacity + cursor, theme-aware notices). Keep the
 * class strings aligned with
 * `client/apps/admin/src/app/shared/market-foundation/workspace.tsx`.
 * Pure module: no 'use client' — constants are safe to import from server
 * components and client components alike.
 */

export const fieldClass =
  'mt-1 min-h-11 w-full rounded-lg border border-muted bg-transparent px-3 py-2 text-sm text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-gray-100 dark:placeholder:text-gray-500';

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-muted bg-transparent px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-gray-100 dark:hover:bg-gray-800';

export const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white';

export const dangerButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-transparent px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40';

export const iconActionClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export const panelClass =
  'rounded-xl border border-muted bg-white p-4 shadow-sm dark:bg-gray-900 dark:border-gray-700 sm:p-5';

export const hintClass =
  'mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400';

export const moneyClass = 'tabular-nums';

type ChipTone = 'ready' | 'pending' | 'danger' | 'info' | 'locked';

const chipTones: Record<ChipTone, string> = {
  ready:
    'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200',
  pending:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  danger:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  info: 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
  locked:
    'border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const chipIcons: Record<ChipTone, typeof CheckCircle2> = {
  ready: CheckCircle2,
  pending: Clock3,
  danger: AlertCircle,
  info: Info,
  locked: Lock,
};

/**
 * Status chip. Never relies on color alone: every chip carries a visible
 * text label plus an icon.
 */
export function Chip({
  tone,
  label,
  className = '',
}: {
  tone: ChipTone;
  label: string;
  className?: string;
}) {
  const Icon = chipIcons[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${chipTones[tone]} ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      {label}
    </span>
  );
}

type NoticeTone = 'error' | 'success' | 'info';

const noticeTones: Record<NoticeTone, string> = {
  error:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/25 dark:text-red-200',
  success:
    'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/25 dark:text-green-200',
  info: 'border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
};

const noticeIcons: Record<NoticeTone, typeof Info> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export function Notice({
  tone,
  role,
  children,
  action,
}: {
  tone: NoticeTone;
  /** 'alert' for errors, 'status' for progress/confirmations */
  role?: 'status' | 'alert';
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = noticeIcons[tone];
  return (
    <div
      role={role}
      className={`flex flex-wrap items-start gap-3 rounded-lg border p-4 text-sm ${noticeTones[tone]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-[12rem] flex-1 leading-6">{children}</span>
      {action && <span className="flex items-center">{action}</span>}
    </div>
  );
}

/** Empty-state panel: message plus an explicit recovery action. */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <Info
        aria-hidden="true"
        className="size-5 text-gray-400 dark:text-gray-500"
      />
      <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      {action && <div className="flex items-center">{action}</div>}
    </div>
  );
}

/** Unsaved-changes dot used by editors with async saves. */
export function UnsavedHint({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-amber-500 dark:bg-amber-400"
      />
      Unsaved changes — save before leaving this tool.
    </p>
  );
}
