// server/controllers/chatbot.controller.js
// Chatbot Controller for DrinksHarbour - Supports text, images, and database queries

const asyncHandler = require('express-async-handler');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');
const {
  handleChatbotQuery,
  generateProductDetails,
  analyzeImage,
  extractIntent,
  queryProducts,
  beverageKnowledgeBase
} = require('../services/chatbot.service');

// Configure multer for image and file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow images
    const imageTypes = /jpeg|jpg|png|webp|gif/;
    const imageExt = imageTypes.test(path.extname(file.originalname).toLowerCase());
    const imageMime = imageTypes.test(file.mimetype);
    
    // Allow text files and documents
    const docTypes = /txt|csv|json|pdf|doc|docx|xlsx|xls/;
    const docExt = docTypes.test(path.extname(file.originalname).toLowerCase());
    const docMime = docTypes.test(file.mimetype) || file.mimetype.includes('text') || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel');
    
    if (imageExt || docExt) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpg, png, gif, webp) or documents (txt, csv, xlsx, pdf) are allowed!'));
  }
});

// @route   POST /api/chatbot/query
// @desc    Handle chatbot conversation (text, images, or file)
// @access  Public
// @body    { query: string, images: files[], file: file, imageUrl: string, tenantId: string, conversationHistory: [] }
const chat = asyncHandler(async (req, res) => {
  let { query, imageUrl, tenantId, conversationHistory } = req.body;
  
  // Parse conversationHistory if it's a string (from form data)
  if (conversationHistory && typeof conversationHistory === 'string') {
    try {
      conversationHistory = JSON.parse(conversationHistory);
    } catch (e) {
      conversationHistory = [];
    }
  }
  
  // Handle multiple images or single image/file upload from multipart
  let uploadedImageUrls = [];
  let fileContent = null;
  let fileName = null;
  
  // Handle files from upload.fields()
  const files = req.files || (req.file ? { images: [req.file], file: [req.file] } : {});
  
  // Handle multiple images
  if (files.images && files.images.length > 0) {
    files.images.forEach((img) => {
      uploadedImageUrls.push(`data:${img.mimetype};base64,${img.buffer.toString('base64')}`);
    });
  }
  
  // Handle imageUrl as fallback
  if (!uploadedImageUrls.length && imageUrl) {
    uploadedImageUrls.push(imageUrl);
  }
  
  // Handle document/file
  if (files.file && files.file[0]) {
    const file = files.file[0];
    const isImage = file.mimetype.startsWith('image/');
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!isImage) {
      fileName = file.originalname;
      
      if (ext === '.xlsx' || ext === '.xls') {
        try {
          const workbook = XLSX.read(file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          fileContent = jsonData.map(row => row.join(', ')).join('\n');
        } catch (err) {
          console.error('Error parsing Excel file:', err);
          fileContent = `Excel file: ${fileName}`;
        }
      } else if (ext === '.pdf') {
        try {
          const pdfData = await pdfParse(file.buffer);
          fileContent = pdfData.text;
        } catch (err) {
          console.error('Error parsing PDF:', err);
          fileContent = `PDF file: ${fileName}`;
        }
      } else {
        fileContent = file.buffer.toString('utf-8');
      }
    }
  }

  if (!query && uploadedImageUrls.length === 0 && !fileContent) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a query, image, or file'
    });
  }

  // Build the query based on what's provided
  let finalQuery = query || '';
  
  if (fileContent) {
    const items = parseDrinkList(fileContent);
    
    if (items.length > 0) {
      const itemList = items.map(item => `${item.quantity || 1}x ${item.name}`).join(', ');
      finalQuery = `I have a drink list: ${itemList}. Please check availability and prices for each item.`;
    } else {
      finalQuery = `Please process this file: ${fileContent}`;
    }
  }

  const result = await handleChatbotQuery({
    query: finalQuery || (uploadedImageUrls.length > 0 ? 'What are these drinks? Tell me about them.' : 'What can I help you find?'),
    imageUrls: uploadedImageUrls,
    tenantId,
    conversationHistory: conversationHistory || [],
    fileContent,
    fileName
  });

  if (fileContent && result) {
    result.fileProcessed = true;
    result.fileName = fileName;
  }

  res.json({
    success: true,
    data: result
  });
});

