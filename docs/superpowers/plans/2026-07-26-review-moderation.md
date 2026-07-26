# Review Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make submitted product reviews visible and moderatable in the admin, and keep product rating aggregates correct.

**Architecture:** A new dedicated server `review` module (helpers → service → controller → routes) mounted at `/api/reviews` behind `superAdminOnly`, plus an admin service and a rebuilt Reviews table replacing the Isomorphic demo fixture. All business logic that can be tested without a database lives in `review.helpers.js`.

**Tech Stack:** Node/Express, Mongoose, `node:test` + `node:assert`, Next.js 14 App Router admin (rizzui, TanStack Table, next-auth, react-hot-toast).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-review-moderation-design.md`
- Tests are **`node:test`, NOT jest**. Run with `cd server && npm test`.
- **Atlas blocks this local IP.** No test may connect to MongoDB. All tests are pure unit tests over `review.helpers.js`, matching `server/__tests__/banner.helpers.test.js`.
- Review status enum is exactly: `pending`, `approved`, `rejected`, `hidden` (from `server/models/Review.js:110`).
- All admin review endpoints require `protect` + `superAdminOnly` from `server/middleware/auth.middleware.js`.
- Admin client files in this area begin with `// @ts-nocheck` — keep that convention.
- Commit after each task. Do NOT commit unrelated working-tree files (order controller/utils, dashboard widgets, `_pw-img.js`, `orderAdminList.test.js`).

---

### Task 1: Review helpers (pure, tested)

**Files:**
- Create: `server/services/review.helpers.js`
- Test: `server/__tests__/review.helpers.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `REVIEW_STATUSES: string[]`
  - `isValidStatus(status) -> boolean`
  - `buildReviewListQuery({ status, product, rating, verified, withImages, search }) -> object`
  - `buildReviewSort(sortBy) -> object`
  - `computeRatingAggregate(statsArray) -> { averageRating: number, reviewCount: number }`
  - `normalizePagination({ page, limit }) -> { page, limit, skip }`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/review.helpers.test.js`:

