// controllers/gemini.controller.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use Gemini 2.0 Flash - fast and reliable model
const MODEL_NAME = 'gemini-2.0-flash';

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
    
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.7,
        topK: 32,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    const prompt = `You are an expert sommelier, master distiller, and beverage industry specialist with 25+ years of experience. Analyze the beverage "${name}"${inputCategory ? ` in the "${inputCategory}" category` : ''} and generate comprehensive product information.

CRITICAL REQUIREMENTS:
1. Generate REALISTIC, ACCURATE information based on actual beverage knowledge
2. Use ONLY values from the provided enums - never invent new values
3. Be SPECIFIC and DETAILED in descriptions
4. Return ONLY valid JSON with NO markdown formatting
5. ALL fields must be present and properly formatted

PRODUCT CONTEXT ANALYSIS:
- Identify the exact beverage type, brand heritage, and production style
- Consider typical ABV ranges, bottle sizes, and pricing for this product category
- Research actual flavor profiles and production methods for similar products
- Account for regional characteristics and traditional production methods

DATABASE CATEGORIES (select by EXACT name match - these are the only valid category names):
${categories.length > 0 ? categories.map(c => `- "${c.name}" (ID: ${c.id}, Type: ${c.type})`).join('\n') : 'No categories available'}

DATABASE SUB-CATEGORIES (select by EXACT name match - must match both name AND belong to correct parent category):
${subCategories.length > 0 ? subCategories.map(s => `- "${s.name}" (ID: ${s.id}, Type: ${s.type}, Parent Category ID: ${s.parent})`).join('\n') : 'No sub-categories available'}

IMPORTANT: You MUST return EXACT category and subcategory names from the lists above. Do NOT invent new names. The categoryName and subCategoryName must match exactly one of the names listed above.

VALID PRODUCT TYPES (choose most specific):
${PRODUCT_ENUMS.type.slice(0, 50).join(', ')}

VALID STANDARD SIZES (select 2-4 appropriate ones):
${PRODUCT_ENUMS.standardSizes.slice(0, 30).join(', ')}

VALID FLAVOR PROFILES (select 4-8 accurate ones):
${PRODUCT_ENUMS.flavorProfile.slice(0, 40).join(', ')}

Generate comprehensive JSON with these EXACT fields:

IMPORTANT: categoryName and subCategoryName MUST be EXACT matches from the database lists above.

{
  "name": "${name}",
  "slug": "kebab-case-url-slug",
  "type": "EXACT_match_from_type_enum",
  "subType": "Specific style like 'Single Malt Scotch', 'Cabernet Sauvignon', 'Imperial Stout'",
  "categoryName": "EXACT_database_category_name_from_list_above",
  "subCategoryName": "EXACT_database_subcategory_name_from_list_above",
  
  "isAlcoholic": true_or_false_based_on_product,
  "abv": realistic_number_for_this_product_type,
  "proof": abv_times_2_or_null,
  "volumeMl": standard_bottle_size_for_category,
  "standardSizes": ["2-4_appropriate_sizes_from_enum"],
  "servingSize": "Realistic serving like '1.5 oz (44ml)' or '5 oz (148ml)'",
  "servingsPerContainer": calculated_number,
  
  "originCountry": "Actual_country_for_this_brand_or_style",
  "region": "Specific_region_like_Speyside_or_Napa_Valley",
  "appellation": "Protected_designation_if_applicable_or_null",
  "producer": "Actual_or_realistic_distillery_brewery_winery_name",
  "brand": "Brand_name_extracted_from_product_name",
  "vintage": realistic_year_or_null,
  "age": age_in_years_if_aged_spirit_or_null,
  "ageStatement": "12_Year_Old_or_NAS_or_similar",
  "distilleryName": "For_spirits_only",
  "breweryName": "For_beer_only", 
  "wineryName": "For_wine_only",
  "productionMethod": "Valid_enum_value_or_null",
  "caskType": "Bourbon_Barrel_or_Sherry_Cask_or_null",
  "finish": "Additional_cask_finish_or_null",
  
  "shortDescription": "Compelling 1-sentence description under 280 chars highlighting key selling points",
  "description": "Detailed 4-paragraph description covering: 1) Brand heritage and style, 2) Production process and ingredients, 3) Flavor profile and characteristics, 4) Serving suggestions and occasions. Rich, engaging, and informative.",
  
  "tastingNotes": {
    "nose": ["4-5_specific_aroma_descriptors"],
    "aroma": ["2-3_additional_aroma_terms"],
    "palate": ["4-5_specific_flavor_descriptors"], 
    "taste": ["2-3_additional_taste_terms"],
    "finish": ["3-4_finish_descriptors"],
    "mouthfeel": ["2-3_texture_descriptors"],
    "appearance": "Detailed visual description",
    "color": "Specific color description"
  },
  
  "flavorProfile": ["4-8_accurate_flavors_from_enum"],
  "foodPairings": ["4-6_specific_pairing_suggestions"],
  "servingSuggestions": {
    "temperature": "Optimal_serving_temperature",
    "glassware": "Recommended_glass_type",
    "garnish": ["appropriate_garnishes"],
    "mixers": ["compatible_mixers_if_applicable"]
  },
  
  "isDietary": {
    "vegan": accurate_boolean,
    "vegetarian": accurate_boolean, 
    "glutenFree": accurate_boolean,
    "dairyFree": accurate_boolean,
    "organic": accurate_boolean,
    "kosher": accurate_boolean,
    "halal": accurate_boolean,
    "sugarFree": accurate_boolean,
    "lowCalorie": accurate_boolean,
    "lowCarb": accurate_boolean
  },
  
  "allergens": ["accurate_allergens_from_enum_or_empty_array"],
  "ingredients": ["primary_ingredients_list"],
  
  "nutritionalInfo": {
    "calories": realistic_number_per_serving_or_null,
    "carbohydrates": number_or_null,
    "sugar": number_or_null, 
    "protein": number_or_null,
    "fat": number_or_null,
    "sodium": number_or_null,
    "caffeine": number_or_null
  },
  
  "metaTitle": "SEO-optimized title under 60 chars",
  "metaDescription": "SEO description under 160 chars",
  "keywords": ["5-8_relevant_SEO_keywords"],
  "status": "draft"
}

QUALITY CHECKS:
- ABV must be realistic for the product type (e.g., 40-50% for whiskey, 12-15% for wine)
- Flavor profiles must be authentic to the actual product category
- Production methods must match the beverage type
- Serving sizes must be appropriate (1.5oz for spirits, 5oz for wine, 12oz for beer)
- All enum values must be exact matches from the provided lists

Return ONLY the JSON object - no explanations, markdown, or additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Enhanced text cleaning
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, ''); // Remove control characters
    text = text.replace(/\\n/g, ' ').replace(/\n/g, ' '); // Handle newlines
    
    // Extract JSON from response
    let productData;
    try {
      productData = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Raw Response:', text);
      
      // Try to extract JSON using regex
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          productData = JSON.parse(jsonMatch[0]);
        } catch (regexParseError) {
          console.error('Regex JSON Parse Error:', regexParseError.message);
          throw new Error('Unable to parse AI response as valid JSON');
        }
      } else {
        throw new Error('No valid JSON found in AI response');
      }
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
    
    // Additional quality checks
    if (productData.abv && productData.abv > 0 && !productData.isAlcoholic) {
      productData.isAlcoholic = true;
    }
    
    if (!productData.proof && productData.abv && productData.isAlcoholic) {
      productData.proof = parseFloat((productData.abv * 2).toFixed(1));
    }

    res.json({
      success: true,
      data: productData,
      metadata: {
        matchedCategory: matchedCategory?.name || null,
        matchedSubCategory: matchedSubCategory?.name || null,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Gemini API error:', error.message);
    
    // Enhanced error handling with specific fallbacks
    if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('RATE_LIMIT'))) {
      console.log('API quota/rate limit exceeded, returning enhanced demo data');
      
      const demoData = generateEnhancedDemoData(name, inputCategory);
      return res.json({
        success: true,
        data: demoData,
        note: 'Using enhanced demo data - API quota exceeded',
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
    metaKeywords: Array.isArray(data.metaKeywords) ? data.metaKeywords : [],
    status: 'draft',
  };

  return sanitized;
};

/**
 * Generate enhanced demo product data as fallback when API quota is exceeded
 */
const generateEnhancedDemoData = (name, category) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nameParts = name.split(' ');
  const brand = nameParts[0];
  
  // Determine product type from name analysis
  let productType = 'other';
  let isAlcoholic = true;
  let abv = 40;
  let volumeMl = 750;
  let servingSize = '1.5 oz (44ml)';
  let servingsPerContainer = 17;
  let glassware = 'Rocks glass';
  let flavorProfile = ['smooth', 'balanced', 'rich'];
  
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('whiskey') || nameLower.includes('whisky') || nameLower.includes('bourbon') || nameLower.includes('scotch')) {
    productType = 'spirit';
    abv = 40;
    flavorProfile = ['oak', 'vanilla', 'caramel', 'spicy', 'smooth'];
    glassware = 'Whiskey tumbler';
  } else if (nameLower.includes('wine') || nameLower.includes('merlot') || nameLower.includes('cabernet') || nameLower.includes('chardonnay')) {
    productType = 'wine';
    abv = 13.5;
    servingSize = '5 oz (148ml)';
    servingsPerContainer = 5;
    glassware = 'Wine glass';
    flavorProfile = ['fruity', 'berry', 'oak', 'balanced'];
  } else if (nameLower.includes('beer') || nameLower.includes('ale') || nameLower.includes('lager') || nameLower.includes('stout')) {
    productType = 'beer';
    abv = 5.2;
    volumeMl = 355;
    servingSize = '12 oz (355ml)';
    servingsPerContainer = 1;
    glassware = 'Pint glass';
    flavorProfile = ['malty', 'hoppy', 'crisp', 'refreshing'];
  } else if (nameLower.includes('vodka')) {
    productType = 'spirit';
    abv = 40;
    flavorProfile = ['clean', 'crisp', 'smooth', 'neutral'];
  } else if (nameLower.includes('gin')) {
    productType = 'spirit';
    abv = 40;
    flavorProfile = ['herbal', 'citrus', 'juniper', 'botanical'];
  } else if (nameLower.includes('rum')) {
    productType = 'spirit';
    abv = 40;
    flavorProfile = ['sweet', 'caramel', 'vanilla', 'tropical'];
  } else if (nameLower.includes('tequila') || nameLower.includes('mezcal')) {
    productType = 'spirit';
    abv = 40;
    flavorProfile = ['agave', 'earthy', 'peppery', 'smooth'];
  } else if (nameLower.includes('juice') || nameLower.includes('soda') || nameLower.includes('water')) {
    productType = 'non_alcoholic';
    isAlcoholic = false;
    abv = 0;
    servingSize = '8 oz (237ml)';
    servingsPerContainer = 3;
    flavorProfile = ['refreshing', 'crisp', 'sweet'];
  }
  
  return {
    name: name,
    slug: slug,
    type: productType,
    subType: productType === 'spirit' ? 'Premium' : productType === 'wine' ? 'Dry' : 'Craft',
    category: null,
    subCategory: null,
    isAlcoholic: isAlcoholic,
    abv: abv,
    proof: isAlcoholic ? abv * 2 : null,
    volumeMl: volumeMl,
    standardSizes: volumeMl === 750 ? ['70cl', '75cl', '1L'] : volumeMl === 355 ? ['can-330ml', 'can-355ml'] : ['75cl'],
    servingSize: servingSize,
    servingsPerContainer: servingsPerContainer,
    
    originCountry: productType === 'wine' ? 'France' : productType === 'beer' ? 'Germany' : 'Scotland',
    region: productType === 'wine' ? 'Bordeaux' : productType === 'beer' ? 'Bavaria' : 'Speyside',
    appellation: productType === 'wine' ? 'AOC Bordeaux' : null,
    producer: `${brand} ${productType === 'wine' ? 'Winery' : productType === 'beer' ? 'Brewery' : 'Distillery'}`,
    brand: brand,
    vintage: productType === 'wine' ? 2020 : null,
    age: productType === 'spirit' && isAlcoholic ? 12 : null,
    ageStatement: productType === 'spirit' && isAlcoholic ? '12 Year Old' : null,
    distilleryName: productType === 'spirit' ? `${brand} Distillery` : '',
    breweryName: productType === 'beer' ? `${brand} Brewery` : '',
    wineryName: productType === 'wine' ? `${brand} Winery` : '',
    productionMethod: productType === 'spirit' ? 'triple_distilled' : productType === 'wine' ? 'traditional' : 'handcrafted',
    caskType: productType === 'spirit' ? 'Oak Barrels' : null,
    finish: productType === 'spirit' ? 'Smooth oak finish' : null,
    
    shortDescription: `Premium ${name} - A distinguished ${productType === 'spirit' ? 'spirit' : productType} with exceptional quality, crafted using traditional methods and finest ingredients for an unparalleled drinking experience.`,
    description: `${name} represents the pinnacle of ${productType === 'spirit' ? 'distillation' : productType === 'wine' ? 'winemaking' : productType === 'beer' ? 'brewing' : 'beverage crafting'} artistry, combining centuries-old traditions with modern precision to create a truly exceptional ${productType === 'spirit' ? 'spirit' : productType}.

 The production process begins with the careful selection of the finest ${productType === 'wine' ? 'grapes' : productType === 'beer' ? 'malted barley and hops' : 'grains'}, sourced from ${productType === 'wine' ? 'premier vineyards' : productType === 'beer' ? 'trusted suppliers' : 'select farms'}. ${productType === 'spirit' ? 'Triple distillation in copper pot stills' : productType === 'wine' ? 'Controlled fermentation in stainless steel tanks' : productType === 'beer' ? 'Careful brewing with precision timing' : 'Meticulous processing'} ensures optimal flavor development and character.

 ${isAlcoholic && productType === 'spirit' ? `Aged for 12 years in Oak Barrels, this exceptional spirit develops its distinctive character through patient maturation. ` : ''}The result is a ${productType} that showcases ${flavorProfile.slice(0, 3).join(', ')} notes, creating a harmonious balance that delights both novice and connoisseur alike.

 Whether enjoyed ${productType === 'spirit' ? 'neat, on the rocks, or in premium cocktails' : productType === 'wine' ? 'with fine cuisine or as an aperitif' : productType === 'beer' ? 'chilled on its own or with hearty meals' : 'as a refreshing beverage'}, ${name} delivers an unforgettable experience that embodies the finest traditions of ${productType === 'spirit' ? 'distillation' : productType === 'wine' ? 'winemaking' : productType === 'beer' ? 'brewing' : 'beverage crafting'}.`,
    
    tastingNotes: {
      nose: productType === 'spirit' ? ['Rich vanilla', 'Toasted oak', 'Caramel', 'Subtle spice'] : 
            productType === 'wine' ? ['Dark berries', 'Cedar', 'Vanilla', 'Blackcurrant'] :
            productType === 'beer' ? ['Malty sweetness', 'Floral hops', 'Bread', 'Citrus'] :
            ['Fresh aromas', 'Natural essence', 'Clean'],
      aroma: productType === 'spirit' ? ['Honeyed warmth', 'Oak influence'] : 
             productType === 'wine' ? ['Fruit concentration', 'Earthy complexity'] :
             ['Balanced complexity'],
      palate: productType === 'spirit' ? ['Smooth honey', 'Vanilla sweetness', 'Oak tannins', 'Warming spice'] :
              productType === 'wine' ? ['Rich fruit', 'Silky tannins', 'Oak integration', 'Balanced acidity'] :
              productType === 'beer' ? ['Malt backbone', 'Hop balance', 'Clean finish'] :
              ['Refreshing taste', 'Natural flavors'],
      taste: productType === 'spirit' ? ['Well-balanced', 'Complex layers'] :
             productType === 'wine' ? ['Elegant structure', 'Fruit-forward'] :
             ['Clean and crisp'],
      finish: productType === 'spirit' ? ['Long warming finish', 'Lingering oak', 'Subtle sweetness'] :
              productType === 'wine' ? ['Persistent finish', 'Elegant tannins', 'Fruit echo'] :
              productType === 'beer' ? ['Clean finish', 'Refreshing'] :
              ['Smooth finish'],
      mouthfeel: productType === 'spirit' ? ['Velvety smooth', 'Full-bodied', 'Warming'] :
                  productType === 'wine' ? ['Silky texture', 'Medium-bodied', 'Balanced'] :
                  productType === 'beer' ? ['Smooth', 'Medium-bodied'] :
                  ['Light and refreshing'],
      appearance: productType === 'spirit' ? 'Crystal clear with brilliant golden amber hue' :
                  productType === 'wine' ? 'Deep ruby red with purple highlights' :
                  productType === 'beer' ? 'Golden amber with ivory head' :
                  'Crystal clear with natural color',
      color: productType === 'spirit' ? 'Rich golden amber' :
             productType === 'wine' ? 'Deep ruby red' :
             productType === 'beer' ? 'Golden amber' :
             'Natural clear'
    },
    
    flavorProfile: flavorProfile,
    foodPairings: productType === 'spirit' ? ['Grilled steak', 'Dark chocolate', 'Aged cheese', 'Smoked salmon'] :
                  productType === 'wine' ? ['Red meat', 'Aged cheeses', 'Dark chocolate', 'Roasted vegetables'] :
                  productType === 'beer' ? ['Grilled meats', 'Spicy cuisine', 'Sharp cheeses', 'Pub fare'] :
                  ['Light appetizers', 'Fresh salads', 'Seafood', 'Fruit'],
    servingSuggestions: {
      temperature: productType === 'spirit' ? 'Room temperature or slightly chilled' :
                   productType === 'wine' ? 'Cellar temperature (16-18°C)' :
                   productType === 'beer' ? 'Well chilled (4-6°C)' :
                   'Chilled (4-8°C)',
      glassware: glassware,
      garnish: productType === 'spirit' ? ['Orange peel', 'Cinnamon stick'] :
               productType === 'wine' ? ['None needed'] :
               productType === 'beer' ? ['Lime wedge'] :
               ['Fresh mint', 'Lemon slice'],
      mixers: productType === 'spirit' ? ['Soda water', 'Ginger ale', 'Ice'] :
              productType === 'wine' ? ['Serve neat'] :
              productType === 'beer' ? ['Serve neat'] :
              ['Ice', 'Sparkling water']
    },
    
    isDietary: {
      vegan: productType !== 'wine', // Wine often uses animal-based fining agents
      vegetarian: true,
      glutenFree: productType !== 'beer', // Beer typically contains gluten
      dairyFree: true,
      organic: false,
      kosher: false,
      halal: !isAlcoholic,
      sugarFree: productType === 'spirit' && isAlcoholic,
      lowCalorie: !isAlcoholic,
      lowCarb: productType === 'spirit' && isAlcoholic
    },
    
    allergens: productType === 'beer' ? ['gluten'] : [],
    ingredients: productType === 'spirit' ? ['Water', 'Malted grain', 'Yeast'] :
                 productType === 'wine' ? ['Grapes', 'Natural yeasts', 'Sulfites'] :
                 productType === 'beer' ? ['Water', 'Malted barley', 'Hops', 'Yeast'] :
                 ['Water', 'Natural flavoring'],
    
    nutritionalInfo: {
      calories: isAlcoholic ? (productType === 'spirit' ? 97 : productType === 'wine' ? 125 : 150) : 45,
      carbohydrates: isAlcoholic ? (productType === 'spirit' ? 0 : productType === 'wine' ? 4 : 12) : 11,
      sugar: isAlcoholic ? (productType === 'spirit' ? 0 : productType === 'wine' ? 1 : 3) : 10,
      protein: 0,
      fat: 0,
      sodium: productType === 'beer' ? 5 : 1,
      caffeine: 0
    },
    
    metaTitle: `${name} - Premium ${productType === 'spirit' ? 'Spirit' : productType === 'wine' ? 'Wine' : productType === 'beer' ? 'Beer' : 'Beverage'}`,
    metaDescription: `Discover ${name}, a premium ${productType} with exceptional quality and ${flavorProfile[0]} character. Perfect for connoisseurs seeking authentic taste.`,
    metaKeywords: [name.toLowerCase().replace(/\s+/g, '-'), productType, brand.toLowerCase(), 'premium', 'quality', isAlcoholic ? 'spirits' : 'beverage'],
    status: 'draft'
  };
};

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

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Write a compelling product description for "${name}"${type ? `, a ${type}` : ''}${brand ? ` by ${brand}` : ''}. 

Include:
1. A short description (max 280 characters) for product cards
2. A full description (3-5 paragraphs) with history, production details, and tasting notes
3. Key flavor profiles (array of descriptors)
4. Food pairing suggestions (array)

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

    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let data;
    try {
      data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (parseError) {
      // If JSON parsing fails, return demo data as fallback
      console.error('JSON parse error:', parseError.message);
      return res.json({
        success: true,
        data: {
          shortDescription: `${name} - A premium quality beverage with exceptional character and taste.`,
          description: `${name} is a distinguished ${type || 'beverage'} that represents the finest craftsmanship and tradition. This premium product offers a sophisticated drinking experience with its well-balanced flavor profile and smooth, satisfying finish.\n\nProduced with meticulous attention to detail, ${name} embodies the passion and expertise of its makers. Each bottle reflects a commitment to quality that has been perfected over generations.`,
          flavorProfile: ['smooth', 'balanced', 'rich', 'complex', 'premium'],
          foodPairings: ['Premium cheese platter', 'Grilled seafood', 'Dark chocolate', 'Charcuterie']
        },
        note: 'Using demo data - JSON parsing error'
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    
    // Check if it's a quota error
    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
      console.log('API quota exceeded, returning demo data');
      
      // Return demo data as fallback
      return res.json({
        success: true,
        data: {
          shortDescription: `${name} - A premium beverage with exceptional quality and character.`,
          description: `${name} is a distinguished ${type || 'beverage'} that exemplifies quality and craftsmanship. This premium product delivers a sophisticated drinking experience with its well-balanced flavor profile and smooth finish.\n\nCrafted with care using traditional methods combined with modern techniques, ${name} represents the best in its category. The careful selection of ingredients ensures consistency and superior taste in every bottle.`,
          flavorProfile: ['smooth', 'balanced', 'rich', 'complex'],
          foodPairings: ['Grilled meats', 'Cheese platter', 'Dark chocolate']
        },
        note: 'Using demo data - API quota exceeded'
      });
    }
    
    res.status(500);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
});

/**
 * Get beverage recommendations
 * POST /api/gemini/recommendations
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const { query, category } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `As a beverage expert, recommend 5 ${category || 'beverages'} based on this query: "${query}"

