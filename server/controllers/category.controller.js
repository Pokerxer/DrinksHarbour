const Category = require('../models/Category');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all categories with product counts
 * @route GET /api/categories
 * @access Public
 */
const getCategories = asyncHandler(async (req, res) => {
  const { status = 'published' } = req.query;

  const query = { status };

  const categories = await Category.find(query)
    .select('name slug description shortDescription tagline icon color featuredImage bannerImage thumbnailImage isFeatured isTrending isPopular displayOrder parent level')
    .sort({ order: 1, name: 1 })
    .lean();

  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      try {
        const productCount = await Product.countDocuments({
          category: category._id,
          status: 'approved'
        });
        return {
          ...category,
          productCount,
        };
      } catch (e) {
        console.error('Error counting products for category:', category.name, e.message);
        return {
          ...category,
          productCount: 0,
        };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: {
      categories: categoriesWithCount,
      total: categoriesWithCount.length,
    },
  });
});

/**
 * Get featured categories (with most products)
 * @route GET /api/categories/featured
 * @access Public
 */
const getFeaturedCategories = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const categories = await Category.find({ status: 'active', isFeatured: true })
    .select('name slug description image icon color')
    .sort({ order: 1 })
    .limit(parseInt(limit))
    .lean();

  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const productCount = await Product.countDocuments({
        category: category._id,
        status: 'approved'
      });
      return {
        ...category,
        productCount,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      categories: categoriesWithCount,
    },
  });
});

/**
 * Get category by ID
 * @route GET /api/categories/:id
 * @access Public
 */
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found',
    });
  }

  const productCount = await Product.countDocuments({
    category: category._id,
    status: 'approved'
  });

  res.status(200).json({
    success: true,
    data: {
      category: {
        ...category.toObject(),
        productCount,
      },
    },
  });
});

/**
 * Get category by slug
 * @route GET /api/categories/slug/:slug
 * @access Public
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found',
    });
  }

  const productCount = await Product.countDocuments({
    category: category._id,
    status: 'approved'
  });

  res.status(200).json({
    success: true,
    data: {
      category: {
        ...category.toObject(),
        productCount,
      },
    },
  });
});

module.exports = {
  getCategories,
  getFeaturedCategories,
  getCategoryById,
  getCategoryBySlug,
};
