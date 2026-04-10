const express = require('express');
const router = express.Router();
const { searchPinterestImages, getOauthUrl, exchangeCodeForToken, getUserPins, getUserBoards } = require('../services/pinterest.service');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const searchLimit = Math.min(parseInt(limit) || 20, 50);
  const results = await searchPinterestImages(q.trim(), searchLimit);

  res.json({
    success: true,
    count: results.length,
    results,
  });
}));

router.get('/pins', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const pins = await getUserPins(limit);

  const mapped = pins.map((pin) => ({
    id: pin.id,
    title: pin.title || '',
    description: pin.description || '',
    imageUrl: pin.media?.images?.original?.url || pin.media?.images?.['236x']?.url || '',
    link: pin.link || '',
    pinUrl: `https://www.pinterest.com/pin/${pin.id}/`,
    boardId: pin.board_id || null,
  }));

  res.json({
    success: true,
    count: mapped.length,
    results: mapped,
  });
}));

router.get('/boards', asyncHandler(async (req, res) => {
  const boards = await getUserBoards();

  res.json({
    success: true,
    count: boards.length,
    results: boards,
  });
}));

router.get('/oauth-url', asyncHandler(async (req, res) => {
  const { url, state } = getOauthUrl();
  res.json({
    success: true,
    url,
    state,
  });
}));

router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/ecommerce/products/create?pinterest_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/ecommerce/products/create?pinterest_error=no_code`);
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    
    process.env.PINTEREST_ACCESS_TOKEN = tokens.accessToken;
    if (tokens.refreshToken) {
      process.env.PINTEREST_REFRESH_TOKEN = tokens.refreshToken;
    }

    res.redirect(`${process.env.FRONTEND_URL}/ecommerce/products/create?pinterest_success=true`);
  } catch (err) {
    console.error('Pinterest OAuth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/ecommerce/products/create?pinterest_error=${encodeURIComponent(err.message)}`);
  }
}));

router.get('/status', asyncHandler(async (req, res) => {
  const hasToken = !!process.env.PINTEREST_ACCESS_TOKEN;
  const hasAppCredentials = !!(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET);
  
  res.json({
    success: true,
    authenticated: hasToken,
    configured: hasAppCredentials,
    message: hasToken 
      ? 'Connected to Pinterest' 
      : hasAppCredentials 
        ? 'App configured but not authenticated. Click "Connect Pinterest" to authorize.'
        : 'Pinterest app not configured. Add PINTEREST_APP_ID and PINTEREST_APP_SECRET to .env',
  });
}));

module.exports = router;