Return as JSON array:
[
  {
    "name": "Product Name",
    "type": "beverage type",
    "description": "brief description",
    "whyRecommended": "reason for recommendation"
  }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = JSON.parse(text);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    
    // Check if it's a quota error
    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
      console.log('API quota exceeded, returning demo data');
      
      // Return demo data as fallback
      return res.json({
        success: true,
        data: [
          {
            name: 'Premium Whiskey',
            type: 'whiskey',
            description: 'A smooth and well-balanced whiskey with notes of vanilla and oak',
            whyRecommended: 'Excellent choice for ' + (query || 'any occasion')
          },
          {
            name: 'Craft Gin',
            type: 'gin',
            description: 'Botanical-forward gin with citrus and juniper notes',
            whyRecommended: 'Popular among enthusiasts'
          },
          {
            name: 'Aged Rum',
            type: 'rum',
            description: 'Rich and complex rum with caramel and spice notes',
            whyRecommended: 'Great value for the quality'
          }
        ],
        note: 'Using demo data - API quota exceeded'
      });
    }
    
    res.status(500);
    throw new Error(`Failed to get recommendations: ${error.message}`);
  }
});

/**
 * Generate origin and production details
 * POST /api/gemini/generate-origin
 */
const generateOrigin = asyncHandler(async (req, res) => {
  const { name, type } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Provide origin and production details for "${name}"${type ? `, a ${type}` : ''}.

AVAILABLE PRODUCTION METHODS:
${PRODUCT_ENUMS.productionMethod.join(', ')}

Return as JSON:
{
  "originCountry": "country of origin",
  "region": "specific region (e.g., Speyside, Napa Valley)",
  "appellation": "protected designation if applicable",
  "producer": "distillery/brewery/winery name",
  "brand": "brand name",
  "vintage": year or null,
  "age": age in years or null,
  "ageStatement": "e.g., '12 Year Old' or 'NAS'",
  "distilleryName": "distillery name",
  "breweryName": "brewery name if beer",
  "wineryName": "winery name if wine",
  "productionMethod": "MUST be one from production methods list",
  "caskType": "e.g., 'Bourbon Barrel', 'Sherry Cask' or null",
  "finish": "cask finish description or null"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = JSON.parse(text);

    // Sanitize production method
    if (data.productionMethod && !PRODUCT_ENUMS.productionMethod.includes(data.productionMethod)) {
      data.productionMethod = null;
    }

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
          originCountry: 'Ireland',
          region: 'Dublin',
          appellation: '',
          producer: name.split(' ')[0] + ' Distillery',
          brand: name.split(' ')[0],
          vintage: null,
          age: 12,
          ageStatement: '12 Year Old',
          distilleryName: name.split(' ')[0] + ' Distillery',
          breweryName: '',
          wineryName: '',
          productionMethod: 'triple_distilled',
          caskType: 'Oak Barrels',
          finish: ''
        },
        note: 'Using demo data - API quota exceeded'
      });
    }
    
    res.status(500);
    throw new Error(`Failed to generate origin details: ${error.message}`);
  }
});

