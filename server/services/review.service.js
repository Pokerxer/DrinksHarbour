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
  counts.all = REVIEW_STATUSES.reduce((sum, s) => sum + counts[s], 0);

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
