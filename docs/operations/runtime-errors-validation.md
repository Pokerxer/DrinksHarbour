# Runtime service errors — validation, 2026-10-31

Backend full command: `cd server && node --test '__tests__/*.test.js'`.
Local-port-enabled run: 4,465 passed, 60 failed, 222 skipped; 136.96s.
All 60 failures require the unset dedicated venue MongoDB fixture URI.
They fail in connectVenueMongo before exercising their test behavior.
No production database was used. Initial restricted run was stopped after port errors.

Focused Redis/realtime backend checks: 12 passed. POS connector checks: 7 passed.

Failing tests (recorded by name):

- `server/__tests__/marketEnrollment.http.mongo.test.js:4:1` — market applications and immutable reviews enforce actual JWT tenant ownership and transactional audit
- `server/__tests__/marketEnrollment.http.mongo.test.js:48:1` — versioned policy validates stable identities, dates, atomic audit and rejects competing revisions
- `server/__tests__/marketEnrollment.http.mongo.test.js:68:1` — market revisions fail closed without indexes and rollback completely when audit storage fails
- `server/__tests__/marketEnrollment.http.mongo.test.js:90:1` — resolved access and catalogue eligibility use latest immutable scope and preserve independent ERM
- `server/__tests__/marketEnrollment.http.mongo.test.js:119:1` — applications preserve unexpired approvals while expired, pending and rejected scopes can reapply
- `server/__tests__/venueAdvances.mongo.test.js:4:1` — deposit is acceptance-bound, durable under unknown provider outcomes and verified exactly once
- `server/__tests__/venueAdvances.mongo.test.js:56:1` — accepted deposit policy holds capacity until its deadline and late paid conflicts remain visible
- `server/__tests__/venueAdvances.mongo.test.js:81:1` — late verified deposit after subscription lapse retains funds without reacquiring service
- `server/__tests__/venueCapacity.http.mongo.test.js:4:1` — capacity routes require flag, fresh JWT tenant and manager configuration authority
- `server/__tests__/venueCapacity.mongo.test.js:8:1` — capacity serializes overlapping physical and combined claims, expiry and safe amendments
- `server/__tests__/venueCapacity.mongo.test.js:52:1` — accepted request acquires capacity and cancellation releases it with owner privacy
- `server/__tests__/venueCapacity.mongo.test.js:80:1` — capacity-managed tables cannot be resized or deleted through legacy CRUD
- `server/__tests__/venueCapacity.mongo.test.js:93:1` — accepted arrival consumes its claim and replays one canonical visit
- `server/__tests__/venueCatalogCosting.http.mongo.test.js:3:1` — real costing routes enforce JWT grants, foreign scope, no-store and fresh revocation
- `server/__tests__/venueCatalogCostingJourney.mongo.test.js:3:1` — made-to-order service settles one canonical bill at actual ingredient cost and reports the same profit
- `server/__tests__/venueCatalogCostingJourney.mongo.test.js:40:1` — cost case resolution refuses unverified client cost claims
- `server/__tests__/venueCatalogCostingJourney.mongo.test.js:45:1` — automatic recovery cannot close a cost review as an unrelated invoice task
- `server/__tests__/venueCatalogListsCorrections.http.mongo.test.js:33:1` — serving and production lists expose every owned row beyond the first hundred through bounded cursors
- `server/__tests__/venueCatalogListsCorrections.http.mongo.test.js:63:1` — original lot and receipt selectors provide independent complete cursor pages
- `server/__tests__/venueCatalogListsCorrections.http.mongo.test.js:92:1` — receipt selector does not label an unconverted foreign purchase as a known NGN cost
- `server/__tests__/venueCatalogListsCorrections.http.mongo.test.js:109:1` — ingredient profiles and distinct source candidates return cursor pages without missing or duplicate stock identities
- `server/__tests__/venueChoiceIdentityCorrections.mongo.test.js:6:1` — historical separator-bearing accepted choices retain their fired line identity
- `server/__tests__/venueCostEvidence.mongo.test.js:4:1` — cost evidence distinguishes unknown from proven zero and refuses wrong owned source
- `server/__tests__/venueCostEvidence.mongo.test.js:23:1` — opaque receipt ids cannot establish verified source cost
- `server/__tests__/venueCostEvidence.mongo.test.js:29:1` — actual-cost policy refuses incomplete physical uniqueness guards
- `server/__tests__/venueCostIntegrity.mongo.test.js:26:1` — recipe stock issue rejects corrupt cumulative cost without changing stock
- `server/__tests__/venueCostIntegrity.mongo.test.js:48:1` — cost evidence cannot attach one stock forms movement to another original lot
- `server/__tests__/venueCostIntegrity.mongo.test.js:75:1` — original receipt revalidation rejects fractional minor money instead of rounding it
- `server/__tests__/venueCostIntegrity.mongo.test.js:87:1` — public recipe availability rejects quantity and cost drift without exposing amounts
- `server/__tests__/venueFinancialConsent.mongo.test.js:4:1` — financial consent pins owned booking version without creating a deposit obligation
- `server/__tests__/venueFinancialPolicy.mongo.test.js:4:1` — reviewed financial policy tooling requires platform authority, previews without writes and preserves approved versions
- `server/__tests__/venueFreshCostingGrantsCorrections.mongo.test.js:5:1` — new costing grants require persisted permission even for legacy owner records
- `server/__tests__/venueIngredientProfiles.mongo.test.js:3:1` — ingredient profile authoring owns its stock identity and never infers allergens or cost
- `server/__tests__/venueMinimum.mongo.test.js:4:40` — minimum financial line and capped advance reconcile on one canonical beverage bill (reserved refund 0)
- `server/__tests__/venueMinimum.mongo.test.js:4:40` — minimum financial line and capped advance reconcile on one canonical beverage bill (reserved refund 4000000)
- `server/__tests__/venueMixedTender.mongo.test.js:4:1` — direct visit mixed tender preserves one bill and the bound drawer cash allocation
- `server/__tests__/venueMoneyAuthority.http.mongo.test.js:4:1` — financial HTTP recovery preserves JWT tenant, receipt location and fresh owner permissions during feature pause
- `server/__tests__/venueMoneyIndexes.mongo.test.js:4:1` — money index preparation previews legacy rows, preserves v1 uniqueness and replays safely
- `server/__tests__/venuePayers.mongo.test.js:4:1` — payer reservations compete for one canonical balance and verified partial receipts settle once
- `server/__tests__/venueProduction.mongo.test.js:27:1` — production actual yield transfers exact source cost, completes once and prepared serving never issues raw twice
- `server/__tests__/venueProduction.mongo.test.js:47:1` — production shortage has no reservation, cancellation releases only owned inputs and zero output is explicit waste
- `server/__tests__/venueReceiptValuation.mongo.test.js:3:1` — reviewed untouched lot links to an exact original receipt without client cost or historical posting
- `server/__tests__/venueReceiptValuation.mongo.test.js:10:1` — foreign-currency purchase value cannot become NGN source cost without an approved conversion
- `server/__tests__/venueRecipeIssue.mongo.test.js:5:1` — physical recipe issue scales the fired delta, conserves cost and replays once
- `server/__tests__/venueRecipeIssue.mongo.test.js:51:1` — actual costing refuses legacy ledger claims as stock coverage
- `server/__tests__/venueRecipeIssue.mongo.test.js:60:1` — recipe authoring retains owned stock mapping and stamps its reviewer on the server
- `server/__tests__/venueRefunds.mongo.test.js:4:1` — refund review reserves bounded original funds, submits once and records only verified completion
- `server/__tests__/venueSealedCostConservation.mongo.test.js:37:1` — sealed cost refuses a receipt lot depleted outside retained valuation and reservations
- `server/__tests__/venueSealedCostConservation.mongo.test.js:44:1` — public sealed availability refuses unexplained lot depletion without exposing private cost
- `server/__tests__/venueSealedCostConservation.mongo.test.js:72:1` — sealed cost conserves rounding across outstanding reservations and refuses a corrupt cost watermark
- `server/__tests__/venueServiceChargeBilling.mongo.test.js:7:1` — approved service charge freezes one typed line, excluded from commission and minimum, counted once across payers
- `server/__tests__/venueServingAvailability.mongo.test.js:4:1` — serving availability stays unavailable without reviewed physical configuration
- `server/__tests__/venueTransferSnapshotsCorrections.mongo.test.js:28:1` — selected line move preserves accepted v2 snapshots and quantities in visit and held tab
- `server/__tests__/venueTransferSnapshotsCorrections.mongo.test.js:40:1` — party consolidation keeps distinct accepted serving versions as separate rows
- `server/__tests__/venueTransferSnapshotsCorrections.mongo.test.js:52:1` — moving a v2 priced-addon parent fails closed without an owned addon grouping
- `server/__tests__/venueTransferSnapshotsCorrections.mongo.test.js:61:1` — party consolidation rejects a stale owner actor after persisted role demotion
- `server/__tests__/venueTransferSnapshotsCorrections.mongo.test.js:70:1` — party consolidation appends incoming units instead of extending a fired survivor revision
- `server/__tests__/venueTransferSnapshotsCorrections.mongo.test.js:80:1` — moving an independently selected priced-addon row fails closed without parent ownership
- `server/__tests__/venueUsageVariance.mongo.test.js:4:1` — reviewed counts distinguish uncounted from zero and freeze stock watermark
- `server/__tests__/venueUsageVariance.mongo.test.js:24:1` — counts require original receipt and consistent remaining source quantity

TypeScript: `pnpm --dir client/apps/admin exec tsc --noEmit --incremental false`
completed with exit 0 and no diagnostics. Targeted diff whitespace check passed.

## Full admin suite

`pnpm --dir client/apps/admin test`: 484 files passed, 3 failed; 3,430 tests
passed, 4 failed (737.86s). Failures were outside the changed files:

- `local-dispatch-recovery.test.tsx` — failed booking exposes explicit retry and separate quarantined return receipt (5s timeout).
- `local-dispatch-return.test.tsx` — returned booking records exact-unit inspection and eligible treatment decision, showing unsupported effects honestly (5s timeout).
- `local-dispatch-return.test.tsx` — sealed inspection offers restock decision explicitly (duplicate Local rider delivery buttons after the prior timeout).
- `inventory-movements-browser.test.tsx` — sorts all matching rows before pagination and resets the view to newest first (5s timeout).

Isolated rerun of these three files: all 9 tests passed in 4.97s. The initial
failures did not reproduce without the full-suite/type-check contention. This
does not erase the failures in the full run. No changes to those files.
