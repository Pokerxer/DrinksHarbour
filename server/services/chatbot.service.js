// server/services/chatbot.service.js
// Enhanced Chatbot Service using Ollama Cloud API for DrinksHarbour Multi-tenant Platform
// Supports: Text queries, Image analysis, Database products, General beverage knowledge

const mongoose = require('mongoose');
const productService = require('./product.service');

const Product = mongoose.models.Product || mongoose.model('Product');
const SubProduct = mongoose.models.SubProduct || mongoose.model('SubProduct');
const Size = mongoose.models.Size || mongoose.model('Size');
const Category = mongoose.models.Category || mongoose.model('Category');
const Tenant = mongoose.models.Tenant || mongoose.model('Tenant');

// Ollama Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'kimi-k2.5:cloud';

// Call Ollama Cloud API
const callOllama = async (prompt, systemPrompt = null) => {
  const defaultSystemPrompt = `You are DrinksHarbour AI - the friendly, expert beverage assistant for DrinksHarbour.com, Nigeria's premier multi-tenant drinks marketplace.
Your goal is to help customers find drinks, check prices, plan events, and get beverage recommendations.

### YOUR PERSONA & STYLE:
- **Tone:** Friendly, helpful, knowledgeable, and distinctly human.
- **Length:** Keep responses concise, direct, and conversational (typically 1-3 short paragraphs).
- **Emojis:** Use relevant emojis naturally to make the conversation lively (e.g., 🍷, 🍻, 🎉).
- **Format:** Use bullet points or bold text to highlight key information (like names and prices).

### CORE RULES:
1. **Pricing & Currency:** Always display prices in Nigerian Naira (₦). Format with commas (e.g., ₦12,500).
2. **Product Suggestions:** If a user asks for a drink that isn't in the provided context, gracefully suggest 1-2 available alternatives.
   - *Example:* "I couldn't find Heineken right now, but **Star Lager (₦11,500)** is a fantastic, popular alternative! 🍻"
3. **Event Planning:** If a user is planning an event (party, wedding, etc.), proactively ask helpful questions (guest count, budget, preferences) and offer a quick estimate (e.g., "A standard bottle of spirits typically serves 15-20 shots").
4. **No Hallucinations:** Only recommend products and prices that are explicitly provided in the context. If the context is empty, rely on your general beverage knowledge.

Remember: Be helpful, quick, and human-like!`;

  const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || null;
  } catch (error) {
    console.error('Ollama Error:', error.message);
    return null;
  }
};

// Analyze image using Ollama Vision
const analyzeImage = async (imageUrl, contextPrompt = '') => {
  try {
    if (!imageUrl) {
      console.error('No image URL provided');
      return null;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;

    // Convert image URL to base64
    let base64Image = imageUrl;
    
    // If it's already a data URL, extract the base64 part
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        base64Image = matches[2];
        console.log('Using data URL image, length:', base64Image.length);
      } else {
        console.error('Invalid data URL format');
        return null;
      }
    } 
    // If it's an HTTP URL, fetch and convert
    else if (imageUrl.startsWith('http')) {
      try {
        console.log('Fetching image from URL:', imageUrl.substring(0, 50));
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
          throw new Error(`Failed to fetch: ${imageRes.status}`);
        }
        const imageBuffer = await imageRes.arrayBuffer();
        base64Image = Buffer.from(imageBuffer).toString('base64');
        console.log('Converted HTTP image to base64, length:', base64Image.length);
      } catch (e) {
        console.error('Failed to fetch image:', e.message);
        return null;
      }
    } else {
      console.error('Unknown image format');
      return null;
    }

    if (!base64Image || base64Image.length < 100) {
      console.error('Invalid base64 image, length:', base64Image?.length);
      return null;
    }

    const prompt = contextPrompt || `You are an expert bartender and beverage analyst.
Examine this image and identify the drink(s). Provide your findings in a structured, easy-to-read format.

1. **Brand & Name:** What is the specific drink?
2. **Type:** Is it wine, beer, spirits, etc.?
3. **Volume:** Can you see the size (e.g., 75cl, 33cl)?
4. **Extra Details:** Note any special edition markers, flavor profiles listed, or serving suggestions.

Keep it concise, and if you're very confident in the brand, explicitly state it so I can search our catalog for exact matches.`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image]
          }
        ],
        temperature: 0.3,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama Vision API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || null;
  } catch (error) {
    console.error('Ollama Vision Error:', error.message);
    return null;
  }
};