/**
 * Generate beverage information (ABV, volume, etc.)
 * POST /api/gemini/generate-beverage-info
 */
const generateBeverageInfo = asyncHandler(async (req, res) => {
  const { name, type } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Product name is required');
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Provide beverage-specific information for "${name}"${type ? `, a ${type}` : ''}.

AVAILABLE STANDARD SIZES:
${PRODUCT_ENUMS.standardSizes.join(', ')}

Return as JSON:
{
  "isAlcoholic": true or false,
  "abv": number between 0-100 (e.g., 40 for 40% alcohol),
  "proof": number (ABV * 2, or null if not alcoholic),
  "volumeMl": typical bottle size in ml (e.g., 750),
  "standardSizes": ["select 2-5 sizes from the list above"],
  "servingSize": "e.g., '1 shot (44ml)' or '1 glass (150ml)'",
  "servingsPerContainer": number
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = JSON.parse(text);

    // Sanitize standard sizes
    if (Array.isArray(data.standardSizes)) {
      data.standardSizes = data.standardSizes.filter(s => PRODUCT_ENUMS.standardSizes.includes(s));
    } else {
      data.standardSizes = [];
    }

    // Calculate proof if ABV is provided
    if (data.abv && !data.proof) {
      data.proof = data.abv * 2;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Gemini API error:', error.message);
    
    if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
      const isAlcoholic = !type || !type.includes('non_alcoholic');
      return res.json({
        success: true,
        data: {
          isAlcoholic: isAlcoholic,
          abv: isAlcoholic ? 40 : 0,
          proof: isAlcoholic ? 80 : null,
          volumeMl: 750,
          standardSizes: ['70cl', '75cl', '1L'],
          servingSize: isAlcoholic ? '1 shot (44ml)' : '1 bottle',
          servingsPerContainer: isAlcoholic ? 17 : 1
        },
        note: 'Using demo data - API quota exceeded'
      });
    }
    
    res.status(500);
    throw new Error(`Failed to generate beverage info: ${error.message}`);
  }
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

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Generate SEO content for "${name}"${brand ? ` by ${brand}` : ''}${type ? `, a ${type}` : ''}.
${shortDescription ? `Product description: ${shortDescription}` : ''}

Requirements:
- metaTitle: max 60 characters
- metaDescription: max 160 characters
- metaKeywords: 5-8 relevant keywords

Return as JSON:
{
  "metaTitle": "SEO title (max 60 chars)",
  "metaDescription": "SEO description (max 160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = JSON.parse(text);

    // Ensure keywords is an array
    if (!Array.isArray(data.metaKeywords)) {
      data.metaKeywords = [];
    }

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
          metaTitle: `${name} - Premium Quality ${type || 'Beverage'}`,
          metaDescription: `Discover ${name}${brand ? ` by ${brand}` : ''}, a premium ${type || 'beverage'} with exceptional quality. Perfect for special occasions.`,
          metaKeywords: [name.toLowerCase(), type?.toLowerCase() || 'beverage', brand?.toLowerCase() || 'premium', 'quality', 'spirits']
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

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Generate 5-10 relevant product tags for "${name}"${type ? `, a ${type}` : ''}${category ? ` in the ${category} category` : ''}.

Tags should be:
- Short (1-3 words)
- Relevant to the product
- Useful for search and filtering
- Include brand, type, style, occasion, and flavor descriptors where applicable

Return as JSON:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const data = JSON.parse(text);

    // Ensure tags is an array
    if (!Array.isArray(data.tags)) {
      data.tags = [];
    }

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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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

    const data = JSON.parse(text);

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

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Write a compelling short description (max 280 characters) for "${name}"${type ? `, a ${type}` : ''}${brand ? ` by ${brand}` : ''}. Focus on key selling points and quality. Return ONLY the JSON: {"shortDescription": "..."}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { shortDescription: `Premium ${name} - A distinguished ${type || 'beverage'} with exceptional quality.` }, note: 'Demo data' });
  }
});

