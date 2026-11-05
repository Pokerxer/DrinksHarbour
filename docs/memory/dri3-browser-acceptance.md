# DRI-3 browser acceptance — five new business types (2026-11-05)

Authenticated Playwright acceptance (real admin + platform UIs) for the five
newly added business types, against the disposable `drinks_dri3_browser`
fixture on the :29127 venuePhase0 replica (DRI-4 conventions, dropped +
reseeded per run).

## Result snapshot (latest full runs)

- Journey A (admin listing create, all five verticals): **48/48** — quick-filter
  industry scoping per vertical, catalog match, pricing inputs, size-variant
  row via the quick-add chip, real Save → POST /api/subproducts, listing
  visible on /sub-products. General Retail surfaces all FOUR legacy trees
  (chips per industry: Dress / Mobile Phone / Skincare / Kitchen & Dining +
  Cookware & Bakeware — the 8-chip budget gives each industry 2; "Home Decor"
  never appears by design, see below).
- Journey B (tenant storefront, fashion): **15/15** — same-size (M) Emerald /
  Amber colour pair, seller offer, both chips, ₦22k/₦24k price band, two
  separate cart lines, wallet checkout through real UI → order confirmation,
  tampered sizeId + unknown subProductId both rejected by POST /api/orders.
- Journey C (boundaries): **6/7** — private (unpublished) listing never
  purchasable or searchable, pending-product sub never surfaced/ordered,
  approved sibling sells. **Open: C5** — the MAIN marketplace product-detail
  surface (`GET /api/products/slug/:slug` with no tenant-site context) still
  assembles buy offers for retail kinds — the one surface DRI-5's
  beverage-only gate does not cover. Delegated to the Backend Engineer as a
  follow-up issue; DRI-3 stays open to re-verify C5.

## Scripts / fixtures

- `server/__tests__/dri3Acceptance/seed-fixture.js` — drops + reseeds the
  owned DB. Identities written to
  `/private/var/folders/6r/48j62g153yngdnhfnh9jzz940000gn/T/opencode/dri3/fixture-identities.json`
  (tenant owner emails, buyer, wallet-funded buyer).
- `journey-admin.mjs` (per-vertical or `all`), `journey-storefront.mjs`
  (`b` | `c` | `all`), screenshots in the same evidence dir.
- Driver: `browser.lib.mjs` (chrome channel, headless, login input-verify retry).
- Run stack: API `:5301` (MONGODB_URI=…/drinks_dri3_browser + PORT=5301),
  admin `:3000` with `NEXT_PUBLIC_API_URL=http://localhost:5301`, platform
  `:3002` with the same override. **The launchd-managed service on `:5001`
  serves the default DB — starting either Next app WITHOUT the
  `NEXT_PUBLIC_API_URL=:5301` override silently sends browser-side auth/cart
  calls to the real DB ("Invalid email or password" from nowhere).**

## Seed-shape pitfalls (raw inserts bypass Mongoose defaults)

- `SubProduct.sizes` must be the inline array of Size refs — the detail
  service populates it; seeding only `subproduct` back-refs makes every
  product page 404 ("not currently available from any seller").
- Likewise seed Size rows explicitly with `status: 'active'`,
  `availability: 'available'`, `availableStock`, `reservedStock: 0` — the
  reservation path `storefrontStock.changeStock` filters on all of them;
  missing `availableStock` surfaced to shoppers as "Variant stock changed;
  refresh your cart" at checkout.

## Cart-line variant labels (defect fixed)

Cart/checkout lines showed the raw `size` channel code ("apparel") and NO
colour, so the two same-size lines were indistinguishable.

- `server/helpers/cart.helpers.js` — buildCartLine now emits
  `selectedSizeLabel` (displayName → sizeLabel → raw size) and
  `selectedColor: size.colorName`. **Identity stays on the RAW size code**
  (`selectedSize` + cartItemId) — the client's generateCartItemId and save
  echo must derive the same key, so a display label must never feed
  identity; the cart.helpers tests pin this split. **Shared path, coordinated
  with the Backend Engineer — display-only, additive fields.**
- `server/services/cart.service.js` — getCart's items.size select adds
  `sizeLabel colorName` (staged as a standalone one-liner; the file carried
  sibling-run edits).
- Platform client: `CartContext.addToCart` gained an optional `sizeLabel`
  arg the product page passes (`displayName || optionName`); cart page,
  ModalCart and checkout summary render the label chip + colour chip.
- Fixture gotcha: seeded Size displayName values ("M · Emerald"/"M · Amber")
  are what the chips render.

## Popup/overlay handling in journeys

Full-screen marketing popups (PopupBanner), cookie consent and age gates must
be dismissed by selectors (`div.fixed.inset-0 button:has(svg)` closes the
centered hero popup; the header Sign-in chip matches text selectors — pick
the form submit by y-position instead).
