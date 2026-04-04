const mongoose = require('mongoose');
const { Product } = require('../models/Product');
const User = require('../models/User');

const getPersonalizedRecommendations = async (userId, limit = 10) => {
  if (!userId) {
    return []; // Return empty array or throw error if not needed here
  }

  const user = await User.findById(userId).populate({
    path: 'recentlyViewedProducts.product',
    select: 'category subCategory brand tags flavors'
  }).lean();

  if (!user || !user.recentlyViewedProducts || user.recentlyViewedProducts.length === 0) {
    return []; // Handle empty array gracefully
  }

  const viewedProducts = user.recentlyViewedProducts
    .map(p => p.product)
    .filter(p => p != null);

  if (viewedProducts.length === 0) {
    return [];
  }

  const viewedIds = viewedProducts.map(p => p._id);
  
  // Extract all categories, subcategories, brands, tags, flavors viewed
  const categories = [...new Set(viewedProducts.map(p => p.category?.toString()).filter(Boolean))];
  const subCategories = [...new Set(viewedProducts.map(p => p.subCategory?.toString()).filter(Boolean))];
  const brands = [...new Set(viewedProducts.map(p => p.brand?.toString()).filter(Boolean))];
  
  const tags = [...new Set(viewedProducts.flatMap(p => p.tags?.map(t => t.toString())).filter(Boolean))];
  const flavors = [...new Set(viewedProducts.flatMap(p => p.flavors?.map(f => f.toString())).filter(Boolean))];

  // Build matching logic using aggregation pipeline
  const recommendations = await Product.aggregate([
    {
      $match: {
        _id: { $nin: viewedIds },
        status: 'approved'
      }
    },
    {
      $addFields: {
        score: {
          $add: [
            // Category match: 30 points
            { $cond: [{ $in: [{ $toString: '$category' }, categories] }, 30, 0] },
            // SubCategory match: 25 points
            { $cond: [{ $in: [{ $toString: '$subCategory' }, subCategories] }, 25, 0] },
            // Brand match: 20 points
            { $cond: [{ $in: [{ $toString: '$brand' }, brands] }, 20, 0] },
            // Tag overlap
            {
              $multiply: [
                { $size: { $setIntersection: [{ $map: { input: { $ifNull: ['$tags', []] }, as: 't', in: { $toString: '$$t' } } }, tags] } },
                5
              ]
            },
            // Flavor overlap
            {
              $multiply: [
                { $size: { $setIntersection: [{ $map: { input: { $ifNull: ['$flavors', []] }, as: 'f', in: { $toString: '$$f' } } }, flavors] } },
                10
              ]
            }
          ]
        }
      }
    },
    { $match: { score: { $gt: 0 } } },
    { $sort: { score: -1, averageRating: -1, totalSales: -1 } },
    { $limit: limit }
  ]);

  if (recommendations.length < limit) {
    const additionalProducts = await Product.find({
      _id: { $nin: [...viewedIds, ...recommendations.map(r => r._id)] },
      status: 'approved'
    }).sort({ totalSales: -1, averageRating: -1 }).limit(limit - recommendations.length).lean();
    
    recommendations.push(...additionalProducts);
  }

  const populatedRecommendations = await Product.populate(recommendations, [
    { path: 'brand', select: 'name logo' },
    { path: 'category', select: 'name slug' },
    { path: 'subCategory', select: 'name slug' },
  ]);

  return populatedRecommendations;
};

module.exports = { getPersonalizedRecommendations };
