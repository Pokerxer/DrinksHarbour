// controllers/gemini.controller.js
const Anthropic = require('@anthropic-ai/sdk');
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Brand = require('../models/Brand');
const {
  researchProduct,
  formatFactsForPrompt,
  applyBriefToProduct,
  filterToEnum,
} = require('../services/productResearch.service');

// AI provider: Claude (Anthropic). Requires ANTHROPIC_API_KEY in server/.env.
// Every product and sub-product generation handler in this controller runs on
// Haiku — there is no second, larger model and no non-Claude fallback here.
const HAIKU_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5';
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Drop-in for the Gemini SDK API surface, now backed by Claude.
// All handlers call genAI.getGenerativeModel() + model.generateContent() + result.response.text()
// unchanged — only this shim selects the underlying AI provider.
const genAI = {
  getGenerativeModel: ({ model: modelOverride, generationConfig = {} } = {}) => {
    // Only a Claude model may be named per call, and in practice every caller
    // names Haiku. Anything else (including a stray non-Claude id) falls back to
    // Haiku rather than silently escalating to a larger, pricier model.
    const activeModel =
      typeof modelOverride === 'string' && modelOverride.startsWith('claude')
        ? modelOverride
        : HAIKU_MODEL;
    const maxTokens = generationConfig.maxOutputTokens ?? 2048;
    // Honor responseMimeType by enabling each provider's native JSON mode, which
    // guarantees syntactically valid JSON and avoids prose/markdown wrappers.
    const wantsJson = generationConfig.responseMimeType === 'application/json';

    const extractContent = (promptOrObj) => {
      if (typeof promptOrObj === 'string') return promptOrObj;
      if (promptOrObj?.contents) {
        return promptOrObj.contents
          .flatMap(c => c.parts || [])
          .map(p => p.text || '')
          .join('\n');
      }
      return String(promptOrObj);
    };

    // Claude (Anthropic). The caller's generationConfig temperature/top_p/top_k
    // are intentionally dropped; JSON shape is enforced via the prompt + a
    // JSON-only system instruction and parsed downstream.
    const callClaude = async (content) => {
      const system = wantsJson
        ? 'You are an expert beverage industry data assistant. Respond with ONLY valid JSON — no markdown code fences, no explanation, no preamble.'
        : 'You are an expert beverage industry data assistant. Respond with only the requested content, no preamble.';
      const message = await anthropic.messages.create({
        model: activeModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      });
      if (message.stop_reason === 'refusal') {
        throw new Error('Claude declined the request');
      }
      const text = (message.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (!text.trim()) throw new Error('Claude returned empty response');
      return text;
    };

    return {
      generateContent: async (promptOrObj) => {
        if (!anthropic) {
          throw new Error('ANTHROPIC_API_KEY is not configured — set it in server/.env');
        }
        const content = extractContent(promptOrObj);
        const text = await callClaude(content);
        return { response: { text: () => text } };
      },
    };
  },
};

// Model used by all product generation handlers (SEO, descriptions, tasting
// notes, etc.) — Haiku, same as the brand/category/subcategory ai-fill.
const MODEL_NAME = HAIKU_MODEL;

// Helper function for robust JSON parsing
function parseJSONResponse(text, defaultValue = {}) {
  if (!text || typeof text !== 'string') {
    return defaultValue;
  }

  // Clean the text
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  cleaned = cleaned.replace(/\\n/g, ' ').replace(/\n/g, ' ');

  // Find first { or [ and last } or ]
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
    // Try regex extraction
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

// Shared guardrail appended to customer-facing copy prompts to keep tone
// consistent and discourage fabricated claims.
const COPY_GUARDRAILS = `
WRITING RULES:
- Audience: shoppers on a Nigerian online drinks retailer (prices in NGN where relevant).
- Use a warm, confident retail voice that helps a shopper decide to buy.
- Do NOT invent specifics you cannot be sure of — no fabricated ABV, awards, medals, ages, vintages, or origin claims.
- Avoid generic filler ("premium", "the finest", "exceptional quality") unless it is genuinely earned by the facts given.
- Return ONLY valid JSON, no markdown fences or commentary.`;

// Collapse stray whitespace and normalize paragraph breaks in generated copy.
const normalizeCopy = (str) =>
  String(str || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

// Lowercase, trim, dedupe (case-insensitively) and cap a keyword/tag array.
const normalizeKeywords = (arr, max = 10) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr
    .map((k) => String(k).trim().toLowerCase())
    .filter((k) => {
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
};

// Product schema enums for validation
const PRODUCT_ENUMS = {
  type: [
    'beer', 'lager', 'ale', 'stout', 'porter', 'ipa', 'pilsner', 'wheat_beer', 'sour_beer', 'craft_beer',
    'wine', 'red_wine', 'white_wine', 'rose_wine', 'sparkling_wine', 'champagne', 'prosecco', 'fortified_wine', 'dessert_wine', 'orange_wine', 'natural_wine',
    'spirit', 'whiskey', 'whisky', 'bourbon', 'scotch', 'rye_whiskey', 'irish_whiskey', 'japanese_whisky',
    'vodka', 'gin', 'rum', 'white_rum', 'dark_rum', 'spiced_rum', 'tequila', 'mezcal', 'brandy', 'cognac', 'armagnac', 'grappa', 'absinthe', 'sake', 'soju',
    'liqueur', 'cream_liqueur', 'coffee_liqueur', 'fruit_liqueur', 'herbal_liqueur', 'amaretto', 'vermouth', 'aperitif', 'digestif', 'bitters',
    'cocktail_ready_to_drink', 'premixed_cocktail', 'hard_seltzer', 'alcopop', 'cooler', 'cider', 'perry', 'mead',
    'non_alcoholic', 'non_alcoholic_beer', 'non_alcoholic_wine', 'non_alcoholic_spirit', 'mocktail',
    'soft_drink', 'cola', 'lemon_lime', 'orange_soda', 'root_beer', 'ginger_ale', 'ginger_beer', 'tonic_water', 'club_soda', 'sparkling_water', 'flavored_water',
    'juice', 'fruit_juice', 'vegetable_juice', 'smoothie', 'kombucha', 'probiotic_drink',
    'coffee', 'espresso', 'cold_brew', 'instant_coffee', 'tea', 'green_tea', 'black_tea', 'herbal_tea', 'oolong_tea', 'white_tea', 'chai', 'matcha', 'hot_chocolate',
    'energy_drink', 'sports_drink', 'protein_shake', 'vitamin_drink', 'electrolyte_drink',
    'water', 'mineral_water', 'spring_water', 'alkaline_water', 'coconut_water',
    'mixer', 'simple_syrup', 'grenadine', 'bitters_mixer',
    'milk', 'dairy_milk', 'plant_milk', 'almond_milk', 'oat_milk', 'soy_milk', 'coconut_milk', 'milkshake',
    'accessory', 'glassware', 'bar_tool', 'ice', 'garnish', 'snack', 'gift_set', 'subscription_box', 'other'
  ],

  standardSizes: [
    '10cl', '18.7cl', '20cl', '25cl', '37.5cl', '50cl', '75cl', '100cl', '150cl', '300cl', '450cl', '600cl', '900cl', '1200cl', '1500cl',
    '5cl', '10cl', '20cl', '35cl', '50cl', '70cl', '1L', '1.5L', '1.75L', '3L',
    '33cl', '35cl', '44cl', '50cl', '56.8cl', '66cl',
    'can-250ml', 'can-330ml', 'can-440ml', 'can-473ml', 'can-500ml', 'can-568ml',
    'bottle-275ml', 'bottle-330ml', 'bottle-355ml', 'bottle-500ml', 'bottle-600ml', 'bottle-750ml',
    'nip-50ml', 'half-pint', 'pint', 'quart',
    '200ml', '250ml', '300ml', '330ml', '500ml', '600ml', '1L', '1.5L', '2L', '3L', '5L',
    '5L', '10L', '20L', '30L', '50L', 'keg', 'mini-keg', 'barrel',
    'pack-4', 'pack-6', 'pack-8', 'pack-12', 'pack-24', 'case-12', 'case-24',
    '100g', '200g', '250g', '500g', '1kg', 'kg-0.5', 'kg-1',
    'unit-single', 'unit', 'single-serve',
    'set-2', 'set-4', 'set-6', 'gift-set',
    'miniature-50ml', 'miniature-100ml', 'miniature-200ml', 'miniature-300ml', 'miniature-500ml'
  ],

  productionMethod: [
    'traditional', 'modern', 'organic', 'biodynamic',
    'pot_still', 'column_still', 'continuous_still',
    'barrel_aged', 'cask_aged', 'oak_aged',
    'cold_brew', 'hot_brew', 'fermented',
    'distilled', 'triple_distilled', 'double_distilled',
    'filtered', 'unfiltered', 'chill_filtered',
    'blended', 'single_malt', 'single_grain',
    'handcrafted', 'small_batch', 'limited_edition'
  ],

  style: [
    'pale_ale', 'brown_ale', 'amber_ale', 'blonde_ale',
    'imperial_stout', 'milk_stout', 'oatmeal_stout',
    'american_ipa', 'english_ipa', 'double_ipa', 'session_ipa',
    'belgian_wit', 'hefeweizen', 'dunkelweizen',
    'gose', 'berliner_weisse', 'lambic', 'gueuze',
    'dry', 'semi_dry', 'semi_sweet', 'sweet', 'off_dry',
    'light_bodied', 'medium_bodied', 'full_bodied',
    'crisp', 'creamy', 'oaked', 'unoaked',
    'smooth', 'bold', 'complex', 'mellow',
    'peated', 'unpeated', 'smoky', 'non_smoky',
    'classic', 'modern', 'traditional', 'innovative',
    'artisanal', 'premium', 'luxury', 'budget_friendly'
  ],

  flavorProfile: [
    'fruity', 'citrus', 'tropical', 'berry', 'stone_fruit',
    'apple', 'pear', 'peach', 'apricot', 'cherry', 'plum',
    'blackberry', 'raspberry', 'strawberry', 'blueberry',
    'lemon', 'lime', 'orange', 'grapefruit',
    'pineapple', 'mango', 'passion_fruit', 'guava',
    'melon', 'watermelon', 'fig', 'date',
    'vanilla', 'caramel', 'toffee', 'butterscotch',
    'chocolate', 'dark_chocolate', 'cocoa',
    'honey', 'maple', 'molasses',
    'sweet', 'sugary', 'candy',
    'spicy', 'peppery', 'cinnamon', 'nutmeg', 'clove',
    'ginger', 'cardamom', 'anise', 'licorice',
    'herbal', 'mint', 'basil', 'thyme', 'rosemary',
    'sage', 'lavender', 'chamomile',
    'floral', 'rose', 'jasmine', 'elderflower',
    'honeysuckle', 'violet', 'hibiscus',
    'oak', 'oaky', 'woody', 'cedar', 'pine',
    'sandalwood', 'tobacco', 'leather', 'smooth',
    'nutty', 'almond', 'hazelnut', 'walnut', 'pecan',
    'malty', 'grainy', 'biscuit', 'bread', 'toast',
    'coffee', 'espresso', 'roasted',
    'earthy', 'mineral', 'slate', 'chalk', 'petrol',
    'mushroom', 'truffle', 'forest_floor', 'wet_stone',
    'smoky', 'peaty', 'charred', 'burnt', 'ash',
    'campfire', 'bacon', 'bbq', 'fire', 'medicinal',
    'creamy', 'buttery', 'milky', 'yogurt', 'cheese', 'dairy', 'custard', 'cream',
    'dry', 'bitter', 'sour', 'tart', 'acidic',
    'salty', 'savory', 'umami',
    'clean', 'crisp', 'fresh', 'light',
    'rich', 'full', 'complex', 'balanced',
    'elegant', 'delicate', 'bold', 'intense', 'subtle', 'zesty', 'lively',
    'refreshing', 'soft', 'round', 'velvety', 'tannic', 'astringent', 'bright', 'deep', 'medium',
    'cranberry', 'redcurrant', 'white_peach', 'nectarine', 'lychee', 'banana', 'cassis', 'dark_cherry', 'red_berry',
    'blossom', 'perfumed', 'sugar', 'pepper', 'cloves', 'moss'
  ],

  allergens: [
    'gluten', 'wheat', 'barley', 'rye',
    'milk', 'lactose', 'eggs', 'fish',
    'shellfish', 'tree_nuts', 'peanuts',
    'soy', 'sulfites', 'sulfur_dioxide'
  ],

  status: ['draft', 'pending', 'approved', 'rejected', 'archived', 'discontinued']
};

// Curated style values offered in the SubProduct "Create New Product" UI
// (client STYLE_OPTIONS). The model must pick from these so a generated style
// maps to a selectable option AND stays within the Product model's `style` enum.
const GENERATED_STYLES = [
  'dry', 'sweet', 'semi_dry', 'semi_sweet', 'sparkling', 'still',
  'oaked', 'unoaked', 'single_malt', 'blended', 'artisanal',
  'premium', 'budget_friendly',
];

// ── Web-grounded generation ─────────────────────────────────────────────────
//
// Objective product facts come from `productResearch.service`, which reads the
// live web and returns only what a real source stated. Anything it could not
// confirm is left blank and flagged rather than invented — a wrong ABV or
// vintage in the catalog is worse than an empty field an admin can fill in.

// Enum allow-lists handed to the merge so a sourced value that the schema
// cannot represent is dropped rather than silently stored.
const RESEARCH_ENUMS = {
  standardSizes: PRODUCT_ENUMS.standardSizes,
  productionMethod: PRODUCT_ENUMS.productionMethod,
  allergens: PRODUCT_ENUMS.allergens,
};

// Research the product named in the request body.
// `cacheOnly` callers (copy generation) reuse a brief a previous search already
// paid for and never trigger one of their own.
const briefFor = (req, { cacheOnly = false } = {}) =>
  researchProduct(
    { name: req.body?.name, brand: req.body?.brand, category: req.body?.type || req.body?.category },
    { cacheOnly }
  );

/**
 * Build a per-field endpoint that answers straight from the research brief.
 * No second model call: the value either came from a source or it did not.
 *
 * @param {string} fact   Field name on `brief.facts`.
 * @param {string} key    Key the admin client expects in `data`.
 * @param {*} blank       Value to return when nothing confirmed it.
 * @param {string[]} [allowed] Optional schema enum to filter against.
 */
const factHandler = (fact, key, blank, allowed) =>
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
      res.status(400);
      throw new Error('Product name is required');
    }

    const brief = await briefFor(req);
    let value = brief.facts[fact];

    if (value !== undefined && Array.isArray(allowed)) {
      value = filterToEnum(value, allowed, fact);
      if (Array.isArray(value) && !value.length) value = undefined;
    }

    const unverified = value === undefined;
    res.json({
      success: true,
      data: { [key]: unverified ? blank : value },
      unverified,
      sources: brief.sources,
      ...(unverified
        ? { note: `No source confirmed the ${key} for "${name}" — left blank.` }
        : {}),
    });
  });

/**
 * Fetch categories and subcategories from database
 */
const fetchCategories = async () => {
  try {
    const categories = await Category.find({ status: 'published' }).select('_id name slug type').lean();
    const subCategories = await SubCategory.find({ status: 'published' }).select('_id name slug type parent').lean();

    return {
      categories: categories.map(c => ({ id: c._id.toString(), name: c.name, slug: c.slug, type: c.type })),
      subCategories: subCategories.map(s => ({ id: s._id.toString(), name: s.name, slug: s.slug, type: s.type, parent: s.parent?.toString() }))
    };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { categories: [], subCategories: [] };
  }
};

/**
 * Generate complete product details from product name
 * POST /api/gemini/generate-product
 */
const generateProductDetails = asyncHandler(async (req, res) => {
  const { name, category: inputCategory } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  try {
    // Fetch categories and subcategories from database
    const { categories, subCategories } = await fetchCategories();

    // Research the product on the live web before generating anything. Every
    // objective field below is answered from this brief, not from model recall.
    const brief = await researchProduct(
      { name, brand: req.body.brand, category: inputCategory },
      {}
    );
    const factsBlock = formatFactsForPrompt(brief);

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        topK: 32,
        topP: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      }
    });

    const catList = categories.map(c => c.name).join(', ');
    const subCatList = subCategories.map(s => s.name).join(', ');
    const prompt = `You are a beverage expert. Generate product details for "${name}"${inputCategory ? ` (category: ${inputCategory})` : ''} as compact JSON. Use only values from the lists below. Return ONLY valid JSON, no markdown.
${factsBlock}${factsBlock ? '' : `
NO SOURCES WERE FOUND for this product. Leave every factual field (abv, volumeMl, originCountry, region, appellation, producer, vintage, age, ageStatement, distilleryName, breweryName, wineryName, productionMethod, caskType, standardSizes, ingredients, allergens) empty or null. Do NOT infer them from the product name or category. You may still write the category, type, description and SEO copy.
`}
CATEGORIES: ${catList}
SUBCATEGORIES: ${subCatList}
TYPES: ${PRODUCT_ENUMS.type.slice(0, 25).join(', ')}
SIZES: ${PRODUCT_ENUMS.standardSizes.slice(0, 12).join(', ')}
FLAVORS: ${PRODUCT_ENUMS.flavorProfile.slice(0, 20).join(', ')}
STYLES: ${GENERATED_STYLES.join(', ')} (pick the single closest "style" value, or "" if none clearly fit)

Return this JSON (fill all fields accurately):
{"name":"${name}","slug":"","type":"","subType":"","style":"","categoryName":"","subCategoryName":"","isAlcoholic":true,"abv":0,"proof":0,"volumeMl":750,"standardSizes":[],"servingSize":"","servingsPerContainer":0,"originCountry":"","region":"","appellation":null,"producer":"","brand":"","vintage":null,"age":null,"ageStatement":null,"distilleryName":null,"breweryName":null,"wineryName":null,"productionMethod":null,"caskType":null,"finish":null,"shortDescription":"","description":"","tastingNotes":{"nose":[],"aroma":[],"palate":[],"taste":[],"finish":[],"mouthfeel":[],"appearance":"","color":""},"flavorProfile":[],"foodPairings":[],"servingSuggestions":{"temperature":"","glassware":"","garnish":[],"mixers":[]},"isDietary":{"vegan":false,"vegetarian":false,"glutenFree":false,"dairyFree":false,"organic":false,"kosher":false,"halal":false,"sugarFree":false,"lowCalorie":false,"lowCarb":false},"allergens":[],"ingredients":[],"nutritionalInfo":{"calories":null,"carbohydrates":null,"sugar":null,"protein":null,"fat":null,"sodium":null,"caffeine":null},"metaTitle":"","metaDescription":"","keywords":[],"status":"draft"}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response - try direct parse first, then fallback to helper
    let productData;
    try {
      productData = JSON.parse(text);
    } catch (parseError) {
      console.error('Direct JSON parse failed, trying helper...');
      productData = parseJSONResponse(text, null);
      
      if (!productData) {
        console.error('JSON Parse Error:', parseError.message);
        console.error('Raw Response:', text.substring(0, 800));
        throw new Error('Failed to generate product details: Invalid JSON in AI response');
      }
    }

    if (!productData || typeof productData !== 'object') {
      console.error('Invalid product data structure');
      console.error('Raw Response:', text.substring(0, 800));
      throw new Error('Failed to generate product details: Invalid response structure');
    }

    // Enhanced data validation and category matching
    const matchedCategory = categories.find(c =>
      c.name.toLowerCase() === productData.categoryName?.toLowerCase() ||
      c.name.toLowerCase().includes(productData.categoryName?.toLowerCase()) ||
      productData.categoryName?.toLowerCase().includes(c.name.toLowerCase())
    );

    // First try to match subcategory within the matched category's children
    let matchedSubCategory = null;
    if (matchedCategory) {
      matchedSubCategory = subCategories.find(s =>
        s.parent === matchedCategory.id &&
        (s.name.toLowerCase() === productData.subCategoryName?.toLowerCase() ||
          s.name.toLowerCase().includes(productData.subCategoryName?.toLowerCase()) ||
          productData.subCategoryName?.toLowerCase().includes(s.name.toLowerCase()))
      );
    }

    // If no match with parent filter, try matching any subcategory
    if (!matchedSubCategory) {
      matchedSubCategory = subCategories.find(s =>
        s.name.toLowerCase() === productData.subCategoryName?.toLowerCase() ||
        s.name.toLowerCase().includes(productData.subCategoryName?.toLowerCase()) ||
        productData.subCategoryName?.toLowerCase().includes(s.name.toLowerCase())
      );
    }

    // Set matched IDs
    productData.category = matchedCategory?.id || null;
    productData.subCategory = matchedSubCategory?.id || null;

    // Clean up temporary fields
    delete productData.categoryName;
    delete productData.subCategoryName;

    // Enhanced data sanitization with validation
    productData = sanitizeProductData(productData);

    // The brief overrides the fill pass. Even if the model ignored the
    // instruction above and invented an ABV, it cannot survive this step —
    // unconfirmed factual fields are blanked and reported back as unverified.
    const merged = applyBriefToProduct(productData, brief, {
      enums: RESEARCH_ENUMS,
      // The admin typed these; they are not ours to erase.
      preserve: [req.body.brand ? 'brand' : null].filter(Boolean),
    });
    productData = merged.data;

    // Additional quality checks
    if (productData.abv && productData.abv > 0 && !productData.isAlcoholic) {
      productData.isAlcoholic = true;
    }

    res.json({
      success: true,
      data: productData,
      sources: brief.sources,
      unverified: merged.unverified,
      researched: brief.found,
      ...(brief.found
        ? {}
        : {
            note: `No authoritative source was found for "${name}". Factual fields were left blank for you to fill in; the description and SEO copy are generic.`,
          }),
      metadata: {
        matchedCategory: matchedCategory?.name || null,
        matchedSubCategory: matchedSubCategory?.name || null,
        sourceCount: brief.sources.length,
        searchedAt: brief.searchedAt,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Gemini API error:', error.message);

    // On quota exhaustion, hand back an empty skeleton rather than a plausible
    // one. The previous behaviour invented an ABV, origin and tasting notes and
    // returned them as `success: true`, which is indistinguishable from real
    // generated data once it is in the form.
    if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('RATE_LIMIT'))) {
      console.log('API quota/rate limit exceeded, returning a blank skeleton');

      return res.json({
        success: true,
        data: generateBlankProductSkeleton(name),
        unverified: FACTUAL_PRODUCT_FIELDS,
        sources: [],
        researched: false,
        note: 'AI quota exceeded — nothing could be verified, so all fields were left blank. Try again later.',
        fallback: true
      });
    }

    res.status(500);
    throw new Error(`Failed to generate product details: ${error.message}`);
  }
});

/**
 * Sanitize and validate product data from AI
 */
const sanitizeProductData = (data) => {
  // Ensure all required fields exist
  const sanitized = {
    name: data.name || '',
    slug: data.slug || '',
    type: PRODUCT_ENUMS.type.includes(data.type) ? data.type : 'other',
    subType: data.subType || '',
    style: GENERATED_STYLES.includes(data.style) ? data.style : '',
    category: data.category || null,
    subCategory: data.subCategory || null,
    isAlcoholic: Boolean(data.isAlcoholic),
    abv: typeof data.abv === 'number' ? data.abv : null,
    proof: typeof data.proof === 'number' ? data.proof : null,
    volumeMl: typeof data.volumeMl === 'number' ? data.volumeMl : null,
    standardSizes: Array.isArray(data.standardSizes)
      ? data.standardSizes.filter(s => PRODUCT_ENUMS.standardSizes.includes(s))
      : [],
    servingSize: data.servingSize || '',
    servingsPerContainer: typeof data.servingsPerContainer === 'number' ? data.servingsPerContainer : null,

    originCountry: data.originCountry || '',
    region: data.region || '',
    appellation: data.appellation || '',
    producer: data.producer || '',
    brand: data.brand || '',
    vintage: typeof data.vintage === 'number' ? data.vintage : null,
    age: typeof data.age === 'number' ? data.age : null,
    ageStatement: data.ageStatement || '',
    distilleryName: data.distilleryName || '',
    breweryName: data.breweryName || '',
    wineryName: data.wineryName || '',
    productionMethod: PRODUCT_ENUMS.productionMethod.includes(data.productionMethod)
      ? data.productionMethod
      : null,
    caskType: data.caskType || '',
    finish: data.finish || '',

    shortDescription: data.shortDescription || '',
    description: data.description || '',

    tastingNotes: {
      nose: Array.isArray(data.tastingNotes?.nose) ? data.tastingNotes.nose : [],
      aroma: Array.isArray(data.tastingNotes?.aroma) ? data.tastingNotes.aroma : [],
      palate: Array.isArray(data.tastingNotes?.palate) ? data.tastingNotes.palate : [],
      taste: Array.isArray(data.tastingNotes?.taste) ? data.tastingNotes.taste : [],
      finish: Array.isArray(data.tastingNotes?.finish) ? data.tastingNotes.finish : [],
      mouthfeel: Array.isArray(data.tastingNotes?.mouthfeel) ? data.tastingNotes.mouthfeel : [],
      appearance: data.tastingNotes?.appearance || '',
      color: data.tastingNotes?.color || '',
    },

    flavorProfile: Array.isArray(data.flavorProfile)
      ? data.flavorProfile.filter(f => PRODUCT_ENUMS.flavorProfile.includes(f))
      : [],
    foodPairings: Array.isArray(data.foodPairings) ? data.foodPairings : [],
    servingSuggestions: {
      temperature: data.servingSuggestions?.temperature || '',
      glassware: data.servingSuggestions?.glassware || '',
      garnish: Array.isArray(data.servingSuggestions?.garnish) ? data.servingSuggestions.garnish : [],
      mixers: Array.isArray(data.servingSuggestions?.mixers) ? data.servingSuggestions.mixers : [],
    },

    isDietary: {
      vegan: Boolean(data.isDietary?.vegan),
      vegetarian: Boolean(data.isDietary?.vegetarian),
      glutenFree: Boolean(data.isDietary?.glutenFree),
      dairyFree: Boolean(data.isDietary?.dairyFree),
      organic: Boolean(data.isDietary?.organic),
      kosher: Boolean(data.isDietary?.kosher),
      halal: Boolean(data.isDietary?.halal),
      sugarFree: Boolean(data.isDietary?.sugarFree),
      lowCalorie: Boolean(data.isDietary?.lowCalorie),
      lowCarb: Boolean(data.isDietary?.lowCarb),
    },

    allergens: Array.isArray(data.allergens)
      ? data.allergens.filter(a => PRODUCT_ENUMS.allergens.includes(a))
      : [],
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],

    nutritionalInfo: {
      calories: typeof data.nutritionalInfo?.calories === 'number' ? data.nutritionalInfo.calories : null,
      carbohydrates: typeof data.nutritionalInfo?.carbohydrates === 'number' ? data.nutritionalInfo.carbohydrates : null,
      sugar: typeof data.nutritionalInfo?.sugar === 'number' ? data.nutritionalInfo.sugar : null,
      protein: typeof data.nutritionalInfo?.protein === 'number' ? data.nutritionalInfo.protein : null,
      fat: typeof data.nutritionalInfo?.fat === 'number' ? data.nutritionalInfo.fat : null,
      sodium: typeof data.nutritionalInfo?.sodium === 'number' ? data.nutritionalInfo.sodium : null,
      caffeine: typeof data.nutritionalInfo?.caffeine === 'number' ? data.nutritionalInfo.caffeine : null,
    },

    metaTitle: data.metaTitle || '',
    metaDescription: data.metaDescription || '',
    // Prompts ask for "keywords" — keep both spellings so they survive sanitising
    metaKeywords: Array.isArray(data.metaKeywords)
      ? data.metaKeywords
      : Array.isArray(data.keywords)
        ? data.keywords
        : [],
    keywords: Array.isArray(data.keywords)
      ? data.keywords
      : Array.isArray(data.metaKeywords)
        ? data.metaKeywords
        : [],
    status: 'draft',
  };

  return sanitized;
};

/**
 * Empty product skeleton returned when nothing could be verified.
 *
 * This deliberately contains no facts. It replaces an earlier helper that
 * synthesised a complete, plausible spec sheet — ABV, origin, tasting notes,
 * nutrition — from nothing but the product name, and returned it as a normal
 * success. That data was indistinguishable from researched data once it landed
 * in the form, which is exactly the failure this module exists to prevent.
 */
const generateBlankProductSkeleton = (name) => ({
  name,
  slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  type: '',
  subType: '',
  style: '',
  category: null,
  subCategory: null,
  isAlcoholic: null,
  abv: null,
  proof: null,
  volumeMl: null,
  standardSizes: [],
  servingSize: '',
  servingsPerContainer: null,
  originCountry: '',
  region: '',
  appellation: '',
  producer: '',
  brand: '',
  vintage: null,
  age: null,
  ageStatement: '',
  distilleryName: '',
  breweryName: '',
  wineryName: '',
  productionMethod: null,
  caskType: '',
  finish: '',
  shortDescription: '',
  description: '',
  tastingNotes: { nose: [], aroma: [], palate: [], taste: [], finish: [], mouthfeel: [], appearance: '', color: '' },
  flavorProfile: [],
  foodPairings: [],
  servingSuggestions: { temperature: '', glassware: '', garnish: [], mixers: [] },
  isDietary: {},
  allergens: [],
  ingredients: [],
  nutritionalInfo: { calories: null, carbohydrates: null, sugar: null, protein: null, fat: null, sodium: null, caffeine: null },
  metaTitle: '',
  metaDescription: '',
  metaKeywords: [],
  keywords: [],
  status: 'draft',
});

// Product fields that must never be filled without a source behind them.
const FACTUAL_PRODUCT_FIELDS = [
  'brand', 'producer', 'distilleryName', 'breweryName', 'wineryName',
  'originCountry', 'region', 'appellation', 'abv', 'volumeMl', 'vintage',
  'age', 'ageStatement', 'productionMethod', 'caskType', 'standardSizes',
  'ingredients', 'allergens',
];

/**
 * Generate product description only
 * POST /api/gemini/generate-description
 */
const generateDescription = asyncHandler(async (req, res) => {
  const { name, type, brand } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const prompt = `Write a compelling product description for "${name}"${type ? `, a ${type}` : ''}${brand ? ` by ${brand}` : ''}.

Include:
1. A short description (max 280 characters) for product cards
2. A full description (3-5 paragraphs) with history, production details, and tasting notes
3. Key flavor profiles (array of descriptors)
4. Food pairing suggestions (array)
${grounding}${COPY_GUARDRAILS}
Return as JSON:
{
  "shortDescription": "...",
  "description": "...",
  "flavorProfile": ["flavor1", "flavor2"],
  "foodPairings": ["pairing1", "pairing2"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract JSON - find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    text = text.trim();

    const data = parseJSONResponse(text, {
      shortDescription: `Premium ${name} - an exceptional ${type || 'beverage'}.`,
      description: `${name} represents the finest in ${type || 'beverage'} craftsmanship.`,
      flavorProfile: ['smooth', 'rich', 'balanced'],
      foodPairings: ['Grilled meats', 'Aged cheese'],
    });

    if (data.shortDescription) data.shortDescription = normalizeCopy(data.shortDescription);
    if (data.description) data.description = normalizeCopy(data.description);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    res.json({
      success: true,
      data: {
        shortDescription: '',
        description: '',
        flavorProfile: [],
        foodPairings: [],
      },
      error: true,
      note: 'AI quota exceeded — nothing was written rather than guessing.',
    });
  }
});

