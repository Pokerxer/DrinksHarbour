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

## Round 5 — wedge tuning + phone feedback/detail (2026-11-09)

- **Kiosk wedge** (`scanner.ts`): terminators now `Enter`/`NumpadEnter`/`Tab`;
  **idle decode** fires ~120ms after keystroke silence (client option
  `createScanner({ idleDecodeMs, onIdleDecode })`) — only bursts that look
  like barcodes (≥8 chars, contains a digit after AIM strip) are trusted,
  junk discards quietly; GS1 AIM prefixes `]xx` are stripped on decode
  (`stripAimPrefix`). `use-kiosk.ts` wires `idleDecodeMs: 120` so
  terminator-less wedges "just work". Duplicate-guard (700ms) and 128-cap
  unchanged.
- **Phone**: `mergeScan(results, entry)` dedupes at session level — a re-scan
  of the same barcode moves the existing entry to the top with a fresh
  timestamp instead of adding a duplicate, plus a transient "Already on
  your list" notice server-side of the flash. Capture feedback: haptic
  (`navigator.vibrate(40)`), light-sweep animation over the viewfinder,
  "✓ Scanned" pill (~900ms), green corner flash.
- **Detail sheet** (`phone-detail.tsx`): any result card is now a button-like
  element (role=button, keyboard + Enter/Space) opening a bottom sheet with
  the full record — image, brand, price + savings, tax, size/ABV/volume,
  origin, type, stock pill, barcode. Escape/✕/backdrop dismisses; focus
  lands on ✕ on open. `PhoneResults` gained `onSelect`.
- Tests: wedge cases in `scanner.test.ts`; `mergeScan` + undo + collapse in
  `phone-results.test.tsx`; sheet in `phone-detail.test.tsx`. Suites:
  43 server / 129 client / tsc clean.

## Round 6 — language system, idle-stale, night mode, share (2026-11-09, spec `2026-11-09-round6-design.md`)

- **Language** (`copy.tsx`): `Language` = `en | ha | pig`; ~90-key dictionary in
  all three voices (owner should proofread the Hausa/Pidgin lines — they are
  my translations of the fixed strings); `t(lang, key, vars)` interpolates
  `{name}`-style vars and falls back to English keys.
  `LanguageProvider`/`useCopy()` wraps both surfaces. Kiosk wiring lives in a
  wrapper/`KioskScreen` split (`kiosk.tsx`) so the provider wraps all strings;
  the header pill `EN/HA/PIG` cycles + persists per customer
  (`price-checker-lang-<slug>`, cleared by the stale reset since it's
  sessionStorage). Phone reads `settings.language` from the /session config.
- **Server**: `PriceCheckerKiosk.settings.language` (enum en/ha/pig, default
  'en') — both server `defaults` and the schema field must be updated
  together (the displayDefaults boolean loop no longer catches new strings;
  language lives in `defaults` NOT `displayDefaults`).
- **Idle-stale** (`use-idle-timer.ts useStaleSession(activityKey, onStale)`):
  5 min idle (2 min in compare view) wipes tray + recap via
  `compare.clear()` + `setSummary(null)` + `kiosk.reset()`; armed only while
  content exists; offline scan queue deliberately untouched.
- **Night mode** (`phone-scanner.tsx enableNightMode`): after 15s of camera
  time with zero decodes a "Dim store?" chip appears; one tap = torch on +
  a best-effort `exposureCompensation: 2` constraint (failures silent).
- **Share** (`share.ts shareMessage/buildShareLinks`): the recap gains
  WhatsApp / SMS / Copy buttons (`wa.me/?text=` + `sms:?&body=` encoded;
  clipboard with silent failure). Language-aware message.
- Suites: 44 server / 140 client / tsc clean.

## REMOVED — language system (2026-11-09)

The round-6 language addition (EN/HA/PIG dictionary, switcher, server
`settings.language`) was removed the same day at the owner's request. The
customer-facing copy is back to hard-coded English literals; idle-stale,
night mode, share, and everything from rounds 1–5 are unaffected. Do not
re-introduce `language` into `PriceCheckerKiosk.settings` — `displayDefaults`
booleans auto-flow into the Mongoose schema, so a string setting there
silently becomes a boolean and validation fails (this exact trap bit during
the round-6 build).

## Round 7 — comparison depth (2026-11-10, spec `2026-11-10-compare-depth-design.md`)

Client-only. Full tray never dead-ends and the compare table carries only
decisions:

- **Swap-when-full** (`use-compare.ts`): pure `replaceOldest(items, product)`
  and `replaceByKey(items, product, key)`; the hook gained
  `oldest: first item`, `swapKey`, `armSwap/disarmSwap` — while armed, `add`
  (kiosk OR paired-phone path) replaces that slot in place instead of
  adding, then disarms. Result screen button becomes
  **"Replace oldest — {name}"** when full. Tray thumbs carry a **⇄** button;
  armed swaps show a "Next scan replaces X" banner with Cancel.
- **Differences-only** (`compare-screen.tsx` kiosk-diff-toggle):
  `aria-pressed` toggle hides shared collapsed rows entirely; divergent
  cells carry `data-divergent` (heavier weight + accent tint in CSS). All
  shared → verdict only. Note: perMl/perDrink computed rows treat a single
  bottle's value as shared only when it repeats across bottles
  (`new Set(filtered).size === 1 AND length > 1`), a deliberate fix so a
  2-bottle tray with one volume-bearing bottle doesn't call the ml row shared.
- **Value bars** (`metrics.ts valueRatios`): normalized 0→1 of the tray's
  value metric (per-ml when every in-stock bottle has volumeMl, else price),
  OOS → null. Rendered as `.kiosk-valuebar span[data-length]`; shortest bar
  (cheapest) gets the accent.
- **Stock-aware** (`metrics.ts bestValueRank` update): OUT_OF_STOCK bottles
  rank `Infinity` — no crown, `data-rank` reflects it; OOS cards get
  `.kiosk-compare-oos` (dimmed, grayscale image, struck muted price,
  "Unavailable — pick another").
- Suites: 43 server / 144 client / tsc clean.
