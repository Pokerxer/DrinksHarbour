# My Account Stored-Value Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the wallet, gift-card, and loyalty pages under `/my-account` — amount-driven gift-card tiers, a gift-card detail page with server-signed QR and redeem-to-wallet, a single filterable wallet transactions panel, a richer loyalty tier ladder, shared UI components, and redemption idempotency hardening.

**Architecture:** The full stack already exists (client pages/hooks, Express controllers/routes, atomic ledger services, models). This is a refinement: add one pure domain helper (gift-card tiers, mirrored client+server), one new client route (gift-card detail), extend three controllers with optional/derived behavior, and de-duplicate client UI. No changes to Paystack init/verify or the atomic `$inc` write paths.

**Tech Stack:** Node/Express + Mongoose (server, Jest tests in `server/__tests__`), Next.js App Router + React + TypeScript + Tailwind (client, `client/apps/platform`), `react-icons/pi` icons, `qrcode` (new server dep).

## Global Constraints

- Gift-card amount tiers (single source of truth, exact bands, NGN):
  - `classic` 1,000–49,999 · `silver` 50,000–199,999 · `gold` 200,000–499,999 · `platinum` 500,000–999,999 · `premium` 1,000,000–4,999,999 · `black` ≥ 5,000,000.
- Gift-card purchase limits: `MIN_AMOUNT` 1,000; `MAX_AMOUNT` 20,000,000 (raised from 200,000).
- Money is whole NGN (no sub-units). Reuse `fmtNgn`/`fmtDate`/`fmtDateTime` from `_components/format.ts`.
- Gift-card QR encodes the **raw signed `qrToken`** (not a URL); tenant-side scan/validate is out of scope.
- All account API endpoints are self-scoped to `req.user._id`; never add cross-user access.
- Red brand accent is Tailwind `red-700`/`red-900` gradients (never hardcoded hex).
- Server tests: `cd server && npx jest <file>`. Client verify: `cd client/apps/platform && npx tsc --noEmit` (compare against pre-change baseline; introduce **no new** errors in touched files).
- Do not change Paystack flows, the atomic ledger services' `$inc` logic, or registration-time referral crediting.

---

### Task 1: Server gift-card tier helper

**Files:**
- Modify: `server/services/giftCard.helpers.js` (add helper + exports)
- Test: `server/__tests__/giftCard.tiers.test.js` (create)

**Interfaces:**
- Produces: `GIFT_CARD_TIERS: Array<{ id, name, minAmount, gradient, textClass, accentClass }>` (ordered ascending by `minAmount`) and `giftCardTierForAmount(amount: number) => tier` (returns the highest tier whose `minAmount <= amount`; clamps below 1,000 to `classic`).

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/giftCard.tiers.test.js`:

```js
const { giftCardTierForAmount, GIFT_CARD_TIERS } = require('../services/giftCard.helpers');

