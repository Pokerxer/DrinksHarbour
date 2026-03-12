// routes/promotion.routes.js

const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

// ════════════════════════════════════════════════════════════════════════════
// STATISTICS & UTILITIES (place before parameterized routes)
// ════════════════════════════════════════════════════════════════════════════

// Get promotion statistics
router.get('/stats', promotionController.getPromotionStats);

// Calculate discount for cart item
router.post('/calculate-discount', promotionController.calculateDiscount);

// Validate a promotion code
router.post('/validate-code', promotionController.validateCode);

// Get promotion by code
router.get('/code/:code', promotionController.getPromotionByCode);

// Get active promotions for a subproduct
router.get('/subproduct/:subProductId', promotionController.getPromotionsForSubProduct);

// ════════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

// List all promotions & Create new promotion
router.route('/')
  .get(promotionController.getPromotions)
  .post(promotionController.createPromotion);

// Get, Update, Delete a single promotion
router.route('/:id')
  .get(promotionController.getPromotionById)
  .patch(promotionController.updatePromotion)
  .delete(promotionController.deletePromotion);

// ════════════════════════════════════════════════════════════════════════════
// PROMOTION ACTIONS
// ════════════════════════════════════════════════════════════════════════════

// Activate a promotion
router.post('/:id/activate', promotionController.activatePromotion);

// Deactivate a promotion
router.post('/:id/deactivate', promotionController.deactivatePromotion);

// Duplicate a promotion
router.post('/:id/duplicate', promotionController.duplicatePromotion);

// Apply promotion to subproducts
router.post('/:id/apply', promotionController.applyToSubProducts);

// Remove subproducts from promotion
router.post('/:id/remove-products', promotionController.removeSubProducts);

// Apply promotion to sizes
router.post('/:id/apply-sizes', promotionController.applyToSizes);

module.exports = router;
