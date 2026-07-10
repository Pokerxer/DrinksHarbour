// controllers/brand.controller.js

const brandService = require('../services/brand.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const Brand = require('../models/Brand');
const Product = require('../models/Product');
const cloudinaryService = require('../services/cloudinary.service');

// ─── Admin helpers ────────────────────────────────────────────────────────────

function toBool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1';
}

async function uploadBrandFile(file, altText) {
  const result = await cloudinaryService.uploadImage(file.buffer, {
    folder: 'brands',
    tags: ['brand'],
  });
  return { url: result.url, publicId: result.publicId, alt: altText };
}

/**
 * @desc    Create new brand
 * @route   POST /api/brands
 * @access  Private/Admin
 */
exports.createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body, req.user?._id);
  successResponse(res, { brand }, 'Brand created successfully', 201);
});

/**
 * @desc    Get all brands with advanced filtering, sorting, and pagination
 * @route   GET /api/brands
 * @access  Public
 */
exports.getAllBrands = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    featured,
    status = 'active',
    sort = 'name',
    order = 'asc',
    search,
    country,
    category,
    verified,
    brandType,
    isPremium,
    isPopular,
    isTrending,
    isCraft,
    isLocal,
    hasProducts,
    minProductCount,
    maxProductCount,
    minPopularity,
    maxPopularity,
    foundedAfter,
    foundedBefore,
    fields,
    includeStats
  } = req.query;

  const queryParams = {
    page,
    limit,
    featured,
    status,
    sort,
    order,
    search,
    country,
    category,
    verified,
    brandType,
    isPremium,
    isPopular,
    isTrending,
    isCraft,
    isLocal,
    hasProducts,
    minProductCount,
    maxProductCount,
    minPopularity,
    maxPopularity,
    foundedAfter,
    foundedBefore,
    fields,
    includeStats
  };

  const result = await brandService.getAllBrands(queryParams);
  successResponse(res, result, 'Brands retrieved successfully');
});

/**
 * @desc    Get featured brands
 * @route   GET /api/brands/featured
 * @access  Public
 */
exports.getFeaturedBrands = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await brandService.getFeaturedBrands(limit);
  successResponse(res, { brands }, 'Featured brands retrieved successfully');
});

/**
 * @desc    Get popular brands
 * @route   GET /api/brands/popular
 * @access  Public
 */
exports.getPopularBrands = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await brandService.getPopularBrands(limit);
  successResponse(res, { brands }, 'Popular brands retrieved successfully');
});

/**
 * @desc    Get brand by ID
 * @route   GET /api/brands/:id
 * @access  Public
 */
exports.getBrandById = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandById(req.params.id);
  successResponse(res, { brand }, 'Brand retrieved successfully');
});

/**
 * @desc    Get brand by slug
 * @route   GET /api/brands/slug/:slug
 * @access  Public
 */
exports.getBrandBySlug = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandBySlug(req.params.slug);
  successResponse(res, { brand }, 'Brand retrieved successfully');
});

/**
 * @desc    Update brand
 * @route   PUT /api/brands/:id
 * @access  Private/Admin
 */
exports.updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(
    req.params.id,
    req.body,
    req.user?._id
  );
  successResponse(res, { brand }, 'Brand updated successfully');
});

/**
 * @desc    Patch/Partial update brand
 * @route   PATCH /api/brands/:id
 * @access  Private/Admin
 */
exports.patchBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(
    req.params.id,
    req.body,
    req.user?._id
  );
  successResponse(res, { brand }, 'Brand updated successfully');
});

/**
 * @desc    Delete brand
 * @route   DELETE /api/brands/:id
 * @access  Private/Admin
 */
exports.deleteBrand = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(req.params.id);
  successResponse(res, null, 'Brand deleted successfully');
});

/**
 * @desc    Get brand statistics
 * @route   GET /api/brands/stats/overview
 * @access  Public
 */
exports.getBrandStats = asyncHandler(async (req, res) => {
  const stats = await brandService.getBrandStats();
  successResponse(res, { stats }, 'Brand statistics retrieved successfully');
});

/**
 * @desc    Get brands by category
 * @route   GET /api/brands/category/:category
 * @access  Public
 */
