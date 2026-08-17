# DrinksHarbour Storefront — React Native App

**Date:** 2026-08-15
**Status:** Design approved, not yet planned
**Scope:** A React Native (Expo) app reaching full feature parity with `client/apps/platform`

---

## 1. Goal and constraints

Build a native iOS and Android app covering all 52 routes of the DrinksHarbour
storefront, visually faithful to the web design, with push notifications and
biometric session unlock.

The web storefront at `client/apps/platform` **stays live and unchanged in
purpose**. It owns SEO — SSR metadata, JSON-LD, sitemaps — which an app cannot
replace. The app is an additional surface, not a migration.

### Decisions taken during design

| Decision | Choice |
|---|---|
| v1 scope | Full parity — all 52 routes |
| Platforms | iOS and Android simultaneously |
| Native capabilities | Push notifications, biometric unlock. **Not** offline browsing. |
| Visual design | Match the web storefront closely |
| Architecture | Native core, WebView for content/legal pages |

### Why this is a UI rewrite, not a port

The backend is already a standalone Express REST API (`server/`), not Next.js
server logic. The client has only 4 `'use server'` files and 14 route handlers,
so almost no business logic is trapped in the framework.

What does not survive: every component. 1,004 files carry `'use client'`, but
that only means "runs in a browser" — the JSX targets DOM elements. The UI
dependency stack (rizzui, @headlessui/react, rc-table, rc-slider, rc-pagination,
swiper, slick-carousel, react-slick, framer-motion, react-paginate) has no native
equivalent and is replaced wholesale.

---

## 2. Repository structure

Two additions to the existing pnpm/Turborepo workspace:

```
client/
  apps/
    platform/          unchanged — owns SEO, stays live
    admin/             untouched by this work
    mobile/            NEW — Expo + expo-router + NativeWind
  packages/
    commerce-core/     NEW — framework-free logic, imported by platform AND mobile
    config-tailwind/   existing — mobile extends the same theme tokens
    config-typescript/ existing
```

### `packages/commerce-core`

Seeded by **moving** these files out of `platform/src/lib` (not copying), with
`platform` updated to import from the package:

- `pack-pricing.ts` (116 ln) + `pack-pricing.test.mjs`
- `cart-line.ts` (92 ln) + `cart-line.test.mjs`
- `first-order-perk.ts` (138 ln) + `first-order-perk.test.mjs`
- `commerce-policy.ts` (94 ln)
- `default-variant.ts` (66 ln) + `default-variant.test.mjs`
- `categories.ts` (136 ln)
- `validation.ts` (57 ln)

These modules import neither React nor Next and move verbatim.

`seoTitle.ts`, `product-jsonld.ts`, `gtag.ts`, and `pixels.ts` are also
framework-free but stay in `platform` — they serve SEO and web analytics, which
the app does not have. The package holds shared *commerce* rules only.

**Rationale, and the one non-negotiable part of this design:** pricing rules that
exist in two places will diverge. Pack pricing, the first-order perk cap, and
BxGy thresholds are precisely the rules where divergence means charging a
customer the wrong amount. One copy, guarded by tests that both apps depend on.

### What is deliberately NOT shared

`fetchWithAuth.ts` stays in `platform`. It is built around httpOnly cookies and
reads the CSRF token from `document.cookie` — neither exists in React Native.
Mobile gets its own `lib/api-client.ts` on the Bearer path.

---

## 3. Navigation and screen inventory

Bottom tab bar: **Home · Shop · Cart · Account**, each with its own stack.
Search is a modal presented over the active tab. Routing via `expo-router`, so
the file layout mirrors the `app/` directory convention already in use.

### Native screens — 41 routes

**Browse:** `/`, `/shop`, `/search-result`, `/deals`, `/categories`,
`/categories/[slug]`, `/categories/[slug]/[subSlug]`, `/brands`,
`/brands/[slug]`, `/product/[slug]`, `/compare`, `/wishlist`

**Buy:** `/cart`, `/checkout`, `/payment/verify`, `/order-confirmation`,
`/order-tracking`, `/gift/[token]`

**Auth:** `/login`, `/login/mfa-challenge`, `/register`, `/forgot-password`,
`/reset-password`, `/verify-email`

**Account:** `/my-account`, `/my-account/orders`, `/my-account/orders/[id]`,
`/my-account/addresses`, `/my-account/wallet`, `/my-account/gift-cards`,
`/my-account/gift-cards/[id]`, `/my-account/loyalty`,
`/my-account/notifications`, `/my-account/payment-methods`,
`/my-account/security`

