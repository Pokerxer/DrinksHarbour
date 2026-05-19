const Category = require('../models/Category');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const cloudinaryService = require('../services/cloudinary.service');

async function uploadCategoryFile(file, altText) {
  const result = await cloudinaryService.uploadImage(file.buffer, {
    folder: 'categories',
    tags: ['category'],
  });
  return { url: result.url, publicId: result.publicId, alt: altText };
}

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

/**
 * Get all categories for admin (all statuses)
 * @route GET /api/categories/admin
 * @access Private (admin)
 */
const getAdminCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find()
    .select('name slug type status thumbnailImage description displayOrder isFeatured parent level createdAt')
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      try {
        const productCount = await Product.countDocuments({ category: category._id });
        return { ...category, productCount };
      } catch (e) {
        return { ...category, productCount: 0 };
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
 * Convert FormData string booleans to real booleans
 */
function toBool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1';
}

/**
 * Create a new category
 * @route POST /api/categories/admin
 * @access Private (admin)
 */
const createCategory = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    type,
    subType,
    alcoholCategory = 'alcoholic',
    displayName,
    tagline,
    description,
    shortDescription,
    status = 'draft',
    displayOrder,
    parent,
    defaultSort,
    isFeatured,
    isTrending,
    isPopular,
    isNewArrival,
    showInMenu,
    showOnHomepage,
    color,
    icon,
    metaTitle,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    notes,
  } = req.body;

  const safeDisplayOrder = displayOrder !== undefined && !isNaN(Number(displayOrder))
    ? Number(displayOrder)
    : 999;

  const categoryData = {
    name,
    slug,
    type,
    alcoholCategory,
    description,
    shortDescription,
    status,
    displayOrder: safeDisplayOrder,
    parent: parent || null,
    isFeatured: toBool(isFeatured, false),
    isTrending: toBool(isTrending, false),
    isPopular: toBool(isPopular, false),
    isNewArrival: toBool(isNewArrival, false),
    showInMenu: toBool(showInMenu, true),
    showOnHomepage: toBool(showOnHomepage, false),
    createdBy: req.user?._id,
  };

  if (displayName) categoryData.displayName = displayName;
  if (tagline) categoryData.tagline = tagline;
  if (subType) categoryData.subType = subType;
  if (color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) categoryData.color = color;
  if (icon) categoryData.icon = icon;
  if (defaultSort) categoryData.defaultSort = defaultSort;
  if (notes) categoryData.notes = notes;
  if (metaTitle) categoryData.metaTitle = metaTitle;
  if (metaDescription) categoryData.metaDescription = metaDescription;
  if (metaKeywords) categoryData.metaKeywords = String(metaKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  if (canonicalUrl) categoryData.canonicalUrl = canonicalUrl;

  if (status === 'published') {
    categoryData.publishedAt = new Date();
    categoryData.publishedBy = req.user?._id;
  }

  if (req.files?.thumbnailImage?.[0]) {
    categoryData.thumbnailImage = await uploadCategoryFile(req.files.thumbnailImage[0], name);
  }
  if (req.files?.featuredImage?.[0]) {
    categoryData.featuredImage = await uploadCategoryFile(req.files.featuredImage[0], name);
  }
  if (req.files?.bannerImage?.[0]) {
    categoryData.bannerImage = await uploadCategoryFile(req.files.bannerImage[0], name);
  }

  const category = new Category(categoryData);
  await category.save();

  res.status(201).json({
    success: true,
    data: { category },
  });
});

/**
 * Update an existing category
 * @route PUT /api/categories/admin/:id
 * @access Private (admin)
 */
