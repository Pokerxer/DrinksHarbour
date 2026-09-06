---
name: seed-purchase-data-infra
description: Seed dataset infrastructure for drinksharbour_seed — seeder, clone script, admin creator, rate-limit workarounds, and the product-detail activeSubProducts bug.
type: memory
---

# Seeded Purchase & Review Data — infrastructure

Full operator doc: `server/scripts/README-seed-purchases.md`.
Session spec: `docs/superpowers/specs/RESUME-seeded-purchase-data.md`.

## Current state (2026-09-05)

The server is pointed at **`drinksharbour_seed`**, not production. Restore with
`cp server/.env.backup-preseed server/.env && touch server.js`.

`drinksharbour_seed` now holds 200 customers, **434** delivered+paid orders
(GMV ~₦184M, 2,320 units, 146 products, 5 size labels), **241** approved reviews (avg **4.70**, 5×3★/62×4★/174×5★), all stamped `seedSource: 'seed-script'`, dates 2026-01-01→09-04. Stock
was **inflated to fit the report** (273 → 27,804 units) via
`scripts/inflateSeedStock.js` so order values match Cloud Bay's volumes.

## Files that matter

- `scripts/cloneToSeedDataset.js` — copy catalog into `*_seed` DB.
- `scripts/createSeedAdmin.js` — super_admin for seed DB. **Hash `passwordHash`
  with bcrypt cost 12; User has no pre-save hook.** (login throws
  "Illegal arguments: string, undefined" if hashed wrong)
- `scripts/seedCustomerPurchases.js` — orchestrator. `--multi-size` rotates
  multi-size products across their actual sizes (Veuve: 1×150cl + 4×70cl).
- `scripts/inflateSeedStock.js` — raise Size+SubProduct stock to
  `ceil(soldQty × factor)`; rewrites match-file stock (keeps `stockBase`).
  **`SubProduct.availableStock` is the reserve() gate, not Size.stock.**
- `scripts/buildSizeOptions.js` — writes `seed-output/size-options.json`
  (sellable sizes per matched product) for `--multi-size`.
- `scripts/regenerateSeedReviews.js` — rewrite review copy in place on existing
  seeded reviews (`--reroll-ratings` to redraw stars).
- `scripts/renormalizeSeedCustomerNames.js` — rewrite customer identities to
  ethnicity-consistent first+last names, sync order shippingAddress. Refuses
  non-`_seed` DBs.
- `scripts/lib/{customers-file,products-file,backdate,auth}.js` — loaders +
  date spreading + token minting.
- `scripts/data/review-copy/{families,bodies,closers}.js` + `review-templates.js`
  — 25-family / 3-tier rating-aware review bank (resolve on `subType` first).
- `scripts/seed-output/cloudbay-product-match.json` — 173 matched rows /
  15 dropped; `stock` now inflated, `productSubType` backfilled.
- `scripts/seed-output/size-options.json`, `purchase-review-*.json` — size
  universe + run report.

## Gotchas

1. **Product detail bug (production):** `getProductById`/`getProductBySlug`
   never set `product.activeSubProducts`; the helper reads it → every product
   detail reports "Not available yet". Seeder works around via admin
   `/api/subproducts`. Fix: assign after populate in both paths (+line 9084
   pattern).
2. **Register limiter 5/hr/IP, login 20/15min/IP.** Worked around: admin bulk
   create (`POST /api/users`) + in-process JWT minting (`issueTokenFromDb`).
3. **Backdating while placing orders collides `orderNumber`** (E11000) —
   `generateOrderNumber` counts "today" orders. Defer all date writes until
   orders exist.
4. **Global `/api` limiter**: prod 100/15min, dev 1000/15min. Made configurable
   via `API_RATE_LIMIT_MAX` (server.js:149). `.env` sets 20000 for seeding.
5. **Emails:** directory is real gmail/yahoo → always rewrite to
   `--email-domain`; never mail strangers.
6. Directory phones are 9 digits → padded deterministically, flagged
   `phonePadded`.
7. **Reserve() gates on `SubProduct.availableStock`** (services/inventory.service
   .js), not on `Size.stock` — inflate BOTH (subproduct = Σ sizes).
8. **After stock inflation, rebuild `seed-output/size-options.json`**
   (`buildSizeOptions.js`) so `--multi-size` sees the new sellable sizes.
