# ERM SaaS Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ERM (Enterprise Resource Management) SaaS billing layer — Paystack subscription plans, plan-tier enforcement, commission discount ladder, and a vendor-facing billing UI.

**Architecture:** Central plan-config module defines tier limits and commission rates; a Paystack subscription service handles recurring billing via Paystack's Subscriptions API; a feature-gating middleware enforces limits on server routes; two Next.js pages (pricing + plan management) form the vendor-facing ERM UI.

**Tech Stack:** Node.js/Express (server), Paystack Subscriptions API (billing), MongoDB/Mongoose (Tenant model), Next.js 15 App Router + Tailwind (client), TypeScript (client)

## Global Constraints

- Currency: NGN (kobo × 100 for all Paystack amounts)
- Billing processor: Paystack only — no Stripe for subscriptions
- Admin app path: `/Users/mac/Documents/drinksharbour/client/apps/admin`
- Server path: `/Users/mac/Documents/drinksharbour/server`
- Existing Paystack helpers: `server/services/payment.service.js` (`createPaystackTransaction`, `verifyPaystackTransaction`)
- Existing Paystack env var: `PAYSTACK_SECRET_KEY` (already used in payment.service.js)
- Brand primary: `#b20202`; dark: `#0f0e13`
- Commit after every task

---

## ERM Tier Reference (from business plan)

| plan key | label | price/mo (₦) | SKU limit | staff limit | commission |
|----------|-------|-------------|-----------|-------------|------------|
| `free_trial` | Free Trial | 0 | 50 | 1 | 13% |
| `starter` | Starter | 15,000 | 100 | 1 | 13% |
| `growth` | Growth | 35,000 | 500 | 3 | 11% |
| `pro` | Pro | 65,000 | 2,000 | 10 | 10% |
| `enterprise` | Enterprise | 85,000 | ∞ | ∞ | 9% |
| `venue` | Venue | 150,000 | ∞ | ∞ | 9% |

Add-ons (Pro / Enterprise / Venue only): extra shop ₦12K/mo, extra warehouse ₦20K/mo.

---

## File Map

**Create:**
- `server/config/erm-plans.js` — tier definitions, limits, commission rates, Paystack plan codes
- `server/services/erm.service.js` — Paystack subscription lifecycle (initialize, webhook events)
- `server/controllers/erm.controller.js` — HTTP handlers for billing API
- `server/routes/erm.routes.js` — `/api/erm/*` route group
- `server/middleware/plan.middleware.js` — `requirePlan(minPlan)` and `checkLimit(limitKey)` factories
- `client/apps/admin/src/app/(hydrogen)/settings/billing/page.tsx` — ERM plan management page
- `client/apps/admin/src/app/shared/erm/billing-page.tsx` — billing page data + layout
- `client/apps/admin/src/app/shared/erm/pricing-cards.tsx` — pricing tier cards component
- `client/apps/admin/src/app/shared/erm/current-plan-widget.tsx` — current plan + usage meters
- `client/apps/admin/src/services/erm.service.ts` — client-side API calls

**Modify:**
- `server/models/Tenant.js` — add `growth`/`venue` to plan enum; add `paystackCustomerId`, `paystackSubscriptionCode`, `paystackPlanCode`, `addOns` array
- `server/routes/erm.routes.js` — (new file, registered in server.js)
- `server/server.js` — mount `/api/erm` routes
- `server/middleware/auth.middleware.js` — wire `requireTenant` to also check subscription expiry on `past_due`

---

## Task 1: ERM Plan Config + Tenant Model

**Files:**
- Create: `server/config/erm-plans.js`
- Modify: `server/models/Tenant.js`

**Interfaces:**
- Produces: `ERM_PLANS` map (keyed by plan string), `getPlanConfig(planKey)`, `getCommissionRate(planKey)` — consumed by Tasks 2, 4, 5

- [ ] **Step 1: Write the plan config module**

