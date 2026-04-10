const fs = require('fs');
const file = 'server/controllers/product.controller.js';
const code = fs.readFileSync(file, 'utf8');

const newFunc = `
/**
 * @desc    Get personalized product recommendations based on recently viewed
 * @route   GET /api/products/recommendations/personalized
 * @access  Private
 */
const getPersonalizedRecommendations = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  const recommendations = await productService.getPersonalizedRecommendations(req.user._id, limit);
  
  successResponse(res, {
    count: recommendations.length,
    data: recommendations,
  }, 'Personalized recommendations fetched successfully');
});
`;

const insertIndex = code.indexOf('module.exports = {');
const newCode = code.slice(0, insertIndex) + newFunc + '\n' + code.slice(insertIndex);

const exportsInsertIndex = newCode.indexOf('  getProductRecommendations,') + '  getProductRecommendations,'.length;
const finalCode = newCode.slice(0, exportsInsertIndex) + '\n  getPersonalizedRecommendations,' + newCode.slice(exportsInsertIndex);

fs.writeFileSync(file, finalCode);
console.log('Successfully patched product.controller.js');
