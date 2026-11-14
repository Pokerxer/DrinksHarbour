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

## Refinement (2026-11-13): colour leaves the identity for beverages

The user's point: the platform is a beverage marketplace — drinks have no
colour dimension. The Size row IS the variant. So the identity scheme became
`productId-size-vendor` plus a colour slot ONLY when the colour is truthy:

- Beverage adds are colourless (`p1-70cl-Wyn City`) — no more `-default`
  noise, and no colour string can drift an id.
- Fashion tenant storefronts keep per-colour ids (`p1-M-Wyn City-Emerald`).
- Client call sites stopped synthesizing `colorName · optionName` labels
  (Detail, merchandising suggested offers) — they pass `size.colorName || ''`
  and the human label already lives in `selectedSizeLabel`.
- Server `buildCartLine` now feeds the size's OWN `colorName` into the id —
  previously it passed a literal `''`, so a fashion tenant's two colour
  variants (M/Emerald, M/Ruby) shared one id and merged on reload. Same fix
  in `buildCartItemId` keeps client/server byte parity.

Existing carts carrying `-default` ids heal via the already-shipped
offer-identity fallback and LOAD dedupe. Known legacy behaviour (unchanged):
two size rows sharing one display size string merge under the string id.

## Tests

- `src/context/cart-identity.test.tsx` (10 tests): colorless beverage ids,
  fashion colour slot + per-colour separation, drift-merge fallback,
  separation guards, legacy lines, load collapse.
- `server/__tests__/cart.helpers.test.js` updated for the scheme; the fashion
  fixture now proves two colour variants get distinct ids.
- Green: cart-identity 10/10, shop suite 52/52, purchase-flow/quickview/
  wedding-chat node tests, server cart helpers + write-path 33/33,
  `tsc --noEmit` clean.

## Server-side quantity doubling (2026-11-14, follow-up)

Report: one Jameson from Wyn City became quantity 2 "on its own" after a while. Two server paths summed quantities:

1. **syncCart ran addToCart per payload entry** — a payload holding the same offer under two cartItemId schemes (a stale guest mirror with the pre-2026-11-13 id + the current colourless one) re-added the offer once per id: 1+1=2. Deterministic repro in cartSyncDedup.mongo.test.js.
2. **mergeCartLines unioned by id only** — the same two-id overlap kept both lines into syncCart.

Fixes: syncCart now collapses the payload per offer (product+subproduct+size, higher quantity wins), validates each, and writes the cart in ONE atomic update (validated snapshots priced through the same pipeline as addToCart) — overlapping syncs (merge + debounced save) converge instead of interleaving clear/add/add; mergeCartLines falls back to the offer key (selectedSubProductId+selectedSizeId) when ids differ, max wins, never the sum. addToCart itself is unchanged (single-add semantics are correct).
Verified: cartSyncDedup.mongo (1/1), cart.helpers (24/24), cart+marketplace suites (29/29), sales-reservation suites (4/4).
