# Authenticity guarantee page

`client/apps/platform/src/app/authenticity-guarantee/page.tsx` — platform app, server component.
Last updated: 2026-11-11.

## What the page is for

Customer-facing trust page for `/authenticity-guarantee`. It answers "why buy from
DrinksHarbour instead of an open-market seller" with the sourcing argument, then
gives practical bottle checks. Uses `guideMetadata` + `GuideStructuredData`
(CommerceGuides) like the other guide pages.

## Content pillars (keep these if editing copy)

1. **Why buy from DrinksHarbour** — 6 reason cards: vetted sellers only
   (registered businesses reviewed + approved before their store goes live),
   sourcing from authorised distribution companies (not open-market resellers),
   always-visible seller identity, clear listing details before checkout,
   **the Verified badge** (issued only after approval, never self-claimed),
   and **seller ratings from verified buyers**.
2. **Sourcing chain strip** (signature element) — wine panel with the 135deg gold
   hairline pattern: Registered distributor → Approved seller → Your door.
3. **How a seller gets on DrinksHarbour** — 4 numbered steps: apply with real
   business details → review → sourcing check → approval + Verified badge.
   Backed by the Tenant model's real workflow: `status: pending → approved` by
   super-admin (`server/models/Tenant.js`).
4. **Before you buy / When your order arrives** — practical bottle checks
   (pre-existing content, kept).
5. **If something is wrong** — green panel, returns policy link, contact CTA.
   Ties reports to seller consequences (a seller that fails loses the store).
6. **Closing honesty block** — kept from the original page: no claims of
   laboratory testing or brand certification unless evidence exists.

## Copy constraints (do not drift)

- Public wording is **"seller"**, not "vendor" (code calls them Tenants; the
  `/vendors` route is the public "seller stores" surface).
- Never claim lab-testing, NAFDAC/brand certification, or per-bottle
  authentication tech. The guarantee is the *sourcing route*: vetted sellers +
  authorised distributors. If a stronger claim is ever true (e.g. verification
  feature ships), update this file and the page together.
- Onboarding steps must match the actual tenant approval workflow
  (`pending → approved`, super-admin approved-by). Don't describe automated
  verification that doesn't exist.

## Visual tokens

Wine `#351014`, brand red `#7c1d1d`, gold `#d5b26b`/`#e4c894`, cream `#fcfaf8`,
sand `#f7e9db`, deep green `#163a30`. Fraunces display via `@/app/fonts`.
Hero pattern: `repeating-linear-gradient(135deg, rgba(215,178,107,0.12) ...)`.

## Verification done 2026-11-11

- `npx tsc --noEmit` in `client/apps/platform`: clean.
- `npx eslint src/app/authenticity-guarantee/page.tsx`: clean.
