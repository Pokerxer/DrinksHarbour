# Review edit protection and identity header

2026-10-17. User requested continued design/functionality improvements to Review
Sub-Product. Builds on subproduct-review-workspace.md and pricing.md.

## Behavior

- Header puts the beverage name first in the visual hierarchy. Accessible dialog
  name stays Review Sub-Product. Tenant, SKU, status and edited-price count remain
  separate, wrapping on narrow screens; status uses text as well as color.
- Header close, footer close and dialog dismissal all request guarded navigation.
  If price rows differ from server-loaded values or active decline feedback is
  nonempty, an inline amber footer offers Keep editing or an explicit discard.
- Reload uses the same guard. Confirmed reload fetches the latest listing, replaces
  drafts and clears decline feedback. It does not save any draft to the server.
- The prompt takes focus on Keep editing. Escape cancels the choice. Keep editing
  restores the initiating control's focus when that control is still mounted;
  otherwise focus returns to the main review content.
- Clean closes/reloads remain immediate. Resetting/reverting price edits removes
  the guard. Worksheet target adjustments alone are not persisted price edits.
- beforeunload guards browser refresh/closing while edits or a write are pending.
  Browsers choose their own warning wording and may suppress native prompts; this
  is not a guarantee against browser/process termination or internal route changes.
- Approval/decline success closes directly, with no discard prompt. Pending writes
  disable close/reload. Failed writes retain their drafts and existing error UI.
- No browser storage, server endpoint, revenue agreement or price formula changes.

## Structure and design

ReviewHeader.tsx / ReviewDiscardPrompt.tsx / useReviewNavigation.ts keep the modal
composable. Guard intents are keyed to listing ID and auth token so a stale prompt
cannot carry to a different record. ReviewNavigation.test.tsx exercises the real
modal with an API boundary fixture.

Palette stays within admin surfaces: white #fff, gray #111827/#6b7280/#e5e7eb,
blue #1d4ed8 for edits, amber #fffbeb/#b45309 for an impending discard and red
#b91c1c for the explicit discard action. Inherit admin fonts; product is a large
semibold heading, context small body text, SKU monospace. Signature is beverage
identity at the top paired with a restrained draft-protection footer, not another
popup layered on the full-screen review.

## Verification

29 review tests pass / 5 files, including seven real-modal navigation tests.
Scoped lint and whitespace checks pass. Full backend: 3,954 passed, 16 skipped,
zero failures. Full admin: 3,106 passed; one unrelated inventory-movements-browser
sort test timed out at 5 seconds. All four tests in that file passed on an isolated
recheck with the default timeout. Project types retain 359 existing diagnostics,
none in review files. Logs and visual-check limits:
`docs/superpowers/specs/RESUME-subproduct-review-edit-protection.md`.
Live protected UI remains unverified without an authenticated admin session.
