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
