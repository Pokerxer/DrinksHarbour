/**
 * Ledger design tokens — merchant-orders operator surfaces (Phase D2).
 *
 * Shared visual language for the dense financial/ops panels: a document
 * register (calm, precise, receipt-like), not a dashboard. The one bold
 * gesture is the figure/proof typography system: tabular figures,
 * right-aligned money columns, hairline row rules and muted mono
 * source-trace labels. Everything around it stays quiet.
 *
 * D1 (platform-ops) should consume these constants directly; nothing here
 * imports app code, so the file is platform-agnostic.
 *
 * Encoded defaults:
 * - Body copy is >=16px (`text-base`). Source-trace ids are metadata
 *   captions (mono 12px) — never displayed prominently: internal ids are
 *   evidence, not content.
 * - Every figure uses `tabular-nums` and right-aligns inside money columns.
 * - Rules are hairline only (no shadows, no fills darker than the page).
 * - State register = color + icon + shape + weight (accessible pair):
 *   `ready`   → emerald pill + check icon      (quiet positive)
 *   `review`  → amber pill + warning icon      (deliberate gate, not error)
 *   `blocked` → gray square chip + lock icon   (fail-closed by design)
 *   Only the icon presence separates "blocked" from "neutral".
 */

// ---------- Surfaces & rhythm ----------

/** Document card: flat white/dark surface, hairline border, no shadow. */
export const ledgerPanel =
  'rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/30';

/** Panel header block: full-bleed padding with hairline rule below. */
export const ledgerHeader =
  'border-b border-gray-200 px-4 py-2.5 sm:px-5 dark:border-gray-800';

/** Base body padding used between header and footer strips. */
export const ledgerBody = 'px-4 py-3 sm:px-5';

/** Hairline rule color pair (use with border-* utilities). */
export const ledgerRule = 'border-gray-200 dark:border-gray-800';

/** Softer hairline for in-panel row separation. */
export const ledgerRuleSoft = 'border-gray-100 dark:border-gray-800/70';

// ---------- Type scale ----------

/** Panel title (h3/h4): 16px semibold, tight tracking. */
export const ledgerTitle =
  'text-base font-semibold leading-7 tracking-tight text-gray-900 dark:text-gray-100';

/** Body prose: 16px/24, mid gray. */
export const ledgerProse =
  'text-base leading-6 text-gray-700 dark:text-gray-300';

/** Softer body prose for secondary sentences. */
export const ledgerProseSoft =
  'text-base leading-6 text-gray-600 dark:text-gray-400';

/** Field-style label above inputs (matches market-foundation Field). */
export const fieldLabel =
  'block text-sm font-medium leading-6 text-gray-700 dark:text-gray-300';

// ---------- Figure / proof system (the bold move) ----------

/**
 * Money figure in a ledger row: tabular digits, right-aligned,
 * whitespace-nowrap so amounts never break across lines.
 */
export const figure =
  'text-right text-base font-medium leading-6 tabular-nums whitespace-nowrap text-gray-800 dark:text-gray-200';

/** Emphasised money figure for totals / net positions. */
export const figureStrong = `${figure} font-semibold text-gray-900 dark:text-gray-100`;

/**
 * Flow variant for compound proof figures (e.g. "₦8.00 − ₦5.00 = ₦3.00"):
 * like figure but without nowrap — components are wrapped in nowrap spans
 * and the parent flex-wraps BETWEEN components, so a compound expression
 * never breaks mid-amount and stays usable at 375px.
 */
export const figureFlow =
  'text-right text-base font-medium leading-6 tabular-nums text-gray-800 dark:text-gray-200';

/** Inline figure inside prose (keeps tabular digits, keeps flow). */
export const figureInline = 'font-medium tabular-nums text-gray-800 dark:text-gray-200';

/**
 * Ledger row grid: label left (wraps if long), figure right in its own
 * auto column. Column split survives 375px because money is nowrap and
 * labels are free to wrap.
 */
export const ledgerRow =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 text-left';

/** Row label: 16px body, quieter than the figure. */
export const ledgerRowLabel =
  'text-base leading-6 text-gray-600 dark:text-gray-400';

