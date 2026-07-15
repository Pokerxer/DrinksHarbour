// controllers/banner-gemini.controller.js
// Banner AI authoring. Backed by Anthropic Haiku (aligned with blog.controller.js
// and gemini.controller.js) — kept at this filename/route for backwards compat.
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const {
  AI_FIELD_ACTIONS,
  BANNER_TYPES,
  BANNER_PLACEMENTS,
  BANNER_CTA_STYLES,
  CONTENT_POSITIONS,
  TEXT_ALIGNMENTS,
  isEnhanceableField,
  clampField,
  parseAiJson,
  sanitizeBannerData,
} = require('../services/banner.helpers');

const HAIKU_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5';
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// One JSON round-trip to Haiku with a copywriter system prompt. Throws on refusal
// so callers can fall back to demo content or return a clean 502.
async function callBannerHaikuJson(prompt, maxTokens = 1024) {
  const message = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    system:
      'You are an expert e-commerce copywriter for DrinksHarbour, a premium Nigerian drinks marketplace. Respond with ONLY valid JSON — no markdown code fences, no explanation, no preamble.',
    messages: [{ role: 'user', content: prompt }],
  });
  if (message.stop_reason === 'refusal') throw new Error('Claude declined the request');
  return message.content?.[0]?.text || '';
}

