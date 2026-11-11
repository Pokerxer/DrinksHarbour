// controllers/tenantReview.controller.js
//
// Customer ratings of a seller store (an approved Tenant). Consumed by the
// platform "vendors" surfaces:
//   GET  /api/stores/:slug/reviews        — public, approved reviews + summary
//   POST /api/stores/:slug/reviews        — logged-in customer, verified purchase
//   PATCH /api/stores/reviews/:id/status  — super-admin moderation
//
// Rules mirror product reviews (product.controller.submitProductReview):
// a customer can only review a seller they have actually received an order
// from, and every review waits for moderation before it shows.

const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const TenantReview = require('../models/TenantReview');
const Tenant = require('../models/Tenant');
const Order = require('../models/Order');
const {
  computeRatingAggregate,
  buildRatingSummary,
  normalizePagination,
  isValidStatus,
} = require('../services/review.helpers');
const notificationService = require('../services/notification.service');

/**
 * Recomputes the denormalised rating aggregate on the Tenant document from
 * approved reviews only. Always writes — zero approved reviews must reset the
 * aggregate, not leave a stale rating behind (same contract as
 * productSchema.methods.updateRating).
 */
async function recalcTenantRating(tenantId) {
  const stats = await TenantReview.aggregate([
    { $match: { tenant: new mongoose.Types.ObjectId(String(tenantId)), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const { averageRating, reviewCount } = computeRatingAggregate(stats);
  await Tenant.updateOne({ _id: tenantId }, { ratingAvg: averageRating, ratingCount: reviewCount });
  return { averageRating, reviewCount };
}

/** Safe public shape of a review — never exposes user IDs or emails. */
function toPublicReview(review) {
  const user = review.user ?? {};
  return {
    _id: review._id,
    rating: review.rating,
    title: review.title || null,
    comment: review.comment,
    isVerifiedPurchase: review.isVerifiedPurchase,
    createdAt: review.createdAt,
    reviewer: {
      firstName: user.firstName || null,
      lastNameInitial: user.lastName ? `${String(user.lastName).trim()[0]}.` : null,
    },
  };
}

/**
 * @route  GET /api/stores/:slug/reviews
 * @access Public
 * @query  page, limit
 */
exports.getStoreReviews = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne({ slug: req.params.slug, status: 'approved' })
    .select('_id')
    .lean();
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  const { page, limit, skip } = normalizePagination(req.query);

  const [reviews, total, ratingGroups] = await Promise.all([
    TenantReview.find({ tenant: tenant._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName')
      .lean(),
    TenantReview.countDocuments({ tenant: tenant._id, status: 'approved' }),
    TenantReview.aggregate([
      { $match: { tenant: tenant._id, status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: buildRatingSummary(ratingGroups),
      reviews: reviews.map(toPublicReview),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

/**
 * @route  POST /api/stores/:slug/reviews
 * @access Private (logged-in customers)
 * @body   { rating, comment, title? }
 */
exports.createStoreReview = asyncHandler(async (req, res) => {
  const { rating, title, comment } = req.body;
  const userId = req.user._id;

  // ── Validate inputs (same bar as product reviews) ──────────────────────────
  if (!rating || !comment?.trim()) {
    return res.status(400).json({ success: false, message: 'Rating and comment are required' });
  }
  const ratingNum = parseInt(rating, 10);
  if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }
  if (comment.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Review must be at least 10 characters' });
  }

  // ── The store must be a live, approved tenant ──────────────────────────────
  const tenant = await Tenant.findOne({ slug: req.params.slug, status: 'approved' })
    .select('_id name')
    .lean();
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  // ── Duplicate check ────────────────────────────────────────────────────────
  const existing = await TenantReview.findOne({ user: userId, tenant: tenant._id }).lean();
  if (existing) {
    return res
      .status(400)
      .json({ success: false, message: 'You have already submitted a review for this store' });
  }

  // ── Verified purchase only: a DELIVERED order containing this seller ───────
  const order = await Order.findOne({
    user: userId,
    status: 'delivered',
    'items.tenant': tenant._id,
  })
    .select('_id')
    .lean();
  if (!order) {
    return res.status(403).json({
      success: false,
      message: 'You can only rate a store after an order from it has been delivered to you.',
    });
  }

  const review = await TenantReview.create({
    user: userId,
    tenant: tenant._id,
    order: order._id,
    rating: ratingNum,
    title: title?.trim() || undefined,
    comment: comment.trim(),
    isVerifiedPurchase: true,
    status: 'pending',
  });

  // The freshly created doc holds an unpopulated user ref — build the safe
  // public shape from the authenticated caller instead.
  const publicReview = {
    ...toPublicReview(review),
    reviewer: {
      firstName: req.user.firstName || null,
      lastNameInitial: req.user.lastName ? `${String(req.user.lastName).trim()[0]}.` : null,
    },
  };

  // Fire-and-forget: a notification failure must never fail the customer's review.
  notificationService
    .createNotification({
      type: 'new_review_pending',
      title: 'New Store Review Pending Moderation',
      message: `A customer left a ${ratingNum}-star review of "${tenant.name}" that is awaiting moderation.`,
      shortMessage: `New ${ratingNum}★ store review of "${tenant.name}"`,
    })
    .catch(err => req.log?.error?.({ err }, 'store review pending notification failed'));

  res.status(201).json({
    success: true,
    message: 'Thank you! Your review has been submitted and will appear after moderation.',
    data: { review: publicReview },
  });
});

/**
 * @route  PATCH /api/stores/reviews/:id/status
 * @access Super admin
 * @body   { status, note? }
 */
exports.moderateStoreReview = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!isValidStatus(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const review = await TenantReview.findById(req.params.id);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  review.status = status;
  review.moderationNote = note?.trim() || undefined;
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  await review.save();

  // The public rating only ever counts approved reviews — recompute on any
  // status change so approvals, hides and rejections all stay reflected.
  const summary = await recalcTenantRating(review.tenant);

  res.status(200).json({
    success: true,
    message: `Review ${status}`,
    data: { review: toPublicReview(review), rating: summary },
  });
});