/**
 * Generate full description
 * POST /api/gemini/full-description
 */
const generateFullDescription = asyncHandler(async (req, res) => {
  const { name, type, brand, originCountry } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Write a detailed 3-5 paragraph product description for "${name}"${type ? `, a ${type}` : ''}${brand ? ` by ${brand}` : ''}${originCountry ? ` from ${originCountry}` : ''}. Include history, production process, and unique characteristics. Return ONLY JSON: {"description": "..."}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    
    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { description: `${name} represents the finest in ${type || 'beverage'} craftsmanship.` }, note: 'Demo data' });
  }
});

/**
 * Generate flavor profile
 * POST /api/gemini/flavor-profile
 */
const generateFlavorProfile = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify 5-8 flavor profile descriptors for "${name}"${type ? `, a ${type}` : ''}. Use standard tasting terms. Available: ${PRODUCT_ENUMS.flavorProfile.join(', ')}. Return ONLY JSON: {"flavorProfile": ["descriptor1", "descriptor2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    
    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { flavorProfile: ['smooth', 'rich', 'balanced'] }, note: 'Demo data' });
  }
});

/**
 * Generate food pairings
 * POST /api/gemini/food-pairings
 */
const generateFoodPairings = asyncHandler(async (req, res) => {
  const { name, type, flavorProfile } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Suggest 4-6 ideal food pairings for "${name}"${type ? `, a ${type}` : ''}${flavorProfile ? ` with flavors: ${flavorProfile.join(', ')}` : ''}. Return ONLY JSON: {"foodPairings": ["pairing1", "pairing2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove control characters that can break JSON parsing
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    
    // Try to extract JSON from response if it contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { foodPairings: ['Grilled meats', 'Aged cheese'] }, note: 'Demo data' });
  }
});

/**
 * Generate tasting notes - nose
 * POST /api/gemini/tasting-nose
 */
const generateTastingNose = asyncHandler(async (req, res) => {
  const { name, type, flavorProfile } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Describe the nose/aroma of "${name}"${type ? `, a ${type}` : ''}. Provide 3-5 aroma descriptors. Return ONLY JSON: {"nose": ["aroma1", "aroma2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { nose: ['Rich aromas', 'Vanilla', 'Oak'] }, note: 'Demo data' });
  }
});

/**
 * Generate tasting notes - palate
 * POST /api/gemini/tasting-palate
 */
const generateTastingPalate = asyncHandler(async (req, res) => {
  const { name, type, flavorProfile } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Describe the palate/taste of "${name}"${type ? `, a ${type}` : ''}. Provide 3-5 taste descriptors. Return ONLY JSON: {"palate": ["taste1", "taste2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { palate: ['Smooth', 'Honey sweetness', 'Spice notes'] }, note: 'Demo data' });
  }
});

/**
 * Generate tasting notes - finish
 * POST /api/gemini/tasting-finish
 */
const generateTastingFinish = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Describe the finish/aftertaste of "${name}"${type ? `, a ${type}` : ''}. Provide 3-5 finish descriptors. Return ONLY JSON: {"finish": ["finish1", "finish2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { finish: ['Long finish', 'Warming'] }, note: 'Demo data' });
  }
});

/**
 * Generate tasting notes - color
 * POST /api/gemini/tasting-color
 */
const generateTastingColor = asyncHandler(async (req, res) => {
  const { name, type, age } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Describe the color and appearance of "${name}"${type ? `, a ${type}` : ''}${age ? ` aged ${age} years` : ''}. Be specific about hue, clarity, and intensity. Return ONLY JSON: {"color": "description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { color: 'Golden amber with brilliant clarity' }, note: 'Demo data' });
  }
});

/**
 * Generate origin country
 * POST /api/gemini/origin-country
 */
const generateOriginCountry = asyncHandler(async (req, res) => {
  const { name, type, brand } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify the country of origin for "${name}"${brand ? ` by ${brand}` : ''}${type ? ` (${type})` : ''}. Return ONLY JSON: {"originCountry": "Country name"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { originCountry: 'Ireland' }, note: 'Demo data' });
  }
});

