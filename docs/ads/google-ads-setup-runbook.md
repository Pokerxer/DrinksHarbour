# Google Ads — external setup runbook

**Status as of 2026-09-04.** Everything in this file is work a human must do in
a browser, in someone else's console. None of it can be done from the codebase.
The code side of Plan A is finished; this is what stands between it and a live
campaign.

Ordered by lead time — start §1 and §2 the same day, because they are the ones
that wait on other people.

---

## 0. Eligibility — settled, but re-check once

DrinksHarbour **may** advertise alcohol to Nigeria. Nigeria is named on all
three approved-country lists (retrieved 2026-09-04):

| Permission | Page |
|---|---|
| Alcohol **sale** | `support.google.com/adspolicy/answer/16428720` |
| Alcohol **information / brand** | `support.google.com/adspolicy/answer/16427711` |
| Merchant Center alcoholic beverages | `support.google.com/merchants/answer/6150139` |

**One diary entry: 30 September 2026.** The entire alcohol policy is replaced
that day by a unified global framework (`answer/17452318`). It expands allowed
locations, so Nigeria is very unlikely to be dropped — but the update also
revokes prior permissions for advertisers targeting 0%-alcohol-only regions
unless they re-certify. Nigeria has no ABV ceiling so this should not apply.
**Re-read the two `adspolicy` pages after 30 Sep, before the first naira of
spend.** Do not carry this file's ✅ forward without that check.

---

## 1. Google Ads developer token — start this first

Longest lead time. Basic access is a manual human review, several business
days, and first applications are sometimes rejected.

1. Create a **Manager (MCC) account** at <https://ads.google.com/home/tools/manager-accounts/>.
   The token is issued against the MCC, not against a regular ads account.
2. In the MCC: **Admin → API Center**. Apply for a developer token.
3. Ask for **Basic access**, not Test. Test access cannot touch production
   accounts, which makes it useless for uploading real conversions.
4. The application asks how the API will be used. Answer honestly and
   concretely: uploading offline conversions for our own single advertiser
   account, and reading campaign performance. Vague answers get rejected.

Nothing in `server/services/adsConversionUpload.service.js` can run until this
token exists.

## 2. Advertiser identity verification

Google requires this before alcohol ads serve. Have ready, matching the legal
entity exactly:

- **CAC certificate** for the registered company
- **Government photo ID** for the person named as the account's legal
  representative

A mismatch between the CAC name and the Ads account payment profile name is the
usual cause of a rejection. Fix the payment profile first if they differ.

## 3. Budget cap — do this before the first campaign, not after

Set an **account-level monthly spend cap of ₦500,000** in the Google Ads UI
(**Billing → Settings → Monthly budget / account spend limit**).

This is the agreed ceiling from the Plan A design. It is a hard stop in
Google's own billing layer, which is the only place a runaway campaign can
actually be stopped — a limit enforced only in our code cannot stop spend that
Google has already served.

## 4. Production environment variables — the feed is 503 until these are set

Backend is the **Vercel project `drinks-harbour-u6md`**. Set these in the
**Production** environment, then **redeploy** — Vercel does not apply env
changes to an existing deployment.

| Variable | Value | Why |
|---|---|---|
| `FEED_SITE_URL` | `https://www.drinksharbour.com` | Origin every feed link is built from |
| `FRONTEND_URL` | `https://www.drinksharbour.com` | Also still unset; the Korapay redirect gap |

`GET /api/feeds/google-merchant.xml` returns **503 by design** while both are
unset, rather than publishing 617 `http://localhost:3002/...` links to Google.
That is deliberate — a 503 is recoverable, a catalogue of dead links in
Merchant Center is a suspension.

Prefer the full `https://…` form. A scheme-less value like
`www.drinksharbour.com` is now repaired rather than rejected (it goes through
`utils/frontendUrl.js`, the same normaliser that fixed the Korapay outage), but
setting it correctly costs nothing.

**Related, and worth fixing in the same visit:** `NODE_ENV` is set to the
literal string `development` in this project's Production environment. See
`vercel_prod_node_env_development` in the memory index — it leaks stack traces
publicly, raises the rate limit tenfold, and means **cron jobs never start**.
That last one matters here: see §7.

## 5. Merchant Center

1. **Verify and claim the domain** `drinksharbour.com`.
2. Add the feed: **Products → Feeds → scheduled fetch**, pointed at
   `https://<api-host>/api/feeds/google-merchant.xml`. Do not add it before §4
   is done, or the first fetch reads a 503.
3. Confirm the account's alcohol settings permit Nigeria (§0).
4. Expect a first-fetch item-level warning report. Items with no price or no
   image are already dropped by the builder rather than published broken, so
   the common warnings should be about identifiers (`gtin`) rather than
   correctness.

## 6. ABV — 4 products must not be advertised yet

Google requires the ABV to be shown on the landing page for any drink ≥0.5%
ABV. DrinksHarbour product pages render it, and **591 of 595** alcoholic
storefront products carry a value.

Four have `abv: null`, and because every render is guarded by
`{!!productData.abv && …}` the page shows **nothing at all** — silently
non-compliant rather than visibly broken:

- `kopke-decanter-10-years-old-tawny-porto`
- `pinhook-kentucky-straight-rye-whiskey`
- `the-lakes-whiskymakers-edition-limited-release-infinity`
- `tomintoul-18-years-1783607934020`

These are limited or cask-strength releases whose ABV genuinely varies by
batch. **Take each number from the bottle label or the producer's page — do not
infer it and do not let a model generate it.** A wrong ABV on a landing page is
worse than a missing one.

Until they are filled, exclude them from any campaign.

## 7. The conversion upload is not wired to anything yet

`server/services/adsConversionUpload.service.js` is written and unit-tested,
but **nothing calls it** — no route, no cron, no scheduler. That is correct for
now, because it cannot run without the §1 token. When it is wired up:

- It must run *after* fulfilment (it selects `shipped` / `delivered` orders).
- It values a conversion on **contribution margin**, not gross revenue.
- If it is wired to a cron, remember §4: crons do not start in this project's
  production environment unless `ENABLE_CRON=true` is set. A conversion
  uploader that silently never runs looks exactly like a campaign that gets no
  conversions.

---

## Done / not done

| Item | State |
|---|---|
| Nigeria eligibility | ✅ settled 2026-09-04, re-check after 30 Sep |
| ABV renders on product pages | ✅ verified, 4 data gaps outstanding |
| Click-id capture in the browser | ✅ verified end-to-end in Chromium |
| Merchant feed builder + route | ✅ built, 617 items, price matches storefront |
| Offline conversion upload | ⚠️ built and tested, **not wired to any trigger** |
| Developer token | ❌ not applied for |
| Identity verification | ❌ not started |
| ₦500k budget cap | ❌ not set |
| `FEED_SITE_URL` / `FRONTEND_URL` in prod | ❌ not set — feed 503s |
| Merchant Center domain verification | ❌ not started |
