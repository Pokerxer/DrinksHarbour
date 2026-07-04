# Gift Card — Send as Gift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full gifting flow to platform gift cards — buyers can designate any active card as a gift; the recipient gets an email with a secure claim link; they sign in and the card transfers into their account.

**Architecture:** Three new fields (`claimToken`, `claimedBy`, `claimedAt`) on `GiftCard`; two new public claim endpoints and one new protected `send-gift` endpoint; the existing `getMyGiftCards`/`getGiftCard`/`redeemMyGiftCard` endpoints are expanded to support dual ownership (buyer OR claimer). A new public Next.js page at `/gift/[token]` renders the gift and handles the claim flow.

**Tech Stack:** Node.js + Mongoose (server), Next.js 14 App Router + React (client), `crypto.randomUUID()` (claim token), `node:test` (server tests), Tailwind CSS + `react-icons/pi` (client styles).

## Global Constraints

- Server tests use `node:test` + `node:assert` — never Jest.
- All test mocking uses `t.mock.method()` — no `jest.spyOn` or `sinon`.
- `crypto` is already required in `giftCard.service.js` — reuse it; do not add a new import.
- Email is best-effort in all call sites — always wrap in `try/catch`, never block the response.
- Never return `code`, `qrToken`, or `balance` from the public claim GET endpoint.
- Tailwind only — no inline `style=` on client components (except `PremiumGiftCard` which uses it internally).
- Exact file paths must match casing of existing files (`giftcard.controller.js` not `giftCard.controller.js`).
- `optionalProtect` is already exported from `server/middleware/auth.middleware.js` — use it for the public claim GET route.
- The `/gift/[token]` page is outside `/my-account`; it inherits the global layout (Header + Footer) from `app/layout.tsx` automatically.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `server/models/GiftCard.js` | Modify | Add `claimToken`, `claimedBy`, `claimedAt` fields |
| `server/services/giftCard.service.js` | Modify | Generate `claimToken` in `issueGiftCard` when recipient exists |
| `server/services/email.service.js` | Modify | Add `sendGiftCardEmail` function + export it |
| `server/controllers/giftcard.controller.js` | Modify | Add `getGiftCardByClaimToken`, `claimGiftCard`, `sendGiftAsGift`; update `getMyGiftCards`, `getGiftCard`, `redeemMyGiftCard` |
| `server/routes/giftCardClaim.routes.js` | Create | Public claim routes (`GET/POST /api/gift-cards/claim/:token`) |
| `server/routes/giftcard.routes.js` | Modify | Add `POST /:id/send-gift` route |
| `server/server.js` | Modify | Mount `giftCardClaim.routes` before `giftCardRoutes` |
| `server/__tests__/giftCard.claim.test.js` | Create | Tests for `issueGiftCard` token generation + claim controller logic |
| `client/apps/platform/src/app/my-account/_types.ts` | Modify | Add gifting fields to `GiftCardItem` |
| `client/apps/platform/src/app/my-account/_hooks/useGiftCards.ts` | Modify | Add `sendGift` function to `useGiftCards` |
| `client/apps/platform/src/app/gift/[token]/page.tsx` | Create | Public gift landing + claim page |
| `client/apps/platform/src/app/my-account/gift-cards/page.tsx` | Modify | Fix toggle bug; add "Pending claim" / "Gifted" badges to `GiftCardTile` |
| `client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx` | Modify | Gift Status panel, Send as Gift form, recipient note |

---

### Task 1: GiftCard Schema + issueGiftCard Token Generation

**Files:**
- Modify: `server/models/GiftCard.js`
- Modify: `server/services/giftCard.service.js`
- Create: `server/__tests__/giftCard.claim.test.js`

**Interfaces:**
- Produces: `GiftCard` documents with optional `claimToken` (string, unique sparse), `claimedBy` (ObjectId), `claimedAt` (Date)
- Produces: `issueGiftCard` sets `card.claimToken = crypto.randomUUID()` before `card.save()` when `card.recipient?.email` is truthy

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/giftCard.claim.test.js`:

```js
process.env.GIFTCARD_QR_SECRET = process.env.GIFTCARD_QR_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const { issueGiftCard } = require('../services/giftCard.service');

test('issueGiftCard generates claimToken when recipient email is set', async (t) => {
  const card = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending_payment',
    initialAmount: 25000,
    design: undefined,
    recipient: { email: 'friend@example.com', name: 'Friend' },
    claimToken: undefined,
    save: async function () { return this; },
  };

  t.mock.method(GiftCard, 'findById', async () => card);
  t.mock.method(GiftCard, 'findOne', () => ({ select: async () => null }));
  t.mock.method(GiftCardTransaction, 'create', async () => ({}));

  const res = await issueGiftCard({ giftCardId: card._id, paymentRef: 'ref-x', createdBy: card._id });

  assert.strictEqual(res.ok, true);
  assert.ok(typeof card.claimToken === 'string' && card.claimToken.length > 0,
    'claimToken should be set when recipient email is present');
});