// Helper function to parse drink lists from text/CSV
const parseDrinkList = (content) => {
  const items = [];
  
  // Check if it's CSV format
  const isCSV = content.includes(',') && (content.toLowerCase().includes('quantity') || content.toLowerCase().includes('item') || content.match(/^\d+,\s*.+/m));
  
  if (isCSV) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;
      
      // Skip headers
      const lower = trimmed.toLowerCase();
      if (lower.includes('item') || lower.includes('quantity') || lower.includes('name') || lower === 'drinks,quantity') continue;
      
      // CSV: "Heineken, 2" or "2, Heineken"
      const parts = trimmed.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      
      if (parts.length >= 2) {
        // Try to figure out which is quantity
        const first = parts[0];
        const second = parts[1];
        
        if (/^\d+$/.test(first)) {
          items.push({ quantity: parseInt(first), name: second });
        } else if (/^\d+$/.test(second)) {
          items.push({ quantity: parseInt(second), name: first });
        } else {
          items.push({ quantity: 1, name: trimmed.replace(/,/g, ' ') });
        }
      } else if (parts.length === 1) {
        items.push({ quantity: 1, name: parts[0] });
      }
    }
  } else {
    // Plain text format
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;
      
      // Skip headers
      const lower = trimmed.toLowerCase();
      if (lower.includes('item') && (lower.includes('quantity') || lower.includes('amount'))) continue;
      if (trimmed.match(/^[-=]+$/)) continue;
      
      // Try different patterns
      let match = trimmed.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      if (match) {
        items.push({ quantity: parseInt(match[1]), name: match[2].trim() });
      } else {
        match = trimmed.match(/^(.+?)\s*[-–—]\s*(\d+)$/);
        if (match) {
          items.push({ quantity: parseInt(match[2]), name: match[1].trim() });
        } else {
          match = trimmed.match(/^\d+[.)\]]\s*(.+)$/);
          if (match) {
            items.push({ quantity: 1, name: match[1].trim() });
          } else {
            items.push({ quantity: 1, name: trimmed });
          }
        }
      }
    }
  }
  
  return items;
};

// @route   POST /api/chatbot/chat
// @desc    Alternative chat endpoint
// @access  Public
const chatAlt = asyncHandler(async (req, res) => {
  const { query, imageUrl, tenantId, conversationHistory } = req.body;

  if (!query && !imageUrl) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a query or image URL'
    });
  }

  const result = await handleChatbotQuery({
    query: query || 'What is this drink?',
    imageUrl,
    tenantId,
    conversationHistory: conversationHistory || []
  });

  res.json({ success: true, data: result });
});

// @route   POST /api/chatbot/analyze-image
// @desc    Analyze an image of a drink
// @access  Public
// @body    { image: file, imageUrl: string, context: string }
const analyzeImageEndpoint = asyncHandler(async (req, res) => {
  let imageUrl = req.body.imageUrl;
  
  if (req.file) {
    imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an image to analyze'
    });
  }

  const analysis = await analyzeImage(imageUrl, req.body.context);
  
  // Try to find related products
  let relatedProducts = [];
  const productMatch = analysis?.match(/(?:similar to|like|product|drink)(?:s?)?\s+(?:called|named)?\s+([A-Za-z\s]+)/i);
  if (productMatch) {
    const intent = extractIntent(productMatch[1]);
    relatedProducts = await queryProducts(intent.filters, productMatch[1], 4);
  }

  res.json({
    success: true,
    data: {
      analysis,
      relatedProducts: relatedProducts.slice(0, 4).map(p => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        minPrice: p.minPrice,
        image: p.images?.[0]?.url
      }))
    }
  });
});

// @route   POST /api/chatbot/details
// @desc    Get product details
// @access  Public
const getProductInfo = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a productId'
    });
  }

  const result = await generateProductDetails(productId);

  if (result.error) {
    return res.status(404).json({ success: false, message: result.error });
  }

  res.json({ success: true, data: result });
});

// @route   POST /api/chatbot/recommendations
// @desc    Get recommendations
// @access  Public
const recommendations = asyncHandler(async (req, res) => {
  const { type, budget, occasion, count } = req.body;

  const filters = {};
  if (type) filters.type = type;
  if (budget) {
    const [min, max] = budget.split('-').map(Number);
    if (max) filters.maxPrice = max;
  }
  if (occasion) filters.isEvent = true;

  const products = await queryProducts(filters, null, count || 5);

  res.json({
    success: true,
    data: {
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        minPrice: p.minPrice,
        hasDiscount: p.hasDiscount,
        image: p.images?.[0]?.url
      })),
      count: products.length
    }
  });
});

// @route   POST /api/chatbot/search
// @desc    Search products
// @access  Public
const search = asyncHandler(async (req, res) => {
  const { q, limit } = req.body;

  if (!q || q.trim().length < 2) {
    return res.json({ success: true, data: { products: [] } });
  }

  const intent = extractIntent(q);
  const products = await queryProducts(intent.filters, q, limit || 10);

  res.json({
    success: true,
    data: {
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        brand: p.brand,
        minPrice: p.minPrice,
        hasDiscount: p.hasDiscount,
        image: p.images?.[0]?.url
      }))
    }
  });
});