```js
// server/__tests__/review.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  REVIEW_STATUSES,
  isValidStatus,
  buildReviewListQuery,
  buildReviewSort,
  computeRatingAggregate,
  normalizePagination,
} = require('../services/review.helpers');

test('REVIEW_STATUSES matches the Review model enum', () => {
  assert.deepStrictEqual(REVIEW_STATUSES, ['pending', 'approved', 'rejected', 'hidden']);
});

test('isValidStatus accepts enum values and rejects everything else', () => {
  for (const s of REVIEW_STATUSES) assert.strictEqual(isValidStatus(s), true, s);
  assert.strictEqual(isValidStatus('deleted'), false);
  assert.strictEqual(isValidStatus(''), false);
  assert.strictEqual(isValidStatus(null), false);
  assert.strictEqual(isValidStatus(undefined), false);
});

test('buildReviewListQuery returns an empty query when no filters given', () => {
  assert.deepStrictEqual(buildReviewListQuery({}), {});
});

test('buildReviewListQuery applies status, product and rating filters', () => {
  const q = buildReviewListQuery({ status: 'pending', product: 'abc', rating: '4' });
  assert.strictEqual(q.status, 'pending');
  assert.strictEqual(q.product, 'abc');
  assert.strictEqual(q.rating, 4);
});

test('buildReviewListQuery ignores an invalid status rather than matching nothing', () => {
  const q = buildReviewListQuery({ status: 'bogus' });
  assert.strictEqual(q.status, undefined);
});

test('buildReviewListQuery handles verified and withImages as string or boolean', () => {
  assert.strictEqual(buildReviewListQuery({ verified: 'true' }).isVerifiedPurchase, true);
  assert.strictEqual(buildReviewListQuery({ verified: true }).isVerifiedPurchase, true);
  assert.strictEqual(buildReviewListQuery({ verified: 'false' }).isVerifiedPurchase, undefined);
  assert.deepStrictEqual(buildReviewListQuery({ withImages: 'true' }).images, { $exists: true, $ne: [] });
});

test('buildReviewListQuery turns search into a case-insensitive regex over title and comment', () => {
  const q = buildReviewListQuery({ search: 'smooth' });
  assert.ok(Array.isArray(q.$or));
  assert.strictEqual(q.$or.length, 2);
  assert.ok(q.$or[0].title.$regex instanceof RegExp || typeof q.$or[0].title.$regex === 'object');
  assert.strictEqual(q.$or[0].title.$regex.test('SMOOTH finish'), true);
  assert.strictEqual(q.$or[1].comment.$regex.test('very smooth'), true);
});

test('buildReviewListQuery escapes regex metacharacters in search', () => {
  const q = buildReviewListQuery({ search: 'a+b' });
  assert.strictEqual(q.$or[0].title.$regex.test('a+b'), true);
  assert.strictEqual(q.$or[0].title.$regex.test('aab'), false);
});

test('buildReviewSort maps known keys and falls back to newest first', () => {
  assert.deepStrictEqual(buildReviewSort('recent'), { createdAt: -1 });
  assert.deepStrictEqual(buildReviewSort('helpful'), { helpfulCount: -1, createdAt: -1 });
  assert.deepStrictEqual(buildReviewSort('rating_high'), { rating: -1, createdAt: -1 });
  assert.deepStrictEqual(buildReviewSort('rating_low'), { rating: 1, createdAt: -1 });
  assert.deepStrictEqual(buildReviewSort('bogus'), { createdAt: -1 });
  assert.deepStrictEqual(buildReviewSort(undefined), { createdAt: -1 });
});

test('computeRatingAggregate rounds the average to one decimal', () => {
  assert.deepStrictEqual(
    computeRatingAggregate([{ _id: null, avg: 4.26, count: 7 }]),
    { averageRating: 4.3, reviewCount: 7 }
  );
});

test('computeRatingAggregate resets to zero when there are no approved reviews', () => {
  assert.deepStrictEqual(computeRatingAggregate([]), { averageRating: 0, reviewCount: 0 });
  assert.deepStrictEqual(computeRatingAggregate(null), { averageRating: 0, reviewCount: 0 });
});

test('normalizePagination clamps page and limit into range', () => {
  assert.deepStrictEqual(normalizePagination({}), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(normalizePagination({ page: 3, limit: 10 }), { page: 3, limit: 10, skip: 20 });
  assert.deepStrictEqual(normalizePagination({ page: 0 }), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(normalizePagination({ page: -5 }), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(normalizePagination({ limit: 500 }), { page: 1, limit: 100, skip: 0 });
  assert.deepStrictEqual(normalizePagination({ limit: 0 }), { page: 1, limit: 20, skip: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/review.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/review.helpers'`

- [ ] **Step 3: Write minimal implementation**

Create `server/services/review.helpers.js`:

```js
// server/services/review.helpers.js
// Pure, database-free helpers for review moderation. Unit-testable in isolation.

const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'hidden'];

const isValidStatus = (status) => REVIEW_STATUSES.includes(status);

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isTrue = (v) => v === true || v === 'true';

const buildReviewListQuery = ({
  status,
  product,
  rating,
  verified,
  withImages,
  search,
} = {}) => {
  const query = {};

  if (isValidStatus(status)) query.status = status;
  if (product) query.product = product;

  const parsedRating = parseInt(rating, 10);
  if (!Number.isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
    query.rating = parsedRating;
  }

  if (isTrue(verified)) query.isVerifiedPurchase = true;
  if (isTrue(withImages)) query.images = { $exists: true, $ne: [] };

  if (search && String(search).trim()) {
    const regex = new RegExp(escapeRegex(String(search).trim()), 'i');
    query.$or = [{ title: { $regex: regex } }, { comment: { $regex: regex } }];
  }

  return query;
};

const SORT_MAP = {
  recent: { createdAt: -1 },
  helpful: { helpfulCount: -1, createdAt: -1 },
  rating_high: { rating: -1, createdAt: -1 },
  rating_low: { rating: 1, createdAt: -1 },
};

const buildReviewSort = (sortBy) => SORT_MAP[sortBy] || SORT_MAP.recent;

// Always returns a value, including zero — an empty stats array means the last
// approved review went away and the product aggregate must reset, not persist.
const computeRatingAggregate = (stats) => {
  const row = Array.isArray(stats) && stats.length > 0 ? stats[0] : null;
  if (!row || !row.count) return { averageRating: 0, reviewCount: 0 };
  return {
    averageRating: Math.round((row.avg || 0) * 10) / 10,
    reviewCount: row.count,
  };
};

const normalizePagination = ({ page, limit } = {}) => {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);
  const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const safeLimit =
    Number.isNaN(parsedLimit) || parsedLimit < 1 ? 20 : Math.min(parsedLimit, 100);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

module.exports = {
  REVIEW_STATUSES,
  isValidStatus,
  buildReviewListQuery,
  buildReviewSort,
  computeRatingAggregate,
  normalizePagination,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/review.helpers.test.js`