/**
 * Generate beverage information (ABV, volume, etc.)
 * POST /api/gemini/generate-beverage-info
 */
const generateBeverageInfo = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  const brief = await briefFor(req);
  const { abv, volumeMl } = brief.facts;
  const standardSizes = (brief.facts.standardSizes || []).filter((s) =>
    PRODUCT_ENUMS.standardSizes.includes(s)
  );
  const unverified = ['abv', 'volumeMl', 'standardSizes'].filter(
    (f) => brief.facts[f] === undefined
  );

  res.json({
    success: true,
    data: {
      isAlcoholic: abv === undefined ? null : abv > 0,
      abv: abv ?? null,
      proof: abv === undefined ? null : parseFloat((abv * 2).toFixed(1)),
      volumeMl: volumeMl ?? null,
      standardSizes,
      // Serving size and servings-per-container are arithmetic on a sourced
      // volume, not independent claims — so they only exist when it does.
      servingSize: '',
      servingsPerContainer: null,
    },
    unverified,
    sources: brief.sources,
    ...(unverified.length
      ? { note: `No source confirmed ${unverified.join(', ')} for "${name}" — left blank.` }
      : {}),
  });
});

/**
 * Generate SEO content
 * POST /api/gemini/generate-seo
 */
const generateSeo = asyncHandler(async (req, res) => {
  const { name, shortDescription, type, brand } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const prompt = `You are an SEO expert for DrinksHarbour, a premium beverages e-commerce platform based in Abuja, Nigeria that delivers nationwide across Nigeria (Lagos, Abuja, Port Harcourt, etc.).

Generate SEO content for "${name}"${brand ? ` by ${brand}` : ''}${type ? `, a ${type}` : ''}.
${shortDescription ? `Product description: ${shortDescription}` : ''}

Requirements:
- metaTitle: max 45 characters — include product name and type; do NOT add "Nigeria" (wastes chars). We append " | DrinksHarbour" ourselves, so keep it under 45.
- seoH1: max 70 characters — the on-page headline. Include the product name AND its beverage type (e.g. "Glenfiddich 40 Year Old Single Malt Scotch"). This is the visible H1, so keep it natural, no "Buy"/price/"Nigeria" filler.
- metaDescription: max 160 characters — must end with a local hook, e.g. "Available for delivery across Nigeria on DrinksHarbour." or "Order online — delivered to Lagos, Abuja & across Nigeria."
- metaKeywords: 10-12 relevant keywords (lowercase, no duplicates) — MUST include at least 3 Nigeria/city-specific purchase-intent terms such as:
  • "{type} Nigeria", "buy {type} Nigeria", "buy {type} Lagos", "buy {type} Abuja"
  • "{brand} Nigeria", "{brand} price Nigeria"
  • "online liquor store Nigeria", "alcohol delivery Nigeria"
  • For Scotch/Scottish origin: "scotch whisky Nigeria", "import scotch Nigeria"
  • For wine: "buy wine Nigeria", "wine delivery Lagos"
  • For beer: "buy beer Nigeria", "beer delivery Nigeria"
${grounding}${COPY_GUARDRAILS}
Return as JSON:
{
  "metaTitle": "SEO title (max 45 chars)",
  "seoH1": "on-page headline with product name + type (max 70 chars)",
  "metaDescription": "SEO description (max 160 chars, ends with Nigeria delivery hook)",
  "metaKeywords": ["keyword1", "keyword2", ..., "buy {type} nigeria", "buy {type} lagos"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = parseJSONResponse(text);

    // Accept either "keywords" or "metaKeywords" from the model, normalize to metaKeywords.
    data.metaKeywords = normalizeKeywords(data.metaKeywords || data.keywords, 12);
    delete data.keywords;
    if (data.metaTitle) data.metaTitle = normalizeCopy(data.metaTitle).slice(0, 45);
    if (data.seoH1) data.seoH1 = normalizeCopy(data.seoH1).slice(0, 70);
    if (data.metaDescription) data.metaDescription = normalizeCopy(data.metaDescription).slice(0, 160);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Gemini API error:', error.message);

    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
      return res.json({
        success: true,
        data: {
          metaTitle: `${name}`.slice(0, 45),
          seoH1: `${name}${type ? ` ${type}` : ''}`.slice(0, 70),
          metaDescription: `Discover ${name}${brand ? ` by ${brand}` : ''}, a premium ${type || 'beverage'} with exceptional quality. Order online — delivered to Lagos, Abuja & across Nigeria.`.slice(0, 160),
          metaKeywords: [name.toLowerCase(), type?.toLowerCase() || 'beverage', brand?.toLowerCase() || 'premium', `buy ${(type || 'beverage').toLowerCase()} nigeria`, `${(type || 'beverage').toLowerCase()} nigeria`, 'online liquor store nigeria', 'alcohol delivery nigeria', 'drinks delivery nigeria']
        },
        note: 'Using demo data - API quota exceeded'
      });
    }

    res.status(500);
    throw new Error(`Failed to generate SEO content: ${error.message}`);
  }
});

/**
 * Generate product tags
 * POST /api/gemini/generate-tags
 */
const generateTags = asyncHandler(async (req, res) => {
  const { name, type, category } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const prompt = `Generate 5-10 relevant product tags for "${name}"${type ? `, a ${type}` : ''}${category ? ` in the ${category} category` : ''}.

Tags should be:
- Short (1-3 words)
- Relevant to the product
- Useful for search and filtering
- Include brand, type, style, occasion, and flavor descriptors where applicable
- Lowercase, with no duplicates and no generic filler ("drink", "buy", "online")
${grounding}${COPY_GUARDRAILS}
Return as JSON:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = parseJSONResponse(text);

    // Ensure tags is a clean, deduped array
    data.tags = normalizeKeywords(data.tags, 10);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Gemini API error:', error.message);

    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
      const baseTags = [name.toLowerCase()];
      if (type) baseTags.push(type.toLowerCase());
      if (category) baseTags.push(category.toLowerCase());
      baseTags.push('premium', 'quality', 'beverage');

      return res.json({
        success: true,
        data: {
          tags: baseTags.slice(0, 10)
        },
        note: 'Using demo data - API quota exceeded'
      });
    }

    res.status(500);
    throw new Error(`Failed to generate tags: ${error.message}`);
  }
});

