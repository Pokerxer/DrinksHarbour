---
name: Sub-product taxonomy and ephemeral creation forms
description: Product taxonomy is shown on sub-product details; creation never persists or restores browser drafts.
type: memory
---

# Sub-product taxonomy and draft cleanup

Spec: `docs/superpowers/specs/RESUME-sub-product-detail-taxonomy-and-drafts.md`.

- Central Product supplies `type`, `subType`, `style`. Keep these fields in
  the server `getSubProduct` populate and detail view model.
- Summary badges and the shared specifications table use
  `utils/product-taxonomy-label.ts`, matching product option labels (e.g.
  American IPA) and humanizing custom values. Missing taxonomy is omitted.
- Creation is in-memory only. The previous 30-minute localStorage restoration
  policy is superseded: never read or write `subproduct-draft`.
- `create-edit/draft-cleanup.ts` removes the legacy key on form mount/unmount,
  successful save, duplicate-record redirect, and New/Create Another.
  Denied storage access cannot fail a server save. No storage key is restored
  even if the browser refuses deletion.
- New/Create Another remount the creation form, clearing child search/selection
  state as well as form values. New from edit stays put if the save fails.
- Persisted server records with status `draft` are not deleted. Edit-mode
  server autosave remains in place.
- Do not reintroduce a global browser draft: it can leak across tenants/accounts
  and make each fresh creation reopen the previous product.


## Explicit duplication — refresh fix (September 23)

Duplicate on details or edit sets a one-time in-memory source ID, then navigates
to plain `/sub-products/create`. `create-entry.tsx` consumes the source once.
No query parameter, localStorage or sessionStorage may start duplication.
Fresh refresh is blank; New also discards the template.

The loader reads the authorized source plus its full central Product. The
allowlist copies reusable details/configuration and clears identity, stock,
history and publication. Explicit Save creates the new record; existing catalog
name matching and pending approval still apply.

`save-target.ts` prevents create requests from automatic saves or missing edit
IDs. The form uses a synchronous in-flight guard and a successful-create guard
to prevent repeated creation during navigation. Existing edit autosave may only
update the existing record. Do not reintroduce URL-triggered template restoration
or call the old immediate-write duplicate API from these detail/edit buttons.
