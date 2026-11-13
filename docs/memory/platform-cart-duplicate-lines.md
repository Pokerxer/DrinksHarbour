---
title: Platform cart duplication — offer-identity fallback and load-time collapse
date: 2026-11-13
status: fix shipped (client reducer only), shop suite + purchase-flow tests green
---

# /platform cart duplicating products

## Root cause

Cart-line identity is the cosmetic string `productId-size-vendor-color`
(`generateCartItemId` on the client, `buildCartItemId` on the server — the
helpers comment already warns they must stay byte-identical). But ~10
add-to-cart call sites build that string from different inputs:

- Product Detail and the merchandising suggested-offers flow send
  `[colorName, optionName].filter(Boolean).join(' · ')` as the color
- cards/quickview/wishlist send `''` or `activeColor`
- server-persisted lines (`cart.helpers.buildCartLine`) write
  `colorName || ''` only — dropping `optionName`
- vendor sites send `line?.vendorName || ''` while Detail sends `tenant.name`

When the strings drift, `ADD_TO_CART`'s id lookup misses and pushes a SECOND
line for the same `selectedSubProductId + selectedSizeId` — visible in the
cart page and drawer, and amplified by the login merge (guest-built id vs
server-built id for the same offer). The true identity — seller's SKU + size
row — is already carried by every line on both sides; it just was not used
for dedupe.

## Fix (client reducer only; server untouched)

In `client/apps/platform/src/context/CartContext.tsx`:

1. **`ADD_TO_CART` offer-identity fallback** — when the id lookup misses but
   the incoming payload and an existing line share
   `selectedSubProductId + selectedSizeId`, merge quantities into that line
   and adopt the incoming line's id + cosmetic strings (what this add path —
   and its next lookup — will use).
2. **`LOAD_CART` collapse** — hydrating/dedupe pass: lines sharing the offer
   key are summed into the first line (server lines carry fresh pricing, so
   earliest wins). This also HEALS carts already polluted by the old scheme
   on their next load. Idempotent on clean payloads.
3. Guards: the fallback requires both ids present (legacy guest lines without
   ids keep pure string behavior); gift packaging is its own SKU (own
   subProductId) so a packaging line can never collapse into a drink line.

Server `addToCart` already dedupes DB lines on product+subproduct+size, and
`mergeCart`'s union is followed by `syncCart` which re-dedupes — so the DB
never stores drift-duplicates; the bug was purely in the client array.

## Tests

- `src/context/cart-identity.test.tsx` (8 tests): drifted color / drifted
  size label merge into one line and adopt the incoming id; different
  sizeId / different subProductId / gift SKU still separate; legacy
  no-id lines keep string behavior; polluted stored cart collapses on load;
  clean payloads stay idempotent.
- Reducer + `CartItem` exported from CartContext for tests.
- `vitest.shop.config.ts` include list extended with `src/context/**` (the
  test lives beside the code it tests).
- Green: cart-identity 8/8, full shop suite 50/50, purchase-flow +
  quickview-offer + wedding-chat node tests, `tsc --noEmit` clean.