test('issueGiftCard does NOT generate claimToken when no recipient', async (t) => {
  const card = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending_payment',
    initialAmount: 25000,
    design: undefined,
    recipient: undefined,
    claimToken: undefined,
    save: async function () { return this; },
  };

  t.mock.method(GiftCard, 'findById', async () => card);
  t.mock.method(GiftCard, 'findOne', () => ({ select: async () => null }));
  t.mock.method(GiftCardTransaction, 'create', async () => ({}));

  const res = await issueGiftCard({ giftCardId: card._id, paymentRef: 'ref-y', createdBy: card._id });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(card.claimToken, undefined, 'claimToken should not be set without a recipient');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test __tests__/giftCard.claim.test.js
```

Expected: FAIL — `claimToken` is undefined in both cases because the logic doesn't exist yet.

- [ ] **Step 3: Add schema fields to GiftCard model**

In `server/models/GiftCard.js`, add after the `paymentRef` field (before `{ timestamps: true }`):

```js
    claimToken: { type: String, unique: true, sparse: true, trim: true },
    claimedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    claimedAt:  { type: Date, default: null },
```

- [ ] **Step 4: Update issueGiftCard to generate claimToken**

In `server/services/giftCard.service.js`, add this block after `if (paymentRef) card.paymentRef = paymentRef;` and before `await card.save()`:

```js
  // Generate a claim token so the buyer can share a gift link with the recipient.
  if (card.recipient?.email && !card.claimToken) {
    card.claimToken = crypto.randomUUID();
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test __tests__/giftCard.claim.test.js
```

Expected: PASS — 2 tests green.

- [ ] **Step 6: Run full suite to check for regressions**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test
```

Expected: all previously passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add server/models/GiftCard.js server/services/giftCard.service.js server/__tests__/giftCard.claim.test.js
git commit -m "feat(giftcard): claimToken/claimedBy schema + issueGiftCard token generation"
```

---

### Task 2: sendGiftCardEmail

**Files:**
- Modify: `server/services/email.service.js`

**Interfaces:**
- Produces: `sendGiftCardEmail(to, { amount, senderName, message, expiresAt, claimLink })` — returns `Promise<{ success: boolean }>`. Added to `module.exports`.

- [ ] **Step 1: Add sendGiftCardEmail before the module.exports block**

In `server/services/email.service.js`, insert the following function immediately before the `module.exports = {` line:

```js
const sendGiftCardEmail = async (to, { amount, senderName, message, expiresAt, claimLink }) => {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(amount);

  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-NG', { dateStyle: 'long' })
    : 'in 12 months';

  const body = `
    <div style="text-align:center;padding:24px 0 8px;">
      <p style="font-size:15px;color:#57534e;margin:0 0 4px 0;">
        <strong style="color:#1c1917;">${senderName || 'Someone'}</strong> sent you a gift card!
      </p>
      <p style="font-size:40px;font-weight:900;color:#c0392b;margin:8px 0 20px 0;">${formattedAmount}</p>
      ${message ? `
      <blockquote style="border-left:3px solid #c0392b;margin:0 auto 24px;padding:10px 16px;font-style:italic;color:#44403c;max-width:340px;text-align:left;">
        "${message}"
      </blockquote>` : ''}
      <p style="font-size:13px;color:#78716c;margin:0 0 28px 0;">
        Redeemable at any store on DrinksHarbour. Expires ${expiryStr}.
      </p>
      <a href="${claimLink}"
         style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;">
        Claim Your Gift
      </a>
      <p style="font-size:11px;color:#a8a29e;margin:20px 0 0 0;">
        Or copy this link into your browser:<br/>${claimLink}
      </p>
    </div>
  `;

  const html = emailShell({
    accentColor: '#c0392b',
    accentLabel: `You received a gift card worth ${formattedAmount}`,
    accentSubtitle: `From ${senderName || 'a friend'} on DrinksHarbour`,
    body,
    footerNote: 'Need help? Email support@drinksharbour.com',
  });

  return sendEmail({
    to,
    subject: `🎁 ${senderName || 'Someone'} sent you a ${formattedAmount} DrinksHarbour gift card!`,
    html,
  });
};
```

- [ ] **Step 2: Export the new function**

In `server/services/email.service.js`, add `sendGiftCardEmail` to the `module.exports` object:

```js
module.exports = {
  sendEmail,
  sendOrderConfirmationToCustomer,
  sendNewOrderNotificationToTenant,
  sendNewOrderNotificationToAdmin,
  sendVerificationCodeEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendPurchaseOrderToVendor,
  sendGiftCardEmail,
};
```

- [ ] **Step 3: Verify the server starts without errors**

```bash
cd /Users/mac/Documents/drinksharbour/server
node -e "const e = require('./services/email.service'); console.log(typeof e.sendGiftCardEmail);"
```

Expected output: `function`

- [ ] **Step 4: Commit**

```bash
git add server/services/email.service.js
git commit -m "feat(email): add sendGiftCardEmail with claim link support"
```

---

### Task 3: Server Controller — Claim + Send-Gift + Updated Ownership Logic

**Files:**
- Modify: `server/controllers/giftcard.controller.js`

**Interfaces:**
- Produces: `getGiftCardByClaimToken(req, res)` — public handler; reads `req.params.token`
- Produces: `claimGiftCard(req, res)` — protected handler; reads `req.params.token`, `req.user._id`
- Produces: `sendGiftAsGift(req, res)` — protected handler; reads `req.params.id`, `req.body.{ email, name, message }`
- Modified: `getMyGiftCards` — query expands to `purchasedBy === me OR claimedBy === me`; adds `purchasedByMe` flag; only returns `claimToken` to buyer
- Modified: `getGiftCard` — dual-access check; adds `purchasedByMe`, `claimToken` (buyer only), `claimedAt`
- Modified: `redeemMyGiftCard` — blocks buyer from redeeming if `claimToken` is set

- [ ] **Step 1: Add the three new controller functions**

Add the following three functions to `server/controllers/giftcard.controller.js` before the `module.exports` block:

```js
/**
 * @desc    Public: look up a gift card by its claim token (no code/balance exposed).
 * @route   GET /api/gift-cards/claim/:token
 * @access  Public
 */
const getGiftCardByClaimToken = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ claimToken: req.params.token })
    .select('initialAmount currency design recipient claimedBy status')
    .lean();
  if (!card) return res.status(404).json({ success: false, message: 'Gift not found' });
  if (card.claimedBy) {
    return successResponse(res, { alreadyClaimed: true }, 'Gift already claimed');
  }
  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'This gift card is no longer active' });
  }
  successResponse(res, {
    amount: card.initialAmount,
    currency: card.currency,
    tier: card.design?.tier || null,
    senderName: card.recipient?.name || null,
    message: card.recipient?.message || null,
    alreadyClaimed: false,
  }, 'Gift card info retrieved');
});

