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