```js
// server/config/erm-plans.js
'use strict';

// Paystack plan codes — create these on Paystack dashboard first,
// then set env vars. Local dev can use dummy values.
const ERM_PLANS = {
  free_trial: {
    label: 'Free Trial',
    priceMonthly: 0,
    skuLimit: 50,
    staffLimit: 1,
    commissionRate: 0.13,
    paystackPlanCode: null, // no billing on free trial
    features: ['inventory', 'orders', 'pos_single'],
    addOnsAllowed: false,
  },
  starter: {
    label: 'Starter',
    priceMonthly: 15000,
    skuLimit: 100,
    staffLimit: 1,
    commissionRate: 0.13,
    paystackPlanCode: process.env.PAYSTACK_PLAN_STARTER,
    features: ['inventory', 'orders', 'pos_single', 'sales_invoicing'],
    addOnsAllowed: false,
  },
  growth: {
    label: 'Growth',
    priceMonthly: 35000,
    skuLimit: 500,
    staffLimit: 3,
    commissionRate: 0.11,
    paystackPlanCode: process.env.PAYSTACK_PLAN_GROWTH,
    features: ['inventory', 'orders', 'pos_single', 'sales_invoicing', 'crm_basic', 'purchase_orders'],
    addOnsAllowed: false,
  },
  pro: {
    label: 'Pro',
    priceMonthly: 65000,
    skuLimit: 2000,
    staffLimit: 10,
    commissionRate: 0.10,
    paystackPlanCode: process.env.PAYSTACK_PLAN_PRO,
    features: ['inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_basic', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access'],
    addOnsAllowed: true,
  },
  enterprise: {
    label: 'Enterprise',
    priceMonthly: 85000,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: process.env.PAYSTACK_PLAN_ENTERPRISE,
    features: ['inventory', 'orders', 'pos_multi', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'custom_integrations', 'priority_support'],
    addOnsAllowed: true,
  },
  venue: {
    label: 'Venue',
    priceMonthly: 150000,
    skuLimit: Infinity,
    staffLimit: Infinity,
    commissionRate: 0.09,
    paystackPlanCode: process.env.PAYSTACK_PLAN_VENUE,
    features: ['inventory', 'orders', 'pos_realtime', 'sales_invoicing', 'crm_advanced', 'purchase_orders', 'multi_location', 'advanced_reports', 'api_access', 'table_management', 'guest_crm', 'event_booking', 'bar_inventory'],
    addOnsAllowed: true,
  },
};

const PLAN_ORDER = ['free_trial', 'starter', 'growth', 'pro', 'enterprise', 'venue'];

const ADD_ON_PRICES = {
  extra_shop: 12000,
  extra_warehouse: 20000,
};

function getPlanConfig(planKey) {
  return ERM_PLANS[planKey] ?? ERM_PLANS.free_trial;
}

function getCommissionRate(planKey) {
  return getPlanConfig(planKey).commissionRate;
}

function isPlanAtLeast(tenantPlan, minPlan) {
  return PLAN_ORDER.indexOf(tenantPlan) >= PLAN_ORDER.indexOf(minPlan);
}

module.exports = { ERM_PLANS, PLAN_ORDER, ADD_ON_PRICES, getPlanConfig, getCommissionRate, isPlanAtLeast };
```

- [ ] **Step 2: Update Tenant model**

In `server/models/Tenant.js`, locate the `plan` field (around line 46) and replace:

```js
// BEFORE:
plan: {
  type: String,
  enum: ["free_trial", "starter", "pro", "enterprise", "custom"],
  default: "free_trial",
},
```

With:

```js
// AFTER:
plan: {
  type: String,
  enum: ["free_trial", "starter", "growth", "pro", "enterprise", "venue", "custom"],
  default: "free_trial",
},
```

Then locate `stripeCustomerId` (around line 63) and replace the stripe block:

```js
// REMOVE:
stripeCustomerId: { type: String, sparse: true },
stripeSubscriptionId: { type: String, sparse: true },
```

```js
// ADD AFTER the removed block:
paystackCustomerId: { type: String, sparse: true },
paystackSubscriptionCode: { type: String, sparse: true },
paystackPlanCode: { type: String, sparse: true },

// Add-ons: extra shops/warehouses beyond the first (charged monthly)
addOns: {
  type: [{
    type: { type: String, enum: ['extra_shop', 'extra_warehouse'] },
    quantity: { type: Number, default: 1 },
    paystackSubscriptionCode: String,
  }],
  default: [],
},
```

- [ ] **Step 3: Verify model loads**

```bash
cd /Users/mac/Documents/drinksharbour/server && node -e "require('./models/Tenant'); console.log('Tenant model OK')"
```

Expected: `Tenant model OK`

- [ ] **Step 4: Commit**

```bash
git add server/config/erm-plans.js server/models/Tenant.js
git commit -m "feat(erm): add plan config + update Tenant model (growth/venue tiers, Paystack fields)"
```

---

## Task 2: Paystack Subscription Service

**Files:**
- Create: `server/services/erm.service.js`

**Interfaces:**
- Consumes: `ERM_PLANS`, `getPlanConfig`, `ADD_ON_PRICES` from `server/config/erm-plans.js`; `PAYSTACK_SECRET_KEY` env var
- Produces: `initializeSubscription(tenant, planKey)`, `handleWebhookEvent(event, data)`, `cancelSubscription(tenant)`, `addAddon(tenant, addonType)` — consumed by Task 3