// Extract intent and filters from query
const extractIntent = (query) => {
  const lowerQuery = query.toLowerCase();
  const intent = { type: 'general', keywords: [], filters: {}, brand: null };

  // Brand detection - common beverage brands
  const brandPatterns = [
    'heineken', 'guinness', 'budweiser', 'carling', 'bud light', 'stella artois', 'crown royal',
    'johnnie walker', 'jack daniels', 'jameson', 'glenfiddich', 'glenlivet', 'macallan',
    'grey goose', 'absolute', 'smirnoff', 'belvedere', 'ketel one',
    'bacardi', 'captain morgan', 'havana club', 'don julio', 'patron',
    'moet & chandon', 'veuve clicquot', 'dom perignon', 'mumm',
    'carlos', 'cava', 'freixenet',
    'red square', 'skyy', 'finlandia',
    'tullamore', 'j&b', 'chivas', 'ballantines', 'famous grouse',
    'corona', 'modelo', 'amstel', 'tuborg', 'foster', 'castle', 'lagers'
  ];
  
  for (const brand of brandPatterns) {
    if (lowerQuery.includes(brand)) {
      intent.brand = brand;
      intent.keywords.push(brand);
      break;
    }
  }

  // Query type detection
  if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('how much') || lowerQuery.includes('cheap') || lowerQuery.includes('affordable')) {
    intent.type = 'price';
  }
  if (lowerQuery.includes('available') || lowerQuery.includes('in stock') || lowerQuery.includes('stock')) {
    intent.type = 'availability';
  }
  if (lowerQuery.includes('discount') || lowerQuery.includes('sale') || lowerQuery.includes('offer') || lowerQuery.includes('deal') || lowerQuery.includes('promo')) {
    intent.type = 'discount';
  }
  if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest') || lowerQuery.includes('best') || lowerQuery.includes('top') || lowerQuery.includes('popular')) {
    intent.type = 'recommendation';
  }
  if (lowerQuery.includes('tell me about') || lowerQuery.includes('details') || lowerQuery.includes('information') || lowerQuery.includes('what is') || lowerQuery.includes('describe')) {
    intent.type = 'product_info';
  }
  if (lowerQuery.includes('image') || lowerQuery.includes('photo') || lowerQuery.includes('picture') || lowerQuery.includes('this drink')) {
    intent.type = 'image_query';
  }
  if (lowerQuery.includes('brand') || lowerQuery.includes('origin') || lowerQuery.includes('country') || lowerQuery.includes('where from')) {
    intent.type = 'origin';
  }
  if (lowerQuery.includes('difference') || lowerQuery.includes('vs') || lowerQuery.includes('compared')) {
    intent.type = 'comparison';
  }

  // Beverage type detection
  const beverageTypes = [
    'wine', 'wines', 'red wine', 'white wine', 'rose wine', 'champagne', 'prosecco', 'sparkling',
    'beer', 'beers', 'lager', 'lagers', 'ale', 'ales', 'stout', 'porter', 'ipa', 'craft beer',
    'whiskey', 'whisky', 'bourbon', 'scotch', 'rye',
    'vodka', 'gin', 'rum', 'tequila', 'mezcal', 'cognac', 'brandy',
    'cider', 'ciders', 'sake', 'sherry', 'port', 'vermouth',
    'soft drink', 'water', 'juice', 'energy drink', 'soda', 'tonic'
  ];
  
  for (const type of beverageTypes) {
    if (lowerQuery.includes(type)) {
      // Normalize plural to singular
      let normalizedType = type.replace(/s$/, '');
      if (normalizedType === 'whisky') normalizedType = 'whiskey';
      if (normalizedType === 'lager') normalizedType = 'lager';
      if (normalizedType === ' cider') normalizedType = 'cider';
      intent.filters.type = normalizedType.replace(/ /g, '_');
      intent.keywords.push(type);
      break;
    }
  }

  // ABV preferences
  if (lowerQuery.includes('strong') || lowerQuery.includes('high alcohol')) intent.filters.minAbv = 30;
  else if (lowerQuery.includes('mild') || lowerQuery.includes('low alcohol') || lowerQuery.includes('light')) intent.filters.maxAbv = 10;

  // Price range
  const priceMatch = lowerQuery.match(/(?:under|below|less than|₦|naira)\s*(\d+[,.\d]*)/i);
  if (priceMatch) intent.filters.maxPrice = parseFloat(priceMatch[1].replace(/,/g, ''));

  // Size detection
  const sizes = ['70cl', '75cl', '1l', '1.5l', '1.75l', '330ml', '500ml', '750ml', '1L', '1.5L'];
  for (const size of sizes) {
    if (lowerQuery.includes(size)) {
      intent.filters.size = size;
      break;
    }
  }

  return intent;
};