const fetchCategories = async () => {
  try {
    const categories = await Category.find({ status: 'published' }).select('_id name slug type').lean();
    return categories.map(c => ({ id: c._id.toString(), name: c.name, slug: c.slug, type: c.type }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

const fetchProducts = async (limit = 20) => {
  try {
    // Product status enum has no 'published' — approved is the live/visible state.
    const products = await Product.find({ status: 'approved' })
      .select('_id name slug type brand')
      .populate('brand', 'name')
      .limit(limit)
      .lean();
    return products.map(p => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      type: p.type,
      brand: p.brand?.name || ''
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

const fetchBrands = async (limit = 20) => {
  try {
    const brands = await Brand.find({ status: 'active' }).select('_id name').limit(limit).lean();
    return brands.map(b => ({ id: b._id.toString(), name: b.name }));
  } catch (error) {
    console.error('Error fetching brands:', error);
    return [];
  }
};

const fetchSubCategories = async (limit = 100) => {
  try {
    const subs = await SubCategory.find({ status: 'published' })
      .select('_id name slug type parent')
      .populate('parent', 'name slug')
      .sort({ displayOrder: 1, name: 1 })
      .limit(limit)
      .lean();
    return subs.map(s => ({
      id: s._id.toString(),
      name: s.name,
      slug: s.slug,
      type: s.type,
      parentId: s.parent?._id ? s.parent._id.toString() : '',
      parentName: s.parent?.name || '',
      parentSlug: s.parent?.slug || '',
    }));
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    return [];
  }
};

const STYLE_GUIDANCE = {
  playful: '- Playful, fun, energetic tone',
  elegant: '- Elegant, sophisticated, premium tone',
  urgent: '- Urgent, FOMO-inducing, action-oriented',
  calm: '- Calm, reassuring, trustworthy tone',
};

/**
 * Generate complete banner content using AI
 * POST /api/banner-ai/generate
 */
const generateBannerContent = asyncHandler(async (req, res) => {
  const { productId, categoryId, subcategoryId, brandId, bannerType, placement, customContext, style } = req.body;

  if (!anthropic) {
    return res.json({
      success: true,
      data: generateDemoBannerContent(req.body),
      note: 'Using demo data - AI not configured (ANTHROPIC_API_KEY missing)',
      fallback: true,
    });
  }

  try {
    let productContext = null;
    let categoryContext = null;
    let subcategoryContext = null;
    let brandContext = null;

    if (productId) {
      const product = await Product.findById(productId)
        .populate('brand', 'name')
        .populate('category', 'name')
        .lean();
      if (product) {
        productContext = {
          name: product.name,
          type: product.type,
          brand: product.brand?.name,
          category: product.category?.name,
          shortDescription: product.shortDescription,
          abv: product.abv,
          origin: product.originCountry,
          vintage: product.vintage
        };
      }
    }

    if (categoryId) {
      const category = await Category.findById(categoryId).lean();
      if (category) {
        categoryContext = { name: category.name, type: category.type, description: category.description };
      }
    }

    if (subcategoryId) {
      const subcategory = await SubCategory.findById(subcategoryId).populate('parent', 'name').lean();
      if (subcategory) {
        subcategoryContext = {
          name: subcategory.name,
          type: subcategory.type,
          parent: subcategory.parent?.name,
          description: subcategory.description || subcategory.shortDescription,
        };
      }
    }

    if (brandId) {
      const brand = await Brand.findById(brandId).lean();
      if (brand) {
        brandContext = { name: brand.name, description: brand.description };
      }
    }

    const prompt = `Generate catchy, conversion-optimized banner content for a beverage e-commerce platform.

${productContext ? `PRODUCT CONTEXT:
- Product Name: "${productContext.name}"
- Type: ${productContext.type || 'N/A'}
- Brand: ${productContext.brand || 'N/A'}
- Category: ${productContext.category || 'N/A'}
- Description: ${productContext.shortDescription || 'N/A'}
- ABV: ${productContext.abv ? `${productContext.abv}%` : 'N/A'}
- Origin: ${productContext.origin || 'N/A'}
${productContext.vintage ? `- Vintage: ${productContext.vintage}` : ''}
` : ''}
${categoryContext ? `CATEGORY CONTEXT:
- Category: "${categoryContext.name}"
- Type: ${categoryContext.type || 'N/A'}
- Description: ${categoryContext.description || 'N/A'}
` : ''}
${subcategoryContext ? `SUBCATEGORY CONTEXT:
- Subcategory: "${subcategoryContext.name}"
- Parent Category: ${subcategoryContext.parent || 'N/A'}
- Type: ${subcategoryContext.type || 'N/A'}
- Description: ${subcategoryContext.description || 'N/A'}
` : ''}
${brandContext ? `BRAND CONTEXT:
- Brand: "${brandContext.name}"
- Description: ${brandContext.description || 'N/A'}
` : ''}
${customContext ? `ADDITIONAL CONTEXT:
${customContext}
` : ''}
STYLE GUIDANCE:
${STYLE_GUIDANCE[style] || '- Balanced, professional yet engaging tone'}

Preferred Banner Type: ${bannerType || '(you choose)'}
Preferred Placement: ${placement || '(you choose)'}

Generate content that will drive clicks and conversions. Make it compelling and action-oriented.
Also PICK the banner configuration that best fits the context, tone, and placement above,
choosing each value from its allowed list:
- type: ${BANNER_TYPES.join(' | ')}
- placement: ${BANNER_PLACEMENTS.join(' | ')}
- ctaStyle: ${BANNER_CTA_STYLES.join(' | ')}
- contentPosition: ${CONTENT_POSITIONS.join(' | ')}
- textAlignment: ${TEXT_ALIGNMENTS.join(' | ')}
(If a preferred type/placement is given above, honor it unless it clearly conflicts with the content.)

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Catchy headline (max 60 chars, create urgency or excitement)",
  "subtitle": "Supporting text (max 100 chars, expand on the value proposition)",
  "ctaText": "Action button text (3-6 words, e.g. 'Shop Now', 'Discover More')",
  "backgroundColor": "#hexcolor that complements beverages (warm, appetizing colors work well)",
  "textColor": "#hexcolor for maximum contrast and readability on the background",
  "tags": ["relevant", "searchable", "tags"],
  "type": "one of the allowed type values",
  "placement": "one of the allowed placement values",
  "ctaStyle": "one of the allowed ctaStyle values",
  "contentPosition": "one of the allowed contentPosition values",
  "textAlignment": "one of the allowed textAlignment values"
}`;

    const text = await callBannerHaikuJson(prompt, 2048);
    const parsed = parseAiJson(text, null);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid AI response');

    const data = sanitizeBannerData(parsed);

    res.json({
      success: true,
      data,
      metadata: {
        hasProduct: !!productContext,
        hasCategory: !!categoryContext,
        hasSubcategory: !!subcategoryContext,
        hasBrand: !!brandContext,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Banner generation error:', error.message);
    return res.json({
      success: true,
      data: generateDemoBannerContent(req.body),
      note: 'Using demo data - AI service unavailable',
      fallback: true
    });
  }
});

/**
 * Generate demo banner content (used as fallback when AI is unavailable)
 */
const generateDemoBannerContent = (params) => {
  const { style } = params;

  const styleConfigs = {
    playful: {
      titles: ['Cheers to Good Times!', 'Drink Happy!', 'Let\'s Celebrate!', 'Party Ready?'],
      subtitles: ['Amazing deals on your favorite drinks', 'Quality beverages for every occasion', 'Unbeatable prices, incredible taste'],
      ctas: ['Shop Now', 'Grab a Drink', 'Join the Party', 'Explore Deals']
    },
    elegant: {
      titles: ['Timeless Elegance', 'Savor the Moment', 'Refined Tastes', 'Artisan Crafted'],
      subtitles: ['Premium spirits for the discerning palate', 'Experience exceptional quality', 'Where tradition meets excellence'],
      ctas: ['Discover More', 'Explore Collection', 'Learn More', 'View Selection']
    },
    urgent: {
      titles: ['Flash Sale!', 'Limited Time Only', 'Don\'t Miss Out!', 'Ends Soon!'],
      subtitles: ['Prices won\'t last forever', 'Act fast - selling out fast', 'Hurry! Deal ends in hours'],
      ctas: ['Buy Now', 'Get It Before It\'s Gone', 'Shop Sale', 'Claim Offer']
    },
    calm: {
      titles: ['Relax & Enjoy', 'Take It Easy', 'Quality Time', 'Simple Pleasures'],
      subtitles: ['Premium drinks for peaceful moments', 'Crafted for your comfort', 'Sip and unwind'],
      ctas: ['Browse Collection', 'View Products', 'Explore', 'See More']
    }
  };

  const config = styleConfigs[style] || styleConfigs.playful;
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const colors = [
    { bg: '#1a1a2e', text: '#ffffff' },
    { bg: '#2d1b4e', text: '#ffffff' },
    { bg: '#1b4332', text: '#ffffff' },
    { bg: '#4a1942', text: '#ffffff' },
    { bg: '#1e3a5f', text: '#ffffff' },
    { bg: '#3d2645', text: '#ffffff' },
    { bg: '#2c3e50', text: '#ffffff' },
    { bg: '#4a0e4e', text: '#ffffff' },
  ];
  const colorPair = randomPick(colors);

  return {
    title: randomPick(config.titles),
    subtitle: randomPick(config.subtitles),
    ctaText: randomPick(config.ctas),
    backgroundColor: colorPair.bg,
    textColor: colorPair.text,
    tags: ['premium', 'quality', 'drinks', 'beverages'],
    contentPosition: 'center',
    textAlignment: 'center',
    styleNote: `Demo content generated with ${style || 'playful'} style`
  };
};

/**
 * Generate banner suggestions (multiple options)
 * POST /api/banner-ai/suggestions
 */
const generateBannerSuggestions = asyncHandler(async (req, res) => {
  const { productId, categoryId, subcategoryId, brandId, count = 3 } = req.body;

  const demoFallback = () => {
    const demoSuggestions = [];
    for (let i = 0; i < count; i++) {
      demoSuggestions.push(generateDemoBannerContent({ ...req.body, style: ['playful', 'elegant', 'urgent', 'calm'][i % 4] }));
    }
    return demoSuggestions;
  };

  if (!anthropic) {
    const demo = demoFallback();
    return res.json({
      success: true,
      data: demo,
      note: 'Using demo data - AI not configured',
      fallback: true,
      metadata: { count: demo.length, generatedAt: new Date().toISOString() }
    });
  }

  try {
    let contextDesc = '';

    if (productId) {
      const product = await Product.findById(productId).populate('brand', 'name').lean();
      if (product) contextDesc = `Product: "${product.name}" by ${product.brand?.name || 'Unknown Brand'}`;
    } else if (subcategoryId) {
      const subcategory = await SubCategory.findById(subcategoryId).populate('parent', 'name').lean();
      if (subcategory) contextDesc = `Subcategory: "${subcategory.name}"${subcategory.parent?.name ? ` (under ${subcategory.parent.name})` : ''}`;
    } else if (categoryId) {
      const category = await Category.findById(categoryId).lean();
      if (category) contextDesc = `Category: "${category.name}"`;
    } else if (brandId) {
      const brand = await Brand.findById(brandId).lean();
      if (brand) contextDesc = `Brand: "${brand.name}"`;
    }

    const prompt = `Generate ${count} different banner content options for: ${contextDesc || 'a promotional banner'}

Create varied options with different tones (urgent, playful, elegant, informative), CTA styles, and complementary color schemes for beverage marketing.

Each option must include: title (max 60 chars), subtitle (max 100 chars), ctaText (3-6 words), backgroundColor (hex), textColor (hex for contrast), tags (4-6), styleNote (brief tone description).

Return ONLY a valid JSON array (no markdown):
[{ "title": "...", "subtitle": "...", "ctaText": "...", "backgroundColor": "#...", "textColor": "#...", "tags": ["..."], "styleNote": "..." }]`;

    const text = await callBannerHaikuJson(prompt, 4096);
    let suggestions = parseAiJson(text, []);
    if (!Array.isArray(suggestions)) suggestions = [];
    suggestions = suggestions.slice(0, count).map(sanitizeBannerData);

    res.json({
      success: true,
      data: suggestions,
      metadata: { count: suggestions.length, generatedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Banner suggestions error:', error.message);
    const demo = demoFallback();
    res.json({
      success: true,
      data: demo,
      note: 'Using demo data - AI service unavailable',
      fallback: true,
      metadata: { count: demo.length, generatedAt: new Date().toISOString() }
    });
  }
});

/**
 * Enhance existing banner content (title/subtitle/ctaText together)
 * POST /api/banner-ai/enhance
 */
const enhanceBannerContent = asyncHandler(async (req, res) => {
  const { title, subtitle, ctaText, style, goal } = req.body;

  if (!title && !subtitle && !ctaText) {
    res.status(400);
    throw new Error('At least one field (title, subtitle, or ctaText) is required');
  }
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });

  const goalText = goal === 'urgency' ? 'Create urgency and FOMO'
    : goal === 'engagement' ? 'Increase engagement and clicks'
    : goal === 'trust' ? 'Build trust and credibility'
    : 'Maximize conversions';

  const prompt = `Enhance the following banner content for maximum conversions.

Current content:
${title ? `- Title: "${title}"` : ''}
${subtitle ? `- Subtitle: "${subtitle}"` : ''}
${ctaText ? `- CTA: "${ctaText}"` : ''}

Goal: ${goalText}
Style: ${style || 'professional'}

Enhance and return ONLY the JSON (no markdown):
{
  ${title ? `"title": "Enhanced title (keep under 60 chars)"` : '"title": null'},
  ${subtitle ? `"subtitle": "Enhanced subtitle (keep under 100 chars)"` : '"subtitle": null'},
  ${ctaText ? `"ctaText": "Enhanced CTA (3-6 words)"` : '"ctaText": null'},
  "improvementNotes": "Brief explanation of what was improved"
}`;

  try {
    const data = parseAiJson(await callBannerHaikuJson(prompt, 1024), null);
    if (!data || typeof data !== 'object') throw new Error('Invalid AI response');
    res.json({
      success: true,
      data: {
        title: data.title ? clampField('title', data.title) : (title ? title : null),
        subtitle: data.subtitle ? clampField('subtitle', data.subtitle) : (subtitle ? subtitle : null),
        ctaText: data.ctaText ? clampField('ctaText', data.ctaText) : (ctaText ? ctaText : null),
        improvementNotes: typeof data.improvementNotes === 'string' ? data.improvementNotes : '',
      },
      metadata: {
        enhancedFields: [title && 'title', subtitle && 'subtitle', ctaText && 'ctaText'].filter(Boolean),
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Banner enhancement error:', error.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }
});

/**
 * Enhance a single banner copy field (per-field sparkle in the editor).
 * Mirrors the blog editor's per-block rewrite/expand/shorten.
 * POST /api/banner-ai/enhance-field
 * @body { field: 'title'|'subtitle'|'ctaText', value: string, action?, context? }
 */
const enhanceField = asyncHandler(async (req, res) => {
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });
  const { field, value, action = 'rewrite', context = {} } = req.body || {};

  if (!AI_FIELD_ACTIONS.includes(action)) {
    return res.status(400).json({ message: `action must be one of: ${AI_FIELD_ACTIONS.join(', ')}` });
  }
  if (!isEnhanceableField(field, value)) {
    return res.status(400).json({ message: 'field must be one of title, subtitle, ctaText and value must be non-empty' });
  }

  const label = { title: 'headline', subtitle: 'supporting subtitle', ctaText: 'call-to-action button label' }[field];
  const limit = { title: 60, subtitle: 100, ctaText: 30 }[field];
  const instruction = {
    rewrite: 'Rewrite it to be clearer and more compelling, keeping the same intent and roughly the same length',
    expand: 'Make it a touch richer and more descriptive while staying within the length limit',
    shorten: 'Tighten it — cut filler, keep it punchy and scannable',
    punchier: 'Make it bolder and more action-driven to boost clicks, without being gimmicky',
  }[action];

  const prompt = `You are editing the ${label} of a DrinksHarbour promotional banner (premium Nigerian drinks marketplace).
${context.type ? `Banner type: ${context.type}\n` : ''}${context.placement ? `Placement: ${context.placement}\n` : ''}${context.title && field !== 'title' ? `Banner title for context: "${context.title}"\n` : ''}
${instruction}. Keep it under ${limit} characters. Do NOT add quotes, labels, or commentary.

Current ${label}: "${value}"

Return ONLY {"value": "..."} — the revised ${label} as a single JSON string. No code fences, no preamble.`;

  try {
    const data = parseAiJson(await callBannerHaikuJson(prompt, 512), null);
    const revised = clampField(field, data && data.value);
    if (!revised) throw new Error('AI returned empty value');
    return res.json({ success: true, field, value: revised });
  } catch (err) {
    console.error('enhanceField AI error:', err.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }
});

/**
 * Generate banner image prompt
 * POST /api/banner-ai/image-prompt
 */
const generateImagePrompt = asyncHandler(async (req, res) => {
  const { title, subtitle, bannerType, style } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Banner title is required');
  }
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });

  const prompt = `Generate a detailed image generation prompt for a marketing banner image.

Banner Title: "${title}"
${subtitle ? `Banner Subtitle: "${subtitle}"` : ''}
Banner Type: ${bannerType || 'promotional'}
Style: ${style || 'modern, clean, professional'}

The prompt should suit AI image generators (DALL-E, Midjourney, Stable Diffusion). Include main subject/focus, composition and layout, color mood and palette, style references, text placement guidance, and technical specs.

Return ONLY valid JSON:
{ "prompt": "Detailed image generation prompt", "negativePrompt": "What to avoid", "suggestedStyle": "photography, illustration, etc.", "aspectRatio": "3:1 or 16:9" }`;

  try {
    const data = parseAiJson(await callBannerHaikuJson(prompt, 512), null);
    if (!data || typeof data !== 'object') throw new Error('Invalid AI response');
    res.json({ success: true, data, metadata: { generatedAt: new Date().toISOString() } });
  } catch (error) {
    console.error('Image prompt generation error:', error.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }
});

/**
 * Get context data for banner generation
 * GET /api/banner-ai/context-data
 */
const getContextData = asyncHandler(async (req, res) => {
  try {
    const [categories, subcategories, products, brands] = await Promise.all([
      fetchCategories(),
      fetchSubCategories(150),
      fetchProducts(50),
      fetchBrands(50)
    ]);
    res.json({ success: true, data: { categories, subcategories, products, brands } });
  } catch (error) {
    console.error('Error fetching context data:', error);
    res.status(500);
    throw new Error('Failed to fetch context data');
  }
});

module.exports = {
  generateBannerContent,
  generateBannerSuggestions,
  enhanceBannerContent,
  enhanceField,
  generateImagePrompt,
  getContextData
};
