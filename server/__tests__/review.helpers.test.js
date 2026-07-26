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
  assert.deepStrictEqual(buildReviewListQuery({ withImages: 'true' }).images, {
    $exists: true,
    $ne: [],
  });
});

test('buildReviewListQuery turns search into a case-insensitive regex over title and comment', () => {
  const q = buildReviewListQuery({ search: 'smooth' });
  assert.ok(Array.isArray(q.$or));
  assert.strictEqual(q.$or.length, 2);
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
  assert.deepStrictEqual(computeRatingAggregate([{ _id: null, avg: 4.26, count: 7 }]), {
    averageRating: 4.3,
    reviewCount: 7,
  });
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