/**
 * @desc    Claim a gift card by token — links it to the authenticated user's account.
 * @route   POST /api/gift-cards/claim/:token
 * @access  Private (customer)
 */
const claimGiftCard = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ claimToken: req.params.token })
    .select('_id purchasedBy claimedBy status')
    .lean();
  if (!card) return res.status(404).json({ success: false, message: 'Gift not found' });
  if (card.claimedBy) {
    return res.status(400).json({ success: false, message: 'This gift has already been claimed' });
  }
  if (String(card.purchasedBy) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot claim your own gift card' });
  }
  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'This gift card is no longer active' });
  }

  // Atomic update: only succeeds if still unclaimed (race-safe).
  const result = await GiftCard.updateOne(
    { _id: card._id, claimedBy: null },
    { $set: { claimedBy: req.user._id, claimedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    return res.status(400).json({ success: false, message: 'This gift has already been claimed' });
  }

  successResponse(res, { giftCardId: card._id }, 'Gift card claimed successfully');
});

/**
 * @desc    Send (or resend) a gift notification email for a card the buyer owns.
 *          Also works on self-bought cards that weren't originally gifted.
 * @route   POST /api/gift-cards/:id/send-gift
 * @access  Private (buyer only)
 */
const sendGiftAsGift = asyncHandler(async (req, res) => {
  const { email, name, message } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'A valid recipient email is required' });
  }

  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id });
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });
  if (card.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Only active cards can be gifted' });
  }
  if (card.claimedBy) {
    return res.status(400).json({ success: false, message: 'This card has already been claimed' });
  }

  // Generate token only if not already set (resend reuses existing token so old links stay valid).
  if (!card.claimToken) card.claimToken = require('crypto').randomUUID();

  card.recipient = {
    email: email.toLowerCase().trim(),
    name: name ? String(name).trim() : undefined,
    message: message ? String(message).trim().slice(0, 280) : undefined,
  };
  await card.save();

  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  try {
    if (emailService?.sendGiftCardEmail) {
      await emailService.sendGiftCardEmail(card.recipient.email, {
        amount: card.initialAmount,
        senderName: req.user.firstName,
        message: card.recipient.message,
        expiresAt: card.expiresAt,
        claimLink: `${frontendUrl}/gift/${card.claimToken}`,
      });
    }
  } catch { /* non-fatal */ }

  successResponse(res, {
    claimToken: card.claimToken,
    recipientEmail: card.recipient.email,
  }, 'Gift notification sent');
});
```

- [ ] **Step 2: Update getMyGiftCards for dual ownership**

Replace the body of `getMyGiftCards` with:

```js
const getMyGiftCards = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const cards = await GiftCard.find({
    $or: [{ purchasedBy: me }, { claimedBy: me }],
  }).sort({ createdAt: -1 }).lean();

  successResponse(res, cards.map(c => {
    const isBuyer = String(c.purchasedBy) === String(me);
    return {
      _id: c._id,
      code: c.code ? formatGiftCardCode(c.code) : null,
      cardNumber: c.cardNumber ? formatCardNumber(c.cardNumber) : null,
      initialAmount: c.initialAmount,
      balance: c.balance,
      currency: c.currency,
      status: c.status,
      recipient: c.recipient,
      design: c.design,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
      purchasedByMe: isBuyer,
      claimToken: isBuyer ? (c.claimToken || null) : undefined,
      claimedBy: c.claimedBy ? String(c.claimedBy) : null,
      claimedAt: c.claimedAt || null,
    };
  }), 'Gift cards retrieved');
});
```

- [ ] **Step 3: Update getGiftCard for dual ownership**

Replace the ownership check in `getGiftCard` (the `GiftCard.findOne` call) with:

```js
  const me = req.user._id;
  const card = await GiftCard.findOne({
    _id: req.params.id,
    $or: [{ purchasedBy: me }, { claimedBy: me }],
  }).lean();
```

And in the `successResponse` call, add these fields to the returned object:

```js
      purchasedByMe: String(card.purchasedBy) === String(me),
      claimToken: String(card.purchasedBy) === String(me) ? (card.qrToken ? null : card.claimToken || null) : undefined,
      claimedBy: card.claimedBy ? String(card.claimedBy) : null,
      claimedAt: card.claimedAt || null,
