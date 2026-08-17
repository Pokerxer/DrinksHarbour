# DrinksHarbour

A multi-tenant SaaS platform for the Nigerian beverage industry: a public marketplace,
a branded storefront for every subscribing business, and a full back-office ERM
(inventory, POS, purchasing, sales, HR, appraisals) behind it — one codebase, one
database, one catalogue.

| | |
|---|---|
| Marketplace | [drinksharbour.com](https://www.drinksharbour.com) |
| Tenant storefront | `<slug>.drinksharbour.com` |
| Dashboard / back-office | [admin.drinksharbour.com](https://admin.drinksharbour.com) |
| API | `backend.drinksharbour.com` |
| Stack | Next.js (App Router) · React · TypeScript · Node/Express · MongoDB · Tailwind |

---

## The shape of it

Three Next.js apps and one Express API. Which app serves a request is decided by
hostname, at the edge:

```
drinksharbour.com          ─┐
www.drinksharbour.com       ├─→  client/apps/platform    (marketplace + storefronts)
<slug>.drinksharbour.com   ─┘

admin.drinksharbour.com    ───→  client/apps/admin       (super-admin + tenant back-office)

                    all of them ───→  server/             (Express API, MongoDB)
```

`platform` serves both the marketplace and every tenant storefront. They are the same
app; the tenant slug in the hostname is what makes one a storefront (see
[How a request finds its tenant](#how-a-request-finds-its-tenant)).

## Repository map

| Path | What lives there |
|---|---|
| `server/` | Express API — 84 models, 63 route modules, 67 controllers, 98 services, 163 test files |
| `client/apps/platform/` | Public marketplace + tenant storefronts (shop, cart, checkout, order tracking, blog, SEO surfaces) |
| `client/apps/admin/` | Back-office: POS, inventory, warehouses, purchasing, sales orders, contacts, employees, appraisals, logistics, analytics, tenant administration |
| `client/apps/mobile/` | Expo/React Native client |
| `client/packages/` | Shared workspace packages (`commerce-core`, `isomorphic-core`, Tailwind + TS configs) |
| `docs/` | Design and audit notes — see [Where the reasoning lives](#where-the-reasoning-lives) |
| `server/scripts/`, `scripts/` | One-purpose operational scripts (seeding, backfills, SEO) |

## Two decisions everything else follows from

**1. One catalogue, per-tenant selling instances.**
A `Product` is a beverage — it exists once, centrally, and is the single source of truth.
A `SubProduct` is one tenant's instance of selling it, and carries everything
tenant-specific: selling price, cost price, stock, size variants, availability.

Tenants never own Products. When a tenant lists a beverage that isn't in the catalogue,
the write is split: the `SubProduct` is created active and immediately sellable in their
own store, while a matching `Product` is created `pending` and stays invisible to the
marketplace until a super-admin approves it. That split is deliberate — a tenant should
never wait on our review to sell their own stock, and the public catalogue should never
be a dumping ground.

**2. Isolation is a row, not a database.**
All tenants share one MongoDB. Every tenant-owned document carries a `tenant` field, and
every tenant-scoped query filters on it — `{ _id, tenant }`, never a bare `findById`.

The load-bearing part is *where the tenant id is allowed to come from*.
`server/utils/tenantContext.js` is the only answer to that question:

```js
getTenantId(req)   // reads req.user.tenant (JWT authority), then req.tenant
                   // (resolved by middleware). NEVER req.body/query/params.
```

A client-supplied tenant id is not an input to authorization anywhere in the API. The
`x-tenant-slug` header and `?tenant=` query parameter are honoured *only* for
`super_admin`/`admin`, who have no tenant of their own and legitimately need to act
across tenants.

## How a request finds its tenant

Three hops, each with a different authority:

1. **Edge — `client/apps/platform/src/middleware.ts`.** Extracts the slug from the
   hostname (`<slug>.drinksharbour.com` or `<slug>.localhost`) and injects it as an
   `x-tenant-slug` request header. Reserved hostnames (`www`, `admin`, `api`, `platform`,
   `localhost`, …) resolve to *no tenant* — that's the marketplace. Locally, `?_tenant=acme`
   stands in for a subdomain you can't easily register on your machine.

2. **Admin app — `client/apps/admin/src/middleware.ts`.** Same slug extraction, plus
   NextAuth role gating on an explicit path list. Note the matcher is a path list: a route
   created outside it is not gated.

3. **API — `server/middleware/tenant.middleware.js` → `resolveTenantContext`.** Runs
   *after* `protect()`. JWT tenant wins. The header is consulted only for platform admins.
   Subdomain resolution is for unauthenticated storefront browsing only.

The rule to keep in mind when adding endpoints: the header tells you which storefront a
visitor is *looking at*; the JWT tells you which tenant a user *is*. Only the second one
may decide what they can read or write.

## Running it locally

**Prerequisites:** Node 22+, MongoDB 7 (local or Atlas), pnpm (root) / npm (client workspace).

```bash
# 1. API  → http://localhost:5001
cd server
npm install
cp .env.example .env        # see below for the variables that matter
npm run dev

# 2. Marketplace + storefronts  → http://localhost:3002
cd client/apps/platform
npm install
npm run dev

# 3. Back-office  → http://localhost:3000
cd client/apps/admin
npm install
cp .env.local.example .env.local
npm run dev
```

To browse a tenant storefront locally, hit `http://localhost:3002/?_tenant=<slug>` —
the middleware treats that query parameter as if it were a subdomain.

**Environment.** The API will not start without `MONGODB_URI` and `JWT_SECRET`. Beyond
those, features degrade rather than crash if their keys are absent: `PAYSTACK_SECRET_KEY`
and `KORAPAY_SECRET_KEY` (NGN checkout), `CLOUDINARY_*` (image upload and derivatives),
`ANTHROPIC_API_KEY` (AI content generation, chatbot, product enrichment), `MAIL_*` and
`SENDER_EMAIL_ADDRESS` (transactional email), `GOOGLE_MAPS_API_KEY` / `GOOGLE_PLACES_API_KEY`
(delivery and address lookup).

## Tests and type checks

```bash
cd server && npm test                          # 2080 tests, node:test (not jest)
cd client/apps/admin && npm test               # Vitest
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
cd client/apps/platform && npm run type:check
```

Three things worth knowing before you trust a green run here:

- **The admin Vitest environment is `node`, not jsdom.** Components cannot be rendered.
  Testable logic is extracted into plain modules and tested there — if you find yourself
  wanting to mount a component, extract the decision it makes instead.
- **`next build` is not a type or lint gate for the admin app.** Its `next.config` sets
  both `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` — linting the whole
  project during a build exhausts Vercel's 8 GB build memory. Type checking is a separate,
  explicit step (`tsc --noEmit`), and it is the one that counts.
- **Run `tsc` from the app's own `node_modules/.bin`.** From a directory where the local
  TypeScript isn't installed, `npx tsc` will happily fetch an unrelated `tsc` package from
  the registry and exit `0` without checking anything.
- **One known server test failure**, pre-existing: `pricelistRoutesValidation.test.js`
  ("get-one pricelist is tenant-scoped"). The test double doesn't support a chained
  `.populate().populate()`; the route it covers is fine. Everything else passes.

## Deploying

Each Next.js app deploys independently on Vercel with its own root directory and an
`ignoreCommand` that skips the build when the diff didn't touch that app or the shared
packages (`client/apps/{admin,platform}/vercel.json`). The API runs as a Node service on
`backend.drinksharbour.com`.

One packaging note that has bitten this repo: **npm does not implement the `workspace:`
protocol.** The Vercel install step uses npm, so a `workspace:*` dependency added to a
client app builds locally under pnpm and fails on deploy. Verify packaging changes against
a clean `git archive` checkout, not your working tree — pnpm's `node_modules` masks the
failure.

## Where the reasoning lives

Larger pieces of work are designed on paper before they are implemented, and the notes stay
in `docs/` — for example `docs/saas/tenant-authz-audit.md`, the tenant-authorization audit
the isolation rules above came out of.

Commits are written to explain the failure, not the diff — `fix(pos): a held order came
back free, and called "Product"` says more at `git log` distance than `fix: pricing bug`.