// Query products from database (Mirroring exact /shop logic via productService.searchProducts)
const queryProducts = async (filters, searchQuery, limit = 10, brand = null, tenantId = null) => {
  try {
    // Build query params compatible with productService.searchProducts (used by /shop page)
    const queryParams = {
      page: 1,
      limit: limit,
      inStock: true,
      status: 'approved',
      searchMode: 'text', // Use text search for chatbot (faster, more reliable)
      useEmbeddings: false // Disable semantic search for chatbot
    };

    if (searchQuery) queryParams.query = searchQuery;
    if (brand) queryParams.brand = brand;
    if (tenantId) queryParams.tenantId = tenantId;
    if (filters.type) queryParams.type = filters.type;
    if (filters.minPrice) queryParams.minPrice = filters.minPrice;
    if (filters.maxPrice) queryParams.maxPrice = filters.maxPrice;
    if (filters.minAbv) queryParams.minAbv = filters.minAbv;
    if (filters.maxAbv) queryParams.maxAbv = filters.maxAbv;

    let result;
    try {
      result = await productService.searchProducts(queryParams);
    } catch (err) {
      console.error('searchProducts failed:', err.message);
    }

    if (!result || !result.products || result.products.length === 0) {
      // Fallback: Direct MongoDB query
      
      // Fallback: Direct MongoDB query as fallback
      const Product = mongoose.models.Product || mongoose.model('Product');
      const SubProduct = mongoose.models.SubProduct || mongoose.model('SubProduct');
      const Tenant = mongoose.models.Tenant || mongoose.model('Tenant');
      
      const baseQuery = { status: 'approved' };
      if (searchQuery) {
        baseQuery.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } }
        ];
      }
      if (filters.type) {
        const typeMap = {
          'wine': ['wine', 'red_wine', 'white_wine', 'rose_wine', 'sparkling_wine', 'champagne'],
          'beer': ['beer', 'lager', 'ale', 'stout', 'porter', 'ipa', 'pilsner'],
          'whiskey': ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch'],
          'vodka': ['vodka'],
          'gin': ['gin'],
          'rum': ['rum'],
          'champagne': ['champagne', 'sparkling_wine', 'prosecco'],
          'tequila': ['tequila', 'mezcal'],
          'cider': ['cider', 'apple_cider'],
          'spirit': ['spirit', 'whiskey', 'vodka', 'gin', 'rum', 'tequila', 'brandy'],
        };
        const types = typeMap[filters.type] || [filters.type];
        baseQuery.type = { $in: types };
      }
      
      let products = await Product.find(baseQuery).limit(limit * 2).lean();
      
      if (tenantId) {
        const subProducts = await SubProduct.find({
          product: { $in: products.map(p => p._id) },
          tenant: tenantId,
          status: 'active'
        }).populate('tenant', 'name slug').lean();
        
        const validProductIds = [...new Set(subProducts.map(sp => sp.product.toString()))];
        products = products.filter(p => validProductIds.includes(p._id.toString()));
      }
      
      // Get pricing from SubProducts (only active ones with stock and valid prices)
      const productIds = products.map(p => p._id);
      
      const subProducts = await SubProduct.find({
        product: { $in: productIds },
        status: 'active',
        availableStock: { $gt: 0 },
        baseSellingPrice: { $gt: 0 }
      }).populate('tenant', 'name').lean();
      
      // Get size IDs and try to fetch Size documents
      const allSizeIds = [...new Set(subProducts.flatMap(sp => (sp.sizes || []).map(s => s.toString())))];
      const sizeDocs = allSizeIds.length > 0 ? await Size.find({ _id: { $in: allSizeIds } }).lean() : [];
      const sizeMap = {};
      sizeDocs.forEach(s => { 
        const id = s._id.toString();
        sizeMap[id] = s; 
      });

      // Build availableAt for each product
      const availableAtMap = {};
      const subProductMap = {};
      subProducts.forEach(sp => {
        const productId = sp.product.toString();
        
        // Build subProductMap for min price calculation
        if (!subProductMap[productId]) {
          subProductMap[productId] = [];
        }
        subProductMap[productId].push(sp);
        
        // Build availableAtMap
        if (!availableAtMap[productId]) {
          availableAtMap[productId] = {
            _id: sp._id,
            tenant: sp.tenant,
            sizes: []
          };
        }
        // Add sizes - use fetched Size docs, fallback to generic names
        if (sp.sizes && sp.sizes.length > 0) {
          sp.sizes.forEach((sizeId, idx) => {
            const sizeDoc = sizeMap[sizeId.toString()];
            // Generate a reasonable size name
            let sizeName = sizeDoc?.size;
            if (!sizeName) {
              // Generate names based on index: Standard, Large, Small, etc.
              const sizeNames = ['Standard', 'Large', 'Small', 'XL', '30cl', '50cl', '75cl', '1L'];
              sizeName = sizeNames[idx % sizeNames.length] || `Size ${idx + 1}`;
            }
            availableAtMap[productId].sizes.push({
              _id: sizeId,
              size: sizeName,
              volumeMl: sizeDoc?.volumeMl,
              stock: 0,
              pricing: {
                websitePrice: sp.baseSellingPrice,
                originalWebsitePrice: sp.baseSellingPrice
              },
              discount: sp.discount
            });
          });
        }
      });
      
      // Only return products that have valid pricing
      const validProducts = products.filter(p => {
        const sps = subProductMap[p._id] || [];
        return sps.length > 0 && sps.some(sp => (sp.baseSellingPrice || 0) > 0);
      });
      
      return validProducts.map(p => {
        const pid = p._id.toString();
        const sps = subProductMap[pid] || [];
        const minPrice = sps.length > 0 ? Math.min(...sps.map(sp => sp.baseSellingPrice || 0)) : 0;
        const totalStock = sps.reduce((sum, sp) => sum + (sp.availableStock || 0), 0);
        
        return {
          _id: p._id,
          name: p.name,
          slug: p.slug,
          type: p.type,
          minPrice,
          totalStock,
          hasDiscount: sps.some(sp => (sp.discount || 0) > 0),
          availableAt: availableAtMap[pid] ? [availableAtMap[pid]] : [],
          subProducts: sps,
          image: p.images?.[0]?.url || p.images?.[0] || null,
          primaryImage: p.primaryImage || p.images?.[0]
        };
      }).filter(p => p.totalStock > 0).slice(0, limit);
    }

    // Transform the output slightly to match the existing Chatbot logic format
    return (result.products || []).map(p => {
      // Find the minimum pricing info calculated by getAllProducts
      // In the new processedProducts structure, minPrice is calculated under product.priceRange.min
      let minPrice = 0;
      let totalStock = 0;
      let hasDiscount = false;
      let sizes = [];
      let availableAt = p.availableAt || [];

      // Always check for priceRange first (primary path from searchProducts)
      if (p.priceRange && p.priceRange.min) {
        minPrice = p.priceRange.min;
      }
      
      // Extract sizes from availableAt (tenants) - always do this if available
      if (availableAt && availableAt.length > 0) {
        sizes = availableAt.flatMap(tenantEntry => 
          (tenantEntry.sizes || []).map(s => ({
            id: s._id,
            name: s.size,
            size: s.size,
            volumeMl: s.volumeMl,
            price: s.pricing?.websitePrice || s.pricing?.sellingPrice || 0,
            originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.sellingPrice,
            discount: s.discount?.value || 0,
            tenant: tenantEntry.tenant?.name
          }))
        );
        // If we have sizes from availableAt but no minPrice yet, get it from first size
        if (minPrice === 0 && sizes.length > 0) {
          minPrice = sizes[0].price || 0;
        }
      } else if (p.activeSubProducts && p.activeSubProducts.length > 0) {
        const prices = p.activeSubProducts.flatMap(sp => sp.sizes?.map(s => s.pricing?.websitePrice || s.pricing?.sellingPrice || 0) || []);
        if (prices.length > 0) minPrice = Math.min(...prices.filter(price => price > 0));
        
        // Collect all sizes from all subProducts
        sizes = p.activeSubProducts.flatMap(sp => 
          (sp.sizes || []).map(s => ({
            id: s._id,
            name: s.name,
            size: s.size,
            volumeMl: s.volumeMl,
            price: s.pricing?.websitePrice || s.pricing?.sellingPrice || 0,
            originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.sellingPrice,
            discount: s.discount?.value || 0
          }))
        );
      } else if (p.sizes && p.sizes.length > 0) {
        const prices = p.sizes.map(s => s.pricing?.websitePrice || s.pricing?.sellingPrice || 0);
        if (prices.length > 0) minPrice = Math.min(...prices.filter(price => price > 0));
        
        sizes = p.sizes.map(s => ({
          id: s._id,
          name: s.name,
          size: s.size,
          volumeMl: s.volumeMl,
          price: s.pricing?.websitePrice || s.pricing?.sellingPrice || 0,
          originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.sellingPrice,
          discount: s.discount?.value || 0
        }));
      }

      if (p.stockInfo && p.stockInfo.availableStock !== undefined) {
        totalStock = p.stockInfo.availableStock;
      } else if (p.activeSubProducts && p.activeSubProducts.length > 0) {
        totalStock = p.activeSubProducts.reduce((sum, sp) => sum + (sp.availableStock || 0), 0);
      } else if (p.sizes && p.sizes.length > 0) {
        totalStock = p.sizes.reduce((sum, s) => sum + (s.availableStock || 0), 0);
      }

      hasDiscount = !!p.bestDiscount || (p.activeSubProducts || []).some(sp => 
        (sp.sizes || []).some(s => s.discount && s.discount.value > 0)
      );
      
      // We already filtered by inStock in getAllProducts
      // Extract image URL for chatbot display
      let image = null;
      if (p.images && p.images.length > 0) {
        image = p.images[0]?.url || p.images[0];
      } else if (p.primaryImage) {
        image = typeof p.primaryImage === 'string' ? p.primaryImage : p.primaryImage?.url;
      }
      
      return {
        ...p,
        _id: p._id,
        name: p.name,
        subProducts: p.activeSubProducts || p.subProducts,
        availableAt: availableAt, // Use extracted availableAt
        minPrice,
        totalStock,
        hasDiscount,
        sizes,
        image,
        primaryImage: p.primaryImage || (p.images && p.images[0])
      };
    });
  } catch (error) {
    console.error('Chatbot queryProducts Error:', error);
    return [];
  }
};