/**
 * Generate region
 * POST /api/gemini/region
 */
const generateRegion = asyncHandler(async (req, res) => {
  const { name, type, originCountry } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify the specific region within ${originCountry || 'its country'} for "${name}". For spirits: Speyside, Highlands, Islay for Scotch; Kentucky, Tennessee for Bourbon. For wine: Napa, Bordeaux, Burgundy. Return ONLY JSON: {"region": "Region name"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { region: 'Dublin' }, note: 'Demo data' });
  }
});

/**
 * Generate appellation
 * POST /api/gemini/appellation
 */
const generateAppellation = asyncHandler(async (req, res) => {
  const { name, type, originCountry, region } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify the appellation/PDO/ designation for "${name}"${type ? ` (${type})` : ''}${originCountry ? ` from ${originCountry}` : ''}${region ? ` in ${region}` : ''}. Examples: Champagne, Cognac, Scotch Whisky, Champagne AOC, Rioja DOCa, Napa Valley AVA. Return ONLY JSON: {"appellation": "Appellation name or empty string"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { appellation: '' }, note: 'Demo data' });
  }
});

/**
 * Generate producer name
 * POST /api/gemini/producer
 */
const generateProducer = asyncHandler(async (req, res) => {
  const { name, brand, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify the producer/manufacturer for "${name}"${brand ? ` (brand: ${brand})` : ''}${type ? ` (${type})` : ''}. Return ONLY JSON: {"producer": "Producer name"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { producer: `${brand || name.split(' ')[0]} Distillery` }, note: 'Demo data' });
  }
});

