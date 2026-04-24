// controllers/banner-gemini.controller.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Brand = require('../models/Brand');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

function parseJSONResponse(text, defaultValue = {}) {
  if (!text || typeof text !== 'string') {
    return defaultValue;
  }

  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  cleaned = cleaned.replace(/\\n/g, ' ').replace(/\n/g, ' ');

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = firstBrace === -1 ? firstBracket : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket));

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = lastBrace === -1 ? lastBracket : (lastBracket === -1 ? lastBrace : Math.max(lastBrace, lastBracket));

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }
}

const BANNER_TYPES = ['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'];
const BANNER_PLACEMENTS = ['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'];
const BANNER_VISIBLE_TO = ['all', 'guests', 'authenticated', 'new_customers', 'returning_customers', 'vip'];

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
    const products = await Product.find({ status: 'published' })
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

/**
 * Generate complete banner content using AI
 * POST /api/banner/generate-banner
 */
const generateBannerContent = asyncHandler(async (req, res) => {
  const { 
    productId, 
    categoryId, 
    brandId, 
    bannerType, 
    placement,
    customContext,
    style 
  } = req.body;

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      }
    });

    let productContext = null;
    let categoryContext = null;
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
        categoryContext = {
          name: category.name,
          type: category.type,
          description: category.description
        };
      }
    }

    if (brandId) {
      const brand = await Brand.findById(brandId).lean();
      if (brand) {
        brandContext = {
          name: brand.name,
          description: brand.description
        };
      }
    }

    const prompt = `You are an expert e-commerce copywriter for DrinksHarbour, a premium beverages online store.

Generate catchy, conversion-optimized banner content for a beverage e-commerce platform.

${productContext ? `
PRODUCT CONTEXT:
- Product Name: "${productContext.name}"
- Type: ${productContext.type || 'N/A'}
- Brand: ${productContext.brand || 'N/A'}
- Category: ${productContext.category || 'N/A'}
- Description: ${productContext.shortDescription || 'N/A'}
- ABV: ${productContext.abv ? `${productContext.abv}%` : 'N/A'}
- Origin: ${productContext.origin || 'N/A'}
${productContext.vintage ? `- Vintage: ${productContext.vintage}` : ''}
` : ''}

${categoryContext ? `
CATEGORY CONTEXT:
- Category: "${categoryContext.name}"
- Type: ${categoryContext.type || 'N/A'}
- Description: ${categoryContext.description || 'N/A'}
` : ''}

${brandContext ? `
BRAND CONTEXT:
- Brand: "${brandContext.name}"
- Description: ${brandContext.description || 'N/A'}
` : ''}

${customContext ? `
ADDITIONAL CONTEXT:
${customContext}
` : ''}

STYLE GUIDANCE:
${style === 'playful' ? '- Playful, fun, energetic tone' : ''}
${style === 'elegant' ? '- Elegant, sophisticated, premium tone' : ''}
${style === 'urgent' ? '- Urgent, FOMO-inducing, action-oriented' : ''}
${style === 'calm' ? '- Calm, reassuring, trustworthy tone' : ''}
${!style ? '- Balanced, professional yet engaging tone' : ''}

Banner Type: ${bannerType || 'promotional'}
Placement: ${placement || 'home_hero'}

Generate content that will drive clicks and conversions. Make it compelling and action-oriented.

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Catchy headline (max 60 chars, create urgency or excitement)",
  "subtitle": "Supporting text (max 100 chars, expand on the value proposition)",
  "ctaText": "Action button text (3-6 words, e.g. 'Shop Now', 'Discover More', 'Get Yours Today')",
  "backgroundColor": "#hexcolor that complements beverages (warm, appetizing colors work well)",
  "textColor": "#hexcolor for maximum contrast and readability on the background",
  "tags": ["relevant", "searchable", "tags", "for", "this", "banner"],
  "contentPosition": "center",
  "textAlignment": "center"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let data = parseJSONResponse(text);

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid AI response');
    }

    data = sanitizeBannerData(data);

    res.json({
      success: true,
      data,
      metadata: {
        hasProduct: !!productContext,
        hasCategory: !!categoryContext,
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
 * Generate demo banner content (used as fallback)
 */
const generateDemoBannerContent = (params) => {
  const { categoryId, productId, brandId, bannerType, style } = params;
  
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
    styleNote: `Demo content generated with ${style} style`
  };
};

/**
 * Generate banner suggestions (multiple options)
 * POST /api/banner/generate-banner-suggestions
 */
const generateBannerSuggestions = asyncHandler(async (req, res) => {
  const { 
    productId, 
    categoryId, 
    brandId, 
    count = 3 
  } = req.body;

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      }
    });

    let contextDesc = '';
    
    if (productId) {
      const product = await Product.findById(productId).populate('brand', 'name').lean();
      if (product) {
        contextDesc = `Product: "${product.name}" by ${product.brand?.name || 'Unknown Brand'}`;
      }
    } else if (categoryId) {
      const category = await Category.findById(categoryId).lean();
      if (category) {
        contextDesc = `Category: "${category.name}"`;
      }
    } else if (brandId) {
      const brand = await Brand.findById(brandId).lean();
      if (brand) {
        contextDesc = `Brand: "${brand.name}"`;
      }
    }

    const prompt = `Generate ${count} different banner content options for: ${contextDesc || 'a promotional banner'}

Create varied options with different:
- Tones (urgent, playful, elegant, informative)
- CTA styles (direct, curiosity-driven, benefit-focused)
- Color schemes (pick complementary colors that work well for beverage marketing)

