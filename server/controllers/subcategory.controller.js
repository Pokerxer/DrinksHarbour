const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all subcategories with optional filtering
 * @route GET /api/subcategories
 * @access Public
 */
const getSubCategories = asyncHandler(async (req, res) => {
  const { category, status = 'published', featured, trending, popular } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (category) {
    query.parent = category;
  }

  if (featured === 'true') {
    query.isFeatured = true;
  }

  if (trending === 'true') {
    query.isTrending = true;
  }

  if (popular === 'true') {
    query.isPopular = true;
  }

  const subcategories = await SubCategory.find(query)
    .select('name slug type parent shortDescription description icon color featuredImage thumbnailImage bannerImage isFeatured isTrending isPopular displayOrder status')
    .sort({ displayOrder: 1, name: 1 })
    .populate('parent', 'name slug')
    .lean();

  const subcategoriesWithCount = await Promise.all(
    subcategories.map(async (subcategory) => {
      try {
        const productCount = await Product.countDocuments({
          subCategory: subcategory._id,
          status: 'approved'
        });
        return {
          ...subcategory,
          productCount,
        };
      } catch (e) {
        console.error('Error counting products for subcategory:', subcategory.name, e.message);
        return {
          ...subcategory,
          productCount: 0,
        };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: subcategoriesWithCount,
    total: subcategoriesWithCount.length,
  });
});

/**
 * Get subcategories by parent category ID
 * @route GET /api/subcategories/by-category/:categoryId
 * @access Public
 */
const getSubCategoriesByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { status = 'published' } = req.query;

  const query = {
    parent: categoryId,
    status: status
  };

  const subcategories = await SubCategory.find(query)
    .select('name slug type parent shortDescription description icon color featuredImage thumbnailImage bannerImage isFeatured isTrending isPopular displayOrder status')
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  const subcategoriesWithCount = await Promise.all(
    subcategories.map(async (subcategory) => {
      try {
        const productCount = await Product.countDocuments({
          subCategory: subcategory._id,
          status: 'approved'
        });
        return {
          ...subcategory,
          productCount,
        };
      } catch (e) {
        console.error('Error counting products for subcategory:', subcategory.name, e.message);
        return {
          ...subcategory,
          productCount: 0,
        };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: subcategoriesWithCount,
    total: subcategoriesWithCount.length,
  });
});

/**
 * Get subcategory by ID
 * @route GET /api/subcategories/:id
 * @access Public
 */
const getSubCategoryById = asyncHandler(async (req, res) => {
  const subcategory = await SubCategory.findById(req.params.id)
    .populate('parent', 'name slug');

  if (!subcategory) {
    return res.status(404).json({
      success: false,
      message: 'SubCategory not found',
    });
  }

  const productCount = await Product.countDocuments({
    subCategory: subcategory._id,
    status: 'approved'
  });

  res.status(200).json({
    success: true,
    data: {
      ...subcategory.toObject(),
      productCount,
    },
  });
});

/**
 * Get subcategory by slug
 * @route GET /api/subcategories/slug/:slug
 * @access Public
 */
const getSubCategoryBySlug = asyncHandler(async (req, res) => {
  const subcategory = await SubCategory.findOne({ slug: req.params.slug })
    .populate('parent', 'name slug');

  if (!subcategory) {
    return res.status(404).json({
      success: false,
      message: 'SubCategory not found',
    });
  }

  const productCount = await Product.countDocuments({
    subCategory: subcategory._id,
    status: 'approved'
  });

  res.status(200).json({
    success: true,
    data: {
      ...subcategory.toObject(),
      productCount,
    },
  });
});

/**
 * Get featured subcategories
 * @route GET /api/subcategories/featured
 * @access Public
 */
const getFeaturedSubCategories = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const subcategories = await SubCategory.find({ status: 'published', isFeatured: true })
    .select('name slug type parent shortDescription icon color featuredImage thumbnailImage displayOrder')
    .sort({ displayOrder: 1 })
    .limit(parseInt(limit))
    .populate('parent', 'name slug')
    .lean();

  const subcategoriesWithCount = await Promise.all(
    subcategories.map(async (subcategory) => {
      const productCount = await Product.countDocuments({
        subCategory: subcategory._id,
        status: 'approved'
      });
      return {
        ...subcategory,
        productCount,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: subcategoriesWithCount,
  });
});

module.exports = {
  getSubCategories,
  getSubCategoriesByCategory,
  getSubCategoryById,
  getSubCategoryBySlug,
  getFeaturedSubCategories,
};
