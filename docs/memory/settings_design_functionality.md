# Settings page design and functionality

Updated: 2026-09-08.

Settings pages share `app/shared/settings/settings-page-header.tsx`. API key
UI lives in `app/shared/api-keys` with authenticated requests in
`services/api-key.service.ts`. Keep the workspace keyed to token/tenant; never
persist plaintext API secrets. Active status must account for expiry and
revocation. Do not allow creating another key while its secret panel is open.

Templates retain the existing preference API/registry. Disable draft editing
while saving so the response cannot overwrite newer edits. Reset means the last
saved preferences, not a global factory default. Samples use unsaved selections.

Billing actions live in `shared/erm/use-billing-actions.ts`. Pending-change
lookup failures must be visible and block conflicting changes; provider mutation
errors trigger another lookup. Price confirmation uses a native dialog and
shows failures inside it. Keep the existing server-authoritative entitlements,
Paystack flow and effective-period policy.

Verification: 1,804 admin and 2,744 server tests passed; scoped lint passed; full
TypeScript has unrelated existing failures. Browser connection timed out, so live
visual/tenant acceptance remains unverified. No payments, commits or pushes.

Resume: ../superpowers/specs/RESUME-settings-design-functionality.md.

## App-wide commit follow-up — 2026-09-08

User requested committing all accumulated app changes on the existing
`feat/plan-entitlements-billing` branch. Commit includes admin/storefront/backend,
branding, document templates, billing, authorization, venue features and docs.
Generated `Wyncity_stock_import_review.xlsx.inspect.ndjson` is a local business
spreadsheet inspection artifact and is intentionally excluded, like its source
spreadsheet. No push requested. Staged content passed whitespace and targeted
secret-pattern checks. Whole-app TypeScript and live browser limitations above
remain; a commit does not imply deployment verification.

Pre-commit rerun: all 1,804 admin tests and 29 storefront tests passed. Server
suite is also required before the commit; its final result is recorded in the
commit message. Existing lint and type-check limitations remain unchanged.
