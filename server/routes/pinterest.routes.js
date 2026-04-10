const express = require('express');
const router = express.Router();
const { searchPinterestImages } = require('../services/pinterest.service');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const searchLimit = Math.min(parseInt(limit) || 20, 50);
  const results = await searchPinterestImages(q.trim(), searchLimit);

  const mapped = results.map((pin) => ({
    id: pin.node_id || pin.id || Math.random().toString(36).substr(2, 9),
    title: pin.title || pin.description || '',
    description: pin.description || pin.title || '',
    imageUrl: pin.image?.url || pin.image_url || pin.image || '',
    link: pin.url || pin.link || '',
    pinUrl: pin.url || '',
  }));

  res.json({
    success: true,
    count: mapped.length,
    results: mapped,
  });
}));

module.exports = router;