Expected: PASS, all tests green

- [ ] **Step 5: Commit**

```bash
git add server/services/review.helpers.js server/__tests__/review.helpers.test.js
git commit -m "feat(reviews): add pure review moderation helpers"
```

---

### Task 2: Fix the dead `Product.updateRating()`

**Files:**
- Modify: `server/models/Product.js:842-853`

**Interfaces:**
- Consumes: `computeRatingAggregate` from Task 1
- Produces: `product.updateRating()` — instance method, no arguments, always writes `averageRating` and `reviewCount`, returns the saved document

- [ ] **Step 1: Replace the method**

The current method takes an unused `newRating` argument and skips the write entirely when
no approved reviews match, stranding a stale rating. Replace lines 842-853 of
`server/models/Product.js` with:

```js
productSchema.methods.updateRating = async function updateRating() {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { product: this._id, status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const { averageRating, reviewCount } = computeRatingAggregate(stats);
  this.averageRating = averageRating;
  this.reviewCount = reviewCount;
  return this.save();
};
```

- [ ] **Step 2: Add the helper import**

At the top of `server/models/Product.js`, alongside the other requires, add:

```js
const { computeRatingAggregate } = require('../services/review.helpers');
```

Verify this does not create a require cycle: `review.helpers.js` imports nothing.

- [ ] **Step 3: Verify the module still loads**

Run: `cd server && node -e "require('./models/Product'); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 4: Run the full suite for regressions**

Run: `cd server && npm test 2>&1 | tail -20`
Expected: no NEW failures versus the pre-existing baseline

- [ ] **Step 5: Commit**

```bash
git add server/models/Product.js
git commit -m "fix(reviews): make Product.updateRating always write, including zero"
```

---

### Task 3: Review service

**Files:**
- Create: `server/services/review.service.js`

**Interfaces:**
- Consumes: Task 1 helpers; `product.updateRating()` from Task 2
- Produces:
  - `listReviews(filters, pagination) -> { reviews, pagination: { page, limit, total, pages }, counts }`
  - `getReviewStats() -> { total, pending, approved, rejected, hidden, averageRating }`
  - `moderateReview(reviewId, { status, note }, moderatorId) -> review`
  - `deleteReview(reviewId) -> { success: true }`

- [ ] **Step 1: Write the service**

Create `server/services/review.service.js`:

```js
// server/services/review.service.js
const Review = require('../models/Review');
const Product = require('../models/Product');
const { ValidationError, NotFoundError } = require('../utils/errors');
const {
  REVIEW_STATUSES,
  isValidStatus,
  buildReviewListQuery,
  buildReviewSort,
  normalizePagination,
} = require('./review.helpers');

const isObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id || ''));

// Recompute the denormalised rating on the product a review belongs to.
// Never let an aggregate failure mask the moderation action itself.
const syncProductRating = async (productId) => {
  const product = await Product.findById(productId);
  if (product) await product.updateRating();
};

const listReviews = async (filters = {}, pagination = {}) => {
  const query = buildReviewListQuery(filters);
  const { page, limit, skip } = normalizePagination(pagination);
  const sort = buildReviewSort(filters.sortBy);

  const [total, reviews, statusCounts] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query)
      .populate('user', 'firstName lastName name email avatar')
      .populate('product', 'name slug images averageRating reviewCount')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const counts = REVIEW_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  statusCounts.forEach((row) => {
    if (row._id in counts) counts[row._id] = row.count;
  });
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    reviews,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 0 },
    counts,
  };
};

const getReviewStats = async () => {
  const [rows] = await Review.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        overall: [{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }],
      },
    },
  ]);

  const stats = REVIEW_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  (rows?.byStatus || []).forEach((row) => {
    if (row._id in stats) stats[row._id] = row.count;
  });

  const overall = rows?.overall?.[0];
  return {
    ...stats,
    total: overall?.count || 0,
    averageRating: overall ? Math.round((overall.avg || 0) * 10) / 10 : 0,
  };
};