// General beverage knowledge base
const beverageKnowledgeBase = {
  wine: {
    types: ['Red Wine', 'White Wine', 'Rosé Wine', 'Sparkling Wine', 'Champagne', 'Prosecco'],
    descriptions: {
      'Red Wine': 'Made from dark grape varieties, ranging from light-bodied Pinot Noir to full-bodied Cabernet Sauvignon. Popular regions include France (Bordeaux, Burgundy), Italy (Chianti), Spain (Rioja), and Australia.',
      'White Wine': 'Produced from green or yellowish grapes, offering crisp and refreshing flavors. Examples include Chardonnay, Sauvignon Blanc, and Riesling. Best served chilled.',
      'Rosé Wine': 'Pink-colored wine made from red grapes with minimal skin contact. Light, fruity, and perfect for warm weather.',
      'Sparkling Wine': 'Carbonated wine with bubbles. Champagne (from France) is the most prestigious, but Prosecco (Italy) and Cava (Spain) offer excellent alternatives.',
      'Champagne': 'A sparkling wine from the Champagne region of France. Known for its bubbles, complexity, and celebration association.',
    },
    serving: 'Most wines are served at 12-16°C. Red wines slightly warmer, whites and rosés colder.',
    pairing: 'Red wine: red meat, cheese. White wine: seafood, chicken, light pasta. Sparkling: appetizers, celebrations.'
  },
  beer: {
    types: ['Lager', 'Ale', 'Stout', 'IPA', 'Pilsner', 'Wheat Beer'],
    descriptions: {
      'Lager': 'Crisp, clean, and refreshing. Popular brands include Heineken, Stella, and Budweiser. Fermented at cooler temperatures.',
      'Ale': 'Fruitier and more complex than lagers. Includes pale ales, brown ales, and porters.',
      'Stout': 'Dark, rich, and creamy. Guinness is the most famous example. Notes of coffee, chocolate, and roasted barley.',
      'IPA': 'India Pale Ale - hoppy, bitter, and aromatic. Increasingly popular among craft beer enthusiasts.',
      'Pilsner': 'Light, crisp, and golden. A type of lager originating from Czech Republic.',
    },
    serving: 'Serve at 4-10°C depending on style. Light beers colder, stouts and porters slightly warmer.',
    pairing: 'Light lagers: pizza, burgers. IPAs: spicy food, strong cheeses. Stouts: chocolate, desserts.'
  },
  spirit: {
    types: ['Whiskey', 'Vodka', 'Gin', 'Rum', 'Tequila', 'Brandy', 'Cognac'],
    descriptions: {
      'Whiskey': 'Distilled grain mash, aged in oak barrels. Types include Scotch (Scotland), Bourbon (USA), Irish, and Japanese. Ranges from smoky to sweet.',
      'Vodka': 'Clean, neutral spirit usually made from grains or potatoes. Popular brands include Grey Goose, Absolut, and Ciroc. Essential for cocktails.',
      'Gin': 'Juniper-flavored spirit with botanical notes. London Dry Gin is the most common style. Key for cocktails like Martini and Gin & Tonic.',
      'Rum': 'Made from sugarcane. White rum is light and crisp; dark rum is aged with rich flavors. Popular in tropical cocktails.',
      'Tequila': 'Made from blue agave plant in Mexico. Blanco (unaged), Reposado (aged 2-12 months), Añejo (aged 1-3 years).',
      'Brandy/Cognac': 'Distilled wine, aged in oak. Cognac from France is the most prestigious. Rich, complex, and often served after dinner.',
    },
    serving: 'Spirits are typically served neat, on rocks, or in cocktails. Premium spirits are often enjoyed neat.',
    pairing: 'Whiskey: cigars, dark chocolate. Gin: tonic, citrus. Rum: tropical fruits. Tequila: lime, salt.'
  },
  cocktail_basics: {
    'Old Fashioned': 'Whiskey, sugar, bitters, orange peel. Classic cocktail.',
    'Martini': 'Gin, dry vermouth. The iconic sophisticated cocktail.',
    'Mojito': 'White rum, fresh mint, lime, sugar, soda water. Refreshing summer drink.',
    'Margarita': 'Tequila, lime juice, triple sec. Popular tequila cocktail.',
    'Cosmopolitan': 'Vodka, triple sec, cranberry juice, lime. Glamorous pink cocktail.',
    'Pina Colada': 'White rum, coconut cream, pineapple juice. Tropical creamy drink.',
    'Negroni': 'Gin, Campari, sweet vermouth. Bitter-sweet Italian aperitif.'
  }
};

