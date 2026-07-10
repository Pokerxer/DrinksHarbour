const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const cloudinaryService = require('../services/cloudinary.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1';
}

async function uploadSubCategoryFile(file, altText) {
  const result = await cloudinaryService.uploadImage(file.buffer, {
    folder: 'subcategories',
    tags: ['subcategory'],
  });
  return { url: result.url, publicId: result.publicId, alt: altText };
}

// ─── Public routes ────────────────────────────────────────────────────────────

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

// ─── Admin routes ─────────────────────────────────────────────────────────────

/**
 * Get all subcategories for admin (all statuses)
 * @route GET /api/subcategories/admin
 * @access Private (admin)
 */
const getAdminSubCategories = asyncHandler(async (req, res) => {
  const subcategories = await SubCategory.find()
    .select('name slug type style status thumbnailImage description displayOrder isFeatured parent createdAt')
    .sort({ displayOrder: 1, name: 1 })
    .populate('parent', 'name slug')
    .lean();

  const subcategoriesWithCount = await Promise.all(
    subcategories.map(async (subcategory) => {
      try {
        const productCount = await Product.countDocuments({ subCategory: subcategory._id });
        return { ...subcategory, productCount };
      } catch (e) {
        return { ...subcategory, productCount: 0 };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: {
      subcategories: subcategoriesWithCount,
      total: subcategoriesWithCount.length,
    },
  });
});

/**
 * Create a new subcategory
 * @route POST /api/subcategories/admin
 * @access Private (admin)
 */
const createSubCategory = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    type,
    subType,
    style,
    displayName,
    tagline,
    description,
    shortDescription,
    status = 'draft',
    displayOrder,
    parent,
    isFeatured,
    isTrending,
    isPopular,
    showInMenu,
    color,
    icon,
    metaTitle,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    notes,
    typicalFlavors,
    commonPairings,
    seasonalSpring,
    seasonalSummer,
    seasonalFall,
    seasonalWinter,
  } = req.body;

  const safeDisplayOrder = displayOrder !== undefined && !isNaN(Number(displayOrder))
    ? Number(displayOrder)
    : 999;

  const subcategoryData = {
    name,
    slug,
    parent,
    status,
    displayOrder: safeDisplayOrder,
    isFeatured: toBool(isFeatured, false),
    isTrending: toBool(isTrending, false),
    isPopular: toBool(isPopular, false),
    showInMenu: toBool(showInMenu, true),
    seasonal: {
      spring: toBool(seasonalSpring, false),
      summer: toBool(seasonalSummer, false),
      fall: toBool(seasonalFall, false),
      winter: toBool(seasonalWinter, false),
    },
    createdBy: req.user?._id,
  };

  if (type) subcategoryData.type = type;
  if (subType) subcategoryData.subType = subType;
  if (style) subcategoryData.style = style;
  if (displayName) subcategoryData.displayName = displayName;
  if (tagline) subcategoryData.tagline = tagline;
  if (description) subcategoryData.description = description;
  if (shortDescription) subcategoryData.shortDescription = shortDescription;
  if (color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) subcategoryData.color = color;
  if (icon) subcategoryData.icon = icon;
  if (notes) subcategoryData.notes = notes;
  if (metaTitle) subcategoryData.metaTitle = metaTitle;
  if (metaDescription) subcategoryData.metaDescription = metaDescription;
  if (metaKeywords) subcategoryData.metaKeywords = String(metaKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  if (canonicalUrl) subcategoryData.canonicalUrl = canonicalUrl;
  if (typicalFlavors) subcategoryData.typicalFlavors = String(typicalFlavors).split(',').map((f) => f.trim()).filter(Boolean);
  if (commonPairings) subcategoryData.commonPairings = String(commonPairings).split(',').map((p) => p.trim()).filter(Boolean);

  if (status === 'published') {
    subcategoryData.publishedAt = new Date();
    subcategoryData.publishedBy = req.user?._id;
  }

  if (req.files?.thumbnailImage?.[0]) {
    subcategoryData.thumbnailImage = await uploadSubCategoryFile(req.files.thumbnailImage[0], name);
  }
  if (req.files?.featuredImage?.[0]) {
    subcategoryData.featuredImage = await uploadSubCategoryFile(req.files.featuredImage[0], name);
  }
  if (req.files?.bannerImage?.[0]) {
    subcategoryData.bannerImage = await uploadSubCategoryFile(req.files.bannerImage[0], name);
  }

  const subcategory = new SubCategory(subcategoryData);
  await subcategory.save();

  res.status(201).json({
    success: true,
    data: { subcategory },
  });
});