/**
 * Generate vintage year
 * POST /api/gemini/vintage
 */
const generateVintage = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Is "${name}"${type ? ` (${type})` : ''} a vintage product with a specific year? If yes, return the year. If it's non-vintage or doesn't have a vintage, return null. Return ONLY JSON: {"vintage": year or null}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { vintage: null }, note: 'Demo data' });
  }
});

/**
 * Generate age statement
 * POST /api/gemini/age-statement
 */
const generateAgeStatement = asyncHandler(async (req, res) => {
  const { name, type, age } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What is the age statement for "${name}"${type ? ` (${type})` : ''}${age ? ` aged ${age} years` : ''}? Examples: "12 Year Old", "18 Year Old", "NAS" (No Age Statement), or empty string. Return ONLY JSON: {"ageStatement": "statement"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { ageStatement: '12 Year Old' }, note: 'Demo data' });
  }
});

/**
 * Generate production method
 * POST /api/gemini/production-method
 */
const generateProductionMethod = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What is the production method for "${name}"${type ? ` (${type})` : ''}? Available: ${PRODUCT_ENUMS.productionMethod.join(', ')}. Return ONLY JSON: {"productionMethod": "method"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    if (data.productionMethod && !PRODUCT_ENUMS.productionMethod.includes(data.productionMethod)) {
      data.productionMethod = null;
    }
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { productionMethod: 'traditional' }, note: 'Demo data' });
  }
});

