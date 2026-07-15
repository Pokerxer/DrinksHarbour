// routes/banner-gemini.routes.js

const express = require('express');
const router = express.Router();
const bannerGeminiController = require('../controllers/banner-gemini.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body } = require('express-validator');

// ============================================================
// VALIDATION RULES
// ============================================================

const generateBannerValidation = [
  body('productId')
    .optional()
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('subcategoryId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subcategory ID'),
  body('brandId')
    .optional()
    .isMongoId()
    .withMessage('Invalid brand ID'),
  body('bannerType')
    .optional()
    .isIn(['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'])
    .withMessage('Invalid banner type'),
  body('placement')
    .optional()
    .isIn(['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'])
    .withMessage('Invalid placement'),
  body('style')
    .optional()
    .isIn(['playful', 'elegant', 'urgent', 'calm'])
    .withMessage('Invalid style'),
];

const generateSuggestionsValidation = [
  body('productId')
    .optional()
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('subcategoryId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subcategory ID'),
  body('brandId')
    .optional()
    .isMongoId()
    .withMessage('Invalid brand ID'),
  body('count')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Count must be between 1 and 5'),
];

const enhanceBannerValidation = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  body('subtitle')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subtitle cannot exceed 200 characters'),
  body('ctaText')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 30 })
    .withMessage('CTA text cannot exceed 30 characters'),
  body('goal')
    .optional()
    .isIn(['urgency', 'engagement', 'trust', 'conversions'])
    .withMessage('Invalid goal'),
  body('style')
    .optional()
    .isString()
    .trim(),
];

const enhanceFieldValidation = [
  body('field')
    .isIn(['title', 'subtitle', 'ctaText'])
    .withMessage('field must be one of title, subtitle, ctaText'),
  body('value')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('value is required')
    .isLength({ max: 200 })
    .withMessage('value cannot exceed 200 characters'),
  body('action')
    .optional()
    .isIn(['rewrite', 'expand', 'shorten', 'punchier'])
    .withMessage('Invalid action'),
];

const generateImagePromptValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  body('subtitle')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 }),
  body('bannerType')
    .optional()
    .isIn(['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'])
    .withMessage('Invalid banner type'),
  body('style')
    .optional()
    .isString()
    .trim(),
];

// ============================================================
// PROTECTED ROUTES (Admin/Tenant Admin)
// ============================================================

router.use(protect);
router.use(authorize('super_admin', 'tenant_admin', 'admin'));

/**
 * Get context data for banner generation (categories, products, brands)
 * @example GET /api/banner-ai/context-data
 */
router.get(
  '/context-data',
  bannerGeminiController.getContextData
);

/**
 * Generate complete banner content using AI
 * @example POST /api/banner-ai/generate
 * @body { productId?: string, categoryId?: string, brandId?: string, bannerType?: string, style?: string }
 */
router.post(
  '/generate',
  generateBannerValidation,
  validate,
  bannerGeminiController.generateBannerContent
);

/**
 * Generate multiple banner suggestions
 * @example POST /api/banner-ai/suggestions
 * @body { productId?: string, count?: number }
 */
router.post(
  '/suggestions',
  generateSuggestionsValidation,
  validate,
  bannerGeminiController.generateBannerSuggestions
);

/**
 * Enhance existing banner content
 * @example POST /api/banner-ai/enhance
 * @body { title?: string, subtitle?: string, ctaText?: string, goal?: string }
 */
router.post(
  '/enhance',
  enhanceBannerValidation,
  validate,
  bannerGeminiController.enhanceBannerContent
);

/**
 * Enhance a single banner copy field (per-field editor sparkle)
 * @example POST /api/banner-ai/enhance-field
 * @body { field: 'title'|'subtitle'|'ctaText', value: string, action?: string }
 */
router.post(
  '/enhance-field',
  enhanceFieldValidation,
  validate,
  bannerGeminiController.enhanceField
);

/**
 * Generate image prompt for banner
 * @example POST /api/banner-ai/image-prompt
 * @body { title: string, subtitle?: string, style?: string }
 */
router.post(
  '/image-prompt',
  generateImagePromptValidation,
  validate,
  bannerGeminiController.generateImagePrompt
);

module.exports = router;