exports.getBrandsByCategory = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await brandService.getBrandsByCategory(req.params.category, limit);
  successResponse(res, { brands }, 'Brands retrieved successfully');
});

/**
 * @desc    Recalculate brand product count
 * @route   POST /api/brands/:id/recalculate
 * @access  Private/Admin
 */
exports.recalculateProductCount = asyncHandler(async (req, res) => {
  await brandService.updateProductCount(req.params.id);
  successResponse(res, null, 'Product count recalculated successfully');
});

/**
 * @desc    Get available filter options
 * @route   GET /api/brands/filters/options
 * @access  Public
 */
exports.getFilterOptions = asyncHandler(async (req, res) => {
  const options = await brandService.getFilterOptions();
  successResponse(res, options, 'Filter options retrieved successfully');
});

// ─── Admin CRUD handlers ──────────────────────────────────────────────────────

/**
 * @route GET /api/brands/admin
 * @access Private (admin)
 */
exports.getAdminBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find()
    .select('name slug brandType primaryCategory status logo displayOrder isFeatured verified countryOfOrigin createdAt')
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  const brandsWithCount = await Promise.all(
    brands.map(async (brand) => {
      try {
        const productCount = await Product.countDocuments({ brand: brand._id });
        return { ...brand, productCount };
      } catch (e) {
        return { ...brand, productCount: 0 };
      }
    })
  );

  res.status(200).json({
    success: true,
    data: { brands: brandsWithCount, total: brandsWithCount.length },
  });
});

/**
 * @route POST /api/brands/admin
 * @access Private (admin)
 */
