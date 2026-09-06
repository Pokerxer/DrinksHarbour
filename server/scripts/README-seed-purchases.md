# Seeded Purchase & Review Data (`seedCustomerPurchases`)

Populates a **seed database** with realistic customer activity: register customers
from a name directory, place Cash-on-Delivery orders for products reconciled
against a real sales report, walk each order to delivered, leave reviews, and
spread the whole order book across a historical date window.

## Safety model — read before running

1. **Runs against a `_seed` database only.** The seeder (and the backdate
   writer) refuse to touch any database whose name does not end in `_seed`
   (`lib/backdate.js assertSeedDatabase`). Pointing `MONGODB_URI` at
   `drinksharbour_seed` is how you opt in; pointing it at `drinksharbour`
   aborts.
2. **Every row is marked.** Orders and reviews get
   `seedSource: "seed-script"`, so everything a run creates can be removed in
   two queries:
   ```js
   db.orders.deleteMany({ seedSource: "seed-script" })
   db.reviews.deleteMany({ seedSource: "seed-script" })
   ```
   The marker is not optional and cannot be turned off.
3. **Emails never go to real inboxes.** The name directory ships real-looking
   `@gmail.com`/`@yahoo.com` addresses. The seeder rewrites every address to a
   domain you control (`--email-domain`, default `@drinksharbour.test`) because
   the order pipeline sends real email through the configured SMTP. Without
   this, a seeded run would email strangers' addresses.
4. **Refuses `NODE_ENV=production`.**

## One-time setup

```bash
# 1. Clone the catalog (products, subproducts, sizes, tenants, refs) into an
#    isolated database. Source is only ever read.
MONGODB_URI="<prod-uri>" node -r dotenv/config scripts/cloneToSeedDataset.js \
  --target drinksharbour_seed --drop

# 2. Point the server at the seed DB and restart (nodemon watches server.js).
#      server/.env:  MONGODB_URI=.../drinksharbour_seed
#    Back up the previous .env first — the seed flow ships with
#    .env.backup-preseed for exactly that.

# 3. Create a super_admin in the seed DB (writes a known password, so it
#    refuses any database not ending in `_seed`).
node -r dotenv/config scripts/createSeedAdmin.js \
  --email seed-admin@drinksharbour.test --password 'SeedAdmin1!'

# 4. Smoke-test the pipeline.
node -r dotenv/config scripts/seedCustomerPurchases.js \
  --customers 4 \
  --customers-file ~/Downloads/Nigerian_Names_Directory_200.xlsx \
  --admin-email seed-admin@drinksharbour.test --admin-password 'SeedAdmin1!' \
  --approve-reviews
```

The product set used by a run is
`scripts/seed-output/cloudbay-product-match.json` — 173 Cloud Bay SKUs that were
reconciled against the published, sellable catalog and resolved to a single
catalog size. Rows the matcher rejected (volume mismatch or ambiguous size) are
kept in the same file under `dropped` and are never ordered.

## Full run