**Other:** `/vendors`, `/vendors/[slug]`, `/vendors/register`,
`/vendors/register/apply`, `/vip-signup`, `/contact`

### WebView screens — 11 routes

`/about`, `/blog`, `/blog/[slug]`, `/careers`, `/faqs`, `/returns`,
`/shipping-info`, `/sustainability`, `/terms`, `/privacy-policy`,
`/cookie-policy`

Rendered via `expo-web-browser` against the live site with an `?app=1` query
param. The platform reads that param and suppresses header, footer, and any
install/cookie banners.

**Rationale:** these are near-zero-interaction content pages. Rebuilding them
natively costs real time and means legal copy changes require an app release.
The WebView approach keeps terms and policies current without shipping a build.

**Store-policy note:** the line stays on the right side of Apple guideline 4.2
(minimum functionality) because the entire transactional core is genuine native
code. A whole-app WebView wrapper would not pass and was rejected during design.

---

## 4. Authentication

### Session model

Pure Bearer tokens. No cookies, no CSRF handling.

This requires **no backend changes**:
- `server/middleware/auth.middleware.js:16` reads `Authorization: Bearer` first,
  annotated in-code as being for "mobile apps, API clients".
- `server/middleware/csrf.middleware.js:88` waives CSRF entirely for
  Bearer-authenticated requests.
- `server/controllers/user.controller.js:82` returns the full login result —
  including `token` and `refreshToken` — in the response body regardless of
  whether cookies were set. Mobile reads the body and ignores `Set-Cookie`.

### Token storage

`expo-secure-store` (iOS Keychain / Android Keystore). Never `AsyncStorage`.

Three keys: access token, refresh token, cached user profile.

### Refresh

Mirrors the web behaviour in `fetchWithAuth.ts`: on `401`, attempt one silent
refresh, retry the original request once, and on refresh failure clear storage
and route to `/login`.

**Added requirement:** concurrent `401`s must share a single in-flight refresh
promise. Without this, eight parallel requests on a screen trigger eight refresh
calls, and losing that race rotates the refresh token out from under the others.

### MFA

Unchanged from web. Login returns `pendingMfaToken`; the app sends it as the
`x-mfa-token` header, which `server/middleware/mfa.middleware.js:38` already
reads.

### Biometric unlock

A lock over an existing session, **not** a second authentication factor. The
refresh token is stored with `requireAuthentication`, and
`expo-local-authentication` gates access on cold start.

Failure or unavailability falls through to password login. Biometrics must never
produce a lockout.

---

## 5. State management

The seven contexts in `platform/src/context` port largely intact — they are
plain React, and their web coupling is confined to storage and DOM events.

| Context | Lines | Change required |
|---|---|---|
| `AuthContext` | 490 | localStorage/sessionStorage → SecureStore; remove `document.cookie` branches; `router.push` → expo-router |
| `CartContext` | 742 | localStorage → AsyncStorage; hydration becomes async with a `hydrated` flag; remove the `storage` event listener |
| `WishlistContext` | — | Storage swap only |
| `CompareContext` | — | Storage swap only |
| `FirstOrderPerkContext` | — | Storage swap only |
| `TenantContext` | — | Storage swap only |
| `Modal*` (×5) | — | Removed — replaced by native navigation modals and sheets |

Carried over unchanged because they are already correct and non-obvious:
- Per-user cart storage keying via `storageKeyFor(userId)`
- The guest → authenticated cart merge on login (takes MAX quantity)

### Server state

No caching library in v1 beyond a thin request-deduplication helper.

**Rationale:** the contexts already own their state. Layering React Query on top
creates two sources of truth. If list screens prove slow on real mobile
networks, introduce it deliberately at that point.

---

## 6. Checkout and payments

Korapay is the only live gateway. `/checkout` marks Stripe (`card`) and
`paystack` as `comingSoon: true`; the app mirrors this and exposes only
`bank_transfer` (Korapay — card, bank transfer, USSD).

### Flow

1. `POST /api/payments/korapay/initialize` with `callbackUrl` set to
   `https://www.drinksharbour.com/payment/verify`, registered as an iOS
   Universal Link and Android App Link.

   **Not a custom scheme.** `server/services/payment.service.js:269` passes the
   value through `normalizeUrl`, and Korapay rejects the entire charge with
   `"redirect_url must be a valid uri"` on a malformed URI — the same class of
   failure as the earlier scheme-less `FRONTEND_URL` outage.