// Generate contextual response using knowledge base
const generateKnowledgeResponse = async (query, intent) => {
  const lowerQuery = query.toLowerCase();
  let context = '';

  // Wine knowledge - keep short
  if (lowerQuery.includes('wine')) {
    context += `\nWine info: Red (Cabernet, Merlot), White (Chardonnay, Sauvignon Blanc). Best served at 12-14°C. Pairs well with red meat, pasta, cheese.`;
  }

  // Beer knowledge - keep short
  if (lowerQuery.includes('beer')) {
    context += `\nBeer info: Lager, Stout, Ale. Serve cold (4-8°C). Nigerian favorites: Star, Heineken, Guinness.`;
  }

  // Spirit knowledge - keep short
  if (lowerQuery.includes('spirit') || lowerQuery.includes('whiskey') || lowerQuery.includes('vodka')) {
    context += `\nSpirits info: Best served neat or on rocks. Mixers: tonic, juice, soda. Popular: Whiskey, Vodka, Rum.`;
  }

  // Cocktails
  if (lowerQuery.includes('cocktail') || lowerQuery.includes('recipe')) {
    context += `\nPopular cocktails: Old Fashioned (whiskey), Mojito (rum), Martini (gin/vodka), Cosmopolitan (vodka).`;
  }

  return context;
};

// Generate product context for AI
const generateProductContext = (products) => {
  if (!products || products.length === 0) return '';
  
  // Only include products with valid prices
  const validProducts = products.filter(p => p.minPrice > 0);
  if (validProducts.length === 0) return '';
  
  return `Available: ` + 
    validProducts.slice(0, 5).map((p) => {
      return `${p.name} - ₦${(p.minPrice || 0).toLocaleString()}`;
    }).join(', ');
};

