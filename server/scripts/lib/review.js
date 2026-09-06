// scripts/lib/review.js
//
// Post-purchase review flow.
//
// Server contract (server/controllers/product.controller.js):
//
//   GET  /api/products/:id/reviews/eligibility        protect
//     -> { canReview, reason, purchasedSizes: [{ orderId, subproductId, sizeId, sizeName }] }
//   POST /api/products/:id/reviews                    protect  (multipart w/ multer)
//     body: { rating (1-5), comment (>=10 chars), title?, orderId?,
//             subproductId?, sizeId?, sizeName? }
//     -> creates a Review with status:'pending', isVerifiedPurchase:true.
//     REJECTS with 403 unless the caller has an Order where:
//         user === caller._id AND status === 'delivered' AND items.product === productId
//     REJECTS with 400 on duplicate (user, product) reviews.
//
//   PATCH /api/reviews/:id/status                     superAdminOnly
//     body: { status: 'approved' | 'rejected' | 'hidden' | 'pending', note? }
//
// The eligibility check is not required — a well-formed submit request works —
// but calling it lets the seeder skip past ineligible combos (already-reviewed
// products, delivered order not yet visible) with a single request instead of
// eating a 403 on submit.

const { pickReview } = require('../data/review-templates');
const { intBetween } = require('./fake-data');

/**
 * @param {ApiClient} customerApi
 * @param {string} productId
 * @returns {Promise<{ canReview, reason, purchasedSizes }>}
 */
async function checkEligibility(customerApi, productId) {
  const res = await customerApi.get(`/api/products/${productId}/reviews/eligibility`);
  return res?.data || { canReview: false, reason: 'unknown', purchasedSizes: [] };
}

/**
 * Submit one review.
 * @param {ApiClient} customerApi
 * @param {object} args
 * @param {string} args.productId
 * @param {string} args.productType         Product.type    (e.g. 'spirit')
 * @param {string} [args.productSubType]    Product.subType (e.g. 'gin') — this is
 *                                          what makes the copy family accurate
 * @param {[number, number]} args.ratingRange  inclusive, e.g. [4, 5]
 * @param {object} [args.purchasedSize]     entry from eligibility.purchasedSizes
 * @param {() => number} args.random
 * @returns {Promise<{ reviewId: string, rating: number, family: string }>}
 */
async function submitReview(customerApi, {
  productId,
  productType,
  productSubType = null,
  ratingRange,
  purchasedSize = null,
  random = Math.random,
}) {
  const rating = intBetween(ratingRange[0], ratingRange[1], random);
  // Rating is chosen FIRST so the copy tier can match the score — a 3-star
  // review must not carry 5-star wording.
  const { title, comment, family } = pickReview({
    type: productType, subType: productSubType, rating, random,
  });

  const body = {
    rating,
    title,
    comment,
  };
  if (purchasedSize?.orderId)      body.orderId = purchasedSize.orderId;
  if (purchasedSize?.subproductId) body.subproductId = purchasedSize.subproductId;
  if (purchasedSize?.sizeId)       body.sizeId = purchasedSize.sizeId;
  if (purchasedSize?.sizeName)     body.sizeName = purchasedSize.sizeName;

  const res = await customerApi.post(`/api/products/${productId}/reviews`, body);
  const review = res?.data?.review;
  if (!review?._id) {
    throw new Error(
      `Review submit response missing data.review._id — keys: ${Object.keys(res?.data || {}).join(',')}`,
    );
  }
  return { reviewId: String(review._id), rating, family };
}

/**
 * Moderate a review to `approved` so it shows up on the storefront.
 * Requires a super_admin JWT (server/routes/review.routes.js: superAdminOnly).
 */
async function approveReview(superAdminApi, reviewId) {
  await superAdminApi.patch(`/api/reviews/${reviewId}/status`, {
    status: 'approved',
    note: 'Auto-approved by purchase seeder',
  });
}

module.exports = { checkEligibility, submitReview, approveReview };