/**
 * Generate pricing suggestions
 * POST /api/gemini/generate-pricing
 */
const generatePricing = asyncHandler(async (req, res) => {
  const { name, type, abv, volumeMl, originCountry } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const prompt = `Provide pricing suggestions for "${name}"${type ? `, a ${type}` : ''}${abv ? ` at ${abv}% ABV` : ''}${volumeMl ? ` in ${volumeMl}ml` : ''}${originCountry ? ` from ${originCountry}` : ''}.

Consider:
- Typical market prices for this type of product
- Premium vs budget positioning
- Regional pricing differences
- Suggested retail price, wholesale price, and profit margins

Return as JSON with pricing in multiple currencies:
{
  "suggestedRetailPrice": {
    "USD": number,
    "EUR": number,
    "GBP": number,
    "NGN": number
  },
  "wholesalePrice": {
    "USD": number,
    "EUR": number,
    "GBP": number,
    "NGN": number
  },
  "costPrice": {
    "USD": number,
    "EUR": number,
    "GBP": number,
    "NGN": number
  },
  "profitMargin": number (percentage),
  "pricingTier": "budget" | "mid-range" | "premium" | "luxury",
  "reasoning": "brief explanation of the pricing strategy"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = parseJSONResponse(text);

    // Validate the response structure
    if (!data.suggestedRetailPrice) {
      data.suggestedRetailPrice = { USD: 0, EUR: 0, GBP: 0, NGN: 0 };
    }
    if (!data.wholesalePrice) {
      data.wholesalePrice = { USD: 0, EUR: 0, GBP: 0, NGN: 0 };
    }
    if (!data.costPrice) {
      data.costPrice = { USD: 0, EUR: 0, GBP: 0, NGN: 0 };
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Gemini API error:', error.message);

    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
      // Return demo pricing data
      const basePrice = type?.includes('whiskey') || type?.includes('scotch') ? 50 : type?.includes('wine') ? 25 : 30;

      return res.json({
        success: true,
        data: {
          suggestedRetailPrice: {
            USD: basePrice,
            EUR: basePrice * 0.92,
            GBP: basePrice * 0.79,
            NGN: basePrice * 1500
          },
          wholesalePrice: {
            USD: basePrice * 0.6,
            EUR: basePrice * 0.55,
            GBP: basePrice * 0.47,
            NGN: basePrice * 900
          },
          costPrice: {
            USD: basePrice * 0.4,
            EUR: basePrice * 0.37,
            GBP: basePrice * 0.32,
            NGN: basePrice * 600
          },
          profitMargin: 40,
          pricingTier: 'mid-range',
          reasoning: 'Based on typical market pricing for this product type'
        },
        note: 'Using demo data - API quota exceeded'
      });
    }

    res.status(500);
    throw new Error(`Failed to generate pricing: ${error.message}`);
  }
});

/**
 * Generate short description
 * POST /api/gemini/short-description
 */
const generateShortDescription = asyncHandler(async (req, res) => {
  const { name, type, brand } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Write a compelling short description (max 280 characters) for "${name}"${type ? `, a ${type}` : ''}${brand ? ` by ${brand}` : ''}. Focus on key selling points and quality.
${grounding}${COPY_GUARDRAILS}
Return ONLY the JSON: {"shortDescription": "..."}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    if (data.shortDescription) data.shortDescription = normalizeCopy(data.shortDescription);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { shortDescription: '' }, error: true, note: 'AI generation failed — nothing was written rather than guessing.' });
  }
});

/**
 * Generate full description
 * POST /api/gemini/full-description
 */
const generateFullDescription = asyncHandler(async (req, res) => {
  const { name, type, brand, originCountry } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Write a detailed 3-5 paragraph product description for "${name}"${type ? `, a ${type}` : ''}${brand ? ` by ${brand}` : ''}${originCountry ? ` from ${originCountry}` : ''}. Include history, production process, and unique characteristics.
${grounding}${COPY_GUARDRAILS}
Return ONLY JSON: {"description": "..."}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (data.description) data.description = normalizeCopy(data.description);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { description: '' }, error: true, note: 'AI generation failed — nothing was written rather than guessing.' });
  }
});

/**
 * Generate flavor profile
 * POST /api/gemini/flavor-profile
 */
const generateFlavorProfile = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `${grounding}Identify 5-8 flavor profile descriptors for "${name}"${type ? `, a ${type}` : ''}. Use standard tasting terms. Available: ${PRODUCT_ENUMS.flavorProfile.join(', ')}. Return ONLY JSON: {"flavorProfile": ["descriptor1", "descriptor2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { flavorProfile: [] }, error: true, note: 'AI generation failed — no flavour descriptors were invented.' });
  }
});

/**
 * Generate food pairings
 * POST /api/gemini/food-pairings
 */
const generateFoodPairings = asyncHandler(async (req, res) => {
  const { name, type, flavorProfile } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `${grounding}Suggest 4-6 ideal food pairings for "${name}"${type ? `, a ${type}` : ''}${flavorProfile ? ` with flavors: ${flavorProfile.join(', ')}` : ''}. Return ONLY JSON: {"foodPairings": ["pairing1", "pairing2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { foodPairings: [] }, error: true, note: 'AI generation failed — no pairings were invented.' });
  }
});

/**
 * Generate tasting notes - nose
 * POST /api/gemini/tasting-nose
 */
const generateTastingNose = asyncHandler(async (req, res) => {
  const { name, type, flavorProfile } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `${grounding}Describe the nose/aroma of "${name}"${type ? `, a ${type}` : ''}. Provide 3-5 aroma descriptors. Return ONLY JSON: {"nose": ["aroma1", "aroma2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { nose: [] }, error: true, note: 'AI generation failed — no tasting notes were invented.' });
  }
});

/**
 * Generate tasting notes - palate
 * POST /api/gemini/tasting-palate
 */
const generateTastingPalate = asyncHandler(async (req, res) => {
  const { name, type, flavorProfile } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `${grounding}Describe the palate/taste of "${name}"${type ? `, a ${type}` : ''}. Provide 3-5 taste descriptors. Return ONLY JSON: {"palate": ["taste1", "taste2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { palate: [] }, error: true, note: 'AI generation failed — no tasting notes were invented.' });
  }
});

/**
 * Generate tasting notes - finish
 * POST /api/gemini/tasting-finish
 */
const generateTastingFinish = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `${grounding}Describe the finish/aftertaste of "${name}"${type ? `, a ${type}` : ''}. Provide 3-5 finish descriptors. Return ONLY JSON: {"finish": ["finish1", "finish2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { finish: [] }, error: true, note: 'AI generation failed — no tasting notes were invented.' });
  }
});

/**
 * Generate tasting notes - color
 * POST /api/gemini/tasting-color
 */
const generateTastingColor = asyncHandler(async (req, res) => {
  const { name, type, age } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `${grounding}Describe the color and appearance of "${name}"${type ? `, a ${type}` : ''}${age ? ` aged ${age} years` : ''}. Be specific about hue, clarity, and intensity. Return ONLY JSON: {"color": "description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { color: '' }, error: true, note: 'AI generation failed — no appearance was invented.' });
  }
});

/**
 * Generate origin country
 * POST /api/gemini/origin-country
 */
const generateOriginCountry = factHandler('originCountry', 'originCountry', '');

/**
 * Generate region
 * POST /api/gemini/region
 */
const generateRegion = factHandler('region', 'region', '');

/**
 * Generate appellation
 * POST /api/gemini/appellation
 */
const generateAppellation = factHandler('appellation', 'appellation', '');

/**
 * Generate producer name
 * POST /api/gemini/producer
 */
const generateProducer = factHandler('producer', 'producer', '');

/**
 * Generate vintage year
 * POST /api/gemini/vintage
 */
const generateVintage = factHandler('vintage', 'vintage', null);

/**
 * Generate age statement
 * POST /api/gemini/age-statement
 */
const generateAgeStatement = factHandler('ageStatement', 'ageStatement', '');

/**
 * Generate production method
 * POST /api/gemini/production-method
 */
const generateProductionMethod = factHandler('productionMethod', 'productionMethod', null, PRODUCT_ENUMS.productionMethod);

/**
 * Generate cask type
 * POST /api/gemini/cask-type
 */
const generateCaskType = factHandler('caskType', 'caskType', '');

/**
 * Generate serving temperature
 * POST /api/gemini/serving-temperature
 */
const generateServingTemperature = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `What is the ideal serving temperature for "${name}"${type ? ` (${type})` : ''}? Examples: "Room temperature", "Chilled", "On the rocks", "18-20°C", or specific temperature. Return ONLY JSON: {"temperature": "description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { temperature: '' }, error: true, note: 'AI generation failed.' });
  }
});

/**
 * Generate glassware
 * POST /api/gemini/glassware
 */
const generateGlassware = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `What type of glassware is best for serving "${name}"${type ? ` (${type})` : ''}? Examples: Snifter, Tumbler, Wine glass, Flute, Highball, Rocks glass. Return ONLY JSON: {"glassware": "glass type"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { glassware: '' }, error: true, note: 'AI generation failed.' });
  }
});

/**
 * Generate garnish suggestions
 * POST /api/gemini/garnish
 */
const generateGarnish = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Suggest 2-4 garnish options for "${name}"${type ? ` (${type})` : ''}. Examples: Orange peel, Lemon twist, Cherry, Mint, Cinnamon stick. Return ONLY JSON: {"garnish": ["garnish1", "garnish2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { garnish: [] }, error: true, note: 'AI generation failed.' });
  }
});

/**
 * Generate mixers
 * POST /api/gemini/mixers
 */
const generateMixers = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Suggest 2-4 ideal mixers for "${name}"${type ? ` (${type})` : ''}. Examples: Soda water, Ginger ale, Tonic, Cola. Return ONLY JSON: {"mixers": ["mixer1", "mixer2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { mixers: [] }, error: true, note: 'AI generation failed.' });
  }
});

/**
 * Generate allergens
 * POST /api/gemini/allergens
 */
const generateAllergens = factHandler('allergens', 'allergens', [], PRODUCT_ENUMS.allergens);

/**
 * Generate ingredients list
 * POST /api/gemini/ingredients
 */
const generateIngredients = factHandler('ingredients', 'ingredients', []);

/**
 * Generate meta title
 * POST /api/gemini/meta-title
 */
const generateMetaTitle = asyncHandler(async (req, res) => {
  const { name, brand, type, subType, originCountry, region } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const context = [
      `Product name: "${name}"`,
      brand ? `Brand: ${brand}` : null,
      type ? `Type: ${type}` : null,
      subType ? `Sub-type: ${subType}` : null,
      originCountry ? `Origin: ${originCountry}` : null,
      region ? `Region: ${region}` : null,
    ].filter(Boolean).join(', ');

    const prompt = `${grounding}You are an SEO expert for DrinksHarbour, a premium beverages e-commerce platform based in Nigeria (Abuja, Lagos, nationwide delivery).

Create a meta title for this product:
${context}

STRICT REQUIREMENTS:
- Length: MUST be between 40-60 characters (count carefully, this is critical)
- Must include the product name "${name}"
${brand ? `- Must include the brand name "${brand}"` : '- Include a quality descriptor (Premium, Authentic, etc.)'}
- Should include the product type or key attribute
- Use a separator like " | " or " - " between product and brand/category
- Make it compelling for click-through rate in the Nigerian market
- Do NOT add "Nigeria" to the title (wastes characters; use description/keywords for geo)
- Do not fabricate awards, ages, or origin claims not given in the context

GOOD EXAMPLES (count chars):
- "Glenfiddich 12 Year Single Malt Scotch | 700ml" = 47 chars ✓
- "Hennessy VS Cognac - Premium French Brandy" = 43 chars ✓
- "Corona Extra Lager Beer | DrinksHarbour" = 40 chars ✓

Return ONLY valid JSON: {"metaTitle": "your title here"}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    if (data.metaTitle) data.metaTitle = normalizeCopy(data.metaTitle);

    // Ensure it's within bounds; trim if over 60
    if (data.metaTitle && data.metaTitle.length > 60) {
      data.metaTitle = data.metaTitle.substring(0, 57) + '...';
    }
    // If too short, append brand or type
    if (data.metaTitle && data.metaTitle.length < 30) {
      const suffix = brand ? ` | ${brand}` : type ? ` | ${type}` : ' | DrinksHarbour';
      data.metaTitle = (data.metaTitle + suffix).substring(0, 60);
    }

    res.json({ success: true, data });
  } catch (error) {
    const fallback = brand
      ? `${name} by ${brand} - Premium ${type || 'Beverage'}`.substring(0, 60)
      : `${name} - Premium ${type || 'Beverage'} | DrinksHarbour`.substring(0, 60);
    res.json({ success: true, data: { metaTitle: fallback }, note: 'Demo data' });
  }
});

