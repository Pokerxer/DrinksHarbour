const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
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
    .select('name slug displayName type subType alcoholCategory description shortDescription tagline icon color featuredImage bannerImage thumbnailImage isFeatured isTrending isPopular displayOrder parent level metaTitle metaDescription metaKeywords')
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

const Anthropic = require('@anthropic-ai/sdk');

// Same model the product enrichment / chatbot / brand ai-fill already use.
const AI_FILL_MODEL = 'claude-haiku-4-5';

const CATEGORY_TYPES = [
  'beer', 'cider', 'wine', 'red_wine', 'white_wine', 'rose_wine',
  'sparkling_wine', 'champagne', 'fortified_wine', 'dessert_wine',
  'whiskey', 'scotch', 'bourbon', 'rye_whiskey', 'vodka', 'gin', 'rum',
  'tequila', 'brandy', 'cognac', 'soju', 'baijiu', 'shochu', 'mezcal',
  'liqueur', 'aperitif', 'digestif', 'cocktail',
  'coffee', 'tea', 'juice', 'soda', 'water', 'milk', 'yogurt_drink',
  'soft_drink', 'dairy_alternatives', 'functional_drink', 'syrup', 'bitters',
  'glassware', 'bar_tools', 'accessories', 'gift_set', 'subscription', 'other',
];