2. Open the returned `authorizationUrl` (Korapay's `checkout_url`, per
   `payment.service.js:281`) with `expo-web-browser`'s `openAuthSessionAsync` —
   `ASWebAuthenticationSession` on iOS, Chrome Custom Tab on Android. Gives real
   browser chrome and security indicators, and self-dismisses on redirect.

3. On dismissal, call the server verify endpoint and **trust only that
   response**. Never read payment status from redirect parameters.

**Rationale for step 3:** a known open issue has `createOrder` trusting a
client-supplied `paymentStatus`. On mobile that field is fully attacker-
controlled. The app must not depend on that server-side fix landing first.

---

## 7. Push notifications

The only component requiring new backend work.

### New model — `Device`

| Field | Notes |
|---|---|
| `user` | ref User |
| `expoPushToken` | unique |
| `platform` | `ios` \| `android` |
| `appVersion` | for staged rollout targeting |
| `lastSeenAt` | for pruning dead tokens |
| `tenant` | row-level tenant scope, per existing convention |

### New routes

- `POST /api/devices/register`
- `DELETE /api/devices/:token`

### Sending

Via the Expo Push API, triggered at the existing points where `Notification.js`
records are created — so in-app and push notifications stay consistent rather
than becoming two independent systems.

### Permission timing

Requested **after the first completed order**, not on launch. A launch-time
prompt produces a permanent denial from most users, and the permission cannot be
re-requested from within the app afterward.

---

## 8. Error handling

- Root error boundary
- Per-screen retry states rather than a single global spinner
- Offline banner driven by `expo-network`
- Failed mutations surface as toasts and remain retryable
- Checkout specifically must never discard the assembled cart on a network blip

---

## 9. Testing

Follows existing project conventions rather than introducing new ones.

**`commerce-core`:** keeps its Vitest `.test.mjs` files; they now guard both the
web and mobile apps.

**Screen logic:** extracted into pure functions and tested under Vitest with
`environment: 'node'` — the same "no jsdom, don't render components" constraint
already in force in `apps/admin`.

**E2E:** Maestro, covering one flow — browse → add to cart → checkout → payment
→ confirmation. Chosen over Detox for setup simplicity; this is the path where
breakage costs money.

---

## 10. Build and release

EAS Build and EAS Submit.

### Prerequisites

- Apple Developer account ($99/yr)
- Google Play Console account ($25 one-time)
- **17+/18+ age rating with alcohol declared** on both stores
- Privacy policy URL (exists at `/privacy-policy`)
- Data-safety / privacy-nutrition disclosures

### Alcohol-specific requirements

Google Play requires alcohol-selling apps to be age-gated and geo-restricted.
The existing `components/AgeGate` must run on **first launch, before the catalog
is visible**, as a hard gate — not a dismissible banner.

### Risk

Store review for alcohol delivery apps is stricter and slower than typical, and
this surfaces late in a project by default.

**Mitigation:** create both store accounts and read the current alcohol policies
in week one, not week ten.

---

## 11. Delivery phasing

52 screens is too large for one implementation plan. The work decomposes into
phases that each end at a runnable, testable state:

1. **Foundation** — Expo app, NativeWind against the shared theme, `expo-router`
   tab shell, `commerce-core` extraction with `platform` migrated to import it,
   `api-client.ts` on the Bearer path
2. **Auth** — login, register, MFA, password reset, verify-email, SecureStore,
   refresh single-flight, biometric unlock
3. **Browse** — home, shop with filters, search, categories, brands, product
   detail
4. **Buy** — cart, checkout, Korapay flow, verify, confirmation, tracking
5. **Account** — the eleven `/my-account` routes, plus gift, wishlist, compare
6. **Remainder** — vendors, vip-signup, contact, and the eleven WebView routes
7. **Push and release** — `Device` model and routes, Expo Push, age gate on
   first launch, EAS Build, store submission

Phase 1 gates everything. Phases 3 and 5 can run in parallel with separate
people once phase 2 lands.

Each phase gets its own implementation plan.

## 12. Explicitly out of scope

- Offline catalog browsing (deferred by decision)
- Any change to `apps/admin`
- Retiring or reducing `apps/platform` — it owns SEO and stays live
- Stripe and Paystack payment paths — both remain `comingSoon` until the web
  storefront enables them
- React Query or equivalent server-cache layer, unless measurement justifies it