// Main chatbot query handler
const handleChatbotQuery = async (options) => {
  const { query, imageUrls, imageUrl, tenantId, conversationHistory = [], fileContent, fileName, userId } = options;

  // Support both single imageUrl and multiple imageUrls
  const images = imageUrls || (imageUrl ? [imageUrl] : []);

  if (!query || query.trim().length < 1) {
    return getGreetingResponse();
  }

  try {
    // Handle image query (single or multiple)
    if (images.length > 0) {
      return await handleImageQuery(images, query, tenantId);
    }

    // Handle file content (drink list)
    if (fileContent) {
      return await handleFileQuery(fileContent, fileName, query, tenantId);
    }

    const intent = extractIntent(query);
    console.log('[Chatbot] extractIntent result:', JSON.stringify(intent));
    console.log('[Chatbot] query:', query);
    
    // For cart actions, search using the actual query (extract product name)
    let searchTerm = intent.keywords.length > 0 ? intent.keywords.join(' ') : null;
    
    // Don't use brand filter for cart actions - it might be too restrictive
    const searchBrand = intent.brand;
    console.log(`[Chatbot] searchTerm: "${searchTerm}", searchBrand: "${searchBrand}", filters:`, intent.filters);
    let products = await queryProducts(intent.filters, searchTerm, 10, searchBrand, tenantId);
    console.log(`[Chatbot] queryProducts returned ${products.length} products`);
    
    const productContext = generateProductContext(products);

    // Get general knowledge if no products found
    const knowledgeContext = products.length === 0 ? await generateKnowledgeResponse(query, intent) : '';

    let systemPrompt = `You are DrinksHarbour AI - the friendly, expert beverage assistant for DrinksHarbour.com, Nigeria's premier multi-tenant drinks marketplace.
Your goal is to help customers find drinks, check prices, plan events, and get beverage recommendations.

### CONTEXT:
${productContext}
${knowledgeContext}

### YOUR PERSONA & STYLE:
- **Tone:** Friendly, helpful, knowledgeable, and distinctly human.
- **Length:** Keep responses concise, direct, and conversational (typically 1-3 short paragraphs).
- **Emojis:** Use relevant emojis naturally to make the conversation lively (e.g., 🍷, 🍻, 🎉).
- **Format:** Use bullet points or bold text to highlight key information (like names and prices).

### CORE RULES:
1. **Pricing & Currency:** Always display prices in Nigerian Naira (₦). Format with commas (e.g., ₦12,500).
2. **Product Suggestions:** If a user asks for a drink that isn't in the provided context, gracefully suggest 1-2 available alternatives.
   - *Example:* "I couldn't find Heineken right now, but **Star Lager (₦11,500)** is a fantastic, popular alternative! 🍻"
3. **Event Planning:** If a user is planning an event (party, wedding, etc.), proactively ask helpful questions (guest count, budget, preferences) and offer a quick estimate (e.g., "A standard bottle of spirits typically serves 15-20 shots").
4. **No Hallucinations:** Only recommend products and prices that are explicitly listed in the CONTEXT above. If the context is empty, rely on your general beverage knowledge but clarify that they should search the catalog for exact availability.

Remember: Be helpful, quick, and human-like!`;

    // Build conversation
    const recentMessages = conversationHistory.slice(-6).map(m => 
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const fullPrompt = recentMessages ? `${recentMessages}\n\nUser: ${query}` : query;

    let response = await callOllama(fullPrompt, systemPrompt);

    // Filter out products with invalid/zero prices for display
    const validProducts = products.filter(p => p.minPrice > 0);
    
    // Fallback responses
    if (!response) {
      const isGreeting = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'what\'s up', 'sup']
        .some(g => query.toLowerCase().trim() === g || query.toLowerCase().trim().startsWith(g + ' '));

      if (isGreeting) {
        return getGreetingResponse();
      } else if (validProducts.length > 0) {
        // Check if user asked for a specific product and we found it
        const exactMatch = validProducts.find(p => 
          p.name.toLowerCase().includes(query.toLowerCase().trim()) || 
          query.toLowerCase().trim().includes(p.name.toLowerCase())
        );
        
        if (exactMatch) {
          // Build size info if available
          let sizeInfo = '';
          const sizes = exactMatch.sizes || exactMatch.subProducts?.[0]?.sizes || [];
          if (sizes && sizes.length > 0) {
            const sizeList = sizes.slice(0, 3).map(s => {
              const price = s.price || exactMatch.minPrice;
              const original = s.originalPrice && s.originalPrice > price ? ` (was ₦${s.originalPrice.toLocaleString()})` : '';
              const discount = s.discount ? ` - ${s.discount}% OFF` : '';
              const sizeName = s.name || s.size || (s.volumeMl ? s.volumeMl + 'ml' : '');
              return `• ${sizeName}: ₦${price.toLocaleString()}${original}${discount}`;
            }).join('\n');
            sizeInfo = `\n\n**Available Sizes:**\n${sizeList}`;
          }
          
          response = `**${exactMatch.name}** is available! 🎉\n\n**Price: ₦${exactMatch.minPrice.toLocaleString()}**${sizeInfo}`;
          if (exactMatch.hasDiscount) response += `\n\nIt's currently on sale!`;
        } else {
          response = `I found ${validProducts.length} products for you! Here are some highlights:\n\n`;
          response += validProducts.slice(0, 3).map(p => 
            `• ${p.name} - ₦${p.minPrice?.toLocaleString()}${p.hasDiscount ? ' (On Sale!)' : ''}`
          ).join('\n');
        }
      } else {
        response = await generateFallbackResponse(query, intent, knowledgeContext);
      }
    }

    return {
      response,
      products: shouldShowProducts(intent, validProducts.length, validProducts, query) ? validProducts.slice(0, 4).map(p => ({
        id: p._id, 
        name: p.name, 
        slug: p.slug, 
        type: p.type,
        minPrice: p.minPrice, 
        hasDiscount: p.hasDiscount,
        image: (p.images && p.images.length > 0) ? (p.images[0].url || p.images[0]) : null,
        // Include size/variant information if available
        sizes: p.sizes ? p.sizes.slice(0, 5).map(s => ({
          id: s._id,
          name: s.name,
          size: s.size,
          volumeMl: s.volumeMl,
          price: s.pricing?.websitePrice || s.pricing?.sellingPrice || p.minPrice,
          originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.sellingPrice,
          discount: s.discount?.value || 0
        })) : (p.subProducts?.[0]?.sizes || []).slice(0, 5).map(s => ({
          id: s._id,
          name: s.name,
          size: s.size,
          volumeMl: s.volumeMl,
          price: s.pricing?.websitePrice || s.pricing?.sellingPrice || p.minPrice,
          originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.sellingPrice,
          discount: s.discount?.value || 0
        }))
      })) : [],
      quickReplies: buildQuickReplies(intent, validProducts),
      intent: intent.type,
      hasProducts: validProducts.length > 0
    };

  } catch (error) {
    console.error('Chatbot Error:', error);
    return getGreetingResponse();
  }
};

// Should show products based on intent and relevance
const shouldShowProducts = (intent, productCount, products = [], query = '') => {
  return productCount > 0;
};