/**
 * Generate cask type
 * POST /api/gemini/cask-type
 */
const generateCaskType = asyncHandler(async (req, res) => {
  const { name, type, productionMethod } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What type of cask/barrel is "${name}"${type ? ` (${type})` : ''}${productionMethod?.includes('aged') ? ' aged in' : ''} matured in? Examples: Bourbon Barrel, Sherry Cask, Oak Cask, or null. Return ONLY JSON: {"caskType": "type or null"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { caskType: 'Oak Barrels' }, note: 'Demo data' });
  }
});

/**
 * Generate serving temperature
 * POST /api/gemini/serving-temperature
 */
const generateServingTemperature = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What is the ideal serving temperature for "${name}"${type ? ` (${type})` : ''}? Examples: "Room temperature", "Chilled", "On the rocks", "18-20°C", or specific temperature. Return ONLY JSON: {"temperature": "description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { temperature: 'Room temperature or slightly chilled' }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What type of glassware is best for serving "${name}"${type ? ` (${type})` : ''}? Examples: Snifter, Tumbler, Wine glass, Flute, Highball, Rocks glass. Return ONLY JSON: {"glassware": "glass type"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { glassware: 'Tumbler or snifter' }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Suggest 2-4 garnish options for "${name}"${type ? ` (${type})` : ''}. Examples: Orange peel, Lemon twist, Cherry, Mint, Cinnamon stick. Return ONLY JSON: {"garnish": ["garnish1", "garnish2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { garnish: ['Orange peel', 'Cinnamon stick'] }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Suggest 2-4 ideal mixers for "${name}"${type ? ` (${type})` : ''}. Examples: Soda water, Ginger ale, Tonic, Cola. Return ONLY JSON: {"mixers": ["mixer1", "mixer2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { mixers: ['Soda water', 'Ginger ale'] }, note: 'Demo data' });
  }
});

/**
 * Generate allergens
 * POST /api/gemini/allergens
 */
const generateAllergens = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify potential allergens in "${name}"${type ? ` (${type})` : ''}. Available: ${PRODUCT_ENUMS.allergens.join(', ')}. Return ONLY JSON: {"allergens": ["allergen1"] or []}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { allergens: [] }, note: 'Demo data' });
  }
});

/**
 * Generate ingredients list
 * POST /api/gemini/ingredients
 */