/**
 * Generate meta description
 * POST /api/gemini/meta-description
 */
const generateMetaDescription = asyncHandler(async (req, res) => {
  const { name, brand, type, subType, originCountry, region, abv, shortDescription } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      }
    });

    const context = [
      `Product: "${name}"`,
      brand ? `Brand: ${brand}` : null,
      type ? `Type: ${type}` : null,
      subType ? `Sub-type: ${subType}` : null,
      originCountry ? `Origin: ${originCountry}` : null,
      region ? `Region: ${region}` : null,
      abv ? `ABV: ${abv}%` : null,
      shortDescription ? `Description: ${shortDescription}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `${grounding}You are an SEO copywriter for a premium beverages e-commerce platform (DrinksHarbour).

Write a meta description for this product:
${context}

STRICT REQUIREMENTS:
- Length: MUST be between 130-155 characters (count carefully — this is critical for SEO)
- Must mention the product name "${name}" naturally
- Must include a benefit or quality descriptor (smooth, award-winning, premium, authentic, etc.)
- Must end with a call-to-action (e.g. "Order online.", "Shop now.", "Available at DrinksHarbour.")
- Write in second-person or descriptive style — no first-person "I/we"
- Natural, compelling, not keyword-stuffed
- Do not fabricate awards, ages, or claims not supported by the context

GOOD EXAMPLES (count chars):
- "Discover Glenfiddich 12 Year Old, a smooth single malt Scotch with notes of pear and oak. A classic choice for whisky lovers. Order online." = 139 chars ✓
- "Hennessy VS is a rich, fruity Cognac crafted in the heart of France. Perfect for sipping or mixing. Shop premium spirits at DrinksHarbour." = 140 chars ✓

Return ONLY valid JSON: {"metaDescription": "your description here"}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    if (data.metaDescription) data.metaDescription = normalizeCopy(data.metaDescription);

    // Trim if over 160
    if (data.metaDescription && data.metaDescription.length > 160) {
      data.metaDescription = data.metaDescription.substring(0, 157) + '...';
    }
    // Pad if too short (under 120) — append CTA
    if (data.metaDescription && data.metaDescription.length < 120) {
      const ctas = [' Order now at DrinksHarbour.', ' Shop online for fast delivery.', ' Available now at DrinksHarbour.'];
      const cta = ctas[Math.floor(Math.random() * ctas.length)];
      const padded = data.metaDescription.replace(/\.$/, '') + cta;
      data.metaDescription = padded.substring(0, 160);
    }

    res.json({ success: true, data });
  } catch (error) {
    const fallback = `Discover ${name}${brand ? ` by ${brand}` : ''}, a premium ${type || 'beverage'}${originCountry ? ` from ${originCountry}` : ''}. Shop online for fast delivery at DrinksHarbour.`.substring(0, 160);
    res.json({ success: true, data: { metaDescription: fallback }, note: 'Demo data' });
  }
});