```bash
node -r dotenv/config scripts/seedCustomerPurchases.js \
  --customers 200 \
  --customers-file ~/Downloads/Nigerian_Names_Directory_200.xlsx \
  --orders-per-customer 1-4 \
  --items-per-order 1-4 \
  --rating-range 3-5 \
  --review-rate 0.55 \
  --date-range 2026-01-01..2026-09-04 \
  --admin-email seed-admin@drinksharbour.test \
  --admin-password 'SeedAdmin1!' \
  --approve-reviews
```

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--customers N` | 40 | Customers to process (truncates the directory). |
| `--customers-file path` | — | `.xlsx` name directory. Uses generated customers if omitted. |
| `--products-file path` | match file | Product × size rows to order from. |
| `--orders-per-customer a-b` | 1-4 | Random range of orders per customer. |
| `--items-per-order a-b` | 1-4 | Random range of line items per order. |
| `--rating-range a-b` | 4-5 | Review star range. |
| `--review-rate 0..1` | 0.55 | Share of delivered orders that get a review. |
| `--date-range A..B` | 2026-01-01..2026-09-04 | Window orders/reviews are spread across. |
| `--email-domain d` | drinksharbour.test | Rewrites every directory email to `@d`. |
| `--admin-email / --admin-password` | — | Super-admin for status transitions + review moderation. |
| `--approve-reviews` | off | Also approve submitted reviews as the admin. |
| `--persist-cart` | off | Also save each order's cart (slower). |
| `--dry-run` | off | Resolve everything, write nothing. |

## How accounts are created

The public `POST /api/users/register` route is rate-limited to **5 per IP per
hour** (`routes/user.routes.js:29`) — unusable for 200 customers. The seeder
therefore provisions accounts through the **admin route** `POST /api/users`
(`createUserAsAdmin`), which sits behind `protect()` + `authorize('admin',
'super_admin')` + `requireMfa()` and bypasses the public limiter. Provided
customers are born `isEmailVerified: true`, `status: active`, role `customer`,
then log in via the normal route (login limiter: 20/15min per IP). Without an
admin session the seeder falls back to `/register` (small runs only).

The directory's phone numbers are 9 national digits — one short of a valid
Nigerian mobile. The loader appends a deterministic check digit and reports
every padded number (`phonePadded: true`) rather than silently inventing state.
Directory rows that cannot be made valid are reported, not dropped silently.

## How dates work

`generateOrderNumber()` (`utils/orderUtils.js`) derives its sequence from the
count of orders created "today". Backdating an order immediately would remove it
from that window, reset the counter, and collide on the `orderNumber` unique
index. So the seeder collects every intended date during the run and applies
them in one deferred pass **after all orders exist** (`lib/backdate.js`). Styles
applied: weekend uplift and 09:00–23:00 order times, delivery 1–4 days later,
reviews 3–21 days after delivery.

## Review copy

The copy bank lives in `scripts/data/review-copy/`:

| File | Concern |
|---|---|
| `families.js` | `(Product.type, Product.subType)` → copy family |
| `bodies.js` | family → `{ high, mid, low }` tiers of `{title, comment}` |
| `closers.js` | optional trailing remark about delivery/packaging |

`data/review-templates.js` composes them and is the only import site.

Two rules the bank enforces:

- **Family accuracy.** Resolution keys on `subType` first, because gin, tequila,
  cognac and single malt all share `type: 'spirit'`. A gin must never be
  described with "warm smoky notes ... neat over a large cube".
- **Tier matching.** `rating` selects the sentiment tier, so a 3★ review reads
  lukewarm ("Perfectly drinkable but fairly generic") and never carries 5★
  wording.

Current size: **25 families, 142 titles, 175 comments**. Across 210 reviews that
yields ~86 distinct titles / ~172 distinct comments, max ~9 repeats of any one
title.

To rewrite copy on reviews that already exist — without touching their orders:

```bash
node -r dotenv/config scripts/regenerateSeedReviews.js --dry-run
node -r dotenv/config scripts/regenerateSeedReviews.js
# add --reroll-ratings to redraw the stars as well
```

It only matches `seedSource: 'seed-script'` and refuses non-`_seed` databases.

## Customer names — ethnicity-consistent, first + last only

Names must read as real Nigerian names, so a first name and surname always come
from the **same ethnic group**. No "Bilkisu Chukwu", no "Zainab Ogunleye",
no "Uche Musa".

Pools live in `scripts/lib/fake-data.js` as `ETHNIC_GROUPS`:

| Group | First × Last | Combinations |
|---|---|---|
| igbo | 25 × 23 | 575 |
| yoruba | 24 × 20 | 480 |
| hausa | 23 × 18 | 414 |

`allocateCustomerName(usedFullNames, random, ethnicity?)` picks a group by
weight (~34/34/32), then draws a first+last pair from **that group only**,
skipping any full name already handed out. Every customer is exactly two words
— no middle names.

Both customer sources go through it:

- **generated** — `generateCustomer({ usedNames })`; pass a shared `Set` so a
  batch cannot repeat a name.
- **`--customers-file` xlsx** — the directory's own first/surname are used
  *only* to score which ethnic group the row belongs to (and for the email
  local part); the shipped name is re-drawn from that single group. This is
  deliberate: the supplied directory is itself cross-ethnic.

To repair an already-seeded dataset in place:

```bash
node -r dotenv/config scripts/renormalizeSeedCustomerNames.js --dry-run
node -r dotenv/config scripts/renormalizeSeedCustomerNames.js
```

It rewrites `firstName`/`lastName`/`displayName`, regenerates the email as
`first.last@drinksharbour.test`, and syncs `shippingAddress.fullName`/`.email`
on every order belonging to that user. Passwords and all other fields are
preserved. Refuses non-`_seed` databases.

Applied to the current dataset: **400 customers renamed, 434 orders synced,
0 mixed pairs remaining** (was 78 coherent / 134 mixed / 188 unrecognised),
mix now igbo 140 · yoruba 138 · hausa 122, all names unique.

## Review ratings — hitting a target average

`scripts/retargetSeedReviewRatings.js` re-points the seeded ratings at a target
mean (default **4.7**) and **re-picks each review's copy at its new score**, so
the words still match the stars — bumping a 4 to a 5 without re-picking would
leave "Good, not outstanding" under five stars.

```bash
node -r dotenv/config scripts/retargetSeedReviewRatings.js --dry-run
node -r dotenv/config scripts/retargetSeedReviewRatings.js --target 4.7
```

The 3/4/5 split is solved rather than guessed. Among the splits that hit the
target, it prefers one with a ~2% three-star tail — a 241-review book with zero
sub-4 ratings reads as manufactured. Current result:

| 3★ | 4★ | 5★ | Mean |
|---|---|---|---|
| 5 | 62 | 174 | **4.7012** → displays 4.7★ |

Two placement rules keep the tail credible:

- a 3★ only lands on a product that has **more than one** review, so a single
  middling score never becomes a product's entire story;
- at most **one 3★ per product**, so the tail spreads across five different
  bottles instead of stacking on the busiest one.

It then refreshes the denormalised `Product.averageRating` / `reviewCount`.
Note it does *not* call `Product.updateRating()`: that method runs
`Review.aggregate()` on the default mongoose connection, while these scripts use
their own `createConnection`, so the model is unregistered there and the call
buffers until it times out. The aggregate runs directly on the script's
connection instead, with the same one-decimal rounding as
`services/review.helpers.computeRatingAggregate()`.

This also repaired **39 products** whose stored rating had drifted from their
reviews (one showed 3★ despite the dataset containing only 4s and 5s).

## Customer emails — consumer domains, varied local parts

Seeded addresses use real consumer domains (`gmail.com`, `yahoo.com`,
`yahoo.co.uk`, gmail-weighted) and a **mix of local-part styles** so 400 rows
don't all read as `first.last@`:

| Shape | Example |
|---|---|
| `first.last` | `zainab.mahmud@gmail.com` |
| `firstlast` | `ifeoluwaomotoso@yahoo.com` |
| `first_last` | `bolanle_ojo75@gmail.com` |
| `f.last` / `flast` | `c.ofili@gmail.com`, `adanjuma@gmail.com` |
| `first.l` | `zainab.m@yahoo.com` |
| `last.first` | `musa.halima@gmail.com` |
| trailing digits | `ibrahim.abba53@yahoo.com`, `chibuzoonyeka1@gmail.com` |

Current dataset: 40.5% dotted, ~19% underscored, ~40% plain, 33.8% carrying
digits (birth-year and 2–3 digit styles), 400/400 unique.

Builders live in `EMAIL_STYLES` / `generateConsumerEmail()` in
`scripts/lib/fake-data.js`. Cleanup keys on `createdBy` and `seedSource`, never
on the address, so the local part is free to look real.

### ⚠️  These addresses can reach real people

`order.controller.js` calls `sendOrderConfirmationToCustomer()` for **every**
order placed, and `services/email.service.js` does **not** check `NODE_ENV` on
its send path — it only falls back to logging when the SMTP transport fails to
build. With working `MAIL_*` credentials, a seed run would deliver hundreds of
confirmations for fictitious orders to real inboxes.

Two controls exist:

**1. Per-recipient suppression (the resting state).**
`config/email-suppression.json` lists every seeded customer address. Both mail
services consult it: the transactional path drops the message when *all*
recipients are suppressed (a mixed to/cc still delivers, so real customers are
never collateral damage); the staff mail client throws instead, because a human
is there to see the error.

```bash
node -r dotenv/config scripts/buildEmailSuppressionList.js
```

Regenerate after any seeding or migration — it is built from
`createdBy: <seedAdminId>`, the same selector the migration uses. A missing file
means "suppress nobody", which is correct for a clean database.

**2. Global kill switch (for seeding runs).**
`OUTBOUND_EMAIL=off` (or `DISABLE_OUTBOUND_EMAIL=true`) silences *everything*,
including real customers. `seedCustomerPurchases.js` and
`renormalizeSeedCustomerNames.js` refuse to run without it. Use it while
seeding; do not leave it on — password resets and verification codes stop too.

Both are covered by `__tests__/emailSuppression.test.js`, which also fails if
production is ever left globally silent.

## Fitting the order value — stock inflation

Cloud Bay's PDF records real 8-month volumes that the catalog stock doesn't
match (e.g. Jameson Triple Distilled sold 1,930, catalog holds 3). Order lines
are gated on `SubProduct.availableStock`, so with the raw catalog the seeded
order book tops out around ₦100M GMV — it literally cannot reach the report's
figures. `scripts/inflateSeedStock.js` fixes that by raising the seed database's
stock to the reported volume:

```bash
node -r dotenv/config scripts/inflateSeedStock.js               # factor 1.0
node -r dotenv/config scripts/inflateSeedStock.js --factor 1.5 --cap 500 --dry-run
```

- For each matched row it sets the checked `Size` to
  `max(currentStock, ceil(soldQty × factor))` and `availability: 'available'`,
  then rescales the owning `SubProduct`'s `totalStock`/`availableStock` to the
  Σ of its sizes (that field is the actual reserve() gate).
- Rewrites `final[].stock` in `cloudbay-product-match.json` so the seeder's
  run-wide budget follows (original preserved as `stockBase`).
- Refuses every database not ending in `_seed`.

Latest full run post-inflation: **434 orders / 2,320 units / ~₦184M GMV** (was
381 orders / 663 units / ₦100.7M pre-inflation), 0 errors.

## Multi-size rotation (`--multi-size`)

Only Veuve Clicquot Brut Champagne carries >1 size among the 173 matched
products (70cl + 150cl; every other catalog multi-size subProduct is outside the
matched set). `--multi-size` makes that rotation visible in the order book:

1. `scripts/buildSizeOptions.js` writes `seed-output/size-options.json` — every
   sellable size per matched subProduct, keyed by central `productId`, with
   `sellingPrice → price` and per-variant `checkedSoldQty`.
2. The seeder's picker, on a `--multi-size` run, re-prices ~60% of picks on
   multi-size products onto an in-stock sibling size (keeps the PDF-priced size
   the other ~40%), folding sibling stock into the run-wide budget so nothing
   oversells, and boosting multi-size products' pick weight ×8 so they show up
   at all (Veuve is a 0.09%-per-draw tail product otherwise).

Verified in the latest run: Veuve ordered once at **150cl** and four times at
**70cl**, and the live size-spread across the book is
75cl ×655 · 70cl ×463 · 1L ×17 · 50cl ×6 · 150cl ×1.

```bash
node -r dotenv/config scripts/buildSizeOptions.js       # after any stock change
node -r dotenv/config scripts/seedCustomerPurchases.js --multi-size ...
```

## What is and is not seeded

- **In scope:** customers (users), orders (COD), order delivery via
  status-update endpoint, order payment (COD settle), reviews (mentioning
  verification where the endpoint allows), review approval.
- **Out of scope by design:** no inventory mutations — orders are scaled to
  available stock per size so nothing oversells; no real emails; no products,
  sizes, tenants, or categories (those are cloned from production).

## Tearing down

```bash
# point the server back at production:
#   server/.env  →  restore .env.backup-preseed
# remove everything the seed created:
#   db.orders.deleteMany({ seedSource: "seed-script" })
#   db.reviews.deleteMany({ seedSource: "seed-script" })
#   db.users.deleteMany({ role: "customer", createdBy: <seed-admin-id> })
# drop the seed database entirely if you want a fresh start:
#   use drinksharbour_seed; db.dropDatabase();
```

## Known production bug surfaced while building this

`getProductById()`/`getProductBySlug()` in `services/product.service.js` assign
populated listings to `product.subProducts`, but `helpers/buildProductQuery.helper.js`
reads `product.activeSubProducts`. `getAllProducts` does the handoff
(`product.service.js:9084`); the by-id/by-slug paths never do, so **every
product detail response reports "Not available yet"** with `tenantCount: 0`,
even when stock exists. Non-functional for customers. Called out deliberately
in `scripts/lib/catalog.js`. The public-catalog discovery source in that module
is the intended replacement once the service is fixed.