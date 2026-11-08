# Kiosk compare tray + paired phone scanning

Date: 2026-11-05/06
Status: Shipped round 1 (commits 970c1a75..727536dc) + round-2 polish (commits 586c2bbc..12672cb3)

## What exists

Kiosk price checker (`client/apps/admin/src/app/kiosk/price-checker/[kioskSlug]`,
components in `client/apps/admin/src/components/price-checker/`) supports:

1. **Compare tray** — after a scan, the result screen shows "Add to compare";
   up to 4 bottles are held in `sessionStorage` via `use-compare.ts`
   (`MAX_COMPARE_ITEMS = 4`, dedupe by barcode, name+size fallback). A tray
   bar (`compare-tray.tsx`) persists across the kiosk auto-reset (visible on
   the idle screen), letting the customer remove/clear bottles and open the
   full-screen side-by-side `compare-screen.tsx` (best-value badge on the
   cheapest bottle; rows where all bottles match collapse to "All: …").
   The compare view is a real kiosk screen (`Screen === 'compare'`) wired into
   `use-kiosk.ts` (`openCompare()`, included in the reset-timer screen list).

2. **Paired phone scanning** — kiosk renders a QR (`phone-pair.tsx`,
   `qrcode.react`) encoding
   `/kiosk/price-checker/<slug>/m/<session>` wherever `enablePhoneScan` is on
   (idle + result screens, never on the compare view). The phone page
   (`client/apps/admin/src/app/kiosk/price-checker/[kioskSlug]/m/[session]/`)
   uses `html5-qrcode` for camera decoding (`phone-scanner.tsx`) and posts each
   barcode to the existing Next proxy `/api/price-checker/<slug>/scan` with
   `origin: 'phone'` and `pairSession: <id>`. The Express controller emits the
   resolved product into the Socket.io room `pkiosk:<session>`
   (`server/socket/index.js` — `attachKioskPairing(io)`; POS gateway now tags
   tokenless sockets with `tenantId: null` instead of rejecting them). The
   kiosk consumes the room via `use-phone-pairing.ts` and drops the product
   into its tray. Pairing degrades gracefully: no socket ⇒ phone still shows
   prices.

## Server contract changes

- `PriceCheckerKiosk.settings` gained `enableCompare` / `enablePhoneScan`
  (booleans, default true — added to `displayDefaults` in
  `server/services/priceChecker/validation.js`, so schema + validation + admin
  editor toggles all flow automatically).
- Scan payload (`publicProduct`) now carries `abv` / `volume` ("750 ml" from
  `volumeMl`) / `origin` (`originCountry`) when `enableCompare` is on.
- `POST /scan` accepts optional `origin` ('kiosk'|'phone') and `pairSession`
  (`^[a-z0-9-]{10,64}$`) and emits `kiosk:scan` events to `pkiosk:<session>`.
- `KioskScan.origin` (enum 'kiosk'|'phone', default 'kiosk') records where a
  scan came from. **Not yet in the analytics aggregations/UI** (explicit
  follow-up).

## Tests

- `server/__tests__/priceChecker.settings-toggle.test.js`,
  `priceChecker.comparePayload.test.js`, `priceChecker.pairing.test.js`
  (node:test; run `cd server && node --test '__tests__/priceChecker.*.test.js'`).
- Client vitest: `use-compare.test.ts`, `compare-screen.test.tsx`,
  `use-phone-pairing.test.ts`, `phone-scanner.test.tsx` plus extended
  `kiosk-interface.test.tsx` / `use-kiosk.test.tsx`
  (`cd client/apps/admin && npx vitest run src/components/price-checker src/app/shared/price-checker`).

## Gotchas

- The Next API proxy (`client/apps/admin/src/app/api/price-checker/[...path]/route.ts`)
  whitelists request bodies unchanged — it forwards the whole parsed scan body
  (size-capped), so new `origin`/`pairSession` keys pass through without proxy
  edits.
- Phone-page Next URL uses window.location.origin — works on LAN during local
  smoke tests; wildcard subdomain existence is irrelevant here because the
  kiosk lives on the admin app.
- The pairing security model is a capability URL (same trust model as the
  purchases Scan & Match flow) — do not escalate it to emit anything beyond the
  public product payload that /scan already returns.

## Round 2 — polish (2026-11-06, spec `2026-11-05-kiosk-compare-polish-design.md`)

- **Payload**: `publicProduct` (enableCompare on) additionally returns raw
  `volumeMl` and `beverageType` (Product `type`). Lookup select now includes
  `type`.
- **Metrics** (`components/price-checker/metrics.ts`): `pricePerMl`,
  `drinks` (25ml units of alcohol), `pricePerDrink`, `bestValueRank`
  (per-ml ranking only when **every** tray item has volumeMl, else by price),
  `typeLabel`. Comparison table gains rows **Type, Price per ml, Cost per
  drink** (cost-per-drink only when ABV+volume exist for all items).
- **Decision headline** (`compare-rows.ts`: `rowsFor` + `decisionHeadline`)
  — shared attributes lead, difference closes (price spread → size → brand);
  `null` when 0/1 items or everything shared including price. The
  compare-screen's row rendering now sources from `rowsFor`.
- **Visual**: tabular numerals, bigger result price, best-value accent card
  (`data-rank='0'`) + ribbon, pill tray items with 48px thumbs, QR restyled
  as a right-aligned quiet strip, kiosk-rise screen/card animation and a
  one-shot pulse on the Compare button when it reaches ≥2 bottles — all
  disabled under `prefers-reduced-motion: reduce`.
