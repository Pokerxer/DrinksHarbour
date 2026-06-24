'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { greeting, query } = require('../controllers/chatbot.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

router.post('/greeting', greeting);
router.post(
  '/query',
  upload.fields([{ name: 'images', maxCount: 5 }, { name: 'file', maxCount: 1 }]),
  query
);

module.exports = router;
