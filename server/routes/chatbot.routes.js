// server/routes/chatbot.routes.js
// Chatbot Routes for DrinksHarbour - Supports text, images, and database queries

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  chat,
  chatAlt,
  analyzeImageEndpoint,
  getProductInfo,
  recommendations,
  search,
  greeting,
  knowledge,
  compare
} = require('../controllers/chatbot.controller');

// Custom upload middleware that accepts both 'image' and 'file' fields
const storage = multer.memoryStorage();
const chatbotUpload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|webp|gif/;
    const docTypes = /txt|csv|json|pdf|doc|docx/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const isImage = imageTypes.test(ext) || file.mimetype.startsWith('image/');
    const isDoc = docTypes.test(ext) || file.mimetype.includes('text') || file.mimetype.includes('pdf');
    if (isImage || isDoc) return cb(null, true);
    cb(new Error('Invalid file type'));
  }
});

// @route   POST /api/chatbot/query
// @desc    Handle chatbot conversation with multiple images, files, or text
// @access  Public
router.post('/query', chatbotUpload.fields([{ name: 'images', maxCount: 5 }, { name: 'file', maxCount: 1 }]), chat);

// @route   POST /api/chatbot/chat
// @desc    Alternative chat endpoint
// @access  Public
router.post('/chat', chatbotUpload.single('image'), chatAlt);

// @route   POST /api/chatbot/analyze-image
// @desc    Analyze an image of a drink
// @access  Public
router.post('/analyze-image', chatbotUpload.single('image'), analyzeImageEndpoint);

// @route   POST /api/chatbot/details
// @desc    Get product details
// @access  Public
router.post('/details', getProductInfo);

// @route   POST /api/chatbot/recommendations
// @desc    Get product recommendations
// @access  Public
router.post('/recommendations', recommendations);

// @route   POST /api/chatbot/search
// @desc    Search products
// @access  Public
router.post('/search', search);

// @route   POST /api/chatbot/greeting
// @desc    Get chatbot greeting
// @access  Public
router.post('/greeting', greeting);

// @route   POST /api/chatbot/knowledge
// @desc    Get beverage knowledge base
// @access  Public
router.post('/knowledge', knowledge);

// @route   POST /api/chatbot/compare
// @desc    Compare products
// @access  Public
router.post('/compare', compare);

module.exports = router;
