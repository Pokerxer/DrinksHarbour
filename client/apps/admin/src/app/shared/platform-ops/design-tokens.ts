/**
 * Platform-ops supplement to the shared ledger design language (Phase D1).
 *
 * D2's ledger tokens (`../merchant-orders/design-tokens.ts`) are the single
 * source of truth. Platform-ops panels import them DIRECTLY — nothing here
 * forks or redefines the ledger scale, chip system, rule weights or the
 * `stateTone` mapping. This file only adds the tokens the SUPER-ADMIN
 * EVIDENCE REGISTER needs that the ledger language genuinely lacks:
 *
 * - `flagTone`:     boolean flag → register mapping, so panels never
 *                   hand-pick state colors (default-off → `blocked`, the
 *                   evidence-not-permission posture; enabled → `ready`).
 * - `kindTab` / `kindTabActive`: the queue-kind navigation (role=tablist,
 *                   non-submitting). D2's language has no tab treatment;
 *                   these are flat document-register toggles — no CTA
 *                   fill or accent: the active kind carries by typographic
 *                   weight and border weight only.
 * - `entryLink`:    the in-row detail-selection affordance (kept a real
 *                   button for accessibility, never a submit). Dotted
 *                   hairline underline reads "inspect", not "act".
 *
 * The detail panel's two pre-existing reconcile controls reuse the admin
 * workspace primitives (`fieldClass`, `buttonClass`) unchanged — no new
 * action styling was invented here.
 *
 * Contrast pairs used (≈, both modes ≥4.5:1 for text):
 * - kindTab:      gray-600 on white 5.8 · gray-900 on gray-50 ≈17 ·
 *                 dark gray-400 on ≈#111827 ≈7 · dark gray-100 on gray-800 ≈13.
 * - kindTabActive borders/shapes are non-text.
 * - entryLink:    gray-900 on white 16.1 · dark gray-100 on ≈#111827 ≈15;
 *                 the dotted `decoration-gray-300` underline is decorative.
 */

import { type LedgerTone } from '../merchant-orders/design-tokens';

/** Boolean execution flag → register (never decided by hand). */
export const flagTone = (enabled: boolean): LedgerTone => (enabled ? 'ready' : 'blocked');

/** Queue-kind tab: quiet hairline box, weight set by the active variant. */
export const kindTab =
  'rounded-md border border-gray-200 bg-transparent px-3 py-1.5 text-sm leading-6 font-normal text-gray-600 transition-colors duration-150 hover:border-gray-300 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200';

/** Active kind: same geometry; weight + heavier rule carry the selection. */
export const kindTabActive =
  'rounded-md border border-gray-900 bg-gray-50 px-3 py-1.5 text-sm font-semibold leading-6 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100';

/** In-row selection affordance: dotted hairline underline, mono reference. */
export const entryLink =
  'inline-block text-left font-mono text-sm font-medium leading-6 text-gray-900 underline decoration-dotted decoration-gray-300 decoration-1 underline-offset-4 transition-colors duration-150 hover:text-gray-500 hover:decoration-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none dark:text-gray-100 dark:decoration-gray-600 dark:hover:text-gray-400';
