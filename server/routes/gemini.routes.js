// routes/gemini.routes.js
const express = require('express');
const router = express.Router();
const {
  generateProductDetails,
  generateDescription,
  generateOrigin,
  generateBeverageInfo,
  generateSeo,
  generateTags,
  generatePricing,
  generateShortDescription,
  generateFullDescription,
  generateFlavorProfile,
  generateFoodPairings,
  generateTastingNose,
  generateTastingPalate,
  generateTastingFinish,
  generateTastingColor,
  generateOriginCountry,
  generateRegion,
  generateAppellation,
  generateProducer,
  generateVintage,
  generateAgeStatement,
  generateProductionMethod,
  generateCaskType,
  generateServingTemperature,
  generateGlassware,
  generateGarnish,
  generateMixers,
  generateAllergens,
  generateIngredients,
  generateMetaTitle,
  generateMetaDescription,
  generateKeywords,
  generateDietary,
  generateNutritionalInfo,
  generateVolumeAbv,
  generateStandardSizes,
  generateSlug,
  generateBrandDescription,
  generateBrandCountry,
  generateBrandFounded,
  generateBrandCategory,
  getRecommendations,
} = require('../controllers/gemini.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All Gemini routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/gemini/generate-product
 * @desc    Generate complete product details from name
 * @access  Private
 */
router.post('/generate-product', generateProductDetails);

/**
 * @route   POST /api/gemini/generate-description
 * @desc    Generate product description only
 * @access  Private
 */
router.post('/generate-description', generateDescription);

/**
 * @route   POST /api/gemini/generate-origin
 * @desc    Generate origin and production details
 * @access  Private
 */
router.post('/generate-origin', generateOrigin);

/**
 * @route   POST /api/gemini/generate-beverage-info
 * @desc    Generate beverage information (ABV, volume, etc.)
 * @access  Private
 */
router.post('/generate-beverage-info', generateBeverageInfo);

/**
 * @route   POST /api/gemini/generate-seo
 * @desc    Generate SEO content
 * @access  Private
 */
router.post('/generate-seo', generateSeo);

/**
 * @route   POST /api/gemini/generate-tags
 * @desc    Generate product tags
 * @access  Private
 */
router.post('/generate-tags', generateTags);

/**
 * @route   POST /api/gemini/generate-pricing
 * @desc    Generate pricing suggestions
 * @access  Private
 */
router.post('/generate-pricing', generatePricing);

/**
 * @route   POST /api/gemini/short-description
 * @desc    Generate short description
 * @access  Private
 */
router.post('/short-description', generateShortDescription);

/**
 * @route   POST /api/gemini/full-description
 * @desc    Generate full description
 * @access  Private
 */
router.post('/full-description', generateFullDescription);

/**
 * @route   POST /api/gemini/flavor-profile
 * @desc    Generate flavor profile
 * @access  Private
 */
router.post('/flavor-profile', generateFlavorProfile);

/**
 * @route   POST /api/gemini/food-pairings
 * @desc    Generate food pairings
 * @access  Private
 */
router.post('/food-pairings', generateFoodPairings);

/**
 * @route   POST /api/gemini/tasting-nose
 * @desc    Generate tasting notes - nose
 * @access  Private
 */
router.post('/tasting-nose', generateTastingNose);

/**
 * @route   POST /api/gemini/tasting-palate
 * @desc    Generate tasting notes - palate
 * @access  Private
 */
router.post('/tasting-palate', generateTastingPalate);

/**
 * @route   POST /api/gemini/tasting-finish
 * @desc    Generate tasting notes - finish
 * @access  Private
 */
router.post('/tasting-finish', generateTastingFinish);

/**
 * @route   POST /api/gemini/tasting-color
 * @desc    Generate tasting notes - color
 * @access  Private
 */
router.post('/tasting-color', generateTastingColor);

/**
 * @route   POST /api/gemini/origin-country
 * @desc    Generate origin country
 * @access  Private
 */
router.post('/origin-country', generateOriginCountry);

/**
 * @route   POST /api/gemini/region
 * @desc    Generate region
 * @access  Private
 */
router.post('/region', generateRegion);

/**
 * @route   POST /api/gemini/appellation
 * @desc    Generate appellation
 * @access  Private
 */
router.post('/appellation', generateAppellation);

/**
 * @route   POST /api/gemini/producer
 * @desc    Generate producer name
 * @access  Private
 */
router.post('/producer', generateProducer);

/**
 * @route   POST /api/gemini/vintage
 * @desc    Generate vintage year
 * @access  Private
 */
router.post('/vintage', generateVintage);

/**
 * @route   POST /api/gemini/age-statement
 * @desc    Generate age statement
 * @access  Private
 */
router.post('/age-statement', generateAgeStatement);

/**
 * @route   POST /api/gemini/production-method
 * @desc    Generate production method
 * @access  Private
 */
router.post('/production-method', generateProductionMethod);

/**
 * @route   POST /api/gemini/cask-type
 * @desc    Generate cask type
 * @access  Private
 */
router.post('/cask-type', generateCaskType);

/**
 * @route   POST /api/gemini/serving-temperature
 * @desc    Generate serving temperature
 * @access  Private
 */
router.post('/serving-temperature', generateServingTemperature);

/**
 * @route   POST /api/gemini/glassware
 * @desc    Generate glassware recommendation
 * @access  Private
 */
router.post('/glassware', generateGlassware);

/**
 * @route   POST /api/gemini/garnish
 * @desc    Generate garnish suggestions
 * @access  Private
 */
router.post('/garnish', generateGarnish);

/**
 * @route   POST /api/gemini/mixers
 * @desc    Generate mixer suggestions
 * @access  Private
 */
router.post('/mixers', generateMixers);

/**
 * @route   POST /api/gemini/allergens
 * @desc    Generate allergens list
 * @access  Private
 */
router.post('/allergens', generateAllergens);

/**
 * @route   POST /api/gemini/ingredients
 * @desc    Generate ingredients list
 * @access  Private
 */
router.post('/ingredients', generateIngredients);

/**
 * @route   POST /api/gemini/meta-title
 * @desc    Generate meta title
 * @access  Private
 */
router.post('/meta-title', generateMetaTitle);

/**
 * @route   POST /api/gemini/meta-description
 * @desc    Generate meta description
 * @access  Private
 */
router.post('/meta-description', generateMetaDescription);

/**
 * @route   POST /api/gemini/keywords
 * @desc    Generate SEO keywords
 * @access  Private
 */
router.post('/keywords', generateKeywords);

/**
 * @route   POST /api/gemini/dietary
 * @desc    Generate dietary info
 * @access  Private
 */
router.post('/dietary', generateDietary);

/**
 * @route   POST /api/gemini/nutritional-info
 * @desc    Generate nutritional info
 * @access  Private
 */
router.post('/nutritional-info', generateNutritionalInfo);

/**
 * @route   POST /api/gemini/volume-abv
 * @desc    Generate volume and ABV
 * @access  Private
 */
router.post('/volume-abv', generateVolumeAbv);

/**
 * @route   POST /api/gemini/standard-sizes
 * @desc    Generate standard sizes
 * @access  Private
 */
router.post('/standard-sizes', generateStandardSizes);

/**
 * @route   POST /api/gemini/slug
 * @desc    Generate URL slug
 * @access  Private
 */
router.post('/slug', generateSlug);

/**
 * @route   POST /api/gemini/brand-description
 * @desc    Generate brand description
 * @access  Private
 */
router.post('/brand-description', generateBrandDescription);

/**
 * @route   POST /api/gemini/brand-country
 * @desc    Generate brand country of origin
 * @access  Private
 */
router.post('/brand-country', generateBrandCountry);

/**
 * @route   POST /api/gemini/brand-founded
 * @desc    Generate brand founded year
 * @access  Private
 */
router.post('/brand-founded', generateBrandFounded);

/**
 * @route   POST /api/gemini/brand-category
 * @desc    Generate brand primary category
 * @access  Private
 */
router.post('/brand-category', generateBrandCategory);

/**
 * @route   POST /api/gemini/recommendations
 * @desc    Get beverage recommendations
 * @access  Private
 */
router.post('/recommendations', getRecommendations);

module.exports = router;