/**
 * Generate keywords
 * POST /api/gemini/keywords
 */
const generateKeywords = asyncHandler(async (req, res) => {
  const { name, brand, type, subType, originCountry, region, abv, shortDescription, existingKeywords } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  // Reuse the research brief the auto-fill already paid for, so the copy is
  // written from sourced facts instead of recall. Never triggers a search.
  const grounding = formatFactsForPrompt(await briefFor(req, { cacheOnly: true }));

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      }
    });

    const context = [
      `Product: "${name}"`,
      brand ? `Brand: ${brand}` : null,
      type ? `Type: ${type}` : null,
      subType ? `Sub-type: ${subType}` : null,
      originCountry ? `Origin: ${originCountry}` : null,
      region ? `Region: ${region}` : null,
      abv ? `ABV: ${abv}%` : null,
      shortDescription ? `Description: ${shortDescription}` : null,
      existingKeywords?.length ? `Already has keywords: ${existingKeywords.join(', ')} — generate new ones that complement these` : null,
    ].filter(Boolean).join('\n');

    const prompt = `${grounding}You are an SEO specialist for a premium beverages e-commerce platform (DrinksHarbour).

Generate 8-12 highly relevant SEO keywords for this product:
${context}

Rules:
- Include: product name variants, brand, type, origin/country, style descriptors, purchase-intent terms (e.g. "buy X online"), occasion terms (gift, celebration), flavour/tasting descriptors if applicable
- Mix short-tail (1-2 words) and long-tail (3-5 words) keywords
- Use lowercase
- No duplicates, no generic filler like "best quality" alone
- Each keyword should be something a real customer would search
- Do not invent unverifiable claims (awards, medals, specific ABV/age) as keywords

Return ONLY valid JSON:
{"keywords": ["keyword1", "keyword2", "keyword3"]}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);

    // Lowercase, trim, dedupe and cap (keep up to 12 for keywords)
    data.keywords = normalizeKeywords(data.keywords, 12);

    res.json({ success: true, data });
  } catch (error) {
    // Fallback with sensible defaults using correct key
    const fallback = [
      name.toLowerCase(),
      brand?.toLowerCase(),
      type?.toLowerCase() || 'beverage',
      originCountry ? `${type || 'drink'} from ${originCountry}`.toLowerCase() : null,
      `buy ${name.toLowerCase()} online`,
      'premium spirits',
      'quality drinks',
    ].filter(Boolean);
    res.json({ success: true, data: { keywords: fallback }, note: 'Demo data' });
  }
});

/**
 * Generate dietary info
 * POST /api/gemini/dietary
 */
const generateDietary = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Determine dietary information for "${name}"${type ? ` (${type})` : ''}. Is it vegan, vegetarian, gluten-free, organic? Return ONLY JSON: {"isDietary": {"vegan": boolean, "vegetarian": boolean, "glutenFree": boolean, "organic": boolean}}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { isDietary: {} }, error: true, note: 'AI generation failed — dietary flags were not guessed.' });
  }
});

/**
 * Generate nutritional info
 * POST /api/gemini/nutritional-info
 */
const generateNutritionalInfo = factHandler('nutritionalInfo', 'nutritionalInfo', { calories: null, carbohydrates: null, sugar: null, protein: null, fat: null, sodium: null, caffeine: null });

/**
 * Generate volume and ABV
 * POST /api/gemini/volume-abv
 */
const generateVolumeAbv = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  const brief = await briefFor(req);
  const { abv, volumeMl } = brief.facts;
  const unverified = ['abv', 'volumeMl'].filter((f) => brief.facts[f] === undefined);

  res.json({
    success: true,
    data: {
      abv: abv ?? null,
      volumeMl: volumeMl ?? null,
      // Alcoholic status follows the sourced ABV; with no ABV we do not know.
      isAlcoholic: abv === undefined ? null : abv > 0,
      proof: abv === undefined ? null : parseFloat((abv * 2).toFixed(1)),
    },
    unverified,
    sources: brief.sources,
    ...(unverified.length
      ? { note: `No source confirmed ${unverified.join(' or ')} for "${name}" — left blank.` }
      : {}),
  });
});

/**
 * Generate standard sizes
 * POST /api/gemini/standard-sizes
 */
const generateStandardSizes = factHandler('standardSizes', 'standardSizes', [], PRODUCT_ENUMS.standardSizes);

/**
 * Generate slug
 * POST /api/gemini/slug
 */
const generateSlug = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  res.json({ success: true, data: { slug } });
});

/**
 * Generate brand description
 * POST /api/gemini/brand-description
 */
const generateBrandDescription = asyncHandler(async (req, res) => {
  const { name, primaryCategory, productName } = req.body;
  if (!name) { res.status(400); throw new Error('Brand name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Write a compelling brand description for "${name}"${productName ? `, known for products like "${productName}"` : primaryCategory ? ` in the ${primaryCategory} category` : ''}. Include brand history, reputation, signature characteristics, and what makes them unique. Return ONLY JSON: {"description": "2-3 paragraph brand description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { description: '' }, error: true, note: 'AI generation failed — nothing was written rather than guessing.' });
  }
});

/**
 * Generate brand country of origin
 * POST /api/gemini/brand-country
 */
const generateBrandCountry = asyncHandler(async (req, res) => {
  const { name, primaryCategory, productName } = req.body;
  if (!name) { res.status(400); throw new Error('Brand name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `Identify the country of origin for the brand "${name}"${productName ? `, the maker of "${productName}"` : primaryCategory ? ` (${primaryCategory})` : ''}. Consider regional specialties and typical origins for this type of product. Return ONLY JSON: {"countryOfOrigin": "Country name"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { countryOfOrigin: '' }, error: true, note: 'AI generation failed — country was left blank rather than guessed.' });
  }
});

