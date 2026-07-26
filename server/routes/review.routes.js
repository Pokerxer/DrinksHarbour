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

/**
 * List reviews for moderation
 * @route GET /api/reviews
 */
router.get('/', reviewController.listReviews);

/**
 * Review counts and averages
 * @route GET /api/reviews/stats
 * Declared before any /:id route so it is never shadowed.
 */
router.get('/stats', reviewController.getReviewStats);

/**
 * Approve / reject / hide / re-pend a review
 * @route PATCH /api/reviews/:id/status
 */
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

/**
 * Delete a review
 * @route DELETE /api/reviews/:id
 */
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid review ID')],
  validate,
  reviewController.deleteReview
);

module.exports = router;