const ALCOHOL_CATEGORIES = ['alcoholic', 'non_alcoholic', 'low_alcohol', 'alcohol_free', 'mixed'];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function aiStr(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function slugifyName(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Build a catalog of real, linkable pages for a category so the AI can weave
// contextual internal links instead of inventing URLs (same approach as the
// blog generator). Category copy links to DETAIL pages — /categories/cat/sub,
// /product/slug, /brands/slug — which are the self-canonical SEO pages that
// benefit from internal link equity; /shop filter URLs are already fed by the
// blog and the sitemap.
async function buildCategoryLinkCatalog(name) {
  const empty = { products: [], subCategories: [], brands: new Map(), categorySlug: '', allowed: new Set() };
  try {
    const category = await Category.findOne({
      name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('slug')
      .lean();

    const baseFilter = { status: 'approved', isPublished: true };
    const projection = { name: 1, slug: 1, brand: 1 };
    let products = [];
    if (category) {
      products = await Product.find({ ...baseFilter, category: category._id }, projection)
        .sort({ createdAt: -1 })
        .limit(16)
        .populate('brand', 'name slug')
        .lean();
    }
    // Text-search fallback for brand-new categories with no linked products yet.
    if (products.length < 6) {
      try {
        const seen = new Set(products.map((p) => String(p._id)));
        const extra = await Product.find(
          { ...baseFilter, $text: { $search: String(name) } },
          { ...projection, score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(12)
          .populate('brand', 'name slug')
          .lean();
        products = products.concat(extra.filter((p) => !seen.has(String(p._id))));
      } catch (_) {
        /* keep whatever we have */
      }
    }
    products = products.filter((p) => p && p.slug && p.name).slice(0, 12);

    let subCategories = [];
    if (category) {
      subCategories = await SubCategory.find({ parent: category._id, status: 'published' })
        .select('name slug')
        .sort({ productCount: -1, name: 1 })
        .limit(10)
        .lean();
    }

    const brands = new Map();
    products.forEach((p) => {
      if (p.brand?.slug && !brands.has(p.brand.slug)) brands.set(p.brand.slug, p.brand.name);
    });

    const allowed = new Set();
    products.forEach((p) => allowed.add(`/product/${p.slug}`));
    brands.forEach((_n, slug) => allowed.add(`/brands/${slug}`));
    if (category) subCategories.forEach((s) => allowed.add(`/categories/${category.slug}/${s.slug}`));

    return { products, subCategories, brands, categorySlug: category?.slug || '', allowed };
  } catch (_) {
    return empty;
  }
}

function categoryCatalogToPrompt({ products, subCategories, brands, categorySlug }) {
  if (!products.length && !subCategories.length) return '';
  const subLines = subCategories
    .map((s) => `- "${s.name}" → /categories/${categorySlug}/${s.slug}`)
    .join('\n');
  const productLines = products.map((p) => `- "${p.name}" → /product/${p.slug}`).join('\n');
  const brandLines = [...brands.entries()].map(([slug, name]) => `- "${name}" → /brands/${slug}`).join('\n');

  return `

INTERNAL LINKING: inside the description HTML, weave 3-6 contextual internal links as <a href='/path'>natural anchor words</a> (single-quoted attributes). Rules:
- Use ONLY links from the approved catalog below. NEVER invent a URL or slug.
- The anchor must be natural words inside a sentence (e.g. "a peaty <a href='/categories/scotch/islay-scotch'>Islay single malt</a>"), never the raw slug.
- Link each target at most once. Prefer subcategory pages, then standout products, then brands.${subLines ? `\n\nApproved subcategory links:\n${subLines}` : ''}${productLines ? `\n\nApproved product links:\n${productLines}` : ''}${brandLines ? `\n\nApproved brand links:\n${brandLines}` : ''}`;
}

// Strip <a> tags whose href isn't in the approved set, keeping the anchor text
// (prevents 404s from hallucinated slugs).
function stripUnapprovedLinks(html, allowed) {
  return String(html || '').replace(
    /<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (match, href, text) => (allowed.has(href) ? match : text)
  );
}

// Extract and parse the model's JSON, repairing the common failure mode of
// long HTML descriptions: literal newlines/tabs inside JSON string values.
function parseAiJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (_) {
    /* repair below */
  }
  let repaired = '';
  let inString = false;
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i];
    if (ch === '"' && slice[i - 1] !== '\\') inString = !inString;
    if (inString && (ch === '\n' || ch === '\r')) repaired += '\\n';
    else if (inString && ch === '\t') repaired += '\\t';
    else repaired += ch;
  }
  try {
    return JSON.parse(repaired);
  } catch (_) {
    return null;
  }
}

const fillWithAI = asyncHandler(async (req, res) => {
  const { name, type, alcoholCategory } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const catalog = await buildCategoryLinkCatalog(name);

  const system =
    'You are a content assistant for DrinksHarbour, Nigeria\'s premier online premium beverages store. ' +
    'Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

  const prompt = `Generate complete category content for:
- Name: "${name}"${type ? `\n- Type: ${String(type).replace(/_/g, ' ')}` : ''}${alcoholCategory ? `\n- Alcohol Category: ${String(alcoholCategory).replace(/_/g, ' ')}` : ''}

Fill EVERY field below with compelling, professional content.

Return a JSON object with exactly these keys:
{
  "displayName": "display-friendly name, plural if appropriate (max 120 chars)",
  "tagline": "short punchy tagline that sells the category (max 150 chars)",
  "shortDescription": "2 sentences for listings and cards (max 280 chars)",
  "description": "6-10 detailed, informative paragraphs (roughly 800-1500 words) formatted as HTML using <p> tags (plus inline <a> internal links per the linking rules below, if a catalog is provided) (max 20000 chars including tags; write it as a single-line JSON string with no literal newlines, and use single quotes for HTML attribute values)",
  "type": "single best value from: ${CATEGORY_TYPES.join(', ')}",
  "subType": "a more specific sub-type label, e.g. Single Malt, or '' (max 80 chars)",
  "alcoholCategory": "single best value from: ${ALCOHOL_CATEGORIES.join(', ')}",
  "metaTitle": "SEO page title with brand context for the Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords relevant in Nigeria",
  "color": "6-digit hex color that fits the category mood, e.g. #C0812A for whiskey, #722F37 for wine",
  "icon": "single most relevant emoji"
}${categoryCatalogToPrompt(catalog)}`;

  const response = await anthropic.messages.create({
    model: AI_FILL_MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content || []).map((c) => c.text || '').join('');
  const json = parseAiJson(raw);
  if (!json) {
    return res.status(500).json({ success: false, message: 'AI returned invalid JSON' });
  }

  // Snap enums / validate formats so the form only ever receives usable values.
  const data = {
    displayName: aiStr(json.displayName, 120),
    tagline: aiStr(json.tagline, 150),
    shortDescription: aiStr(json.shortDescription, 280),
    description: aiStr(stripUnapprovedLinks(json.description, catalog.allowed), 20000),
    type: CATEGORY_TYPES.includes(json.type) ? json.type : '',
    subType: aiStr(json.subType, 80),
    alcoholCategory: ALCOHOL_CATEGORIES.includes(json.alcoholCategory) ? json.alcoholCategory : '',
    metaTitle: aiStr(json.metaTitle, 100),
    metaDescription: aiStr(json.metaDescription, 320),
    metaKeywords: aiStr(json.metaKeywords, 500),
    canonicalUrl: `https://www.drinksharbour.com/categories/${slugifyName(name)}`,
    color: HEX_RE.test(aiStr(json.color, 7)) ? aiStr(json.color, 7) : '',
    icon: aiStr(json.icon, 20),
  };

  res.json({ success: true, data });
});

const SMART_MODEL = process.env.ANTHROPIC_SMART_MODEL || 'claude-sonnet-4-6';

const generateCategory = asyncHandler(async (req, res) => {
  const topic = String(req.body?.topic || '').trim();
  if (!topic) return res.status(400).json({ success: false, message: 'topic is required' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const catalog = await buildCategoryLinkCatalog(topic);

  const system =
    'You are a content assistant for DrinksHarbour, Nigeria\'s premier online premium beverages store. ' +
    'Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

  const prompt = `Create a complete product category for DrinksHarbour based on this topic/name: "${topic}".

Pick the best-fitting beverage taxonomy for the Nigerian market. Fill EVERY field below with compelling, professional content.

Return a JSON object with exactly these keys:
{
  "name": "concise category name, singular, title case (max 80 chars)",
  "displayName": "display-friendly name, plural if appropriate (max 120 chars)",
  "tagline": "short punchy tagline that sells the category (max 150 chars)",
  "shortDescription": "2 sentences for listings and cards (max 280 chars)",
  "description": "6-10 detailed, informative paragraphs (roughly 800-1500 words) formatted as HTML using <p> tags (plus inline <a> internal links per the linking rules below, if a catalog is provided) (max 20000 chars including tags; write it as a single-line JSON string with no literal newlines, and use single quotes for HTML attribute values)",
  "type": "single best value from: ${CATEGORY_TYPES.join(', ')}",
  "subType": "a more specific sub-type label, e.g. Single Malt, or '' (max 80 chars)",
  "alcoholCategory": "single best value from: ${ALCOHOL_CATEGORIES.join(', ')}",
  "metaTitle": "SEO page title with brand context for the Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords relevant in Nigeria",
  "color": "6-digit hex color that fits the category mood, e.g. #C0812A for whiskey, #722F37 for wine",
  "icon": "single most relevant emoji"
}${categoryCatalogToPrompt(catalog)}`;

  const response = await anthropic.messages.create({
    model: SMART_MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content || []).map((c) => c.text || '').join('');
  const json = parseAiJson(raw);
  if (!json) {
    return res.status(502).json({ success: false, message: 'AI returned invalid JSON' });
  }

  const name = aiStr(json.name, 80) || topic;
  const data = {
    name,
    slug: slugifyName(name),
    displayName: aiStr(json.displayName, 120),
    tagline: aiStr(json.tagline, 150),
    shortDescription: aiStr(json.shortDescription, 280),
    description: aiStr(stripUnapprovedLinks(json.description, catalog.allowed), 20000),
    type: CATEGORY_TYPES.includes(json.type) ? json.type : '',
    subType: aiStr(json.subType, 80),
    alcoholCategory: ALCOHOL_CATEGORIES.includes(json.alcoholCategory) ? json.alcoholCategory : 'alcoholic',
    metaTitle: aiStr(json.metaTitle, 100),
    metaDescription: aiStr(json.metaDescription, 320),
    metaKeywords: aiStr(json.metaKeywords, 500),
    canonicalUrl: `https://www.drinksharbour.com/categories/${slugifyName(name)}`,
    color: HEX_RE.test(aiStr(json.color, 7)) ? aiStr(json.color, 7) : '#6B7280',
    icon: aiStr(json.icon, 20),
    status: 'draft',
  };

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
  generateCategory,
};
