const fs = require('fs');
const file = 'server/services/product.service.js';
const code = fs.readFileSync(file, 'utf8');

const newFunc = `
// ============================================================================
// PERSONALIZED RECOMMENDATIONS (TEMU STYLE)
// ============================================================================
const getPersonalizedRecommendations = async (userId, limit = 10) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).populate({
      path: 'recentlyViewedProducts.product',
      select: 'category subCategory brand tags flavors'
    }).lean();

    const viewedProducts = user?.recentlyViewedProducts?.map(p => p.product).filter(p => p != null) || [];

    if (viewedProducts.length === 0) {
      // Fallback to bestsellers if no history
      return await getBestsellers(1, limit);
    }

    const viewedIds = viewedProducts.map(p => p._id);
    const categories = [...new Set(viewedProducts.map(p => p.category?.toString()).filter(Boolean))];
    const subCategories = [...new Set(viewedProducts.map(p => p.subCategory?.toString()).filter(Boolean))];

    // Simple fallback: just fetch products matching categories of viewed ones
    const recommendations = await Product.find({
      _id: { $nin: viewedIds },
      status: 'approved',
      $or: [
        { category: { $in: categories } },
        { subCategory: { $in: subCategories } }
      ]
    })
    .sort({ totalSales: -1, averageRating: -1 })
    .limit(limit)
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('tags', 'name slug')
    .lean();

    // Fill with bestsellers if not enough
    if (recommendations.length < limit) {
      const moreNeeded = limit - recommendations.length;
      const alreadyFoundIds = recommendations.map(r => r._id);
      
      const fillProducts = await Product.find({
        _id: { $nin: [...viewedIds, ...alreadyFoundIds] },
        status: 'approved'
      })
      .sort({ totalSales: -1, averageRating: -1 })
      .limit(moreNeeded)
      .populate('brand', 'name slug logo')
      .populate('category', 'name slug')
      .lean();

      return [...recommendations, ...fillProducts];
    }

    return recommendations;
  } catch (error) {
    console.error('Error in personalized recommendations:', error);
    return [];
  }
};
`;

const insertIndex = code.indexOf('module.exports = {');
const newCode = code.slice(0, insertIndex) + newFunc + '\n' + code.slice(insertIndex);

// Add to exports list
const exportsInsertIndex = newCode.indexOf('  getProductRecommendations,') + '  getProductRecommendations,'.length;
const finalCode = newCode.slice(0, exportsInsertIndex) + '\n  getPersonalizedRecommendations,' + newCode.slice(exportsInsertIndex);

fs.writeFileSync(file, finalCode);
console.log('Successfully patched product.service.js');
