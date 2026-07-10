// server/services/chatbot.service.js
// Chatbot Service using Claude Haiku for DrinksHarbour Multi-tenant Platform
// Supports: Text queries, Image analysis, Database products, General beverage knowledge

const mongoose = require('mongoose');
const https = require('https');
const productService = require('./product.service');
const Anthropic = require('@anthropic-ai/sdk');

const Product = mongoose.models.Product || mongoose.model('Product');
const SubProduct = mongoose.models.SubProduct || mongoose.model('SubProduct');
const Size = mongoose.models.Size || mongoose.model('Size');
const Category = mongoose.models.Category || mongoose.model('Category');
const Tenant = mongoose.models.Tenant || mongoose.model('Tenant');

// Claude AI Configuration
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const CLAUDE_MODEL = 'claude-haiku-4-5';

// ── Web Search via Serper.dev ────────────────────────────────────────────────
const searchWeb = async (query) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  return new Promise((resolve) => {
    const body = JSON.stringify({ q: query, num: 5 });
    const req = https.request({
      hostname: 'google.serper.dev',
      path: '/search',
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = [];

          // Knowledge Graph (best for brand/product info)
          if (json.knowledgeGraph) {
            const kg = json.knowledgeGraph;
            results.push(`**${kg.title}** — ${kg.description || ''}`);
            if (kg.attributes) {
              Object.entries(kg.attributes).slice(0, 5).forEach(([k, v]) => results.push(`${k}: ${v}`));
            }
          }

          // Organic results
          if (json.organic) {
            json.organic.slice(0, 4).forEach(r => {
              results.push(`• ${r.title}: ${r.snippet}`);
            });
          }

          resolve(results.length > 0 ? results.join('\n') : null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
};

// Call Claude Haiku — supports multi-turn conversation history
const callClaude = async (prompt, systemPrompt = null, conversationHistory = []) => {
  const finalSystemPrompt = systemPrompt || BASE_SYSTEM_PROMPT;
  try {
    // Build messages: history (last 10 turns) + current user message.
    // System prompt goes in the top-level `system` param, not the messages array.
    const messages = [
      ...conversationHistory.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      temperature: 0.65,
      system: finalSystemPrompt,
      messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || null;
  } catch (error) {
    console.error('Claude AI Error:', error.message);
    return null;
  }
};

// Base system prompt (used when no product context is available)
const BASE_SYSTEM_PROMPT = `You are DrinksHarbour AI — the friendly, expert beverage assistant for DrinksHarbour.com, Nigeria's premier drinks marketplace.

PERSONA:
- You are a world-class beverage expert — sommelier-level knowledge of wines, spirits, beers, cocktails, AND non-alcoholic drinks (juices, mocktails, soft drinks, malt drinks, energy drinks, alcohol-free wines and beers).
- Your #1 mission is customer satisfaction: be genuinely helpful, never dismissive, always leave the customer with a clear next step.
- Warm, passionate, and detailed when explaining drinks. Sound like a knowledgeable Nigerian drinks connoisseur.
- Use emojis naturally (🍷🍺🥃🎉) but don't overdo it.
- If a customer is unhappy or has an issue (delivery, wrong item, refund), apologize sincerely and direct them to the support page or their order history — never argue.

FORMAT RULES:
- Use **bold** for product names and prices.
- Use bullet points (•) when listing 3+ items — one item per line, keep each line short.
- Use numbered lists (1. 2. 3.) for step-by-step instructions or ranked picks.
- Always show prices in ₦ with commas e.g. ₦12,500.
- For shopping lists, price breakdowns, and side-by-side comparisons, use a markdown table:
| Product | Size | Qty | Price | Total |
|---|---|---|---|---|
| **Product Name** | 75cl | 2 | ₦12,500 | ₦25,000 |
Then a **Grand Total: ₦…** line right after the table.
- For product deep-dives: use sections like **About**, **Tasting Notes**, **Food Pairings**, **Serving Tips**.

STRICT PRICING RULES (ALWAYS ENFORCED):
1. ❌ NEVER invent or guess prices or availability. All prices MUST come from the CATALOG DATA only.
2. ❌ NEVER suggest a product is in stock if it's not in the catalog.
3. ✅ ONLY quote prices that appear in the CATALOG DATA provided in this prompt.
4. If CATALOG DATA is empty: say you couldn't find it in stock right now and suggest browsing /shop.

KNOWLEDGE RULES:
5. ✅ For product descriptions, history, tasting notes, food pairings, cocktail recipes, and beverage education — use your full expert knowledge freely. This is what you excel at.
6. ✅ When a customer asks "tell me more" about a product in the catalog — give a rich, expert-level breakdown: origin story, production method, flavor profile, food pairings, best serving temperature, glassware, and any fun facts.
7. ✅ You may reference general beverage knowledge (e.g. "Chardonnay grapes originated in Burgundy, France") even if not explicitly in the catalog.
8. For event planning: ask for guest count + budget first, then recommend from catalog only.`;

// Instructs the model to offer adding discussed products to the cart and to emit
// a machine-readable last line (same pattern as IDENTIFIED_JSON for vision).
const CART_OFFER_INSTRUCTIONS = `
ADD-TO-CART OFFER:
- When your reply recommends or discusses SPECIFIC purchasable products from the CATALOG DATA (a recommendation, an event shopping list, a gift idea, a deal, or a confirmed in-stock item), end your reply by asking the customer if they'd like you to add them to their cart (e.g. "Want me to add these to your cart? 🛒").
- Then output on the very last line (nothing after it) exactly:
CART_JSON: [{"name":"<product name EXACTLY as written in CATALOG DATA>","size":"<size label from the catalog e.g. 75cl, or null>","qty":<integer quantity discussed, default 1>}]
- Include one object per product, with the quantities you recommended (e.g. event plans list each product with its bottle count).
- ONLY include products that appear in the CATALOG DATA. Maximum 10 items.
- If your reply doesn't recommend specific purchasable products (greetings, cocktail recipes without catalog spirits, support issues, questions back to the customer), do NOT ask about the cart and do NOT output a CART_JSON line.
- Never mention CART_JSON or JSON to the customer.
- CRITICAL: You CANNOT add items to the cart yourself — the app adds them only after the customer taps the confirm button. NEVER say or imply that you have already added anything to the cart.
- If the customer agrees to your cart offer (says yes/okay/go ahead), briefly restate the item(s) and quantities, tell them to tap the "Yes, add to cart" button below to confirm, and output the CART_JSON line again with the final agreed items.`;

// Parse + strip the CART_JSON line and resolve item names against the products
// found for this query. Returns { text, proposal } — proposal only contains
// items that matched a real product (with slug) so the client can add them.
const extractCartProposal = (responseText, validProducts = []) => {
  if (!responseText) return { text: responseText, proposal: [] };
  // Tolerate code fences and trailing text after the JSON block
  const match = responseText.match(/CART_JSON:\s*(\[[\s\S]*?\])/);
  const text = match
    ? (responseText.slice(0, match.index) + responseText.slice(match.index + match[0].length))
        .replace(/```(json)?\s*```/g, '')
        .replace(/```(json)?\s*$/g, '')
        .trim()
    : responseText.trim();
  if (!match) return { text, proposal: [] };

  let items = [];
  try { items = JSON.parse(match[1]); } catch { return { text, proposal: [] }; }
  if (!Array.isArray(items)) return { text, proposal: [] };

  const proposal = [];
  for (const item of items.slice(0, 10)) {
    const name = (item?.name || '').trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    const product = validProducts.find(p => (p.name || '').toLowerCase() === lower)
      || validProducts.find(p => (p.name || '').toLowerCase().includes(lower) || lower.includes((p.name || '').toLowerCase()));
    if (!product || !product.slug) continue;
    const qty = Math.max(1, Math.min(99, parseInt(item.qty, 10) || 1));
    proposal.push({
      id: product._id?.toString?.() || product._id || product.id,
      slug: product.slug,
      name: product.name,
      size: typeof item.size === 'string' && item.size.trim() ? item.size.trim() : null,
      qty,
      price: product.minPrice || 0,
      image: product.image || (product.images?.[0]?.url || product.images?.[0]) || null,
    });
  }
  return { text, proposal };
};

// Analyze image using Claude Haiku vision
const analyzeImage = async (imageUrl, userContext = '') => {
  if (!imageUrl) return null;

  // Normalize to base64 data URL
  let mimeType = 'image/jpeg';
  let base64Data = null;

  if (imageUrl.startsWith('data:')) {
    const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    mimeType = matches[1];
    base64Data = matches[2];
  } else if (imageUrl.startsWith('http')) {
    try {
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) return null;
      const buf = await imageRes.arrayBuffer();
      base64Data = Buffer.from(buf).toString('base64');
      mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
    } catch { return null; }
  } else {
    base64Data = imageUrl; // assume raw base64
  }

  if (!base64Data || base64Data.length < 100) return null;

  // Warn if image is very large (Claude's vision limit is ~5MB per image)
  if (base64Data.length > 5_000_000) {
    console.warn(`analyzeImage: large image (${Math.round(base64Data.length / 1024)}KB base64), may fail`);
  }

  // Always use the structured analysis prompt; append user context as a follow-up note
  const analysisPrompt = `You are an expert beverage analyst for DrinksHarbour, a Nigerian drinks marketplace. Carefully examine this image and identify the drink(s) shown.

1. **Brand & Name:** What is the exact brand and product name? Read the label carefully.
2. **Type:** Wine, beer, whiskey, vodka, gin, rum, tequila, champagne, cognac, etc.?
3. **Volume/Size:** Can you see a bottle size on the label (e.g., 70cl, 75cl, 1L)?
4. **Appearance:** Describe the bottle, label color, any age statement or edition visible.
5. **Your Assessment:** What do you know about this product — origin, taste profile, typical price range?

Be as precise as possible with the brand name so it can be searched in our catalog.${userContext ? `\n\nCustomer's question: "${userContext}"` : ''}

After your analysis, output on the very last line (nothing after it) exactly:
IDENTIFIED_JSON: {"name":"<full product name>","brand":"<brand only>","type":"<one of: wine|champagne|beer|whiskey|vodka|gin|rum|tequila|cognac|liqueur|non_alcoholic|other>","subType":"<style e.g. red wine, single malt, IPA>","abv":<number or null>,"estimatedPriceNgn":<typical Nigerian retail price in naira for this bottle, number or null>}
Use null for anything you cannot determine.`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
          { type: 'text', text: analysisPrompt },
        ],
      }],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    if (textBlock?.text) {
      const raw = textBlock.text;
      let identified = null;
      const jsonMatch = raw.match(/IDENTIFIED_JSON:\s*(\{[\s\S]*\})/);
      if (jsonMatch) {
        try { identified = JSON.parse(jsonMatch[1]); } catch { /* keep prose only */ }
      }
      const text = raw.replace(/IDENTIFIED_JSON:\s*\{[\s\S]*\}\s*$/, '').trim();
      return { text, identified };
    }
  } catch (err) {
    console.error(`analyzeImage: Claude vision failed — ${err.message}`);
  }

  return null;
};

// Extract intent and filters from query
const extractIntent = (query, conversationHistory = []) => {
  const lowerQuery = query.toLowerCase().trim();
  const intent = { type: 'general', keywords: [], filters: {}, brand: null, isGreeting: false, isEvent: false, isOnSale: false, isFollowUp: false };

  // ── Greeting detection ───────────────────────────────────────────────────
  const greetingWords = ['hello', 'hi', 'hey', 'howdy', 'good morning', 'good afternoon', 'good evening', "what's up", 'sup', 'hiya', 'yo', 'oya', 'how far'];
  if (greetingWords.some(g => lowerQuery === g || lowerQuery.startsWith(g + ' ') || lowerQuery.startsWith(g + ','))) {
    intent.isGreeting = true;
    intent.type = 'greeting';
    return intent;
  }

  // ── Short follow-up reaction detection (needs conversation context) ────────
  const isShortReaction = lowerQuery.length < 50 && conversationHistory.length > 0;
  const followUpPatterns = [
    /^(wow|nice|great|cool|ok|okay|i see|understood|noted|thanks|thank you|perfect|amazing|lovely|good|lol)/,
    /tell me more|more details|more info|elaborate|explain more/,
    /add to cart|i('ll| will) take|i want (it|that|this|one)|buy (it|that)/,
    /what about|how about|any other/,
  ];
  if (isShortReaction && followUpPatterns.some(p => p.test(lowerQuery))) {
    intent.isFollowUp = true;
    // Don't return early — let downstream use history context
  }

  // ── Event / party detection ──────────────────────────────────────────────
  const eventWords = ['party', 'wedding', 'birthday', 'event', 'celebration', 'owambe', 'get together', 'hangout', 'function', 'dinner', 'reception', 'anniversary', 'guests', 'people'];
  if (eventWords.some(w => lowerQuery.includes(w))) {
    intent.isEvent = true;
    intent.type = 'event_planning';
  }

  // ── Sale / deals detection ───────────────────────────────────────────────
  if (/discount|sale|offer|deal|promo|cheap|affordable|budget|flash sale|on sale/.test(lowerQuery)) {
    intent.isOnSale = true;
    intent.type = 'discount';
    intent.filters.onSale = true;
  }

  // ── Query type detection ─────────────────────────────────────────────────
  if (/price|cost|how much|naira|₦/.test(lowerQuery) && intent.type === 'general') intent.type = 'price';
  if (/available|in stock|stock|do you have|do you sell|carry/.test(lowerQuery) && intent.type === 'general') intent.type = 'availability';
  if (/recommend|suggest|best|top|popular|what should|which one|favourite|what.*good/.test(lowerQuery) && intent.type === 'general') intent.type = 'recommendation';
  if (/tell me (more )?about|more details|what is|describe|info about|more about|history of|background|tasting notes|food pair|what.*taste|how.*taste|flavor|flavour|what.*like/.test(lowerQuery) && intent.type === 'general') intent.type = 'product_info';
  if (/difference|vs\.?|versus|compare|better|compared to/.test(lowerQuery) && intent.type === 'general') intent.type = 'comparison';
  if (/cocktail|mix|recipe|how to make|ingredients/.test(lowerQuery) && intent.type === 'general') intent.type = 'cocktail';
  if (/gift|present|for him|for her|for them/.test(lowerQuery) && intent.type === 'general') intent.type = 'gift';

  // ── Price reaction / complaint detection ────────────────────────────────
  const priceComplaintPatterns = [
    /too (high|expensive|much|pricey|steep)/,
    /can'?t afford|cannot afford/,
    /that'?s (expensive|costly|steep|pricey)/,
    /wow.*(price|expensive|costly)/,
    /\b(cheaper|less expensive|budget|affordable)\b/,
    /any.*(cheaper|less|affordable|budget)/,
    /something.*(cheaper|less|affordable)/,
    /price.*high|high.*price/,
    /out of (my )?budget/,
    /do you have (something|anything|one).*cheaper/,
  ];
  if (priceComplaintPatterns.some(p => p.test(lowerQuery)) && intent.type === 'general') {
    intent.type = 'price_complaint';
    intent.isPriceComplaint = true;
  }

  // ── Brand detection ──────────────────────────────────────────────────────
  const brandAliases = {
    'glen': 'glenfiddich', 'henny': 'hennessy', 'henn': 'hennessy',
    'jw': 'johnnie walker', 'johnny walker': 'johnnie walker', 'johnny': 'johnnie walker',
    'jd': 'jack daniels', 'jack': 'jack daniels',
    'remy': 'remy martin', 'the macallan': 'macallan',
    'grey': 'grey goose', 'bombay sapphire': 'bombay',
    'don': 'don julio', 'cuervo': 'jose cuervo',
    'veuve': 'veuve clicquot', 'dom p': 'dom perignon',
    'captain': 'captain morgan', 'havana': 'havana club',
    'tullamore dew': 'tullamore', 'the glenlivet': 'glenlivet',
  };
  // Apply alias substitution before brand matching
  let resolvedQuery = lowerQuery;
  for (const [alias, canonical] of Object.entries(brandAliases)) {
    if (lowerQuery.includes(alias)) {
      resolvedQuery = resolvedQuery.replace(alias, canonical);
      break;
    }
  }

  const brands = [
    'heineken', 'guinness', 'budweiser', 'bud light', 'stella artois', 'star lager', 'star beer',
    'johnnie walker', 'jack daniels', 'jameson', 'glenfiddich', 'glenlivet', 'macallan', 'chivas',
    'crown royal', 'ballantines', 'famous grouse', 'j&b', 'tullamore', 'bushmills',
    'grey goose', 'absolut', 'smirnoff', 'belvedere', 'ketel one', 'ciroc', 'skyy', 'finlandia',
    'bacardi', 'captain morgan', 'havana club', 'malibu', 'don julio', 'patron', 'jose cuervo',
    'moet', 'veuve clicquot', 'dom perignon', 'mumm', 'prosecco', 'freixenet',
    'corona', 'amstel', 'tuborg', 'carlsberg', 'trophy', 'life beer', 'hero beer',
    'gordon', 'beefeater', 'tanqueray', 'hendricks', 'bombay',
    'hennessy', 'remy martin', 'courvoisier', 'martell',
    'red wine', 'white wine', 'rose wine', 'champagne'
  ];
  for (const brand of brands) {
    if (resolvedQuery.includes(brand)) {
      intent.brand = brand;
      if (!intent.keywords.includes(brand)) intent.keywords.push(brand);
      break;
    }
  }

  // ── Beverage type detection ──────────────────────────────────────────────
  const typeMap = [
    { patterns: ['red wine', 'white wine', 'rose wine', 'rosé'], type: 'wine' },
    { patterns: ['champagne', 'prosecco', 'sparkling'], type: 'champagne' },
    { patterns: ['whiskey', 'whisky', 'bourbon', 'scotch', 'rye'], type: 'whiskey' },
    { patterns: ['vodka'], type: 'vodka' },
    { patterns: ['gin'], type: 'gin' },
    { patterns: ['rum'], type: 'rum' },
    { patterns: ['tequila', 'mezcal'], type: 'tequila' },
    { patterns: ['cognac', 'brandy', 'hennessy', 'remy'], type: 'cognac' },
    { patterns: ['beer', 'lager', 'ale', 'stout', 'porter', 'ipa', 'craft beer'], type: 'beer' },
    { patterns: ['wine'], type: 'wine' },
    { patterns: ['spirit', 'spirits'], type: 'spirit' },
    { patterns: ['cider'], type: 'cider' },
    { patterns: ['juice', 'soft drink', 'soda', 'water', 'non-alcoholic', 'mocktail'], type: 'non_alcoholic' },
  ];

  for (const { patterns, type } of typeMap) {
    if (patterns.some(p => lowerQuery.includes(p))) {
      intent.filters.type = type;
      if (!intent.keywords.includes(type)) intent.keywords.push(type);
      break;
    }
  }

  // ── Strength preference ──────────────────────────────────────────────────
  if (/\bstrong\b|high alcohol|high abv/.test(lowerQuery)) intent.filters.minAbv = 30;
  else if (/\blight\b|low alcohol|mild|easy/.test(lowerQuery)) intent.filters.maxAbv = 10;

  // ── Price ceiling ────────────────────────────────────────────────────────
  // Matches: "under 10000", "below ₦15,000", "less than 20k", "5k budget"
  const priceMatch = lowerQuery.match(/(?:under|below|less than|within|budget of?|max)\s*[₦#]?\s*(\d[\d,]*)\s*(k|thousand)?/i)
    || lowerQuery.match(/[₦#]\s*(\d[\d,]*)\s*(k|thousand)?/i);
  if (priceMatch) {
    let price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (priceMatch[2]) price *= 1000; // "10k" → 10000
    intent.filters.maxPrice = price;
  }

  // Use entire query as a keyword if no specific keywords found
  if (intent.keywords.length === 0 && intent.type !== 'greeting' && query.trim().length > 2) {
    // Strip common stop words and use remainder as search term
    const stopWords = /\b(what|which|do you|have|show|me|some|the|a|an|and|or|is|are|can|could|please|i|want|need|looking for|any|give)\b/gi;
    const cleaned = query.replace(stopWords, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 1) intent.keywords.push(cleaned);
  }

  return intent;
};

// ── Full catalog loader — mirrors exactly what /shop shows ──────────────────
// Cached per tenant. Returns { text, entries }: `text` is the prompt context,
// `entries` carry structured data (category, brand, abv, prices, image) used
// for substitute matching when an identified drink isn't in the catalog.
let _catalogCache = {};
const CATALOG_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const loadCatalog = async (tenantId = null) => {
  const cacheKey = tenantId ? tenantId.toString() : 'all';
  const now = Date.now();
  const cached = _catalogCache[cacheKey];
  if (cached && (now - cached.time) < CATALOG_CACHE_TTL) {
    return cached.value;
  }

  const { calculateSizePricing, calculateSubProductPricing, isDiscountActive } = require('../utils/pricing');

  try {
    const ProductModel = mongoose.models.Product || mongoose.model('Product');
    const SubProductModel = mongoose.models.SubProduct || mongoose.model('SubProduct');
    const SizeModel = mongoose.models.Size || mongoose.model('Size');
    const TenantModel = mongoose.models.Tenant || mongoose.model('Tenant');

    // Step 1: Active tenants (same rule as shop) — fetch pricing fields
    const activeTenants = await TenantModel.find({
      status: 'approved',
      subscriptionStatus: { $in: ['active', 'trialing'] },
    }).select('_id name revenueModel markupPercentage commissionPercentage').lean();
    const activeTenantIds = activeTenants.map(t => t._id);
    const tenantById = {};
    activeTenants.forEach(t => { tenantById[t._id.toString()] = t; });
    const tenantFilter = tenantId ? [tenantId] : activeTenantIds;

    // Step 2: All approved products — include platformMarkup & platformDiscount
    const products = await ProductModel.find({ status: 'approved' })
      .select('name slug type subType category subCategory images platformMarkup platformDiscount abv brand')
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .populate('brand', 'name')
      .lean();

    if (products.length === 0) return null;

    const productIds = products.map(p => p._id);
    const productById = {};
    products.forEach(p => { productById[p._id.toString()] = p; });

    // Step 3: Active subproducts — include costPrice and sale fields for pricing pipeline
    const subProducts = await SubProductModel.find({
      product: { $in: productIds },
      status: { $in: ['active', 'low_stock', 'out_of_stock'] },
      tenant: { $in: tenantFilter },
      baseSellingPrice: { $gt: 0 },
    }).select('product baseSellingPrice costPrice availableStock discount discountType discountStart discountEnd isOnSale saleType saleDiscountValue saleStartDate saleEndDate sizes tenant').lean();

    // Step 4: Sizes for those subproducts — match shop's exact filter
    const allSizeIds = subProducts.flatMap(sp => sp.sizes || []);
    const sizes = await SizeModel.find({
      _id: { $in: allSizeIds },
      status: 'active',
      availability: { $in: ['available', 'in_stock', 'low_stock'] },
    }).select('_id size volumeMl stock sellingPrice costPrice discountValue discountType discountStart discountEnd availability')
      .lean();
    const sizeById = {};
    sizes.forEach(s => { sizeById[s._id.toString()] = s; });

    // Step 5: Build product → subProducts map
    const spByProduct = {};
    subProducts.forEach(sp => {
      const pid = sp.product.toString();
      if (!spByProduct[pid]) spByProduct[pid] = [];
      spByProduct[pid].push(sp);
    });

    // Step 6: Build catalog lines + structured entries
    const catalogLines = [];
    const entries = [];
    const categorySet = new Set();

    for (const p of products) {
      const sps = spByProduct[p._id.toString()] || [];
      if (sps.length === 0) continue;

      // Compute final prices using same pipeline as /shop
      const computedPrices = [];
      const sizeMap = new Map(); // key → { label, price, originalPrice, onSale, stock }
      let anyOnSale = false;

      // Helper: apply SubProduct sale discount to a platform price (mirrors product.service.js)
      const applySaleDiscount = (platformPrice, sp) => {
        const now = new Date();
        const start = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
        const end = sp.saleEndDate ? new Date(sp.saleEndDate) : null;
        const saleActive = sp.isOnSale && sp.saleDiscountValue > 0 &&
          (!start || now >= start) && (!end || now <= end);
        if (!saleActive) return { price: platformPrice, onSale: false };
        let salePrice = platformPrice;
        if (sp.saleType === 'percentage' || sp.saleType === 'flash_sale') {
          salePrice = parseFloat((platformPrice * (1 - sp.saleDiscountValue / 100)).toFixed(2));
        } else if (sp.saleType === 'fixed') {
          salePrice = Math.max(0, parseFloat((platformPrice - sp.saleDiscountValue).toFixed(2)));
        }
        return { price: salePrice, originalPrice: platformPrice, onSale: true };
      };

      for (const sp of sps) {
        const tenant = tenantById[sp.tenant?.toString()];
        if (!tenant) continue;

        if (sp.sizes && sp.sizes.length > 0) {
          for (const sizeId of sp.sizes) {
            const sz = sizeById[sizeId.toString()];
            if (!sz) continue;
            const pricing = calculateSizePricing(sz, p, tenant, sp.costPrice, sp.baseSellingPrice);
            if (!pricing.finalPrice || pricing.finalPrice <= 0) continue;
            const { price: finalPrice, originalPrice, onSale } = applySaleDiscount(pricing.finalPrice, sp);
            if (onSale) anyOnSale = true;
            computedPrices.push(finalPrice);
            const key = sz.size || (sz.volumeMl + 'ml');
            const stock = sz.stock || sp.availableStock || 0;
            if (!sizeMap.has(key) || finalPrice < sizeMap.get(key).price) {
              sizeMap.set(key, { label: key, price: finalPrice, originalPrice, onSale, stock });
            }
          }
        } else {
          const pricing = calculateSubProductPricing(sp, p, tenant);
          if (!pricing.finalPrice || pricing.finalPrice <= 0) continue;
          const { price: finalPrice, onSale } = applySaleDiscount(pricing.finalPrice, sp);
          if (onSale) anyOnSale = true;
          computedPrices.push(finalPrice);
        }
      }

      if (computedPrices.length === 0) continue;

      const minPrice = Math.min(...computedPrices);
      const maxPrice = Math.max(...computedPrices);
      const totalStock = sps.reduce((sum, sp) => sum + (sp.availableStock || 0), 0);
      const stockLabel = totalStock === 0 ? '[Out of Stock]' : totalStock <= 5 ? `[Only ${totalStock} left]` : '[In Stock]';

      const sizeLines = sizeMap.size > 0
        ? [...sizeMap.values()].map(s => {
            let l = `    • ${s.label}: ₦${Math.round(s.price).toLocaleString()} (stock: ${s.stock})`;
            if (s.onSale && s.originalPrice) l += ` [was ₦${Math.round(s.originalPrice).toLocaleString()}]`;
            return l;
          })
        : [`    • Standard: ₦${Math.round(minPrice).toLocaleString()} (stock: ${totalStock})`];

      const catName = p.category?.name || p.type || '';
      const subCatName = p.subCategory?.name || p.subType || '';
      if (catName) categorySet.add(catName);

      let line = `• ${p.name}`;
      if (catName) line += ` [${catName}${subCatName ? ' > ' + subCatName : ''}]`;
      const meta = [];
      if (p.brand?.name) meta.push(p.brand.name);
      if (p.abv != null && p.abv !== '') meta.push(`${p.abv}% ABV`);
      if (meta.length) line += ` (${meta.join(', ')})`;
      line += ` — from ₦${Math.round(minPrice).toLocaleString()}`;
      if (minPrice !== maxPrice) line += ` to ₦${Math.round(maxPrice).toLocaleString()}`;
      if (anyOnSale) line += ' [ON SALE]';
      line += ` ${stockLabel}`;
      line += '\n' + sizeLines.join('\n');

      catalogLines.push(line);

      entries.push({
        id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        type: p.type || '',
        subType: p.subType || '',
        category: catName,
        subCategory: subCatName,
        brand: p.brand?.name || '',
        abv: typeof p.abv === 'number' ? p.abv : null,
        minPrice,
        maxPrice,
        totalStock,
        onSale: anyOnSale,
        image: p.images?.[0]?.url || p.images?.[0] || null,
        sizes: [...sizeMap.values()],
      });
    }

    if (catalogLines.length === 0) return null;

    const categoriesLine = categorySet.size > 0 ? `CATEGORIES IN CATALOG: ${[...categorySet].join(', ')}\n\n` : '';
    const text = `${categoriesLine}PRODUCTS:\n${catalogLines.join('\n')}`;

    const value = { text, entries };
    _catalogCache[cacheKey] = { time: now, value };
    return value;
  } catch (err) {
    console.error('loadCatalog error:', err.message);
    return null;
  }
};

// Back-compat: string-only catalog context for prompt building
const buildFullCatalogContext = async (tenantId = null) => {
  const catalog = await loadCatalog(tenantId);
  return catalog?.text || null;
};

// ── Substitute matching ──────────────────────────────────────────────────────
// Given a drink identified from a photo (or described in text), rank in-stock
// catalog entries by similarity: category → sub-category → brand → ABV
// proximity → price-range proximity.
const findSubstitutes = (identified, entries, limit = 4, excludeIds = []) => {
  if (!identified || !entries || entries.length === 0) return [];
  const norm = (s) => (s || '').toString().toLowerCase().trim();

  const idType = norm(identified.type);
  const idSub = norm(identified.subType);
  const idBrand = norm(identified.brand);
  const idAbv = typeof identified.abv === 'number' ? identified.abv : null;
  const idPrice = typeof identified.estimatedPriceNgn === 'number' && identified.estimatedPriceNgn > 0
    ? identified.estimatedPriceNgn : null;

  // Words that indicate the same broad category as the identified drink
  const typeGroups = {
    wine: ['wine', 'merlot', 'cabernet', 'shiraz', 'chardonnay', 'sauvignon', 'moscato', 'rosé', 'rose'],
    champagne: ['champagne', 'prosecco', 'sparkling', 'cava'],
    beer: ['beer', 'lager', 'stout', 'ale', 'pilsner'],
    whiskey: ['whiskey', 'whisky', 'scotch', 'bourbon', 'malt', 'rye'],
    vodka: ['vodka'],
    gin: ['gin'],
    rum: ['rum'],
    tequila: ['tequila', 'mezcal'],
    cognac: ['cognac', 'brandy', 'armagnac'],
    liqueur: ['liqueur', 'cream', 'amaretto', 'schnapps'],
    non_alcoholic: ['juice', 'soda', 'water', 'soft drink', 'non-alcoholic', 'malt', 'mocktail', 'energy'],
  };
  const groupWords = typeGroups[idType] || (idType ? [idType] : []);

  const scored = [];
  for (const e of entries) {
    if (!e.totalStock || e.minPrice <= 0) continue;
    if (excludeIds.includes(e.id)) continue;

    const haystack = norm(`${e.name} ${e.type} ${e.subType} ${e.category} ${e.subCategory}`);
    let score = 0;

    // Category affinity (strongest signal)
    if (groupWords.length > 0 && groupWords.some((w) => haystack.includes(w))) score += 40;
    else if (idType && norm(e.type).includes(idType)) score += 30;

    // Sub-category / style affinity
    if (idSub && haystack.includes(idSub)) score += 15;

    // Same brand, different bottle (e.g. another Hennessy expression)
    if (idBrand && idBrand.length > 2 && norm(`${e.name} ${e.brand}`).includes(idBrand)) score += 25;

    // ABV proximity
    if (idAbv != null && e.abv != null) {
      const diff = Math.abs(e.abv - idAbv);
      if (diff <= 3) score += 10;
      else if (diff <= 8) score += 5;
    }

    // Price-range proximity to the drink's typical retail price
    if (idPrice) {
      const ratio = e.minPrice / idPrice;
      if (ratio >= 0.7 && ratio <= 1.3) score += 15;
      else if (ratio >= 0.5 && ratio <= 1.8) score += 8;
    }

    if (score > 0) scored.push({ entry: e, score });
  }

  scored.sort((a, b) => b.score - a.score || a.entry.minPrice - b.entry.minPrice);
  return scored.slice(0, limit).map((s) => s.entry);
};

// Query products from database
const queryProducts = async (filters, searchQuery, limit = 10, brand = null, tenantId = null) => {
  try {
    const queryParams = {
      page: 1,
      limit,
      inStock: true,
      status: 'approved',
      searchMode: 'text',
      useEmbeddings: false,
    };

    // Map chatbot intent types to actual DB types (all spirits are stored as 'spirit')
    const intentTypeToDbType = {
      'whiskey': 'spirit', 'vodka': 'spirit', 'gin': 'spirit', 'rum': 'spirit',
      'tequila': 'spirit', 'cognac': 'spirit', 'brandy': 'spirit', 'spirit': 'spirit',
      'wine': 'wine', 'champagne': 'wine', 'beer': 'beer', 'cider': 'cider',
      'non_alcoholic': 'non_alcoholic',
    };
    // Specific spirit subtypes to add as search keywords for narrowing within 'spirit'
    const spiritKeywords = {
      'whiskey': 'whiskey scotch whisky bourbon', 'vodka': 'vodka', 'gin': 'gin',
      'rum': 'rum', 'tequila': 'tequila mezcal', 'cognac': 'cognac brandy',
    };

    if (searchQuery) queryParams.query = searchQuery;
    if (brand) queryParams.brand = brand;
    if (tenantId) queryParams.tenantId = tenantId;
    if (filters.type) {
      queryParams.type = intentTypeToDbType[filters.type] || filters.type;
      // If narrowing within spirits with no other search term, add subtype keyword
      if (!searchQuery && !brand && spiritKeywords[filters.type]) {
        queryParams.query = spiritKeywords[filters.type];
      }
    }
    if (filters.minPrice) queryParams.minPrice = filters.minPrice;
    if (filters.maxPrice) queryParams.maxPrice = filters.maxPrice;
    if (filters.minAbv) queryParams.minAbv = filters.minAbv;
    if (filters.maxAbv) queryParams.maxAbv = filters.maxAbv;
    if (filters.onSale) queryParams.onSale = true;

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

      // Spirit subtypes searched via name/subType since DB stores all spirits as type:'spirit'
      const spiritSubtypeKeywords = {
        'whiskey': ['whiskey', 'whisky', 'scotch', 'bourbon', 'malt', 'rye'],
        'vodka': ['vodka'], 'gin': ['gin'], 'rum': ['rum'],
        'tequila': ['tequila', 'mezcal'], 'cognac': ['cognac', 'brandy'],
      };
      const dbTypeMap = {
        'whiskey': 'spirit', 'vodka': 'spirit', 'gin': 'spirit', 'rum': 'spirit',
        'tequila': 'spirit', 'cognac': 'spirit', 'brandy': 'spirit', 'spirit': 'spirit',
        'wine': 'wine', 'champagne': 'wine', 'beer': 'beer', 'cider': 'cider',
      };

      const effectiveSearchQuery = searchQuery || (filters.type && spiritSubtypeKeywords[filters.type]
        ? spiritSubtypeKeywords[filters.type].join(' ')
        : null);

      if (effectiveSearchQuery) {
        const keywords = spiritSubtypeKeywords[filters.type] || [effectiveSearchQuery];
        const regexPatterns = keywords.map(k => ({ name: { $regex: k, $options: 'i' } }))
          .concat(keywords.map(k => ({ subType: { $regex: k, $options: 'i' } })));
        baseQuery.$or = regexPatterns;
      }

      if (filters.type) {
        baseQuery.type = dbTypeMap[filters.type] || filters.type;
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
      
      // Get pricing from SubProducts — same visibility rules as /shop page
      const productIds = products.map(p => p._id);

      // First get active tenants (approved + active/trialing subscription)
      const activeTenantsRaw = await Tenant.find({
        status: 'approved',
        subscriptionStatus: { $in: ['active', 'trialing'] },
      }).select('_id').lean();
      const activeTenantIds = activeTenantsRaw.map(t => t._id);

      const subProducts = await SubProduct.find({
        product: { $in: productIds },
        status: { $in: ['active', 'low_stock', 'out_of_stock'] },
        tenant: { $in: activeTenantIds },
        baseSellingPrice: { $gt: 0 },
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
        // Add sizes - use fetched Size docs with their individual pricing
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
            // Use Size's individual sellingPrice, fallback to baseSellingPrice
            const sizePrice = sizeDoc?.sellingPrice ?? sp.baseSellingPrice;
            availableAtMap[productId].sizes.push({
              _id: sizeId,
              size: sizeName,
              volumeMl: sizeDoc?.volumeMl,
              stock: sizeDoc?.availableStock ?? 0,
              pricing: {
                websitePrice: sizePrice,
                originalWebsitePrice: sizeDoc?.compareAtPrice ?? sizePrice
              },
              discount: sizeDoc?.discount ?? sp.discount
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
        
        // Calculate minPrice from individual Size documents, not just SubProduct baseSellingPrice
        const allSizePrices = sps.flatMap(sp => {
          return (sp.sizes || []).map(sizeId => {
            const sizeDoc = sizeMap[sizeId.toString()];
            return sizeDoc?.sellingPrice ?? sp.baseSellingPrice;
          }).filter(price => price > 0);
        });
        const minPrice = allSizePrices.length > 0 ? Math.min(...allSizePrices) : (sps.length > 0 ? Math.min(...sps.map(sp => sp.baseSellingPrice || 0).filter(price => price > 0)) : 0);
        
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

// Generate product context for AI
const generateProductContext = (products) => {
  if (!products || products.length === 0) return '';

  const validProducts = products.filter(p => p.minPrice > 0);
  if (validProducts.length === 0) return '';

  const lines = validProducts.slice(0, 6).map((p) => {
    const price = `₦${(p.minPrice || 0).toLocaleString()}`;
    const discount = p.hasDiscount ? ' [ON SALE]' : '';
    const stock = p.totalStock > 0
      ? p.totalStock <= 5 ? ` [Only ${p.totalStock} left]` : ' [In Stock]'
      : ' [Out of Stock]';

    // Include size variants — use minPrice as the size price to avoid platform markup
    const sizes = (p.sizes || []).slice(0, 3)
      .filter(s => (s.price > 0 || p.minPrice > 0))
      .map(s => `${s.size || s.name}: ₦${(p.minPrice || s.price).toLocaleString()}`)
      .join(', ');

    let line = `• ${p.name} — from ${price}${discount}${stock}`;
    if (sizes) line += `\n  Sizes: ${sizes}`;
    return line;
  });

  return `PRODUCTS IN OUR CATALOG:\n${lines.join('\n')}`;
};

// Extract the last product name/brand mentioned in conversation history
const extractLastProductFromHistory = (conversationHistory) => {
  if (!conversationHistory || conversationHistory.length === 0) return null;
  // Look at the last few assistant messages for a product name
  const assistantMessages = conversationHistory.filter(m => m.role === 'assistant').slice(-3).reverse();
  const productPattern = /•\s+([A-Z][^–—\-\n₦]+?)(?:\s*[–—\-]|₦|\n|$)/g;
  for (const msg of assistantMessages) {
    const matches = [...msg.content.matchAll(productPattern)];
    if (matches.length > 0) return matches[0][1].trim();
    // Also try bold product name pattern
    const boldMatch = msg.content.match(/\*\*([^*]+)\*\*\s+is available/);
    if (boldMatch) return boldMatch[1].trim();
  }
  // Fall back to last user message that had a brand/product keyword
  const userMessages = conversationHistory.filter(m => m.role === 'user').slice(-5).reverse();
  for (const msg of userMessages) {
    const words = msg.content.trim();
    if (words.length > 2 && words.length < 80 && !/too high|expensive|cheaper|afford|price/.test(words.toLowerCase())) {
      return words;
    }
  }
  return null;
};

// Main chatbot query handler
const handleChatbotQuery = async (options) => {
  const { query, imageUrls, imageUrl, tenantId, conversationHistory = [], fileContent, fileName, fileUnreadable, userId } = options;

  // Support both single imageUrl and multiple imageUrls
  const images = imageUrls || (imageUrl ? [imageUrl] : []);

  try {
    // Handle image query first — customers often send a photo with no text
    if (images.length > 0) {
      return await handleImageQuery(images, query || '', tenantId);
    }

    // File was attached but nothing readable could be extracted
    if (fileUnreadable) {
      return {
        response: `I couldn't read **${fileName || 'that file'}** 😕 — it may be scanned, empty, or in a format I don't support.\n\nPlease send your drink list as a **PDF, Word, Excel, CSV, or plain text** file — or simply type the items here, one per line:\n• 2 Heineken\n• 1 Hennessy VS\n• 3 Red wine`,
        products: [],
        quickReplies: [{ label: '⌨️ Type my list', query: 'I want to type my drink list' }, { label: '🍷 Browse catalog', query: 'What do you have?' }],
        intent: 'file_query',
      };
    }

    // Handle file content (drink list)
    if (fileContent) {
      return await handleFileQuery(fileContent, fileName, query || '', tenantId);
    }

    if (!query || query.trim().length < 1) {
      return await getGreetingResponse();
    }

    const intent = extractIntent(query, conversationHistory);

    // Short-circuit greetings without a DB query
    if (intent.isGreeting) return await getGreetingResponse();

    // ── Price complaint / budget query: resolve context from conversation history
    let priceComplaintContext = null;
    if (intent.isPriceComplaint || intent.filters.maxPrice) {
      const lastProduct = extractLastProductFromHistory(conversationHistory);
      if (lastProduct) {
        if (intent.isPriceComplaint) priceComplaintContext = lastProduct;
        const lastIntent = extractIntent(lastProduct);
        if (lastIntent.filters.type && !intent.filters.type) {
          intent.filters.type = lastIntent.filters.type;
        }
      }
    }

    // ── Product info follow-up: resolve product from conversation history ────
    // e.g. "tell me more about the wine" with no explicit product name
    let productInfoContext = null;
    if (intent.type === 'product_info' && !intent.brand && intent.keywords.length === 0) {
      const lastProduct = extractLastProductFromHistory(conversationHistory);
      if (lastProduct) {
        productInfoContext = lastProduct;
        intent.keywords.push(lastProduct);
      }
    }

    // Build search term: brand > keywords > raw query
    const searchTerm = intent.brand
      || (intent.keywords.length > 0 ? intent.keywords.join(' ') : null)
      || (intent.type === 'product_info' ? query : null)
      || (intent.type === 'general' ? query : null);

    // Load the full catalog (cached, mirrors /shop visibility rules) — keep the
    // structured entries too so CART_JSON names resolve on any turn
    const catalogData = await loadCatalog(tenantId);
    const fullCatalog = catalogData?.text || null;
    const catalogEntries = catalogData?.entries || [];

    let products = await queryProducts(intent.filters, searchTerm, 10, intent.brand, tenantId);

    // For price complaints with no results, retry keeping only the price ceiling
    if ((intent.isPriceComplaint || intent.filters.maxPrice) && products.length === 0) {
      const priceOnlyFilter = intent.filters.maxPrice ? { maxPrice: intent.filters.maxPrice } : {};
      products = await queryProducts(priceOnlyFilter, null, 10, null, tenantId);
    }

    // Broaden search: drop type filter if no results
    if (products.length === 0 && intent.filters.type) {
      const broadFilters = { ...intent.filters };
      delete broadFilters.type;
      products = await queryProducts(broadFilters, searchTerm, 8, null, tenantId);
    }

    // Last resort: search with the raw query, no filters
    if (products.length === 0 && query.trim().length > 2) {
      products = await queryProducts({}, query, 6, null, tenantId);
    }

    const productContext = generateProductContext(products);

    // Use full catalog as context — gives AI visibility of everything on the shop
    const catalogContext = fullCatalog || productContext;

    // ── Web search for product info, recommendations, and comparisons ─────────
    let webSearchResults = null;
    const needsWebSearch = ['product_info', 'recommendation', 'comparison', 'cocktail'].includes(intent.type);
    if (needsWebSearch && process.env.SERPER_API_KEY) {
      // Build a focused search query
      const productName = productInfoContext
        || intent.brand
        || (intent.keywords.length > 0 ? intent.keywords[0] : null);

      let webQuery = null;
      if (intent.type === 'product_info' && productName) {
        webQuery = `${productName} beverage history tasting notes food pairing`;
      } else if (intent.type === 'recommendation') {
        const typeLabel = intent.filters.type || 'drink';
        webQuery = `best ${typeLabel} recommendations Nigeria 2024`;
      } else if (intent.type === 'comparison' && intent.keywords.length >= 1) {
        webQuery = `${intent.keywords.join(' vs ')} difference comparison beverage`;
      } else if (intent.type === 'cocktail' && intent.keywords.length > 0) {
        webQuery = `${intent.keywords[0]} cocktail recipe`;
      } else if (productName) {
        webQuery = `${productName} beverage review`;
      }

      if (webQuery) {
        webSearchResults = await searchWeb(webQuery);
      }
    }

    // Build conversation history block (last 8 turns)
    const historyBlock = conversationHistory.slice(-8).map(m =>
      `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`
    ).join('\n');

    // Rich system prompt with catalog + conversation context
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${catalogContext ? `FULL SHOP CATALOG — ONLY use these products, categories, and prices. Do not invent anything outside this list:\n${catalogContext}` : '⚠️ CATALOG: No products available right now. Do NOT invent products or prices. Tell the customer to browse /shop.'}
${webSearchResults ? `\nWEB SEARCH RESULTS (use for history, descriptions, food pairings, expert knowledge — NOT for prices):\n${webSearchResults}` : ''}
${historyBlock ? `\nCONVERSATION SO FAR:\n${historyBlock}` : ''}
${priceComplaintContext ? `\nCONTEXT: The customer is reacting to the price of "${priceComplaintContext}" which was just shown. They want something more affordable in the same category.` : ''}
${productInfoContext ? `\nCONTEXT: The customer is asking for more information about "${productInfoContext}" which was mentioned earlier in the conversation.` : ''}
${intent.isFollowUp ? '\nCONTEXT: This is a short follow-up reaction to the previous message. Respond naturally in context — acknowledge their reaction warmly, then offer next steps.' : ''}

INTENT DETECTED: ${intent.type}${intent.isEvent ? ' (event planning)' : ''}${intent.isOnSale ? ' (looking for deals)' : ''}${intent.isPriceComplaint ? ' (price complaint)' : ''}${intent.isFollowUp ? ' (follow-up)' : ''}

RESPONSE INSTRUCTIONS FOR THIS QUERY:
${intent.type === 'price' ? '- Lead with the price clearly from the catalog. List all available sizes and their prices.' : ''}
${intent.type === 'price_complaint' ? '- Acknowledge the price empathetically (1 short sentence). Then list ONLY cheaper products from the CATALOG DATA. Show exact catalog prices. If none cheaper, say so and suggest browsing /shop.' : ''}
${intent.type === 'recommendation' ? '- Give a confident recommendation from the catalog. Briefly explain why it suits them using your expert knowledge.' : ''}
${intent.type === 'comparison' ? '- Compare key differences using your expert knowledge: taste, ABV, origin, style. For prices, use catalog only.' : ''}
${intent.type === 'event_planning' ? `- You are now a sommelier-level EVENT DRINKS PLANNER. Follow this process:
  1. GATHER: You need guest count and budget; occasion (wedding, birthday, corporate, house party…) and duration also help. If guest count or budget is missing, ask for what's missing in ONE friendly question (bundle occasion/duration into the same question). If they gave enough, don't re-ask — plan.
  2. QUANTITY MATH (adjust up for events over 4 hours):
     • Wine: 1 bottle per 2 guests • Champagne/sparkling: 1 bottle per 8 guests for a toast (per 4 if it's the main drink)
     • Beer: 2–3 bottles per beer drinker • Spirits: one 75cl bottle serves 12–15 mixed drinks (1 bottle per 8–10 guests)
     • Non-alcoholic: ALWAYS include — at least 25% of guests (juices, soft drinks, water, malt, alcohol-free options)
     • Remind them about ice (1kg per 2 guests), mixers (2–3 bottles per spirit bottle), and cups if relevant.
  3. MIX: Balance the selection for the occasion and Nigerian tastes — e.g. weddings lean champagne + wine + one premium spirit; house parties lean beer + spirits + mixers. Spread the budget: don't blow it all on one premium bottle; include mid-range crowd-pleasers from the catalog.
  4. PRESENT the plan with these sections:
     **Your Event Plan** — one warm sentence summarising occasion, guests, budget.
     A markdown table shopping list: | Product | Size | Qty | Price | Total | using ONLY catalog products and prices.
     **Grand Total: ₦…** — must come in AT or UNDER their budget; say how much headroom is left. If the budget is too small, give the best plan the budget allows and say what was trimmed.
     **Sommelier Tips** — 2-3 bullets: serving order, what to chill and for how long, signature-cocktail or pairing idea.
  5. Finish with the add-to-cart offer and CART_JSON listing every product with its planned quantity.` : ''}
${intent.type === 'discount' ? '- Highlight on-sale items from the catalog first. Show original vs sale price.' : ''}
${intent.type === 'cocktail' ? '- Give a full cocktail recipe using your expert knowledge. Mention if the base spirit is in our catalog.' : ''}
${intent.type === 'gift' ? '- Recommend premium gifting options from the catalog. Suggest presentation ideas.' : ''}
${intent.type === 'availability' ? '- Confirm clearly if in stock from the catalog. Direct yes/no first, then details.' : ''}
${intent.type === 'product_info' ? `- Give a RICH, EXPERT-LEVEL breakdown. Use your full beverage knowledge plus the catalog entry. Structure your response with:
  **About**: Origin, producer history, what makes this product special
  **Tasting Notes**: Color, aroma, palate, finish — be evocative and specific
  **Food Pairings**: 3-4 specific dishes that complement this drink
  **Serving Tips**: Temperature, glassware, whether to decant, ice or neat
  **Fun Fact**: One surprising or memorable detail about this product
  End with the catalog price and availability.` : ''}

${catalogContext ? CART_OFFER_INSTRUCTIONS : ''}`.trim();

    let response = await callClaude(query, systemPrompt, conversationHistory);

    // Filter out products with invalid/zero prices for display
    const validProducts = products.filter(p => p.minPrice > 0);

    // If Claude returned nothing, retry once with a minimal conversational prompt
    if (!response) {
      const minimalPrompt = `${BASE_SYSTEM_PROMPT}\n\nRespond naturally to the customer's message. Be warm and helpful. If they're reacting to a price or product, acknowledge it and offer next steps.`;
      response = await callClaude(query, minimalPrompt, conversationHistory);
    }

    // Honest fallback only if Claude is completely unavailable after the retry
    if (!response) {
      response = "I'm having trouble answering right now — please try again in a moment, or browse /shop.";
    }

    // Pull out the structured add-to-cart offer (and strip it from the display text).
    // Match against this query's products first, then the whole catalog — on a
    // confirmation turn ("yes please") the product search finds nothing, but the
    // re-emitted CART_JSON names still resolve via catalog entries.
    const { text: cleanResponse, proposal: cartProposal } = extractCartProposal(response, [...validProducts, ...catalogEntries]);
    response = cleanResponse;

    return {
      response,
      cartProposal,
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
    return {
      response: "Sorry, something went wrong on our end. Please try again in a moment.",
      products: [],
      quickReplies: ['Wines', 'Beers', 'Spirits', 'Events', 'Deals'],
      intent: 'error'
    };
  }
};

// Should show products based on intent and relevance
const shouldShowProducts = (intent, productCount, products = [], query = '') => {
  return productCount > 0;
};

// Handle image-based queries (single or multiple)
const handleImageQuery = async (imageUrls, userQuery = '', tenantId = null) => {
  const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  try {
    // Step 1: Analyze each image (pass user context, not as replacement prompt)
    const analyses = [];
    for (const imageUrl of images) {
      const analysis = await analyzeImage(imageUrl, userQuery || '');
      if (analysis) analyses.push(analysis);
    }

    // If vision failed entirely, still try to help via the user's text query
    if (analyses.length === 0) {
      const fallbackProducts = userQuery && userQuery.length > 3
        ? await queryProducts({}, userQuery, 5, null, tenantId)
        : [];

      if (fallbackProducts.length > 0) {
        const fullCatalog = await buildFullCatalogContext(tenantId);
        const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${fullCatalog ? `FULL SHOP CATALOG:\n${fullCatalog}` : ''}`;
        const response = await callClaude(
          userQuery || 'What drinks do you have?',
          systemPrompt
        ) || `I had trouble reading the image, but here's what I found matching your query:`;
        return {
          response,
          products: fallbackProducts.slice(0, 4).map(p => ({
            id: p._id, name: p.name, slug: p.slug, type: p.type,
            minPrice: p.minPrice, hasDiscount: p.hasDiscount,
            image: p.images?.[0]?.url || p.images?.[0] || null
          })),
          quickReplies: [{ label: '🔍 Search by name', query: 'Search drinks' }, { label: '📸 Try another photo', query: 'I want to search by image' }],
          intent: 'image_query'
        };
      }

      return {
        response: "I had trouble reading the image. Try sending a clearer photo with the label visible, or just tell me the name of the drink!",
        products: [],
        quickReplies: [{ label: '🔍 Search by name', query: 'Search drinks' }, { label: '🍷 Browse all', query: 'What do you have?' }],
        intent: 'image_query'
      };
    }

    // Step 2: Search catalog using the structured identification (fallback: prose)
    const allProducts = [];
    for (const a of analyses) {
      const identifiedName = a.identified?.name || a.identified?.brand || null;
      const productName = identifiedName || extractProductNameFromAnalysis(a.text);
      if (productName) {
        const intent = extractIntent(productName);
        let found = await queryProducts(intent.filters, productName, 4, null, tenantId);
        // Retry with brand alone if the full name found nothing
        if (found.length === 0 && a.identified?.brand && a.identified.brand !== productName) {
          found = await queryProducts({}, a.identified.brand, 4, null, tenantId);
        }
        allProducts.push(...found);
      }
    }
    const uniqueProducts = allProducts.filter((p, i, arr) =>
      arr.findIndex(x => x._id.toString() === p._id.toString()) === i
    );

    // Step 3: Load full catalog (text for prompt, entries for substitute matching)
    const catalog = await loadCatalog(tenantId);
    const fullCatalog = catalog?.text || null;

    // Step 3b: If the exact bottle isn't stocked, rank the closest substitutes
    // by category, sub-category, brand, ABV proximity, and price range.
    const inStockMatches = uniqueProducts.filter(p => p.totalStock > 0);
    let substitutes = [];
    const identified = analyses.find(a => a.identified)?.identified || null;
    if (inStockMatches.length === 0 && identified) {
      substitutes = findSubstitutes(
        identified,
        catalog?.entries || [],
        4,
        uniqueProducts.map(p => p._id.toString())
      );
    }

    // Step 4: Build a rich AI response using vision analysis + catalog + expert knowledge
    const imageContext = analyses.length === 1
      ? analyses[0].text
      : analyses.map((a, i) => `**Image ${i + 1}:**\n${a.text}`).join('\n\n');

    const catalogMatches = uniqueProducts.length > 0
      ? `\nCATALOG MATCHES FOUND:\n${uniqueProducts.map(p => `• ${p.name} — ₦${(p.minPrice || 0).toLocaleString()} [${p.totalStock > 0 ? 'In Stock' : 'Out of Stock'}]`).join('\n')}`
      : '\nNo exact catalog matches found for this product.';

    const substituteBlock = substitutes.length > 0
      ? `\nCLOSEST AVAILABLE SUBSTITUTES (in stock, ranked by similarity of category, brand, ABV and price):\n${substitutes.map(s => {
          const meta = [s.brand, s.abv != null ? `${s.abv}% ABV` : ''].filter(Boolean).join(', ');
          return `• ${s.name}${meta ? ` (${meta})` : ''} [${s.category}${s.subCategory ? ' > ' + s.subCategory : ''}] — from ₦${Math.round(s.minPrice).toLocaleString()}`;
        }).join('\n')}`
      : '';

    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${fullCatalog ? `FULL SHOP CATALOG:\n${fullCatalog}` : ''}

IMAGE ANALYSIS RESULT:
${imageContext}
${catalogMatches}${substituteBlock}

INSTRUCTIONS:
- The customer sent a photo of a drink. Use the image analysis above to identify it — open by naming the drink confidently.
- If the drink is in our catalog (see CATALOG MATCHES), tell them the price and availability from the catalog.
- Give a brief but expert description of the drink: what it is, origin, taste profile.
- If it's NOT in stock, say so honestly, then recommend the CLOSEST AVAILABLE SUBSTITUTES above by name — one line each explaining WHY it's a good stand-in (same style, similar strength, similar price). Use exact catalog prices.
- Keep response warm, concise, and expert-sounding.`;

    const userPrompt = userQuery || 'What drink is this? Tell me about it and check if you have it available.';
    const response = await callClaude(userPrompt, systemPrompt) || imageContext;

    const matchCards = uniqueProducts.slice(0, 4).map(p => ({
      id: p._id, name: p.name, slug: p.slug, type: p.type,
      minPrice: p.minPrice, hasDiscount: p.hasDiscount,
      image: (p.images && p.images[0]) ? (p.images[0].url || p.images[0]) : null
    }));
    const substituteCards = substitutes.map(s => ({
      id: s.id, name: s.name, slug: s.slug, type: s.type,
      minPrice: Math.round(s.minPrice), hasDiscount: s.onSale,
      image: s.image, isSubstitute: true
    }));

    return {
      response,
      products: [...matchCards, ...substituteCards].slice(0, 6),
      quickReplies: uniqueProducts.length > 0
        ? [{ label: '🛒 View product', query: `Tell me more about ${uniqueProducts[0].name}` }, { label: '💰 Price details', query: `Price of ${uniqueProducts[0].name}` }]
        : substitutes.length > 0
          ? [{ label: '🔄 More alternatives', query: `More drinks like ${identified?.name || identified?.brand || 'this'}` }, { label: '🍷 Browse catalog', query: 'What do you have?' }]
          : [{ label: '🔍 Search similar', query: identified?.name || analyses[0]?.text.split('\n')[0] || 'Search drinks' }, { label: '🍷 Browse catalog', query: 'What do you have?' }],
      intent: 'image_analysis',
      imageAnalyzed: true
    };

  } catch (error) {
    console.error('Image Query Error:', error.message);
    return {
      response: "I couldn't analyze the image. Could you describe the drink you're looking for?",
      products: [], quickReplies: [{ label: '🔍 Search by name', query: 'Search drinks' }], intent: 'image_query'
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

    // Compute exact order data in JS (prices/quantities must stay exact) —
    // Claude only composes the wording around these numbers, never invents them.
    let totalOrder = 0;
    const orderLines = allProducts.map((item) => {
      const product = item.found[0];
      const price = product.minPrice || 0;
      const total = price * item.quantity;
      totalOrder += total;
      return `${item.requested} x${item.quantity} = ₦${total.toLocaleString()}`;
    });

    const FREE_DELIVERY_THRESHOLD = 2000000;
    const deterministicSummary = [
      `📄 Processed ${drinkItems.length} item${drinkItems.length > 1 ? 's' : ''}:`,
      '',
      ...orderLines.map((l) => `• ${l}`),
      orderLines.length > 0 ? `\n**Total: ₦${totalOrder.toLocaleString()}**` : '',
      orderLines.length > 0 && totalOrder < FREE_DELIVERY_THRESHOLD
        ? `Add ₦${(FREE_DELIVERY_THRESHOLD - totalOrder).toLocaleString()} more for FREE delivery!`
        : '',
      notFound.length > 0 ? `\n❌ Not in catalog: ${notFound.map(n => n.name).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const fullCatalog = await buildFullCatalogContext(tenantId);
    const orderSystemPrompt = `${BASE_SYSTEM_PROMPT}

${fullCatalog ? `FULL SHOP CATALOG — use this only to suggest alternatives for items not found below:\n${fullCatalog}` : ''}

CUSTOMER'S UPLOADED ORDER (computed from our database — these prices and totals are final, do not change them):
${orderLines.length > 0 ? orderLines.map(l => `• ${l}`).join('\n') : '(no items matched our catalog)'}
GRAND TOTAL: ₦${totalOrder.toLocaleString()}
FREE DELIVERY THRESHOLD: ₦${FREE_DELIVERY_THRESHOLD.toLocaleString()}
ITEMS NOT FOUND IN CATALOG: ${notFound.length > 0 ? notFound.map(n => n.name).join(', ') : 'none'}

INSTRUCTIONS:
- Present the order clearly: bullet list of items with quantity and line total, then the grand total.
- Mention the free delivery threshold only if the total is below it.
- For items not found, suggest the closest available alternative from the FULL SHOP CATALOG above, briefly, one line per item. If none, say so honestly.
- Do not invent or change any price or quantity — use only the numbers given above.`;

    const response = await callClaude(userQuery || 'Please summarize my drink order.', orderSystemPrompt) || deterministicSummary;

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

// Get greeting response — instant (no AI round-trip) so the widget opens fast.
// Time-of-day aware with rotating variants so it doesn't feel canned.
const getGreetingResponse = async () => {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const variants = [
    `${timeGreeting}! 🍷 I'm your DrinksHarbour drinks expert. Ask me anything about wines, spirits, beers or soft drinks — or snap a photo of a bottle and I'll check if we have it in stock!`,
    `${timeGreeting}! 🥂 Welcome to DrinksHarbour. I can recommend the perfect drink, check prices and stock, plan drinks for your event, or identify any bottle from a photo. What can I do for you?`,
    `${timeGreeting}! 🍾 I'm here to help you find the perfect drink. Try me: ask for a recommendation, send a photo of a bottle, or upload your party drink list and I'll price it instantly.`,
  ];
  const response = variants[Math.floor(Math.random() * variants.length)];

  return {
    response,
    products: [],
    quickReplies: [
      { label: '🍷 Wines', query: 'Show me your best wines' },
      { label: '🥃 Spirits', query: 'Show me your whiskeys and spirits' },
      { label: '🍺 Beers', query: 'What beers do you have?' },
      { label: '🥤 Non-alcoholic', query: 'Show me non-alcoholic drinks' },
      { label: '🎉 Plan an event', query: 'Help me plan drinks for an event' },
      { label: '🔥 Deals', query: "What's on sale today?" },
    ],
    categories: [
      { name: 'Wine', icon: '🍷', slug: 'wine' },
      { name: 'Beer', icon: '🍺', slug: 'beer' },
      { name: 'Spirits', icon: '🥃', slug: 'spirit' },
      { name: 'Champagne', icon: '🍾', slug: 'champagne' }
    ],
    intent: 'greeting'
  };
};

// Build contextual quick replies
const buildQuickReplies = (intent, products) => {
  const defaults = [
    { label: '🍷 Wines', query: 'Show me wines' },
    { label: '🍺 Beers', query: 'Best beers' },
    { label: '🥃 Whiskey', query: 'Best whiskeys' },
    { label: '🔥 On Sale', query: "What's on sale today?" },
  ];

  const byType = {
    recommendation: [
      { label: '🍷 Red Wine', query: 'Best red wines' },
      { label: '🥃 Whiskey', query: 'Top whiskeys under ₦50,000' },
      { label: '🍾 Champagne', query: 'Champagne options' },
      { label: '🎉 Event', query: 'Help me plan a party' },
    ],
    discount: [
      { label: '🔥 Flash Sale', query: 'Flash sale deals' },
      { label: '💰 Under ₦10k', query: 'Drinks under ₦10000' },
      { label: '🥃 Spirits deals', query: 'Whiskey on sale' },
      { label: '🍷 Wine deals', query: 'Wine on sale' },
    ],
    event_planning: [
      { label: '👥 10 guests', query: 'Drinks for 10 people party' },
      { label: '👥 50 guests', query: 'Drinks for 50 people event' },
      { label: '💒 Wedding', query: 'Drinks for a wedding' },
      { label: '🎂 Birthday', query: 'Drinks for a birthday party' },
    ],
    cocktail: [
      { label: '🍹 Mojito', query: 'How to make a Mojito' },
      { label: '🥃 Old Fashioned', query: 'How to make an Old Fashioned' },
      { label: '🍸 Martini', query: 'How to make a Martini' },
    ],
    gift: [
      { label: '🎁 Premium spirits', query: 'Premium gift spirits' },
      { label: '🍷 Gift wine', query: 'Best wine for a gift' },
      { label: '🍾 Champagne gift', query: 'Champagne for gifting' },
    ],
    comparison: [
      { label: '🥃 Whiskey vs Cognac', query: 'Whiskey vs Cognac differences' },
      { label: '🍷 Red vs White', query: 'Red wine vs white wine' },
    ],
    price_complaint: [
      { label: '💰 Budget options', query: 'Show me affordable drinks' },
      { label: '🔥 On Sale', query: "What's on sale today?" },
      { label: '🥃 Cheap whiskey', query: 'Whiskey under ₦20000' },
      { label: '🍷 Cheap wine', query: 'Wine under ₦10000' },
    ],
  };

  if (byType[intent.type]) return byType[intent.type];

  if (products.length > 0) {
    const first = products[0];
    return [
      { label: `🔍 More like ${first.name?.split(' ')[0]}`, query: `Similar to ${first.name}` },
      ...defaults.slice(0, 3),
    ];
  }

  return defaults;
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

    const response = await callClaude(
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
  buildFullCatalogContext,
  loadCatalog,
  findSubstitutes,
  getGreetingResponse,
  extractCartProposal,
  anthropic
};