/**
 * Generate brand founded year
 * POST /api/gemini/brand-founded
 */
const generateBrandFounded = asyncHandler(async (req, res) => {
  const { name, countryOfOrigin, productName } = req.body;
  if (!name) { res.status(400); throw new Error('Brand name is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `When was the brand "${name}"${productName ? `, producer of "${productName}"` : countryOfOrigin ? ` from ${countryOfOrigin}` : ''} founded? Research or infer based on typical establishment periods for this type of brand. Return the year as a number, or null if unknown. Return ONLY JSON: {"founded": year or null}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { founded: null }, error: true, note: 'AI generation failed — founding year was left blank rather than guessed.' });
  }
});

/**
 * Generate brand primary category
 * POST /api/gemini/brand-category
 */
const generateBrandCategory = asyncHandler(async (req, res) => {
  const { name, productName } = req.body;
  if (!name) { res.status(400); throw new Error('Brand name is required'); }

  const categories = ['spirits', 'beer', 'wine', 'non_alcoholic', 'other'];

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });
    const prompt = `What is the primary category for the brand "${name}"${productName ? `, which makes "${productName}"` : ''}? Consider the product type and typical offerings. Available: ${categories.join(', ')}. Return ONLY JSON: {"primaryCategory": "category"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);
    if (data.primaryCategory && !categories.includes(data.primaryCategory)) {
      data.primaryCategory = 'other';
    }
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { primaryCategory: 'spirits' }, note: 'Demo data' });
  }
});

/**
 * Generate complete origin info in one call (batch convenience endpoint)
 * POST /api/gemini/generate-origin
 */
const generateOrigin = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  const brief = await briefFor(req);
  const merged = applyBriefToProduct({}, brief, {
    enums: RESEARCH_ENUMS,
    preserve: req.body.brand ? ['brand'] : [],
  });
  const f = merged.data;

  res.json({
    success: true,
    data: {
      originCountry: f.originCountry,
      region: f.region,
      appellation: f.appellation,
      producer: f.producer,
      brand: req.body.brand || f.brand,
      vintage: f.vintage,
      age: f.age,
      ageStatement: f.ageStatement,
      distilleryName: f.distilleryName,
      breweryName: f.breweryName,
      wineryName: f.wineryName,
      productionMethod: f.productionMethod,
      caskType: f.caskType,
      finish: '',
    },
    unverified: merged.unverified,
    sources: brief.sources,
    ...(brief.found
      ? {}
      : { note: `No authoritative source was found for "${name}" — origin fields left blank.` }),
  });
});

/**
 * Generate category suggestion based on product name and type
 * POST /api/gemini/category-suggestion
 */
const generateCategorySuggestion = asyncHandler(async (req, res) => {
  const { name, type, availableCategories } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    // Fetch from DB if no categories passed in
    const { categories: dbCategories, subCategories: dbSubCategories } = await fetchCategories();
    const catList = availableCategories?.length
      ? availableCategories.join(', ')
      : dbCategories.map(c => c.name).join(', ');
    const subCatList = dbSubCategories.map(s => s.name).join(', ');

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    const prompt = `You are a beverage product cataloguer. Given the product "${name}"${type ? ` (type: ${type})` : ''}, choose the most appropriate category and subcategory from the lists below.

AVAILABLE CATEGORIES: ${catList}
AVAILABLE SUBCATEGORIES: ${subCatList}

Return ONLY JSON: {"category": "exact category name from the list", "subCategory": "exact subcategory name from the list or empty string", "confidence": 0.95}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);

    // Try to resolve to IDs
    const matchedCat = dbCategories.find(c =>
      c.name.toLowerCase() === (data.category || '').toLowerCase() ||
      c.name.toLowerCase().includes((data.category || '').toLowerCase())
    );
    const matchedSub = dbSubCategories.find(s =>
      s.name.toLowerCase() === (data.subCategory || '').toLowerCase() ||
      s.name.toLowerCase().includes((data.subCategory || '').toLowerCase())
    );

    res.json({
      success: true,
      data: {
        category: data.category || '',
        categoryId: matchedCat?.id || null,
        subCategory: data.subCategory || '',
        subCategoryId: matchedSub?.id || null,
        confidence: data.confidence || 0.8,
      },
    });
  } catch (error) {
    res.json({ success: true, data: { category: '', categoryId: null, subCategory: '', subCategoryId: null, confidence: 0 }, note: 'Demo data' });
  }
});