// Handle image-based queries (single or multiple)
const handleImageQuery = async (imageUrls, userQuery = '', tenantId = null) => {
  // Ensure it's an array
  const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  try {
    // Analyze first image or all images
    const analyses = [];
    
    for (const imageUrl of imageUrls) {
      const analysis = await analyzeImage(imageUrl, userQuery || 'What drink is this? Be brief.');
      if (analysis) {
        analyses.push(analysis);
      }
    }

    if (analyses.length === 0) {
      return {
        response: "Couldn't analyze the images. Try describing what you're looking for!",
        products: [],
        quickReplies: ['Search by name', 'Browse wines', 'Browse beers'],
        intent: 'image_query'
      };
    }

    // Combine analyses
    const combinedAnalysis = analyses.length === 1 
      ? analyses[0] 
      : `Here are the ${analyses.length} drinks I identified:\n\n${analyses.map((a, i) => `**Drink ${i + 1}:**\n${a}`).join('\n\n')}`;

    // Extract product names and search for all
    const allProducts = [];
    
    for (const analysis of analyses) {
      const productName = extractProductNameFromAnalysis(analysis);
      if (productName) {
        const intent = extractIntent(productName);
        const products = await queryProducts(intent.filters, productName, 3, null, tenantId);
        allProducts.push(...products);
      }
    }

    // Remove duplicates
    const uniqueProducts = allProducts.filter((p, i, arr) => 
      arr.findIndex(x => x._id.toString() === p._id.toString()) === i
    );

    let response = combinedAnalysis;
    
    if (uniqueProducts.length > 0) {
      response += `\n\n🛒 **Available at DrinksHarbour:**\n\n`;
      response += uniqueProducts.slice(0, 3).map((p, i) => 
        `• **${p.name}** - ₦${(p.minPrice || 0).toLocaleString()}`
      ).join('\n');
    }

    return {
      response,
      products: uniqueProducts.slice(0, 4).map(p => ({
        id: p._id, name: p.name, slug: p.slug, type: p.type,
        minPrice: p.minPrice, image: p.images?.[0]?.url
      })),
      quickReplies: ['View products', 'Search similar', 'Browse catalog'],
      intent: 'image_analysis',
      imageAnalyzed: true
    };

  } catch (error) {
    console.error('Image Query Error:', error);
    return {
      response: "I couldn't analyze the image. Could you describe what drink you're looking for?",
      products: [],
      quickReplies: ['Search by name', 'Browse wines', 'Browse beers', 'Contact support'],
      intent: 'image_query'
    };
  }
};

// Handle file-based queries (drink lists)
const handleFileQuery = async (fileContent, fileName, userQuery, tenantId = null) => {
  try {
    // Parse the drink list from file content
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    const drinkItems = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 2) continue;
      
      // Skip common headers
      const lowerLine = trimmed.toLowerCase();
      if (lowerLine.includes('item') && (lowerLine.includes('quantity') || lowerLine.includes('price') || lowerLine.includes('amount'))) continue;
      if (lowerLine === 'name' || lowerLine === 'description' || lowerLine === 'drinks' || lowerLine === 'products') continue;
      if (trimmed.match(/^[-=]+$/)) continue;
      
      let quantity = 1;
      let name = trimmed;
      
      // Try different patterns
      // "2 Heineken" or "2x Heineken"
      let match = trimmed.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      if (match) {
        quantity = parseInt(match[1]);
        name = match[2].trim();
      } else {
        // "Heineken (2)" or "Heineken - 2"
        match = trimmed.match(/^(.+?)\s*[-–—]\s*(\d+)$/);
        if (match) {
          quantity = parseInt(match[2]);
          name = match[1].trim();
        } else {
          // "2. Heineken" (numbered list)
          match = trimmed.match(/^\d+[.)\]]\s*(.+)$/);
          if (match) {
            name = match[1].trim();
          }
        }
      }
      
      // Clean up name
      name = name.replace(/^[-–—.,\s]+|[-–—.,\s]+$/g, '').trim();
      
      if (name.length > 1) {
        drinkItems.push({ quantity, name });
      }
    }

    if (drinkItems.length === 0) {
      return {
        response: "Couldn't read the file. Make sure each drink is on a separate line like:\n2 Heineken\n1 Red Wine\n3 Star Lager",
        products: [],
        intent: 'file_query'
      };
    }

    // Search for each item in the database
    const allProducts = [];
    const notFound = [];
    
    for (const item of drinkItems) {
      const intent = extractIntent(item.name);
      const products = await queryProducts(intent.filters, item.name, 2, null, tenantId);
      
      if (products.length > 0) {
        allProducts.push({
          requested: item.name,
          quantity: item.quantity,
          found: products.map(p => ({
            ...p,
            requestedQuantity: item.quantity,
            totalPrice: (p.minPrice || 0) * item.quantity
          }))
        });
      } else {
        notFound.push(item);
      }
    }

    // Build short response
    let response = `📄 Processed ${drinkItems.length} item${drinkItems.length > 1 ? 's' : ''}:\n\n`;
    
    let totalOrder = 0;
    const foundItems = [];
    
    for (const item of allProducts) {
      const product = item.found[0];
      const price = product.minPrice || 0;
      const total = price * item.quantity;
      totalOrder += total;
      foundItems.push(`• ${item.requested} x${item.quantity} = ₦${total.toLocaleString()}`);
    }
    
    if (foundItems.length > 0) {
      response += foundItems.join('\n');
      response += `\n\n**Total: ₦${totalOrder.toLocaleString()}**`;
      
      if (totalOrder < 50000) {
        response += `\nAdd ₦${(50000 - totalOrder).toLocaleString()} more for FREE delivery!`;
      }
    }
    
    if (notFound.length > 0) {
      const notFoundNames = notFound.map(n => n.name).join(', ');
      response += `\n\n❌ Not found: ${notFoundNames}`;
      response += `\nWant me to find alternatives?`;
    }

    return {
      response,
      products: allProducts.flatMap(p => p.found.slice(0, 1)).slice(0, 6).map(p => ({
        id: p._id, name: p.name, slug: p.slug, type: p.type,
        minPrice: p.minPrice, image: p.images?.[0]?.url
      })),
      intent: 'file_query',
      fileProcessed: true,
      orderSummary: {
        itemsFound: allProducts.length,
        itemsNotFound: notFound.length,
        totalItems: drinkItems.length,
        totalPrice: totalOrder
      }
    };

  } catch (error) {
    console.error('File Query Error:', error);
    return {
      response: "I had trouble processing that file. Please try again or enter items manually.",
      products: [],
      quickReplies: ['Enter items manually', 'Browse catalog', 'Contact support'],
      intent: 'file_query'
    };
  }
};