```

Wait — the above `claimToken` logic is wrong. Replace it with:

```js
      purchasedByMe: String(card.purchasedBy) === String(me),
      claimToken: String(card.purchasedBy) === String(me) ? (card.claimToken || null) : undefined,
      claimedBy: card.claimedBy ? String(card.claimedBy) : null,
      claimedAt: card.claimedAt || null,
```

- [ ] **Step 4: Update redeemMyGiftCard to block gifted cards**

In `redeemMyGiftCard`, replace the ownership check:

```js
  const card = await GiftCard.findOne({ _id: req.params.id, purchasedBy: req.user._id }).select('_id status balance code');
```

with:

```js
  const me = req.user._id;
  const card = await GiftCard.findOne({
    _id: req.params.id,
    $or: [{ purchasedBy: me }, { claimedBy: me }],
  }).select('_id status balance code purchasedBy claimToken');
  if (!card) return res.status(404).json({ success: false, message: 'Gift card not found' });

  // Buyer cannot redeem once the card has been designated as a gift (claimToken set).
  const isBuyer = String(card.purchasedBy) === String(me);
  if (isBuyer && card.claimToken) {
    return res.status(403).json({ success: false, message: 'This card has been gifted and cannot be redeemed by the buyer' });
  }
```

Remove the `if (!card)` check that was immediately after the old findOne (it's now above).

- [ ] **Step 5: Export the new functions**

Add the three new functions to `module.exports` in `giftcard.controller.js`:

```js
module.exports = {
  getMyGiftCards,
  getGiftCard,
  purchaseGiftCard,
  verifyPurchaseGiftCard,
  completeGiftCardPayment,
  redeemMyGiftCard,
  payWithGiftCard,
  checkGiftCard,
  getGiftCardByClaimToken,
  claimGiftCard,
  sendGiftAsGift,
};
```

- [ ] **Step 6: Sanity-check the controller loads**

```bash
cd /Users/mac/Documents/drinksharbour/server
node -e "const c = require('./controllers/giftcard.controller'); console.log(Object.keys(c).join(', '));"
```

Expected output includes: `getGiftCardByClaimToken, claimGiftCard, sendGiftAsGift`

- [ ] **Step 7: Commit**

```bash
git add server/controllers/giftcard.controller.js
git commit -m "feat(giftcard): claim + send-gift controllers; dual-ownership on list/detail/redeem"
```

---

### Task 4: Routes + Server Mount + Integration Test

**Files:**
- Create: `server/routes/giftCardClaim.routes.js`
- Modify: `server/routes/giftcard.routes.js`
- Modify: `server/server.js`
- Create: `server/__tests__/giftCard.claimRoute.test.js`

**Interfaces:**
- Produces: `GET /api/gift-cards/claim/:token` — public (uses `optionalProtect`)
- Produces: `POST /api/gift-cards/claim/:token` — protected
- Produces: `POST /api/gift-cards/:id/send-gift` — protected, buyer only

- [ ] **Step 1: Write the failing integration test**

Create `server/__tests__/giftCard.claimRoute.test.js`:

```js
process.env.GIFTCARD_QR_SECRET = process.env.GIFTCARD_QR_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const GiftCard = require('../models/GiftCard');
const {
  getGiftCardByClaimToken,
  claimGiftCard,
  sendGiftAsGift,
} = require('../controllers/giftcard.controller');

function mockRes() {
  const res = {};
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

test('getGiftCardByClaimToken: returns gift info for a valid unclaimed token', async (t) => {
  const cardId = new mongoose.Types.ObjectId();
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        _id: cardId,
        initialAmount: 25000,
        currency: 'NGN',
        design: { tier: 'classic' },
        recipient: { name: 'Alice', message: 'Enjoy!' },
        claimedBy: null,
        status: 'active',
      }),
    }),
  }));

  const req = { params: { token: 'abc-token' } };
  const res = mockRes();
  await getGiftCardByClaimToken(req, res);
  assert.strictEqual(res._body.success, true);
  assert.strictEqual(res._body.data.amount, 25000);
  assert.strictEqual(res._body.data.alreadyClaimed, false);
});

test('getGiftCardByClaimToken: returns alreadyClaimed when claimedBy is set', async (t) => {
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        claimedBy: new mongoose.Types.ObjectId(),
        status: 'active',
        initialAmount: 25000,
        currency: 'NGN',
        design: {},
        recipient: {},
      }),
    }),
  }));

  const req = { params: { token: 'claimed-token' } };
  const res = mockRes();
  await getGiftCardByClaimToken(req, res);
  assert.strictEqual(res._body.data.alreadyClaimed, true);
});

test('claimGiftCard: rejects if buyer tries to claim own card', async (t) => {
  const userId = new mongoose.Types.ObjectId();
  t.mock.method(GiftCard, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        _id: new mongoose.Types.ObjectId(),
        purchasedBy: userId,
        claimedBy: null,
        status: 'active',
      }),
    }),
  }));

  const req = { params: { token: 'tok' }, user: { _id: userId } };
  const res = mockRes();
  await claimGiftCard(req, res);
  assert.strictEqual(res._status, 400);
  assert.ok(res._body.message.includes('cannot claim your own'));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test __tests__/giftCard.claimRoute.test.js