/**
 * Generate subcategory suggestion
 * POST /api/gemini/subcategory-suggestion
 */
const generateSubCategorySuggestion = asyncHandler(async (req, res) => {
  const { name, type, category, availableSubCategories } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const { categories: dbCategories, subCategories: dbSubCategories } = await fetchCategories();
    const subCatList = availableSubCategories?.length
      ? availableSubCategories.join(', ')
      : dbSubCategories.map(s => s.name).join(', ');

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    const prompt = `You are a beverage product cataloguer. Given the product "${name}"${type ? ` (type: ${type})` : ''}${category ? ` in the "${category}" category` : ''}, choose the most appropriate subcategory from the list below.

AVAILABLE SUBCATEGORIES: ${subCatList}

Return ONLY JSON: {"subCategory": "exact subcategory name from the list or empty string", "confidence": 0.9}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);

    const matchedSub = dbSubCategories.find(s =>
      s.name.toLowerCase() === (data.subCategory || '').toLowerCase() ||
      s.name.toLowerCase().includes((data.subCategory || '').toLowerCase())
    );

    res.json({
      success: true,
      data: {
        category: category || '',
        subCategory: data.subCategory || '',
        subCategoryId: matchedSub?.id || null,
        confidence: data.confidence || 0.8,
      },
    });
  } catch (error) {
    res.json({ success: true, data: { category: category || '', subCategory: '', subCategoryId: null, confidence: 0 }, note: 'Demo data' });
  }
});

/**
 * Get beverage recommendations
 * POST /api/gemini/recommendations
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const { query, category } = req.body;
  if (!query) { res.status(400); throw new Error('Query is required'); }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { temperature: 0.5, responseMimeType: 'application/json' },
    });
    const prompt = `Recommend 5 beverages matching this request: "${query}"${category ? ` in the ${category} category` : ''}. For each, provide name, type, reason, and approximate price range.
Return ONLY JSON: {"recommendations": [{"name": "...", "type": "...", "reason": "...", "priceRange": "..."}]}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = parseJSONResponse(text);

    res.json({ success: true, data: Array.isArray(data.recommendations) ? data.recommendations : [] });
  } catch (error) {
    res.json({ success: true, data: [], note: 'Demo data' });
  }
});

/**
 * Generate complete product details using the product's own data + linked sub-products as context.
 * Runs on Claude Haiku, like every other generation handler here.
 * POST /api/gemini/generate-from-subproduct
 */
