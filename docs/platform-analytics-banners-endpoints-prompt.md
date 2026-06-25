# Continuation prompt: add missing analytics/banner backend endpoints

Use this in a fresh session. All investigation is already done — this is
implementation-ready. Root cause confirmed, design decided, just needs the
code written, smoke-tested, and committed.

## Context

User reported errors on the **platform** storefront login page
(`client/apps/platform`). Browser console logs (Chrome DevTools + Safari)
were captured and showed the page was loading fine but flooding the console
with repeated 404s from `https://backend.drinksharbour.com`:

- `POST /api/analytics/track` → 404
- `PATCH /api/analytics/track/duration` → 404
- `GET /api/banners/placement/popup?limit=5` → 404

A `401` on `/api/auth/me` and an `imagesrcset` warning were also in the log
but are **not bugs** — `me` 401 is correct behavior for a logged-out visitor
(verified by reading `client/apps/platform/src/app/api/auth/me/route.ts`),
and the rest of the noise was `contentscript.js` (MetaMask browser
extension), unrelated to the app.

**Conclusion: there is no actual login bug.** The "error with the login" the
user originally reported was this console flood happening to occur on the
login page load (analytics tracking + popup banner fire on every page). The
fix is simply to implement the three missing backend routes.

This also means `docs/platform-login-chatbot-fix-prompt.md` (written earlier
in the same session, before this was root-caused) may be partially
obsolete on the login side — **the chatbot half of that doc is still valid
and unstarted**, but its login hypotheses can likely be closed out once this
fix lands and a real login attempt is verified clean in the console.

## What's missing (confirmed by reading the code, not guessing)

- `server/routes/analytics.routes.js` only has one route:
  `router.get('/dashboard', protect, attachTenant, tenantAdminOrSuperAdmin, getDashboard);`
  No public track endpoints exist.
- `server/controllers/analytics.controller.js` only exports `getDashboard`
  (imports `Order`, `SubProduct`, `Tenant` — does **not** import
  `WebAnalytics`).
- `server/models/WebAnalytics.js` already exists with the right shape (see
  below) but nothing writes to it from the public storefront.
- There is **no banner route/controller at all** for public placement
  queries. `ls server/routes | grep -i banner` → only `banner-gemini.routes.js`
  (AI banner generation, unrelated). `ls server/controllers | grep -i banner`
  → only `banner-gemini.controller.js`. The `Banner` model
  (`server/models/Banner.js`) exists and already has a ready-made static
  `Banner.getActiveBanners(placement, options)` (line ~508) that does
  exactly the right query (filters `isActive`, `status: 'active'`, tenant/
  global, device targeting, schedule window) and returns populated, sorted,
  lean results — **use this static directly, don't reinvent the query.**
- `server/server.js` mounts `/api/analytics` (analyticsRoutes) but has no
  `/api/banners` mount anywhere.

## Frontend call sites (already written, do not change)