Each option should include:
- title (catchy headline, max 60 chars)
- subtitle (supporting text, max 100 chars)
- ctaText (action button, 3-6 words)
- backgroundColor (hex color)
- textColor (hex color for contrast)
- tags (array of 4-6 relevant tags)
- styleNote (brief description of the tone/approach)

Return ONLY valid JSON array (no markdown):
[
  {
    "title": "Option 1 title",
    "subtitle": "Option 1 subtitle",
    "ctaText": "Option 1 CTA",
    "backgroundColor": "#color",
    "textColor": "#color",
    "tags": ["tag1", "tag2"],
    "styleNote": "Tone description"
  },
  ...
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let suggestions = parseJSONResponse(text, []);

    if (!Array.isArray(suggestions)) {
      suggestions = [];
    }

    suggestions = suggestions.slice(0, count).map(sanitizeBannerData);

    res.json({
      success: true,
      data: suggestions,
      metadata: {
        count: suggestions.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Banner suggestions error:', error.message);

    const demoSuggestions = [];
    for (let i = 0; i < count; i++) {
      demoSuggestions.push(generateDemoBannerContent({ ...req.body, style: ['playful', 'elegant', 'urgent', 'calm'][i % 4] }));
    }

    res.json({
      success: true,
      data: demoSuggestions,
      note: 'Using demo data - AI service unavailable',
      fallback: true,
      metadata: {
        count: demoSuggestions.length,
        generatedAt: new Date().toISOString()
      }
    });
  }
});

/**
 * Enhance existing banner content
 * POST /api/banner/enhance-banner
 */
const enhanceBannerContent = asyncHandler(async (req, res) => {
  const { 
    title, 
    subtitle, 
    ctaText,
    style,
    goal 
  } = req.body;

  if (!title && !subtitle && !ctaText) {
    res.status(400);
    throw new Error('At least one field (title, subtitle, or ctaText) is required');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      }
    });

    const prompt = `You are an expert e-commerce copywriter. Enhance the following banner content for maximum conversions.

Current content:
${title ? `- Title: "${title}"` : ''}
${subtitle ? `- Subtitle: "${subtitle}"` : ''}
${ctaText ? `- CTA: "${ctaText}"` : ''}

Goal: ${goal === 'urgency' ? 'Create urgency and FOMO' : goal === 'engagement' ? 'Increase engagement and clicks' : goal === 'trust' ? 'Build trust and credibility' : 'Maximize conversions'}
Style: ${style || 'professional'}

Enhance and return ONLY the JSON (no markdown):
{
  ${title ? `"title": "Enhanced title (keep under 60 chars)"` : '"title": null'},
  ${subtitle ? `"subtitle": "Enhanced subtitle (keep under 100 chars)"` : '"subtitle": null'},
  ${ctaText ? `"ctaText": "Enhanced CTA (3-6 words)"` : '"ctaText": null'},
  "improvementNotes": "Brief explanation of what was improved"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let data = parseJSONResponse(text);

    res.json({
      success: true,
      data,
      metadata: {
        enhancedFields: [title && 'title', subtitle && 'subtitle', ctaText && 'ctaText'].filter(Boolean),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Banner enhancement error:', error.message);

    res.status(500);
    throw new Error(`Failed to enhance banner: ${error.message}`);
  }
});

/**
 * Generate banner image prompt
 * POST /api/banner/generate-image-prompt
 */
const generateImagePrompt = asyncHandler(async (req, res) => {
  const { 
    title, 
    subtitle, 
    bannerType,
    style 
  } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Banner title is required');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 512,
      }
    });

    const prompt = `Generate a detailed image generation prompt for creating a banner image.

Banner Title: "${title}"
${subtitle ? `Banner Subtitle: "${subtitle}"` : ''}
Banner Type: ${bannerType || 'promotional'}
Style: ${style || 'modern, clean, professional'}

The prompt should be suitable for AI image generation (DALL-E, Midjourney, Stable Diffusion).
Include:
- Main subject/focus
- Composition and layout
- Color mood and palette
- Style references
- Text placement guidance
- Technical specs (aspect ratio, etc.)

Return ONLY valid JSON:
{
  "prompt": "Detailed image generation prompt",
  "negativePrompt": "What to avoid in the image",
  "suggestedStyle": "photography, illustration, etc.",
  "aspectRatio": "3:1 or 16:9"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const data = parseJSONResponse(text);

    res.json({
      success: true,
      data,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Image prompt generation error:', error.message);

    res.status(500);
    throw new Error(`Failed to generate image prompt: ${error.message}`);
  }
});

/**
 * Sanitize and validate banner data from AI
 */
const sanitizeBannerData = (data) => {
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  
  return {
    title: typeof data.title === 'string' ? data.title.substring(0, 60) : '',
    subtitle: typeof data.subtitle === 'string' ? data.subtitle.substring(0, 100) : '',
    ctaText: typeof data.ctaText === 'string' ? data.ctaText.substring(0, 30) : '',
    backgroundColor: hexColorRegex.test(data.backgroundColor) ? data.backgroundColor : '#1a1a2e',
    textColor: hexColorRegex.test(data.textColor) ? data.textColor : '#ffffff',
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
    contentPosition: ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(data.contentPosition) ? data.contentPosition : 'center',
    textAlignment: ['left', 'center', 'right'].includes(data.textAlignment) ? data.textAlignment : 'center',
    styleNote: data.styleNote || ''
  };
};

/**
 * Get context data for banner generation
 * GET /api/banner/context-data
 */
const getContextData = asyncHandler(async (req, res) => {
  try {
    const [categories, products, brands] = await Promise.all([
      fetchCategories(),
      fetchProducts(50),
      fetchBrands(50)
    ]);

    res.json({
      success: true,
      data: {
        categories,
        products,
        brands
      }
    });
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
  generateImagePrompt,
  getContextData
};