const moderateReview = async (reviewId, { status, note } = {}, moderatorId) => {
  if (!isObjectId(reviewId)) throw new ValidationError('Invalid review ID');
  if (!isValidStatus(status)) {
    throw new ValidationError(`Status must be one of: ${REVIEW_STATUSES.join(', ')}`);
  }

  const review = await Review.findById(reviewId);
  if (!review) throw new NotFoundError('Review not found');

  review.status = status;
  review.moderatedBy = moderatorId;
  review.moderatedAt = new Date();
  if (note !== undefined) review.moderationNote = note;
  await review.save();

  await syncProductRating(review.product);

  return Review.findById(reviewId)
    .populate('user', 'firstName lastName name email avatar')
    .populate('product', 'name slug images averageRating reviewCount')
    .lean();
};

const deleteReview = async (reviewId) => {
  if (!isObjectId(reviewId)) throw new ValidationError('Invalid review ID');

  const review = await Review.findById(reviewId);
  if (!review) throw new NotFoundError('Review not found');

  const productId = review.product;
  await review.deleteOne();
  await syncProductRating(productId);

  return { success: true };
};

module.exports = { listReviews, getReviewStats, moderateReview, deleteReview };
```

- [ ] **Step 2: Verify the module loads**

Run: `cd server && node -e "const s=require('./services/review.service'); console.log(Object.keys(s).join(','))"`
Expected: prints `listReviews,getReviewStats,moderateReview,deleteReview`

- [ ] **Step 3: Commit**

```bash
git add server/services/review.service.js
git commit -m "feat(reviews): add review moderation service"
```

---

### Task 4: Controller, routes, and mount

**Files:**
- Create: `server/controllers/review.controller.js`
- Create: `server/routes/review.routes.js`
- Modify: `server/server.js` (requires block near line 49, mount block near line 195)

**Interfaces:**
- Consumes: Task 3 service
- Produces: `GET /api/reviews`, `GET /api/reviews/stats`, `PATCH /api/reviews/:id/status`, `DELETE /api/reviews/:id`

- [ ] **Step 1: Write the controller**

Create `server/controllers/review.controller.js`:

```js
// server/controllers/review.controller.js
const asyncHandler = require('../utils/asyncHandler');
const reviewService = require('../services/review.service');

// @desc   List reviews for moderation
// @route  GET /api/reviews
// @access Super admin
const listReviews = asyncHandler(async (req, res) => {
  const { status, product, rating, verified, withImages, search, sortBy, page, limit } = req.query;
  const result = await reviewService.listReviews(
    { status, product, rating, verified, withImages, search, sortBy },
    { page, limit }
  );
  res.json({ success: true, ...result });
});

// @desc   Review counts and averages
// @route  GET /api/reviews/stats
// @access Super admin
const getReviewStats = asyncHandler(async (req, res) => {
  const stats = await reviewService.getReviewStats();
  res.json({ success: true, data: stats });
});

// @desc   Approve / reject / hide / re-pend a review
// @route  PATCH /api/reviews/:id/status
// @access Super admin
const moderateReview = asyncHandler(async (req, res) => {
  const review = await reviewService.moderateReview(
    req.params.id,
    { status: req.body.status, note: req.body.note },
    req.user._id
  );
  res.json({ success: true, message: `Review ${req.body.status}`, data: review });
});

// @desc   Delete a review
// @route  DELETE /api/reviews/:id
// @access Super admin
const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.params.id);
  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { listReviews, getReviewStats, moderateReview, deleteReview };
```

- [ ] **Step 2: Write the routes**

Create `server/routes/review.routes.js`:

```js
// routes/review.routes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { protect, superAdminOnly } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');
const { REVIEW_STATUSES } = require('../services/review.helpers');

// Every review moderation route is platform-level: reviews attach to shared
// Product documents, so a tenant admin must not be able to moderate them.
router.use(protect, superAdminOnly);

router.get('/', reviewController.listReviews);

router.get('/stats', reviewController.getReviewStats);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('status').isIn(REVIEW_STATUSES).withMessage('Invalid status'),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  reviewController.moderateReview
);

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid review ID')],
  validate,
  reviewController.deleteReview
);

