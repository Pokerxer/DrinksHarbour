// routes/tts.routes.js
//
// POST /api/tts — Public text-to-speech endpoint for the platform search module.
//
// Accepts { text } in the request body, returns audio/mpeg bytes generated
// via Fish Audio's TTS API (proxied through the server so the API key never
// reaches the browser). Audio is cached on disk (services/fishAudio.service)
// so the same text is billed once.
//
// Rate-limited: 30 requests per 15 minutes per IP (stricter than the global
// 100/15min limiter). Input capped at 300 characters.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { synthesize, isConfigured } = require('../services/fishAudio.service');

const router = express.Router();

// ── Rate limiter ────────────────────────────────────────────────────────────

const ttsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many audio requests. Please wait and try again.' },
});

// ── POST / — synthesize text to speech ──────────────────────────────────────

router.post(
  '/',
  ttsLimiter,
  async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'A "text" field is required.',
        });
      }

      const trimmed = text.trim().slice(0, 300);
      if (trimmed.length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Text is too short for audio synthesis.',
        });
      }

      if (!isConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Audio features are not configured. Please contact support.',
        });
      }

      const { buffer, format, cached } = await synthesize(trimmed);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Audio-Cached': cached ? 'true' : 'false',
        'X-Audio-Model': process.env.FISH_AUDIO_MODEL || 's2.1-pro-free',
      });

      return res.send(buffer);
    } catch (err) {
      const status = err.status || 500;
      console.error(`[TTS] Error (${status}):`, err.message);
      return res.status(status).json({
        success: false,
        message: status === 503
          ? 'Audio features are not configured. Please contact support.'
          : 'Audio generation failed. Please try again.',
      });
    }
  },
);

module.exports = router;