/**
 * Update an existing subcategory
 * @route PUT /api/subcategories/admin/:id
 * @access Private (admin)
 */
const updateSubCategory = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    type,
    subType,
    style,
    displayName,
    tagline,
    description,
    shortDescription,
    status,
    displayOrder,
    parent,
    isFeatured,
    isTrending,
    isPopular,
    showInMenu,
    color,
    icon,
    metaTitle,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    notes,
    typicalFlavors,
    commonPairings,
    seasonalSpring,
    seasonalSummer,
    seasonalFall,
    seasonalWinter,
  } = req.body;

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (type !== undefined) updateData.type = type;
  if (subType !== undefined) updateData.subType = subType;
  if (style !== undefined) updateData.style = style;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (tagline !== undefined) updateData.tagline = tagline;
  if (description !== undefined) updateData.description = description;
  if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
  if (color !== undefined && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) updateData.color = color;
  if (icon !== undefined) updateData.icon = icon;
  if (notes !== undefined) updateData.notes = notes;
  if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
  if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
  if (metaKeywords !== undefined) updateData.metaKeywords = String(metaKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  if (canonicalUrl !== undefined) updateData.canonicalUrl = canonicalUrl;
  if (typicalFlavors !== undefined) updateData.typicalFlavors = String(typicalFlavors).split(',').map((f) => f.trim()).filter(Boolean);
  if (commonPairings !== undefined) updateData.commonPairings = String(commonPairings).split(',').map((p) => p.trim()).filter(Boolean);

  if (displayOrder !== undefined) {
    const n = Number(displayOrder);
    updateData.displayOrder = isNaN(n) ? 999 : n;
  }

  if (parent !== undefined) updateData.parent = parent;

  updateData.isFeatured = toBool(isFeatured, false);
  updateData.isTrending = toBool(isTrending, false);
  updateData.isPopular = toBool(isPopular, false);
  updateData.showInMenu = toBool(showInMenu, true);
  updateData.updatedBy = req.user?._id;

  if (seasonalSpring !== undefined || seasonalSummer !== undefined || seasonalFall !== undefined || seasonalWinter !== undefined) {
    updateData['seasonal.spring'] = toBool(seasonalSpring, false);
    updateData['seasonal.summer'] = toBool(seasonalSummer, false);
    updateData['seasonal.fall'] = toBool(seasonalFall, false);
    updateData['seasonal.winter'] = toBool(seasonalWinter, false);
  }

  if (status !== undefined) {
    updateData.status = status;
    if (status === 'published') {
      const existing = await SubCategory.findById(req.params.id).select('status publishedAt').lean();
      if (existing && existing.status !== 'published' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
        updateData.publishedBy = req.user?._id;
      }
    }
  }

  if (req.files?.thumbnailImage?.[0]) {
    updateData.thumbnailImage = await uploadSubCategoryFile(req.files.thumbnailImage[0], name || 'SubCategory image');
  }
  if (req.files?.featuredImage?.[0]) {
    updateData.featuredImage = await uploadSubCategoryFile(req.files.featuredImage[0], name || 'SubCategory image');
  }
  if (req.files?.bannerImage?.[0]) {
    updateData.bannerImage = await uploadSubCategoryFile(req.files.bannerImage[0], name || 'SubCategory image');
  }

  const subcategory = await SubCategory.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!subcategory) {
    return res.status(404).json({ success: false, message: 'SubCategory not found' });
  }

  res.status(200).json({
    success: true,
    data: { subcategory },
  });
});

/**
 * Delete a subcategory
 * @route DELETE /api/subcategories/admin/:id
 * @access Private (admin)
 */
const deleteSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const productCount = await Product.countDocuments({ subCategory: id });
  if (productCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete subcategory with ${productCount} product(s). Reassign them first.`,
    });
  }

  const subcategory = await SubCategory.findByIdAndDelete(id);
  if (!subcategory) {
    return res.status(404).json({ success: false, message: 'SubCategory not found' });
  }

  res.status(200).json({
    success: true,
    message: 'SubCategory deleted',
  });
});

/**
 * Fill subcategory fields with AI suggestions
 * @route POST /api/subcategories/admin/ai-fill
 * @access Private (admin)
 */
const Anthropic = require('@anthropic-ai/sdk');

// Same model the product enrichment / chatbot / brand ai-fill already use.
const AI_FILL_MODEL = 'claude-haiku-4-5';

const SUBCATEGORY_STYLES = [
  'traditional', 'modern', 'craft', 'artisanal', 'premium', 'luxury', 'budget', 'mid_range',
  'classic', 'innovative', 'experimental', 'organic', 'natural', 'biodynamic',
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function aiStr(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function aiBool(v) {
  return v === true || v === 'true';
}

function slugifyName(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const fillWithAI = asyncHandler(async (req, res) => {
  const { name, type, parentName } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system =
    'You are a content assistant for DrinksHarbour, Nigeria\'s premier online premium beverages store. ' +
    'Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

  const prompt = `Generate complete subcategory content for:
- Name: "${name}"${parentName ? `\n- Parent Category: ${parentName}` : ''}${type ? `\n- Type: ${type}` : ''}

Fill EVERY field below with compelling, professional content.

Return a JSON object with exactly these keys:
{
  "displayName": "display-friendly name, plural if appropriate (max 120 chars)",
  "tagline": "short punchy tagline that sells the subcategory (max 150 chars)",
  "shortDescription": "2 sentences for listings and cards (max 280 chars)",
  "description": "3-4 compelling, informative paragraphs formatted as HTML using <p> tags only (max 1800 chars including tags)",
  "type": "the drink type this subcategory belongs to, e.g. whiskey, wine (max 100 chars)",
  "subType": "a more specific sub-type label, e.g. Single Malt, or '' (max 100 chars)",
  "style": "single best value from: ${SUBCATEGORY_STYLES.join(', ')}",
  "typicalFlavors": "comma-separated list of 4-8 typical flavors/tasting notes",
  "commonPairings": "comma-separated list of 4-6 food or occasion pairings",
  "seasonalSpring": false,
  "seasonalSummer": false,
  "seasonalFall": false,
  "seasonalWinter": false,
  "metaTitle": "SEO page title with brand context for the Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords relevant in Nigeria",
  "color": "6-digit hex color that fits the subcategory mood, e.g. #C0812A for whiskey, #722F37 for wine",
  "icon": "single most relevant emoji"
}

For the four seasonal booleans, set true only for seasons this subcategory is especially suited to (e.g. stouts in winter, rosé in summer); all false if not seasonal.`;

  const response = await anthropic.messages.create({
    model: AI_FILL_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content || []).map((c) => c.text || '').join('');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    return res.status(500).json({ success: false, message: 'AI returned invalid JSON' });
  }

  let json;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return res.status(500).json({ success: false, message: 'AI returned invalid JSON' });
  }

  // Snap enums / validate formats so the form only ever receives usable values.
  const data = {
    displayName: aiStr(json.displayName, 120),
    tagline: aiStr(json.tagline, 150),
    shortDescription: aiStr(json.shortDescription, 280),
    description: aiStr(json.description, 2000),
    type: aiStr(json.type, 100),
    subType: aiStr(json.subType, 100),
    style: SUBCATEGORY_STYLES.includes(json.style) ? json.style : '',
    typicalFlavors: aiStr(json.typicalFlavors, 500),
    commonPairings: aiStr(json.commonPairings, 500),
    seasonalSpring: aiBool(json.seasonalSpring),
    seasonalSummer: aiBool(json.seasonalSummer),
    seasonalFall: aiBool(json.seasonalFall),
    seasonalWinter: aiBool(json.seasonalWinter),
    metaTitle: aiStr(json.metaTitle, 100),
    metaDescription: aiStr(json.metaDescription, 320),
    metaKeywords: aiStr(json.metaKeywords, 500),
    canonicalUrl: `https://drinksharbour.com/shop/${slugifyName(name)}`,
    color: HEX_RE.test(aiStr(json.color, 7)) ? aiStr(json.color, 7) : '',
    icon: aiStr(json.icon, 20),
  };

  res.json({ success: true, data });
});

module.exports = {
  getSubCategories,
  getSubCategoriesByCategory,
  getSubCategoryById,
  getSubCategoryBySlug,
  getFeaturedSubCategories,
  getAdminSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  fillWithAI,
};
