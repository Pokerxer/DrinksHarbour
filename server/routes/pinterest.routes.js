const express = require('express');
const router = express.Router();
const { searchImages, checkStatus } = require('../services/pinterest.service');
const { authenticate } = require('../middleware/auth.middleware');
const cloudinaryService = require('../services/cloudinary.service');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Check if Pinterest token is configured
router.get('/status', (req, res) => {
  const status = checkStatus();
  res.json({ success: true, ...status });
});

// Search Pinterest pins
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const results = await searchImages(q.trim(), parseInt(limit) || 30);
  res.json({ success: true, count: results.length, results });
}));

// Import Pinterest image URLs into Cloudinary (authenticated)
router.post('/import-images', authenticate, asyncHandler(async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  const results = [];
  for (const url of urls) {
    try {
      const uploaded = await cloudinaryService.uploadFromUrl(url, {
        folder: 'products/gallery',
        tags: ['pinterest-import'],
        context: { uploadedBy: req.user?._id?.toString() },
      });
      results.push({ success: true, ...uploaded });
    } catch (err) {
      console.error('Failed to import Pinterest image:', url, err.message);
      results.push({ success: false, url, error: err.message });
    }
  }

  const successful = results.filter((r) => r.success);
  res.json({ success: true, count: successful.length, data: successful });
}));

module.exports = router;