const generateProductFromSubProducts = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error('productId is required');
  }

  // ── Load product ──────────────────────────────────────────────────────────
  const product = await Product.findById(productId)
    .populate('brand', 'name')
    .populate('category', 'name')
    .lean();

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // ── Load sub-products linked to this product ──────────────────────────────
  const subProducts = await SubProduct.find({ product: productId })
    .populate('tenant', 'name')
    .select('sku baseSellingPrice currency shortDescriptionOverride descriptionOverride customKeywords sizes status tenant')
    .lean();

  // ── Build sub-product context (optional — the product's own data is enough) ─
  const subProductContext = subProducts.map((sp, i) => {
    const lines = [`Sub-product ${i + 1}:`];
    if (sp.tenant?.name) lines.push(`  Tenant: ${sp.tenant.name}`);
    if (sp.sku) lines.push(`  SKU: ${sp.sku}`);
    if (sp.baseSellingPrice) lines.push(`  Price: ${sp.currency || 'NGN'} ${sp.baseSellingPrice}`);
    if (sp.shortDescriptionOverride) lines.push(`  Short desc: ${sp.shortDescriptionOverride}`);
    if (sp.descriptionOverride) lines.push(`  Description: ${sp.descriptionOverride}`);
    if (sp.customKeywords?.length) lines.push(`  Keywords: ${sp.customKeywords.join(', ')}`);
    if (sp.sizes?.length) lines.push(`  Sizes: ${sp.sizes.length} variants`);
    return lines.join('\n');
  }).join('\n\n');

  // ── Fetch DB categories ───────────────────────────────────────────────────
  const { categories, subCategories } = await fetchCategories();

  // ── Build prompt ──────────────────────────────────────────────────────────
  const catList = categories.map(c => c.name).join(', ');
  const subCatList = subCategories.map(s => s.name).join(', ');
  const existingBits = [
    product.subType ? `subType=${product.subType}` : '',
    product.region ? `region=${product.region}` : '',
    product.producer ? `producer=${product.producer}` : '',
    product.vintage ? `vintage=${product.vintage}` : '',
    product.ageStatement ? `age=${product.ageStatement}` : '',
    product.shortDescription ? `shortDesc="${String(product.shortDescription).substring(0, 200)}"` : '',
  ].filter(Boolean).join(', ');

  const prompt = `You are a beverage expert. Generate COMPLETE product details for "${product.name}" as compact JSON. Fill EVERY field you can determine or reasonably infer from the product name and context; use null/""/[] ONLY when a value truly cannot be known. Return ONLY valid JSON, no markdown.

PRODUCT INFO: type=${product.type || '?'}, brand=${product.brand?.name || '?'}, category=${product.category?.name || '?'}, origin=${product.originCountry || '?'}, abv=${product.abv || '?'}%, volume=${product.volumeMl || '?'}ml${existingBits ? `, ${existingBits}` : ''}
CONTEXT: ${subProductContext ? subProductContext.substring(0, 500) : 'No tenant listings yet — rely on the product name and your beverage knowledge.'}

CATEGORIES: ${catList}
SUBCATEGORIES: ${subCatList}
TYPES: ${PRODUCT_ENUMS.type.slice(0, 25).join(', ')}
SIZES: ${PRODUCT_ENUMS.standardSizes.slice(0, 12).join(', ')}
FLAVORS: ${PRODUCT_ENUMS.flavorProfile.slice(0, 20).join(', ')} (pick only from this list)
METHODS: ${PRODUCT_ENUMS.productionMethod.slice(0, 15).join(', ')} (pick only from this list)
STYLES: ${GENERATED_STYLES.join(', ')} (pick the single closest "style" value, or "" if none clearly fit)

FIELD GUIDANCE:
- shortDescription: one punchy retail sentence, max 160 chars. description: 2-3 paragraphs separated by \\n\\n.
- tastingNotes: 3-5 descriptors per array where the drink type warrants it; appearance/color as short phrases.
- servingSuggestions: temperature like "Chilled, 6-8°C", real glassware, sensible garnish/mixers.
- metaTitle max 60 chars, metaDescription max 160 chars, keywords: 5-8 lowercase search phrases.
- isDietary: most spirits/wines are vegan+glutenFree unless known otherwise; be sensible, not fabricated.

Return this JSON (fill all fields accurately):
{"name":"${product.name}","slug":"","type":"","subType":"","style":"","categoryName":"","subCategoryName":"","isAlcoholic":true,"abv":0,"proof":0,"volumeMl":750,"standardSizes":[],"servingSize":"","servingsPerContainer":0,"originCountry":"","region":"","appellation":null,"producer":"","brand":"","vintage":null,"age":null,"ageStatement":null,"distilleryName":null,"breweryName":null,"wineryName":null,"productionMethod":null,"caskType":null,"finish":null,"shortDescription":"","description":"","tastingNotes":{"nose":[],"aroma":[],"palate":[],"taste":[],"finish":[],"mouthfeel":[],"appearance":"","color":""},"flavorProfile":[],"foodPairings":[],"servingSuggestions":{"temperature":"","glassware":"","garnish":[],"mixers":[]},"isDietary":{"vegan":false,"vegetarian":false,"glutenFree":false,"dairyFree":false,"organic":false,"kosher":false,"halal":false,"sugarFree":false,"lowCalorie":false,"lowCarb":false},"allergens":[],"ingredients":[],"nutritionalInfo":{"calories":null,"carbohydrates":null,"sugar":null,"protein":null,"fat":null,"sodium":null,"caffeine":null},"metaTitle":"","metaDescription":"","keywords":[]}`;

  // ── Call Claude Haiku ─────────────────────────────────────────────────────
  let productData;
  try {
    const model = genAI.getGenerativeModel({
      model: HAIKU_MODEL,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
    });
    const result = await model.generateContent(prompt);
    productData = parseJSONResponse(result?.response?.text() || '', null);
    if (!productData) throw new Error('Claude returned unparseable JSON');
  } catch (claudeErr) {
    console.error('Claude Haiku call failed:', claudeErr.message);
    res.status(500);
    throw new Error(`Failed to generate product details: ${claudeErr.message}`);
  }

  if (!productData || typeof productData !== 'object') {
    res.status(500);
    throw new Error('AI returned invalid data. Please try again.');
  }

  // ── Category matching ─────────────────────────────────────────────────────
  const matchedCategory = categories.find(c =>
    c.name.toLowerCase() === productData.categoryName?.toLowerCase() ||
    c.name.toLowerCase().includes(productData.categoryName?.toLowerCase() || '') ||
    (productData.categoryName?.toLowerCase() || '').includes(c.name.toLowerCase())
  );

  let matchedSubCategory = null;
  if (matchedCategory) {
    matchedSubCategory = subCategories.find(s =>
      s.parent === matchedCategory.id &&
      (s.name.toLowerCase() === productData.subCategoryName?.toLowerCase() ||
        s.name.toLowerCase().includes(productData.subCategoryName?.toLowerCase() || ''))
    );
  }
  if (!matchedSubCategory) {
    matchedSubCategory = subCategories.find(s =>
      s.name.toLowerCase() === productData.subCategoryName?.toLowerCase() ||
      s.name.toLowerCase().includes(productData.subCategoryName?.toLowerCase() || '')
    );
  }

  productData.category = matchedCategory?.id || product.category?._id?.toString() || null;
  productData.subCategory = matchedSubCategory?.id || null;
  delete productData.categoryName;
  delete productData.subCategoryName;

  // ── Brand matching ────────────────────────────────────────────────────────
  // If the product already has a brand, keep it; otherwise try to match by name
  const existingBrandId = product.brand?._id?.toString() || null;
  if (existingBrandId) {
    productData.brand = existingBrandId;
  } else if (productData.brand && typeof productData.brand === 'string') {
    const brandNameFromAI = productData.brand;
    const allBrands = await Brand.find({ status: 'active' }).select('name _id').lean();
    const normalised = (s) => s.toLowerCase().trim();
    const matchedBrand =
      allBrands.find(b => normalised(b.name) === normalised(brandNameFromAI)) ||
      allBrands.find(b => normalised(b.name).includes(normalised(brandNameFromAI)) ||
                          normalised(brandNameFromAI).includes(normalised(b.name)));
    productData.brand = matchedBrand?._id?.toString() || null;
  } else {
    productData.brand = null;
  }

  productData = sanitizeProductData(productData);

  if (productData.abv > 0 && !productData.isAlcoholic) productData.isAlcoholic = true;
  if (!productData.proof && productData.abv && productData.isAlcoholic) {
    productData.proof = parseFloat((productData.abv * 2).toFixed(1));
  }

  res.json({
    success: true,
    data: productData,
    metadata: {
      productName: product.name,
      subProductCount: subProducts.length,
      model: HAIKU_MODEL,
      matchedCategory: matchedCategory?.name || null,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * Generate sub-product tenant content using parent product as context
 * POST /api/gemini/generate-subproduct-content
 */
const generateSubProductContent = asyncHandler(async (req, res) => {
  const { productId, subProductId, inlineContext } = req.body;

  // Must have either a productId or inline context fields to work with
  if (!productId && !inlineContext?.name) {
    res.status(400);
    throw new Error('Either productId or inlineContext.name is required');
  }

  // Build context lines — from DB product or from inline form data
  let contextLines = [];
  let resolvedProductName = inlineContext?.name || productId || 'unknown';

  if (productId) {
    const product = await Product.findById(productId)
      .populate('brand', 'name description')
      .populate('category', 'name')
      .lean();

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    resolvedProductName = product.name;
    const tn = product.tastingNotes || {};
    const tastingBits = [
      tn.nose?.length ? `nose: ${tn.nose.join(', ')}` : '',
      tn.palate?.length ? `palate: ${tn.palate.join(', ')}` : '',
      tn.finish?.length ? `finish: ${tn.finish.join(', ')}` : '',
      tn.color ? `color: ${tn.color}` : '',
    ].filter(Boolean).join('; ');

    contextLines = [
      `Product Name: "${product.name}"`,
      product.type ? `Type: ${product.type}` : '',
      product.brand?.name ? `Brand: ${product.brand.name}` : '',
      product.brand?.description ? `Brand Story: ${String(product.brand.description).substring(0, 300)}` : '',
      product.category?.name ? `Category: ${product.category.name}` : '',
      product.originCountry ? `Origin: ${product.originCountry}` : '',
      product.region ? `Region: ${product.region}` : '',
      product.appellation ? `Appellation: ${product.appellation}` : '',
      product.producer ? `Producer: ${product.producer}` : '',
      product.vintage ? `Vintage: ${product.vintage}` : '',
      product.ageStatement ? `Age Statement: ${product.ageStatement}` : '',
      product.caskType ? `Cask Type: ${product.caskType}` : '',
      product.abv ? `ABV: ${product.abv}%` : '',
      product.volumeMl ? `Volume: ${product.volumeMl}ml` : '',
      product.shortDescription ? `Short Description: ${product.shortDescription}` : '',
      product.description ? `Description: ${product.description.substring(0, 500)}` : '',
      product.flavorProfile?.length ? `Flavor Profile: ${product.flavorProfile.join(', ')}` : '',
      tastingBits ? `Tasting Notes: ${tastingBits}` : '',
      product.foodPairings?.length ? `Food Pairings: ${product.foodPairings.join(', ')}` : '',
      product.tags?.length ? `Tags: ${product.tags.join(', ')}` : '',
    ];
  } else {
    // Use form data passed directly from the client
    const c = inlineContext;
    contextLines = [
      c.name ? `Product Name: "${c.name}"` : '',
      c.type ? `Type: ${c.type}` : '',
      c.brand ? `Brand: ${c.brand}` : '',
      c.category ? `Category: ${c.category}` : '',
      c.originCountry ? `Origin: ${c.originCountry}` : '',
      c.abv ? `ABV: ${c.abv}%` : '',
      c.volumeMl ? `Volume: ${c.volumeMl}ml` : '',
      c.shortDescription ? `Short Description: ${c.shortDescription}` : '',
      c.description ? `Description: ${String(c.description).substring(0, 500)}` : '',
      c.flavorProfile?.length ? `Flavor Profile: ${c.flavorProfile.join(', ')}` : '',
      c.tags?.length ? `Tags: ${c.tags.join(', ')}` : '',
    ];
  }

  const productContext = contextLines.filter(Boolean).join('\n');

  // Optionally load the specific sub-product for additional context
  let subProduct = null;
  if (subProductId) {
    subProduct = await SubProduct.findById(subProductId).select('sku baseSellingPrice currency sizes').lean();
  }

  let subProductContext = '';
  if (subProduct) {
    const sizeList = Array.isArray(subProduct.sizes) && subProduct.sizes.length
      ? subProduct.sizes
          .map(s => [s.size || s.label, s.sellingPrice || s.price].filter(Boolean).join(' @ '))
          .filter(Boolean)
          .join(', ')
      : '';
    subProductContext = [
      '',
      'SUB-PRODUCT CONTEXT:',
      `SKU: ${subProduct.sku || 'N/A'}`,
      `Price: ${subProduct.currency || 'NGN'} ${subProduct.baseSellingPrice ?? 'N/A'}`,
      sizeList ? `Sizes: ${sizeList}` : '',
      '',
    ].filter(Boolean).join('\n');
  }

  const prompt = `You are a creative beverage copywriter and SEO specialist writing for a Nigerian online drinks retailer (prices in NGN). Generate compelling tenant-facing retail content for a sub-product listing, using ONLY the product context below.

PRODUCT CONTEXT:
${productContext}
${subProductContext}
RULES:
- Use ONLY facts present in the context. Do NOT invent ABV, awards, origin, age, or tasting notes that are not given.
- If a detail is missing, write around it — never fabricate or use placeholders like "N/A".
- Write in a warm, confident retail voice that helps a shopper decide to buy.

Produce:
1. shortDescriptionOverride — one punchy sentence, max 160 characters, leading with the strongest selling point.
2. descriptionOverride — 2-3 short paragraphs (~150-250 words) separated by \\n\\n, covering character/taste, what makes it special, and ideal occasions or pairings.
3. customKeywords — 5-8 specific, search-friendly keywords or short phrases (lowercase, no duplicates, no generic filler like "drink" or "buy online").
4. tenantNotes — 1-2 sentences of practical internal guidance for the retailer (who it suits, how to position or upsell it).

Return ONLY valid JSON in exactly this shape, with no markdown or commentary:
{
  "shortDescriptionOverride": "string",
  "descriptionOverride": "string with \\n\\n between paragraphs",
  "customKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "tenantNotes": "string"
}`;

  let generated;
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
    });
    const result = await model.generateContent(prompt);
    generated = parseJSONResponse(result?.response?.text() || '', null);
  } catch (claudeErr) {
    console.error('Claude Haiku call failed:', claudeErr.message);
    res.status(500);
    throw new Error(`Failed to generate sub-product content: ${claudeErr.message}`);
  }

  if (!generated || typeof generated !== 'object') {
    res.status(500);
    throw new Error('Failed to parse AI response');
  }

  // Normalize short description: collapse whitespace, cap length.
  generated.shortDescriptionOverride = String(generated.shortDescriptionOverride || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (generated.shortDescriptionOverride.length > 200) {
    generated.shortDescriptionOverride =
      generated.shortDescriptionOverride.substring(0, 197).trimEnd() + '...';
  }

  // Normalize long description: standardize paragraph breaks, trim.
  generated.descriptionOverride = String(generated.descriptionOverride || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  generated.tenantNotes = String(generated.tenantNotes || '').replace(/\s+/g, ' ').trim();

  // Keywords: lowercase, trim, dedupe case-insensitively, cap at 8.
  if (!Array.isArray(generated.customKeywords)) {
    generated.customKeywords = [];
  }
  const seenKeywords = new Set();
  generated.customKeywords = generated.customKeywords
    .map(k => String(k).trim().toLowerCase())
    .filter(k => {
      if (!k || seenKeywords.has(k)) return false;
      seenKeywords.add(k);
      return true;
    })
    .slice(0, 8);

  // Guard against an empty generation slipping through as a "success".
  if (!generated.descriptionOverride && !generated.shortDescriptionOverride) {
    res.status(502);
    throw new Error('AI returned empty content. Please try again.');
  }

  res.json({
    success: true,
    data: generated,
    metadata: {
      productId: productId || null,
      productName: resolvedProductName,
      generatedAt: new Date().toISOString(),
    },
  });
});

module.exports = {
  generateProductDetails,
  generateDescription,
  generateOrigin,
  generateBeverageInfo,
  generateSeo,
  generateTags,
  generatePricing,
  generateShortDescription,
  generateFullDescription,
  generateFlavorProfile,
  generateFoodPairings,
  generateTastingNose,
  generateTastingPalate,
  generateTastingFinish,
  generateTastingColor,
  generateOriginCountry,
  generateRegion,
  generateAppellation,
  generateProducer,
  generateVintage,
  generateAgeStatement,
  generateProductionMethod,
  generateCaskType,
  generateServingTemperature,
  generateGlassware,
  generateGarnish,
  generateMixers,
  generateAllergens,
  generateIngredients,
  generateMetaTitle,
  generateMetaDescription,
  generateKeywords,
  generateDietary,
  generateNutritionalInfo,
  generateVolumeAbv,
  generateStandardSizes,
  generateSlug,
  generateBrandDescription,
  generateBrandCountry,
  generateBrandFounded,
  generateBrandCategory,
  generateCategorySuggestion,
  generateSubCategorySuggestion,
  getRecommendations,
  generateProductFromSubProducts,
  generateSubProductContent,
};