```

Expected: FAIL — `getGiftCardByClaimToken` is not yet wired to a route, but controller loads fine; test may partially pass. Goal is routes aren't mounted yet.

- [ ] **Step 3: Create the public claim routes file**

Create `server/routes/giftCardClaim.routes.js`:

```js
// server/routes/giftCardClaim.routes.js
//
// Public claim endpoints — no blanket protect() middleware. GET is fully public
// (optionalProtect so req.user is available if logged in). POST requires auth.

const express = require('express');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { param } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const { getGiftCardByClaimToken, claimGiftCard } = require('../controllers/giftcard.controller');

// GET /api/gift-cards/claim/:token — public, returns card art info (no code/balance)
router.get(
  '/:token',
  optionalProtect,
  [param('token').notEmpty().withMessage('Token is required')],
  validate,
  getGiftCardByClaimToken
);

// POST /api/gift-cards/claim/:token — authenticated; claims the card for the logged-in user
router.post(
  '/:token',
  protect,
  [param('token').notEmpty().withMessage('Token is required')],
  validate,
  claimGiftCard
);

module.exports = router;
```

- [ ] **Step 4: Add send-gift route to giftcard.routes.js**

In `server/routes/giftcard.routes.js`, add the following route before `module.exports`:

```js
// POST /api/gift-cards/:id/send-gift — set/update recipient and send the gift email
router.post(
  '/:id/send-gift',
  [
    param('id').isMongoId().withMessage('Invalid gift card ID'),
    body('email').isEmail().withMessage('Recipient email must be valid'),
    body('name').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('Name too long'),
    body('message').optional({ checkFalsy: true }).isLength({ max: 280 }).withMessage('Message too long'),
  ],
  validate,
  giftCardController.sendGiftAsGift
);
```

- [ ] **Step 5: Mount the claim router in server.js**

In `server/server.js`, add the require near the other gift card require:

```js
const giftCardClaimRoutes  = require('./routes/giftCardClaim.routes');
```

Then mount it **before** `app.use('/api/gift-cards', giftCardRoutes)`:

```js
app.use('/api/gift-cards/claim', giftCardClaimRoutes);
app.use('/api/gift-cards',       giftCardRoutes);
```

- [ ] **Step 6: Run the controller tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test __tests__/giftCard.claimRoute.test.js
```

Expected: PASS — 3 tests green.

- [ ] **Step 7: Run full suite**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test
```

Expected: all previously passing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add server/routes/giftCardClaim.routes.js server/routes/giftcard.routes.js server/server.js server/__tests__/giftCard.claimRoute.test.js
git commit -m "feat(giftcard): public claim route + send-gift route + server mount"
```

---

### Task 5: Frontend Types + useGiftCards Hook

**Files:**
- Modify: `client/apps/platform/src/app/my-account/_types.ts`
- Modify: `client/apps/platform/src/app/my-account/_hooks/useGiftCards.ts`

**Interfaces:**
- Produces: `GiftCardItem` extended with `purchasedByMe?: boolean`, `claimToken?: string | null`, `claimedBy?: string | null`, `claimedAt?: string | null`
- Produces: `useGiftCards` exposes `sendGift(cardId, data) => Promise<{ ok: boolean; claimToken?: string; message?: string }>`

- [ ] **Step 1: Extend GiftCardItem in _types.ts**

In `client/apps/platform/src/app/my-account/_types.ts`, replace the `GiftCardItem` interface with:

```ts
export interface GiftCardItem {
  _id: string;
  code: string | null;
  cardNumber: string | null;
  initialAmount: number;
  balance: number;
  currency: string;
  status: 'pending_payment' | 'active' | 'redeemed' | 'expired' | 'disabled';
  recipient?: GiftCardRecipient;
  design?: { templateId?: string; theme?: string; tier?: string };
  expiresAt?: string;
  createdAt: string;
  purchasedByMe?: boolean;
  claimToken?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
}
```

- [ ] **Step 2: Add sendGift to useGiftCards hook**

In `client/apps/platform/src/app/my-account/_hooks/useGiftCards.ts`, update the `UseGiftCardsReturn` interface to add:

```ts
  sendGift: (cardId: string, data: { email: string; name?: string; message?: string }) => Promise<{ ok: boolean; claimToken?: string; message?: string }>;
```

Then add the `sendGift` callback implementation inside `useGiftCards`, before the `return` statement:

```ts
  const sendGift = useCallback(async (cardId: string, data: { email: string; name?: string; message?: string }) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/${cardId}/send-gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, message: json.message || 'Failed to send gift' };
      const payload = json.data ?? json;
      await refresh();
      return { ok: true, claimToken: payload.claimToken };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);
```

And add `sendGift` to the hook's return value:

```ts
  return { cards, loading, error, purchase, verifyPurchase, completePayment, refresh, sendGift };
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/platform
npx tsc --noEmit 2>&1 | grep -v "TS2688" | head -20
```