module.exports = router;
```

Note: `/stats` is declared before any `/:id` route, so it is never shadowed.

- [ ] **Step 3: Mount in server.js**

In `server/server.js`, next to the other route requires (near line 49) add:

```js
const reviewRoutes            = require('./routes/review.routes');
```

And next to the other mounts (near line 195, after `app.use('/api/products', productRoutes);`) add:

```js
app.use('/api/reviews',            reviewRoutes);
```

- [ ] **Step 4: Verify the server boots**

Run: `cd server && node -e "require('./routes/review.routes'); console.log('routes ok')"`
Expected: prints `routes ok`

Then confirm `validate` is a real export:
Run: `cd server && node -e "const v=require('./middleware/validation.middleware'); console.log(typeof v.validate)"`
Expected: prints `function`. If it prints `undefined`, check how `server/routes/product.routes.js` uses it and match that.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/review.controller.js server/routes/review.routes.js server/server.js
git commit -m "feat(reviews): expose admin review moderation API"
```

---

### Task 5: Pending-review notification

**Files:**
- Modify: `server/models/Notification.js:12-25` (type enum)
- Modify: `server/services/notification.service.js` (add function, export it)
- Modify: `server/controllers/product.controller.js:1111-1130` (fire after create)

**Interfaces:**
- Consumes: existing `getSuperAdmins()`, `createNotification()`
- Produces: `sendNewReviewPendingNotification(reviewId) -> notification | null`

- [ ] **Step 1: Extend the Notification type enum**

In `server/models/Notification.js`, add `'new_review_pending',` to the `type` enum array immediately after `'product_rejected',`.

- [ ] **Step 2: Add the notification function**

In `server/services/notification.service.js`, add near `sendNewProductPendingNotification`:

```js
const sendNewReviewPendingNotification = async (reviewId) => {
  const Review = mongoose.model('Review');
  const review = await Review.findById(reviewId)
    .populate('product', 'name')
    .populate('user', 'firstName lastName name email')
    .lean();

  if (!review) return null;

  const superAdmins = await getSuperAdmins();
  if (!superAdmins.length) return null;

  const reviewerName =
    review.user?.name ||
    [review.user?.firstName, review.user?.lastName].filter(Boolean).join(' ') ||
    'A customer';
  const productName = review.product?.name || 'a product';

  return createNotification({
    type: 'new_review_pending',
    title: 'New Review Pending Moderation',
    message: `${reviewerName} left a ${review.rating}-star review on "${productName}" that is awaiting moderation.`,
    shortMessage: `New ${review.rating}★ review on "${productName}"`,
    product: review.product?._id,
    user: review.user?._id,
    priority: 'normal',
    actionUrl: '/ecommerce/reviews',
    actionLabel: 'Moderate Review',
    metadata: {
      reviewId: String(review._id),
      productName,
      rating: review.rating,
      reviewerName,
    },
    recipients: superAdmins.map((a) => a._id),
  });
};
```

Add `sendNewReviewPendingNotification,` to the `module.exports` object at line 358.

- [ ] **Step 3: Fire it on submission**

In `server/controllers/product.controller.js`, immediately after the `const review = await Review.create({...})` call (around line 1111) and BEFORE the `res.status(...)` response, add:

```js
  // Fire-and-forget: a notification failure must never fail the customer's review.
  notificationService
    .sendNewReviewPendingNotification(review._id)
    .catch((err) => console.error('[reviews] pending notification failed:', err.message));
```

Confirm `notificationService` is already required at the top of the file. If it is not, add:

```js
const notificationService = require('../services/notification.service');
```

- [ ] **Step 4: Verify modules load**

Run: `cd server && node -e "const n=require('./services/notification.service'); console.log(typeof n.sendNewReviewPendingNotification)"`
Expected: prints `function`

Run: `cd server && npm test 2>&1 | tail -20`
Expected: no NEW failures versus baseline

- [ ] **Step 5: Commit**

```bash
git add server/models/Notification.js server/services/notification.service.js server/controllers/product.controller.js
git commit -m "feat(reviews): notify super admins when a review needs moderation"
```

---

### Task 6: Admin review service

**Files:**
- Create: `client/apps/admin/src/services/review.service.ts`

**Interfaces:**
- Consumes: Task 4 API
- Produces: `reviewService.getReviews(token, params)`, `.getStats(token)`, `.setStatus(id, status, token, note?)`, `.deleteReview(id, token)`

- [ ] **Step 1: Write the service**

Create `client/apps/admin/src/services/review.service.ts`, following the `banner.service.ts` pattern exactly:

```ts
// Services for review moderation API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function handle(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
}

export const reviewService = {
  async getReviews(token: string, params?: Record<string, any>) {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== '' && v != null)
    );
    const queryString = new URLSearchParams(clean as any).toString();
    return handle(
      await fetch(`${API_URL}/api/reviews${queryString ? `?${queryString}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  },

  async getStats(token: string) {
    return handle(
      await fetch(`${API_URL}/api/reviews/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  },

  async setStatus(id: string, status: string, token: string, note?: string) {
    return handle(
      await fetch(`${API_URL}/api/reviews/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      })
    );
  },

  async deleteReview(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add client/apps/admin/src/services/review.service.ts
git commit -m "feat(admin): add review moderation service client"
```

---

### Task 7: Rebuild the admin Reviews table

**Files:**
- Rewrite: `client/apps/admin/src/app/shared/ecommerce/review/table.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/ecommerce/reviews/page.tsx`
- Delete: `client/apps/admin/src/app/shared/ecommerce/review/columns.tsx` and `filters.tsx` (both are bound to the demo fixture shape)

**Interfaces:**
- Consumes: Task 6 `reviewService`

- [ ] **Step 1: Rewrite the table**

Replace the entire contents of `client/apps/admin/src/app/shared/ecommerce/review/table.tsx`, following the `client/apps/admin/src/app/shared/blog/blog-list/table.tsx` pattern: `// @ts-nocheck` + `'use client'` header, `useSession()` for the token (`session?.token || session?.user?.token || ''`), a `useCallback` fetch keyed on the filter state, a `useEffect` that runs when `sessionStatus === 'authenticated'`, skeleton loading state, error state, empty state, and `react-hot-toast` on every action.

It must render:
- Status filter tabs — All / Pending / Approved / Rejected / Hidden — each showing its count from `counts`, with Pending selected by default (that is the queue the admin actually needs)
- A rating `Select` filter (All / 5 / 4 / 3 / 2 / 1) and a search `Input`
- One card or row per review showing: reviewer name and avatar, star rating, title, comment, product name and thumbnail, `isVerifiedPurchase` badge, review images if present, and `createdAt`
- Per-row action buttons: **Approve** (hidden when already approved), **Reject**, **Hide**, **Delete**. Each calls the matching `reviewService` method, toasts success or `err.message`, then refetches.
- A confirmation step before Delete. Use an inline two-click confirm or a rizzui `Popover` — do NOT use `window.confirm`, which blocks the browser automation tooling.

- [ ] **Step 2: Clean up the page header**

In `client/apps/admin/src/app/(hydrogen)/ecommerce/reviews/page.tsx`, remove the "Add Review" `<Link>`/`<Button>` block (lines 35-43) and the now-unused `Link`, `PiPlusBold`, and `Button` imports. Admins do not author reviews. Leave `PageHeader` and `ReviewsTable`.

- [ ] **Step 3: Delete the demo-bound files**

```bash
git rm client/apps/admin/src/app/shared/ecommerce/review/columns.tsx \
       client/apps/admin/src/app/shared/ecommerce/review/filters.tsx
```

Then confirm nothing else imports them:
Run: `grep -rn "ecommerce/review/columns\|ecommerce/review/filters" client/apps/admin/src`
Expected: no output

Also confirm the demo fixture is no longer referenced from this feature:
Run: `grep -rn "data/product-reviews" client/apps/admin/src`
Expected: no output from the `shared/ecommerce/review` directory

- [ ] **Step 4: Typecheck**

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "\.next/types" | wc -l`
Expected: no more than the known baseline of 479 source errors. If the count rose, fix the new errors.

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/review client/apps/admin/src/app/\(hydrogen\)/ecommerce/reviews/page.tsx
git commit -m "feat(admin): replace demo reviews table with real moderation UI"
```

---

## Verification

- [ ] `cd server && npm test` — Task 1 tests green, no new failures elsewhere
- [ ] `cd client/apps/admin && npx tsc --noEmit` — no increase over the 479-error baseline
- [ ] Deferred to a permitted host (Atlas blocks this local IP): log in as super admin, open `/ecommerce/reviews`, confirm the Imperial Blue Blended Grain Whisky review appears under **Pending**, approve it, then confirm it renders on the platform product page and that the product's `averageRating` / `reviewCount` update.