/** Muted mono caption for source ids / unit ranges / trace metadata. */
export const sourceTrace =
  'font-mono text-xs leading-5 tracking-tight text-gray-500 dark:text-gray-400';

// ---------- State chips (color + icon + shape + weight) ----------

/** Chip base: pill by default; `chipBlocked` reshapes it to a square. */
export const chip =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ring-1 ring-inset';

/** Quiet positive: reconciled / succeeded / supported. */
export const chipReady =
  `${chip} bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`;

/** Deliberate soft gate: needs review / uncertain / awaiting decision. */
export const chipReview =
  `${chip} bg-amber-50 text-amber-800 ring-amber-600/30 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30`;

/**
 * Designed-blocked register: SQUARE shape (vs the pill) + lock icon —
 * read as deliberate fail-closed, never as an error.
 */
export const chipBlocked =
  `${chip} rounded-md bg-gray-100 text-gray-600 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700`;

/** Icon sizing inside chips / gate blocks (Phosphor `pi` Bold family). */
export const chipIcon = 'size-3.5 shrink-0';

/** Icon sizing inline with 24px prose lines. */
export const inlineIcon = 'mt-0.5 size-4 shrink-0';

// ---------- Gate notices ("designed moments" around frozen text) ----------

/** Amber gate strip: unresolved-but-deliberate states and notices. */
export const gateReview =
  'flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';

/** Emerald confirm strip (rare; used sparingly). */
export const gateReady =
  'flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300';

/** Neutral blocked strip: fail-closed mechanisms with lock icon. */
export const gateBlocked =
  'flex items-start gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-700 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300';

/** Red alert strip: genuine load/IO failures (never policy gates). */
export const gateAlert =
  'flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300';

/** Awaiting-decision editor block: neutral card with amber left edge. */
export const gateAwaiting =
  'rounded-lg border border-muted border-l-4 border-l-amber-400 bg-gray-50/60 p-3 dark:bg-gray-800/40 dark:border-l-amber-500';

/** Loading / projecting placeholder: dashed border, quiet, no spinner. */
export const ledgerPending =
  'flex items-center gap-2.5 rounded-lg border border-dashed border-gray-200 px-4 py-3 text-base leading-6 text-gray-500 dark:border-gray-700 dark:text-gray-400';

// ---------- State → treatment mapping ----------

/** The three register tones every operator state collapses into. */
export type LedgerTone = 'ready' | 'review' | 'blocked';

/**
 * Map a raw state string to the register tone. Fail-closed default:
 * anything unknown renders `blocked`, never positive.
 */
export const stateTone = (state: string): LedgerTone => {
  const key = state.trim().toLowerCase();
  if (
    ['reconciled', 'succeeded', 'ready', 'supported', 'ok', 'subscribed'].includes(
      key
    )
  )
    return 'ready';
  if (
    [
      'needs_review',
      'review_required',
      'uncertain',
      'pending',
      'awaiting',
    ].includes(key)
  )
    return 'review';
  return 'blocked';
};

/** Chip classes indexed by tone (D1 consumes this directly). */
export const toneChip: Record<LedgerTone, string> = {
  ready: chipReady,
  review: chipReview,
  blocked: chipBlocked,
};

/** Gate strip classes indexed by tone. */
export const toneGate: Record<LedgerTone, string> = {
  ready: gateReady,
  review: gateReview,
  blocked: gateBlocked,
};

/** Reason-line treatment indexed by tone (left rule carries the color). */
export const toneReason: Record<LedgerTone, string> = {
  ready:
    'border-l-2 border-gray-200 pl-2.5 text-base leading-6 text-gray-600 dark:border-gray-700 dark:text-gray-400',
  review:
    'border-l-2 border-amber-300 pl-2.5 text-base leading-6 text-amber-800 dark:border-amber-500/50 dark:text-amber-300',
  blocked:
    'border-l-2 border-gray-200 pl-2.5 text-base leading-6 text-gray-600 dark:border-gray-700 dark:text-gray-400',
};