describe('giftCardTierForAmount', () => {
  test('band boundaries map to the right tier', () => {
    expect(giftCardTierForAmount(1000).id).toBe('classic');
    expect(giftCardTierForAmount(49999).id).toBe('classic');
    expect(giftCardTierForAmount(50000).id).toBe('silver');
    expect(giftCardTierForAmount(199999).id).toBe('silver');
    expect(giftCardTierForAmount(200000).id).toBe('gold');
    expect(giftCardTierForAmount(499999).id).toBe('gold');
    expect(giftCardTierForAmount(500000).id).toBe('platinum');
    expect(giftCardTierForAmount(999999).id).toBe('platinum');
    expect(giftCardTierForAmount(1000000).id).toBe('premium');
    expect(giftCardTierForAmount(4999999).id).toBe('premium');
    expect(giftCardTierForAmount(5000000).id).toBe('black');
    expect(giftCardTierForAmount(20000000).id).toBe('black');
  });

  test('sub-minimum amounts clamp to classic', () => {
    expect(giftCardTierForAmount(0).id).toBe('classic');
    expect(giftCardTierForAmount(-5).id).toBe('classic');
  });

  test('GIFT_CARD_TIERS is ordered ascending and every tier has art fields', () => {
    for (let i = 1; i < GIFT_CARD_TIERS.length; i++) {
      expect(GIFT_CARD_TIERS[i].minAmount).toBeGreaterThan(GIFT_CARD_TIERS[i - 1].minAmount);
    }
    for (const t of GIFT_CARD_TIERS) {
      expect(typeof t.gradient).toBe('string');
      expect(t.gradient.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest giftCard.tiers.test.js`
Expected: FAIL — `giftCardTierForAmount is not a function`.

- [ ] **Step 3: Add the helper + exports**

In `server/services/giftCard.helpers.js`, add before `module.exports`:

```js
// Amount-driven gift-card tiers (single source of truth; mirrored client-side in
// gift-cards/_giftCardTiers.ts). The card art + label are derived from the purchase
// amount — higher amounts get more premium styling. Bands are inclusive lower bounds.
const GIFT_CARD_TIERS = [
  { id: 'classic',  name: 'Classic',  minAmount: 1000,    gradient: 'from-stone-800 to-red-900',     textClass: 'text-white',      accentClass: 'text-red-200' },
  { id: 'silver',   name: 'Silver',   minAmount: 50000,   gradient: 'from-slate-400 to-slate-600',   textClass: 'text-white',      accentClass: 'text-slate-100' },
  { id: 'gold',     name: 'Gold',     minAmount: 200000,  gradient: 'from-amber-500 to-yellow-600',  textClass: 'text-stone-900',  accentClass: 'text-amber-900' },
  { id: 'platinum', name: 'Platinum', minAmount: 500000,  gradient: 'from-zinc-300 to-zinc-500',     textClass: 'text-stone-900',  accentClass: 'text-zinc-700' },
  { id: 'premium',  name: 'Premium',  minAmount: 1000000, gradient: 'from-indigo-700 to-purple-800', textClass: 'text-white',      accentClass: 'text-indigo-200' },
  { id: 'black',    name: 'Black',    minAmount: 5000000, gradient: 'from-neutral-900 to-black',      textClass: 'text-white',      accentClass: 'text-amber-300' },
];

/**
 * Resolve the tier for a purchase amount: the highest tier whose minAmount <= amount.
 * Amounts below the first band clamp to the first (classic) tier.
 * @returns {object} a GIFT_CARD_TIERS entry.
 */
function giftCardTierForAmount(amount) {
  const n = Number(amount) || 0;
  let tier = GIFT_CARD_TIERS[0];
  for (const t of GIFT_CARD_TIERS) {
    if (n >= t.minAmount) tier = t;
  }
  return tier;
}
```

Add both to the `module.exports = { ... }` object: `GIFT_CARD_TIERS,` and `giftCardTierForAmount,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest giftCard.tiers.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/giftCard.helpers.js server/__tests__/giftCard.tiers.test.js
git commit -m "feat(giftcard): amount-driven tier helper (Classic→Black)"
```

---

### Task 2: Raise purchase cap + stamp tier on issue

**Files:**
- Modify: `server/models/GiftCard.js` (add `design.tier`)
- Modify: `server/controllers/giftcard.controller.js:27` (`MAX_AMOUNT`)
- Modify: `server/services/giftCard.service.js` (stamp `design.tier` in `issueGiftCard`)
- Test: `server/__tests__/giftCard.issue.tier.test.js` (create)

**Interfaces:**
- Consumes: `giftCardTierForAmount` from Task 1.
- Produces: issued cards carry `design.tier` (a tier id string); controller rejects amounts `> 20,000,000`.

- [ ] **Step 1: Add `design.tier` to the model**

In `server/models/GiftCard.js`, in the `design` sub-doc (currently `templateId`, `theme`), add:

```js
    design: {
      templateId: { type: String, trim: true },
      theme:      { type: String, trim: true },
      tier:       { type: String, trim: true }, // derived amount-tier id, stamped on issue
    },
```

- [ ] **Step 2: Raise the purchase ceiling**

In `server/controllers/giftcard.controller.js`, change line 27:

```js
const MAX_AMOUNT = 20000000; // NGN — ceiling for the top "Black" (≥₦5M) tier; Paystack/fraud sanity cap
```

- [ ] **Step 3: Stamp the tier on issue**

In `server/services/giftCard.service.js`, add to the imports from `./giftCard.helpers` (the existing destructure near the top):

```js
  giftCardTierForAmount,
```

Then in `issueGiftCard`, immediately before `await card.save();`, add:

```js
  card.design = { ...(card.design ? card.design.toObject?.() ?? card.design : {}), tier: giftCardTierForAmount(card.initialAmount).id };
```

- [ ] **Step 4: Write the failing test**

Create `server/__tests__/giftCard.issue.tier.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const GiftCard = require('../models/GiftCard');
const { issueGiftCard } = require('../services/giftCard.service');

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
afterEach(async () => { await GiftCard.deleteMany({}); });

test('issued card stores the amount tier on design.tier', async () => {
  const card = await GiftCard.create({ initialAmount: 1000000, balance: 0, status: 'pending_payment' });
  const res = await issueGiftCard({ giftCardId: card._id, paymentRef: 'ref-1', createdBy: card._id });
  expect(res.ok).toBe(true);
  const saved = await GiftCard.findById(card._id).lean();
  expect(saved.design.tier).toBe('premium');
  expect(saved.status).toBe('active');
});
```

> Note: `mongodb-memory-server` is already used by existing suites (e.g. `server/__tests__/platformServices.test.js`, `salesOrder.*.test.js`). Follow the Mongo bootstrap in `platformServices.test.js` rather than re-declaring your own if it exposes a shared harness.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest giftCard.issue.tier.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/models/GiftCard.js server/controllers/giftcard.controller.js server/services/giftCard.service.js server/__tests__/giftCard.issue.tier.test.js
git commit -m "feat(giftcard): raise purchase cap to ₦20M and stamp amount tier on issue"
```

---

### Task 3: Expose server-signed QR image on the detail endpoint

**Files:**
- Modify: `server/package.json` (add `qrcode`)
- Modify: `server/controllers/giftcard.controller.js` (`getGiftCard` returns `qrDataUrl` + `qrToken`)
- Test: `server/__tests__/giftCard.detail.qr.test.js` (create)

**Interfaces:**
- Produces: `GET /api/gift-cards/:id` response gains `qrDataUrl` (a `data:image/png;base64,...` string, or `null` when the card has no `qrToken`) and `qrToken`.

- [ ] **Step 1: Add the dependency**

Run: `cd server && npm install qrcode`
Expected: `qrcode` added to `server/package.json` dependencies.

- [ ] **Step 2: Return the QR from the detail endpoint**

In `server/controllers/giftcard.controller.js`, add near the top imports:

```js
const QRCode = require('qrcode');
```

In `getGiftCard`, the query currently uses `.lean()`. Change it to also load `qrToken`, and build the image. Replace the `const card = await GiftCard.findOne(...).lean();` line with:

```js
  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id }).lean();
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });

  // Render the signed QR token to a scannable image (owner-only; endpoint is scoped).
  let qrDataUrl = null;
  if (card.qrToken) {
    try { qrDataUrl = await QRCode.toDataURL(card.qrToken, { margin: 1, width: 240 }); }
    catch { qrDataUrl = null; }
  }
```

(Delete the now-duplicated original `card`/404 lines.) Then in the `successResponse(res, { ... })` payload for this handler, add these two fields alongside `status`:

```js
    qrToken: card.qrToken || null,
    qrDataUrl,
```

- [ ] **Step 3: Write the failing test**

Create `server/__tests__/giftCard.detail.qr.test.js`:

```js
const QRCode = require('qrcode');

test('QRCode.toDataURL produces a PNG data URL for a token', async () => {
  const url = await QRCode.toDataURL('DHGC-TESTTOKEN', { margin: 1, width: 240 });
  expect(url.startsWith('data:image/png;base64,')).toBe(true);
});
```

> This proves the encoding contract the controller relies on. A fuller HTTP-level test can be added if the repo has a request harness for gift-card routes; follow that harness if present.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest giftCard.detail.qr.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/controllers/giftcard.controller.js server/__tests__/giftCard.detail.qr.test.js
git commit -m "feat(giftcard): return server-signed QR image from detail endpoint"
```

---

### Task 4: Redemption idempotency guards (loyalty + gift card)

**Files:**
- Modify: `server/controllers/loyalty.controller.js` (`redeemLoyaltyPoints`)
- Modify: `server/controllers/giftcard.controller.js` (`redeemMyGiftCard`)
- Test: `server/__tests__/redeem.idempotency.test.js` (create)

**Interfaces:**
- Consumes: existing `mutatePlatformLoyalty`, `mutatePlatformWallet`, `redeemGiftCard`.
- Produces: a duplicate redeem for the same `(user, amount)` / `(card, amount)` within a 10s window returns the already-applied balances instead of applying a second time.

**Why a window guard, not a unique index:** neither `PlatformLoyaltyTransaction` nor `GiftCardTransaction` has a unique `reference` index, and referral awards deliberately reuse one `reference` string across two different users — so a unique index would break referrals. A localized short-window dedup in the redeem controllers defeats the double-click threat without schema changes.

- [ ] **Step 1: Guard the loyalty redeem**

In `server/controllers/loyalty.controller.js`, inside `redeemLoyaltyPoints`, immediately after the `amountNgn` check block (right before `// Debit the points atomically.`), add:

```js
  // Idempotency: reject an accidental duplicate of the same redeem within a short
  // window (double-click / retry). A legitimate repeat redeem after the window is fine.
  const DUP_WINDOW_MS = 10000;
  const recent = await PlatformLoyaltyTransaction.find({
    userId: req.user._id,
    type: 'redeem',
    createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
  }).lean();
  if (recent.some(t => Math.abs(t.points) === n)) {
    const u = await User.findById(req.user._id).select('loyaltyPoints platformWalletBalance');
    return successResponse(res, {
      pointsRedeemed: n,
      amountCredited: amountNgn,
      pointsBalance: u.loyaltyPoints,
      walletBalance: u.platformWalletBalance,
      alreadyProcessed: true,
    }, 'Redemption already processed');
  }
```

- [ ] **Step 2: Guard the gift-card redeem**

In `server/controllers/giftcard.controller.js`, inside `redeemMyGiftCard`, immediately after the `card` lookup + 404 check (before `// Debit the card.`), add:

```js
  // Idempotency: reject an accidental duplicate redeem of the same amount off the
  // same card within a short window (double-click / retry).
  const DUP_WINDOW_MS = 10000;
  const recentDup = await GiftCardTransaction.findOne({
    giftCardId: card._id,
    type: 'redeem',
    amount: n,
    createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
  }).lean();
  if (recentDup) {
    const fresh = await GiftCard.findById(card._id).select('balance status').lean();
    const u = await require('../models/User').findById(req.user._id).select('platformWalletBalance').lean();
    return successResponse(res, {
      cardBalance: fresh.balance,
      cardStatus: fresh.status,
      walletBalance: u.platformWalletBalance,
      alreadyProcessed: true,
    }, 'Redemption already processed');
  }
```

- [ ] **Step 3: Write the failing test**

Create `server/__tests__/redeem.idempotency.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');

let mongo;
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
afterEach(async () => { await GiftCard.deleteMany({}); await GiftCardTransaction.deleteMany({}); });

test('a recent duplicate gift-card redeem row is detectable within the window', async () => {
  const card = await GiftCard.create({ initialAmount: 5000, balance: 5000, status: 'active' });
  await GiftCardTransaction.create({ giftCardId: card._id, type: 'redeem', amount: 1000, balanceAfter: 4000 });

  const DUP_WINDOW_MS = 10000;
  const dup = await GiftCardTransaction.findOne({
    giftCardId: card._id, type: 'redeem', amount: 1000,
    createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
  }).lean();
  expect(dup).not.toBeNull();

  const noDup = await GiftCardTransaction.findOne({
    giftCardId: card._id, type: 'redeem', amount: 2000,
    createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
  }).lean();
  expect(noDup).toBeNull();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest redeem.idempotency.test.js`
Expected: PASS.

- [ ] **Step 5: Run the existing gift-card + loyalty suites to confirm no regression**

Run: `cd server && npx jest giftCard loyalty platformLoyalty`
Expected: PASS (existing suites still green).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/loyalty.controller.js server/controllers/giftcard.controller.js server/__tests__/redeem.idempotency.test.js
git commit -m "fix(stored-value): short-window idempotency guard on loyalty & gift-card redeem"
```

---

### Task 5: Wallet transaction filters (server + hook)

**Files:**
- Modify: `server/controllers/wallet.controller.js` (`getWalletTransactions`)
- Modify: `client/apps/platform/src/app/my-account/_hooks/useWallet.ts`
- Test: `server/__tests__/wallet.transactions.filter.test.js` (create)

**Interfaces:**
- Produces: `GET /api/wallet/transactions` accepts optional `type` (`credit|debit|refund|adjustment`), `from`, `to` (ISO dates). Absent/invalid values are ignored (behavior unchanged).
- `useWallet().fetchTransactions(page?, opts?)` where `opts?: { type?: string; from?: string; to?: string }`.

- [ ] **Step 1: Add an exported filter-builder helper (single source of truth)**

The filter logic must be tested without an HTTP harness, so extract it as an exported pure
function the controller and the test both import (no duplicated logic block).

In `server/controllers/wallet.controller.js`, add near the top (after the imports):

```js
/**
 * Build the Mongo filter for a user's wallet-transaction query from optional
 * `type`/`from`/`to` request params. Unknown/invalid values are ignored.
 */
function buildTransactionFilter(userId, { type, from, to } = {}) {
  const filter = { userId };
  if (['credit', 'debit', 'refund', 'adjustment'].includes(type)) filter.type = type;
  const createdAt = {};
  if (from) { const d = new Date(from); if (!Number.isNaN(d.getTime())) createdAt.$gte = d; }
  if (to)   { const d = new Date(to);   if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); createdAt.$lte = d; } }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}
```

In `getWalletTransactions`, replace `const filter = { userId: req.user._id };` with:

```js
  const filter = buildTransactionFilter(req.user._id, req.query);
```

And add `buildTransactionFilter` to `module.exports` alongside the existing handlers.

- [ ] **Step 2: Write the failing test (imports the helper — no duplication)**

Create `server/__tests__/wallet.transactions.filter.test.js`:

```js
const { buildTransactionFilter } = require('../controllers/wallet.controller');

test('valid type is applied, invalid type ignored', () => {
  expect(buildTransactionFilter('u1', { type: 'credit' }).type).toBe('credit');
  expect(buildTransactionFilter('u1', { type: 'bogus' }).type).toBeUndefined();
});

test('date range builds a createdAt window; absent dates omit it', () => {
  const f = buildTransactionFilter('u1', { from: '2026-01-01', to: '2026-01-31' });
  expect(f.createdAt.$gte).toBeInstanceOf(Date);
  expect(f.createdAt.$lte).toBeInstanceOf(Date);
  expect(buildTransactionFilter('u1', {}).createdAt).toBeUndefined();
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd server && npx jest wallet.transactions.filter.test.js`
Expected: PASS.

- [ ] **Step 4: Thread filter params through the hook**

In `client/apps/platform/src/app/my-account/_hooks/useWallet.ts`, change the `fetchTransactions` signature in the `UseWalletReturn` interface to:

```ts
  fetchTransactions: (page?: number, opts?: { type?: string; from?: string; to?: string }) => Promise<void>;
```

And replace the `fetchTransactions` implementation body's URL build:

```ts
  const fetchTransactions = useCallback(async (page = 1, opts: { type?: string; from?: string; to?: string } = {}) => {
    if (!token) return;
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (opts.type && opts.type !== 'all') params.set('type', opts.type);
      if (opts.from) params.set('from', opts.from);
      if (opts.to) params.set('to', opts.to);
      const res = await fetchWithAuth(`${API_URL}/api/wallet/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      const payload = data.data ?? data;
      setTransactions(payload.items || []);
      setTxPage(payload.pagination?.page || 1);
      setTxTotalPages(payload.pagination?.totalPages || 1);
    } catch { /* keep existing */ }
    finally { setTxLoading(false); }
  }, [token]);
```

- [ ] **Step 5: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors referencing `useWallet.ts`.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/wallet.controller.js server/__tests__/wallet.transactions.filter.test.js client/apps/platform/src/app/my-account/_hooks/useWallet.ts
git commit -m "feat(wallet): optional type/date filters on transactions endpoint + hook"
```

---

### Task 6: Client gift-card tier module

**Files:**
- Create: `client/apps/platform/src/app/my-account/gift-cards/_giftCardTiers.ts`

**Interfaces:**
- Produces: `GIFT_CARD_TIERS`, `giftCardTierForAmount(amount)`, and `GiftCardTier` type — the client mirror of the server helper (identical bands/ids). Adds `label` alias for display.

- [ ] **Step 1: Create the module**

Create `client/apps/platform/src/app/my-account/gift-cards/_giftCardTiers.ts`:

```ts
// Amount-driven gift-card tiers — the client mirror of server/services/giftCard.helpers.js
// (GIFT_CARD_TIERS / giftCardTierForAmount). Keep the bands + ids in sync with the server.
// The card art + label are derived from the purchase amount; higher amounts get more
// premium styling. Bands are inclusive lower bounds (NGN).

export interface GiftCardTier {
  id: 'classic' | 'silver' | 'gold' | 'platinum' | 'premium' | 'black';
  name: string;
  minAmount: number;
  gradient: string;    // tailwind gradient stops, e.g. "from-stone-800 to-red-900"
  textClass: string;   // foreground text colour for the card art
  accentClass: string; // secondary/label colour on the card art
}

export const GIFT_CARD_TIERS: GiftCardTier[] = [
  { id: 'classic',  name: 'Classic',  minAmount: 1000,    gradient: 'from-stone-800 to-red-900',     textClass: 'text-white',     accentClass: 'text-red-200' },
  { id: 'silver',   name: 'Silver',   minAmount: 50000,   gradient: 'from-slate-400 to-slate-600',   textClass: 'text-white',     accentClass: 'text-slate-100' },
  { id: 'gold',     name: 'Gold',     minAmount: 200000,  gradient: 'from-amber-500 to-yellow-600',  textClass: 'text-stone-900', accentClass: 'text-amber-900' },
  { id: 'platinum', name: 'Platinum', minAmount: 500000,  gradient: 'from-zinc-300 to-zinc-500',     textClass: 'text-stone-900', accentClass: 'text-zinc-700' },
  { id: 'premium',  name: 'Premium',  minAmount: 1000000, gradient: 'from-indigo-700 to-purple-800', textClass: 'text-white',     accentClass: 'text-indigo-200' },
  { id: 'black',    name: 'Black',    minAmount: 5000000, gradient: 'from-neutral-900 to-black',      textClass: 'text-white',     accentClass: 'text-amber-300' },
];

/** Highest tier whose minAmount <= amount; clamps below the first band to `classic`. */
export function giftCardTierForAmount(amount: number): GiftCardTier {
  const n = Number(amount) || 0;
  let tier = GIFT_CARD_TIERS[0];
  for (const t of GIFT_CARD_TIERS) {
    if (n >= t.minAmount) tier = t;
  }
  return tier;
}

/** Resolve a tier from a stored id (falls back to amount-derived, then classic). */
export function giftCardTierById(id?: string, amount = 0): GiftCardTier {
  return GIFT_CARD_TIERS.find(t => t.id === id) || giftCardTierForAmount(amount);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add client/apps/platform/src/app/my-account/gift-cards/_giftCardTiers.ts
git commit -m "feat(giftcard): client gift-card tier module mirroring server bands"
```

---

### Task 7: Shared InlineAlert component

**Files:**
- Create: `client/apps/platform/src/app/my-account/_components/InlineAlert.tsx`

**Interfaces:**
- Produces: `<InlineAlert variant="info|success|error|pending" spinning?={boolean}>{children}</InlineAlert>` — the shared verify/status banner used by the wallet and gift-card pages.

- [ ] **Step 1: Create the component**

Create `client/apps/platform/src/app/my-account/_components/InlineAlert.tsx`:

```tsx
'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

type Variant = 'info' | 'success' | 'error' | 'pending';

const STYLES: Record<Variant, string> = {
  info:    'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  error:   'bg-red-50 border-red-200 text-red-700',
  pending: 'bg-blue-50 border-blue-200 text-blue-700',
};

export default function InlineAlert({
  variant, spinning = false, children,
}: { variant: Variant; spinning?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-4 flex items-center gap-3 border ${STYLES[variant]}`}>
      {spinning
        ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin flex-shrink-0" />
        : <Icon.PiCheckCircleBold size={16} className="flex-shrink-0" />}
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add client/apps/platform/src/app/my-account/_components/InlineAlert.tsx
git commit -m "feat(my-account): shared InlineAlert banner for wallet/gift-card pages"
```

---

### Task 8: Gift-cards list page — tier art, drop theme picker, new limits

**Files:**
- Modify: `client/apps/platform/src/app/my-account/gift-cards/page.tsx`
- Modify: `client/apps/platform/src/app/my-account/_types.ts` (extend `GiftCardItem.design`)

**Interfaces:**
- Consumes: `giftCardTierForAmount`, `giftCardTierById` (Task 6); `InlineAlert` (Task 7); shared `StatCard`.
- Produces: list page whose card art is amount-tier driven; purchase modal has no theme picker, presets span to ₦5M, and validates against the ₦1,000–₦20,000,000 band.

- [ ] **Step 1: Extend the `GiftCardItem.design` type**

In `client/apps/platform/src/app/my-account/_types.ts`, change the `GiftCardItem.design` field to include the tier id:

```ts
  design?: { templateId?: string; theme?: string; tier?: string };
```

- [ ] **Step 2: Rewrite the preview + purchase modal to be tier-driven**

In `gift-cards/page.tsx`:

- Replace the `THEMES` constant and the `PRESETS` constant with:

```tsx
const PRESETS = [5000, 25000, 100000, 500000, 1000000, 5000000];
const MIN_GC = 1000;
const MAX_GC = 20000000;
```

- Replace `GiftCardPreview` with a tier-driven version:

```tsx
import { giftCardTierForAmount, giftCardTierById } from './_giftCardTiers';

function GiftCardPreview({ amount, tierId, code }: { amount: number; tierId?: string; code?: string }) {
  const t = giftCardTierById(tierId, amount);
  return (
    <div className={`rounded-2xl p-5 bg-gradient-to-br ${t.gradient} ${t.textClass} shadow-lg aspect-[1.6/1] flex flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[10px] uppercase tracking-widest font-bold ${t.accentClass}`}>DrinksHarbour · {t.name}</p>
          <p className="text-2xl font-black mt-1">{fmtNgn(amount)}</p>
        </div>
        <Icon.PiGiftBold size={22} className="opacity-60" />
      </div>
      <div className="flex items-end justify-between">
        <p className="font-mono text-sm tracking-wider">{code || 'DHGC-••••-••••-••••'}</p>
        <p className="text-[10px] opacity-70">Gift Card</p>
      </div>
    </div>
  );
}
```

- In `GiftCardPurchaseModal`: remove the `theme`/`setTheme` state and the entire "Design" theme-picker block. Compute the live tier from the amount and show its name. Update `handleBuy` validation + payload:

```tsx
  const finalAmount = custom ? Number(custom) : amount;
  const tier = giftCardTierForAmount(finalAmount || 0);

  const handleBuy = async () => {
    const n = Number(finalAmount);
    if (!Number.isInteger(n) || n < MIN_GC || n > MAX_GC) {
      setError(`Enter a whole amount between ${fmtNgn(MIN_GC)} and ${fmtNgn(MAX_GC)}`); return;
    }
    if (forSomeone && recipient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) { setError('Recipient email is invalid'); return; }
    setSubmitting(true); setError(null);
    const res = await onPurchase({
      amount: n,
      recipient: forSomeone ? {
        email: recipient.email || undefined,
        name: recipient.name || undefined,
        message: recipient.message || undefined,
      } : undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.message || 'Failed to start purchase'); return; }
    if (res.authUrl) window.location.href = res.authUrl;
  };
```

- Under the amount inputs (where the Design picker used to be), add a live tier line:

```tsx
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500">This is a</span>
              <span className={`px-2 py-1 rounded-full font-bold bg-gradient-to-br ${tier.gradient} ${tier.textClass}`}>{tier.name}</span>
              <span className="text-stone-500">gift card</span>
            </div>
```

- Update the custom-amount input `max`: `max={MAX_GC}`.
- Update the Preview call: `<GiftCardPreview amount={finalAmount || amount} tierId={tier.id} />`.

- [ ] **Step 3: Update `GiftCardTile` + list page to use tier art, InlineAlert, StatCard, and link to detail**

- In `GiftCardTile`, replace the `theme` derivation and preview with:

```tsx
import Link from 'next/link';
// ...
  const tier = card.design?.tier;
  return (
    <Link href={`/my-account/gift-cards/${card._id}`} className="block bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <GiftCardPreview amount={card.initialAmount} tierId={tier} code={card.code || undefined} />
      {/* ...existing body (status badge, balance, copy-code) unchanged... */}
    </Link>
  );
```

Keep the copy-code button, but since the tile is now a `Link`, wrap the copy handler with `e.preventDefault(); e.stopPropagation();` inside `copy` so tapping it doesn't navigate.

- Replace the two `verifying`/`verifyMsg` banner blocks with `InlineAlert`:

```tsx
import InlineAlert from '../_components/InlineAlert';
// ...
      {verifying && <InlineAlert variant="pending" spinning>Verifying your gift-card purchase…</InlineAlert>}
      {verifyMsg && <InlineAlert variant={verifyMsg.ok ? 'success' : 'error'}>{verifyMsg.text}</InlineAlert>}
```

- Replace the local `StatCardInline` usages with the shared `StatCard` and delete the `StatCardInline` function:

```tsx
import StatCard from '../_components/StatCard';
// ...
        <StatCard icon={Icon.PiGiftBold} label="Total Cards" value={cards.length} color="bg-purple-50 text-purple-700" loading={loading} />
        <StatCard icon={Icon.PiCheckCircleBold} label="Active" value={activeCount} color="bg-green-50 text-green-700" loading={loading} />
        <StatCard icon={Icon.PiWalletBold} label="Total Value" value={fmtNgn(totalValue)} color="bg-amber-50 text-amber-700" loading={loading} />
```

- [ ] **Step 4: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors in `gift-cards/page.tsx` or `_types.ts`.

- [ ] **Step 5: Commit**

```bash
git add client/apps/platform/src/app/my-account/gift-cards/page.tsx client/apps/platform/src/app/my-account/_types.ts
git commit -m "feat(giftcard): amount-tier card art, remove theme picker, ₦20M cap, detail links"
```

---

### Task 9: Gift-card detail page

**Files:**
- Create: `client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx`
- Modify: `client/apps/platform/src/app/my-account/_types.ts` (add `qrDataUrl`/`qrToken` to the detail shape if typed)

**Interfaces:**
- Consumes: `useGiftCardDetail(token, id)` (already in `_hooks/useGiftCards.ts`), `giftCardTierById`, `InlineAlert`, `fmtNgn`/`fmtDate`/`fmtDateTime`.
- The hook's `card` includes `qrDataUrl` and `qrToken` from Task 3 (accessed via the loosely-typed `summary`/index; cast as needed).

- [ ] **Step 1: Create the detail page**

Create `client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../../AccountShell';
import { useGiftCardDetail } from '../../_hooks/useGiftCards';
import { giftCardTierById } from '../_giftCardTiers';
import InlineAlert from '../../_components/InlineAlert';
import { fmtNgn, fmtDate, fmtDateTime } from '../../_components/format';

const TX_LABEL: Record<string, { label: string; color: string; sign: string }> = {
  issue:      { label: 'Issued',     color: 'text-green-700', sign: '+' },
  redeem:     { label: 'Redeemed',   color: 'text-red-700',   sign: '-' },
  refund:     { label: 'Refund',     color: 'text-blue-700',  sign: '+' },
  adjustment: { label: 'Adjustment', color: 'text-amber-700', sign: '' },
};

export default function GiftCardDetailPage() {
  const { token } = useAccount();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : null;
  const { card, transactions, loading, error, redeem } = useGiftCardDetail(token, id);

  const [redeemAmt, setRedeemAmt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (loading && !card) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" /></div>;
  }
  if (error || !card) {
    return (
      <div className="space-y-4">
        <Link href="/my-account/gift-cards" className="text-sm font-semibold text-red-700 flex items-center gap-1"><Icon.PiArrowLeftBold size={13} /> Back to gift cards</Link>
        <InlineAlert variant="error">{error || 'Gift card not found'}</InlineAlert>
      </div>
    );
  }

  const tier = giftCardTierById(card.design?.tier, card.initialAmount);
  const qrDataUrl = (card as any).qrDataUrl as string | null | undefined;
  const canRedeem = card.status === 'active' && card.balance > 0;
  const maxRedeem = card.balance;

  const copyCode = () => {
    if (!card.code) return;
    navigator.clipboard.writeText(card.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const doRedeem = async () => {
    const n = Math.min(Math.max(Math.floor(redeemAmt), 1), maxRedeem);
    if (n < 1) { setMsg({ ok: false, text: 'Enter an amount to redeem' }); return; }
    setSubmitting(true); setMsg(null);
    const res = await redeem(card._id, n);
    setSubmitting(false);
    if (res.ok) {
      setMsg({ ok: true, text: `${fmtNgn(n)} moved to your wallet — wallet balance ${fmtNgn(res.walletBalance || 0)}` });
      setRedeemAmt(0);
    } else {
      setMsg({ ok: false, text: res.message || 'Redemption failed' });
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/my-account/gift-cards" className="text-sm font-semibold text-red-700 flex items-center gap-1"><Icon.PiArrowLeftBold size={13} /> Back to gift cards</Link>

      {msg && <InlineAlert variant={msg.ok ? 'success' : 'error'}>{msg.text}</InlineAlert>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card art + QR */}
        <div className="space-y-4">
          <div className={`rounded-2xl p-6 bg-gradient-to-br ${tier.gradient} ${tier.textClass} shadow-lg aspect-[1.6/1] flex flex-col justify-between`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-[10px] uppercase tracking-widest font-bold ${tier.accentClass}`}>DrinksHarbour · {tier.name}</p>
                <p className="text-3xl font-black mt-1">{fmtNgn(card.balance)}</p>
                <p className="text-xs opacity-70 mt-0.5">of {fmtNgn(card.initialAmount)}</p>
              </div>
              <Icon.PiGiftBold size={26} className="opacity-60" />
            </div>
            <p className="font-mono text-base tracking-wider">{card.code || 'DHGC-••••-••••-••••'}</p>
          </div>

          {qrDataUrl && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Gift card QR" className="w-40 h-40" />
              <p className="text-xs text-stone-400 mt-2 text-center">Show this at any DrinksHarbour tenant to redeem in store.</p>
            </div>
          )}
        </div>

        {/* Details + redeem */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
            <Row label="Status" value={card.status.replace('_', ' ')} />
            <Row label="Balance" value={`${fmtNgn(card.balance)} / ${fmtNgn(card.initialAmount)}`} />
            <Row label="Expires" value={fmtDate(card.expiresAt)} />
            {card.recipient?.name && <Row label="For" value={card.recipient.name} />}
            {card.code && (
              <button onClick={copyCode} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-stone-600 hover:text-red-700 bg-stone-50 px-3 py-2 rounded-lg">
                {copied ? <Icon.PiCheckBold size={12} className="text-green-600" /> : <Icon.PiCopyBold size={12} />}
                {copied ? 'Copied' : 'Copy code'}
              </button>
            )}
          </div>

          {canRedeem && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
              <h3 className="font-black text-stone-900 text-sm flex items-center gap-2"><Icon.PiWalletBold size={15} className="text-red-700" /> Redeem to wallet</h3>
              <input type="range" min={0} max={maxRedeem} step={100} value={Math.min(redeemAmt, maxRedeem)}
                onChange={e => setRedeemAmt(Number(e.target.value))} className="w-full accent-red-700" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">₦0</span>
                <span className="font-black text-red-700">{fmtNgn(Math.min(redeemAmt, maxRedeem))}</span>
                <button onClick={() => setRedeemAmt(maxRedeem)} className="text-stone-500 hover:text-red-700 font-semibold">Max {fmtNgn(maxRedeem)}</button>
              </div>
              <button onClick={doRedeem} disabled={submitting || redeemAmt < 1}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60">
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon.PiArrowRightBold size={14} />}
                {submitting ? 'Redeeming…' : 'Move to wallet'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100"><h3 className="font-black text-stone-900 text-sm">Activity</h3></div>
            {transactions.length === 0 ? (
              <p className="p-6 text-sm text-stone-400 text-center">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {transactions.map(t => {
                  const m = TX_LABEL[t.type] || TX_LABEL.adjustment;
                  return (
                    <li key={t._id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{m.label}</p>
                        <p className="text-xs text-stone-400">{fmtDateTime(t.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-black ${m.color}`}>{m.sign}{fmtNgn(t.amount)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-semibold text-stone-900 capitalize">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors in `gift-cards/[id]/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/platform/src/app/my-account/gift-cards/\[id\]/page.tsx
git commit -m "feat(giftcard): gift-card detail page with QR + redeem-to-wallet + ledger"
```

---

### Task 10: Wallet page — single filterable transactions panel

**Files:**
- Modify: `client/apps/platform/src/app/my-account/wallet/page.tsx`

**Interfaces:**
- Consumes: `fetchTransactions(page, opts)` (Task 5), `DateRangeFilter`, `InlineAlert`.
- Produces: one "Transactions" panel with a type filter + date range; the old dual-list `showAll` logic is removed.

- [ ] **Step 1: Replace verify banners with InlineAlert**

In `wallet/page.tsx`, add `import InlineAlert from '../_components/InlineAlert';` and replace the two `verifying`/`verifyMsg` blocks with:

```tsx
      {verifying && <InlineAlert variant="pending" spinning>Verifying your payment…</InlineAlert>}
      {verifyMsg && <InlineAlert variant={verifyMsg.ok ? 'success' : 'error'}>{verifyMsg.text}</InlineAlert>}
```

- [ ] **Step 2: Replace the dual list with one filtered panel**

Remove the `showAll` state and both the "Recent Activity" card and the separate "All Transactions" card. Add filter state and a single panel. Add imports: `import DateRangeFilter from '../_components/DateRangeFilter';`.

Add state near the top of `WalletPageInner`:

```tsx
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchTransactions(1, { type: typeFilter, from: dateFrom, to: dateTo }); }, [typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace the two transaction cards (everything from the `Recent Activity` panel through the `showAll && ...` block) with:

```tsx
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 space-y-3">
          <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
            <Icon.PiReceiptBold size={15} className="text-red-700" /> Transactions
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'credit', 'debit', 'refund'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border transition-all ${typeFilter === t ? 'border-red-700 bg-red-50 text-red-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
        </div>
        <WalletTransactionList items={transactions} loading={txLoading} />
        {txTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-stone-100">
            <button disabled={txPage <= 1} onClick={() => fetchTransactions(txPage - 1, { type: typeFilter, from: dateFrom, to: dateTo })}
              className="text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700">← Previous</button>
            <span className="text-xs text-stone-400">Page {txPage} of {txTotalPages}</span>
            <button disabled={txPage >= txTotalPages} onClick={() => fetchTransactions(txPage + 1, { type: typeFilter, from: dateFrom, to: dateTo })}
              className="text-xs font-semibold text-stone-600 disabled:opacity-40 hover:text-red-700">Next →</button>
          </div>
        )}
      </div>
```

Remove the now-unused `showAll` state, the `wallet?.recent` fallback rendering, and the `Link` "View all" button. (Keep the hero card and stat cards.)

- [ ] **Step 3: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors in `wallet/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/app/my-account/wallet/page.tsx
git commit -m "feat(wallet): single filterable transactions panel (type + date), shared alert"
```

---

### Task 11: Loyalty page — tier ladder thresholds + ways to earn

**Files:**
- Modify: `client/apps/platform/src/app/my-account/loyalty/page.tsx`

**Interfaces:**
- Consumes: `loyalty` fields already returned (`lifetimePoints`, `nextTier`, `nextThreshold`, `earnMultiplier`, `redeemRateNgnPerPoint`, `minRedeemPoints`, `redeemStepPoints`) and shared `StatCard`.
- Produces: a tier ladder showing thresholds + unlocked/locked state + "N pts to next", and a "Ways to earn" panel.

- [ ] **Step 1: Add tier thresholds + lock state to the ladder**

In `loyalty/page.tsx`, extend `TIER_META` with a `threshold` (lifetime points) and pass lifetime points into `TierCard`. Update the constant:

```tsx
const TIER_META: Record<LoyaltyTier, { name: string; color: string; bg: string; icon: any; perk: string; threshold: number }> = {
  cork:   { name: 'Cork',   color: 'text-amber-700', bg: 'from-amber-500 to-amber-700', icon: Icon.PiCrownBold, perk: '1× earn rate · standard rewards', threshold: 0 },
  barrel: { name: 'Barrel', color: 'text-blue-700',  bg: 'from-blue-600 to-blue-800',   icon: Icon.PiCrownBold, perk: '1.1× earn rate · early access to drops', threshold: 2500 },
  cellar: { name: 'Cellar', color: 'text-purple-700',bg: 'from-purple-600 to-purple-800',icon: Icon.PiCrownBold, perk: '1.25× earn rate · exclusive tastings', threshold: 7500 },
  vault:  { name: 'Vault',  color: 'text-stone-900', bg: 'from-stone-800 to-stone-950',  icon: Icon.PiCrownBold, perk: '1.5× earn rate · concierge & priority', threshold: 20000 },
};
```

Replace the `TierCard` component with one that shows threshold + lock state:

```tsx
function TierCard({ tier, active, lifetimePoints }: { tier: LoyaltyTier; active: boolean; lifetimePoints: number }) {
  const meta = TIER_META[tier];
  const unlocked = lifetimePoints >= meta.threshold;
  const toGo = Math.max(meta.threshold - lifetimePoints, 0);
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${active ? 'border-red-700 shadow-md' : unlocked ? 'border-stone-200' : 'border-stone-100 opacity-70'}`}>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.bg} flex items-center justify-center text-white mb-3 ${unlocked ? '' : 'grayscale'}`}>
        {unlocked ? <meta.icon size={18} /> : <Icon.PiLockBold size={16} />}
      </div>
      <p className={`font-black ${meta.color}`}>{meta.name}</p>
      <p className="text-xs text-stone-400 mt-0.5">{meta.perk}</p>
      <p className="text-[11px] font-semibold mt-1.5 text-stone-500">
        {active ? 'Current tier' : unlocked ? 'Unlocked' : `${toGo.toLocaleString()} pts to unlock`}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Add a "Ways to earn" panel**

After the "Tier ladder" block (before the "Stats" grid), insert:

```tsx
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <h2 className="font-black text-stone-900 text-sm mb-4 flex items-center gap-2"><Icon.PiInfoBold size={15} className="text-red-700" /> Ways to earn & redeem</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Icon.PiShoppingCartBold, title: 'Earn on every order', body: `${loyalty.earnMultiplier}× points per ₦1 spent at your ${TIER_META[loyalty.tier].name} tier.` },
            { icon: Icon.PiWalletBold, title: 'Redeem to wallet', body: `From ${loyalty.minRedeemPoints} pts, in steps of ${loyalty.redeemStepPoints}, at ₦${loyalty.redeemRateNgnPerPoint.toFixed(2)} per point.` },
            { icon: Icon.PiShareNetworkBold, title: 'Refer friends', body: 'You and your friend each get 500 points on their first order.' },
          ].map(x => (
            <div key={x.title} className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0"><x.icon size={16} /></div>
              <div>
                <p className="text-sm font-bold text-stone-800">{x.title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{x.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Route the stats grid through shared StatCard**

Replace the inline stats-grid `.map(...)` block with the shared `StatCard` (add `import StatCard from '../_components/StatCard';`):

```tsx
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Icon.PiCoinsBold} label="Lifetime Points" value={loyalty.lifetimePoints.toLocaleString()} color="bg-amber-50 text-amber-700" />
        <StatCard icon={Icon.PiStarBold} label="Earned" value={(loyalty.summary.earned || 0).toLocaleString()} color="bg-green-50 text-green-700" />
        <StatCard icon={Icon.PiWalletBold} label="Redeemed" value={(loyalty.summary.redeemed || 0).toLocaleString()} color="bg-red-50 text-red-700" />
        <StatCard icon={Icon.PiShareNetworkBold} label="Referral Bonus" value={(loyalty.summary.referralBonus || 0).toLocaleString()} color="bg-purple-50 text-purple-700" />
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors in `loyalty/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add client/apps/platform/src/app/my-account/loyalty/page.tsx
git commit -m "feat(loyalty): tier ladder thresholds/lock state + ways-to-earn panel"
```

---

### Task 12: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole server test suite**

Run: `cd server && npx jest`
Expected: PASS — new tests green, no regressions vs. the pre-change baseline (per memory: ~295/297 with 2 pre-existing SO-number failures; confirm the count matches that baseline plus the new tests).

- [ ] **Step 2: Typecheck the platform client**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: no new errors introduced by any touched file vs. the pre-change baseline.

- [ ] **Step 3: Manual smoke (documented, if a dev server is run)**

Visit `/my-account/wallet` (filter transactions by type + date), `/my-account/gift-cards` (open the purchase modal, watch the tier badge change as the amount crosses band boundaries), click a card → `/my-account/gift-cards/[id]` (QR renders, redeem-to-wallet works), and `/my-account/loyalty` (ladder shows lock/threshold, ways-to-earn shows correct rates).

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test(my-account): stored-value refinement verification pass"
```

---

## Self-Review Notes

- **Spec coverage:** §1 tiers → Tasks 1, 2, 6, 8; §1.2 cap → Task 2; §2 detail page → Task 9; §3 wallet → Tasks 5, 10; §4 QR → Task 3; §5 loyalty → Task 11; §6.1 shared components → Tasks 7, 8, 10, 11; §6.2 idempotency → Task 4; §6.3 tests → Tasks 1–5 + 12; §7 model change → Task 2. All covered.
- **Type consistency:** `giftCardTierForAmount`/`giftCardTierById` (server + client mirror) return the same shape; `fetchTransactions(page, opts)` signature is defined in Task 5 and consumed in Task 10; `InlineAlert` variants are consistent across Tasks 7/8/10/9; `design.tier` added in model (Task 2) and type (Task 8).
- **Out of scope (unchanged):** Paystack init/verify, ledger `$inc` paths, POS scan/validate endpoint, points-expiry scheduler, registration-time referral credit.
