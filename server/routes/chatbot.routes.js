'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const rateLimit = require('express-rate-limit');
const { greeting, query, escalate } = require('../controllers/chatbot.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

/**
 * A much tighter budget than the router-wide limiter, because this is the only
 * public endpoint that makes the server emit mail. Nobody legitimately asks to
 * speak to a human five times in ten minutes, and without this a scripted
 * client could fill the support mailbox — and get the sending domain
 * blacklisted — straight from an unauthenticated browser.
 */
const escalationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: {
    success: false,
    message: 'You have already asked for a human recently — please wait for a reply.',
  },
});

router.post('/greeting', greeting);
router.post(
  '/query',
  upload.fields([{ name: 'images', maxCount: 5 }, { name: 'file', maxCount: 1 }]),
  query
);
router.post('/escalate', escalationLimiter, escalate);

module.exports = router;
