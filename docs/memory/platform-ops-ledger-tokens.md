# Platform-ops ledger design tokens (Phase D1 — super-admin evidence register)

Date: 2026-11-02. Governing brief:
`docs/superpowers/plans/2026-11-02-operator-surface-design-brief.md`.
Consumer/predecessor: `docs/memory/merchant-orders-ledger-tokens.md` (D2's
ledger language — the source of truth D1 adopts).

## What happened

Designer D1 re-typeset the super-admin platform-ops surfaces into D2's
"ledger" document register — quiet, receipt-like, authoritative. Zero
user-facing string changes (every verbatim fail-closed wording, notice,
empty state, flag-off wording is byte-identical; frozen aria
labels/roles/regions untouched); zero test edits — all 13 platform-ops
Vitest tests pass, all 36 merchant-orders tests untouched-and-green, and
`src/` typecheck contributes zero errors.

## Token adoption (D1 consumes D2, no fork)

Panels import D2's
`client/apps/admin/src/app/shared/merchant-orders/design-tokens.ts`
directly: `ledgerPanel/ledgerHeader/ledgerBody`, `ledgerTitle/Prose/
ProseSoft`, `ledgerRow/ledgerRowLabel`, `figure/figureFlow`, `sourceTrace`,
`stateTone → toneChip/toneGate/toneReason`, `gateAlert/gateBlocked/
gateReady`, `chipIcon/inlineIcon`, `ledgerPending`.

Because this is the evidence register, no CTA styling exists anywhere in
the queue/registry/readiness panels (their tests assert `queryByRole
('button')` count 0 in readiness + registry panels and no reconcile
buttons in the mechanisms queue). The kind tabs (role=tablist
"Queue kind"/"Mechanism queue kind") are non-submitting navigation and
stay flat (weight + border weight, no fill).

Supplement file `client/apps/admin/src/app/shared/platform-ops/design-tokens.ts`
only adds what the ledger language lacked: `flagTone` (boolean flag →
register, so off is always `blocked`), `kindTab/kindTabActive`
(non-submitting kind tabs), `entryLink` (dotted-underline mono in-row
detail selection). The detail panel's two pre-existing reconcile controls
reuse the admin workspace `buttonClass`/`fieldClass` primitives — no new
action styling was invented. Contrast pairs documented in the file header.

## Panels changed (visual layer only)

- `platform-ops-view.tsx` — header demoted from a bordered card to a quiet
  document stamp (h1 + frozen two-sentence intro, body bumped to 16px).
- `readiness-panel.tsx` — ledger card with receipt header ("(v2)"
  version caption + `gateBlocked` stamp for "Readiness evidence is not
  activation permission." with lock); flags/refund-sources/policy-gates/
  carrier+counts/mechanisms (v2) as hairline-divided register groups, each
  line a `toneReason` left rule keyed by `stateTone`, `tabular-nums`
  figures; return stock/cost effects row in `gateBlocked` with lock.
- `policy-registry-panel.tsx` — one evidence card per mechanism: 16px
  title, `sourceTrace` mono flag line, `ledgerRow` with recorded-state
  label + `figureFlow` version counts, mono whitelisted version rows,
  fee-flow mono line + tone-tinted reason, mechanism verbatim reason in
  `toneReason`, `gateBlocked` strip for "no recorded policy; all surfaces
  fail-closed". Zero interactive elements.
- `operations-queue.tsx` / `operations-mechanisms-queue.tsx` — ledger card
  with header + flat kind tabs (frozen tab labels/aria), `divide-y` entry
  register: mono dotted `entryLink` inspect button, `toneReason` state
  line (tabular), quiet issue/reason line, `gateAlert` load errors,
  dash-line loading, calm status-line empty states.
- `operations-exception-detail.tsx` — flat ledger inspector card (amber
  `gateAwaiting` edge removed in the self-critique pass; the reading
  surface stays receipt-flat). `toneChip` source-resolution status +
  `sourceTrace` identity rows, mono audit history rows, success notice in
  `gateReady`, fail-closed wording in `gateBlocked`, the two pre-existing
  reconcile controls on workspace `buttonClass` (kept functional; not CTA
  styled).
- `(hydrogen)/platform-ops/layout.tsx` (NEW, additive) — ModuleNavHeader
  chrome per the merchant-orders precedent: brand "Platform operations",
  single tab "Evidence register" (`/platform-ops`), PiShieldCheckBold.
  Route tests keep passing; no test file added for it.

## State-driven coloring rule kept

No hand-picked colors anywhere: panels call `stateTone(state)` (unknown →
`blocked` automatically) or the boolean helper `flagTone`
(off → `blocked`); red (`gateAlert`) appears only on genuine load/read
failures; policy gates and needs-review wordings ride the tone records
(`toneReason`/`gateBlocked`), never red.

## Rules going forward

- Copy stays frozen; re-typeset only. RTL text matching uses direct text
  nodes — keep each asserted stream contiguous inside one element (icon
  siblings are fine: they contribute no text nodes).
- Whitelisted fields only — no new data rendering was added (brief
  contract: privacy is a design feature; e.g. queue rows gained no
  amounts).
- Dark mode, 375px→desktop, focus-visible rings, `motion-reduce`, 16px
  body (12px `sourceTrace` is metadata caption per D2), tabular-nums on
  numeric lines: all respected.
