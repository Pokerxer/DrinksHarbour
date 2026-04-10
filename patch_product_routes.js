const fs = require('fs');
const file = 'server/routes/product.routes.js';
const code = fs.readFileSync(file, 'utf8');

const newRoute = `
/**
 * @route   GET /api/products/recommendations/personalized
 * @desc    Get personalized product recommendations
 * @access  Private
 */
router.get(
  '/recommendations/personalized',
  protect,
  productController.getPersonalizedRecommendations
);
`;

// Insert it right after the trending route
const insertPoint = 'router.get(\'/trending\', productController.getTrendingProducts);';
const insertIndex = code.indexOf(insertPoint) + insertPoint.length;

const finalCode = code.slice(0, insertIndex) + '\n' + newRoute + code.slice(insertIndex);
fs.writeFileSync(file, finalCode);
console.log('Successfully patched product.routes.js');
