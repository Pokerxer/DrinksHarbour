// server/services/chatbot.service.js
// Enhanced Chatbot Service using Ollama Cloud API for DrinksHarbour Multi-tenant Platform
// Supports: Text queries, Image analysis, Database products, General beverage knowledge

const mongoose = require('mongoose');

const Product = mongoose.models.Product || mongoose.model('Product');
const SubProduct = mongoose.models.SubProduct || mongoose.model('SubProduct');
const Size = mongoose.models.Size || mongoose.model('Size');
const Category = mongoose.models.Category || mongoose.model('Category');
const Tenant = mongoose.models.Tenant || mongoose.model('Tenant');

// Ollama Cloud Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'kimi-k2.5:cloud';

// Call Ollama Cloud API with streaming support
const callOllama = async (prompt, systemPrompt = null, onChunk = null) => {
  const defaultSystemPrompt = `You are DrinksHarbour AI - a friendly beverage expert for DrinksHarbour.com, Nigeria's top drinks store.

🎯 STYLE:
- Keep responses SHORT and conversational (2-3 sentences max)
- Use emojis naturally
- Be specific about brands and prices
- Get to the point quickly
- Sound like a knowledgeable friend

💰 PRICING:
- Always include prices in ₦

🔄 REPLACEMENTS:
- If product not available, suggest 1-2 alternatives

Remember: Be helpful, quick, and human-like!`;

  const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;

    // If streaming callback provided, use streaming
    if (onChunk) {
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
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message?.content) {
                fullContent += data.message.content;
                onChunk(data.message.content);
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      return fullContent;
    }

    // Non-streaming version
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

    const prompt = contextPrompt || `Analyze this beverage image. Identify: 
1. What drink is shown (brand, type, name)
2. Size/volume if visible
3. Alcohol type (wine, beer, spirit, etc.)
4. Any other visible details

If you recognize the drink, suggest similar products. Be specific about the brand.`;

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
  if (lowerQuery.includes('party') || lowerQuery.includes('event') || lowerQuery.includes('celebration') || lowerQuery.includes('wedding')) {
    intent.type = 'event';
    intent.filters.isEvent = true;
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
    'wine', 'red wine', 'white wine', 'rose wine', 'champagne', 'prosecco', 'sparkling',
    'beer', 'lager', 'ale', 'stout', 'porter', 'ipa', 'craft beer',
    'whiskey', 'whisky', 'bourbon', 'scotch', 'rye',
    'vodka', 'gin', 'rum', 'tequila', 'mezcal', 'cognac', 'brandy',
    'cider', 'sake', 'sherry', 'port', 'vermouth',
    'soft drink', 'water', 'juice', 'energy drink', 'soda', 'tonic'
  ];
  
  for (const type of beverageTypes) {
    if (lowerQuery.includes(type)) {
      intent.filters.type = type.replace(/ /g, '_');
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

// Build MongoDB query
const buildProductQuery = (filters, searchQuery, brand = null) => {
  const query = { status: 'approved' };

  if (searchQuery) {
    const regex = new RegExp(searchQuery, 'i');
    query.$or = [
      { name: regex },
      { description: regex }
    ];
  }

  // Brand filter - query Brand model to get IDs, then filter products
  if (brand) {
    query.brand = brand; // Will be replaced with ObjectIds after brand lookup
    query._brandSearch = brand; // Mark for post-processing
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
    query.type = { $in: types };
  }

  if (filters.minAbv) query.abv = { $gte: filters.minAbv };
  if (filters.maxAbv) query.abv = { ...query.abv, $lte: filters.maxAbv };

  return query;
};

// Query products from database
const queryProducts = async (filters, searchQuery, limit = 10, brand = null) => {
  let productQuery = buildProductQuery(filters, searchQuery, brand);
  
  // If brand is specified, lookup brand IDs from Brand model
  if (brand && productQuery._brandSearch) {
    try {
      const Brand = require('../models/Brand');
      const brandDocs = await Brand.find({
        name: { $regex: new RegExp(brand, 'i') }
      }).select('_id').lean();
      
      const brandIds = brandDocs.map(b => b._id);
      
      if (brandIds.length > 0) {
        productQuery.brand = { $in: brandIds };
      }
      delete productQuery._brandSearch;
    } catch (err) {
      console.error('Brand lookup error:', err);
      delete productQuery.brand;
      delete productQuery._brandSearch;
    }
  }

  let products = await Product.find(productQuery)
    .select('name slug type subType description abv volumeMl originCountry region brand images tags averageRating reviewCount flavorNotes')
    .limit(limit * 2)
    .lean();

  const productIds = products.map(p => p._id);
  
  const subProductQuery = {
    product: { $in: productIds },
    status: 'active'
  };
  
  if (filters.maxPrice) {
    subProductQuery.baseSellingPrice = { $lte: filters.maxPrice };
  }
  if (filters.minPrice) {
    subProductQuery.baseSellingPrice = { ...subProductQuery.baseSellingPrice, $gte: filters.minPrice };
  }
  
  const subProducts = await SubProduct.find(subProductQuery)
    .populate('tenant', 'name slug logo')
    .populate('sizes', 'name size volumeMl')
    .lean();

  const subProductMap = {};
  subProducts.forEach(sp => {
    if (!subProductMap[sp.product]) subProductMap[sp.product] = [];
    subProductMap[sp.product].push(sp);
  });

  return products.map(p => {
    const sps = (subProductMap[p._id] || []).filter(sp => sp.stockStatus !== 'out_of_stock');
    
    const minPrice = sps.length > 0 ? Math.min(...sps.map(sp => sp.baseSellingPrice || 0)) : 0;
    const maxPrice = sps.length > 0 ? Math.max(...sps.map(sp => sp.baseSellingPrice || 0)) : 0;
    const totalStock = sps.reduce((sum, sp) => sum + (sp.availableStock || 0), 0);
    const hasDiscount = sps.some(sp => (sp.discount || 0) > 0);
    const sellers = [...new Set(sps.map(sp => sp.tenant?.name).filter(Boolean))];

    return {
      ...p,
      subProducts: sps,
      minPrice,
      maxPrice,
      totalStock,
      hasDiscount,
      sellers,
      hasMultipleSellers: sellers.length > 1
    };
  })
  .filter(p => p.totalStock > 0)
  .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
  .slice(0, limit);
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
  
  return `Available: ` + 
    products.slice(0, 5).map((p) => {
      return `${p.name} - ₦${(p.minPrice || 0).toLocaleString()}`;
    }).join(', ');
};

// Main chatbot query handler with streaming support
const handleChatbotQuery = async (options, onStream = null) => {
  const { query, imageUrls, imageUrl, tenantId, conversationHistory = [], fileContent, fileName } = options;

  // Support both single imageUrl and multiple imageUrls
  const images = imageUrls || (imageUrl ? [imageUrl] : []);

  if (!query || query.trim().length < 1) {
    return getGreetingResponse();
  }

  try {
    // Handle image query (single or multiple)
    if (images.length > 0) {
      return await handleImageQuery(images, query);
    }

    // Handle file content (drink list)
    if (fileContent) {
      return await handleFileQuery(fileContent, fileName, query);
    }

    const intent = extractIntent(query);
    const searchTerm = intent.keywords.length > 0 ? intent.keywords.join(' ') : null;
    const products = await queryProducts(intent.filters, searchTerm, 10, intent.brand);
    const productContext = generateProductContext(products);

    // Get general knowledge if no products found
    const knowledgeContext = products.length === 0 ? await generateKnowledgeResponse(query, intent) : '';

    let systemPrompt = `You are DrinksHarbour AI - a friendly beverage expert for DrinksHarbour.com, Nigeria's top drinks store.

${productContext}

🎯 STYLE - BE HUMAN:
- Keep responses SHORT and conversational (2-3 sentences max for simple questions)
- Use emojis naturally
- Get to the point quickly
- Sound like a knowledgeable friend

💰 PRICING:
- Always include prices in ₦

🔄 REPLACEMENTS:
- If product not available, suggest 1-2 alternatives quickly
- Example: "No Heineken, but Star (₦11,517) is similar and popular"

🎉 EVENTS:
- Ask guest count, budget, preferences
- Quick estimate: 1 bottle = 8-10 drinks

${knowledgeContext}

Remember: Be helpful, quick, and human-like!`;

    // Build conversation
    const recentMessages = conversationHistory.slice(-6).map(m => 
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const fullPrompt = recentMessages ? `${recentMessages}\n\nUser: ${query}` : query;

    let response;
    
    // Use streaming if callback provided
    if (onStream) {
      response = await callOllama(fullPrompt, systemPrompt, onStream);
    } else {
      response = await callOllama(fullPrompt, systemPrompt);
    }

    // Fallback responses
    if (!response) {
      if (products.length > 0) {
        response = `I found ${products.length} products for you! Here are some highlights:\n\n`;
        response += products.slice(0, 3).map(p => 
          `• ${p.name} - ₦${p.minPrice?.toLocaleString() || 'Contact for price'}${p.hasDiscount ? ' (On Sale!)' : ''}`
        ).join('\n');
      } else {
        response = await generateFallbackResponse(query, intent, knowledgeContext);
      }
    }

    return {
      response,
      products: shouldShowProducts(intent, products.length, products, query) ? products.slice(0, 4).map(p => ({
        id: p._id, name: p.name, slug: p.slug, type: p.type,
        minPrice: p.minPrice, hasDiscount: p.hasDiscount,
        image: p.images?.[0]?.url
      })) : [],
      quickReplies: buildQuickReplies(intent, products),
      intent: intent.type,
      hasProducts: products.length > 0
    };

  } catch (error) {
    console.error('Chatbot Error:', error);
    return getGreetingResponse();
  }
};

// Should show products based on intent and relevance
const shouldShowProducts = (intent, productCount, products = [], query = '') => {
  // Don't show products for greetings
  const lowerQuery = query.toLowerCase().trim();
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'what\'s up', 'sup'];
  if (greetings.some(g => lowerQuery === g || lowerQuery.startsWith(g + ' '))) {
    return false;
  }
  
  // Don't show products if no products found
  if (productCount === 0) return false;
  
  // Show products if there are keywords (type or brand) even if intent is 'general'
  if (intent.keywords.length > 0 || intent.filters.type || intent.brand) {
    return true;
  }
  
  // Don't show products for general conversational queries without keywords
  const conversationalPatterns = ['how are you', 'what can you do', 'help me', 'who are you'];
  if (conversationalPatterns.some(p => lowerQuery.includes(p))) {
    return false;
  }
  
  // Default: show products if we found any
  return productCount > 0;
  
  // If brand was specified, ensure at least some products match
  if (intent.brand && products.length > 0) {
    const brandMatch = products.some(p => 
      p.brand && p.brand.toLowerCase().includes(intent.brand.toLowerCase())
    );
    if (!brandMatch) return false;
  }
  
  // If type was specified, ensure products match the type
  if (intent.filters.type && products.length > 0) {
    const typeMatch = products.some(p => 
      p.type && p.type.toLowerCase().includes(intent.filters.type.toLowerCase().replace('_', ' '))
    );
    if (!typeMatch) return false;
  }
  
  // Don't show products if no specific filters and no keywords (general browse)
  if (!intent.filters.type && intent.keywords.length === 0) return false;
  
  return true;
};

// Handle image-based queries (single or multiple)
const handleImageQuery = async (imageUrls, userQuery = '') => {
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
      : `Here are ${analyses.length} drinks I identified:\n\n${analyses.map((a, i) => `${i + 1}. ${a.substring(0, 200)}`).join('\n\n')}`;

    // Extract product names and search for all
    const allProducts = [];
    
    for (const analysis of analyses) {
      const productName = extractProductNameFromAnalysis(analysis);
      if (productName) {
        const intent = extractIntent(productName);
        const products = await queryProducts(intent.filters, productName, 3);
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
      response += `\n\nWant me to add any to your cart?`;
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
const handleFileQuery = async (fileContent, fileName, userQuery) => {
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
      const products = await queryProducts(intent.filters, item.name, 2);
      
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
  const patterns = [
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
      .populate({ path: 'subProducts', populate: [{ path: 'tenant' }, { path: 'sizes' }] })
      .lean();

    if (!product) return { error: 'Product not found' };

    let details = `📦 ${product.name}\n`;
    if (product.brand) details += `🏷️ Brand: ${product.brand}\n`;
    if (product.type) details += `🍾 Type: ${product.type}\n`;
    if (product.abv) details += `🔥 ABV: ${product.abv}%\n`;
    if (product.originCountry) details += `🌍 Origin: ${product.originCountry}\n`;
    if (product.description) details += `\n📝 ${product.description}\n`;

    if (product.subProducts?.length > 0) {
      details += `\n💰 Pricing:\n`;
      product.subProducts.forEach(sp => {
        const price = sp.baseSellingPrice || 0;
        details += `• ${sp.tenant?.name || 'DrinksHarbour'}: ₦${price.toLocaleString()}`;
        if (sp.discount > 0) details += ` (${sp.discount}% off)`;
        details += '\n';
      });
    }

    const response = await callOllama(
      `Provide detailed info about this drink:\n\n${details}`,
      'You are DrinksHarbour AI, a beverage expert.'
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
