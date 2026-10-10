// app/shared/accounting/report-status.ts
//
// Verdict logic for the reports page, kept out of the widgets so it can be
// unit-tested without rendering.
import type { AccountType } from '@/services/accounting.service';

/**
 * Parse a filter value for display.
 *
 * A bare `YYYY-MM-DD` from `<input type="date">` is a *calendar day chosen by a
 * person*, but `new Date('2026-08-01')` is midnight UTC. Rendering that in
 * local time shows 31 Jul in every timezone west of Greenwich, so a filter of
 * "1 Aug – 1 Aug" was captioned "31 Jul – 1 Aug". Constructing the date in local
 * time keeps the caption on the day the user picked.
 *
 * A value carrying a time is a real instant and is left alone — nudging one
 * would move it by a day.
 */
export function asLocalDate(iso?: string): Date | null {
  if (!iso) return null;
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (bare) {
    const [, y, m, d] = bare;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type StatusTone = 'good' | 'bad' | 'neutral';

/** Credit-nature accounts grow when credited; debit-nature when debited. */
const CREDIT_NATURE: ReadonlySet<string> = new Set(['liability', 'equity', 'income']);

/**
 * Whether a period's debit/credit flow moved an account's balance up or down.
 *
 * A debit is only an *increase* for an asset or expense. The general-ledger
 * widget compared debits to credits directly, so paying down Output VAT
 * (debit 2100) was reported as a ₦100 rise with an up-arrow while the balance
 * actually fell — wrong for every liability, equity and income account, i.e.
 * half the chart of accounts.
 *
 * `delta` is signed in the direction the balance actually moved, so callers
 * show `Math.abs(delta)` alongside the arrow.
 */
export function netMovementDirection(
  totals: { debits: number; credits: number },
  type?: AccountType | string
): { delta: number; rising: boolean } {
  const creditNature = type != null && CREDIT_NATURE.has(String(type));
  const net = (Number(totals.debits) || 0) - (Number(totals.credits) || 0);
  const delta = Math.round((creditNature ? -net : net) * 100) / 100;
  return { delta, rising: delta > 0 };
}

/**
 * Trial-balance verdict.
 *
 * An empty period agrees with itself, but reporting that as "Balanced" hides
 * that nothing happened, and reporting it as "Out of balance" sent the user off
 * to run a journal backfill against a healthy ledger. The server therefore
 * sends `isEmpty` alongside `balanced`.
 */
export function trialBalanceStatus(data: {
  isEmpty?: boolean;
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
}): { tone: StatusTone; label: string; detail: string } {
  if (data.isEmpty) {
    return {
      tone: 'neutral',
      label: 'No activity',
      detail: 'nothing was posted in this period',
    };
  }
  if (data.balanced) {
    return {
      tone: 'good',
      label: 'Balanced',
      detail: 'debits equal credits',
    };
  }
  return {
    tone: 'bad',
    label: 'Out of balance',
    detail: 'run the journal backfill or check for drafts',
  };
}

/**
 * Balance-sheet verdict, driven by the computed gap rather than the server's
 * `balanced` flag alone.
 *
 * `buildBalanceSheet` marks a sheet unbalanced when `assets.total < 0` as well
 * as when A ≠ L + E. A tenant whose asset side is a net credit therefore
 * arrived with `balanced: false` and a gap of exactly ₦0, and the KPI rendered
 * that ₦0.00 in red above "post opening balances to close the gap" — advice for
 * a problem that did not exist. The gap is what the user is being asked to
 * reconcile, so the gap decides the tone.
 */
export function balanceSheetStatus(data: {
  balanced: boolean;
  assets: number;
  liabilities: number;
  equity: number;
}): { tone: StatusTone; label: string; detail: string; gap: number } {
  const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const gap = round(data.assets - round(data.liabilities + data.equity));
  if (Math.abs(gap) <= 0.01) {
    return {
      tone: 'good',
      label: 'Balanced',
      detail: data.assets < 0 ? 'assets less than zero — review entries' : 'assets equal liabilities + equity',
      gap: 0,
    };
  }
  return {
    tone: 'bad',
    label: 'Out of balance',
    detail: 'assets do not equal liabilities + equity',
    gap,
  };
}