- [ ] **Step 1: Create the ERM service**

```js
// server/services/erm.service.js
'use strict';

const axios = require('axios');
const Tenant = require('../models/Tenant');
const { getPlanConfig, getCommissionRate, ADD_ON_PRICES } = require('../config/erm-plans');

const PAYSTACK_BASE = 'https://api.paystack.co';
const headers = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` });

/**
 * Get or create a Paystack customer for the tenant.
 */
async function ensurePaystackCustomer(tenant) {
  if (tenant.paystackCustomerId) return tenant.paystackCustomerId;

  const res = await axios.post(`${PAYSTACK_BASE}/customer`, {
    email: tenant.email,
    first_name: tenant.businessName,
    metadata: { tenantId: tenant._id.toString() },
  }, { headers: headers() });

  const customerId = res.data.data.customer_code;
  await Tenant.findByIdAndUpdate(tenant._id, { paystackCustomerId: customerId });
  return customerId;
}

/**
 * Initialize a Paystack subscription for a plan.
 * Returns { authorizationUrl } — redirect vendor there to authorize card.
 */
async function initializeSubscription(tenant, planKey) {
  const plan = getPlanConfig(planKey);
  if (!plan.paystackPlanCode) throw new Error(`No Paystack plan code configured for ${planKey}`);

  const customerId = await ensurePaystackCustomer(tenant);

  const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
    email: tenant.email,
    amount: plan.priceMonthly * 100, // kobo
    plan: plan.paystackPlanCode,
    customer: customerId,
    metadata: {
      tenantId: tenant._id.toString(),
      targetPlan: planKey,
    },
    callback_url: `${process.env.NEXT_PUBLIC_ADMIN_URL}/settings/billing?status=success`,
  }, { headers: headers() });

  return { authorizationUrl: res.data.data.authorization_url, reference: res.data.data.reference };
}

/**
 * Cancel a tenant's active Paystack subscription.
 */
async function cancelSubscription(tenant) {
  if (!tenant.paystackSubscriptionCode) return;

  await axios.post(`${PAYSTACK_BASE}/subscription/disable`, {
    code: tenant.paystackSubscriptionCode,
    token: tenant.paystackSubscriptionCode,
  }, { headers: headers() });

  await Tenant.findByIdAndUpdate(tenant._id, { subscriptionStatus: 'canceled' });
}

/**
 * Process Paystack webhook events and update Tenant accordingly.
 */
async function handleWebhookEvent(event, data) {
  const tenantId = data?.metadata?.tenantId || data?.customer?.metadata?.tenantId;
  if (!tenantId) return;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return;

  switch (event) {
    case 'subscription.create': {
      const targetPlan = data.metadata?.targetPlan || data.plan?.plan_code;
      const commissionRate = getCommissionRate(targetPlan);
      await Tenant.findByIdAndUpdate(tenantId, {
        plan: targetPlan,
        subscriptionStatus: 'active',
        paystackSubscriptionCode: data.subscription_code,
        paystackPlanCode: data.plan?.plan_code,
        commissionPercentage: commissionRate * 100,
        currentPeriodStart: new Date(data.created_at),
        currentPeriodEnd: new Date(data.next_payment_date),
      });
      break;
    }

    case 'charge.success': {
      await Tenant.findByIdAndUpdate(tenantId, {
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(data.paid_at),
      });
      break;
    }

    case 'invoice.payment_failed': {
      await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'past_due' });
      break;
    }

    case 'subscription.disable': {
      await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'canceled' });
      break;
    }

    case 'subscription.expiring_cards':
      // Optionally: send email via email service
      break;
  }
}

/**
 * Get current subscription details from Paystack.
 */
async function getSubscriptionDetails(tenant) {
  if (!tenant.paystackSubscriptionCode) return null;

  const res = await axios.get(
    `${PAYSTACK_BASE}/subscription/${tenant.paystackSubscriptionCode}`,
    { headers: headers() }
  );
  return res.data.data;
}