// Extract product name from AI analysis
const extractProductNameFromAnalysis = (analysis) => {
  // Try to match "Brand & Name:" or "Brand:" from our new vision prompt format
  const structuredMatch = analysis.match(/\*\*(?:Brand & Name|Brand|Name):\*\*\s*([^\n]+)/i);
  if (structuredMatch) {
    return structuredMatch[1].trim();
  }
  
  const patterns = [
    /(?:I identified a|This is a|Looks like a)\s+([A-Za-z0-9\s\-\']+?)(?:\.|,|$)/i,
    /similar to (.+?)(?:\.|,|$)/i,
    /like the (.+?)(?:\.|,|$)/i,
    /maybe (.+?)(?:\.|,|$)/i,
    /product.*?named? (.+?)(?:\.|,|$)/i
  ];

  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
};

// Generate fallback response using knowledge base
const generateFallbackResponse = async (query, intent, knowledgeContext) => {
  const lowerQuery = query.toLowerCase().trim();
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'what\'s up', 'sup'];
  
  if (greetings.some(g => lowerQuery === g || lowerQuery.startsWith(g + ' '))) {
    return getGreeting();
  }

  const knowledge = knowledgeContext || await generateKnowledgeResponse(query, intent);
  
  if (knowledge) {
    return `I'd love to help you find the perfect drink! While I don't have exact matches for "${query}" in our catalog right now, here's some helpful information:\n\n${knowledge}\n\nWould you like me to search for something specific, or browse our categories?`;
  }

  return "I'm here to help you find the perfect drink! Browse our categories or let me know what type of beverage you're looking for. We have wines, beers, spirits, and more!";
};

// Get greeting response
const getGreetingResponse = () => ({
  response: getGreeting(),
  products: [],
  quickReplies: ['Wines', 'Beers', 'Spirits', 'Events', 'Deals'],
  categories: [
    { name: 'Wine', icon: '🍷', slug: 'wine' },
    { name: 'Beer', icon: '🍺', slug: 'beer' },
    { name: 'Spirits', icon: '🥃', slug: 'spirit' },
    { name: 'Champagne', icon: '🍾', slug: 'champagne' }
  ],
  intent: 'greeting'
});

const getGreeting = () => {
  const greetings = [
    "👋 Hi! I'm your DrinksHarbour assistant.\n\nI can help you find drinks, check prices, plan events & more. What are you looking for?",
    "🎉 Welcome to DrinksHarbour!\n\nNeed help finding drinks? Just ask! 🍷🍺",
    "🥃 Hey! Your beverage assistant here.\n\nAsk me about wines, beers, spirits or plan your next event!",
    "👋 Hi there!\n\nI help with drinks, prices & event planning. What do you need?"
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
};

// Build quick replies
const buildQuickReplies = (intent, products) => {
  const replies = [];
  if (products.length > 0) {
    replies.push(`Show ${products[0]?.name}`);
  }
  replies.push('View all wines', 'Current discounts', 'Help me choose');
  return replies;
};

// Generate product details
const generateProductDetails = async (productId) => {
  try {
    const product = await Product.findById(productId)
      .populate('brand', 'name')
      .populate({ path: 'subProducts', populate: [{ path: 'tenant' }, { path: 'sizes' }] })
      .lean();

    if (!product) return { error: 'Product not found' };

    let details = `📦 **${product.name}**\n`;
    if (product.brand?.name) details += `- **Brand:** ${product.brand.name}\n`;
    if (product.type) details += `- **Type:** ${product.type}\n`;
    if (product.abv) details += `- **ABV:** ${product.abv}%\n`;
    if (product.originCountry) details += `- **Origin:** ${product.originCountry}\n`;
    if (product.flavorNotes && product.flavorNotes.length > 0) details += `- **Notes:** ${product.flavorNotes.join(', ')}\n`;
    if (product.description) details += `\n> ${product.description}\n`;

    if (product.subProducts?.length > 0) {
      details += `\n💰 **Pricing:**\n`;
      product.subProducts.forEach(sp => {
        const price = sp.baseSellingPrice || 0;
        details += `   - ${sp.tenant?.name || 'DrinksHarbour'}: ₦${price.toLocaleString()}`;
        if (sp.discount > 0) details += ` (${sp.discount}% off!)`;
        details += '\n';
      });
    }

    const response = await callOllama(
      `Summarize these drink details into a compelling, 2-3 sentence overview for a customer. Highlight the brand, type, key flavors, and the best available price:\n\n${details}`,
      'You are DrinksHarbour AI, an engaging beverage expert.'
    );

    return { response: response || details, product };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  handleChatbotQuery,
  generateProductDetails,
  analyzeImage,
  extractIntent,
  queryProducts,
  beverageKnowledgeBase
};