exports.createAdminBrand = asyncHandler(async (req, res) => {
  const b = req.body;

  const brandData = {
    name: b.name,
    slug: b.slug,
    status: b.status || 'active',
    createdBy: req.user?._id,
  };

  if (b.legalName) brandData.legalName = b.legalName;
  if (b.tradingAs) brandData.tradingAs = String(b.tradingAs).split(',').map((s) => s.trim()).filter(Boolean);
  if (b.description) brandData.description = b.description;
  if (b.shortDescription) brandData.shortDescription = b.shortDescription;
  if (b.tagline) brandData.tagline = b.tagline;
  if (b.story) brandData.story = b.story;
  if (b.founded) brandData.founded = Number(b.founded);
  if (b.founderName) brandData.founderName = b.founderName;
  if (b.brandType) brandData.brandType = b.brandType;
  if (b.primaryCategory) brandData.primaryCategory = b.primaryCategory;
  if (b.specializations) brandData.specializations = String(b.specializations).split(',').map((s) => s.trim()).filter(Boolean);
  if (b.countryOfOrigin) brandData.countryOfOrigin = b.countryOfOrigin;
  if (b.region) brandData.region = b.region;
  if (b.hqCity || b.hqCountry) {
    brandData.headquarters = { city: b.hqCity || '', country: b.hqCountry || '' };
  }
  if (b.website) brandData.website = b.website;
  if (b.email) brandData.email = b.email;
  if (b.phone) brandData.phone = b.phone;

  if (b.socialFacebook || b.socialInstagram || b.socialTwitter || b.socialYoutube || b.socialLinkedin || b.socialTiktok) {
    brandData.socialMedia = {
      facebook: b.socialFacebook || '',
      instagram: b.socialInstagram || '',
      twitter: b.socialTwitter || '',
      youtube: b.socialYoutube || '',
      linkedin: b.socialLinkedin || '',
      tiktok: b.socialTiktok || '',
    };
  }

  if (b.brandColorPrimary || b.brandColorSecondary || b.brandColorAccent) {
    brandData.brandColors = {
      primary: b.brandColorPrimary || '',
      secondary: b.brandColorSecondary || '',
      accent: b.brandColorAccent || '',
    };
  }

  brandData.isFeatured = toBool(b.isFeatured, false);
  brandData.isPopular = toBool(b.isPopular, false);
  brandData.isTrending = toBool(b.isTrending, false);
  brandData.isPremium = toBool(b.isPremium, false);
  brandData.isCraft = toBool(b.isCraft, false);
  brandData.isLocal = toBool(b.isLocal, false);
  brandData.verified = toBool(b.verified, false);

  if (b.displayOrder !== undefined) {
    const n = Number(b.displayOrder);
    brandData.displayOrder = isNaN(n) ? 999 : n;
  }

  if (b.metaTitle) brandData.metaTitle = b.metaTitle;
  if (b.metaDescription) brandData.metaDescription = b.metaDescription;
  if (b.metaKeywords) brandData.metaKeywords = String(b.metaKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  if (b.canonicalUrl) brandData.canonicalUrl = b.canonicalUrl;
  if (b.notes) brandData.notes = b.notes;

  if (req.files?.logo?.[0]) {
    brandData.logo = await uploadBrandFile(req.files.logo[0], b.name);
  }
  if (req.files?.featuredImage?.[0]) {
    brandData.featuredImage = await uploadBrandFile(req.files.featuredImage[0], b.name);
  }
  if (req.files?.bannerImage?.[0]) {
    brandData.bannerImage = await uploadBrandFile(req.files.bannerImage[0], b.name);
  }

  const brand = new Brand(brandData);
  await brand.save();

  res.status(201).json({ success: true, data: { brand } });
});

/**
 * @route PUT /api/brands/admin/:id
 * @access Private (admin)
 */
exports.updateAdminBrand = asyncHandler(async (req, res) => {
  const b = req.body;
  const updateData = {};

  if (b.name !== undefined) updateData.name = b.name;
  if (b.slug !== undefined) updateData.slug = b.slug;
  if (b.legalName !== undefined) updateData.legalName = b.legalName;
  if (b.tradingAs !== undefined) updateData.tradingAs = String(b.tradingAs).split(',').map((s) => s.trim()).filter(Boolean);
  if (b.description !== undefined) updateData.description = b.description;
  if (b.shortDescription !== undefined) updateData.shortDescription = b.shortDescription;
  if (b.tagline !== undefined) updateData.tagline = b.tagline;
  if (b.story !== undefined) updateData.story = b.story;
  if (b.founded !== undefined) updateData.founded = Number(b.founded);
  if (b.founderName !== undefined) updateData.founderName = b.founderName;
  if (b.brandType) updateData.brandType = b.brandType;
  if (b.primaryCategory) updateData.primaryCategory = b.primaryCategory;
  if (b.specializations !== undefined) updateData.specializations = String(b.specializations).split(',').map((s) => s.trim()).filter(Boolean);
  if (b.countryOfOrigin !== undefined) updateData.countryOfOrigin = b.countryOfOrigin;
  if (b.region !== undefined) updateData.region = b.region;
  if (b.hqCity !== undefined || b.hqCountry !== undefined) {
    updateData.headquarters = { city: b.hqCity || '', country: b.hqCountry || '' };
  }
  if (b.website !== undefined) updateData.website = b.website;
  if (b.email !== undefined) updateData.email = b.email;
  if (b.phone !== undefined) updateData.phone = b.phone;

  if (b.socialFacebook !== undefined || b.socialInstagram !== undefined || b.socialTwitter !== undefined ||
      b.socialYoutube !== undefined || b.socialLinkedin !== undefined || b.socialTiktok !== undefined) {
    updateData.socialMedia = {
      facebook: b.socialFacebook || '',
      instagram: b.socialInstagram || '',
      twitter: b.socialTwitter || '',
      youtube: b.socialYoutube || '',
      linkedin: b.socialLinkedin || '',
      tiktok: b.socialTiktok || '',
    };
  }

  if (b.brandColorPrimary !== undefined || b.brandColorSecondary !== undefined || b.brandColorAccent !== undefined) {
    updateData.brandColors = {
      primary: b.brandColorPrimary || '',
      secondary: b.brandColorSecondary || '',
      accent: b.brandColorAccent || '',
    };
  }

  if (b.isFeatured !== undefined) updateData.isFeatured = toBool(b.isFeatured, false);
  if (b.isPopular !== undefined) updateData.isPopular = toBool(b.isPopular, false);
  if (b.isTrending !== undefined) updateData.isTrending = toBool(b.isTrending, false);
  if (b.isPremium !== undefined) updateData.isPremium = toBool(b.isPremium, false);
  if (b.isCraft !== undefined) updateData.isCraft = toBool(b.isCraft, false);
  if (b.isLocal !== undefined) updateData.isLocal = toBool(b.isLocal, false);
  if (b.verified !== undefined) updateData.verified = toBool(b.verified, false);
  if (b.status !== undefined) updateData.status = b.status;

  if (b.displayOrder !== undefined) {
    const n = Number(b.displayOrder);
    updateData.displayOrder = isNaN(n) ? 999 : n;
  }

  if (b.metaTitle !== undefined) updateData.metaTitle = b.metaTitle;
  if (b.metaDescription !== undefined) updateData.metaDescription = b.metaDescription;
  if (b.metaKeywords !== undefined) updateData.metaKeywords = String(b.metaKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  if (b.canonicalUrl !== undefined) updateData.canonicalUrl = b.canonicalUrl;
  if (b.notes !== undefined) updateData.notes = b.notes;

  updateData.updatedBy = req.user?._id;

  if (req.files?.logo?.[0]) {
    updateData.logo = await uploadBrandFile(req.files.logo[0], b.name || 'Brand logo');
  }
  if (req.files?.featuredImage?.[0]) {
    updateData.featuredImage = await uploadBrandFile(req.files.featuredImage[0], b.name || 'Brand image');
  }
  if (req.files?.bannerImage?.[0]) {
    updateData.bannerImage = await uploadBrandFile(req.files.bannerImage[0], b.name || 'Brand image');
  }

  const brand = await Brand.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  res.status(200).json({ success: true, data: { brand } });
});

/**
 * @route DELETE /api/brands/admin/:id
 * @access Private (admin)
 */
exports.deleteAdminBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const productCount = await Product.countDocuments({ brand: id });
  if (productCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete brand with ${productCount} product(s). Reassign or remove them first.`,
    });
  }

  const brand = await Brand.findByIdAndDelete(id);
  if (!brand) {
    return res.status(404).json({ success: false, message: 'Brand not found' });
  }

  res.status(200).json({ success: true, message: 'Brand deleted' });
});

/**
 * @route POST /api/brands/admin/ai-fill
 * @access Private (admin)
 */
const Anthropic = require('@anthropic-ai/sdk');

// Same model the product enrichment / chatbot / scan matcher already use.
const AI_FILL_MODEL = 'claude-haiku-4-5';

const BRAND_TYPES = [
  'brewery', 'microbrewery', 'craft_brewery', 'brewpub',
  'winery', 'vineyard', 'wine_estate',
  'distillery', 'craft_distillery', 'spirits_producer',
  'beverage_company', 'drinks_manufacturer',
  'coffee_roaster', 'tea_company',
  'soft_drink_manufacturer', 'water_brand',
  'importer', 'distributor',
  'private_label', 'house_brand',
  'luxury', 'premium', 'mass_market',
  'other', 'champagne_house', 'coffee_company', 'juice_company',
];

const PRIMARY_CATEGORIES = [
  'beer', 'wine', 'spirits', 'liqueurs', 'cocktails',
  'coffee', 'tea', 'soft_drinks', 'water', 'juice',
  'energy_drinks', 'sports_drinks', 'mixers',
  'accessories', 'multi_category', 'other', 'champagne',
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function aiStr(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function slugifyBrand(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

exports.fillWithAI = asyncHandler(async (req, res) => {
  const { name, brandType, primaryCategory, countryOfOrigin } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system =
    'You are a content assistant for DrinksHarbour, Nigeria\'s premier online premium beverages store. ' +
    'You know the world\'s drinks brands well. Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

  const prompt = `Generate complete brand profile content for:
- Name: "${name}"${brandType ? `\n- Brand Type: ${brandType.replace(/_/g, ' ')}` : ''}${primaryCategory ? `\n- Primary Category: ${primaryCategory.replace(/_/g, ' ')}` : ''}${countryOfOrigin ? `\n- Country of Origin: ${countryOfOrigin}` : ''}

Fill EVERY field below. Use your real knowledge of this brand; where a fact is genuinely unknown, give a plausible, professional value rather than leaving it empty — EXCEPT website, email, phone and social URLs, which must be the real official ones or "" (never invent URLs or contact details).

Return a JSON object with exactly these keys:
{
  "legalName": "registered legal/company name of the brand owner",
  "tradingAs": "comma-separated trading names the brand is known by",
  "tagline": "short punchy brand tagline (max 150 chars)",
  "shortDescription": "2 compelling sentences for brand listings and cards (max 280 chars)",
  "description": "3-4 paragraphs about the brand history, quality and positioning, formatted as HTML using <p> tags only (max 3000 chars)",
  "story": "2-3 plain-text paragraphs narrating the brand heritage, founding story and mission, separated by blank lines (max 3000 chars)",
  "founded": 1887,
  "founderName": "name of the founder(s), or '' if truly unknown",
  "brandType": "single best value from: ${BRAND_TYPES.join(', ')}",
  "primaryCategory": "single best value from: ${PRIMARY_CATEGORIES.join(', ')}",
  "specializations": "2-4 comma-separated specializations, e.g. Single Malt Whisky, Aged Spirits",
  "countryOfOrigin": "country the brand originates from",
  "region": "production region if applicable, e.g. Speyside, Champagne, or ''",
  "hqCity": "headquarters city",
  "hqCountry": "headquarters country",
  "website": "official website URL or ''",
  "email": "official public contact email or ''",
  "phone": "official public phone number or ''",
  "socialFacebook": "official Facebook page URL or ''",
  "socialInstagram": "official Instagram URL or ''",
  "socialTwitter": "official Twitter/X URL or ''",
  "socialYoutube": "official YouTube channel URL or ''",
  "socialLinkedin": "official LinkedIn URL or ''",
  "socialTiktok": "official TikTok URL or ''",
  "metaTitle": "SEO page title with brand context for the Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description for the brand page (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords relevant to this brand in Nigeria",
  "brandColorPrimary": "6-digit hex color representing the brand identity, e.g. #C0812A",
  "brandColorSecondary": "6-digit hex complementary secondary color",
  "brandColorAccent": "6-digit hex accent color"
}`;

  const response = await anthropic.messages.create({
    model: AI_FILL_MODEL,
    max_tokens: 4096,
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
  const foundedNum = Number(json.founded);
  const currentYear = new Date().getFullYear();

  const data = {
    legalName: aiStr(json.legalName, 200),
    tradingAs: aiStr(json.tradingAs, 300),
    tagline: aiStr(json.tagline, 150),
    shortDescription: aiStr(json.shortDescription, 280),
    description: aiStr(json.description, 5000),
    story: aiStr(json.story, 5000),
    founded: Number.isFinite(foundedNum) && foundedNum >= 1000 && foundedNum <= currentYear ? foundedNum : '',
    founderName: aiStr(json.founderName, 150),
    brandType: BRAND_TYPES.includes(json.brandType) ? json.brandType : '',
    primaryCategory: PRIMARY_CATEGORIES.includes(json.primaryCategory) ? json.primaryCategory : '',
    specializations: aiStr(json.specializations, 300),
    countryOfOrigin: aiStr(json.countryOfOrigin, 100),
    region: aiStr(json.region, 100),
    hqCity: aiStr(json.hqCity, 100),
    hqCountry: aiStr(json.hqCountry, 100),
    website: aiStr(json.website, 300),
    email: aiStr(json.email, 200),
    phone: aiStr(json.phone, 30),
    socialFacebook: aiStr(json.socialFacebook, 300),
    socialInstagram: aiStr(json.socialInstagram, 300),
    socialTwitter: aiStr(json.socialTwitter, 300),
    socialYoutube: aiStr(json.socialYoutube, 300),
    socialLinkedin: aiStr(json.socialLinkedin, 300),
    socialTiktok: aiStr(json.socialTiktok, 300),
    metaTitle: aiStr(json.metaTitle, 100),
    metaDescription: aiStr(json.metaDescription, 320),
    metaKeywords: aiStr(json.metaKeywords, 500),
    canonicalUrl: `https://drinksharbour.com/brands/${slugifyBrand(name)}`,
    brandColorPrimary: HEX_RE.test(aiStr(json.brandColorPrimary, 7)) ? aiStr(json.brandColorPrimary, 7) : '',
    brandColorSecondary: HEX_RE.test(aiStr(json.brandColorSecondary, 7)) ? aiStr(json.brandColorSecondary, 7) : '',
    brandColorAccent: HEX_RE.test(aiStr(json.brandColorAccent, 7)) ? aiStr(json.brandColorAccent, 7) : '',
  };

  res.json({ success: true, data });
});