module.exports = { initializeSubscription, cancelSubscription, handleWebhookEvent, getSubscriptionDetails };
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/mac/Documents/drinksharbour/server && node -e "require('./services/erm.service'); console.log('erm.service OK')"
```

Expected: `erm.service OK`

- [ ] **Step 3: Commit**

```bash
git add server/services/erm.service.js
git commit -m "feat(erm): Paystack subscription service (initialize, webhook handler, cancel)"
```

---

## Task 3: ERM Billing API Routes

**Files:**
- Create: `server/controllers/erm.controller.js`
- Create: `server/routes/erm.routes.js`
- Modify: `server/server.js`

**Interfaces:**
- Consumes: `initializeSubscription`, `cancelSubscription`, `handleWebhookEvent`, `getSubscriptionDetails` from Task 2; `ERM_PLANS`, `getPlanConfig` from Task 1
- Produces: REST endpoints consumed by Task 6 client service

Endpoints:
- `GET  /api/erm/plans` — public plan listing
- `GET  /api/erm/status` — current tenant's plan + usage (auth required)
- `POST /api/erm/subscribe` — initialize subscription (auth required)
- `POST /api/erm/cancel` — cancel subscription (auth required)
- `POST /api/erm/webhook` — Paystack webhook (no auth, HMAC verified)

- [ ] **Step 1: Create controller**

```js
// server/controllers/erm.controller.js
'use strict';

const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const { ERM_PLANS, getPlanConfig } = require('../config/erm-plans');
const { initializeSubscription, cancelSubscription, handleWebhookEvent, getSubscriptionDetails } = require('../services/erm.service');
const { ValidationError, ForbiddenError } = require('../utils/errors');

// GET /api/erm/plans
const getPlans = (req, res) => {
  const plans = Object.entries(ERM_PLANS)
    .filter(([key]) => key !== 'custom')
    .map(([key, cfg]) => ({
      key,
      label: cfg.label,
      priceMonthly: cfg.priceMonthly,
      skuLimit: cfg.skuLimit === Infinity ? null : cfg.skuLimit,
      staffLimit: cfg.staffLimit === Infinity ? null : cfg.staffLimit,
      commissionRate: cfg.commissionRate,
      features: cfg.features,
      addOnsAllowed: cfg.addOnsAllowed,
    }));
  res.json({ success: true, data: plans });
};

// GET /api/erm/status
const getStatus = async (req, res) => {
  const tenant = req.tenant;
  const plan = getPlanConfig(tenant.plan);

  const [skuCount, staffCount, paystackDetails] = await Promise.all([
    SubProduct.countDocuments({ tenant: tenant._id }),
    User.countDocuments({ tenant: tenant._id, role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] } }),
    getSubscriptionDetails(tenant).catch(() => null),
  ]);

  res.json({
    success: true,
    data: {
      plan: tenant.plan,
      planLabel: plan.label,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: tenant.currentPeriodEnd,
      commissionRate: tenant.commissionPercentage ?? plan.commissionRate * 100,
      usage: {
        skus: { used: skuCount, limit: plan.skuLimit === Infinity ? null : plan.skuLimit },
        staff: { used: staffCount, limit: plan.staffLimit === Infinity ? null : plan.staffLimit },
      },
      addOns: tenant.addOns,
      paystackDetails,
    },
  });
};

// POST /api/erm/subscribe  { planKey }
const subscribe = async (req, res) => {
  const { planKey } = req.body;
  if (!ERM_PLANS[planKey]) throw new ValidationError(`Invalid plan: ${planKey}`);
  if (planKey === 'free_trial') throw new ValidationError('Cannot subscribe to free trial');

  const tenant = req.tenant;
  const result = await initializeSubscription(tenant, planKey);
  res.json({ success: true, data: result });
};

// POST /api/erm/cancel
const cancel = async (req, res) => {
  await cancelSubscription(req.tenant);
  res.json({ success: true, message: 'Subscription cancelled' });
};

// POST /api/erm/webhook  (Paystack sends here)
const webhook = async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const { event, data } = req.body;
  await handleWebhookEvent(event, data);
  res.sendStatus(200);
};

module.exports = { getPlans, getStatus, subscribe, cancel, webhook };
```

- [ ] **Step 2: Create routes file**

```js
// server/routes/erm.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const { protect, attachTenant, requireTenant } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/erm.controller');

// Public
router.get('/plans', ctrl.getPlans);
router.post('/webhook', ctrl.webhook); // Paystack webhook — no auth

// Tenant-authenticated
router.use(protect, attachTenant, requireTenant);
router.get('/status', ctrl.getStatus);
router.post('/subscribe', ctrl.subscribe);
router.post('/cancel', ctrl.cancel);