// @route   POST /api/chatbot/greeting
// @desc    Get greeting
// @access  Public
const greeting = asyncHandler(async (req, res) => {
  const greetings = [
    "👋 Hi! I'm DrinksHarbour AI - your beverage assistant!",
    "🎉 Welcome to DrinksHarbour! How can I help?",
    "🥃 Hey! What can I get you today?"
  ];
  
  res.json({
    success: true,
    data: {
      greeting: greetings[Math.floor(Math.random() * greetings.length)],
      quickReplies: [
        { label: '🍷 Wines', query: 'Show me wines' },
        { label: '🍺 Beers', query: 'Best beers' },
        { label: '🥃 Spirits', query: 'Whiskey options' },
        { label: '⭐ On Sale', query: 'Current discounts' },
        { label: '❓ Help', query: 'Help me choose' }
      ],
      categories: [
        { name: 'Wine', icon: '🍷', slug: 'wine' },
        { name: 'Beer', icon: '🍺', slug: 'beer' },
        { name: 'Spirits', icon: '🥃', slug: 'spirit' },
        { name: 'Champagne', icon: '🍾', slug: 'champagne' },
        { name: 'Whiskey', icon: '🥃', slug: 'whiskey' },
        { name: 'Vodka', icon: '❄️', slug: 'vodka' }
      ]
    }
  });
});

// @route   POST /api/chatbot/knowledge
// @desc    Get general beverage knowledge
// @access  Public
const knowledge = asyncHandler(async (req, res) => {
  const { topic } = req.body;

  const topics = {
    wine: beverageKnowledgeBase.wine,
    beer: beverageKnowledgeBase.beer,
    spirit: beverageKnowledgeBase.spirit,
    cocktails: beverageKnowledgeBase.cocktail_basics
  };

  if (topic && topics[topic.toLowerCase()]) {
    return res.json({
      success: true,
      data: topics[topic.toLowerCase()]
    });
  }

  // Return all knowledge
  res.json({
    success: true,
    data: topics
  });
});

// @route   POST /api/chatbot/compare
// @desc    Compare two or more products
// @access  Public
const compare = asyncHandler(async (req, res) => {
  const { productIds } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least 2 product IDs to compare'
    });
  }

  const products = await Promise.all(
    productIds.map(id => generateProductDetails(id))
  );

  const validProducts = products.filter(p => !p.error);

  res.json({
    success: true,
    data: {
      products: validProducts.map(p => p.product),
      comparison: {
        prices: validProducts.map(p => ({
          name: p.product?.name,
          minPrice: p.product?.subProducts?.[0]?.baseSellingPrice
        })),
        abv: validProducts.map(p => p.product?.abv),
        origins: validProducts.map(p => p.product?.originCountry)
      }
    }
  });
});

// @route   POST /api/chatbot/stream
// @desc    Handle streaming chatbot conversation
// @access  Public
const chatStream = asyncHandler(async (req, res) => {
  let { query, imageUrl, tenantId, conversationHistory } = req.body;
  
  if (!query || !query.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a query'
    });
  }

  // Parse conversationHistory if it's a string
  if (conversationHistory && typeof conversationHistory === 'string') {
    try {
      conversationHistory = JSON.parse(conversationHistory);
    } catch (e) {
      conversationHistory = [];
    }
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullResponse = '';
  let products = [];
  let intent = 'general';
  let hasProducts = false;

  try {
    // First, get products synchronously for quick reply
    const { extractIntent, queryProducts } = require('../services/chatbot.service');
    const intentObj = extractIntent(query);
    const searchTerm = intentObj.keywords.length > 0 ? intentObj.keywords.join(' ') : null;
    const foundProducts = await queryProducts(intentObj.filters, searchTerm, 4, intentObj.brand);
    
    products = foundProducts.slice(0, 4).map(p => ({
      id: p._id, name: p.name, slug: p.slug, type: p.type,
      minPrice: p.minPrice, hasDiscount: p.hasDiscount,
      image: p.images?.[0]?.url
    }));
    intent = intentObj.type;
    hasProducts = foundProducts.length > 0;

    // Stream the response
    const result = await require('../services/chatbot.service').handleChatbotQuery(
      {
        query,
        imageUrl,
        tenantId,
        conversationHistory: conversationHistory || [],
      },
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    if (result && !fullResponse) {
      fullResponse = result.response;
    }

    // Send final message with products
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      response: fullResponse,
      products: products,
      intent: intent,
      hasProducts: hasProducts
    })}\n\n`);
    
  } catch (error) {
    console.error('Stream Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong' })}\n\n`);
  } finally {
    res.end();
  }
});

// Export with upload middleware
module.exports = {
  chat,
  chatAlt,
  analyzeImageEndpoint,
  getProductInfo,
  recommendations,
  search,
  greeting,
  knowledge,
  compare,
  chatStream,
  upload
};