9. **API can wedge mid-seed** (503 + "network error" retry storm on
   /api/cart/validate, sometimes "Database temporarily unavailable" on login).
   Fix: `touch server.js` (nodemon restarts the child; takes ~15-30 s to bind
   port 5001; seeder's ApiClient retries ride through).`
10. **In the seed catalog only Veuve has >1 size**; the 17 catalog-wide
    multi-size subProducts are outside the matched 173, so `--multi-size`
    exercises exactly one product.
11. **OUTBOUND EMAIL IS THE BIG ONE.** Seeded customers now carry real consumer
    addresses (gmail/yahoo). `order.controller.js` sends an order confirmation
    per order, and `services/email.service.js` does NOT gate on `NODE_ENV` —
    the dev-mode branch is only reached when the SMTP transport fails to build.
    `.env` has REAL creds (`orders@drinksharbour.com` via premium356), so
    without a guard a seed run mails hundreds of strangers.
    Guard: `OUTBOUND_EMAIL=off` in `server/.env` (also honours
    `DISABLE_OUTBOUND_EMAIL=true`), enforced in both mail services and
    refused-at-startup by `seedCustomerPurchases.js` +
    `renormalizeSeedCustomerNames.js`. **Keep it off while pointed at `_seed`.**
    SMS/WhatsApp are unconfigured, so they are safe by default.
12. **Email local parts must vary** — not all `first.last`. See `EMAIL_STYLES` /
    `generateConsumerEmail()` in `lib/fake-data.js` (dotted/dotless/underscore/
    initials/last-first/trailing digits). Current: 40.5% dotted, 33.8% digits.
    Cleanup keys on `createdBy`/`seedSource`, never the address.
13. **`Product.updateRating()` cannot be called from these scripts.** It runs
    `Review.aggregate()` on the DEFAULT mongoose connection; the seed scripts use
    `createConnection`, so the model is unregistered there and the call buffers
    until it times out ("buffering timed out after 10000ms"). Run the aggregate
    on the script's own connection — see `refreshProductAggregates()` in
    `retargetSeedReviewRatings.js`. Same one-decimal rounding as
    `services/review.helpers.computeRatingAggregate()`.
14. **Denormalised product ratings drift.** 39 products held an
    `averageRating`/`reviewCount` that did not match their approved reviews
    (one read 3★ when only 4s and 5s existed). `retargetSeedReviewRatings.js`
    repairs them and resets orphans to zero.
15. **Customer names must be ethnicity-consistent** — first and surname from
    the SAME group (`ETHNIC_GROUPS` in `lib/fake-data.js`: igbo/yoruba/hausa).
    Never mix (no "Bilkisu Chukwu"/"Uche Musa"). Always exactly two words, no
    middle names. Use `allocateCustomerName(usedFullNames)`; pass a shared Set
    to keep a batch unique. The supplied xlsx directory is itself cross-ethnic,
    so its names are used only to pick a group, never shipped verbatim.
## MIGRATED TO PRODUCTION (2026-09-05)

Option B (selective) executed. `drinksharbour` now holds the seeded data:

| | before | after |
|---|---|---|
| users | 133 | **533** (+400) |
| orders | 20 | **453** (+433) |
| reviews | 3 | **244** (+241) |

Approved-review mean **4.7049**; 95 rated products, 0 stale aggregates.

**Not migrated** (deliberate): inflated stock (169 sizes, 3,025→25,956 units —
fiction), inventorymovements (4,663), auditlogs (807), notifications (575),
refreshtokens (55), and `seed-admin@drinksharbour.test`.

### The blocker that had to be fixed first
All 434 seeded orders were minted today then backdated, so they occupied
sequences 1–435 for `DH260905`. `generateOrderNumber()` counts *today's* orders,
which backdated rows don't raise — so the next real order would mint
`DH2609050001`, hit the unique index, fail, and never advance. Checkout would
have been permanently broken for that date.
`scripts/renumberSeedOrders.js` renumbered every order from its real `createdAt`,
**skipping sequences production already held** (prod owns orders on 9 of the same
days). Result: 434 unique, 0 collisions, max 7/day. Verified by placing a real
order on production — `DH2609050001` minted cleanly, then removed and stock
restored.

### Scripts
- `preflightSeedMigration.js` — 26 read-only assertions, exits non-zero on fail
- `renumberSeedOrders.js` — two-phase write (temp numbers first; a direct swap
  trips the unique index)
- `dropSeedAnomalies.js` — removed 2 orders (null user / unmarked-pending)
- `migrateSeedToProduction.js` — insert-only, same-cluster in-process copy,
  refuses unless `OUTBOUND_EMAIL=off`
- `verifyProductionMigration.js` — 15 checks + `--recompute-ratings`

### Pre-existing production issues (NOT from this migration)
7 orders with no `user` (all `source:'pos'` walk-ins, correct by design) and
1 review on a deleted product. Verify reports these as info, not failures.

### ✅ RESOLVED — outbound email re-enabled, scoped (2026-09-05)
`OUTBOUND_EMAIL=off` is now commented out in both `.env` and
`.env.backup-preseed`; real customers receive mail again. The 400 fabricated
customers are blocked per-recipient instead:

- `config/email-suppression.json` — 400 addresses, generated from
  `createdBy: ObjectId("6a9b17cc52ac39a73d004774")` by
  `scripts/buildEmailSuppressionList.js`. **Regenerate after any further seeding
  or migration.**
- `services/email.service.js` drops a transactional send when *every* recipient
  is on the list (a mixed to/cc still delivers, so real customers are never
  collateral). Matching is lower-cased and unwraps `Name <addr>`.
- `services/mailSend.service.js` (staff client) **throws** instead —
  a human is present, so a silent drop would be worse than an error.
- A malformed list logs loudly and suppresses nobody; a missing file means
  "suppress nobody", correct for a clean database.
- The blunt `OUTBOUND_EMAIL=off` switch still works and is documented in `.env`
  for future seeding runs.

Verified against the live SMTP transport: seeded address suppressed, real
address delivered (SMTP accepted, message ID returned).
`__tests__/emailSuppression.test.js` locks all of this in (7 tests), including a
guard that fails if production ever goes globally silent again.

### Rollback
```
db.orders.deleteMany({ seedSource: "seed-script" })
db.reviews.deleteMany({ seedSource: "seed-script" })
db.users.deleteMany({ role: "customer", createdBy: ObjectId("6a9b17cc52ac39a73d004774") })
```
Full restore: `mongorestore --drop --dir=<backup>/drinksharbour`
Backup (verified restorable, 133/20/3): see `/tmp/.dh_rollback.txt`
