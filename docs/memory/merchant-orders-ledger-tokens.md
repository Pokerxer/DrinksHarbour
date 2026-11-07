# Merchant-orders ledger design tokens (Phase D2 — operator surfaces)

Date: 2026-11-02. Governing brief: `docs/superpowers/plans/2026-11-02-operator-surface-design-brief.md`.

> Follow-up: D1 (platform-ops) consumed this language — see
> `docs/memory/platform-ops-ledger-tokens.md` for its supplement tokens and
> panel-by-panel notes.

## What happened

Designer D2 (merchant fulfillment) re-typeset the dense financial/ops panels in
`client/apps/admin/src/app/shared/merchant-orders/` into a shared "ledger"
document register. Zero user-facing string changes; all frozen copy, aria
roles/labels, and state semantics byte-identical. Zero test edits — all
merchant-orders vitest suites pass (36/36) and `tsc --noEmit` is clean.

## The shared token file (D1 must consume THIS)

`client/apps/admin/src/app/shared/merchant-orders/design-tokens.ts` — pure
string constants + two tiny helpers, no app imports. D1 (platform-ops) imports
these instead of inventing its own scale. Key exports, each documented inline
in the file:

- Surfaces: `ledgerPanel`, `ledgerHeader`, `ledgerBody`, `ledgerRule`,
  `ledgerRuleSoft`.
- Type: `ledgerTitle`, `ledgerProse`, `ledgerProseSoft`, `fieldLabel`.
- Figure/proof system (the one bold move): `figure` (tabular, right-aligned,
  nowrap), `figureStrong`, `figureFlow` (compound proof expressions wrap
  BETWEEN components, never mid-amount), `figureInline`, `ledgerRow`,
  `ledgerRowLabel`, `sourceTrace` (muted mono 12px caption for internal ids).
- State chips: `chip`, `chipReady` (emerald pill + check icon),
  `chipReview` (amber pill + warning icon), `chipBlocked` (GRAY SQUARE +
  lock icon — shape, not just color, encodes "fail-closed by design"), icons
  `chipIcon` (chips) / `inlineIcon` (prose lines). Icon family: react-icons
  `pi` Bold only (PiCheckCircleBold, PiWarningBold, PiLockSimpleBold).
- Gate notices: `gateReady`, `gateReview`, `gateBlocked`, `gateAlert` (red
  only for real IO failures, never policy gates), `gateAwaiting` (neutral
  card with amber left edge for decision gates).
- Pending: `ledgerPending` (dashed-border placeholder; the pulsing-dot
  accessory was removed in the final critique pass, keep it removed).
- State mapping: `stateTone(state)` → 'ready' | 'review' | 'blocked'
  (fail-closed default: unknown states render blocked, never positive),
  plus `toneChip` / `toneGate` / `toneReason` records keyed by tone.

## Panels changed (visual layer only)

- `settlement-statement-panel.tsx` — ledger dl with hairline-divided rows,
  right-aligned tabular money column, source-trace mono captions, header
  verdict chip + source id, reconciliation notes (neutral rule) vs uncertain
  rows (amber `gateReview`), ledger footer for order-set summary, payout
  notice as footer gate strip. Statement wire types extracted to
  `settlement-statement.types.ts` to keep the panel ≤300 lines.
- `local-dispatch-return.tsx` — unit ledger rows with mono unit ranges,
  inspection/decision evidence lists with left rules, two `gateAwaiting`
  editor blocks, fail-closed effects line in `gateBlocked` with lock icon.
- `refund-readiness-panel.tsx` — accepted figures in the money column, each
  answered by its reason line tinted by state tone, disabled-execution line
  in `gateBlocked`, full-cancellation notice in `gateReview`.
- `merchant-refund-panel.tsx` (className layer only) — summary figures,
  state chips on refund rows, mono unit ranges, tokenized cards/alerts.
- `quantity-panel.tsx`, `quantity-refund-panel.tsx` (className layer only) —
  tokenized cards, alerts.

## Rules going forward

- Copy stays frozen; re-typeset only. RTL text matching uses DIRECT text
  nodes, so wrapping interpolated strings in styled spans is safe, but never
  reword, reorder content across panels, or add visible operators' text.
- No new dependencies; Tailwind only (no SCSS was needed); files ≤300 lines;
  dark mode + 375px→desktop + visible focus (workspace primitives keep their
  rings) + reduced-motion respected; tabular-nums on every figure.