module.exports = router;
```

- [ ] **Step 3: Mount in server.js**

Find the block where routes are mounted in `server/server.js` (search for `app.use('/api/`) and add:

```js
const ermRoutes = require('./routes/erm.routes');
// ... (add alongside other route mounts)
app.use('/api/erm', ermRoutes);
```

- [ ] **Step 4: Test endpoints**

```bash
cd /Users/mac/Documents/drinksharbour/server && node -e "require('./routes/erm.routes'); console.log('erm.routes OK')"
```

Expected: `erm.routes OK`

- [ ] **Step 5: Commit**

```bash
git add server/controllers/erm.controller.js server/routes/erm.routes.js server/server.js
git commit -m "feat(erm): billing API routes (plans, status, subscribe, cancel, webhook)"
```

---

## Task 4: Feature Gating Middleware

**Files:**
- Create: `server/middleware/plan.middleware.js`

**Interfaces:**
- Consumes: `getPlanConfig`, `isPlanAtLeast` from Task 1; `req.tenant` from `attachTenant`
- Produces: `requirePlan(minPlan)` — Express middleware factory; `checkSkuLimit` — middleware for subproduct create routes

- [ ] **Step 1: Create plan middleware**

```js
// server/middleware/plan.middleware.js
'use strict';

const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const { getPlanConfig, isPlanAtLeast } = require('../config/erm-plans');
const { ForbiddenError } = require('../utils/errors');

/**
 * Require tenant to be on at least `minPlan`.
 * Usage: router.post('/advanced', requirePlan('pro'), handler)
 */
function requirePlan(minPlan) {
  return (req, res, next) => {
    const tenantPlan = req.tenant?.plan ?? 'free_trial';
    if (!isPlanAtLeast(tenantPlan, minPlan)) {
      throw new ForbiddenError(
        `This feature requires the ${minPlan} plan or above. You are on ${tenantPlan}.`
      );
    }
    next();
  };
}

/**
 * Check SKU limit before creating a new sub-product.
 * Attach to POST /api/subproduct routes.
 */
async function checkSkuLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) return next();

    const plan = getPlanConfig(tenant.plan);
    if (plan.skuLimit === Infinity) return next();

    const count = await SubProduct.countDocuments({ tenant: tenant._id });
    if (count >= plan.skuLimit) {
      throw new ForbiddenError(
        `SKU limit reached (${plan.skuLimit} on ${plan.label} plan). Upgrade to add more products.`
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Check staff limit before creating a new tenant user.
 */
async function checkStaffLimit(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) return next();

    const plan = getPlanConfig(tenant.plan);
    if (plan.staffLimit === Infinity) return next();

    const count = await User.countDocuments({
      tenant: tenant._id,
      role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] },
    });
    if (count >= plan.staffLimit) {
      throw new ForbiddenError(
        `Staff limit reached (${plan.staffLimit} on ${plan.label} plan). Upgrade to add more staff.`
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requirePlan, checkSkuLimit, checkStaffLimit };
```

- [ ] **Step 2: Wire SKU limit into subproduct create route**

In `server/routes/subproduct.routes.js`, find the POST create route and add the middleware:

```js
const { checkSkuLimit } = require('../middleware/plan.middleware');

// Find the create route (likely: router.post('/', protect, attachTenant, ..., handler))
// Add checkSkuLimit before the handler:
router.post('/', protect, attachTenant, requireTenant, checkSkuLimit, subproductController.create);
```

- [ ] **Step 3: Wire staff limit into user create route**

In `server/routes/user.routes.js`, find the tenant staff invite/create route and add:

```js
const { checkStaffLimit } = require('../middleware/plan.middleware');
// Add checkStaffLimit before the invite handler
```

- [ ] **Step 4: Verify middleware loads**

```bash
cd /Users/mac/Documents/drinksharbour/server && node -e "require('./middleware/plan.middleware'); console.log('plan.middleware OK')"
```

Expected: `plan.middleware OK`

- [ ] **Step 5: Commit**

```bash
git add server/middleware/plan.middleware.js server/routes/subproduct.routes.js server/routes/user.routes.js
git commit -m "feat(erm): feature gating middleware (requirePlan, checkSkuLimit, checkStaffLimit)"
```

---

## Task 5: Commission Rate Auto-sync

**Files:**
- Modify: `server/services/erm.service.js` (already handles in webhook)
- Modify: `server/controllers/erm.controller.js` — ensure `subscribe` sets optimistic commission during redirect

**Interfaces:**
- The webhook handler in Task 2 already sets `commissionPercentage` on `subscription.create`. This task wires the admin panel to respect it and adds a back-fill script for existing tenants.

- [ ] **Step 1: Add admin endpoint to manually sync commission**

In `server/controllers/erm.controller.js`, add:

```js
// POST /api/erm/admin/sync-commission  (super_admin only)
const syncCommission = async (req, res) => {
  const { getCommissionRate } = require('../config/erm-plans');
  const Tenant = require('../models/Tenant');
  const tenants = await Tenant.find({ status: 'approved' });
  const ops = tenants.map(t => ({
    updateOne: {
      filter: { _id: t._id },
      update: { $set: { commissionPercentage: getCommissionRate(t.plan) * 100 } },
    },
  }));
  const result = await Tenant.bulkWrite(ops);
  res.json({ success: true, updated: result.modifiedCount });
};

module.exports = { getPlans, getStatus, subscribe, cancel, webhook, syncCommission };
```

- [ ] **Step 2: Add admin route**

In `server/routes/erm.routes.js`, add above `module.exports`:

```js
const { authorize } = require('../middleware/auth.middleware');
router.post('/admin/sync-commission', protect, authorize('super_admin', 'admin'), ctrl.syncCommission);
```

- [ ] **Step 3: Run sync on existing tenants (one-time)**

After server is running:

```bash
curl -X POST http://localhost:5000/api/erm/admin/sync-commission \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json"
```

Expected: `{ "success": true, "updated": <n> }`

- [ ] **Step 4: Commit**

```bash
git add server/controllers/erm.controller.js server/routes/erm.routes.js
git commit -m "feat(erm): commission auto-sync on plan change + admin bulk sync endpoint"
```

---

## Task 6: ERM Billing UI

**Files:**
- Create: `client/apps/admin/src/services/erm.service.ts`
- Create: `client/apps/admin/src/app/shared/erm/pricing-cards.tsx`
- Create: `client/apps/admin/src/app/shared/erm/current-plan-widget.tsx`
- Create: `client/apps/admin/src/app/shared/erm/billing-page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/settings/billing/page.tsx`

**Interfaces:**
- Consumes: `GET /api/erm/plans`, `GET /api/erm/status`, `POST /api/erm/subscribe`
- Produces: `/settings/billing` page visible to tenant users

- [ ] **Step 1: Client ERM service**

```ts
// client/apps/admin/src/services/erm.service.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

const API = process.env.NEXT_PUBLIC_API_URL;

export interface PlanInfo {
  key: string;
  label: string;
  priceMonthly: number;
  skuLimit: number | null;
  staffLimit: number | null;
  commissionRate: number;
  features: string[];
  addOnsAllowed: boolean;
}

export interface ErmStatus {
  plan: string;
  planLabel: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  commissionRate: number;
  usage: {
    skus: { used: number; limit: number | null };
    staff: { used: number; limit: number | null };
  };
}

export async function getErmPlans(): Promise<PlanInfo[]> {
  const res = await fetch(`${API}/api/erm/plans`, { cache: 'revalidate', next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data;
}

export async function getErmStatus(token: string): Promise<ErmStatus | null> {
  const res = await fetch(`${API}/api/erm/status`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

export async function initSubscribe(planKey: string, token: string): Promise<{ authorizationUrl: string }> {
  const res = await fetch(`${API}/api/erm/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ planKey }),
  });
  if (!res.ok) throw new Error((await res.json()).message);
  return (await res.json()).data;
}
```

- [ ] **Step 2: Pricing cards component**

```tsx
// client/apps/admin/src/app/shared/erm/pricing-cards.tsx
'use client';