Expected: no new errors (only pre-existing TS2688 errors are acceptable).

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/app/my-account/_types.ts client/apps/platform/src/app/my-account/_hooks/useGiftCards.ts
git commit -m "feat(giftcard): extend GiftCardItem types + sendGift hook"
```

---

### Task 6: Public Gift Landing Page

**Files:**
- Create: `client/apps/platform/src/app/gift/[token]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/gift-cards/claim/:token` (public fetch on mount)
- Consumes: `POST /api/gift-cards/claim/:token` (authenticated fetch on claim)
- Consumes: `useAuth()` from `@/context/AuthContext` for `token` and `user`
- Consumes: `PremiumGiftCard` from `../../my-account/_components/PremiumGiftCard`
- Consumes: `fmtNgn` from `../../my-account/_components/format`

- [ ] **Step 1: Create the gift directory**

```bash
mkdir -p /Users/mac/Documents/drinksharbour/client/apps/platform/src/app/gift/\[token\]
```

- [ ] **Step 2: Create the gift landing page**

Create `client/apps/platform/src/app/gift/[token]/page.tsx`:

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import PremiumGiftCard from '../../my-account/_components/PremiumGiftCard';
import { fmtNgn } from '../../my-account/_components/format';

interface GiftInfo {
  amount: number;
  currency: string;
  tier: string | null;
  senderName: string | null;
  message: string | null;
  alreadyClaimed: boolean;
}

export default function GiftClaimPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';
  const { user, token: authToken, isAuthenticated } = useAuth();

  const [gift, setGift] = useState<GiftInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimedCardId, setClaimedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/gift-cards/claim/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setLoadErr(data.message || 'Gift not found'); return; }
        setGift(data.data ?? data);
      })
      .catch(() => setLoadErr('Could not load gift details'));
  }, [token]);

  const handleClaim = async () => {
    if (!isAuthenticated || !authToken) {
      router.push(`/login?redirect=/gift/${token}`);
      return;
    }
    setClaiming(true);
    setClaimErr(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/claim/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { setClaimErr(data.message || 'Claim failed'); return; }
      const payload = data.data ?? data;
      setClaimed(true);
      setClaimedCardId(payload.giftCardId);
    } catch {
      setClaimErr('Network error — please try again');
    } finally {
      setClaiming(false);
    }
  };

  const isBuyer = gift && user && isAuthenticated; // we check buyer on the server; just show claim if logged in

  if (loadErr) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
          <Icon.PiGiftBold size={28} className="text-stone-400" />
        </div>
        <p className="text-stone-600 font-semibold">{loadErr}</p>
        <Link href="/" className="text-sm font-semibold text-red-700 flex items-center gap-1">
          <Icon.PiArrowLeftBold size={12} /> Back to DrinksHarbour
        </Link>
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (claimed && claimedCardId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
          <Icon.PiCheckCircleBold size={32} className="text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-stone-900">Gift card claimed!</p>
          <p className="text-sm text-stone-500 mt-1">{fmtNgn(gift.amount)} has been added to your gift cards.</p>
        </div>
        <Link href={`/my-account/gift-cards/${claimedCardId}`}
          className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
          <Icon.PiGiftBold size={14} /> View My Gift Card
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-stone-50 py-12 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Icon.PiGiftBold size={14} /> You have a gift!
          </div>
          {gift.senderName && (
            <p className="text-stone-600 text-sm">
              <span className="font-semibold text-stone-800">{gift.senderName}</span> sent you a gift card
            </p>
          )}
        </div>

        <PremiumGiftCard
          amount={gift.amount}
          tierId={gift.tier || undefined}
          tilt={false}
          showFlip={false}
        />

        {gift.message && (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-stone-400 mb-2">Personal message</p>
            <blockquote className="text-stone-700 text-sm italic border-l-2 border-red-200 pl-3">
              "{gift.message}"
            </blockquote>
          </div>
        )}

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-400">Value</span>
            <span className="font-black text-stone-900 text-lg">{fmtNgn(gift.amount)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-50 rounded-lg p-2.5">
            <Icon.PiShieldCheckBold size={12} className="text-amber-500 flex-shrink-0" />
            Redeemable at any store on DrinksHarbour. 12-month validity.
          </div>
        </div>

        {gift.alreadyClaimed ? (
          <div className="bg-stone-100 rounded-xl p-5 text-center">
            <Icon.PiLockBold size={20} className="mx-auto text-stone-400 mb-2" />
            <p className="text-stone-600 font-semibold text-sm">This gift has already been claimed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claimErr && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
                <Icon.PiWarningBold size={14} className="flex-shrink-0" />
                {claimErr}
              </div>
            )}
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 disabled:opacity-60 transition-all shadow-lg shadow-red-900/20"
            >
              {claiming
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon.PiGiftBold size={15} />}
              {claiming ? 'Claiming…' : isAuthenticated ? 'Claim this gift card' : 'Sign in to claim'}
            </button>
            {!isAuthenticated && (
              <p className="text-center text-xs text-stone-400">
                You'll be redirected to sign in, then returned here automatically.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/platform
npx tsc --noEmit 2>&1 | grep -v "TS2688" | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/app/gift/
git commit -m "feat(giftcard): public /gift/[token] claim landing page"
```

---

### Task 7: Gift Cards List Page — Toggle Fix + Tile Badges

**Files:**
- Modify: `client/apps/platform/src/app/my-account/gift-cards/page.tsx`

**Interfaces:**
- Consumes: `GiftCardItem.purchasedByMe`, `GiftCardItem.claimToken`, `GiftCardItem.claimedBy` (from Task 5)
- Consumes: `useGiftCards().sendGift` (from Task 5) — not used on the list page directly but the hook's refresh is triggered after claim

- [ ] **Step 1: Fix the broken "Send as a gift" toggle**

In `client/apps/platform/src/app/my-account/gift-cards/page.tsx`, find the `<label>` for the "Send as a gift" checkbox (around line 88). Add `onClick` to toggle `forSomeone`:

Replace:
```tsx
            <label className="flex items-center gap-2.5 cursor-pointer group">
```

With:
```tsx
            <label className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setForSomeone(v => !v)}>
```

- [ ] **Step 2: Update GiftCardTile to show gifting state badges**

In the `GiftCardTile` component, replace the status/expiry row and the bottom section with gift-aware rendering. Find the `<Link>` component's inner `<div className="p-4">` block and replace the status row at the top of that div:

Replace:
```tsx
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.status === 'active' ? 'bg-green-500' : card.status === 'pending_payment' ? 'bg-amber-400' : 'bg-stone-300'}`} />
            <span className="text-xs font-semibold text-stone-600 capitalize">{card.status.replace('_', ' ')}</span>
          </div>
          <span className="text-xs text-stone-400">Exp {fmtDate(card.expiresAt)}</span>
        </div>
```

With:
```tsx
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {card.purchasedByMe && card.claimedBy ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <Icon.PiGiftBold size={9} /> Gifted
              </span>
            ) : card.purchasedByMe && card.claimToken && !card.claimedBy ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                <Icon.PiClockBold size={9} /> Pending claim
              </span>
            ) : (
              <>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.status === 'active' ? 'bg-green-500' : card.status === 'pending_payment' ? 'bg-amber-400' : 'bg-stone-300'}`} />
                <span className="text-xs font-semibold text-stone-600 capitalize">{card.status.replace('_', ' ')}</span>
              </>
            )}
          </div>
          <span className="text-xs text-stone-400">Exp {fmtDate(card.expiresAt)}</span>
        </div>
```

- [ ] **Step 3: Hide copy button on gifted cards**

In `GiftCardTile`, the copy code button shows when `card.code` is truthy. Wrap it to also hide when the buyer has gifted the card:

Replace:
```tsx
          {card.code && (
            <button onClick={copy} ...>
```

With:
```tsx
          {card.code && !(card.purchasedByMe && card.claimToken) && (
            <button onClick={copy} ...>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/platform
npx tsc --noEmit 2>&1 | grep -v "TS2688" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add client/apps/platform/src/app/my-account/gift-cards/page.tsx
git commit -m "feat(giftcard): fix send-as-gift toggle; pending/gifted tile badges"
```

---

### Task 8: Gift Card Detail Page — Gift Status Panel + Send as Gift Form + Recipient Note

**Files:**
- Modify: `client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx`

**Interfaces:**
- Consumes: `useGiftCardDetail().card` with `purchasedByMe`, `claimToken`, `claimedBy`, `claimedAt`, `recipient`
- Consumes: `useGiftCards(token).sendGift` — hook must be initialised with the same token

- [ ] **Step 1: Import sendGift from useGiftCards and wire up local state**

In `client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx`, add `useGiftCards` import:

```tsx
import { useGiftCardDetail, useGiftCards } from '../../_hooks/useGiftCards';
```

Inside `GiftCardDetailPage()`, after the existing hook calls, add:

```tsx
  const { sendGift } = useGiftCards(token);
  const [sendGiftOpen, setSendGiftOpen] = useState(false);
  const [giftForm, setGiftForm] = useState({ email: '', name: '', message: '' });
  const [sendingGift, setSendingGift] = useState(false);
  const [resending, setResending] = useState(false);
```

- [ ] **Step 2: Add the Gift Status panel (buyer view)**

In the detail page JSX, after the `{msg && ...}` alert and before the `<div className="grid md:grid-cols-2">`, add:

```tsx
      {/* Gift Status panel — only shown to buyer when card is in gift flow */}
      {card.purchasedByMe && card.claimToken && (
        <div className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
          card.claimedBy
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              card.claimedBy ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {card.claimedBy
                ? <Icon.PiCheckCircleBold size={16} className="text-green-600" />
                : <Icon.PiClockBold size={16} className="text-blue-600" />}
            </div>
            <div>
              <p className={`text-sm font-bold ${card.claimedBy ? 'text-green-800' : 'text-blue-800'}`}>
                {card.claimedBy ? 'Gift claimed' : 'Awaiting claim'}
              </p>
              <p className={`text-xs mt-0.5 ${card.claimedBy ? 'text-green-600' : 'text-blue-600'}`}>
                {card.claimedBy
                  ? `Claimed${card.claimedAt ? ` on ${fmtDate(card.claimedAt)}` : ''}`
                  : `Sent to ${card.recipient?.email || 'recipient'}`}
              </p>
            </div>
          </div>
          {!card.claimedBy && (
            <button
              onClick={async () => {
                if (!card.recipient?.email) return;
                setResending(true);
                await sendGift(card._id, {
                  email: card.recipient.email,
                  name: card.recipient.name,
                  message: card.recipient.message,
                });
                setResending(false);
                setMsg({ ok: true, text: `Gift notification resent to ${card.recipient.email}` });
              }}
              disabled={resending}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-60"
            >
              {resending
                ? <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                : <Icon.PiPaperPlaneTiltBold size={12} />}
              Resend
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 3: Add "Send as Gift" button in the details panel (self-bought cards)**

In the details panel (`<div className="bg-white rounded-xl border...">`), add a new row after the copy code button row (and before the closing `</div>` of that panel). This row should only show when `purchasedByMe`, no `claimToken`, and card is `active`:

```tsx
            {card.purchasedByMe && !card.claimToken && card.status === 'active' && (
              <div className="px-5 py-3">
                <button
                  onClick={() => setSendGiftOpen(v => !v)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors border border-red-200 hover:border-red-300"
                >
                  <Icon.PiGiftBold size={12} />
                  {sendGiftOpen ? 'Cancel' : 'Send as a gift'}
                </button>
                {sendGiftOpen && (
                  <div className="mt-3 space-y-2.5">
                    <input
                      type="email"
                      placeholder="Recipient email *"
                      value={giftForm.email}
                      onChange={e => setGiftForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none transition-all"
                    />
                    <input
                      placeholder="Recipient name (optional)"
                      value={giftForm.name}
                      onChange={e => setGiftForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none transition-all"
                    />
                    <textarea
                      placeholder="Personal message (optional)"
                      rows={2}
                      value={giftForm.message}
                      onChange={e => setGiftForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:border-red-400 outline-none resize-none transition-all"
                    />
                    <button
                      onClick={async () => {
                        if (!giftForm.email) return;
                        setSendingGift(true);
                        const res = await sendGift(card._id, giftForm);
                        setSendingGift(false);
                        if (res.ok) {
                          setMsg({ ok: true, text: `Gift notification sent to ${giftForm.email}` });
                          setSendGiftOpen(false);
                          setGiftForm({ email: '', name: '', message: '' });
                        } else {
                          setMsg({ ok: false, text: res.message || 'Failed to send gift' });
                        }
                      }}
                      disabled={sendingGift || !giftForm.email}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-2 rounded-lg font-bold text-xs hover:from-red-800 hover:to-red-950 disabled:opacity-60 transition-all"
                    >
                      {sendingGift
                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Icon.PiPaperPlaneTiltBold size={11} />}
                      {sendingGift ? 'Sending…' : 'Send gift notification'}
                    </button>
                  </div>
                )}
              </div>
            )}
```

- [ ] **Step 4: Add recipient "Gifted by" note (recipient view)**

In the details panel, after the `{card.recipient?.name && ...}` row that shows recipient name, add a row for the recipient's perspective:

```tsx
            {!card.purchasedByMe && card.recipient?.name && (
              <div className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-xs text-stone-400">Gifted by</span>
                <span className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                  <Icon.PiGiftBold size={12} className="text-red-700" />
                  {card.recipient.name}
                </span>
              </div>
            )}
```

- [ ] **Step 5: Hide redeem section when claimToken is set (card is a gift in transit)**

In the detail page, the `{canRedeem && (...)}` redeem section currently only checks `card.status === 'active' && card.balance > 0`. Update the `canRedeem` constant to also exclude gifted-in-transit cards:

Replace:
```tsx
  const canRedeem = card.status === 'active' && card.balance > 0;
```

With:
```tsx
  const canRedeem = card.status === 'active' && card.balance > 0 && !(card.purchasedByMe && card.claimToken);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/platform
npx tsc --noEmit 2>&1 | grep -v "TS2688" | head -20
```

Expected: no new errors.

- [ ] **Step 7: Run full server test suite one final time**

```bash
cd /Users/mac/Documents/drinksharbour/server
node --test
```

Expected: all previously passing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx
git commit -m "feat(giftcard): gift status panel + send-as-gift form + recipient note on detail page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `claimToken`, `claimedBy`, `claimedAt` schema fields | Task 1 |
| `issueGiftCard` generates token when recipient has email | Task 1 |
| `sendGiftCardEmail` with claim link in email | Task 2 |
| `GET /api/gift-cards/claim/:token` public endpoint | Task 3 + 4 |
| `POST /api/gift-cards/claim/:token` protected endpoint | Task 3 + 4 |
| `POST /api/gift-cards/:id/send-gift` endpoint | Task 3 + 4 |
| Dual-ownership on `getMyGiftCards` | Task 3 |
| Dual-ownership on `getGiftCard` | Task 3 |
| Redeem block for buyer once `claimToken` is set | Task 3 |
| TypeScript types updated | Task 5 |
| `sendGift` hook function | Task 5 |
| Public `/gift/[token]` page | Task 6 |
| Not-logged-in → redirect to login flow | Task 6 |
| Already-claimed state | Task 6 |
| Buyer-is-claimer rejection (server) | Task 3 |
| Fix broken toggle in purchase modal | Task 7 |
| "Pending claim" and "Gifted" badges on tiles | Task 7 |
| Copy button hidden on gifted tiles | Task 7 |
| Gift Status panel with Resend button | Task 8 |
| Send as Gift inline form on detail page | Task 8 |
| "Gifted by" note for recipient | Task 8 |
| Redeem hidden when `claimToken` set | Task 8 |

**Placeholder scan:** No TBD, no TODO, no "implement later", no "similar to Task N" shortcuts. All steps contain actual code.

**Type consistency check:**
- `sendGift(cardId: string, data: { email, name?, message? })` defined in Task 5, called identically in Tasks 7 and 8. ✓
- `GiftCardItem` fields `purchasedByMe`, `claimToken`, `claimedBy`, `claimedAt` defined in Task 5, consumed in Tasks 7 and 8. ✓
- `getGiftCardByClaimToken`, `claimGiftCard`, `sendGiftAsGift` defined in Task 3, exported in Task 3, imported in Task 4. ✓
- `card.claimToken` in `canRedeem` (Task 8) matches field name from Task 5 types. ✓