- `client/apps/platform/src/hooks/useAnalyticsTracker.ts` (156 lines, already
  read in full in the prior session):
  - On every pathname change: `fetch(`${API_URL}/api/analytics/track`, { method: 'POST', body: JSON.stringify(payload) })`
    where `payload` = `{ sessionId, page, title, referrer, device, isNewUser, isFirstInSession, pageViewsInSession, utmSource?, utmMedium?, utmCampaign? }`.
  - On unmount/`beforeunload`: tries `navigator.sendBeacon(`${API_URL}/api/analytics/track/duration`, blob)` first (always a **POST**, beacons can't do PATCH), and only falls back to `fetch(..., { method: 'PATCH' })` if `sendBeacon` returns false. Payload: `{ sessionId, page, duration }` (duration in seconds).
  - **Implication:** the duration route must accept **both POST and PATCH**
    on `/api/analytics/track/duration`, since the beacon path (POST) is the
    common case and PATCH is just the fallback.
- `client/apps/platform/src/app/api/banners/placement/[placement]/route.ts`
  — Next.js proxy route, forwards `GET` (with querystring) to
  `${API_URL}/api/banners/placement/${placement}` and passes through the
  JSON response verbatim.
- Many components call the proxy with query params, e.g.
  `PopupBanner.tsx`: `fetch(`${API_URL}/api/banners/placement/popup?limit=5`).then(r => r.ok ? r.json() : null).then(data => { if (data?.success && data.data?.length) setBanners(data.data); })`
  Other callers (`Banner.tsx`, `FooterBanner.tsx`, `SeasonalBanner.tsx`,
  `FeaturedPromotionalBanner.tsx`, `AnnouncementBanner.tsx`,
  `ProductBanner.tsx`, `HeroBanner.tsx`, `PromotionalSlider.tsx`,
  `BannerTop.tsx`, `PromotionalBanner.tsx`) use the same proxy with
  different `placement` values and sometimes a `type=seasonal` query param
  — **so the controller should pass through `limit` and ignore/optionally
  filter on `type` (the Banner model already has a `type` field, separate
  from `placement`).**
- Response envelope expected by callers: `{ success: boolean, data: Banner[] }`
  (see `PopupBanner.tsx` check `data?.success && data.data?.length`, and the
  Next proxy's own error fallback: `{ success: false, data: [], message: '...' }`).
  Use `server/utils/response.js` → `successResponse(res, data, message, statusCode)` /
  `errorResponse(res, message, statusCode, error)` for consistency with the
  rest of the codebase — `successResponse` already produces `{success:true,message,data}`.

## `WebAnalytics` model — full schema (already read, copy exactly)

`server/models/WebAnalytics.js`, fields: `sessionId` (String, required,
indexed), `userId` (ObjectId ref User, default null), `page` (String,
required), `title` (String, default ''), `referrer` (String, default ''),
`source` (enum `['google','facebook','instagram','youtube','twitter','email','direct','referral','other']`,
default 'direct'), `medium` (String, default ''), `device` (enum
`['mobile','desktop','tablet']`, default 'desktop'), `os` (String, default
''), `browser` (String, default ''), `country` (String, default 'Nigeria'),
`state` (String, default ''), `city` (String, default ''), `duration`
(Number, default 0), `sessionDuration` (Number, default 0), `isNewUser`
(Boolean, default false), `isFirstInSession` (Boolean, default false),
`bounced` (Boolean, default true), `converted` (Boolean, default false),
`pageViewsInSession` (Number, default 1), `utmSource`/`utmMedium`/
`utmCampaign` (String, default ''). `{ timestamps: true }`. Indexes on
`createdAt`, `(sessionId, createdAt)`, `page`, `source`, `device`.

Note the tracker payload does **not** send `source`/`medium`/`country`/
`os`/`browser` — those can be derived server-side later (e.g. from
`req.headers['user-agent']` or geo-IP) but that's out of scope here; just
accept what the frontend sends and let the rest default.

## Implementation plan (exact)

1. **`server/controllers/analytics.controller.js`** — add two exports:
   - `trackPageView(req, res)`: destructure
     `{ sessionId, page, title, referrer, device, isNewUser, isFirstInSession, pageViewsInSession, utmSource, utmMedium, utmCampaign }`
     from `req.body`; require `sessionId` and `page` (400 via `errorResponse`
     if missing); `WebAnalytics.create({...})`; respond `successResponse(res, { id: doc._id }, 'Tracked', 201)`.
     Wrap in try/catch → `errorResponse(res, 'Failed to track page view', 500, err)`.
     This must be **fire-and-forget tolerant** — the frontend does
     `.catch(() => {})` and doesn't care about the response, so don't let a
     bad payload throw unhandled; just 400/500 gracefully.
   - `trackDuration(req, res)`: destructure `{ sessionId, page, duration }`
     from `req.body`; require all three; find the most recent matching doc
     — `WebAnalytics.findOneAndUpdate({ sessionId, page }, { $set: { duration } }, { sort: { createdAt: -1 }, new: true })`
     (note: plain `findOneAndUpdate` doesn't support `sort` directly in all
     mongoose versions for picking "most recent" — if that's an issue, use
     `WebAnalytics.findOne({ sessionId, page }).sort({ createdAt: -1 })` then
     `.duration = duration; await doc.save()`). If no doc found, still
     respond 200/204 success (it's a beacon, can't retry, don't 404).
     `successResponse(res, null, 'Duration recorded')`.
   - Import `WebAnalytics` at the top:
     `const WebAnalytics = require('../models/WebAnalytics');`
     Import `{ successResponse, errorResponse }` from `'../utils/response'`
     if not already imported in that file (check first).

2. **`server/routes/analytics.routes.js`** — add public routes (no
   `protect`/`attachTenant` — these are anonymous storefront visitors):
   ```js
   const { getDashboard, trackPageView, trackDuration } = require('../controllers/analytics.controller');
   router.post('/track', trackPageView);
   router.post('/track/duration', trackDuration);   // sendBeacon always POSTs
   router.patch('/track/duration', trackDuration);  // fetch fallback uses PATCH
   ```
   Keep the existing `/dashboard` route untouched.

3. **New `server/controllers/banner.controller.js`**:
   ```js
   const Banner = require('../models/Banner');
   const { successResponse, errorResponse } = require('../utils/response');

   exports.getBannersByPlacement = async (req, res) => {
     try {
       const { placement } = req.params;
       const { limit, type } = req.query;
       const tenant = req.tenant?._id || req.query.tenant || undefined; // see note below
       let banners = await Banner.getActiveBanners(placement, { tenant });
       if (type) banners = banners.filter(b => b.type === type);
       if (limit) banners = banners.slice(0, parseInt(limit, 10));
       return successResponse(res, banners, 'Banners fetched');
     } catch (err) {
       return errorResponse(res, 'Failed to fetch banners', 500, err);
     }
   };
   ```
   **Tenant note:** this route is hit anonymously from the public storefront
   with no `attachTenant` middleware in the chain (it's not currently
   resolving a tenant context anywhere in the platform app's banner/analytics
   calls). Check whether `Banner.getActiveBanners` without a `tenant` arg
   (i.e. `tenant: undefined`) correctly falls back to `query.isGlobal = true`
   per the static's own logic (`server/models/Banner.js` line ~523) — that's
   probably fine for now (global banners only) unless the platform app is
   meant to be tenant-scoped per subdomain, in which case look at how other
   public platform routes resolve tenant from the request (e.g. host header
   or `x-tenant-slug`, same pattern used in `apps/admin`'s
   `resolveTenant`/`fetchTenantBySlug` — check if an equivalent exists
   server-side for public endpoints) and wire it in. Don't over-build this —
   confirm with a real request first whether banners are even tenant-scoped
   in practice (check the admin banner-creation UI: does it always set a
   `tenant`, or are storefront banners typically global?).

4. **New `server/routes/banner.routes.js`**:
   ```js
   const express = require('express');
   const router = express.Router();
   const { getBannersByPlacement } = require('../controllers/banner.controller');
   router.get('/placement/:placement', getBannersByPlacement);
   module.exports = router;
   ```

5. **`server/server.js`** — add the mount near the other `/api/*` mounts
   (around line 161-200 where `app.use('/api/analytics', analyticsRoutes)`
   already lives):
   ```js
   const bannerRoutes = require('./routes/banner.routes');
   app.use('/api/banners', bannerRoutes);
   ```

6. **Smoke test** (no test runner configured for this backend beyond
   `node:test` ad hoc scripts — check `server/package.json` `"test"` script
   first). At minimum:
   ```bash
   node -e "require('./server/routes/banner.routes.js'); require('./server/routes/analytics.routes.js'); console.log('ok')"
   ```
   and ideally start the server locally (`cd server && npm run dev` or
   equivalent) and curl:
   ```bash
   curl -X POST http://localhost:5001/api/analytics/track -H 'Content-Type: application/json' -d '{"sessionId":"test","page":"/login"}'
   curl -X PATCH http://localhost:5001/api/analytics/track/duration -H 'Content-Type: application/json' -d '{"sessionId":"test","page":"/login","duration":12}'
   curl 'http://localhost:5001/api/banners/placement/popup?limit=5'
   ```
   Confirm each returns `{"success":true,...}` and a 2xx, and that a
   `WebAnalytics` doc actually lands in Mongo for the first two.

7. **Commit and push to `main`** — this session's established pattern has
   been direct commits to `main` with no PR (confirm this is still desired;
   if the user wants a PR this time, ask). Suggested message:
   `feat(server): add public analytics track + banner placement endpoints`.

## Verify against the real bug report

After implementing, reload the platform login page
(`client/apps/platform`) with the browser console open and confirm the
three 404s are gone. If they are, the original "login error" report is
fully resolved — there is no separate login code bug to chase. If any
residual error remains after this fix, **then** go back to
`docs/platform-login-chatbot-fix-prompt.md`'s login hypotheses, since that
would mean the console flood was masking something real underneath it.

## Gotchas (same as the prior rename-cleanup session)

- `pnpm` can't run in the Node 20 sandbox (`node:sqlite` missing via
  corepack's pnpm 11.6). This change touches no `package.json`/dependencies,
  so it shouldn't need a lockfile edit — but if you do add a dependency,
  hand-edit `client/pnpm-lock.yaml` or regenerate it on Node 22+.
- Don't confuse `apps/admin` (NextAuth dashboard) with `apps/platform`
  (custom-AuthContext storefront) — this fix is entirely server-side
  (`server/`) and frontend-untouched; both apps share the one Express
  backend.
- The chatbot half of `docs/platform-login-chatbot-fix-prompt.md` is
  unrelated to this fix and still pending — don't conflate the two.