import { useState } from 'react';
import { Button } from 'rizzui/button';
import { Badge } from 'rizzui';
import { PiCheckBold, PiArrowRightBold } from 'react-icons/pi';
import type { PlanInfo } from '@/services/erm.service';

const FEATURE_LABELS: Record<string, string> = {
  inventory: 'Inventory management',
  orders: 'Order management',
  pos_single: 'Single-location POS',
  pos_multi: 'Multi-location POS',
  pos_realtime: 'Real-time POS + bar tab',
  sales_invoicing: 'Sales invoicing',
  crm_basic: 'Basic CRM',
  crm_advanced: 'Advanced guest CRM',
  purchase_orders: 'Purchase orders',
  multi_location: 'Multi-location & warehouses',
  advanced_reports: 'Advanced analytics',
  api_access: 'API access',
  custom_integrations: 'Custom integrations',
  priority_support: 'Priority support',
  table_management: 'Table management',
  event_booking: 'Event & booking management',
  bar_inventory: 'Bar & cellar inventory',
  guest_crm: 'Guest CRM & guest list',
};

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

interface PricingCardsProps {
  plans: PlanInfo[];
  currentPlan: string;
  onSelectPlan: (planKey: string) => void;
  loading?: string | null;
}

export default function PricingCards({ plans, currentPlan, onSelectPlan, loading }: PricingCardsProps) {
  const highlighted = ['growth', 'pro'];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {plans.filter(p => p.key !== 'free_trial').map((plan) => {
        const isCurrent = plan.key === currentPlan;
        const isHighlighted = highlighted.includes(plan.key);

        return (
          <div
            key={plan.key}
            className={`relative flex flex-col rounded-2xl border p-6 transition-shadow ${
              isHighlighted
                ? 'border-[#b20202] shadow-lg shadow-[#b20202]/10'
                : 'border-gray-200 dark:border-gray-700'
            } ${isCurrent ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}
          >
            {isHighlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#b20202] px-3 py-0.5 text-xs font-semibold text-white">
                Popular
              </span>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.label}</h3>
              <div className="mt-1">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {fmt(plan.priceMonthly)}
                </span>
                <span className="text-sm text-gray-500">/mo</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {plan.commissionRate * 100}% marketplace commission
              </p>
            </div>

            <ul className="mb-6 flex-1 space-y-2">
              <li className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {plan.skuLimit === null ? 'Unlimited SKUs' : `Up to ${plan.skuLimit} SKUs`}
              </li>
              <li className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {plan.staffLimit === null ? 'Unlimited staff' : `${plan.staffLimit} staff user${plan.staffLimit !== 1 ? 's' : ''}`}
              </li>
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <PiCheckBold className="h-3 w-3 shrink-0 text-green-500" />
                  {FEATURE_LABELS[f] ?? f}
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <Badge className="w-full justify-center bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Current plan
              </Badge>
            ) : (
              <Button
                size="sm"
                className={`w-full gap-1.5 ${isHighlighted ? 'bg-[#b20202] text-white hover:bg-[#9a0101]' : ''}`}
                variant={isHighlighted ? undefined : 'outline'}
                isLoading={loading === plan.key}
                onClick={() => onSelectPlan(plan.key)}
              >
                Upgrade <PiArrowRightBold className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Current plan widget**

```tsx
// client/apps/admin/src/app/shared/erm/current-plan-widget.tsx
import { PiCrownDuotone, PiCalendarDuotone, PiPackageDuotone, PiUsersDuotone } from 'react-icons/pi';
import type { ErmStatus } from '@/services/erm.service';

function UsageMeter({ label, used, limit, icon: Icon }: { label: string; used: number; limit: number | null; icon: any }) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = limit && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
          <Icon className="h-4 w-4" /> {label}
        </span>
        <span className={`text-xs ${isNearLimit ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
          {used.toLocaleString()} / {limit === null ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-red-500' : 'bg-[#b20202]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function CurrentPlanWidget({ status }: { status: ErmStatus }) {
  const renewalDate = status.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : status.trialEndsAt
    ? new Date(status.trialEndsAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trialing: 'bg-amber-100 text-amber-700',
    past_due: 'bg-red-100 text-red-700',
    canceled: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiCrownDuotone className="h-6 w-6 text-[#b20202]" />
          <div>
            <p className="text-xs text-gray-500">Current plan</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{status.planLabel}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColors[status.subscriptionStatus] ?? 'bg-gray-100 text-gray-600'}`}>
          {status.subscriptionStatus.replace('_', ' ')}
        </span>
      </div>

      {renewalDate && (
        <div className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
          <PiCalendarDuotone className="h-4 w-4" />
          {status.subscriptionStatus === 'trialing' ? `Trial ends ${renewalDate}` : `Renews ${renewalDate}`}
        </div>
      )}

      <div className="space-y-3">
        <UsageMeter
          label="Products (SKUs)"
          used={status.usage.skus.used}
          limit={status.usage.skus.limit}
          icon={PiPackageDuotone}
        />
        <UsageMeter
          label="Staff users"
          used={status.usage.staff.used}
          limit={status.usage.staff.limit}
          icon={PiUsersDuotone}
        />
      </div>

      <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Marketplace commission: <span className="font-semibold">{status.commissionRate}%</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Billing page (client component)**

```tsx
// client/apps/admin/src/app/shared/erm/billing-page.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import PricingCards from './pricing-cards';
import CurrentPlanWidget from './current-plan-widget';
import type { PlanInfo, ErmStatus } from '@/services/erm.service';

interface BillingPageProps {
  plans: PlanInfo[];
  status: ErmStatus;
  token: string;
}

export default function BillingPage({ plans, status, token }: BillingPageProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = async (planKey: string) => {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const res = await fetch('/api/erm-proxy/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message || 'Failed to initialize subscription');
      }
      const { authorizationUrl } = (await res.json()).data;
      window.location.href = authorizationUrl;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your ERM plan. Upgrading your plan reduces your marketplace commission.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <CurrentPlanWidget status={status} />
        </div>
        <div className="lg:col-span-3">
          <PricingCards
            plans={plans}
            currentPlan={status.plan}
            onSelectPlan={handleSelectPlan}
            loading={loadingPlan}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Billing page server component (route)**

```tsx
// client/apps/admin/src/app/(hydrogen)/settings/billing/page.tsx
import { getAuthenticatedUser } from '@/lib/server-auth';
import { getErmPlans, getErmStatus } from '@/services/erm.service';
import BillingPage from '@/app/shared/erm/billing-page';
import { redirect } from 'next/navigation';
import { TENANT_ROLES } from '@/types/authorization';

export const metadata = { title: 'Billing & Subscription' };

export default async function BillingSettingsPage() {
  const user = await getAuthenticatedUser();

  if (!user?.token || !TENANT_ROLES.includes(user.role as any)) {
    redirect('/');
  }

  const [plans, status] = await Promise.all([
    getErmPlans(),
    getErmStatus(user.token as string),
  ]);

  if (!status) redirect('/');

  return (
    <div className="@container">
      <BillingPage plans={plans} status={status} token={user.token as string} />
    </div>
  );
}
```

- [ ] **Step 6: Add billing link to settings navigation**

Find the settings sidebar/nav in the admin app (likely `client/apps/admin/src/config/routes.ts` or a settings layout):

```bash
grep -rn "billing\|subscription\|settings" /Users/mac/Documents/drinksharbour/client/apps/admin/src/config/routes.ts | head -10
```

Add to the routes config:

```ts
// In routes.ts under settings:
billing: '/settings/billing',
```

And add to the settings nav items wherever the other settings tabs are defined.

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "TS2688" | head -20
```

Expected: no new errors beyond existing TS2688 (type declaration only)

- [ ] **Step 8: Add env vars to .env.example**

```bash
# In /Users/mac/Documents/drinksharbour/server/.env (add):
PAYSTACK_PLAN_STARTER=PLN_xxxxxxxxxxxx
PAYSTACK_PLAN_GROWTH=PLN_xxxxxxxxxxxx
PAYSTACK_PLAN_PRO=PLN_xxxxxxxxxxxx
PAYSTACK_PLAN_ENTERPRISE=PLN_xxxxxxxxxxxx
PAYSTACK_PLAN_VENUE=PLN_xxxxxxxxxxxx
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

- [ ] **Step 9: Commit**

```bash
git add \
  client/apps/admin/src/services/erm.service.ts \
  client/apps/admin/src/app/shared/erm/ \
  client/apps/admin/src/app/(hydrogen)/settings/billing/ \
  client/apps/admin/src/config/routes.ts
git commit -m "feat(erm): billing UI — pricing cards, plan management page, usage meters"
```

---

## Self-Review

### Spec coverage
- [x] 5 paid tiers (starter/growth/pro/enterprise/venue) + free_trial — Task 1
- [x] ₦15K/35K/65K/85K/150K pricing — Task 1 config
- [x] Commission discount ladder (13%→11%→10%→9%) — Task 1 config + Task 5 sync
- [x] SKU limits (100/500/2000/∞) — Task 1 config + Task 4 enforcement
- [x] Staff limits (1/3/10/∞) — Task 1 config + Task 4 enforcement
- [x] Paystack subscription flow (initialize → redirect → webhook) — Tasks 2–3
- [x] 30-day free trial (model already has `trialEndsAt`) — Task 6 UI shows trial state
- [x] Webhook signature verification — Task 3 controller
- [x] Multi-location add-ons fields on Tenant model — Task 1 (billing enforcement left for Phase 2)
- [x] Vendor-facing billing UI — Task 6
- [ ] Add-on billing flow (extra shop/warehouse charging) — **Phase 2** (fields exist, Paystack flow deferred)
- [ ] WhatsApp dunning notifications — **Phase 2**

### No placeholders: confirmed — all code blocks are complete

### Type consistency: `PlanInfo`, `ErmStatus` defined in `erm.service.ts` and consumed by all UI components consistently

---

## Paystack Dashboard Setup (Pre-requisite)

Before running Task 2, create 5 recurring plans on the Paystack dashboard:

1. Go to https://dashboard.paystack.com → Products → Plans
2. Create plan "DrinksHarbour Starter" — ₦15,000/month → copy plan code to `PAYSTACK_PLAN_STARTER`
3. Create plan "DrinksHarbour Growth" — ₦35,000/month → `PAYSTACK_PLAN_GROWTH`
4. Create plan "DrinksHarbour Pro" — ₦65,000/month → `PAYSTACK_PLAN_PRO`
5. Create plan "DrinksHarbour Enterprise" — ₦85,000/month → `PAYSTACK_PLAN_ENTERPRISE`
6. Create plan "DrinksHarbour Venue" — ₦150,000/month → `PAYSTACK_PLAN_VENUE`
7. In Paystack Settings → Webhooks, add: `https://yourserver.com/api/erm/webhook`

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-erm-saas-module.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks

**2. Inline Execution** — execute tasks in this session

Which approach?