- **Phone**: viewfinder corner marks + hint, torch toggle (probe
  `applyVideoConstraints`, hidden when unsupported), richer result cards
  (size/ABV, stock pill, "Best so far" chip, `phone-land` pulse), summary
  bar "n bottles scanned · cheapest …", and the scan history persists in
  `sessionStorage` under `price-checker-phone-<slug>` (page reload keeps it).
  List markup moved to `components/price-checker/phone-results.tsx`.
- **Analytics**: `getAnalytics` overview now includes
  `byOrigin: { kiosk, phone }` (legacy/absent origin counts as kiosk;
  `originSplit(rows)` exported for tests). Admin summary grid adds a
  "Phone scans" stat card (`PiDeviceMobileCamera`).
- Tests: `metrics.test.ts`, `compare-rows.test.ts`, `phone-results.test.tsx`,
  torch tests in `phone-scanner.test.tsx`,
  `priceChecker.originSplit.test.js`; compare-screen/kiosk-interface tests
  extended. Suites green: 37 server / 98 client / tsc clean.

## Round 3 — offline-first + scanner tuning (2026-11-07, spec `2026-11-07-kiosk-offline-scanner-design.md`)

- **Server**: `GET /api/price-checker/book` (session token, `ipLimit`) returns
  `services/priceChecker/book.js buildBook(context)` — whole-warehouse
  compact pricebook (barcode-keyed public fields, no ids, same sellability
  rules as /scan, pricelist-aware via resolvePrice, HIDE rule drops zero
  stock, cap 4000 sizes) + `generatedAt`. `POST /api/price-checker/sync`
  (same auth + limiters) takes `{ scans: [...] }` ≤50 entries
  `{ barcode, requestId, scannedAt }`, validates each entry independently
  (`buildSync`), runs lookup + `logScan` with an optional clamped
  `scannedAt` (last 7 days, never future — `syncScannedAt`), and answers
  `{ synced: [{requestId}], rejected: [{requestId,error}] }`. In-batch
  duplicate requestIds are rejected. `logScan(context, barcode, requestId,
  result, origin='kiosk', scannedAt?)` passes the timestamp through
  (`KioskScan.scannedAt` keeps the queued time; UnknownBarcodeScan upserts
  use the same occurrence).
- **Proxy**: `proxyAction` now returns `{ slug, action, method }`; GET actions
  `config`/`book`, POST actions `session`/`scan`/`sync`; sync bodies ≤16KB
  and whitelisted to `{ scans: [...] }`.
- **Client**: `offline.ts` — `saveBook/loadBook/lookupBook` (localStorage
  `price-checker-book-<slug>`, post shape `{ generatedAt, config, items }`,
  ~4MB guard) and queue helpers `readQueue/addQueue/dropQueue/flushQueue`
  (`price-checker-queue-<slug>`, cap 500, `flushQueue` POSTs /sync and drops
  confirmed requestIds). `use-offline.ts useOfflineBook(slug)` refreshes the
  book on mount/`online`/10-minute timer and exposes an
  `OfflineSupport { generatedAt, config?, lookup, onOfflineScan }`.
- **`useKiosk(slug, offline?)`**: on `KioskError(502/503/504)` the scan falls
  back to the cached book — cache hit ⇒ cached `result` screen + queued scan
  record; miss ⇒ `missing` screen; no book ⇒ old failure path. `initialize()`
  with the same network failure and a cached config boots straight to a
  working idle screen. Returns `offline` boolean. `kiosk.tsx` renders an
  "Offline · prices from <time>" pill in the header and flushes via the hook.
- **Scanner tuning** (`phone-scanner.tsx`): restricted formatsToSupport
  (EAN-13/8, UPC-A/E, CODE-128/39), `fps 15`, hi-res videoConstraints,
  wide 300×140 horizontal scan band for 1-D symbols,
  `useBarCodeDetectorIfSupported`, zoom slider (only when
  `getRunningTrackCapabilities()` reports a zoom range), manual typed-barcode
  fallback. Toron + viewfinder unchanged.
- Tests: `priceChecker.book.test.js`, `priceChecker.sync.test.js`
  (unit, mocked catalog/logging), `offline.test.ts`,
  extended `use-kiosk.test.tsx` / `scanner.test.ts` /
  `phone-scanner.test.tsx`. Suites: 43 server / 108 client / tsc clean.

## Round 4 — motion, responsiveness, interactions (2026-11-08, spec `2026-11-08-kiosk-motion-responsiveness-design.md`)

Client-only round (no server changes). Files: `kiosk-motion.css` (new —
tokens `--motion-fast/base/stagger/ease`, staggered compare-card/verdict/crown
entrances via `--card-index`, idle attract loop gated on `data-attract`,
zoom/focus/hold keyframes, kiosk breakpoints `≤1024px` (2×2 compare) /
`≤640px` (card carousel) / `≤700px`-height (scrollable content, compressed
chrome), reduced-motion kill switch), `use-count-up.ts` (rAF price count-up,
instant under reduced-motion/no-rAF), `use-hold-progress.ts`
(hold-to-clear guard, one-shot, reholdable after cancel), 
`session-summary.ts` (compareSummary pure helper), tray "↻ Scan again" + 
"Hold to clear" (1.5s), compare cards tap-to-highlight (`data-focus`, single
focus, cleared on Close), kiosk session recap on idle after a comparison
closes ("Compared n bottles · best value X · from → to" + "Compare again",
wiped on any scan/tray change), phone undo (5s window on the newest scan;
`Checked.at` added) and "Show all (n)" once >3 entries; `product-result`
render has a shimmer-free price count-up. Suites: 43 server / 122 client /
tsc clean.
