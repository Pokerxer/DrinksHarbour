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
