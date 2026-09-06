'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const rateLimit = require('express-rate-limit');
const concurrencyGuard = require('../middleware/concurrencyGuard.middleware');
const { greeting, query, escalate } = require('../controllers/chatbot.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

/**
 * Every ceiling in this file is a fixed number and none of them is derived from
 * NODE_ENV. The global limiter in server.js is `max: isProduction ? 100 : 1000`,
 * and the Vercel production backend runs with NODE_ENV set to the literal
 * string 'development' — so in production that limiter sits at the dev ceiling
 * of 1000 and cannot be relied on as the floor under anything here.
 */

/**
 * /query is the most expensive public endpoint on the platform: a catalogue
 * pipeline plus a paid model call, on an unauthenticated route that will also
 * accept 48 MB of uploads to base64 into the prompt. It gets three independent
 * bounds because each one answers a question the others do not.
 *
 * Burst — how fast. A person types; five sends in thirty seconds is already
 * faster than anyone converses, and this is what turns a loop into a wait.
 */
const queryBurstLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: {
    success: false,
    message: "You're sending messages very quickly — give me a moment to catch up.",
  },
});

/**
 * Sustained — how much in total. A genuine shopping conversation runs ten to
 * twenty turns; thirty per quarter-hour leaves room for a thorough customer and
 * still caps one IP's model spend.
 */
const querySustainedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: {
    success: false,
    message: 'You have reached the chat limit for now. Please try again in a few minutes.',
  },
});

/**
 * Simultaneous — how many at once, which neither window above constrains: a
 * script can satisfy both while holding two hundred sockets open, each resident
 * in memory with its uploads.
 *
 * Two per IP rather than one because Nigerian mobile networks NAT aggressively
 * and several real customers routinely share an egress IP; one would make two
 * genuine shoppers block each other. Two still turns a flood into two sockets
 * and an immediate refusal for the rest. The per-process twelve is the backstop
 * for a distributed burst, where no single IP crosses its own limit.
 */
const queryConcurrency = concurrencyGuard({
  max: 2,
  globalMax: 12,
  message: 'Please wait for your current question to finish before sending another.',
});

/**
 * /greeting is cheap — it opens the widget — but it is public and it does hit
 * the service, so it gets a ceiling far above any real widget's behaviour and
 * far below a script's.
 */
const greetingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many requests. Please try again shortly.' },
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

router.post('/greeting', greetingLimiter, greeting);

// Order is the point: every middleware that can refuse the request runs before
// multer. Behind it, a rejected 48 MB upload would still be read into memory
// first, which is most of the cost the refusal exists to avoid.
router.post(
  '/query',
  queryBurstLimiter,
  querySustainedLimiter,
  queryConcurrency,
  upload.fields([{ name: 'images', maxCount: 5 }, { name: 'file', maxCount: 1 }]),
  query
);

router.post('/escalate', escalationLimiter, escalate);

module.exports = router;