const updateCategory = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    type,
    subType,
    alcoholCategory,
    displayName,
    tagline,
    description,
    shortDescription,
    status,
    displayOrder,
    parent,
    defaultSort,
    isFeatured,
    isTrending,
    isPopular,
    isNewArrival,
    showInMenu,
    showOnHomepage,
    color,
    icon,
    metaTitle,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    notes,
  } = req.body;

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (type !== undefined) updateData.type = type;
  if (alcoholCategory !== undefined) updateData.alcoholCategory = alcoholCategory;
  if (description !== undefined) updateData.description = description;
  if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (tagline !== undefined) updateData.tagline = tagline;
  if (subType !== undefined) updateData.subType = subType;
  if (color !== undefined && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) updateData.color = color;
  if (icon !== undefined) updateData.icon = icon;
  if (defaultSort !== undefined) updateData.defaultSort = defaultSort;
  if (notes !== undefined) updateData.notes = notes;
  if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
  if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
  if (metaKeywords !== undefined) updateData.metaKeywords = String(metaKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  if (canonicalUrl !== undefined) updateData.canonicalUrl = canonicalUrl;

  if (displayOrder !== undefined) {
    const n = Number(displayOrder);
    updateData.displayOrder = isNaN(n) ? 999 : n;
  }

  // null properly clears the parent reference (model default is null)
  if (parent !== undefined) updateData.parent = parent || null;

  updateData.isFeatured = toBool(isFeatured, false);
  updateData.isTrending = toBool(isTrending, false);
  updateData.isPopular = toBool(isPopular, false);
  updateData.isNewArrival = toBool(isNewArrival, false);
  updateData.showInMenu = toBool(showInMenu, true);
  updateData.showOnHomepage = toBool(showOnHomepage, false);
  updateData.updatedBy = req.user?._id;

  if (status !== undefined) {
    updateData.status = status;
    if (status === 'published') {
      const existing = await Category.findById(req.params.id).select('status publishedAt').lean();
      if (existing && existing.status !== 'published' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
        updateData.publishedBy = req.user?._id;
      }
    }
  }

  if (req.files?.thumbnailImage?.[0]) {
    updateData.thumbnailImage = await uploadCategoryFile(req.files.thumbnailImage[0], name || 'Category image');
  }
  if (req.files?.featuredImage?.[0]) {
    updateData.featuredImage = await uploadCategoryFile(req.files.featuredImage[0], name || 'Category image');
  }
  if (req.files?.bannerImage?.[0]) {
    updateData.bannerImage = await uploadCategoryFile(req.files.bannerImage[0], name || 'Category image');
  }

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  res.status(200).json({
    success: true,
    data: { category },
  });
});

/**
 * Delete a category
 * @route DELETE /api/categories/admin/:id
 * @access Private (admin)
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const productCount = await Product.countDocuments({ category: id });
  if (productCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete category with products',
    });
  }

  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Category deleted',
  });
});

const Groq = require('groq-sdk');

const fillWithAI = asyncHandler(async (req, res) => {
  const { name, type, alcoholCategory } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const prompt = `You are a content assistant for DrinksHarbour, Nigeria's premier online premium beverages store.

Generate category content for:
- Name: "${name}"${type ? `\n- Type: ${type.replace(/_/g, ' ')}` : ''}${alcoholCategory ? `\n- Alcohol Category: ${alcoholCategory.replace(/_/g, ' ')}` : ''}

Return ONLY a valid JSON object with these fields (no markdown, no explanation):
{
  "displayName": "display-friendly name, plural if appropriate (max 120 chars)",
  "tagline": "short punchy tagline that sells the category (max 150 chars)",
  "shortDescription": "2 sentences for listings and cards (max 280 chars)",
  "description": "3-4 paragraphs as plain text, compelling and informative (max 2000 chars)",
  "metaTitle": "SEO page title with brand context for Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords",
  "color": "hex color that fits the category mood (e.g. #C0812A for whiskey, #722F37 for wine)",
  "icon": "single most relevant emoji"
}`;

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim();

  let data;
  try {
    data = JSON.parse(clean);
  } catch {
    return res.status(500).json({ success: false, message: 'AI returned invalid JSON' });
  }

  res.json({ success: true, data });
});

module.exports = {
  getCategories,
  getFeaturedCategories,
  getCategoryById,
  getCategoryBySlug,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fillWithAI,
};