const generateIngredients = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `List the main ingredients for "${name}"${type ? ` (${type})` : ''}. Return as JSON array. Return ONLY JSON: {"ingredients": ["ingredient1", "ingredient2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { ingredients: ['Water', 'Grain', 'Yeast'] }, note: 'Demo data' });
  }
});

/**
 * Generate meta title
 * POST /api/gemini/meta-title
 */
const generateMetaTitle = asyncHandler(async (req, res) => {
  const { name, brand, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Create an SEO-friendly meta title (max 60 chars) for "${name}"${brand ? ` by ${brand}` : ''}${type ? ` - ${type}` : ''}. Return ONLY JSON: {"metaTitle": "title"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { metaTitle: `${name} - Premium ${type || 'Beverage'}` }, note: 'Demo data' });
  }
});

/**
 * Generate meta description
 * POST /api/gemini/meta-description
 */
const generateMetaDescription = asyncHandler(async (req, res) => {
  const { name, brand, type, shortDescription } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Create an SEO meta description (max 160 chars) for "${name}"${brand ? ` by ${brand}` : ''}${type ? `, a ${type}` : ''}.${shortDescription ? ` Based on: ${shortDescription}` : ''}. Return ONLY JSON: {"metaDescription": "description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { metaDescription: `Discover ${name}, a premium ${type || 'beverage'}.` }, note: 'Demo data' });
  }
});

/**
 * Generate keywords
 * POST /api/gemini/keywords
 */
const generateKeywords = asyncHandler(async (req, res) => {
  const { name, brand, type, category } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Generate 5-8 SEO keywords for "${name}"${brand ? ` by ${brand}` : ''}${type ? ` (${type})` : ''}${category ? ` in ${category}` : ''}. Return ONLY JSON: {"keywords": ["keyword1", "keyword2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { metaKeywords: [name.toLowerCase(), type?.toLowerCase() || 'beverage', 'premium', 'quality'] }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Determine dietary information for "${name}"${type ? ` (${type})` : ''}. Is it vegan, vegetarian, gluten-free, organic? Return ONLY JSON: {"isDietary": {"vegan": boolean, "vegetarian": boolean, "glutenFree": boolean, "organic": boolean}}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { isDietary: { vegan: false, vegetarian: true, glutenFree: true, organic: false } }, note: 'Demo data' });
  }
});

/**
 * Generate nutritional info
 * POST /api/gemini/nutritional-info
 */
const generateNutritionalInfo = asyncHandler(async (req, res) => {
  const { name, type, abv, volumeMl } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Estimate nutritional info for "${name}"${type ? ` (${type})` : ''}${abv ? ` at ${abv}% ABV` : ''}${volumeMl ? ` in ${volumeMl}ml` : ''}. Return ONLY JSON: {"nutritionalInfo": {"calories": number, "carbohydrates": number, "sugar": number, "protein": number, "fat": number}}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { nutritionalInfo: { calories: 97, carbohydrates: 0, sugar: 0, protein: 0, fat: 0 } }, note: 'Demo data' });
  }
});

/**
 * Generate volume and ABV
 * POST /api/gemini/volume-abv
 */
const generateVolumeAbv = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What is the typical alcohol by volume (ABV) and bottle volume for "${name}"${type ? ` (${type})` : ''}? Return ONLY JSON: {"abv": number (0-100), "volumeMl": number (ml), "isAlcoholic": boolean}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { abv: 40, volumeMl: 750, isAlcoholic: true }, note: 'Demo data' });
  }
});

/**
 * Generate standard sizes
 * POST /api/gemini/standard-sizes
 */
const generateStandardSizes = asyncHandler(async (req, res) => {
  const { name, type, volumeMl } = req.body;
  if (!name) { res.status(400); throw new Error('Product name is required'); }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What standard sizes/bottle formats is "${name}"${type ? ` (${type})` : ''} typically sold in? Available: ${PRODUCT_ENUMS.standardSizes.join(', ')}. Select 2-5. Return ONLY JSON: {"standardSizes": ["size1", "size2"]}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    if (Array.isArray(data.standardSizes)) {
      data.standardSizes = data.standardSizes.filter(s => PRODUCT_ENUMS.standardSizes.includes(s));
    }
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { standardSizes: ['70cl', '75cl'] }, note: 'Demo data' });
  }
});

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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Write a compelling brand description for "${name}"${productName ? `, known for products like "${productName}"` : primaryCategory ? ` in the ${primaryCategory} category` : ''}. Include brand history, reputation, signature characteristics, and what makes them unique. Return ONLY JSON: {"description": "2-3 paragraph brand description"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { description: `${name} is a distinguished brand known for quality and excellence in their craft.` }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Identify the country of origin for the brand "${name}"${productName ? `, the maker of "${productName}"` : primaryCategory ? ` (${primaryCategory})` : ''}. Consider regional specialties and typical origins for this type of product. Return ONLY JSON: {"countryOfOrigin": "Country name"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { countryOfOrigin: 'Ireland' }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `When was the brand "${name}"${productName ? `, producer of "${productName}"` : countryOfOrigin ? ` from ${countryOfOrigin}` : ''} founded? Research or infer based on typical establishment periods for this type of brand. Return the year as a number, or null if unknown. Return ONLY JSON: {"founded": year or null}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { founded: 1880 }, note: 'Demo data' });
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
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `What is the primary category for the brand "${name}"${productName ? `, which makes "${productName}"` : ''}? Consider the product type and typical offerings. Available: ${categories.join(', ')}. Return ONLY JSON: {"primaryCategory": "category"}`;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(text);
    if (data.primaryCategory && !categories.includes(data.primaryCategory)) {
      data.primaryCategory = 'other';
    }
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: { primaryCategory: 'spirits' }, note: 'Demo data' });
  }
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
  getRecommendations,
};